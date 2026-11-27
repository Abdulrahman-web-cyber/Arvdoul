// src/screens/ReelsScreen.jsx

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import settingsService from '../services/settingsService.js';
import { useTheme } from '../context/ThemeContext';
import { useLayoutChrome } from '../context/LayoutChromeContext.jsx';
import { cn } from '../lib/utils';
import { BRAND_GRADIENT } from '../design-system/tokens.js';
import {
  Heart,
  MessageCircle,
  Share2,
  Bookmark,
  Gift,
  MoreVertical,
  Volume2,
  VolumeX,
  Play,
  Pause,
  Search,
  Camera,
  Sparkles,
  CheckCircle2,
  Music,
  AlertCircle,
  Check,
  Clock,
  Plus,
  ArrowLeft,
  ChevronUp,
  ChevronDown,
} from "lucide-react";
import videoService from '../services/videoService';
import useHlsVideo from '../hooks/useHlsVideo.js';
import { useSparkViewTracking } from '../hooks/useSparkInteractions.js';
import { useSparksFeed, normalizeSparkItem } from '../hooks/useSparksFeed.js';
import { getUserService } from '../services/userService';
import { TopAppLoadingBanner } from '../components/Navigation/RouteProgressBar';
import VideoBottomSheet from '../components/Videos/VideoBottomSheet';
import VideoComments from '../components/Videos/VideoComments';
import VideoGiftModal from '../components/Videos/VideoGiftModal';
import { ArvdoulEmblem } from '../components/Shared/ArvdoulLogo';
import { LazyImage } from '../components/Shared/LazyImage';

export default function ReelsScreen() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const targetReelId = searchParams.get('reelId');
  const { user } = useAuth();

