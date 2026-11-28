// src/services/firestoreService.js

import { countersManager } from '../utils/CountersManager.js';
import { setLocalLike } from '../utils/localContentCache.js';
import { cacheManager } from '../utils/CacheManager.js';
import { logger } from '../utils/Logger.js';
import { auditLogger } from '../utils/AuditLogger.js';
import { rateLimiter } from '../utils/RateLimiter.js';
import { errorHandler } from '../utils/ErrorHandler.js';
import { secureRandom } from '../lib/utils.js';
import { getSafeAvatarUrl } from '../utils/avatarUtils.js';
import { pickDisplayName, deriveHandle } from './profileReadModel.js';
import { unknownNumber } from '../lib/unknownNumber.js';

class LRUCache {
  constructor(maxSize = 100, ttl = 60000) {
    this.maxSize = maxSize;
    this.ttl = ttl;
    this.cache = new Map();
  }
  get(key) {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (Date.now() - entry.timestamp > this.ttl) { this.cache.delete(key); return null; }
    this.cache.delete(key);
    this.cache.set(key, entry);
    return entry.value;
  }
  set(key, value) {
    if (this.cache.size >= this.maxSize) {
      const oldestKey = this.cache.keys().next().value;
      this.cache.delete(oldestKey);
    }
    this.cache.set(key, { value, timestamp: Date.now() });
  }
  delete(key) { this.cache.delete(key); }
  deletePattern(pattern) {
    const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
    for (const key of this.cache.keys()) { if (regex.test(key)) this.cache.delete(key); }
  }
  clear() { this.cache.clear(); }
  get size() { return this.cache.size; }
}

const CONFIG = {
  ALLOWED_REACTIONS: ['👍', '❤️', '😂', '😮', '😢', '😡', '🔥', '🎉', '👎', '👏', '🚀', '💯'],
  REACTIONS_SUBCOLLECTION: 'reactions',
  DAILY_STATS_SUBCOLLECTION: 'daily_stats',
  POST_VISIBILITY: {
    PUBLIC: 'public',
    FOLLOWERS: 'followers',
    ONLY_ME: 'only_me'
  },
  POST_EXPIRY_DAYS: 30,
};

function enhanceError(error, defaultMessage) {
  const errorMap = {
    'permission-denied': 'You do not have permission to perform this action.',
    'unauthenticated': 'Authentication required.',
    'not-found': 'Document not found.',
    'already-exists': 'Document already exists.',
    'resource-exhausted': 'Database quota exceeded.',
    'failed-precondition': 'Operation failed. Please refresh.',
    'deadline-exceeded': 'Request timeout.',
    'aborted': 'Operation aborted.',
    'unavailable': 'Service temporarily unavailable.',
    'internal': 'Internal server error.',
    'invalid-argument': 'Invalid data provided.',
    'out-of-range': 'Value out of acceptable range.',
    'unimplemented': 'Operation not available.',
    'data-loss': 'Data corruption detected.',
    'cancelled': 'Operation cancelled.'
  };
  const code = error?.code || 'unknown';
  let message = errorMap[code] || (!error?.code && error?.message ? error.message : null) || defaultMessage || 'Database operation failed';
  if (code === 'failed-precondition' && error.message?.includes('index')) {
    const match = error.message.match(/https:\/\/console\.firebase\.google\.com[^\s]*/);
    const url = match ? match[0] : 'Check Firebase console';
    logger.error(`[FirestoreService] Missing index: ${url}`);
    message = `Missing Firestore index. Please create it: ${url}`;
  }
  const enhanced = new Error(message);
  enhanced.code = code;
  enhanced.originalError = error;
  enhanced.timestamp = new Date().toISOString();
  return enhanced;
}

