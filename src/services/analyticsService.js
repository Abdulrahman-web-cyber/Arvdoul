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
import { logger } from '../utils/Logger.js';
import { auditLogger } from '../utils/AuditLogger.js';
import { rateLimiter } from '../utils/RateLimiter.js';
import { cacheManager } from '../utils/CacheManager.js';
import { countersManager } from '../utils/CountersManager.js';
import { errorHandler } from '../utils/ErrorHandler.js';

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
  // Configurable via VITE_ANALYTICS_RANKING_TOP_N (env) - no hardcoded value.
  RANKING_TOP_N: Number(import.meta.env?.VITE_ANALYTICS_RANKING_TOP_N) || 100,
  // Rate limits (generous - UX guard; server enforces the real boundary)
  RATE_LIMITS: {
    TRACK_VIEW_MAX: 120, // profile view writes per minute per viewer
    HISTORY_READ_MAX: 60, // coin history reads per minute per user
  },
  SNAPSHOT_COLLECTION: 'user_daily_stats', // follower-count snapshots (migration: REFACTOR_PROGRESS.md)
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
    // Centralized cache (CacheManager namespace) - replaces local LRU Map.
    this.cache = cacheManager.namespace('analytics', ANALYTICS_CONFIG.CACHE_TTL);
    this.subscriptions = new Map();
    this._cacheCleanupInterval = null;

    if (typeof window !== 'undefined') {
      this._cacheCleanupInterval = setInterval(() => this.clearExpiredCache(), 5 * 60 * 1000);
    }

