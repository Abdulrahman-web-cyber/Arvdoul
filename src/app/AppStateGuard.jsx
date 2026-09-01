// src/app/AppStateGuard.jsx - Resilient route guard and navigation coordinator
import React, { useEffect, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
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

  // If redirecting, return null seamlessly without flashing an extra blank spinner
  if (decision.destination && !decision.wait) {
    return null;
  }

  // Allow children to render directly so their native skeletons handle background data loading
  return children;
}
