// src/__tests__/functionsContract.test.js

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
  // Scan EVERY client source, not just services/context: screens and components
  // also call httpsCallable directly, and a missing export there ships a dead
  // button (previously the case for reportPost/reportComment/moderatePost/...).
  const clientSources = listFiles(srcDir)
    .filter((f) => !f.includes('__tests__'))
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

  // Admin access management goes through the shared callableService, whose
  // callable names live in the FUNCTIONS map rather than inline literals.
  const callableSvc = read(path.join(srcDir, 'services', 'callableService.js'));
  const FNAME = /([A-Z_]+):\s*'([a-zA-Z_]+)'/g;
  for (const m of callableSvc.matchAll(FNAME)) called.add(m[2]);

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
    // rateLimit.js, auth.js and pushQueue.js are shared utility modules (no
    // exports.* functions) — required by the modules that use them, never
    // deployed standalone.
    const missing = modules.filter((m) => !required.has(m) && m !== 'index.js' && m !== 'userDelete.js' && m !== 'rateLimit.js' && m !== 'auth.js' && m !== 'pushQueue.js');
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

  // Callables invoked through a config constant rather than an inline literal
  // escaped the regex above and shipped as dead endpoints (getPersonalizedFeedML
  // and generateCaptionForImage both had no function behind them). Resolve the
  // referenced constant back to its string value and assert it is deployed.
  test('config-referenced callables resolve to a real export', () => {
    const configSources = listFiles(srcDir)
      .filter((f) => !f.includes('__tests__'))
      .map(read)
      .join('\n');

    // const NAME = 'callableName'  (or NAME: 'callableName' inside a config map)
    const constValues = new Map();
    for (const m of configSources.matchAll(/^\s*([A-Z_][A-Z0-9_]*)\s*[:=]\s*'([a-zA-Z_][a-zA-Z0-9_]*)'/gm)) {
      constValues.set(m[1], m[2]);
    }

    const referenced = new Set();
    for (const m of configSources.matchAll(/httpsCallable\([^)]*,\s*([A-Za-z_][A-Za-z0-9_.]*)\)/g)) {
      const ref = m[1];
      // The last path segment is the constant key (e.g. FEED_CONFIG.ALGORITHM.ML_ENDPOINT).
      const key = ref.split('.').pop();
      if (constValues.has(key)) referenced.add(constValues.get(key));
    }

    const unresolved = [...referenced].filter((n) => !allExports.has(n));
    expect(unresolved).toEqual([]);
    // Guard against the resolver silently matching nothing.
    expect(referenced.size).toBeGreaterThan(0);
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

describe('Firestore rules — no permissive duplicate surfaces', () => {
  const rules = read(path.join(root, 'firestore.rules'));

  // Extract a top-level `match /name/{x} { ... }` block with brace matching so
  // assertions cannot accidentally inspect a neighbouring rule.
  function matchBlock(name) {
    const marker = `match /${name}/{`;
    const start = rules.indexOf(marker);
    if (start === -1) return null;
    // The block's opening brace is the last '{' on the match line — the path
    // placeholder `{txId}` has a brace of its own.
    const lineEnd = rules.indexOf('\n', start);
    const open = rules.lastIndexOf('{', lineEnd);
    let depth = 0;
    for (let i = open; i < rules.length; i++) {
      if (rules[i] === '{') depth++;
      else if (rules[i] === '}') {
        depth--;
        if (depth === 0) return rules.slice(start, i + 1);
      }
    }
    return null;
  }

  // Firestore ORs every matching rule's allows, so a second, looser block for
  // the same path silently defeats a strict one. coin_transactions and
  // counter_shards both suffered from this: a strict server-only block was
  // overridden by a later `allow write: if isSignedIn()`.
  test('coin_transactions is server-only (no client create path anywhere)', () => {
    const block = matchBlock('coin_transactions');
    expect(block).not.toBeNull();
    expect(block).toContain('allow create, update, delete: if false;');
    expect(block).not.toMatch(/allow create:\s*if isSignedIn/);
    // And it must be the only block for that path.
    expect(rules.split('match /coin_transactions/').length - 1).toBe(1);
  });

  test('counter_shards never grants a blanket client write', () => {
    expect(rules.split('match /counter_shards/').length - 1).toBe(1);
    const block = matchBlock('counter_shards');
    expect(block).not.toBeNull();
    expect(block).toContain("affectedKeys().hasOnly(['value'])");
    expect(block).not.toContain('allow write: if isSignedIn();');
  });

  test('each top-level collection is matched at most once', () => {
    const topLevel = [...rules.matchAll(/\n {4}match \/([a-z_]+)\/\{[a-zA-Z_]+\}\s*\{/g)].map((m) => m[1]);
    const seen = new Set();
    const dups = topLevel.filter((c) => (seen.has(c) ? true : (seen.add(c), false)));
    expect(dups).toEqual([]);
  });
});

describe('Server-authoritative admin actions', () => {
  const adminSrc = read(path.join(functionsDir, 'admin.js'));

  test('exports the admin callables the screens depend on', () => {
    expect(adminSrc).toContain('exports.applyUserAdminAction');
    expect(adminSrc).toContain('exports.listUsers');
    expect(adminSrc).toContain('exports.resolveUserReport');
  });

  test('re-verifies admin membership server-side and audits every action', () => {
    expect(adminSrc).toContain("require('./auth')");
    expect(adminSrc).toContain('assertAdmin(context)');
    expect(adminSrc).toContain("collection('moderation_logs')");
  });

  test('admin screen does not write privileged user fields from the client', () => {
    const screen = read(path.join(srcDir, 'screens', 'Admin', 'AdminUserManagementScreen.jsx'));
    expect(screen).toContain("'applyUserAdminAction'");
    expect(screen).not.toMatch(/updateDoc\(ref, payload\)/);
    expect(screen).not.toMatch(/accountStatus = 'banned'/);
  });

  test('all modules share one admin definition (no divergent checks)', () => {
    const authSrc = read(path.join(functionsDir, 'auth.js'));
    expect(authSrc).toContain('const isAdmin = async (uid)');
    expect(authSrc).toContain("db.doc(`admins/${uid}`).get()");
    // Each privileged module must delegate rather than re-implement.
    for (const mod of ['admin.js', 'moderation.js', 'user.js', 'notifications.js']) {
      const src = read(path.join(functionsDir, mod));
      expect(src).toContain("require('./auth')");
      // No re-definition of the admin helpers in a consumer module.
      expect(src).not.toMatch(/(?:const|function)\s+isAdmin\s*=/);
      expect(src).not.toMatch(/(?:const|function)\s+assertAdmin\s*[=(]/);
    }
  });

  test('owner can bootstrap the first admin, and the last admin is protected', () => {
    const src = read(path.join(functionsDir, 'admin.js'));
    // The one-time claim path.
    expect(src).toContain('exports.bootstrapOwner');
    expect(src).toContain('process.env.OWNER_EMAILS');
    // Ownership is only claimable from a verified address.
    expect(src).toContain('email_verified');
    // Roster management exists and is admin-gated.
    expect(src).toContain('exports.grantAdmin');
    expect(src).toContain('exports.revokeAdmin');
    expect(src).toContain('exports.listAdmins');
    expect(src).toContain('exports.getAdminStatus');
    // The final admin cannot be revoked, and the guard is race-safe.
    expect(src).toContain('Refusing to remove the last admin');
    expect(src).toContain('db.runTransaction');
  });

  test('the admins collection is not client-readable', () => {
    const rules = read(path.join(root, 'firestore.rules'));
    const block = rules.slice(
      rules.indexOf('match /admins/{userId}'),
      rules.indexOf('match /admins/{userId}') + 400
    );
    expect(block).toContain('allow read: if false;');
    expect(block).toContain('allow write: if false;');
    // The route gate must go through the callable, not a roster read.
    const routes = read(path.join(srcDir, 'routes', 'AppRoutes.jsx'));
    expect(routes).toContain('fetchAdminStatus');
    expect(routes).not.toContain("doc(firestore, 'admins', user.uid)");
  });
});

describe('Level/XP awarding is server-authoritative', () => {
  const service = read(path.join(srcDir, 'services', 'levelSystemService.js'));

  test('client cannot mint XP, coins or active days locally', () => {
    expect(service).toContain('LEVEL_SERVER_UNAVAILABLE');
    expect(service).not.toMatch(/increment\(coinReward\)/);
    expect(service).not.toMatch(/fstore\.doc\(db, 'active_days_ledger'/);
    expect(service).not.toMatch(/fstore\.doc\(db, 'coin_ledger'/);
  });

  test('client never synthesizes a missing profile identity', () => {
    const userSrc = read(path.join(srcDir, 'services', 'userService.js'));
    // The old fallback invented displayName/username/avatar for missing docs.
    expect(userSrc).not.toMatch(/const synth = \{/);
    expect(userSrc).toContain('Never synthesize an identity');
  });
});
