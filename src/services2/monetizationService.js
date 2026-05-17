// src/services/monetizationService.js - FINANCIAL-GRADE MONETIZATION ENGINE V3
// 🔒 BILLION-USER PRODUCTION • TARGETED ADS • SPONSORED SEARCH • IAP • FRAUD DETECTION
// ✅ Backward compatible, all fixes applied.

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
  runTransaction,
} from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { getRemoteConfig, getValue } from 'firebase/remote-config';
import { getAnalytics, logEvent } from 'firebase/analytics';

// ---------- crypto‑strong idempotency key ----------
function generateIdempotencyKey() {
  return crypto.randomUUID(); // RFC4122 – guaranteed uniqueness
}

// ---------- custom error class for monetization operations ----------
class MonetizationError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'MonetizationError';
    this.code = code;               // e.g., 'daily-limit-reached', 'insufficient-funds'
    this.details = details;
  }
}

// ---------- DEFAULT CONFIG (fallback) ----------
const DEFAULT_CONFIG = {
  LEVELS: [
    { level: 1, xpRequired: 0, coinReward: 0 },
    { level: 2, xpRequired: 100, coinReward: 10 },
    { level: 3, xpRequired: 300, coinReward: 20 },
    { level: 4, xpRequired: 600, coinReward: 30 },
    { level: 5, xpRequired: 1000, coinReward: 40 },
    { level: 6, xpRequired: 1500, coinReward: 50 },
    { level: 7, xpRequired: 2100, coinReward: 60 },
    { level: 8, xpRequired: 2800, coinReward: 70 },
    { level: 9, xpRequired: 3600, coinReward: 80 },
    { level: 10, xpRequired: 4500, coinReward: 100 },
    { level: 11, xpRequired: 5500, coinReward: 120 },
    { level: 12, xpRequired: 6600, coinReward: 140 },
    { level: 13, xpRequired: 7800, coinReward: 160 },
    { level: 14, xpRequired: 9100, coinReward: 180 },
    { level: 15, xpRequired: 10500, coinReward: 200 },
  ],
  WITHDRAWAL_MIN_LEVEL: 10,
  GIFTS: [
    { type: 'rose', value: 5 },
    { type: 'crown', value: 50 },
    { type: 'diamond', value: 100 },
    { type: 'rocket', value: 500 },
  ],
  BOOST_COST_PER_DAY: 10,
  AD_PLACEMENTS: ['home', 'videos', 'stories', 'messages', 'notifications', 'profile', 'feed'],
  MAX_ADS_PER_USER_PER_DAY: 20,
  AD_CACHE_TTL: 300,                // seconds
  AD_TARGETING_ENABLED: true,       // enable user targeting
  FRAUD_DETECTION: {
    MAX_IMPRESSIONS_PER_MINUTE: 5,  // per user
    MAX_GIFTS_PER_HOUR: 10,
  },
};

// ---------- fetch dynamic config from Remote Config / Firestore ----------
let cachedConfig = null;
async function getMonetizationConfig() {
  if (cachedConfig) return cachedConfig;

  try {
    // Option A: Firebase Remote Config (live updates, low cost)
    const remoteConfig = getRemoteConfig();
    await remoteConfig.fetchAndActivate();
    const levelsStr = getValue(remoteConfig, 'monetization_levels').asString();
    const levels = levelsStr ? JSON.parse(levelsStr) : null;

    // Option B: Firestore fallback (for complex config)
    const db = await getFirestoreInstance();
    const configDoc = await getDoc(doc(db, 'config', 'monetization'));
    if (configDoc.exists()) {
      cachedConfig = configDoc.data();
    } else {
      // Default hardcoded config
      cachedConfig = DEFAULT_CONFIG;
    }
    return cachedConfig;
  } catch (e) {
    console.warn('Using default monetization config', e);
    return DEFAULT_CONFIG;
  }
}

// ---------- Main Service Class ----------
class MonetizationService {
  constructor() {
    this.db = null;
    this.initialized = false;
    this.adCache = new Map();                // in‑memory cache for ads
    this.cacheCleanupInterval = null;        // for periodic cleanup
    this.config = null;
    this.analytics = null;                    // Firebase Analytics instance

    // Cloud Functions – only those that are safe on the client
    this.cfAddCoins = null;
    this.cfSpendCoins = null;
    this.cfTransferCoins = null;
    this.cfSendGift = null;
    this.cfBoostPost = null;
    this.cfRequestWithdrawal = null;
    this.cfRecordAdImpression = null;
    // In‑app purchase verification (new)
    this.cfVerifyPurchase = null;
  }

