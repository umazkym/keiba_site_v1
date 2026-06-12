import fs from 'fs';
import path from 'path';
import { ARTICLE_LLM_MODELS } from './model_tiers';

const DEFAULT_MODEL_DAILY_LIMITS: Record<string, number> = {
  [ARTICLE_LLM_MODELS.high]: 15,
  [ARTICLE_LLM_MODELS.medium]: 15,
  [ARTICLE_LLM_MODELS.low]: 1500,
};

const DEFAULT_TOTAL_DAILY_LIMIT = Object.values(DEFAULT_MODEL_DAILY_LIMITS).reduce((sum, limit) => sum + limit, 0);

type GeminiUsageFile = {
  date: string;
  scopes: Record<string, {
    total: number;
    byModel: Record<string, number>;
    events: {
      at: string;
      model: string;
      purpose: string;
      target?: string;
    }[];
  }>;
};

export class GeminiQuotaExceededError extends Error {
  kind: 'total' | 'model';

  constructor(message: string, kind: 'total' | 'model') {
    super(message);
    this.name = 'GeminiQuotaExceededError';
    this.kind = kind;
  }
}

function getPacificDateKey(date = new Date()): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Los_Angeles',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });

  return formatter.format(date);
}

function getUsageFilePath(dateKey: string): string {
  return path.join(__dirname, '..', '..', '..', 'data', 'gemini_usage', `${dateKey}.json`);
}

function acquireLock(lockPath: string): boolean {
  try {
    fs.writeFileSync(lockPath, 'lock', { flag: 'wx' });
    return true;
  } catch {
    return false;
  }
}

function releaseLock(lockPath: string): void {
  try {
    if (fs.existsSync(lockPath)) {
      fs.unlinkSync(lockPath);
    }
  } catch {}
}

function runWithLockRetry<T>(targetPath: string, fn: () => T): T {
  const lockPath = targetPath + '.lock';
  let attempts = 0;
  while (attempts < 3) {
    if (acquireLock(lockPath)) {
      try {
        return fn();
      } finally {
        releaseLock(lockPath);
      }
    }
    attempts++;
    const start = Date.now();
    while (Date.now() - start < 100) {} // 100ms sync sleep
  }
  return fn();
}

function readUsage(dateKey: string): GeminiUsageFile {
  const usagePath = getUsageFilePath(dateKey);
  if (!fs.existsSync(usagePath)) {
    return { date: dateKey, scopes: {} };
  }

  return runWithLockRetry(usagePath, () => {
    try {
      return JSON.parse(fs.readFileSync(usagePath, 'utf-8'));
    } catch {
      return { date: dateKey, scopes: {} };
    }
  });
}

function writeUsage(dateKey: string, usage: GeminiUsageFile): void {
  const usagePath = getUsageFilePath(dateKey);
  fs.mkdirSync(path.dirname(usagePath), { recursive: true });
  runWithLockRetry(usagePath, () => {
    fs.writeFileSync(usagePath, JSON.stringify(usage, null, 2), 'utf-8');
  });
}

