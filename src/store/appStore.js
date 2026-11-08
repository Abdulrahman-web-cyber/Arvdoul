// src/store/appStore.js

import { create } from 'zustand';

/**
 * The app-wide store is now a single-purpose identity mirror.
 *
 * It previously also held an in-memory coin ledger (`coins`, `transactions`,
 * `addCoins`, `deductCoins`, …), a notification feed, and theme/language/
 * sound/subscription toggles. Nothing ever read any of those keys: the real
 * balance is the Firestore coin ledger (`monetizationService` /
 * `userService.getCoinBalance`), notifications live in `notificationsService`,
 * and theme/language/sound/subscription are owned by `ThemeContext`, i18n and
 * `monetizationService.getSubscriptionStatus`. The duplicate state was dead
 * weight that could silently drift from the server, so it was removed.
 *
 * Only the identity mirror the UI actually consumes remains:
 *   - `currentUser` / `isAuthenticated` / `setCurrentUser` / `clearUserData`
 *   - `setAppState` (local merge into the mirror, used by profile modals)
 *   - `updateUserProfile` (local merge of just-updated fields)
 *   - `updateUserLastActive`
 *
 * Identity is NEVER persisted. A persisted `currentUser` survived sign-out and
 * rehydrated on reload, so on a shared device account A's profile could render
 * in account B's session before auth resolved. The live Firebase Auth user
 * (AuthContext) is the only identity source; this store is only a UI mirror set
 * from it.
 */

const useAppStore = create((set) => ({
  // User State
  currentUser: null,
  isAuthenticated: false,

  // Local merge into the identity mirror (used by profile modals that update a
  // single field after a successful profile write).
  setAppState: (updates) => set(updates),

  setCurrentUser: (user) => set({
    currentUser: user,
    isAuthenticated: !!user
  }),

  clearUserData: () => set({
    currentUser: null,
    isAuthenticated: false
  }),

  // User Profile Updates (local mirror only — the write already happened)
  updateUserProfile: (updates) => set((state) => ({
    currentUser: state.currentUser ? { ...state.currentUser, ...updates } : null
  })),

  updateUserLastActive: () => set((state) => ({
    currentUser: state.currentUser ? {
      ...state.currentUser,
      lastActive: new Date().toISOString()
    } : null
  }))
}));

export { useAppStore };
