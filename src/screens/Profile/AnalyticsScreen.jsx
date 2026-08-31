// src/screens/Profile/AnalyticsScreen.jsx - ARVDOUL PROFILE ANALYTICS
// Per Constitution v5.0 - Real production analytics
import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { useTheme } from '@context/ThemeContext';
import { useAuth } from '@context/AuthContext';
import { cn } from '../../lib/utils';
import analyticsService from '../../services/analyticsService';
import { 
  TrendingUp, TrendingDown, Users, Eye, Heart, MessageCircle, 
  Share2, MoreVertical, Calendar, Loader2
} from 'lucide-react';

const TIMEFRAME_OPTIONS = [
  { id: '7d', label: '7 Days' },
  { id: '30d', label: '30 Days' },
  { id: '90d', label: '90 Days' },
  { id: '1y', label: '1 Year' },
];

export default function AnalyticsScreen() {
  const { theme } = useTheme();
  const { user } = useAuth();
  const isDark = theme === 'dark';
  const [timeframe, setTimeframe] = useState('30d');
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const loadAnalytics = async () => {
      if (!user?.uid) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const data = await analyticsService.getUserAnalytics(user.uid, timeframe);
        setAnalytics(data);
      } catch (err) {
        console.error('Failed to load analytics:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    loadAnalytics();
  }, [user?.uid, timeframe]);

  const backgroundStyle = useMemo(() => ({
    background: isDark
      ? 'radial-gradient(circle at 50% 0%, rgba(139, 30, 243, 0.1) 0%, transparent 50%), #03071B'
      : 'radial-gradient(circle at 50% 0%, rgba(139, 30, 243, 0.05) 0%, transparent 50%), #F6F8FC',
  }), [isDark]);

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={backgroundStyle}>
        <Loader2 className="w-8 h-8 animate-spin text-arvdoul-purple" />
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center" style={backgroundStyle}>
        <p className="text-red-400 mb-4">{error}</p>
        <button 
          onClick={() => window.location.reload()}
          className="px-4 py-2 rounded-lg bg-arvdoul-purple text-white"
        >
          Retry
        </button>
      </div>
    );
  }

  // Default metrics when no data
  const metrics = analytics?.metrics || {
    profileViews: 0,
    followers: 0,
    engagement: 0,
    posts: 0,
  };

  const stats = [
    { label: 'Profile Views', value: metrics.profileViews || 0, icon: Eye, change: analytics?.viewsChange || 0 },
    { label: 'Total Followers', value: metrics.followers || 0, icon: Users, change: analytics?.followersChange || 0 },
    { label: 'Engagement Rate', value: `${metrics.engagement || 0}%`, icon: Heart, change: analytics?.engagementChange || 0 },
    { label: 'Total Posts', value: metrics.posts || 0, icon: MessageCircle, change: 0 },
  ];

  return (
    <div className="min-h-screen pb-20" style={backgroundStyle}>
      {/* Header */}
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="sticky top-0 z-10 backdrop-blur-lg bg-black/30"
      >
        <div className="px-4 py-4">
          <h1 className="text-2xl font-display font-bold text-white">Analytics</h1>
          
          {/* Timeframe Selector */}
          <div className="flex gap-2 mt-4 overflow-x-auto pb-2">
            {TIMEFRAME_OPTIONS.map((option) => (
              <button
                key={option.id}
                onClick={() => setTimeframe(option.id)}
                className={cn(
                  "px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all",
                  timeframe === option.id
                    ? "bg-arvdoul-gradient text-white"
                    : isDark ? "bg-white/10 text-gray-300" : "bg-gray-200 text-gray-700"
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </motion.div>

      {/* Stats Grid */}
      <div className="px-4 mt-4">
        <div className="grid grid-cols-2 gap-3">
          {stats.map((stat, index) => {
            const Icon = stat.icon;
            const isPositive = stat.change > 0;
            
            return (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className={cn(
                  "p-4 rounded-arvdoul-xl",
                  "bg-arvdoul-surface border border-arvdoul-border"
                )}
              >
                <div className="flex items-center justify-between mb-2">
                  <Icon className="w-5 h-5 text-arvdoul-purple" />
                  {stat.change !== 0 && (
                    <div className={cn(
                      "flex items-center gap-1 text-xs font-medium",
                      isPositive ? "text-green-400" : "text-red-400"
                    )}>
                      {isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                      {Math.abs(stat.change)}%
                    </div>
                  )}
                </div>
                <p className="text-2xl font-bold text-white">{stat.value}</p>
                <p className="text-sm text-gray-400">{stat.label}</p>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Engagement Chart Placeholder */}
      <div className="px-4 mt-6">
        <div className={cn(
          "p-4 rounded-arvdoul-xl",
          "bg-arvdoul-surface border border-arvdoul-border"
        )}>
          <h3 className="text-lg font-semibold text-white mb-4">Engagement Over Time</h3>
          <div className="h-40 flex items-center justify-center text-gray-500">
            {analytics?.chartData ? (
              <div className="w-full h-full flex items-end gap-1">
                {/* Chart would render here with real data */}
              </div>
            ) : (
              <p>No engagement data available yet</p>
            )}
          </div>
        </div>
      </div>

      {/* Top Content */}
      <div className="px-4 mt-6">
        <div className={cn(
          "p-4 rounded-arvdoul-xl",
          "bg-arvdoul-surface border border-arvdoul-border"
        )}>
          <h3 className="text-lg font-semibold text-white mb-4">Top Performing Content</h3>
          {analytics?.topContent?.length > 0 ? (
            <div className="space-y-3">
              {analytics.topContent.slice(0, 5).map((post, index) => (
                <div key={post.id} className="flex items-center gap-3">
                  <span className="text-arvdoul-purple font-bold">{index + 1}</span>
                  <div className="flex-1">
                    <p className="text-white truncate">{post.title}</p>
                    <p className="text-sm text-gray-400">{post.views} views • {post.likes} likes</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-center py-4">No content data available yet</p>
          )}
        </div>
      </div>
    </div>
  );
}
