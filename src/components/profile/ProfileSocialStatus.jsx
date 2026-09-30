/**
 * src/components/profile/ProfileSocialStatus.jsx - ARVDOUL Profile Social Status Component
 * 
 * Displays social connection status (Follows you, etc.).
 * 
 * @component
 */

/**
 * @typedef {Object} ProfileSocialStatusProps
 * @property {Object} [followStatus] - Follow status
 * @property {string} [theme='light'] - Current theme
 */

import React, { memo } from 'react';
import { cn } from '../../lib/utils';
import { UserCheck } from 'lucide-react';

/**
 * ProfileSocialStatus Component
 * @type {React.FC<ProfileSocialStatusProps>}
 */
const ProfileSocialStatus = memo(({
  followStatus,
  theme = 'light',
}) => {
  const followsYou = followStatus?.followsYou || false;
  const youFollow = followStatus?.isFollowing || false;
  
  if (followsYou && youFollow) {
    return (
      <div 
        className={cn(
          'inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium',
          'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
        )}
        role="status"
      >
        <UserCheck className="w-3 h-3" />
        <span>Follows you</span>
      </div>
    );
  }
  
  if (followsYou) {
    return (
      <div 
        className={cn(
          'inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium',
          'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
        )}
        role="status"
      >
        <span>Follows you</span>
      </div>
    );
  }
  
  return null;
});

ProfileSocialStatus.displayName = 'ProfileSocialStatus';

export default ProfileSocialStatus;
