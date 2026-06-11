export const ARTICLE_LLM_MODELS = {
  high: 'gemini-3.5-flash',
  medium: 'gemini-3-flash-preview',
  low: 'gemma-4-31b-it',
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
    ARTICLE_LLM_MODELS.medium,
    ARTICLE_LLM_MODELS.high,
    ARTICLE_LLM_MODELS.low,
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
    `high=${ARTICLE_LLM_MODELS.high}（初稿・重要判断）`,
    `medium=${ARTICLE_LLM_MODELS.medium}（最終編集・フォールバック）`,
    `low=${ARTICLE_LLM_MODELS.low}（検索意図ブリーフ・複数回添削）`,
  ].join(' / ');
}
