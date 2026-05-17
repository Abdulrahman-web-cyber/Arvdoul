// src/services/firestoreService.js - ARVDOUL ENTERPRISE PRO MAX V14
// 🚀 REAL-TIME SYNC • ALL POST TYPES • FULL REACTIONS • VIEW TRACKING • WORLD-CLASS
// 🔥 MONETIZATION • NOTIFICATIONS • SHARDED COUNTERS • PRODUCTION READY
// ✅ ATOMIC LIKES/SAVES • CORRECT VIEW SHARDS • IDEMPOTENT REACTIONS • NO STUBS
// ✅ UNLIKE / UNSAVE / REMOVE REACTION • FIXED NOTIFICATIONS • SCALABLE DESIGN
// ✅ FIXED: getPostsByUser pagination, notification outside transaction
// ✅ ADDED: getSavedPosts, getLikedPosts, batchDeletePosts, post scheduling, visibility controls
// ✅ ADDED: post analytics (daily stats), post expiration, post visibility enum

// ==================== LRU CACHE ====================
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

// ==================== CONFIGURATION ====================
const CONFIG = {
  ALLOWED_REACTIONS: ['👍', '❤️', '😂', '😮', '😢', '👎', '🔥', '🎉'],
  VIEW_SHARDS: 10,
  STORE_VIEWERS: true,
  VIEWERS_SUBCOLLECTION: 'viewers',
  REACTIONS_SUBCOLLECTION: 'reactions',
  DAILY_STATS_SUBCOLLECTION: 'daily_stats',
  POST_VISIBILITY: {
    PUBLIC: 'public',
    FOLLOWERS: 'followers',
    ONLY_ME: 'only_me'
  },
  POST_EXPIRY_DAYS: 30, // default, can be overridden per post
};

// ==================== ENHANCED ERROR HANDLER ====================
function enhanceError(error, defaultMessage) {
  const errorMap = {
    'permission-denied': 'You do not have permission to perform this action. Please sign in again.',
    'unauthenticated': 'Authentication required. Please sign in to continue.',
    'not-found': 'The requested document was not found.',
    'already-exists': 'Document already exists.',
    'resource-exhausted': 'Database quota exceeded. Please try again later.',
    'failed-precondition': 'Operation failed due to system state. Please refresh.',
    'deadline-exceeded': 'Request timeout. Please check your connection.',
    'aborted': 'Operation was aborted.',
    'unavailable': 'Service temporarily unavailable.',
    'internal': 'Internal server error. Our team has been notified.',
    'invalid-argument': 'Invalid data provided.',
    'out-of-range': 'Value out of acceptable range.',
    'unimplemented': 'This operation is not available.',
    'data-loss': 'Data corruption detected.',
    'cancelled': 'Operation cancelled.'
  };
  const code = error?.code || 'unknown';
  let message = errorMap[code] || defaultMessage || 'Database operation failed';
  if (code === 'failed-precondition' && error.message?.includes('index')) {
    const match = error.message.match(/https:\/\/console\.firebase\.google\.com[^\s]*/);
    const url = match ? match[0] : 'Check Firebase console';
    console.error(`[FirestoreService] Missing index. Create it here: ${url}`);
    message = `Missing Firestore index. Please create it: ${url}`;
  }
  const enhanced = new Error(message);
  enhanced.code = code;
  enhanced.originalError = error;
  enhanced.timestamp = new Date().toISOString();
  return enhanced;
}

// ==================== MAIN SERVICE CLASS ====================
class EnterpriseFirestoreService {
  constructor() {
    this.firestore = null;
    this.initialized = false;
    this.cache = new LRUCache(100, 60000);
    this.subscriptions = new Map();
    this.isOnline = navigator.onLine;
    this.firestoreModule = null;
    this.firebaseApp = null;
    this.initialize().catch(err => console.warn('Firestore service init warning:', err.message));
    window.addEventListener('online', () => { this.isOnline = true; console.log('🌐 Firestore: Back online'); });
    window.addEventListener('offline', () => { this.isOnline = false; console.log('🌐 Firestore: Offline mode'); });
  }

