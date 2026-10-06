// src/screens/VideoAnalyticsScreen.jsx
//
// Creator dashboard with video performance metrics

import React, { useState, useEffect, useCallback, memo, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  Video,
  Eye,
  Heart,
  MessageCircle,
  Share2,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Users,
  Clock,
  Play,
  Calendar,
  ArrowUpRight,
  ArrowDownRight,
  BarChart3,
  PieChart,
  TrendingUp as TrendingUpIcon,
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { formatViewCount, formatDuration, formatWatchTime, ARVDOUL_GRADIENT } from '../utils/videoUtils';
import { formatCoinsAsUsd } from '../shared/levelConfig.cjs';
import { toast } from 'sonner';
import LoadingSpinner from '../components/Shared/LoadingSpinner';
import GlassCard from '../components/UI/GlassCard';
import GlassButton from '../components/UI/GlassButton';
import EmptyState from '../components/UI/EmptyState';

/**
 * VideoAnalyticsScreen - Creator dashboard with analytics
 * Shows video performance, audience insights, and revenue
 * World-class UI with ARVDOUL DNA design system
 */
const VideoAnalyticsScreen = () => {
  const { theme, isDark, gradient, glass, spring, colors } = useTheme();
  const [activeTab, setActiveTab] = useState('overview');
  const [timeRange, setTimeRange] = useState('7d');
  const [loading, setLoading] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [analytics, setAnalytics] = useState(null);
  const { user } = useAuth();

  // Load analytics from analyticsService (Firestore-backed, sharded
  // counters). Zero state until real data arrives - no fabricated numbers.
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!user?.uid) return;
      try {
        setLoading(true);
        const { default: analyticsService } = await import('../services/analyticsService.js');
        const data = await analyticsService.getUserAnalytics(user.uid, timeRange === '7d' ? '7d' : timeRange === '28d' ? '30d' : '90d');
        if (cancelled) return;
        setAnalytics({
          overview: {
            totalViews: data.totalViews || 0,
            viewsChange: data.changes?.views || 0,
            totalLikes: data.totalEngagement || 0,
            likesChange: data.changes?.engagement || 0,
            // Profile analytics tracks a single engagement total; there is no
            // per-type comment/share/watch-time breakdown, so report those as
            // unavailable (null) rather than duplicating the engagement number.
            totalComments: null,
            commentsChange: null,
            totalShares: null,
            sharesChange: null,
            totalWatchTime: null,
            watchTimeChange: null,
            avgCompletionRate: null,
            completionChange: null,
            // Real per-day view series for the chart (empty when no data yet).
            series: (data.dailyStats || []).map((d) => ({ date: d.date, views: d.views || 0 })),
            hasData: Boolean(data.hasData),
          },
          revenue: {
            total: data.coinsEarned || 0,
            tips: null,
            subscriptions: null,
            payPerView: null,
            gifts: null,
            change: 0,
          },
          videos: (data.topPosts || []).map((p, i) => ({
            id: p.id || `v-${i}`,
            title: p.caption || p.content?.slice(0, 40) || `Video ${i + 1}`,
            thumbnail: (p.media && p.media[0]?.url) || p.mediaUrl || '/assets/default-profile.png',
            views: p.views || 0,
            likes: p.likeCount || 0,
            comments: p.commentCount || 0,
            shares: p.shareCount || 0,
            watchTime: null,
            completionRate: null,
            earnings: null,
          })),
          audience: {
            demographics: {
              age: Object.entries(data.demographics?.ageGroups || {}).map(([range, percentage]) => ({ range, percentage })),
              gender: Object.entries(data.demographics?.gender || {}).map(([type, percentage]) => ({ type, percentage })),
            },
            topCountries: Object.entries(data.demographics?.locations || {}).slice(0, 5).map(([country, percentage]) => ({ country, percentage })),
          },
        });
      } catch (err) {
        console.error('Failed to load analytics:', err);
        if (!cancelled) setAnalytics(null);
      } finally {
        if (!cancelled) setLoading(false);
        if (!cancelled) setIsInitialized(true);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [user?.uid, timeRange]);

  

  const tabs = [
    { id: 'overview', label: 'Overview', icon: TrendingUp },
    { id: 'videos', label: 'Videos', icon: Video },
    { id: 'audience', label: 'Audience', icon: Users },
    { id: 'revenue', label: 'Revenue', icon: DollarSign },
  ];

  return (
    <div className={`min-h-screen pb-20 ${isDark ? 'bg-gradient-to-br from-[#060816] via-[#0b1220] to-[#02040a] text-white' : 'bg-gradient-to-br from-[#f0f4fa] via-white to-[#eef2f8] text-gray-900'}`}>
      {/* Header */}
      <div className="sticky top-0 z-30 backdrop-blur-xl bg-black/80 border-b border-white/10">
        <div className="max-w-5xl mx-auto px-4 py-4">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
              <TrendingUp className="w-4 h-4 text-white" />
            </div>
            Video Analytics
          </h1>
        </div>
      </div>

      {/* Time Range Selector */}
      <div className="max-w-5xl mx-auto px-4 py-4">
        <div className="flex gap-2">
          {['24h', '7d', '30d', '90d', '1y'].map((range) => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                timeRange === range
                  ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white'
                  : 'bg-white/10 text-white/60 hover:text-white'
              }`}
            >
              {range}
            </button>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div className="max-w-5xl mx-auto px-4 flex border-b border-white/10">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? 'text-white border-b-2 border-purple-500'
                : 'text-white/50 hover:text-white'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="max-w-5xl mx-auto p-4">
        {!analytics && (
          <div className="text-center py-16 text-white/50">
            {loading ? 'Loading analytics...' : 'No analytics available yet. Publish videos to see insights.'}
          </div>
        )}
        {/* Overview Tab */}
        {analytics && activeTab === 'overview' && (
          <OverviewTab analytics={analytics} />
        )}

        {/* Videos Tab */}
        {analytics && activeTab === 'videos' && (
          <VideosTab videos={analytics.videos} />
        )}

        {/* Audience Tab */}
        {analytics && activeTab === 'audience' && (
          <AudienceTab audience={analytics.audience} />
        )}

        {/* Revenue Tab */}
        {analytics && activeTab === 'revenue' && (
          <RevenueTab revenue={analytics.revenue} />
        )}
      </div>
    </div>
  );
};

/**
 * Overview Tab - High-level metrics
 */
const OverviewTab = ({ analytics }) => {

  const { isDark } = useTheme();  const { overview } = analytics;

  // null means the metric is not tracked by the data source - render "—".
  const num = (v, fmt = formatViewCount) => (v === null || v === undefined ? '—' : fmt(v));

  const stats = [
    {
      label: 'Total Views',
      value: num(overview.totalViews),
      change: overview.viewsChange,
      icon: Eye,
      gradient: 'from-blue-500 to-cyan-500',
    },
    {
      label: 'Total Likes',
      value: num(overview.totalLikes),
      change: overview.likesChange,
      icon: Heart,
      gradient: 'from-red-500 to-pink-500',
    },
    {
      label: 'Comments',
      value: num(overview.totalComments),
      change: overview.commentsChange,
      icon: MessageCircle,
      gradient: 'from-purple-500 to-violet-500',
    },
    {
      label: 'Shares',
      value: num(overview.totalShares),
      change: overview.sharesChange,
      icon: Share2,
      gradient: 'from-green-500 to-emerald-500',
    },
    {
      label: 'Watch Time',
      value: num(overview.totalWatchTime, formatWatchTime),
      change: overview.watchTimeChange,
      icon: Clock,
      gradient: 'from-orange-500 to-amber-500',
    },
    {
      label: 'Avg. Completion',
      value: num(overview.avgCompletionRate, (v) => `${v}%`),
      change: overview.completionChange,
      icon: Play,
      gradient: 'from-fuchsia-500 to-purple-500',
    },
  ];

  // Real per-day view series; scale bar heights against the series max.
  const series = overview.series || [];
  const seriesMax = series.reduce((m, d) => Math.max(m, d.views || 0), 0);

  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {stats.map((stat, index) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            className={`p-4 rounded-2xl border backdrop-blur-xl ${isDark ? 'bg-white/5 border-white/10' : 'bg-white/90 border-gray-200'}`}
          >
            <div className="flex items-center justify-between mb-3">
              <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${stat.gradient} flex items-center justify-center`}>
                <stat.icon className="w-5 h-5 text-white" />
              </div>
              {typeof stat.change === 'number' && (
                <div className={`flex items-center gap-1 text-sm ${
                  stat.change >= 0 ? 'text-green-400' : 'text-red-400'
                }`}>
                  {stat.change >= 0 ? (
                    <ArrowUpRight className="w-4 h-4" />
                  ) : (
                    <ArrowDownRight className="w-4 h-4" />
                  )}
                  {Math.abs(stat.change)}%
                </div>
              )}
            </div>
            <p className="text-white/50 text-sm">{stat.label}</p>
            <p className="text-white text-2xl font-bold mt-1">{stat.value}</p>
          </motion.div>
        ))}
      </div>

      {/* Views Over Time — real daily series only, never a fabricated curve */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="p-6 rounded-3xl bg-white/5 border border-white/10 backdrop-blur-xl"
      >
        <h3 className="text-lg font-bold text-white mb-4">Views Over Time</h3>
        <div className="h-48 flex items-end justify-between gap-2">
          {series.length === 0 ? (
            <div className="w-full h-full flex items-center justify-center text-white/40 text-sm">
              No daily view data yet
            </div>
          ) : (
            series.map((d, i) => (
              <motion.div
                key={d.date}
                initial={{ height: 0 }}
                animate={{ height: seriesMax > 0 ? `${Math.round(((d.views || 0) / seriesMax) * 100)}%` : '2%' }}
                transition={{ delay: 0.3 + i * 0.02 }}
                className="flex-1 rounded-t-lg"
                title={`${d.date}: ${d.views}`}
                style={{
                  background: ARVDOUL_GRADIENT,
                  opacity: 0.6 + (i / Math.max(series.length, 1)) * 0.4,
                }}
              />
            ))
          )}
        </div>
        <div className="flex justify-between mt-2 text-white/40 text-xs">
          <span>{series[0]?.date || ''}</span>
          <span>{series[series.length - 1]?.date || ''}</span>
        </div>
      </motion.div>
    </div>
  );
};

