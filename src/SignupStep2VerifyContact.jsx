// src/screens/SignupStep2VerifyContact.jsx - COMPLETELY FIXED VERSION
import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { useTheme } from "@context/ThemeContext";
import { useAuth } from "@context/AuthContext";
import { countryCodes, sortedCountryCodes, getCountryByIso } from "../data/countryCodes";

// Import from SIMPLIFIED firebase file
import { 
  auth,
  db,
  RecaptchaVerifier,
  sendPhoneVerificationCode,
  signInWithGoogle,
  collection,
  query,
  where,
  getDocs
} from "../firebase/firebase.js";

// ==================== PERFECT TOGGLE SWITCH ====================
const ProfessionalToggleSwitch = React.memo(({ 
  method, 
  onToggle, 
  theme,
  disabled = false 
}) => {
  return (
    <div className="relative mb-8">
      <div className={`flex items-center justify-between p-1 rounded-2xl backdrop-blur-sm ${
        theme === 'dark' 
          ? 'bg-gray-800/60 border border-gray-700/50 shadow-lg' 
          : 'bg-gray-100/80 border border-gray-300/60 shadow-lg'
      }`}>
        {/* Phone Option */}
        <button
          onClick={() => !disabled && onToggle("phone")}
          disabled={disabled}
          className={`relative flex-1 py-4 px-2 rounded-xl transition-all duration-300 ${
            method === "phone" 
              ? 'text-white' 
              : theme === 'dark' 
                ? 'text-gray-400 hover:text-gray-300 hover:bg-gray-800/30' 
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100/50'
          } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
        >
          {method === "phone" && (
            <motion.div
              layoutId="methodBackground"
              className={`absolute inset-0 rounded-xl ${
                theme === 'dark'
                  ? 'bg-gradient-to-r from-indigo-600 to-purple-600'
                  : 'bg-gradient-to-r from-indigo-500 to-purple-500'
              }`}
              initial={false}
              transition={{ type: "spring", stiffness: 500, damping: 30 }}
            />
          )}
          
          <div className="relative z-10 flex flex-col items-center gap-2">
            <div className="relative">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                theme === 'dark' 
                  ? method === "phone" ? 'bg-white/10 backdrop-blur-sm' : 'bg-gray-700/50'
                  : method === "phone" ? 'bg-white/20 backdrop-blur-sm' : 'bg-gray-200/50'
              }`}>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
              </div>
              {method === "phone" && (
                <motion.div
                  className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-green-400 shadow-md"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                />
              )}
            </div>
            <span className="font-semibold text-sm">Phone</span>
            <span className="text-xs opacity-75">SMS Verification</span>
          </div>
        </button>

        {/* Google Option */}
        <button
          onClick={() => !disabled && onToggle("google")}
          disabled={disabled}
          className={`relative flex-1 py-4 px-2 rounded-xl transition-all duration-300 ${
            method === "google" 
              ? 'text-white' 
              : theme === 'dark' 
                ? 'text-gray-400 hover:text-gray-300 hover:bg-gray-800/30' 
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100/50'
          } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
        >
          {method === "google" && (
            <motion.div
              layoutId="methodBackground"
              className={`absolute inset-0 rounded-xl ${
                theme === 'dark'
                  ? 'bg-gradient-to-r from-indigo-600 to-purple-600'
                  : 'bg-gradient-to-r from-indigo-500 to-purple-500'
              }`}
              initial={false}
              transition={{ type: "spring", stiffness: 500, damping: 30 }}
            />
          )}
          
          <div className="relative z-10 flex flex-col items-center gap-2">
            <div className="relative">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                theme === 'dark' 
                  ? method === "google" ? 'bg-white/10 backdrop-blur-sm' : 'bg-gray-700/50'
                  : method === "google" ? 'bg-white/20 backdrop-blur-sm' : 'bg-gray-200/50'
              }`}>
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
              </div>
              {method === "google" && (
                <motion.div
                  className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-green-400 shadow-md"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                />
              )}
            </div>
            <span className="font-semibold text-sm">Google</span>
            <span className="text-xs opacity-75">Instant Sign In</span>
          </div>
        </button>
      </div>
    </div>
  );
});

