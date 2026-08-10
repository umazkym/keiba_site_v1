/**
 * Gemini API 失敗の分類ポリシー（Writer / Editor / GSC改稿の共通判定）
 *
 * 【なぜ必要か】
 * Gemini APIは「一時的なレート制限」も「課金残高切れ（アカウント停止に近い恒久障害）」も
 * 同じ HTTP 429 で返す。メッセージ本文だけが両者を区別する。
 *
 *   一時的:  429 Too Many Requests / quota exceeded for quota metric ... per minute
 *   恒久的:  429 Too Many Requests. Your prepayment credits are depleted.
 *
 * 429という数字だけを見て「リトライ可能」と判定すると、恒久障害のときに
 *   モデル階層(4) × リトライ(2) × 記事(3) × 1日3回のスケジュール
 * ぶんだけ絶対に成功しないリクエストを撃ち続け、待機で数十分を浪費し、
 * さらに日次クォータ台帳を失敗で食い潰す。実際にこれが2026-08-05以降の
 * 連日失敗（同一エラーの反復）を引き起こした。
 *
 * そこで失敗を4種類に分類し、恒久障害では「即時停止 + 人間向けの復旧手順提示」を行う。
 */

import fs from 'fs';

export type GeminiFailureKind =
  /** APIキーが無効・漏洩失効・権限不足。人間がキーを再発行するまで復旧しない。 */
  | 'api_key_invalid'
  /** 課金残高切れ・請求無効・プロジェクト停止。人間が課金を復旧するまで全モデルで失敗する。 */
  | 'account_blocked'
  /** レート制限・過負荷・タイムアウト等。待てば直る可能性があるためリトライ対象。 */
  | 'rate_limited'
  /** 上記以外（プロンプト起因・パース失敗など）。モデルを替える価値はあるが待っても直らない。 */
  | 'fatal';

/**
 * 課金・アカウント状態に起因する恒久障害のシグネチャ。
 * どれも「別モデルへフォールバックしても」「時間を置いても」解決しない。
 */
const ACCOUNT_BLOCKED_PATTERNS: RegExp[] = [
  // AI Studio のプリペイド残高切れ（今回の事象）
  /prepayment\s+credits?\s+are\s+depleted/i,
  /prepay(ment)?\s+credits?/i,
  /credits?\s+(are\s+)?(depleted|exhausted)/i,
  /insufficient\s+credits?/i,
  /out\s+of\s+credits?/i,
  // 請求先そのものが無効・未設定
  /billing\s+account/i,
  /billing\s+(is\s+)?(not\s+enabled|disabled)/i,
  /enable\s+billing/i,
  /BILLING_DISABLED/i,
  /docs\/billing/i,
  // プロジェクト／コンシューマの停止
  /consumer[^.]*has\s+been\s+suspended/i,
  /CONSUMER_SUSPENDED/i,
  /ACCOUNT_STATE_INVALID/i,
  /project[^.]*(is\s+)?suspended/i,
];

/** APIキー自体が使えない（403系）。課金判定より後に評価する。 */
const API_KEY_INVALID_PATTERNS =
  /API key was reported as leaked|API_KEY_INVALID|API key not valid|PERMISSION_DENIED|Forbidden|403/i;

/** 待てば直る可能性のある一時障害。 */
const TRANSIENT_PATTERNS =
  /429|500|502|503|504|quota|rate limit|resource exhausted|too many requests|service unavailable|high demand|overloaded|unavailable|timeout|ETIMEDOUT|ECONNRESET|socket hang up|fetch failed/i;

export function toErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    // GoogleGenerativeAI のエラーは message にHTTP本文を連結して持つ
    return `${error.message} ${(error as any).statusText || ''}`.trim();
  }
  if (error && typeof error === 'object') {
    try {
      return JSON.stringify(error);
    } catch {
      return String(error);
    }
  }
  return String(error || '');
}

