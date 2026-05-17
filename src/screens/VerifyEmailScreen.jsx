// src/screens/VerifyEmailScreen.jsx – ARVDOUL SUPREMACY • FIXED VERIFICATION DETECTION
// ✅ Waits for auth • Reads URL parameters • Immediate redirect on verified
// 🔐 Perfect navigation to SetupProfile • No stale closures

import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { useAuth } from "@context/AuthContext";
import { useTheme } from "@context/ThemeContext";
import {
  RefreshCw, CheckCircle2, AlertCircle, ArrowRight,
  Shield, X, Lock, UserCheck, Send
} from "lucide-react";

// ==================== CUSTOM CONFETTI (ZERO DEPENDENCIES) ====================
const ConfettiBurst = ({ isActive }) => {
  if (!isActive) return null;
  const colors = ["#6366f1", "#8b5cf6", "#a855f7", "#10b981", "#f59e0b", "#ef4444", "#3b82f6"];
  const particles = useMemo(() => Array.from({ length: 60 }, (_, i) => {
    const size = Math.random() * 8 + 4;
    const angle = Math.random() * 360;
    const velocity = Math.random() * 4 + 2;
    const rad = angle * (Math.PI / 180);
    return {
      id: i,
      size,
      color: colors[Math.floor(Math.random() * colors.length)],
      destX: 50 + Math.cos(rad) * 80 * velocity,
      destY: 50 + Math.sin(rad) * 80 * velocity,
      duration: Math.random() * 1.5 + 1,
      delay: Math.random() * 0.5,
      shape: Math.random() > 0.5 ? "circle" : "rect",
      rotation: Math.random() * 360,
    };
  }), []);
  return (
    <div className="absolute inset-0 pointer-events-none z-50 overflow-hidden">
      {particles.map(p => (
        <motion.div
          key={p.id}
          className="absolute"
          style={{
            width: p.size, height: p.size, backgroundColor: p.color,
            borderRadius: p.shape === "circle" ? "50%" : "2px",
            left: "50%", top: "50%",
          }}
          initial={{ opacity: 1, x: 0, y: 0, rotate: 0 }}
          animate={{ opacity: 0, x: p.destX - 50, y: p.destY - 50, rotate: p.rotation }}
          transition={{ duration: p.duration, delay: p.delay, ease: "easeOut" }}
        />
      ))}
    </div>
  );
};

// ==================== ANIMATED VERIFICATION SHIELD ====================
const VerificationShield = ({ status }) => {
  const isChecking = status === "checking" || status === "sending";
  const isVerified = status === "verified";

  return (
    <div className="relative w-20 h-20 sm:w-24 sm:h-24 mx-auto">
      <motion.div
        className="absolute inset-0 rounded-full border-2 border-indigo-400/60"
        animate={isChecking ? { rotate: 360, scale: [1, 1.15, 1], opacity: [0.6, 0.2, 0.6] } : { scale: 1, opacity: 0.5 }}
        transition={isChecking ? { rotate: { duration: 2, repeat: Infinity, ease: "linear" }, scale: { duration: 1.5, repeat: Infinity } } : {}}
      />
      <motion.div
        className={`absolute inset-2 rounded-full flex items-center justify-center backdrop-blur-sm border-2 ${
          isVerified ? "border-emerald-400 bg-emerald-500/10" :
          status === "error" ? "border-red-400 bg-red-500/10" :
          "border-indigo-400 bg-indigo-500/10"
        }`}
        animate={isChecking ? { scale: [1, 1.05, 1] } : {}}
        transition={{ duration: 1.5, repeat: Infinity }}
      >
        {isVerified ? (
          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 300 }}>
            <CheckCircle2 className="text-emerald-400" size={28} />
          </motion.div>
        ) : status === "error" ? (
          <AlertCircle className="text-red-400" size={28} />
        ) : (
          <motion.div
            animate={isChecking ? { rotate: [0, 180, 360] } : {}}
            transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
          >
            <Shield className="text-indigo-400" size={28} />
          </motion.div>
        )}
      </motion.div>
      <div className={`absolute inset-0 rounded-full blur-xl ${
        isVerified ? "bg-emerald-500/20" : status === "error" ? "bg-red-500/20" : "bg-indigo-500/20"
      }`} />
    </div>
  );
};

