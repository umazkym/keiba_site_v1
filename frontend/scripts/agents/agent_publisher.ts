import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import { execSync } from 'child_process';
import { createHash } from 'crypto';
import { autoRepairDraftMarkdown } from './agent_editor';
import { checkSourceIndependence } from './seo_checker';

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

const raceNameMap: Record<string, string> = {
  'フェブラリーS': 'february-stakes',
  'フェブラリーステークス': 'february-stakes',
  '高松宮記念': 'takamatsunomiya-kinen',
  '大阪杯': 'osaka-hai',
  '桜花賞': 'oka-sho',
  '皐月賞': 'satsuki-sho',
  '天皇賞(春)': 'tenno-sho-haru',
  '天皇賞春': 'tenno-sho-haru',
  'NHKマイルC': 'nhk-mile-cup',
  'NHKマイルカップ': 'nhk-mile-cup',
  'ヴィクトリアマイル': 'victoria-mile',
  'オークス': 'oaks',
  '優駿牝馬': 'oaks',
  '日本ダービー': 'nihon-derby',
  '東京優駿': 'nihon-derby',
  '安田記念': 'yasuda-kinen',
  '函館SS': 'hakodate-sprint-stakes',
  '函館スプリントS': 'hakodate-sprint-stakes',
  '函館スプリントステークス': 'hakodate-sprint-stakes',
  '宝塚記念': 'takarazuka-kinen',
  'スプリンターズS': 'sprinters-stakes',
  'スプリンターズステークス': 'sprinters-stakes',
  '秋華賞': 'shuka-sho',
  '菊花賞': 'kikuka-sho',
  '天皇賞(秋)': 'tenno-sho-autumn',
  '天皇賞秋': 'tenno-sho-autumn',
  'エリザベス女王杯': 'queen-elizabeth-cup',
  'マイルCS': 'mile-championship',
  'マイルチャンピオンシップ': 'mile-championship',
  'ジャパンカップ': 'japan-cup',
  'チャンピオンズC': 'champions-cup',
  'チャンピオンズカップ': 'champions-cup',
  '阪神JF': 'hanshin-juvenile-fillies',
  '阪神ジュベナイルF': 'hanshin-juvenile-fillies',
  '朝日杯FS': 'asahi-hai-futurity-stakes',
  '朝日杯フューチュリティS': 'asahi-hai-futurity-stakes',
  '有馬記念': 'arima-kinen',
  'ホープフルS': 'hopeful-stakes',
  'ホープフルステークス': 'hopeful-stakes',
  '北九州記念': 'kitakyushu-kinen',
};

const extraMap: Record<string, string> = {
  'AI予想': 'ai-yosou',
  '出走予定': 'entries',
  '出走馬': 'entries',
  '出馬表': 'race-card',
  '枠順確定': 'waku',
  '枠順': 'waku',
  '馬場状態': 'track-condition',
  '馬場': 'track-condition',
  '追い切り': 'training',
  '調教': 'training',
  '騎手変更': 'jockey-change',
  '騎手': 'jockey',
  'データ確認': 'data-check',
  'データ': 'data',
  'ニュース': 'news',
  '無料': 'free',
  '重賞': 'grade-race',
  '血統': 'blood',
};

