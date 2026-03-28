import { WriteOrder, generateDraft } from './agent_writer';
import { reviewDraft } from './agent_editor';
import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';

// .env.local などを読み込む (dotenv等)
import * as dotenv from 'dotenv';
dotenv.config({ path: path.join(__dirname, '../../../.env') }); // Read workspace root .env

/**
 * 既存記事のtarget_keywordを全て取得する（重複チェック用）
 */
function getExistingArticleKeywords(): Set<string> {
  const articlesDir = path.join(__dirname, '..', '..', 'content', 'articles');
  const keywords = new Set<string>();

  if (!fs.existsSync(articlesDir)) return keywords;

  const files = fs.readdirSync(articlesDir).filter(f => f.endsWith('.md'));
  for (const file of files) {
    try {
      const content = fs.readFileSync(path.join(articlesDir, file), 'utf-8');
      const { data } = matter(content);
      if (data.target_keyword) {
        keywords.add(data.target_keyword);
      }
    } catch {
      // パースエラーは無視
    }
  }

  return keywords;
}

/**
 * 処理済みのwrite_orderをprocessedディレクトリに移動する
 */
function moveToProcessed(filePath: string): void {
  const processedDir = path.join(path.dirname(filePath), 'processed');
  fs.mkdirSync(processedDir, { recursive: true });
  const destPath = path.join(processedDir, path.basename(filePath));
  fs.renameSync(filePath, destPath);
  console.log(`[Pipeline] write_order consumed: ${path.basename(filePath)} → processed/`);
}

async function runPipeline() {
  console.log("=== UMA-FREE 記事生成パイプライン テスト開始 ===");

  // 最新の write_orders/{YYYYMMDD_HHmmss}.json を取得する
  const ordersDir = path.join(__dirname, '..', '..', '..', 'data', 'write_orders');
  if (!fs.existsSync(ordersDir)) {
    console.error(`指示書ディレクトリが存在しません: ${ordersDir}`);
    return;
  }
  
  // processedディレクトリ内のファイルを除外（トップレベルのJSONファイルのみ対象）
  const files = fs.readdirSync(ordersDir).filter(f => f.endsWith('.json')).sort();
  if (files.length === 0) {
    console.error(`指示書JSONが見つかりません: ${ordersDir}`);
    return;
  }

  // 既存記事のキーワードを取得（重複チェック用）
  const existingKeywords = getExistingArticleKeywords();
  console.log(`[Pipeline] 既存記事のキーワード数: ${existingKeywords.size}`);
  
  // 最古のwrite_orderから順に処理（未消費のものを優先）
  let processed = false;
  for (const file of files) {
    const orderPath = path.join(ordersDir, file);
    
    let order: WriteOrder;
    try {
      order = JSON.parse(fs.readFileSync(orderPath, 'utf-8'));
    } catch {
      console.warn(`[Pipeline] 無効なJSONファイルをスキップ: ${file}`);
      moveToProcessed(orderPath);
      continue;
    }

    // 既存記事との重複チェック
    if (existingKeywords.has(order.target_keyword)) {
      console.log(`[Pipeline] 重複スキップ（既存記事あり）: ${order.target_keyword}`);
      moveToProcessed(orderPath);
      continue;
    }

    console.log(`[Input] Loading real order from: ${file}`);
    console.log(`[Input] target_keyword: ${order.target_keyword}`);

    if (!process.env.GEMINI_API_KEY) {
      console.warn("⚠️ GEMINI_API_KEYが設定されていません。APIのリクエストは失敗します。");
      console.warn("そのため、このスクリプトはロジックの流れを確認するモックとして動作します。");
      return;
    }

    // 1. Writer: 記事ドラフトの生成
    console.log("\n[Step 1] Writer Agent is generating the draft...");
    const writerResult = await generateDraft(order);
    
    if (!writerResult.success || !writerResult.filePath) {
      console.error("記事の生成に失敗しました:", writerResult.error);
      // 生成失敗でもwrite_orderは消費する（無限ループ防止）
      moveToProcessed(orderPath);
      continue;
    }

    // 2. Editor & Checker: 完成した記事の検閲と自動修正
    console.log("\n[Step 2] Editor Agent is reviewing the draft...", writerResult.filePath);
    const reviewResult = await reviewDraft(writerResult.filePath);
    
    console.log(`\n=== 判定結果: ${reviewResult.status} ===`);
    console.log(reviewResult.log);
    
    if (reviewResult.status === 'REJECTED' && reviewResult.newDraftPath) {
      console.log(`修正版のファイルが生成されました: ${reviewResult.newDraftPath}`);
    } else if (reviewResult.status === 'APPROVED') {
      console.log(`合格したため、承認済みキューに移動しました: ${reviewResult.newDraftPath}`);
    }

    // write_orderを消費済みに移動
    moveToProcessed(orderPath);
    processed = true;
    break; // 1日1記事のみ生成
  }

  if (!processed) {
    console.log("[Pipeline] 処理対象のwrite_orderがありませんでした。");
  }
}

// 実行
runPipeline().catch(console.error);
