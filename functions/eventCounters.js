'use strict';

// Community `stats.eventCount` trigger (N434).
//
// `communities/{communityId}.stats.eventCount` is seeded `0` when the community
// is created (functions/communities.js `createCommunity`) and was never written
// again, so the community detail screen's "Events" card
// (CommunityDetailScreen.jsx) always rendered a fabricated `0` — the same
// "counter with no writer" class as the follower counters (N431) and the post
// engagement counters (N433).
//
// Events carry a `communityId` (client `eventService.createEvent`), but the
// event document is written client-side (the rules key the create on
// `organizerId`), so the community's aggregate counter must be derived
// server-side here.
//
// The counter tracks *live* events only: a `draft` or `cancelled` event does
// not count, publishing one does, and a delete (or a move to another community)
// decrements the previous community — so the number never drifts. A delta is
// applied only for a community that exists and that the organizer belongs to,
// so a user cannot point an event at a foreign community to inflate its counter
// (the counter-forgery class).

const functions = require('firebase-functions');
const admin = require('firebase-admin');

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();
const FieldValue = admin.firestore.FieldValue;

// A community's Events card counts events a member can see and join — not
// drafts, not cancelled events. `ended` is kept (a finished event is still part
// of the community's history).
const COUNTED_EVENT_STATUSES = ['published', 'open', 'live', 'ended'];

function counts(event) {
  if (!event) return false;
  return COUNTED_EVENT_STATUSES.includes(event.status);
}

function communityIdOf(event) {
  if (!event) return null;
  return typeof event.communityId === 'string' && event.communityId ? event.communityId : null;
}

exports.onEventWrite = functions.firestore
  .document('events/{eventId}')
  .onWrite(async (change) => {
    const before = change.before.exists ? change.before.data() : null;
    const after = change.after.exists ? change.after.data() : null;

    // Net delta per community: -1 if it counted before, +1 if it counts after.
    // A write that only touches `stats.attendeeCount` (registration, check-in)
    // leaves status and communityId unchanged, so the deltas cancel to zero and
    // no community is read or written.
    const deltas = new Map();
    const bump = (communityId, delta) => {
      if (!communityId || delta === 0) return;
      deltas.set(communityId, (deltas.get(communityId) || 0) + delta);
    };
    if (counts(before)) bump(communityIdOf(before), -1);
    if (counts(after)) bump(communityIdOf(after), +1);

    if (deltas.size === 0) return;

    const organizerId = (after && after.organizerId) || (before && before.organizerId) || null;

    const refs = [...deltas.keys()].map((id) => db.collection('communities').doc(id));
    const snaps = await db.getAll(...refs);

    const batch = db.batch();
    let writes = 0;
    for (const snap of snaps) {
      if (!snap.exists) continue;
      // Only a member's event counts toward the community (forgery guard).
      if (organizerId && !((snap.data().members || {})[organizerId])) continue;
      const delta = deltas.get(snap.id);
      if (!delta) continue;
      batch.update(snap.ref, {
        'stats.eventCount': FieldValue.increment(delta),
        updatedAt: FieldValue.serverTimestamp(),
      });
      writes += 1;
    }
    if (writes > 0) await batch.commit();
  });
