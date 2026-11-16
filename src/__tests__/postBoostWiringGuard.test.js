/**
 * Paid post-boost guard (N372).
 *
 * `boostPost` debits real coins and writes `posts/{id}.boostData` +
 * `boosted_posts/{id}`, but nothing ever read either back — the paid promotion
 * was a no-op (it only flipped a badge and locked the post from ever being
 * re-boosted). A paid feature that silently does nothing is a fabricated
 * success (§ "No fabricated successes"). Three layers are pinned:
 *
 *  1. Server writes an expiry-bearing `boosted_posts` row after debiting coins,
 *     and allows a re-boost once the prior promotion has expired.
 *  2. The viewer feed reads active boosts (bounded, index-backed) and applies
 *     the ranking multiplier, so the promotion actually surfaces the post.
 *  3. Rules keep `boostData`/`boosted_posts` server-owned — a client cannot mint
 *     a free promotion on create or on the author-update path.
 *
 * @jest-environment node
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const fn = fs.readFileSync(path.join(root, 'functions/monetization.js'), 'utf8');
const feed = fs.readFileSync(path.join(root, 'src/services/feedService.js'), 'utf8');
const rules = fs.readFileSync(path.join(root, 'firestore.rules'), 'utf8');
const indexes = JSON.parse(fs.readFileSync(path.join(root, 'firestore.indexes.json'), 'utf8'));

const boostBody = () => {
  const start = fn.indexOf('exports.boostPost');
  expect(start).toBeGreaterThan(-1);
  const next = fn.indexOf('exports.', start + 1);
  return fn.slice(start, next === -1 ? undefined : next);
};

describe('paid post boost actually reaches viewers', () => {
  test('boostPost writes an expiry-bearing boosted_posts row', () => {
    const body = boostBody();
    expect(body).toContain("collection('boosted_posts').doc(postId)");
    expect(body).toMatch(/expiresAt:\s*boostExpiresAt/);
    expect(body).toMatch(/expireAt:\s*new Date\(boostExpiresAt\)/);
  });

  test('an expired promotion is re-purchasable, an active one is not', () => {
    const body = boostBody();
    expect(body).toContain('priorExpiresAt > Date.now()');
    expect(body).not.toMatch(/boostData\?\.isBoosted\)\s*throw/);
  });

  test('the feed reads active boosts and applies the ranking multiplier', () => {
    expect(feed).toMatch(/_getBoostedPosts\(/);
    expect(feed).toMatch(/BOOSTED_COLLECTION:\s*'boosted_posts'/);
    // Bounded, index-backed read.
    expect(feed).toMatch(/where\('expiresAt',\s*'>',\s*Date\.now\(\)\)/);
    expect(feed).toMatch(/orderBy\('expiresAt',\s*'asc'\)/);
    expect(feed).toMatch(/BOOST_FETCH_LIMIT/);
    // The multiplier consumes the tag.
    expect(feed).toMatch(/if \(p\.isBoosted\) finalScore \*= FEED_CONFIG\.MONETISATION\.BOOST_RANKING_FACTOR/);
  });

  test('the feed sources a boosted pass', () => {
    expect(feed).toMatch(/addSource\('boosted',\s*this\._getBoostedPosts\(/);
  });

  test('boosted_posts has a composite (expiresAt, __name__) index', () => {
    const idx = indexes.indexes.find((i) => i.collectionGroup === 'boosted_posts');
    expect(idx).toBeTruthy();
    const fields = idx.fields.map((f) => f.fieldPath);
    expect(fields).toContain('expiresAt');
  });

  test('rules keep the boost server-owned', () => {
    expect(rules).toMatch(/match \/boosted_posts\/\{postId\} \{\s*allow read: if isSignedIn\(\);\s*allow write: if false;/);
    // A create may not seed boostData…
    expect(rules).toMatch(/request\.resource\.data\.get\('boostData', null\) == null/);
    // …and the author-update carve-out forbids moving it.
    expect(rules).toMatch(/'poll', 'gifts', 'boostData'\s*\]/);
  });
});
