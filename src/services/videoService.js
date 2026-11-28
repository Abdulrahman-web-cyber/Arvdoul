// src/services/videoService.js

import { getFirestoreInstance, getStorageInstance, getAuthInstance } from '../firebase/firebase.js';
import { collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, query, where, orderBy, limit, startAfter, serverTimestamp, runTransaction, onSnapshot, documentId } from "firebase/firestore";
import { openDB } from 'idb';
import { cacheManager } from '../utils/CacheManager.js';
import { logger } from '../utils/Logger.js';
import { auditLogger } from '../utils/AuditLogger.js';
import { rateLimiter } from '../utils/RateLimiter.js';
import { getSafeAvatarUrl } from '../utils/avatarUtils.js';
import { pickDisplayName, deriveHandle } from './profileReadModel.js';
import { featureFlagService } from './featureFlagService.js';
import { newIdempotencyKey } from '../utils/IdempotencyKey.js';
import { countersManager } from '../utils/CountersManager.js';
import { evaluateContentSafety, isSafeFeedItem } from '../utils/contentSafety.js';
import videoConfig from '../shared/videoConfig.cjs';

const {
  MIN_DURATION_SEC,
  MAX_DURATION_SEC,
  MAX_FILE_SIZE_BYTES,
  ALLOWED_VIDEO_EXTENSIONS,
  SPARK_PROCESSING_STATES,
  normalizeSparkVisibility,
  validateSparkDuration,
  validateSparkFileSize,
  validateSparkMimeOrExtension,
  resolveCanonicalPostId,
} = videoConfig;

const VIDEO_CONFIG = {
  UPLOAD: {
    MAX_FILE_SIZE: {
      free: MAX_FILE_SIZE_BYTES,
      premium: MAX_FILE_SIZE_BYTES,
      creator: MAX_FILE_SIZE_BYTES,
    },
    SUPPORTED_FORMATS: [...ALLOWED_VIDEO_EXTENSIONS, 'flv', 'm4v', 'mpg', 'mpeg'],
    MIN_DURATION: MIN_DURATION_SEC,
    MAX_DURATION: MAX_DURATION_SEC,
    DAILY_LIMIT_PER_USER: {
      free: 15,
      premium: 50,
      creator: 100,
    },
    COUNTER_SHARDS: 10,
  },
  STORAGE_PATHS: {
    VIDEOS: 'videos/{userId}/{videoId}.mp4',
    WATERMARKED: 'watermarked/{userId}/{videoId}.mp4',
    THUMBNAILS: 'thumbnails/{videoId}/{timestamp}.jpg',
  },
  MONETIZATION: {
    AD_PLACEMENT: 'video_feed',
    AD_INTERVAL: 4,
    PREMIUM_MULTIPLIER: 3,
    COIN_REWARDS: { view: 1, complete: 3, like: 2, share: 3 },
    PAY_PER_VIEW: { DEFAULT_PRICE: 0.99, CREATOR_SHARE: 0.7 },
    TIPS: { MIN_AMOUNT: 0.99, MAX_AMOUNT: 500 },
  },
  PERFORMANCE: {
    CACHE_EXPIRY: 5 * 60 * 1000,
    CACHE_MAX_SIZE: 100,
    PAGE_LIMIT: 20,
    FEED_FETCH_MULTIPLIER: 2,
    SIGNED_URL_EXPIRY: 3600,
    DEDUPE_TTL_MS: 5000,
    OFFLINE_QUEUE_MAX: 1000,
    REALTIME_LISTENER_LIMIT_PER_USER: 5,
    MAX_CONCURRENT_LISTENERS_PER_VIDEO: 1000,
    VIEW_RATE_LIMIT_MAX: 120, // view events per user per minute (UX guard)
  },
  FEED: {
    NEW_VIDEO_BOOST_HOURS: 24,
    NEW_VIDEO_BOOST_FACTOR: 2.5,
    RANDOM_INJECTION_RATIO: 0.1,
    MIN_RANDOM_VIDEOS: 2,
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
  VIDEO_TYPES: {
    REEL: 'reel',
    VIDEO: 'video',
  },
  REEL: {
    MAX_DURATION: 90,
    ASPECT_RATIO: '9:16',
  },
  TRANSCODING: {
    DEFAULT_QUALITY: '720p',
  },
  AUDIO_LIBRARY: {
    COLLECTION: 'audio_tracks',
    CACHE_EXPIRY: 30 * 60 * 1000,
  },
  EFFECTS: {
    AVAILABLE_FILTERS: ['none', 'vintage', 'b&w', 'warm', 'cool', 'cinematic'],
  },
  WATERMARK: {
    ENABLED: true,
    EXPORT_VISIBLE: {
      enabled: true,
      position: 'bottom-right',
      opacity: 0.8,
      scale: 0.1,
      animated: true,
    },
    FORENSIC_INVISIBLE: {
      enabled: true,
      embedUserId: true,
      embedVideoId: true,
      embedTimestamp: true,
      embedDeviceId: true,
    },
    PREMIUM_DISABLE_OPTION: true,
  },
  REAL_TIME: {
    ENABLED: true,
    LIKE_UPDATE_DEBOUNCE_MS: 500,
    MAX_CONCURRENT_LISTENERS_PER_VIDEO: 1000,
  },
  FRAUD: {
    MAX_LIKES_PER_VIDEO_PER_USER: 1,
    MAX_SHARES_PER_VIDEO_PER_USER: 3,
    MAX_VIEWS_PER_USER_PER_DAY: 5000,
  },
  MODERATION: {
    NSFW_DETECTION: true,
    COPYRIGHT_DETECTION: true,
    VIOLENCE_DETECTION: true,
    SPAM_DETECTION: true,
  },
};

class VideoError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'VideoError';
    this.code = `video/${code}`;
    this.details = details;
    this.timestamp = new Date().toISOString();
  }
}

function enhanceError(error, defaultMessage) {
  const code = error?.code || 'unknown';
  const msg = {
    'permission-denied': 'You do not have permission.',
    'unauthenticated': 'Please sign in.',
    'not-found': 'Resource not found.',
    'already-exists': 'Already exists.',
    'resource-exhausted': 'Rate limit exceeded.',
    'unavailable': 'Service unavailable.',
  }[code] || defaultMessage || 'Operation failed';
  return new VideoError(code, msg, { original: error });
}

const pendingRequests = new Map();
// Firestore `in`/`documentId() in` queries accept at most 30 values.
const IN_CHUNK = 30;
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of pendingRequests.entries()) {
    if (now - entry.timestamp > VIDEO_CONFIG.PERFORMANCE.DEDUPE_TTL_MS) pendingRequests.delete(key);
  }
}, 60000);

function dedupeRequest(key, fn) {
  if (pendingRequests.has(key)) {
    const entry = pendingRequests.get(key);
    if (Date.now() - entry.timestamp <= VIDEO_CONFIG.PERFORMANCE.DEDUPE_TTL_MS) {
      return entry.promise;
    }
    pendingRequests.delete(key);
  }
  const promise = fn().finally(() => {
    if (pendingRequests.get(key)?.promise === promise) pendingRequests.delete(key);
  });
  pendingRequests.set(key, { promise, timestamp: Date.now() });
  return promise;
}

class OfflineVideoQueue {
  constructor() {
    this.dbPromise = openDB('arvdoul_video_offline', 2, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('queue')) {
          db.createObjectStore('queue', { autoIncrement: true });
        }
        if (!db.objectStoreNames.contains('watermark_queue')) {
          db.createObjectStore('watermark_queue', { autoIncrement: true });
        }
      },
    });
    this.isSyncing = false;
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => this.sync());
    }
  }

  async add(operation, params) {
    const db = await this.dbPromise;
    await db.add('queue', { operation, params, timestamp: Date.now() });
    this.sync();
  }

  async getAll() {
    const db = await this.dbPromise;
    const tx = db.transaction('queue', 'readonly');
    const store = tx.objectStore('queue');
    const keys = await store.getAllKeys();
    const values = await store.getAll();
    return values.map((value, idx) => ({ id: keys[idx], ...value }));
  }

  async delete(id) {
    const db = await this.dbPromise;
    await db.delete('queue', id);
  }

  async sync(serviceInstance) {
    if (!serviceInstance || this.isSyncing) return;
    this.isSyncing = true;
    const queue = await this.getAll();
    for (const item of queue) {
      try {
        if (item.operation === 'like') {
          await serviceInstance.likeVideo(item.params.videoId);
        } else if (item.operation === 'share') {
          await serviceInstance.shareVideo(item.params.videoId, item.params.platform);
        }
        await this.delete(item.id);
      } catch (err) {
        if (Date.now() - item.timestamp > 7 * 24 * 60 * 60 * 1000) await this.delete(item.id);
      }
    }
    this.isSyncing = false;
  }
}

