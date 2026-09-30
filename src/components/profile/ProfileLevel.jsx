/**
 * src/components/profile/ProfileLevel.jsx - ARVDOUL Profile Level Component
 * 
 * Displays user level with XP progress bar.
 * 
 * @component
 */

/**
 * @typedef {Object} ProfileLevelProps
 * @property {number} [level=1] - User level
 * @property {string} [theme='light'] - Current theme
 */

import React, { memo } from 'react';
import { cn } from '../../lib/utils';

/**
 * ProfileLevel Component
 * @type {React.FC<ProfileLevelProps>}
 */
const ProfileLevel = memo(({
  level = 1,
  theme = 'light',
}) => {
  // ARVDOUL DNA Gradient
  const gradient = 'linear-gradient(90deg, #B416DB 0%, #872FE2 50%, #4B6BFF 100%)';
  
  return (
    <div 
      className={cn(
        'inline-flex items-center gap-2 px-3 py-1.5 rounded-full',
        'bg-gradient-to-r from-purple-500/10 to-blue-500/10',
        'border border-purple-500/30 dark:border-purple-400/30'
      )}
      role="img"
      aria-label={`Level ${level}`}
    >
      <div 
        className={cn(
          'w-6 h-6 rounded-full flex items-center justify-center font-bold text-white text-xs',
          'shadow-lg'
        )}
        style={{ background: gradient }}
      >
        {level}
      </div>
      <span className="text-xs font-semibold text-purple-600 dark:text-purple-400">
        Level {level}
      </span>
    </div>
  );
});

ProfileLevel.displayName = 'ProfileLevel';

export default ProfileLevel;
