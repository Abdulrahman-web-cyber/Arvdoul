// src/components/Home/PostCard.jsx
import PropTypes from "prop-types";
import { useState, useRef, useCallback, useEffect } from "react";
import { motion } from "framer-motion";
import {
Heart,
MessageCircle,
Share2,
Bookmark,
MoreVertical,
} from "lucide-react";
import { cn } from "../../lib/utils";
import useLongPress from "../../hooks/useLongPress.js";
import useDoubleTap from "../../hooks/useDoubleTap";
import SwipableMedia from "./SwipableMedia";
import BottomMenu from "./BottomMenu";
import { useAuth } from "../../context/AuthContext";
import { doc, updateDoc, arrayUnion, increment, onSnapshot } from "firebase/firestore";
import { db } from "../../firebase/firebase.js";
import CommentsModal from "./CommentsModal"; // <- New modal component

// Advanced reaction emojis
const REACTIONS = ["❤️", "😂", "😮", "😢", "😡"];

export default function PostCard({ post }) {
const { user, addCoins } = useAuth();
const [liked, setLiked] = useState(post.likedBy?.includes(user?.uid) || false);
const [likesCount, setLikesCount] = useState(post.likesCount || 0);
const [showMenu, setShowMenu] = useState(false);
const [showReactions, setShowReactions] = useState(false);
const [commentsPreview, setCommentsPreview] = useState(post.comments?.slice(0, 3) || []);
const [showCommentsModal, setShowCommentsModal] = useState(false);

const containerRef = useRef(null);
const likeCooldown = useRef(false); // prevent coin spam

// ---------------- Live Updates ----------------
useEffect(() => {
const postRef = doc(db, "posts", post.id);
const unsubscribe = onSnapshot(postRef, (docSnap) => {
if (docSnap.exists()) {
const data = docSnap.data();
setLikesCount(data.likesCount || 0);
setCommentsPreview(data.comments?.slice(0, 3) || []);
}
});
return unsubscribe;
}, [post.id]);

// ---------------- Double Tap / Like ----------------
const onDoubleTap = useCallback(async () => {
if (!user || liked) return;

try {  
  setLiked(true);  
  setLikesCount((prev) => prev + 1); // Optimistic UI  

  const postRef = doc(db, "posts", post.id);  
  await updateDoc(postRef, {  
    likedBy: arrayUnion(user.uid),  
    likesCount: increment(1),  
  });  

  if (!likeCooldown.current) {  
    likeCooldown.current = true;  
    await addCoins(1, "like post");  
    setTimeout(() => { likeCooldown.current = false; }, 3000); // 3s cooldown  
  }  
} catch (err) {  
  console.error("Error liking post:", err);  
}

}, [user, liked, post.id, addCoins]);

// ---------------- Long Press ----------------
const onLongPress = () => setShowMenu(true);
const longPress = useLongPress(onLongPress, 600);
const doubleTap = useDoubleTap(onDoubleTap);

// ---------------- Emoji Reactions ----------------
const handleReaction = async (emoji) => {
try {
const postRef = doc(db, "posts", post.id);
await updateDoc(postRef, {
reactions: arrayUnion({ emoji, userId: user.uid }),
});
setShowReactions(false);
await addCoins(1, `react ${emoji});
} catch (err) {
console.error("Error reacting:", err);
}
};

// ---------------- Comments ----------------
const handleViewAllComments = () => setShowCommentsModal(true);

// ---------------- Share ----------------
const handleShare = () => {
const postUrl =`${window.location.origin}/post/${post.id};
if (navigator.share) {
navigator.share({
title: post.displayName,
text: post.caption,
url: postUrl,
});
} else {
navigator.clipboard.writeText(postUrl);
alert("Post link copied!");
}
};

return (
<>
<motion.div
ref={containerRef}
{...longPress}
{...doubleTap}
layout
className="bg-background border dark:border-gray-700 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow"
>
{/* Header */}
<div className="flex items-center justify-between px-4 py-3">
<div className="flex items-center gap-3">
<img
src={post.userPhotoURL || "/assets/default-profile.png"}
alt={${post.displayName} avatar}
className="w-10 h-10 rounded-full object-cover"
/>
<span className="font-semibold text-sm">{post.displayName}</span>
</div>
<button onClick={() => setShowMenu(true)} aria-label="Open post menu">
<MoreVertical className="w-5 h-5 text-muted-foreground cursor-pointer" />
</button>
</div>

{/* Media */}  
    {post.media?.length > 0 && <SwipableMedia media={post.media} />}  

    {/* Actions */}  
    <div className="px-4 py-2 flex items-center justify-between relative">  
      <div className="flex items-center gap-4">  
        <div className="flex items-center gap-1 relative">  
          <motion.div whileTap={{ scale: 1.2 }} onClick={onDoubleTap}>  
            <Heart  
              className={cn(  
                "w-6 h-6 cursor-pointer transition-all",  
                liked ? "text-red-500 fill-red-500" : "text-muted-foreground"  
              )}  
              aria-label={liked ? "Unlike post" : "Like post"}  
            />  
          </motion.div>  
          <span className="text-sm">{likesCount}</span>  

          {/* Reactions Popup */}  
          {showReactions && (  
            <motion.div  
              initial={{ opacity: 0, y: -10 }}  
              animate={{ opacity: 1, y: 0 }}  
              exit={{ opacity: 0, y: -10 }}  
              className="absolute -top-12 left-0 flex gap-2 bg-white dark:bg-gray-800 p-2 rounded-full shadow-lg z-50"  
            >  
              {REACTIONS.map((r) => (  
                <motion.span  
                  key={r}  
                  className="cursor-pointer text-xl"  
                  whileTap={{ scale: 1.3 }}  
                  onClick={() => handleReaction(r)}  
                >  
                  {r}  
                </motion.span>  
              ))}  
            </motion.div>  
          )}  
        </div>  

        <div className="flex items-center gap-1">  
          <MessageCircle  
            className="w-6 h-6 text-muted-foreground cursor-pointer"  
            aria-label="Comment on post"  
            onClick={handleViewAllComments}  
          />  
          <span className="text-sm">{post.commentsCount || 0}</span>  
        </div>  

        <Share2  
          className="w-6 h-6 text-muted-foreground cursor-pointer"  
          aria-label="Share post"  
          onClick={handleShare}  
        />  
      </div>  

      <Bookmark  
        className="w-6 h-6 text-muted-foreground cursor-pointer"  
        aria-label="Bookmark post"  
      />  
    </div>  

    {/* Caption */}  
    {post.caption && (  
      <div className="px-4 pb-2 text-sm text-foreground">  
        <span className="font-medium mr-1">{post.displayName}</span>  
        {post.caption}  
      </div>  
    )}  

    {/* Comments Preview */}  
    {commentsPreview.length > 0 && (  
      <div className="px-4 pb-4 text-sm text-muted-foreground">  
        {commentsPreview.map((c, idx) => (  
          <div key={idx}>  
            <span className="font-medium mr-1">{c.displayName}</span>  
            {c.text}  
          </div>  
        ))}  
        {post.commentsCount > 3 && (  
          <button  
            onClick={handleViewAllComments}  
            className="text-blue-500 text-sm mt-1"  
          >  
            View all {post.commentsCount} comments  
          </button>  
        )}  
      </div>  
    )}  

    {/* Bottom Menu */}  
    <BottomMenu open={showMenu} setOpen={setShowMenu} post={post} />  
  </motion.div>  

  {/* ---------------- Comments Modal ---------------- */}  
  {showCommentsModal && (  
    <CommentsModal postId={post.id} onClose={() => setShowCommentsModal(false)} />  
  )}  
</>

);
}

PostCard.propTypes = {
post: PropTypes.shape({
id: PropTypes.string.isRequired,
displayName: PropTypes.string.isRequired,
userPhotoURL: PropTypes.string,
caption: PropTypes.string,
media: PropTypes.arrayOf(
PropTypes.shape({
url: PropTypes.string,
type: PropTypes.string, // "image" | "video"
})
),
likedBy: PropTypes.arrayOf(PropTypes.string),
likesCount: PropTypes.number,
commentsCount: PropTypes.number,
comments: PropTypes.arrayOf(
PropTypes.shape({
displayName: PropTypes.string,
text: PropTypes.string,
})
),
}).isRequired,
};