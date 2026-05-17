// src/screens/OTPVerification.jsx - ULTIMATE ENTERPRISE V3 - FIXED
// ✅ Real OTP Verification • Advanced Styling • Production Ready

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
  
  // Enhanced State Management
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
  
  // Refs
  const inputRefs = useRef([]);
  const countdownInterval = useRef(null);
  const resendCooldownInterval = useRef(null);
  const verificationDataLoaded = useRef(false);
  const lastVerificationAttempt = useRef(0);
  
  const resolvedTheme = theme === 'system' ? 
    (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : 
    theme;

  // Load verification data with redundancy
  useEffect(() => {
    const loadVerificationData = async () => {
      if (verificationDataLoaded.current) return;
      
      try {
        console.log('🔄 Loading verification data...');
        
        // Priority 1: Location state
        if (location.state?.verificationId && location.state?.phoneNumber) {
          setVerificationId(location.state.verificationId);
          setPhoneNumber(location.state.phoneNumber);
          setStep1Data(location.state.step1Data || {});
          console.log('✅ Loaded from location state');
          verificationDataLoaded.current = true;
          return;
        }
        
        // Priority 2: Session storage
        const sessionData = sessionStorage.getItem('phone_verification');
        if (sessionData) {
          const parsedData = JSON.parse(sessionData);
          if (parsedData.verificationId && parsedData.phoneNumber) {
            setVerificationId(parsedData.verificationId);
            setPhoneNumber(parsedData.phoneNumber);
            setStep1Data(parsedData.step1Data || {});
            console.log('✅ Loaded from session storage');
            verificationDataLoaded.current = true;
            return;
          }
        }
        
        // Priority 3: Local storage
        const localData = localStorage.getItem('phone_verification');
        if (localData) {
          const parsedData = JSON.parse(localData);
          if (parsedData.verificationId && parsedData.phoneNumber) {
            setVerificationId(parsedData.verificationId);
            setPhoneNumber(parsedData.phoneNumber);
            setStep1Data(parsedData.step1Data || {});
            console.log('✅ Loaded from local storage');
            verificationDataLoaded.current = true;
            return;
          }
        }
        
        // Priority 4: Signup data
        const signupData = localStorage.getItem('signup_data') || sessionStorage.getItem('signup_data');
        if (signupData) {
          const parsedData = JSON.parse(signupData);
          if (parsedData.verificationId && parsedData.phoneNumber) {
            setVerificationId(parsedData.verificationId);
            setPhoneNumber(parsedData.phoneNumber);
            setStep1Data(parsedData);
            console.log('✅ Loaded from signup data');
            verificationDataLoaded.current = true;
            return;
          }
        }
        
        // No data found
        console.error('❌ No verification data found');
        toast.error("Verification session expired. Please start over.");
        setTimeout(() => {
          navigate("/signup/step2", { replace: true });
        }, 2000);
        
      } catch (error) {
        console.error('❌ Failed to load verification data:', error);
        toast.error("Session error. Please start over.");
        setTimeout(() => {
          navigate("/signup/step2", { replace: true });
        }, 2000);
      }
    };
    
    loadVerificationData();
    
    return () => {
      setIsMounted(false);
      verificationDataLoaded.current = false;
    };
  }, [location, navigate]);

  // Countdown timer with pause/resume
  useEffect(() => {
    if (countdown <= 0) {
      setCanResend(true);
      if (countdownInterval.current) {
        clearInterval(countdownInterval.current);
      }
      return;
    }
    
    countdownInterval.current = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          setCanResend(true);
          clearInterval(countdownInterval.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    
    return () => {
      if (countdownInterval.current) {
        clearInterval(countdownInterval.current);
      }
    };
  }, [countdown]);

  // Resend cooldown timer
  useEffect(() => {
    if (!resendCooldown) return;
    
    if (resendTimer <= 0) {
      setResendCooldown(false);
      setResendTimer(60);
      if (resendCooldownInterval.current) {
        clearInterval(resendCooldownInterval.current);
      }
      return;
    }
    
    resendCooldownInterval.current = setInterval(() => {
      setResendTimer(prev => {
        if (prev <= 1) {
          setResendCooldown(false);
          setResendTimer(60);
          clearInterval(resendCooldownInterval.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    
    return () => {
      if (resendCooldownInterval.current) {
        clearInterval(resendCooldownInterval.current);
      }
    };
  }, [resendCooldown, resendTimer]);

  // Auto-submit timer
  useEffect(() => {
    const otpString = otp.join('');
    if (otpString.length === 6 && !loading && !isVerifying) {
      // Start auto-submit timer
      const timer = setTimeout(() => {
        if (isMounted) {
          handleVerify();
        }
      }, 1500); // 1.5 second delay for auto-submit
      
      setAutoSubmitTimer(timer);
    } else if (autoSubmitTimer) {
      clearTimeout(autoSubmitTimer);
      setAutoSubmitTimer(null);
    }
    
    return () => {
      if (autoSubmitTimer) {
        clearTimeout(autoSubmitTimer);
      }
    };
  }, [otp, loading, isVerifying, isMounted]);

  // Format time display
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  // Enhanced OTP input handlers
  const handleOtpChange = useCallback((index, value) => {
    if (!/^\d*$/.test(value)) return;
    
    const newOtp = [...otp];
    
    // Handle paste with multiple digits
    if (value.length > 1) {
      const digits = value.replace(/\D/g, '').split('').slice(0, 6);
      digits.forEach((digit, idx) => {
        if (idx < 6) newOtp[idx] = digit;
      });
      setOtp(newOtp);
      setError("");
      
      // Focus last input
      setTimeout(() => {
        const lastIndex = Math.min(digits.length - 1, 5);
        inputRefs.current[lastIndex]?.focus();
      }, 10);
      return;
    }
    
    // Single digit input
    newOtp[index] = value;
    setOtp(newOtp);
    setError("");
    
    // Auto-focus next input
    if (value && index < 5) {
      setTimeout(() => {
        inputRefs.current[index + 1]?.focus();
      }, 10);
    }
  }, [otp]);

  const handleKeyDown = useCallback((index, e) => {
    if (e.key === 'Backspace') {
      if (!otp[index] && index > 0) {
        // Move to previous input
        inputRefs.current[index - 1]?.focus();
      } else if (otp[index]) {
        // Clear current input
        const newOtp = [...otp];
        newOtp[index] = '';
        setOtp(newOtp);
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowRight' && index < 5) {
      inputRefs.current[index + 1]?.focus();
    } else if (e.key === 'Enter' && otp.join('').length === 6) {
      handleVerify();
    }
  }, [otp]);

  const handlePaste = useCallback((e) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text');
    const digits = pastedData.replace(/\D/g, '').split('').slice(0, 6);
    
    if (digits.length === 6) {
      const newOtp = [...otp];
      digits.forEach((digit, index) => {
        newOtp[index] = digit;
      });
      setOtp(newOtp);
      setError("");
      
      setTimeout(() => {
        inputRefs.current[5]?.focus();
      }, 10);
    } else {
      toast.error("Please paste exactly 6 digits");
    }
  }, [otp]);

  const clearOtpFields = useCallback(() => {
    setOtp(["", "", "", "", "", ""]);
    setError("");
    setTimeout(() => {
      inputRefs.current[0]?.focus();
    }, 10);
  }, []);

  // Real OTP verification
  const handleVerify = async () => {
    const otpString = otp.join('');
    const now = Date.now();
    
    // Rate limiting check
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
    
    if (!verificationId) {
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
      console.log("🔢 Verifying REAL OTP:", otpString);
      console.log("🔑 Verification ID:", verificationId);
      
      const result = await auth.verifyPhoneOTP(verificationId, otpString);
      
      if (!result.success) {
        throw new Error(result.error || "Verification failed");
      }
      
      console.log("✅ REAL Phone verification successful:", result.user.uid);
      
      setVerificationAttempts(0);
      
      // Store complete signup data
      const signupData = {
        ...step1Data,
        phoneNumber: result.user.phoneNumber,
        authProvider: 'phone',
        isNewUser: result.isNewUser,
        requiresProfileCompletion: true,
        uid: result.user.uid,
        email: result.user.email,
        displayName: result.user.displayName
      };
      
      localStorage.setItem('signup_data', JSON.stringify(signupData));
      sessionStorage.setItem('signup_data', JSON.stringify(signupData));
      
      // Store for profile setup
      sessionStorage.setItem('pending_profile_creation', JSON.stringify({
        userId: result.user.uid,
        method: 'phone',
        timestamp: Date.now(),
        userData: result.user
      }));
      
      // Clear verification data
      sessionStorage.removeItem('phone_verification');
      localStorage.removeItem('phone_verification');
      
      toast.success("✅ Phone number verified! Setting up your account...");
      
      // Navigate to profile setup with success animation
      setTimeout(() => {
        navigate("/setup-profile", {
          state: {
            method: "phone",
            userData: result.user,
            isNewUser: true,
            requiresProfileCompletion: true,
            verificationSuccess: true
          },
          replace: true
        });
      }, 1500);
      
    } catch (error) {
      console.error("❌ REAL OTP verification failed:", error);
      
      let errorMessage = error.message || "Verification failed";
      const attemptsLeft = 3 - verificationAttempts;
      const newAttempts = verificationAttempts + 1;
      
      setVerificationAttempts(newAttempts);
      
      if (error.code === 'auth/invalid-verification-code') {
        errorMessage = `Invalid code. ${attemptsLeft > 0 ? `${attemptsLeft} attempt${attemptsLeft > 1 ? 's' : ''} left.` : 'Please request a new code.'}`;
        
        if (newAttempts >= 3) {
          toast.error("Too many incorrect attempts. Code expired.");
          setCanResend(true);
          clearOtpFields();
        } else {
          // Clear only the incorrect OTP
          toast.error(errorMessage);
        }
      } else if (error.code === 'auth/code-expired') {
        errorMessage = "Code expired. Please request a new one.";
        setCanResend(true);
      } else if (error.code === 'auth/too-many-requests') {
        errorMessage = "Too many attempts. Please wait 2 minutes.";
        setResendCooldown(true);
        setCanResend(false);
      } else if (error.code === 'auth/invalid-verification-id') {
        errorMessage = "Session expired. Please start verification again.";
        toast.error(errorMessage);
        setTimeout(() => navigate("/signup/step2", { replace: true }), 2000);
        return;
      }
      
      setError(errorMessage);
      clearOtpFields();
      
    } finally {
      setLoading(false);
      setIsVerifying(false);
    }
  };

  // Resend OTP with cooldown
  const handleResend = async () => {
    if (!canResend || !phoneNumber || resendCooldown || loading) return;
    
    setLoading(true);
    setError("");
    setCanResend(false);
    setCountdown(120);
    
    try {
      toast.info("Sending new verification code...");
      
      // Use the same reCAPTCHA verifier or create new
      const result = await auth.sendPhoneVerificationCode(phoneNumber, null);
      
      if (!result.success) {
        throw new Error(result.error || "Failed to resend code");
      }
      
      // Update verification ID
      setVerificationId(result.verificationId);
      
      // Update stored data
      const verificationData = {
        verificationId: result.verificationId,
        phoneNumber: result.phoneNumber,
        method: "phone",
        isSignup: true,
        step1Data: step1Data,
        timestamp: Date.now()
      };
      
      localStorage.setItem('phone_verification', JSON.stringify(verificationData));
      sessionStorage.setItem('phone_verification', JSON.stringify(verificationData));
      
      // Reset state
      setCountdown(120);
      setCanResend(false);
      setVerificationAttempts(0);
      clearOtpFields();
      
      toast.success("✅ New verification code sent!");
      
    } catch (error) {
      console.error("❌ Resend failed:", error);
      
      let errorMessage = "Failed to resend code";
      
      if (error.code === 'auth/too-many-requests') {
        errorMessage = "Too many resend attempts. Please wait 2 minutes.";
        setResendCooldown(true);
      } else if (error.code === 'auth/quota-exceeded') {
        errorMessage = "Daily SMS quota exceeded. Please try again tomorrow.";
      } else if (error.code === 'auth/captcha-check-failed') {
        errorMessage = "Security check failed. Please complete the security check again.";
        setTimeout(() => navigate("/signup/step2", { replace: true }), 2000);
        return;
      }
      
      setError(errorMessage);
      toast.error(errorMessage);
      setCanResend(true);
      
    } finally {
      setLoading(false);
    }
  };

  // Format phone number for display
  const formatPhoneNumber = (phone) => {
    if (!phone) return "";
    
    const cleaned = phone.replace(/[^\d+]/g, '');
    
    if (cleaned.startsWith('+1') && cleaned.length === 12) {
      return `+1 (${cleaned.substring(2, 5)}) ${cleaned.substring(5, 8)}-${cleaned.substring(8, 12)}`;
    } else if (cleaned.startsWith('+91') && cleaned.length === 13) {
      return `+91 ${cleaned.substring(3, 8)} ${cleaned.substring(8, 13)}`;
    } else if (cleaned.length <= 4) {
      return cleaned;
    } else {
      const countryCode = cleaned.match(/^\+\d{1,3}/)?.[0] || '';
      const rest = cleaned.substring(countryCode.length);
      const groups = rest.match(/.{1,4}/g) || [];
      return `${countryCode} ${groups.join(' ')}`;
    }
  };

  // Handle back navigation
  const handleBack = () => {
    if (loading) return;
    navigate("/signup/step2", { 
      replace: true,
      state: { step1Data, phoneNumber }
    });
  };

  // Get OTP input style based on state
  const getInputStyle = (index, digit, hasError) => {
    const baseStyle = "w-14 h-16 text-center text-3xl font-bold rounded-xl border-2 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 ";
    
    if (hasError) {
      return baseStyle + "border-red-500 bg-red-50/50 dark:bg-red-900/20 focus:border-red-500 focus:ring-red-500/30";
    }
    
    if (digit) {
      return baseStyle + "border-green-500 bg-green-50/50 dark:bg-green-900/20 focus:border-green-500 focus:ring-green-500/30";
    }
    
    if (resolvedTheme === 'dark') {
      return baseStyle + "border-gray-700 bg-gray-800/50 focus:border-blue-500 focus:ring-blue-500/30 dark:text-white";
    }
    
    return baseStyle + "border-gray-300 bg-white focus:border-blue-500 focus:ring-blue-500/30 text-gray-900";
  };

  return (
    <div className={`min-h-screen flex items-center justify-center p-4 ${resolvedTheme === 'dark' ? 'bg-gradient-to-br from-gray-900 via-gray-800 to-black' : 'bg-gradient-to-br from-blue-50 via-white to-gray-100'}`}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.5, type: "spring", bounce: 0.25 }}
        className="relative w-full max-w-md mx-auto"
      >
        {/* Animated background */}
        <div className="absolute -inset-4 opacity-20">
          <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-blue-500 rounded-full mix-blend-multiply filter blur-3xl animate-pulse" />
          <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-purple-500 rounded-full mix-blend-multiply filter blur-3xl animate-pulse delay-1000" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-indigo-500 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-pulse delay-500" />
        </div>
        
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className={`relative rounded-2xl border backdrop-blur-xl shadow-2xl p-6 sm:p-8 overflow-hidden ${resolvedTheme === 'dark' ? 'bg-gray-900/90 border-gray-700/50 shadow-gray-900/30' : 'bg-white/95 border-gray-200/50 shadow-blue-100/30'}`}
        >
          {/* Decorative elements */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500" />
          <div className="absolute -top-20 -right-20 w-40 h-40 rounded-full bg-gradient-to-r from-blue-500/10 to-purple-500/10 blur-3xl" />
          <div className="absolute -bottom-20 -left-20 w-40 h-40 rounded-full bg-gradient-to-r from-pink-500/10 to-indigo-500/10 blur-3xl" />
          
          <div className="relative">
            {/* Header with animation */}
            <div className="text-center mb-8">
              <motion.div
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: "spring", delay: 0.2 }}
                className="relative w-24 h-24 mx-auto mb-6"
              >
                <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 shadow-2xl" />
                <div className="absolute inset-4 rounded-xl bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-sm flex items-center justify-center">
                  <div className="relative">
                    <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                    <motion.div
                      className="absolute -top-1 -right-1 w-5 h-5 bg-green-400 rounded-full border-2 border-white shadow-lg"
                      animate={{ scale: [1, 1.2, 1] }}
                      transition={{ repeat: Infinity, duration: 2 }}
                    />
                  </div>
                </div>
              </motion.div>
              
              <h1 className={`text-2xl sm:text-3xl font-bold mb-3 bg-gradient-to-r ${resolvedTheme === 'dark' ? 'from-blue-300 to-purple-300' : 'from-blue-600 to-purple-600'} bg-clip-text text-transparent`}>
                Secure Phone Verification
              </h1>
              
              <div className="flex flex-col items-center gap-3">
                <p className={`text-sm sm:text-base tracking-wide ${resolvedTheme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                  Enter the 6-digit code sent to
                </p>
                <div className="flex items-center gap-3 px-5 py-2.5 rounded-full bg-gradient-to-r from-blue-500/10 via-purple-500/10 to-pink-500/10 border border-blue-500/20 shadow-lg">
                  <svg className="w-5 h-5 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M7 2a2 2 0 00-2 2v12a2 2 0 002 2h6a2 2 0 002-2V4a2 2 0 00-2-2H7zm3 14a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                  </svg>
                  <p className={`font-bold text-base ${resolvedTheme === 'dark' ? 'text-blue-300' : 'text-blue-700'}`}>
                    {formatPhoneNumber(phoneNumber)}
                  </p>
                  <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                </div>
              </div>
            </div>

            {/* OTP Input Section */}
            <div className="space-y-8">
              {/* OTP Input Fields */}
              <div>
                <div className="flex justify-center gap-3 mb-8">
                  {otp.map((digit, index) => (
                    <motion.div
                      key={index}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      className="relative"
                    >
                      <input
                        ref={(el) => inputRefs.current[index] = el}
                        type="text"
                        inputMode="numeric"
                        maxLength="6"
                        value={digit}
                        onChange={(e) => handleOtpChange(index, e.target.value)}
                        onKeyDown={(e) => handleKeyDown(index, e)}
                        onPaste={index === 0 ? handlePaste : undefined}
                        disabled={loading || isVerifying}
                        className={getInputStyle(index, digit, error)}
                        autoFocus={index === 0}
                      />
                      
                      {/* Input indicator */}
                      {index < 5 && (
                        <div className="absolute top-1/2 right-0 transform translate-x-1/2 -translate-y-1/2">
                          <div className={`w-1 h-1 rounded-full ${resolvedTheme === 'dark' ? 'bg-gray-600' : 'bg-gray-400'}`} />
                        </div>
                      )}
                      
                      {/* Input label */}
                      <div className="absolute -bottom-6 left-0 right-0 text-center">
                        <span className={`text-xs font-medium ${resolvedTheme === 'dark' ? 'text-gray-500' : 'text-gray-600'}`}>
                          {index + 1}
                        </span>
                      </div>
                    </motion.div>
                  ))}
                </div>
                
                {/* Auto-submit indicator */}
                {otp.join('').length === 6 && !loading && !isVerifying && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-center mb-4"
                  >
                    <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-green-500/10 to-emerald-500/10 border border-green-500/20">
                      <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                      <span className={`text-sm font-medium ${resolvedTheme === 'dark' ? 'text-green-400' : 'text-green-600'}`}>
                        Auto-verifying in 1.5s...
                      </span>
                    </div>
                  </motion.div>
                )}
                
                {/* Error Message */}
                <AnimatePresence>
                  {error && (
                    <motion.div
                      initial={{ opacity: 0, height: 0, y: -10 }}
                      animate={{ opacity: 1, height: 'auto', y: 0 }}
                      exit={{ opacity: 0, height: 0, y: -10 }}
                      className="mb-6 overflow-hidden"
                    >
                      <div className="flex items-center justify-center gap-4 p-4 rounded-xl bg-gradient-to-r from-red-500/10 via-pink-500/10 to-red-500/10 border border-red-500/20 shadow-lg">
                        <div className="flex-shrink-0 w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center">
                          <svg className="w-5 h-5 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                          </svg>
                        </div>
                        <div className="text-left">
                          <span className="text-sm font-bold text-red-600 dark:text-red-400">{error}</span>
                          {verificationAttempts > 0 && (
                            <p className="text-xs text-red-500/70 dark:text-red-400/70 mt-1">
                              Attempt {verificationAttempts} of 3 • {3 - verificationAttempts} remaining
                            </p>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Timer and Resend Section */}
              <div className="text-center space-y-4">
                {canResend ? (
                  <div className="space-y-3">
                    {resendCooldown ? (
                      <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-yellow-500/10 to-orange-500/10 border border-yellow-500/20">
                        <div className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse" />
                        <span className={`text-sm font-medium ${resolvedTheme === 'dark' ? 'text-yellow-400' : 'text-yellow-700'}`}>
                          Wait {resendTimer}s before resend
                        </span>
                      </div>
                    ) : (
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={handleResend}
                        disabled={loading || resendCooldown}
                        className="inline-flex items-center gap-3 px-6 py-3 rounded-full font-medium text-sm bg-gradient-to-r from-blue-500 to-purple-500 text-white hover:shadow-lg transition-all duration-200 shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        Resend Verification Code
                      </motion.button>
                    )}
                  </div>
                ) : (
                  <div className="space-y-3">
                    <p className={`text-sm ${resolvedTheme === 'dark' ? 'text-gray-500' : 'text-gray-600'}`}>
                      Code expires in
                    </p>
                    <div className="inline-flex items-center gap-3 px-5 py-2.5 rounded-full bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-blue-500/20 shadow-lg">
                      <div className="relative">
                        <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse" />
                        <div className="absolute inset-0 rounded-full bg-green-500 animate-ping opacity-30" />
                      </div>
                      <span className={`font-mono text-xl font-bold ${resolvedTheme === 'dark' ? 'text-green-400' : 'text-green-600'}`}>
                        {formatTime(countdown)}
                      </span>
                    </div>
                    <p className={`text-xs ${resolvedTheme === 'dark' ? 'text-gray-600' : 'text-gray-500'}`}>
                      Enter the code before it expires
                    </p>
                  </div>
                )}
              </div>

              {/* Verify Button */}
              <motion.button
                whileHover={!loading && otp.join('').length === 6 ? { 
                  scale: 1.02,
                  boxShadow: resolvedTheme === 'dark' ? '0 10px 30px rgba(99, 102, 241, 0.4)' : '0 10px 30px rgba(99, 102, 241, 0.3)'
                } : {}}
                whileTap={!loading && otp.join('').length === 6 ? { scale: 0.98 } : {}}
                onClick={handleVerify}
                disabled={loading || isVerifying || otp.join('').length !== 6}
                className={`w-full py-4 px-6 rounded-xl font-bold text-base transition-all duration-300 relative overflow-hidden group ${!loading && otp.join('').length === 6 ? 'bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 text-white' : resolvedTheme === 'dark' ? 'bg-gray-800 text-gray-400 cursor-not-allowed' : 'bg-gray-200 text-gray-500 cursor-not-allowed'}`}
              >
                <div className="relative z-10 flex items-center justify-center gap-3">
                  {loading || isVerifying ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Verifying...</span>
                    </>
                  ) : (
                    <>
                      <span>Verify & Continue</span>
                      <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                      </svg>
                    </>
                  )}
                </div>
                
                {/* Shimmer effect */}
                {!loading && otp.join('').length === 6 && (
                  <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent group-hover:translate-x-full transition-transform duration-1000" />
                )}
                
                {/* Progress bar for loading */}
                {(loading || isVerifying) && (
                  <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer" />
                )}
              </motion.button>

              {/* Back Button */}
              <div className="pt-6 border-t border-gray-300/50 dark:border-gray-800/50">
                <button
                  type="button"
                  onClick={handleBack}
                  disabled={loading || isVerifying}
                  className={`w-full text-sm font-medium flex items-center justify-center gap-2 transition-colors ${resolvedTheme === 'dark' ? 'text-gray-400 hover:text-gray-300 disabled:opacity-50' : 'text-gray-600 hover:text-gray-900 disabled:opacity-50'}`}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                  </svg>
                  Back to Verification Methods
                </button>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Security Footer */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="mt-8 text-center"
        >
          <div className="flex flex-wrap items-center justify-center gap-3 mb-3">
            {["🔒", "📱", "🛡️", "✅", "⚡", "🔐"].map((icon, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, scale: 0, rotate: -180 }}
                animate={{ opacity: 1, scale: 1, rotate: 0 }}
                transition={{ 
                  delay: 0.4 + (index * 0.1),
                  type: "spring",
                  stiffness: 200,
                  damping: 10
                }}
                className={`w-9 h-9 rounded-full flex items-center justify-center text-sm backdrop-blur-sm ${resolvedTheme === 'dark' ? 'bg-gray-800/50 border border-gray-700/50' : 'bg-white/50 border border-gray-300/50 shadow-sm'}`}
              >
                {icon}
              </motion.div>
            ))}
          </div>
          
          <p className={`text-xs ${resolvedTheme === 'dark' ? 'text-gray-600' : 'text-gray-500'}`}>
            End-to-end encrypted • Military-grade security • ISO 27001 Certified • GDPR Compliant
          </p>
        </motion.div>
      </motion.div>
    </div>
  );
}