class UltimateVideoService {
  constructor() {
    this.firestore = null;
    this.storage = null;
    this.auth = null;
    this.initialized = false;
    this.initPromise = null;
    // Centralized CacheManager namespace (video-scoped TTL).
    this.cache = cacheManager.namespace('videos', VIDEO_CONFIG.PERFORMANCE.CACHE_EXPIRY);
    // Preserve the video-centric invalidation API used across the service.
    this.cache.invalidateVideo = (videoId) => {
      this.cache.invalidatePattern(`video_${videoId}_*`);
      this.cache.invalidatePattern(`*${videoId}*`);
    };
    this.offlineQueue = new OfflineVideoQueue();
    this.realtimeUnsubscribes = new Map();
    this.videoListenerCounts = new Map();
    this.userListenerCounts = new Map();
    this.activeAbortControllers = new Map();

    this.fns = {
      createMuxUpload: null,
      getMuxPlaybackUrl: null,
      likeVideo: null,
      shareVideo: null,
      toggleVideoSave: null,
      recordVideoView: null,
      payPerView: null,
      sendTip: null,
      setVideoChapters: null,
      deleteVideo: null,
      createDuet: null,
      createStitch: null,
      reportVideo: null,
      getVideoRecommendations: null,
      processVideoEvent: null,
      watermarkVideo: null,
      moderateVideo: null,
    };
  }

  async ensureInitialized() {
    if (this.initialized) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = (async () => {
      try {
        this.firestore = await getFirestoreInstance();
        this.storage = await getStorageInstance();
        this.auth = await getAuthInstance();

        // All callables go through the canonical callableService. `cf` re-wraps
        // the data-returning helper in the `{ data }` envelope the call sites
        // below already destructure.
        const { makeCallable, FUNCTIONS } = await import('./callableService.js');
        const cf = makeCallable;
        this.fns.createMuxUpload = cf(FUNCTIONS.CREATE_MUX_UPLOAD);
        this.fns.getMuxPlaybackUrl = cf(FUNCTIONS.GET_MUX_PLAYBACK_URL);
        this.fns.likeVideo = cf(FUNCTIONS.LIKE_VIDEO);
        this.fns.shareVideo = cf(FUNCTIONS.SHARE_VIDEO);
        this.fns.toggleVideoSave = cf(FUNCTIONS.TOGGLE_VIDEO_SAVE);
        this.fns.recordVideoView = cf(FUNCTIONS.RECORD_VIDEO_VIEW);
        this.fns.payPerView = cf(FUNCTIONS.PAY_PER_VIEW);
        this.fns.sendTip = cf(FUNCTIONS.SEND_TIP);
        this.fns.setVideoChapters = cf(FUNCTIONS.SET_VIDEO_CHAPTERS);
        this.fns.deleteVideo = cf(FUNCTIONS.DELETE_VIDEO);
        this.fns.createDuet = cf(FUNCTIONS.CREATE_DUET);
        this.fns.createStitch = cf(FUNCTIONS.CREATE_STITCH);
        this.fns.reportVideo = cf(FUNCTIONS.REPORT_VIDEO);
        this.fns.getVideoRecommendations = cf(FUNCTIONS.GET_VIDEO_RECOMMENDATIONS);
        this.fns.processVideoEvent = cf(FUNCTIONS.PROCESS_VIDEO_EVENT);
        this.fns.watermarkVideo = cf(FUNCTIONS.WATERMARK_VIDEO);
        this.fns.moderateVideo = cf(FUNCTIONS.MODERATE_VIDEO);

        this.initialized = true;
      } catch (err) {
        logger.error('[Video] ❌ Init failed', err);
        this.initPromise = null;
        throw enhanceError(err, 'Failed to initialize video service');
      }
    })();
    return this.initPromise;
  }

  async _ensureInitialized() {
    return this.ensureInitialized();
  }

  async initialize() {
    return this.ensureInitialized();
  }

  async uploadVideo(file, metadata = {}, options = {}) {
    await this.ensureInitialized();
    const currentUser = this.auth.currentUser;
    if (!currentUser) throw new VideoError('unauthenticated', 'Authentication required');

    const sizeCheck = validateSparkFileSize(file?.size);
    if (!sizeCheck.valid) throw new VideoError('invalid-video', sizeCheck.reason);
    const typeCheck = validateSparkMimeOrExtension(file?.type, file?.name);
    if (!typeCheck.valid) throw new VideoError('invalid-video', typeCheck.reason);
    if (metadata.duration !== undefined && metadata.duration !== null) {
      const durCheck = validateSparkDuration(metadata.duration);
      if (!durCheck.valid) throw new VideoError('invalid-video', durCheck.reason);
    }

    const safety = evaluateContentSafety({
      title: metadata.title || '',
      description: metadata.description || metadata.content || '',
      tags: metadata.tags || [],
      hashtags: metadata.hashtags || [],
      mediaNames: file?.name ? [file.name] : [],
      extraFields: [metadata.safetyAccessibility?.contentWarning || ''],
    });
    if (!safety.allowed) {
      throw new VideoError('content-policy', safety.reason);
    }

    const subType = metadata.subType || (metadata.type === 'reel' || metadata.isReel ? 'reel' : 'spark');
    const videoType = subType === 'reel' ? VIDEO_CONFIG.VIDEO_TYPES.REEL : VIDEO_CONFIG.VIDEO_TYPES.VIDEO;
    if (videoType === VIDEO_CONFIG.VIDEO_TYPES.REEL) {
      if (metadata.duration && metadata.duration > VIDEO_CONFIG.REEL.MAX_DURATION) {
        throw new VideoError('invalid-video', `Reel duration cannot exceed ${VIDEO_CONFIG.REEL.MAX_DURATION}s`);
      }
    }

    const validation = await this._validateVideoFile(file, metadata, currentUser.uid, videoType);
    if (!validation.valid) throw new VideoError('invalid-video', validation.errors.join(', '));

    const canUpload = await this._checkDailyUploadLimitSharded(currentUser.uid);
    if (!canUpload) throw new VideoError('daily-limit-reached', 'Daily upload limit reached.');

    const normalizedVisibility = normalizeSparkVisibility(metadata.visibility || VIDEO_CONFIG.VISIBILITY.PUBLIC);

    // Server creates BOTH canonical `posts/{postId}` and media telemetry `videos/{postId}` atomically.
    const { data: uploadData } = await this.fns.createMuxUpload({
      fileName: file.name,
      fileSize: file.size,
      mimeType: file.type,
      duration: metadata.duration ?? null,
      visibility: normalizedVisibility,
      isReel: subType === 'reel',
      subType,
      title: metadata.title || '',
      description: metadata.description || metadata.content || '',
      tags: Array.isArray(metadata.tags) ? metadata.tags : [],
      allowDownload: metadata.allowDownload ?? true,
      duetEnabled: metadata.duetEnabled ?? true,
      stitchEnabled: metadata.stitchEnabled ?? true,
      monetization: metadata.monetization || null,
      communityId: metadata.communityId || null,
      chapters: Array.isArray(metadata.chapters) ? metadata.chapters : [],
      music: metadata.music || null,
      effects: metadata.effects || null,
      identityMeta: metadata.identityMeta || null,
      distributionSettings: metadata.distributionSettings || null,
      engagementControls: metadata.engagementControls || null,
      commercialDisclosure: metadata.commercialDisclosure || null,
      partnership: metadata.partnership || null,
      creatorPrograms: metadata.creatorPrograms || null,
      safetyAccessibility: metadata.safetyAccessibility || null,
      lifecycleSettings: metadata.lifecycleSettings || null,
      enableComments: metadata.enableComments ?? true,
      enableGifts: metadata.enableGifts ?? true,
      expiresAt: metadata.expiresAt || null,
    });
    const { uploadUrl, assetId, playbackId } = uploadData;
    const postId = uploadData.postId || assetId;
    const mediaAssetId = uploadData.mediaAssetId || assetId || postId;

    // Upload raw media directly to Mux Direct Upload URL (no duplicate Firebase Storage copy).
    await this._chunkedUpload(uploadUrl, file, options.onProgress);

    // Optional instant poster preview upload into owner-scoped Storage path (updates non-protected field only).
    let previewThumbUrl = typeof metadata.thumbnailUrl === 'string' && metadata.thumbnailUrl.startsWith('http')
      ? metadata.thumbnailUrl
      : null;
    if (!previewThumbUrl && metadata.thumbnailFile && this.storage) {
      try {
        const { ref: storageRefFn, uploadBytes, getDownloadURL } = await import('firebase/storage');
        const thumbRef = storageRefFn(this.storage, `thumbnails/${currentUser.uid}/${postId}_${Date.now()}.jpg`);
        await uploadBytes(thumbRef, metadata.thumbnailFile, { contentType: metadata.thumbnailFile.type || 'image/jpeg' });
        previewThumbUrl = await getDownloadURL(thumbRef);
      } catch (thumbErr) {
        logger.warn('[Video] Preview thumbnail upload skipped:', thumbErr?.message);
      }
    }

    const extraNonProtectedPatch = {};
    if (previewThumbUrl) extraNonProtectedPatch.thumbnailUrl = previewThumbUrl;
    if (metadata.aspectRatio) extraNonProtectedPatch.aspectRatio = metadata.aspectRatio;
    if (Array.isArray(metadata.hashtags) && metadata.hashtags.length > 0) extraNonProtectedPatch.hashtags = metadata.hashtags;
    if (metadata.location) extraNonProtectedPatch.location = metadata.location;
    if (Object.keys(extraNonProtectedPatch).length > 0) {
      extraNonProtectedPatch.updatedAt = serverTimestamp();
      await updateDoc(doc(this.firestore, 'posts', postId), extraNonProtectedPatch).catch((err) => {
        logger.warn('[Video] Post metadata patch skipped:', err?.message);
      });
    }

    // Best-effort post-upload pipeline hooks (never overwrite protected Mux/state fields from client).
    const videoId = postId;
    this.fns.processVideoEvent({ eventType: 'video.created', videoId }).catch((err) =>
      logger.warn('[Video] processVideoEvent note:', err?.message)
    );
    this.fns.moderateVideo({ videoId }).catch((err) =>
      logger.warn('[Video] moderateVideo note:', err?.message)
    );
    if (VIDEO_CONFIG.WATERMARK.ENABLED && !metadata.watermarkDisabled) {
      this.fns.watermarkVideo({ videoId }).catch((err) =>
        logger.warn('[Video] watermarkVideo note:', err?.message)
      );
    }

    this.cache.invalidateVideo(postId);
    auditLogger.log('content.video_upload', {
      userId: currentUser.uid,
      meta: { videoId: postId, postId, title: metadata.title || 'Untitled', subType, fileSize: file.size, visibility: normalizedVisibility },
    });
    return {
      success: true,
      videoId: postId,
      postId,
      mediaAssetId,
      playbackId: playbackId || null,
      thumbnailUrl: previewThumbUrl,
      processingState: uploadData.processingState || SPARK_PROCESSING_STATES.UPLOAD_RESERVED,
    };
  }

