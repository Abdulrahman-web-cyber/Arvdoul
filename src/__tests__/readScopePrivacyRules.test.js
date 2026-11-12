/**
 * @jest-environment node
 *
 * Read-authorization scoping for content collections that shipped as
 * `allow read: if true`.
 *
 * The Firebase project config (`apiKey`, `projectId`, …) is public and is
 * shipped in the client bundle, so `allow read: if true` means "anyone with the
 * app's config — no account required — can dump this collection over the REST
 * API". The app itself has no anonymous auth, so every one of these reads is
 * only ever issued by a signed-in client; the world-readable grant bought
 * nothing and exposed:
 *
 *  - `comments/{id}` and its `history` (previous text) / `reactions` subdocs
 *  - `stories/{id}/reactions` and `stories/{id}/comments` (reactor/commenter
 *    identity on a Vibe whose parent doc may be private/followers-only)
 *  - `highlights/{id}`
 *  - `events/{id}` (title, schedule, ticket tiers, organizer coordinates;
 *    the UI offers a private audience)
 *  - the advanced creator suite (`spaces`, `sounds`, `marketplace_items`,
 *    standalone `polls`, `badges`, `user_badges`, `copyright_registry`)
 *
 * Each is now scoped to a signed-in caller (and, where the record names a
 * person, to the person or an admin). These checks are static — the adversarial
 * checks in `firestoreRulesCompile.test.js` cover the emulator path.
 */

import fs from 'node:fs';
import path from 'node:path';

const readFile = (rel) => fs.readFileSync(path.resolve(process.cwd(), rel), 'utf8');

// Slice from a `match <marker>` to the next top-level `match /` (2-space
// indentation) so nested matches stay inside the block.
function block(rules, marker) {
  const start = rules.indexOf(marker);
  expect(start).toBeGreaterThan(-1);
  const rest = rules.slice(start + marker.length);
  const next = rest.search(/\n {4}match \//);
  return rest.slice(0, next === -1 ? undefined : next);
}

describe('content reads are never world-readable (signed-in at minimum)', () => {
  const rules = readFile('firestore.rules');

  test('comments doc read requires sign-in', () => {
    const b = block(rules, 'match /comments/{commentId}');
    expect(b).not.toMatch(/allow read: if true;/);
    expect(b).toMatch(/allow read: if isSignedIn\(\);/);
  });

  test('comment reactions read is scoped to the reactor/admin', () => {
    const b = block(rules, 'match /comments/{commentId}');
    const start = b.indexOf('match /reactions/{reactorId}');
    expect(start).toBeGreaterThan(-1);
    const rb = b.slice(start, start + 400);
    expect(rb).not.toMatch(/allow read: if true;/);
    expect(rb).toMatch(/allow read: if isSignedIn\(\) && \(reactorId == uid\(\) \|\| isAdmin\(\)\)/);
  });

  test('comment edit history read is scoped to the comment author/admin', () => {
    const b = block(rules, 'match /comments/{commentId}');
    const start = b.indexOf('match /history/{historyId}');
    expect(start).toBeGreaterThan(-1);
    const hb = b.slice(start, start + 500);
    expect(hb).not.toMatch(/allow read: if true;/);
    expect(hb).toMatch(/documents\/comments\/\$\(commentId\)\)\.data\.userId == uid\(\)/);
  });

  test('story reactions/comments reads carry the parent Vibe gate', () => {
    const b = block(rules, 'match /stories/{storyId}');
    for (const marker of ['match /reactions/{reactorId}', 'match /comments/{commentId}']) {
      const start = b.indexOf(marker);
      expect(start).toBeGreaterThan(-1);
      const sb = b.slice(start, start + 700);
      expect(sb).not.toMatch(/allow read: if true;/);
      expect(sb).toMatch(/allow read: if isSignedIn\(\)/);
      expect(sb).toMatch(/vibeIsActive\(vibeData\(\)\)/);
      expect(sb).toMatch(/vibeVisibleToViewer\(vibeData\(\), uid\(\)\)/);
      expect(sb).toMatch(/vibeNotBlocked\(vibeData\(\), uid\(\)\)/);
    }
  });

  test('highlights read requires sign-in', () => {
    const b = block(rules, 'match /highlights/{highlightId}');
    expect(b).not.toMatch(/allow read: if true;/);
    expect(b).toMatch(/allow read: if isSignedIn\(\);/);
  });

  test('events read requires sign-in (privacy enforcement is N266-blocked)', () => {
    const b = block(rules, 'match /events/{eventId}');
    expect(b).not.toMatch(/allow read: if true;/);
    expect(b).toMatch(/allow read: if isSignedIn\(\);/);
    // The privacy-gated variant is deliberately deferred: the list queries
    // cannot prove a `privacy` predicate (rules are not filters). See N266.
    const start = rules.indexOf('match /events/{eventId}');
    expect(rules.slice(Math.max(0, start - 600), start)).toMatch(/N266/);
  });

  test('advanced creator suite collections require sign-in', () => {
    for (const marker of [
      'match /spaces/{spaceId}',
      'match /sounds/{soundId}',
      'match /marketplace_items/{itemId}',
      'match /copyright_registry/{workId}',
    ]) {
      const b = block(rules, marker);
      expect(b).not.toMatch(/allow read: if true;/);
      expect(b).toMatch(/allow read: if isSignedIn\(\);/);
    }
  });

  test('no `allow read: if true` rule remains anywhere in the ruleset', () => {
    const code = rules.split('\n').filter((l) => !l.trim().startsWith('//')).join('\n');
    expect(code).not.toMatch(/allow read: if true;/);
  });
});

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

