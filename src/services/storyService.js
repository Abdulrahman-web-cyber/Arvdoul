// src/services/storyService.js

import { cacheManager } from '../utils/CacheManager.js';
import { logger } from '../utils/Logger.js';
import { unknownNumber } from '../lib/unknownNumber.js';
import { auditLogger } from '../utils/AuditLogger.js';
import { getFirestoreInstance, getStorageInstance, getAuthInstance } from '../firebase/firebase.js';
import {
  collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc,
  query, where, orderBy, limit, startAfter, serverTimestamp,
  increment, writeBatch, runTransaction, Timestamp, onSnapshot, addDoc,
  documentId
} from 'firebase/firestore';
import { ref as storageRef, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage';

import {
  VIBE_AUDIENCES,
  VIBE_REACTIONS,
  VIBE_LIMITS,
  VIBE_UPLOAD_STATES,
  VIBE_POLICY_SCOPES,
  VIBE_DEFAULT_SETTINGS,
  normalizeVibeReactionKey,
  buildVibeDeepLink,
  calculateVibeDuration,
  sanitizeTextOverlays,
  sanitizeDrawingPaths,
  createVibeIdempotencyKey,
} from '../config/vibeContracts.js';

//  CONFIGURATION – tuned for global scale
const STORY_CONFIG = {
  EXPIRY_HOURS: 24,
  MAX_DURATION_SECONDS: 60,
  MAX_IMAGE_SIZE_MB: 10,
  MAX_VIDEO_SIZE_MB: 100,
  MAX_AUDIO_SIZE_MB: 25,
  ALLOWED_MEDIA_TYPES: ['image', 'video', 'audio', 'text', 'event'],
  VISIBILITY: {
    PUBLIC: VIBE_AUDIENCES.PUBLIC,
    FOLLOWERS: VIBE_AUDIENCES.FOLLOWERS,
    CONNECTIONS: VIBE_AUDIENCES.CONNECTIONS,
    CLOSE_CIRCLE: VIBE_AUDIENCES.CLOSE_CIRCLE,
    SELECTED: VIBE_AUDIENCES.SELECTED,
    PRIVATE: VIBE_AUDIENCES.PRIVATE,
  },
  REACTION_TYPES: ['❤️', '🔥', '😂', '😢', '😮', '👍'],
  FEED: {
    LIMIT: 50,
    AD_INTERVAL: 5,
    CACHE_TTL: 30000, // reduced to 30s for freshness
    PRELOAD_COUNT: 3,
    SCORE_WEIGHTS: {
      recency: 0.4,
      engagement: 0.4,
      affinity: 0.2,
    },
    // Diversity guard: at most N Vibes per creator in discovery (spec §38).
    MAX_STORIES_PER_CREATOR: 4,
    EDGE_CACHE_ENABLED: true,
  },
  VIEW_TRACKING: {
    ENABLED: true,
    STORE_VIEWERS: true,
    VIEWER_LIST_LIMIT: 1000,
  },
  RATE_LIMIT: {
    CREATE_STORY: { max: 5, windowMs: 60000 },
    REACT: { max: 20, windowMs: 60000 },
    COMMENT: { max: 10, windowMs: 60000 },
  },
  CACHE: {
    FOLLOWED_USERS_TTL: 300000,
    MAX_FOLLOWED_USERS_FOR_FEED: 200, // increased for larger follow graphs
    SPONSORED_STORIES_POOL_SIZE: 10,
    SPONSORED_STORIES_REFRESH_MS: 120000,
    ARCHIVED_STORIES_TTL: 300000,
    HIGHLIGHTS_TTL: 300000,
  },
  SHARDED_COUNTERS: {
    VIEW_SHARDS: 10,
    REACTION_SHARDS: 10,
  },
  ADS: {
    FREQ_CAP_MINUTES: 30,
    TARGETING_FIELDS: ['age', 'gender', 'interests'],
  },
  IMAGE_COMPRESSION: {
    ENABLED: true,
    MAX_WIDTH: 1080,
    MAX_HEIGHT: 1920,
    QUALITY: 0.85,
  },
  ARCHIVE: {
    ENABLED: true,
    AUTO_ARCHIVE_AFTER_EXPIRY: true,
  },
  HIGHLIGHTS: {
    MAX_STORIES_PER_HIGHLIGHT: 100,
  },
  MODERATION: {
    PROFANITY_LIST: [], // server‑side
    BLOCKED_HASHTAGS: [],
  },
  BATCH_SIZE: {
    USER_PROFILES: 30,
    SEEN_STORIES: 10,
    STORY_FETCH: 30,
  },
  // Interactive stickers
  STICKER_TYPES: ['poll', 'quiz', 'countdown', 'emoji_slider'],
  COLLABORATION: {
    ENABLED: true,
    MAX_CONTRIBUTORS: 10,
  },
  AI_CAPTION: {
    ENABLED: true,
    CLOUD_FUNCTION: 'generateCaptionForImage',
  },
  TEMPLATES: {
    MAX_USER_TEMPLATES: 20,
  },
  ANALYTICS: {
    ENABLED: true,
    TRACK_COMPLETION_RATE: true,
    TRACK_FORWARD_BACK_TAPS: true,
  },
};

//  ERROR ENHANCER
function enhanceError(err, defaultMsg) {
  const code = err?.code || 'unknown';
  const msgs = {
    'permission-denied': 'You do not have permission.',
    'unauthenticated': 'Please sign in.',
    'not-found': 'Story not found.',
    'already-exists': 'Already exists.',
    'storage/unauthorized': 'Storage access denied.',
    'storage/object-not-found': 'Media not found.',
    'resource-exhausted': 'Rate limit exceeded. Please wait.',
    'unavailable': 'Service temporarily unavailable.',
  };
  const e = new Error(msgs[code] || defaultMsg || 'Story operation failed');
  e.code = code;
  e.original = err;
  e.timestamp = new Date().toISOString();
  return e;
}

//  CLIENT‑SIDE RATE LIMITER (UX only – server enforces real limits)
class RateLimiter {
  constructor() { this.store = new Map(); }
  async checkLimit(userId, op) {
    const cfg = STORY_CONFIG.RATE_LIMIT[op];
    if (!cfg) return true;
    const key = `${userId}_${op}`;
    const now = Date.now();
    let rec = this.store.get(key);
    if (!rec || now > rec.resetTime) {
      rec = { count: 0, resetTime: now + cfg.windowMs };
      this.store.set(key, rec);
    }
    if (rec.count >= cfg.max) throw enhanceError({ code: 'resource-exhausted' }, `Rate limit exceeded for ${op}.`);
    rec.count++;
    return true;
  }
}

//  OFFLINE STORY QUEUE (IndexedDB + mutex)
class StoryUploadQueue {
  constructor() {
    this.db = null;
    this.dbReady = this._init();
    this.processingQueue = false;
  }
  async _init() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open('arvdoul_story_queue', 2);
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains('queue')) {
          db.createObjectStore('queue', { keyPath: 'id', autoIncrement: true });
        }
      };
      req.onsuccess = () => { this.db = req.result; resolve(this.db); };
      req.onerror = () => reject(req.error);
    });
  }
  async add(storyData, options) {
    const db = this.db || await this.dbReady;
    return new Promise((resolve, reject) => {
      const tx = db.transaction('queue', 'readwrite');
      const store = tx.objectStore('queue');
      const req = store.add({ storyData, options, timestamp: Date.now() });
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  async getAll() {
    const db = this.db || await this.dbReady;
    return new Promise((resolve, reject) => {
      const tx = db.transaction('queue', 'readonly');
      const store = tx.objectStore('queue');
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  async delete(id) {
    const db = this.db || await this.dbReady;
    return new Promise((resolve, reject) => {
      const tx = db.transaction('queue', 'readwrite');
      const store = tx.objectStore('queue');
      const req = store.delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }
  async clear() {
    const db = this.db || await this.dbReady;
    return new Promise((resolve, reject) => {
      const tx = db.transaction('queue', 'readwrite');
      const store = tx.objectStore('queue');
      const req = store.clear();
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }
}

//  MAIN STORY SERVICE CLASS
class UltimateStoryService {
  constructor() {
    this.firestore = null; this.storage = null; this.auth = null;
    this.fs = null; this.st = null;
    this.initialized = false; this.initPromise = null;
    this.rateLimiter = new RateLimiter();
    this.uploadQueue = new StoryUploadQueue();

    this.feedCache = cacheManager.namespace('stories_feed', STORY_CONFIG.FEED.CACHE_TTL);
    this.storyCache = cacheManager.namespace('stories', STORY_CONFIG.CACHE_TTL || 5 * 60 * 1000);
    this.followedUsersCache = new Map(); this.archivedStoriesCache = new Map();
    this.highlightsCache = new Map();
    this.sponsoredStoriesCache = { stories: [], lastFetched: 0 };

    this.metrics = {
      storiesCreated: 0, storiesViewed: 0, storiesDeleted: 0,
      cacheHits: 0, cacheMisses: 0, sponsoredImpressions: 0,
    };

    this.feedListeners = new Map();
    this.activeUploads = new Map();

    // Cross‑tab invalidation (with cleanup)
    try {
      this.crossTabChannel = new BroadcastChannel('story_cache_invalidation');
      this.crossTabChannel.onmessage = (e) => {
        const { action, userId, storyId } = e.data;
        if (action === 'clearFeedCache' && userId) this._invalidateFeedCache(userId);
        else if (action === 'clearStoryCache' && storyId) this.storyCache.delete(storyId);
        else if (action === 'clearAll') this.clearCache();
      };
    } catch (e) {
      logger.debug('Cross-tab story-cache channel unavailable', { error: e?.message });
    }

    // Offline queue flush on reconnection (with mutex)
    this._onlineHandler = async () => {
      if (this._processingQueue) return;
      this._processingQueue = true;
      try {
        await this._processOfflineQueue();
      } finally {
        this._processingQueue = false;
      }
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('online', this._onlineHandler);
    }

    // ANALYTICS BUFFER (spec §57/58): raw interaction events are aggregated
    // in memory and flushed in BATCHES to sharded counters — never one
    // Firestore write per tap/completion. Metadata only.
    this._analyticsBuffer = { forwardTaps: new Map(), backTaps: new Map(), completions: new Map() };
    this._analyticsFlushTimer = null;
    this._startAnalyticsFlushTimer();
  }

  _startAnalyticsFlushTimer() {
    if (typeof window === 'undefined' || this._analyticsFlushTimer) return;
    this._analyticsFlushTimer = setInterval(() => {
      this.flushAnalyticsBuffer().catch((e) => {
        logger.debug('Story analytics flush failed', { error: e?.message });
      });
    }, 30000);
    window.addEventListener('beforeunload', () => {
      this.flushAnalyticsBuffer().catch((e) => {
        logger.debug('Story analytics flush on unload failed', { error: e?.message });
      });
    });
  }

  async flushAnalyticsBuffer() {
    const buf = this._analyticsBuffer;
    this._analyticsBuffer = { forwardTaps: new Map(), backTaps: new Map(), completions: new Map() };
    try {
      const jobs = [];
      for (const [storyId, count] of buf.forwardTaps) jobs.push(this._incrementAnalyticsShard(storyId, 'forwardTaps', count));
      for (const [storyId, count] of buf.backTaps) jobs.push(this._incrementAnalyticsShard(storyId, 'backTaps', count));
      for (const [storyId, count] of buf.completions) jobs.push(this._incrementAnalyticsShard(storyId, 'completions', count));
      await Promise.allSettled(jobs);
    } catch (e) {
      logger.warn('Story analytics flush failed', { error: e?.message });
    }
  }

  async _incrementAnalyticsShard(storyId, field, amount) {
    try {
      await this.ensureInitialized();
      const shardId = Math.floor(Math.random() * STORY_CONFIG.SHARDED_COUNTERS.VIEW_SHARDS);
      const shardRef = this.fs.doc(this.firestore, 'stories', storyId, 'analytics_shards', `shard_${shardId}`);
      try {
        await this.fs.updateDoc(shardRef, { [field]: increment(amount), updatedAt: serverTimestamp() });
      } catch (err) {
        if (err.code === 'not-found') {
          await this.fs.setDoc(shardRef, { [field]: amount, updatedAt: serverTimestamp() });
        } else throw err;
      }
    } catch (err) {
      // Rules may deny (expired/removed stories) — drop silently, never spam.
      logger.warn('[Vibes] analytics flush skipped', { error: err?.message });
    }
  }

  async ensureInitialized() {
    if (this.initialized) return;
    if (this.initPromise) return this.initPromise;
    this.initPromise = (async () => {
      logger.warn('// Initializing...');
      const firestore = await getFirestoreInstance();
      const storage = await getStorageInstance();
      const auth = await getAuthInstance();
      this.firestore = firestore; this.storage = storage; this.auth = auth;
      this.fs = {
        collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc,
        query, where, orderBy, limit, startAfter, serverTimestamp,
        increment, writeBatch, runTransaction, Timestamp, onSnapshot, addDoc,
        documentId,
      };
      this.st = { ref: storageRef, uploadBytesResumable, getDownloadURL, deleteObject };
      this.initialized = true;
      this._onlineHandler(); // flush queue
    })();
    return this.initPromise;
  }

  async _ensureInitialized() {
    return this.ensureInitialized();
  }

  async initialize() {
    return this.ensureInitialized();
  }

  //  PUBLIC API (existing methods, all fixed)

  async createStory(storyData, options = {}) {
    const emitState = (state, extra = {}) => {
      try { options.onStateChange?.(state, extra); } catch (e) { logger.debug('[Vibes] onStateChange error', { error: e?.message }); }
    };

    await this.ensureInitialized();
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      await this.uploadQueue.add(storyData, options);
      return { success: true, queued: true };
    }
    const currentUser = this.auth.currentUser;
    if (!currentUser) throw enhanceError({ code: 'unauthenticated' }, 'Authentication required');
    await this.rateLimiter.checkLimit(currentUser.uid, 'CREATE_STORY');

    emitState(VIBE_UPLOAD_STATES.PREPARING);
    const mod = this._moderateContent(storyData);
    if (!mod.passed) {
      emitState(VIBE_UPLOAD_STATES.FAILED, { reason: mod.reason });
      throw new Error(`Content violates guidelines: ${mod.reason}`);
    }

    const valid = this._validateStory(storyData);
    if (!valid.valid) {
      emitState(VIBE_UPLOAD_STATES.FAILED, { reason: valid.errors.join(', ') });
      throw new Error(`Invalid story: ${valid.errors.join(', ')}`);
    }

    const storiesRef = this.fs.collection(this.firestore, 'stories');
    const storyId = storyData.storyId || this.fs.doc(storiesRef).id;
    const visibility = storyData.visibility || STORY_CONFIG.VISIBILITY.PUBLIC;
    const selectedUserIds = Array.isArray(storyData.selectedUserIds)
      ? [...new Set(storyData.selectedUserIds.map((id) => String(id || '').trim()).filter((id) => id && id !== currentUser.uid))].slice(0, VIBE_LIMITS.MAX_SELECTED_USERS)
      : [];
    const idempotencyKey = options.idempotencyKey || storyData.idempotencyKey || createVibeIdempotencyKey(currentUser.uid);

    let mediaInfo = storyData.uploadedMedia || null;
    if (!mediaInfo && storyData.mediaFile && ['image', 'video', 'audio'].includes(storyData.type)) {
      emitState(VIBE_UPLOAD_STATES.UPLOADING, { progress: 0 });
      let file = storyData.mediaFile;
      if (storyData.type === 'image' && STORY_CONFIG.IMAGE_COMPRESSION.ENABLED) {
        file = await this._safeCompressImage(file);
      }
      mediaInfo = await this._uploadStoryMedia(file, currentUser.uid, storyData.type, options.onProgress, {
        storyId,
        visibility,
        uploadId: idempotencyKey,
        abortSignal: options.abortSignal,
        onUploadHandle: options.onUploadHandle,
      });
      if (storyData.media?.duration) {
        mediaInfo.duration = storyData.media.duration;
      }
    }

    // Check cancellation after upload before publishing doc
    if (options.abortSignal?.aborted) {
      await this.deleteAbandonedMedia(mediaInfo?.path);
      emitState(VIBE_UPLOAD_STATES.CANCELLED);
      const cancelErr = enhanceError({ code: 'cancelled' }, 'Upload cancelled');
      throw cancelErr;
    }

    emitState(VIBE_UPLOAD_STATES.PROCESSING);

    // AI caption after upload using reachable HTTPS URL if enabled and no caption supplied
    if (STORY_CONFIG.AI_CAPTION.ENABLED && storyData.type === 'image' && !storyData.content && mediaInfo?.url && storyData.enableAiCaption === true) {
      try {
        const { callFunction, FUNCTIONS } = await import('./callableService.js');
        const data = await callFunction(FUNCTIONS.GENERATE_CAPTION_FOR_IMAGE, {
          imageUrl: mediaInfo.url,
        });
        if (data?.caption) storyData.content = data.caption;
      } catch (err) { logger.warn('// AI caption failed', err); }
    }

    const sanitizedOverlays = sanitizeTextOverlays(storyData.textOverlays || []);
    const sanitizedDrawing = sanitizeDrawingPaths(storyData.drawingPaths || []);
    const computedDuration = Number(storyData.duration) > 0
      ? Math.min(Number(storyData.duration), STORY_CONFIG.MAX_DURATION_SECONDS)
      : calculateVibeDuration({ ...storyData, media: mediaInfo || storyData.media });

    // Read user Vibes settings & policy defaults
    let shouldAutoArchive = STORY_CONFIG.ARCHIVE.ENABLED;
    let userVibeSettings = { ...VIBE_DEFAULT_SETTINGS };
    try {
      const { settingsService } = await import('./settingsService.js');
      const userSettings = await settingsService.getSettings(currentUser.uid);
      if (userSettings?.vibes) {
        userVibeSettings = { ...VIBE_DEFAULT_SETTINGS, ...userSettings.vibes };
      }
      if (userSettings?.vibes?.autoArchive === false) {
        shouldAutoArchive = false;
      }
    } catch (e) {
      logger.debug('[StoryService] settings read skipped; using default vibe settings', { error: e?.message });
    }

    const validPolicyScopes = new Set(Object.values(VIBE_POLICY_SCOPES));
    const pickPolicy = (val, fallback) => (validPolicyScopes.has(val) ? val : fallback);
    const whoCanReact = pickPolicy(storyData.whoCanReact, pickPolicy(userVibeSettings.whoCanReact, VIBE_POLICY_SCOPES.EVERYONE));
    const whoCanReply = pickPolicy(storyData.whoCanReply, pickPolicy(userVibeSettings.whoCanReply, VIBE_POLICY_SCOPES.EVERYONE));
    const whoCanShare = pickPolicy(storyData.whoCanShare, pickPolicy(userVibeSettings.whoCanShare, VIBE_POLICY_SCOPES.EVERYONE));
    const whoCanSendGifts = pickPolicy(storyData.whoCanSendGifts, pickPolicy(userVibeSettings.whoCanSendGifts, VIBE_POLICY_SCOPES.EVERYONE));
    const allowReactions = storyData.allowReactions !== false && whoCanReact !== VIBE_POLICY_SCOPES.OFF;
    const allowComments = storyData.allowComments !== false && whoCanReply !== VIBE_POLICY_SCOPES.OFF;
    const allowGifts = storyData.allowGifts !== false && whoCanSendGifts !== VIBE_POLICY_SCOPES.OFF;

    emitState(VIBE_UPLOAD_STATES.PUBLISHING);

    // Interactive stickers / poll support
    let stickers = null;
    if (storyData.stickers) {
      stickers = storyData.stickers.map(s => ({
        type: s.type,
        data: s.data,
        position: s.position,
      }));
    }

    let pollSticker = null;
    if (storyData.poll?.question && Array.isArray(storyData.poll.options) && storyData.poll.options.length >= 2) {
      const pollOptions = storyData.poll.options.filter(o => typeof o === 'string' && o.trim());
      if (pollOptions.length >= 2) {
        pollSticker = {
          pollId: this.fs.doc(this.fs.collection(this.firestore, 'stories', storyId, 'polls')).id,
          question: storyData.poll.question,
          options: pollOptions,
          votes: pollOptions.map(() => 0),
          userVotes: [],
        };
        stickers = [...(stickers || []), { type: 'poll', data: { pollId: pollSticker.pollId, question: pollSticker.question, options: pollOptions }, position: { x: 0.5, y: 0.7 } }];
      }
    }

    let collaborators = [];
    if (STORY_CONFIG.COLLABORATION.ENABLED && storyData.collaborators?.length) {
      collaborators = storyData.collaborators;
    }

    const hashtags = (storyData.content || '').match(/#\w+/g) || [];
    const expiresAt = new Date(Date.now() + STORY_CONFIG.EXPIRY_HOURS * 3600000);
    const now = this.fs.serverTimestamp();

    const story = {
      id: storyId,
      userId: currentUser.uid,
      status: 'published',
      processingState: 'done',
      type: storyData.type,
      content: storyData.content || '',
      hashtags,
      media: mediaInfo,
      mediaEdits: storyData.mediaEdits || null,
      textOverlays: sanitizedOverlays,
      drawingPaths: sanitizedDrawing,
      textStyle: storyData.textStyle || null,
      duration: computedDuration,
      visibility,
      selectedUserIds,
      allowReactions,
      allowComments,
      allowGifts,
      whoCanReact,
      whoCanReply,
      whoCanShare,
      whoCanSendGifts,
      music: storyData.music || null,
      location: storyData.location || null,
      taggedUsers: storyData.taggedUsers || [],
      backgroundColor: storyData.backgroundColor || '#000000',
      textColor: storyData.textColor || '#FFFFFF',
      font: storyData.font || 'display',
      isSponsored: storyData.isSponsored || false,
      moderationStatus: 'pending',
      stickers,
      collaborators,
      linkUrl: storyData.linkUrl || null,
      templateId: storyData.templateId || null,
      stats: {
        views: 0, uniqueViewers: 0, completions: 0, replays: 0,
        comments: 0, shares: 0, replies: 0, gifts: 0, giftCoins: 0,
        totalReactions: 0,
        reactions: {},
      },
      createdAt: now,
      updatedAt: now,
      expiresAt: this.fs.Timestamp.fromDate(expiresAt),
      isDeleted: false,
    };

    let serverPublished = false;
    try {
      const { callFunction, FUNCTIONS } = await import('./callableService.js');
      const serverRes = await callFunction(FUNCTIONS.PUBLISH_VIBE, {
        storyId,
        idempotencyKey,
        type: story.type,
        content: story.content,
        media: story.media,
        mediaEdits: story.mediaEdits,
        textOverlays: story.textOverlays,
        drawingPaths: story.drawingPaths,
        textStyle: story.textStyle,
        duration: story.duration,
        visibility: story.visibility,
        selectedUserIds: story.selectedUserIds,
        allowReactions: story.allowReactions,
        allowComments: story.allowComments,
        allowGifts: story.allowGifts,
        whoCanReact: story.whoCanReact,
        whoCanReply: story.whoCanReply,
        whoCanShare: story.whoCanShare,
        whoCanSendGifts: story.whoCanSendGifts,
        music: story.music,
        location: story.location,
        taggedUsers: story.taggedUsers,
        backgroundColor: story.backgroundColor,
        textColor: story.textColor,
        font: story.font,
        stickers: story.stickers,
        collaborators: story.collaborators,
        linkUrl: story.linkUrl,
        templateId: story.templateId,
      });
      if (serverRes?.success && serverRes.storyId) {
        serverPublished = true;
        story.id = serverRes.storyId;
        if (serverRes.expiresAtMs) {
          story.expiresAt = this.fs.Timestamp.fromMillis(serverRes.expiresAtMs);
        }
      }
    } catch (callableErr) {
      const code = String(callableErr?.code || '');
      const isUnavailable =
        code.includes('not-found') ||
        code.includes('unimplemented') ||
        code.includes('unavailable') ||
        code.includes('internal');
      if (!isUnavailable) {
        await this.deleteAbandonedMedia(mediaInfo?.path);
        emitState(VIBE_UPLOAD_STATES.FAILED, { error: callableErr?.message });
        throw callableErr;
      }
      logger.warn('[StoryService] publishVibe callable unavailable; falling back to rule-gated Firestore create', {
        code,
        error: callableErr?.message,
      });
    }

    if (!serverPublished) {
      try {
        await this.fs.setDoc(this.fs.doc(this.firestore, 'stories', storyId), story);
      } catch (writeErr) {
        await this.deleteAbandonedMedia(mediaInfo?.path);
        emitState(VIBE_UPLOAD_STATES.FAILED, { error: writeErr?.message });
        throw writeErr;
      }
    }

    if (pollSticker) {
      const { pollId, ...pollData } = pollSticker;
      await this.fs.setDoc(this.fs.doc(this.firestore, 'stories', story.id, 'polls', pollId), pollData);
    }

    this._invalidateFeedCache(currentUser.uid);
    this._notifyCrossTab('clearFeedCache', currentUser.uid);

    if (!serverPublished && shouldAutoArchive) {
      try {
        await this.archiveStory(storyId, currentUser.uid);
      } catch (e) {
        logger.warn('Story archive failed; Memories will not show this story', { storyId, error: e?.message });
      }
    } else if (shouldAutoArchive) {
      this.archivedStoriesCache.delete(currentUser.uid);
    }

    if (storyData.taggedUsers?.length) this._notifyTaggedUsers(story.id, currentUser.uid, storyData.taggedUsers);
    this.metrics.storiesCreated++;
    auditLogger.log('story.created', { userId: currentUser.uid, meta: { storyId: story.id, type: storyData.type || null } });
    try {
      const { levelSystemService } = await import('./levelSystemService.js');
      levelSystemService
        .awardExperience({ userId: currentUser.uid, action: 'story_created', source: story.id })
        .catch((err) => logger.warn('Story XP award failed', { storyId: story.id, error: err?.message }));
    } catch (e) {
      logger.warn('Story XP award failed', { storyId: story.id, error: e?.message });
    }

    emitState(VIBE_UPLOAD_STATES.PUBLISHED, { storyId: story.id });
    return { success: true, storyId: story.id, story };
  }

  /**
   * Authors whose stories must not surface for the viewer: blocked,
   * blocked-by and muted. Delegates to the graph spine's shared hidden-author
   * reader (bounded, ids only, fails open on error).
   */
  async _getHiddenAuthors(userId) {
    if (!userId) return new Set();
    try {
      const { getSocialGraphService } = await import('./socialGraphService.js');
      return await getSocialGraphService().getHiddenAuthorIds(userId);
    } catch (err) {
      logger.warn('[Story] hidden-author read failed; not filtering', { error: err?.message });
      return new Set();
    }
  }

  async getStoriesFeed(userId, options = {}) {
    await this.ensureInitialized();
    const { limit: feedLimit = STORY_CONFIG.FEED.LIMIT, lastDocId = null, cacheFirst = true } = options;
    const cacheKey = `feed_${userId}_${feedLimit}_${lastDocId || 'none'}`;
    if (cacheFirst) {
      const cached = this.feedCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < STORY_CONFIG.FEED.CACHE_TTL) {
        this.metrics.cacheHits++;
        return { ...cached.data, cached: true };
      }
    }
    this.metrics.cacheMisses++;

    const hiddenAuthors = await this._getHiddenAuthors(userId);
    const feedRef = this.fs.collection(this.firestore, 'users', userId, 'feeds');
    let q = this.fs.query(feedRef,
      this.fs.orderBy('createdAt', 'desc'),
      this.fs.limit(feedLimit + 20));
    if (lastDocId) {
      const lastDocSnapshot = await this.fs.getDoc(this.fs.doc(this.firestore, 'users', userId, 'feeds', lastDocId));
      if (lastDocSnapshot.exists()) {
        q = this.fs.query(q, this.fs.startAfter(lastDocSnapshot));
      }
    }
    const feedSnap = await this.fs.getDocs(q);
    const feedEntries = feedSnap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      // The fan-out writes the author as `ownerId`; hide blocked/blocked-by/muted
      // authors here, in the read path (the write fan-out cannot know the future
      // relationship, and the server-side story feed does not filter per viewer).
      .filter(e => !hiddenAuthors.has(e.ownerId));

    const storyIds = feedEntries.map(e => e.storyId).filter(s => s);
    const batchSize = STORY_CONFIG.BATCH_SIZE.STORY_FETCH;
    const stories = [];
    const seenStoryIds = new Set();

    // Always include creator's own active Vibes on first page (including private/selected)
    if (!lastDocId) {
      const ownStories = await this.getUserStories(userId, { limit: 20 }).catch(() => []);
      ownStories.forEach((s) => {
        if (s?.id && !s.isDeleted && s.moderationStatus !== 'rejected' && !this._isStoryExpired(s) && !seenStoryIds.has(s.id)) {
          seenStoryIds.add(s.id);
          stories.push(s);
        }
      });
    }

    for (let i = 0; i < storyIds.length; i += batchSize) {
      const chunk = storyIds.slice(i, i + batchSize);
      const storyPromises = chunk.map(sid => this.getStory(sid, userId).catch(() => null));
      const storyResults = await Promise.all(storyPromises);
      storyResults.forEach(res => {
        if (res?.success && res.story && !res.story.isDeleted && res.story.moderationStatus !== 'rejected' && !seenStoryIds.has(res.story.id)) {
          seenStoryIds.add(res.story.id);
          stories.push(res.story);
        }
      });
    }

    const scored = await this._applyFeedScoring(stories, userId);
    const withAds = await this._insertSponsoredStories(scored, userId);
    const grouped = this._groupStoriesByUser(withAds);
    const seenStatus = await this._getSeenStatus(userId, withAds.map(s => s.id));
    const groupsWithSeen = grouped.map(g => ({
      userId: g.userId,
      stories: g.stories.map(s => ({ ...s, seen: seenStatus[s.id] || false })),
    }));

    const lastDocSnapshot = feedSnap.docs.length ? feedSnap.docs[feedSnap.docs.length - 1] : null;
    const result = {
      success: true,
      groups: groupsWithSeen,
      hasMore: feedSnap.docs.length === (feedLimit + 20),
      lastDocId: lastDocSnapshot?.id || null,
      count: withAds.length,
    };
    this.feedCache.set(cacheKey, { data: result, timestamp: Date.now() });
    return result;
  }

  subscribeToFeed(userId, callback) {
    if (this.feedListeners.has(userId)) this.feedListeners.get(userId)();
    const feedRef = this.fs.collection(this.firestore, 'users', userId, 'feeds');
    const q = this.fs.query(feedRef,
      this.fs.orderBy('createdAt', 'desc'),
      this.fs.limit(50));
    const unsubscribe = this.fs.onSnapshot(q, async (snapshot) => {
      const hiddenAuthors = await this._getHiddenAuthors(userId);
      const feedEntries = snapshot.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(e => !hiddenAuthors.has(e.ownerId));
      const storyIds = feedEntries.map(e => e.storyId).filter(s => s);
      const batchSize = STORY_CONFIG.BATCH_SIZE.STORY_FETCH;
      const stories = [];
      for (let i = 0; i < storyIds.length; i += batchSize) {
        const chunk = storyIds.slice(i, i + batchSize);
        const storyPromises = chunk.map(sid => this.getStory(sid, userId).catch(() => null));
        const storyResults = await Promise.all(storyPromises);
        storyResults.forEach(res => {
          if (res?.success && res.story && !res.story.isDeleted && res.story.moderationStatus !== 'rejected') {
            stories.push(res.story);
          }
        });
      }
      const scored = await this._applyFeedScoring(stories, userId);
      const grouped = this._groupStoriesByUser(scored);
      const seenStatus = await this._getSeenStatus(userId, scored.map(s => s.id));
      callback({
        success: true,
        groups: grouped.map(g => ({
          userId: g.userId,
          stories: g.stories.map(s => ({ ...s, seen: seenStatus[s.id] || false })),
        })),
      });
    }, (error) => { callback({ success: false, error: error.message }); });
    this.feedListeners.set(userId, unsubscribe);
    return unsubscribe;
  }

  async getStory(storyId, viewerId = null) {
    await this.ensureInitialized();
    const currentUserId = viewerId || this.auth.currentUser?.uid;
    if (!currentUserId) throw enhanceError({ code: 'unauthenticated' }, 'Auth required');

    const cached = this.storyCache.get(storyId);
    if (cached && Date.now() - cached.timestamp < 30000) {
      if (await this._canViewStory(cached.data, currentUserId)) {
        this.metrics.cacheHits++;
        return { success: true, story: cached.data, cached: true };
      }
    }

    const storyDoc = await this.fs.getDoc(this.fs.doc(this.firestore, 'stories', storyId));
    if (!storyDoc.exists()) return { success: false, error: 'Story not found' };
    const story = { id: storyDoc.id, ...storyDoc.data() };

    if (!(await this._canViewStory(story, currentUserId))) {
      return { success: false, error: 'Access denied' };
    }

    if (story.userId !== currentUserId && STORY_CONFIG.VIEW_TRACKING.ENABLED) {
      await this._recordStoryViewSharded(storyId, currentUserId);
    }

    if (story.visibility === STORY_CONFIG.VISIBILITY.PUBLIC) {
      this.storyCache.set(storyId, { data: story, timestamp: Date.now() });
    }
    return { success: true, story };
  }

  async recordVibeEngagement(storyId, eventType = 'view') {
    await this.ensureInitialized();
    const uid = this.auth.currentUser?.uid;
    if (!uid || !storyId) return { success: false };
    try {
      const { callFunction, FUNCTIONS } = await import('./callableService.js');
      const res = await callFunction(FUNCTIONS.RECORD_VIBE_ENGAGEMENT, {
        vibeId: storyId,
        eventType,
      });
      return { success: true, ...(res || {}) };
    } catch (err) {
      logger.warn('[StoryService] recordVibeEngagement failed', { storyId, eventType, error: err?.message });
      return { success: false, error: err?.message };
    }
  }

  async reportStoryView(storyId, viewerId = null) {
    await this.ensureInitialized();
    const uid = viewerId || this.auth.currentUser?.uid;
    if (!uid || !storyId) return { success: false };
    await this._markStorySeen(uid, storyId);
    try {
      const res = await this.recordVibeEngagement(storyId, 'view');
      if (res?.success) return res;
      const storyDoc = await this.fs.getDoc(this.fs.doc(this.firestore, 'stories', storyId));
      if (storyDoc.exists() && storyDoc.data().userId !== uid && STORY_CONFIG.VIEW_TRACKING.ENABLED) {
        await this._recordStoryViewSharded(storyId, uid);
      }
      return { success: true };
    } catch (err) {
      logger.warn('[StoryService] reportStoryView failed', { storyId, error: err?.message });
      return { success: false, error: err?.message };
    }
  }

  async getStoryViewers(storyId, options = {}) {
    await this.ensureInitialized();
    const currentUser = this.auth.currentUser;
    if (!currentUser) throw enhanceError({ code: 'unauthenticated' }, 'Auth required');

    const storyResult = await this.getStory(storyId, currentUser.uid);
    if (!storyResult.success) throw new Error('Story not found');
    if (storyResult.story.userId !== currentUser.uid) throw enhanceError({ code: 'permission-denied' }, 'Only owner can view viewers');

    if (!STORY_CONFIG.VIEW_TRACKING.STORE_VIEWERS) return { success: true, viewers: [], hasMore: false };

    const viewersRef = this.fs.collection(this.firestore, 'stories', storyId, 'viewers');
    let q = this.fs.query(viewersRef,
      this.fs.orderBy('viewedAt', 'desc'),
      this.fs.limit(options.limit || STORY_CONFIG.VIEW_TRACKING.VIEWER_LIST_LIMIT));
    if (options.startAfter) q = this.fs.query(q, this.fs.startAfter(options.startAfter));
    const snap = await this.fs.getDocs(q);
    const viewerList = snap.docs.map(d => ({
      userId: d.id,
      viewedAt: d.data().viewedAt?.toDate?.() || d.data().viewedAt,
    }));

    let enriched = viewerList;
    try {
      const userService = await import('./userService.js');
      const userIds = viewerList.map(v => v.userId).filter((v, i, a) => a.indexOf(v) === i);
      const batches = [];
      for (let i = 0; i < userIds.length; i += STORY_CONFIG.BATCH_SIZE.USER_PROFILES) {
        batches.push(userIds.slice(i, i + STORY_CONFIG.BATCH_SIZE.USER_PROFILES));
      }
      const profileMap = new Map();
      for (const batch of batches) {
        const profiles = await Promise.all(batch.map(uid => userService.getUserProfile(uid).catch(() => null)));
        profiles.forEach((p, idx) => { if (p) profileMap.set(batch[idx], p); });
      }
      enriched = viewerList.map(v => ({ ...v, profile: profileMap.get(v.userId) || null }));
    } catch (e) {
      // Viewer rows are still returned un-enriched; log so a profile-hydration
      // failure does not look like "viewers with no names".
      logger.warn('Story viewer profile hydration failed', { storyId, error: e?.message });
    }

    return {
      success: true,
      viewers: enriched,
      hasMore: viewerList.length === (options.limit || STORY_CONFIG.VIEW_TRACKING.VIEWER_LIST_LIMIT),
    };
  }

  async reactToStory(storyId, reactionType) {
    await this.ensureInitialized();
    const currentUser = this.auth.currentUser;
    if (!currentUser) throw enhanceError({ code: 'unauthenticated' }, 'Auth required');
    await this.rateLimiter.checkLimit(currentUser.uid, 'REACT');

    const normalized = reactionType == null || reactionType === 'remove'
      ? null
      : normalizeVibeReactionKey(reactionType);
    if (reactionType != null && reactionType !== 'remove' && !normalized) {
      throw new Error('Invalid reaction');
    }

    const { callFunction, FUNCTIONS } = await import('./callableService.js');
    const actionResult = await callFunction(FUNCTIONS.REACT_TO_VIBE, {
      vibeId: storyId,
      reaction: normalized,
    });

    this.storyCache.delete(storyId);
    auditLogger.log('story.reacted', {
      userId: currentUser.uid,
      meta: { storyId, reactionType: normalized, action: actionResult?.action || 'updated' },
    });
    return { success: true, ...(actionResult || {}) };
  }

  async commentOnStory(storyId, content, options = {}) {
    await this.ensureInitialized();
    const currentUser = this.auth.currentUser;
    if (!currentUser) throw enhanceError({ code: 'unauthenticated' }, 'Auth required');
    await this.rateLimiter.checkLimit(currentUser.uid, 'COMMENT');

    const storyResult = await this.getStory(storyId, currentUser.uid);
    if (!storyResult.success) throw new Error('Story not found');
    if (!storyResult.story.allowComments) throw new Error('Comments disabled');

    const commentService = await import('./commentService.js');
    const result = await commentService.createComment(storyId, currentUser.uid, content, options);
    await this._incrementAnalyticsShard(storyId, 'comments', 1);
    return result;
  }

  async replyToStory(storyId, message, options = {}) {
    await this.ensureInitialized();
    const currentUser = this.auth.currentUser;
    if (!currentUser) throw enhanceError({ code: 'unauthenticated' }, 'Auth required');
    const cleanText = String(message || '').trim();
    if (!cleanText) throw new Error('Reply text cannot be empty');

    const { callFunction, FUNCTIONS } = await import('./callableService.js');
    const res = await callFunction(FUNCTIONS.REPLY_TO_VIBE, {
      vibeId: storyId,
      text: cleanText,
      idempotencyKey: options.idempotencyKey || createVibeIdempotencyKey(currentUser.uid),
    });

    await this._incrementAnalyticsShard(storyId, 'replies', 1);
    this.storyCache.delete(storyId);
    auditLogger.log('story.replied', {
      userId: currentUser.uid,
      meta: { storyId, conversationId: res?.conversationId || null },
    });
    return { success: true, ...(res || {}) };
  }

  async deleteStory(storyId) {
    await this.ensureInitialized();
    const currentUser = this.auth.currentUser;
    if (!currentUser) throw enhanceError({ code: 'unauthenticated' }, 'Auth required');

    let serverDeleted = false;
    try {
      const { callFunction, FUNCTIONS } = await import('./callableService.js');
      const res = await callFunction(FUNCTIONS.DELETE_VIBE, { storyId });
      if (res?.success) serverDeleted = true;
    } catch (callableErr) {
      const code = String(callableErr?.code || '');
      if (code.includes('permission-denied') || code.includes('not-found')) {
        throw callableErr;
      }
      logger.debug('[StoryService] deleteVibe callable fallback to client owner delete', { storyId, error: callableErr?.message });
    }

    if (!serverDeleted) {
      const storyRef = this.fs.doc(this.firestore, 'stories', storyId);
      const snap = await this.fs.getDoc(storyRef);
      if (!snap.exists()) throw new Error('Story not found');
      if (snap.data().userId !== currentUser.uid) throw enhanceError({ code: 'permission-denied' }, 'You can only delete your own stories');

      const archiveSnap = await this.fs.getDoc(this.fs.doc(this.firestore, 'archived_stories', storyId)).catch(() => null);
      const keepArchivedMedia = Boolean(archiveSnap && archiveSnap.exists());

      if (!keepArchivedMedia && snap.data().media?.path) {
        try {
          await this.st.deleteObject(this.st.ref(this.storage, snap.data().media.path));
        } catch (e) {
          logger.warn('Story media object delete failed; orphan may remain', { storyId, path: snap.data().media.path, error: e?.message });
        }
      }

      await this.fs.updateDoc(storyRef, { isDeleted: true, status: 'removed', updatedAt: serverTimestamp() });
    }

    this.storyCache.delete(storyId);
    this._invalidateFeedCache(currentUser.uid);
    this._notifyCrossTab('clearFeedCache', currentUser.uid);
    this.metrics.storiesDeleted++;
    auditLogger.log('story.deleted', { userId: currentUser.uid, meta: { storyId } });
    return { success: true };
  }

  async deleteArchivedStory(storyId, userId = null) {
    await this.ensureInitialized();
    const currentUser = this.auth.currentUser;
    const targetUserId = userId || currentUser?.uid;
    if (!currentUser || currentUser.uid !== targetUserId) {
      throw enhanceError({ code: 'permission-denied' }, 'You can only delete your own archived Vibes');
    }

    const archiveRef = this.fs.doc(this.firestore, 'archived_stories', storyId);
    const snap = await this.fs.getDoc(archiveRef);
    if (!snap.exists()) return { success: true, alreadyDeleted: true };
    const archivedData = snap.data();
    if (archivedData.userId !== currentUser.uid) {
      throw enhanceError({ code: 'permission-denied' }, 'You can only delete your own archived Vibes');
    }

    await this.fs.deleteDoc(archiveRef);

    // Clean Storage media only if active story no longer needs it
    if (archivedData.media?.path) {
      const activeSnap = await this.fs.getDoc(this.fs.doc(this.firestore, 'stories', storyId)).catch(() => null);
      const activeNeedsMedia = Boolean(activeSnap && activeSnap.exists() && !activeSnap.data()?.isDeleted && !this._isStoryExpired(activeSnap.data()));
      if (!activeNeedsMedia) {
        try {
          await this.st.deleteObject(this.st.ref(this.storage, archivedData.media.path));
        } catch (e) {
          logger.warn('Archived Vibe media delete failed', { storyId, path: archivedData.media.path, error: e?.message });
        }
      }
    }

    this.archivedStoriesCache.delete(targetUserId);
    return { success: true };
  }

  async getCloseCircle(userId = null) {
    await this.ensureInitialized();
    const uid = userId || this.auth.currentUser?.uid;
    if (!uid) throw enhanceError({ code: 'unauthenticated' }, 'Auth required');
    const snap = await this.fs.getDocs(
      this.fs.query(
        this.fs.collection(this.firestore, 'users', uid, 'close_circle'),
        this.fs.limit(200)
      )
    );
    const memberIds = snap.docs.map((d) => d.id).filter(Boolean);
    if (memberIds.length === 0) return { success: true, memberIds: [], members: [] };
    try {
      const { getSocialGraphService } = await import('./socialGraphService.js');
      const members = await getSocialGraphService().hydrateProfiles(memberIds, { viewerId: uid });
      return { success: true, memberIds, members };
    } catch (err) {
      logger.warn('[StoryService] Close Circle hydration failed', { error: err?.message });
      return { success: true, memberIds, members: memberIds.map((id) => ({ id, uid: id })) };
    }
  }

  async addToCloseCircle(ownerId, memberId) {
    await this.ensureInitialized();
    const currentUser = this.auth.currentUser;
    if (!currentUser || currentUser.uid !== ownerId) {
      throw enhanceError({ code: 'permission-denied' }, 'You can only manage your own Close Circle');
    }
    if (!memberId || memberId === ownerId) {
      throw new Error('Invalid Close Circle member');
    }
    await this.fs.setDoc(
      this.fs.doc(this.firestore, 'users', ownerId, 'close_circle', memberId),
      { memberId, addedAt: serverTimestamp() },
      { merge: true }
    );
    return { success: true };
  }

  async removeFromCloseCircle(ownerId, memberId) {
    await this.ensureInitialized();
    const currentUser = this.auth.currentUser;
    if (!currentUser || currentUser.uid !== ownerId) {
      throw enhanceError({ code: 'permission-denied' }, 'You can only manage your own Close Circle');
    }
    await this.fs.deleteDoc(this.fs.doc(this.firestore, 'users', ownerId, 'close_circle', memberId));
    return { success: true };
  }

  async setCloseCircle(ownerId, memberIds = []) {
    await this.ensureInitialized();
    const currentUser = this.auth.currentUser;
    if (!currentUser || currentUser.uid !== ownerId) {
      throw enhanceError({ code: 'permission-denied' }, 'You can only manage your own Close Circle');
    }
    const existing = await this.getCloseCircle(ownerId);
    const existingSet = new Set(existing.memberIds || []);
    const targetSet = new Set((memberIds || []).filter((id) => id && id !== ownerId).slice(0, 200));

    const batch = this.fs.writeBatch(this.firestore);
    for (const id of existingSet) {
      if (!targetSet.has(id)) {
        batch.delete(this.fs.doc(this.firestore, 'users', ownerId, 'close_circle', id));
      }
    }
    for (const id of targetSet) {
      if (!existingSet.has(id)) {
        batch.set(this.fs.doc(this.firestore, 'users', ownerId, 'close_circle', id), {
          memberId: id,
          addedAt: serverTimestamp(),
        });
      }
    }
    await batch.commit();
    return { success: true, memberIds: [...targetSet] };
  }

  async cancelUpload(uploadId) {
    const active = this.activeUploads.get(uploadId);
    if (!active) return false;
    active.cancelled = true;
    try {
      active.task?.cancel?.();
    } catch (e) {
      logger.debug('[StoryService] cancelUpload task error', { error: e?.message });
    }
    if (active.path) {
      await this.deleteAbandonedMedia(active.path);
    }
    this.activeUploads.delete(uploadId);
    return true;
  }

  async deleteAbandonedMedia(storagePath) {
    if (!storagePath || !this.storage || !this.st?.deleteObject) return false;
    try {
      await this.st.deleteObject(this.st.ref(this.storage, storagePath));
      return true;
    } catch (err) {
      logger.debug('[StoryService] deleteAbandonedMedia skipped', { storagePath, error: err?.message });
      return false;
    }
  }

  async shareVibe(vibeId, options = {}) {
    await this.ensureInitialized();
    const currentUser = this.auth.currentUser;
    if (!currentUser) throw enhanceError({ code: 'unauthenticated' }, 'Auth required');
    const {
      mode = 'link',
      recipientIds = [],
      conversationIds = [],
      caption = '',
    } = options || {};

    const { callFunction, FUNCTIONS } = await import('./callableService.js');
    const res = await callFunction(FUNCTIONS.SHARE_VIBE, {
      vibeId,
      mode,
      recipientIds,
      conversationIds,
      caption,
    });
    this._invalidateStoryCache(vibeId);
    return {
      success: true,
      shareUrl: buildVibeDeepLink(vibeId),
      ...(res || {}),
    };
  }

  async trackShare(storyId, options = {}) {
    await this.ensureInitialized();
    const currentUser = this.auth.currentUser;
    if (!currentUser) return { success: false };
    return this.shareVibe(storyId, { mode: options.mode || 'link', ...options });
  }

  async trackStoryAnalytics(storyId, eventType) {
    if (!STORY_CONFIG.ANALYTICS.ENABLED) return;
    // Buffered + batched (spec §57/58) — no per-tap story-doc writes.
    if (eventType === 'forward') {
      this._analyticsBuffer.forwardTaps.set(storyId, (this._analyticsBuffer.forwardTaps.get(storyId) || 0) + 1);
    } else if (eventType === 'back') {
      this._analyticsBuffer.backTaps.set(storyId, (this._analyticsBuffer.backTaps.get(storyId) || 0) + 1);
    }
  }

  async reportStoryCompletion(storyId) {
    if (!STORY_CONFIG.ANALYTICS.TRACK_COMPLETION_RATE) return;
    this._analyticsBuffer.completions.set(storyId, (this._analyticsBuffer.completions.get(storyId) || 0) + 1);
    this.recordVibeEngagement(storyId, 'completion').catch((err) => {
      logger.warn('[StoryService] completion engagement failed', { storyId, error: err?.message });
    });
  }

  async voteOnPoll(storyId, pollId, optionIndex) {
    await this.ensureInitialized();
    const currentUser = this.auth.currentUser;
    if (!currentUser) throw enhanceError({ code: 'unauthenticated' }, 'Auth required');
    const pollRef = this.fs.doc(this.firestore, 'stories', storyId, 'polls', pollId);
    await this.fs.runTransaction(this.firestore, async (transaction) => {
      const snap = await transaction.get(pollRef);
      if (!snap.exists()) throw new Error('Poll not found');
      const poll = snap.data();
      if (poll.userVotes?.includes(currentUser.uid)) throw new Error('Already voted');
      const newVotes = [...(poll.votes || [])];
      newVotes[optionIndex] = (newVotes[optionIndex] || 0) + 1;
      transaction.update(pollRef, {
        votes: newVotes,
        userVotes: [...(poll.userVotes || []), currentUser.uid],
        // Record *which* option so the viewer can show the result rather than
        // just "you voted".
        [`userChoices.${currentUser.uid}`]: optionIndex,
        updatedAt: serverTimestamp(),
      });
    });
    return { success: true };
  }

  async getPoll(storyId, pollId, viewerId = null) {
    await this.ensureInitialized();
    const currentUser = this.auth.currentUser;
    if (!currentUser) throw enhanceError({ code: 'unauthenticated' }, 'Auth required');
    const viewer = viewerId || currentUser.uid;
    const snap = await this.fs.getDoc(this.fs.doc(this.firestore, 'stories', storyId, 'polls', pollId));
    if (!snap.exists()) return { success: true, poll: null, voted: null };
    const poll = snap.data();
    return {
      success: true,
      poll: { id: pollId, question: poll.question, options: poll.options || [], votes: poll.votes || [] },
      voted: poll.userChoices?.[viewer] ?? null,
    };
  }

  async answerQuiz(storyId, quizId, optionIndex) {
    await this.ensureInitialized();
    const currentUser = this.auth.currentUser;
    if (!currentUser) throw enhanceError({ code: 'unauthenticated' }, 'Auth required');
    const quizRef = this.fs.doc(this.firestore, 'stories', storyId, 'quizzes', quizId);
    let reward = 0;
    await this.fs.runTransaction(this.firestore, async (transaction) => {
      const snap = await transaction.get(quizRef);
      if (!snap.exists()) throw new Error('Quiz not found');
      const quiz = snap.data();
      if (quiz.userAnswers?.[currentUser.uid]) throw new Error('Already answered');
      const isCorrect = (quiz.correctOption === optionIndex);
      transaction.update(quizRef, {
        [`answers.${optionIndex}`]: increment(1),
        [`userAnswers.${currentUser.uid}`]: { option: optionIndex, isCorrect },
        updatedAt: serverTimestamp(),
      });
      reward = isCorrect ? Number(quiz.coinReward) || 0 : 0;
    });
    // The coin credit is a network callable and must run AFTER the transaction
    // commits, never inside it: a Firestore transaction callback can be retried,
    // so awaiting `addCoins` in-band could mint the reward more than once for a
    // single answer (and a cap/network failure would abort a legitimate answer).
    // A deterministic idempotency key makes the credit exactly-once even if the
    // caller retries the whole operation.
    if (reward > 0) {
      const monetization = (await import('./monetizationService.js')).getMonetizationService();
      await monetization.addCoins(
        currentUser.uid,
        reward,
        'quiz_correct',
        { storyId, quizId },
        `quiz_${currentUser.uid}_${storyId}_${quizId}`
      );
    }
    return { success: true, reward };
  }

  async updateCountdown(storyId, countdownId) {
    await this.ensureInitialized();
    const countdownRef = this.fs.doc(this.firestore, 'stories', storyId, 'countdowns', countdownId);
    await this.fs.updateDoc(countdownRef, { triggeredAt: serverTimestamp() });
    return { success: true };
  }

  async recordEmojiSlider(storyId, sliderId, value) {
    await this.ensureInitialized();
    const currentUser = this.auth.currentUser;
    if (!currentUser) return;
    const sliderRef = this.fs.doc(this.firestore, 'stories', storyId, 'emoji_sliders', sliderId);
    await this.fs.runTransaction(this.firestore, async (transaction) => {
      const snap = await transaction.get(sliderRef);
      if (!snap.exists()) throw new Error('Slider not found');
      const slider = snap.data();
      if (slider.userVotes?.includes(currentUser.uid)) throw new Error('Already voted');
      const newSum = (slider.sum || 0) + value;
      const newCount = (slider.count || 0) + 1;
      transaction.update(sliderRef, {
        sum: newSum,
        count: newCount,
        average: newSum / newCount,
        userVotes: [...(slider.userVotes || []), currentUser.uid],
        updatedAt: serverTimestamp(),
      });
    });
    return { success: true };
  }

  async addCollaborator(storyId, collaboratorId) {
    await this.ensureInitialized();
    const currentUser = this.auth.currentUser;
    if (!currentUser) throw enhanceError({ code: 'unauthenticated' }, 'Auth required');
    const storyRef = this.fs.doc(this.firestore, 'stories', storyId);
    await this.fs.updateDoc(storyRef, {
      collaborators: this.fs.arrayUnion(collaboratorId),
      updatedAt: serverTimestamp(),
    });
    // Notify collaborator
    const notifications = await import('./notificationsService.js');
    await notifications.sendNotification({
      type: 'story_collaboration',
      recipientId: collaboratorId,
      senderId: currentUser.uid,
      title: 'Story collaboration invite',
      message: `${currentUser.displayName || `user ${String(currentUser.uid).slice(0, 6)}`} invited you to collaborate on a story`,
      metadata: { storyId },
    });
    return { success: true };
  }

  async removeCollaborator(storyId, collaboratorId) {
    await this.ensureInitialized();
    const currentUser = this.auth.currentUser;
    if (!currentUser) throw enhanceError({ code: 'unauthenticated' }, 'Auth required');
    const storyRef = this.fs.doc(this.firestore, 'stories', storyId);
    await this.fs.updateDoc(storyRef, {
      collaborators: this.fs.arrayRemove(collaboratorId),
      updatedAt: serverTimestamp(),
    });
    return { success: true };
  }

  async saveTemplate(name, storyData) {
    await this.ensureInitialized();
    const currentUser = this.auth.currentUser;
    if (!currentUser) throw enhanceError({ code: 'unauthenticated' }, 'Auth required');
    const templatesRef = this.fs.collection(this.firestore, 'users', currentUser.uid, 'story_templates');
    const countSnap = await this.fs.getDocs(
      this.fs.query(templatesRef, this.fs.limit(STORY_CONFIG.TEMPLATES.MAX_USER_TEMPLATES))
    );
    if (countSnap.size >= STORY_CONFIG.TEMPLATES.MAX_USER_TEMPLATES) {
      throw new Error(`Max ${STORY_CONFIG.TEMPLATES.MAX_USER_TEMPLATES} templates reached`);
    }
    const templateId = this.fs.doc(templatesRef).id;
    await this.fs.setDoc(this.fs.doc(templatesRef, templateId), {
      id: templateId,
      name,
      data: storyData,
      createdAt: serverTimestamp(),
    });
    return { success: true, templateId };
  }

  async getUserTemplates() {
    await this.ensureInitialized();
    const currentUser = this.auth.currentUser;
    if (!currentUser) throw enhanceError({ code: 'unauthenticated' }, 'Auth required');
    const snap = await this.fs.getDocs(
      this.fs.query(
        this.fs.collection(this.firestore, 'users', currentUser.uid, 'story_templates'),
        this.fs.limit(50)
      )
    );
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  }

  async deleteTemplate(templateId) {
    await this.ensureInitialized();
    const currentUser = this.auth.currentUser;
    if (!currentUser) throw enhanceError({ code: 'unauthenticated' }, 'Auth required');
    await this.fs.deleteDoc(this.fs.doc(this.firestore, 'users', currentUser.uid, 'story_templates', templateId));
    return { success: true };
  }

  async archiveStory(storyId, userId = null) {
    await this.ensureInitialized();
    const currentUser = this.auth.currentUser;
    const targetUserId = userId || currentUser?.uid;
    if (!currentUser || currentUser.uid !== targetUserId) throw enhanceError({ code: 'permission-denied' }, 'You can only archive your own stories');

    const storyResult = await this.getStory(storyId, targetUserId);
    if (!storyResult.success) throw new Error('Story not found');
    const story = storyResult.story;

    const archiveDocRef = this.fs.doc(this.firestore, 'archived_stories', storyId);
    const existing = await this.fs.getDoc(archiveDocRef);
    if (existing.exists()) return { success: true, alreadyArchived: true };

    await this.fs.setDoc(archiveDocRef, {
      ...story,
      originalStoryId: storyId,
      archivedAt: serverTimestamp(),
      userId: targetUserId,
    });
    this.archivedStoriesCache.delete(targetUserId);
    return { success: true };
  }

  async getArchivedStories(userId, options = {}) {
    await this.ensureInitialized();
    const currentUser = this.auth.currentUser;
    if (!currentUser || currentUser.uid !== userId) throw enhanceError({ code: 'permission-denied' }, 'You can only view your own archive');

    const cacheKey = userId;
    const cached = this.archivedStoriesCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < STORY_CONFIG.CACHE.ARCHIVED_STORIES_TTL) {
      return { success: true, stories: cached.data, cached: true };
    }

    const q = this.fs.query(
      this.fs.collection(this.firestore, 'archived_stories'),
      this.fs.where('userId', '==', userId),
      this.fs.orderBy('archivedAt', 'desc'),
      this.fs.limit(options.limit || 50)
    );
    const snap = await this.fs.getDocs(q);
    const stories = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    this.archivedStoriesCache.set(cacheKey, { data: stories, timestamp: Date.now() });
    return { success: true, stories };
  }

  async createHighlight(userId, name, storyIds = [], options = {}) {
    await this.ensureInitialized();
    const currentUser = this.auth.currentUser;
    if (!currentUser || currentUser.uid !== userId) throw enhanceError({ code: 'permission-denied' }, 'You can only create your own highlights');

    const highlightsRef = this.fs.collection(this.firestore, 'highlights');
    const highlightId = this.fs.doc(highlightsRef).id;
    const now = serverTimestamp();

    await this.fs.setDoc(this.fs.doc(this.firestore, 'highlights', highlightId), {
      id: highlightId,
      userId,
      name,
      title: name,
      emoji: options.emoji || null,
      coverUrl: options.coverUrl || null,
      createdAt: now,
      updatedAt: now,
      storyCount: 0,
    });
    if (storyIds.length) {
      for (const sid of storyIds) await this.addToHighlight(highlightId, sid);
    }
    this.highlightsCache.delete(userId);
    return { success: true, highlightId };
  }

  async addToHighlight(highlightId, storyId) {
    await this.ensureInitialized();
    const currentUser = this.auth.currentUser;
    if (!currentUser) throw enhanceError({ code: 'unauthenticated' }, 'Auth required');

    const highlightRef = this.fs.doc(this.firestore, 'highlights', highlightId);
    const highlightSnap = await this.fs.getDoc(highlightRef);
    if (!highlightSnap.exists()) throw new Error('Highlight not found');
    const highlight = highlightSnap.data();
    if (highlight.userId !== currentUser.uid) throw enhanceError({ code: 'permission-denied' }, 'You can only add to your own highlights');

    let story = null;
    const storyResult = await this.getStory(storyId, currentUser.uid);
    if (storyResult.success) story = storyResult.story;
    else {
      const archiveSnap = await this.fs.getDoc(this.fs.doc(this.firestore, 'archived_stories', storyId));
      if (archiveSnap.exists()) story = archiveSnap.data();
      else throw new Error('Story not found or inaccessible');
    }

    const highlightStoriesRef = this.fs.collection(this.firestore, 'highlights', highlightId, 'highlightStories');
    const existingQuery = this.fs.query(highlightStoriesRef, this.fs.where('storyId', '==', storyId), this.fs.limit(1));
    const existingSnap = await this.fs.getDocs(existingQuery);
    if (!existingSnap.empty) return { success: true, alreadyAdded: true };

    await this.fs.setDoc(this.fs.doc(highlightStoriesRef, storyId), {
      storyId, originalStoryId: storyId, userId: story.userId, type: story.type,
      content: story.content, media: story.media, music: story.music,
      backgroundColor: story.backgroundColor, textColor: story.textColor, font: story.font,
      createdAt: story.createdAt, addedAt: serverTimestamp(),
    });
    await this.fs.updateDoc(highlightRef, {
      storyCount: increment(1),
      updatedAt: serverTimestamp(),
    });
    this.highlightsCache.delete(highlight.userId);
    return { success: true };
  }

  async removeFromHighlight(highlightId, storyId) {
    await this.ensureInitialized();
    const currentUser = this.auth.currentUser;
    if (!currentUser) throw enhanceError({ code: 'unauthenticated' }, 'Auth required');

    const highlightRef = this.fs.doc(this.firestore, 'highlights', highlightId);
    const highlightSnap = await this.fs.getDoc(highlightRef);
    if (!highlightSnap.exists()) throw new Error('Highlight not found');
    const highlight = highlightSnap.data();
    if (highlight.userId !== currentUser.uid) throw enhanceError({ code: 'permission-denied' }, 'You can only remove from your own highlights');

    await this.fs.deleteDoc(this.fs.doc(this.firestore, 'highlights', highlightId, 'highlightStories', storyId));
    await this.fs.updateDoc(highlightRef, {
      storyCount: increment(-1),
      updatedAt: serverTimestamp(),
    });
    this.highlightsCache.delete(highlight.userId);
    return { success: true };
  }

  async updateHighlight(userId, highlightId, updates = {}) {
    await this.ensureInitialized();
    const currentUser = this.auth.currentUser;
    if (!currentUser || (currentUser.uid !== userId && currentUser.id !== userId)) {
      throw enhanceError({ code: 'permission-denied' }, 'You can only edit your own highlights');
    }

    const highlightRef = this.fs.doc(this.firestore, 'highlights', highlightId);
    const highlightSnap = await this.fs.getDoc(highlightRef);
    if (!highlightSnap.exists()) throw new Error('Highlight not found');
    const data = highlightSnap.data();
    if (data.userId !== currentUser.uid && data.userId !== currentUser.id) {
      throw enhanceError({ code: 'permission-denied' }, 'You can only edit your own highlights');
    }

    const cleanedUpdates = {
      ...updates,
      updatedAt: serverTimestamp(),
    };
    if (updates.title) cleanedUpdates.name = updates.title;
    if (updates.name) cleanedUpdates.title = updates.name;

    await this.fs.updateDoc(highlightRef, cleanedUpdates);
    this.highlightsCache.delete(userId);
    return { success: true };
  }

  async deleteHighlight(userId, highlightId) {
    await this.ensureInitialized();
    const currentUser = this.auth.currentUser;
    if (!currentUser || (currentUser.uid !== userId && currentUser.id !== userId)) {
      throw enhanceError({ code: 'permission-denied' }, 'You can only delete your own highlights');
    }

    const highlightRef = this.fs.doc(this.firestore, 'highlights', highlightId);
    const highlightSnap = await this.fs.getDoc(highlightRef);
    if (highlightSnap.exists()) {
      const data = highlightSnap.data();
      if (data.userId !== currentUser.uid && data.userId !== currentUser.id) {
        throw enhanceError({ code: 'permission-denied' }, 'You can only delete your own highlights');
      }
    }

    await this.fs.deleteDoc(highlightRef);
    this.highlightsCache.delete(userId);
    return { success: true };
  }

  async reorderHighlights(orderedIds = []) {
    await this.ensureInitialized();
    const currentUser = this.auth.currentUser;
    if (!currentUser) throw enhanceError({ code: 'unauthenticated' }, 'Auth required');
    const cleanIds = [...new Set((orderedIds || []).map((id) => String(id || '').trim()).filter(Boolean))];
    if (!cleanIds.length) return { success: true, orderedIds: [] };

    const { callFunction, FUNCTIONS } = await import('./callableService.js');
    const res = await callFunction(FUNCTIONS.REORDER_HIGHLIGHTS, { orderedIds: cleanIds });
    this.highlightsCache.delete(currentUser.uid);
    return { success: true, ...(res || {}) };
  }

  async getHighlights(userId, options = {}) {
    await this.ensureInitialized();

    const cacheKey = userId;
    if (!options.bypassCache) {
      const cached = this.highlightsCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < STORY_CONFIG.CACHE.HIGHLIGHTS_TTL) {
        return { success: true, highlights: cached.data, cached: true };
      }
    }

    const sortHighlights = (list) => {
      return [...list].sort((a, b) => {
        const orderA = Number.isFinite(Number(a?.sortOrder)) ? Number(a.sortOrder) : Number.MAX_SAFE_INTEGER;
        const orderB = Number.isFinite(Number(b?.sortOrder)) ? Number(b.sortOrder) : Number.MAX_SAFE_INTEGER;
        if (orderA !== orderB) return orderA - orderB;
        const tA = a?.createdAt?.toMillis?.() || new Date(a?.createdAt || 0).getTime() || 0;
        const tB = b?.createdAt?.toMillis?.() || new Date(b?.createdAt || 0).getTime() || 0;
        return tB - tA;
      });
    };

    try {
      const q = this.fs.query(
        this.fs.collection(this.firestore, 'highlights'),
        this.fs.where('userId', '==', userId),
        this.fs.orderBy('createdAt', 'desc'),
        this.fs.limit(options.limit || 50)
      );
      const snap = await this.fs.getDocs(q);
      const highlights = sortHighlights(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      this.highlightsCache.set(cacheKey, { data: highlights, timestamp: Date.now() });
      return { success: true, highlights };
    } catch (err) {
      // Fallback query without orderBy in case composite index is still building
      try {
        const fallbackQ = this.fs.query(
          this.fs.collection(this.firestore, 'highlights'),
          this.fs.where('userId', '==', userId),
          this.fs.limit(options.limit || 50)
        );
        const snap = await this.fs.getDocs(fallbackQ);
        const highlights = sortHighlights(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        return { success: true, highlights };
      } catch (innerErr) {
        logger.warn('[StoryService] getHighlights query note', innerErr);
        return { success: false, highlights: [], error: innerErr?.message || 'highlights-failed' };
      }
    }
  }

  async getUserStories(userId, options = {}) {
    await this.ensureInitialized();
    try {
      const q = this.fs.query(
        this.fs.collection(this.firestore, 'stories'),
        this.fs.where('userId', '==', userId),
        this.fs.where('isDeleted', '==', false),
        this.fs.limit(options.limit || 30)
      );
      const snap = await this.fs.getDocs(q);
      return snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(s => !this._isStoryExpired(s));
    } catch (err) {
      logger.warn('[StoryService] getUserStories error', err);
      return [];
    }
  }

  _isStoryExpired(story, now = Date.now()) {
    if (!story?.expiresAt) return false;
    const ms = story.expiresAt?.toDate
      ? story.expiresAt.toDate().getTime()
      : new Date(story.expiresAt).getTime();
    return Number.isFinite(ms) && ms <= now;
  }

  async getHighlightStories(highlightId, options = {}) {
    await this.ensureInitialized();
    const currentUser = this.auth.currentUser;
    if (!currentUser) throw enhanceError({ code: 'unauthenticated' }, 'Auth required');

    const highlightRef = this.fs.doc(this.firestore, 'highlights', highlightId);
    const highlightSnap = await this.fs.getDoc(highlightRef);
    if (!highlightSnap.exists()) throw new Error('Highlight not found');
    const highlightData = highlightSnap.data();
    const ownerId = highlightData.userId;
    const isOwner = ownerId === currentUser.uid;

    let edge = null;
    if (!isOwner && ownerId) {
      try {
        const { getSocialGraphService } = await import('./socialGraphService.js');
        edge = await getSocialGraphService().getRelationship(currentUser.uid, ownerId);
        if (edge?.isBlocking || edge?.isBlockedBy) {
          return { success: false, error: 'Unavailable', stories: [] };
        }
        const ownerSnap = await this.fs.getDoc(this.fs.doc(this.firestore, 'users', ownerId));
        if (ownerSnap.exists() && ownerSnap.data()?.isPrivate && !edge?.isFollowing) {
          return { success: false, error: 'Private account', stories: [] };
        }
      } catch (err) {
        logger.warn('[StoryService] Highlight relationship check failed; failing closed', { highlightId, error: err?.message });
        return { success: false, error: 'Access check failed', stories: [] };
      }
    }

    const q = this.fs.query(
      this.fs.collection(this.firestore, 'highlights', highlightId, 'highlightStories'),
      this.fs.orderBy('addedAt', 'desc'),
      this.fs.limit(options.limit || 50)
    );
    const snap = await this.fs.getDocs(q);
    const rawItems = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    // Filter deleted/rejected or visibility-restricted Vibes for non-owners
    const visibleStories = [];
    for (const item of rawItems) {
      if (item.isDeleted || item.moderationStatus === 'rejected') continue;
      if (!isOwner) {
        const sid = item.originalStoryId || item.storyId || item.id;
        try {
          const sourceSnap = await this.fs.getDoc(this.fs.doc(this.firestore, 'stories', sid));
          if (sourceSnap.exists()) {
            const src = sourceSnap.data();
            if (src.isDeleted || src.status === 'removed' || src.moderationStatus === 'rejected') continue;
            const vis = src.visibility || item.visibility || STORY_CONFIG.VISIBILITY.PUBLIC;
            if (vis === STORY_CONFIG.VISIBILITY.PRIVATE) continue;
            if (vis === STORY_CONFIG.VISIBILITY.SELECTED && !(Array.isArray(src.selectedUserIds) && src.selectedUserIds.includes(currentUser.uid))) continue;
            if (vis === STORY_CONFIG.VISIBILITY.CLOSE_CIRCLE) {
              const ccSnap = await this.fs.getDoc(this.fs.doc(this.firestore, 'users', ownerId, 'close_circle', currentUser.uid)).catch(() => null);
              if (!ccSnap?.exists?.()) continue;
            }
            if (vis === STORY_CONFIG.VISIBILITY.FOLLOWERS && !edge?.isFollowing) continue;
            if (vis === STORY_CONFIG.VISIBILITY.CONNECTIONS && !(edge?.isMutualFriend || (edge?.isFollowing && edge?.isFollower))) continue;
          }
        } catch (err) {
          logger.debug('[StoryService] Highlight item check failed', { sid, error: err?.message });
          continue;
        }
      }
      visibleStories.push(item);
    }

    return { success: true, stories: visibleStories };
  }

  async getStoryInsights(storyId) {
    await this.ensureInitialized();
    const currentUser = this.auth.currentUser;
    if (!currentUser) throw enhanceError({ code: 'unauthenticated' }, 'Auth required');

    try {
      const { callFunction, FUNCTIONS } = await import('./callableService.js');
      const res = await callFunction(FUNCTIONS.GET_VIBE_INSIGHTS, { vibeId: storyId });
      if (res?.success && res.insights) {
        return {
          success: true,
          insights: {
            ...res.insights,
            comments: unknownNumber(res.insights.comments),
            backTaps: unknownNumber(res.insights.backTaps),
          },
        };
      }
    } catch (err) {
      const code = String(err?.code || '');
      if (code.includes('permission-denied') || code.includes('not-found')) {
        throw err;
      }
      logger.warn('[StoryService] getVibeInsights callable fallback to read-only stats', { storyId, error: err?.message });
    }

    const storyResult = await this.getStory(storyId, currentUser.uid);
    if (!storyResult.success || storyResult.story.userId !== currentUser.uid) throw new Error('Not allowed');

    const story = storyResult.story;
    const [realViews, reactionCounts] = await Promise.all([
      this._getShardedViewCount(storyId),
      this._getShardedReactionCounts(storyId)
    ]);
    return {
      success: true,
      insights: {
        views: realViews,
        reactions: reactionCounts,
        comments: unknownNumber(story.stats?.comments),
        shares: unknownNumber(story.stats?.shares),
        replies: unknownNumber(story.stats?.replies),
        completionRate: unknownNumber(story.stats?.completionRate),
        forwardTaps: unknownNumber(story.stats?.forwardTaps),
        backTaps: unknownNumber(story.stats?.backTaps),
        createdAt: story.createdAt,
        expiresAt: story.expiresAt,
        type: story.type,
      }
    };
  }

  async reportStory(storyId, reason, details = '') {
    await this.ensureInitialized();
    const { callFunction, FUNCTIONS } = await import('./callableService.js');
    const res = await callFunction(FUNCTIONS.REPORT_STORY, {
      targetId: storyId,
      storyId,
      reason,
      details,
    });
    return { success: true, ...(res || {}) };
  }

  async reportVibeReply(replyId, reason, details = '') {
    await this.ensureInitialized();
    const { callFunction, FUNCTIONS } = await import('./callableService.js');
    const res = await callFunction(FUNCTIONS.REPORT_VIBE_REPLY, {
      targetId: replyId,
      replyId,
      reason,
      details,
    });
    return { success: true, ...(res || {}) };
  }

  async getStoryByIdForDeepLink(storyId, viewerId = null) {
    await this.ensureInitialized();
    const currentUserId = viewerId || this.auth.currentUser?.uid;
    if (!currentUserId) return { success: false, story: null, unavailableReason: 'unauthenticated' };
    try {
      const snap = await this.fs.getDoc(this.fs.doc(this.firestore, 'stories', storyId));
      if (!snap.exists()) return { success: false, story: null, unavailableReason: 'not_found' };
      const story = { id: snap.id, ...snap.data() };
      if (story.isDeleted || story.status === 'removed' || story.moderationStatus === 'rejected') {
        return { success: false, story: null, unavailableReason: 'deleted' };
      }
      if (this._isStoryExpired(story)) {
        return { success: false, story: null, unavailableReason: 'expired' };
      }
      const allowed = await this._canViewStory(story, currentUserId);
      if (!allowed) {
        return { success: false, story: null, unavailableReason: 'restricted' };
      }
      return { success: true, story, unavailableReason: null };
    } catch (err) {
      const msg = String(err?.code || err?.message || '').toLowerCase();
      if (msg.includes('permission') || msg.includes('denied')) {
        return { success: false, story: null, unavailableReason: 'restricted' };
      }
      return { success: false, story: null, unavailableReason: 'not_found' };
    }
  }

  subscribeToInsights(storyId, callback) {
    const storyRef = this.fs.doc(this.firestore, 'stories', storyId);
    return this.fs.onSnapshot(storyRef, async (snap) => {
      if (!snap.exists()) return callback(null);
      const story = snap.data();
      const [views, reactions] = await Promise.all([
        this._getShardedViewCount(storyId),
        this._getShardedReactionCounts(storyId)
      ]);
      callback({
        views,
        reactions,
        comments: unknownNumber(story.stats?.comments),
        shares: unknownNumber(story.stats?.shares),
        replies: unknownNumber(story.stats?.replies),
        completionRate: unknownNumber(story.stats?.completionRate),
        forwardTaps: unknownNumber(story.stats?.forwardTaps),
        backTaps: unknownNumber(story.stats?.backTaps),
      });
    }, (err) => logger.warn('[storyService] subscription error', err));
  }

  async searchStories({ query, location, music, hashtag, limit = 20 } = {}) {
    await this.ensureInitialized();
    const storiesRef = this.fs.collection(this.firestore, 'stories');
    const conditions = [
      this.fs.where('isDeleted', '==', false),
      this.fs.where('expiresAt', '>=', new Date()),
      this.fs.where('moderationStatus', '!=', 'rejected'),
    ];
    if (hashtag) conditions.push(this.fs.where('hashtags', 'array-contains', `#${hashtag}`));
    if (location) conditions.push(this.fs.where('location', '==', location));
    if (music) conditions.push(this.fs.where('music.id', '==', music));

    if (query) {
      // Firestore only supports one range per query; search on content prefix
      const q = this.fs.query(storiesRef, ...conditions, this.fs.where('content', '>=', query), this.fs.where('content', '<=', query + '\uf8ff'), this.fs.limit(limit));
      const snap = await this.fs.getDocs(q);
      return { success: true, stories: snap.docs.map(d => ({ id: d.id, ...d.data() })) };
    } else {
      const snap = await this.fs.getDocs(
        this.fs.query(storiesRef, ...conditions, this.fs.orderBy('createdAt', 'desc'), this.fs.limit(limit))
      );
      return { success: true, stories: snap.docs.map(d => ({ id: d.id, ...d.data() })) };
    }
  }

  getTemplates() {
    return [
      { id: 'modern', name: 'Modern', backgroundColor: '#000000', textColor: '#FFFFFF', font: 'sans-serif' },
      { id: 'gradient', name: 'Gradient', backgroundColor: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', textColor: '#FFFFFF', font: 'serif' },
      { id: 'minimal', name: 'Minimal', backgroundColor: '#FFFFFF', textColor: '#000000', font: 'monospace' },
      { id: 'vibrant', name: 'Vibrant', backgroundColor: '#FF6B6B', textColor: '#FFFFFF', font: 'sans-serif' },
    ];
  }

  async exportUserData(userId) {
    await this.ensureInitialized();
    const data = { stories: [], archived: [], highlights: [] };
    const sSnap = await this.fs.getDocs(
      this.fs.query(
        this.fs.collection(this.firestore, 'stories'),
        this.fs.where('userId', '==', userId),
        this.fs.limit(200)
      )
    );
    data.stories = sSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    const aSnap = await this.fs.getDocs(
      this.fs.query(
        this.fs.collection(this.firestore, 'archived_stories'),
        this.fs.where('userId', '==', userId),
        this.fs.limit(200)
      )
    );
    data.archived = aSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    const hSnap = await this.fs.getDocs(
      this.fs.query(
        this.fs.collection(this.firestore, 'highlights'),
        this.fs.where('userId', '==', userId),
        this.fs.limit(200)
      )
    );
    data.highlights = hSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    return data;
  }

  async cleanupExpiredStories() {
    await this.ensureInitialized();
    logger.warn('// Running expired story cleanup...');
    const now = new Date();
    const q = this.fs.query(
      this.fs.collection(this.firestore, 'stories'),
      this.fs.where('expiresAt', '<=', now),
      this.fs.where('isDeleted', '==', false),
      this.fs.limit(500)
    );
    const snap = await this.fs.getDocs(q);
    let processed = 0;
    for (const docSnap of snap.docs) {
      const story = docSnap.data();
      const storyId = docSnap.id;
      try {
        if (STORY_CONFIG.ARCHIVE.ENABLED && STORY_CONFIG.ARCHIVE.AUTO_ARCHIVE_AFTER_EXPIRY) {
          await this.archiveStory(storyId, story.userId).catch((e) =>
            logger.warn('Story auto-archive failed', { storyId, error: e?.message }));
        }
        await this.fs.updateDoc(docSnap.ref, { isDeleted: true });
        this.storyCache.delete(storyId);
        this._invalidateFeedCache(story.userId);
        processed++;
      } catch (err) { logger.error(`[Story] Cleanup error ${storyId}:`, err); }
    }
    return { success: true, processed };
  }

  //  PRIVATE HELPERS (all fixed)

  _buildStorySnapshot(story) {
    return {
      id: story.id,
      userId: story.userId,
      type: story.type,
      content: story.content,
      media: story.media,
      music: story.music,
      location: story.location,
      backgroundColor: story.backgroundColor,
      textColor: story.textColor,
      font: story.font,
      isSponsored: story.isSponsored || false,
      moderationStatus: story.moderationStatus || 'pending',
      stats: story.stats,
      visibility: story.visibility,
      allowReactions: story.allowReactions,
      allowComments: story.allowComments,
      createdAt: story.createdAt,
      expiresAt: story.expiresAt,
      isDeleted: false,
    };
  }

  /**
 * feed scoring (spec §37/38/39/91):
   *  - recency (decay by age)
   *  - engagement QUALITY (reactions/comments/shares/replies, capped)
   *  - affinity = viewer follows the creator (was configured but never computed)
   *  - freshness = time remaining until expiry (gentle — never dominates)
   *  - diversity = per-creator cap so one creator cannot flood discovery
   * Deterministic (no randomness) so the feed is stable across devices.
   */
  async _applyFeedScoring(stories, userId) {
    const now = Date.now();
    const followMap = new Map();

    // Batch-check follow relationships via socialGraphService (no N+1 getDoc loop)
    const creatorIds = [...new Set(stories.map((s) => s.userId).filter(Boolean))];
    const missingIds = [];
    for (const cid of creatorIds) {
      if (cid === userId) { followMap.set(cid, true); continue; }
      if (this.followedUsersCache.has(cid)) {
        followMap.set(cid, this.followedUsersCache.get(cid));
      } else {
        missingIds.push(cid);
      }
    }
    if (missingIds.length > 0 && userId) {
      try {
        const { getSocialGraphService } = await import('./socialGraphService.js');
        const edgeMap = await getSocialGraphService().getEdgeSet(userId, missingIds, { include: ['follow'] });
        for (const cid of missingIds) {
          const follows = Boolean(edgeMap.get(cid)?.isFollowing);
          this.followedUsersCache.set(cid, follows);
          followMap.set(cid, follows);
        }
      } catch {
        for (const cid of missingIds) followMap.set(cid, false);
      }
    }

    const EXPIRY_MS = STORY_CONFIG.EXPIRY_HOURS * 3600000;
    const scored = stories.map((s) => {
      const createdAt = s.createdAt?.toDate?.() || 0;
      const ageHours = createdAt ? (now - createdAt) / 3600000 : 24;
      const recency = Math.exp(-ageHours / 2);

      const stats = s.stats || {};
      const totalEngagement = Object.values(stats.reactions || {}).reduce((a, b) => a + b, 0) +
        (stats.comments || 0) * 2 + (stats.shares || 0) * 3 + (stats.replies || 0) * 2;
      const engagement = Math.min(totalEngagement, 100) / 100;

      // Affinity: following the creator is the strongest relationship signal.
      const affinity = followMap.get(s.userId) ? 1 : 0.1;

      // Freshness: remaining time fraction (spec §39) — gentle 0.8–1.2 band.
      let remainingFactor = 1;
      if (s.expiresAt?.toDate) {
        const remainingMs = s.expiresAt.toDate().getTime() - now;
        if (remainingMs > 0) {
          const fraction = Math.min(1, remainingMs / EXPIRY_MS);
          remainingFactor = 0.8 + 0.4 * fraction;
        } else {
          remainingFactor = 0; // expired — will be filtered by rules anyway
        }
      }

      const w = STORY_CONFIG.FEED.SCORE_WEIGHTS;
      const score = (recency * w.recency + engagement * w.engagement + affinity * w.affinity) * remainingFactor;
      return { ...s, _score: score };
    });

    scored.sort((a, b) => b._score - a._score);

    // DIVERSITY (spec §38): cap stories per creator in discovery so one
    // creator cannot flood the feed; their other Vibes live in their own
    // sequence inside the dedicated viewer.
    const perCreatorCap = STORY_CONFIG.FEED.MAX_STORIES_PER_CREATOR || 4;
    const seen = new Map();
    const diverse = scored.filter((s) => {
      const c = (seen.get(s.userId) || 0) + 1;
      if (c > perCreatorCap) return false;
      seen.set(s.userId, c);
      return true;
    });

    return diverse;
  }

  async _recordStoryViewSharded(storyId, viewerId) {
    const shardId = Math.floor(Math.random() * STORY_CONFIG.SHARDED_COUNTERS.VIEW_SHARDS);
    const shardRef = this.fs.doc(this.firestore, 'stories', storyId, 'view_shards', `shard_${shardId}`);
    const viewerDocRef = this.fs.doc(this.firestore, 'stories', storyId, 'viewers', viewerId);

    // Check if already viewed (idempotent)
    const existingView = await this.fs.getDoc(viewerDocRef);
    if (existingView.exists()) return;

    await this.fs.setDoc(viewerDocRef, { userId: viewerId, viewedAt: serverTimestamp() });
    await this.fs.updateDoc(shardRef, { count: increment(1), updatedAt: serverTimestamp() }).catch(async (err) => {
      if (err.code === 'not-found') {
        await this.fs.setDoc(shardRef, { count: 1, updatedAt: serverTimestamp() });
      } else throw err;
    });
    await this._markStorySeen(viewerId, storyId);
    this.metrics.storiesViewed++;
  }

  async _getShardedViewCount(storyId) {
    const shardsSnap = await this.fs.getDocs(
      this.fs.query(
        this.fs.collection(this.firestore, 'stories', storyId, 'view_shards'),
        this.fs.limit(STORY_CONFIG.SHARDED_COUNTERS.VIEW_SHARDS)
      )
    );
    let total = 0;
    shardsSnap.docs.forEach(d => total += d.data().count || 0);
    return total;
  }

  async _recordReactionShard(storyId, reactionType, delta) {
    const shardId = Math.floor(Math.random() * STORY_CONFIG.SHARDED_COUNTERS.REACTION_SHARDS);
    const shardRef = this.fs.doc(this.firestore, 'stories', storyId, 'reaction_shards', `shard_${shardId}`);
    try {
      await this.fs.updateDoc(shardRef, {
        [reactionType]: increment(delta),
        updatedAt: serverTimestamp()
      });
    } catch (err) {
      if (err.code === 'not-found') {
        await this.fs.setDoc(shardRef, {
          [reactionType]: delta,
          updatedAt: serverTimestamp()
        });
      } else throw err;
    }
  }

  async _getShardedReactionCounts(storyId) {
    const shardsSnap = await this.fs.getDocs(
      this.fs.query(
        this.fs.collection(this.firestore, 'stories', storyId, 'reaction_shards'),
        this.fs.limit(STORY_CONFIG.SHARDED_COUNTERS.REACTION_SHARDS)
      )
    );
    const counts = {};
    shardsSnap.docs.forEach(d => {
      const data = d.data();
      STORY_CONFIG.REACTION_TYPES.forEach(r => { counts[r] = (counts[r] || 0) + (data[r] || 0); });
    });
    return counts;
  }

  async _getSeenStatus(userId, storyIds) {
    if (!storyIds.length) return {};
    const seen = {};
    const chunks = [];
    for (let i = 0; i < storyIds.length; i += STORY_CONFIG.BATCH_SIZE.SEEN_STORIES) {
      chunks.push(storyIds.slice(i, i + STORY_CONFIG.BATCH_SIZE.SEEN_STORIES));
    }
    for (const chunk of chunks) {
      const snap = await this.fs.getDocs(
        this.fs.query(
          this.fs.collection(this.firestore, 'users', userId, 'storySeen'),
          this.fs.where('storyId', 'in', chunk),
          this.fs.limit(STORY_CONFIG.BATCH_SIZE.SEEN_STORIES)
        )
      );
      snap.docs.forEach(d => { seen[d.data().storyId] = true; });
    }
    return seen;
  }

  async _markStorySeen(userId, storyId) {
    await this.fs.setDoc(
      this.fs.doc(this.firestore, 'users', userId, 'storySeen', storyId),
      { storyId, viewedAt: serverTimestamp() },
      { merge: true }
    );
  }

  _groupStoriesByUser(stories) {
    const groups = new Map();
    for (const story of stories) {
      if (!groups.has(story.userId)) groups.set(story.userId, { userId: story.userId, stories: [] });
      groups.get(story.userId).stories.push(story);
    }
    return Array.from(groups.values()).sort((a, b) => {
      const aT = a.stories[0]?.createdAt?.toDate?.() || 0;
      const bT = b.stories[0]?.createdAt?.toDate?.() || 0;
      return bT - aT;
    });
  }

  preloadStories(stories) {
    const toPreload = stories.slice(0, STORY_CONFIG.FEED.PRELOAD_COUNT);
    toPreload.forEach(story => {
      if (story.media?.url) {
        const link = document.createElement('link');
        link.rel = 'preload';
        link.as = story.type === 'image' ? 'image' : 'video';
        link.href = story.media.url;
        document.head.appendChild(link);
      }
    });
  }

  async _fetchSponsoredStoryPool() {
    const now = Date.now();
    if (this.sponsoredStoriesCache.stories.length && now - this.sponsoredStoriesCache.lastFetched < STORY_CONFIG.CACHE.SPONSORED_STORIES_REFRESH_MS) {
      return this.sponsoredStoriesCache.stories;
    }
    const snap = await this.fs.getDocs(
      this.fs.query(this.fs.collection(this.firestore, 'stories'),
        this.fs.where('isSponsored', '==', true),
        this.fs.where('expiresAt', '>=', new Date()),
        this.fs.where('isDeleted', '==', false),
        this.fs.where('moderationStatus', '==', 'approved'),
        this.fs.limit(STORY_CONFIG.CACHE.SPONSORED_STORIES_POOL_SIZE))
    );
    const stories = snap.docs.map(d => ({ id: d.id, ...d.data(), isAd: true }));
    this.sponsoredStoriesCache = { stories, lastFetched: now };
    return stories;
  }

  async _insertSponsoredStories(stories, userId) {
    const sponsoredPool = await this._fetchSponsoredStoryPool();
    if (sponsoredPool.length === 0) return stories;

    const lastAdKey = `lastAdImpression_${userId}`;
    const lastAd = localStorage.getItem(lastAdKey);
    if (lastAd && Date.now() - parseInt(lastAd) < STORY_CONFIG.ADS.FREQ_CAP_MINUTES * 60 * 1000) return stories;
    // The per-user ad frequency cap is enforced locally (`lastAdKey`). The
    // former server-side cap read `users/{uid}.lastAdImpression`, but NO writer
    // ever sets that field (the `users/{uid}` write is denied by the rules and
    // no server path mirrors it), so the read always returned undefined — a
    // wasted read on every story fetch, plus an unguarded `.toDate()`. Removed
    // rather than left as a control that can never trip.

    let targetingProfile = {};
    try {
      const userService = await import('./userService.js');
      targetingProfile = await userService.getUserProfile(userId).catch(() => ({}));
    } catch (e) {
      // Targeting profile unavailable — ads fall back to untargeted.
      logger.warn('Story ad targeting profile unavailable', { userId, error: e?.message });
    }

    const targetedAds = sponsoredPool.filter(ad => {
      if (!ad.targeting) return true;
      for (const field of STORY_CONFIG.ADS.TARGETING_FIELDS) {
        if (ad.targeting[field] && targetingProfile[field] !== ad.targeting[field]) return false;
      }
      return true;
    });
    if (targetedAds.length === 0) return stories;

    const result = [];
    let storyIdx = 0, adIdx = 0;
    for (const story of stories) {
      result.push(story);
      storyIdx++;
      if (storyIdx % STORY_CONFIG.FEED.AD_INTERVAL === 0 && adIdx < targetedAds.length) {
        const ad = targetedAds[adIdx % targetedAds.length];
        result.push({ ...ad, isAd: true });
        adIdx++;
        this.metrics.sponsoredImpressions++;
        localStorage.setItem(lastAdKey, Date.now().toString());
        // Impressions are recorded server-side by the canonical
        // recordAdImpression callable (ad_impressions is server-write-only).
        // A direct addDoc here was always denied by the rules, and the
        // `users/{uid}.lastAdImpression` write was likewise denied, so both
        // were silent no-ops dressed up as success.
        await this._trackAdImpression(ad.id, userId);
      }
    }
    return result;
  }

  async _trackAdImpression(adId, userId) {
    // ad_impressions is server-write-only. The only honest path is the
    // recordAdImpression callable, which the monetization service owns.
    const { getMonetizationService } = await import('./monetizationService.js');
    await getMonetizationService().recordAdImpression(adId, 'stories', { userId });
  }

  _moderateContent(data) {
    if (!data.content) return { passed: true };
    const lower = data.content.toLowerCase();
    for (const word of STORY_CONFIG.MODERATION.PROFANITY_LIST) {
      if (lower.includes(word)) return { passed: false, reason: 'profanity' };
    }
    const hashtags = (data.content.match(/#\w+/g) || []).map(t => t.toLowerCase());
    for (const tag of hashtags) {
      if (STORY_CONFIG.MODERATION.BLOCKED_HASHTAGS.includes(tag)) return { passed: false, reason: 'blocked hashtag' };
    }
    return { passed: true };
  }

  async _uploadStoryMedia(file, userId, type, onProgress, uploadOptions = {}) {
    const maxSize = type === 'image' ? STORY_CONFIG.MAX_IMAGE_SIZE_MB * 1024 * 1024
                  : type === 'video' ? STORY_CONFIG.MAX_VIDEO_SIZE_MB * 1024 * 1024
                  : STORY_CONFIG.MAX_AUDIO_SIZE_MB * 1024 * 1024;
    if (file.size > maxSize) throw new Error(`File too large.`);
    const ext = file.name.split('.').pop() || 'bin';
    const stampName = `${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
    const vis = uploadOptions.visibility || STORY_CONFIG.VISIBILITY.PUBLIC;
    const storyId = uploadOptions.storyId;
    const path = vis === STORY_CONFIG.VISIBILITY.PRIVATE && storyId
      ? `stories/${userId}/private/${storyId}/${stampName}`
      : (['followers', 'connections', 'close_circle', 'selected'].includes(vis) && storyId)
        ? `stories/${userId}/audience/${storyId}/${stampName}`
        : `stories/${userId}/${stampName}`;
    const fileRef = this.st.ref(this.storage, path);
    const uploadTask = this.st.uploadBytesResumable(fileRef, file, {
      contentType: file.type,
      customMetadata: { userId, storyType: type, visibility: vis },
    });
    const uploadId = uploadOptions.uploadId || stampName;
    const handle = { task: uploadTask, path, cancelled: false, cancel: () => this.cancelUpload(uploadId) };
    this.activeUploads.set(uploadId, handle);
    try { uploadOptions.onUploadHandle?.(handle); } catch (e) { logger.debug('[Vibes] onUploadHandle failed', { error: e?.message }); }

    const abortHandler = () => { this.cancelUpload(uploadId); };
    if (uploadOptions.abortSignal) {
      if (uploadOptions.abortSignal.aborted) {
        await this.cancelUpload(uploadId);
        throw enhanceError({ code: 'cancelled' }, 'Upload cancelled');
      }
      uploadOptions.abortSignal.addEventListener('abort', abortHandler, { once: true });
    }

    return new Promise((resolve, reject) => {
      uploadTask.on('state_changed',
        (snapshot) => {
          const total = snapshot.totalBytes || file.size || 1;
          const progress = Math.min(100, Math.round((snapshot.bytesTransferred / total) * 100));
          onProgress?.(progress, snapshot);
        },
        (error) => {
          this.activeUploads.delete(uploadId);
          uploadOptions.abortSignal?.removeEventListener?.('abort', abortHandler);
          reject(enhanceError(error, handle.cancelled ? 'Upload cancelled' : 'Upload failed'));
        },
        async () => {
          this.activeUploads.delete(uploadId);
          uploadOptions.abortSignal?.removeEventListener?.('abort', abortHandler);
          if (handle.cancelled) {
            await this.deleteAbandonedMedia(path);
            reject(enhanceError({ code: 'cancelled' }, 'Upload cancelled'));
            return;
          }
          const url = await this.st.getDownloadURL(uploadTask.snapshot.ref);
          resolve({ url, path, size: file.size, type: file.type, name: file.name });
        }
      );
    });
  }

  async _safeCompressImage(file) {
    if (!file.type.startsWith('image/') || file.type === 'image/gif') return file;
    try { return await this._compressImage(file); } catch (err) { return file; }
  }

  async _compressImage(file) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const objectUrl = URL.createObjectURL(file);
      const cleanupUrl = () => {
        try { URL.revokeObjectURL(objectUrl); } catch { /* noop */ }
      };
      img.onload = () => {
        cleanupUrl();
        const canvas = document.createElement('canvas');
        let { width, height } = img;
        const { MAX_WIDTH, MAX_HEIGHT, QUALITY } = STORY_CONFIG.IMAGE_COMPRESSION;
        if (width > MAX_WIDTH || height > MAX_HEIGHT) {
          const ratio = Math.min(MAX_WIDTH / width, MAX_HEIGHT / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }
        canvas.width = width; canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob(
          (blob) => {
            if (!blob) return reject(new Error('Compression produced empty blob'));
            resolve(new File([blob], file.name, { type: file.type, lastModified: Date.now() }));
          },
          file.type, QUALITY
        );
      };
      img.onerror = () => {
        cleanupUrl();
        reject(new Error('Failed to load image for compression'));
      };
      img.src = objectUrl;
    });
  }

  async _processOfflineQueue() {
    if (typeof navigator !== 'undefined' && !navigator.onLine) return;
    const items = await this.uploadQueue.getAll();
    if (!items.length) return;
    const CONCURRENCY = 2;
    for (let i = 0; i < items.length; i += CONCURRENCY) {
      const batch = items.slice(i, i + CONCURRENCY);
      await Promise.all(batch.map(async (item) => {
        try {
          await this.createStory(item.storyData, item.options);
          await this.uploadQueue.delete(item.id);
        } catch (err) { logger.error('[Story] Failed to upload queued story', err); }
      }));
    }
  }

  async _notifyTaggedUsers(storyId, ownerId, taggedUserIds) {
    if (!taggedUserIds.length) return;
    try {
      const notificationsService = await import('./notificationsService.js');
      const userService = await import('./userService.js');
      const ownerProfile = await userService.getUserProfile(ownerId).catch(() => null);
      const ownerName = (ownerProfile?.displayName && ownerProfile.displayName !== 'User')
        ? ownerProfile.displayName
        : `user ${String(ownerId).slice(0, 6)}`;
      for (const userId of taggedUserIds) {
        await notificationsService.sendNotification({
          type: notificationsService.TYPES.MENTION,
          recipientId: userId,
          senderId: ownerId,
          senderName: ownerName,
          title: 'You were tagged in a story',
          message: `${ownerName} tagged you in their story`,
          actionUrl: `/story/${storyId}`,
          metadata: { storyId },
          priority: 'high',
        }).catch((e) => logger.warn('Story tag notification failed', { storyId, error: e?.message }));
      }
    } catch (err) {
      logger.warn('Story tag notification failed', { storyId, error: err?.message });
    }
  }

  async _logStoryReply(storyId, fromUserId, toUserId) {
    // firestore.rules authorises the create on `userId == uid()` (or
    // `authorId`). The reply document must therefore carry the canonical
    // owner field — `fromUserId` alone was silently DENIED, so every story
    // reply failed to log. `fromUserId`/`toUserId` are kept for the record.
    await this.fs.addDoc(this.fs.collection(this.firestore, 'story_replies'), {
      storyId,
      userId: fromUserId,
      fromUserId,
      toUserId,
      timestamp: serverTimestamp(),
    });
  }

  _validateStory(data) {
    const errors = [];
    if (!STORY_CONFIG.ALLOWED_MEDIA_TYPES.includes(data.type)) errors.push(`Invalid type: ${data.type}`);
    if (data.type === 'text' && (!data.content || !data.content.trim())) errors.push('Text story must have content');
    if (['image','video','audio'].includes(data.type) && !data.mediaFile) errors.push(`Media file required for ${data.type}`);
    if (data.visibility && !Object.values(STORY_CONFIG.VISIBILITY).includes(data.visibility)) errors.push(`Invalid visibility: ${data.visibility}`);
    return { valid: errors.length === 0, errors };
  }

  _invalidateFeedCache(userId) {
    for (const key of this.feedCache.keys()) {
      if (key.startsWith(`feed_${userId}`)) this.feedCache.delete(key);
    }
    cacheManager.invalidateUser(userId);
  }

  _invalidateStoryCache(storyId) {
    this.storyCache.delete(storyId);
  }

  _notifyCrossTab(action, userId, storyId = null) {
    if (this.crossTabChannel) this.crossTabChannel.postMessage({ action, userId, storyId });
  }

  async _canViewStory(story, viewerId) {
    if (!story || story.isDeleted) return false;
    if (story.status === 'expired' || story.status === 'removed') return false;
    if (story.moderationStatus === 'rejected' || story.moderationStatus === 'removed') return false;
    // Expiry is server-enforced by rules; mirror it here so the UI never
    // presents expired content as active (spec §6).
    if (this._isStoryExpired(story)) return false;
    if (story.userId === viewerId) return true;
    // Blocked in either direction = no access (spec §28).
    let edge = null;
    try {
      const { getSocialGraphService } = await import('./socialGraphService.js');
      edge = await getSocialGraphService().getRelationship(viewerId, story.userId);
      if (edge.isBlocking || edge.isBlockedBy) return false;
    } catch {
      return false;
    }
    if (story.visibility === STORY_CONFIG.VISIBILITY.PUBLIC) return true;
    if (story.visibility === STORY_CONFIG.VISIBILITY.FOLLOWERS) {
      return Boolean(edge?.isFollowing);
    }
    if (story.visibility === STORY_CONFIG.VISIBILITY.CONNECTIONS) {
      return Boolean(edge?.isMutualFriend || (edge?.isFollowing && edge?.isFollower));
    }
    if (story.visibility === STORY_CONFIG.VISIBILITY.CLOSE_CIRCLE) {
      try {
        const circleSnap = await this.fs.getDoc(
          this.fs.doc(this.firestore, 'users', story.userId, 'close_circle', viewerId)
        );
        return circleSnap.exists();
      } catch {
        return false;
      }
    }
    if (story.visibility === STORY_CONFIG.VISIBILITY.SELECTED) {
      return Array.isArray(story.selectedUserIds) && story.selectedUserIds.includes(viewerId);
    }
    if (story.visibility === STORY_CONFIG.VISIBILITY.PRIVATE) {
      return false; // only the creator (handled above)
    }
    return false;
  }

  clearCache() {
    this.feedCache.clear();
    this.storyCache.clear();
    this.followedUsersCache.clear();
    this.archivedStoriesCache.clear();
    this.highlightsCache.clear();
    if (this.crossTabChannel) this.crossTabChannel.postMessage({ action: 'clearAll' });
  }

  getStats() {
    return {
      cache: {
        feed: this.feedCache.size,
        story: this.storyCache.size,
        hits: this.metrics.cacheHits,
        misses: this.metrics.cacheMisses,
        hitRate: this.metrics.cacheHits / (this.metrics.cacheHits + this.metrics.cacheMisses) || 0,
      },
      metrics: { ...this.metrics },
      initialized: this.initialized,
    };
  }

  destroy() {
    this.clearCache();
    for (const unsub of this.feedListeners.values()) unsub();
    this.feedListeners.clear();
    if (this.crossTabChannel) {
      this.crossTabChannel.onmessage = null;
      this.crossTabChannel.close();
      this.crossTabChannel = null;
    }
    if (typeof window !== 'undefined') {
      window.removeEventListener('online', this._onlineHandler);
    }
    this.initialized = false;
    this.initPromise = null;
  }
}

let instance = null;
export function getStoryService() {
  if (!instance) instance = new UltimateStoryService();
  return instance;
}

const storyService = {
  initialize: () => getStoryService().initialize(),
  ensureInitialized: () => getStoryService().ensureInitialized(),
  createStory: (...args) => getStoryService().createStory(...args),
  getStoriesFeed: (...args) => getStoryService().getStoriesFeed(...args),
  getStory: (...args) => getStoryService().getStory(...args),
  getStoryByIdForDeepLink: (...args) => getStoryService().getStoryByIdForDeepLink(...args),
  recordVibeEngagement: (...args) => getStoryService().recordVibeEngagement(...args),
  reportStoryView: (...args) => getStoryService().reportStoryView(...args),
  markStorySeen: (userId, storyId) => getStoryService()._markStorySeen(userId, storyId),
  getStoryViewers: (...args) => getStoryService().getStoryViewers(...args),
  reactToStory: (...args) => getStoryService().reactToStory(...args),
  commentOnStory: (...args) => getStoryService().commentOnStory(...args),
  replyToStory: (...args) => getStoryService().replyToStory(...args),
  shareVibe: (...args) => getStoryService().shareVibe(...args),
  deleteStory: (...args) => getStoryService().deleteStory(...args),
  reportStory: (...args) => getStoryService().reportStory(...args),
  reportVibeReply: (...args) => getStoryService().reportVibeReply(...args),
  trackShare: (...args) => getStoryService().trackShare(...args),
  trackStoryAnalytics: (...args) => getStoryService().trackStoryAnalytics(...args),
  reportStoryCompletion: (...args) => getStoryService().reportStoryCompletion(...args),
  voteOnPoll: (...args) => getStoryService().voteOnPoll(...args),
  getPoll: (...args) => getStoryService().getPoll(...args),
  answerQuiz: (...args) => getStoryService().answerQuiz(...args),
  updateCountdown: (...args) => getStoryService().updateCountdown(...args),
  recordEmojiSlider: (...args) => getStoryService().recordEmojiSlider(...args),
  addCollaborator: (...args) => getStoryService().addCollaborator(...args),
  removeCollaborator: (...args) => getStoryService().removeCollaborator(...args),
  saveTemplate: (...args) => getStoryService().saveTemplate(...args),
  getUserTemplates: () => getStoryService().getUserTemplates(),
  deleteTemplate: (...args) => getStoryService().deleteTemplate(...args),
  subscribeToFeed: (...args) => getStoryService().subscribeToFeed(...args),
  subscribeToInsights: (...args) => getStoryService().subscribeToInsights(...args),
  preloadStories: (...args) => getStoryService().preloadStories(...args),
  archiveStory: (...args) => getStoryService().archiveStory(...args),
  getArchivedStories: (...args) => getStoryService().getArchivedStories(...args),
  deleteArchivedStory: (...args) => getStoryService().deleteArchivedStory(...args),
  getCloseCircle: (...args) => getStoryService().getCloseCircle(...args),
  addToCloseCircle: (...args) => getStoryService().addToCloseCircle(...args),
  removeFromCloseCircle: (...args) => getStoryService().removeFromCloseCircle(...args),
  setCloseCircle: (...args) => getStoryService().setCloseCircle(...args),
  cancelUpload: (...args) => getStoryService().cancelUpload(...args),
  deleteAbandonedMedia: (...args) => getStoryService().deleteAbandonedMedia(...args),
  getStoryInsights: (...args) => getStoryService().getStoryInsights(...args),
  createHighlight: (...args) => getStoryService().createHighlight(...args),
  updateHighlight: (...args) => getStoryService().updateHighlight(...args),
  deleteHighlight: (...args) => getStoryService().deleteHighlight(...args),
  reorderHighlights: (...args) => getStoryService().reorderHighlights(...args),
  addToHighlight: (...args) => getStoryService().addToHighlight(...args),
  removeFromHighlight: (...args) => getStoryService().removeFromHighlight(...args),
  getHighlights: (...args) => getStoryService().getHighlights(...args),
  getUserStories: (...args) => getStoryService().getUserStories(...args),
  getHighlightStories: (...args) => getStoryService().getHighlightStories(...args),
  searchStories: (...args) => getStoryService().searchStories(...args),
  getTemplates: () => getStoryService().getTemplates(),
  exportUserData: (...args) => getStoryService().exportUserData(...args),
  cleanupExpiredStories: () => getStoryService().cleanupExpiredStories(),
  clearCache: () => getStoryService().clearCache(),
  getStats: () => getStoryService().getStats(),
  destroy: () => getStoryService().destroy(),
  CONFIG: STORY_CONFIG,
  REACTION_TYPES: STORY_CONFIG.REACTION_TYPES,
  VIBE_REACTIONS,
  VISIBILITY: STORY_CONFIG.VISIBILITY,
};

export default storyService;