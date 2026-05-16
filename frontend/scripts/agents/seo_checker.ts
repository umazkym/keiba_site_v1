import matter from 'gray-matter';

export const SEO_RULES = {
  title_min_chars: 30,
  title_max_chars: 40,
  description_min_chars: 120,
  description_max_chars: 140,
  min_word_count: 1500,
  require_today_race_cta: true,
  require_buying_point_heading: true,
  require_data_table_or_list: true,
  require_number_in_all_h2: true,
  require_number_in_first_100_chars: true,
  hard_banned_strings: [
    "いかがでしたか",
    "ぜひ参考にしてください",
    "最後まで読んでいただき",
    "必勝",
    "絶対に当たる",
    "完全攻略",
    "最強",
    "買うな",
    "圧倒的",
    "絶対的",
    "絶対条件",
    "狙い撃つ",
    "消去対象",
    "完全に除外",
    "儲かる",
    "爆益",
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
  ],
};

export interface SEOCheckResult {
  passed: boolean;
  errors: string[];
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
  if (SEO_RULES.require_number_in_all_h2) {
    const h2Regex = /^##\s+(.*)$/gm;
    let match;
    let foundH2 = false;
    while ((match = h2Regex.exec(content)) !== null) {
      foundH2 = true;
      const h2Text = match[1];
      const isRequiredBuyingPointHeading = h2Text.trim() === 'このコースの買い目ポイント';
      if (!isRequiredBuyingPointHeading && !/\d/.test(h2Text)) {
        errors.push(`H2見出しに数字が含まれていません: 「${h2Text}」`);
      }
      if (h2Text === 'まとめ') {
        errors.push(`「まとめ」というH2見出しが存在します。(作成禁止)`);
      }
      if (h2Text === '総論' || h2Text === 'おわりに') {
        errors.push(`「${h2Text}」というH2見出しが存在します。(作成禁止)`);
      }
    }
    
    if (!foundH2) {
      errors.push(`H2見出しが存在しません。見出しに数字と結論を含めてください。`);
    }
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

  // 10. NGワードの完全チェック
  const scanTarget = `${title}\n${description}\n${content}`;
  for (const banned of SEO_RULES.hard_banned_strings) {
    if (scanTarget.includes(banned)) {
      errors.push(`title/description/本文にNGワードが含まれています: 「${banned}」`);
    }
  }

  return {
    passed: errors.length === 0,
    errors
  };
}
