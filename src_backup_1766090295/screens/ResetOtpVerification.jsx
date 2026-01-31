\/\/ src/screens/ResetOtpVerification.jsx
import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { Shield, RefreshCw, Lock, CheckCircle, AlertCircle, Smartphone, Clock, Key } from "lucide-react";

\/\/ Advanced OTP Input Component with Security Features
const SecureOtpInput = ({ index, value, onChange, onKeyDown, autoFocus, theme, error, disabled }) => {
  const inputRef = useRef(null);
  const [isActive, setIsActive] = useState(false);

  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus();
    }
  }, [autoFocus]);

  return (
    <motion.div
      className="relative"
      whileHover={!disabled ? { scale: 1.05 } : {}}
      whileTap={!disabled ? { scale: 0.95 } : {}}
    >
      <input
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
        onFocus={() => setIsActive(true)}
        onBlur={() => setIsActive(false)}
        disabled={disabled}
        className={`w-16 h-16 text-center text-3xl font-bold rounded-xl border-3 transition-all duration-200 ${
          error 
            ? 'border-red-500 bg-red-50 dark:bg-red-900/20 shadow-lg shadow-red-500/20' 
            : value 
            ? 'border-green-500 bg-green-50 dark:bg-green-900/20 shadow-lg shadow-green-500/20' 
            : isActive
            ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 shadow-lg shadow-indigo-500/20'
            : theme === 'dark' 
            ? 'border-gray-700 bg-gray-800 text-white' 
            : 'border-gray-300 bg-white text-gray-900'
        } focus:outline-none focus:ring-4 focus:ring-indigo-500/30 disabled:opacity-50 disabled:cursor-not-allowed`}
      />
      
      {/* Security dot indicator */}
      {value && (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-white dark:border-gray-900"
        />
      )}
    </motion.div>
  );
};

