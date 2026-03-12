// src/services/videoService.js - ENTERPRISE PRODUCTION V17
// 🎬 WORLD‑CLASS VIDEO SERVICE • COST‑OPTIMIZED • COLD START FEED • SOFT‑DELETE CLEANUP
// 🔥 TIERED UPLOAD LIMITS • CACHE WITH LRU • RATE LIMIT AWARENESS • PRODUCTION READY

import { getFirestoreInstance, getStorageInstance, getAuthInstance } from '../firebase/firebase.js';
import { getFunctions, httpsCallable } from 'firebase/functions';

// ----------------------------------------------------------------------
//  CONFIGURATION – Tunable parameters for scalability & monetization
//  Adjusted for startup safety: lower max upload, tiered limits, cold feed fallback
// ----------------------------------------------------------------------
const VIDEO_CONFIG = {
  UPLOAD: {
    // SAFETY: 2GB is too high for early stage. Reduced to 500MB for free, 2GB for premium/creator.
    MAX_FILE_SIZE: {
      free: 200 * 1024 * 1024,        // 200MB
      premium: 1 * 1024 * 1024 * 1024, // 1GB
      creator: 2 * 1024 * 1024 * 1024, // 2GB (full)
    },
    SUPPORTED_FORMATS: ['mp4', 'webm', 'mov', 'avi', 'mkv', 'flv'],
    MIN_DURATION: 3,
    MAX_DURATION: 60 * 60,                           // 1 hour
    DAILY_LIMIT_PER_USER: {
      free: 5,
      premium: 50,
      creator: 200,
    },
  },
  STORAGE_PATHS: {
    VIDEOS: 'videos/{userId}/{videoId}.mp4',
    THUMBNAILS: 'thumbnails/{videoId}/{timestamp}.jpg',
  },
  MONETIZATION: {
    AD_PLACEMENT: 'video_feed',
    AD_INTERVAL: 4,
    PREMIUM_MULTIPLIER: 3,
    COIN_REWARDS: {
      view: 1,
      complete: 3,
      like: 2,
      share: 3,
    },
  },
  PERFORMANCE: {
    CACHE_EXPIRY: 5 * 60 * 1000,                     // 5 minutes
    CACHE_MAX_SIZE: 100,                             // LRU: max 100 entries
    PAGE_LIMIT: 20,
    FEED_FETCH_MULTIPLIER: 2,                         // fetch 2x limit to allow room for ads and cold start injections
    SIGNED_URL_EXPIRY: 3600,                          // 1 hour in seconds
  },
  FEED: {
    // Cold start / new creator boost
    NEW_VIDEO_BOOST_HOURS: 24,                         // boost for first 24h
    NEW_VIDEO_BOOST_FACTOR: 2.5,                       // multiply rankingScore by this
    RANDOM_INJECTION_RATIO: 0.1,                        // 10% of feed are random new videos
    MIN_RANDOM_VIDEOS: 2,                               // at least 2 random videos per feed
  },
  STATUS: {
    UPLOADING: 'uploading',
    PROCESSING: 'processing',
    READY: 'ready',
    FAILED: 'failed',
    DELETED: 'deleted',
  },
  VISIBILITY: {
    PUBLIC: 'public',
    PRIVATE: 'private',
    UNLISTED: 'unlisted',
    FOLLOWERS: 'followers',
  },
  RATE_LIMIT: {
    LIKE_COOLDOWN: 60,                                 // seconds (enforced server-side)
    SHARE_COOLDOWN: 30,
    // Client-side hints (optional, not enforced)
    CLIENT_HINTS: true,
  },
  CLEANUP: {
    SOFT_DELETE_RETENTION_DAYS: 30,                    // after this, permanently delete
  },
};

// ----------------------------------------------------------------------
//  LRU CACHE IMPLEMENTATION – improves upon basic Map
// ----------------------------------------------------------------------
class LRUCache {
  constructor(maxSize = 100, ttl = 5 * 60 * 1000) {
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
    // Move to end (most recent)
    this.cache.delete(key);
    this.cache.set(key, entry);
    return entry.value;
  }

