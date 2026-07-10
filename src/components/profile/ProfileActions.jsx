/**
 * src/components/profile/ProfileActions.jsx - ARVDOUL Profile Actions Component
 * 
 * Action buttons for profile interactions.
 * Follow, Message, Share, etc.
 * 
 * @component
 */

import React, { memo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  UserPlus, 
  UserMinus, 
  MessageCircle, 
  Share2, 
  MoreHorizontal,
  Bell,
  BellOff,
  Shield,
  ShieldOff
} from 'lucide-react';
import { cn } from '../../lib/utils';
import FollowButton from './FollowButton';

/**
 * ProfileActions Component
 * @param {Object} props
 */
const ProfileActions = ({
  profile,
  isOwner = false,
  followStatus = null,
  followLoading = false,
  onFollow,
  onUnfollow,
  onMessage,
  onShare,
  onBlock,
  onReport,
  theme = 'light',
}) => {
  const navigate = useNavigate();
  
  // ARVDOUL Button Gradient
  const buttonGradient = 'linear-gradient(135deg, #B416DB 0%, #872FE2 50%, #4B6BFF 100%)';

  const handleMessage = useCallback(() => {
    if (onMessage) {
      onMessage();
    } else if (profile?.id) {
      navigate(`/messages/new?to=${profile.id}`);
    }
  }, [onMessage, navigate, profile?.id]);

  const handleShare = useCallback(() => {
    if (onShare) {
      onShare();
      return;
    }
    
    const shareUrl = `${window.location.origin}/profile/${profile?.id}`;
    if (navigator.share) {
      navigator.share({
        title: `${profile?.displayName}'s Profile`,
        url: shareUrl,
      }).catch(() => {});
    } else {
      navigator.clipboard.writeText(shareUrl);
    }
  }, [onShare, profile]);

  if (isOwner) {
    return (
      <div className="flex items-center gap-2">
        <button
          onClick={() => navigate('/profile/edit')}
          className={cn(
            'flex-1 py-2.5 px-4 rounded-xl font-semibold text-sm',
            'text-white transition-opacity hover:opacity-90',
            'flex items-center justify-center gap-2'
          )}
          style={{ background: buttonGradient }}
        >
          Edit Profile
        </button>
        <button
          onClick={() => navigate('/profile/settings')}
          className={cn(
            'p-2.5 rounded-xl',
            'bg-gray-100 dark:bg-gray-800',
            'hover:bg-gray-200 dark:hover:bg-gray-700',
            'transition-colors'
          )}
          aria-label="Settings"
        >
          <MoreHorizontal className="w-5 h-5 text-gray-600 dark:text-gray-400" />
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <FollowButton
        isFollowing={followStatus?.isFollowing || false}
        loading={followLoading}
        onFollow={onFollow}
        onUnfollow={onUnfollow}
        theme={theme}
      />
      
      <button
        onClick={handleMessage}
        className={cn(
          'px-4 py-2.5 rounded-xl font-semibold text-sm',
          'bg-gray-100 dark:bg-gray-800',
          'hover:bg-gray-200 dark:hover:bg-gray-700',
          'transition-colors',
          'flex items-center gap-2'
        )}
      >
        <MessageCircle className="w-4 h-4" />
        Message
      </button>
      
      <button
        onClick={handleShare}
        className={cn(
          'p-2.5 rounded-xl',
          'bg-gray-100 dark:bg-gray-800',
          'hover:bg-gray-200 dark:hover:bg-gray-700',
          'transition-colors'
        )}
        aria-label="Share profile"
      >
        <Share2 className="w-5 h-5 text-gray-600 dark:text-gray-400" />
      </button>
      
      <button
        className={cn(
          'p-2.5 rounded-xl',
          'bg-gray-100 dark:bg-gray-800',
          'hover:bg-gray-200 dark:hover:bg-gray-700',
          'transition-colors'
        )}
        aria-label="More options"
      >
        <MoreHorizontal className="w-5 h-5 text-gray-600 dark:text-gray-400" />
      </button>
    </div>
  );
};

export default memo(ProfileActions);
