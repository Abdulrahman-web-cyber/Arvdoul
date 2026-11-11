/**
 * @jest-environment node
 *
 * Secret-community confidentiality.
 *
 * The `communities/{id}` document is world-readable for the directory, but a
 * `secret` community is members-only: its name, description, rules and member
 * roster must not leak to a non-member. Two bugs made that untrue:
 *
 *  1. The read rule was `allow read: if true`, so a stranger could point-read a
 *     secret community (and its `members` privilege map).
 *  2. The obvious fix — `resource.data.get('privacy', 'public') != 'secret'` —
 *     silently re-opens the leak for *list* queries: in a list rule the `.get()`
 *     default form no longer proves a single permission outcome for the whole
 *     potential result set, so an unfiltered directory query returned the
 *     secret rows anyway (rules are not filters; the emulator reproduced this).
 *
 * The rule now reads `resource.data.privacy` directly, and every public-facing
 * community list (`listCommunities`/`searchCommunities`/
 * `getRecommendedCommunities`) constrains `privacy` to the non-secret set.
 *
 * The static checks always run; the adversarial checks run against the
 * Firestore emulator when one is reachable (the `guards` CI job provides one).
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

describe('secret communities are not world-readable', () => {
  let reachable = false;

  beforeAll(async () => {
    reachable = await emulatorReachable();
    if (!reachable) {
      console.warn(`[communityPrivacyRules] emulator not reachable at ${emulatorHost}; skipping adversarial checks`);
      return;
    }
    rules = readFile('firestore.rules');
    fsMod = await import('firebase/firestore');
  });

  test('the community document rule does not use the leak-prone `.get()` default form', () => {
    const rulesSrc = readFile('firestore.rules');
    const start = rulesSrc.indexOf('match /communities/{communityId}');
    expect(start).toBeGreaterThan(-1);
    const block = rulesSrc.slice(start, rulesSrc.indexOf('match /events/', start));
    expect(block).not.toMatch(/resource\.data\.get\(\s*'privacy'/);
    expect(block).toMatch(/resource\.data\.privacy\s*!=\s*'secret'/);
  });

  test('every public-facing community list constrains privacy to the non-secret set', () => {
    const svc = readFile('src/services/communityService.js');
    const occurrences = svc.match(/where\('privacy',\s*'in',\s*\['public',\s*'private'\]\)/g) || [];
    // listCommunities + searchCommunities + getRecommendedCommunities
    expect(occurrences.length).toBeGreaterThanOrEqual(3);
  });

  test('stranger cannot point-read a secret community; a member can (emulator)', async () => {
    if (!reachable) return;
    const env = await makeEnv('arvdoul-community-privacy');
    try {
      await env.clearFirestore();
      await env.withSecurityRulesDisabled(async (ctx) => {
        const db = ctx.firestore();
        await fsMod.setDoc(fsMod.doc(db, 'communities/sec'), {
          name: 'Sec', privacy: 'secret', isDeleted: false, discoveryEnabled: true,
          members: { owner: { role: 'owner' }, member: { role: 'member' } },
        });
        await fsMod.setDoc(fsMod.doc(db, 'communities/pub'), {
          name: 'Pub', privacy: 'public', isDeleted: false, discoveryEnabled: true,
          members: { owner: { role: 'owner' } },
        });
      });
      const stranger = env.authenticatedContext('stranger').firestore();
      const member = env.authenticatedContext('member').firestore();
      const anon = env.unauthenticatedContext().firestore();

      await expect(fsMod.getDoc(fsMod.doc(stranger, 'communities/sec'))).rejects.toBeDefined();
      await expect(fsMod.getDoc(fsMod.doc(anon, 'communities/sec'))).rejects.toBeDefined();
      await expect(fsMod.getDoc(fsMod.doc(member, 'communities/sec'))).resolves.toBeDefined();
      await expect(fsMod.getDoc(fsMod.doc(anon, 'communities/pub'))).resolves.toBeDefined();
    } finally {
      await env.cleanup();
    }
  });

  test('an unfiltered directory list cannot return a secret community (emulator)', async () => {
    if (!reachable) return;
    const env = await makeEnv('arvdoul-community-privacy');
    try {
      await env.clearFirestore();
      await env.withSecurityRulesDisabled(async (ctx) => {
        const db = ctx.firestore();
        for (const [id, privacy] of [['pub', 'public'], ['priv', 'private'], ['sec', 'secret']]) {
          await fsMod.setDoc(fsMod.doc(db, 'communities', id), {
            name: id, privacy, isDeleted: false, discoveryEnabled: true,
            stats: { memberCount: 1 }, members: { owner: { role: 'owner' } },
          });
        }
      });
      const stranger = env.authenticatedContext('stranger').firestore();

      // Unfiltered: the query could return the secret doc → whole request denied.
      await expect(fsMod.getDocs(fsMod.query(
        fsMod.collection(stranger, 'communities'),
        fsMod.where('isDeleted', '==', false),
        fsMod.where('discoveryEnabled', '==', true),
        fsMod.limit(20),
      ))).rejects.toBeDefined();

      // The constrained directory shape the client now sends succeeds and omits secret.
      const snap = await fsMod.getDocs(fsMod.query(
        fsMod.collection(stranger, 'communities'),
        fsMod.where('isDeleted', '==', false),
        fsMod.where('discoveryEnabled', '==', true),
        fsMod.where('privacy', 'in', ['public', 'private']),
        fsMod.limit(20),
      ));
      const ids = snap.docs.map((d) => d.id).sort();
      expect(ids).toEqual(['priv', 'pub']);

      // A non-member explicitly filtering for secret gets nothing.
      await expect(fsMod.getDocs(fsMod.query(
        fsMod.collection(stranger, 'communities'),
        fsMod.where('isDeleted', '==', false),
        fsMod.where('discoveryEnabled', '==', true),
        fsMod.where('privacy', '==', 'secret'),
        fsMod.limit(20),
      ))).rejects.toBeDefined();
    } finally {
      await env.cleanup();
    }
  });
});
