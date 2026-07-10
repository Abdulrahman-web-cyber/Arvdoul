/**
 * src/components/profile/ProfileAchievements.jsx - ARVDOUL Profile Achievements Component
 * 
 * Displays user achievements and badges.
 * 
 * @component
 */

import React, { memo, useState } from 'react';
import { cn } from '../../lib/utils';
import { 
  Trophy, 
  Medal, 
  Award, 
  Star, 
  Crown,
  Zap,
  Flame,
  Heart,
  ChevronRight,
  Lock
} from 'lucide-react';

/**
 * Achievement icons
 */
const ACHIEVEMENT_ICONS = {
  trophy: Trophy,
  medal: Medal,
  award: Award,
  star: Star,
  crown: Crown,
  zap: Zap,
  flame: Flame,
  heart: Heart,
};

/**
 * Achievement rarity colors
 */
const RARITY_COLORS = {
  common: { bg: 'bg-gray-100 dark:bg-gray-800', border: 'border-gray-300', text: 'text-gray-600' },
  uncommon: { bg: 'bg-green-100 dark:bg-green-900/20', border: 'border-green-400', text: 'text-green-600' },
  rare: { bg: 'bg-blue-100 dark:bg-blue-900/20', border: 'border-blue-400', text: 'text-blue-600' },
  epic: { bg: 'bg-purple-100 dark:bg-purple-900/20', border: 'border-purple-400', text: 'text-purple-600' },
  legendary: { bg: 'bg-yellow-100 dark:bg-yellow-900/20', border: 'border-yellow-400', text: 'text-yellow-600' },
};

/**
 * ProfileAchievements Component
 * @param {Object} props
 */
const ProfileAchievements = ({
  achievements = [],
  theme = 'light',
  onAchievementPress,
  showLocked = true,
  maxVisible = 6,
}) => {
  const [expanded, setExpanded] = useState(false);

  // Generate some default achievements if none provided
  const displayAchievements = achievements.length > 0 
    ? achievements 
    : [
        { id: '1', name: 'First Post', description: 'Created your first post', rarity: 'common', unlocked: true, icon: 'star' },
        { id: '2', name: 'Early Bird', description: 'Joined during launch', rarity: 'rare', unlocked: true, icon: 'zap' },
        { id: '3', name: 'Popular Creator', description: 'Reached 1000 followers', rarity: 'epic', unlocked: false, icon: 'crown' },
      ];

  const visibleAchievements = expanded 
    ? displayAchievements 
    : displayAchievements.slice(0, maxVisible);

  const handlePress = (achievement) => {
    if (onAchievementPress) {
      onAchievementPress(achievement);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
          <Trophy className="w-5 h-5 text-yellow-500" />
          Achievements
        </h3>
        <span className="text-sm text-gray-500 dark:text-gray-400">
          {displayAchievements.filter(a => a.unlocked).length}/{displayAchievements.length}
        </span>
      </div>
      
      <div className="grid grid-cols-3 gap-3">
        {visibleAchievements.map((achievement) => {
          const Icon = ACHIEVEMENT_ICONS[achievement.icon] || Award;
          const colors = RARITY_COLORS[achievement.rarity] || RARITY_COLORS.common;
          
          return (
            <button
              key={achievement.id}
              onClick={() => handlePress(achievement)}
              className={cn(
                'p-3 rounded-xl text-center',
                'border transition-all',
                achievement.unlocked
                  ? `${colors.bg} ${colors.border} hover:scale-105`
                  : 'bg-gray-100 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700 opacity-50'
              )}
            >
              <div className={cn(
                'w-10 h-10 mx-auto rounded-full mb-2',
                'flex items-center justify-center',
                achievement.unlocked
                  ? colors.bg
                  : 'bg-gray-200 dark:bg-gray-700'
              )}>
                {achievement.unlocked ? (
                  <Icon className={cn('w-5 h-5', colors.text)} />
                ) : (
                  <Lock className="w-4 h-4 text-gray-400" />
                )}
              </div>
              <p className={cn(
                'text-xs font-medium truncate',
                achievement.unlocked ? 'text-gray-900 dark:text-white' : 'text-gray-500'
              )}>
                {achievement.name}
              </p>
              {achievement.unlocked && (
                <p className={cn(
                  'text-[10px] capitalize mt-0.5',
                  colors.text
                )}>
                  {achievement.rarity}
                </p>
              )}
            </button>
          );
        })}
      </div>
      
      {displayAchievements.length > maxVisible && (
        <button
          onClick={() => setExpanded(!expanded)}
          className={cn(
            'w-full py-2 rounded-lg text-sm font-medium',
            'text-purple-600 dark:text-purple-400',
            'hover:bg-purple-50 dark:hover:bg-purple-900/20',
            'transition-colors flex items-center justify-center gap-1'
          )}
        >
          {expanded ? 'Show Less' : 'View All Achievements'}
          <ChevronRight className={cn('w-4 h-4 transition-transform', expanded && 'rotate-90')} />
        </button>
      )}
    </div>
  );
};

export default memo(ProfileAchievements);
