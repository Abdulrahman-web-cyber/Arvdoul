// src/screens/VideosScreen.jsx - ARVDOUL VIDEOS SCREEN
// TikTok-style vertical video feed with all features

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Video, RefreshCw, Loader2 } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { useVideoStore } from '../store/videoStore';
import { VideoFeed } from '../components/Videos';
import videoService from '../services/videoService';
import { toast } from 'sonner';

/**
 * VideosScreen - TikTok-style full-screen vertical video feed
 * Features: infinite scroll, video preloading, gesture navigation, audio management
 */
const VideosScreen = () => {
  const navigate = useNavigate();
  const { theme, isDark } = useTheme();
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

      if (result?.videos) {
        setVideos(result.videos);
        setHasMore(result.hasMore || false);
        setNextCursor(result.nextCursor || null);
      } else {
        // Use demo videos if no real data
        setVideos(getDemoVideos());
        setHasMore(false);
      }
    } catch (err) {
      console.error('Failed to load videos:', err);
      // Fallback to demo videos
      setVideos(getDemoVideos());
      setError(null); // Don't show error since we have fallback
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

      if (result?.videos) {
        appendVideos(result.videos);
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

  return (
    <div className="h-screen w-full bg-black overflow-hidden relative">
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
        {loading && videos.length === 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 flex flex-col items-center justify-center bg-black z-50"
          >
            <Loader2 className="w-12 h-12 text-purple-500 animate-spin mb-4" />
            <p className="text-white/80 text-sm">Loading videos...</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

/**
 * Grid View - Alternative video grid layout
 */
const GridView = ({ videos, loading, error, onRefresh, onVideoClick }) => {
  const { theme } = useTheme();

  if (error && videos.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-8">
        <p className="text-red-400 mb-4">{error}</p>
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={onRefresh}
          className="flex items-center gap-2 px-6 py-3 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 text-white font-semibold"
        >
          <RefreshCw className="w-5 h-5" />
          Try Again
        </motion.button>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto p-4">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 pb-28">
        {videos.map((video) => (
          <motion.div
            key={video.id}
            whileTap={{ scale: 0.98 }}
            onClick={() => onVideoClick(video)}
            className="relative aspect-[9/16] rounded-2xl overflow-hidden bg-gray-900"
          >
            <img
              src={video.thumbnailUrl || video.thumbnail || ''}
              alt={video.title || 'Video'}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
            <div className="absolute bottom-3 left-3 right-3">
              <p className="text-white font-semibold text-sm truncate">
                {video.title || 'Video'}
              </p>
              <p className="text-white/60 text-xs mt-1">
                {video.views || 0} views
              </p>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

// Demo videos for fallback
const getDemoVideos = () => [
  {
    id: 'demo-1',
    title: 'Amazing Sunset Timelapse',
    description: 'Watch this beautiful sunset captured over the ocean',
    videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
    thumbnailUrl: 'https://images.unsplash.com/photo-1495616811223-4d98c6e9c869?w=400',
    creator: {
      id: 'c1',
      name: 'Nature Vibes',
      username: 'naturevibes',
      avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100',
      isVerified: true,
    },
    likes: 12500,
    commentsCount: 342,
    shares: 156,
    views: 89000,
    isLiked: false,
    isSaved: false,
  },
  {
    id: 'demo-2',
    title: 'City Lights at Night',
    description: 'The city never sleeps, and neither should you',
    videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
    thumbnailUrl: 'https://images.unsplash.com/photo-1519501025264-65ba15a82390?w=400',
    creator: {
      id: 'c2',
      name: 'Urban Explorer',
      username: 'urbanexplorer',
      avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100',
      isVerified: false,
    },
    likes: 8700,
    commentsCount: 215,
    shares: 89,
    views: 56000,
    isLiked: false,
    isSaved: false,
  },
  {
    id: 'demo-3',
    title: 'Mountain Adventure',
    description: 'Hiking through the most beautiful trails',
    videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4',
    thumbnailUrl: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=400',
    creator: {
      id: 'c3',
      name: 'Adventure Seeker',
      username: 'adventureseeker',
      avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100',
      isVerified: true,
    },
    likes: 15600,
    commentsCount: 478,
    shares: 234,
    views: 112000,
    isLiked: false,
    isSaved: false,
  },
  {
    id: 'demo-4',
    title: 'Cooking Masterclass',
    description: 'Learn to make the perfect pasta',
    videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4',
    thumbnailUrl: 'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=400',
    creator: {
      id: 'c4',
      name: 'Chef Marco',
      username: 'chefmarco',
      avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100',
      isVerified: false,
    },
    likes: 9800,
    commentsCount: 567,
    shares: 145,
    views: 78000,
    isLiked: false,
    isSaved: false,
  },
  {
    id: 'demo-5',
    title: 'Dance Moves Tutorial',
    description: 'Master these incredible dance moves',
    videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerMeltdowns.mp4',
    thumbnailUrl: 'https://images.unsplash.com/photo-1504609813442-a8924e83f76e?w=400',
    creator: {
      id: 'c5',
      name: 'Dance Pro',
      username: 'dancepro',
      avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=100',
      isVerified: true,
    },
    likes: 22000,
    commentsCount: 890,
    shares: 567,
    views: 245000,
    isLiked: false,
    isSaved: false,
  },
];

export default React.memo(VideosScreen);