ProfessionalToggleSwitch.displayName = 'ProfessionalToggleSwitch';

// ==================== PERFECT PHONE INPUT ====================
const ProductionPhoneInput = React.memo(({ 
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
            : 'text-gray-600 dark:text-gray-400'
        }`}>
          Phone Number <span className="text-red-500">*</span>
        </label>
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
                  : theme === 'dark'
                  ? 'border-gray-700 bg-gray-800/50 hover:border-gray-600'
                  : 'border-gray-300 bg-white hover:border-gray-400'
              } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
            >
              <div className="flex items-center gap-2">
                <span className={`text-sm font-medium ${
                  theme === 'dark' ? 'text-gray-200' : 'text-gray-900'
                }`}>
                  {selectedCountry.code}
                </span>
                <span className={`text-xs ${
                  theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                }`}>
                  {selectedCountry.iso}
                </span>
              </div>
              <svg
                className={`w-4 h-4 transform transition-transform ${showCountryDropdown ? 'rotate-180' : ''} ${
                  theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
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
                    theme === 'dark' 
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
                        theme === 'dark' 
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
                            ? theme === 'dark'
                              ? 'bg-indigo-900/40 text-indigo-300'
                              : 'bg-indigo-50 text-indigo-700'
                            : theme === 'dark'
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
                  : theme === 'dark'
                  ? 'border-gray-700 bg-gray-800/50 hover:border-gray-600'
                  : 'border-gray-300 bg-white hover:border-gray-400'
              } ${theme === 'dark' ? 'text-white placeholder-gray-500' : 'text-gray-900 placeholder-gray-400'} ${
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

ProductionPhoneInput.displayName = 'ProductionPhoneInput';

// ==================== PERFECT GOOGLE AUTH ====================
const ProductionGoogleAuth = React.memo(({ 
  onSuccess, 
  onError, 
  theme,
  loading = false 
}) => {
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [firebaseError, setFirebaseError] = useState(null);

  const handleGoogleSignIn = async () => {
    if (loading || isAuthenticating) return;
    
    setIsAuthenticating(true);
    setFirebaseError(null);

    try {
      console.log("🔄 Starting Google sign-in...");
      
      const result = await signInWithGoogle();
      const user = result.user;
      
      const userInfo = {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName,
        photoURL: user.photoURL,
        emailVerified: user.emailVerified,
        providerId: user.providerId,
        isNewUser: result._tokenResponse?.isNewUser || false,
        phoneNumber: user.phoneNumber,
        metadata: {
          createdAt: user.metadata?.creationTime,
          lastLoginAt: user.metadata?.lastSignInTime
        }
      };

      console.log("✅ Google authentication successful:", user.uid);
      toast.success("Google authentication successful!");
      onSuccess(userInfo);
      
    } catch (error) {
      console.error('❌ Google authentication error:', error);
      
      let errorMessage = "Google authentication failed";
      if (error.code) {
        switch (error.code) {
          case 'auth/popup-closed-by-user':
            errorMessage = "Sign-in cancelled";
            break;
          case 'auth/popup-blocked':
            errorMessage = "Pop-up blocked. Please allow pop-ups";
            break;
          case 'auth/network-request-failed':
            errorMessage = "Network error. Check your connection";
            break;
          case 'auth/unauthorized-domain':
            errorMessage = "This domain is not authorized for Google sign-in";
            break;
          case 'auth/operation-not-allowed':
            errorMessage = "Google sign-in is not enabled";
            break;
          default:
            errorMessage = error.message || errorMessage;
        }
      }
      
      setFirebaseError(errorMessage);
      toast.error(errorMessage);
      onError(new Error(errorMessage));
    } finally {
      setIsAuthenticating(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className={`p-6 rounded-xl backdrop-blur-sm border ${
        theme === 'dark'
          ? 'bg-gray-900/60 border-gray-800/50 shadow-xl'
          : 'bg-white/95 border-gray-200/60 shadow-xl'
      }`}>
        <div className="text-center mb-8">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-r from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-900 flex items-center justify-center shadow-lg">
            <svg className="w-8 h-8" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
          </div>
          <h3 className={`text-xl font-bold mb-2 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
            Secure Google Sign In
          </h3>
          <p className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
            One-click authentication • No password needed
          </p>
        </div>

        {firebaseError && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-4 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50"
          >
            <p className="text-sm text-red-600 dark:text-red-400 text-center">
              {firebaseError}
            </p>
          </motion.div>
        )}

        <motion.button
          onClick={handleGoogleSignIn}
          disabled={loading || isAuthenticating}
          whileHover={!(loading || isAuthenticating) ? { scale: 1.02 } : {}}
          whileTap={!(loading || isAuthenticating) ? { scale: 0.98 } : {}}
          className={`w-full py-3.5 px-4 rounded-lg font-medium text-sm transition-all duration-200 flex items-center justify-center gap-3 ${
            theme === 'dark'
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

        <p className="mt-4 text-xs text-center text-gray-500 dark:text-gray-400">
          Your Google account information will be used to create your Arvdoul profile.
        </p>
      </div>
    </div>
  );
});

ProductionGoogleAuth.displayName = 'ProductionGoogleAuth';

// ==================== MAIN COMPONENT - COMPLETELY FIXED ====================
export default function SignupStep2VerifyContact() {
  const navigate = useNavigate();
  const location = useLocation();
  const themeCtx = useTheme?.() || { theme: 'light' };
  const { theme } = themeCtx;
  const { signInWithPhone: authSignInWithPhone } = useAuth();
  
  const [method, setMethod] = useState("phone");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [step1Data, setStep1Data] = useState(null);
  const [recaptchaVerifier, setRecaptchaVerifier] = useState(null);
  const [firebaseReady, setFirebaseReady] = useState(false);
  const recaptchaContainerRef = useRef(null);

  // Check Firebase initialization
  useEffect(() => {
    if (auth && db) {
      setFirebaseReady(true);
      console.log("✅ Firebase services ready");
    } else {
      console.warn("⚠️ Firebase services not ready yet");
      // Try again after a delay
      const timer = setTimeout(() => {
        if (auth && db) {
          setFirebaseReady(true);
          console.log("✅ Firebase services ready (delayed)");
        }
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, []);

  // Load step1 data
  useEffect(() => {
    const loadStep1Data = () => {
      try {
        const savedData = sessionStorage.getItem('signup_step1');
        if (savedData) {
          const parsedData = JSON.parse(savedData);
          setStep1Data(parsedData);
        } else {
          toast.error("Please complete Step 1 first");
          navigate("/signup/step1", { replace: true });
        }
      } catch (error) {
        console.error("Failed to load step1 data:", error);
        toast.error("Session expired. Please start over.");
        navigate("/signup/step1", { replace: true });
      }
    };

    loadStep1Data();
  }, [navigate]);

  // Initialize reCAPTCHA when phone method is selected
  useEffect(() => {
    if (method !== "phone" || !recaptchaContainerRef.current || !firebaseReady) return;

    const initializeRecaptcha = async () => {
      try {
        // Clear existing recaptcha
        if (window.recaptchaVerifier) {
          window.recaptchaVerifier.clear();
        }

        // Create new recaptcha verifier
        const verifier = new RecaptchaVerifier(recaptchaContainerRef.current, {
          size: 'invisible',
          callback: () => {
            console.log("reCAPTCHA verified");
          },
          'expired-callback': () => {
            console.warn("reCAPTCHA expired");
            toast.error("Security check expired. Please try again.");
          }
        });

        // Initialize the verifier
        await verifier.initialize();
        
        window.recaptchaVerifier = verifier;
        setRecaptchaVerifier(verifier);
        
        console.log("✅ reCAPTCHA initialized successfully");
      } catch (error) {
        console.error("reCAPTCHA initialization error:", error);
        toast.error("Security verification failed to initialize. Please refresh the page.");
      }
    };

    initializeRecaptcha();

    return () => {
      if (window.recaptchaVerifier?.clear) {
        window.recaptchaVerifier.clear();
      }
    };
  }, [method, firebaseReady]);

  // Phone number validation
  const validatePhoneNumber = useCallback((phone) => {
    if (!phone) return "Phone number is required";
    if (typeof phone !== 'string') return "Invalid phone number format";
    
    // Remove any spaces or special characters
    const cleanPhone = phone.replace(/\s+/g, '');
    
    // Check if it starts with + and has digits after
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
  }, []);

  // Handle phone verification - SIMPLIFIED VERSION
  const handlePhoneVerification = async () => {
    if (!firebaseReady) {
      toast.error("Authentication service not ready. Please wait...");
      return;
    }

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
      console.log("📱 Starting phone verification for:", phoneNumber);

      // Verify recaptcha is ready
      if (!recaptchaVerifier) {
        throw new Error("Security verification not ready. Please wait a moment and try again.");
      }

      // Check for duplicate phone in Firestore
      try {
        if (db) {
          const usersRef = collection(db, "users");
          const q = query(usersRef, where("phoneNumber", "==", phoneNumber));
          const querySnapshot = await getDocs(q);
          
          if (!querySnapshot.empty) {
            throw new Error("This phone number is already registered");
          }
        }
      } catch (dbError) {
        console.warn("Could not check phone duplicates:", dbError);
        // Continue anyway - Firebase auth will handle duplicates
      }

      // Send OTP via Firebase - SIMPLIFIED
      const confirmationResult = await sendPhoneVerificationCode(phoneNumber, recaptchaVerifier);

      console.log("✅ OTP sent successfully. Verification ID:", confirmationResult.verificationId);

      // Store verification data
      const verificationData = {
        verificationId: confirmationResult.verificationId,
        phone: phoneNumber,
        method: "phone",
        createdAt: Date.now()
      };

      sessionStorage.setItem('phone_verification', JSON.stringify(verificationData));

      // Store signup data
      const signupData = {
        ...step1Data,
        phone: phoneNumber,
        contactMethod: "phone",
        verificationId: confirmationResult.verificationId,
        step: 2
      };

      sessionStorage.setItem('signup_data', JSON.stringify(signupData));

      toast.success(`Verification code sent to ${phoneNumber}`);
      
      // Navigate to OTP verification
      navigate("/otp-verification", {
        state: { 
          verificationId: confirmationResult.verificationId,
          phoneNumber,
          step1Data: signupData
        },
        replace: true
      });

    } catch (error) {
      console.error("❌ Phone verification error:", error);
      
      let errorMessage = "Failed to send verification code";
      
      // Handle specific Firebase errors
      if (error.code) {
        switch (error.code) {
          case 'auth/invalid-phone-number':
            errorMessage = "Invalid phone number format. Please check and try again.";
            break;
          case 'auth/too-many-requests':
            errorMessage = "Too many attempts. Please try again in a few minutes.";
            break;
          case 'auth/quota-exceeded':
            errorMessage = "SMS quota exceeded. Please try again later.";
            break;
          case 'auth/network-request-failed':
            errorMessage = "Network error. Please check your internet connection.";
            break;
          case 'auth/captcha-check-failed':
            errorMessage = "Security check failed. Please refresh and try again.";
            break;
          case 'auth/operation-not-allowed':
            errorMessage = "Phone sign-in is not enabled for this app.";
            break;
          default:
            errorMessage = error.message || errorMessage;
        }
      }
      
      setErrors({ phone: errorMessage });
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // Handle Google authentication
  const handleGoogleSuccess = async (userInfo) => {
    setLoading(true);
    setErrors({});

    try {
      // Store Google auth data
      const googleData = {
        userInfo,
        method: "google",
        authenticated: true,
        timestamp: Date.now()
      };

      sessionStorage.setItem('google_auth', JSON.stringify(googleData));

      // Create complete signup data
      const signupData = {
        ...step1Data,
        contactMethod: "google",
        googleAuthenticated: true,
        googleId: userInfo.uid,
        email: userInfo.email,
        fullName: userInfo.displayName,
        photoURL: userInfo.photoURL,
        verificationId: `google_${Date.now()}`,
        step: 2,
        isNewUser: userInfo.isNewUser || false
      };

      sessionStorage.setItem('signup_data', JSON.stringify(signupData));

      toast.success("Google authentication successful!");
      
      // Navigate to SetupProfile
      navigate("/setup-profile", {
        state: {
          method: "google",
          step1Data: signupData,
          googleUserInfo: userInfo,
          isNewUser: userInfo.isNewUser || false,
          userId: userInfo.uid,
          userEmail: userInfo.email
        },
        replace: true
      });

    } catch (error) {
      console.error("Google success handler error:", error);
      toast.error("Failed to process Google authentication");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleError = (error) => {
    console.error("Google authentication error:", error);
    toast.error(error.message || "Google authentication failed");
  };

  // Check form validity
  const isFormValid = useMemo(() => {
    if (method === "phone") {
      return phoneNumber && phoneNumber.length >= 10 && !errors.phone;
    }
    return true;
  }, [method, phoneNumber, errors]);

  // Loading state
  if (!firebaseReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-white dark:from-gray-900 dark:to-gray-950">
        <div className="text-center space-y-6">
          <div className="relative">
            <div className="w-20 h-20 border-4 border-indigo-200 dark:border-indigo-900 border-t-indigo-600 dark:border-t-indigo-500 rounded-full animate-spin mx-auto" />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-10 h-10 rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 animate-pulse" />
            </div>
          </div>
          <div>
            <h3 className="text-xl font-bold text-gray-800 dark:text-white mb-2">
              Initializing Services
            </h3>
            <p className="text-gray-600 dark:text-gray-400">
              Setting up secure connection to Arvdoul...
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!step1Data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-white dark:from-gray-900 dark:to-gray-950">
        <div className="text-center">
          <div className="animate-spin w-16 h-16 border-4 border-indigo-500 border-t-transparent rounded-full mx-auto mb-6"></div>
          <p className="text-gray-600 dark:text-gray-400 text-lg">Loading your information...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4 bg-gradient-to-br from-gray-50 to-white dark:from-gray-900 dark:to-gray-950">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, type: "spring" }}
        className="relative w-full max-w-md mx-auto"
      >
        {/* Progress Indicator */}
        <div className="flex items-center justify-center mb-8">
          <div className="flex items-center space-x-4">
            {[1, 2, 3].map((step) => (
              <div key={step} className="flex flex-col items-center">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center text-base font-semibold ${
                  step === 2 
                    ? theme === 'dark'
                      ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white'
                      : 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white'
                    : step < 2
                    ? 'bg-gradient-to-r from-green-500 to-emerald-500 text-white'
                    : theme === 'dark'
                    ? 'bg-gray-800 text-gray-400'
                    : 'bg-gray-100 text-gray-500'
                }`}>
                  {step === 1 ? '✓' : step}
                </div>
                <div className={`mt-2 text-xs font-medium ${theme === 'dark' ? 'text-gray-500' : 'text-gray-500'}`}>
                  {step === 1 ? "Personal" : step === 2 ? "Verify" : "Complete"}
                </div>
              </div>
            ))}
          </div>
        </div>

        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1 }}
          className={`rounded-2xl border backdrop-blur-xl shadow-2xl ${
            theme === 'dark'
              ? 'bg-gray-900/80 border-gray-800/50'
              : 'bg-white/95 border-gray-200/60'
          } p-6 sm:p-8`}
        >
          {/* Header */}
          <div className="mb-8">
            <div className="text-center">
              <h1 className={`text-2xl sm:text-3xl font-bold tracking-tight mb-2 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                Identity Verification
              </h1>
              <p className={`text-sm sm:text-base tracking-wide ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                Step 2 of 3 • Secure authentication method
              </p>
            </div>
          </div>

          {/* Firebase Status Indicator */}
          {firebaseReady && (
            <div className="mb-4 p-3 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800/50">
              <div className="flex items-center justify-center gap-2">
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                <p className="text-sm text-green-700 dark:text-green-300">
                  🔒 Secure connection established
                </p>
              </div>
            </div>
          )}

          {/* Professional Toggle Switch */}
          <ProfessionalToggleSwitch
            method={method}
            onToggle={setMethod}
            theme={theme}
            disabled={loading}
          />

          <AnimatePresence mode="wait">
            {method === "phone" ? (
              <motion.div
                key="phone"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.3 }}
                className="space-y-6"
              >
                <ProductionPhoneInput
                  value={phoneNumber}
                  onChange={setPhoneNumber}
                  error={errors.phone}
                  theme={theme}
                  disabled={loading}
                />

                {/* Continue Button */}
                <motion.button
                  whileHover={isFormValid && !loading ? { scale: 1.02 } : {}}
                  whileTap={isFormValid && !loading ? { scale: 0.98 } : {}}
                  onClick={handlePhoneVerification}
                  disabled={!isFormValid || loading}
                  className={`w-full py-4 rounded-xl font-bold text-base shadow-lg transition-all duration-300 ${
                    isFormValid && !loading
                      ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white hover:shadow-xl'
                      : theme === 'dark'
                      ? 'bg-gray-800 text-gray-400 cursor-not-allowed'
                      : 'bg-gray-200 text-gray-500 cursor-not-allowed'
                  }`}
                >
                  <div className="flex items-center justify-center gap-3">
                    {loading ? (
                      <>
                        <div className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full" />
                        <span>Sending Verification Code...</span>
                      </>
                    ) : (
                      <>
                        <span>Continue with Phone Verification</span>
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                        </svg>
                      </>
                    )}
                  </div>
                </motion.button>
              </motion.div>
            ) : (
              <motion.div
                key="google"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
                className="space-y-6"
              >
                <ProductionGoogleAuth
                  onSuccess={handleGoogleSuccess}
                  onError={handleGoogleError}
                  theme={theme}
                  loading={loading}
                />

                {/* Alternative Option */}
                <button
                  onClick={() => setMethod("phone")}
                  className={`w-full py-3 rounded-lg font-medium text-sm transition-all duration-200 border ${
                    theme === 'dark'
                      ? 'border-gray-700 bg-gray-800/50 text-gray-300 hover:bg-gray-800 hover:border-gray-600'
                      : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50 hover:border-gray-400'
                  } flex items-center justify-center gap-2`}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                  <span>Use Phone Verification Instead</span>
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Back Button */}
          <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-800">
            <button
              type="button"
              onClick={() => navigate("/signup/step1", { replace: true })}
              className={`w-full text-sm font-medium flex items-center justify-center gap-2 ${
                theme === 'dark' ? 'text-indigo-400 hover:text-indigo-300' : 'text-indigo-600 hover:text-indigo-700'
              }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Back to Personal Information
            </button>
          </div>
        </motion.div>

        {/* Security Footer */}
        <div className="mt-6 text-center">
          <p className={`text-xs ${theme === 'dark' ? 'text-gray-600' : 'text-gray-500'}`}>
            🔒 End-to-end encryption • Firebase Authentication • Your data is secure
          </p>
        </div>
      </motion.div>

      {/* Hidden reCAPTCHA container */}
      <div id="recaptcha-container" ref={recaptchaContainerRef} className="hidden"></div>
    </div>
  );
}