const jockeyNameMap: Record<string, string> = {
  '武豊': 'yutaka-take',
  'ルメール': 'christophe-lemaire',
  'クリストフ・ルメール': 'christophe-lemaire',
  'C.ルメール': 'christophe-lemaire',
  'Ｃ.ルメール': 'christophe-lemaire',
  '川田将雅': 'yuga-kawada',
  '横山武史': 'takeshi-yokoyama',
  '戸崎圭太': 'keita-tosaki',
  '坂井瑠星': 'rusei-sakai',
  '松山弘平': 'hiroaki-matsuyama',
  '三浦皇成': 'kosei-miura',
  '菅原明良': 'akira-sugawara',
  '岩田望来': 'mirai-iwata',
  '西村淳也': 'atsuki-nishimura',
  '丹内祐次': 'yuji-tannai',
  '横山和生': 'kazuo-yokoyama',
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
  if (themeCluster === 'grade_race_preview') return '重賞攻略';
  if (themeCluster === 'race_update') return '重賞攻略';
  if (themeCluster === 'course_venue') return 'コース分析';
  if (themeCluster === 'jockey_profile') return '騎手分析';
  if (themeCluster === 'beginner_guide') return '入門ガイド';

  // キーワードベースの判定
  if (combined.includes('枠順') || combined.includes('ダート') || combined.includes('芝'))
    return '枠順データ';
  if (combined.includes('ai予想') || combined.includes('重賞'))
    return '重賞攻略';
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
  const replacementEntries = Object.entries({ ...raceNameMap, ...venueMap, ...courseMap, ...extraMap })
    .sort((a, b) => b[0].length - a[0].length);
  for (const [ja, en] of replacementEntries) {
    slug = slug.split(ja).join(en);
  }

  slug = slug
    .replace(/([a-z])(\d{4})/gi, '$1-$2')
    .replace(/(\d{4})([a-z])/gi, '$1-$2')
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

function isGradeRaceDraft(data: Record<string, any>): boolean {
  const combined = `${data.theme_cluster || ''} ${data.category || ''} ${data.target_keyword || ''} ${data.title || ''}`;
  return /grade_race_preview|重賞|G[12]|Ｇ[１２]|ダービー|オークス|記念|ステークス|カップ/u.test(combined);
}

function normalizeGradeRaceKey(value: string): string {
  return value
    .replace(/[０-９]/g, (char) => String.fromCharCode(char.charCodeAt(0) - 0xfee0))
    .replace(/20\d{2}/g, '')
    .replace(/G[123]|Ｇ[１２３]|AI予想|ai予想|無料|攻略|展望|直前|最終|枠順確定後|枠順|前日更新|前日|当日朝更新|当日朝|データ|分析|予想|買い目|ポイント|確認/g, '')
    .replace(/[｜|:：・\s　【】「」『』（）()]/g, '')
    .toLowerCase()
    .trim();
}

function normalizeEntityValue(value: unknown): string {
  return String(value || '').trim().toLowerCase();
}

function normalizeInternalCanonicalPath(value: unknown): string {
  const raw = String(value || '').trim();
  if (!raw.startsWith('/')) return '';
  if (!/^\/(grade-races|courses|jockeys|articles)\//.test(raw)) return '';
  return raw.replace(/\/+$/, '');
}

function inferCourseEntity(text: string): { entityKey: string; entityPath: string } | null {
  for (const [venueName, venueSlug] of Object.entries(venueMap)) {
    const pattern = new RegExp(`${venueName}\\s*(芝|ダート|ダ)\\s*(\\d{3,4})m`);
    const match = text.match(pattern);
    if (!match) continue;

    const courseType = match[1] === '芝' ? 'turf' : 'dirt';
    const courseSlug = `${courseType}-${match[2]}m`;
    return {
      entityKey: `${venueSlug}-${courseSlug}`,
      entityPath: `/articles/courses/${venueSlug}/${courseSlug}`,
    };
  }
  return null;
}

function inferPublishedArticleMetadata(data: Record<string, any>): Record<string, any> {
  const nextData = { ...data };
  if (nextData.entity_type && nextData.entity_key) {
    return nextData;
  }

  const text = `${nextData.target_keyword || ''} ${nextData.title || ''} ${nextData.description || ''}`;

  for (const [raceName, slug] of Object.entries(raceNameMap).sort((a, b) => b[0].length - a[0].length)) {
    if (text.includes(raceName)) {
      nextData.entity_type = 'grade_race';
      nextData.entity_key = slug;
      nextData.entity_path = `/articles/grade-races/${slug}`;
      nextData.content_target = nextData.content_target || 'grade_race_trend_article';
      return nextData;
    }
  }

  for (const [jockeyName, slug] of Object.entries(jockeyNameMap).sort((a, b) => b[0].length - a[0].length)) {
    if (text.includes(jockeyName)) {
      nextData.entity_type = 'jockey';
      nextData.entity_key = slug;
      nextData.entity_path = `/articles/jockeys/${slug}`;
      nextData.content_target = nextData.content_target || 'jockey_support_article';
      return nextData;
    }
  }

  const courseEntity = inferCourseEntity(text);
  if (courseEntity) {
    nextData.entity_type = 'course';
    nextData.entity_key = courseEntity.entityKey;
    nextData.entity_path = courseEntity.entityPath;
    nextData.content_target = nextData.content_target || 'course_data_article';
  }

  return nextData;
}

function canonicalEntityArticlePath(entityType: string, entityKey: string): string {
  if (!entityType || !entityKey) return '';
  if (entityType === 'grade_race') return `/articles/grade-races/${entityKey}`;
  if (entityType === 'jockey') return `/articles/jockeys/${entityKey}`;
  if (entityType === 'race' && /^[a-z0-9-]+$/.test(entityKey)) return `/articles/races/${entityKey}`;
  if (entityType === 'course') {
    const [venue, ...courseParts] = entityKey.split('-');
    const course = courseParts.join('-');
    if (venue && course) return `/articles/courses/${venue}/${course}`;
  }
  return '';
}

function normalizePublishedArticleMetadata(data: Record<string, any>): Record<string, any> {
  const nextData = inferPublishedArticleMetadata(data);
  let entityPath = normalizeInternalCanonicalPath(nextData.entity_path);
  const canonicalPath = normalizeInternalCanonicalPath(nextData.canonical_path);
  const entityType = normalizeEntityValue(nextData.entity_type);
  const entityKey = normalizeEntityValue(nextData.entity_key);
  const stableEntityPath = canonicalEntityArticlePath(entityType, entityKey);

  if (stableEntityPath) {
    entityPath = stableEntityPath;
  }

  if (entityPath) {
    nextData.entity_path = entityPath;
  } else {
    delete nextData.entity_path;
  }

  if (canonicalPath) {
    nextData.canonical_path = canonicalPath;
  } else if (entityPath && /^\/articles\/(grade-races|jockeys|courses|races)\//.test(entityPath)) {
    nextData.canonical_path = entityPath;
  } else {
    delete nextData.canonical_path;
  }

  return nextData;
}

function findExistingEntityArticlePath(data: Record<string, any>): string | null {
  if (!fs.existsSync(ARTICLES_DIR)) return null;
  const draftEntityType = normalizeEntityValue(data.entity_type);
  const draftEntityKey = normalizeEntityValue(data.entity_key);
  const draftCanonicalPath = normalizeInternalCanonicalPath(data.canonical_path || data.entity_path);
  const draftKey = normalizeGradeRaceKey(`${data.target_keyword || ''} ${data.title || ''}`);
  if (!draftKey && !draftEntityKey && !draftCanonicalPath) return null;

  for (const file of fs.readdirSync(ARTICLES_DIR).filter((f) => f.endsWith('.md'))) {
    const fullPath = path.join(ARTICLES_DIR, file);
    try {
      const content = fs.readFileSync(fullPath, 'utf-8');
      const parsed = matter(content);
      if (parsed.data.draft === true || String(parsed.data.draft || '').toLowerCase() === 'true') continue;

      const articleEntityType = normalizeEntityValue(parsed.data.entity_type);
      const articleEntityKey = normalizeEntityValue(parsed.data.entity_key);
      const articleCanonicalPath = normalizeInternalCanonicalPath(parsed.data.canonical_path || parsed.data.entity_path);

      if (
        draftEntityType &&
        articleEntityType === draftEntityType &&
        draftEntityKey &&
        articleEntityKey === draftEntityKey
      ) {
        return fullPath;
      }

      if (draftCanonicalPath && articleCanonicalPath && draftCanonicalPath === articleCanonicalPath) {
        return fullPath;
      }

      const articleKey = normalizeGradeRaceKey(`${parsed.data.target_keyword || ''} ${parsed.data.title || ''}`);
      if (
        isGradeRaceDraft(data) &&
        isGradeRaceDraft(parsed.data) &&
        draftKey &&
        articleKey &&
        (articleKey === draftKey || articleKey.includes(draftKey) || draftKey.includes(articleKey))
      ) {
        return fullPath;
      }
    } catch {
      // 壊れた記事ファイルは公開処理を止めずにスキップする
    }
  }

  return null;
}

function updateExistingEntityArticle(destPath: string, parsedDraft: any, now: Date): void {
  const existing = matter(fs.readFileSync(destPath, 'utf-8'));
  const nextData = normalizePublishedArticleMetadata({
    ...existing.data,
    ...parsedDraft.data,
    draft: false,
    date: existing.data.date || existing.data.article_published_time || parsedDraft.data.date || now.toISOString(),
    article_published_time: existing.data.article_published_time || existing.data.date || now.toISOString(),
    last_updated: now.toISOString(),
    og_type: 'article',
    og_title: parsedDraft.data.title || existing.data.title,
    og_description: parsedDraft.data.description || existing.data.description,
    og_image: existing.data.og_image || `https://uma-free.com/og/${path.basename(destPath, '.md')}.png`,
  });

  fs.writeFileSync(destPath, matter.stringify(parsedDraft.content.trim() + '\n', nextData), 'utf-8');
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
  const approvedFilesToRemove: string[] = [];
  const writtenArticlePaths: string[] = [];
  const updatedArticleBackups: Array<{ path: string; content: string }> = [];
  let skippedCount = 0;

  for (const targetFile of files) {
    const filePath = path.join(APPROVED_DIR, targetFile);
    const content = fs.readFileSync(filePath, 'utf-8');
    const parsed = matter(content);
    const targetKeyword = String(parsed.data.target_keyword || parsed.data.title || 'article');
    const oldId = path.basename(targetFile, '.md');
    const now = new Date();
    parsed.data = normalizePublishedArticleMetadata(parsed.data);

    const sourceIndependence = checkSourceIndependence(matter.stringify(parsed.content, parsed.data));
    if (!sourceIndependence.passed) {
      console.warn(`[Publisher] Source-independence gate rejected: ${targetFile}`);
      for (const error of sourceIndependence.errors) {
        console.warn(`[Publisher] - ${error}`);
      }
      skippedCount++;
      continue;
    }

    const existingEntityArticlePath = findExistingEntityArticlePath(parsed.data);
    if (existingEntityArticlePath) {
      updatedArticleBackups.push({
        path: existingEntityArticlePath,
        content: fs.readFileSync(existingEntityArticlePath, 'utf-8'),
      });
      updateExistingEntityArticle(existingEntityArticlePath, parsed, now);
      const existingSlug = path.basename(existingEntityArticlePath, '.md');
      console.log(`[Publisher] Updated existing entity article: ${existingSlug}`);

      const venue = extractVenue(targetKeyword);
      if (venue) affectedVenues.add(venue);
      publishedSlugs.push(existingSlug);

      const idx = findHistoryIndex(history, oldId, targetKeyword);
      if (idx !== -1) {
        history[idx] = {
          ...history[idx],
          draft: false,
          slug: existingSlug,
          path: `content/articles/${existingSlug}.md`,
          updated_existing: true,
          published_at: now.toISOString(),
          entity_type: parsed.data.entity_type || '',
          entity_key: parsed.data.entity_key || '',
          entity_path: parsed.data.entity_path || '',
          canonical_path: parsed.data.canonical_path || '',
        };
      } else {
        history.push({
          id: oldId,
          target_keyword: targetKeyword,
          draft: false,
          slug: existingSlug,
          path: `content/articles/${existingSlug}.md`,
          updated_existing: true,
          published_at: now.toISOString(),
          entity_type: parsed.data.entity_type || '',
          entity_key: parsed.data.entity_key || '',
          entity_path: parsed.data.entity_path || '',
          canonical_path: parsed.data.canonical_path || '',
        });
      }

      fs.unlinkSync(filePath);
      publishedKeywords.add(targetKeyword);
      continue;
    }

    if (publishedKeywords.has(targetKeyword)) {
      console.warn(`[Publisher] Skip duplicate approved draft. Already published: ${targetKeyword}`);
      history = removeDraftHistory(history, oldId, targetKeyword);
      fs.unlinkSync(filePath);
      skippedCount++;
      continue;
    }

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
    const cleanedContent = parsed.content.replace(/\[関連記事：.*?\]\n?/g, '');

    // Markdown再シリアライズ前に、承認済みキューに残った旧基準の文言を公開直前で補正する。
    // 例: 「期待値」など、article:validate-links 側で弾く収益想起ワード。
    const repaired = autoRepairDraftMarkdown(matter.stringify(cleanedContent, parsed.data));
    if (repaired.changes.length > 0) {
      console.log(`[Publisher] Auto-repaired article before publish: ${targetFile} (${repaired.changes.join(', ')})`);
    }

    const repairedParsed = matter(repaired.content);
    repairedParsed.data.draft = false;
    repairedParsed.data.date = parsed.data.date;
    repairedParsed.data.article_published_time = parsed.data.article_published_time;
    repairedParsed.data.og_type = 'article';
    repairedParsed.data.og_title = repairedParsed.data.title;
    repairedParsed.data.og_description = repairedParsed.data.description;
    repairedParsed.data.og_image = parsed.data.og_image;
    if (parsed.data.is_overseas !== undefined) {
      repairedParsed.data.is_overseas = parsed.data.is_overseas;
    }
    if (parsed.data.category) {
      repairedParsed.data.category = parsed.data.category;
    }
    repairedParsed.data = normalizePublishedArticleMetadata(repairedParsed.data);
    parsed.data = repairedParsed.data;

    // Markdown再シリアライズ
    const finalContent = matter.stringify(repairedParsed.content, repairedParsed.data);

    // ファイルを Articles ディレクトリへ書き込み
    fs.writeFileSync(destPath, finalContent, 'utf-8');
    writtenArticlePaths.push(destPath);
    console.log(`[Publisher] Published article to: ${destPath}`);

    // 検査が通るまではapproved原稿を残し、失敗時に調査・再実行できるようにする。
    approvedFilesToRemove.push(filePath);

    // posted_history.json を更新
    try {
      const idx = findHistoryIndex(history, oldId, targetKeyword);
      if (idx !== -1) {
        history[idx].draft = false;
        history[idx].published_at = now.toISOString();
        history[idx].slug = slug;
        history[idx].entity_type = parsed.data.entity_type || '';
        history[idx].entity_key = parsed.data.entity_key || '';
        history[idx].entity_path = parsed.data.entity_path || '';
        history[idx].canonical_path = parsed.data.canonical_path || '';
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
          entity_type: parsed.data.entity_type || '',
          entity_key: parsed.data.entity_key || '',
          entity_path: parsed.data.entity_path || '',
          canonical_path: parsed.data.canonical_path || '',
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

  // 施策C: ハブ記事の自動生成/更新
  for (const venue of affectedVenues) {
    generateHubArticle(venue, history);
  }

  console.log('[Publisher] Validating article links before Git commit...');
  try {
    execSync('npm run article:validate-links', { stdio: 'inherit' });
  } catch (validationErr) {
    for (const articlePath of writtenArticlePaths) {
      if (fs.existsSync(articlePath)) {
        fs.unlinkSync(articlePath);
        console.warn(`[Publisher] Rolled back article after validation failure: ${path.basename(articlePath)}`);
      }
    }
    for (const backup of updatedArticleBackups.reverse()) {
      fs.writeFileSync(backup.path, backup.content, 'utf-8');
      console.warn(`[Publisher] Restored updated article after validation failure: ${path.basename(backup.path)}`);
    }
    throw validationErr;
  }

  writeHistory(history);

  for (const approvedPath of approvedFilesToRemove) {
    if (fs.existsSync(approvedPath)) {
      fs.unlinkSync(approvedPath);
      console.log(`[Publisher] Removed original approved draft: ${path.basename(approvedPath)}`);
    }
  }

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
        if (process.env.GITHUB_ACTIONS === 'true') {
          throw pushErr;
        }
      }
    } else {
      console.log('[Publisher] No changes to commit.');
    }
  } catch (gitErr: any) {
    console.error('[Publisher] Git operation failed. Skipping...', gitErr.message);
    if (process.env.GITHUB_ACTIONS === 'true') {
      throw gitErr;
    }
  }

  console.log(`[Publisher] Published: ${publishedSlugs.length}, skipped duplicates: ${skippedCount}`);
  console.log('=== Publisher Agent Completed ===');
}

publishDraft().catch(e => {
  console.error(e);
  process.exitCode = 1;
});
