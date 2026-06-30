// src/services/monetizationService.js - ARVDOUL ULTIMATE MONETIZATION ENGINE v5.0 (BILLION-SCALE)
// 🔒 FINANCIAL-GRADE • DOUBLE-ENTRY LEDGER • DYNAMIC CONFIG • FRAUD RESISTANT
// 👑 GENDER‑AWARE ROYAL POSITIONS • MOST POPULAR RANKS
// 💰 COIN PURCHASE (STRIPE) • AD REWARDS • SUBSCRIPTION TIERS • CREATOR PAYOUTS
// ✅ ALL OPERATIONS DELEGATED TO CLOUD FUNCTIONS FOR SECURITY
// ✅ SERVER‑SIDE DAILY AD LIMITS, NO CLIENT‑SIDE BYPASS
// ✅ FIXED: offline queue sync lifecycle, JSON.parse crash, ad cache leak, fake online detection
// ✅ FIXED: config timing safety, leaderboard index hint, destroy() cleanup
// ✅ ADDED: Firestore outbox pattern fallback for offline queue (not just IndexedDB)

import { getFirestoreInstance } from '../firebase/firebase.js';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit as firestoreLimit,
  addDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { getRemoteConfig, getValue, fetchAndActivate, setLogLevel } from 'firebase/remote-config';
import { openDB } from 'idb';

// ---------- safe browser globals ----------
const hasDocument = typeof document !== 'undefined';
const hasWindow = typeof window !== 'undefined';
const hasPerformance = typeof performance !== 'undefined' && performance.now;

// ---------- crypto‑strong idempotency key with fallback ----------
function generateIdempotencyKey() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  const perf = hasPerformance ? performance.now() : 0;
  return `${Date.now()}-${Math.random().toString(36).slice(2)}-${perf}`;
}

// ---------- DEFAULT CONFIG (all amounts in COINS or CENTS) ----------
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
  AD_PLACEMENTS: ['home', 'videos', 'stories', 'messages', 'notifications', 'profile', 'feed', 'conversation_list', 'search'],
  MAX_ADS_PER_USER_PER_DAY: 20,
  AD_CACHE_TTL: 300, // seconds
  POSITION_THRESHOLDS: {
    KING: 1000000,
    QUEEN: 1000000,
    PRINCE: 500000,
    PRINCESS: 500000,
    DUKE: 250000,
    DUCHESS: 250000,
    LORD: 100000,
    LADY: 100000,
    RICH: 50000,
    WEALTHY: 10000,
  },
  POPULARITY_THRESHOLDS: {
    LEGEND: 1000000,
    ICON: 500000,
    SUPERSTAR: 100000,
    STAR: 50000,
    RISING: 10000,
  },
  SUBSCRIPTION_TIERS: {
    PREMIUM: { priceCents: 999, coinsPerMonth: 1000, features: ['no_ads', 'exclusive_stickers'] },
    CREATOR: { priceCents: 1999, coinsPerMonth: 5000, features: ['no_ads', 'exclusive_stickers', 'payouts', 'analytics'] },
    ENTERPRISE: { priceCents: 9999, coinsPerMonth: 25000, features: ['all_creator_features', 'priority_support', 'verified_badge'] }
  },
  AD_REWARD_COINS: {
    SHORT: 1,
    MEDIUM: 2,
    LONG: 5,
  },
  REMOTE_CONFIG_MIN_FETCH_INTERVAL_MS: 3600000,
};

// ---------- safe JSON parse with fallback ----------
function safeJsonParse(str, fallback) {
  if (!str) return fallback;
  try {
    return JSON.parse(str);
  } catch (e) {
    console.warn('Failed to parse remote config value, using fallback', e);
    return fallback;
  }
}

