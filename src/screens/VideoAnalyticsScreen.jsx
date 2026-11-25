// src/screens/VideoAnalyticsScreen.jsx
//
// Creator dashboard with Sparks video performance metrics

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Video,
  Eye,
  Heart,
  MessageCircle,
  Share2,
  TrendingUp,
  DollarSign,
  Users,
  Clock,
  Play,
  ArrowUpRight,
  ArrowDownRight,
  BarChart3,
  Film,
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useLayoutChrome } from '../context/LayoutChromeContext.jsx';
import { useNavigate } from 'react-router-dom';
import ErrorState from '../design-system/ErrorState.jsx';
import { formatViewCount, formatWatchTime, ARVDOUL_GRADIENT } from '../utils/videoUtils';
import { formatCoinsAsUsd } from '../shared/levelConfig.cjs';
import GlassCard from '../components/UI/GlassCard';
import GlassButton from '../components/UI/GlassButton';
import { unknownNumber } from '../lib/unknownNumber.js';
import { LazyImage } from '../components/Shared/LazyImage';

const sumKnownMetric = (list, selector) => {
  let seen = false;
  let total = 0;
  for (const entry of list) {
    const val = selector(entry);
    if (typeof val === 'number' && Number.isFinite(val)) {
      total += val;
      seen = true;
    }
  }
  return seen ? total : null;
};

/**
 * VideoAnalyticsScreen - Creator Sparks Studio analytics
 * Shows Spark performance, audience insights, and revenue
 */
