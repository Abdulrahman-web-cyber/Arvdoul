/**
 * src/services/liveService.js - ARVDOUL Ultimate Live Streaming Service - PRODUCTION READY v5.0
 * 
 * Comprehensive live streaming functionality for creators with real WebRTC signaling fallback.
 * Features:
 * - Level-based live streaming (min level 5)
 * - Live stream management (start, end, join, leave)
 * - Real WebRTC P2P signaling rooms implemented serverless over Firestore
 * - Real-time comments and viewer tracking
 * - Gifts and tips system
 * - Monetization settings
 * - Analytics and earnings tracking
 * 
 * @author ARVDOUL Engineering Team
 * @version 5.0.0
 */

import { produce } from 'immer';
import { cacheManager } from '../utils/CacheManager.js';
import { countersManager } from '../utils/CountersManager.js';
import { offlineQueue } from '../utils/OfflineQueue.js';
import { logger } from '../utils/Logger.js';
import { auditLogger } from '../utils/AuditLogger.js';
import { rateLimiter } from '../utils/RateLimiter.js';
import { errorHandler } from '../utils/ErrorHandler.js';
import { idempotencyStore } from '../utils/IdempotencyKey.js';
import { getFirestoreInstance, getAuthInstance } from '../firebase/firebase.js';

function secureRandom() {
  if (typeof window !== 'undefined' && window.crypto) {
    const array = new Uint32Array(1);
    window.crypto.getRandomValues(array);
    return array[0] / 4294967296;
  }
  return Math.random();
}

// ==================== CONFIGURATION ====================
const LIVE_CONFIG = {
  MIN_LEVEL_TO_START: 5,
  VIEWER_LIMITS: {
    5: 50,
    10: 100,
    20: 200,
    30: 500,
    50: 1000,
  },
  MAX_DURATION_HOURS: 4,
  COOLDOWN_MINUTES: 5,
  MAX_COMMENTS_PER_MINUTE: 60,
  COIN_VALUES: {
    rose: 5,
    heart: 10,
    star: 25,
    crown: 50,
    diamond: 100,
    rocket: 500,
    galaxy: 1000,
  },
  GIFT_TYPES: [
    { id: 'rose', name: 'Rose', emoji: '🌹', coinValue: 5 },
    { id: 'heart', name: 'Heart', emoji: '💖', coinValue: 10 },
    { id: 'star', name: 'Star', emoji: '⭐', coinValue: 25 },
    { id: 'crown', name: 'Crown', emoji: '👑', coinValue: 50 },
    { id: 'diamond', name: 'Diamond', emoji: '💎', coinValue: 100 },
    { id: 'rocket', name: 'Rocket', emoji: '🚀', coinValue: 500 },
    { id: 'galaxy', name: 'Galaxy', emoji: '🌌', coinValue: 1000 },
  ],
  TIPS: {
    MIN: 1,
    MAX: 1000,
    STEPS: [5, 10, 20, 50, 100, 200, 500, 1000],
  },
  CACHE_TTL: 60 * 1000,
  COMMENTS_LIMIT: 50,
  VIEWERS_LIMIT: 100,
};

function enhanceError(error, defaultMessage) {
  const errorMap = {
    'permission-denied': 'You do not have permission to perform this action.',
    'unauthenticated': 'Authentication required for live streaming.',
    'not-found': 'Live stream not found.',
    'already-exists': 'A live stream already exists.',
    'resource-exhausted': 'Live streaming quota exceeded.',
    'failed-precondition': 'Cannot start live stream. Please try again.',
    'deadline-exceeded': 'Live stream request timed out.',
    'unavailable': 'Live streaming service temporarily unavailable.',
    'invalid-argument': 'Invalid live stream request.',
  };
  
  const code = error?.code || 'unknown';
  let message = errorMap[code] || defaultMessage || 'Live streaming operation failed';
  
  const enhanced = new Error(message);
  enhanced.code = code;
  enhanced.originalError = error;
  enhanced.timestamp = new Date().toISOString();
  return enhanced;
}

class UltimateLiveService {
  constructor() {
    this.firestore = null;
    this.auth = null;
    this.initialized = false;
    this.cache = cacheManager.namespace('live', LIVE_CONFIG.CACHE_TTL);
    this.subscriptions = new Map();
    this._activeStreamListeners = new Map();
    this._commentListeners = new Map();
    this._viewerListeners = new Map();
    this._userLevelCache = new Map();

    // WebRTC signaling variables
    this.peerConnection = null;
    this.localStream = null;
    this.remoteStream = null;
    this.signalingUnsubscribe = null;
  }