  async initialize() {
    if (this.initialized && this.firestore) return this.firestore;
    try {
      console.log('🚀 Initializing Enterprise Firestore Service...');
      this.firebaseApp = await import('../firebase/firebase.js');
      this.firestore = await this.firebaseApp.getFirestoreInstance();
      if (!this.firestore) throw new Error('Failed to get Firestore instance');
      this.firestoreModule = await import('firebase/firestore');
      const {
        collection, addDoc, getDoc, getDocs, updateDoc, deleteDoc,
        query, where, orderBy, limit, startAfter,
        serverTimestamp, increment, arrayUnion, arrayRemove, doc,
        enableIndexedDbPersistence, onSnapshot, runTransaction, writeBatch, Timestamp
      } = this.firestoreModule;
      this.firestoreMethods = {
        collection, addDoc, getDoc, getDocs, updateDoc, deleteDoc,
        query, where, orderBy, limit, startAfter,
        serverTimestamp, increment, arrayUnion, arrayRemove, doc,
        onSnapshot, runTransaction, writeBatch, Timestamp
      };
      try {
        await enableIndexedDbPersistence(this.firestore, { synchronizeTabs: true });
        console.log('✅ Firestore persistence enabled');
      } catch (persistenceError) {
        console.warn('⚠️ Firestore persistence warning:', persistenceError.message);
      }
      this.initialized = true;
      return this.firestore;
    } catch (error) {
      console.error('❌ Firestore initialization failed:', error);
      throw enhanceError(error, 'Failed to initialize database');
    }
  }

  // ==================== POST OPERATIONS ====================
  async createPost(postData) {
    await this.ensureInitialized();
    const startTime = Date.now();
    const operationId = `post_${Date.now()}_${Math.random().toString(36).substr(2,9)}`;
    try {
      const auth = await this.getAuthInstance();
      const currentUser = auth.currentUser;
      if (!currentUser) throw new Error('User not authenticated. Please sign in to create posts.');
      if (postData.authorId !== currentUser.uid) {
        throw new Error(`authorId (${postData.authorId}) does not match authenticated user (${currentUser.uid})`);
      }
      const { collection, addDoc, serverTimestamp, increment, arrayUnion } = this.firestoreMethods;
      
      // Handle scheduled publishing
      const scheduledTime = postData.scheduledTime ? new Date(postData.scheduledTime) : null;
      const isScheduled = scheduledTime && scheduledTime > new Date();
      const status = isScheduled ? 'scheduled' : (postData.status || 'published');
      
      const postDoc = {
        type: postData.type,
        content: postData.content || '',
        media: postData.media || [],
        authorId: postData.authorId,
        authorName: postData.authorName || 'Arvdoul User',
        authorUsername: postData.authorUsername || `user_${postData.authorId?.slice(0,8)}`,
        authorPhoto: postData.authorPhoto || '/assets/default-profile.png',
        ...(postData.type === 'poll' && { poll: postData.poll }),
        ...(postData.type === 'question' && { question: postData.question, answers: postData.answers || [] }),
        ...(postData.type === 'link' && { link: postData.link }),
        ...(postData.type === 'event' && { event: postData.event }),
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
        expiresAt: postData.expiresAt ? new Date(postData.expiresAt) : null,
        stats: {
          likes: 0, comments: 0, shares: 0, saves: 0, views: 0, gifts: 0, giftValue: 0,
          reactions: Object.fromEntries(CONFIG.ALLOWED_REACTIONS.map(r => [r, 0])),
          ...(postData.type === 'poll' && { pollVotes: 0 }),
        },
        likedBy: [], savedBy: [], gifts: [],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        version: 'v4',
        _operationId: operationId,
        _clientCreatedAt: new Date().toISOString()
      };
      const postsRef = collection(this.firestore, 'posts');
      const docRef = await addDoc(postsRef, postDoc);
      const postId = docRef.id;
      this.updateUserPostCount(postData.authorId).catch(console.warn);
      this.cache.set(postId, { ...postDoc, id: postId, _cachedAt: Date.now() });
      this.invalidateCachePattern(`user_posts_${postData.authorId}`);
      return {
        success: true, postId, post: { ...postDoc, id: postId }, operationId,
        duration: Date.now() - startTime
      };
    } catch (error) {
      console.error('❌ Create post failed:', error);
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
      if (!postSnap.exists()) return { success: false, error: 'Post not found', code: 'not-found', postId };
      const postData = { id: postSnap.id, ...postSnap.data() };
      this.cache.set(postId, { ...postData, _cachedAt: Date.now() });
      return { success: true, post: postData, cached: false };
    } catch (error) {
      return { success: false, error: enhanceError(error, 'Failed to fetch post').message, code: error.code || 'unknown' };
    }
  }

