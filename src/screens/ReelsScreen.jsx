// src/screens/ReelsScreen.jsx

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '../context/AuthContext';
import settingsService from '../services/settingsService.js';
import { useTheme } from '../context/ThemeContext';
import { cn } from '../lib/utils';
import { Heart, MessageCircle, Share2, Bookmark, Gift, MoreVertical, Volume2, VolumeX, Play, Search, Camera, Sparkles, CheckCircle2, Music, ArrowUp, ArrowLeftRight } from "lucide-react";
import videoService from '../services/videoService';
import { getMonetizationService } from '../services/monetizationService';
import { getUserService } from '../services/userService';
import { getSafeAvatarUrl } from '../utils/avatarUtils';
import { TopAppLoadingBanner } from '../components/Navigation/RouteProgressBar';
import VideoBottomSheet from '../components/Videos/VideoBottomSheet';
import VideoComments from '../components/Videos/VideoComments';
import { VIRTUAL_GIFTS } from '../data/videoData';

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

  const videoRef = useRef(null);
  const touchStartY = useRef(0);
  const lastWheelRef = useRef(0);

  const currentReel = reels[currentReelIndex] || null;

  const patchReel = useCallback((id, patch) => {
    setReels((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }, []);

  const mapVideoToReel = useCallback((v) => {
    const creatorName = v.creator?.name || v.authorName || '';
    const creatorUsername = v.creator?.username || v.authorUsername || '';
    const creatorId = v.creator?.id || v.authorId || v.userId || null;
    return {
      id: v.id,
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
  useEffect(() => {
    if (!user?.uid || reels.length === 0) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await getUserService().getFollowing(user.uid, { limit: 200 });
        if (cancelled) return;
        const followingIds = new Set((res.following || res.friends || []).map((f) => f.uid || f.id));
        setReels((prev) => prev.map((r) => ({
          ...r,
          creator: { ...r.creator, isFollowing: followingIds.has(r.creator.id) },
        })));
      } catch (err) {
        console.warn('Could not resolve follow state:', err);
      }
    })();
    return () => { cancelled = true; };
  }, [user?.uid, reels.length]);

  useEffect(() => {
    if (giftModal) setGiftAmount(null);
  }, [giftModal]);

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

  // Handle Double Tap to Like
  const handleDoubleTap = () => {
    handleLike();
    setShowHeartBurst(true);
    setTimeout(() => setShowHeartBurst(false), 800);
  };

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
      toast.success(wasSaved ? 'Removed from saved' : 'Saved to your collection! 🌟');
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
    setReels((prev) => prev.map((r) => (
      r.creator.id === creator.id ? { ...r, creator: { ...r.creator, isFollowing: !wasFollowing } } : r
    )));
    try {
      if (wasFollowing) await getUserService().unfollowUser(user.uid, creator.id);
      else await getUserService().followUser(user.uid, creator.id);
      toast.success(wasFollowing ? `Unfollowed @${creator.username}` : `Following @${creator.username} 🎉`);
    } catch (err) {
      setReels((prev) => prev.map((r) => (
        r.creator.id === creator.id ? { ...r, creator: { ...r.creator, isFollowing: wasFollowing } } : r
      )));
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
      toast.success(`Sent ${coins} Coins to ${currentReel.creator.name}! 🎁`);
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
    const url = `${window.location.origin}/video/${reel.id}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: reel.title || 'Watch this on ARVDOUL', url });
      } else {
        await navigator.clipboard?.writeText(url);
        toast.success('Reel link copied! 🚀');
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
      <div className="h-full w-full bg-black flex items-center justify-center">
        <TopAppLoadingBanner isAnimating={true} label="Loading sparks..." />
      </div>
    );
  }

  if (!feedLoading && (!reels || reels.length === 0 || !currentReel)) {
    if (feedError) {
      // The reel surface is always black; render a dark-native error block
      // rather than the light-themed ErrorState (illegible here).
      return (
        <div className="h-full w-full bg-black flex flex-col items-center justify-center text-white p-6 text-center">
          <div role="alert" className="max-w-sm space-y-4">
            <div aria-hidden="true" className="w-14 h-14 mx-auto rounded-full bg-red-500/15 border border-red-500/30 flex items-center justify-center text-2xl">
              ⚠️
            </div>
            <h2 className="text-xl font-black">Could not load Sparks</h2>
            <p className="text-white/60 text-sm">{feedError}</p>
            <button
              onClick={() => setFeedNonce((n) => n + 1)}
              className="px-6 py-2.5 rounded-full bg-gradient-to-r from-arvdoul-purple to-arvdoul-blue font-bold text-sm shadow-lg hover:scale-105 transition-transform"
            >
              Retry
            </button>
          </div>
        </div>
      );
    }
    return (
      <div className="h-full w-full bg-black flex flex-col items-center justify-center text-white p-6 text-center">
        <Sparkles className="w-16 h-16 text-yellow-400 mb-4 animate-pulse" />
        <h2 className="text-2xl font-black mb-2">No Sparks Yet</h2>
        <p className="text-white/60 text-sm max-w-sm mb-6">
          Be the first creator to ignite a spark with short videos and music!
        </p>
        <div className="flex gap-3">
          <button
            onClick={() => navigate('/create-post')}
            className="px-6 py-2.5 rounded-full bg-gradient-to-r from-arvdoul-purple to-arvdoul-blue font-bold text-sm shadow-lg hover:scale-105 transition-transform"
          >
            Create Spark
          </button>
          <button
            onClick={() => navigate('/videos')}
            className="px-6 py-2.5 rounded-full bg-white/10 hover:bg-white/20 font-bold text-sm transition-colors"
          >
            Explore Videos
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      onKeyDown={(e) => {
        if (e.key === 'ArrowUp') handlePrevReel();
        if (e.key === 'ArrowDown') handleNextReel();
        if (e.key === ' ') setIsPlaying(!isPlaying);
      }}
      onWheel={handleWheel}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      tabIndex={0}
      aria-label="Reels"
      className={cn(
        "relative h-full w-full overflow-hidden select-none flex flex-col justify-between focus:outline-none",
        isDark ? "bg-[#060814] text-white" : "bg-black text-white"
      )}
    >
      {/* Background Reel Media / Video Player */}
      <div
        onDoubleClick={handleDoubleTap}
        className="absolute inset-0 z-0 bg-black flex items-center justify-center cursor-pointer"
      >
        {currentReel.videoUrl ? (
          <video
            ref={videoRef}
            src={currentReel.videoUrl}
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
          <div className="w-full h-full flex items-center justify-center bg-black">
            <span className="text-white/50 text-sm font-semibold">Video unavailable</span>
          </div>
        )}

        {/* Ambient Dark Gradient Overlays */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-transparent to-black/90 pointer-events-none" />

        {/* Double Tap Heart Burst Animation */}
        <AnimatePresence>
          {showHeartBurst && (
            <motion.div
              initial={{ scale: 0.3, opacity: 0 }}
              animate={{ scale: 1.3, opacity: 1 }}
              exit={{ scale: 1.8, opacity: 0 }}
              transition={{ duration: 0.6 }}
              className="absolute z-30 pointer-events-none text-rose-500 drop-shadow-[0_0_20px_rgba(244,63,94,0.8)]"
            >
              <Heart className="w-28 h-28 fill-current" />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Play/Pause overlay */}
        {!isPlaying && (
          <button
            type="button"
            onClick={() => setIsPlaying(true)}
            aria-label="Play reel"
            className="absolute z-20 w-16 h-16 rounded-full bg-black/60 backdrop-blur-md flex items-center justify-center text-white cursor-pointer"
          >
            <Play className="w-8 h-8 ml-1 fill-current" />
          </button>
        )}
      </div>

      {/* Top Header Bar: Logo, Following/For You Tabs, Search, Camera(+) */}
      <header className="relative z-30 pt-4 px-5 flex items-center justify-between">
        
        {/* Left: ARVDOUL Brand Logo */}
        <div
          onClick={() => navigate('/')}
          className="flex items-center gap-2 cursor-pointer"
        >
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-arvdoul-purple via-arvdoul-indigo to-arvdoul-blue flex items-center justify-center font-black text-sm text-white shadow-arvdoul-glow">
            A
          </div>
          <span className="text-sm font-black font-display tracking-wider uppercase">
            ARVDOUL
          </span>
        </div>

        {/* Center: Following & For You Tabs */}
        <div className="flex items-center gap-6">
          <button
            onClick={() => setActiveTab('following')}
            className={cn(
              "text-sm font-bold transition-all relative pb-1",
              activeTab === 'following'
                ? "text-white scale-105"
                : "text-white/60 hover:text-white"
            )}
          >
            Following
            {activeTab === 'following' && (
              <motion.span
                layoutId="reelTab"
                className="absolute bottom-0 inset-x-0 h-0.5 bg-gradient-to-r from-arvdoul-purple to-arvdoul-indigo rounded-full"
              />
            )}
          </button>

          <button
            onClick={() => setActiveTab('forYou')}
            className={cn(
              "text-sm font-bold transition-all relative pb-1",
              activeTab === 'forYou'
                ? "text-white scale-105"
                : "text-white/60 hover:text-white"
            )}
          >
            For You
            {activeTab === 'forYou' && (
              <motion.span
                layoutId="reelTab"
                className="absolute bottom-0 inset-x-0 h-0.5 bg-gradient-to-r from-arvdoul-purple to-arvdoul-indigo rounded-full shadow-arvdoul-glow"
              />
            )}
          </button>
        </div>

        {/* Right: Search & Story Camera Icons */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate('/search')}
            aria-label="Search"
            className="w-10 h-10 rounded-full bg-black/40 backdrop-blur-md border border-white/10 flex items-center justify-center hover:bg-black/60 transition-colors"
          >
            <Search className="w-4 h-4 text-white" />
          </button>

          <button
            onClick={() => navigate('/create-story')}
            aria-label="Create Story"
            className="w-10 h-10 rounded-full bg-black/40 backdrop-blur-md border border-white/10 flex items-center justify-center hover:bg-black/60 transition-colors relative"
          >
            <Camera className="w-4 h-4 text-white" />
            <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-arvdoul-glow-magenta text-white text-[9px] font-black flex items-center justify-center">
              +
            </span>
          </button>
        </div>
      </header>

      {/* Top Banner: gesture hint (the previous "Following" mutual-friends pill
          claimed a relationship it never resolved, so it was removed). */}
      <div className="relative z-30 px-5 pt-2">
        <div className="px-3.5 py-1.5 rounded-full bg-black/40 backdrop-blur-md border border-white/10 flex items-center gap-2 text-xs font-semibold text-white/90 w-fit">
          <span className="w-2 h-2 rounded-full bg-emerald-400" aria-hidden="true" />
          <span>Swipe up for more</span>
        </div>
      </div>

      {/* Center Spacer */}
      <div className="flex-1" />

      {/* Right Side Action Rail (Creator Ring, Likes, Comments, Share, Save, Gift, More) */}
      <div className="absolute right-4 bottom-32 z-30 flex flex-col items-center gap-4">
        
        {/* Creator Avatar with Follow Ring (+) */}
        <div className="relative mb-2">
          <div
            onClick={() => currentReel.creator.id && navigate(`/profile/${currentReel.creator.id}`)}
            className="w-12 h-12 rounded-full p-0.5 bg-gradient-to-tr from-arvdoul-purple via-arvdoul-indigo to-arvdoul-blue cursor-pointer shadow-arvdoul-glow"
          >
            <img
              src={currentReel.creator.avatar}
              alt={currentReel.creator.name || 'Creator'}
              className="w-full h-full rounded-full object-cover border-2 border-black"
            />
          </div>
          {currentReel.creator.id && currentReel.creator.id !== user?.uid && (
            <button
              onClick={() => handleFollow(currentReel.creator)}
              aria-label={currentReel.creator.isFollowing ? 'Unfollow creator' : 'Follow creator'}
              className={cn(
                "absolute -bottom-1 left-1/2 -translate-x-1/2 w-5 h-5 rounded-full text-white text-xs font-black flex items-center justify-center shadow-md border border-black transition-transform active:scale-90",
                currentReel.creator.isFollowing
                  ? "bg-emerald-500"
                  : "bg-gradient-to-r from-arvdoul-purple to-arvdoul-blue"
              )}
            >
              {currentReel.creator.isFollowing ? '✓' : '+'}
            </button>
          )}
        </div>

        {/* Like Button */}
        <button
          onClick={handleLike}
          aria-label={currentReel.isLiked ? 'Unlike reel' : 'Like reel'}
          className="flex flex-col items-center gap-1 group active:scale-90 transition-transform"
        >
          <div className={cn(
            "w-11 h-11 rounded-full bg-black/40 backdrop-blur-md border border-white/10 flex items-center justify-center transition-colors",
            currentReel.isLiked ? "bg-rose-500/20 border-rose-500 text-rose-500" : "text-white"
          )}>
            <Heart className={cn("w-6 h-6", currentReel.isLiked && "fill-current text-rose-500")} />
          </div>
          <span className="text-[11px] font-bold drop-shadow">
            {currentReel.stats.likes == null ? '—' : currentReel.stats.likes.toLocaleString()}
          </span>
        </button>

        {/* Comments Button */}
        <button
          onClick={() => setSheetView('comments')}
          aria-label="Comments"
          className="flex flex-col items-center gap-1 group active:scale-90 transition-transform text-white"
        >
          <div className="w-11 h-11 rounded-full bg-black/40 backdrop-blur-md border border-white/10 flex items-center justify-center">
            <MessageCircle className="w-6 h-6" />
          </div>
          <span className="text-[11px] font-bold drop-shadow">{currentReel.stats.comments == null ? '—' : currentReel.stats.comments.toLocaleString()}</span>
        </button>

        {/* Share Button */}
        <button
          onClick={handleShare}
          aria-label="Share reel"
          className="flex flex-col items-center gap-1 group active:scale-90 transition-transform text-white"
        >
          <div className="w-11 h-11 rounded-full bg-black/40 backdrop-blur-md border border-white/10 flex items-center justify-center">
            <Share2 className="w-6 h-6" />
          </div>
          <span className="text-[11px] font-bold drop-shadow">{currentReel.stats.shares == null ? '—' : currentReel.stats.shares.toLocaleString()}</span>
        </button>

        {/* Bookmark / Save */}
        <button
          onClick={handleSave}
          aria-label={currentReel.isSaved ? 'Unsave reel' : 'Save reel'}
          className="flex flex-col items-center gap-1 group active:scale-90 transition-transform"
        >
          <div className={cn(
            "w-11 h-11 rounded-full bg-black/40 backdrop-blur-md border border-white/10 flex items-center justify-center",
            currentReel.isSaved ? "bg-amber-500/20 border-amber-500 text-amber-400" : "text-white"
          )}>
            <Bookmark className={cn("w-6 h-6", currentReel.isSaved && "fill-current text-amber-400")} />
          </div>
          <span className="text-[11px] font-bold drop-shadow">{currentReel.stats.saves == null ? '—' : currentReel.stats.saves.toLocaleString()}</span>
        </button>

        {/* Coin Gift Button */}
        <button
          onClick={() => setGiftModal(true)}
          aria-label="Send a coin gift"
          className="flex flex-col items-center gap-1 group active:scale-90 transition-transform text-amber-300"
        >
          <div className="w-11 h-11 rounded-full bg-amber-500/20 backdrop-blur-md border border-amber-500/40 flex items-center justify-center shadow-arvdoul-glow">
            <Gift className="w-6 h-6 text-amber-400 animate-bounce" />
          </div>
          <span className="text-[11px] font-black text-amber-400 drop-shadow">{currentReel.stats.gifts == null ? '—' : currentReel.stats.gifts.toLocaleString()}</span>
        </button>

        {/* More Options */}
        <button
          onClick={() => setSheetView('report')}
          aria-label="More options"
          className="w-10 h-10 rounded-full bg-black/40 backdrop-blur-md border border-white/10 flex items-center justify-center text-white/80"
        >
          <MoreVertical className="w-5 h-5" />
        </button>
      </div>

      {/* Bottom Left Creator Overlay Card */}
      <div className="relative z-30 px-5 pb-4 max-w-sm space-y-2">
        {/* Creator Info Pill */}
        <div className="p-3 rounded-2xl bg-black/60 backdrop-blur-xl border border-white/10 space-y-2 shadow-2xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <img
                src={currentReel.creator.avatar}
                alt={currentReel.creator.name}
                className="w-9 h-9 rounded-full object-cover border border-arvdoul-purple"
              />
              <div>
                <div className="flex items-center gap-1">
                  <span className="text-xs font-bold font-display">{currentReel.creator.name || 'Creator'}</span>
                  {currentReel.creator.verified && <CheckCircle2 className="w-3.5 h-3.5 text-arvdoul-blue fill-arvdoul-blue/20" />}
                </div>
                {currentReel.creator.username && (
                  <span className="text-[10px] text-white/60">@{currentReel.creator.username}</span>
                )}
              </div>
            </div>

            {currentReel.creator.id && currentReel.creator.id !== user?.uid && (
              <button
                onClick={() => handleFollow(currentReel.creator)}
                className={cn(
                  "px-3.5 py-1 rounded-xl text-xs font-bold transition-all",
                  currentReel.creator.isFollowing
                    ? "bg-white/10 text-white/80"
                    : "bg-gradient-to-r from-arvdoul-purple to-arvdoul-indigo text-white shadow-md"
                )}
              >
                {currentReel.creator.isFollowing ? 'Following' : 'Follow'}
              </button>
            )}
          </div>

          {currentReel.title && (
            <p className="text-xs font-medium text-white/90 leading-snug">
              {currentReel.title}
            </p>
          )}

          {/* Hashtags */}
          {currentReel.hashtags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 text-[11px] font-bold text-arvdoul-purple">
              {currentReel.hashtags.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => navigate(`/search?q=${encodeURIComponent(tag.replace(/^#/, ''))}`)}
                  className="hover:underline"
                >
                  {tag}
                </button>
              ))}
            </div>
          )}

          {/* Music Marquee Badge with Equalizer */}
          {currentReel.music && (
            <div className="flex items-center justify-between pt-1 border-t border-white/10 text-xs">
              <div className="flex items-center gap-2 text-white/80 truncate">
                <Music className="w-3.5 h-3.5 text-arvdoul-purple flex-shrink-0" />
                <span className="truncate text-[11px] font-medium">{currentReel.music}</span>
              </div>

              {/* Audio Wave Visualizer Box */}
              <div className="w-6 h-6 rounded-lg bg-arvdoul-purple/30 border border-arvdoul-purple/40 flex items-center justify-center gap-0.5 flex-shrink-0">
                <span className="w-0.5 h-3 bg-arvdoul-purple rounded-full animate-pulse" />
                <span className="w-0.5 h-4 bg-arvdoul-glow-magenta rounded-full animate-pulse" style={{ animationDelay: '0.2s' }} />
                <span className="w-0.5 h-2 bg-arvdoul-indigo rounded-full animate-pulse" style={{ animationDelay: '0.4s' }} />
              </div>
            </div>
          )}
        </div>

        {/* Playback progress — driven by the real <video> element time */}
        <div className="flex items-center gap-3 text-[10px] text-white/80 font-bold px-1">
          <span>{formatDuration(playback.currentTime)}</span>
          <div className="flex-1 h-1 rounded-full bg-white/20 relative overflow-hidden">
            <div
              style={{ width: `${playback.progress}%` }}
              className="h-full bg-gradient-to-r from-arvdoul-purple to-arvdoul-blue rounded-full"
            />
          </div>
          <span>{formatDuration(playback.duration || currentReel.duration)}</span>
          <button onClick={() => setIsMuted(!isMuted)} aria-label={isMuted ? 'Unmute' : 'Mute'}>
            {isMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Gesture Guide Pill */}
      <div className="relative z-30 px-5 pb-2">
        <div className="p-3 rounded-2xl bg-black/60 backdrop-blur-xl border border-white/10 flex items-center justify-between text-[11px] text-white/80 font-semibold shadow-lg">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-white/10 flex items-center justify-center text-arvdoul-glow-magenta">
              <Heart className="w-3.5 h-3.5 fill-current" />
            </div>
            <div>
              <p className="font-bold">Double tap</p>
              <p className="text-[9px] text-white/50">to like</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-white/10 flex items-center justify-center text-arvdoul-purple">
              <ArrowUp className="w-3.5 h-3.5" />
            </div>
            <div>
              <p className="font-bold">Swipe up</p>
              <p className="text-[9px] text-white/50">for more</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-white/10 flex items-center justify-center text-arvdoul-glow-cyan">
              <ArrowLeftRight className="w-3.5 h-3.5" />
            </div>
            <div>
              <p className="font-bold">Swipe left/right</p>
              <p className="text-[9px] text-white/50">next video</p>
            </div>
          </div>
        </div>
      </div>

      {/* Gift Modal — real coin amounts and a real double-entry transfer */}
      <AnimatePresence>
        {giftModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-sm rounded-3xl p-6 bg-[#0c0f24] border border-amber-500/40 text-center shadow-2xl"
            >
              <Gift className="w-12 h-12 text-amber-400 mx-auto mb-2" />
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
                      "py-2.5 rounded-xl text-xs font-bold border transition-colors disabled:opacity-50",
                      giftAmount === gift.coins
                        ? "bg-amber-500 text-black border-amber-500"
                        : "bg-amber-500/20 border-amber-500/40 text-amber-300 hover:bg-amber-500/30"
                    )}
                  >
                    <span className="block text-base">{gift.emoji}</span>
                    🪙 {gift.coins}
                  </button>
                ))}
              </div>

              <button
                type="button"
                disabled={!giftAmount || giftSending}
                onClick={() => handleSendGift(giftAmount)}
                className="w-full py-3 rounded-xl text-sm font-bold bg-gradient-to-r from-amber-500 to-orange-500 text-black hover:opacity-95 disabled:opacity-40 mb-2"
              >
                {giftSending ? 'Sending…' : giftAmount ? `Send ${giftAmount} Coins` : 'Select a gift'}
              </button>

              <button
                onClick={() => { setGiftModal(false); setGiftAmount(null); }}
                className="w-full py-2.5 rounded-xl text-xs font-bold border border-white/10 text-white hover:bg-white/5"
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
  );
}
