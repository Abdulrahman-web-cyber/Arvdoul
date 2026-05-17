// This file reflects: ultra pro max production, all critical fixes applied
// src/screens/OTPVerification.jsx – ARVDOUL SUPREMACY • BILLION‑USER SCALE

import React, { useState, useEffect, useRef, useCallback, useMemo, forwardRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { useAuth } from "@context/AuthContext.jsx";
import { useTheme } from "@context/ThemeContext.jsx";
import { Shield, Smartphone, ArrowLeft, AlertTriangle, Send, CheckCircle2 } from "lucide-react";

// -------------------- CONSTANTS --------------------
const DIGIT_COUNT = 6;
const INITIAL_COUNTDOWN = 120;
const AUTO_SUBMIT_DELAY = 200;
const RESEND_COOLDOWN = 60;
const MAX_FAILED_ATTEMPTS_BEFORE_RESET = 3;
const SHAKE_DURATION = 500;

// -------------------- HUMAN‑FRIENDLY ERRORS --------------------
const ERROR_MAP = {
  "auth/invalid-verification-code": {
    title: "That code doesn't look right",
    subtitle: "Double‑check the digits and try again, or request a new code.",
    severity: "soft",
  },
  "auth/code-expired": { title: "Code expired", subtitle: "No worries – request a fresh one below.", severity: "neutral" },
  "auth/invalid-verification-id": { title: "Session timed out", subtitle: "Please request a new code to continue.", severity: "neutral" },
  "auth/too-many-requests": { title: "Too many attempts", subtitle: "Please wait a moment before trying again.", severity: "firm" },
  "auth/credential-already-in-use": { title: "Number already linked", subtitle: "This phone is connected to another account.", severity: "firm" },
  "auth/network-request-failed": { title: "Connection issue", subtitle: "Please check your internet and try again.", severity: "neutral" },
  "auth/session-expired": { title: "Session expired", subtitle: "Request a new code to continue.", severity: "neutral" },
  default: { title: "Verification failed", subtitle: "Please try again or request a new code.", severity: "soft" },
};

// -------------------- DETECT LOW‑END DEVICE --------------------
const isLowPerformance = () => {
  if (typeof navigator === "undefined") return false;
  const cores = navigator.hardwareConcurrency;
  const memory = navigator.deviceMemory;
  return (cores && cores <= 4) || (memory && memory < 4);
};

// -------------------- SINGLE REDUCED MOTION HOOK --------------------
const useReducedMotion = () => {
  const [prefersReduced, setPrefersReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReduced(mq.matches);
    const handler = (e) => setPrefersReduced(e.matches);
    if (mq.addEventListener) {
      mq.addEventListener("change", handler);
    } else {
      mq.addListener(handler);
    }
    return () => {
      if (mq.removeEventListener) {
        mq.removeEventListener("change", handler);
      } else {
        mq.removeListener(handler);
      }
    };
  }, []);
  return prefersReduced;
};

// -------------------- HAPTICS (safe) --------------------
const triggerHaptic = (pattern = "light") => {
  if (typeof navigator !== "undefined" && navigator.vibrate) {
    const patterns = { light: [10], medium: [15, 30, 15], heavy: [20, 50, 20, 50, 20], success: [30, 50, 30, 50, 60], error: [30, 100, 30], tick: [8] };
    navigator.vibrate(patterns[pattern] || patterns.light);
  }
};

