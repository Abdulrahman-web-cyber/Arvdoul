// src/services/firestoreService.js - ARVDOUL ENTERPRISE PRO MAX V14
// 🚀 SUBCOLLECTION ARCHITECTURE • SCALABLE TO BILLIONS • FULL TRANSACTIONS
// 🔥 PRODUCTION READY • SURPASSES FACEBOOK, INSTAGRAM, MESSENGER

// ==================== SECURITY RULES (COPY TO FIREBASE CONSOLE) ====================
/*
  rules_version = '2';
  service cloud.firestore {
    match /databases/{database}/documents {
      // Posts
      match /posts/{postId} {
        allow read: if true; // adjust visibility as needed
        allow create: if request.auth != null && request.auth.uid == request.resource.data.authorId;
        allow update: if request.auth != null && request.auth.uid == resource.data.authorId;
        allow delete: if false; // soft delete only

        // Subcollections
        match /likes/{userId} {
          allow read: if true;
          allow create, delete: if request.auth != null && request.auth.uid == userId;
        }
        match /saves/{userId} {
          allow read: if true;
          allow create, delete: if request.auth != null && request.auth.uid == userId;
        }
        match /gifts/{giftId} {
          allow read: if true;
          allow create: if request.auth != null;
        }
        match /pollVotes/{userId} {
          allow read: if true;
          allow create: if request.auth != null && request.auth.uid == userId;
        }
        match /answers/{answerId} {
          allow read: if true;
          allow create: if request.auth != null;
        }
        match /views/{userId} {
          allow read: if true;
          allow create: if request.auth != null && request.auth.uid == userId;
        }
      }

      // Gift transactions (audit)
      match /gift_transactions/{txId} {
        allow read: if true;
        allow create: if request.auth != null;
      }

      // Shares
      match /shares/{shareId} {
        allow read: if true;
        allow create: if request.auth != null;
      }

      // Blocks
      match /blocks/{blockId} {
        allow read: if true;
        allow write: if request.auth != null && request.auth.uid == blockId.split('_')[0];
      }

      // Users
      match /users/{userId} {
        allow read: if true;
        allow update: if request.auth != null && request.auth.uid == userId;
      }
    }
  }
*/

// ==================== REQUIRED COMPOSITE INDEXES ====================
/*
  To support queries like orderBy('likedAt', 'desc') on subcollections,
  create the following indexes in Firebase Console:

  1. Collection: posts/{postId}/likes
     - Fields: likedAt (descending)

  2. Collection: posts/{postId}/saves
     - Fields: savedAt (descending)

  3. Collection: posts/{postId}/gifts
     - Fields: sentAt (descending)

  4. Collection: posts/{postId}/pollVotes
     - Fields: votedAt (descending)

  5. Collection: posts/{postId}/answers
     - Fields: createdAt (descending)

  Firestore will automatically suggest missing indexes in error logs.
*/

// ==================== VIEW CLEANUP CLOUD FUNCTION (SCHEDULED) ====================
/*
  To prevent unlimited growth of view documents, deploy a Cloud Function
  that runs daily and deletes views older than 30 days.

  Example (Node.js):
    exports.cleanupOldViews = functions.pubsub.schedule('0 0 * * *').onRun(async () => {
      const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const postsSnapshot = await admin.firestore().collection('posts').get();
      const batch = admin.firestore().batch();
      let count = 0;
      for (const postDoc of postsSnapshot.docs) {
        const viewsRef = postDoc.ref.collection('views');
        const oldViews = await viewsRef.where('viewedAt', '<', cutoff).limit(500).get();
        oldViews.forEach(doc => batch.delete(doc.ref));
        count += oldViews.size;
        if (count >= 500) {
          await batch.commit();
          batch = admin.firestore().batch();
          count = 0;
        }
      }
      if (count > 0) await batch.commit();
    });
*/

