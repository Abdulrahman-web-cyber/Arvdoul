// functions/events.js — server-authoritative event participation.
//
// `events/{id}` keeps attendees as a MAP keyed by uid:
//   attendees: { [uid]: { status, ticketTier, registeredAt, checkedInAt } }
// plus derived counters (`stats.attendeeCount`, `stats.waitlistCount`).
//
// The rule lets only the organizer update the event document, which is correct
// for settings — but registration, cancellation, check-in and feedback are
// inherently cross-user. Before this module the client wrote the document
// directly for all of them, so the rule denied every one: "Register" did
// nothing (no attendee, no counter), and the feedback path wrote `event_feedback`
// (allowed) then failed to update the average (denied), leaving the score stale.
//
// These callables resolve the caller's identity server-side, apply the attendee
// patch with the Admin SDK (bypassing rules) and keep the counters and the
// waitlist promotion consistent. The organizer-only create/update/delete paths
// stay client-side; their rules already key on `organizerId`.

const admin = require('firebase-admin');
const functions = require('firebase-functions');
const { checkRateLimit } = require('./rateLimit');
const { getUserIdFromContext } = require('./auth');
const { writeAudit } = require('./admin');
const { awardXpSafe } = require('./xpAward');

const db = admin.firestore();
const FieldValue = admin.firestore.FieldValue;

function httpError(code, message) {
  return new functions.https.HttpsError(code, message);
}

function loadEventRef(eventId) {
  if (!eventId || typeof eventId !== 'string') {
    throw httpError('invalid-argument', 'An eventId is required.');
  }
  return db.doc(`events/${eventId}`);
}

async function requireEvent(eventId) {
  const ref = loadEventRef(eventId);
  const snap = await ref.get();
  if (!snap.exists) throw httpError('not-found', 'Event not found.');
  return { ref, data: snap.data() };
}

/** True when the event accepts new registrations. */
function isOpenForRegistration(event) {
  if (event.status === 'draft' || event.status === 'cancelled' || event.status === 'archived') return false;
  if (event.endDate) {
    const end = event.endDate.toDate ? event.endDate.toDate() : new Date(event.endDate);
    if (Number.isFinite(end.getTime()) && end.getTime() < Date.now()) return false;
  }
  return true;
}

/** Promotes the oldest waitlisted attendee to `registered`. Returns the uid. */
async function promoteNextWaitlisted(ref, event) {
  const attendees = event.attendees || {};
  const next = Object.entries(attendees)
    .filter(([, a]) => a && a.status === 'waitlisted')
    .sort((a, b) => (a[1].registeredAt?.seconds || 0) - (b[1].registeredAt?.seconds || 0))[0];
  if (!next) return null;
  const [uid] = next;
  await ref.update({
    [`attendees.${uid}.status`]: 'registered',
    'stats.waitlistCount': FieldValue.increment(-1),
    'stats.attendeeCount': FieldValue.increment(1),
    updatedAt: FieldValue.serverTimestamp(),
  });
  return uid;
}

/**
 * The caller's own event registrations, served server-side.
 *
 * The client list query (`where('attendees.<uid>.status','in',[...])`) cannot
 * prove the `events` read rule's organizer/attendee predicate — rules are not
 * filters — so the read rule had to stay a bare `isSignedIn()` and any
 * signed-in client could read a `draft` event by id (N266). Serving the list
 * here lets the rule gate the read on `organizerId == uid()` / `attendees[uid]`
 * while the caller's own registrations (including drafts they organized or
 * registered for) still resolve.
 */
exports.getUserEventRegistrations = functions.https.onCall(async (data, context) => {
  const uid = getUserIdFromContext(context);
  await checkRateLimit(uid, 'getUserEventRegistrations', 30, 60000);

  // No `orderBy` here: the filter is on a per-uid map field
  // (`attendees.<uid>.status`), whose composite index cannot be pre-declared,
  // and a filter+orderBy combination would need one. The bounded window is
  // sorted in memory instead.
  const snap = await db.collection('events')
    .where(`attendees.${uid}.status`, 'in', ['registered', 'waitlisted', 'checked_in'])
    .limit(100)
    .get();

  const toMillis = (v) => (v?.toMillis ? v.toMillis() : (v?.seconds ? v.seconds * 1000 : 0));
  const events = snap.docs
    .map((d) => {
      const data = d.data() || {};
      return {
        id: d.id,
        title: data.title || null,
        status: data.status || null,
        startDate: data.startDate || null,
        endDate: data.endDate || null,
        timezone: data.timezone || null,
        location: data.location || null,
        communityId: data.communityId || null,
        coverImage: data.coverImage || null,
        organizerId: data.organizerId || null,
        attendeeStatus: data.attendees?.[uid]?.status || null,
      };
    })
    .sort((a, b) => toMillis(a.startDate) - toMillis(b.startDate));
  return { events };
});

