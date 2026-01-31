\/\/ src/components/Home/CommentsModal.jsx
import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { X, Send, Edit2, Trash2, MessageCircle } from "lucide-react";
import { db } from "../../firebase/firebase";
import {
collection,
query,
orderBy,
startAfter,
limit,
onSnapshot,
getDocs,
addDoc,
serverTimestamp,
updateDoc,
deleteDoc,
arrayUnion,
arrayRemove,
doc,
} from "firebase/firestore";
import { useAuth } from "../../context/AuthContext";
import { useTheme } from "../../context/ThemeContext";
import { toast } from "sonner";
import PropTypes from "prop-types";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";

dayjs.extend(relativeTime);

const REACTIONS = ["❤️", "😂", "😮", "😢", "😡"];
const COMMENTS_PAGE_SIZE = 5;

export default function CommentsModal({ postId, onClose }) {
const { user, addCoins } = useAuth();
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

\/\/ ---------------- Real-time initial comments ----------------
useEffect(() => {
const q = query(
collection(db, "posts", postId, "comments"),
orderBy("createdAt", "asc"),
limit(COMMENTS_PAGE_SIZE)
);

const unsubscribe = onSnapshot(q, (snapshot) => {  
  const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));  
  setComments(data);  
  setLastDoc(snapshot.docs[snapshot.docs.length - 1] || null);  
  setHasMore(snapshot.docs.length >= COMMENTS_PAGE_SIZE);  
  scrollToBottom();  
});  

return unsubscribe;

}, [postId]);

const scrollToBottom = () => {
setTimeout(() => commentsEndRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
};

\/\/ ---------------- Post a new comment ----------------
const handlePostComment = async () => {
if (!newComment.trim() || !user) return;
setPosting(true);

const tempId = "temp-" + Date.now();  
const optimisticComment = {  
  id: tempId,  
  text: newComment.trim(),  
  displayName: user.displayName || "Unknown",  
  userPhotoURL: user.photoURL || "/assets/default-profile.png",  
  userId: user.uid,  
  createdAt: { seconds: Date.now() / 1000 },  
  reactions: [],  
  replies: [],  
};  

setComments((prev) => [...prev, optimisticComment]);  
setNewComment("");  
scrollToBottom();  

try {  
  const docRef = await addDoc(collection(db, "posts", postId, "comments"), {  
    text: optimisticComment.text,  
    displayName: optimisticComment.displayName,  
    userPhotoURL: optimisticComment.userPhotoURL,  
    userId: user.uid,  
    createdAt: serverTimestamp(),  
    reactions: [],  
    replies: [],  
  });  
  setComments((prev) =>  
    prev.map((c) => (c.id === tempId ? { ...c, id: docRef.id } : c))  
  );  
  await addCoins(1, "comment");  
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

\/\/ ---------------- Reactions (toggle + counts) ----------------
const handleReaction = async (commentId, emoji) => {
const comment = comments.find((c) => c.id === commentId);
const existing = comment.reactions?.find((r) => r.userId === user.uid && r.emoji === emoji);

try {  
  const commentRef = doc(db, "posts", postId, "comments", commentId);  
  if (existing) {  
    await updateDoc(commentRef, { reactions: arrayRemove(existing) });  
  } else {  
    await updateDoc(commentRef, { reactions: arrayUnion({ emoji, userId: user.uid }) });  
    await addCoins(1, `react ${emoji}`);  
  }  
} catch (err) {  
  console.error(err);  
}

};

\/\/ ---------------- Delete Comment ----------------
const handleDelete = async (commentId) => {
if (!confirm("Delete this comment?")) return;
try {
await deleteDoc(doc(db, "posts", postId, "comments", commentId));
} catch (err) {
console.error(err);
toast.error("Failed to delete comment.");
}
};

\/\/ ---------------- Edit Comment (inline) ----------------
const handleEdit = async (commentId, newText) => {
if (!newText.trim()) return;
try {
const commentRef = doc(db, "posts", postId, "comments", commentId);
await updateDoc(commentRef, { text: newText });
setEditingCommentId(null);
} catch (err) {
console.error(err);
toast.error("Failed to edit comment.");
}
};

\/\/ ---------------- Load More Comments ----------------
const loadMoreComments = useCallback(async () => {
if (!hasMore || !lastDoc) return;

const q = query(  
  collection(db, "posts", postId, "comments"),  
  orderBy("createdAt", "asc"),  
  startAfter(lastDoc),  
  limit(COMMENTS_PAGE_SIZE)  
);  

const snapshot = await getDocs(q);  
if (snapshot.empty) return setHasMore(false);  

const newComments = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));  
setComments((prev) => [...prev, ...newComments]);  
setLastDoc(snapshot.docs[snapshot.docs.length - 1] || null);  
setHasMore(snapshot.docs.length >= COMMENTS_PAGE_SIZE);

}, [postId, hasMore, lastDoc]);

\/\/ ---------------- Infinite scroll ----------------
const handleScroll = () => {
if (!containerRef.current) return;
const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
if (scrollTop + clientHeight >= scrollHeight - 50) {
loadMoreComments();
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
onScroll={handleScroll}
className={`w-full max-w-md mx-2 rounded-t-xl overflow-y-auto max-h-[80vh] ${   theme === "dark" ? "bg-gray-900 text-white" : "bg-white text-gray-900"   }}
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
              <img src={c.userPhotoURL || "/assets/default-profile.png"} alt={c.displayName} className="w-8 h-8 rounded-full object-cover" />  
              <div className="flex-1">  
                {editingCommentId === c.id ? (  
                  <div className="flex gap-2">  
                    <input  
                      type="text"  
                      className={`flex-1 px-2 py-1 rounded border ${  
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
                    const count = c.reactions?.filter((x) => x.emoji === r).length || 0;  
                    const reacted = c.reactions?.some((x) => x.emoji === r && x.userId === user.uid);  
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
                    <img src={r.userPhotoURL || "/assets/default-profile.png"} alt={r.displayName} className="w-6 h-6 rounded-full object-cover" />  
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