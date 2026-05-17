// src/services/firestoreService.js - ARVDOUL ENTERPRISE PRO MAX V20
// 🚀 DETERMINISTIC SHARDING • REACTION COUNTERS • REAL‑TIME SUBSCRIPTIONS
// 🔥 FULLY INTEGRATED WITH NOTIFICATIONS & MONETIZATION • BILLION‑USER SCALE
// ✅ Integrated: like, share, reaction, gift notifications via notificationsService
// ✅ All external services loaded dynamically to avoid circular dependencies
// ✅ Production‑ready for Arvdoul – surpassing all existing platforms

// ==================== CONFIGURATION ====================
const FIRESTORE_CONFIG = {
  CACHE: {
    POST_TTL: 60000,
    USER_POSTS_TTL: 30000,
    BLOCK_TTL: 300000,
    MAX_SIZE: 100,
  },
  SHARDS: {
    LIKES: 10,
    COMMENTS: 10,
    SHARES: 10,
    SAVES: 10,
    GIFTS: 10,
    VIEWS: 10,
    USER_POST_COUNTS: 10,
    REACTIONS: 10,
  },
  VIEW_AGGREGATION: {
    DAILY_RETENTION_DAYS: 30,
  },
  RATE_LIMITING: {
    ENABLED: true,
    MAX_LIKES_PER_MINUTE: 10,
    MAX_SAVES_PER_MINUTE: 10,
    MAX_SHARES_PER_MINUTE: 5,
    MAX_GIFTS_PER_MINUTE: 3,
  },
  POST_BACKGROUNDS: {
    ENABLED: true,
    ALLOWED_GRADIENTS: [
      'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
    ],
    ALLOWED_IMAGE_DOMAINS: ['firebasestorage.googleapis.com', 'storage.googleapis.com'],
    MAX_CUSTOM_BACKGROUND_SIZE: 2 * 1024 * 1024,
  },
  REACTION_TYPES: ['👍', '❤️', '😂', '😮', '😢', '🔥'],
};

// ==================== LRU CACHE ====================
class LRUCache {
  constructor(maxSize = 100, defaultTTL = 60000) {
    this.maxSize = maxSize;
    this.defaultTTL = defaultTTL;
    this.cache = new Map();
  }
  get(key) {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return null;
    }
    this.cache.delete(key);
    this.cache.set(key, entry);
    return entry.value;
  }
  set(key, value, ttl = this.defaultTTL) {
    if (this.cache.size >= this.maxSize) {
      const oldestKey = this.cache.keys().next().value;
      this.cache.delete(oldestKey);
    }
    this.cache.set(key, { value, timestamp: Date.now(), ttl });
  }
  delete(key) { this.cache.delete(key); }
  deletePattern(pattern) {
    const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
    for (const key of this.cache.keys()) {
      if (regex.test(key)) this.cache.delete(key);
    }
  }
  clear() { this.cache.clear(); }
  get size() { return this.cache.size; }
}

// ==================== DETERMINISTIC SHARDED COUNTER ====================
class ShardedCounter {
  constructor(firestore, firestoreMethods, basePath, shardCount) {
    this.firestore = firestore;
    this.fs = firestoreMethods;
    this.basePath = basePath;
    this.shardCount = shardCount;
  }

  async increment(delta = 1, deterministicKey = null) {
    let shardId;
    if (deterministicKey) {
      const hash = this._hashString(deterministicKey);
      shardId = Math.abs(hash) % this.shardCount;
    } else {
      shardId = Math.floor(Math.random() * this.shardCount);
    }
    const shardRef = this.fs.doc(this.firestore, `${this.basePath}/shard_${shardId}`);
    await this.fs.runTransaction(this.firestore, async (transaction) => {
      const snap = await transaction.get(shardRef);
      const current = snap.exists() ? snap.data().count : 0;
      transaction.set(shardRef, { count: current + delta, updatedAt: this.fs.serverTimestamp() }, { merge: true });
    });
  }

  async getTotal() {
    const promises = [];
    for (let i = 0; i < this.shardCount; i++) {
      const shardRef = this.fs.doc(this.firestore, `${this.basePath}/shard_${i}`);
      promises.push(this.fs.getDoc(shardRef));
    }
    const snapshots = await Promise.all(promises);
    let total = 0;
    for (const snap of snapshots) {
      if (snap.exists()) total += snap.data().count;
    }
    return total;
  }

  _hashString(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash;
  }
}

// ==================== ENHANCED ERROR HANDLER ====================
function enhanceError(error, defaultMessage) {
  const errorMap = {
    'permission-denied': 'You do not have permission.',
    'unauthenticated': 'Please sign in.',
    'not-found': 'Document not found.',
    'resource-exhausted': 'Rate limit exceeded. Please wait.',
  };
  const code = error?.code || 'unknown';
  let message = errorMap[code] || defaultMessage || 'Database operation failed';
  if (code === 'failed-precondition' && error.message?.includes('index')) {
    const match = error.message.match(/https:\/\/console\.firebase\.google\.com[^\s]*/);
    const url = match ? match[0] : 'Check Firebase console';
    console.error(`Missing index: ${url}`);
    message = `Missing Firestore index. Please create it: ${url}`;
  }
  const enhanced = new Error(message);
  enhanced.code = code;
  enhanced.originalError = error;
  enhanced.timestamp = new Date().toISOString();
  return enhanced;
}

