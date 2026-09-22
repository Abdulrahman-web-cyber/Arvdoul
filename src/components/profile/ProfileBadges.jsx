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
import { BadgeCheck, Crown, Sparkles, Flame, Landmark, Award, Zap, ShieldCheck } from 'lucide-react';

/**
 * Badge configurations
 */
const BADGE_CONFIG = {
  premium: {
    icon: Sparkles,
    label: 'Premium',
    className: 'bg-gradient-to-r from-amber-500 to-yellow-500 text-white shadow-sm',
  },
  topCreator: {
    icon: Crown,
    label: 'Top Creator',
    className: 'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-sm',
  },
  creator: {
    icon: Crown,
    label: 'Creator',
    className: 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-sm',
  },
  partner: {
    icon: Crown,
    label: 'Partner',
    className: 'bg-gradient-to-r from-fuchsia-600 to-rose-500 text-white shadow-sm',
  },
  verified: {
    icon: BadgeCheck,
    label: 'Verified',
    className: 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white shadow-sm',
  },
  streak: {
    icon: Flame,
    label: 'Active Streak',
    className: 'bg-gradient-to-r from-orange-500 to-red-500 text-white shadow-sm',
  },
  citizen: {
    icon: Landmark,
    label: 'Citizen',
    className: 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-sm',
  },
  senator: {
    icon: ShieldCheck,
    label: 'Senator',
    className: 'bg-gradient-to-r from-indigo-600 to-purple-700 text-white shadow-sm',
  },
  founder: {
    icon: Zap,
    label: 'Founder',
    className: 'bg-gradient-to-r from-amber-400 via-rose-500 to-purple-600 text-white shadow-sm font-semibold',
  },
  levelMilestone: {
    icon: Award,
    label: 'Milestone',
    className: 'bg-gradient-to-r from-violet-600 to-blue-600 text-white shadow-sm',
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
  
  const renderBadge = (badge, index) => {
    const config = BADGE_CONFIG[badge.type] || {
      icon: badge.icon || Sparkles,
      label: badge.label || 'Badge',
      className: 'bg-gradient-to-r from-purple-500 to-blue-500 text-white shadow-sm',
    };
    
    const Icon = config.icon;
    const label = badge.label || config.label;
    
    return (
      <span
        key={badge.id || badge.type || index}
        className={cn(
          'inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium tracking-wide transition-transform hover:scale-105',
          config.className
        )}
        title={badge.description || label}
        role="img"
        aria-label={label}
      >
        <Icon className="w-3 h-3 flex-shrink-0" aria-hidden="true" />
        <span className="whitespace-nowrap">{label}</span>
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