  async _ensureInitialized() {
    if (!this.initialized) {
      this.db = await getFirestoreInstance();
      this.config = await getMonetizationConfig();
      this.analytics = getAnalytics();        // may be null if not configured

      const functions = getFunctions();
      this.cfAddCoins = httpsCallable(functions, 'addCoins');
      this.cfSpendCoins = httpsCallable(functions, 'spendCoins');
      this.cfTransferCoins = httpsCallable(functions, 'transferCoins');
      this.cfSendGift = httpsCallable(functions, 'sendGift');
      this.cfBoostPost = httpsCallable(functions, 'boostPost');
      this.cfRequestWithdrawal = httpsCallable(functions, 'requestWithdrawal');
      this.cfRecordAdImpression = httpsCallable(functions, 'recordAdImpression');
      this.cfVerifyPurchase = httpsCallable(functions, 'verifyPurchase'); // new

      // Start periodic cache cleanup every 10 minutes
      this._startCacheCleanup();

      this.initialized = true;
      console.log('💰 MonetizationService v3 (financial‑grade) ready');
    }
    return this.db;
  }

  // ---------- periodic cache cleanup ----------
  _startCacheCleanup() {
    if (this.cacheCleanupInterval) clearInterval(this.cacheCleanupInterval);
    this.cacheCleanupInterval = setInterval(() => {
      const now = Date.now();
      for (const [key, entry] of this.adCache.entries()) {
        if (entry.expires <= now) {
          this.adCache.delete(key);
        }
      }
    }, 10 * 60 * 1000); // 10 minutes
  }

  // ---------- stop cleanup (for testing / unmount) ----------
  destroy() {
    if (this.cacheCleanupInterval) {
      clearInterval(this.cacheCleanupInterval);
      this.cacheCleanupInterval = null;
    }
    this.adCache.clear();
  }

  // -------------------- READ-ONLY METHODS --------------------

  async getBalance(userId) {
    await this._ensureInitialized();
    const userRef = doc(this.db, 'users', userId);
    const userSnap = await getDoc(userRef);
    if (!userSnap.exists()) throw new MonetizationError('user-not-found', 'User not found');
    return userSnap.data().coins || 0;
  }

