// src/screens/CommentsDrawer.jsx – ARVDOUL ULTIMATE PRO MAX V30
// 💬 REAL‑TIME COMMENTS FROM commentService • REPLIES • LIKES • REPORTING • LOAD MORE
// 🔥 PERFECT ANIMATIONS • GLASS‑MORPHIC • BILLION‑SCALE

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import commentService from '../services/commentService.js';
import { useTheme } from '../context/ThemeContext';
import { useAppStore } from '../store/appStore';

// Icons
import { Heart, MessageCircle, X, Send, Loader2, Flag, Reply } from 'lucide-react';
import { FaHeart, FaRegHeart } from 'react-icons/fa6';

const formatTime = (timestamp) => {
  if (!timestamp) return '';
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  const now = new Date();
  const diff = (now - date) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}d`;
};

const CommentsDrawer = ({ isOpen, onClose, post, currentUser, theme, onCommentPosted }) => {
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [replyingTo, setReplyingTo] = useState(null);
  const [replyContent, setReplyContent] = useState('');
  const [hasMore, setHasMore] = useState(false);
  const [lastDoc, setLastDoc] = useState(null);

  const commentsEndRef = useRef(null);
  const unsubscribeRef = useRef(null);

  // Load comments
  const loadComments = useCallback(async (loadMore = false) => {
    if (!post?.id) return;
    setLoading(true);
    try {
      const result = await commentService.getCommentsByPost(post.id, {
        parentId: null,
        limit: 20,
        startAfter: loadMore ? lastDoc : null,
      });
      if (result.success) {
        const newComments = result.comments;
        setComments((prev) => (loadMore ? [...prev, ...newComments] : newComments));
        setHasMore(result.hasMore);
        if (result.lastComment) setLastDoc(result.lastComment);
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to load comments');
    } finally {
      setLoading(false);
    }
  }, [post?.id, lastDoc]);

  // Real‑time subscription
  useEffect(() => {
    if (!isOpen || !post?.id) return;
    loadComments();
    const subId = commentService.subscribeToPostComments(post.id, (update) => {
      if (update.type === 'update') {
        setComments(update.comments);
      }
    }, { parentId: null, nested: true });
    unsubscribeRef.current = () => commentService.unsubscribe(subId);
    return () => unsubscribeRef.current?.();
  }, [isOpen, post?.id]);

  // Submit comment
  const handleSubmitComment = async () => {
    if (!newComment.trim() || !currentUser?.uid || submitting) return;
    setSubmitting(true);
    try {
      const result = await commentService.createComment(post.id, currentUser.uid, newComment.trim(), {
        userName: currentUser.displayName,
        userUsername: currentUser.username,
        userAvatar: currentUser.photoURL,
      });
      setNewComment('');
      toast.success('Comment posted');
      const updatedPost = {
        ...post,
        stats: { ...post.stats, comments: (post.stats?.comments || 0) + 1 }
      };
      onCommentPosted?.(updatedPost);
      setTimeout(() => commentsEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // Submit reply
  const handleSubmitReply = async () => {
    if (!replyContent.trim() || !replyingTo || !currentUser?.uid) return;
    try {
      await commentService.replyToComment(replyingTo.id, currentUser.uid, replyContent.trim(), {
        userName: currentUser.displayName,
        userUsername: currentUser.username,
        userAvatar: currentUser.photoURL,
      });
      setReplyContent('');
      setReplyingTo(null);
      toast.success('Reply posted');
      const updatedPost = {
        ...post,
        stats: { ...post.stats, comments: (post.stats?.comments || 0) + 1 }
      };
      onCommentPosted?.(updatedPost);
    } catch (err) {
      toast.error(err.message);
    }
  };

  // Like comment
  const handleLikeComment = async (commentId) => {
    if (!currentUser?.uid) {
      toast.error('Sign in to like');
      return;
    }
    try {
      await commentService.likeComment(commentId, currentUser.uid);
      // Real‑time update will handle UI
    } catch (err) {
      toast.error(err.message);
    }
  };

  // Report comment
  const handleReportComment = (commentId) => {
    if (!currentUser?.uid) return;
    const reason = window.prompt('Reason for reporting?');
    if (reason) {
      commentService.reportComment(commentId, currentUser.uid, reason).catch(console.warn);
    }
  };

  // Render nested comments
  const renderComment = (comment, depth = 0) => {
    const isLiked = comment.likedBy?.includes(currentUser?.uid);
    return (
      <div key={comment.id} className={`${depth > 0 ? 'ml-8 mt-2 pl-4 border-l-2 border-gray-300 dark:border-gray-700' : 'mt-4'}`}>
        <div className="flex gap-3">
          <img
            src={comment.userAvatar || '/assets/default-profile.png'}
            alt=""
            className="w-10 h-10 rounded-full object-cover"
          />
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="font-bold dark:text-white">{comment.userName}</span>
              <span className="text-xs text-gray-500 dark:text-gray-400">{formatTime(comment.createdAt)}</span>
            </div>
            <p className="dark:text-gray-300 mt-1 break-words">{comment.content}</p>
            <div className="flex items-center gap-4 mt-2 text-sm">
              <button
                onClick={() => handleLikeComment(comment.id)}
                className="flex items-center gap-1 text-gray-500 hover:text-red-500"
              >
                {isLiked ? (
                  <FaHeart className="w-4 h-4 text-red-500 fill-current" />
                ) : (
                  <FaRegHeart className="w-4 h-4" />
                )}
                <span>{comment.likes || 0}</span>
              </button>
              <button
                onClick={() => setReplyingTo(comment)}
                className="flex items-center gap-1 text-gray-500 hover:text-blue-500"
              >
                <Reply className="w-4 h-4" />
                Reply
              </button>
              <button
                onClick={() => handleReportComment(comment.id)}
                className="text-gray-500 hover:text-red-500"
              >
                <Flag className="w-4 h-4" />
              </button>
            </div>
            {comment.replies?.map((reply) => renderComment(reply, depth + 1))}
          </div>
        </div>
      </div>
    );
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
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25 }}
            className={`fixed bottom-0 left-0 right-0 z-[91] ${
              theme === 'dark' ? 'bg-gray-900' : 'bg-white'
            } rounded-t-3xl shadow-2xl max-h-[90vh] flex flex-col`}
          >
            {/* Header */}
            <div className="p-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
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

            {/* Reply input if replying */}
            {replyingTo && (
              <div className="p-4 border-b border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-900/10">
                <p className="text-sm mb-2">
                  Replying to <span className="font-bold">{replyingTo.userName}</span>
                </p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={replyContent}
                    onChange={(e) => setReplyContent(e.target.value)}
                    placeholder="Write your reply..."
                    className="flex-1 p-3 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 dark:text-white"
                  />
                  <button
                    onClick={handleSubmitReply}
                    disabled={!replyContent.trim()}
                    className="px-4 py-2 rounded-xl bg-blue-500 text-white disabled:opacity-50"
                  >
                    Reply
                  </button>
                  <button
                    onClick={() => setReplyingTo(null)}
                    className="px-4 py-2 rounded-xl border border-gray-300 dark:border-gray-700"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Comments list */}
            <div className="flex-1 overflow-y-auto p-4">
              {loading && comments.length === 0 ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                </div>
              ) : comments.length === 0 ? (
                <div className="text-center py-12">
                  <MessageCircle className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <p className="dark:text-gray-300">No comments yet. Be the first!</p>
                </div>
              ) : (
                <>
                  {comments.map((c) => renderComment(c))}
                  {hasMore && (
                    <button
                      onClick={() => loadComments(true)}
                      className="mt-4 w-full py-2 text-center text-blue-500 hover:underline"
                    >
                      Load more comments
                    </button>
                  )}
                  <div ref={commentsEndRef} />
                </>
              )}
            </div>

            {/* New comment input */}
            <div className="p-4 border-t border-gray-200 dark:border-gray-800">
              <div className="flex gap-2">
                <img
                  src={currentUser?.photoURL || '/assets/default-profile.png'}
                  alt=""
                  className="w-10 h-10 rounded-full object-cover"
                />
                <div className="flex-1 relative">
                  <input
                    type="text"
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    placeholder="Write a comment..."
                    className="w-full p-3 pr-12 rounded-2xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 dark:text-white"
                    onKeyPress={(e) => e.key === 'Enter' && !submitting && handleSubmitComment()}
                  />
                  <button
                    onClick={handleSubmitComment}
                    disabled={!newComment.trim() || submitting}
                    className="absolute right-2 top-1/2 transform -translate-y-1/2 p-2 rounded-xl bg-blue-500 text-white disabled:opacity-50"
                  >
                    {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default CommentsDrawer;