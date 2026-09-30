/**
 * src/components/profile/CreatorDashboard.jsx - ARVDOUL Creator Dashboard Component
 * 
 * Mini analytics dashboard for profile view.
 * 
 * @component
 */

/**
 * @typedef {Object} CreatorDashboardProps
 * @property {Object} [analytics] - Analytics data
 * @property {Object} [ranking] - Ranking data
 * @property {string} [theme='light'] - Current theme
 * @property {string} [timeframe='30d'] - Timeframe
 * @property {Function} [onTimeframeChange] - Timeframe change handler
 * @property {boolean} [loading=false] - Loading state
 * @property {Function} [onRefresh] - Refresh handler
 * @property {Function} [onViewDetails] - View details handler
 */

import React, { memo, useCallback } from 'react';
import { cn } from '../../lib/utils';
import { 
  Eye, 
  Users, 
  Heart, 
  Coins, 
  TrendingUp, 
  TrendingDown,
  Crown,
  RefreshCw,
  BarChart2
} from 'lucide-react';

/**
 * Format number with K, M suffix
 * @param {number} num - Number to format
 * @returns {string} Formatted number
 */
const formatNumber = (num) => {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num?.toString() || '0';
};

/**
 * CreatorDashboard Component
 * @type {React.FC<CreatorDashboardProps>}
 */
const CreatorDashboard = memo(({
  analytics,
  ranking,
  theme = 'light',
  timeframe = '30d',
  onTimeframeChange,
  loading = false,
  onRefresh,
  onViewDetails,
}) => {
  // Metrics
  const metrics = [
    { key: 'views', label: 'Views', value: analytics?.totalViews || 0, icon: Eye, color: 'text-blue-500' },
    { key: 'reach', label: 'Reach', value: analytics?.totalReach || 0, icon: Users, color: 'text-purple-500' },
    { key: 'engagement', label: 'Engagement', value: analytics?.totalEngagement || 0, icon: Heart, color: 'text-pink-500' },
    { key: 'coins', label: 'Coins', value: analytics?.coinsEarned || 0, icon: Coins, color: 'text-yellow-500' },
  ];
  
  // Handle refresh
  const handleRefresh = useCallback(() => {
    if (onRefresh) {
      onRefresh();
    }
  }, [onRefresh]);
  
  // Handle view details
  const handleViewDetails = useCallback(() => {
    if (onViewDetails) {
      onViewDetails();
    }
  }, [onViewDetails]);
  
  return (
    <div 
      className={cn(
        'p-4 rounded-2xl',
        theme === 'dark' 
          ? 'bg-gray-800/50 backdrop-blur-xl border border-gray-700/50' 
          : 'bg-white/80 backdrop-blur-xl border border-gray-200/50',
        'shadow-[0_4px_16px_rgba(0,0,0,0.08)]'
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Crown className="w-5 h-5 text-yellow-500" />
          <h3 className="font-semibold text-gray-900 dark:text-white">
            Creator Dashboard
          </h3>
        </div>
        <div className="flex items-center gap-2">
          {ranking && (
            <span className="text-sm font-medium text-purple-600 dark:text-purple-400">
              #{ranking.position || '-'}
            </span>
          )}
          {onRefresh && (
            <button
              onClick={handleRefresh}
              disabled={loading}
              className={cn(
                'p-1.5 rounded-lg',
                'hover:bg-gray-100 dark:hover:bg-gray-700',
                'transition-colors'
              )}
              aria-label="Refresh"
            >
              <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
            </button>
          )}
        </div>
      </div>
      
      {/* Metrics Grid */}
      <div className="grid grid-cols-2 gap-3">
        {metrics.map((metric) => {
          const Icon = metric.icon;
          const change = analytics?.changes?.[metric.key];
          
          return (
            <div 
              key={metric.key}
              className={cn(
                'p-3 rounded-xl',
                theme === 'dark' ? 'bg-gray-700/50' : 'bg-gray-50/80'
              )}
            >
              <div className="flex items-center justify-between mb-1">
                <Icon className={cn('w-4 h-4', metric.color)} />
                {change !== undefined && change !== null && (
                  <span className={cn(
                    'flex items-center gap-0.5 text-xs font-medium',
                    change >= 0 ? 'text-green-600' : 'text-red-600'
                  )}>
                    {change >= 0 ? (
                      <TrendingUp className="w-3 h-3" />
                    ) : (
                      <TrendingDown className="w-3 h-3" />
                    )}
                    {Math.abs(change).toFixed(1)}%
                  </span>
                )}
              </div>
              <p className="text-xl font-bold text-gray-900 dark:text-white">
                {formatNumber(metric.value)}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {metric.label}
              </p>
            </div>
          );
        })}
      </div>
      
      {/* View Details Button */}
      {onViewDetails && (
        <button
          onClick={handleViewDetails}
          className={cn(
            'w-full mt-4 px-4 py-2.5 rounded-xl font-medium text-sm',
            'bg-gradient-to-r from-purple-500 to-blue-500',
            'text-white hover:opacity-90 transition-opacity',
            'flex items-center justify-center gap-2'
          )}
        >
          <BarChart2 className="w-4 h-4" />
          View Full Analytics
        </button>
      )}
    </div>
  );
});

CreatorDashboard.displayName = 'CreatorDashboard';

export default CreatorDashboard;
