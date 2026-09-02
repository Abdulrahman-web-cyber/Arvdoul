// src/components/Home/CommentsModal.jsx
import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { X, Send, Edit2, Trash2, MessageCircle } from "lucide-react";
import { getCommentService } from "../../services/commentService.js";
import { useAuth } from "../../context/AuthContext";
import { useTheme } from "../../context/ThemeContext";
import { toast } from "sonner";
import PropTypes from "prop-types";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import { getSafeAvatarUrl } from "../../utils/avatarUtils";

dayjs.extend(relativeTime);

const REACTIONS = ["❤️", "😂", "😮", "😢", "😡"];
const COMMENTS_PAGE_SIZE = 5;

/** Maps commentService documents to the modal's display shape. */
const normalizeComment = (c) => ({
  id: c.id,
  userId: c.userId,
  text: c.content || c.text || "",
  displayName: c.userName || c.displayName || "User",
  userPhotoURL: getSafeAvatarUrl(c.userAvatar || c.userPhotoURL, c.userName || c.displayName || "User", c.userId),
  createdAt: c.createdAt,
  likes: c.likes || 0,
  likesBy: c.likesBy || [],
  // Map service likes to the emoji reaction count for the ❤️ row
  reactions: (c.reactions || []).map((r) => (typeof r === "string" ? { emoji: r, userId: c.userId } : r)),
  replies: Array.isArray(c.replies) ? c.replies.map(normalizeComment) : [],
});

