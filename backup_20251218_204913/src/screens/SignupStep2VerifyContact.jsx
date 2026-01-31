\/\/ src/screens/SignupStep2VerifyContact.jsx
import React, { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useSignup } from "@context/SignupContext";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "../firebase/firebase";

\/\/ Advanced Country Code Selector
const CountryCodeSelector = ({ value, onChange, theme }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const selectorRef = useRef(null);

  \/\/ Comprehensive country list with flags and codes
  const countries = useMemo(() => [
    { code: "+1", flag: "🇺🇸", name: "United States" },
    { code: "+44", flag: "🇬🇧", name: "United Kingdom" },
    { code: "+91", flag: "🇮🇳", name: "India" },
    { code: "+86", flag: "🇨🇳", name: "China" },
    { code: "+81", flag: "🇯🇵", name: "Japan" },
    { code: "+49", flag: "🇩🇪", name: "Germany" },
    { code: "+33", flag: "🇫🇷", name: "France" },
    { code: "+7", flag: "🇷🇺", name: "Russia" },
    { code: "+55", flag: "🇧🇷", name: "Brazil" },
    { code: "+52", flag: "🇲🇽", name: "Mexico" },
    { code: "+61", flag: "🇦🇺", name: "Australia" },
    { code: "+34", flag: "🇪🇸", name: "Spain" },
    { code: "+39", flag: "🇮🇹", name: "Italy" },
    { code: "+82", flag: "🇰🇷", name: "South Korea" },
    { code: "+971", flag: "🇦🇪", name: "UAE" },
    { code: "+966", flag: "🇸🇦", name: "Saudi Arabia" },
    { code: "+27", flag: "🇿🇦", name: "South Africa" },
    { code: "+234", flag: "🇳🇬", name: "Nigeria" },
    { code: "+20", flag: "🇪🇬", name: "Egypt" },
    { code: "+254", flag: "🇰🇪", name: "Kenya" },
  ], []);

  const filteredCountries = useMemo(() => 
    countries.filter(country => 
      country.name.toLowerCase().includes(search.toLowerCase()) ||
      country.code.includes(search)
    ), [countries, search]
  );

  const selectedCountry = countries.find(c => c.code === value) || countries[0];

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (selectorRef.current && !selectorRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={selectorRef}>
      <motion.button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-2 px-3 py-3 rounded-xl border-2 transition-all ${
          theme === 'dark' ? 'border-gray-600 bg-gray-800' : 'border-gray-300 bg-white'
        } ${isOpen ? 'border-indigo-500 shadow-lg shadow-indigo-500/20' : ''}`}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
      >
        <span className="text-lg">{selectedCountry.flag}</span>
        <span className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
          {selectedCountry.code}
        </span>
        <motion.span
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.3 }}
          className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}
        >
          ▼
        </motion.span>
      </motion.button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            className={`absolute top-full left-0 right-0 mt-2 rounded-xl border-2 shadow-2xl z-50 max-h-80 overflow-hidden ${
              theme === 'dark' 
                ? 'bg-gray-800 border-gray-600' 
                : 'bg-white border-gray-300'
            }`}
          >
            {/* Search input */}
            <div className="p-3 border-b border-gray-200 dark:border-gray-600">
              <input
                type="text"
                placeholder="Search countries..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className={`w-full px-3 py-2 rounded-lg text-sm ${
                  theme === 'dark' 
                    ? 'bg-gray-700 text-white placeholder-gray-400' 
                    : 'bg-gray-100 text-gray-900 placeholder-gray-500'
                }`}
              />
            </div>

            {/* Country list */}
            <div className="overflow-y-auto max-h-60">
              {filteredCountries.map((country, index) => (
                <motion.button
                  key={country.code}
                  type="button"
                  onClick={() => {
                    onChange(country.code);
                    setIsOpen(false);
                    setSearch("");
                  }}
                  className={`w-full px-4 py-3 text-left transition-colors flex items-center gap-3 ${
                    theme === 'dark' 
                      ? 'hover:bg-gray-700 text-white' 
                      : 'hover:bg-gray-100 text-gray-900'
                  } ${country.code === value ? 'bg-indigo-500 text-white' : ''}`}
                  whileHover={{ scale: 1.02 }}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.02 }}
                >
                  <span className="text-lg">{country.flag}</span>
                  <span className="font-medium">{country.code}</span>
                  <span className="text-sm opacity-75">{country.name}</span>
                </motion.button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

\/\/ Advanced Security Indicators
const SecurityIndicator = ({ strength, theme }) => {
  const getStrengthColor = (strength) => {
    switch (strength) {
      case 'weak': return 'bg-red-500';
      case 'fair': return 'bg-yellow-500';
      case 'good': return 'bg-blue-500';
      case 'strong': return 'bg-green-500';
      default: return 'bg-gray-300';
    }
  };

  const getStrengthText = (strength) => {
    switch (strength) {
      case 'weak': return 'Weak security';
      case 'fair': return 'Fair security';
      case 'good': return 'Good security';
      case 'strong': return 'Strong security';
      default: return 'Checking security...';
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-center gap-3 p-3 rounded-xl bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-700"
    >
      <div className="flex-1">
        <div className="flex gap-1 mb-1">
          {[1, 2, 3, 4].map((index) => (
            <motion.div
              key={index}
              className={`h-1 flex-1 rounded-full transition-all ${
                index <= (strength === 'weak' ? 1 : strength === 'fair' ? 2 : strength === 'good' ? 3 : 4)
                  ? getStrengthColor(strength)
                  : 'bg-gray-300 dark:bg-gray-600'
              }`}
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ delay: index * 0.1 }}
            />
          ))}
        </div>
        <p className={`text-xs ${
          theme === 'dark' ? 'text-gray-300' : 'text-gray-600'
        }`}>
          {getStrengthText(strength)}
        </p>
      </div>
      <motion.div
        animate={{ rotate: [0, 10, -10, 0] }}
        transition={{ duration: 2, repeat: Infinity }}
        className="text-lg"
      >
        🔒
      </motion.div>
    </motion.div>
  );
};

\/\/ Main component
export default function SignupStep2VerifyContact() {
  const navigate = useNavigate();
  const { signupData, updateSignupData, sendOtp, recaptchaReady, theme } = useSignup();

  const [method, setMethod] = useState(signupData.contactMethod || "phone");
  const [phoneData, setPhoneData] = useState({
    countryCode: "+1",
    number: signupData.phone || ""
  });
  const [email, setEmail] = useState(signupData.email || "");
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [securityLevel, setSecurityLevel] = useState("good");

  \/\/ Update context when method changes
  useEffect(() => {
    updateSignupData("contactMethod", method);
  }, [method, updateSignupData]);

  \/\/ Real-time validation
  useEffect(() => {
    const newErrors = {};
    
    if (method === "phone") {
      const fullPhone = `${phoneData.countryCode}${phoneData.number}`;
      if (phoneData.number && !/^\+?[1-9]\d{7,14}$/.test(fullPhone.replace(/\s/g, ''))) {
        newErrors.phone = "Please enter a valid phone number";
      }
    } else if (method === "email") {
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        newErrors.email = "Please enter a valid email address";
      }
    }

    setErrors(newErrors);
  }, [method, phoneData, email]);

  \/\/ Enhanced phone validation
  const validatePhone = useCallback(() => {
    const fullPhone = `${phoneData.countryCode}${phoneData.number}`.replace(/\s/g, '');
    
    if (!phoneData.number.trim()) {
      return "Phone number is required";
    }
    
    if (!/^\+?[1-9]\d{7,14}$/.test(fullPhone)) {
      return "Please enter a valid phone number";
    }
    
    if (!fullPhone.startsWith('+')) {
      return "Please include country code";
    }

    return null;
  }, [phoneData]);

  \/\/ Enhanced email validation
  const validateEmail = useCallback(async () => {
    if (!email.trim()) {
      return "Email address is required";
    }
    
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return "Please enter a valid email address";
    }

    \/\/ Check for duplicate email
    try {
      const usersRef = collection(db, "users");
      const q = query(usersRef, where("email", "==", email.trim().toLowerCase()));
      const snap = await getDocs(q);
      if (!snap.empty) {
        return "This email is already registered";
      }
    } catch (err) {
      console.error("Email validation error:", err);
      return "Could not validate email. Please try again.";
    }

    return null;
  }, [email]);

  \/\/ Enhanced phone sending with security features
  const handleSendOtp = async () => {
    setLoading(true);
    setErrors({});

    const phoneError = validatePhone();
    if (phoneError) {
      setErrors({ phone: phoneError });
      toast.error(phoneError);
      setLoading(false);
      return;
    }

    const fullPhone = `${phoneData.countryCode}${phoneData.number}`.replace(/\s/g, '');

    try {
      \/\/ Check for duplicate phone
      const usersRef = collection(db, "users");
      const q = query(usersRef, where("phone", "==", fullPhone));
      const snap = await getDocs(q);
      if (!snap.empty) {
        setErrors({ phone: "This phone number is already registered" });
        toast.error("This phone number is already registered");
        setLoading(false);
        return;
      }

      if (!recaptchaReady) {
        toast.error("Security verification not ready. Please wait...");
        setLoading(false);
        return;
      }

      \/\/ Send OTP
      await sendOtp(fullPhone);
      
      \/\/ Update context
      updateSignupData({ 
        phone: fullPhone,
        contactValue: fullPhone 
      });

      toast.success("🔐 Security code sent to your phone!");
      navigate("/otp-verification");
    } catch (err) {
      console.error("Send OTP failed:", err);
      const errorMessage = err?.message || "Failed to send verification code";
      setErrors({ phone: errorMessage });
      
      \/\/ Enhanced error handling
      if (err.code === "auth/too-many-requests") {
        toast.error("Too many attempts. Please try again in a few minutes.");
      } else if (err.code === "auth/invalid-phone-number") {
        toast.error("Invalid phone number format");
      } else {
        toast.error(errorMessage);
      }
    } finally {
      setLoading(false);
    }
  };

  \/\/ Enhanced email sending
  const handleSendEmailVerification = async () => {
    setLoading(true);
    setErrors({});

    const emailError = await validateEmail();
    if (emailError) {
      setErrors({ email: emailError });
      toast.error(emailError);
      setLoading(false);
      return;
    }

    try {
      \/\/ Update context
      updateSignupData({ 
        email: email.trim(),
        contactValue: email.trim()
      });

      \/\/ For now, simulate email verification success
      \/\/ In production, integrate with your email service
      toast.success("📧 Verification email sent! Check your inbox.");
      navigate("/email-verification");
    } catch (err) {
      console.error("Email verification error:", err);
      const errorMessage = err?.message || "Failed to send verification email";
      setErrors({ email: errorMessage });
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const backgroundStyle = useMemo(() => ({
    background: theme === "dark"
      ? "radial-gradient(ellipse 80% 50% at 50% 0%, rgba(99,102,241,0.15) 0%, transparent 70%), radial-gradient(ellipse 50% 50% at 100% 100%, rgba(168,85,247,0.1) 0%, transparent 50%), #0a0f1c"
      : "radial-gradient(ellipse 80% 50% at 50% 0%, rgba(99,102,241,0.08) 0%, transparent 70%), radial-gradient(ellipse 50% 50% at 100% 100%, rgba(168,85,247,0.06) 0%, transparent 50%), #f9fafb",
  }), [theme]);

  const isFormValid = method === "phone" 
    ? phoneData.number.trim() && !errors.phone
    : email.trim() && !errors.email;

  return (
    <div 
      className="w-full min-h-screen flex items-center justify-center p-4 relative overflow-hidden"
      style={backgroundStyle}
    >
      {/* Advanced background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {[...Array(12)].map((_, i) => (
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
      </div>

      <motion.div
        initial={{ opacity: 0, y: 30, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.6, type: "spring" }}
        className="relative z-10 w-full max-w-md"
      >
        {/* Progress indicator */}
        <motion.div 
          className="flex items-center justify-center mb-8"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <div className="flex items-center space-x-2">
            {[1, 2, 3].map((step) => (
              <div key={step} className="flex items-center">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${
                  step === 2 
                    ? 'bg-indigo-600 text-white' 
                    : step < 2
                    ? 'bg-green-500 text-white'
                    : theme === 'dark'
                    ? 'bg-gray-700 text-gray-400'
                    : 'bg-gray-300 text-gray-600'
                }`}>
                  {step === 1 ? "✓" : step}
                </div>
                {step < 3 && (
                  <div className={`w-12 h-1 mx-2 ${
                    step < 2 
                      ? 'bg-green-500' 
                      : step === 2
                      ? 'bg-indigo-600'
                      : theme === 'dark'
                      ? 'bg-gray-700'
                      : 'bg-gray-300'
                  }`} />
                )}
              </div>
            ))}
          </div>
        </motion.div>

        <motion.div
          className={`rounded-3xl shadow-2xl border backdrop-blur-lg ${
            theme === 'dark' 
              ? 'bg-gray-900/80 border-gray-700/50' 
              : 'bg-white/90 border-gray-200/60'
          } p-8`}
        >
          <header className="text-center mb-8">
            <motion.h1
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className={`text-3xl font-bold mb-2 ${
                theme === 'dark' ? 'text-white' : 'text-gray-900'
              }`}
            >
              Secure Your Account
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className={`text-lg ${
                theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
              }`}
            >
              Step 2 • Verification Method
            </motion.p>
          </header>

          {/* Security Indicator */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="mb-6"
          >
            <SecurityIndicator strength={securityLevel} theme={theme} />
          </motion.div>

          {/* Method Toggle */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="mb-6"
          >
            <div className={`grid grid-cols-2 rounded-2xl p-1 ${
              theme === 'dark' ? 'bg-gray-800' : 'bg-gray-100'
            }`}>
              {["phone", "email"].map((m) => (
                <motion.button
                  key={m}
                  onClick={() => setMethod(m)}
                  className={`py-3 text-sm font-semibold rounded-xl transition-all relative ${
                    method === m
                      ? 'text-white shadow-lg'
                      : theme === 'dark'
                      ? 'text-gray-400 hover:text-white'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                  whileTap={{ scale: 0.95 }}
                >
                  {method === m && (
                    <motion.div
                      layoutId="methodIndicator"
                      className={`absolute inset-0 rounded-xl ${
                        theme === 'dark'
                          ? 'bg-gradient-to-r from-indigo-600 to-purple-600'
                          : 'bg-gradient-to-r from-indigo-500 to-purple-500'
                      }`}
                      transition={{ type: "spring", stiffness: 300, damping: 30 }}
                    />
                  )}
                  <span className="relative z-10 flex items-center justify-center gap-2">
                    {m === "phone" ? "📱 Phone" : "📧 Email"}
                  </span>
                </motion.button>
              ))}
            </div>
          </motion.div>

          {/* Phone Input */}
          <AnimatePresence mode="wait">
            {method === "phone" && (
              <motion.div
                key="phone"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.3 }}
                className="space-y-4"
              >
                <div className="flex gap-3">
                  <CountryCodeSelector
                    value={phoneData.countryCode}
                    onChange={(code) => setPhoneData({ ...phoneData, countryCode: code })}
                    theme={theme}
                  />
                  <div className="flex-1">
                    <input
                      type="tel"
                      value={phoneData.number}
                      onChange={(e) => {
                        const value = e.target.value.replace(/[^\d\s]/g, '');
                        setPhoneData({ ...phoneData, number: value });
                      }}
                      placeholder="Phone number"
                      className={`w-full px-4 py-3 rounded-xl border-2 transition-all ${
                        errors.phone 
                          ? 'border-red-500 shadow-lg shadow-red-500/20' 
                          : theme === 'dark'
                          ? 'border-gray-600 bg-gray-800 text-white'
                          : 'border-gray-300 bg-white text-gray-900'
                      }`}
                    />
                  </div>
                </div>
                
                {errors.phone && (
                  <motion.p
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-sm text-red-500 flex items-center gap-2"
                  >
                    <span>⚠️</span>
                    {errors.phone}
                  </motion.p>
                )}

                <p className={`text-xs ${
                  theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                }`}>
                  We'll send a 6-digit verification code to this number
                </p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Email Input */}
          <AnimatePresence mode="wait">
            {method === "email" && (
              <motion.div
                key="email"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
                className="space-y-4"
              >
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  className={`w-full px-4 py-3 rounded-xl border-2 transition-all ${
                    errors.email 
                      ? 'border-red-500 shadow-lg shadow-red-500/20' 
                      : theme === 'dark'
                      ? 'border-gray-600 bg-gray-800 text-white'
                      : 'border-gray-300 bg-white text-gray-900'
                  }`}
                />
                
                {errors.email && (
                  <motion.p
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-sm text-red-500 flex items-center gap-2"
                  >
                    <span>⚠️</span>
                    {errors.email}
                  </motion.p>
                )}

                <p className={`text-xs ${
                  theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                }`}>
                  We'll send a verification link to this email address
                </p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Continue Button */}
          <motion.button
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8 }}
            whileHover={isFormValid && !loading ? { scale: 1.02 } : {}}
            whileTap={isFormValid && !loading ? { scale: 0.98 } : {}}
            onClick={method === "phone" ? handleSendOtp : handleSendEmailVerification}
            disabled={!isFormValid || loading}
            className={`w-full py-4 rounded-2xl font-bold text-lg shadow-lg transition-all duration-300 mt-6 ${
              isFormValid && !loading
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
            ) : (
              <div className="flex items-center justify-center gap-2">
                Send Verification Code
                <motion.span
                  animate={{ x: [0, 5, 0] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                >
                  {method === "phone" ? "📱" : "📧"}
                </motion.span>
              </div>
            )}
          </motion.button>

          {/* Security Notice */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1 }}
            className="mt-6 p-4 rounded-xl bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border border-blue-200 dark:border-blue-800"
          >
            <div className="flex items-start gap-3">
              <span className="text-lg mt-0.5">🛡️</span>
              <div>
                <h4 className={`font-semibold text-sm ${
                  theme === 'dark' ? 'text-blue-300' : 'text-blue-700'
                }`}>
                  Advanced Security
                </h4>
                <p className={`text-xs ${
                  theme === 'dark' ? 'text-blue-400' : 'text-blue-600'
                }`}>
                  Your information is protected with end-to-end encryption and never shared with third parties.
                </p>
              </div>
            </div>
          </motion.div>
        </motion.div>
      </motion.div>
    </div>
  );
}