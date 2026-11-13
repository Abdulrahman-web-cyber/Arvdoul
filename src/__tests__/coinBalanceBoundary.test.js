/**
 * src/__tests__/coinBalanceBoundary.test.js
 *
 * N324 — the coin balance must never be world-readable.
 *
 * `users/{uid}` is readable by every signed-in user (feeds, search, follower
 * lists) and Firestore rules cannot field-mask a readable document. A balance
 * on that doc therefore leaked every wallet to every signed-in client,
 * regardless of the owner's `economicStatus` scope. The authoritative balance
 * now lives on `users_private/{uid}` (owner/admin only), written through the
 * shared `functions/coinBalance.js` accessor.
 *
 * These assertions are static (the emulator-backed rules checks live in
 * `firestoreRulesCompile.test.js`); they fail if any layer reintroduces a
 * public balance write, reads a cross-user balance, or drops the migration.
 */

import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const functionsDir = path.join(ROOT, 'functions');
const functionsFiles = fs.readdirSync(functionsDir).filter((f) => f.endsWith('.js'));

describe('the coin balance is written only through the private-doc accessor', () => {
  test('no functions module writes coins/lockedCoins to the users doc', () => {
    const offenders = [];
    for (const file of functionsFiles) {
      const src = read(path.join('functions', file));
      // A transaction update on a users ref that carries a coins/lockedCoins
      // field is the regression: `t.update(userRef, { coins: ... })`.
      for (const m of src.matchAll(/\.update\((\w+Ref),\s*\{[^}]*\b(coins|lockedCoins)\b/g)) {
        offenders.push(`${file}: ${m[0].slice(0, 60)}`);
      }
      // The public collection aggregate/query for coins is also a leak.
      if (/collection\('users'\)\.aggregate\([^)]*sum\('coins'\)/.test(src)) {
        offenders.push(`${file}: aggregate sum('coins') over users`);
      }
    }
    expect(offenders).toEqual([]);
  });

  test('the balance accessor writes to users_private and every money module uses it', () => {
    const helper = read('functions/coinBalance.js');
    expect(helper).toContain("const PRIVATE_COLLECTION = 'users_private';");
    expect(helper).toContain('function writeCoinBalance');
    // The money-path modules must import the accessor.
    for (const file of ['monetization.js', 'withdrawalSettlement.js', 'video.js', 'xpAward.js']) {
      expect(read(path.join('functions', file))).toContain("require('./coinBalance')");
    }
  });

  test('the coin-supply audit and admin sum read users_private, not users', () => {
    expect(read('functions/monetization.js')).toContain("collection('users_private')\n      .aggregate({ total: admin.firestore.AggregateField.sum('coins') })");
    expect(read('functions/admin.js')).toContain("collection('users_private').aggregate({ total: admin.firestore.AggregateField.sum('coins') })");
  });

  test('the migration backfills coins/lockedCoins into users_private', () => {
    const migration = read('functions/privacyMigration.js');
    expect(migration).toContain("'coins'");
    expect(migration).toContain("'lockedCoins'");
  });
});

describe('the client reads the balance from the private doc', () => {
  test('monetizationService.getBalance reads users_private', () => {
    const s = read('src/services/monetizationService.js');
    expect(s).toContain('PRIVATE_PROFILE_COLLECTION, userId');
    // The cross-user coin leaderboard (which required a public balance) is gone.
    expect(s).not.toContain('getCoinLeaderboard');
  });

  test('walletService reads users_private for coins and lockedCoins', () => {
    const s = read('src/services/walletService.js');
    expect(s).toContain('PRIVATE_PROFILE_COLLECTION, userId');
    expect(s).toContain('balanceData.coins');
    expect(s).toContain('balanceData.lockedCoins');
  });

  test('the analytics balance read targets the private doc', () => {
    expect(read('src/services/analyticsService.js')).toContain('PRIVATE_PROFILE_COLLECTION, userId');
  });

  test('a new account seeds its starting balance on the private doc only', () => {
    const s = read('src/services/userService.js');
    // `coins: NEW_USER_DEFAULTS.coins` must be part of the private seed, and the
    // seed must only run on create.
    expect(s).toContain('seed.coins = privateFields.coins');
  });
});

describe('the rules keep the balance off the public doc', () => {
  const rules = read('firestore.rules');

  test('touchesPrivateProfileFields lists coins and lockedCoins', () => {
    const start = rules.indexOf('function touchesPrivateProfileFields');
    const helper = rules.slice(start, rules.indexOf(']);', start));
    expect(helper).toContain("'coins'");
    expect(helper).toContain("'lockedCoins'");
  });

  test('the users create rule denies coins and lockedCoins', () => {
    const start = rules.indexOf('match /users/{userId}');
    const block = rules.slice(start, rules.indexOf('match /users_private', start));
    expect(block).toContain("'coins', 'lockedCoins'");
    expect(block).not.toContain("get('coins', null) ==");
  });

  test('the users_private create rule pins the starting balance', () => {
    const start = rules.indexOf('match /users_private/{userId}');
    const block = rules.slice(start, rules.indexOf('allow delete', start));
    expect(block).toContain("get('coins', null) == 100");
    expect(block).toContain("!request.resource.data.keys().hasAny(['lockedCoins'])");
    // The owner may not move their balance on the private doc either.
    expect(block).toContain("['email', 'phoneNumber', 'emailVerified', 'phoneVerified', 'updatedAt']");
  });
});
