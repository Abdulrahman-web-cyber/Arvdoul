/**
 * Achievement/title metric fields must be computed from real data (N432).
 *
 * `ACHIEVEMENTS_CATALOG` / `TITLES_CATALOG` criteria are evaluated against
 * metric fields on `users/{uid}` (`commentsCount`, `pollVotesCount`,
 * `profilesVisitedCount`, `giftsSentCount`, `hostedLive`, …). No writer ever
 * populated those fields, so `evaluateAchievements` / `claimTitle` read a
 * permanent `0` and the affected achievements/titles could never be earned — an
 * advertised-but-dead feature (the "No fabricated standing" class inverted: a
 * fabricated *zero* that denies a real accomplishment).
 *
 * The fix: `functions/userMetrics.js#computeUserMetrics` aggregates the real
 * collections (bounded `count()` reads, no collection scan) and
 * `evaluateAchievements` overlays the result on the stored doc. This guard
 * fails if the wiring is removed or the aggregations drift from the real
 * writer field names.
 *
 * @jest-environment node
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

const metricsSrc = read('functions/userMetrics.js');
const levelSrc = read('functions/levelSystem.js');

describe('achievement metrics are computed from real data (N432)', () => {
  test('userMetrics.js exports computeUserMetrics', () => {
    expect(metricsSrc).toMatch(/module\.exports\s*=\s*\{[^}]*computeUserMetrics/);
    expect(metricsSrc).toMatch(/async function computeUserMetrics/);
  });

  test('levelSystem requires and calls computeUserMetrics in evaluateAchievements', () => {
    expect(levelSrc).toMatch(/require\('\.\/userMetrics'\)/);
    expect(levelSrc).toMatch(/await computeUserMetrics\(uid\)/);
  });

  test('the achievement evaluator scores the computed stats, not the raw doc', () => {
    // The overlay must be spread over the stored doc and used by the criteria.
    expect(levelSrc).toMatch(/const stats = \{ \.\.\.userData, \.\.\.computed \}/);
    const evalBlock = levelSrc.slice(
      levelSrc.indexOf('exports.evaluateAchievements'),
      levelSrc.indexOf('exports.claimTitle'),
    );
    expect(evalBlock).not.toMatch(/userData\.commentsCount/);
    expect(evalBlock).not.toMatch(/userData\.pollVotesCount/);
    expect(evalBlock).not.toMatch(/userData\.profilesVisitedCount/);
    expect(evalBlock).not.toMatch(/userData\.giftsSentCount/);
    expect(evalBlock).not.toMatch(/userData\.hostedLive/);
  });

  test('the aggregations use the real writer field names', () => {
    // comments.userId (commentService.createComment), poll_votes.userId
    // (polls.castVote), profile_views.viewerId (analytics.trackProfileView),
    // gift_transactions.senderId (monetization.sendGift), live_streams.userId
    // (liveService.startLive).
    expect(metricsSrc).toMatch(/collection\('comments'\)\.where\('userId', '==', uid\)/);
    expect(metricsSrc).toMatch(/collection\('poll_votes'\)\.where\('userId', '==', uid\)/);
    expect(metricsSrc).toMatch(/collection\('profile_views'\)\.where\('viewerId', '==', uid\)/);
    expect(metricsSrc).toMatch(/collection\('gift_transactions'\)\.where\('senderId', '==', uid\)/);
    expect(metricsSrc).toMatch(/collection\('live_streams'\)\.where\('userId', '==', uid\)/);
  });

  test('the metric reads are bounded aggregations, not collection scans', () => {
    // Every count goes through the `.count()` aggregation API.
    expect(metricsSrc).toMatch(/\.count\(\)\.get\(\)/);
    // No unbounded getDocs-style full-collection read.
    expect(metricsSrc).not.toMatch(/collection\([^)]*\)\.get\(\)/);
  });

  test('a failed metric stays absent (fail-closed), never a fabricated pass', () => {
    // safeCount returns undefined on error and the caller only assigns a
    // resolved value, so an unresolvable metric is unmet rather than granted.
    expect(metricsSrc).toMatch(/catch \(err\) \{\s*return undefined;/);
    expect(metricsSrc).toMatch(/if \(commentsCount !== undefined\) metrics\.commentsCount/);
  });
});
