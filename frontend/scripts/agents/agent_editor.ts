import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { checkSEO, SEO_RULES } from './seo_checker';
import { ARTICLE_LLM_MODELS, getArticleLlmStrategySummary, getGeminiModelTiers } from './model_tiers';
import { GeminiQuotaExceededError, reserveGeminiRequest, rollbackGeminiRequest, recordTokenUsage } from './gemini_quota';

function isApiKeyInvalidError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error || '');
  return /API key was reported as leaked|API_KEY_INVALID|API key not valid|Forbidden|403/i.test(msg);
}


const DEFAULT_BUYING_POINT_HEADING = '## このコースの買い目ポイント';
const RACE_BUYING_POINT_HEADING = '## このレースの買い目ポイント';
const NEWS_CONFIRMATION_POINT_HEADING = '## このニュースの確認ポイント';
const REQUIRED_TODAY_RACE_CTA = '最新の出馬表とAI予想は [今日のAI予想・出馬表](/races/today) で無料公開中。';
const POINT_HEADING_TEXTS = [
  'このコースの買い目ポイント',
  'このレースの買い目ポイント',
  'このニュースの確認ポイント',
];

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
  '✅': '',
  '❌': '',
  'と思っていませんか': '',
  'この記事をお読みいただければ': 'この記事では',
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

