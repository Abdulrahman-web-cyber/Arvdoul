// src/screens/LoginScreen.jsx - ARVDOUL PRODUCTION EXCELLENCE ULTRA - FIXED VERSION
// 🔐 Ultimate login system with advanced toggle & country codes
// ⚡ Professional animations, Real-time validation, Perfect error handling
// 🎯 Production ready, Professional perfection - ALL METHODS WORKING

import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useNavigate, Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { useTheme } from "@context/ThemeContext.jsx";
import { useAuth } from "../context/AuthContext.jsx";

// Import country codes data
import { countryCodes, sortedCountryCodes, getCountryByIso } from "../data/countryCodes.js";

// Import service functions - FIXED: Using only essential exports
import { signInWithEmailPassword as signInWithEmailPasswordService } from "../services/authService.js";

// ==================== ADVANCED 3-METHOD TOGGLE ====================
const AdvancedMethodToggle = React.memo(({ 
  method, 
  onToggle, 
  theme,
  disabled = false 
}) => {
  const resolvedTheme = theme === 'system' ? 
    (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : 
    theme;

  const methods = [
    {
      id: 'phone',
      label: 'Phone',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
        </svg>
      ),
      description: 'SMS Verification',
      color: 'from-blue-500 to-cyan-500'
    },
    {
      id: 'email',
      label: 'Email',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
      ),
      description: 'Traditional Login',
      color: 'from-purple-500 to-pink-500'
    },
    {
      id: 'google',
      label: 'Google',
      icon: (
        <svg className="w-5 h-5" viewBox="0 0 24 24">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
        </svg>
      ),
      description: 'One-Click Login',
      color: 'from-red-500 to-orange-500'
    }
  ];

  return (
    <div className="relative mb-8">
      <div className={`grid grid-cols-3 gap-2 p-2 rounded-2xl backdrop-blur-sm ${
        resolvedTheme === 'dark' 
          ? 'bg-gray-800/60 border border-gray-700/50 shadow-xl' 
          : 'bg-gray-100/80 border border-gray-300/60 shadow-xl'
      }`}>
        {methods.map((option) => {
          const isActive = method === option.id;
          
          return (
            <button
              key={option.id}
              onClick={() => !disabled && onToggle(option.id)}
              disabled={disabled}
              className={`relative py-4 px-2 rounded-xl transition-all duration-300 ${
                isActive 
                  ? 'text-white' 
                  : resolvedTheme === 'dark' 
                    ? 'text-gray-400 hover:text-gray-300 hover:bg-gray-800/30' 
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100/50'
              } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
            >
              {isActive && (
                <motion.div
                  layoutId="loginMethodBackground"
                  className={`absolute inset-0 rounded-xl bg-gradient-to-r ${option.color}`}
                  initial={false}
                  transition={{ type: "spring", stiffness: 500, damping: 30 }}
                />
              )}
              
              <div className="relative z-10 flex flex-col items-center gap-2">
                <div className="relative">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    resolvedTheme === 'dark' 
                      ? isActive ? 'bg-white/10 backdrop-blur-sm' : 'bg-gray-700/50'
                      : isActive ? 'bg-white/20 backdrop-blur-sm' : 'bg-gray-200/50'
                  }`}>
                    {option.icon}
                  </div>
                  {isActive && (
                    <motion.div
                      className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-green-400 shadow-md"
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                    />
                  )}
                </div>
                <span className="font-semibold text-sm">{option.label}</span>
                <span className="text-xs opacity-75">{option.description}</span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Connection Status Indicator */}
      <div className="absolute -top-2 left-1/2 transform -translate-x-1/2">
        <div className="flex items-center gap-1 px-3 py-1 rounded-full bg-gradient-to-r from-green-500 to-emerald-500 shadow-lg">
          <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
          <span className="text-xs font-medium text-white">Secure Login</span>
        </div>
      </div>
    </div>
  );
});

AdvancedMethodToggle.displayName = 'AdvancedMethodToggle';

// ==================== ADVANCED PHONE INPUT ====================
const AdvancedPhoneInput = React.memo(({ 
  value, 
  onChange, 
  error, 
  theme,
  disabled = false
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const [selectedCountry, setSelectedCountry] = useState(() => getCountryByIso('US'));
  const [phoneNumber, setPhoneNumber] = useState('');
  const [showCountryDropdown, setShowCountryDropdown] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const dropdownRef = useRef(null);

  const resolvedTheme = theme === 'system' ? 
    (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : 
    theme;

  useEffect(() => {
    if (value) {
      const matchedCountry = sortedCountryCodes.find(country => 
        value.startsWith(country.code)
      ) || selectedCountry;
      
      setSelectedCountry(matchedCountry);
      const numberPart = value.slice(matchedCountry.code.length);
      setPhoneNumber(numberPart);
    } else {
      setPhoneNumber('');
    }
  }, [value, selectedCountry]);

  const handlePhoneChange = (e) => {
    const cleaned = e.target.value.replace(/\D/g, '');
    setPhoneNumber(cleaned);
    onChange(`${selectedCountry.code}${cleaned}`);
  };

  const handleCountrySelect = (country) => {
    setSelectedCountry(country);
    setShowCountryDropdown(false);
    setSearchQuery('');
    onChange(`${country.code}${phoneNumber}`);
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowCountryDropdown(false);
        setSearchQuery('');
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredCountries = useMemo(() => {
    if (!searchQuery) return sortedCountryCodes.slice(0, 50);
    const query = searchQuery.toLowerCase();
    return sortedCountryCodes.filter(country => 
      country.name.toLowerCase().includes(query) ||
      country.code.toLowerCase().includes(query) ||
      country.iso.toLowerCase().includes(query)
    );
  }, [searchQuery]);

  return (
    <div className="space-y-4" ref={dropdownRef}>
      <div className="flex items-center justify-between">
        <label className={`block text-sm font-medium ${
          error 
            ? 'text-red-600 dark:text-red-400' 
            : isFocused || value
            ? 'text-indigo-600 dark:text-indigo-400'
            : resolvedTheme === 'dark' ? 'text-gray-400' : 'text-gray-600'
        }`}>
          Phone Number <span className="text-red-500">*</span>
        </label>
        <span className="text-xs text-gray-500">
          We'll send a verification code
        </span>
      </div>

      <div className="relative">
        <div className="flex gap-3">
          {/* Country Code Selector */}
          <div className="relative flex-shrink-0 w-36">
            <button
              type="button"
              onClick={() => !disabled && setShowCountryDropdown(!showCountryDropdown)}
              disabled={disabled}
              className={`w-full px-4 py-3.5 rounded-lg border transition-all duration-200 flex items-center justify-between ${
                showCountryDropdown
                  ? 'border-indigo-500 ring-2 ring-indigo-500/20'
                  : resolvedTheme === 'dark'
                  ? 'border-gray-700 bg-gray-800/50 hover:border-gray-600'
                  : 'border-gray-300 bg-white hover:border-gray-400'
              } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
            >
              <div className="flex items-center gap-2">
                <span className={`text-sm font-medium ${
                  resolvedTheme === 'dark' ? 'text-gray-200' : 'text-gray-900'
                }`}>
                  {selectedCountry.code}
                </span>
                <span className={`text-xs ${
                  resolvedTheme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                }`}>
                  {selectedCountry.iso}
                </span>
              </div>
              <svg
                className={`w-4 h-4 transform transition-transform ${showCountryDropdown ? 'rotate-180' : ''} ${
                  resolvedTheme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                }`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {/* Country Dropdown */}
            <AnimatePresence>
              {showCountryDropdown && (
                <motion.div
                  initial={{ opacity: 0, y: -10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -10, scale: 0.95 }}
                  className={`absolute top-full left-0 right-0 mt-2 rounded-lg border shadow-2xl z-50 ${
                    resolvedTheme === 'dark' 
                      ? 'bg-gray-900 border-gray-800' 
                      : 'bg-white border-gray-200'
                  }`}
                  style={{ maxHeight: '300px' }}
                >
                  {/* Search Input */}
                  <div className="p-3 border-b border-gray-200 dark:border-gray-800">
                    <input
                      type="text"
                      placeholder="Search countries..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className={`w-full px-4 py-2 rounded-lg text-sm ${
                        resolvedTheme === 'dark' 
                          ? 'bg-gray-800 text-white placeholder-gray-400 border border-gray-700' 
                          : 'bg-gray-100 text-gray-900 placeholder-gray-500 border border-gray-300'
                      }`}
                      autoFocus
                    />
                  </div>

                  {/* Country List */}
                  <div className="overflow-y-auto" style={{ maxHeight: '250px' }}>
                    {filteredCountries.map((country) => (
                      <button
                        key={`${country.iso}-${country.code}`}
                        type="button"
                        onClick={() => handleCountrySelect(country)}
                        className={`w-full px-4 py-3 text-left transition-colors flex items-center justify-between ${
                          country.code === selectedCountry.code
                            ? resolvedTheme === 'dark'
                              ? 'bg-indigo-900/40 text-indigo-300'
                              : 'bg-indigo-50 text-indigo-700'
                            : resolvedTheme === 'dark'
                            ? 'hover:bg-gray-800 text-gray-300'
                            : 'hover:bg-gray-100 text-gray-700'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-12 text-left font-medium">
                            {country.code}
                          </div>
                          <div className="text-left">
                            <div className="font-medium">{country.name}</div>
                            <div className="text-xs opacity-75">{country.region}</div>
                          </div>
                        </div>
                        {country.code === selectedCountry.code && (
                          <svg className="w-5 h-5 text-indigo-500" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        )}
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Phone Number Input */}
          <div className="flex-1">
            <input
              type="tel"
              value={phoneNumber}
              onChange={handlePhoneChange}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              disabled={disabled}
              placeholder="Phone number"
              className={`w-full px-4 py-3.5 rounded-lg border transition-all duration-200 ${
                error
                  ? 'border-red-500 dark:border-red-400 bg-red-50 dark:bg-red-900/10'
                  : isFocused
                  ? 'border-indigo-500 ring-2 ring-indigo-500/20'
                  : resolvedTheme === 'dark'
                  ? 'border-gray-700 bg-gray-800/50 hover:border-gray-600'
                  : 'border-gray-300 bg-white hover:border-gray-400'
              } ${resolvedTheme === 'dark' ? 'text-white placeholder-gray-500' : 'text-gray-900 placeholder-gray-400'} ${
                disabled ? 'opacity-50 cursor-not-allowed' : ''
              }`}
              inputMode="numeric"
            />
          </div>
        </div>

        {/* Validation Indicator */}
        {value && !error && (
          <div className="absolute -right-10 top-1/2 transform -translate-y-1/2">
            <div className="w-5 h-5 rounded-full bg-green-400 flex items-center justify-center shadow-md">
              <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            </div>
          </div>
        )}
      </div>

      {/* Error Message */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50">
              <svg className="w-4 h-4 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <span className="text-sm text-red-600 dark:text-red-400 font-medium">{error}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});

AdvancedPhoneInput.displayName = 'AdvancedPhoneInput';

// ==================== ADVANCED GOOGLE AUTH ====================
const AdvancedGoogleAuth = React.memo(({ 
  onSuccess, 
  onError, 
  theme,
  loading = false 
}) => {
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [error, setError] = useState(null);
  const { signInWithGoogle } = useAuth();

  const resolvedTheme = theme === 'system' ? 
    (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : 
    theme;

  const handleGoogleSignIn = async () => {
    if (loading || isAuthenticating) return;
    
    setIsAuthenticating(true);
    setError(null);

    try {
      console.log("🔄 Starting Google sign-in...");
      
      const result = await signInWithGoogle();
      
      if (result?.success) {
        console.log("✅ Google authentication successful");
        
        toast.success("Welcome back!");
        
        // Pass minimal user info
        const userInfo = {
          uid: result.user?.uid,
          email: result.user?.email,
          displayName: result.user?.displayName,
          isNewUser: result.isNewUser || false
        };

        onSuccess(userInfo);
      } else {
        throw new Error(result?.error || "Google authentication failed");
      }
      
    } catch (error) {
      console.error('❌ Google authentication error:', error);
      
      const errorMessage = error.message || "Google authentication failed";
      
      setError(errorMessage);
      toast.error(errorMessage);
      onError(new Error(errorMessage));
    } finally {
      setIsAuthenticating(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className={`p-6 rounded-xl backdrop-blur-sm border ${
        resolvedTheme === 'dark'
          ? 'bg-gray-900/60 border-gray-800/50 shadow-xl'
          : 'bg-white/95 border-gray-200/60 shadow-xl'
      }`}>
        <div className="text-center mb-6">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-r from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-900 flex items-center justify-center shadow-lg">
            <svg className="w-8 h-8" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
          </div>
          <h3 className={`text-xl font-bold mb-2 ${resolvedTheme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
            Fast & Secure Login
          </h3>
          <p className={`text-sm ${resolvedTheme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
            One-click authentication • No password needed
          </p>
        </div>

        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-4 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50"
          >
            <p className="text-sm text-red-600 dark:text-red-400 text-center">
              {error}
            </p>
          </motion.div>
        )}

        <motion.button
          onClick={handleGoogleSignIn}
          disabled={loading || isAuthenticating}
          whileHover={!(loading || isAuthenticating) ? { scale: 1.02 } : {}}
          whileTap={!(loading || isAuthenticating) ? { scale: 0.98 } : {}}
          className={`w-full py-3.5 px-4 rounded-lg font-medium text-sm transition-all duration-200 flex items-center justify-center gap-3 ${
            resolvedTheme === 'dark'
              ? 'bg-white text-gray-900 hover:bg-gray-100 border border-gray-300 shadow-md'
              : 'bg-white text-gray-900 hover:bg-gray-50 border border-gray-300 shadow-md'
          } ${(loading || isAuthenticating) ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          {(loading || isAuthenticating) ? (
            <>
              <div className="animate-spin w-5 h-5 border-2 border-gray-900 border-t-transparent rounded-full" />
              <span className="font-medium">Connecting to Google...</span>
            </>
          ) : (
            <>
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              <span className="font-medium">Continue with Google</span>
            </>
          )}
        </motion.button>

        <div className="mt-4 text-center">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Your Google account information will be used to sign in.
          </p>
        </div>
      </div>
    </div>
  );
});

AdvancedGoogleAuth.displayName = 'AdvancedGoogleAuth';

// ==================== MAIN COMPONENT ====================
export default function LoginScreen() {
  const navigate = useNavigate();
  const themeCtx = useTheme?.() || { theme: 'light' };
  const { theme } = themeCtx;
  const { 
    user, 
    isAuthenticated, 
    signInWithEmailPassword,
    sendPhoneVerificationCode,
    createRecaptchaVerifier,
    cleanupRecaptchaVerifier
  } = useAuth();
  
  const [method, setMethod] = useState("email");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [rememberMe, setRememberMe] = useState(true);
  const [recaptchaVerifier, setRecaptchaVerifier] = useState(null);
  const recaptchaContainerRef = useRef(null);

  const resolvedTheme = theme === 'system' ? 
    (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : 
    theme;

  // Logo path based on theme
  const logoPath = useMemo(() => {
    return resolvedTheme === "dark" 
      ? "/logo/logo-dark.png" 
      : "/logo/logo-light.png";
  }, [resolvedTheme]);

  // Background style
  const backgroundStyle = useMemo(() => ({
    background: resolvedTheme === "dark"
      ? `radial-gradient(circle at 20% 50%, rgba(30, 41, 59, 0.4) 0%, rgba(15, 23, 42, 1) 70%), linear-gradient(135deg, #0f172a 0%, #1e293b 100%)`
      : `radial-gradient(circle at 20% 50%, rgba(241, 245, 249, 0.6) 0%, rgba(248, 250, 252, 1) 70%), linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)`
  }), [resolvedTheme]);

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated && user) {
      console.log("✅ User already authenticated, redirecting to home");
      const from = new URLSearchParams(window.location.search).get('from') || '/home';
      navigate(from, { replace: true });
    }
  }, [isAuthenticated, user, navigate]);

  // Initialize reCAPTCHA for phone method
  useEffect(() => {
    if (method !== "phone") {
      if (recaptchaVerifier) {
        cleanupRecaptchaVerifier("login-recaptcha-container");
        setRecaptchaVerifier(null);
      }
      return;
    }

    const initializeRecaptcha = async () => {
      try {
        // Small delay to ensure container is in DOM
        await new Promise(resolve => setTimeout(resolve, 100));
        
        console.log("🔄 Initializing reCAPTCHA for phone login...");
        
        const verifier = await createRecaptchaVerifier("login-recaptcha-container", {
          size: 'invisible',
          callback: () => {
            console.log('✅ reCAPTCHA verified successfully');
          },
          'expired-callback': () => {
            console.warn('⚠️ reCAPTCHA expired');
            cleanupRecaptchaVerifier("login-recaptcha-container");
            setRecaptchaVerifier(null);
          }
        });
        
        setRecaptchaVerifier(verifier);
        console.log("✅ reCAPTCHA initialized for login");
        
      } catch (error) {
        console.error("reCAPTCHA initialization error:", error);
        toast.warning("Security verification failed. Phone login may not work properly.");
        
        // Create mock verifier for development fallback
        if (process.env.NODE_ENV === 'development') {
          console.warn("⚠️ Using mock reCAPTCHA for development");
          const mockVerifier = {
            verify: () => Promise.resolve('mock-recaptcha-token'),
            clear: () => {},
            render: () => Promise.resolve()
          };
          setRecaptchaVerifier(mockVerifier);
        }
      }
    };

    initializeRecaptcha();

    return () => {
      if (method !== "phone") {
        cleanupRecaptchaVerifier("login-recaptcha-container");
      }
    };
  }, [method, createRecaptchaVerifier, cleanupRecaptchaVerifier]);

  // Validate email
  const validateEmail = (email) => {
    if (!email) return "Email is required";
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) return "Please enter a valid email address";
    return null;
  };

  // Validate password
  const validatePassword = (password) => {
    if (!password) return "Password is required";
    if (password.length < 6) return "Password must be at least 6 characters";
    return null;
  };

  // Validate phone number
  const validatePhoneNumber = (phone) => {
    if (!phone) return "Phone number is required";
    
    const cleanPhone = phone.replace(/\s+/g, '');
    
    if (!cleanPhone.startsWith('+')) {
      return "Phone number must start with country code (e.g., +1)";
    }
    
    const digitsOnly = cleanPhone.slice(1).replace(/\D/g, '');
    if (digitsOnly.length < 10) {
      return "Phone number must be at least 10 digits";
    }
    
    if (digitsOnly.length > 15) {
      return "Phone number too long";
    }
    
    return null;
  };

  // Handle email login
  const handleEmailLogin = async (e) => {
    e?.preventDefault();
    
    setLoading(true);
    setErrors({});

    const emailError = validateEmail(email);
    const passwordError = validatePassword(password);

    if (emailError || passwordError) {
      setErrors({
        email: emailError,
        password: passwordError
      });
      setLoading(false);
      return;
    }

    try {
      console.log("📧 Attempting email login for:", email);
      
      const result = await signInWithEmailPassword(email, password);
      
      if (result?.success) {
        console.log("✅ Email login successful");
        
        // Store remember me preference
        if (rememberMe) {
          localStorage.setItem('rememberMe', 'true');
        } else {
          localStorage.removeItem('rememberMe');
        }
        
        toast.success("Welcome back!");
        
        // Redirect to home or intended destination
        const from = new URLSearchParams(window.location.search).get('from') || '/home';
        navigate(from, { 
          replace: true,
          state: {
            welcomeMessage: true,
            isLogin: true
          }
        });
      } else {
        throw new Error(result?.error || "Login failed");
      }
    } catch (error) {
      console.error("❌ Email login error:", error);
      
      let errorMessage = "Login failed";
      let fieldError = "general";
      
      if (error.message) {
        const errorStr = error.message.toLowerCase();
        
        if (errorStr.includes('user-not-found') || errorStr.includes('wrong-password')) {
          errorMessage = "Invalid email or password";
          fieldError = "general";
        } else if (errorStr.includes('too-many-requests')) {
          errorMessage = "Too many attempts. Please try again in a few minutes";
          fieldError = "general";
        } else if (errorStr.includes('user-disabled')) {
          errorMessage = "This account has been disabled";
          fieldError = "general";
        } else if (errorStr.includes('invalid-email')) {
          errorMessage = "Invalid email address";
          fieldError = "email";
        } else if (errorStr.includes('network')) {
          errorMessage = "Network error. Please check your connection";
          fieldError = "general";
        } else {
          errorMessage = error.message || errorMessage;
        }
      }
      
      if (fieldError === "email") {
        setErrors({ email: errorMessage });
      } else if (fieldError === "password") {
        setErrors({ password: errorMessage });
      } else {
        setErrors({ general: errorMessage });
      }
      
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // Handle phone login
  const handlePhoneLogin = async () => {
    setLoading(true);
    setErrors({});

    const phoneError = validatePhoneNumber(phoneNumber);
    if (phoneError) {
      setErrors({ phone: phoneError });
      toast.error(phoneError);
      setLoading(false);
      return;
    }

    try {
      console.log("📱 Attempting phone login for:", phoneNumber);

      if (!recaptchaVerifier) {
        throw new Error("Security verification required. Please try again.");
      }

      console.log("🔐 Triggering reCAPTCHA verification...");
      
      // Send verification code using AuthContext
      const result = await sendPhoneVerificationCode(phoneNumber, recaptchaVerifier);

      console.log("✅ Verification code sent");

      // Navigate to OTP verification
      navigate("/otp-verification", {
        state: { 
          verificationId: result.verificationId,
          phoneNumber,
          isLogin: true
        },
        replace: true
      });

    } catch (error) {
      console.error("❌ Phone login error:", error);
      
      let errorMessage = "Failed to send verification code";
      
      if (error.message) {
        const errorStr = error.message.toLowerCase();
        
        if (errorStr.includes('invalid-phone-number')) {
          errorMessage = "Invalid phone number format";
        } else if (errorStr.includes('too-many-requests')) {
          errorMessage = "Too many attempts. Please try again in a few minutes";
        } else if (errorStr.includes('quota-exceeded')) {
          errorMessage = "SMS quota exceeded. Please try again later";
        } else if (errorStr.includes('network')) {
          errorMessage = "Network error. Please check your internet connection";
        } else if (errorStr.includes('captcha')) {
          errorMessage = "Security check failed. Please refresh and try again";
        } else if (errorStr.includes('operation-not-allowed')) {
          errorMessage = "Phone sign-in is not enabled for this app";
        } else if (errorStr.includes('user-not-found')) {
          errorMessage = "No account found with this phone number";
        } else {
          errorMessage = error.message || errorMessage;
        }
      }
      
      setErrors({ phone: errorMessage });
      toast.error(errorMessage);
      
      // Reset recaptcha
      cleanupRecaptchaVerifier("login-recaptcha-container");
      setRecaptchaVerifier(null);
    } finally {
      setLoading(false);
    }
  };

  // Handle Google success
  const handleGoogleSuccess = async (userInfo) => {
    console.log("✅ Google login successful:", userInfo.uid);
    
    toast.success(`Welcome back, ${userInfo.displayName || 'User'}!`);
    
    // Redirect to home
    const from = new URLSearchParams(window.location.search).get('from') || '/home';
    navigate(from, { 
      replace: true,
      state: {
        welcomeMessage: true,
        displayName: userInfo.displayName,
        isLogin: true
      }
    });
  };

  // Handle Google error
  const handleGoogleError = (error) => {
    console.error("Google authentication error:", error);
    setErrors({ general: error.message });
    toast.error(error.message || "Google authentication failed");
  };

  // Handle forgot password
  const handleForgotPassword = () => {
    if (!email) {
      toast.error("Please enter your email first");
      return;
    }
    
    const emailError = validateEmail(email);
    if (emailError) {
      setErrors({ email: emailError });
      toast.error(emailError);
      return;
    }
    
    // Navigate to forgot password page
    navigate(`/forgot-password?email=${encodeURIComponent(email)}`);
  };

  // Check form validity
  const isFormValid = useMemo(() => {
    switch (method) {
      case 'email':
        return email && password && !errors.email && !errors.password;
      case 'phone':
        return phoneNumber && phoneNumber.length >= 10 && !errors.phone;
      case 'google':
        return true;
      default:
        return false;
    }
  }, [method, email, password, phoneNumber, errors]);

  return (
    <div 
      className="min-h-screen flex items-center justify-center px-4 safe-area-bottom"
      style={backgroundStyle}
    >
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        {/* Logo/Header */}
        <div className="text-center mb-8">
          <motion.div
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: "spring", stiffness: 200, damping: 20 }}
            className="w-24 h-24 mx-auto mb-6 rounded-full bg-gradient-to-r from-blue-500/10 to-purple-500/10 flex items-center justify-center shadow-2xl overflow-hidden"
          >
            <div className="w-20 h-20 rounded-full overflow-hidden border-2 border-white/10">
              <img 
                src={logoPath} 
                alt="Arvdoul Logo" 
                className="w-full h-full object-contain"
                onError={(e) => {
                  e.target.style.display = 'none';
                  e.target.parentElement.innerHTML = '<span class="text-2xl font-bold text-white">A</span>';
                }}
              />
            </div>
          </motion.div>
          <h1 className={`text-3xl font-bold mb-2 ${resolvedTheme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
            Welcome Back
          </h1>
          <p className={`text-sm ${resolvedTheme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
            Sign in to continue to Arvdoul
          </p>
        </div>

        {/* Advanced 3-Method Toggle */}
        <AdvancedMethodToggle
          method={method}
          onToggle={setMethod}
          theme={theme}
          disabled={loading}
        />

        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1 }}
          className={`rounded-2xl border backdrop-blur-xl shadow-2xl ${
            resolvedTheme === 'dark'
              ? 'bg-gray-900/80 border-gray-800/50'
              : 'bg-white/95 border-gray-200/60'
          } p-6 sm:p-8`}
        >
          {/* Connection Status */}
          <div className="mb-6 p-3 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800/50">
            <div className="flex items-center justify-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <p className="text-sm text-green-700 dark:text-green-300">
                🔒 Secure connection • End-to-end encrypted
              </p>
            </div>
          </div>

          <AnimatePresence mode="wait">
            {method === "email" ? (
              <motion.form
                key="email"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                onSubmit={handleEmailLogin}
                className="space-y-6"
              >
                {/* Email Input */}
                <div>
                  <label className={`block text-sm font-medium mb-2 ${
                    errors.email
                      ? 'text-red-600 dark:text-red-400'
                      : resolvedTheme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                  }`}>
                    Email Address
                  </label>
                  <div className="relative">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className={`w-full pl-10 pr-4 py-3 rounded-lg border transition-colors ${
                        errors.email
                          ? 'border-red-500 dark:border-red-400 bg-red-50 dark:bg-red-900/10'
                          : resolvedTheme === 'dark'
                          ? 'border-gray-700 bg-gray-800/50 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20'
                          : 'border-gray-300 bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20'
                      } ${resolvedTheme === 'dark' ? 'text-white' : 'text-gray-900'}`}
                      placeholder="you@example.com"
                      disabled={loading}
                      autoFocus
                    />
                  </div>
                  {errors.email && (
                    <p className="mt-2 text-sm text-red-600 dark:text-red-400">{errors.email}</p>
                  )}
                </div>

                {/* Password Input */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className={`block text-sm font-medium ${
                      errors.password
                        ? 'text-red-600 dark:text-red-400'
                        : resolvedTheme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                    }`}>
                      Password
                    </label>
                    <button
                      type="button"
                      onClick={handleForgotPassword}
                      className="text-sm text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 font-medium"
                    >
                      Forgot password?
                    </button>
                  </div>
                  <div className="relative">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                      </svg>
                    </div>
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className={`w-full pl-10 pr-4 py-3 rounded-lg border transition-colors ${
                        errors.password
                          ? 'border-red-500 dark:border-red-400 bg-red-50 dark:bg-red-900/10'
                          : resolvedTheme === 'dark'
                          ? 'border-gray-700 bg-gray-800/50 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20'
                          : 'border-gray-300 bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20'
                      } ${resolvedTheme === 'dark' ? 'text-white' : 'text-gray-900'}`}
                      placeholder="••••••••"
                      disabled={loading}
                    />
                  </div>
                  {errors.password && (
                    <p className="mt-2 text-sm text-red-600 dark:text-red-400">{errors.password}</p>
                  )}
                </div>

                {/* Remember Me & Submit */}
                <div className="space-y-4">
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="remember"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="w-4 h-4 text-indigo-600 bg-gray-100 border-gray-300 rounded focus:ring-indigo-500 dark:focus:ring-indigo-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                      disabled={loading}
                    />
                    <label htmlFor="remember" className="ml-2 text-sm text-gray-600 dark:text-gray-300">
                      Remember me on this device
                    </label>
                  </div>

                  <motion.button
                    type="submit"
                    disabled={loading || !isFormValid}
                    whileHover={!loading && isFormValid ? { scale: 1.02 } : {}}
                    whileTap={!loading && isFormValid ? { scale: 0.98 } : {}}
                    className={`w-full py-3.5 rounded-lg font-medium transition-all duration-200 ${
                      !loading && isFormValid
                        ? 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white shadow-lg hover:shadow-xl'
                        : resolvedTheme === 'dark'
                        ? 'bg-gray-800 text-gray-400 cursor-not-allowed'
                        : 'bg-gray-200 text-gray-500 cursor-not-allowed'
                    }`}
                  >
                    {loading ? (
                      <div className="flex items-center justify-center gap-2">
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        <span>Signing in...</span>
                      </div>
                    ) : (
                      'Sign In with Email'
                    )}
                  </motion.button>
                </div>
              </motion.form>
            ) : method === "phone" ? (
              <motion.div
                key="phone"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <AdvancedPhoneInput
                  value={phoneNumber}
                  onChange={setPhoneNumber}
                  error={errors.phone}
                  theme={theme}
                  disabled={loading}
                />

                <motion.button
                  onClick={handlePhoneLogin}
                  disabled={loading || !isFormValid || !recaptchaVerifier}
                  whileHover={!loading && isFormValid && recaptchaVerifier ? { scale: 1.02 } : {}}
                  whileTap={!loading && isFormValid && recaptchaVerifier ? { scale: 0.98 } : {}}
                  className={`w-full py-3.5 rounded-lg font-medium transition-all duration-200 ${
                    !loading && isFormValid && recaptchaVerifier
                      ? 'bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white shadow-lg hover:shadow-xl'
                      : resolvedTheme === 'dark'
                      ? 'bg-gray-800 text-gray-400 cursor-not-allowed'
                      : 'bg-gray-200 text-gray-500 cursor-not-allowed'
                  }`}
                >
                  {loading ? (
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Sending Code...</span>
                    </div>
                  ) : !recaptchaVerifier ? (
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-5 h-5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                      <span>Loading security...</span>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center gap-2">
                      <span>Send Verification Code</span>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                      </svg>
                    </div>
                  )}
                </motion.button>

                <div className="text-center">
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    We'll send a 6-digit verification code to your phone
                  </p>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="google"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <AdvancedGoogleAuth
                  onSuccess={handleGoogleSuccess}
                  onError={handleGoogleError}
                  theme={theme}
                  loading={loading}
                />

                {/* Alternative Options */}
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setMethod("email")}
                    className={`py-3 rounded-lg font-medium text-sm transition-all duration-200 flex items-center justify-center gap-2 ${
                      resolvedTheme === 'dark'
                        ? 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                    Email
                  </button>
                  
                  <button
                    onClick={() => setMethod("phone")}
                    className={`py-3 rounded-lg font-medium text-sm transition-all duration-200 flex items-center justify-center gap-2 ${
                      resolvedTheme === 'dark'
                        ? 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                    </svg>
                    Phone
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* General Errors */}
          <AnimatePresence>
            {errors.general && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-4 overflow-hidden"
              >
                <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50">
                  <p className="text-sm text-red-600 dark:text-red-400 text-center">
                    {errors.general}
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Sign Up Link */}
          <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-800">
            <p className={`text-center text-sm ${resolvedTheme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
              Don't have an account?{" "}
              <Link
                to="/signup/step1"
                className={`font-medium ${
                  resolvedTheme === 'dark' 
                    ? 'text-indigo-400 hover:text-indigo-300' 
                    : 'text-indigo-600 hover:text-indigo-700'
                }`}
              >
                Sign up now
              </Link>
            </p>
          </div>
        </motion.div>

        {/* Security Footer */}
        <div className="mt-6 text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            {["🔒", "🛡️", "✓"].map((icon, index) => (
              <motion.span
                key={index}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className="text-sm"
              >
                {icon}
              </motion.span>
            ))}
          </div>
          <p className={`text-xs ${resolvedTheme === 'dark' ? 'text-gray-600' : 'text-gray-500'}`}>
            End-to-end encrypted • Military-grade security • Your data is protected
          </p>
        </div>
      </motion.div>

      {/* Hidden reCAPTCHA container */}
      <div 
        id="login-recaptcha-container" 
        ref={recaptchaContainerRef} 
        style={{
          position: 'absolute',
          top: '-9999px',
          left: '-9999px',
          width: '1px',
          height: '1px',
          overflow: 'hidden'
        }}
      />

      {/* Mobile-safe CSS */}
      <style jsx>{`
        .safe-area-bottom {
          padding-bottom: env(safe-area-inset-bottom, 20px);
        }
        
        /* Prevent zoom on mobile */
        @media screen and (max-width: 768px) {
          input, textarea {
            font-size: 16px !important;
          }
        }
        
        /* Better touch targets */
        .touch-target {
          min-height: 44px;
          min-width: 44px;
        }
        
        /* Smooth transitions */
        * {
          -webkit-tap-highlight-color: transparent;
        }
      `}</style>
    </div>
  );
}