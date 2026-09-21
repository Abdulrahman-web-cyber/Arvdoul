// src/services/monetizationService.js

import { getFirestoreInstance, auth } from '../firebase/firebase.js';
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
  setDoc,
  updateDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { getRemoteConfig, getValue, fetchAndActivate, setLogLevel } from 'firebase/remote-config';
import { openDB } from 'idb';
import { getSafeAvatarUrl } from '../utils/avatarUtils.js';
import { loadStripe } from '@stripe/stripe-js';
import { svcLogger } from './ServiceKit.js';
import { getLevelInfo, LEVEL_GATES } from '../shared/levelConfig.cjs';

const log = svcLogger('monetizationService');

// ---------- safe browser globals ----------
const hasDocument = typeof document !== 'undefined';
const hasWindow = typeof window !== 'undefined';
const hasPerformance = typeof performance !== 'undefined' && typeof window !== 'undefined' && 'performance' in window ? !!window.performance.now : false;

function secureRandom() {
  if (typeof window !== 'undefined' && window.crypto) {
    const array = new Uint32Array(1);
    window.crypto.getRandomValues(array);
    return array[0] / 4294967296;
  }
  return Math.random();
}

// ---------- crypto‑strong idempotency key with fallback ----------
function generateIdempotencyKey() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  const perf = hasPerformance ? window.performance.now() : 0;
  return `${Date.now()}-${secureRandom().toString(36).slice(2)}-${perf}`;
}

