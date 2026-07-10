/**
 * src/screens/Profile/CreatorDashboardScreen.jsx - ARVDOUL Creator Dashboard Screen
 * 
 * Full analytics dashboard for creators.
 * 
 * @component
 */

import React, { useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../../context/ThemeContext';
import { useAnalyticsStore } from '../../store/analyticsStore';
import { useAppStore } from '../../store/appStore';
import { cn } from '../../lib/utils';
import { 
  ArrowLeft, 
  Download, 
  TrendingUp, 
  TrendingDown,
  Eye,
  Heart,
  MessageCircle,
  Share2,
  Coins,
  Users,
  BarChart2,
  Calendar,
  RefreshCw,
  Loader2
} from 'lucide-react';

/**
 * Format number with K, M suffix
 */
const formatNumber = (num) => {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num?.toString() || '0';
};

/**
 * CreatorDashboardScreen Component
 */
export default function CreatorDashboardScreen() {
  const navigate = useNavigate();
  const { theme } = useTheme();
  const currentUser = useAppStore(state => state.currentUser);
  
  const {
    analytics,
    loading,
    error,
    timeframe,
    dailyStats,
    ranking,
    demographics,
    loadAnalytics,
    setTimeframe,
    refresh,
  } = useAnalyticsStore();
  
  // Load analytics
  useEffect(() => {
    if (currentUser?.uid) {
      loadAnalytics(currentUser.uid, timeframe);
    }
  }, [currentUser?.uid, timeframe]);
  
  const handleRefresh = useCallback(() => {
    refresh(currentUser?.uid);
  }, [currentUser?.uid, refresh]);
  
  const handleTimeframeChange = useCallback((tf) => {
    setTimeframe(tf);
  }, [setTimeframe]);
  
  const handleExport = useCallback(() => {
    // Export analytics data
    const dataStr = JSON.stringify(analytics, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    const exportName = `arvdoul_analytics_${timeframe}.json`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportName);
    linkElement.click();
  }, [analytics, timeframe]);
  
  // Metrics cards
  const metrics = [
    { key: 'views', label: 'Total Views', value: analytics?.totalViews || 0, icon: Eye, color: 'text-blue-500' },
    { key: 'reach', label: 'Total Reach', value: analytics?.totalReach || 0, icon: Users, color: 'text-purple-500' },
    { key: 'engagement', label: 'Engagement', value: analytics?.totalEngagement || 0, icon: Heart, color: 'text-pink-500' },
    { key: 'coins', label: 'Coins Earned', value: analytics?.coinsEarned || 0, icon: Coins, color: 'text-yellow-500' },
  ];
  
  // Changes
  const changes = analytics?.changes || {};
  
  return (
    <div className={cn(
      'min-h-screen pb-20',
      theme === 'dark' ? 'bg-gray-900' : 'bg-gray-50'
    )}>
      {/* Header */}
      <div className={cn(
        'sticky top-0 z-20',
        'bg-white dark:bg-gray-900',
        'border-b border-gray-200 dark:border-gray-800'
      )}>
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate(-1)}
              className={cn(
                'p-2 rounded-xl',
                'hover:bg-gray-100 dark:hover:bg-gray-800',
                'transition-colors'
              )}
            >
              <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            </button>
            <h1 className="text-lg font-semibold text-gray-900 dark:text-white">
              Creator Dashboard
            </h1>
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={handleRefresh}
              disabled={loading}
              className={cn(
                'p-2 rounded-xl',
                'bg-gray-100 dark:bg-gray-800',
                'hover:bg-gray-200 dark:hover:bg-gray-700',
                'transition-colors',
                loading && 'opacity-50'
              )}
            >
              <RefreshCw className={cn('w-5 h-5 text-gray-600 dark:text-gray-400', loading && 'animate-spin')} />
            </button>
            <button
              onClick={handleExport}
              className={cn(
                'p-2 rounded-xl',
                'bg-gray-100 dark:bg-gray-800',
                'hover:bg-gray-200 dark:hover:bg-gray-700',
                'transition-colors'
              )}
            >
              <Download className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            </button>
          </div>
        </div>
        
        {/* Timeframe Selector */}
        <div className="px-4 pb-3">
          <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide">
            {['7d', '30d', '90d', '365d'].map((tf) => (
              <button
                key={tf}
                onClick={() => handleTimeframeChange(tf)}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap',
                  timeframe === tf
                    ? 'bg-purple-500 text-white'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
                )}
              >
                {tf === '7d' ? '7 Days' : tf === '30d' ? '30 Days' : tf === '90d' ? '90 Days' : '1 Year'}
              </button>
            ))}
          </div>
        </div>
      </div>
      
      {/* Content */}
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {loading && !analytics ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 text-purple-500 animate-spin" />
          </div>
        ) : error ? (
          <div className="text-center py-20">
            <p className="text-red-500 mb-4">{error}</p>
            <button
              onClick={handleRefresh}
              className={cn(
                'px-4 py-2 rounded-xl font-medium',
                'bg-purple-500 text-white',
                'hover:bg-purple-600'
              )}
            >
              Try Again
            </button>
          </div>
        ) : (
          <>
            {/* Ranking */}
            {ranking && (
              <div className={cn(
                'p-4 rounded-2xl',
                'bg-gradient-to-r from-purple-500/10 to-blue-500/10',
                'border border-purple-500/20'
              )}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Your Ranking</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">
                      {ranking.label || 'New Creator'}
                    </p>
                  </div>
                  {ranking.position && (
                    <div className="text-right">
                      <p className="text-sm text-gray-500 dark:text-gray-400">Position</p>
                      <p className="text-2xl font-bold bg-gradient-to-r from-purple-500 to-blue-500 bg-clip-text text-transparent">
                        #{ranking.position}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}
            
            {/* Metrics Grid */}
            <div className="grid grid-cols-2 gap-4">
              {metrics.map((metric) => {
                const Icon = metric.icon;
                const change = changes[metric.key];
                const isPositive = (change || 0) >= 0;
                
                return (
                  <div
                    key={metric.key}
                    className={cn(
                      'p-4 rounded-xl',
                      'bg-white dark:bg-gray-900',
                      'border border-gray-200 dark:border-gray-800'
                    )}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <Icon className={cn('w-5 h-5', metric.color)} />
                      {change !== undefined && (
                        <span className={cn(
                          'flex items-center gap-0.5 text-xs font-medium',
                          isPositive ? 'text-green-600' : 'text-red-600'
                        )}>
                          {isPositive ? (
                            <TrendingUp className="w-3 h-3" />
                          ) : (
                            <TrendingDown className="w-3 h-3" />
                          )}
                          {Math.abs(change).toFixed(1)}%
                        </span>
                      )}
                    </div>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">
                      {formatNumber(metric.value)}
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {metric.label}
                    </p>
                  </div>
                );
              })}
            </div>
            
            {/* Daily Stats Chart */}
            <div className={cn(
              'p-4 rounded-2xl',
              'bg-white dark:bg-gray-900',
              'border border-gray-200 dark:border-gray-800'
            )}>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Daily Performance
              </h3>
              {dailyStats.length > 0 ? (
                <div className="space-y-3">
                  {dailyStats.slice(-7).reverse().map((stat, index) => (
                    <div key={stat.date || index} className="flex items-center gap-3">
                      <div className="w-16 text-xs text-gray-500 dark:text-gray-400">
                        {new Date(stat.date).toLocaleDateString('en-US', { weekday: 'short' })}
                      </div>
                      <div className="flex-1 h-6 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-purple-500 to-blue-500 rounded-full"
                          style={{ width: `${Math.min((stat.views / Math.max(...dailyStats.map(s => s.views || 1))) * 100, 100)}%` }}
                        />
                      </div>
                      <div className="w-16 text-xs text-right text-gray-500 dark:text-gray-400">
                        {formatNumber(stat.views || 0)}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 dark:text-gray-400 text-center py-8">
                  No data available for this period
                </p>
              )}
            </div>
            
            {/* Growth Rate */}
            {analytics?.growthRate !== undefined && (
              <div className={cn(
                'p-4 rounded-2xl',
                'bg-white dark:bg-gray-900',
                'border border-gray-200 dark:border-gray-800'
              )}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Growth Rate</p>
                    <p className={cn(
                      'text-2xl font-bold',
                      analytics.growthRate >= 0 ? 'text-green-600' : 'text-red-600'
                    )}>
                      {analytics.growthRate >= 0 ? '+' : ''}{analytics.growthRate.toFixed(1)}%
                    </p>
                  </div>
                  <div className={cn(
                    'w-12 h-12 rounded-full flex items-center justify-center',
                    analytics.growthRate >= 0
                      ? 'bg-green-100 dark:bg-green-900/30'
                      : 'bg-red-100 dark:bg-red-900/30'
                  )}>
                    {analytics.growthRate >= 0 ? (
                      <TrendingUp className="w-6 h-6 text-green-600" />
                    ) : (
                      <TrendingDown className="w-6 h-6 text-red-600" />
                    )}
                  </div>
                </div>
              </div>
            )}
            
            {/* Active Days */}
            {analytics?.activeDays !== undefined && (
              <div className={cn(
                'p-4 rounded-2xl',
                'bg-white dark:bg-gray-900',
                'border border-gray-200 dark:border-gray-800'
              )}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Active Days</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">
                      {analytics.activeDays} days
                    </p>
                  </div>
                  <Calendar className="w-6 h-6 text-purple-500" />
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
