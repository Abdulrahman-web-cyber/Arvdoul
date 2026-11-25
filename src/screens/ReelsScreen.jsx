// src/screens/ReelsScreen.jsx

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '../context/AuthContext';
import settingsService from '../services/settingsService.js';
import { useTheme } from '../context/ThemeContext';
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
  Coins,
  ArrowLeft,
  ChevronUp,
  ChevronDown,
} from "lucide-react";
import videoService from '../services/videoService';
import useHlsVideo from '../hooks/useHlsVideo.js';
import { generateShareUrl } from '../utils/videoUtils';
import { getMonetizationService } from '../services/monetizationService';
import { getUserService } from '../services/userService';
import { getSafeAvatarUrl } from '../utils/avatarUtils';
import { TopAppLoadingBanner } from '../components/Navigation/RouteProgressBar';
import VideoBottomSheet from '../components/Videos/VideoBottomSheet';
import VideoComments from '../components/Videos/VideoComments';
import { VIRTUAL_GIFTS } from '../data/videoData';
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

  const { theme } = useTheme();
  const isDark = theme !== 'light';

  const [activeTab, setActiveTab] = useState('forYou'); // 'following' | 'forYou'
  const [currentReelIndex, setCurrentReelIndex] = useState(0);
  const [reels, setReels] = useState([]);
  const [feedLoading, setFeedLoading] = useState(true);
  const [feedError, setFeedError] = useState(null);
  const [feedNonce, setFeedNonce] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const cursorRef = useRef(null);
  // Honour the user's playback.autoPlayVideos preference (default on) instead of
  // hardcoding autoplay. When autoplay is off the reel waits for a tap on the
  // play overlay before it starts.
  const autoPlayEnabled = settingsService.getCachedSettings(user?.uid)?.playback?.autoPlayVideos !== false;
  const [isPlaying, setIsPlaying] = useState(autoPlayEnabled);
  const [isMuted, setIsMuted] = useState(false);
  const [showHeartBurst, setShowHeartBurst] = useState(false);
  const [giftModal, setGiftModal] = useState(false);
  const [giftAmount, setGiftAmount] = useState(null);
  const [giftSending, setGiftSending] = useState(false);
  const [sheetView, setSheetView] = useState(null); // 'comments' | 'share' | 'report'
  const [playback, setPlayback] = useState({ currentTime: 0, duration: 0, progress: 0 });
  const [tapFeedback, setTapFeedback] = useState(null); // 'play' | 'pause' | null
  const [captionExpanded, setCaptionExpanded] = useState(false);

  const videoRef = useRef(null);
  const touchStartY = useRef(0);
  const lastWheelRef = useRef(0);
  const tapTimerRef = useRef(null);
  const tapFeedbackTimerRef = useRef(null);

  const currentReel = reels[currentReelIndex] || null;

  useHlsVideo({
    videoRef,
    video: currentReel,
    signedUrlCacheKey: currentReel?.canonicalPostId || currentReel?.id,
    enabled: Boolean(currentReel),
  });

  const patchReel = useCallback((id, patch) => {
    setReels((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }, []);

  const mapVideoToReel = useCallback((v) => {
    const creatorName = v.creator?.name || v.authorName || '';
    const creatorUsername = v.creator?.username || v.authorUsername || '';
    const creatorId = v.creator?.id || v.authorId || v.userId || null;
    return {
      id: v.id,
      canonicalPostId: v.canonicalPostId || null,
      _sourceCollection: v._sourceCollection || 'posts',
      muxPlaybackId: v.muxPlaybackId || null,
      playbackPolicy: v.playbackPolicy || null,
      creator: {
        id: creatorId,
        name: creatorName,
        username: creatorUsername,
        avatar: getSafeAvatarUrl(v.creator?.avatar || v.authorPhoto, creatorName, creatorId),
        verified: Boolean(v.creator?.isVerified || v.authorVerified),
        isFollowing: false,
      },
      title: v.title || v.description || '',
      hashtags: v.hashtags || [],
      music: v.audio?.title || v.music || '',
      videoUrl: v.signedUrl || v.videoUrl || '',
      thumbnailUrl: v.thumbnailUrl || '',
      // An absent stat is unknown (rendered '—'), never a fabricated 0.
      stats: {
        likes: v.likes ?? v.stats?.likes ?? null,
        comments: v.comments ?? v.stats?.comments ?? null,
        shares: v.shares ?? v.stats?.shares ?? null,
        saves: v.saves ?? v.stats?.saves ?? null,
        gifts: v.gifts ?? v.stats?.gifts ?? null,
      },
      duration: v.duration || 0,
      isLiked: Boolean(v.isLiked),
      isSaved: Boolean(v.isSaved),
    };
  }, []);

  // Load reels from the video feed (Firestore-backed, no mock data).
  const loadReels = useCallback(async (feedType) => {
    if (!user?.uid) {
      setReels([]);
      setFeedLoading(false);
      return;
    }
    try {
      setFeedLoading(true);
      setFeedError(null);
      const res = await videoService.getVideoFeed(user.uid, {
        feedType: feedType === 'following' ? 'following' : 'for_you',
        limit: 10,
        type: 'video',
      });
      const mapped = (res.feed || []).map(mapVideoToReel);
      cursorRef.current = res.nextCursor || null;
      setHasMore(Boolean(res.hasMore && res.nextCursor));
      if (targetReelId) {
        const foundIdx = mapped.findIndex((r) => r.id === targetReelId);
        if (foundIdx >= 0) {
          setCurrentReelIndex(foundIdx);
        } else {
          try {
            const fetched = await videoService.getVideo(targetReelId);
            if (fetched?.video) {
              mapped.unshift(mapVideoToReel(fetched.video));
              setCurrentReelIndex(0);
            }
          } catch (e) {
            setCurrentReelIndex(0);
          }
        }
      } else {
        setCurrentReelIndex(0);
      }
      setReels(mapped);
    } catch (err) {
      // A failed read must not render the "No Sparks Yet" empty state, which
      // claims the platform has no content rather than that the fetch failed.
      setFeedError(err?.message || 'Could not load Sparks.');
      setReels([]);
      setHasMore(false);
      cursorRef.current = null;
    } finally {
      setFeedLoading(false);
    }
  }, [user?.uid, targetReelId, mapVideoToReel]);

  // Retry trigger for the error state below.
  useEffect(() => {
    if (feedNonce === 0) return;
    loadReels(activeTab);
  }, [feedNonce, activeTab, loadReels]);

  // Append the next page of reels so the feed does not stop at 10 videos.
  const loadMoreReels = useCallback(async () => {
    if (loadingMore || !cursorRef.current || !user?.uid) return;
    setLoadingMore(true);
    try {
      const res = await videoService.getVideoFeed(user.uid, {
        feedType: activeTab === 'following' ? 'following' : 'for_you',
        limit: 10,
        type: 'video',
        cursor: cursorRef.current,
      });
      const mapped = (res.feed || []).map(mapVideoToReel);
      if (mapped.length > 0) {
        setReels((prev) => {
          const seen = new Set(prev.map((r) => r.id));
          return [...prev, ...mapped.filter((r) => !seen.has(r.id))];
        });
      }
      cursorRef.current = res.nextCursor || null;
      setHasMore(Boolean(res.hasMore && res.nextCursor));
    } catch (err) {
      console.warn('Could not load more reels:', err);
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, user?.uid, activeTab, mapVideoToReel]);

  useEffect(() => {
    loadReels(activeTab);
  }, [activeTab, loadReels]);

  // Prefetch the next page when the viewer nears the end of the loaded list.
  useEffect(() => {
    if (reels.length > 0 && hasMore && currentReelIndex >= reels.length - 2) {
      loadMoreReels();
    }
  }, [currentReelIndex, reels.length, hasMore, loadMoreReels]);

  // Resolve the follow state for the loaded creators (never a local-only fake).
  // Uses the canonical batched edge read (`getFollowStates` → `getEdgeSet`) so
  // it never scans the viewer's whole follow graph.
  useEffect(() => {
    if (!user?.uid || reels.length === 0) return;
    let cancelled = false;
    (async () => {
      try {
        const creatorIds = [...new Set(reels.map((r) => r.creator?.id).filter(Boolean))];
        if (creatorIds.length === 0) return;
        const states = await getUserService().getFollowStates(user.uid, creatorIds);
        if (cancelled) return;
        setReels((prev) => prev.map((r) => {
          const state = states.get(r.creator?.id);
          return {
            ...r,
            creator: {
              ...r.creator,
              isFollowing: Boolean(state?.isFollowing),
              requestStatus: state?.requestStatus ?? null,
            },
          };
        }));
      } catch (err) {
        console.warn('Could not resolve follow state:', err);
      }
    })();
    return () => { cancelled = true; };
  }, [user?.uid, reels.length]);

  useEffect(() => {
    if (giftModal) setGiftAmount(null);
  }, [giftModal]);

  useEffect(() => {
    setCaptionExpanded(false);
  }, [currentReelIndex]);

  useEffect(() => () => {
    if (tapTimerRef.current) clearTimeout(tapTimerRef.current);
    if (tapFeedbackTimerRef.current) clearTimeout(tapFeedbackTimerRef.current);
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
    handleLike();
    setShowHeartBurst(true);
    setTimeout(() => setShowHeartBurst(false), 800);
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

  // Toggle Like — server-authoritative via the likeVideo callable. The
  // callable TOGGLES (like/unlike), so it is invoked for both directions and
  // the returned `action` is the source of truth for the final state.
  const handleLike = async () => {
    if (!currentReel || !user?.uid) {
      if (!user?.uid) toast.error('Sign in to like reels');
      return;
    }
    const reel = currentReel;
    const wasLiked = reel.isLiked;
    patchReel(reel.id, {
      isLiked: !wasLiked,
      stats: { ...reel.stats, likes: reel.stats.likes == null ? null : Math.max(0, reel.stats.likes + (wasLiked ? -1 : 1)) },
    });
    try {
      const res = await videoService.likeVideo(reel.id);
      const serverLiked = res?.action ? res.action === 'liked' : !wasLiked;
      const serverDelta = serverLiked === wasLiked ? 0 : (serverLiked ? 1 : -1);
      patchReel(reel.id, {
        isLiked: serverLiked,
        stats: { ...reel.stats, likes: reel.stats.likes == null ? null : Math.max(0, reel.stats.likes + serverDelta) },
      });
    } catch (err) {
      patchReel(reel.id, { isLiked: wasLiked, stats: reel.stats });
      toast.error('Could not update like');
    }
  };

  // Toggle Bookmark — real server persistence via videoService.
  const handleSave = async () => {
    if (!currentReel || !user?.uid) {
      if (!user?.uid) toast.error('Sign in to save reels');
      return;
    }
    const reel = currentReel;
    const wasSaved = reel.isSaved;
    patchReel(reel.id, {
      isSaved: !wasSaved,
      stats: { ...reel.stats, saves: reel.stats.saves == null ? null : Math.max(0, reel.stats.saves + (wasSaved ? -1 : 1)) },
    });
    try {
      if (wasSaved) await videoService.unsaveVideo(reel.id, user.uid);
      else await videoService.saveVideo(reel.id, user.uid);
      toast.success(wasSaved ? 'Removed from saved' : 'Saved to your collection');
    } catch (err) {
      patchReel(reel.id, { isSaved: wasSaved, stats: reel.stats });
      toast.error(err?.message || 'Could not sync save');
    }
  };

  // Toggle Follow Creator — real follow/unfollow via userService.
  const handleFollow = async (creator) => {
    if (!user?.uid) {
      toast.error('Sign in to follow creators');
      return;
    }
    if (!creator?.id || creator.id === user.uid) return;
    const wasFollowing = creator.isFollowing;
    const wasRequested = creator.requestStatus === 'pending';
    const applyCreator = (isFollowing, requestStatus = null) => setReels((prev) => prev.map((r) => (
      r.creator.id === creator.id
        ? { ...r, creator: { ...r.creator, isFollowing, requestStatus } }
        : r
    )));
    // Optimistic: a private target becomes a pending request, not a follow.
    applyCreator(!wasFollowing && !wasRequested, null);
    try {
      if (wasFollowing || wasRequested) {
        if (wasRequested) await getUserService().cancelFollowRequest(user.uid, creator.id);
        else await getUserService().unfollowUser(user.uid, creator.id);
        applyCreator(false, null);
        toast.success(wasRequested ? 'Request withdrawn' : `Unfollowed @${creator.username}`);
      } else {
        const res = await getUserService().followUser(user.uid, creator.id);
        // A private account yields `{requested:true}` and creates no edge.
        if (res?.requested || res?.requestStatus === 'pending') {
          applyCreator(false, 'pending');
          toast.success('Follow request sent');
        } else {
          applyCreator(true, null);
          toast.success(`Following @${creator.username}`);
        }
      }
    } catch (err) {
      applyCreator(wasFollowing, wasRequested ? 'pending' : null);
      toast.error(err?.message || 'Could not update follow');
    }
  };

  // Send Coin Gift to Reel Creator — real double-entry ledger transfer.
  const handleSendGift = async (coins) => {
    if (!currentReel) return;
    if (!user?.uid) {
      toast.error('Sign in to send gifts');
      return;
    }
    if (!currentReel.creator.id) {
      toast.error('Gift recipient unknown');
      return;
    }
    if (currentReel.creator.id === user.uid) {
      toast.error('You cannot gift yourself');
      return;
    }
    setGiftSending(true);
    try {
      const monSvc = getMonetizationService();
      const res = await monSvc.transferCoins(user.uid, currentReel.creator.id, coins, 'reel_gift', {
        reelId: currentReel.id,
      });
      if (!res?.success) throw new Error(res?.message || 'Gift could not be sent');
      toast.success(`Sent ${coins} Coins to ${currentReel.creator.name}`);
      setGiftModal(false);
      setGiftAmount(null);
    } catch (e) {
      toast.error(e?.message || 'Could not send gift coins.');
    } finally {
      setGiftSending(false);
    }
  };

  // Share — real server-side share counter + native share/clipboard.
  const handleShare = async () => {
    if (!currentReel) return;
    const reel = currentReel;
    const url = generateShareUrl(reel.canonicalPostId || reel.id);
    try {
      if (navigator.share) {
        await navigator.share({ title: reel.title || 'Watch this on ARVDOUL', url });
      } else {
        await navigator.clipboard?.writeText(url);
        toast.success('Spark link copied');
      }
    } catch (err) {
      // User dismissed the native share sheet — not a failure, not a share.
      if (err?.name === 'AbortError') return;
      toast.error('Could not share reel');
      return;
    }
    // Count only after the share actually happened; the server owns the value.
    try {
      const res = await videoService.shareVideo(reel.id, 'arvdoul');
      if (res?.success) {
        if (reel.stats.shares != null) patchReel(reel.id, { stats: { ...reel.stats, shares: reel.stats.shares + 1 } });
      }
    } catch { /* counter stays authoritative */ }
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
    if (isPlaying) el.play().catch(() => {});
    else el.pause();
  }, [isPlaying, currentReelIndex]);

  // Record a real, server-deduplicated view for each reel as the viewer leaves
  // it, using the on-screen time as the watch duration. The Reels screen
  // previously reported no views at all. Keyed on the reel id (not the array
  // identity) so pagination does not fire a spurious view.
  const reelViewStartRef = useRef(null);
  const activeReelId = reels[currentReelIndex]?.id;
  useEffect(() => {
    if (!activeReelId || !user?.uid) return undefined;
    reelViewStartRef.current = Date.now();
    return () => {
      const seconds = Math.round((Date.now() - reelViewStartRef.current) / 1000);
      reelViewStartRef.current = null;
      if (seconds >= 1) {
        videoService.recordVideoView(activeReelId, { duration: seconds }).catch((e) => {
          console.warn('[Reels] view not recorded', e?.message);
        });
      }
    };
  }, [activeReelId, user?.uid]);

  if (feedLoading && reels.length === 0) {
    return (
      <div className="h-full w-full bg-[#03071B] flex items-center justify-center lg:px-6 overflow-hidden">
        <TopAppLoadingBanner isAnimating={true} label="Loading sparks..." />
        <div
          aria-hidden="true"
          className="relative h-full w-full lg:max-w-[430px] lg:aspect-[9/16] lg:max-h-[calc(100dvh-2rem)] lg:rounded-[28px] lg:border lg:border-white/10 bg-[#080E27] overflow-hidden flex flex-col justify-between p-5 animate-pulse"
        >
          <div className="flex items-center justify-between">
            <div className="w-11 h-11 rounded-full bg-white/10" />
            <div className="flex gap-4">
              <div className="w-16 h-5 rounded-full bg-white/10" />
              <div className="w-16 h-5 rounded-full bg-white/10" />
            </div>
            <div className="flex gap-2">
              <div className="w-11 h-11 rounded-full bg-white/10" />
              <div className="w-11 h-11 rounded-full bg-white/10" />
            </div>
          </div>
          <div className="flex items-end justify-between gap-4">
            <div className="flex-1 space-y-2.5">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-full bg-white/15" />
                <div className="h-3.5 w-28 rounded-full bg-white/15" />
              </div>
              <div className="h-3 w-4/5 rounded-full bg-white/10" />
              <div className="h-3 w-3/5 rounded-full bg-white/10" />
            </div>
            <div className="flex flex-col gap-3">
              {[0, 1, 2, 3].map((idx) => (
                <div key={idx} className="w-11 h-11 rounded-full bg-white/10" />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!feedLoading && (!reels || reels.length === 0 || !currentReel)) {
    if (feedError) {
      return (
        <div className="relative h-full w-full bg-[#03071B] flex flex-col items-center justify-center text-white p-6 text-center">
          <button
            type="button"
            aria-label="Go back"
            onClick={() => navigate(-1)}
            className="absolute top-4 left-4 min-w-[44px] min-h-[44px] rounded-full bg-white/10 hover:bg-white/15 border border-white/15 flex items-center justify-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-arvdoul-purple"
          >
            <ArrowLeft className="w-5 h-5 text-white" aria-hidden="true" />
          </button>
          <div role="alert" className="max-w-sm space-y-4">
            <div aria-hidden="true" className="w-14 h-14 mx-auto rounded-2xl bg-red-500/15 border border-red-500/30 flex items-center justify-center">
              <AlertCircle className="w-7 h-7 text-red-400" />
            </div>
            <h2 className="text-xl font-black tracking-tight">Could not load Sparks</h2>
            <p className="text-white/65 text-sm leading-relaxed">{feedError}</p>
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
                onClick={() => navigate('/videos')}
                className="min-h-[44px] px-5 rounded-2xl bg-white/10 hover:bg-white/15 border border-white/10 font-semibold text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-arvdoul-purple"
              >
                Explore Videos
              </button>
            </div>
          </div>
        </div>
      );
    }
    return (
      <div className="relative h-full w-full bg-[#03071B] flex flex-col items-center justify-center text-white p-6 text-center overflow-hidden">
        <button
          type="button"
          aria-label="Go back"
          onClick={() => navigate(-1)}
          className="absolute top-4 left-4 min-w-[44px] min-h-[44px] rounded-full bg-white/10 hover:bg-white/15 border border-white/15 flex items-center justify-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-arvdoul-purple"
        >
          <ArrowLeft className="w-5 h-5 text-white" aria-hidden="true" />
        </button>
        <div className="max-w-sm space-y-4 relative z-10">
          <div className="w-16 h-16 mx-auto rounded-2xl flex items-center justify-center border border-white/15 bg-white/[0.06] shadow-xl">
            <Sparkles className="w-8 h-8 text-amber-400" aria-hidden="true" />
          </div>
          <h2 className="text-2xl font-black tracking-tight">
            {activeTab === 'following' ? 'No Following Sparks Yet' : 'No Sparks Yet'}
          </h2>
          <p className="text-white/65 text-sm leading-relaxed">
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
                onClick={() => navigate('/create-post')}
                className="min-h-[44px] px-6 rounded-2xl text-white font-bold text-sm shadow-lg hover:brightness-105 active:scale-[0.98] transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-arvdoul-purple"
                style={{ background: BRAND_GRADIENT }}
              >
                Create Spark
              </button>
            )}
            <button
              type="button"
              onClick={() => navigate('/videos')}
              className="min-h-[44px] px-5 rounded-2xl bg-white/10 hover:bg-white/15 border border-white/10 font-semibold text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-arvdoul-purple"
            >
              Explore Videos
            </button>
          </div>
        </div>
      </div>
    );
  }

  const creatorFallbackName = currentReel.creator.name || (currentReel.creator.id ? `user ${String(currentReel.creator.id).slice(0, 6)}` : '');
  const hasLongCaption = Boolean(currentReel.title && currentReel.title.length > 90);

  return (
    <div className="relative h-full w-full bg-[#03071B] flex items-center justify-center lg:gap-6 lg:px-6 overflow-hidden">
      {/* Subtle desktop theater ambiance */}
      <div
        aria-hidden="true"
        className="hidden lg:block pointer-events-none absolute w-[520px] h-[520px] rounded-full bg-arvdoul-purple/10 blur-3xl"
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
          "relative h-full w-full lg:max-w-[430px] lg:aspect-[9/16] lg:max-h-[calc(100dvh-2rem)] lg:rounded-[28px] lg:border lg:border-white/15 lg:shadow-2xl overflow-hidden select-none flex flex-col justify-between focus:outline-none focus-visible:ring-2 focus-visible:ring-arvdoul-purple",
          isDark ? "bg-[#03071B] text-white" : "bg-[#03071B] text-white"
        )}
      >
        {/* Background Reel Media / Video Player */}
        <div className="absolute inset-0 z-0 bg-[#03071B] flex items-center justify-center">
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
            <div className="w-full h-full flex items-center justify-center bg-[#080E27]">
              <span className="text-white/55 text-sm font-semibold">Video unavailable</span>
            </div>
          )}

          {/* Ambient Dark Scrim Overlays */}
          <div className="absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-[#03071B]/75 via-[#03071B]/25 to-transparent pointer-events-none" />
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

          {/* Persistent Paused Play Overlay */}
          {!isPlaying && (
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

        {/* Top Header Bar: Back, Following/For You Tabs, Search, Story Camera(+) */}
        <header className="relative z-30 pt-4 px-4 sm:px-5 flex items-center justify-between gap-2">
          <button
            type="button"
            aria-label="Back to videos"
            onClick={() => navigate(-1)}
            className="min-w-[44px] min-h-[44px] rounded-full bg-[#03071B]/50 backdrop-blur-xl border border-white/15 flex items-center justify-center hover:bg-[#03071B]/75 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-arvdoul-purple"
          >
            <ArrowLeft className="w-4 h-4 text-white" aria-hidden="true" />
          </button>

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

        {/* Center Spacer */}
        <div className="flex-1 pointer-events-none" />

        {/* Right Side Action Rail */}
        <div className="absolute right-3 sm:right-3.5 bottom-24 z-30 flex flex-col items-center gap-3.5">
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
              "w-11 h-11 rounded-full bg-[#03071B]/45 backdrop-blur-xl border border-white/15 flex items-center justify-center transition-colors",
              currentReel.isLiked ? "bg-rose-500/25 border-rose-500/70 text-rose-500" : "text-white hover:bg-[#03071B]/65"
            )}>
              <Heart className={cn("w-5 h-5", currentReel.isLiked && "fill-current text-rose-500")} aria-hidden="true" />
            </div>
            <span className="text-[11px] font-bold drop-shadow tabular-nums">
              {currentReel.stats.likes == null ? '—' : currentReel.stats.likes.toLocaleString()}
            </span>
          </button>

          {/* Comments Button */}
          <button
            type="button"
            onClick={() => setSheetView('comments')}
            aria-label="Comments"
            className="flex flex-col items-center gap-1 group active:scale-90 transition-transform text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-arvdoul-purple rounded-xl"
          >
            <div className="w-11 h-11 rounded-full bg-[#03071B]/45 backdrop-blur-xl border border-white/15 hover:bg-[#03071B]/65 flex items-center justify-center transition-colors">
              <MessageCircle className="w-5 h-5" aria-hidden="true" />
            </div>
            <span className="text-[11px] font-bold drop-shadow tabular-nums">
              {currentReel.stats.comments == null ? '—' : currentReel.stats.comments.toLocaleString()}
            </span>
          </button>

          {/* Share Button */}
          <button
            type="button"
            onClick={handleShare}
            aria-label="Share reel"
            className="flex flex-col items-center gap-1 group active:scale-90 transition-transform text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-arvdoul-purple rounded-xl"
          >
            <div className="w-11 h-11 rounded-full bg-[#03071B]/45 backdrop-blur-xl border border-white/15 hover:bg-[#03071B]/65 flex items-center justify-center transition-colors">
              <Share2 className="w-5 h-5" aria-hidden="true" />
            </div>
            <span className="text-[11px] font-bold drop-shadow tabular-nums">
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
              "w-11 h-11 rounded-full bg-[#03071B]/45 backdrop-blur-xl border border-white/15 flex items-center justify-center transition-colors",
              currentReel.isSaved ? "bg-amber-500/25 border-amber-500/70 text-amber-400" : "text-white hover:bg-[#03071B]/65"
            )}>
              <Bookmark className={cn("w-5 h-5", currentReel.isSaved && "fill-current text-amber-400")} aria-hidden="true" />
            </div>
            <span className="text-[11px] font-bold drop-shadow tabular-nums">
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
            <div className="w-11 h-11 rounded-full bg-amber-500/20 backdrop-blur-xl border border-amber-500/45 hover:bg-amber-500/30 flex items-center justify-center shadow-arvdoul-glow transition-colors">
              <Gift className="w-5 h-5 text-amber-400" aria-hidden="true" />
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
            className="min-w-[44px] min-h-[44px] rounded-full bg-[#03071B]/45 backdrop-blur-xl border border-white/15 hover:bg-[#03071B]/65 flex items-center justify-center text-white/85 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-arvdoul-purple"
          >
            <MoreVertical className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        {/* Bottom Editorial Metadata Overlay (Unboxed over Gradient Scrim) */}
        <div className="relative z-30 px-4 sm:px-5 pb-4 pr-16 space-y-2.5">
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

        {/* Gift Modal — real coin amounts and a real double-entry transfer */}
        <AnimatePresence>
          {giftModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#03071B]/80 backdrop-blur-md">
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="w-full max-w-sm rounded-[28px] p-6 bg-[#080E27]/95 backdrop-blur-2xl border border-amber-500/40 text-center shadow-2xl"
              >
                <Gift className="w-12 h-12 text-amber-400 mx-auto mb-2" aria-hidden="true" />
                <h3 className="text-xl font-bold font-display text-white">Gift Creator Coins</h3>
                <p className="text-xs text-arvdoul-text-secondary mt-1">
                  Reward {currentReel.creator.name || 'this creator'} with instant ARVDOUL Coins.
                </p>

                <div className="grid grid-cols-3 gap-2 my-4">
                  {VIRTUAL_GIFTS.map((gift) => (
                    <button
                      key={gift.type}
                      type="button"
                      disabled={giftSending}
                      onClick={() => setGiftAmount(gift.coins)}
                      className={cn(
                        "min-h-[60px] py-2.5 px-2 rounded-2xl text-xs font-bold border transition-colors disabled:opacity-50 flex flex-col items-center justify-center gap-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-arvdoul-purple",
                        giftAmount === gift.coins
                          ? "bg-amber-500 text-black border-amber-500"
                          : "bg-amber-500/15 border-amber-500/35 text-amber-300 hover:bg-amber-500/25"
                      )}
                    >
                      <span className="text-[11px] font-semibold truncate max-w-full">{gift.name}</span>
                      <span className="inline-flex items-center gap-1 tabular-nums">
                        <Coins className="w-3.5 h-3.5" aria-hidden="true" />
                        {gift.coins}
                      </span>
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  disabled={!giftAmount || giftSending}
                  onClick={() => handleSendGift(giftAmount)}
                  className="w-full min-h-[44px] py-2.5 rounded-2xl text-sm font-bold bg-gradient-to-r from-amber-500 to-orange-500 text-black hover:opacity-95 disabled:opacity-40 mb-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-arvdoul-purple"
                >
                  {giftSending ? 'Sending…' : giftAmount ? `Send ${giftAmount} Coins` : 'Select a gift'}
                </button>

                <button
                  type="button"
                  onClick={() => { setGiftModal(false); setGiftAmount(null); }}
                  className="w-full min-h-[44px] py-2.5 rounded-2xl text-xs font-bold border border-white/10 text-white hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-arvdoul-purple"
                >
                  Cancel
                </button>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Comments sheet for the active reel */}
        <VideoComments
          isOpen={sheetView === 'comments' && Boolean(currentReel)}
          onClose={() => setSheetView(null)}
          video={currentReel}
        />

        {/* Share / Report sheet for the active reel */}
        <VideoBottomSheet
          isOpen={(sheetView === 'share' || sheetView === 'report') && Boolean(currentReel)}
          onClose={() => setSheetView(null)}
          initialView={sheetView === 'report' ? 'report' : 'share'}
          video={currentReel}
        />
      </div>

      {/* Desktop Flanking Stepper Controls */}
      <div className="hidden lg:flex flex-col items-center gap-3 z-20 shrink-0">
        <button
          type="button"
          onClick={handlePrevReel}
          disabled={currentReelIndex === 0}
          aria-label="Previous reel"
          className="w-11 h-11 rounded-full bg-white/[0.08] hover:bg-white/[0.15] disabled:opacity-30 disabled:pointer-events-none backdrop-blur-xl border border-white/15 flex items-center justify-center text-white transition-all active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-arvdoul-purple"
        >
          <ChevronUp className="w-5 h-5" aria-hidden="true" />
        </button>
        <span className="text-[11px] font-bold text-white/60 tabular-nums px-2 py-1 rounded-full bg-white/[0.05] border border-white/10">
          {currentReelIndex + 1} / {reels.length}
        </span>
        <button
          type="button"
          onClick={handleNextReel}
          disabled={currentReelIndex >= reels.length - 1}
          aria-label="Next reel"
          className="w-11 h-11 rounded-full bg-white/[0.08] hover:bg-white/[0.15] disabled:opacity-30 disabled:pointer-events-none backdrop-blur-xl border border-white/15 flex items-center justify-center text-white transition-all active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-arvdoul-purple"
        >
          <ChevronDown className="w-5 h-5" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
