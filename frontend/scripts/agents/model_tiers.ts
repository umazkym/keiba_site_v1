/**
 * 競馬記事生成で利用するGeminiモデル。値は2026-07-22時点の提供枠に合わせる。
 * 上から品質順で、WriterとEditorはこの順序を崩さずフォールバックする。
 */
export const ARTICLE_LLM_MODELS = {
  high: 'gemini-3.6-flash',
  medium: 'gemini-3.5-flash',
  efficient: 'gemini-3.5-flash-lite',
  reserve: 'gemini-3.1-flash-lite',
} as const;

export type ArticleLlmModel = typeof ARTICLE_LLM_MODELS[keyof typeof ARTICLE_LLM_MODELS];

export const ARTICLE_LLM_MODEL_LIMITS: Record<ArticleLlmModel, {
  rpm: number;
  tpm: number;
  rpd: number;
}> = {
  [ARTICLE_LLM_MODELS.high]: { rpm: 5, tpm: 250_000, rpd: 20 },
  [ARTICLE_LLM_MODELS.medium]: { rpm: 5, tpm: 250_000, rpd: 20 },
  [ARTICLE_LLM_MODELS.efficient]: { rpm: 15, tpm: 250_000, rpd: 500 },
  // 提供情報の「250」をそのまま適用する。250Kへ推測補正しない。
  [ARTICLE_LLM_MODELS.reserve]: { rpm: 15, tpm: 250, rpd: 500 },
};

const DEFAULT_GEMINI_MODEL_TIERS = [
  ARTICLE_LLM_MODELS.high,
  ARTICLE_LLM_MODELS.medium,
  ARTICLE_LLM_MODELS.efficient,
  ARTICLE_LLM_MODELS.reserve,
];

const DEFAULT_ROLE_MODEL_TIERS: Record<string, string[]> = {
  // 構成案と複数観点レビューは呼び出し回数が多いため、RPD 500のLite系を主力にする。
  GEMINI_STRATEGY_MODEL_TIERS: [
    ARTICLE_LLM_MODELS.efficient,
    ARTICLE_LLM_MODELS.reserve,
    ARTICLE_LLM_MODELS.medium,
  ],
  GEMINI_WRITER_MODEL_TIERS: [...DEFAULT_GEMINI_MODEL_TIERS],
  GEMINI_GEMMA_REVIEW_MODEL_TIERS: [
    ARTICLE_LLM_MODELS.efficient,
    ARTICLE_LLM_MODELS.reserve,
    ARTICLE_LLM_MODELS.medium,
  ],
  GEMINI_EDITOR_MODEL_TIERS: [...DEFAULT_GEMINI_MODEL_TIERS],
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
    `high=${ARTICLE_LLM_MODELS.high}（Writer初稿・Editor主力）`,
    `medium=${ARTICLE_LLM_MODELS.medium}（品質重視の第2候補）`,
    `efficient=${ARTICLE_LLM_MODELS.efficient}（Strategy/レビュー主力）`,
    `reserve=${ARTICLE_LLM_MODELS.reserve}（最終フォールバック）`,
  ].join(' / ');
}
