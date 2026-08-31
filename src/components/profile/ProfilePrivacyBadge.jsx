/**
 * src/components/profile/ProfilePrivacyBadge.jsx - ARVDOUL Profile Privacy Badge Component
 */
import React, { memo } from 'react';
import { cn } from '../../lib/utils';
import { Lock } from 'lucide-react';

const ProfilePrivacyBadge = memo(({
  isPrivate = false,
  theme = 'light',
}) => {
  if (!isPrivate) return null;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium',
        'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
      )}
    >
      <Lock className="w-3 h-3" />
      Private
    </span>
  );
});

ProfilePrivacyBadge.displayName = 'ProfilePrivacyBadge';
export default ProfilePrivacyBadge;
