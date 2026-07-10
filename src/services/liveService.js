/**
 * src/services/liveService.js - ARVDOUL Ultimate Live Streaming Service
 * 
 * Comprehensive live streaming functionality for creators.
 * Features:
 * - Level-based live streaming (min level 5)
 * - Live stream management (start, end, join, leave)
 * - Real-time comments and viewer tracking
 * - Gifts and tips system
 * - Monetization settings
 * - Analytics and earnings tracking
 * 
 * @author ARVDOUL Engineering Team
 * @version 1.0.0
 */

import { produce } from 'immer';

// ==================== CONFIGURATION ====================
const LIVE_CONFIG = {
  // Level requirements
  MIN_LEVEL_TO_START: 5,
  
  // Viewer limits based on creator level
  VIEWER_LIMITS: {
    5: 50,
    10: 100,
    20: 200,
    30: 500,
    50: 1000,
  },
  
  // Stream settings
  MAX_DURATION_HOURS: 4,
  COOLDOWN_MINUTES: 5,
  MAX_COMMENTS_PER_MINUTE: 60,
  
  // Monetization
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
  
  CACHE_TTL: 60 * 1000, // 1 minute
  COMMENTS_LIMIT: 50,
  VIEWERS_LIMIT: 100,
};

// ==================== LRU CACHE ====================
class LRUCache {
  constructor(maxSize = 50, ttl = LIVE_CONFIG.CACHE_TTL) {
    this.maxSize = maxSize;
    this.ttl = ttl;
    this.cache = new Map();
  }

  get(key) {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (Date.now() - entry.timestamp > this.ttl) {
      this.cache.delete(key);
      return null;
    }
    return entry.value;
  }

  set(key, value) {
    if (this.cache.size >= this.maxSize) {
      const oldestKey = this.cache.keys().next().value;
      this.cache.delete(oldestKey);
    }
    this.cache.set(key, { value, timestamp: Date.now() });
  }

  delete(key) {
    this.cache.delete(key);
  }

  clear() {
    this.cache.clear();
  }
}

// ==================== ERROR HANDLER ====================
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

// ==================== LIVE SERVICE CLASS ====================
class UltimateLiveService {
  constructor() {
    this.firestore = null;
    this.auth = null;
    this.initialized = false;
    this.cache = new LRUCache(50, LIVE_CONFIG.CACHE_TTL);
    this.subscriptions = new Map();
    this._activeStreamListeners = new Map();
    this._commentListeners = new Map();
    this._viewerListeners = new Map();
    this._userLevelCache = new Map();

    this.initialize().catch(err => console.warn('Live service init warning:', err.message));
  }

  // ==================== INITIALIZATION ====================
  async initialize() {
    if (this.initialized && this.firestore) return this.firestore;

    try {
      console.log('🎬 Initializing Live Streaming Service...');
      const firebase = await import('../firebase/firebase.js');
      this.firestore = await firebase.getFirestoreInstance();
      this.auth = await firebase.getAuthInstance();

      const { enableIndexedDbPersistence } = await import('firebase/firestore');
      try {
        await enableIndexedDbPersistence(this.firestore);
        console.log('✅ Live Firestore persistence enabled');
      } catch (e) {
        console.warn('⚠️ Live persistence not available:', e.message);
      }

      this.initialized = true;
      return this.firestore;
    } catch (error) {
      console.error('❌ Live service initialization failed:', error);
      throw enhanceError(error, 'Failed to initialize live streaming service');
    }
  }

  async _ensureInitialized() {
    if (!this.initialized || !this.firestore) await this.initialize();
    return this.firestore;
  }

