/**
 * src/components/profile/ProfileLevel.jsx - ARVDOUL Profile Level Component
 * 
 * Displays user level badge with progress indicator.
 * 
 * @component
 */

import React, { memo } from 'react';
import { cn } from '../../lib/utils';
import { Zap, Star } from 'lucide-react';

/**
 * Get level tier info
 */
const getLevelTier = (level) => {
  if (level >= 50) return { name: 'Legendary', color: 'text-yellow-400', bg: 'bg-yellow-400/10', border: 'border-yellow-400/30' };
  if (level >= 30) return { name: 'Elite', color: 'text-purple-400', bg: 'bg-purple-400/10', border: 'border-purple-400/30' };
  if (level >= 20) return { name: 'Pro', color: 'text-blue-400', bg: 'bg-blue-400/10', border: 'border-blue-400/30' };
  if (level >= 10) return { name: 'Advanced', color: 'text-green-400', bg: 'bg-green-400/10', border: 'border-green-400/30' };
  if (level >= 5) return { name: 'Rising', color: 'text-cyan-400', bg: 'bg-cyan-400/10', border: 'border-cyan-400/30' };
  return { name: 'Newcomer', color: 'text-gray-400', bg: 'bg-gray-400/10', border: 'border-gray-400/30' };
};

/**
 * ProfileLevel Component
 * @param {Object} props
 */
const ProfileLevel = ({
  level = 1,
  showProgress = false,
  currentXP = 0,
  requiredXP = 100,
  theme = 'light',
  size = 'default',
}) => {
  const tier = getLevelTier(level);
  const progress = showProgress && requiredXP > 0 ? (currentXP / requiredXP) * 100 : 0;
  
  const sizeClasses = {
    sm: 'text-xs px-1.5 py-0.5',
    default: 'text-sm px-2 py-1',
    lg: 'text-base px-3 py-1.5',
  };

  return (
    <div className="flex flex-col gap-1">
      <div
        className={cn(
          'inline-flex items-center gap-1.5 rounded-full font-semibold',
          'border',
          tier.bg,
          tier.color,
          tier.border,
          sizeClasses[size]
        )}
      >
        <Zap className="w-3.5 h-3.5" />
        <span>Level {level}</span>
        {size !== 'sm' && (
          <span className="opacity-70">•</span>
        )}
        {size !== 'sm' && (
          <span className="opacity-80">{tier.name}</span>
        )}
      </div>
      
      {showProgress && (
        <div className="w-full max-w-[120px]">
          <div className={cn(
            'h-1.5 rounded-full overflow-hidden',
            'bg-gray-200 dark:bg-gray-700'
          )}>
            <div
              className={cn(
                'h-full rounded-full transition-all duration-300',
                'bg-gradient-to-r from-purple-500 to-blue-500'
              )}
              style={{ width: `${Math.min(progress, 100)}%` }}
            />
          </div>
          <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">
            {currentXP} / {requiredXP} XP
          </p>
        </div>
      )}
    </div>
  );
};

export default memo(ProfileLevel);
