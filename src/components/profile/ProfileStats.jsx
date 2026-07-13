/**
 * src/components/profile/ProfileStats.jsx - ARVDOUL Profile Stats Component
 * 
 * Displays profile statistics with clickable stats and floating cards.
 * 
 * @component
 */

/**
 * @typedef {Object} ProfileStatsProps
 * @property {number} [posts=0] - Number of posts
 * @property {number} [followers=0] - Number of followers
 * @property {number} [following=0] - Number of following
 * @property {number} [friends=0] - Number of friends
 * @property {number} [likes=0] - Number of likes
 * @property {number} [coins=0] - Number of coins
 * @property {string} [theme='light'] - Current theme
 * @property {Function} [onStatPress] - Stat click handler
 */

import React, { memo, useCallback } from 'react';
import { cn } from '../../lib/utils';

/**
 * Format number with K, M, B suffix
 * @param {number} num - Number to format
 * @returns {string} Formatted number string
 */
const formatNumber = (num) => {
  if (num === undefined || num === null) return '0';
  if (num >= 1000000000) return `${(num / 1000000000).toFixed(1)}B`;
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toString();
};

/**
 * ProfileStats Component
 * @type {React.FC<ProfileStatsProps>}
 */
const ProfileStats = memo(({
  posts = 0,
  followers = 0,
  following = 0,
  friends = 0,
  likes = 0,
  coins = 0,
  theme = 'light',
  onStatPress,
}) => {
  // Stats data
  const stats = [
    { key: 'posts', label: 'Posts', value: posts },
    { key: 'followers', label: 'Followers', value: followers },
    { key: 'following', label: 'Following', value: following },
    { key: 'friends', label: 'Friends', value: friends },
    { key: 'likes', label: 'Likes', value: likes },
    { key: 'coins', label: 'Coins', value: coins, prefix: '🪙' },
  ];

  // Handle stat click
  const handleStatClick = useCallback((statKey) => {
    if (onStatPress) {
      onStatPress(statKey);
    }
  }, [onStatPress]);

  return (
    <div 
      className={cn(
        'grid grid-cols-6 gap-2 p-3 rounded-xl',
        theme === 'dark' 
          ? 'bg-gray-800/50 backdrop-blur-sm' 
          : 'bg-gray-50/80 backdrop-blur-sm',
        'border border-gray-200/50 dark:border-gray-700/50',
        'shadow-[0_4px_16px_rgba(0,0,0,0.08)]',
        'dark:shadow-[0_4px_16px_rgba(0,0,0,0.16)]'
      )}
      role="list"
      aria-label="Profile statistics"
    >
      {stats.map((stat) => (
        <button
          key={stat.key}
          onClick={() => handleStatClick(stat.key)}
          className={cn(
            'flex flex-col items-center justify-center p-2 rounded-lg',
            'transition-all duration-200',
            'hover:bg-gray-100 dark:hover:bg-gray-700/50',
            'active:scale-95'
          )}
          role="listitem"
          aria-label={`${stat.label}: ${formatNumber(stat.value)}`}
        >
          <span className={cn(
            'text-lg font-bold',
            'text-gray-900 dark:text-white',
            'transition-colors'
          )}>
            {stat.prefix && <span className="mr-0.5">{stat.prefix}</span>}
            {formatNumber(stat.value)}
          </span>
          <span className={cn(
            'text-[10px] font-medium uppercase tracking-wide',
            'text-gray-500 dark:text-gray-400'
          )}>
            {stat.label}
          </span>
        </button>
      ))}
    </div>
  );
});

ProfileStats.displayName = 'ProfileStats';

export default ProfileStats;