function checkFixedValueHallucination(fixed: string, evidenceNumbers: Set<number>): { hasHallucination: boolean, details?: string } {
  // パターン 1: 騎手名等.*?(\d+\.?\d*)[%％] (勝率・回収率)
  const pattern1 = /(?:勝率|回収率|複勝率|好走率)[^%％0-9]*?(\d+(?:\.\d+)?)\s*[%％]/g;
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

function requiredPointHeadingForData(data: Record<string, any>): string {
  const theme = String(data.theme_cluster || data.article_type || '');
  if (theme === 'news_context') return NEWS_CONFIRMATION_POINT_HEADING;
  if (theme === 'race_update' || theme === 'grade_race_preview') return RACE_BUYING_POINT_HEADING;
  return DEFAULT_BUYING_POINT_HEADING;
}

function isPointHeadingText(heading: string): boolean {
  return POINT_HEADING_TEXTS.includes(heading.trim());
}

function suffixForTheme(themeCluster: unknown, seed: string): string {
  const suffixesByTheme: Record<string, string[]> = {
    jockey_data: [
      '勝率と回収率で残す騎手',
      '人気とのズレを見る騎手データ',
      '軸候補を絞る騎手成績',
    ],
    grade_race_preview: [
      '枠順と偏差値の確認順',
      '疑う条件と買い足す条件',
      '直前データで見る評価軸',
    ],
    news_context: [
      '出馬表で見る確認ポイント',
      'ニュース後に見る判断材料',
      '当日の確認順を整理',
    ],
    race_update: [
      'ニュース後に見る確認順',
      '枠順と馬場の判断材料',
      '直前データで見る評価軸',
    ],
    running_style_data: [
      '脚質と隊列で見る狙い所',
      '展開から残す馬の条件',
      '先行差しの評価を分ける',
    ],
    popularity_data: [
      '人気と配当のズレを読む',
      '荒れ方を見る上位人気データ',
      '買い過ぎを避ける人気傾向',
    ],
    waku_data: [
      '枠順で評価を分ける条件',
      '内外の差から見る買い方',
      '有利枠を出馬表で確認',
    ],
    asset: [
      '枠順で評価を分ける条件',
      '内外の差から見る買い方',
      '有利枠を出馬表で確認',
    ],
    seasonal: [
      '開催時期で見る枠順傾向',
      '今の馬場で残す条件',
      '季節替わりの評価軸',
    ],
  };

  const suffixes = suffixesByTheme[String(themeCluster || '')] || [
    'データから見る確認順',
    '出馬表で使う判断材料',
    '買い目を絞るデータ軸',
  ];
  return suffixes[stableIndex(seed, suffixes.length)];
}

function fitTitleToSeo(title: string, data: Record<string, any>, content: string): string {
  let result = sanitizeGeneratedText(title).replace(/^["']|["']$/g, '');
  const fallbackBase = compactForTitle(data.target_keyword || result || '競馬データ');
  const suffix = suffixForTheme(data.theme_cluster, fallbackBase);
  const numberInContent = content.match(/\d+(?:\.\d+)?%?/)?.[0] || '3点';

  if (!/\d/.test(result)) {
    result = `${result || fallbackBase}${numberInContent}`;
  }

  if (result.length < SEO_RULES.title_min_chars || result.length > SEO_RULES.title_max_chars) {
    result = `${fallbackBase}｜${suffix}`;
  }

  if (!/\d/.test(result)) {
    result = `${result}3点`;
  }

  if (result.length < SEO_RULES.title_min_chars) {
    for (const addition of ['直前確認', '買い方整理', 'データ確認']) {
      if (result.length + addition.length <= SEO_RULES.title_max_chars) {
        result += addition;
        break;
      }
    }
  }

  if (result.length > SEO_RULES.title_max_chars) {
    const separator = '｜';
    const maxBaseLength = SEO_RULES.title_max_chars - suffix.length - separator.length;
    const base = fallbackBase.slice(0, Math.max(8, maxBaseLength));
    result = `${base}${separator}${suffix}`;
  }

  if (result.length < SEO_RULES.title_min_chars) {
    const addition = 'データ確認3点';
    result = `${result}${addition}`.slice(0, SEO_RULES.title_max_chars);
  }

  return sanitizeGeneratedText(result);
}

function trimDescription(description: string): string {
  let result = description.trim();
  if (result.length <= SEO_RULES.description_max_chars) return result;

  result = result.slice(0, SEO_RULES.description_max_chars - 1);
  const lastBreak = Math.max(result.lastIndexOf('。'), result.lastIndexOf('、'));
  if (lastBreak >= SEO_RULES.description_min_chars - 1) {
    result = result.slice(0, lastBreak);
  }
  return `${result.replace(/[、。]+$/g, '')}。`;
}

function descriptionAdditionsForTheme(themeCluster: unknown): string[] {
  const theme = String(themeCluster || '');
  if (theme === 'jockey_data') {
    return [
      '騎乗回数、勝率、人気とのズレを分け、軸候補と相手候補の線引きを整理します。',
      '好走率だけでなく、回収率が数字に残る場面と人気先行で疑う場面を確認できます。',
    ];
  }

  if (theme === 'grade_race_preview') {
    return [
      '枠順、脚質、AI偏差値を分け、買い足す条件と評価を下げる条件を整理します。',
      '直前に見る材料を絞り、人気馬をそのまま信じるか疑うかの判断順を確認できます。',
    ];
  }

  if (theme === 'news_context') {
    return [
      'ニュースで確認された材料を出馬表の見方に置き換え、当日見る順番を整理します。',
      '話題そのものの要約ではなく、馬場、枠順、脚質、AI予想で確認する点を分けます。',
    ];
  }

  if (theme === 'race_update') {
    return [
      'レース前の発表や話題を踏まえ、枠順、馬場、脚質、AI予想で確認する順番を整理します。',
      '直前に見る材料を分け、買い足す条件と評価を下げる条件を確認できます。',
    ];
  }

  if (theme === 'running_style_data') {
    return [
      '先行勢と差し勢の数字を分け、隊列が向く馬と展開待ちの馬を整理します。',
      '直線やコーナーの特徴を踏まえ、出馬表で脚質を確認する順番をまとめます。',
    ];
  }

  if (theme === 'popularity_data') {
    return [
      '上位人気の信頼度と配当妙味を分け、堅く見る場面と広げる場面を確認できます。',
      '人気だけで決めず、オッズに織り込まれた条件と残したい穴条件を整理します。',
    ];
  }

  if (theme === 'waku_data' || theme === 'asset' || theme === 'seasonal') {
    return [
      '内外の枠差、複勝率、回収率を分け、軸にしやすい枠と割り引く枠を整理します。',
      '枠番の数字を出馬表で使える形にし、当日の馬場や脚質と重ねて確認できます。',
    ];
  }

  return [
    '数字の強弱と当日の確認材料を分け、買い・抑え・見送りの判断を整理します。',
    '出馬表を見る前に、評価を上げる条件と下げる条件を確認できます。',
  ];
}

function fitDescriptionToSeo(description: string, data: Record<string, any>): string {
  const target = compactForTitle(data.target_keyword || data.title || 'この条件');
  const additions = descriptionAdditionsForTheme(data.theme_cluster);

  let result = sanitizeGeneratedText(description)
    .replace(/徹底分析/g, '整理')
    .replace(/^["']|["']$/g, '');

  if (!result) {
    result = `${target}の成績データを整理。`;
  }

  for (const addition of additions) {
    if (result.length >= SEO_RULES.description_min_chars) break;
    const candidate = `${result}${result.endsWith('。') ? '' : '。'}${addition}`;
    result = candidate.length <= SEO_RULES.description_max_chars ? candidate : trimDescription(candidate);
  }

  if (result.length < SEO_RULES.description_min_chars) {
    result = `${target}のデータを整理。${additions.join('')}`;
  }

  return trimDescription(sanitizeGeneratedText(result));
}

function findLastBuyingPointHeading(content: string): number {
  const pattern = /^##\s+(このコースの買い目ポイント|このレースの買い目ポイント|このニュースの確認ポイント)\s*$/gm;
  let match: RegExpExecArray | null;
  let lastIndex = -1;
  while ((match = pattern.exec(content)) !== null) {
    lastIndex = match.index;
  }
  return lastIndex;
}

function fallbackBuyingPoints(data: Record<string, any>): string[] {
  const theme = String(data.theme_cluster || '');
  if (theme === 'jockey_data') {
    return [
      '買い: 勝率と騎乗回数がそろう騎手は、人気との釣り合いを見て軸候補にする。',
      '抑え: 回収率だけが高い騎手は、相手候補として配当に厚みを出す。',
      '見送り: 勝率が低く人気だけ先行する騎乗は、評価を下げる。',
      '条件付き: 馬場悪化や少頭数では、先行できる馬との組み合わせを優先する。',
    ];
  }

  if (theme === 'grade_race_preview') {
    return [
      '買い: AI偏差値上位でも枠順と脚質を合わせて、軸にできるか確認する。',
      '抑え: コース傾向に合う馬は、人気が落ちるなら相手に残す。',
      '見送り: 評価が低く展開の助けも必要な馬は、買い目を広げすぎない。',
      '条件付き: 馬場が変わる日は、当日の時計と内外の伸びを見て評価を調整する。',
    ];
  }

  if (theme === 'news_context') {
    return [
      '確認: ニュースで触れられた材料は、出馬表と馬場発表で事実関係を先に確認する。',
      '抑え: 関連するレースがある場合は、枠順、脚質、騎手変更を分けて見る。',
      '見送り: 話題性だけで人気が先行している馬は、AI偏差値とオッズの釣り合いを確認する。',
      '条件付き: 当日の馬場が変わる日は、直前の時計と内外の伸びを見て評価を調整する。',
    ];
  }

  if (theme === 'race_update') {
    return [
      '買い: 発表内容と枠順、脚質がかみ合う馬は、軸候補として最初に確認する。',
      '抑え: コース傾向に合う馬は、人気が落ちるなら相手に残す。',
      '見送り: 話題性だけで人気が先行する馬は、AI偏差値と馬場適性を見て評価を下げる。',
      '条件付き: 騎手変更や馬場悪化がある日は、直前の出馬表で評価を調整する。',
    ];
  }

  return [
    '買い: 勝率と複勝率がそろう条件は、軸候補として最初に確認する。',
    '抑え: 回収率に妙味が残る条件は、相手候補として買い目に残す。',
    '見送り: 数字が低く人気だけ先行する条件は、評価を下げる。',
    '条件付き: 馬場や頭数が変わる日は、直前の出馬表で脚質との相性を確認する。',
  ];
}

function normalizeBuyingPointLines(sectionText: string, data: Record<string, any>): string {
  const lines = sectionText
    .split('\n')
    .map(line => sanitizeGeneratedText(line).replace(/^[・\s]+/, '').trim())
    .filter(line => line && !line.includes('/races/today') && !/^#{1,6}\s+/.test(line));

  const normalizedLines = lines.map(line => {
    const withoutBullet = line.replace(/^[-*]\s+/, '').replace(/^\d+\.\s+/, '').trim();
    return `- ${withoutBullet}`;
  });

  const existingText = normalizedLines.join('\n');
  for (const point of fallbackBuyingPoints(data)) {
    if (normalizedLines.length >= 3) break;
    if (!existingText.includes(point.slice(0, 8))) {
      normalizedLines.push(`- ${point}`);
    }
  }

  return (normalizedLines.length > 0 ? normalizedLines : fallbackBuyingPoints(data).map(point => `- ${point}`)).join('\n');
}

function normalizeBuyingPointSection(content: string, data: Record<string, any>): string {
  const requiredHeading = requiredPointHeadingForData(data);
  let result = content
    .replace(/^(?:#{1,6}\s*){0,2}(?:このコースの買い目ポイント|このレースの買い目ポイント|このニュースの確認ポイント)\s*$/gm, requiredHeading)
    .replace(/^.*\[今日のAI予想・出馬表]\(\/races\/today\).*$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  const isOverseas = data.is_overseas === true || data.overseas === true || data.category === '海外競馬';

  const requiredHeadingRegex = new RegExp(`^${requiredHeading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`, 'm');
  if (!requiredHeadingRegex.test(result)) {
    result = `${result}\n\n${requiredHeading}\n\n${fallbackBuyingPoints(data).map(point => `- ${point}`).join('\n')}`;
  }

  const headingIndex = findLastBuyingPointHeading(result);
  if (headingIndex < 0) {
    return isOverseas ? result.trim() : `${result}\n\n${REQUIRED_TODAY_RACE_CTA}`.trim();
  }

  const before = result.slice(0, headingIndex).trim();
  const sectionWithHeading = result.slice(headingIndex);
  const sectionBody = sectionWithHeading
    .replace(/^##\s+(?:このコースの買い目ポイント|このレースの買い目ポイント|このニュースの確認ポイント)\s*$/m, '')
    .trim();
  const normalizedSection = normalizeBuyingPointLines(sectionBody, data);

  return isOverseas
    ? `${before}\n\n${requiredHeading}\n\n${normalizedSection}`.trim()
    : `${before}\n\n${requiredHeading}\n\n${normalizedSection}\n\n${REQUIRED_TODAY_RACE_CTA}`.trim();
}

function ensureH2HeadingsHaveNumbers(content: string): string {
  return content.replace(/^##\s+(.*)$/gm, (full, headingText) => {
    const heading = String(headingText || '').trim();
    if (isPointHeadingText(heading)) return full;
    if (heading === 'まとめ' || heading === '総論' || heading === 'おわりに') {
      return '## 買い目を決める前に確認する材料';
    }
    if (/\d/.test(heading)) return full;
    if (heading.includes('AI偏差値')) return '## AI偏差値上位と買い方の優先順';
    if (heading.includes('騎手')) return '## 騎手データで評価を分ける材料';
    if (heading.includes('コース')) return '## コース特性と当日の確認順';
    return full;
  });
}

function ensureNumberInOpening(content: string, data: Record<string, any>): string {
  const plainText = content.replace(/\s/g, '');
  if (/\d/.test(plainText.slice(0, 100))) return content;

  const target = compactForTitle(data.target_keyword || data.title || 'この条件');
  return `${target}では、まず3つの数字を順に確認すると買い目の優先順位を決めやすい。\n\n${content}`;
}

function bodyPlainLength(content: string): number {
  return content.replace(/\s/g, '').length;
}

function hasHeading(content: string, heading: string): boolean {
  const escaped = heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`^##\\s+${escaped}\\s*$`, 'm').test(content);
}

function insertBeforeFinalPointSection(content: string, insertion: string): string {
  const headingIndex = findLastBuyingPointHeading(content);
  if (headingIndex < 0) {
    return `${content.trim()}\n\n${insertion.trim()}`.trim();
  }

  const before = content.slice(0, headingIndex).trim();
  const after = content.slice(headingIndex).trim();
  return `${before}\n\n${insertion.trim()}\n\n${after}`.trim();
}

function lengthExpansionBlocks(data: Record<string, any>): string[] {
  const theme = String(data.theme_cluster || data.article_type || '');
  const target = compactForTitle(data.target_keyword || data.title || 'このレース');
  const genericBlocks = [
    `## 出馬表で使う3つの順番\n\n${target}を見る時は、最初に表の数字、次に当日の条件、最後に人気との釣り合いを確認する。数字が強い条件でも、当日の馬場や枠順が合わなければ軸にはしにくい。反対に数字が控えめでも、少頭数、内外の伸び、先行馬の少なさなどが重なれば、相手候補として残す理由になる。\n\n出馬表では、馬の能力だけでなく、どの位置から競馬を進めるかを見たい。逃げ先行が多い時は差し馬の届く条件を確認し、前が楽になりそうな時は内外のロスを見直す。数字をそのまま買うのではなく、当日の隊列に置き換えると、買いと見送りの線を引きやすくなる。`,
    `## 数字を疑う2つの条件\n\n1つ目は母数が少ないケースだ。勝率や回収率が高く見えても、対象レースが少ない場合は偶然の影響を受けやすい。そうした数字は軸の決め手ではなく、相手候補を広げる材料として扱う。2つ目は人気とのズレが大きいケースだ。数字が良くても人気が過度に集まっているなら、買い目の中心に置く前に馬場や脚質の裏付けを確認したい。\n\n数字を疑うことは、データを軽視することではない。数字が強い理由を出馬表で確認し、説明できる時だけ重く扱う。説明できない数字は抑えまでに留め、当日の条件が合う馬を優先する。これだけでも、買い目の広げすぎを避けやすくなる。`,
    `## オッズを見る前の3つの線引き\n\nオッズを見る前に、買い、抑え、見送りの線を先に置く。買いは、データと当日の条件がそろう馬に限る。抑えは、どちらか一方に強い材料がある馬にする。見送りは、数字が弱い、条件が合わない、人気だけが先行している馬に付ける。この線引きを先に作ると、直前に人気が動いても判断を戻しやすい。\n\nオッズは最後の調整材料として使う。買いに入れた馬が想定以上に売れているなら、点数を絞る。抑えの馬が売れていないなら、相手候補として残す価値がある。見送りにした馬は、明確な条件変化が出ない限り買い目へ戻さない。こうした順番を守ると、データ記事を実際の馬券検討に使いやすくなる。`,
    `## 条件が変わる日の2つの見直し\n\n同じ数字でも、当日の条件が変われば扱い方は変わる。まず見直したいのは馬場だ。良馬場で残っていた傾向が、雨や乾きかけの馬場でも同じとは限らない。時計が速い日は位置取りを重く見て、力のいる馬場では最後まで脚を使えるタイプを残す。次に見るのは頭数と隊列だ。少頭数なら外を回すロスが小さくなり、多頭数なら内で包まれるリスクや外を回される距離ロスが大きくなる。\n\nこの見直しを入れると、表の数字をそのまま使う場面と、当日の条件で評価を調整する場面を分けられる。数字が強い馬でも、条件が反対に出るなら相手までに下げる。数字が控えめな馬でも、馬場や隊列が向くなら買い目に残す理由ができる。`,
    `## 人気と評価を分ける3つのメモ\n\n人気を確認する前に、評価の理由を短く残しておく。1つ目はデータで評価する理由、2つ目は当日の条件で評価を上げる理由、3つ目は評価を下げる理由だ。買い目を決める直前は情報が増えやすく、人気の動きだけで判断が揺れやすい。先にメモを作っておくと、人気が上がった馬をそのまま買うのか、相手までに留めるのかを落ち着いて分けられる。\n\n評価を上げる理由がデータだけなら、馬場や脚質の確認を残す。評価を上げる理由が当日の条件だけなら、過去データとの相性を確認する。評価を下げる理由が複数ある馬は、人気が落ちても無理に戻さない。この順番なら、検索で記事を読んだ後に出馬表へ移った時も、確認する場所がはっきりする。`,
    `## 最後に確認する2つのズレ\n\n最後に見るのは、データ評価と当日の見え方のズレだ。データで評価できる馬が、出馬表では不利な枠や苦しい隊列になっていないかを確認する。反対に、データだけでは強く見えない馬でも、当日の馬場や相手関係で走りやすい形になっていないかを見る。この2つを分けると、買い目を増やす理由と減らす理由が自然に整理される。\n\nもう1つは、人気と評価のズレだ。評価を上げる材料があるのに人気が控えめなら、相手候補として残す余地がある。評価を下げたい条件があるのに人気が集まるなら、軸には置かず抑えまでにする。検索で記事を読んだ後は、このズレを出馬表で確認してから買い目を決めたい。`,
  ];

  if (theme === 'grade_race_preview') {
    return [
      `## 直前に見る3つの材料\n\n${target}で最初に切り分けたいのは、枠順、馬場、脚質の3点だ。枠順は内外の距離ロスと位置取りに直結し、馬場は同じ脚質でも評価を変える材料になる。脚質は展開予測そのものではなく、出馬表で「無理なく前を取れるか」「差しに回った時に届く条件があるか」を確認するために使う。\n\nここで大切なのは、1つの材料だけで評価を決めないことだ。内枠でも包まれやすい馬なら軸にしにくく、外枠でも先行力があれば不利を補える。馬場が速い日は位置取りを重く見て、時計がかかる日は持続力と騎手の判断を見直す。AI予想を見る時も、偏差値の順位だけではなく、なぜその馬が上に来ているのかを枠順と脚質で確かめると、買い目を広げる理由と削る理由が分かれやすい。`,
      `## 人気馬を疑う2つの条件\n\n人気馬を評価する時は、強いか弱いかではなく、人気ほど条件がそろっているかを見たい。1つ目は、前走内容と今回条件のズレだ。前走で楽に運べた馬が、今回は外を回される形や速い流れに巻き込まれる形になるなら、同じ評価をそのまま置きにくい。2つ目は、馬場と脚質のかみ合わせだ。差し馬が人気を集める時でも、当日の内が残る馬場なら、相手候補までに留める判断が現実的になる。\n\n反対に、人気薄でも条件がかみ合う馬は残す余地がある。派手な実績がなくても、枠順でロスを抑えられる、先行馬が少なく隊列を取りやすい、馬場替わりで前走より走りやすい、といった材料が重なるなら、買い足す理由になる。人気そのものを嫌うのではなく、人気と条件の釣り合いを見ることが、直前の判断では一番ぶれにくい。`,
      `## 買い足す前の確認順\n\n買い目を増やす前は、まず軸候補を増やすのか、相手候補だけを広げるのかを分ける。軸候補を増やすなら、枠順、脚質、馬場のうち少なくとも2つで納得できる材料がほしい。相手候補なら、どれか1つの材料が強く、展開が向いた時に届く理由があれば残せる。ここを分けないまま広げると、人気馬も穴馬も同じ重さで買ってしまい、レース後に判断の根拠が残りにくい。\n\n当日はオッズだけで判断を変えすぎないことも大事だ。オッズが下がった馬は、買い材料が増えたのか、話題性だけで売れたのかを出馬表で確認する。オッズが上がった馬は、評価を落とす理由が出たのか、単に見落とされているのかを馬場と枠順で見直す。最後はAI予想の印と自分の確認順を重ね、買う理由が説明できる馬だけを残す。`,
    ].concat(genericBlocks);
  }

  if (theme === 'news_context') {
    return [
      `## ニュース後に確認する3つの順番\n\n${target}のようなニュース起点の記事では、話題になった内容をそのまま馬券評価へつなげない。最初に見るのは、出馬表で確認できる事実だ。出走予定、枠順、騎手、斤量、馬場発表のように、当日の判断へ直接つながる材料を先に並べる。次に、その材料がどの脚質に向くかを確認する。最後にAI予想とオッズを見て、条件がそろっている馬と話題だけが先に出ている馬を分ける。\n\nニュースは入口として役に立つが、評価の中心は出馬表に置く。話題性が高い馬でも、枠順や馬場が合わなければ軸にはしにくい。反対に大きく報じられていない馬でも、当日の条件が合えば相手候補として残せる。ニュースを読む目的は、答えを決めることではなく、出馬表で見る順番をはっきりさせることだ。`,
      `## 話題性と馬券評価を分ける2点\n\n1点目は、確認された事実と推測を混ぜないことだ。発表済みの情報は判断材料になるが、その情報から勝率や回収率を新しく作ることはできない。本文で扱う数字は、入力データにあるものだけに留め、数字がない材料は「どこを確認するか」という形で整理する。2点目は、話題の強さとオッズの動きを分けることだ。話題が大きいほど人気に寄りやすく、条件がそろっていない馬まで売れることがある。\n\n馬券検討では、話題性を消す必要はない。ただし、買い目に入れる前に、枠順、脚質、馬場、騎手変更のどこに買う理由があるかを言葉にできる状態にしたい。理由がニュース本文だけに寄っているなら、相手候補までに抑える。出馬表の条件とも合うなら、AI予想の評価を確認してから重さを調整する。`,
      `## 当日の出馬表で残す3つのメモ\n\n当日の出馬表を見る時は、まず逃げ先行の数を確認する。前に行く馬が多いなら差し馬の届く余地を見て、少ないなら前で運べる馬の評価を上げる。次に馬場状態を見る。良馬場でも内外の伸びは開催日によって変わるため、直前のレースでどの位置が走りやすいかを確認したい。最後にAI予想の印と人気を照らし合わせる。\n\nこの3つを順番に見ると、ニュースで気になった馬を過大評価しにくい。買いは条件が複数そろう馬、抑えは1つの材料が強い馬、見送りは話題だけで人気が上がった馬に分ける。判断をラベルで残しておくと、レース直前に買い足す時も迷いが少なくなる。`,
    ].concat(genericBlocks);
  }

  if (theme === 'race_update') {
    return [
      `## ニュース後に見る3つの順番\n\n${target}では、まずニュースで触れられた材料を出馬表で確認できる形に置き換える。1つ目は枠順と位置取りだ。発表内容が前向きでも、外を回される形になれば評価は変わる。2つ目は馬場状態で、時計が速いか、力のいる馬場かによって残す脚質が変わる。3つ目はAI予想とオッズの差で、評価が高いのに人気が落ちている馬は相手候補として見直せる。\n\nこの順番にすると、話題性だけで買い目を増やす流れを避けやすい。枠順が合わない馬は抑えまで、馬場が合う馬は評価を上げる、AI予想と人気が大きくずれる馬は理由を確認する。直前の更新情報は便利だが、最後は出馬表の条件に戻して判断するのが安定する。`,
      `## 買い足す前に分ける2つの線\n\n買い足すかどうかは、軸候補と相手候補を分けて考える。軸候補にするなら、発表内容だけでなく、枠順、脚質、馬場のうち複数の材料がそろっている必要がある。相手候補なら、展開が向いた時に浮上する理由が1つあれば残せる。どちらの扱いにするかを決めてからオッズを見ると、人気の動きに引っ張られにくい。\n\n評価を下げる線も先に決めておきたい。話題の馬が不利な枠に入った、先行馬が多く自分の形に持ち込みにくい、馬場が想定と違う。このような条件が出た時は、無理に軸へ置かず相手までに留める。逆に人気が落ちていても条件が合う馬は、買い目の厚みを作る候補になる。`,
      `## 直前判断で残す3つのメモ\n\nレース直前は情報が増えるほど判断が散らばりやすい。残すメモは3つに絞ると見返しやすい。まず「買い」は、出馬表とAI予想の両方で評価できる馬に付ける。次に「抑え」は、条件の一部が強い馬に付ける。最後に「見送り」は、話題性や人気ほど条件がそろっていない馬に付ける。\n\nこのメモを作ってから買い目を見ると、点数を増やす理由が明確になる。人気馬を信じる場合も、人気薄を拾う場合も、どの材料で評価したのかを残しておけば、次回の見直しにも使える。レース前の更新情報はその場限りにせず、出馬表で確認する順番へ落とし込むことが大事だ。`,
    ].concat(genericBlocks);
  }

  return genericBlocks;
}

function ensureMinimumBodyLength(content: string, data: Record<string, any>): string {
  const targetLength = SEO_RULES.min_word_count + 120;
  let result = content.trim();
  if (bodyPlainLength(result) >= SEO_RULES.min_word_count) return result;

  for (const block of lengthExpansionBlocks(data)) {
    const heading = block.match(/^##\s+(.+)$/m)?.[1]?.trim();
    if (heading && hasHeading(result, heading)) continue;

    result = insertBeforeFinalPointSection(result, block);
    if (bodyPlainLength(result) >= targetLength) break;
  }

  return result;
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

  data.title = fitTitleToSeo(beforeTitle, data, content);
  data.description = fitDescriptionToSeo(beforeDescription, { ...data, title: data.title });

  content = sanitizeGeneratedText(content);
  content = unwrapDisallowedLinks(content);
  content = normalizeBuyingPointSection(content, data);
  content = ensureH2HeadingsHaveNumbers(content);
  content = ensureNumberInOpening(content, data);
  // ensureMinimumBodyLength(content, data) はAIライター側の Gemma 補強に任せるため廃止
  content = normalizeBuyingPointSection(content, data);
  content = ensureH2HeadingsHaveNumbers(content);
  content = sanitizeGeneratedText(content);

  if (data.title !== beforeTitle) changes.push('titleをSEO文字数内に補正');
  if (data.description !== beforeDescription) changes.push('descriptionをSEO文字数内に補正');
  if (content !== beforeContent) changes.push('本文のNG語・リンク・末尾CTA・文字数を補正');

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
・1文目に核心データと、読者が最初に確認すべき材料が含まれているか
・見出しに数字と結論が含まれているか（最後の「このコースの買い目ポイント」「このレースの買い目ポイント」「このニュースの確認ポイント」は例外）
・「まとめ」や「総論」などの見出しが存在しないか
・記事末尾にテーマに応じた確認ポイント見出しがあり、最後に「最新の出馬表とAI予想は [今日のAI予想・出馬表](/races/today) で無料公開中。」が自然に入っているか
・チェックマークやバツ印などの装飾記号、煽りの強い「最強」「圧倒的」「狙い撃つ」「買うな」「消去対象」が残っていないか
・重賞記事は、人気馬を煽るだけでなく「疑う条件」「買い足す条件」「見送る条件」が分かれているか
・平場向け記事は、短時間で複数レースを見る読者が使える初期判断になっているか
・Gemma複数観点レビューが付いている場合は、検索意図、本文の厚み、トーン・事実性の指摘を優先順に反映すること
・文字数不足を補うために、勝率、回収率、枠順別成績、斤量別成績などの新しい数値を作らないこと
STEP 3：フォーマットとSEOのチェック
・タイトルの文字数（30〜50文字）と構成
・ディスクリプションの文字数（120〜160文字）
※過去の集計年（2024年など）と「最新」という単語を近接させて混同した表記（例：【2024年最新】、【2025年最新】など）は機械チェックで即却下されるため【絶対に禁止】する。タイトル、ディスクリプション、本文冒頭でこのような混同表現を見つけた場合は必ず削除・修正すること。
※代わりに、集計期間であることを明示した代替許容表現（例：【2024年データ分析】、【2024年集計】、2024年実績、など）に書き換えること。
※もし「事前の機械チェック結果」でエラーが指摘されている場合は、必ずそれを満たすようにtitleとdescriptionを修正すること。
※関連記事プレースホルダーは要求しない。本文中に「関連記事」セクションや「[関連記事：...]」は追加しないこと。
※存在確認できないURL、仮URL、単独行の「(/course-xxx)」のような壊れたリンク片は必ず削除すること。
※本文を長くしすぎない。必要な修正だけ行い、表・数値・母数・期間は壊さないこと。
※本文が3,000字未満の場合は、入力にある材料だけで「確認順」「疑う条件」「買い足す前の線引き」を補う。数字を増やせない場合は、数字を作らず判断プロセスを具体化すること。

【JSON出力フォーマット】
以下のJSONスキーマに従って出力する。Markdownのコードブロックなどは含めず、純粋なJSON文字列のみを出力すること。
{
  "status": "APPROVED" | "REJECTED",
  "log": "編集確認の所感やエラー理由の一言メモ",
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
※修正不要な要素（fixed_frontmatter や content_replacements）は空または省略してよい。

【極秘指示】
元の原稿に含まれているデータテーブル（| で構築された表）およびリスト要素に対する修正は確実な理由がない限り行わないこと。表自体を削除・破壊してはならない。`;

function isRetryableGeminiError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error || '');
  return /429|503|quota|rate limit|resource exhausted|too many requests|service unavailable|high demand|overloaded|unavailable|timeout/i.test(message);
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
    instruction: '検索流入を増やす観点で、title/description/H2/冒頭が検索意図に合うかを確認する。ロングテール語は自然に本文へ入るものだけ提案する。',
  },
  {
    id: 'depth',
    label: '本文深掘りレビュー',
    instruction: '3,000字以上でも薄く見えないよう、入力データだけで深掘りできる確認順、疑う条件、買い足す前の線引きを提案する。',
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

export async function reviewDraft(filePath: string): Promise<{ status: 'APPROVED' | 'REJECTED'; log: string, newDraftPath?: string; retryable?: boolean; apiKeyInvalid?: boolean }> {
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
      // 全アテンプト共通: high (gemini-3.5-flash, RPD:20) → medium (gemini-3-flash-preview, RPD:20) → low/lite (gemini-3.1-flash-lite, RPD:500) の順で試行。
      // 上位モデルが 503/429/クォータ超過の場合に限り次のモデルへ自動フォールバック。Lite は最終手段。
      const currentModelTiers = modelTiers;
      const preAttemptRepair = autoRepairDraftMarkdown(currentContent);
      if (preAttemptRepair.changes.length > 0) {
        currentContent = preAttemptRepair.content;
        allLogs += `\n[Attempt ${attempt} Auto Repair Before AI]\n - ${preAttemptRepair.changes.join('\n - ')}\n`;
      }

      const seoResult = checkSEO(currentContent);
      const mechanicalLog = seoResult.passed
        ? "機械チェック（文字数・NGワード等）：エラーなし"
        : `機械チェックエラー（以下の違反を必ず修正すること）:\n - ${seoResult.errors.join('\n - ')}`;

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

      const basePrompt = `${parseWarning}以下のドラフト記事（Markdown）を編集確認する。\n\n【事前の機械チェック結果】\n${mechanicalLog}${gemmaReviewSection}\n\n\`\`\`markdown\n${currentContent}\n\`\`\``;

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

      // JSONを適用して content を更新
      const parsedMatter = matter(currentContent);
      if (parsedJson.fixed_frontmatter) {
        if (parsedJson.fixed_frontmatter.title) parsedMatter.data.title = parsedJson.fixed_frontmatter.title;
        if (parsedJson.fixed_frontmatter.description) parsedMatter.data.description = parsedJson.fixed_frontmatter.description;
      }

      let tmpContent = parsedMatter.content;
      let replacementFailed = false;
      let hasCriticalFailed = false;
      const evidenceNumbers = extractNumbersFromEvidence(parsedMatter.data);

      if (parsedJson.content_replacements && Array.isArray(parsedJson.content_replacements)) {
        for (const rep of parsedJson.content_replacements) {
          if (rep.original && rep.fixed !== undefined) {
            // 暴走したAIが差分パッチを利用して表を壊そうとした場合はプログラム側で防御
            if (rep.original.includes('| ---') || rep.original.includes('| :---') || rep.original.includes('--- |')) {
              allLogs += `\n[Editor Protective] AIが表(\`| --- \`)を置換・削除しようとしたため、プログラムが強制ブロックしました。\n`;
              continue;
            }

            // fixed側の数値ハルシネーションチェック
            const hallucinationCheck = checkFixedValueHallucination(rep.fixed, evidenceNumbers);
            if (hallucinationCheck.hasHallucination) {
              replacementFailed = true;
              hasCriticalFailed = true;
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
      const lastHasCriticalFailed = hasCriticalFailed;
      if (postPatchSeo.passed && parsedJson.status === 'APPROVED' && !hasCriticalFailed) {
        finalStatus = 'APPROVED';
        allLogs += `\n[Attempt ${attempt}] SEO Passed. APPROVED (No Critical replacement failures). Cosmetic Failed Allowed: ${replacementFailed && !hasCriticalFailed}\n`;
        break; // 合格
      } else {
        allLogs += `\n[Attempt ${attempt}] AI status was ${parsedJson.status}. Post-patch SEO passed: ${postPatchSeo.passed}. Replacement Failed: ${replacementFailed}, Critical Failed: ${hasCriticalFailed}`;
        if (postPatchSeo.passed && parsedJson.status !== 'APPROVED') {
          allLogs += `\n[Attempt ${attempt}] SEOは通過しましたが、AI Editorが承認していないため公開承認しません。`;
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
      if (finalSeo.passed && !sawEditorJsonParseFailure && lastParsedEditorStatus === 'APPROVED' && !lastReplacementFailed) {
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
      const approvedDir = path.join(__dirname, '..', '..', 'agents', 'queue', 'approved');
      fs.mkdirSync(approvedDir, { recursive: true });
      newDraftPath = path.join(approvedDir, path.basename(filePath));

      fs.writeFileSync(newDraftPath, currentContent, 'utf-8');
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
      console.log(`[Editor] Draft APPROVED. Saved to: ${newDraftPath}`);

      // posted_history.json に追記
      try {
        const historyPath = path.join(__dirname, '..', '..', '..', 'data', 'posted_history.json');
        const dataDir = path.dirname(historyPath);
        if (!fs.existsSync(dataDir)) { fs.mkdirSync(dataDir, { recursive: true }); }
        const history = fs.existsSync(historyPath) ? JSON.parse(fs.readFileSync(historyPath, 'utf-8')) : [];
        const parsed = matter(currentContent);
        history.push({
          id: path.basename(filePath, '.md'),
          title: parsed.data.title || '',
          target_keyword: parsed.data.target_keyword || '',
          theme_cluster: parsed.data.theme_cluster || '',
          keywords: parsed.data.keywords || [],
          posted_at: new Date().toISOString(),
          draft: true,
          // 施策G: 収益ポテンシャルスコア（Phase 4/6で自動入力）
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

    return { status: finalStatus, log: allLogs, newDraftPath };

  } catch (error: any) {
    console.error(`[Editor Error] ${error.message}`);
    const apiKeyInvalid = isApiKeyInvalidError(error);
    return {
      status: 'REJECTED',
      log: `エラーにより検証失敗: ${error.message}`,
      retryable: !apiKeyInvalid && (error instanceof GeminiQuotaExceededError || isRetryableGeminiError(error)),
      apiKeyInvalid,
    };
  }
}
