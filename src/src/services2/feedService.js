// src/services/feedService.js - ENTERPRISE PRODUCTION V16.7 - ULTIMATE HYBRID FEED ENGINE (FIXED)
// 🎲 ADDICTIVE FEED • PERSONALIZED • ADAPTIVE • HYBRID • EXPLORATION BOOST • ANTI‑STALE
// 🏠 BUILT ON V15.1 – PRESERVES RELIABILITY • ADDED RANDOMNESS • REMOTE CONFIG • TIMEOUT PROTECTION
// 💰 INTEGRATED WITH MONETIZATION SERVICE • BILLION‑USER READY
// 🔧 FIXED: Recursive initialization bug in _loadWeightsFromConfig

const FEED_CONFIG = {
  // Feed Types & Weights (base – overridden by Remote Config)
  FEED_TYPES: {
    FOLLOWING: 'following',
    FOR_YOU: 'for_you',
    TRENDING: 'trending',
    DISCOVER: 'discover',
    VIDEOS: 'videos',
    AUDIO: 'audio',
    NEARBY: 'nearby',
    PREMIUM: 'premium'
  },

  // Algorithm Settings
  ALGORITHM: {
    BASE_WEIGHTS: {
      following: 0.50,
      for_you: 0.25,
      trending: 0.15,
      discover: 0.05,
      videos: 0.03,
      audio: 0.01,
      nearby: 0.005,
      premium: 0.005
    },
    MAX_POSTS_PER_SOURCE: 20,
    MAX_TOTAL_FETCH: 100,
    DEFAULT_PAGE_LIMIT: 20,
    DIVERSITY_THRESHOLD: 0.7,
    FRESHNESS_DECAY: 0.95,
    ENGAGEMENT_BOOST: 1.5,
    REAL_TIME_UPDATE: 30000,
    MIN_SCORE_THRESHOLD: 0.1,
  },

  // 🔥 Controlled randomness settings
  RANDOMNESS: {
    EXPLORATION_BOOST: 0.08,       // fraction of posts that get a random score boost
    ANTI_STALE_PENALTY: 0.7,       // multiplier for posts already seen in feed history
    SESSION_VARIATION: true,        // vary feed per session
    AD_INTERVAL_RANDOM_RANGE: 1,    // +/-1 variation to ad interval
    MAX_RANDOM_POSTS_PER_PAGE: 3,   // max random exploration posts per page
  },

  // Monetization Settings
  MONETIZATION: {
    AD_INTERVAL: 4,
    SPONSORED_RATIO: 0.03,
    COIN_REWARD_INTERVAL: 15,
    MIN_VIEW_TIME: 5000,
    IMPRESSION_DELAY: 1000,
    AD_PLACEMENT: 'feed'
  },

  // Performance Settings
  PERFORMANCE: {
    CACHE_EXPIRY: 5 * 60 * 1000,
    PRELOAD_COUNT: 5,
    LAZY_LOAD_THRESHOLD: 2,
    MAX_CONCURRENT_FETCHES: 2,
    REQUEST_TIMEOUT: 8000,          // per source timeout
    BATCH_SIZE: 10,
    DEBOUNCE_TIME: 500,
    PAGE_CACHE_TTL: 3 * 60 * 1000,
    CONFIG_CACHE_TTL: 15 * 60 * 1000,
    PROFILE_CACHE_TTL: 15 * 60 * 1000,
    PREF_CACHE_TTL: 10 * 60 * 1000,
    BEHAVIOR_CACHE_TTL: 20 * 60 * 1000,
    MAX_CACHE_SIZE: 100,
  },

  // Content Diversity
  DIVERSITY: {
    MAX_SAME_USER: 1,
    MAX_SAME_TYPE: 3,
    MIX_PATTERN: ['image', 'video', 'text', 'poll', 'link', 'audio', 'event'],
    TOPIC_VARIETY: 4,
    MIN_CONTENT_AGE_HOURS: 24,
  },

  // Following Feed (fan-out) settings
  FOLLOWING_FEED: {
    COLLECTION: 'feeds',               // subcollection under users: users/{userId}/feeds
    MAX_FEED_SIZE: 1000,
  },

  // Block list cache TTL
  BLOCK_CACHE_TTL: 5 * 60 * 1000,

  // Debug mode (set to false in production)
  DEBUG: false,
};

class UltimateFeedService {
  constructor() {
    this.firestore = null;
    this.firestoreModule = null;
    this.initialized = false;

    // Caches
    this.cache = new Map();               // feed pages & metadata
    this.userFeedState = new Map();       // pagination cursors per user
    this.userPreferences = new Map();     // user prefs cache
    this.blockCache = new Map();          // blocked users per viewer
    this.configCache = { weights: null, timestamp: 0 }; // dynamic weights

    // Tracking
    this.engagementTracker = new Map();
    this.feedHistory = new Map();          // posts already shown per user (for anti‑stale)

    // Real‑time subscriptions
    this.realtimeSubscriptions = new Map();

    // Debounce & Rate limiting
    this.lastRequestTime = new Map();
    this.debounceTimers = new Map();

    // Algorithm version
    this.algorithmVersion = 'v16.7_hybrid_fixed';

    console.log('🏠 Ultimate Feed Service V16.7 - Hybrid Feed Engine (Fixed)');

    setTimeout(() => this.initialize().catch(err => {
      console.warn('Feed service initialization warning:', err.message);
    }), 1000);

    this._startEngagementTracker();
  }

