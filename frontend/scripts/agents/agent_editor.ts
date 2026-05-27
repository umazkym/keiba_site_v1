import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { checkSEO, SEO_RULES } from './seo_checker';
import { getGeminiModelTiers } from './model_tiers';
import { GeminiQuotaExceededError, reserveGeminiRequest } from './gemini_quota';

const REQUIRED_BUYING_POINT_HEADING = '## このコースの買い目ポイント';
const REQUIRED_TODAY_RACE_CTA = 'このコースの最新レースは [今日のAI予想・出馬表](/races/today) で無料公開中。';

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
    .replace(/大きく上回るして/g, '上回って');
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

  return repairAwkwardReplacementArtifacts(text)
    .replace(/[ \t]+$/gm, '')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
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

function suffixForTheme(themeCluster: unknown): string {
  switch (String(themeCluster || '')) {
    case 'jockey_data':
      return '勝率と回収率の見方3点';
    case 'grade_race_preview':
      return '枠順と偏差値の見方3点';
    case 'running_style_data':
      return '脚質と展開の見方3点';
    case 'popularity_data':
      return '人気と配当の見方3点';
    case 'waku_data':
    case 'asset':
    case 'seasonal':
      return '枠順の買い方3点';
    default:
      return 'データの見方3点';
  }
}