// ==================== GLASS OTP DIGIT ====================
const GlassOTPDigit = forwardRef(
  ({ digit, index, disabled, hasError, isVerifying, onChange, onKeyDown, onPaste, autoFocus, reducedMotion, ariaLabel }, ref) => {
    const { theme } = useTheme();
    const isDark = theme === "system"
      ? typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches
      : theme === "dark";
    const inputRef = useRef(null);

    useEffect(() => {
      if (ref) {
        if (typeof ref === "function") ref(inputRef.current);
        else ref.current = inputRef.current;
      }
    }, [ref]);

    useEffect(() => {
      if (autoFocus && inputRef.current && !disabled) {
        inputRef.current.focus();
      }
    }, [autoFocus, disabled]);

    const borderClasses = useMemo(() => {
      if (hasError) return "border-red-400 dark:border-red-500 ring-1 ring-red-300/50";
      if (digit && !hasError) return "border-emerald-400 dark:border-emerald-500 ring-1 ring-emerald-300/50";
      return "border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500";
    }, [hasError, digit]);

    return (
      <motion.div
        className="relative flex-shrink-0"
        whileFocus={!reducedMotion ? { scale: 1.05 } : {}}
        whileHover={!disabled && !reducedMotion ? { scale: 1.03 } : {}}
        transition={reducedMotion ? { duration: 0 } : { type: "spring", stiffness: 400, damping: 12 }}
      >
        <input
          ref={inputRef}
          type="tel"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={1}
          value={digit}
          onChange={(e) => {
            onChange(index, e.target.value);
            if (e.target.value && /^\d$/.test(e.target.value)) triggerHaptic("tick");
          }}
          onKeyDown={(e) => onKeyDown(index, e)}
          onPaste={index === 0 ? onPaste : undefined}
          disabled={disabled || isVerifying}
          autoComplete={index === 0 ? "one-time-code" : "off"}
          aria-label={ariaLabel || `Digit ${index + 1}`}
          aria-invalid={hasError}
          aria-disabled={disabled || isVerifying}
          className={`
            w-12 h-14 sm:w-14 sm:h-16
            rounded-2xl border-2 
            text-center text-2xl sm:text-3xl font-bold 
            transition-all duration-200 
            outline-none 
            backdrop-blur-sm
            ${isDark ? "bg-gray-800/70 text-white placeholder-gray-600" : "bg-white/80 text-gray-900 placeholder-gray-400"}
            ${borderClasses}
            focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/20 focus:scale-105
            ${disabled || isVerifying ? "opacity-50 cursor-not-allowed" : "cursor-text"}
            selection:bg-indigo-200 dark:selection:bg-indigo-800
          `}
        />
      </motion.div>
    );
  }
);
GlassOTPDigit.displayName = "GlassOTPDigit";

// -------------------- ANIMATED SHIELD (low‑performance aware) --------------------
const AnimatedShield = React.memo(({ attempts, isVerifying, isDark, reducedMotion }) => {
  const color = attempts >= 3 ? "#EF4444" : attempts >= 1 ? "#F59E0B" : "#10B981";
  const glow = attempts >= 3 ? "rgba(239,68,68,0.3)" : attempts >= 1 ? "rgba(245,158,11,0.3)" : "rgba(16,185,129,0.3)";
  return (
    <motion.div
      className="relative inline-flex items-center justify-center mb-3"
      animate={!reducedMotion ? { scale: [1, 1.04, 1] } : {}}
      transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
    >
      {!isLowPerformance() && (
        <motion.div
          className="absolute w-16 h-16 rounded-full blur-xl"
          style={{ backgroundColor: glow }}
          animate={!reducedMotion ? { scale: [1, 1.2, 1], opacity: [0.5, 0.8, 0.5] } : {}}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
        />
      )}
      {isVerifying && (
        <motion.div
          className="absolute w-16 h-16 rounded-full border-2 border-indigo-400"
          animate={!reducedMotion ? { scale: [1, 1.4, 1], opacity: [0.6, 0, 0.6] } : {}}
          transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
        />
      )}
      <Shield size={44} strokeWidth={2.2} className="relative z-10 drop-shadow-lg" style={{ color, filter: `drop-shadow(0 0 8px ${glow})` }} />
    </motion.div>
  );
});

// -------------------- CIRCULAR PROGRESS RING --------------------
const CircularProgressRing = React.memo(({ progress, size = 52, strokeWidth = 4, isDark, children, reducedMotion }) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (progress / 100) * circumference;
  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width={size} height={size} className="transform -rotate-90 drop-shadow-md">
        <circle stroke={isDark ? "#374151" : "#e5e7eb"} strokeWidth={strokeWidth} fill="transparent" r={radius} cx={size / 2} cy={size / 2} />
        <motion.circle
          stroke="url(#ringGradient)"
          strokeWidth={strokeWidth}
          fill="transparent"
          r={radius}
          cx={size / 2}
          cy={size / 2}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          animate={!reducedMotion ? { strokeDashoffset: offset } : {}}
          transition={reducedMotion ? { duration: 0 } : { duration: 0.8, ease: "easeInOut" }}
        />
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
});

