// functions/live.js — live-stream aggregate triggers.
//
// The parent `live_streams/{streamId}` document is owner-write-only (a viewer
// cannot touch it), while the viewer's own `live_viewers/{streamId}_{viewerId}`
// record IS client-writable. A viewer's client therefore cannot maintain the
// stream's running totals, so they are derived server-side here.
//
// `stats.totalViewers` is the count of distinct viewers who ever joined the
// stream: it is incremented once when a viewer record is created (a re-join
// updates the existing record, so it is never double-counted) and never
// decremented on leave. The live "who is watching now" number is the sharded
// `live_streams/{id}` `viewerCount` counter, which the client maintains and
// `liveService.getLiveStream` overlays on read.
const functions = require('firebase-functions');
const admin = require('firebase-admin');

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

exports.onLiveViewerCreate = functions.firestore
  .document('live_viewers/{viewerId}')
  .onCreate(async (snap) => {
    const viewer = snap.data() || {};
    const streamId = viewer.streamId;
    if (!streamId) return;

    const streamRef = db.collection('live_streams').doc(streamId);
    await db.runTransaction(async (t) => {
      const streamSnap = await t.get(streamRef);
      if (!streamSnap.exists) return;
      const stats = streamSnap.data().stats || {};
      t.update(streamRef, {
        'stats.totalViewers': (stats.totalViewers || 0) + 1,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    });
  });
