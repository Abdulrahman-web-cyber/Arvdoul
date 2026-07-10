/**
 * src/components/profile/FollowButton.jsx - ARVDOUL Follow Button Component
 * 
 * Follow/Unfollow button with loading state and optimistic updates.
 * 
 * @component
 */

import React, { memo, useCallback } from 'react';
import { cn } from '../../lib/utils';
import { UserPlus, UserMinus, Loader2 } from 'lucide-react';

/**
 * FollowButton Component
 * @param {Object} props
 */
const FollowButton = ({
  isFollowing = false,
  loading = false,
  onFollow,
  onUnfollow,
  theme = 'light',
  size = 'default',
  variant = 'primary', // 'primary' | 'outline' | 'ghost'
}) => {
  const handleClick = useCallback(() => {
    if (loading) return;
    
    if (isFollowing) {
      onUnfollow?.();
    } else {
      onFollow?.();
    }
  }, [loading, isFollowing, onFollow, onUnfollow]);

  // ARVDOUL Button Gradient
  const buttonGradient = 'linear-gradient(135deg, #B416DB 0%, #872FE2 50%, #4B6BFF 100%)';
  const glowEffect = '0 0 20px rgba(180, 22, 219, 0.3), 0 0 40px rgba(75, 107, 255, 0.15)';

  const sizeClasses = {
    sm: 'px-3 py-1.5 text-xs',
    default: 'px-5 py-2.5 text-sm',
    lg: 'px-6 py-3 text-base',
  };

  const iconSizeClasses = {
    sm: 'w-3.5 h-3.5',
    default: 'w-4 h-4',
    lg: 'w-5 h-5',
  };

  if (variant === 'outline') {
    return (
      <button
        onClick={handleClick}
        disabled={loading}
        className={cn(
          'flex items-center justify-center gap-2 rounded-xl font-semibold transition-all',
          'border-2',
          sizeClasses[size],
          isFollowing
            ? 'border-purple-500 text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20'
            : 'border-purple-500 text-white hover:opacity-90',
          loading && 'opacity-50 cursor-not-allowed',
          !isFollowing && 'shadow-md hover:shadow-lg'
        )}
        style={!isFollowing ? { background: buttonGradient } : {}}
      >
        {loading ? (
          <Loader2 className={cn(iconSizeClasses[size], 'animate-spin')} />
        ) : isFollowing ? (
          <UserMinus className={iconSizeClasses[size]} />
        ) : (
          <UserPlus className={iconSizeClasses[size]} />
        )}
        <span>{loading ? 'Loading...' : isFollowing ? 'Following' : 'Follow'}</span>
      </button>
    );
  }

  if (variant === 'ghost') {
    return (
      <button
        onClick={handleClick}
        disabled={loading}
        className={cn(
          'flex items-center justify-center gap-2 rounded-xl font-semibold transition-all',
          'hover:bg-gray-100 dark:hover:bg-gray-800',
          sizeClasses[size],
          loading && 'opacity-50 cursor-not-allowed'
        )}
      >
        {loading ? (
          <Loader2 className={cn(iconSizeClasses[size], 'animate-spin')} />
        ) : isFollowing ? (
          <UserMinus className={iconSizeClasses[size]} />
        ) : (
          <UserPlus className={iconSizeClasses[size]} />
        )}
        <span>{loading ? 'Loading...' : isFollowing ? 'Following' : 'Follow'}</span>
      </button>
    );
  }

  // Primary variant (default)
  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className={cn(
        'flex items-center justify-center gap-2 rounded-xl font-semibold transition-all',
        'text-white hover:opacity-90',
        sizeClasses[size],
        loading && 'opacity-50 cursor-not-allowed',
        !isFollowing && 'shadow-md hover:shadow-lg'
      )}
      style={{
        background: isFollowing ? undefined : buttonGradient,
        boxShadow: !isFollowing ? glowEffect : undefined,
      }}
    >
      {loading ? (
        <Loader2 className={cn(iconSizeClasses[size], 'animate-spin')} />
      ) : isFollowing ? (
        <>
          <UserMinus className={iconSizeClasses[size]} />
          <span>Following</span>
        </>
      ) : (
        <>
          <UserPlus className={iconSizeClasses[size]} />
          <span>Follow</span>
        </>
      )}
    </button>
  );
};

export default memo(FollowButton);
