/**
 * 既存記事のカテゴリ修復スクリプト（ワンショット実行）
 * 
 * category が「未分類」または未設定の記事に対して、
 * title / target_keyword / ファイル名からカテゴリを自動判定して付与する。
 */
import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';

const ARTICLES_DIR = path.join(__dirname, '..', 'content', 'articles');

/**
 * キーワード・タイトルからカテゴリを自動判定する
 */
function determineCategory(data: Record<string, any>, filename: string): string {
  const keyword = (data.target_keyword || '').toLowerCase();
  const title = (data.title || '').toLowerCase();
  const themeCluster = data.theme_cluster || '';
  const slug = filename.toLowerCase();
  const combined = `${keyword} ${title} ${slug}`;

  // theme_clusterベースの判定（最優先）
  if (themeCluster === 'grade_race_preview') return '重賞プレビュー';

  // キーワードベースの判定
  if (combined.includes('枠順') || combined.includes('waku'))
    return '枠順データ';
  if (combined.includes('ダート') || combined.includes('dirt'))
    return '枠順データ';
  if (combined.includes('芝') || combined.includes('turf'))
    return '枠順データ';
  if (combined.includes('ai予想') || combined.includes('重賞') || combined.includes('stakes') || combined.includes('cup') || combined.includes('kinen'))
    return '重賞プレビュー';
  if (combined.includes('騎手') || combined.includes('jockey'))
    return '騎手分析';
  if (combined.includes('初心者') || combined.includes('ガイド') || combined.includes('入門') || combined.includes('guide') || combined.includes('beginner') || combined.includes('manual') || combined.includes('terms') || combined.includes('access'))
    return '競馬入門';
  if (combined.includes('回収率') || combined.includes('人気') || combined.includes('血統') || combined.includes('馬場') || combined.includes('ペース') || combined.includes('体重') || combined.includes('パドック') || combined.includes('オッズ') || combined.includes('trainer') || combined.includes('bloodline') || combined.includes('pace') || combined.includes('weight') || combined.includes('paddock') || combined.includes('odds') || combined.includes('popularity') || combined.includes('ranking') || combined.includes('calendar'))
    return 'データ分析';

  return 'データ分析';
}

function main() {
  console.log('=== 既存記事カテゴリ修復スクリプト ===\n');

  if (!fs.existsSync(ARTICLES_DIR)) {
    console.error(`記事ディレクトリが存在しません: ${ARTICLES_DIR}`);
    process.exit(1);
  }

  const files = fs.readdirSync(ARTICLES_DIR).filter(f => f.endsWith('.md'));
  let fixedCount = 0;
  let skippedCount = 0;

  for (const filename of files) {
    const filePath = path.join(ARTICLES_DIR, filename);
    const content = fs.readFileSync(filePath, 'utf-8');
    const parsed = matter(content);

    const currentCategory = parsed.data.category;

    // カテゴリが既に適切に設定されている場合はスキップ
    if (currentCategory && currentCategory !== '未分類') {
      skippedCount++;
      continue;
    }

    const newCategory = determineCategory(parsed.data, filename);
    parsed.data.category = newCategory;

    // Markdown再シリアライズ
    const updatedContent = matter.stringify(parsed.content, parsed.data);
    fs.writeFileSync(filePath, updatedContent, 'utf-8');

    console.log(`[修正] ${filename}`);
    console.log(`  旧: ${currentCategory || '(なし)'} → 新: ${newCategory}`);
    fixedCount++;
  }

  console.log(`\n=== 完了 ===`);
  console.log(`修正: ${fixedCount}件, スキップ: ${skippedCount}件, 合計: ${files.length}件`);
}

main();
