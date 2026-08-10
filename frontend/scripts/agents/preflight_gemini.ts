/**
 * Gemini API 疎通プリフライト
 *
 * ワークフローの `Preflight - Check Required Secrets` は GEMINI_API_KEY が
 * 「空でないこと」しか見ていない。そのため課金残高切れ・キー失効のときでも
 * npm ci / pip install / DBトンネル / 各プランナー（数分＋DB書き込み）を
 * すべて走らせたあとで、初めてWriterが落ちる。
 *
 * ここでは最小コストのリクエストを1回だけ投げ、
 *   - 課金残高切れ / キー失効  → 即座に exit 1（復旧手順つき）
 *   - 一時的なレート制限・過負荷 → 警告のみで exit 0（本編で待避・リトライする）
 * とすることで、恒久障害を数秒で、かつ人間が読める形で表面化させる。
 */

import path from 'path';
import * as dotenv from 'dotenv';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { getGeminiModelTiers } from './model_tiers';
import {
  classifyGeminiFailure,
  reportGeminiAccountBlock,
  toErrorMessage,
} from './gemini_error_policy';

dotenv.config({ path: path.join(__dirname, '../../../.env') });

/**
 * 最も安価なモデル（階層の末尾＝reserve）で疎通確認する。
 * 日次クォータ台帳（gemini_quota）には計上しない。1実行あたり1リクエストで
 * 影響が無視できるうえ、台帳ファイルを副作用として生成しないため。
 */
function pickProbeModel(): string {
  const tiers = getGeminiModelTiers('GEMINI_MODEL_TIERS');
  return tiers[tiers.length - 1] || tiers[0];
}

async function main(): Promise<void> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error('::error title=GEMINI_API_KEY未設定::GEMINI_API_KEY が設定されていません。');
    process.exit(1);
  }

  const modelName = pickProbeModel();
  console.log(`[Preflight] Gemini疎通確認: model=${modelName}`);

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: modelName,
      generationConfig: { temperature: 0, maxOutputTokens: 8 },
    });
    await model.generateContent('ok');
    console.log('[Preflight] Gemini API は利用可能です。');
    return;
  } catch (error) {
    const kind = classifyGeminiFailure(error);

    if (kind === 'account_blocked') {
      reportGeminiAccountBlock(error, 'Preflight');
      process.exit(1);
    }

    if (kind === 'api_key_invalid') {
      console.error(`[Preflight] ${toErrorMessage(error).slice(0, 400)}`);
      console.error(
        '::error title=GEMINI_API_KEY無効::APIキーが失効または漏洩判定されています。AI Studioで再発行し、GitHub Secrets の GEMINI_API_KEY を更新してください。'
      );
      process.exit(1);
    }

    // 一時障害はここで止めない。本編のリトライ／モデルフォールバックに委ねる。
    console.warn(`[Preflight] 一時的なエラーを検出しましたが処理を継続します: ${toErrorMessage(error).slice(0, 300)}`);
    console.log(`::warning title=Gemini一時エラー::プリフライトで ${kind} を検出しました。パイプライン本編のリトライで復旧を試みます。`);
  }
}

main().catch(error => {
  // プリフライト自体の想定外エラーでパイプラインを止めない
  console.warn(`[Preflight] 疎通確認をスキップします: ${toErrorMessage(error).slice(0, 300)}`);
});
