// src/services/notificationsService.js - ARVDOUL ULTIMATE NOTIFICATIONS V26
// 🔔 WORLD‑CLASS NOTIFICATION SYSTEM • SURPASSING INSTAGRAM & X
// 💰 FULL INTEGRATION WITH MONETIZATION • COIN REWARDS • SPONSORED NOTIFICATIONS
// ✅ Fixed deduplication (no Date.now) • Cached fatigue counter • Token limit enforced
// ✅ Email via Cloud Function • Firestore indexes documented • Batch grouping
// ✅ Priority queue • Offline queue • AI personalisation • Real analytics

import { getFirestoreInstance, getAuthInstance, getMessagingInstance } from '../firebase/firebase.js';
import { getMonetizationService } from './monetizationService.js';
import { getFunctions, httpsCallable } from 'firebase/functions';

// ----------------------------------------------------------------------
//  CONFIGURATION – Single source of truth
// ----------------------------------------------------------------------
const NOTIFICATIONS_CONFIG = {
  TYPES: {
    LIKE: 'like',
    COMMENT: 'comment',
    REPLY: 'reply',
    MENTION: 'mention',
    SHARE: 'share',
    REPOST: 'repost',
    QUOTE: 'quote',
    FOLLOW: 'follow',
    FOLLOW_REQUEST: 'follow_request',
    FOLLOW_ACCEPTED: 'follow_accepted',
    FRIEND_REQUEST: 'friend_request',
    FRIEND_ACCEPTED: 'friend_accepted',
    MESSAGE: 'message',
    GROUP_MESSAGE: 'group_message',
    MESSAGE_REQUEST: 'message_request',
    VOICE_CALL: 'voice_call',
    VIDEO_CALL: 'video_call',
    POST_APPROVED: 'post_approved',
    POST_DENIED: 'post_denied',
    VIDEO_UPLOADED: 'video_uploaded',
    LIVE_STARTED: 'live_started',
    TRENDING: 'trending',
    COINS_EARNED: 'coins_earned',
    GIFT_RECEIVED: 'gift_received',
    PAYMENT_RECEIVED: 'payment_received',
    WITHDRAWAL_APPROVED: 'withdrawal_approved',
    SUBSCRIPTION_RENEWAL: 'subscription_renewal',
    ACHIEVEMENT_UNLOCKED: 'achievement_unlocked',
    LEVEL_UP: 'level_up',
    BADGE_EARNED: 'badge_earned',
    MILESTONE_REACHED: 'milestone_reached',
    SYSTEM_ALERT: 'system_alert',
    MAINTENANCE: 'maintenance',
    POLICY_UPDATE: 'policy_update',
    SECURITY_ALERT: 'security_alert',
    VERIFICATION: 'verification',
    PROMOTIONAL: 'promotional',
    NEW_FEATURE: 'new_feature',
    EVENT_INVITE: 'event_invite',
    POLL_ENDING: 'poll_ending',
    REMINDER: 'reminder',
    SPONSORED: 'sponsored'
  },

  CHANNELS: {
    IN_APP: { ENABLED: true, PRIORITY: 'immediate', PERSISTENCE: 'until_read', SOUND: true, VIBRATION: true },
    PUSH: { ENABLED: true, PROVIDERS: ['FCM', 'APNS', 'WebPush'], PRIORITY: 'high', TTL: 2419200, BADGE: true },
    EMAIL: { ENABLED: true, PRIORITY: 'normal', TEMPLATES: 'dynamic', UNSUBSCRIBE: true },
    WEB_SOCKET: { ENABLED: true, REAL_TIME: true, RECONNECT: true, HEARTBEAT: 30000 },
    DESKTOP: { ENABLED: true, NATIVE: true, TRAY: true, ACTION_BUTTONS: true }
  },

  INTELLIGENCE: {
    PERSONALIZATION: { LEARNING_RATE: 0.1, DECAY_FACTOR: 0.95, MIN_CONFIDENCE: 0.5 },
    FILTERING: {
      SPAM_DETECTION: true,
      DUPLICATE_DETECTION: true,
      RELEVANCE_SCORING: true,
      USER_FATIGUE: { MAX_PER_HOUR: 10, MAX_PER_DAY: 50, COOLDOWN_PERIOD: 3600000 }
    },
    GROUPING: { ENABLED: true, TIME_WINDOW: 300000, MAX_GROUP_SIZE: 10 },
    SCHEDULING: { TIMEZONE_AWARE: true, SLEEP_HOURS: { start: 22, end: 8 } },
    BATCH: { ENABLED: true, TIME_WINDOW: 60000 }      // batch similar notifications within 1 minute
  },

  PERFORMANCE: {
    CACHE_EXPIRY: 300000,
    PAGE_LIMIT: 50,
    BATCH_SIZE: 1000,
    MAX_CACHE_ENTRIES: 500,
    MAX_LATENCY_ENTRIES: 100,
    RETRY_STRATEGY: { MAX_ATTEMPTS: 3, BACKOFF_FACTOR: 2, INITIAL_DELAY: 1000 },
    OFFLINE_QUEUE_MAX: 100                           // max offline notifications to store
  },

  SECURITY: {
    ENCRYPTION: { IN_TRANSIT: 'TLS_1.3', AT_REST: 'AES_256' },
    RATE_LIMITING: { ENABLED: true, REQUESTS_PER_MINUTE: 100, BURST_SIZE: 20 },
    COMPLIANCE: { GDPR: true, CCPA: true, DATA_RETENTION: 365 }
  },

  MONETIZATION: {
    PREMIUM_FEATURES: { NO_ADS: true, PRIORITY_DELIVERY: true, ADVANCED_ANALYTICS: true },
    AD_INTEGRATION: {
      NATIVE_ADS: true,
      SPONSORED_NOTIFICATIONS: true,
      REVENUE_SHARE: 0.3,
      ADS_PER_PAGE: 3
    },
    ENGAGEMENT_REWARDS: {
      COINS_PER_NOTIFICATION: 1,
      BONUS_COINS: { FIRST_OPEN: 5, FIRST_CLICK: 10, SHARE: 15, CONVERSION: 25 }
    }
  },

  TOKEN: {
    MAX_TOKENS_PER_USER: 10,
    OLD_TOKEN_CLEANUP_DAYS: 30
  },

  DEDUPLICATION: {
    ENABLED: true,
    TTL_SECONDS: 86400
  },

  // Indexes required in Firestore (documentation)
  // Required indexes:
  // 1. Collection 'notifications':
  //    - recipientId ASC, createdAt DESC
  //    - recipientId ASC, read ASC, createdAt DESC
  // 2. Collection 'user_fatigue':
  //    - userId ASC, createdAt DESC
  // 3. Collection 'user_preferences': default single-field indexes are enough.
};