  async getTransactionHistory(userId, limitCount = 50) {
    await this._ensureInitialized();
    const txRef = collection(this.db, 'coin_transactions');
    const q = query(
      txRef,
      where('userId', '==', userId),
      orderBy('createdAt', 'desc'),
      limit(limitCount)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  }

  async getUserLevel(userId) {
    await this._ensureInitialized();
    const userRef = doc(this.db, 'users', userId);
    const userSnap = await getDoc(userRef);
    if (!userSnap.exists()) throw new MonetizationError('user-not-found', 'User not found');

    const data = userSnap.data();
    const currentLevel = data.level || 1;
    const currentXP = data.experience || 0;
    const levels = this.config.LEVELS;

    const nextLevelIndex = levels.findIndex(l => l.level === currentLevel) + 1;
    const nextLevel = nextLevelIndex < levels.length ? levels[nextLevelIndex] : null;

    return {
      level: currentLevel,
      experience: currentXP,
      nextLevelXP: nextLevel ? nextLevel.xpRequired : null,
      xpToNextLevel: nextLevel ? nextLevel.xpRequired - currentXP : 0,
      progress: nextLevel ? ((currentXP - levels[currentLevel-1].xpRequired) / (nextLevel.xpRequired - levels[currentLevel-1].xpRequired)) * 100 : 100,
    };
  }

  async getMonetizationStats(userId) {
    const [balance, levelInfo, txCount] = await Promise.all([
      this.getBalance(userId),
      this.getUserLevel(userId),
      this.getTransactionHistory(userId, 1).then(txs => txs.length),
    ]);
    return { balance, level: levelInfo, totalTransactions: txCount };
  }

  // -------------------- USER PROFILE FOR TARGETING --------------------
  async _getUserProfile(userId) {
    // Fetch user demographics for ad targeting
    const userRef = doc(this.db, 'users', userId);
    const userSnap = await getDoc(userRef);
    if (!userSnap.exists()) return null;
    const data = userSnap.data();
    return {
      age: data.age,
      gender: data.gender,
      interests: data.interests || [],
      location: data.location,
      level: data.level || 1,
    };
  }

  // -------------------- AD METHODS (with targeting, fraud detection) --------------------

  /**
   * Atomically increment the daily ad impression count for a user.
   * Returns an object with { success, newCount, reason } if limit reached.
   */
  async _incrementDailyImpression(userId, placement) {
    await this._ensureInitialized();
    const today = new Date().toISOString().split('T')[0];
    const counterRef = doc(this.db, 'daily_ad_impressions', `${userId}_${today}`);

    // Also check rate limit per minute (fraud detection)
    const minuteKey = `${userId}_${Math.floor(Date.now() / 60000)}`;
    const rateRef = doc(this.db, 'ad_rate_limits', minuteKey);

    return await runTransaction(this.db, async (transaction) => {
      // Daily limit
      const snap = await transaction.get(counterRef);
      const currentDaily = snap.exists() ? snap.data().count : 0;
      if (currentDaily >= this.config.MAX_ADS_PER_USER_PER_DAY) {
        // Return structured object instead of throwing
        return { success: false, reason: 'daily-limit-reached', newCount: currentDaily };
      }

      // Minute rate limit
      const rateSnap = await transaction.get(rateRef);
      const currentMinute = rateSnap.exists() ? rateSnap.data().count : 0;
      if (currentMinute >= this.config.FRAUD_DETECTION.MAX_IMPRESSIONS_PER_MINUTE) {
        return { success: false, reason: 'rate-limited', newCount: currentDaily };
      }

      // Increment both counters
      transaction.set(counterRef, { count: currentDaily + 1 }, { merge: true });
      transaction.set(rateRef, { count: currentMinute + 1 }, { merge: true });
      return { success: true, newCount: currentDaily + 1 };
    });
  }

  async getAd(placement, userId, context = {}) {
    if (!this.config.AD_PLACEMENTS.includes(placement)) {
      throw new MonetizationError('invalid-placement', `Invalid placement: ${placement}`);
    }
    await this._ensureInitialized();

    // Fraud detection: check for suspicious activity (optional)
    this._detectAdFraud(userId, placement).catch(console.warn);

    // 1. Get user profile for targeting
    const userProfile = this.config.AD_TARGETING_ENABLED ? await this._getUserProfile(userId) : null;

    // Build cache key based on placement + targeting keys (if any)
    const targetingKey = userProfile ? `_${userProfile.age}_${userProfile.gender}_${userProfile.interests?.join(',')}` : '';
    const cacheKey = `${placement}${targetingKey}`;

    // Check local cache
    const cached = this.adCache.get(cacheKey);
    if (cached && cached.expires > Date.now()) {
      // Filter ads that match the current context (e.g., category)
      let eligible = cached.ads;
      if (context.category) {
        eligible = eligible.filter(ad => ad.categories?.includes(context.category));
      }
      if (eligible.length === 0) return null;

      const ad = eligible[Math.floor(Math.random() * eligible.length)];

      // Increment persistent counter – may return limit reached
      const incResult = await this._incrementDailyImpression(userId, placement);
      if (!incResult.success) {
        // Log but don't throw; just return null (no ad served)
        logEvent(this.analytics, 'ad_limit_reached', { userId, placement, reason: incResult.reason });
        return null;
      }

      // Fire‑and‑forget impression record
      this.cfRecordAdImpression({ adId: ad.id, userId, placement }).catch(console.warn);
      logEvent(this.analytics, 'ad_impression', { adId: ad.id, placement, userId });

      return { ...ad, cached: true, dailyCount: incResult.newCount };
    }

    // 2. Fetch from Firestore with targeting
    const adsRef = collection(this.db, 'ads');
    let q = query(
      adsRef,
      where('placements', 'array-contains', placement),
      where('active', '==', true),
      where('startDate', '<=', new Date()),
      where('endDate', '>=', new Date()),
      orderBy('priority', 'desc'),
      limit(20) // fetch more for targeting
    );
    let snapshot = await getDocs(q);
    let ads = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    // Apply targeting filters if user profile exists
    if (userProfile && ads.length > 0) {
      ads = ads.filter(ad => this._matchTargeting(ad.targeting, userProfile));
    }

    if (ads.length === 0) return null;

    // Cache the batch
    this.adCache.set(cacheKey, {
      ads,
      expires: Date.now() + this.config.AD_CACHE_TTL * 1000,
    });

    // Select one ad (could also use weighted random based on priority)
    const selected = ads[Math.floor(Math.random() * ads.length)];

    const incResult = await this._incrementDailyImpression(userId, placement);
    if (!incResult.success) {
      logEvent(this.analytics, 'ad_limit_reached', { userId, placement, reason: incResult.reason });
      return null;
    }

    this.cfRecordAdImpression({ adId: selected.id, userId, placement }).catch(console.warn);
    logEvent(this.analytics, 'ad_impression', { adId: selected.id, placement, userId });

    return { ...selected, dailyCount: incResult.newCount };
  }

  // Helper: match ad targeting against user profile
  _matchTargeting(targeting, profile) {
    if (!targeting) return true;
    if (targeting.ageMin && profile.age < targeting.ageMin) return false;
    if (targeting.ageMax && profile.age > targeting.ageMax) return false;
    if (targeting.gender && targeting.gender !== profile.gender) return false;
    if (targeting.interests && targeting.interests.length > 0) {
      if (!profile.interests.some(i => targeting.interests.includes(i))) return false;
    }
    if (targeting.location && targeting.location !== profile.location) return false;
    if (targeting.minLevel && profile.level < targeting.minLevel) return false;
    return true;
  }

  // Fraud detection placeholder
  async _detectAdFraud(userId, placement) {
    // Example: check for excessive impressions in a short time (already done per minute)
    // Could also detect unusual patterns and flag the user
    // For now, just log an event
    logEvent(this.analytics, 'ad_request', { userId, placement });
  }

  // -------------------- SPONSORED SEARCH RESULTS --------------------
  async getSponsoredSearchResult(userId, queryText, context = {}) {
    await this._ensureInitialized();
    if (!queryText || queryText.length < 2) return null;

    // Fetch sponsored items matching the query
    const sponsoredRef = collection(this.db, 'sponsored_results');
    // Simple text matching: can be improved with Algolia or similar
    const q = query(
      sponsoredRef,
      where('keywords', 'array-contains', queryText.toLowerCase()),
      where('active', '==', true),
      orderBy('priority', 'desc'),
      limit(5)
    );
    const snapshot = await getDocs(q);
    const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    // Optionally apply user targeting
    const userProfile = await this._getUserProfile(userId);
    const filtered = items.filter(item => this._matchTargeting(item.targeting, userProfile));

    if (filtered.length === 0) return null;

    // Return the highest priority (or random)
    const selected = filtered[0];
    logEvent(this.analytics, 'sponsored_search_impression', { itemId: selected.id, query: queryText, userId });
    return selected;
  }

  // -------------------- IN-APP PURCHASES --------------------
  async purchaseCoins(userId, productId, receipt, platform = 'ios') {
    await this._ensureInitialized();
    try {
      const result = await this.cfVerifyPurchase({
        userId,
        productId,
        receipt,
        platform,
        idempotencyKey: generateIdempotencyKey(),
      });
      logEvent(this.analytics, 'purchase_completed', { productId, userId, platform });
      return result.data;
    } catch (err) {
      console.error('purchase verification failed:', err);
      // Preserve error code if available
      const code = err.code || 'purchase-verification-failed';
      throw new MonetizationError(code, err.message || 'Purchase verification failed');
    }
  }

  // -------------------- CLOUD FUNCTION WRAPPERS (enhanced error handling) --------------------
  async addCoins(userId, amount, reason, metadata = {}, idempotencyKey = null) {
    await this._ensureInitialized();
    try {
      const key = idempotencyKey || generateIdempotencyKey();
      const result = await this.cfAddCoins({ userId, amount, reason, metadata, idempotencyKey: key });
      logEvent(this.analytics, 'coins_added', { userId, amount, reason });
      return result.data;
    } catch (err) {
      const code = err.code || 'add-coins-failed';
      throw new MonetizationError(code, err.message || 'Failed to add coins');
    }
  }

  async spendCoins(userId, amount, reason, metadata = {}, idempotencyKey = null) {
    await this._ensureInitialized();
    try {
      const key = idempotencyKey || generateIdempotencyKey();
      const result = await this.cfSpendCoins({ userId, amount, reason, metadata, idempotencyKey: key });
      logEvent(this.analytics, 'coins_spent', { userId, amount, reason });
      return result.data;
    } catch (err) {
      const code = err.code || 'spend-coins-failed';
      throw new MonetizationError(code, err.message || 'Failed to spend coins');
    }
  }

  async transferCoins(fromUserId, toUserId, amount, reason, metadata = {}, idempotencyKey = null) {
    await this._ensureInitialized();
    try {
      const key = idempotencyKey || generateIdempotencyKey();
      const result = await this.cfTransferCoins({ fromUserId, toUserId, amount, reason, metadata, idempotencyKey: key });
      logEvent(this.analytics, 'coins_transferred', { fromUserId, toUserId, amount, reason });
      return result.data;
    } catch (err) {
      const code = err.code || 'transfer-coins-failed';
      throw new MonetizationError(code, err.message || 'Failed to transfer coins');
    }
  }

  async sendGift(senderId, postId, giftType, idempotencyKey = null) {
    await this._ensureInitialized();
    // Fraud detection: check gift frequency
    const recentGifts = await this._checkGiftRate(senderId);
    if (recentGifts >= this.config.FRAUD_DETECTION.MAX_GIFTS_PER_HOUR) {
      throw new MonetizationError('gift-rate-exceeded', 'Too many gifts sent recently');
    }
    try {
      const key = idempotencyKey || generateIdempotencyKey();
      const result = await this.cfSendGift({ senderId, postId, giftType, idempotencyKey: key });
      logEvent(this.analytics, 'gift_sent', { senderId, postId, giftType });
      return result.data;
    } catch (err) {
      const code = err.code || 'send-gift-failed';
      throw new MonetizationError(code, err.message || 'Failed to send gift');
    }
  }

  async _checkGiftRate(userId) {
    // Count gifts sent in last hour
    const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const giftsRef = collection(this.db, 'coin_transactions');
    const q = query(
      giftsRef,
      where('userId', '==', userId),
      where('type', '==', 'debit'),
      where('reason', '==', 'gift'),
      where('createdAt', '>=', hourAgo)
    );
    const snap = await getDocs(q);
    return snap.size;
  }

  async boostPost(userId, postId, days, idempotencyKey = null) {
    await this._ensureInitialized();
    try {
      const key = idempotencyKey || generateIdempotencyKey();
      const result = await this.cfBoostPost({ userId, postId, days, idempotencyKey: key });
      logEvent(this.analytics, 'post_boosted', { userId, postId, days });
      return result.data;
    } catch (err) {
      const code = err.code || 'boost-post-failed';
      throw new MonetizationError(code, err.message || 'Failed to boost post');
    }
  }

  async requestWithdrawal(userId, amount, paymentMethod, paymentDetails, idempotencyKey = null) {
    await this._ensureInitialized();
    try {
      const key = idempotencyKey || generateIdempotencyKey();
      const result = await this.cfRequestWithdrawal({ userId, amount, paymentMethod, paymentDetails, idempotencyKey: key });
      logEvent(this.analytics, 'withdrawal_requested', { userId, amount, paymentMethod });
      return result.data;
    } catch (err) {
      const code = err.code || 'withdrawal-request-failed';
      throw new MonetizationError(code, err.message || 'Failed to request withdrawal');
    }
  }

  // ----------------------------------------------------------------------
  // NOTE: processWithdrawal is deliberately omitted.
  // It should be called only from a secure admin environment.
  // ----------------------------------------------------------------------
}

// -------------------- SINGLETON & EXPORTS --------------------
let instance = null;
export function getMonetizationService() {
  if (!instance) instance = new MonetizationService();
  return instance;
}

// Named exports for backward compatibility + new ones
export async function getBalance(userId) { return getMonetizationService().getBalance(userId); }
export async function getTransactionHistory(userId, limitCount) { return getMonetizationService().getTransactionHistory(userId, limitCount); }
export async function getUserLevel(userId) { return getMonetizationService().getUserLevel(userId); }
export async function getMonetizationStats(userId) { return getMonetizationService().getMonetizationStats(userId); }
export async function getAd(placement, userId, context) { return getMonetizationService().getAd(placement, userId, context); }
export async function getSponsoredSearchResult(userId, query, context) { return getMonetizationService().getSponsoredSearchResult(userId, query, context); }

export async function addCoins(userId, amount, reason, metadata, idempotencyKey) {
  return getMonetizationService().addCoins(userId, amount, reason, metadata, idempotencyKey);
}
export async function spendCoins(userId, amount, reason, metadata, idempotencyKey) {
  return getMonetizationService().spendCoins(userId, amount, reason, metadata, idempotencyKey);
}
export async function transferCoins(fromUserId, toUserId, amount, reason, metadata, idempotencyKey) {
  return getMonetizationService().transferCoins(fromUserId, toUserId, amount, reason, metadata, idempotencyKey);
}
export async function sendGift(senderId, postId, giftType, idempotencyKey) {
  return getMonetizationService().sendGift(senderId, postId, giftType, idempotencyKey);
}
export async function boostPost(userId, postId, days, idempotencyKey) {
  return getMonetizationService().boostPost(userId, postId, days, idempotencyKey);
}
export async function requestWithdrawal(userId, amount, paymentMethod, paymentDetails, idempotencyKey) {
  return getMonetizationService().requestWithdrawal(userId, amount, paymentMethod, paymentDetails, idempotencyKey);
}
export async function purchaseCoins(userId, productId, receipt, platform) {  // new
  return getMonetizationService().purchaseCoins(userId, productId, receipt, platform);
}

export default getMonetizationService();