exports.registerForEvent = functions.https.onCall(async (data, context) => {
  const uid = getUserIdFromContext(context);
  await checkRateLimit(uid, 'registerForEvent', 30, 60000);

  const { eventId, ticketTier = 'general' } = data || {};
  const { ref, data: event } = await requireEvent(eventId);
  if (!isOpenForRegistration(event)) throw httpError('failed-precondition', 'This event is not open for registration.');
  if (event.attendees?.[uid]) throw httpError('already-exists', 'You are already registered for this event.');

  const capacity = Number(event.capacity) || 0;
  const registered = Number(event.stats?.attendeeCount) || 0;
  const status = capacity > 0 && registered >= capacity ? 'waitlisted' : 'registered';

  await ref.update({
    [`attendees.${uid}`]: {
      status,
      ticketTier: typeof ticketTier === 'string' ? ticketTier : 'general',
      registeredAt: FieldValue.serverTimestamp(),
      checkedInAt: null,
    },
    'stats.attendeeCount': status === 'registered' ? FieldValue.increment(1) : FieldValue.increment(0),
    'stats.waitlistCount': status === 'waitlisted' ? FieldValue.increment(1) : FieldValue.increment(0),
    updatedAt: FieldValue.serverTimestamp(),
  });
  await db.doc(`users/${uid}`).set(
    { attendingEvents: FieldValue.arrayUnion(eventId), updatedAt: FieldValue.serverTimestamp() },
    { merge: true }
  );
  if (status === 'registered') {
    await awardXpSafe(uid, 'event_rsvp', { source: eventId });
  }
  return { success: true, status };
});

exports.cancelEventRegistration = functions.https.onCall(async (data, context) => {
  const uid = getUserIdFromContext(context);
  await checkRateLimit(uid, 'cancelEventRegistration', 30, 60000);

  const { eventId } = data || {};
  const { ref, data: event } = await requireEvent(eventId);
  const registration = event.attendees?.[uid];
  if (!registration) throw httpError('failed-precondition', 'You are not registered for this event.');

  const wasRegistered = registration.status === 'registered';
  const wasWaitlisted = registration.status === 'waitlisted';

  const patch = { [`attendees.${uid}`]: FieldValue.delete(), updatedAt: FieldValue.serverTimestamp() };
  if (wasRegistered) patch['stats.attendeeCount'] = FieldValue.increment(-1);
  if (wasWaitlisted) patch['stats.waitlistCount'] = FieldValue.increment(-1);
  await ref.update(patch);
  await db.doc(`users/${uid}`).set(
    { attendingEvents: FieldValue.arrayRemove(eventId), updatedAt: FieldValue.serverTimestamp() },
    { merge: true }
  );

  // A freed seat promotes the next person in line.
  if (wasRegistered) {
    const fresh = await ref.get();
    await promoteNextWaitlisted(ref, fresh.data() || {});
  }
  return { success: true };
});

exports.checkInEventAttendee = functions.https.onCall(async (data, context) => {
  const uid = getUserIdFromContext(context);
  await checkRateLimit(uid, 'checkInEventAttendee', 120, 60000);

  const { eventId, attendeeId } = data || {};
  const { ref, data: event } = await requireEvent(eventId);
  if (event.organizerId !== uid) throw httpError('permission-denied', 'Only the organizer can check in attendees.');
  if (!event.attendees?.[attendeeId]) throw httpError('not-found', 'That user is not registered for this event.');

  await ref.update({
    [`attendees.${attendeeId}.checkedInAt`]: FieldValue.serverTimestamp(),
    [`attendees.${attendeeId}.status`]: 'checked_in',
    updatedAt: FieldValue.serverTimestamp(),
  });
  return { success: true };
});

exports.promoteEventWaitlist = functions.https.onCall(async (data, context) => {
  const uid = getUserIdFromContext(context);
  await checkRateLimit(uid, 'promoteEventWaitlist', 30, 60000);

  const { eventId } = data || {};
  const { ref, data: event } = await requireEvent(eventId);
  if (event.organizerId !== uid) throw httpError('permission-denied', 'Only the organizer can promote the waitlist.');
  const promoted = await promoteNextWaitlisted(ref, event);
  return { success: true, promotedUserId: promoted };
});

