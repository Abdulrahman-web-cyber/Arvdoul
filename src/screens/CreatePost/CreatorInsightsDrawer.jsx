// src/screens/CreatePost/CreatorInsightsDrawer.jsx
import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import * as Icons from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import LoadingSpinner from '../../components/Shared/LoadingSpinner.jsx';
import { getFirestoreService } from '../../services/firestoreService.js';
import { SURFACE_GLASS_CLASS } from './createPostConstants.js';

export default function CreatorInsightsDrawer({
  scheduledDrafts = [],
  onEditScheduledDraft,
  activeTab = 'analytics',
  onClose,
}) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [analyticsData, setAnalyticsData] = useState(null);
  const [recentPostsData, setRecentPostsData] = useState([]);
  const [serverScheduledPosts, setServerScheduledPosts] = useState([]);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);
  const [loadingScheduled, setLoadingScheduled] = useState(false);

  // Reset per-account caches whenever the authenticated UID changes.
  useEffect(() => {
    setAnalyticsData(null);
    setRecentPostsData([]);
    setServerScheduledPosts([]);
  }, [user?.uid]);

  const loadAnalyticsData = useCallback(async () => {
    if (!user?.uid) return;
    setLoadingAnalytics(true);
    try {
      const { default: analyticsService } = await import('../../services/analyticsService.js');
      const data = await analyticsService.getUserAnalytics(user.uid);
      setAnalyticsData(data);

      const fsService = getFirestoreService();
      if (fsService && typeof fsService.getUserPosts === 'function') {
        const postsRes = await fsService
          .getUserPosts(user.uid, { limit: 4 })
          .catch((e) => {
            console.warn('[CreatorInsightsDrawer] Recent posts fetch failed:', e?.message);
            return null;
          });
        if (postsRes?.posts) {
          setRecentPostsData(postsRes.posts);
        }
      }
    } catch (err) {
      console.warn('[CreatorInsightsDrawer] Analytics unavailable:', err?.message);
    } finally {
      setLoadingAnalytics(false);
    }
  }, [user?.uid]);

  const loadScheduledPosts = useCallback(async () => {
    if (!user?.uid) return;
    setLoadingScheduled(true);
    try {
      const fsService = getFirestoreService();
      if (fsService && typeof fsService.getScheduledPosts === 'function') {
        const res = await fsService.getScheduledPosts(user.uid, 20);
        if (Array.isArray(res?.posts)) {
          setServerScheduledPosts(res.posts);
        }
      }
    } catch (err) {
      console.warn('[CreatorInsightsDrawer] Scheduled posts fetch failed:', err?.message);
    } finally {
      setLoadingScheduled(false);
    }
  }, [user?.uid]);

  useEffect(() => {
    if (activeTab === 'analytics' && user?.uid && !analyticsData) {
      loadAnalyticsData();
    } else if (activeTab === 'schedule' && user?.uid) {
      loadScheduledPosts();
    }
  }, [activeTab, user?.uid, analyticsData, loadAnalyticsData, loadScheduledPosts]);

  if (activeTab === 'schedule') {
    const combinedEmpty = serverScheduledPosts.length === 0 && scheduledDrafts.length === 0;
    return (
      <div className={`${SURFACE_GLASS_CLASS} p-5 space-y-4`}>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <span className="w-8 h-8 rounded-xl bg-arvdoul-purple/12 text-arvdoul-purple flex items-center justify-center">
              <Icons.Calendar className="w-4 h-4" />
            </span>
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                Scheduled Queue
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Upcoming queued releases
              </p>
            </div>
          </div>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close schedule panel"
              className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
            >
              <Icons.X className="w-4 h-4" />
            </button>
          )}
        </div>

        {loadingScheduled ? (
          <div className="flex items-center justify-center py-8 gap-2 text-xs text-slate-400">
            <LoadingSpinner size="sm" />
            <span>Loading scheduled posts...</span>
          </div>
        ) : combinedEmpty ? (
          <p className="text-xs text-slate-500 dark:text-slate-400 py-4 text-center">
            No scheduled posts yet.
          </p>
        ) : (
          <div className="space-y-2 max-h-72 overflow-y-auto">
            {serverScheduledPosts.map((post) => (
              <div
                key={`srv-${post.id}`}
                className="flex items-center justify-between gap-3 p-3 rounded-xl bg-slate-100/70 dark:bg-white/[0.04] border border-slate-200/60 dark:border-white/10"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                    <span className="capitalize font-semibold text-arvdoul-purple">
                      {post.type || 'post'}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>
                      {post.scheduledTime
                        ? new Date(
                            post.scheduledTime?.toDate?.() || post.scheduledTime
                          ).toLocaleString()
                        : 'Pending'}
                    </span>
                  </div>
                  <p className="text-sm text-slate-800 dark:text-slate-100 truncate mt-0.5">
                    {post.content?.slice(0, 60) || 'Scheduled post'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => navigate(`/edit/${post.id}`)}
                  className="min-h-[36px] px-3 py-1.5 text-xs font-semibold rounded-xl bg-arvdoul-purple text-white hover:opacity-90 transition-opacity shrink-0"
                >
                  Edit
                </button>
              </div>
            ))}

            {scheduledDrafts.map((draft) => (
              <div
                key={`dft-${draft.id}`}
                className="flex items-center justify-between gap-3 p-3 rounded-xl bg-slate-100/70 dark:bg-white/[0.04] border border-slate-200/60 dark:border-white/10"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                    <span className="capitalize font-semibold text-arvdoul-purple">
                      {draft.postType}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>Draft</span>
                    <span aria-hidden="true">·</span>
                    <span>{new Date(draft.data.scheduledTime).toLocaleString()}</span>
                  </div>
                  <p className="text-sm text-slate-800 dark:text-slate-100 truncate mt-0.5">
                    {draft.data?.content?.slice(0, 60) || 'Untitled'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onEditScheduledDraft?.(draft)}
                  className="min-h-[36px] px-3 py-1.5 text-xs font-semibold rounded-xl border border-slate-300 dark:border-white/15 text-slate-800 dark:text-white hover:bg-slate-200/60 dark:hover:bg-white/10 transition-colors shrink-0"
                >
                  Resume
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={`${SURFACE_GLASS_CLASS} p-5 space-y-4`}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <span className="w-8 h-8 rounded-xl bg-arvdoul-purple/12 text-arvdoul-purple flex items-center justify-center">
            <Icons.BarChart3 className="w-4 h-4" />
          </span>
          <div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
              Creator Insights
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Account reach and post performance
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={loadAnalyticsData}
            disabled={loadingAnalytics}
            aria-label="Refresh analytics"
            title="Refresh analytics"
            className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl text-slate-500 hover:text-arvdoul-purple hover:bg-arvdoul-purple/10 transition-colors disabled:opacity-50"
          >
            <Icons.RefreshCw className={`w-4 h-4 ${loadingAnalytics ? 'animate-spin' : ''}`} />
          </button>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close insights panel"
              className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
            >
              <Icons.X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {!user ? (
        <div className="text-center py-6 text-sm text-slate-500 dark:text-slate-400">
          Please sign in to view your post analytics.
        </div>
      ) : loadingAnalytics ? (
        <div className="flex flex-col items-center justify-center py-8 gap-2">
          <LoadingSpinner size="sm" />
          <p className="text-xs text-slate-400">Loading creator metrics...</p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 tabular-nums">
            <div className="p-3 rounded-xl bg-slate-100/80 dark:bg-white/[0.04] border border-slate-200/70 dark:border-white/8">
              <p className="text-[11px] text-slate-500 dark:text-slate-400">Total Views</p>
              <p className="text-base font-bold text-slate-900 dark:text-white mt-0.5">
                {analyticsData?.totalViews ?? '—'}
              </p>
            </div>
            <div className="p-3 rounded-xl bg-slate-100/80 dark:bg-white/[0.04] border border-slate-200/70 dark:border-white/8">
              <p className="text-[11px] text-slate-500 dark:text-slate-400">Total Reach</p>
              <p className="text-base font-bold text-slate-900 dark:text-white mt-0.5">
                {analyticsData?.totalReach ?? '—'}
              </p>
            </div>
            <div className="p-3 rounded-xl bg-slate-100/80 dark:bg-white/[0.04] border border-slate-200/70 dark:border-white/8">
              <p className="text-[11px] text-slate-500 dark:text-slate-400">Engagement</p>
              <p className="text-base font-bold text-slate-900 dark:text-white mt-0.5">
                {analyticsData?.totalEngagement ?? '—'}
              </p>
            </div>
            <div className="p-3 rounded-xl bg-slate-100/80 dark:bg-white/[0.04] border border-slate-200/70 dark:border-white/8">
              <p className="text-[11px] text-slate-500 dark:text-slate-400">Coins Earned</p>
              <p className="text-base font-bold text-slate-900 dark:text-white mt-0.5">
                {analyticsData?.coinsEarned ?? '—'}
              </p>
            </div>
          </div>

          <div className="px-3.5 py-2.5 rounded-xl bg-slate-100/70 dark:bg-white/[0.04] flex items-center justify-between text-xs tabular-nums">
            <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
              <Icons.TrendingUp className="w-4 h-4 text-arvdoul-purple" aria-hidden="true" />
              <span>Engagement Change</span>
            </div>
            <span className="font-semibold text-slate-900 dark:text-white">
              {typeof analyticsData?.changes?.engagement === 'number'
                ? `${analyticsData.changes.engagement >= 0 ? '+' : ''}${Math.round(
                    analyticsData.changes.engagement
                  )}% this week`
                : 'Unavailable'}
            </span>
          </div>

          {recentPostsData && recentPostsData.length > 0 && (
            <div className="pt-2 border-t border-slate-200/70 dark:border-white/10 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                  Recent Posts
                </p>
                <button
                  type="button"
                  onClick={() => navigate('/profile/analytics')}
                  className="text-xs font-semibold text-arvdoul-purple hover:underline flex items-center gap-1"
                >
                  <span>Full Studio</span>
                  <Icons.ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="space-y-1.5">
                {recentPostsData.slice(0, 4).map((post, idx) => (
                  <button
                    key={post.id || idx}
                    type="button"
                    onClick={() => post.id && navigate(`/post/${post.id}/analytics`)}
                    className="w-full flex items-center justify-between gap-3 p-2.5 rounded-xl bg-slate-100/60 dark:bg-white/[0.04] text-xs hover:bg-arvdoul-purple/10 transition-colors text-left"
                  >
                    <span className="truncate font-medium text-slate-800 dark:text-slate-100">
                      {post.content || post.title || 'Untitled Post'}
                    </span>
                    <div className="flex items-center gap-2.5 text-slate-500 dark:text-slate-400 shrink-0 tabular-nums">
                      <span className="inline-flex items-center gap-1">
                        <Icons.Heart className="w-3 h-3" aria-hidden="true" />
                        {typeof (post.stats?.likes ?? post.likeCount) === 'number'
                          ? post.stats?.likes ?? post.likeCount
                          : '—'}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Icons.MessageCircle className="w-3 h-3" aria-hidden="true" />
                        {typeof (post.stats?.comments ?? post.commentCount) === 'number'
                          ? post.stats?.comments ?? post.commentCount
                          : '—'}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Icons.Eye className="w-3 h-3" aria-hidden="true" />
                        {typeof (post.stats?.views ?? post.viewCount) === 'number'
                          ? post.stats?.views ?? post.viewCount
                          : '—'}
                      </span>
                      <Icons.ChevronRight className="w-3.5 h-3.5 text-slate-400" aria-hidden="true" />
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
