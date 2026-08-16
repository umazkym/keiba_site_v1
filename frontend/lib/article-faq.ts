export type ArticleFaqItem = {
  question: string;
  answer: string;
};

const FAQ_HEADING_PATTERN = /<h2[^>]*>\s*よくある質問\s*<\/h2>/i;
const NEXT_H2_PATTERN = /<h2[^>]*>/i;
const QUESTION_BLOCK_PATTERN = /<h3[^>]*>([\s\S]*?)<\/h3>([\s\S]*?)(?=<h3[^>]*>|$)/gi;

/** FAQのanswerは構造化データではプレーンテキストで渡す必要があるため、タグと実体参照を落とす。 */
function toPlainText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<\/(p|li|div)>/gi, ' ')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * 記事本文のHTMLから「よくある質問」セクションを抽出する。
 *
 * Writerは締めの見出しの直前に `## よくある質問` と `### 質問` を出力する。
 * この形を持たない旧記事では空配列を返し、FAQPage構造化データを出力しない。
 */
export function extractArticleFaqs(contentHtml: string): ArticleFaqItem[] {
  if (!contentHtml) return [];

  const headingMatch = contentHtml.match(FAQ_HEADING_PATTERN);
  if (!headingMatch || headingMatch.index === undefined) return [];

  const afterHeading = contentHtml.slice(headingMatch.index + headingMatch[0].length);

  // 次のH2（締めの「確認したい判断材料」）までがFAQセクション。
  const nextHeadingMatch = afterHeading.match(NEXT_H2_PATTERN);
  const section = nextHeadingMatch && nextHeadingMatch.index !== undefined
    ? afterHeading.slice(0, nextHeadingMatch.index)
    : afterHeading;

  const faqs: ArticleFaqItem[] = [];
  QUESTION_BLOCK_PATTERN.lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = QUESTION_BLOCK_PATTERN.exec(section)) !== null) {
    const question = toPlainText(match[1]);
    const answer = toPlainText(match[2]);
    if (question && answer) {
      faqs.push({ question, answer });
    }
  }

  return faqs;
}
