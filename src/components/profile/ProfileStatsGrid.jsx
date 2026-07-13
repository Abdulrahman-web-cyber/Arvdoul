/**
 * src/components/profile/ProfileStatsGrid.jsx - ARVDOUL Profile Stats Grid Component
 */
import React, { memo } from 'react';
import { cn } from '../../lib/utils';

const ProfileStatsGrid = memo(({
  stats = [],
  theme = 'light',
}) => {
  if (!stats || stats.length === 0) return null;

  return (
    <div className="grid grid-cols-2 gap-3">
      {stats.map((stat) => (
        <button
          key={stat.key}
          onClick={stat.onClick}
          className={cn(
            'p-3 rounded-xl text-left',
            'bg-white dark:bg-gray-800',
            'border border-gray-200 dark:border-gray-700',
            'hover:scale-105 active:scale-95 transition-transform'
          )}
        >
          <p className="text-2xl font-bold text-gray-900 dark:text-white">
            {stat.value}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {stat.label}
          </p>
        </button>
      ))}
    </div>
  );
});

ProfileStatsGrid.displayName = 'ProfileStatsGrid';
export default ProfileStatsGrid;
