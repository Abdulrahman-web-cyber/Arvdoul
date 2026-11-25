// src/components/Videos/VideoFeed.jsx
//
// Vertical snap Sparks feed with gesture support, interactive modals, and bounded preloading

import { useRef, useState, useEffect, useCallback, useMemo, memo } from 'react';
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
import settingsService from '../../services/settingsService';
import { Loader2, RefreshCw, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import PropTypes from 'prop-types';
import { BRAND_GRADIENT } from '../../design-system/tokens.js';

/**
 * VideoFeed - Vertical snap Spark feed with gesture navigation and rich overlays
 */
const VideoFeed = memo(({
  videos: rawVideos = [],
  loading = false,
  error = null,
  onLoadMore,
  onRefresh,
  hasMore = true,
  feedType = 'sparks',
  onFeedTypeChange,
  onOpenSearch,
  onCreateVideo,
  viewMode = 'feed',
  onToggleViewMode,
  onOpenReels,
}) => {
  const containerRef = useRef(null);
  const { isDark } = useTheme();
  const {
    currentIndex: storeIndex,
    setCurrentIndex: storeSetIndex,
    updateVideo,
    removeVideo,
    addToWatchLater,
    removeFromWatchLater,
    notInterestedIds,
  } = useVideoStore();
  const [currentIndex, setCurrentIndex] = useState(() => Math.max(0, storeIndex || 0));
  const [showComments, setShowComments] = useState(false);
  const [showShareSheet, setShowShareSheet] = useState(false);
  const [showGiftModal, setShowGiftModal] = useState(false);
  const [showReportSheet, setShowReportSheet] = useState(false);
  const [selectedVideo, setSelectedVideo] = useState(null);

  const { user } = useAuth();
  const autoPlayEnabled = settingsService.getCachedSettings(user?.uid)?.playback?.autoPlayVideos !== false;

  const videos = useMemo(() => {
    if (!Array.isArray(notInterestedIds) || notInterestedIds.length === 0) return rawVideos;
    const blocked = new Set(notInterestedIds);
    return rawVideos.filter((v) => v?.id && !blocked.has(v.id));
  }, [rawVideos, notInterestedIds]);

  const videosSignature = useMemo(() => videos.map((v) => v.id).join(','), [videos]);

  // Restore scroll position when returning from GridView with a selected video index.
  useEffect(() => {
    if (!containerRef.current || videos.length === 0) return;
    const target = Math.max(0, Math.min(storeIndex || 0, videos.length - 1));
    if (target !== currentIndex) setCurrentIndex(target);
    const { clientHeight, scrollTop } = containerRef.current;
    if (clientHeight > 0 && Math.abs(scrollTop - target * clientHeight) > 8) {
      containerRef.current.scrollTo({ top: target * clientHeight, behavior: 'auto' });
    }
  }, [storeIndex, videos.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const viewStartRef = useRef(null);
  const flushedViewRef = useRef(null);
  const activeVideoId = videos[currentIndex]?.id;
  useEffect(() => {
    if (!activeVideoId || !user?.uid) return undefined;
    viewStartRef.current = Date.now();
    flushedViewRef.current = null;
    const flushView = () => {
      if (!viewStartRef.current || flushedViewRef.current === activeVideoId) return;
      const seconds = Math.round((Date.now() - viewStartRef.current) / 1000);
      viewStartRef.current = null;
      if (seconds >= 1) {
        flushedViewRef.current = activeVideoId;
        videoService.recordVideoView(activeVideoId, { watchDuration: seconds, duration: seconds }).catch((e) => {
          console.warn('[VideoFeed] view not recorded', e?.message);
        });
      }
    };
    window.addEventListener('pagehide', flushView);
    return () => {
      window.removeEventListener('pagehide', flushView);
      flushView();
    };
  }, [activeVideoId, user?.uid]);

  const [followStates, setFollowStates] = useState(() => new Map());
  useEffect(() => {
    if (!user?.uid || videos.length === 0) {
      setFollowStates(new Map());
      return undefined;
    }
    let cancelled = false;
    (async () => {
      try {
        const creatorIds = [...new Set(videos.map((v) => v.userId || v.authorId || v.creator?.id).filter(Boolean))];
        if (creatorIds.length === 0) return;
        const { getUserService } = await import('../../services/userService.js');
        const states = await getUserService().getFollowStates(user.uid, creatorIds);
        if (cancelled) return;
        setFollowStates(new Map([...states].map(([id, s]) => [id, {
          isFollowing: Boolean(s?.isFollowing),
          requestStatus: s?.requestStatus ?? null,
        }])));
      } catch (err) {
        console.warn('Could not resolve follow state:', err);
      }
    })();
    return () => { cancelled = true; };
  }, [user?.uid, videosSignature]); // eslint-disable-line react-hooks/exhaustive-deps

  const currentVideo = videos[currentIndex] || videos[0] || null;
  const activeModalVideo = selectedVideo
    ? videos.find((v) => v.id === selectedVideo.id) || selectedVideo
    : currentVideo;

  // Preload a small, bounded window of adjacent progressive assets (skipping signed HLS manifests
  // which are fetched and tokenized on demand by useHlsVideo).
  const preloadRef = useRef(new Map());

  useEffect(() => {
    const wanted = [currentIndex, currentIndex + 1, currentIndex + 2]
      .map((i) => videos[i])
      .filter(Boolean);
    const wantedIds = new Set(wanted.map((v) => v.id));

    for (const [id, el] of preloadRef.current) {
      if (!wantedIds.has(id)) {
        el.removeAttribute('src');
        el.load();
        preloadRef.current.delete(id);
      }
    }
    for (const vid of wanted) {
      if (preloadRef.current.has(vid.id)) continue;
      const candidateUrl = vid.signedUrl || vid.videoUrl || vid.url || '';
      const isHls = /\.m3u8(\?|$)/i.test(candidateUrl) || candidateUrl.includes('stream.mux.com/');
      if (!candidateUrl || isHls) continue;
      const el = document.createElement('video');
      el.preload = 'metadata';
      el.muted = true;
      el.src = candidateUrl;
      preloadRef.current.set(vid.id, el);
    }
  }, [videos, currentIndex]);

  useEffect(() => {
    const preloaders = preloadRef.current;
    return () => {
      for (const el of preloaders.values()) {
        el.removeAttribute('src');
        el.load();
      }
      preloaders.clear();
    };
  }, []);

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

  const handleScroll = useCallback(() => {
    if (!containerRef.current) return;
    const { scrollTop, clientHeight } = containerRef.current;
    if (!clientHeight) return;
    const newIndex = Math.round(scrollTop / clientHeight);

    if (newIndex !== currentIndex && newIndex >= 0 && newIndex < videos.length) {
      setCurrentIndex(newIndex);
      storeSetIndex(newIndex);

      if (newIndex >= videos.length - 2 && hasMore && onLoadMore && !loading) {
        onLoadMore();
      }
    }
  }, [currentIndex, videos.length, hasMore, onLoadMore, loading, storeSetIndex]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (showComments || showShareSheet || showGiftModal || showReportSheet) return;

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
  }, [currentIndex, scrollToIndex, showComments, showShareSheet, showGiftModal, showReportSheet]);

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

  const handleLike = useCallback(async (video) => {
    if (!video) return;
    if (!user?.uid) {
      toast.error('Sign in to like Sparks');
      return;
    }
    const wasLiked = video.isLiked;
    const knownLikes = typeof video.likes === 'number' ? video.likes : null;
    const shift = (base) => (base === null ? null : Math.max(0, base + (wasLiked ? -1 : 1)));
    const withFormatted = (n) => (
      n === null
        ? { likes: null, likesFormatted: null, stats: { ...(video.stats || {}), likes: null } }
        : { likes: n, likesFormatted: n > 1000 ? `${(n / 1000).toFixed(1)}K` : `${n}`, stats: { ...(video.stats || {}), likes: n } }
    );

    updateVideo(video.id, { isLiked: !wasLiked, ...withFormatted(shift(knownLikes)) });

    try {
      const res = await videoService.likeVideo(video.id);
      const serverLiked = res?.action ? res.action === 'liked' : !wasLiked;
      const serverLikes = knownLikes === null || serverLiked === wasLiked
        ? knownLikes
        : Math.max(0, knownLikes + (serverLiked ? 1 : -1));
      updateVideo(video.id, { isLiked: serverLiked, ...withFormatted(serverLikes) });
    } catch {
      updateVideo(video.id, { isLiked: wasLiked, ...withFormatted(knownLikes) });
      toast.error('Could not update like');
    }
  }, [updateVideo, user?.uid]);

  const handleComment = useCallback((video) => {
    setSelectedVideo(video);
    setShowComments(true);
  }, []);

  const handleShare = useCallback((video) => {
    setSelectedVideo(video);
    setShowShareSheet(true);
  }, []);

  const handleSave = useCallback(async (video) => {
    if (!video) return;
    if (!user?.uid) {
      toast.error('Sign in to save Sparks');
      return;
    }
    const wasSaved = video.isSaved;
    const knownSaves = typeof video.saves === 'number'
      ? video.saves
      : (typeof video.stats?.saves === 'number' ? video.stats.saves : null);
    const shiftSaves = (base) => (base === null ? null : Math.max(0, base + (wasSaved ? -1 : 1)));
    const nextSaves = shiftSaves(knownSaves);
    updateVideo(video.id, {
      isSaved: !wasSaved,
      saves: nextSaves,
      stats: { ...(video.stats || {}), saves: nextSaves },
    });
    if (!wasSaved) {
      addToWatchLater(video);
      toast.success('Saved to your collection');
    } else {
      removeFromWatchLater(video.id);
      toast.info('Removed from saved');
    }

    try {
      if (wasSaved) {
        await videoService.unsaveVideo(video.id, user.uid);
      } else {
        await videoService.saveVideo(video.id, user.uid);
      }
    } catch (err) {
      updateVideo(video.id, {
        isSaved: wasSaved,
        saves: knownSaves,
        stats: { ...(video.stats || {}), saves: knownSaves },
      });
      if (wasSaved) addToWatchLater(video);
      else removeFromWatchLater(video.id);
      toast.error(err?.message || 'Could not sync save');
    }
  }, [updateVideo, addToWatchLater, removeFromWatchLater, user?.uid]);

  const handleGift = useCallback((video) => {
    setSelectedVideo(video);
    setShowGiftModal(true);
  }, []);

  const handleReport = useCallback((video) => {
    setSelectedVideo(video);
    setShowReportSheet(true);
  }, []);

  const adjustCounter = useCallback((target, field, delta) => {
    if (!target?.id) return;
    const cur = typeof target[field] === 'number' ? target[field] : target.stats?.[field];
    if (typeof cur === 'number') {
      const nextVal = Math.max(0, cur + delta);
      updateVideo(target.id, {
        [field]: nextVal,
        stats: { ...(target.stats || {}), [field]: nextVal },
      });
    }
  }, [updateVideo]);

  return (
    <div
      className={`relative w-full h-full overflow-hidden select-none ${
        isDark ? 'bg-[#03071B] text-white' : 'bg-[#F6F8FC] text-slate-900'
      }`}
    >
      {/* Floating Top Bar Navigation */}
      <VideoTopBar
        activeTab={feedType}
        onTabChange={onFeedTypeChange}
        onOpenSearch={onOpenSearch}
        onCreateVideo={onCreateVideo}
        viewMode={viewMode}
        onToggleViewMode={onToggleViewMode}
        onOpenReels={onOpenReels}
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
                autoPlay={autoPlayEnabled && index === currentIndex}
                followedByViewer={Boolean(followStates.get(video.userId || video.authorId || video.creator?.id)?.isFollowing)}
                requestPending={followStates.get(video.userId || video.authorId || video.creator?.id)?.requestStatus === 'pending'}
                onLike={() => handleLike(video)}
                onComment={() => handleComment(video)}
                onShare={() => handleShare(video)}
                onSave={() => handleSave(video)}
                onGift={() => handleGift(video)}
                onReport={() => handleReport(video)}
                onFollow={(_creator, nextState) => {
                  const creatorId = video.userId || video.authorId || video.creator?.id;
                  if (!creatorId || !nextState) return;
                  setFollowStates((prev) => {
                    const next = new Map(prev);
                    next.set(creatorId, nextState);
                    return next;
                  });
                }}
              />
            </div>
          ))
        ) : !loading && !error ? (
          <EmptyState onRefresh={onRefresh} isDark={isDark} />
        ) : null}

        {loading && videos.length > 0 && (
          <div className={`h-24 flex items-center justify-center backdrop-blur-xl ${
            isDark ? 'bg-black/80' : 'bg-[#F6F8FC]/90'
          }`}>
            <Loader2 className="w-8 h-8 text-purple-500 animate-spin" />
          </div>
        )}
      </div>

      {/* Loading Skeleton State */}
      <AnimatePresence>
        {loading && videos.length === 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className={`absolute inset-0 z-30 flex flex-col justify-between p-6 pb-28 lg:pb-8 animate-pulse select-none ${
              isDark ? 'bg-[#03071B]' : 'bg-[#F6F8FC]'
            }`}
          >
            <div className="flex items-center justify-between pt-2">
              <div className={`w-20 h-6 rounded-full ${isDark ? 'bg-white/10' : 'bg-slate-200'}`} />
              <div className="flex gap-4">
                <div className={`w-16 h-6 rounded-full ${isDark ? 'bg-white/10' : 'bg-slate-200'}`} />
                <div className={`w-16 h-6 rounded-full ${isDark ? 'bg-white/10' : 'bg-slate-200'}`} />
              </div>
              <div className={`w-8 h-8 rounded-full ${isDark ? 'bg-white/10' : 'bg-slate-200'}`} />
            </div>

            <div className="flex-1 flex items-center justify-center">
              <div className={`w-14 h-14 rounded-full flex items-center justify-center border ${
                isDark ? 'bg-white/5 border-white/10' : 'bg-white border-slate-200 shadow-sm'
              }`}>
                <div className="w-6 h-6 rounded-full border-2 border-purple-500 border-t-transparent animate-spin" />
              </div>
            </div>

            <div className="flex items-end justify-between pb-6">
              <div className="space-y-3 max-w-[70%]">
                <div className="flex items-center gap-2">
                  <div className={`w-10 h-10 rounded-full ${isDark ? 'bg-white/15' : 'bg-slate-200'}`} />
                  <div className="space-y-1">
                    <div className={`w-24 h-4 rounded-lg ${isDark ? 'bg-white/15' : 'bg-slate-200'}`} />
                    <div className={`w-16 h-3 rounded-lg ${isDark ? 'bg-white/10' : 'bg-slate-200'}`} />
                  </div>
                </div>
                <div className={`w-48 h-3.5 rounded-lg ${isDark ? 'bg-white/10' : 'bg-slate-200'}`} />
                <div className={`w-32 h-3 rounded-lg ${isDark ? 'bg-white/10' : 'bg-slate-200'}`} />
              </div>

              <div className="flex flex-col items-center gap-5 pr-2">
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className={`w-11 h-11 rounded-full ${isDark ? 'bg-white/10' : 'bg-slate-200'}`} />
                ))}
              </div>
            </div>
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
            className={`absolute inset-0 flex flex-col items-center justify-center backdrop-blur-2xl p-8 z-30 ${
              isDark ? 'bg-[#03071B]/95' : 'bg-[#F6F8FC]/95'
            }`}
          >
            <AlertCircle className="w-16 h-16 text-red-500 mb-4" />
            <h3 className={`text-xl font-black mb-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>Could Not Load Sparks</h3>
            <p className={`text-center mb-6 max-w-sm text-sm ${isDark ? 'text-white/60' : 'text-slate-600'}`}>{error}</p>
            <motion.button
              type="button"
              whileTap={{ scale: 0.95 }}
              onClick={onRefresh}
              className="flex items-center gap-2 px-6 py-3 min-h-[44px] rounded-full text-white font-bold text-sm shadow-xl"
              style={{ background: BRAND_GRADIENT }}
            >
              <RefreshCw className="w-4 h-4" />
              Try Again
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>

      <VideoComments
        isOpen={showComments}
        onClose={() => setShowComments(false)}
        video={activeModalVideo}
        onCommentAdded={() => adjustCounter(activeModalVideo, 'comments', 1)}
        onCommentDeleted={() => adjustCounter(activeModalVideo, 'comments', -1)}
      />

      <VideoBottomSheet
        isOpen={showShareSheet}
        onClose={() => setShowShareSheet(false)}
        video={activeModalVideo}
        onShared={(sharedVideo) => adjustCounter(sharedVideo, 'shares', 1)}
        onSaveStateChange={(vidId, nextSaved) => {
          const v = videos.find((item) => item.id === vidId);
          if (!v) return;
          const knownSaves = typeof v.saves === 'number' ? v.saves : (typeof v.stats?.saves === 'number' ? v.stats.saves : null);
          const delta = nextSaved === Boolean(v.isSaved) ? 0 : (nextSaved ? 1 : -1);
          const nextSaves = knownSaves === null ? null : Math.max(0, knownSaves + delta);
          updateVideo(vidId, {
            isSaved: nextSaved,
            saves: nextSaves,
            stats: { ...(v.stats || {}), saves: nextSaves },
          });
        }}
        onDeleted={(deletedId) => {
          removeVideo(deletedId);
          setSelectedVideo(null);
        }}
      />

      <VideoBottomSheet
        isOpen={showReportSheet}
        onClose={() => setShowReportSheet(false)}
        video={activeModalVideo}
        initialView="report"
        onShared={(sharedVideo) => adjustCounter(sharedVideo, 'shares', 1)}
        onDeleted={(deletedId) => {
          removeVideo(deletedId);
          setSelectedVideo(null);
        }}
      />

      <VideoGiftModal
        isOpen={showGiftModal}
        onClose={() => setShowGiftModal(false)}
        creator={activeModalVideo?.creator}
        video={activeModalVideo}
        onGiftSent={() => adjustCounter(activeModalVideo, 'gifts', 1)}
      />
    </div>
  );
});

VideoFeed.displayName = 'VideoFeed';

const EmptyState = memo(({ onRefresh, isDark }) => (
  <div className={`h-full flex flex-col items-center justify-center p-8 text-center ${
    isDark ? 'bg-[#03071B]' : 'bg-[#F6F8FC]'
  }`}>
    <div className={`w-24 h-24 mb-6 rounded-3xl border flex items-center justify-center shadow-2xl ${
      isDark ? 'bg-white/5 border-white/10' : 'bg-white border-slate-200'
    }`}>
      <RefreshCw className={`w-10 h-10 ${isDark ? 'text-white/30' : 'text-slate-400'}`} />
    </div>
    <h3 className={`text-2xl font-black mb-2 tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>No Sparks in Feed</h3>
    <p className={`text-sm max-w-xs mb-6 ${isDark ? 'text-white/60' : 'text-slate-600'}`}>
      Explore trending creators and discover fresh Sparks across Arvdoul
    </p>
    <motion.button
      type="button"
      whileTap={{ scale: 0.95 }}
      onClick={onRefresh}
      className="px-6 py-3 min-h-[44px] rounded-full text-white font-bold text-sm shadow-lg"
      style={{ background: BRAND_GRADIENT }}
    >
      Refresh Feed
    </motion.button>
  </div>
));

EmptyState.displayName = 'EmptyState';
EmptyState.propTypes = {
  onRefresh: PropTypes.func,
  isDark: PropTypes.bool,
};

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
  viewMode: PropTypes.string,
  onToggleViewMode: PropTypes.func,
  onOpenReels: PropTypes.func,
};

export default VideoFeed;
