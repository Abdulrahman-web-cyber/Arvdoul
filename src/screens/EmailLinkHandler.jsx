// src/screens/EmailLinkHandler.jsx
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { isSignInWithEmailLink, signInWithEmailLink } from "firebase/auth";
import { auth } from '../firebase/compat.js';
import LoadingSpinner from "@components/Shared/LoadingSpinner";
import { useTheme } from "@context/ThemeContext";
import { toast } from "sonner";

// Routes
const SET_PASSWORD_ROUTE = "/set-password";
const LOGIN_ROUTE = "/login";

export default function EmailLinkHandler() {
  const navigate = useNavigate();
  const { theme } = useTheme();

  const [status, setStatus] = useState("Verifying email link…");
  const [loading, setLoading] = useState(true);

  // Fallback email entry flow (if localStorage is missing)
  const [needEmail, setNeedEmail] = useState(false);
  const [emailInput, setEmailInput] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [showRetry, setShowRetry] = useState(false);

  const isMounted = useRef(true);
  const didRunRef = useRef(false); // avoid double-run in strict mode

  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);

  // Kick off verification on mount
  useEffect(() => {
    if (didRunRef.current) return;
    didRunRef.current = true;

    const run = async () => {
      try {
        // Validate the link format early
        const link = window.location.href;
        if (!isSignInWithEmailLink(auth, link)) {
          fail("Invalid or expired email link.");
          return;
        }

        // Try same-device flow first
        const storedEmail = window.localStorage.getItem("emailForSignIn");
        if (storedEmail) {
          await completeSignIn(storedEmail, link);
          return;
        }

        // No stored email (cross-device or cleared storage) → ask the user
        setNeedEmail(true);
        setStatus("Enter your email to continue.");
        setLoading(false);
      } catch (err) {
        console.error("Email link init error:", err);
        fail("Failed to verify the email link.");
      }
    };

    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const completeSignIn = async (email, link) => {
    if (submitting) return;
    setSubmitting(true);

    try {
      await signInWithEmailLink(auth, email, link);
      window.localStorage.removeItem("emailForSignIn");

      if (!isMounted.current) return;

      const successMsg = "Email verified! Redirecting…";
      setStatus(successMsg);
      toast.success(successMsg, themedToast(theme));

      // You can add any post-sign-in logic here (e.g., check profile completeness)
      setTimeout(() => navigate(SET_PASSWORD_ROUTE, { replace: true }), 1000);
    } catch (error) {
      console.error("Email link sign-in error:", error?.code, error?.message);
      if (!isMounted.current) return;

      const msg =
        error?.code === "auth/invalid-action-code"
          ? "Invalid or expired email link."
          : error?.code === "auth/invalid-email"
            ? "That email address looks invalid."
            : "Could not complete sign-in. Please try again.";

      setStatus(msg);
      toast.error(msg, themedToast(theme));
      setShowRetry(true);
      setLoading(false);
      setSubmitting(false);
    }
  };

  const themedToast = (themeMode) => ({
    style: {
      background: themeMode === "dark" ? "#18181b" : "#fff",
      color: themeMode === "dark" ? "#fff" : "#18181b",
    },
  });

  const fail = (msg) => {
    if (!isMounted.current) return;
    setStatus(msg);
    toast.error(msg, themedToast(theme));
    setShowRetry(true);
    setLoading(false);
  };

  const onSubmitEmail = async (e) => {
    e.preventDefault();
    if (!emailInput.trim()) {
      toast.error("Please enter your email.", themedToast(theme));
      return;
    }
    setLoading(true);
    setNeedEmail(false);
    await completeSignIn(emailInput.trim(), window.location.href);
  };

  return (
    <div
      className={`min-h-screen flex flex-col items-center justify-center p-6 text-center transition-colors duration-300 ${
        theme === "dark" ? "bg-gray-950 text-white" : "bg-gray-50 text-gray-900"
      }`}
    >
      {/* Loading / primary status */}
      {(loading || submitting) && !needEmail ? (
        <>
          <LoadingSpinner size={48} aria-label="Loading verification" />
          <p
            role="status"
            className="mt-4 text-lg font-medium"
            aria-live="polite"
            aria-atomic="true"
          >
            {status}
          </p>
        </>
      ) : null}

      {/* Email fallback form */}
      {!loading && needEmail ? (
        <div className="w-full max-w-md bg-white dark:bg-gray-900 rounded-2xl shadow-xl p-6">
          <h1 className="text-2xl font-bold mb-2">Confirm your email</h1>
          <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
            We couldn’t find your email from this device. Please enter the same
            email that requested the sign-in link.
          </p>
          <form onSubmit={onSubmitEmail} className="space-y-4">
            <div className="text-left">
              <label
                htmlFor="email"
                className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300"
              >
                Email address
              </label>
              <input
                id="email"
                type="email"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="you@example.com"
                autoFocus
                autoComplete="email"
                aria-required="true"
              />
            </div>
            <button
              type="submit"
              disabled={submitting}
              className={`w-full py-3 rounded-xl font-semibold transition focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                theme === "dark"
                  ? "bg-primary-600 hover:bg-primary-500 text-white focus:ring-primary-500 focus:ring-offset-gray-900"
                  : "bg-primary-500 hover:bg-primary-600 text-white focus:ring-primary-600 focus:ring-offset-white"
              } disabled:opacity-60 disabled:cursor-not-allowed`}
            >
              {submitting ? <LoadingSpinner size={20} /> : "Continue"}
            </button>
          </form>

          <button
            onClick={() => navigate(LOGIN_ROUTE)}
            className="mt-4 w-full text-sm text-gray-600 dark:text-gray-300 hover:underline"
          >
            Cancel and go back to Login
          </button>
        </div>
      ) : null}

      {/* Failure / retry state */}
      {!loading && !needEmail && showRetry ? (
        <>
          <p
            role="status"
            className="text-lg font-medium mb-6"
            aria-live="polite"
            aria-atomic="true"
          >
            {status}
          </p>
          <button
            onClick={() => navigate(LOGIN_ROUTE)}
            className={`px-6 py-3 rounded-xl font-semibold transition focus:outline-none focus:ring-2 focus:ring-offset-2 ${
              theme === "dark"
                ? "bg-primary-600 hover:bg-primary-500 text-white focus:ring-primary-500 focus:ring-offset-gray-900"
                : "bg-primary-500 hover:bg-primary-600 text-white focus:ring-primary-600 focus:ring-offset-white"
            }`}
            aria-label="Go to login page"
          >
            Retry / Go to Login
          </button>
        </>
      ) : null}
    </div>
  );
}
