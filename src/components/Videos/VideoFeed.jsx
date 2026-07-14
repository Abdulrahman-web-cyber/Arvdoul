// src/components/Videos/VideoFeed.jsx - ARVDOUL VIDEO FEED
// TikTok-style vertical scrolling video feed with gesture support

import React, { useRef, useState, useEffect, useCallback, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSwipeable } from 'react-swipeable';
import { useVideoStore } from '../../store/videoStore';
import { useTheme } from '../../context/ThemeContext';
import VideoCard from './VideoCard';
import VideoComments from './VideoComments';
import VideoBottomSheet from './VideoBottomSheet';
import { Loader2, RefreshCw, AlertCircle } from 'lucide-react';
import PropTypes from 'prop-types';

/**
 * VideoFeed - TikTok-style vertical scrolling video feed
 * Supports infinite scroll, video preloading, gesture navigation, and audio management
 */
const VideoFeed = memo(({
  videos = [],
  loading = false,
  error = null,
  onLoadMore,
  onRefresh,
  hasMore = true,
  feedType = 'for_you',
}) => {
  const containerRef = useRef(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showComments, setShowComments] = useState(false);
  const [showShareSheet, setShowShareSheet] = useState(false);
  const [selectedVideo, setSelectedVideo] = useState(null);
  const [preloadedVideos, setPreloadedVideos] = useState({});

  const { theme } = useTheme();
  const { setCurrentIndex: storeSetIndex } = useVideoStore();

  // Preload next videos
  useEffect(() => {
    const preloadVideo = (video) => {
      if (!video || preloadedVideos[video.id]) return;
      
      const videoEl = document.createElement('video');
      videoEl.src = video.videoUrl || video.url || '';
      videoEl.preload = 'auto';
      videoEl.muted = true;
      
      setPreloadedVideos((prev) => ({ ...prev, [video.id]: videoEl }));
    };

    // Preload current and next 2 videos
    if (videos.length > 0) {
      const currentVideo = videos[currentIndex];
      const nextVideo1 = videos[currentIndex + 1];
      const nextVideo2 = videos[currentIndex + 2];

      if (currentVideo) preloadVideo(currentVideo);
      if (nextVideo1) preloadVideo(nextVideo1);
      if (nextVideo2) preloadVideo(nextVideo2);
    }
  }, [videos, currentIndex, preloadedVideos]);

  // Handle scroll to determine current video
  const handleScroll = useCallback(() => {
    if (!containerRef.current) return;
    
    const { scrollTop, clientHeight } = containerRef.current;
    const newIndex = Math.round(scrollTop / clientHeight);
    
    if (newIndex !== currentIndex && newIndex >= 0 && newIndex < videos.length) {
      setCurrentIndex(newIndex);
      storeSetIndex(newIndex);

      // Load more when near end
      if (newIndex >= videos.length - 3 && hasMore && onLoadMore && !loading) {
        onLoadMore();
      }
    }
  }, [currentIndex, videos.length, hasMore, onLoadMore, loading, storeSetIndex]);

  // Swipe handlers for vertical navigation
  const handlers = useSwipeable({
    vertical: true,
    onSwipedUp: () => {
      if (currentIndex < videos.length - 1) {
        const newIndex = currentIndex + 1;
        setCurrentIndex(newIndex);
        storeSetIndex(newIndex);
        containerRef.current?.scrollTo({
          top: newIndex * containerRef.current.clientHeight,
          behavior: 'smooth',
        });
      }
    },
    onSwipedDown: () => {
      if (currentIndex > 0) {
        const newIndex = currentIndex - 1;
        setCurrentIndex(newIndex);
        storeSetIndex(newIndex);
        containerRef.current?.scrollTo({
          top: newIndex * containerRef.current.clientHeight,
          behavior: 'smooth',
        });
      }
    },
    onSwiping: ({ deltaY }) => {
      if (!containerRef.current) return;
      const startTop = currentIndex * containerRef.current.clientHeight;
      containerRef.current.scrollTop = startTop - deltaY;
    },
    trackMouse: false,
    delta: 50,
  });

  // Handle actions
  const handleLike = useCallback((video) => {
    setSelectedVideo(video);
    // Like logic would be handled by parent or store
  }, []);

  const handleComment = useCallback((video) => {
    setSelectedVideo(video);
    setShowComments(true);
  }, []);

  const handleShare = useCallback((video) => {
    setSelectedVideo(video);
    setShowShareSheet(true);
  }, []);

  const handleSave = useCallback((video) => {
    setSelectedVideo(video);
    // Save logic would be handled by parent or store
  }, []);

  const handleReport = useCallback((video) => {
    setSelectedVideo(video);
    setShowShareSheet(true);
  }, []);

  // Scroll to specific video
  const scrollToVideo = useCallback((index) => {
    if (!containerRef.current) return;
    
    const clampedIndex = Math.max(0, Math.min(index, videos.length - 1));
    setCurrentIndex(clampedIndex);
    storeSetIndex(clampedIndex);
    
    containerRef.current.scrollTo({
      top: clampedIndex * containerRef.current.clientHeight,
      behavior: 'smooth',
    });
  }, [videos.length, storeSetIndex]);

  // Refresh handler
  const handleRefresh = useCallback(() => {
    if (onRefresh) {
      onRefresh();
    }
  }, [onRefresh]);

  return (
    <div className="relative w-full h-full bg-black overflow-hidden">
      {/* Main Feed Container */}
      <div
        ref={containerRef}
        {...handlers}
        onScroll={handleScroll}
        className="h-full w-full overflow-y-auto snap-y snap-mandatory scroll-smooth"
        style={{ scrollSnapType: 'y mandatory' }}
      >
        {/* Videos */}
        {videos.length > 0 ? (
          videos.map((video, index) => (
            <div
              key={video.id}
              className="h-screen w-full flex-shrink-0 snap-start"
              style={{ scrollSnapAlign: 'start' }}
            >
              <VideoCard
                video={video}
                isActive={index === currentIndex}
                autoPlay={index === currentIndex}
                onLike={() => handleLike(video)}
                onComment={() => handleComment(video)}
                onShare={() => handleShare(video)}
                onSave={() => handleSave(video)}
                onReport={() => handleReport(video)}
              />
            </div>
          ))
        ) : !loading && !error ? (
          <EmptyState onRefresh={handleRefresh} />
        ) : null}

        {/* Loading More Indicator */}
        {loading && videos.length > 0 && (
          <div className="h-32 flex items-center justify-center bg-black/80 backdrop-blur-xl">
            <Loader2 className="w-8 h-8 text-white animate-spin" />
          </div>
        )}
      </div>

      {/* Loading State */}
      <AnimatePresence>
        {loading && videos.length === 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 flex flex-col items-center justify-center bg-black"
          >
            <Loader2 className="w-12 h-12 text-purple-500 animate-spin mb-4" />
            <p className="text-white/80 text-sm">Loading videos...</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error State */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 flex flex-col items-center justify-center bg-black/90 backdrop-blur-xl p-8"
          >
            <AlertCircle className="w-16 h-16 text-red-500 mb-4" />
            <h3 className="text-white text-xl font-bold mb-2">Something went wrong</h3>
            <p className="text-white/60 text-center mb-6 max-w-sm">{error}</p>
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={handleRefresh}
              className="flex items-center gap-2 px-6 py-3 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 text-white font-semibold"
            >
              <RefreshCw className="w-5 h-5" />
              Try Again
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* End of Feed */}
      {!hasMore && videos.length > 0 && (
        <div className="absolute bottom-32 left-0 right-0 flex justify-center pointer-events-none">
          <div className="px-6 py-2 rounded-full bg-white/10 backdrop-blur-xl text-white/80 text-sm">
            You're all caught up! 🎉
          </div>
        </div>
      )}

      {/* Feed Type Tabs */}
      <div className="absolute top-4 left-0 right-0 flex justify-center gap-8 z-10">
        {['for_you', 'following', 'trending'].map((type) => (
          <button
            key={type}
            onClick={() => {/* Feed type change */}}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              feedType === type
                ? 'text-white border-b-2 border-white'
                : 'text-white/60 hover:text-white'
            }`}
          >
            {type === 'for_you' ? 'For You' : type === 'following' ? 'Following' : 'Trending'}
          </button>
        ))}
      </div>

      {/* Comments Drawer */}
      <VideoComments
        isOpen={showComments}
        onClose={() => setShowComments(false)}
        video={selectedVideo}
      />

      {/* Share Bottom Sheet */}
      <VideoBottomSheet
        isOpen={showShareSheet}
        onClose={() => setShowShareSheet(false)}
        video={selectedVideo}
      />
    </div>
  );
});

VideoFeed.displayName = 'VideoFeed';

/**
 * Empty state component when no videos are available
 */
const EmptyState = memo(({ onRefresh }) => (
  <div className="h-full flex flex-col items-center justify-center bg-black p-8">
    <div className="w-32 h-32 mb-6 rounded-full bg-white/5 flex items-center justify-center">
      <svg
        className="w-16 h-16 text-white/30"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
        />
      </svg>
    </div>
    <h3 className="text-white text-2xl font-bold mb-2">No videos yet</h3>
    <p className="text-white/60 text-center mb-6 max-w-xs">
      Follow creators to see their latest videos in your feed
    </p>
    <motion.button
      whileTap={{ scale: 0.95 }}
      onClick={onRefresh}
      className="flex items-center gap-2 px-6 py-3 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 text-white font-semibold"
    >
      <RefreshCw className="w-5 h-5" />
      Refresh
    </motion.button>
  </div>
));

EmptyState.displayName = 'EmptyState';
EmptyState.propTypes = {
  onRefresh: PropTypes.func,
};

VideoFeed.propTypes = {
  videos: PropTypes.arrayOf(PropTypes.object),
  loading: PropTypes.bool,
  error: PropTypes.string,
  onLoadMore: PropTypes.func,
  onRefresh: PropTypes.func,
  hasMore: PropTypes.bool,
  feedType: PropTypes.oneOf(['for_you', 'following', 'trending']),
};

export default VideoFeed;
