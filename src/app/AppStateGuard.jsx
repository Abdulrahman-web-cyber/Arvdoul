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

  // When auth state is resolving during cold-start, allow rendering seamlessly without blocking screens
  if (decision.wait) {
    return children;
  }

  // If redirecting, return null seamlessly without flashing
  if (decision.destination && !decision.wait) {
    return null;
  }

  return children;
}
