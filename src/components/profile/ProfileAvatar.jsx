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

import React, { memo, useCallback, useState } from 'react';
import { cn } from '../../lib/utils';

/**
 * Generate initials from name
 * @param {string} name - Display name
 * @returns {string} Initials (max 2 characters)
 */
const getInitials = (name) => {
  if (!name) return 'U';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return name.substring(0, 2).toUpperCase();
};

/**
 * Get avatar background color based on name hash
 * @param {string} name - Display name
 * @returns {Object} Color palette {primary, secondary}
 */
const getAvatarColors = (name) => {
  const palettes = [
    { primary: '#3B82F6', secondary: '#1D4ED8' }, // Blue
    { primary: '#8B5CF6', secondary: '#7C3AED' }, // Purple
    { primary: '#10B981', secondary: '#059669' }, // Green
    { primary: '#EC4899', secondary: '#DB2777' }, // Pink
    { primary: '#F97316', secondary: '#EA580C' }, // Orange
    { primary: '#14B8A6', secondary: '#0D9488' }, // Teal
    { primary: '#6366F1', secondary: '#4F46E5' }, // Indigo
    { primary: '#EF4444', secondary: '#DC2626' }, // Red
  ];
  
  if (!name) return palettes[0];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = ((hash << 5) - hash) + name.charCodeAt(i);
    hash = hash & hash;
  }
  return palettes[Math.abs(hash) % palettes.length];
};

/**
 * ProfileAvatar Component
 * @type {React.FC<ProfileAvatarProps>}
 */
const ProfileAvatar = memo(({
  src,
  name,
  size = 120,
  level,
  onPress,
  isOwner = false,
  theme = 'light',
}) => {
  const [imageError, setImageError] = useState(false);
  
  // ARVDOUL DNA Gradient ring
  const gradientRing = 'conic-gradient(from 45deg, #00D4FF, #7A2BFA, #FF44CC, #00D4FF)';
  
  // Avatar colors
  const colors = getAvatarColors(name);
  
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
        {src && !imageError ? (
          <img
            src={src}
            alt={name || 'User avatar'}
            className="w-full h-full object-cover"
            onError={handleImageError}
          />
        ) : (
          <div 
            className="w-full h-full flex items-center justify-center"
            style={{
              background: `linear-gradient(135deg, ${colors.primary} 0%, ${colors.secondary} 100%)`
            }}
          >
            <span 
              className="text-white font-bold"
              style={{ fontSize: size * 0.35 }}
            >
              {getInitials(name)}
            </span>
          </div>
        )}
        
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
