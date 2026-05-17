// src/screens/HomeScreen.jsx – ARVDOUL ULTIMATE PRO MAX V50
// 🚀 SMART FEED • STORY RINGS • REAL‑TIME UPDATES • INFINITE SCROLL
// 🔥 BILLION‑SCALE • ADS FROM FEED • PERFECT ANIMATIONS • TIMEOUT FALLBACK

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { useTheme } from '../context/ThemeContext';
import { useAppStore } from '../store/appStore';
import LoadingSpinner from '../components/Shared/LoadingSpinner.jsx';
import feedService from '../services/feedService.js';
import storyService from '../services/storyService.js';
import firestoreService from '../services/firestoreService.js';
import PostCard from './PostCard.jsx';
import CommentsDrawer from './CommentsDrawer.jsx';
import PostOptionsDrawer from './PostOptionsDrawer.jsx';
import { Compass, AlertCircle, Sparkles, ChevronUp, RefreshCw } from 'lucide-react';

const cn = (...classes) => classes.filter(Boolean).join(' ');

// ==================== STORY RING COMPONENT ====================
const StoryRing = ({ story, onClick, theme }) => {
  const [isHovered, setIsHovered] = useState(false);
  const hasStory = !!story.storyId;

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="flex flex-col items-center gap-1 focus:outline-none group flex-shrink-0"
    >
      <div className="relative">
        <div
          className={cn(
            "w-16 h-16 rounded-full p-[2px] transition-all duration-300",
            hasStory
              ? "bg-gradient-to-tr from-pink-500 via-purple-500 to-yellow-500"
              : "bg-gray-300 dark:bg-gray-700"
          )}
          style={{ transform: isHovered ? 'scale(1.05)' : 'scale(1)' }}
        >
          <div className="w-full h-full rounded-full overflow-hidden bg-white dark:bg-gray-900">
            <img
              src={story.userPhoto}
              alt={story.userName}
              className="w-full h-full object-cover"
              onError={(e) => { e.target.src = '/assets/default-profile.png'; }}
            />
          </div>
        </div>
        {story.isSponsored && (
          <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center text-white text-[10px] font-bold shadow-lg">
            AD
          </div>
        )}
      </div>
      <span className="text-xs font-medium truncate max-w-[70px] dark:text-gray-300">
        {story.userName}
      </span>
    </button>
  );
};

