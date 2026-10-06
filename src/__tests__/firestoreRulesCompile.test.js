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
});
