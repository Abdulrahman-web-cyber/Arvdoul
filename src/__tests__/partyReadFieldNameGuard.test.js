/**
 * Party-scoped read rules must key on fields the server actually writes.
 *
 * A read rule like `resource.data.fromUserId == uid()` is only ever true if some
 * writer sets `fromUserId`. When the writer and the rule disagree on the field
 * name (the `gift_transactions` writer stamps `senderId`/`receiverId`, but the
 * rule keyed on `fromUserId`/`toUserId`) the owner read is denied for everyone
 * and the data is unreadable — the "field name no writer sets" bug class that
 * `scheduled_messages` (`senderId` vs `userId`) and `video_reports`
 * (`reporterId` vs `reportedBy`) each hit before.
 *
 * This guard extracts, for a curated set of party-scoped collections, the field
 * names the Cloud Functions write and the field names the rule compares to
 * `uid()`, and fails when the rule references a field no writer sets.
 *
 * @jest-environment node
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const rules = fs.readFileSync(path.join(root, 'firestore.rules'), 'utf8');

function readAll(dir) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (['node_modules', '__tests__', 'dist', 'build', '.git'].includes(e.name)) continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...readAll(full));
    else if (/\.(js|jsx|cjs)$/.test(e.name)) out.push(full);
  }
  return out;
}

const SOURCE_FILES = [
  ...readAll(path.join(root, 'functions')),
  ...readAll(path.join(root, 'src')),
];

// Every write call, from either the Admin SDK (functions) or the client SDK (src).
const WRITE_CALL = /\.(?:set|add|update|setDoc|addDoc|updateDoc)\s*\(/g;

/** Given the index of a `{`, return the index just past its matching `}`. */
function matchBrace(src, openIdx) {
  let depth = 0;
  for (let i = openIdx; i < src.length; i += 1) {
    if (src[i] === '{') depth += 1;
    else if (src[i] === '}') {
      depth -= 1;
      if (depth === 0) return i + 1;
    }
  }
  return src.length;
}

/**
 * Depth-1 keys of an object-literal body. Tracks a key/value state machine so
 * nested objects and arrays in a value never leak their inner keys, and records
 * both `k: v` and shorthand `{ k, ... }`.
 */
function objectKeys(body) {
  const keys = new Set();
  let i = 0;
  let depth = 0;
  let state = 'key';
  let token = '';
  const flush = () => {
    if (state === 'key' && token) keys.add(token);
    token = '';
  };
  while (i < body.length) {
    const c = body[i];
    if (c === '{' || c === '[') {
      depth += 1;
      i += 1;
      continue;
    }
    if (c === '}' || c === ']') {
      depth -= 1;
      if (depth === 0) {
        flush();
        break;
      }
      i += 1;
      continue;
    }
    if (depth === 1) {
      if (c === ',') {
        flush();
        state = 'key';
        token = '';
      } else if (state === 'key') {
        if (/[A-Za-z_$]/.test(c) || (token && /[0-9]/.test(c))) token += c;
        else if (c === ':') {
          flush();
          state = 'value';
        }
      }
    }
    i += 1;
  }
  return keys;
}

/** Field names written on documents in `collection(name)`, across all writers. */
function writerFields(collection) {
  const fields = new Set();
  for (const file of SOURCE_FILES) {
    const src = fs.readFileSync(file, 'utf8');
    // Only scan files that touch this collection (keeps the brace walk cheap).
    if (!src.includes(`'${collection}'`) && !src.includes(`"${collection}"`)) continue;
    WRITE_CALL.lastIndex = 0;
    let m;
    while ((m = WRITE_CALL.exec(src))) {
      const braceIdx = src.indexOf('{', m.index + m[0].length);
      if (braceIdx === -1) continue;
      const end = matchBrace(src, braceIdx);
      for (const k of objectKeys(src.slice(braceIdx, end))) fields.add(k);
    }
  }
  return fields;
}