// ---------- fetch dynamic config from Remote Config (cached, with min interval) ----------
let cachedConfig = null;
let configPromise = null;
async function getMonetizationConfig(forceRefresh = false) {
  if (!forceRefresh && cachedConfig) return cachedConfig;
  if (configPromise && !forceRefresh) return configPromise;

  configPromise = (async () => {
    try {
      const remoteConfig = getRemoteConfig();
      remoteConfig.settings = {
        minimumFetchIntervalMillis: DEFAULT_CONFIG.REMOTE_CONFIG_MIN_FETCH_INTERVAL_MS,
      };
      if (process.env.NODE_ENV === 'production') {
        setLogLevel(remoteConfig, 'error');
      }
      await fetchAndActivate(remoteConfig);
      const levelsStr = getValue(remoteConfig, 'monetization_levels').asString();
      const positionsStr = getValue(remoteConfig, 'position_thresholds').asString();
      const popularityStr = getValue(remoteConfig, 'popularity_thresholds').asString();
      const subsStr = getValue(remoteConfig, 'subscription_tiers').asString();

      const levels = safeJsonParse(levelsStr, null);
      const positionThresholds = safeJsonParse(positionsStr, null);
      const popularityThresholds = safeJsonParse(popularityStr, null);
      const subscriptionTiers = safeJsonParse(subsStr, null);

      const db = await getFirestoreInstance();
      const configDoc = await getDoc(doc(db, 'config', 'monetization'));
      let finalConfig = { ...DEFAULT_CONFIG };
      if (configDoc.exists()) {
        finalConfig = { ...finalConfig, ...configDoc.data() };
      }
      if (levels) finalConfig.LEVELS = levels;
      if (positionThresholds) finalConfig.POSITION_THRESHOLDS = positionThresholds;
      if (popularityThresholds) finalConfig.POPULARITY_THRESHOLDS = popularityThresholds;
      if (subscriptionTiers) finalConfig.SUBSCRIPTION_TIERS = subscriptionTiers;
      cachedConfig = finalConfig;
      return finalConfig;
    } catch (e) {
      console.warn('Using default monetization config', e);
      cachedConfig = DEFAULT_CONFIG;
      return DEFAULT_CONFIG;
    } finally {
      configPromise = null;
    }
  })();
  return configPromise;
}

// ---------- retry helper for Cloud Function calls ----------
async function retryOperation(fn, maxRetries = 3, baseDelay = 1000) {
  let lastError;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (attempt === maxRetries) break;
      const delay = baseDelay * Math.pow(2, attempt - 1) + Math.random() * 200;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  throw lastError;
}

// ---------- Offline queue (IndexedDB + Firestore outbox) with fixed event binding ----------
class OfflineMonetizationQueue {
  constructor(service) {
    this.service = service; // store reference to service for sync
    this.dbPromise = openDB('monetization_offline', 1, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('queue')) {
          db.createObjectStore('queue', { autoIncrement: true });
        }
      },
    });
    this.isSyncing = false;
    this._boundSync = this.sync.bind(this);

    if (hasDocument) {
      document.addEventListener('visibilitychange', this._boundSync);
    }
    if (hasWindow) {
      window.addEventListener('online', this._boundSync);
    }
  }

  async add(operation, params) {
    const db = await this.dbPromise;
    await db.add('queue', { operation, params, timestamp: Date.now() });
    // Also write to Firestore outbox (backup)
    if (this.service && this.service.db) {
      try {
        await addDoc(collection(this.service.db, 'monetization_outbox'), {
          operation,
          params,
          createdAt: serverTimestamp(),
          status: 'pending',
          userId: params.userId || null,
        });
      } catch (e) { /* silent */ }
    }
    this.sync();
  }

  async getAll() {
    const db = await this.dbPromise;
    const tx = db.transaction('queue', 'readonly');
    const store = tx.objectStore('queue');
    const [items, keys] = await Promise.all([store.getAll(), store.getAllKeys()]);
    return items.map((item, index) => ({
      id: keys[index],
      ...item,
    }));
  }

  async delete(id) {
    const db = await this.dbPromise;
    await db.delete('queue', id);
  }

  async sync() {
    if (!this.service || !this.service.initialized || this.isSyncing) return;
    this.isSyncing = true;
    try {
      const queue = await this.getAll();
      for (const item of queue) {
        try {
          if (item.operation === 'watchAd') {
            await this.service.watchAd(item.params.placement, item.params.adId, item.params.watchDurationSeconds);
          } else if (item.operation === 'purchaseCoins') {
            await this.service.purchaseCoins(item.params.packageId, item.params.paymentMethodId);
          }
          await this.delete(item.id);
        } catch (err) {
          console.warn('Offline sync failed, will retry later', err);
          if (Date.now() - item.timestamp > 7 * 24 * 60 * 60 * 1000) {
            await this.delete(item.id);
          }
        }
      }
    } finally {
      this.isSyncing = false;
    }
  }

  destroy() {
    if (hasDocument) {
      document.removeEventListener('visibilitychange', this._boundSync);
    }
    if (hasWindow) {
      window.removeEventListener('online', this._boundSync);
    }
  }
}

