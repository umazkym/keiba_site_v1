import { WriteOrder, generateDraft } from './agent_writer';
import { reviewDraft } from './agent_editor';
import { runPostWriterArticleFlow, runPreDraftArticleFlow } from './article_flow';
import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import { prioritizeOrderFiles } from './article_order_priority';
import { generateGradeRaceSearchRepair } from './gsc_seo_rewrite';
import {
  isGeminiCircuitOpen,
  loadGeminiCircuitState,
  recordGeminiFailure,
  recordGeminiSuccess,
} from './gemini_circuit_breaker';
import { GeminiFailureKind, shouldOpenGeminiCircuit } from './gemini_failure';

// .env.local などを読み込む (dotenv等)
import * as dotenv from 'dotenv';
dotenv.config({ path: path.join(__dirname, '../../../.env') }); // Read workspace root .env

const MAX_ARTICLES_PER_RUN = Math.max(
  1,
  Number.parseInt(process.env.ARTICLE_PIPELINE_MAX_ARTICLES || '2', 10) || 2
);
const RESERVE_RACE_UPDATE_SLOT = (process.env.ARTICLE_PIPELINE_RESERVE_RACE_UPDATE_SLOT || 'true').toLowerCase() !== 'false';
const RESERVE_EVERGREEN_SLOT = (process.env.ARTICLE_PIPELINE_RESERVE_EVERGREEN_SLOT || 'true').toLowerCase() !== 'false';
const AGGRESSIVE_COVERAGE = (process.env.KEIBA_ARTICLE_COVERAGE_MODE || 'aggressive').toLowerCase() === 'aggressive';
const GEMINI_CIRCUIT_STATE_PATH = (process.env.GEMINI_CIRCUIT_STATE_PATH || '').trim();

function recordExternalGeminiFailure(kind: GeminiFailureKind | undefined, reason: string): void {
  if (!GEMINI_CIRCUIT_STATE_PATH || !kind || !shouldOpenGeminiCircuit(kind)) return;
  const state = recordGeminiFailure(GEMINI_CIRCUIT_STATE_PATH, kind, reason);
  console.error(
    `[Pipeline] Geminiサーキット更新: kind=${kind}, failures=${state.consecutive_failures}, open_until=${state.open_until || '未開放'}`
  );
}

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
  const destPath = getUniqueDestination(processedDir, path.basename(filePath));
  fs.renameSync(filePath, destPath);
  console.log(`[Pipeline] write_order consumed: ${path.basename(filePath)} → processed/`);
}

function moveToFailed(filePath: string, reason: string): void {
  const failedDir = path.join(path.dirname(filePath), 'failed');
  fs.mkdirSync(failedDir, { recursive: true });
  const destPath = getUniqueDestination(failedDir, path.basename(filePath));
  fs.renameSync(filePath, destPath);
  console.error(`[Pipeline] write_order failed: ${path.basename(filePath)} → failed/ (${reason})`);
}

function getUniqueDestination(directory: string, fileName: string): string {
  const destPath = path.join(directory, fileName);
  if (!fs.existsSync(destPath)) return destPath;

  const parsed = path.parse(fileName);
  return path.join(directory, `${parsed.name}_${Date.now()}${parsed.ext}`);
}