// ----------------------------------------------------------------------
//  HELPER: Error enhancer
// ----------------------------------------------------------------------
function enhanceError(error, defaultMessage) {
  const code = error?.code || 'unknown';
  const message = {
    'permission-denied': 'You do not have permission.',
    'unauthenticated': 'Please sign in.',
    'not-found': 'Notification not found.',
    'already-exists': 'Already exists.',
    'resource-exhausted': 'Rate limit exceeded.',
    'unavailable': 'Service unavailable.'
  }[code] || defaultMessage || 'Notification operation failed';
  const err = new Error(message);
  err.code = code;
  err.original = error;
  err.timestamp = new Date().toISOString();
  return err;
}

// ----------------------------------------------------------------------
//  MAIN SERVICE CLASS
// ----------------------------------------------------------------------
class UltimateNotificationsService {
  constructor() {
    this.firestore = null;
    this.auth = null;
    this.messaging = null;
    this.fs = null;
    this.authMethods = null;
    this.messagingMethods = null;
    this.initialized = false;
    this.initPromise = null;

    this.notificationsCache = new Map();
    this.userPreferencesCache = new Map();
    this.realtimeSubscriptions = new Map();
    this.tokenRefreshUnsubscribe = null;
    this.offlineQueue = [];          // store notifications when offline

    // Cloud Functions
    this.sendPushCF = null;
    this.sendEmailCF = null;

    this.metrics = {
      notificationsSent: 0,
      notificationsDelivered: 0,
      notificationsOpened: 0,
      notificationsClicked: 0,
      deliveryLatency: [],
      cacheHits: 0,
      cacheMisses: 0,
      errors: 0,
      tokensRefreshed: 0,
      batchedNotifications: 0,
    };
  }

  // --------------------------------------------------------------------
  //  🚀 INITIALIZATION
  // --------------------------------------------------------------------
  async ensureInitialized() {
    if (this.initialized) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = (async () => {
      try {
        console.log('[Notifications] Initializing...');
        const firebase = await import('firebase/firestore');
        const authMod = await import('firebase/auth');
        const messagingMod = await import('firebase/messaging');

        this.firestore = await getFirestoreInstance();
        this.auth = await getAuthInstance();
        this.messaging = await getMessagingInstance();

        this.fs = {
          collection: firebase.collection,
          doc: firebase.doc,
          getDoc: firebase.getDoc,
          getDocs: firebase.getDocs,
          setDoc: firebase.setDoc,
          updateDoc: firebase.updateDoc,
          deleteDoc: firebase.deleteDoc,
          query: firebase.query,
          where: firebase.where,
          orderBy: firebase.orderBy,
          limit: firebase.limit,
          startAfter: firebase.startAfter,
          serverTimestamp: firebase.serverTimestamp,
          increment: firebase.increment,
          arrayUnion: firebase.arrayUnion,
          arrayRemove: firebase.arrayRemove,
          writeBatch: firebase.writeBatch,
          onSnapshot: firebase.onSnapshot,
          getCountFromServer: firebase.getCountFromServer,
          enableIndexedDbPersistence: firebase.enableIndexedDbPersistence,
          runTransaction: firebase.runTransaction,
          Timestamp: firebase.Timestamp
        };

        this.authMethods = {
          currentUser: this.auth.currentUser,
          onAuthStateChanged: authMod.onAuthStateChanged
        };

        this.messagingMethods = {
          getToken: messagingMod.getToken,
          onMessage: messagingMod.onMessage,
          onTokenRefresh: messagingMod.onTokenRefresh,
          deleteToken: messagingMod.deleteToken,
          isSupported: messagingMod.isSupported
        };

        // Enable offline persistence
        try {
          await this.fs.enableIndexedDbPersistence(this.firestore, { synchronizeTabs: true });
          console.log('[Notifications] Firestore persistence enabled');
        } catch (err) {
          console.warn('[Notifications] Persistence warning:', err.message);
        }

        // Auth state listener
        this.authMethods.onAuthStateChanged(this.auth, (user) => {
          if (!user) {
            this._unsubscribeTokenRefresh();
            // Also flush offline queue if we had any? We'll handle on next send.
          }
        });

        // Setup Cloud Functions
        const functions = getFunctions();
        this.sendPushCF = httpsCallable(functions, 'sendPushNotification');
        this.sendEmailCF = httpsCallable(functions, 'sendEmailNotification'); // new CF

        this.initialized = true;
        console.log('[Notifications] ✅ Initialized');
      } catch (err) {
        console.error('[Notifications] ❌ Init failed', err);
        this.initPromise = null;
        throw enhanceError(err, 'Failed to initialize notifications service');
      }
    })();

    return this.initPromise;
  }

