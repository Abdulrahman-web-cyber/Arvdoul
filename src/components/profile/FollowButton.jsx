/**
 * src/components/profile/FollowButton.jsx - ARVDOUL Follow Button Component
 * 
 * Follow/Unfollow button with loading state and ARVDOUL DNA gradient.
 * 
 * @component
 */

/**
 * @typedef {Object} FollowButtonProps
 * @property {boolean} [isFollowing=false] - Whether currently following
 * @property {boolean} [loading=false] - Loading state
 * @property {Function} [onFollow] - Follow click handler
 * @property {Function} [onUnfollow] - Unfollow click handler
 * @property {string} [theme='light'] - Current theme
 * @property {'sm'|'md'|'lg'} [size='md'] - Button size
 */

import React, { memo, useCallback } from 'react';
import { VISUAL } from '../../design-system/visual';
import { cn } from '../../lib/utils';
import { UserPlus, UserMinus, Loader2 } from 'lucide-react';

/**
 * FollowButton Component
 * @type {React.FC<FollowButtonProps>}
 */
const FollowButton = memo(({
  isFollowing = false,
  loading = false,
  onFollow,
  onUnfollow,
  theme = 'light',
  size = 'md',
}) => {
  // ARVDOUL DNA Gradient + glow (resolved from design tokens)
  const buttonGradient = VISUAL.sequentialGradient;
  const glowEffect = VISUAL.glowSoft;
  
  // Size classes
  const sizeClasses = {
    sm: 'px-3 py-1.5 text-xs gap-1',
    md: 'px-4 py-2.5 text-sm gap-2',
    lg: 'px-6 py-3 text-base gap-2',
  };
  
  const iconSizes = {
    sm: 'w-3 h-3',
    md: 'w-4 h-4',
    lg: 'w-5 h-5',
  };
  
  // Handle click
  const handleClick = useCallback(() => {
    if (loading) return;
    
    if (isFollowing) {
      if (onUnfollow) {
        onUnfollow();
      }
    } else {
      if (onFollow) {
        onFollow();
      }
    }
  }, [loading, isFollowing, onFollow, onUnfollow]);
  
  // Loading state
  if (loading) {
    return (
      <button
        disabled
        className={cn(
          'flex items-center justify-center rounded-xl font-semibold',
          'transition-all duration-200',
          sizeClasses[size],
          isFollowing 
            ? 'bg-gradient-to-r from-purple-500 to-blue-500 text-white' 
            : theme === 'dark'
              ? 'bg-gray-700 text-gray-400 border border-gray-600'
              : 'bg-gray-100 text-gray-600 border border-gray-300',
          'opacity-70 cursor-not-allowed'
        )}
        aria-busy="true"
        aria-label="Loading"
      >
        <Loader2 className={cn(iconSizes[size], 'animate-spin')} aria-hidden="true" />
      </button>
    );
  }
  
  // Following state
  if (isFollowing) {
    return (
      <button
        onClick={handleClick}
        className={cn(
          'flex items-center justify-center rounded-xl font-semibold',
          'transition-all duration-200',
          sizeClasses[size],
          'bg-gradient-to-r from-purple-500 to-blue-500 text-white',
          'hover:scale-105 active:scale-95',
          'shadow-lg hover:shadow-xl'
        )}
        style={{ boxShadow: glowEffect }}
        aria-label="Following - Click to unfollow"
      >
        <UserMinus className={iconSizes[size]} aria-hidden="true" />
        <span>Following</span>
      </button>
    );
  }
  
  // Not following state
  return (
    <button
      onClick={handleClick}
      className={cn(
        'flex items-center justify-center rounded-xl font-semibold',
        'text-white transition-all duration-200',
        sizeClasses[size],
        'hover:scale-105 active:scale-95',
        'shadow-lg hover:shadow-xl'
      )}
      style={{ background: buttonGradient }}
      aria-label="Follow"
    >
      <UserPlus className={iconSizes[size]} aria-hidden="true" />
      <span>Follow</span>
    </button>
  );
});

FollowButton.displayName = 'FollowButton';

export default FollowButton;
