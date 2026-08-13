export type GeminiFailureKind =
  | 'billing_depleted'
  | 'api_key_invalid'
  | 'rate_limited'
  | 'quota_exhausted'
  | 'service_unavailable'
  | 'timeout'
  | 'unknown';

export function geminiErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error || '');
}

export function classifyGeminiFailure(error: unknown): GeminiFailureKind {
  const message = geminiErrorMessage(error);
  if (/prepayment credits? (?:are|is) depleted|insufficient (?:prepaid )?credits?|billing (?:account )?(?:is )?(?:disabled|suspended)|payment required/i.test(message)) {
    return 'billing_depleted';
  }
  if (/API key was reported as leaked|API_KEY_INVALID|API key not valid|Forbidden|\b403\b/i.test(message)) {
    return 'api_key_invalid';
  }
  if (/daily (?:request )?limit|quota exhausted|resource exhausted|quota guard/i.test(message)) {
    return 'quota_exhausted';
  }
  if (/\b429\b|rate limit|too many requests/i.test(message)) {
    return 'rate_limited';
  }
  if (/\b503\b|service unavailable|high demand|overloaded|temporarily unavailable/i.test(message)) {
    return 'service_unavailable';
  }
  if (/timeout|timed out|deadline exceeded/i.test(message)) {
    return 'timeout';
  }
  return 'unknown';
}

export function isApiKeyInvalidError(error: unknown): boolean {
  return classifyGeminiFailure(error) === 'api_key_invalid';
}

export function isRetryableGeminiError(error: unknown): boolean {
  return ['rate_limited', 'service_unavailable', 'timeout'].includes(classifyGeminiFailure(error));
}

export function shouldOpenGeminiCircuit(kind: GeminiFailureKind): boolean {
  return kind !== 'unknown';
}