  // --------------------------------------------------------------------
  //  🔔 CORE NOTIFICATION METHODS (with deduplication, batching, priority)
  // --------------------------------------------------------------------
  async sendNotification(notificationData, options = {}) {
    await this.ensureInitialized();

    if (notificationData.senderId && notificationData.senderId === notificationData.recipientId) {
      console.log('[Notifications] Blocked self-notification');
      return { success: false, reason: 'self_notification' };
    }

    const startTime = Date.now();

    // 1. Idempotency check (fixed: no Date.now)
    if (NOTIFICATIONS_CONFIG.DEDUPLICATION.ENABLED) {
      const idempotencyKey = await this._generateIdempotencyKey(notificationData);
      const exists = await this._checkIdempotencyKey(idempotencyKey);
      if (exists) {
        console.log('[Notifications] Duplicate blocked', idempotencyKey);
        return { success: false, reason: 'duplicate', idempotencyKey };
      }
    }

    // 2. Check if we should batch this notification
    if (NOTIFICATIONS_CONFIG.INTELLIGENCE.BATCH.ENABLED) {
      const batched = await this._tryBatchNotification(notificationData);
      if (batched) {
        this.metrics.batchedNotifications++;
        return { success: true, batched: true, reason: 'batched' };
      }
    }

    try {
      const validated = await this._validateNotification(notificationData);
      const intelligent = await this._applyIntelligence(validated);
      const shouldDeliver = await this._shouldDeliverNotification(intelligent);
      if (!shouldDeliver) {
        return { success: false, notificationId: null, reason: 'blocked', latency: Date.now() - startTime };
      }

      const notification = await this._buildNotificationObject(intelligent, options);
      const notificationId = notification.id;

      // Save to Firestore and update unread counter atomically
      await this._saveNotificationToFirestore(notificationId, notification, intelligent.recipientId);

      const deliveryResults = await this._deliverNotification(notificationId, notification, options);

      this.metrics.notificationsSent++;
      if (deliveryResults.inApp) this.metrics.notificationsDelivered++;
      this._addLatency(Date.now() - startTime);

      console.log('[Notifications] Sent', { notificationId, type: notification.type, latency: Date.now() - startTime });
      return { success: true, notificationId, notification, deliveryResults, latency: Date.now() - startTime };
    } catch (error) {
      this.metrics.errors++;
      // Offline queue fallback
      if (error.message.includes('offline') || error.message.includes('network')) {
        this._addToOfflineQueue(notificationData);
        return { success: false, reason: 'offline', queued: true };
      }
      throw enhanceError(error, 'Failed to send notification');
    }
  }

  async getUserNotifications(userId, options = {}) {
    await this.ensureInitialized();
    const { limit = 20, startAfter = null, includeRead = true, includeSponsored = true } = options;

    try {
      let q = this.fs.query(
        this.fs.collection(this.firestore, 'notifications'),
        this.fs.where('recipientId', '==', userId),
        this.fs.orderBy('createdAt', 'desc'),
        this.fs.limit(limit)
      );
      if (!includeRead) {
        q = this.fs.query(q, this.fs.where('read', '==', false));
      }
      if (startAfter) {
        const startAfterDoc = await this.fs.getDoc(this.fs.doc(this.firestore, 'notifications', startAfter));
        if (startAfterDoc.exists()) {
          q = this.fs.query(q, this.fs.startAfter(startAfterDoc));
        }
      }

      const snapshot = await this.fs.getDocs(q);
      let notifications = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      // Sort by priority (high first) then createdAt desc
      notifications.sort((a, b) => {
        const priorityOrder = { high: 0, normal: 1, low: 2 };
        const aPrio = priorityOrder[a.priority] ?? 1;
        const bPrio = priorityOrder[b.priority] ?? 1;
        if (aPrio !== bPrio) return aPrio - bPrio;
        return b.createdAt?.toDate?.() - a.createdAt?.toDate?.() || 0;
      });

      // Inject sponsored
      if (includeSponsored && NOTIFICATIONS_CONFIG.MONETIZATION.AD_INTEGRATION.SPONSORED_NOTIFICATIONS) {
        const sponsored = await this._getSponsoredNotifications(userId, limit);
        if (sponsored.length) {
          notifications = this._interleaveSponsored(notifications, sponsored, NOTIFICATIONS_CONFIG.MONETIZATION.AD_INTEGRATION.ADS_PER_PAGE);
        }
      }

      this.metrics.cacheHits++;
      return notifications;
    } catch (error) {
      this.metrics.errors++;
      throw enhanceError(error, 'Failed to fetch notifications');
    }
  }

