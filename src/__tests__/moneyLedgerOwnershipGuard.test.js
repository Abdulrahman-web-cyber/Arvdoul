/**
 * Money-path ledger ownership + integer-coin guard.
 *
 * `functions/monetization.js` credits coins keyed on a caller-supplied
 * `idempotencyKey` -> `idempotency_ledger/{key}`. On a replay the handler must
 * prove the ledger row belongs to the caller before returning the stored
 * result; otherwise a collision could surface (or, worse, a mismatched replay
 * could credit the wrong user). `addCoins` established the check
 * (`ledgerSnap.data().userId !== uid -> permission-denied`); this guard pins it
 * for every money handler and pins the integer-only coin unit.
 *
 * @jest-environment node
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const src = fs.readFileSync(path.join(root, 'functions/monetization.js'), 'utf8');

describe('money ledger ownership', () => {
  test('no ledger replay returns a stored result without an ownership check', () => {
    // The unsafe one-liner this guard was written against.
    expect(src).not.toMatch(/if \(ledgerSnap\.exists\) return ledgerSnap\.data\(\)\.result;/);
  });

  test('every user-supplied-key handler that replays checks ledger userId', () => {
    const checks = src.match(/ledgerSnap\.data\(\)\.userId !==/g) || [];
    // addCoins, spendCoins, transferCoins, sendGift, boostPost, requestWithdrawal,
    // purchaseCoins, createSubscription, watchAd, purchaseMarketplaceItem,
    // sendLiveGift, sendLiveTip.
    expect(checks.length).toBeGreaterThanOrEqual(12);
  });

  test('requestWithdrawal rejects a fractional coin amount', () => {
    expect(src).toContain('!Number.isInteger(amount)');
  });
});
