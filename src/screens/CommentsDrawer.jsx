// src/screens/CommentsDrawer.jsx – ULTRA PRO MAX V14 (DRAGGABLE, AVATAR NAVIGATION)
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { motion, AnimatePresence, useDragControls } from 'framer-motion';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { MessageCircle, X, Send, Loader2, Flag, Reply, Edit3, Trash2, Pin } from 'lucide-react';
import { FaHeart, FaRegHeart } from 'react-icons/fa6';
import commentService from '../services/commentService.js';
import { useAuth } from '../context/AuthContext.jsx';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { triggerHaptic } from '../utils/haptics';
import * as userService from '../services/userService.js';

const cn = (...classes) => classes.filter(Boolean).join(' ');

// ------------------------------------------------------------------
// SIMPLE LINK DETECTOR
// ------------------------------------------------------------------
const LinkifyText = ({ text }) => {
  if (!text) return null;
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const parts = text.split(urlRegex);
  return (
    <>
      {parts.map((part, i) =>
        part && part.match(urlRegex) ? (
          <a key={i} href={part} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">
            {part}
          </a>
        ) : (
          part
        )
      )}
    </>
  );
};

// ------------------------------------------------------------------
// MEMOIZED COMMENT ITEM with Avatar Navigation
// ------------------------------------------------------------------
const CommentItem = React.memo(({ comment, pinnedCommentId, currentUser, postAuthorId, onLike, onDelete, onEdit, onReport, onPin, onReact }) => {
  const navigate = useNavigate();
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(comment.content);
  const effectiveUser = currentUser || { uid: 'temp', displayName: 'Guest', photoURL: '/assets/default-profile.png' };
  const isAuthor = comment.userId === effectiveUser.uid;
  const canPin = postAuthorId === effectiveUser.uid && pinnedCommentId !== comment.id;
  const timeAgo = useMemo(() => {
    try {
      const date = comment.createdAt?.toDate?.() || new Date(comment.createdAt);
      return formatDistanceToNow(date, { addSuffix: true });
    } catch {
      return 'just now';
    }
  }, [comment.createdAt]);

  const handleSaveEdit = () => {
    onEdit(comment.id, editContent);
    setIsEditing(false);
  };

  const avatarUrl = userService.getAvatarUrl(comment.userId, comment.userName, comment.userAvatar);

  return (
    <div className={cn("flex gap-3", pinnedCommentId === comment.id && "bg-gradient-to-r from-indigo-500/15 via-purple-500/10 to-transparent border-l-4 border-indigo-500")}>
      <button onClick={() => navigate(`/profile/${comment.userId}`)} className="flex-shrink-0">
        <img src={avatarUrl} alt="" className="w-10 h-10 rounded-full object-cover" loading="lazy" decoding="async" draggable={false} />
      </button>
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <span className="font-bold dark:text-white">{comment.userName}</span>
          <span className="text-xs text-gray-500">{timeAgo}</span>
        </div>
        {isEditing ? (
          <div className="mt-1 flex gap-2">
            <input value={editContent} onChange={(e) => setEditContent(e.target.value)} className="flex-1 p-2 rounded-xl border dark:border-gray-700 dark:bg-gray-800 dark:text-white" autoFocus />
            <button onClick={handleSaveEdit} className="px-3 py-1 rounded-xl bg-blue-500 text-white text-sm">Save</button>
            <button onClick={() => setIsEditing(false)} className="px-3 py-1 rounded-xl border dark:border-gray-700 text-sm">Cancel</button>
          </div>
        ) : (
          <p className="dark:text-gray-300 mt-1 break-words"><LinkifyText text={comment.content} /></p>
        )}
        <div className="flex items-center gap-3 mt-2">
          <div className="flex gap-1">
            {['❤️', '😂', '😮', '😢', '😡'].map(emoji => (
              <button key={emoji} onClick={() => onReact(comment.id, emoji)} className="text-sm hover:scale-125 transition-transform">
                {emoji}
              </button>
            ))}
          </div>
          <button onClick={() => onLike(comment.id)} className="flex items-center gap-1 text-gray-500 hover:text-red-500">
            {comment.likedBy?.includes(effectiveUser.uid) ? <FaHeart className="w-4 h-4 text-red-500 fill-current" /> : <FaRegHeart className="w-4 h-4" />}
            <span>{comment.likes || 0}</span>
          </button>
          <button onClick={() => {}} className="flex items-center gap-1 text-gray-500 hover:text-blue-500">
            <Reply className="w-4 h-4" /> Reply
          </button>
          {isAuthor && (
            <>
              <button onClick={() => setIsEditing(true)} className="text-gray-500 hover:text-yellow-500">
                <Edit3 className="w-4 h-4" />
              </button>
              <button onClick={() => onDelete(comment.id)} className="text-gray-500 hover:text-red-500">
                <Trash2 className="w-4 h-4" />
              </button>
            </>
          )}
          <button onClick={() => onReport(comment)} className="text-gray-500 hover:text-red-500">
            <Flag className="w-4 h-4" />
          </button>
          {canPin && (
            <button onClick={() => onPin(comment.id)} className="text-gray-500 hover:text-yellow-500">
              <Pin className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
});

// ------------------------------------------------------------------
// MEMOIZED COMMENT COMPOSER
// ------------------------------------------------------------------
const CommentComposer = React.memo(({ onSubmit, loading }) => {
  const [newComment, setNewComment] = useState('');
  const handleSubmit = () => {
    if (!newComment.trim()) return;
    onSubmit(newComment);
    setNewComment('');
  };
  return (
    <div className="p-4 border-t flex gap-2">
      <img src="/assets/default-profile.png" alt="" className="w-10 h-10 rounded-full object-cover" />
      <div className="flex-1 relative">
        <input
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          placeholder="Write a comment..."
          className="w-full p-3 pr-12 rounded-2xl border dark:border-gray-700 dark:bg-gray-800 dark:text-white"
          onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
        />
        <button
          onClick={handleSubmit}
          disabled={!newComment.trim() || loading}
          className="absolute right-2 top-1/2 transform -translate-y-1/2 p-2 rounded-xl bg-blue-500 text-white disabled:opacity-50"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
});

// ------------------------------------------------------------------
// MAIN COMMENTS DRAWER – Draggable
// ------------------------------------------------------------------
export default function CommentsDrawer({ isOpen, onClose, post, currentUser, theme }) {
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [reportingComment, setReportingComment] = useState(null);
  const [reportReason, setReportReason] = useState('');
  const [pinnedCommentId, setPinnedCommentId] = useState(post?.pinnedCommentId);
  const unsubscribeRef = useRef(null);
  const activeRef = useRef(true);
  const dragControls = useDragControls();
  const [drawerY, setDrawerY] = useState(0);

  const loadComments = useCallback(async () => {
    if (!post?.id) return;
    setLoading(true);
    try {
      const result = await commentService.getCommentsByPost(post.id, { parentId: null, limit: 30 });
      if (result.success && activeRef.current) setComments(result.comments);
    } catch (err) {
      toast.error('Failed to load comments');
    } finally {
      if (activeRef.current) setLoading(false);
    }
  }, [post?.id]);

  useEffect(() => {
    if (!isOpen || !post?.id) return;
    activeRef.current = true;
    loadComments();
    const subId = commentService.subscribeToTargetComments('post', post.id, (update) => {
      if (update.type === 'update' && activeRef.current) {
        const incoming = update.comments || [];
        setComments(prev => {
          const prevMap = new Map(prev.map(c => [c.id, c]));
          let changed = false;
          const merged = incoming.map(comment => {
            const existing = prevMap.get(comment.id);
            if (!existing) {
              changed = true;
              return comment;
            }
            const prevStr = JSON.stringify(existing);
            const nextStr = JSON.stringify(comment);
            if (prevStr !== nextStr) {
              changed = true;
              return comment;
            }
            return existing;
          });
          if (merged.length !== prev.length || changed) {
            return merged;
          }
          return prev;
        });
      }
    }, { parentId: null });
    unsubscribeRef.current = () => commentService.unsubscribe(subId);
    return () => {
      activeRef.current = false;
      if (unsubscribeRef.current) unsubscribeRef.current();
    };
  }, [isOpen, post?.id, loadComments]);

  const handleSubmitComment = async (content) => {
    if (!currentUser?.uid) return;
    setSubmitting(true);
    const optimistic = {
      id: `temp_${Date.now()}`,
      content,
      pending: true,
      createdAt: new Date(),
      userId: currentUser.uid,
      userName: currentUser.displayName,
      userAvatar: currentUser.photoURL,
      likes: 0,
    };
    setComments(prev => [optimistic, ...prev]);
    try {
      await commentService.createComment(post.id, currentUser.uid, content.trim(), {
        userName: currentUser.displayName,
        userUsername: currentUser.username,
        userAvatar: currentUser.photoURL,
      });
    } catch (err) {
      setComments(prev => prev.filter(c => c.id !== optimistic.id));
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleLike = async (commentId) => {
    if (!currentUser) return toast.error('Sign in');
    triggerHaptic('light');
    const prevComments = [...comments];
    setComments(prev => prev.map(c => c.id === commentId ? { ...c, likes: (c.likes || 0) + 1 } : c));
    try {
      await commentService.likeComment(commentId, currentUser.uid);
    } catch (err) {
      setComments(prevComments);
      toast.error('Like failed');
    }
  };

  const handleDeleteComment = async (commentId) => {
    if (!currentUser) return;
    triggerHaptic('light');
    const prevComments = [...comments];
    setComments(prev => prev.filter(c => c.id !== commentId));
    try {
      await commentService.deleteComment(commentId, currentUser.uid);
      toast.success('Comment deleted');
    } catch (err) {
      setComments(prevComments);
      toast.error('Delete failed');
    }
  };

  const handleEditComment = async (commentId, newContent) => {
    if (!currentUser) return;
    triggerHaptic('light');
    const prevComments = [...comments];
    setComments(prev => prev.map(c => c.id === commentId ? { ...c, content: newContent, isEdited: true } : c));
    try {
      await commentService.updateComment(commentId, currentUser.uid, { content: newContent });
      toast.success('Comment updated');
    } catch (err) {
      setComments(prevComments);
      toast.error('Edit failed');
    }
  };

  const handleReportComment = async (comment, reason) => {
    if (!currentUser) return;
    try {
      const reportFn = httpsCallable(getFunctions(), 'reportComment');
      await reportFn({ commentId: comment.id, reporterId: currentUser.uid, reason });
      toast.success('Report submitted');
    } catch (err) {
      toast.error('Report failed');
    }
    setReportingComment(null);
    setReportReason('');
  };

  const handlePinComment = async (commentId) => {
    if (!currentUser) return;
    try {
      await commentService.pinCommentToTarget('post', post.id, commentId, currentUser.uid, true);
      setPinnedCommentId(commentId);
      toast.success('Pinned');
    } catch (err) {
      toast.error('Pin failed');
    }
  };

  const handleReact = async (commentId, emoji) => {
    if (!currentUser) return;
    triggerHaptic('light');
    await commentService.addReaction(commentId, currentUser.uid, emoji);
  };

  const effectiveUser = currentUser;
  const isDark = theme === 'dark';

  // Drag to close
  const handleDragEnd = (event, info) => {
    if (info.offset.y > 100) {
      onClose();
    }
    setDrawerY(0);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-xl z-[90]"
          />
          <motion.div
            drag="y"
            dragControls={dragControls}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={0.2}
            onDragEnd={handleDragEnd}
            initial={{ y: '100%' }}
            animate={{ y: drawerY }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25 }}
            className={cn("fixed bottom-0 left-0 right-0 z-[91] rounded-t-3xl shadow-2xl max-h-[90vh] flex flex-col", isDark ? 'bg-gray-900' : 'bg-white')}
          >
            {/* Drag Handle */}
            <div className="w-full flex justify-center pt-2 pb-1 cursor-grab active:cursor-grabbing" onMouseDown={(e) => dragControls.start(e)} onTouchStart={(e) => dragControls.start(e)}>
              <div className="w-12 h-1.5 rounded-full bg-gray-400 dark:bg-gray-600" />
            </div>

            <div className="p-4 border-b flex justify-between items-center">
              <div className="flex gap-3">
                <MessageCircle className="w-6 h-6" />
                <div>
                  <h3 className="text-xl font-bold dark:text-white">Comments</h3>
                  <p className="text-sm dark:text-gray-400">{post?.stats?.comments || 0} total</p>
                </div>
              </div>
              <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {loading ? (
                <div className="text-center py-8">Loading comments…</div>
              ) : comments.length === 0 ? (
                <div className="text-center py-8 text-gray-500">No comments yet. Be the first!</div>
              ) : (
                comments.map(comment => (
                  <CommentItem
                    key={comment.id}
                    comment={comment}
                    pinnedCommentId={pinnedCommentId}
                    currentUser={effectiveUser}
                    postAuthorId={post?.authorId}
                    onLike={handleLike}
                    onDelete={handleDeleteComment}
                    onEdit={handleEditComment}
                    onReport={setReportingComment}
                    onPin={handlePinComment}
                    onReact={handleReact}
                  />
                ))
              )}
            </div>

            <CommentComposer onSubmit={handleSubmitComment} loading={submitting} />

            {reportingComment && (
              <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-xl">
                <div className={cn("p-6 rounded-2xl shadow-2xl max-w-sm w-full", isDark ? 'bg-gray-900' : 'bg-white')}>
                  <h3 className="text-lg font-bold mb-4">Report comment</h3>
                  <select value={reportReason} onChange={(e) => setReportReason(e.target.value)} className="w-full p-2 rounded-xl border mb-4 dark:bg-gray-800">
                    <option value="">Select reason...</option>
                    <option value="spam">Spam</option>
                    <option value="harassment">Harassment</option>
                    <option value="inappropriate">Inappropriate</option>
                    <option value="other">Other</option>
                  </select>
                  <div className="flex gap-2 justify-end">
                    <button onClick={() => setReportingComment(null)} className="px-4 py-2 rounded-xl border dark:border-gray-700">Cancel</button>
                    <button onClick={() => handleReportComment(reportingComment, reportReason)} disabled={!reportReason} className="px-4 py-2 rounded-xl bg-red-500 text-white disabled:opacity-50">
                      Submit
                    </button>
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}