class EnterpriseFirestoreService {
  constructor() {
    this.firestore = null;
    this.initialized = false;
    this.cache = cacheManager.namespace('posts', 60000);
    this.subscriptions = new Map();
    this.isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
    this.firestoreModule = null;
    this.firebaseApp = null;
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => { this.isOnline = true; logger.warn('// Firestore: Back online'); });
      window.addEventListener('offline', () => { this.isOnline = false; logger.warn('// Firestore: Offline mode'); });
    }
  }

  async initialize() {
    if (this.initialized && this.firestore) return this.firestore;
    try {
      this.firebaseApp = await import('../firebase/firebase.js');
      this.firestore = await this.firebaseApp.getFirestoreInstance();
      if (!this.firestore) throw new Error('Failed to get Firestore instance');
      this.firestoreModule = await import('firebase/firestore');
      const {
        collection, addDoc, getDoc, getDocs, updateDoc, deleteDoc,
        query, where, orderBy, limit, startAfter, startAt,
        serverTimestamp, increment, arrayUnion, arrayRemove, doc,
        onSnapshot, runTransaction, writeBatch, Timestamp,
        setDoc, collectionGroup, documentId, getCountFromServer
      } = this.firestoreModule;
      this.firestoreMethods = {
        collection, addDoc, getDoc, getDocs, updateDoc, deleteDoc,
        query, where, orderBy, limit, startAfter, startAt,
        serverTimestamp, increment, arrayUnion, arrayRemove, doc,
        onSnapshot, runTransaction, writeBatch, Timestamp,
        setDoc, collectionGroup, documentId, getCountFromServer
      };
      // Offline persistence is configured once in src/firebase/firebase.js
      // (multi-tab persistent cache). Enabling it here would race that init and
      // throw once the instance has already served a query.
      this.initialized = true;
      return this.firestore;
    } catch (error) {
      logger.error('❌ Firestore initialization failed:', error);
      throw enhanceError(error, 'Failed to initialize database');
    }
  }

  async ensureInitialized() {
    if (!this.initialized || !this.firestore) {
      await this.initialize();
    }
    return this.firestore;
  }

  async _ensureInitialized() {
    return this.ensureInitialized();
  }

  async saveDraft(draftId, userId, draftData) {
    await this.ensureInitialized();
    try {
      const { doc, setDoc, serverTimestamp } = this.firestoreMethods;
      const draftRef = doc(this.firestore, 'drafts', draftId || `draft_${Date.now()}`);
      const payload = {
        userId,
        ...draftData,
        updatedAt: serverTimestamp(),
      };
      await setDoc(draftRef, payload, { merge: true });
      auditLogger.log('content.draft_save', { userId, meta: { draftId } });
      return { success: true, draftId: draftRef.id };
    } catch (err) {
      logger.error('Failed to save draft:', err);
      throw enhanceError(err, 'Failed to save draft');
    }
  }

  async getDraft(draftId) {
    await this.ensureInitialized();
    try {
      const { doc, getDoc } = this.firestoreMethods;
      const draftRef = doc(this.firestore, 'drafts', draftId);
      const snap = await getDoc(draftRef);
      if (!snap.exists()) return null;
      return { id: snap.id, ...snap.data() };
    } catch (err) {
      logger.error('Failed to fetch draft:', err);
      throw enhanceError(err, 'Failed to fetch draft');
    }
  }

  async deleteDraft(draftId) {
    await this.ensureInitialized();
    try {
      const { doc, deleteDoc } = this.firestoreMethods;
      const draftRef = doc(this.firestore, 'drafts', draftId);
      await deleteDoc(draftRef);
      return { success: true };
    } catch (err) {
      logger.error('Failed to delete draft:', err);
      throw enhanceError(err, 'Failed to delete draft');
    }
  }

  async publishToPlatform(postId, platforms = []) {
    await this.ensureInitialized();
    // No cross-post provider is integrated, so there is nothing to publish to.
    // The previous implementation slept 600ms and returned fabricated
    // `https://<platform>.com/...` URLs as if the post had been shared. Report
    // the honest state instead of a fake success.
    logger.warn('publishToPlatform called but no cross-platform provider is integrated', { postId, platforms });
    throw new Error(
      'Cross-platform publishing is not available: no provider is integrated.'
    );
  }

  async createPost(postData) {
    await this.ensureInitialized();
    const startTime = Date.now();
    const operationId = `post_${Date.now()}_${secureRandom().toString(36).substr(2,9)}`;
    try {
      const auth = await this.getAuthInstance();
      let currentUser = auth?.currentUser;
      if (!currentUser && typeof auth?.authStateReady === 'function') {
        try {
          await Promise.race([
            auth.authStateReady(),
            new Promise((res) => setTimeout(res, 1000))
          ]);
          currentUser = auth.currentUser;
        } catch {
          /* authStateReady raced the timeout; fall back to currentUser */
        }
      }
      if (!currentUser) {
        currentUser = await new Promise((resolve) => {
          const unsub = auth.onAuthStateChanged((u) => {
            unsub();
            resolve(u);
          });
          setTimeout(() => {
            unsub();
            resolve(auth.currentUser);
          }, 1000);
        });
      }
      // Fail closed on identity. The old code signed in ANONYMOUSLY (a throwaway
      // uid that owns the post but can never be the real author) and, failing
      // that, trusted a caller-supplied `postData.authorId`. Both fabricate an
      // author, so a post could be written under an identity that is not the
      // signed-in account. Arvdoul has no guest-authoring product flow, so a
      // missing session is an error, not something to paper over.
      if (!currentUser?.uid) throw new Error('User not authenticated. Please sign in to publish.');
      postData.authorId = currentUser.uid;
      const { collection, doc, getDoc, setDoc, serverTimestamp } = this.firestoreMethods;

      // Denormalise the author's privacy onto the post: the read rule gates a
      // private account's content on this field (rules cannot get() a user doc
      // during a list query). The create rule verifies it equals
      // users/{uid}.isPrivate, so it cannot be spoofed; a read failure defaults
      // to public and a genuinely-private author is then rejected (fail closed).
      let authorIsPrivate = false;
      try {
        const authorSnap = await getDoc(doc(this.firestore, 'users', postData.authorId));
        if (authorSnap.exists()) authorIsPrivate = authorSnap.data()?.isPrivate === true;
      } catch (privacyErr) {
        logger.warn('Author privacy lookup failed; defaulting post to public', { error: privacyErr?.message });
      }

      const scheduledTime = postData.scheduledTime && !isNaN(new Date(postData.scheduledTime).getTime())
        ? new Date(postData.scheduledTime)
        : null;
      const isScheduled = Boolean(scheduledTime && scheduledTime > new Date());
      const status = isScheduled ? 'scheduled' : (postData.status || 'published');
      const expiresAt = postData.expiresAt && !isNaN(new Date(postData.expiresAt).getTime())
        ? new Date(postData.expiresAt)
        : null;

      const isSafeRemoteUrl = (val) => {
        if (typeof val !== 'string' || !val.trim()) return false;
        if (val.startsWith('blob:') || val.startsWith('data:')) return false;
        try {
          const parsed = new URL(val);
          return parsed.protocol === 'https:' || parsed.protocol === 'http:';
        } catch {
          return false;
        }
      };

      // Sanitize media items to ensure pure serializable objects. Session-scoped
      // `blob:` or `data:` URLs are stripped so broken previews never enter Firestore.
      const cleanMedia = (Array.isArray(postData.media) ? postData.media : []).map((m, idx) => {
        if (!m) return null;
        const url = typeof m === 'string' ? m : (m.url || m.preview || '');
        if (!isSafeRemoteUrl(url)) return null;
        if (typeof m === 'string') return { url, type: 'image', order: idx };
        const thumbnail = isSafeRemoteUrl(m.thumbnail) ? m.thumbnail : null;
        const coverUrl = isSafeRemoteUrl(m.coverUrl) ? m.coverUrl : null;
        return {
          url,
          type: m.type || 'image',
          name: m.name || '',
          alt: m.alt || '',
          order: typeof m.order === 'number' ? m.order : idx,
          ...(thumbnail ? { thumbnail } : {}),
          ...(coverUrl ? { coverUrl } : {}),
          ...(typeof m.duration === 'number' && Number.isFinite(m.duration) ? { duration: m.duration } : {}),
          ...(m.title ? { title: String(m.title).slice(0, 140) } : {}),
          ...(m.artist ? { artist: String(m.artist).slice(0, 100) } : {}),
          ...(m.genre ? { genre: String(m.genre).slice(0, 50) } : {}),
          ...(m.crop ? { crop: m.crop } : {}),
          ...(m.filter ? { filter: m.filter } : {}),
        };
      }).filter((m) => m && m.url);

      const firstMedia = cleanMedia[0] || null;
      const videoItem = cleanMedia.find(m => m.type === 'video') || null;
      const audioItem = cleanMedia.find(m => m.type === 'audio') || null;

      const sanitizeLink = (rawLink) => {
        if (!rawLink || typeof rawLink !== 'object') return null;
        const rawUrl = String(rawLink.url || '').trim();
        if (!isSafeRemoteUrl(rawUrl)) return null;
        let hostname = '';
        try { hostname = new URL(rawUrl).hostname; } catch { hostname = ''; }
        const meta = rawLink.metadata && typeof rawLink.metadata === 'object' ? rawLink.metadata : null;
        const candidateImage = rawLink.image || rawLink.thumbnail || meta?.image || '';
        return {
          url: rawUrl,
          title: String(rawLink.title || meta?.title || hostname || rawUrl).slice(0, 200),
          description: String(rawLink.description || meta?.description || '').slice(0, 500),
          image: isSafeRemoteUrl(candidateImage) ? candidateImage : '',
          domain: String(rawLink.domain || meta?.domain || hostname || '').slice(0, 120),
          author: rawLink.author ? String(rawLink.author).slice(0, 120) : '',
        };
      };

      const sanitizeEvent = (rawEvent) => {
        if (!rawEvent || typeof rawEvent !== 'object') return null;
        const coverImage = isSafeRemoteUrl(rawEvent.coverImage) ? rawEvent.coverImage : '';
        return {
          id: rawEvent.id || null,
          title: String(rawEvent.title || '').slice(0, 160),
          description: String(rawEvent.description || '').slice(0, 2000),
          date: rawEvent.date || null,
          endDate: rawEvent.endDate || null,
          location: String(rawEvent.location || '').slice(0, 240),
          locationData: rawEvent.locationData || null,
          coverImage,
          rsvpEnabled: rawEvent.rsvpEnabled !== false,
          capacity: typeof rawEvent.capacity === 'number' && rawEvent.capacity > 0 ? rawEvent.capacity : null,
          timezone: rawEvent.timezone || null,
          category: rawEvent.category || null,
        };
      };

      const sanitizeAudio = (rawAudio) => {
        const audioUrl = isSafeRemoteUrl(rawAudio?.url) ? rawAudio.url : (audioItem?.url || '');
        if (!audioUrl) return null;
        const coverUrl = isSafeRemoteUrl(rawAudio?.coverUrl)
          ? rawAudio.coverUrl
          : (audioItem?.coverUrl || null);
        return {
          url: audioUrl,
          title: String(rawAudio?.title || audioItem?.title || audioItem?.name || 'Untitled Audio').slice(0, 140),
          artist: String(rawAudio?.artist || audioItem?.artist || '').slice(0, 100),
          genre: String(rawAudio?.genre || audioItem?.genre || '').slice(0, 50),
          duration: typeof rawAudio?.duration === 'number' ? rawAudio.duration : (audioItem?.duration || 0),
          ...(coverUrl ? { coverUrl } : {}),
        };
      };

      const normalizedExplicitHashtags = (Array.isArray(postData.hashtags) ? postData.hashtags : [])
        .map((t) => String(t || '').trim().replace(/^#+/, '').toLowerCase())
        .filter((t) => t.length > 0 && t.length <= 50);
      const mergedHashtags = [...new Set([...normalizedExplicitHashtags, ...this.extractHashtags(postData.content)])].slice(0, 30);

      const postDoc = {
        type: postData.type || 'text',
        content: postData.content || '',
        contentJSON: postData.contentJSON || null,
        media: cleanMedia,
        mediaUrl: isSafeRemoteUrl(postData.mediaUrl) ? postData.mediaUrl : (firstMedia?.url || ''),
        videoUrl: isSafeRemoteUrl(postData.videoUrl) ? postData.videoUrl : (isSafeRemoteUrl(postData.video?.url) ? postData.video.url : (videoItem?.url || '')),
        thumbnailUrl: isSafeRemoteUrl(postData.thumbnailUrl) ? postData.thumbnailUrl : (firstMedia?.thumbnail || firstMedia?.coverUrl || firstMedia?.url || ''),
        authorId: postData.authorId,
        authorName: pickDisplayName([postData.authorName, currentUser.displayName]),
        authorUsername: deriveHandle(postData.authorUsername) || '',
        authorIsPrivate,
        authorPhoto: getSafeAvatarUrl(postData.authorPhoto, pickDisplayName([postData.authorName, currentUser.displayName]), postData.authorId),
        ...(postData.type === 'poll' && {
          poll: {
            question: String(postData.poll?.question || postData.content || '').slice(0, 500),
            options: Array.isArray(postData.poll?.options) ? postData.poll.options : [],
            totalVotes: 0,
            allowMultiple: !!postData.poll?.allowMultiple,
            closesAt: postData.poll?.closesAt || null,
          }
        }),
        ...(postData.type === 'question' && { question: this._normaliseQuestion(postData.question, postData.content) }),
        ...(postData.type === 'link' && { link: sanitizeLink(postData.link) }),
        ...(postData.type === 'event' && { event: sanitizeEvent(postData.event) }),
        ...(postData.type === 'video' && { video: postData.video || { url: videoItem?.url || '', thumbnail: videoItem?.thumbnail || null } }),
        ...(postData.type === 'audio' && { audio: sanitizeAudio(postData.audio) }),
        visibility: postData.visibility || CONFIG.POST_VISIBILITY.PUBLIC,
        enableComments: postData.enableComments !== false,
        enableGifts: postData.enableGifts !== false,
        location: postData.location || null,
        tags: postData.tags || [],
        hashtags: mergedHashtags,
        status,
        isDeleted: false,
        identityMeta: postData.identityMeta || null,
        distributionSettings: postData.distributionSettings || null,
        engagementControls: postData.engagementControls || null,
        commercialDisclosure: postData.commercialDisclosure || null,
        partnership: postData.partnership || null,
        creatorPrograms: postData.creatorPrograms || null,
        safetyAccessibility: postData.safetyAccessibility || null,
        lifecycleSettings: postData.lifecycleSettings || null,
        // boostData and paid ad delivery fields are strictly server-owned
        // (firestore.rules pins them to null on create).
        scheduledTime: scheduledTime || null,
        publishedAt: (!isScheduled && status === 'published') ? serverTimestamp() : null,
        expiresAt: expiresAt || null,
        stats: {
          likes: 0, comments: 0, shares: 0, saves: 0, views: 0, gifts: 0, giftValue: 0,
          reactions: Object.fromEntries(CONFIG.ALLOWED_REACTIONS.map(r => [r, 0])),
          pollVotes: 0,
        },
        gifts: [],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        version: 'v5',
        _operationId: operationId,
        _clientCreatedAt: new Date().toISOString()
      };

      // Helper to strip any undefined keys recursively so setDoc never rejects
      const sanitizeUndefined = (obj) => {
        if (obj === null || typeof obj !== 'object') return obj;
        if (obj instanceof Date) return obj;
        if (Array.isArray(obj)) return obj.map(sanitizeUndefined).filter(v => v !== undefined);
        if (obj._methodName || (obj.constructor && obj.constructor.name === 'FieldValue')) return obj;
        const out = {};
        for (const [k, v] of Object.entries(obj)) {
          if (v !== undefined) {
            out[k] = sanitizeUndefined(v);
          }
        }
        return out;
      };

      const cleanPostDoc = sanitizeUndefined(postDoc);
      const postsRef = collection(this.firestore, 'posts');
      const requestedId = typeof (postData.id || postData.clientPostId) === 'string'
        ? (postData.id || postData.clientPostId).trim()
        : '';
      const validId = requestedId && !requestedId.includes('/') ? requestedId : '';
      const postRef = validId ? doc(postsRef, validId) : doc(postsRef);
      const postId = postRef.id;

      // Idempotency guard for retries / offline replays sharing a clientPostId:
      // if the document already exists for this author, return it instead of
      // failing `update` rules or creating a duplicate document.
      if (validId) {
        try {
          const existingSnap = await getDoc(postRef);
          if (existingSnap.exists()) {
            const existingData = existingSnap.data();
            if (existingData?.authorId === currentUser.uid) {
              return {
                success: true,
                postId,
                post: { ...existingData, id: postId },
                operationId,
                idempotentHit: true,
                duration: Date.now() - startTime
              };
            }
          }
        } catch (precheckErr) {
          // Non-existing doc reads on private shapes may reject with permission-denied
          // before creation; proceed to deterministic create write.
          logger.debug('Pre-create existence check skipped', { postId, error: precheckErr?.code });
        }
      }

      await setDoc(postRef, cleanPostDoc);
      this.cache.set(postId, { ...cleanPostDoc, id: postId, _cachedAt: Date.now() });
      this.invalidateCachePattern(`user_posts_${postData.authorId}*`);

      // Level system: award post_created XP (best-effort, never breaks publish).
      try {
        const { levelSystemService } = await import('./levelSystemService.js');
        levelSystemService
          .awardExperience({ userId: postData.authorId, action: 'post_created', source: postId })
          .catch((err) => logger.warn('Post XP award failed', { postId, error: err?.message }));
      } catch (e) {
        logger.warn('Post XP award failed', { postId, error: e?.message });
      }

      return {
        success: true, postId, post: { ...cleanPostDoc, id: postId }, operationId,
        duration: Date.now() - startTime
      };
    } catch (error) {
      logger.error('❌ Create post failed:', error);
      throw enhanceError(error, 'Failed to create post');
    }
  }

  extractHashtags(content) {
    if (!content) return [];
    const matches = [...String(content).matchAll(/#([a-zA-Z0-9_]+)/g)];
    return matches.length ? [...new Set(matches.map(m => m[1].toLowerCase()))] : [];
  }

  async getPost(postId, options = {}) {
    await this.ensureInitialized();
    if (options.cacheFirst !== false) {
      const cached = this.cache.get(postId);
      if (cached) return { success: true, post: cached, cached: true };
    }
    try {
      const { doc, getDoc } = this.firestoreMethods;
      const postRef = doc(this.firestore, 'posts', postId);
      const postSnap = await getDoc(postRef);
      if (!postSnap.exists()) return { success: false, error: 'Post not found', code: 'not-found' };
      const postData = { id: postSnap.id, ...postSnap.data() };
      // `comments` is sharded-incremented (docPath `posts/{id}`) by
      // commentService/firestoreService; omitting it here left the post-detail
      // view rendering the seeded `0` while the feed showed the real count.
      await countersManager.apply({ data: postData, docPath: `posts/${postId}`, fields: ['likes', 'comments', 'saves', 'shares', 'gifts', 'giftValue'] });
      this.cache.set(postId, { ...postData, _cachedAt: Date.now() });
      return { success: true, post: postData, cached: false };
    } catch (error) {
      return { success: false, error: enhanceError(error, 'Failed to fetch post').message };
    }
  }

  async getPostsByUser(userId, options = {}) {
    await this.ensureInitialized();
    const cacheKey = `user_posts_${userId}_${JSON.stringify(options)}`;
    if (options.cacheFirst !== false) {
      const cached = this.cache.get(cacheKey);
      // Return the whole cached result: returning only `posts` dropped
      // hasMore/nextCursor, so a cached first page looked like the entire feed
      // and pagination silently died.
      if (cached) return { ...cached, cached: true };
    }
    try {
      const { collection, query, where, getDocs, orderBy, limit, startAfter, doc, getDoc } = this.firestoreMethods;
      const postsRef = collection(this.firestore, 'posts');
      const viewerId = options.viewerId || null;
      const isOwnerView = Boolean(viewerId && viewerId === userId);
      // The list rule admits three shapes (rules are not filters): the owner's
      // own shape (`authorId == uid()`), the public-feed shape
      // (`authorIsPrivate == false` + `visibility == 'public'` +
      // `status == 'published'` + `isDeleted == false`), and — for a private
      // author — the approved-follower shape, which must NOT constrain
      // `authorIsPrivate` (the rule evaluates the follower edge from the
      // constrained `authorId`). A caller that knows the viewer is an approved
      // follower passes `constrainAuthorIsPrivate: false`; everyone else keeps
      // the public shape, so drafts/scheduled/only-me posts stay invisible.
      const conditions = [
        where('authorId', '==', userId),
        orderBy('createdAt', 'desc'),
      ];
      if (options.type) conditions.push(where('type', '==', options.type));
      if (isOwnerView) {
        conditions.push(where('isDeleted', '==', false));
        if (options.status) conditions.push(where('status', '==', options.status));
      } else {
        if (options.constrainAuthorIsPrivate !== false) {
          conditions.push(where('authorIsPrivate', '==', false));
        }
        conditions.push(where('status', '==', 'published'));
        conditions.push(where('isDeleted', '==', false));
        conditions.push(where('visibility', '==', 'public'));
      }

      // Always bound: a caller that omits `limit` must not pull the author's
      // entire post history in one read.
      const effectiveLimit = Math.max(1, Number(options.limit) || 20);
      
      let lastDocSnap = null;
      // Callers pass the cursor as `cursor` (the store's public name); accept
      // `startAfter` too for backwards compatibility.
      const afterId = options.startAfter || options.cursor;
      if (afterId) {
        const lastDocRef = doc(this.firestore, 'posts', afterId);
        lastDocSnap = await getDoc(lastDocRef);
        if (lastDocSnap.exists()) {
          conditions.push(startAfter(lastDocSnap));
        }
      }
      
      const q = query(postsRef, ...conditions, limit(effectiveLimit));
      const snap = await getDocs(q);
      const posts = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      // Batched shard overlay (one `getAll` per field-chunk) — `comments` is
      // sharded-incremented too, so it must be in the field set (see getPost).
      await countersManager.applyAll({
        items: posts,
        collection: 'posts',
        fields: ['likes', 'comments', 'saves', 'shares', 'gifts', 'giftValue'],
      });
      const hasMore = snap.docs.length === effectiveLimit;
      const nextCursor = hasMore ? snap.docs[snap.docs.length - 1].id : null;
      
      const result = { success: true, posts, hasMore, nextCursor, total: posts.length };
      this.cache.set(cacheKey, result);
      return result;
    } catch (error) {
      throw enhanceError(error, `Failed to fetch posts for user ${userId}`);
    }
  }

  async getUserPostsCount(userId, options = {}) {
    if (!userId) return null;
    const cacheKey = `user_posts_count_${userId}_${options.viewerId || 'anon'}_${options.constrainAuthorIsPrivate === false ? 'priv_ok' : 'pub'}`;
    if (!options.forceRefresh) {
      const cached = this.cache.get(cacheKey);
      if (typeof cached === 'number') return cached;
    }
    try {
      await this.ensureInitialized();
      const { collection, query, where, getCountFromServer } = this.firestoreMethods || {};
      if (typeof getCountFromServer !== 'function') return null;

      const postsRef = collection(this.firestore, 'posts');
      const viewerId = options.viewerId || null;
      const isOwnerView = Boolean(viewerId && viewerId === userId);
      const conditions = [
        where('authorId', '==', userId),
        where('isDeleted', '==', false),
      ];
      if (!isOwnerView) {
        if (options.constrainAuthorIsPrivate !== false) {
          conditions.push(where('authorIsPrivate', '==', false));
        }
        conditions.push(where('status', '==', 'published'));
        conditions.push(where('visibility', '==', 'public'));
      }
      const snap = await getCountFromServer(query(postsRef, ...conditions));
      const count = snap?.data?.()?.count;
      if (typeof count === 'number' && Number.isFinite(count)) {
        this.cache.set(cacheKey, count);
        return count;
      }
      return null;
    } catch (error) {
      logger.debug('getUserPostsCount fallback to null', { userId, error: error?.message });
      return null;
    }
  }

  async getUserTotalPostLikes(userId, options = {}) {
    if (!userId) return null;
    const viewerId = options.viewerId || null;
    const isOwnerView = Boolean(viewerId && viewerId === userId);
    const cacheKey = `user_posts_likes_${userId}_${viewerId || 'anon'}_${options.constrainAuthorIsPrivate === false ? 'priv_ok' : 'pub'}`;
    if (!options.forceRefresh) {
      const cached = this.cache.get(cacheKey);
      if (typeof cached === 'number') return cached;
    }
    try {
      await this.ensureInitialized();
      const { collection, query, where, orderBy, limit, getDocs } = this.firestoreMethods || {};
      if (typeof getDocs !== 'function') return null;

      const postsRef = collection(this.firestore, 'posts');
      const conditions = [
        where('authorId', '==', userId),
        orderBy('createdAt', 'desc'),
      ];
      if (isOwnerView) {
        conditions.push(where('isDeleted', '==', false));
      } else {
        if (options.constrainAuthorIsPrivate !== false) {
          conditions.push(where('authorIsPrivate', '==', false));
        }
        conditions.push(where('status', '==', 'published'));
        conditions.push(where('isDeleted', '==', false));
        conditions.push(where('visibility', '==', 'public'));
      }
      const effectiveLimit = Math.min(250, Math.max(1, Number(options.limit) || 250));
      const snap = await getDocs(query(postsRef, ...conditions, limit(effectiveLimit)));
      const posts = snap.docs
        .map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }))
        .filter((p) => p && p.isDeleted !== true && p.status !== 'deleted' && p.status !== 'scheduled');

      if (posts.length === 0) {
        this.cache.set(cacheKey, 0);
        return 0;
      }

      await countersManager.applyAll({
        items: posts,
        collection: 'posts',
        fields: ['likes', 'comments', 'saves', 'shares', 'gifts', 'giftValue'],
      });

      let totalLikes = 0;
      for (const post of posts) {
        const likes = Number(post?.likes ?? post?.stats?.likes ?? post?.likesCount ?? 0);
        if (Number.isFinite(likes) && likes > 0) {
          totalLikes += likes;
        }
      }

      this.cache.set(cacheKey, totalLikes);
      return totalLikes;
    } catch (error) {
      logger.debug('getUserTotalPostLikes fallback to null', { userId, error: error?.message });
      return null;
    }
  }

  async getScheduledPosts(userId, limitCount = 20) {
    await this.ensureInitialized();
    if (!userId) return { success: false, posts: [] };
    const auth = await this.getAuthInstance();
    if (auth?.currentUser?.uid !== userId) {
      return { success: false, posts: [] };
    }
    try {
      const { collection, query, where, orderBy, limit, getDocs } = this.firestoreMethods;
      const postsRef = collection(this.firestore, 'posts');
      const cappedLimit = Math.min(Math.max(1, Number(limitCount) || 20), 50);
      const q = query(
        postsRef,
        where('authorId', '==', userId),
        where('isDeleted', '==', false),
        where('status', '==', 'scheduled'),
        orderBy('createdAt', 'desc'),
        limit(cappedLimit)
      );
      const snap = await getDocs(q);
      const posts = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      return { success: true, posts };
    } catch (error) {
      logger.warn('getScheduledPosts failed', { userId, error: error?.message });
      return { success: false, posts: [], error: error?.message };
    }
  }

  async updatePost(postId, updates) {
    await this.ensureInitialized();
    try {
      const { doc, updateDoc, serverTimestamp } = this.firestoreMethods;
      const IMMUTABLE_FIELDS = new Set([
        'id', 'authorId', 'createdAt', 'stats', 'gifts', 'boostData', 'poll',
        'moderationStatus', 'moderatedBy', 'moderatedAt', 'moderationScore', 'reportCount',
        'adReviewStatus', 'paidStats', 'sponsoredMetrics', 'adAttribution', 'monetizationLedgerRef',
      ]);
      const sanitizeUndefined = (obj) => {
        if (obj === null || typeof obj !== 'object') return obj;
        if (obj instanceof Date) return obj;
        if (Array.isArray(obj)) return obj.map(sanitizeUndefined).filter((v) => v !== undefined);
        if (obj._methodName || (obj.constructor && obj.constructor.name === 'FieldValue')) return obj;
        const out = {};
        for (const [k, v] of Object.entries(obj)) {
          if (v !== undefined) out[k] = sanitizeUndefined(v);
        }
        return out;
      };
      const cleanUpdates = {};
      for (const [k, v] of Object.entries(updates || {})) {
        if (IMMUTABLE_FIELDS.has(k) || v === undefined) continue;
        cleanUpdates[k] = sanitizeUndefined(v);
      }
      if (Array.isArray(cleanUpdates.hashtags)) {
        cleanUpdates.hashtags = [...new Set(
          cleanUpdates.hashtags
            .map((t) => String(t || '').trim().replace(/^#+/, '').toLowerCase())
            .filter(Boolean)
        )].slice(0, 30);
      }
      if ('scheduledTime' in cleanUpdates) {
        const parsedScheduled =
          cleanUpdates.scheduledTime && !isNaN(new Date(cleanUpdates.scheduledTime).getTime())
            ? new Date(cleanUpdates.scheduledTime)
            : null;
        cleanUpdates.scheduledTime = parsedScheduled;
        if (parsedScheduled && parsedScheduled > new Date()) {
          cleanUpdates.status = 'scheduled';
        } else if (!('status' in cleanUpdates)) {
          cleanUpdates.status = 'published';
          cleanUpdates.publishedAt = serverTimestamp();
        }
      }
      if ('expiresAt' in cleanUpdates) {
        cleanUpdates.expiresAt =
          cleanUpdates.expiresAt && !isNaN(new Date(cleanUpdates.expiresAt).getTime())
            ? new Date(cleanUpdates.expiresAt)
            : null;
      }
      const postRef = doc(this.firestore, 'posts', postId);
      await updateDoc(postRef, { ...cleanUpdates, updatedAt: serverTimestamp(), _clientUpdatedAt: new Date().toISOString() });
      this.cache.delete(postId);
      this.invalidateCachePattern(`user_posts_*`);
      return { success: true, postId };
    } catch (error) { throw enhanceError(error, 'Failed to update post'); }
  }

  async deletePost(postId, userId) {
    await this.ensureInitialized();
    try {
      const { doc, updateDoc, serverTimestamp } = this.firestoreMethods;
      const postRef = doc(this.firestore, 'posts', postId);
      await updateDoc(postRef, {
        isDeleted: true, deletedAt: serverTimestamp(), updatedAt: serverTimestamp(),
        status: 'deleted', deletedBy: userId
      });
      this.cache.delete(postId);
      this.invalidateCachePattern(`user_posts_*`);
      return { success: true };
    } catch (error) { throw enhanceError(error, 'Failed to delete post'); }
  }

  async restorePost(postId, userId) {
    await this.ensureInitialized();
    try {
      const { doc, updateDoc, serverTimestamp } = this.firestoreMethods;
      const postRef = doc(this.firestore, 'posts', postId);
      await updateDoc(postRef, {
        isDeleted: false, deletedAt: null, updatedAt: serverTimestamp(),
        status: 'published', deletedBy: userId
      });
      this.cache.delete(postId);
      this.invalidateCachePattern(`user_posts_*`);
      return { success: true };
    } catch (error) { throw enhanceError(error, 'Failed to restore post'); }
  }

  async batchDeletePosts(postIds, userId, isAdmin = false) {
    await this.ensureInitialized();
    try {
      const { writeBatch, doc } = this.firestoreMethods;
      const batch = writeBatch(this.firestore);
      let deletedCount = 0;
      for (const postId of postIds) {
        const postRef = doc(this.firestore, 'posts', postId);
        const postSnap = await this.getPost(postId);
        if (!postSnap.success) continue;
        if (!isAdmin && postSnap.post.authorId !== userId) continue;
        batch.update(postRef, {
          isDeleted: true,
          deletedAt: this.firestoreMethods.serverTimestamp(),
          deletedBy: userId,
          status: 'deleted'
        });
        deletedCount++;
        this.cache.delete(postId);
      }
      await batch.commit();
      this.invalidateCachePattern('user_posts_*');
      return { success: true, deletedCount };
    } catch (error) { throw enhanceError(error, 'Failed to batch delete posts'); }
  }

  async savePost(postId, userId) {
    await this.ensureInitialized();
    try {
      const rl = rateLimiter.checkAndHit(`save:${userId}`, { max: 120, windowMs: 60000 });
      if (!rl.allowed) {
        throw errorHandler.enhance(new Error('Too many saves. Please slow down.'), { code: 5001, defaultMessage: 'Too many saves. Please slow down.' });
      }

      const { doc, runTransaction, serverTimestamp } = this.firestoreMethods;
      const postRef = doc(this.firestore, 'posts', postId);
      const userSavedRef = doc(this.firestore, 'users', userId, 'saved_posts', postId);
      let alreadySaved;
      await runTransaction(this.firestore, async (transaction) => {
        const postSnap = await transaction.get(postRef);
        if (!postSnap.exists()) throw new Error('Post not found');
        const savedSnap = await transaction.get(userSavedRef);
        alreadySaved = savedSnap.exists();
        if (!alreadySaved) {
          await countersManager.incrementInTransaction(transaction, { docPath: `posts/${postId}`, field: 'saves' });
          const postData = postSnap.data();
          transaction.set(userSavedRef, {
            postId,
            savedAt: serverTimestamp(),
            snapshot: {
              id: postId,
              content: postData.content,
              type: postData.type,
              media: postData.media,
              authorId: postData.authorId,
              authorName: postData.authorName,
              authorPhoto: postData.authorPhoto,
              createdAt: postData.createdAt
            }
          });
          const postSaveRef = doc(this.firestore, 'posts', postId, 'saves', userId);
          transaction.set(postSaveRef, { userId, savedAt: serverTimestamp() });
        }
      });
      this.cache.delete(postId);
      countersManager.invalidate({ docPath: `posts/${postId}`, field: 'saves' });
      auditLogger.log('content.save', { userId, meta: { postId, alreadySaved } });
      return { success: true, alreadySaved };
    } catch (error) { throw enhanceError(error, 'Failed to save post'); }
  }

  async unsavePost(postId, userId) {
    await this.ensureInitialized();
    try {
      const { doc, runTransaction } = this.firestoreMethods;
      const postRef = doc(this.firestore, 'posts', postId);
      const userSavedRef = doc(this.firestore, 'users', userId, 'saved_posts', postId);
      await runTransaction(this.firestore, async (transaction) => {
        const savedSnap = await transaction.get(userSavedRef);
        if (!savedSnap.exists()) return;
        await countersManager.incrementInTransaction(transaction, { docPath: `posts/${postId}`, field: 'saves', amount: -1 });
        transaction.delete(userSavedRef);
        const postSaveRef = doc(this.firestore, 'posts', postId, 'saves', userId);
        transaction.delete(postSaveRef);
      });
      this.cache.delete(postId);
      countersManager.invalidate({ docPath: `posts/${postId}`, field: 'saves' });
      auditLogger.log('content.unsave', { userId, meta: { postId } });
      return { success: true };
    } catch (error) { throw enhanceError(error, 'Failed to unsave post'); }
  }

  async getSavedPosts(userId, options = {}) {
    await this.ensureInitialized();
    const { collection, query, orderBy, limit, startAfter, getDocs, doc, getDoc } = this.firestoreMethods;
    const savedRef = collection(this.firestore, 'users', userId, 'saved_posts');
    let q = query(savedRef, orderBy('savedAt', 'desc'), limit(options.limit || 20));
    if (options.startAfter) {
      const lastDocRef = doc(this.firestore, 'users', userId, 'saved_posts', options.startAfter);
      const lastDocSnap = await getDoc(lastDocRef);
      if (lastDocSnap.exists()) q = query(q, startAfter(lastDocSnap));
    }
    const snap = await getDocs(q);
    const savedEntries = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    // Keep the save timestamp alongside the snapshot: it was dropped, so the
    // saved-items screen could never show when a post was saved.
    const posts = savedEntries.map(entry => ({ ...(entry.snapshot || {}), savedAt: entry.savedAt || null }));
    const hasMore = snap.docs.length === (options.limit || 20);
    const nextCursor = hasMore ? snap.docs[snap.docs.length - 1].id : null;
    return { success: true, posts, hasMore, nextCursor };
  }

  async likePost(postId, userId) {
    if (!postId || !userId) return { success: false, error: 'Missing postId or userId' };

    // Offline / local posts: the device-local registry is the source of truth
    // and there is no server document to write, so this is a genuine success.
    const isLocalOnly = postId.startsWith('local_') || postId.startsWith('offline_') || !navigator.onLine;
    if (isLocalOnly) {
      this._rememberLocalLike(postId, userId, true);
      return { success: true, alreadyLiked: false, localOnly: true };
    }

    try {
      await this.ensureInitialized();
      const rl = rateLimiter.checkAndHit(`like:${userId}`, { max: 120, windowMs: 60000 });
      if (!rl.allowed) {
        return { success: false, error: 'rate-limited', localOnly: true };
      }

      const { doc, runTransaction, serverTimestamp } = this.firestoreMethods;
      const postRef = doc(this.firestore, 'posts', postId);
      const userLikeRef = doc(this.firestore, 'users', userId, 'liked_posts', postId);
      const postLikeRef = doc(this.firestore, 'posts', postId, 'likes', userId);
      let alreadyLiked = false;
      let postExists = true;
      let authorId = null;

      // No inner catch: a failed transaction surfaces as success:false so the
      // caller can roll back the optimistic heart instead of showing a like
      // that was never persisted.
      await runTransaction(this.firestore, async (transaction) => {
        const postSnap = await transaction.get(postRef);
        if (!postSnap.exists()) {
          postExists = false;
          return;
        }
        authorId = postSnap.data().authorId;
        const likeSnap = await transaction.get(userLikeRef);
        alreadyLiked = likeSnap.exists();
        if (!alreadyLiked) {
          await countersManager.incrementInTransaction(transaction, { docPath: `posts/${postId}`, field: 'likes' });
          const postData = postSnap.data();
          transaction.set(userLikeRef, {
            postId,
            likedAt: serverTimestamp(),
            snapshot: {
              id: postId,
              content: postData.content || '',
              type: postData.type || 'text',
              media: postData.media || [],
              authorId: postData.authorId || '',
              authorName: postData.authorName || '',
              authorPhoto: postData.authorPhoto || '',
              createdAt: postData.createdAt || serverTimestamp()
            }
          });
          transaction.set(postLikeRef, { userId, likedAt: serverTimestamp() });
        }
      });

      if (!postExists) {
        return { success: false, error: 'Post not found' };
      }

      this._rememberLocalLike(postId, userId, true);
      this.cache.delete(postId);
      this.invalidateCachePattern('user_posts_*');
      countersManager.invalidate({ docPath: `posts/${postId}`, field: 'likes' });
      auditLogger.log('content.like', { userId, meta: { postId, alreadyLiked } });

      if (!alreadyLiked && authorId && authorId !== userId) {
        Promise.all([
          (async () => {
            try {
              const { getNotificationsService } = await import('./notificationsService.js');
              await getNotificationsService().createLikeNotification(postId, userId, authorId);
            } catch (e) { logger.warn('Like notification failed', { postId, userId, error: e?.message }); }
          })(),
          (async () => {
            try {
              const { levelSystemService } = await import('./levelSystemService.js');
              await levelSystemService.awardExperience({
                userId: authorId,
                action: 'like_received',
                source: postId,
              });
            } catch (e) { logger.warn('Like XP award failed', { postId, error: e?.message }); }
          })(),
        ]).catch((e) => {
          logger.warn('Post-like side effects failed', { postId, error: e?.message });
        });
      }

      return { success: true, alreadyLiked };
    } catch (error) {
      logger.warn('likePost failed', { postId, error: error?.message });
      return { success: false, error: error?.message || 'like-failed', localFallback: true };
    }
  }

  /**
   * Device-local likes registry, uid-scoped by `setLocalLike` so a like on a
   * shared device never bleeds into the next signed-in account.
   */
  _rememberLocalLike(postId, userId, liked) {
    setLocalLike(userId, postId, liked);
  }

  async unlikePost(postId, userId) {
    if (!postId || !userId) return { success: false };

    const isLocalOnly = postId.startsWith('local_') || postId.startsWith('offline_') || !navigator.onLine;
    if (isLocalOnly) {
      this._rememberLocalLike(postId, userId, false);
      return { success: true, localOnly: true };
    }

    try {
      await this.ensureInitialized();
      const { doc, runTransaction } = this.firestoreMethods;
      const userLikeRef = doc(this.firestore, 'users', userId, 'liked_posts', postId);
      const postLikeRef = doc(this.firestore, 'posts', postId, 'likes', userId);

      // No inner catch: a failed transaction surfaces as success:false so the
      // optimistic UI can restore the like instead of pretending it persisted.
      await runTransaction(this.firestore, async (transaction) => {
        const likeSnap = await transaction.get(userLikeRef);
        if (!likeSnap.exists()) return;
        await countersManager.incrementInTransaction(transaction, { docPath: `posts/${postId}`, field: 'likes', amount: -1 });
        transaction.delete(userLikeRef);
        transaction.delete(postLikeRef);
      });

      this._rememberLocalLike(postId, userId, false);
      this.cache.delete(postId);
      this.invalidateCachePattern('user_posts_*');
      countersManager.invalidate({ docPath: `posts/${postId}`, field: 'likes' });
      auditLogger.log('content.unlike', { userId, meta: { postId } });
      return { success: true };
    } catch (error) {
      logger.warn('unlikePost failed', { postId, error: error?.message });
      return { success: false, error: error?.message || 'unlike-failed', localFallback: true };
    }
  }

  async getLikedPosts(userId, options = {}) {
    await this.ensureInitialized();
    const { collection, query, orderBy, limit, startAfter, getDocs, doc, getDoc } = this.firestoreMethods;
    const likedRef = collection(this.firestore, 'users', userId, 'liked_posts');
    let q = query(likedRef, orderBy('likedAt', 'desc'), limit(options.limit || 20));
    if (options.startAfter) {
      const lastDocRef = doc(this.firestore, 'users', userId, 'liked_posts', options.startAfter);
      const lastDocSnap = await getDoc(lastDocRef);
      if (lastDocSnap.exists()) q = query(q, startAfter(lastDocSnap));
    }
    const snap = await getDocs(q);
    const likedEntries = snap.docs.map(d => d.data().snapshot);
    const hasMore = snap.docs.length === (options.limit || 20);
    const nextCursor = hasMore ? snap.docs[snap.docs.length - 1].id : null;
    return { success: true, posts: likedEntries, hasMore, nextCursor };
  }

  async sharePost(postId, userId) {
    await this.ensureInitialized();
    try {
      const { collection, addDoc, doc, serverTimestamp } = this.firestoreMethods;
      await countersManager.increment({ docPath: `posts/${postId}`, field: 'shares' });
      const sharesRef = collection(this.firestore, 'shares');
      await addDoc(sharesRef, { postId, userId, sharedAt: serverTimestamp() });
      const userShareRef = doc(this.firestore, 'users', userId, 'shared_posts', postId);
      await this.firestoreMethods.setDoc(userShareRef, { postId, sharedAt: serverTimestamp() }, { merge: true });
      this.cache.delete(postId);
      countersManager.invalidate({ docPath: `posts/${postId}`, field: 'shares' });
      auditLogger.log('content.share', { userId, meta: { postId } });
      // Best-effort XP; sharing is already recorded, so a failure must not fail
      // the share. `source` makes the award idempotent server-side.
      try {
        const { levelSystemService } = await import('./levelSystemService.js');
        levelSystemService
          .awardExperience({ userId, action: 'post_shared', source: postId })
          .catch((err) => logger.warn('Share XP award failed', { postId, error: err?.message }));
      } catch (e) {
        logger.warn('Share XP award failed', { postId, error: e?.message });
      }
      return { success: true };
    } catch (error) { throw enhanceError(error, 'Failed to share post'); }
  }

  // A repost is a first-class post authored by the reposter that references the
  // original. The document id is deterministic (`repost_<uid>_<postId>`) so a
  // second repost is idempotent instead of a duplicate, and the reposter's post
  // count and the original's share counter are updated on success. The caller
  // must not report success unless this resolves — a `?.` call to a missing
  // method used to toast "Reposted" while nothing was written.
  async repostPost(postId, userId) {
    await this.ensureInitialized();
    try {
      const auth = await this.getAuthInstance();
      const uid = userId || auth?.currentUser?.uid;
      if (!uid) throw new Error('User not authenticated. Please sign in to repost.');
      if (!postId) throw new Error('A post id is required to repost.');

      const { collection, doc, getDoc, setDoc, addDoc, serverTimestamp } = this.firestoreMethods;

      const originalRef = doc(this.firestore, 'posts', postId);
      const originalSnap = await getDoc(originalRef);
      if (!originalSnap.exists() || originalSnap.data().isDeleted) {
        throw new Error('The original post no longer exists.');
      }
      const original = originalSnap.data();

      const repostId = `repost_${uid}_${postId}`;
      const repostRef = doc(this.firestore, 'posts', repostId);
      const existing = await getDoc(repostRef);
      if (existing.exists()) {
        return { success: true, alreadyReposted: true, postId: repostId };
      }

      const userSnap = await getDoc(doc(this.firestore, 'users', uid));
      const me = userSnap.exists() ? userSnap.data() : {};
      const myName = pickDisplayName([me.displayName, auth?.currentUser?.displayName, me.username]);

      // A repost copies the original's content, so reposting a private account's
      // post would publish that content to the reposter's (public) followers —
      // the exact leak the post read gate prevents. Refuse it.
      if (original.authorIsPrivate === true && original.authorId !== uid) {
        throw new Error('You cannot repost content from a private account.');
      }
      if (
        original.distributionSettings?.allowReposts === false ||
        original.engagementControls?.enableShares === false ||
        original.allowSharing === false
      ) {
        throw new Error('Reposting is disabled by the post author.');
      }

      const repostDoc = {
        type: 'repost',
        content: '',
        authorId: uid,
        authorName: myName,
        authorUsername: deriveHandle(me.username) || deriveHandle(me.email) || '',
        authorPhoto: getSafeAvatarUrl(me.photoURL, myName, uid),
        // Must mirror users/{uid}.isPrivate (the create rule enforces it).
        authorIsPrivate: me.isPrivate === true,
        originalPostId: postId,
        originalAuthorId: original.authorId || null,
        originalAuthorName: original.authorName || null,
        originalContent: (original.content || '').slice(0, 280),
        originalMedia: Array.isArray(original.media) ? original.media.slice(0, 4) : [],
        originalType: original.type || 'text',
        visibility: CONFIG.POST_VISIBILITY.PUBLIC,
        enableComments: true,
        enableGifts: true,
        isDeleted: false,
        stats: {
          likes: 0, comments: 0, shares: 0, saves: 0, views: 0, gifts: 0, giftValue: 0,
          reactions: Object.fromEntries(CONFIG.ALLOWED_REACTIONS.map(r => [r, 0])),
          pollVotes: 0,
        },
        gifts: [],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        publishedAt: serverTimestamp(),
        version: 'v5',
      };

      await setDoc(repostRef, repostDoc);
      this.cache.set(repostId, { ...repostDoc, id: repostId, _cachedAt: Date.now() });
      this.invalidateCachePattern(`user_posts_${uid}*`);

      // Secondary metrics: the repost itself already exists, so these are
      // best-effort and never flip the result to a failure.
      try {
        await countersManager.increment({ docPath: `posts/${postId}`, field: 'shares' });
        countersManager.invalidate({ docPath: `posts/${postId}`, field: 'shares' });
        await addDoc(collection(this.firestore, 'shares'), {
          postId, userId: uid, type: 'repost', sharedAt: serverTimestamp(),
        });
      } catch (e) { logger.warn('Repost share-counter update failed:', e?.message); }
      try {
        const { levelSystemService } = await import('./levelSystemService.js');
        levelSystemService
          .awardExperience({ userId: uid, action: 'post_created', source: repostId })
          .catch((err) => logger.warn('Repost XP award failed', { repostId, error: err?.message }));
      } catch (e) {
        logger.warn('Repost XP award failed', { repostId, error: e?.message });
      }

      auditLogger.log('content.repost', { userId: uid, meta: { postId, repostId } });
      return { success: true, alreadyReposted: false, postId: repostId };
    } catch (error) {
      throw enhanceError(error, 'Failed to repost');
    }
  }

  async addReaction(postId, userId, reactionType) {
    await this.ensureInitialized();
    if (!CONFIG.ALLOWED_REACTIONS.includes(reactionType)) {
      throw new Error(`Reaction type "${reactionType}" not allowed`);
    }
    try {
      const { doc, runTransaction, increment, serverTimestamp } = this.firestoreMethods;
      const postRef = doc(this.firestore, 'posts', postId);
      const reactionDocRef = doc(this.firestore, 'posts', postId, CONFIG.REACTIONS_SUBCOLLECTION, userId);
      let authorId, action, oldReaction;
      await runTransaction(this.firestore, async (transaction) => {
        const postSnap = await transaction.get(postRef);
        authorId = postSnap.exists() ? postSnap.data().authorId : null;
        const reactionSnap = await transaction.get(reactionDocRef);
        const currentReaction = reactionSnap.exists() ? reactionSnap.data().type : null;

        if (currentReaction === reactionType) {
          transaction.delete(reactionDocRef);
          if (postSnap.exists()) {
            transaction.update(postRef, {
              [`stats.reactions.${reactionType}`]: increment(-1),
              updatedAt: serverTimestamp()
            });
          }
          action = 'removed';
          oldReaction = reactionType;
        } else if (currentReaction) {
          transaction.set(reactionDocRef, { type: reactionType, updatedAt: serverTimestamp() }, { merge: true });
          if (postSnap.exists()) {
            transaction.update(postRef, {
              [`stats.reactions.${currentReaction}`]: increment(-1),
              [`stats.reactions.${reactionType}`]: increment(1),
              updatedAt: serverTimestamp()
            });
          }
          action = 'changed';
          oldReaction = currentReaction;
        } else {
          transaction.set(reactionDocRef, { type: reactionType, userId, createdAt: serverTimestamp() });
          if (postSnap.exists()) {
            transaction.update(postRef, {
              [`stats.reactions.${reactionType}`]: increment(1),
              updatedAt: serverTimestamp()
            });
          }
          action = 'added';
        }
      });
      this.cache.delete(postId);
      return { success: true, action, previousReaction: oldReaction };
    } catch (error) {
      logger.error(`❌ Add reaction failed for ${postId}:`, error);
      throw enhanceError(error, 'Failed to add reaction');
    }
  }

  async removeReaction(postId, userId) {
    await this.ensureInitialized();
    try {
      const { doc, runTransaction, increment, serverTimestamp } = this.firestoreMethods;
      const postRef = doc(this.firestore, 'posts', postId);
      const reactionDocRef = doc(this.firestore, 'posts', postId, CONFIG.REACTIONS_SUBCOLLECTION, userId);
      let removedType;
      await runTransaction(this.firestore, async (transaction) => {
        const reactionSnap = await transaction.get(reactionDocRef);
        if (!reactionSnap.exists()) return;
        removedType = reactionSnap.data().type;
        transaction.delete(reactionDocRef);
        transaction.update(postRef, {
          [`stats.reactions.${removedType}`]: increment(-1),
          updatedAt: serverTimestamp()
        });
      });
      if (removedType) this.cache.delete(postId);
      return { success: true, removed: !!removedType };
    } catch (error) { throw enhanceError(error, 'Failed to remove reaction'); }
  }

  async getUserReaction(postId, userId) {
    await this.ensureInitialized();
    const reactionDocRef = this.firestoreMethods.doc(this.firestore, 'posts', postId, CONFIG.REACTIONS_SUBCOLLECTION, userId);
    const snap = await this.firestoreMethods.getDoc(reactionDocRef);
    return { success: true, reaction: snap.exists() ? snap.data().type : null };
  }

  /**
   * The viewer's own state for one post — liked, saved, and reaction. These
   * live in per-user subcollection docs (`posts/{id}/likes|saves|reactions/{uid}`)
   * that the post document itself never carries, so a card reading only the
   * post doc can never know the viewer already liked/saved/reacted (the like
   * only survived on the device-local registry, so it vanished on any other
   * device or after a storage clear). Three point reads of the viewer's own
   * docs, issued in parallel; a denied/absent read resolves to the negative.
   */
  async getPostViewerState(postId, userId) {
    if (!postId || !userId) return { liked: false, saved: false, reaction: null };
    await this.ensureInitialized();
    const { doc, getDoc } = this.firestoreMethods;
    const read = async (subcollection) => {
      try {
        const snap = await getDoc(doc(this.firestore, 'posts', postId, subcollection, userId));
        return snap.exists() ? snap.data() : null;
      } catch {
        return null;
      }
    };
    const [like, save, reaction] = await Promise.all([
      read('likes'),
      read('saves'),
      read(CONFIG.REACTIONS_SUBCOLLECTION),
    ]);
    return {
      liked: Boolean(like),
      saved: Boolean(save),
      reaction: reaction?.type || null,
    };
  }

  /**
   * Batch form of the `liked` half of `getPostViewerState` for a list of posts
   * (a profile grid). The viewer's likes live in their own
   * `users/{uid}/liked_posts` subcollection (the doc id IS the post id), which
   * the rules authorise on the path's owner alone — so a bounded
   * `documentId() in` read resolves the whole grid in one chunked query
   * instead of one point read per post. Returns a `Set` of liked post ids.
   */
  async getLikedPostIds(userId, postIds) {
    const ids = [...new Set((postIds || []).filter(Boolean))];
    if (!userId || ids.length === 0) return new Set();
    await this.ensureInitialized();
    const { collection, query, where, documentId, limit: fLimit, getDocs } = this.firestoreMethods;
    const liked = new Set();
    for (let i = 0; i < ids.length; i += 30) {
      const chunk = ids.slice(i, i + 30);
      try {
        const snap = await getDocs(query(
          collection(this.firestore, 'users', userId, 'liked_posts'),
          where(documentId(), 'in', chunk),
          fLimit(chunk.length)
        ));
        snap.forEach((d) => liked.add(d.id));
      } catch {
        // A denied/absent read leaves those ids unresolved (treated as not liked).
      }
    }
    return liked;
  }

  /**
   * Batch resolve whether the viewer has bookmarked each post in `postIds`
   * via `users/{uid}/saved_posts` `documentId() in` chunks of 30.
   */
  async getSavedPostIds(userId, postIds) {
    const ids = [...new Set((postIds || []).filter(Boolean))];
    if (!userId || ids.length === 0) return new Set();
    await this.ensureInitialized();
    const { collection, query, where, documentId, limit: fLimit, getDocs } = this.firestoreMethods;
    const saved = new Set();
    for (let i = 0; i < ids.length; i += 30) {
      const chunk = ids.slice(i, i + 30);
      try {
        const snap = await getDocs(query(
          collection(this.firestore, 'users', userId, 'saved_posts'),
          where(documentId(), 'in', chunk),
          fLimit(chunk.length)
        ));
        snap.forEach((d) => saved.add(d.id));
      } catch {
        // Leave unresolved ids as not saved on read failure.
      }
    }
    return saved;
  }

  async incrementCommentCount(postId, delta = 1) {
    await this.ensureInitialized();
    try {
      // Route through the sharded counter: a direct `stats.comments` write on
      // the post doc is a non-author document write the rules now refuse, and
      // the sharded value is what `countersManager.apply` overlays on read.
      await countersManager.increment({ docPath: `posts/${postId}`, field: 'comments', amount: delta });
      this.cache.delete(postId);
      countersManager.invalidate({ docPath: `posts/${postId}`, field: 'comments' });
      return { success: true };
    } catch (error) { throw enhanceError(error, 'Failed to increment comment count'); }
  }

  async getUserPollVote(postId, userId, options = {}) {
    await this.ensureInitialized();
    const { doc, getDoc } = this.firestoreMethods;
    const allowMultiple = options?.allowMultiple === true;
    const optionCount = Math.max(0, Math.min(10, Number(options?.optionCount) || 10));

    if (allowMultiple) {
      const indices = Array.from({ length: optionCount }, (_, idx) => idx);
      const snaps = await Promise.all(
        indices.map((idx) =>
          getDoc(doc(this.firestore, 'posts', postId, 'poll_votes', `${userId}_opt_${idx}`)).catch(() => null)
        )
      );
      const optionIds = [];
      let firstIndex = null;
      snaps.forEach((snap, idx) => {
        if (snap && snap.exists()) {
          const data = snap.data() || {};
          const optId = data.optionId || `opt_${idx}`;
          optionIds.push(optId);
          if (firstIndex === null) firstIndex = data.optionIndex ?? idx;
        }
      });
      if (optionIds.length > 0) {
        return { success: true, optionIndex: firstIndex, optionId: optionIds[0], optionIds };
      }
    }

    const voteRef = doc(this.firestore, 'posts', postId, 'poll_votes', userId);
    const snap = await getDoc(voteRef);
    if (!snap.exists()) return { success: true, optionIndex: null, optionId: null, optionIds: [] };
    const data = snap.data() || {};
    const optId = data.optionId ?? (data.optionIndex != null ? `opt_${data.optionIndex}` : null);
    return {
      success: true,
      optionIndex: data.optionIndex ?? null,
      optionId: optId,
      optionIds: optId ? [optId] : [],
    };
  }

  // ── Q&A (post-embedded questions) ───────────────────────────────────
  // Answers live on `posts/{id}.question.answers` and are mutated only by the
  // `functions/questions.js` callables (a direct client write is denied — an
  // answerer is not the post author — and would let a voter forge `isBest`).
  // The composer used to publish `question` as a bare string; normalise the
  // shape so QuestionCard's `question.text`/`answers` reads resolve.
  _normaliseQuestion(raw, fallbackText) {
    if (raw && typeof raw === 'object') {
      return {
        text: raw.text || raw.question || fallbackText || '',
        bounty: Number(raw.bounty) || 0,
        closed: raw.closed === true,
        acceptedAnswerId: raw.acceptedAnswerId ?? null,
        answers: Array.isArray(raw.answers) ? raw.answers : [],
      };
    }
    return {
      text: (typeof raw === 'string' && raw) || fallbackText || '',
      bounty: 0,
      closed: false,
      acceptedAnswerId: null,
      answers: [],
    };
  }

  async addAnswer(postId, answer, idempotencyKey) {
    const { callFunction, FUNCTIONS } = await import('./callableService.js');
    const result = await callFunction(FUNCTIONS.ADD_ANSWER, { postId, answer, idempotencyKey });
    return { success: true, answerId: result?.answerId ?? null };
  }

  async editAnswer(postId, answerId, answer) {
    const { callFunction, FUNCTIONS } = await import('./callableService.js');
    await callFunction(FUNCTIONS.EDIT_ANSWER, { postId, answerId, answer });
    return { success: true };
  }

  async deleteAnswer(postId, answerId) {
    const { callFunction, FUNCTIONS } = await import('./callableService.js');
    await callFunction(FUNCTIONS.DELETE_ANSWER, { postId, answerId });
    return { success: true };
  }

  async voteAnswer(postId, answerId, direction) {
    const { callFunction, FUNCTIONS } = await import('./callableService.js');
    const result = await callFunction(FUNCTIONS.CAST_ANSWER_VOTE, { postId, answerId, direction });
    return { success: true, answer: result?.answer ?? null, vote: result?.vote ?? null };
  }

  async acceptAnswer(postId, answerId) {
    const { callFunction, FUNCTIONS } = await import('./callableService.js');
    await callFunction(FUNCTIONS.ACCEPT_ANSWER, { postId, answerId });
    return { success: true };
  }

  // The viewer's own votes on a question's answers, as { answerId: 'up'|'down' }.
  // Bounded to the (small) answer_votes subcollection for this question.
  async getMyAnswerVotes(postId, userId) {
    if (!postId || !userId) return { success: true, votes: {} };
    await this.ensureInitialized();
    try {
      const { collection, query, where, getDocs, limit } = this.firestoreMethods;
      const ref = collection(this.firestore, 'posts', postId, 'answer_votes');
      const snap = await getDocs(query(ref, where('userId', '==', userId), limit(100)));
      const votes = {};
      snap.forEach((d) => { votes[d.data().answerId] = d.data().direction; });
      return { success: true, votes };
    } catch (error) {
      logger.warn('getMyAnswerVotes failed', { postId, error: error.message });
      // Fail closed: the caller must know the vote state is unknown so a
      // returning voter is not shown as having no vote (which would let the
      // server toggle their existing vote off).
      return { success: false, votes: {}, error: error?.message || 'answer-votes-failed' };
    }
  }

  // Post-embedded poll voting is server-authoritative: `functions/polls.js`
  // `votePostPoll` validates eligibility/expiry/option and records one vote per
  // viewer in a transaction. The posts update rule lets any signed-in user write
  // `poll`, so a client transaction here would let a voter forge counts (the
  // previous implementation did exactly that).
  async voteOnPoll(postId, userId, optionIndex, isMultiple = false) {
    await this.ensureInitialized();
    if (!userId) throw new Error('Sign in to vote');
    try {
      const { callFunction, FUNCTIONS } = await import('./callableService.js');
      const data = await callFunction(FUNCTIONS.VOTE_POST_POLL, {
        postId,
        optionId: `opt_${optionIndex}`,
      });
      this.cache.delete(postId);
      return { success: true, alreadyVoted: false, options: data?.options, totalVotes: data?.totalVotes };
    } catch (error) {
      const code = error?.code || '';
      if (String(code).includes('already-exists')) {
        return { success: true, alreadyVoted: true };
      }
      throw enhanceError(error, 'Failed to vote on poll');
    }
  }

  async recordPostView(postId, userId) {
    await this.ensureInitialized();
    // Counting is server-authoritative: the per-(post,viewer,day) dedupe
    // transaction, the daily stat and the sharded total are written by the
    // `recordPostView` callable. The client no longer writes
    // `posts/{id}/view_aggregate`, `/daily_stats` or `/view_shards` (rules deny
    // those writes — the posts `{subcollection}` rule binds every child id to
    // the caller's uid, so a direct write was always denied).
    try {
      const { callFunction, FUNCTIONS } = await import('./callableService.js');
      const result = await callFunction(FUNCTIONS.RECORD_POST_VIEW, { postId });
      if (result?.counted) {
        countersManager.invalidate({ docPath: `posts/${postId}`, field: 'views' });
      }
      return { success: true, counted: Boolean(result?.counted) };
    } catch (error) {
      logger.warn('recordPostView failed', { postId, error: error.message });
      return { success: false, error: error.message };
    }
  }

  async getPostViewCount(postId) {
    await this.ensureInitialized();
    // The total is a sharded counter (`counter_shards`), summed client-side by
    // CountersManager — the same layout the recordPostView callable writes.
    const views = await countersManager.get({ docPath: `posts/${postId}`, field: 'views' });
    return { success: true, views };
  }

  async getPostDailyViews(postId, days = 7) {
    await this.ensureInitialized();
    const { collection, query, where, orderBy, getDocs, limit } = this.firestoreMethods;
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const statsRef = collection(this.firestore, 'posts', postId, CONFIG.DAILY_STATS_SUBCOLLECTION);
    const q = query(statsRef, where('date', '>=', startDate), orderBy('date', 'asc'), limit(Math.max(1, Number(days) || 7)));
    const snap = await getDocs(q);
    const dailyViews = snap.docs.map(doc => ({ date: doc.id, ...doc.data() }));
    return { success: true, dailyViews };
  }

  async getPostAnalytics(postId, days = 30) {
    await this.ensureInitialized();
    const dailyStats = await this.getPostDailyViews(postId, days);
    if (!dailyStats.success) return { success: false, error: dailyStats.error };
    const dailyTotalViews = dailyStats.dailyViews.reduce((sum, d) => sum + (unknownNumber(d.views) ?? 0), 0);
    const [post, shardedViews] = await Promise.all([
      this.getPost(postId),
      countersManager.get({ docPath: `posts/${postId}`, field: 'views', fallback: dailyTotalViews }).catch(() => dailyTotalViews),
    ]);
    const stats = post.success ? post.post.stats : {};
    const totalViews = dailyTotalViews > 0 || (typeof shardedViews === 'number' && shardedViews > 0)
      ? Math.max(dailyTotalViews, typeof shardedViews === 'number' ? shardedViews : 0)
      : dailyTotalViews;
    // An unread counter stays null (the panel renders '—'); coercing it to 0
    // fabricated "0 Likes" for a post whose stats were never loaded.
    return {
      success: true,
      analytics: {
        totalViews,
        totalLikes: unknownNumber(stats.likes),
        totalComments: unknownNumber(stats.comments),
        totalShares: unknownNumber(stats.shares),
        dailyBreakdown: dailyStats.dailyViews
      }
    };
  }

  subscribeToPost(postId, callback) {
    const { doc, onSnapshot } = this.firestoreMethods;
    const postRef = doc(this.firestore, 'posts', postId);
    const subKey = `post_${postId}`;
    if (this.subscriptions.has(subKey)) {
      try { this.subscriptions.get(subKey)(); } catch (e) {
        logger.debug('Stale post subscription unsubscribe failed', { error: e?.message });
      }
    }
    const unsubscribe = onSnapshot(postRef, (snap) => {
      if (snap.exists()) {
        const data = { id: snap.id, ...snap.data() };
        callback(data);
        this.cache.set(postId, data);
      } else {
        callback(null);
      }
    }, error => {
      logger.error(`Post subscription error for ${postId}:`, error);
    });
    this.subscriptions.set(subKey, unsubscribe);
    return unsubscribe;
  }

  // Engagement-only view of a post, for cards that render counts without the
  // whole document. Reuses `subscribeToPost` (one listener per post) and overlays
  // the sharded counters so document fields left at 0 never clobber real totals.
  subscribeToPostStats(postId, callback) {
    let cancelled = false;
    const unsubscribe = this.subscribeToPost(postId, async (data) => {
      if (!data) {
        if (!cancelled) callback(null);
        return;
      }
      const overlaid = {
        ...data,
        stats: { ...(data.stats || {}) },
      };
      try {
        await countersManager.apply({
          data: overlaid,
          docPath: `posts/${postId}`,
          fields: ['likes', 'comments', 'saves', 'shares', 'gifts', 'giftValue', 'views'],
          scope: 'stats',
        });
      } catch (err) {
        logger.debug('subscribeToPostStats shard overlay failed', { postId, error: err?.message });
      }
      if (cancelled) return;
      const stats = overlaid.stats || {};
      // A counter the post document never wrote is unknown, not a measured 0:
      // the card's reducer keeps its prior value for a null (`?? state.x`) and
      // renders '—' when nothing has ever been known.
      callback({
        likes: unknownNumber(stats.likes),
        comments: unknownNumber(stats.comments),
        shares: unknownNumber(stats.shares),
        gifts: unknownNumber(stats.gifts),
        views: unknownNumber(stats.views),
      });
    });
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }

  async getAuthInstance() {
    if (!this.firebaseApp) this.firebaseApp = await import('../firebase/firebase.js');
    return await this.firebaseApp.getAuthInstance();
  }

  invalidateCache(key) { this.cache.delete(key); }
  invalidateCachePattern(pattern) { this.cache?.deletePattern?.(pattern); }

  getStats() {
    return {
      cacheSize: this.cache.size,
      subscriptions: this.subscriptions.size,
      initialized: this.initialized,
      online: this.isOnline,
    };
  }

  clearCache() { this.cache.clear(); logger.warn('// Firestore cache cleared'); }

  destroy() {
    for (const unsub of this.subscriptions.values()) try { unsub(); } catch (e) {
      logger.debug('Subscription unsubscribe failed', { error: e?.message });
    }
    this.subscriptions.clear();
    this.clearCache();
    this.initialized = false;
    this.firestore = null;
    this.firestoreMethods = null;
    this.firebaseApp = null;
  }
}

let instance = null;
function getFirestoreService() {
  if (!instance) instance = new EnterpriseFirestoreService();
  return instance;
}

const firestoreService = {
  initialize: () => instance?.initialize() || getFirestoreService().initialize(),
  createPost: (data) => getFirestoreService().createPost(data),
  getPost: (id, opts) => getFirestoreService().getPost(id, opts),
  getPostsByUser: (uid, opts) => getFirestoreService().getPostsByUser(uid, opts),
  getScheduledPosts: (uid, limitCount) => getFirestoreService().getScheduledPosts(uid, limitCount),
  getUserPostsCount: (uid, opts) => getFirestoreService().getUserPostsCount(uid, opts),
  getUserTotalPostLikes: (uid, opts) => getFirestoreService().getUserTotalPostLikes(uid, opts),
  updatePost: (id, updates) => getFirestoreService().updatePost(id, updates),
  deletePost: (id, uid) => getFirestoreService().deletePost(id, uid),
  restorePost: (id, uid) => getFirestoreService().restorePost(id, uid),
  batchDeletePosts: (ids, uid, isAdmin) => getFirestoreService().batchDeletePosts(ids, uid, isAdmin),
  likePost: (pid, uid) => getFirestoreService().likePost(pid, uid),
  unlikePost: (pid, uid) => getFirestoreService().unlikePost(pid, uid),
  sharePost: (pid, uid) => getFirestoreService().sharePost(pid, uid),
  repostPost: (pid, uid) => getFirestoreService().repostPost(pid, uid),
  savePost: (pid, uid) => getFirestoreService().savePost(pid, uid),
  unsavePost: (pid, uid) => getFirestoreService().unsavePost(pid, uid),
  getSavedPosts: (uid, opts) => getFirestoreService().getSavedPosts(uid, opts),
  getLikedPosts: (uid, opts) => getFirestoreService().getLikedPosts(uid, opts),
  addReaction: (pid, uid, reactionType) => getFirestoreService().addReaction(pid, uid, reactionType),
  removeReaction: (pid, uid) => getFirestoreService().removeReaction(pid, uid),
  getUserReaction: (pid, uid) => getFirestoreService().getUserReaction(pid, uid),
  getPostViewerState: (pid, uid) => getFirestoreService().getPostViewerState(pid, uid),
  getLikedPostIds: (uid, ids) => getFirestoreService().getLikedPostIds(uid, ids),
  getSavedPostIds: (uid, ids) => getFirestoreService().getSavedPostIds(uid, ids),
  voteOnPoll: (pid, uid, optIdx, mult) => getFirestoreService().voteOnPoll(pid, uid, optIdx, mult),
  getUserPollVote: (pid, uid) => getFirestoreService().getUserPollVote(pid, uid),
  addAnswer: (pid, answer, key) => getFirestoreService().addAnswer(pid, answer, key),
  editAnswer: (pid, aid, answer) => getFirestoreService().editAnswer(pid, aid, answer),
  deleteAnswer: (pid, aid) => getFirestoreService().deleteAnswer(pid, aid),
  voteAnswer: (pid, aid, dir) => getFirestoreService().voteAnswer(pid, aid, dir),
  acceptAnswer: (pid, aid) => getFirestoreService().acceptAnswer(pid, aid),
  getMyAnswerVotes: (pid, uid) => getFirestoreService().getMyAnswerVotes(pid, uid),
  incrementCommentCount: (pid, delta) => getFirestoreService().incrementCommentCount(pid, delta),
  recordPostView: (pid, uid) => getFirestoreService().recordPostView(pid, uid),
  getPostViewCount: (pid) => getFirestoreService().getPostViewCount(pid),
  getPostDailyViews: (pid, days) => getFirestoreService().getPostDailyViews(pid, days),
  getPostAnalytics: (pid, days) => getFirestoreService().getPostAnalytics(pid, days),
  subscribeToPost: (pid, cb) => getFirestoreService().subscribeToPost(pid, cb),
  saveDraft: (did, uid, data) => getFirestoreService().saveDraft(did, uid, data),
  getDraft: (did) => getFirestoreService().getDraft(did),
  deleteDraft: (did) => getFirestoreService().deleteDraft(did),
  publishToPlatform: (pid, platforms) => getFirestoreService().publishToPlatform(pid, platforms),
  getService: getFirestoreService,
  clearCache: () => getFirestoreService().clearCache(),
  getStats: () => getFirestoreService().getStats(),
  ensureInitialized: () => getFirestoreService().ensureInitialized(),
};

export default firestoreService;
export { firestoreService, getFirestoreService };