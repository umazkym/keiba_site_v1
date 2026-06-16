/**
 * 競馬記事生成におけるGeminiモデルの賢さ順（モデル制限・クォータ情報）:
 * 1. gemini-3.1-pro-preview  (RPM: 0, TPM: 0,    RPD: 0)   - 使用不可
 * 2. gemini-3.5-flash        (RPM: 5, TPM: 250K, RPD: 20)  - 使用可能（実質最上位・高精度・Writer初稿に使用）
 * 3. gemini-2.5-pro          (RPM: 0, TPM: 0,    RPD: 0)   - 使用不可
 * 4. gemini-3-flash-preview  (RPM: 5, TPM: 250K, RPD: 20)  - 使用可能（実質中位・Editor最終フォールバック）
 * 5. gemini-2.5-flash        (RPM: 5, TPM: 250K, RPD: 20)  - 使用可能（リザーブ）
 * 6. gemini-3.1-flash-lite   (RPM: 15, TPM: 250K, RPD: 500) - 使用可能（回数重視ロール＝Strategy/GemmaReviewの主力。EditorのLite最終フォールバックとしても使用）
 * 7. gemini-2.5-flash-lite   (RPM: 10, TPM: 250K, RPD: 20)  - 使用可能（賢さ最下位かつRPD極小のため実質非推奨）
 *
 * 【ロール別モデル選定方針】
 * 賢さ重視ロール（Writer初稿・Editor審査）:
 *   gemini-3.5-flash → gemini-3-flash-preview → gemini-3.1-flash-lite の順でフォールバック。
 *   上位モデルが503/429/クォータ超過の場合にのみ次のモデルへ降格する。
 * 回数重視ロール（Strategy/GemmaReview）:
 *   gemini-3.1-flash-lite を主力として使用（RPD 500）。余裕があれば medium を補助的に使用。
 */
export const ARTICLE_LLM_MODELS = {
  high: 'gemini-3.5-flash',
  medium: 'gemini-3-flash-preview',
  low: 'gemini-3.1-flash-lite',
} as const;

const DEFAULT_GEMINI_MODEL_TIERS = [
  ARTICLE_LLM_MODELS.high,
  ARTICLE_LLM_MODELS.medium,
  ARTICLE_LLM_MODELS.low,
];

const DEFAULT_ROLE_MODEL_TIERS: Record<string, string[]> = {
  GEMINI_STRATEGY_MODEL_TIERS: [
    ARTICLE_LLM_MODELS.low,
    ARTICLE_LLM_MODELS.medium,
  ],
  GEMINI_WRITER_MODEL_TIERS: [
    ARTICLE_LLM_MODELS.high,
    ARTICLE_LLM_MODELS.medium,
    ARTICLE_LLM_MODELS.low,
  ],
  GEMINI_GEMMA_REVIEW_MODEL_TIERS: [
    ARTICLE_LLM_MODELS.low,
    ARTICLE_LLM_MODELS.medium,
  ],
  GEMINI_EDITOR_MODEL_TIERS: [
    ARTICLE_LLM_MODELS.high,    // gemini-3.5-flash: 賢さ最上位（RPD 20）・Editor主力
    ARTICLE_LLM_MODELS.medium,  // gemini-3-flash-preview: 次点フォールバック（RPD 20）
    ARTICLE_LLM_MODELS.low,     // gemini-3.1-flash-lite: 最終フォールバック（RPD 500）
  ],
};

export function getGeminiModelTiers(envName = 'GEMINI_MODEL_TIERS'): string[] {
  const configured = process.env[envName]
    ?.split(',')
    .map(model => model.trim())
    .filter(Boolean);

  if (configured && configured.length > 0) return configured;
  if (DEFAULT_ROLE_MODEL_TIERS[envName]) return DEFAULT_ROLE_MODEL_TIERS[envName];

  const genericConfigured = process.env.GEMINI_MODEL_TIERS
    ?.split(',')
    .map(model => model.trim())
    .filter(Boolean);

  return genericConfigured && genericConfigured.length > 0
    ? genericConfigured
    : DEFAULT_GEMINI_MODEL_TIERS;
}

export function getArticleLlmStrategySummary(): string {
  return [
    `high=${ARTICLE_LLM_MODELS.high}（Writer初稿・Editor主力、賢さ重視）`,
    `medium=${ARTICLE_LLM_MODELS.medium}（高/低失敗時フォールバック）`,
    `low=${ARTICLE_LLM_MODELS.low}（Strategy/GemmaReview主力、回数重視）`,
  ].join(' / ');
}
