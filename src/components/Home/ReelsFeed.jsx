// src/components/Home/ReelsFeed.jsx
import { useState, useEffect, useRef, useCallback } from "react";
import { db } from "../../firebase/firebase";
import {
collection,
query,
orderBy,
limit,
startAfter,
onSnapshot,
getDocs,
updateDoc,
doc,
arrayUnion,
arrayRemove,
} from "firebase/firestore";
import { useAuth } from "../../context/AuthContext";
import { useTheme } from "../../context/ThemeContext";
import { motion, AnimatePresence } from "framer-motion";
import { Heart, MessageCircle, Share2, Verified, Download, UserPlus } from "lucide-react";
import { toast } from "sonner";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import useIntersectionObserver from "../../hooks/useIntersectionObserver";
import CommentsModal from "./CommentsModal";
import PropTypes from "prop-types";
import { CacheManager } from "../../utils/CacheManager";

dayjs.extend(relativeTime);

const REACTIONS = ["❤️", "😂", "😮", "😢", "😡"];
const FEED_PAGE_SIZE = 5;

export default function ReelsFeed({ initialQueryLimit = FEED_PAGE_SIZE }) {
const { user } = useAuth();

// REAL coin rewards through the monetization ledger (server-side double-entry
// with per-reason daily caps — see functions/monetization.js addCoins).
const awardCoins = async (uid, amount, reason, metadata = {}) => {
  try {
    const { getMonetizationService } = await import("../../services/monetizationService.js");
    await getMonetizationService().addCoins(uid, amount, reason, metadata);
  } catch (err) {
    console.warn("Coin reward skipped:", err.message);
  }
};
const { theme } = useTheme();

const [reels, setReels] = useState([]);
const [lastDoc, setLastDoc] = useState(null);
const [hasMore, setHasMore] = useState(true);
const [activeReel, setActiveReel] = useState(null);
const [commentsModalReel, setCommentsModalReel] = useState(null);
const containerRef = useRef(null);
const preloadedVideos = useRef({});

useEffect(() => {
const q = query(
collection(db, "reels"),
orderBy("createdAt", "desc"),
limit(initialQueryLimit)
);
const unsubscribe = onSnapshot(q, (snapshot) => {
const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
// Cache feed pages to reduce Firestore reads (Pillar 6 — Caching)
CacheManager.set(`feed_page_${initialQueryLimit}`, data, 300); // 5 min TTL
setReels(data);
setLastDoc(snapshot.docs[snapshot.docs.length - 1] || null);
preloadNextVideos(data);
});
return unsubscribe;
}, [initialQueryLimit]);

const preloadNextVideos = (videos) => {
// Disabled to prevent unbounded video element leaks; rely on browser preload and lazy loading
// videos.forEach((reel) => {
//   if (!preloadedVideos.current[reel.id]) {
//     const video = document.createElement("video");
//     video.src = reel.videoURL;
//     video.preload = "auto";
//     preloadedVideos.current[reel.id] = video;
//   }
// });
};

const loadMoreReels = useCallback(async () => {
if (!hasMore || !lastDoc) return;
const q = query(
collection(db, "reels"),
orderBy("createdAt", "desc"),
startAfter(lastDoc),
limit(FEED_PAGE_SIZE)
);
const snapshot = await getDocs(q);
if (snapshot.empty) return setHasMore(false);
const newReels = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
setReels((prev) => [...prev, ...newReels]);
setLastDoc(snapshot.docs[snapshot.docs.length - 1] || null);
preloadNextVideos(newReels);
}, [lastDoc, hasMore]);

const handleIntersection = (reelId, isVisible) => {
setActiveReel(isVisible ? reelId : null);
if (isVisible && user) {
  void awardCoins(user.uid, 0.1, "reel_watch", { reelId });
}
};

const handleReaction = async (reelId, emoji) => {
if (!user) return;
const reel = reels.find((r) => r.id === reelId);
const existing = reel.reactions?.find((r) => r.userId === user.uid && r.emoji === emoji);
try {
const reelRef = doc(db, "reels", reelId);
if (existing) await updateDoc(reelRef, { reactions: arrayRemove(existing) });
else {
await updateDoc(reelRef, { reactions: arrayUnion({ emoji, userId: user.uid }) });
await awardCoins(user.uid, 1, "reel_reaction", { reelId, emoji });
}
} catch (err) {
console.error(err);
toast.error("Failed to update reaction.");
}
};

const handleFollow = async (uid) => {
if (!user) return;
try {
const { getUserService } = await import("../../services/userService.js");
await getUserService().followUser(user.uid, uid);
toast.success("Followed successfully!");
} catch {
toast.error("Failed to follow user");
}
};

const openComments = (reel) => setCommentsModalReel(reel);
const closeComments = () => setCommentsModalReel(null);

const handleScroll = () => {
if (!containerRef.current) return;
const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
if (scrollTop + clientHeight >= scrollHeight - 50) loadMoreReels();
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
    // Release the blob URL after the browser starts the download
    setTimeout(() => window.URL.revokeObjectURL(objectUrl), 1000);
    toast.success("Download started!");
  } catch (err) {
    console.error(err);
    toast.error("Failed to download");
  }
};

