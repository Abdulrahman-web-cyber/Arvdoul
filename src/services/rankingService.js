import { logger } from '../utils/Logger.js';
import { unknownNumber } from '../lib/unknownNumber.js';

import { getFirestoreInstance } from '../firebase/firebase.js';
import { collection, doc, getDoc, getDocs, query, where, orderBy, limit } from "firebase/firestore";

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

export class RankingError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'RankingError';
    this.code = `ranking/${code}`;
    this.details = details;
    this.timestamp = new Date().toISOString();
  }
}

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
        logger.info('[RankingService] Initialized successfully');
      } catch (error) {
        logger.error('[RankingService] Initialization failed:', error);
        throw error;
      }
    })();

    return this.initPromise;
  }

  async ensureInitialized() {
    if (!this.initialized) await this.initialize();
  }

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

  /**
   * Author ids whose leaderboard rows the viewer must not see: blocked,
   * blocked-by and muted users, read through the graph spine's bounded,
   * rules-provable edge lists. Fails open (empty set) only when the read errors.
   */
  async _getHiddenAuthors(userId) {
    if (!userId) return new Set();
    try {
      const { getSocialGraphService } = await import('./socialGraphService.js');
      return await getSocialGraphService().getHiddenAuthorIds(userId);
    } catch (err) {
      logger.warn('[RankingService] hidden-author read failed; not filtering', { error: err?.message });
      return new Set();
    }
  }

  _isHidden(hidden, id, viewerId) {
    if (!id) return false;
    if (viewerId && id === viewerId) return false;
    return hidden.has(id);
  }

  async getCreatorRankings(category = 'engagement', timeRange = 'month', offset = 0, viewerId = null) {
    await this.ensureInitialized();

    const hidden = await this._getHiddenAuthors(viewerId);
    const cacheKey = this._getCacheKey(`creator_${category}`, timeRange, offset) + (viewerId ? `_v_${viewerId}` : '');
    const cached = this._getFromCache(cacheKey);
    if (cached) return cached;

    try {
      const rankingsRef = collection(this.firestore, 'rankings', 'creators', category);
      const q = query(
        rankingsRef,
        where('timeRange', '==', timeRange),
        orderBy('score', 'desc'),
        // Offset paging via a bounded read + slice: the modular SDK has no
        // offset(), and passing a raw number to startAfter() compares it to
        // `score` (which silently broke page 2+).
        limit(offset + RANKING_CONFIG.PAGE_SIZE)
      );

      const snapshot = await getDocs(q);
      const pageDocs = snapshot.docs.slice(offset);
      const rankings = [];
      const userMap = await this._fetchUsersByIds(pageDocs.map((d) => d.data().userId));

      for (let i = 0; i < pageDocs.length; i++) {
        const doc = pageDocs[i];
        const data = doc.data();
        
        // Batched user lookup (kills N+1)
        let user = null;
        if (data.userId && userMap.has(data.userId)) {
          user = userMap.get(data.userId);
        }

        rankings.push({
          rank: offset + i + 1,
          userId: data.userId,
          user,
          score: data.score,
          trend: data.trend ?? null, // positive = up, negative = down; null = unmeasured
          badge: this._getTier(data.score),
        });
      }

      const visible = rankings.filter((r) => !this._isHidden(hidden, r.userId, viewerId));
      visible.forEach((r, i) => { r.rank = offset + i + 1; });
      this._setCache(cacheKey, visible);
      return visible;
    } catch (error) {
      logger.error('[RankingService] Creator rankings unavailable (no fabricated data):', error);
      return [];
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
      logger.error('[RankingService] Failed to get creator rank:', error);
      return null;
    }
  }

  async getWealthRankings(category = 'net_worth', timeRange = 'month', offset = 0, viewerId = null) {
    await this.ensureInitialized();

    const hidden = await this._getHiddenAuthors(viewerId);
    const cacheKey = this._getCacheKey(`wealth_${category}`, timeRange, offset) + (viewerId ? `_v_${viewerId}` : '');
    const cached = this._getFromCache(cacheKey);
    if (cached) return cached;

    try {
      const rankingsRef = collection(this.firestore, 'rankings', 'wealth', category);
      const q = query(
        rankingsRef,
        where('timeRange', '==', timeRange),
        orderBy('score', 'desc'),
        // Offset paging via a bounded read + slice: the modular SDK has no
        // offset(), and passing a raw number to startAfter() compares it to
        // `score` (which silently broke page 2+).
        limit(offset + RANKING_CONFIG.PAGE_SIZE)
      );

      const snapshot = await getDocs(q);
      const pageDocs = snapshot.docs.slice(offset);
      const rankings = [];
      const userMap = await this._fetchUsersByIds(pageDocs.map((d) => d.data().userId));

      for (let i = 0; i < pageDocs.length; i++) {
        const doc = pageDocs[i];
        const data = doc.data();
        
        // Batched user lookup (kills N+1)
        let user = null;
        if (data.userId && userMap.has(data.userId)) {
          user = userMap.get(data.userId);
        }

        rankings.push({
          rank: offset + i + 1,
          userId: data.userId,
          user,
          score: data.score,
          trend: data.trend ?? null,
          badge: this._getTier(data.score),
        });
      }

      const visible = rankings.filter((r) => !this._isHidden(hidden, r.userId, viewerId));
      visible.forEach((r, i) => { r.rank = offset + i + 1; });
      this._setCache(cacheKey, visible);
      return visible;
    } catch (error) {
      logger.error('[RankingService] Failed to get wealth rankings:', error);
      return [];
    }
  }

  async getReputationRankings(category = 'trust', timeRange = 'month', offset = 0, viewerId = null) {
    await this.ensureInitialized();

    const hidden = await this._getHiddenAuthors(viewerId);
    const cacheKey = this._getCacheKey(`reputation_${category}`, timeRange, offset) + (viewerId ? `_v_${viewerId}` : '');
    const cached = this._getFromCache(cacheKey);
    if (cached) return cached;

    try {
      const rankingsRef = collection(this.firestore, 'rankings', 'reputation', category);
      const q = query(
        rankingsRef,
        where('timeRange', '==', timeRange),
        orderBy('score', 'desc'),
        // Offset paging via a bounded read + slice: the modular SDK has no
        // offset(), and passing a raw number to startAfter() compares it to
        // `score` (which silently broke page 2+).
        limit(offset + RANKING_CONFIG.PAGE_SIZE)
      );

      const snapshot = await getDocs(q);
      const pageDocs = snapshot.docs.slice(offset);
      const rankings = [];
      const userMap = await this._fetchUsersByIds(pageDocs.map((d) => d.data().userId));

      for (let i = 0; i < pageDocs.length; i++) {
        const doc = pageDocs[i];
        const data = doc.data();
        
        // Batched user lookup (kills N+1)
        let user = null;
        if (data.userId && userMap.has(data.userId)) {
          user = userMap.get(data.userId);
        }

        rankings.push({
          rank: offset + i + 1,
          userId: data.userId,
          user,
          score: data.score,
          trend: data.trend ?? null,
          badge: this._getTier(data.score),
          badges: this._getBadges(data.badges || []),
        });
      }

      const visible = rankings.filter((r) => !this._isHidden(hidden, r.userId, viewerId));
      visible.forEach((r, i) => { r.rank = offset + i + 1; });
      this._setCache(cacheKey, visible);
      return visible;
    } catch (error) {
      logger.error('[RankingService] Failed to get reputation rankings:', error);
      return [];
    }
  }

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
        // Offset paging via a bounded read + slice: the modular SDK has no
        // offset(), and passing a raw number to startAfter() compares it to
        // `score` (which silently broke page 2+).
        limit(offset + RANKING_CONFIG.PAGE_SIZE)
      );

      const snapshot = await getDocs(q);
      const pageDocs = snapshot.docs.slice(offset);
      const rankings = [];

      for (let i = 0; i < pageDocs.length; i++) {
        const doc = pageDocs[i];
        const data = doc.data();
        
        rankings.push({
          rank: offset + i + 1,
          communityId: doc.id,
          community: data,
          score: data.score,
          trend: data.trend ?? null,
        });
      }

      this._setCache(cacheKey, rankings);
      return rankings;
    } catch (error) {
      logger.error('[RankingService] Failed to get community rankings:', error);
      return [];
    }
  }

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
        // Offset paging via a bounded read + slice: the modular SDK has no
        // offset(), and passing a raw number to startAfter() compares it to
        // `score` (which silently broke page 2+).
        limit(offset + RANKING_CONFIG.PAGE_SIZE)
      );

      const snapshot = await getDocs(q);
      const pageDocs = snapshot.docs.slice(offset);
      const trending = pageDocs.map((doc, i) => ({
        rank: offset + i + 1,
        id: doc.id,
        ...doc.data(),
      }));

      this._setCache(cacheKey, trending);
      return trending;
    } catch (error) {
      logger.error('[RankingService] Failed to get trending content:', error);
      return [];
    }
  }

  async getRisingCreators(timeRange = 'week', offset = 0, viewerId = null) {
    await this.ensureInitialized();

    const hidden = await this._getHiddenAuthors(viewerId);
    const cacheKey = this._getCacheKey('rising_creators', timeRange, offset) + (viewerId ? `_v_${viewerId}` : '');
    const cached = this._getFromCache(cacheKey);
    if (cached) return cached;

    try {
      const risingRef = collection(this.firestore, 'rankings', 'rising', 'creators');
      const q = query(
        risingRef,
        where('timeRange', '==', timeRange),
        orderBy('growthRate', 'desc'),
        // Offset paging via a bounded read + slice: the modular SDK has no
        // offset(), and passing a raw number to startAfter() compares it to
        // `score` (which silently broke page 2+).
        limit(offset + RANKING_CONFIG.PAGE_SIZE)
      );

      const snapshot = await getDocs(q);
      const pageDocs = snapshot.docs.slice(offset);
      const rising = [];
      const userMap = await this._fetchUsersByIds(pageDocs.map((d) => d.data().userId));

      for (let i = 0; i < pageDocs.length; i++) {
        const doc = pageDocs[i];
        const data = doc.data();
        
        // Batched user lookup (kills N+1)
        let user = null;
        if (data.userId && userMap.has(data.userId)) {
          user = userMap.get(data.userId);
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

      const visible = rising.filter((r) => !this._isHidden(hidden, r.userId, viewerId));
      visible.forEach((r, i) => { r.rank = offset + i + 1; });
      this._setCache(cacheKey, visible);
      return visible;
    } catch (error) {
      logger.error('[RankingService] Failed to get rising creators:', error);
      return [];
    }
  }

  async getUserReputation(userId) {
    await this.ensureInitialized();

    try {
      const repRef = doc(this.firestore, 'reputation', userId);
      const snap = await getDoc(repRef);
      
      if (snap.exists()) {
        return snap.data();
      }
      
      // No reputation document exists: report absence rather than inventing a
      // plausible-but-false trust score/tier.
      return null;
    } catch (error) {
      logger.error('[RankingService] Failed to get user reputation:', error);
      return null;
    }
  }

  /**
   * REAL badge computation from live user stats. Returns a map keyed by badge
   * id: { earned, progress, target } — progress/target are null when the
   * metric cannot be computed cheaply (the UI must show "—" then, never a
   * fabricated number). No badges are ever claimed without real evidence.
   */
  async getUserBadges(userId) {
    await this.ensureInitialized();

    const result = {};
    const today = new Date();

    try {
      const userSnap = await getDoc(doc(this.firestore, 'users', userId));
      const userData = userSnap.exists() ? userSnap.data() : {};

      const followerCount = Number(userData.followerCount || userData.stats?.followers || 0);
      const followingCount = Number(userData.followingCount || userData.stats?.following || 0);
      const createdAt = userData.createdAt?.toDate?.() || (userData.createdAt ? new Date(userData.createdAt) : null);
      const accountDays = createdAt && !Number.isNaN(createdAt.getTime())
        ? Math.max(0, Math.floor((today.getTime() - createdAt.getTime()) / 86400000))
        : null;
      const isPremium = !!(userData.subscription?.tier || userData.subscriptionTier || userData.isPremium);
      const isVerified = !!(userData.isVerified || userData.verified || userData.badges?.includes?.('verified'));

      // Real content stats.
      let posts = [];
      try {
        const postsSnap = await getDocs(
          query(collection(this.firestore, 'posts'), where('authorId', '==', userId), where('isDeleted', '==', false), where('status', '==', 'published'), where('visibility', '==', 'public'), limit(500))
        );
        posts = postsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
      } catch (err) {
        logger.warn('[RankingService] posts stats unavailable:', err.message);
      }

      // Sum the per-post counters, but only while every counter is known: a
      // post whose `stats` block was never written contributes an *unknown*
      // count, and adding it as 0 would understate the badge total as if it
      // were measured. Any unknown makes the aggregate null (rendered '—').
      let totalLikes = 0;
      let totalViews = 0;
      let totalComments = 0;
      let sparkCount = 0;
      let countsComplete = true;
      const addKnown = (raw) => {
        const n = unknownNumber(raw);
        if (n === null) { countsComplete = false; return 0; }
        return n;
      };
      for (const p of posts) {
        totalLikes += addKnown(p.stats?.likes ?? p.likes);
        totalViews += addKnown(p.stats?.views ?? p.views);
        totalComments += addKnown(p.stats?.comments ?? p.comments);
        if (p.type === 'spark') sparkCount += 1;
      }
      if (!countsComplete) {
        totalLikes = null;
        totalViews = null;
        totalComments = null;
      }

      let storyCount = 0;
      try {
        const sSnap = await getDocs(
          query(collection(this.firestore, 'stories'), where('userId', '==', userId), limit(500))
        );
        storyCount = sSnap.size;
      } catch (e) {
        logger.warn('Story count unavailable; story badges stay unknown', { userId, error: e?.message });
      }

      const defs = {
        first_like: { progress: totalLikes, target: 1 },
        like_master: { progress: totalLikes, target: 1000 },
        first_comment: { progress: totalComments, target: 1 },
        commentator: { progress: totalComments, target: 500 },
        viral_post: { progress: totalViews, target: 10000 },
        trendsetter: { progress: null, target: 5 }, // not cheaply computable
        first_follower: { progress: followerCount, target: 1 },
        influencer: { progress: followerCount, target: 10000 },
        supporter: { progress: followingCount, target: 100 },
        conversation_starter: { progress: totalComments, target: 50 },
        first_post: { progress: posts.length, target: 1 },
        prolific_creator: { progress: posts.length, target: 100 },
        spark_master: { progress: sparkCount, target: 50 },
        storyteller: { progress: storyCount, target: 100 },
        verified: { progress: isVerified ? 1 : 0, target: 1 },
        founder: { progress: null, target: 1 }, // first-1000 cohort is not exposed to the client
        premium: { progress: isPremium ? 1 : 0, target: 1 },
        year_one: { progress: accountDays, target: 365 },
      };

      const earned = {
        first_like: totalLikes >= 1,
        like_master: totalLikes >= 1000,
        first_comment: totalComments >= 1,
        commentator: totalComments >= 500,
        viral_post: totalViews >= 10000,
        trendsetter: false,
        first_follower: followerCount >= 1,
        influencer: followerCount >= 10000,
        supporter: followingCount >= 100,
        conversation_starter: totalComments >= 50,
        first_post: posts.length >= 1,
        prolific_creator: posts.length >= 100,
        spark_master: sparkCount >= 50,
        storyteller: storyCount >= 100,
        verified: isVerified,
        founder: false,
        premium: isPremium,
        year_one: accountDays != null && accountDays >= 365,
      };

      for (const [id, def] of Object.entries(defs)) {
        result[id] = { earned: earned[id], progress: def.progress, target: def.target };
      }

      return result;
    } catch (error) {
      logger.error('[RankingService] Failed to get user badges:', error);
      return {};
    }
  }

  // Fetches user docs for many ids with `where('__name__', 'in', chunk)` in
  // chunks of 30 (Firestore limit) — 1-2 round trips instead of one per user.
  async _fetchUsersByIds(userIds) {
    const unique = [...new Set((userIds || []).filter(Boolean))];
    const users = new Map();
    if (unique.length === 0) return users;
    for (let i = 0; i < unique.length; i += 30) {
      const chunk = unique.slice(i, i + 30);
      try {
        const snap = await getDocs(
          query(collection(this.firestore, 'users'), where('__name__', 'in', chunk))
        );
        snap.forEach((d) => users.set(d.id, { id: d.id, ...d.data() }));
      } catch (err) {
        logger.warn('[RankingService] batched user fetch failed (chunk skipped):', err.message);
      }
    }
    return users;
  }

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

  getStats() {
    return {
      initialized: this.initialized,
      cacheSize: this.cache.size,
    };
  }

  refresh() {
    this._clearCache();
    logger.info('[RankingService] Cache cleared');
  }
}

let instance = null;
export function getRankingService() {
  if (!instance) instance = new RankingService();
  return instance;
}

const rankingService = {
  initialize: () => getRankingService().initialize(),
  ensureInitialized: () => getRankingService().ensureInitialized(),
  getCreatorRankings: (c, t, o, v) => getRankingService().getCreatorRankings(c, t, o, v),
  getCreatorRank: (uid, c) => getRankingService().getCreatorRank(uid, c),
  getWealthRankings: (c, t, o, v) => getRankingService().getWealthRankings(c, t, o, v),
  getReputationRankings: (c, t, o, v) => getRankingService().getReputationRankings(c, t, o, v),
  getCommunityRankings: (c, t, o) => getRankingService().getCommunityRankings(c, t, o),
  getTrendingContent: (t, r, o) => getRankingService().getTrendingContent(t, r, o),
  getRisingCreators: (t, o, v) => getRankingService().getRisingCreators(t, o, v),
  getUserReputation: (uid) => getRankingService().getUserReputation(uid),
  getUserBadges: (uid) => getRankingService().getUserBadges(uid),
  refresh: () => getRankingService().refresh(),
  getStats: () => getRankingService().getStats(),
  getService: getRankingService,
};

export default rankingService;
