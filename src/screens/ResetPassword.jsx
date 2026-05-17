// src/screens/ResetPasswordScreen.jsx
import React, { useState, useEffect, useCallback } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { useAuth } from "../context/AuthContext.jsx";
import { useTheme } from "../context/ThemeContext.jsx";

const OfflineBanner = () => (
  <div className="w-full bg-amber-500/90 text-white text-center py-1.5 text-xs font-medium backdrop-blur-sm">
    You are offline – password reset requires internet.
  </div>
);

const PasswordInput = React.memo(({ value, onChange, error, disabled = false, label, onValidChange }) => {
  const { theme } = useTheme();
  const [showPassword, setShowPassword] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState(0);
  const resolvedTheme = theme === 'system'
    ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    : theme;

  useEffect(() => {
    if (!value) {
      setPasswordStrength(0);
      if (onValidChange) onValidChange(false);
      return;
    }
    let strength = 0;
    if (value.length >= 8) strength += 25;
    if (/[a-z]/.test(value)) strength += 25;
    if (/[A-Z]/.test(value)) strength += 25;
    if (/[0-9!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(value)) strength += 25;
    setPasswordStrength(strength);
    if (onValidChange) onValidChange(strength === 100);
  }, [value, onValidChange]);

  const getBarColor = () => {
    if (passwordStrength === 100) return 'bg-emerald-500';
    if (passwordStrength >= 75) return 'bg-green-500';
    if (passwordStrength >= 50) return 'bg-yellow-500';
    if (passwordStrength >= 25) return 'bg-orange-500';
    return 'bg-red-500';
  };

  const checklistItems = [
    { label: "At least 8 characters", met: value?.length >= 8 },
    { label: "Lowercase letter", met: /[a-z]/.test(value) },
    { label: "Uppercase letter", met: /[A-Z]/.test(value) },
    { label: "Number or symbol", met: /[0-9!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(value) },
  ];

  const darkBg = resolvedTheme === 'dark' ? 'bg-gray-900/80' : 'bg-white/90';
  const borderClass = error
    ? 'border-red-500 ring-1 ring-red-500/50'
    : 'border-gray-300 dark:border-gray-700 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30';

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className={`text-xs font-medium ${error ? 'text-red-500 dark:text-red-400' : 'text-gray-600 dark:text-gray-400'}`}>
          {label} <span className="text-red-500">*</span>
        </label>
      </div>
      <div className="relative">
        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        </div>
        <input
          type={showPassword ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className={`w-full pl-10 pr-10 py-3.5 rounded-xl border transition-all duration-200 text-sm ${darkBg} text-gray-900 dark:text-white placeholder-gray-500 ${borderClass} ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        />
        <button
          type="button"
          onClick={() => setShowPassword(!showPassword)}
          disabled={disabled}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
        >
          {showPassword ? (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L6.59 6.59m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
            </svg>
          ) : (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
          )}
        </button>
      </div>

      {value && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-500 dark:text-gray-400">Password strength</span>
            <span className={`text-xs font-medium ${
              passwordStrength === 100 ? 'text-emerald-600 dark:text-emerald-400' :
              passwordStrength >= 75 ? 'text-green-600 dark:text-green-400' :
              passwordStrength >= 50 ? 'text-yellow-600 dark:text-yellow-400' :
              passwordStrength >= 25 ? 'text-orange-600 dark:text-orange-400' : 'text-red-600 dark:text-red-400'
            }`}>
              {passwordStrength === 100 ? 'Strong' : passwordStrength >= 75 ? 'Medium' : passwordStrength >= 50 ? 'Weak' : 'Very weak'}
            </span>
          </div>
          <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <motion.div
              className={`h-full ${getBarColor()} rounded-full`}
              initial={{ width: 0 }}
              animate={{ width: `${passwordStrength}%` }}
              transition={{ duration: 0.5 }}
            />
          </div>
          <div className="grid grid-cols-2 gap-1">
            {checklistItems.map((item) => (
              <div key={item.label} className="flex items-center gap-1 text-[10px]">
                <span className={`w-3 h-3 rounded-full flex items-center justify-center ${
                  item.met ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/50 dark:text-emerald-400' : 'bg-gray-100 text-gray-400 dark:bg-gray-800 dark:text-gray-600'
                }`}>
                  {item.met ? '✓' : '·'}
                </span>
                <span className={item.met ? 'text-gray-700 dark:text-gray-300' : 'text-gray-500 dark:text-gray-500'}>
                  {item.label}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <AnimatePresence>
        {error && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
            <div className="flex items-center gap-2 p-2 rounded-lg bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800">
              <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-xs text-red-600 dark:text-red-300 font-medium">{error}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});

export default function ResetPasswordScreen() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { confirmPasswordReset } = useAuth();
  const { theme } = useTheme();

  const [actionCode, setActionCode] = useState(null);
  const [verifying, setVerifying] = useState(true);
  const [verificationError, setVerificationError] = useState(null);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [isPasswordValid, setIsPasswordValid] = useState(false);
  const [error, setError] = useState("");
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [shakeCard, setShakeCard] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);

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

  useEffect(() => {
    const code = searchParams.get('oobCode');
    const mode = searchParams.get('mode');
    if (!code || mode !== 'resetPassword') {
      setVerificationError("Invalid or missing reset link. Please request a new password reset.");
      setVerifying(false);
      return;
    }
    setActionCode(code);
    setVerifying(false);
  }, [searchParams]);

  const triggerShake = () => {
    setShakeCard(true);
    setTimeout(() => setShakeCard(false), 600);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading || !actionCode) return;

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match");
      toast.error("Passwords do not match");
      triggerShake();
      return;
    }
    if (!isPasswordValid) {
      setError("Password is too weak. Please meet all requirements.");
      toast.error("Password is too weak. Please meet all requirements.");
      triggerShake();
      return;
    }

    setLoading(true);
    setError("");
    try {
      const result = await confirmPasswordReset(actionCode, newPassword);
      if (result.success) {
        setResetSuccess(true);
        toast.success("Password reset successful! Redirecting to login...");
        setTimeout(() => {
          navigate("/login", { replace: true, state: { passwordResetSuccess: true } });
        }, 2000);
      } else {
        throw new Error(result.error || "Failed to reset password");
      }
    } catch (err) {
      console.error("Reset password error:", err);
      let errorMsg = err.message || "Failed to reset password";
      if (err.code === 'auth/expired-action-code') {
        errorMsg = "Reset link has expired. Please request a new one.";
      } else if (err.code === 'auth/invalid-action-code') {
        errorMsg = "Invalid reset link. Please request a new one.";
      } else if (err.code === 'auth/weak-password') {
        errorMsg = "Password is too weak. Please choose a stronger password.";
      } else if (err.code === 'auth/user-disabled') {
        errorMsg = "This account has been disabled.";
      }
      setError(errorMsg);
      toast.error(errorMsg);
      triggerShake();
    } finally {
      setLoading(false);
    }
  };

  if (verifying) {
    return (
      <div className={`min-h-screen flex items-center justify-center p-4 ${resolvedTheme === 'dark' ? 'bg-gray-950' : 'bg-gradient-to-br from-blue-50 to-white'}`}>
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">Verifying reset link...</p>
        </div>
      </div>
    );
  }

  if (verificationError) {
    return (
      <div className={`min-h-screen flex items-center justify-center p-4 ${resolvedTheme === 'dark' ? 'bg-gray-950' : 'bg-gradient-to-br from-blue-50 to-white'}`}>
        <div className={`max-w-md w-full rounded-3xl border backdrop-blur-2xl shadow-2xl p-8 ${resolvedTheme === 'dark' ? 'bg-gray-900/90 border-gray-800' : 'bg-white/90 border-gray-200/60'}`}>
          <div className="text-center">
            <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-red-500/20 flex items-center justify-center">
              <svg className="w-10 h-10 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h2 className={`text-xl font-bold mb-3 ${resolvedTheme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
              Invalid Reset Link
            </h2>
            <p className={`text-sm mb-6 ${resolvedTheme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
              {verificationError}
            </p>
            <Link
              to="/forgot-password"
              className="inline-block w-full py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-medium text-center"
            >
              Request New Reset Link
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (resetSuccess) {
    return (
      <div className={`min-h-screen flex items-center justify-center p-4 ${resolvedTheme === 'dark' ? 'bg-gray-950' : 'bg-gradient-to-br from-blue-50 to-white'}`}>
        <div className="text-center">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="w-20 h-20 mx-auto mb-6 rounded-full bg-emerald-500 flex items-center justify-center shadow-2xl"
          >
            <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </motion.div>
          <h2 className={`text-2xl font-bold mb-2 ${resolvedTheme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
            Password Reset Successful!
          </h2>
          <p className={`text-sm ${resolvedTheme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
            Redirecting you to login...
          </p>
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
              className={`rounded-3xl border backdrop-blur-2xl shadow-2xl p-8 ${resolvedTheme === 'dark' ? 'bg-gray-900/90 border-gray-800' : 'bg-white/90 border-gray-200/60'}`}
            >
              <div className="text-center mb-6">
                <motion.div
                  initial={{ scale: 0, rotate: -180 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: "spring", delay: 0.1 }}
                  className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-gradient-to-r from-green-500 to-teal-500 flex items-center justify-center shadow-lg"
                >
                  <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                  </svg>
                </motion.div>
                <h1 className={`text-2xl font-bold mb-2 ${resolvedTheme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                  Create New Password
                </h1>
                <p className={`text-sm ${resolvedTheme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                  Choose a strong password for your account.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                <PasswordInput
                  label="New Password"
                  value={newPassword}
                  onChange={setNewPassword}
                  error={error && !newPassword ? error : ""}
                  disabled={loading}
                  onValidChange={setIsPasswordValid}
                />

                <PasswordInput
                  label="Confirm Password"
                  value={confirmPassword}
                  onChange={setConfirmPassword}
                  error={(newPassword !== confirmPassword && confirmPassword) ? "Passwords do not match" : ""}
                  disabled={loading}
                />

                <motion.button
                  type="submit"
                  disabled={loading || !isPasswordValid || !newPassword || newPassword !== confirmPassword}
                  whileHover={!loading && isPasswordValid && newPassword === confirmPassword ? { scale: 1.02 } : {}}
                  whileTap={!loading && isPasswordValid && newPassword === confirmPassword ? { scale: 0.98 } : {}}
                  className={`w-full py-3.5 rounded-xl font-bold text-sm transition-all ${
                    !loading && isPasswordValid && newPassword === confirmPassword
                      ? 'bg-gradient-to-r from-green-600 to-teal-600 text-white shadow-lg hover:shadow-xl'
                      : resolvedTheme === 'dark' ? 'bg-gray-700 text-gray-400 cursor-not-allowed' : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  }`}
                >
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                      Resetting password...
                    </span>
                  ) : (
                    "Reset Password"
                  )}
                </motion.button>
              </form>

              <div className={`mt-6 pt-6 border-t ${resolvedTheme === 'dark' ? 'border-gray-800' : 'border-gray-200'}`}>
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

            <div className="mt-6 flex items-center justify-center gap-2 text-xs text-gray-500">
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