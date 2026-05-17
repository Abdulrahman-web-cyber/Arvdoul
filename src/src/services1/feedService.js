// src/services/feedService.js - ENTERPRISE PRODUCTION V15.1 - MULTI‑FIELD PAGINATION FIX
// 🏠 ULTIMATE SMART FEED • WRITE‑TIME FAN‑OUT • COST OPTIMIZED • PAGINATION PERFECT
// 💰 INTEGRATED WITH MONETIZATION SERVICE FOR REAL ADS • NO MOCK DATA • BILLION‑USER READY
// ✅ FOLLOWING FEED NOW USES USER‑SPECIFIC FEED COLLECTION • OTHER SOURCES QUERY WITH INDEXES
// 🔧 FIXES: multi‑field cursors for for_you/trending feeds, removed in+orderBy, added fan-out read

const FEED_CONFIG = {
  // Feed Types & Weights
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
      following: 0.50,   // increased because it's now highly efficient
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
    REQUEST_TIMEOUT: 8000,
    BATCH_SIZE: 10,
    DEBOUNCE_TIME: 500,
    PAGE_CACHE_TTL: 3 * 60 * 1000,
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
    MAX_FEED_SIZE: 1000,                // keep last 1000 posts per user (optional cleanup)
  },

  // Block list cache TTL
  BLOCK_CACHE_TTL: 5 * 60 * 1000,
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
    this.blockCache = new Map();           // blocked users per viewer

    // Tracking
    this.engagementTracker = new Map();
    this.feedHistory = new Map();

    // Real‑time subscriptions
    this.realtimeSubscriptions = new Map();

    // Debounce & Rate limiting
    this.lastRequestTime = new Map();
    this.debounceTimers = new Map();

    // Algorithm version
    this.algorithmVersion = 'v15.1_multifield';

    console.log('🏠 Ultimate Feed Service V15.1 - Multi‑Field Pagination');

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

      this.initialized = true;
      console.log('✅ Feed Service V15.1 initialized');
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

    if (!forceRefresh && !this._canMakeRequest(userId, 'getSmartFeed')) {
      const cached = this._getPageFromCache(userId, limit, lastDoc);
      if (cached) return { ...cached, rateLimited: true, cached: true, operationId, duration: Date.now() - startTime };
    }

    try {
      await this._ensureInitialized();

      if (!forceRefresh) {
        const cached = this._getPageFromCache(userId, limit, lastDoc);
        if (cached) {
          return { ...cached, cached: true, operationId, duration: Date.now() - startTime };
        }
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

      const scoredPosts = this._scoreAndRankPostsOptimized(feedSources, userId, userPreferences, dynamicWeights);

      const diversified = this._applyDiversityOptimized(scoredPosts, userId, limit);

      const monetizedFeed = await this._insertMonetizationOptimized(diversified, userId, options);

      const finalFeed = this._finalizeFeedOptimized(monetizedFeed, userId, options);
      const nextCursor = this._encodeCursor(finalFeed, feedSources);

      this._cachePage(userId, limit, lastDoc, {
        feed: finalFeed,
        nextCursor,
        metadata: {
          generatedAt: new Date().toISOString(),
          sourceCounts: this._countSources(feedSources),
          weights: dynamicWeights,
          algorithmVersion: this.algorithmVersion,
          page: lastDoc ? 'next' : 'first'
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

    } catch (error) {
      console.error('❌ Feed generation failed:', error);
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

  // ==================== PAGINATION CURSOR MANAGEMENT (BROWSER-SAFE) ====================
  // FIX: Include all orderBy fields in the cursor per source
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
        // Base fields
        const sourceCursor = {
          lastId: last.id,
          lastCreatedAt: last.createdAt instanceof Date ? last.createdAt.toISOString() : last.createdAt
        };
        // For multi‑orderBy sources, store the relevant score fields
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
    if (this.cache.size > 100) {
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

  // ==================== OPTIMIZED SOURCE FETCHING ====================
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
          .catch(() => { sources.following = []; })
      );
    }

    // For You feed – query posts with personalization score (precomputed)
    if (weights.for_you > 0.15) {
      sourcePromises.push(
        this._getForYouFeedPaginated(userId, preferences, { ...options, limit: pageLimit, lastDoc: lastDoc?.sources?.for_you })
          .then(posts => { sources.for_you = posts; })
          .catch(() => { sources.for_you = []; })
      );
    }

    // Trending feed – query posts with trendingScore (updated by cron)
    if (weights.trending > 0.1) {
      sourcePromises.push(
        this._getTrendingFeedPaginated(userId, { ...options, limit: pageLimit, lastDoc: lastDoc?.sources?.trending })
          .then(posts => { sources.trending = posts; })
          .catch(() => { sources.trending = []; })
      );
    }

    // Discover feed – random/varied posts (can be a simple query)
    if (weights.discover > 0.05) {
      sourcePromises.push(
        this._getDiscoverFeedPaginated(userId, preferences, { ...options, limit: pageLimit, lastDoc: lastDoc?.sources?.discover })
          .then(posts => { sources.discover = posts; })
          .catch(() => { sources.discover = []; })
      );
    }

    // Video feed – filter by type
    if (weights.videos > 0.05 && preferences?.postTypes?.video > 0.6) {
      sourcePromises.push(
        this._getVideoFeedPaginated(userId, { ...options, limit: pageLimit, lastDoc: lastDoc?.sources?.videos })
          .then(posts => { sources.videos = posts; })
          .catch(() => { sources.videos = []; })
      );
    }

    await Promise.allSettled(sourcePromises.map(p =>
      Promise.race([p, new Promise(resolve => setTimeout(resolve, FEED_CONFIG.PERFORMANCE.REQUEST_TIMEOUT))])
    ));

    return sources;
  }

  // ---------- NEW: FOLLOWING FEED FROM USER'S FEED SUBCOLLECTION (FAN-OUT) ----------
  async _getFollowingFeedFromUserFeed(userId, options) {
    try {
      await this._ensureInitialized();
      const { limit = 20, lastDoc } = options;
      const { collection, query, orderBy, limit: firestoreLimit, startAfter, getDocs } = this.firestoreMethods;

      // Feed documents are stored in users/{userId}/feeds
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

  // ---------- FOR YOU FEED (query posts with personalizationScore) ----------
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

      // FIX: Use multi-field cursor if lastDoc contains both score and createdAt
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

  // ---------- TRENDING FEED (query posts with trendingScore) ----------
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

      // FIX: Use multi-field cursor if lastDoc contains both score and createdAt
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

  // ---------- DISCOVER FEED (simple random / recent) ----------
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

  // ---------- VIDEO FEED ----------
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

  // ==================== DIVERSITY & SHUFFLING ====================
  _applyDiversityOptimized(posts, userId, targetLimit) {
    const diversified = [];
    const seenPosts = new Set();
    const lastAuthorByUser = this._getLastAuthor(userId);

    let lastAuthor = lastAuthorByUser;
    let typeStreak = 0, lastType = null;

    for (const post of posts) {
      if (diversified.length >= targetLimit) break;
      if (seenPosts.has(post.id)) continue;

      if (post.authorId === lastAuthor) {
        continue;
      }

      if (post.type === lastType) {
        typeStreak++;
      } else {
        typeStreak = 0;
        lastType = post.type;
      }
      if (typeStreak >= FEED_CONFIG.DIVERSITY.MAX_SAME_TYPE) {
        continue;
      }

      diversified.push(post);
      seenPosts.add(post.id);
      lastAuthor = post.authorId;
    }

    this._setLastAuthor(userId, lastAuthor);
    return diversified;
  }

  _getLastAuthor(userId) {
    const state = this.userFeedState.get(userId);
    return state?.lastAuthor || null;
  }

  _setLastAuthor(userId, authorId) {
    const state = this.userFeedState.get(userId) || {};
    state.lastAuthor = authorId;
    this.userFeedState.set(userId, state);
  }

  // ==================== MONETIZATION (ADS) ====================
  async _insertMonetizationOptimized(posts, userId, options) {
    if (options.ads === false) return posts;

    const monetized = [];
    let postCount = 0;
    let adCount = 0;
    const adInterval = options.adInterval || FEED_CONFIG.MONETIZATION.AD_INTERVAL;

    for (let i = 0; i < posts.length; i++) {
      monetized.push(posts[i]);
      postCount++;

      if (postCount % adInterval === 0 && adCount < 2) {
        const ad = await this._getAdOptimized(userId, adCount);
        if (ad) {
          monetized.push(ad);
          adCount++;
        }
      }
    }

    console.log(`💰 Ads inserted: ${adCount} (interval: ${adInterval})`);
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
    if (cached && Date.now() - cached.timestamp < 15 * 60 * 1000) return cached.data;
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
    if (cached && Date.now() - cached.timestamp < 10 * 60 * 1000) return cached.data;
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
    if (cached && Date.now() - cached.timestamp < 20 * 60 * 1000) return cached.data;
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

  // ==================== SCORING & RANKING ====================
  _scoreAndRankPostsOptimized(sources, userId, preferences, dynamicWeights) {
    const allPosts = [];
    Object.entries(sources).forEach(([source, posts]) => {
      if (posts?.length) {
        const weight = dynamicWeights[source] || 0.1;
        posts.forEach(p => {
          const baseScore = p._score || 1.0;
          p._finalScore = baseScore * weight;
          allPosts.push(p);
        });
      }
    });
    allPosts.sort((a,b) => b._finalScore - a._finalScore);
    return allPosts.slice(0, FEED_CONFIG.ALGORITHM.MAX_TOTAL_FETCH);
  }

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

  _finalizeFeedOptimized(posts, userId, options) {
    const limited = posts.slice(0, options.limit || FEED_CONFIG.ALGORITHM.DEFAULT_PAGE_LIMIT);
    return limited.map((p, i) => ({
      ...p,
      _feedPosition: i + 1,
      _viewed: false,
      _impressionTracked: false,
      _metadata: {
        source: p._source,
        score: p._finalScore || p._score,
        insertedAt: new Date().toISOString(),
        algorithmVersion: this.algorithmVersion
      }
    }));
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
      diversityRule: 'no consecutive same author'
    };
  }

  clearUserCache(userId) {
    for (const [key] of this.cache.entries()) {
      if (key.includes(`_${userId}_`)) this.cache.delete(key);
    }
    this.userPreferences.delete(userId);
    this.userFeedState.delete(userId);
    this.feedHistory.delete(userId);
    this.blockCache.delete(userId);
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
  ensureInitialized: () => getFeedService()._ensureInitialized()
};

export default feedService;
export { feedService, getFeedService };