export function classifyGeminiFailure(error: unknown): GeminiFailureKind {
  const message = toErrorMessage(error);

  // 課金・アカウント停止は429で返るため、必ず一時障害判定より先に評価する。
  if (ACCOUNT_BLOCKED_PATTERNS.some(pattern => pattern.test(message))) {
    return 'account_blocked';
  }
  if (API_KEY_INVALID_PATTERNS.test(message)) {
    return 'api_key_invalid';
  }
  if (TRANSIENT_PATTERNS.test(message)) {
    return 'rate_limited';
  }
  return 'fatal';
}

/** 課金残高切れ等、人間が課金を復旧するまで全モデルで失敗し続ける状態か。 */
export function isGeminiAccountBlockedError(error: unknown): boolean {
  return classifyGeminiFailure(error) === 'account_blocked';
}

/** APIキー無効・漏洩失効。 */
export function isApiKeyInvalidError(error: unknown): boolean {
  return classifyGeminiFailure(error) === 'api_key_invalid';
}

/**
 * リトライ・モデルフォールバックを行う価値があるか。
 * account_blocked / api_key_invalid は false（撃っても必ず失敗するため）。
 */
export function isRetryableGeminiError(error: unknown): boolean {
  return classifyGeminiFailure(error) === 'rate_limited';
}

export const GEMINI_ACCOUNT_BLOCKED_HEADLINE =
  'Gemini APIの課金残高が枯渇しています（全モデル・全リトライが失敗します）';

export function describeGeminiAccountBlock(error: unknown): string {
  return [
    `[CRITICAL] ${GEMINI_ACCOUNT_BLOCKED_HEADLINE}`,
    `原因: ${toErrorMessage(error).slice(0, 400)}`,
    '',
    'これはレート制限ではなくアカウント（課金）状態のエラーです。',
    'モデル階層のフォールバックもリトライも復旧手段になりません。以下の人手対応が必要です。',
    '  1. https://ai.studio/projects で対象プロジェクトのプリペイド残高を確認し、チャージする',
    '  2. 課金の自動チャージ（auto-reload）を有効にし、再発を防ぐ',
    '  3. 復旧後にこのワークフローを再実行する',
    '',
    'write_orderは未消費のまま保持しているため、復旧後の再実行で同じ記事から再開できます。',
  ].join('\n');
}

/**
 * GitHub Actions のログ上部（Annotations）とジョブサマリに復旧手順を出す。
 * ログ末尾の exit code 1 だけでは「コードのバグ」と区別できず、5日間放置される原因になった。
 */
export function reportGeminiAccountBlock(error: unknown, context: string): void {
  const detail = describeGeminiAccountBlock(error);
  console.error(`\n${detail}\n`);

  if (process.env.GITHUB_ACTIONS === 'true') {
    // ::error:: はワークフロー画面の最上部に出る
    const oneLine = `${GEMINI_ACCOUNT_BLOCKED_HEADLINE} (${context}) — https://ai.studio/projects でプリペイド残高をチャージしてください`;
    console.error(`::error title=Gemini課金残高切れ::${oneLine}`);
  }

  const summaryPath = process.env.GITHUB_STEP_SUMMARY;
  if (summaryPath) {
    try {
      fs.appendFileSync(
        summaryPath,
        [
          '',
          `## ❌ ${GEMINI_ACCOUNT_BLOCKED_HEADLINE}`,
          '',
          `- 発生箇所: \`${context}\``,
          '- 種別: アカウント課金エラー（リトライ・モデルフォールバックでは復旧しません）',
          '- 対応: [AI Studio](https://ai.studio/projects) でプリペイド残高をチャージ → 本ワークフローを再実行',
          '- write_orderは未消費のまま保持しているため、記事の取りこぼしは発生しません。',
          '',
        ].join('\n'),
        'utf-8',
      );
    } catch {
      // サマリ出力の失敗で本処理を止めない
    }
  }
}