  // ✅ FIXED: getPostsByUser pagination using DocumentSnapshot
  async getPostsByUser(userId, options = {}) {
    await this.ensureInitialized();
    const cacheKey = `user_posts_${userId}_${JSON.stringify(options)}`;
    if (options.cacheFirst !== false) {
      const cached = this.cache.get(cacheKey);
      if (cached) return { success: true, posts: cached.posts, cached: true };
    }
    try {
      const { collection, query, where, getDocs, orderBy, limit, startAfter, doc, getDoc } = this.firestoreMethods;
      const postsRef = collection(this.firestore, 'posts');
      let conditions = [
        where('authorId', '==', userId),
        where('isDeleted', '==', false),
        orderBy('createdAt', 'desc')
      ];
      if (options.status) conditions.push(where('status', '==', options.status));
      if (options.type) conditions.push(where('type', '==', options.type));
      if (options.limit) conditions.push(limit(options.limit));
      
      // Pagination fix: startAfter expects DocumentSnapshot, not string
      let lastDocSnap = null;
      if (options.startAfter) {
        const lastDocRef = doc(this.firestore, 'posts', options.startAfter);
        lastDocSnap = await getDoc(lastDocRef);
        if (lastDocSnap.exists()) {
          conditions.push(startAfter(lastDocSnap));
        }
      }
      
      const q = query(postsRef, ...conditions);
      const snap = await getDocs(q);
      const posts = [];
      snap.forEach(doc => {
        const data = doc.data();
        posts.push({ id: doc.id, ...data });
      });
      const hasMore = snap.docs.length === (options.limit || 10);
      const nextCursor = hasMore ? snap.docs[snap.docs.length - 1].id : null;
      
      this.cache.set(cacheKey, { posts, _cachedAt: Date.now(), _count: posts.length });
      return {
        success: true, posts, hasMore, nextCursor,
        total: posts.length, cached: false
      };
    } catch (error) {
      if (import.meta.env.DEV && error.code === 'permission-denied') {
        return { success: true, posts: [], cached: false };
      }
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
      this.invalidateCachePattern(`user_posts_`);
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
      await this.updateUserPostCount(userId, -1).catch(console.warn);
      this.cache.delete(postId);
      this.invalidateCachePattern(`user_posts_`);
      return { success: true };
    } catch (error) { throw enhanceError(error, 'Failed to delete post'); }
  }

