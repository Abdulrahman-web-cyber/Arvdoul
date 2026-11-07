/**
 * src/__tests__/serverOnlyCollectionWriteGuard.test.js
 *
 * Bug class: a client write to a collection whose rules are `allow write: if
 * false` (server-only). Firestore does not reject the call at compile time —
 * the write is simply denied at runtime, the promise rejects, and if the caller
 * catches and swallows (or the feature has no error UI) the action is a silent
 * no-op that still looks implemented. This shipped repeatedly:
 *
 *   - live gifts/tips: the client debited coins, then wrote a `live_gifts` /
 *     `live_tips` row the rules deny — the streamer was never credited and the
 *     coins vanished.
 *   - mentions / event cancellation: the client wrote a top-level
 *     `notifications` doc, which is server-only, so nobody was notified.
 *   - the whole community subsystem: the client wrote `communities/{id}`, whose
 *     rule keyed on an `ownerId` field the client never wrote, so create/join/
 *     moderate all failed silently.
 *
 * The guard derives the server-only collections straight from firestore.rules
 * (so it tracks the rules, not a hand-copied list) and fails if any file under
 * src/ performs a client write against one. Money/economy, notification and
 * moderation collections must never be client-writable; the allowlist below is
 * intentionally empty — route the write through a Cloud Function instead.
 *
 * @jest-environment node
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const rules = fs.readFileSync(path.join(root, 'firestore.rules'), 'utf8');

/**
 * Parses firestore.rules and returns `Map<collection, Set<deniedVerb>>` where a
 * denied verb is one of 'create' | 'update' | 'delete' pinned to `if false` for
 * a client. `allow write: if false` denies all three. A block that only denies
 * `create` (e.g. `notifications`) still matters: `addDoc`/`setDoc` are no-ops
 * there while `updateDoc` (acknowledge) is allowed.
 */
function serverOnlyVerbs(source) {
  const lines = source.split('\n');
  const stack = [];
  const result = new Map();
  let depth = 0;

  const flush = (block) => {
    if (!block.collection) return;
    const verbs = new Set();
    for (const a of block.allows) {
      if (a.cond !== 'false') continue;
      if (/write/.test(a.ops)) { verbs.add('create'); verbs.add('update'); verbs.add('delete'); }
      if (/create/.test(a.ops)) verbs.add('create');
      if (/update/.test(a.ops)) verbs.add('update');
      if (/delete/.test(a.ops)) verbs.add('delete');
    }
    if (verbs.size) {
      const existing = result.get(block.collection) || new Set();
      for (const v of verbs) existing.add(v);
      result.set(block.collection, existing);
    }
  };

  for (const raw of lines) {
    const line = raw.trim();
    // Only a *collection* block — exactly two path segments, the second a
    // wildcard (`match /posts/{postId}`) — gets a collection name. A nested
    // subcollection block (`match /posts/{id}/likes/{lid}`) is unnamed so its
    // allow lines are never attributed to the parent.
    const pathMatch = line.match(/^match\s+(\S+)/);
    if (pathMatch) {
      const segs = pathMatch[1].split('/').filter(Boolean);
      const isCollection = segs.length === 2 && /^\{[^{}]*\}$/.test(segs[1]) && /^[A-Za-z_][A-Za-z0-9_]*$/.test(segs[0]);
      stack.push({ collection: isCollection ? segs[0] : null, depth, allows: [] });
    } else if (stack.length) {
      const allow = line.match(/^allow\s+([a-z, ]+):\s*if\s+(.+?);/);
      if (allow) stack[stack.length - 1].allows.push({ ops: allow[1], cond: allow[2].trim() });
    }
    // Brace bookkeeping. Strip `{wildcard}` path tokens first — they are not
    // block delimiters, and counting them desynchronises the depth.
    const structural = line.replace(/\{[^{}]*\}/g, '');
    depth += (structural.match(/\{/g) || []).length;
    depth -= (structural.match(/\}/g) || []).length;
    while (stack.length && depth <= stack[stack.length - 1].depth) flush(stack.pop());
  }
  return result;
}

const SERVER_ONLY = serverOnlyVerbs(rules);

/** Collections that MUST deny the given client verb; a rules regression fails here. */
const REQUIRED_SERVER_ONLY = [
  ['live_gifts', 'create'], ['live_tips', 'create'], ['gift_transactions', 'create'],
  ['coin_ledger', 'create'], ['notifications', 'create'], ['moderation_logs', 'create'],
  ['profile_views', 'create'], ['profile_analytics', 'create'], ['communities', 'update'],
  ['video_purchases', 'create'], ['collaboration_projects', 'create'],
  ['collaboration_projects', 'update'], ['collaboration_invites', 'create'],
];

