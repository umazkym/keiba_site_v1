import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import { execSync } from 'child_process';

const APPROVED_DIR = path.join(__dirname, '..', '..', 'agents', 'queue', 'approved');
const ARTICLES_DIR = path.join(__dirname, '..', '..', 'content', 'articles');
const HISTORY_PATH = path.join(__dirname, '..', '..', '..', 'data', 'posted_history.json');

// 日本語のキーワードから英語スラグを生成する関数
function generateSlug(targetKeyword: string, date: Date): string {
  const dateStr = date.toISOString().split('T')[0];

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

  let slug = targetKeyword;
  for (const [ja, en] of Object.entries({ ...venueMap, ...courseMap, ...extraMap })) {
    // replaceAll is better if supported, but simple regex works globally
    slug = slug.split(ja).join(en);
  }

  // 残った日本語・記号をハイフン区切りに変換
  // 日本語文字（漢字、ひらがな、カタカナ）は消す方針なら以下の正規表現を利用
  // ただしローマ字、数字、英字、ハイフンのみ残す
  slug = slug
    .replace(/[^\w\s-]/g, '') // 英数字、空白、ハイフン以外を削除
    .replace(/\s+/g, '-') // 空白をハイフンに
    .replace(/-+/g, '-') // 連続するハイフンを一つに
    .toLowerCase()
    .trim();

  // 末尾のハイフン除去
  if (slug.endsWith('-')) slug = slug.slice(0, -1);
  if (slug.startsWith('-')) slug = slug.slice(1);

  return `${dateStr}-${slug}`;
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
  // Markdown再シリアライズ
  const finalContent = matter.stringify(parsed.content, parsed.data);

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
      // historyからtarget_keywordや元のdraftIDで探す
      // 作成時の pending ファイル名（20260320_xxxxxx）が id になっている
      const oldId = path.basename(targetFile, '.md');
      
      const idx = history.findIndex((h: any) => h.id === oldId || h.target_keyword === targetKeyword);
      if (idx !== -1) {
        history[idx].draft = false;
        history[idx].published_at = now.toISOString();
        history[idx].slug = slug;
        fs.writeFileSync(HISTORY_PATH, JSON.stringify(history, null, 2), 'utf-8');
        console.log(`[Publisher] Updated History for ID: ${history[idx].id}`);
      } else {
        console.warn(`[Publisher] Warning: Could not find history entry for keyword '${targetKeyword}' to update.`);
      }
    } catch (e) {
      console.error('[Publisher] Error updating posted_history.json', e);
    }
  }

  // Git操作 (Actionsでの動作を想定)
  try {
    console.log('[Publisher] Committing changes to Git...');
    // Gitが初期化されていて操作可能かチェック
    execSync('git add .');
    const status = execSync('git status --porcelain').toString();
    if (status.trim().length > 0) {
      execSync(`git commit -m "Auto-publish: ${slug}"`);
      // pushは権限がある環境（Actionsなど）で実行される
      // エラーで止まらないよう、pushが失敗した場合は警告を出す程度にしておく
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
