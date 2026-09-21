import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { checkSEO, SEO_RULES } from './seo_checker';
import { ARTICLE_LLM_MODELS, getArticleLlmStrategySummary, getGeminiModelTiers } from './model_tiers';
import { GeminiQuotaExceededError, reserveGeminiRequest, rollbackGeminiRequest, recordTokenUsage } from './gemini_quota';
import {
  classifyGeminiFailure,
  GeminiFailureKind,
  isApiKeyInvalidError,
  isRetryableGeminiError,
} from './gemini_failure';


const DEFAULT_BUYING_POINT_HEADING = '## このコースで確認したい判断材料';
const RACE_BUYING_POINT_HEADING = '## このレースで確認したい判断材料';
const COURSE_VENUE_POINT_HEADING = '## この競馬場で確認したい判断材料';
const JOCKEY_POINT_HEADING = '## この騎手を確認するポイント';
const BEGINNER_POINT_HEADING = '## このテーマで確認したい判断材料';
const REQUIRED_TODAY_RACE_CTA = '最新の出馬表とAI予想は [今日のAI予想・出馬表](/races/today) で無料公開中。';
const POINT_HEADING_TEXTS = [
  'このコースで確認したい判断材料',
  'このレースで確認したい判断材料',
  'この競馬場で確認したい判断材料',
  'このテーマで確認したい判断材料',
  'このコースの買い目ポイント',
  'このレースの買い目ポイント',
  'この競馬場の確認ポイント',
  'この騎手を確認するポイント',
  'このテーマの確認ポイント',
];
const POINT_HEADING_PATTERN_SOURCE = POINT_HEADING_TEXTS
  .map(text => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  .join('|');

function pointHeadingLineRegex(flags = 'gm'): RegExp {
  return new RegExp(`^##\\s+(?:${POINT_HEADING_PATTERN_SOURCE})\\s*$`, flags);
}

function pointHeadingNormalizeRegex(): RegExp {
  return new RegExp(`^(?:#{1,6}\\s*){0,2}(?:${POINT_HEADING_PATTERN_SOURCE})\\s*$`, 'gm');
}

const BANNED_REPLACEMENTS: Record<string, string> = {
  'いかがでしたか': '',
  'ぜひ参考にしてください': '判断材料として確認してください',
  '最後まで読んでいただき': '',
  '必勝': '判断',
  '投資': '馬券検討',
  '資金配分': '買い目の組み立て',
  '期待値': '妙味',
  '絶対に当たる': '可能性を確認する',
  '絶対': '条件が合えば',
  '完全攻略': '要点整理',
  '最強': '有力',
  '買うな': '評価を下げる',
  '圧倒': '大きく',
  '圧倒的': '高い',
  '絶対的': 'はっきりした',
  '絶対条件': '重要な条件',
  '狙い撃つ': '狙いを絞る',
  '消去対象': '評価を下げる候補',
  '完全に除外': '評価を下げる',
  '儲かる': '妙味がある',
  '儲か': '妙味があ',
  '稼げ': '配当妙味を見込め',
  '爆益': '配当妙味',
  '買えば': '買うなら',
  '勝てる': '上位を狙える',
  '封殺': '抑える',
  '叩き出': '記録',
  '爆発力': '末脚',
  '断言': '整理',
  '論証': '説明',
  '解明': '整理',
  '無条件': '条件を見ずに',
  '✅': '',
  '❌': '',
  'と思っていませんか': '',
  'この記事をお読みいただければ': '扱う内容は',
  'オカルトや個人の感覚ではなく': 'データを手掛かりに',
  '曖昧な勘に頼るのではなく': '数字を確認しながら',
  '結論から言うと': '',
  '興味深いことに': '',
  'と言えるでしょう': 'と見られます',
  '独自の分析スクリプトで解析': 'データを整理',
  '膨大なレースデータを徹底的に解析': 'レースデータを整理',
  'https://uma-free.jp': 'https://uma-free.com',
  '絶望的な低さ': '大幅に低い水準',
  '絶望的数値': '大幅に低い数値',
  '絶望的': '著しく低い',
  '壊滅的': '大幅な不振',
  '回収率を高める': '判断材料を整理する',
  '回収率向上': '判断材料の整理',
  '妙味の高い穴馬': '人気と評価にズレがある馬',
  '軸の筆頭': '有力な候補',
  '信頼度の高い軸候補': '候補として確認したい馬',
  '信頼度の高い軸': '候補として確認したい馬',
  '精度の高い予想': '根拠を確認しやすい予想',
  'より精度の高い馬券検討': '判断材料を整理しやすい馬券検討',
  '精度の高い馬券検討': '判断材料を整理しやすい馬券検討',
  '消し': '評価を下げる',
  '絶好枠': '条件が合う枠',
  '買い目の構築が可能': '買い目を整理しやすくなる',
  'AI偏差値70以上': 'AI偏差値の上位候補',
  '偏差値70以上': '偏差値の上位候補',
  '再現が期待': '同様の走りを確認したい',
  '期待できる': '材料になる',
  // 新たに発見された問題パターン
  'データという確かな根拠': 'データを手掛かりに',
  'データという羅針盤': 'データを参考に',
  'データという武器': 'データを参考に',
  '馬券購入': '馬券検討',        // 購入推奨のニュアンスを避ける
  '購入機会': '検討の材料',
  '買い続ける': '継続的に狙う',
  '厚く張る': '評価を上げる',
  '資金を投下': '買い目に含める',
  '資金を集中': '買い目を絞る',
  '勝負する': '評価する',
  '勝負気配': '状態の良さ',
  'ニュース後': '更新後',
  'ニュース起点': '開催条件を起点とした',
  'ニュースで': '更新情報で',
  '枠順発表前前': '枠順発表前',
  ' of ': 'の',
  'としての完全な': 'としての',
  'プラスである': 'が評価できる',
  'マイナスである': 'がリスクになる',
  '非常に': 'かなり',           // 「非常に」→「かなり」→制限数で管理
  '極めて': 'かなり',
  '著しく高い': '高い水準の',
  // 文末の定型化を防ぐ
  'と言えるでしょう。': 'と見られる。',
  'と考えられます。': 'が考えられる。',
  'となっています。': 'となっている。',
  'ことが重要です。': 'ことが重要だ。',
  'されることが多い。': 'されやすい。',
};

function applyReplacement(content: string, original: string, fixed: string): { success: boolean, result: string } {
  // \r\n と \n の差異を完全に吸収するため、全体を \n に統一してから完全一致置換を行う
  const normalizeContent = (s: string) => s.replace(/\r\n/g, '\n');
  const normalizeOriginal = (s: string) => s.replace(/\r\n/g, '\n').trim();
  const normalizedContent = normalizeContent(content);
  const normalizedOriginal = normalizeOriginal(original);
  
  if (!normalizedContent.includes(normalizedOriginal)) {
    console.warn(`[Editor Warning] 置換対象が見つかりません:\n"${original.substring(0, 50)}..."`);
    return { success: false, result: content };
  }

  // 正規化済みの文字列に対して、完全一致による置換を実行する（正規表現のサイレント失敗を防ぐ）
  const resultContent = normalizedContent.replace(normalizedOriginal, fixed);
  return { success: true, result: resultContent };
}

function replaceLiteral(input: string, search: string, replacement: string): string {
  if (!search) return input;
  return input.split(search).join(replacement);
}

function applyContextualToneReplacements(input: string): string {
  return input
    .replace(/無条件で/g, '条件を確認せずに')
    .replace(/無条件に/g, '条件を確認せずに')
    .replace(/圧倒的な/g, '高い')
    .replace(/圧倒的に/g, '大きく')
    .replace(/圧倒的です/g, '高いです')
    .replace(/圧倒的で/g, '高く')
    .replace(/圧倒的だ/g, '高い')
    .replace(/圧倒している/g, '上回っている')
    .replace(/圧倒して/g, '上回って')
    .replace(/圧倒する/g, '上回る')
    .replace(/圧倒した/g, '上回った')
    .replace(/圧倒な/g, '大きな');
}

function repairAwkwardReplacementArtifacts(input: string): string {
  return input
    .replace(/大きくない/g, '大きいとは言えない')
    .replace(/大きくなく/g, '大きいとは言えず')
    .replace(/大きくなって/g, '広がって')
    .replace(/大きくなった/g, '広がった')
    .replace(/大きくなり/g, '広がり')
    .replace(/大きくなる/g, '広がる')
    .replace(/大きくなれば/g, '広がれば')
    .replace(/大きくな/g, '大きな')
    .replace(/大きくであり/g, '大きく、')
    .replace(/大きなな/g, '大きな')
    .replace(/目立つな/g, '目立つ')
    .replace(/有力なの/g, '有力な')
    .replace(/するする/g, 'する')
    .replace(/だだ/g, 'だ')
    .replace(/できるだけ抑えたし/g, 'できるだけ抑えたい')
    .replace(/大きく上回るして/g, '上回って')
    .replace(/([^\n。]{1,40}?20\d{2})AI予想無料を買う前は/g, '$1のAI予想を見る前は')
    .replace(/([^\n。]{1,40}?20\d{2})AI予想無料を見る前は/g, '$1のAI予想を見る前は')
    .replace(/([^\n。]{1,40}?20\d{2})のAI予想無料/g, '$1のAI予想')
    .replace(/([^\n。]{2,50}?)(騎手データ|枠順データ|コースデータ|AI予想データ|データ)を買う前は/g, (_match, prefix, subject) => {
      const connector = String(prefix).endsWith('の') ? '' : 'の';
      return `${prefix}${connector}${subject}を見る前は`;
    })
    .replace(/表の勝率だけでなく、騎乗回数や回収率、当日の馬場を分けて見る必要がある/g, '表の勝率だけでなく、騎乗回数や回収率、当日の馬場を分けて確認したい')
    .replace(/勝率、回収率、枠順や騎手の傾向を照らし。/g, '')
    .replace(/高いな数字/g, '高い数字')
    .replace(/大きく優位性/g, '大きな優位性')
    .replace(/国内専制状態/g, '国内勢が優勢な状態')
    .replace(/客観指標/g, 'データ')
    .replace(/購入点数の配分/g, '買い目の組み立て')
    .replace(/決定的な/g, 'はっきりした')
    .replace(/お勧めします/g, '確認したいところです')
    .replace(/確認することを確認したいところです/g, '確認します')
    .replace(/高い勝率を誇ります/g, '高い勝率です')
    .replace(/勝率を誇ります/g, '勝率です')
    .replace(/可能性が示唆されます/g, '可能性があります')
    .replace(/示唆しています/g, '示しています')
    .replace(/と言えます/g, 'です')
    .replace(/考慮すると良いでしょう/g, '確認します')
    .replace(/良いでしょう/g, 'よいです')
    .replace(/分析しました/g, '整理します')
    .replace(/評価組み立てを組み立てする/g, '評価の組み立てを整理する')
    .replace(/評価組み立て/g, '評価の組み立て')
    .replace(/馬券組み立ての組み立て方/g, '馬券の組み立て方')
    .replace(/馬券組み立て/g, '買い目の組み立て')
    .replace(/買い目組み立て/g, '買い目の組み立て')
    .replace(/買い目を組み立てする/g, '買い目を組み立てる')
    .replace(/買い目の組み立てが立てられる/g, '買い目を組み立てやすくなる')
    .replace(/距離ロスが大きくなりやすい/g, '距離ロスが増えやすい')
    .replace(/考慮すべきと見ます/g, '考慮したいところです')
    .replace(/留めるのが賢明と見ます/g, '相手候補までに留めたいところです')
    .replace(/割引が必要と見ます/g, '割り引いて見ます')
    .replace(/狙う必要はないと見ます/g, '狙う必要はありません')
    .replace(/難しいなコース/g, '難しいコース')
    .replace(/難しいな展開/g, '難しい展開')
    .replace(/大きくに有利/g, '大きく有利')
    .replace(/過信を禁物とする/g, '過信は禁物だ')
    .replace(/かなり合致している/g, 'よく合致している')
    .replace(/突出だ。/g, '突出している。')
    .replace(/かなり低い水準/g, '大幅に低い水準')
    .replace(/絶望的な低さ/g, '大幅に低い水準')
    .replace(/絶望的数値/g, '大幅に低い数値')
    .replace(/買い目を組み立てする/g, '買い目を組み立てる')
    .replace(/馬券検討を組み立てする/g, '馬券を検討する')
    .replace(/確認したいことを確認したい/g, '確認したい')
    .replace(/整理します整理します/g, '整理します')
    .replace(/として扱うとして扱う/g, 'として扱う')
    .replace(/このコースの特徴的なな/g, 'このコースの特徴的な')
    .replace(/([^。\n]{50,}?)を整理します。整理します。/g, '$1を整理します。')
    .replace(/判断する。判断する。/g, '判断する。')
    .replace(/確認する。確認する。/g, '確認する。');
}

function sanitizeGeneratedText(input: string): string {
  let text = applyContextualToneReplacements(input);
  text = text
    .replace(/ニュース後/g, BANNED_REPLACEMENTS['ニュース後'])
    .replace(/ニュース起点/g, BANNED_REPLACEMENTS['ニュース起点'])
    .replace(/ニュースで/g, BANNED_REPLACEMENTS['ニュースで']);
  for (const banned of SEO_RULES.hard_banned_strings) {
    if (banned === '買うな') {
      text = text.replace(/買うな(?!ら)/g, BANNED_REPLACEMENTS[banned] ?? '');
      continue;
    }
    text = replaceLiteral(text, banned, BANNED_REPLACEMENTS[banned] ?? '');
  }

  // 装飾記号の機械的除去
  text = text.replace(/[☆★◆◇▲▼△▽▶◀■□●○※]/g, '');
  // 過剰な【】の整理（重複の圧縮および空ブラケットの除去）
  text = text.replace(/【+/g, '【').replace(/】+/g, '】').replace(/【\s*】/g, '');

  return repairAwkwardReplacementArtifacts(text)
    .replace(/[ \t]+$/gm, '')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function isDrawConfirmedData(data: Record<string, any>): boolean {
  const drawStatus = String(data.draw_status || '').toLowerCase();
  if (drawStatus) return drawStatus === 'confirmed';
  if (data.draw_confirmed === true) return true;
  return String(data.search_angle_label || '') === '枠順発表後';
}

function isDrawRelatedDraft(data: Record<string, any>, content: string): boolean {
  const text = [
    data.title,
    data.description,
    data.target_keyword,
    data.theme_cluster,
    data.article_type,
    data.update_stage,
    data.search_intent,
    data.search_intent_label,
    data.search_angle_label,
    content.slice(0, 800),
  ].map(value => String(value || '')).join(' ');

  return /枠順|馬番|出馬表|waku|draw_confirmed/i.test(text);
}

function normalizeUnconfirmedDrawPhrasing(input: string): string {
  return input
    .replace(/枠順が確定した今/g, '枠順発表前の段階では')
    .replace(/枠順が決まった今/g, '枠順発表前の段階では')
    .replace(/枠順が発表された今/g, '枠順発表前の段階では')
    .replace(/枠順が発表されたことで/g, '枠順が発表された後は')
    .replace(/枠順が決まったことで/g, '枠順が発表された後は')
    .replace(/枠順が確定した後/g, '枠順が発表された後')
    .replace(/枠順が確定した際/g, '枠順が発表された際')
    .replace(/枠順が確定した/g, '枠順が発表された')
    .replace(/枠順を発表/g, '枠順が発表された後に確認')
    .replace(/出馬表が発表された/g, '出馬表が公開された後')
    .replace(/枠順確定後/g, '枠順発表後')
    .replace(/枠順確定/g, '枠順発表前')
    .replace(/枠順という新たな情報を踏まえ/g, '枠順発表後の新たな情報を踏まえ');
}

const PHYSICAL_SPECS = new Set<number>([
  473.6, 356.5, 352.7, 403.7, 328.4, 329.1, 525.9, 501.6, 310.0, 308.0,
  658.7, 358.7, 353.9, 293.0, 291.3, 292.0, 295.7, 412.5, 410.7, 266.1,
  264.3, 262.1, 260.3,
  1.8, 1.9, 1.6, 2.7, 3.0, 2.1, 2.4, 5.3, 4.4, 0.0, 0.6, 3.5, 0.7, 0.9, 3.4
]);

function isCriticalReplacement(original: string, fixed: string): boolean {
  // 数値が含まれるか？
  const origNums = (original.match(/\d+(?:\.\d+)?/g) || []).map(Number);
  const fixNums = (fixed.match(/\d+(?:\.\d+)?/g) || []).map(Number);
  
  // 数値のリストが異なる（数値が変わっている、増えている、減っているなど）場合はCritical
  if (JSON.stringify(origNums) !== JSON.stringify(fixNums)) {
    return true;
  }
  
  // 日付関連キーワード、最新、などの変更がある場合はCritical
  const dateKeywords = /[年月日]|最新|予想|印|偏差値/i;
  if (dateKeywords.test(original) || dateKeywords.test(fixed)) {
    return true;
  }
  
  // それ以外はCosmetic（例：「非常に高い」→「かなり高い」のような文字表現のみの置換失敗など）
  return false;
}

function extractNumbersFromEvidence(data: any): Set<number> {
  const numbers = new Set<number>();
  const str = JSON.stringify(data);
  const matches = str.match(/\d+(?:\.\d+)?/g);
  if (matches) {
    for (const m of matches) {
      const num = Number(m);
      if (!Number.isNaN(num)) {
        numbers.add(num);
      }
    }
  }
  return numbers;
}

export function checkFixedValueHallucination(fixed: string, evidenceNumbers: Set<number>): { hasHallucination: boolean, details?: string } {
  // パターン 1: 騎手名等.*?(\d+\.?\d*)[%％] (勝率・回収率)
  const pattern1 = /(?:勝率|回収率|複勝率|好走率)[^%％0-9]*?(\d+(?:\.\d+)?)\s*[%％]/g;
  // パターン 1b: 35.3%の複勝率 のように数値が先に出る表現
  const pattern1b = /(\d+(?:\.\d+)?)\s*[%％][^。！？\n]{0,16}?(?:勝率|回収率|複勝率|好走率)/g;
  // パターン 2: 直線.*?(\d+\.?\d*)m または 高低差.*?(\d+\.?\d*)m
  const pattern2 = /(?:直線|高低差).*?(\d+(?:\.\d+)?)\s*m/g;
  // パターン 3: (\d+)回.*?(勝率|回収|複勝|騎乗)
  const pattern3 = /(\d+)\s*回[^回]*?(?:勝率|回収率|複勝率|騎乗)/g;

  let match;
  
  // パターン1のチェック
  pattern1.lastIndex = 0;
  while ((match = pattern1.exec(fixed)) !== null) {
    const val = Number(match[1]);
    if (!evidenceNumbers.has(val)) {
      return { hasHallucination: true, details: `勝率・回収率系の数値 ${val}% がEvidence Packに存在しません。` };
    }
  }

  pattern1b.lastIndex = 0;
  while ((match = pattern1b.exec(fixed)) !== null) {
    const val = Number(match[1]);
    if (!evidenceNumbers.has(val)) {
      return { hasHallucination: true, details: `勝率・回収率系の数値 ${val}% がEvidence Packに存在しません。` };
    }
  }

  // パターン2のチェック (物理スペック、例外あり)
  pattern2.lastIndex = 0;
  while ((match = pattern2.exec(fixed)) !== null) {
    const val = Number(match[1]);
    if (!evidenceNumbers.has(val) && !PHYSICAL_SPECS.has(val)) {
      return { hasHallucination: true, details: `コース物理諸元の数値 ${val}m がEvidence Packおよび正規コーススペックに存在しません。` };
    }
  }

  // パターン3のチェック (実績回数)
  pattern3.lastIndex = 0;
  while ((match = pattern3.exec(fixed)) !== null) {
    const val = Number(match[1]);
    if (!evidenceNumbers.has(val)) {
      return { hasHallucination: true, details: `実績・騎乗回数の数値 ${val}回 がEvidence Packに存在しません。` };
    }
  }

  return { hasHallucination: false };
}

/**
 * Editorモデルの構造化レビューが全観点を承認したかだけを判定する。
 * これは事実の決定的な検証ではなく、Evidence Packの数値検証やSEO機械検査を代替しない。
 */
export function hasApprovedContentQuality(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false;
  const quality = value as Record<string, unknown>;
  return quality.answers_search_intent === true
    && quality.has_verifiable_specific_value === true
    && quality.states_applicable_conditions === true
    && quality.states_as_of_or_update_status === true;
}

function isUnsafeLongFormReplacement(original: string, fixed: string): boolean {
  const normalizedOriginal = original.replace(/\r\n/g, '\n').trim();
  const normalizedFixed = fixed.replace(/\r\n/g, '\n').trim();
  const originalLines = normalizedOriginal.split('\n').filter(line => line.trim()).length;
  const fixedLines = normalizedFixed.split('\n').filter(line => line.trim()).length;
  const originalPlainLength = normalizedOriginal.replace(/\s/g, '').length;
  const fixedPlainLength = normalizedFixed.replace(/\s/g, '').length;
  const replacesHeadingOnly = originalLines === 1 && /^#{2,6}\s+/.test(normalizedOriginal);

  return replacesHeadingOnly && (fixedLines >= 4 || fixedPlainLength > originalPlainLength + 240);
}

function normalizeHref(href: string): string | null {
  const cleanHref = href.replace(/^<|>$/g, '');
  if (!/^https?:\/\//.test(cleanHref)) return cleanHref;

  try {
    const url = new URL(cleanHref);
    if (url.hostname === 'uma-free.com' || url.hostname === 'www.uma-free.com') {
      return `${url.pathname}${url.search}${url.hash}`;
    }
    return null;
  } catch {
    return cleanHref;
  }
}

function isAllowedGeneratedArticleHref(href: string): boolean {
  const normalized = normalizeHref(href);
  if (!normalized) return false;
  if (!normalized.startsWith('/')) return false;
  return (
    normalized === '/races/today' ||
    /^\/races\/\d{4}-\d{2}-\d{2}$/.test(normalized) ||
    /^\/races\/\d{4}-\d{2}-\d{2}\/[a-z0-9%.-]+\/\d{1,2}$/.test(normalized)
  );
}

function unwrapDisallowedLinks(content: string): string {
  return content.replace(/(!?)\[([^\]]*)]\(([^)\s]+)(?:\s+"[^"]*")?\)/g, (match, bang, label, href) => {
    const normalized = normalizeHref(href);
    if (normalized && isAllowedGeneratedArticleHref(normalized)) {
      return `${bang}[${label}](${normalized})`;
    }
    return bang ? label : label;
  });
}

function compactForTitle(value: unknown): string {
  return String(value || '')
    .replace(/[【】]/g, '')
    .replace(/\s+/g, '')
    .replace(/[|｜]+$/g, '')
    .trim();
}

function stableIndex(seed: string, size: number): number {
  if (size <= 1) return 0;
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return hash % size;
}

function fitTitleToSeo(title: string, data: Record<string, any>, _content: string): string {
  const compactTitle = String(title || '').replace(/\s+/g, ' ').trim();
  if (compactTitle.length >= SEO_RULES.title_min_chars) {
    return compactTitle.slice(0, SEO_RULES.title_max_chars);
  }

  const keyword = compactForTitle(data.target_keyword || data.title);
  const suffix = keyword && !compactTitle.includes(keyword) ? `｜${keyword}` : '｜確認条件';
  return `${compactTitle}${suffix}`.slice(0, SEO_RULES.title_max_chars);
}

function fitDescriptionToSeo(description: string, data: Record<string, any>): string {
  const normalized = String(description || '').replace(/\s+/g, ' ').trim();
  if (normalized.length >= SEO_RULES.description_min_chars) {
    return normalized.slice(0, SEO_RULES.description_max_chars);
  }

  const keyword = compactForTitle(data.target_keyword || data.title || 'この記事の条件');
  const supplement = `。${keyword}について、確認済みの条件と確認時点を分け、未発表の情報を補わずに確認する順番を整理します。`;
  return `${normalized}${supplement}`.slice(0, SEO_RULES.description_max_chars);
}

function cleanPromptEchoes(content: string): { content: string; cleaned: boolean } {
  let cleaned = false;
  const lines = content.split('\n');
  const filteredLines = lines.filter(line => {
    const trimmed = line.trim();
    
    // プロンプト特有のキーワードやメタ指示文の検出
    const isEcho = 
      trimmed.includes('3,000字以上') ||
      trimmed.includes('4,200字目安') ||
      trimmed.includes('競馬データメディア「UMA-FREE」の編集ライター') ||
      trimmed.includes('検索ユーザーに「何を重く見るべきか」を提示') ||
      (trimmed.includes('race_update') && trimmed.includes('（')) ||
      (trimmed.includes('news_context') && trimmed.includes('（')) ||
      (trimmed.includes('grade_race_preview') && trimmed.includes('（')) ||
      (trimmed.startsWith('* ') && (
        trimmed.includes('AI予想・偏差値などの内部データ') ||
        trimmed.includes('predictions:') ||
        trimmed.includes('JRAが調教後馬体重を発表') ||
        trimmed.includes('構成案：') ||
        trimmed.includes('導入：') ||
        trimmed.includes('タイトル：') ||
        trimmed.includes('ディスクリプション：') ||
        trimmed.includes('文末の多様化') ||
        trimmed.includes('「かなり」の使用制限') ||
        trimmed.includes('見出しの多様化') ||
        trimmed.includes('Markdownテーブルの使用') ||
        trimmed.includes('禁止表現')
      ));
      
    if (isEcho) {
      cleaned = true;
      return false;
    }
    return true;
  });
  
  return {
    content: filteredLines.join('\n'),
    cleaned
  };
}

export function autoRepairDraftMarkdown(markdownText: string): { content: string; changes: string[] } {
  const changes: string[] = [];
  
  // 複数フロントマターや指示メタデータの混入を事前クリーンアップ
  let targetText = markdownText.replace(/\r\n/g, '\n');
  const fmBlocks = targetText.split('---');
  if (fmBlocks.length > 3) {
    let targetFmIndex = -1;
    for (let i = fmBlocks.length - 2; i >= 0; i--) {
      const block = fmBlocks[i];
      if (block.includes('title:') && block.includes('description:')) {
        targetFmIndex = i;
        break;
      }
    }
    if (targetFmIndex !== -1) {
      const actualFm = fmBlocks[targetFmIndex].trim();
      const actualBody = fmBlocks.slice(targetFmIndex + 1).join('---').trim();
      targetText = `---\n${actualFm}\n---\n\n${actualBody}`;
      changes.push('重複したフロントマターや指示メタデータの混入をクリーンアップ');
    }
  }

  let parsed;
  try {
    parsed = matter(targetText);
  } catch {
    return { content: markdownText, changes: ['Frontmatterのパースに失敗したため自動補正をスキップ'] };
  }

  const data = { ...parsed.data };
  let content = parsed.content.replace(/\r\n/g, '\n').trim();
  
  // プロンプトオウム返しの除去
  const echoClean = cleanPromptEchoes(content);
  if (echoClean.cleaned) {
    content = echoClean.content.trim();
    changes.push('本文からプロンプトオウム返しのゴミテキストを除去');
  }

  const beforeTitle = String(data.title || '');
  const beforeDescription = String(data.description || '');
  const beforeContent = content;

  if (isDrawRelatedDraft(data, content) && !isDrawConfirmedData(data)) {
    data.draw_status = 'pre_draw';
    if (['draw_confirmed', 'final_48h', 'race_morning'].includes(String(data.update_stage || ''))) {
      data.update_stage = 'race_week';
    }
    for (const key of ['title', 'description', 'target_keyword', 'og_title', 'og_description']) {
      if (typeof data[key] === 'string') {
        data[key] = normalizeUnconfirmedDrawPhrasing(data[key]);
      }
    }
    if (Array.isArray(data.keywords)) {
      data.keywords = data.keywords.map((keyword: unknown) =>
        typeof keyword === 'string' ? normalizeUnconfirmedDrawPhrasing(keyword) : keyword
      );
    }
    content = normalizeUnconfirmedDrawPhrasing(content);
    changes.push('未確定の枠順表現を発表前の表現へ補正');
  }

  data.title = fitTitleToSeo(String(data.title || beforeTitle), data, content);
  data.description = fitDescriptionToSeo(String(data.description || beforeDescription), { ...data, title: data.title });
  data.title = sanitizeGeneratedText(data.title);
  data.description = sanitizeGeneratedText(data.description);

  content = sanitizeGeneratedText(content);
  content = unwrapDisallowedLinks(content);
  content = sanitizeGeneratedText(content);

  if (data.title !== beforeTitle) changes.push('titleをSEO文字数内に補正');
  if (data.description !== beforeDescription) changes.push('descriptionをSEO文字数内に補正');
  if (content !== beforeContent) changes.push('本文のNG語とリンクを補正');

  return {
    content: matter.stringify(`${content.trim()}\n`, data),
    changes,
  };
}

const EDITOR_SYSTEM_PROMPT = `あなたはUMA-FREEの編集長だ。ライターが生成したMarkdown記事を編集確認し、以下の手順で指定されたJSONフォーマットのみを出力する。

【編集確認の手順】
STEP 1：禁止ワードスキャン
記事全文から、導入テンプレート、AI手癖表現、誇張表現などの禁止ワードを抽出し、修正文言を作成する。
STEP 2：構造チェック
・冒頭で検索意図への答え、適用条件、確認時点を読者が把握できるか
・見出し、表、箇条書き、内部リンクは、検索意図と確認済み事実に役立つ場合だけ使われているか。一律の形式を要求しない
・一般論を増やして記事の固有性を薄めていないか
・frontmatter の search_intent と content_focus が記事の中心になっているか
・search_intent が "waku" でないのに枠順が複数H2へ広がっていないか、"training" でないのに追い切りが主題化されていないか
・race_phase が "post_race" の記事に、枠順発表や最終追い切りなどレース前の確認手順が混入していないか
・導線がある場合は対象ページと自然に対応しているか。entity_type が "grade_race" の記事には /races/today のCTAを入れない
・チェックマークやバツ印などの装飾記号、煽りの強い「最強」「圧倒的」「狙い撃つ」「買うな」「消去対象」が残っていないか
・重賞記事は、人気馬を煽るだけでなく「評価を上げる材料」「慎重に見る条件」「見送りを検討する条件」が分かれているか
・平場向け記事は、短時間で複数レースを見る読者が使える初期判断になっているか
・Gemma複数観点レビューが付いている場合は、検索意図、本文の厚み、トーン・事実性の指摘を優先順に反映すること
・文字数では承認しない。検索意図へ答え、確認可能な固有価値を示し、適用条件と確認時点を読者が確認できるかを個別に判定すること
・勝率、回収率、枠順別成績、斤量別成績などの新しい数値を作らないこと
STEP 3：フォーマットとSEOのチェック
・タイトルの文字数（30〜50文字）と構成
・ディスクリプションの文字数（120〜160文字）
※過去の集計年（2024年など）と「最新」という単語を近接させて混同した表記（例：【2024年最新】、【2025年最新】など）は機械チェックで即却下されるため【絶対に禁止】する。タイトル、ディスクリプション、本文冒頭でこのような混同表現を見つけた場合は必ず削除・修正すること。
※代わりに、集計期間であることを明示した代替許容表現（例：【2024年データ分析】、【2024年集計】、2024年実績、など）に書き換えること。
※もし「事前の機械チェック結果」でエラーが指摘されている場合は、必ずそれを満たすようにtitleとdescriptionを修正すること。
※関連記事プレースホルダーは要求しない。本文中に「関連記事」セクションや「[関連記事：...]」は追加しないこと。
※存在確認できないURL、仮URL、単独行の「(/course-xxx)」のような壊れたリンク片は必ず削除すること。
※本文を長くしすぎない。必要な修正だけ行い、表・数値・母数・期間は壊さないこと。ただし事前の機械チェックで未確認数値と判定された値は例外で、数値を削除して入力済み事実だけの表現へ直すこと。
※本文量を理由に一般論や定型の確認順を追加してはならない。検索意図への回答、確認可能な固有価値、適用条件、確認時点のいずれかが欠ける場合は、入力にある事実だけで局所的に直すか、REJECTEDにすること。
※content_replacements の fixed フィールドに、Evidence Packで確認できない勝率・複勝率・回収率・好走率などのパーセンテージ（%）を残してはいけない。元の本文に未確認の%値がある場合は、その数値を引き継がず「データで確認する」「傾向を確認する」など数値なしの自然な文に置き換えること。
※content_replacements は局所的な文言修正に限定する。見出し1行を複数段落の本文に置き換える、または新しいH2セクションをfixedへ丸ごと追加する行為は禁止。
※frontmatter の draw_status が "confirmed" でない枠順記事では、「枠順確定」「枠順が確定した今」「枠順が発表されたことで」など発表済みと読める表現を使わない。「枠順発表前」「枠順発表後に確認する材料」に直すこと。

【JSON出力フォーマット】
以下のJSONスキーマに従って出力する。Markdownのコードブロックなどは含めず、純粋なJSON文字列のみを出力すること。
{
  "status": "APPROVED" | "REJECTED",
  "log": "編集確認の所感やエラー理由の一言メモ",
  "content_quality": {
    "answers_search_intent": true,
    "has_verifiable_specific_value": true,
    "states_applicable_conditions": true,
    "states_as_of_or_update_status": true
  },
  "fixed_frontmatter": {
    "title": "新しいタイトル",
    "description": "新しいディスクリプション"
  },
  "content_replacements": [
    {
      "original": "削除・置換対象の元の文字列（数十字程度）",
      "fixed": "修正後の文字列"
    }
  ]
}
※content_qualityの4項目は必須である。1つでもfalseならstatusはREJECTEDにし、logに不足点を具体的に書く。修正不要な要素（fixed_frontmatter や content_replacements）は空または省略してよい。

【極秘指示】
元の原稿に含まれているデータテーブル（| で構築された表）およびリスト要素に対する修正は確実な理由がない限り行わないこと。表自体を削除・破壊してはならない。`;

export type ReviewDraftOptions = {
  machineIssues?: string[];
  outputMode?: 'approved' | 'staged';
};

function appendDraftHistory(filePath: string, content: string): void {
  try {
    const historyPath = path.join(__dirname, '..', '..', '..', 'data', 'posted_history.json');
    fs.mkdirSync(path.dirname(historyPath), { recursive: true });
    const history = fs.existsSync(historyPath) ? JSON.parse(fs.readFileSync(historyPath, 'utf-8')) : [];
    const parsed = matter(content);
    history.push({
      id: path.basename(filePath, '.md'),
      title: parsed.data.title || '',
      target_keyword: parsed.data.target_keyword || '',
      theme_cluster: parsed.data.theme_cluster || '',
      keywords: parsed.data.keywords || [],
      posted_at: new Date().toISOString(),
      draft: true,
      estimated_monthly_searches: null,
      actual_pv_30d: null,
      ad_revenue_30d: null,
      rewrite_score: null,
    });
    fs.writeFileSync(historyPath, JSON.stringify(history, null, 2), 'utf-8');
    console.log(`[Editor] History updated: ${historyPath}`);
  } catch (err: any) {
    console.error(`[Editor] Failed to update history: ${err.message}`);
  }
}

export function promoteReviewedDraft(filePath: string): string {
  const content = fs.readFileSync(filePath, 'utf-8');
  const approvedDir = path.join(__dirname, '..', '..', 'agents', 'queue', 'approved');
  fs.mkdirSync(approvedDir, { recursive: true });
  const approvedPath = path.join(approvedDir, path.basename(filePath));
  fs.writeFileSync(approvedPath, content, 'utf-8');
  if (path.resolve(filePath) !== path.resolve(approvedPath) && fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
  appendDraftHistory(approvedPath, content);
  console.log(`[Editor] Draft APPROVED after final flow. Saved to: ${approvedPath}`);
  return approvedPath;
}

export function quarantineReviewedDraft(filePath: string, reason: string): string {
  const rejectedDir = path.join(__dirname, '..', '..', '..', 'data', 'rejected_articles');
  fs.mkdirSync(rejectedDir, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const rejectedPath = path.join(rejectedDir, `${path.basename(filePath, '.md')}_${timestamp}.md`);
  const content = fs.readFileSync(filePath, 'utf-8');
  fs.writeFileSync(rejectedPath, content, 'utf-8');
  fs.unlinkSync(filePath);
  console.error(`[Editor] Final article flow rejected staged draft: ${reason.slice(0, 240)}`);
  return rejectedPath;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function geminiRetryAttemptsForModel(modelName: string): number {
  if (/gemma/i.test(modelName)) return 1;
  // 503エラー時等の高速フォールバックのため、リトライは最大1回（計2回）に制限
  return 2;
}

function geminiRetryDelayMs(requestAttempt: number): number {
  const baseMs = parsePositiveInt(process.env.ARTICLE_LLM_RETRY_BASE_MS, 12000);
  return Math.min(45000, baseMs * requestAttempt);
}

function geminiUsageLine(prefix: string, response: any): string {
  const usage = response?.usageMetadata;
  if (!usage) return `${prefix} token usage: usageMetadata unavailable`;

  const promptTokens = usage.promptTokenCount ?? 'unknown';
  const outputTokens = usage.candidatesTokenCount ?? 'unknown';
  const totalTokens = usage.totalTokenCount ?? 'unknown';
  return `${prefix} token usage: input=${promptTokens} output=${outputTokens} total=${totalTokens}`;
}

type GemmaReviewPass = {
  id: string;
  label: string;
  instruction: string;
};

type GemmaReviewResult = {
  promptBrief: string;
  log: string;
};

const GEMMA_REVIEW_SYSTEM_PROMPT = `あなたはUMA-FREEの副編集者だ。
与えられたMarkdown記事を、指定された観点だけで添削する。

【厳守】
- 本文全文の書き直しはしない。
- 記事のタイトル（title）および主要見出し（H2）自体の表現変更の提案（rewrite_notes等への記載）は全面禁止する。タイトルと見出しは現状を維持すること。
- 過去の集計年（2024年など）と「最新」という単語を近接させて混同した表記（例：【2024年最新】など）の提案は【絶対に禁止】する。代わりに、【2024年データ分析】、【2024年集計】、2024年実績などの、集計期間・実績データを明示した代替表現を提案すること。
- 入力にない数値、馬名、成績、外部事実を作らない。
- 表の列や行を増やす提案は、入力データに同じ値がある場合だけに限る。
- 煽り、購入を急かす表現、過度な断定を避ける。
- 置換や言い換えを提案する際は、記事中のどの部分（修正前）をどう書き換えるか（修正後）の具体的なテキスト対（original と fixed）を提示すること。
- 出力はJSONのみ。

【JSON形式】
{
  "status": "APPROVED" | "NEEDS_WORK",
  "priority_actions": ["最優先で直すことを1〜5件"],
  "safe_expansion_sections": [
    {
      "heading": "追加または強化したい見出し",
      "reason": "検索意図や読者行動に対する必要性",
      "must_not_add": "作ってはいけない数値・事実"
    }
  ],
  "rewrite_notes": [
    {
      "original": "修正したい箇所の元の文章（完全一致で検索可能な部分）",
      "fixed": "修正後の具体的な文章（トーンマナーやSEOルールに準拠したもの）"
    }
  ],
  "seo_terms_to_naturally_include": ["自然に入れる検索語を0〜8件"],
  "risk_notes": ["事実性・広告審査・読者信頼のリスクを0〜5件"]
}`;

const GEMMA_REVIEW_PASSES: GemmaReviewPass[] = [
  {
    id: 'search-intent',
    label: '検索意図レビュー',
    instruction: 'frontmatterのsearch_intent、race_phase、content_focusを基準に、title/description/H2/冒頭が開催段階と検索意図に合うかを確認する。枠順・追い切りは主題の場合だけ提案する。',
  },
  {
    id: 'depth',
    label: '本文深掘りレビュー',
    instruction: '本文量ではなく、入力データだけで検索意図に答えられるかを確認し、必要な場合だけ確認順、慎重に見る条件、相手候補に残す前の線引きを提案する。',
  },
  {
    id: 'tone-fact',
    label: 'トーン・事実性レビュー',
    instruction: '禁止語、過剰表現、数値の捏造リスク、外部情報の扱い、PR/広告審査上の違和感を確認する。',
  },
];

function parsePositiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value || '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function isGemmaReviewEnabled(): boolean {
  return (process.env.ARTICLE_GEMMA_REVIEW_ENABLED || 'true').toLowerCase() !== 'false';
}

function compactGemmaReviewText(value: string, maxLength = 1800): string {
  const text = value.replace(/\s+/g, ' ').trim();
  return text.length > maxLength ? `${text.slice(0, maxLength - 1)}…` : text;
}

function extractJsonObjectCandidates(text: string): string[] {
  const cleaned = text
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
  const candidates: string[] = [];

  try {
    JSON.parse(cleaned);
    candidates.push(cleaned);
  } catch {
    // そのままJSONでなければ、後続の括弧スキャンで候補を拾う。
  }

  let start = -1;
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = 0; i < cleaned.length; i++) {
    const char = cleaned[i];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === '\\') {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
      continue;
    }
    if (char === '{') {
      if (depth === 0) start = i;
      depth += 1;
      continue;
    }
    if (char === '}' && depth > 0) {
      depth -= 1;
      if (depth === 0 && start >= 0) {
        candidates.push(cleaned.slice(start, i + 1));
        start = -1;
      }
    }
  }

  return Array.from(new Set(candidates));
}

function parseModelJsonObject(text: string): any {
  const candidates = extractJsonObjectCandidates(text);
  const errors: string[] = [];

  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate);
    } catch (e: any) {
      errors.push(e.message || String(e));
    }
  }

  throw new Error(errors[0] || 'JSON object not found.');
}

