// src/screens/OTPVerification.jsx - ULTIMATE ENTERPRISE V4 - FIXED
import React, { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { useAuth } from "@context/AuthContext.jsx";
import { useTheme } from "@context/ThemeContext.jsx";

export default function OTPVerification() {
  const navigate = useNavigate();
  const location = useLocation();
  const auth = useAuth();
  const { theme } = useTheme();

  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [loading, setLoading] = useState(false);
  const [verificationId, setVerificationId] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [countdown, setCountdown] = useState(120);
  const [canResend, setCanResend] = useState(false);
  const [step1Data, setStep1Data] = useState(null);
  const [error, setError] = useState("");
  const [verificationAttempts, setVerificationAttempts] = useState(0);
  const [isVerifying, setIsVerifying] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(false);
  const [resendTimer, setResendTimer] = useState(60);
  const [autoSubmitTimer, setAutoSubmitTimer] = useState(null);
  const [isMounted, setIsMounted] = useState(true);
  const [dataLoaded, setDataLoaded] = useState(false); // ← NEW

  const inputRefs = useRef([]);
  const countdownInterval = useRef(null);
  const resendCooldownInterval = useRef(null);
  const verificationDataLoaded = useRef(false);
  const lastVerificationAttempt = useRef(0);

  const resolvedTheme = theme === 'system' 
    ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    : theme;

  // Load verification data (unchanged, but sets dataLoaded at the end)
  useEffect(() => {
    const loadVerificationData = async () => {
      if (verificationDataLoaded.current) return;
      try {
        console.log('🔄 Loading verification data...');
        if (location.state?.verificationId && location.state?.phoneNumber) {
          setVerificationId(location.state.verificationId);
          setPhoneNumber(location.state.phoneNumber);
          setStep1Data(location.state.step1Data || {});
          verificationDataLoaded.current = true;
          setDataLoaded(true);
          return;
        }
        const sessionData = sessionStorage.getItem('phone_verification');
        if (sessionData) {
          const parsed = JSON.parse(sessionData);
          if (parsed.verificationId && parsed.phoneNumber) {
            setVerificationId(parsed.verificationId);
            setPhoneNumber(parsed.phoneNumber);
            setStep1Data(parsed.step1Data || {});
            verificationDataLoaded.current = true;
            setDataLoaded(true);
            return;
          }
        }
        const localData = localStorage.getItem('phone_verification');
        if (localData) {
          const parsed = JSON.parse(localData);
          if (parsed.verificationId && parsed.phoneNumber) {
            setVerificationId(parsed.verificationId);
            setPhoneNumber(parsed.phoneNumber);
            setStep1Data(parsed.step1Data || {});
            verificationDataLoaded.current = true;
            setDataLoaded(true);
            return;
          }
        }
        const signupData = localStorage.getItem('signup_data') || sessionStorage.getItem('signup_data');
        if (signupData) {
          const parsed = JSON.parse(signupData);
          if (parsed.verificationId && parsed.phoneNumber) {
            setVerificationId(parsed.verificationId);
            setPhoneNumber(parsed.phoneNumber);
            setStep1Data(parsed);
            verificationDataLoaded.current = true;
            setDataLoaded(true);
            return;
          }
        }
        toast.error("Verification session expired. Please start over.");
        setTimeout(() => navigate("/signup/step2", { replace: true }), 2000);
      } catch (error) {
        console.error('❌ Failed to load verification data:', error);
        toast.error("Session error. Please start over.");
        setTimeout(() => navigate("/signup/step2", { replace: true }), 2000);
      }
    };
    loadVerificationData();
    return () => {
      setIsMounted(false);
      verificationDataLoaded.current = false;
    };
  }, [location, navigate]);

  // Countdown timers (unchanged) ...

  // Auto‑submit timer – now depends on dataLoaded
  useEffect(() => {
    const otpString = otp.join('');
    if (otpString.length === 6 && !loading && !isVerifying && dataLoaded) {
      const timer = setTimeout(() => {
        if (isMounted) handleVerify();
      }, 1500);
      setAutoSubmitTimer(timer);
    } else if (autoSubmitTimer) {
      clearTimeout(autoSubmitTimer);
      setAutoSubmitTimer(null);
    }
    return () => {
      if (autoSubmitTimer) clearTimeout(autoSubmitTimer);
    };
  }, [otp, loading, isVerifying, dataLoaded]);

  // Format time (unchanged) ...

  // OTP input handlers (unchanged) ...

  // handleVerify – added dataLoaded guard
  const handleVerify = async () => {
    if (!dataLoaded) {
      toast.info("Still loading verification data, please wait...");
      return;
    }
    const otpString = otp.join('');
    const now = Date.now();
    if (now - lastVerificationAttempt.current < 1000) {
      toast.info("Please wait before trying again");
      return;
    }
    lastVerificationAttempt.current = now;
    if (otpString.length !== 6) {
      setError("Please enter all 6 digits");
      toast.error("Please enter all 6 digits");
      return;
    }
    if (!verificationId || typeof verificationId !== 'string') {
      setError("Verification session expired");
      toast.error("Session expired. Please request a new code.");
      setTimeout(() => navigate("/signup/step2", { replace: true }), 2000);
      return;
    }
    if (loading || isVerifying) return;
    setIsVerifying(true);
    setLoading(true);
    setError("");
    try {
      console.log("🔢 Verifying OTP with ID:", verificationId);
      const result = await auth.verifyPhoneOTP(verificationId, otpString);
      if (!result.success) throw new Error(result.error || "Verification failed");
      console.log("✅ Phone verification successful:", result.user.uid);
      // ... (rest of success handling unchanged)
    } catch (error) {
      // ... error handling unchanged
    } finally {
      setLoading(false);
      setIsVerifying(false);
    }
  };

  // handleResend (unchanged) ...

  // Format phone number (unchanged) ...

  return (
    <div className={`min-h-screen flex items-center justify-center p-4 ${resolvedTheme === 'dark' ? 'bg-gradient-to-br from-gray-900 via-gray-800 to-black' : 'bg-gradient-to-br from-blue-50 via-white to-gray-100'}`}>
      {/* JSX unchanged except button disabled state */}
      <motion.button
        whileHover={!loading && otp.join('').length === 6 && dataLoaded ? { scale: 1.02 } : {}}
        whileTap={!loading && otp.join('').length === 6 && dataLoaded ? { scale: 0.98 } : {}}
        onClick={handleVerify}
        disabled={loading || isVerifying || otp.join('').length !== 6 || !dataLoaded}
        className={`w-full py-4 px-6 rounded-xl font-bold text-base transition-all duration-300 relative overflow-hidden group ${!loading && otp.join('').length === 6 && dataLoaded ? 'bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 text-white' : resolvedTheme === 'dark' ? 'bg-gray-800 text-gray-400 cursor-not-allowed' : 'bg-gray-200 text-gray-500 cursor-not-allowed'}`}
      >
        {/* ... */}
      </motion.button>
    </div>
  );
}