/**
 * src/components/profile/ProfileBadges.jsx - ARVDOUL Profile Badges Component
 * 
 * Displays profile badges (Premium, Verified, Top Creator).
 * 
 * @component
 */

/**
 * @typedef {Object} ProfileBadgesProps
 * @property {Array} [badges=[]] - Array of badge objects
 * @property {string} [theme='light'] - Current theme
 */

import React, { memo } from 'react';
import { cn } from '../../lib/utils';
import { BadgeCheck, Crown, Sparkles } from 'lucide-react';

/**
 * Badge configurations
 */
const BADGE_CONFIG = {
  premium: {
    icon: Sparkles,
    label: 'Premium',
    className: 'bg-gradient-to-r from-yellow-500 to-orange-500 text-white',
  },
  topCreator: {
    icon: Crown,
    label: 'Top Creator',
    className: 'bg-gradient-to-r from-purple-500 to-pink-500 text-white',
  },
  verified: {
    icon: BadgeCheck,
    label: 'Verified',
    className: 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white',
  },
};

/**
 * ProfileBadges Component
 * @type {React.FC<ProfileBadgesProps>}
 */
const ProfileBadges = memo(({
  badges = [],
  theme = 'light',
}) => {
  if (!badges || badges.length === 0) {
    return null;
  }
  
  const renderBadge = (badge) => {
    const config = BADGE_CONFIG[badge.type] || {
      icon: Sparkles,
      label: badge.label || 'Badge',
      className: 'bg-gradient-to-r from-purple-500 to-blue-500 text-white',
    };
    
    const Icon = config.icon;
    
    return (
      <span
        key={badge.type || badge.id}
        className={cn(
          'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium',
          config.className
        )}
        title={badge.description || config.label}
        role="img"
        aria-label={config.label}
      >
        <Icon className="w-3 h-3" aria-hidden="true" />
        <span>{config.label}</span>
      </span>
    );
  };
  
  return (
    <div 
      className="flex flex-wrap items-center gap-1.5"
      role="list"
      aria-label="Profile badges"
    >
      {badges.map(renderBadge)}
    </div>
  );
});

ProfileBadges.displayName = 'ProfileBadges';

export default ProfileBadges;
