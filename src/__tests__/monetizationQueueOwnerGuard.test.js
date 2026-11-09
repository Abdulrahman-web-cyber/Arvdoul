/**
 * Monetization offline-queue owner guard.
 *
 * `src/services/monetizationService.js` keeps a SECOND device-local queue
 * (`monetization_offline`) for ops that move real money — a queued
 * `purchaseCoins` or rewarded `watchAd`. Unlike the canonical
 * `src/utils/OfflineQueue.js`, this queue previously stored no owner and
 * drained every pending op under whoever was signed in, so account A's queued
 * purchase could replay (charge a card / mint coins) as account B. Nothing
 * purged it on sign-out either.
 *
 * This guard pins the fix: the owner is stamped at enqueue, the drain is scoped
 * to the live session, and sign-out/switch purge the departing account's ops.
 *
 * @jest-environment node
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

const SERVICE = 'src/services/monetizationService.js';
const AUTH = 'src/context/AuthContext.jsx';

describe('the monetization offline queue is owner-scoped', () => {
  const svc = read(SERVICE);

  test('queued financial ops are stamped with the session owner', () => {
    expect(svc).toMatch(/db\.add\('queue',\s*\{[^}]*ownerUid/);
  });

  test('the drain replays only the live session\u2019s ops', () => {
    const start = svc.indexOf('async sync()');
    expect(start).toBeGreaterThan(-1);
    const body = svc.slice(start, start + 1200);
    expect(body).toContain('const sessionUid = auth?.currentUser?.uid');
    expect(body).toMatch(/item\.ownerUid !== sessionUid/);
  });

  test('a purge helper exists and is owner-scoped', () => {
    expect(svc).toContain('export async function purgeMonetizationQueueForOwner');
    const start = svc.indexOf('export async function purgeMonetizationQueueForOwner');
    const body = svc.slice(start, start + 900);
    expect(body).toMatch(/items\[i\]\.ownerUid === uid/);
  });

  test('sign-out and account switch purge the departing account\u2019s queue', () => {
    const auth = read(AUTH);
    const calls = auth.match(/purgeMonetizationQueueForOwner\(/g) || [];
    // one on account switch, one on logout
    expect(calls.length).toBeGreaterThanOrEqual(2);
  });
});