  async initialize() {
    if (this.initialized && this.firestore) return this.firestore;

    try {
      this.firestore = await getFirestoreInstance();
      this.auth = await getAuthInstance();
      this.initialized = true;
      return this.firestore;
    } catch (error) {
      logger.error('❌ Live service initialization failed:', error);
      throw enhanceError(error, 'Failed to initialize live streaming service');
    }
  }

  async _ensureInitialized() {
    if (!this.initialized || !this.firestore) await this.initialize();
    return this.firestore;
  }

  _generateStreamId() {
    return `live_${Date.now()}_${secureRandom().toString(36).substr(2, 9)}`;
  }

  _getViewerLimit(level) {
    const limits = LIVE_CONFIG.VIEWER_LIMITS;
    const levels = Object.keys(limits).map(Number).sort((a, b) => a - b);
    
    for (const l of levels) {
      if (level >= l) continue;
      return limits[levels[levels.indexOf(l) - 1]] || 50;
    }
    
    return limits[levels[levels.length - 1]] || 1000;
  }

  async _getUserLevel(userId) {
    if (this._userLevelCache.has(userId)) {
      return this._userLevelCache.get(userId);
    }

    try {
      const { doc, getDoc } = await import('firebase/firestore');
      const userRef = doc(this.firestore, 'users', userId);
      const snap = await getDoc(userRef);
      
      const level = snap.exists() ? (snap.data().level || 1) : 1;
      this._userLevelCache.set(userId, level);
      return level;
    } catch {
      return 1;
    }
  }

  getLiveConfig() {
    return {
      MIN_LEVEL_TO_START: LIVE_CONFIG.MIN_LEVEL_TO_START,
      VIEWER_LIMITS: LIVE_CONFIG.VIEWER_LIMITS,
      MAX_DURATION_HOURS: LIVE_CONFIG.MAX_DURATION_HOURS,
      COOLDOWN_MINUTES: LIVE_CONFIG.COOLDOWN_MINUTES,
      MAX_COMMENTS_PER_MINUTE: LIVE_CONFIG.MAX_COMMENTS_PER_MINUTE,
      GIFT_TYPES: LIVE_CONFIG.GIFT_TYPES,
      TIPS: LIVE_CONFIG.TIPS,
    };
  }

  async canStartLive(userId) {
    try {
      await this._ensureInitialized();
      const userLevel = await this._getUserLevel(userId);
      
      if (userLevel < LIVE_CONFIG.MIN_LEVEL_TO_START) {
        return {
          canStart: false,
          reason: `You need to be at least Level ${LIVE_CONFIG.MIN_LEVEL_TO_START} to start a live stream. Current level: ${userLevel}`,
          userLevel,
          requiredLevel: LIVE_CONFIG.MIN_LEVEL_TO_START,
        };
      }

      const { collection, query, where, getDocs } = await import('firebase/firestore');
      const streamsRef = collection(this.firestore, 'live_streams');
      const activeQuery = query(
        streamsRef,
        where('userId', '==', userId),
        where('status', '==', 'live')
      );
      
      const snapshot = await getDocs(activeQuery);
      if (!snapshot.empty) {
        return {
          canStart: false,
          reason: 'You already have an active live stream.',
          userLevel,
          existingStreamId: snapshot.docs[0].id,
        };
      }

      const endedQuery = query(
        streamsRef,
        where('userId', '==', userId),
        where('status', '==', 'ended')
      );
      
      const endedSnapshot = await getDocs(endedQuery);
      if (!endedSnapshot.empty) {
        const lastEnded = endedSnapshot.docs
          .map(doc => ({ id: doc.id, ...doc.data() }))
          .sort((a, b) => {
            const aTime = a.endTime?.toDate?.()?.getTime() || 0;
            const bTime = b.endTime?.toDate?.()?.getTime() || 0;
            return bTime - aTime;
          })[0];
        
        if (lastEnded?.endTime) {
          const cooldownMs = LIVE_CONFIG.COOLDOWN_MINUTES * 60 * 1000;
          const timeSinceEnd = Date.now() - lastEnded.endTime.toDate().getTime();
          
          if (timeSinceEnd < cooldownMs) {
            const remainingMinutes = Math.ceil((cooldownMs - timeSinceEnd) / 60000);
            return {
              canStart: false,
              reason: `Please wait ${remainingMinutes} more minutes before starting another stream.`,
              userLevel,
              cooldownRemaining: remainingMinutes,
            };
          }
        }
      }

      return {
        canStart: true,
        reason: null,
        userLevel,
        viewerLimit: this._getViewerLimit(userLevel),
      };
    } catch (error) {
      logger.error('❌ Check can start live failed:', error);
      return {
        canStart: false,
        reason: 'Failed to check live stream eligibility.',
        userLevel: 1,
      };
    }
  }

