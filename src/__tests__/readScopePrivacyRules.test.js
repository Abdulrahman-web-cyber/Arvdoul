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
 *  - `events/{id}` (title, schedule, ticket tiers, organizer coordinates)
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

  test('comment like/dislike markers are readable only by their owner/admin', () => {
    const b = block(rules, 'match /comments/{commentId}');
    // The marker doc id is the liker's uid; the tallies live on the comment doc,
    // so a world/signed-in read would expose who liked/disliked each comment.
    for (const [marker, varName] of [
      ['match /likes/{likerId}', 'likerId'],
      ['match /dislikes/{dislikerId}', 'dislikerId'],
    ]) {
      const start = b.indexOf(marker);
      expect(start).toBeGreaterThan(-1);
      const mb = b.slice(start, start + 300);
      expect(mb).not.toMatch(/allow read: if isSignedIn\(\);\n/);
      expect(mb).toMatch(new RegExp(`allow read: if isSignedIn\\(\\) && \\(${varName} == uid\\(\\) \\|\\| isAdmin\\(\\)\\)`));
    }
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

  test('events read is status/relationship-gated (N266)', () => {
    const b = block(rules, 'match /events/{eventId}');
    expect(b).not.toMatch(/allow read: if true;/);
    // The event document read itself is gated (the nested subcollection read is
    // a separate rule and still requires sign-in).
    expect(b).toMatch(/allow read: if isSignedIn\(\) && \(/);
    expect(b).toMatch(/resource\.data\.status in \['published', 'open', 'live', 'ended'\]/);
    expect(b).toMatch(/resource\.data\.organizerId == uid\(\)/);
    expect(b).toMatch(/resource\.data\.attendees\[uid\(\)\] != null/);
    // The former `privacy` field was a dead control (written, never read, never
    // enforced) and is gone; the rule documents that. See N266.
    const start = rules.indexOf('match /events/{eventId}');
    expect(rules.slice(Math.max(0, start - 600), start)).toMatch(/N266/);
    const svc = readFile('src/services/eventService.js');
    expect(svc).not.toMatch(/privacy:\s*data\.privacy/);
    expect(svc).not.toMatch(/['"]privacy['"]/);
  });

  test('advanced creator suite collections require sign-in', () => {
    for (const marker of [
      'match /spaces/{spaceId}',
      'match /sounds/{soundId}',
      'match /marketplace_items/{itemId}',
    ]) {
      const b = block(rules, marker);
      expect(b).not.toMatch(/allow read: if true;/);
      expect(b).toMatch(/allow read: if isSignedIn\(\);/);
    }
    // `copyright_registry` has no client reader, so the read is scoped to the
    // registrant (or an admin) rather than any signed-in client.
    const copyright = block(rules, 'match /copyright_registry/{workId}');
    expect(copyright).not.toMatch(/allow read: if true;/);
    expect(copyright).not.toMatch(/allow read: if isSignedIn\(\);/);
    expect(copyright).toMatch(/allow read: if isSignedIn\(\) &&/);
    expect(copyright).toMatch(/resource\.data\.registeredBy == uid\(\)/);
  });

  test('no `allow read: if true` rule remains anywhere in the ruleset', () => {
    const code = rules.split('\n').filter((l) => !l.trim().startsWith('//')).join('\n');
    expect(code).not.toMatch(/allow read: if true;/);
  });

  test('the username registry is point-read only, never listable (N472)', () => {
    // `allow read` grants `get` AND `list`; the registry is only ever point-read
    // (share/QR resolution, availability check), so a listable grant let any
    // signed-in client enumerate every claimed handle over the REST API.
    for (const marker of ['match /usernames/{username}', 'match /previous_usernames/{username}']) {
      const b = block(rules, marker);
      expect(b).toContain('allow get: if isSignedIn();');
      expect(b).toContain('allow list: if false;');
      expect(b).not.toMatch(/allow read:\s*if isSignedIn\(\);/);
    }
  });

  test('counter shards are point-read only, never listable (N483)', () => {
    // CountersManager resolves a shard with `getAll(...)` on computed doc refs —
    // no client queries this collection. A bare `allow read` also granted
    // `list`, exposing the whole platform's engagement map to any signed-in
    // client.
    const b = block(rules, 'match /counter_shards/{shardId}');
    expect(b).toContain('allow get: if isSignedIn();');
    expect(b).toContain('allow list: if false;');
    expect(b).not.toMatch(/allow read:\s*if isSignedIn\(\);/);
  });

  test('achievements/titles reads honour the section privacy scope', () => {
    for (const [marker, section] of [
      ['match /achievements/{userId}', 'achievements'],
      ['match /titles/{userId}', 'titles'],
    ]) {
      const b = block(rules, marker);
      // A bare `isSignedIn()` read let any signed-in client read another user's
      // earned badges/titles even with the scope set to ONLY_ME/FOLLOWERS.
      expect(b).not.toMatch(/allow read: if isSignedIn\(\);/);
      expect(b).toMatch(new RegExp(`allow read: if profileSectionReadable\\(userId, '${section}', 'EVERYONE'\\);`));
    }
    // The helper must actually resolve the scope, not just the relation.
    expect(rules).toMatch(/function profileSectionReadable\(userId, section, defaultScope\)/);
    expect(rules).toMatch(/\.get\('privacy', \{\}\)\.get\(section, defaultScope\)/);
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
        await setDoc(doc(db, 'events/e1'), { organizerId: 'alice', title: 'x' });
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

  test('a draft event is readable only by its organizer or an attendee (N266)', async () => {
    if (!reachable) return;
    const { assertFails, assertSucceeds } = await import('@firebase/rules-unit-testing');
    const { doc, setDoc, getDoc } = await import('firebase/firestore');
    const env = await makeEnv('arvdoul-read-scope-events');
    try {
      await env.clearFirestore();
      await env.withSecurityRulesDisabled(async (ctx) => {
        const db = ctx.firestore();
        await setDoc(doc(db, 'events/draft1'), {
          organizerId: 'alice', status: 'draft', attendees: { bob: { status: 'registered' } },
        });
        await setDoc(doc(db, 'events/live1'), { organizerId: 'alice', status: 'published' });
      });
      const anon = env.unauthenticatedContext().firestore();
      const alice = env.authenticatedContext('alice').firestore();
      const bob = env.authenticatedContext('bob').firestore();
      const stranger = env.authenticatedContext('stranger').firestore();

      // Unauthenticated is denied everywhere.
      await assertFails(getDoc(doc(anon, 'events/draft1')));
      await assertFails(getDoc(doc(anon, 'events/live1')));
      // A published event is readable by any signed-in client.
      await assertSucceeds(getDoc(doc(stranger, 'events/live1')));
      // A draft is readable by the organizer and an attendee, but NOT a stranger.
      await assertSucceeds(getDoc(doc(alice, 'events/draft1')));
      await assertSucceeds(getDoc(doc(bob, 'events/draft1')));
      await assertFails(getDoc(doc(stranger, 'events/draft1')));
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

  test('achievements/titles are gated by the section privacy scope', async () => {
    if (!reachable) return;
    const { assertFails, assertSucceeds } = await import('@firebase/rules-unit-testing');
    const { doc, setDoc, getDoc } = await import('firebase/firestore');
    const env = await makeEnv('arvdoul-read-scope-achievements');
    try {
      await env.clearFirestore();
      await env.withSecurityRulesDisabled(async (ctx) => {
        const db = ctx.firestore();
        // alice hides her badges/titles; carol leaves them public.
        await setDoc(doc(db, 'users/alice'), {
          isPrivate: false,
          privacy: { achievements: 'ONLY_ME', titles: 'ONLY_ME' },
        });
        await setDoc(doc(db, 'users/carol'), {
          isPrivate: false,
          privacy: { achievements: 'EVERYONE', titles: 'EVERYONE' },
        });
        await setDoc(doc(db, 'achievements/alice/items/a1'), { id: 'a1', title: 'Pioneer' });
        await setDoc(doc(db, 'titles/alice/items/t1'), { id: 't1', name: 'Duke' });
        await setDoc(doc(db, 'achievements/carol/items/a1'), { id: 'a1', title: 'Pioneer' });
      });
      const alice = env.authenticatedContext('alice').firestore();
      const bob = env.authenticatedContext('bob').firestore();

      // The owner always reads their own badges/titles.
      await assertSucceeds(getDoc(doc(alice, 'achievements/alice/items/a1')));
      await assertSucceeds(getDoc(doc(alice, 'titles/alice/items/t1')));
      // A stranger may not read a scope set to ONLY_ME.
      await assertFails(getDoc(doc(bob, 'achievements/alice/items/a1')));
      await assertFails(getDoc(doc(bob, 'titles/alice/items/t1')));
      // A scope left at EVERYONE stays readable.
      await assertSucceeds(getDoc(doc(bob, 'achievements/carol/items/a1')));
    } finally {
      await env.cleanup();
    }
  });
});