//     this.initialize().catch(err => logger.warn('Analytics service init warning:', err.message));
  }

  // ==================== INITIALIZATION ====================
  async initialize() {
    if (this.initialized && this.firestore) return this.firestore;

    try {
      // Analytics service initializing
      const firebase = await import('../firebase/firebase.js');
      this.firestore = await firebase.getFirestoreInstance();

      const { enableIndexedDbPersistence } = await import('firebase/firestore');
      try {
        await enableIndexedDbPersistence(this.firestore);
        // Analytics persistence enabled
      } catch (e) {
//         logger.warn('⚠️ Analytics persistence not available:', e.message);
      }

      this.initialized = true;
      return this.firestore;
    } catch (error) {
      logger.error('Analytics initialization failed', { error: error.message });
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

        // Shard-backed totals with legacy fallback (no shards = old doc value).
        const docPath = `profile_analytics/${userId}`;
        const [totalViews, totalReach] = await Promise.all([
          countersManager.get({ docPath, field: 'totalViews', fallback: data.totalViews || 0 }),
          countersManager.get({ docPath, field: 'totalReach', fallback: data.totalReach || 0 }),
        ]);

        analytics = {
          ...analytics,
          totalViews,
          totalReach,
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

      // Get ranking safely
      try {
        analytics.ranking = await this.getCreatorRanking(userId);
      } catch (rankErr) {
        analytics.ranking = { rank: null, totalCreators: 100, percentile: 50 };
      }

      this.cache.set(cacheKey, analytics);
      return analytics;
    } catch (error) {
      logger.error('Get user analytics failed', { error: error.message });
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

    // Client-side UX guard against view-write storms (server rules enforce the real boundary).
    const rl = rateLimiter.checkAndHit(`analytics:view:${viewerId}`, { max: ANALYTICS_CONFIG.RATE_LIMITS.TRACK_VIEW_MAX, windowMs: 60000 });
    if (!rl.allowed) return; // silently drop excess view events

    try {
      await this._ensureInitialized();

      const { doc, getDoc, setDoc, serverTimestamp, runTransaction } = await import('firebase/firestore');
      const today = this._getDateString();
      const viewDocId = this._generateDocId(viewerId, profileOwnerId, today);

      // Dedupe: one analytics write per (viewer, owner, day) - no per-view hot writes.
      const viewRef = doc(this.firestore, 'profile_views', viewDocId);
      const existingView = await getDoc(viewRef);
      if (existingView.exists()) return;

      // Record the view
      await setDoc(viewRef, {
        viewerId,
        profileOwnerId,
        viewedAt: serverTimestamp(),
        date: today,
      });

      // Sharded counters for totalViews/totalReach (no hot profile_analytics doc).
      const docPath = `profile_analytics/${profileOwnerId}`;
      await countersManager.increment({ docPath, field: 'totalViews' });
      await countersManager.increment({ docPath, field: 'totalReach' });

      // Daily stats: bounded map (365 days), written at most once per viewer per day.
      const analyticsRef = doc(this.firestore, 'profile_analytics', profileOwnerId);
      await runTransaction(this.firestore, async (transaction) => {
        const analyticsDoc = await transaction.get(analyticsRef);

        if (!analyticsDoc.exists()) {
          transaction.set(analyticsRef, {
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

      // Invalidate cache (centralized CacheManager)
      this.cache.invalidatePattern(`analytics_${profileOwnerId}_*`);
      countersManager.invalidate({ docPath, field: 'totalViews' });
      countersManager.invalidate({ docPath, field: 'totalReach' });
    } catch (error) {
      logger.warn('Track profile view failed', { error: error.message, profileOwnerId });
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
//       logger.warn('⚠️ Get creator ranking failed:', error);
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

      // Totals via sharded counters (no hot post_analytics doc).
      const docPath = `post_analytics/${postId}`;
      await countersManager.increment({ docPath, field: totalField });

      // Daily stats: bounded per-day map, written via transaction.
      await runTransaction(this.firestore, async (transaction) => {
        const analyticsDoc = await transaction.get(analyticsRef);
        
        if (!analyticsDoc.exists()) {
          const newData = {
            postId,
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
            [`dailyStats.${today}.${dailyField}`]: increment(1),
            lastUpdated: serverTimestamp(),
          };
          
          transaction.update(analyticsRef, updates);
        }
      });
      countersManager.invalidate({ docPath, field: totalField });
    } catch (error) {
//       logger.warn('⚠️ Track post analytics failed:', error);
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
      const docPath = `post_analytics/${postId}`;
      const [totalViews, totalLikes, totalComments, totalShares] = await Promise.all([
        countersManager.get({ docPath, field: 'totalViews', fallback: data.totalViews || 0 }),
        countersManager.get({ docPath, field: 'totalLikes', fallback: data.totalLikes || 0 }),
        countersManager.get({ docPath, field: 'totalComments', fallback: data.totalComments || 0 }),
        countersManager.get({ docPath, field: 'totalShares', fallback: data.totalShares || 0 }),
      ]);
      const totalEngagement = totalLikes + totalComments + totalShares;
      const engagementRate = totalViews > 0
        ? (totalEngagement / totalViews) * 100
        : 0;
      
      const analytics = {
        postId,
        totalViews,
        totalLikes,
        totalComments,
        totalShares,
        dailyStats: this._extractDailyStats(data.dailyStats, new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)),
        engagementRate: Math.round(engagementRate * 100) / 100,
        lastUpdated: data.lastUpdated?.toDate?.()?.toISOString() || new Date().toISOString(),
      };
      
      this.cache.set(cacheKey, analytics);
      return analytics;
    } catch (error) {
      logger.error('Get post analytics failed', { error: error.message });
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
      logger.error('Get audience demographics failed', { error: error.message });
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
      
      const { doc, getDoc, collection, query, where, getDocs, orderBy, limit } = await import('firebase/firestore');
      
      // Real historical follower snapshots (user_daily_stats) when available.
      const snapshotsRef = collection(this.firestore, ANALYTICS_CONFIG.SNAPSHOT_COLLECTION);
      const q = query(
        snapshotsRef,
        where('userId', '==', userId),
        where('type', '==', 'follower_count'),
        orderBy('date', 'desc'),
        limit(days)
      );
      const snapshot = await getDocs(q);
      if (!snapshot.empty) {
        const growthData = snapshot.docs
          .map(d => d.data())
          .reverse()
          .map(s => ({
            date: s.date,
            followers: s.value || 0,
            newFollowers: s.delta || 0,
          }));
        return growthData;
      }

      // Fallback (legacy behavior): estimated growth from current follower count.
      // NOTE: keep until snapshot collection is populated (migration plan:
      // userService.followUser/unfollowUser record daily snapshots).
      const userRef = doc(this.firestore, 'users', userId);
      const userSnap = await getDoc(userRef);
      
      if (!userSnap.exists()) return [];
      
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
      logger.error('Get follower growth failed', { error: error.message, userId });
      return [];
    }
  }

  /**
   * Record a daily follower-count snapshot (called by userService on
   * follow/unfollow changes). New export - no existing behavior removed.
   * @param {string} userId
   * @param {number} followerCount
   */
  async recordFollowerSnapshot(userId, followerCount) {
    if (!userId || typeof followerCount !== 'number') return;
    try {
      await this._ensureInitialized();
      const { doc, setDoc, serverTimestamp } = await import('firebase/firestore');
      const today = this._getDateString();
      const ref = doc(this.firestore, ANALYTICS_CONFIG.SNAPSHOT_COLLECTION, `${userId}_${today}`);
      await setDoc(ref, {
        userId,
        type: 'follower_count',
        date: today,
        value: followerCount,
        recordedAt: serverTimestamp(),
      }, { merge: true });
    } catch (error) {
      logger.warn('Record follower snapshot failed', { error: error.message, userId });
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
      // Real per-day engagement from stored daily stats (no fabricated ratios).
      return analytics.dailyStats.map(stat => ({
        date: stat.date,
        engagement: stat.engagement || 0,
        likes: stat.likes || 0,
        comments: stat.comments || 0,
        shares: stat.shares || 0,
        views: stat.views || 0,
        reach: stat.reach || 0,
      }));
    } catch (error) {
      logger.error('Get engagement trends failed', { error: error.message, userId });
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
      
      // Client-side UX guard against history-scraping storms.
      const rl = rateLimiter.checkAndHit(`analytics:history:${userId}`, { max: ANALYTICS_CONFIG.RATE_LIMITS.HISTORY_READ_MAX, windowMs: 60000 });
      if (!rl.allowed) {
        throw errorHandler.enhance(new Error('Rate limit exceeded for analytics history'), { code: 5001, defaultMessage: 'Too many analytics requests. Please try again shortly.' });
      }

      // Audit analytics data access (GDPR/CCPA compliance).
      auditLogger.log('analytics.read', { userId, meta: { resource: 'coin_earning_history', limit: limitCount } });

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
      const results = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate?.()?.toISOString(),
      }));
      // Cursor pagination support: nextCursor attached to the array (backward-compatible).
      results.nextCursor = snapshot.docs.length === limitCount ? snapshot.docs[snapshot.docs.length - 1].id : null;
      return results;
    } catch (error) {
      if (error?.errorCode) throw error;
      logger.error('Get coin earning history failed', { error: error.message, userId });
      return [];
    }
  }

  /**
   * Cursor-paginated coin earning history (new export - additive).
   * @param {string} userId
   * @param {Object} [options] { limit, cursor }
   * @returns {Promise<{items: Array, nextCursor: string|null, hasMore: boolean}>}
   */
  async getCoinEarningHistoryPage(userId, options = {}) {
    const { limit: limitCount = 50, cursor = null } = options;
    try {
      await this._ensureInitialized();

      const rl = rateLimiter.checkAndHit(`analytics:history:${userId}`, { max: ANALYTICS_CONFIG.RATE_LIMITS.HISTORY_READ_MAX, windowMs: 60000 });
      if (!rl.allowed) {
        throw errorHandler.enhance(new Error('Rate limit exceeded for analytics history'), { code: 5001, defaultMessage: 'Too many analytics requests. Please try again shortly.' });
      }

      auditLogger.log('analytics.read', { userId, meta: { resource: 'coin_earning_history', limit: limitCount, cursor } });

      const { collection, query, where, orderBy, limit, getDocs, startAfter, doc: fDoc, getDoc } = await import('firebase/firestore');
      const transactionsRef = collection(this.firestore, 'transactions');
      let q = query(
        transactionsRef,
        where('userId', '==', userId),
        where('type', 'in', ['earn', 'receive_gift', 'receive_tip', 'ad_reward']),
        orderBy('createdAt', 'desc'),
        limit(limitCount)
      );
      if (cursor) {
        const cursorRef = fDoc(this.firestore, 'transactions', cursor);
        const cursorSnap = await getDoc(cursorRef);
        if (cursorSnap.exists()) q = query(q, startAfter(cursorSnap));
      }
      const snapshot = await getDocs(q);
      const items = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate?.()?.toISOString(),
      }));
      const hasMore = snapshot.docs.length === limitCount;
      return { items, hasMore, nextCursor: hasMore ? snapshot.docs[snapshot.docs.length - 1].id : null };
    } catch (error) {
      if (error?.errorCode) throw error;
      logger.error('Get coin earning history page failed', { error: error.message, userId });
      return { items: [], hasMore: false, nextCursor: null };
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

      const rl = rateLimiter.checkAndHit(`analytics:history:${userId}`, { max: ANALYTICS_CONFIG.RATE_LIMITS.HISTORY_READ_MAX, windowMs: 60000 });
      if (!rl.allowed) {
        throw errorHandler.enhance(new Error('Rate limit exceeded for analytics history'), { code: 5001, defaultMessage: 'Too many analytics requests. Please try again shortly.' });
      }

      auditLogger.log('analytics.read', { userId, meta: { resource: 'coin_spending_history', limit: limitCount } });

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
      const results = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate?.()?.toISOString(),
      }));
      results.nextCursor = snapshot.docs.length === limitCount ? snapshot.docs[snapshot.docs.length - 1].id : null;
      return results;
    } catch (error) {
      if (error?.errorCode) throw error;
      logger.error('Get coin spending history failed', { error: error.message, userId });
      return [];
    }
  }

  /**
   * Cursor-paginated coin spending history (new export - additive).
   * @param {string} userId
   * @param {Object} [options] { limit, cursor }
   * @returns {Promise<{items: Array, nextCursor: string|null, hasMore: boolean}>}
   */
  async getCoinSpendingHistoryPage(userId, options = {}) {
    const { limit: limitCount = 50, cursor = null } = options;
    try {
      await this._ensureInitialized();

      const rl = rateLimiter.checkAndHit(`analytics:history:${userId}`, { max: ANALYTICS_CONFIG.RATE_LIMITS.HISTORY_READ_MAX, windowMs: 60000 });
      if (!rl.allowed) {
        throw errorHandler.enhance(new Error('Rate limit exceeded for analytics history'), { code: 5001, defaultMessage: 'Too many analytics requests. Please try again shortly.' });
      }

      auditLogger.log('analytics.read', { userId, meta: { resource: 'coin_spending_history', limit: limitCount, cursor } });

      const { collection, query, where, orderBy, limit, getDocs, startAfter, doc: fDoc, getDoc } = await import('firebase/firestore');
      const transactionsRef = collection(this.firestore, 'transactions');
      let q = query(
        transactionsRef,
        where('userId', '==', userId),
        where('type', 'in', ['spend', 'send_gift', 'send_tip', 'purchase', 'boost']),
        orderBy('createdAt', 'desc'),
        limit(limitCount)
      );
      if (cursor) {
        const cursorRef = fDoc(this.firestore, 'transactions', cursor);
        const cursorSnap = await getDoc(cursorRef);
        if (cursorSnap.exists()) q = query(q, startAfter(cursorSnap));
      }
      const snapshot = await getDocs(q);
      const items = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate?.()?.toISOString(),
      }));
      const hasMore = snapshot.docs.length === limitCount;
      return { items, hasMore, nextCursor: hasMore ? snapshot.docs[snapshot.docs.length - 1].id : null };
    } catch (error) {
      if (error?.errorCode) throw error;
      logger.error('Get coin spending history page failed', { error: error.message, userId });
      return { items: [], hasMore: false, nextCursor: null };
    }
  }

  // ==================== CACHE MANAGEMENT ====================
  clearExpiredCache() {
    const now = Date.now();
    for (const [key, entry] of cacheManager.getStore().entries()) {
      if (key.startsWith('analytics:') && entry.expiresAt && now > entry.expiresAt) {
        cacheManager.getStore().delete(key);
      }
    }
  }

  clearCache(userId = null) {
    if (userId) {
      this.cache.invalidatePattern(`analytics_${userId}_*`);
      cacheManager.invalidateUser(userId);
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
    
    // Analytics service destroyed
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

export const getCoinEarningHistoryPage = (userId, options) =>
  getAnalyticsService().getCoinEarningHistoryPage(userId, options);

export const getCoinSpendingHistoryPage = (userId, options) =>
  getAnalyticsService().getCoinSpendingHistoryPage(userId, options);

export const recordFollowerSnapshot = (userId, followerCount) =>
  getAnalyticsService().recordFollowerSnapshot(userId, followerCount);

export const clearAnalyticsCache = (userId) => 
  getAnalyticsService().clearCache(userId);

export default getAnalyticsService;
