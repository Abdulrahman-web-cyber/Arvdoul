/**
 * src/components/profile/ProfileBadges.jsx - ARVDOUL Profile Badges Component
 * 
 * Displays user badges and achievements.
 * 
 * @component
 */

import React, { memo } from 'react';
import { cn } from '../../lib/utils';
import { 
  BadgeCheck, 
  Flame, 
  Star, 
  Zap, 
  Award,
  Crown,
  Shield,
  Heart
} from 'lucide-react';

/**
 * Badge icon mapping
 */
const BADGE_ICONS = {
  verified: BadgeCheck,
  top_creator: Crown,
  trending: Flame,
  star: Star,
  power_user: Zap,
  champion: Award,
  guardian: Shield,
  supporter: Heart,
};

/**
 * Badge colors
 */
const BADGE_COLORS = {
  verified: 'bg-blue-500/10 text-blue-600 border-blue-500/30',
  top_creator: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/30',
  trending: 'bg-orange-500/10 text-orange-600 border-orange-500/30',
  star: 'bg-purple-500/10 text-purple-600 border-purple-500/30',
  power_user: 'bg-green-500/10 text-green-600 border-green-500/30',
  champion: 'bg-pink-500/10 text-pink-600 border-pink-500/30',
  guardian: 'bg-indigo-500/10 text-indigo-600 border-indigo-500/30',
  supporter: 'bg-red-500/10 text-red-600 border-red-500/30',
};

/**
 * ProfileBadges Component
 * @param {Object} props
 */
const ProfileBadges = ({
  badges = [],
  theme = 'light',
  maxVisible = 5,
}) => {
  if (!badges || badges.length === 0) {
    return null;
  }

  const visibleBadges = badges.slice(0, maxVisible);
  const remainingCount = badges.length - maxVisible;

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {visibleBadges.map((badge, index) => {
        const IconComponent = BADGE_ICONS[badge.type] || Award;
        const colorClass = BADGE_COLORS[badge.type] || 'bg-gray-500/10 text-gray-600 border-gray-500/30';
        
        return (
          <div
            key={badge.id || badge.type || index}
            className={cn(
              'inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium',
              'border',
              colorClass
            )}
            title={badge.name || badge.description || badge.type}
          >
            <IconComponent className="w-3 h-3" />
            <span>{badge.name || badge.type}</span>
          </div>
        );
      })}
      
      {remainingCount > 0 && (
        <div
          className={cn(
            'inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium',
            'bg-gray-100 dark:bg-gray-800',
            'text-gray-600 dark:text-gray-400',
            'border border-gray-200 dark:border-gray-700'
          )}
        >
          +{remainingCount} more
        </div>
      )}
    </div>
  );
};

export default memo(ProfileBadges);
