// src/screens/VideosScreen.jsx
//
// Futuristic TikTok & Reels style immersive video ecosystem

import React, { useState, useEffect, useCallback, memo } from "react";
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Video, Play, Smartphone, Flame, Search, Camera, Sparkles } from "lucide-react";
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useVideoStore } from '../store/videoStore';
import { VideoFeed } from '../components/Videos';
import videoService from '../services/videoService';
import { toast } from 'sonner';
import EmptyState from '../design-system/EmptyState.jsx';
import ErrorState from '../design-system/ErrorState.jsx';
import Button from '../design-system/Button.jsx';
import { RouteProgressBar } from '../components/Navigation/RouteProgressBar';
import { LazyImage } from '../components/Shared/LazyImage';

/**
 * VideosScreen - World-Class video feed & discovery grid
 */
const VideosScreen = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialTab = searchParams.get('tab') || 'sparks';

  const { theme, isDark, spring, gradient } = useTheme();
  const { user } = useAuth();
  const {
    videos,
    setVideos,
    appendVideos,
    loading,
    setLoading,
    loadingMore,
    setLoadingMore,
    hasMore,
    setHasMore,
    nextCursor,
    setNextCursor,
    feedType,
    setFeedType,
    currentIndex,
    setCurrentIndex,
    updateVideo,
    addToWatchLater,
  } = useVideoStore();

  const [error, setError] = useState(null);
  const [viewMode, setViewMode] = useState('feed'); // 'feed' | 'grid'
  const [backgroundRefreshing, setBackgroundRefreshing] = useState(false);

  // Sync the feed type from the URL. The tab bar highlights `feedType`, so a
  // visit to /videos with no `tab` used to load the "sparks" feed while
  // highlighting the store's stale "for_you" tab.
  useEffect(() => {
    if (initialTab !== feedType) setFeedType(initialTab);
  }, [initialTab, setFeedType, feedType]);

  // Load videos from service (non-blocking background sync if videos already cached)
  const loadVideos = useCallback(async (type = feedType) => {
    if (!videos || videos.length === 0) {
      setLoading(true);
    } else {
      setBackgroundRefreshing(true);
    }
    setError(null);

    try {
      const result = await videoService.getVideoFeed(user?.uid ?? null, {
        feedType: type,
        limit: 20,
      });

      const feed = result?.feed || result?.videos || [];
      if (Array.isArray(feed) && feed.length > 0) {
        setVideos(feed);
        setHasMore(result.hasMore || false);
        setNextCursor(result.nextCursor || null);
      } else if (!videos || videos.length === 0) {
        setVideos([]);
        setHasMore(false);
      }
    } catch (err) {
      console.error('Failed to load videos:', err);
      if (!videos || videos.length === 0) {
        setError(err?.message || 'Could not load videos.');
      }
    } finally {
      setLoading(false);
      setBackgroundRefreshing(false);
    }
  }, [feedType, videos, user?.uid, setVideos, setLoading, setHasMore, setNextCursor]);

  // Load more pagination
  const loadMoreVideos = useCallback(async () => {
    if (loadingMore || !hasMore || !nextCursor) return;

    setLoadingMore(true);

    try {
      const result = await videoService.getVideoFeed(user?.uid ?? null, {
        feedType,
        cursor: nextCursor,
        limit: 20,
      });

      const feed = result?.feed || result?.videos || [];
      if (Array.isArray(feed) && feed.length > 0) {
        appendVideos(feed);
        setHasMore(result.hasMore || false);
        setNextCursor(result.nextCursor || null);
      }
    } catch (err) {
      console.error('Failed to load more videos:', err);
      toast.error('Failed to load more videos');
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, hasMore, nextCursor, feedType, user?.uid, appendVideos, setLoadingMore, setHasMore, setNextCursor]);

  // Tab change handler
  const handleTabChange = useCallback((newTab) => {
    setFeedType(newTab);
    loadVideos(newTab);
  }, [setFeedType, loadVideos]);

  // Refresh
  const handleRefresh = useCallback(() => {
    loadVideos(feedType);
  }, [loadVideos, feedType]);

  // Initial load & URL tab sync
  useEffect(() => {
    if (videos.length === 0) {
      loadVideos(initialTab || feedType);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialTab]);

  return (
    <div
      className="h-full w-full overflow-hidden relative"
      style={{
        background: isDark ? '#03071B' : '#F6F8FC',
      }}
    >
      {/* Background sync progress bar */}
      <AnimatePresence>
        {backgroundRefreshing && (
          <RouteProgressBar isAnimating={true} />
        )}
      </AnimatePresence>

      {/* Main View Display */}
      {viewMode === 'feed' ? (
        <VideoFeed
          videos={videos}
          loading={loading}
          error={error}
          onLoadMore={loadMoreVideos}
          onRefresh={handleRefresh}
          hasMore={hasMore}
          feedType={feedType}
          onFeedTypeChange={handleTabChange}
          onOpenSearch={() => navigate('/search')}
          onCreateVideo={() => navigate('/create-post')}
          viewMode={viewMode}
          onToggleViewMode={() => setViewMode('grid')}
          onOpenReels={() => navigate('/reels')}
        />
      ) : (
        /* Discovery 4K Grid View */
        <GridView
          videos={videos}
          loading={loading}
          error={error}
          onRefresh={handleRefresh}
          feedType={feedType}
          onFeedTypeChange={handleTabChange}
          onSwitchToFeed={() => setViewMode('feed')}
          onOpenReels={() => navigate('/reels')}
          onOpenSearch={() => navigate('/search')}
          onVideoClick={(video, index) => {
            setCurrentIndex(index);
            setViewMode('feed');
          }}
          onCreateVideo={() => navigate('/create-post')}
        />
      )}
    </div>
  );
};

/**
 * GridView - Curated 4K Discovery Video Grid
 */
const GridView = memo(({
  videos = [],
  loading = false,
  error = null,
  onRefresh,
  feedType,
  onFeedTypeChange,
  onSwitchToFeed,
  onOpenReels,
  onOpenSearch,
  onVideoClick,
  onCreateVideo,
}) => {
  const { isDark, spring } = useTheme();

  if (error && videos.length === 0) {
    return (
      <div className="h-full flex items-center justify-center p-8">
        <ErrorState
          title="Failed to load videos"
          message={error}
          onRetry={onRefresh}
        />
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto pt-4 sm:pt-6 pb-28 px-4 sm:px-6 max-w-7xl mx-auto select-none">
      {/* Grid Header */}
      <div className="flex flex-col gap-4 mb-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className={`text-2xl sm:text-3xl font-black tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
              Explore Videos
            </h1>
            <p className={`text-sm mt-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
              Discover trending visual creators and original soundscapes
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={onSwitchToFeed}
              className={`min-h-[44px] px-3.5 py-2 rounded-xl text-xs font-bold border flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 ${
                isDark
                  ? 'bg-[#080E27] border-white/10 text-white hover:bg-white/10'
                  : 'bg-white border-slate-200 text-slate-800 hover:bg-slate-50 shadow-sm'
              }`}
            >
              <Smartphone className="w-4 h-4 text-purple-400" />
              <span>Sparks Feed</span>
            </button>

            <button
              type="button"
              onClick={onOpenReels}
              className={`min-h-[44px] px-3.5 py-2 rounded-xl text-xs font-bold border flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 ${
                isDark
                  ? 'bg-pink-500/15 border-pink-500/30 text-pink-300 hover:bg-pink-500/25'
                  : 'bg-pink-50 border-pink-200 text-pink-700 hover:bg-pink-100'
              }`}
            >
              <Flame className="w-4 h-4 text-pink-500" />
              <span>Reels</span>
            </button>

            <button
              type="button"
              onClick={onOpenSearch}
              aria-label="Search Videos"
              className={`min-h-[44px] min-w-[44px] rounded-xl border flex items-center justify-center transition-colors shrink-0 ${
                isDark
                  ? 'bg-[#080E27] border-white/10 text-white hover:bg-white/10'
                  : 'bg-white border-slate-200 text-slate-800 hover:bg-slate-50 shadow-sm'
              }`}
            >
              <Search className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={onCreateVideo}
              aria-label="Create Video"
              className="min-h-[44px] min-w-[44px] px-3 rounded-xl bg-arvdoul-gradient text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-md hover:brightness-110 transition-all shrink-0"
            >
              <Camera className="w-4 h-4" />
              <span className="hidden sm:inline">Create</span>
            </button>
          </div>
        </div>

        {/* Tab Filters */}
        <div className="flex items-center gap-1.5 p-1 rounded-2xl w-fit max-w-full overflow-x-auto bg-slate-200/80 dark:bg-white/5 border border-slate-200 dark:border-white/10 backdrop-blur-xl">
          {[
            { id: 'sparks', label: 'Sparks', icon: Sparkles },
            { id: 'for_you', label: 'For You' },
            { id: 'trending', label: 'Trending' },
            { id: 'following', label: 'Following' },
          ].map(tab => {
            const TabIcon = tab.icon;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => onFeedTypeChange?.(tab.id)}
                className={`min-h-[40px] px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
                  feedType === tab.id
                    ? 'bg-arvdoul-gradient text-white shadow-md'
                    : isDark ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {TabIcon && <TabIcon className="w-3.5 h-3.5" aria-hidden="true" />}
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Grid Items */}
      {videos.length === 0 && !loading ? (
        <EmptyState
          icon={Video}
          title="No videos found"
          description="Be the first to upload and share your video story!"
          action={
            <Button variant="primary" onClick={onCreateVideo}>
              Create Video
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4">
          {videos.map((video, index) => (
            <motion.button
              key={video.id}
              type="button"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...spring.card, delay: Math.min(index * 0.03, 0.3) }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => onVideoClick(video, index)}
              className="w-full text-left relative aspect-[9/16] rounded-3xl overflow-hidden group cursor-pointer shadow-xl border border-black/10 dark:border-white/10 bg-[#080E27] focus:outline-none focus:ring-2 focus:ring-arvdoul-purple"
            >
              <LazyImage
                src={video.thumbnailUrl || video.thumbnail || '/assets/default-profile.png'}
                alt={video.title || 'Video'}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                loading="lazy"
              />

              {/* Gradient Vignette */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />

              {/* Quality & Real Duration Badges */}
              {(video.quality || video.duration) && (
                <div className="absolute top-3 left-3 right-3 flex items-center justify-between gap-2 z-10">
                  {video.quality ? (
                    <span className="px-2 py-0.5 rounded-full bg-black/60 backdrop-blur-md text-[10px] font-black text-cyan-300 border border-white/10 uppercase">
                      {video.quality}
                    </span>
                  ) : <span />}
                  {video.duration ? (
                    <span className="px-2 py-0.5 rounded-full bg-black/60 backdrop-blur-md text-[10px] font-bold text-white/90 border border-white/10 font-mono tabular-nums">
                      {video.duration}s
                    </span>
                  ) : null}
                </div>
              )}

              {/* Play Button Icon on Hover */}
              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10">
                <div className="w-12 h-12 rounded-full bg-white/30 backdrop-blur-xl border border-white/40 flex items-center justify-center shadow-xl">
                  <Play className="w-6 h-6 text-white fill-white translate-x-0.5" />
                </div>
              </div>

              {/* Bottom Creator & Video Title Details */}
              <div className="absolute bottom-3 left-3 right-3 z-10 flex flex-col gap-1">
                <div className="flex items-center gap-1.5">
                  <LazyImage
                    src={video.creator?.avatar || '/assets/default-profile.png'}
                    alt={video.creator?.name || 'Creator'}
                    className="w-5 h-5 rounded-full object-cover ring-1 ring-white/40"
                  />
                  {(video.creator?.username || video.creator?.name) && (
                    <span className="text-white text-xs font-bold truncate drop-shadow-md">
                      {video.creator?.username ? `@${video.creator.username}` : video.creator.name}
                    </span>
                  )}
                </div>

                {(video.title || video.description) && (
                  <p className="text-white/90 text-xs font-semibold line-clamp-1 drop-shadow-md">
                    {video.title || video.description}
                  </p>
                )}

                <div className="flex items-center gap-2 text-[11px] text-white/75 font-medium tabular-nums">
                  <span>{video.likesFormatted || (video.likes == null ? '—' : video.likes.toLocaleString())} likes</span>
                  <span aria-hidden="true">·</span>
                  <span>{video.views == null ? '—' : video.views.toLocaleString()} views</span>
                </div>
              </div>
            </motion.button>
          ))}
        </div>
      )}
    </div>
  );
});

GridView.displayName = 'GridView';

export default React.memo(VideosScreen);
