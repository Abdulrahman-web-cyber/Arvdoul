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
