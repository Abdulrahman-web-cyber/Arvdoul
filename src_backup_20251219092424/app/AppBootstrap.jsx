// src/app/AppBootstrap.jsx
import React from "react";
import { Suspense } from "react";
import AppRoutes from "../routes/AppRoutes.jsx";
import FullScreenLoader from "../components/System/FullScreenLoader.jsx";
import FatalError from "../components/System/FatalError.jsx";
import GlobalErrorBoundary from "./GlobalErrorBoundary.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { useTheme } from "../context/ThemeContext.jsx";

/**
 * Arvdoul AppBootstrap
 *
 * Responsibilities:
 * - Waits for Firebase + Auth initialization (non-blocking UI)
 * - Shows friendly loader or fatal error screen
 * - Provides a single Suspense boundary for route loading
 * - Wraps app with GlobalErrorBoundary for deterministic error capture
 *
 * Important: AuthProvider & ThemeProvider must wrap this component (see main.jsx).
 */
export default function AppBootstrap() {
  const {
    // from AuthContext
    initialized,   // firebase initialized
    authReady,     // auth listener attached and first value received
    loadingMessage,
    error: authError
  } = useAuth();

  const { theme } = useTheme();

  // Fatal state if firebase/auth initialization completely failed
  if (authError) {
    return <FatalError title="Initialization error" error={authError} />;
  }

  // If core services not yet initialized or auth hasn't reported state, show loader
  if (!initialized || !authReady) {
    return (
      <div className={theme === "dark" ? "dark" : ""}>
        <FullScreenLoader message={loadingMessage || "Starting Arvdoul…"} />
      </div>
    );
  }

  // All core systems ready — render the app routes inside an error boundary + single Suspense
  return (
    <div className={theme === "dark" ? "dark" : ""}>
      <GlobalErrorBoundary>
        <Suspense fallback={<FullScreenLoader message="Loading interface…" />}>
          <AppRoutes />
        </Suspense>
      </GlobalErrorBoundary>
    </div>
  );
}