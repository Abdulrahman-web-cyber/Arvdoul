// src/services/rankingService.js – ARVDOUL RANKINGS & REPUTATION SERVICE V1
// 🏆 Ranking System for Creators, Content, Communities
// ✅ Creator Rankings • Wealth Rankings • Reputation • Community Rankings

import { getFirestoreInstance } from '../firebase/firebase.js';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  serverTimestamp,
  increment,
} from 'firebase/firestore';

// ==================== CONFIGURATION ====================
export const RANKING_CONFIG = {
  CATEGORIES: {
    CREATORS: {
      ENGAGEMENT: { id: 'engagement', name: 'Engagement', icon: '📊' },
      VIEWS: { id: 'views', name: 'Views', icon: '👁️' },
      GROWTH: { id: 'growth', name: 'Growth', icon: '📈' },
      REVENUE: { id: 'revenue', name: 'Revenue', icon: '💰' },
    },
    WEALTH: {
      NET_WORTH: { id: 'net_worth', name: 'Net Worth', icon: '💎' },
      COINS: { id: 'coins', name: 'Coins', icon: '🪙' },
      EARNINGS: { id: 'earnings', name: 'Earnings', icon: '💵' },
    },
    REPUTATION: {
      TRUST: { id: 'trust', name: 'Trust Score', icon: '✅' },
      CONTRIBUTIONS: { id: 'contributions', name: 'Contributions', icon: '🏅' },
      MODERATION: { id: 'moderation', name: 'Moderation', icon: '🛡️' },
      RELIABILITY: { id: 'reliability', name: 'Reliability', icon: '⭐' },
    },
    COMMUNITIES: {
      ACTIVITY: { id: 'activity', name: 'Activity', icon: '🔥' },
      GROWTH: { id: 'growth', name: 'Growth', icon: '📈' },
      ENGAGEMENT: { id: 'engagement', name: 'Engagement', icon: '💬' },
    },
  },
  TIME_RANGES: [
    { id: 'day', name: 'Today' },
    { id: 'week', name: 'This Week' },
    { id: 'month', name: 'This Month' },
    { id: 'year', name: 'This Year' },
    { id: 'all', name: 'All Time' },
  ],
  TIERS: [
    { id: 'bronze', name: 'Bronze', min: 0, max: 99, color: '#cd7f32' },
    { id: 'silver', name: 'Silver', min: 100, max: 499, color: '#c0c0c0' },
    { id: 'gold', name: 'Gold', min: 500, max: 1999, color: '#ffd700' },
    { id: 'platinum', name: 'Platinum', min: 2000, max: 4999, color: '#e5e4e2' },
    { id: 'diamond', name: 'Diamond', min: 5000, max: 9999, color: '#b9f2ff' },
    { id: 'legend', name: 'Legend', min: 10000, max: Infinity, color: '#9b59b6' },
  ],
  BADGES: [
    { id: 'verified', name: 'Verified', icon: '✓', description: 'Identity verified' },
    { id: 'creator', name: 'Creator', icon: '🎬', description: 'Content creator' },
    { id: 'contributor', name: 'Top Contributor', icon: '🏆', description: 'Top 1% contributor' },
    { id: 'moderator', name: 'Moderator', icon: '🛡️', description: 'Community moderator' },
    { id: 'supporter', name: 'Supporter', icon: '💪', description: 'Top supporter' },
    { id: 'early_adopter', name: 'Early Adopter', icon: '🚀', description: 'Joined early' },
    { id: 'streak_30', name: '30 Day Streak', icon: '🔥', description: '30 day activity streak' },
    { id: 'streak_100', name: '100 Day Streak', icon: '💯', description: '100 day activity streak' },
    { id: 'million_views', name: 'Million Views', icon: '👁️', description: '1M+ total views' },
    { id: 'first_content', name: 'First Content', icon: '📝', description: 'Published first content' },
  ],
  PAGE_SIZE: 20,
};

// ==================== CUSTOM ERROR ====================
export class RankingError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'RankingError';
    this.code = `ranking/${code}`;
    this.details = details;
    this.timestamp = new Date().toISOString();
  }
}

