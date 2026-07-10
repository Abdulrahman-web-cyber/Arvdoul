/**
 * src/components/profile/ProfileHeader.jsx - ARVDOUL Profile Header Component
 * 
 * Main profile header with avatar, cover photo, level badge, and action buttons.
 * Displays profile information with owner/viewer-specific actions.
 * 
 * @component
 * @param {Object} props - Component props
 * @param {Object} props.profile - User profile data
 * @param {boolean} props.isOwner - Whether viewing own profile
 * @param {number} props.level - User level
 * @param {Object} props.position - User position/ranking
 * @param {string} props.theme - Current theme (light/dark)
 * @param {Function} props.onAvatarPress - Avatar click handler
 * @param {Function} props.onCoverPress - Cover photo click handler
 * @param {Function} props.onEditPress - Edit profile handler
 * @param {Function} props.onSharePress - Share profile handler
 * @param {Function} props.onSettingsPress - Settings handler
 * @param {Function} props.onDashboardPress - Creator dashboard handler
 * @param {Function} props.onStatPress - Stat click handler
 * @param {Function} props.onMutualFriendPress - Mutual friend click handler
 */

import React, { memo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Settings, 
  Share2, 
  Edit3, 
  BarChart2, 
  MoreHorizontal,
  Shield,
  Crown,
  BadgeCheck
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { useTheme } from '../../context/ThemeContext';
import ProfileAvatar from './ProfileAvatar';
import ProfileCoverPhoto from './ProfileCoverPhoto';
import ProfileLevel from './ProfileLevel';
import ProfileBadges from './ProfileBadges';
import ProfileStats from './ProfileStats';

/**
 * ProfileHeader Component
 * Main header displaying profile overview with actions
 */
const ProfileHeader = ({
  profile,
  isOwner = false,
  level = null,
  position = null,
  theme = 'light',
  onAvatarPress,
  onCoverPress,
  onEditPress,
  onSharePress,
  onSettingsPress,
  onDashboardPress,
  onStatPress,
  onMutualFriendPress,
}) => {
  const navigate = useNavigate();
  
  // ARVDOUL DNA Gradient
  const gradientPrimary = 'linear-gradient(135deg, #B416DB 0%, #872FE2 35%, #4B6BFF 70%, #0EA3E6 100%)';
  const buttonGradient = 'linear-gradient(135deg, #B416DB 0%, #872FE2 50%, #4B6BFF 100%)';
  
  // Get position icon
  const getPositionIcon = useCallback(() => {
    if (!position?.label) return null;
    
    if (position.label.includes('King') || position.label.includes('Queen')) {
      return <Crown className="w-4 h-4 text-yellow-400" />;
    }
    if (position.label.includes('Lord') || position.label.includes('Lady')) {
      return <Shield className="w-4 h-4 text-purple-400" />;
    }
    return null;
  }, [position]);
  
  // Handle share
  const handleShare = useCallback(() => {
    if (onSharePress) {
      onSharePress();
      return;
    }
    
    // Default share behavior
    const shareUrl = `${window.location.origin}/profile/${profile?.id}`;
    if (navigator.share) {
      navigator.share({
        title: `${profile?.displayName}'s Profile`,
        url: shareUrl,
      }).catch(() => {});
    } else {
      navigator.clipboard.writeText(shareUrl);
    }
  }, [onSharePress, profile]);
  
  // Handle message
  const handleMessage = useCallback(() => {
    if (profile?.id) {
      navigate(`/messages/new?to=${profile.id}`);
    }
  }, [navigate, profile?.id]);
  
  if (!profile) {
    return (
      <div className="w-full animate-pulse">
        <div className="h-48 bg-gray-200 dark:bg-gray-800 rounded-2xl" />
        <div className="px-4 -mt-12 relative z-10">
          <div className="w-24 h-24 rounded-full bg-gray-200 dark:bg-gray-700" />
        </div>
      </div>
    );
  }
  
  return (
    <div className={cn(
      'w-full rounded-2xl overflow-hidden',
      'bg-white dark:bg-gray-900',
      'shadow-lg dark:shadow-gray-900/50'
    )}>
      {/* Cover Photo */}
      <ProfileCoverPhoto
        coverUrl={profile.coverPhotoURL}
        onPress={onCoverPress}
        isOwner={isOwner}
        theme={theme}
      />
      
      {/* Profile Info Section */}
      <div className="px-4 pb-4">
        {/* Avatar and Actions Row */}
        <div className="flex items-end justify-between -mt-12 relative z-10">
          {/* Avatar */}
          <ProfileAvatar
            src={profile.photoURL}
            name={profile.displayName}
            size={120}
            level={level}
            onPress={onAvatarPress}
            isOwner={isOwner}
          />
          
          {/* Action Buttons */}
          <div className="flex items-center gap-2 pb-2">
            {isOwner ? (
              <>
                <button
                  onClick={onEditPress || (() => navigate('/profile/edit'))}
                  className={cn(
                    'px-4 py-2 rounded-xl font-medium text-sm',
                    'bg-gradient-to-r from-purple-500 to-blue-500',
                    'text-white hover:opacity-90 transition-opacity',
                    'flex items-center gap-2'
                  )}
                  style={{ background: buttonGradient }}
                >
                  <Edit3 className="w-4 h-4" />
                  Edit Profile
                </button>
                <button
                  onClick={onSettingsPress || (() => navigate('/profile/settings'))}
                  className={cn(
                    'p-2 rounded-xl',
                    'bg-gray-100 dark:bg-gray-800',
                    'hover:bg-gray-200 dark:hover:bg-gray-700',
                    'transition-colors'
                  )}
                  aria-label="Settings"
                >
                  <Settings className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={handleMessage}
                  className={cn(
                    'px-4 py-2 rounded-xl font-medium text-sm',
                    'bg-gradient-to-r from-purple-500 to-blue-500',
                    'text-white hover:opacity-90 transition-opacity',
                    'flex items-center gap-2'
                  )}
                  style={{ background: buttonGradient }}
                >
                  Message
                </button>
                <button
                  onClick={handleShare}
                  className={cn(
                    'p-2 rounded-xl',
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
                    'p-2 rounded-xl',
                    'bg-gray-100 dark:bg-gray-800',
                    'hover:bg-gray-200 dark:hover:bg-gray-700',
                    'transition-colors'
                  )}
                  aria-label="More options"
                >
                  <MoreHorizontal className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                </button>
              </>
            )}
          </div>
        </div>
        
        {/* Name and Badges */}
        <div className="mt-3">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              {profile.displayName}
            </h1>
            {profile.verified && (
              <BadgeCheck className="w-5 h-5 text-blue-500" />
            )}
            {getPositionIcon()}
          </div>
          
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
            @{profile.username}
          </p>
        </div>
        
        {/* Bio */}
        {profile.bio && (
          <p className="mt-3 text-gray-700 dark:text-gray-300 text-sm leading-relaxed">
            {profile.bio}
          </p>
        )}
        
        {/* Badges and Level */}
        <div className="mt-3 flex items-center gap-3 flex-wrap">
          <ProfileLevel level={level || profile.level} theme={theme} />
          <ProfileBadges badges={profile.badges || []} theme={theme} />
        </div>
        
        {/* Position Badge */}
        {position?.label && (
          <div className="mt-3">
            <span className={cn(
              'inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium',
              'bg-gradient-to-r from-purple-500/10 to-blue-500/10',
              'text-purple-600 dark:text-purple-400',
              'border border-purple-500/20'
            )}>
              {getPositionIcon()}
              {position.label}
              {position.position && ` (#${position.position})`}
            </span>
          </div>
        )}
        
        {/* Stats */}
        <div className="mt-4">
          <ProfileStats
            posts={profile.postCount || 0}
            followers={profile.followerCount || 0}
            following={profile.followingCount || 0}
            friends={profile.friendCount || 0}
            likes={profile.likesReceived || 0}
            coins={profile.coins || 0}
            theme={theme}
            onStatPress={onStatPress}
          />
        </div>
      </div>
    </div>
  );
};

export default memo(ProfileHeader);
