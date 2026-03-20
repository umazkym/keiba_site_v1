import { WriteOrder, generateDraft } from './agent_writer';
import { reviewDraft } from './agent_editor';
import fs from 'fs';
import path from 'path';

// .env.local などを読み込む (dotenv等)
import * as dotenv from 'dotenv';
dotenv.config({ path: path.join(__dirname, '../../../.env') }); // Read workspace root .env

async function runPipeline() {
  console.log("=== UMA-FREE 記事生成パイプライン テスト開始 ===");

  // 最新の write_orders/{YYYYMMDD_HHmmss}.json を取得する
  const ordersDir = path.join(__dirname, '..', '..', '..', 'data', 'write_orders');
  if (!fs.existsSync(ordersDir)) {
    console.error(`指示書ディレクトリが存在しません: ${ordersDir}`);
    return;
  }
  
  const files = fs.readdirSync(ordersDir).filter(f => f.endsWith('.json')).sort();
  if (files.length === 0) {
    console.error(`指示書JSONが見つかりません: ${ordersDir}`);
    return;
  }
  
  const latestOrderPath = path.join(ordersDir, files[files.length - 1]);
  console.log(`[Input] Loading real order from: ${files[files.length - 1]}`);
  const dummyOrder: WriteOrder = JSON.parse(fs.readFileSync(latestOrderPath, 'utf-8'));

  if (!process.env.GEMINI_API_KEY) {
    console.warn("⚠️ GEMINI_API_KEYが設定されていません。APIのリクエストは失敗します。");
    console.warn("そのため、このスクリプトはロジックの流れを確認するモックとして動作します。");
    return;
  }

  // 1. Writer: 記事ドラフトの生成
  console.log("\n[Step 1] Writer Agent is generating the draft...");
  const writerResult = await generateDraft(dummyOrder);
  
  if (!writerResult.success || !writerResult.filePath) {
    console.error("記事の生成に失敗しました:", writerResult.error);
    return;
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
}

// 実行
runPipeline().catch(console.error);