const formatDuration = (seconds) => {
  const secs = Math.max(0, Math.round(Number(seconds) || 0));
  const m = Math.floor(secs / 60);
  const s2 = String(secs % 60).padStart(2, '0');
  return `${m}:${s2}`;
};

  const { isDark } = useTheme();
  const { hasTopAppBar } = useLayoutChrome();

  const [activeTab, setActiveTab] = useState('forYou'); // 'following' | 'forYou'
  const [currentReelIndex, setCurrentReelIndex] = useState(0);
  const [feedNonce, setFeedNonce] = useState(0);

  // Keep absent stats unknown (null, never fabricated 0) using canonical Spark normalizer.
  const mapVideoToReel = useCallback((v) => {
    const normalized = normalizeSparkItem(v);
    if (!normalized) return null;
    return {
      ...normalized,
      stats: {
        ...normalized.stats,
        likes: v.likes ?? v.stats?.likes ?? null,
        saves: v.saves ?? v.stats?.saves ?? null,
      },
    };
  }, []);

  const canonicalFeedType = activeTab === 'following' ? 'following' : 'for_you';
  const fetchReelsFeed = useCallback(
    (uid, opts) => videoService.getVideoFeed(uid, opts),
    []
  );
  const likeReelApi = useCallback((id) => videoService.likeVideo(id), []);
  const shareReelApi = useCallback((id, platform) => videoService.shareVideo(id, platform), []);

  const {
    items: reels,
    setItems: setReels,
    loading: feedLoading,
    setLoading: setFeedLoading,
    loadingMore,
    hasMore,
    error: feedError,
    setError: setFeedError,
    cursorRef,
    loadFeed,
    loadMore,
    patchItem: patchReel,
    removeItem,
    markNotInterested,
    toggleLike,
    toggleSave,
    shareItem,
    followCreator,
  } = useSparksFeed({
    viewerUid: user?.uid ?? null,
    feedType: canonicalFeedType,
    limit: 10,
    mode: 'local',
    targetId: targetReelId,
    syncWatchLater: false,
    fetchFeedFn: fetchReelsFeed,
    likeFn: likeReelApi,
    shareFn: shareReelApi,
    normalizeFn: mapVideoToReel,
  });

  // Honour the user's playback.autoPlayVideos preference (default on) instead of
  // hardcoding autoplay. When autoplay is off the reel waits for a tap on the
  // play overlay before it starts.
  const autoPlayEnabled = settingsService.getCachedSettings(user?.uid)?.playback?.autoPlayVideos !== false;
  const [isPlaying, setIsPlaying] = useState(autoPlayEnabled);
  const [isMuted, setIsMuted] = useState(false);
  const [showHeartBurst, setShowHeartBurst] = useState(false);
  const [giftModal, setGiftModal] = useState(false);
  const [sheetView, setSheetView] = useState(null); // 'comments' | 'share' | 'report'
  const [playback, setPlayback] = useState({ currentTime: 0, duration: 0, progress: 0 });
  const [tapFeedback, setTapFeedback] = useState(null); // 'play' | 'pause' | null
  const [captionExpanded, setCaptionExpanded] = useState(false);

  const videoRef = useRef(null);
  const touchStartY = useRef(0);
  const lastWheelRef = useRef(0);
  const tapTimerRef = useRef(null);
  const tapFeedbackTimerRef = useRef(null);
  const burstTimerRef = useRef(null);

  const currentReel = reels[currentReelIndex] || null;

  const hls = useHlsVideo({
    videoRef,
    video: currentReel,
    signedUrlCacheKey: currentReel?.canonicalPostId || currentReel?.id,
    enabled: Boolean(currentReel),
  });

  const loadReels = useCallback(async (tab) => {
    if (!user?.uid) {
      setReels([]);
      setFeedError(null);
      setFeedLoading(false);
      return;
    }
    const targetType = tab === 'following' ? 'following' : 'for_you';
    const res = await loadFeed(targetType, { replace: true });
    if (res?.items) {
      setCurrentReelIndex(res.initialIndex || 0);
    }
  }, [user?.uid, loadFeed, setReels, setFeedError, setFeedLoading]);

  useEffect(() => {
    if (feedNonce === 0) return;
    loadReels(activeTab);
  }, [feedNonce, activeTab, loadReels]);

  // Append the next page of reels so the feed does not stop at 10 videos.
  const loadMoreReels = useCallback(async () => {
    if (loadingMore || !cursorRef.current || !user?.uid) return;
    await loadMore({
      overrideFeedType: activeTab === 'following' ? 'following' : 'for_you',
      cursor: cursorRef.current,
    });
  }, [loadingMore, cursorRef, user?.uid, activeTab, loadMore]);

  useEffect(() => {
    loadReels(activeTab);
  }, [activeTab, loadReels]);

  // Prefetch the next page when the viewer nears the end of the loaded list.
  useEffect(() => {
    if (reels.length > 0 && hasMore && currentReelIndex >= reels.length - 2) {
      loadMoreReels();
    }
  }, [currentReelIndex, reels.length, hasMore, loadMoreReels]);

  // Synchronize Reels tab selector with canonical TopAppBar
  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent('arvdoul:sparks_header_state', {
        detail: {
          mode: 'reels',
          activeTab: activeTab === 'following' ? 'following' : 'for_you',
          viewMode: 'feed',
        },
      })
    );
  }, [activeTab]);

  useEffect(() => {
    const onChannelChange = (event) => {
      if (event?.detail?.mode && event.detail.mode !== 'reels') return;
      const next = event?.detail?.channel === 'following' ? 'following' : 'forYou';
      setActiveTab(next);
    };
    window.addEventListener('arvdoul:sparks_channel_change', onChannelChange);
    return () => window.removeEventListener('arvdoul:sparks_channel_change', onChannelChange);
  }, []);

  useEffect(() => {
    setCaptionExpanded(false);
  }, [currentReelIndex]);

  useEffect(() => () => {
    if (tapTimerRef.current) clearTimeout(tapTimerRef.current);
    if (tapFeedbackTimerRef.current) clearTimeout(tapFeedbackTimerRef.current);
    if (burstTimerRef.current) clearTimeout(burstTimerRef.current);
  }, []);

  // Mouse-wheel / trackpad navigation between reels (desktop).
  const handleWheel = useCallback((e) => {
    const now = Date.now();
    if (now - lastWheelRef.current < 500 || Math.abs(e.deltaY) < 20) return;
    lastWheelRef.current = now;
    if (e.deltaY > 0) handleNextReelRef.current();
    else handlePrevReelRef.current();
  }, []);

  const handleTouchStart = useCallback((e) => {
    touchStartY.current = e.touches[0].clientY;
  }, []);

  const handleTouchEnd = useCallback((e) => {
    const delta = touchStartY.current - e.changedTouches[0].clientY;
    if (Math.abs(delta) < 50) return;
    if (delta > 0) handleNextReelRef.current();
    else handlePrevReelRef.current();
  }, []);

  const triggerTapFeedback = useCallback((nextPlaying) => {
    setTapFeedback(nextPlaying ? 'play' : 'pause');
    if (tapFeedbackTimerRef.current) clearTimeout(tapFeedbackTimerRef.current);
    tapFeedbackTimerRef.current = setTimeout(() => setTapFeedback(null), 650);
  }, []);

  // Single tap toggles play/pause (debounced so double-tap heart burst never pauses).
  const handleCanvasTap = useCallback(() => {
    if (tapTimerRef.current) {
      clearTimeout(tapTimerRef.current);
      tapTimerRef.current = null;
      return;
    }
    tapTimerRef.current = setTimeout(() => {
      tapTimerRef.current = null;
      setIsPlaying((prev) => {
        const next = !prev;
        triggerTapFeedback(next);
        return next;
      });
    }, 220);
  }, [triggerTapFeedback]);

  // Handle Double Tap to Like
  const handleDoubleTap = () => {
    if (tapTimerRef.current) {
      clearTimeout(tapTimerRef.current);
      tapTimerRef.current = null;
    }
    if (!currentReel?.isLiked) {
      handleLike();
    }
    setShowHeartBurst(true);
    if (burstTimerRef.current) clearTimeout(burstTimerRef.current);
    burstTimerRef.current = setTimeout(() => setShowHeartBurst(false), 800);
  };

  const handleSeek = useCallback((percent) => {
    const el = videoRef.current;
    const total = el?.duration || currentReel?.duration || 0;
    const clamped = Math.min(100, Math.max(0, Number(percent) || 0));
    if (el && total > 0) {
      const nextTime = (clamped / 100) * total;
      el.currentTime = nextTime;
      setPlayback({ currentTime: nextTime, duration: total, progress: clamped });
    }
  }, [currentReel?.duration]);

  // Toggle Like — server-authoritative via canonical useSparksFeed + videoService.
  const handleLike = async () => {
    if (!currentReel) return;
    await toggleLike(currentReel);
  };

  // Toggle Bookmark — real server persistence via canonical useSparksFeed.
  const handleSave = async () => {
    if (!currentReel) return;
    await toggleSave(currentReel);
  };

  // Toggle Follow Creator — real follow/unfollow/request via canonical useSparksFeed.
  const handleFollow = async (creator) => {
    if (!creator?.id) return;
    await followCreator(creator, {
      follow: (_uid, targetId) => getUserService().followUser(user.uid, targetId),
      unfollow: (_uid, targetId) => getUserService().unfollowUser(user.uid, targetId),
      cancelRequest: (_uid, targetId) => getUserService().cancelFollowRequest(user.uid, targetId),
    });
  };

  // Share — real server-side share counter + AbortError-safe native share/clipboard.
  const handleShare = async () => {
    if (!currentReel) return;
    await shareItem(currentReel);
  };

  // Reporting is owned by VideoBottomSheet (videoService.reportVideo); the reels
  // screen only routes to it via `sheetView === 'report'`.

  // Keyboard navigation & Swipe gestures
  const handleNextReel = () => {
    if (currentReelIndex < reels.length - 1) {
      setCurrentReelIndex((i) => i + 1);
    }
  };

  const handlePrevReel = () => {
    if (currentReelIndex > 0) {
      setCurrentReelIndex((i) => i - 1);
    }
  };

  // Keep refs so gesture callbacks (defined before the handlers) can call them.
  const handleNextReelRef = useRef(() => {});
  const handlePrevReelRef = useRef(() => {});
  handleNextReelRef.current = handleNextReel;
  handlePrevReelRef.current = handlePrevReel;

  // Reflect the real play/pause state on the <video> element.
  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    if (isPlaying) el.play().catch(() => { /* ignore autoplay lock until user gesture */ });
    else el.pause();
  }, [isPlaying, currentReelIndex]);

  // Record a real, server-deduplicated view for each reel as the viewer leaves
  // it or backgrounds/closes the page, passing watchDuration.
  const activeReelId = reels[currentReelIndex]?.id;
  const recordReelView = useCallback((id, meta) => (
    videoService.recordVideoView(id, meta).catch((e) => {
      console.warn('[Reels] view not recorded', e?.message);
    })
  ), []);
  useSparkViewTracking(activeReelId, user?.uid, recordReelView, 'Reels');

  if (feedLoading && reels.length === 0) {
    return (
      <div className={cn(
        "h-full w-full flex items-center justify-center lg:px-6 overflow-hidden transition-colors",
        isDark ? "bg-[#03071B]" : "bg-[#F6F8FC]"
      )}>
        <TopAppLoadingBanner isAnimating={true} label="Loading sparks..." />
        <div
          aria-hidden="true"
          className={cn(
            "relative h-full w-full lg:max-w-[430px] lg:aspect-[9/16] lg:max-h-[calc(100dvh-2rem)] lg:rounded-[28px] lg:border overflow-hidden flex flex-col justify-between p-5 animate-pulse",
            isDark
              ? "lg:border-white/10 bg-[#080E27]"
              : "lg:border-slate-200/90 bg-white lg:shadow-[0_24px_70px_rgba(15,23,42,0.14)]"
          )}
        >
          <div className="flex items-center justify-between">
            <div className={cn("w-11 h-11 rounded-full", isDark ? "bg-white/10" : "bg-slate-200")} />
            <div className="flex gap-4">
              <div className={cn("w-16 h-5 rounded-full", isDark ? "bg-white/10" : "bg-slate-200")} />
              <div className={cn("w-16 h-5 rounded-full", isDark ? "bg-white/10" : "bg-slate-200")} />
            </div>
            <div className="flex gap-2">
              <div className={cn("w-11 h-11 rounded-full", isDark ? "bg-white/10" : "bg-slate-200")} />
              <div className={cn("w-11 h-11 rounded-full", isDark ? "bg-white/10" : "bg-slate-200")} />
            </div>
          </div>
          <div className="flex items-end justify-between gap-4 pb-[90px] lg:pb-0">
            <div className="flex-1 space-y-2.5">
              <div className="flex items-center gap-2.5">
                <div className={cn("w-9 h-9 rounded-full", isDark ? "bg-white/15" : "bg-slate-300")} />
                <div className={cn("h-3.5 w-28 rounded-full", isDark ? "bg-white/15" : "bg-slate-300")} />
              </div>
              <div className={cn("h-3 w-4/5 rounded-full", isDark ? "bg-white/10" : "bg-slate-200")} />
              <div className={cn("h-3 w-3/5 rounded-full", isDark ? "bg-white/10" : "bg-slate-200")} />
            </div>
            <div className="flex flex-col gap-3">
              {[0, 1, 2, 3].map((idx) => (
                <div key={idx} className={cn("w-11 h-11 rounded-full", isDark ? "bg-white/10" : "bg-slate-200")} />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!feedLoading && (!reels || reels.length === 0 || !currentReel)) {
    const backBtnClass = isDark
      ? "bg-white/10 hover:bg-white/15 border-white/15 text-white"
      : "bg-white hover:bg-slate-100 border-slate-200 text-slate-900 shadow-sm";
    const secondaryBtnClass = isDark
      ? "bg-white/10 hover:bg-white/15 border-white/10 text-white"
      : "bg-white hover:bg-slate-100 border-slate-200 text-slate-900 shadow-sm";

    if (feedError) {
      return (
        <div className={cn(
          "relative h-full w-full flex flex-col items-center justify-center p-6 text-center transition-colors",
          isDark ? "bg-[#03071B] text-white" : "bg-[#F6F8FC] text-slate-900"
        )}>
          {!hasTopAppBar && (
            <button
              type="button"
              aria-label="Go back"
              onClick={() => navigate(-1)}
              className={cn(
                "absolute top-4 left-4 min-w-[44px] min-h-[44px] rounded-full border flex items-center justify-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-arvdoul-purple",
                backBtnClass
              )}
            >
              <ArrowLeft className="w-5 h-5" aria-hidden="true" />
            </button>
          )}
          <div role="alert" className="max-w-sm space-y-4">
            <div aria-hidden="true" className="w-14 h-14 mx-auto rounded-2xl bg-red-500/15 border border-red-500/30 flex items-center justify-center">
              <AlertCircle className="w-7 h-7 text-red-400" />
            </div>
            <h2 className="text-xl font-black tracking-tight">Could not load Sparks</h2>
            <p className={cn("text-sm leading-relaxed", isDark ? "text-white/65" : "text-slate-600")}>{feedError}</p>
            <div className="flex items-center justify-center gap-3 pt-1">
              <button
                type="button"
                onClick={() => setFeedNonce((n) => n + 1)}
                className="min-h-[44px] px-6 rounded-2xl text-white font-bold text-sm shadow-lg hover:brightness-105 active:scale-[0.98] transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-arvdoul-purple"
                style={{ background: BRAND_GRADIENT }}
              >
                Retry
              </button>
              <button
                type="button"
                onClick={() => navigate('/sparks')}
                className={cn(
                  "min-h-[44px] px-5 rounded-2xl border font-semibold text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-arvdoul-purple",
                  secondaryBtnClass
                )}
              >
                Explore Sparks
              </button>
            </div>
          </div>
        </div>
      );
    }
    return (
      <div className={cn(
        "relative h-full w-full flex flex-col items-center justify-center p-6 text-center overflow-hidden transition-colors",
        isDark ? "bg-[#03071B] text-white" : "bg-[#F6F8FC] text-slate-900"
      )}>
        {!hasTopAppBar && (
          <button
            type="button"
            aria-label="Go back"
            onClick={() => navigate(-1)}
            className={cn(
              "absolute top-4 left-4 min-w-[44px] min-h-[44px] rounded-full border flex items-center justify-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-arvdoul-purple",
              backBtnClass
            )}
          >
            <ArrowLeft className="w-5 h-5" aria-hidden="true" />
          </button>
        )}
        <div className="max-w-sm space-y-4 relative z-10">
          <div className={cn(
            "w-16 h-16 mx-auto rounded-2xl flex items-center justify-center border shadow-xl",
            isDark ? "border-white/15 bg-white/[0.06]" : "border-slate-200 bg-white"
          )}>
            <Sparkles className="w-8 h-8 text-amber-400" aria-hidden="true" />
          </div>
          <h2 className="text-2xl font-black tracking-tight">
            {activeTab === 'following' ? 'No Following Sparks Yet' : 'No Sparks Yet'}
          </h2>
          <p className={cn("text-sm leading-relaxed", isDark ? "text-white/65" : "text-slate-600")}>
            {activeTab === 'following'
              ? 'Follow more creators or switch back to For You to discover trending short videos.'
              : 'Be the first creator to ignite a spark with short videos and music.'}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3 pt-1">
            {activeTab === 'following' ? (
              <button
                type="button"
                onClick={() => setActiveTab('forYou')}
                className="min-h-[44px] px-6 rounded-2xl text-white font-bold text-sm shadow-lg hover:brightness-105 active:scale-[0.98] transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-arvdoul-purple"
                style={{ background: BRAND_GRADIENT }}
              >
                Switch to For You
              </button>
            ) : (
              <button
                type="button"
                onClick={() => navigate('/create-post?type=video')}
                className="min-h-[44px] px-6 rounded-2xl text-white font-bold text-sm shadow-lg hover:brightness-105 active:scale-[0.98] transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-arvdoul-purple"
                style={{ background: BRAND_GRADIENT }}
              >
                Create Spark
              </button>
            )}
            <button
              type="button"
              onClick={() => navigate('/sparks')}
              className={cn(
                "min-h-[44px] px-5 rounded-2xl border font-semibold text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-arvdoul-purple",
                secondaryBtnClass
              )}
            >
              Explore Sparks
            </button>
          </div>
        </div>
      </div>
    );
  }

  const creatorFallbackName = currentReel.creator.name || (currentReel.creator.id ? `user ${String(currentReel.creator.id).slice(0, 6)}` : '');
  const hasLongCaption = Boolean(currentReel.title && currentReel.title.length > 90);
  const railPillClass = isDark
    ? "bg-[#03071B]/50 border-white/15 text-white hover:bg-[#03071B]/75"
    : "bg-white/85 border-white/90 text-slate-900 hover:bg-white shadow-lg";

  return (
    <div className={cn(
      "relative h-full w-full flex items-center justify-center lg:gap-6 lg:px-6 overflow-hidden transition-colors duration-300",
      isDark ? "bg-[#03071B]" : "bg-[#F6F8FC]"
    )}>
      {/* Subtle desktop theater ambiance */}
      <div
        aria-hidden="true"
        className={cn(
          "hidden lg:block pointer-events-none absolute w-[520px] h-[520px] rounded-full blur-3xl",
          isDark ? "bg-arvdoul-purple/10" : "bg-arvdoul-purple/10"
        )}
      />

      <div
        onKeyDown={(e) => {
          if (e.key === 'ArrowUp') {
            e.preventDefault();
            handlePrevReel();
          }
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            handleNextReel();
          }
          if (e.key === 'm' || e.key === 'M') {
            setIsMuted((m) => !m);
          }
          if (e.key === ' ' && e.target === e.currentTarget) {
            e.preventDefault();
            setIsPlaying((p) => {
              const next = !p;
              triggerTapFeedback(next);
              return next;
            });
          }
        }}
        onWheel={handleWheel}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        tabIndex={0}
        aria-label="Reels player"
        className={cn(
          "relative h-full w-full lg:max-w-[430px] lg:aspect-[9/16] lg:rounded-[28px] lg:border overflow-hidden select-none flex flex-col justify-between focus:outline-none focus-visible:ring-2 focus-visible:ring-arvdoul-purple text-white",
          hasTopAppBar ? "lg:max-h-[calc(100dvh-6.25rem)]" : "lg:max-h-[calc(100dvh-2rem)]",
          isDark
            ? "lg:border-white/15 lg:shadow-[0_24px_80px_rgba(0,0,0,0.65)] bg-[#03071B]"
            : "lg:border-slate-200/90 lg:shadow-[0_24px_70px_rgba(15,23,42,0.16)] bg-white"
        )}
      >
        {/* Background Reel Media / Video Player */}
        <div className={cn(
          "absolute inset-0 z-0 flex items-center justify-center",
          isDark ? "bg-[#03071B]" : "bg-slate-900"
        )}>
          {currentReel.videoUrl || currentReel.muxPlaybackId ? (
            <video
              ref={videoRef}
              poster={currentReel.thumbnailUrl || undefined}
              autoPlay={autoPlayEnabled}
              loop
              muted={isMuted}
              playsInline
              onTimeUpdate={(e) => {
                const el = e.currentTarget;
                const duration = el.duration || currentReel.duration || 0;
                setPlayback({
                  currentTime: el.currentTime || 0,
                  duration,
                  progress: duration ? Math.min(100, (el.currentTime / duration) * 100) : 0,
                });
              }}
              className="w-full h-full object-cover brightness-95"
            />
          ) : (
            <div className={cn(
              "w-full h-full flex items-center justify-center",
              isDark ? "bg-[#080E27] text-white/60" : "bg-slate-100 text-slate-500"
            )}>
              <span className="text-sm font-semibold">Video unavailable</span>
            </div>
          )}

          {/* Ambient Scrim Overlays */}
          <div className="absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-[#03071B]/65 via-[#03071B]/20 to-transparent pointer-events-none" />
          <div className="absolute inset-x-0 bottom-0 h-72 bg-gradient-to-t from-[#03071B]/95 via-[#03071B]/55 to-transparent pointer-events-none" />

          {/* Dedicated Accessible Tap / Double-Tap Surface */}
          <button
            type="button"
            onClick={handleCanvasTap}
            onDoubleClick={handleDoubleTap}
            aria-label={isPlaying ? 'Pause reel' : 'Play reel'}
            className="absolute inset-0 z-10 cursor-pointer bg-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-arvdoul-purple"
          />

          {/* Double Tap Heart Burst Animation */}
          <AnimatePresence>
            {showHeartBurst && (
              <motion.div
                initial={{ scale: 0.3, opacity: 0 }}
                animate={{ scale: 1.3, opacity: 1 }}
                exit={{ scale: 1.8, opacity: 0 }}
                transition={{ duration: 0.6 }}
                className="absolute z-30 pointer-events-none text-rose-500 drop-shadow-[0_0_24px_rgba(244,63,94,0.85)]"
              >
                <Heart className="w-28 h-28 fill-current" />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Transient Single-Tap Play/Pause Feedback */}
          <AnimatePresence>
            {tapFeedback && isPlaying && (
              <motion.div
                key={tapFeedback}
                initial={{ scale: 0.75, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 1.2, opacity: 0 }}
                transition={{ duration: 0.25 }}
                aria-hidden="true"
                className="absolute z-20 w-16 h-16 rounded-full bg-[#03071B]/55 backdrop-blur-xl border border-white/20 flex items-center justify-center text-white pointer-events-none"
              >
                {tapFeedback === 'pause' ? (
                  <Pause className="w-7 h-7 fill-current" />
                ) : (
                  <Play className="w-7 h-7 ml-0.5 fill-current" />
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* HLS Stream Recovery Pill */}
          {hls.error && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                hls.refreshPlaybackUrl();
              }}
              className="absolute z-30 px-4 py-2.5 rounded-full bg-black/75 backdrop-blur-xl border border-red-400/40 text-white text-xs font-semibold shadow-xl hover:bg-black/90 transition"
            >
              Stream interrupted — Tap to retry
            </button>
          )}

          {/* Ambient Buffer Indicator */}
          {hls.isBuffering && !hls.error && (
            <div
              aria-hidden="true"
              className="absolute z-20 pointer-events-none w-12 h-12 rounded-full bg-black/45 backdrop-blur-md border border-white/20 flex items-center justify-center shadow-2xl"
            >
              <div className="w-6 h-6 rounded-full border-2 border-arvdoul-purple border-t-transparent animate-spin" />
            </div>
          )}

          {/* Persistent Paused Play Overlay */}
          {!isPlaying && !hls.error && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setIsPlaying(true);
                triggerTapFeedback(true);
              }}
              aria-label="Play reel"
              className="absolute z-20 w-16 h-16 rounded-full bg-[#03071B]/65 backdrop-blur-xl border border-white/25 flex items-center justify-center text-white shadow-2xl hover:scale-105 active:scale-95 transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-arvdoul-purple"
            >
              <Play className="w-8 h-8 ml-1 fill-current" />
            </button>
          )}
        </div>

        {/* Top Header Bar (hidden when canonical TopAppBar is mounted by MainLayout) */}
        {!hasTopAppBar && (
          <header className="relative z-30 pt-4 px-4 sm:px-5 flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                aria-label="Back to videos"
                onClick={() => navigate(-1)}
                className="min-w-[44px] min-h-[44px] rounded-full bg-[#03071B]/50 backdrop-blur-xl border border-white/15 flex items-center justify-center hover:bg-[#03071B]/75 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-arvdoul-purple"
              >
                <ArrowLeft className="w-4 h-4 text-white" aria-hidden="true" />
              </button>
              <button
                type="button"
                aria-label="Open Arvdoul Sparks"
                onClick={() => navigate('/sparks')}
                className="min-w-[40px] min-h-[40px] rounded-full bg-[#03071B]/45 backdrop-blur-xl border border-white/15 flex items-center justify-center hover:bg-[#03071B]/70 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-arvdoul-purple"
              >
                <ArvdoulEmblem size={24} theme="dark" />
              </button>
            </div>

            {/* Center: Following & For You Tabs */}
            <div className="flex items-center gap-5 sm:gap-6" role="tablist" aria-label="Reels feed filter">
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'following'}
                onClick={() => setActiveTab('following')}
                className={cn(
                  "min-h-[44px] px-1.5 text-sm font-bold transition-all relative flex items-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-arvdoul-purple rounded-lg",
                  activeTab === 'following'
                    ? "text-white scale-105"
                    : "text-white/65 hover:text-white"
                )}
              >
                Following
                {activeTab === 'following' && (
                  <motion.span
                    layoutId="reelTab"
                    className="absolute bottom-1.5 inset-x-1 h-0.5 rounded-full"
                    style={{ background: BRAND_GRADIENT }}
                  />
                )}
              </button>

              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'forYou'}
                onClick={() => setActiveTab('forYou')}
                className={cn(
                  "min-h-[44px] px-1.5 text-sm font-bold transition-all relative flex items-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-arvdoul-purple rounded-lg",
                  activeTab === 'forYou'
                    ? "text-white scale-105"
                    : "text-white/65 hover:text-white"
                )}
              >
                For You
                {activeTab === 'forYou' && (
                  <motion.span
                    layoutId="reelTab"
                    className="absolute bottom-1.5 inset-x-1 h-0.5 rounded-full shadow-arvdoul-glow"
                    style={{ background: BRAND_GRADIENT }}
                  />
                )}
              </button>
            </div>

            {/* Right: Search & Story Camera Icons */}
            <div className="flex items-center gap-1.5 sm:gap-2">
              <button
                type="button"
                onClick={() => navigate('/search')}
                aria-label="Search reels"
                className="min-w-[44px] min-h-[44px] rounded-full bg-[#03071B]/50 backdrop-blur-xl border border-white/15 flex items-center justify-center hover:bg-[#03071B]/75 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-arvdoul-purple"
              >
                <Search className="w-4 h-4 text-white" aria-hidden="true" />
              </button>

              <button
                type="button"
                onClick={() => navigate('/create-story')}
                aria-label="Create Story"
                className="min-w-[44px] min-h-[44px] rounded-full bg-[#03071B]/50 backdrop-blur-xl border border-white/15 flex items-center justify-center hover:bg-[#03071B]/75 transition-colors relative focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-arvdoul-purple"
              >
                <Camera className="w-4 h-4 text-white" aria-hidden="true" />
                <span className="absolute top-1 right-1 w-3.5 h-3.5 rounded-full bg-arvdoul-glow-magenta text-white text-[9px] font-black flex items-center justify-center shadow" aria-hidden="true">
                  +
                </span>
              </button>
            </div>
          </header>
        )}

        {/* Center Spacer */}
        <div className="flex-1 pointer-events-none" />

        {/* Right Side Action Rail */}
        <div className="absolute right-3 sm:right-3.5 bottom-[170px] lg:bottom-24 z-30 flex flex-col items-center gap-3.5">
          {/* Creator Avatar with Follow Ring (+) */}
          <div className="relative mb-2">
            <button
              type="button"
              aria-label={`Open ${currentReel.creator.name || 'creator'} profile`}
              onClick={() => currentReel.creator.id && navigate(`/profile/${currentReel.creator.id}`)}
              className="w-12 h-12 rounded-full p-0.5 cursor-pointer shadow-arvdoul-glow block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-arvdoul-purple"
              style={{ background: BRAND_GRADIENT }}
            >
              <LazyImage
                src={currentReel.creator.avatar}
                alt={currentReel.creator.name || ''}
                className="w-full h-full rounded-full object-cover border-2 border-[#03071B]"
              />
            </button>
            {currentReel.creator.id && currentReel.creator.id !== user?.uid && (
              <button
                type="button"
                onClick={() => handleFollow(currentReel.creator)}
                aria-label={currentReel.creator.isFollowing
                  ? 'Unfollow creator'
                  : (currentReel.creator.requestStatus === 'pending' ? 'Cancel follow request' : 'Follow creator')}
                className={cn(
                  "absolute -bottom-2 left-1/2 -translate-x-1/2 w-6 h-6 rounded-full text-white text-xs font-black flex items-center justify-center shadow-md border-2 border-[#03071B] transition-transform active:scale-90 after:content-[''] after:absolute after:-inset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-arvdoul-purple",
                  currentReel.creator.isFollowing
                    ? "bg-emerald-500"
                    : "bg-arvdoul-gradient"
                )}
              >
                {currentReel.creator.isFollowing
                  ? <Check className="w-3 h-3 stroke-[3]" aria-hidden="true" />
                  : (currentReel.creator.requestStatus === 'pending'
                    ? <Clock className="w-3 h-3 stroke-[2.5]" aria-hidden="true" />
                    : <Plus className="w-3 h-3 stroke-[3]" aria-hidden="true" />)}
              </button>
            )}
          </div>

          {/* Like Button */}
          <button
            type="button"
            onClick={handleLike}
            aria-label={currentReel.isLiked ? 'Unlike reel' : 'Like reel'}
            className="flex flex-col items-center gap-1 group active:scale-90 transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-arvdoul-purple rounded-xl"
          >
            <div className={cn(
              "w-11 h-11 rounded-full backdrop-blur-xl border flex items-center justify-center transition-colors",
              currentReel.isLiked ? "bg-rose-500/25 border-rose-500/70 text-rose-500" : railPillClass
            )}>
              <Heart className={cn("w-5 h-5", currentReel.isLiked && "fill-current text-rose-500")} aria-hidden="true" />
            </div>
            <span className="text-[11px] font-bold text-white drop-shadow tabular-nums">
              {currentReel.stats.likes == null ? '—' : currentReel.stats.likes.toLocaleString()}
            </span>
          </button>

          {/* Comments Button */}
          <button
            type="button"
            onClick={() => setSheetView('comments')}
            aria-label="Comments"
            className="flex flex-col items-center gap-1 group active:scale-90 transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-arvdoul-purple rounded-xl"
          >
            <div className={cn("w-11 h-11 rounded-full backdrop-blur-xl border flex items-center justify-center transition-colors", railPillClass)}>
              <MessageCircle className="w-5 h-5" aria-hidden="true" />
            </div>
            <span className="text-[11px] font-bold text-white drop-shadow tabular-nums">
              {currentReel.stats.comments == null ? '—' : currentReel.stats.comments.toLocaleString()}
            </span>
          </button>

          {/* Share Button */}
          <button
            type="button"
            onClick={handleShare}
            aria-label="Share reel"
            className="flex flex-col items-center gap-1 group active:scale-90 transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-arvdoul-purple rounded-xl"
          >
            <div className={cn("w-11 h-11 rounded-full backdrop-blur-xl border flex items-center justify-center transition-colors", railPillClass)}>
              <Share2 className="w-5 h-5" aria-hidden="true" />
            </div>
            <span className="text-[11px] font-bold text-white drop-shadow tabular-nums">
              {currentReel.stats.shares == null ? '—' : currentReel.stats.shares.toLocaleString()}
            </span>
          </button>

          {/* Bookmark / Save */}
          <button
            type="button"
            onClick={handleSave}
            aria-label={currentReel.isSaved ? 'Unsave reel' : 'Save reel'}
            className="flex flex-col items-center gap-1 group active:scale-90 transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-arvdoul-purple rounded-xl"
          >
            <div className={cn(
              "w-11 h-11 rounded-full backdrop-blur-xl border flex items-center justify-center transition-colors",
              currentReel.isSaved ? "bg-amber-500/25 border-amber-500/70 text-amber-400" : railPillClass
            )}>
              <Bookmark className={cn("w-5 h-5", currentReel.isSaved && "fill-current text-amber-400")} aria-hidden="true" />
            </div>
            <span className="text-[11px] font-bold text-white drop-shadow tabular-nums">
              {currentReel.stats.saves == null ? '—' : currentReel.stats.saves.toLocaleString()}
            </span>
          </button>

          {/* Coin Gift Button */}
          <button
            type="button"
            onClick={() => setGiftModal(true)}
            aria-label="Send a coin gift"
            className="flex flex-col items-center gap-1 group active:scale-90 transition-transform text-amber-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-arvdoul-purple rounded-xl"
          >
            <div className={cn(
              "w-11 h-11 rounded-full backdrop-blur-xl border flex items-center justify-center shadow-arvdoul-glow transition-colors",
              isDark
                ? "bg-amber-500/20 border-amber-500/45 hover:bg-amber-500/30"
                : "bg-white/90 border-amber-300 hover:bg-amber-50 shadow-lg"
            )}>
              <Gift className="w-5 h-5 text-amber-500 dark:text-amber-400" aria-hidden="true" />
            </div>
            <span className="text-[11px] font-black text-amber-400 drop-shadow tabular-nums">
              {currentReel.stats.gifts == null ? '—' : currentReel.stats.gifts.toLocaleString()}
            </span>
          </button>

          {/* More Options */}
          <button
            type="button"
            onClick={() => setSheetView('report')}
            aria-label="More options"
            className={cn(
              "min-w-[44px] min-h-[44px] rounded-full backdrop-blur-xl border flex items-center justify-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-arvdoul-purple",
              railPillClass
            )}
          >
            <MoreVertical className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        {/* Bottom Editorial Metadata Overlay (Unboxed over Gradient Scrim) */}
        <div className="relative z-30 px-4 sm:px-5 pb-[102px] lg:pb-5 pr-16 space-y-2.5 text-white">
          <div className="flex items-center gap-2.5 min-w-0">
            <button
              type="button"
              onClick={() => currentReel.creator.id && navigate(`/profile/${currentReel.creator.id}`)}
              className="flex items-center gap-2 min-w-0 text-left rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-arvdoul-purple"
            >
              <LazyImage
                src={currentReel.creator.avatar}
                alt={creatorFallbackName}
                className="w-9 h-9 rounded-full object-cover border border-white/25 shrink-0 shadow"
              />
              <div className="min-w-0">
                <div className="flex items-center gap-1">
                  <span className="text-sm font-bold font-display truncate drop-shadow">{creatorFallbackName}</span>
                  {currentReel.creator.verified && (
                    <CheckCircle2 className="w-3.5 h-3.5 text-arvdoul-blue fill-arvdoul-blue/20 shrink-0" aria-hidden="true" />
                  )}
                </div>
                {currentReel.creator.username && (
                  <span className="text-[11px] text-white/75 block truncate drop-shadow">@{currentReel.creator.username}</span>
                )}
              </div>
            </button>

            {currentReel.creator.id && currentReel.creator.id !== user?.uid && (
              <button
                type="button"
                onClick={() => handleFollow(currentReel.creator)}
                className={cn(
                  "min-h-[34px] px-3.5 rounded-full text-xs font-bold transition-all shrink-0 border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-arvdoul-purple",
                  currentReel.creator.isFollowing
                    ? "bg-white/15 backdrop-blur-md border-white/20 text-white"
                    : currentReel.creator.requestStatus === 'pending'
                      ? "bg-white/15 backdrop-blur-md border-white/20 text-white/90"
                      : "text-white border-transparent shadow-md"
                )}
                style={!currentReel.creator.isFollowing && currentReel.creator.requestStatus !== 'pending' ? { background: BRAND_GRADIENT } : undefined}
              >
                {currentReel.creator.isFollowing
                  ? 'Following'
                  : (currentReel.creator.requestStatus === 'pending' ? 'Requested' : 'Follow')}
              </button>
            )}
          </div>

          {currentReel.title && (
            <div className="space-y-1">
              <p className={cn("text-[13px] font-medium text-white/95 leading-snug drop-shadow-sm", !captionExpanded && "line-clamp-2")}>
                {currentReel.title}
              </p>
              {hasLongCaption && (
                <button
                  type="button"
                  onClick={() => setCaptionExpanded((v) => !v)}
                  className="text-[11px] font-bold text-white/75 hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-arvdoul-purple rounded"
                >
                  {captionExpanded ? 'Show less' : 'More'}
                </button>
              )}
            </div>
          )}

          {/* Hashtags */}
          {currentReel.hashtags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {currentReel.hashtags.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => navigate(`/search?q=${encodeURIComponent(tag.replace(/^#/, ''))}`)}
                  className="px-2 py-0.5 rounded-lg bg-white/10 hover:bg-white/20 backdrop-blur-md text-[11px] font-bold text-white/90 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-arvdoul-purple"
                >
                  {tag}
                </button>
              ))}
            </div>
          )}

          {/* Music Track Pill */}
          {currentReel.music && (
            <div className="inline-flex items-center gap-2 max-w-full px-3 py-1.5 rounded-full bg-white/[0.12] backdrop-blur-xl border border-white/15 text-xs">
              <Music className="w-3.5 h-3.5 text-arvdoul-purple flex-shrink-0" aria-hidden="true" />
              <span className="truncate text-[11px] font-semibold text-white/95">{currentReel.music}</span>
              <div className="flex items-center gap-0.5 flex-shrink-0 pl-1" aria-hidden="true">
                <span className="w-0.5 h-2.5 bg-arvdoul-purple rounded-full" />
                <span className="w-0.5 h-3.5 bg-arvdoul-glow-magenta rounded-full" />
                <span className="w-0.5 h-2 bg-arvdoul-indigo rounded-full" />
              </div>
            </div>
          )}

          {/* Scrubbable Playback Progress */}
          <div className="flex items-center gap-2.5 text-[11px] text-white/85 font-bold pt-0.5 tabular-nums">
            <span>{formatDuration(playback.currentTime)}</span>
            <div className="relative flex-1 h-6 flex items-center group/scrub">
              <div className="w-full h-1 group-hover/scrub:h-1.5 transition-all rounded-full bg-white/25 overflow-hidden">
                <div
                  style={{ width: `${playback.progress}%`, background: BRAND_GRADIENT }}
                  className="h-full rounded-full"
                />
              </div>
              <input
                type="range"
                min={0}
                max={100}
                step={0.5}
                value={playback.progress}
                onChange={(e) => handleSeek(e.target.value)}
                onClick={(e) => e.stopPropagation()}
                aria-label="Seek reel playback"
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
            </div>
            <span>{formatDuration(playback.duration || currentReel.duration)}</span>
            <button
              type="button"
              onClick={() => setIsMuted(!isMuted)}
              aria-label={isMuted ? 'Unmute' : 'Mute'}
              className="min-w-[44px] min-h-[44px] -mr-2 rounded-full flex items-center justify-center hover:bg-white/15 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-arvdoul-purple"
            >
              {isMuted ? <VolumeX className="w-4 h-4" aria-hidden="true" /> : <Volume2 className="w-4 h-4" aria-hidden="true" />}
            </button>
          </div>
        </div>

        {/* Gift Modal — themed double-entry coin transfer */}
        <VideoGiftModal
          isOpen={giftModal && Boolean(currentReel)}
          onClose={() => setGiftModal(false)}
          creator={currentReel?.creator}
          video={currentReel}
          onGiftSent={() => {
            if (!currentReel) return;
            patchReel(currentReel.id, {
              stats: {
                ...currentReel.stats,
                gifts: (currentReel.stats?.gifts ?? 0) + 1,
              },
            });
          }}
        />

        {/* Comments sheet for the active reel */}
        <VideoComments
          isOpen={sheetView === 'comments' && Boolean(currentReel)}
          onClose={() => setSheetView(null)}
          video={currentReel}
          onCommentAdded={() => {
            if (!currentReel) return;
            patchReel(currentReel.id, {
              stats: {
                ...currentReel.stats,
                comments: (currentReel.stats?.comments ?? 0) + 1,
              },
            });
          }}
          onCommentDeleted={() => {
            if (!currentReel) return;
            patchReel(currentReel.id, {
              stats: {
                ...currentReel.stats,
                comments: currentReel.stats?.comments == null
                  ? null
                  : Math.max(0, currentReel.stats.comments - 1),
              },
            });
          }}
        />

        {/* Share / Report sheet for the active reel */}
        <VideoBottomSheet
          isOpen={(sheetView === 'share' || sheetView === 'report') && Boolean(currentReel)}
          onClose={() => setSheetView(null)}
          initialView={sheetView === 'report' ? 'report' : 'share'}
          video={currentReel}
          onSaveStateChange={(vidId, nextSaved) => {
            setReels((prev) => prev.map((r) => (
              r.id === vidId
                ? {
                  ...r,
                  isSaved: nextSaved,
                  stats: {
                    ...r.stats,
                    saves: r.stats?.saves == null ? null : Math.max(0, r.stats.saves + (nextSaved ? 1 : -1)),
                  },
                }
                : r
            )));
          }}
          onShared={(sharedReel) => {
            if (!sharedReel?.id) return;
            setReels((prev) => prev.map((r) => (
              r.id === sharedReel.id
                ? {
                  ...r,
                  stats: {
                    ...r.stats,
                    shares: r.stats?.shares == null ? null : r.stats.shares + 1,
                  },
                }
                : r
            )));
          }}
          onNotInterested={(hiddenId) => {
            const nextLen = Math.max(0, reels.length - 1);
            markNotInterested(reels.find((r) => r.id === hiddenId) || hiddenId);
            setCurrentReelIndex((idx) => Math.max(0, Math.min(idx, nextLen - 1)));
            setSheetView(null);
          }}
          onDeleted={(deletedId) => {
            const nextLen = Math.max(0, reels.length - 1);
            removeItem(deletedId);
            setCurrentReelIndex((idx) => Math.max(0, Math.min(idx, nextLen - 1)));
            setSheetView(null);
          }}
        />
      </div>

      {/* Desktop Flanking Stepper Controls */}
      <div className="hidden lg:flex flex-col items-center gap-3 z-20 shrink-0">
        <button
          type="button"
          onClick={handlePrevReel}
          disabled={currentReelIndex === 0}
          aria-label="Previous reel"
          className={cn(
            "w-11 h-11 rounded-full disabled:opacity-30 disabled:pointer-events-none backdrop-blur-xl border flex items-center justify-center transition-all active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-arvdoul-purple",
            isDark
              ? "bg-white/[0.08] hover:bg-white/[0.15] border-white/15 text-white"
              : "bg-white/95 hover:bg-white border-slate-200/90 text-slate-900 shadow-lg"
          )}
        >
          <ChevronUp className="w-5 h-5" aria-hidden="true" />
        </button>
        <span className={cn(
          "text-[11px] font-bold tabular-nums px-2.5 py-1 rounded-full border",
          isDark
            ? "text-white/60 bg-white/[0.05] border-white/10"
            : "text-slate-700 bg-white/90 border-slate-200/90 shadow-sm"
        )}>
          {currentReelIndex + 1} / {reels.length}
        </span>
        <button
          type="button"
          onClick={handleNextReel}
          disabled={currentReelIndex >= reels.length - 1}
          aria-label="Next reel"
          className={cn(
            "w-11 h-11 rounded-full disabled:opacity-30 disabled:pointer-events-none backdrop-blur-xl border flex items-center justify-center transition-all active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-arvdoul-purple",
            isDark
              ? "bg-white/[0.08] hover:bg-white/[0.15] border-white/15 text-white"
              : "bg-white/95 hover:bg-white border-slate-200/90 text-slate-900 shadow-lg"
          )}
        >
          <ChevronDown className="w-5 h-5" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
