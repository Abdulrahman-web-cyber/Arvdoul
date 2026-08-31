// src/components/Videos/CommentsDrawer.jsx
/**
 * ARVDOUL COMMENTS DRAWER — REAL comment system with replies
 *
 * Rebuilt on the real commentService (flat `comments` collection) with:
 *  - moderation, rate limits, spam checks, edit history, notifications,
 *    comment_created XP (all handled by the service)
 *  - threading: reply to any comment (depth-limited by the service)
 *  - realtime subscription via subscribeToPostComments
 *  - The previous version wrote raw docs to `posts/{id}/comments` with a
 *    random doc id - which the security rules DENY (docId must be the uid)
 *    and bypassed every moderation/notification/XP path.
 */

import React, { useEffect, useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "../../context/AuthContext";
import { getCommentService } from "../../services/commentService.js";
import { X, Send, CornerUpLeft } from "lucide-react";
import { toast } from "sonner";
import { cn } from "../../lib/utils";


export default function CommentsDrawer({ postId, onClose }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(Boolean(postId));
  const [comments, setComments] = useState([]);
  const [text, setText] = useState("");
  const [replyingTo, setReplyingTo] = useState(null);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => setOpen(Boolean(postId)), [postId]);

  // Realtime comments via the real service
  useEffect(() => {
    if (!postId) return undefined;
    let cancelled = false;
    let unsubscribe = () => {};

    const load = async () => {
      setLoading(true);
      try {
        const svc = getCommentService();
        const res = await svc.getCommentsByPost(postId, { nested: true, limit: 60, cacheFirst: false });
        if (!cancelled && res.success) setComments(res.comments || []);
        unsubscribe = svc.subscribeToPostComments(
          postId,
          () => {
            svc.getCommentsByPost(postId, { nested: true, limit: 60, cacheFirst: false }).then((r) => {
              if (!cancelled && r.success) setComments(r.comments || []);
            });
          },
          { includeReplies: true }
        );
      } catch {
        if (!cancelled) setComments([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();

    return () => {
      cancelled = true;
      try {
        unsubscribe();
      } catch {
        /* noop */
      }
    };
  }, [postId]);

  const submit = useCallback(
    async (e) => {
      e?.preventDefault?.();
      if (!text.trim()) return;
      if (!user) {
        toast("Please login to comment");
        return;
      }
      try {
        const svc = getCommentService();
        if (replyingTo) {
          await svc.replyToComment(replyingTo.id, user.uid, text.trim(), {
            userName: user.displayName || "You",
            userUsername: user.username || user.displayName || "you",
            userAvatar: user.photoURL || null,
          });
          toast.success("Reply posted!");
        } else {
          await svc.createComment(postId, user.uid, text.trim(), {
            userName: user.displayName || "You",
            userUsername: user.username || user.displayName || "you",
            userAvatar: user.photoURL || null,
          });
          toast.success("Comment posted!");
        }
        setText("");
        setReplyingTo(null);
      } catch (err) {
        toast.error(err.message || "Could not post comment");
      }
    },
    [postId, user, text, replyingTo]
  );

  const toggleReaction = useCallback(
    async (commentId) => {
      if (!user) return;
      try {
        const svc = getCommentService();
        const isLiked = comments.some((c) => c.id === commentId && c.likesBy?.includes(user.uid));
        if (isLiked) await svc.removeLikeDislike(commentId, user.uid);
        else await svc.likeComment(commentId, user.uid);
      } catch {
        /* best-effort */
      }
    },
    [user, comments]
  );

  const startReply = (comment) => {
    setReplyingTo(comment);
    inputRef.current?.focus();
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[60] bg-black/40"
          onClick={() => { setOpen(false); onClose?.(); }}
        >
          <motion.aside
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 22, stiffness: 300 }}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Comments"
            className="fixed bottom-0 left-0 right-0 h-[70dvh] bg-white dark:bg-gray-900 rounded-t-2xl p-4 flex flex-col overflow-hidden"
          >
            <div className="flex items-center justify-between mb-3 shrink-0">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                Comments {comments.length > 0 && <span className="text-sm opacity-60">({comments.length})</span>}
              </h3>
              <button
                onClick={() => { setOpen(false); onClose?.(); }}
                aria-label="Close comments"
                className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500"
              >
                <X className="w-5 h-5" aria-hidden="true" />
              </button>
            </div>

            {/* Comments list */}
            <div className="flex-1 overflow-y-auto space-y-3 overscroll-contain" aria-live="polite">
              {loading && comments.length === 0 && (
                <p className="text-center text-sm text-gray-400 py-10">Loading comments...</p>
              )}
              {!loading && comments.length === 0 && (
                <p className="text-center text-sm text-gray-400 py-10">No comments yet. Be the first!</p>
              )}
              {comments.map((comment) => (
                <div key={comment.id} className="space-y-2">
                  <div className="flex gap-2.5">
                    <div
                      aria-hidden="true"
                      className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-indigo-500 text-white text-xs font-bold flex items-center justify-center shrink-0"
                    >
                      {(comment.userName || "U").charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-2">
                        <span className="text-xs font-bold text-gray-900 dark:text-gray-100">
                          {comment.userName || "User"}
                        </span>
                        <button
                          onClick={() => startReply(comment)}
                          className="text-[11px] text-indigo-500 hover:underline flex items-center gap-1"
                        >
                          <CornerUpLeft className="w-3 h-3" aria-hidden="true" /> Reply
                        </button>
                      </div>
                      <p className="text-sm text-gray-800 dark:text-gray-200 break-words">{comment.content}</p>
                      <button
                        onClick={() => toggleReaction(comment)}
                        aria-label="Like comment"
                        className={cn(
                          "text-[11px] mt-0.5",
                          comment.likesBy?.includes(user?.uid)
                            ? "text-pink-500 font-bold"
                            : "text-gray-400 hover:text-pink-500"
                        )}
                      >
                        ♥ {comment.likes || 0}
                      </button>
                      {comment.replies?.length > 0 && (
                        <div className="mt-2 ml-4 space-y-2 border-l-2 border-gray-100 dark:border-gray-800 pl-3">
                          {comment.replies.map((reply) => (
                            <div key={reply.id} className="flex gap-2">
                              <div
                                aria-hidden="true"
                                className="w-6 h-6 rounded-full bg-gradient-to-br from-cyan-500 to-indigo-500 text-white text-[10px] font-bold flex items-center justify-center shrink-0"
                              >
                                {(reply.userName || "U").charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <span className="text-xs font-bold text-gray-900 dark:text-gray-100">
                                  {reply.userName || "User"}
                                </span>
                                <p className="text-sm text-gray-700 dark:text-gray-300 break-words">{reply.content}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Reply target */}
            {replyingTo && (
              <div className="shrink-0 flex items-center justify-between px-3 py-1.5 mb-1 rounded-lg bg-indigo-500/10 text-xs text-indigo-600 dark:text-indigo-300">
                <span className="truncate">Replying to {replyingTo.userName || "comment"}</span>
                <button onClick={() => setReplyingTo(null)} aria-label="Cancel reply" className="ml-2 p-1 hover:opacity-70">
                  <X className="w-3.5 h-3.5" aria-hidden="true" />
                </button>
              </div>
            )}

            {/* Composer */}
            <form onSubmit={submit} className="shrink-0 flex gap-2 pt-2 border-t border-gray-100 dark:border-gray-800">
              <input
                ref={inputRef}
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder={replyingTo ? "Write a reply..." : "Add a comment..."}
                aria-label="Comment text"
                className="flex-1 min-h-[44px] px-3.5 rounded-xl text-sm bg-gray-100 dark:bg-gray-800 border border-transparent focus:border-indigo-500 focus:outline-none text-gray-900 dark:text-gray-100"
              />
              <button
                type="submit"
                disabled={!text.trim() || !user}
                aria-label="Send comment"
                className="min-h-[44px] px-4 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
              >
                <Send className="w-4 h-4" aria-hidden="true" />
                <span className="hidden sm:inline text-sm font-semibold">Send</span>
              </button>
            </form>
          </motion.aside>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
