/**
 * Follow/Unfollow button with loading state and ARVDOUL DNA gradient.
 * 
 * @component
 */

/**
 * @typedef {Object} FollowButtonProps
 * @property {boolean} [isFollowing=false] - Whether currently following
 * @property {boolean} [requested=false] - Pending follow request (private target)
 * @property {boolean} [loading=false] - Loading state
 * @property {Function} [onFollow] - Follow click handler
 * @property {Function} [onUnfollow] - Unfollow click handler
 * @property {Function} [onCancelRequest] - Withdraw a pending follow request
 * @property {string} [theme='light'] - Current theme
 * @property {'sm'|'md'|'lg'} [size='md'] - Button size
 */

import { memo, useCallback } from "react";
import { cn } from '../../lib/utils';
import { UserPlus, UserMinus, Clock, Loader2 } from 'lucide-react';
import { BRAND_GRADIENT } from '../../design-system/tokens.js';

/**
 * FollowButton Component
 * @type {React.FC<FollowButtonProps>}
 */
const FollowButton = memo(({
  isFollowing = false,
  requested = false,
  loading = false,
  onFollow,
  onUnfollow,
  onCancelRequest,
  theme = 'light',
  size = 'md',
}) => {
  // ARVDOUL DNA Gradient
  const buttonGradient = BRAND_GRADIENT;
  
  // Glow effect for following button
  const glowEffect = '0 0 20px rgba(139, 30, 243, 0.4), 0 0 40px rgba(139, 30, 243, 0.2)';
  
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

    if (requested) {
      if (onCancelRequest) onCancelRequest();
      return;
    }

    if (isFollowing) {
      if (onUnfollow) {
        onUnfollow();
      }
    } else {
      if (onFollow) {
        onFollow();
      }
    }
  }, [loading, requested, onCancelRequest, isFollowing, onFollow, onUnfollow]);
  
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
  
  // Requested state (pending private-account follow request)
  if (requested) {
    return (
      <button
        onClick={handleClick}
        className={cn(
          'flex items-center justify-center rounded-xl font-semibold',
          'transition-all duration-200',
          sizeClasses[size],
          theme === 'dark'
            ? 'bg-white/10 text-white/80 border border-white/15 hover:bg-white/15'
            : 'bg-slate-100 text-slate-600 border border-slate-300 hover:bg-slate-200'
        )}
        aria-label="Requested - Click to withdraw request"
      >
        <Clock className={iconSizes[size]} aria-hidden="true" />
        <span>Requested</span>
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