// -------------------- SUCCESS CHECKMARK --------------------
const SuccessCheckmark = React.memo(({ reducedMotion }) => (
  <motion.div className="flex flex-col items-center gap-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
    <motion.div
      className="relative"
      initial={{ scale: 0, rotate: -90 }}
      animate={{ scale: 1, rotate: 0 }}
      transition={reducedMotion ? { duration: 0 } : { type: "spring", stiffness: 200, damping: 12, delay: 0.1 }}
    >
      {!isLowPerformance() && (
        <motion.div
          className="absolute inset-0 w-20 h-20 rounded-full bg-emerald-400/30 blur-xl"
          animate={!reducedMotion ? { scale: [1, 1.3, 1], opacity: [0.5, 0.8, 0.5] } : {}}
          transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
        />
      )}
      <div className="relative w-20 h-20 rounded-full bg-gradient-to-br from-emerald-400 to-green-500 flex items-center justify-center shadow-2xl shadow-emerald-500/30">
        <CheckCircle2 size={40} className="text-white" strokeWidth={3} />
      </div>
    </motion.div>
    <motion.p
      className="text-lg font-bold text-emerald-600 dark:text-emerald-400"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.5, duration: 0.3 }}
    >
      Verified Successfully
    </motion.p>
  </motion.div>
));

