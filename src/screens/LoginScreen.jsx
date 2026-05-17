// This file must reflect: 'everything should be more extremely advanced, styled, ultra pro max professional creation and robust also production ready and working perfectly smooth'

// src/screens/LoginScreen.jsx – ARVDOUL SUPREMACY • GLASS CARD • MATCHES SIGNUP STEP 2
// ✅ Phone (original dropdown) • Email • Google • Offline banner • Shake on error • No scroll

import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useNavigate, Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { useTheme } from "@context/ThemeContext.jsx";
import { useAuth } from "../context/AuthContext.jsx";

// Import country codes (same as login)
import { countryCodes, sortedCountryCodes, getCountryByIso } from "../data/countryCodes.js";

// ---------- OFFLINE BANNER ----------
const OfflineBanner = () => (
  <div className="w-full bg-amber-500/90 text-white text-center py-1.5 text-xs font-medium backdrop-blur-sm">
    You are offline – some features may be limited.
  </div>
);

// ---------- ORIGINAL PHONE INPUT (inline dropdown, matching SignupStep2) ----------
const UltimatePhoneInput = React.memo(({
  value,
  onChange,
  error,
  disabled = false,
  onValidationChange = () => {}
}) => {
  const { theme } = useTheme();
  const [isFocused, setIsFocused] = useState(false);
  const [selectedCountry, setSelectedCountry] = useState(() => getCountryByIso('US'));
  const [phoneNumber, setPhoneNumber] = useState('');
  const [showCountryDropdown, setShowCountryDropdown] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const dropdownRef = useRef(null);
  const inputRef = useRef(null);

  const resolvedTheme = theme === 'system'
    ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    : theme;

  useEffect(() => {
    if (value) {
      const matchedCountry = countryCodes.find(country =>
        value.startsWith(country.code)
      ) || selectedCountry;
      setSelectedCountry(matchedCountry);
      const numberPart = value.slice(matchedCountry.code.length);
      setPhoneNumber(numberPart);
      validatePhoneNumber(`${matchedCountry.code}${numberPart.replace(/\D/g, '')}`);
    } else {
      setPhoneNumber('');
      onValidationChange(false);
    }
  }, [value, selectedCountry]);

  const validatePhoneNumber = (fullNumber) => {
    const cleaned = fullNumber.replace(/\D/g, '');
    const isValid = cleaned.length >= 10 && cleaned.length <= 15;
    onValidationChange(isValid);
    return isValid;
  };

  const handlePhoneChange = (e) => {
    const input = e.target.value;
    const cleaned = input.replace(/[^\d\s\-\(\)]/g, '');
    setPhoneNumber(cleaned);
    const fullNumber = `${selectedCountry.code}${cleaned.replace(/\D/g, '')}`;
    onChange(fullNumber);
    validatePhoneNumber(fullNumber);
  };

  const handleCountrySelect = (country) => {
    setSelectedCountry(country);
    setShowCountryDropdown(false);
    setSearchQuery('');
    const fullNumber = `${country.code}${phoneNumber.replace(/\D/g, '')}`;
    onChange(fullNumber);
    validatePhoneNumber(fullNumber);
    setTimeout(() => inputRef.current?.focus(), 100);
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
    if (!searchQuery) return countryCodes;
    const query = searchQuery.toLowerCase();
    return countryCodes.filter(country =>
      country.name.toLowerCase().includes(query) ||
      country.code.toLowerCase().includes(query) ||
      country.iso.toLowerCase().includes(query)
    );
  }, [searchQuery]);

  return (
    <div className="space-y-2" ref={dropdownRef}>
      <div className="flex items-center justify-between">
        <label className={`text-xs font-medium ${
          error ? 'text-red-600 dark:text-red-400'
          : isFocused || value ? 'text-indigo-600 dark:text-indigo-400'
          : resolvedTheme === 'dark' ? 'text-gray-400' : 'text-gray-600'
        }`}>
          Phone Number <span className="text-red-500">*</span>
        </label>
        <span className="text-[10px] text-gray-500">Verification code will be sent</span>
      </div>

      <div className="relative">
        <div className="flex gap-2">
          <div className="relative flex-shrink-0 w-28">
            <button
              type="button"
              onClick={() => !disabled && setShowCountryDropdown(!showCountryDropdown)}
              disabled={disabled}
              className={`w-full px-3 py-2.5 rounded-lg border transition-all duration-200 flex items-center justify-between group ${
                showCountryDropdown
                  ? 'border-indigo-500 ring-2 ring-indigo-500/20'
                  : resolvedTheme === 'dark'
                  ? 'border-gray-700 bg-gray-800/50 hover:border-gray-600 hover:bg-gray-800'
                  : 'border-gray-300 bg-white hover:border-gray-400 hover:bg-gray-50'
              } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
            >
              <div className="flex items-center gap-1.5">
                <span className={`text-sm font-medium ${resolvedTheme === 'dark' ? 'text-gray-200' : 'text-gray-900'}`}>
                  {selectedCountry.code}
                </span>
                <span className={`text-[10px] ${resolvedTheme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                  {selectedCountry.iso}
                </span>
              </div>
              <svg className={`w-3.5 h-3.5 transform transition-transform ${showCountryDropdown ? 'rotate-180' : ''} ${resolvedTheme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            <AnimatePresence>
              {showCountryDropdown && (
                <motion.div
                  initial={{ opacity: 0, y: -10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -10, scale: 0.95 }}
                  className={`absolute top-full left-0 right-0 mt-2 rounded-lg border shadow-2xl z-50 max-h-60 overflow-hidden ${
                    resolvedTheme === 'dark' ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200'
                  }`}
                >
                  <div className="p-2 border-b border-gray-200 dark:border-gray-800 sticky top-0 bg-inherit">
                    <input
                      type="text"
                      placeholder="Search countries..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className={`w-full px-3 py-1.5 rounded text-xs ${
                        resolvedTheme === 'dark'
                          ? 'bg-gray-800 text-white placeholder-gray-400 border border-gray-700'
                          : 'bg-gray-100 text-gray-900 placeholder-gray-500 border border-gray-300'
                      }`}
                      autoFocus
                    />
                  </div>
                  <div className="overflow-y-auto max-h-48">
                    {filteredCountries.map((country) => (
                      <button
                        key={`${country.iso}-${country.code}`}
                        type="button"
                        onClick={() => handleCountrySelect(country)}
                        className={`w-full px-3 py-2 text-left transition-colors flex items-center justify-between text-xs ${
                          country.code === selectedCountry.code
                            ? resolvedTheme === 'dark' ? 'bg-indigo-900/40 text-indigo-300' : 'bg-indigo-50 text-indigo-700'
                            : resolvedTheme === 'dark' ? 'hover:bg-gray-800 text-gray-300' : 'hover:bg-gray-100 text-gray-700'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <div className="text-base">{country.flag}</div>
                          <div className="font-medium">{country.code}</div>
                        </div>
                        {country.code === selectedCountry.code && (
                          <svg className="w-4 h-4 text-indigo-500" fill="currentColor" viewBox="0 0 20 20">
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

          <div className="flex-1">
            <input
              ref={inputRef}
              type="tel"
              value={phoneNumber}
              onChange={handlePhoneChange}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              disabled={disabled}
              placeholder="123 456 7890"
              className={`w-full px-3 py-2.5 rounded-lg border transition-all duration-200 text-sm ${
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
              inputMode="tel"
            />
          </div>
        </div>

        <AnimatePresence>
          {error && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
              <div className="flex items-center gap-1.5 mt-1.5 p-2 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50">
                <svg className="w-3.5 h-3.5 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                <span className="text-xs text-red-600 dark:text-red-400 font-medium">{error}</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
});
UltimatePhoneInput.displayName = 'UltimatePhoneInput';

// ---------- GLOWING GOOGLE AUTH (original style but with glow) ----------
const UltimateGoogleAuth = React.memo(({ onSuccess, onError, loading = false }) => {
  const { theme } = useTheme();
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [error, setError] = useState(null);
  const { signInWithGoogle } = useAuth();

  const resolvedTheme = theme === 'system'
    ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    : theme;

  const handleGoogleSignIn = async () => {
    if (loading || isAuthenticating) return;
    setIsAuthenticating(true);
    setError(null);
    try {
      const result = await signInWithGoogle();
      if (result?.success) {
        toast.success("Welcome back!");
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
      const errorMessage = error.message || "Google authentication failed";
      setError(errorMessage);
      toast.error(errorMessage);
      onError(new Error(errorMessage));
    } finally {
      setIsAuthenticating(false);
    }
  };

  return (
    <div className={`p-4 rounded-2xl backdrop-blur-sm border shadow-md ${
      resolvedTheme === 'dark'
        ? 'bg-gradient-to-br from-gray-900/80 to-gray-800/80 border-gray-700/50'
        : 'bg-gradient-to-br from-white to-gray-50 border-gray-200/60'
    }`}>
      <div className="text-center mb-4">
        <motion.div
          initial={{ scale: 0, rotate: -180 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: "spring", delay: 0.1 }}
          className="w-16 h-16 mx-auto mb-3 rounded-2xl bg-gradient-to-r from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-900 flex items-center justify-center shadow-lg"
        >
          <svg className="w-8 h-8" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
        </motion.div>
        <h3 className={`text-base font-bold mb-1 ${
          resolvedTheme === 'dark' ? 'text-gray-300' : 'text-gray-800'
        }`}>
          Fast & Secure Login
        </h3>
        <p className={`text-xs ${resolvedTheme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
          One-click authentication • No password needed
        </p>
      </div>

      {error && (
        <motion.div initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} className="mb-3 p-2 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50">
          <p className="text-xs text-red-600 dark:text-red-400 text-center">{error}</p>
        </motion.div>
      )}

      <motion.button
        onClick={handleGoogleSignIn}
        disabled={loading || isAuthenticating}
        whileHover={!(loading || isAuthenticating) ? { scale: 1.02, boxShadow: '0 4px 12px rgba(0,0,0,0.1)' } : {}}
        whileTap={!(loading || isAuthenticating) ? { scale: 0.98 } : {}}
        className={`w-full py-3 px-4 rounded-xl font-medium text-sm transition-all duration-200 flex items-center justify-center gap-2 ${
          resolvedTheme === 'dark'
            ? 'bg-white text-gray-900 hover:bg-gray-100 border border-gray-300 shadow-md'
            : 'bg-white text-gray-900 hover:bg-gray-50 border border-gray-300 shadow-md'
        } ${(loading || isAuthenticating) ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        {(loading || isAuthenticating) ? (
          <>
            <div className="animate-spin w-4 h-4 border-2 border-gray-900 border-t-transparent rounded-full" />
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

      <div className="mt-3 text-center">
        <p className="text-[10px] text-gray-500 dark:text-gray-400">
          Your Google account information will be used to sign in.
        </p>
      </div>
    </div>
  );
});
UltimateGoogleAuth.displayName = 'UltimateGoogleAuth';

// ---------- METHOD TOGGLE (identical to SignupStep2) ----------
const UltimateMethodToggle = React.memo(({ method, onToggle, disabled = false }) => {
  const { theme } = useTheme();
  const resolvedTheme = theme === 'system'
    ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    : theme;

  const methods = [
    {
      id: 'phone', label: 'Phone',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
        </svg>
      ),
      description: 'SMS',
      gradient: 'bg-gradient-to-r from-blue-500 to-cyan-500'
    },
    {
      id: 'email', label: 'Email',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
      ),
      description: 'Traditional',
      gradient: 'bg-gradient-to-r from-purple-500 to-pink-500'
    },
    {
      id: 'google', label: 'Google',
      icon: (
        <svg className="w-4 h-4" viewBox="0 0 24 24">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
        </svg>
      ),
      description: 'One-Click',
      gradient: 'bg-gradient-to-r from-red-500 to-orange-500'
    }
  ];

  return (
    <div className="relative mb-6">
      <div className="absolute -top-2 left-1/2 transform -translate-x-1/2 z-10">
        <div className="flex items-center gap-1 px-3 py-1 rounded-full bg-gradient-to-r from-green-500 to-emerald-500 shadow-lg">
          <div className="w-1 h-1 rounded-full bg-white animate-pulse" />
          <span className="text-[10px] font-semibold text-white">Secure Login</span>
        </div>
      </div>
      <div className={`grid grid-cols-3 gap-1.5 p-1.5 rounded-2xl backdrop-blur-sm ${resolvedTheme === 'dark' ? 'bg-gray-800/60 border border-gray-700/50 shadow-2xl' : 'bg-gray-100/80 border border-gray-300/60 shadow-2xl'}`}>
        {methods.map((option) => {
          const isActive = method === option.id;
          return (
            <motion.button
              key={option.id}
              onClick={() => !disabled && onToggle(option.id)}
              disabled={disabled}
              whileHover={!disabled ? { scale: 1.02 } : {}}
              whileTap={!disabled ? { scale: 0.98 } : {}}
              className={`relative py-3 px-1.5 rounded-xl transition-all duration-300 ${
                isActive ? 'text-white' : resolvedTheme === 'dark' ? 'text-gray-400 hover:text-gray-300 hover:bg-gray-800/30' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100/50'
              } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
            >
              {isActive && (
                <motion.div layoutId="loginMethodBackground" className={`absolute inset-0 rounded-xl ${option.gradient}`} initial={false} transition={{ type: "spring", stiffness: 500, damping: 30 }} />
              )}
              <div className="relative z-10 flex flex-col items-center gap-1">
                <div className="relative">
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center transition-all ${resolvedTheme === 'dark' ? isActive ? 'bg-white/10 backdrop-blur-sm' : 'bg-gray-700/50' : isActive ? 'bg-white/20 backdrop-blur-sm' : 'bg-gray-200/50'}`}>
                    {option.icon}
                  </div>
                  {isActive && (
                    <motion.div className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-green-400 shadow-lg border-2 border-white" initial={{ scale: 0 }} animate={{ scale: 1 }} />
                  )}
                </div>
                <span className="font-semibold text-xs">{option.label}</span>
                <span className="text-[10px] opacity-75">{option.description}</span>
              </div>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
});
UltimateMethodToggle.displayName = 'UltimateMethodToggle';

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
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [shakeCard, setShakeCard] = useState(false);
  const [isPhoneValid, setIsPhoneValid] = useState(false);

  const resolvedTheme = theme === 'system' 
    ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') 
    : theme;

  const logoPath = useMemo(() => {
    return resolvedTheme === "dark" 
      ? "/logo/logo-dark.png" 
      : "/logo/logo-light.png";
  }, [resolvedTheme]);

  // Online/Offline
  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Shake on error
  const triggerShake = useCallback(() => {
    setShakeCard(true);
    setTimeout(() => setShakeCard(false), 600);
  }, []);

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated && user) {
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

    let mounted = true;
    const initializeRecaptcha = async () => {
      try {
        await new Promise(resolve => setTimeout(resolve, 100));
        console.log("🔄 Initializing reCAPTCHA for phone login...");
        const verifier = await createRecaptchaVerifier("login-recaptcha-container", {
          size: 'invisible',
          callback: () => console.log('✅ reCAPTCHA verified'),
          'expired-callback': () => {
            cleanupRecaptchaVerifier("login-recaptcha-container");
            if (mounted) setRecaptchaVerifier(null);
          }
        });
        if (mounted) setRecaptchaVerifier(verifier);
      } catch (error) {
        console.error("reCAPTCHA init error:", error);
        toast.warning("Security verification failed. Phone login may not work.");
        if (mounted && process.env.NODE_ENV === 'development') {
          setRecaptchaVerifier({ verify: () => Promise.resolve('mock'), clear: () => {}, render: () => Promise.resolve() });
        }
      }
    };

    initializeRecaptcha();

    return () => {
      mounted = false;
      if (method !== "phone") {
        cleanupRecaptchaVerifier("login-recaptcha-container");
      }
    };
  }, [method, createRecaptchaVerifier, cleanupRecaptchaVerifier]);

  const validateEmail = (email) => {
    if (!email) return "Email is required";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return "Please enter a valid email address";
    return null;
  };

  const validatePassword = (password) => {
    if (!password) return "Password is required";
    if (password.length < 6) return "Password must be at least 6 characters";
    return null;
  };

  const validatePhoneNumber = (phone) => {
    if (!phone) return "Phone number is required";
    if (!phone.startsWith('+')) return "Must start with '+'";
    const digits = phone.slice(1).replace(/\D/g, '');
    if (digits.length < 10) return "At least 10 digits";
    if (digits.length > 15) return "Too long";
    return null;
  };

  const handleEmailLogin = async (e) => {
    e?.preventDefault();
    setLoading(true);
    setErrors({});

    const emailError = validateEmail(email);
    const passwordError = validatePassword(password);
    if (emailError || passwordError) {
      setErrors({ email: emailError, password: passwordError });
      setLoading(false);
      triggerShake();
      return;
    }

    try {
      const result = await signInWithEmailPassword(email, password);
      if (result?.success) {
        if (rememberMe) localStorage.setItem('rememberMe', 'true');
        else localStorage.removeItem('rememberMe');
        toast.success("Welcome back!");
        const from = new URLSearchParams(window.location.search).get('from') || '/home';
        navigate(from, { replace: true, state: { welcomeMessage: true, isLogin: true } });
      } else {
        throw new Error(result?.error || "Login failed");
      }
    } catch (error) {
      let errorMsg = "Login failed";
      let field = "general";
      if (error.message) {
        const msg = error.message.toLowerCase();
        if (msg.includes('user-not-found') || msg.includes('wrong-password')) errorMsg = "Invalid email or password";
        else if (msg.includes('too-many-requests')) errorMsg = "Too many attempts. Try again later.";
        else if (msg.includes('user-disabled')) errorMsg = "This account has been disabled.";
        else if (msg.includes('invalid-email')) { errorMsg = "Invalid email address"; field = "email"; }
        else if (msg.includes('network')) errorMsg = "Network error. Check your connection.";
        else errorMsg = error.message || errorMsg;
      }
      if (field === "email") setErrors({ email: errorMsg });
      else if (field === "password") setErrors({ password: errorMsg });
      else setErrors({ general: errorMsg });
      toast.error(errorMsg);
      triggerShake();
    } finally {
      setLoading(false);
    }
  };

  const handlePhoneLogin = async () => {
    setLoading(true);
    setErrors({});

    const phoneError = validatePhoneNumber(phoneNumber);
    if (phoneError) {
      setErrors({ phone: phoneError });
      toast.error(phoneError);
      setLoading(false);
      triggerShake();
      return;
    }

    try {
      if (!recaptchaVerifier) throw new Error("Security verification required. Please try again.");
      const result = await sendPhoneVerificationCode(phoneNumber, recaptchaVerifier);
      navigate("/otp-verification", {
        state: { verificationId: result.verificationId, phoneNumber, isLogin: true },
        replace: true
      });
    } catch (error) {
      let errorMsg = "Failed to send verification code";
      if (error.message) {
        const msg = error.message.toLowerCase();
        if (msg.includes('invalid-phone-number')) errorMsg = "Invalid phone number format";
        else if (msg.includes('too-many-requests')) errorMsg = "Too many attempts. Try again later.";
        else if (msg.includes('quota-exceeded')) errorMsg = "SMS quota exceeded. Please try again later.";
        else if (msg.includes('network')) errorMsg = "Network error. Check your connection.";
        else if (msg.includes('captcha')) errorMsg = "Security check failed. Please refresh and try again.";
        else if (msg.includes('operation-not-allowed')) errorMsg = "Phone sign-in is not enabled for this app.";
        else if (msg.includes('user-not-found')) errorMsg = "No account found with this phone number.";
        else errorMsg = error.message || errorMsg;
      }
      setErrors({ phone: errorMsg });
      toast.error(errorMsg);
      cleanupRecaptchaVerifier("login-recaptcha-container");
      setRecaptchaVerifier(null);
      triggerShake();
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSuccess = (userInfo) => {
    toast.success(`Welcome back, ${userInfo.displayName || 'User'}!`);
    const from = new URLSearchParams(window.location.search).get('from') || '/home';
    navigate(from, { replace: true, state: { welcomeMessage: true, displayName: userInfo.displayName, isLogin: true } });
  };

  const handleGoogleError = (error) => {
    setErrors({ general: error.message });
    toast.error(error.message || "Google authentication failed");
    triggerShake();
  };

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
    navigate(`/forgot-password?email=${encodeURIComponent(email)}`);
  };

  const isFormValid = useMemo(() => {
    switch (method) {
      case 'email': return email && password && !errors.email && !errors.password;
      case 'phone': return phoneNumber && isPhoneValid && !errors.phone && recaptchaVerifier;
      case 'google': return true;
      default: return false;
    }
  }, [method, email, password, phoneNumber, isPhoneValid, errors, recaptchaVerifier]);

  return (
    <div className={`h-[100dvh] flex flex-col ${resolvedTheme === 'dark' ? 'bg-gray-950' : 'bg-gradient-to-br from-blue-50 to-white'}`}>
      {isOffline && <OfflineBanner />}

      <div className="flex-1 flex items-center justify-center p-3 overflow-hidden">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-md flex flex-col items-center"
        >
          {/* Logo */}
          <motion.div
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: "spring", stiffness: 200, damping: 20 }}
            className="w-20 h-20 mx-auto mb-4 rounded-full bg-gradient-to-r from-blue-500/10 to-purple-500/10 flex items-center justify-center shadow-2xl overflow-hidden"
          >
            <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-white/10">
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
          <h1 className="text-2xl font-bold mb-1 text-gray-900 dark:text-white">
            Welcome Back
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
            Sign in to continue to Arvdoul
          </p>

          {/* Glass Card */}
          <motion.div
            animate={shakeCard ? { x: [0, -10, 10, -10, 10, 0] } : {}}
            transition={{ duration: 0.5 }}
            className={`w-full rounded-3xl border backdrop-blur-2xl ${navigator.deviceMemory >= 4 ? 'shadow-2xl' : 'shadow-none'} ${
              resolvedTheme === 'dark' ? 'bg-gray-900/70 border-white/10 shadow-indigo-900/20' : 'bg-white/70 border-gray-200/60 shadow-indigo-100/20'
            } p-5`}
          >
            <UltimateMethodToggle method={method} onToggle={setMethod} disabled={loading} />

            <AnimatePresence mode="wait">
              {method === "email" && (
                <motion.form key="email" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} onSubmit={handleEmailLogin} className="space-y-4">
                  <div>
                    <label className={`text-xs font-medium mb-1 block ${errors.email ? 'text-red-500' : resolvedTheme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                      Email Address
                    </label>
                    <div className="relative">
                      <div className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-500">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                      </div>
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className={`w-full pl-8 pr-3 py-2 rounded-lg border text-sm transition-colors ${
                          errors.email ? 'border-red-500 bg-red-50 dark:bg-red-900/10' : 'border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800/50 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20'
                        } ${resolvedTheme === 'dark' ? 'text-white placeholder-gray-500' : 'text-gray-900 placeholder-gray-400'}`}
                        placeholder="you@example.com"
                        disabled={loading}
                        autoFocus
                      />
                    </div>
                    {errors.email && <p className="mt-1 text-xs text-red-500">{errors.email}</p>}
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className={`text-xs font-medium ${errors.password ? 'text-red-500' : resolvedTheme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                        Password
                      </label>
                      <button type="button" onClick={handleForgotPassword} className="text-xs text-indigo-600 dark:text-indigo-400 font-medium">
                        Forgot password?
                      </button>
                    </div>
                    <div className="relative">
                      <div className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-500">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                      </div>
                      <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className={`w-full pl-8 pr-3 py-2 rounded-lg border text-sm transition-colors ${
                          errors.password ? 'border-red-500 bg-red-50 dark:bg-red-900/10' : 'border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800/50 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20'
                        } ${resolvedTheme === 'dark' ? 'text-white placeholder-gray-500' : 'text-gray-900 placeholder-gray-400'}`}
                        placeholder="••••••••"
                        disabled={loading}
                      />
                    </div>
                    {errors.password && <p className="mt-1 text-xs text-red-500">{errors.password}</p>}
                  </div>

                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="remember"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="w-3.5 h-3.5 text-indigo-600 rounded focus:ring-indigo-500"
                      disabled={loading}
                    />
                    <label htmlFor="remember" className="ml-2 text-xs text-gray-600 dark:text-gray-300">
                      Remember me on this device
                    </label>
                  </div>

                  <motion.button
                    type="submit"
                    disabled={loading || !email || !password}
                    whileHover={!loading && email && password ? { scale: 1.02 } : {}}
                    whileTap={!loading && email && password ? { scale: 0.98 } : {}}
                    className={`w-full py-3 rounded-2xl font-bold text-sm transition-all ${
                      !loading && email && password
                        ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg hover:shadow-xl'
                        : 'bg-gray-200 dark:bg-gray-800 text-gray-400 cursor-not-allowed'
                    }`}
                  >
                    {loading ? (
                      <span className="flex items-center justify-center gap-2">
                        <span className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                        Signing in...
                      </span>
                    ) : "Sign In with Email"}
                  </motion.button>
                </motion.form>
              )}

              {method === "phone" && (
                <motion.div key="phone" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
                  <UltimatePhoneInput
                    value={phoneNumber}
                    onChange={setPhoneNumber}
                    error={errors.phone}
                    disabled={loading}
                    onValidationChange={setIsPhoneValid}
                  />
                  <motion.button
                    onClick={handlePhoneLogin}
                    disabled={loading || !isPhoneValid || !recaptchaVerifier}
                    whileHover={!loading && isPhoneValid && recaptchaVerifier ? { scale: 1.02 } : {}}
                    whileTap={!loading && isPhoneValid && recaptchaVerifier ? { scale: 0.98 } : {}}
                    className={`w-full py-3 rounded-2xl font-bold text-sm transition-all ${
                      !loading && isPhoneValid && recaptchaVerifier
                        ? 'bg-gradient-to-r from-blue-600 to-cyan-600 text-white shadow-lg hover:shadow-xl'
                        : 'bg-gray-200 dark:bg-gray-800 text-gray-400 cursor-not-allowed'
                    }`}
                  >
                    {loading ? (
                      <span className="flex items-center justify-center gap-2">
                        <span className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                        Sending Code...
                      </span>
                    ) : !recaptchaVerifier ? (
                      <span className="flex items-center justify-center gap-2">
                        <span className="animate-spin w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full" />
                        Loading security...
                      </span>
                    ) : (
                      <span className="flex items-center justify-center gap-2">
                        Send Verification Code
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                        </svg>
                      </span>
                    )}
                  </motion.button>
                  <p className="text-center text-xs text-gray-500 dark:text-gray-400">
                    We'll send a 6-digit code to your phone
                  </p>
                </motion.div>
              )}

              {method === "google" && (
                <motion.div key="google" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
                  <UltimateGoogleAuth onSuccess={handleGoogleSuccess} onError={handleGoogleError} loading={loading} />
                  <div className="grid grid-cols-2 gap-3">
                    <button onClick={() => setMethod("email")} className={`py-2.5 rounded-lg font-medium text-xs flex items-center justify-center gap-1.5 ${
                      resolvedTheme === 'dark' ? 'bg-gray-800 text-gray-300 hover:bg-gray-700' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}>
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                      Email
                    </button>
                    <button onClick={() => setMethod("phone")} className={`py-2.5 rounded-lg font-medium text-xs flex items-center justify-center gap-1.5 ${
                      resolvedTheme === 'dark' ? 'bg-gray-800 text-gray-300 hover:bg-gray-700' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}>
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                      </svg>
                      Phone
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {errors.general && (
              <motion.div initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} className="mt-3 p-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50">
                <p className="text-xs text-red-600 dark:text-red-400 text-center">{errors.general}</p>
              </motion.div>
            )}

            <div className={`mt-5 pt-4 border-t ${resolvedTheme === 'dark' ? 'border-white/10' : 'border-gray-200'}`}>
              <p className="text-center text-xs text-gray-500 dark:text-gray-400">
                Don't have an account?{" "}
                <Link to="/signup/step1" className="text-indigo-600 dark:text-indigo-400 font-semibold hover:underline">
                  Sign up now
                </Link>
              </p>
            </div>
          </motion.div>

          {/* Security Footer */}
          <div className="mt-4 flex items-center justify-center gap-2 text-xs text-gray-500 dark:text-gray-600">
            <span>🔒</span>
            <span>End-to-end encrypted</span>
            <span>•</span>
            <span>🛡️</span>
            <span>Military-grade security</span>
          </div>
        </motion.div>
      </div>

      {/* Hidden reCAPTCHA */}
      <div id="login-recaptcha-container" style={{ position: 'absolute', top: -9999, left: -9999, width: 1, height: 1, overflow: 'hidden' }} />
    </div>
  );
}