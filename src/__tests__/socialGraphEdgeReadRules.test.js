/**
 * @jest-environment node
 *
 * The graph spine reads `blocks`/`mutes`/`restricts` under collection rules that
 * authorise on `resource.data.<actorField> == uid()`. Firestore rules are not
 * filters, which produced two silent failures:
 *
 *  1. A `documentId() in [...]` list read cannot prove the actor condition, so
 *     the batch reader's safety edges were denied and swallowed → follower
 *     lists lost block/mute masking.
 *  2. A point read of a *missing* edge (`resource == null`) hit
 *     `resource.data.<actorField>` and evaluated to a permission error, so
 *     `getRelationship`/`followUser`/`isBlocked`/`isMuted`/`isRestricted`
 *     (which read absent edges as "no edge") rejected → almost every
 *     relationship resolved to "no relationship".
 *
 * The fix keeps the rules `resource.data`-scoped (a null-resource `get` would
 * leak edge existence) and moves every safety-edge read onto the actor-scoped
 * list shape the rules can prove. These checks run against the Firestore
 * emulator when one is reachable (the `guards` CI job provides one); otherwise
 * they are skipped.
 */

const emulatorHost = process.env.FIRESTORE_EMULATOR_HOST;

async function emulatorReachable() {
  if (!emulatorHost) return false;
  try {
    const res = await fetch(`http://${emulatorHost}/`);
    return res.ok || res.status === 200;
  } catch {
    return false;
  }
}

let fsMod;
let rules;

async function makeEnv(projectId) {
  const { initializeTestEnvironment } = await import('@firebase/rules-unit-testing');
  return initializeTestEnvironment({
    projectId,
    firestore: { rules, host: emulatorHost.split(':')[0], port: Number(emulatorHost.split(':')[1]) },
  });
}

