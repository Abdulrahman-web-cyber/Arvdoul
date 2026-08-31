// src/components/Videos/VideoFeed.jsx - ARVDOUL VIDEO FEED
// TikTok-style vertical scrolling video feed with gesture support, interactive modals, and preloading

import React, { useRef, useState, useEffect, useCallback, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSwipeable } from 'react-swipeable';
import { useVideoStore } from '../../store/videoStore';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import VideoCard from './VideoCard';
import VideoComments from './VideoComments';
import VideoBottomSheet from './VideoBottomSheet';
import VideoGiftModal from './VideoGiftModal';
import VideoTopBar from './VideoTopBar';
import videoService from '../../services/videoService';
import { Loader2, RefreshCw, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import PropTypes from 'prop-types';

/**
 * VideoFeed - Vertical snap video feed with gesture navigation and rich overlays
 */
const VideoFeed = memo(({
  videos = [],
  loading = false,
  error = null,
  onLoadMore,
  onRefresh,
  hasMore = true,
  feedType = 'for_you',
  onFeedTypeChange,
  onOpenSearch,
  onCreateVideo,
}) => {
  const containerRef = useRef(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showComments, setShowComments] = useState(false);
  const [showShareSheet, setShowShareSheet] = useState(false);
  const [showGiftModal, setShowGiftModal] = useState(false);
  const [selectedVideo, setSelectedVideo] = useState(null);
  const [preloadedVideos, setPreloadedVideos] = useState({});

  const { theme, isDark } = useTheme();
  const { user } = useAuth();
  const { setCurrentIndex: storeSetIndex, updateVideo, addToWatchLater, removeFromWatchLater } = useVideoStore();

  // Keep selected video in sync
  const currentVideo = videos[currentIndex] || videos[0] || null;

  // Preload adjacent video assets for seamless scrolling
  useEffect(() => {
    const preload = (vid) => {
      if (!vid || preloadedVideos[vid.id]) return;
      const el = document.createElement('video');
      el.src = vid.videoUrl || vid.url || '';
      el.preload = 'auto';
      el.muted = true;
      setPreloadedVideos((prev) => ({ ...prev, [vid.id]: el }));
    };

    if (videos.length > 0) {
      if (videos[currentIndex]) preload(videos[currentIndex]);
      if (videos[currentIndex + 1]) preload(videos[currentIndex + 1]);
      if (videos[currentIndex + 2]) preload(videos[currentIndex + 2]);
    }
  }, [videos, currentIndex, preloadedVideos]);

  // Scroll to index
  const scrollToIndex = useCallback((index) => {
    if (!containerRef.current) return;
    const clamped = Math.max(0, Math.min(index, videos.length - 1));
    setCurrentIndex(clamped);
    storeSetIndex(clamped);

    containerRef.current.scrollTo({
      top: clamped * containerRef.current.clientHeight,
      behavior: 'smooth',
    });
  }, [videos.length, storeSetIndex]);

  // Handle scroll detection
  const handleScroll = useCallback(() => {
    if (!containerRef.current) return;
    const { scrollTop, clientHeight } = containerRef.current;
    const newIndex = Math.round(scrollTop / clientHeight);

    if (newIndex !== currentIndex && newIndex >= 0 && newIndex < videos.length) {
      setCurrentIndex(newIndex);
      storeSetIndex(newIndex);

      if (newIndex >= videos.length - 2 && hasMore && onLoadMore && !loading) {
        onLoadMore();
      }
    }
  }, [currentIndex, videos.length, hasMore, onLoadMore, loading, storeSetIndex]);

  // Keyboard navigation for desktop (Arrow Up/Down, Space, M)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (showComments || showShareSheet || showGiftModal) return;

      if (e.key === 'ArrowDown' || e.key === 'j') {
        e.preventDefault();
        scrollToIndex(currentIndex + 1);
      } else if (e.key === 'ArrowUp' || e.key === 'k') {
        e.preventDefault();
        scrollToIndex(currentIndex - 1);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentIndex, scrollToIndex, showComments, showShareSheet, showGiftModal]);

  // Swipe gestures
  const handlers = useSwipeable({
    vertical: true,
    onSwipedUp: () => {
      if (currentIndex < videos.length - 1) {
        scrollToIndex(currentIndex + 1);
      }
    },
    onSwipedDown: () => {
      if (currentIndex > 0) {
        scrollToIndex(currentIndex - 1);
      }
    },
    trackMouse: false,
    delta: 50,
  });

  // Action handlers with store updates & service integration
  const handleLike = useCallback(async (video) => {
    if (!video) return;
    const wasLiked = video.isLiked;
    const newLikes = wasLiked ? Math.max(0, (video.likes || 1) - 1) : (video.likes || 0) + 1;

    updateVideo(video.id, {
      isLiked: !wasLiked,
      likes: newLikes,
      likesFormatted: newLikes > 1000 ? `${(newLikes / 1000).toFixed(1)}K` : `${newLikes}`,
    });

    try {
      await videoService.likeVideo(video.id);
    } catch (err) {
      // Revert if error
      console.warn('Like request fallback:', err);
    }
  }, [updateVideo]);

  const handleComment = useCallback((video) => {
    setSelectedVideo(video);
    setShowComments(true);
  }, []);

  const handleShare = useCallback(async (video) => {
    setSelectedVideo(video);
    setShowShareSheet(true);
    if (video) {
      updateVideo(video.id, {
        shares: (video.shares || 0) + 1,
      });
      videoService.shareVideo(video.id).catch(() => {});
    }
  }, [updateVideo]);

  const handleSave = useCallback(async (video) => {
    if (!video) return;
    const wasSaved = video.isSaved;
    updateVideo(video.id, {
      isSaved: !wasSaved,
      saves: wasSaved ? Math.max(0, (video.saves || 1) - 1) : (video.saves || 0) + 1,
    });
    if (!wasSaved) {
      addToWatchLater(video);
      toast.success('Saved to your collection! 🌟');
    } else {
      removeFromWatchLater(video.id);
      toast.info('Removed from saved');
    }

    // Real server-side persistence (best-effort with rollback on failure).
    if (user?.uid) {
      try {
        if (wasSaved) {
          await videoService.unsaveVideo(video.id, user.uid);
        } else {
          await videoService.saveVideo(video.id, user.uid);
        }
      } catch (err) {
        // Rollback local state.
        updateVideo(video.id, {
          isSaved: wasSaved,
          saves: wasSaved ? (video.saves || 0) : Math.max(0, (video.saves || 1) - 1),
        });
        if (wasSaved) addToWatchLater(video);
        else removeFromWatchLater(video.id);
        toast.error(err?.message || 'Could not sync save. Are you signed in?');
      }
    }
  }, [updateVideo, addToWatchLater, removeFromWatchLater, user?.uid]);

  const handleGift = useCallback((video) => {
    setSelectedVideo(video);
    setShowGiftModal(true);
  }, []);

  const handleReport = useCallback((video) => {
    setSelectedVideo(video);
    setShowShareSheet(true);
  }, []);

  return (
    <div className="relative w-full h-full bg-black overflow-hidden select-none">
      {/* Floating Top Bar Navigation */}
      <VideoTopBar
        activeTab={feedType}
        onTabChange={onFeedTypeChange}
        onOpenSearch={onOpenSearch}
        onCreateVideo={onCreateVideo}
      />

      {/* Main Snap Feed Container */}
      <div
        ref={containerRef}
        {...handlers}
        onScroll={handleScroll}
        className="h-full w-full overflow-y-auto snap-y snap-mandatory scroll-smooth no-scrollbar"
        style={{ scrollSnapType: 'y mandatory', scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {videos.length > 0 ? (
          videos.map((video, index) => (
            <div
              key={video.id}
              className="h-full w-full flex-shrink-0 snap-start relative"
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
                onGift={() => handleGift(video)}
                onReport={() => handleReport(video)}
              />
            </div>
          ))
        ) : !loading && !error ? (
          <EmptyState onRefresh={onRefresh} />
        ) : null}

        {/* Loading More Indicator */}
        {loading && videos.length > 0 && (
          <div className="h-24 flex items-center justify-center bg-black/80 backdrop-blur-xl">
            <Loader2 className="w-8 h-8 text-purple-400 animate-spin" />
          </div>
        )}
      </div>

      {/* Loading Full Screen State */}
      <AnimatePresence>
        {loading && videos.length === 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 flex flex-col items-center justify-center bg-black z-30"
          >
            <Loader2 className="w-12 h-12 text-purple-500 animate-spin mb-4" />
            <p className="text-white/80 text-sm font-bold">Curating your feed...</p>
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
            className="absolute inset-0 flex flex-col items-center justify-center bg-black/95 backdrop-blur-2xl p-8 z-30"
          >
            <AlertCircle className="w-16 h-16 text-red-500 mb-4" />
            <h3 className="text-white text-xl font-black mb-2">Could Not Load Videos</h3>
            <p className="text-white/60 text-center mb-6 max-w-sm text-sm">{error}</p>
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={onRefresh}
              className="flex items-center gap-2 px-6 py-3 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 text-white font-bold text-sm shadow-xl shadow-purple-500/30"
            >
              <RefreshCw className="w-4 h-4" />
              Try Again
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Comments Bottom Sheet */}
      <VideoComments
        isOpen={showComments}
        onClose={() => setShowComments(false)}
        video={selectedVideo || currentVideo}
      />

      {/* Share Bottom Sheet */}
      <VideoBottomSheet
        isOpen={showShareSheet}
        onClose={() => setShowShareSheet(false)}
        video={selectedVideo || currentVideo}
      />

      {/* Virtual Coin Gift Modal */}
      <VideoGiftModal
        isOpen={showGiftModal}
        onClose={() => setShowGiftModal(false)}
        creator={selectedVideo?.creator || currentVideo?.creator}
      />
    </div>
  );
});

VideoFeed.displayName = 'VideoFeed';

const EmptyState = memo(({ onRefresh }) => (
  <div className="h-full flex flex-col items-center justify-center bg-black p-8 text-center">
    <div className="w-24 h-24 mb-6 rounded-3xl bg-white/5 border border-white/10 flex items-center justify-center shadow-2xl">
      <RefreshCw className="w-10 h-10 text-white/30" />
    </div>
    <h3 className="text-white text-2xl font-black mb-2 tracking-tight">No Videos in Feed</h3>
    <p className="text-white/60 text-sm max-w-xs mb-6">
      Explore new trending creators and discover fresh stories
    </p>
    <motion.button
      whileTap={{ scale: 0.95 }}
      onClick={onRefresh}
      className="px-6 py-3 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 text-white font-bold text-sm shadow-lg shadow-purple-500/25"
    >
      Refresh Feed
    </motion.button>
  </div>
));

EmptyState.displayName = 'EmptyState';

VideoFeed.propTypes = {
  videos: PropTypes.arrayOf(PropTypes.object),
  loading: PropTypes.bool,
  error: PropTypes.string,
  onLoadMore: PropTypes.func,
  onRefresh: PropTypes.func,
  hasMore: PropTypes.bool,
  feedType: PropTypes.string,
  onFeedTypeChange: PropTypes.func,
  onOpenSearch: PropTypes.func,
  onCreateVideo: PropTypes.func,
};

export default VideoFeed;