async function runPipeline() {
  console.log("=== UMA-FREE 記事生成パイプライン テスト開始 ===");

  if (GEMINI_CIRCUIT_STATE_PATH) {
    const circuitState = loadGeminiCircuitState(GEMINI_CIRCUIT_STATE_PATH);
    if (isGeminiCircuitOpen(circuitState)) {
      throw new Error(`Gemini記事生成サーキットが停止中です。次回試行可能: ${circuitState.open_until}`);
    }
  }

  // 最新の write_orders/{YYYYMMDD_HHmmss}.json を取得する
  const ordersDir = path.join(__dirname, '..', '..', '..', 'data', 'write_orders');
  if (!fs.existsSync(ordersDir)) {
    console.error(`指示書ディレクトリが存在しません: ${ordersDir}`);
    return;
  }
  
  // processedディレクトリ内のファイルを除外（トップレベルのJSONファイルのみ対象）
  const filesList = fs.readdirSync(ordersDir).filter(f => f.endsWith('.json'));
  if (filesList.length === 0) {
    console.error(`指示書JSONが見つかりません: ${ordersDir}`);
    return;
  }

  // priority順にソートするための配列を作成
  const sortedFiles = prioritizeOrderFiles(filesList.map(f => {
    try {
      const content = fs.readFileSync(path.join(ordersDir, f), 'utf-8');
      const order = JSON.parse(content);
      return { file: f, order, priority: order.priority || 0 };
    } catch {
      return { file: f, order: null, priority: 0 };
    }
  }).sort((a, b) => b.priority - a.priority || a.file.localeCompare(b.file)), {
    maxArticles: MAX_ARTICLES_PER_RUN,
    reserveRaceUpdateSlot: RESERVE_RACE_UPDATE_SLOT,
    reserveEvergreenSlot: RESERVE_EVERGREEN_SLOT,
    aggressiveCoverage: AGGRESSIVE_COVERAGE,
  });

  const files = sortedFiles.map(item => item.file);

  // 既存記事のキーワードを取得（重複チェック用）
  const existingKeywords = getExistingArticleKeywords();
  const seenKeywords = new Set(existingKeywords);
  console.log(`[Pipeline] 既存記事のキーワード数: ${existingKeywords.size}`);
  
  // 最古のwrite_orderから順に処理（未消費のものを優先）
  let attemptedCount = 0;
  let approvedCount = 0;
  let rejectedStreak = 0; // 連続却下数カウンター
  let stoppedForGeminiLimit = false;
  for (const file of files) {
    const orderPath = path.join(ordersDir, file);
    
    let order: WriteOrder;
    try {
      order = JSON.parse(fs.readFileSync(orderPath, 'utf-8'));
    } catch {
      console.warn(`[Pipeline] 無効なJSONファイルをスキップ: ${file}`);
      moveToFailed(orderPath, 'invalid JSON');
      continue;
    }

    // 既存記事との重複チェック
    const isGradeRaceSearchRepair = order.operation === 'grade_race_search_repair';
    if (!isGradeRaceSearchRepair && seenKeywords.has(order.target_keyword)) {
      console.log(`[Pipeline] 重複スキップ（既存記事または同一実行内で処理済み）: ${order.target_keyword}`);
      moveToProcessed(orderPath);
      continue;
    }

    console.log(`[Input] Loading real order from: ${file}`);
    console.log(`[Input] target_keyword: ${order.target_keyword}`);

    if (isGradeRaceSearchRepair) {
      const reportPath = String(order.reference_data?.gsc_repair_report_path || '').trim();
      const targetSlug = String(order.rewrite_target_slug || '').trim();
      if (!reportPath || !targetSlug) {
        moveToFailed(orderPath, '重賞検索救済にreport pathまたはtarget slugがありません');
        continue;
      }
      attemptedCount++;
      try {
        await generateGradeRaceSearchRepair(reportPath, targetSlug);
        approvedCount++;
        rejectedStreak = 0;
        moveToProcessed(orderPath);
      } catch (error) {
        moveToFailed(
          orderPath,
          `重賞検索救済に失敗: ${error instanceof Error ? error.message.slice(0, 180) : String(error).slice(0, 180)}`,
        );
      }
      if (attemptedCount >= MAX_ARTICLES_PER_RUN) break;
      continue;
    }

    const preDraftFlow = await runPreDraftArticleFlow(order);
    console.log(preDraftFlow.log);
    if (preDraftFlow.status === 'REJECTED') {
      moveToFailed(orderPath, `article flow rejected before draft: ${preDraftFlow.log.slice(0, 160)}`);
      if (attemptedCount >= MAX_ARTICLES_PER_RUN) break;
      continue;
    }
    if (preDraftFlow.state.research_sources.length > 0) {
      order.research_sources = preDraftFlow.state.research_sources;
      const existingEvidence = order.reference_data.writer_evidence || { facts: [], metrics: [], as_of: '' };
      const officialFacts = preDraftFlow.state.research_sources.flatMap(source =>
        source.source_type === 'official'
          ? source.allowed_claims.map(text => ({ text, origin: 'official' as const }))
          : []
      );
      order.reference_data.writer_evidence = {
        facts: [...(existingEvidence.facts || []), ...officialFacts].slice(0, 8),
        metrics: existingEvidence.metrics || [],
        as_of: new Date().toISOString(),
      };
      console.log(`[ArticleFlow] research_sources attached: ${order.research_sources.length}`);
    }

    // 本文内の内部リンク候補をWriterへ渡す。
    // ここで渡したスラッグ以外へのリンクは seo_checker が実在チェックで弾く。
    // 追加のLLM呼び出しは発生せず、pre-draftフローで算出済みの結果をそのまま使う。
    if (preDraftFlow.state.related_articles.length > 0) {
      order.related_articles = preDraftFlow.state.related_articles.map(article => ({
        title: article.title,
        slug: article.slug,
      }));
      console.log(`[ArticleFlow] related_articles attached: ${order.related_articles.length}`);
    }

    if (!process.env.GEMINI_API_KEY) {
      throw new Error(`GEMINI_API_KEYが設定されていないため記事を生成できません。write_orderは未消費のまま残します: ${file}`);
    }

    attemptedCount++;
    seenKeywords.add(order.target_keyword);

    // 1. Writer: 記事ドラフトの生成
    console.log("\n[Step 1] Writer Agent is generating the draft...");
    const writerResult = await generateDraft(order);
    
    if (!writerResult.success || !writerResult.filePath) {
      console.error("記事の生成に失敗しました:", writerResult.error);
      if (writerResult.apiKeyInvalid) {
        recordExternalGeminiFailure(writerResult.failureKind, writerResult.error || 'API key invalid');
        console.error("\n[CRITICAL ERROR] GEMINI_API_KEY が無効、または漏洩判定されています。");
        console.error("安全のため、現在の write_order は未消費（トップレベル）のまま残し、パイプラインを即座に緊急停止します。");
        console.error("Google AI Studioで新しいAPIキーを再生成し、環境変数 GEMINI_API_KEY を設定し直してください。\n");
        process.exit(1);
      }
      if (writerResult.retryable || (writerResult.failureKind && shouldOpenGeminiCircuit(writerResult.failureKind))) {
        recordExternalGeminiFailure(writerResult.failureKind, writerResult.error || 'Gemini external failure');
        console.error("[Pipeline] Geminiの外部制限（クォータ・課金・レート制限等）により停止します。write_orderは未消費のまま残します。");
        stoppedForGeminiLimit = true;
        break;
      }
      moveToFailed(orderPath, writerResult.error || 'writer failed');
      if (attemptedCount >= MAX_ARTICLES_PER_RUN) break;
      continue;
    }

    const postWriterFlow = runPostWriterArticleFlow(order, writerResult.filePath);
    console.log(postWriterFlow.log);
    if (postWriterFlow.status === 'REJECTED') {
      moveToFailed(orderPath, `article flow rejected after writer: ${postWriterFlow.log.slice(0, 160)}`);
      if (attemptedCount >= MAX_ARTICLES_PER_RUN) break;
      continue;
    }

    // 2. Editor & Checker: 完成した記事の検閲と自動修正
    console.log("\n[Step 2] Editor Agent is reviewing the draft...", writerResult.filePath);
    const reviewResult = await reviewDraft(writerResult.filePath);
    
    console.log(`\n=== 判定結果: ${reviewResult.status} ===`);
    console.log(reviewResult.log);
    
    if (reviewResult.apiKeyInvalid) {
      recordExternalGeminiFailure(reviewResult.failureKind, reviewResult.log || 'API key invalid');
      console.error("\n[CRITICAL ERROR] レビュー中に GEMINI_API_KEY が無効化、または漏洩判定されました。");
      console.error("安全のため、今回の write_order は未消費のまま残し、パイプラインを即座に緊急停止します。");
      console.error("Google AI Studioで新しいAPIキーを再生成し、環境変数 GEMINI_API_KEY を設定し直してください。\n");
      process.exit(1);
    }

    if (reviewResult.retryable || (reviewResult.failureKind && shouldOpenGeminiCircuit(reviewResult.failureKind))) {
      recordExternalGeminiFailure(reviewResult.failureKind, reviewResult.log || 'Gemini external failure');
      console.error("[Pipeline] Geminiの外部制限（クォータ・課金・レート制限等）によりレビューを停止します。write_orderは未消費のまま残します。");
      stoppedForGeminiLimit = true;
      break;
    } else if (reviewResult.status === 'REJECTED') {
      rejectedStreak++;
      if (reviewResult.newDraftPath) {
        console.log(`修正版のファイルが生成されました: ${reviewResult.newDraftPath}`);
      }
      const rejectReason = reviewResult.newDraftPath
        ? `editor rejected: ${path.basename(reviewResult.newDraftPath)}`
        : `editor rejected: ${reviewResult.log.slice(0, 120)}`;
      moveToFailed(orderPath, rejectReason);

      if (rejectedStreak >= 3) {
        console.error(`\n[CRITICAL ERROR] 3回連続で記事が却下（REJECTED）されました。`);
        console.error("記事品質に系統的な問題が生じている可能性があるため、パイプラインを即座に緊急停止します。\n");
        process.exit(1);
      }

      if (attemptedCount >= MAX_ARTICLES_PER_RUN) break;
      continue;
    } else if (reviewResult.status === 'APPROVED') {
      console.log(`合格したため、承認済みキューに移動しました: ${reviewResult.newDraftPath}`);
      approvedCount++;
      rejectedStreak = 0; // 合格時に連続却下カウンターをリセット
      if (GEMINI_CIRCUIT_STATE_PATH) recordGeminiSuccess(GEMINI_CIRCUIT_STATE_PATH);
    }

    // 承認まで進んだwrite_orderのみ消費済みに移動する。
    moveToProcessed(orderPath);
    if (attemptedCount >= MAX_ARTICLES_PER_RUN) break; // 1日最大3記事まで生成
  }

  if (attemptedCount === 0) {
    console.log("[Pipeline] 処理対象のwrite_orderがありませんでした。");
  }

  if (attemptedCount > 0 && approvedCount === 0 && stoppedForGeminiLimit) {
    throw new Error(`Geminiの外部制限で記事生成を保留しました。未処理WriteOrderは次回実行用キャッシュへ保持されます。課金/クォータ復旧後に古い高優先注文から再実行してください。attempted=${attemptedCount}`);
  }

  if (attemptedCount > 0 && approvedCount === 0) {
    throw new Error(`記事生成は実行されましたが、承認済み記事が0件でした。pending/revised/failedのログを確認してください。attempted=${attemptedCount}`);
  }
}

// 実行
runPipeline().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
