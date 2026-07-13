/**
 * src/components/profile/ProfileHeader.jsx - ARVDOUL Profile Header Component
 * 
 * Main profile header with avatar, level badge, and action buttons.
 * Displays profile information with owner/viewer-specific actions.
 * Features glassmorphism, floating shadows, and ARVDOUL DNA gradient.
 * 
 * @component
 */

/**
 * @typedef {Object} ProfileHeaderProps
 * @property {Object} [profile] - User profile data
 * @property {boolean} [isOwner=false] - Whether viewing own profile
 * @property {number} [level=null] - User level
 * @property {Object} [position=null] - User position/ranking
 * @property {string} [theme='light'] - Current theme (light/dark)
 * @property {Function} [onAvatarPress] - Avatar click handler
 * @property {Function} [onCoverPress] - Cover photo click handler
 * @property {Function} [onEditPress] - Edit profile handler
 * @property {Function} [onSharePress] - Share profile handler
 * @property {Function} [onSettingsPress] - Settings handler
 * @property {Function} [onDashboardPress] - Creator dashboard handler
 * @property {Function} [onStatPress] - Stat click handler
 * @property {Function} [onMutualFriendPress] - Mutual friend click handler
 */

import React, { memo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Settings, 
  Share2, 
  Edit3, 
  MoreHorizontal,
  Shield,
  Crown,
  BadgeCheck,
  MessageCircle
} from 'lucide-react';
import { cn } from '../../lib/utils';
import ProfileAvatar from './ProfileAvatar';
import ProfileCoverPhoto from './ProfileCoverPhoto';
import ProfileLevel from './ProfileLevel';
import ProfileBadges from './ProfileBadges';
import ProfileStats from './ProfileStats';

/**
 * ProfileHeader Component
 * @type {React.FC<ProfileHeaderProps>}
 */