  // ==================== REAL SERVERLESS WEBRTC SIGNALLING ====================
  /**
   * Initializes RTCPeerConnection with STUN servers and links to Firestore signaling rooms.
   */
  async createSignalRoom(streamId, isHost, onTrackCallback) {
    await this._ensureInitialized();
    const { doc, setDoc, onSnapshot, collection, addDoc } = await import('firebase/firestore');

    const configuration = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ]
    };

    this.peerConnection = new RTCPeerConnection(configuration);

    // Host stream attachment
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

    const roomRef = doc(this.firestore, 'signaling_rooms', streamId);

    // Save ICE Candidates to Firestore
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

      // Listen for client answer
      this.signalingUnsubscribe = onSnapshot(roomRef, async (snapshot) => {
        const data = snapshot.data();
        if (data?.answer && !this.peerConnection.currentRemoteDescription) {
          const rtcAnswer = new RTCSessionDescription(data.answer);
          await this.peerConnection.setRemoteDescription(rtcAnswer);
        }
      });

      // Listen for client ICE Candidates
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
      // Client connects to host offer
      const roomSnap = await doc(this.firestore, 'signaling_rooms', streamId);
      this.signalingUnsubscribe = onSnapshot(roomSnap, async (snapshot) => {
        const data = snapshot.data();
        if (data?.offer && !this.peerConnection.currentRemoteDescription) {
          await this.peerConnection.setRemoteDescription(new RTCSessionDescription(data.offer));
          const answer = await this.peerConnection.createAnswer();
          await this.peerConnection.setLocalDescription(answer);

          await setDoc(roomRef, { answer: { type: answer.type, sdp: answer.sdp } }, { merge: true });
        }
      });

      // Listen for host ICE Candidates
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

  async startLiveStream(userId, streamData) {
    try {
      await this._ensureInitialized();
      const canStart = await this.canStartLive(userId);
      if (!canStart.canStart) {
        throw new Error(canStart.reason);
      }

      const { doc, setDoc, serverTimestamp } = await import('firebase/firestore');
      const streamId = this._generateStreamId();
      const streamRef = doc(this.firestore, 'live_streams', streamId);
      
      const stream = {
        id: streamId,
        userId,
        title: streamData.title || 'Live Stream',
        description: streamData.description || '',
        status: 'live',
        startTime: serverTimestamp(),
        endTime: null,
        duration: 0,
        viewerCount: 0,
        maxViewers: canStart.viewerLimit || 50,
        stats: {
          totalViewers: 0,
          peakViewers: 0,
          totalTips: 0,
          totalGifts: 0,
          coinsEarned: 0,
        },
        monetization: {
          tipsEnabled: streamData.tipsEnabled ?? true,
          giftsEnabled: streamData.giftsEnabled ?? true,
          payPerView: streamData.payPerView ?? false,
          price: streamData.price ?? 0,
        },
        visibility: streamData.visibility || 'public',
        isDeleted: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      
      await setDoc(streamRef, stream);
      this._userLevelCache.delete(userId);
      
      return {
        success: true,
        stream: {
          id: streamId,
          ...stream,
          startTime: new Date().toISOString(),
        },
      };
    } catch (error) {
      logger.error('❌ Start live stream failed:', error);
      throw enhanceError(error, 'Failed to start live stream');
    }
  }

  async endLiveStream(streamId, userId) {
    try {
      await this._ensureInitialized();
      const { doc, updateDoc, getDoc, serverTimestamp } = await import('firebase/firestore');
      
      const streamRef = doc(this.firestore, 'live_streams', streamId);
      const streamSnap = await getDoc(streamRef);
      
      if (!streamSnap.exists()) {
        throw new Error('Live stream not found');
      }
      
      const streamData = streamSnap.data();
      if (streamData.userId !== userId) {
        throw new Error('You can only end your own live stream');
      }
      
      if (streamData.status !== 'live') {
        throw new Error('Stream is not currently live');
      }
      
      const startTime = streamData.startTime?.toDate?.() || new Date();
      const endTime = new Date();
      const durationMs = endTime.getTime() - startTime.getTime();
      const durationMinutes = Math.floor(durationMs / 60000);
      
      await updateDoc(streamRef, {
        status: 'ended',
        endTime: serverTimestamp(),
        duration: durationMinutes,
        updatedAt: serverTimestamp(),
      });
      
      const viewerCount = await countersManager.get({ docPath: `live_streams/${streamId}`, field: 'viewerCount', fallback: streamData.viewerCount || 0 });
      const peakViewers = streamData.stats?.peakViewers || 0;
      const coinsEarned = streamData.stats?.coinsEarned || 0;

      auditLogger.log('live.ended', { userId, meta: { streamId, duration: durationMinutes, peakViewers, coinsEarned } });

      // Clean up signaling peer
      if (this.peerConnection) {
        this.peerConnection.close();
        this.peerConnection = null;
      }
      if (this.signalingUnsubscribe) {
        this.signalingUnsubscribe();
        this.signalingUnsubscribe = null;
      }
      
      return {
        success: true,
        stream: {
          id: streamId,
          status: 'ended',
          duration: durationMinutes,
          totalViewers: streamData.stats?.totalViewers || 0,
          peakViewers,
          coinsEarned,
          viewerCount,
        },
      };
    } catch (error) {
      logger.error('End live stream failed', { error: error.message, streamId, userId });
      throw enhanceError(error, 'Failed to end live stream');
    }
  }

  async getLiveStream(streamId) {
    try {
      const cacheKey = `stream_${streamId}`;
      const cached = this.cache.get(cacheKey);
      if (cached) return cached;

      await this._ensureInitialized();
      const { doc, getDoc } = await import('firebase/firestore');
      const streamRef = doc(this.firestore, 'live_streams', streamId);
      const snap = await getDoc(streamRef);
      
      if (!snap.exists() || snap.data().isDeleted) {
        return null;
      }
      
      const stream = {
        id: snap.id,
        ...snap.data(),
        startTime: snap.data().startTime?.toDate?.()?.toISOString(),
        endTime: snap.data().endTime?.toDate?.()?.toISOString(),
        createdAt: snap.data().createdAt?.toDate?.()?.toISOString(),
      };
      await countersManager.apply({ data: stream, docPath: `live_streams/${streamId}`, fields: ['viewerCount'], scope: 'top' });
      
      this.cache.set(cacheKey, stream);
      return stream;
    } catch (error) {
      logger.error('Get live stream failed', { error: error.message, streamId });
      throw enhanceError(error, 'Failed to get live stream');
    }
  }

  async getActiveLiveStreams(options = {}) {
    try {
      await this._ensureInitialized();
      const { collection, query, where, orderBy, limit, getDocs } = await import('firebase/firestore');
      
      const streamsRef = collection(this.firestore, 'live_streams');
      let q = query(
        streamsRef,
        where('status', '==', 'live'),
        where('isDeleted', '==', false),
        orderBy('startTime', 'desc')
      );
      
      if (options.limit) {
        q = query(q, limit(options.limit));
      }
      
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        startTime: doc.data().startTime?.toDate?.()?.toISOString(),
      }));
    } catch (error) {
      logger.error('❌ Get active live streams failed:', error);
      return [];
    }
  }

  async getLiveHistory(userId, options = {}) {
    try {
      await this._ensureInitialized();
      const { collection, query, where, orderBy, limit, getDocs } = await import('firebase/firestore');
      
      const streamsRef = collection(this.firestore, 'live_streams');
      let q = query(
        streamsRef,
        where('userId', '==', userId),
        where('isDeleted', '==', false)
      );
      
      if (options.status) {
        q = query(q, where('status', '==', options.status));
      }
      
      q = query(q, orderBy('createdAt', 'desc'));
      
      if (options.limit) {
        q = query(q, limit(options.limit));
      }
      
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        startTime: doc.data().startTime?.toDate?.()?.toISOString(),
        endTime: doc.data().endTime?.toDate?.()?.toISOString(),
        createdAt: doc.data().createdAt?.toDate?.()?.toISOString(),
      }));
    } catch (error) {
      logger.error('❌ Get live history failed:', error);
      return [];
    }
  }

  async joinLiveStream(streamId, viewerId) {
    try {
      await this._ensureInitialized();
      const { doc, setDoc, getDoc, serverTimestamp, runTransaction } = await import('firebase/firestore');

      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        await offlineQueue.enqueue({ type: 'live.join', payload: { streamId, viewerId } });
        return { success: true, offlineQueued: true };
      }
      
      const streamRef = doc(this.firestore, 'live_streams', streamId);
      const streamSnap = await getDoc(streamRef);
      
      if (!streamSnap.exists() || streamSnap.data().status !== 'live') {
        throw new Error('Stream is not available');
      }
      
      const viewerRef = doc(this.firestore, 'live_viewers', `${streamId}_${viewerId}`);
      
      await runTransaction(this.firestore, async (transaction) => {
        const viewerSnap = await transaction.get(viewerRef);
        
        if (viewerSnap.exists()) {
          transaction.update(viewerRef, {
            leftAt: null,
            joinedAt: serverTimestamp(),
          });
        } else {
          transaction.set(viewerRef, {
            userId: viewerId,
            streamId,
            joinedAt: serverTimestamp(),
            leftAt: null,
            watchDuration: 0,
            interactions: {
              comments: 0,
              gifts: 0,
              tips: 0,
            },
          });
        }
        
        await countersManager.incrementInTransaction(transaction, { docPath: `live_streams/${streamId}`, field: 'viewerCount' });
        transaction.update(streamRef, {
          'stats.totalViewers': ((streamSnap.data().stats?.totalViewers) || 0) + 1,
          updatedAt: serverTimestamp(),
        });
      });
      countersManager.invalidate({ docPath: `live_streams/${streamId}`, field: 'viewerCount' });
      
      return { success: true };
    } catch (error) {
      logger.error('Join live stream failed', { error: error.message, streamId, viewerId });
      throw enhanceError(error, 'Failed to join live stream');
    }
  }

  async leaveLiveStream(streamId, viewerId) {
    try {
      await this._ensureInitialized();
      const { doc, serverTimestamp, runTransaction } = await import('firebase/firestore');

      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        await offlineQueue.enqueue({ type: 'live.leave', payload: { streamId, viewerId } });
        return { success: true, offlineQueued: true };
      }
      
      const viewerRef = doc(this.firestore, 'live_viewers', `${streamId}_${viewerId}`);
      const streamRef = doc(this.firestore, 'live_streams', streamId);
      
      await runTransaction(this.firestore, async (transaction) => {
        const viewerSnap = await transaction.get(viewerRef);
        const streamSnap = await transaction.get(streamRef);
        
        if (viewerSnap.exists() && streamSnap.exists()) {
          const viewerData = viewerSnap.data();
          const joinedAt = viewerData.joinedAt?.toDate?.() || new Date();
          const watchDuration = Math.floor((Date.now() - joinedAt.getTime()) / 60000);
          
          transaction.update(viewerRef, {
            leftAt: serverTimestamp(),
            watchDuration: (viewerData.watchDuration || 0) + watchDuration,
          });
          
          await countersManager.incrementInTransaction(transaction, { docPath: `live_streams/${streamId}`, field: 'viewerCount', amount: -1 });
          transaction.update(streamRef, {
            updatedAt: serverTimestamp(),
          });
        }
      });
      countersManager.invalidate({ docPath: `live_streams/${streamId}`, field: 'viewerCount' });
    } catch (error) {
      logger.debug('Leave live stream failed', { error: error.message, streamId, viewerId });
    }
  }

  async getLiveViewers(streamId, options = {}) {
    try {
      await this._ensureInitialized();
      const { collection, query, where, orderBy, limit, startAfter, getDocs } = await import('firebase/firestore');
      
      const viewersRef = collection(this.firestore, 'live_viewers');
      let q = query(
        viewersRef,
        where('streamId', '==', streamId),
        where('leftAt', '==', null)
      );
      
      q = query(q, orderBy('joinedAt', 'desc'));
      const pageSize = options.limit || 50;
      q = query(q, limit(pageSize));
      
      if (options.cursor) {
        const { doc: fDoc, getDoc } = await import('firebase/firestore');
        const cursorRef = fDoc(this.firestore, 'live_viewers', options.cursor);
        const cursorSnap = await getDoc(cursorRef);
        if (cursorSnap.exists()) q = query(q, startAfter(cursorSnap));
      }
      
      const snapshot = await getDocs(q);
      const viewers = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        joinedAt: doc.data().joinedAt?.toDate?.()?.toISOString(),
      }));
      const hasMore = snapshot.docs.length === pageSize;
      viewers.nextCursor = hasMore && snapshot.docs.length ? snapshot.docs[snapshot.docs.length - 1].id : null;
      viewers.hasMore = hasMore;
      return viewers;
    } catch (error) {
      logger.error('Get live viewers failed', { error: error.message, streamId });
      return [];
    }
  }

  async sendLiveComment(streamId, userId, comment) {
    try {
      await this._ensureInitialized();
      const { collection, addDoc, serverTimestamp, doc, getDoc } = await import('firebase/firestore');
      
      const userRef = doc(this.firestore, 'users', userId);
      const userSnap = await getDoc(userRef);
      const userData = userSnap.exists() ? userSnap.data() : {};
      
      const commentData = {
        streamId,
        userId,
        displayName: userData.displayName || userData.username || 'Anonymous',
        avatar: userData.photoURL || null,
        content: comment.trim(),
        createdAt: serverTimestamp(),
        isPinned: false,
        isDeleted: false,
      };
      
      const commentsRef = collection(this.firestore, 'live_comments');
      const docRef = await addDoc(commentsRef, commentData);
      
      return {
        id: docRef.id,
        ...commentData,
        createdAt: new Date().toISOString(),
      };
    } catch (error) {
      logger.error('❌ Send live comment failed:', error);
      throw enhanceError(error, 'Failed to send comment');
    }
  }

  async getLiveComments(streamId, options = {}) {
    try {
      await this._ensureInitialized();
      const { collection, query, where, orderBy, limit, startAfter, getDocs } = await import('firebase/firestore');
      
      const commentsRef = collection(this.firestore, 'live_comments');
      let q = query(
        commentsRef,
        where('streamId', '==', streamId),
        where('isDeleted', '==', false)
      );
      
      q = query(q, orderBy('createdAt', 'desc'));
      const pageSize = options.limit || LIVE_CONFIG.COMMENTS_LIMIT;
      q = query(q, limit(pageSize));
      
      if (options.cursor) {
        const { doc: fDoc, getDoc } = await import('firebase/firestore');
        const cursorRef = fDoc(this.firestore, 'live_comments', options.cursor);
        const cursorSnap = await getDoc(cursorRef);
        if (cursorSnap.exists()) q = query(q, startAfter(cursorSnap));
      }
      
      const snapshot = await getDocs(q);
      const comments = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate?.()?.toISOString(),
      })).reverse();
      const hasMore = snapshot.docs.length === pageSize;
      comments.nextCursor = hasMore && snapshot.docs.length ? snapshot.docs[snapshot.docs.length - 1].id : null;
      comments.hasMore = hasMore;
      return comments;
    } catch (error) {
      logger.error('Get live comments failed', { error: error.message, streamId });
      return [];
    }
  }

  async sendLiveGift(streamId, senderId, recipientId, giftType) {
    try {
      await this._ensureInitialized();
      
      const giftConfig = LIVE_CONFIG.GIFT_TYPES.find(g => g.id === giftType);
      if (!giftConfig) {
        throw new Error('Invalid gift type');
      }

      const rl = rateLimiter.checkAndHit(`live:gift:${senderId}`, { max: 30, windowMs: 60000 });
      if (!rl.allowed) {
        throw errorHandler.enhance(new Error('Too many gifts. Please slow down.'), { code: 5001, defaultMessage: 'Too many gifts. Please slow down.' });
      }
      const idemKey = idempotencyStore.generate('live_gift', [streamId, senderId, giftType]);
      if (!idempotencyStore.checkAndRecord(idemKey, 30000)) {
        return { success: true, duplicate: true };
      }
      
      const { collection, addDoc, doc, getDoc, serverTimestamp, runTransaction } = await import('firebase/firestore');
      const streamRef = doc(this.firestore, 'live_streams', streamId);
      const streamSnap = await getDoc(streamRef);
      
      if (!streamSnap.exists() || streamSnap.data().status !== 'live') {
        throw new Error('Stream is not available');
      }
      
      if (!streamSnap.data().monetization?.giftsEnabled) {
        throw new Error('Gifts are disabled for this stream');
      }
      
      const giftsRef = collection(this.firestore, 'live_gifts');
      const giftData = {
        streamId,
        senderId,
        recipientId,
        giftType,
        coinValue: giftConfig.coinValue,
        createdAt: serverTimestamp(),
        idempotencyKey: idemKey,
      };
      
      await addDoc(giftsRef, giftData);
      
      await runTransaction(this.firestore, async (transaction) => {
        const snap = await transaction.get(streamRef);
        const stats = snap.data().stats || {};
        
        transaction.update(streamRef, {
          'stats.totalGifts': (stats.totalGifts || 0) + 1,
          'stats.coinsEarned': (stats.coinsEarned || 0) + giftConfig.coinValue,
          updatedAt: serverTimestamp(),
        });
      });

      try {
        const { getMonetizationService } = await import('./monetizationService.js');
        await getMonetizationService().spendCoins(senderId, giftConfig.coinValue, 'live_gift', {
          streamId, giftType, recipientId,
        });
      } catch (err) {
        logger.warn('Gift coin deduction failed (server will reconcile)', { error: err.message });
      }

      auditLogger.log('monetization.live_gift', {
        userId: senderId,
        meta: { streamId, recipientId, giftType, coinValue: giftConfig.coinValue },
      });
      
      return {
        success: true,
        gift: {
          ...giftData,
          createdAt: new Date().toISOString(),
        },
      };
    } catch (error) {
      if (error?.errorCode) throw error;
      logger.error('Send live gift failed', { error: error.message, streamId, senderId });
      throw enhanceError(error, 'Failed to send gift');
    }
  }

  async sendLiveTip(streamId, senderId, amount) {
    try {
      await this._ensureInitialized();
      if (amount < LIVE_CONFIG.TIPS.MIN || amount > LIVE_CONFIG.TIPS.MAX) {
        throw new Error(`Tip amount must be between ${LIVE_CONFIG.TIPS.MIN} and ${LIVE_CONFIG.TIPS.MAX} coins`);
      }
      
      const { collection, addDoc, doc, getDoc, serverTimestamp, runTransaction } = await import('firebase/firestore');
      const streamRef = doc(this.firestore, 'live_streams', streamId);
      const streamSnap = await getDoc(streamRef);
      
      if (!streamSnap.exists() || streamSnap.data().status !== 'live') {
        throw new Error('Stream is not available');
      }
      
      if (!streamSnap.data().monetization?.tipsEnabled) {
        throw new Error('Tips are disabled for this stream');
      }
      
      const recipientId = streamSnap.data().userId;
      const tipsRef = collection(this.firestore, 'live_tips');
      const tipData = {
        streamId,
        senderId,
        recipientId,
        amount,
        createdAt: serverTimestamp(),
      };
      
      await addDoc(tipsRef, tipData);
      
      await runTransaction(this.firestore, async (transaction) => {
        const snap = await transaction.get(streamRef);
        const stats = snap.data().stats || {};
        
        transaction.update(streamRef, {
          'stats.totalTips': (stats.totalTips || 0) + 1,
          'stats.coinsEarned': (stats.coinsEarned || 0) + amount,
          updatedAt: serverTimestamp(),
        });
      });
      
      return {
        success: true,
        tip: {
          ...tipData,
          createdAt: new Date().toISOString(),
        },
      };
    } catch (error) {
      logger.error('❌ Send live tip failed:', error);
      throw enhanceError(error, 'Failed to send tip');
    }
  }

  async getLiveEarnings(streamId, userId) {
    try {
      await this._ensureInitialized();
      const { doc, getDoc } = await import('firebase/firestore');
      
      const streamRef = doc(this.firestore, 'live_streams', streamId);
      const snap = await getDoc(streamRef);
      
      if (!snap.exists()) {
        throw new Error('Stream not found');
      }
      
      const data = snap.data();
      if (data.userId !== userId) {
        throw new Error('You can only view your own earnings');
      }
      
      return {
        streamId,
        totalGifts: data.stats?.totalGifts || 0,
        totalTips: data.stats?.totalTips || 0,
        coinsEarned: data.stats?.coinsEarned || 0,
        viewerCount: data.viewerCount || 0,
        peakViewers: data.stats?.peakViewers || 0,
        duration: data.duration || 0,
      };
    } catch (error) {
      logger.error('❌ Get live earnings failed:', error);
      throw enhanceError(error, 'Failed to get earnings');
    }
  }

  async getLiveAnalytics(streamId) {
    try {
      await this._ensureInitialized();
      const { doc, getDoc } = await import('firebase/firestore');
      
      const streamRef = doc(this.firestore, 'live_streams', streamId);
      const snap = await getDoc(streamRef);
      
      if (!snap.exists()) {
        return null;
      }
      
      const data = snap.data();
      
      return {
        streamId,
        status: data.status,
        duration: data.duration || 0,
        viewerCount: data.viewerCount || 0,
        peakViewers: data.stats?.peakViewers || 0,
        totalViewers: data.stats?.totalViewers || 0,
        totalGifts: data.stats?.totalGifts || 0,
        totalTips: data.stats?.totalTips || 0,
        coinsEarned: data.stats?.coinsEarned || 0,
        monetization: data.monetization,
      };
    } catch (error) {
      logger.error('❌ Get live analytics failed:', error);
      return null;
    }
  }

  async getUserLiveAnalytics(userId, days = 30) {
    try {
      await this._ensureInitialized();
      const { collection, query, where, getDocs } = await import('firebase/firestore');
      
      const streamsRef = collection(this.firestore, 'live_streams');
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);
      
      const q = query(
        streamsRef,
        where('userId', '==', userId),
        where('status', '==', 'ended'),
        where('createdAt', '>=', startDate)
      );
      
      const snapshot = await getDocs(q);
      const streams = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      }));
      
      const totalStreams = streams.length;
      const totalViewers = streams.reduce((sum, s) => sum + (s.stats?.totalViewers || 0), 0);
      const totalCoins = streams.reduce((sum, s) => sum + (s.stats?.coinsEarned || 0), 0);
      const totalDuration = streams.reduce((sum, s) => sum + (s.duration || 0), 0);
      const totalGifts = streams.reduce((sum, s) => sum + (s.stats?.totalGifts || 0), 0);
      const totalTips = streams.reduce((sum, s) => sum + (s.stats?.totalTips || 0), 0);
      
      return {
        userId,
        period: `${days} days`,
        totalStreams,
        totalViewers,
        totalCoins,
        totalDuration,
        totalGifts,
        totalTips,
        averageViewers: totalStreams > 0 ? Math.round(totalViewers / totalStreams) : 0,
        averageCoins: totalStreams > 0 ? Math.round(totalCoins / totalStreams) : 0,
        averageDuration: totalStreams > 0 ? Math.round(totalDuration / totalStreams) : 0,
      };
    } catch (error) {
      logger.error('❌ Get user live analytics failed:', error);
      return {
        userId,
        period: `${days} days`,
        totalStreams: 0,
        totalViewers: 0,
        totalCoins: 0,
        totalDuration: 0,
        totalGifts: 0,
        totalTips: 0,
        averageViewers: 0,
        averageCoins: 0,
        averageDuration: 0,
      };
    }
  }

  clearCache(streamId = null) {
    if (streamId) {
      this.cache.delete(`stream_${streamId}`);
    } else {
      this.cache.clear();
    }
    this._userLevelCache.clear();
  }

  destroy() {
    for (const [key, unsub] of this._activeStreamListeners) {
      try { unsub(); } catch (e) {}
    }
    for (const [key, unsub] of this._commentListeners) {
      try { unsub(); } catch (e) {}
    }
    for (const [key, unsub] of this._viewerListeners) {
      try { unsub(); } catch (e) {}
    }
    
    this._activeStreamListeners.clear();
    this._commentListeners.clear();
    this._viewerListeners.clear();
    
    this.cache.clear();
    this._userLevelCache.clear();
    
    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }
    if (this.signalingUnsubscribe) {
      this.signalingUnsubscribe();
      this.signalingUnsubscribe = null;
    }

    this.initialized = false;
    this.firestore = null;
    this.auth = null;
  }
}