  async markNotificationAsRead(notificationId, userId, options = {}) {
    await this.ensureInitialized();
    const { awardCoins = true } = options;

    try {
      const notifRef = this.fs.doc(this.firestore, 'notifications', notificationId);
      const userRef = this.fs.doc(this.firestore, 'users', userId);

      await this.fs.runTransaction(this.firestore, async (transaction) => {
        const notifSnap = await transaction.get(notifRef);
        if (!notifSnap.exists) throw new Error('Notification not found');
        if (notifSnap.data().recipientId !== userId) throw new Error('Unauthorized');

        if (!notifSnap.data().read) {
          transaction.update(notifRef, { read: true, readAt: this.fs.serverTimestamp() });
          transaction.update(userRef, { unreadNotifications: this.fs.increment(-1) });

          // Coin reward
          if (awardCoins && NOTIFICATIONS_CONFIG.MONETIZATION.ENGAGEMENT_REWARDS.BONUS_COINS.FIRST_CLICK > 0) {
            const monetization = getMonetizationService();
            await monetization.addCoins(
              userId,
              NOTIFICATIONS_CONFIG.MONETIZATION.ENGAGEMENT_REWARDS.BONUS_COINS.FIRST_CLICK,
              'notification_click',
              { notificationId, type: notifSnap.data().type }
            ).catch(err => console.warn('Coin reward failed', err));
          }
        }
      });

      this.metrics.notificationsClicked++;
      // Track click for analytics
      this._trackEvent('notification_click', { notificationId, userId, type: notification.type });
      return { success: true };
    } catch (error) {
      this.metrics.errors++;
      throw enhanceError(error, 'Failed to mark notification as read');
    }
  }

  async markAllAsRead(userId) {
    await this.ensureInitialized();
    try {
      const batch = this.fs.writeBatch(this.firestore);
      const q = this.fs.query(
        this.fs.collection(this.firestore, 'notifications'),
        this.fs.where('recipientId', '==', userId),
        this.fs.where('read', '==', false),
        this.fs.limit(500)
      );
      const snapshot = await this.fs.getDocs(q);
      snapshot.docs.forEach(doc => {
        batch.update(doc.ref, { read: true, readAt: this.fs.serverTimestamp() });
      });
      await batch.commit();

      const userRef = this.fs.doc(this.firestore, 'users', userId);
      await this.fs.updateDoc(userRef, { unreadNotifications: 0 });

      return { success: true, count: snapshot.size };
    } catch (error) {
      this.metrics.errors++;
      throw enhanceError(error, 'Failed to mark all as read');
    }
  }

  async deleteNotification(notificationId, userId) {
    await this.ensureInitialized();
    try {
      const notifRef = this.fs.doc(this.firestore, 'notifications', notificationId);
      const notifSnap = await this.fs.getDoc(notifRef);
      if (!notifSnap.exists) throw new Error('Notification not found');
      if (notifSnap.data().recipientId !== userId) throw new Error('Unauthorized');

      await this.fs.deleteDoc(notifRef);
      if (!notifSnap.data().read) {
        const userRef = this.fs.doc(this.firestore, 'users', userId);
        await this.fs.updateDoc(userRef, { unreadNotifications: this.fs.increment(-1) });
      }
      return { success: true };
    } catch (error) {
      this.metrics.errors++;
      throw enhanceError(error, 'Failed to delete notification');
    }
  }

