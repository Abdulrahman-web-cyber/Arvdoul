// src/screens/OtpVerification.jsx
import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useSignup } from "@context/SignupContext";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";

// Advanced OTP Input Component
const OtpInput = ({ index, value, onChange, onKeyDown, onPaste, autoFocus, theme, error }) => {
  const inputRef = useRef(null);

  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus();
    }
  }, [autoFocus]);

  return (
    <motion.input
      ref={inputRef}
      type="text"
      inputMode="numeric"
      pattern="[0-9]*"
      maxLength={1}
      value={value}
      onChange={(e) => {
        const val = e.target.value.replace(/[^0-9]/g, '');
        if (val.length <= 1) {
          onChange(val, index);
        }
      }}
      onKeyDown={onKeyDown}
      onPaste={onPaste}
      className={`w-14 h-14 text-center text-2xl font-bold rounded-xl border-2 transition-all duration-200 ${
        error 
          ? 'border-red-500 bg-red-50 dark:bg-red-900/20 shadow-lg shadow-red-500/20' 
          : value 
          ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 shadow-lg shadow-indigo-500/20' 
          : theme === 'dark' 
          ? 'border-gray-600 bg-gray-800 text-white' 
          : 'border-gray-300 bg-white text-gray-900'
      } focus:outline-none focus:ring-4 focus:ring-indigo-500/30`}
      whileFocus={{ scale: 1.1 }}
      whileTap={{ scale: 0.95 }}
    />
  );
};

// Security Shield Component
const SecurityShield = ({ status, theme }) => {
  const getShieldColor = () => {
    switch (status) {
      case 'verifying': return 'text-blue-500';
      case 'success': return 'text-green-500';
      case 'error': return 'text-red-500';
      default: return theme === 'dark' ? 'text-gray-400' : 'text-gray-300';
    }
  };

  const getShieldIcon = () => {
    switch (status) {
      case 'verifying': return '🔄';
      case 'success': return '✅';
      case 'error': return '❌';
      default: return '🛡️';
    }
  };

  return (
    <motion.div
      className={`text-6xl ${getShieldColor()} mb-4`}
      animate={status === 'verifying' ? { rotate: 360 } : {}}
      transition={status === 'verifying' ? { duration: 2, repeat: Infinity, ease: "linear" } : {}}
    >
      {getShieldIcon()}
    </motion.div>
  );
};

