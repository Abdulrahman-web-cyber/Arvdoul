// src/components/Videos/CommentsDrawer.jsx
import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { doc, collection, query, orderBy, onSnapshot, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../../firebase/firebase";
import { useAuth } from "../../context/AuthContext";
import { X } from "lucide-react";
import { toast } from "sonner";

export default function CommentsDrawer({ postId, onClose }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(Boolean(postId));
  const [comments, setComments] = useState([]);
  const [text, setText] = useState("");
  useEffect(() => setOpen(Boolean(postId)), [postId]);

  useEffect(() => {
    if (!postId) return;
    const col = collection(doc(db, "posts", postId), "comments");
    const q = query(col, orderBy("createdAt", "asc"));
    const unsub = onSnapshot(q, (snap) => {
      setComments(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, [postId]);

  const submit = async (e) => {
    e?.preventDefault?.();
    if (!text.trim()) return;
    if (!user) return toast("Please login to comment");
    try {
      const col = collection(doc(db, "posts", postId), "comments");
      await addDoc(col, { authorId: user.uid, authorName: user.displayName || user.email, text: text.trim(), createdAt: serverTimestamp() });
      setText("");
    } catch (e) {
      console.error("comment failed", e);
      toast.error("Could not post comment");
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[60] bg-black/40">
          <motion.aside initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", damping: 20 }} className="fixed bottom-0 left-0 right-0 h-3/5 bg-white dark:bg-gray-900 rounded-t-2xl p-4 overflow-y-auto">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold">Comments</h3>
              <button onClick={() => { setOpen(false); onClose?.(); }} className="p-2 rounded-full"><X/></button>
            </div>

            <div className="space-y-3">
              {comments.length === 0 ? <div className="text-sm text-muted-foreground">No comments yet. Be the first!</div> : comments.map(c => (
                <div key={c.id} className="border-b pb-2">
                  <div className="text-sm font-semibold">{c.authorName || "User"}</div>
                  <div className="text-sm">{c.text}</div>
                </div>
              ))}
            </div>

            <form onSubmit={submit} className="mt-4 sticky bottom-0 bg-transparent pt-4">
              <div className="flex gap-2">
                <input value={text} onChange={(e) => setText(e.target.value)} className="flex-1 px-4 py-2 rounded-xl border bg-transparent" placeholder={`user ? "Add a comment..." : "Log in to comment"`} />
                <button type="submit" className="px-4 py-2 bg-primary-600 text-white rounded-xl">Send</button>
              </div>
            </form>
          </motion.aside>
        </motion.div>
      )}
    </AnimatePresence>
  );
}