// src/app/AppStateGuard.jsx - Resilient route guard and navigation coordinator
import React, { useEffect, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import PageLoader from "../components/UI/PageLoader.jsx";
import {
  resolvePostAuthDestination,
  safeReturnPath,
} from "../utils/profileCompletion.js";

export default function AppStateGuard({ children }) {
  const location = useLocation();
  const navigate = useNavigate();
  const {
    user,
    loading: authLoading,
    isAuthenticated,
    isEmailVerified,
    authInitialized,
    profileResolved,
    needsOnboarding,
    isSignupInProgress,
  } = useAuth();

  const needsEmailVerification = useMemo(() => {
    if (!user) return false;
    const provider = (user.authProvider || "").toLowerCase();
    if (provider.includes("google") || provider.includes("phone") || provider.includes("apple")) {
      return false;
    }
    return (
      (provider === "email" || provider === "password" || provider === "unknown") &&
      !!user.email &&
      !user.emailVerified
    );
  }, [user]);

  const decision = useMemo(() => {
    return resolvePostAuthDestination({
      pathname: location.pathname,
      isAuthenticated,
      authInitialized,
      authLoading,
      profileResolved,
      needsEmailVerification,
      needsOnboarding,
      isSplash: location.pathname === "/",
    });
  }, [
    location.pathname,
    isAuthenticated,
    authInitialized,
    authLoading,
    profileResolved,
    needsEmailVerification,
    needsOnboarding,
  ]);

  useEffect(() => {
    if (decision.destination && !decision.wait) {
      const target =
        decision.destination === "/home"
          ? safeReturnPath(new URLSearchParams(window.location.search).get("from"))
          : decision.destination;
      const navState =
        target === "/verify-email"
          ? { email: user?.email, userId: user?.uid, fromSignup: true }
          : undefined;
      navigate(target, { replace: true, state: navState });
    }
  }, [decision, navigate, user]);

  // When auth state is resolving during cold-start:
  // If on splash, allow splash to render.
  // If on another route, show a clean branded transition screen.
  if (decision.wait) {
    if (location.pathname === "/") {
      return children;
    }
    return (
      <div className="min-h-screen w-full flex flex-col items-center justify-center bg-gray-50 dark:bg-[#03071B] text-gray-900 dark:text-white">
        <div className="w-10 h-10 border-3 border-violet-500 border-t-transparent rounded-full animate-spin mb-3" />
        <p className="text-xs font-medium text-gray-400">Loading Arvdoul...</p>
      </div>
    );
  }

  // If redirecting, render a clean transition state instead of an empty white void
  if (decision.destination && !decision.wait) {
    return (
      <div className="min-h-screen w-full flex flex-col items-center justify-center bg-gray-50 dark:bg-[#03071B] text-gray-900 dark:text-white">
        <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return children;
}
