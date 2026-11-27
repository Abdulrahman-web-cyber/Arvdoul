// src/app/AppStateGuard.jsx

import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import {
  resolvePostAuthDestination,
  safeReturnPath,
} from "../utils/profileCompletion.js";
import { RouteProgressBar } from "../components/Navigation/RouteProgressBar.jsx";

import { useTheme } from "../context/ThemeContext.jsx";
import BrandBootCanvas from "../components/Shared/BrandBootCanvas.jsx";

export default function AppStateGuard({ children }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { isDark } = useTheme();
  const {
    user,
    loading: authLoading,
    isAuthenticated,
    authInitialized,
    profileResolved,
    needsOnboarding,
  } = useAuth();
  const [stalledWait, setStalledWait] = useState(false);

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
    if (!decision.wait || location.pathname === "/") {
      setStalledWait(false);
      return undefined;
    }
    const timer = setTimeout(() => setStalledWait(true), 5500);
    return () => clearTimeout(timer);
  }, [decision.wait, location.pathname]);

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
      <BrandBootCanvas isDark={isDark} label="Preparing screen">
        <RouteProgressBar isAnimating={true} />
        {stalledWait && (
          <div className="fixed bottom-10 inset-x-0 z-20 flex flex-col items-center gap-3 px-6 text-center">
            <p className="text-xs font-medium opacity-75">
              Restoring session is taking longer than expected.
            </p>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="min-h-[44px] px-5 rounded-full text-xs font-semibold bg-white/15 hover:bg-white/25 dark:bg-white/10 border border-black/10 dark:border-white/15 transition-colors"
              >
                Reload
              </button>
              <button
                type="button"
                onClick={() => navigate("/intro", { replace: true })}
                className="min-h-[44px] px-5 rounded-full text-xs font-semibold bg-black/5 hover:bg-black/10 dark:bg-white/5 dark:hover:bg-white/10 transition-colors"
              >
                Open Intro
              </button>
            </div>
          </div>
        )}
      </BrandBootCanvas>
    );
  }

  if (decision.destination && !decision.wait) {
    return (
      <BrandBootCanvas isDark={isDark} label="Navigating">
        <RouteProgressBar isAnimating={true} />
      </BrandBootCanvas>
    );
  }

  return children;
}