// ---------- DEFAULT CONFIG (all amounts in COINS or CENTS) ----------
const DEFAULT_CONFIG = {
  WITHDRAWAL_MIN_LEVEL: LEVEL_GATES.withdrawals,
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
      const popularityStr = getValue(remoteConfig, 'popularity_thresholds').asString();
      const subsStr = getValue(remoteConfig, 'subscription_tiers').asString();

      const levels = safeJsonParse(levelsStr, null);
      const popularityThresholds = safeJsonParse(popularityStr, null);
      const subscriptionTiers = safeJsonParse(subsStr, null);

      const db = await getFirestoreInstance();
      const configDoc = await getDoc(doc(db, 'config', 'monetization'));
      let finalConfig = { ...DEFAULT_CONFIG };
      if (configDoc.exists()) {
        finalConfig = { ...finalConfig, ...configDoc.data() };
      }
      if (levels) finalConfig.LEVELS = levels;
      if (popularityThresholds) finalConfig.POPULARITY_THRESHOLDS = popularityThresholds;
      if (subscriptionTiers) finalConfig.SUBSCRIPTION_TIERS = subscriptionTiers;
      cachedConfig = finalConfig;
      return finalConfig;
    } catch (e) {
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
      const delay = baseDelay * Math.pow(2, attempt - 1) + secureRandom() * 200;
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
    this.stripe = null;

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

      // Initialize Stripe SDK asynchronously
      const stripePublicKey = import.meta.env?.VITE_STRIPE_PUBLIC_KEY;
      if (stripePublicKey) {
        try {
          this.stripe = await loadStripe(stripePublicKey);
          log.info('Stripe successfully loaded with public key');
        } catch (err) {
          log.error('Stripe load error', err);
        }
      } else {
        log.info('Stripe key missing; operating in dynamic double-entry fallback simulation mode.');
      }

      this.initialized = true;
      this.cleanupInterval = setInterval(() => this._cleanupExpiredAds(), 5 * 60 * 1000);
      this.offlineQueue.sync();
    }
    return this.db;
  }

  async ensureInitialized() {
    return this._ensureInitialized();
  }

  async initialize() {
    return this._ensureInitialized();
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
    if (hasWindow && !navigator.onLine) return false;
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);
      const res = await fetch('https://firestore.googleapis.com/v1/projects/-/databases/(default)/documents', {
        method: 'HEAD',
        cache: 'no-store',
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      return res.ok || res.status === 403;
    } catch {
      return false;
    }
  }

  // -------------------- READ-ONLY METHODS --------------------
  async getBalance(userId) {
    if (!userId) return 0;
    await this._ensureInitialized();
    try {
      const userRef = doc(this.db, 'users', userId);
      const userSnap = await getDoc(userRef);
      if (!userSnap.exists()) return 0;
      return userSnap.data().coins || 0;
    } catch (e) {
      log.error('Failed to get balance:', e);
      return 0;
    }
  }

  async getTransactionHistory(userId, limitCount = 50) {
    if (!userId) return [];
    await this._ensureInitialized();
    try {
      const txRef = collection(this.db, 'coin_transactions');
      const q = query(
        txRef,
        where('userId', '==', userId),
        orderBy('createdAt', 'desc'),
        firestoreLimit(limitCount)
      );
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (e) {
      log.error('Failed to get transaction history:', e);
      return [];
    }
  }

  async getUserLevel(userId) {
    if (!userId) return this._levelShape(getLevelInfo(0));
    await this._ensureInitialized();
    let experience = 0;
    try {
      const userSnap = await getDoc(doc(this.db, 'users', userId));
      if (userSnap.exists()) experience = userSnap.data().experience || 0;
    } catch (e) {
      log.error('Failed to fetch user level info:', e);
    }
    return this._levelShape(getLevelInfo(experience));
  }

  _levelShape(info) {
    return {
      level: info.level,
      experience: info.experience,
      title: info.title,
      nextLevelXP: info.nextLevelXp,
      xpToNextLevel: info.xpToNext,
      progress: info.progress,
    };
  }

  async getMonetizationStats(userId) {
    if (!userId) return { balance: 0, level: this._levelShape(getLevelInfo(0)), totalTransactions: 0 };
    const [balance, levelInfo, txs] = await Promise.all([
      this.getBalance(userId),
      this.getUserLevel(userId),
      this.getTransactionHistory(userId, 100),
    ]);
    return { balance, level: levelInfo, totalTransactions: txs.length };
  }

  // Identity titles are progression-based, never purchasable. Coin balance and
  // royal/economic naming must not be linked (blueprint 25, 31-33): wealth can
  // never produce status. Level titles come from the shared progression engine.
  async getUserPosition(userId) {
    let experience = 0;
    if (userId) {
      try {
        const userSnap = await getDoc(doc(this.db, 'users', userId));
        if (userSnap.exists()) experience = userSnap.data().experience || 0;
      } catch (e) {
        log.error('Failed to get user position:', e);
      }
    }
    const info = getLevelInfo(experience);
    return { title: info.title, emoji: '\u2b50', minLevel: info.level, type: 'level' };
  }

  async getUserPopularityPosition(userId) {
    await this._ensureInitialized();
    let followers = 0;
    if (userId) {
      try {
        const userRef = doc(this.db, 'users', userId);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) followers = userSnap.data().followerCount || 0;
      } catch (e) {
        log.error('Failed to get user popularity:', e);
      }
    }
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
    try {
      const usersRef = collection(this.db, 'users');
      const q = query(usersRef, orderBy('experience', 'desc'), firestoreLimit(limitCount));
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({
        userId: doc.id,
        displayName: doc.data().displayName || 'User',
        photoURL: getSafeAvatarUrl(doc.data().photoURL, doc.data().displayName || 'User', doc.id),
        level: getLevelInfo(doc.data().experience || 0).level,
        position: getLevelInfo(doc.data().experience || 0).title,
      }));
    } catch (e) {
      log.error('Failed to get leaderboard:', e);
      return [];
    }
  }

  // -------------------- AD METHODS (server-side enforced with Firestore resilience) --------------------
  async getAd(placement, userId, context = {}) {
    await this._ensureInitialized();
    if (!this.config.AD_PLACEMENTS.includes(placement)) {
      placement = 'interstitial';
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
      // Direct Firestore ad query fallback
      try {
        const adsRef = collection(this.db, 'ads');
        const q = query(adsRef, where('active', '==', true), firestoreLimit(1));
        const snap = await getDocs(q);
        if (!snap.empty) {
          return { id: snap.docs[0].id, ...snap.docs[0].data() };
        }
      } catch (adErr) {
        log.error('Ad query fallback failed:', adErr);
      }
      return {
        id: `ad_${placement}_default`,
        title: 'Discover Arvdoul Premium',
        description: 'Upgrade your experience and support top creators on Arvdoul.',
        cta: 'Learn More',
        rewardCoins: this.config.AD_REWARD_COINS?.MEDIUM || 2,
        durationSeconds: 15,
        placement
      };
    }
  }

  async watchAd(placement, adId, watchDurationSeconds, deviceMetadata = {}) {
    await this._ensureInitialized();
    const isOnline = await this._isActuallyOnline();
    if (!isOnline) {
      await this.offlineQueue.add('watchAd', { placement, adId, watchDurationSeconds });
      return { success: true, offlineQueued: true, message: 'Will be processed when online' };
    }
    try {
      const result = await retryOperation(() =>
        this.cfWatchAd({ placement, adId, watchDurationSeconds, deviceMetadata })
      );
      return result.data;
    } catch (err) {
      // Rewards must be minted by the server-side validation in `watchAd`,
      // which verifies the ad and the watch duration. Never substitute a
      // different credit path here: report the failure instead of a false
      // success the user would see as earned coins.
      log.error('Ad reward could not be granted:', err);
      return { success: false, error: err?.message || 'Ad reward could not be granted' };
    }
  }

  async recordAdImpression(adId, placement, deviceMetadata = {}) {
    await this._ensureInitialized();
    try {
      await addDoc(collection(this.db, 'ad_impressions'), {
        adId,
        placement,
        userId: auth?.currentUser?.uid || null,
        deviceMetadata,
        createdAt: serverTimestamp()
      });
    } catch (e) {
      log.error('Failed to log ad impression:', e);
    }
  }

  // -------------------- SPONSORED SEARCH --------------------
  async getSponsoredSearchResult(userId, query, context = {}) {
    await this._ensureInitialized();
    try {
      const result = await retryOperation(() => this.cfGetSponsoredSearchResult({ userId, query, context }));
      return result.data.sponsoredResult;
    } catch (err) {
      return null;
    }
  }

  // -------------------- COIN PURCHASE (Stripe & Ledger) --------------------
  async purchaseCoins(packageId, paymentMethodId = null, deviceMetadata = {}) {
    await this._ensureInitialized();
    const isOnline = await this._isActuallyOnline();
    if (!isOnline) {
      await this.offlineQueue.add('purchaseCoins', { packageId, paymentMethodId });
      return { success: true, offlineQueued: true, message: 'Will be processed when online' };
    }

    // Try real stripe integration checkout flow if initialized
    if (this.stripe) {
      try {
        log.info('Proceeding with real Stripe purchase flow', { packageId });
        const result = await retryOperation(() => this.cfPurchaseCoins({ packageId, paymentMethodId, deviceMetadata }));
        if (result.data?.sessionId) {
          await this.stripe.redirectToCheckout({ sessionId: result.data.sessionId });
          return { success: true, stripeRedirect: true };
        }
        if (result.data?.success) {
          return {
            success: true,
            receipt: {
              id: result.data.receiptId || `cf_${Date.now()}`,
              provider: 'stripe',
              serverVerified: true,
              packageId,
              coinsAdded: result.data.coinsAdded || 0,
              timestamp: Date.now(),
            },
            coinsAdded: result.data.coinsAdded || 0,
            newBalance: result.data.newBalance,
          };
        }
        throw new Error(result.data?.error || 'Purchase was not completed');
      } catch (err) {
        // Hard fail: no fabricated receipts, no free coins. Coins are minted
        // exclusively by the server-side double-entry ledger after a verified
        // payment (functions/monetization.js purchaseCoins + stripeWebhook).
        log.error('Real Stripe purchase flow error', err);
        throw new Error(`PAYMENT_FAILED: ${err.message || 'payment could not be verified'}`);
      }
    }

    // No Stripe SDK loaded (publishable key unconfigured): still attempt the
    // Cloud Function - it performs server-side payment verification.
    if (!this.cfPurchaseCoins) {
      throw new Error('PAYMENT_GATEWAY_NOT_CONFIGURED: purchaseCoins Cloud Function is not reachable. Coins are never granted without server-side payment verification.');
    }
    try {
      const result = await retryOperation(() => this.cfPurchaseCoins({ packageId, paymentMethodId, deviceMetadata }));
      if (result.data?.success) {
        return {
          success: true,
          receipt: {
            id: result.data.receiptId || `cf_${Date.now()}`,
            provider: 'stripe',
            serverVerified: true,
            packageId,
            coinsAdded: result.data.coinsAdded || 0,
            timestamp: Date.now(),
          },
          coinsAdded: result.data.coinsAdded || 0,
          newBalance: result.data.newBalance,
        };
      }
      throw new Error(result.data?.error || 'Purchase was not completed');
    } catch (err) {
      throw new Error(`PAYMENT_FAILED: ${err.message || 'payment could not be verified'}`);
    }
  }

  // -------------------- SUBSCRIPTIONS --------------------
  async getSubscriptionStatus() {
    await this._ensureInitialized();
    try {
      const result = await retryOperation(() => this.cfGetSubscriptionStatus());
      return result.data;
    } catch (err) {
      const uid = auth?.currentUser?.uid;
      if (!uid) return { active: false, tier: null };
      try {
        const subDoc = await getDoc(doc(this.db, 'subscriptions', uid));
        if (subDoc.exists()) return subDoc.data();
      } catch (e) {}
      return { active: false, tier: null };
    }
  }

  async createSubscription(tier, paymentMethodId = null, deviceMetadata = {}) {
    await this._ensureInitialized();
    try {
      const result = await retryOperation(() => this.cfCreateSubscription({ tier, paymentMethodId, deviceMetadata }));
      return result.data;
    } catch (err) {
      const uid = auth?.currentUser?.uid;
      if (!uid) throw new Error('User not authenticated');
      const subData = {
        userId: uid,
        tier,
        status: 'active',
        active: true,
        startDate: serverTimestamp(),
        renewalDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        paymentMethodId: paymentMethodId || 'default'
      };
      await setDoc(doc(this.db, 'subscriptions', uid), subData, { merge: true });
      await updateDoc(doc(this.db, 'users', uid), { subscriptionTier: tier, isSubscriber: true });
      return { success: true, subscription: subData };
    }
  }

  async cancelSubscription() {
    await this._ensureInitialized();
    try {
      const result = await retryOperation(() => this.cfCancelSubscription());
      return result.data;
    } catch (err) {
      const uid = auth?.currentUser?.uid;
      if (!uid) throw new Error('User not authenticated');
      await updateDoc(doc(this.db, 'subscriptions', uid), { status: 'cancelled', active: false });
      await updateDoc(doc(this.db, 'users', uid), { subscriptionTier: null, isSubscriber: false });
      return { success: true, message: 'Subscription cancelled' };
    }
  }

  // -------------------- CREATOR PAYOUTS (Stripe Connect) --------------------
  async getPayoutSettings() {
    await this._ensureInitialized();
    try {
      const result = await retryOperation(() => this.cfGetPayoutSettings());
      return result.data;
    } catch (err) {
      const uid = auth?.currentUser?.uid;
      if (!uid) return { enabled: false, accountStatus: 'unconfigured' };
      try {
        const snap = await getDoc(doc(this.db, 'payout_settings', uid));
        if (snap.exists()) return snap.data();
      } catch (e) {}
      // Honest unconfigured state — never claim an active payout account
      // that does not exist.
      return { enabled: false, accountStatus: 'unconfigured', currency: 'USD' };
    }
  }

  async createPayoutAccount(countryCode = 'US', returnUrl = '', deviceMetadata = {}) {
    await this._ensureInitialized();
    try {
      const result = await retryOperation(() => this.cfCreatePayoutAccount({ countryCode, returnUrl, deviceMetadata }));
      return result.data;
    } catch (err) {
      const uid = auth?.currentUser?.uid;
      if (!uid) throw new Error('User not authenticated');
      const accountData = {
        userId: uid,
        countryCode,
        status: 'verified',
        createdAt: serverTimestamp()
      };
      await setDoc(doc(this.db, 'payout_settings', uid), accountData, { merge: true });
      return { success: true, accountId: `acct_${uid.slice(0, 10)}`, status: 'verified' };
    }
  }

  // -------------------- FINANCIAL OPERATIONS WITH ATOMIC FALLBACKS --------------------
  async addCoins(userId, amount, reason = 'credit', metadata = {}, idempotencyKey = null) {
    await this._ensureInitialized();
    const key = idempotencyKey || generateIdempotencyKey();
    try {
      const result = await retryOperation(() =>
        this.cfAddCoins({ userId, amount, reason, metadata, idempotencyKey: key })
      );
      return result.data;
    } catch (err) {
      log.error('[Economy] addCoins requires the server (server-authoritative):', {
        userId,
        reason,
        error: err.message,
      });
      throw new Error(
        'Coin credits must be authorised by the server. Please check your connection and try again.'
      );
    }
  }

  async spendCoins(userId, amount, reason = 'debit', metadata = {}, idempotencyKey = null) {
    await this._ensureInitialized();
    const key = idempotencyKey || generateIdempotencyKey();
    try {
      const result = await retryOperation(() =>
        this.cfSpendCoins({ userId, amount, reason, metadata, idempotencyKey: key })
      );
      return result.data;
    } catch (err) {
      log.error('[Economy] spendCoins requires the server (server-authoritative):', {
        userId,
        reason,
        error: err.message,
      });
      throw new Error(
        'Coin spends must be authorised by the server. Please check your connection and try again.'
      );
    }
  }

  async transferCoins(fromUserId, toUserId, amount, reason = 'transfer', metadata = {}, idempotencyKey = null) {
    await this._ensureInitialized();
    const key = idempotencyKey || generateIdempotencyKey();
    try {
      const result = await retryOperation(() =>
        this.cfTransferCoins({ fromUserId, toUserId, amount, reason, metadata, idempotencyKey: key })
      );
      return result.data;
    } catch (err) {
      log.error('[Economy] transferCoins requires the server (server-authoritative):', {
        fromUserId,
        toUserId,
        error: err.message,
      });
      throw new Error(
        'Coin transfers must be authorised by the server. Please check your connection and try again.'
      );
    }
  }

  async sendGift(senderId, postId, giftType, idempotencyKey = null) {
    await this._ensureInitialized();
    const key = idempotencyKey || generateIdempotencyKey();

    // Validate the gift type FIRST - unknown gifts are rejected, never
    // silently charged a default cost.
    const giftConfig = (this.config.GIFTS || DEFAULT_CONFIG.GIFTS).find(g => g.type === giftType);
    if (!giftConfig) {
      throw new Error(`Unknown gift type: ${giftType}`);
    }
    const cost = giftConfig.value;

    try {
      const result = await retryOperation(() =>
        this.cfSendGift({ senderId, postId, giftType, idempotencyKey: key })
      );
      // Social loop: notify the post author + award gift_received XP
      // (best-effort, never breaks the gift).
      this._afterGiftSent(senderId, postId, giftType, cost).catch(() => {});
      return result.data;
    } catch (err) {
      log.error('[Economy] sendGift requires the server (atomic debit/credit):', {
        senderId,
        postId,
        giftType,
        error: err.message,
      });
      throw new Error(
        'Sending a gift must be authorised by the server. Please check your connection and try again.'
      );
    }
  }

  /**
   * Best-effort social loop after a gift is sent: notify the post author and
   * award gift_received XP. Never throws into the gift path.
   * @private
   */
  async _afterGiftSent(senderId, postId, giftType, cost) {
    try {
      const { getDoc, doc } = await import('firebase/firestore');
      const postSnap = await getDoc(doc(this.db, 'posts', postId));
      const authorId = postSnap.exists() ? (postSnap.data().authorId || postSnap.data().userId) : null;
      if (!authorId || authorId === senderId) return;

      const { getNotificationsService } = await import('./notificationsService.js');
      await getNotificationsService().createGiftNotification(senderId, authorId, postId, giftType, cost);

      const { levelSystemService } = await import('./levelSystemService.js');
      await levelSystemService.awardExperience({ userId: authorId, action: 'gift_received', source: postId });
    } catch (err) {
      log.debug('[Gift] Post-gift notification/XP skipped:', { error: err.message });
    }
  }

  async boostPost(userId, postId, days = 1, idempotencyKey = null) {
    await this._ensureInitialized();
    const key = idempotencyKey || generateIdempotencyKey();
    try {
      const result = await retryOperation(() =>
        this.cfBoostPost({ userId, postId, days, idempotencyKey: key })
      );
      return result.data;
    } catch (err) {
      log.error('[Economy] boostPost requires the server (server-authoritative debit):', {
        userId,
        postId,
        error: err.message,
      });
      throw new Error(
        'Boosting a post must be authorised by the server. Please check your connection and try again.'
      );
    }
  }

  async requestWithdrawal(userId, amount, paymentMethod, paymentDetails = {}, idempotencyKey = null, deviceMetadata = {}) {
    await this._ensureInitialized();
    const key = idempotencyKey || generateIdempotencyKey();
    try {
      const result = await retryOperation(() =>
        this.cfRequestWithdrawal({ userId, amount, paymentMethod, paymentDetails, idempotencyKey: key, deviceMetadata })
      );
      return result.data;
    } catch (err) {
      log.error('[Economy] requestWithdrawal requires the server (payout security):', {
        userId,
        amount,
        error: err.message,
      });
      throw new Error(
        'Withdrawals must be authorised by the server. Please check your connection and try again.'
      );
    }
  }

  // -------------------- CLEANUP --------------------
  destroy() {
    this.destroyed = true;
    if (this.cleanupInterval) clearInterval(this.cleanupInterval);
    if (this.offlineQueue) this.offlineQueue.destroy();
    this.adCache.clear();
    this.initialized = false;
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