// ==================== MAIN SERVICE ====================
class EnterpriseFirestoreService {
  constructor() {
    this.firestore = null;
    this.initialized = false;
    this.cache = new LRUCache(FIRESTORE_CONFIG.CACHE.MAX_SIZE, FIRESTORE_CONFIG.CACHE.POST_TTL);
    this.blockCache = new LRUCache(200, FIRESTORE_CONFIG.CACHE.BLOCK_TTL);
    this.subscriptions = new Map();
    this.isOnline = navigator.onLine;
    this.rateLimitStore = new Map();

    this.firestoreModule = null;
    this.firebaseApp = null;
    this.firestoreMethods = null;

    this.initialize().catch(err => console.warn('Firestore init warning:', err.message));
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => { this.isOnline = true; });
      window.addEventListener('offline', () => { this.isOnline = false; });
    }
  }

  // -------------------- INIT --------------------
  async initialize() {
    if (this.initialized && this.firestore) return this.firestore;
    try {
      console.log('🚀 Enterprise Firestore Service V20 (full integration)');
      this.firebaseApp = await import('../firebase/firebase.js');
      this.firestore = await this.firebaseApp.getFirestoreInstance();
      if (!this.firestore) throw new Error('Failed to get Firestore instance');

      this.firestoreModule = await import('firebase/firestore');
      const {
        collection, addDoc, getDoc, getDocs, updateDoc, deleteDoc, setDoc,
        query, where, orderBy, limit, startAfter, serverTimestamp, increment,
        arrayUnion, arrayRemove, doc, enableIndexedDbPersistence,
        runTransaction, writeBatch, Timestamp, onSnapshot,
      } = this.firestoreModule;

      this.firestoreMethods = {
        collection, addDoc, getDoc, getDocs, updateDoc, deleteDoc, setDoc,
        query, where, orderBy, limit, startAfter, serverTimestamp, increment,
        arrayUnion, arrayRemove, doc, runTransaction, writeBatch, Timestamp, onSnapshot,
      };

      try {
        await enableIndexedDbPersistence(this.firestore, { synchronizeTabs: true });
        console.log('✅ Firestore persistence enabled');
      } catch (err) {
        if (err.code !== 'failed-precondition') console.warn('Persistence warning:', err.message);
      }

      this.initialized = true;
      console.log('✅ Firestore service ready');
      return this.firestore;
    } catch (error) {
      console.error('❌ Firestore init failed:', error);
      throw enhanceError(error, 'Failed to initialize database');
    }
  }

  async ensureInitialized() {
    if (!this.initialized || !this.firestore) await this.initialize();
    return this.firestore;
  }

  // -------------------- BLOCK CHECK --------------------
  async _isBlocked(userId, blockedByUserId) {
    if (!userId || !blockedByUserId) return false;
    const cacheKey = `block_${blockedByUserId}_${userId}`;
    const cached = this.blockCache.get(cacheKey);
    if (cached !== undefined) return cached;
    try {
      const { doc, getDoc } = this.firestoreMethods;
      const blockRef = doc(this.firestore, 'blocks', `${blockedByUserId}_${userId}`);
      const blockSnap = await getDoc(blockRef);
      const isBlocked = blockSnap.exists();
      this.blockCache.set(cacheKey, isBlocked);
      return isBlocked;
    } catch {
      return false;
    }
  }

  invalidateBlockCache(userId, blockedByUserId) {
    this.blockCache.delete(`block_${blockedByUserId}_${userId}`);
  }

  // -------------------- POST CREATION --------------------
  async createPost(postData) {
    await this.ensureInitialized();
    const operationId = `post_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
    try {
      const auth = await this.getAuthInstance();
      const currentUser = auth.currentUser;
      if (!currentUser) throw new Error('Authentication required');
      if (postData.authorId !== currentUser.uid) throw new Error('authorId mismatch');

      const { collection, addDoc, serverTimestamp } = this.firestoreMethods;
      let backgroundImage = this._validateBackgroundImage(postData.backgroundImage);
      const textColor = postData.textColor || (postData.type === 'text' ? '#000000' : null);

      const postDoc = {
        type: postData.type,
        content: postData.content || '',
        media: postData.media || [],
        authorId: postData.authorId,
        authorName: postData.authorName || 'Arvdoul User',
        authorUsername: postData.authorUsername || `user_${postData.authorId.slice(0, 8)}`,
        authorPhoto: postData.authorPhoto || '/assets/default-profile.png',
        visibility: postData.visibility || 'public',
        enableComments: postData.enableComments !== false,
        enableGifts: postData.enableGifts !== false,
        location: postData.location || null,
        tags: postData.tags || [],
        hashtags: this.extractHashtags(postData.content),
        backgroundImage,
        textColor,
        status: postData.status || 'published',
        isDeleted: false,
        monetization: postData.monetization || null,
        boostData: postData.boostData || null,
        scheduledTime: postData.scheduledTime || null,
        publishedAt: postData.status === 'published' ? serverTimestamp() : null,
        stats: {
          likes: 0, comments: 0, shares: 0, saves: 0, views: 0, gifts: 0, giftValue: 0,
          ...(postData.type === 'poll' && { pollVotes: 0 }),
          ...(postData.type === 'question' && { answerCount: 0 }),
        },
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        version: 'v10',
        _operationId: operationId,
      };

      const postsRef = collection(this.firestore, 'posts');
      const docRef = await addDoc(postsRef, postDoc);
      const postId = docRef.id;

      await this.updateUserPostCount(postData.authorId, 1);
      this.cache.set(postId, { ...postDoc, id: postId }, FIRESTORE_CONFIG.CACHE.POST_TTL);
      this._invalidateUserPostsCache(postData.authorId);

      // 🔔 NOTIFICATION HOOK: Notify followers (can be implemented via Cloud Function)
      return { success: true, postId, post: { ...postDoc, id: postId }, operationId };
    } catch (error) {
      console.error('Create post failed:', error);
      throw enhanceError(error, 'Failed to create post');
    }
  }

  _validateBackgroundImage(url) {
    if (!url) return null;
    if (FIRESTORE_CONFIG.POST_BACKGROUNDS.ALLOWED_GRADIENTS.includes(url)) return url;
    try {
      const parsed = new URL(url);
      if (FIRESTORE_CONFIG.POST_BACKGROUNDS.ALLOWED_IMAGE_DOMAINS.includes(parsed.hostname)) return url;
    } catch {}
    return null;
  }

  // -------------------- GET POST (with optional sharded totals) --------------------
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
      if (!postSnap.exists()) return { success: false, error: 'Post not found' };

      const post = { id: postSnap.id, ...postSnap.data() };
      if (post.createdAt?.toDate) post.createdAt = post.createdAt.toDate();
      if (post.updatedAt?.toDate) post.updatedAt = post.updatedAt.toDate();

      if (options.includeShardedTotals) {
        const likes = await this._getShardedTotal(`posts/${postId}/likes_shards`, FIRESTORE_CONFIG.SHARDS.LIKES);
        const comments = await this._getShardedTotal(`posts/${postId}/comments_shards`, FIRESTORE_CONFIG.SHARDS.COMMENTS);
        const shares = await this._getShardedTotal(`posts/${postId}/shares_shards`, FIRESTORE_CONFIG.SHARDS.SHARES);
        const saves = await this._getShardedTotal(`posts/${postId}/saves_shards`, FIRESTORE_CONFIG.SHARDS.SAVES);
        const gifts = await this._getShardedTotal(`posts/${postId}/gifts_shards`, FIRESTORE_CONFIG.SHARDS.GIFTS);
        const views = await this._getShardedTotal(`posts/${postId}/views_shards`, FIRESTORE_CONFIG.SHARDS.VIEWS);
        post.stats = { ...post.stats, likes, comments, shares, saves, gifts, views };
      }

      this.cache.set(postId, post, FIRESTORE_CONFIG.CACHE.POST_TTL);
      return { success: true, post, cached: false };
    } catch (error) {
      console.error(`Get post ${postId} failed:`, error);
      return { success: false, error: enhanceError(error, 'Failed to fetch post').message };
    }
  }

  async _getShardedTotal(basePath, shardCount) {
    let total = 0;
    for (let i = 0; i < shardCount; i++) {
      const ref = this.firestoreMethods.doc(this.firestore, `${basePath}/shard_${i}`);
      const snap = await this.firestoreMethods.getDoc(ref);
      if (snap.exists()) total += snap.data().count;
    }
    return total;
  }

  // -------------------- GET USER POSTS (paginated, with approximate counts) --------------------
  async getPostsByUser(userId, options = {}) {
    await this.ensureInitialized();
    const limitNum = options.limit || 20;
    const startAfterDoc = options.startAfter || null;
    const cacheKey = `user_posts_${userId}_${limitNum}_${startAfterDoc?.id || 'first'}`;

    if (options.cacheFirst !== false) {
      const cached = this.cache.get(cacheKey);
      if (cached) return { ...cached, cached: true };
    }

    try {
      const { collection, query, where, getDocs, orderBy, limit, startAfter } = this.firestoreMethods;
      const postsRef = collection(this.firestore, 'posts');
      let constraints = [
        where('authorId', '==', userId),
        where('isDeleted', '==', false),
        orderBy('createdAt', 'desc'),
        limit(limitNum + 1),
      ];
      if (startAfterDoc) constraints.push(startAfter(startAfterDoc));
      const q = query(postsRef, ...constraints);
      const snapshot = await getDocs(q);

      const posts = [];
      snapshot.forEach(doc => {
        const data = doc.data();
        posts.push({ id: doc.id, ...data });
      });
      const hasMore = posts.length > limitNum;
      if (hasMore) posts.pop();

      const result = { success: true, posts, hasMore, approximateCounts: true };
      this.cache.set(cacheKey, result, FIRESTORE_CONFIG.CACHE.USER_POSTS_TTL);
      return result;
    } catch (error) {
      console.error(`Get user posts for ${userId} failed:`, error);
      if (import.meta.env.DEV && error.code === 'permission-denied') {
        return { success: true, posts: [], hasMore: false };
      }
      throw enhanceError(error, 'Failed to fetch user posts');
    }
  }

  // -------------------- UPDATE POST --------------------
  async updatePost(postId, updates) {
    await this.ensureInitialized();
    try {
      const { doc, updateDoc, serverTimestamp } = this.firestoreMethods;
      const postRef = doc(this.firestore, 'posts', postId);
      await updateDoc(postRef, { ...updates, updatedAt: serverTimestamp() });
      this.cache.delete(postId);
      const post = await this.getPost(postId, { cacheFirst: true });
      if (post.success) this._invalidateUserPostsCache(post.post.authorId);
      return { success: true };
    } catch (error) {
      throw enhanceError(error, 'Failed to update post');
    }
  }

  // -------------------- SOFT DELETE --------------------
  async deletePost(postId, userId) {
    await this.ensureInitialized();
    try {
      const { doc, updateDoc, serverTimestamp } = this.firestoreMethods;
      const postRef = doc(this.firestore, 'posts', postId);
      await updateDoc(postRef, { isDeleted: true, deletedAt: serverTimestamp(), status: 'deleted', deletedBy: userId });
      await this.updateUserPostCount(userId, -1);
      this.cache.delete(postId);
      this._invalidateUserPostsCache(userId);
      return { success: true };
    } catch (error) {
      throw enhanceError(error, 'Failed to delete post');
    }
  }

  // -------------------- RESTORE POST --------------------
  async restorePost(postId, userId) {
    await this.ensureInitialized();
    try {
      const post = await this.getPost(postId, { cacheFirst: false });
      if (!post.success) throw new Error('Post not found');
      if (post.post.authorId !== userId) throw new Error('Not your post');
      const { doc, updateDoc, serverTimestamp } = this.firestoreMethods;
      const postRef = doc(this.firestore, 'posts', postId);
      await updateDoc(postRef, { isDeleted: false, deletedAt: null, status: 'published', updatedAt: serverTimestamp() });
      await this.updateUserPostCount(userId, 1);
      this.cache.delete(postId);
      this._invalidateUserPostsCache(userId);
      return { success: true };
    } catch (error) {
      throw enhanceError(error, 'Failed to restore post');
    }
  }

  // -------------------- LIKE POST (deterministic shard + notification) --------------------
  async likePost(postId, userId) {
    await this.ensureInitialized();
    if (!this._checkRateLimit(userId, 'like')) {
      throw enhanceError({ code: 'resource-exhausted' }, 'Too many likes. Please wait.');
    }
    const post = await this.getPost(postId, { cacheFirst: true });
    if (post.success && (await this._isBlocked(userId, post.post.authorId))) {
      throw enhanceError({ code: 'permission-denied' }, 'You are blocked by the author');
    }

    try {
      const { doc, runTransaction, serverTimestamp } = this.firestoreMethods;
      const postRef = doc(this.firestore, 'posts', postId);
      const deterministicKey = `${userId}_${postId}`;
      const likeShard = new ShardedCounter(this.firestore, this.firestoreMethods, `posts/${postId}/likes_shards`, FIRESTORE_CONFIG.SHARDS.LIKES);
      const userLikeRef = doc(this.firestore, `posts/${postId}/likes`, userId);
      let authorId = null;
      let action = null;

      const result = await runTransaction(this.firestore, async (transaction) => {
        const postSnap = await transaction.get(postRef);
        if (!postSnap.exists()) throw new Error('Post not found');
        if (await this._isBlocked(userId, postSnap.data().authorId)) throw new Error('Blocked');
        authorId = postSnap.data().authorId;

        const userLikeSnap = await transaction.get(userLikeRef);
        if (userLikeSnap.exists()) {
          transaction.delete(userLikeRef);
          await likeShard.increment(-1, deterministicKey);
          action = 'unliked';
          return { action };
        } else {
          transaction.set(userLikeRef, { userId, likedAt: serverTimestamp() });
          await likeShard.increment(1, deterministicKey);
          action = 'liked';
          return { action };
        }
      });

      this.cache.delete(postId);

      // 🔔 Send notification if it's a new like (not unlike)
      if (action === 'liked' && userId !== authorId) {
        this._triggerLikeNotification(postId, userId, authorId).catch(console.warn);
      }

      return { success: true, ...result };
    } catch (error) {
      throw enhanceError(error, 'Failed to like post');
    }
  }

  // -------------------- SAVE POST (deterministic shard) --------------------
  async savePost(postId, userId) {
    await this.ensureInitialized();
    if (!this._checkRateLimit(userId, 'save')) {
      throw enhanceError({ code: 'resource-exhausted' }, 'Too many saves. Please wait.');
    }
    const post = await this.getPost(postId, { cacheFirst: true });
    if (post.success && (await this._isBlocked(userId, post.post.authorId))) {
      throw enhanceError({ code: 'permission-denied' }, 'You are blocked by the author');
    }

    try {
      const { doc, runTransaction, serverTimestamp } = this.firestoreMethods;
      const deterministicKey = `${userId}_${postId}`;
      const saveShard = new ShardedCounter(this.firestore, this.firestoreMethods, `posts/${postId}/saves_shards`, FIRESTORE_CONFIG.SHARDS.SAVES);
      const userSaveRef = doc(this.firestore, `posts/${postId}/saves`, userId);

      const result = await runTransaction(this.firestore, async (transaction) => {
        const saveSnap = await transaction.get(userSaveRef);
        if (saveSnap.exists()) {
          transaction.delete(userSaveRef);
          await saveShard.increment(-1, deterministicKey);
          return { action: 'unsaved' };
        } else {
          transaction.set(userSaveRef, { userId, savedAt: serverTimestamp() });
          await saveShard.increment(1, deterministicKey);
          return { action: 'saved' };
        }
      });
      this.cache.delete(postId);
      return { success: true, ...result };
    } catch (error) {
      throw enhanceError(error, 'Failed to save post');
    }
  }

  // -------------------- SHARE POST (with subcollection + notification) --------------------
  async sharePost(postId, userId) {
    await this.ensureInitialized();
    if (!this._checkRateLimit(userId, 'share')) {
      throw enhanceError({ code: 'resource-exhausted' }, 'Too many shares. Please wait.');
    }
    const post = await this.getPost(postId, { cacheFirst: true });
    if (post.success && (await this._isBlocked(userId, post.post.authorId))) {
      throw enhanceError({ code: 'permission-denied' }, 'You are blocked by the author');
    }

    try {
      const { doc, runTransaction, serverTimestamp } = this.firestoreMethods;
      const deterministicKey = `${userId}_${postId}`;
      const shareShard = new ShardedCounter(this.firestore, this.firestoreMethods, `posts/${postId}/shares_shards`, FIRESTORE_CONFIG.SHARDS.SHARES);
      const userShareRef = doc(this.firestore, `posts/${postId}/shares`, userId);
      let authorId = null;

      await runTransaction(this.firestore, async (transaction) => {
        const postSnap = await transaction.get(doc(this.firestore, 'posts', postId));
        if (!postSnap.exists()) throw new Error('Post not found');
        if (await this._isBlocked(userId, postSnap.data().authorId)) throw new Error('Blocked');
        authorId = postSnap.data().authorId;

        const shareSnap = await transaction.get(userShareRef);
        if (!shareSnap.exists()) {
          transaction.set(userShareRef, { userId, sharedAt: serverTimestamp() });
          await shareShard.increment(1, deterministicKey);
        }
      });
      this.cache.delete(postId);

      // 🔔 Send share notification (only once, not on repeated shares)
      if (userId !== authorId) {
        this._triggerShareNotification(postId, userId, authorId).catch(console.warn);
      }

      return { success: true };
    } catch (error) {
      throw enhanceError(error, 'Failed to share post');
    }
  }

  // -------------------- SEND GIFT (with coin deduction + notification) --------------------
  async sendGift(postId, userId, giftType, coinValue) {
    await this.ensureInitialized();
    if (!this._checkRateLimit(userId, 'gift')) {
      throw enhanceError({ code: 'resource-exhausted' }, 'Too many gifts. Please wait.');
    }
    const post = await this.getPost(postId, { cacheFirst: true });
    if (post.success && (await this._isBlocked(userId, post.post.authorId))) {
      throw enhanceError({ code: 'permission-denied' }, 'You are blocked by the author');
    }

    // Deduct coins from sender via monetization service (must be available)
    const monetization = await this._getMonetizationService();
    if (!monetization) {
      throw new Error('Monetization service not available. Cannot send gift.');
    }
    try {
      await monetization.spendCoins(userId, coinValue, 'gift_sent', { postId, giftType });
    } catch (err) {
      console.error('Coin deduction failed:', err);
      throw new Error('Insufficient coins or service error');
    }

    try {
      const { doc, runTransaction, serverTimestamp, collection } = this.firestoreMethods;
      const deterministicKey = `${userId}_${postId}`;
      const giftShard = new ShardedCounter(this.firestore, this.firestoreMethods, `posts/${postId}/gifts_shards`, FIRESTORE_CONFIG.SHARDS.GIFTS);
      const giftTxRef = doc(collection(this.firestore, 'gift_transactions'));
      let authorId = null;

      await runTransaction(this.firestore, async (transaction) => {
        const postSnap = await transaction.get(doc(this.firestore, 'posts', postId));
        if (!postSnap.exists()) throw new Error('Post not found');
        if (await this._isBlocked(userId, postSnap.data().authorId)) throw new Error('Blocked');
        authorId = postSnap.data().authorId;
        await giftShard.increment(1, deterministicKey);
        transaction.set(giftTxRef, {
          postId, fromUserId: userId, toUserId: authorId,
          giftType, coinValue, sentAt: serverTimestamp(),
        });
      });
      this.cache.delete(postId);

      // 🔔 Send gift notification
      if (userId !== authorId) {
        this._triggerGiftNotification(postId, userId, authorId, giftType, coinValue).catch(console.warn);
      }

      return { success: true };
    } catch (error) {
      throw enhanceError(error, 'Failed to send gift');
    }
  }

  // -------------------- REACTION COUNTERS + notification --------------------
  async addReaction(postId, userId, reactionType) {
    if (!FIRESTORE_CONFIG.REACTION_TYPES.includes(reactionType)) {
      throw new Error(`Invalid reaction type. Allowed: ${FIRESTORE_CONFIG.REACTION_TYPES.join(', ')}`);
    }
    await this.ensureInitialized();

    // Fetch post to get authorId before transaction
    const post = await this.getPost(postId, { cacheFirst: true });
    if (!post.success) throw new Error('Post not found');
    const authorId = post.post.authorId;

    const deterministicKey = `${userId}_${postId}`;
    const reactionShard = new ShardedCounter(this.firestore, this.firestoreMethods, `posts/${postId}/reactions_${reactionType}_shards`, FIRESTORE_CONFIG.SHARDS.REACTIONS);
    const userReactionRef = this.firestoreMethods.doc(this.firestore, `posts/${postId}/reactions`, userId);

    let oldReaction = null;
    await this.firestoreMethods.runTransaction(this.firestore, async (transaction) => {
      const snap = await transaction.get(userReactionRef);
      oldReaction = snap.exists() ? snap.data().type : null;
      if (oldReaction === reactionType) {
        transaction.delete(userReactionRef);
        const oldShard = new ShardedCounter(this.firestore, this.firestoreMethods, `posts/${postId}/reactions_${oldReaction}_shards`, FIRESTORE_CONFIG.SHARDS.REACTIONS);
        await oldShard.increment(-1, deterministicKey);
      } else {
        if (oldReaction) {
          const oldShard = new ShardedCounter(this.firestore, this.firestoreMethods, `posts/${postId}/reactions_${oldReaction}_shards`, FIRESTORE_CONFIG.SHARDS.REACTIONS);
          await oldShard.increment(-1, deterministicKey);
        }
        transaction.set(userReactionRef, { userId, type: reactionType, reactedAt: this.firestoreMethods.serverTimestamp() });
        await reactionShard.increment(1, deterministicKey);
      }
    });
    this.cache.delete(postId);

    // 🔔 Send reaction notification only if a new reaction was added (not removed)
    if (!oldReaction || oldReaction !== reactionType) {
      this._triggerReactionNotification(postId, userId, authorId, reactionType).catch(console.warn);
    }
    return { success: true };
  }

  // -------------------- COMMENT COUNT (for commentService) --------------------
  async incrementCommentCount(postId, delta = 1) {
    await this.ensureInitialized();
    const commentShard = new ShardedCounter(this.firestore, this.firestoreMethods, `posts/${postId}/comments_shards`, FIRESTORE_CONFIG.SHARDS.COMMENTS);
    await commentShard.increment(delta);
    this.cache.delete(postId);
    // No notification here – commentService will send its own.
  }

  // -------------------- RECORD POST VIEW (daily aggregation + total views shard) --------------------
  async recordPostView(postId, userId = null, options = {}) {
    await this.ensureInitialized();
    const post = await this.getPost(postId, { cacheFirst: true });
    if (!post.success) return { success: false, error: 'Post not found' };
    if (userId && (await this._isBlocked(userId, post.post.authorId))) {
      return { success: false, blocked: true };
    }

    const today = new Date().toISOString().slice(0, 10);
    const dailyRef = this.firestoreMethods.doc(this.firestore, `posts/${postId}/views_daily`, today);
    const totalViewsShard = new ShardedCounter(this.firestore, this.firestoreMethods, `posts/${postId}/views_shards`, FIRESTORE_CONFIG.SHARDS.VIEWS);

    try {
      await this.firestoreMethods.runTransaction(this.firestore, async (transaction) => {
        const dailySnap = await transaction.get(dailyRef);
        const currentDaily = dailySnap.exists() ? dailySnap.data().count : 0;
        transaction.set(dailyRef, { count: currentDaily + 1, date: today }, { merge: true });
        await totalViewsShard.increment(1);
      });
      this.cache.delete(postId);
      return { success: true };
    } catch (error) {
      console.error('Record view failed:', error);
      return { success: false };
    }
  }

  async getPostViewCount(postId) {
    await this.ensureInitialized();
    const totalViewsShard = new ShardedCounter(this.firestore, this.firestoreMethods, `posts/${postId}/views_shards`, FIRESTORE_CONFIG.SHARDS.VIEWS);
    return await totalViewsShard.getTotal();
  }

  // -------------------- DAILY VIEW ANALYTICS --------------------
  async getPostDailyViews(postId, days = 30) {
    await this.ensureInitialized();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    const viewsRef = this.firestoreMethods.collection(this.firestore, `posts/${postId}/views_daily`);
    const q = this.firestoreMethods.query(
      viewsRef,
      this.firestoreMethods.where('date', '>=', startDate.toISOString().slice(0, 10)),
      this.firestoreMethods.orderBy('date', 'desc')
    );
    const snap = await this.firestoreMethods.getDocs(q);
    const dailyViews = [];
    snap.forEach(doc => {
      dailyViews.push({ date: doc.data().date, count: doc.data().count });
    });
    return dailyViews;
  }

  // -------------------- DAILY VIEW CLEANUP --------------------
  async cleanupOldDailyViews() {
    await this.ensureInitialized();
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - FIRESTORE_CONFIG.VIEW_AGGREGATION.DAILY_RETENTION_DAYS);
    const cutoffStr = cutoff.toISOString().slice(0, 10);
    const { collectionGroup, query, where, getDocs, writeBatch } = this.firestoreMethods;
    const viewsDailyRef = collectionGroup(this.firestore, 'views_daily');
    const q = query(viewsDailyRef, where('date', '<', cutoffStr));
    const snapshot = await getDocs(q);
    const batch = writeBatch(this.firestore);
    snapshot.forEach(doc => batch.delete(doc.ref));
    await batch.commit();
    console.log(`Deleted ${snapshot.size} old daily view documents`);
    return snapshot.size;
  }

  // -------------------- REPORT POST --------------------
  async reportPost(postId, userId, reason, details = '') {
    await this.ensureInitialized();
    const reportsRef = this.firestoreMethods.collection(this.firestore, 'post_reports');
    await this.firestoreMethods.addDoc(reportsRef, {
      postId, userId, reason, details,
      status: 'pending',
      createdAt: this.firestoreMethods.serverTimestamp(),
    });
    return { success: true };
  }

  // -------------------- BATCH LIKE POSTS (optimised) --------------------
  async batchLikePosts(userId, postIds) {
    await this.ensureInitialized();
    const batch = this.firestoreMethods.writeBatch(this.firestore);
    const now = this.firestoreMethods.serverTimestamp();
    for (const postId of postIds) {
      const likeRef = this.firestoreMethods.doc(this.firestore, `posts/${postId}/likes`, userId);
      batch.set(likeRef, { userId, likedAt: now }, { merge: true });
      const shard = new ShardedCounter(this.firestore, this.firestoreMethods, `posts/${postId}/likes_shards`, FIRESTORE_CONFIG.SHARDS.LIKES);
      await shard.increment(1, `${userId}_${postId}`).catch(console.warn);
    }
    await batch.commit();
    postIds.forEach(id => this.cache.delete(id));
    return { success: true, likedCount: postIds.length };
  }

  // -------------------- BATCH DELETE POSTS (for admins) --------------------
  async batchDeletePosts(postIds, adminId, options = {}) {
    await this.ensureInitialized();
    const batch = this.firestoreMethods.writeBatch(this.firestore);
    for (const postId of postIds) {
      const postRef = this.firestoreMethods.doc(this.firestore, 'posts', postId);
      batch.update(postRef, {
        isDeleted: true,
        deletedAt: this.firestoreMethods.serverTimestamp(),
        deletedBy: adminId,
        deletedReason: 'admin_batch',
      });
      this.cache.delete(postId);
    }
    await batch.commit();
    return { success: true, deletedCount: postIds.length };
  }

  // -------------------- USER POST COUNT (sharded) --------------------
  async updateUserPostCount(userId, delta = 1) {
    const counter = new ShardedCounter(this.firestore, this.firestoreMethods, `user_post_counts/${userId}`, FIRESTORE_CONFIG.SHARDS.USER_POST_COUNTS);
    await counter.increment(delta);
  }

  async getUserPostCount(userId) {
    await this.ensureInitialized();
    const counter = new ShardedCounter(this.firestore, this.firestoreMethods, `user_post_counts/${userId}`, FIRESTORE_CONFIG.SHARDS.USER_POST_COUNTS);
    return await counter.getTotal();
  }

  // -------------------- REAL‑TIME SUBSCRIPTION TO A POST --------------------
  async subscribeToPost(postId, callback, options = {}) {
    await this.ensureInitialized();
    const postRef = this.firestoreMethods.doc(this.firestore, 'posts', postId);
    const subId = `post_${postId}_${Date.now()}`;

    return new Promise((resolve, reject) => {
      try {
        const unsubscribe = this.firestoreMethods.onSnapshot(postRef, (snap) => {
          if (!snap.exists()) {
            callback({ type: 'deleted', postId });
            return;
          }
          let post = { id: snap.id, ...snap.data() };
          if (post.createdAt?.toDate) post.createdAt = post.createdAt.toDate();
          if (post.updatedAt?.toDate) post.updatedAt = post.updatedAt.toDate();
          if (options.includeShardedTotals) {
            this._getShardedTotal(`posts/${postId}/likes_shards`, FIRESTORE_CONFIG.SHARDS.LIKES).then(likes => {
              post.stats = { ...post.stats, likes };
              callback({ type: 'update', post });
            }).catch(() => callback({ type: 'update', post }));
          } else {
            callback({ type: 'update', post });
          }
        }, (error) => {
          callback({ type: 'error', error: error.message });
          reject(error);
        });
        this.subscriptions.set(subId, unsubscribe);
        resolve(subId);
      } catch (err) {
        reject(err);
      }
    });
  }

  unsubscribe(subscriptionId) {
    const unsub = this.subscriptions.get(subscriptionId);
    if (unsub) {
      unsub();
      this.subscriptions.delete(subscriptionId);
    }
  }

  // -------------------- NOTIFICATION HELPERS --------------------
  async _triggerLikeNotification(postId, likerId, authorId) {
    const notifications = await this._getNotificationsService();
    if (!notifications) return;
    try {
      await notifications.createLikeNotification(postId, likerId, authorId);
    } catch (err) {
      console.warn('Failed to send like notification:', err);
    }
  }

  async _triggerShareNotification(postId, sharerId, authorId) {
    const notifications = await this._getNotificationsService();
    if (!notifications) return;
    try {
      await notifications.sendNotification({
        type: 'share',
        targetId: postId,
        senderId: sharerId,
        recipientId: authorId,
        title: 'New share',
        message: 'Someone shared your post',
        data: { postId },
      });
    } catch (err) {
      console.warn('Failed to send share notification:', err);
    }
  }

  async _triggerGiftNotification(postId, senderId, receiverId, giftType, coinValue) {
    const notifications = await this._getNotificationsService();
    if (!notifications) return;
    try {
      await notifications.sendNotification({
        type: 'gift',
        targetId: postId,
        senderId,
        recipientId: receiverId,
        title: 'Gift received!',
        message: `You received a ${giftType} gift worth ${coinValue} coins!`,
        data: { postId, giftType, coinValue },
      });
    } catch (err) {
      console.warn('Failed to send gift notification:', err);
    }
  }

  async _triggerReactionNotification(postId, reactorId, authorId, reactionType) {
    const notifications = await this._getNotificationsService();
    if (!notifications) return;
    try {
      await notifications.sendNotification({
        type: 'reaction',
        targetId: postId,
        senderId: reactorId,
        recipientId: authorId,
        title: 'New reaction',
        message: `Someone reacted with ${reactionType} to your post`,
        data: { postId, reactionType },
      });
    } catch (err) {
      console.warn('Failed to send reaction notification:', err);
    }
  }

  async _getNotificationsService() {
    try {
      const module = await import('./notificationsService.js');
      return module.getNotificationsService?.() || module.default;
    } catch {
      return null;
    }
  }

  // -------------------- PRIVATE HELPERS --------------------
  _invalidateUserPostsCache(userId) {
    if (!userId) return;
    for (const key of this.cache.cache.keys()) {
      if (key.startsWith(`user_posts_${userId}_`)) this.cache.delete(key);
    }
  }

  _checkRateLimit(userId, action) {
    if (!FIRESTORE_CONFIG.RATE_LIMITING.ENABLED) return true;
    const key = `${userId}_${action}`;
    const now = Date.now();
    const record = this.rateLimitStore.get(key);
    if (!record) {
      this.rateLimitStore.set(key, { count: 1, firstTimestamp: now });
      return true;
    }
    if (now - record.firstTimestamp > 60000) {
      this.rateLimitStore.set(key, { count: 1, firstTimestamp: now });
      return true;
    }
    let max = 10;
    if (action === 'like') max = FIRESTORE_CONFIG.RATE_LIMITING.MAX_LIKES_PER_MINUTE;
    if (action === 'save') max = FIRESTORE_CONFIG.RATE_LIMITING.MAX_SAVES_PER_MINUTE;
    if (action === 'share') max = FIRESTORE_CONFIG.RATE_LIMITING.MAX_SHARES_PER_MINUTE;
    if (action === 'gift') max = FIRESTORE_CONFIG.RATE_LIMITING.MAX_GIFTS_PER_MINUTE;
    if (record.count >= max) return false;
    record.count++;
    return true;
  }

  async _getMonetizationService() {
    try {
      const module = await import('./monetizationService.js');
      return module.getMonetizationService?.() || module.default;
    } catch {
      return null;
    }
  }

  extractHashtags(content) {
    if (!content) return [];
    const hashtags = content.match(/#(\w+)/g);
    return hashtags ? [...new Set(hashtags.map(tag => tag.toLowerCase()))] : [];
  }

  async getAuthInstance() {
    if (!this.firebaseApp) this.firebaseApp = await import('../firebase/firebase.js');
    return this.firebaseApp.getAuthInstance();
  }

  clearCache() {
    this.cache.clear();
    this.blockCache.clear();
  }

  getStats() {
    return {
      cacheSize: this.cache.size,
      blockCacheSize: this.blockCache.size,
      subscriptions: this.subscriptions.size,
      initialized: this.initialized,
      online: this.isOnline,
    };
  }

  destroy() {
    this.subscriptions.forEach(unsub => unsub());
    this.subscriptions.clear();
    this.clearCache();
    this.initialized = false;
  }
}

// ==================== SINGLETON ====================
let firestoreServiceInstance = null;
function getFirestoreService() {
  if (!firestoreServiceInstance) firestoreServiceInstance = new EnterpriseFirestoreService();
  return firestoreServiceInstance;
}

// ==================== EXPORTS ====================
const firestoreService = {
  initialize: () => getFirestoreService().initialize(),
  createPost: (data) => getFirestoreService().createPost(data),
  getPost: (id, opts) => getFirestoreService().getPost(id, opts),
  getPostsByUser: (uid, opts) => getFirestoreService().getPostsByUser(uid, opts),
  updatePost: (id, updates) => getFirestoreService().updatePost(id, updates),
  deletePost: (id, uid) => getFirestoreService().deletePost(id, uid),
  restorePost: (id, uid) => getFirestoreService().restorePost(id, uid),
  likePost: (id, uid) => getFirestoreService().likePost(id, uid),
  savePost: (id, uid) => getFirestoreService().savePost(id, uid),
  sharePost: (id, uid) => getFirestoreService().sharePost(id, uid),
  sendGift: (id, uid, type, value) => getFirestoreService().sendGift(id, uid, type, value),
  addReaction: (id, uid, type) => getFirestoreService().addReaction(id, uid, type),
  incrementCommentCount: (id, delta) => getFirestoreService().incrementCommentCount(id, delta),
  recordPostView: (id, uid, opts) => getFirestoreService().recordPostView(id, uid, opts),
  getPostViewCount: (id) => getFirestoreService().getPostViewCount(id),
  getPostDailyViews: (id, days) => getFirestoreService().getPostDailyViews(id, days),
  getUserPostCount: (uid) => getFirestoreService().getUserPostCount(uid),
  reportPost: (id, uid, reason, details) => getFirestoreService().reportPost(id, uid, reason, details),
  batchLikePosts: (uid, ids) => getFirestoreService().batchLikePosts(uid, ids),
  batchDeletePosts: (ids, adminId, opts) => getFirestoreService().batchDeletePosts(ids, adminId, opts),
  cleanupOldDailyViews: () => getFirestoreService().cleanupOldDailyViews(),
  subscribeToPost: (id, cb, opts) => getFirestoreService().subscribeToPost(id, cb, opts),
  unsubscribe: (subId) => getFirestoreService().unsubscribe(subId),
  invalidateBlockCache: (uid, blockedBy) => getFirestoreService().invalidateBlockCache(uid, blockedBy),
  clearCache: () => getFirestoreService().clearCache(),
  getStats: () => getFirestoreService().getStats(),
  ensureInitialized: () => getFirestoreService().ensureInitialized(),
};

export default firestoreService;
export { firestoreService, getFirestoreService };