// src/components/Home/ReelsFeed.jsx
// Reels feed backed by the canonical videoService (server-authoritative
// likes/shares, no direct Firestore writes).
import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Heart, MessageCircle, Share2, Verified, Download, UserPlus, Link2,
  Loader2, X,
} from "lucide-react";
import { toast } from "sonner";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import useIntersectionObserver from "../../hooks/useIntersectionObserver";
import CommentsModal from "./CommentsModal";
import SponsoredPostCard from "../Ads/SponsoredPostCard";
import { useAuth } from "../../context/AuthContext";
import { useTheme } from "../../context/ThemeContext";
import videoService from "../../services/videoService";
import { getUserService } from "../../services/userService";
import { copyToClipboard } from "../../utils/shareUtils";
import { getSafeAvatarUrl } from "../../utils/avatarUtils";

dayjs.extend(relativeTime);

const FEED_PAGE_SIZE = 5;

/** Maps a videoService feed item to the reel display shape. */
const toReel = (v) => {
  const creatorName = v.creator?.name || v.authorName || "";
  const creatorId = v.creator?.id || v.authorId || v.userId || null;
  return {
    id: v.id,
    userId: creatorId,
    displayName: creatorName,
    userPhotoURL: getSafeAvatarUrl(v.creator?.avatar || v.authorPhoto, creatorName, creatorId),
    verified: Boolean(v.creator?.isVerified || v.authorVerified),
    caption: v.title || v.description || "",
    hashtags: v.hashtags || [],
    videoURL: v.videoUrl || "",
    thumbnailURL: v.thumbnailUrl || "",
    isLiked: Boolean(v.isLiked),
    stats: {
      likes: v.likes || 0,
      comments: v.comments || 0,
      shares: v.shares || 0,
    },
    createdAt: v.createdAt,
  };
};