function parsePositiveInt(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function parseModelLimits(value: string | undefined): Record<string, number> {
  if (!value) return { ...DEFAULT_MODEL_DAILY_LIMITS };

  return value.split(',').reduce<Record<string, number>>((acc, pair) => {
    const [model, rawLimit] = pair.split(/[:=]/).map(part => part.trim());
    const limit = Number.parseInt(rawLimit, 10);
    if (model && Number.isFinite(limit) && limit >= 0) {
      acc[model] = limit;
    }
    return acc;
  }, { ...DEFAULT_MODEL_DAILY_LIMITS });
}

let lastNonGemmaRequestTime = 0;
let recentRequests: { at: number; tokens: number }[] = [];

function cleanOldRequests() {
  const now = Date.now();
  recentRequests = recentRequests.filter(req => now - req.at < 60000);
}

function getRecentTokensSum(): number {
  cleanOldRequests();
  return recentRequests.reduce((sum, req) => sum + req.tokens, 0);
}

export async function reserveGeminiRequest(input: {
  scope: 'article';
  model: string;
  purpose: string;
  target?: string;
}): Promise<void> {
  const dateKey = getPacificDateKey();
  const usage = readUsage(dateKey);
  const scopeUsage = usage.scopes[input.scope] || { total: 0, byModel: {}, events: [] };
  const totalLimit = parsePositiveInt(process.env.GEMINI_ARTICLE_DAILY_REQUEST_LIMIT, DEFAULT_TOTAL_DAILY_LIMIT);
  const modelLimits = parseModelLimits(process.env.GEMINI_ARTICLE_MODEL_DAILY_LIMITS);
  const modelUsage = scopeUsage.byModel[input.model] || 0;
  const modelLimit = modelLimits[input.model];

  if (scopeUsage.total >= totalLimit) {
    throw new GeminiQuotaExceededError(
      `Gemini article quota exceeded: total=${scopeUsage.total}, limit=${totalLimit}, date=${dateKey}`,
      'total'
    );
  }

  if (modelLimit !== undefined && modelUsage >= modelLimit) {
    throw new GeminiQuotaExceededError(
      `Gemini model quota exceeded: model=${input.model}, used=${modelUsage}, limit=${modelLimit}, date=${dateKey}`,
      'model'
    );
  }

  // TPM セーフガードスリープ
  cleanOldRequests();
  const currentTpm = getRecentTokensSum();
  const tpmLimit = 180000; // 180K
  if (currentTpm >= tpmLimit) {
    const sleepSec = 30 + Math.floor(Math.random() * 31); // 30〜60秒
    console.log(`[GeminiQuota] TPM Safeguard sleep: Current TPM=${currentTpm} >= ${tpmLimit}. Sleeping for ${sleepSec}s...`);
    await new Promise(resolve => setTimeout(resolve, sleepSec * 1000));
    lastNonGemmaRequestTime = Date.now();
  }

  // 中性能・高性能モデル (Gemma以外) の呼び出し間に最低 12 秒のインターバルを强制
  const isGemma = /gemma/i.test(input.model);
  if (!isGemma) {
    const now = Date.now();
    const elapsed = now - lastNonGemmaRequestTime;
    const minInterval = 12000; // 12秒
    if (elapsed < minInterval) {
      const waitMs = minInterval - elapsed;
      console.log(`[GeminiQuota] Rate limit protection: Sleeping for ${waitMs}ms before requesting ${input.model}...`);
      await new Promise(resolve => setTimeout(resolve, waitMs));
    }
    lastNonGemmaRequestTime = Date.now();
  }

  scopeUsage.total += 1;
  scopeUsage.byModel[input.model] = modelUsage + 1;
  scopeUsage.events.push({
    at: new Date().toISOString(),
    model: input.model,
    purpose: input.purpose,
    target: input.target,
  });
  usage.scopes[input.scope] = scopeUsage;
  writeUsage(dateKey, usage);

  console.log(`[GeminiQuota] ${input.scope}: ${scopeUsage.total}/${totalLimit} requests reserved for ${input.model}`);

  // モデル監査ログを logs/article_build_audit.json に出力
  try {
    const auditPath = path.join(__dirname, '..', '..', '..', 'logs', 'article_build_audit.json');
    fs.mkdirSync(path.dirname(auditPath), { recursive: true });
    runWithLockRetry(auditPath, () => {
      const auditData = fs.existsSync(auditPath) ? JSON.parse(fs.readFileSync(auditPath, 'utf-8')) : [];
      auditData.push({
        timestamp: new Date().toISOString(),
        model: input.model,
        purpose: input.purpose,
        target: input.target || null,
      });
      fs.writeFileSync(auditPath, JSON.stringify(auditData, null, 2), 'utf-8');
    });
  } catch (err: any) {
    console.error(`[GeminiQuota] Failed to write audit log: ${err.message}`);
  }
}

export async function rollbackGeminiRequest(input: {
  scope: 'article';
  model: string;
  purpose: string;
  target?: string;
}): Promise<void> {
  const dateKey = getPacificDateKey();
  const usage = readUsage(dateKey);
  const scopeUsage = usage.scopes[input.scope];
  if (scopeUsage) {
    if (scopeUsage.total > 0) {
      scopeUsage.total -= 1;
    }
    const modelUsage = scopeUsage.byModel[input.model] || 0;
    if (modelUsage > 0) {
      scopeUsage.byModel[input.model] = modelUsage - 1;
    }
    scopeUsage.events.push({
      at: new Date().toISOString(),
      model: input.model,
      purpose: `ROLLBACK-${input.purpose}`,
      target: input.target,
    });
    usage.scopes[input.scope] = scopeUsage;
    writeUsage(dateKey, usage);
    console.log(`[GeminiQuota] Rollback successful: ${scopeUsage.total} total requests remain.`);
  }

  // ロールバック時も lastNonGemmaRequestTime を更新して12秒インターバルを強制維持
  const isGemma = /gemma/i.test(input.model);
  if (!isGemma) {
    lastNonGemmaRequestTime = Date.now();
  }
}

export async function recordTokenUsage(input: {
  scope: 'article';
  model: string;
  promptTokens: number;
  outputTokens: number;
  totalTokens: number;
  target?: string;
}): Promise<void> {
  const calculatedTokens = input.promptTokens + input.outputTokens;
  
  // 異常トークン検知 (乖離が1.5倍以上、またはトータル30k以上)
  const isAbnormal = (input.totalTokens >= calculatedTokens * 1.5) || (input.totalTokens >= 30000);
  
  if (isAbnormal) {
    console.warn(`[GeminiQuota] Abnormal token detected! input=${input.promptTokens}, output=${input.outputTokens}, total=${input.totalTokens}`);
  }

  // TPM計算には実計算値を適用
  recentRequests.push({
    at: Date.now(),
    tokens: calculatedTokens
  });

  // 監査ログに記録
  try {
    const auditPath = path.join(__dirname, '..', '..', '..', 'logs', 'article_build_audit.json');
    fs.mkdirSync(path.dirname(auditPath), { recursive: true });
    
    runWithLockRetry(auditPath, () => {
      const auditData = fs.existsSync(auditPath) ? JSON.parse(fs.readFileSync(auditPath, 'utf-8')) : [];
      auditData.push({
        timestamp: new Date().toISOString(),
        model: input.model,
        purpose: 'token-usage-recording',
        target: input.target || null,
        prompt_tokens: input.promptTokens,
        output_tokens: input.outputTokens,
        reported_total_tokens: input.totalTokens,
        calculated_tokens: calculatedTokens,
        abnormal_token: isAbnormal
      });
      fs.writeFileSync(auditPath, JSON.stringify(auditData, null, 2), 'utf-8');
    });
  } catch (err: any) {
    console.error(`[GeminiQuota] Failed to write token audit log: ${err.message}`);
  }
}
