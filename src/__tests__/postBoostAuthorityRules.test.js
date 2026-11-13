/**
 * @jest-environment node
 *
 * Paid post boost is server-authoritative (N372).
 *
 * `functions/monetization.js#boostPost` debits coins and writes
 * `posts/{id}.boostData` plus `boosted_posts/{postId}`. A client must not be able
 * to seed `boostData` at post creation, move it on update, or write
 * `boosted_posts` itself — any of those would mint a free promotion without the
 * coin debit. `boosted_posts` is a public (signed-in) ranking signal that only
 * the server writes.
 *
 * Static assertions always run; the adversarial ones run against the Firestore
 * emulator when the `guards` CI job provides one.
 */

import fs from 'node:fs';
import path from 'node:path';

const rules = fs.readFileSync(path.resolve(process.cwd(), 'firestore.rules'), 'utf8');
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
async function makeEnv(projectId) {
  const { initializeTestEnvironment } = await import('@firebase/rules-unit-testing');
  return initializeTestEnvironment({
    projectId,
    firestore: { rules, host: emulatorHost.split(':')[0], port: Number(emulatorHost.split(':')[1]) },
  });
}

describe('paid post boost is server-authoritative', () => {
  beforeAll(async () => {
    if (await emulatorReachable()) fsMod = await import('firebase/firestore');
  });

  test('the posts create rule forbids a client-seeded boostData (static)', () => {
    const start = rules.indexOf('match /posts/{postId}');
    const block = rules.slice(start, rules.indexOf('match /comments', start));
    expect(block).toContain("request.resource.data.get('boostData', null) == null");
  });

  test('the posts author-update carve-out forbids boostData (static)', () => {
    const start = rules.indexOf('match /posts/{postId}');
    const block = rules.slice(start, rules.indexOf('match /comments', start));
    expect(block).toContain("'poll', 'gifts', 'boostData'");
  });

  test('boosted_posts is signed-in read, server-only write (static)', () => {
    const start = rules.indexOf('match /boosted_posts/{postId}');
    expect(start).toBeGreaterThan(-1);
    const block = rules.slice(start, rules.indexOf('match /audio_tracks', start));
    expect(block).toContain('allow read: if isSignedIn()');
    expect(block).toContain('allow write: if false');
  });

  test('an author cannot seed boostData on create or move it on update (emulator)', async () => {
    if (!fsMod) return;
    const env = await makeEnv('arvdoul-boost-authority');
    try {
      await env.clearFirestore();
      const author = env.authenticatedContext('author').firestore();
      // Author's own profile (create rule requires authorIsPrivate to match).
      await env.withSecurityRulesDisabled(async (ctx) => {
        await fsMod.setDoc(fsMod.doc(ctx.firestore(), 'users/author'), {
          displayName: 'A', isPrivate: false, coins: 1000,
        });
        await fsMod.setDoc(fsMod.doc(ctx.firestore(), 'posts/existing'), {
          authorId: 'author', authorIsPrivate: false, visibility: 'public',
          status: 'published', isDeleted: false, stats: { likes: 0 },
        });
      });

      const base = {
        authorId: 'author', authorIsPrivate: false, visibility: 'public',
        status: 'published', isDeleted: false, stats: { likes: 0 },
      };

      // Seeding a free promotion at creation is refused.
      await expect(
        fsMod.setDoc(fsMod.doc(author, 'posts/free_boost'), {
          ...base, boostData: { isBoosted: true },
        }),
      ).rejects.toBeDefined();

      // Self-granting a boost on an existing post is refused.
      await expect(
        fsMod.updateDoc(fsMod.doc(author, 'posts/existing'), {
          boostData: { isBoosted: true },
        }),
      ).rejects.toBeDefined();

      // A plain author edit still succeeds.
      await expect(
        fsMod.updateDoc(fsMod.doc(author, 'posts/existing'), {
          content: 'edited',
        }),
      ).resolves.toBeUndefined();

      // boosted_posts cannot be written by a client...
      await expect(
        fsMod.setDoc(fsMod.doc(author, 'boosted_posts/existing'), {
          postId: 'existing', userId: 'author', expiresAt: Date.now() + 1e9,
        }),
      ).rejects.toBeDefined();

      // ...but a signed-in viewer may read the active-promotion signal.
      await env.withSecurityRulesDisabled(async (ctx) => {
        await fsMod.setDoc(fsMod.doc(ctx.firestore(), 'boosted_posts/existing'), {
          postId: 'existing', userId: 'author', expiresAt: Date.now() + 1e9,
        });
      });
      await expect(
        fsMod.getDoc(fsMod.doc(author, 'boosted_posts/existing')),
      ).resolves.toBeDefined();

      const anon = env.unauthenticatedContext().firestore();
      await expect(
        fsMod.getDoc(fsMod.doc(anon, 'boosted_posts/existing')),
      ).rejects.toBeDefined();
    } finally {
      await env.cleanup();
    }
  });
});