return (
<div  
ref={containerRef}  
className="h-screen w-full overflow-y-auto snap-y snap-mandatory bg-black"  
onScroll={handleScroll}  
>
{reels.map((reel, idx) => (
<ReelItem
key={reel.id}
reel={reel}
isActive={activeReel === reel.id}
onVisible={handleIntersection}
onReaction={handleReaction}
onComment={() => openComments(reel)}
onDownload={() => handleDownload(reel.videoURL, `${reel.id}.mp4`)}
onFollow={() => handleFollow(reel.userId)}
theme={theme}
user={user}
preloadedNext={reels[idx + 1]}
/>
))}

{commentsModalReel && <CommentsModal postId={commentsModalReel.id} onClose={closeComments} />}  

  <div className="h-32 w-full flex items-center justify-center bg-gray-200 dark:bg-gray-800 text-gray-600 dark:text-gray-300">  
    Sponsored Ad  
  </div>  
</div>

);
}

function ReelItem({ reel, isActive, onVisible, onReaction, onComment, onDownload, onFollow, theme, user, preloadedNext }) {
const videoRef = useRef(null);
const entry = useIntersectionObserver(videoRef, { threshold: 0.75 });
const [showLikeAnim, setShowLikeAnim] = useState(false);

useEffect(() => {
const visible = !!entry?.isIntersecting;
onVisible(reel.id, visible);
if (videoRef.current) {
visible ? videoRef.current.play().catch(() => {}) : videoRef.current.pause();
}
}, [entry, reel.id, onVisible]);

const liked = reel.likes?.some((l) => l.userId === user?.uid);

const handleDoubleTap = async () => {
if (!user) return;
setShowLikeAnim(true);
setTimeout(() => setShowLikeAnim(false), 800);
await onReaction(reel.id, "❤️");
};

useEffect(() => {
// Preload is handled by video preload="auto"; avoiding manual DOM injection to prevent memory leaks
if (preloadedNext) {
// Optional: preload via hidden video element with cleanup
const video = document.createElement("video");
video.src = preloadedNext.videoURL;
video.preload = "auto";
video.style.display = "none";
document.body.appendChild(video);
return () => { try { document.body.removeChild(video); } catch (e) {} };
}
}, [preloadedNext]);

return (
<div className="relative w-full h-screen snap-start">
<video
ref={videoRef}
src={reel.videoURL}
className="w-full h-full object-cover"
loop
muted
playsInline
preload="auto"
onDoubleClick={handleDoubleTap}
aria-label={`Reel by ${reel.displayName}`}
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
    <button onClick={() => onReaction(reel.id, "❤️")} className="flex flex-col items-center">  
      <Heart className={`w-8 h-8 ${liked ? "text-red-500 animate-pulse" : ""}`} />  
      <span className="text-sm">{reel.likes?.length || 0}</span>  
    </button>  
    {REACTIONS.map((r) => (  
      <button key={r} onClick={() => onReaction(reel.id, r)} className="flex flex-col items-center">  
        <span className="text-xl">{r}</span>  
        <span className="text-sm">{reel.reactions?.filter((x) => x.emoji === r).length || 0}</span>  
      </button>  
    ))}  
    <button onClick={onComment} className="flex flex-col items-center">  
      <MessageCircle className="w-8 h-8" />  
      <span className="text-sm">{reel.commentsCount || 0}</span>  
    </button>  
    <button onClick={onDownload} className="flex flex-col items-center">  
      <Download className="w-8 h-8" />  
      <span className="text-sm">Save</span>  
    </button>  
    <button onClick={() => navigator.share?.({ url: reel.videoURL })} className="flex flex-col items-center">  
      <Share2 className="w-8 h-8" />  
    </button>  
    {user?.uid !== reel.userId && (  
      <button onClick={onFollow} className="flex flex-col items-center">  
        <UserPlus className="w-8 h-8" />  
        <span className="text-sm">Follow</span>  
      </button>  
    )}  
  </div>  

  <div className="absolute bottom-8 left-4 text-white max-w-[80%]">  
    <div className="flex items-center gap-2">  
      <img  
        src={reel.userPhotoURL || "/assets/default-profile.png"}  
        alt={reel.displayName || "Reel video"}  
        className="w-10 h-10 rounded-full border-2 border-white"  
      />  
      <span className="font-semibold flex items-center gap-1">  
        {reel.displayName}  
        {reel.verified && <Verified className="w-4 h-4 text-blue-500" />}  
      </span>  
    </div>  
    <p className="text-sm mt-1">{reel.caption}</p>  
    <p className="text-xs text-gray-300">{dayjs(reel.createdAt?.seconds * 1000).fromNow()}</p>  
  </div>  
</div>

);
}

ReelsFeed.propTypes = { initialQueryLimit: PropTypes.number };
ReelItem.propTypes = {
reel: PropTypes.object.isRequired,
isActive: PropTypes.bool,
onVisible: PropTypes.func.isRequired,
onReaction: PropTypes.func.isRequired,
onComment: PropTypes.func.isRequired,
onDownload: PropTypes.func.isRequired,
onFollow: PropTypes.func,
theme: PropTypes.string,
user: PropTypes.object,
preloadedNext: PropTypes.object,
};