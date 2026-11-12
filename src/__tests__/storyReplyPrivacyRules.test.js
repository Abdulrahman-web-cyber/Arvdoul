/**
 * @jest-environment node
 *
 * Story replies are a private interaction between the replier and the story
 * owner. The `story_replies/{id}` document records `userId` (the replier) and
 * `toUserId` (the owner) and was `allow read: if true`, so any client could
 * enumerate the replier -> owner relationship graph (and each reply's story).
 * No client reads the collection today (it is a reply log), so the read is
 * scoped to the two parties plus admins.
 *
 * The static check always runs; the adversarial check runs against the
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

describe('story replies are not world-readable', () => {
  let reachable = false;

  beforeAll(async () => {
    reachable = await emulatorReachable();
    if (!reachable) {
      console.warn(`[storyReplyPrivacyRules] emulator not reachable at ${emulatorHost}; skipping adversarial checks`);
      return;
    }
    rules = readFile('firestore.rules');
    fsMod = await import('firebase/firestore');
  });

  test('the story_replies read rule is party-scoped, not public', () => {
    const rulesSrc = readFile('firestore.rules');
    const start = rulesSrc.indexOf('match /story_replies/{replyId}');
    expect(start).toBeGreaterThan(-1);
    const block = rulesSrc.slice(start, rulesSrc.indexOf('match /', start + 10));
    expect(block).not.toMatch(/allow read: if true/);
    expect(block).toMatch(/resource\.data\.userId == uid\(\)/);
    expect(block).toMatch(/resource\.data\.toUserId == uid\(\)/);
  });

  test('only the replier, the owner and admins can read a reply (emulator)', async () => {
    if (!reachable) return;
    const env = await makeEnv('arvdoul-story-reply-privacy');
    try {
      await env.clearFirestore();
      await env.withSecurityRulesDisabled(async (ctx) => {
        const db = ctx.firestore();
        await fsMod.setDoc(fsMod.doc(db, 'story_replies/r1'), {
          storyId: 's1', userId: 'alice', fromUserId: 'alice', toUserId: 'bob',
        });
      });
      const stranger = env.authenticatedContext('stranger').firestore();
      const alice = env.authenticatedContext('alice').firestore();
      const bob = env.authenticatedContext('bob').firestore();

      await expect(fsMod.getDoc(fsMod.doc(stranger, 'story_replies/r1'))).rejects.toBeDefined();
      await expect(fsMod.getDoc(fsMod.doc(alice, 'story_replies/r1'))).resolves.toBeDefined();
      await expect(fsMod.getDoc(fsMod.doc(bob, 'story_replies/r1'))).resolves.toBeDefined();
    } finally {
      await env.cleanup();
    }
  });
});