  // ==================== INITIALIZATION ====================
  async initialize() {
    if (this.initialized) return this.firestore;
    try {
      const firebase = await import('../firebase/firebase.js');
      this.firestore = await firebase.getFirestoreInstance();
      const firestoreModule = await import('firebase/firestore');
      
      this.firestoreMethods = {
        collection: firestoreModule.collection,
        query: firestoreModule.query,
        where: firestoreModule.where,
        orderBy: firestoreModule.orderBy,
        limit: firestoreModule.limit,
        startAfter: firestoreModule.startAfter,
        getDocs: firestoreModule.getDocs,
        onSnapshot: firestoreModule.onSnapshot,
        doc: firestoreModule.doc,
        getDoc: firestoreModule.getDoc,
        increment: firestoreModule.increment,
        serverTimestamp: firestoreModule.serverTimestamp,
      };

      // Load dynamic weights (optional – if fails, defaults are used)
      // 🔥 FIX: Do NOT call _ensureInitialized here – it would cause recursion
      await this._loadWeightsFromConfig();

      this.initialized = true;
      console.log('✅ Feed Service V16.7 initialized');
      return this.firestore;
    } catch (error) {
      console.error('❌ Feed service init failed:', error);
      throw this._enhanceError(error);
    }
  }

  async _ensureInitialized() {
    if (!this.initialized) await this.initialize();
    return this.firestore;
  }

  // ==================== DYNAMIC WEIGHTS FROM REMOTE CONFIG ====================
  async _loadWeightsFromConfig(force = false) {
    const now = Date.now();
    if (!force && this.configCache.weights && (now - this.configCache.timestamp) < FEED_CONFIG.PERFORMANCE.CONFIG_CACHE_TTL) {
      return this.configCache.weights;
    }

    try {
      // 🔥 FIX: Directly use this.firestore and this.firestoreMethods – they are already set
      if (!this.firestore || !this.firestoreMethods) {
        throw new Error('Firestore not initialized yet');
      }
      const { doc, getDoc } = this.firestoreMethods;
      const configRef = doc(this.firestore, 'config', 'feed_weights');
      const configSnap = await getDoc(configRef);

      let weights = { ...FEED_CONFIG.ALGORITHM.BASE_WEIGHTS };
      if (configSnap.exists()) {
        const remote = configSnap.data();
        weights = { ...weights, ...remote };
        const total = Object.values(weights).reduce((s, w) => s + w, 0);
        if (Math.abs(total - 1) > 0.01) {
          Object.keys(weights).forEach(k => weights[k] /= total);
        }
      }

      this.configCache = { weights, timestamp: now };
      if (FEED_CONFIG.DEBUG) console.log('📊 Dynamic weights loaded:', weights);
      return weights;
    } catch (error) {
      console.warn('Failed to load weights from config, using defaults:', error);
      return FEED_CONFIG.ALGORITHM.BASE_WEIGHTS;
    }
  }

  // ==================== RATE LIMITING & DEBOUNCE ====================
  _canMakeRequest(userId, operation) {
    const key = `${userId}_${operation}`;
    const now = Date.now();
    const last = this.lastRequestTime.get(key) || 0;
    if (now - last < 1000) return false;
    this.lastRequestTime.set(key, now);
    return true;
  }

  _debounceOperation(key, operation, delay = FEED_CONFIG.PERFORMANCE.DEBOUNCE_TIME) {
    return new Promise((resolve) => {
      if (this.debounceTimers.has(key)) clearTimeout(this.debounceTimers.get(key));
      const timer = setTimeout(async () => {
        try { resolve(await operation()); } catch { resolve(null); }
      }, delay);
      this.debounceTimers.set(key, timer);
    });
  }

