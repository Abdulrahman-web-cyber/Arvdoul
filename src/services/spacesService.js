// src/services/spacesService.js - ARVDOUL LIVE AUDIO SPACES & VOICE LOUNGES SERVICE - PRODUCTION READY v6.0
// 🎙️ ARVDOUL LIVE AUDIO SPACES & VOICE LOUNGES SERVICE
// Enterprise multi-user audio rooms with speaker stages, reactions, coin tipping, and Firestore synchronization.

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
      });

      const clientCandidatesCol = collection(roomRef, 'clientCandidates');
      onSnapshot(clientCandidatesCol, (snapshot) => {
        snapshot.docChanges().forEach(async (change) => {
          if (change.type === 'added') {
            const data = change.doc.data();
            await this.peerConnection.addIceCandidate(new RTCIceCandidate(data));
          }
        });
      });

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
      });

      const hostCandidatesCol = collection(roomRef, 'hostCandidates');
      onSnapshot(hostCandidatesCol, (snapshot) => {
        snapshot.docChanges().forEach(async (change) => {
          if (change.type === 'added') {
            const data = change.doc.data();
            await this.peerConnection.addIceCandidate(new RTCIceCandidate(data));
          }
        });
      });
    }
  }

  /**
   * Fetches active spaces from Firestore.
   */
  async getActiveSpaces(category = 'All') {
    log.info('Fetching active spaces from Firestore', { category });
    try {
      const firestore = await getFirestoreInstance();
      const { collection, getDocs, query, where, orderBy, limit } = await import('firebase/firestore');

      const spacesCol = collection(firestore, 'spaces');
      let q = query(spacesCol, orderBy('startedAt', 'desc'), limit(30));

      if (category && category !== 'All') {
        q = query(spacesCol, where('category', '==', category), limit(30));
      }

      const snapshot = await getDocs(q);
      const items = [];
      snapshot.forEach(docSnap => {
        items.push({ id: docSnap.id, ...docSnap.data() });
      });

      return items;
    } catch (err) {
      log.error('Error getting active spaces from Firestore', err);
      return [];
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
      });
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
    log.info('Creating new live space in Firestore', { title, category });
    const firestore = await getFirestoreInstance();
    const { collection, addDoc } = await import('firebase/firestore');

    const newSpace = {
      title,
      category,
      isLive: true,
      startedAt: Date.now(),
      host: {
        id: hostUser?.uid || 'usr-creator',
        name: hostUser?.displayName || 'Arvdoul Creator',
        username: hostUser?.username ? `@${hostUser.username}` : '@creator',
        avatar: hostUser?.photoURL || '/assets/default-profile.png',
        isVerified: true
      },
      speakers: [],
      audienceCount: 1,
      listeners: [],
      raisedHands: [],
      tipsTotalCoins: 0,
      isRecording
    };

    const docRef = await addDoc(collection(firestore, 'spaces'), newSpace);
    return { id: docRef.id, ...newSpace };
  }

  async sendTip(spaceId, amount, speakerId) {
    log.info('Tipping in space', { spaceId, amount, speakerId });
    try {
      const firestore = await getFirestoreInstance();
      const { doc, updateDoc, increment } = await import('firebase/firestore');
      const spaceRef = doc(firestore, 'spaces', spaceId);
      await updateDoc(spaceRef, {
        tipsTotalCoins: increment(Number(amount))
      });
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
    } catch (err) {
      log.error('Error toggling raised hand', err);
    }
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

