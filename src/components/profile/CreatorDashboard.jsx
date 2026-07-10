/**
 * src/components/profile/CreatorDashboard.jsx - ARVDOUL Creator Dashboard Component
 * 
 * Analytics dashboard for creators with metrics and charts.
 * 
 * @component
 */

import React, { memo, useCallback, useMemo } from 'react';
import { cn } from '../../lib/utils';
import { 
  TrendingUp, 
  TrendingDown, 
  Eye, 
  Heart, 
  MessageCircle, 
  Share2,
  Coins,
  Users,
  BarChart2,
  Loader2,
  RefreshCw
} from 'lucide-react';
import CreatorCharts from './CreatorCharts';

/**
 * Format number with K, M suffix
 */
const formatNumber = (num) => {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num?.toString() || '0';
};

/**
 * Format percentage change
 */
const formatChange = (change) => {
  if (change === null || change === undefined) return null;
  const sign = change >= 0 ? '+' : '';
  return `${sign}${change.toFixed(1)}%`;
};

/**
 * CreatorDashboard Component
 * @param {Object} props
 */
const CreatorDashboard = ({
  analytics = null,
  ranking = null,
  theme = 'light',
  onMetricPress,
  onViewDetails,
  timeframe = '30d',
  onTimeframeChange,
  loading = false,
  onRefresh,
}) => {
  // Metrics cards
  const metrics = useMemo(() => {
    if (!analytics) return [];
    
    return [
      {
        key: 'views',
        label: 'Total Views',
        value: analytics.totalViews || 0,
        change: analytics.changes?.views,
        icon: Eye,
        gradient: 'from-blue-500/10 to-cyan-500/10',
        border: 'border-blue-500/20',
      },
      {
        key: 'engagement',
        label: 'Engagement',
        value: analytics.totalEngagement || 0,
        change: analytics.changes?.engagement,
        icon: Heart,
        gradient: 'from-pink-500/10 to-rose-500/10',
        border: 'border-pink-500/20',
      },
      {
        key: 'reach',
        label: 'Reach',
        value: analytics.totalReach || 0,
        change: analytics.changes?.reach,
        icon: Users,
        gradient: 'from-purple-500/10 to-indigo-500/10',
        border: 'border-purple-500/20',
      },
      {
        key: 'coins',
        label: 'Coins Earned',
        value: analytics.coinsEarned || 0,
        change: analytics.changes?.coins,
        icon: Coins,
        gradient: 'from-yellow-500/10 to-amber-500/10',
        border: 'border-yellow-500/20',
      },
    ];
  }, [analytics]);

  const handleMetricPress = useCallback((metric) => {
    if (onMetricPress) {
      onMetricPress(metric);
    }
  }, [onMetricPress]);

  const handleViewDetails = useCallback(() => {
    if (onViewDetails) {
      onViewDetails();
    }
  }, [onViewDetails]);

  if (loading) {
    return (
      <div className={cn(
        'p-6 rounded-2xl',
        'bg-white dark:bg-gray-900',
        'border border-gray-200 dark:border-gray-800',
        'flex items-center justify-center',
        'min-h-[300px]'
      )}>
        <Loader2 className="w-8 h-8 text-purple-500 animate-spin" />
      </div>
    );
  }

  if (!analytics) {
    return (
      <div className={cn(
        'p-6 rounded-2xl',
        'bg-white dark:bg-gray-900',
        'border border-gray-200 dark:border-gray-800',
        'text-center'
      )}>
        <BarChart2 className="w-12 h-12 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
          No Analytics Available
        </h3>
        <p className="text-gray-500 dark:text-gray-400 text-sm">
          Start creating content to see your analytics!
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <BarChart2 className="w-6 h-6 text-purple-500" />
            Creator Dashboard
          </h2>
          {ranking?.label && (
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {ranking.label} • #{ranking.position} in rankings
            </p>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          {/* Timeframe Selector */}
          <select
            value={timeframe}
            onChange={(e) => onTimeframeChange?.(e.target.value)}
            className={cn(
              'px-3 py-1.5 rounded-lg text-sm',
              'bg-gray-100 dark:bg-gray-800',
              'border border-gray-200 dark:border-gray-700',
              'text-gray-700 dark:text-gray-300',
              'focus:outline-none focus:ring-2 focus:ring-purple-500'
            )}
          >
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
            <option value="365d">Last year</option>
          </select>
          
          {/* Refresh Button */}
          <button
            onClick={onRefresh}
            className={cn(
              'p-2 rounded-lg',
              'bg-gray-100 dark:bg-gray-800',
              'hover:bg-gray-200 dark:hover:bg-gray-700',
              'transition-colors'
            )}
            aria-label="Refresh analytics"
          >
            <RefreshCw className="w-4 h-4 text-gray-600 dark:text-gray-400" />
          </button>
        </div>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-2 gap-3">
        {metrics.map((metric) => {
          const Icon = metric.icon;
          const changeValue = formatChange(metric.change);
          const isPositive = (metric.change || 0) >= 0;
          
          return (
            <button
              key={metric.key}
              onClick={() => handleMetricPress(metric)}
              className={cn(
                'p-4 rounded-xl',
                'bg-gradient-to-br border',
                metric.gradient,
                metric.border,
                'hover:scale-[1.02] transition-transform',
                'text-left'
              )}
            >
              <div className="flex items-center justify-between mb-2">
                <Icon className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                {changeValue && (
                  <span className={cn(
                    'flex items-center gap-0.5 text-xs font-medium',
                    isPositive ? 'text-green-600' : 'text-red-600'
                  )}>
                    {isPositive ? (
                      <TrendingUp className="w-3 h-3" />
                    ) : (
                      <TrendingDown className="w-3 h-3" />
                    )}
                    {changeValue}
                  </span>
                )}
              </div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {formatNumber(metric.value)}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {metric.label}
              </p>
            </button>
          );
        })}
      </div>

      {/* Charts */}
      <CreatorCharts
        dailyStats={analytics.dailyStats || []}
        theme={theme}
      />

      {/* View Full Dashboard */}
      <button
        onClick={handleViewDetails}
        className={cn(
          'w-full py-3 rounded-xl font-semibold text-sm',
          'bg-gradient-to-r from-purple-500 to-blue-500',
          'text-white hover:opacity-90 transition-opacity',
          'flex items-center justify-center gap-2'
        )}
      >
        View Full Analytics
        <BarChart2 className="w-4 h-4" />
      </button>
    </div>
  );
};

export default memo(CreatorDashboard);
