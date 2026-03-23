import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import { execSync } from 'child_process';

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

  return `${dateStr}-${slug}`;
}

/**
 * 施策C: ハブ記事（まとめページ）を自動生成・更新する
 *
 * 設計意図:
 * - 検索需要の高い「〇〇競馬場 枠順」のビッグキーワードを間接的に狙う
 * - 個別記事への内部リンク構造を強化し、各記事のSEO評価を底上げする
 * - 距離別の有利枠を一覧テーブルで即座に参照でき、ユーザー実用価値を最大化
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

  // ハブ記事のFrontmatter（SEOチェッカーを通さない非パイプライン記事だが、品質は担保する）
  const hubTitle = `${venue}競馬場の枠順データ一覧｜有利枠を全距離で比較`;
  const hubDesc = `${venue}競馬場の芝・ダート${articleEntries.length}コースの枠順別データを独自集計。距離ごとの有利枠・不利枠を勝率・複勝率・回収率の3指標で一覧化した。`;
  const frontmatter = {
    title: hubTitle,
    description: hubDesc,
    keywords: [`${venue}競馬場`, '枠順', 'データ', '有利枠', '競馬'],
    target_keyword: `${venue}競馬場 枠順`,
    article_type: 'hub',
    draft: false,
    last_updated: updateDate,
    og_type: 'article',
    og_title: hubTitle,
    og_description: hubDesc,
    article_published_time: now.toISOString(),
  };

  // 記事一覧テーブル
  const tableRows = articleEntries.map(a =>
    `| ${a.condition} | [詳細データを見る](/articles/${a.slug}) |`
  ).join('\n');

  const body = `
${venue}競馬場で開催される各コース・距離ごとの枠順データを独自集計で分析した記事を一覧にまとめた。馬券検討の際のクイックリファレンスとして活用できる。

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
| 単勝回収率 | 100円投資あたりの回収額 | オッズとの乖離＝妙味の発見 |

勝率が高い枠はオッズに既に反映されていることが多い。単勝回収率100%超の枠番は、人気薄ながら1着を取る確率が高い「穴枠」であり、馬券的な価値が最も高い。

最終更新日: ${updateDate}
`;

  const hubContent = matter.stringify(body.trim(), frontmatter);
  const hubFilename = `${venueSlug}-gate-data-hub.md`;
  const hubPath = path.join(ARTICLES_DIR, hubFilename);

  const isUpdate = fs.existsSync(hubPath);
  fs.writeFileSync(hubPath, hubContent, 'utf-8');
  console.log(`[Publisher Hub] ハブ記事を${isUpdate ? '更新' : '新規生成'}: ${hubFilename}`);
}

async function publishDraft() {
  console.log('=== Publisher Agent Started ===');

  if (!fs.existsSync(APPROVED_DIR)) {
    console.log('[Publisher] Approved directory not found. Exiting.');
    return;
  }

  const files = fs.readdirSync(APPROVED_DIR).filter(f => f.endsWith('.md'));
  if (files.length === 0) {
    console.log('[Publisher] No approved drafts to publish. Exiting.');
    return;
  }

  // とりあえず1件だけ処理する
  const targetFile = files[0];
  const filePath = path.join(APPROVED_DIR, targetFile);
  const content = fs.readFileSync(filePath, 'utf-8');
  
  const parsed = matter(content);
  const targetKeyword = parsed.data.target_keyword || parsed.data.title || 'article';
  
  const now = new Date();
  const slug = generateSlug(targetKeyword, now);
  const newFilename = `${slug}.md`;
  const destPath = path.join(ARTICLES_DIR, newFilename);

  // frontmatterのdraftを消すかfalseにする
  parsed.data.draft = false;

  // 施策F: OGP・構造化データをFrontmatterに自動付与
  parsed.data.og_type = 'article';
  parsed.data.og_title = parsed.data.title;
  parsed.data.og_description = parsed.data.description;
  parsed.data.article_published_time = now.toISOString();
  parsed.data.og_image = `https://uma-free.jp/og/${slug}.png`;

  // 施策E: [関連記事：〇〇] プレースホルダーをCTAブロックに置換
  // 記事中に2箇所のプレースホルダーがあるが、CTAは1つだけ挿入し残りは削除する（重複防止）
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

  // ディレクトリ生成
  if (!fs.existsSync(ARTICLES_DIR)) {
    fs.mkdirSync(ARTICLES_DIR, { recursive: true });
  }

  // ファイルを Articles ディレクトリへ書き込み
  fs.writeFileSync(destPath, finalContent, 'utf-8');
  console.log(`[Publisher] Published article to: ${destPath}`);

  // 元ファイルを削除
  fs.unlinkSync(filePath);
  console.log(`[Publisher] Removed original approved draft: ${targetFile}`);

  // posted_history.json を更新
  if (fs.existsSync(HISTORY_PATH)) {
    try {
      const history = JSON.parse(fs.readFileSync(HISTORY_PATH, 'utf-8'));
      const oldId = path.basename(targetFile, '.md');
      
      const idx = history.findIndex((h: any) => h.id === oldId || h.target_keyword === targetKeyword);
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
        fs.writeFileSync(HISTORY_PATH, JSON.stringify(history, null, 2), 'utf-8');
        console.log(`[Publisher] Updated History for ID: ${history[idx].id}`);
      } else {
        console.warn(`[Publisher] Warning: Could not find history entry for keyword '${targetKeyword}' to update.`);
      }

      // 施策C: ハブ記事の自動生成/更新
      if (venue) {
        generateHubArticle(venue, history);
      }
    } catch (e) {
      console.error('[Publisher] Error updating posted_history.json', e);
    }
  }

  // Git操作 (Actionsでの動作を想定)
  try {
    console.log('[Publisher] Committing changes to Git...');
    execSync('git add .');
    const status = execSync('git status --porcelain').toString();
    if (status.trim().length > 0) {
      execSync(`git commit -m "Auto-publish: ${slug}"`);
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

  console.log('=== Publisher Agent Completed ===');
}

publishDraft().catch(e => console.error(e));