describe('social-graph edge reads satisfy the collection rules (emulator)', () => {
  let reachable = false;

  beforeAll(async () => {
    reachable = await emulatorReachable();
    if (!reachable) {
      console.warn(`[socialGraphEdgeReadRules] emulator not reachable at ${emulatorHost}; skipping`);
      return;
    }
    const fs = await import('node:fs');
    const path = await import('node:path');
    rules = fs.readFileSync(path.resolve(process.cwd(), 'firestore.rules'), 'utf8');
    fsMod = await import('firebase/firestore');
  });

  test('a multi-id id-only list query cannot be proven against the block rule', async () => {
    if (!reachable) return;
    const env = await makeEnv('arvdoul-graph-test');
    try {
      await env.clearFirestore();
      await env.withSecurityRulesDisabled(async (ctx) => {
        const db = ctx.firestore();
        await fsMod.setDoc(fsMod.doc(db, 'blocks/alice_bob'), { blockerId: 'alice', blockedId: 'bob' });
      });
      const alice = env.authenticatedContext('alice').firestore();
      // `documentId() in [...]` constrains only the id; the rule authorises on
      // `resource.data.blockerId == uid()`, so with >1 candidate id the query
      // is denied (with a single id the SDK resolves it to a point read, which
      // is why the bug hides in small test fixtures).
      const idOnly = fsMod.query(
        fsMod.collection(alice, 'blocks'),
        fsMod.where(fsMod.documentId(), 'in', ['alice_bob', 'alice_carol']),
        fsMod.limit(2)
      );
      await expect(fsMod.getDocs(idOnly)).rejects.toMatchObject({ code: 'permission-denied' });
    } finally {
      await env.cleanup();
    }
  });

  test('the actor-equality shape is allowed for block/mute/restrict', async () => {
    if (!reachable) return;
    const env = await makeEnv('arvdoul-graph-test');
    try {
      await env.clearFirestore();
      await env.withSecurityRulesDisabled(async (ctx) => {
        const db = ctx.firestore();
        await fsMod.setDoc(fsMod.doc(db, 'blocks/alice_bob'), { blockerId: 'alice', blockedId: 'bob' });
        await fsMod.setDoc(fsMod.doc(db, 'blocks/alice_erin'), { blockerId: 'alice', blockedId: 'erin' });
        await fsMod.setDoc(fsMod.doc(db, 'blocks/carol_alice'), { blockerId: 'carol', blockedId: 'alice' });
        await fsMod.setDoc(fsMod.doc(db, 'blocks/dave_alice'), { blockerId: 'dave', blockedId: 'alice' });
        await fsMod.setDoc(fsMod.doc(db, 'mutes/alice_bob'), { muterId: 'alice', mutedId: 'bob' });
        await fsMod.setDoc(fsMod.doc(db, 'mutes/alice_erin'), { muterId: 'alice', mutedId: 'erin' });
        await fsMod.setDoc(fsMod.doc(db, 'restricts/alice_bob'), { restricterId: 'alice', restrictedId: 'bob' });
        await fsMod.setDoc(fsMod.doc(db, 'restricts/alice_erin'), { restricterId: 'alice', restrictedId: 'erin' });
      });
      const alice = env.authenticatedContext('alice').firestore();

      const blocksOut = fsMod.query(
        fsMod.collection(alice, 'blocks'),
        fsMod.where('blockerId', '==', 'alice'),
        fsMod.where('blockedId', 'in', ['bob', 'erin']),
        fsMod.limit(2)
      );
      await expect(fsMod.getDocs(blocksOut)).resolves.toBeTruthy();

      const blocksIn = fsMod.query(
        fsMod.collection(alice, 'blocks'),
        fsMod.where('blockedId', '==', 'alice'),
        fsMod.where('blockerId', 'in', ['carol', 'dave']),
        fsMod.limit(2)
      );
      await expect(fsMod.getDocs(blocksIn)).resolves.toBeTruthy();

      const mutes = fsMod.query(
        fsMod.collection(alice, 'mutes'),
        fsMod.where('muterId', '==', 'alice'),
        fsMod.where('mutedId', 'in', ['bob', 'erin']),
        fsMod.limit(2)
      );
      await expect(fsMod.getDocs(mutes)).resolves.toBeTruthy();

      const restricts = fsMod.query(
        fsMod.collection(alice, 'restricts'),
        fsMod.where('restricterId', '==', 'alice'),
        fsMod.where('restrictedId', 'in', ['bob', 'erin']),
        fsMod.limit(2)
      );
      await expect(fsMod.getDocs(restricts)).resolves.toBeTruthy();
    } finally {
      await env.cleanup();
    }
  });

  test('getEdgeSet resolves blocks/mutes/restricts for the viewer', async () => {
    if (!reachable) return;
    const env = await makeEnv('arvdoul-graph-test');
    try {
      await env.clearFirestore();
      await env.withSecurityRulesDisabled(async (ctx) => {
        const db = ctx.firestore();
        await fsMod.setDoc(fsMod.doc(db, 'blocks/alice_bob'), { blockerId: 'alice', blockedId: 'bob' });
        await fsMod.setDoc(fsMod.doc(db, 'blocks/carol_alice'), { blockerId: 'carol', blockedId: 'alice' });
        await fsMod.setDoc(fsMod.doc(db, 'mutes/alice_bob'), { muterId: 'alice', mutedId: 'bob' });
        await fsMod.setDoc(fsMod.doc(db, 'restricts/alice_dave'), { restricterId: 'alice', restrictedId: 'dave' });
      });

      const { getSocialGraphService } = await import('../services/socialGraphService.js');
      const graph = getSocialGraphService();
      graph.firestore = env.authenticatedContext('alice').firestore();
      graph.initialized = true;
      graph.clearCache();

      const map = await graph.getEdgeSet('alice', ['bob', 'carol', 'dave']);
      expect(map.get('bob')).toMatchObject({ isBlocking: true, isBlocked: true, isMuted: true });
      expect(map.get('carol')).toMatchObject({ isBlocking: false, isBlockedBy: true, isBlocked: true });
      expect(map.get('dave')).toMatchObject({ isRestricted: true });
    } finally {
      await env.cleanup();
    }
  });

  test('getRelationship reads absent edges without rejecting', async () => {
    if (!reachable) return;
    const env = await makeEnv('arvdoul-graph-test');
    try {
      await env.clearFirestore();
      await env.withSecurityRulesDisabled(async (ctx) => {
        const db = ctx.firestore();
        await fsMod.setDoc(fsMod.doc(db, 'blocks/alice_bob'), { blockerId: 'alice', blockedId: 'bob' });
        await fsMod.setDoc(fsMod.doc(db, 'mutes/alice_bob'), { muterId: 'alice', mutedId: 'bob' });
        await fsMod.setDoc(fsMod.doc(db, 'follows/alice_bob'), { followerId: 'alice', followingId: 'bob' });
        await fsMod.setDoc(fsMod.doc(db, 'follows/bob_alice'), { followerId: 'bob', followingId: 'alice' });
      });

      const { getSocialGraphService } = await import('../services/socialGraphService.js');
      const graph = getSocialGraphService();
      graph.firestore = env.authenticatedContext('alice').firestore();
      graph.initialized = true;
      graph.clearCache();

      const bob = await graph.getRelationship('alice', 'bob');
      expect(bob).toMatchObject({
        isFollowing: true, isFollower: true, isMutualFriend: true,
        isBlocking: true, isBlocked: true, isMuted: true, isRestricted: false,
      });

      // `zoe` has no edges at all: the six point reads include four missing
      // safety edges, which previously rejected the whole batch.
      const zoe = await graph.getRelationship('alice', 'zoe');
      expect(zoe).toMatchObject({ isFollowing: false, isBlocking: false, isMuted: false, isRestricted: false });
      expect(await graph.areFriends('alice', 'bob')).toBe(true);
      expect(await graph.areFriends('alice', 'zoe')).toBe(false);
    } finally {
      await env.cleanup();
    }
  });

  test('a point read of an absent safety edge is denied (why the spine uses list reads)', async () => {
    if (!reachable) return;
    const env = await makeEnv('arvdoul-graph-test');
    try {
      await env.clearFirestore();
      const alice = env.authenticatedContext('alice').firestore();
      // `resource` is null for a missing doc, so `resource.data.blockerId` makes
      // the rule evaluate to a permission error. This is the trap the spine must
      // not fall into when answering "are we blocked?".
      await expect(fsMod.getDoc(fsMod.doc(alice, 'blocks/alice_bob'))).rejects.toMatchObject({ code: 'permission-denied' });
      await expect(fsMod.getDoc(fsMod.doc(alice, 'mutes/alice_bob'))).rejects.toMatchObject({ code: 'permission-denied' });
      await expect(fsMod.getDoc(fsMod.doc(alice, 'restricts/alice_bob'))).rejects.toMatchObject({ code: 'permission-denied' });

      // The actor-scoped list read is the rules-provable way to learn "no edge".
      const none = fsMod.query(
        fsMod.collection(alice, 'blocks'),
        fsMod.where('blockerId', '==', 'alice'),
        fsMod.where('blockedId', 'in', ['bob']),
        fsMod.limit(1)
      );
      const snap = await fsMod.getDocs(none);
      expect(snap.empty).toBe(true);
    } finally {
      await env.cleanup();
    }
  });

  test('the follow transaction (follows only) is allowed', async () => {
    if (!reachable) return;
    const env = await makeEnv('arvdoul-graph-test');
    try {
      await env.clearFirestore();
      const alice = env.authenticatedContext('alice').firestore();
      // userService.followUser checks blocks via the spine *before* the
      // transaction, then the transaction touches only `follows`.
      await fsMod.runTransaction(alice, async (tx) => {
        const snap = await tx.get(fsMod.doc(alice, 'follows/alice_bob'));
        if (!snap.exists()) {
          tx.set(fsMod.doc(alice, 'follows/alice_bob'), { followerId: 'alice', followingId: 'bob' });
        }
      });
      const snap = await fsMod.getDoc(fsMod.doc(alice, 'follows/alice_bob'));
      expect(snap.exists()).toBe(true);
    } finally {
      await env.cleanup();
    }
  });

  test("a third party still cannot read another user's safety edges", async () => {
    if (!reachable) return;
    const env = await makeEnv('arvdoul-graph-test');
    try {
      await env.clearFirestore();
      await env.withSecurityRulesDisabled(async (ctx) => {
        const db = ctx.firestore();
        await fsMod.setDoc(fsMod.doc(db, 'blocks/alice_bob'), { blockerId: 'alice', blockedId: 'bob' });
        await fsMod.setDoc(fsMod.doc(db, 'mutes/alice_bob'), { muterId: 'alice', mutedId: 'bob' });
      });
      const eve = env.authenticatedContext('eve').firestore();

      await expect(fsMod.getDoc(fsMod.doc(eve, 'blocks/alice_bob'))).rejects.toMatchObject({ code: 'permission-denied' });
      await expect(fsMod.getDoc(fsMod.doc(eve, 'mutes/alice_bob'))).rejects.toMatchObject({ code: 'permission-denied' });
      const listAll = fsMod.query(fsMod.collection(eve, 'blocks'), fsMod.where('blockerId', '==', 'alice'), fsMod.limit(5));
      await expect(fsMod.getDocs(listAll)).rejects.toMatchObject({ code: 'permission-denied' });
      // Eve can only list edges where she is a party (here: none). The
      // actor-scoped shape cannot be widened into an enumeration of alice/bob.
      const eveList = fsMod.query(
        fsMod.collection(eve, 'blocks'),
        fsMod.where('blockedId', '==', 'eve'),
        fsMod.where('blockerId', 'in', ['alice']),
        fsMod.limit(1)
      );
      await expect(fsMod.getDocs(eveList)).resolves.toBeTruthy();
    } finally {
      await env.cleanup();
    }
  });
});
