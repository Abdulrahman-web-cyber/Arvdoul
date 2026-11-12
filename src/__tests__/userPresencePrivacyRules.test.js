/**
 * @jest-environment node
 *
 * Live presence read-authorization (AUDIT V3 N321).
 *
 * `isOnline` / `lastActive` used to live on the world-signed-in-readable
 * `users/{uid}` document, so any authenticated client could read anyone's live
 * online status and activity timestamp with a raw `getDoc` — even when the
 * profile set the `presence` scope to `ONLY_ME`. The scope was enforced only by
 * the client projection (`resolveCapabilities` / `projectProfileForViewer`),
 * never by the rules (the N315 class).
 *
 * Presence now lives in its own scope-gated `user_presence/{uid}` document whose
 * rule mirrors `profileSectionReadable(userId, 'presence', 'FOLLOWERS')`, and the
 * `users/{uid}` create/update rules refuse the two fields so they cannot be
 * reintroduced on the public doc.
 *
 * The static checks always run; the adversarial checks run against the Firestore
 * emulator when one is reachable (the `guards` CI job provides one).
 */

import fs from 'node:fs';
import path from 'node:path';

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

const readFile = (rel) => fs.readFileSync(path.resolve(process.cwd(), rel), 'utf8');

describe('live presence is scope-gated, never on the public user doc', () => {
  let reachable = false;

  beforeAll(async () => {
    reachable = await emulatorReachable();
    if (!reachable) {
      console.warn(`[userPresencePrivacyRules] emulator not reachable at ${emulatorHost}; skipping adversarial checks`);
      return;
    }
    rules = readFile('firestore.rules');
    fsMod = await import('firebase/firestore');
  });

  test('user_presence read mirrors the presence privacy scope (static)', () => {
    const rulesSrc = readFile('firestore.rules');
    const start = rulesSrc.indexOf('match /user_presence/{userId}');
    expect(start).toBeGreaterThan(-1);
    const block = rulesSrc.slice(start, rulesSrc.indexOf('match /', start + 10));
    expect(block).not.toMatch(/allow read: if isSignedIn\(\)\s*;/);
    expect(block).toContain("profileSectionReadable(userId, 'presence', 'FOLLOWERS')");
    expect(block).toMatch(/isAdmin\(\)/);
  });

  test('users/{uid} create/update forbid isOnline and lastActive (static)', () => {
    const rulesSrc = readFile('firestore.rules');
    const helper = rulesSrc.slice(
      rulesSrc.indexOf('function touchesServerAuthoritativeFields'),
      rulesSrc.indexOf(']);', rulesSrc.indexOf('function touchesServerAuthoritativeFields')),
    );
    expect(helper).toContain("'isOnline'");
    expect(helper).toContain("'lastActive'");
    // The create allowlist must also exclude them so a signup cannot seed them.
    const createBlock = rulesSrc.slice(rulesSrc.indexOf('match /users/{userId}'), rulesSrc.indexOf('match /users_private'));
    expect(createBlock).toMatch(/'isOnline', 'lastActive'/);
  });

  test('a stranger cannot read presence the profile set to ONLY_ME (emulator)', async () => {
    if (!reachable) return;
    const env = await makeEnv('arvdoul-user-presence-onlyme');
    try {
      await env.clearFirestore();
      await env.withSecurityRulesDisabled(async (ctx) => {
        const db = ctx.firestore();
        await fsMod.setDoc(fsMod.doc(db, 'users/victim'), {
          displayName: 'V', isPrivate: false, privacy: { presence: 'ONLY_ME' },
        });
        await fsMod.setDoc(fsMod.doc(db, 'user_presence/victim'), { isOnline: true, lastActive: new Date() });
      });
      const stranger = env.authenticatedContext('stranger').firestore();
      const owner = env.authenticatedContext('victim').firestore();
      await expect(fsMod.getDoc(fsMod.doc(stranger, 'user_presence/victim'))).rejects.toBeDefined();
      await expect(fsMod.getDoc(fsMod.doc(owner, 'user_presence/victim'))).resolves.toBeDefined();
    } finally {
      await env.cleanup();
    }
  });

  test('a follower may read FOLLOWERS-scoped presence, a stranger may not (emulator)', async () => {
    if (!reachable) return;
    const env = await makeEnv('arvdoul-user-presence-followers');
    try {
      await env.clearFirestore();
      await env.withSecurityRulesDisabled(async (ctx) => {
        const db = ctx.firestore();
        await fsMod.setDoc(fsMod.doc(db, 'users/target'), {
          displayName: 'T', isPrivate: false, privacy: { presence: 'FOLLOWERS' },
        });
        await fsMod.setDoc(fsMod.doc(db, 'follows/follower_target'), {
          followerId: 'follower', followingId: 'target',
        });
        await fsMod.setDoc(fsMod.doc(db, 'user_presence/target'), { isOnline: true, lastActive: new Date() });
      });
      const follower = env.authenticatedContext('follower').firestore();
      const stranger = env.authenticatedContext('stranger').firestore();
      await expect(fsMod.getDoc(fsMod.doc(follower, 'user_presence/target'))).resolves.toBeDefined();
      await expect(fsMod.getDoc(fsMod.doc(stranger, 'user_presence/target'))).rejects.toBeDefined();
    } finally {
      await env.cleanup();
    }
  });

  test('EVERYONE-scoped presence is readable by any signed-in client (emulator)', async () => {
    if (!reachable) return;
    const env = await makeEnv('arvdoul-user-presence-everyone');
    try {
      await env.clearFirestore();
      await env.withSecurityRulesDisabled(async (ctx) => {
        const db = ctx.firestore();
        await fsMod.setDoc(fsMod.doc(db, 'users/target'), {
          displayName: 'T', isPrivate: false, privacy: { presence: 'EVERYONE' },
        });
        await fsMod.setDoc(fsMod.doc(db, 'user_presence/target'), { isOnline: true, lastActive: new Date() });
      });
      const stranger = env.authenticatedContext('stranger').firestore();
      await expect(fsMod.getDoc(fsMod.doc(stranger, 'user_presence/target'))).resolves.toBeDefined();
    } finally {
      await env.cleanup();
    }
  });

  test('a client cannot seed presence fields onto users/{uid} (emulator)', async () => {
    if (!reachable) return;
    const env = await makeEnv('arvdoul-user-presence-forbidden-fields');
    try {
      await env.clearFirestore();
      await env.withSecurityRulesDisabled(async (ctx) => {
        await fsMod.setDoc(fsMod.doc(ctx.firestore(), 'users/self'), {
          displayName: 'S', isPrivate: false,
        });
      });
      const self = env.authenticatedContext('self').firestore();
      await expect(
        fsMod.updateDoc(fsMod.doc(self, 'users/self'), { isOnline: true }),
      ).rejects.toBeDefined();
      await expect(
        fsMod.updateDoc(fsMod.doc(self, 'users/self'), { lastActive: new Date() }),
      ).rejects.toBeDefined();
    } finally {
      await env.cleanup();
    }
  });
});