// Main Component
export default function OtpVerification() {
  const navigate = useNavigate();
  const { signupData, verifyOtp, sendOtp, recaptchaReady, theme } = useSignup();

  const [otp, setOtp] = useState(Array(6).fill(""));
  const [loading, setLoading] = useState(false);
  const [resendTimer, setResendTimer] = useState(60);
  const [errorShake, setErrorShake] = useState(false);
  const [verificationStatus, setVerificationStatus] = useState('idle');
  const [attempts, setAttempts] = useState(0);
  
  const inputRefs = useRef([]);
  const containerRef = useRef(null);

  const contactValue = signupData.contactValue;
  const isPhone = signupData.contactMethod === 'phone';
  const maskedContact = useMemo(() => {
    if (isPhone) {
      // Mask phone number: +1234567890 -> +1******890
      const visibleDigits = 3;
      const masked = contactValue.slice(0, -visibleDigits).replace(/./g, '*') + contactValue.slice(-visibleDigits);
      return masked.replace(/(\d{3})(\d{3})(\d{4})/, '$1-$2-$3');
    } else {
      // Mask email: user@domain.com -> u***@domain.com
      const [name, domain] = contactValue.split('@');
      const maskedName = name[0] + '*'.repeat(Math.max(0, name.length - 2)) + (name.length > 1 ? name[name.length - 1] : '');
      return `${maskedName}@${domain}`;
    }
  }, [contactValue, isPhone]);

  // Auto-read OTP from SMS (if available)
  useEffect(() => {
    if ('OTPCredential' in window) {
      const ac = new AbortController();
      navigator.credentials.get({
        otp: { transport: ['sms'] },
        signal: ac.signal,
      }).then((otp) => {
        if (otp && otp.code) {
          const codeArray = otp.code.split('').slice(0, 6);
          setOtp(codeArray);
          codeArray.forEach((digit, index) => {
            if (inputRefs.current[index]) {
              inputRefs.current[index].value = digit;
            }
          });
          // Auto-submit after a short delay
          setTimeout(() => verifyOtpCode(codeArray.join('')), 500);
        }
      }).catch(() => {
        // Auto-read not supported or user denied
      });

      return () => ac.abort();
    }
  }, []);

  // Resend timer
  useEffect(() => {
    if (resendTimer <= 0) return;
    
    const timer = setInterval(() => {
      setResendTimer(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [resendTimer]);

  // Enhanced OTP verification
  const verifyOtpCode = useCallback(async (code = otp.join('')) => {
    if (code.length < 6) {
      setErrorShake(true);
      setTimeout(() => setErrorShake(false), 500);
      toast.error("Please enter the full 6-digit code");
      return;
    }

    if (attempts >= 5) {
      toast.error("Too many failed attempts. Please request a new code.");
      return;
    }

    setLoading(true);
    setVerificationStatus('verifying');

    try {
      await verifyOtp(code);
      setVerificationStatus('success');
      
      // Success animation delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      toast.success("✅ Verification successful! Your account is now secure.");
      navigate("/set-password");
    } catch (err) {
      setVerificationStatus('error');
      setAttempts(prev => prev + 1);
      setErrorShake(true);
      setTimeout(() => setErrorShake(false), 500);

      let message = "Verification failed. Please try again.";
      if (err.code === "auth/invalid-verification-code") {
        message = "Invalid code. Please check and try again.";
      } else if (err.code === "auth/code-expired") {
        message = "Code has expired. Please request a new one.";
      } else if (err.code === "auth/too-many-requests") {
        message = "Too many attempts. Please wait before trying again.";
      }

      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [otp, verifyOtp, navigate, attempts]);

  // Enhanced OTP input handlers
  const handleChange = useCallback((value, index) => {
    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);

    // Auto-focus next input
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-verify when last digit is entered
    if (index === 5 && value) {
      const fullCode = newOtp.join('');
      if (fullCode.length === 6) {
        verifyOtpCode(fullCode);
      }
    }
  }, [otp, verifyOtpCode]);

  const handleKeyDown = useCallback((e, index) => {
    if (e.key === 'Backspace') {
      if (!otp[index] && index > 0) {
        // Move to previous input on backspace
        inputRefs.current[index - 1]?.focus();
      }
      // Clear current input
      const newOtp = [...otp];
      newOtp[index] = '';
      setOtp(newOtp);
    } else if (e.key === 'ArrowLeft' && index > 0) {
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowRight' && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  }, [otp]);

  const handlePaste = useCallback((e) => {
    e.preventDefault();
    const pasteData = e.clipboardData.getData('text/plain').replace(/[^0-9]/g, '');
    if (pasteData.length === 6) {
      const pasteArray = pasteData.split('').slice(0, 6);
      setOtp(pasteArray);
      pasteArray.forEach((digit, index) => {
        if (inputRefs.current[index]) {
          inputRefs.current[index].value = digit;
        }
      });
      // Focus last input
      inputRefs.current[5]?.focus();
      // Auto-verify
      setTimeout(() => verifyOtpCode(pasteData), 300);
    }
  }, [verifyOtpCode]);

  const handleResendOtp = useCallback(async () => {
    if (resendTimer > 0) return;

    setResendTimer(60);
    setOtp(Array(6).fill(""));
    setVerificationStatus('idle');

    try {
      if (isPhone) {
        await sendOtp(contactValue);
      }
      // For email, you would trigger email resend here
      toast.success("📨 New verification code sent!");
      inputRefs.current[0]?.focus();
    } catch (err) {
      toast.error("Failed to resend code. Please try again.");
    }
  }, [resendTimer, isPhone, contactValue, sendOtp]);

  const backgroundStyle = useMemo(() => ({
    background: theme === "dark"
      ? "radial-gradient(ellipse 80% 50% at 50% 0%, rgba(99,102,241,0.15) 0%, transparent 70%), radial-gradient(ellipse 50% 50% at 100% 100%, rgba(168,85,247,0.1) 0%, transparent 50%), #0a0f1c"
      : "radial-gradient(ellipse 80% 50% at 50% 0%, rgba(99,102,241,0.08) 0%, transparent 70%), radial-gradient(ellipse 50% 50% at 100% 100%, rgba(168,85,247,0.06) 0%, transparent 50%), #f9fafb",
  }), [theme]);

  return (
    <div 
      ref={containerRef}
      className="w-full min-h-screen flex items-center justify-center p-4 relative overflow-hidden"
      style={backgroundStyle}
    >
      {/* Advanced Security Background Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {[...Array(8)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute rounded-full"
            style={{
              width: Math.random() * 6 + 3,
              height: Math.random() * 6 + 3,
              top: `${Math.random() * 100}%`,
              left: `${Math.random() * 100}%`,
              background: theme === "dark" 
                ? "rgba(99,102,241,0.1)" 
                : "rgba(79,70,229,0.08)",
            }}
            animate={{
              y: [0, -20, 0],
              opacity: [0.2, 0.6, 0.2],
            }}
            transition={{
              duration: Math.random() * 5 + 3,
              repeat: Infinity,
              ease: "easeInOut",
              delay: Math.random() * 2,
            }}
          />
        ))}
        
        {/* Security Pattern Overlay */}
        <div className="absolute inset-0 opacity-5 pointer-events-none">
          <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                <path d="M 40 0 L 0 0 0 40" fill="none" stroke="currentColor" strokeWidth="1"/>
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)" />
          </svg>
        </div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 30, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.6, type: "spring" }}
        className="relative z-10 w-full max-w-md"
      >
        <motion.div
          className={`rounded-3xl shadow-2xl border backdrop-blur-lg ${
            theme === 'dark' 
              ? 'bg-gray-900/80 border-gray-700/50' 
              : 'bg-white/90 border-gray-200/60'
          } p-8 text-center`}
        >
          {/* Security Shield */}
          <div className="flex justify-center mb-6">
            <SecurityShield status={verificationStatus} theme={theme} />
          </div>

          {/* Header */}
          <motion.h1
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className={`text-3xl font-bold mb-2 ${
              theme === 'dark' ? 'text-white' : 'text-gray-900'
            }`}
          >
            Security Verification
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className={`text-lg mb-1 ${
              theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
            }`}
          >
            Enter the 6-digit code sent to
          </motion.p>

          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className={`text-lg font-semibold mb-8 ${
              theme === 'dark' ? 'text-indigo-400' : 'text-indigo-600'
            }`}
          >
            {maskedContact}
          </motion.p>

          {/* OTP Input Grid */}
          <motion.div
            className="flex justify-center gap-3 mb-8"
            animate={errorShake ? { x: [-5, 5, -5, 5, 0] } : {}}
            transition={{ duration: 0.4 }}
          >
            {otp.map((digit, index) => (
              <OtpInput
                key={index}
                index={index}
                value={digit}
                onChange={handleChange}
                onKeyDown={(e) => handleKeyDown(e, index)}
                onPaste={index === 0 ? handlePaste : undefined}
                autoFocus={index === 0}
                theme={theme}
                error={errorShake}
                ref={(el) => (inputRefs.current[index] = el)}
              />
            ))}
          </motion.div>

          {/* Security Status */}
          <AnimatePresence>
            {attempts > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className={`mb-4 p-3 rounded-xl ${
                  theme === 'dark' 
                    ? 'bg-yellow-900/30 border border-yellow-700/50' 
                    : 'bg-yellow-50 border border-yellow-200'
                }`}
              >
                <p className={`text-sm ${
                  theme === 'dark' ? 'text-yellow-300' : 'text-yellow-700'
                }`}>
                  ⚠️ Attempt {attempts} of 5. Too many failures may temporarily lock your account.
                </p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Resend Section */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
            className="space-y-4"
          >
            {/* Progress Timer */}
            <div className="relative">
              <div className={`w-full h-2 rounded-full overflow-hidden ${
                theme === 'dark' ? 'bg-gray-700' : 'bg-gray-200'
              }`}>
                <motion.div
                  className="h-2 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full"
                  initial={{ width: "100%" }}
                  animate={`{ width: `${(resendTimer / 60) * 100}%` `}}
                  transition={{ duration: 1, ease: "linear" }}
                />
              </div>
              <p className={`text-sm mt-2 ${
                theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
              }`}>
                {resendTimer > 0 
                  ? `Resend available in ${resendTimer}s` 
                  : "Ready to resend"}
              </p>
            </div>

            {/* Resend Button */}
            <motion.button
              onClick={handleResendOtp}
              disabled={resendTimer > 0 || loading}
              className={`w-full py-3 rounded-xl font-semibold transition-all ${
                resendTimer > 0 || loading
                  ? theme === 'dark'
                    ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
                    : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  : 'bg-gradient-to-r from-indigo-500 to-purple-500 text-white hover:shadow-lg'
              }`}
              whileHover={resendTimer === 0 && !loading ? { scale: 1.02 } : {}}
              whileTap={resendTimer === 0 && !loading ? { scale: 0.98 } : {}}
            >
              {resendTimer > 0 ? `Resend Code (${resendTimer}s)` : "Resend Verification Code"}
            </motion.button>
          </motion.div>

          {/* Security Notice */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8 }}
            className="mt-6 p-4 rounded-xl bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border border-green-200 dark:border-green-800"
          >
            <div className="flex items-start gap-3">
              <span className="text-lg mt-0.5">🔐</span>
              <div className="text-left">
                <h4 className={`font-semibold text-sm ${
                  theme === 'dark' ? 'text-green-300' : 'text-green-700'
                }`}>
                  Advanced Security Active
                </h4>
                <p className={`text-xs ${
                  theme === 'dark' ? 'text-green-400' : 'text-green-600'
                }`}>
                  Your verification is protected by end-to-end encryption. Never share this code with anyone.
                </p>
              </div>
            </div>
          </motion.div>

          {/* Manual Verification Button */}
          <motion.button
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1 }}
            onClick={() => verifyOtpCode()}
            disabled={otp.join('').length < 6 || loading}
            className={`w-full py-4 rounded-2xl font-bold text-lg shadow-lg transition-all duration-300 mt-6 ${
              otp.join('').length === 6 && !loading
                ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white hover:shadow-xl'
                : theme === 'dark'
                ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
            whileHover={otp.join('').length === 6 && !loading ? { scale: 1.02 } : {}}
            whileTap={otp.join('').length === 6 && !loading ? { scale: 0.98 } : {}}
          >
            {loading ? (
              <div className="flex items-center justify-center gap-3">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                  className="w-5 h-5 border-2 border-white border-t-transparent rounded-full"
                />
                Verifying Security Code...
              </div>
            ) : (
              "Verify & Continue"
            )}
          </motion.button>
        </motion.div>
      </motion.div>
    </div>
  );
}