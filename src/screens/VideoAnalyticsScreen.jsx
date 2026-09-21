// src/screens/VideoAnalyticsScreen.jsx

import React, { useState, useEffect, useCallback, memo, useMemo } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
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
import { formatViewCount, formatDuration, formatWatchTime, ARVDOUL_GRADIENT } from '../utils/videoUtils';
import { toast } from 'sonner';
import LoadingSpinner from '../components/Shared/LoadingSpinner';
import GlassCard from '../components/UI/GlassCard';
import GlassButton from '../components/UI/GlassButton';
import EmptyState from '../components/UI/EmptyState';

/**
 * VideoAnalyticsScreen - Creator dashboard with analytics
 * Shows video performance, audience insights, and revenue
 * Uses the ARVDOUL design system.
 */
const VideoAnalyticsScreen = () => {
  const { theme, isDark, gradient, glass, spring, colors } = useTheme();
  const [activeTab, setActiveTab] = useState('overview');
  const [timeRange, setTimeRange] = useState('7d');
  const [loading, setLoading] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [analytics, setAnalytics] = useState(null);
  const { user } = useAuth();

  // Load REAL analytics from analyticsService (Firestore-backed, sharded
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
        const topPosts = data.topPosts || [];
        // Likes/comments/shares are summed from the creator's own recent
        // posts; they are never derived from a different metric.
        const sumOf = (field) => topPosts.reduce((sum, p) => sum + (p[field] || 0), 0);
        setAnalytics({
          overview: {
            totalViews: data.totalViews || 0,
            viewsChange: data.changes?.views || 0,
            totalReach: data.totalReach || 0,
            reachChange: data.changes?.reach || 0,
            totalEngagement: data.totalEngagement || 0,
            engagementChange: data.changes?.engagement || 0,
            totalLikes: sumOf('likeCount'),
            totalComments: sumOf('commentCount'),
            totalShares: sumOf('shareCount'),
          },
          revenue: {
            totalCoins: data.coinsEarned || 0,
            change: data.changes?.coins || 0,
          },
          dailyStats: (data.dailyStats || []).map((d) => ({
            date: d.date,
            views: d.views || 0,
            likes: d.likes || 0,
            comments: d.comments || 0,
            shares: d.shares || 0,
          })),
          videos: (data.topPosts || []).map((p, i) => ({
            id: p.id || `post-${i}`,
            title: p.caption || p.content?.slice(0, 60) || 'Untitled post',
            thumbnail: (p.media && p.media[0]?.url) || p.mediaUrl || null,
            views: p.views || p.viewCount || 0,
            likes: p.likeCount || 0,
            comments: p.commentCount || 0,
            shares: p.shareCount || 0,
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

  const { isDark } = useTheme();
  const { overview } = analytics;
  const dailyStats = analytics.dailyStats || [];
  const maxDailyViews = useMemo(
    () => Math.max(1, ...dailyStats.map((d) => d.views || 0)),
    [dailyStats]
  );

  // Only metrics the backend actually records are shown.
  const stats = [
    {
      label: 'Total Views',
      value: formatViewCount(overview.totalViews),
      change: overview.viewsChange,
      icon: Eye,
      gradient: 'from-blue-500 to-cyan-500',
    },
    {
      label: 'Total Reach',
      value: formatViewCount(overview.totalReach),
      change: overview.reachChange,
      icon: Users,
      gradient: 'from-indigo-500 to-blue-500',
    },
    {
      label: 'Engagement',
      value: formatViewCount(overview.totalEngagement),
      change: overview.engagementChange,
      icon: Heart,
      gradient: 'from-pink-500 to-rose-500',
    },
    {
      label: 'Likes',
      value: formatViewCount(overview.totalLikes),
      change: null,
      icon: Heart,
      gradient: 'from-red-500 to-pink-500',
    },
    {
      label: 'Comments',
      value: formatViewCount(overview.totalComments),
      change: null,
      icon: MessageCircle,
      gradient: 'from-purple-500 to-violet-500',
    },
    {
      label: 'Shares',
      value: formatViewCount(overview.totalShares),
      change: null,
      icon: Share2,
      gradient: 'from-green-500 to-emerald-500',
    },
  ];

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
                  {Math.abs(stat.change).toFixed(1)}%
                </div>
              )}
            </div>
            <p className="text-white/50 text-sm">{stat.label}</p>
            <p className="text-white text-2xl font-bold mt-1">{stat.value}</p>
          </motion.div>
        ))}
      </div>

      {/* Views Over Time */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="p-6 rounded-3xl bg-white/5 border border-white/10 backdrop-blur-xl"
      >
        <h3 className="text-lg font-bold text-white mb-4">Views Over Time</h3>
        {dailyStats.length === 0 ? (
          <div className="h-48 flex items-center justify-center text-white/40 text-sm">
            No daily data for this period yet.
          </div>
        ) : (
          <>
            <div className="h-48 flex items-end justify-between gap-1 sm:gap-2">
              {dailyStats.map((day, i) => (
                <motion.div
                  key={day.date}
                  initial={{ height: 0 }}
                  animate={{ height: `${Math.max(2, (day.views / maxDailyViews) * 100)}%` }}
                  transition={{ delay: 0.3 + i * 0.02 }}
                  className="flex-1 rounded-t-lg min-w-[2px]"
                  style={{
                    background: ARVDOUL_GRADIENT,
                    opacity: 0.6 + (i / Math.max(1, dailyStats.length)) * 0.4,
                  }}
                  title={`${day.date}: ${formatViewCount(day.views)} views`}
                />
              ))}
            </div>
            <div className="flex justify-between mt-2 text-white/40 text-xs">
              <span>{dailyStats[0]?.date}</span>
              <span>{dailyStats[dailyStats.length - 1]?.date}</span>
            </div>
          </>
        )}
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
          {/* Thumbnail (neutral tile when the post has no media) */}
          <div className="w-24 h-36 rounded-xl overflow-hidden flex-shrink-0 bg-gray-800 flex items-center justify-center">
            {video.thumbnail ? (
              <img
                src={video.thumbnail}
                alt=""
                loading="lazy"
                className="w-full h-full object-cover"
              />
            ) : (
              <Video className="w-8 h-8 text-white/30" aria-hidden="true" />
            )}
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
 * Revenue Tab - Earnings breakdown
 */
const RevenueTab = ({ revenue }) => {

  const { isDark } = useTheme();
  const navigate = useNavigate();
  const [payout, setPayout] = useState(null);
  const [payoutLoading, setPayoutLoading] = useState(true);

  // Real payout account state from the monetization service; never hardcode
  // balances.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { getMonetizationService } = await import('../services/monetizationService.js');
        const settings = await getMonetizationService().getPayoutSettings();
        if (!cancelled) setPayout(settings);
      } catch (err) {
        if (!cancelled) setPayout({ enabled: false, accountStatus: 'unconfigured' });
      } finally {
        if (!cancelled) setPayoutLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);



  return (
    <div className="space-y-6">
      {/* Total Revenue */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="p-8 rounded-3xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 border border-purple-500/30 backdrop-blur-xl text-center"
      >
        <p className="text-white/60 mb-2">Coins Earned</p>
        <p className="text-5xl font-bold text-white mb-2">
          {formatViewCount(revenue.totalCoins)}
        </p>
        <div className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm ${
          revenue.change >= 0 ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
        }`}>
          {revenue.change >= 0 ? (
            <ArrowUpRight className="w-4 h-4" />
          ) : (
            <ArrowDownRight className="w-4 h-4" />
          )}
          {Math.abs(revenue.change).toFixed(1)}% vs last period
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className={`p-4 rounded-2xl border backdrop-blur-xl ${isDark ? 'bg-white/5 border-white/10' : 'bg-white/90 border-gray-200'}`}
      >
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center">
            <DollarSign className="w-5 h-5 text-purple-400" />
          </div>
        </div>
        <p className="text-white/50 text-sm">Coins earned this period</p>
        <p className="text-white text-xl font-bold">{formatViewCount(revenue.totalCoins)}</p>
      </motion.div>

      {/* Payout Info */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="p-6 rounded-3xl bg-white/5 border border-white/10 backdrop-blur-xl"
      >
        <h3 className="text-lg font-bold text-white mb-4">Payout Account</h3>
        {payoutLoading ? (
          <p className="text-white/50 text-sm">Loading payout status...</p>
        ) : payout?.enabled ? (
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-white/60">Status</span>
              <span className="text-green-400 font-semibold">Connected</span>
            </div>
            {payout.payoutSchedule && (
              <div className="flex justify-between">
                <span className="text-white/60">Schedule</span>
                <span className="text-white font-semibold">{payout.payoutSchedule}</span>
              </div>
            )}
          </div>
        ) : (
          <p className="text-white/50 text-sm">
            No payout account is connected yet. Connect one to withdraw your earnings.
          </p>
        )}
        <motion.button
          whileTap={{ scale: 0.98 }}
          onClick={() => navigate('/creator-payout')}
          className="w-full mt-4 py-3 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 text-white font-semibold"
        >
          {payout?.enabled ? 'Manage Payouts' : 'Set Up Payouts'}
        </motion.button>
      </motion.div>
    </div>
  );
};

export default React.memo(VideoAnalyticsScreen);
