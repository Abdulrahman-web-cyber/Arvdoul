// src/services/firestoreService.js - ARVDOUL ENTERPRISE PRO MAX V12
// 🚀 REAL-TIME SYNC • POST TYPE SUPPORT • PRODUCTION READY • ULTIMATE FIRESTORE WRAPPER
// 🔥 SMART MONETIZATION • ENTERPRISE • ALL POST TYPES WORKING • REAL FIREBASE FIX
// ✅ ADDED: Block checks, optimized batch operations, synchronizeTabs, improved LRU, enhanced error mapping

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
    // move to end (most recent)
    this.cache.delete(key);
    this.cache.set(key, entry);
    return entry.value;
  }

  set(key, value) {
    if (this.cache.size >= this.maxSize) {
      // remove oldest (first key)
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
    // Permission errors
    'permission-denied': 'You do not have permission to perform this action. Please sign in again.',
    'unauthenticated': 'Authentication required. Please sign in to continue.',
    
    // Not found errors
    'not-found': 'The requested document was not found.',
    'already-exists': 'Document already exists.',
    
    // Resource errors
    'resource-exhausted': 'Database quota exceeded. Please try again later.',
    'failed-precondition': 'Operation failed due to system state. Please refresh.',
    
    // Network errors
    'deadline-exceeded': 'Request timeout. Please check your connection.',
    'aborted': 'Operation was aborted.',
    'unavailable': 'Service temporarily unavailable.',
    'internal': 'Internal server error. Our team has been notified.',
    
    // Validation errors
    'invalid-argument': 'Invalid data provided.',
    'out-of-range': 'Value out of acceptable range.',
    'unimplemented': 'This operation is not available.',
    'data-loss': 'Data corruption detected.',
    'cancelled': 'Operation cancelled.',
    
    // Additional Firebase codes
    'already-exists': 'Document already exists.',
    'deadline-exceeded': 'Request timeout.',
    'resource-exhausted': 'Quota exceeded. Try again later.',
    'unauthenticated': 'Please sign in.',
    'permission-denied': 'Access denied.'
  };
  
  const code = error?.code || 'unknown';
  let message = errorMap[code] || defaultMessage || 'Database operation failed';
  
  // 🔥 MISSING INDEX SUGGESTION
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
    this.cache = new LRUCache(100, 60000); // 100 items, 60s TTL
    this.blockCache = new LRUCache(200, 5 * 60 * 1000); // 200 items, 5 min TTL
    this.subscriptions = new Map();
    this.retryAttempts = 3;
    this.isOnline = navigator.onLine;
    this.logger = console;
    
    // Firebase modules cache
    this.firestoreModule = null;
    this.firebaseApp = null;
    
    // Auto-initialize
    this.initialize().catch(err => {
      console.warn('Firestore service initialization warning:', err.message);
    });
    
    // Online/offline detection
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
      console.log('🚀 Initializing Enterprise Firestore Service...');
      
      // Dynamic imports for optimal loading
      this.firebaseApp = await import('../firebase/firebase.js');
      
      // Get Firestore instance FIRST
      this.firestore = await this.firebaseApp.getFirestoreInstance();
      
      if (!this.firestore) {
        throw new Error('Failed to get Firestore instance');
      }
      
      // Import Firestore modules
      this.firestoreModule = await import('firebase/firestore');
      const { 
        collection, 
        addDoc, 
        getDoc, 
        getDocs, 
        updateDoc, 
        deleteDoc,
        query, 
        where, 
        orderBy, 
        limit, 
        startAfter,
        serverTimestamp,
        increment,
        arrayUnion,
        arrayRemove,
        doc,
        enableIndexedDbPersistence,
        runTransaction,
        writeBatch
      } = this.firestoreModule;
      
      // Store methods for easier access
      this.firestoreMethods = {
        collection, 
        addDoc, 
        getDoc, 
        getDocs, 
        updateDoc, 
        deleteDoc,
        query, 
        where, 
        orderBy, 
        limit, 
        startAfter,
        serverTimestamp,
        increment,
        arrayUnion,
        arrayRemove,
        doc,
        runTransaction,
        writeBatch
      };
      
      // Enable persistence for offline support with tab synchronization
      try {
        await enableIndexedDbPersistence(this.firestore, {
          synchronizeTabs: true  // ✅ Allows multiple tabs to share the same local database
        });
        console.log('✅ Firestore persistence enabled (synchronizeTabs)');
      } catch (persistenceError) {
        // If persistence is already enabled in another tab, we can still work (just no offline)
        if (persistenceError.code !== 'failed-precondition') {
          console.warn('⚠️ Firestore persistence warning:', persistenceError.message);
        } else {
          console.log('ℹ️ Firestore persistence already active in another tab');
        }
      }
      
      this.initialized = true;
      
      console.log('✅ Enterprise Firestore Service ready');
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
      return false; // Assume not blocked on error
    }
  }

  // Public method to invalidate block cache (can be called from other services)
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
        boost: postData.boostData?.type
      });
      
      // IMPORTANT: Get auth instance to verify user
      const auth = await this.getAuthInstance();
      const currentUser = auth.currentUser;
      
      if (!currentUser) {
        throw new Error('User not authenticated. Please sign in to create posts.');
      }
      
      // Verify authorId matches authenticated user
      if (postData.authorId !== currentUser.uid) {
        throw new Error(`authorId (${postData.authorId}) does not match authenticated user (${currentUser.uid})`);
      }
      
      const { 
        collection, 
        addDoc, 
        serverTimestamp, 
        increment,
        arrayUnion 
      } = this.firestoreMethods;
      
      // Validate required fields
      if (!postData.authorId) {
        throw new Error('authorId is required');
      }
      
      // Prepare post document based on type
      const postDoc = {
        // Core data
        type: postData.type,
        content: postData.content || '',
        media: postData.media || [],
        authorId: postData.authorId,
        authorName: postData.authorName || 'Arvdoul User',
        authorUsername: postData.authorUsername || `user_${postData.authorId?.slice(0, 8)}`,
        authorPhoto: postData.authorPhoto || "/assets/default-profile.png",
        
        // Post type specific data
        ...(postData.type === 'poll' && { poll: postData.poll }),
        ...(postData.type === 'question' && { question: postData.question, answers: postData.answers || [] }),
        ...(postData.type === 'link' && { link: postData.link }),
        ...(postData.type === 'event' && { event: postData.event }),
        
        // Settings
        visibility: postData.visibility || 'public',
        enableComments: postData.enableComments !== false,
        enableGifts: postData.enableGifts !== false,
        location: postData.location || null,
        tags: postData.tags || [],
        hashtags: this.extractHashtags(postData.content),
        
        // NEW: background image & text color
        backgroundImage: postData.backgroundImage || null,
        textColor: postData.textColor || (postData.type === 'text' ? '#000000' : null),
        
        // Status
        status: postData.status || 'published',
        isDeleted: false,
        
        // Monetization
        monetization: postData.monetization || null,
        
        // Boost
        boostData: postData.boostData || null,
        
        // Scheduling
        scheduledTime: postData.scheduledTime || null,
        publishedAt: postData.status === 'published' ? serverTimestamp() : null,
        
        // Statistics
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
          ...postData.stats
        },
        
        // Engagement
        likedBy: [],
        savedBy: [],
        gifts: [],
        
        // Timestamps
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        
        // System metadata
        version: 'v3',
        _operationId: operationId,
        _clientCreatedAt: new Date().toISOString()
      };
      
      // Add to Firestore
      const postsRef = collection(this.firestore, 'posts');
      const docRef = await addDoc(postsRef, postDoc);
      
      const postId = docRef.id;
      
      console.log('✅ Post created successfully:', {
        id: postId,
        type: postData.type,
        author: postData.authorUsername,
        path: `posts/${postId}`
      });
      
      // Update user stats (async, don't block)
      this.updateUserPostCount(postData.authorId).catch(err => {
        console.warn('Failed to update user stats:', err);
      });
      
      // Cache the post
      this.cache.set(postId, {
        ...postDoc,
        id: postId,
        _cachedAt: Date.now()
      });
      
      // Invalidate user posts cache
      this.invalidateCachePattern(`user_posts_${postData.authorId}`);
      
      return {
        success: true,
        postId: postId,
        post: { ...postDoc, id: postId },
        operationId,
        duration: Date.now() - startTime
      };
      
    } catch (error) {
      console.error('❌ Create post failed:', error);
      
      const enhancedError = enhanceError(error, 'Failed to create post');
      
      // Check for specific Firestore errors
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
    
    // Check cache first
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
        return { 
          success: false, 
          error: 'Post not found', 
          code: 'not-found',
          postId 
        };
      }
      
      const postData = { 
        id: postSnap.id, 
        ...postSnap.data()
      };
      
      // Cache the post
      this.cache.set(postId, { ...postData, _cachedAt: Date.now() });
      
      return { success: true, post: postData, cached: false };
      
    } catch (error) {
      console.error(`❌ Get post failed for ${postId}:`, error);
      return { 
        success: false, 
        error: enhanceError(error, 'Failed to fetch post').message,
        code: error.code || 'unknown'
      };
    }
  }

  async getPostsByUser(userId, options = {}) {
    await this.ensureInitialized();
    
    const cacheKey = `user_posts_${userId}_${JSON.stringify(options)}`;
    
    // Check cache
    if (options.cacheFirst !== false) {
      const cached = this.cache.get(cacheKey);
      if (cached) {
        return { success: true, posts: cached.posts, cached: true };
      }
    }
    
    try {
      const { collection, query, where, getDocs, orderBy, limit, startAfter } = this.firestoreMethods;
      
      const postsRef = collection(this.firestore, 'posts');
      
      // Build query
      const conditions = [
        where('authorId', '==', userId),
        where('isDeleted', '==', false),
        orderBy('createdAt', 'desc')
      ];
      
      if (options.status) {
        conditions.push(where('status', '==', options.status));
      }
      
      if (options.type) {
        conditions.push(where('type', '==', options.type));
      }
      
      if (options.limit) {
        conditions.push(limit(options.limit));
      }
      
      if (options.startAfter) {
        conditions.push(startAfter(options.startAfter));
      }
      
      const q = query(postsRef, ...conditions);
      const querySnapshot = await getDocs(q);
      
      const posts = [];
      querySnapshot.forEach(doc => {
        const data = doc.data();
        posts.push({ 
          id: doc.id, 
          ...data
        });
      });
      
      // Cache results
      this.cache.set(cacheKey, {
        posts,
        _cachedAt: Date.now(),
        _count: posts.length
      });
      
      return {
        success: true,
        posts,
        hasMore: options.limit ? posts.length === options.limit : false,
        total: posts.length,
        cached: false
      };
      
    } catch (error) {
      console.error(`❌ Get user posts failed for ${userId}:`, error);
      
      // For development, return empty array on permission errors BUT log it
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
        _clientUpdatedAt: new Date().toISOString()
      };
      
      await updateDoc(postRef, updateData);
      
      // Invalidate cache
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
      
      // Soft delete
      await updateDoc(postRef, {
        isDeleted: true,
        deletedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        status: 'deleted',
        deletedBy: userId
      });
      
      // Update user stats
      await this.updateUserPostCount(userId, -1).catch(console.warn);
      
      // Invalidate cache
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

      // Run transaction to ensure atomic increment and answer storage
      const result = await runTransaction(this.firestore, async (transaction) => {
        const postSnap = await transaction.get(postRef);
        if (!postSnap.exists()) {
          throw new Error('Post not found');
        }

        const postData = postSnap.data();
        if (postData.type !== 'question') {
          throw new Error('Post is not a question');
        }

        // Optionally store the answer in a subcollection for history (scales to billions)
        const answersRef = collection(this.firestore, 'posts', postId, 'answers');
        const answerDocRef = doc(answersRef);
        transaction.set(answerDocRef, {
          userId,
          answer: answerText,
          createdAt: serverTimestamp(),
          ...(options.metadata || {})
        });

        // Increment answer count
        transaction.update(postRef, {
          'stats.answerCount': increment(1),
          updatedAt: serverTimestamp()
        });

        // Return updated stats
        const newStats = {
          ...postData.stats,
          answerCount: (postData.stats?.answerCount || 0) + 1
        };
        return { newStats };
      });

      // Invalidate cache
      this.cache.delete(postId);

      return {
        success: true,
        postId,
        stats: result.newStats
      };

    } catch (error) {
      console.error(`❌ Answer question failed for ${postId}:`, error);
      throw enhanceError(error, 'Failed to submit answer');
    }
  }

  // ==================== POST INTERACTIONS (with block checks) ====================
  async likePost(postId, userId) {
    await this.ensureInitialized();
    
    // Pre-check block status (fast rejection)
    const post = await this.getPost(postId, { cacheFirst: true });
    if (post.success && await this._isBlocked(userId, post.post.authorId)) {
      throw enhanceError({ code: 'permission-denied' }, 'You are blocked by the post author');
    }
    
    try {
      const { doc, runTransaction, increment, serverTimestamp } = this.firestoreMethods;
      
      const postRef = doc(this.firestore, 'posts', postId);
      
      const result = await runTransaction(this.firestore, async (transaction) => {
        const postSnap = await transaction.get(postRef);
        if (!postSnap.exists()) throw new Error('Post not found');
        const postData = postSnap.data();
        
        // Re-check block inside transaction to ensure consistency
        if (await this._isBlocked(userId, postData.authorId)) {
          throw new Error('You are blocked by the post author');
        }
        
        // Check if already liked
        if (postData.likedBy?.includes(userId)) {
          // Unlike: decrement
          transaction.update(postRef, {
            'stats.likes': increment(-1),
            likedBy: this.firestoreMethods.arrayRemove(userId),
            updatedAt: serverTimestamp()
          });
          const newStats = {
            ...postData.stats,
            likes: Math.max((postData.stats?.likes || 0) - 1, 0)
          };
          return { action: 'unliked', stats: newStats };
        } else {
          // Like
          transaction.update(postRef, {
            'stats.likes': increment(1),
            likedBy: this.firestoreMethods.arrayUnion(userId),
            updatedAt: serverTimestamp()
          });
          const newStats = {
            ...postData.stats,
            likes: (postData.stats?.likes || 0) + 1
          };
          return { action: 'liked', stats: newStats };
        }
      });
      
      // Invalidate cache
      this.cache.delete(postId);
      
      return { success: true, ...result };
      
    } catch (error) {
      console.error(`❌ Like post failed for ${postId}:`, error);
      throw enhanceError(error, 'Failed to like post');
    }
  }

  async sharePost(postId, userId) {
    await this.ensureInitialized();
    
    // Pre-check block status
    const post = await this.getPost(postId, { cacheFirst: true });
    if (post.success && await this._isBlocked(userId, post.post.authorId)) {
      throw enhanceError({ code: 'permission-denied' }, 'You are blocked by the post author');
    }
    
    try {
      const { collection, addDoc, doc, runTransaction, increment, serverTimestamp } = this.firestoreMethods;
      
      const postRef = doc(this.firestore, 'posts', postId);
      
      const result = await runTransaction(this.firestore, async (transaction) => {
        const postSnap = await transaction.get(postRef);
        if (!postSnap.exists()) throw new Error('Post not found');
        const postData = postSnap.data();
        
        // Re-check block
        if (await this._isBlocked(userId, postData.authorId)) {
          throw new Error('You are blocked by the post author');
        }
        
        transaction.update(postRef, {
          'stats.shares': increment(1),
          updatedAt: serverTimestamp()
        });
        
        // Create share record (optional)
        const sharesRef = collection(this.firestore, 'shares');
        const shareDocRef = doc(sharesRef);
        transaction.set(shareDocRef, {
          postId,
          userId,
          sharedAt: serverTimestamp(),
          createdAt: serverTimestamp()
        });
        
        const newStats = {
          ...postData.stats,
          shares: (postData.stats?.shares || 0) + 1
        };
        return { stats: newStats, shareId: shareDocRef.id };
      });
      
      // Invalidate cache
      this.cache.delete(postId);
      
      return { success: true, ...result };
      
    } catch (error) {
      console.error(`❌ Share post failed for ${postId}:`, error);
      throw enhanceError(error, 'Failed to share post');
    }
  }

  async savePost(postId, userId) {
    await this.ensureInitialized();
    
    // Pre-check block status
    const post = await this.getPost(postId, { cacheFirst: true });
    if (post.success && await this._isBlocked(userId, post.post.authorId)) {
      throw enhanceError({ code: 'permission-denied' }, 'You are blocked by the post author');
    }
    
    try {
      const { doc, runTransaction, increment, arrayUnion, serverTimestamp } = this.firestoreMethods;
      
      const postRef = doc(this.firestore, 'posts', postId);
      
      const result = await runTransaction(this.firestore, async (transaction) => {
        const postSnap = await transaction.get(postRef);
        if (!postSnap.exists()) throw new Error('Post not found');
        const postData = postSnap.data();
        
        // Re-check block
        if (await this._isBlocked(userId, postData.authorId)) {
          throw new Error('You are blocked by the post author');
        }
        
        // Toggle save (if already saved, unsave)
        if (postData.savedBy?.includes(userId)) {
          transaction.update(postRef, {
            'stats.saves': increment(-1),
            savedBy: this.firestoreMethods.arrayRemove(userId),
            updatedAt: serverTimestamp()
          });
          const newStats = {
            ...postData.stats,
            saves: Math.max((postData.stats?.saves || 0) - 1, 0)
          };
          return { action: 'unsaved', stats: newStats };
        } else {
          transaction.update(postRef, {
            'stats.saves': increment(1),
            savedBy: arrayUnion(userId),
            updatedAt: serverTimestamp()
          });
          const newStats = {
            ...postData.stats,
            saves: (postData.stats?.saves || 0) + 1
          };
          return { action: 'saved', stats: newStats };
        }
      });
      
      // Invalidate cache
      this.cache.delete(postId);
      
      return { success: true, ...result };
      
    } catch (error) {
      console.error(`❌ Save post failed for ${postId}:`, error);
      throw enhanceError(error, 'Failed to save post');
    }
  }

  async sendGift(postId, userId, giftType, coinValue) {
    await this.ensureInitialized();
    
    // Pre-check block status
    const post = await this.getPost(postId, { cacheFirst: true });
    if (post.success && await this._isBlocked(userId, post.post.authorId)) {
      throw enhanceError({ code: 'permission-denied' }, 'You are blocked by the post author');
    }
    
    try {
      const { collection, addDoc, doc, runTransaction, increment, arrayUnion, serverTimestamp } = this.firestoreMethods;
      
      const postRef = doc(this.firestore, 'posts', postId);
      
      const result = await runTransaction(this.firestore, async (transaction) => {
        const postSnap = await transaction.get(postRef);
        if (!postSnap.exists()) throw new Error('Post not found');
        const postData = postSnap.data();
        
        // Re-check block
        if (await this._isBlocked(userId, postData.authorId)) {
          throw new Error('You are blocked by the post author');
        }
        
        // Prepare gift data
        const giftData = {
          userId,
          giftType,
          coinValue,
          sentAt: serverTimestamp()
        };
        
        transaction.update(postRef, {
          'stats.gifts': increment(1),
          'stats.giftValue': increment(coinValue),
          gifts: arrayUnion(giftData),
          updatedAt: serverTimestamp()
        });
        
        // Create gift transaction
        const giftsRef = collection(this.firestore, 'gift_transactions');
        const giftTxRef = doc(giftsRef);
        transaction.set(giftTxRef, {
          postId,
          fromUserId: userId,
          toUserId: postData.authorId,
          giftType,
          coinValue,
          sentAt: serverTimestamp(),
          status: 'completed',
          createdAt: serverTimestamp()
        });
        
        const newStats = {
          ...postData.stats,
          gifts: (postData.stats?.gifts || 0) + 1,
          giftValue: (postData.stats?.giftValue || 0) + coinValue
        };
        return { stats: newStats, giftId: giftTxRef.id };
      });
      
      // Invalidate cache
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
    
    // Pre-check block status
    const post = await this.getPost(postId, { cacheFirst: true });
    if (post.success && await this._isBlocked(userId, post.post.authorId)) {
      throw enhanceError({ code: 'permission-denied' }, 'You are blocked by the post author');
    }
    
    try {
      const { doc, runTransaction, increment, serverTimestamp } = this.firestoreMethods;
      
      const postRef = doc(this.firestore, 'posts', postId);
      
      const result = await runTransaction(this.firestore, async (transaction) => {
        const postSnap = await transaction.get(postRef);
        if (!postSnap.exists()) throw new Error('Post not found');
        const postData = postSnap.data();
        
        if (postData.type !== 'poll') {
          throw new Error('Post is not a poll');
        }
        
        // Re-check block
        if (await this._isBlocked(userId, postData.authorId)) {
          throw new Error('You are blocked by the post author');
        }
        
        // Check if user already voted
        const hasVoted = postData.poll?.votes?.some(vote => vote.userId === userId);
        
        if (!isMultiple && hasVoted) {
          throw new Error('You have already voted on this poll');
        }
        
        // Update poll data
        const votes = [...(postData.poll?.votes || [])];
        votes.push({
          userId,
          optionIndex,
          votedAt: serverTimestamp()
        });
        
        // Update poll option votes
        const pollOptions = [...(postData.poll?.options || [])];
        if (pollOptions[optionIndex]) {
          pollOptions[optionIndex] = {
            ...pollOptions[optionIndex],
            votes: (pollOptions[optionIndex].votes || 0) + 1
          };
        }
        
        transaction.update(postRef, {
          'poll.votes': votes,
          'poll.options': pollOptions,
          'poll.totalVotes': increment(1),
          'stats.pollVotes': increment(1),
          updatedAt: serverTimestamp()
        });
        
        const newStats = {
          ...postData.stats,
          pollVotes: (postData.stats?.pollVotes || 0) + 1
        };
        return { stats: newStats };
      });
      
      // Invalidate cache
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

    // If a user is viewing, check block status first (fast rejection)
    if (userId) {
      const post = await this.getPost(postId, { cacheFirst: true });
      if (post.success && await this._isBlocked(userId, post.post.authorId)) {
        // Blocked: do not record view
        return { success: false, error: 'You are blocked by the post author', blocked: true };
      }
    }

    try {
      const { doc, runTransaction, increment, serverTimestamp } = this.firestoreMethods;

      const postRef = doc(this.firestore, 'posts', postId);

      const trackUnique = options.trackUnique !== false && userId; // default true if userId provided

      const result = await runTransaction(this.firestore, async (transaction) => {
        const postSnap = await transaction.get(postRef);
        if (!postSnap.exists()) throw new Error('Post not found');
        const postData = postSnap.data();

        // Re-check block inside transaction to ensure consistency
        if (userId && await this._isBlocked(userId, postData.authorId)) {
          throw new Error('You are blocked by the post author');
        }

        let alreadyViewed = false;
        if (trackUnique && userId) {
          // Check if this user already viewed
          const viewRef = doc(this.firestore, 'posts', postId, 'views', userId);
          const viewSnap = await transaction.get(viewRef);
          if (viewSnap.exists()) {
            alreadyViewed = true;
          } else {
            // Record the view
            transaction.set(viewRef, {
              userId,
              viewedAt: serverTimestamp(),
              ...(options.metadata || {})
            });
          }
        }

        if (!alreadyViewed) {
          transaction.update(postRef, {
            'stats.views': increment(1),
            updatedAt: serverTimestamp()
          });
        }

        const newStats = {
          ...postData.stats,
          views: (postData.stats?.views || 0) + (alreadyViewed ? 0 : 1)
        };
        return { stats: newStats, alreadyViewed };
      });

      // Optionally invalidate cache only if count changed
      if (!result.alreadyViewed) {
        this.cache.delete(postId);
      }

      return { success: true, ...result };

    } catch (error) {
      console.error(`❌ Record view failed for ${postId}:`, error);
      // If error is due to block, return a friendly message
      if (error.message.includes('blocked')) {
        return { success: false, error: 'You are blocked by the post author', blocked: true };
      }
      throw enhanceError(error, 'Failed to record view');
    }
  }

  // ==================== BATCH OPERATIONS (OPTIMIZED) ====================
  async batchDeletePosts(postIds, userId, isAdmin = false) {
    await this.ensureInitialized();

    if (!Array.isArray(postIds) || postIds.length === 0) {
      throw new Error('postIds must be a non-empty array');
    }

    // Firestore batch can contain up to 500 writes
    const BATCH_LIMIT = 500;
    if (postIds.length > BATCH_LIMIT) {
      throw new Error(`Cannot delete more than ${BATCH_LIMIT} posts in one batch`);
    }

    try {
      const { writeBatch, doc, serverTimestamp, collection, query, where, getDocs } = this.firestoreMethods;
      const batch = writeBatch(this.firestore);

      const authorCounts = new Map(); // authorId -> delta (negative)

      // If not admin, we need to verify ownership. Fetch posts in chunks of 10 using `in` queries.
      if (!isAdmin) {
        const postMap = new Map(); // postId -> postData
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

        // Verify ownership for each post
        for (const postId of postIds) {
          const postData = postMap.get(postId);
          if (!postData) {
            console.warn(`Post ${postId} not found or already deleted, skipping`);
            continue;
          }
          if (postData.authorId !== userId) {
            throw new Error(`You do not own post ${postId}`);
          }
          // Track for updating user stats
          const current = authorCounts.get(postData.authorId) || 0;
          authorCounts.set(postData.authorId, current - 1);

          // Add to batch
          const postRef = doc(this.firestore, 'posts', postId);
          batch.update(postRef, {
            isDeleted: true,
            deletedAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            status: 'deleted',
            deletedBy: userId
          });

          // Invalidate cache for this post
          this.cache.delete(postId);
        }
      } else {
        // Admin: no ownership check, just mark as deleted
        for (const postId of postIds) {
          const postRef = doc(this.firestore, 'posts', postId);
          batch.update(postRef, {
            isDeleted: true,
            deletedAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            status: 'deleted',
            deletedBy: 'system'
          });
          this.cache.delete(postId);
        }
      }

      await batch.commit();

      // Update user stats for non-admin deletions
      if (!isAdmin) {
        for (const [authorId, delta] of authorCounts.entries()) {
          await this.updateUserPostCount(authorId, delta).catch(console.warn);
        }
      }

      // Invalidate user posts caches for affected authors
      const authorsToInvalidate = isAdmin ? [] : Array.from(authorCounts.keys());
      for (const authorId of authorsToInvalidate) {
        this.invalidateCachePattern(`user_posts_${authorId}`);
      }

      return {
        success: true,
        deletedCount: postIds.length,
        operation: 'batch_delete'
      };

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
        updatedAt: serverTimestamp()
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
    // LRU cache automatically handles TTL; we can optionally force cleanup
    // Not needed for LRU
  }

  getStats() {
    return {
      cacheSize: this.cache.size,
      blockCacheSize: this.blockCache.size,
      subscriptions: this.subscriptions.size,
      initialized: this.initialized,
      online: this.isOnline,
      firestoreMethods: Object.keys(this.firestoreMethods || {})
    };
  }

  clearCache() {
    this.cache.clear();
    this.blockCache.clear();
    console.log('🧹 Firestore cache cleared');
  }

  destroy() {
    // Clear all subscriptions
    for (const unsubscribe of this.subscriptions.values()) {
      try {
        unsubscribe();
      } catch (error) {
        console.warn('Error unsubscribing:', error);
      }
    }
    this.subscriptions.clear();
    
    // Clear cache
    this.clearCache();
    
    // Reset state
    this.initialized = false;
    this.firestore = null;
    this.firestoreMethods = null;
    this.firebaseApp = null;
    
    console.log('🔥 Firestore service destroyed');
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

// ==================== COMPATIBILITY EXPORTS ====================
const firestoreService = {
  // Initialization
  initialize: () => getFirestoreService().initialize(),
  
  // Post Operations
  createPost: (postData) => getFirestoreService().createPost(postData),
  getPost: (postId, options) => getFirestoreService().getPost(postId, options),
  getPostsByUser: (userId, options) => getFirestoreService().getPostsByUser(userId, options),
  updatePost: (postId, updates) => getFirestoreService().updatePost(postId, updates),
  deletePost: (postId, userId) => getFirestoreService().deletePost(postId, userId),
  
  // Answer Operations
  answerQuestion: (postId, userId, answerText, options) => 
    getFirestoreService().answerQuestion(postId, userId, answerText, options),
  
  // Post Interactions (return stats)
  likePost: (postId, userId) => getFirestoreService().likePost(postId, userId),
  sharePost: (postId, userId) => getFirestoreService().sharePost(postId, userId),
  savePost: (postId, userId) => getFirestoreService().savePost(postId, userId),
  sendGift: (postId, userId, giftType, coinValue) => 
    getFirestoreService().sendGift(postId, userId, giftType, coinValue),
  
  // Poll Operations
  voteOnPoll: (postId, userId, optionIndex, isMultiple) => 
    getFirestoreService().voteOnPoll(postId, userId, optionIndex, isMultiple),
  
  // Analytics
  recordPostView: (postId, userId, options) => 
    getFirestoreService().recordPostView(postId, userId, options),
  
  // Batch Operations
  batchDeletePosts: (postIds, userId, isAdmin) => 
    getFirestoreService().batchDeletePosts(postIds, userId, isAdmin),
  
  // Block cache invalidation
  invalidateBlockCache: (userId, blockedByUserId) => 
    getFirestoreService().invalidateBlockCache(userId, blockedByUserId),
  
  // Service instance
  getService: getFirestoreService,
  
  // Utilities
  clearCache: () => getFirestoreService().clearCache(),
  getStats: () => getFirestoreService().getStats(),
  
  // Ensure initialized
  ensureInitialized: () => getFirestoreService().ensureInitialized()
};

// Export as default AND named export
export default firestoreService;
export { firestoreService, getFirestoreService };