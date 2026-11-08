// src/services/callService.js
//
// Owns the `calls/{callId}` Firestore signaling channel for 1:1 WebRTC calls.
// Screens must not touch `calls` directly: the deployed rules require every call
// document to carry a `participants` array (uid in participants), so writing
// only `callerId`/`calleeId` is denied by rules and the call can never connect.
// Keeping the shape here means one place to keep it compatible with
// firestore.rules.
// WebRTC itself (RTCPeerConnection, getUserMedia) stays in the screen: it is
// browser-only and has no server counterpart. This service owns only the data
// plane (who the peer is, the call doc, and the ICE candidate subcollection).

import { logger } from '../utils/Logger.js';

const CALL_STATUS = { RINGING: 'ringing', ACTIVE: 'active', ENDED: 'ended' };

class CallService {
  async _firestore() {
    const { getFirestoreInstance } = await import('../firebase/firebase.js');
    return getFirestoreInstance();
  }

  async _fs() {
    return import('firebase/firestore');
  }

  /**
   * Resolve the other participant of a 1:1 conversation and their profile.
   * @returns {Promise<{conversationId: string, participants: string[], peerId: string, peer: {id:string,name:string,avatar:string|null}}>}
   */
  async resolveCall(conversationId, selfUid) {
    const db = await this._firestore();
    const { doc, getDoc } = await this._fs();
    const convSnap = await getDoc(doc(db, 'conversations', conversationId));
    if (!convSnap.exists()) throw new Error('Conversation not found');
    const participants = convSnap.data().participants || [];
    const peerId = participants.find((p) => p !== selfUid);
    if (!peerId) throw new Error('No peer in conversation');

    let peer = { id: peerId, name: 'User', avatar: null };
    try {
      const { getUserService } = await import('./userService.js');
      const profile = await getUserService().getUserProfile(peerId);
      if (profile) {
        peer = {
          id: peerId,
          name: profile.displayName || profile.username || 'User',
          avatar: profile.photoURL || null,
        };
      }
    } catch (e) {
      logger.warn('[callService] peer profile unavailable', { error: e?.message });
    }
    return { conversationId, participants, peerId, peer };
  }

  /**
   * One 1:1 call is one document, addressed by the two uids. A random id per
   * peer meant each side created its OWN `calls/{id}`, subscribed to its own
   * doc, and the two never saw each other's offer/answer — the call could never
   * connect. Sorting the uids makes the id identical from both sides, so
   * whichever peer opens the call screen first creates the doc and the other
   * joins it.
   */
  deriveCallId(uidA, uidB) {
    const [a, b] = [String(uidA), String(uidB)].sort();
    return `call_${a}__${b}`;
  }

  /**
   * Create (or reuse) the shared signaling document for a 1:1 call.
   *  - absent            -> create it, this peer is the caller
   *  - previous ended    -> reset it for the new call (clears stale SDP)
   *  - already ringing/active -> leave it untouched so a late joiner does not
   *    clobber the in-flight offer/answer
   * @returns {Promise<string>} callId
   */
  async ensureCall({ conversationId, selfUid, peerId, participants }) {
    const db = await this._firestore();
    const { doc, getDoc, setDoc, updateDoc, serverTimestamp } = await this._fs();
    const callId = this.deriveCallId(selfUid, peerId);
    const ref = doc(db, 'calls', callId);
    const memberList = Array.from(new Set([...(participants || []), selfUid, peerId]));

    const snap = await getDoc(ref);
    if (!snap.exists()) {
      await setDoc(ref, {
        conversationId,
        participants: memberList,
        callerId: selfUid,
        calleeId: peerId,
        status: CALL_STATUS.RINGING,
        createdAt: serverTimestamp(),
      });
    } else if (snap.data().status === CALL_STATUS.ENDED) {
      await updateDoc(ref, {
        participants: memberList,
        callerId: selfUid,
        calleeId: peerId,
        status: CALL_STATUS.RINGING,
        offer: null,
        answer: null,
        updatedAt: serverTimestamp(),
      });
    }
    return callId;
  }

