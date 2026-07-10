/**
 * src/services/analyticsService.js - ARVDOUL Ultimate Analytics Service
 * 
 * Comprehensive analytics tracking for user profiles, posts, and engagement metrics.
 * Features:
 * - Profile view tracking and analytics
 * - Post analytics with daily stats
 * - Creator ranking system
 * - Audience demographics
 * - Engagement trends and growth metrics
 * - Coin earning history
 * 
 * @author ARVDOUL Engineering Team
 * @version 1.0.0
 */

import { produce } from 'immer';

// ==================== CONFIGURATION ====================
const ANALYTICS_CONFIG = {
  CACHE_TTL: 5 * 60 * 1000, // 5 minutes cache TTL
  MAX_DAILY_STATS: 365, // Store up to 1 year of daily stats
  TIMEFRAMES: ['7d', '30d', '90d', '365d'],
  TOP_POSTS_LIMIT: 10,
  DEMOGRAPHICS_BUCKETS: {
    age: ['13-17', '18-24', '25-34', '35-44', '45-54', '55-64', '65+'],
    gender: ['male', 'female', 'other', 'prefer_not_to_say'],
  },
  RANKING_TOP_N: 100, // Compare against top 100 creators
};

// ==================== LRU CACHE ====================
class LRUCache {
  constructor(maxSize = 100, ttl = ANALYTICS_CONFIG.CACHE_TTL) {
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

  clear() {
    this.cache.clear();
  }
}

// ==================== ENHANCED ERROR HANDLER ====================
function enhanceError(error, defaultMessage) {
  const errorMap = {
    'permission-denied': 'You do not have permission to access analytics.',
    'unauthenticated': 'Authentication required to view analytics.',
    'not-found': 'Analytics data not found.',
    'already-exists': 'Analytics record already exists.',
    'resource-exhausted': 'Analytics quota exceeded.',
    'failed-precondition': 'Operation failed. Please try again.',
    'deadline-exceeded': 'Analytics request timed out.',
    'unavailable': 'Analytics service temporarily unavailable.',
    'invalid-argument': 'Invalid analytics request.',
  };
  
  const code = error?.code || 'unknown';
  let message = errorMap[code] || defaultMessage || 'Analytics operation failed';
  
  const enhanced = new Error(message);
  enhanced.code = code;
  enhanced.originalError = error;
  enhanced.timestamp = new Date().toISOString();
  return enhanced;
}

// ==================== ANALYTICS SERVICE CLASS ====================
class UltimateAnalyticsService {
  constructor() {
    this.firestore = null;
    this.initialized = false;
    this.cache = new LRUCache(100, ANALYTICS_CONFIG.CACHE_TTL);
    this.subscriptions = new Map();
    this._cacheCleanupInterval = null;

    if (typeof window !== 'undefined') {
      this._cacheCleanupInterval = setInterval(() => this.clearExpiredCache(), 5 * 60 * 1000);
    }

    this.initialize().catch(err => console.warn('Analytics service init warning:', err.message));
  }

  // ==================== INITIALIZATION ====================
  async initialize() {
    if (this.initialized && this.firestore) return this.firestore;

    try {
      console.log('📊 Initializing Analytics Service...');
      const firebase = await import('../firebase/firebase.js');
      this.firestore = await firebase.getFirestoreInstance();

      const { enableIndexedDbPersistence } = await import('firebase/firestore');
      try {
        await enableIndexedDbPersistence(this.firestore);
        console.log('✅ Analytics Firestore persistence enabled');
      } catch (e) {
        console.warn('⚠️ Analytics persistence not available:', e.message);
      }

      this.initialized = true;
      return this.firestore;
    } catch (error) {
      console.error('❌ Analytics initialization failed:', error);
      throw enhanceError(error, 'Failed to initialize analytics service');
    }
  }

  async _ensureInitialized() {
    if (!this.initialized || !this.firestore) await this.initialize();
    return this.firestore;
  }

  // ==================== HELPER FUNCTIONS ====================
  _getDateString(date = new Date()) {
    return date.toISOString().split('T')[0];
  }

