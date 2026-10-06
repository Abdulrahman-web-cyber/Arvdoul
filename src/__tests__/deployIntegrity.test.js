/**
 * src/__tests__/deployIntegrity.test.js
 *
 * The deploy path for Cloud Functions is `functions/index.js`: Firebase
 * publishes exactly what that module exports. A module can be `require`d,
 * build fine, and still never deploy if its exports are not merged onto
 * `exports`. That is not hypothetical — this file exists because index.js
 * required 19 modules and merged none of them, so only the 11 functions
 * defined inline were deployed and every callable the app depends on
 * (purchaseCoins, sendGift, createMuxUpload, awardExperience, ...) returned
 * "not found" in production.
 *
 * These tests load the real index.js and assert the merged export set, so a
 * future `require` without a merge fails here instead of at runtime.
 */

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const functionsDir = path.join(root, 'functions');

/**
 * Loading index.js boots the Admin SDK, which needs a project id and a bucket
 * name. The emulator env is enough — no network calls happen at load time.
 */
function loadDeployedExports() {
  const script = `
    process.env.GCLOUD_PROJECT = 'arvdoul-test';
    process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
    process.env.FIREBASE_CONFIG = JSON.stringify({ projectId: 'arvdoul-test', storageBucket: 'arvdoul-test.appspot.com' });
    process.env.GOOGLE_APPLICATION_CREDENTIALS = '';
    const idx = require('./index.js');
    const names = Object.keys(idx).filter(
      (k) => idx[k] && typeof idx[k] === 'function' && (idx[k].__trigger || idx[k].__endpoint)
    );
    process.stdout.write(JSON.stringify(names));
  `;
  const out = execFileSync(process.execPath, ['-e', script], { cwd: functionsDir, encoding: 'utf8' });
  // The Algolia advisory is printed to stderr/stdout by search.js; take the
  // trailing JSON array.
  const json = out.slice(out.lastIndexOf('['));
  return new Set(JSON.parse(json));
}

/** Every callable name the client actually invokes. */
function clientCalledFunctions() {
  const callableService = fs.readFileSync(
    path.join(root, 'src', 'services', 'callableService.js'),
    'utf8'
  );
  const constantToName = {};
  for (const m of callableService.matchAll(/^\s*([A-Z_]+):\s*'([^']+)'/gm)) {
    constantToName[m[1]] = m[2];
  }

  const called = new Set();
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === '__tests__' || entry.name === 'node_modules') continue;
        walk(full);
      } else if (/\.(js|jsx)$/.test(entry.name)) {
        const src = fs.readFileSync(full, 'utf8');
        for (const m of src.matchAll(/httpsCallable\([^,]+,\s*['"]([a-zA-Z0-9_]+)['"]/g)) called.add(m[1]);
        for (const m of src.matchAll(/callFunction\(\s*FUNCTIONS\.([A-Z_]+)/g)) {
          if (constantToName[m[1]]) called.add(constantToName[m[1]]);
        }
        for (const m of src.matchAll(/callFunction\(\s*['"]([a-zA-Z0-9_]+)['"]/g)) called.add(m[1]);
      }
    }
  };
  walk(path.join(root, 'src'));
  return called;
}

describe('Cloud Functions deploy integrity', () => {
  const deployed = loadDeployedExports();

  test('index.js exports every function the app calls', () => {
    const missing = [...clientCalledFunctions()].filter((n) => !deployed.has(n)).sort();
    expect(missing).toEqual([]);
  });

  test('index.js merges the feature modules, not just requires them', () => {
    // Regression: the merge helper must exist and be applied to each module.
    const indexSrc = fs.readFileSync(path.join(functionsDir, 'index.js'), 'utf8');
    const requiredModules = [...indexSrc.matchAll(/require\('\.\/([a-zA-Z]+)\.js'\)/g)].map((m) => m[1]);
    const mergedModules = [...indexSrc.matchAll(/merge\(require\('\.\/([a-zA-Z]+)\.js'\)\)/g)].map((m) => m[1]);
    // Helper-only modules (no triggers) are intentionally require-only.
    const helperOnly = new Set(['auth', 'pushQueue']);
    const notMerged = requiredModules.filter((m) => !mergedModules.includes(m) && !helperOnly.has(m));
    expect(notMerged).toEqual([]);
  });

  test('the deployed set is substantial (guards a silent partial deploy)', () => {
    // Before the fix this was 11. Assert a floor that only holds when the
    // modules are merged, without pinning an exact count.
    expect(deployed.size).toBeGreaterThan(100);
  });

  test('key money-path callables are deployed', () => {
    for (const name of ['purchaseCoins', 'spendCoins', 'sendGift', 'requestWithdrawal', 'trackProfileView', 'deleteUserData', 'exportUserData']) {
      expect(deployed.has(name)).toBe(true);
    }
  });
});

describe('Cloud Functions runtime dependencies', () => {
  test('every external require is declared in functions/package.json', () => {
    // `npm ci` installs only declared dependencies, so a module that requires
    // an undeclared package (or a package the root package.json happens to
    // hoist) fails the whole functions deploy with MODULE_NOT_FOUND. search.js
    // required algoliasearch while it was undeclared and absent from
    // functions/node_modules.
    const builtins = new Set(['fs', 'path', 'os', 'crypto', 'util', 'child_process', 'http', 'https', 'url', 'stream', 'zlib', 'events', 'buffer']);
    const pkg = JSON.parse(fs.readFileSync(path.join(functionsDir, 'package.json'), 'utf8'));
    const declared = new Set(Object.keys(pkg.dependencies || {}));

    const offenders = [];
    for (const file of fs.readdirSync(functionsDir)) {
      if (!file.endsWith('.js')) continue;
      const src = fs.readFileSync(path.join(functionsDir, file), 'utf8');
      for (const m of src.matchAll(/require\(['"]([^'".][^'"]*)['"]\)/g)) {
        const spec = m[1];
        if (builtins.has(spec) || spec.startsWith('node:')) continue;
        // Package root: @scope/name or name (strip subpaths).
        const root = spec.startsWith('@') ? spec.split('/').slice(0, 2).join('/') : spec.split('/')[0];
        if (!declared.has(root)) offenders.push(`${file}: ${root}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});