export default function ReelsFeed({ initialQueryLimit = FEED_PAGE_SIZE }) {
  const { user } = useAuth();
  const { theme } = useTheme();

  const [reels, setReels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const [commentsReel, setCommentsReel] = useState(null);
  const [shareReel, setShareReel] = useState(null);
  const [followingIds, setFollowingIds] = useState(() => new Set());
  const sentinelRef = useRef(null);

  const patchReel = useCallback((id, patch) => {
    setReels((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }, []);

  const loadReels = useCallback(async () => {
    if (!user?.uid) {
      setReels([]);
      setLoading(false);
      setHasMore(false);
      return;
    }
    try {
      setLoading(true);
      const res = await videoService.getVideoFeed(user.uid, {
        feedType: "for_you",
        limit: initialQueryLimit,
        type: "video",
      });
      const mapped = (res.feed || []).map(toReel).filter((r) => r.videoURL);
      setReels(mapped);
      setHasMore(Boolean(res.hasMore));
    } catch (err) {
      console.error("Failed to load reels:", err);
      toast.error("Failed to load reels");
      setReels([]);
      setHasMore(false);
    } finally {
      setLoading(false);
    }
  }, [user?.uid, initialQueryLimit]);

  useEffect(() => { loadReels(); }, [loadReels]);

  // Resolve real follow state for the loaded creators.
  useEffect(() => {
    if (!user?.uid || reels.length === 0) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const res = await getUserService().getFollowing(user.uid, { limit: 200 });
        if (cancelled) return;
        const ids = new Set((res.following || res.friends || []).map((f) => f.uid || f.id));
        setFollowingIds(ids);
      } catch (err) {
        console.warn("Could not resolve follow state:", err);
      }
    })();
    return () => { cancelled = true; };
  }, [user?.uid, reels.length]);

  const loadMoreReels = useCallback(async () => {
    if (!hasMore || loading || reels.length === 0) return;
    try {
      const res = await videoService.getVideoFeed(user.uid, {
        feedType: "for_you",
        limit: FEED_PAGE_SIZE,
        type: "video",
      });
      const existing = new Set(reels.map((r) => r.id));
      const next = (res.feed || []).map(toReel).filter((r) => r.videoURL && !existing.has(r.id));
      if (next.length === 0) {
        setHasMore(false);
        return;
      }
      setReels((prev) => [...prev, ...next]);
      setHasMore(Boolean(res.hasMore));
    } catch (err) {
      console.warn("Could not load more reels:", err);
      setHasMore(false);
    }
  }, [user?.uid, hasMore, loading, reels]);

  useEffect(() => {
    const node = sentinelRef.current;
    if (!node || typeof IntersectionObserver === "undefined") return undefined;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) loadMoreReels();
    }, { rootMargin: "400px" });
    observer.observe(node);
    return () => observer.disconnect();
  }, [loadMoreReels]);

  const handleReaction = async (reelId) => {
    if (!user) {
      toast.error("Sign in to like reels");
      return;
    }
    const reel = reels.find((r) => r.id === reelId);
    if (!reel) return;
    const nextLiked = !reel.isLiked;
    patchReel(reelId, {
      isLiked: nextLiked,
      stats: { ...reel.stats, likes: Math.max(0, reel.stats.likes + (nextLiked ? 1 : -1)) },
    });
    try {
      await videoService.likeVideo(reelId);
    } catch (err) {
      patchReel(reelId, { isLiked: reel.isLiked, stats: reel.stats });
      toast.error(err?.message || "Failed to update like");
    }
  };

  const handleFollow = async (uid) => {
    if (!user) {
      toast.error("Sign in to follow creators");
      return;
    }
    try {
      await getUserService().followUser(user.uid, uid);
      setFollowingIds((prev) => new Set(prev).add(uid));
      toast.success("Following");
    } catch (err) {
      toast.error(err?.message || "Failed to follow creator");
    }
  };

  const handleDownload = async (url, filename) => {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const objectUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = String(filename || "reel.mp4").replace(/[^a-zA-Z0-9._-]/g, "_");
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => window.URL.revokeObjectURL(objectUrl), 1000);
      toast.success("Download started!");
    } catch (err) {
      console.error(err);
      toast.error("Failed to download");
    }
  };

  const handleShareNative = async (reel) => {
    const url = `${window.location.origin}/video/${reel.id}`;
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title: reel.caption || "Arvdoul reel", url });
        await videoService.shareVideo(reel.id, "native").catch(() => {});
        setShareReel(null);
        return;
      } catch (err) {
        if (err?.name === "AbortError") return;
      }
    }
    try {
      await copyToClipboard(url);
      await videoService.shareVideo(reel.id, "copy_link").catch(() => {});
      toast.success("Link copied");
      setShareReel(null);
    } catch {
      toast.error("Could not share reel");
    }
  };

  if (loading) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-black">
        <Loader2 className="w-8 h-8 animate-spin text-white/70" />
      </div>
    );
  }

  if (reels.length === 0) {
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center bg-black text-center px-8">
        <p className="text-white font-semibold mb-1">No reels yet</p>
        <p className="text-sm text-gray-400">Reels from creators you follow will appear here.</p>
      </div>
    );
  }

  return (
    <div className="h-screen w-full overflow-y-auto snap-y snap-mandatory bg-black">
      {reels.map((reel, idx) => (
        <ReelItem
          key={reel.id}
          reel={reel}
          isFollowing={followingIds.has(reel.userId)}
          onLike={() => handleReaction(reel.id)}
          onComment={() => setCommentsReel(reel)}
          onShare={() => setShareReel(reel)}
          onDownload={() => handleDownload(reel.videoURL, `${reel.id}.mp4`)}
          onFollow={() => handleFollow(reel.userId)}
          theme={theme}
          user={user}
          preloadedNext={reels[idx + 1]}
        />
      ))}

      <div ref={sentinelRef} className="h-16 w-full flex items-center justify-center">
        {hasMore && <Loader2 className="w-5 h-5 animate-spin text-white/60" />}
      </div>

      <div className="px-4 pb-8">
        <SponsoredPostCard placement="reels" />
      </div>

      {commentsReel && (
        <CommentsModal postId={commentsReel.id} onClose={() => setCommentsReel(null)} />
      )}

      <AnimatePresence>
        {shareReel && (
          <ShareSheet
            reel={shareReel}
            onNative={() => handleShareNative(shareReel)}
            onClose={() => setShareReel(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function ShareSheet({ reel, onNative, onClose }) {
  const url = `${window.location.origin}/video/${reel.id}`;
  const copy = async () => {
    try {
      await copyToClipboard(url);
      await videoService.shareVideo(reel.id, "copy_link").catch(() => {});
      toast.success("Link copied");
      onClose();
    } catch {
      toast.error("Could not copy link");
    }
  };
  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 z-40 bg-black/60"
      />
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 30, stiffness: 300 }}
        className="fixed bottom-0 left-0 right-0 z-50 bg-neutral-900 rounded-t-3xl p-5 pb-8"
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-white font-semibold">Share reel</h3>
          <button onClick={onClose} aria-label="Close share sheet" className="text-gray-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={onNative}
            className="flex flex-col items-center gap-2 py-4 rounded-2xl bg-white/5 hover:bg-white/10 text-white transition-colors"
          >
            <Share2 className="w-6 h-6" />
            <span className="text-sm">Share via…</span>
          </button>
          <button
            onClick={copy}
            className="flex flex-col items-center gap-2 py-4 rounded-2xl bg-white/5 hover:bg-white/10 text-white transition-colors"
          >
            <Link2 className="w-6 h-6" />
            <span className="text-sm">Copy link</span>
          </button>
        </div>
      </motion.div>
    </>
  );
}

function ReelItem({
  reel, isFollowing, onVisible, onLike, onComment, onShare,
  onDownload, onFollow, user, preloadedNext,
}) {
  const videoRef = useRef(null);
  const entry = useIntersectionObserver(videoRef, { threshold: 0.75 });
  const [showLikeAnim, setShowLikeAnim] = useState(false);

  useEffect(() => {
    const visible = !!entry?.isIntersecting;
    onVisible(reel.id, visible);
    if (videoRef.current) {
      if (visible) videoRef.current.play().catch(() => {});
      else videoRef.current.pause();
    }
  }, [entry, reel.id, onVisible]);

  const handleDoubleTap = async () => {
    if (!user || reel.isLiked) return;
    setShowLikeAnim(true);
    setTimeout(() => setShowLikeAnim(false), 800);
    await onLike();
  };

  useEffect(() => {
    if (!preloadedNext?.videoURL) return undefined;
    const video = document.createElement("video");
    video.src = preloadedNext.videoURL;
    video.preload = "auto";
    video.style.display = "none";
    document.body.appendChild(video);
    return () => { try { document.body.removeChild(video); } catch { /* detached */ } };
  }, [preloadedNext]);

  return (
    <div className="relative w-full h-screen snap-start">
      <video
        ref={videoRef}
        src={reel.videoURL}
        poster={reel.thumbnailURL || undefined}
        className="w-full h-full object-cover"
        loop
        muted
        playsInline
        preload="auto"
        onDoubleClick={handleDoubleTap}
        aria-label={`Reel by ${reel.displayName || "creator"}`}
      />

      <AnimatePresence>
        {showLikeAnim && (
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1.5, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            className="absolute inset-0 flex items-center justify-center pointer-events-none text-red-500 text-6xl"
          >
            ❤️
          </motion.div>
        )}
      </AnimatePresence>

      <div className="absolute bottom-20 right-4 flex flex-col items-center gap-4 text-white">
        <button onClick={onLike} className="flex flex-col items-center" aria-label={reel.isLiked ? "Unlike reel" : "Like reel"}>
          <Heart className={`w-8 h-8 ${reel.isLiked ? "text-red-500" : ""}`} />
          <span className="text-sm">{reel.stats.likes}</span>
        </button>
        <button onClick={onComment} className="flex flex-col items-center" aria-label="Open comments">
          <MessageCircle className="w-8 h-8" />
          <span className="text-sm">{reel.stats.comments}</span>
        </button>
        <button onClick={onDownload} className="flex flex-col items-center" aria-label="Save reel">
          <Download className="w-8 h-8" />
          <span className="text-sm">Save</span>
        </button>
        <button onClick={onShare} className="flex flex-col items-center" aria-label="Share reel">
          <Share2 className="w-8 h-8" />
          <span className="text-sm">{reel.stats.shares}</span>
        </button>
        {user?.uid !== reel.userId && (
          <button
            onClick={onFollow}
            disabled={isFollowing}
            className="flex flex-col items-center disabled:opacity-60"
            aria-label={isFollowing ? "Following" : "Follow creator"}
          >
            <UserPlus className="w-8 h-8" />
            <span className="text-sm">{isFollowing ? "Following" : "Follow"}</span>
          </button>
        )}
      </div>

      <div className="absolute bottom-8 left-4 text-white max-w-[80%]">
        <div className="flex items-center gap-2">
          <img
            src={reel.userPhotoURL}
            alt={reel.displayName || "Reel creator"}
            className="w-10 h-10 rounded-full border-2 border-white object-cover"
          />
          <span className="font-semibold flex items-center gap-1">
            {reel.displayName}
            {reel.verified && <Verified className="w-4 h-4 text-blue-500" />}
          </span>
        </div>
        {reel.caption && <p className="text-sm mt-1">{reel.caption}</p>}
        {reel.hashtags?.length > 0 && (
          <p className="text-xs text-gray-300 mt-1">{reel.hashtags.map((h) => `#${h}`).join(" ")}</p>
        )}
        {reel.createdAt && (
          <p className="text-xs text-gray-300">
            {dayjs(reel.createdAt?.seconds ? reel.createdAt.seconds * 1000 : reel.createdAt).fromNow()}
          </p>
        )}
      </div>
    </div>
  );
}