/** Field names a collection's rule block compares to uid(). */
function ruleUidFields(collection) {
  const start = rules.indexOf(`match /${collection}/{`);
  if (start === -1) return null;
  const nextMatch = rules.indexOf('match /', start + 10);
  const block = rules.slice(start, nextMatch === -1 ? undefined : nextMatch);
  const fields = new Set();
  for (const m of block.matchAll(/resource\.data(?:\.get\(['"]([\w]+)['"]\)|\.([\w]+))\s*==\s*uid\(\)/g)) {
    fields.add(m[1] || m[2]);
  }
  return fields;
}

// Collections whose read rules gate on a party field written by the server.
const COLLECTIONS = [
  'coin_transactions',
  'gift_transactions',
  'live_gifts',
  'live_tips',
  'shares',
  'scheduled_messages',
  'withdrawal_requests',
  'ad_impressions',
  'profile_views',
];

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

describe('party-scoped read rules reference writer-set fields', () => {
  beforeAll(async () => {
    if (await emulatorReachable()) fsMod = await import('firebase/firestore');
  });

  test('the writer-field extractor understands shorthand and nested objects', () => {
    const sample = `t.set(collection('widgets').doc(id), {
      userId, amount: 5, meta: { nested: 1 }, 'quoted': true,
    });`;
    const fields = new Set();
    const m = /\.(?:set|add|update|setDoc|addDoc|updateDoc)\s*\(/.exec(sample);
    const braceIdx = sample.indexOf('{', m.index + m[0].length);
    const end = matchBrace(sample, braceIdx);
    for (const k of objectKeys(sample.slice(braceIdx, end))) fields.add(k);
    expect([...fields].sort()).toEqual(['amount', 'meta', 'quoted', 'userId']);
  });

  test.each(COLLECTIONS)('%s: every uid() field in the rule is written by a real writer', (collection) => {
    const ruleFields = ruleUidFields(collection);
    expect(ruleFields).not.toBeNull();
    if (ruleFields.size === 0) return; // rule does not gate on a party field
    const written = writerFields(collection);
    const missing = [...ruleFields].filter((f) => !written.has(f));
    expect({ collection, missing }).toEqual({ collection, missing: [] });
  });

  test('the gift_transactions read rule keys on the writer fields (regression pin)', () => {
    const block = rules.slice(
      rules.indexOf('match /gift_transactions/{'),
      rules.indexOf('match /ads/{'),
    );
    expect(block).toContain('resource.data.senderId == uid()');
    expect(block).toContain('resource.data.receiverId == uid()');
    expect(block).not.toContain('resource.data.fromUserId');
  });

  test('a gift party can read their own row, a stranger cannot (emulator)', async () => {
    if (!fsMod) return;
    const env = await makeEnv('arvdoul-gift-tx-read');
    try {
      await env.clearFirestore();
      await env.withSecurityRulesDisabled(async (ctx) => {
        await fsMod.setDoc(fsMod.doc(ctx.firestore(), 'gift_transactions/g1'), {
          senderId: 'alice', receiverId: 'bob', postId: 'p1', giftType: 'rose', value: 5,
        });
      });
      const alice = env.authenticatedContext('alice').firestore();
      const bob = env.authenticatedContext('bob').firestore();
      const carol = env.authenticatedContext('carol').firestore();

      await expect(fsMod.getDoc(fsMod.doc(alice, 'gift_transactions/g1'))).resolves.toBeDefined();
      await expect(fsMod.getDoc(fsMod.doc(bob, 'gift_transactions/g1'))).resolves.toBeDefined();
      await expect(fsMod.getDoc(fsMod.doc(carol, 'gift_transactions/g1'))).rejects.toBeDefined();
      await expect(
        fsMod.getDoc(fsMod.doc(env.unauthenticatedContext().firestore(), 'gift_transactions/g1')),
      ).rejects.toBeDefined();
    } finally {
      await env.cleanup();
    }
  });
});