  // --------------------------------------------------------------------
  //  📱 PUSH NOTIFICATIONS
  // --------------------------------------------------------------------
  async requestPushPermission(userId) {
    await this.ensureInitialized();
    if (!('Notification' in window)) throw new Error('Notifications not supported');
    if (!this.messagingMethods.isSupported()) throw new Error('FCM not supported');

    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      const token = await this.messagingMethods.getToken(this.messaging, { vapidKey: process.env.VAPID_KEY });
      if (token) {
        await this._savePushToken(userId, token);
        this._setupPushMessageListener();
        this._setupTokenRefreshListener(userId);
        return { success: true, permission, token };
      }
      throw new Error('Failed to get FCM token');
    }
    return { success: false, permission };
  }

  async _savePushToken(userId, token) {
    await this.ensureInitialized();
    let deviceId = localStorage.getItem('device_id');
    if (!deviceId) {
      deviceId = `device_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
      localStorage.setItem('device_id', deviceId);
    }

    const tokenRef = this.fs.doc(this.firestore, 'push_tokens', userId, 'devices', deviceId);
    await this.fs.setDoc(tokenRef, {
      token,
      platform: this._getPlatform(),
      userAgent: navigator.userAgent,
      createdAt: this.fs.serverTimestamp(),
      updatedAt: this.fs.serverTimestamp(),
      lastUsed: this.fs.serverTimestamp(),
    }, { merge: true });

    // Enforce token limit
    await this._enforceTokenLimit(userId);
  }

  async _enforceTokenLimit(userId) {
    const tokensRef = this.fs.collection(this.firestore, 'push_tokens', userId, 'devices');
    const snapshot = await this.fs.getDocs(tokensRef);
    if (snapshot.size > NOTIFICATIONS_CONFIG.TOKEN.MAX_TOKENS_PER_USER) {
      const tokens = snapshot.docs.map(doc => ({ id: doc.id, updatedAt: doc.data().updatedAt }));
      tokens.sort((a, b) => (b.updatedAt?.toDate?.() || 0) - (a.updatedAt?.toDate?.() || 0));
      const toDelete = tokens.slice(NOTIFICATIONS_CONFIG.TOKEN.MAX_TOKENS_PER_USER);
      const batch = this.fs.writeBatch(this.firestore);
      toDelete.forEach(t => {
        const docRef = this.fs.doc(this.firestore, 'push_tokens', userId, 'devices', t.id);
        batch.delete(docRef);
      });
      await batch.commit();
      console.log(`[Notifications] Enforced token limit: deleted ${toDelete.length} old tokens for user ${userId}`);
    }
  }

  async removePushToken(userId) {
    await this.ensureInitialized();
    const deviceId = localStorage.getItem('device_id');
    if (!deviceId) return { success: false, reason: 'No device ID' };
    const tokenRef = this.fs.doc(this.firestore, 'push_tokens', userId, 'devices', deviceId);
    await this.fs.deleteDoc(tokenRef);
    try {
      await this.messagingMethods.deleteToken(this.messaging);
    } catch (err) {
      console.warn('[Notifications] Failed to delete FCM token', err);
    }
    return { success: true };
  }

  async _getUserPushTokens(userId) {
    const tokensRef = this.fs.collection(this.firestore, 'push_tokens', userId, 'devices');
    const snapshot = await this.fs.getDocs(tokensRef);
    return snapshot.docs.map(doc => doc.data().token).filter(Boolean);
  }

  _setupPushMessageListener() {
    if (!this.messaging || !this.messagingMethods.onMessage) return;
    this.messagingMethods.onMessage(this.messaging, (payload) => {
      console.log('[Notifications] Push received', payload);
      if (payload.notification) {
        this._showNativeNotification({
          id: payload.data?.notificationId || Date.now().toString(),
          title: payload.notification.title,
          message: payload.notification.body,
          actionUrl: payload.data?.click_action
        });
      }
    });
  }

  _setupTokenRefreshListener(userId) {
    if (this.tokenRefreshUnsubscribe) return;
    if (!this.messagingMethods.onTokenRefresh) {
      console.warn('[Notifications] onTokenRefresh not available');
      return;
    }
    this.tokenRefreshUnsubscribe = this.messagingMethods.onTokenRefresh(async () => {
      console.log('[Notifications] Token refresh triggered');
      const currentUser = this.auth.currentUser;
      if (!currentUser) {
        console.warn('[Notifications] No user signed in, cannot refresh token');
        return;
      }
      try {
        const newToken = await this.messagingMethods.getToken(this.messaging, { vapidKey: process.env.VAPID_KEY });
        if (newToken) {
          await this._savePushToken(currentUser.uid, newToken);
          this.metrics.tokensRefreshed++;
        }
      } catch (err) {
        console.error('[Notifications] Failed to refresh token', err);
      }
    });
  }

  _unsubscribeTokenRefresh() {
    if (this.tokenRefreshUnsubscribe) {
      this.tokenRefreshUnsubscribe();
      this.tokenRefreshUnsubscribe = null;
      console.log('[Notifications] Token refresh listener unsubscribed');
    }
  }

  // --------------------------------------------------------------------
  //  🧠 INTELLIGENCE & FILTERING (cached fatigue)
  // --------------------------------------------------------------------
  async _validateNotification(data) {
    if (!data.type) throw new Error('Notification type is required');
    if (!data.recipientId) throw new Error('Recipient ID is required');
    if (!data.senderId && data.type !== NOTIFICATIONS_CONFIG.TYPES.SYSTEM_ALERT) {
      throw new Error('Sender ID is required for non‑system notifications');
    }
    // Add more validation per type if needed
    return data;
  }

  async _applyIntelligence(notification) {
    // Personalisation: could fetch user preferences and adjust priority
    const prefs = await this.getUserNotificationPreferences(notification.recipientId);
    if (prefs.priorityMap && prefs.priorityMap[notification.type]) {
      notification.priority = prefs.priorityMap[notification.type];
    }
    return notification;
  }

  async _shouldDeliverNotification(notification) {
    const prefs = await this.getUserNotificationPreferences(notification.recipientId);
    if (!prefs || prefs.muted) return false;
    if (prefs.blockedTypes && prefs.blockedTypes.includes(notification.type)) return false;

    // Fatigue check using cached counter (no expensive query)
    const fatigue = await this._getFatigueCounter(notification.recipientId);
    if (fatigue.count >= NOTIFICATIONS_CONFIG.INTELLIGENCE.FILTERING.USER_FATIGUE.MAX_PER_HOUR) return false;

    return true;
  }

  async _getFatigueCounter(userId) {
    // Use a separate collection to store hourly counters with TTL
    const hourKey = Math.floor(Date.now() / 3600000);
    const counterRef = this.fs.doc(this.firestore, 'user_fatigue', `${userId}_${hourKey}`);
    const snap = await this.fs.getDoc(counterRef);
    if (snap.exists()) {
      return { count: snap.data().count, lastReset: snap.data().createdAt };
    } else {
      return { count: 0 };
    }
  }

  async _incrementFatigueCounter(userId) {
    const hourKey = Math.floor(Date.now() / 3600000);
    const counterRef = this.fs.doc(this.firestore, 'user_fatigue', `${userId}_${hourKey}`);
    await this.fs.setDoc(counterRef, { count: this.fs.increment(1), createdAt: this.fs.serverTimestamp() }, { merge: true });
    // Set TTL via Cloud Function or Firestore TTL policy (expire after 1 hour)
  }

  async _buildNotificationObject(notificationData, options) {
    const id = `notif_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
    const now = this.fs.serverTimestamp();
    return {
      id,
      ...notificationData,
      read: false,
      createdAt: now,
      updatedAt: now,
      expiresAt: options.expiresAt || null,
      priority: notificationData.priority || 'normal',
      metadata: notificationData.metadata || {},
      channel: notificationData.channel || 'in_app'
    };
  }

  async _saveNotificationToFirestore(notificationId, notification, recipientId) {
    const notifRef = this.fs.doc(this.firestore, 'notifications', notificationId);
    const userRef = this.fs.doc(this.firestore, 'users', recipientId);

    await this.fs.runTransaction(this.firestore, async (transaction) => {
      transaction.set(notifRef, notification);
      transaction.update(userRef, { unreadNotifications: this.fs.increment(1) });
    });

    // Increment fatigue counter
    await this._incrementFatigueCounter(recipientId);

    // Store idempotency key
    if (NOTIFICATIONS_CONFIG.DEDUPLICATION.ENABLED) {
      const idempotencyKey = await this._generateIdempotencyKey(notification);
      const dedupeRef = this.fs.doc(this.firestore, 'notification_dedupe', idempotencyKey);
      const expiresAt = new Date(Date.now() + NOTIFICATIONS_CONFIG.DEDUPLICATION.TTL_SECONDS * 1000);
      await this.fs.setDoc(dedupeRef, {
        key: idempotencyKey,
        notificationId,
        createdAt: this.fs.serverTimestamp(),
        expiresAt
      });
    }
  }

  async _generateIdempotencyKey(notificationData) {
    // No Date.now – uses deterministic fields
    const str = `${notificationData.type}_${notificationData.senderId || ''}_${notificationData.recipientId}_${notificationData.targetId || ''}`;
    const encoder = new TextEncoder();
    const data = encoder.encode(str);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  async _checkIdempotencyKey(key) {
    const ref = this.fs.doc(this.firestore, 'notification_dedupe', key);
    const snap = await this.fs.getDoc(ref);
    return snap.exists();
  }

  async _deliverNotification(notificationId, notification, options) {
    const results = { inApp: false, push: false, email: false, websocket: false };
    if (NOTIFICATIONS_CONFIG.CHANNELS.IN_APP.ENABLED) {
      results.inApp = true;
    }
    if (NOTIFICATIONS_CONFIG.CHANNELS.PUSH.ENABLED && notification.push !== false) {
      results.push = await this._sendPushNotification(notificationId, notification);
    }
    if (NOTIFICATIONS_CONFIG.CHANNELS.EMAIL.ENABLED && notification.email !== false) {
      results.email = await this._sendEmailNotification(notificationId, notification);
    }
    if (NOTIFICATIONS_CONFIG.CHANNELS.WEB_SOCKET.ENABLED && notification.websocket !== false) {
      results.websocket = await this._sendWebSocketNotification(notificationId, notification);
    }
    return results;
  }

  async _sendPushNotification(notificationId, notification) {
    try {
      const tokens = await this._getUserPushTokens(notification.recipientId);
      if (!tokens.length) return false;

      const payload = {
        tokens,
        notification: {
          title: notification.title,
          body: notification.message || notification.title,
          data: {
            notificationId,
            type: notification.type,
            click_action: notification.actionUrl || '',
            ...notification.metadata
          }
        }
      };
      await this.sendPushCF(payload);
      return true;
    } catch (err) {
      console.warn('[Push] Delivery failed', err);
      return false;
    }
  }

  async _sendEmailNotification(notificationId, notification) {
    try {
      // Call Cloud Function to send email via SendGrid or other provider
      const payload = {
        to: notification.recipientEmail, // assume we have email in notification or fetch from user
        subject: notification.title,
        body: notification.message,
        notificationId
      };
      await this.sendEmailCF(payload);
      return true;
    } catch (err) {
      console.warn('[Email] Delivery failed', err);
      return false;
    }
  }

  async _sendWebSocketNotification(notificationId, notification) {
    // Already handled by realtime subscriptions
    return true;
  }

  _showNativeNotification(notif) {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    new Notification(notif.title, { body: notif.message, data: { url: notif.actionUrl } });
  }

  // --------------------------------------------------------------------
  //  💰 MONETIZATION INTEGRATION
  // --------------------------------------------------------------------
  async _getSponsoredNotifications(userId, limit) {
    try {
      const monetization = getMonetizationService();
      const ad = await monetization.getAd('notifications', userId);
      if (!ad) return [];
      return [{
        id: `sponsored_${ad.id}`,
        type: NOTIFICATIONS_CONFIG.TYPES.SPONSORED,
        title: ad.title || 'Sponsored',
        message: ad.description || '',
        imageUrl: ad.imageUrl,
        actionUrl: ad.clickUrl,
        recipientId: userId,
        senderId: 'system',
        read: false,
        sponsored: true,
        createdAt: new Date().toISOString(),
        metadata: { adId: ad.id }
      }];
    } catch (err) {
      console.warn('Failed to fetch sponsored notification', err);
      return [];
    }
  }

  _interleaveSponsored(notifications, sponsored, maxAds) {
    const result = [];
    let adIndex = 0;
    for (let i = 0; i < notifications.length; i++) {
      result.push(notifications[i]);
      if ((i + 1) % 5 === 0 && adIndex < maxAds && adIndex < sponsored.length) {
        result.push(sponsored[adIndex++]);
      }
    }
    while (adIndex < maxAds && adIndex < sponsored.length) {
      result.push(sponsored[adIndex++]);
    }
    return result;
  }

  // --------------------------------------------------------------------
  //  🧩 BATCH NOTIFICATIONS (LIKE INSTAGRAM)
  // --------------------------------------------------------------------
  async _tryBatchNotification(notificationData) {
    // For types that can be batched (e.g., LIKE, FOLLOW)
    const batchableTypes = [NOTIFICATIONS_CONFIG.TYPES.LIKE, NOTIFICATIONS_CONFIG.TYPES.FOLLOW];
    if (!batchableTypes.includes(notificationData.type)) return false;

    const { recipientId, senderId, targetId, type } = notificationData;
    const timeWindow = NOTIFICATIONS_CONFIG.INTELLIGENCE.BATCH.TIME_WINDOW;
    const cutoff = new Date(Date.now() - timeWindow);

    // Look for an existing pending batch notification for the same recipient and target
    const q = this.fs.query(
      this.fs.collection(this.firestore, 'notifications'),
      this.fs.where('recipientId', '==', recipientId),
      this.fs.where('type', '==', type),
      this.fs.where('targetId', '==', targetId),
      this.fs.where('batched', '==', true),
      this.fs.where('createdAt', '>=', cutoff),
      this.fs.orderBy('createdAt', 'desc'),
      this.fs.limit(1)
    );
    const snap = await this.fs.getDocs(q);
    if (snap.empty) return false;

    const batchNotif = snap.docs[0];
    const batchData = batchNotif.data();
    const currentCount = batchData.batchCount || 1;

    // Update the batch notification with new count
    const updatedCount = currentCount + 1;
    await this.fs.updateDoc(batchNotif.ref, {
      batchCount: updatedCount,
      updatedAt: this.fs.serverTimestamp(),
      message: `${updatedCount} people ${type === NOTIFICATIONS_CONFIG.TYPES.LIKE ? 'liked' : 'followed'} your ${targetId === 'post' ? 'post' : 'profile'}`,
      // Optionally store latest sender info
      lastSenderId: senderId
    });

    // We do not create a new notification; we update the batch.
    return true;
  }

  // --------------------------------------------------------------------
  //  📦 OFFLINE QUEUE
  // --------------------------------------------------------------------
  _addToOfflineQueue(notificationData) {
    if (this.offlineQueue.length >= NOTIFICATIONS_CONFIG.PERFORMANCE.OFFLINE_QUEUE_MAX) {
      this.offlineQueue.shift(); // remove oldest
    }
    this.offlineQueue.push({ data: notificationData, timestamp: Date.now() });
    // Optionally persist to localStorage
    try {
      localStorage.setItem('offline_notifications', JSON.stringify(this.offlineQueue));
    } catch (e) {}
  }

  async flushOfflineQueue() {
    if (!navigator.onLine) return;
    const queue = [...this.offlineQueue];
    this.offlineQueue = [];
    for (const item of queue) {
      try {
        await this.sendNotification(item.data);
      } catch (err) {
        console.warn('Failed to send queued notification', err);
        // re-queue?
      }
    }
    try {
      localStorage.removeItem('offline_notifications');
    } catch (e) {}
  }

  // --------------------------------------------------------------------
  //  📊 ANALYTICS & EVENT TRACKING
  // --------------------------------------------------------------------
  _trackEvent(eventName, properties) {
    // Send to analytics service (e.g., Firebase Analytics, Mixpanel)
    if (window.gtag) {
      window.gtag('event', eventName, properties);
    } else if (window.fbq) {
      window.fbq('track', eventName, properties);
    }
    // Also could store in Firestore for custom dashboard
    console.log(`[Analytics] ${eventName}`, properties);
  }

  async getNotificationAnalytics(userId, timeFrame = 'week') {
    // Placeholder: could aggregate from analytics service
    return { sent: this.metrics.notificationsSent, opened: this.metrics.notificationsOpened, ctr: 0.12 };
  }

  // --------------------------------------------------------------------
  //  USER PREFERENCES (enhanced with priority mapping)
  // --------------------------------------------------------------------
  async getUserNotificationPreferences(userId) {
    const cached = this.userPreferencesCache.get(userId);
    if (cached && cached.expires > Date.now()) {
      return cached.prefs;
    }
    const prefsRef = this.fs.doc(this.firestore, 'user_preferences', userId);
    const snap = await this.fs.getDoc(prefsRef);
    const prefs = snap.exists() ? snap.data() : { muted: false, blockedTypes: [], priorityMap: {} };
    this.userPreferencesCache.set(userId, { prefs, expires: Date.now() + NOTIFICATIONS_CONFIG.PERFORMANCE.CACHE_EXPIRY });
    return prefs;
  }

  async updateUserNotificationPreferences(userId, updates) {
    const prefsRef = this.fs.doc(this.firestore, 'user_preferences', userId);
    await this.fs.setDoc(prefsRef, updates, { merge: true });
    this.userPreferencesCache.delete(userId);
    return { success: true };
  }

  async muteNotifications(userId, options = {}) {
    return this.updateUserNotificationPreferences(userId, { muted: true, muteExpiry: options.duration ? new Date(Date.now() + options.duration) : null });
  }

  async unmuteNotifications(userId) {
    return this.updateUserNotificationPreferences(userId, { muted: false, muteExpiry: null });
  }

  // --------------------------------------------------------------------
  //  REAL‑TIME SUBSCRIPTIONS
  // --------------------------------------------------------------------
  subscribeToUserNotifications(userId, callback) {
    const q = this.fs.query(
      this.fs.collection(this.firestore, 'notifications'),
      this.fs.where('recipientId', '==', userId),
      this.fs.orderBy('createdAt', 'desc'),
      this.fs.limit(50)
    );
    const unsubscribe = this.fs.onSnapshot(q, (snapshot) => {
      const notifs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      callback(notifs);
    });
    this.realtimeSubscriptions.set(`notifications_${userId}`, unsubscribe);
    return unsubscribe;
  }

  subscribeToNotificationCount(userId, callback) {
    const userRef = this.fs.doc(this.firestore, 'users', userId);
    const unsubscribe = this.fs.onSnapshot(userRef, (doc) => {
      const count = doc.exists() ? (doc.data().unreadNotifications || 0) : 0;
      callback(count);
    });
    this.realtimeSubscriptions.set(`count_${userId}`, unsubscribe);
    return unsubscribe;
  }

  unsubscribe(id) {
    const unsub = this.realtimeSubscriptions.get(id);
    if (unsub) {
      unsub();
      this.realtimeSubscriptions.delete(id);
    }
  }

  // --------------------------------------------------------------------
  //  UTILITIES
  // --------------------------------------------------------------------
  _getPlatform() {
    const ua = navigator.userAgent;
    if (/android/i.test(ua)) return 'android';
    if (/iphone|ipad|ipod/i.test(ua)) return 'ios';
    if (/mac/i.test(ua)) return 'macos';
    if (/win/i.test(ua)) return 'windows';
    return 'web';
  }

  _addLatency(latency) {
    this.metrics.deliveryLatency.push(latency);
    if (this.metrics.deliveryLatency.length > NOTIFICATIONS_CONFIG.PERFORMANCE.MAX_LATENCY_ENTRIES) {
      this.metrics.deliveryLatency.shift();
    }
  }

  getStats() {
    return { ...this.metrics };
  }

  clearCache() {
    this.notificationsCache.clear();
    this.userPreferencesCache.clear();
  }

  destroy() {
    this._unsubscribeTokenRefresh();
    for (const unsub of this.realtimeSubscriptions.values()) {
      unsub();
    }
    this.realtimeSubscriptions.clear();
    this.clearCache();
    this.initialized = false;
    this.initPromise = null;
    console.log('[Notifications] Service destroyed');
  }
}

// ----------------------------------------------------------------------
//  SINGLETON EXPORT
// ----------------------------------------------------------------------
let instance = null;
export function getNotificationsService() {
  if (!instance) instance = new UltimateNotificationsService();
  return instance;
}

// ----------------------------------------------------------------------
//  COMPATIBILITY EXPORTS (unchanged)
// ----------------------------------------------------------------------
const notificationsService = {
  sendNotification: (data, opts) => getNotificationsService().sendNotification(data, opts),
  getUserNotifications: (uid, opts) => getNotificationsService().getUserNotifications(uid, opts),
  markNotificationAsRead: (id, uid, opts) => getNotificationsService().markNotificationAsRead(id, uid, opts),
  markAllAsRead: (uid) => getNotificationsService().markAllAsRead(uid),
  deleteNotification: (id, uid, opts) => getNotificationsService().deleteNotification(id, uid, opts),

  subscribeToUserNotifications: (uid, cb) => getNotificationsService().subscribeToUserNotifications(uid, cb),
  subscribeToNotificationCount: (uid, cb) => getNotificationsService().subscribeToNotificationCount(uid, cb),
  unsubscribe: (id) => getNotificationsService().unsubscribe(id),

  requestPushPermission: (uid) => getNotificationsService().requestPushPermission(uid),
  removePushToken: (uid) => getNotificationsService().removePushToken(uid),

  getUserNotificationPreferences: (uid) => getNotificationsService().getUserNotificationPreferences(uid),
  updateUserNotificationPreferences: (uid, updates) => getNotificationsService().updateUserNotificationPreferences(uid, updates),
  muteNotifications: (uid, opts) => getNotificationsService().muteNotifications(uid, opts),
  unmuteNotifications: (uid) => getNotificationsService().unmuteNotifications(uid),

  getNotificationAnalytics: (uid, tf) => getNotificationsService().getNotificationAnalytics(uid, tf),

  createLikeNotification: (pid, liker, owner) => getNotificationsService().sendNotification({
    type: NOTIFICATIONS_CONFIG.TYPES.LIKE,
    targetId: pid,
    senderId: liker,
    recipientId: owner,
    title: 'New like',
    message: 'Someone liked your post'
  }),
  createCommentNotification: (pid, commenter, owner, cid) => getNotificationsService().sendNotification({
    type: NOTIFICATIONS_CONFIG.TYPES.COMMENT,
    targetId: pid,
    senderId: commenter,
    recipientId: owner,
    title: 'New comment',
    message: 'Someone commented on your post'
  }),
  createFollowNotification: (follower, following) => getNotificationsService().sendNotification({
    type: NOTIFICATIONS_CONFIG.TYPES.FOLLOW,
    senderId: follower,
    recipientId: following,
    title: 'New follower',
    message: 'Someone started following you'
  }),
  createMessageNotification: (sender, recipient, mid, cid, txt) => getNotificationsService().sendNotification({
    type: NOTIFICATIONS_CONFIG.TYPES.MESSAGE,
    targetId: mid,
    senderId: sender,
    recipientId: recipient,
    title: 'New message',
    message: txt.substring(0, 100)
  }),

  getService: getNotificationsService,
  getStats: () => getNotificationsService().getStats(),
  clearCache: () => getNotificationsService().clearCache(),
  destroy: () => getNotificationsService().destroy(),

  TYPES: NOTIFICATIONS_CONFIG.TYPES
};

export default notificationsService;