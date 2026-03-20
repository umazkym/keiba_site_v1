import matter from 'gray-matter';

export const SEO_RULES = {
  title_min_chars: 30,
  title_max_chars: 36,
  description_min_chars: 120,
  description_max_chars: 140,
  min_word_count: 1500,
  min_internal_link_placeholders: 2,
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
    errors.push(`titleに数字が含まれていません。(構成ルール: 競馬場/条件＋最強数字＋読者が得るもの)`);
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

  // 4. 内部リンクプレースホルダー数
  const linkRegex = /\[関連記事：.*?\]/g;
  const linkMatches = content.match(linkRegex) || [];
  if (linkMatches.length < SEO_RULES.min_internal_link_placeholders) {
    errors.push(`内部リンクプレースホルダー不足: 現在${linkMatches.length}箇所 (最小: ${SEO_RULES.min_internal_link_placeholders})`);
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
      if (!/\d/.test(h2Text)) {
        errors.push(`H2見出しに数字が含まれていません: 「${h2Text}」`);
      }
      if (h2Text === 'まとめ') {
        errors.push(`「まとめ」というH2見出しが存在します。(作成禁止)`);
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
      errors.push(`記事の末尾が定型文や過剰な総略で終わっています（「...${lastLine.substring(Math.max(0, lastLine.length - 15))}」）。戦略の復唱や読者への指示は禁止です。直前のデータの断言のみで唐突に終わらせてください。`);
    }
  }

  // 9. NGワードの完全チェック
  for (const banned of SEO_RULES.hard_banned_strings) {
    if (content.includes(banned)) {
      errors.push(`本文にNGワードが含まれています: 「${banned}」`);
    }
  }

  return {
    passed: errors.length === 0,
    errors
  };
}
