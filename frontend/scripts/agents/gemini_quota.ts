import fs from 'fs';
import path from 'path';

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

function readUsage(dateKey: string): GeminiUsageFile {
  const usagePath = getUsageFilePath(dateKey);
  if (!fs.existsSync(usagePath)) {
    return { date: dateKey, scopes: {} };
  }

  try {
    return JSON.parse(fs.readFileSync(usagePath, 'utf-8'));
  } catch {
    return { date: dateKey, scopes: {} };
  }
}

function writeUsage(dateKey: string, usage: GeminiUsageFile): void {
  const usagePath = getUsageFilePath(dateKey);
  fs.mkdirSync(path.dirname(usagePath), { recursive: true });
  fs.writeFileSync(usagePath, JSON.stringify(usage, null, 2), 'utf-8');
}

function parsePositiveInt(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function parseModelLimits(value: string | undefined): Record<string, number> {
  if (!value) return {};

  return value.split(',').reduce<Record<string, number>>((acc, pair) => {
    const [model, rawLimit] = pair.split(/[:=]/).map(part => part.trim());
    const limit = Number.parseInt(rawLimit, 10);
    if (model && Number.isFinite(limit) && limit >= 0) {
      acc[model] = limit;
    }
    return acc;
  }, {});
}

export function reserveGeminiRequest(input: {
  scope: 'article';
  model: string;
  purpose: string;
  target?: string;
}): void {
  const dateKey = getPacificDateKey();
  const usage = readUsage(dateKey);
  const scopeUsage = usage.scopes[input.scope] || { total: 0, byModel: {}, events: [] };
  const totalLimit = parsePositiveInt(process.env.GEMINI_ARTICLE_DAILY_REQUEST_LIMIT, 10);
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
}