function toBriefItems(value: unknown, limit = 5): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map(item => String(item || '').replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .slice(0, limit);
}

function normalizeGemmaReviewResponse(rawText: string, pass: GemmaReviewPass, model: string): { brief: string; logText: string; malformed: boolean } {
  try {
    const parsed = parseModelJsonObject(rawText);
    let status = String(parsed?.status || 'UNKNOWN').trim();
    let malformed = false;
    
    if (status === 'UNKNOWN') {
      status = 'NEEDS_WORK';
      malformed = true;
    }
    
    const lines: string[] = [`### ${pass.label} (${model})`, `status: ${status}`];

    const priorityActions = toBriefItems(parsed?.priority_actions, 5);
    if (priorityActions.length > 0) {
      lines.push('priority_actions:', ...priorityActions.map(item => `- ${item}`));
    }

    const rewriteNotes = Array.isArray(parsed?.rewrite_notes) ? parsed.rewrite_notes.slice(0, 5) : [];
    if (rewriteNotes.length > 0) {
      lines.push('rewrite_notes:');
      for (const note of rewriteNotes) {
        const original = String(note?.original || '').replace(/\s+/g, ' ').trim();
        const fixed = String(note?.fixed || '').replace(/\s+/g, ' ').trim();
        if (original && fixed) {
          lines.push(`- original: ${original}`);
          lines.push(`  fixed: ${fixed}`);
        }
      }
    }

    const expansionSections = Array.isArray(parsed?.safe_expansion_sections) ? parsed.safe_expansion_sections.slice(0, 3) : [];
    if (expansionSections.length > 0) {
      lines.push('safe_expansion_sections:');
      for (const section of expansionSections) {
        const heading = String(section?.heading || '').replace(/\s+/g, ' ').trim();
        const reason = String(section?.reason || '').replace(/\s+/g, ' ').trim();
        const mustNotAdd = String(section?.must_not_add || '').replace(/\s+/g, ' ').trim();
        if (heading || reason || mustNotAdd) {
          lines.push(`- ${heading || pass.label}: ${reason}${mustNotAdd ? ` / 禁止: ${mustNotAdd}` : ''}`);
        }
      }
    }

    const terms = toBriefItems(parsed?.seo_terms_to_naturally_include, 8);
    if (terms.length > 0) {
      lines.push(`seo_terms: ${terms.join(' / ')}`);
    }

    const risks = toBriefItems(parsed?.risk_notes, 5);
    if (risks.length > 0) {
      lines.push('risk_notes:', ...risks.map(item => `- ${item}`));
    }

    const brief = lines.join('\n');
    return { brief, logText: brief, malformed };
  } catch (e: any) {
    const compacted = compactGemmaReviewText(rawText, 900);
    const fallback = [
      `### ${pass.label} (${model})`,
      `status: NEEDS_WORK`,
      `risk_notes:`,
      `- GemmaレビューのJSON抽出に失敗したため、本文への反映は限定する。${e.message || String(e)}`,
      compacted ? `raw_excerpt: ${compacted}` : '',
    ].filter(Boolean).join('\n');
    return { brief: fallback, logText: fallback, malformed: true };
  }
}