// ---------- Main Service Class ----------
class MonetizationService {
  constructor() {
    this.db = null;
    this.initialized = false;
    this.adCache = new Map();
    this.config = null;
    this.offlineQueue = null; // will be created after _ensureInitialized
    this.cleanupInterval = null;
    this.destroyed = false;

    // Cloud Functions references
    this.cfAddCoins = null;
    this.cfSpendCoins = null;
    this.cfTransferCoins = null;
    this.cfSendGift = null;
    this.cfBoostPost = null;
    this.cfRequestWithdrawal = null;
    this.cfRecordAdImpression = null;
    this.cfGetSponsoredSearchResult = null;
    this.cfGetAd = null;
    this.cfWatchAd = null;
    this.cfPurchaseCoins = null;
    this.cfGetSubscriptionStatus = null;
    this.cfCreateSubscription = null;
    this.cfCancelSubscription = null;
    this.cfGetPayoutSettings = null;
    this.cfCreatePayoutAccount = null;
  }

  async _ensureInitialized() {
    if (this.destroyed) throw new Error('MonetizationService has been destroyed');
    if (!this.initialized) {
      this.db = await getFirestoreInstance();
      this.config = await getMonetizationConfig();
      // create offline queue with reference to this service
      this.offlineQueue = new OfflineMonetizationQueue(this);

      const functions = getFunctions();
      this.cfAddCoins = httpsCallable(functions, 'addCoins');
      this.cfSpendCoins = httpsCallable(functions, 'spendCoins');
      this.cfTransferCoins = httpsCallable(functions, 'transferCoins');
      this.cfSendGift = httpsCallable(functions, 'sendGift');
      this.cfBoostPost = httpsCallable(functions, 'boostPost');
      this.cfRequestWithdrawal = httpsCallable(functions, 'requestWithdrawal');
      this.cfRecordAdImpression = httpsCallable(functions, 'recordAdImpression');
      this.cfGetSponsoredSearchResult = httpsCallable(functions, 'getSponsoredSearchResult');
      this.cfGetAd = httpsCallable(functions, 'getAd');
      this.cfWatchAd = httpsCallable(functions, 'watchAd');
      this.cfPurchaseCoins = httpsCallable(functions, 'purchaseCoins');
      this.cfGetSubscriptionStatus = httpsCallable(functions, 'getSubscriptionStatus');
      this.cfCreateSubscription = httpsCallable(functions, 'createSubscription');
      this.cfCancelSubscription = httpsCallable(functions, 'cancelSubscription');
      this.cfGetPayoutSettings = httpsCallable(functions, 'getPayoutSettings');
      this.cfCreatePayoutAccount = httpsCallable(functions, 'createPayoutAccount');

      this.initialized = true;
      console.log('💰 MonetizationService v5.0 (gender-aware, offline queue fixed, production-hardened)');
      // start periodic ad cache cleaner
      this.cleanupInterval = setInterval(() => this._cleanupExpiredAds(), 5 * 60 * 1000);
      // sync offline queue after init
      this.offlineQueue.sync();
    }
    return this.db;
  }

  _cleanupExpiredAds() {
    const now = Date.now();
    for (const [key, value] of this.adCache.entries()) {
      if (value.expires < now) {
        this.adCache.delete(key);
      }
    }
  }

