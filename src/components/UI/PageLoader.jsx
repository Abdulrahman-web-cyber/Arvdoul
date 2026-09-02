// src/components/UI/PageLoader.jsx - Clean, minimal, zero-glow loader
import React, { memo } from 'react';

export const PageLoader = memo(({ label = "Loading...", fullScreen = false }) => {
  return (
    <div 
      className={`w-full flex flex-col items-center justify-center select-none ${
        fullScreen ? 'fixed inset-0 z-50 bg-white/95 dark:bg-[#03071B]/95' : 'py-8'
      }`}
      role="status"
      aria-label={label}
    >
      <div className="flex flex-col items-center gap-3 text-center px-4">
        <div className="w-8 h-8 rounded-full border-2 border-gray-300 dark:border-gray-700 border-t-violet-600 animate-spin" />
        {label && (
          <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
            {label}
          </span>
        )}
      </div>
    </div>
  );
});

PageLoader.displayName = 'PageLoader';
export default PageLoader;
