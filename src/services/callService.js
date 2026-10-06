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
   * Create the signaling document. Writes `participants` (rules requirement) plus
   * the caller/callee fields used by the UI.
   * @returns {Promise<string>} callId
   */
  async createCall({ conversationId, selfUid, peerId, participants }) {
    const db = await this._firestore();
    const { collection, addDoc, serverTimestamp } = await this._fs();
    const memberList = Array.from(new Set([...(participants || []), selfUid, peerId]));
    const ref = await addDoc(collection(db, 'calls'), {
      conversationId,
      participants: memberList,
      callerId: selfUid,
      calleeId: peerId,
      status: CALL_STATUS.RINGING,
      createdAt: serverTimestamp(),
    });
    return ref.id;
  }

  /** Subscribe to the signaling document (offer/answer/status). Returns unsubscribe. */
  async subscribe(callId, onData) {
    const db = await this._firestore();
    const { doc, onSnapshot } = await this._fs();
    return onSnapshot(doc(db, 'calls', callId), (snap) => {
      if (snap.exists()) onData(snap.data());
    });
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
    });
  }
}

let _instance = null;
export function getCallService() {
  if (!_instance) _instance = new CallService();
  return _instance;
}

export { CALL_STATUS };
export default { getCallService, CALL_STATUS };