/**
 * Videos Tab - Individual video performance
 */
const VideosTab = ({ videos }) => {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-bold text-white">Your Videos</h3>
      
      {videos.map((video, index) => (
        <motion.div
          key={video.id}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.05 }}
          className="p-4 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-xl flex gap-4"
        >
          {/* Thumbnail */}
          <div className="w-24 h-36 rounded-xl overflow-hidden flex-shrink-0 bg-gray-800">
            <img
              src={video.thumbnail}
              alt={video.title}
              className="w-full h-full object-cover"
            />
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <h4 className="text-white font-semibold truncate">{video.title}</h4>
            
            <div className="grid grid-cols-2 gap-3 mt-3">
              <div className="flex items-center gap-2">
                <Eye className="w-4 h-4 text-white/50" />
                <span className="text-white/80 text-sm">{formatViewCount(video.views)}</span>
              </div>
              <div className="flex items-center gap-2">
                <Heart className="w-4 h-4 text-white/50" />
                <span className="text-white/80 text-sm">{formatViewCount(video.likes)}</span>
              </div>
              <div className="flex items-center gap-2">
                <MessageCircle className="w-4 h-4 text-white/50" />
                <span className="text-white/80 text-sm">{formatViewCount(video.comments)}</span>
              </div>
              <div className="flex items-center gap-2">
                <Share2 className="w-4 h-4 text-white/50" />
                <span className="text-white/80 text-sm">{formatViewCount(video.shares)}</span>
              </div>
            </div>

            <div className="mt-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-white/50" />
                <span className="text-white/50 text-xs">
                  {video.watchTime == null ? 'Watch time not tracked' : `${formatWatchTime(video.watchTime)} watch time`}
                </span>
              </div>
              <div className="text-green-400 text-sm font-medium">
                {video.earnings == null ? '—' : `$${video.earnings.toFixed(2)}`}
              </div>
            </div>

            {/* Completion Bar */}
            <div className="mt-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-white/50 text-xs">Completion</span>
                <span className="text-white/80 text-xs">
                  {video.completionRate == null ? '—' : `${video.completionRate}%`}
                </span>
              </div>
              <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${video.completionRate || 0}%`,
                    background: ARVDOUL_GRADIENT,
                  }}
                />
              </div>
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  );
};

/**
 * Audience Tab - Demographics and locations
 */
const AudienceTab = ({ audience }) => {
  return (
    <div className="space-y-6">
      {/* Age Distribution */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="p-6 rounded-3xl bg-white/5 border border-white/10 backdrop-blur-xl"
      >
        <h3 className="text-lg font-bold text-white mb-4">Age Distribution</h3>
        <div className="space-y-3">
          {audience.demographics.age.map((item) => (
            <div key={item.range} className="flex items-center gap-4">
              <span className="w-16 text-white/60 text-sm">{item.range}</span>
              <div className="flex-1 h-3 bg-white/10 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${item.percentage}%` }}
                  transition={{ duration: 0.5 }}
                  className="h-full rounded-full"
                  style={{ background: ARVDOUL_GRADIENT }}
                />
              </div>
              <span className="w-12 text-right text-white/80 text-sm">{item.percentage}%</span>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Gender Distribution */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="p-6 rounded-3xl bg-white/5 border border-white/10 backdrop-blur-xl"
      >
        <h3 className="text-lg font-bold text-white mb-4">Gender Distribution</h3>
        <div className="flex justify-around">
          {audience.demographics.gender.map((item) => (
            <div key={item.type} className="text-center">
              <div
                className="w-20 h-20 rounded-full mx-auto mb-2 flex items-center justify-center"
                style={{ background: ARVDOUL_GRADIENT }}
              >
                <span className="text-white font-bold">{item.percentage}%</span>
              </div>
              <p className="text-white/60 text-sm">{item.type}</p>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Top Countries */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="p-6 rounded-3xl bg-white/5 border border-white/10 backdrop-blur-xl"
      >
        <h3 className="text-lg font-bold text-white mb-4">Top Countries</h3>
        <div className="space-y-3">
          {audience.topCountries.map((item, index) => (
            <div key={item.country} className="flex items-center gap-4">
              <span className="w-6 text-white/40 text-sm">{index + 1}</span>
              <span className="flex-1 text-white/80">{item.country}</span>
              <span className="text-white/60 text-sm">{item.percentage}%</span>
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  );
};

/**
 * Revenue Tab - Earnings breakdown.
 *
 * Revenue figures come from the creator's real coin ledger (analytics
 * coinsEarned) and their real payout account/withdrawal history from the
 * monetization service. There is no fabricated breakdown: per-source splits
 * (subscriptions/tips/PPV/gifts) are not tracked by the analytics document, so
 * they are reported unavailable rather than invented.
 */
const RevenueTab = ({ revenue }) => {
  const { isDark } = useTheme();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [payout, setPayout] = useState({ loading: true, settings: null, pendingCoins: 0, lastPayoutCoins: null });

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!user?.uid) {
        if (!cancelled) setPayout({ loading: false, settings: null, pendingCoins: 0, lastPayoutCoins: null });
        return;
      }
      try {
        const [{ default: walletService }, { default: monetizationService }] = await Promise.all([
          import('../services/walletService.js'),
          import('../services/monetizationService.js'),
        ]);
        const [settingsRes, walletRes, historyRes] = await Promise.allSettled([
          monetizationService.getPayoutSettings(),
          walletService.getWalletOverview(user.uid),
          monetizationService.getTransactionHistory(user.uid, 100),
        ]);
        if (cancelled) return;

        const settings = settingsRes.status === 'fulfilled' ? settingsRes.value : null;
        const pendingCoins = walletRes.status === 'fulfilled' ? (walletRes.value?.pendingCoins || 0) : 0;

        let lastPayoutCoins = null;
        const historyItems = historyRes.status === 'fulfilled' ? historyRes.value?.items : null;
        if (Array.isArray(historyItems)) {
          const withdrawals = historyItems.filter(
            (tx) => tx.type === 'debit' || tx.type === 'withdrawal' || tx.reason?.includes('withdraw')
          );
          if (withdrawals.length > 0) lastPayoutCoins = Number(withdrawals[0].amount) || 0;
        }

        setPayout({ loading: false, settings, pendingCoins, lastPayoutCoins });
      } catch (err) {
        if (!cancelled) setPayout({ loading: false, settings: null, pendingCoins: 0, lastPayoutCoins: null });
      }
    };
    load();
    return () => { cancelled = true; };
  }, [user?.uid]);

  const formatUsd = formatCoinsAsUsd;

  const accountStatus = payout.settings?.accountStatus || 'unconfigured';
  const accountConnected = ['verified', 'active', 'enabled'].includes(accountStatus);

  const revenueItems = [
    { label: 'Subscriptions', value: revenue.subscriptions, icon: Users },
    { label: 'Tips', value: revenue.tips, icon: Heart },
    { label: 'Pay Per View', value: revenue.payPerView, icon: Video },
    { label: 'Gifts', value: revenue.gifts, icon: DollarSign },
  ];

  return (
    <div className="space-y-6">
      {/* Total Revenue */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="p-8 rounded-3xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 border border-purple-500/30 backdrop-blur-xl text-center"
      >
        <p className="text-white/60 mb-2">Total Coins Earned</p>
        <p className="text-5xl font-bold text-white mb-2">
          {formatUsd(revenue.total)}
        </p>
        {typeof revenue.change === 'number' && (
          <div className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm ${
            revenue.change >= 0 ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
          }`}>
            {revenue.change >= 0 ? (
              <ArrowUpRight className="w-4 h-4" />
            ) : (
              <ArrowDownRight className="w-4 h-4" />
            )}
            {Math.abs(revenue.change)}% vs last period
          </div>
        )}
      </motion.div>

      {/* Revenue Breakdown - per-source splits are not tracked; show honest unavailable */}
      <div className="grid grid-cols-2 gap-4">
        {revenueItems.map((item, index) => (
          <motion.div
            key={item.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            className={`p-4 rounded-2xl border backdrop-blur-xl ${isDark ? 'bg-white/5 border-white/10' : 'bg-white/90 border-gray-200'}`}
          >
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center">
                <item.icon className="w-5 h-5 text-purple-400" />
              </div>
            </div>
            <p className="text-white/50 text-sm">{item.label}</p>
            <p className="text-white text-xl font-bold">
              {item.value == null ? 'Not tracked' : formatUsd(item.value)}
            </p>
          </motion.div>
        ))}
      </div>

      {/* Payout Info - real account status and withdrawal history */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="p-6 rounded-3xl bg-white/5 border border-white/10 backdrop-blur-xl"
      >
        <h3 className="text-lg font-bold text-white mb-4">Payout Info</h3>
        {payout.loading ? (
          <p className="text-white/50 text-sm">Loading payout status…</p>
        ) : (
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-white/60">Payout Account</span>
              <span className={`font-semibold ${accountConnected ? 'text-green-400' : 'text-amber-400'}`}>
                {accountConnected ? 'Connected' : 'Not connected'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-white/60">Pending Payout</span>
              <span className="text-white font-semibold">{formatUsd(payout.pendingCoins)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-white/60">Last Payout</span>
              <span className="text-white font-semibold">{formatUsd(payout.lastPayoutCoins)}</span>
            </div>
          </div>
        )}
        <motion.button
          whileTap={{ scale: 0.98 }}
          onClick={() => navigate('/creator-payout')}
          className="w-full mt-4 py-3 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 text-white font-semibold"
        >
          Manage Payouts
        </motion.button>
      </motion.div>
    </div>
  );
};

export default React.memo(VideoAnalyticsScreen);