// ==================== VERIFICATION STEPS ====================
const VerificationSteps = ({ steps, isDark }) => (
  <div className="space-y-1.5">
    {steps.map((step, index) => (
      <motion.div
        key={step.key}
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.2 + index * 0.1 }}
        className={`flex items-center gap-2 p-2 rounded-lg border transition-all ${
          step.completed
            ? isDark ? "bg-green-900/20 border-green-500/30" : "bg-green-50 border-green-200"
            : isDark ? "bg-gray-800/30 border-gray-700" : "bg-gray-50 border-gray-200"
        }`}
      >
        <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs ${
          step.completed ? "bg-green-500 text-white" : isDark ? "bg-gray-700 text-gray-400" : "bg-gray-200 text-gray-500"
        }`}>
          {step.completed ? (
            <motion.svg width="14" height="14" viewBox="0 0 20 20" initial="hidden" animate="visible">
              <motion.path
                d="M5 10 l4 4 6 -8" stroke="white" strokeWidth="2" fill="none"
                strokeLinecap="round" strokeLinejoin="round"
                variants={{ hidden: { pathLength: 0 }, visible: { pathLength: 1 } }}
                transition={{ duration: 0.3 }}
              />
            </motion.svg>
          ) : (
            <span className="text-xs font-semibold">{index + 1}</span>
          )}
        </div>
        <span className={`text-xs sm:text-sm font-medium ${
          step.completed ? isDark ? "text-green-400" : "text-green-700" : isDark ? "text-gray-400" : "text-gray-600"
        }`}>
          {step.label}
        </span>
      </motion.div>
    ))}
  </div>
);

// ==================== CIRCULAR PROGRESS RING ====================
const CircularProgressRing = ({ progress, size = 52, strokeWidth = 4, isDark, children }) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (progress / 100) * circumference;
  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width={size} height={size} className="transform -rotate-90">
        <circle stroke={isDark ? "#374151" : "#e5e7eb"} strokeWidth={strokeWidth} fill="transparent"
          r={radius} cx={size / 2} cy={size / 2} />
        <motion.circle stroke="url(#ringGradient)" strokeWidth={strokeWidth} fill="transparent"
          r={radius} cx={size / 2} cy={size / 2} strokeLinecap="round"
          strokeDasharray={circumference} strokeDashoffset={offset}
          animate={{ strokeDashoffset: offset }} transition={{ duration: 0.8, ease: "easeInOut" }} />
        <defs>
          <linearGradient id="ringGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#6366f1" />
            <stop offset="50%" stopColor="#8b5cf6" />
            <stop offset="100%" stopColor="#a855f7" />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">{children}</div>
    </div>
  );
};

// ==================== MAIN COMPONENT (FIXED) ====================
export default function EmailVerification() {
  const navigate = useNavigate();
  const location = useLocation();
  const { theme } = useTheme();
  const resolvedTheme = theme === "system"
    ? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")
    : theme;
  const isDark = resolvedTheme === "dark";

  const { user, checkEmailVerification, resendEmailVerification, signOut, authInitialized, loading: authLoading } = useAuth();

  const [verificationStatus, setVerificationStatus] = useState("sent");
  const [resendCooldown, setResendCooldown] = useState(60);
  const [canResend, setCanResend] = useState(false);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [userId, setUserId] = useState("");
  const [showConfetti, setShowConfetti] = useState(false);

  const intervalRef = useRef(null);
  const isMounted = useRef(true);
  const checkVerificationRef = useRef();

  // ==================== PARSE URL QUERY PARAMETERS ====================
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const urlUserId = params.get("userId");
    const urlEmail = params.get("email");
    if (urlUserId && !userId) setUserId(urlUserId);
    if (urlEmail && !email) setEmail(urlEmail);
  }, [location.search, userId, email]);

  // ==================== WAIT FOR AUTH AND START CHECKS ====================
  useEffect(() => {
    // Wait until auth is fully initialized and user is available
    if (!authInitialized || authLoading) return;

    // If user is already verified, navigate immediately
    if (user?.emailVerified) {
      triggerSuccess();
      return;
    }

    // Set email and userId from user if not already set
    if (user?.email && !email) setEmail(user.email);
    if (user?.uid && !userId) setUserId(user.uid);

    // If we still don't have userId, show an error
    if (!userId && !user?.uid) {
      setVerificationStatus("error");
      toast.error("No user information found. Please sign up again.");
      return;
    }

    // Start the verification check
    const performCheck = async () => {
      if (checkVerificationRef.current) {
        await checkVerificationRef.current();
      } else {
        // First check immediately
        const verified = await checkVerification();
        if (verified && isMounted.current) triggerSuccess();
      }
    };
    performCheck();

    // Set up periodic check every 3 seconds
    intervalRef.current = setInterval(() => {
      if (isMounted.current && checkVerificationRef.current) {
        checkVerificationRef.current();
      }
    }, 3000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [authInitialized, authLoading, user]); // eslint-disable-line

  // ==================== VERIFICATION LOGIC (USES LATEST CHECK FUNCTION) ====================
  const checkVerification = useCallback(async () => {
    if (!userId && !user?.uid) {
      setVerificationStatus("error");
      return false;
    }
    const uidToCheck = userId || user?.uid;
    if (!uidToCheck) return false;

    setVerificationStatus(prev => {
      if (prev === "verified") return prev;
      if (prev === "sending") return prev;
      return "checking";
    });

    try {
      const result = await checkEmailVerification(uidToCheck);
      if (!isMounted.current) return false;

      if (result.verified) {
        if (intervalRef.current) clearInterval(intervalRef.current);
        setVerificationStatus("verified");
        triggerSuccess();
        return true;
      } else {
        setVerificationStatus(prev => prev === "verified" ? "verified" : "sent");
        return false;
      }
    } catch (error) {
      if (isMounted.current) {
        setVerificationStatus(prev => prev === "verified" ? "verified" : "error");
      }
      return false;
    }
  }, [userId, user, checkEmailVerification]);

  // Keep ref updated
  useEffect(() => {
    checkVerificationRef.current = checkVerification;
  }, [checkVerification]);

  const triggerSuccess = useCallback(() => {
    if (typeof navigator !== "undefined" && navigator.deviceMemory >= 4) setShowConfetti(true);
    toast.success("Email verified! Redirecting…");
    setTimeout(() => {
      navigate("/setup-profile", {
        state: { email, userId, method: "email", isNewUser: true },
        replace: true,
      });
    }, 1500);
  }, [email, userId, navigate]);

  // ==================== RESEND EMAIL ====================
  const handleResendEmail = async () => {
    if (!canResend || loading) return;
    setLoading(true);
    setVerificationStatus("sending");
    try {
      await resendEmailVerification(userId || user?.uid);
      setVerificationStatus("sent");
      setResendCooldown(60);
      setCanResend(false);
      toast.success("Verification email resent!");
    } catch (err) {
      setVerificationStatus("error");
      const msg = err.code === "auth/too-many-requests"
        ? "Too many attempts. Please wait 5 minutes."
        : err.message || "Failed to resend";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  // ==================== MANUAL CHECK BUTTON ====================
  const handleManualCheck = async () => {
    if (verificationStatus === "verified") {
      triggerSuccess();
      return;
    }
    setLoading(true);
    const verified = await checkVerification();
    setLoading(false);
    if (!verified) {
      toast.info("Email not verified yet. Check your inbox.");
    }
  };

  // ==================== CHANGE EMAIL (CANCEL SIGNUP) ====================
  const handleChangeEmail = async () => {
    if (!window.confirm("Use a different email? This will cancel your current signup.")) return;
    setLoading(true);
    try {
      if (userId || user?.uid) {
        const { getAuth, deleteUser } = await import("firebase/auth");
        const currentUser = getAuth().currentUser;
        if (currentUser) {
          await signOut();
          await deleteUser(currentUser).catch(() => {});
        }
      }
      sessionStorage.clear();
      toast.info("Please sign up again with your new email.");
      navigate("/signup/step2", { replace: true });
    } catch (err) {
      toast.error("Could not change email. Try again.");
    } finally {
      setLoading(false);
    }
  };

  // ==================== COUNTDOWN ====================
  useEffect(() => {
    if (resendCooldown <= 0) { setCanResend(true); return; }
    const timer = setTimeout(() => setResendCooldown(prev => prev - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  // ==================== DERIVED STEPS ====================
  const steps = useMemo(() => [
    { key: "emailValid", label: "Email Validated", completed: !!email },
    { key: "emailSent", label: "Email Sent", completed: verificationStatus !== "sending" && verificationStatus !== "error" },
    { key: "linkClicked", label: "Link Clicked", completed: verificationStatus === "checking" || verificationStatus === "verified" },
    { key: "verified", label: "Verified", completed: verificationStatus === "verified" }
  ], [email, verificationStatus]);

  const resendProgress = (resendCooldown / 60) * 100;

  // ==================== RENDER ====================
  return (
    <div className={`h-[100dvh] flex flex-col overflow-hidden ${isDark ? "bg-gray-950" : "bg-gradient-to-br from-blue-50 to-white"}`}>
      <ConfettiBurst isActive={showConfetti} />

      <div className="flex-1 flex items-center justify-center p-3 sm:p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.4, type: "spring", bounce: 0.2 }}
          className={`relative w-full max-w-lg xl:max-w-xl rounded-3xl border backdrop-blur-xl shadow-2xl ${
            isDark ? "bg-gray-900/85 border-white/10" : "bg-white/85 border-gray-200/60"
          } overflow-hidden flex flex-col`}
          style={{ maxHeight: "calc(100dvh - 2rem)" }}
        >
          <div className="p-5 sm:p-7 flex flex-col h-full">
            {/* HEADER */}
            <div className="flex-shrink-0 text-center mb-4">
              <VerificationShield status={verificationStatus} />
              <h1 className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-indigo-400 to-purple-400 dark:from-indigo-300 dark:to-purple-300 bg-clip-text text-transparent mt-2">
                Verify Your Email
              </h1>
              <p className="text-xs sm:text-sm mt-1 text-gray-500 dark:text-gray-400 break-all">
                We sent a link to <span className="font-semibold text-gray-700 dark:text-gray-200">{email || (user?.email) || "your email"}</span>
              </p>
            </div>

            {/* STEPS + STATUS */}
            <div className="flex-1 min-h-0 flex flex-col justify-between space-y-3">
              <div className="space-y-3">
                <VerificationSteps steps={steps} isDark={isDark} />
                <AnimatePresence mode="wait">
                  <motion.div
                    key={verificationStatus}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    className={`flex items-center justify-center gap-1.5 text-sm font-medium ${
                      verificationStatus === "verified" ? "text-green-600 dark:text-green-400" :
                      verificationStatus === "error" ? "text-red-500" : "text-indigo-500"
                    }`}
                  >
                    {verificationStatus === "verified" ? (
                      <><CheckCircle2 size={16} /> Verified</>
                    ) : verificationStatus === "checking" ? (
                      <><RefreshCw size={14} className="animate-spin" /> Checking...</>
                    ) : verificationStatus === "sending" ? (
                      <><RefreshCw size={14} className="animate-spin" /> Resending...</>
                    ) : (
                      <><Shield size={14} /> Check your inbox</>
                    )}
                  </motion.div>
                </AnimatePresence>
              </div>

              {/* ACTIONS */}
              <div className="space-y-3 flex-shrink-0 pt-1">
                <button
                  onClick={handleManualCheck}
                  disabled={loading}
                  className={`w-full py-2.5 sm:py-3 px-4 rounded-xl font-medium text-sm flex items-center justify-center gap-2 transition-all ${
                    loading
                      ? "bg-gray-200 dark:bg-gray-800 text-gray-400 cursor-not-allowed"
                      : "bg-gradient-to-r from-indigo-600 to-purple-600 text-white hover:shadow-lg hover:shadow-indigo-500/25"
                  }`}
                >
                  {loading ? <RefreshCw className="animate-spin" size={16} /> : verificationStatus === "verified" ? <ArrowRight size={16} /> : <CheckCircle2 size={16} />}
                  <span>{loading ? "Checking..." : "I've verified, continue"}</span>
                </button>

                {verificationStatus !== "verified" && (
                  <div className="flex items-center justify-center gap-3">
                    <CircularProgressRing progress={resendProgress} size={48} strokeWidth={4} isDark={isDark}>
                      <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400">{resendCooldown}s</span>
                    </CircularProgressRing>
                    <button
                      onClick={handleResendEmail}
                      disabled={!canResend || loading}
                      className={`flex-1 py-2.5 sm:py-3 px-4 rounded-xl font-medium text-sm flex items-center justify-center gap-2 transition-all ${
                        !canResend || loading
                          ? "bg-gray-200 dark:bg-gray-800 text-gray-400 cursor-not-allowed"
                          : "bg-gradient-to-r from-fuchsia-500 to-pink-500 text-white hover:shadow-lg"
                      }`}
                    >
                      <Send size={15} />
                      <span>Resend</span>
                    </button>
                  </div>
                )}

                <button
                  onClick={handleChangeEmail}
                  disabled={loading}
                  className={`w-full py-2.5 sm:py-3 px-4 rounded-xl font-medium text-sm flex items-center justify-center gap-2 border transition-all ${
                    loading
                      ? "border-gray-300 dark:border-gray-700 text-gray-400 cursor-not-allowed"
                      : "border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
                  }`}
                >
                  <X size={15} />
                  <span>Use different email</span>
                </button>

                {verificationStatus === "verified" && (
                  <motion.button
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    onClick={triggerSuccess}
                    className="w-full py-2.5 sm:py-3 px-4 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 bg-gradient-to-r from-green-500 to-emerald-500 text-white hover:shadow-lg"
                  >
                    <UserCheck size={16} />
                    <span>Continue to Profile Setup</span>
                    <ArrowRight size={16} />
                  </motion.button>
                )}
              </div>
            </div>

            {/* FOOTER */}
            <div className="flex-shrink-0 mt-3 pt-3 border-t border-gray-200 dark:border-white/10 text-center">
              <div className="flex flex-wrap items-center justify-center gap-3 mb-1">
                <div className="flex items-center gap-1 text-[10px] sm:text-xs text-gray-500"><Lock size={10} /> Encrypted</div>
                <div className="flex items-center gap-1 text-[10px] sm:text-xs text-gray-500"><Shield size={10} /> Secure</div>
              </div>
              <p className="text-[10px] sm:text-xs text-gray-400">© {new Date().getFullYear()} Arvdoul</p>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}