/**
 * src/__tests__/firestoreRulesCompile.test.js
 *
 * firestore.rules is the real authorization boundary for every client read and
 * write, but nothing verified that it COMPILES. It did not: a `match` path
 * segment cannot mix a wildcard with literal text, and
 * `match /messages_{year}_{month}/{messageId}` (the supergroup shard layout)
 * made the whole ruleset invalid, so `firebase deploy` rejected it and the
 * previous rules stayed live. These tests fail on that class of error without
 * needing the emulator, and run full adversarial checks when one is available.
 *
 * @jest-environment node
 */

import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const rulesPath = path.join(root, 'firestore.rules');
const rules = fs.readFileSync(rulesPath, 'utf8');

const emulatorHost = process.env.FIRESTORE_EMULATOR_HOST;

async function emulatorReachable() {
  if (!emulatorHost) return false;
  try {
    const res = await fetch(`http://${emulatorHost}/`);
    const serverHeader = res.headers.get('server') || '';
    if (serverHeader.toLowerCase().includes('nginx')) return false;
    return true;
  } catch {
    return false;
  }
}

describe('firestore.rules syntax', () => {
  test('no match path segment mixes a wildcard with literal text', () => {
    // Firestore compiles each path segment as either `{var}`, `{var=**}` or a
    // literal. `messages_{year}_{month}` is neither, and its presence makes the
    // entire ruleset fail to compile — a full-deploy failure, not a warning.
    const offenders = [];
    for (const m of rules.matchAll(/^\s*match\s+(\S+)\s*\{/gm)) {
      for (const segment of m[1].split('/')) {
        const isWildcard = /^\{[A-Za-z_][A-Za-z0-9_]*(=\*\*)?\}$/.test(segment);
        if (segment.includes('{') && !isWildcard) {
          offenders.push(`${m[1]} (segment "${segment}")`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  test('the supergroup message shard layout is matched via a validated wildcard', () => {
    // The monthly shard collections must still be covered (deny-by-default
    // would silently break supergroup messaging), but through a single
    // wildcard segment plus an explicit name check.
    expect(rules).toContain('isMessageShardCollection');
    expect(rules).toMatch(/match\s+\/\{messageShardCollection\}\/\{messageId\}/);
    expect(rules).toContain("collection.matches('messages_[0-9]{4}_[0-9]{2}')");
  });
});

// A match block's body, so privacy invariants can be asserted without an
// emulator. Starts at the brace that ends the `match /name/... {` line (the
// path itself may contain a `{var}` segment) and brace-counts to its match.
function blockBody(name) {
  const start = rules.search(new RegExp(`match\\s+/${name}/`));
  if (start === -1) return null;
  const lineEnd = rules.indexOf('\n', start);
  const open = rules.lastIndexOf('{', lineEnd === -1 ? rules.length : lineEnd);
  let depth = 0;
  for (let i = open; i < rules.length; i++) {
    if (rules[i] === '{') depth++;
    else if (rules[i] === '}') {
      depth--;
      if (depth === 0) return rules.slice(open, i + 1);
    }
  }
  return null;
}

describe('firestore.rules privacy invariants (regression guards)', () => {
  test('last_messages is readable only by conversation participants', () => {
    const body = blockBody('last_messages');
    expect(body).toBeTruthy();
    // The old `allow read: if isSignedIn();` leaked every private DM preview.
    expect(body).toMatch(/allow read: if isSignedIn\(\) && uid\(\) in[\s\S]*participants/);
    expect(body).not.toMatch(/allow read: if isSignedIn\(\);/);
  });

  test('saved_sounds is owner-scoped on read', () => {
    const body = blockBody('saved_sounds');
    expect(body).toBeTruthy();
    expect(body).toMatch(/allow read: if isSignedIn\(\) && resource\.data\.userId == uid\(\)/);
  });

  test('poll_votes is server-only (no voter enumeration)', () => {
    const body = blockBody('poll_votes');
    expect(body).toBeTruthy();
    expect(body).toMatch(/allow read, write: if false/);
  });

  test('incidents is scoped to the reporter', () => {
    const body = blockBody('incidents');
    expect(body).toBeTruthy();
    expect(body).toMatch(/allow read: if isSignedIn\(\) && \(resource\.data\.reporterId == uid\(\)/);
  });

  test('audit_logs cannot be client-created', () => {
    const body = blockBody('audit_logs');
    expect(body).toBeTruthy();
    expect(body).toMatch(/allow create: if false/);
  });
});

describe('firestore.rules adversarial checks (emulator)', () => {
  let reachable = false;
  beforeAll(async () => { reachable = await emulatorReachable(); });

  test('rules compile and enforce the profile-analytics boundary', async () => {
    if (!reachable) {
      console.warn(`[firestoreRulesCompile] emulator not reachable at ${emulatorHost}; skipping live checks`);
      return;
    }
    const { initializeTestEnvironment, assertFails, assertSucceeds } = await import('@firebase/rules-unit-testing');
    const { doc, setDoc, getDoc } = await import('firebase/firestore');

    const env = await initializeTestEnvironment({
      projectId: 'arvdoul-rules-test',
      firestore: { rules, host: emulatorHost.split(':')[0], port: Number(emulatorHost.split(':')[1]) },
    });
    try {
      const alice = env.authenticatedContext('alice');
      const bob = env.authenticatedContext('bob');

      // Server-authoritative analytics: no client writes (audit N010/N019).
      await assertFails(setDoc(doc(alice.firestore(), 'profile_analytics/bob'), { totalViews: 999 }));
      await assertFails(setDoc(doc(alice.firestore(), 'profile_views/x'), { profileOwnerId: 'bob' }));
      await assertFails(getDoc(doc(bob.firestore(), 'profile_analytics/alice')));
      // Sharded counters accept only a single `value` field.
      await assertSucceeds(setDoc(doc(alice.firestore(), 'counter_shards/a__totalViews__1'), { value: 1 }));
      await assertFails(setDoc(doc(alice.firestore(), 'counter_shards/a__totalViews__2'), { value: 1, evil: 2 }));
    } finally {
      await env.cleanup();
    }
  });

  test('private collections deny the wrong viewer (N020-N024)', async () => {
    if (!reachable) {
      console.warn(`[firestoreRulesCompile] emulator not reachable at ${emulatorHost}; skipping live checks`);
      return;
    }
    const { initializeTestEnvironment, assertFails, assertSucceeds } = await import('@firebase/rules-unit-testing');
    const { doc, setDoc, getDoc } = await import('firebase/firestore');

    const env = await initializeTestEnvironment({
      projectId: 'arvdoul-rules-test',
      firestore: { rules, host: emulatorHost.split(':')[0], port: Number(emulatorHost.split(':')[1]) },
    });
    try {
      // Seed the participant list and the owner-scoped docs with rules off.
      await env.withSecurityRulesDisabled(async (ctx) => {
        const db = ctx.firestore();
        await setDoc(doc(db, 'conversations/c1'), { participants: ['alice', 'bob'] });
        await setDoc(doc(db, 'last_messages/c1'), { text: 'private', senderId: 'bob' });
        await setDoc(doc(db, 'saved_sounds/alice_s1'), { userId: 'alice', soundId: 's1' });
        await setDoc(doc(db, 'incidents/i1'), { reporterId: 'alice', description: 'x' });
      });

      const alice = env.authenticatedContext('alice').firestore();
      const bob = env.authenticatedContext('bob').firestore();
      const carol = env.authenticatedContext('carol').firestore();

      // N020 — last_messages: participant reads, outsider cannot (was world-readable).
      await assertSucceeds(getDoc(doc(alice, 'last_messages/c1')));
      await assertSucceeds(getDoc(doc(bob, 'last_messages/c1')));
      await assertFails(getDoc(doc(carol, 'last_messages/c1')));

      // N021 — saved_sounds: owner reads, others cannot.
      await assertSucceeds(getDoc(doc(alice, 'saved_sounds/alice_s1')));
      await assertFails(getDoc(doc(bob, 'saved_sounds/alice_s1')));

      // N022 — poll_votes is server-only: no client read or write at all.
      await assertFails(getDoc(doc(alice, 'poll_votes/alice_p1')));
      await assertFails(setDoc(doc(alice, 'poll_votes/alice_p1'), { userId: 'alice', pollId: 'p1' }));

      // N023 — incidents: reporter reads their own, others cannot.
      await assertSucceeds(getDoc(doc(alice, 'incidents/i1')));
      await assertFails(getDoc(doc(bob, 'incidents/i1')));

      // N024 — audit_logs: no client create/update/delete, non-admin cannot read.
      await assertFails(setDoc(doc(alice, 'audit_logs/l1'), { action: 'forged', userId: 'alice' }));
      await assertFails(getDoc(doc(alice, 'audit_logs/l1')));
      await assertFails(setDoc(doc(alice, 'audit_logs/l1'), { action: 'tamper' }));
    } finally {
      await env.cleanup();
    }
  });
});
