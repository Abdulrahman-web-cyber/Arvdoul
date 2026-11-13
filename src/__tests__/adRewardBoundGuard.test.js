/**
 * Rewarded-ad economy guard (N371).
 *
 * `functions/monetization.js#watchAd` credits real coins, so it is a mint path.
 * Three defects were possible here and are pinned against:
 *
 *  1. No daily cap. A per-minute rate limit (20/min) alone lets an account
 *     claim an unbounded number of ads per day, minting coins each time. The
 *     server must also consume the shared `MAX_ADS_PER_USER_PER_DAY` budget via
 *     the `fraud_limits` daily counter (the same lever the client advertises).
 *  2. Reward contradicts the displayed unit. The UI renders
 *     "+AD_REWARD_COINS coins per 30s" (CoinsScreen / SponsoredPostCard) and the
 *     post card claims at 15s, but `Math.max(REWARD, floor(s/30)*REWARD)` paid
 *     ZERO for a sub-30s claim. The reward must floor at one unit.
 *  3. The stored impression recorded the raw client duration, not the clamped
 *     value actually paid for.
 *
 * @jest-environment node
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const src = fs.readFileSync(path.join(root, 'functions/monetization.js'), 'utf8');
const canonical = fs.readFileSync(path.join(root, 'src/shared/levelConfig.cjs'), 'utf8');
const synced = fs.readFileSync(path.join(root, 'functions/levelConfig.cjs'), 'utf8');

const watchAdBody = () => {
  const start = src.indexOf('exports.watchAd');
  expect(start).toBeGreaterThan(-1);
  const next = src.indexOf('exports.', start + 1);
  return src.slice(start, next === -1 ? undefined : next);
};

describe('watchAd daily budget + reward unit', () => {
  test('the daily ad cap is a single canonical constant, synced to functions', () => {
    expect(canonical).toMatch(/const MAX_ADS_PER_USER_PER_DAY = \d+;/);
    expect(synced).toBe(canonical);
  });

  test('watchAd consumes the daily ad budget server-side', () => {
    const body = watchAdBody();
    expect(body).toMatch(/enforceDailyLimit\(uid,\s*1,\s*'ad',\s*MAX_ADS_PER_USER_PER_DAY\)/);
  });

  test('the reward floors at one unit for a sub-30s claim', () => {
    const body = watchAdBody();
    expect(body).toContain('Math.max(1, Math.floor(watchedSeconds / 30)) * AD_REWARD_PER_30S');
    // The old zero-paying shape must not return.
    expect(src).not.toContain('Math.max(AD_REWARD_PER_30S, Math.floor(watchedSeconds / 30) * AD_REWARD_PER_30S)');
  });

  test('the stored impression records the clamped duration', () => {
    const body = watchAdBody();
    expect(body).toContain('watchDurationSeconds: watchedSeconds');
    expect(body).not.toMatch(/t\.set\(impRef,[\s\S]*watchDurationSeconds,\s*reward/);
  });

  test('the client daily-cap constant derives from the shared config', () => {
    const svc = fs.readFileSync(path.join(root, 'src/services/monetizationService.js'), 'utf8');
    expect(svc).toMatch(/MAX_ADS_PER_USER_PER_DAY\s*:\s*MAX_ADS_PER_USER_PER_DAY/);
    expect(svc).not.toMatch(/MAX_ADS_PER_USER_PER_DAY:\s*20/);
  });
});
