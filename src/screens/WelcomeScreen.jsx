// src/screens/WelcomeScreen.jsx - ARVDOUL WELCOME SCREEN
// Per Constitution v5.0 - Glass card, gradient buttons, language selector
import React, { useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useTheme } from '@context/ThemeContext';
import { cn } from '../lib/utils';

const LANGUAGES = [
  { code: 'en', name: 'English', flag: '🇺🇸' },
  { code: 'es', name: 'Español', flag: '🇪🇸' },
  { code: 'fr', name: 'Français', flag: '🇫🇷' },
  { code: 'de', name: 'Deutsch', flag: '🇩🇪' },
  { code: 'pt', name: 'Português', flag: '🇧🇷' },
  { code: 'ar', name: 'العربية', flag: '🇸🇦' },
  { code: 'zh', name: '中文', flag: '🇨🇳' },
  { code: 'ja', name: '日本語', flag: '🇯🇵' },
  { code: 'ko', name: '한국어', flag: '🇰🇷' },
  { code: 'hi', name: 'हिन्दी', flag: '🇮🇳' },
];

export default function WelcomeScreen() {
  const navigate = useNavigate();
  const { theme, setLanguage, language } = useTheme();
  const isDark = theme === 'dark';
  const [showLangDropdown, setShowLangDropdown] = useState(false);
  const [selectedLang, setSelectedLang] = useState(
    LANGUAGES.find(l => l.code === (language || 'en')) || LANGUAGES[0]
  );

  const handleSignIn = useCallback(() => {
    navigate('/login');
  }, [navigate]);

  const handleCreateAccount = useCallback(() => {
    navigate('/signup');
  }, [navigate]);

  const handleLanguageSelect = useCallback((lang) => {
    setSelectedLang(lang);
    setLanguage?.(lang.code);
    setShowLangDropdown(false);
  }, [setLanguage]);

  const backgroundStyle = useMemo(() => ({
    background: isDark
      ? 'radial-gradient(circle at 50% 0%, rgba(139, 30, 243, 0.15) 0%, transparent 50%), radial-gradient(circle at 80% 80%, rgba(68, 49, 247, 0.1) 0%, transparent 40%), radial-gradient(circle at 20% 90%, rgba(5, 91, 251, 0.1) 0%, transparent 40%), #03071B'
      : 'radial-gradient(circle at 50% 0%, rgba(139, 30, 243, 0.08) 0%, transparent 50%), radial-gradient(circle at 80% 80%, rgba(68, 49, 247, 0.05) 0%, transparent 40%), radial-gradient(circle at 20% 90%, rgba(5, 91, 251, 0.05) 0%, transparent 40%), #F6F8FC',
  }), [isDark]);

  return (
    <div 
      className="min-h-screen flex flex-col items-center justify-center p-6 relative overflow-hidden"
      style={backgroundStyle}
    >
      {/* Ambient Background Effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <motion.div
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.3, 0.5, 0.3],
          }}
          transition={{
            duration: 8,
            repeat: Infinity,
            ease: "easeInOut",
          }}
          className="absolute -top-1/2 -left-1/2 w-full h-full rounded-full bg-arvdoul-purple/10 blur-3xl"
        />
        <motion.div
          animate={{
            scale: [1.2, 1, 1.2],
            opacity: [0.2, 0.4, 0.2],
          }}
          transition={{
            duration: 10,
            repeat: Infinity,
            ease: "easeInOut",
          }}
          className="absolute -bottom-1/2 -right-1/2 w-full h-full rounded-full bg-arvdoul-blue/10 blur-3xl"
        />
      </div>

      {/* Main Glass Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className={cn(
          "relative z-10 w-full max-w-md p-8 rounded-arvdoul-xl",
          "backdrop-blur-xl border border-arvdoul-border",
          "shadow-arvdoul-glass",
          isDark ? "bg-arvdoul-surface" : "bg-white/85"
        )}
      >
        {/* Logo Section */}
        <div className="text-center mb-8">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.2, duration: 0.5 }}
            className="inline-flex items-center justify-center mb-4"
          >
            <div className="w-20 h-20 rounded-arvdoul-lg bg-arvdoul-gradient flex items-center justify-center shadow-arvdoul-button">
              <span className="text-4xl font-display font-bold text-white">A</span>
            </div>
          </motion.div>
          
          <motion.h1
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className={cn(
              "text-3xl font-display font-bold mb-2",
              isDark ? "text-white" : "text-gray-900"
            )}
          >
            Welcome to Arvdoul
          </motion.h1>
          
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className={cn(
              "text-sm",
              isDark ? "text-arvdoul-text-secondary" : "text-gray-600"
            )}
          >
            Connect. Create. Empower.
          </motion.p>
        </div>

        {/* Action Buttons */}
        <div className="space-y-4 mb-6">
          <motion.button
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.5 }}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleSignIn}
            className={cn(
              "w-full py-4 px-6 rounded-arvdoul-md",
              "bg-arvdoul-gradient text-white font-semibold text-lg",
              "shadow-arvdoul-button",
              "hover:shadow-lg transition-all duration-300",
              "flex items-center justify-center gap-3"
            )}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
            </svg>
            Sign In
          </motion.button>
          
          <motion.button
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.6 }}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleCreateAccount}
            className={cn(
              "w-full py-4 px-6 rounded-arvdoul-md",
              "bg-arvdoul-surface backdrop-blur-md border border-arvdoul-border",
              "text-white font-semibold text-lg",
              "hover:border-arvdoul-purple/50 transition-all duration-300",
              "flex items-center justify-center gap-3"
            )}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
            </svg>
            Create Account
          </motion.button>
        </div>

        {/* Divider */}
        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <div className={cn("w-full border-t", isDark ? "border-arvdoul-border" : "border-gray-200")} />
          </div>
          <div className="relative flex justify-center text-sm">
            <span className={cn(
              "px-4",
              isDark ? "bg-arvdoul-surface text-arvdoul-text-secondary" : "bg-white text-gray-500"
            )}>
              or continue with
            </span>
          </div>
        </div>

        {/* Social Login Buttons */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <motion.button
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7 }}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className={cn(
              "py-3 px-4 rounded-arvdoul-md",
              "flex items-center justify-center gap-2",
              "border border-arvdoul-border",
              "bg-arvdoul-surface/50 backdrop-blur-sm",
              isDark ? "text-white" : "text-gray-700",
              "hover:border-arvdoul-purple/30 transition-all duration-200"
            )}
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Google
          </motion.button>
          
          <motion.button
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.75 }}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className={cn(
              "py-3 px-4 rounded-arvdoul-md",
              "flex items-center justify-center gap-2",
              "border border-arvdoul-border",
              "bg-arvdoul-surface/50 backdrop-blur-sm",
              isDark ? "text-white" : "text-gray-700",
              "hover:border-arvdoul-purple/30 transition-all duration-200"
            )}
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
            </svg>
            Apple
          </motion.button>
        </div>

        {/* Terms */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          className={cn(
            "text-xs text-center",
            isDark ? "text-arvdoul-text-secondary" : "text-gray-500"
          )}
        >
          By continuing, you agree to our{' '}
          <a href="#" className="text-arvdoul-blue hover:underline">Terms of Service</a>
          {' '}and{' '}
          <a href="#" className="text-arvdoul-blue hover:underline">Privacy Policy</a>
        </motion.p>
      </motion.div>

      {/* Language Selector */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.9 }}
        className="relative z-10 mt-8"
      >
        <button
          onClick={() => setShowLangDropdown(!showLangDropdown)}
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-arvdoul-md",
            "bg-arvdoul-surface/50 backdrop-blur-md border border-arvdoul-border",
            "text-white text-sm",
            "hover:border-arvdoul-purple/30 transition-all duration-200"
          )}
        >
          <span className="text-lg">{selectedLang.flag}</span>
          <span>{selectedLang.name}</span>
          <svg 
            className={cn(
              "w-4 h-4 transition-transform duration-200",
              showLangDropdown && "rotate-180"
            )} 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {/* Language Dropdown */}
        <AnimatePresence>
          {showLangDropdown && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className={cn(
                "absolute bottom-full mb-2 left-1/2 -translate-x-1/2",
                "w-48 py-2 rounded-arvdoul-md",
                "bg-arvdoul-surface backdrop-blur-xl border border-arvdoul-border",
                "shadow-arvdoul-glass overflow-hidden"
              )}
            >
              {LANGUAGES.map((lang, index) => (
                <motion.button
                  key={lang.code}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.03 }}
                  onClick={() => handleLanguageSelect(lang)}
                  className={cn(
                    "w-full px-4 py-2 text-left flex items-center gap-3",
                    "hover:bg-arvdoul-purple/20 transition-colors duration-150",
                    selectedLang.code === lang.code 
                      ? "text-arvdoul-blue" 
                      : "text-white"
                  )}
                >
                  <span className="text-lg">{lang.flag}</span>
                  <span className="text-sm">{lang.name}</span>
                  {selectedLang.code === lang.code && (
                    <svg className="w-4 h-4 ml-auto" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  )}
                </motion.button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Version */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1 }}
        className={cn(
          "absolute bottom-4 text-xs",
          isDark ? "text-arvdoul-text-secondary/50" : "text-gray-400"
        )}
      >
        Arvdoul v1.0.0
      </motion.p>
    </div>
  );
}