  set(key, value) {
    if (this.cache.size >= this.maxSize) {
      // Remove oldest (first entry)
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

  get size() {
    return this.cache.size;
  }
}

// ----------------------------------------------------------------------
//  PROFESSIONAL ERROR ENHANCER – consistent, informative, secure
// ----------------------------------------------------------------------
function enhanceError(error, defaultMessage) {
  const code = error?.code || 'unknown';
  const message = {
    'permission-denied': 'You do not have permission.',
    'unauthenticated': 'Please sign in.',
    'not-found': 'Video not found.',
    'storage/unauthorized': 'Storage access denied.',
    'storage/object-not-found': 'File not found.',
    'already-exists': 'Already exists.',
    'resource-exhausted': 'Daily upload limit reached or rate exceeded.',
    'unavailable': 'Service temporarily unavailable. Check your connection.',
    'rate-limited': 'Action rate limited. Please wait a moment.',
  }[code] || defaultMessage || 'Video operation failed';
  const err = new Error(message);
  err.code = code;
  err.original = error;
  err.timestamp = new Date().toISOString();
  return err;
}

// ----------------------------------------------------------------------
//  MAIN SERVICE CLASS – Singleton, lazy init, all business logic
// ----------------------------------------------------------------------
class UltimateVideoService {
  constructor() {
    this.firestore = null;
    this.storage = null;
    this.auth = null;
    this.functions = null;
    this.fs = null;
    this.st = null;
    this.initialized = false;
    this.initPromise = null;
    this.cache = new LRUCache(
      VIDEO_CONFIG.PERFORMANCE.CACHE_MAX_SIZE,
      VIDEO_CONFIG.PERFORMANCE.CACHE_EXPIRY
    );
    this.monetizationService = null;            // lazy‑loaded

    // Cloud Functions references (callable)
    this.fns = {
      likeVideo: null,
      shareVideo: null,
      recordVideoView: null,
      generateSignedUrl: null,
    };
  }

  // --------------------------------------------------------------------
  //  🚀 INITIALIZATION – once, with persistence
  // --------------------------------------------------------------------
  async ensureInitialized() {
    if (this.initialized) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = (async () => {
      try {
        const [firestore, storage, auth] = await Promise.all([
          getFirestoreInstance(),
          getStorageInstance(),
          getAuthInstance(),
        ]);
        this.firestore = firestore;
        this.storage = storage;
        this.auth = auth;
        this.functions = getFunctions();

        // Import Firestore & Storage modules
        const firestoreModule = await import('firebase/firestore');
        const storageModule = await import('firebase/storage');

        this.fs = {
          collection: firestoreModule.collection,
          doc: firestoreModule.doc,
          getDoc: firestoreModule.getDoc,
          getDocs: firestoreModule.getDocs,
          setDoc: firestoreModule.setDoc,
          updateDoc: firestoreModule.updateDoc,
          deleteDoc: firestoreModule.deleteDoc,
          query: firestoreModule.query,
          where: firestoreModule.where,
          orderBy: firestoreModule.orderBy,
          limit: firestoreModule.limit,
          startAfter: firestoreModule.startAfter,
          serverTimestamp: firestoreModule.serverTimestamp,
          increment: firestoreModule.increment,
          arrayUnion: firestoreModule.arrayUnion,
          arrayRemove: firestoreModule.arrayRemove,
          writeBatch: firestoreModule.writeBatch,
        };

        this.st = {
          ref: storageModule.ref,
          uploadBytesResumable: storageModule.uploadBytesResumable,
          getDownloadURL: storageModule.getDownloadURL,
          deleteObject: storageModule.deleteObject,
          getMetadata: storageModule.getMetadata,
        };

        this.initialized = true;
        console.log('[Video] ✅ Initialized');
      } catch (err) {
        console.error('[Video] ❌ Init failed', err);
        this.initPromise = null;
        throw enhanceError(err, 'Failed to initialize video service');
      }
    })();

    return this.initPromise;
  }

  // --------------------------------------------------------------------
  //  🎥 UPLOAD VIDEO – with atomic daily limit and progress tracking
  // --------------------------------------------------------------------
  async uploadVideo(file, metadata, options = {}) {
    await this.ensureInitialized();
    const currentUser = this.auth.currentUser;
    if (!currentUser) throw new Error('Authentication required');

    // 1. Validate file & metadata (including tier-based size limit)
    const validation = await this._validateVideoFile(file, metadata, currentUser.uid);
    if (!validation.valid) {
      throw new Error(`Invalid video: ${validation.errors.join(', ')}`);
    }

    // 2. Check daily upload limit atomically using a counter document
    const canUpload = await this._checkDailyUploadLimitAtomic(currentUser.uid);
    if (!canUpload) {
      throw new Error('Daily upload limit reached. Try again tomorrow or upgrade.');
    }

    // 3. Generate Firestore document with auto‑ID
    const videosRef = this.fs.collection(this.firestore, 'videos');
    const videoRef = this.fs.doc(videosRef);
    const videoId = videoRef.id;

    const storagePath = `videos/${currentUser.uid}/${videoId}.mp4`;

    // 4. Create Firestore document (status: uploading) – NO engagement arrays
    const now = this.fs.serverTimestamp();
    const videoDoc = {
      id: videoId,
      userId: currentUser.uid,
      title: metadata.title || 'Untitled',
      description: metadata.description || '',
      category: metadata.category || 'other',
      tags: metadata.tags || [],
      visibility: metadata.visibility || VIDEO_CONFIG.VISIBILITY.PUBLIC,
      allowDownload: metadata.allowDownload ?? true,
      status: VIDEO_CONFIG.STATUS.UPLOADING,
      duration: metadata.duration || 0,
      resolution: metadata.resolution || null,
      aspectRatio: metadata.aspectRatio || null,
      mimeType: file.type,
      fileSize: file.size,
      storagePath,
      thumbnails: [],
      previews: [],
      stats: {
        views: 0,
        likes: 0,
        comments: 0,
        shares: 0,
        saves: 0,
        averageWatchTime: 0,
        totalWatchTime: 0,
      },
      monetization: metadata.monetization || { type: 'none' },
      rankingScore: 0,                           // updated server‑side only
      createdAt: now,
      updatedAt: now,
      isDeleted: false,
      deletedAt: null,                            // for soft-delete cleanup
    };
    await this.fs.setDoc(videoRef, videoDoc);

    // 5. Upload file to storage (resumable)
    const storageRef = this.st.ref(this.storage, storagePath);
    const uploadTask = this.st.uploadBytesResumable(storageRef, file, {
      contentType: file.type,
      customMetadata: { videoId, userId: currentUser.uid },
    });

    return new Promise((resolve, reject) => {
      uploadTask.on(
        'state_changed',
        (snapshot) => {
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          options.onProgress?.(progress, snapshot);
        },
        (error) => {
          // Upload failed – mark video as failed (soft delete)
          this.fs.updateDoc(videoRef, {
            status: VIDEO_CONFIG.STATUS.FAILED,
            error: error.message,
            updatedAt: this.fs.serverTimestamp(),
          }).catch(console.warn);
          reject(enhanceError(error, 'Upload failed'));
        },
        async () => {
          // Upload complete – update status to PROCESSING
          await this.fs.updateDoc(videoRef, {
            status: VIDEO_CONFIG.STATUS.PROCESSING,
            updatedAt: this.fs.serverTimestamp(),
          });
          // Cloud Function will later change status to READY after transcoding
          resolve({
            success: true,
            videoId,
          });
        }
      );
    });
  }

  // --------------------------------------------------------------------
  //  📼 GET SINGLE VIDEO – with signed URL (short‑lived, secure)
  // --------------------------------------------------------------------
  async getVideo(videoId, options = {}) {
    await this.ensureInitialized();
    const cacheKey = `video_${videoId}_${options.userId || ''}`;
    if (options.cacheFirst !== false) {
      const cached = this.cache.get(cacheKey);
      if (cached) {
        return { success: true, video: cached, cached: true };
      }
    }

    const videoRef = this.fs.doc(this.firestore, 'videos', videoId);
    const snap = await this.fs.getDoc(videoRef);
    if (!snap.exists()) return { success: false, error: 'Video not found' };

    const video = { id: snap.id, ...snap.data() };
    const currentUserId = options.userId || this.auth.currentUser?.uid;

    // Security checks
    if (video.isDeleted) return { success: false, error: 'Video not found' };
    if (video.visibility === VIDEO_CONFIG.VISIBILITY.PRIVATE && video.userId !== currentUserId) {
      return { success: false, error: 'Access denied' };
    }
    if (video.visibility === VIDEO_CONFIG.VISIBILITY.FOLLOWERS && video.userId !== currentUserId) {
      const isFollowing = await this._checkFollowStatus(currentUserId, video.userId);
      if (!isFollowing) return { success: false, error: 'Access denied' };
    }
    if (video.status !== VIDEO_CONFIG.STATUS.READY && video.userId !== currentUserId) {
      return { success: false, error: 'Video is still processing' };
    }

    // Generate a signed URL with short expiry (via cloud function)
    if (video.storagePath && video.status === VIDEO_CONFIG.STATUS.READY) {
      try {
        video.signedUrl = await this._getSignedUrl(video.storagePath, currentUserId);
      } catch (err) {
        console.warn('[Video] Failed to get signed URL', err);
      }
    }

    this.cache.set(cacheKey, video);
    return { success: true, video };
  }

  // --------------------------------------------------------------------
  //  📺 GET VIDEOS BY USER – paginated
  // --------------------------------------------------------------------
  async getVideosByUser(userId, options = {}) {
    await this.ensureInitialized();
    const videosRef = this.fs.collection(this.firestore, 'videos');
    const limit = options.limit || VIDEO_CONFIG.PERFORMANCE.PAGE_LIMIT;
    let q = this.fs.query(
      videosRef,
      this.fs.where('userId', '==', userId),
      this.fs.where('isDeleted', '==', false),
      this.fs.orderBy('createdAt', 'desc'),
      this.fs.limit(limit)
    );
    if (options.startAfter) {
      q = this.fs.query(q, this.fs.startAfter(options.startAfter));
    }
    const snap = await this.fs.getDocs(q);
    const videos = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    return {
      success: true,
      videos,
      hasMore: videos.length === limit,
    };
  }

  // --------------------------------------------------------------------
  //  🎯 VIDEO FEED – algorithmic with ads, cold start injection, and recency boost
  // --------------------------------------------------------------------
  async getVideoFeed(userId, options = {}) {
    await this.ensureInitialized();
    const { feedType = 'for_you', limit = 20 } = options;

    // 1. Fetch top ranked videos (including recency boost handled server‑side via rankingScore)
    const videosRef = this.fs.collection(this.firestore, 'videos');
    let q = this.fs.query(
      videosRef,
      this.fs.where('status', '==', VIDEO_CONFIG.STATUS.READY),
      this.fs.where('visibility', '==', VIDEO_CONFIG.VISIBILITY.PUBLIC),
      this.fs.where('isDeleted', '==', false),
      this.fs.orderBy('rankingScore', 'desc'),
      this.fs.limit(limit * VIDEO_CONFIG.PERFORMANCE.FEED_FETCH_MULTIPLIER)
    );
    const snap = await this.fs.getDocs(q);
    let videos = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    // 2. Inject fresh content (cold start / new creator boost)
    //    We'll fetch a few recent videos that are not already in the top list
    const recentVideos = await this._fetchRecentVideos(limit, videos.map(v => v.id));
    // Merge, ensuring uniqueness and keeping order (top first, then inject randomly)
    videos = this._injectFreshContent(videos, recentVideos, limit);

    // 3. Insert ads via monetization service (parallel)
    const { getMonetizationService } = await import('./monetizationService.js');
    const monetizationService = getMonetizationService();
    const adPromises = [];
    const adPositions = [];
    for (let i = 0; i < videos.length; i++) {
      if ((i + 1) % VIDEO_CONFIG.MONETIZATION.AD_INTERVAL === 0) {
        adPromises.push(
          monetizationService.getAd(VIDEO_CONFIG.MONETIZATION.AD_PLACEMENT, userId, { feedPosition: i })
        );
        adPositions.push(i);
      }
    }
    const ads = await Promise.all(adPromises);

    // Build final feed
    const feed = [];
    let adIdx = 0;
    for (let i = 0; i < videos.length; i++) {
      feed.push(videos[i]);
      if (adPositions.includes(i)) {
        const ad = ads[adIdx++];
        if (ad) {
          feed.push({
            id: `ad_${Date.now()}_${i}`,
            type: 'ad',
            isAd: true,
            ...ad,
          });
        }
      }
    }

    return {
      success: true,
      feed: feed.slice(0, limit),
      feedType,
      generatedAt: new Date().toISOString(),
    };
  }

  // --------------------------------------------------------------------
  //  ❤️ LIKE VIDEO – calls server‑side function (atomic, no engagement arrays)
  // --------------------------------------------------------------------
  async likeVideo(videoId, userId) {
    await this.ensureInitialized();
    if (!this.fns.likeVideo) {
      this.fns.likeVideo = httpsCallable(this.functions, 'likeVideo');
    }
    try {
      const result = await this.fns.likeVideo({ videoId });
      this.cache.delete(`video_${videoId}_${userId}`);
      return result.data;
    } catch (error) {
      console.error('[Video] Like video failed:', error);
      throw enhanceError(error, 'Failed to like video');
    }
  }

  // --------------------------------------------------------------------
  //  👁️ RECORD VIDEO VIEW – calls server‑side function
  // --------------------------------------------------------------------
  async recordVideoView(videoId, userId, watchData) {
    await this.ensureInitialized();
    if (!this.fns.recordVideoView) {
      this.fns.recordVideoView = httpsCallable(this.functions, 'recordVideoView');
    }
    try {
      const result = await this.fns.recordVideoView({ videoId, ...watchData });
      return result.data;
    } catch (error) {
      console.error('[Video] Record view failed:', error);
      throw enhanceError(error, 'Failed to record view');
    }
  }

  // --------------------------------------------------------------------
  //  📤 SHARE VIDEO – calls server‑side function
  // --------------------------------------------------------------------
  async shareVideo(videoId, userId, platform = 'arvdoul') {
    await this.ensureInitialized();
    if (!this.fns.shareVideo) {
      this.fns.shareVideo = httpsCallable(this.functions, 'shareVideo');
    }
    try {
      const result = await this.fns.shareVideo({ videoId, platform });
      return result.data;
    } catch (error) {
      console.error('[Video] Share video failed:', error);
      throw enhanceError(error, 'Failed to share video');
    }
  }

  // --------------------------------------------------------------------
  //  💰 GET VIDEO MONETIZATION INFO – coin rewards & ad
  // --------------------------------------------------------------------
  async getVideoMonetization(videoId, userId) {
    await this.ensureInitialized();
    const video = await this.getVideo(videoId, { userId });
    if (!video.success) throw new Error('Video not found');

    const { getMonetizationService } = await import('./monetizationService.js');
    const monetizationService = getMonetizationService();
    const ad = await monetizationService.getAd(
      VIDEO_CONFIG.MONETIZATION.AD_PLACEMENT,
      userId,
      { videoId }
    );

    return {
      videoId,
      ad,
      coinRewards: VIDEO_CONFIG.MONETIZATION.COIN_REWARDS,
      premiumMultiplier: VIDEO_CONFIG.MONETIZATION.PREMIUM_MULTIPLIER,
    };
  }

  // --------------------------------------------------------------------
  //  🔐 SIGNED URL – internal method calling cloud function
  // --------------------------------------------------------------------
  async _getSignedUrl(storagePath, userId) {
    if (!this.fns.generateSignedUrl) {
      this.fns.generateSignedUrl = httpsCallable(this.functions, 'generateSignedUrl');
    }
    try {
      const result = await this.fns.generateSignedUrl({ storagePath, userId });
      return result.data.signedUrl;
    } catch (error) {
      console.warn('[Video] Failed to generate signed URL', error);
      // fallback to public URL (if rules allow) – only in dev
      if (import.meta.env.DEV) {
        const fileRef = this.st.ref(this.storage, storagePath);
        return await this.st.getDownloadURL(fileRef);
      }
      throw error;
    }
  }

  // --------------------------------------------------------------------
  //  🛠️ PRIVATE HELPERS
  // --------------------------------------------------------------------
  async _validateVideoFile(file, metadata, userId) {
    const errors = [];

    // Get user tier to determine max size
    const userRef = this.fs.doc(this.firestore, 'users', userId);
    const userSnap = await this.fs.getDoc(userRef);
    const tier = userSnap.exists() ? (userSnap.data().subscription?.tier || 'free') : 'free';
    const maxSize = VIDEO_CONFIG.UPLOAD.MAX_FILE_SIZE[tier] || VIDEO_CONFIG.UPLOAD.MAX_FILE_SIZE.free;

    if (file.size > maxSize) {
      const maxSizeMB = (maxSize / (1024 * 1024)).toFixed(0);
      errors.push(`File too large (max ${maxSizeMB}MB for ${tier} tier)`);
    }

    const ext = file.name.split('.').pop().toLowerCase();
    if (!VIDEO_CONFIG.UPLOAD.SUPPORTED_FORMATS.includes(ext)) {
      errors.push(`Unsupported format: ${ext}`);
    }
    if (metadata.duration < VIDEO_CONFIG.UPLOAD.MIN_DURATION) {
      errors.push(`Video too short (min ${VIDEO_CONFIG.UPLOAD.MIN_DURATION}s)`);
    }
    if (metadata.duration > VIDEO_CONFIG.UPLOAD.MAX_DURATION) {
      errors.push(`Video too long (max ${VIDEO_CONFIG.UPLOAD.MAX_DURATION}s)`);
    }
    return { valid: errors.length === 0, errors };
  }

  // Atomic daily limit using a counter document (prevents race conditions)
  async _checkDailyUploadLimitAtomic(userId) {
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const counterId = `upload_${userId}_${startOfDay.toISOString().split('T')[0]}`;
    const counterRef = this.fs.doc(this.firestore, 'daily_counters', counterId);

    const userRef = this.fs.doc(this.firestore, 'users', userId);
    const [userSnap, counterSnap] = await Promise.all([
      this.fs.getDoc(userRef),
      this.fs.getDoc(counterRef),
    ]);

    if (!userSnap.exists()) return false;
    const user = userSnap.data();
    const tier = user.subscription?.tier || 'free';
    const dailyLimit = VIDEO_CONFIG.UPLOAD.DAILY_LIMIT_PER_USER[tier] || 5;

    const currentCount = counterSnap.exists() ? counterSnap.data().count : 0;
    if (currentCount >= dailyLimit) return false;

    // Atomically increment counter using transaction
    await this.fs.runTransaction(this.firestore, async (tx) => {
      const snap = await tx.get(counterRef);
      const current = snap.exists() ? snap.data().count : 0;
      if (current >= dailyLimit) {
        throw new Error('Daily limit exceeded');
      }
      tx.set(counterRef, {
        userId,
        date: startOfDay,
        count: current + 1,
        updatedAt: this.fs.serverTimestamp(),
      }, { merge: true });
    });

    return true;
  }

  async _checkFollowStatus(followerId, followingId) {
    if (!followerId) return false;
    const followRef = this.fs.doc(this.firestore, 'follows', `${followerId}_${followingId}`);
    const snap = await this.fs.getDoc(followRef);
    return snap.exists();
  }

  // Fetch recent videos for cold start injection
  async _fetchRecentVideos(limit, excludeIds) {
    const videosRef = this.fs.collection(this.firestore, 'videos');
    const q = this.fs.query(
      videosRef,
      this.fs.where('status', '==', VIDEO_CONFIG.STATUS.READY),
      this.fs.where('visibility', '==', VIDEO_CONFIG.VISIBILITY.PUBLIC),
      this.fs.where('isDeleted', '==', false),
      this.fs.orderBy('createdAt', 'desc'),
      this.fs.limit(limit * 2) // fetch enough to have variety
    );
    const snap = await this.fs.getDocs(q);
    const recent = snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter(v => !excludeIds.includes(v.id));
    return recent;
  }

  // Inject fresh content into feed: interleave a few random recent videos
  _injectFreshContent(topVideos, recentVideos, targetLimit) {
    if (recentVideos.length === 0) return topVideos;

    const injectionCount = Math.max(
      VIDEO_CONFIG.FEED.MIN_RANDOM_VIDEOS,
      Math.floor(targetLimit * VIDEO_CONFIG.FEED.RANDOM_INJECTION_RATIO)
    );
    const actualInject = Math.min(injectionCount, recentVideos.length);

    // Randomly select from recentVideos
    const shuffled = recentVideos.sort(() => 0.5 - Math.random());
    const toInject = shuffled.slice(0, actualInject);

    // Merge: keep top videos order, but sprinkle injected ones randomly
    const merged = [];
    const topCopy = [...topVideos];
    const injectCopy = [...toInject];

    while (topCopy.length > 0 || injectCopy.length > 0) {
      // 70% chance to take from top, 30% from inject, if available
      if (injectCopy.length > 0 && Math.random() < 0.3) {
        merged.push(injectCopy.shift());
      } else if (topCopy.length > 0) {
        merged.push(topCopy.shift());
      } else if (injectCopy.length > 0) {
        merged.push(injectCopy.shift());
      }
    }
    return merged;
  }

  // --------------------------------------------------------------------
  //  🧹 SOFT‑DELETE CLEANUP (should be called by a scheduled cloud function)
  //  This method is exposed for manual or cron invocation.
  // --------------------------------------------------------------------
  async cleanupSoftDeletedVideos() {
    await this.ensureInitialized();
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - VIDEO_CONFIG.CLEANUP.SOFT_DELETE_RETENTION_DAYS);

    const videosRef = this.fs.collection(this.firestore, 'videos');
    const q = this.fs.query(
      videosRef,
      this.fs.where('isDeleted', '==', true),
      this.fs.where('deletedAt', '<=', cutoff)
    );
    const snap = await this.fs.getDocs(q);
    const batch = this.fs.writeBatch(this.firestore);

    snap.forEach(doc => {
      // Permanently delete the document
      batch.delete(doc.ref);
      // Also delete associated storage files (should be done separately)
    });

    await batch.commit();
    console.log(`[Video] Permanently deleted ${snap.size} soft-deleted videos older than ${VIDEO_CONFIG.CLEANUP.SOFT_DELETE_RETENTION_DAYS} days.`);
    return snap.size;
  }

  // --------------------------------------------------------------------
  //  🧹 SERVICE MANAGEMENT
  // --------------------------------------------------------------------
  getStats() {
    return {
      cacheSize: this.cache.size,
      initialized: this.initialized,
    };
  }

  clearCache() {
    this.cache.clear();
    console.log('[Video] Cache cleared');
  }

  destroy() {
    this.clearCache();
    this.initialized = false;
    this.initPromise = null;
    console.log('[Video] Service destroyed');
  }
}

// ----------------------------------------------------------------------
//  SINGLETON EXPORT
// ----------------------------------------------------------------------
let instance = null;
export function getVideoService() {
  if (!instance) instance = new UltimateVideoService();
  return instance;
}

// ----------------------------------------------------------------------
//  COMPATIBILITY EXPORTS (same interface)
// ----------------------------------------------------------------------
const videoService = {
  uploadVideo: (f, m, o) => getVideoService().uploadVideo(f, m, o),
  getVideo: (id, o) => getVideoService().getVideo(id, o),
  getVideosByUser: (uid, o) => getVideoService().getVideosByUser(uid, o),
  getVideoFeed: (uid, o) => getVideoService().getVideoFeed(uid, o),
  likeVideo: (vid, uid) => getVideoService().likeVideo(vid, uid),
  recordVideoView: (vid, uid, wd) => getVideoService().recordVideoView(vid, uid, wd),
  shareVideo: (vid, uid, p) => getVideoService().shareVideo(vid, uid, p),
  getVideoMonetization: (vid, uid) => getVideoService().getVideoMonetization(vid, uid),
  cleanupSoftDeletedVideos: () => getVideoService().cleanupSoftDeletedVideos(),
  getService: getVideoService,
  getStats: () => getVideoService().getStats(),
  clearCache: () => getVideoService().clearCache(),
  destroy: () => getVideoService().destroy(),
};

export default videoService;