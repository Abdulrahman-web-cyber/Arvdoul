// src/hooks/useAuth.js
import { useContext } from "react";
import { AuthContext } from "../../../context/AuthContext";

/**
 * useAuth hook
 * Provides access to AuthContext state and helper methods
 */
export const useAuth = () => {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }

  return {
    ...context,

    /**
     * Get current user display name (from profile or fallback)
     */
    getDisplayName: () =>
      context.user?.profile?.displayName || context.user?.displayName || "",

    /**
     * Get user profile picture URL (from profile or fallback)
     */
    getProfilePicture: () =>
      context.user?.profile?.profilePicture ||
      context.user?.photoURL ||
      import.meta.env.VITE_DEFAULT_PROFILE_PICTURE,

    /**
     * Check if user is logged in
     */
    isLoggedIn: () => !!context.user,

    /**
     * Get current coin balance
     */
    getCoins: () =>
      context.user?.profile?.coins ||
      parseInt(import.meta.env.VITE_INITIAL_COIN_BALANCE || "100", 10),

    /**
     * Trigger sign out
     */
    signOut: async () => {
      if (context.logout) await context.logout();
    },
  };
};
