import matter from 'gray-matter';

export const SEO_RULES = {
  title_min_chars: 30,
  title_max_chars: 50,
  description_min_chars: 120,
  description_max_chars: 160,
  min_word_count: 2000,
  require_today_race_cta: true,
  require_buying_point_heading: true,
  require_data_table_or_list: true,
  require_number_in_all_h2: false,
  require_number_in_some_h2: true,
  require_number_in_first_100_chars: true,
  hard_banned_strings: [
    "いかがでしたか",
    "ぜひ参考にしてください",
    "最後まで読んでいただき",
    "必勝",
    "投資",
    "資金配分",
    "期待値",
    "絶対に当たる",
    "絶対的",
    "絶対条件",
    "絶対",
    "完全攻略",
    "最強",
    "買うな",
    "圧倒的",
    "圧倒",
    "狙い撃つ",
    "消去対象",
    "完全に除外",
    "儲かる",
    "儲か",
    "稼げ",
    "爆益",
    "買えば",
    "勝てる",
    "封殺",
    "叩き出",
    "爆発力",
    "断言",
    "論証",
    "解明",
    "大きなる",
    "暴利設定",
    "馬券購入的価値",
    "利益へ変換",
    "プロやAIシステム",
    "✅",
    "❌",
    // 導入テンプレート
    "と思っていませんか",
    "この記事をお読みいただければ",
    "オカルトや個人の感覚ではなく",
    "曖昧な勘に頼るのではなく",
    // AI手癖
    "結論から言うと",
    "興味深いことに",
    "と言えるでしょう",
    "独自の分析スクリプトで解析",
    "膨大なレースデータを徹底的に解析",
    "https://uma-free.jp",
  ],
};

export interface SEOCheckResult {
  passed: boolean;
  errors: string[];
}

function collectMarkdownLinks(content: string): string[] {
  const links: string[] = [];
  const linkPattern = /!?\[[^\]]*]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;
  let match: RegExpExecArray | null;

  while ((match = linkPattern.exec(content)) !== null) {
    links.push(match[1].replace(/^<|>$/g, ''));
  }

  return links;
}