  // ---------- real connection check (more robust) ----------
  async _isActuallyOnline() {
    // First check navigator.onLine (fast)
    if (hasWindow && !navigator.onLine) return false;
    // Then attempt to fetch a lightweight resource
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);
      // Use a no-cache endpoint that is guaranteed to be available (e.g., Firebase root)
      const res = await fetch('https://firestore.googleapis.com/v1/projects/-/databases/(default)/documents', {
        method: 'HEAD',
        cache: 'no-store',
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      return res.ok || res.status === 403; // 403 means we can reach Firestore but auth fails – still online
    } catch {
      return false;
    }
  }

  // -------------------- READ-ONLY METHODS --------------------
  async getBalance(userId) {
    await this._ensureInitialized();
    const userRef = doc(this.db, 'users', userId);
    const userSnap = await getDoc(userRef);
    if (!userSnap.exists()) throw new Error('User not found');
    return userSnap.data().coins || 0;
  }

  async getTransactionHistory(userId, limitCount = 50) {
    await this._ensureInitialized();
    const txRef = collection(this.db, 'coin_transactions');
    // Requires composite index: userId ASC, createdAt DESC
    const q = query(
      txRef,
      where('userId', '==', userId),
      orderBy('createdAt', 'desc'),
      firestoreLimit(limitCount)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  }

  async getUserLevel(userId) {
    await this._ensureInitialized();
    const userRef = doc(this.db, 'users', userId);
    const userSnap = await getDoc(userRef);
    if (!userSnap.exists()) throw new Error('User not found');

    const data = userSnap.data();
    const currentLevel = data.level || 1;
    const currentXP = data.experience || 0;
    const levels = this.config.LEVELS;
    const currentLevelData = levels.find(l => l.level === currentLevel) || levels[0];
    const nextLevelIndex = levels.findIndex(l => l.level === currentLevel) + 1;
    const nextLevel = nextLevelIndex < levels.length ? levels[nextLevelIndex] : null;

    let rawProgress = 100;
    if (nextLevel) {
      const denominator = nextLevel.xpRequired - currentLevelData.xpRequired;
      if (denominator > 0) {
        rawProgress = ((currentXP - currentLevelData.xpRequired) / denominator) * 100;
      }
    }
    const progress = Math.max(0, Math.min(100, rawProgress));

    return {
      level: currentLevel,
      experience: currentXP,
      nextLevelXP: nextLevel ? nextLevel.xpRequired : null,
      xpToNextLevel: nextLevel ? Math.max(0, nextLevel.xpRequired - currentXP) : 0,
      progress,
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

  // 👑 GENDER‑AWARE ROYAL POSITIONS (safe config access)
  async getUserPosition(userId, gender = 'other') {
    await this._ensureInitialized();
    const balance = await this.getBalance(userId);
    const thresholds = this.config.POSITION_THRESHOLDS;

    if (balance >= thresholds.KING) {
      if (gender === 'female') return { title: 'Queen', emoji: '👑', minCoins: thresholds.QUEEN, type: 'coin' };
      return { title: 'King', emoji: '👑', minCoins: thresholds.KING, type: 'coin' };
    }
    if (balance >= thresholds.PRINCE) {
      if (gender === 'female') return { title: 'Princess', emoji: '👸', minCoins: thresholds.PRINCESS, type: 'coin' };
      return { title: 'Prince', emoji: '🤴', minCoins: thresholds.PRINCE, type: 'coin' };
    }
    if (balance >= thresholds.DUKE) {
      if (gender === 'female') return { title: 'Duchess', emoji: '👒', minCoins: thresholds.DUCHESS, type: 'coin' };
      return { title: 'Duke', emoji: '🎩', minCoins: thresholds.DUKE, type: 'coin' };
    }
    if (balance >= thresholds.LORD) {
      if (gender === 'female') return { title: 'Lady', emoji: '💎', minCoins: thresholds.LADY, type: 'coin' };
      return { title: 'Lord', emoji: '🏰', minCoins: thresholds.LORD, type: 'coin' };
    }
    if (balance >= thresholds.RICH) return { title: 'Rich', emoji: '💰', minCoins: thresholds.RICH, type: 'coin' };
    if (balance >= thresholds.WEALTHY) return { title: 'Wealthy', emoji: '💵', minCoins: thresholds.WEALTHY, type: 'coin' };
    return { title: 'Commoner', emoji: '🪙', minCoins: 0, type: 'coin' };
  }

  async getUserPopularityPosition(userId) {
    await this._ensureInitialized();
    const userRef = doc(this.db, 'users', userId);
    const userSnap = await getDoc(userRef);
    if (!userSnap.exists()) throw new Error('User not found');
    const followers = userSnap.data().followerCount || 0;
    const thresholds = this.config.POPULARITY_THRESHOLDS;
    if (followers >= thresholds.LEGEND) return { title: 'Legend', emoji: '🏆', minFollowers: thresholds.LEGEND, type: 'popularity' };
    if (followers >= thresholds.ICON) return { title: 'Icon', emoji: '⭐', minFollowers: thresholds.ICON, type: 'popularity' };
    if (followers >= thresholds.SUPERSTAR) return { title: 'Superstar', emoji: '🌟', minFollowers: thresholds.SUPERSTAR, type: 'popularity' };
    if (followers >= thresholds.STAR) return { title: 'Star', emoji: '✨', minFollowers: thresholds.STAR, type: 'popularity' };
    if (followers >= thresholds.RISING) return { title: 'Rising Star', emoji: '🌱', minFollowers: thresholds.RISING, type: 'popularity' };
    return { title: 'Community Member', emoji: '👥', minFollowers: 0, type: 'popularity' };
  }

  async getCoinLeaderboard(limitCount = 50) {
    await this._ensureInitialized();
    const usersRef = collection(this.db, 'users');
    // Firestore will use composite index automatically if created
    const q = query(usersRef, orderBy('coins', 'desc'), firestoreLimit(limitCount));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      userId: doc.id,
      displayName: doc.data().displayName,
      photoURL: doc.data().photoURL,
      coins: doc.data().coins || 0,
      position: this.getPositionTitle(doc.data().coins || 0),
    }));
  }