  // ==================== MAIN FEED GENERATION WITH PAGINATION ====================
  async getSmartFeed(userId, options = {}) {
    const startTime = Date.now();
    const operationId = `feed_${Date.now()}_${Math.random().toString(36).substr(2,9)}`;
    const limit = options.limit || FEED_CONFIG.ALGORITHM.DEFAULT_PAGE_LIMIT;
    const lastDoc = options.lastDoc || null;
    const forceRefresh = options.forceRefresh || false;
    const feedType = options.feedType || 'smart';

    // Overall timeout to prevent hanging
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Feed generation timeout after 15s')), 15000);
    });

    try {
      const result = await Promise.race([
        this._generateFeed(userId, options, startTime, operationId, limit, lastDoc, forceRefresh, feedType),
        timeoutPromise
      ]);
      return result;
    } catch (error) {
      console.error('❌ Feed generation failed (timeout or error):', error);
      const fallback = await this._getFallbackFeed(userId, { limit });
      return {
        success: true,
        feed: fallback.slice(0, limit),
        nextCursor: null,
        metadata: { isFallback: true, error: error.message },
        operationId,
        duration: Date.now() - startTime
      };
    }
  }

  async _generateFeed(userId, options, startTime, operationId, limit, lastDoc, forceRefresh, feedType) {
    if (FEED_CONFIG.DEBUG) console.log(`[${operationId}] Starting feed generation for ${userId}`);

    if (!forceRefresh && !this._canMakeRequest(userId, 'getSmartFeed')) {
      const cached = this._getPageFromCache(userId, limit, lastDoc);
      if (cached) return { ...cached, rateLimited: true, cached: true, operationId, duration: Date.now() - startTime };
    }

    await this._ensureInitialized();

    if (!forceRefresh) {
      const cached = this._getPageFromCache(userId, limit, lastDoc);
      if (cached) {
        return { ...cached, cached: true, operationId, duration: Date.now() - startTime };
      }
    }

    // 🔥 SESSION‑BASED SEED for randomness
    let sessionSeed = this.userFeedState.get(userId)?.sessionSeed;
    if (!sessionSeed || options.resetSession) {
      sessionSeed = Math.random();
      const state = this.userFeedState.get(userId) || {};
      state.sessionSeed = sessionSeed;
      this.userFeedState.set(userId, state);
    }

    const [userProfile, userPreferences, behaviorData] = await Promise.allSettled([
      this._getUserProfileCached(userId),
      this._getUserPreferencesCached(userId),
      this._getUserBehaviorCached(userId)
    ]).then(results => results.map(r => r.status === 'fulfilled' ? r.value : {}));

    const dynamicWeights = this._calculateDynamicWeights(userPreferences, behaviorData);

    const feedSources = await this._fetchOptimizedSources(userId, userPreferences, dynamicWeights, {
      ...options,
      limit,
      lastDoc: lastDoc ? this._decodeCursor(lastDoc) : null,
      feedType
    });

    if (FEED_CONFIG.DEBUG) {
      console.log(`[${operationId}] Sources fetched:`, Object.keys(feedSources).map(k => `${k}:${feedSources[k]?.length || 0}`));
    }

    // 🔥 SCORE POSTS WITH RANDOMNESS + ANTI‑STALE
    const scoredPosts = this._scoreAndRankPostsOptimized(feedSources, userId, userPreferences, dynamicWeights, sessionSeed);

    // 🔥 APPLY DIVERSITY + RANDOM EXPLORATION INJECTION
    const diversified = this._applyDiversityOptimized(scoredPosts, userId, limit, sessionSeed);

    // 🔥 MONETIZATION WITH PARALLEL ADS
    const monetizedFeed = await this._insertMonetizationOptimized(diversified, userId, options);

    const finalFeed = this._finalizeFeedOptimized(monetizedFeed, userId, options);
    const nextCursor = this._encodeCursor(finalFeed, feedSources);

    // Record seen posts for anti‑stale
    this._recordSeenPosts(userId, finalFeed);

    this._cachePage(userId, limit, lastDoc, {
      feed: finalFeed,
      nextCursor,
      metadata: {
        generatedAt: new Date().toISOString(),
        sourceCounts: this._countSources(feedSources),
        weights: dynamicWeights,
        algorithmVersion: this.algorithmVersion,
        page: lastDoc ? 'next' : 'first',
        sessionSeed,
      }
    });

    console.log(`✅ Feed generated for ${userId}`, {
      operationId,
      posts: finalFeed.length,
      hasNext: !!nextCursor,
      duration: Date.now() - startTime
    });

    return {
      success: true,
      feed: finalFeed,
      nextCursor,
      metadata: { operationId },
      operationId,
      duration: Date.now() - startTime
    };
  }

  // ==================== OPTIMIZED SOURCE FETCHING (unchanged from V15.1) ====================
  async _fetchOptimizedSources(userId, preferences, weights, options) {
    const sources = {};
    const { limit, lastDoc } = options;
    const pageLimit = Math.min(limit || 20, FEED_CONFIG.ALGORITHM.MAX_POSTS_PER_SOURCE);

    const sourcePromises = [];

    // Following feed now reads from user's feed subcollection (fan-out)
    if (weights.following > 0.15) {
      sourcePromises.push(
        this._getFollowingFeedFromUserFeed(userId, { ...options, limit: pageLimit, lastDoc: lastDoc?.sources?.following })
          .then(posts => { sources.following = posts; })
          .catch(err => { console.warn('Following feed error:', err); sources.following = []; })
      );
    }

    // For You feed – query posts with personalization score (precomputed)
    if (weights.for_you > 0.15) {
      sourcePromises.push(
        this._getForYouFeedPaginated(userId, preferences, { ...options, limit: pageLimit, lastDoc: lastDoc?.sources?.for_you })
          .then(posts => { sources.for_you = posts; })
          .catch(err => { console.warn('For you feed error:', err); sources.for_you = []; })
      );
    }

    // Trending feed – query posts with trendingScore (updated by cron)
    if (weights.trending > 0.1) {
      sourcePromises.push(
        this._getTrendingFeedPaginated(userId, { ...options, limit: pageLimit, lastDoc: lastDoc?.sources?.trending })
          .then(posts => { sources.trending = posts; })
          .catch(err => { console.warn('Trending feed error:', err); sources.trending = []; })
      );
    }

    // Discover feed – random/varied posts (can be a simple query)
    if (weights.discover > 0.05) {
      sourcePromises.push(
        this._getDiscoverFeedPaginated(userId, preferences, { ...options, limit: pageLimit, lastDoc: lastDoc?.sources?.discover })
          .then(posts => { sources.discover = posts; })
          .catch(err => { console.warn('Discover feed error:', err); sources.discover = []; })
      );
    }

    // Video feed – filter by type
    if (weights.videos > 0.05 && preferences?.postTypes?.video > 0.6) {
      sourcePromises.push(
        this._getVideoFeedPaginated(userId, { ...options, limit: pageLimit, lastDoc: lastDoc?.sources?.videos })
          .then(posts => { sources.videos = posts; })
          .catch(err => { console.warn('Video feed error:', err); sources.videos = []; })
      );
    }

    // Wrap each promise with a timeout (as in V15.1)
    const timedPromises = sourcePromises.map(p =>
      Promise.race([p, new Promise(resolve => setTimeout(() => resolve([]), FEED_CONFIG.PERFORMANCE.REQUEST_TIMEOUT))])
    );

    await Promise.allSettled(timedPromises);
    return sources;
  }

  // ---------- FOLLOWING FEED (unchanged: returns full post data) ----------
  async _getFollowingFeedFromUserFeed(userId, options) {
    try {
      await this._ensureInitialized();
      const { limit = 20, lastDoc } = options;
      const { collection, query, orderBy, limit: firestoreLimit, startAfter, getDocs } = this.firestoreMethods;

      const feedRef = collection(this.firestore, 'users', userId, 'feeds');

      let q = query(
        feedRef,
        orderBy('createdAt', 'desc'),
        firestoreLimit(limit)
      );

      if (lastDoc && lastDoc.lastId && lastDoc.lastCreatedAt) {
        q = query(
          feedRef,
          orderBy('createdAt', 'desc'),
          startAfter(new Date(lastDoc.lastCreatedAt)),
          firestoreLimit(limit)
        );
      }

      const snapshot = await getDocs(q);
      const posts = [];

      snapshot.forEach(doc => {
        const data = doc.data();
        posts.push({
          id: doc.id, // this is the post ID
          ...data,
          _source: 'following',
          _score: 1.0,
          createdAt: data.createdAt?.toDate?.() || new Date(data.createdAt),
          updatedAt: data.updatedAt?.toDate?.() || new Date(data.updatedAt)
        });
      });

      return posts;
    } catch (error) {
      console.warn('Following feed from user feed error:', error.message);
      return [];
    }
  }

  // ---------- FOR YOU FEED (unchanged) ----------
  async _getForYouFeedPaginated(userId, preferences, options) {
    try {
      await this._ensureInitialized();
      const blockedUsers = await this._getBlockedUsersCached(userId);
      const { limit = 20, lastDoc } = options;
      const { collection, query, where, orderBy, limit: firestoreLimit, startAfter, getDocs } = this.firestoreMethods;

      const postsRef = collection(this.firestore, 'posts');
      let q = query(
        postsRef,
        where('isDeleted', '==', false),
        where('status', '==', 'published'),
        where('visibility', '==', 'public'),
        where('personalizationScore', '>=', FEED_CONFIG.ALGORITHM.MIN_SCORE_THRESHOLD),
        orderBy('personalizationScore', 'desc'),
        orderBy('createdAt', 'desc'),
        firestoreLimit(limit)
      );

      if (lastDoc && lastDoc.lastScore !== undefined && lastDoc.lastCreatedAt) {
        q = query(
          postsRef,
          where('isDeleted', '==', false),
          where('status', '==', 'published'),
          where('visibility', '==', 'public'),
          where('personalizationScore', '>=', FEED_CONFIG.ALGORITHM.MIN_SCORE_THRESHOLD),
          orderBy('personalizationScore', 'desc'),
          orderBy('createdAt', 'desc'),
          startAfter(lastDoc.lastScore, new Date(lastDoc.lastCreatedAt)),
          firestoreLimit(limit)
        );
      }

      const snapshot = await getDocs(q);
      const posts = [];

      snapshot.forEach(doc => {
        const data = doc.data();
        if (blockedUsers.has(data.authorId)) return;
        posts.push({
          id: doc.id,
          ...data,
          _source: 'for_you',
          _score: data.personalizationScore || 0.5,
          createdAt: data.createdAt?.toDate?.() || new Date(),
          updatedAt: data.updatedAt?.toDate?.() || new Date()
        });
      });

      return posts;
    } catch (error) {
      console.warn('For you feed error:', error.message);
      return [];
    }
  }

  // ---------- TRENDING FEED (unchanged) ----------
  async _getTrendingFeedPaginated(userId, options) {
    try {
      await this._ensureInitialized();
      const blockedUsers = await this._getBlockedUsersCached(userId);
      const { limit = 20, lastDoc } = options;
      const { collection, query, where, orderBy, limit: firestoreLimit, startAfter, getDocs } = this.firestoreMethods;

      const postsRef = collection(this.firestore, 'posts');
      let q = query(
        postsRef,
        where('isDeleted', '==', false),
        where('status', '==', 'published'),
        where('visibility', '==', 'public'),
        where('trendingScore', '>', 0),
        orderBy('trendingScore', 'desc'),
        orderBy('createdAt', 'desc'),
        firestoreLimit(limit)
      );

      if (lastDoc && lastDoc.lastScore !== undefined && lastDoc.lastCreatedAt) {
        q = query(
          postsRef,
          where('isDeleted', '==', false),
          where('status', '==', 'published'),
          where('visibility', '==', 'public'),
          where('trendingScore', '>', 0),
          orderBy('trendingScore', 'desc'),
          orderBy('createdAt', 'desc'),
          startAfter(lastDoc.lastScore, new Date(lastDoc.lastCreatedAt)),
          firestoreLimit(limit)
        );
      }

      const snapshot = await getDocs(q);
      const posts = [];

      snapshot.forEach(doc => {
        const data = doc.data();
        if (blockedUsers.has(data.authorId)) return;
        posts.push({
          id: doc.id,
          ...data,
          _source: 'trending',
          _score: data.trendingScore || 0,
          createdAt: data.createdAt?.toDate?.() || new Date(),
          updatedAt: data.updatedAt?.toDate?.() || new Date()
        });
      });

      return posts;
    } catch (error) {
      console.warn('Trending feed error:', error.message);
      return [];
    }
  }

  // ---------- DISCOVER FEED (unchanged) ----------
  async _getDiscoverFeedPaginated(userId, preferences, options) {
    try {
      await this._ensureInitialized();
      const blockedUsers = await this._getBlockedUsersCached(userId);
      const { limit = 20, lastDoc } = options;
      const { collection, query, where, orderBy, limit: firestoreLimit, startAfter, getDocs } = this.firestoreMethods;

      const postsRef = collection(this.firestore, 'posts');
      let q = query(
        postsRef,
        where('isDeleted', '==', false),
        where('status', '==', 'published'),
        where('visibility', '==', 'public'),
        orderBy('createdAt', 'desc'),
        firestoreLimit(limit)
      );

      if (lastDoc && lastDoc.lastId && lastDoc.lastCreatedAt) {
        q = query(
          postsRef,
          where('isDeleted', '==', false),
          where('status', '==', 'published'),
          where('visibility', '==', 'public'),
          orderBy('createdAt', 'desc'),
          startAfter(new Date(lastDoc.lastCreatedAt)),
          firestoreLimit(limit)
        );
      }

      const snapshot = await getDocs(q);
      const posts = [];

      snapshot.forEach(doc => {
        const data = doc.data();
        if (blockedUsers.has(data.authorId)) return;
        posts.push({
          id: doc.id,
          ...data,
          _source: 'discover',
          _score: 1.0,
          createdAt: data.createdAt?.toDate?.() || new Date(),
          updatedAt: data.updatedAt?.toDate?.() || new Date()
        });
      });

      return posts;
    } catch (error) {
      console.warn('Discover feed error:', error.message);
      return [];
    }
  }

  // ---------- VIDEO FEED (unchanged) ----------
  async _getVideoFeedPaginated(userId, options) {
    try {
      await this._ensureInitialized();
      const blockedUsers = await this._getBlockedUsersCached(userId);
      const { limit = 20, lastDoc } = options;
      const { collection, query, where, orderBy, limit: firestoreLimit, startAfter, getDocs } = this.firestoreMethods;

      const postsRef = collection(this.firestore, 'posts');
      let q = query(
        postsRef,
        where('isDeleted', '==', false),
        where('status', '==', 'published'),
        where('visibility', '==', 'public'),
        where('type', '==', 'video'),
        orderBy('createdAt', 'desc'),
        firestoreLimit(limit)
      );

      if (lastDoc && lastDoc.lastId && lastDoc.lastCreatedAt) {
        q = query(
          postsRef,
          where('isDeleted', '==', false),
          where('status', '==', 'published'),
          where('visibility', '==', 'public'),
          where('type', '==', 'video'),
          orderBy('createdAt', 'desc'),
          startAfter(new Date(lastDoc.lastCreatedAt)),
          firestoreLimit(limit)
        );
      }

      const snapshot = await getDocs(q);
      const posts = [];

      snapshot.forEach(doc => {
        const data = doc.data();
        if (blockedUsers.has(data.authorId)) return;
        posts.push({
          id: doc.id,
          ...data,
          _source: 'videos',
          _score: 1.0,
          createdAt: data.createdAt?.toDate?.() || new Date(),
          updatedAt: data.updatedAt?.toDate?.() || new Date()
        });
      });

      return posts;
    } catch (error) {
      console.warn('Video feed error:', error.message);
      return [];
    }
  }

  // ==================== SCORING & RANKING (with randomness and anti‑stale) ====================
  _scoreAndRankPostsOptimized(sources, userId, preferences, dynamicWeights, sessionSeed) {
    const allPosts = [];
    const seenSet = this._getSeenSet(userId); // posts already shown to this user

    Object.entries(sources).forEach(([source, posts]) => {
      if (posts?.length) {
        const weight = dynamicWeights[source] || 0.1;
        posts.forEach(p => {
          let baseScore = p._score || 1.0;
          let finalScore = baseScore * weight;

          // 🔥 ANTI‑STALE PENALTY
          if (seenSet.has(p.id)) {
            finalScore *= FEED_CONFIG.RANDOMNESS.ANTI_STALE_PENALTY;
          }

          // 🔥 EXPLORATION BOOST (deterministic based on post id + session seed)
          const hash = this._hashString(p.id + sessionSeed);
          const randomBoost = hash % 100 / 100;
          if (randomBoost < FEED_CONFIG.RANDOMNESS.EXPLORATION_BOOST) {
            finalScore *= (1 + randomBoost);
            p._explorationBoosted = true;
          }

          p._finalScore = finalScore;
          allPosts.push(p);
        });
      }
    });

    allPosts.sort((a,b) => b._finalScore - a._finalScore);
    return allPosts.slice(0, FEED_CONFIG.ALGORITHM.MAX_TOTAL_FETCH);
  }

  _hashString(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash);
  }

  _getSeenSet(userId) {
    const history = this.feedHistory.get(userId);
    if (!history) return new Set();
    return new Set(history.posts.map(p => p.id));
  }

  _recordSeenPosts(userId, posts) {
    let history = this.feedHistory.get(userId);
    if (!history) {
      history = { posts: [], timestamp: Date.now() };
      this.feedHistory.set(userId, history);
    }
    const newPosts = [...posts];
    history.posts.unshift(...newPosts);
    // Keep only the last 500 seen posts to avoid memory bloat
    if (history.posts.length > 500) {
      history.posts = history.posts.slice(0, 500);
    }
    history.timestamp = Date.now();
  }

  // ==================== DIVERSITY WITH RANDOM INJECTION ====================
  _applyDiversityOptimized(posts, userId, targetLimit, sessionSeed) {
    const diversified = [];
    const seenPosts = new Set();
    const lastAuthorByUser = this._getLastAuthor(userId);
    let lastAuthor = lastAuthorByUser;
    let typeStreak = 0, lastType = null;

    let remaining = [...posts];

    while (diversified.length < targetLimit && remaining.length > 0) {
      const post = remaining.shift();
      if (seenPosts.has(post.id)) continue;
      if (post.authorId === lastAuthor) continue;

      if (post.type === lastType) {
        typeStreak++;
      } else {
        typeStreak = 0;
        lastType = post.type;
      }
      if (typeStreak >= FEED_CONFIG.DIVERSITY.MAX_SAME_TYPE) continue;

      diversified.push(post);
      seenPosts.add(post.id);
      lastAuthor = post.authorId;
    }

    // 🔥 Inject random exploration posts if room
    const randomNeeded = Math.min(
      FEED_CONFIG.RANDOMNESS.MAX_RANDOM_POSTS_PER_PAGE,
      targetLimit - diversified.length
    );
    if (randomNeeded > 0) {
      const candidates = remaining.filter(p => !seenPosts.has(p.id) && p.authorId !== lastAuthor);
      const shuffled = this._shuffleArray(candidates, sessionSeed);
      for (let i = 0; i < Math.min(randomNeeded, shuffled.length); i++) {
        const post = shuffled[i];
        if (post.authorId === lastAuthor) continue;
        diversified.push(post);
        seenPosts.add(post.id);
        lastAuthor = post.authorId;
      }
    }

    this._setLastAuthor(userId, lastAuthor);
    return diversified;
  }

  _shuffleArray(arr, seed) {
    const a = [...arr];
    let r = seed || 0.5;
    for (let i = a.length - 1; i > 0; i--) {
      r = (r * 9301 + 49297) % 233280;
      const j = Math.floor(r / 233280 * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  // ==================== MONETIZATION (PARALLEL ADS) ====================
  async _insertMonetizationOptimized(posts, userId, options) {
    if (options.ads === false) return posts;

    let adInterval = options.adInterval || FEED_CONFIG.MONETIZATION.AD_INTERVAL;
    const range = FEED_CONFIG.RANDOMNESS.AD_INTERVAL_RANDOM_RANGE || 0;
    if (range > 0) {
      const variation = Math.floor(Math.random() * (range * 2 + 1)) - range;
      adInterval = Math.max(1, adInterval + variation);
    }

    // Determine ad positions
    const adPositions = [];
    for (let i = adInterval; i <= posts.length; i += adInterval) {
      adPositions.push(i);
    }
    if (adPositions.length === 0) return posts;

    // Fetch all needed ads in parallel
    const adPromises = adPositions.map((pos, index) => this._getAdOptimized(userId, index));
    const ads = await Promise.all(adPromises);
    const validAds = ads.filter(ad => ad !== null);

    const monetized = [];
    let adIndex = 0;
    for (let i = 0; i < posts.length; i++) {
      monetized.push(posts[i]);
      if (adPositions.includes(i + 1) && adIndex < validAds.length) {
        monetized.push(validAds[adIndex]);
        adIndex++;
      }
    }

    console.log(`💰 Ads fetched in parallel: ${validAds.length} inserted at positions ${adPositions.slice(0, validAds.length)}`);
    return monetized;
  }

  async _getAdOptimized(userId, adIndex) {
    try {
      const monetizationService = await import('./monetizationService.js').then(m => m.default || m.getMonetizationService?.() || m);
      const ad = await monetizationService.getAd(
        FEED_CONFIG.MONETIZATION.AD_PLACEMENT,
        userId,
        { feedPosition: adIndex }
      );

      if (!ad) return null;

      const imageUrl = ad.imageUrl || ad.image || '/assets/ad-placeholder.png';

      return {
        id: ad.id || `ad_${userId}_${adIndex}`,
        type: 'ad',
        adType: ad.type || 'display',
        title: ad.title || 'Sponsored',
        content: ad.description || ad.content || 'Discover amazing products',
        imageUrl,
        link: ad.targetUrl || ad.link || '/ads',
        advertiser: ad.advertiser || 'Arvdoul',
        cta: ad.cta || 'Learn More',
        isAd: true,
        _source: 'monetization',
        _adData: {
          adId: ad.id,
          placement: FEED_CONFIG.MONETIZATION.AD_PLACEMENT,
          campaignId: ad.campaignId,
          impressionId: `imp_${Date.now()}_${Math.random().toString(36).substr(2,9)}`
        }
      };
    } catch (error) {
      console.warn('Failed to fetch ad from monetization service:', error);
      return null;
    }
  }

  // ==================== BLOCKED USERS CACHE ====================
  async _getBlockedUsersCached(userId) {
    const cacheKey = `blocked_${userId}`;
    const cached = this.blockCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < FEED_CONFIG.BLOCK_CACHE_TTL) {
      return cached.data;
    }

    try {
      await this._ensureInitialized();
      const { collection, query, where, getDocs } = this.firestoreMethods;
      const blocksRef = collection(this.firestore, 'blocks');
      const q = query(blocksRef, where('blockerId', '==', userId));
      const snapshot = await getDocs(q);
      const blockedIds = new Set(snapshot.docs.map(doc => doc.data().blockedId));
      this.blockCache.set(cacheKey, { data: blockedIds, timestamp: Date.now() });
      return blockedIds;
    } catch (error) {
      console.warn('Get blocked users failed:', error);
      return new Set();
    }
  }

  // Public method for block/unblock events
  invalidateBlockCache(userId) {
    const cacheKey = `blocked_${userId}`;
    this.blockCache.delete(cacheKey);
    console.log(`🚫 Block cache invalidated for user ${userId}`);
  }

  // ==================== DIVERSITY & SHUFFLING (helpers) ====================
  _getLastAuthor(userId) {
    const state = this.userFeedState.get(userId);
    return state?.lastAuthor || null;
  }

  _setLastAuthor(userId, authorId) {
    const state = this.userFeedState.get(userId) || {};
    state.lastAuthor = authorId;
    this.userFeedState.set(userId, state);
  }

  // ==================== COIN REWARDS ====================
  async awardCoinsForViewOptimized(userId, postId, viewDuration) {
    if (viewDuration < FEED_CONFIG.MONETIZATION.MIN_VIEW_TIME) {
      return { awarded: false, reason: 'View time too short' };
    }
    const awardKey = `coin_award_${userId}_${postId}`;
    if (this.engagementTracker.has(awardKey)) {
      return { awarded: false, reason: 'Already awarded (this session)' };
    }

    let coins = 0;
    if (viewDuration >= 10000) coins = 3;
    else if (viewDuration >= 5000) coins = 2;
    else if (viewDuration >= 3000) coins = 1;

    if (coins > 0) {
      this._debounceOperation(`award_${userId}_${postId}`, async () => {
        try {
          const userService = await import('./userService.js');
          await userService.addCoins(userId, coins, 'feed_view', { postId, viewDuration });
          this.engagementTracker.set(awardKey, { awardedAt: Date.now(), coins, postId });
        } catch (err) { console.warn('Coin award failed:', err); }
      }, 2000);
      return { awarded: true, coins, delayed: true };
    }
    return { awarded: false, coins: 0 };
  }

  // ==================== CACHED USER DATA ====================
  async _getUserProfileCached(userId) {
    const cacheKey = `user_profile_${userId}`;
    const cached = this.userPreferences.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < FEED_CONFIG.PERFORMANCE.PROFILE_CACHE_TTL) return cached.data;
    try {
      const userService = await import('./userService.js');
      const profile = await userService.getUserProfile(userId);
      if (profile) this.userPreferences.set(cacheKey, { data: profile, timestamp: Date.now() });
      return profile || {};
    } catch { return {}; }
  }

  async _getUserPreferencesCached(userId) {
    const cacheKey = `user_prefs_${userId}`;
    const cached = this.userPreferences.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < FEED_CONFIG.PERFORMANCE.PREF_CACHE_TTL) return cached.data;
    try {
      const { doc, getDoc } = this.firestoreMethods;
      const prefsRef = doc(this.firestore, 'user_preferences', userId);
      let prefsSnap = await getDoc(prefsRef);
      if (!prefsSnap.exists()) {
        const settingsRef = doc(this.firestore, 'user_settings', userId);
        const settingsSnap = await getDoc(settingsRef);
        if (settingsSnap.exists()) {
          const settings = settingsSnap.data();
          prefsSnap = { exists: () => true, data: () => ({ postTypes: {}, topics: [], ...settings }) };
        } else {
          prefsSnap = { exists: () => true, data: () => ({ postTypes: { text:0.5, image:0.8, video:0.6 }, topics: [] }) };
        }
      }
      const prefs = prefsSnap.data();
      this.userPreferences.set(cacheKey, { data: prefs, timestamp: Date.now() });
      return prefs;
    } catch { return {}; }
  }

  async _getUserBehaviorCached(userId) {
    const cacheKey = `user_behavior_${userId}`;
    const cached = this.userPreferences.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < FEED_CONFIG.PERFORMANCE.BEHAVIOR_CACHE_TTL) return cached.data;
    return { engagementRate: 0.3, timeOnPlatform: 0, likesGiven: 0 };
  }

  async _getUserInterestsCached(userId) {
    const cacheKey = `user_interests_${userId}`;
    const cached = this.userPreferences.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < 45 * 60 * 1000) return cached.data;
    try {
      const profile = await this._getUserProfileCached(userId);
      const prefs = await this._getUserPreferencesCached(userId);
      const interests = new Set();
      if (profile.interests) profile.interests.forEach(i => interests.add(i));
      if (prefs.topics) prefs.topics.forEach(t => interests.add(t));
      const arr = Array.from(interests).slice(0, 10);
      this.userPreferences.set(cacheKey, { data: arr, timestamp: Date.now() });
      return arr;
    } catch { return []; }
  }

  // ==================== WEIGHT CALCULATION (unchanged) ====================
  _calculateDynamicWeights(preferences, behavior) {
    const baseWeights = { ...FEED_CONFIG.ALGORITHM.BASE_WEIGHTS };
    if (behavior.engagementRate > 0.5) {
      baseWeights.following = Math.min(0.5, baseWeights.following + 0.1);
      baseWeights.for_you = Math.min(0.3, baseWeights.for_you + 0.05);
      baseWeights.trending = Math.max(0.05, baseWeights.trending - 0.05);
    }
    if (behavior.timeOnPlatform < 3 * 60) {
      baseWeights.trending = Math.min(0.25, baseWeights.trending + 0.1);
      baseWeights.discover = Math.min(0.15, baseWeights.discover + 0.05);
    }
    const total = Object.values(baseWeights).reduce((s, w) => s + w, 0);
    Object.keys(baseWeights).forEach(k => baseWeights[k] /= total);
    return baseWeights;
  }

  // ==================== PAGINATION CURSOR MANAGEMENT ====================
  _encodeCursor(feed, sources) {
    if (!feed || feed.length === 0) return null;
    const lastPost = feed[feed.length - 1];
    const cursor = {
      createdAt: lastPost.createdAt instanceof Date ? lastPost.createdAt.toISOString() : lastPost.createdAt,
      postId: lastPost.id,
      sources: {}
    };
    Object.entries(sources).forEach(([key, posts]) => {
      if (posts && posts.length > 0) {
        const last = posts[posts.length - 1];
        const sourceCursor = {
          lastId: last.id,
          lastCreatedAt: last.createdAt instanceof Date ? last.createdAt.toISOString() : last.createdAt
        };
        if (key === 'for_you' && last.personalizationScore !== undefined) {
          sourceCursor.lastScore = last.personalizationScore;
        }
        if (key === 'trending' && last.trendingScore !== undefined) {
          sourceCursor.lastScore = last.trendingScore;
        }
        cursor.sources[key] = sourceCursor;
      }
    });
    return btoa(unescape(encodeURIComponent(JSON.stringify(cursor))));
  }

  _decodeCursor(cursorString) {
    try {
      const json = decodeURIComponent(escape(atob(cursorString)));
      return JSON.parse(json);
    } catch {
      return null;
    }
  }

  _getPageFromCache(userId, limit, cursor) {
    const cacheKey = `feed_page_${userId}_${limit}_${cursor || 'first'}`;
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < FEED_CONFIG.PERFORMANCE.PAGE_CACHE_TTL) {
      return cached.data;
    }
    return null;
  }

  _cachePage(userId, limit, cursor, data) {
    const cacheKey = `feed_page_${userId}_${limit}_${cursor || 'first'}`;
    this.cache.set(cacheKey, { data, timestamp: Date.now() });
    if (this.cache.size > FEED_CONFIG.PERFORMANCE.MAX_CACHE_SIZE) {
      const oldest = Array.from(this.cache.keys()).sort((a,b) =>
        this.cache.get(a).timestamp - this.cache.get(b).timestamp
      )[0];
      this.cache.delete(oldest);
    }
  }

  _countSources(sources) {
    return Object.keys(sources).reduce((acc, key) => {
      acc[key] = sources[key]?.length || 0;
      return acc;
    }, {});
  }

  // ==================== FINALIZE FEED (with location fix) ====================
  _finalizeFeedOptimized(posts, userId, options) {
    const limited = posts.slice(0, options.limit || FEED_CONFIG.ALGORITHM.DEFAULT_PAGE_LIMIT);
    return limited.map((p, i) => {
      // 🔥 FIX: Convert location object to string to prevent React error
      let location = p.location;
      if (location && typeof location === 'object') {
        location = location.displayName || (location.lat && location.lon ? `${location.lat},${location.lon}` : null);
      }
      return {
        ...p,
        location,  // now always a string or null
        _feedPosition: i + 1,
        _viewed: false,
        _impressionTracked: false,
        _metadata: {
          source: p._source,
          score: p._finalScore || p._score,
          insertedAt: new Date().toISOString(),
          algorithmVersion: this.algorithmVersion
        }
      };
    });
  }

  // ==================== REAL‑TIME UPDATES ====================
  subscribeToFeedUpdates(userId, callback, options = {}) {
    const subscriptionId = `feed_updates_${userId}_${Date.now()}`;
    this._debounceOperation(`subscribe_${userId}`, async () => {
      try {
        await this._ensureInitialized();
        const { collection, query, orderBy, limit, onSnapshot } = this.firestoreMethods;
        const feedRef = collection(this.firestore, 'users', userId, 'feeds');
        const feedQuery = query(feedRef, orderBy('createdAt', 'desc'), limit(1));

        const unsubscribe = onSnapshot(feedQuery, async () => {
          this._debounceOperation(`refresh_${userId}`, async () => {
            const feed = await this.getSmartFeed(userId, { ...options, forceRefresh: true, limit: 20 });
            callback({
              type: 'feed_updated',
              feed: feed.feed,
              metadata: feed.metadata,
              subscriptionId,
              timestamp: new Date().toISOString()
            });
          }, 5000);
        }, (error) => {
          callback({ type: 'error', error: error.message, subscriptionId });
        });

        this.realtimeSubscriptions.set(subscriptionId, { unsubscribe, userId, callback });
      } catch (error) {
        callback({ type: 'error', error: error.message, subscriptionId });
      }
    }, 1000);
    return subscriptionId;
  }

  unsubscribeFromFeed(subscriptionId) {
    const sub = this.realtimeSubscriptions.get(subscriptionId);
    if (sub) {
      try { sub.unsubscribe(); } catch (e) {}
      this.realtimeSubscriptions.delete(subscriptionId);
    }
  }

  // ==================== FALLBACK FEED ====================
  async _getFallbackFeed(userId, options) {
    try {
      await this._ensureInitialized();
      const { limit = 20 } = options;
      const { collection, query, where, getDocs, orderBy, limit: firestoreLimit } = this.firestoreMethods;
      const postsRef = collection(this.firestore, 'posts');
      const q = query(
        postsRef,
        where('isDeleted', '==', false),
        where('status', '==', 'published'),
        where('visibility', '==', 'public'),
        orderBy('createdAt', 'desc'),
        firestoreLimit(limit)
      );
      const snapshot = await getDocs(q);
      const posts = [];
      snapshot.forEach(doc => {
        const data = doc.data();
        posts.push({
          id: doc.id,
          ...data,
          _source: 'fallback',
          createdAt: data.createdAt?.toDate?.() || new Date(),
          updatedAt: data.updatedAt?.toDate?.() || new Date()
        });
      });
      return posts;
    } catch {
      return [];
    }
  }

  // ==================== PRELOAD NEXT PAGE ====================
  async preloadNextFeed(userId, currentFeed) {
    if (!currentFeed?.length) return;
    const lastPost = currentFeed[currentFeed.length - 1];
    if (!lastPost) return;
    setTimeout(async () => {
      try {
        await this.getSmartFeed(userId, {
          limit: FEED_CONFIG.PERFORMANCE.PRELOAD_COUNT,
          lastDoc: this._encodeCursor(currentFeed, {}),
          cacheFirst: true
        });
      } catch {}
    }, 2000);
  }

  // ==================== ANALYTICS ====================
  async getFeedAnalytics(userId, timeframe = '7d') {
    return {
      success: true,
      analytics: [],
      insights: {
        message: 'Detailed analytics available in dashboard',
        estimatedSavings: 'Fan-out feed enabled – read cost reduced dramatically'
      },
      timeframe
    };
  }

  // ==================== SERVICE MANAGEMENT ====================
  getStats() {
    return {
      cacheSize: this.cache.size,
      userFeedState: this.userFeedState.size,
      userPreferences: this.userPreferences.size,
      blockCache: this.blockCache.size,
      subscriptions: this.realtimeSubscriptions.size,
      algorithmVersion: this.algorithmVersion,
      initialized: this.initialized,
      pagination: true,
      diversityRule: 'no consecutive same author',
      randomnessEnabled: true,
      antiStaleEnabled: true
    };
  }

  clearUserCache(userId) {
    for (const [key] of this.cache.entries()) {
      if (key.includes(`_${userId}_`)) this.cache.delete(key);
    }
    this.userPreferences.delete(userId);
    this.userFeedState.delete(userId);
    this.feedHistory.delete(userId);
    this.blockCache.delete(`blocked_${userId}`);
  }

  clearCache() {
    this.cache.clear();
    this.userPreferences.clear();
    this.userFeedState.clear();
    this.feedHistory.clear();
    this.blockCache.clear();
  }

  destroy() {
    for (const [id, sub] of this.realtimeSubscriptions) {
      try { sub.unsubscribe(); } catch {}
    }
    this.realtimeSubscriptions.clear();
    this.clearCache();
    for (const timer of this.debounceTimers.values()) clearTimeout(timer);
    this.debounceTimers.clear();
    this.initialized = false;
    this.firestore = null;
  }

  _startEngagementTracker() {
    setInterval(() => {
      const now = Date.now();
      for (const [key, data] of this.engagementTracker.entries()) {
        if (now - data.awardedAt > 24 * 60 * 60 * 1000) this.engagementTracker.delete(key);
      }
    }, 2 * 60 * 60 * 1000);
  }

  _enhanceError(error) {
    const err = new Error(error.message || 'Feed service error');
    err.code = error.code || 'unknown';
    return err;
  }
}

