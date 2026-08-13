import fs from 'node:fs';
import path from 'node:path';
import type { GeminiFailureKind } from './gemini_failure';

export type GeminiCircuitState = {
  schema_version: 'gemini-article-circuit.v1';
  status: 'closed' | 'open';
  consecutive_failures: number;
  last_failure_kind?: GeminiFailureKind;
  last_failure_at?: string;
  last_success_at?: string;
  open_until?: string;
  reason?: string;
};

const DEFAULT_STATE: GeminiCircuitState = {
  schema_version: 'gemini-article-circuit.v1',
  status: 'closed',
  consecutive_failures: 0,
};

function positiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value || '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function loadGeminiCircuitState(filePath: string): GeminiCircuitState {
  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8')) as Partial<GeminiCircuitState>;
    if (parsed.schema_version !== 'gemini-article-circuit.v1') return { ...DEFAULT_STATE };
    return {
      ...DEFAULT_STATE,
      ...parsed,
      consecutive_failures: Math.max(0, Number(parsed.consecutive_failures) || 0),
    };
  } catch {
    return { ...DEFAULT_STATE };
  }
}

export function saveGeminiCircuitState(filePath: string, state: GeminiCircuitState): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const temporary = `${filePath}.tmp`;
  fs.writeFileSync(temporary, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
  fs.renameSync(temporary, filePath);
}

export function isGeminiCircuitOpen(state: GeminiCircuitState, now = new Date()): boolean {
  if (state.status !== 'open' || !state.open_until) return false;
  const openUntil = new Date(state.open_until);
  return Number.isFinite(openUntil.getTime()) && now < openUntil;
}

function cooldownHours(kind: GeminiFailureKind, consecutiveFailures: number): number {
  if (kind === 'billing_depleted') {
    return positiveInt(process.env.ARTICLE_GEMINI_BILLING_COOLDOWN_HOURS, 12);
  }
  if (kind === 'api_key_invalid') {
    return positiveInt(process.env.ARTICLE_GEMINI_AUTH_COOLDOWN_HOURS, 24);
  }
  if (kind === 'quota_exhausted') {
    return positiveInt(process.env.ARTICLE_GEMINI_QUOTA_COOLDOWN_HOURS, 6);
  }
  const base = positiveInt(process.env.ARTICLE_GEMINI_TRANSIENT_COOLDOWN_MINUTES, 60) / 60;
  return consecutiveFailures >= 2 ? base : 0;
}

function redactCircuitReason(reason: string): string {
  let redacted = reason.replace(/(?:Bearer\s+)[A-Za-z0-9._~+\/-]+/gi, 'Bearer [REDACTED]');
  redacted = redacted.replace(/(api[_-]?key|refresh[_-]?token|client[_-]?secret)\s*[:=]\s*[^\s,;]+/gi, '$1=[REDACTED]');
  for (const name of ['GEMINI_API_KEY', 'GOOGLE_API_KEY']) {
    const secret = process.env[name];
    if (secret && secret.length >= 8) redacted = redacted.split(secret).join('[REDACTED]');
  }
  return redacted.replace(/\s+/g, ' ').slice(0, 240);
}

export function recordGeminiFailure(
  filePath: string,
  kind: GeminiFailureKind,
  reason: string,
  now = new Date(),
): GeminiCircuitState {
  const current = loadGeminiCircuitState(filePath);
  const consecutiveFailures = current.consecutive_failures + 1;
  const hours = cooldownHours(kind, consecutiveFailures);
  const openUntil = new Date(now.getTime() + hours * 60 * 60 * 1000);
  const state: GeminiCircuitState = {
    ...current,
    status: hours > 0 ? 'open' : 'closed',
    consecutive_failures: consecutiveFailures,
    last_failure_kind: kind,
    last_failure_at: now.toISOString(),
    open_until: hours > 0 ? openUntil.toISOString() : undefined,
    reason: redactCircuitReason(reason),
  };
  saveGeminiCircuitState(filePath, state);
  return state;
}

export function recordGeminiSuccess(filePath: string, now = new Date()): GeminiCircuitState {
  const current = loadGeminiCircuitState(filePath);
  const state: GeminiCircuitState = {
    ...current,
    status: 'closed',
    consecutive_failures: 0,
    last_success_at: now.toISOString(),
    open_until: undefined,
    reason: undefined,
  };
  saveGeminiCircuitState(filePath, state);
  return state;
}

function appendSummary(lines: string[]): void {
  const summaryPath = process.env.GITHUB_STEP_SUMMARY;
  if (summaryPath) fs.appendFileSync(summaryPath, `${lines.join('\n')}\n`, 'utf8');
}

function setOutput(name: string, value: string): void {
  const outputPath = process.env.GITHUB_OUTPUT;
  if (outputPath) fs.appendFileSync(outputPath, `${name}=${value}\n`, 'utf8');
}

function argValue(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

if (require.main === module) {
  const command = process.argv[2] || 'check';
  const statePath = argValue('--state') || process.env.GEMINI_CIRCUIT_STATE_PATH || '';
  if (!statePath) throw new Error('Geminiサーキット状態ファイルを指定してください。');
  const state = loadGeminiCircuitState(statePath);
  const blocked = isGeminiCircuitOpen(state);
  setOutput('blocked', blocked ? 'true' : 'false');
  setOutput('status', state.status);
  setOutput('open_until', state.open_until || '');
  if (command === 'check') {
    appendSummary([
      '## Gemini記事生成サーキット',
      '',
      `- 状態: ${blocked ? '停止中' : '実行可能'}`,
      `- 連続失敗: ${state.consecutive_failures}`,
      `- 最終失敗種別: ${state.last_failure_kind || 'なし'}`,
      `- 次回試行可能時刻: ${state.open_until || '制限なし'}`,
      '',
    ]);
    if (blocked) {
      console.warn(`::warning::Gemini記事生成をサーキットブレーカーで停止します。再試行可能: ${state.open_until}`);
    }
  }
}