  // ✅ ADDED: batchDeletePosts
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
      this.invalidateCachePattern('user_posts_');
      return { success: true, deletedCount };
    } catch (error) {
      throw enhanceError(error, 'Failed to batch delete posts');
    }
  }

  // ✅ ADDED: getSavedPosts
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
    const postIds = savedEntries.map(e => e.postId);
    const posts = [];
    // Fetch posts in batches of 10
    for (let i = 0; i < postIds.length; i += 10) {
      const chunk = postIds.slice(i, i + 10);
      const postPromises = chunk.map(id => this.getPost(id));
      const postResults = await Promise.all(postPromises);
      postResults.forEach(res => {
        if (res.success && res.post) posts.push(res.post);
      });
    }
    const hasMore = snap.docs.length === (options.limit || 20);
    const nextCursor = hasMore ? snap.docs[snap.docs.length - 1].id : null;
    return { success: true, posts, hasMore, nextCursor };
  }

  // ✅ ADDED: getLikedPosts
  async getLikedPosts(userId, options = {}) {
    await this.ensureInitialized();
    const { collection, query, where, getDocs, doc, getDoc } = this.firestoreMethods;
    // First find all posts where likedBy includes userId
    const postsRef = collection(this.firestore, 'posts');
    const q = query(postsRef, where('likedBy', 'array-contains', userId), where('isDeleted', '==', false));
    const snap = await getDocs(q);
    const posts = [];
    snap.forEach(doc => {
      posts.push({ id: doc.id, ...doc.data() });
    });
    // Sort by most recent liked (could store like timestamps in subcollection for better ordering)
    posts.sort((a, b) => (b.likedAt?.[userId] || b.createdAt) - (a.likedAt?.[userId] || a.createdAt));
    const limited = posts.slice(0, options.limit || 20);
    const hasMore = posts.length > (options.limit || 20);
    const nextCursor = hasMore ? limited[limited.length - 1].id : null;
    return { success: true, posts: limited, hasMore, nextCursor };
  }

  // ==================== POST INTERACTIONS ====================

  // --- LIKE (with duplication check) ---
  async likePost(postId, userId) {
    await this.ensureInitialized();
    try {
      const { doc, runTransaction, increment, arrayUnion, serverTimestamp } = this.firestoreMethods;
      const postRef = doc(this.firestore, 'posts', postId);
      let authorId, alreadyLiked;
      await runTransaction(this.firestore, async (transaction) => {
        const postSnap = await transaction.get(postRef);
        if (!postSnap.exists()) throw new Error('Post not found');
        authorId = postSnap.data().authorId;
        const likedBy = postSnap.data().likedBy || [];
        alreadyLiked = likedBy.includes(userId);
        if (!alreadyLiked) {
          transaction.update(postRef, {
            'stats.likes': increment(1),
            likedBy: arrayUnion(userId),
            updatedAt: serverTimestamp()
          });
        }
      });
      this.cache.delete(postId);
      if (!alreadyLiked) {
        this._notifyLike(postId, userId, authorId).catch(console.warn);
      }
      return { success: true, alreadyLiked };
    } catch (error) {
      console.error(`❌ Like post failed for ${postId}:`, error);
      throw enhanceError(error, 'Failed to like post');
    }
  }

  // --- UNLIKE ---
  async unlikePost(postId, userId) {
    await this.ensureInitialized();
    try {
      const { doc, runTransaction, increment, arrayRemove, serverTimestamp } = this.firestoreMethods;
      const postRef = doc(this.firestore, 'posts', postId);
      let alreadyUnliked;
      await runTransaction(this.firestore, async (transaction) => {
        const postSnap = await transaction.get(postRef);
        if (!postSnap.exists()) throw new Error('Post not found');
        const likedBy = postSnap.data().likedBy || [];
        alreadyUnliked = !likedBy.includes(userId);
        if (!alreadyUnliked) {
          transaction.update(postRef, {
            'stats.likes': increment(-1),
            likedBy: arrayRemove(userId),
            updatedAt: serverTimestamp()
          });
        }
      });
      this.cache.delete(postId);
      return { success: true, alreadyUnliked };
    } catch (error) { throw enhanceError(error, 'Failed to unlike post'); }
  }

  // --- SHARE ---
  async sharePost(postId, userId) {
    await this.ensureInitialized();
    try {
      const { collection, addDoc, doc, updateDoc, increment, serverTimestamp } = this.firestoreMethods;
      const postRef = doc(this.firestore, 'posts', postId);
      await updateDoc(postRef, { 'stats.shares': increment(1), updatedAt: serverTimestamp() });
      const sharesRef = collection(this.firestore, 'shares');
      await addDoc(sharesRef, { postId, userId, sharedAt: serverTimestamp(), createdAt: serverTimestamp() });
      this.cache.delete(postId);
      this._notifyShare(postId, userId).catch(console.warn);
      return { success: true };
    } catch (error) { throw enhanceError(error, 'Failed to share post'); }
  }

  // --- SAVE (with check) ---
  async savePost(postId, userId) {
    await this.ensureInitialized();
    try {
      const { doc, runTransaction, increment, arrayUnion, serverTimestamp } = this.firestoreMethods;
      const postRef = doc(this.firestore, 'posts', postId);
      let alreadySaved;
      await runTransaction(this.firestore, async (transaction) => {
        const postSnap = await transaction.get(postRef);
        if (!postSnap.exists()) throw new Error('Post not found');
        const savedBy = postSnap.data().savedBy || [];
        alreadySaved = savedBy.includes(userId);
        if (!alreadySaved) {
          transaction.update(postRef, {
            'stats.saves': increment(1),
            savedBy: arrayUnion(userId),
            updatedAt: serverTimestamp()
          });
          // Also add to user's saved_posts subcollection for easy retrieval
          const userSavedRef = doc(this.firestore, 'users', userId, 'saved_posts', postId);
          transaction.set(userSavedRef, { postId, savedAt: serverTimestamp() });
        }
      });
      this.cache.delete(postId);
      return { success: true, alreadySaved };
    } catch (error) { throw enhanceError(error, 'Failed to save post'); }
  }

  // --- UNSAVE ---
  async unsavePost(postId, userId) {
    await this.ensureInitialized();
    try {
      const { doc, runTransaction, increment, arrayRemove, serverTimestamp } = this.firestoreMethods;
      const postRef = doc(this.firestore, 'posts', postId);
      let alreadyUnsaved;
      await runTransaction(this.firestore, async (transaction) => {
        const postSnap = await transaction.get(postRef);
        if (!postSnap.exists()) throw new Error('Post not found');
        const savedBy = postSnap.data().savedBy || [];
        alreadyUnsaved = !savedBy.includes(userId);
        if (!alreadyUnsaved) {
          transaction.update(postRef, {
            'stats.saves': increment(-1),
            savedBy: arrayRemove(userId),
            updatedAt: serverTimestamp()
          });
          const userSavedRef = doc(this.firestore, 'users', userId, 'saved_posts', postId);
          transaction.delete(userSavedRef);
        }
      });
      this.cache.delete(postId);
      return { success: true, alreadyUnsaved };
    } catch (error) { throw enhanceError(error, 'Failed to unsave post'); }
  }

  // --- SEND GIFT ---
  async sendGift(postId, userId, giftType, coinValue) {
    await this.ensureInitialized();
    try {
      const { collection, addDoc, doc, getDoc, updateDoc, increment, arrayUnion, serverTimestamp } = this.firestoreMethods;
      const postRef = doc(this.firestore, 'posts', postId);
      const postSnap = await getDoc(postRef);
      if (!postSnap.exists()) throw new Error('Post not found');
      const postData = postSnap.data();
      const giftData = { userId, giftType, coinValue, sentAt: serverTimestamp() };
      await updateDoc(postRef, {
        'stats.gifts': increment(1),
        'stats.giftValue': increment(coinValue),
        gifts: arrayUnion(giftData),
        updatedAt: serverTimestamp()
      });
      const giftsRef = collection(this.firestore, 'gift_transactions');
      await addDoc(giftsRef, {
        postId, fromUserId: userId, toUserId: postData.authorId,
        giftType, coinValue, sentAt: serverTimestamp(), status: 'completed', createdAt: serverTimestamp()
      });
      const monetizationService = await import('./monetizationService.js').then(m => m.getMonetizationService());
      await monetizationService.spendCoins(userId, coinValue, 'gift', { postId, giftType, recipientId: postData.authorId })
        .catch(console.warn);
      this._notifyGift(postId, userId, postData.authorId, giftType, coinValue).catch(console.warn);
      this.cache.delete(postId);
      return { success: true, gift: giftData };
    } catch (error) { throw enhanceError(error, 'Failed to send gift'); }
  }

  // ✅ FIXED: addReaction – notification moved outside transaction
  async addReaction(postId, userId, reactionType) {
    await this.ensureInitialized();
    if (!CONFIG.ALLOWED_REACTIONS.includes(reactionType)) {
      throw new Error(`Reaction type "${reactionType}" not allowed`);
    }
    try {
      const { doc, runTransaction, increment, serverTimestamp } = this.firestoreMethods;
      const postRef = doc(this.firestore, 'posts', postId);
      const reactionDocRef = doc(this.firestore, 'posts', postId, CONFIG.REACTIONS_SUBCOLLECTION, userId);

      let action, oldReaction, authorId;
      await runTransaction(this.firestore, async (transaction) => {
        const postSnap = await transaction.get(postRef);
        if (!postSnap.exists()) throw new Error('Post not found');
        authorId = postSnap.data().authorId;
        const reactionSnap = await transaction.get(reactionDocRef);
        const currentReaction = reactionSnap.exists() ? reactionSnap.data().type : null;

        if (currentReaction === reactionType) {
          transaction.delete(reactionDocRef);
          transaction.update(postRef, {
            [`stats.reactions.${reactionType}`]: increment(-1),
            updatedAt: serverTimestamp()
          });
          action = 'removed';
          oldReaction = reactionType;
        } else if (currentReaction) {
          transaction.set(reactionDocRef, { type: reactionType, updatedAt: serverTimestamp() }, { merge: true });
          transaction.update(postRef, {
            [`stats.reactions.${currentReaction}`]: increment(-1),
            [`stats.reactions.${reactionType}`]: increment(1),
            updatedAt: serverTimestamp()
          });
          action = 'changed';
          oldReaction = currentReaction;
        } else {
          transaction.set(reactionDocRef, { type: reactionType, userId, createdAt: serverTimestamp() });
          transaction.update(postRef, {
            [`stats.reactions.${reactionType}`]: increment(1),
            updatedAt: serverTimestamp()
          });
          action = 'added';
        }
      });

      this.cache.delete(postId);
      // ✅ Notification outside transaction to avoid transaction failure
      if (action !== 'removed' && authorId && authorId !== userId) {
        this._notifyReaction(postId, userId, reactionType, authorId).catch(console.warn);
      }
      return { success: true, action, previousReaction: oldReaction };
    } catch (error) {
      console.error(`❌ Add reaction failed for ${postId}:`, error);
      throw enhanceError(error, 'Failed to add reaction');
    }
  }

  // --- REMOVE REACTION (dedicated, fully working) ---
  async removeReaction(postId, userId) {
    await this.ensureInitialized();
    try {
      const { doc, runTransaction, increment, serverTimestamp } = this.firestoreMethods;
      const postRef = doc(this.firestore, 'posts', postId);
      const reactionDocRef = doc(this.firestore, 'posts', postId, CONFIG.REACTIONS_SUBCOLLECTION, userId);
      let removedType;
      await runTransaction(this.firestore, async (transaction) => {
        const reactionSnap = await transaction.get(reactionDocRef);
        if (!reactionSnap.exists()) return; // nothing to remove
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

  // --- COMMENT COUNT SYNC ---
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

  // ==================== VIEW TRACKING (sharded, hotspot removed) ====================
  async recordPostView(postId, userId) {
    await this.ensureInitialized();
    try {
      const { doc, runTransaction, increment, serverTimestamp } = this.firestoreMethods;
      const postRef = doc(this.firestore, 'posts', postId);
      const shardId = Math.floor(Math.random() * CONFIG.VIEW_SHARDS);
      const viewShardRef = doc(this.firestore, 'posts', postId, 'view_shards', `shard_${shardId}`);
      const viewerRef = doc(this.firestore, 'posts', postId, CONFIG.VIEWERS_SUBCOLLECTION, userId);
      const today = new Date().toISOString().split('T')[0];
      const dailyStatRef = doc(this.firestore, 'posts', postId, CONFIG.DAILY_STATS_SUBCOLLECTION, today);

      await runTransaction(this.firestore, async (transaction) => {
        // Increment view shard correctly
        const shardSnap = await transaction.get(viewShardRef);
        if (shardSnap.exists()) {
          transaction.update(viewShardRef, { count: increment(1), updatedAt: serverTimestamp() });
        } else {
          transaction.set(viewShardRef, { count: 1, updatedAt: serverTimestamp() });
        }

        // Daily stats
        const dailySnap = await transaction.get(dailyStatRef);
        if (dailySnap.exists()) {
          transaction.update(dailyStatRef, { views: increment(1), updatedAt: serverTimestamp() });
        } else {
          transaction.set(dailyStatRef, {
            date: today,
            views: 1,
            likes: 0,
            comments: 0,
            shares: 0,
            createdAt: serverTimestamp()
          });
        }

        // Optional viewer storage
        if (CONFIG.STORE_VIEWERS) {
          transaction.set(viewerRef, { userId, viewedAt: serverTimestamp() }, { merge: true });
        }
      });
      return { success: true };
    } catch (error) {
      console.warn(`recordPostView failed for ${postId}:`, error);
      return { success: false, error: error.message };
    }
  }

  async getPostViewCount(postId) {
    await this.ensureInitialized();
    const { collection, getDocs } = this.firestoreMethods;
    const shardsRef = collection(this.firestore, 'posts', postId, 'view_shards');
    const snap = await getDocs(shardsRef);
    let total = 0;
    snap.forEach(doc => { total += (doc.data().count || 0); });
    return { success: true, views: total };
  }

  async getPostDailyViews(postId, days = 7) {
    await this.ensureInitialized();
    const { collection, query, where, orderBy, getDocs } = this.firestoreMethods;
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const statsRef = collection(this.firestore, 'posts', postId, CONFIG.DAILY_STATS_SUBCOLLECTION);
    const q = query(statsRef, where('date', '>=', startDate), orderBy('date', 'asc'));
    const snap = await getDocs(q);
    const dailyViews = snap.docs.map(doc => ({ date: doc.id, ...doc.data() }));
    return { success: true, dailyViews };
  }

  // ✅ ADDED: getPostAnalytics – aggregate daily stats
  async getPostAnalytics(postId, days = 30) {
    await this.ensureInitialized();
    const dailyStats = await this.getPostDailyViews(postId, days);
    if (!dailyStats.success) return { success: false, error: dailyStats.error };
    const totalViews = dailyStats.dailyViews.reduce((sum, d) => sum + (d.views || 0), 0);
    const totalLikes = dailyStats.dailyViews.reduce((sum, d) => sum + (d.likes || 0), 0);
    const totalComments = dailyStats.dailyViews.reduce((sum, d) => sum + (d.comments || 0), 0);
    const totalShares = dailyStats.dailyViews.reduce((sum, d) => sum + (d.shares || 0), 0);
    return {
      success: true,
      analytics: {
        totalViews,
        totalLikes,
        totalComments,
        totalShares,
        dailyBreakdown: dailyStats.dailyViews
      }
    };
  }

  // ==================== POST SCHEDULING ====================
  async publishScheduledPosts() {
    await this.ensureInitialized();
    const now = new Date();
    const { collection, query, where, getDocs, updateDoc, serverTimestamp } = this.firestoreMethods;
    const q = query(
      collection(this.firestore, 'posts'),
      where('status', '==', 'scheduled'),
      where('scheduledTime', '<=', now),
      where('isDeleted', '==', false)
    );
    const snap = await getDocs(q);
    const updates = [];
    snap.forEach(doc => {
      updates.push(updateDoc(doc.ref, {
        status: 'published',
        publishedAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      }));
    });
    await Promise.all(updates);
    return { success: true, publishedCount: updates.length };
  }

  // ==================== POST EXPIRATION ====================
  async expireOldPosts() {
    await this.ensureInitialized();
    const now = new Date();
    const { collection, query, where, getDocs, updateDoc, serverTimestamp } = this.firestoreMethods;
    const q = query(
      collection(this.firestore, 'posts'),
      where('expiresAt', '<=', now),
      where('isDeleted', '==', false),
      where('status', '==', 'published')
    );
    const snap = await getDocs(q);
    const updates = [];
    snap.forEach(doc => {
      updates.push(updateDoc(doc.ref, {
        status: 'expired',
        updatedAt: serverTimestamp(),
        expiredAt: serverTimestamp()
      }));
    });
    await Promise.all(updates);
    return { success: true, expiredCount: updates.length };
  }

  // ==================== REAL-TIME SUBSCRIPTION (fixed leak) ====================
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
      console.error(`Post subscription error for ${postId}:`, error);
    });
    this.subscriptions.set(subKey, unsubscribe);
    return unsubscribe;
  }

  // ==================== POLL OPERATIONS ====================
  async voteOnPoll(postId, userId, optionIndex, isMultiple = false) {
    await this.ensureInitialized();
    try {
      const { doc, getDoc, updateDoc, increment, serverTimestamp } = this.firestoreMethods;
      const postRef = doc(this.firestore, 'posts', postId);
      const postSnap = await getDoc(postRef);
      if (!postSnap.exists()) throw new Error('Post not found');
      const postData = postSnap.data();
      if (postData.type !== 'poll') throw new Error('Post is not a poll');
      const hasVoted = postData.poll?.votes?.some(vote => vote.userId === userId);
      if (!isMultiple && hasVoted) throw new Error('You have already voted on this poll');
      const votes = [...(postData.poll?.votes || [])];
      votes.push({ userId, optionIndex, votedAt: serverTimestamp() });
      const pollOptions = [...(postData.poll?.options || [])];
      if (pollOptions[optionIndex]) {
        pollOptions[optionIndex] = { ...pollOptions[optionIndex], votes: (pollOptions[optionIndex].votes || 0) + 1 };
      }
      await updateDoc(postRef, {
        'poll.votes': votes, 'poll.options': pollOptions, 'poll.totalVotes': increment(1),
        'stats.pollVotes': increment(1), updatedAt: serverTimestamp()
      });
      this.cache.delete(postId);
      return { success: true, votes: votes.length };
    } catch (error) { throw enhanceError(error, 'Failed to vote on poll'); }
  }

  // ==================== UTILITY ====================
  async ensureInitialized() {
    if (!this.initialized || !this.firestore) await this.initialize();
    return this.firestore;
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
    } catch (error) { console.warn('Update user post count failed:', error); }
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

  clearCache() { this.cache.clear(); console.log('🧹 Firestore cache cleared'); }

  destroy() {
    for (const unsub of this.subscriptions.values()) try { unsub(); } catch (e) {}
    this.subscriptions.clear();
    this.clearCache();
    this.initialized = false;
    this.firestore = null;
    this.firestoreMethods = null;
    this.firebaseApp = null;
    console.log('🔥 Firestore service destroyed');
  }

  // ---------- Notification helpers (lazy import, non-blocking) ----------
  async _notifyLike(postId, senderId, recipientId) {
    if (!recipientId || recipientId === senderId) return;
    try {
      const ns = await import('./notificationsService.js').then(m => m.getNotificationsService());
      await ns.createLikeNotification(postId, senderId, recipientId);
    } catch (err) { console.warn('Like notification failed:', err); }
  }

  async _notifyShare(postId, senderId) {
    try {
      const postSnap = await this.firestoreMethods.getDoc(
        this.firestoreMethods.doc(this.firestore, 'posts', postId)
      );
      if (!postSnap.exists()) return;
      const authorId = postSnap.data().authorId;
      if (!authorId || authorId === senderId) return;
      const ns = await import('./notificationsService.js').then(m => m.getNotificationsService());
      await ns.sendNotification({
        type: 'share', recipientId: authorId, senderId,
        title: 'Someone shared your post',
        message: 'Your post has been shared!',
        metadata: { postId }
      });
    } catch (err) { console.warn('Share notification failed:', err); }
  }

  async _notifyGift(postId, senderId, recipientId, giftType, coinValue) {
    if (!recipientId || recipientId === senderId) return;
    try {
      const ns = await import('./notificationsService.js').then(m => m.getNotificationsService());
      await ns.sendNotification({
        type: 'gift_received', recipientId, senderId,
        title: 'You received a gift!',
        message: `${giftType} (${coinValue} coins)`,
        metadata: { postId, giftType, coinValue }
      });
    } catch (err) { console.warn('Gift notification failed:', err); }
  }

  async _notifyReaction(postId, senderId, reactionType, recipientId) {
    if (!recipientId || recipientId === senderId) return;
    try {
      const ns = await import('./notificationsService.js').then(m => m.getNotificationsService());
      await ns.sendNotification({
        type: 'reaction', recipientId, senderId,
        title: 'New reaction',
        message: `reacted ${reactionType} to your post`,
        metadata: { postId, reactionType }
      });
    } catch (err) { console.warn('Reaction notification failed:', err); }
  }
}

