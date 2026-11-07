/**
 * Live gift/tip money-path guard.
 *
 * `liveService.sendLiveGift`/`sendLiveTip` used to debit the sender and then
 * write a `live_gifts` / `live_tips` row directly from the client:
 *
 *   - the row write is denied by firestore.rules (`live_gifts` is
 *     `allow write: if false`), so the gift document never existed;
 *   - the sender's coins were really spent (server `spendCoins` /
 *     `transferCoins`), but the streamer was never credited — every live gift
 *     destroyed coins, and `live_streams.stats.coinsEarned` was incremented
 *     client-side with no ledger behind it.
 *
 * Gifts and tips now go through the `sendLiveGift` / `sendLiveTip` callables,
 * which move value sender -> streamer in one server transaction. This guard
 * pins that contract: the client must call the callables, the server must
 * credit the recipient and write a double-entry ledger row, and the callables
 * must be registered and deployed.
 *
 * @jest-environment node
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

const liveService = read('src/services/liveService.js');
const monetization = read('functions/monetization.js');
const callableService = read('src/services/callableService.js');
const indexJs = read('functions/index.js');

/** Body of a method, from `async name(` to the next top-level method. */
function methodBody(source, signature) {
  const start = source.indexOf(signature);
  expect(start).toBeGreaterThan(-1);
  return source.slice(start, source.indexOf('\n  async ', start + signature.length));
}

describe('live gifts/tips are server-authoritative transfers, never a client debit', () => {
  test('the client calls the sendLiveGift/sendLiveTip callables', () => {
    const gift = methodBody(liveService, 'async sendLiveGift(');
    const tip = methodBody(liveService, 'async sendLiveTip(');
    expect(gift).toMatch(/callFunction\(FUNCTIONS\.SEND_LIVE_GIFT/);
    expect(tip).toMatch(/callFunction\(FUNCTIONS\.SEND_LIVE_TIP/);
  });

  test('the client never writes live_gifts/live_tips or coinsEarned itself', () => {
    const gift = methodBody(liveService, 'async sendLiveGift(');
    const tip = methodBody(liveService, 'async sendLiveTip(');
    for (const body of [gift, tip]) {
      expect(body).not.toMatch(/addDoc\(/);
      expect(body).not.toMatch(/coinsEarned/);
      expect(body).not.toMatch(/spendCoins\(/);
      expect(body).not.toMatch(/transferCoins\(/);
    }
  });

  test('the callables are registered on the client and merged for deploy', () => {
    expect(callableService).toMatch(/SEND_LIVE_GIFT:\s*'sendLiveGift'/);
    expect(callableService).toMatch(/SEND_LIVE_TIP:\s*'sendLiveTip'/);
    expect(indexJs).toMatch(/merge\(require\('\.\/monetization\.js'\)\)/);
  });

  test('the server debits the sender and credits the streamer in one ledger entry', () => {
    const gift = methodBody(monetization, 'exports.sendLiveGift =');
    const tip = methodBody(monetization, 'exports.sendLiveTip =');
    for (const [body, reason] of [[gift, 'live_gift'], [tip, 'live_tip']]) {
      // Recipient resolved from the stream document, not from client input.
      expect(body).toMatch(/const recipientUid = stream\.userId/);
      // Real credit, not just a debit.
      expect(body).toMatch(/recipientNewBalance/);
      expect(body).toMatch(/t\.update\(recipientRef, \{ coins: recipientNewBalance \}\)/);
      // Double-entry ledger row moves value users:sender -> users:recipient.
      expect(body).toMatch(new RegExp(`createLedgerEntry\\(t, \`users:\\$\\{senderUid\\}\`, \`users:\\$\\{recipientUid\\}\``));
      expect(body).toMatch(new RegExp(`reason: '${reason}'`));
    }
  });

  test('the gift price comes from the shared table, never from the client', () => {
    const gift = methodBody(monetization, 'exports.sendLiveGift =');
    expect(gift).toMatch(/DEFAULT_GIFT_TYPES\[giftType\]/);
    expect(gift).not.toMatch(/data\.coinValue/);
    expect(gift).not.toMatch(/data\.amount/);
  });
});
