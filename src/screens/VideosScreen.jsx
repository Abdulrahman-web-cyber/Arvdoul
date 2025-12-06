// src/screens/VideosScreen.jsx
import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import {
Heart,
MessageCircle,
Share2,
Download,
Volume2,
VolumeX,
Play,
Pause,
Loader2,
MoreVertical,
} from "lucide-react";
import { toast } from "sonner";

import { db } from "../firebase/firebase";
import {
collection,
query,
orderBy,
onSnapshot,
doc,
updateDoc,
arrayUnion,
arrayRemove,
increment,
getDoc,
getDocs,
where,
limit,
} from "firebase/firestore";

import { useAuth } from "../context/AuthContext";
import { cn } from "../lib/utils";

import CommentsDrawer from "../components/Videos/CommentsDrawer";
import Watermark from "../components/Videos/Watermark";
import AdsSlot from "../components/Ads/AdsSlot";
import * as recsService from "../lib/recsService";

/** small utils */
const isVideoItem = (m) => m?.type === "video" || (m?.mime && m.mime.startsWith?.("video/"));
const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
const fmt = (s) => {
if (!Number.isFinite(s)) return "0:00";
const m = Math.floor(s / 60);
const sec = Math.floor(s % 60);
return `${m}:${sec < 10 ? "0" : ""}${sec}`;
};

// how long to consider a view (ms)
const VIEW_MS = 1000;