async function runSingleGemmaReviewPass(input: {
  genAI: GoogleGenerativeAI;
  pass: GemmaReviewPass;
  currentContent: string;
  mechanicalLog: string;
  attempt: number;
  target: string;
}): Promise<{ responseText: string; usageLog: string; model: string } | null> {
  const modelTiers = getGeminiModelTiers('GEMINI_GEMMA_REVIEW_MODEL_TIERS');
  const basePrompt = [
    `【添削観点】${input.pass.label}`,
    input.pass.instruction,
    '',
    '【事前の機械チェック結果】',
    input.mechanicalLog,
    '',
    '【Markdown記事】',
    '```markdown',
    input.currentContent,
    '```',
  ].join('\n');

  for (const currentModelName of modelTiers) {
    let reserved = false;
    try {
      console.log(`[GemmaReview] Attempt ${input.attempt} ${input.pass.label} - Trying model: ${currentModelName}`);
      const isGemma = /gemma/i.test(currentModelName);
      
      const model = input.genAI.getGenerativeModel({
        model: currentModelName,
        systemInstruction: isGemma ? undefined : GEMMA_REVIEW_SYSTEM_PROMPT,
        generationConfig: {
          temperature: 0.15,
          topP: 0.75,
          responseMimeType: 'application/json',
        },
      });

      const finalPrompt = isGemma
        ? `${GEMMA_REVIEW_SYSTEM_PROMPT}\n\n${basePrompt}`
        : basePrompt;

      await reserveGeminiRequest({
        scope: 'article',
        model: currentModelName,
        purpose: `gemma-review-${input.pass.id}-attempt-${input.attempt}`,
        target: input.target,
      });
      reserved = true;
      const response = await model.generateContent(finalPrompt);
      const usageLog = geminiUsageLine(
        `[GemmaReview] Attempt ${input.attempt} ${input.pass.id} ${currentModelName}`,
        response.response
      );
      console.log(usageLog);

      const usage = response.response.usageMetadata;
      if (usage) {
        await recordTokenUsage({
          scope: 'article',
          model: currentModelName,
          promptTokens: usage.promptTokenCount ?? 0,
          outputTokens: usage.candidatesTokenCount ?? 0,
          totalTokens: usage.totalTokenCount ?? 0,
          target: input.target,
        });
      }

      return {
        responseText: response.response.text() || '',
        usageLog,
        model: currentModelName,
      };
    } catch (e: any) {
      if (reserved) {
        await rollbackGeminiRequest({
          scope: 'article',
          model: currentModelName,
          purpose: `gemma-review-${input.pass.id}-attempt-${input.attempt}`,
          target: input.target,
        });
        reserved = false;
      }
      if (isApiKeyInvalidError(e)) {
        console.error(`\n[CRITICAL ERROR] GEMINI_API_KEY が無効、または漏洩判定されています。`);
        console.error(`Google AI Studioで新しいAPIキーを再生成し、.env または GitHub Secrets の GEMINI_API_KEY に設定し直してください。\n`);
        throw e;
      }
      if (e instanceof GeminiQuotaExceededError) {
        console.warn(`[GemmaReview Warning] ${currentModelName} quota guard: ${e.message}`);
        if (e.kind === 'total') return null;
        continue;
      }
      console.warn(`[GemmaReview Warning] ${currentModelName} failed: ${e.message || String(e)}`);
      if (classifyGeminiFailure(e) === 'billing_depleted') {
        throw e;
      }
      if (!isRetryableGeminiError(e)) {
        continue;
      }
    }
  }

  return null;
}