  _getTimeframeDays(timeframe) {
    const map = {
      '7d': 7,
      '30d': 30,
      '90d': 90,
      '365d': 365,
    };
    return map[timeframe] || 30;
  }

  _generateDocId(...parts) {
    return parts.join('_');
  }

  // ==================== PROFILE ANALYTICS ====================
  /**
   * Get comprehensive user analytics for a given timeframe
   * @param {string} userId - User ID
   * @param {string} timeframe - Timeframe (7d, 30d, 90d, 365d)
   * @returns {Object} Analytics data including views, reach, engagement, coins, daily stats
   */
  async getUserAnalytics(userId, timeframe = '30d') {
    try {
      await this._ensureInitialized();
      
      const cacheKey = `analytics_${userId}_${timeframe}`;
      const cached = this.cache.get(cacheKey);
      if (cached) return cached;

      const { doc, getDoc, collection, query, where, getDocs, orderBy, limit } = await import('firebase/firestore');
      
      // Get profile analytics document
      const profileAnalyticsRef = doc(this.firestore, 'profile_analytics', userId);
      const profileAnalyticsSnap = await getDoc(profileAnalyticsRef);
      
      let analytics = {
        userId,
        timeframe,
        totalViews: 0,
        totalReach: 0,
        totalEngagement: 0,
        coinsEarned: 0,
        dailyStats: [],
        topPosts: [],
        growthRate: 0,
        activeDays: 0,
        demographics: {
          ageGroups: {},
          gender: {},
          locations: {},
          interests: {},
        },
        ranking: null,
        changes: {
          views: 0,
          reach: 0,
          engagement: 0,
          coins: 0,
        },
        lastUpdated: new Date().toISOString(),
      };

      if (profileAnalyticsSnap.exists()) {
        const data = profileAnalyticsSnap.data();
        const days = this._getTimeframeDays(timeframe);
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);

        analytics = {
          ...analytics,
          totalViews: data.totalViews || 0,
          totalReach: data.totalReach || 0,
          totalEngagement: data.totalEngagement || 0,
          coinsEarned: data.coinsEarned || 0,
          dailyStats: this._extractDailyStats(data.dailyStats, startDate),
          topPosts: data.topPosts || [],
          growthRate: data.growthRate || 0,
          activeDays: data.activeDays || 0,
          demographics: data.demographics || analytics.demographics,
        };

        // Calculate changes compared to previous period
        const previousStartDate = new Date(startDate);
        previousStartDate.setDate(previousStartDate.getDate() - days);
        
        const previousStats = this._extractDailyStats(data.dailyStats, previousStartDate, startDate);
        if (previousStats.length > 0) {
          const previousTotalViews = previousStats.reduce((sum, s) => sum + (s.views || 0), 0);
          const previousTotalReach = previousStats.reduce((sum, s) => sum + (s.reach || 0), 0);
          const previousTotalEngagement = previousStats.reduce((sum, s) => sum + (s.engagement || 0), 0);
          const previousCoins = previousStats.reduce((sum, s) => sum + (s.coins || 0), 0);

          analytics.changes = {
            views: previousTotalViews > 0 ? ((analytics.totalViews - previousTotalViews) / previousTotalViews) * 100 : 0,
            reach: previousTotalReach > 0 ? ((analytics.totalReach - previousTotalReach) / previousTotalReach) * 100 : 0,
            engagement: previousTotalEngagement > 0 ? ((analytics.totalEngagement - previousTotalEngagement) / previousTotalEngagement) * 100 : 0,
            coins: previousCoins > 0 ? ((analytics.coinsEarned - previousCoins) / previousCoins) * 100 : 0,
          };
        }
      }

      // Get ranking
      analytics.ranking = await this.getCreatorRanking(userId);

      this.cache.set(cacheKey, analytics);
      return analytics;
    } catch (error) {
      console.error('❌ Get user analytics failed:', error);
      throw enhanceError(error, 'Failed to get user analytics');
    }
  }

