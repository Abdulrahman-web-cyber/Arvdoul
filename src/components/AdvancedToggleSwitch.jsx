// src/components/AdvancedToggleSwitch.jsx
import React, { useState } from "react";
import { motion } from "framer-motion";

export default function AdvancedToggleSwitch({ method, onToggle, theme, disabled = false }) {
  const [isAnimating, setIsAnimating] = useState(false);
  
  const handleToggle = (newMethod) => {
    if (disabled || method === newMethod) return;
    
    setIsAnimating(true);
    onToggle(newMethod);
    
    setTimeout(() => setIsAnimating(false), 300);
  };

  return (
    <div className="relative">
      <div className={`flex items-center justify-between mb-8 p-1 rounded-2xl backdrop-blur-sm border ${
        theme === 'dark' 
          ? 'bg-gray-800/60 border-gray-700/50 shadow-inner' 
          : 'bg-gray-100/80 border-gray-300/60 shadow-inner'
      }`}>
        {/* Phone Option */}
        <button
          onClick={() => handleToggle("phone")}
          disabled={disabled || method === "phone"}
          className={`relative z-10 flex-1 py-4 px-2 rounded-xl transition-all duration-200 ${
            method === "phone" 
              ? 'text-white' 
              : theme === 'dark' 
                ? 'text-gray-400 hover:text-gray-300' 
                : 'text-gray-600 hover:text-gray-900'
          } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
        >
          <div className="flex flex-col items-center gap-2">
            <motion.div
              animate={{ 
                scale: method === "phone" && isAnimating ? 1.1 : 1,
              }}
              transition={{ duration: 0.3 }}
              className="relative"
            >
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                theme === 'dark' 
                  ? method === "phone" ? 'bg-white/10' : 'bg-gray-700/50'
                  : method === "phone" ? 'bg-white/20' : 'bg-gray-200/50'
              }`}>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
              </div>
              {method === "phone" && (
                <motion.div
                  className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-gradient-to-r from-green-400 to-emerald-400 shadow-sm"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.2 }}
                />
              )}
            </motion.div>
            <span className="font-semibold text-sm tracking-wide">Phone</span>
            <span className="text-xs opacity-75 tracking-tight">SMS Verification</span>
          </div>
        </button>

        {/* Google Option */}
        <button
          onClick={() => handleToggle("google")}
          disabled={disabled || method === "google"}
          className={`relative z-10 flex-1 py-4 px-2 rounded-xl transition-all duration-200 ${
            method === "google" 
              ? 'text-white' 
              : theme === 'dark' 
                ? 'text-gray-400 hover:text-gray-300' 
                : 'text-gray-600 hover:text-gray-900'
          } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
        >
          <div className="flex flex-col items-center gap-2">
            <motion.div
              animate={{ 
                scale: method === "google" && isAnimating ? 1.1 : 1,
              }}
              transition={{ duration: 0.3 }}
              className="relative"
            >
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                theme === 'dark' 
                  ? method === "google" ? 'bg-white/10' : 'bg-gray-700/50'
                  : method === "google" ? 'bg-white/20' : 'bg-gray-200/50'
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
                  className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-gradient-to-r from-green-400 to-emerald-400 shadow-sm"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.2 }}
                />
              )}
            </motion.div>
            <span className="font-semibold text-sm tracking-wide">Google</span>
            <span className="text-xs opacity-75 tracking-tight">Instant Authentication</span>
          </div>
        </button>

        {/* Sliding Background */}
        <motion.div
          layoutId="methodBackground"
          className={`absolute inset-0 rounded-xl ${
            theme === 'dark'
              ? 'bg-gradient-to-r from-indigo-600/90 to-purple-600/90 shadow-lg'
              : 'bg-gradient-to-r from-indigo-500/90 to-purple-500/90 shadow-lg'
          }`}
          initial={false}
          transition={{
            type: "spring",
            stiffness: 500,
            damping: 30
          }}
          style={{
            left: method === "phone" ? '0%' : '50%',
            width: '50%'
          }}
        />
      </div>
    </div>
  );
}