function normalizeInternalHref(href: string): string | null {
  if (!/^https?:\/\//.test(href)) return href;

  try {
    const url = new URL(href);
    if (url.hostname === 'uma-free.com' || url.hostname === 'www.uma-free.com') {
      return `${url.pathname}${url.search}${url.hash}`;
    }
    return null;
  } catch {
    return href;
  }
}

export function checkSEO(markdownText: string): SEOCheckResult {
  const errors: string[] = [];
  let parsed;

  try {
    parsed = matter(markdownText);
  } catch (e) {
    return { passed: false, errors: ['Frontmatterのパースに失敗しました。Markdownの形式を確認してください。'] };
  }

  const { data, content } = parsed;
  
  // 空文字はエラー
  if (!content || content.trim() === '') {
    return { passed: false, errors: ['本文が空です。'] };
  }

  // 1. タイトルチェック
  const title = (data.title || '').toString();
  if (title.length < SEO_RULES.title_min_chars) {
    errors.push(`title文字数が不足: 現在${title.length}文字 (最小: ${SEO_RULES.title_min_chars})`);
  }
  if (title.length > SEO_RULES.title_max_chars) {
    errors.push(`title文字数が超過: 現在${title.length}文字 (最大: ${SEO_RULES.title_max_chars})`);
  }
  // Title Format Check: requires at least some numbers and a specific pattern (simplified to checking for numbers for now)
  if (!/\d/.test(title)) {
    errors.push(`titleに数字が含まれていません。(構成ルール: 競馬場/条件＋重要な数字＋読者が取る判断)`);
  }

  // 2. ディスクリプションチェック
  const description = (data.description || '').toString();
  if (description.length < SEO_RULES.description_min_chars) {
    errors.push(`description文字数が不足: 現在${description.length}文字 (最小: ${SEO_RULES.description_min_chars})`);
  }
  if (description.length > SEO_RULES.description_max_chars) {
    errors.push(`description文字数が超過: 現在${description.length}文字 (最大: ${SEO_RULES.description_max_chars})`);
  }
  if (description && !/[。.!?！？]$/.test(description.trim())) {
    errors.push(`descriptionが文末記号で終わっていません。検索結果で未完文に見えないよう、1文として閉じてください。`);
  }
  if (/[、,]$|(?:し|照らし|比較し|整理し|確認し)$/.test(description.trim())) {
    errors.push(`descriptionが途中で切れている可能性があります。title/descriptionは検索結果で自然に読める文にしてください。`);
  }

  // 3. 文字数（スペース改行を除くおおまかな文字数）
  const plainText = content.replace(/\s/g, '');
  if (plainText.length < SEO_RULES.min_word_count) {
    errors.push(`本文の文字数が不足: 現在${plainText.length}文字 (最小: ${SEO_RULES.min_word_count})`);
  }

  // 4. レースページへの自然な内部導線
  // 関連記事はフロント側で自動表示するため、本文内の[関連記事：...]プレースホルダーは要求しない。
  if (SEO_RULES.require_today_race_cta && !content.includes('/races/today')) {
    errors.push(`今日のAI予想・出馬表への内部リンクがありません。記事末尾に /races/today への自然な導線を含めてください。`);
  }

  if (SEO_RULES.require_buying_point_heading && !/^##\s+このコースの買い目ポイント\s*$/m.test(content)) {
    errors.push(`記事末尾のH2「このコースの買い目ポイント」がありません。まとめ見出しではなく、買い目判断の箇条書きで締めてください。`);
  }

  // 5. データテーブルまたはリストの存在
  const hasTable = content.includes('|---|') || content.includes('| --- |') || content.includes('|-');
  const hasList = /^[-*・]/m.test(content.replace(/^[ \t]+/gm, '')) || /^\d+\./m.test(content.replace(/^[ \t]+/gm, ''));
  if (SEO_RULES.require_data_table_or_list && !hasTable && !hasList) {
    errors.push(`データテーブルまたはリストが含まれていません。`);
  }

  // 6. 見出し(H2)チェック
  const h2Regex = /^##\s+(.*)$/gm;
  let match;
  let foundH2 = false;
  let nonBuyingH2Count = 0;
  let numberedNonBuyingH2Count = 0;
  while ((match = h2Regex.exec(content)) !== null) {
    foundH2 = true;
    const h2Text = match[1].trim();
    const isRequiredBuyingPointHeading = h2Text === 'このコースの買い目ポイント';

    if (!isRequiredBuyingPointHeading) {
      nonBuyingH2Count++;
      if (/\d/.test(h2Text)) {
        numberedNonBuyingH2Count++;
      } else if (SEO_RULES.require_number_in_all_h2) {
        errors.push(`H2見出しに数字が含まれていません: 「${h2Text}」`);
      }
    }

    if (h2Text === 'まとめ') {
      errors.push(`「まとめ」というH2見出しが存在します。(作成禁止)`);
    }
    if (h2Text === '総論' || h2Text === 'おわりに') {
      errors.push(`「${h2Text}」というH2見出しが存在します。(作成禁止)`);
    }
  }

  if (!foundH2) {
    errors.push(`H2見出しが存在しません。見出しに数字または具体的な条件を含めてください。`);
  }

  if (SEO_RULES.require_number_in_some_h2 && nonBuyingH2Count > 0 && numberedNonBuyingH2Count === 0) {
    errors.push(`主要H2のうち少なくとも1つには、勝率・距離・枠番などの具体的な数字を含めてください。`);
  }

  // 7. 冒頭100文字以内の数字チェック
  if (SEO_RULES.require_number_in_first_100_chars) {
    const first100 = plainText.substring(0, 100);
    if (!/\d/.test(first100)) {
      errors.push(`本文の冒頭100文字以内に数字が含まれていません。(1文目で核心データを提示してください)`);
    }
  }

  // 8. 記事の末尾チェック（まとめ・総論・戦略の復唱禁止）
  const endingForbiddenPatterns = [
    /鍵となる。?$/,
    /実現する。?$/,
    /ぜひ.*参考に.*$/,
    /見逃せない。?$/,
    /いかがでしたか。?$/,
    /注目だ。?$/,
    /戦略に組み込む/,
    /効率的.*構築/,
    /馬券戦略においては/,
    /回収率向上に繋がる。?$/,
    /積極的に狙うことが/
  ];
  const lastLineMatch = content.trim().match(/([^\n]+)$/);
  if (lastLineMatch) {
    const lastLine = lastLineMatch[1];
    const isForbiddenEnding = endingForbiddenPatterns.some(pattern => pattern.test(lastLine));
    if (isForbiddenEnding) {
      errors.push(`記事の末尾が定型文や過剰な総括で終わっています（「...${lastLine.substring(Math.max(0, lastLine.length - 15))}」）。買い目ポイントと /races/today への自然な導線で締めてください。`);
    }
  }

  // 9. 手動関連記事や壊れたリンク片のチェック
  if (/^##\s+関連記事\s*$/m.test(content)) {
    errors.push(`本文内に手動の「関連記事」セクションがあります。関連記事はページ側で自動表示するため、本文には含めないでください。`);
  }

  if (/^\s*\(\/[^)\s]+\)\s*$/m.test(content)) {
    errors.push(`本文内に壊れたリンク片があります。単独行の「(/course-xxx)」のようなURL片を削除してください。`);
  }

  for (const href of collectMarkdownLinks(content)) {
    if (href.includes('uma-free.jp')) {
      errors.push(`リンクのドメインが古いです: ${href}。正規ドメイン https://uma-free.com を使ってください。`);
      continue;
    }

    const internalHref = normalizeInternalHref(href);
    if (internalHref === null) {
      errors.push(`生成記事内の外部リンクは原則禁止です: ${href}`);
      continue;
    }

    if (!internalHref.startsWith('/')) {
      errors.push(`相対リンクは禁止です: ${href}`);
      continue;
    }

    const pathname = internalHref.split(/[?#]/)[0];
    if (pathname.startsWith('/articles/')) {
      errors.push(`本文内に手動の記事リンクがあります: ${href}。関連記事はページ側で自動表示してください。`);
      continue;
    }

    if (pathname.startsWith('/races/')) {
      if (
        pathname === '/races/today' ||
        /^\/races\/\d{4}-\d{2}-\d{2}$/.test(pathname) ||
        /^\/races\/\d{4}-\d{2}-\d{2}\/[a-z0-9%.-]+\/\d{1,2}$/.test(pathname)
      ) {
        continue;
      }
      errors.push(`レースページへのリンク形式が不正です: ${href}`);
      continue;
    }

    errors.push(`生成記事内で許可されていない内部リンクです: ${href}`);
  }

  // 10. NGワードの完全チェック
  const scanTarget = `${title}\n${description}\n${content}`;
  for (const banned of SEO_RULES.hard_banned_strings) {
    const found = banned === '買うな'
      ? /買うな(?!ら)/.test(scanTarget)
      : scanTarget.includes(banned);

    if (found) {
      errors.push(`title/description/本文にNGワードが含まれています: 「${banned}」`);
    }
  }

  return {
    passed: errors.length === 0,
    errors
  };
}