async function buildGemmaReviewBrief(input: {
  genAI: GoogleGenerativeAI;
  currentContent: string;
  mechanicalLog: string;
  attempt: number;
  target: string;
}): Promise<GemmaReviewResult> {
  if (!isGemmaReviewEnabled()) {
    return { promptBrief: '', log: '\n[GemmaReview] disabled by ARTICLE_GEMMA_REVIEW_ENABLED=false\n' };
  }

  const maxPasses = Math.min(
    GEMMA_REVIEW_PASSES.length,
    parsePositiveInt(process.env.ARTICLE_GEMMA_REVIEW_PASSES, GEMMA_REVIEW_PASSES.length)
  );
  const maxAttempts = parsePositiveInt(process.env.ARTICLE_GEMMA_REVIEW_ATTEMPTS, 3);
  if (input.attempt > maxAttempts || maxPasses <= 0) {
    return { promptBrief: '', log: `\n[GemmaReview] skipped on attempt ${input.attempt}\n` };
  }

  const briefParts: string[] = [];
  const logParts: string[] = [`\n[GemmaReview] Attempt ${input.attempt}: ${maxPasses} passes\n`];
  let hasMalformed = false;

  for (const pass of GEMMA_REVIEW_PASSES.slice(0, maxPasses)) {
    const result = await runSingleGemmaReviewPass({ ...input, pass });
    if (!result) {
      logParts.push(`- ${pass.label}: skipped or failed`);
      continue;
    }

    const normalized = normalizeGemmaReviewResponse(result.responseText, pass, result.model);
    briefParts.push(normalized.brief);
    logParts.push(`- ${pass.label}: ${result.model}\n  ${result.usageLog}\n${normalized.logText}`);
    if (normalized.malformed) {
      hasMalformed = true;
    }
  }

  if (hasMalformed) {
    logParts.push(`\n[GemmaReview Warning] malformed_gemma_response: true\n`);
  }

  return {
    promptBrief: briefParts.join('\n\n'),
    log: logParts.join('\n') + '\n',
  };
}