  _extractDailyStats(dailyStatsMap, startDate, endDate = new Date()) {
    if (!dailyStatsMap) return [];
    
    const stats = [];
    const endDateStr = endDate.toISOString().split('T')[0];
    
    for (const [date, data] of Object.entries(dailyStatsMap)) {
      if (date >= startDate.toISOString().split('T')[0] && date <= endDateStr) {
        stats.push({
          date,
          ...data,
        });
      }
    }
    
    return stats.sort((a, b) => a.date.localeCompare(b.date));
  }

  /**
   * Track a profile view
   * @param {string} viewerId - The user viewing the profile
   * @param {string} profileOwnerId - The profile being viewed
   */
  async trackProfileView(viewerId, profileOwnerId) {
    if (!viewerId || viewerId === profileOwnerId) return; // Don't track self-views

    try {
      await this._ensureInitialized();
      
      const { doc, setDoc, updateDoc, serverTimestamp, runTransaction } = await import('firebase/firestore');
      const today = this._getDateString();
      const viewDocId = this._generateDocId(viewerId, profileOwnerId, today);
      
      // Record the view
      const viewRef = doc(this.firestore, 'profile_views', viewDocId);
      await setDoc(viewRef, {
        viewerId,
        profileOwnerId,
        viewedAt: serverTimestamp(),
        date: today,
      }, { merge: true });

      // Update profile analytics
      const analyticsRef = doc(this.firestore, 'profile_analytics', profileOwnerId);
      await runTransaction(this.firestore, async (transaction) => {
        const analyticsDoc = await transaction.get(analyticsRef);
        
        if (!analyticsDoc.exists()) {
          transaction.set(analyticsRef, {
            totalViews: 1,
            totalReach: 1,
            totalEngagement: 0,
            coinsEarned: 0,
            dailyStats: {
              [today]: { views: 1, reach: 1, engagement: 0, coins: 0 },
            },
            topPosts: [],
            growthRate: 0,
            activeDays: 1,
            demographics: {
              ageGroups: {},
              gender: {},
              locations: {},
              interests: {},
            },
            lastUpdated: serverTimestamp(),
          });
        } else {
          const data = analyticsDoc.data();
          const dailyStats = data.dailyStats || {};
          const todayStats = dailyStats[today] || { views: 0, reach: 0, engagement: 0, coins: 0 };
          
          transaction.update(analyticsRef, {
            totalViews: (data.totalViews || 0) + 1,
            totalReach: (data.totalReach || 0) + 1,
            [`dailyStats.${today}`]: {
              views: (todayStats.views || 0) + 1,
              reach: (todayStats.reach || 0) + 1,
              engagement: todayStats.engagement || 0,
              coins: todayStats.coins || 0,
            },
            lastUpdated: serverTimestamp(),
          });
        }
      });

      // Invalidate cache
      this.cache.delete(`analytics_${profileOwnerId}_7d`);
      this.cache.delete(`analytics_${profileOwnerId}_30d`);
      this.cache.delete(`analytics_${profileOwnerId}_90d`);
      this.cache.delete(`analytics_${profileOwnerId}_365d`);
    } catch (error) {
      console.warn('⚠️ Track profile view failed:', error);
      // Don't throw - this is a non-critical operation
    }
  }

  /**
   * Get creator ranking (Top 1%, Top 5%, etc.)
   * @param {string} userId - User ID
   * @returns {Object} Ranking data
   */
  async getCreatorRanking(userId) {
    try {
      await this._ensureInitialized();
      
      const { collection, query, orderBy, limit, getDocs } = await import('firebase/firestore');
      
      // Get top creators by coins earned
      const topCreatorsQuery = query(
        collection(this.firestore, 'profile_analytics'),
        orderBy('coinsEarned', 'desc'),
        limit(ANALYTICS_CONFIG.RANKING_TOP_N)
      );
      
      const snapshot = await getDocs(topCreatorsQuery);
      const topCreators = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      // Find user's position
      const userIndex = topCreators.findIndex(c => c.id === userId);
      
      let ranking = {
        position: null,
        percentile: null,
        label: null,
        total: snapshot.size,
      };
      
      if (userIndex !== -1) {
        ranking.position = userIndex + 1;
        ranking.percentile = ((snapshot.size - userIndex) / snapshot.size) * 100;
        
        if (ranking.percentile >= 99) ranking.label = 'Top 1%';
        else if (ranking.percentile >= 95) ranking.label = 'Top 5%';
        else if (ranking.percentile >= 90) ranking.label = 'Top 10%';
        else if (ranking.percentile >= 75) ranking.label = 'Top 25%';
        else if (ranking.percentile >= 50) ranking.label = 'Top 50%';
        else ranking.label = 'Rising Creator';
      }
      
      return ranking;
    } catch (error) {
      console.warn('⚠️ Get creator ranking failed:', error);
      return {
        position: null,
        percentile: null,
        label: 'New Creator',
        total: 0,
      };
    }
  }