// ==================== SINGLETON & EXPORTS ====================
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
  batchDeletePosts: (ids, uid, isAdmin) => getFirestoreService().batchDeletePosts(ids, uid, isAdmin),
  likePost: (pid, uid) => getFirestoreService().likePost(pid, uid),
  unlikePost: (pid, uid) => getFirestoreService().unlikePost(pid, uid),
  sharePost: (pid, uid) => getFirestoreService().sharePost(pid, uid),
  savePost: (pid, uid) => getFirestoreService().savePost(pid, uid),
  unsavePost: (pid, uid) => getFirestoreService().unsavePost(pid, uid),
  getSavedPosts: (uid, opts) => getFirestoreService().getSavedPosts(uid, opts),
  getLikedPosts: (uid, opts) => getFirestoreService().getLikedPosts(uid, opts),
  sendGift: (pid, uid, type, value) => getFirestoreService().sendGift(pid, uid, type, value),
  addReaction: (pid, uid, reactionType) => getFirestoreService().addReaction(pid, uid, reactionType),
  removeReaction: (pid, uid) => getFirestoreService().removeReaction(pid, uid),
  getUserReaction: (pid, uid) => getFirestoreService().getUserReaction(pid, uid),
  voteOnPoll: (pid, uid, optIdx, mult) => getFirestoreService().voteOnPoll(pid, uid, optIdx, mult),
  incrementCommentCount: (pid, delta) => getFirestoreService().incrementCommentCount(pid, delta),
  recordPostView: (pid, uid) => getFirestoreService().recordPostView(pid, uid),
  getPostViewCount: (pid) => getFirestoreService().getPostViewCount(pid),
  getPostDailyViews: (pid, days) => getFirestoreService().getPostDailyViews(pid, days),
  getPostAnalytics: (pid, days) => getFirestoreService().getPostAnalytics(pid, days),
  publishScheduledPosts: () => getFirestoreService().publishScheduledPosts(),
  expireOldPosts: () => getFirestoreService().expireOldPosts(),
  subscribeToPost: (pid, cb) => getFirestoreService().subscribeToPost(pid, cb),
  getService: getFirestoreService,
  clearCache: () => getFirestoreService().clearCache(),
  getStats: () => getFirestoreService().getStats(),
  ensureInitialized: () => getFirestoreService().ensureInitialized()
};

export default firestoreService;
export { firestoreService, getFirestoreService };