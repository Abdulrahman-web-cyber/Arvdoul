// src/components/UI/PageLoader.jsx - Non-blocking top app loader banner
import React, { memo } from 'react';
import { TopAppLoadingBanner } from '../Navigation/RouteProgressBar.jsx';

export const PageLoader = memo(({ label = "Loading...", fullScreen = false }) => {
  if (fullScreen) {
    return <TopAppLoadingBanner isAnimating={true} label={label} />;
  }

  return (
    <div 
      className="w-full flex flex-col items-center justify-center select-none py-6 pointer-events-none"
      role="status"
      aria-label={label}
    >
      <div className="flex flex-col items-center gap-2 text-center px-4">
        <div className="w-6 h-6 rounded-full border-2 border-gray-300 dark:border-gray-700 border-t-violet-600 animate-spin" />
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