  // ==================== POST ANALYTICS ====================
  /**
   * Track post analytics event
   * @param {string} postId - Post ID
   * @param {string} eventType - Event type (view, like, comment, share)
   * @param {string} userId - User performing the action
   */
  async trackPostAnalytics(postId, eventType, userId) {
    try {
      await this._ensureInitialized();
      
      const { doc, updateDoc, serverTimestamp, runTransaction, increment } = await import('firebase/firestore');
      const today = this._getDateString();
      
      const analyticsRef = doc(this.firestore, 'post_analytics', postId);
      
      const fieldMap = {
        view: 'totalViews',
        like: 'totalLikes',
        comment: 'totalComments',
        share: 'totalShares',
      };
      
      const dailyFieldMap = {
        view: 'views',
        like: 'likes',
        comment: 'comments',
        share: 'shares',
      };
      
      const totalField = fieldMap[eventType];
      const dailyField = dailyFieldMap[eventType];
      
      if (!totalField || !dailyField) return;
      
      await runTransaction(this.firestore, async (transaction) => {
        const analyticsDoc = await transaction.get(analyticsRef);
        
        if (!analyticsDoc.exists()) {
          const newData = {
            postId,
            totalViews: eventType === 'view' ? 1 : 0,
            totalLikes: eventType === 'like' ? 1 : 0,
            totalComments: eventType === 'comment' ? 1 : 0,
            totalShares: eventType === 'share' ? 1 : 0,
            dailyStats: {
              [today]: {
                views: eventType === 'view' ? 1 : 0,
                likes: eventType === 'like' ? 1 : 0,
                comments: eventType === 'comment' ? 1 : 0,
                shares: eventType === 'share' ? 1 : 0,
              },
            },
            lastUpdated: serverTimestamp(),
          };
          transaction.set(analyticsRef, newData);
        } else {
          const data = analyticsDoc.data();
          const dailyStats = data.dailyStats || {};
          const todayStats = dailyStats[today] || { views: 0, likes: 0, comments: 0, shares: 0 };
          
          const updates = {
            [totalField]: increment(1),
            [`dailyStats.${today}.${dailyField}`]: increment(1),
            lastUpdated: serverTimestamp(),
          };
          
          transaction.update(analyticsRef, updates);
        }
      });
    } catch (error) {
      console.warn('⚠️ Track post analytics failed:', error);
    }
  }

