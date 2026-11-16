/**
 * Community `stats.eventCount` must have a real writer (N434).
 *
 * `communities/{communityId}.stats.eventCount` is seeded `0` in
 * `functions/communities.js#createCommunity` and was never written again, yet
 * `CommunityDetailScreen` renders it as the community's "Events" card and
 * `communityService.getCommunityStats` reads it. It therefore always showed a
 * fabricated `0` — the same "counter with no writer" class as the follower
 * counters (N431) and the post engagement counters (N433). The community
 * document is server-write-only, so the derived counter must be maintained by
 * a server trigger: `functions/eventCounters.js#onEventWrite`.
 *
 * @jest-environment node
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

const countersSrc = read('functions/eventCounters.js');
const indexSrc = read('functions/index.js');
const communitiesSrc = read('functions/communities.js');
const screenSrc = read('src/screens/Community/CommunityDetailScreen.jsx');
const serviceSrc = read('src/services/communityService.js');

describe('community eventCount has a real writer (N434)', () => {
  test('index.js merges the eventCounters module', () => {
    expect(indexSrc).toMatch(/merge\(require\('\.\/eventCounters\.js'\)\)/);
  });

  test('the seed and the trigger agree on the field name', () => {
    // The seed creates the field the trigger increments.
    expect(communitiesSrc).toMatch(/eventCount: 0/);
    expect(countersSrc).toMatch(/'stats\.eventCount'/);
  });

  test('it is a firestore document trigger on events/{eventId}, not a callable', () => {
    expect(countersSrc).toMatch(/exports\.onEventWrite = functions\.firestore/);
    expect(countersSrc).toMatch(/\.document\('events\/\{eventId\}'\)/);
    expect(countersSrc).toMatch(/\.onWrite\(/);
    // A document trigger has no `onCall`; it must not appear in the client
    // callable inventory as an unreferenced callable.
    expect(countersSrc).not.toMatch(/onCall\(/);
  });

  test('it applies a net delta so it never double-counts or drifts', () => {
    // before → -1, after → +1, so a registration-only write cancels to zero.
    expect(countersSrc).toMatch(/if \(counts\(before\)\) bump\(communityIdOf\(before\), -1\)/);
    expect(countersSrc).toMatch(/if \(counts\(after\)\) bump\(communityIdOf\(after\), \+1\)/);
    expect(countersSrc).toMatch(/FieldValue\.increment\(delta\)/);
    // Draft/cancelled events do not count; a cancelled event decrements.
    expect(countersSrc).toMatch(/COUNTED_EVENT_STATUSES = \['published', 'open', 'live', 'ended'\]/);
  });

  test('a non-member cannot inflate a foreign community counter (forgery guard)', () => {
    expect(countersSrc).toMatch(/snap\.data\(\)\.members \|\| \{\}/);
    expect(countersSrc).toMatch(/if \(organizerId && !\(\(snap\.data\(\)\.members \|\| \{\}\)\[organizerId\]\)\) continue;/);
  });

  test('the counter is actually consumed by the UI (not a dead field)', () => {
    expect(serviceSrc).toMatch(/eventCount: unknownNumber\(community\.stats\?\.eventCount\)/);
    expect(screenSrc).toMatch(/\['Events', community\.stats\?\.eventCount\]/);
  });
});
