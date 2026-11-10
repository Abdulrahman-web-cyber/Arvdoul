// src/services/spacesService.js

import { svcLogger } from './ServiceKit.js';
import { getFirestoreInstance } from '../firebase/firebase.js';

const log = svcLogger('spacesService');

class SpacesService {
  constructor() {
    this.activeRoomId = null;
    this.listeners = new Set();

    // WebRTC signaling
    this.peerConnection = null;
    this.localStream = null;
    this.remoteStream = null;
    this.signalingUnsubscribe = null;
    this.spacesUnsubscribe = null;
  }

  /**
   * Initializes RTCPeerConnection with STUN servers and links to Firestore signaling rooms.
   */
  async createSignalRoom(spaceId, isHost, onTrackCallback) {
    const firestore = await getFirestoreInstance();
    const { doc, setDoc, onSnapshot, collection, addDoc } = await import('firebase/firestore');

    const configuration = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ]
    };

    this.peerConnection = new RTCPeerConnection(configuration);

    if (isHost && this.localStream) {
      this.localStream.getTracks().forEach(track => {
        this.peerConnection.addTrack(track, this.localStream);
      });
    }

    this.peerConnection.ontrack = (event) => {
      if (onTrackCallback && event.streams[0]) {
        this.remoteStream = event.streams[0];
        onTrackCallback(this.remoteStream);
      }
    };

    const roomRef = doc(firestore, 'signaling_rooms', spaceId);

    this.peerConnection.onicecandidate = async (event) => {
      if (event.candidate) {
        const candidateCol = collection(roomRef, isHost ? 'hostCandidates' : 'clientCandidates');
        await addDoc(candidateCol, event.candidate.toJSON());
      }
    };

    if (isHost) {
      const offer = await this.peerConnection.createOffer();
      await this.peerConnection.setLocalDescription(offer);

      await setDoc(roomRef, {
        offer: {
          type: offer.type,
          sdp: offer.sdp
        }
      });

      this.signalingUnsubscribe = onSnapshot(roomRef, async (snapshot) => {
        const data = snapshot.data();
        if (data?.answer && !this.peerConnection.currentRemoteDescription) {
          const rtcAnswer = new RTCSessionDescription(data.answer);
          await this.peerConnection.setRemoteDescription(rtcAnswer);
        }
      }, (err) => log.warn('[spacesService] subscription error', err));

      const clientCandidatesCol = collection(roomRef, 'clientCandidates');
      onSnapshot(clientCandidatesCol, (snapshot) => {
        snapshot.docChanges().forEach(async (change) => {
          if (change.type === 'added') {
            const data = change.doc.data();
            await this.peerConnection.addIceCandidate(new RTCIceCandidate(data));
          }
        });
      }, (err) => log.warn('[spacesService] subscription error', err));

    } else {
      const roomSnap = doc(firestore, 'signaling_rooms', spaceId);
      this.signalingUnsubscribe = onSnapshot(roomSnap, async (snapshot) => {
        const data = snapshot.data();
        if (data?.offer && !this.peerConnection.currentRemoteDescription) {
          await this.peerConnection.setRemoteDescription(new RTCSessionDescription(data.offer));
          const answer = await this.peerConnection.createAnswer();
          await this.peerConnection.setLocalDescription(answer);

          await setDoc(roomRef, { answer: { type: answer.type, sdp: answer.sdp } }, { merge: true });
        }
      }, (err) => log.warn('[spacesService] subscription error', err));

      const hostCandidatesCol = collection(roomRef, 'hostCandidates');
      onSnapshot(hostCandidatesCol, (snapshot) => {
        snapshot.docChanges().forEach(async (change) => {
          if (change.type === 'added') {
            const data = change.doc.data();
            await this.peerConnection.addIceCandidate(new RTCIceCandidate(data));
          }
        });
      }, (err) => log.warn('[spacesService] subscription error', err));
    }
  }

  /**
   * Fetches active spaces from Firestore.
   */
  /**
   * Hosts whose live spaces must not surface for the viewer: blocked,
   * blocked-by and muted. Delegates to the graph spine (bounded, fails open).
   */
  async _getHiddenAuthors(viewerId) {
    if (!viewerId) return new Set();
    try {
      const { getSocialGraphService } = await import('./socialGraphService.js');
      return await getSocialGraphService().getHiddenAuthorIds(viewerId);
    } catch (err) {
      log.warn('Spaces hidden-author read failed; not filtering', { error: err?.message });
      return new Set();
    }
  }

  async getActiveSpaces(category = 'All', viewerId = null) {
    log.info('Fetching active spaces from Firestore', { category });
    try {
      const firestore = await getFirestoreInstance();
      const { collection, getDocs, query, where, orderBy, limit } = await import('firebase/firestore');

      const hiddenAuthors = await this._getHiddenAuthors(viewerId);
      const spacesCol = collection(firestore, 'spaces');
      // Only genuinely live spaces: without the `isLive` filter the list
      // accumulated every space ever created (nothing ends a space), so the
      // "Discover Live Lounges" rail filled with dead rooms.
      let q = query(spacesCol, where('isLive', '==', true), orderBy('startedAt', 'desc'), limit(30));

      if (category && category !== 'All') {
        q = query(spacesCol, where('category', '==', category), where('isLive', '==', true), limit(30));
      }

      const snapshot = await getDocs(q);
      const items = [];
      snapshot.forEach(docSnap => {
        const data = docSnap.data();
        if (hiddenAuthors.has(data.hostId)) return;
        items.push({ id: docSnap.id, ...data });
      });

      return items;
    } catch (err) {
      log.error('Error getting active spaces from Firestore', err);
      return [];
    }
  }

  /**
   * Ends a space: flips `isLive` so it leaves the discover list, and stops the
   * host's local capture. Host-only server-side (the rules enforce ownership).
   */
  async endSpace(spaceId, userId) {
    if (!spaceId || !userId) return { success: false, error: 'Not signed in' };
    try {
      const firestore = await getFirestoreInstance();
      const { doc, updateDoc, serverTimestamp } = await import('firebase/firestore');
      await updateDoc(doc(firestore, 'spaces', spaceId), {
        isLive: false,
        endedAt: serverTimestamp(),
        endedBy: userId,
      });
      if (this.activeRoomId === spaceId) {
        this.stopAudio();
        this.activeRoomId = null;
      }
      return { success: true };
    } catch (err) {
      log.error('Error ending space', err);
      return { success: false, error: err.message };
    }
  }

  /**
   * Subscribes to real-time updates for active spaces.
   */
  async subscribeSpaces(category = 'All', callback) {
    try {
      const firestore = await getFirestoreInstance();
      const { collection, onSnapshot, query, orderBy, limit } = await import('firebase/firestore');

      const q = query(collection(firestore, 'spaces'), orderBy('startedAt', 'desc'), limit(30));
      return onSnapshot(q, (snapshot) => {
        const items = [];
        snapshot.forEach(d => items.push({ id: d.id, ...d.data() }));
        if (category !== 'All') {
          callback(items.filter(s => s.category?.toLowerCase() === category.toLowerCase()));
        } else {
          callback(items);
        }
      }, (err) => log.warn('[spacesService] subscription error', err));
    } catch (err) {
      log.error('Error subscribing to spaces', err);
      return () => {};
    }
  }

  async getSpaceById(spaceId) {
    try {
      const firestore = await getFirestoreInstance();
      const { doc, getDoc } = await import('firebase/firestore');
      const docRef = doc(firestore, 'spaces', spaceId);
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        return { id: snap.id, ...snap.data() };
      }
    } catch (err) {
      log.error('Error getting space by ID', err);
    }
    return null;
  }

  async createSpace({ title, category = 'General', isRecording = true, hostUser }) {
    if (!hostUser?.uid) {
      throw new Error('Sign in to start a space');
    }
    log.info('Creating new live space in Firestore', { title, category });
    const firestore = await getFirestoreInstance();
    const { collection, addDoc } = await import('firebase/firestore');

    // Honest host identity: real user fields only; no fabricated names,
    // handles, avatars or "Verified" badges.
    const newSpace = {
      title,
      category,
      isLive: true,
      startedAt: Date.now(),
      hostId: hostUser.uid,
      host: {
        id: hostUser.uid,
        name: hostUser.displayName || '',
        username: hostUser.username ? `@${hostUser.username}` : null,
        avatar: hostUser.photoURL || null,
        isVerified: false
      },
      speakers: [],
      audienceCount: 1,
      listeners: [{
        id: hostUser.uid,
        name: hostUser.displayName || '',
        avatar: hostUser.photoURL || null,
      }],
      // The signaling rules resolve membership from this array, so the host
      // must be seeded here or `signaling_rooms/{spaceId}` denies the host's
      // own offer.
      participants: [hostUser.uid],
      raisedHands: [],
      tipsTotalCoins: 0,
      isRecording
    };

    const docRef = await addDoc(collection(firestore, 'spaces'), newSpace);
    return { id: docRef.id, ...newSpace };
  }

  /**
 * coin tip: debits the sender via the server-authoritative coin ledger
   * (transferCoins CF, no client fallback) and credits the speaker. The space's
   * running tip total (`tipsTotalCoins`) is bumped by the same server
   * transaction — a client write here was always denied (only the host may
   * update a space, and a self-tip is rejected), so the total never moved.
   * Never lets a sender tip coins they do not have.
   */
  async sendTip(spaceId, amount, speakerId, senderId = null) {
    log.info('Tipping in space', { spaceId, amount, speakerId, senderId });
    const numericAmount = Number(amount);
    if (!numericAmount || numericAmount <= 0) {
      return { success: false, error: 'Invalid tip amount' };
    }
    if (!senderId) {
      return { success: false, error: 'Sign in to send a tip' };
    }

    try {
      // Double-entry transfer: sender → speaker. The server also bumps the
      // space's tipsTotalCoins when `reason` is 'space_tip'.
      const { getMonetizationService } = await import('./monetizationService.js');
      const monetization = getMonetizationService();
      const transfer = await monetization.transferCoins(
        senderId,
        speakerId,
        numericAmount,
        'space_tip',
        { spaceId }
      );
      if (!transfer?.success) {
        return { success: false, error: transfer?.message || 'Tip could not be processed' };
      }

      return { success: true };
    } catch (err) {
      log.error('Error sending tip in space', err);
      return { success: false, error: err.message };
    }
  }

  async toggleRaisedHand(spaceId, user, isRaising) {
    try {
      const firestore = await getFirestoreInstance();
      const { doc, updateDoc, arrayUnion, arrayRemove } = await import('firebase/firestore');
      const spaceRef = doc(firestore, 'spaces', spaceId);
      const handObject = {
        id: user.uid || user.id,
        name: user.displayName || user.name || 'Participant',
        avatar: user.photoURL || user.avatar || ''
      };
      if (isRaising) {
        await updateDoc(spaceRef, { raisedHands: arrayUnion(handObject) });
      } else {
        await updateDoc(spaceRef, { raisedHands: arrayRemove(handObject) });
      }
      return { success: true };
    } catch (err) {
      // Surface the failure: the screen used to show "Hand raised ✋" even when
      // the write was denied, so the hand state was never persisted.
      log.error('Error toggling raised hand', err);
      return { success: false, error: err.message };
    }
  }

  /**
   * Adds the member to the space roster and the `participants` array the
   * signaling rules read. Idempotent — re-joining keeps one roster entry.
   */
  async joinSpace(spaceId, user) {
    if (!spaceId || !user?.uid) {
      return { success: false, error: 'Sign in to join a space' };
    }
    try {
      const firestore = await getFirestoreInstance();
      const { doc, runTransaction, arrayUnion } = await import('firebase/firestore');
      const spaceRef = doc(firestore, 'spaces', spaceId);
      const listener = {
        id: user.uid,
        name: user.displayName || user.username || '',
        avatar: user.photoURL || null,
      };
      await runTransaction(firestore, async (tx) => {
        const snap = await tx.get(spaceRef);
        if (!snap.exists()) throw new Error('Space not found');
        const data = snap.data();
        const already = (data.participants || []).includes(user.uid);
        if (already) return;
        const listeners = [...(data.listeners || []), listener];
        tx.update(spaceRef, {
          listeners,
          participants: arrayUnion(user.uid),
          audienceCount: listeners.length,
        });
      });
      return { success: true };
    } catch (err) {
      log.error('Error joining space', err);
      return { success: false, error: err.message };
    }
  }

  /** Removes the member from the roster + participants array. */
  async leaveSpace(spaceId, userId) {
    if (!spaceId || !userId) return { success: false, error: 'Not signed in' };
    try {
      const firestore = await getFirestoreInstance();
      const { doc, runTransaction, arrayRemove } = await import('firebase/firestore');
      const spaceRef = doc(firestore, 'spaces', spaceId);
      await runTransaction(firestore, async (tx) => {
        const snap = await tx.get(spaceRef);
        if (!snap.exists()) return;
        const data = snap.data();
        const listeners = (data.listeners || []).filter((l) => l.id !== userId);
        tx.update(spaceRef, {
          listeners,
          participants: arrayRemove(userId),
          audienceCount: listeners.length,
        });
      });
      return { success: true };
    } catch (err) {
      log.error('Error leaving space', err);
      return { success: false, error: err.message };
    }
  }

  /**
   * Opens the microphone and wires it into the real signaling room, returning
   * the remote stream via `onRemoteTrack`. Honest failure: throws if the mic
   * permission is refused instead of pretending the user is on stage.
   */
  async startAudio(spaceId, user, { isHost = false, onRemoteTrack } = {}) {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error('Microphone access is not supported in this browser.');
    }
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    this.localStream = stream;
    this.activeRoomId = spaceId;
    try {
      await this.createSignalRoom(spaceId, isHost, onRemoteTrack);
    } catch (err) {
      stream.getTracks().forEach((t) => t.stop());
      this.localStream = null;
      throw err;
    }
    return stream;
  }

  /** Stops the local microphone tracks (and clears the peer connection). */
  stopAudio() {
    if (this.localStream) {
      this.localStream.getTracks().forEach((t) => t.stop());
      this.localStream = null;
    }
    this.destroy();
  }

  destroy() {
    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }
    if (this.signalingUnsubscribe) {
      this.signalingUnsubscribe();
      this.signalingUnsubscribe = null;
    }
    if (this.spacesUnsubscribe) {
      this.spacesUnsubscribe();
      this.spacesUnsubscribe = null;
    }
  }
}

export const spacesService = new SpacesService();
export default spacesService;

