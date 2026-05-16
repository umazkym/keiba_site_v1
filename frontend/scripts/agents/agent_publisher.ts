import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import { execSync } from 'child_process';
import { createHash } from 'crypto';

const APPROVED_DIR = path.join(__dirname, '..', '..', 'agents', 'queue', 'approved');
const ARTICLES_DIR = path.join(__dirname, '..', '..', 'content', 'articles');
const HISTORY_PATH = path.join(__dirname, '..', '..', '..', 'data', 'posted_history.json');

// 施策E: 競馬場名→英語スラグの変換マップ（CTA・ハブ記事でも参照）
const venueMap: Record<string, string> = {
  '福島': 'fukushima', '中山': 'nakayama', '東京': 'tokyo',
  '阪神': 'hanshin', '京都': 'kyoto', '小倉': 'kokura',
  '中京': 'chukyo', '新潟': 'niigata', '札幌': 'sapporo', '函館': 'hakodate'
};

const courseMap: Record<string, string> = {
  '芝': 'turf', 'ダート': 'dirt'
};

const extraMap: Record<string, string> = {
  '枠順': 'waku', 'データ': 'data', '血統': 'blood', '騎手': 'jockey'
};

/**
 * 施策E: target_keyword から競馬場名を抽出する
 */
function extractVenue(targetKeyword: string): string | null {
  for (const venue of Object.keys(venueMap)) {
    if (targetKeyword.includes(venue)) {
      return venue;
    }
  }
  return null;
}

/**
 * target_keyword / title / theme_cluster からカテゴリを自動判定するフォールバック関数
 */
function determineCategory(data: Record<string, any>): string {
  const keyword = (data.target_keyword || '').toLowerCase();
  const title = (data.title || '').toLowerCase();
  const themeCluster = data.theme_cluster || '';
  const combined = `${keyword} ${title}`;

  // theme_clusterベースの判定（最優先）
  if (themeCluster === 'grade_race_preview') return '重賞プレビュー';

  // キーワードベースの判定
  if (combined.includes('枠順') || combined.includes('ダート') || combined.includes('芝'))
    return '枠順データ';
  if (combined.includes('ai予想') || combined.includes('重賞'))
    return '重賞プレビュー';
  if (combined.includes('騎手'))
    return '騎手分析';
  if (combined.includes('初心者') || combined.includes('ガイド') || combined.includes('入門'))
    return '競馬入門';

  return 'データ分析';
}

/**
 * 日本語のキーワードから英語スラグを生成する関数
 */
function generateSlug(targetKeyword: string, date: Date): string {
  const dateStr = date.toISOString().split('T')[0];

  let slug = targetKeyword;
  for (const [ja, en] of Object.entries({ ...venueMap, ...courseMap, ...extraMap })) {
    slug = slug.split(ja).join(en);
  }

  slug = slug
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .toLowerCase()
    .trim();

  if (slug.endsWith('-')) slug = slug.slice(0, -1);
  if (slug.startsWith('-')) slug = slug.slice(1);

  if (!slug) slug = 'article';

  // 日本語レース名は除去後に "2026-ai" のような汎用slugになりやすい。
  // 汎用slugだけで公開すると重賞記事同士で上書き事故が起きるため、短いハッシュを足す。
  const isGenericSlug = slug.length < 12 || /^\d{4}-?ai/.test(slug) || slug === 'article';
  if (isGenericSlug) {
    const hash = createHash('sha1').update(targetKeyword).digest('hex').slice(0, 8);
    slug = `${slug}-${hash}`;
  }

  return `${dateStr}-${slug}`;
}

function resolveUniqueSlug(targetKeyword: string, date: Date): string {
  const baseSlug = generateSlug(targetKeyword, date);
  let slug = baseSlug;
  let suffix = 2;

  while (fs.existsSync(path.join(ARTICLES_DIR, `${slug}.md`))) {
    slug = `${baseSlug}-${suffix}`;
    suffix++;
  }

  return slug;
}

function loadPublishedArticleKeywords(): Set<string> {
  const keywords = new Set<string>();
  if (!fs.existsSync(ARTICLES_DIR)) return keywords;

  for (const file of fs.readdirSync(ARTICLES_DIR).filter(f => f.endsWith('.md'))) {
    try {
      const content = fs.readFileSync(path.join(ARTICLES_DIR, file), 'utf-8');
      const parsed = matter(content);
      if (parsed.data.target_keyword) {
        keywords.add(String(parsed.data.target_keyword));
      }
    } catch {
      // 壊れた記事ファイルは公開処理を止めずにスキップする
    }
  }

  return keywords;
}

