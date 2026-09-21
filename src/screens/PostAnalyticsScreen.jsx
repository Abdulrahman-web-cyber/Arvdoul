// src/screens/PostAnalyticsScreen.jsx

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowLeft, Eye, Heart, MessageCircle, Share2, TrendingUp, BarChart3
} from 'lucide-react';
import { getAnalyticsService } from '../services/analyticsService';
import { getPostService } from '../services/postService';
import { useAuth } from '../context/AuthContext';
import { formatViewCount, ARVDOUL_GRADIENT } from '../utils/videoUtils';
import { Skeleton } from '../components/ui/Skeleton.jsx';

const StatCard = ({ label, value, icon: Icon, gradient }) => (
  <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-4">
    <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center mb-3`}>
      <Icon className="w-5 h-5 text-white" aria-hidden="true" />
    </div>
    <p className="text-white/50 text-sm">{label}</p>
    <p className="text-white text-2xl font-bold mt-1">{value}</p>
  </div>
);

export default function PostAnalyticsScreen() {
  const { postId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [post, setPost] = useState(null);
  const [analytics, setAnalytics] = useState(null);

  const load = useCallback(async () => {
    if (!postId || !user?.uid) return;
    setLoading(true);
    setError(null);
    try {
      const postService = getPostService();
      const postData = await postService.getPost(postId);
      if (!postData) {
        setError('Post not found.');
        return;
      }
      if (postData.authorId !== user.uid && postData.userId !== user.uid) {
        setError('You can only view analytics for your own posts.');
        return;
      }
      setPost(postData);
      const analyticsData = await getAnalyticsService().getPostAnalytics(postId);
      setAnalytics(analyticsData);
    } catch (err) {
      setError(err?.message || 'Failed to load analytics.');
    } finally {
      setLoading(false);
    }
  }, [postId, user?.uid]);

  useEffect(() => { load(); }, [load]);

  const dailyStats = analytics?.dailyStats || [];
  const maxViews = Math.max(1, ...dailyStats.map((d) => d.views || 0));

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#060816] via-[#0b1220] to-[#02040a] text-white pb-20">
      <header className="sticky top-0 z-30 backdrop-blur-xl bg-black/70 border-b border-white/10">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            aria-label="Go back"
            className="p-2 rounded-full hover:bg-white/10"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="min-w-0">
            <h1 className="text-lg font-bold truncate">Post Analytics</h1>
            {post?.caption && <p className="text-xs text-white/50 truncate">{post.caption}</p>}
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto p-4 space-y-6">
        {loading && (
          <div className="space-y-4">
            <Skeleton className="h-28 w-full rounded-2xl" />
            <Skeleton className="h-56 w-full rounded-2xl" />
          </div>
        )}

        {!loading && error && (
          <div className="text-center py-16">
            <p className="text-white/60">{error}</p>
            <button
              onClick={() => navigate(-1)}
              className="mt-4 px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-sm font-semibold"
            >
              Go back
            </button>
          </div>
        )}

        {!loading && !error && analytics && (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <StatCard label="Views" value={formatViewCount(analytics.totalViews)} icon={Eye} gradient="from-blue-500 to-cyan-500" />
              <StatCard label="Likes" value={formatViewCount(analytics.totalLikes)} icon={Heart} gradient="from-red-500 to-pink-500" />
              <StatCard label="Comments" value={formatViewCount(analytics.totalComments)} icon={MessageCircle} gradient="from-purple-500 to-violet-500" />
              <StatCard label="Shares" value={formatViewCount(analytics.totalShares)} icon={Share2} gradient="from-green-500 to-emerald-500" />
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-4 flex items-center gap-3">
              <TrendingUp className="w-5 h-5 text-indigo-400" aria-hidden="true" />
              <div>
                <p className="text-white/50 text-sm">Engagement rate</p>
                <p className="text-white text-xl font-bold">{analytics.engagementRate}%</p>
              </div>
            </div>

            <section className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-6">
              <h2 className="text-base font-bold mb-4 flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-indigo-400" aria-hidden="true" />
                Views over time
              </h2>
              {dailyStats.length === 0 ? (
                <p className="text-white/40 text-sm h-40 flex items-center justify-center">
                  No daily views recorded yet.
                </p>
              ) : (
                <>
                  <div className="h-40 flex items-end gap-1 sm:gap-2">
                    {dailyStats.map((day, i) => (
                      <motion.div
                        key={day.date}
                        initial={{ height: 0 }}
                        animate={{ height: `${Math.max(2, ((day.views || 0) / maxViews) * 100)}%` }}
                        transition={{ delay: i * 0.02 }}
                        className="flex-1 rounded-t-lg min-w-[2px]"
                        style={{ background: ARVDOUL_GRADIENT, opacity: 0.6 + (i / Math.max(1, dailyStats.length)) * 0.4 }}
                        title={`${day.date}: ${formatViewCount(day.views || 0)} views`}
                      />
                    ))}
                  </div>
                  <div className="flex justify-between mt-2 text-white/40 text-xs">
                    <span>{dailyStats[0]?.date}</span>
                    <span>{dailyStats[dailyStats.length - 1]?.date}</span>
                  </div>
                </>
              )}
            </section>

            {analytics.lastUpdated && (
              <p className="text-white/30 text-xs text-center">
                Last updated {new Date(analytics.lastUpdated).toLocaleString()}
              </p>
            )}
          </>
        )}
      </main>
    </div>
  );
}