/**
 * Composer paid controls must not be dead theatre (N376).
 *
 * `CreatePost`'s Monetization panel used to offer four paid types — "Boost",
 * "Subscriber Only", "Pay‑Per‑View" and "Tip Jar". None of them was enforced
 * anywhere: the `boost` type debited coins (`spendCoins('post_boost')`) with no
 * promotion, and `monetization`/`ppvPrice`/`tipJarAmounts`/`subscriptionTier`
 * were persisted but never read by any feed, post surface, rule or function —
 * so a "Subscriber Only" post was world-readable and a "Tip Jar" collected
 * nothing. The only real paid post feature is the post-publish `boostPost`
 * callable (writes `boosted_posts` + `posts.boostData`, read by the feed).
 *
 * A control that collects a value nothing reads is a bug (§ "No dead props or
 * fabricated successes"), so the whole dead panel was removed. This guard keeps
 * it from growing back without a real enforcement model.
 *
 * @jest-environment node
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const createPost = fs.readFileSync(path.join(root, 'src/screens/CreatePost.jsx'), 'utf8');
const monetizationService = fs.readFileSync(path.join(root, 'src/services/monetizationService.js'), 'utf8');

describe('composer has no dead paid controls', () => {
  test('CreatePost offers no boost or paywall monetization types', () => {
    expect(createPost).not.toContain('MONETIZATION_TYPES');
    expect(createPost).not.toContain('MonetizationPanel');
    expect(createPost).not.toContain('BOOST_TIERS');
    expect(createPost).not.toMatch(/state\.monetization/);
    expect(createPost).not.toMatch(/state\.boost/);
    for (const dead of ['ppvPrice', 'tipJarAmounts', 'subscriptionTier', 'SET_PPV_PRICE', 'SET_TIP_JAR_AMOUNTS', 'SET_SUBSCRIPTION_TIER']) {
      expect(createPost).not.toContain(dead);
    }
  });

  test('CreatePost never spends coins itself for a promotion', () => {
    expect(createPost).not.toMatch(/spendCoins\([^)]*['"]post_boost['"]/);
    expect(createPost).not.toMatch(/\bboostPost\s*\(/);
  });

  test("the monetization service exposes no spendCoins('post_boost') helper", () => {
    expect(monetizationService).not.toMatch(/spendCoins\([^)]*['"]post_boost['"]/);
  });

  test('the boost daily rate has one canonical source', () => {
    const shared = fs.readFileSync(path.join(root, 'src/shared/levelConfig.cjs'), 'utf8');
    expect(shared).toMatch(/const BOOST_DAILY_RATE_COINS = \d+;/);
    const drawer = fs.readFileSync(path.join(root, 'src/screens/PostOptionsDrawer.jsx'), 'utf8');
    expect(drawer).toMatch(/BOOST_DAILY_RATE_COINS/);
    expect(drawer).not.toMatch(/costPerDay=\{?\s*10\b/);
    expect(drawer).not.toMatch(/costPerDay = 10\b/);
    const fn = fs.readFileSync(path.join(root, 'functions/monetization.js'), 'utf8');
    expect(fn).toMatch(/BOOST_DAILY_RATE\b/);
    expect(fn).not.toMatch(/boost_daily_rate \|\| 10\b/);
  });

  test('no client module invents a post-level monetization payload', () => {
    const offenders = [];
    const walk = (dir) => {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        if (['node_modules', '__tests__', 'dist', 'build', '.git'].includes(e.name)) continue;
        const full = path.join(dir, e.name);
        if (e.isDirectory()) walk(full);
        else if (/\.(js|jsx)$/.test(e.name)) {
          const src = fs.readFileSync(full, 'utf8');
          if (/tipJarAmounts|ppvPrice/.test(src)) offenders.push(path.relative(root, full));
        }
      }
    };
    walk(path.join(root, 'src'));
    expect(offenders).toEqual([]);
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
