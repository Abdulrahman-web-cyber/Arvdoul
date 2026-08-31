// src/app/AppStateGuard.jsx - Resilient route guard and navigation coordinator
import React, { useEffect, useState, useMemo, useRef } from "react";
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

  const [shouldRender, setShouldRender] = useState(false);
  const lastDecision = useRef({ path: "", decision: null });

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

  useEffect(() => {
    const decision = resolvePostAuthDestination({
      pathname: location.pathname,
      isAuthenticated,
      authInitialized,
      authLoading,
      profileResolved,
      needsEmailVerification,
      needsOnboarding,
      isSplash: location.pathname === "/",
    });

    const currentStateKey = [
      location.pathname,
      isAuthenticated,
      isEmailVerified,
      needsOnboarding,
      profileResolved,
      authInitialized,
      authLoading,
      isSignupInProgress,
      needsEmailVerification,
    ].join("-");

    if (lastDecision.current.path === currentStateKey) {
      setShouldRender(decision.allow && !decision.wait);
      return;
    }

    if (decision.wait) {
      setShouldRender(false);
      lastDecision.current = { path: currentStateKey, decision: "wait" };
      return;
    }

    if (decision.destination) {
      const target =
        decision.destination === "/home"
          ? safeReturnPath(new URLSearchParams(window.location.search).get("from"))
          : decision.destination;
      const navState =
        target === "/verify-email"
          ? { email: user?.email, userId: user?.uid, fromSignup: true }
          : undefined;
      navigate(target, { replace: true, state: navState });
      setShouldRender(false);
      lastDecision.current = { path: currentStateKey, decision: `redirect-${target}` };
      return;
    }

    setShouldRender(true);
    lastDecision.current = { path: currentStateKey, decision: "allow" };
  }, [
    location.pathname,
    isAuthenticated,
    isEmailVerified,
    needsOnboarding,
    profileResolved,
    authInitialized,
    authLoading,
    isSignupInProgress,
    needsEmailVerification,
    user,
    navigate,
  ]);

  if (!shouldRender) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-transparent">
        <div className="w-8 h-8 border-2 border-purple-500/20 border-t-purple-600 dark:border-purple-400/20 dark:border-t-purple-400 rounded-full animate-spin" />
      </div>
    );
  }

  return children;
}