  /**
   * Get analytics for a specific post
   * @param {string} postId - Post ID
   * @returns {Object} Post analytics data
   */
  async getPostAnalytics(postId) {
    try {
      await this._ensureInitialized();
      
      const cacheKey = `post_analytics_${postId}`;
      const cached = this.cache.get(cacheKey);
      if (cached) return cached;

      const { doc, getDoc } = await import('firebase/firestore');
      
      const analyticsRef = doc(this.firestore, 'post_analytics', postId);
      const snap = await getDoc(analyticsRef);
      
      if (!snap.exists()) {
        return {
          postId,
          totalViews: 0,
          totalLikes: 0,
          totalComments: 0,
          totalShares: 0,
          dailyStats: [],
          engagementRate: 0,
        };
      }
      
      const data = snap.data();
      const totalEngagement = (data.totalLikes || 0) + (data.totalComments || 0) + (data.totalShares || 0);
      const engagementRate = data.totalViews > 0 
        ? (totalEngagement / data.totalViews) * 100 
        : 0;
      
      const analytics = {
        postId,
        totalViews: data.totalViews || 0,
        totalLikes: data.totalLikes || 0,
        totalComments: data.totalComments || 0,
        totalShares: data.totalShares || 0,
        dailyStats: this._extractDailyStats(data.dailyStats, new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)),
        engagementRate: Math.round(engagementRate * 100) / 100,
        lastUpdated: data.lastUpdated?.toDate?.()?.toISOString() || new Date().toISOString(),
      };
      
      this.cache.set(cacheKey, analytics);
      return analytics;
    } catch (error) {
      console.error('❌ Get post analytics failed:', error);
      throw enhanceError(error, 'Failed to get post analytics');
    }
  }

  // ==================== DEMOGRAPHICS ====================
  /**
   * Get audience demographics for a user
   * @param {string} userId - User ID
   * @returns {Object} Demographics data
   */
  async getAudienceDemographics(userId) {
    try {
      await this._ensureInitialized();
      
      const { doc, getDoc } = await import('firebase/firestore');
      
      const analyticsRef = doc(this.firestore, 'profile_analytics', userId);
      const snap = await getDoc(analyticsRef);
      
      if (!snap.exists() || !snap.data().demographics) {
        return {
          ageGroups: {},
          gender: {},
          locations: {},
          interests: {},
        };
      }
      
      return snap.data().demographics;
    } catch (error) {
      console.error('❌ Get audience demographics failed:', error);
      return {
        ageGroups: {},
        gender: {},
        locations: {},
        interests: {},
      };
    }
  }

  // ==================== GROWTH METRICS ====================
  /**
   * Get follower growth data
   * @param {string} userId - User ID
   * @param {number} days - Number of days to fetch
   * @returns {Array} Daily growth data
   */
  async getFollowerGrowth(userId, days = 30) {
    try {
      await this._ensureInitialized();
      
      const { doc, getDoc, collection, query, where, getDocs, orderBy } = await import('firebase/firestore');
      
      // Get user profile for follower count history
      const userRef = doc(this.firestore, 'users', userId);
      const userSnap = await getDoc(userRef);
      
      if (!userSnap.exists()) return [];
      
      // For now, return estimated growth based on current follower count
      // In production, this would track historical follower counts
      const currentFollowers = userSnap.data().followerCount || 0;
      const estimatedDailyGrowth = currentFollowers / Math.max(days, 1);
      
      const growthData = [];
      for (let i = days - 1; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const daysFromNow = days - i;
        
        growthData.push({
          date: this._getDateString(date),
          followers: Math.round(currentFollowers - (estimatedDailyGrowth * daysFromNow)),
          newFollowers: Math.round(estimatedDailyGrowth),
        });
      }
      
      return growthData;
    } catch (error) {
      console.error('❌ Get follower growth failed:', error);
      return [];
    }
  }

  /**
   * Get engagement trends
   * @param {string} userId - User ID
   * @param {number} days - Number of days
   * @returns {Array} Daily engagement data
   */
  async getEngagementTrends(userId, days = 30) {
    try {
      await this._ensureInitialized();
      
      const analytics = await this.getUserAnalytics(userId, `${days}d`);
      return analytics.dailyStats.map(stat => ({
        date: stat.date,
        engagement: stat.engagement || 0,
        likes: Math.round((stat.engagement || 0) * 0.6), // Estimated
        comments: Math.round((stat.engagement || 0) * 0.3), // Estimated
        shares: Math.round((stat.engagement || 0) * 0.1), // Estimated
      }));
    } catch (error) {
      console.error('❌ Get engagement trends failed:', error);
      return [];
    }
  }

  // ==================== COIN ANALYTICS ====================
  /**
   * Get coin earning history
   * @param {string} userId - User ID
   * @param {number} limitCount - Maximum number of records
   * @returns {Array} Coin earning history
   */
  async getCoinEarningHistory(userId, limitCount = 50) {
    try {
      await this._ensureInitialized();
      
      const { collection, query, where, orderBy, limit, getDocs } = await import('firebase/firestore');
      
      const transactionsRef = collection(this.firestore, 'transactions');
      const q = query(
        transactionsRef,
        where('userId', '==', userId),
        where('type', 'in', ['earn', 'receive_gift', 'receive_tip', 'ad_reward']),
        orderBy('createdAt', 'desc'),
        limit(limitCount)
      );
      
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate?.()?.toISOString(),
      }));
    } catch (error) {
      console.error('❌ Get coin earning history failed:', error);
      return [];
    }
  }

  /**
   * Get coin spending history
   * @param {string} userId - User ID
   * @param {number} limitCount - Maximum number of records
   * @returns {Array} Coin spending history
   */
  async getCoinSpendingHistory(userId, limitCount = 50) {
    try {
      await this._ensureInitialized();
      
      const { collection, query, where, orderBy, limit, getDocs } = await import('firebase/firestore');
      
      const transactionsRef = collection(this.firestore, 'transactions');
      const q = query(
        transactionsRef,
        where('userId', '==', userId),
        where('type', 'in', ['spend', 'send_gift', 'send_tip', 'purchase', 'boost']),
        orderBy('createdAt', 'desc'),
        limit(limitCount)
      );
      
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate?.()?.toISOString(),
      }));
    } catch (error) {
      console.error('❌ Get coin spending history failed:', error);
      return [];
    }
  }

  // ==================== CACHE MANAGEMENT ====================
  clearExpiredCache() {
    const now = Date.now();
    for (const [key, entry] of this.cache.cache.entries()) {
      if (now - entry.timestamp > ANALYTICS_CONFIG.CACHE_TTL) {
        this.cache.delete(key);
      }
    }
  }

  clearCache(userId = null) {
    if (userId) {
      this.cache.delete(`analytics_${userId}_7d`);
      this.cache.delete(`analytics_${userId}_30d`);
      this.cache.delete(`analytics_${userId}_90d`);
      this.cache.delete(`analytics_${userId}_365d`);
    } else {
      this.cache.clear();
    }
  }

  // ==================== CLEANUP ====================
  destroy() {
    if (this._cacheCleanupInterval) {
      clearInterval(this._cacheCleanupInterval);
    }
    
    for (const unsub of this.subscriptions.values()) {
      try { unsub(); } catch (e) {}
    }
    this.subscriptions.clear();
    
    this.cache.clear();
    this.initialized = false;
    this.firestore = null;
    
    console.log('📊 Analytics service destroyed');
  }
}

