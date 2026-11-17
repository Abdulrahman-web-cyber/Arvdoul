/**
 * Full analytics dashboard for creators.
 * 
 * @component
 */

import { useCallback, useEffect } from "react";
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { useAnalyticsStore } from '../../store/analyticsStore';
import { useAppStore } from '../../store/appStore';
import { getStoredUid } from '../../utils/security';
import { cn } from '../../lib/utils';
import { Download, TrendingUp, TrendingDown, Eye, Heart, Coins, Users, Calendar, RefreshCw, Loader2, Wallet, ArrowUpRight, ArrowLeft } from "lucide-react";
import { formatCoinsAsUsd, MIN_WITHDRAWAL_COINS } from '../../shared/levelConfig.cjs';

/**
 * Format number with K, M suffix
 */
const formatNumber = (num) => {
  // An unmeasured metric is unknown ('—'), never a measured 0.
  if (typeof num !== 'number' || Number.isNaN(num)) return '—';
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toString();
};

/**
 * CreatorDashboardScreen Component
 */
export default function CreatorDashboardScreen() {
  const navigate = useNavigate();
  const { theme } = useTheme();
  const { user: authUser, userProfile } = useAuth();
  const storeUser = useAppStore(state => state.currentUser);
  const currentUser = authUser || storeUser;
  const currentUserId = currentUser?.uid || authUser?.uid || getStoredUid();
  // The canonical active-day count lives on the user profile
  // (`users/{uid}.activeDaysCount`); an unmeasured value stays null → '—'.
  const activeDaysCount = userProfile?.activeDaysCount ?? storeUser?.activeDaysCount ?? null;
  
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
    if (currentUserId) {
      loadAnalytics(currentUserId, timeframe);
    }
  }, [currentUserId, timeframe]);
  
  const handleRefresh = useCallback(() => {
    if (currentUserId) refresh(currentUserId);
  }, [currentUserId, refresh]);
  
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
  const num = (v) => (typeof v === 'number' && !Number.isNaN(v) ? v : null);
  const metrics = [
    { key: 'views', label: 'Total Views', value: num(analytics?.totalViews), icon: Eye, color: 'text-blue-500' },
    { key: 'reach', label: 'Total Reach', value: num(analytics?.totalReach), icon: Users, color: 'text-purple-500' },
    { key: 'engagement', label: 'Engagement', value: num(analytics?.totalEngagement), icon: Heart, color: 'text-pink-500' },
    { key: 'coins', label: 'Coins Earned', value: num(analytics?.coinsEarned), icon: Coins, color: 'text-yellow-500' },
  ];
  
  // Changes
  const changes = analytics?.changes || {};
  
  return (
    <div className={cn(
      'min-h-screen pb-20',
      theme === 'dark' ? 'bg-[#03071B] text-white' : 'bg-[#F6F8FC] text-slate-900'
    )}>
      {/* Top Sub-Toolbar: Back, Timeframe & Actions */}
      <div className={cn(
        'sticky top-0 z-20 backdrop-blur-xl border-b transition-colors',
        theme === 'dark' ? 'bg-[#03071B]/90 border-white/[0.08]' : 'bg-white/90 border-slate-200 shadow-sm'
      )}>
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <button
              type="button"
              onClick={() => navigate(-1)}
              aria-label="Go back"
              className={cn(
                'w-9 h-9 rounded-xl border flex items-center justify-center transition-colors cursor-pointer shrink-0',
                theme === 'dark'
                  ? 'border-white/10 bg-white/[0.05] text-slate-300 hover:text-white'
                  : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
              )}
            >
              <ArrowLeft className="w-4 h-4" />
            </button>

            {/* Timeframe Selector */}
            <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide">
              {['7d', '30d', '90d', '365d'].map((tf) => (
                <button
                  key={tf}
                  type="button"
                  onClick={() => handleTimeframeChange(tf)}
                  className={cn(
                    'px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer tabular-nums',
                    timeframe === tf
                      ? 'bg-purple-600 text-white shadow-sm'
                      : 'bg-slate-100 dark:bg-white/[0.06] text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-white/10'
                  )}
                >
                  {tf}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleRefresh}
              disabled={loading}
              aria-label="Refresh Analytics"
              title="Refresh Analytics"
              className={cn(
                'p-2 rounded-xl transition-colors cursor-pointer',
                'bg-slate-100 dark:bg-white/[0.06] hover:bg-slate-200 dark:hover:bg-white/10',
                loading && 'opacity-50'
              )}
            >
              <RefreshCw className={cn('w-4 h-4 text-slate-600 dark:text-slate-300', loading && 'animate-spin')} />
            </button>
            <button
              type="button"
              onClick={handleExport}
              aria-label="Export Analytics JSON"
              title="Export Analytics JSON"
              className={cn(
                'p-2 rounded-xl transition-colors cursor-pointer',
                'bg-slate-100 dark:bg-white/[0.06] hover:bg-slate-200 dark:hover:bg-white/10'
              )}
            >
              <Download className="w-4 h-4 text-slate-600 dark:text-slate-300" />
            </button>
          </div>
        </div>
      </div>
      
      {/* Content */}
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {loading && !analytics ? (
          <div className="flex items-center justify-center py-20" role="status" aria-label="Loading creator analytics">
            <Loader2 className="w-8 h-8 text-purple-500 animate-spin" />
          </div>
        ) : error ? (
          <div className="text-center py-20">
            <p className="text-red-500 mb-4">{error}</p>
            <button
              type="button"
              onClick={handleRefresh}
              className={cn(
                'px-4 py-2 rounded-xl font-medium cursor-pointer',
                'bg-purple-600 text-white',
                'hover:bg-purple-500'
              )}
            >
              Try Again
            </button>
          </div>
        ) : (
          <>
            {/* Ranking — only when a real rank exists; an unranked creator is
                not dressed up as "New Creator". */}
            {(ranking?.label || ranking?.percentile || ranking?.position) && (
              <div className={cn(
                'p-4 rounded-2xl',
                'bg-gradient-to-r from-purple-500/10 to-blue-500/10',
                'border border-purple-500/20'
              )}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Your Ranking</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">
                      {ranking.label || '—'}
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
                const hasChange = typeof change === 'number' && !Number.isNaN(change);
                const isPositive = change >= 0;
                
                return (
                  <div
                    key={metric.key}
                    className={cn(
                      'p-4 rounded-2xl',
                      'bg-white dark:bg-[#080F2E]/90 backdrop-blur-xl',
                      'border border-slate-200/80 dark:border-white/[0.08] shadow-sm'
                    )}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <Icon className={cn('w-5 h-5', metric.color)} />
                      {hasChange && (
                        <span className={cn(
                          'flex items-center gap-0.5 text-xs font-medium tabular-nums',
                          isPositive ? 'text-green-600 dark:text-emerald-400' : 'text-red-600 dark:text-rose-400'
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
                    <p className="text-2xl font-bold text-slate-900 dark:text-white tabular-nums">
                      {formatNumber(metric.value)}
                    </p>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      {metric.label}
                    </p>
                  </div>
                );
              })}
            </div>

            {/* Sovereign Creator Earnings & Payout Action Card */}
            <div className={cn(
              'p-5 rounded-2xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 transition-all shadow-sm',
              theme === 'dark'
                ? 'bg-gradient-to-r from-amber-500/10 via-purple-500/10 to-indigo-500/10 border-amber-500/20'
                : 'bg-gradient-to-r from-amber-50 via-purple-50 to-indigo-50 border-amber-200'
            )}>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-500 flex items-center justify-center font-bold">
                    <Coins className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                      Creator Sovereign Earnings &amp; Payouts
                    </h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Balance: <strong className="text-amber-500">{typeof analytics?.coinsEarned === 'number' ? analytics.coinsEarned.toLocaleString() : '—'} coins</strong> ({formatCoinsAsUsd(analytics?.coinsEarned)}) · Min withdrawal: {MIN_WITHDRAWAL_COINS.toLocaleString()} coins
                    </p>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2.5 w-full sm:w-auto shrink-0">
                <button
                  type="button"
                  onClick={() => navigate('/coins')}
                  className={cn(
                    'flex-1 sm:flex-none px-3.5 py-2 rounded-xl text-xs font-semibold transition border',
                    theme === 'dark'
                      ? 'border-white/10 hover:bg-white/10 text-white'
                      : 'border-gray-300 hover:bg-white text-gray-800'
                  )}
                >
                  Top Up Coins
                </button>
                <button
                  type="button"
                  onClick={() => navigate('/wallet')}
                  className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-amber-500 to-purple-600 hover:from-amber-600 hover:to-purple-700 text-white shadow-md transition"
                >
                  <Wallet className="w-3.5 h-3.5" />
                  <span>Withdraw in Wallet</span>
                  <ArrowUpRight className="w-3.5 h-3.5 opacity-80" />
                </button>
              </div>
            </div>
            
            {/* Daily Stats Chart */}
            <div className={cn(
              'p-4 sm:p-5 rounded-2xl',
              'bg-white dark:bg-[#080F2E]/90 backdrop-blur-xl',
              'border border-slate-200/80 dark:border-white/[0.08] shadow-sm'
            )}>
              <h3 className="text-base sm:text-lg font-semibold text-slate-900 dark:text-white mb-4">
                Daily Performance
              </h3>
              {dailyStats.length > 0 ? (
                <div className="space-y-3">
                  {dailyStats.slice(-7).reverse().map((stat, index) => (
                    <div key={stat.date || index} className="flex items-center gap-3">
                      <div className="w-16 text-xs text-slate-500 dark:text-slate-400">
                        {new Date(stat.date).toLocaleDateString('en-US', { weekday: 'short' })}
                      </div>
                      <div className="flex-1 h-6 bg-slate-100 dark:bg-white/[0.06] rounded-full overflow-hidden">
                        <div
                          className="h-full bg-arvdoul-gradient rounded-full"
                          style={{ width: `${Math.min((stat.views / Math.max(...dailyStats.map(s => s.views || 1))) * 100, 100)}%` }}
                        />
                      </div>
                      <div className="w-16 text-xs text-right text-slate-500 dark:text-slate-400 tabular-nums">
                        {formatNumber(stat.views)}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-slate-500 dark:text-slate-400 text-center py-8 text-sm">
                  No data available for this period
                </p>
              )}
            </div>
            
            {/* Growth Rate — only when a real rate was measured. Nothing
                computes one, so the card stays hidden rather than showing a
                fabricated green "+0.0%". */}
            {typeof analytics?.growthRate === 'number' && (
              <div className={cn(
                'p-4 rounded-2xl',
                'bg-white dark:bg-[#080F2E]/90 backdrop-blur-xl',
                'border border-slate-200/80 dark:border-white/[0.08] shadow-sm'
              )}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-500 dark:text-slate-400">Growth Rate</p>
                    <p className={cn(
                      'text-2xl font-bold tabular-nums',
                      analytics.growthRate >= 0 ? 'text-green-600 dark:text-emerald-400' : 'text-red-600 dark:text-rose-400'
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
            
            {/* Active Days — the canonical count lives on the user profile
                (`activeDaysCount`), never on the analytics doc; an unmeasured
                value renders unknown. */}
            <div className={cn(
              'p-4 rounded-2xl',
              'bg-white dark:bg-[#080F2E]/90 backdrop-blur-xl',
              'border border-slate-200/80 dark:border-white/[0.08] shadow-sm'
            )}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Active Days</p>
                  <p className="text-2xl font-bold text-slate-900 dark:text-white tabular-nums">
                    {typeof activeDaysCount === 'number' ? `${activeDaysCount} days` : '—'}
                  </p>
                </div>
                <Calendar className="w-6 h-6 text-purple-500" />
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
