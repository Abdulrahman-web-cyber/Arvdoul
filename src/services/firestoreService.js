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
  let message = errorMap[code] || defaultMessage || 'Database operation failed';
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
        enableIndexedDbPersistence, onSnapshot, runTransaction, writeBatch, Timestamp,
        setDoc, collectionGroup, documentId, getCountFromServer
      } = this.firestoreModule;
      this.firestoreMethods = {
        collection, addDoc, getDoc, getDocs, updateDoc, deleteDoc,
        query, where, orderBy, limit, startAfter, startAt,
        serverTimestamp, increment, arrayUnion, arrayRemove, doc,
        onSnapshot, runTransaction, writeBatch, Timestamp,
        setDoc, collectionGroup, documentId, getCountFromServer
      };
      try {
        await enableIndexedDbPersistence(this.firestore, { synchronizeTabs: true });
        logger.warn('// Firestore persistence enabled');
      } catch (persistenceError) {
        // persistence already active or unsupported
      }
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

  async ensureinitialize() {
    return this.ensureInitialized();
  }

  async _ensureinitialize() {
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
        } catch {}
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
      if (!currentUser && auth) {
        try {
          const { signInAnonymously } = await import('firebase/auth');
          const cred = await signInAnonymously(auth);
          currentUser = cred.user;
        } catch (anonErr) {
          console.warn('Anonymous sign-in fallback:', anonErr?.message);
        }
      }
      if (!currentUser && postData.authorId) {
        currentUser = { uid: postData.authorId, displayName: postData.authorName || 'Arvdoul User' };
      }
      if (!currentUser?.uid) throw new Error('User not authenticated. Please sign in to publish.');
      postData.authorId = currentUser.uid;
      const { collection, addDoc, serverTimestamp } = this.firestoreMethods;

      // Denormalise the author's privacy onto the post: the read rule gates a
      // private account's content on this field (rules cannot get() a user doc
      // during a list query). The create rule verifies it equals
      // users/{uid}.isPrivate, so it cannot be spoofed; a read failure defaults
      // to public and a genuinely-private author is then rejected (fail closed).
      let authorIsPrivate = false;
      try {
        const { doc: userDoc, getDoc: getUserDoc } = this.firestoreMethods;
        const authorSnap = await getUserDoc(userDoc(this.firestore, 'users', postData.authorId));
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
      
      // Sanitize media items to ensure pure serializable objects
      const cleanMedia = (Array.isArray(postData.media) ? postData.media : []).map((m) => {
        if (!m) return null;
        if (typeof m === 'string') return { url: m, type: 'image' };
        return {
          url: m.url || m.preview || '',
          type: m.type || 'image',
          name: m.name || '',
          alt: m.alt || '',
          thumbnail: m.thumbnail || null,
        };
      }).filter((m) => m && m.url);

      const firstMedia = cleanMedia[0] || null;
      const videoItem = cleanMedia.find(m => m.type === 'video') || null;

      const postDoc = {
        type: postData.type || 'text',
        content: postData.content || '',
        contentJSON: postData.contentJSON || null,
        media: cleanMedia,
        mediaUrl: postData.mediaUrl || firstMedia?.url || '',
        videoUrl: postData.videoUrl || postData.video?.url || videoItem?.url || '',
        thumbnailUrl: postData.thumbnailUrl || firstMedia?.thumbnail || firstMedia?.url || '',
        authorId: postData.authorId,
        authorName: postData.authorName || currentUser.displayName || 'Arvdoul User',
        authorUsername: postData.authorUsername || `user_${postData.authorId?.slice(0,8)}`,
        authorIsPrivate,
        authorPhoto: getSafeAvatarUrl(postData.authorPhoto, postData.authorName || 'Arvdoul User', postData.authorId),
        ...(postData.type === 'poll' && { poll: { options: postData.poll?.options || [], totalVotes: 0, allowMultiple: !!postData.poll?.allowMultiple } }),
        ...(postData.type === 'question' && { question: this._normaliseQuestion(postData.question, postData.content) }),
        ...(postData.type === 'link' && { link: postData.link }),
        ...(postData.type === 'event' && { event: postData.event }),
        ...(postData.type === 'video' && { video: postData.video || { url: videoItem?.url || '' } }),
        ...(postData.type === 'audio' && { audio: postData.audio || null }),
        visibility: postData.visibility || CONFIG.POST_VISIBILITY.PUBLIC,
        enableComments: postData.enableComments !== false,
        enableGifts: postData.enableGifts !== false,
        location: postData.location || null,
        tags: postData.tags || [],
        hashtags: this.extractHashtags(postData.content),
        status: status,
        isDeleted: false,
        monetization: postData.monetization || null,
        boostData: postData.boostData || null,
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

      // Helper to strip any undefined keys recursively so addDoc never rejects
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
      const addDocPromise = addDoc(postsRef, cleanPostDoc);
      const addDocTimeout = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Firestore addDoc timeout')), 5000)
      );
      const docRef = await Promise.race([addDocPromise, addDocTimeout]);
      const postId = docRef.id;
      this.cache.set(postId, { ...cleanPostDoc, id: postId, _cachedAt: Date.now() });
      this.invalidateCachePattern(`user_posts_${postData.authorId}*`);

      // Level system: award post_created XP (best-effort, never breaks publish).
      try {
        const { levelSystemService } = await import('./levelSystemService.js');
        levelSystemService
          .awardExperience({ userId: postData.authorId, action: 'post_created', source: postId })
          .catch(() => {});
      } catch (e) {
        // XP award is best-effort
      }

      return {
        success: true, postId, post: { ...postDoc, id: postId }, operationId,
        duration: Date.now() - startTime
      };
    } catch (error) {
      logger.error('❌ Create post failed:', error);
      throw enhanceError(error, 'Failed to create post');
    }
  }

  extractHashtags(content) {
    if (!content) return [];
    const hashtags = content.match(/#(\w+)/g);
    return hashtags ? [...new Set(hashtags.map(tag => tag.toLowerCase()))] : [];
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
      await countersManager.apply({ data: postData, docPath: `posts/${postId}`, fields: ['likes', 'saves', 'shares', 'gifts', 'giftValue'] });
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
      // The list rule only admits two shapes (rules are not filters): the
      // owner's own shape (`authorId == uid()`) and the public-feed shape
      // (`authorIsPrivate == false` + `visibility == 'public'` +
      // `status == 'published'` + `isDeleted == false`). A non-owner can
      // therefore only list public published posts; drafts/scheduled/only-me
      // posts stay invisible even though the query is author-scoped.
      const conditions = [
        where('authorId', '==', userId),
        orderBy('createdAt', 'desc'),
      ];
      if (options.type) conditions.push(where('type', '==', options.type));
      if (isOwnerView) {
        conditions.push(where('isDeleted', '==', false));
        if (options.status) conditions.push(where('status', '==', options.status));
      } else {
        conditions.push(where('authorIsPrivate', '==', false));
        conditions.push(where('status', '==', 'published'));
        conditions.push(where('isDeleted', '==', false));
        conditions.push(where('visibility', '==', 'public'));
      }

      // Always bound: a caller that omits `limit` must not pull the author's
      // entire post history in one read.
      conditions.push(limit(Math.max(1, Number(options.limit) || 20)));
      
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
      
      const q = query(postsRef, ...conditions);
      const snap = await getDocs(q);
      const posts = await Promise.all(snap.docs.map(async (doc) => {
        const data = { id: doc.id, ...doc.data() };
        await countersManager.apply({ data, docPath: `posts/${doc.id}`, fields: ['likes', 'saves', 'shares', 'gifts', 'giftValue'] });
        return data;
      }));
      const hasMore = snap.docs.length === (options.limit || 10);
      const nextCursor = hasMore ? snap.docs[snap.docs.length - 1].id : null;
      
      const result = { success: true, posts, hasMore, nextCursor, total: posts.length };
      this.cache.set(cacheKey, result);
      return result;
    } catch (error) {
      throw enhanceError(error, `Failed to fetch posts for user ${userId}`);
    }
  }

  async updatePost(postId, updates) {
    await this.ensureInitialized();
    try {
      const { doc, updateDoc, serverTimestamp } = this.firestoreMethods;
      const postRef = doc(this.firestore, 'posts', postId);
      await updateDoc(postRef, { ...updates, updatedAt: serverTimestamp(), _clientUpdatedAt: new Date().toISOString() });
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
    const posts = savedEntries.map(entry => entry.snapshot);
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
      let authorId = null;

      // No inner catch: a failed transaction surfaces as success:false so the
      // caller can roll back the optimistic heart instead of showing a like
      // that was never persisted.
      await runTransaction(this.firestore, async (transaction) => {
        const postSnap = await transaction.get(postRef);
        if (!postSnap.exists()) return;
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

      this._rememberLocalLike(postId, userId, true);
      this.cache.delete(postId);
      countersManager.invalidate({ docPath: `posts/${postId}`, field: 'likes' });
      auditLogger.log('content.like', { userId, meta: { postId, alreadyLiked } });

      if (!alreadyLiked && authorId && authorId !== userId) {
        Promise.all([
          (async () => {
            try {
              const { getNotificationsService } = await import('./notificationsService.js');
              await getNotificationsService().createLikeNotification(postId, userId, authorId);
            } catch (e) { /* like notification is best-effort */ }
          })(),
          (async () => {
            try {
              const { levelSystemService } = await import('./levelSystemService.js');
              await levelSystemService.awardExperience({
                userId: authorId,
                action: 'like_received',
                source: postId,
              });
            } catch (e) { /* XP award is best-effort */ }
          })(),
        ]).catch(() => {});
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
          .catch(() => {});
      } catch (e) {
        // XP award is best-effort
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
      const myName = me.displayName || auth?.currentUser?.displayName || 'Arvdoul User';

      // A repost copies the original's content, so reposting a private account's
      // post would publish that content to the reposter's (public) followers —
      // the exact leak the post read gate prevents. Refuse it.
      if (original.authorIsPrivate === true && original.authorId !== uid) {
        throw new Error('You cannot repost content from a private account.');
      }

      const repostDoc = {
        type: 'repost',
        content: '',
        authorId: uid,
        authorName: myName,
        authorUsername: me.username || `user_${uid.slice(0, 8)}`,
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
      try { await this.updateUserPostCount(uid, 1); } catch (e) {}
      try {
        const { levelSystemService } = await import('./levelSystemService.js');
        levelSystemService
          .awardExperience({ userId: uid, action: 'post_created', source: repostId })
          .catch(() => {});
      } catch (e) {}

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

  async incrementCommentCount(postId, delta = 1) {
    await this.ensureInitialized();
    try {
      const { doc, updateDoc, increment, serverTimestamp } = this.firestoreMethods;
      const postRef = doc(this.firestore, 'posts', postId);
      await updateDoc(postRef, { 'stats.comments': increment(delta), updatedAt: serverTimestamp() });
      this.cache.delete(postId);
      return { success: true };
    } catch (error) { throw enhanceError(error, 'Failed to increment comment count'); }
  }

  async getUserPollVote(postId, userId) {
    await this.ensureInitialized();
    const { doc, getDoc } = this.firestoreMethods;
    const voteRef = doc(this.firestore, 'posts', postId, 'poll_votes', userId);
    const snap = await getDoc(voteRef);
    if (!snap.exists()) return { success: true, optionIndex: null, optionId: null };
    const data = snap.data();
    return { success: true, optionIndex: data.optionIndex ?? null, optionId: data.optionId ?? null };
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
  // `votePostPoll` validates eligibility/expiry/option, records one vote per
  // viewer in a transaction and credits the reward. The posts update rule lets
  // any signed-in user write `poll`, so a client transaction here would let a
  // voter forge counts (the previous implementation did exactly that).
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
      return { success: true, alreadyVoted: false, options: data?.options, totalVotes: data?.totalVotes, rewardCoins: data?.rewardCoins };
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
    const totalViews = dailyStats.dailyViews.reduce((sum, d) => sum + (d.views || 0), 0);
    const post = await this.getPost(postId);
    const stats = post.success ? post.post.stats : {};
    return {
      success: true,
      analytics: {
        totalViews,
        totalLikes: stats.likes || 0,
        totalComments: stats.comments || 0,
        totalShares: stats.shares || 0,
        dailyBreakdown: dailyStats.dailyViews
      }
    };
  }

  subscribeToPost(postId, callback) {
    const { doc, onSnapshot } = this.firestoreMethods;
    const postRef = doc(this.firestore, 'posts', postId);
    const subKey = `post_${postId}`;
    if (this.subscriptions.has(subKey)) {
      try { this.subscriptions.get(subKey)(); } catch (e) {}
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
  // whole document. Reuses `subscribeToPost` (one listener per post) and maps
  // the stats block to the shape the card reducer consumes.
  subscribeToPostStats(postId, callback) {
    return this.subscribeToPost(postId, (data) => {
      if (!data) return callback(null);
      const stats = data.stats || {};
      callback({
        likes: stats.likes ?? 0,
        comments: stats.comments ?? 0,
        shares: stats.shares ?? 0,
        gifts: stats.gifts ?? 0,
        views: stats.views ?? 0,
      });
    });
  }

  async getAuthInstance() {
    if (!this.firebaseApp) this.firebaseApp = await import('../firebase/firebase.js');
    return await this.firebaseApp.getAuthInstance();
  }

  async updateUserPostCount(userId, delta = 1) {
    try {
      await this.ensureInitialized();
      const { doc, updateDoc, increment, serverTimestamp } = this.firestoreMethods;
      const userRef = doc(this.firestore, 'users', userId);
      await updateDoc(userRef, { postCount: increment(delta), updatedAt: serverTimestamp() });
    } catch (error) {
      // update post count quietly
    }
  }

  invalidateCache(key) { this.cache.delete(key); }
  invalidateCachePattern(pattern) { this.cache.deletePattern(pattern); }

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
    for (const unsub of this.subscriptions.values()) try { unsub(); } catch (e) {}
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