// src/__tests__/sharedConfigSync.test.js

import { jest } from '@jest/globals';
import fs from 'fs';
import path from 'path';
import levelConfig from '../shared/levelConfig.cjs';

const { NEW_USER_DEFAULTS } = levelConfig;

const root = process.cwd();

/**
 * Firebase uploads only the `functions/` directory, so the client and the
 * function runtime cannot share a file in place. scripts/sync-shared-config.mjs
 * copies src/shared/*.cjs into functions/, and these tests are the guardrail
 * that the copy never silently drifts from the canonical source.
 */
const SHARED_MODULES = ['levelConfig.cjs', 'featureFlagRegistry.cjs'];

describe('shared config single source of truth', () => {
  test.each(SHARED_MODULES)('%s is byte-identical in src/shared and functions', (name) => {
    const canonical = fs.readFileSync(path.join(root, 'src', 'shared', name), 'utf8');
    const deployed = fs.readFileSync(path.join(root, 'functions', name), 'utf8');
    expect(deployed).toBe(canonical);
  });

  test('the client level service does not redefine the level curve', () => {
    const src = fs.readFileSync(path.join(root, 'src', 'services', 'levelSystemService.js'), 'utf8');
    // Curve/table declarations must live only in the shared module.
    expect(src).not.toContain('Array.from({ length: 100 }');
    expect(src).not.toContain('xpRequired = 50 * level');
    expect(src).toContain("from '../shared/levelConfig.cjs'");
  });

  test('the server level function imports the shared module, not a copy', () => {
    const src = fs.readFileSync(path.join(root, 'functions', 'levelSystem.js'), 'utf8');
    expect(src).not.toContain('Array.from({ length: 100 }');
    expect(src).toContain("require('./levelConfig.cjs')");
  });

  test('the client flag service does not redefine the flag registry', () => {
    const src = fs.readFileSync(path.join(root, 'src', 'services', 'featureFlagService.js'), 'utf8');
    expect(src).not.toContain("'feed.ml_ranking': {");
    expect(src).toContain("from '../shared/featureFlagRegistry.cjs'");
  });

  test('the server flag governance module imports the shared registry, not a copy', () => {
    const src = fs.readFileSync(path.join(root, 'functions', 'featureFlags.js'), 'utf8');
    expect(src).not.toContain("'feed.ml_ranking': {");
    expect(src).toContain("require('./featureFlagRegistry.cjs')");
  });

  test('no component re-derives the level curve or reward table', () => {
    const offenders = [];
    const walk = (dir) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          if (entry.name === '__tests__' || entry.name === 'node_modules') continue;
          walk(full);
        } else if (/\.(js|jsx)$/.test(entry.name)) {
          const src = fs.readFileSync(full, 'utf8');
          if (src.includes('calculateXPForLevel') || src.includes('LEVEL_CONFIG.levelRewards')) {
            offenders.push(path.relative(root, full));
          }
        }
      }
    };
    walk(path.join(root, 'src'));
    expect(offenders).toEqual([]);
  });

  test('sync script and predeploy hook exist so the copy cannot go stale', () => {
    expect(fs.existsSync(path.join(root, 'scripts', 'sync-shared-config.mjs'))).toBe(true);
    const fnsPkg = JSON.parse(fs.readFileSync(path.join(root, 'functions', 'package.json'), 'utf8'));
    expect(fnsPkg.scripts.predeploy).toContain('sync-shared-config');
    const rootPkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
    expect(rootPkg.scripts['sync:shared']).toContain('sync-shared-config');
  });

  test('economy constants (rate + withdrawal minimum) are declared only in the shared module', () => {
    const offenders = [];
    const walk = (dir) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          if (entry.name === '__tests__' || entry.name === 'node_modules') continue;
          walk(full);
        } else if (/\.(js|jsx)$/.test(entry.name)) {
          const rel = path.relative(root, full);
          if (rel.startsWith('src/shared/')) continue;
          const src = fs.readFileSync(full, 'utf8');
          // A component/service must never re-derive the payout rate or the
          // minimum withdrawal amount; the server enforces both.
          if (/COINS_PER_DOLLAR\s*=\s*\d/.test(src) || /WITHDRAWAL_COINS\s*=\s*\d/.test(src)) {
            offenders.push(rel);
          }
        }
      }
    };
    walk(path.join(root, 'src'));
    expect(offenders).toEqual([]);
  });

  test('the payout server enforces the shared withdrawal minimum', () => {
    const src = fs.readFileSync(path.join(root, 'functions', 'monetization.js'), 'utf8');
    expect(src).toContain("require('./levelConfig.cjs').MIN_WITHDRAWAL_COINS");
    expect(src).toContain('amount < MIN_WITHDRAWAL_COINS');
  });

  test('the users create rule pins the new-account economy defaults', () => {
    const rules = fs.readFileSync(path.join(root, 'firestore.rules'), 'utf8');
    const start = rules.indexOf("allow create: if isOwner(userId)");
    const block = rules.slice(start, rules.indexOf(']);', rules.indexOf('contributionScore', start)));
    // Every numeric/boolean default must appear as a literal equality in the
    // create guard, so the rule can never drift from NEW_USER_DEFAULTS.
    expect(block).toContain(`get('coins', null) == ${NEW_USER_DEFAULTS.coins}`);
    expect(block).toContain(`get('level', null) == ${NEW_USER_DEFAULTS.level}`);
    expect(block).toContain(`get('experience', null) == ${NEW_USER_DEFAULTS.experience}`);
    expect(block).toContain(`get('experienceToNextLevel', null) == ${NEW_USER_DEFAULTS.experienceToNextLevel}`);
    expect(block).toContain(`get('totalEarned', null) == ${NEW_USER_DEFAULTS.totalEarned}`);
    expect(block).toContain(`get('reputation', null) == ${NEW_USER_DEFAULTS.reputation}`);
    expect(block).toContain(`get('isVerified', null) == ${NEW_USER_DEFAULTS.isVerified}`);
    expect(block).toContain(`get('isCreator', null) == ${NEW_USER_DEFAULTS.isCreator}`);
    expect(block).toContain(`get('accountStatus', null) == '${NEW_USER_DEFAULTS.accountStatus}'`);
  });

  test('the client seeds a new profile from NEW_USER_DEFAULTS, not literals', () => {
    const src = fs.readFileSync(path.join(root, 'src', 'services', 'userService.js'), 'utf8');
    expect(src).toContain("from '../shared/levelConfig.cjs'");
    expect(src).toContain('NEW_USER_DEFAULTS.coins');
    expect(src).toContain('NEW_USER_DEFAULTS.level');
    expect(src).not.toContain('DEFAULT_COINS: 100');
    expect(src).not.toContain('DEFAULT_LEVEL: 1');
  });

  test('every gift picker derives from the shared GIFT_CATALOG', () => {
    // Consumers either read GIFT_CATALOG directly or the VIRTUAL_GIFTS view
    // derived from it; either way no picker declares its own prices.
    const direct = [
      'src/data/videoData.js',
      'src/services/liveService.js',
      'src/services/monetizationService.js',
    ];
    for (const rel of direct) {
      const src = fs.readFileSync(path.join(root, rel), 'utf8');
      expect(src).toContain('GIFT_CATALOG');
    }
    const viaView = ['src/screens/GiftScreen.jsx', 'src/screens/PostOptionsDrawer.jsx'];
    for (const rel of viaView) {
      const src = fs.readFileSync(path.join(root, rel), 'utf8');
      expect(src).toContain('VIRTUAL_GIFTS');
      expect(src).not.toMatch(/coins: (5|50|100|500)\b/);
    }
    // The server prices gifts from the same catalog.
    const server = fs.readFileSync(path.join(root, 'functions', 'monetization.js'), 'utf8');
    expect(server).toContain("require('./levelConfig.cjs').GIFT_VALUES");
    expect(server).not.toContain("DEFAULT_GIFT_TYPES = { rose:");
  });

  test('coin packages, subscription tiers and ad reward are single-sourced', () => {
    const monetization = fs.readFileSync(path.join(root, 'functions', 'monetization.js'), 'utf8');
    expect(monetization).toContain("require('./levelConfig.cjs').COIN_PACKAGES_BY_ID");
    expect(monetization).toContain("require('./levelConfig.cjs').SUBSCRIPTION_TIERS");
    expect(monetization).toContain("require('./levelConfig.cjs').AD_REWARD_COINS");
    expect(monetization).not.toContain('coins_1200: { coins: 1200');
    expect(monetization).not.toContain('basic: { priceUsdCents: 499');

    // IAP mapping must not diverge from the web store catalog (it used to list
    // coins_1000, an id that does not exist in COIN_PACKAGES).
    const index = fs.readFileSync(path.join(root, 'functions', 'index.js'), 'utf8');
    expect(index).toContain('COIN_PACKAGES_BY_ID[productId]');
    expect(index).not.toContain('coins_1000: 1000');

    // The client screens read the shared tables, not their own literals.
    for (const rel of ['src/screens/CoinsScreen.jsx', 'src/screens/Economy/WalletScreen.jsx']) {
      const src = fs.readFileSync(path.join(root, rel), 'utf8');
      expect(src).toContain('COIN_PACKAGES as COIN_PACKAGES_CANONICAL');
    }
    expect(fs.readFileSync(path.join(root, 'src/screens/CoinsScreen.jsx'), 'utf8'))
      .toContain('SUBSCRIPTION_TIERS as SUBSCRIPTION_TIERS_CANONICAL');
  });
});