// ==================== SINGLETON & EXPORTS ====================
let feedServiceInstance = null;

function getFeedService() {
  if (!feedServiceInstance) feedServiceInstance = new UltimateFeedService();
  return feedServiceInstance;
}

const feedService = {
  getSmartFeed: (userId, options) => getFeedService().getSmartFeed(userId, options),
  subscribeToFeedUpdates: (userId, callback, options) => getFeedService().subscribeToFeedUpdates(userId, callback, options),
  unsubscribeFromFeed: (subscriptionId) => getFeedService().unsubscribeFromFeed(subscriptionId),
  awardCoinsForView: (userId, postId, viewDuration) => getFeedService().awardCoinsForViewOptimized(userId, postId, viewDuration),
  preloadNextFeed: (userId, currentFeed) => getFeedService().preloadNextFeed(userId, currentFeed),
  getFeedAnalytics: (userId, timeframe) => getFeedService().getFeedAnalytics(userId, timeframe),
  getService: getFeedService,
  getStats: () => getFeedService().getStats(),
  clearUserCache: (userId) => getFeedService().clearUserCache(userId),
  clearCache: () => getFeedService().clearCache(),
  destroy: () => getFeedService().destroy(),
  ensureInitialized: () => getFeedService()._ensureInitialized(),
  invalidateBlockCache: (userId) => getFeedService().invalidateBlockCache(userId)
};

export default feedService;
export { feedService, getFeedService };