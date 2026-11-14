/**
 * @jest-environment node
 *
 * Money-path idempotency keys must be stable across retries (N447).
 *
 * A server-side money operation keyed on `Date.now()` (or a fresh uuid built
 * server-side per call) is not idempotent: the client's own retry, or the
 * Firebase SDK's transparent retry of a request that committed but failed in
 * transit, produces a DIFFERENT key and charges the user a second time.
 *
 * The rule: a per-intent money action carries a caller-generated key that is
 * reused for every retry of the same intent. Server code may generate a key
 * only as a last-resort fallback for direct API callers, and that fallback must
 * be random (a fresh uuid) — never `Date.now()`.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

const videoFn = read('functions/video.js');
const monetizationFn = read('functions/monetization.js');
const videoSvc = read('src/services/videoService.js');
const marketplaceSvc = read('src/services/marketplaceService.js');

describe('money-path idempotency keys are retry-stable (N447)', () => {
  test('no money callable derives its key from Date.now()', () => {
    // A timestamp key changes on every call, so a retry is a new charge.
    expect(videoFn).not.toMatch(/idempotencyKey:\s*`[^`]*\$\{Date\.now\(\)\}/);
    expect(monetizationFn).not.toMatch(/generateIdempotencyKey\([^)]*Date\.now\(\)/);
  });

  test('video sendTip accepts and forwards a caller-supplied key', () => {
    const block = videoFn.slice(
      videoFn.indexOf('exports.sendTip'),
      videoFn.indexOf('setVideoChapters'),
    );
    expect(block).toMatch(/const \{ videoId, amount, message, idempotencyKey \} = data;/);
    expect(block).toMatch(/typeof idempotencyKey === 'string'/);
    expect(block).toMatch(/idempotencyKey: key/);
  });

  test('the video tip client sends a stable key', () => {
    const block = videoSvc.slice(
      videoSvc.indexOf('async sendTip(videoId, amount, message)'),
      videoSvc.indexOf('async getWatermarkedDownloadUrl'),
    );
    expect(block).toMatch(/idempotencyKey:\s*newIdempotencyKey\(\)/);
  });

  test('marketplace purchase prefers a caller key and never falls back to Date.now()', () => {
    const block = monetizationFn.slice(
      monetizationFn.indexOf('exports.purchaseMarketplaceItem'),
      monetizationFn.indexOf('exports.sendLiveGift'),
    );
    expect(block).toMatch(/const \{ productId, orderId, idempotencyKey \} = data/);
    expect(block).toMatch(/idempotencyKey \|\| orderId \|\|/);
    expect(block).toMatch(/uuidv4\(\)/);
    // The key line specifically must not use a timestamp (other Date.now()
    // uses in the block are `expireAt` fields, which are fine).
    const keyLine = block.split('\n').find((l) => l.includes('idempotencyKey || orderId'));
    expect(keyLine).toBeTruthy();
    expect(keyLine).not.toMatch(/Date\.now\(\)/);
  });

  test('the marketplace client sends a stable key', () => {
    expect(marketplaceSvc).toMatch(/const idempotencyKey = newIdempotencyKey\(\)/);
    expect(marketplaceSvc).toMatch(/PURCHASE_MARKETPLACE_ITEM,\s*\{ productId, idempotencyKey \}/);
  });
});