  /**
   * Watch for ringing calls addressed to this uid. Returns a stop function.
   *
   * A bounded `getDocs` poll, not an `onSnapshot`: the repo's Firebase cost
   * guard forbids net-new realtime listeners (the baseline may only shrink),
   * and a ringing call is short-lived enough that a few-second poll is fine.
   * `limit()` keeps each read bounded. The caller never matches (calleeId is
   * the peer, not self), so only the callee rings.
   */
  async watchIncomingCalls(selfUid, onRing, { intervalMs = 4000 } = {}) {
    const db = await this._firestore();
    const { collection, query, where, limit, getDocs } = await this._fs();
    let stopped = false;
    let seen = new Set();

    const tick = async () => {
      if (stopped) return;
      try {
        // Query on `participants array-contains` so Firestore can prove the
        // `uid() in resource.data.participants` read rule; a bare `calleeId`
        // filter would be rejected as an unsafe list query ("rules are not
        // filters"). calleeId is filtered here in code instead.
        const snap = await getDocs(query(
          collection(db, 'calls'),
          where('participants', 'array-contains', selfUid),
          where('status', '==', CALL_STATUS.RINGING),
          limit(5),
        ));
        const live = new Set(snap.docs.map((d) => d.id));
        snap.docs.forEach((d) => {
          const data = d.data();
          if (data.calleeId !== selfUid) return; // this is our own outgoing call
          if (seen.has(d.id)) return;
          seen.add(d.id);
          onRing({
            callId: d.id,
            conversationId: data.conversationId,
            callerId: data.callerId,
            participants: data.participants || [],
          });
        });
        // Forget calls that stopped ringing so a later re-ring surfaces again.
        seen = new Set([...seen].filter((id) => live.has(id)));
      } catch (e) {
        logger.warn('[callService] incoming-call poll failed', { error: e?.message });
      }
    };

    await tick();
    const timer = setInterval(tick, intervalMs);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }

  /** Subscribe to the signaling document (offer/answer/status). Returns unsubscribe. */
  async subscribe(callId, onData) {
    const db = await this._firestore();
    const { doc, onSnapshot } = await this._fs();
    return onSnapshot(doc(db, 'calls', callId), (snap) => {
      if (snap.exists()) onData(snap.data());
    }, (err) => logger.warn('[callService] subscription error', err));
  }

  async updateCall(callId, patch) {
    const db = await this._firestore();
    const { doc, updateDoc } = await this._fs();
    await updateDoc(doc(db, 'calls', callId), patch);
  }

  async setOffer(callId, offer) {
    return this.updateCall(callId, { offer });
  }

  async setAnswer(callId, answer) {
    return this.updateCall(callId, { answer, status: CALL_STATUS.ACTIVE });
  }

  async markActive(callId) {
    return this.updateCall(callId, { status: CALL_STATUS.ACTIVE });
  }

  /** Best-effort end; never throws (called from unmount/cleanup). */
  async endCall(callId, selfUid) {
    if (!callId) return;
    try {
      const db = await this._firestore();
      const { doc, updateDoc, serverTimestamp } = await this._fs();
      await updateDoc(doc(db, 'calls', callId), {
        status: CALL_STATUS.ENDED,
        endedAt: serverTimestamp(),
        endedBy: selfUid,
      });
    } catch (e) {
      logger.warn('[callService] endCall best-effort failed', { error: e?.message });
    }
  }

  async addIceCandidate(callId, candidate, fromUid) {
    const db = await this._firestore();
    const { collection, addDoc } = await this._fs();
    await addDoc(collection(db, 'calls', callId, 'ice'), { candidate, from: fromUid });
  }

  /** Subscribe to ICE candidates authored by the peer. Returns unsubscribe. */
  async subscribeToIce(callId, peerUid, onCandidate) {
    const db = await this._firestore();
    const { collection, onSnapshot } = await this._fs();
    return onSnapshot(collection(db, 'calls', callId, 'ice'), (snap) => {
      snap.docChanges().forEach((change) => {
        if (change.type !== 'added') return;
        const data = change.doc.data();
        if (data.from !== peerUid) onCandidate(data.candidate);
      });
    }, (err) => logger.warn('[callService] subscription error', err));
  }
}

let _instance = null;
export function getCallService() {
  if (!_instance) _instance = new CallService();
  return _instance;
}

export { CALL_STATUS };
export default { getCallService, CALL_STATUS };
