/**
 * Monetization retry idempotency guard.
 *
 * `watchAd` and `purchaseCoins` retry the callable up to 3 times. The server
 * credits/mints keyed on `idempotencyKey` (functions/monetization.js
 * `generateIdempotencyKey(data.idempotencyKey)` -> `idempotency_ledger`). If the
 * client let the key default to a fresh uuid on each attempt, a request that
 * succeeded server-side but failed in transit would be retried with a NEW key
 * and credit the reward / mint the coins a second time. The key must therefore
 * be built ONCE per logical operation and reused on every retry.
 *
 * @jest-environment node
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const svc = fs.readFileSync(path.join(root, 'src/services/monetizationService.js'), 'utf8');

const methodBody = (name) => {
  const start = svc.indexOf(`async ${name}(`);
  expect(start).toBeGreaterThan(-1);
  // Body is short; a generous window is enough to capture the retry call.
  return svc.slice(start, start + 4200);
};

describe('monetization money callables retry with a stable idempotency key', () => {
  test('watchAd builds the key once and passes it to the callable', () => {
    const body = methodBody('watchAd');
    expect(body).toContain('const key = idempotencyKey || generateIdempotencyKey()');
    expect(body).toMatch(/cfWatchAd\(\{[^}]*idempotencyKey: key/);
    // The queued op must carry the key so a later replay reuses it.
    expect(body).toMatch(/offlineQueue\.add\('watchAd',\s*\{[^}]*idempotencyKey: key/);
  });

  test('purchaseCoins builds the key once and passes it to both callable calls', () => {
    const body = methodBody('purchaseCoins');
    expect(body).toContain('const key = idempotencyKey || generateIdempotencyKey()');
    const calls = body.match(/cfPurchaseCoins\(\{[^}]*idempotencyKey: key/g) || [];
    expect(calls.length).toBe(2); // Stripe-configured branch + fallback branch
    expect(body).toMatch(/offlineQueue\.add\('purchaseCoins',\s*\{[^}]*idempotencyKey: key/);
  });

  test('no money callable passes a bare retry with no idempotencyKey', () => {
    // Guard against a regression that drops the key from one branch.
    expect(svc).not.toMatch(/cfPurchaseCoins\(\{ packageId, paymentMethodId, deviceMetadata \}\)/);
    expect(svc).not.toMatch(/cfWatchAd\(\{ placement, adId, watchDurationSeconds, deviceMetadata \}\)/);
    expect(svc).not.toMatch(/cfCreateSubscription\(\{ tier, paymentMethodId, deviceMetadata \}\)/);
    expect(svc).not.toMatch(/cfCancelSubscription\(\)/);
  });

  test('subscription callables reuse one key across retries', () => {
    const create = methodBody('createSubscription');
    expect(create).toContain('const key = idempotencyKey || generateIdempotencyKey()');
    expect(create).toMatch(/cfCreateSubscription\(\{[^}]*idempotencyKey: key/);
    const cancel = methodBody('cancelSubscription');
    expect(cancel).toContain('const key = idempotencyKey || generateIdempotencyKey()');
    expect(cancel).toMatch(/cfCancelSubscription\(\{ idempotencyKey: key \}\)/);
  });

  test('the offline drain replays with the stored key', () => {
    expect(svc).toMatch(/watchAd\([^)]*item\.params\.idempotencyKey\)/);
    expect(svc).toMatch(/purchaseCoins\([^)]*item\.params\.idempotencyKey\)/);
  });
});
