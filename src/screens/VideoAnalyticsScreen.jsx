// src/screens/VideoAnalyticsScreen.jsx - ARVDOUL VIDEO ANALYTICS SCREEN
// Creator dashboard with video performance metrics

import React, { useState, useEffect, useCallback, memo } from 'react';
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
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { ARVDOUL_GRADIENT, formatViewCount, formatDuration, formatWatchTime } from '../utils/videoUtils';
import { SPRING_ANIMATION } from '../utils/videoUtils';
import { toast } from 'sonner';

/**
 * VideoAnalyticsScreen - Creator dashboard with analytics
 * Shows video performance, audience insights, and revenue
 */
const VideoAnalyticsScreen = () => {
  const { theme, isDark } = useTheme();
  const [activeTab, setActiveTab] = useState('overview');
  const [timeRange, setTimeRange] = useState('7d');
  const [loading, setLoading] = useState(false);

  // Demo analytics data
  const [analytics] = useState({
    overview: {
      totalViews: 1250000,
      viewsChange: 23.5,
      totalLikes: 89000,
      likesChange: 18.2,
      totalComments: 12500,
      commentsChange: 31.4,
      totalShares: 4500,
      sharesChange: 12.8,
      totalWatchTime: 456000, // seconds
      watchTimeChange: 28.7,
      avgCompletionRate: 67,
      completionChange: 5.2,
    },
    revenue: {
      total: 4520.50,
      tips: 1230.00,
      subscriptions: 2500.00,
      payPerView: 520.50,
      gifts: 270.00,
      change: 15.3,
    },
    videos: [
      {
        id: 'v1',
        title: 'Amazing Sunset Timelapse',
        thumbnail: 'https://images.unsplash.com/photo-1495616811223-4d98c6e9c869?w=200',
        views: 450000,
        likes: 32000,
        comments: 2400,
        shares: 1800,
        watchTime: 125000,
        completionRate: 78,
        earnings: 890.00,
      },
      {
        id: 'v2',
        title: 'City Lights at Night',
        thumbnail: 'https://images.unsplash.com/photo-1519501025264-65ba15a82390?w=200',
        views: 320000,
        likes: 24000,
        comments: 1800,
        shares: 1200,
        watchTime: 89000,
        completionRate: 71,
        earnings: 650.00,
      },
      {
        id: 'v3',
        title: 'Mountain Adventure',
        thumbnail: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=200',
        views: 280000,
        likes: 19000,
        comments: 1400,
        shares: 950,
        watchTime: 76000,
        completionRate: 65,
        earnings: 520.00,
      },
      {
        id: 'v4',
        title: 'Cooking Masterclass',
        thumbnail: 'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=200',
        views: 200000,
        likes: 14000,
        comments: 2100,
        shares: 550,
        watchTime: 98000,
        completionRate: 82,
        earnings: 480.00,
      },
    ],
    audience: {
      demographics: {
        age: [
          { range: '13-17', percentage: 8 },
          { range: '18-24', percentage: 32 },
          { range: '25-34', percentage: 35 },
          { range: '35-44', percentage: 15 },
          { range: '45+', percentage: 10 },
        ],
        gender: [
          { type: 'Male', percentage: 45 },
          { type: 'Female', percentage: 52 },
          { type: 'Other', percentage: 3 },
        ],
      },
      topCountries: [
        { country: 'United States', percentage: 35 },
        { country: 'United Kingdom', percentage: 18 },
        { country: 'Canada', percentage: 12 },
        { country: 'Australia', percentage: 8 },
        { country: 'Germany', percentage: 6 },
      ],
    },
  });

  const tabs = [
    { id: 'overview', label: 'Overview', icon: TrendingUp },
    { id: 'videos', label: 'Videos', icon: Video },
    { id: 'audience', label: 'Audience', icon: Users },
    { id: 'revenue', label: 'Revenue', icon: DollarSign },
  ];

  return (
    <div className="min-h-screen bg-black text-white pb-20">
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
        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <OverviewTab analytics={analytics} />
        )}

        {/* Videos Tab */}
        {activeTab === 'videos' && (
          <VideosTab videos={analytics.videos} />
        )}

        {/* Audience Tab */}
        {activeTab === 'audience' && (
          <AudienceTab audience={analytics.audience} />
        )}

        {/* Revenue Tab */}
        {activeTab === 'revenue' && (
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
  const { overview } = analytics;

  const stats = [
    {
      label: 'Total Views',
      value: formatViewCount(overview.totalViews),
      change: overview.viewsChange,
      icon: Eye,
      gradient: 'from-blue-500 to-cyan-500',
    },
    {
      label: 'Total Likes',
      value: formatViewCount(overview.totalLikes),
      change: overview.likesChange,
      icon: Heart,
      gradient: 'from-red-500 to-pink-500',
    },
    {
      label: 'Comments',
      value: formatViewCount(overview.totalComments),
      change: overview.commentsChange,
      icon: MessageCircle,
      gradient: 'from-purple-500 to-violet-500',
    },
    {
      label: 'Shares',
      value: formatViewCount(overview.totalShares),
      change: overview.sharesChange,
      icon: Share2,
      gradient: 'from-green-500 to-emerald-500',
    },
    {
      label: 'Watch Time',
      value: formatWatchTime(overview.totalWatchTime),
      change: overview.watchTimeChange,
      icon: Clock,
      gradient: 'from-orange-500 to-amber-500',
    },
    {
      label: 'Avg. Completion',
      value: `${overview.avgCompletionRate}%`,
      change: overview.completionChange,
      icon: Play,
      gradient: 'from-fuchsia-500 to-purple-500',
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
            className="p-4 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-xl"
          >
            <div className="flex items-center justify-between mb-3">
              <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${stat.gradient} flex items-center justify-center`}>
                <stat.icon className="w-5 h-5 text-white" />
              </div>
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
            </div>
            <p className="text-white/50 text-sm">{stat.label}</p>
            <p className="text-white text-2xl font-bold mt-1">{stat.value}</p>
          </motion.div>
        ))}
      </div>

      {/* Performance Chart Placeholder */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="p-6 rounded-3xl bg-white/5 border border-white/10 backdrop-blur-xl"
      >
        <h3 className="text-lg font-bold text-white mb-4">Views Over Time</h3>
        <div className="h-48 flex items-end justify-between gap-2">
          {[65, 78, 85, 72, 90, 95, 88, 92, 100, 95, 98, 105].map((value, i) => (
            <motion.div
              key={i}
              initial={{ height: 0 }}
              animate={{ height: `${value}%` }}
              transition={{ delay: 0.3 + i * 0.02 }}
              className="flex-1 rounded-t-lg"
              style={{
                background: ARVDOUL_GRADIENT,
                opacity: 0.6 + (i / 12) * 0.4,
              }}
            />
          ))}
        </div>
        <div className="flex justify-between mt-2 text-white/40 text-xs">
          <span>Jan</span>
          <span>Feb</span>
          <span>Mar</span>
          <span>Apr</span>
          <span>May</span>
          <span>Jun</span>
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
                  {formatWatchTime(video.watchTime)} watch time
                </span>
              </div>
              <div className="text-green-400 text-sm font-medium">
                ${video.earnings.toFixed(2)}
              </div>
            </div>

            {/* Completion Bar */}
            <div className="mt-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-white/50 text-xs">Completion</span>
                <span className="text-white/80 text-xs">{video.completionRate}%</span>
              </div>
              <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${video.completionRate}%`,
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
 * Revenue Tab - Earnings breakdown
 */
const RevenueTab = ({ revenue }) => {
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
        <p className="text-white/60 mb-2">Total Earnings</p>
        <p className="text-5xl font-bold text-white mb-2">
          ${revenue.total.toFixed(2)}
        </p>
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
      </motion.div>

      {/* Revenue Breakdown */}
      <div className="grid grid-cols-2 gap-4">
        {revenueItems.map((item, index) => (
          <motion.div
            key={item.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            className="p-4 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-xl"
          >
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center">
                <item.icon className="w-5 h-5 text-purple-400" />
              </div>
            </div>
            <p className="text-white/50 text-sm">{item.label}</p>
            <p className="text-white text-xl font-bold">${item.value.toFixed(2)}</p>
          </motion.div>
        ))}
      </div>

      {/* Payout Info */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="p-6 rounded-3xl bg-white/5 border border-white/10 backdrop-blur-xl"
      >
        <h3 className="text-lg font-bold text-white mb-4">Payout Info</h3>
        <div className="space-y-3">
          <div className="flex justify-between">
            <span className="text-white/60">Pending Payout</span>
            <span className="text-white font-semibold">$1,250.00</span>
          </div>
          <div className="flex justify-between">
            <span className="text-white/60">Last Payout</span>
            <span className="text-white font-semibold">$2,300.00</span>
          </div>
          <div className="flex justify-between">
            <span className="text-white/60">Payout Schedule</span>
            <span className="text-white">Monthly</span>
          </div>
        </div>
        <motion.button
          whileTap={{ scale: 0.98 }}
          className="w-full mt-4 py-3 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 text-white font-semibold"
        >
          Manage Payouts
        </motion.button>
      </motion.div>
    </div>
  );
};

export default VideoAnalyticsScreen;