function loadHistory(): any[] {
  if (!fs.existsSync(HISTORY_PATH)) return [];
  try {
    const parsed = JSON.parse(fs.readFileSync(HISTORY_PATH, 'utf-8'));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeHistory(history: any[]): void {
  const dataDir = path.dirname(HISTORY_PATH);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  fs.writeFileSync(HISTORY_PATH, JSON.stringify(history, null, 2), 'utf-8');
}

function findHistoryIndex(history: any[], draftId: string, targetKeyword: string): number {
  const idMatch = history.findIndex((h: any) => h.id === draftId);
  if (idMatch !== -1) return idMatch;

  for (let i = history.length - 1; i >= 0; i--) {
    const item = history[i];
    if (item.target_keyword === targetKeyword && item.draft === true && !item.slug) {
      return i;
    }
  }

  return -1;
}

function removeDraftHistory(history: any[], draftId: string, targetKeyword: string): any[] {
  return history.filter((h: any) => {
    if (h.id === draftId) return false;
    if (h.target_keyword === targetKeyword && h.draft === true && !h.slug) return false;
    return true;
  });
}

/**
 * 施策C: ハブ記事（まとめページ）を自動生成・更新する
 *
 * 設計意図:
 * - 検索需要の高い「〇〇競馬場 枠順」に対して、距離別に探しやすい入口を作る
 * - 個別記事への内部リンク構造を強化し、各記事のSEO評価を底上げする
 * - 距離別の有利枠を一覧テーブルで即座に参照でき、ユーザー実用価値を高める
 * - 記事が増えるほど情報密度が増し、自然にコンテンツが充実する
 */
function generateHubArticle(venue: string, history: any[]): void {
  const venueSlug = venueMap[venue];
  if (!venueSlug) return;

  // 同一競馬場かつpublished済み（draft=false, slug存在）の記事をフィルタ
  const venueArticles = history.filter((h: any) =>
    h.target_keyword?.includes(venue) &&
    h.draft === false &&
    h.slug
  );

  // 3件未満なら生成しない（情報密度が不足）
  if (venueArticles.length < 3) {
    console.log(`[Publisher Hub] ${venue}: ${venueArticles.length}件 → ハブ記事生成条件未達（3件以上必要）`);
    return;
  }

  console.log(`[Publisher Hub] ${venue}: ${venueArticles.length}件 → ハブ記事生成開始`);

  // 記事データから距離・コースタイプを解析して一覧テーブルを構築
  const articleEntries: { title: string; slug: string; keyword: string; condition: string }[] = [];
  for (const article of venueArticles) {
    articleEntries.push({
      title: article.title || article.target_keyword,
      slug: article.slug,
      keyword: article.target_keyword,
      condition: article.target_keyword.replace(/ 枠順.*$/, ''),
    });
  }

  // published_at順でソート（古い順）
  articleEntries.sort((a, b) => a.condition.localeCompare(b.condition));

  const now = new Date();
  const updateDate = now.toISOString().split('T')[0];

  const hubFilename = `${venueSlug}-gate-data-hub.md`;
  const hubPath = path.join(ARTICLES_DIR, hubFilename);
  const isUpdate = fs.existsSync(hubPath);

  let originalDate = now.toISOString();
  if (isUpdate) {
    const existingContent = fs.readFileSync(hubPath, 'utf-8');
    const existingParsed = matter(existingContent);
    if (existingParsed.data.date) {
      originalDate = existingParsed.data.date;
    } else if (existingParsed.data.article_published_time) {
      originalDate = existingParsed.data.article_published_time;
    }
  }

  // ハブ記事のFrontmatter（SEOチェッカーを通さない非パイプライン記事だが、品質は担保する）
  const hubTitle = `${venue}競馬場の枠順データ一覧｜有利枠を全距離で比較`;
  const hubDesc = `${venue}競馬場の芝・ダート${articleEntries.length}コースの枠順別データを独自集計。距離ごとの有利枠・不利枠を勝率・複勝率・回収率の3指標で整理した。`;
  const frontmatter = {
    title: hubTitle,
    description: hubDesc,
    keywords: [`${venue}競馬場`, '枠順', 'データ', '有利枠', '競馬'],
    target_keyword: `${venue}競馬場 枠順`,
    article_type: 'hub',
    category: '枠順データ',
    draft: false,
    date: originalDate,
    last_updated: updateDate,
    og_type: 'article',
    og_title: hubTitle,
    og_description: hubDesc,
    article_published_time: originalDate,
  };

  // 記事一覧テーブル
  const tableRows = articleEntries.map(a =>
    `| ${a.condition} | [詳細データを見る](/articles/${a.slug}) |`
  ).join('\n');

  const body = `
${venue}競馬場で開催される各コース・距離ごとの枠順データを独自集計で分析した記事を一覧にまとめた。出馬表を見る前に、コースごとの初期判断を確認できる。

## ${venue}競馬場の枠順データ記事一覧（${articleEntries.length}コース分析済み）

| コース・距離 | 詳細記事 |
| :--- | :--- |
${tableRows}

各記事では過去3年分のレースデータを基に、枠番ごとの勝率・複勝率・単勝回収率を算出し、統計的に有意な偏りを持つ有利枠・不利枠を特定している。

## データの読み方と活用法

上記テーブルの各記事では、以下の3指標を枠番別に集計している。

| 指標 | 意味 | 活用シーン |
| :--- | :--- | :--- |
| 勝率 | 1着になった割合 | 単勝・馬単の軸馬選定 |
| 複勝率 | 3着以内に入った割合 | ワイド・三連複のヒモ選定 |
| 単勝回収率 | 100円購入あたりの払戻目安 | オッズとのズレを確認 |

勝率が高い枠はオッズに既に反映されていることが多い。単勝回収率が高い枠番は、人気よりも走りやすい条件が隠れている可能性があるため、出走馬の脚質や枠順と合わせて確認したい。

最終更新日: ${updateDate}
`;

  const hubContent = matter.stringify(body.trim(), frontmatter);

  fs.writeFileSync(hubPath, hubContent, 'utf-8');
  console.log(`[Publisher Hub] ハブ記事を${isUpdate ? '更新' : '新規生成'}: ${hubFilename}`);
}

async function publishDraft() {
  console.log('=== Publisher Agent Started ===');

  if (!fs.existsSync(APPROVED_DIR)) {
    console.log('[Publisher] Approved directory not found. Exiting.');
    return;
  }

  const files = fs.readdirSync(APPROVED_DIR).filter(f => f.endsWith('.md')).sort();
  if (files.length === 0) {
    console.log('[Publisher] No approved drafts to publish. Exiting.');
    return;
  }

  if (!fs.existsSync(ARTICLES_DIR)) {
    fs.mkdirSync(ARTICLES_DIR, { recursive: true });
  }

  let history = loadHistory();
  const publishedKeywords = loadPublishedArticleKeywords();
  const publishedSlugs: string[] = [];
  const affectedVenues = new Set<string>();
  let skippedCount = 0;

  for (const targetFile of files) {
    const filePath = path.join(APPROVED_DIR, targetFile);
    const content = fs.readFileSync(filePath, 'utf-8');
    const parsed = matter(content);
    const targetKeyword = String(parsed.data.target_keyword || parsed.data.title || 'article');
    const oldId = path.basename(targetFile, '.md');

    if (publishedKeywords.has(targetKeyword)) {
      console.warn(`[Publisher] Skip duplicate approved draft. Already published: ${targetKeyword}`);
      history = removeDraftHistory(history, oldId, targetKeyword);
      fs.unlinkSync(filePath);
      skippedCount++;
      continue;
    }

    const now = new Date();
    const slug = resolveUniqueSlug(targetKeyword, now);
    const newFilename = `${slug}.md`;
    const destPath = path.join(ARTICLES_DIR, newFilename);

    // frontmatterのdraftをfalseにする
    parsed.data.draft = false;

    // 施策F: 日付・OGP・構造化データをFrontmatterに自動付与
    parsed.data.date = now.toISOString();
    parsed.data.og_type = 'article';
    parsed.data.og_title = parsed.data.title;
    parsed.data.og_description = parsed.data.description;
    parsed.data.article_published_time = now.toISOString();
    parsed.data.og_image = `https://uma-free.com/og/${slug}.png`;

    // カテゴリの自動判定フォールバック
    if (!parsed.data.category || parsed.data.category === '未分類') {
      parsed.data.category = determineCategory(parsed.data);
      console.log(`[Publisher] カテゴリを自動判定: ${parsed.data.category}`);
    }

    // 旧プロンプト由来の [関連記事：〇〇] プレースホルダーが混入した場合のみ掃除する。
    // 新規生成では本文中に関連記事を書かず、ページ側の関連記事コンポーネントに任せる。
    const venue = extractVenue(targetKeyword);
    const hubSlug = venue ? `${venueMap[venue]}-gate-data-hub` : null;
    let ctaInserted = false;
    const cleanedContent = parsed.content.replace(/\[関連記事：.*?\]\n?/g, () => {
      if (!ctaInserted && hubSlug) {
        ctaInserted = true;
        return `\n---\n> **同じ競馬場の枠順データを見る**\n> → [${venue}の全記事一覧へ](/articles/${hubSlug})\n`;
      }
      return ''; // 2つ目以降は削除
    });

    // Markdown再シリアライズ
    const finalContent = matter.stringify(cleanedContent, parsed.data);

    // ファイルを Articles ディレクトリへ書き込み
    fs.writeFileSync(destPath, finalContent, 'utf-8');
    console.log(`[Publisher] Published article to: ${destPath}`);

    // 元ファイルを削除
    fs.unlinkSync(filePath);
    console.log(`[Publisher] Removed original approved draft: ${targetFile}`);

    // posted_history.json を更新
    try {
      const idx = findHistoryIndex(history, oldId, targetKeyword);
      if (idx !== -1) {
        history[idx].draft = false;
        history[idx].published_at = now.toISOString();
        history[idx].slug = slug;
        // 施策G: 収益ポテンシャルスコアの初期フィールドを追加
        if (history[idx].estimated_monthly_searches === undefined) {
          history[idx].estimated_monthly_searches = null;
        }
        if (history[idx].actual_pv_30d === undefined) {
          history[idx].actual_pv_30d = null;
        }
        if (history[idx].ad_revenue_30d === undefined) {
          history[idx].ad_revenue_30d = null;
        }
        if (history[idx].rewrite_score === undefined) {
          history[idx].rewrite_score = null;
        }
        console.log(`[Publisher] Updated History for ID: ${history[idx].id}`);
      } else {
        history.push({
          id: oldId,
          title: parsed.data.title || '',
          target_keyword: targetKeyword,
          theme_cluster: parsed.data.theme_cluster || '',
          keywords: parsed.data.keywords || [],
          posted_at: now.toISOString(),
          draft: false,
          published_at: now.toISOString(),
          slug,
          estimated_monthly_searches: null,
          actual_pv_30d: null,
          ad_revenue_30d: null,
          rewrite_score: null,
        });
        console.warn(`[Publisher] History entry was missing, so a published record was created: ${targetKeyword}`);
      }

      if (venue) {
        affectedVenues.add(venue);
      }
    } catch (e) {
      console.error('[Publisher] Error updating posted_history.json', e);
    }

    publishedKeywords.add(targetKeyword);
    publishedSlugs.push(slug);
  }

  writeHistory(history);

  // 施策C: ハブ記事の自動生成/更新
  for (const venue of affectedVenues) {
    generateHubArticle(venue, history);
  }

  console.log('[Publisher] Validating article links before Git commit...');
  execSync('npm run article:validate-links', { stdio: 'inherit' });

  // Git操作 (Actionsでの動作を想定)
  try {
    console.log('[Publisher] Committing changes to Git...');
    execSync('git add .');
    const status = execSync('git status --porcelain').toString();
    if (status.trim().length > 0) {
      const message = publishedSlugs.length === 1
        ? `Auto-publish: ${publishedSlugs[0]}`
        : `Auto-publish: ${publishedSlugs.length} articles`;
      execSync(`git commit -m "${message}"`);
      try {
        execSync('git push origin main');
        console.log('[Publisher] Git push complete!');
      } catch (pushErr: any) {
        console.warn('[Publisher] Git push failed. Please ensure credentials are set if running locally.', pushErr.message);
      }
    } else {
      console.log('[Publisher] No changes to commit.');
    }
  } catch (gitErr: any) {
    console.error('[Publisher] Git operation failed. Skipping...', gitErr.message);
  }

  console.log(`[Publisher] Published: ${publishedSlugs.length}, skipped duplicates: ${skippedCount}`);
  console.log('=== Publisher Agent Completed ===');
}

publishDraft().catch(e => {
  console.error(e);
  process.exitCode = 1;
});
