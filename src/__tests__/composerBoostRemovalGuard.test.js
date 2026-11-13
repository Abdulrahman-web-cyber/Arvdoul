/**
 * Composer "Boost" must not be a second, dead paid path (N376).
 *
 * `CreatePost`'s Monetization panel used to offer a "Boost" type that debited
 * coins with `spendCoins(uid, budget, 'post_boost')` after publish. Nothing ever
 * read the stored `boost` field, no `boostData`/`boosted_posts` row was written,
 * and `firestoreService` never persisted `boost` — so the coins were destroyed
 * with no promotion. The only real, working boost is the post-publish
 * `boostPost` callable (writes `boosted_posts` + `posts.boostData`, read by the
 * feed). This guard keeps the composer from growing a second paid path that
 * takes money without promoting the post.
 *
 * @jest-environment node
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const createPost = fs.readFileSync(path.join(root, 'src/screens/CreatePost.jsx'), 'utf8');
const monetizationService = fs.readFileSync(path.join(root, 'src/services/monetizationService.js'), 'utf8');

describe('composer boost is the single server-authoritative path', () => {
  test('CreatePost offers no boost monetization type', () => {
    expect(createPost).not.toMatch(/\{\s*value:\s*["']boost["']/);
    expect(createPost).not.toContain('BOOST_TIERS');
    expect(createPost).not.toMatch(/state\.boost/);
  });

  test('CreatePost never spends coins itself for a promotion', () => {
    expect(createPost).not.toMatch(/spendCoins\([^)]*['"]post_boost['"]/);
    // The only client-side boost entry point is the callable.
    expect(createPost).not.toMatch(/\bboostPost\s*\(/);
  });

  test("the monetization service exposes no spendCoins('post_boost') helper", () => {
    expect(monetizationService).not.toMatch(/spendCoins\([^)]*['"]post_boost['"]/);
  });

  test('the boost daily rate has one canonical source', () => {
    const shared = fs.readFileSync(path.join(root, 'src/shared/levelConfig.cjs'), 'utf8');
    expect(shared).toMatch(/const BOOST_DAILY_RATE_COINS = \d+;/);
    // The client reads the canonical value, not a local literal.
    expect(createPost).not.toMatch(/BOOST_TIERS/);
    const drawer = fs.readFileSync(path.join(root, 'src/screens/PostOptionsDrawer.jsx'), 'utf8');
    expect(drawer).toMatch(/BOOST_DAILY_RATE_COINS/);
    expect(drawer).not.toMatch(/costPerDay=\{?\s*10\b/);
    expect(drawer).not.toMatch(/costPerDay = 10\b/);
    // The server default comes from the shared config, not a bare literal.
    const fn = fs.readFileSync(path.join(root, 'functions/monetization.js'), 'utf8');
    expect(fn).toMatch(/BOOST_DAILY_RATE\b/);
    expect(fn).not.toMatch(/boost_daily_rate \|\| 10\b/);
  });

  test('post_boost appears only in the server boostPost handler', () => {
    const files = [];
    const walk = (dir) => {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        if (['node_modules', '__tests__', 'dist', 'build', '.git'].includes(e.name)) continue;
        const full = path.join(dir, e.name);
        if (e.isDirectory()) walk(full);
        else if (/\.(js|jsx|cjs)$/.test(e.name)) files.push(full);
      }
    };
    walk(path.join(root, 'src'));
    walk(path.join(root, 'functions'));
    const offenders = files.filter((f) => fs.readFileSync(f, 'utf8').includes("'post_boost'"))
      .map((f) => path.relative(root, f))
      .filter((f) => f !== 'functions/monetization.js');
    expect(offenders).toEqual([]);
  });
});