function fitTitleToSeo(title: string, data: Record<string, any>, content: string): string {
  let result = sanitizeGeneratedText(title).replace(/^["']|["']$/g, '');
  const fallbackBase = compactForTitle(data.target_keyword || result || '競馬データ');
  const suffix = suffixForTheme(data.theme_cluster);
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

function fitDescriptionToSeo(description: string, data: Record<string, any>): string {
  const target = compactForTitle(data.target_keyword || data.title || 'この条件');
  const additions = [
    '勝率、回収率、枠順や騎手の傾向を照らし、買い・抑え・見送りの判断を整理します。',
    '直前に見る数字と条件を分け、出馬表を開く前の確認順序をまとめます。',
    '人気だけに寄せず、評価を上げる場面と下げる場面を確認できます。',
  ];

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
    result = `${target}のデータを整理。勝率、回収率、枠順や騎手の傾向を照らし、買い・抑え・見送りの判断を確認できます。直前に見る数字と条件もまとめます。`;
  }

  return trimDescription(sanitizeGeneratedText(result));
}

function findLastBuyingPointHeading(content: string): number {
  const pattern = /^##\s+このコースの買い目ポイント\s*$/gm;
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
  let result = content
    .replace(/^(?:#{1,6}\s*){0,2}このコースの買い目ポイント\s*$/gm, REQUIRED_BUYING_POINT_HEADING)
    .replace(/^.*\[今日のAI予想・出馬表]\(\/races\/today\).*$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  if (!/^##\s+このコースの買い目ポイント\s*$/m.test(result)) {
    result = `${result}\n\n${REQUIRED_BUYING_POINT_HEADING}\n\n${fallbackBuyingPoints(data).map(point => `- ${point}`).join('\n')}`;
  }

  const headingIndex = findLastBuyingPointHeading(result);
  if (headingIndex < 0) {
    return `${result}\n\n${REQUIRED_TODAY_RACE_CTA}`.trim();
  }

  const before = result.slice(0, headingIndex).trim();
  const sectionWithHeading = result.slice(headingIndex);
  const sectionBody = sectionWithHeading
    .replace(/^##\s+このコースの買い目ポイント\s*$/m, '')
    .trim();
  const normalizedSection = normalizeBuyingPointLines(sectionBody, data);

  return `${before}\n\n${REQUIRED_BUYING_POINT_HEADING}\n\n${normalizedSection}\n\n${REQUIRED_TODAY_RACE_CTA}`.trim();
}

function ensureH2HeadingsHaveNumbers(content: string): string {
  return content.replace(/^##\s+(.*)$/gm, (full, headingText) => {
    const heading = String(headingText || '').trim();
    if (heading === 'このコースの買い目ポイント') return full;
    if (heading === 'まとめ' || heading === '総論' || heading === 'おわりに') {
      return '## 買い方を決める3つの確認順';
    }
    if (/\d/.test(heading)) return full;
    if (heading.includes('AI偏差値')) return '## AI偏差値上位3頭と買い方の優先順';
    if (heading.includes('騎手')) return '## 騎手データで見る3つの判断材料';
    if (heading.includes('コース')) return '## コース特性で見る3つの注意点';
    return `## ${heading}で見る3つの判断材料`;
  });
}

function ensureNumberInOpening(content: string, data: Record<string, any>): string {
  const plainText = content.replace(/\s/g, '');
  if (/\d/.test(plainText.slice(0, 100))) return content;

  const target = compactForTitle(data.target_keyword || data.title || 'この条件');
  return `${target}では、まず3つの数字を順に確認すると買い目の優先順位を決めやすい。\n\n${content}`;
}

function supplementalBlocks(data: Record<string, any>): string[] {
  const target = compactForTitle(data.target_keyword || data.title || 'この条件');
  return [
    `## 直前に見る3つの確認材料\n\n${target}を買う前は、表の勝率だけでなく、騎乗回数や回収率、当日の馬場を分けて見る必要がある。母数が少ない数字は上振れを含みやすいため、人気馬をそのまま軸にするのではなく、同じ条件で安定して馬券圏に残っているかを確認したい。\n\n- 勝率: 軸候補を探すための入口にする\n- 回収率: 配当妙味が残っているかを見る\n- 母数: データの信頼度を測る`,
    `## 買い目へ移す3つの順序\n\n最初に勝率で候補を絞り、次に回収率で人気との釣り合いを見る。最後に枠順、脚質、馬場状態を重ねると、買う理由と見送る理由を分けやすい。数字が高くても人気が集中している場合は、単勝より相手候補に回す判断も必要になる。`,
    `## 出馬表で確認したい3つの条件\n\n同じコース成績でも、当日の頭数やペースで評価は変わる。先行馬が多い日は差し馬の位置取り、少頭数では人気馬の取りこぼしに注意したい。直前の出馬表では、データの順位だけでなく、展開に合う馬がどれかを確認する。`,
    `## 人気を疑う3つの場面\n\n数字が良い条件でも、人気が先に集まっている時は買い目を広げすぎない方がいい。勝率が高い馬や騎手ほどオッズに反映されやすく、配当面の妙味は薄くなる。上位評価をそのまま買うのではなく、相手候補の絞り込みや見送りの判断まで含めて使いたい。`,
    `## 馬場変化で見る3つのズレ\n\n良馬場の成績が中心のデータは、雨や乾きかけの馬場でそのまま使いにくい。時計が掛かる日は先行力、内が荒れる日は外を通せる脚質、乾いて速くなる日は位置取りの速さを重視する。直前の馬場傾向と表の数字を合わせることで、過去データと当日のズレを小さくできる。`,
    `## 最後に残す3つの優先順位\n\n買い目を決める時は、最初に軸候補、次に相手候補、最後に評価を下げる条件を分ける。候補を増やすほど的中の幅は広がるが、根拠の薄い馬まで足すと判断がぼやける。数字で強調されている条件と、当日の出馬表で確認できる材料が重なるところを優先したい。`,
  ];
}

function insertBeforeBuyingPointSection(content: string, block: string): string {
  const headingIndex = findLastBuyingPointHeading(content);
  if (headingIndex < 0) {
    return `${content.trim()}\n\n${block.trim()}`;
  }

  return `${content.slice(0, headingIndex).trim()}\n\n${block.trim()}\n\n${content.slice(headingIndex).trimStart()}`;
}

function ensureMinimumBodyLength(content: string, data: Record<string, any>): string {
  let result = content;
  for (const block of supplementalBlocks(data)) {
    if (result.replace(/\s/g, '').length >= SEO_RULES.min_word_count) break;
    if (!result.includes(block.split('\n')[0])) {
      result = insertBeforeBuyingPointSection(result, block);
    }
  }

  const target = compactForTitle(data.target_keyword || data.title || 'この条件');
  const extraParagraphs = [
    `${target}の数字は、単独で正解を決めるためではなく、出馬表を見る順番を整えるために使う。勝率が高い条件は入口として便利だが、人気が集まれば配当面の妙味は薄くなる。逆に回収率だけが目立つ条件は、母数や馬場の偏りを確認してから相手候補に残したい。`,
    `同じコースでも、開催が進んだ週、雨が残る日、少頭数のレースでは隊列が変わる。過去データの順位をそのまま買い目へ移すのではなく、当日の馬場、脚質の並び、前走内容を重ねることで、数字の使いどころがはっきりする。`,
    `最終的には、買う理由が複数重なる馬だけを中心に残す。勝率、回収率、枠順、騎手のどれか1つだけで強く見える場合は、相手候補までに抑える判断も必要になる。迷った時ほど、評価を上げる条件と下げる条件を分けて確認したい。`,
    `短時間で複数レースを見る場合は、最初から細部を追いすぎないことも大切だ。まず表の上位条件を確認し、次に人気とオッズの偏りを見て、最後に当日の馬場で評価を微調整する。この順序なら、根拠の弱い買い足しを減らしやすい。`,
    `買い目を組む前には、数字が示す強みと、当日の条件で崩れそうな点を分けておく。どちらも説明できる候補だけを残せば、人気や印の雰囲気に流されにくくなる。`,
  ];

  for (const paragraph of extraParagraphs) {
    if (result.replace(/\s/g, '').length >= SEO_RULES.min_word_count) break;
    if (!result.includes(paragraph.slice(0, 24))) {
      result = insertBeforeBuyingPointSection(result, paragraph);
    }
  }

  return result;
}

export function autoRepairDraftMarkdown(markdownText: string): { content: string; changes: string[] } {
  const changes: string[] = [];
  let parsed;

  try {
    parsed = matter(markdownText);
  } catch {
    return { content: markdownText, changes: ['Frontmatterのパースに失敗したため自動補正をスキップ'] };
  }

  const data = { ...parsed.data };
  let content = parsed.content.replace(/\r\n/g, '\n').trim();
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
  content = ensureMinimumBodyLength(content, data);
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
・見出しに数字と結論が含まれているか（最後の「このコースの買い目ポイント」は例外）
・「まとめ」や「総論」などの見出しが存在しないか
・記事末尾に「## このコースの買い目ポイント」があり、最後に「このコースの最新レースは [今日のAI予想・出馬表](/races/today) で無料公開中。」が自然に入っているか
・チェックマークやバツ印などの装飾記号、煽りの強い「最強」「圧倒的」「狙い撃つ」「買うな」「消去対象」が残っていないか
・重賞記事は、人気馬を煽るだけでなく「疑う条件」「買い足す条件」「見送る条件」が分かれているか
・平場向け記事は、短時間で複数レースを見る読者が使える初期判断になっているか
STEP 3：フォーマットとSEOのチェック
・タイトルの文字数（30〜40文字）と構成
・ディスクリプションの文字数（120〜140文字）
※もし「事前の機械チェック結果」でエラーが指摘されている場合は、必ずそれを満たすようにtitleとdescriptionを修正すること。
※関連記事プレースホルダーは要求しない。本文中に「関連記事」セクションや「[関連記事：...]」は追加しないこと。
※存在確認できないURL、仮URL、単独行の「(/course-xxx)」のような壊れたリンク片は必ず削除すること。
※本文を長くしすぎない。必要な修正だけ行い、表・数値・母数・期間は壊さないこと。

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
  return /429|quota|rate limit|resource exhausted|too many requests/i.test(message);
}

export async function reviewDraft(filePath: string): Promise<{ status: 'APPROVED' | 'REJECTED'; log: string, newDraftPath?: string; retryable?: boolean }> {
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

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is not set.");
    }
    const genAI = new GoogleGenerativeAI(apiKey);
    const modelTiers = getGeminiModelTiers('GEMINI_EDITOR_MODEL_TIERS');

    for (let attempt = 1; attempt <= 3; attempt++) {
      console.log(`[Editor] Running AI evaluation (Attempt ${attempt})...`);
      const preAttemptRepair = autoRepairDraftMarkdown(currentContent);
      if (preAttemptRepair.changes.length > 0) {
        currentContent = preAttemptRepair.content;
        allLogs += `\n[Attempt ${attempt} Auto Repair Before AI]\n - ${preAttemptRepair.changes.join('\n - ')}\n`;
      }

      const seoResult = checkSEO(currentContent);
      const mechanicalLog = seoResult.passed
        ? "機械チェック（文字数・NGワード等）：エラーなし"
        : `機械チェックエラー（以下の違反を必ず修正すること）:\n - ${seoResult.errors.join('\n - ')}`;
      const hadMechanicalErrors = !seoResult.passed;

      allLogs += `\n[Attempt ${attempt} Mechanical Check]\n${mechanicalLog}\n`;

      const prompt = `以下のドラフト記事（Markdown）を編集確認する。\n\n【事前の機械チェック結果】\n${mechanicalLog}\n\n\`\`\`markdown\n${currentContent}\n\`\`\``;

      let response: any = null;
      let generateFailed = true;

      for (let i = 0; i < modelTiers.length; i++) {
        const currentModelName = modelTiers[i];
        console.log(`[Editor] Attempt ${attempt} - Trying model: ${currentModelName}`);
        
        const model = genAI.getGenerativeModel({
          model: currentModelName,
          systemInstruction: EDITOR_SYSTEM_PROMPT,
          generationConfig: {
            temperature: 0.1,
            responseMimeType: "application/json"
          }
        });

        try {
          const parsedForQuota = matter(currentContent);
          reserveGeminiRequest({
            scope: 'article',
            model: currentModelName,
            purpose: `editor-attempt-${attempt}`,
            target: parsedForQuota.data.target_keyword || parsedForQuota.data.title,
          });
          response = await model.generateContent(prompt);
          generateFailed = false;
          break; // 成功したら次へ
        } catch (e: any) {
          if (e instanceof GeminiQuotaExceededError) {
            console.error(`[Editor Warning] ${currentModelName} quota guard: ${e.message}`);
            if (e.kind === 'total' || i === modelTiers.length - 1) {
              throw e;
            }
            continue;
          }
          console.error(`[Editor Warning] ${currentModelName} failed: ${e.message}`);
          allLogs += `\n[Editor Warning] ${currentModelName} failed: ${e.message}\n`;
          lastApiErrorMessage = e.message || String(e);
          if (isRetryableGeminiError(e)) {
            retryableApiFailure = true;
          }
        }
      }

      if (generateFailed || !response) {
         allLogs += `\n[Editor Fatal] すべてのモデルでAPIリクエストが失敗しました。\n`;
         if (retryableApiFailure) {
           throw new Error(`Gemini APIの外部制限（クォータ・課金・レート制限等）によりレビューを完了できませんでした。${lastApiErrorMessage}`);
         }
         break;
      }

      const editorText = response.response.text() || '';
      allLogs += `\n[Attempt ${attempt} AI Editor JSON Response]\n${editorText}\n`;

      let parsedJson: any = null;
      try {
        const jsonStr = editorText.replace(/^[^{]*/, '').replace(/[^}]*$/, '').trim();
        parsedJson = JSON.parse(jsonStr);
      } catch (e: any) {
        allLogs += `\n[Editor Fatal] JSONパースフェイル: ${e.message}\n`;
        break; // JSON形式で返してこない場合は即座にアボート
      }

      // JSONを適用して content を更新
      const parsedMatter = matter(currentContent);
      if (parsedJson.fixed_frontmatter) {
        if (parsedJson.fixed_frontmatter.title) parsedMatter.data.title = parsedJson.fixed_frontmatter.title;
        if (parsedJson.fixed_frontmatter.description) parsedMatter.data.description = parsedJson.fixed_frontmatter.description;
      }

      let tmpContent = parsedMatter.content;
      let replacementFailed = false;

      if (parsedJson.content_replacements && Array.isArray(parsedJson.content_replacements)) {
        for (const rep of parsedJson.content_replacements) {
          if (rep.original && rep.fixed !== undefined) {
            // 暴走したAIが差分パッチを利用して表を壊そうとした場合はプログラム側で防御
            if (rep.original.includes('| ---') || rep.original.includes('| :---') || rep.original.includes('--- |')) {
              allLogs += `\n[Editor Protective] AIが表(\`| --- \`)を置換・削除しようとしたため、プログラムが強制ブロックしました。\n`;
              continue;
            }
            const res = applyReplacement(tmpContent, rep.original, rep.fixed);
            if (!res.success) {
              replacementFailed = true;
              allLogs += `\n[Editor Warning] 置換対象が見つかりません: ${rep.original.slice(0, 30)}...\n`;
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
      if (postPatchSeo.passed && (parsedJson.status === 'APPROVED' || hadMechanicalErrors)) {
        finalStatus = 'APPROVED';
        allLogs += `\n[Attempt ${attempt}] SEO Passed. Fully APPROVED. Replacement Failed: ${replacementFailed}\n`;
        break; // 完全合格
      } else {
        allLogs += `\n[Attempt ${attempt}] AI status was ${parsedJson.status}. Post-patch SEO passed: ${postPatchSeo.passed}. Replacement Failed: ${replacementFailed}`;
        if (!postPatchSeo.passed) {
          allLogs += `\n[Attempt ${attempt} Remaining SEO Errors]\n - ${postPatchSeo.errors.join('\n - ')}`;
        }
        allLogs += `\n`;
      }
    }

    if (finalStatus === 'REJECTED') {
      const finalRepair = autoRepairDraftMarkdown(currentContent);
      if (finalRepair.changes.length > 0) {
        currentContent = finalRepair.content;
        allLogs += `\n[Final Auto Repair]\n - ${finalRepair.changes.join('\n - ')}\n`;
      }

      const finalSeo = checkSEO(currentContent);
      if (finalSeo.passed) {
        finalStatus = 'APPROVED';
        allLogs += `\n[Final Auto Repair] SEO Passed. APPROVED without another Gemini request.\n`;
      } else {
        allLogs += `\n[Final Auto Repair] SEO still failed:\n - ${finalSeo.errors.join('\n - ')}\n`;
      }
    }

    if (finalStatus === 'REJECTED') {
      newDraftPath = filePath.replace('.md', '_revised.md');
      fs.writeFileSync(newDraftPath, currentContent, 'utf-8');
      console.log(`[Editor] Draft was REJECTED after retries. Revised draft saved to: ${newDraftPath}`);
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
    return {
      status: 'REJECTED',
      log: `エラーにより検証失敗: ${error.message}`,
      retryable: error instanceof GeminiQuotaExceededError || isRetryableGeminiError(error),
    };
  }
}
