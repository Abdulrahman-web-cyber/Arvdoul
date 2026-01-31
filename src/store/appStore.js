// src/store/appStore.js - ENTERPRISE PRO MAX v3
// ✅ SMART COINS • NOTIFICATIONS • USER PROFILE • PRODUCTION READY

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const useAppStore = create(
  persist(
    (set, get) => ({
      // User State
      currentUser: null,
      isAuthenticated: false,
      
      // Coins System
      coins: 1000, // Starting coins
      transactions: [],
      subscription: null,
      
      // Notifications
      notifications: [],
      unreadNotifications: 0,
      
      // App Settings
      theme: 'dark',
      language: 'en',
      soundEnabled: true,
      notificationsEnabled: true,
      
      // User Actions
      setCurrentUser: (user) => set({ 
        currentUser: user, 
        isAuthenticated: !!user 
      }),
      
      clearUserData: () => set({ 
        currentUser: null, 
        isAuthenticated: false,
        coins: 0,
        transactions: [],
        subscription: null,
        notifications: []
      }),
      
      // Coin Management
      addCoins: (amount) => {
        if (amount <= 0) return;
        
        const transaction = {
          id: `tx_${Date.now()}`,
          type: 'purchase',
          amount,
          date: new Date().toISOString(),
          previousBalance: get().coins,
          newBalance: get().coins + amount
        };
        
        set((state) => ({
          coins: state.coins + amount,
          transactions: [transaction, ...state.transactions]
        }));
        
        console.log(`💰 Added ${amount} coins. Total: ${get().coins}`);
      },
      
      deductCoins: (amount) => {
        if (amount <= 0 || get().coins < amount) {
          console.warn('Insufficient coins');
          return false;
        }
        
        const transaction = {
          id: `tx_${Date.now()}`,
          type: 'spend',
          amount: -amount,
          date: new Date().toISOString(),
          previousBalance: get().coins,
          newBalance: get().coins - amount
        };
        
        set((state) => ({
          coins: state.coins - amount,
          transactions: [transaction, ...state.transactions]
        }));
        
        console.log(`💰 Deducted ${amount} coins. Remaining: ${get().coins}`);
        return true;
      },
      
      // Notification Management
      addNotification: (notification) => {
        const newNotification = {
          id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          read: false,
          timestamp: new Date().toISOString(),
          ...notification
        };
        
        set((state) => ({
          notifications: [newNotification, ...state.notifications.slice(0, 99)], // Keep last 100
          unreadNotifications: state.unreadNotifications + 1
        }));
        
        console.log(`🔔 New notification: ${notification.title}`);
      },
      
      markNotificationAsRead: (notificationId) => {
        set((state) => {
          const updatedNotifications = state.notifications.map(notif =>
            notif.id === notificationId ? { ...notif, read: true } : notif
          );
          
          const unreadCount = updatedNotifications.filter(n => !n.read).length;
          
          return {
            notifications: updatedNotifications,
            unreadNotifications: unreadCount
          };
        });
      },
      
      markAllNotificationsAsRead: () => {
        set((state) => ({
          notifications: state.notifications.map(notif => ({ ...notif, read: true })),
          unreadNotifications: 0
        }));
      },
      
      clearNotifications: () => set({ 
        notifications: [], 
        unreadNotifications: 0 
      }),
      
      // User Profile Updates
      updateUserProfile: (updates) => set((state) => ({
        currentUser: state.currentUser ? { ...state.currentUser, ...updates } : null
      })),
      
      updateUserLastActive: () => set((state) => ({
        currentUser: state.currentUser ? { 
          ...state.currentUser, 
          lastActive: new Date().toISOString() 
        } : null
      })),
      
      // Subscription Management
      setSubscription: (subscription) => set({ subscription }),
      
      cancelSubscription: () => set({ 
        subscription: null 
      }),
      
      // Settings Management
      setTheme: (theme) => set({ theme }),
      setLanguage: (language) => set({ language }),
      toggleSound: () => set((state) => ({ soundEnabled: !state.soundEnabled })),
      toggleNotifications: () => set((state) => ({ notificationsEnabled: !state.notificationsEnabled })),
      
      // Utility Functions
      hasEnoughCoins: (amount) => get().coins >= amount,
      getCoinBalance: () => get().coins,
      getRecentTransactions: (limit = 10) => get().transactions.slice(0, limit),
      getUnreadNotifications: () => get().notifications.filter(n => !n.read),
      
      // Reset State
      resetStore: () => set({
        currentUser: null,
        isAuthenticated: false,
        coins: 1000,
        transactions: [],
        subscription: null,
        notifications: [],
        unreadNotifications: 0,
        theme: 'dark',
        language: 'en',
        soundEnabled: true,
        notificationsEnabled: true
      })
    }),
    {
      name: 'arvdoul-app-store',
      partialize: (state) => ({
        currentUser: state.currentUser,
        coins: state.coins,
        transactions: state.transactions.slice(0, 50), // Store last 50 transactions
        subscription: state.subscription,
        notifications: state.notifications.slice(0, 50), // Store last 50 notifications
        unreadNotifications: state.unreadNotifications,
        theme: state.theme,
        language: state.language,
        soundEnabled: state.soundEnabled,
        notificationsEnabled: state.notificationsEnabled
      })
    }
  )
);

export { useAppStore };