export async function reviewDraft(filePath: string, options: ReviewDraftOptions = {}): Promise<{
  status: 'APPROVED' | 'REJECTED';
  log: string;
  newDraftPath?: string;
  retryable?: boolean;
  apiKeyInvalid?: boolean;
  failureKind?: GeminiFailureKind;
}> {
  let retryableApiFailure = false;

  try {
    const revisedPath = filePath.replace('.md', '_revised.md');
    if (fs.existsSync(revisedPath)) {
      fs.unlinkSync(revisedPath);
      console.log(`[Editor] Cleaned up previous revised file: ${revisedPath}`);
    }

    let currentContent = fs.readFileSync(filePath, 'utf-8');
    let finalStatus: 'APPROVED' | 'REJECTED' = 'REJECTED';
    let newDraftPath: string | undefined = undefined;
    let allLogs = "";
    let lastApiErrorMessage = "";
    let sawEditorJsonParseFailure = false;
    let lastParsedEditorStatus: string | null = null;
    let lastReplacementFailed = false;
    let lastContentQualityPassed = false;
    let previousCriticalFeedback = '';

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is not set.");
    }
    const genAI = new GoogleGenerativeAI(apiKey);
    const modelTiers = getGeminiModelTiers('GEMINI_EDITOR_MODEL_TIERS');
    console.log(`[Editor] LLM strategy: ${getArticleLlmStrategySummary()}`);

    for (let attempt = 1; attempt <= 3; attempt++) {
      console.log(`[Editor] Running AI evaluation (Attempt ${attempt})...`);
      
      // アテンプトごとのモデル割り当て制御
      // 【モデル選定戦略の意図（賢さ重視・フォールバック順）】:
      // Editor は記事の品質審査・表現精査・置換指示など高精度な判断が必要なため「賢さ重視」のモデル選定を採用。
      // 全アテンプト共通: 3.6 Flash → 3.5 Flash → 3.5 Flash Lite → 3.1 Flash Lite の順で試行。
      // 上位モデルが 503/429/クォータ超過の場合に限り次のモデルへ自動フォールバック。Lite は最終手段。
      const currentModelTiers = modelTiers;
      const preAttemptRepair = autoRepairDraftMarkdown(currentContent);
      if (preAttemptRepair.changes.length > 0) {
        currentContent = preAttemptRepair.content;
        allLogs += `\n[Attempt ${attempt} Auto Repair Before AI]\n - ${preAttemptRepair.changes.join('\n - ')}\n`;
      }

      const seoResult = checkSEO(currentContent);
      const seoMechanicalLog = seoResult.passed
        ? "機械チェック（文字数・NGワード等）：エラーなし"
        : `機械チェックエラー（以下の違反を必ず修正すること）:\n - ${seoResult.errors.join('\n - ')}`;
      const articleFlowLog = (options.machineIssues || []).length > 0
        ? `記事フロー機械チェックエラー（未確認数値・出典表現を必ず修正すること）:\n - ${(options.machineIssues || []).slice(0, 20).join('\n - ')}`
        : '記事フロー機械チェック：エラーなし';
      const mechanicalLog = `${seoMechanicalLog}\n${articleFlowLog}`;

      allLogs += `\n[Attempt ${attempt} Mechanical Check]\n${mechanicalLog}\n`;

      const parsedForReview = matter(currentContent);
      const targetForReview = String(
        parsedForReview.data.target_keyword || parsedForReview.data.title || path.basename(filePath, '.md')
      );
      const gemmaReview = await buildGemmaReviewBrief({
        genAI,
        currentContent,
        mechanicalLog,
        attempt,
        target: targetForReview,
      });
      if (gemmaReview.log) {
        allLogs += gemmaReview.log;
      }
      const gemmaReviewSection = gemmaReview.promptBrief
        ? `\n\n【Gemma複数観点レビュー】\n${gemmaReview.promptBrief}\n`
        : '';

      let parseWarning = '';
      if (attempt > 1 && sawEditorJsonParseFailure) {
        parseWarning = `【極めて重要】前回の出力はJSONとして正しくパースできませんでした。応答にMarkdownのコードブロック( \`\`\`json と \`\`\` )や、挨拶、解説文、余計な文字列を含めては【絶対に禁止】します。必ず純粋な { "status": ... } のJSON文字列のみを直接出力してください。\n\n`;
      }
      const criticalRetryWarning = attempt > 1 && previousCriticalFeedback
        ? `【極めて重要】前回の編集指示はプログラム側の重要ガードで却下されました。\n${previousCriticalFeedback}\n同じ未確認数値・日付・根拠不明の事実を fixed に再掲してはいけません。数値の根拠が不明な場合は、数値なしの確認手順へ言い換えてください。\n\n`
        : '';

      const basePrompt = `${parseWarning}${criticalRetryWarning}以下のドラフト記事（Markdown）を編集確認する。\n\n【事前の機械チェック結果】\n${mechanicalLog}${gemmaReviewSection}\n\n\`\`\`markdown\n${currentContent}\n\`\`\``;

      let response: any = null;
      let generateFailed = true;

      for (let i = 0; i < currentModelTiers.length; i++) {
        const currentModelName = currentModelTiers[i];
        console.log(`[Editor] Attempt ${attempt} - Trying model: ${currentModelName}`);
        const isGemma = /gemma/i.test(currentModelName);
        
        const model = genAI.getGenerativeModel({
          model: currentModelName,
          systemInstruction: isGemma ? undefined : EDITOR_SYSTEM_PROMPT,
          generationConfig: {
            temperature: 0.1,
            responseMimeType: "application/json"
          }
        });

        const finalPrompt = isGemma
          ? `${EDITOR_SYSTEM_PROMPT}\n\n${basePrompt}`
          : basePrompt;

        const maxRequestAttempts = geminiRetryAttemptsForModel(currentModelName);
        let reserved = false;
        for (let requestAttempt = 1; requestAttempt <= maxRequestAttempts; requestAttempt++) {
          try {
            const parsedForQuota = matter(currentContent);
            const targetStr = parsedForQuota.data.target_keyword || parsedForQuota.data.title || 'editor-target';
            await reserveGeminiRequest({
              scope: 'article',
              model: currentModelName,
              purpose: `editor-attempt-${attempt}`,
              target: targetStr,
            });
            reserved = true;
            response = await model.generateContent(finalPrompt);
            const usageLine = geminiUsageLine(`[Editor] Attempt ${attempt} ${currentModelName}`, response.response);
            console.log(usageLine);
            allLogs += `\n[Attempt ${attempt} Token Usage]\n${usageLine}\n`;
            
            const usage = response.response.usageMetadata;
            if (usage) {
              await recordTokenUsage({
                scope: 'article',
                model: currentModelName,
                promptTokens: usage.promptTokenCount ?? 0,
                outputTokens: usage.candidatesTokenCount ?? 0,
                totalTokens: usage.totalTokenCount ?? 0,
                target: targetStr,
              });
            }

            generateFailed = false;
            break; // 成功したら次へ
          } catch (e: any) {
            if (reserved) {
              const parsedForQuota = matter(currentContent);
              const targetStr = parsedForQuota.data.target_keyword || parsedForQuota.data.title || 'editor-target';
              await rollbackGeminiRequest({
                scope: 'article',
                model: currentModelName,
                purpose: `editor-attempt-${attempt}`,
                target: targetStr,
              });
              reserved = false;
            }
            if (isApiKeyInvalidError(e)) {
              console.error(`\n[CRITICAL ERROR] GEMINI_API_KEY が無効、または漏洩判定されています。`);
              console.error(`Google AI Studioで新しいAPIキーを再生成し、.env または GitHub Secrets の GEMINI_API_KEY に設定し直してください。\n`);
              throw e;
            }
            if (e instanceof GeminiQuotaExceededError) {
              console.error(`[Editor Warning] ${currentModelName} quota guard: ${e.message}`);
              if (e.kind === 'total' || i === modelTiers.length - 1) {
                throw e;
              }
              break;
            }
            console.error(`[Editor Warning] ${currentModelName} failed: ${e.message}`);
            allLogs += `\n[Editor Warning] ${currentModelName} failed: ${e.message}\n`;
            lastApiErrorMessage = e.message || String(e);
            if (classifyGeminiFailure(e) === 'billing_depleted') {
              throw e;
            }
            if (isRetryableGeminiError(e)) {
              retryableApiFailure = true;
              if (requestAttempt < maxRequestAttempts) {
                const waitMs = geminiRetryDelayMs(requestAttempt);
                console.warn(`[Editor] ${currentModelName} temporary failure (503 Overloaded / Rate limit). Retrying in ${waitMs}ms (${requestAttempt + 1}/${maxRequestAttempts})...`);
                allLogs += `[Editor Retry] ${currentModelName} temporary API overload/retryable error (503/429 etc.) detected. Sleeping for ${waitMs}ms before retry (${requestAttempt + 1}/${maxRequestAttempts})\n`;
                await sleep(waitMs);
                continue;
              }
            }
            break;
          }
        }
        if (!generateFailed) {
          break;
        }
      }

      if (generateFailed || !response) {
         allLogs += `\n[Attempt ${attempt} Fatal] すべてのモデルでAPIリクエストが失敗しました。\n`;
         if (retryableApiFailure && attempt === 3) {
           // 最終アテンプトまで全て失敗した場合のみ、例外をスローして停止
           throw new Error(`Gemini APIの外部制限（クォータ・課金・レート制限等）によりレビューを完了できませんでした。${lastApiErrorMessage}`);
         }
         if (!retryableApiFailure) {
           // 503/429以外（APIキー無効など）の致命的エラーは即座にループを抜ける
           break;
         }
         // 503一時障害の場合は、次のアテンプトに期待して継続する（指数バックオフ待機）
         const coolDownMs = 15000 * attempt; // 15秒, 30秒
         console.warn(`[Editor] Attempt ${attempt} failed due to temporary API error (503/429 etc.). Sleeping for ${coolDownMs}ms before attempt ${attempt + 1}...`);
         allLogs += `[Editor Sleep] Temporary API error (503/429 etc.) on attempt ${attempt}. Cooling down for ${coolDownMs}ms...\n`;
         await sleep(coolDownMs);
         continue;
      }

      const editorText = response.response.text() || '';
      // ログ肥大化防止：editorTextが長い場合は切り詰めてログに記録
      const logText = editorText.length > 2000
        ? `${editorText.slice(0, 2000)}... (truncated total ${editorText.length} chars)`
        : editorText;
      allLogs += `\n[Attempt ${attempt} AI Editor JSON Response]\n${logText}\n`;

      let parsedJson: any = null;
      try {
        parsedJson = parseModelJsonObject(editorText);
      } catch (e: any) {
        sawEditorJsonParseFailure = true;
        lastParsedEditorStatus = null;
        allLogs += `\n[Editor Fatal] JSONパースフェイル: ${e.message}\n`;
        continue;
      }
      lastParsedEditorStatus = String(parsedJson.status || '').trim();
      const contentQualityPassed = hasApprovedContentQuality(parsedJson.content_quality);

      // JSONを適用して content を更新
      const parsedMatter = matter(currentContent);
      if (parsedJson.fixed_frontmatter) {
        if (parsedJson.fixed_frontmatter.title) parsedMatter.data.title = parsedJson.fixed_frontmatter.title;
        if (parsedJson.fixed_frontmatter.description) parsedMatter.data.description = parsedJson.fixed_frontmatter.description;
      }

      let tmpContent = parsedMatter.content;
      let replacementFailed = false;
      let hasCriticalFailed = false;
      const criticalFeedbackItems: string[] = [];
      const evidenceNumbers = extractNumbersFromEvidence(parsedMatter.data);

      if (parsedJson.content_replacements && Array.isArray(parsedJson.content_replacements)) {
        for (const rep of parsedJson.content_replacements) {
          if (rep.original && rep.fixed !== undefined) {
            // 暴走したAIが差分パッチを利用して表を壊そうとした場合はプログラム側で防御
            if (rep.original.includes('| ---') || rep.original.includes('| :---') || rep.original.includes('--- |')) {
              allLogs += `\n[Editor Protective] AIが表(\`| --- \`)を置換・削除しようとしたため、プログラムが強制ブロックしました。\n`;
              continue;
            }

            if (isUnsafeLongFormReplacement(rep.original, rep.fixed)) {
              replacementFailed = true;
              hasCriticalFailed = true;
              criticalFeedbackItems.push('見出し1行を長い本文セクションへ置換する指示は、根拠不明の本文追加につながるためブロックされました。');
              allLogs += `\n[Editor Critical Warning] 長文セクション追加をcontent_replacementsで行おうとしたため置換を却下しました: ${rep.original.slice(0, 30)}...\n`;
              continue;
            }

            // fixed側の数値ハルシネーションチェック
            const hallucinationCheck = checkFixedValueHallucination(rep.fixed, evidenceNumbers);
            if (hallucinationCheck.hasHallucination) {
              replacementFailed = true;
              hasCriticalFailed = true;
              criticalFeedbackItems.push(hallucinationCheck.details || 'Evidence Packに存在しない数値がfixedへ含まれています。');
              allLogs += `\n[Editor Critical Warning] 数値ハルシネーション検出により置換を却下しました: ${hallucinationCheck.details}\n`;
              continue;
            }

            const isCritical = isCriticalReplacement(rep.original, rep.fixed);
            const normalizeOriginal = rep.original.replace(/\r\n/g, '\n').trim();
            const isFound = tmpContent.replace(/\r\n/g, '\n').includes(normalizeOriginal);
            
            if (!isFound) {
              // カスケード置換ミスマッチへの配慮（すでに前のアテンプト等で適用済み、または現在の本文中に見つからない場合）
              allLogs += `\n[Editor Warning] 置換対象が現在の本文中に見つからないためスキップされました（過去適用済み等の可能性）: ${rep.original.slice(0, 30)}...\n`;
              continue;
            }

            const res = applyReplacement(tmpContent, rep.original, rep.fixed);
            if (!res.success) {
              replacementFailed = true;
              if (isCritical) {
                hasCriticalFailed = true;
                criticalFeedbackItems.push(`重要置換の適用失敗: ${rep.original.slice(0, 60)}`);
                allLogs += `\n[Editor Critical Warning] 重要置換（数値・日付等）の適用に失敗しました: ${rep.original.slice(0, 30)}...\n`;
              } else {
                allLogs += `\n[Editor Cosmetic Warning] 軽微な置換の適用に失敗しました（スキップします）: ${rep.original.slice(0, 30)}...\n`;
              }
            } else {
              tmpContent = res.result;
            }
          }
        }
      }

      // FrontmatterとBodyを再結合
      currentContent = matter.stringify(tmpContent, parsedMatter.data);

      const postAiRepair = autoRepairDraftMarkdown(currentContent);
      if (postAiRepair.changes.length > 0) {
        currentContent = postAiRepair.content;
        allLogs += `\n[Attempt ${attempt} Auto Repair After AI]\n - ${postAiRepair.changes.join('\n - ')}\n`;
      }

      // パッチ後の内容でSEO再チェック。機械チェック由来のREJECTEDは自動補正後に通れば承認扱いにする。
      const postPatchSeo = checkSEO(currentContent);
      lastReplacementFailed = replacementFailed;
      lastContentQualityPassed = contentQualityPassed;
      const lastHasCriticalFailed = hasCriticalFailed;
      if (postPatchSeo.passed && parsedJson.status === 'APPROVED' && contentQualityPassed && !hasCriticalFailed) {
        finalStatus = 'APPROVED';
        allLogs += `\n[Attempt ${attempt}] SEO Passed. APPROVED (No Critical replacement failures). Cosmetic Failed Allowed: ${replacementFailed && !hasCriticalFailed}\n`;
        break; // 合格
      } else {
        previousCriticalFeedback = criticalFeedbackItems.length > 0
          ? criticalFeedbackItems.map(item => `- ${item}`).join('\n')
          : '';
        allLogs += `\n[Attempt ${attempt}] AI status was ${parsedJson.status}. Post-patch SEO passed: ${postPatchSeo.passed}. Replacement Failed: ${replacementFailed}, Critical Failed: ${hasCriticalFailed}`;
        if (postPatchSeo.passed && parsedJson.status !== 'APPROVED') {
          allLogs += `\n[Attempt ${attempt}] SEOは通過しましたが、AI Editorが承認していないため公開承認しません。`;
        }
        if (postPatchSeo.passed && !contentQualityPassed) {
          allLogs += `\n[Attempt ${attempt}] SEOは通過しましたが、検索意図への回答・固有価値・条件・確認時点の構造化レビューが未充足のため公開承認しません。`;
        }
        if (postPatchSeo.passed && hasCriticalFailed) {
          allLogs += `\n[Attempt ${attempt}] SEOは通過しましたが、AI Editorの重要置換指示が一部未反映のため再確認します。`;
        }
        if (!postPatchSeo.passed) {
          allLogs += `\n[Attempt ${attempt} Remaining SEO Errors]\n - ${postPatchSeo.errors.join('\n - ')}`;
        }
        allLogs += `\n`;
      }
    }

    let lastHasCriticalFailed = false; // ループ外スコープ用
    if (finalStatus === 'REJECTED') {
      const finalRepair = autoRepairDraftMarkdown(currentContent);
      if (finalRepair.changes.length > 0) {
        currentContent = finalRepair.content;
        allLogs += `\n[Final Auto Repair]\n - ${finalRepair.changes.join('\n - ')}\n`;
      }

      const finalSeo = checkSEO(currentContent);
      if (finalSeo.passed && !sawEditorJsonParseFailure && lastParsedEditorStatus === 'APPROVED' && lastContentQualityPassed && !lastReplacementFailed) {
        // 全く失敗がなかった場合のみ
        finalStatus = 'APPROVED';
        allLogs += `\n[Final Auto Repair] SEO Passed after AI Editor approval. APPROVED.\n`;
      } else if (finalSeo.passed) {
        allLogs += `\n[Final Auto Repair] SEOは通過しましたが、AI EditorのJSON失敗・非承認・未反映置換が残るためREJECTEDのままにします。\n`;
      } else {
        allLogs += `\n[Final Auto Repair] SEO still failed:\n - ${finalSeo.errors.join('\n - ')}\n`;
      }
    }

    if (finalStatus === 'REJECTED') {
      newDraftPath = filePath.replace('.md', '_revised.md');
      fs.writeFileSync(newDraftPath, currentContent, 'utf-8');
      console.log(`[Editor] Draft was REJECTED after retries. Revised draft saved to: ${newDraftPath}`);

      // 却下ドラフトの data/rejected_articles/ への退避保存
      try {
        const rejectedDir = path.join(__dirname, '..', '..', '..', 'data', 'rejected_articles');
        fs.mkdirSync(rejectedDir, { recursive: true });
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `${path.basename(filePath, '.md')}_${timestamp}.md`;
        fs.writeFileSync(path.join(rejectedDir, filename), currentContent, 'utf-8');
        console.log(`[Editor] Rejected draft backed up to: ${path.join(rejectedDir, filename)}`);
      } catch (err: any) {
        console.error(`[Editor] Failed to back up rejected draft: ${err.message}`);
      }

      // logs/editor_rejects.json へのエラー構造化ログ出力
      try {
        const rejectsLogPath = path.join(__dirname, '..', '..', '..', 'logs', 'editor_rejects.json');
        fs.mkdirSync(path.dirname(rejectsLogPath), { recursive: true });
        const rejectsData = fs.existsSync(rejectsLogPath) ? JSON.parse(fs.readFileSync(rejectsLogPath, 'utf-8')) : [];
        
        const parsedMatter = matter(currentContent);
        const seoResult = checkSEO(currentContent);

        rejectsData.push({
          timestamp: new Date().toISOString(),
          filePath,
          target: parsedMatter.data.target_keyword || parsedMatter.data.title || null,
          reason: seoResult.errors.join('; '),
          attemptsCount: 3
        });
        fs.writeFileSync(rejectsLogPath, JSON.stringify(rejectsData, null, 2), 'utf-8');
        console.log(`[Editor] Rejects log updated: ${rejectsLogPath}`);
      } catch (err: any) {
        console.error(`[Editor] Failed to write rejects log: ${err.message}`);
      }
    } else if (finalStatus === 'APPROVED') {
      if (options.outputMode === 'staged') {
        const stagedDir = path.join(__dirname, '..', '..', 'agents', 'queue', 'revised');
        fs.mkdirSync(stagedDir, { recursive: true });
        newDraftPath = path.join(stagedDir, path.basename(filePath));
        fs.writeFileSync(newDraftPath, currentContent, 'utf-8');
        if (path.resolve(filePath) !== path.resolve(newDraftPath) && fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
        console.log(`[Editor] Draft passed editor and is staged for final article flow: ${newDraftPath}`);
      } else {
        fs.writeFileSync(filePath, currentContent, 'utf-8');
        newDraftPath = promoteReviewedDraft(filePath);
      }
    }

    return { status: finalStatus, log: allLogs, newDraftPath };

  } catch (error: any) {
    console.error(`[Editor Error] ${error.message}`);
    const apiKeyInvalid = isApiKeyInvalidError(error);
    const failureKind = classifyGeminiFailure(error);
    return {
      status: 'REJECTED',
      log: `エラーにより検証失敗: ${error.message}`,
      retryable: !apiKeyInvalid && (error instanceof GeminiQuotaExceededError || isRetryableGeminiError(error)),
      apiKeyInvalid,
      failureKind,
    };
  }
}
