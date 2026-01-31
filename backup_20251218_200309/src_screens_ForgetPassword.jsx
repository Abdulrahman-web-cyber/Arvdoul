// src/screens/ForgotPassword.jsx
import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useNavigate, Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { Mail, Smartphone, Key, Shield, Lock, AlertCircle, CheckCircle, Clock, ArrowRight } from "lucide-react";

// Security Validation Component
const SecurityStatus = ({ status, theme }) => {
  const statusConfig = {
    idle: { icon: "🔒", text: "Ready for verification", color: "text-gray-400" },
    sending: { icon: "📤", text: "Sending verification", color: "text-blue-500" },
    sent: { icon: "✅", text: "Verification sent", color: "text-green-500" },
    verifying: { icon: "⏳", text: "Verifying code", color: "text-yellow-500" },
    error: { icon: "❌", text: "Verification failed", color: "text-red-500" },
    success: { icon: "🎉", text: "Verified successfully", color: "text-green-500" }
  };

  const config = statusConfig[status] || statusConfig.idle;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex items-center gap-3 p-3 rounded-xl ${
        theme === 'dark' ? 'bg-gray-800/50' : 'bg-gray-100'
      }`}
    >
      <span className={`text-xl ${config.color}`}>{config.icon}</span>
      <div>
        <p className={`text-sm font-medium ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
          {config.text}
        </p>
        <p className={`text-xs ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
          Secure password reset process
        </p>
      </div>
    </motion.div>
  );
};

// Reset Method Toggle
const ResetMethodToggle = ({ method, onChange, theme }) => {
  return (
    <div className={`grid grid-cols-2 rounded-2xl p-1 ${theme === 'dark' ? 'bg-gray-800' : 'bg-gray-100'}`}>
      {["email", "phone"].map((m) => (
        <motion.button
          key={m}
          onClick={() => onChange(m)}
          className={`py-3 text-sm font-semibold rounded-xl transition-all relative ${
            method === m
              ? 'text-white'
              : theme === 'dark'
              ? 'text-gray-400 hover:text-white'
              : 'text-gray-600 hover:text-gray-900'
          }`}
          whileTap={{ scale: 0.95 }}
        >
          {method === m && (
            <motion.div
              layoutId="resetMethodIndicator"
              className={`absolute inset-0 rounded-xl ${
                theme === 'dark'
                  ? 'bg-gradient-to-r from-indigo-600 to-purple-600'
                  : 'bg-gradient-to-r from-indigo-500 to-purple-500'
              }`}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
            />
          )}
          <span className="relative z-10 flex items-center justify-center gap-2">
            {m === "email" ? (
              <>
                <Mail className="w-4 h-4" />
                Email
              </>
            ) : (
              <>
                <Smartphone className="w-4 h-4" />
                Phone
              </>
            )}
          </span>
        </motion.button>
      ))}
    </div>
  );
};

// Enhanced Countdown Timer
const ResetCountdown = ({ duration, isActive, theme }) => {
  const [timeLeft, setTimeLeft] = useState(duration);

  useEffect(() => {
    if (!isActive || timeLeft <= 0) return;

    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isActive, timeLeft]);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className={`flex items-center gap-3 p-3 rounded-xl ${
      theme === 'dark' ? 'bg-gray-800/50' : 'bg-gray-100'
    }`}>
      <Clock className={`w-5 h-5 ${timeLeft < 10 ? 'text-yellow-500' : 'text-indigo-500'}`} />
      <div className="flex-1">
        <div className="flex justify-between text-sm">
          <span className={theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}>
            {timeLeft > 0 ? 'Resend available in' : 'Ready to resend'}
          </span>
          <span className={`font-mono font-bold ${
            timeLeft < 10 ? 'text-yellow-500' : 'text-indigo-500'
          }`}>
            {formatTime(timeLeft)}
          </span>
        </div>
        <div className={`w-full h-1 rounded-full mt-1 ${
          theme === 'dark' ? 'bg-gray-700' : 'bg-gray-300'
        }`}>
          <motion.div
            className={`h-1 rounded-full ${
              timeLeft < 10 ? 'bg-yellow-500' : 'bg-gradient-to-r from-indigo-500 to-purple-500'
            }`}
            initial={{ width: '100%' }}
            animate={{ width: `${(timeLeft / duration) * 100}%` }}
            transition={{ duration: 1, ease: "linear" }}
          />
        </div>
      </div>
    </div>
  );
};

// Main Component
export default function ForgotPassword() {
  const navigate = useNavigate();
  
  const [method, setMethod] = useState("email");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState({
    countryCode: "+1",
    number: ""
  });
  const [status, setStatus] = useState("idle");
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [canResend, setCanResend] = useState(true);
  const [resetToken, setResetToken] = useState("");
  const [attempts, setAttempts] = useState(0);
  
  const theme = "dark"; // This should come from ThemeContext
  const emailInputRef = useRef(null);
  const phoneInputRef = useRef(null);

  // Auto-focus appropriate input
  useEffect(() => {
    if (method === "email") {
      emailInputRef.current?.focus();
    } else {
      phoneInputRef.current?.focus();
    }
  }, [method]);

  // Real-time validation
  useEffect(() => {
    const newErrors = {};
    
    if (method === "email" && email) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        newErrors.email = "Please enter a valid email address";
      }
    } else if (method === "phone" && phone.number) {
      const fullPhone = `${phone.countryCode}${phone.number}`;
      if (!/^\+?[1-9]\d{7,14}$/.test(fullPhone.replace(/\s/g, ''))) {
        newErrors.phone = "Please enter a valid phone number";
      }
    }
    
    setErrors(newErrors);
  }, [method, email, phone]);

  // Validate email format
  const validateEmail = () => {
    if (!email.trim()) {
      return "Email address is required";
    }
    
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return "Please enter a valid email address";
    }
    
    return null;
  };

  // Validate phone format
  const validatePhone = () => {
    if (!phone.number.trim()) {
      return "Phone number is required";
    }
    
    const fullPhone = `${phone.countryCode}${phone.number}`.replace(/\s/g, '');
    
    if (!/^\+?[1-9]\d{7,14}$/.test(fullPhone)) {
      return "Please enter a valid phone number";
    }
    
    return null;
  };

  // Simulate rate limiting
  const checkRateLimit = () => {
    if (attempts >= 5) {
      toast.error("Too many attempts. Please try again in 15 minutes.");
      return false;
    }
    return true;
  };

  // Send password reset via email
  const sendEmailReset = async () => {
    const emailError = validateEmail();
    if (emailError) {
      setErrors({ email: emailError });
      toast.error(emailError);
      return;
    }

    if (!checkRateLimit()) return;

    setLoading(true);
    setStatus("sending");
    setAttempts(prev => prev + 1);

    try {
      // Simulate sending reset email
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // In production: await sendPasswordResetEmail(email);
      console.log("Sending password reset email to:", email);
      
      setStatus("sent");
      setCanResend(false);
      
      toast.success("Password reset email sent. Check your inbox.");
      
      // Store reset token (simulated)
      const simulatedToken = `reset_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      setResetToken(simulatedToken);
      
    } catch (error) {
      console.error("Reset email error:", error);
      setStatus("error");
      
      let message = "Failed to send reset email";
      if (error.code === "auth/user-not-found") {
        message = "No account found with this email";
      } else if (error.code === "auth/too-many-requests") {
        message = "Too many attempts. Please wait before trying again.";
      }
      
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  // Send OTP via phone
  const sendPhoneReset = async () => {
    const phoneError = validatePhone();
    if (phoneError) {
      setErrors({ phone: phoneError });
      toast.error(phoneError);
      return;
    }

    if (!checkRateLimit()) return;

    setLoading(true);
    setStatus("sending");
    setAttempts(prev => prev + 1);

    try {
      const fullPhone = `${phone.countryCode}${phone.number}`.replace(/\s/g, '');
      
      // Simulate sending OTP
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // In production: await sendPasswordResetOTP(fullPhone);
      console.log("Sending password reset OTP to:", fullPhone);
      
      setStatus("sent");
      setCanResend(false);
      
      // Store phone for OTP verification
      localStorage.setItem("reset_phone", fullPhone);
      localStorage.setItem("reset_method", "phone");
      
      toast.success("Verification code sent to your phone");
      
      // Navigate to OTP verification for password reset
      navigate("/reset-otp-verification", { 
        state: { 
          phone: fullPhone,
          isPasswordReset: true 
        } 
      });
      
    } catch (error) {
      console.error("Reset OTP error:", error);
      setStatus("error");
      
      let message = "Failed to send verification code";
      if (error.code === "auth/invalid-phone-number") {
        message = "Invalid phone number format";
      } else if (error.code === "auth/too-many-requests") {
        message = "Too many attempts. Please wait before trying again.";
      }
      
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  // Handle reset submission
  const handleResetRequest = async () => {
    if (method === "email") {
      await sendEmailReset();
    } else {
      await sendPhoneReset();
    }
  };

  // Handle resend
  const handleResend = async () => {
    if (!canResend) {
      toast.warning("Please wait before requesting another reset");
      return;
    }
    
    setCanResend(false);
    setTimeout(() => setCanResend(true), 30000); // 30-second cooldown
    
    if (method === "email") {
      await sendEmailReset();
    } else {
      await sendPhoneReset();
    }
  };

  // Navigate to email verification if email reset was sent
  const navigateToEmailVerification = () => {
    if (status === "sent" && method === "email") {
      navigate("/email-password-reset", { 
        state: { 
          email,
          resetToken 
        } 
      });
    }
  };

  const isFormValid = () => {
    if (method === "email") {
      return email.trim() && !errors.email;
    } else {
      return phone.number.trim() && !errors.phone;
    }
  };

  const backgroundStyle = useMemo(() => ({
    background: theme === "dark"
      ? "radial-gradient(ellipse 80% 50% at 50% 0%, rgba(99,102,241,0.15) 0%, transparent 70%), radial-gradient(ellipse 50% 50% at 100% 100%, rgba(168,85,247,0.1) 0%, transparent 50%), #0a0f1c"
      : "radial-gradient(ellipse 80% 50% at 50% 0%, rgba(99,102,241,0.08) 0%, transparent 70%), radial-gradient(ellipse 50% 50% at 100% 100%, rgba(168,85,247,0.06) 0%, transparent 50%), #f9fafb",
  }), [theme]);

  return (
    <div 
      className="w-full min-h-screen flex items-center justify-center p-4 relative overflow-hidden"
      style={backgroundStyle}
    >
      {/* Background Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {[...Array(12)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute rounded-full"
            style={{
              width: Math.random() * 4 + 2,
              height: Math.random() * 4 + 2,
              top: `${Math.random() * 100}%`,
              left: `${Math.random() * 100}%`,
              background: theme === "dark" 
                ? "rgba(99,102,241,0.1)" 
                : "rgba(79,70,229,0.08)",
            }}
            animate={{
              y: [0, -15, 0],
              opacity: [0.2, 0.5, 0.2],
            }}
            transition={{
              duration: Math.random() * 4 + 2,
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
        className="relative z-10 w-full max-w-md"
      >
        <motion.div
          className={`rounded-3xl shadow-2xl border backdrop-blur-lg ${
            theme === 'dark' 
              ? 'bg-gray-900/80 border-gray-700/50' 
              : 'bg-white/90 border-gray-200/60'
          } p-8`}
        >
          {/* Header */}
          <header className="text-center mb-8">
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-5xl mb-4"
            >
              🔐
            </motion.div>
            <motion.h1
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`text-3xl font-bold mb-2 ${
                theme === 'dark' ? 'text-white' : 'text-gray-900'
              }`}
            >
              Reset Your Password
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className={`text-lg ${
                theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
              }`}
            >
              Choose your reset method
            </motion.p>
          </header>

          {/* Security Status */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="mb-6"
          >
            <SecurityStatus status={status} theme={theme} />
          </motion.div>

          {/* Reset Method Toggle */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="mb-6"
          >
            <ResetMethodToggle method={method} onChange={setMethod} theme={theme} />
          </motion.div>

          {/* Email Input */}
          <AnimatePresence mode="wait">
            {method === "email" && (
              <motion.div
                key="email"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.3 }}
                className="space-y-4"
              >
                <div className={`relative rounded-xl border-2 transition-all ${
                  errors.email 
                    ? 'border-red-500 shadow-lg shadow-red-500/20' 
                    : theme === 'dark'
                    ? 'border-gray-600 bg-gray-800'
                    : 'border-gray-300 bg-white'
                }`}>
                  <Mail className={`absolute left-4 top-1/2 transform -translate-y-1/2 ${
                    theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                  } w-5 h-5`} />
                  <input
                    ref={emailInputRef}
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter your email address"
                    className={`w-full px-4 py-4 pl-12 bg-transparent outline-none ${
                      theme === 'dark' ? 'text-white placeholder-gray-500' : 'text-gray-900 placeholder-gray-400'
                    }`}
                  />
                </div>
                
                {errors.email && (
                  <motion.p
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-sm text-red-500 flex items-center gap-2"
                  >
                    <AlertCircle className="w-4 h-4" />
                    {errors.email}
                  </motion.p>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Phone Input */}
          <AnimatePresence mode="wait">
            {method === "phone" && (
              <motion.div
                key="phone"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
                className="space-y-4"
              >
                <div className="flex gap-3">
                  {/* Country Code Selector (simplified) */}
                  <div className={`flex items-center gap-2 px-3 py-3 rounded-xl border-2 ${
                    theme === 'dark' ? 'border-gray-600 bg-gray-800' : 'border-gray-300 bg-white'
                  }`}>
                    <span className="text-lg">🇺🇸</span>
                    <span className={theme === 'dark' ? 'text-white' : 'text-gray-900'}>
                      {phone.countryCode}
                    </span>
                  </div>
                  
                  <div className="flex-1">
                    <div className={`relative rounded-xl border-2 transition-all ${
                      errors.phone 
                        ? 'border-red-500 shadow-lg shadow-red-500/20' 
                        : theme === 'dark'
                        ? 'border-gray-600 bg-gray-800'
                        : 'border-gray-300 bg-white'
                    }`}>
                      <Smartphone className={`absolute left-4 top-1/2 transform -translate-y-1/2 ${
                        theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                      } w-5 h-5`} />
                      <input
                        ref={phoneInputRef}
                        type="tel"
                        value={phone.number}
                        onChange={(e) => {
                          const value = e.target.value.replace(/[^\d\s]/g, '');
                          setPhone({ ...phone, number: value });
                        }}
                        placeholder="Phone number"
                        className={`w-full px-4 py-4 pl-12 bg-transparent outline-none ${
                          theme === 'dark' ? 'text-white placeholder-gray-500' : 'text-gray-900 placeholder-gray-400'
                        }`}
                      />
                    </div>
                  </div>
                </div>
                
                {errors.phone && (
                  <motion.p
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-sm text-red-500 flex items-center gap-2"
                  >
                    <AlertCircle className="w-4 h-4" />
                    {errors.phone}
                  </motion.p>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Instructions */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className={`p-4 rounded-xl mb-6 ${
              theme === 'dark' ? 'bg-blue-900/20 border border-blue-800/50' : 'bg-blue-50 border border-blue-200'
            }`}
          >
            <div className="flex items-start gap-3">
              <Key className={`w-5 h-5 mt-0.5 ${theme === 'dark' ? 'text-blue-400' : 'text-blue-600'}`} />
              <div className="text-left">
                <h4 className={`text-sm font-semibold ${
                  theme === 'dark' ? 'text-blue-300' : 'text-blue-700'
                }`}>
                  Reset Instructions
                </h4>
                <p className={`text-xs ${
                  theme === 'dark' ? 'text-blue-400' : 'text-blue-600'
                }`}>
                  {method === "email" 
                    ? "We'll send a secure link to your email to reset your password."
                    : "We'll send a verification code to your phone for identity confirmation."
                  }
                </p>
              </div>
            </div>
          </motion.div>

          {/* Resend Timer */}
          {status === "sent" && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="mb-6"
            >
              <ResetCountdown duration={60} isActive={!canResend} theme={theme} />
            </motion.div>
          )}

          {/* Action Buttons */}
          <div className="space-y-4">
            {/* Reset Button */}
            <motion.button
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
              whileHover={isFormValid() && !loading ? { scale: 1.02 } : {}}
              whileTap={isFormValid() && !loading ? { scale: 0.98 } : {}}
              onClick={status === "sent" ? navigateToEmailVerification : handleResetRequest}
              disabled={(!isFormValid() && status !== "sent") || loading}
              className={`w-full py-4 rounded-2xl font-bold text-lg shadow-lg transition-all duration-300 ${
                (isFormValid() || status === "sent") && !loading
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
                  Sending Verification...
                </div>
              ) : status === "sent" && method === "email" ? (
                <div className="flex items-center justify-center gap-2">
                  Check Your Email
                  <ArrowRight className="w-5 h-5" />
                </div>
              ) : (
                <div className="flex items-center justify-center gap-2">
                  <Shield className="w-5 h-5" />
                  Send Reset {method === "email" ? "Email" : "Code"}
                </div>
              )}
            </motion.button>

            {/* Resend Button */}
            {status === "sent" && (
              <motion.button
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.7 }}
                onClick={handleResend}
                disabled={!canResend || loading}
                className={`w-full py-3 rounded-xl font-semibold transition-all ${
                  !canResend || loading
                    ? theme === 'dark'
                      ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
                      : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-gradient-to-r from-purple-600 to-pink-600 text-white hover:shadow-lg'
                }`}
              >
                {loading ? 'Resending...' : 'Resend Verification'}
              </motion.button>
            )}

            {/* Back to Login */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.8 }}
              className="text-center pt-4 border-t border-gray-700/30 dark:border-gray-700"
            >
              <p className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                Remember your password?{" "}
                <Link
                  to="/login"
                  className={`font-semibold underline transition-colors ${
                    theme === 'dark' 
                      ? 'text-indigo-400 hover:text-indigo-300' 
                      : 'text-indigo-600 hover:text-indigo-500'
                  }`}
                >
                  Back to Login
                </Link>
              </p>
            </motion.div>
          </div>

          {/* Security Note */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1 }}
            className={`mt-6 p-4 rounded-xl ${
              theme === 'dark' 
                ? 'bg-gradient-to-r from-gray-800 to-gray-900 border border-gray-700' 
                : 'bg-gradient-to-r from-gray-50 to-gray-100 border border-gray-300'
            }`}
          >
            <div className="flex items-start gap-3">
              <Lock className={`w-5 h-5 mt-0.5 ${theme === 'dark' ? 'text-green-400' : 'text-green-600'}`} />
              <div className="text-left">
                <h4 className={`text-sm font-semibold ${
                  theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                }`}>
                  Security Information
                </h4>
                <p className={`text-xs ${
                  theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                }`}>
                  Password reset links expire in 1 hour. If you don't receive the email, check your spam folder.
                </p>
              </div>
            </div>
          </motion.div>
        </motion.div>
      </motion.div>
    </div>
  );
}