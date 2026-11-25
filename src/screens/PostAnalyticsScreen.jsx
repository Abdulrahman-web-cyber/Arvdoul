// src/screens/PostAnalyticsScreen.jsx

import { useState, useEffect } from "react";
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Eye, Heart, MessageCircle, Share2, TrendingUp, BarChart3, Bookmark, Sparkles, Gift, Clock, Film, Megaphone, Coins, ExternalLink } from "lucide-react";
import { Loader2, AlertTriangle } from 'lucide-react';
import { useLayoutChrome } from '../context/LayoutChromeContext.jsx';
import { formatWatchTime } from '../utils/videoUtils';
import { LazyImage } from '../components/Shared/LazyImage';
import postAnalyticsService from '../services/postAnalyticsService.js';

export default function PostAnalyticsScreen() {
  const { postId } = useParams();
  const navigate = useNavigate();
  const { hasTopAppBar } = useLayoutChrome();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [post, setPost] = useState(null);
  const [separated, setSeparated] = useState(null);
  const [metrics, setMetrics] = useState({
    views: null,
    likes: null,
    comments: null,
    shares: null,
    saves: null,
    gifts: null,
    watchTime: null,
    engagementRate: null,
    trendingScore: null,
  });

  useEffect(() => {
    let active = true;
    const fetchPostData = async () => {
      if (!postId) return;
      setLoading(true);
      try {
        const [{ default: postService }, sepRes] = await Promise.all([
          import('../services/postService.js'),
          postAnalyticsService.getPostSeparatedAnalytics(postId).catch((err) => {
            console.warn('Separated post analytics unavailable:', err?.message);
            return null;
          }),
        ]);
        const postDoc = await postService.getPost(postId);
        if (!active) return;
        if (sepRes?.success) {
          setSeparated(sepRes);
        }
        if (!postDoc) {
          setLoadError('This post could not be found, or you do not have access to its analytics.');
          return;
        }
        if (postDoc) {
          setPost(postDoc);
          const stat = (value) => (typeof value === 'number' ? value : null);
          let views = null;
          try {
            const { countersManager } = await import('../utils/CountersManager.js');
            views = await countersManager.get({
              docPath: `posts/${postId}`,
              field: 'views',
              fallback: stat(postDoc.stats?.views) ?? 0,
            });
          } catch {
            views = stat(postDoc.stats?.views);
          }
          const likes = stat(postDoc.stats?.likes ?? postDoc.likesCount);
          const comments = stat(postDoc.stats?.comments ?? postDoc.commentsCount);
          const shares = stat(postDoc.stats?.shares ?? postDoc.sharesCount);
          const saves = stat(postDoc.stats?.saves ?? postDoc.savesCount);
          const gifts = stat(postDoc.stats?.gifts ?? postDoc.giftsCount);
          const watchTime = stat(postDoc.stats?.totalWatchTime ?? postDoc.stats?.watchTime ?? postDoc.totalWatchTime);
          const known = [likes, comments, shares, saves];
          const totalEngagements = known.some((v) => v === null)
            ? null
            : known.reduce((sum, v) => sum + v, 0);
          const engagementRate = views && totalEngagements !== null
            ? ((totalEngagements / views) * 100).toFixed(1)
            : null;

          const trendingScore = stat(postDoc.trendingScore);

          setMetrics({ views, likes, comments, shares, saves, gifts, watchTime, engagementRate, trendingScore });
        }
      } catch (err) {
        console.warn('Failed to load post analytics:', err);
        if (active) setLoadError(err?.message || 'Could not load analytics for this post.');
      } finally {
        if (active) setLoading(false);
      }
    };

    fetchPostData();
    return () => {
      active = false;
    };
  }, [postId]);

  const show = (value, suffix = '') => (value == null ? '—' : `${value.toLocaleString()}${suffix}`);
  const isVideoPost = Boolean(
    post && (post.type === 'video' || post.type === 'reel' || post.type === 'spark' || post.muxPlaybackId || post.videoUrl)
  );
  const previewThumb =
    post?.thumbnailUrl ||
    post?.media?.[0]?.thumbnailUrl ||
    (post?.muxPlaybackId ? `https://image.mux.com/${post.muxPlaybackId}/thumbnail.jpg` : null) ||
    post?.mediaUrl ||
    null;

  return (
    <div className="min-h-screen bg-[#F6F8FC] dark:bg-[#03071B] text-slate-900 dark:text-white p-4 sm:p-8 pb-24">
      <div className="max-w-5xl mx-auto space-y-6">

        {/* Navigation & Header */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          {!hasTopAppBar ? (
            <div className="flex items-center gap-3">
              <button
                type="button"
                aria-label="Go back"
                onClick={() => navigate(-1)}
                className="p-2.5 rounded-xl border border-slate-200 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/10 transition-all text-slate-600 dark:text-slate-300"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <h1 className="text-2xl font-bold tracking-tight">Post Analytics</h1>
                <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                  Performance insights for post <span className="font-mono text-violet-500">{postId}</span>
                </p>
              </div>
            </div>
          ) : (
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
              Insights for <span className="font-mono text-violet-500">{postId}</span>
            </p>
          )}

          <div className="flex flex-wrap items-center gap-2">
            {post && (
              <button
                type="button"
                onClick={() => navigate(isVideoPost ? `/sparks/${postId}` : `/post/${postId}`)}
                className="px-3 py-2 rounded-xl text-xs font-semibold border border-slate-200 dark:border-white/10 bg-white dark:bg-white/[0.06] hover:bg-slate-50 dark:hover:bg-white/10 transition-colors flex items-center gap-1.5"
              >
                <Film className="w-3.5 h-3.5 text-purple-500" />
                {isVideoPost ? 'Open Spark' : 'Open Post'}
              </button>
            )}
            <button
              type="button"
              onClick={() => navigate('/video-analytics')}
              className="px-3 py-2 rounded-xl text-xs font-semibold border border-slate-200 dark:border-white/10 bg-white dark:bg-white/[0.06] hover:bg-slate-50 dark:hover:bg-white/10 transition-colors flex items-center gap-1.5"
            >
              <Sparkles className="w-3.5 h-3.5 text-blue-500" />
              Sparks Studio
            </button>
            <button
              type="button"
              onClick={() => navigate('/profile/analytics')}
              className="px-3 py-2 rounded-xl text-xs font-semibold border border-slate-200 dark:border-white/10 bg-white dark:bg-white/[0.06] hover:bg-slate-50 dark:hover:bg-white/10 transition-colors flex items-center gap-1.5"
            >
              <BarChart3 className="w-3.5 h-3.5 text-emerald-500" />
              Creator Dashboard
            </button>
          </div>
        </div>

        {loading && (
          <div className="flex items-center justify-center py-16 text-slate-500 dark:text-slate-400">
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
        )}

        {!loading && loadError && (
          <div className="p-6 rounded-2xl bg-white dark:bg-white/[0.05] border border-slate-200/80 dark:border-white/10 shadow-sm flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-500" />
            <p className="text-sm text-slate-700 dark:text-slate-300">{loadError}</p>
          </div>
        )}

        {/* Post Preview Summary */}
        {post && (
          <div className="p-4 sm:p-6 rounded-2xl bg-white dark:bg-white/[0.05] border border-slate-200/80 dark:border-white/10 shadow-sm flex items-start gap-4">
            {previewThumb && (
              <LazyImage
                src={previewThumb}
                alt="Post media"
                className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl object-cover flex-shrink-0"
              />
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm line-clamp-2 text-slate-800 dark:text-slate-200">
                {post.title || post.content || post.text || post.caption || 'No text content'}
              </p>
              <div className="mt-2 text-xs text-slate-500 dark:text-slate-400 flex items-center gap-4">
                <span>Created: {post.createdAt?.toDate ? post.createdAt.toDate().toLocaleDateString() : '—'}</span>
                {isVideoPost && <span className="font-semibold text-purple-500">Spark</span>}
              </div>
            </div>
          </div>
        )}

        {/* High-level KPI Cards */}
        {!loadError && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-5 rounded-2xl bg-white dark:bg-white/[0.05] border border-slate-200/80 dark:border-white/10 shadow-sm space-y-2">
              <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
                <span className="text-xs font-medium uppercase tracking-wider">Views</span>
                <Eye className="w-4 h-4 text-violet-500" />
              </div>
              <div className="text-2xl font-bold tabular-nums">{show(metrics.views)}</div>
            </div>

            <div className="p-5 rounded-2xl bg-white dark:bg-white/[0.05] border border-slate-200/80 dark:border-white/10 shadow-sm space-y-2">
              <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
                <span className="text-xs font-medium uppercase tracking-wider">Likes</span>
                <Heart className="w-4 h-4 text-rose-500" />
              </div>
              <div className="text-2xl font-bold tabular-nums">{show(metrics.likes)}</div>
            </div>

            <div className="p-5 rounded-2xl bg-white dark:bg-white/[0.05] border border-slate-200/80 dark:border-white/10 shadow-sm space-y-2">
              <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
                <span className="text-xs font-medium uppercase tracking-wider">Comments</span>
                <MessageCircle className="w-4 h-4 text-blue-500" />
              </div>
              <div className="text-2xl font-bold tabular-nums">{show(metrics.comments)}</div>
            </div>

            <div className="p-5 rounded-2xl bg-white dark:bg-white/[0.05] border border-slate-200/80 dark:border-white/10 shadow-sm space-y-2">
              <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
                <span className="text-xs font-medium uppercase tracking-wider">Engagement</span>
                <TrendingUp className="w-4 h-4 text-emerald-500" />
              </div>
              <div className="text-2xl font-bold tabular-nums">{show(metrics.engagementRate, '%')}</div>
            </div>
          </div>
        )}

        {/* Detailed Breakdown */}
        {!loadError && (
          <div className="p-6 rounded-2xl bg-white dark:bg-white/[0.05] border border-slate-200/80 dark:border-white/10 shadow-sm space-y-4">
            <h2 className="text-base font-semibold flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-violet-500" />
              Audience Interaction Breakdown
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-white/[0.03] border border-slate-100 dark:border-white/10 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Share2 className="w-4 h-4 text-cyan-500" />
                  <span className="text-sm font-medium">Shares</span>
                </div>
                <span className="font-bold text-sm tabular-nums">{show(metrics.shares)}</span>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 dark:bg-white/[0.03] border border-slate-100 dark:border-white/10 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Bookmark className="w-4 h-4 text-amber-500" />
                  <span className="text-sm font-medium">Saves / Bookmarks</span>
                </div>
                <span className="font-bold text-sm tabular-nums">{show(metrics.saves)}</span>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 dark:bg-white/[0.03] border border-slate-100 dark:border-white/10 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Sparkles className="w-4 h-4 text-purple-500" />
                  <span className="text-sm font-medium">Trending Score</span>
                </div>
                <span className="font-bold text-sm tabular-nums">
                  {metrics.trendingScore == null ? 'Unavailable' : metrics.trendingScore.toFixed(2)}
                </span>
              </div>

              {(isVideoPost || metrics.gifts != null) && (
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-white/[0.03] border border-slate-100 dark:border-white/10 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Gift className="w-4 h-4 text-pink-500" />
                    <span className="text-sm font-medium">Gifts Received</span>
                  </div>
                  <span className="font-bold text-sm tabular-nums">{show(metrics.gifts)}</span>
                </div>
              )}

              {(isVideoPost || metrics.watchTime != null) && (
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-white/[0.03] border border-slate-100 dark:border-white/10 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Clock className="w-4 h-4 text-indigo-500" />
                    <span className="text-sm font-medium">Watch Time</span>
                  </div>
                  <span className="font-bold text-sm tabular-nums">
                    {metrics.watchTime == null ? '—' : formatWatchTime(metrics.watchTime)}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Separated Organic vs Paid & Creator Attribution */}
        {!loadError && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Paid Campaign Delivery */}
            <div className="p-6 rounded-2xl bg-white dark:bg-white/[0.05] border border-slate-200/80 dark:border-white/10 shadow-sm space-y-4">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-base font-semibold flex items-center gap-2">
                  <Megaphone className="w-4 h-4 text-blue-500" />
                  Paid Campaign Delivery
                </h2>
                <button
                  type="button"
                  onClick={() => navigate(`/ads/create?postId=${encodeURIComponent(postId)}`)}
                  className="text-xs font-semibold text-purple-500 hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <span>Promote</span>
                  <ExternalLink className="w-3 h-3" />
                </button>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                {[
                  ['Impressions', show(separated?.paid?.impressions)],
                  ['Unique Reach', show(separated?.paid?.reach)],
                  ['Clicks', show(separated?.paid?.clicks)],
                  ['CTR', separated?.paid?.ctr != null ? `${separated.paid.ctr}%` : '—'],
                  ['Spend', separated?.paid?.spendCents != null ? `$${(separated.paid.spendCents / 100).toFixed(2)}` : '—'],
                  ['Conversions', show(separated?.paid?.conversions)],
                  ['CPM', separated?.paid?.cpmCents != null ? `$${(separated.paid.cpmCents / 100).toFixed(2)}` : '—'],
                  ['CPC', separated?.paid?.cpcCents != null ? `$${(separated.paid.cpcCents / 100).toFixed(2)}` : '—'],
                  ['Boost Status', separated?.paid?.hasActiveBoost ? 'Active' : 'None'],
                ].map(([label, val]) => (
                  <div key={label} className="p-3 rounded-xl bg-slate-50 dark:bg-white/[0.03] border border-slate-100 dark:border-white/10">
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 block">{label}</span>
                    <span className="font-bold text-sm tabular-nums mt-0.5 block">{val}</span>
                  </div>
                ))}
              </div>
              {Array.isArray(separated?.paid?.campaigns) && separated.paid.campaigns.length > 0 && (
                <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-white/10">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Linked Campaigns
                  </p>
                  {separated.paid.campaigns.map((camp) => (
                    <button
                      type="button"
                      key={camp.id}
                      onClick={() => navigate(`/ads/analytics?campaignId=${encodeURIComponent(camp.id)}`)}
                      className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-white/[0.03] border border-slate-100 dark:border-white/10 flex items-center justify-between text-xs hover:border-purple-500/40 cursor-pointer"
                    >
                      <span className="font-semibold truncate">{camp.title || camp.id}</span>
                      <span className="text-purple-500 font-semibold shrink-0">{camp.status}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Creator Earnings Attribution */}
            <div className="p-6 rounded-2xl bg-white dark:bg-white/[0.05] border border-slate-200/80 dark:border-white/10 shadow-sm space-y-4">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-base font-semibold flex items-center gap-2">
                  <Coins className="w-4 h-4 text-amber-500" />
                  Creator Earnings Attribution
                </h2>
                <button
                  type="button"
                  onClick={() => navigate('/creator-payout')}
                  className="text-xs font-semibold text-purple-500 hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <span>Payouts</span>
                  <ExternalLink className="w-3 h-3" />
                </button>
              </div>
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-white/[0.03] border border-slate-100 dark:border-white/10 flex items-center justify-between">
                <span className="text-sm font-medium">Gift Value Attributed</span>
                <span className="font-bold text-base tabular-nums text-amber-500">
                  {separated?.creatorAttribution?.giftValueCoins == null ? '—' : `${separated.creatorAttribution.giftValueCoins.toLocaleString()} Coins`}
                </span>
              </div>
              {Array.isArray(separated?.creatorAttribution?.ledgerEntries) && separated.creatorAttribution.ledgerEntries.length > 0 ? (
                <div className="space-y-2">
                  {separated.creatorAttribution.ledgerEntries.map((entry) => (
                    <div key={entry.id} className="p-3 rounded-xl bg-slate-50 dark:bg-white/[0.03] border border-slate-100 dark:border-white/10 flex items-center justify-between text-xs">
                      <span className="font-medium capitalize">{(entry.source || entry.type || 'earning').replace(/_/g, ' ')}</span>
                      <span className="font-bold tabular-nums text-emerald-500">
                        {entry.amountCoins != null ? `+${entry.amountCoins} Coins` : entry.amountCents != null ? `+$${(entry.amountCents / 100).toFixed(2)}` : '—'}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  No direct creator ledger entries attributed to this post yet.
                </p>
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