  async _chunkedUpload(uploadUrl, file, onProgress) {
    const CHUNK_SIZE = 5 * 1024 * 1024; // 5 MB chunks
    const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
    for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
      const start = chunkIndex * CHUNK_SIZE;
      const end = Math.min(start + CHUNK_SIZE, file.size);
      const chunk = file.slice(start, end);
      const headers = {
        'Content-Type': 'application/octet-stream',
        'Content-Range': `bytes ${start}-${end-1}/${file.size}`,
      };
      let retries = 3;
      while (retries > 0) {
        try {
          const response = await fetch(uploadUrl, {
            method: 'PUT',
            body: chunk,
            headers,
          });
          if (!response.ok) throw new Error(`Upload chunk failed: ${response.statusText}`);
          break;
        } catch (err) {
          retries--;
          if (retries === 0) throw err;
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
      onProgress?.((chunkIndex + 1) / totalChunks);
    }
  }

  async getMuxPlaybackUrl({ playbackId = null, videoId = null, postId = null, watermarked = false } = {}) {
    await this.ensureInitialized();
    const targetId = postId || videoId;
    if (!targetId) throw new VideoError('invalid-argument', 'postId or videoId is required');
    const { data } = await this.fns.getMuxPlaybackUrl({
      playbackId,
      videoId: targetId,
      postId: postId || targetId,
      watermarked,
    });
    return data;
  }

  async deleteVideo(videoId) {
    await this.ensureInitialized();
    const currentUser = this.auth.currentUser;
    if (!currentUser) throw new VideoError('unauthenticated', 'Authentication required');
    if (!videoId) throw new VideoError('invalid-argument', 'videoId is required');
    const res = await this.fns.deleteVideo({ videoId, postId: videoId });
    this.cache.invalidateVideo(videoId);
    try {
      const { getFeedService } = await import('./feedService.js');
      getFeedService().clearUserCache(currentUser.uid);
    } catch {
      // Cache clear is best-effort
    }
    auditLogger.log('content.video_delete', {
      userId: currentUser.uid,
      meta: { videoId },
    });
    return res.data;
  }

  async _resolvePostOrVideoDoc(targetId) {
    if (!targetId) return null;
    try {
      const postSnap = await getDoc(doc(this.firestore, 'posts', targetId));
      if (postSnap.exists()) {
        return {
          id: postSnap.id,
          canonicalPostId: postSnap.id,
          _sourceCollection: 'posts',
          ...postSnap.data(),
        };
      }
    } catch {
      // Fall through to migration map / legacy video doc
    }

    try {
      const mapSnap = await getDoc(doc(this.firestore, 'video_migration_map', targetId));
      if (mapSnap.exists() && mapSnap.data()?.canonicalPostId) {
        const canonicalId = mapSnap.data().canonicalPostId;
        const mappedPostSnap = await getDoc(doc(this.firestore, 'posts', canonicalId));
        if (mappedPostSnap.exists()) {
          return {
            id: mappedPostSnap.id,
            canonicalPostId: mappedPostSnap.id,
            legacyVideoId: targetId,
            _sourceCollection: 'posts',
            ...mappedPostSnap.data(),
          };
        }
      }
    } catch {
      // Fall through to legacy video doc
    }

    try {
      const videoSnap = await getDoc(doc(this.firestore, 'videos', targetId));
      if (!videoSnap.exists()) return null;
      const vData = videoSnap.data() || {};
      const linkedPostId = vData.canonicalPostId || vData.postId || null;
      if (linkedPostId) {
        const linkedPostSnap = await getDoc(doc(this.firestore, 'posts', linkedPostId)).catch(() => null);
        if (linkedPostSnap?.exists()) {
          return {
            id: linkedPostSnap.id,
            canonicalPostId: linkedPostSnap.id,
            mediaAssetId: videoSnap.id,
            _sourceCollection: 'posts',
            ...linkedPostSnap.data(),
          };
        }
      }
      return {
        id: videoSnap.id,
        canonicalPostId: linkedPostId || null,
        _sourceCollection: 'videos',
        ...vData,
      };
    } catch {
      return null;
    }
  }

  _formatVideoItem(item) {
    if (!item) return null;
    const mediaList = Array.isArray(item.media) ? item.media : [];
    const videoMedia = mediaList.find(m => m.type === 'video' || m.muxPlaybackId || m.url?.includes('.m3u8') || m.url?.includes('.mp4') || m.url?.includes('video')) || mediaList[0];
    const muxPlaybackId = item.muxPlaybackId || videoMedia?.muxPlaybackId || null;
    const playbackPolicy = item.playbackPolicy || videoMedia?.playbackPolicy || (muxPlaybackId ? 'signed' : null);
    const rawUrl = item.signedUrl || item.videoUrl || item.url || videoMedia?.url || item.video?.file || item.video?.url || '';
    const videoUrl = rawUrl || (muxPlaybackId ? `https://stream.mux.com/${muxPlaybackId}.m3u8` : '');
    const thumbnailUrl = item.thumbnailUrl || item.thumbnail || item.poster || videoMedia?.thumbnailUrl || videoMedia?.preview || videoMedia?.thumbnail || (muxPlaybackId ? `https://image.mux.com/${muxPlaybackId}/thumbnail.jpg` : '');
    const canonicalId = resolveCanonicalPostId(item, item.id);
    const ownerId = item.authorId || item.userId || item.creator?.id || null;

    return {
      ...item,
      id: canonicalId || item.id,
      canonicalPostId: item.canonicalPostId || (item._sourceCollection === 'posts' ? item.id : null),
      userId: ownerId,
      authorId: ownerId,
      muxPlaybackId,
      playbackPolicy,
      videoUrl,
      thumbnailUrl,
      storyboardUrl: item.storyboardUrl || (muxPlaybackId ? `https://image.mux.com/${muxPlaybackId}/storyboard.vtt` : null),
      subType: item.subType || (item.type === 'reel' ? 'reel' : 'spark'),
      title: item.title || item.content?.slice(0, 50) || '',
      description: item.description || item.content || '',
      creator: item.creator || {
        name: pickDisplayName([item.authorName]),
        username: deriveHandle(item.authorUsername) || '',
        avatar: getSafeAvatarUrl(item.authorPhoto, pickDisplayName([item.authorName]), ownerId),
        id: ownerId,
        isVerified: Boolean(item.authorVerified || item.verified),
      },
      likes: item.stats?.likes ?? item.likes ?? null,
      comments: item.stats?.comments ?? item.comments ?? null,
      shares: item.stats?.shares ?? item.shares ?? null,
      saves: item.stats?.saves ?? item.saves ?? null,
      views: item.stats?.views ?? item.views ?? null,
      gifts: item.stats?.gifts ?? item.gifts ?? null,
      giftValue: item.stats?.giftValue ?? item.giftValue ?? null,
      totalWatchTime: item.stats?.totalWatchTime ?? item.totalWatchTime ?? null,
      viewerCount: item.viewerCount ?? null,
    };
  }

  async getVideo(videoId, options = {}) {
    await this.ensureInitialized();
    const currentUser = this.auth.currentUser;
    const cacheKey = `video_${videoId}_${options.quality || ''}`;
    if (options.cacheFirst !== false) {
      const cached = this.cache.get(cacheKey);
      if (cached) return { success: true, video: cached, cached: true };
    }

    const rawVideo = await this._resolvePostOrVideoDoc(videoId);
    if (!rawVideo) return { success: false, error: 'Video not found' };
    const video = this._formatVideoItem(rawVideo);
    const ownerId = video.authorId || video.userId;
    const isOwner = Boolean(currentUser?.uid && ownerId === currentUser.uid);

    if (video.isDeleted) return { success: false, error: 'Video not found' };

    const normalizedVis = normalizeSparkVisibility(video.visibility || 'public');
    if (normalizedVis === 'private' && !isOwner) {
      return { success: false, error: 'Access denied' };
    }
    if (normalizedVis === 'followers' && !isOwner) {
      const isFollowing = await this._checkFollowStatus(currentUser?.uid, ownerId);
      if (!isFollowing) return { success: false, error: 'Access denied' };
    }
    if (normalizedVis === 'friends' && !isOwner) {
      const [outFollow, inFollow] = await Promise.all([
        this._checkFollowStatus(currentUser?.uid, ownerId),
        this._checkFollowStatus(ownerId, currentUser?.uid),
      ]);
      if (!outFollow || !inFollow) return { success: false, error: 'Access denied' };
    }
    if (normalizedVis === 'public' && video.authorIsPrivate === true && !isOwner) {
      const isFollowing = await this._checkFollowStatus(currentUser?.uid, ownerId);
      if (!isFollowing) return { success: false, error: 'Access denied' };
    }

    const isPublished = video._sourceCollection === 'posts'
      ? (video.status === 'published' || video.status === 'live')
      : (video.status === VIDEO_CONFIG.STATUS.READY || video.status === 'live');
    if (!isPublished && !isOwner) {
      return { success: false, error: 'Video is still processing' };
    }

    if (video._sourceCollection === 'posts') {
      await countersManager.applyAll({
        items: [video],
        collection: 'posts',
        fields: ['likes', 'comments', 'shares', 'saves', 'views', 'gifts'],
        scope: 'stats',
      }).catch(() => {});
      video.likes = video.stats?.likes ?? video.likes ?? null;
      video.comments = video.stats?.comments ?? video.comments ?? null;
      video.shares = video.stats?.shares ?? video.shares ?? null;
      video.saves = video.stats?.saves ?? video.saves ?? null;
      video.views = video.stats?.views ?? video.views ?? null;
      video.gifts = video.stats?.gifts ?? video.gifts ?? null;
    }

    if (
      featureFlagService.isEnabled('monetization.pay_per_view') &&
      (video.monetization?.type === 'pay_per_view' || video.monetization?.type === 'ppv') &&
      !isOwner
    ) {
      const hasAccess = await this._checkPayPerViewAccess(video.id, currentUser?.uid);
      if (!hasAccess) throw new VideoError('access-denied', 'Payment required.');
    }

    let signedUrl = null;
    if (video.muxPlaybackId && currentUser?.uid) {
      try {
        const { data: urlData } = await this.fns.getMuxPlaybackUrl({
          playbackId: video.muxPlaybackId,
          videoId: video.id,
          postId: video.canonicalPostId || video.id,
          quality: options.quality || VIDEO_CONFIG.TRANSCODING.DEFAULT_QUALITY,
        });
        signedUrl = urlData?.url || null;
        if (urlData?.thumbnailUrl) video.thumbnailUrl = urlData.thumbnailUrl;
        if (urlData?.storyboardUrl) video.storyboardUrl = urlData.storyboardUrl;
      } catch (err) {
        logger.warn('[Video] Playback URL signing note:', err?.message);
      }
    }

    video.signedUrl = signedUrl;
    video.availableQualities = ['auto', '1080p', '720p', '480p'];
    this.cache.set(cacheKey, video);

    if (options.subscribeToStats && currentUser && VIDEO_CONFIG.REAL_TIME.ENABLED) {
      const userCount = this.userListenerCounts.get(currentUser.uid) || 0;
      if (userCount < VIDEO_CONFIG.PERFORMANCE.REALTIME_LISTENER_LIMIT_PER_USER) {
        const videoCount = this.videoListenerCounts.get(video.id) || 0;
        if (videoCount < VIDEO_CONFIG.REAL_TIME.MAX_CONCURRENT_LISTENERS_PER_VIDEO) {
          this._subscribeToVideoStats(video.id, currentUser.uid, options.onStatsUpdate, video._sourceCollection);
        }
      }
    }
    return { success: true, video };
  }

  _subscribeToVideoStats(videoId, userId, callback, collectionName = 'posts') {
    const colName = collectionName === 'videos' ? 'videos' : 'posts';
    const videoRef = doc(this.firestore, colName, videoId);
    let cancelled = false;
    const rawUnsubscribe = onSnapshot(videoRef, async (snap) => {
      if (!snap.exists()) return;
      const data = snap.data() || {};
      const overlaid = { ...data, stats: { ...(data.stats || {}) } };
      try {
        await countersManager.apply({
          data: overlaid,
          docPath: `${colName}/${videoId}`,
          fields: ['likes', 'views', 'comments'],
          scope: 'stats',
        });
      } catch (err) {
        logger.debug('[videoService] stats shard overlay failed', { videoId, error: err?.message });
      }
      if (cancelled) return;
      const s = overlaid.stats || {};
      callback({ likes: s.likes, views: s.views, comments: s.comments });
    }, (err) => logger.warn('[videoService] subscription error', err));
    const unsubscribe = () => {
      cancelled = true;
      rawUnsubscribe();
    };
    const key = `stats_${videoId}_${userId}`;
    if (this.realtimeUnsubscribes.has(key)) this.realtimeUnsubscribes.get(key)();
    this.realtimeUnsubscribes.set(key, unsubscribe);
    this.videoListenerCounts.set(videoId, (this.videoListenerCounts.get(videoId) || 0) + 1);
    this.userListenerCounts.set(userId, (this.userListenerCounts.get(userId) || 0) + 1);
    setTimeout(() => {
      if (this.realtimeUnsubscribes.has(key)) {
        this.realtimeUnsubscribes.get(key)();
        this.realtimeUnsubscribes.delete(key);
        this.videoListenerCounts.set(videoId, Math.max(0, (this.videoListenerCounts.get(videoId) || 0) - 1));
        this.userListenerCounts.set(userId, Math.max(0, (this.userListenerCounts.get(userId) || 0) - 1));
      }
    }, 5 * 60 * 1000);
  }

  async getVideosByUser(userId, options = {}) {
    await this.ensureInitialized();
    const isOwnerView = Boolean(options.viewerId && options.viewerId === userId);
    const isApprovedFollower = Boolean(options.isApprovedFollower);
    const pageLimit = options.limit || VIDEO_CONFIG.PERFORMANCE.PAGE_LIMIT;

    // Primary read: canonical `posts` where type == 'video'
    const postsRef = collection(this.firestore, 'posts');
    const postConstraints = [
      where('authorId', '==', userId),
      where('type', '==', 'video'),
      where('isDeleted', '==', false),
    ];
    if (!isOwnerView) {
      postConstraints.push(where('status', '==', 'published'));
      if (!isApprovedFollower) {
        postConstraints.push(where('authorIsPrivate', '==', false));
        postConstraints.push(where('visibility', '==', 'public'));
      }
    }
    let postQuery = query(postsRef, ...postConstraints, orderBy('createdAt', 'desc'), limit(pageLimit));
    if (options.startAfterDoc) {
      postQuery = query(postQuery, startAfter(options.startAfterDoc));
    }

    // Legacy read: un-migrated `videos` docs
    const videosRef = collection(this.firestore, 'videos');
    const legacyQuery = isOwnerView
      ? query(
        videosRef,
        where('userId', '==', userId),
        where('isDeleted', '==', false),
        orderBy('createdAt', 'desc'),
        limit(pageLimit)
      )
      : query(
        videosRef,
        where('userId', '==', userId),
        where('isDeleted', '==', false),
        where('status', '==', VIDEO_CONFIG.STATUS.READY),
        where('visibility', '==', VIDEO_CONFIG.VISIBILITY.PUBLIC),
        orderBy('createdAt', 'desc'),
        limit(pageLimit)
      );

    const [postSnap, legacySnap] = await Promise.all([
      getDocs(query(postQuery, limit(pageLimit))).catch(() => ({ docs: [] })),
      getDocs(query(legacyQuery, limit(pageLimit))).catch(() => ({ docs: [] })),
    ]);

    const seenIds = new Set();
    const merged = [];

    postSnap.docs.forEach((d) => {
      const formatted = this._formatVideoItem({ id: d.id, _sourceCollection: 'posts', ...d.data() });
      if (formatted && !seenIds.has(formatted.id)) {
        seenIds.add(formatted.id);
        merged.push(formatted);
      }
    });

    legacySnap.docs.forEach((d) => {
      const data = d.data() || {};
      const canonicalId = data.canonicalPostId || data.postId || d.id;
      if (seenIds.has(canonicalId) || seenIds.has(d.id)) return;
      seenIds.add(canonicalId);
      const formatted = this._formatVideoItem({ id: d.id, _sourceCollection: 'videos', ...data });
      if (formatted) merged.push(formatted);
    });

    const canonicalItems = merged.filter((item) => item._sourceCollection === 'posts');
    if (canonicalItems.length > 0) {
      await countersManager.applyAll({
        items: canonicalItems,
        collection: 'posts',
        fields: ['likes', 'comments', 'shares', 'saves', 'views', 'gifts'],
        scope: 'stats',
      }).catch(() => {});
      canonicalItems.forEach((item) => {
        item.likes = item.stats?.likes ?? item.likes ?? null;
        item.comments = item.stats?.comments ?? item.comments ?? null;
        item.shares = item.stats?.shares ?? item.shares ?? null;
        item.saves = item.stats?.saves ?? item.saves ?? null;
        item.views = item.stats?.views ?? item.views ?? null;
        item.gifts = item.stats?.gifts ?? item.gifts ?? null;
      });
    }

    return {
      success: true,
      videos: merged.slice(0, pageLimit),
      nextCursor: postSnap.docs.length ? postSnap.docs[postSnap.docs.length - 1] : null,
    };
  }

  async setVideoChapters(videoId, userId, chapters = []) {
    await this.ensureInitialized();
    const currentUser = this.auth.currentUser;
    if (!currentUser || currentUser.uid !== userId) {
      throw new VideoError('permission-denied', 'Not authorized');
    }
    const target = await this._resolvePostOrVideoDoc(videoId);
    if (!target) throw new VideoError('not-found', 'Video not found');
    const ownerId = target.authorId || target.userId;
    if (ownerId !== userId) throw new VideoError('permission-denied', 'Only owner can set chapters');

    try {
      const res = await this.fns.setVideoChapters({
        videoId: target.id,
        postId: target.canonicalPostId || target.id,
        chapters,
      });
      this.cache.invalidateVideo(videoId);
      this.cache.invalidateVideo(target.id);
      return res.data || { success: true, chapters };
    } catch {
      const targetRef = doc(this.firestore, target._sourceCollection === 'videos' ? 'videos' : 'posts', target.id);
      await updateDoc(targetRef, { chapters, updatedAt: serverTimestamp() });
      this.cache.invalidateVideo(videoId);
      return { success: true, chapters };
    }
  }

  /**
   * Authors whose videos must not appear in the viewer's Sparks feed: blocked,
   * blocked-by and muted. Delegates to the graph spine's shared hidden-author
   * reader (bounded, fails open on error).
   */
  async _getHiddenAuthors(userId) {
    if (!userId || userId === 'anonymous_user') return new Set();
    try {
      const { getSocialGraphService } = await import('./socialGraphService.js');
      return await getSocialGraphService().getHiddenAuthorIds(userId);
    } catch (err) {
      logger.warn('[Video] hidden-author read failed; not filtering', { error: err?.message });
      return new Set();
    }
  }

  async getVideoFeed(userId, options = {}) {
    await this.ensureInitialized();
    const { feedType = 'sparks', limit: pageLimit = 20, type = null, signal, cursor } = options;
    let { lastDocSnapshot } = options;
    const safeUserId = userId || 'anonymous_user';

    if (!lastDocSnapshot && cursor) {
      try {
        const postCursorSnap = await getDoc(doc(this.firestore, 'posts', String(cursor)));
        if (postCursorSnap.exists()) {
          lastDocSnapshot = postCursorSnap;
        } else {
          const videoCursorSnap = await getDoc(doc(this.firestore, 'videos', String(cursor)));
          if (videoCursorSnap.exists()) lastDocSnapshot = videoCursorSnap;
        }
      } catch (err) {
        logger.warn('[Video] Could not resolve feed cursor:', err?.message);
      }
    }

    if (this.activeAbortControllers.has(safeUserId)) {
      this.activeAbortControllers.get(safeUserId).abort();
    }
    const controller = new AbortController();
    this.activeAbortControllers.set(safeUserId, controller);
    if (signal) {
      signal.addEventListener('abort', () => controller.abort());
    }

    const hiddenAuthors = await this._getHiddenAuthors(safeUserId);

    // Following & Friends feeds filter canonical video posts authored by followed / mutual-friend accounts
    if ((feedType === 'following' || feedType === 'friends') && safeUserId !== 'anonymous_user') {
      try {
        const { getSocialGraphService } = await import('./socialGraphService.js');
        const graph = getSocialGraphService();
        const followResult = await graph.listEdges(safeUserId, 'following', { limit: 60 }).catch(() => ({ ids: [] }));
        let targetAuthorIds = Array.isArray(followResult?.ids) ? followResult.ids : [];

        if (feedType === 'friends' && targetAuthorIds.length > 0) {
          const followerResult = await graph.listEdges(safeUserId, 'followers', { limit: 120 }).catch(() => ({ ids: [] }));
          const followerSet = new Set(Array.isArray(followerResult?.ids) ? followerResult.ids : []);
          targetAuthorIds = targetAuthorIds.filter((id) => followerSet.has(id));
        }

        targetAuthorIds = targetAuthorIds.filter((id) => id && !hiddenAuthors.has(id));

        if (targetAuthorIds.length === 0) {
          return { success: true, feed: [], hasMore: false, nextCursor: null };
        }

        const postsRef = collection(this.firestore, 'posts');
        const chunks = [];
        for (let i = 0; i < targetAuthorIds.length; i += IN_CHUNK) {
          chunks.push(targetAuthorIds.slice(i, i + IN_CHUNK));
        }

        const cursorCreatedAt = lastDocSnapshot?.data?.()?.createdAt || null;

        const snaps = await Promise.all(
          chunks.map((chunk) => {
            const constraints = [
              where('authorId', 'in', chunk),
              where('authorIsPrivate', '==', false),
              where('status', '==', 'published'),
              where('isDeleted', '==', false),
              where('visibility', '==', 'public'),
              where('type', '==', 'video'),
              orderBy('createdAt', 'desc'),
            ];
            if (cursorCreatedAt) {
              constraints.push(startAfter(cursorCreatedAt));
            }
            constraints.push(limit(pageLimit));
            return getDocs(query(postsRef, ...constraints)).catch(() => ({ docs: [] }));
          })
        );

        const combined = [];
        const seen = new Set();
        snaps.forEach((s) => {
          s.docs.forEach((d) => {
            if (!seen.has(d.id)) {
              seen.add(d.id);
              combined.push(this._formatVideoItem({ id: d.id, _sourceCollection: 'posts', ...d.data() }));
            }
          });
        });

        combined.sort((a, b) => {
          const ta = a.createdAt?.toMillis?.() || new Date(a.createdAt || 0).getTime();
          const tb = b.createdAt?.toMillis?.() || new Date(b.createdAt || 0).getTime();
          return tb - ta;
        });

        const pageItems = combined.slice(0, pageLimit).filter((v) => v && v.videoUrl);
        if (pageItems.length > 0) {
          await countersManager.applyAll({
            items: pageItems,
            collection: 'posts',
            fields: ['likes', 'comments', 'shares', 'saves', 'views', 'gifts'],
            scope: 'stats',
          }).catch(() => {});
          pageItems.forEach((item) => {
            item.likes = item.stats?.likes ?? item.likes ?? null;
            item.comments = item.stats?.comments ?? item.comments ?? null;
            item.shares = item.stats?.shares ?? item.shares ?? null;
            item.saves = item.stats?.saves ?? item.saves ?? null;
            item.views = item.stats?.views ?? item.views ?? null;
            item.gifts = item.stats?.gifts ?? item.gifts ?? null;
          });
        }
        const hydrated = await this._hydrateViewerVideoState(pageItems, safeUserId);
        const nextCursor = hydrated.length ? hydrated[hydrated.length - 1].id : null;
        const hasMoreChunks = combined.length > pageLimit || snaps.some((s) => s.docs.length >= pageLimit);
        return { success: true, feed: hydrated, hasMore: hasMoreChunks && Boolean(nextCursor), nextCursor };
      } catch (err) {
        logger.warn('[Video] Relationship feed failed; falling back to Sparks feed', { feedType, error: err?.message });
      }
    }

    try {
      const postsRef = collection(this.firestore, 'posts');
      const fetchCap = pageLimit * VIDEO_CONFIG.PERFORMANCE.FEED_FETCH_MULTIPLIER;

      let postQ = feedType === 'trending' || feedType === 'for_you' || feedType === 'sparks'
        ? query(
            postsRef,
            where('authorIsPrivate', '==', false),
            where('status', '==', 'published'),
            where('visibility', '==', 'public'),
            where('isDeleted', '==', false),
            where('type', '==', 'video'),
            orderBy('rankingScore', 'desc'),
            orderBy('createdAt', 'desc'),
            limit(fetchCap)
          )
        : query(
            postsRef,
            where('authorIsPrivate', '==', false),
            where('isDeleted', '==', false),
            where('status', '==', 'published'),
            where('visibility', '==', 'public'),
            where('type', '==', 'video'),
            orderBy('createdAt', 'desc'),
            limit(fetchCap)
          );

      if (lastDocSnapshot && lastDocSnapshot.ref?.parent?.id === 'posts') {
        postQ = query(postQ, startAfter(lastDocSnapshot));
      }

      let postDocs = [];
      try {
        const postSnap = await getDocs(query(postQ, limit(fetchCap)));
        postDocs = postSnap.docs;
      } catch {
        let fallbackPostQ = query(
          postsRef,
          where('authorIsPrivate', '==', false),
          where('isDeleted', '==', false),
          where('status', '==', 'published'),
          where('visibility', '==', 'public'),
          where('type', '==', 'video'),
          orderBy('createdAt', 'desc'),
          limit(fetchCap)
        );
        if (lastDocSnapshot && lastDocSnapshot.ref?.parent?.id === 'posts') {
          fallbackPostQ = query(fallbackPostQ, startAfter(lastDocSnapshot));
        }
        const fallbackPostSnap = await getDocs(query(fallbackPostQ, limit(fetchCap))).catch(() => ({ docs: [] }));
        postDocs = fallbackPostSnap.docs;
      }

      const rawItems = [];
      const seenCanonicalIds = new Set();

      postDocs.forEach((d) => {
        const data = d.data() || {};
        if (type && data.subType !== type && data.type !== type) return;
        seenCanonicalIds.add(d.id);
        rawItems.push({ id: d.id, _sourceCollection: 'posts', ...data });
      });

      // Merge any un-migrated legacy `videos` if needed to fill the page
      if (rawItems.length < pageLimit) {
        const videosRef = collection(this.firestore, 'videos');
        let legacyQ = query(
          videosRef,
          where('isDeleted', '==', false),
          where('status', '==', VIDEO_CONFIG.STATUS.READY),
          where('visibility', '==', VIDEO_CONFIG.VISIBILITY.PUBLIC),
          orderBy('rankingScore', 'desc'),
          limit(fetchCap)
        );
        if (type) legacyQ = query(legacyQ, where('type', '==', type));
        if (lastDocSnapshot && lastDocSnapshot.ref?.parent?.id === 'videos') {
          legacyQ = query(legacyQ, startAfter(lastDocSnapshot));
        }
        const legacySnap = await getDocs(query(legacyQ, limit(fetchCap))).catch(() => ({ docs: [] }));
        legacySnap.docs.forEach((d) => {
          const data = d.data() || {};
          const linkedCanonical = data.canonicalPostId || data.postId || d.id;
          if (seenCanonicalIds.has(linkedCanonical) || seenCanonicalIds.has(d.id)) return;
          seenCanonicalIds.add(linkedCanonical);
          rawItems.push({ id: d.id, _sourceCollection: 'videos', ...data });
        });
      }

      const visibleItems = hiddenAuthors.size > 0
        ? rawItems.filter((v) => !hiddenAuthors.has(v.authorId || v.userId || v.creatorId) && isSafeFeedItem(v))
        : rawItems.filter((v) => isSafeFeedItem(v));

      const formattedList = visibleItems
        .map((item) => this._formatVideoItem(item))
        .filter((v) => v && (v.videoUrl || v.muxPlaybackId) && isSafeFeedItem(v));

      // Overlay canonical sharded engagement counters BEFORE personalized ranking
      // so engagement quality and viral velocity rank on real stats.
      const canonicalItems = formattedList.filter((item) => item._sourceCollection === 'posts');
      if (canonicalItems.length > 0) {
        await countersManager.applyAll({
          items: canonicalItems,
          collection: 'posts',
          fields: ['likes', 'comments', 'shares', 'saves', 'views', 'gifts'],
          scope: 'stats',
        }).catch(() => {});
        canonicalItems.forEach((item) => {
          item.likes = item.stats?.likes ?? item.likes ?? null;
          item.comments = item.stats?.comments ?? item.comments ?? null;
          item.shares = item.stats?.shares ?? item.shares ?? null;
          item.saves = item.stats?.saves ?? item.saves ?? null;
          item.views = item.stats?.views ?? item.views ?? null;
          item.gifts = item.stats?.gifts ?? item.gifts ?? null;
        });
      }

      // Personalized re-ranking for Sparks / For-You using cached user interest vector,
      // multi-signal quality (saves/shares > comments > likes > views), freshness decay,
      // and consecutive-creator spacing — keeping cursor anchor on chronological/fetch order.
      let rankedList = formattedList;
      if ((feedType === 'sparks' || feedType === 'for_you') && safeUserId !== 'anonymous_user' && formattedList.length > 1) {
        try {
          const { getFeedService } = await import('./feedService.js');
          const interestVector = await getFeedService().getUserInterestVector(safeUserId).catch(() => ({}));
          const scored = formattedList.map((item) => {
            const likes = Number(item.stats?.likes ?? item.likes ?? 0);
            const comments = Number(item.stats?.comments ?? item.comments ?? 0);
            const shares = Number(item.stats?.shares ?? item.shares ?? 0);
            const saves = Number(item.stats?.saves ?? item.saves ?? 0);
            const views = Number(item.stats?.views ?? item.views ?? 0);
            const weightedEngagement = (saves * 3.0) + (shares * 2.5) + (comments * 2.0) + (likes * 1.0) + Math.log1p(views) * 0.4;
            const createdMs = item.createdAt?.toMillis?.() || new Date(item.createdAt || Date.now()).getTime();
            const ageHours = Math.max(0, (Date.now() - createdMs) / 3600000);
            const freshness = Math.exp(-ageHours / 36);
            const tags = [
              ...(Array.isArray(item.hashtags) ? item.hashtags.map((t) => String(t).replace(/^#/, '').toLowerCase()) : []),
              ...(Array.isArray(item.topics) ? item.topics.map((t) => String(t).toLowerCase()) : []),
              item.creator?.id ? `creator:${item.creator.id}` : null,
            ].filter(Boolean);
            let affinity = 0;
            for (const tag of tags) {
              affinity += Number(interestVector?.[tag] || 0);
            }
            const score = (Number(item.rankingScore || 0.5) * 0.35) +
              (Math.log1p(weightedEngagement) * 0.25) +
              (freshness * 0.20) +
              (Math.min(2.5, Math.max(-1.0, affinity)) * 0.35);
            return { item, score };
          });
          scored.sort((a, b) => b.score - a.score);
          rankedList = scored.map((s) => s.item);
        } catch {
          rankedList = formattedList;
        }
      }

      const pageItems = rankedList.slice(0, pageLimit);
      const hydrated = await this._hydrateViewerVideoState(pageItems, safeUserId);
      const lastFetchedDoc = postDocs[postDocs.length - 1];
      const nextCursor = lastFetchedDoc ? lastFetchedDoc.id : (hydrated.length ? hydrated[hydrated.length - 1].id : null);
      return {
        success: true,
        feed: hydrated,
        hasMore: rankedList.length > pageLimit || postDocs.length >= fetchCap,
        nextCursor,
      };
    } catch (err) {
      logger.warn('[Video] Feed query failed:', err?.message);
      return { success: false, feed: [], hasMore: false, nextCursor: null, error: err?.message || 'video-feed-failed' };
    }
  }

  async likeVideo(videoId) {
    await this.ensureInitialized();
    if (!navigator.onLine) {
      await this.offlineQueue.add('like', { videoId });
      return { success: true, offlineQueued: true };
    }
    return dedupeRequest(`like_${videoId}`, async () => {
      const res = await this.fns.likeVideo({ videoId, postId: videoId });
      this.cache.invalidateVideo(videoId);
      return res.data;
    });
  }

  async shareVideo(videoId, platform = 'arvdoul') {
    await this.ensureInitialized();
    if (!navigator.onLine) {
      await this.offlineQueue.add('share', { videoId, platform });
      return { success: true, offlineQueued: true };
    }
    try {
      const res = await this.fns.shareVideo({ videoId, postId: videoId, platform });
      this.cache.invalidateVideo(videoId);
      return res.data;
    } catch (e) {
      logger.warn('Video share counter not recorded', { videoId, platform, error: e?.message });
      return { success: false, counted: false };
    }
  }

  async recordVideoView(videoId, watchData) {
    await this.ensureInitialized();
    const currentUser = this.auth.currentUser;
    if (!currentUser) return { success: false, reason: 'unauthenticated' };

    const rl = rateLimiter.checkAndHit(`video:view:${currentUser.uid}`, {
      max: VIDEO_CONFIG.PERFORMANCE.VIEW_RATE_LIMIT_MAX || 120,
      windowMs: 60000,
    });
    if (!rl.allowed) return { success: false, reason: 'rate_limited' };

    const today = new Date().toISOString().split('T')[0];
    const viewKey = `video:viewed:${currentUser.uid}:${videoId}:${today}`;
    if (rateLimiter.isAllowed(viewKey, { max: 1, windowMs: 24 * 60 * 60 * 1000 }).count >= 1) {
      return { success: false, reason: 'already_viewed_today' };
    }
    rateLimiter.checkAndHit(viewKey, { max: 1, windowMs: 24 * 60 * 60 * 1000 });

    const res = await this.fns.recordVideoView({ videoId, postId: videoId, ...watchData });
    this.cache.invalidateVideo(videoId);
    return res.data;
  }

  async purchaseVideoAccess(videoId) {
    await this.ensureInitialized();
    return dedupeRequest(`ppv_${videoId}`, async () => {
      return (await this.fns.payPerView({ videoId, postId: videoId })).data;
    });
  }

  async sendTip(videoId, amount, message) {
    await this.ensureInitialized();
    if (amount < VIDEO_CONFIG.MONETIZATION.TIPS.MIN_AMOUNT || amount > VIDEO_CONFIG.MONETIZATION.TIPS.MAX_AMOUNT) {
      throw new VideoError('invalid-tip', `Tip amount must be between ${VIDEO_CONFIG.MONETIZATION.TIPS.MIN_AMOUNT} and ${VIDEO_CONFIG.MONETIZATION.TIPS.MAX_AMOUNT}`);
    }
    const res = await this.fns.sendTip({ videoId, postId: videoId, amount, message, idempotencyKey: newIdempotencyKey() });
    return res.data;
  }

  async getWatermarkedDownloadUrl(videoId) {
    await this.ensureInitialized();
    const currentUser = this.auth.currentUser;
    if (!currentUser) throw new VideoError('unauthenticated', 'Login required');
    const video = await this.getVideo(videoId);
    if (!video.success) throw new VideoError('not-found', 'Video not found');
    const ownerId = video.video.authorId || video.video.userId;
    const isOwner = ownerId === currentUser.uid;
    if (isOwner && video.video.allowDownload) {
      return { success: true, url: video.video.signedUrl || video.video.videoUrl, watermarked: false };
    }
    const { data } = await this.fns.getMuxPlaybackUrl({
      playbackId: video.video.muxPlaybackId,
      videoId: video.video.id,
      postId: video.video.canonicalPostId || video.video.id,
      watermarked: true,
    });
    return { success: true, url: data.url, watermarked: true };
  }

  async getAudioLibrary(options = {}) {
    await this.ensureInitialized();
    const cacheKey = 'audio_library';
    if (options.cacheFirst !== false) {
      const cached = this.cache.get(cacheKey);
      if (cached) return cached;
    }
    const tracksRef = collection(this.firestore, VIDEO_CONFIG.AUDIO_LIBRARY.COLLECTION);
    let q = query(tracksRef, orderBy('popularity', 'desc'));
    if (options.limit) q = query(q, limit(options.limit));
    const snap = await getDocs(q);
    const tracks = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    const result = { success: true, tracks };
    this.cache.set(cacheKey, result);
    return result;
  }

  async applyEffect(videoId, effect) {
    await this.ensureInitialized();
    const currentUser = this.auth.currentUser;
    if (!currentUser) throw new VideoError('unauthenticated', 'Login required');
    if (!VIDEO_CONFIG.EFFECTS.AVAILABLE_FILTERS.includes(effect)) {
      throw new VideoError('invalid-effect', `Effect "${effect}" not supported`);
    }
    const target = await this._resolvePostOrVideoDoc(videoId);
    if (!target) throw new VideoError('not-found', 'Video not found');
    const ownerId = target.authorId || target.userId;
    if (ownerId !== currentUser.uid) throw new VideoError('permission-denied', 'Only owner can apply effects');
    const targetRef = doc(this.firestore, target._sourceCollection === 'videos' ? 'videos' : 'posts', target.id);
    await updateDoc(targetRef, { 'effects.filter': effect, updatedAt: serverTimestamp() });
    this.cache.invalidateVideo(videoId);
    return { success: true, effect };
  }

  async createDuet(originalVideoId, file, metadata = {}) {
    await this.ensureInitialized();
    const res = await this.fns.createDuet({ originalVideoId, file, metadata });
    return res.data;
  }

  async createStitch(originalVideoId, file, metadata = {}) {
    await this.ensureInitialized();
    const res = await this.fns.createStitch({ originalVideoId, file, metadata });
    return res.data;
  }

  async reportVideo(videoId, reason) {
    await this.ensureInitialized();
    const res = await this.fns.reportVideo({ videoId, postId: videoId, reason });
    return res.data;
  }

  // Real server-side persistence: users/{uid}/saved_videos/{videoId} (owner-
  // only per rules). The snapshot is the source of truth for the Watch Later
  // list; the public saves counter is server-owned and is never touched here.
  async saveVideo(videoId, userId) {
    await this.ensureInitialized();
    if (!userId) throw new Error('userId is required to save a video');
    const savedRef = doc(this.firestore, 'users', userId, 'saved_videos', videoId);
    const resolved = await this._resolvePostOrVideoDoc(videoId);
    const data = resolved || {};
    const savedSnap = await getDoc(savedRef);
    const alreadySaved = savedSnap.exists();
    if (!alreadySaved) {
      await setDoc(savedRef, {
        videoId,
        postId: data.canonicalPostId || videoId,
        savedAt: serverTimestamp(),
        snapshot: {
          id: videoId,
          canonicalPostId: data.canonicalPostId || videoId,
          muxPlaybackId: data.muxPlaybackId || null,
          title: data.title || data.content?.slice(0, 50) || '',
          videoUrl: data.videoUrl || data.url || (Array.isArray(data.media) ? data.media.find(m => m.type === 'video')?.url : '') || '',
          thumbnail: data.thumbnail || data.thumbnailUrl || (Array.isArray(data.media) ? data.media.find(m => m.preview || m.thumbnailUrl)?.thumbnailUrl || data.media.find(m => m.preview)?.preview : '') || '',
          creator: data.creator || {
            name: pickDisplayName([data.authorName]),
            username: deriveHandle(data.authorUsername) || '',
            avatar: getSafeAvatarUrl(data.authorPhoto, pickDisplayName([data.authorName]), data.authorId || data.userId),
            id: data.authorId || data.userId,
          },
          authorId: data.authorId || data.userId || null,
          duration: data.duration || 0,
          createdAt: data.createdAt || null,
        },
      });
      try {
        await this.fns.toggleVideoSave({ videoId, save: true });
      } catch (err) {
        logger.warn('[videoService] save counter update failed', err?.message);
      }
    }
    this.cache.invalidateVideo(videoId);
    return { success: true, alreadySaved };
  }

  async unsaveVideo(videoId, userId) {
    await this.ensureInitialized();
    if (!userId) throw new Error('userId is required to unsave a video');
    const savedRef = doc(this.firestore, 'users', userId, 'saved_videos', videoId);
    await deleteDoc(savedRef);
    try {
      await this.fns.toggleVideoSave({ videoId, save: false });
    } catch (err) {
      logger.warn('[videoService] save counter update failed', err?.message);
    }
    this.cache.invalidateVideo(videoId);
    return { success: true };
  }

  /**
   * Viewer-specific like/save state for one Spark/Video across canonical
   * `posts/{id}/likes/{uid}` + `videos/{id}/likes/{uid}` and `users/{uid}/saved_videos`.
   */
  async getViewerVideoState(videoId, userId) {
    if (!videoId || !userId) return { liked: false, saved: false };
    await this.ensureInitialized();
    const [postLikeSnap, videoLikeSnap, savedSnap] = await Promise.all([
      getDoc(doc(this.firestore, 'posts', videoId, 'likes', userId)).catch(() => null),
      getDoc(doc(this.firestore, 'videos', videoId, 'likes', userId)).catch(() => null),
      getDoc(doc(this.firestore, 'users', userId, 'saved_videos', videoId)).catch(() => null),
    ]);
    return {
      liked: Boolean(postLikeSnap?.exists?.() || videoLikeSnap?.exists?.()),
      saved: Boolean(savedSnap?.exists?.()),
    };
  }

  async _hydrateViewerVideoState(videos, userId) {
    if (!userId || userId === 'anonymous_user' || !Array.isArray(videos) || videos.length === 0) return videos;
    const ids = videos.map((v) => v?.id).filter(Boolean);
    if (ids.length === 0) return videos;

    const savedIds = new Set();
    try {
      const col = collection(this.firestore, 'users', userId, 'saved_videos');
      for (let i = 0; i < ids.length; i += IN_CHUNK) {
        const chunk = ids.slice(i, i + IN_CHUNK);
        const snap = await getDocs(query(col, where(documentId(), 'in', chunk), limit(chunk.length)));
        snap.forEach((d) => savedIds.add(d.id));
      }
    } catch {
      // A denied/absent read leaves the saved state unresolved (treated unsaved).
    }

    const likedIds = new Set();
    try {
      const likedCol = collection(this.firestore, 'users', userId, 'liked_posts');
      for (let i = 0; i < ids.length; i += IN_CHUNK) {
        const chunk = ids.slice(i, i + IN_CHUNK);
        const snap = await getDocs(query(likedCol, where(documentId(), 'in', chunk), limit(chunk.length)));
        snap.forEach((d) => likedIds.add(d.id));
      }
    } catch {
      // Fall through to subcollection point reads
    }

    const missingLikeIds = ids.filter((id) => !likedIds.has(id));
    if (missingLikeIds.length > 0) {
      await Promise.all(missingLikeIds.map(async (id) => {
        try {
          const [postLike, legacyLike] = await Promise.all([
            getDoc(doc(this.firestore, 'posts', id, 'likes', userId)).catch(() => null),
            getDoc(doc(this.firestore, 'videos', id, 'likes', userId)).catch(() => null),
          ]);
          if (postLike?.exists?.() || legacyLike?.exists?.()) likedIds.add(id);
        } catch {
          // Denied/absent resolves to not liked.
        }
      }));
    }

    return videos.map((v) => (v?.id
      ? { ...v, isLiked: likedIds.has(v.id), isSaved: savedIds.has(v.id) }
      : v));
  }

  async getSavedVideos(userId, { limit: max = 50 } = {}) {
    await this.ensureInitialized();
    try {
      const colRef = collection(this.firestore, 'users', userId, 'saved_videos');
      const q = query(colRef, orderBy('savedAt', 'desc'), limit(max));
      const snap = await getDocs(q);
      const items = [];
      snap.forEach((d) => {
        const data = d.data() || {};
        items.push({
          id: d.id,
          videoId: data.videoId || d.id,
          savedAt: data.savedAt?.toDate?.()?.toISOString() || data.savedAt || null,
          ...(data.snapshot || {}),
        });
      });
      return items;
    } catch (err) {
      throw new Error(`Failed to load saved videos: ${err.message}`);
    }
  }

  async getWatchNext(videoId) {
    await this.ensureInitialized();
    const res = await this.fns.getVideoRecommendations({ videoId });
    return res.data.recommendations || [];
  }

  async _validateVideoFile(file, metadata, userId, videoType) {
    const errors = [];
    const userRef = doc(this.firestore, 'users', userId);
    const userSnap = await getDoc(userRef);
    const tier = userSnap.exists() ? (userSnap.data().subscription?.tier || 'free') : 'free';
    const maxSize = VIDEO_CONFIG.UPLOAD.MAX_FILE_SIZE[tier] || VIDEO_CONFIG.UPLOAD.MAX_FILE_SIZE.free;
    if (file.size > maxSize) errors.push(`File too large (max ${(maxSize / (1024 * 1024)).toFixed(0)}MB for ${tier} tier)`);
    const ext = (file.name.split('.').pop() || '').toLowerCase();
    const mime = file.type || '';
    const isSupported = VIDEO_CONFIG.UPLOAD.SUPPORTED_FORMATS.includes(ext) || VIDEO_CONFIG.UPLOAD.SUPPORTED_FORMATS.some(f => mime.includes(f));
    if (!isSupported) errors.push(`Unsupported format: ${ext || mime}`);
    const duration = metadata.duration;
    if (!duration || duration < VIDEO_CONFIG.UPLOAD.MIN_DURATION) errors.push(`Video too short (min ${VIDEO_CONFIG.UPLOAD.MIN_DURATION}s)`);
    if (videoType === VIDEO_CONFIG.VIDEO_TYPES.REEL && duration > VIDEO_CONFIG.REEL.MAX_DURATION) errors.push(`Reels cannot exceed ${VIDEO_CONFIG.REEL.MAX_DURATION}s`);
    else if (duration > VIDEO_CONFIG.UPLOAD.MAX_DURATION) errors.push(`Video too long (max ${VIDEO_CONFIG.UPLOAD.MAX_DURATION}s)`);
    return { valid: errors.length === 0, errors };
  }

  async _checkDailyUploadLimitSharded(userId) {
    const today = new Date().toISOString().split('T')[0];
    const shards = VIDEO_CONFIG.UPLOAD.COUNTER_SHARDS;

    const userRef = doc(this.firestore, 'users', userId);
    const userSnap = await getDoc(userRef);
    const tier = userSnap.exists() ? (userSnap.data().subscription?.tier || 'free') : 'free';
    const dailyLimit = VIDEO_CONFIG.UPLOAD.DAILY_LIMIT_PER_USER[tier] || 5;

    const shardRefs = Array.from({ length: shards }, (_, i) =>
      doc(this.firestore, 'daily_upload_counters', `upload_${userId}_${today}_shard_${i}`));

    // The shards are a SUM of today's uploads. The previous version read ONE
    // random shard and compared that single value to the daily limit, so the
    // per-tier cap was never enforced — a user could upload up to `shards ×
    // dailyLimit` (and probabilistically more) before a random shard happened
    // to hit the limit. Read every shard and compare the real total.
    let success = false;
    try {
      await runTransaction(this.firestore, async (tx) => {
        const snaps = await Promise.all(shardRefs.map((ref) => tx.get(ref)));
        const total = snaps.reduce((sum, s) => sum + (s.exists() ? (s.data().count || 0) : 0), 0);
        if (total >= dailyLimit) throw new Error('LIMIT_EXCEEDED');
        const shardIndex = Math.floor(Math.random() * shards);
        const shardSnap = snaps[shardIndex];
        const current = shardSnap.exists() ? (shardSnap.data().count || 0) : 0;
        tx.set(shardRefs[shardIndex], { userId, date: today, shard: shardIndex, count: current + 1, updatedAt: serverTimestamp() }, { merge: true });
        success = true;
      });
    } catch (err) {
      if (err.message !== 'LIMIT_EXCEEDED') throw err;
    }
    return success;
  }

  async _checkFollowStatus(followerId, followingId) {
    if (!followerId) return false;
    const followRef = doc(this.firestore, 'follows', `${followerId}_${followingId}`);
    const snap = await getDoc(followRef);
    return snap.exists();
  }

  async _checkPayPerViewAccess(videoId, userId) {
    if (!userId) return false;
    const purchaseRef = doc(this.firestore, 'video_purchases', `${userId}_${videoId}`);
    const snap = await getDoc(purchaseRef);
    return snap.exists();
  }

  async _fetchRecentVideos(limit, excludeIds, type = null) {
    const videosRef = collection(this.firestore, 'videos');
    const filters = [
      where('status', '==', VIDEO_CONFIG.STATUS.READY),
      where('visibility', '==', VIDEO_CONFIG.VISIBILITY.PUBLIC),
      where('isDeleted', '==', false),
    ];
    if (type) filters.push(where('type', '==', type));
    const q = query(videosRef, ...filters, orderBy('createdAt', 'desc'), limit(limit * 2));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(v => !excludeIds.includes(v.id));
  }

  _injectFreshContent(topVideos, recentVideos, targetLimit) {
    if (recentVideos.length === 0) return topVideos;
    const injectionCount = Math.max(VIDEO_CONFIG.FEED.MIN_RANDOM_VIDEOS, Math.floor(targetLimit * VIDEO_CONFIG.FEED.RANDOM_INJECTION_RATIO));
    const actualInject = Math.min(injectionCount, recentVideos.length);
    const shuffled = [...recentVideos];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    const toInject = shuffled.slice(0, actualInject);
    const merged = [];
    const topCopy = [...topVideos];
    const injectCopy = [...toInject];
    while (topCopy.length > 0 || injectCopy.length > 0) {
      if (injectCopy.length > 0 && Math.random() < 0.3) merged.push(injectCopy.shift());
      else if (topCopy.length > 0) merged.push(topCopy.shift());
      else if (injectCopy.length > 0) merged.push(injectCopy.shift());
    }
    const seen = new Set();
    const unique = [];
    for (const v of merged) if (!seen.has(v.id)) { seen.add(v.id); unique.push(v); }
    return unique;
  }

  getStats() {
    return {
      cacheSize: this.cache.size,
      initialized: this.initialized,
      activeListeners: this.realtimeUnsubscribes.size,
      videoListenerCounts: this.videoListenerCounts.size,
    };
  }
  clearCache() { this.cache.clear(); logger.warn('// Cache cleared'); }
  destroy() {
    for (const unsub of this.realtimeUnsubscribes.values()) unsub();
    this.realtimeUnsubscribes.clear();
    this.clearCache();
    this.initialized = false;
    this.initPromise = null;
    logger.warn('// Service destroyed');
  }
}

let instance = null;
export function getVideoService() {
  if (!instance) instance = new UltimateVideoService();
  return instance;
}

const videoService = {
  initialize: () => getVideoService().initialize(),
  ensureInitialized: () => getVideoService().ensureInitialized(),
  uploadVideo: (f, m, o) => getVideoService().uploadVideo(f, m, o),
  getMuxPlaybackUrl: (opts) => getVideoService().getMuxPlaybackUrl(opts),
  deleteVideo: (vid) => getVideoService().deleteVideo(vid),
  getVideo: (id, o) => getVideoService().getVideo(id, o),
  getVideosByUser: (uid, o) => getVideoService().getVideosByUser(uid, o),
  getVideoFeed: (uid, o) => getVideoService().getVideoFeed(uid, o),
  likeVideo: (vid) => getVideoService().likeVideo(vid),
  recordVideoView: (vid, wd) => getVideoService().recordVideoView(vid, wd),
  shareVideo: (vid, p) => getVideoService().shareVideo(vid, p),
  purchaseVideoAccess: (vid) => getVideoService().purchaseVideoAccess(vid),
  sendTip: (vid, amt, msg) => getVideoService().sendTip(vid, amt, msg),
  setVideoChapters: (vid, uid, ch) => getVideoService().setVideoChapters(vid, uid, ch),
  getAudioLibrary: (o) => getVideoService().getAudioLibrary(o),
  applyEffect: (vid, e) => getVideoService().applyEffect(vid, e),
  createDuet: (orig, file, meta) => getVideoService().createDuet(orig, file, meta),
  createStitch: (orig, file, meta) => getVideoService().createStitch(orig, file, meta),
  reportVideo: (vid, reason) => getVideoService().reportVideo(vid, reason),
  saveVideo: (vid, uid) => getVideoService().saveVideo(vid, uid),
  unsaveVideo: (vid, uid) => getVideoService().unsaveVideo(vid, uid),
  getViewerVideoState: (vid, uid) => getVideoService().getViewerVideoState(vid, uid),
  getSavedVideos: (uid, opts) => getVideoService().getSavedVideos(uid, opts),
  getWatchNext: (vid) => getVideoService().getWatchNext(vid),
  getWatermarkedDownloadUrl: (vid) => getVideoService().getWatermarkedDownloadUrl(vid),
  getService: getVideoService,
  getStats: () => getVideoService().getStats(),
  clearCache: () => getVideoService().clearCache(),
  destroy: () => getVideoService().destroy(),
};

export default videoService;