const ProfileHeader = memo(({
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
  const buttonGradient = 'linear-gradient(135deg, #B416DB 0%, #872FE2 50%, #4B6BFF 100%)';
  
  // Get position icon
  const getPositionIcon = useCallback(() => {
    if (!position?.label) return null;
    
    if (position.label.includes('King') || position.label.includes('Queen')) {
      return <Crown className="w-4 h-4 text-yellow-400" aria-hidden="true" />;
    }
    if (position.label.includes('Lord') || position.label.includes('Lady')) {
      return <Shield className="w-4 h-4 text-purple-400" aria-hidden="true" />;
    }
    return null;
  }, [position?.label]);
  
  // Handle share
  const handleShare = useCallback(() => {
    if (onSharePress) {
      onSharePress();
      return;
    }
    
    const userId = profile?.uid || profile?.id;
    const shareUrl = `${window.location.origin}/profile/${userId}`;
    if (navigator.share) {
      navigator.share({
        title: `${profile?.displayName}'s Profile`,
        url: shareUrl,
      }).catch(() => {});
    } else {
      navigator.clipboard.writeText(shareUrl);
    }
  }, [onSharePress, profile?.displayName, profile?.uid, profile?.id]);
  
  // Handle message
  const handleMessage = useCallback(() => {
    const userId = profile?.uid || profile?.id;
    if (userId) {
      navigate(`/messages/new?to=${userId}`);
    }
  }, [navigate, profile?.uid, profile?.id]);

  // Handle more options
  const handleMoreOptions = useCallback(() => {
    // TODO: Show more options menu
  }, []);

  // Loading state
  if (!profile) {
    return (
      <div className={cn(
        'w-full rounded-2xl overflow-hidden',
        'bg-white dark:bg-gray-900',
        'shadow-lg dark:shadow-gray-900/50',
        'border border-gray-200 dark:border-gray-800'
      )}>
        <div className="h-48 bg-gray-200 dark:bg-gray-800 animate-pulse" />
        <div className="px-4 pb-4">
          <div className="flex items-end justify-between -mt-12 relative z-10">
            <div className="w-28 h-28 rounded-full bg-gray-200 dark:bg-gray-700 animate-pulse ring-4 ring-white dark:ring-gray-900" />
          </div>
          <div className="mt-4 space-y-2">
            <div className="h-6 w-32 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
            <div className="h-4 w-24 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
          </div>
        </div>
      </div>
    );
  }
  
  const userId = profile.uid || profile.id;
  
  return (
    <article 
      className={cn(
        'w-full rounded-2xl overflow-hidden',
        theme === 'dark' 
          ? 'bg-gray-900/80 backdrop-blur-xl border border-gray-800/50' 
          : 'bg-white/80 backdrop-blur-xl border border-gray-200/50',
        'shadow-[0_8px_32px_rgba(0,0,0,0.16),0_4px_16px_rgba(0,0,0,0.08)]',
        'dark:shadow-[0_8px_32px_rgba(0,0,0,0.4),0_4px_16px_rgba(0,0,0,0.2)]'
      )}
      aria-label={`${profile.displayName || 'User'}'s Profile`}
    >
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
        <div className="flex items-end justify-between -mt-14 relative z-10">
          {/* Avatar with ARVDOUL DNA gradient ring */}
          <ProfileAvatar
            src={profile.photoURL}
            name={profile.displayName}
            size={128}
            level={level || profile.level}
            onPress={onAvatarPress}
            isOwner={isOwner}
            theme={theme}
          />
          
          {/* Action Buttons */}
          <div className="flex items-center gap-2 pb-1">
            {isOwner ? (
              <>
                <button
                  onClick={onEditPress || (() => navigate('/profile/edit'))}
                  className={cn(
                    'px-4 py-2 rounded-xl font-semibold text-sm',
                    'text-white hover:opacity-90 transition-all duration-200',
                    'flex items-center gap-2',
                    'hover:scale-105 active:scale-95',
                    'shadow-lg hover:shadow-xl'
                  )}
                  style={{ background: buttonGradient }}
                  aria-label="Edit Profile"
                >
                  <Edit3 className="w-4 h-4" aria-hidden="true" />
                  <span>Edit Profile</span>
                </button>
                <button
                  onClick={onSettingsPress || (() => navigate('/profile/settings'))}
                  className={cn(
                    'p-2.5 rounded-xl',
                    theme === 'dark' 
                      ? 'bg-gray-800/80 hover:bg-gray-700/80' 
                      : 'bg-white/80 hover:bg-gray-100',
                    'border border-gray-700/20 dark:border-gray-300/20',
                    'hover:scale-105 active:scale-95 transition-all duration-200',
                    'shadow-lg hover:shadow-xl'
                  )}
                  aria-label="Profile Settings"
                >
                  <Settings className="w-5 h-5 text-gray-600 dark:text-gray-400" aria-hidden="true" />
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={handleMessage}
                  className={cn(
                    'px-4 py-2 rounded-xl font-semibold text-sm',
                    'text-white hover:opacity-90 transition-all duration-200',
                    'flex items-center gap-2',
                    'hover:scale-105 active:scale-95',
                    'shadow-lg hover:shadow-xl'
                  )}
                  style={{ background: buttonGradient }}
                  aria-label="Send Message"
                >
                  <MessageCircle className="w-4 h-4" aria-hidden="true" />
                  <span>Message</span>
                </button>
                <button
                  onClick={handleShare}
                  className={cn(
                    'p-2.5 rounded-xl',
                    theme === 'dark' 
                      ? 'bg-gray-800/80 hover:bg-gray-700/80' 
                      : 'bg-white/80 hover:bg-gray-100',
                    'border border-gray-700/20 dark:border-gray-300/20',
                    'hover:scale-105 active:scale-95 transition-all duration-200',
                    'shadow-lg hover:shadow-xl'
                  )}
                  aria-label="Share Profile"
                >
                  <Share2 className="w-5 h-5 text-gray-600 dark:text-gray-400" aria-hidden="true" />
                </button>
                <button
                  onClick={handleMoreOptions}
                  className={cn(
                    'p-2.5 rounded-xl',
                    theme === 'dark' 
                      ? 'bg-gray-800/80 hover:bg-gray-700/80' 
                      : 'bg-white/80 hover:bg-gray-100',
                    'border border-gray-700/20 dark:border-gray-300/20',
                    'hover:scale-105 active:scale-95 transition-all duration-200',
                    'shadow-lg hover:shadow-xl'
                  )}
                  aria-label="More Options"
                >
                  <MoreHorizontal className="w-5 h-5 text-gray-600 dark:text-gray-400" aria-hidden="true" />
                </button>
              </>
            )}
          </div>
        </div>
        
        {/* Name and Badges */}
        <div className="mt-3">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              {profile.displayName || 'User'}
            </h1>
            {profile.verified && (
              <BadgeCheck className="w-5 h-5 text-blue-500" aria-label="Verified Account" />
            )}
            {getPositionIcon()}
          </div>
          
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
            @{profile.username || 'username'}
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
            <span 
              className={cn(
                'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold',
                'bg-gradient-to-r from-purple-500/15 to-blue-500/15',
                'text-purple-600 dark:text-purple-400',
                'border border-purple-500/30 dark:border-purple-400/30',
                'backdrop-blur-sm'
              )}
            >
              {getPositionIcon()}
              <span>{position.label}</span>
              {position.position && <span className="opacity-70">#{position.position}</span>}
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
    </article>
  );
});

ProfileHeader.displayName = 'ProfileHeader';

export default ProfileHeader;
