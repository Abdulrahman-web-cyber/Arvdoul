// src/components/System/FullScreenLoader.jsx
import React from "react";
import PropTypes from "prop-types";

export default function FullScreenLoader({ 
  message = "Loading...", 
  progress = null,
  phase = null,
  showSpinner = true 
}) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-gradient-to-br from-gray-50 to-white dark:from-gray-900 dark:to-gray-950">
      <div className="relative">
        {/* Animated background circles */}
        <div className="absolute -inset-8">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 rounded-full bg-gradient-to-r from-blue-500/10 to-purple-500/10 animate-pulse" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 rounded-full bg-gradient-to-r from-blue-400/5 to-purple-400/5 animate-pulse delay-300" />
        </div>
        
        {/* Main spinner */}
        {showSpinner && (
          <div className="relative mb-6">
            <div className="w-24 h-24 border-4 border-blue-200 dark:border-blue-900 border-t-blue-600 dark:border-t-blue-400 rounded-full animate-spin" />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-16 h-16 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 animate-pulse" />
            </div>
          </div>
        )}
        
        {/* Content */}
        <div className="text-center space-y-4">
          {/* Phase indicator */}
          {phase && (
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs font-medium">
              <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
              {phase.toUpperCase()}
            </div>
          )}
          
          {/* Message */}
          <div>
            <h3 className="text-xl font-bold text-gray-800 dark:text-white mb-2">
              {message}
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Please wait while we prepare your experience
            </p>
          </div>
          
          {/* Progress bar */}
          {progress !== null && (
            <div className="w-64 mx-auto space-y-2">
              <div className="h-1.5 bg-gray-200 dark:bg-gray-800 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-300 rounded-full"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
                <span>Loading</span>
                <span className="font-medium">{progress}%</span>
              </div>
            </div>
          )}
        </div>
      </div>
      
      {/* Footer */}
      <div className="absolute bottom-6">
        <p className="text-xs text-gray-400 dark:text-gray-500">
          Arvdoul • Secure Connection • {new Date().getFullYear()}
        </p>
      </div>
    </div>
  );
}

FullScreenLoader.propTypes = {
  message: PropTypes.string,
  progress: PropTypes.number,
  phase: PropTypes.string,
  showSpinner: PropTypes.bool
};