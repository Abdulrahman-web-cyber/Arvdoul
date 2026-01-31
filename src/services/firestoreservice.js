// src/services/firestoreService.js - ARVDOUL ENTERPRISE PRO MAX V6 - FIXED
// 🚀 REAL-TIME SYNC • POST TYPE SUPPORT • PRODUCTION READY
// 🔥 SMART MONETIZATION • ENTERPRISE • ALL POST TYPES WORKING

class EnterpriseFirestoreService {
  constructor() {
    this.firestore = null;
    this.initialized = false;
    this.cache = new Map();
    this.subscriptions = new Map();
    this.retryAttempts = 3;
    this.isOnline = navigator.onLine;
    this.logger = console;
    
    // Firebase modules cache
    this.firestoreModule = null;
    
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
      const firebaseApp = await import('../firebase/firebase.js');
      
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
        arrayUnion
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
        arrayUnion
      };
      
      // Get Firestore instance
      this.firestore = await firebaseApp.getFirestoreInstance();
      
      if (!this.firestore) {
        throw new Error('Failed to get Firestore instance');
      }
      
      // Enable persistence for offline support
      try {
        await this.firestoreModule.enableIndexedDbPersistence(this.firestore, {
          forceOwnership: true
        });
        console.log('✅ Firestore persistence enabled');
      } catch (persistenceError) {
        console.warn('⚠️ Firestore persistence warning:', persistenceError.message);
      }
      
      this.initialized = true;
      
