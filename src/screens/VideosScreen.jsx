// src/screens/VideosScreen.jsx - ARVDOUL WORLD-CLASS VIDEOS SCREEN
// TikTok-style vertical video feed with futuristic UI
// Surpasses TikTok, Instagram, YouTube with premium experience

import React, { useState, useEffect, useCallback, useRef, useMemo, memo} from "react";
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Video, RefreshCw, Play } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { useVideoStore } from '../store/videoStore';
import { VideoFeed } from '../components/Videos';
import videoService from '../services/videoService';
import { toast } from 'sonner';
import LoadingSpinner from '../components/Shared/LoadingSpinner';
import EmptyState from '../components/UI/EmptyState';
import ErrorState from '../components/UI/ErrorState';

/**
 * VideosScreen - TikTok-style full-screen vertical video feed
 * Features: infinite scroll, video preloading, gesture navigation, audio management
 * World-class UI with ARVDOUL DNA design system
 */
const VideosScreen = () => {
  const navigate = useNavigate();
  const { theme, isDark, spring, gradient, glass } = useTheme();
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
    incrementViews,
    addToWatchLater,
  } = useVideoStore();

  const [error, setError] = useState(null);
  const [showFullscreen, setShowFullscreen] = useState(true);
  const [isInitialized, setIsInitialized] = useState(false);

  // Load initial videos
  const loadVideos = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const userId = null; // For unauthenticated feed
      const result = await videoService.getVideoFeed(userId, {
        feedType,
        limit: 20,
      });

      const feed = result?.feed || result?.videos;
      if (Array.isArray(feed)) {
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

  // Load more videos
  const loadMoreVideos = useCallback(async () => {
    if (loadingMore || !hasMore || !nextCursor) return;

    setLoadingMore(true);

    try {
      const userId = null;
      const result = await videoService.getVideoFeed(userId, {
        feedType,
        cursor: nextCursor,
        limit: 20,
      });

      const feed = result?.feed || result?.videos;
      if (Array.isArray(feed)) {
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

  // Handle like
  const handleLike = useCallback(async (video) => {
    try {
      await videoService.likeVideo(video.id);
      updateVideo(video.id, {
        isLiked: !video.isLiked,
        likes: video.isLiked ? video.likes - 1 : video.likes + 1,
      });
    } catch (err) {
      console.error('Failed to like:', err);
    }
  }, [updateVideo]);

  // Handle share
  const handleShare = useCallback(async (video) => {
    try {
      await videoService.shareVideo(video.id);
      updateVideo(video.id, { shares: (video.shares || 0) + 1 });
    } catch (err) {
      console.error('Failed to share:', err);
    }
  }, [updateVideo]);

  // Handle save
  const handleSave = useCallback((video) => {
    addToWatchLater(video);
    updateVideo(video.id, { isSaved: true });
    toast.success('Added to Watch Later');
  }, [addToWatchLater, updateVideo]);

  // Handle report
  const handleReport = useCallback((video) => {
    // Opens bottom sheet for reporting
  }, []);

  // Initial load
  useEffect(() => {
    if (videos.length === 0) {
      loadVideos();
    }
  }, []);

  // Reload on feed type change
  useEffect(() => {
    loadVideos();
  }, [feedType]);

  // Refresh handler
  const handleRefresh = useCallback(() => {
    loadVideos();
  }, [loadVideos]);

  // Memoized loading overlay
  const LoadingOverlay = useMemo(() => (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="absolute inset-0 flex flex-col items-center justify-center z-50"
      style={{
        background: isDark 
          ? 'linear-gradient(135deg, rgba(5,5,16,0.95) 0%, rgba(20,20,40,0.95) 100%)'
          : 'linear-gradient(135deg, rgba(248,249,250,0.98) 0%, rgba(255,255,255,0.98) 100%)',
      }}
    >
      {/* Animated gradient background */}
      <div 
        className="absolute inset-0 opacity-30"
        style={{
          background: gradient,
          filter: 'blur(80px)',
        }}
      />
      
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={spring.card}
        className="relative z-10 flex flex-col items-center"
      >
        <LoadingSpinner size={64} color="purple" />
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className={`mt-6 text-lg font-medium ${
            isDark ? 'text-white' : 'text-gray-900'
          }`}
        >
          Loading videos...
        </motion.p>
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className={`mt-2 text-sm ${
            isDark ? 'text-gray-400' : 'text-gray-500'
          }`}
        >
          Preparing your feed
        </motion.p>
      </motion.div>
    </motion.div>
  ), [isDark, gradient, spring.card]);

  return (
    <div 
      className="h-screen w-full overflow-hidden relative"
      style={{
        background: isDark ? '#050510' : '#F8F9FA',
      }}
    >
      {/* Reels shortcut (full-screen vertical) */}
      <button
        onClick={() => navigate('/reels')}
        className="absolute top-4 right-4 z-40 px-4 py-2 rounded-2xl text-sm font-bold backdrop-blur-xl border shadow-lg transition hover:scale-105"
        style={{
          background: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.85)',
          borderColor: isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.08)',
          color: isDark ? '#fff' : '#111',
          boxShadow: isDark ? '0 8px 30px rgba(0,0,0,0.4)' : '0 8px 30px rgba(0,0,0,0.1)',
        }}
      >
        🎬 Reels
      </button>

      {/* Fullscreen Video Feed */}
      {showFullscreen ? (
        <VideoFeed
          videos={videos}
          loading={loading}
          error={error}
          onLoadMore={loadMoreVideos}
          onRefresh={handleRefresh}
          hasMore={hasMore}
          feedType={feedType}
        />
      ) : (
        /* Grid View (Alternative) */
        <GridView
          videos={videos}
          loading={loading}
          error={error}
          onRefresh={handleRefresh}
          onVideoClick={(video) => {
            setCurrentIndex(videos.findIndex((v) => v.id === video.id));
            setShowFullscreen(true);
          }}
        />
      )}

      {/* Loading Overlay */}
      <AnimatePresence>
        {loading && videos.length === 0 && LoadingOverlay}
      </AnimatePresence>
    </div>
  );
};

/**
 * GridView - Alternative video grid layout with world-class UI
 */
const GridView = memo(({ videos, loading, error, onRefresh, onVideoClick }) => {
  const { isDark, gradient, glass, spring } = useTheme();

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

  if (!loading && videos.length === 0) {
    return (
      <div className="h-full flex items-center justify-center p-8">
        <EmptyState
          icon={Video}
          title="No videos yet"
          description="Follow creators to see their latest videos in your feed"
          actionLabel="Refresh"
          onAction={onRefresh}
        />
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto p-4">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 pb-28">
        {videos.map((video, index) => (
          <motion.div
            key={video.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ 
              ...spring.card,
              delay: index * 0.05,
            }}
            whileTap={{ scale: 0.98 }}
            onClick={() => onVideoClick(video)}
            className="relative aspect-[9/16] rounded-2xl overflow-hidden group cursor-pointer"
          >
            {/* Gradient overlay for depth */}
            <div 
              className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-10"
              style={{
                background: gradient,
                mixBlendMode: 'overlay',
              }}
            />
            
            <img
              src={video.thumbnailUrl || video.thumbnail || ''}
              alt={video.title || 'Video'}
              className="w-full h-full object-cover"
              loading="lazy"
            />
            
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
            
            {/* Glow effect on hover */}
            <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
              <div 
                className="absolute -inset-1 rounded-2xl blur-lg opacity-30"
                style={{ background: gradient }}
              />
            </div>
            
            <div className="absolute bottom-3 left-3 right-3 z-20">
              <p className="text-white font-semibold text-sm truncate drop-shadow-lg">
                {video.title || 'Video'}
              </p>
              <p className="text-white/80 text-xs mt-1">
                {video.views?.toLocaleString() || 0} views
              </p>
            </div>

            {/* Play indicator on hover */}
            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-10">
              <div className="w-16 h-16 rounded-full bg-white/20 backdrop-blur-xl flex items-center justify-center border border-white/30">
                <Play className="w-8 h-8 text-white fill-white" />
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
});

GridView.displayName = 'GridView';



export default React.memo(VideosScreen);