// ==================== RANKING SERVICE ====================
class RankingService {
  constructor() {
    this.firestore = null;
    this.initialized = false;
    this.initPromise = null;
    this.cache = new Map();
    this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
  }

  async initialize() {
    if (this.initialized) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = (async () => {
      try {
        this.firestore = getFirestoreInstance();
        this.initialized = true;
        console.log('[RankingService] Initialized successfully');
      } catch (error) {
        console.error('[RankingService] Initialization failed:', error);
        throw error;
      }
    })();

    return this.initPromise;
  }

  async ensureInitialized() {
    if (!this.initialized) await this.initialize();
  }

  // ==================== CACHE MANAGEMENT ====================
  _getCacheKey(category, timeRange, offset = 0) {
    return `${category}_${timeRange}_${offset}`;
  }

  _getFromCache(key) {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.data;
    }
    return null;
  }

  _setCache(key, data) {
    this.cache.set(key, { data, timestamp: Date.now() });
  }

  _clearCache() {
    this.cache.clear();
  }

  // ==================== CREATOR RANKINGS ====================
  async getCreatorRankings(category = 'engagement', timeRange = 'month', offset = 0) {
    await this.ensureInitialized();

    const cacheKey = this._getCacheKey(`creator_${category}`, timeRange, offset);
    const cached = this._getFromCache(cacheKey);
    if (cached) return cached;

    try {
      const rankingsRef = collection(this.firestore, 'rankings', 'creators', category);
      const q = query(
        rankingsRef,
        where('timeRange', '==', timeRange),
        orderBy('score', 'desc'),
        startAfter(offset),
        limit(RANKING_CONFIG.PAGE_SIZE)
      );

      const snapshot = await getDocs(q);
      const rankings = [];

      for (let i = 0; i < snapshot.docs.length; i++) {
        const doc = snapshot.docs[i];
        const data = doc.data();
        
        // Get user details
        let user = null;
        if (data.userId) {
          const userRef = doc(this.firestore, 'users', data.userId);
          const userSnap = await getDoc(userRef);
          if (userSnap.exists()) {
            user = {
              id: userSnap.id,
              ...userSnap.data(),
            };
          }
        }

        rankings.push({
          rank: offset + i + 1,
          userId: data.userId,
          user,
          score: data.score,
          trend: data.trend || 0, // positive = up, negative = down
          badge: this._getTier(data.score),
        });
      }

      this._setCache(cacheKey, rankings);
      return rankings;
    } catch (error) {
      console.error('[RankingService] Failed to get creator rankings:', error);
      // Return mock data for demo
      return this._getMockCreatorRankings(category, offset);
    }
  }

  async getCreatorRank(userId, category = 'engagement') {
    await this.ensureInitialized();

    try {
      const rankRef = doc(this.firestore, 'rankings', 'creators', category, 'ranks', userId);
      const snap = await getDoc(rankRef);
      
      if (snap.exists()) {
        return snap.data();
      }
      
      return null;
    } catch (error) {
      console.error('[RankingService] Failed to get creator rank:', error);
      return null;
    }
  }

  // ==================== WEALTH RANKINGS ====================
  async getWealthRankings(category = 'net_worth', timeRange = 'month', offset = 0) {
    await this.ensureInitialized();

    const cacheKey = this._getCacheKey(`wealth_${category}`, timeRange, offset);
    const cached = this._getFromCache(cacheKey);
    if (cached) return cached;

    try {
      const rankingsRef = collection(this.firestore, 'rankings', 'wealth', category);
      const q = query(
        rankingsRef,
        where('timeRange', '==', timeRange),
        orderBy('score', 'desc'),
        startAfter(offset),
        limit(RANKING_CONFIG.PAGE_SIZE)
      );

      const snapshot = await getDocs(q);
      const rankings = [];

      for (let i = 0; i < snapshot.docs.length; i++) {
        const doc = snapshot.docs[i];
        const data = doc.data();
        
        let user = null;
        if (data.userId) {
          const userRef = doc(this.firestore, 'users', data.userId);
          const userSnap = await getDoc(userRef);
          if (userSnap.exists()) {
            user = { id: userSnap.id, ...userSnap.data() };
          }
        }

        rankings.push({
          rank: offset + i + 1,
          userId: data.userId,
          user,
          score: data.score,
          trend: data.trend || 0,
          badge: this._getTier(data.score),
        });
      }

      this._setCache(cacheKey, rankings);
      return rankings;
    } catch (error) {
      console.error('[RankingService] Failed to get wealth rankings:', error);
      return this._getMockWealthRankings(category, offset);
    }
  }

  // ==================== REPUTATION RANKINGS ====================
  async getReputationRankings(category = 'trust', timeRange = 'month', offset = 0) {
    await this.ensureInitialized();

    const cacheKey = this._getCacheKey(`reputation_${category}`, timeRange, offset);
    const cached = this._getFromCache(cacheKey);
    if (cached) return cached;

    try {
      const rankingsRef = collection(this.firestore, 'rankings', 'reputation', category);
      const q = query(
        rankingsRef,
        where('timeRange', '==', timeRange),
        orderBy('score', 'desc'),
        startAfter(offset),
        limit(RANKING_CONFIG.PAGE_SIZE)
      );

      const snapshot = await getDocs(q);
      const rankings = [];

      for (let i = 0; i < snapshot.docs.length; i++) {
        const doc = snapshot.docs[i];
        const data = doc.data();
        
        let user = null;
        if (data.userId) {
          const userRef = doc(this.firestore, 'users', data.userId);
          const userSnap = await getDoc(userRef);
          if (userSnap.exists()) {
            user = { id: userSnap.id, ...userSnap.data() };
          }
        }

        rankings.push({
          rank: offset + i + 1,
          userId: data.userId,
          user,
          score: data.score,
          trend: data.trend || 0,
          badge: this._getTier(data.score),
          badges: this._getBadges(data.badges || []),
        });
      }

      this._setCache(cacheKey, rankings);
      return rankings;
    } catch (error) {
      console.error('[RankingService] Failed to get reputation rankings:', error);
      return this._getMockReputationRankings(category, offset);
    }
  }

  // ==================== COMMUNITY RANKINGS ====================
  async getCommunityRankings(category = 'activity', timeRange = 'month', offset = 0) {
    await this.ensureInitialized();

    const cacheKey = this._getCacheKey(`community_${category}`, timeRange, offset);
    const cached = this._getFromCache(cacheKey);
    if (cached) return cached;

    try {
      const rankingsRef = collection(this.firestore, 'rankings', 'communities', category);
      const q = query(
        rankingsRef,
        where('timeRange', '==', timeRange),
        orderBy('score', 'desc'),
        startAfter(offset),
        limit(RANKING_CONFIG.PAGE_SIZE)
      );

      const snapshot = await getDocs(q);
      const rankings = [];

      for (let i = 0; i < snapshot.docs.length; i++) {
        const doc = snapshot.docs[i];
        const data = doc.data();
        
        rankings.push({
          rank: offset + i + 1,
          communityId: doc.id,
          community: data,
          score: data.score,
          trend: data.trend || 0,
        });
      }

      this._setCache(cacheKey, rankings);
      return rankings;
    } catch (error) {
      console.error('[RankingService] Failed to get community rankings:', error);
      return this._getMockCommunityRankings(category, offset);
    }
  }

  // ==================== TRENDING CONTENT ====================
  async getTrendingContent(type = 'videos', timeRange = 'day', offset = 0) {
    await this.ensureInitialized();

    const cacheKey = this._getCacheKey(`trending_${type}`, timeRange, offset);
    const cached = this._getFromCache(cacheKey);
    if (cached) return cached;

    try {
      const trendingRef = collection(this.firestore, 'trending', type);
      const q = query(
        trendingRef,
        where('timeRange', '==', timeRange),
        orderBy('score', 'desc'),
        startAfter(offset),
        limit(RANKING_CONFIG.PAGE_SIZE)
      );

      const snapshot = await getDocs(q);
      const trending = snapshot.docs.map((doc, i) => ({
        rank: offset + i + 1,
        id: doc.id,
        ...doc.data(),
      }));

      this._setCache(cacheKey, trending);
      return trending;
    } catch (error) {
      console.error('[RankingService] Failed to get trending content:', error);
      return this._getMockTrendingContent(type, offset);
    }
  }

  // ==================== RISING CREATORS ====================
  async getRisingCreators(timeRange = 'week', offset = 0) {
    await this.ensureInitialized();

    const cacheKey = this._getCacheKey('rising_creators', timeRange, offset);
    const cached = this._getFromCache(cacheKey);
    if (cached) return cached;

    try {
      const risingRef = collection(this.firestore, 'rankings', 'rising', 'creators');
      const q = query(
        risingRef,
        where('timeRange', '==', timeRange),
        orderBy('growthRate', 'desc'),
        startAfter(offset),
        limit(RANKING_CONFIG.PAGE_SIZE)
      );

      const snapshot = await getDocs(q);
      const rising = [];

      for (let i = 0; i < snapshot.docs.length; i++) {
        const doc = snapshot.docs[i];
        const data = doc.data();
        
        let user = null;
        if (data.userId) {
          const userRef = doc(this.firestore, 'users', data.userId);
          const userSnap = await getDoc(userRef);
          if (userSnap.exists()) {
            user = { id: userSnap.id, ...userSnap.data() };
          }
        }

        rising.push({
          rank: offset + i + 1,
          userId: data.userId,
          user,
          growthRate: data.growthRate,
          previousRank: data.previousRank,
          currentRank: data.currentRank,
        });
      }

      this._setCache(cacheKey, rising);
      return rising;
    } catch (error) {
      console.error('[RankingService] Failed to get rising creators:', error);
      return this._getMockRisingCreators(offset);
    }
  }

  // ==================== USER REPUTATION ====================
  async getUserReputation(userId) {
    await this.ensureInitialized();

    try {
      const repRef = doc(this.firestore, 'reputation', userId);
      const snap = await getDoc(repRef);
      
      if (snap.exists()) {
        return snap.data();
      }
      
      // Return default reputation
      return {
        trust: 50,
        contributions: 0,
        moderation: 0,
        reliability: 50,
        totalScore: 50,
        tier: 'bronze',
        badges: [],
        history: [],
      };
    } catch (error) {
      console.error('[RankingService] Failed to get user reputation:', error);
      return null;
    }
  }

  async getUserBadges(userId) {
    await this.ensureInitialized();

    try {
      const badgesRef = collection(this.firestore, 'users', userId, 'badges');
      const snap = await getDocs(badgesRef);
      
      const badges = [];
      snap.docs.forEach((doc) => {
        const badgeData = doc.data();
        const badgeConfig = RANKING_CONFIG.BADGES.find(b => b.id === badgeData.badgeId);
        if (badgeConfig) {
          badges.push({
            ...badgeConfig,
            earnedAt: badgeData.earnedAt,
          });
        }
      });

      return badges;
    } catch (error) {
      console.error('[RankingService] Failed to get user badges:', error);
      return [];
    }
  }

  // ==================== HELPER METHODS ====================
  _getTier(score) {
    for (const tier of RANKING_CONFIG.TIERS) {
      if (score >= tier.min && score <= tier.max) {
        return tier;
      }
    }
    return RANKING_CONFIG.TIERS[0];
  }

  _getBadges(badgeIds) {
    return badgeIds
      .map((id) => RANKING_CONFIG.BADGES.find((b) => b.id === id))
      .filter(Boolean);
  }

  // ==================== MOCK DATA FOR DEMO ====================
  _getMockCreatorRankings(category, offset) {
    const mockUsers = [
      { username: 'creator_one', displayName: 'Creative Creator', avatar: null },
      { username: 'video_master', displayName: 'Video Master', avatar: null },
      { username: 'content_king', displayName: 'Content King', avatar: null },
      { username: 'trending_star', displayName: 'Trending Star', avatar: null },
      { username: 'viral_vibes', displayName: 'Viral Vibes', avatar: null },
    ];

    return mockUsers.slice(0, RANKING_CONFIG.PAGE_SIZE).map((user, i) => ({
      rank: offset + i + 1,
      userId: `user_${i}`,
      user: { ...user, id: `user_${i}` },
      score: Math.floor(Math.random() * 10000) + 1000 - offset * 100,
      trend: Math.floor(Math.random() * 10) - 5,
      badge: this._getTier(Math.random() * 10000),
    }));
  }

  _getMockWealthRankings(category, offset) {
    return this._getMockCreatorRankings(category, offset).map((r) => ({
      ...r,
      score: Math.floor(Math.random() * 100000) + 10000 - offset * 1000,
    }));
  }

  _getMockReputationRankings(category, offset) {
    return this._getMockCreatorRankings(category, offset).map((r) => ({
      ...r,
      score: Math.floor(Math.random() * 1000) + 100 - offset * 10,
      badges: RANKING_CONFIG.BADGES.slice(0, Math.floor(Math.random() * 5)),
    }));
  }

  _getMockCommunityRankings(category, offset) {
    const communities = [
      { name: 'Tech Enthusiasts', description: 'Technology discussion', icon: '💻' },
      { name: 'Creative Arts', description: 'Art and design community', icon: '🎨' },
      { name: 'Gaming Hub', description: 'Gaming community', icon: '🎮' },
      { name: 'Music Lovers', description: 'Music discussion', icon: '🎵' },
      { name: 'Sports Central', description: 'Sports fans', icon: '⚽' },
    ];

    return communities.slice(0, RANKING_CONFIG.PAGE_SIZE).map((community, i) => ({
      rank: offset + i + 1,
      communityId: `community_${i}`,
      community,
      score: Math.floor(Math.random() * 5000) + 500 - offset * 50,
      trend: Math.floor(Math.random() * 10) - 5,
      members: Math.floor(Math.random() * 10000) + 100,
    }));
  }

  _getMockTrendingContent(type, offset) {
    return Array.from({ length: RANKING_CONFIG.PAGE_SIZE }, (_, i) => ({
      rank: offset + i + 1,
      id: `${type}_${i}`,
      title: `Trending ${type} #${offset + i + 1}`,
      type,
      views: Math.floor(Math.random() * 100000),
      likes: Math.floor(Math.random() * 10000),
      comments: Math.floor(Math.random() * 1000),
      createdAt: new Date().toISOString(),
    }));
  }

  _getMockRisingCreators(offset) {
    return this._getMockCreatorRankings('growth', offset).map((r) => ({
      ...r,
      growthRate: Math.floor(Math.random() * 500) + 50,
      previousRank: r.rank + Math.floor(Math.random() * 10) - 5,
      currentRank: r.rank,
    }));
  }

  // ==================== SERVICE MANAGEMENT ====================
  getStats() {
    return {
      initialized: this.initialized,
      cacheSize: this.cache.size,
    };
  }

  refresh() {
    this._clearCache();
    console.log('[RankingService] Cache cleared');
  }
}

// ==================== SINGLETON EXPORT ====================
let instance = null;
export function getRankingService() {
  if (!instance) instance = new RankingService();
  return instance;
}

const rankingService = {
  initialize: () => getRankingService().initialize(),
  ensureInitialized: () => getRankingService().ensureInitialized(),
  getCreatorRankings: (c, t, o) => getRankingService().getCreatorRankings(c, t, o),
  getCreatorRank: (uid, c) => getRankingService().getCreatorRank(uid, c),
  getWealthRankings: (c, t, o) => getRankingService().getWealthRankings(c, t, o),
  getReputationRankings: (c, t, o) => getRankingService().getReputationRankings(c, t, o),
  getCommunityRankings: (c, t, o) => getRankingService().getCommunityRankings(c, t, o),
  getTrendingContent: (t, r, o) => getRankingService().getTrendingContent(t, r, o),
  getRisingCreators: (t, o) => getRankingService().getRisingCreators(t, o),
  getUserReputation: (uid) => getRankingService().getUserReputation(uid),
  getUserBadges: (uid) => getRankingService().getUserBadges(uid),
  refresh: () => getRankingService().refresh(),
  getStats: () => getRankingService().getStats(),
  getService: getRankingService,
};

export default rankingService;
