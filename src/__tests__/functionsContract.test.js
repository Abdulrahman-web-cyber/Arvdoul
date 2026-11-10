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
    if (entry.isDirectory()) {
      // Vendored dependencies are not deployable function modules.
      if (entry.name === 'node_modules') continue;
      out.push(...listFiles(path.join(dir, entry.name)));
    } else if (/\.(js|jsx)$/.test(entry.name)) out.push(path.join(dir, entry.name));
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

  // Services now route through callableService via `FUNCTIONS.<CONSTANT>`
  // (the single name registry). Resolve those constants back to callable
  // names so the contract still sees every call the client makes.
  const callableServiceSrc = read(path.join(srcDir, 'services', 'callableService.js'));
  const constantToName = {};
  for (const m of callableServiceSrc.matchAll(/^\s*([A-Z_]+):\s*'([a-zA-Z_]+)'/gm)) {
    constantToName[m[1]] = m[2];
  }
  for (const m of clientSources.matchAll(/FUNCTIONS\.([A-Z_]+)/g)) {
    if (constantToName[m[1]]) called.add(constantToName[m[1]]);
  }
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
    // rateLimit.js and withdrawalSettlement.js are shared utility modules (no
    // exports.* functions) — required by the modules that use them, never
    // deployed standalone.
    // xpAward.js is the shared XP-award routine required by levelSystem.js,
    // monetization.js and polls.js (no exports.* of its own).
    const shared = new Set(['rateLimit.js', 'withdrawalSettlement.js', 'xpAward.js']);
    const missing = modules.filter((m) => !required.has(m) && m !== 'index.js' && m !== 'userDelete.js' && !shared.has(m));
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

