// src/screens/PostAnalyticsScreen.jsx - Post-level performance metrics & insights
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  Eye,
  Heart,
  MessageCircle,
  Share2,
  TrendingUp,
  Clock,
  Users,
  BarChart3,
  Bookmark,
  Sparkles,
  RefreshCw,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';

export default function PostAnalyticsScreen() {
  const { postId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [post, setPost] = useState(null);
  const [metrics, setMetrics] = useState({
    views: 0,
    likes: 0,
    comments: 0,
    shares: 0,
    saves: 0,
    engagementRate: 0,
  });

  useEffect(() => {
    let active = true;
    const fetchPostData = async () => {
      if (!postId) return;
      setLoading(true);
      try {
        const { default: postService } = await import('../services/postService.js');
        const postDoc = await postService.getPost(postId);
        if (!active) return;
        if (postDoc) {
          setPost(postDoc);
          const views = postDoc.viewsCount || postDoc.views || 0;
          const likes = postDoc.likesCount || postDoc.likes?.length || 0;
          const comments = postDoc.commentsCount || postDoc.comments || 0;
          const shares = postDoc.sharesCount || postDoc.shares || 0;
          const saves = postDoc.savesCount || 0;
          const totalEngagements = likes + comments + shares + saves;
          const engagementRate = views > 0 ? ((totalEngagements / views) * 100).toFixed(1) : 0;

          setMetrics({
            views,
            likes,
            comments,
            shares,
            saves,
            engagementRate,
          });
        }
      } catch (err) {
        console.warn('Failed to load post analytics:', err);
      } finally {
        if (active) setLoading(false);
      }
    };

    fetchPostData();
    return () => {
      active = false;
    };
  }, [postId]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#03071B] text-gray-900 dark:text-white p-4 sm:p-8">
      <div className="max-w-5xl mx-auto space-y-6">
        
        {/* Navigation & Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate(-1)}
              className="p-2.5 rounded-xl border border-gray-200 dark:border-gray-800 hover:bg-gray-100 dark:hover:bg-gray-800 transition-all text-gray-600 dark:text-gray-300"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Post Analytics</h1>
              <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                Performance insights for post <span className="font-mono text-violet-500">{postId}</span>
              </p>
            </div>
          </div>
        </div>

        {/* Post Preview Summary */}
        {post && (
          <div className="p-4 sm:p-6 rounded-2xl bg-white dark:bg-[#080F2E] border border-gray-200/80 dark:border-gray-800 shadow-sm flex items-start gap-4">
            {post.mediaUrl && (
              <img
                src={post.mediaUrl}
                alt="Post media"
                className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl object-cover flex-shrink-0"
              />
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm line-clamp-2 text-gray-800 dark:text-gray-200">
                {post.content || post.text || post.caption || 'No text content'}
              </p>
              <div className="mt-2 text-xs text-gray-500 flex items-center gap-4">
                <span>Created: {post.createdAt?.toDate ? post.createdAt.toDate().toLocaleDateString() : 'Recent'}</span>
              </div>
            </div>
          </div>
        )}

        {/* High-level KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-5 rounded-2xl bg-white dark:bg-[#080F2E] border border-gray-200/80 dark:border-gray-800 shadow-sm space-y-2">
            <div className="flex items-center justify-between text-gray-500 dark:text-gray-400">
              <span className="text-xs font-medium uppercase tracking-wider">Views</span>
              <Eye className="w-4 h-4 text-violet-500" />
            </div>
            <div className="text-2xl font-bold">{metrics.views.toLocaleString()}</div>
          </div>

          <div className="p-5 rounded-2xl bg-white dark:bg-[#080F2E] border border-gray-200/80 dark:border-gray-800 shadow-sm space-y-2">
            <div className="flex items-center justify-between text-gray-500 dark:text-gray-400">
              <span className="text-xs font-medium uppercase tracking-wider">Likes</span>
              <Heart className="w-4 h-4 text-rose-500" />
            </div>
            <div className="text-2xl font-bold">{metrics.likes.toLocaleString()}</div>
          </div>

          <div className="p-5 rounded-2xl bg-white dark:bg-[#080F2E] border border-gray-200/80 dark:border-gray-800 shadow-sm space-y-2">
            <div className="flex items-center justify-between text-gray-500 dark:text-gray-400">
              <span className="text-xs font-medium uppercase tracking-wider">Comments</span>
              <MessageCircle className="w-4 h-4 text-blue-500" />
            </div>
            <div className="text-2xl font-bold">{metrics.comments.toLocaleString()}</div>
          </div>

          <div className="p-5 rounded-2xl bg-white dark:bg-[#080F2E] border border-gray-200/80 dark:border-gray-800 shadow-sm space-y-2">
            <div className="flex items-center justify-between text-gray-500 dark:text-gray-400">
              <span className="text-xs font-medium uppercase tracking-wider">Engagement</span>
              <TrendingUp className="w-4 h-4 text-emerald-500" />
            </div>
            <div className="text-2xl font-bold">{metrics.engagementRate}%</div>
          </div>
        </div>

        {/* Detailed Breakdown */}
        <div className="p-6 rounded-2xl bg-white dark:bg-[#080F2E] border border-gray-200/80 dark:border-gray-800 shadow-sm space-y-4">
          <h2 className="text-base font-semibold flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-violet-500" />
            Audience Interaction Breakdown
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
            <div className="p-4 rounded-xl bg-gray-50 dark:bg-[#04081D] border border-gray-100 dark:border-gray-800/60 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Share2 className="w-4 h-4 text-cyan-500" />
                <span className="text-sm font-medium">Shares</span>
              </div>
              <span className="font-bold text-sm">{metrics.shares.toLocaleString()}</span>
            </div>

            <div className="p-4 rounded-xl bg-gray-50 dark:bg-[#04081D] border border-gray-100 dark:border-gray-800/60 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Bookmark className="w-4 h-4 text-amber-500" />
                <span className="text-sm font-medium">Saves / Bookmarks</span>
              </div>
              <span className="font-bold text-sm">{metrics.saves.toLocaleString()}</span>
            </div>

            <div className="p-4 rounded-xl bg-gray-50 dark:bg-[#04081D] border border-gray-100 dark:border-gray-800/60 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Sparkles className="w-4 h-4 text-purple-500" />
                <span className="text-sm font-medium">Virality Score</span>
              </div>
              <span className="font-bold text-sm">
                {metrics.views > 1000 ? 'High' : metrics.views > 100 ? 'Medium' : 'Normal'}
              </span>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