// Placeholder handles/names the client's read model rejects; mirrored here so a
// roster never surfaces a generated `user_xxxxxx` handle or a "Creator" stand-in.
const PLACEHOLDER_NAMES = new Set([
  'user', 'creator', 'unknown', 'anonymous', 'arvdoul user', 'citizen', 'guest', 'null', 'undefined',
]);
const cleanString = (value) => (typeof value === 'string' && value.trim() ? value.trim() : null);
const isPlaceholder = (value) => {
  const cleaned = cleanString(value);
  return cleaned !== null && (PLACEHOLDER_NAMES.has(cleaned.toLowerCase()) || /^user_[0-9a-f]{4,}$/i.test(cleaned));
};

/**
 * The attendee roster for an event, resolved server-side.
 *
 * `events/{id}.attendees` stores only `{ status, ticketTier, registeredAt,
 * checkedInAt }` per uid — no display name — so the client rendered a
 * fabricated "User" placeholder for every attendee (and lost the real identity
 * entirely). The roster is served here so the caller gets the real, projected
 * `displayName`/`username`/`photoURL` from `users/{uid}`, never a stand-in.
 * Non-attendees receive an empty roster; statuses/counters stay visible to any
 * signed-in viewer (they are event metadata, not personal data).
 */
exports.getEventAttendees = functions.https.onCall(async (data, context) => {
  const uid = getUserIdFromContext(context);
  await checkRateLimit(uid, 'getEventAttendees', 60, 60000);

  const { eventId, includeWaitlist = false } = data || {};
  const { data: event } = await requireEvent(eventId);

  const attendees = event.attendees || {};
  const viewerIsOrganizer = event.organizerId === uid;
  const viewerIsAttendee = Boolean(attendees[uid]);
  if (!viewerIsOrganizer && !viewerIsAttendee) {
    return { attendees: [] };
  }

  const entries = Object.entries(attendees)
    .filter(([, a]) => a && (includeWaitlist || a.status !== 'waitlisted'))
    .slice(0, 200);
  const uids = entries.map(([id]) => id);

  const profiles = new Map();
  for (let i = 0; i < uids.length; i += 30) {
    const chunk = uids.slice(i, i + 30);
    const snap = await db.collection('users').where(admin.firestore.FieldPath.documentId(), 'in', chunk).get();
    snap.forEach((d) => profiles.set(d.id, d.data()));
  }

  const roster = entries.map(([id, a]) => {
    const profile = profiles.get(id) || {};
    const displayName = cleanString(profile.displayName) || cleanString(profile.name);
    const username = cleanString(profile.username);
    return {
      id,
      status: a.status || null,
      ticketTier: a.ticketTier || null,
      checkedInAt: a.checkedInAt || null,
      displayName: isPlaceholder(displayName) ? null : displayName,
      username: isPlaceholder(username) ? null : username,
      photoURL: cleanString(profile.photoURL),
      isVerified: profile.isVerified === true,
    };
  });

  return { attendees: roster };
});

exports.submitEventFeedback = functions.https.onCall(async (data, context) => {
  const uid = getUserIdFromContext(context);
  await checkRateLimit(uid, 'submitEventFeedback', 10, 60000);

  const { eventId, rating, comment = '' } = data || {};
  const numeric = Number(rating);
  if (!Number.isFinite(numeric) || numeric < 1 || numeric > 5) {
    throw httpError('invalid-argument', 'Rating must be between 1 and 5.');
  }
  const { ref, data: event } = await requireEvent(eventId);
  if (!event.attendees?.[uid]) throw httpError('failed-precondition', 'You must be registered to submit feedback.');

  const feedbackId = `event_${eventId}_${uid}`;
  const feedbackRef = db.doc(`event_feedback/${feedbackId}`);
  const existing = await feedbackRef.get();
  const previous = existing.exists ? Number(existing.data().rating) || 0 : 0;

  // One feedback row per (event, attendee): re-submitting replaces the old
  // rating so the average cannot be inflated by voting repeatedly.
  await feedbackRef.set({
    eventId,
    userId: uid,
    rating: numeric,
    comment: typeof comment === 'string' ? comment.slice(0, 1000) : '',
    createdAt: existing.exists ? existing.data().createdAt : FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });

  const sumDelta = numeric - previous;
  const countDelta = existing.exists ? 0 : 1;
  await ref.update({
    'stats.feedbackSum': FieldValue.increment(sumDelta),
    'stats.feedbackCount': FieldValue.increment(countDelta),
    updatedAt: FieldValue.serverTimestamp(),
  });

  const fresh = await ref.get();
  const stats = fresh.data()?.stats || {};
  const count = Number(stats.feedbackCount) || 0;
  const sum = Number(stats.feedbackSum) || 0;
  const feedbackScore = count > 0 ? sum / count : 0;
  await ref.update({ 'stats.feedbackScore': feedbackScore });
  return { success: true, feedbackScore };
});
