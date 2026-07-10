/**
 * src/components/profile/ProfileStatsGrid.jsx - ARVDOUL Profile Stats Grid Component
 * 
 * Grid view of profile statistics.
 * 
 * @component
 */

import React, { memo, useCallback } from 'react';
import { cn } from '../../lib/utils';
import { 
  FileText, 
  Users, 
  UserPlus, 
  Heart, 
  Coins,
  MessageCircle,
  Share2,
  Eye,
  TrendingUp
} from 'lucide-react';

/**
 * ProfileStatsGrid Component
 * @param {Object} props
 */
const ProfileStatsGrid = ({
  stats = {},
  theme = 'light',
  onStatPress,
}) => {
  const items = [
    { key: 'posts', label: 'Posts', value: stats.posts || 0, icon: FileText, color: 'text-blue-500' },
    { key: 'followers', label: 'Followers', value: stats.followers || 0, icon: Users, color: 'text-purple-500' },
    { key: 'following', label: 'Following', value: stats.following || 0, icon: UserPlus, color: 'text-pink-500' },
    { key: 'friends', label: 'Friends', value: stats.friends || 0, icon: Heart, color: 'text-red-500' },
    { key: 'likes', label: 'Likes', value: stats.likes || 0, icon: Heart, color: 'text-rose-500' },
    { key: 'comments', label: 'Comments', value: stats.comments || 0, icon: MessageCircle, color: 'text-cyan-500' },
    { key: 'shares', label: 'Shares', value: stats.shares || 0, icon: Share2, color: 'text-orange-500' },
    { key: 'views', label: 'Views', value: stats.views || 0, icon: Eye, color: 'text-indigo-500' },
    { key: 'coins', label: 'Coins', value: stats.coins || 0, icon: Coins, color: 'text-yellow-500' },
    { key: 'engagement', label: 'Engagement', value: `${stats.engagementRate || 0}%`, icon: TrendingUp, color: 'text-green-500' },
  ];

  const handlePress = useCallback((key) => {
    if (onStatPress) {
      onStatPress(key);
    }
  }, [onStatPress]);

  return (
    <div className="grid grid-cols-2 gap-3">
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <button
            key={item.key}
            onClick={() => handlePress(item.key)}
            className={cn(
              'p-4 rounded-xl text-left',
              'bg-gray-50 dark:bg-gray-800/50',
              'hover:bg-gray-100 dark:hover:bg-gray-800',
              'transition-colors',
              'border border-gray-100 dark:border-gray-700/50'
            )}
          >
            <div className="flex items-center gap-2 mb-2">
              <Icon className={cn('w-5 h-5', item.color)} />
              <span className="text-sm text-gray-500 dark:text-gray-400">
                {item.label}
              </span>
            </div>
            <p className="text-xl font-bold text-gray-900 dark:text-white">
              {item.value}
            </p>
          </button>
        );
      })}
    </div>
  );
};

export default memo(ProfileStatsGrid);