  // ==================== HELPER FUNCTIONS ====================
  _generateStreamId() {
    return `live_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
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

  // ==================== CONFIGURATION ====================
  /**
   * Get live streaming configuration
   * @returns {Object} Live streaming configuration
   */
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

  // ==================== LEVEL CHECK ====================
  /**
   * Check if user can start a live stream
   * @param {string} userId - User ID
   * @returns {Object} Result with canStart, reason, userLevel
   */
  async canStartLive(userId) {
    try {
      await this._ensureInitialized();
      
      const userLevel = await this._getUserLevel(userId);
      
      // Check level requirement
      if (userLevel < LIVE_CONFIG.MIN_LEVEL_TO_START) {
        return {
          canStart: false,
          reason: `You need to be at least Level ${LIVE_CONFIG.MIN_LEVEL_TO_START} to start a live stream. Current level: ${userLevel}`,
          userLevel,
          requiredLevel: LIVE_CONFIG.MIN_LEVEL_TO_START,
        };
      }

      // Check cooldown (user can only have one active stream at a time)
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

      // Check cooldown from last ended stream
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
      console.error('❌ Check can start live failed:', error);
      return {
        canStart: false,
        reason: 'Failed to check live stream eligibility.',
        userLevel: 1,
      };
    }
  }

  // ==================== STREAM MANAGEMENT ====================
  /**
   * Start a new live stream
   * @param {string} userId - User ID (streamer)
   * @param {Object} streamData - Stream configuration
   * @returns {Object} Created stream data
   */
  async startLiveStream(userId, streamData) {
    try {
      await this._ensureInitialized();
      
      // Verify user can start
      const canStart = await this.canStartLive(userId);
      if (!canStart.canStart) {
        throw new Error(canStart.reason);
      }

      const { doc, setDoc, serverTimestamp, collection, addDoc } = await import('firebase/firestore');
      
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
      
      // Clear user's cached level
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
      console.error('❌ Start live stream failed:', error);
      throw enhanceError(error, 'Failed to start live stream');
    }
  }

  /**
   * End a live stream
   * @param {string} streamId - Stream ID
   * @param {string} userId - User ID (must be streamer)
   * @returns {Object} Updated stream data
   */
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
      
      // Calculate duration
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
      
      // Get final viewer count
      const viewerCount = streamData.viewerCount || 0;
      const peakViewers = streamData.stats?.peakViewers || 0;
      const coinsEarned = streamData.stats?.coinsEarned || 0;
      
      return {
        success: true,
        stream: {
          id: streamId,
          status: 'ended',
          duration: durationMinutes,
          totalViewers: streamData.stats?.totalViewers || 0,
          peakViewers,
          coinsEarned,
        },
      };
    } catch (error) {
      console.error('❌ End live stream failed:', error);
      throw enhanceError(error, 'Failed to end live stream');
    }
  }

  /**
   * Get live stream details
   * @param {string} streamId - Stream ID
   * @returns {Object} Stream data
   */
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
      
      this.cache.set(cacheKey, stream);
      return stream;
    } catch (error) {
      console.error('❌ Get live stream failed:', error);
      throw enhanceError(error, 'Failed to get live stream');
    }
  }

  /**
   * Get active live streams
   * @param {Object} options - Query options
   * @returns {Array} List of active streams
   */
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
      console.error('❌ Get active live streams failed:', error);
      return [];
    }
  }

  /**
   * Get user's live stream history
   * @param {string} userId - User ID
   * @param {Object} options - Query options
   * @returns {Array} List of user's past streams
   */
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
      console.error('❌ Get live history failed:', error);
      return [];
    }
  }

  // ==================== VIEWER MANAGEMENT ====================
  /**
   * Join a live stream
   * @param {string} streamId - Stream ID
   * @param {string} viewerId - Viewer user ID
   * @returns {Object} Viewer data
   */
  async joinLiveStream(streamId, viewerId) {
    try {
      await this._ensureInitialized();
      
      const { doc, setDoc, getDoc, updateDoc, serverTimestamp, runTransaction } = await import('firebase/firestore');
      
      // Check if stream exists and is live
      const streamRef = doc(this.firestore, 'live_streams', streamId);
      const streamSnap = await getDoc(streamRef);
      
      if (!streamSnap.exists() || streamSnap.data().status !== 'live') {
        throw new Error('Stream is not available');
      }
      
      // Create/update viewer record
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
        
        // Increment viewer count
        transaction.update(streamRef, {
          viewerCount: (streamSnap.data().viewerCount || 0) + 1,
          'stats.totalViewers': ((streamSnap.data().stats?.totalViewers) || 0) + 1,
          updatedAt: serverTimestamp(),
        });
      });
      
      return { success: true };
    } catch (error) {
      console.error('❌ Join live stream failed:', error);
      throw enhanceError(error, 'Failed to join live stream');
    }
  }

  /**
   * Leave a live stream
   * @param {string} streamId - Stream ID
   * @param {string} viewerId - Viewer user ID
   */
  async leaveLiveStream(streamId, viewerId) {
    try {
      await this._ensureInitialized();
      
      const { doc, updateDoc, getDoc, serverTimestamp, runTransaction } = await import('firebase/firestore');
      
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
          
          // Decrement viewer count
          transaction.update(streamRef, {
            viewerCount: Math.max(0, (streamSnap.data().viewerCount || 1) - 1),
            updatedAt: serverTimestamp(),
          });
        }
      });
    } catch (error) {
      console.warn('⚠️ Leave live stream failed:', error);
    }
  }

  /**
   * Get live stream viewers
   * @param {string} streamId - Stream ID
   * @param {Object} options - Query options
   * @returns {Array} List of viewers
   */
  async getLiveViewers(streamId, options = {}) {
    try {
      await this._ensureInitialized();
      
      const { collection, query, where, orderBy, limit, getDocs } = await import('firebase/firestore');
      
      const viewersRef = collection(this.firestore, 'live_viewers');
      let q = query(
        viewersRef,
        where('streamId', '==', streamId),
        where('leftAt', '==', null)
      );
      
      q = query(q, orderBy('joinedAt', 'desc'));
      
      if (options.limit) {
        q = query(q, limit(options.limit));
      }
      
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        joinedAt: doc.data().joinedAt?.toDate?.()?.toISOString(),
      }));
    } catch (error) {
      console.error('❌ Get live viewers failed:', error);
      return [];
    }
  }

  // ==================== COMMENTS ====================
  /**
   * Send a live comment
   * @param {string} streamId - Stream ID
   * @param {string} userId - User ID
   * @param {string} comment - Comment text
   * @returns {Object} Created comment
   */
  async sendLiveComment(streamId, userId, comment) {
    try {
      await this._ensureInitialized();
      
      const { collection, addDoc, serverTimestamp, doc, getDoc } = await import('firebase/firestore');
      
      // Get user info
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
      console.error('❌ Send live comment failed:', error);
      throw enhanceError(error, 'Failed to send comment');
    }
  }

  /**
   * Get live stream comments
   * @param {string} streamId - Stream ID
   * @param {Object} options - Query options
   * @returns {Array} List of comments
   */
  async getLiveComments(streamId, options = {}) {
    try {
      await this._ensureInitialized();
      
      const { collection, query, where, orderBy, limit, getDocs } = await import('firebase/firestore');
      
      const commentsRef = collection(this.firestore, 'live_comments');
      let q = query(
        commentsRef,
        where('streamId', '==', streamId),
        where('isDeleted', '==', false)
      );
      
      q = query(q, orderBy('createdAt', 'desc'));
      
      if (options.limit) {
        q = query(q, limit(options.limit));
      } else {
        q = query(q, limit(LIVE_CONFIG.COMMENTS_LIMIT));
      }
      
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate?.()?.toISOString(),
      })).reverse();
    } catch (error) {
      console.error('❌ Get live comments failed:', error);
      return [];
    }
  }

  // ==================== GIFTS & TIPS ====================
  /**
   * Send a gift during live stream
   * @param {string} streamId - Stream ID
   * @param {string} senderId - Sender user ID
   * @param {string} recipientId - Recipient user ID (streamer)
   * @param {string} giftType - Gift type ID
   * @returns {Object} Gift result
   */
  async sendLiveGift(streamId, senderId, recipientId, giftType) {
    try {
      await this._ensureInitialized();
      
      const giftConfig = LIVE_CONFIG.GIFT_TYPES.find(g => g.id === giftType);
      if (!giftConfig) {
        throw new Error('Invalid gift type');
      }
      
      const { collection, addDoc, doc, getDoc, updateDoc, serverTimestamp, runTransaction } = await import('firebase/firestore');
      
      // Get stream info
      const streamRef = doc(this.firestore, 'live_streams', streamId);
      const streamSnap = await getDoc(streamRef);
      
      if (!streamSnap.exists() || streamSnap.data().status !== 'live') {
        throw new Error('Stream is not available');
      }
      
      if (!streamSnap.data().monetization?.giftsEnabled) {
        throw new Error('Gifts are disabled for this stream');
      }
      
      // Create gift record
      const giftsRef = collection(this.firestore, 'live_gifts');
      const giftData = {
        streamId,
        senderId,
        recipientId,
        giftType,
        coinValue: giftConfig.coinValue,
        createdAt: serverTimestamp(),
      };
      
      await addDoc(giftsRef, giftData);
      
      // Update stream stats
      await runTransaction(this.firestore, async (transaction) => {
        const snap = await transaction.get(streamRef);
        const stats = snap.data().stats || {};
        
        transaction.update(streamRef, {
          'stats.totalGifts': (stats.totalGifts || 0) + 1,
          'stats.coinsEarned': (stats.coinsEarned || 0) + giftConfig.coinValue,
          updatedAt: serverTimestamp(),
        });
      });
      
      return {
        success: true,
        gift: {
          ...giftData,
          createdAt: new Date().toISOString(),
        },
      };
    } catch (error) {
      console.error('❌ Send live gift failed:', error);
      throw enhanceError(error, 'Failed to send gift');
    }
  }

  /**
   * Send a tip during live stream
   * @param {string} streamId - Stream ID
   * @param {string} senderId - Sender user ID
   * @param {number} amount - Tip amount in coins
   * @returns {Object} Tip result
   */
  async sendLiveTip(streamId, senderId, amount) {
    try {
      await this._ensureInitialized();
      
      // Validate amount
      if (amount < LIVE_CONFIG.TIPS.MIN || amount > LIVE_CONFIG.TIPS.MAX) {
        throw new Error(`Tip amount must be between ${LIVE_CONFIG.TIPS.MIN} and ${LIVE_CONFIG.TIPS.MAX} coins`);
      }
      
      const { collection, addDoc, doc, getDoc, serverTimestamp, runTransaction } = await import('firebase/firestore');
      
      // Get stream info
      const streamRef = doc(this.firestore, 'live_streams', streamId);
      const streamSnap = await getDoc(streamRef);
      
      if (!streamSnap.exists() || streamSnap.data().status !== 'live') {
        throw new Error('Stream is not available');
      }
      
      if (!streamSnap.data().monetization?.tipsEnabled) {
        throw new Error('Tips are disabled for this stream');
      }
      
      const recipientId = streamSnap.data().userId;
      
      // Create tip record
      const tipsRef = collection(this.firestore, 'live_tips');
      const tipData = {
        streamId,
        senderId,
        recipientId,
        amount,
        createdAt: serverTimestamp(),
      };
      
      await addDoc(tipsRef, tipData);
      
      // Update stream stats
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
      console.error('❌ Send live tip failed:', error);
      throw enhanceError(error, 'Failed to send tip');
    }
  }

  // ==================== ANALYTICS ====================
  /**
   * Get live stream earnings
   * @param {string} streamId - Stream ID
   * @param {string} userId - User ID
   * @returns {Object} Earnings data
   */
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
      
      // Verify user is the streamer
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
      console.error('❌ Get live earnings failed:', error);
      throw enhanceError(error, 'Failed to get earnings');
    }
  }

  /**
   * Get analytics for a specific stream
   * @param {string} streamId - Stream ID
   * @returns {Object} Stream analytics
   */
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
      console.error('❌ Get live analytics failed:', error);
      return null;
    }
  }

  /**
   * Get user's live streaming analytics
   * @param {string} userId - User ID
   * @param {number} days - Number of days to analyze
   * @returns {Object} User's live analytics summary
   */
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
      console.error('❌ Get user live analytics failed:', error);
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

  // ==================== CACHE MANAGEMENT ====================
  clearCache(streamId = null) {
    if (streamId) {
      this.cache.delete(`stream_${streamId}`);
    } else {
      this.cache.clear();
    }
    this._userLevelCache.clear();
  }

  // ==================== CLEANUP ====================
  destroy() {
    // Unsubscribe all listeners
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
    
    this.initialized = false;
    this.firestore = null;
    this.auth = null;
    
    console.log('🎬 Live streaming service destroyed');
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
