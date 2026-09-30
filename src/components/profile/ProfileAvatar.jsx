/**
 * src/components/profile/ProfileAvatar.jsx - ARVDOUL Profile Avatar Component
 * 
 * Displays user avatar with ARVDOUL DNA gradient ring, level badge, and upload functionality.
 * 
 * @component
 */

/**
 * @typedef {Object} ProfileAvatarProps
 * @property {string} [src] - Avatar image URL
 * @property {string} [name] - User display name for initials
 * @property {number} [size=120] - Avatar size in pixels
 * @property {number} [level] - User level
 * @property {Function} [onPress] - Click handler
 * @property {boolean} [isOwner=false] - Whether viewing own profile
 * @property {string} [theme='light'] - Current theme
 */

import React, { memo, useCallback, useState, useMemo } from 'react';
import { cn } from '../../lib/utils';
import { getSafeAvatarUrl, generateDefaultAvatarSvg } from '../../utils/avatarUtils.js';

/**
 * ProfileAvatar Component
 * @type {React.FC<ProfileAvatarProps>}
 */
const ProfileAvatar = memo(({
  src,
  name,
  userId = '',
  size = 120,
  level,
  onPress,
  isOwner = false,
  theme = 'light',
}) => {
  const [imageError, setImageError] = useState(false);
  
  const effectiveSrc = useMemo(() => {
    if (imageError || !src || src.includes('default-profile') || src.includes('default_profile')) {
      return generateDefaultAvatarSvg(userId, name, size * 2);
    }
    return getSafeAvatarUrl(src, name, userId);
  }, [src, imageError, userId, name, size]);
  
  // ARVDOUL DNA Gradient ring
  const gradientRing = 'conic-gradient(from 45deg, #00D4FF, #7A2BFA, #FF44CC, #00D4FF)';
  
  // Handle image error
  const handleImageError = useCallback(() => {
    setImageError(true);
  }, []);
  
  // Handle click
  const handleClick = useCallback(() => {
    if (onPress) {
      onPress();
    }
  }, [onPress]);
  
  // Calculate size classes
  const ringSize = size + 8;
  const levelBadgeSize = Math.max(24, size * 0.25);
  
  return (
    <div 
      className="relative inline-block"
      style={{ width: ringSize, height: ringSize }}
    >
      {/* ARVDOUL DNA Gradient Ring */}
      <div 
        className="absolute inset-0 rounded-full animate-spin-slow"
        style={{ 
          background: gradientRing,
          padding: '4px',
        }}
        aria-hidden="true"
      />
      
      {/* Avatar Container */}
      <button
        onClick={handleClick}
        className={cn(
          'relative w-full h-full rounded-full overflow-hidden',
          'ring-4 ring-white dark:ring-gray-900',
          'transition-all duration-200',
          isOwner && 'cursor-pointer hover:scale-105 active:scale-95',
          !isOwner && 'cursor-pointer'
        )}
        style={{ width: size, height: size }}
        aria-label={`${name || 'User'}'s avatar${isOwner ? ' (click to view)' : ''}`}
      >
        <img
          src={effectiveSrc}
          alt={name || 'User avatar'}
          className="w-full h-full object-cover rounded-full"
          onError={handleImageError}
        />
        
        {/* Upload indicator for owner */}
        {isOwner && (
          <div className={cn(
            'absolute inset-0 flex items-center justify-center',
            'bg-black/0 hover:bg-black/40',
            'transition-colors duration-200',
            'rounded-full'
          )}>
            <div className={cn(
              'w-10 h-10 rounded-full flex items-center justify-center',
              'bg-white/90 dark:bg-gray-800/90',
              'opacity-0 hover:opacity-100',
              'transition-opacity duration-200',
              'shadow-lg'
            )}>
              <svg 
                className="w-5 h-5 text-gray-700 dark:text-gray-300" 
                fill="none" 
                viewBox="0 0 24 24" 
                stroke="currentColor"
              >
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  strokeWidth={2} 
                  d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" 
                />
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  strokeWidth={2} 
                  d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" 
                />
              </svg>
            </div>
          </div>
        )}
      </button>
      
      {/* Level Badge */}
      {level && (
        <div 
          className={cn(
            'absolute -bottom-1 -right-1',
            'flex items-center justify-center rounded-full',
            'font-bold text-white text-xs',
            'shadow-lg border-2 border-white dark:border-gray-900'
          )}
          style={{ 
            width: levelBadgeSize, 
            height: levelBadgeSize,
            background: 'linear-gradient(135deg, #B416DB 0%, #872FE2 50%, #4B6BFF 100%)',
            fontSize: levelBadgeSize * 0.4
          }}
          aria-label={`Level ${level}`}
        >
          {level}
        </div>
      )}
    </div>
  );
});

ProfileAvatar.displayName = 'ProfileAvatar';

export default ProfileAvatar;