// ==================== MAIN HOMESCREEN ====================
const HomeScreenUltimateProMax = () => {
  const navigate = useNavigate();
  const { theme } = useTheme();
  const { currentUser, isAuthenticated } = useAppStore();

  // Feed state
  const [feed, setFeed] = useState([]);
  const [nextCursor, setNextCursor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  // Stories state
  const [stories, setStories] = useState([]);
  const [storiesLoading, setStoriesLoading] = useState(true);
  const [storiesError, setStoriesError] = useState(null);

  // Modals
  const [activePost, setActivePost] = useState(null);
  const [showComments, setShowComments] = useState(false);
  const [showPostOptions, setShowPostOptions] = useState(false);

  // Refs
  const lastPostRef = useRef(null);
  const feedUnsubscribeRef = useRef(null);
  const loadTimeoutRef = useRef(null);

  // ==================== LOAD FEED (WITH TIMEOUT FALLBACK) ====================
  const loadFeed = async (reset = false, skipCache = false) => {
    // CRITICAL FIX: if user is missing, clear loading state if this was a reset (first load)
    if (!currentUser?.uid) {
      console.warn('loadFeed called without currentUser.uid');
      if (reset) setLoading(false);
      return;
    }

    // Clear any previous timeout
    if (loadTimeoutRef.current) clearTimeout(loadTimeoutRef.current);

    try {
      if (reset) {
        setLoading(true);
        setFeed([]);
        setNextCursor(null);
        setError(null);
      }

      console.log('📡 Fetching feed for user:', currentUser.uid, 'reset:', reset);

      // Set a fallback timeout (15 seconds) to force exit loading state
      loadTimeoutRef.current = setTimeout(() => {
        console.error('Feed load timeout after 15 seconds');
        setError('Feed load timed out. Please check your connection.');
        setLoading(false);
        setLoadingMore(false);
        setRefreshing(false);
      }, 150000);

      const result = await feedService.getSmartFeed(currentUser.uid, {
        limit: 15,
        lastDoc: reset ? null : nextCursor,
        forceRefresh: skipCache,
      });

      clearTimeout(loadTimeoutRef.current);

      if (result.success) {
        setFeed((prev) => (reset ? result.feed : [...prev, ...result.feed]));
        setNextCursor(result.nextCursor || null);
        setError(null);
        console.log('✅ Feed loaded, posts:', result.feed.length);
      } else {
        throw new Error(result.error || 'Failed to load feed');
      }
    } catch (err) {
      console.error('Feed load error:', err);
      setError(err.message);
      toast.error('Failed to load feed. Please refresh.');
    } finally {
      setLoading(false);
      setLoadingMore(false);
      setRefreshing(false);
      if (loadTimeoutRef.current) clearTimeout(loadTimeoutRef.current);
    }
  };

  // ==================== LOAD STORIES ====================
  const loadStories = async () => {
    if (!currentUser?.uid) return;
    setStoriesLoading(true);
    setStoriesError(null);
    try {
      const result = await storyService.getStoriesFeed(currentUser.uid, { limit: 50 });
      if (result.success) {
        const storyMap = new Map();
        result.stories.forEach((story) => {
          if (!storyMap.has(story.userId)) {
            storyMap.set(story.userId, {
              userId: story.userId,
              userName: story.userName || 'User',
              userPhoto: story.userPhoto || '/assets/default-profile.png',
              storyId: story.id,
              storyMedia: story.media?.url,
              isSponsored: story.isSponsored,
            });
          }
        });
        setStories(Array.from(storyMap.values()));
      } else {
        throw new Error(result.error || 'Failed to load stories');
      }
    } catch (err) {
      console.warn('Failed to load stories:', err);
      setStoriesError(err.message);
    } finally {
      setStoriesLoading(false);
    }
  };

  // ==================== INITIAL LOAD ====================
  useEffect(() => {
    if (!isAuthenticated || !currentUser?.uid) {
      navigate('/login');
      return;
    }

    console.log('🏠 HomeScreen mounted, user:', currentUser.uid);
    loadFeed(true);
    loadStories();

    // Subscribe to feed updates
    feedUnsubscribeRef.current = feedService.subscribeToFeedUpdates(
      currentUser.uid,
      (update) => {
        if (update.type === 'feed_updated') {
          console.log('🔄 Feed update received, refreshing');
          loadFeed(true, true);
        }
      }
    );

    return () => {
      if (feedUnsubscribeRef.current) {
        feedService.unsubscribeFromFeed(feedUnsubscribeRef.current);
      }
      if (loadTimeoutRef.current) clearTimeout(loadTimeoutRef.current);
    };
  }, [isAuthenticated, currentUser?.uid, navigate]);

  // ==================== REFRESH ====================
  const handleRefresh = async () => {
    if (refreshing) return;
    setRefreshing(true);
    await loadFeed(true, true);
    await loadStories();
    toast.success('Feed refreshed!');
  };

  // ==================== LOAD MORE ====================
  const handleLoadMore = useCallback(() => {
    if (loadingMore || !nextCursor) return;
    setLoadingMore(true);
    loadFeed(false);
  }, [loadingMore, nextCursor]);

  // ==================== INFINITE SCROLL OBSERVER ====================
  useEffect(() => {
    if (!nextCursor || loadingMore || loading) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          handleLoadMore();
        }
      },
      { threshold: 0.5, rootMargin: '200px' }
    );

    if (lastPostRef.current) {
      observer.observe(lastPostRef.current);
    }

    return () => {
      if (lastPostRef.current) observer.unobserve(lastPostRef.current);
    };
  }, [nextCursor, loadingMore, loading, handleLoadMore]);

  // ==================== POST ACTIONS ====================
  const handlePostUpdate = (postId, updatedPost) => {
    setFeed((prev) => prev.map((p) => (p.id === postId ? updatedPost : p)));
  };

  const handlePostDelete = (postId) => {
    setFeed((prev) => prev.filter((p) => p.id !== postId));
  };

  // ==================== RENDER STORY RINGS ====================
  const renderStoryRings = () => {
    if (storiesLoading) {
      return (
        <div className="flex gap-3 px-4 py-3 overflow-x-auto scrollbar-hide">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex flex-col items-center gap-1 animate-pulse">
              <div className="w-16 h-16 rounded-full bg-gray-300 dark:bg-gray-700" />
              <div className="w-12 h-3 bg-gray-300 dark:bg-gray-700 rounded" />
            </div>
          ))}
        </div>
      );
    }

    if (storiesError) {
      return (
        <div className="px-4 py-2 text-sm text-red-500 dark:text-red-400">
          Failed to load stories.
        </div>
      );
    }

    if (stories.length === 0) return null;

    return (
      <div className="px-4 py-3 mb-2 overflow-x-auto scrollbar-hide">
        <div className="flex gap-4">
          {stories.map((story) => (
            <StoryRing
              key={story.userId}
              story={story}
              onClick={() => navigate(`/stories/${story.userId}`)}
              theme={theme}
            />
          ))}
        </div>
      </div>
    );
  };

  // ==================== RENDER FEED ====================
  const renderFeed = () => {
    if (loading && feed.length === 0) {
      return (
        <div className="space-y-6 px-4">
          {[1, 2, 3].map((i) => (
            <PostCardSkeleton key={i} theme={theme} />
          ))}
        </div>
      );
    }

    if (error && feed.length === 0) {
      return (
        <div className="min-h-[60vh] flex items-center justify-center px-4">
          <div className="text-center">
            <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h3 className="text-xl font-bold mb-2 dark:text-white">Connection Error</h3>
            <p className="text-gray-500 dark:text-gray-400 mb-6">{error}</p>
            <button
              onClick={handleRefresh}
              className="px-6 py-3 rounded-xl bg-gradient-to-r from-blue-500 to-cyan-500 text-white font-medium"
            >
              Try Again
            </button>
          </div>
        </div>
      );
    }

    if (feed.length === 0 && !loading) {
      return (
        <div className="min-h-[60vh] flex items-center justify-center px-4">
          <div className="text-center">
            <Compass className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-bold mb-2 dark:text-white">Welcome to Arvdoul!</h3>
            <p className="text-gray-500 dark:text-gray-400 mb-6">
              Your feed is empty. Follow more creators or check back later.
            </p>
            <button
              onClick={() => navigate('/explore')}
              className="px-6 py-3 rounded-xl bg-gradient-to-r from-blue-500 to-cyan-500 text-white font-medium"
            >
              Explore
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-6 pb-8">
        {feed.map((post, index) => {
          const isLast = index === feed.length - 1;
          if (post.isAd) {
            return (
              <div key={post.id} className="px-4">
                <SponsoredAdCard ad={post} theme={theme} />
              </div>
            );
          }

          return (
            <div
              key={post.id}
              ref={isLast ? lastPostRef : null}
              className="w-full"
            >
              <PostCard
                post={post}
                theme={theme}
                currentUser={currentUser}
                onComment={(p) => {
                  setActivePost(p);
                  setShowComments(true);
                }}
                onShowOptions={(p) => {
                  setActivePost(p);
                  setShowPostOptions(true);
                }}
                onUpdate={handlePostUpdate}
                onDelete={handlePostDelete}
                navigate={navigate}
              />
            </div>
          );
        })}

        {loadingMore && (
          <div className="py-4 text-center">
            <LoadingSpinner size="md" />
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">Loading more...</p>
          </div>
        )}

        {!nextCursor && feed.length > 0 && (
          <div className="text-center py-12 px-4">
            <Sparkles className="w-12 h-12 text-purple-500 mx-auto mb-3" />
            <h3 className="text-lg font-bold mb-1 dark:text-white">You're all caught up!</h3>
            <p className="text-gray-500 dark:text-gray-400 mb-4">
              You've seen all the latest posts.
            </p>
            <button
              onClick={handleRefresh}
              className="px-4 py-2 rounded-lg bg-gradient-to-r from-purple-500 to-pink-500 text-white text-sm"
            >
              Refresh
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div
      className={cn(
        "min-h-screen pt-20 pb-32 w-full",
        theme === 'dark' ? 'bg-gradient-to-b from-gray-950 to-gray-900' : 'bg-gradient-to-b from-gray-50 to-white'
      )}
    >
      {/* Refresh Indicator */}
      <AnimatePresence>
        {refreshing && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-20 left-1/2 transform -translate-x-1/2 z-50"
          >
            <div className="px-4 py-2 rounded-full bg-gradient-to-r from-blue-500/20 to-cyan-500/20 backdrop-blur-sm flex items-center gap-2 border border-blue-500/30">
              <RefreshCw className="w-4 h-4 animate-spin text-blue-500" />
              <span className="text-sm text-blue-500">Refreshing...</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Story Rings */}
      {renderStoryRings()}

      {/* Feed */}
      {renderFeed()}

      {/* Scroll to Top */}
      <motion.button
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.8 }}
        onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        className="fixed bottom-32 right-4 z-40 p-3 rounded-full bg-gradient-to-r from-blue-500 to-cyan-500 text-white shadow-2xl hover:shadow-3xl transition-all"
      >
        <ChevronUp className="w-5 h-5" />
      </motion.button>

      {/* Modals */}
      <CommentsDrawer
        isOpen={showComments}
        onClose={() => setShowComments(false)}
        post={activePost}
        currentUser={currentUser}
        theme={theme}
        onCommentPosted={(updatedPost) => handlePostUpdate(activePost?.id, updatedPost)}
      />
      <PostOptionsDrawer
        isOpen={showPostOptions}
        onClose={() => setShowPostOptions(false)}
        post={activePost}
        currentUser={currentUser}
        theme={theme}
        navigate={navigate}
        onPostDelete={handlePostDelete}
      />
    </div>
  );
};

// ==================== SKELETON LOADER ====================
const PostCardSkeleton = ({ theme }) => (
  <div className={cn(
    "rounded-3xl overflow-hidden border w-full",
    theme === 'dark' ? 'bg-gray-800/50 border-gray-700' : 'bg-white border-gray-200'
  )}>
    <div className="p-4 border-b border-gray-700/30">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-gray-300 to-gray-400 dark:from-gray-700 dark:to-gray-800 animate-pulse" />
        <div className="flex-1">
          <div className="h-4 bg-gray-300 dark:bg-gray-700 rounded mb-2 w-1/3 animate-pulse" />
          <div className="h-3 bg-gray-300 dark:bg-gray-700 rounded w-1/4 animate-pulse" />
        </div>
      </div>
    </div>
    <div className="p-4">
      <div className="space-y-2">
        <div className="h-4 bg-gray-300 dark:bg-gray-700 rounded w-full animate-pulse" />
        <div className="h-4 bg-gray-300 dark:bg-gray-700 rounded w-5/6 animate-pulse" />
        <div className="h-4 bg-gray-300 dark:bg-gray-700 rounded w-4/6 animate-pulse" />
      </div>
    </div>
    <div className="h-64 bg-gradient-to-br from-gray-300 to-gray-400 dark:from-gray-700 dark:to-gray-800 animate-pulse" />
    <div className="p-4">
      <div className="flex justify-between">
        <div className="h-4 bg-gray-300 dark:bg-gray-700 rounded w-1/5 animate-pulse" />
        <div className="h-4 bg-gray-300 dark:bg-gray-700 rounded w-1/6 animate-pulse" />
      </div>
    </div>
  </div>
);

// ==================== SPONSORED AD CARD ====================
const SponsoredAdCard = ({ ad, theme }) => {
  return (
    <div className={cn(
      "rounded-2xl overflow-hidden border mb-6 relative",
      theme === 'dark' ? 'bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700' : 'bg-gradient-to-br from-blue-50 to-cyan-50 border-blue-200'
    )}>
      <div className="absolute top-3 right-3 z-10">
        <div className="px-3 py-1 rounded-full bg-gradient-to-r from-blue-500 to-cyan-500 text-white text-xs font-bold flex items-center gap-1">
          <Sparkles className="w-3 h-3" />
          Sponsored
        </div>
      </div>
      <div className="p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-full bg-gradient-to-r from-blue-500 to-cyan-500 flex items-center justify-center">
            <span className="text-white font-bold">AD</span>
          </div>
          <div>
            <h3 className="font-bold dark:text-white">{ad.title || 'Sponsored Content'}</h3>
            <p className="text-xs dark:text-gray-400">{ad.advertiser || 'Arvdoul Partner'}</p>
          </div>
        </div>
        <p className="dark:text-gray-300 mb-4">{ad.content || ad.description}</p>
        {ad.imageUrl && (
          <div className="rounded-xl overflow-hidden mb-4">
            <img src={ad.imageUrl} alt="Ad" className="w-full h-48 object-cover" loading="lazy" />
          </div>
        )}
        <button
          onClick={() => window.open(ad.link, '_blank')}
          className="w-full py-3 rounded-xl bg-gradient-to-r from-blue-500 to-cyan-500 text-white font-medium hover:shadow-lg transition-all"
        >
          {ad.cta || 'Learn More'}
        </button>
      </div>
    </div>
  );
};

export default HomeScreenUltimateProMax;