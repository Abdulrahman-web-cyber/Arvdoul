// src/store/appStore.js - ENTERPRISE CENTRAL STATE MANAGER V4
// ✅ COINS SYNCED FROM FIRESTORE • OPTIMISTIC UPDATES • PRODUCTION READY
// 🔥 Backward‑compatible, works with all services and cloud functions.

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer'; // optional, for immutable updates

// For optimistic operations, we need a unique ID generator
const generateTempId = () => `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

const useAppStore = create(
  persist(
    (set, get) => ({
      // ---------- Core State ----------
      currentUser: null,
      isAuthenticated: false,

      // Coins – always kept in memory, synced from Firestore
      coins: 0,
      transactions: [],               // in‑memory history (includes optimistic entries)
      
      // Subscription / Monetization extras
      subscription: null,
      
      // Notifications
      notifications: [],
      unreadNotifications: 0,
      
      // App Settings (persisted)
      theme: 'dark',
      language: 'en',
      soundEnabled: true,
      notificationsEnabled: true,

      // ---------- User & Auth ----------
      setCurrentUser: (user) => set({
        currentUser: user,
        isAuthenticated: !!user,
      }),

      clearUserData: () => set({
        currentUser: null,
        isAuthenticated: false,
        coins: 0,
        transactions: [],
        subscription: null,
        notifications: [],
        unreadNotifications: 0,
      }),

      /**
       * Sync user profile and coin balance from Firestore.
       * Call this after login or when the app resumes.
       */
      syncUserFromFirestore: async (userId) => {
        try {
          const userService = await import('../services/userService.js');
          const profile = await userService.getUserProfile(userId);
          if (profile) {
            set({
              currentUser: {
                ...get().currentUser,
                ...profile,
              },
              coins: profile.coins || 0,
            });
          }
          // Also load recent transactions
          await get().loadTransactionHistory(userId);
        } catch (error) {
          console.error('Failed to sync user from Firestore', error);
        }
      },

      /**
       * Load recent coin transactions from Firestore.
       */
      loadTransactionHistory: async (userId, limit = 20) => {
        try {
          const monetization = await import('../services/monetizationService.js');
          const txs = await monetization.getTransactionHistory(userId, limit);
          set({ transactions: txs });
        } catch (error) {
          console.error('Failed to load transaction history', error);
        }
      },

      // ---------- Optimistic Coin Operations ----------

      /**
       * Spend coins optimistically.
       * @param {number} amount - positive integer
       * @param {string} reason - reason for spending
       * @param {object} metadata - optional extra data
       * @returns {Promise<boolean>} true if successful
       */
      optimisticSpendCoins: async (amount, reason, metadata = {}) => {
        const state = get();
        if (!state.isAuthenticated || !state.currentUser) return false;
        if (state.coins < amount) return false;

        const tempId = generateTempId();
        const oldCoins = state.coins;
        const oldTransactions = state.transactions;

        // Optimistic update
        set({
          coins: oldCoins - amount,
          transactions: [
            {
              id: tempId,
              type: 'debit',
              amount: -amount,
              reason,
              metadata,
              date: new Date().toISOString(),
              previousBalance: oldCoins,
              newBalance: oldCoins - amount,
              optimistic: true,
            },
            ...oldTransactions,
          ],
        });

        try {
          const monetization = await import('../services/monetizationService.js');
          const result = await monetization.spendCoins(
            state.currentUser.uid,
            amount,
            reason,
            metadata
          );
          // Success – replace temp transaction with real one
          set((state) => ({
            coins: result.newBalance, // use server‑returned balance
            transactions: state.transactions.map((tx) =>
              tx.id === tempId
                ? { ...tx, id: result.transactionId, optimistic: false, serverTimestamp: result.timestamp }
                : tx
            ),
          }));
          return true;
        } catch (error) {
          // Failure – revert
          set({
            coins: oldCoins,
            transactions: oldTransactions,
          });
          console.error('Spend failed, reverted:', error);
          return false;
        }
      },

      /**
       * Add coins optimistically (usually from admin or purchase).
       * For admin calls, the cloud function enforces permissions.
       */
      optimisticAddCoins: async (amount, reason, metadata = {}) => {
        const state = get();
        if (!state.isAuthenticated || !state.currentUser) return false;

        const tempId = generateTempId();
        const oldCoins = state.coins;
        const oldTransactions = state.transactions;

        set({
          coins: oldCoins + amount,
          transactions: [
            {
              id: tempId,
              type: 'credit',
              amount,
              reason,
              metadata,
              date: new Date().toISOString(),
              previousBalance: oldCoins,
              newBalance: oldCoins + amount,
              optimistic: true,
            },
            ...oldTransactions,
          ],
        });

        try {
          const monetization = await import('../services/monetizationService.js');
          const result = await monetization.addCoins(
            state.currentUser.uid,
            amount,
            reason,
            metadata
          );
          set((state) => ({
            coins: result.newBalance,
            transactions: state.transactions.map((tx) =>
              tx.id === tempId
                ? { ...tx, id: result.transactionId, optimistic: false, serverTimestamp: result.timestamp }
                : tx
            ),
          }));
          return true;
        } catch (error) {
          set({
            coins: oldCoins,
            transactions: oldTransactions,
          });
          console.error('Add coins failed, reverted:', error);
          return false;
        }
      },

      /**
       * Transfer coins optimistically to another user.
       */
      optimisticTransferCoins: async (toUserId, amount, reason, metadata = {}) => {
        const state = get();
        if (!state.isAuthenticated || !state.currentUser) return false;
        if (state.coins < amount) return false;

        const tempId = generateTempId();
        const oldCoins = state.coins;
        const oldTransactions = state.transactions;

        set({
          coins: oldCoins - amount,
          transactions: [
            {
              id: tempId,
              type: 'transfer_out',
              amount: -amount,
              reason,
              metadata: { ...metadata, toUserId },
              date: new Date().toISOString(),
              previousBalance: oldCoins,
              newBalance: oldCoins - amount,
              optimistic: true,
            },
            ...oldTransactions,
          ],
        });

        try {
          const monetization = await import('../services/monetizationService.js');
          const result = await monetization.transferCoins(
            state.currentUser.uid,
            toUserId,
            amount,
            reason,
            metadata
          );
          set((state) => ({
            coins: result.fromNewBalance, // server returns new balance for sender
            transactions: state.transactions.map((tx) =>
              tx.id === tempId
                ? { ...tx, id: result.transactionId, optimistic: false, serverTimestamp: result.timestamp }
                : tx
            ),
          }));
          return true;
        } catch (error) {
          set({
            coins: oldCoins,
            transactions: oldTransactions,
          });
          console.error('Transfer failed, reverted:', error);
          return false;
        }
      },

      // ---------- Backward‑compatible wrappers ----------
      addCoins: (amount) => {
        // For backward compatibility: adds coins without reason/metadata
        return get().optimisticAddCoins(amount, 'manual_add', {});
      },

      deductCoins: (amount) => {
        return get().optimisticSpendCoins(amount, 'manual_spend', {});
      },

      hasEnoughCoins: (amount) => get().coins >= amount,

      getCoinBalance: () => get().coins,

      getRecentTransactions: (limit = 10) => get().transactions.slice(0, limit),

      // ---------- Optimistic Profile Updates ----------
      updateUserProfile: async (updates) => {
        const state = get();
        if (!state.isAuthenticated || !state.currentUser) return false;

        const oldUser = state.currentUser;
        // Optimistic update
        set({
          currentUser: { ...oldUser, ...updates },
        });

        try {
          const userService = await import('../services/userService.js');
          await userService.updateUserProfile(state.currentUser.uid, updates);
          // If avatar changed, maybe regenerate? Already handled in service.
          return true;
        } catch (error) {
          // Revert
          set({ currentUser: oldUser });
          console.error('Profile update failed, reverted:', error);
          return false;
        }
      },

      // ---------- Notification Management ----------
      addNotification: (notification) => {
        const newNotification = {
          id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          read: false,
          timestamp: new Date().toISOString(),
          ...notification,
        };
        set((state) => ({
          notifications: [newNotification, ...state.notifications.slice(0, 99)],
          unreadNotifications: state.unreadNotifications + 1,
        }));
      },

      markNotificationAsRead: (notificationId) => {
        set((state) => {
          const updated = state.notifications.map((n) =>
            n.id === notificationId ? { ...n, read: true } : n
          );
          return {
            notifications: updated,
            unreadNotifications: updated.filter((n) => !n.read).length,
          };
        });
      },

      markAllNotificationsAsRead: () => {
        set((state) => ({
          notifications: state.notifications.map((n) => ({ ...n, read: true })),
          unreadNotifications: 0,
        }));
      },

      clearNotifications: () => set({ notifications: [], unreadNotifications: 0 }),

      // ---------- Settings ----------
      setTheme: (theme) => set({ theme }),
      setLanguage: (language) => set({ language }),
      toggleSound: () => set((state) => ({ soundEnabled: !state.soundEnabled })),
      toggleNotifications: () => set((state) => ({ notificationsEnabled: !state.notificationsEnabled })),

      // ---------- Subscription ----------
      setSubscription: (subscription) => set({ subscription }),
      cancelSubscription: () => set({ subscription: null }),

      // ---------- Utility ----------
      resetStore: () => set({
        currentUser: null,
        isAuthenticated: false,
        coins: 0,
        transactions: [],
        subscription: null,
        notifications: [],
        unreadNotifications: 0,
        theme: 'dark',
        language: 'en',
        soundEnabled: true,
        notificationsEnabled: true,
      }),
    }),
    {
      name: 'arvdoul-app-store',
      // Persist only non‑transient data (coins and transactions stay in memory)
      partialize: (state) => ({
        currentUser: state.currentUser,               // keep user object (without coins)
        subscription: state.subscription,
        notifications: state.notifications.slice(0, 50),
        unreadNotifications: state.unreadNotifications,
        theme: state.theme,
        language: state.language,
        soundEnabled: state.soundEnabled,
        notificationsEnabled: state.notificationsEnabled,
      }),
    }
  )
);

export { useAppStore };