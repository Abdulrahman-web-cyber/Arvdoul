// src/screens/HomeScreen.jsx – ULTRA PRO MAX V17 (FINAL)
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext.jsx';
import { Compass, AlertCircle, ChevronUp, RefreshCw, Sparkles, Film } from 'lucide-react';
import Draggable from 'react-draggable';
import feedService from '../services/feedService.js';
import PostCard from './PostCard.jsx';
import CommentsDrawer from './CommentsDrawer.jsx';
import PostOptionsDrawer from './PostOptionsDrawer.jsx';
import { saveToCache, loadFromCache } from '../utils/offlineCache';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { triggerHaptic } from '../utils/haptics';

const cn = (...classes) => classes.filter(Boolean).join(' ');

const PostCardSkeleton = () => (
  <div className="rounded-3xl overflow-hidden border w-full mb-6 bg-gray-100 dark:bg-gray-800 animate-pulse">
    <div className="p-4 border-b border-gray-200 dark:border-gray-700">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-full bg-gray-300 dark:bg-gray-700" />
        <div className="flex-1">
          <div className="h-4 bg-gray-300 dark:bg-gray-700 rounded mb-2 w-1/3" />
          <div className="h-3 bg-gray-300 dark:bg-gray-700 rounded w-1/4" />
        </div>
      </div>
    </div>
    <div className="p-4 space-y-2">
      <div className="h-4 bg-gray-300 dark:bg-gray-700 rounded w-full" />
      <div className="h-4 bg-gray-300 dark:bg-gray-700 rounded w-5/6" />
      <div className="h-4 bg-gray-300 dark:bg-gray-700 rounded w-4/6" />
    </div>
    <div className="h-64 bg-gray-300 dark:bg-gray-700" />
  </div>
);