// ==================== SINGLETON & EXPORTS ====================
let serviceInstance = null;

export function getLiveService() {
  if (!serviceInstance) {
    serviceInstance = new UltimateLiveService();
  }
  return serviceInstance;
}

// Named exports for convenience
export const getLiveConfig = () => getLiveService().getLiveConfig();
export const canStartLive = (userId) => getLiveService().canStartLive(userId);
export const startLiveStream = (userId, streamData) => getLiveService().startLiveStream(userId, streamData);
export const endLiveStream = (streamId, userId) => getLiveService().endLiveStream(streamId, userId);
export const getLiveStream = (streamId) => getLiveService().getLiveStream(streamId);
export const getActiveLiveStreams = (options) => getLiveService().getActiveLiveStreams(options);
export const getLiveHistory = (userId, options) => getLiveService().getLiveHistory(userId, options);
export const joinLiveStream = (streamId, viewerId) => getLiveService().joinLiveStream(streamId, viewerId);
export const leaveLiveStream = (streamId, viewerId) => getLiveService().leaveLiveStream(streamId, viewerId);
export const getLiveViewers = (streamId, options) => getLiveService().getLiveViewers(streamId, options);
export const sendLiveComment = (streamId, userId, comment) => getLiveService().sendLiveComment(streamId, userId, comment);
export const getLiveComments = (streamId, options) => getLiveService().getLiveComments(streamId, options);
export const sendLiveGift = (streamId, senderId, recipientId, giftType) => getLiveService().sendLiveGift(streamId, senderId, recipientId, giftType);
export const sendLiveTip = (streamId, senderId, amount) => getLiveService().sendLiveTip(streamId, senderId, amount);
export const getLiveEarnings = (streamId, userId) => getLiveService().getLiveEarnings(streamId, userId);
export const getLiveAnalytics = (streamId) => getLiveService().getLiveAnalytics(streamId);
export const getUserLiveAnalytics = (userId, days) => getLiveService().getUserLiveAnalytics(userId, days);
export const clearLiveCache = (streamId) => getLiveService().clearCache(streamId);

export default getLiveService;