  // Safe because config is guaranteed to exist after _ensureInitialized()
  getPositionTitle(coins) {
    // This method may be called before config is loaded – guard
    if (!this.config) return 'Commoner';
    const thresholds = this.config.POSITION_THRESHOLDS;
    if (coins >= thresholds.KING) return 'King/Queen';
    if (coins >= thresholds.PRINCE) return 'Prince/Princess';
    if (coins >= thresholds.DUKE) return 'Duke/Duchess';
    if (coins >= thresholds.LORD) return 'Lord/Lady';
    if (coins >= thresholds.RICH) return 'Rich';
    if (coins >= thresholds.WEALTHY) return 'Wealthy';
    return 'Commoner';
  }

  // -------------------- AD METHODS (server-side enforced) --------------------
  async getAd(placement, userId, context = {}) {
    await this._ensureInitialized();
    if (!this.config.AD_PLACEMENTS.includes(placement)) {
      throw new Error(`Invalid placement: ${placement}`);
    }
    try {
      const result = await retryOperation(() => this.cfGetAd({ placement, userId, context }));
      const ad = result.data.ad;
      if (ad && result.data.cacheTTL) {
        const cacheKey = `${placement}_${userId}_${context.category || 'any'}`;
        this.adCache.set(cacheKey, {
          ad,
          expires: Date.now() + result.data.cacheTTL * 1000,
        });
      }
      return ad;
    } catch (err) {
      console.error('Failed to get ad:', err);
      return null;
    }
  }

  async watchAd(placement, adId, watchDurationSeconds, deviceMetadata = {}) {
    await this._ensureInitialized();
    const isOnline = await this._isActuallyOnline();
    if (!isOnline) {
      await this.offlineQueue.add('watchAd', { placement, adId, watchDurationSeconds });
      return { success: true, offlineQueued: true, message: 'Will be processed when online' };
    }
    const result = await retryOperation(() =>
      this.cfWatchAd({ placement, adId, watchDurationSeconds, deviceMetadata })
    );
    return result.data;
  }

  async recordAdImpression(adId, placement, deviceMetadata = {}) {
    await this._ensureInitialized();
    this.cfRecordAdImpression({ adId, placement, deviceMetadata }).catch(console.warn);
  }