export default function HomeScreen() {
  const navigate = useNavigate();
  const { theme } = useTheme();
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const isDark = theme === 'dark';

  const [feed, setFeed] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const nextCursorRef = useRef(null);
  const isLoadingRef = useRef(false);
  const sentinelRef = useRef(null);

  const [activePost, setActivePost] = useState(null);
  const [showComments, setShowComments] = useState(false);
  const [showOptions, setShowOptions] = useState(false);

  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [showOnlineBanner, setShowOnlineBanner] = useState(false);
  const [showOfflineBanner, setShowOfflineBanner] = useState(!navigator.onLine);

  const [storyButtonPos, setStoryButtonPos] = useState(() => {
    const saved = localStorage.getItem('arvdoul_story_button_pos');
    return saved ? JSON.parse(saved) : { x: 0, y: 0 };
  });

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setShowOnlineBanner(true);
      setShowOfflineBanner(false);
      setTimeout(() => setShowOnlineBanner(false), 2000);
    };
    const handleOffline = () => {
      setIsOnline(false);
      setShowOfflineBanner(true);
      setShowOnlineBanner(false);
      setTimeout(() => setShowOfflineBanner(false), 4000);
    };
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const loadFeed = useCallback(async (reset = false, skipCache = false) => {
    if (!user?.uid) return;
    if (isLoadingRef.current) return;
    isLoadingRef.current = true;

    if (reset) {
      setLoading(true);
      setError(null);
      nextCursorRef.current = null;
    }

    try {
      const result = await feedService.getSmartFeed(user.uid, {
        limit: 12,
        lastDoc: reset ? null : nextCursorRef.current,
        forceRefresh: skipCache,
      });
      if (result.success) {
        setFeed(prev => {
          const prevMap = new Map(prev.map(p => [p.id, p]));
          const newPosts = result.feed.map(newPost => {
            const oldPost = prevMap.get(newPost.id);
            if (oldPost && JSON.stringify(oldPost) === JSON.stringify(newPost)) return oldPost;
            return newPost;
          });
          if (reset) return newPosts;
          const existingIds = new Set(prev.map(p => p.id));
          const uniqueNew = newPosts.filter(p => !existingIds.has(p.id));
          return [...prev, ...uniqueNew];
        });
        setHasMore(result.hasMore);
        nextCursorRef.current = result.nextCursor;
        if (reset) saveToCache(`feed_cache_${user.uid}`, result.feed.slice(0, 30));
      } else {
        setError(result.error || 'Failed to load feed');
      }
    } catch (err) {
      console.error('Feed error:', err);
      const cached = loadFromCache(`feed_cache_${user.uid}`);
      if (cached && feed.length === 0) setFeed(cached);
      else setError(err.message);
    } finally {
      setLoading(false);
      setLoadingMore(false);
      setRefreshing(false);
      isLoadingRef.current = false;
    }
  }, [user?.uid]);

  const handleRefresh = useCallback(async () => {
    if (refreshing) return;
    setRefreshing(true);
    triggerHaptic('medium');
    await loadFeed(true, true);
    toast.success('Feed refreshed!');
  }, [refreshing, loadFeed]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    if (!hasMore) return;
    if (loading || loadingMore || isLoadingRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !loadingMore && !isLoadingRef.current && hasMore) {
          setLoadingMore(true);
          loadFeed(false);
        }
      },
      { threshold: 0.1, rootMargin: '200px' }
    );
    observer.observe(sentinel);
    return () => {
      observer.unobserve(sentinel);
      observer.disconnect();
    };
  }, [hasMore, loadFeed, loading, loadingMore]);

  useEffect(() => {
    if (!user?.uid) return;
    let unsubscribe = null;
    const setup = async () => {
      unsubscribe = await feedService.subscribeToFeedUpdates(user.uid, (update) => {
        if (update.type === 'feed_updated' && update.feed?.length) {
          setFeed(prev => {
            const existingIds = new Set(prev.map(p => p.id));
            const incoming = update.feed.filter(p => !existingIds.has(p.id));
            if (incoming.length) {
              toast.info(`${incoming.length} new post${incoming.length > 1 ? 's' : ''} available – pull to refresh`, { duration: 2000, icon: '📱' });
              return [...incoming, ...prev];
            }
            return prev;
          });
        }
      });
    };
    setup();
    return () => {
      if (unsubscribe && typeof unsubscribe === 'function') unsubscribe();
    };
  }, [user?.uid]);

  useEffect(() => {
    if (!isAuthenticated || !user?.uid || authLoading) return;
    loadFeed(true);
  }, [isAuthenticated, user?.uid, authLoading, loadFeed]);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      navigate('/login', { replace: true });
    }
  }, [authLoading, isAuthenticated, navigate]);

  if (authLoading) {
    return (
      <div className={cn("min-h-screen flex items-center justify-center", isDark ? 'bg-gray-950' : 'bg-white')}>
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-gray-500">Loading Arvdoul...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("min-h-screen pt-20 pb-24 w-full", isDark ? 'bg-gradient-to-b from-gray-950 to-gray-900' : 'bg-gradient-to-b from-gray-50 to-white')}>
      
      <AnimatePresence>
        {showOnlineBanner && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="fixed top-20 left-1/2 transform -translate-x-1/2 z-50 bg-green-500 text-white text-center py-1 px-4 rounded-full text-xs font-semibold shadow-md shadow-green-500/30"
          >
            <Sparkles className="w-3 h-3 inline mr-1" /> Back online
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showOfflineBanner && !isOnline && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="fixed top-20 left-1/2 transform -translate-x-1/2 z-50 bg-amber-500 text-white text-center py-1 px-4 rounded-full text-xs font-semibold shadow-md shadow-amber-500/30"
          >
            Offline – cached content
          </motion.div>
        )}
      </AnimatePresence>

      <Draggable
        position={storyButtonPos}
        onStop={(e, data) => {
          const newPos = { x: data.x, y: data.y };
          setStoryButtonPos(newPos);
          localStorage.setItem('arvdoul_story_button_pos', JSON.stringify(newPos));
        }}
        bounds="parent"
        handle=".drag-handle"
      >
        <div className="fixed z-50" style={{ top: 0, left: 0 }}>
          <div className="drag-handle cursor-grab active:cursor-grabbing">
            <motion.button
              whileTap={{ scale: 0.95 }}
              whileHover={{ scale: 1.05 }}
              onClick={() => navigate('/stories')}
              className={cn(
                "p-3 rounded-full bg-gradient-to-r shadow-xl backdrop-blur-sm border transition-all duration-200",
                isDark
                  ? "from-purple-600 to-pink-600 text-white border-purple-400/50 hover:shadow-purple-500/30"
                  : "from-orange-500 to-red-500 text-white border-orange-400/50 hover:shadow-orange-500/30",
                "hover:shadow-xl story-button-glow"
              )}
              style={{ boxShadow: isDark ? "0 0 12px rgba(168,85,247,0.6)" : "0 0 12px rgba(249,115,22,0.6)" }}
            >
              <Film className="w-6 h-6" />
            </motion.button>
          </div>
        </div>
      </Draggable>

      {refreshing && (
        <div className="fixed top-20 left-1/2 transform -translate-x-1/2 z-50 bg-indigo-500 text-white px-4 py-1 rounded-full text-xs shadow-lg">
          <RefreshCw className="w-3 h-3 inline animate-spin mr-1" /> Refreshing...
        </div>
      )}

      <div className="max-w-2xl mx-auto px-4">
        {loading && feed.length === 0 ? (
          <div className="space-y-6">
            <PostCardSkeleton />
            <PostCardSkeleton />
            <PostCardSkeleton />
          </div>
        ) : error && feed.length === 0 ? (
          <div className="min-h-[60vh] flex items-center justify-center">
            <div className="text-center">
              <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
              <h3 className="text-xl font-bold mb-2 dark:text-white">Connection Error</h3>
              <p className="text-gray-500 dark:text-gray-400 mb-6">{error}</p>
              <button onClick={handleRefresh} className="px-6 py-3 rounded-xl bg-gradient-to-r from-blue-500 to-cyan-500 text-white font-medium">Retry</button>
            </div>
          </div>
        ) : feed.length === 0 && !loading ? (
          <div className="min-h-[60vh] flex items-center justify-center">
            <div className="text-center">
              <Compass className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-xl font-bold mb-2 dark:text-white">Welcome to Arvdoul!</h3>
              <p className="text-gray-500 dark:text-gray-400 mb-6">Follow creators to see content.</p>
              <button onClick={() => navigate('/explore')} className="px-6 py-3 rounded-xl bg-gradient-to-r from-blue-500 to-cyan-500 text-white font-medium">Discover</button>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {feed.map((post) => (
              <ErrorBoundary key={post.id} fallback={<div className="text-red-500 p-4 text-center">Failed to load post</div>}>
                <PostCard
                  post={post}
                  currentUser={user}
                  onOpenComments={(p) => { setActivePost(p); setShowComments(true); }}
                  onOpenOptions={(p) => { setActivePost(p); setShowOptions(true); }}
                />
              </ErrorBoundary>
            ))}
            {hasMore && <div ref={sentinelRef} className="h-10" />}
            {loadingMore && <div className="py-4 text-center text-gray-500">Loading more…</div>}
          </div>
        )}
      </div>

      <ScrollToTopButton />

      {showComments && activePost && (
        <CommentsDrawer isOpen={showComments} onClose={() => setShowComments(false)} post={activePost} currentUser={user} theme={theme} />
      )}
      {showOptions && activePost && (
        <PostOptionsDrawer isOpen={showOptions} onClose={() => setShowOptions(false)} post={activePost} currentUser={user} navigate={navigate} theme={theme} />
      )}
    </div>
  );
}

function ScrollToTopButton() {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const toggle = () => setVisible(window.scrollY > 300);
    window.addEventListener('scroll', toggle);
    return () => window.removeEventListener('scroll', toggle);
  }, []);
  if (!visible) return null;
  return (
    <motion.button
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.8 }}
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      className="fixed bottom-24 right-4 z-40 p-3 rounded-full bg-gradient-to-r from-blue-500 to-cyan-500 text-white shadow-2xl hover:shadow-3xl transition-all"
    >
      <ChevronUp className="w-6 h-6" />
    </motion.button>
  );
}