function collectSrcFiles(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === '__tests__' || entry.name === 'node_modules') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...collectSrcFiles(full));
    else if (/\.(js|jsx)$/.test(entry.name)) out.push(full);
  }
  return out;
}

/**
 * Finds client writes to a server-only collection in one file. Resolves a
 * single local-variable hop (`const ref = doc(db, 'x', id); updateDoc(ref, …)`).
 */
function findDeniedWrites(file, src) {
  const varToCollection = new Map();
  // Only a 3-argument `doc(db, 'coll', id)` targets a TOP-LEVEL collection.
  // `doc(db, 'users', uid, 'saved_videos', vid)` targets a subcollection, whose
  // own rule (not the parent's) decides the write — attributing it to `users`
  // was a false positive.
  const topDoc = /doc\(\s*[^,()]+,\s*['"]([A-Za-z_][A-Za-z0-9_]*)['"]\s*,\s*[^,()]+\)/g;
  const topColl = /collection\(\s*[^,()]+,\s*['"]([A-Za-z_][A-Za-z0-9_]*)['"]\s*\)/g;
  const refAssign = /(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:doc|collection)\(\s*[^,()]+,\s*['"]([A-Za-z_][A-Za-z0-9_]*)['"][^)]*\)/g;
  for (const m of src.matchAll(refAssign)) {
    const argCount = m[0].slice(m[0].indexOf('(')).split(',').length;
    // doc(): 3 args = top-level collection. collection(): 2 args = top-level.
    if (argCount === 3 || (argCount === 2 && m[0].includes('collection('))) varToCollection.set(m[1], m[2]);
  }

  const offenders = [];
  const lines = src.split('\n');
  const isWriteLine = (line) =>
    /\b(setDoc|addDoc|updateDoc|deleteDoc)\s*\(/.test(line) ||
    /\b[A-Za-z_$][\w$]*\.(?:set|update|delete)\s*\(/.test(line);

  lines.forEach((line, i) => {
    if (!isWriteLine(line)) return;
    const candidates = new Set();
    for (const m of line.matchAll(topDoc)) candidates.add(m[1]);
    for (const m of line.matchAll(topColl)) candidates.add(m[1]);
    // … or a ref variable bound to a top-level collection earlier in the file.
    for (const m of line.matchAll(/\b(?:setDoc|addDoc|updateDoc|deleteDoc|[A-Za-z_$][\w$]*\.(?:set|update|delete))\s*\(\s*([A-Za-z_$][\w$]*)/g)) {
      const coll = varToCollection.get(m[1]);
      if (coll) candidates.add(coll);
    }
    const verb = /\bdeleteDoc\b|\.delete\s*\(/.test(line) ? 'delete'
      : /\bupdateDoc\b|\.update\s*\(/.test(line) ? 'update'
        : 'create';
    for (const coll of candidates) {
      if (SERVER_ONLY.get(coll)?.has(verb)) {
        offenders.push(`${path.relative(root, file)}:${i + 1}  (${coll} ${verb})`);
        break;
      }
    }
  });
  return offenders;
}

describe('client writes to server-only collections', () => {
  test('the rules parser finds the known server-only collections', () => {
    for (const [coll, verb] of REQUIRED_SERVER_ONLY) {
      expect(SERVER_ONLY.get(coll)?.has(verb)).toBe(true);
    }
  });

  test('the scanner detects the historical bug shapes (guard can fail)', () => {
    // If the scanner silently stopped matching, every assertion above would pass
    // vacuously. These are the exact shapes that shipped as silent no-ops.
    const samples = [
      ["setDoc(doc(db, 'live_gifts', id), { coins: 5 });", 'live_gifts'],
      ["addDoc(collection(db, 'gift_transactions'), { coinValue: 5 });", 'gift_transactions'],
      ["await addDoc(collection(firestore, 'notifications'), { userId });", 'notifications'],
      ["const giftsRef = collection(db, 'gift_transactions');\nawait addDoc(giftsRef, {});", 'gift_transactions'],
      ["const ref = doc(db, 'communities', id);\nawait updateDoc(ref, { name: 'x' });", 'communities'],
      ["batch.set(doc(db, 'coin_ledger', id), { amount: 5 });", 'coin_ledger'],
    ];
    for (const [src, coll] of samples) {
      const hits = findDeniedWrites('/virtual/file.js', src);
      expect(hits.some((h) => h.includes(`(${coll}`))).toBe(true);
    }
    // A legitimate subcollection write under a server-only parent is NOT a hit.
    expect(findDeniedWrites('/virtual/file.js', "deleteDoc(doc(db, 'users', uid, 'saved_videos', vid));")).toEqual([]);
  });

  test('no src/ file writes to a collection the rules make server-only', () => {
    const offenders = [];
    for (const file of collectSrcFiles(path.join(root, 'src'))) {
      offenders.push(...findDeniedWrites(file, fs.readFileSync(file, 'utf8')));
    }
    // The allowlist is intentionally empty. A legitimate exception must be
    // justified in the PR that adds it — prefer routing through a callable.
    const ALLOWLIST = [];
    const real = offenders.filter((o) => !ALLOWLIST.some((a) => o.includes(a)));
    expect(real).toEqual([]);
  });

  test('community mutations are server-authoritative (no direct client writes)', () => {
    const service = fs.readFileSync(path.join(root, 'src', 'services', 'communityService.js'), 'utf8');
    expect(service).not.toMatch(/updateDoc\(\s*doc\([^)]*'communities'/);
    expect(service).not.toMatch(/setDoc\(\s*doc\([^)]*'communities'/);
    expect(service).not.toMatch(/setDoc\(\s*doc\([^)]*'moderation_logs'/);
    expect(service).toContain('FUNCTIONS.CREATE_COMMUNITY');
    expect(service).toContain('FUNCTIONS.COMMUNITY_MODERATE');
    expect(service).toContain('FUNCTIONS.JOIN_COMMUNITY');
  });

  test('the community callables are exported server-side', () => {
    const mod = fs.readFileSync(path.join(root, 'functions', 'communities.js'), 'utf8');
    for (const name of [
      'createCommunity', 'updateCommunitySettings', 'deleteCommunity',
      'joinCommunity', 'leaveCommunity', 'requestToJoin',
      'approveJoinRequest', 'rejectJoinRequest', 'assignCommunityRole',
      'updateMemberPermissions', 'addCommunitySpace', 'removeCommunitySpace',
      'communityModerate', 'createCommunityPost', 'getMyCommunities',
    ]) {
      expect(mod).toContain(`exports.${name} =`);
    }
    const index = fs.readFileSync(path.join(root, 'functions', 'index.js'), 'utf8');
    expect(index).toContain("merge(require('./communities.js'))");
  });

  test('the event + collaboration subsystems are server-authoritative', () => {
    const index = fs.readFileSync(path.join(root, 'functions', 'index.js'), 'utf8');
    expect(index).toContain("merge(require('./events.js'))");
    expect(index).toContain("merge(require('./collaboration.js'))");

    // events: organizer-only create/update/delete stays client-side (the rule
    // permits it), but no client code may write the attendee map or its
    // counters — the rule only lets the ORGANIZER update the document, so a
    // direct attendee write was denied and registration silently did nothing.
    const events = fs.readFileSync(path.join(root, 'src', 'services', 'eventService.js'), 'utf8');
    // Computed-property writes (`[`attendees.${uid}`]: …`), not the read query
    // `where(`attendees.${uid}.status`, …)`.
    expect(events).not.toMatch(/\[`attendees\.\$\{/);
    // Writes are `'stats.attendeeCount': increment(…)`; the read is
    // `orderBy('stats.attendeeCount', …)`. Only the write form has the colon.
    expect(events).not.toMatch(/'stats\.attendeeCount':/);
    expect(events).not.toMatch(/'stats\.waitlistCount':/);
    for (const key of ['REGISTER_FOR_EVENT', 'CANCEL_EVENT_REGISTRATION', 'CHECK_IN_EVENT_ATTENDEE', 'SUBMIT_EVENT_FEEDBACK']) {
      expect(events).toContain(`FUNCTIONS.${key}`);
    }

    // collaboration: membership/roles are privilege data, so the client must
    // not write the project document or its team/content subcollections at all.
    const collab = fs.readFileSync(path.join(root, 'src', 'services', 'collaborationService.js'), 'utf8');
    for (const pattern of [/\bsetDoc\(/, /\bupdateDoc\(/, /\bdeleteDoc\(/, /\.batch\(\)/]) {
      expect(collab).not.toMatch(pattern);
    }
    expect(collab).toContain('FUNCTIONS.CREATE_COLLAB_PROJECT');
    expect(collab).toContain('FUNCTIONS.ACCEPT_COLLAB_INVITE');
  });
});
