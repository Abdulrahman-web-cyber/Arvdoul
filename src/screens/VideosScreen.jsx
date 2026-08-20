// src/screens/VideosScreen.jsx - ARVDOUL VIDEOS & REELS EXPERIENCE
// Futuristic TikTok & Reels style immersive video ecosystem

import React, { useState, useEffect, useCallback, useMemo, memo } from "react";
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Video, 
  RefreshCw, 
  Play, 
  LayoutGrid, 
  Smartphone, 
  Sparkles, 
  Search, 
  Camera, 
  TrendingUp, 
  Flame, 
  Radio, 
  Plus 
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { useVideoStore } from '../store/videoStore';
import { VideoFeed } from '../components/Videos';
import videoService from '../services/videoService';
import { toast } from 'sonner';
import LoadingSpinner from '../components/Shared/LoadingSpinner';
import EmptyState from '../components/UI/EmptyState';
import ErrorState from '../components/UI/ErrorState';

/**
 * VideosScreen - World-Class video feed & discovery grid
 */
const VideosScreen = () => {
  const navigate = useNavigate();
  const { theme, isDark, spring, gradient } = useTheme();
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

  // Load videos from service
  const loadVideos = useCallback(async (type = feedType) => {
    setLoading(true);
    setError(null);

    try {
      const result = await videoService.getVideoFeed(null, {
        feedType: type,
        limit: 20,
      });

      const feed = result?.feed || result?.videos || [];
      if (Array.isArray(feed) && feed.length > 0) {
        setVideos(feed);
        setHasMore(result.hasMore || false);
        setNextCursor(result.nextCursor || null);
      } else {
        setVideos([]);
        setHasMore(false);
      }
    } catch (err) {
      console.error('Failed to load videos:', err);
      setError(err?.message || 'Could not load videos.');
    } finally {
      setLoading(false);
    }
  }, [feedType, setVideos, setLoading, setHasMore, setNextCursor]);

  // Load more pagination
  const loadMoreVideos = useCallback(async () => {
    if (loadingMore || !hasMore || !nextCursor) return;

    setLoadingMore(true);

    try {
      const result = await videoService.getVideoFeed(null, {
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
  }, [loadingMore, hasMore, nextCursor, feedType, appendVideos, setLoadingMore, setHasMore, setNextCursor]);

  // Tab change handler
  const handleTabChange = useCallback((newTab) => {
    setFeedType(newTab);
    loadVideos(newTab);
  }, [setFeedType, loadVideos]);

  // Refresh
  const handleRefresh = useCallback(() => {
    loadVideos(feedType);
  }, [loadVideos, feedType]);

  // Initial load
  useEffect(() => {
    if (videos.length === 0) {
      loadVideos(feedType);
    }
  }, []);

  return (
    <div 
      className="h-screen w-full overflow-hidden relative"
      style={{
        background: isDark ? '#050510' : '#F8F9FA',
      }}
    >
      {/* Floating View Switcher Button (Feed / Grid toggle) */}
      <div className="absolute top-4 left-4 z-40 flex items-center gap-2">
        <button
          onClick={() => setViewMode(prev => prev === 'feed' ? 'grid' : 'feed')}
          className="px-3.5 py-1.5 rounded-full text-xs font-bold backdrop-blur-2xl border shadow-xl flex items-center gap-1.5 transition-all hover:scale-105"
          style={{
            background: isDark ? 'rgba(0, 0, 0, 0.55)' : 'rgba(255, 255, 255, 0.85)',
            borderColor: isDark ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.1)',
            color: isDark ? '#fff' : '#111',
          }}
          title="Toggle Grid / Feed view"
        >
          {viewMode === 'feed' ? (
            <>
              <LayoutGrid className="w-3.5 h-3.5 text-purple-400" />
              <span>Grid</span>
            </>
          ) : (
            <>
              <Smartphone className="w-3.5 h-3.5 text-pink-400" />
              <span>Reels</span>
            </>
          )}
        </button>
      </div>

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
  onVideoClick,
  onCreateVideo,
}) => {
  const { isDark, gradient, spring } = useTheme();

  if (error && videos.length === 0) {
    return (
      <div className="h-full flex items-center justify-center p-8">
        <ErrorState
          title="Failed to load videos"
          message={error}
          onRetry={onRefresh}
          severity="error"
        />
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto pt-16 pb-28 px-4 sm:px-6 max-w-7xl mx-auto select-none">
      {/* Grid Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className={`text-2xl sm:text-3xl font-black tracking-tight ${isDark ? 'text-white' : 'text-gray-900'}`}>
            Explore Videos
          </h1>
          <p className={`text-sm mt-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
            Discover trending visual creators and original soundscapes
          </p>
        </div>

        {/* Tab Filters */}
        <div className="flex items-center gap-2 p-1 rounded-2xl bg-black/20 dark:bg-white/5 border border-black/5 dark:border-white/10 backdrop-blur-xl">
          {[
            { id: 'for_you', label: 'For You' },
            { id: 'trending', label: 'Trending' },
            { id: 'following', label: 'Following' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => onFeedTypeChange?.(tab.id)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                feedType === tab.id
                  ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-md'
                  : isDark ? 'text-gray-400 hover:text-white' : 'text-gray-600 hover:text-black'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Grid Items */}
      {videos.length === 0 && !loading ? (
        <EmptyState
          icon={Video}
          title="No videos found"
          description="Be the first to upload and share your video story!"
          actionLabel="Create Video"
          onAction={onCreateVideo}
        />
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 sm:gap-4">
          {videos.map((video, index) => (
            <motion.div
              key={video.id}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...spring.card, delay: index * 0.04 }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => onVideoClick(video, index)}
              className="relative aspect-[9/16] rounded-3xl overflow-hidden group cursor-pointer shadow-xl border border-black/10 dark:border-white/10 bg-gray-900"
            >
              <img
                src={video.thumbnailUrl || video.thumbnail || 'https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=1080&auto=format&fit=crop&q=80'}
                alt={video.title || 'Video'}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                loading="lazy"
              />

              {/* Gradient Vignette */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />

              {/* Quality & Duration Badges */}
              <div className="absolute top-3 left-3 right-3 flex items-center justify-between z-10">
                <span className="px-2 py-0.5 rounded-full bg-black/60 backdrop-blur-md text-[10px] font-black text-cyan-300 border border-white/10 uppercase">
                  {video.quality || '1080p'}
                </span>
                <span className="px-2 py-0.5 rounded-full bg-black/60 backdrop-blur-md text-[10px] font-bold text-white/90 border border-white/10 font-mono">
                  {video.duration ? `${video.duration}s` : '0:30'}
                </span>
              </div>

              {/* Play Button Icon on Hover */}
              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10">
                <div className="w-12 h-12 rounded-full bg-white/30 backdrop-blur-xl border border-white/40 flex items-center justify-center shadow-xl">
                  <Play className="w-6 h-6 text-white fill-white translate-x-0.5" />
                </div>
              </div>

              {/* Bottom Creator & Video Title Details */}
              <div className="absolute bottom-3 left-3 right-3 z-10 flex flex-col gap-1">
                <div className="flex items-center gap-1.5">
                  <img
                    src={video.creator?.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=80'}
                    alt={video.creator?.name}
                    className="w-5 h-5 rounded-full object-cover ring-1 ring-white/40"
                  />
                  <span className="text-white text-xs font-bold truncate drop-shadow-md">
                    @{video.creator?.username || 'user'}
                  </span>
                </div>

                <p className="text-white/90 text-xs font-semibold line-clamp-1 drop-shadow-md">
                  {video.title || 'Untitled Story'}
                </p>

                <div className="flex items-center gap-2 text-[11px] text-white/70 font-medium">
                  <span>{video.likesFormatted || `${video.likes || 0}`} likes</span>
                  <span>•</span>
                  <span>{video.views?.toLocaleString() || '12.4K'} views</span>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
});

GridView.displayName = 'GridView';

export default React.memo(VideosScreen);
