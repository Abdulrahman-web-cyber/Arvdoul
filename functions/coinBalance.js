// functions/coinBalance.js — the single accessor for a user's coin balance.
//
// `coins` and `lockedCoins` are financial figures. They used to live on the
// world-signed-in-readable `users/{uid}` document, so any signed-in client
// could read anyone's balance regardless of the owner's `economicStatus`
// scope (N324) — Firestore rules cannot field-mask a readable document.
//
// The authoritative balance therefore lives on `users_private/{uid}`, which
// only the owner and admins may read. Every balance read/write inside a
// transaction goes through these helpers so a new call site cannot silently
// reintroduce the public field, and `coinBalanceBoundary.test.js` fails if a
// `functions/*.js` file touches `coins`/`lockedCoins` off the public doc.

const admin = require('firebase-admin');

const PRIVATE_COLLECTION = 'users_private';

const privateRef = (uid) => admin.firestore().collection(PRIVATE_COLLECTION).doc(uid);

/**
 * Read a user's authoritative balance inside a transaction.
 *
 * Legacy fallback: until `functions/privacyMigration.js` backfills every
 * account, an account may still carry its balance on the public doc. When
 * `opts.fallbackToPublic` is set and the private doc has no `coins` field yet,
 * the public field is read so a balance is never lost between the code deploy
 * and the migration sweep. Pass the flag from money paths whose correctness
 * depends on not under-reading a balance; it is inert after the migration.
 *
 * @param {object} t A Firestore transaction.
 * @param {string} uid
 * @param {{fallbackToPublic?: boolean}} [opts]
 * @returns {Promise<{coins: number, lockedCoins: number, available: number, data: object}>}
 */
async function readCoinBalance(t, uid, opts = {}) {
  const snap = await t.get(privateRef(uid));
  const data = snap.exists ? snap.data() : {};
  let coins = data.coins;
  let lockedCoins = data.lockedCoins;
  if (coins === undefined && opts.fallbackToPublic) {
    const publicSnap = await t.get(admin.firestore().collection('users').doc(uid));
    if (publicSnap.exists) {
      coins = publicSnap.data().coins;
      if (lockedCoins === undefined) lockedCoins = publicSnap.data().lockedCoins;
    }
  }
  return {
    coins: Number(coins || 0),
    lockedCoins: Number(lockedCoins || 0),
    available: Number(coins || 0) - Number(lockedCoins || 0),
    data,
  };
}

/** Available (spendable) balance = coins - lockedCoins. */
const availableFrom = (data) => Number(data?.coins || 0) - Number(data?.lockedCoins || 0);

/**
 * Write an absolute balance inside a transaction. Only the balance fields are
 * touched, so unrelated private fields (email, Stripe ids) are preserved.
 */
function writeCoinBalance(t, uid, patch) {
  t.set(privateRef(uid), patch, { merge: true });
}

module.exports = {
  PRIVATE_COLLECTION,
  privateRef,
  readCoinBalance,
  availableFrom,
  writeCoinBalance,
};