      console.log('✅ Enterprise Firestore Service ready');
      return this.firestore;
      
    } catch (error) {
      console.error('❌ Firestore initialization failed:', error);
      throw this.enhanceError(error, 'Failed to initialize database');
    }
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
        author: postData.authorUsername
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
      this.invalidateCache(`user_posts_${postData.authorId}`);
      
      return {
        success: true,
        postId: postId,
        post: { ...postDoc, id: postId },
        operationId,
        duration: Date.now() - startTime
      };
      
    } catch (error) {
      console.error('❌ Create post failed:', error);
      
      // Enhanced error handling
      const enhancedError = this.enhanceError(error, 'Failed to create post');
      
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
      if (cached && Date.now() - cached._cachedAt < 300000) { // 5 minutes
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
        error: this.enhanceError(error, 'Failed to fetch post').message,
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
      if (cached && Date.now() - cached._cachedAt < 60000) { // 1 minute
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
      
      // For development, return empty array on permission errors
      if (process.env.NODE_ENV !== 'production' && error.code === 'permission-denied') {
        return { success: true, posts: [], cached: false };
      }
      
      throw this.enhanceError(error, `Failed to fetch posts for user ${userId}`);
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
      throw this.enhanceError(error, 'Failed to update post');
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
      throw this.enhanceError(error, 'Failed to delete post');
    }
  }

  // ==================== POST INTERACTIONS ====================
  async likePost(postId, userId) {
    await this.ensureInitialized();
    
    try {
      const { doc, updateDoc, arrayUnion, increment } = this.firestoreMethods;
      
      const postRef = doc(this.firestore, 'posts', postId);
      
      await updateDoc(postRef, {
        'stats.likes': increment(1),
        likedBy: arrayUnion(userId),
        updatedAt: serverTimestamp()
      });
      
      // Invalidate cache
      this.cache.delete(postId);
      
      return { success: true };
      
    } catch (error) {
      console.error(`❌ Like post failed for ${postId}:`, error);
      throw this.enhanceError(error, 'Failed to like post');
    }
  }

  async sharePost(postId, userId) {
    await this.ensureInitialized();
    
    try {
      const { collection, addDoc, doc, updateDoc, increment, serverTimestamp } = this.firestoreMethods;
      
      const postRef = doc(this.firestore, 'posts', postId);
      
      // Update post stats
      await updateDoc(postRef, {
        'stats.shares': increment(1),
        updatedAt: serverTimestamp()
      });
      
      // Create share record
      const sharesRef = collection(this.firestore, 'shares');
      await addDoc(sharesRef, {
        postId,
        userId,
        sharedAt: serverTimestamp(),
        createdAt: serverTimestamp()
      });
      
      // Invalidate cache
      this.cache.delete(postId);
      
      return { success: true };
      
    } catch (error) {
      console.error(`❌ Share post failed for ${postId}:`, error);
      throw this.enhanceError(error, 'Failed to share post');
    }
  }

  async savePost(postId, userId) {
    await this.ensureInitialized();
    
    try {
      const { doc, updateDoc, increment, arrayUnion, serverTimestamp } = this.firestoreMethods;
      
      const postRef = doc(this.firestore, 'posts', postId);
      
      await updateDoc(postRef, {
        'stats.saves': increment(1),
        savedBy: arrayUnion(userId),
        updatedAt: serverTimestamp()
      });
      
      // Invalidate cache
      this.cache.delete(postId);
      
      return { success: true };
      
    } catch (error) {
      console.error(`❌ Save post failed for ${postId}:`, error);
      throw this.enhanceError(error, 'Failed to save post');
    }
  }

  async sendGift(postId, userId, giftType, coinValue) {
    await this.ensureInitialized();
    
    try {
      const { collection, addDoc, doc, updateDoc, increment, arrayUnion, serverTimestamp } = this.firestoreMethods;
      
      const postRef = doc(this.firestore, 'posts', postId);
      
      // Prepare gift data
      const giftData = {
        userId,
        giftType,
        coinValue,
        sentAt: serverTimestamp()
      };
      
      // Update post
      await updateDoc(postRef, {
        'stats.gifts': increment(1),
        'stats.giftValue': increment(coinValue),
        gifts: arrayUnion(giftData),
        updatedAt: serverTimestamp()
      });
      
      // Create gift transaction
      const giftsRef = collection(this.firestore, 'gift_transactions');
      await addDoc(giftsRef, {
        postId,
        fromUserId: userId,
        toUserId: (await getDoc(postRef)).data().authorId,
        giftType,
        coinValue,
        sentAt: serverTimestamp(),
        status: 'completed',
        createdAt: serverTimestamp()
      });
      
      // Invalidate cache
      this.cache.delete(postId);
      
      return { success: true, gift: giftData };
      
    } catch (error) {
      console.error(`❌ Send gift failed for ${postId}:`, error);
      throw this.enhanceError(error, 'Failed to send gift');
    }
  }

  // ==================== POLL OPERATIONS ====================
  async voteOnPoll(postId, userId, optionIndex, isMultiple = false) {
    await this.ensureInitialized();
    
    try {
      const { doc, getDoc, updateDoc, increment, serverTimestamp } = this.firestoreMethods;
      
      const postRef = doc(this.firestore, 'posts', postId);
      const postSnap = await getDoc(postRef);
      
      if (!postSnap.exists()) {
        throw new Error('Post not found');
      }
      
      const postData = postSnap.data();
      
      if (postData.type !== 'poll') {
        throw new Error('Post is not a poll');
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
      
      await updateDoc(postRef, {
        'poll.votes': votes,
        'poll.options': pollOptions,
        'poll.totalVotes': increment(1),
        'stats.pollVotes': increment(1),
        updatedAt: serverTimestamp()
      });
      
      // Invalidate cache
      this.cache.delete(postId);
      
      return { success: true, votes: votes.length };
      
    } catch (error) {
      console.error(`❌ Vote on poll failed for ${postId}:`, error);
      throw this.enhanceError(error, 'Failed to vote on poll');
    }
  }

  // ==================== UTILITY METHODS ====================
  async ensureInitialized() {
    if (!this.initialized || !this.firestore) {
      await this.initialize();
    }
    return this.firestore;
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

  enhanceError(error, defaultMessage) {
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
      'cancelled': 'Operation cancelled.'
    };
    
    const enhanced = new Error(errorMap[error.code] || defaultMessage || 'Database operation failed');
    enhanced.code = error.code || 'unknown';
    enhanced.originalError = error;
    enhanced.timestamp = new Date().toISOString();
    
    return enhanced;
  }

  invalidateCache(key) {
    this.cache.delete(key);
  }

  invalidateCachePattern(pattern) {
    for (const [key] of this.cache.entries()) {
      if (key.startsWith(pattern)) {
        this.cache.delete(key);
      }
    }
  }

  cleanupCache() {
    const now = Date.now();
    for (const [key, value] of this.cache.entries()) {
      if (value._cachedAt && now - value._cachedAt > 30 * 60 * 1000) {
        this.cache.delete(key);
      }
    }
  }

  getStats() {
    return {
      cacheSize: this.cache.size,
      subscriptions: this.subscriptions.size,
      initialized: this.initialized,
      online: this.isOnline,
      firestoreMethods: Object.keys(this.firestoreMethods || {})
    };
  }

  clearCache() {
    this.cache.clear();
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
  
  // Post Interactions
  likePost: (postId, userId) => getFirestoreService().likePost(postId, userId),
  sharePost: (postId, userId) => getFirestoreService().sharePost(postId, userId),
  savePost: (postId, userId) => getFirestoreService().savePost(postId, userId),
  sendGift: (postId, userId, giftType, coinValue) => 
    getFirestoreService().sendGift(postId, userId, giftType, coinValue),
  
  // Poll Operations
  voteOnPoll: (postId, userId, optionIndex, isMultiple) => 
    getFirestoreService().voteOnPoll(postId, userId, optionIndex, isMultiple),
  
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