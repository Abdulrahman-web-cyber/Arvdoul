/**
 * src/components/profile/ProfileActions.jsx - ARVDOUL Profile Actions Component
 * 
 * Displays action buttons for profile interactions with glassmorphism styling.
 * 
 * @component
 */

/**
 * @typedef {Object} ProfileActionsProps
 * @property {boolean} [isOwner=false] - Whether viewing own profile
 * @property {Object} [followStatus] - Follow status object
 * @property {boolean} [followLoading=false] - Follow action loading
 * @property {Function} [onFollow] - Follow handler
 * @property {Function} [onUnfollow] - Unfollow handler
 * @property {Function} [onMessage] - Message handler
 * @property {Function} [onShare] - Share handler
 * @property {string} [theme='light'] - Current theme
 */

import React, { memo, useCallback } from 'react';
import { cn } from '../../lib/utils';
import { 
  UserPlus, 
  UserMinus, 
  MessageCircle, 
  Share2, 
  MoreHorizontal,
  Loader2
} from 'lucide-react';
import FollowButton from './FollowButton';

/**
 * ProfileActions Component
 * @type {React.FC<ProfileActionsProps>}
 */
const ProfileActions = memo(({
  isOwner = false,
  followStatus,
  followLoading = false,
  onFollow,
  onUnfollow,
  onMessage,
  onShare,
  theme = 'light',
}) => {
  // ARVDOUL DNA Gradient
  const buttonGradient = 'linear-gradient(135deg, #B416DB 0%, #872FE2 50%, #4B6BFF 100%)';
  
  // Handle follow click
  const handleFollow = useCallback(() => {
    if (onFollow) {
      onFollow();
    }
  }, [onFollow]);
  
  // Handle unfollow click
  const handleUnfollow = useCallback(() => {
    if (onUnfollow) {
      onUnfollow();
    }
  }, [onUnfollow]);
  
  // Handle message click
  const handleMessage = useCallback(() => {
    if (onMessage) {
      onMessage();
    }
  }, [onMessage]);
  
  // Handle share click
  const handleShare = useCallback(() => {
    if (onShare) {
      onShare();
    }
  }, [onShare]);
  
  // Handle more options
  const handleMoreOptions = useCallback(() => {
    // TODO: Show more options menu
  }, []);
  
  // Owner view - show Edit Profile and Settings
  if (isOwner) {
    return (
      <div className={cn(
        'flex items-center gap-3 p-4 rounded-2xl',
        theme === 'dark' 
          ? 'bg-gray-800/50 backdrop-blur-xl border border-gray-700/50' 
          : 'bg-white/80 backdrop-blur-xl border border-gray-200/50',
        'shadow-[0_4px_16px_rgba(0,0,0,0.08)]',
        'dark:shadow-[0_4px_16px_rgba(0,0,0,0.16)]'
      )}>
        <button
          className={cn(
            'flex-1 px-4 py-3 rounded-xl font-semibold text-sm',
            'text-white transition-all duration-200',
            'flex items-center justify-center gap-2',
            'hover:scale-105 active:scale-95',
            'shadow-lg hover:shadow-xl'
          )}
          style={{ background: buttonGradient }}
          aria-label="Edit Profile"
        >
          <span>Edit Profile</span>
        </button>
      </div>
    );
  }
  
  // Visitor view - show Follow, Message, Share
  const isFollowing = followStatus?.isFollowing || false;
  
  return (
    <div className={cn(
      'flex items-center gap-3 p-4 rounded-2xl',
      theme === 'dark' 
        ? 'bg-gray-800/50 backdrop-blur-xl border border-gray-700/50' 
        : 'bg-white/80 backdrop-blur-xl border border-gray-200/50',
      'shadow-[0_4px_16px_rgba(0,0,0,0.08)]',
      'dark:shadow-[0_4px_16px_rgba(0,0,0,0.16)]'
    )}>
      {/* Follow / Following Button */}
      <FollowButton
        isFollowing={isFollowing}
        loading={followLoading}
        onFollow={handleFollow}
        onUnfollow={handleUnfollow}
        theme={theme}
      />
      
      {/* Message Button */}
      <button
        onClick={handleMessage}
        className={cn(
          'flex-1 px-4 py-3 rounded-xl font-semibold text-sm',
          'flex items-center justify-center gap-2',
          'transition-all duration-200',
          'hover:scale-105 active:scale-95',
          'shadow-lg hover:shadow-xl'
        )}
        style={{ 
          background: buttonGradient,
          color: 'white'
        }}
        aria-label="Send Message"
      >
        <MessageCircle className="w-4 h-4" aria-hidden="true" />
        <span>Message</span>
      </button>
      
      {/* Share Button */}
      <button
        onClick={handleShare}
        className={cn(
          'p-3 rounded-xl',
          theme === 'dark' 
            ? 'bg-gray-700/80 hover:bg-gray-600/80 border border-gray-600/50' 
            : 'bg-gray-100/80 hover:bg-gray-200/80 border border-gray-300/50',
          'transition-all duration-200',
          'hover:scale-105 active:scale-95',
          'shadow-lg hover:shadow-xl'
        )}
        aria-label="Share Profile"
      >
        <Share2 className="w-5 h-5 text-gray-600 dark:text-gray-400" aria-hidden="true" />
      </button>
      
      {/* More Options */}
      <button
        onClick={handleMoreOptions}
        className={cn(
          'p-3 rounded-xl',
          theme === 'dark' 
            ? 'bg-gray-700/80 hover:bg-gray-600/80 border border-gray-600/50' 
            : 'bg-gray-100/80 hover:bg-gray-200/80 border border-gray-300/50',
          'transition-all duration-200',
          'hover:scale-105 active:scale-95',
          'shadow-lg hover:shadow-xl'
        )}
        aria-label="More Options"
      >
        <MoreHorizontal className="w-5 h-5 text-gray-600 dark:text-gray-400" aria-hidden="true" />
      </button>
    </div>
  );
});

ProfileActions.displayName = 'ProfileActions';

export default ProfileActions;
