/**
 * src/__tests__/dailyUploadLimitEnforcementGuard.test.js
 *
 * N490 — the per-tier daily video-upload cap was never enforced.
 * `videoService._checkDailyUploadLimitSharded` read ONE random shard and
 * compared that single value to the tier limit. The shards are a SUM of the
 * day's uploads, so a user could upload up to `shards × dailyLimit` (a `free`
 * user with 10 shards: ~50 uploads instead of 5) before a randomly-chosen shard
 * happened to reach the limit — and each check is a coin flip, so the effective
 * cap was even looser.
 *
 * The fix reads every shard (`tx.getAll`) and compares the real total. Because a
 * shard may not exist yet, the rules must permit an owner point-read of an
 * absent shard (a missing doc has `resource == null`), so the read is keyed on
 * the id bound to the caller rather than on `resource.data`.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

describe('daily upload limit is the SUM of the day\'s shards (N490)', () => {
  test('videoService reads every shard and compares the total', () => {
    const src = read('src/services/videoService.js');
    const fn = src.slice(
      src.indexOf('async _checkDailyUploadLimitSharded'),
      src.indexOf('async _checkFollowStatus')
    );
    expect(fn.length).toBeGreaterThan(0);
    expect(fn).toMatch(/tx\.getAll\(\.\.\.shardRefs\)/);
    expect(fn).toMatch(/reduce\(\(sum/);
    expect(fn).toMatch(/if \(total >= dailyLimit\) throw new Error\('LIMIT_EXCEEDED'\)/);
    // The old single-random-shard comparison is gone.
    expect(fn).not.toMatch(/if \(current >= dailyLimit\)/);
  });

  test('the rules allow an owner point-read of an (absent) shard but not a list', () => {
    const rules = read('firestore.rules');
    const block = rules.slice(
      rules.indexOf('match /daily_upload_counters'),
      rules.indexOf('match /coin_events')
    );
    expect(block).toMatch(/allow get: if isSignedIn\(\) &&\s*\n\s*shardId\.matches\('upload_' \+ uid\(\)/);
    expect(block).toMatch(/allow list: if false;/);
    // The owner read is keyed on the id, not on `resource.data.userId` (which
    // would throw on a missing doc and deny the read).
    const getLine = block.slice(block.indexOf('allow get:'), block.indexOf('allow list:'));
    expect(getLine).not.toMatch(/resource\.data/);
  });
});