// ==================== SINGLETON & EXPORTS ====================
let serviceInstance = null;

export function getAnalyticsService() {
  if (!serviceInstance) {
    serviceInstance = new UltimateAnalyticsService();
  }
  return serviceInstance;
}

// Named exports for convenience
export const getUserAnalytics = (userId, timeframe) => 
  getAnalyticsService().getUserAnalytics(userId, timeframe);

export const trackProfileView = (viewerId, profileOwnerId) => 
  getAnalyticsService().trackProfileView(viewerId, profileOwnerId);

export const getCreatorRanking = (userId) => 
  getAnalyticsService().getCreatorRanking(userId);

export const trackPostAnalytics = (postId, eventType, userId) => 
  getAnalyticsService().trackPostAnalytics(postId, eventType, userId);

export const getPostAnalytics = (postId) => 
  getAnalyticsService().getPostAnalytics(postId);

export const getAudienceDemographics = (userId) => 
  getAnalyticsService().getAudienceDemographics(userId);

export const getFollowerGrowth = (userId, days) => 
  getAnalyticsService().getFollowerGrowth(userId, days);

export const getEngagementTrends = (userId, days) => 
  getAnalyticsService().getEngagementTrends(userId, days);

export const getCoinEarningHistory = (userId, limitCount) => 
  getAnalyticsService().getCoinEarningHistory(userId, limitCount);

export const getCoinSpendingHistory = (userId, limitCount) => 
  getAnalyticsService().getCoinSpendingHistory(userId, limitCount);

export const clearAnalyticsCache = (userId) => 
  getAnalyticsService().clearCache(userId);

export default getAnalyticsService;
