/**
 * src/components/profile/ProfileStats.jsx - ARVDOUL Profile Stats Component
 * 
 * Displays profile statistics in a row with clickable items.
 * Shows posts, followers, following, friends, likes, and coins.
 * 
 * @component
 */

import React, { memo, useCallback } from 'react';
import { cn } from '../../lib/utils';

/**
 * Format number with K, M suffix
 */
const formatNumber = (num) => {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num?.toString() || '0';
};

/**
 * ProfileStats Component
 * @param {Object} props
 */
const ProfileStats = ({
  posts = 0,
  followers = 0,
  following = 0,
  friends = 0,
  likes = 0,
  coins = 0,
  theme = 'light',
  onStatPress,
}) => {
  const stats = [
    { key: 'posts', label: 'Posts', value: posts },
    { key: 'followers', label: 'Followers', value: followers },
    { key: 'following', label: 'Following', value: following },
    { key: 'friends', label: 'Friends', value: friends },
    { key: 'likes', label: 'Likes', value: likes },
    { key: 'coins', label: 'Coins', value: coins, icon: '🪙' },
  ];

  const handleClick = useCallback((key) => {
    if (onStatPress) {
      onStatPress(key);
    }
  }, [onStatPress]);

  return (
    <div className={cn(
      'flex items-center justify-around',
      'py-3 px-2',
      'bg-gray-50 dark:bg-gray-800/50',
      'rounded-xl',
      'border border-gray-100 dark:border-gray-700/50'
    )}>
      {stats.map((stat) => (
        <button
          key={stat.key}
          onClick={() => handleClick(stat.key)}
          className={cn(
            'flex flex-col items-center',
            'px-2 py-1',
            'rounded-lg',
            'hover:bg-gray-100 dark:hover:bg-gray-700',
            'transition-colors',
            'min-w-[50px]'
          )}
          disabled={!onStatPress}
        >
          <div className="flex items-center gap-1">
            {stat.icon && <span className="text-sm">{stat.icon}</span>}
            <span className={cn(
              'text-lg font-bold',
              'text-gray-900 dark:text-white'
            )}>
              {formatNumber(stat.value)}
            </span>
          </div>
          <span className={cn(
            'text-xs',
            'text-gray-500 dark:text-gray-400'
          )}>
            {stat.label}
          </span>
        </button>
      ))}
    </div>
  );
};

export default memo(ProfileStats);