  // -------------------- SPONSORED SEARCH --------------------
  async getSponsoredSearchResult(userId, query, context = {}) {
    await this._ensureInitialized();
    try {
      const result = await retryOperation(() => this.cfGetSponsoredSearchResult({ userId, query, context }));
      return result.data.sponsoredResult;
    } catch (err) {
      console.warn('Sponsored search failed:', err);
      return null;
    }
  }

  // -------------------- COIN PURCHASE (Stripe) --------------------
  async purchaseCoins(packageId, paymentMethodId = null, deviceMetadata = {}) {
    await this._ensureInitialized();
    const isOnline = await this._isActuallyOnline();
    if (!isOnline) {
      await this.offlineQueue.add('purchaseCoins', { packageId, paymentMethodId });
      return { success: true, offlineQueued: true, message: 'Will be processed when online' };
    }
    const result = await retryOperation(() => this.cfPurchaseCoins({ packageId, paymentMethodId, deviceMetadata }));
    return result.data;
  }

  // -------------------- SUBSCRIPTIONS --------------------
  async getSubscriptionStatus() {
    await this._ensureInitialized();
    const result = await retryOperation(() => this.cfGetSubscriptionStatus());
    return result.data;
  }

  async createSubscription(tier, paymentMethodId = null, deviceMetadata = {}) {
    await this._ensureInitialized();
    const result = await retryOperation(() => this.cfCreateSubscription({ tier, paymentMethodId, deviceMetadata }));
    return result.data;
  }

  async cancelSubscription() {
    await this._ensureInitialized();
    const result = await retryOperation(() => this.cfCancelSubscription());
    return result.data;
  }

  // -------------------- CREATOR PAYOUTS (Stripe Connect) --------------------
  async getPayoutSettings() {
    await this._ensureInitialized();
    const result = await retryOperation(() => this.cfGetPayoutSettings());
    return result.data;
  }

  async createPayoutAccount(countryCode, returnUrl, deviceMetadata = {}) {
    await this._ensureInitialized();
    const result = await retryOperation(() => this.cfCreatePayoutAccount({ countryCode, returnUrl, deviceMetadata }));
    return result.data;
  }

  // -------------------- CLOUD FUNCTION WRAPPERS (existing, with retry & metadata) --------------------
  async addCoins(userId, amount, reason, metadata = {}, idempotencyKey = null) {
    await this._ensureInitialized();
    const key = idempotencyKey || generateIdempotencyKey();
    const result = await retryOperation(() =>
      this.cfAddCoins({ userId, amount, reason, metadata, idempotencyKey: key })
    );
    return result.data;
  }

  async spendCoins(userId, amount, reason, metadata = {}, idempotencyKey = null) {
    await this._ensureInitialized();
    const key = idempotencyKey || generateIdempotencyKey();
    const result = await retryOperation(() =>
      this.cfSpendCoins({ userId, amount, reason, metadata, idempotencyKey: key })
    );
    return result.data;
  }

  async transferCoins(fromUserId, toUserId, amount, reason, metadata = {}, idempotencyKey = null) {
    await this._ensureInitialized();
    const key = idempotencyKey || generateIdempotencyKey();
    const result = await retryOperation(() =>
      this.cfTransferCoins({ fromUserId, toUserId, amount, reason, metadata, idempotencyKey: key })
    );
    return result.data;
  }

  async sendGift(senderId, postId, giftType, idempotencyKey = null) {
    await this._ensureInitialized();
    const key = idempotencyKey || generateIdempotencyKey();
    const result = await retryOperation(() =>
      this.cfSendGift({ senderId, postId, giftType, idempotencyKey: key })
    );
    return result.data;
  }

  async boostPost(userId, postId, days, idempotencyKey = null) {
    await this._ensureInitialized();
    const key = idempotencyKey || generateIdempotencyKey();
    const result = await retryOperation(() =>
      this.cfBoostPost({ userId, postId, days, idempotencyKey: key })
    );
    return result.data;
  }