// ==================== LRU CACHE IMPLEMENTATION ====================
class LRUCache {
  constructor(maxSize = 100, ttl = 60000) {
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

  delete(key) {
    this.cache.delete(key);
  }

  deletePattern(pattern) {
    const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.cache.delete(key);
      }
    }
  }

  clear() {
    this.cache.clear();
  }

  get size() {
    return this.cache.size;
  }
}

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
    'cancelled': 'Operation cancelled.',
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
    this.blockCache = new LRUCache(200, 5 * 60 * 1000);
    this.subscriptions = new Map();
    this.retryAttempts = 3;
    this.isOnline = navigator.onLine;
    this.logger = console;

    this.firestoreModule = null;
    this.firebaseApp = null;

    this.initialize().catch(err => {
      console.warn('Firestore service initialization warning:', err.message);
    });

    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        this.isOnline = true;
        console.log('🌐 Firestore: Back online');
      });
      window.addEventListener('offline', () => {
        this.isOnline = false;
        console.log('🌐 Firestore: Offline mode');
      });
    }
  }

  // ==================== INITIALIZATION ====================
  async initialize() {
    if (this.initialized && this.firestore) return this.firestore;

    try {
      console.log('🚀 Initializing Enterprise Firestore Service (subcollection architecture)...');

      this.firebaseApp = await import('../firebase/firebase.js');
      this.firestore = await this.firebaseApp.getFirestoreInstance();

      if (!this.firestore) {
        throw new Error('Failed to get Firestore instance');
      }

      this.firestoreModule = await import('firebase/firestore');
      const {
        collection,
        addDoc,
        getDoc,
        getDocs,
        updateDoc,
        deleteDoc,
        setDoc,
        query,
        where,
        orderBy,
        limit,
        startAfter,
        serverTimestamp,
        increment,
        doc,
        enableIndexedDbPersistence,
        runTransaction,
        writeBatch,
      } = this.firestoreModule;

      this.firestoreMethods = {
        collection,
        addDoc,
        getDoc,
        getDocs,
        updateDoc,
        deleteDoc,
        setDoc,
        query,
        where,
        orderBy,
        limit,
        startAfter,
        serverTimestamp,
        increment,
        doc,
        runTransaction,
        writeBatch,
      };

      try {
        await enableIndexedDbPersistence(this.firestore, {
          synchronizeTabs: true,
        });
        console.log('✅ Firestore persistence enabled (synchronizeTabs)');
      } catch (persistenceError) {
        if (persistenceError.code !== 'failed-precondition') {
          console.warn('⚠️ Firestore persistence warning:', persistenceError.message);
        } else {
          console.log('ℹ️ Firestore persistence already active in another tab');
        }
      }

      this.initialized = true;
      console.log('✅ Enterprise Firestore Service ready (subcollection mode)');
      return this.firestore;
    } catch (error) {
      console.error('❌ Firestore initialization failed:', error);
      throw enhanceError(error, 'Failed to initialize database');
    }
  }

  // ==================== BLOCK CHECK HELPER ====================
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
    } catch (error) {
      console.warn('Failed to check block status:', error);
      return false;
    }
  }

  invalidateBlockCache(userId, blockedByUserId) {
    const cacheKey = `block_${blockedByUserId}_${userId}`;
    this.blockCache.delete(cacheKey);
  }

  // ==================== POST OPERATIONS ====================
  async createPost(postData) {
    await this.ensureInitialized();

    const startTime = Date.now();
    const operationId = `post_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    try {
      console.log('📝 Creating post:', {
        operationId,
        authorId: postData.authorId,
        type: postData.type,
        monetization: postData.monetization?.type,
        boost: postData.boostData?.type,
      });

      const auth = await this.getAuthInstance();
      const currentUser = auth.currentUser;

      if (!currentUser) {
        throw new Error('User not authenticated. Please sign in to create posts.');
      }

      if (postData.authorId !== currentUser.uid) {
        throw new Error(`authorId (${postData.authorId}) does not match authenticated user (${currentUser.uid})`);
      }

      const { collection, addDoc, serverTimestamp } = this.firestoreMethods;

      if (!postData.authorId) {
        throw new Error('authorId is required');
      }

      const postDoc = {
        type: postData.type,
        content: postData.content || '',
        media: postData.media || [],
        authorId: postData.authorId,
        authorName: postData.authorName || 'Arvdoul User',
        authorUsername: postData.authorUsername || `user_${postData.authorId?.slice(0, 8)}`,
        authorPhoto: postData.authorPhoto || '/assets/default-profile.png',

        ...(postData.type === 'poll' && { poll: postData.poll }),
        ...(postData.type === 'question' && { question: postData.question, answers: postData.answers || [] }),
        ...(postData.type === 'link' && { link: postData.link }),
        ...(postData.type === 'event' && { event: postData.event }),

        visibility: postData.visibility || 'public',
        enableComments: postData.enableComments !== false,
        enableGifts: postData.enableGifts !== false,
        location: postData.location || null,
        tags: postData.tags || [],
        hashtags: this.extractHashtags(postData.content),

        backgroundImage: postData.backgroundImage || null,
        textColor: postData.textColor || (postData.type === 'text' ? '#000000' : null),

        status: postData.status || 'published',
        isDeleted: false,

        monetization: postData.monetization || null,
        boostData: postData.boostData || null,

        scheduledTime: postData.scheduledTime || null,
        publishedAt: postData.status === 'published' ? serverTimestamp() : null,

        stats: {
          likes: 0,
          comments: 0,
          shares: 0,
          saves: 0,
          views: 0,
          gifts: 0,
          giftValue: 0,
          ...(postData.type === 'poll' && { pollVotes: 0 }),
          ...(postData.type === 'question' && { answerCount: 0 }),
          ...postData.stats,
        },

        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),

        version: 'v4',
        _operationId: operationId,
        _clientCreatedAt: new Date().toISOString(),
      };

      const postsRef = collection(this.firestore, 'posts');
      const docRef = await addDoc(postsRef, postDoc);
      const postId = docRef.id;

      console.log('✅ Post created successfully:', {
        id: postId,
        type: postData.type,
        author: postData.authorUsername,
        path: `posts/${postId}`,
      });

      this.updateUserPostCount(postData.authorId).catch(err => {
        console.warn('Failed to update user stats:', err);
      });

      this.cache.set(postId, {
        ...postDoc,
        id: postId,
        _cachedAt: Date.now(),
      });
      this.invalidateCachePattern(`user_posts_${postData.authorId}`);

      return {
        success: true,
        postId,
        post: { ...postDoc, id: postId },
        operationId,
        duration: Date.now() - startTime,
      };
    } catch (error) {
      console.error('❌ Create post failed:', error);
      const enhancedError = enhanceError(error, 'Failed to create post');
      if (error.code === 'permission-denied') {
        throw new Error('You do not have permission to create posts. Please check your authentication and Firestore rules.');
      }
      if (error.code === 'unavailable') {
        throw new Error('Database temporarily unavailable. Please check your internet connection and try again.');
      }
      throw enhancedError;
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
      if (cached) {
        return { success: true, post: cached, cached: true };
      }
    }

    try {
      const { doc, getDoc } = this.firestoreMethods;
      const postRef = doc(this.firestore, 'posts', postId);
      const postSnap = await getDoc(postRef);

      if (!postSnap.exists()) {
        return { success: false, error: 'Post not found', code: 'not-found', postId };
      }

      const postData = { id: postSnap.id, ...postSnap.data() };
      this.cache.set(postId, { ...postData, _cachedAt: Date.now() });
      return { success: true, post: postData, cached: false };
    } catch (error) {
      console.error(`❌ Get post failed for ${postId}:`, error);
      return { success: false, error: enhanceError(error, 'Failed to fetch post').message, code: error.code || 'unknown' };
    }
  }

  async getPostsByUser(userId, options = {}) {
    await this.ensureInitialized();

    const cacheKey = `user_posts_${userId}_${JSON.stringify(options)}`;
    if (options.cacheFirst !== false) {
      const cached = this.cache.get(cacheKey);
      if (cached) {
        return { success: true, posts: cached.posts, cached: true };
      }
    }

    try {
      const { collection, query, where, getDocs, orderBy, limit, startAfter } = this.firestoreMethods;
      const postsRef = collection(this.firestore, 'posts');
      const conditions = [
        where('authorId', '==', userId),
        where('isDeleted', '==', false),
        orderBy('createdAt', 'desc'),
      ];
      if (options.status) conditions.push(where('status', '==', options.status));
      if (options.type) conditions.push(where('type', '==', options.type));
      if (options.limit) conditions.push(limit(options.limit));
      if (options.startAfter) conditions.push(startAfter(options.startAfter));

      const q = query(postsRef, ...conditions);
      const querySnapshot = await getDocs(q);

      const posts = [];
      querySnapshot.forEach(doc => {
        posts.push({ id: doc.id, ...doc.data() });
      });

      this.cache.set(cacheKey, { posts, _cachedAt: Date.now(), _count: posts.length });
      return {
        success: true,
        posts,
        hasMore: options.limit ? posts.length === options.limit : false,
        total: posts.length,
        cached: false,
      };
    } catch (error) {
      console.error(`❌ Get user posts failed for ${userId}:`, error);
      if (import.meta.env.DEV && error.code === 'permission-denied') {
        console.warn('⚠️ Firestore permission denied in development. Check Firestore rules.');
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
      const updateData = {
        ...updates,
        updatedAt: serverTimestamp(),
        _clientUpdatedAt: new Date().toISOString(),
      };
      await updateDoc(postRef, updateData);
      this.cache.delete(postId);
      this.invalidateCachePattern(`user_posts_`);
      return { success: true, postId };
    } catch (error) {
      console.error(`❌ Update post failed for ${postId}:`, error);
      throw enhanceError(error, 'Failed to update post');
    }
  }

  async deletePost(postId, userId) {
    await this.ensureInitialized();

    try {
      const { doc, updateDoc, serverTimestamp } = this.firestoreMethods;
      const postRef = doc(this.firestore, 'posts', postId);
      await updateDoc(postRef, {
        isDeleted: true,
        deletedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        status: 'deleted',
        deletedBy: userId,
      });
      await this.updateUserPostCount(userId, -1).catch(console.warn);
      this.cache.delete(postId);
      this.invalidateCachePattern(`user_posts_`);
      return { success: true };
    } catch (error) {
      console.error(`❌ Delete post failed for ${postId}:`, error);
      throw enhanceError(error, 'Failed to delete post');
    }
  }

  // ==================== ANSWER OPERATIONS ====================
  async answerQuestion(postId, userId, answerText, options = {}) {
    await this.ensureInitialized();

    try {
      const { doc, runTransaction, serverTimestamp, increment, collection } = this.firestoreMethods;
      const postRef = doc(this.firestore, 'posts', postId);

      const result = await runTransaction(this.firestore, async transaction => {
        const postSnap = await transaction.get(postRef);
        if (!postSnap.exists()) throw new Error('Post not found');
        const postData = postSnap.data();
        if (postData.type !== 'question') throw new Error('Post is not a question');

        const answersRef = collection(this.firestore, 'posts', postId, 'answers');
        const answerDocRef = doc(answersRef);
        transaction.set(answerDocRef, {
          userId,
          answer: answerText,
          createdAt: serverTimestamp(),
          ...(options.metadata || {}),
        });

        transaction.update(postRef, {
          'stats.answerCount': increment(1),
          updatedAt: serverTimestamp(),
        });

        const newStats = {
          ...postData.stats,
          answerCount: (postData.stats?.answerCount || 0) + 1,
        };
        return { newStats };
      });

      this.cache.delete(postId);
      return { success: true, postId, stats: result.newStats };
    } catch (error) {
      console.error(`❌ Answer question failed for ${postId}:`, error);
      throw enhanceError(error, 'Failed to submit answer');
    }
  }

  // ==================== POST INTERACTIONS (with subcollections) ====================
  async likePost(postId, userId) {
    await this.ensureInitialized();

    const post = await this.getPost(postId, { cacheFirst: true });
    if (post.success && (await this._isBlocked(userId, post.post.authorId))) {
      throw enhanceError({ code: 'permission-denied' }, 'You are blocked by the post author');
    }

    try {
      const { doc, runTransaction, increment, serverTimestamp } = this.firestoreMethods;
      const postRef = doc(this.firestore, 'posts', postId);
      const likeRef = doc(this.firestore, 'posts', postId, 'likes', userId);

      const result = await runTransaction(this.firestore, async transaction => {
        const postSnap = await transaction.get(postRef);
        if (!postSnap.exists()) throw new Error('Post not found');
        const postData = postSnap.data();

        if (await this._isBlocked(userId, postData.authorId)) {
          throw new Error('You are blocked by the post author');
        }

        const likeSnap = await transaction.get(likeRef);
        if (likeSnap.exists()) {
          // Unlike
          transaction.delete(likeRef);
          transaction.update(postRef, {
            'stats.likes': increment(-1),
            updatedAt: serverTimestamp(),
          });
          const newStats = {
            ...postData.stats,
            likes: Math.max((postData.stats?.likes || 0) - 1, 0),
          };
          return { action: 'unliked', stats: newStats };
        } else {
          // Like
          transaction.set(likeRef, { userId, likedAt: serverTimestamp() });
          transaction.update(postRef, {
            'stats.likes': increment(1),
            updatedAt: serverTimestamp(),
          });
          const newStats = {
            ...postData.stats,
            likes: (postData.stats?.likes || 0) + 1,
          };
          return { action: 'liked', stats: newStats };
        }
      });

      this.cache.delete(postId);
      return { success: true, ...result };
    } catch (error) {
      console.error(`❌ Like post failed for ${postId}:`, error);
      throw enhanceError(error, 'Failed to like post');
    }
  }

  async sharePost(postId, userId) {
    await this.ensureInitialized();

    const post = await this.getPost(postId, { cacheFirst: true });
    if (post.success && (await this._isBlocked(userId, post.post.authorId))) {
      throw enhanceError({ code: 'permission-denied' }, 'You are blocked by the post author');
    }

    try {
      const { collection, addDoc, doc, runTransaction, increment, serverTimestamp } = this.firestoreMethods;
      const postRef = doc(this.firestore, 'posts', postId);

      const result = await runTransaction(this.firestore, async transaction => {
        const postSnap = await transaction.get(postRef);
        if (!postSnap.exists()) throw new Error('Post not found');
        const postData = postSnap.data();

        if (await this._isBlocked(userId, postData.authorId)) {
          throw new Error('You are blocked by the post author');
        }

        transaction.update(postRef, {
          'stats.shares': increment(1),
          updatedAt: serverTimestamp(),
        });

        const sharesRef = collection(this.firestore, 'shares');
        const shareDocRef = doc(sharesRef);
        transaction.set(shareDocRef, {
          postId,
          userId,
          sharedAt: serverTimestamp(),
          createdAt: serverTimestamp(),
        });

        const newStats = {
          ...postData.stats,
          shares: (postData.stats?.shares || 0) + 1,
        };
        return { stats: newStats, shareId: shareDocRef.id };
      });

      this.cache.delete(postId);
      return { success: true, ...result };
    } catch (error) {
      console.error(`❌ Share post failed for ${postId}:`, error);
      throw enhanceError(error, 'Failed to share post');
    }
  }

  async savePost(postId, userId) {
    await this.ensureInitialized();

    const post = await this.getPost(postId, { cacheFirst: true });
    if (post.success && (await this._isBlocked(userId, post.post.authorId))) {
      throw enhanceError({ code: 'permission-denied' }, 'You are blocked by the post author');
    }

    try {
      const { doc, runTransaction, increment, serverTimestamp } = this.firestoreMethods;
      const postRef = doc(this.firestore, 'posts', postId);
      const saveRef = doc(this.firestore, 'posts', postId, 'saves', userId);

      const result = await runTransaction(this.firestore, async transaction => {
        const postSnap = await transaction.get(postRef);
        if (!postSnap.exists()) throw new Error('Post not found');
        const postData = postSnap.data();

        if (await this._isBlocked(userId, postData.authorId)) {
          throw new Error('You are blocked by the post author');
        }

        const saveSnap = await transaction.get(saveRef);
        if (saveSnap.exists()) {
          transaction.delete(saveRef);
          transaction.update(postRef, {
            'stats.saves': increment(-1),
            updatedAt: serverTimestamp(),
          });
          const newStats = {
            ...postData.stats,
            saves: Math.max((postData.stats?.saves || 0) - 1, 0),
          };
          return { action: 'unsaved', stats: newStats };
        } else {
          transaction.set(saveRef, { userId, savedAt: serverTimestamp() });
          transaction.update(postRef, {
            'stats.saves': increment(1),
            updatedAt: serverTimestamp(),
          });
          const newStats = {
            ...postData.stats,
            saves: (postData.stats?.saves || 0) + 1,
          };
          return { action: 'saved', stats: newStats };
        }
      });

      this.cache.delete(postId);
      return { success: true, ...result };
    } catch (error) {
      console.error(`❌ Save post failed for ${postId}:`, error);
      throw enhanceError(error, 'Failed to save post');
    }
  }

  async sendGift(postId, userId, giftType, coinValue) {
    await this.ensureInitialized();

    const post = await this.getPost(postId, { cacheFirst: true });
    if (post.success && (await this._isBlocked(userId, post.post.authorId))) {
      throw enhanceError({ code: 'permission-denied' }, 'You are blocked by the post author');
    }

    try {
      const { collection, doc, runTransaction, increment, serverTimestamp } = this.firestoreMethods;
      const postRef = doc(this.firestore, 'posts', postId);
      const giftRef = doc(collection(this.firestore, 'posts', postId, 'gifts')); // auto‑id

      const result = await runTransaction(this.firestore, async transaction => {
        const postSnap = await transaction.get(postRef);
        if (!postSnap.exists()) throw new Error('Post not found');
        const postData = postSnap.data();

        if (await this._isBlocked(userId, postData.authorId)) {
          throw new Error('You are blocked by the post author');
        }

        transaction.set(giftRef, {
          userId,
          giftType,
          coinValue,
          sentAt: serverTimestamp(),
        });

        transaction.update(postRef, {
          'stats.gifts': increment(1),
          'stats.giftValue': increment(coinValue),
          updatedAt: serverTimestamp(),
        });

        const giftsTxRef = doc(collection(this.firestore, 'gift_transactions'));
        transaction.set(giftsTxRef, {
          postId,
          fromUserId: userId,
          toUserId: postData.authorId,
          giftType,
          coinValue,
          sentAt: serverTimestamp(),
          status: 'completed',
          createdAt: serverTimestamp(),
        });

        const newStats = {
          ...postData.stats,
          gifts: (postData.stats?.gifts || 0) + 1,
          giftValue: (postData.stats?.giftValue || 0) + coinValue,
        };
        return { stats: newStats, giftId: giftRef.id };
      });

      this.cache.delete(postId);
      return { success: true, ...result };
    } catch (error) {
      console.error(`❌ Send gift failed for ${postId}:`, error);
      throw enhanceError(error, 'Failed to send gift');
    }
  }

  // ==================== POLL OPERATIONS ====================
  async voteOnPoll(postId, userId, optionIndex, isMultiple = false) {
    await this.ensureInitialized();

    const post = await this.getPost(postId, { cacheFirst: true });
    if (post.success && (await this._isBlocked(userId, post.post.authorId))) {
      throw enhanceError({ code: 'permission-denied' }, 'You are blocked by the post author');
    }

    try {
      const { doc, runTransaction, increment, serverTimestamp, setDoc } = this.firestoreMethods;
      const postRef = doc(this.firestore, 'posts', postId);
      const voteRef = doc(this.firestore, 'posts', postId, 'pollVotes', userId);

      const result = await runTransaction(this.firestore, async transaction => {
        const postSnap = await transaction.get(postRef);
        if (!postSnap.exists()) throw new Error('Post not found');
        const postData = postSnap.data();
        if (postData.type !== 'poll') throw new Error('Post is not a poll');

        if (await this._isBlocked(userId, postData.authorId)) {
          throw new Error('You are blocked by the post author');
        }

        const voteSnap = await transaction.get(voteRef);
        if (!isMultiple && voteSnap.exists()) {
          throw new Error('You have already voted on this poll');
        }

        // Record the vote
        transaction.set(voteRef, {
          userId,
          optionIndex,
          votedAt: serverTimestamp(),
        });

        // Update poll options vote counts
        const pollOptions = [...(postData.poll?.options || [])];
        if (pollOptions[optionIndex]) {
          pollOptions[optionIndex] = {
            ...pollOptions[optionIndex],
            votes: (pollOptions[optionIndex].votes || 0) + 1,
          };
        }

        transaction.update(postRef, {
          'poll.options': pollOptions,
          'poll.totalVotes': increment(1),
          'stats.pollVotes': increment(1),
          updatedAt: serverTimestamp(),
        });

        const newStats = {
          ...postData.stats,
          pollVotes: (postData.stats?.pollVotes || 0) + 1,
        };
        return { stats: newStats };
      });

      this.cache.delete(postId);
      return { success: true, ...result };
    } catch (error) {
      console.error(`❌ Vote on poll failed for ${postId}:`, error);
      throw enhanceError(error, 'Failed to vote on poll');
    }
  }

  // ==================== ANALYTICS ====================
  async recordPostView(postId, userId = null, options = {}) {
    await this.ensureInitialized();

    if (userId) {
      const post = await this.getPost(postId, { cacheFirst: true });
      if (post.success && (await this._isBlocked(userId, post.post.authorId))) {
        return { success: false, error: 'You are blocked by the post author', blocked: true };
      }
    }

    try {
      const { doc, runTransaction, increment, serverTimestamp } = this.firestoreMethods;
      const postRef = doc(this.firestore, 'posts', postId);
      const trackUnique = options.trackUnique !== false && userId;

      const result = await runTransaction(this.firestore, async transaction => {
        const postSnap = await transaction.get(postRef);
        if (!postSnap.exists()) throw new Error('Post not found');
        const postData = postSnap.data();

        if (userId && (await this._isBlocked(userId, postData.authorId))) {
          throw new Error('You are blocked by the post author');
        }

        let alreadyViewed = false;
        if (trackUnique && userId) {
          const viewRef = doc(this.firestore, 'posts', postId, 'views', userId);
          const viewSnap = await transaction.get(viewRef);
          if (viewSnap.exists()) {
            alreadyViewed = true;
          } else {
            transaction.set(viewRef, {
              userId,
              viewedAt: serverTimestamp(),
              ...(options.metadata || {}),
            });
          }
        }

        if (!alreadyViewed) {
          transaction.update(postRef, {
            'stats.views': increment(1),
            updatedAt: serverTimestamp(),
          });
        }

        const newStats = {
          ...postData.stats,
          views: (postData.stats?.views || 0) + (alreadyViewed ? 0 : 1),
        };
        return { stats: newStats, alreadyViewed };
      });

      if (!result.alreadyViewed) {
        this.cache.delete(postId);
      }
      return { success: true, ...result };
    } catch (error) {
      console.error(`❌ Record view failed for ${postId}:`, error);
      if (error.message.includes('blocked')) {
        return { success: false, error: 'You are blocked by the post author', blocked: true };
      }
      throw enhanceError(error, 'Failed to record view');
    }
  }

  // ==================== BATCH OPERATIONS ====================
  async batchDeletePosts(postIds, userId, isAdmin = false) {
    await this.ensureInitialized();

    if (!Array.isArray(postIds) || postIds.length === 0) {
      throw new Error('postIds must be a non-empty array');
    }

    const BATCH_LIMIT = 500;
    if (postIds.length > BATCH_LIMIT) {
      throw new Error(`Cannot delete more than ${BATCH_LIMIT} posts in one batch`);
    }

    try {
      const { writeBatch, doc, serverTimestamp, collection, query, where, getDocs } = this.firestoreMethods;
      const batch = writeBatch(this.firestore);
      const authorCounts = new Map();

      if (!isAdmin) {
        const postMap = new Map();
        const chunkSize = 10;
        for (let i = 0; i < postIds.length; i += chunkSize) {
          const chunk = postIds.slice(i, i + chunkSize);
          const postsRef = collection(this.firestore, 'posts');
          const q = query(postsRef, where('__name__', 'in', chunk));
          const snapshot = await getDocs(q);
          snapshot.forEach(docSnap => {
            const data = docSnap.data();
            if (!data.isDeleted) {
              postMap.set(docSnap.id, { id: docSnap.id, ...data });
            }
          });
        }

        for (const postId of postIds) {
          const postData = postMap.get(postId);
          if (!postData) {
            console.warn(`Post ${postId} not found or already deleted, skipping`);
            continue;
          }
          if (postData.authorId !== userId) {
            throw new Error(`You do not own post ${postId}`);
          }
          const current = authorCounts.get(postData.authorId) || 0;
          authorCounts.set(postData.authorId, current - 1);

          const postRef = doc(this.firestore, 'posts', postId);
          batch.update(postRef, {
            isDeleted: true,
            deletedAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            status: 'deleted',
            deletedBy: userId,
          });
          this.cache.delete(postId);
        }
      } else {
        for (const postId of postIds) {
          const postRef = doc(this.firestore, 'posts', postId);
          batch.update(postRef, {
            isDeleted: true,
            deletedAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            status: 'deleted',
            deletedBy: 'system',
          });
          this.cache.delete(postId);
        }
      }

      await batch.commit();

      if (!isAdmin) {
        for (const [authorId, delta] of authorCounts.entries()) {
          await this.updateUserPostCount(authorId, delta).catch(console.warn);
        }
      }

      const authorsToInvalidate = isAdmin ? [] : Array.from(authorCounts.keys());
      for (const authorId of authorsToInvalidate) {
        this.invalidateCachePattern(`user_posts_${authorId}`);
      }

      return { success: true, deletedCount: postIds.length, operation: 'batch_delete' };
    } catch (error) {
      console.error('❌ Batch delete posts failed:', error);
      throw enhanceError(error, 'Failed to batch delete posts');
    }
  }

  // ==================== UTILITY METHODS ====================
  async ensureInitialized() {
    if (!this.initialized || !this.firestore) {
      await this.initialize();
    }
    return this.firestore;
  }

  async getAuthInstance() {
    try {
      if (!this.firebaseApp) {
        this.firebaseApp = await import('../firebase/firebase.js');
      }
      return await this.firebaseApp.getAuthInstance();
    } catch (error) {
      console.error('Failed to get auth instance:', error);
      throw error;
    }
  }

  async updateUserPostCount(userId, delta = 1) {
    try {
      await this.ensureInitialized();
      const { doc, updateDoc, increment, serverTimestamp } = this.firestoreMethods;
      const userRef = doc(this.firestore, 'users', userId);
      await updateDoc(userRef, {
        postCount: increment(delta),
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      console.warn('Update user post count failed:', error);
    }
  }

  invalidateCache(key) {
    this.cache.delete(key);
  }

  invalidateCachePattern(pattern) {
    this.cache.deletePattern(pattern);
  }

  cleanupCache() {
    // LRU automatically handles TTL; no forced cleanup needed.
  }

  getStats() {
    return {
      cacheSize: this.cache.size,
      blockCacheSize: this.blockCache.size,
      subscriptions: this.subscriptions.size,
      initialized: this.initialized,
      online: this.isOnline,
      firestoreMethods: Object.keys(this.firestoreMethods || {}),
    };
  }

  clearCache() {
    this.cache.clear();
    this.blockCache.clear();
    console.log('🧹 Firestore cache cleared');
  }

  destroy() {
    for (const unsubscribe of this.subscriptions.values()) {
      try {
        unsubscribe();
      } catch (error) {
        console.warn('Error unsubscribing:', error);
      }
    }
    this.subscriptions.clear();
    this.clearCache();
    this.initialized = false;
    this.firestore = null;
    this.firestoreMethods = null;
    this.firebaseApp = null;
    console.log('🔥 Firestore service destroyed');
  }

  // ==================== PAGINATED SUBCOLLECTION READERS ====================
  async getPostLikes(postId, options = {}) {
    await this.ensureInitialized();
    const { limit: pageSize = 20, startAfter: cursor } = options;
    const { collection, query, orderBy, limit, startAfter, getDocs } = this.firestoreMethods;
    const likesRef = collection(this.firestore, 'posts', postId, 'likes');
    let q = query(likesRef, orderBy('likedAt', 'desc'), limit(pageSize));
    if (cursor) {
      q = query(q, startAfter(cursor));
    }
    const snapshot = await getDocs(q);
    const likes = snapshot.docs.map(doc => ({ userId: doc.id, ...doc.data() }));
    const lastDoc = snapshot.docs[snapshot.docs.length - 1];
    const nextCursor = lastDoc || null;
    return { likes, nextCursor, hasMore: snapshot.docs.length === pageSize };
  }

  async getPostSaves(postId, options = {}) {
    await this.ensureInitialized();
    const { limit: pageSize = 20, startAfter: cursor } = options;
    const { collection, query, orderBy, limit, startAfter, getDocs } = this.firestoreMethods;
    const savesRef = collection(this.firestore, 'posts', postId, 'saves');
    let q = query(savesRef, orderBy('savedAt', 'desc'), limit(pageSize));
    if (cursor) {
      q = query(q, startAfter(cursor));
    }
    const snapshot = await getDocs(q);
    const saves = snapshot.docs.map(doc => ({ userId: doc.id, ...doc.data() }));
    const lastDoc = snapshot.docs[snapshot.docs.length - 1];
    const nextCursor = lastDoc || null;
    return { saves, nextCursor, hasMore: snapshot.docs.length === pageSize };
  }

  async getPostGifts(postId, options = {}) {
    await this.ensureInitialized();
    const { limit: pageSize = 20, startAfter: cursor } = options;
    const { collection, query, orderBy, limit, startAfter, getDocs } = this.firestoreMethods;
    const giftsRef = collection(this.firestore, 'posts', postId, 'gifts');
    let q = query(giftsRef, orderBy('sentAt', 'desc'), limit(pageSize));
    if (cursor) {
      q = query(q, startAfter(cursor));
    }
    const snapshot = await getDocs(q);
    const gifts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    const lastDoc = snapshot.docs[snapshot.docs.length - 1];
    const nextCursor = lastDoc || null;
    return { gifts, nextCursor, hasMore: snapshot.docs.length === pageSize };
  }

  async getPollVotes(postId, options = {}) {
    await this.ensureInitialized();
    const { limit: pageSize = 20, startAfter: cursor } = options;
    const { collection, query, orderBy, limit, startAfter, getDocs } = this.firestoreMethods;
    const votesRef = collection(this.firestore, 'posts', postId, 'pollVotes');
    let q = query(votesRef, orderBy('votedAt', 'desc'), limit(pageSize));
    if (cursor) {
      q = query(q, startAfter(cursor));
    }
    const snapshot = await getDocs(q);
    const votes = snapshot.docs.map(doc => ({ userId: doc.id, ...doc.data() }));
    const lastDoc = snapshot.docs[snapshot.docs.length - 1];
    const nextCursor = lastDoc || null;
    return { votes, nextCursor, hasMore: snapshot.docs.length === pageSize };
  }

  async getAnswers(postId, options = {}) {
    await this.ensureInitialized();
    const { limit: pageSize = 20, startAfter: cursor } = options;
    const { collection, query, orderBy, limit, startAfter, getDocs } = this.firestoreMethods;
    const answersRef = collection(this.firestore, 'posts', postId, 'answers');
    let q = query(answersRef, orderBy('createdAt', 'desc'), limit(pageSize));
    if (cursor) {
      q = query(q, startAfter(cursor));
    }
    const snapshot = await getDocs(q);
    const answers = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    const lastDoc = snapshot.docs[snapshot.docs.length - 1];
    const nextCursor = lastDoc || null;
    return { answers, nextCursor, hasMore: snapshot.docs.length === pageSize };
  }
}

// ==================== SINGLETON INSTANCE ====================
let firestoreServiceInstance = null;

function getFirestoreService() {
  if (!firestoreServiceInstance) {
    firestoreServiceInstance = new EnterpriseFirestoreService();
  }
  return firestoreServiceInstance;
}

const firestoreService = {
  initialize: () => getFirestoreService().initialize(),
  createPost: postData => getFirestoreService().createPost(postData),
  getPost: (postId, options) => getFirestoreService().getPost(postId, options),
  getPostsByUser: (userId, options) => getFirestoreService().getPostsByUser(userId, options),
  updatePost: (postId, updates) => getFirestoreService().updatePost(postId, updates),
  deletePost: (postId, userId) => getFirestoreService().deletePost(postId, userId),

  answerQuestion: (postId, userId, answerText, options) =>
    getFirestoreService().answerQuestion(postId, userId, answerText, options),

  likePost: (postId, userId) => getFirestoreService().likePost(postId, userId),
  sharePost: (postId, userId) => getFirestoreService().sharePost(postId, userId),
  savePost: (postId, userId) => getFirestoreService().savePost(postId, userId),
  sendGift: (postId, userId, giftType, coinValue) =>
    getFirestoreService().sendGift(postId, userId, giftType, coinValue),

  voteOnPoll: (postId, userId, optionIndex, isMultiple) =>
    getFirestoreService().voteOnPoll(postId, userId, optionIndex, isMultiple),

  recordPostView: (postId, userId, options) =>
    getFirestoreService().recordPostView(postId, userId, options),

  batchDeletePosts: (postIds, userId, isAdmin) =>
    getFirestoreService().batchDeletePosts(postIds, userId, isAdmin),

  invalidateBlockCache: (userId, blockedByUserId) =>
    getFirestoreService().invalidateBlockCache(userId, blockedByUserId),

  getPostLikes: (postId, options) => getFirestoreService().getPostLikes(postId, options),
  getPostSaves: (postId, options) => getFirestoreService().getPostSaves(postId, options),
  getPostGifts: (postId, options) => getFirestoreService().getPostGifts(postId, options),
  getPollVotes: (postId, options) => getFirestoreService().getPollVotes(postId, options),
  getAnswers: (postId, options) => getFirestoreService().getAnswers(postId, options),

  getService: getFirestoreService,
  clearCache: () => getFirestoreService().clearCache(),
  getStats: () => getFirestoreService().getStats(),
  ensureInitialized: () => getFirestoreService().ensureInitialized(),
};

export default firestoreService;
export { firestoreService, getFirestoreService };