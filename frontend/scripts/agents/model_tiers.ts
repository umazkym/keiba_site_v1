const DEFAULT_GEMINI_MODEL_TIERS = [
  'gemini-2.5-flash-lite',
  'gemini-2.5-flash',
];

export function getGeminiModelTiers(envName = 'GEMINI_MODEL_TIERS'): string[] {
  const configured = (process.env[envName] || process.env.GEMINI_MODEL_TIERS)
    ?.split(',')
    .map(model => model.trim())
    .filter(Boolean);

  return configured && configured.length > 0
    ? configured
    : DEFAULT_GEMINI_MODEL_TIERS;
}