// ==================== MAIN COMPONENT ====================
export default function OTPVerification() {
  const navigate = useNavigate();
  const location = useLocation();
  const auth = useAuth();
  const { theme } = useTheme();
  const reducedMotion = useReducedMotion();
  const lowPerf = isLowPerformance();

  // ---- STATE ----
  const [otp, setOtp] = useState(Array(DIGIT_COUNT).fill(""));
  const [loading, setLoading] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationId, setVerificationId] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [isSignup, setIsSignup] = useState(false);
  const [step1Data, setStep1Data] = useState(null);
  const [countdown, setCountdown] = useState(INITIAL_COUNTDOWN);
  const [canResend, setCanResend] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(false);
  const [resendTimer, setResendTimer] = useState(RESEND_COOLDOWN);
  const [error, setError] = useState(null);
  const [attempts, setAttempts] = useState(0);
  const [shakeInputs, setShakeInputs] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [isOffline, setIsOffline] = useState(typeof navigator !== "undefined" ? !navigator.onLine : false);
  const [dataLoaded, setDataLoaded] = useState(false);

  // ---- REFS ----
  const inputRefs = useRef([]);
  const countdownInterval = useRef(null);
  const resendCooldownInterval = useRef(null);
  const autoSubmitTimerRef = useRef(null);
  const submitLock = useRef(false);
  const verificationLoaded = useRef(false);
  const lastAttemptTime = useRef(0);
  const isMounted = useRef(true);

  // ---- THEME ----
  const resolvedTheme =
    theme === "system"
      ? typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light"
      : theme;
  const isDark = resolvedTheme === "dark";

  // ---- OTP DRAFT PERSISTENCE ----
  useEffect(() => {
    const draft = sessionStorage.getItem("otp_draft");
    if (draft && draft.length === DIGIT_COUNT && !otp.some(d => d)) {
      const draftArr = draft.split("");
      setOtp(draftArr);
      draftArr.forEach((d, idx) => {
        if (d && idx < DIGIT_COUNT - 1) setTimeout(() => inputRefs.current[idx + 1]?.focus(), 0);
      });
    }
  }, []);
  useEffect(() => {
    sessionStorage.setItem("otp_draft", otp.join(""));
  }, [otp]);

  // ---- ONLINE/OFFLINE ----
  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // ---- LOAD VERIFICATION DATA ----
  useEffect(() => {
    if (verificationLoaded.current) return;

    const loadData = () => {
      try {
        const state = location.state || {};
        let data = null;

        if (state.verificationId && state.phoneNumber) {
          data = {
            verificationId: state.verificationId,
            phoneNumber: state.phoneNumber,
            isSignup: state.isSignup ?? false,
            step1Data: state.step1Data || {},
          };
        } else {
          const sess = sessionStorage.getItem("phone_verification");
          if (sess) {
            const parsed = JSON.parse(sess);
            if (parsed.verificationId && parsed.phoneNumber) {
              data = {
                verificationId: parsed.verificationId,
                phoneNumber: parsed.phoneNumber,
                isSignup: parsed.isSignup ?? false,
                step1Data: parsed.step1Data || {},
              };
            }
          }
          if (!data) {
            const local = localStorage.getItem("phone_verification");
            if (local) {
              const parsed = JSON.parse(local);
              if (parsed.verificationId && parsed.phoneNumber) {
                data = {
                  verificationId: parsed.verificationId,
                  phoneNumber: parsed.phoneNumber,
                  isSignup: parsed.isSignup ?? false,
                  step1Data: parsed.step1Data || {},
                };
              }
            }
          }
        }

        if (data) {
          setVerificationId(data.verificationId);
          setPhoneNumber(data.phoneNumber);
          setIsSignup(data.isSignup);
          setStep1Data(data.step1Data || {});
          verificationLoaded.current = true;
          setDataLoaded(true);
        } else {
          toast.error("Verification session expired. Please start over.");
          setTimeout(() => navigate("/signup/step2", { replace: true }), 2000);
        }
      } catch (err) {
        console.error("Failed to load verification data:", err);
        toast.error("Session error. Please start over.");
        setTimeout(() => navigate("/signup/step2", { replace: true }), 2000);
      }
    };

    loadData();
    return () => { isMounted.current = false; };
  }, [location, navigate]);

  // ---- COUNTDOWN ----
  useEffect(() => {
    if (countdown > 0 && !canResend) {
      countdownInterval.current = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(countdownInterval.current);
            setCanResend(true);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(countdownInterval.current);
  }, [countdown, canResend]);

  // ---- AUTO‑SUBMIT WITH LOCK ----
  useEffect(() => {
    const code = otp.join("");
    if (code.length === DIGIT_COUNT && !loading && !isVerifying && dataLoaded && !showSuccess && !submitLock.current) {
      autoSubmitTimerRef.current = setTimeout(() => {
        if (isMounted.current && !submitLock.current) {
          submitLock.current = true;
          handleVerify(code);
        }
      }, AUTO_SUBMIT_DELAY);
    } else {
      if (autoSubmitTimerRef.current) {
        clearTimeout(autoSubmitTimerRef.current);
        autoSubmitTimerRef.current = null;
      }
    }
    return () => {
      if (autoSubmitTimerRef.current) clearTimeout(autoSubmitTimerRef.current);
    };
  }, [otp, loading, isVerifying, dataLoaded, showSuccess]);

  // ---- CLEANUP ----
  useEffect(() => {
    return () => {
      clearInterval(countdownInterval.current);
      clearInterval(resendCooldownInterval.current);
      if (autoSubmitTimerRef.current) clearTimeout(autoSubmitTimerRef.current);
    };
  }, []);

  // ---- FORMAT TIME ----
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  // ---- OTP HANDLERS ----
  const handleOtpChange = useCallback(
    (index, value) => {
      if (!/^\d*$/.test(value)) return;
      const newOtp = [...otp];
      newOtp[index] = value.slice(-1);
      setOtp(newOtp);
      setError(null);
      if (value && index < DIGIT_COUNT - 1) {
        setTimeout(() => inputRefs.current[index + 1]?.focus(), 0);
      }
    },
    [otp]
  );

  const handleKeyDown = useCallback(
    (index, e) => {
      if (e.key === "Backspace") {
        if (!otp[index] && index > 0) {
          const newOtp = [...otp];
          newOtp[index - 1] = "";
          setOtp(newOtp);
          setTimeout(() => inputRefs.current[index - 1]?.focus(), 0);
          triggerHaptic("light");
        } else if (otp[index]) {
          const newOtp = [...otp];
          newOtp[index] = "";
          setOtp(newOtp);
          triggerHaptic("light");
        }
      }
      if (e.key === "ArrowLeft" && index > 0) setTimeout(() => inputRefs.current[index - 1]?.focus(), 0);
      if (e.key === "ArrowRight" && index < DIGIT_COUNT - 1) setTimeout(() => inputRefs.current[index + 1]?.focus(), 0);
    },
    [otp]
  );

  const handlePaste = useCallback(
    (e) => {
      e.preventDefault();
      const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, DIGIT_COUNT);
      if (pasted.length > 0) {
        const newOtp = [...otp];
        pasted.split("").forEach((d, i) => { if (i < DIGIT_COUNT) newOtp[i] = d; });
        for (let i = pasted.length; i < DIGIT_COUNT; i++) newOtp[i] = "";
        setOtp(newOtp);
        setError(null);
        triggerHaptic("medium");
        setTimeout(() => {
          const focusIndex = Math.min(pasted.length, DIGIT_COUNT - 1);
          inputRefs.current[focusIndex]?.focus();
        }, 0);
      }
    },
    [otp]
  );

  // ---- VERIFICATION (IMMEDIATE NAVIGATION) ----
  const handleVerify = useCallback(
    async (codeOverride) => {
      const code = codeOverride || otp.join("");
      if (!dataLoaded || !verificationId) return;
      const now = Date.now();
      if (now - lastAttemptTime.current < 1200) return;
      lastAttemptTime.current = now;

      if (code.length !== DIGIT_COUNT) {
        setError({ title: "Enter all 6 digits", subtitle: "", severity: "soft" });
        submitLock.current = false;
        return;
      }
      if (loading || isVerifying) {
        submitLock.current = false;
        return;
      }

      setIsVerifying(true);
      setLoading(true);
      setError(null);
      triggerHaptic("medium");

      try {
        const result = await auth.verifyPhoneOTP(verificationId, code);
        if (!result.success) throw new Error(result.error || "Verification failed");

        sessionStorage.removeItem("phone_verification");
        localStorage.removeItem("phone_verification");
        sessionStorage.removeItem("otp_draft");

        triggerHaptic("success");
        setShowSuccess(true);

        // ✅ CRITICAL: Trust the server's isNewUser flag
        const isNewUser = result.isNewUser === true;

        console.log("✅ OTP verified. isNewUser =", isNewUser);

        // ✅ Navigate immediately (no delay) to prevent component unmount
        if (!isNewUser) {
          // Existing user → Home
          toast.success("Welcome back!");
          navigate("/home", { replace: true, state: { welcomeMessage: true } });
        } else {
          // New user → SetupProfile
          navigate("/setup-profile", {
            state: {
              method: "phone",
              userData: result.user,
              isNewUser: true,
              fromVerification: true,
              step1Data,
            },
            replace: true,
          });
        }
      } catch (err) {
        console.error("OTP error:", err);
        triggerHaptic("error");
        const newAttempts = attempts + 1;
        setAttempts(newAttempts);
        const humanErr = ERROR_MAP[err.code] || ERROR_MAP.default;
        setError(humanErr);
        setShakeInputs(true);
        setTimeout(() => setShakeInputs(false), SHAKE_DURATION);
        if (newAttempts >= MAX_FAILED_ATTEMPTS_BEFORE_RESET) {
          setOtp(Array(DIGIT_COUNT).fill(""));
          setAttempts(0);
          setTimeout(() => inputRefs.current[0]?.focus(), 100);
        }
        if (err.code === "auth/session-expired") {
          setCanResend(true);
          setCountdown(0);
        }
        submitLock.current = false;
      } finally {
        setLoading(false);
        setIsVerifying(false);
      }
    },
    [dataLoaded, verificationId, otp, loading, isVerifying, attempts, auth, navigate, step1Data, isSignup]
  );

  // ---- RESEND (UPDATES verificationId) ----
  const handleResend = useCallback(async () => {
    if (!canResend || resendCooldown) return;
    setResendCooldown(true);
    setResendTimer(RESEND_COOLDOWN);
    triggerHaptic("medium");
    try {
      const result = await auth.sendPhoneVerificationCode(phoneNumber, null);
      if (result.success) {
        const newVerificationId = result.verificationId;
        setVerificationId(newVerificationId);
        const updatedSession = { verificationId: newVerificationId, phoneNumber, isSignup, step1Data };
        sessionStorage.setItem("phone_verification", JSON.stringify(updatedSession));
        localStorage.setItem("phone_verification", JSON.stringify(updatedSession));
        toast.success("New code sent successfully");
        setCountdown(INITIAL_COUNTDOWN);
        setCanResend(false);
        setOtp(Array(DIGIT_COUNT).fill(""));
        setError(null);
        setAttempts(0);
        setTimeout(() => inputRefs.current[0]?.focus(), 100);
        triggerHaptic("success");
      }
    } catch (error) {
      toast.error("Couldn't send code. Check connection.");
      triggerHaptic("error");
    } finally {
      resendCooldownInterval.current = setInterval(() => {
        setResendTimer((prev) => {
          if (prev <= 1) {
            clearInterval(resendCooldownInterval.current);
            setResendCooldown(false);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
  }, [canResend, resendCooldown, phoneNumber, auth, isSignup, step1Data]);

  const handleBack = () => navigate("/signup/step2", { replace: true });

  const formattedPhone = useMemo(() => {
    if (!phoneNumber) return "";
    if (phoneNumber.length <= 4) return phoneNumber;
    return `${phoneNumber.slice(0, 4)} •••• ${phoneNumber.slice(-3)}`;
  }, [phoneNumber]);

  const ringProgress = useMemo(() => (countdown > 0 ? ((INITIAL_COUNTDOWN - countdown) / INITIAL_COUNTDOWN) * 100 : 100), [countdown]);
  const isComplete = useMemo(() => otp.join("").length === DIGIT_COUNT, [otp]);

  if (!dataLoaded) {
    return (
      <div className={`min-h-screen flex items-center justify-center p-4 ${isDark ? "bg-gradient-to-br from-gray-950 via-gray-900 to-black" : "bg-gradient-to-br from-blue-50 via-white to-gray-100"}`}>
        <motion.div className="flex flex-col items-center gap-5" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <motion.div
            className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-2xl shadow-indigo-500/25"
            animate={!reducedMotion ? { scale: [1, 1.05, 1], rotate: [0, 5, -5, 0] } : {}}
            transition={{ duration: 3, repeat: Infinity }}
          >
            <Shield size={28} className="text-white" />
          </motion.div>
          <p className={`text-base font-medium ${isDark ? "text-gray-300" : "text-gray-700"}`}>Preparing verification...</p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className={`min-h-[100dvh] flex flex-col ${isDark ? "bg-gradient-to-br from-gray-950 via-gray-900 to-black" : "bg-gradient-to-br from-blue-50 via-white to-gray-100"}`}>
      <AnimatePresence>
        {isOffline && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-amber-500/95 text-white text-center py-2 text-xs font-semibold backdrop-blur-sm"
          >
            You are offline – verification requires internet
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex-1 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={showSuccess ? { opacity: 0, scale: 1.05 } : { opacity: 1, scale: 1, y: 0 }}
          transition={reducedMotion ? { duration: 0 } : { duration: 0.5, type: "spring", stiffness: 200, damping: 20 }}
          className="w-full max-w-md mx-auto"
        >
          <motion.div
            className={`relative rounded-3xl border backdrop-blur-2xl overflow-visible ${
              !lowPerf && (typeof navigator !== "undefined" && navigator.deviceMemory && navigator.deviceMemory >= 4) ? "shadow-2xl" : "shadow-lg"
            } ${isDark ? "bg-gray-900/70 border-white/10 shadow-indigo-900/20" : "bg-white/70 border-gray-200/60 shadow-indigo-100/20"} p-5 sm:p-6 md:p-8`}
          >
            <AnimatePresence>
              {isVerifying && (
                <motion.div
                  className="absolute inset-0 bg-indigo-500/5 backdrop-blur-[1px] z-20 rounded-3xl pointer-events-none"
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                />
              )}
            </AnimatePresence>

            <AnimatePresence>
              {showSuccess && (
                <motion.div
                  className="absolute inset-0 flex items-center justify-center bg-inherit rounded-3xl z-30"
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                >
                  <SuccessCheckmark reducedMotion={reducedMotion} />
                </motion.div>
              )}
            </AnimatePresence>

            <AnimatePresence>
              {!showSuccess && (
                <motion.div key="content" exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
                  <div className="text-center mb-5">
                    <motion.div
                      className="relative mx-auto mb-3 w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-gradient-to-br from-indigo-500/10 to-purple-500/10 dark:from-indigo-400/10 dark:to-purple-400/10 flex items-center justify-center"
                      initial={{ scale: 0, rotate: -20 }}
                      animate={{ scale: 1, rotate: 0 }}
                      transition={reducedMotion ? { duration: 0 } : { type: "spring", stiffness: 300, damping: 15, delay: 0.1 }}
                    >
                      <Smartphone size={28} strokeWidth={1.8} className={`${isDark ? "text-indigo-400" : "text-indigo-600"} drop-shadow-lg`} />
                      <motion.div
                        className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 border-white dark:border-gray-900"
                        animate={!reducedMotion ? { scale: [1, 1.3, 1] } : {}}
                        transition={{ duration: 1.5, repeat: Infinity }}
                      />
                    </motion.div>
                    <AnimatedShield attempts={attempts} isVerifying={isVerifying} isDark={isDark} reducedMotion={reducedMotion} />
                    <h1 className={`text-xl sm:text-2xl md:text-3xl font-bold tracking-tight mb-1 ${isDark ? "text-white" : "text-gray-900"}`}>
                      Enter Verification Code
                    </h1>
                    <p className={`text-xs sm:text-sm ${isDark ? "text-gray-400" : "text-gray-600"}`}>
                      We sent a 6‑digit code to
                    </p>
                    <p className={`text-sm sm:text-base font-semibold mt-0.5 ${isDark ? "text-gray-200" : "text-gray-800"}`}>
                      {formattedPhone}
                    </p>
                  </div>

                  <motion.div
                    className="flex justify-center gap-2 sm:gap-3 mb-5"
                    animate={shakeInputs ? { x: [0, -4, 4, -4, 4, -2, 2, 0] } : {}}
                    transition={{ duration: reducedMotion ? 0 : 0.5, ease: "easeInOut" }}
                  >
                    {otp.map((digit, idx) => (
                      <GlassOTPDigit
                        key={idx}
                        digit={digit}
                        index={idx}
                        disabled={loading}
                        hasError={error !== null}
                        isVerifying={isVerifying}
                        onChange={handleOtpChange}
                        onKeyDown={handleKeyDown}
                        onPaste={handlePaste}
                        autoFocus={idx === 0 && !loading && !showSuccess}
                        reducedMotion={reducedMotion}
                        ariaLabel={`Digit ${idx + 1}`}
                        ref={(el) => (inputRefs.current[idx] = el)}
                      />
                    ))}
                  </motion.div>

                  <AnimatePresence mode="wait">
                    {error && (
                      <motion.div
                        key="error-msg"
                        initial={{ opacity: 0, height: 0, y: -10 }}
                        animate={{ opacity: 1, height: "auto", y: 0 }}
                        exit={{ opacity: 0, height: 0, y: -10 }}
                        transition={{ duration: 0.3 }}
                        className="mb-4 overflow-hidden"
                      >
                        <div className={`p-3 rounded-xl border ${
                          error.severity === "firm"
                            ? "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800/50"
                            : error.severity === "neutral"
                            ? "bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800/50"
                            : "bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800/50"
                        }`}>
                          <div className="flex items-start gap-2">
                            <AlertTriangle size={16} className={`flex-shrink-0 mt-0.5 ${
                              error.severity === "firm" ? "text-red-500" : error.severity === "neutral" ? "text-amber-500" : "text-orange-500"
                            }`} />
                            <div>
                              <p className={`text-xs sm:text-sm font-semibold ${
                                error.severity === "firm" ? "text-red-700 dark:text-red-300" : error.severity === "neutral" ? "text-amber-700 dark:text-amber-300" : "text-orange-700 dark:text-orange-300"
                              }`}>{error.title}</p>
                              {error.subtitle && (
                                <p className={`text-xs mt-0.5 ${
                                  error.severity === "firm" ? "text-red-600 dark:text-red-400" : error.severity === "neutral" ? "text-amber-600 dark:text-amber-400" : "text-orange-600 dark:text-orange-400"
                                }`}>{error.subtitle}</p>
                              )}
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <div className="flex flex-col items-center gap-2 mb-5">
                    {!canResend ? (
                      <div className="flex flex-col items-center gap-1.5">
                        <CircularProgressRing progress={ringProgress} size={48} strokeWidth={4} isDark={isDark} reducedMotion={reducedMotion}>
                          <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400">{formatTime(countdown)}</span>
                        </CircularProgressRing>
                        <span className={`text-xs ${isDark ? "text-gray-500" : "text-gray-400"}`}>until resend available</span>
                      </div>
                    ) : (
                      <motion.button
                        onClick={handleResend}
                        disabled={resendCooldown || loading || isVerifying}
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.3 }}
                        className={`text-xs sm:text-sm font-semibold px-4 py-2.5 rounded-xl transition-all duration-200 flex items-center gap-2 ${
                          resendCooldown || loading || isVerifying
                            ? "bg-gray-200 dark:bg-gray-800 text-gray-400 cursor-not-allowed"
                            : "bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 active:scale-95"
                        }`}
                      >
                        <Send size={14} />
                        {resendCooldown ? `Resend in ${resendTimer}s` : "Resend Code"}
                      </motion.button>
                    )}
                  </div>

                  <motion.button
                    onClick={() => handleVerify()}
                    disabled={!isComplete || loading || isVerifying || showSuccess}
                    whileHover={isComplete && !loading && !isVerifying && !reducedMotion ? { scale: 1.02 } : {}}
                    whileTap={isComplete && !loading && !isVerifying && !reducedMotion ? { scale: 0.98 } : {}}
                    className={`w-full py-3.5 rounded-2xl font-bold text-sm sm:text-base transition-all duration-300 relative overflow-hidden ${
                      isComplete && !loading && !isVerifying
                        ? "bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 text-white shadow-xl shadow-indigo-500/25 hover:shadow-2xl hover:shadow-indigo-500/30"
                        : isDark ? "bg-gray-800 text-gray-500 cursor-not-allowed" : "bg-gray-200 text-gray-400 cursor-not-allowed"
                    }`}
                  >
                    {isVerifying && (
                      <motion.div
                        className="absolute inset-0 bg-gradient-to-r from-indigo-500/30 via-purple-500/30 to-pink-500/30"
                        animate={!reducedMotion ? { x: ["-100%", "100%"] } : {}}
                        transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                      />
                    )}
                    <span className="relative z-10 flex items-center justify-center gap-2">
                      {isVerifying ? (
                        <>
                          <motion.div
                            className="w-4 h-4 border-2 border-white border-t-transparent rounded-full"
                            animate={!reducedMotion ? { rotate: 360 } : {}}
                            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                          />
                          <span>Verifying...</span>
                        </>
                      ) : (
                        <>
                          <Shield size={16} />
                          <span>Verify Code</span>
                        </>
                      )}
                    </span>
                  </motion.button>

                  {isSignup && (
                    <div className="mt-3 text-center">
                      <button
                        onClick={handleBack}
                        disabled={loading || isVerifying}
                        className={`text-xs font-medium flex items-center justify-center gap-1.5 mx-auto transition-colors ${
                          isDark ? "text-gray-500 hover:text-gray-300 disabled:opacity-40" : "text-gray-400 hover:text-gray-600 disabled:opacity-40"
                        }`}
                      >
                        <ArrowLeft size={12} />
                        Change Phone Number
                      </button>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
}