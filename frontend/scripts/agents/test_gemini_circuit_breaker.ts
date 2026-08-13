import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  isGeminiCircuitOpen,
  loadGeminiCircuitState,
  recordGeminiFailure,
  recordGeminiSuccess,
} from './gemini_circuit_breaker';
import { classifyGeminiFailure, isRetryableGeminiError } from './gemini_failure';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'gemini-circuit-'));
const statePath = path.join(root, 'state.json');
const base = new Date('2026-08-13T00:00:00.000Z');

assert.equal(classifyGeminiFailure(new Error('429 Too Many Requests: Your prepayment credits are depleted.')), 'billing_depleted');
assert.equal(isRetryableGeminiError(new Error('prepayment credits are depleted')), false);
assert.equal(classifyGeminiFailure(new Error('503 high demand')), 'service_unavailable');
assert.equal(isRetryableGeminiError(new Error('503 high demand')), true);

const opened = recordGeminiFailure(statePath, 'billing_depleted', 'prepayment credits are depleted', base);
assert.equal(opened.status, 'open');
assert.equal(isGeminiCircuitOpen(opened, new Date('2026-08-13T01:00:00.000Z')), true);
assert.equal(isGeminiCircuitOpen(opened, new Date('2026-08-13T13:00:00.000Z')), false);

process.env.GEMINI_API_KEY = 'secret-unit-test-key';
const redacted = recordGeminiFailure(
  statePath,
  'api_key_invalid',
  'api_key=visible-value Bearer abc.123 secret-unit-test-key',
  base,
);
assert.equal(redacted.reason?.includes('visible-value'), false);
assert.equal(redacted.reason?.includes('abc.123'), false);
assert.equal(redacted.reason?.includes('secret-unit-test-key'), false);

const closed = recordGeminiSuccess(statePath, new Date('2026-08-13T13:00:00.000Z'));
assert.equal(closed.status, 'closed');
assert.equal(closed.consecutive_failures, 0);
assert.equal(loadGeminiCircuitState(statePath).last_success_at, '2026-08-13T13:00:00.000Z');

fs.rmSync(root, { recursive: true, force: true });
console.log('gemini circuit breaker: OK');
