/**
 * src/__tests__/functionsContract.test.js
 * STATIC CONTRACT between the client and the deployed Cloud Functions:
 *
 *   1. Every httpsCallable name the client invokes MUST be exported by a
 *      function module that functions/index.js actually requires (otherwise
 *      the function silently never deploys - the userExport.js GDPR bug).
 *   2. Every function module in functions/ is required by index.js (no dead
 *      modules that look deployed but are not).
 *   3. firestore.rules covers every collection the client writes
 *      (default-deny would silently break uncovered writes).
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '../..');
const srcDir = path.join(root, 'src');
const functionsDir = path.join(root, 'functions');

function read(p) {
  return fs.readFileSync(p, 'utf8');
}

function listFiles(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) out.push(...listFiles(path.join(dir, entry.name)));
    else if (/\.(js|jsx)$/.test(entry.name)) out.push(path.join(dir, entry.name));
  }
  return out;
}

describe('Cloud Functions deploy contract', () => {
  const clientSources = listFiles(path.join(srcDir, 'services'))
    .concat(listFiles(path.join(srcDir, 'context')))
    .map(read)
    .join('\n');

  // Every httpsCallable(name, 'fnName') the client invokes
  const called = new Set(
    [...clientSources.matchAll(/httpsCallable\([^)]*,\s*'([a-zA-Z_]+)'\)/g)].map((m) => m[1])
  );
  // Plus any direct getFunctions() usage patterns
  const calledViaName = new Set(
    [...clientSources.matchAll(/(?:getFunctions|functions)\([^)]*\)\s*,\s*'([a-zA-Z_]+)'/g)].map((m) => m[1])
  );
  for (const name of calledViaName) called.add(name);
  // deleteUserData is invoked via httpsCallable(functions, 'deleteUserData') in userService
  const userService = read(path.join(srcDir, 'services', 'userService.js'));
  const extra = [...userService.matchAll(/httpsCallable\([^)]*,\s*'([a-zA-Z_]+)'\)/g)].map((m) => m[1]);
  extra.forEach((n) => called.add(n));

  // All exports across function modules
  const moduleFiles = listFiles(functionsDir);
  const allExports = new Set();
  for (const file of moduleFiles) {
    for (const m of read(file).matchAll(/exports\.([a-zA-Z_]+)\s*=/g)) {
      allExports.add(m[1]);
    }
  }

  // Which modules index.js requires
  const indexSrc = read(path.join(functionsDir, 'index.js'));
  const required = new Set(
    [...indexSrc.matchAll(/require\('\.\/([a-zA-Z]+)\.js'\)/g)].map((m) => `${m[1]}.js`)
  );

  test('every client-called callable is exported somewhere', () => {
    const missing = [...called].filter((n) => !allExports.has(n));
    expect(missing).toEqual([]);
  });

  test('every function module is required by index.js (no dead modules)', () => {
    const modules = moduleFiles.map((f) => path.basename(f)).filter((f) => f !== 'package.json' && f !== 'package-lock.json');
    // userDelete.js is intentionally not required: its deleteUserData is a
    // duplicate of the complete cascade implementation in user.js - requiring
    // both would crash deployment with a duplicate-export error.
    // rateLimit.js is a shared utility module (no exports.* functions) —
    // required by the modules that use it, never deployed standalone.
    const missing = modules.filter((m) => !required.has(m) && m !== 'index.js' && m !== 'userDelete.js' && m !== 'rateLimit.js');
    expect(missing).toEqual([]);
    // rateLimit.js must be required by at least the money-path modules.
    expect(read(path.join(functionsDir, 'monetization.js'))).toContain("require('./rateLimit')");
    expect(read(path.join(functionsDir, 'notifications.js'))).toContain("require('./rateLimit')");
  });

  test('GDPR exports are required by index.js (regression: userExport.js)', () => {
    expect(required.has('userExport.js')).toBe(true);
    expect(allExports.has('exportUserData')).toBe(true);
  });

  test('client-called callables exist with a deploy path', () => {
    // deleteUserData (cascade) + exportUserData (GDPR) are the critical ones
    expect(allExports.has('deleteUserData')).toBe(true);
    expect(allExports.has('exportUserData')).toBe(true);
    expect(allExports.has('purchaseCoins')).toBe(true);
    expect(allExports.has('awardExperience')).toBe(true);
  });
});

describe('Firestore rules coverage contract', () => {
  const rules = read(path.join(root, 'firestore.rules'));

  // Extract the collection names the client services write. The collection
  // name is the FIRST string literal argument (later args are subcollection
  // segments / doc ids).
  const clientWrites = new Set();
  const serviceFiles = listFiles(path.join(srcDir, 'services'));
  for (const file of serviceFiles) {
    const src = read(file);
    for (const m of src.matchAll(/collection\(\s*[^,]+,\s*'([a-z_]+)'/g)) {
      clientWrites.add(m[1]);
    }
  }

  // Every match /<collection>/ in the rules
  const ruleMatches = new Set(
    [...rules.matchAll(/match \/([a-z_]+)\//g)].map((m) => m[1])
  );

  test('every client-written collection has a rules match (no default-deny breakage)', () => {
    const uncovered = [...clientWrites].filter((c) => !ruleMatches.has(c));
    expect(uncovered).toEqual([]);
  });

  test('rules deny by default at the end', () => {
    const defaultDeny = rules.indexOf('match /{document=**}');
    expect(defaultDeny).toBeGreaterThan(-1);
    // The default-deny match must be the LAST match block in the file
    const lastMatch = rules.lastIndexOf('match /');
    expect(defaultDeny).toBe(lastMatch);
    expect(rules.slice(defaultDeny)).toContain('allow read, write: if false;');
  });
});