  async requestWithdrawal(userId, amount, paymentMethod, paymentDetails, idempotencyKey = null, deviceMetadata = {}) {
    await this._ensureInitialized();
    const key = idempotencyKey || generateIdempotencyKey();
    const result = await retryOperation(() =>
      this.cfRequestWithdrawal({ userId, amount, paymentMethod, paymentDetails, idempotencyKey: key, deviceMetadata })
    );
    return result.data;
  }

  // -------------------- CLEANUP --------------------
  destroy() {
    this.destroyed = true;
    if (this.cleanupInterval) clearInterval(this.cleanupInterval);
    if (this.offlineQueue) this.offlineQueue.destroy();
    this.adCache.clear();
    this.initialized = false;
    console.log('💰 MonetizationService destroyed');
  }
}

// -------------------- SINGLETON & EXPORTS --------------------
let instance = null;
export function getMonetizationService() {
  if (!instance) instance = new MonetizationService();
  return instance;
}

// Named exports for convenience
export const getBalance = (userId) => getMonetizationService().getBalance(userId);
export const getTransactionHistory = (userId, limitCount) => getMonetizationService().getTransactionHistory(userId, limitCount);
export const getUserLevel = (userId) => getMonetizationService().getUserLevel(userId);
export const getMonetizationStats = (userId) => getMonetizationService().getMonetizationStats(userId);
export const getAd = (placement, userId, context) => getMonetizationService().getAd(placement, userId, context);
export const watchAd = (placement, adId, watchDurationSeconds, deviceMetadata) =>
  getMonetizationService().watchAd(placement, adId, watchDurationSeconds, deviceMetadata);
export const recordAdImpression = (adId, placement, deviceMetadata) =>
  getMonetizationService().recordAdImpression(adId, placement, deviceMetadata);
export const getSponsoredSearchResult = (userId, query, context) =>
  getMonetizationService().getSponsoredSearchResult(userId, query, context);
export const purchaseCoins = (packageId, paymentMethodId, deviceMetadata) =>
  getMonetizationService().purchaseCoins(packageId, paymentMethodId, deviceMetadata);
export const getSubscriptionStatus = () => getMonetizationService().getSubscriptionStatus();
export const createSubscription = (tier, paymentMethodId, deviceMetadata) =>
  getMonetizationService().createSubscription(tier, paymentMethodId, deviceMetadata);
export const cancelSubscription = () => getMonetizationService().cancelSubscription();
export const getPayoutSettings = () => getMonetizationService().getPayoutSettings();
export const createPayoutAccount = (countryCode, returnUrl, deviceMetadata) =>
  getMonetizationService().createPayoutAccount(countryCode, returnUrl, deviceMetadata);
export const getUserPosition = (userId, gender = 'other') =>
  getMonetizationService().getUserPosition(userId, gender);
export const getUserPopularityPosition = (userId) =>
  getMonetizationService().getUserPopularityPosition(userId);
export const getCoinLeaderboard = (limitCount) =>
  getMonetizationService().getCoinLeaderboard(limitCount);

export const addCoins = (userId, amount, reason, metadata, idempotencyKey) =>
  getMonetizationService().addCoins(userId, amount, reason, metadata, idempotencyKey);
export const spendCoins = (userId, amount, reason, metadata, idempotencyKey) =>
  getMonetizationService().spendCoins(userId, amount, reason, metadata, idempotencyKey);
export const transferCoins = (fromUserId, toUserId, amount, reason, metadata, idempotencyKey) =>
  getMonetizationService().transferCoins(fromUserId, toUserId, amount, reason, metadata, idempotencyKey);
export const sendGift = (senderId, postId, giftType, idempotencyKey) =>
  getMonetizationService().sendGift(senderId, postId, giftType, idempotencyKey);
export const boostPost = (userId, postId, days, idempotencyKey) =>
  getMonetizationService().boostPost(userId, postId, days, idempotencyKey);
export const requestWithdrawal = (userId, amount, paymentMethod, paymentDetails, idempotencyKey, deviceMetadata) =>
  getMonetizationService().requestWithdrawal(userId, amount, paymentMethod, paymentDetails, idempotencyKey, deviceMetadata);

export default getMonetizationService;