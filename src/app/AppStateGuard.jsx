// src/app/AppStateGuard.jsx

import { useEffect, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import {
  resolvePostAuthDestination,
  safeReturnPath,
} from "../utils/profileCompletion.js";
import { RouteProgressBar } from "../components/Navigation/RouteProgressBar.jsx";

import { useTheme } from "../context/ThemeContext.jsx";
import { tokens } from "../design-system/tokens.js";

export default function AppStateGuard({ children }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { isDark } = useTheme();
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

  // Never render mismatched children beneath a guard transition: painting
  // unauthenticated (/intro) or wrong-state children before replace navigation
  // causes a visible frame blink across cold starts and route switches.
  if (decision.wait) {
    if (location.pathname === "/") {
      return children;
    }
    return (
      <div
        className="min-h-[100dvh] w-full"
        style={{ backgroundColor: isDark ? tokens.color.bg.dark : tokens.color.bg.light }}
        aria-busy="true"
        aria-label="Preparing screen"
      >
        <RouteProgressBar isAnimating={true} />
      </div>
    );
  }

  if (decision.destination && !decision.wait) {
    return (
      <div
        className="min-h-[100dvh] w-full"
        style={{ backgroundColor: isDark ? tokens.color.bg.dark : tokens.color.bg.light }}
        aria-busy="true"
        aria-label="Navigating"
      >
        <RouteProgressBar isAnimating={true} />
      </div>
    );
  }

  return children;
}
