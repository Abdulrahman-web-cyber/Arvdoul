// src/hooks/useAuth.js - ULTIMATE AUTH HOOK V2
// 🔥 PRODUCTION READY • INTEGRATED WITH APPSTORE • MEMOIZED • EXTENSIVE HELPERS

import { useContext, useMemo, useCallback } from "react";
import { AuthContext } from "../../../context/AuthContext";
import { useAppStore } from "../store/appStore";

/**
 * useAuth – Enterprise‑grade authentication hook
 *
 * Provides access to the full AuthContext plus convenient derived values
 * and utility methods that integrate seamlessly with the global app store.
 */
export const useAuth = () => {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }

  // Get coin/level data from the app store (kept in sync by AuthContext)
  const { currentUser: appStoreUser } = useAppStore();

  // ---------- memoized derived values ----------
  const isAuthenticated = useMemo(() => !!context.user, [context.user]);
  const isEmailVerified = useMemo(
    () => !!(context.user && context.user.emailVerified),
    [context.user]
  );
  const isProfileComplete = useMemo(
    () => !!(context.userProfile && context.userProfile.isProfileComplete),
    [context.userProfile]
  );
  const userId = useMemo(() => context.user?.uid || context.user?.userId, [context.user]);

  // ---------- helper methods (stable references) ----------
  const getDisplayName = useCallback(() => {
    return (
      context.userProfile?.displayName ||
      context.user?.displayName ||
      context.user?.email?.split("@")[0] ||
      "User"
    );
  }, [context.user, context.userProfile]);

  const getProfilePicture = useCallback(() => {
    return (
      context.userProfile?.photoURL ||
      context.user?.photoURL ||
      import.meta.env.VITE_DEFAULT_PROFILE_PICTURE ||
      "/assets/default-profile.png"
    );
  }, [context.user, context.userProfile]);

  const getCoins = useCallback(() => {
    // Prefer appStore coins (most up‑to‑date), fallback to profile or env
    return (
      appStoreUser?.coins ||
      context.userProfile?.coins ||
      parseInt(import.meta.env.VITE_INITIAL_COIN_BALANCE || "100", 10)
    );
  }, [appStoreUser, context.userProfile]);

  const getLevel = useCallback(() => {
    return appStoreUser?.level || context.userProfile?.level || 1;
  }, [appStoreUser, context.userProfile]);

  const getUserId = useCallback(() => userId, [userId]);

  // Force‑refresh user profile (useful after profile updates)
  const refreshUserProfile = useCallback(async () => {
    if (!userId) return null;
    try {
      const { getUserProfile } = await import("../services/userService.js");
      const profile = await getUserProfile(userId);
      // The context will automatically update via the auth listener,
      // but we can also manually trigger a reload of the Firebase user.
      if (context.authService) {
        await context.authService.checkEmailVerification(userId);
      }
      return profile;
    } catch (err) {
      console.error("Failed to refresh user profile:", err);
      return null;
    }
  }, [userId, context.authService]);

  // Safe sign out (uses context.signOut)
  const signOut = useCallback(async () => {
    if (!context.signOut) throw new Error("signOut not available");
    return await context.signOut();
  }, [context.signOut]);

  // ---------- build the return object ----------
  const value = useMemo(() => ({
    // Spread all original context values (signIn, signUp, loading, error, user, etc.)
    ...context,

    // Derived booleans
    isAuthenticated,
    isEmailVerified,
    isProfileComplete,
    userId,

    // Helper functions
    getDisplayName,
    getProfilePicture,
    getCoins,
    getLevel,
    getUserId,
    refreshUserProfile,
    signOut,  // override with our safe version

    // Legacy aliases for backward compatibility (if any code used them)
    isLoggedIn: isAuthenticated,
    getCurrentUserId: getUserId,
  }), [
    context,
    isAuthenticated,
    isEmailVerified,
    isProfileComplete,
    userId,
    getDisplayName,
    getProfilePicture,
    getCoins,
    getLevel,
    getUserId,
    refreshUserProfile,
    signOut,
  ]);

  return value;
};

// Also export a default for convenience
export default useAuth;