/**

VideosScreen (upgraded)

Algorithmic feed loader (cloud function with client fallback)


Ads slots with impression ping


Comments drawer


Robust watermark overlay (rotating, low opacity)
*/
export default function VideosScreen() {
const navigate = useNavigate();
const { user, followUser } = useAuth();



// posts is unified feed (ordered by recomender or fallback to recent)
const [posts, setPosts] = useState([]);
const [loading, setLoading] = useState(true);

// active index by intersection observer
const [activeIndex, setActiveIndex] = useState(0);

// comments drawer
const [commentsFor, setCommentsFor] = useState(null);

// rewarded views local set
const rewarded = useRef(new Set());
const containerRef = useRef(null);
const ioRef = useRef(null);
const videoRefs = useRef({});
const progressRefs = useRef({});

// ad impressions guard
const impressed = useRef(new Set());

// local ranking settings - used by fallback recs
const [personalization, setPersonalization] = useState({ recencyWeight: 0.6, engagementWeight: 0.4 });

// ------------ Load feed: try server recs, fallback to local recent ------------
useEffect(() => {
let mounted = true;
setLoading(true);

// try cloud recs first (recommended). recsService will fallback if unavailable.  
(async () => {  
  try {  
    const recs = await recsService.getRecommendations({ userId: user?.uid });  
    if (!mounted) return;  
    setPosts(recs);  
  } catch (e) {  
    console.warn("recs failed, falling back", e);  
    // fallback: get latest 50 posts with videos  
    const q = query(collection(db, "posts"), orderBy("createdAt", "desc"), limit(50));  
    const snap = await getDocs(q);  
    const list = snap.docs.map((d) => ({ id: d.id, ...d.data() })).filter((p) => Array.isArray(p?.media) && p.media.some(isVideoItem));  
    if (!mounted) return;  
    setPosts(list);  
  } finally {  
    if (mounted) setLoading(false);  
  }  
})();  

return () => {  
  mounted = false;  
};

}, [user?.uid]);

// ------------ real-time small updates subscription (likes/comments counts) ------------
useEffect(() => {
// Listen to meta updates for currently loaded posts (if small list)
// We'll set up onSnapshot on posts in view for live counts.
const unsubscribers = [];
const ids = posts.map((p) => p.id).slice(0, 30);
ids.forEach((id) => {
const ref = doc(db, "posts", id);
const unsub = onSnapshot(ref, (snap) => {
const data = snap.exists() ? snap.data() : null;
if (data) {
setPosts((prev) => prev.map((p) => (p.id === id ? { ...p, ...data } : p)));
}
}, (err) => console.warn("post meta onSnapshot err", err));
unsubscribers.push(unsub);
});
return () => unsubscribers.forEach((u) => u());
}, [posts.map?.((p) => p.id).join?.(",")]);

// ------------ IntersectionObserver for autoplay/pause & active index ------------
useEffect(() => {
if (!containerRef.current) return;
if (ioRef.current) {
ioRef.current.disconnect();
ioRef.current = null;
}

const rootEl = containerRef.current;  
const io = new IntersectionObserver(  
  (entries) => {  
    let topCandidate = { idx: activeIndex, ratio: -1 };  
    entries.forEach((e) => {  
      const idx = Number(e.target.getAttribute("data-idx"));  
      if (e.intersectionRatio > topCandidate.ratio) topCandidate = { idx, ratio: e.intersectionRatio };  

      const postId = e.target.getAttribute("data-id");  
      const v = videoRefs.current[postId];  
      if (!v) return;  
      // play/pause when >= 80%  
      if (e.isIntersecting && e.intersectionRatio >= 0.8) {  
        v.play().catch(() => {});  
      } else {  
        v.pause();  
      }  
    });  

    if (topCandidate.ratio >= 0.8 && topCandidate.idx !== activeIndex) setActiveIndex(topCandidate.idx);  
  },  
  { root: rootEl, threshold: [0, 0.25, 0.5, 0.8, 1] }  
);  

const children = Array.from(rootEl.querySelectorAll("[data-slide]"));  
children.forEach((el) => io.observe(el));  
ioRef.current = io;  

return () => io.disconnect();

}, [posts.length]);

// ------------ reward view and increment viewCount (1s view) ------------
useEffect(() => {
const post = posts[activeIndex];
if (!post) return;
const postId = post.id;
if (rewarded.current.has(postId)) return;

const timer = setTimeout(async () => {  
  try {  
    rewarded.current.add(postId);  
    // increment view server-side  
    await updateDoc(doc(db, "posts", postId), { viewCount: increment(1) });  
    // optionally ping cloud for reward/impression (server ensures single counting)  
    recsService.reportView(postId, { viewerId: user?.uid || null }).catch(() => {});  
  } catch (e) {  
    console.warn("view increment failed", e);  
  }  
}, VIEW_MS);  

return () => clearTimeout(timer);

}, [activeIndex, posts, user?.uid]);

// ------------ preload next video ------------
useEffect(() => {
const next = posts[activeIndex + 1];
if (!next) return;
const src = next.media?.find(isVideoItem)?.url;
if (!src) return;
const vid = document.createElement("video");
vid.src = src;
vid.preload = "auto";
}, [activeIndex, posts]);

// ------------ handlers ------------
const toggleLike = useCallback(
async (post) => {
if (!user) {
toast("Please sign in to like");
return;
}
const postRef = doc(db, "posts", post.id);
const liked = post.likedBy?.includes?.(user.uid);

// optimistic  
  setPosts((prev) => prev.map((p) => (p.id === post.id ? { ...p, likedBy: liked ? p.likedBy.filter((u) => u !== user.uid) : [...(p.likedBy || []), user.uid], likesCount: clamp((p.likesCount || 0) + (liked ? -1 : 1), 0, Infinity) } : p)));  

  try {  
    await updateDoc(postRef, { likedBy: liked ? arrayRemove(user.uid) : arrayUnion(user.uid), likesCount: increment(liked ? -1 : 1) });  
    // report to recsys for personalization  
    recsService.reportInteraction(post.id, { userId: user.uid, interaction: liked ? "unlike" : "like" }).catch(() => {});  
  } catch (e) {  
    console.error("like update failed", e);  
    setPosts((prev) => prev.map((p) => (p.id === post.id ? post : p)));  
    toast.error("Could not update like");  
  }  
},  
[user]

);

const handleShare = useCallback((post) => {
const url = ${window.location.origin}/post/${post.id};
if (navigator.share) {
navigator.share({ title: "Check this on Arvdoul", text: post.caption || "", url }).catch(() => {});
} else {
navigator.clipboard.writeText(url).then(() => toast.success("Link copied to clipboard"), () => toast.error("Could not copy link"));
}
}, []);

const handleDownload = useCallback(async (post) => {
const src = post.media?.find(isVideoItem)?.url;
if (!src) return toast.error("No downloadable video");
try {
const res = await fetch(src);
const blob = await res.blob();
const a = document.createElement("a");
a.href = URL.createObjectURL(blob);
a.download = ${post.id}.mp4;
document.body.appendChild(a);
a.click();
a.remove();
toast.success("Download started");
} catch (e) {
console.error("download failed", e);
toast.error("Download failed");
}
}, []);

const handleFollow = useCallback(
async (post) => {
if (!user) return toast("Please login to follow");
if (!followUser) return toast.error("Follow unavailable");
if (user.uid === post.userId) return;
try {
await followUser(post.userId);
toast.success("Followed");
recsService.reportInteraction(post.id, { userId: user.uid, interaction: "follow" }).catch(() => {});
} catch {
toast.error("Could not follow");
}
},
[user, followUser]
);

const togglePlayPause = useCallback((postId) => {
const v = videoRefs.current[postId];
if (!v) return;
if (v.paused) v.play().catch(() => {});
else v.pause();
}, []);

const toggleMute = useCallback((postId) => {
const v = videoRefs.current[postId];
if (!v) return;
v.muted = !v.muted;
}, []);

const onTimeUpdate = useCallback((postId) => {
const v = videoRefs.current[postId];
if (!v) return;
const pct = v.duration ? (v.currentTime / v.duration) * 100 : 0;
progressRefs.current[postId] = pct;
const bar = document.querySelector([data-progress="${postId}"]);
if (bar) bar.style.width = ${pct}%;
}, []);

const onVideoRef = useCallback(
(postId, node) => {
if (node) {
videoRefs.current[postId] = node;
const handler = () => onTimeUpdate(postId);
node.addEventListener("timeupdate", handler);
node.addEventListener("ended", () => {
const idx = posts.findIndex((p) => p.id === postId);
const nextIdx = clamp(idx + 1, 0, posts.length - 1);
if (nextIdx !== idx) {
const slide = containerRef.current?.querySelector([data-idx="${nextIdx}"]);
slide?.scrollIntoView({ behavior: "smooth" });
}
});
node.__arvdoul_handler = handler;
} else {
const v = videoRefs.current[postId];
if (v) {
try {
v.removeEventListener("timeupdate", v.__arvdoul_handler);
} catch {}
delete videoRefs.current[postId];
}
}
},
[posts, onTimeUpdate]
);

// ads impression ping (called when ad slides become active)
const pingAdImpression = useCallback((adId) => {
if (!adId) return;
if (impressed.current.has(adId)) return;
impressed.current.add(adId);
// call cloud function / endpoint
recsService.reportAdImpression(adId, { userId: user?.uid || null }).catch(() => {});
}, [user?.uid]);

const videoPosts = useMemo(() => posts.filter((p) => p.media?.some(isVideoItem)), [posts]);

if (loading) {
return (
<div className="h-screen w-full grid place-items-center bg-black text-white">
<div className="flex items-center gap-3 opacity-80">
<Loader2 className="w-6 h-6 animate-spin" />
<span>Loading videos…</span>
</div>
</div>
);
}

if (!videoPosts.length) {
return (
<div className="h-screen w-full grid place-items-center bg-black text-white">
<div className="text-center opacity-80">
<div className="text-xl font-semibold">No videos yet</div>
<div className="text-sm mt-1">Follow creators or explore trending content.</div>
</div>
</div>
);
}

return (
<>
<CommentsDrawer postId={commentsFor} onClose={() => setCommentsFor(null)} />
<div ref={containerRef} className="relative h-screen w-full overflow-y-scroll snap-y snap-mandatory bg-black" style={{ scrollSnapType: "y mandatory" }}>
{videoPosts.map((post, idx) => {
const videoSrc = post.media.find(isVideoItem)?.url;
const liked = !!post.likedBy?.includes?.(user?.uid);

// inject ad after every 6 items (example)  
      const isAd = post.__ad === true;  

      return (  
        <section key={post.id} data-slide data-idx={idx} data-id={post.id} className="relative h-screen w-full snap-start">  
          {/* overlays */}  
          <div className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-black/70 to-transparent z-[1]" />  
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-black/80 to-transparent z-[1]" />  

          {isAd ? (  
            <div className="h-full w-full grid place-items-center">  
              <AdsSlot ad={post.ad} onImpression={() => pingAdImpression(post.ad?.id)} />  
            </div>  
          ) : (  
            <>  
              <video  
                ref={(n) => onVideoRef(post.id, n)}  
                src={videoSrc}  
                className="absolute inset-0 h-full w-full object-cover"  
                playsInline  
                loop  
                muted  
                preload="auto"  
                onClick={() => togglePlayPause(post.id)}  
              />  

              {/* watermark */}  
              <Watermark text={user?.displayName || "Arvdoul"} />  

              {/* right rail */}  
              <div className="absolute right-3 top-1/3 z-[2] flex flex-col items-center gap-5 text-white">  
                <IconButton label={post.likesCount || 0} active={liked} onClick={() => toggleLike(post)}>  
                  <Heart className={cn("w-9 h-9", liked && "text-red-500 fill-red-500")} />  
                </IconButton>  

                <IconButton label={post.commentsCount || 0} onClick={() => setCommentsFor(post.id)}>  
                  <MessageCircle className="w-9 h-9" />  
                </IconButton>  

                <IconButton onClick={() => handleShare(post)}>  
                  <Share2 className="w-9 h-9" />  
                </IconButton>  

                <IconButton onClick={() => handleDownload(post)}>  
                  <Download className="w-9 h-9" />  
                </IconButton>  

                {user?.uid !== post.userId && (  
                  <IconButton onClick={() => handleFollow(post)}>  
                    <MoreVertical className="w-9 h-9" />  
                  </IconButton>  
                )}  
              </div>  

              {/* bottom controls */}  
              <div className="absolute z-[2] bottom-3 left-3 right-3 text-white">  
                <div className="flex items-center gap-3 mb-2">  
                  <button onClick={() => toggleMute(post.id)} className="inline-flex items-center justify-center rounded-full bg-white/15 backdrop-blur px-2 py-1">  
                    {videoRefs.current[post.id]?.muted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}  
                  </button>  

                  <button onClick={() => togglePlayPause(post.id)} className="inline-flex items-center justify-center rounded-full bg-white/15 backdrop-blur px-2 py-1">  
                    {videoRefs.current[post.id]?.paused ? <Play className="w-5 h-5" /> : <Pause className="w-5 h-5" />}  
                  </button>  

                  <div className="text-xs opacity-80">  
                    {fmt(videoRefs.current[post.id]?.currentTime || 0)} / {fmt(videoRefs.current[post.id]?.duration || 0)}  
                  </div>  
                </div>  

                {post.caption && (  
                  <p className="text-sm leading-snug opacity-95">  
                    <span className="font-semibold mr-1">{post.displayName || "@" + (post.username || "user")}</span>  
                    {post.caption}  
                  </p>  
                )}  

                <div className="mt-2 h-1.5 w-full bg-white/20 rounded-full overflow-hidden">  
                  <div data-progress={post.id} className="h-full w-0 bg-white transition-[width] duration-150 will-change-[width]" style={{ width: `${progressRefs.current[post.id] || 0}%` }} />  
                </div>  
              </div>  

              <DoubleTapLayer onDoubleTap={() => toggleLike(post)} />  
            </>  
          )}  
        </section>  
      );  
    })}  
  </div>  
</>

);
}

/** UI helpers */
function IconButton({ children, label, onClick, active }) {
return (
<button onClick={onClick} className={cn("flex flex-col items-center gap-1 active:scale-[0.96] transition-transform")}>
<div className={cn("grid place-items-center rounded-full p-2", active ? "bg-white/20" : "bg-white/10", "backdrop-blur")}>{children}</div>
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