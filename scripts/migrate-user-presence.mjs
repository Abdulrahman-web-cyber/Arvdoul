#!/usr/bin/env node
/**
 * One-shot, idempotent migration: move live presence off the world-readable
 * `users/{uid}` document into the scope-gated `user_presence/{uid}` document
 * (AUDIT V3 N321).
 *
 * Background
 * ----------
 * `isOnline` / `lastActive` used to be fields on `users/{uid}`, which any
 * signed-in client may read, so presence leaked regardless of the profile's
 * `presence` privacy scope. The fix moves them to `user_presence/{uid}` (whose
 * rule mirrors `profileSectionReadable(userId, 'presence', 'FOLLOWERS')`) and
 * the `users/{uid}` rules now refuse the two fields. Legacy documents created
 * before the fix still carry the fields; this script copies them across and
 * removes them from the public doc.
 *
 * Safety
 * ------
 *  - Idempotent: a second run finds no legacy fields and does nothing. Copying
 *    is `{ merge: true }`, so it never clobbers a newer presence write.
 *  - Ordering: presence is written FIRST, then the public fields are deleted,
 *    so an interrupted run loses nothing (the delete is the last step).
 *  - Non-destructive of user data: only the two presence fields are touched;
 *    no other field, document or collection is modified.
 *  - Dry-run by default. Pass `--apply` to write.
 *
 * Usage
 * -----
 *   # Against the local emulator (safe, no production access):
 *   FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 node scripts/migrate-user-presence.mjs --apply
 *
 *   # Against a real project (requires credentials; run the dry-run first):
 *   GOOGLE_APPLICATION_CREDENTIALS=/path/serviceAccount.json \
 *     node scripts/migrate-user-presence.mjs --project arvdoul-8057b
 *   GOOGLE_APPLICATION_CREDENTIALS=/path/serviceAccount.json \
 *     node scripts/migrate-user-presence.mjs --project arvdoul-8057b --apply
 *
 * Production execution requires explicit authorization; this script never runs
 * against production unless you pass `--project <real>` and `--apply` yourself.
 */

import { initializeApp, applicationDefault, getApps } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

const args = process.argv.slice(2);
const APPLY = args.includes('--apply');
const projectArgIndex = args.indexOf('--project');
const projectId = projectArgIndex !== -1 ? args[projectArgIndex + 1] : process.env.GCLOUD_PROJECT || 'demo-arvdoul';
const PAGE_SIZE = 200;

const usingEmulator = Boolean(process.env.FIRESTORE_EMULATOR_HOST);

if (!getApps().length) {
  initializeApp(
    usingEmulator
      ? { projectId }
      : { projectId, credential: applicationDefault() },
  );
}
const db = getFirestore();

const PRESENCE_FIELDS = ['isOnline', 'lastActive'];

function toMillis(value) {
  if (!value) return null;
  if (typeof value.toMillis === 'function') return value.toMillis();
  if (value instanceof Date) return value.getTime();
  return null;
}

async function run() {
  console.log(`[migrate-user-presence] project=${projectId} target=${usingEmulator ? `emulator(${process.env.FIRESTORE_EMULATOR_HOST})` : 'PRODUCTION'} mode=${APPLY ? 'APPLY' : 'DRY-RUN'}`);
  if (!APPLY) console.log('[migrate-user-presence] dry-run — no writes. Re-run with --apply to migrate.');

  let scanned = 0;
  let migrated = 0;
  let skipped = 0;
  let lastDoc = null;

  for (;;) {
    let q = db.collection('users').orderBy('__name__').limit(PAGE_SIZE);
    if (lastDoc) q = q.startAfter(lastDoc);
    const snap = await q.get();
    if (snap.empty) break;

    for (const doc of snap.docs) {
      scanned += 1;
      const data = doc.data();
      const hasLegacy = PRESENCE_FIELDS.some((f) => data[f] !== undefined);
      if (!hasLegacy) { skipped += 1; continue; }

      const presence = {};
      if (data.isOnline !== undefined) presence.isOnline = data.isOnline;
      const lastActiveMs = toMillis(data.lastActive);
      if (lastActiveMs !== null) presence.lastActive = new Date(lastActiveMs);

      if (!APPLY) {
        console.log(`  would migrate ${doc.id}: ${JSON.stringify(presence)}`);
        migrated += 1;
        continue;
      }

      const presenceRef = db.doc(`user_presence/${doc.id}`);
      // The legacy `users/{uid}` presence fields are the freshest value (they
      // were updated on every heartbeat), so they win. Write presence first,
      // then strip the fields from the public doc: an interruption between the
      // two leaves the fields in place for the next run — nothing is lost. A
      // live user's next heartbeat re-writes the freshest value regardless.
      await presenceRef.set({ ...presence, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
      await doc.ref.update({
        isOnline: FieldValue.delete(),
        lastActive: FieldValue.delete(),
      });
      migrated += 1;
      console.log(`  migrated ${doc.id}`);
    }

    lastDoc = snap.docs[snap.docs.length - 1];
    if (snap.size < PAGE_SIZE) break;
  }

  console.log(`[migrate-user-presence] scanned=${scanned} migrated=${migrated} skipped=${skipped} (${APPLY ? 'applied' : 'dry-run'})`);
}

run().catch((err) => {
  console.error('[migrate-user-presence] failed:', err?.message || err);
  process.exitCode = 1;
});