describe('read-scope privacy (emulator)', () => {
  let reachable = false;

  beforeAll(async () => {
    reachable = await emulatorReachable();
    if (!reachable) {
      console.warn(`[readScopePrivacyRules] emulator not reachable at ${emulatorHost}; skipping adversarial checks`);
    }
  });

  async function makeEnv(projectId) {
    const { initializeTestEnvironment } = await import('@firebase/rules-unit-testing');
    return initializeTestEnvironment({
      projectId,
      firestore: { rules: readFile('firestore.rules'), host: emulatorHost.split(':')[0], port: Number(emulatorHost.split(':')[1]) },
    });
  }

  test('anonymous clients cannot read comments, events, highlights or spaces', async () => {
    if (!reachable) return;
    const { assertFails, assertSucceeds } = await import('@firebase/rules-unit-testing');
    const { doc, setDoc, getDoc } = await import('firebase/firestore');
    const env = await makeEnv('arvdoul-read-scope-anon');
    try {
      await env.clearFirestore();
      await env.withSecurityRulesDisabled(async (ctx) => {
        const db = ctx.firestore();
        await setDoc(doc(db, 'comments/c1'), { userId: 'alice', postId: 'p1', content: 'hi' });
        await setDoc(doc(db, 'events/e1'), { organizerId: 'alice', privacy: 'public', title: 'x' });
        await setDoc(doc(db, 'highlights/h1'), { userId: 'alice' });
        await setDoc(doc(db, 'spaces/s1'), { hostId: 'alice' });
      });
      const anon = env.unauthenticatedContext().firestore();
      const alice = env.authenticatedContext('alice').firestore();

      await assertFails(getDoc(doc(anon, 'comments/c1')));
      await assertSucceeds(getDoc(doc(alice, 'comments/c1')));

      await assertFails(getDoc(doc(anon, 'events/e1')));
      await assertSucceeds(getDoc(doc(alice, 'events/e1')));

      await assertFails(getDoc(doc(anon, 'highlights/h1')));
      await assertSucceeds(getDoc(doc(alice, 'highlights/h1')));

      await assertFails(getDoc(doc(anon, 'spaces/s1')));
      await assertSucceeds(getDoc(doc(alice, 'spaces/s1')));
    } finally {
      await env.cleanup();
    }
  });

  test('events are readable by signed-in clients only', async () => {
    if (!reachable) return;
    const { assertFails, assertSucceeds } = await import('@firebase/rules-unit-testing');
    const { doc, setDoc, getDoc } = await import('firebase/firestore');
    const env = await makeEnv('arvdoul-read-scope-events');
    try {
      await env.clearFirestore();
      await env.withSecurityRulesDisabled(async (ctx) => {
        const db = ctx.firestore();
        await setDoc(doc(db, 'events/e1'), { organizerId: 'alice', privacy: 'public' });
      });
      const anon = env.unauthenticatedContext().firestore();
      const stranger = env.authenticatedContext('stranger').firestore();

      await assertFails(getDoc(doc(anon, 'events/e1')));
      await assertSucceeds(getDoc(doc(stranger, 'events/e1')));
    } finally {
      await env.cleanup();
    }
  });

  test('comment edit history is author/admin only', async () => {
    if (!reachable) return;
    const { assertFails, assertSucceeds } = await import('@firebase/rules-unit-testing');
    const { doc, setDoc, getDoc } = await import('firebase/firestore');
    const env = await makeEnv('arvdoul-read-scope-history');
    try {
      await env.clearFirestore();
      await env.withSecurityRulesDisabled(async (ctx) => {
        const db = ctx.firestore();
        await setDoc(doc(db, 'comments/c1'), { userId: 'alice', postId: 'p1', content: 'hi' });
        await setDoc(doc(db, 'comments/c1/history/h1'), { editedBy: 'alice', previousContent: 'old' });
      });
      const alice = env.authenticatedContext('alice').firestore();
      const bob = env.authenticatedContext('bob').firestore();

      await assertSucceeds(getDoc(doc(alice, 'comments/c1/history/h1')));
      await assertFails(getDoc(doc(bob, 'comments/c1/history/h1')));
    } finally {
      await env.cleanup();
    }
  });
});