export default function CommentsModal({ postId, onClose }) {
const { user } = useAuth();

// REAL engagement rewards through the monetization ledger (server-capped).
const awardCoins = async (uid, amount, reason, metadata = {}) => {
  try {
    const { getMonetizationService } = await import("../../services/monetizationService.js");
    await getMonetizationService().addCoins(uid, amount, reason, metadata);
  } catch (err) {
    console.warn("Coin reward skipped:", err.message);
  }
};
const { theme } = useTheme();

const [comments, setComments] = useState([]);
const [newComment, setNewComment] = useState("");
const [posting, setPosting] = useState(false);
const [lastDoc, setLastDoc] = useState(null);
const [hasMore, setHasMore] = useState(true);
const [editingCommentId, setEditingCommentId] = useState(null);
const [typingUsers, setTypingUsers] = useState([]);
const commentsEndRef = useRef(null);
const containerRef = useRef(null);

// ---------------- Real-time initial comments ----------------
useEffect(() => {
  let cancelled = false;
  let unsubscribe = () => {};

  const load = async () => {
    try {
      const svc = getCommentService();
      const res = await svc.getCommentsByPost(postId, { nested: true, limit: 50, cacheFirst: false });
      if (cancelled) return;
      if (res.success) {
        setComments((res.comments || []).map(normalizeComment));
        setHasMore(false);
        scrollToBottom();
      }
      unsubscribe = svc.subscribeToPostComments(postId, () => {
        svc.getCommentsByPost(postId, { nested: true, limit: 50, cacheFirst: false }).then((r) => {
          if (!cancelled && r.success) setComments((r.comments || []).map(normalizeComment));
        });
      }, { includeReplies: true });
    } catch {
      if (!cancelled) setComments([]);
    }
  };
  load();

  return () => {
    cancelled = true;
    try {
      unsubscribe();
    } catch { /* noop */ }
  };
}, [postId]);

const scrollToBottom = () => {
setTimeout(() => commentsEndRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
};

// ---------------- Post a new comment ----------------
const handlePostComment = async () => {
if (!newComment.trim() || !user) return;
setPosting(true);

const tempId = "temp-" + Date.now();  
const optimisticComment = {  
  id: tempId,  
  text: newComment.trim(),  
  displayName: user.displayName || "Unknown",  
  userPhotoURL: getSafeAvatarUrl(user.photoURL, user.displayName || "Unknown", user.uid),  
  userId: user.uid,  
  createdAt: { seconds: Date.now() / 1000 },  
  reactions: [],  
  replies: [],  
};  

setComments((prev) => [...prev, optimisticComment]);  
setNewComment("");  
scrollToBottom();  

try {
  const svc = getCommentService();
  await svc.createComment(postId, user.uid, optimisticComment.text, {
    userName: user.displayName || "You",
    userUsername: user.username || user.displayName || "you",
    userAvatar: getSafeAvatarUrl(user.photoURL, user.displayName || "You", user.uid),
  });
  // The realtime subscription refreshes the list; drop the optimistic copy.
  setComments((prev) => prev.filter((c) => c.id !== tempId));
  await awardCoins(user.uid, 1, "comment", { postId });
} catch (err) {  
  console.error(err);  
  toast.error("Failed to post comment.");  
  setComments((prev) => prev.filter((c) => c.id !== tempId));  
} finally {  
  setPosting(false);  
}

};

const handleKeyPress = (e) => {
if (e.key === "Enter" && !e.shiftKey) {
e.preventDefault();
handlePostComment();
}
};

// ---------------- Reactions (toggle + counts) ----------------
const handleReaction = async (commentId, emoji) => {
  const comment = comments.find((c) => c.id === commentId);
  if (!comment || !user) return;
  const existing = comment.likesBy?.includes(user.uid) || comment.reactions?.some((r) => r.userId === user.uid);

  try {
    const svc = getCommentService();
    if (existing) {
      await svc.removeLikeDislike(commentId, user.uid);
    } else {
      await svc.likeComment(commentId, user.uid);
      await awardCoins(user.uid, 1, "like", { commentId, emoji });
    }
    // Optimistic UI toggle so the heart responds instantly
    setComments((prev) =>
      prev.map((c) =>
        c.id === commentId
          ? {
              ...c,
              likes: Math.max(0, (c.likes || 0) + (existing ? -1 : 1)),
              likesBy: existing
                ? (c.likesBy || []).filter((id) => id !== user.uid)
                : [...(c.likesBy || []), user.uid],
            }
          : c
      )
    );
  } catch (err) {
    console.error(err);
  }
};

// ---------------- Delete Comment ----------------
const handleDelete = async (commentId) => {
  if (!window.confirm("Delete this comment?")) return;
  try {
    await getCommentService().deleteComment(commentId, user.uid, false);
    setComments((prev) => prev.filter((c) => c.id !== commentId));
  } catch (err) {
    console.error(err);
    toast.error("Failed to delete comment.");
  }
};

// ---------------- Edit Comment (inline) ----------------
const handleEdit = async (commentId, newText) => {
  if (!newText.trim()) return;
  try {
    await getCommentService().updateComment(commentId, user.uid, { content: newText });
    setComments((prev) => prev.map((c) => (c.id === commentId ? { ...c, content: newText, isEdited: true } : c)));
    setEditingCommentId(null);
  } catch (err) {
    console.error(err);
    toast.error("Failed to edit comment.");
  }
};


return createPortal(
<AnimatePresence>
<motion.div
className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm"
initial={{ opacity: 0 }}
animate={{ opacity: 1 }}
exit={{ opacity: 0 }}
onClick={onClose}
>
<motion.div
ref={containerRef}
className={`w-full max-w-md mx-2 rounded-t-xl overflow-y-auto max-h-[80vh] ${   theme === "dark" ? "bg-gray-900 text-white" : "bg-white text-gray-900"   }`}
initial={{ y: "100%" }}
animate={{ y: 0 }}
exit={{ y: "100%" }}
onClick={(e) => e.stopPropagation()}
>
{/* Header */}
<div className="flex items-center justify-between px-4 py-3 border-b dark:border-gray-700 sticky top-0 bg-inherit z-10">
<span className="font-semibold text-lg">Comments</span>
<button  
onClick={onClose}  
className="p-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-800"  
>
<X size={20} />
</button>
</div>

{/* Comments List */}  
      <div className="px-4 py-2 space-y-3">  
        {comments.length === 0 && (  
          <p className="text-sm text-muted-foreground text-center">No comments yet.</p>  
        )}  

        {comments.map((c) => (  
          <motion.div key={c.id} layout className="flex flex-col gap-1" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>  
            <div className="flex gap-3 items-start">  
              <img src={c.userPhotoURL || "/assets/default-profile.png"} alt={c.displayName || "User"} className="w-8 h-8 rounded-full object-cover" />  
              <div className="flex-1">  
                {editingCommentId === c.id ? (  
                  <div className="flex gap-2">  
                    <input  
                      type="text"  
                      className={`flex-1 px-2 py-1 rounded-border ${  
                        theme === "dark" ? "bg-gray-800 border-gray-700 text-white" : "bg-gray-100 border-gray-300"  
                      }`}  
                      defaultValue={c.text}  
                      onKeyDown={(e) => {  
                        if (e.key === "Enter") handleEdit(c.id, e.target.value);  
                      }}  
                    />  
                    <button onClick={() => handleEdit(c.id, c.text)} className="px-2 py-1 bg-primary-600 text-white rounded">Save</button>  
                  </div>  
                ) : (  
                  <p className="text-sm">  
                    <span className="font-medium mr-1">{c.displayName}</span>  
                    {c.text}  
                  </p>  
                )}  
                <div className="flex gap-2 mt-1 items-center">  
                  {REACTIONS.map((r) => {  
                    const count = r === "❤️" ? (c.likes || 0) : 0;
                    const reacted = r === "❤️" ? (c.likesBy || []).includes(user?.uid) : false;
                    return (  
                      <span  
                        key={r}  
                        className={`cursor-pointer text-xs ${reacted ? "font-bold" : ""}`}  
                        onClick={() => handleReaction(c.id, r)}  
                      >  
                        {r} {count > 0 && count}  
                      </span>  
                    );  
                  })}  
                  {c.createdAt?.seconds && (  
                    <span className="text-xs text-muted-foreground ml-2">{dayjs.unix(c.createdAt.seconds).fromNow()}</span>  
                  )}  
                </div>  
              </div>  
              {c.userId === user?.uid && editingCommentId !== c.id && (  
                <div className="flex flex-col gap-1 ml-2 text-gray-400">  
                  <Edit2 size={14} className="cursor-pointer" onClick={() => setEditingCommentId(c.id)} />  
                  <Trash2 size={14} className="cursor-pointer" onClick={() => handleDelete(c.id)} />  
                </div>  
              )}  
            </div>  

            {/* Nested replies */}  
            {c.replies && c.replies.length > 0 && (  
              <div className="ml-10 mt-1 space-y-1 border-l border-gray-300 pl-2 dark:border-gray-700">  
                {c.replies.map((r) => (  
                  <div key={r.id} className="flex gap-2 items-start text-sm">  
                    <img src={r.userPhotoURL || "/assets/default-profile.png"} alt={r.displayName || "User"} className="w-6 h-6 rounded-full object-cover" />  
                    <p>  
                      <span className="font-medium mr-1">{r.displayName}</span>  
                      {r.text}{" "}  
                      <span className="text-xs text-muted-foreground">  
                        {r.createdAt?.seconds && dayjs.unix(r.createdAt.seconds).fromNow()}  
                      </span>  
                    </p>  
                  </div>  
                ))}  
              </div>  
            )}  
          </motion.div>  
        ))}  
        <div ref={commentsEndRef} />  
      </div>  

      {/* Input */}  
      <div className="flex items-center gap-2 px-4 py-3 border-t dark:border-gray-700 sticky bottom-0 bg-inherit">  
        <input  
          type="text"  
          placeholder="Write a comment..."  
          className={`flex-1 px-3 py-2 rounded-full border ${  
            theme === "dark"  
              ? "bg-gray-800 border-gray-700 text-white"  
              : "bg-gray-100 border-gray-300"  
          } focus:outline-none focus:ring-1 focus:ring-primary-500`}  
          value={newComment}  
          onChange={(e) => setNewComment(e.target.value)}  
          onKeyDown={handleKeyPress}  
          disabled={posting}  
        />  
        <button  
          onClick={handlePostComment}  
          disabled={posting || !newComment.trim()}  
          className={`p-2 rounded-full ${  
            posting || !newComment.trim()  
              ? "bg-gray-400 cursor-not-allowed"  
              : "bg-primary-600 text-white hover:bg-primary-700"  
          }`}  
        >  
          <Send size={18} />  
        </button>  
      </div>  
    </motion.div>  
  </motion.div>  
</AnimatePresence>,  
document.body
);
}

CommentsModal.propTypes = {
postId: PropTypes.string.isRequired,
onClose: PropTypes.func.isRequired,
};