describe('Monetization server invariants (ledger + idempotency)', () => {
  const monetization = fs.readFileSync(
    path.join(root, 'functions', 'monetization.js'), 'utf8'
  );

  test('subscription grants share one double-entry credit path', () => {
    // createSubscription and the renewal webhook must not hand-roll two
    // different ledger shapes for the same monthly grant.
    expect(monetization).toContain('async function creditSubscriptionCoins(');
    expect(monetization).toContain('await creditSubscriptionCoins(t, {');
    expect(monetization.match(/creditSubscriptionCoins\(/g).length).toBeGreaterThanOrEqual(3);
  });

  test('the renewal webhook credits real coins, idempotent on the Stripe event', () => {
    // It used to read tiers from an unwritten config doc (granting 0) and only
    // sent a push. It must now write the ledger, keyed on the event id.
    expect(monetization).toContain('const coinAmount = SUBSCRIPTION_TIERS[tier]?.coinsPerMonth || subData.coinsPerMonth || 0;');
    expect(monetization).toContain('idempotency_ledger\').doc(`webhook_${event.id}`)');
    expect(monetization).not.toContain("configDoc.data()?.SUBSCRIPTION_TIERS");
    expect(monetization).not.toContain("console.log(`Granting ${coinAmount} coins");
  });

  test('purchaseCoins credits only a settled PaymentIntent', () => {
    // `confirm: true` with a card that needs 3DS returns `requires_action`
    // (it does not throw); crediting that mints coins the user never paid for.
    expect(monetization).toContain('const paymentIntent = await stripe.paymentIntents.create(');
    expect(monetization).toContain("paymentIntent.status !== 'succeeded'");
  });

  test('createSubscription charges the first invoice before crediting coins', () => {
    // `default_incomplete` left the first invoice unpaid while the code still
    // marked the sub active and granted the monthly coins. `error_if_incomplete`
    // throws on a card that cannot be charged off-session.
    expect(monetization).toContain("payment_behavior: 'error_if_incomplete'");
    expect(monetization).not.toContain("payment_behavior: 'default_incomplete'");
  });

  test('subscription docs are keyed by uid everywhere', () => {
    // The client and the callables read `subscriptions/{uid}`. Keying the
    // webhook by the Stripe subscription id would write a phantom doc, leave
    // the real one stale, and make every renewal grant 0 coins.
    expect(monetization).toContain("const subRef = db.collection('subscriptions').doc(userId);");
    expect(monetization).not.toContain("db.collection('subscriptions').doc(subscriptionId)");
    expect(monetization).not.toContain("db.collection('subscriptions').doc(subscription.id).update");
  });

  test('requestWithdrawal locks coins and records idempotency in one transaction', () => {
    const body = monetization.slice(monetization.indexOf('exports.requestWithdrawal'));
    const txStart = body.indexOf('const resultData = await createFirestoreTransaction');
    const txEnd = body.indexOf('await admin.firestore().collection(\'admin_notifications\')');
    expect(txStart).toBeGreaterThan(-1);
    expect(txEnd).toBeGreaterThan(txStart);
    const tx = body.slice(txStart, txEnd);
    expect(tx).toContain('lockedCoins: admin.firestore.FieldValue.increment(amount)');
    expect(tx).toContain('t.set(ledgerRef, {');
    expect(tx).toContain("t.set(lockTxRef, {");
    // No pre-transaction ledger read that would let a retry double-lock.
    expect(body).not.toContain('const ledgerSnap = await ledgerRef.get();');
  });

  test('the settlement path converts coins at the shared rate, not a shadow copy', () => {
    const settlement = fs.readFileSync(
      path.join(root, 'functions', 'withdrawalSettlement.js'), 'utf8'
    );
    // It used to hardcode `... : 200`, a shadow rate that would drift if
    // COINS_PER_DOLLAR ever changed. The rate override was later removed
    // entirely — a caller-supplied rate is a second source of truth for a
    // real-money payout, so the module must read the shared config only.
    expect(settlement).toContain("require('./levelConfig.cjs')");
    expect(settlement).toContain('coinsToUsd(withdrawalData.amount)');
    expect(settlement).not.toMatch(/coinsPerDollar/);
    expect(settlement).not.toMatch(/:\s*200\b/);
  });

  test('the settlement path verifies the balance BEFORE sending a Stripe payout', () => {
    const settlement = fs.readFileSync(
      path.join(root, 'functions', 'withdrawalSettlement.js'), 'utf8'
    );
    // `stripe.payouts.create` is irreversible. A balance that shrank between
    // the request and the approval (concurrent spend, admin debit) must fail
    // BEFORE the payout is created; otherwise real money leaves the platform
    // for coins the creator no longer holds. The finalize transaction re-checks
    // but runs after Stripe and cannot un-send the payout.
    const payoutAt = settlement.indexOf('await stripe.payouts.create(');
    const precheckAt = settlement.indexOf('Insufficient balance before payout.');
    expect(payoutAt).toBeGreaterThan(-1);
    expect(precheckAt).toBeGreaterThan(-1);
    expect(precheckAt).toBeLessThan(payoutAt);
    // The pre-check must be a real guard, not a comment.
    expect(settlement).toMatch(/if\s*\(locked\s*<\s*withdrawalData\.amount\s*\|\|\s*balance\s*<\s*withdrawalData\.amount\)/);
    // A failed pre-flight must release the hold, or the coins stay locked
    // forever on a withdrawal that never paid out.
    expect(settlement).toContain('lockedCoins: admin.firestore.FieldValue.increment(-releaseAmount)');
  });

  test('a settled withdrawal burns the coins from the supply counter', () => {
    const settlement = fs.readFileSync(
      path.join(root, 'functions', 'withdrawalSettlement.js'), 'utf8'
    );
    // Redeeming coins for fiat removes them from circulation. Every other
    // mint/burn path bumps `system/coin_supply`; without the decrement here the
    // scheduled `auditCoins` reconciliation reported permanent drift after
    // every payout (supply counted coins the creator no longer holds).
    const completion = settlement.slice(settlement.indexOf("reason: 'withdrawal_completed'"));
    expect(completion).toContain("doc('coin_supply')");
    expect(completion).toContain('increment(-withdrawalData.amount)');
  });

  test('level-up coin rewards land in the wallet ledger and supply counter', () => {
    const levelSystem = fs.readFileSync(
      path.join(root, 'functions', 'levelSystem.js'), 'utf8'
    );
    // The award transaction lives in xpAward.js (the single server XP routine
    // that awardExperience delegates to); levelSystem.js must still route
    // through it rather than mutating XP inline.
    const xpAward = fs.readFileSync(
      path.join(root, 'functions', 'xpAward.js'), 'utf8'
    );
    expect(levelSystem).toContain("require('./xpAward')");
    // Rewards used to go to a coin_ledger collection nothing reads and skipped
    // the supply counter, so the wallet never showed them and the ledger and
    // supply totals disagreed.
    expect(xpAward).toContain("db.collection('coin_transactions').doc()");
    expect(xpAward).toContain("reason: 'level_up_reward'");
    expect(xpAward).toContain("doc('coin_supply')");
    expect(xpAward).not.toContain('coin_ledger/${uid}_levelup');
  });

  test('the level ledgers are server-write-only in the rules', () => {
    const rules = fs.readFileSync(path.join(root, 'firestore.rules'), 'utf8');
    for (const collection of ['coin_ledger', 'active_days_ledger']) {
      const start = rules.indexOf(`match /${collection}/`);
      expect(start).toBeGreaterThan(-1);
      // Slice to the next match block (a naive indexOf('}') would stop at the
      // `{entryId}` wildcard brace).
      const next = rules.indexOf('match /', start + 1);
      const block = rules.slice(start, next === -1 ? undefined : next);
      // A client create rule would let a user mint their own reward/streak entry.
      expect(block).toContain('allow create, update, delete: if false;');
      expect(block).not.toMatch(/allow create: if isSignedIn/);
    }
  });

  test('the coin audit reconciles the supply counter instead of trusting it', () => {
    // It used to log the counter and return ("we'll still do a sample check for
    // now"), so a mint/burn path that forgot to bump the counter went unnoticed.
    expect(monetization).not.toContain('sample check for now');
    expect(monetization).toContain("aggregate({ total: admin.firestore.AggregateField.sum('coins') })");
    expect(monetization).toContain('coin_audit_drift');
  });
});