const VideoAnalyticsScreen = () => {
  const { isDark } = useTheme();
  const { hasTopAppBar } = useLayoutChrome();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('overview');
  const [timeRange, setTimeRange] = useState('7d');
  const [loading, setLoading] = useState(true);
  const [analytics, setAnalytics] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [reloadNonce, setReloadNonce] = useState(0);
  const { user } = useAuth();

  // Load analytics from analyticsService & videoService (Firestore-backed, sharded
  // counters). Unknown metrics stay null - never fabricated zeros.
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!user?.uid) { setLoading(false); return; }
      try {
        setLoading(true);
        setLoadError(null);
        const [{ default: analyticsService }, { default: videoService }] = await Promise.all([
          import('../services/analyticsService.js'),
          import('../services/videoService.js'),
        ]);
        const [data, sparksRes] = await Promise.all([
          analyticsService.getUserAnalytics(user.uid, timeRange === '7d' ? '7d' : timeRange === '28d' ? '30d' : '90d'),
          videoService.getVideosByUser(user.uid, { viewerId: user.uid, limit: 25 }).catch(() => ({ videos: [] })),
        ]);
        if (cancelled) return;

        const mergedMap = new Map();
        for (const v of (sparksRes?.videos || [])) {
          const watchTime = v.totalWatchTime ?? v.stats?.totalWatchTime ?? v.stats?.watchTime ?? null;
          mergedMap.set(v.id, {
            id: v.id,
            title: v.title || v.description?.slice(0, 40) || 'Untitled Spark',
            thumbnail: v.thumbnailUrl || v.thumbnail || '/assets/default-profile.png',
            views: typeof (v.views ?? v.stats?.views) === 'number' ? (v.views ?? v.stats?.views) : null,
            likes: typeof (v.likes ?? v.stats?.likes) === 'number' ? (v.likes ?? v.stats?.likes) : null,
            comments: typeof (v.comments ?? v.stats?.comments) === 'number' ? (v.comments ?? v.stats?.comments) : null,
            shares: typeof (v.shares ?? v.stats?.shares) === 'number' ? (v.shares ?? v.stats?.shares) : null,
            watchTime: typeof watchTime === 'number' ? watchTime : null,
            completionRate: typeof (v.completionRate ?? v.stats?.completionRate) === 'number' ? (v.completionRate ?? v.stats?.completionRate) : null,
            earnings: typeof (v.giftValue ?? v.stats?.giftValue) === 'number' ? (v.giftValue ?? v.stats?.giftValue) : null,
          });
        }
        for (const p of (data.topPosts || [])) {
          if (mergedMap.has(p.id)) continue;
          if (p.type && p.type !== 'video') continue;
          const watchTime = p.stats?.totalWatchTime ?? p.stats?.watchTime ?? p.totalWatchTime ?? null;
          mergedMap.set(p.id, {
            id: p.id,
            title: p.title || p.caption || p.content?.slice(0, 40) || 'Spark',
            thumbnail: p.thumbnailUrl || (p.media && (p.media[0]?.thumbnailUrl || p.media[0]?.url)) || p.mediaUrl || '/assets/default-profile.png',
            views: typeof (p.stats?.views ?? p.views) === 'number' ? (p.stats?.views ?? p.views) : null,
            likes: typeof (p.stats?.likes ?? p.likeCount) === 'number' ? (p.stats?.likes ?? p.likeCount) : null,
            comments: typeof (p.stats?.comments ?? p.commentCount) === 'number' ? (p.stats?.comments ?? p.commentCount) : null,
            shares: typeof (p.stats?.shares ?? p.shareCount) === 'number' ? (p.stats?.shares ?? p.shareCount) : null,
            watchTime: typeof watchTime === 'number' ? watchTime : null,
            completionRate: typeof p.stats?.completionRate === 'number' ? p.stats.completionRate : null,
            earnings: typeof (p.stats?.giftValue ?? p.giftValue) === 'number' ? (p.stats?.giftValue ?? p.giftValue) : null,
          });
        }

        const videosList = Array.from(mergedMap.values());
        const summedComments = sumKnownMetric(videosList, (v) => v.comments);
        const summedShares = sumKnownMetric(videosList, (v) => v.shares);
        const summedWatchTime = sumKnownMetric(videosList, (v) => v.watchTime);

        setAnalytics({
          overview: {
            totalViews: typeof data.totalViews === 'number' ? data.totalViews : null,
            viewsChange: typeof data.changes?.views === 'number' ? data.changes.views : null,
            totalLikes: typeof data.totalEngagement === 'number' ? data.totalEngagement : null,
            likesChange: typeof data.changes?.engagement === 'number' ? data.changes.engagement : null,
            totalComments: summedComments,
            commentsChange: null,
            totalShares: summedShares,
            sharesChange: null,
            totalWatchTime: summedWatchTime,
            watchTimeChange: null,
            avgCompletionRate: null,
            completionChange: null,
            series: (data.dailyStats || [])
              .map((d) => ({ date: d.date, views: unknownNumber(d.views) }))
              .filter((d) => d.views !== null),
            hasData: Boolean(data.hasData),
          },
          revenue: {
            total: typeof data.coinsEarned === 'number' ? data.coinsEarned : null,
            tips: null,
            subscriptions: null,
            payPerView: null,
            gifts: sumKnownMetric(videosList, (v) => v.earnings),
            change: typeof data.changes?.coins === 'number' ? data.changes.coins : null,
          },
          videos: videosList,
          audience: {
            demographics: {
              age: Object.entries(data.demographics?.ageGroups || {}).map(([range, percentage]) => ({ range, percentage })),
              gender: Object.entries(data.demographics?.gender || {}).map(([type, percentage]) => ({ type, percentage })),
            },
            topCountries: Object.entries(data.demographics?.locations || {}).slice(0, 5).map(([country, percentage]) => ({ country, percentage })),
          },
        });
      } catch (err) {
        if (!cancelled) setLoadError(err?.message || 'Could not load your analytics.');
        if (!cancelled) setAnalytics(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [user?.uid, timeRange, reloadNonce]);

  const tabs = [
    { id: 'overview', label: 'Overview', icon: TrendingUp },
    { id: 'videos', label: 'Sparks', icon: Video },
    { id: 'audience', label: 'Audience', icon: Users },
    { id: 'revenue', label: 'Revenue', icon: DollarSign },
  ];

  return (
    <div className={`min-h-screen pb-24 ${isDark ? 'bg-[#03071B] text-white' : 'bg-[#F6F8FC] text-slate-900'}`}>
      {/* Standalone header only when TopAppBar is hidden */}
      {!hasTopAppBar && (
        <div className={`sticky top-0 z-30 backdrop-blur-xl border-b ${isDark ? 'bg-[#03071B]/90 border-white/10' : 'bg-[#F6F8FC]/90 border-slate-200'}`}>
          <div className="max-w-5xl mx-auto px-4 py-4">
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center"
                style={{ background: ARVDOUL_GRADIENT }}
              >
                <TrendingUp className="w-4 h-4 text-white" />
              </div>
              Sparks Analytics
            </h1>
          </div>
        </div>
      )}

      {/* Time Range Selector & Quick Cross-Navigation */}
      <div className="max-w-5xl mx-auto px-4 py-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2 overflow-x-auto no-scrollbar">
          {['24h', '7d', '30d', '90d', '1y'].map((range) => (
            <button
              key={range}
              type="button"
              onClick={() => setTimeRange(range)}
              className={`px-4 py-2 min-h-[40px] rounded-full text-sm font-medium transition-colors shrink-0 ${
                timeRange === range
                  ? 'text-white shadow-md'
                  : isDark ? 'bg-white/10 text-white/70 hover:text-white' : 'bg-white text-slate-600 hover:text-slate-900 border border-slate-200'
              }`}
              style={timeRange === range ? { background: ARVDOUL_GRADIENT } : undefined}
            >
              {range}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => navigate('/profile/analytics')}
            className={`px-3.5 py-2 min-h-[40px] rounded-xl text-xs font-semibold flex items-center gap-1.5 border transition-colors ${
              isDark ? 'bg-white/5 border-white/10 text-white/85 hover:bg-white/10' : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50 shadow-sm'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5 text-purple-500" />
            Creator Dashboard
          </button>
          <button
            type="button"
            onClick={() => navigate('/sparks')}
            className={`px-3.5 py-2 min-h-[40px] rounded-xl text-xs font-semibold flex items-center gap-1.5 border transition-colors ${
              isDark ? 'bg-white/5 border-white/10 text-white/85 hover:bg-white/10' : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50 shadow-sm'
            }`}
          >
            <Film className="w-3.5 h-3.5 text-blue-500" />
            Sparks Feed
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className={`max-w-5xl mx-auto px-4 flex border-b overflow-x-auto no-scrollbar ${isDark ? 'border-white/10' : 'border-slate-200'}`}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors whitespace-nowrap shrink-0 ${
              activeTab === tab.id
                ? `${isDark ? 'text-white' : 'text-slate-900'} border-b-2 border-purple-500`
                : isDark ? 'text-white/55 hover:text-white' : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="max-w-5xl mx-auto p-4">
        {!analytics && loading && (
          <div className={`text-center py-16 ${isDark ? 'text-white/55' : 'text-slate-500'}`} role="status" aria-label="Loading analytics">
            Loading analytics...
          </div>
        )}
        {!analytics && !loading && loadError && (
          <ErrorState
            title="Could not load your analytics"
            message={loadError}
            onRetry={() => setReloadNonce((n) => n + 1)}
          />
        )}
        {!analytics && !loading && !loadError && (
          <div className={`text-center py-16 ${isDark ? 'text-white/55' : 'text-slate-500'}`}>
            No analytics available yet. Publish Sparks to see insights.
          </div>
        )}

        {analytics && activeTab === 'overview' && (
          <OverviewTab analytics={analytics} />
        )}

        {analytics && activeTab === 'videos' && (
          <VideosTab videos={analytics.videos} />
        )}

        {analytics && activeTab === 'audience' && (
          <AudienceTab audience={analytics.audience} />
        )}

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

  const series = overview.series || [];
  const seriesMax = series.reduce((m, d) => Math.max(m, d.views ?? 0), 0);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {stats.map((stat, index) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            className={`p-4 rounded-2xl border backdrop-blur-xl ${
              isDark ? 'bg-white/5 border-white/10' : 'bg-white border-slate-200 shadow-sm'
            }`}
          >
            <div className="flex items-center justify-between mb-3">
              <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${stat.gradient} flex items-center justify-center`}>
                <stat.icon className="w-5 h-5 text-white" />
              </div>
              {typeof stat.change === 'number' && (
                <div className={`flex items-center gap-1 text-sm ${
                  stat.change >= 0 ? 'text-emerald-500' : 'text-rose-500'
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
            <p className={`text-sm ${isDark ? 'text-white/60' : 'text-slate-600'}`}>{stat.label}</p>
            <p className={`text-2xl font-bold mt-1 tabular-nums ${isDark ? 'text-white' : 'text-slate-900'}`}>{stat.value}</p>
          </motion.div>
        ))}
      </div>

      <GlassCard hoverable={false} className="p-6">
        <h3 className={`text-lg font-bold mb-4 ${isDark ? 'text-white' : 'text-slate-900'}`}>Views Over Time</h3>
        <div className="h-48 flex items-end justify-between gap-2">
          {series.length === 0 ? (
            <div className={`w-full h-full flex items-center justify-center text-sm ${isDark ? 'text-white/45' : 'text-slate-500'}`}>
              No daily view data yet
            </div>
          ) : (
            series.map((d, i) => (
              <motion.div
                key={d.date}
                initial={{ height: 0 }}
                animate={{ height: seriesMax > 0 ? `${Math.round((d.views / seriesMax) * 100)}%` : '2%' }}
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
        <div className={`flex justify-between mt-2 text-xs ${isDark ? 'text-white/45' : 'text-slate-500'}`}>
          <span>{series[0]?.date || ''}</span>
          <span>{series[series.length - 1]?.date || ''}</span>
        </div>
      </GlassCard>
    </div>
  );
};

/**
 * Videos Tab - Individual Spark performance
 */
const VideosTab = ({ videos }) => {
  const { isDark } = useTheme();
  const navigate = useNavigate();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className={`text-lg font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>Your Sparks</h3>
        <span className={`text-xs font-medium ${isDark ? 'text-white/55' : 'text-slate-500'}`}>
          {videos.length} {videos.length === 1 ? 'Spark' : 'Sparks'}
        </span>
      </div>

      {videos.length === 0 ? (
        <div className={`p-8 rounded-2xl border text-center space-y-3 ${
          isDark ? 'bg-white/5 border-white/10 text-white/70' : 'bg-white border-slate-200 text-slate-600 shadow-sm'
        }`}>
          <Video className="w-10 h-10 mx-auto text-purple-500 opacity-80" />
          <p className={`font-semibold text-sm ${isDark ? 'text-white' : 'text-slate-900'}`}>No Sparks published yet</p>
          <p className="text-xs max-w-sm mx-auto">Upload your first Spark to track views, likes, comments, shares, and gifts here.</p>
          <GlassButton variant="gradient" onClick={() => navigate('/create-post?type=video')}>
            Create Spark
          </GlassButton>
        </div>
      ) : (
        videos.map((video, index) => (
          <motion.div
            key={video.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            className={`p-4 rounded-2xl border backdrop-blur-xl flex flex-col sm:flex-row gap-4 ${
              isDark ? 'bg-white/5 border-white/10' : 'bg-white border-slate-200 shadow-sm'
            }`}
          >
            <button
              type="button"
              onClick={() => navigate(`/sparks/${video.id}`)}
              className={`w-full sm:w-24 h-40 sm:h-36 rounded-xl overflow-hidden flex-shrink-0 cursor-pointer ${
                isDark ? 'bg-slate-800' : 'bg-slate-200'
              }`}
              aria-label={`Open ${video.title}`}
            >
              <LazyImage
                src={video.thumbnail}
                alt={video.title}
                className="w-full h-full object-cover"
              />
            </button>

            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <button
                  type="button"
                  onClick={() => navigate(`/sparks/${video.id}`)}
                  className={`font-semibold truncate text-left hover:underline ${isDark ? 'text-white' : 'text-slate-900'}`}
                >
                  {video.title}
                </button>
                <button
                  type="button"
                  onClick={() => navigate(`/post/${video.id}/analytics`)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold shrink-0 flex items-center gap-1 border transition-colors ${
                    isDark ? 'bg-white/10 border-white/10 text-white hover:bg-white/15' : 'bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  <BarChart3 className="w-3.5 h-3.5 text-purple-500" />
                  Detailed Analytics
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3">
                <div className="flex items-center gap-2">
                  <Eye className={`w-4 h-4 ${isDark ? 'text-white/50' : 'text-slate-400'}`} />
                  <span className={`text-sm tabular-nums ${isDark ? 'text-white/85' : 'text-slate-700'}`}>{formatViewCount(video.views)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Heart className={`w-4 h-4 ${isDark ? 'text-white/50' : 'text-slate-400'}`} />
                  <span className={`text-sm tabular-nums ${isDark ? 'text-white/85' : 'text-slate-700'}`}>{formatViewCount(video.likes)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <MessageCircle className={`w-4 h-4 ${isDark ? 'text-white/50' : 'text-slate-400'}`} />
                  <span className={`text-sm tabular-nums ${isDark ? 'text-white/85' : 'text-slate-700'}`}>{formatViewCount(video.comments)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Share2 className={`w-4 h-4 ${isDark ? 'text-white/50' : 'text-slate-400'}`} />
                  <span className={`text-sm tabular-nums ${isDark ? 'text-white/85' : 'text-slate-700'}`}>{formatViewCount(video.shares)}</span>
                </div>
              </div>

              <div className="mt-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock className={`w-4 h-4 ${isDark ? 'text-white/50' : 'text-slate-400'}`} />
                  <span className={`text-xs ${isDark ? 'text-white/55' : 'text-slate-500'}`}>
                    {video.watchTime == null ? 'Watch time not tracked' : `${formatWatchTime(video.watchTime)} watch time`}
                  </span>
                </div>
                <div className="text-emerald-500 text-sm font-medium">
                  {video.earnings == null ? '—' : formatCoinsAsUsd(video.earnings)}
                </div>
              </div>

              <div className="mt-3">
                <div className="flex items-center justify-between mb-1">
                  <span className={`text-xs ${isDark ? 'text-white/55' : 'text-slate-500'}`}>Completion</span>
                  <span className={`text-xs font-medium ${isDark ? 'text-white/85' : 'text-slate-700'}`}>
                    {video.completionRate == null ? '—' : `${video.completionRate}%`}
                  </span>
                </div>
                <div className={`h-1.5 rounded-full overflow-hidden ${isDark ? 'bg-white/10' : 'bg-slate-200'}`}>
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${unknownNumber(video.completionRate) ?? 0}%`,
                      background: ARVDOUL_GRADIENT,
                    }}
                  />
                </div>
              </div>
            </div>
          </motion.div>
        ))
      )}
    </div>
  );
};

/**
 * Audience Tab - Demographics and locations
 */
const AudienceTab = ({ audience }) => {
  const { isDark } = useTheme();
  const hasAnyDemographics =
    audience.demographics.age.length > 0 ||
    audience.demographics.gender.length > 0 ||
    audience.topCountries.length > 0;

  if (!hasAnyDemographics) {
    return (
      <div className={`p-8 rounded-3xl border text-center space-y-2 ${
        isDark ? 'bg-white/5 border-white/10 text-white/70' : 'bg-white border-slate-200 text-slate-600 shadow-sm'
      }`}>
        <Users className="w-10 h-10 mx-auto text-purple-500 opacity-80" />
        <p className={`font-semibold text-sm ${isDark ? 'text-white' : 'text-slate-900'}`}>No audience demographics yet</p>
        <p className="text-xs max-w-sm mx-auto">Demographic breakdowns appear automatically once your Sparks gather viewer insights.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className={`p-6 rounded-3xl border backdrop-blur-xl ${
          isDark ? 'bg-white/5 border-white/10' : 'bg-white border-slate-200 shadow-sm'
        }`}
      >
        <h3 className={`text-lg font-bold mb-4 ${isDark ? 'text-white' : 'text-slate-900'}`}>Age Distribution</h3>
        <div className="space-y-3">
          {audience.demographics.age.map((item) => (
            <div key={item.range} className="flex items-center gap-4">
              <span className={`w-16 text-sm ${isDark ? 'text-white/60' : 'text-slate-600'}`}>{item.range}</span>
              <div className={`flex-1 h-3 rounded-full overflow-hidden ${isDark ? 'bg-white/10' : 'bg-slate-200'}`}>
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${item.percentage}%` }}
                  transition={{ duration: 0.5 }}
                  className="h-full rounded-full"
                  style={{ background: ARVDOUL_GRADIENT }}
                />
              </div>
              <span className={`w-12 text-right text-sm font-medium ${isDark ? 'text-white/85' : 'text-slate-700'}`}>{item.percentage}%</span>
            </div>
          ))}
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className={`p-6 rounded-3xl border backdrop-blur-xl ${
          isDark ? 'bg-white/5 border-white/10' : 'bg-white border-slate-200 shadow-sm'
        }`}
      >
        <h3 className={`text-lg font-bold mb-4 ${isDark ? 'text-white' : 'text-slate-900'}`}>Gender Distribution</h3>
        <div className="flex flex-wrap justify-around gap-4">
          {audience.demographics.gender.map((item) => (
            <div key={item.type} className="text-center">
              <div
                className="w-20 h-20 rounded-full mx-auto mb-2 flex items-center justify-center shadow-md"
                style={{ background: ARVDOUL_GRADIENT }}
              >
                <span className="text-white font-bold">{item.percentage}%</span>
              </div>
              <p className={`text-sm ${isDark ? 'text-white/65' : 'text-slate-600'}`}>{item.type}</p>
            </div>
          ))}
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className={`p-6 rounded-3xl border backdrop-blur-xl ${
          isDark ? 'bg-white/5 border-white/10' : 'bg-white border-slate-200 shadow-sm'
        }`}
      >
        <h3 className={`text-lg font-bold mb-4 ${isDark ? 'text-white' : 'text-slate-900'}`}>Top Countries</h3>
        <div className="space-y-3">
          {audience.topCountries.map((item, index) => (
            <div key={item.country} className="flex items-center gap-4">
              <span className={`w-6 text-sm ${isDark ? 'text-white/45' : 'text-slate-400'}`}>{index + 1}</span>
              <span className={`flex-1 ${isDark ? 'text-white/85' : 'text-slate-800'}`}>{item.country}</span>
              <span className={`text-sm ${isDark ? 'text-white/60' : 'text-slate-600'}`}>{item.percentage}%</span>
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  );
};

/**
 * Revenue Tab - Earnings breakdown.
 */
const RevenueTab = ({ revenue }) => {
  const { isDark } = useTheme();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [payout, setPayout] = useState({ loading: true, settings: null, pendingCoins: null, lastPayoutCoins: null });

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!user?.uid) {
        if (!cancelled) setPayout({ loading: false, settings: null, pendingCoins: null, lastPayoutCoins: null });
        return;
      }
      try {
        const [{ default: walletService }, { getMonetizationService }] = await Promise.all([
          import('../services/walletService.js'),
          import('../services/monetizationService.js'),
        ]);
        const monetizationService = getMonetizationService();
        const [settingsRes, walletRes, historyRes] = await Promise.allSettled([
          monetizationService.getPayoutSettings(),
          walletService.getWalletOverview(user.uid),
          monetizationService.getTransactionHistory(user.uid, 100),
        ]);
        if (cancelled) return;

        const settings = settingsRes.status === 'fulfilled' ? settingsRes.value : null;
        const pendingCoins = walletRes.status === 'fulfilled'
          ? (walletRes.value?.pendingCoins ?? null)
          : null;

        let lastPayoutCoins = null;
        const historyItems = historyRes.status === 'fulfilled' ? historyRes.value?.items : null;
        if (Array.isArray(historyItems)) {
          const withdrawals = historyItems.filter(
            (tx) => tx.type === 'debit' || tx.type === 'withdrawal' || tx.reason?.includes('withdraw')
          );
          if (withdrawals.length > 0) lastPayoutCoins = unknownNumber(withdrawals[0].amount);
        }

        setPayout({ loading: false, settings, pendingCoins, lastPayoutCoins });
      } catch {
        if (!cancelled) setPayout({ loading: false, settings: null, pendingCoins: null, lastPayoutCoins: null });
      }
    };
    load();
    return () => { cancelled = true; };
  }, [user?.uid]);

  const formatUsd = formatCoinsAsUsd;
  const accountConnected = payout.settings?.status === 'ready';

  const revenueItems = [
    { label: 'Subscriptions', value: revenue.subscriptions, icon: Users },
    { label: 'Tips', value: revenue.tips, icon: Heart },
    { label: 'Pay Per View', value: revenue.payPerView, icon: Video },
    { label: 'Gifts', value: revenue.gifts, icon: DollarSign },
  ];

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className={`p-8 rounded-3xl border backdrop-blur-xl text-center ${
          isDark ? 'bg-white/5 border-purple-500/30' : 'bg-white border-purple-200 shadow-sm'
        }`}
      >
        <p className={`${isDark ? 'text-white/60' : 'text-slate-600'} mb-2`}>Total Earnings (USD)</p>
        <p className={`text-5xl font-bold mb-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>
          {formatUsd(revenue.total)}
        </p>
        {typeof revenue.change === 'number' && (
          <div className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm ${
            revenue.change >= 0 ? 'bg-emerald-500/20 text-emerald-500' : 'bg-rose-500/20 text-rose-500'
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

      <div className="grid grid-cols-2 gap-4">
        {revenueItems.map((item, index) => (
          <motion.div
            key={item.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            className={`p-4 rounded-2xl border backdrop-blur-xl ${
              isDark ? 'bg-white/5 border-white/10' : 'bg-white border-slate-200 shadow-sm'
            }`}
          >
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center">
                <item.icon className="w-5 h-5 text-purple-500" />
              </div>
            </div>
            <p className={`text-sm ${isDark ? 'text-white/55' : 'text-slate-500'}`}>{item.label}</p>
            <p className={`text-xl font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
              {item.value == null ? 'Not tracked' : formatUsd(item.value)}
            </p>
          </motion.div>
        ))}
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className={`p-6 rounded-3xl border backdrop-blur-xl ${
          isDark ? 'bg-white/5 border-white/10' : 'bg-white border-slate-200 shadow-sm'
        }`}
      >
        <h3 className={`text-lg font-bold mb-4 ${isDark ? 'text-white' : 'text-slate-900'}`}>Payout Info</h3>
        {payout.loading ? (
          <p className={`text-sm ${isDark ? 'text-white/55' : 'text-slate-500'}`}>Loading payout status…</p>
        ) : (
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className={isDark ? 'text-white/60' : 'text-slate-600'}>Payout Account</span>
              <span className={`font-semibold ${accountConnected ? 'text-emerald-500' : 'text-amber-500'}`}>
                {accountConnected ? 'Connected' : 'Not connected'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className={isDark ? 'text-white/60' : 'text-slate-600'}>Pending Payout</span>
              <span className={`font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>{formatUsd(payout.pendingCoins)}</span>
            </div>
            <div className="flex justify-between">
              <span className={isDark ? 'text-white/60' : 'text-slate-600'}>Last Payout</span>
              <span className={`font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>{formatUsd(payout.lastPayoutCoins)}</span>
            </div>
          </div>
        )}
        <GlassButton
          variant="gradient"
          className="w-full mt-4"
          onClick={() => navigate('/creator-payout')}
        >
          Manage Payouts
        </GlassButton>
      </motion.div>
    </div>
  );
};

export default React.memo(VideoAnalyticsScreen);
