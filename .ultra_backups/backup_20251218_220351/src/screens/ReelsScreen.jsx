// src/screens/ReelsScreen.jsx
import React, { useEffect, useState, useRef, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Heart, MessageCircle, Share2, Volume2, VolumeX, Play, Pause, Loader2, MoreVertical } from "lucide-react";
import { toast } from "sonner";

import { db } from "../firebase/firebase";
import { collection, query, orderBy, limit, getDocs, doc, updateDoc, arrayUnion, arrayRemove, increment, onSnapshot } from "firebase/firestore";

import { useAuth } from "../context/AuthContext";
import { cn } from "../lib/utils";

import CommentsDrawer from "../components/Videos/CommentsDrawer";
import Watermark from "../components/Videos/Watermark";
import AdsSlot from "../components/Ads/AdsSlot";
import * as recsService from "../lib/recsService";

/** utils */
const isVideoItem = (m) => m?.type === "video" || (m?.mime && m.mime.startsWith?.("video/"));
const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
const fmt = (s) => {
  if (!Number.isFinite(s)) return "0:00";
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec < 10 ? "0" : ""}${sec}`;
};
const VIEW_MS = 1000;

export default function ReelsScreen() {
  const navigate = useNavigate();
  const { user, followUser } = useAuth();

  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeIndex, setActiveIndex] = useState(0);
  const [commentsFor, setCommentsFor] = useState(null);

  const rewarded = useRef(new Set());
  const containerRef = useRef(null);
  const ioRef = useRef(null);
  const videoRefs = useRef({});
  const progressRefs = useRef({});
  const impressed = useRef(new Set());

  // Load feed: recommended or fallback to recent
  useEffect(() => {
    let mounted = true;
    setLoading(true);

    (async () => {
      try {
        const recs = await recsService.getRecommendations({ userId: user?.uid });
        if (!mounted) return;
        setPosts(recs);
      } catch (e) {
        console.warn("recs failed, fallback", e);
        const q = query(collection(db, "posts"), orderBy("createdAt", "desc"), limit(50));
        const snap = await getDocs(q);
        const list = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(p => Array.isArray(p?.media) && p.media.some(isVideoItem));
        if (!mounted) return;
        setPosts(list);
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => (mounted = false);
  }, [user?.uid]);

  // Real-time meta updates (likes/comments)
  useEffect(() => {
    const unsubscribers = [];
    const ids = posts.map(p => p.id).slice(0, 30);
    ids.forEach(id => {
      const refDoc = doc(db, "posts", id);
      const unsub = onSnapshot(refDoc, snap => {
        const data = snap.exists() ? snap.data() : null;
        if (data) setPosts(prev => prev.map(p => (p.id === id ? { ...p, ...data } : p)));
      }, err => console.warn("post meta onSnapshot err", err));
      unsubscribers.push(unsub);
    });
    return () => unsubscribers.forEach(u => u());
  }, [posts.map?.(p => p.id).join?.(",")]);

  // IntersectionObserver for autoplay & active index
  useEffect(() => {
    if (!containerRef.current) return;
    if (ioRef.current) ioRef.current.disconnect();

    const io = new IntersectionObserver(entries => {
      let topCandidate = { idx: activeIndex, ratio: -1 };
      entries.forEach(e => {
        const idx = Number(e.target.getAttribute("data-idx"));
        if (e.intersectionRatio > topCandidate.ratio) topCandidate = { idx, ratio: e.intersectionRatio };

        const postId = e.target.getAttribute("data-id");
        const v = videoRefs.current[postId];
        if (!v) return;

        if (e.isIntersecting && e.intersectionRatio >= 0.8) v.play().catch(() => {});
        else v.pause();
      });

      if (topCandidate.ratio >= 0.8 && topCandidate.idx !== activeIndex) setActiveIndex(topCandidate.idx);
    }, { root: containerRef.current, threshold: [0, 0.25, 0.5, 0.8, 1] });

    Array.from(containerRef.current.querySelectorAll("[data-slide]")).forEach(el => io.observe(el));
    ioRef.current = io;
    return () => io.disconnect();
  }, [posts.length]);

  // Reward view count
  useEffect(() => {
    const post = posts[activeIndex];
    if (!post || rewarded.current.has(post.id)) return;

    const timer = setTimeout(async () => {
      try {
        rewarded.current.add(post.id);
        await updateDoc(doc(db, "posts", post.id), { viewCount: increment(1) });
        recsService.reportView(post.id, { viewerId: user?.uid || null }).catch(() => {});
      } catch (e) { console.warn("view increment failed", e); }
    }, VIEW_MS);

    return () => clearTimeout(timer);
  }, [activeIndex, posts, user?.uid]);

  // Preload next video
  useEffect(() => {
    const next = posts[activeIndex + 1];
    if (!next) return;
    const src = next.media?.find(isVideoItem)?.url;
    if (!src) return;
    const vid = document.createElement("video");
    vid.src = src;
    vid.preload = "auto";
  }, [activeIndex, posts]);

  // ------------------- Handlers -------------------
  const toggleLike = useCallback(async post => {
    if (!user) return toast("Please sign in to like");
    const postRef = doc(db, "posts", post.id);
    const liked = post.likedBy?.includes?.(user.uid);

    setPosts(prev => prev.map(p => p.id === post.id
      ? { ...p, likedBy: liked ? p.likedBy.filter(u => u !== user.uid) : [...(p.likedBy || []), user.uid], likesCount: clamp((p.likesCount || 0) + (liked ? -1 : 1), 0, Infinity) }
      : p
    ));

    try {
      await updateDoc(postRef, { likedBy: liked ? arrayRemove(user.uid) : arrayUnion(user.uid), likesCount: increment(liked ? -1 : 1) });
      recsService.reportInteraction(post.id, { userId: user.uid, interaction: liked ? "unlike" : "like" }).catch(() => {});
    } catch {
      setPosts(prev => prev.map(p => (p.id === post.id ? post : p)));
      toast.error("Could not update like");
    }
  }, [user]);

  const handleShare = useCallback(post => {
    const url = `${window.location.origin}/post/${post.id}`;
    if (navigator.share) navigator.share({ title: "Check this on Arvdoul", text: post.caption || "", url }).catch(() => {});
    else navigator.clipboard.writeText(url).then(() => toast.success("Link copied"), () => toast.error("Could not copy link"));
  }, []);

  const handleFollow = useCallback(async post => {
    if (!user || !followUser) return toast("Login required");
    if (user.uid === post.userId) return;
    try {
      await followUser(post.userId);
      toast.success("Followed");
      recsService.reportInteraction(post.id, { userId: user.uid, interaction: "follow" }).catch(() => {});
    } catch { toast.error("Could not follow"); }
  }, [user, followUser]);

  const togglePlayPause = useCallback(postId => {
    const v = videoRefs.current[postId]; if (!v) return; if (v.paused) v.play().catch(() => {}); else v.pause();
  }, []);

  const toggleMute = useCallback(postId => {
    const v = videoRefs.current[postId]; if (!v) return; v.muted = !v.muted;
  }, []);

  const onTimeUpdate = useCallback(postId => {
    const v = videoRefs.current[postId]; if (!v) return;
    const pct = v.duration ? (v.currentTime / v.duration) * 100 : 0;
    progressRefs.current[postId] = pct;
    const bar = document.querySelector(`[data-progress="${postId}"]`);
    if (bar) bar.style.width = `${pct}%`;
  }, []);

  const onVideoRef = useCallback((postId, node) => {
    if (node) {
      videoRefs.current[postId] = node;
      const handler = () => onTimeUpdate(postId);
      node.addEventListener("timeupdate", handler);
      node.addEventListener("ended", () => {
        const idx = posts.findIndex(p => p.id === postId);
        const nextIdx = clamp(idx + 1, 0, posts.length - 1);
        if (nextIdx !== idx) containerRef.current?.querySelector(`[data-idx="${nextIdx}"]`)?.scrollIntoView({ behavior: "smooth" });
      });
      node.__arvdoul_handler = handler;
    } else {
      const v = videoRefs.current[postId];
      if (v) try { v.removeEventListener("timeupdate", v.__arvdoul_handler); } catch {}
      delete videoRefs.current[postId];
    }
  }, [posts, onTimeUpdate]);

  const pingAdImpression = useCallback(adId => {
    if (!adId || impressed.current.has(adId)) return;
    impressed.current.add(adId);
    recsService.reportAdImpression(adId, { userId: user?.uid || null }).catch(() => {});
  }, [user?.uid]);

  const videoPosts = useMemo(() => posts.filter(p => p.media?.some(isVideoItem)), [posts]);

  if (loading) return (
    <div className="h-screen w-full grid place-items-center bg-black text-white">
      <div className="flex items-center gap-3 opacity-80"><Loader2 className="w-6 h-6 animate-spin" /> Loading videos…</div>
    </div>
  );

  if (!videoPosts.length) return (
    <div className="h-screen w-full grid place-items-center bg-black text-white text-center opacity-80">
      <div className="text-xl font-semibold">No videos yet</div>
      <div className="text-sm mt-1">Follow creators or explore trending content.</div>
    </div>
  );

  return (
    <>
      <CommentsDrawer postId={commentsFor} onClose={() => setCommentsFor(null)} />
      <div ref={containerRef} className="relative h-screen w-full overflow-y-scroll snap-y snap-mandatory bg-black">
        {videoPosts.map((post, idx) => {
          const videoSrc = post.media.find(isVideoItem)?.url;
          const liked = !!post.likedBy?.includes?.(user?.uid);
          const isAd = post.__ad === true;

          return (
            <section key={post.id} data-slide data-idx={idx} data-id={post.id} className="relative h-screen w-full snap-start">
              <div className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-black/70 to-transparent z-[1]" />
              <div className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-black/80 to-transparent z-[1]" />

              {isAd ? <div className="h-full w-full grid place-items-center"><AdsSlot ad={post.ad} onImpression={() => pingAdImpression(post.ad?.id)} /></div> :
                <>
                  <video ref={n => onVideoRef(post.id, n)} src={videoSrc} className="absolute inset-0 h-full w-full object-cover" playsInline loop muted preload="auto" onClick={() => togglePlayPause(post.id)} />
                  <Watermark text={user?.displayName || "Arvdoul"} />

                  {/* right controls */}
                  <div className="absolute right-3 top-1/3 z-[2] flex flex-col items-center gap-5 text-white">
                    <IconButton label={post.likesCount || 0} active={liked} onClick={() => toggleLike(post)}><Heart className={`cn("w-9 h-9", liked && "text-red-500 fill-red-500")`} /></IconButton>
                    <IconButton label={post.commentsCount || 0} onClick={() => setCommentsFor(post.id)}><MessageCircle className="w-9 h-9" /></IconButton>
                    <IconButton onClick={() => handleShare(post)}><Share2 className="w-9 h-9" /></IconButton>
                    {user?.uid !== post.userId && <IconButton onClick={() => handleFollow(post)}><MoreVertical className="w-9 h-9" /></IconButton>}
                    <IconButton onClick={() => toggleMute(post.id)}>{videoRefs.current[post.id]?.muted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}</IconButton>
                    <IconButton onClick={() => togglePlayPause(post.id)}>{videoRefs.current[post.id]?.paused ? <Play className="w-5 h-5" /> : <Pause className="w-5 h-5" />}</IconButton>
                  </div>

                  {/* bottom progress */}
                  <div className="absolute z-[2] bottom-3 left-3 right-3 text-white">
                    {post.caption && <p className="text-sm leading-snug opacity-95"><span className="font-semibold mr-1">{post.displayName || "@" + (post.username || "user")}</span>{post.caption}</p>}
                    <div className="mt-2 h-1.5 w-full bg-white/20 rounded-full overflow-hidden">
                      <div data-progress={post.id} className="h-full w-0 bg-white transition-[width] duration-150 will-change-[width]" style={`{ width: `${progressRefs.current[post.id] || 0}%` `}} />
                    </div>
                  </div>

                  <DoubleTapLayer onDoubleTap={() => toggleLike(post)} />
                </>
              }
            </section>
          );
        })}
      </div>
    </>
  );
}

/** UI Helpers */
function IconButton({ children, label, onClick, active }) {
  return (
    <button onClick={onClick} className={`cn("flex flex-col items-center gap-1 active:scale-[0.96] transition-transform")`}>
      <div className={`cn("grid place-items-center rounded-full p-2", active ? "bg-white/20" : "bg-white/10", "backdrop-blur")}>{children`}</div>
      {label !== undefined && <span className="text-xs opacity-90">{label}</span>}
    </button>
  );
}

function DoubleTapLayer({ onDoubleTap }) {
  const [pulse, setPulse] = useState(false);
  const handle = () => {
    setPulse(true);
    onDoubleTap?.();
    setTimeout(() => setPulse(false), 650);
  };
  return (
    <div className="absolute inset-0 z-[1]" onDoubleClick={handle} style={{ background: "transparent" }}>
      <AnimatePresence>
        {pulse && (
          <motion.div initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1.4, opacity: 1 }} exit={{ scale: 0, opacity: 0 }} transition={{ duration: 0.35 }} className="absolute inset-0 grid place-items-center">
            <Heart className="w-24 h-24 text-white drop-shadow-[0_0_12px_rgba(0,0,0,0.6)] fill-white" />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}