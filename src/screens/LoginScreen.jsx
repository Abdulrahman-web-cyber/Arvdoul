// src/screens/LoginScreen.jsx
import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useNavigate, Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { Eye, EyeOff, Smartphone, Mail, Lock, Shield, Zap, Key, User, AlertCircle } from "lucide-react";

// Enhanced Country Code Selector (Reusing from signup with improvements)
const CountryCodeSelector = ({ value, onChange, theme }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const selectorRef = useRef(null);

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

// Advanced Password Input with Security Features
const AdvancedPasswordInput = ({ 
  value, 
  onChange, 
  error, 
  theme,
  placeholder = "Enter your password"
}) => {
  const [showPassword, setShowPassword] = useState(false);
  const [isFocused, setIsFocused] = useState(false);

  return (
    <motion.div
      className={`relative rounded-xl border-2 transition-all duration-300 ${
        error 
          ? "border-red-500 shadow-lg shadow-red-500/20" 
          : isFocused 
          ? "border-indigo-500 shadow-lg shadow-indigo-500/20" 
          : theme === 'dark' 
          ? "border-gray-600" 
          : "border-gray-300"
      }`}
      whileHover={{ scale: 1.02 }}
      animate={error ? { x: [-5, 5, -5, 5, 0] } : {}}
      transition={{ duration: 0.4 }}
    >
      <div className="flex items-center">
        <Lock className={`ml-4 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'} w-5 h-5`} />
        <input
          type={showPassword ? "text" : "password"}
          value={value}
          onChange={onChange}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder={placeholder}
          className={`w-full px-4 py-4 bg-transparent outline-none text-lg pr-12 ${
            theme === 'dark' ? 'text-white placeholder-gray-500' : 'text-gray-900 placeholder-gray-400'
          }`}
        />
        
        <motion.button
          type="button"
          onClick={() => setShowPassword(!showPassword)}
          className={`absolute right-4 top-1/2 transform -translate-y-1/2 p-1 rounded-lg transition-colors ${
            theme === 'dark' ? 'hover:bg-gray-700' : 'hover:bg-gray-200'
          }`}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
        >
          {showPassword ? (
            <EyeOff className="w-5 h-5 text-gray-400" />
          ) : (
            <Eye className="w-5 h-5 text-gray-400" />
          )}
        </motion.button>
      </div>

      <motion.div
        className={`absolute bottom-0 left-0 right-0 h-0.5 rounded-full ${
          isFocused ? 'bg-gradient-to-r from-indigo-500 to-purple-500' : 'bg-transparent'
        }`}
        initial={{ scaleX: 0 }}
        animate={{ scaleX: isFocused ? 1 : 0 }}
        transition={{ duration: 0.3 }}
      />
    </motion.div>
  );
};

// Main Component
export default function LoginScreen() {
  const navigate = useNavigate();
  const [loginMethod, setLoginMethod] = useState("phone"); // "phone" or "email"
  const [loginData, setLoginData] = useState({
    phone: {
      countryCode: "+1",
      number: "",
    },
    email: "",
    username: "",
    password: "",
  });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [securityLevel, setSecurityLevel] = useState("good");
  const [rememberMe, setRememberMe] = useState(false);
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [showCaptcha, setShowCaptcha] = useState(false);
  
  // Using a theme hook - assuming you have theme context
  const theme = "dark"; // This should come from your ThemeContext

  const phoneInputRef = useRef(null);
  const emailInputRef = useRef(null);
  const usernameInputRef = useRef(null);
  const passwordRef = useRef(null);

  // Auto-focus based on login method
  useEffect(() => {
    if (loginMethod === "phone") {
      phoneInputRef.current?.focus();
    } else if (loginMethod === "email") {
      emailInputRef.current?.focus();
    }
  }, [loginMethod]);

  // Real-time validation
  useEffect(() => {
    const newErrors = {};
    
    if (loginMethod === "phone") {
      const fullPhone = `${loginData.phone.countryCode}${loginData.phone.number}`;
      if (loginData.phone.number && !/^\+?[1-9]\d{7,14}$/.test(fullPhone.replace(/\s/g, ''))) {
        newErrors.phone = "Please enter a valid phone number";
      }
    } else if (loginMethod === "email") {
      if (loginData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(loginData.email)) {
        newErrors.email = "Please enter a valid email address";
      }
    }

    if (loginData.password && loginData.password.length < 6) {
      newErrors.password = "Password must be at least 6 characters";
    }

    setErrors(newErrors);
  }, [loginData, loginMethod]);

  // Handle CAPTCHA display after failed attempts
  useEffect(() => {
    if (failedAttempts >= 3) {
      setShowCaptcha(true);
      toast.warning("Multiple failed attempts. Please verify you're human.");
    }
  }, [failedAttempts]);

  const handleLogin = async () => {
    setLoading(true);
    setErrors({});

    // Enhanced validation
    const validationErrors = {};

    if (loginMethod === "phone") {
      if (!loginData.phone.number.trim()) {
        validationErrors.phone = "Phone number is required";
      } else if (!/^\d{7,15}$/.test(loginData.phone.number.replace(/\s/g, ''))) {
        validationErrors.phone = "Please enter a valid phone number";
      }
    } else if (loginMethod === "email") {
      if (!loginData.email.trim()) {
        validationErrors.email = "Email is required";
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(loginData.email)) {
        validationErrors.email = "Please enter a valid email address";
      }
    }

    if (!loginData.password) {
      validationErrors.password = "Password is required";
    } else if (loginData.password.length < 6) {
      validationErrors.password = "Password must be at least 6 characters";
    }

    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      setLoading(false);
      toast.error("Please fix the errors before continuing.");
      return;
    }

    // Check for CAPTCHA requirement
    if (showCaptcha) {
      // Implement CAPTCHA verification here
      // For now, we'll simulate it
      toast.info("CAPTCHA verification required");
      setTimeout(() => {
        proceedWithLogin();
      }, 1500);
    } else {
      proceedWithLogin();
    }
  };

  const proceedWithLogin = async () => {
    try {
      // Simulate login process - Replace with actual authentication
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Simulate successful login
      toast.success("🔐 Secure login successful! Welcome back.");
      
      // Store remember me preference
      if (rememberMe) {
        localStorage.setItem("rememberMe", "true");
      }
      
      // Navigate to home
      navigate("/home");
      
    } catch (error) {
      console.error("Login error:", error);
      
      // Increment failed attempts
      setFailedAttempts(prev => prev + 1);
      
      // Enhanced error handling
      if (failedAttempts >= 2) {
        setShowCaptcha(true);
        toast.error("Too many failed attempts. Please verify you're human.");
      } else {
        toast.error("Invalid credentials. Please try again.");
      }
      
      // Clear password on error
      setLoginData(prev => ({ ...prev, password: "" }));
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleLogin();
    }
  };

  const backgroundStyle = useMemo(() => ({
    background: theme === "dark"
      ? "radial-gradient(ellipse 80% 50% at 50% 0%, rgba(99,102,241,0.15) 0%, transparent 70%), radial-gradient(ellipse 50% 50% at 100% 100%, rgba(168,85,247,0.1) 0%, transparent 50%), #0a0f1c"
      : "radial-gradient(ellipse 80% 50% at 50% 0%, rgba(99,102,241,0.08) 0%, transparent 70%), radial-gradient(ellipse 50% 50% at 100% 100%, rgba(168,85,247,0.06) 0%, transparent 50%), #f9fafb",
  }), [theme]);

  const isFormValid = () => {
    if (loginMethod === "phone") {
      return loginData.phone.number.trim() && 
             loginData.password.length >= 6 && 
             !errors.phone;
    } else {
      return loginData.email.trim() && 
             loginData.password.length >= 6 && 
             !errors.email;
    }
  };

  return (
    <div 
      className="w-full min-h-screen flex items-center justify-center p-4 relative overflow-hidden"
      style={backgroundStyle}
    >
      {/* Advanced Security Particles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {[...Array(20)].map((_, i) => (
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
        {/* Security Badge */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex justify-center mb-6"
        >
          <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full ${
            theme === 'dark' 
              ? 'bg-gradient-to-r from-indigo-900/50 to-purple-900/50 border border-indigo-700/50' 
              : 'bg-gradient-to-r from-indigo-100 to-purple-100 border border-indigo-200'
          }`}>
            <Shield className="w-4 h-4 text-green-500" />
            <span className={`text-xs font-semibold ${
              theme === 'dark' ? 'text-green-400' : 'text-green-600'
            }`}>
              🔒 Military-Grade Encryption
            </span>
          </div>
        </motion.div>

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
              transition={{ delay: 0.2 }}
              className={`text-3xl font-bold mb-2 ${
                theme === 'dark' ? 'text-white' : 'text-gray-900'
              }`}
            >
              Secure Login
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className={`text-lg ${
                theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
              }`}
            >
              Access Your Arvdoul Account
            </motion.p>
          </header>

          {/* Login Method Toggle */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="mb-6"
          >
            <div className={`grid grid-cols-2 rounded-2xl p-1 ${
              theme === 'dark' ? 'bg-gray-800' : 'bg-gray-100'
            }`}>
              {["phone", "email"].map((method) => (
                <motion.button
                  key={method}
                  onClick={() => setLoginMethod(method)}
                  className={`py-3 text-sm font-semibold rounded-xl transition-all relative ${
                    loginMethod === method
                      ? 'text-white shadow-lg'
                      : theme === 'dark'
                      ? 'text-gray-400 hover:text-white'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                  whileTap={{ scale: 0.95 }}
                >
                  {loginMethod === method && (
                    <motion.div
                      layoutId="loginMethodIndicator"
                      className={`absolute inset-0 rounded-xl ${
                        theme === 'dark'
                          ? 'bg-gradient-to-r from-indigo-600 to-purple-600'
                          : 'bg-gradient-to-r from-indigo-500 to-purple-500'
                      }`}
                      transition={{ type: "spring", stiffness: 300, damping: 30 }}
                    />
                  )}
                  <span className="relative z-10 flex items-center justify-center gap-2">
                    {method === "phone" ? (
                      <>
                        <Smartphone className="w-4 h-4" />
                        Phone
                      </>
                    ) : (
                      <>
                        <Mail className="w-4 h-4" />
                        Email
                      </>
                    )}
                  </span>
                </motion.button>
              ))}
            </div>
          </motion.div>

          {/* Login Form */}
          <div className="space-y-6">
            {/* Phone Input */}
            <AnimatePresence mode="wait">
              {loginMethod === "phone" && (
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
                      value={loginData.phone.countryCode}
                      onChange={(code) => setLoginData({
                        ...loginData,
                        phone: { ...loginData.phone, countryCode: code }
                      })}
                      theme={theme}
                    />
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
                          value={loginData.phone.number}
                          onChange={(e) => {
                            const value = e.target.value.replace(/[^\d\s]/g, '');
                            setLoginData({
                              ...loginData,
                              phone: { ...loginData.phone, number: value }
                            });
                          }}
                          onKeyPress={handleKeyPress}
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

            {/* Email Input */}
            <AnimatePresence mode="wait">
              {loginMethod === "email" && (
                <motion.div
                  key="email"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.3 }}
                  className="space-y-2"
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
                      value={loginData.email}
                      onChange={(e) => setLoginData({ ...loginData, email: e.target.value })}
                      onKeyPress={handleKeyPress}
                      placeholder="Email address or username"
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

            {/* Password Input */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="space-y-2"
            >
              <AdvancedPasswordInput
                value={loginData.password}
                onChange={(e) => setLoginData({ ...loginData, password: e.target.value })}
                error={errors.password}
                theme={theme}
                placeholder="Your secure password"
              />
              
              {errors.password && (
                <motion.p
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-sm text-red-500 flex items-center gap-2"
                >
                  <AlertCircle className="w-4 h-4" />
                  {errors.password}
                </motion.p>
              )}
            </motion.div>

            {/* Remember Me & Forgot Password */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
              className="flex items-center justify-between"
            >
              <div className="flex items-center gap-2">
                <motion.button
                  onClick={() => setRememberMe(!rememberMe)}
                  className={`relative w-10 h-6 rounded-full transition-colors ${
                    rememberMe 
                      ? 'bg-indigo-500' 
                      : theme === 'dark' 
                      ? 'bg-gray-700' 
                      : 'bg-gray-300'
                  }`}
                  whileTap={{ scale: 0.9 }}
                >
                  <motion.div
                    className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white shadow-md`}
                    animate={{ x: rememberMe ? 16 : 0 }}
                    transition={{ type: "spring", stiffness: 400, damping: 25 }}
                  />
                </motion.button>
                <span className={`text-sm ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                  Remember me
                </span>
              </div>

              <Link
                to="/forgot-password"
                className={`text-sm font-medium transition-colors ${
                  theme === 'dark' 
                    ? 'text-indigo-400 hover:text-indigo-300' 
                    : 'text-indigo-600 hover:text-indigo-500'
                }`}
              >
                Forgot password?
              </Link>
            </motion.div>

            {/* CAPTCHA Section */}
            <AnimatePresence>
              {showCaptcha && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="p-4 rounded-xl bg-gradient-to-r from-yellow-50 to-amber-50 dark:from-yellow-900/20 dark:to-amber-900/20 border border-yellow-200 dark:border-yellow-800"
                >
                  <div className="flex items-center gap-3 mb-3">
                    <Shield className="text-yellow-500" size={20} />
                    <span className={`font-semibold ${
                      theme === 'dark' ? 'text-yellow-300' : 'text-yellow-700'
                    }`}>
                      Security Verification Required
                    </span>
                  </div>
                  <div className={`text-xs ${
                    theme === 'dark' ? 'text-yellow-400' : 'text-yellow-600'
                  }`}>
                    Please verify you're human to continue. This is required after multiple failed attempts.
                  </div>
                  {/* CAPTCHA implementation would go here */}
                  <div className="mt-3 p-3 bg-white dark:bg-gray-800 rounded-lg text-center">
                    [CAPTCHA COMPONENT]
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Login Button */}
            <motion.button
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.7 }}
              whileHover={isFormValid() && !loading ? { scale: 1.02 } : {}}
              whileTap={isFormValid() && !loading ? { scale: 0.98 } : {}}
              onClick={handleLogin}
              disabled={!isFormValid() || loading}
              className={`w-full py-4 rounded-2xl font-bold text-lg shadow-lg transition-all duration-300 ${
                isFormValid() && !loading
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
                  Securing Access...
                </div>
              ) : (
                <div className="flex items-center justify-center gap-2">
                  <Key className="w-5 h-5" />
                  Secure Login
                  <motion.span
                    animate={{ x: [0, 5, 0] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                  >
                    →
                  </motion.span>
                </div>
              )}
            </motion.button>

            {/* Security Features */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.9 }}
              className="grid grid-cols-2 gap-3 text-center"
            >
              <div className={`p-3 rounded-xl ${
                theme === 'dark' ? 'bg-gray-800/50' : 'bg-gray-100'
              }`}>
                <div className="text-lg">🔐</div>
                <div className={`text-xs font-medium ${
                  theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                }`}>
                  End-to-End Encrypted
                </div>
              </div>
              <div className={`p-3 rounded-xl ${
                theme === 'dark' ? 'bg-gray-800/50' : 'bg-gray-100'
              }`}>
                <div className="text-lg">🛡️</div>
                <div className={`text-xs font-medium ${
                  theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                }`}>
                  Zero-Knowledge Proof
                </div>
              </div>
            </motion.div>

            {/* Signup Link */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1 }}
              className="text-center pt-4 border-t border-gray-700/30 dark:border-gray-700"
            >
              <p className={`text-sm ${
                theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
              }`}>
                Don't have an account?{" "}
                <Link
                  to="/signup/step1"
                  className={`font-semibold underline transition-colors ${
                    theme === 'dark' 
                      ? 'text-indigo-400 hover:text-indigo-300' 
                      : 'text-indigo-600 hover:text-indigo-500'
                  }`}
                >
                  Create one now
                </Link>
              </p>
            </motion.div>
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
}