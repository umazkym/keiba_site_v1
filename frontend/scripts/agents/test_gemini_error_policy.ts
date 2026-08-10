import assert from 'assert';
import {
  classifyGeminiFailure,
  isApiKeyInvalidError,
  isGeminiAccountBlockedError,
  isRetryableGeminiError,
} from './gemini_error_policy';

/**
 * 2026-08-05以降に連日パイプラインを落とした実際のエラー文言。
 * 429だが「リトライしても永久に直らない」ため、必ず account_blocked に分類されること。
 */
const PREPAYMENT_DEPLETED = new Error(
  '[GoogleGenerativeAI Error]: Error fetching from https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent: [429 Too Many Requests] Your prepayment credits are depleted. Please go to AI Studio at https://ai.studio/projects to manage your project and billing. Learn more at https://ai.google.dev/gemini-api/docs/billing#prepay.'
);

assert.equal(classifyGeminiFailure(PREPAYMENT_DEPLETED), 'account_blocked');
assert.equal(isGeminiAccountBlockedError(PREPAYMENT_DEPLETED), true);
// 最重要: 429を含んでいてもリトライ対象にしない
assert.equal(isRetryableGeminiError(PREPAYMENT_DEPLETED), false);
assert.equal(isApiKeyInvalidError(PREPAYMENT_DEPLETED), false);

// 他の課金・アカウント系
for (const message of [
  '[429 Too Many Requests] Insufficient credits for this project.',
  'Billing account for project keiba-api-project is not configured.',
  '[403] Please enable billing on project 123456.',
  'Permission denied: consumer keiba-api-project has been suspended.',
]) {
  assert.equal(
    classifyGeminiFailure(new Error(message)),
    'account_blocked',
    `account_blockedに分類されるべき: ${message}`
  );
  assert.equal(isRetryableGeminiError(new Error(message)), false, `リトライ対象外であるべき: ${message}`);
}

/** 純粋なレート制限・過負荷は従来どおりリトライ対象のまま維持されること。 */
for (const message of [
  '[429 Too Many Requests] Quota exceeded for quota metric "Generate requests per minute".',
  '[503 Service Unavailable] The model is overloaded. Please try again later.',
  '[500 Internal Server Error] Internal error encountered.',
  'request timeout',
  'fetch failed',
]) {
  const error = new Error(message);
  assert.equal(classifyGeminiFailure(error), 'rate_limited', `rate_limitedに分類されるべき: ${message}`);
  assert.equal(isRetryableGeminiError(error), true, `リトライ対象であるべき: ${message}`);
  assert.equal(isGeminiAccountBlockedError(error), false, `課金エラーではない: ${message}`);
}

/** APIキー失効はリトライもフォールバックもしない。 */
for (const message of [
  'API key not valid. Please pass a valid API key.',
  '[400] API_KEY_INVALID',
  'The API key was reported as leaked and has been disabled.',
]) {
  const error = new Error(message);
  assert.equal(classifyGeminiFailure(error), 'api_key_invalid', `api_key_invalidに分類されるべき: ${message}`);
  assert.equal(isRetryableGeminiError(error), false);
  assert.equal(isGeminiAccountBlockedError(error), false);
}

/** それ以外は fatal（モデルを替える価値はあるが待っても直らない）。 */
assert.equal(classifyGeminiFailure(new Error('JSON object not found in strategy response.')), 'fatal');
assert.equal(isRetryableGeminiError(new Error('JSON object not found in strategy response.')), false);

/** Error以外の入力でも落ちないこと。 */
assert.equal(classifyGeminiFailure(undefined), 'fatal');
assert.equal(classifyGeminiFailure('Your prepayment credits are depleted.'), 'account_blocked');
assert.equal(classifyGeminiFailure({ message: 'The model is overloaded.' }), 'rate_limited');

console.log('Gemini error policy tests passed.');
