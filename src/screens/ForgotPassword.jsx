// src/screens/ForgotPasswordScreen.jsx – PRODUCTION READY
// ✅ Real Firebase email sending • Offline banner • Glass card • Shake on error

import React, { useState, useEffect, useCallback } from "react";
import { useNavigate, Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { useAuth } from "../context/AuthContext.jsx";
import { useTheme } from "../context/ThemeContext.jsx";

const OfflineBanner = () => (
  <div className="w-full bg-amber-500/90 text-white text-center py-1.5 text-xs font-medium backdrop-blur-sm">
    You are offline – some features may be limited.
  </div>
);

const EmailInput = React.memo(({ value, onChange, error, disabled = false, onValidationChange = () => {} }) => {
  const { theme } = useTheme();
  const [isFocused, setIsFocused] = useState(false);
  const resolvedTheme = theme === 'system'
    ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    : theme;

  const validateEmail = useCallback((email) => {
    if (!email) return false;
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }, []);

  useEffect(() => {
    onValidationChange(validateEmail(value));
  }, [value, validateEmail, onValidationChange]);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className={`text-xs font-medium ${
          error ? 'text-red-600 dark:text-red-400'
          : isFocused || value ? 'text-indigo-600 dark:text-indigo-400'
          : resolvedTheme === 'dark' ? 'text-gray-400' : 'text-gray-600'
        }`}>
          Email Address <span className="text-red-500">*</span>
        </label>
      </div>
      <div className="relative">
        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        </div>
        <input
          type="email"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          disabled={disabled}
          placeholder="you@example.com"
          className={`w-full pl-10 pr-10 py-3.5 rounded-xl border transition-all duration-200 text-sm ${
            error
              ? 'border-red-500 dark:border-red-400 bg-red-50 dark:bg-red-900/10'
              : isFocused
              ? 'border-indigo-500 ring-2 ring-indigo-500/20'
              : resolvedTheme === 'dark'
              ? 'border-gray-700 bg-gray-800/50 hover:border-gray-600'
              : 'border-gray-300 bg-white hover:border-gray-400'
          } ${resolvedTheme === 'dark' ? 'text-white placeholder-gray-500' : 'text-gray-900 placeholder-gray-400'} ${
            disabled ? 'opacity-50 cursor-not-allowed' : ''
          }`}
          autoFocus
        />
        {value && !error && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center"
            >
              <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            </motion.div>
          </div>
        )}
      </div>
      <AnimatePresence>
        {error && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
            <div className="flex items-center gap-2 p-2 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50">
              <svg className="w-4 h-4 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <span className="text-xs text-red-600 dark:text-red-400 font-medium">{error}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});

const SuccessCard = React.memo(({ email, onBack }) => {
  const { theme } = useTheme();
  const resolvedTheme = theme === 'system'
    ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    : theme;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="text-center"
    >
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: "spring", delay: 0.1 }}
        className="w-24 h-24 mx-auto mb-6 rounded-3xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center shadow-2xl"
      >
        <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
      </motion.div>
      <h2 className={`text-2xl font-bold mb-3 ${resolvedTheme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
        Check your inbox
      </h2>
      <p className={`text-sm mb-2 ${resolvedTheme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
        We've sent a password reset link to
      </p>
      <p className={`text-base font-semibold mb-6 ${resolvedTheme === 'dark' ? 'text-gray-200' : 'text-gray-800'}`}>
        {email}
      </p>
      <p className={`text-xs mb-8 ${resolvedTheme === 'dark' ? 'text-gray-500' : 'text-gray-500'}`}>
        Didn't receive the email? Check your spam folder or <button onClick={onBack} className="text-indigo-600 dark:text-indigo-400 hover:underline">try again</button>.
      </p>
      <button
        onClick={onBack}
        className={`w-full py-3 rounded-xl font-medium text-sm transition-all ${
          resolvedTheme === 'dark'
            ? 'bg-gray-800 text-gray-300 hover:bg-gray-700'
            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
        }`}
      >
        Back to Login
      </button>
    </motion.div>
  );
});

export default function ForgotPasswordScreen() {
  const navigate = useNavigate();
  const { sendPasswordResetEmail } = useAuth();
  const { theme } = useTheme();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [isEmailValid, setIsEmailValid] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [shakeCard, setShakeCard] = useState(false);

  const resolvedTheme = theme === 'system'
    ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    : theme;

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const triggerShake = () => {
    setShakeCard(true);
    setTimeout(() => setShakeCard(false), 600);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading || !isEmailValid) return;

    setLoading(true);
    setError("");
    try {
      // ✅ Real Firebase password reset email
      const result = await sendPasswordResetEmail(email);
      if (result.success) {
        setIsSubmitted(true);
        toast.success("Password reset email sent! Check your inbox.");
      } else {
        throw new Error(result.error || "Failed to send reset email");
      }
    } catch (err) {
      console.error("Forgot password error:", err);
      let errorMsg = err.message || "Failed to send reset email";
      if (err.code === 'auth/user-not-found') {
        errorMsg = "No account found with this email address.";
      } else if (err.code === 'auth/too-many-requests') {
        errorMsg = "Too many requests. Please try again later.";
      } else if (err.code === 'auth/invalid-email') {
        errorMsg = "Invalid email address.";
      }
      setError(errorMsg);
      toast.error(errorMsg);
      triggerShake();
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    setIsSubmitted(false);
    setEmail("");
    setError("");
  };

  if (isSubmitted) {
    return (
      <div className={`h-[100dvh] flex flex-col ${resolvedTheme === 'dark' ? 'bg-gray-950' : 'bg-gradient-to-br from-blue-50 to-white'}`}>
        {isOffline && <OfflineBanner />}
        <div className="flex-1 flex items-center justify-center p-4 overflow-hidden">
          <div className="w-full max-w-md mx-auto">
            <motion.div
              animate={shakeCard ? { x: [0, -10, 10, -10, 10, 0] } : {}}
              transition={{ duration: 0.5 }}
              className={`rounded-3xl border backdrop-blur-2xl shadow-2xl p-8 ${
                resolvedTheme === 'dark'
                  ? 'bg-gray-900/70 border-white/10 shadow-indigo-900/20'
                  : 'bg-white/70 border-gray-200/60 shadow-indigo-100/20'
              }`}
            >
              <SuccessCard email={email} onBack={handleBack} />
            </motion.div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`h-[100dvh] flex flex-col ${resolvedTheme === 'dark' ? 'bg-gray-950' : 'bg-gradient-to-br from-blue-50 to-white'}`}>
      {isOffline && <OfflineBanner />}
      <div className="flex-1 flex items-center justify-center p-4 overflow-hidden">
        <div className="w-full max-w-md mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="w-full"
          >
            <motion.div
              animate={shakeCard ? { x: [0, -10, 10, -10, 10, 0] } : {}}
              transition={{ duration: 0.5 }}
              className={`rounded-3xl border backdrop-blur-2xl shadow-2xl p-8 ${
                resolvedTheme === 'dark'
                  ? 'bg-gray-900/70 border-white/10 shadow-indigo-900/20'
                  : 'bg-white/70 border-gray-200/60 shadow-indigo-100/20'
              }`}
            >
              <div className="text-center mb-8">
                <motion.div
                  initial={{ scale: 0, rotate: -180 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: "spring", delay: 0.1 }}
                  className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-gradient-to-r from-red-500 to-orange-500 flex items-center justify-center shadow-lg"
                >
                  <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </motion.div>
                <h1 className={`text-2xl font-bold mb-2 ${resolvedTheme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                  Reset Password
                </h1>
                <p className={`text-sm ${resolvedTheme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                  Enter your email address and we'll send you a link to reset your password.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                <EmailInput
                  value={email}
                  onChange={setEmail}
                  error={error}
                  disabled={loading}
                  onValidationChange={setIsEmailValid}
                />

                <motion.button
                  type="submit"
                  disabled={loading || !isEmailValid}
                  whileHover={!loading && isEmailValid ? { scale: 1.02 } : {}}
                  whileTap={!loading && isEmailValid ? { scale: 0.98 } : {}}
                  className={`w-full py-3.5 rounded-xl font-bold text-sm transition-all ${
                    !loading && isEmailValid
                      ? 'bg-gradient-to-r from-red-600 to-orange-600 text-white shadow-lg hover:shadow-xl'
                      : resolvedTheme === 'dark'
                      ? 'bg-gray-800 text-gray-400 cursor-not-allowed'
                      : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  }`}
                >
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                      Sending reset link...
                    </span>
                  ) : (
                    "Send Reset Link"
                  )}
                </motion.button>
              </form>

              <div className={`mt-6 pt-6 border-t ${resolvedTheme === 'dark' ? 'border-white/10' : 'border-gray-200'}`}>
                <Link
                  to="/login"
                  className="w-full flex items-center justify-center gap-2 text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                  </svg>
                  Back to Login
                </Link>
              </div>
            </motion.div>

            <div className="mt-6 flex items-center justify-center gap-2 text-xs text-gray-500 dark:text-gray-600">
              <span>🔒</span>
              <span>End-to-end encrypted</span>
              <span>•</span>
              <span>🛡️</span>
              <span>Military-grade security</span>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}