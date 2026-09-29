/**
 * src/components/profile/ProfileSocialStatus.jsx - ARVDOUL Profile Social Status Component
 * 
 * Displays social connection status (Follows you, etc.).
 * 
 * @component
 */

/**
 * @typedef {Object} ProfileSocialStatusProps
 * @property {Object} [followStatus] - Canonical relationship state
 */

import React, { memo } from 'react';
import { cn } from '../../lib/utils';
import { UserCheck } from 'lucide-react';

/**
 * ProfileSocialStatus Component
 * @type {React.FC<ProfileSocialStatusProps>}
 */
const ProfileSocialStatus = memo(({ followStatus }) => {
  // `getRelationshipState` reports the target->viewer direction as `isFollower`
  // (with `isMutualFriend` when both directions follow). An unresolved status is
  // never coerced into a "Follows you" claim.
  const followsYou = followStatus?.isFollower ?? followStatus?.followsYou ?? false;
  const mutual = followStatus?.isMutualFriend === true;

  if (!followsYou) return null;

  return (
    <div
      className={cn(
        'inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium',
        mutual
          ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
          : 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400',
      )}
      role="status"
    >
      <UserCheck className="w-3 h-3" aria-hidden="true" />
      <span>{mutual ? 'Mutual follow' : 'Follows you'}</span>
    </div>
  );
});

ProfileSocialStatus.displayName = 'ProfileSocialStatus';

export default ProfileSocialStatus;
