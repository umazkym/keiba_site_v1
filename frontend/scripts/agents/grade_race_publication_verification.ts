/** 公開処理とは独立して、本番到達性を確認するための小さな検証器。 */
export type GradeRacePublicationVerification = {
  status: 'verified' | 'unverified';
  checks: {
    http200: boolean;
    selfCanonical: boolean;
    bodyPresent: boolean;
    seasonYearPresent: boolean;
    raceNamePresent: boolean;
  };
  reason: string[];
};

export function verifyGradeRacePublicationHtml(
  html: string,
  expectedCanonicalPath: string,
  seasonYear: string,
  raceName: string,
  httpStatus = 200,
): GradeRacePublicationVerification {
  const normalizedPath = expectedCanonicalPath.replace(/\/+$/, '');
  const canonicalMatches = [...html.matchAll(/<link\s+[^>]*rel=["']canonical["'][^>]*href=["']([^"']+)["'][^>]*>/ig)];
  let canonicalUrl: URL | null = null;
  try { canonicalUrl = canonicalMatches.length === 1 ? new URL(canonicalMatches[0][1]) : null; } catch { canonicalUrl = null; }
  const articleMatch = html.match(/<(main|article)\b[^>]*>([\s\S]*?)<\/\1>/i);
  const articleHtml = articleMatch?.[2] || '';
  const articleText = articleHtml.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  const h1Text = (articleHtml.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1] || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const hasArticleH1 = Boolean(raceName) && h1Text.includes(raceName);
  // footerの著作権年ではなく、記事H1またはhead内のtitle/metaに年度があることを確認する。
  const headHtml = html.match(/<head\b[^>]*>([\s\S]*?)<\/head>/i)?.[1] || '';
  const metadataText = [
    ...(headHtml.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.slice(1) || []),
    ...[...headHtml.matchAll(/<meta\b[^>]*\bcontent=["']([^"']+)["'][^>]*>/ig)].map(match => match[1]),
  ].join(' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  const yearPattern = new RegExp(`(?:^|\\D)${seasonYear}(?:\\D|$)`);
  const looksSoft404 = /not found|404|ページが見つかりません|お探しのページ/i.test(articleText);
  const checks = {
    http200: httpStatus === 200,
    selfCanonical: Boolean(normalizedPath && canonicalUrl?.origin === 'https://uma-free.com' && canonicalUrl.pathname.replace(/\/+$/, '') === normalizedPath),
    bodyPresent: articleText.length >= 80 && hasArticleH1 && !looksSoft404,
    seasonYearPresent: yearPattern.test(h1Text) || yearPattern.test(metadataText),
    raceNamePresent: Boolean(raceName) && articleText.includes(raceName),
  };
  const reason = Object.entries(checks)
    .filter(([, passed]) => !passed)
    .map(([name]) => name);
  return { status: reason.length === 0 ? 'verified' : 'unverified', checks, reason };
}

export async function verifyLiveGradeRacePublication(
  url: string,
  expectedCanonicalPath: string,
  seasonYear: string,
  raceName: string,
): Promise<GradeRacePublicationVerification> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);
  try {
    if (new URL(url).origin !== 'https://uma-free.com') throw new Error('unexpected_origin');
    const response = await fetch(url, { redirect: 'manual', signal: controller.signal });
    const html = await response.text();
    return verifyGradeRacePublicationHtml(html, expectedCanonicalPath, seasonYear, raceName, response.status);
  } catch (error) {
    return {
      status: 'unverified',
      checks: { http200: false, selfCanonical: false, bodyPresent: false, seasonYearPresent: false, raceNamePresent: false },
      reason: [`request_failed:${error instanceof Error ? error.message : String(error)}`],
    };
  } finally {
    clearTimeout(timeout);
  }
}