\/\/ Advanced Security Shield with Real-time Status
const PasswordResetShield = ({ status, attempts, theme }) => {
  const getStatusConfig = () => {
    switch (status) {
      case 'pending':
        return { 
          icon: '🔐', 
          color: 'text-blue-500',
          bg: 'from-blue-500/10 to-blue-600/10',
          border: 'border-blue-500/30',
          text: 'Verification Required'
        };
      case 'verifying':
        return { 
          icon: '⏳', 
          color: 'text-yellow-500',
          bg: 'from-yellow-500/10 to-amber-600/10',
          border: 'border-yellow-500/30',
          text: 'Verifying Security Code'
        };
      case 'success':
        return { 
          icon: '✅', 
          color: 'text-green-500',
          bg: 'from-green-500/10 to-emerald-600/10',
          border: 'border-green-500/30',
          text: 'Identity Verified'
        };
      case 'error':
        return { 
          icon: '❌', 
          color: 'text-red-500',
          bg: 'from-red-500/10 to-rose-600/10',
          border: 'border-red-500/30',
          text: 'Verification Failed'
        };
      case 'locked':
        return { 
          icon: '🔒', 
          color: 'text-gray-500',
          bg: 'from-gray-500/10 to-gray-600/10',
          border: 'border-gray-500/30',
          text: 'Account Temporarily Locked'
        };
      default:
        return { 
          icon: '🛡️', 
          color: 'text-indigo-500',
          bg: 'from-indigo-500/10 to-purple-600/10',
          border: 'border-indigo-500/30',
          text: 'Security Verification'
        };
    }
  };

  const config = getStatusConfig();

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-2xl p-6 border-2 bg-gradient-to-r ${config.bg} ${config.border} transition-all duration-500`}
      whileHover={{ scale: 1.02 }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <motion.div
            className={`text-4xl ${config.color}`}
            animate={status === 'verifying' ? { rotate: 360 } : {}}
            transition={status === 'verifying' ? { duration: 2, repeat: Infinity, ease: "linear" } : {}}
          >
            {config.icon}
          </motion.div>
          <div>
            <div className={`text-lg font-bold ${config.color}`}>
              {config.text}
            </div>
            <div className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
              {attempts > 0 && `Attempt ${attempts} of 5`}
            </div>
          </div>
        </div>
        
        {attempts > 0 && (
          <div className={`px-3 py-1 rounded-full text-xs font-bold ${
            attempts >= 4 
              ? 'bg-red-500/20 text-red-600 dark:text-red-400' 
              : 'bg-yellow-500/20 text-yellow-600 dark:text-yellow-400'
          }`}>
            {attempts >= 4 ? 'High Risk' : 'Monitor'}
          </div>
        )}
      </div>
      
      {/* Security progress bar */}
      <div className="mt-4">
        <div className="flex justify-between text-xs mb-1">
          <span className={theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}>Security Level</span>
          <span className={`font-bold ${
            attempts >= 4 ? 'text-red-500' : 
            attempts >= 2 ? 'text-yellow-500' : 
            'text-green-500'
          }`}>
            {attempts >= 4 ? 'Critical' : attempts >= 2 ? 'Moderate' : 'High'}
          </span>
        </div>
        <div className={`w-full h-2 rounded-full overflow-hidden ${
          theme === 'dark' ? 'bg-gray-700' : 'bg-gray-300'
        }`}>
          <motion.div
            className={`h-2 rounded-full ${
              attempts >= 4 ? 'bg-gradient-to-r from-red-500 to-rose-500' :
              attempts >= 2 ? 'bg-gradient-to-r from-yellow-500 to-amber-500' :
              'bg-gradient-to-r from-green-500 to-emerald-500'
            }`}
            initial={{ width: 0 }}
            animate={`{ width: `${100 - (attempts * 15)}%` `}}
            transition={{ duration: 0.5 }}
          />
        </div>
      </div>
    </motion.div>
  );
};

\/\/ Advanced Countdown with Security Cooldown
const SecurityCountdown = ({ duration, isActive, onComplete, theme, isLocked }) => {
  const [timeLeft, setTimeLeft] = useState(duration);

  useEffect(() => {
    if (!isActive || timeLeft <= 0) return;

    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          onComplete?.();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isActive, timeLeft, onComplete]);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const progress = (timeLeft / duration) * 100;

  return (
    <div className={`p-4 rounded-xl border-2 ${
      isLocked
        ? 'border-red-500/30 bg-red-500/10'
        : theme === 'dark'
        ? 'border-gray-700 bg-gray-800/50'
        : 'border-gray-300 bg-gray-100'
    }`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Clock className={`w-4 h-4 ${
            isLocked ? 'text-red-500' : 'text-indigo-500'
          }`} />
          <span className={`text-sm font-medium ${
            theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
          }`}>
            {isLocked ? 'Account Locked' : 'Resend Available In'}
          </span>
        </div>
        <span className={`font-mono font-bold ${
          isLocked ? 'text-red-500' : 
          timeLeft < 10 ? 'text-yellow-500' : 'text-indigo-500'
        }`}>
          {formatTime(timeLeft)}
        </span>
      </div>
      
      <div className={`w-full h-1.5 rounded-full overflow-hidden ${
        theme === 'dark' ? 'bg-gray-700' : 'bg-gray-300'
      }`}>
        <motion.div
          className={`h-1.5 rounded-full ${
            isLocked ? 'bg-red-500' :
            timeLeft < 10 ? 'bg-gradient-to-r from-yellow-500 to-amber-500' :
            'bg-gradient-to-r from-indigo-500 to-purple-500'
          }`}
          initial={{ width: '100%' }}
          animate={`{ width: `${progress}%` `}}
          transition={{ duration: 1, ease: "linear" }}
        />
      </div>
      
      {isLocked && (
        <p className={`text-xs mt-2 ${theme === 'dark' ? 'text-red-400' : 'text-red-600'}`}>
          Too many failed attempts. Please wait before trying again.
        </p>
      )}
    </div>
  );
};

\/\/ Main Component
export default function ResetOtpVerification() {
  const navigate = useNavigate();
  const location = useLocation();
  const [otp, setOtp] = useState(Array(6).fill(""));
  const [status, setStatus] = useState('pending');
  const [loading, setLoading] = useState(false);
  const [resendTimer, setResendTimer] = useState(60);
  const [canResend, setCanResend] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [isLocked, setIsLocked] = useState(false);
  const [securityLog, setSecurityLog] = useState([]);
  const [lastAttemptTime, setLastAttemptTime] = useState(null);
  
  const theme = "dark"; \/\/ Should come from ThemeContext
  const inputRefs = useRef([]);
  const containerRef = useRef(null);
  
  \/\/ Get phone from location state
  const phone = location.state?.phone || "";
  const isPasswordReset = location.state?.isPasswordReset || false;

  \/\/ Mask phone number
  const maskedPhone = useMemo(() => {
    if (!phone) return "";
    const visibleDigits = 4;
    const masked = phone.slice(0, -visibleDigits).replace(/./g, '•') + phone.slice(-visibleDigits);
    return masked.replace(/(\d{3})(\d{3})(\d{4})/, '$1-$2-$3');
  }, [phone]);

  \/\/ Initialize OTP auto-read if available
  useEffect(() => {
    if ('OTPCredential' in window && !isLocked) {
      const abortController = new AbortController();
      
      navigator.credentials.get({
        otp: { transport: ['sms'] },
        signal: abortController.signal,
      }).then((otpCredential) => {
        if (otpCredential?.code) {
          const codeArray = otpCredential.code.slice(0, 6).split('');
          setOtp(codeArray);
          codeArray.forEach((digit, index) => {
            if (inputRefs.current[index]) {
              inputRefs.current[index].value = digit;
            }
          });
          \/\/ Auto-verify
          setTimeout(() => verifyOtp(codeArray.join('')), 300);
        }
      }).catch(() => {
        \/\/ Auto-read not available or user denied
      });

      return () => abortController.abort();
    }
  }, [isLocked]);

  \/\/ Resend timer logic
  useEffect(() => {
    if (resendTimer <= 0) {
      setCanResend(true);
      return;
    }

    const timer = setInterval(() => {
      setResendTimer(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          setCanResend(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [resendTimer]);

  \/\/ Check for rate limiting and lock
  useEffect(() => {
    if (attempts >= 5) {
      setIsLocked(true);
      setStatus('locked');
      toast.error("Too many failed attempts. Account temporarily locked for 5 minutes.");
      \/\/ Simulate 5-minute lock
      setTimeout(() => {
        setIsLocked(false);
        setAttempts(0);
        setStatus('pending');
        toast.info("Account unlocked. You can try again.");
      }, 300000); \/\/ 5 minutes
    }
  }, [attempts]);

  \/\/ Security logging
  const logSecurityEvent = useCallback((event) => {
    const timestamp = new Date().toISOString();
    setSecurityLog(prev => [...prev.slice(-4), { timestamp, event }]);
  }, []);

  \/\/ OTP verification with enhanced security
  const verifyOtp = useCallback(async (code = otp.join('')) => {
    if (code.length < 6) {
      toast.error("Please enter the complete 6-digit code");
      return false;
    }

    if (isLocked) {
      toast.error("Account is temporarily locked. Please wait.");
      return false;
    }

    \/\/ Check time between attempts
    if (lastAttemptTime) {
      const timeDiff = Date.now() - lastAttemptTime;
      if (timeDiff < 2000) { \/\/ 2 second minimum between attempts
        toast.warning("Please wait between attempts");
        return false;
      }
    }

    setLastAttemptTime(Date.now());
    setLoading(true);
    setStatus('verifying');
    logSecurityEvent(`OTP verification attempt ${attempts + 1}`);

    try {
      \/\/ Simulate API call with enhanced security
      await new Promise((resolve, reject) => {
        setTimeout(() => {
          \/\/ Simulated validation - in production, verify against your backend
          const isValid = code === "123456"; \/\/ Test code for demo
          
          if (isValid) {
            resolve();
          } else {
            reject(new Error("Invalid verification code"));
          }
        }, 1500);
      });

      \/\/ Success
      setStatus('success');
      setAttempts(0);
      logSecurityEvent("OTP verification successful");
      
      \/\/ Success animation delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      toast.success("✅ Identity verified successfully!");
      
      \/\/ Navigate to password reset
      navigate("/reset-password", { 
        state: { 
          phone,
          isPasswordReset: true,
          verificationMethod: "otp"
        } 
      });
      
      return true;
      
    } catch (error) {
      \/\/ Failure
      const newAttempts = attempts + 1;
      setAttempts(newAttempts);
      setStatus('error');
      
      \/\/ Clear OTP on error
      setOtp(Array(6).fill(""));
      inputRefs.current[0]?.focus();
      
      logSecurityEvent(`OTP verification failed - attempt ${newAttempts}`);
      
      \/\/ Enhanced error messages
      if (newAttempts >= 3) {
        toast.error(`Invalid code. ${5 - newAttempts} attempts remaining before lock.`);
      } else {
        toast.error("Invalid verification code. Please try again.");
      }
      
      \/\/ Shake animation
      containerRef.current?.animate([
        { transform: 'translateX(-5px)' },
        { transform: 'translateX(5px)' },
        { transform: 'translateX(-5px)' },
        { transform: 'translateX(5px)' },
        { transform: 'translateX(0)' }
      ], { duration: 400 });
      
      return false;
      
    } finally {
      setLoading(false);
    }
  }, [otp, isLocked, attempts, lastAttemptTime, phone, navigate, logSecurityEvent]);

  \/\/ Handle OTP input changes
  const handleChange = useCallback((value, index) => {
    if (isLocked) return;
    
    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);

    \/\/ Auto-focus next input
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    \/\/ Auto-verify when last digit is entered
    if (index === 5 && value) {
      const fullCode = newOtp.join('');
      if (fullCode.length === 6) {
        verifyOtp(fullCode);
      }
    }
  }, [otp, isLocked, verifyOtp]);

  \/\/ Handle keyboard navigation
  const handleKeyDown = useCallback((e, index) => {
    if (isLocked) return;
    
    switch (e.key) {
      case 'Backspace':
        e.preventDefault();
        if (!otp[index] && index > 0) {
          \/\/ Move to previous input
          inputRefs.current[index - 1]?.focus();
          \/\/ Clear previous input
          const newOtp = [...otp];
          newOtp[index - 1] = '';
          setOtp(newOtp);
        } else {
          \/\/ Clear current input
          const newOtp = [...otp];
          newOtp[index] = '';
          setOtp(newOtp);
        }
        break;
        
      case 'ArrowLeft':
        if (index > 0) inputRefs.current[index - 1]?.focus();
        break;
        
      case 'ArrowRight':
        if (index < 5) inputRefs.current[index + 1]?.focus();
        break;
        
      case 'ArrowUp':
      case 'ArrowDown':
        e.preventDefault();
        break;
    }
  }, [otp, isLocked]);

  \/\/ Handle paste
  const handlePaste = useCallback((e) => {
    if (isLocked) return;
    
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
      \/\/ Focus last input
      inputRefs.current[5]?.focus();
      \/\/ Auto-verify after delay
      setTimeout(() => verifyOtp(pasteData), 300);
    }
  }, [isLocked, verifyOtp]);

  \/\/ Handle resend
  const handleResend = useCallback(async () => {
    if (!canResend || isLocked) return;
    
    setCanResend(false);
    setResendTimer(60);
    setOtp(Array(6).fill(""));
    setStatus('pending');
    
    \/\/ Reset focus to first input
    inputRefs.current[0]?.focus();
    
    try {
      \/\/ Simulate resend API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      logSecurityEvent("OTP resend requested");
      toast.success("📱 New verification code sent!");
      
    } catch (error) {
      console.error("Resend error:", error);
      toast.error("Failed to resend code. Please try again.");
    }
  }, [canResend, isLocked, logSecurityEvent]);

  \/\/ Handle manual verification
  const handleManualVerify = () => {
    verifyOtp();
  };

  const backgroundStyle = useMemo(() => ({
    background: theme === "dark"
      ? "radial-gradient(ellipse 80% 50% at 50% 0%, rgba(99,102,241,0.15) 0%, transparent 70%), radial-gradient(ellipse 50% 50% at 100% 100%, rgba(168,85,247,0.1) 0%, transparent 50%), #0a0f1c"
      : "radial-gradient(ellipse 80% 50% at 50% 0%, rgba(99,102,241,0.08) 0%, transparent 70%), radial-gradient(ellipse 50% 50% at 100% 100%, rgba(168,85,247,0.06) 0%, transparent 50%), #f9fafb",
  }), [theme]);

  const isOtpComplete = otp.join('').length === 6;

  return (
    <div 
      ref={containerRef}
      className="w-full min-h-screen flex items-center justify-center p-4 relative overflow-hidden"
      style={backgroundStyle}
    >
      {/* Security Grid Pattern */}
      <div className="absolute inset-0 opacity-10 pointer-events-none">
        <svg width="100%" height="100%" xmlns="http:\/\/www.w3.org/2000/svg">
          <defs>
            <pattern id="securityGrid" width="40" height="40" patternUnits="userSpaceOnUse">
              <circle cx="20" cy="20" r="1" fill="currentColor" />
              <rect x="15" y="15" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="0.5" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#securityGrid)" />
        </svg>
      </div>

      {/* Floating Security Indicators */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {[...Array(8)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute"
            style={{
              width: 2,
              height: 2,
              top: `${Math.random() * 100}%`,
              left: `${Math.random() * 100}%`,
              background: theme === "dark" 
                ? "rgba(99,102,241,0.3)" 
                : "rgba(79,70,229,0.2)",
            }}
            animate={{
              y: [0, -20, 0],
              opacity: [0.3, 0.8, 0.3],
            }}
            transition={{
              duration: Math.random() * 3 + 2,
              repeat: Infinity,
              ease: "easeInOut",
              delay: Math.random() * 2,
            }}
          />
        ))}
      </div>

      <motion.div
        initial={{ opacity: 0, y: 30, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.6, type: "spring" }}
        className="relative z-10 w-full max-w-lg"
      >
        {/* Security Shield */}
        <div className="mb-6">
          <PasswordResetShield status={status} attempts={attempts} theme={theme} />
        </div>

        <motion.div
          className={`rounded-3xl shadow-2xl border backdrop-blur-lg ${
            theme === 'dark' 
              ? 'bg-gray-900/80 border-gray-700/50' 
              : 'bg-white/90 border-gray-200/60'
          } p-8`}
        >
          {/* Header */}
          <header className="text-center mb-8">
            <motion.h1
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`text-2xl font-bold mb-2 ${
                theme === 'dark' ? 'text-white' : 'text-gray-900'
              }`}
            >
              Identity Verification
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className={`text-lg ${
                theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
              }`}
            >
              Password Reset • Step 2 of 3
            </motion.p>
          </header>

          {/* Phone Display */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="text-center mb-8"
          >
            <div className={`inline-flex items-center gap-3 px-6 py-3 rounded-2xl ${
              theme === 'dark' ? 'bg-gray-800' : 'bg-gray-100'
            }`}>
              <Smartphone className="text-indigo-500" size={20} />
              <span className={`font-mono font-semibold ${
                theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
              }`}>
                {maskedPhone}
              </span>
            </div>
            <p className={`text-sm mt-2 ${
              theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
            }`}>
              Enter the 6-digit verification code sent to your phone
            </p>
          </motion.div>

          {/* OTP Input Grid */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="flex justify-center gap-3 mb-8"
          >
            {otp.map((digit, index) => (
              <SecureOtpInput
                key={index}
                index={index}
                value={digit}
                onChange={handleChange}
                onKeyDown={(e) => handleKeyDown(e, index)}
                onPaste={index === 0 ? handlePaste : undefined}
                autoFocus={index === 0}
                theme={theme}
                error={status === 'error'}
                disabled={isLocked || loading}
                ref={(el) => (inputRefs.current[index] = el)}
              />
            ))}
          </motion.div>

          {/* Status Message */}
          <AnimatePresence>
            {status === 'error' && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className={`p-4 rounded-xl mb-6 ${
                  theme === 'dark' 
                    ? 'bg-red-900/20 border border-red-700/50' 
                    : 'bg-red-50 border border-red-200'
                }`}
              >
                <div className="flex items-center gap-3">
                  <AlertCircle className="text-red-500" size={20} />
                  <div>
                    <h4 className={`font-semibold ${
                      theme === 'dark' ? 'text-red-300' : 'text-red-700'
                    }`}>
                      Verification Failed
                    </h4>
                    <p className={`text-sm ${
                      theme === 'dark' ? 'text-red-400' : 'text-red-600'
                    }`}>
                      {attempts >= 3 
                        ? `Invalid code. ${5 - attempts} attempts remaining.` 
                        : "The verification code you entered is incorrect."
                      }
                    </p>
                  </div>
                </div>
              </motion.div>
            )}
            
            {status === 'success' && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className={`p-4 rounded-xl mb-6 ${
                  theme === 'dark' 
                    ? 'bg-green-900/20 border border-green-700/50' 
                    : 'bg-green-50 border border-green-200'
                }`}
              >
                <div className="flex items-center gap-3">
                  <CheckCircle className="text-green-500" size={20} />
                  <div>
                    <h4 className={`font-semibold ${
                      theme === 'dark' ? 'text-green-300' : 'text-green-700'
                    }`}>
                      Identity Verified Successfully
                    </h4>
                    <p className={`text-sm ${
                      theme === 'dark' ? 'text-green-400' : 'text-green-600'
                    }`}>
                      Your identity has been confirmed. Proceeding to password reset...
                    </p>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Security Countdown */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="mb-6"
          >
            <SecurityCountdown 
              duration={isLocked ? 300 : 60} \/\/ 5 minutes if locked, 1 minute otherwise
              isActive={!canResend}
              onComplete={() => setCanResend(true)}
              theme={theme}
              isLocked={isLocked}
            />
          </motion.div>

          {/* Action Buttons */}
          <div className="space-y-4">
            {/* Manual Verify Button */}
            <motion.button
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
              onClick={handleManualVerify}
              disabled={!isOtpComplete || loading || isLocked}
              whileHover={isOtpComplete && !loading && !isLocked ? { scale: 1.02 } : {}}
              whileTap={isOtpComplete && !loading && !isLocked ? { scale: 0.98 } : {}}
              className={`w-full py-4 rounded-2xl font-bold text-lg shadow-lg transition-all ${
                isOtpComplete && !loading && !isLocked
                  ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white hover:shadow-xl'
                  : theme === 'dark'
                  ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }`}
            >
              {loading ? (
                <div className="flex items-center justify-center gap-3">
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                    className="w-5 h-5 border-2 border-white border-t-transparent rounded-full"
                  />
                  Verifying Identity...
                </div>
              ) : (
                <div className="flex items-center justify-center gap-2">
                  <Key className="w-5 h-5" />
                  Verify & Continue
                </div>
              )}
            </motion.button>

            {/* Resend Button */}
            <motion.button
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.7 }}
              onClick={handleResend}
              disabled={!canResend || loading || isLocked}
              whileHover={canResend && !loading && !isLocked ? { scale: 1.02 } : {}}
              whileTap={canResend && !loading && !isLocked ? { scale: 0.98 } : {}}
              className={`w-full py-3 rounded-xl font-semibold transition-all flex items-center justify-center gap-2 ${
                canResend && !loading && !isLocked
                  ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white hover:shadow-lg'
                  : theme === 'dark'
                  ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }`}
            >
              <RefreshCw className="w-4 h-4" />
              {loading ? 'Sending...' : 'Resend Verification Code'}
            </motion.button>

            {/* Back Link */}
            <div className="text-center pt-4 border-t border-gray-700/30 dark:border-gray-700">
              <button
                onClick={() => navigate(-1)}
                className={`text-sm font-medium transition-colors ${
                  theme === 'dark' 
                    ? 'text-indigo-400 hover:text-indigo-300' 
                    : 'text-indigo-600 hover:text-indigo-500'
                }`}
              >
                ← Back to Reset Options
              </button>
            </div>
          </div>

          {/* Security Log (Debug) */}
          {process.env.NODE_ENV === 'development' && securityLog.length > 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="mt-6 p-4 rounded-xl bg-gray-900/50 border border-gray-700"
            >
              <h4 className="text-xs font-bold text-gray-400 mb-2">Security Log</h4>
              <div className="space-y-1">
                {securityLog.map((log, index) => (
                  <div key={index} className="text-xs text-gray-500 flex justify-between">
                    <span>{log.event}</span>
                    <span>{new Date(log.timestamp).toLocaleTimeString()}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </motion.div>
      </motion.div>
    </div>
  );
}