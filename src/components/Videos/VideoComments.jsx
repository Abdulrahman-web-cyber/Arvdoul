// src/components/Videos/VideoComments.jsx - ARVDOUL VIDEO COMMENTS
// World-class glass bottom sheet with real-time comments & rapid emoji reactions

import React, { useState, useEffect, useRef, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Heart,
  Reply,
  MoreHorizontal,
  Send,
  BadgeCheck,
  Smile,
  Flame,
  Crown,
  Sparkles
} from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { formatTimeAgo, SPRING_ANIMATION } from '../../utils/videoUtils';
import { toast } from 'sonner';
import PropTypes from 'prop-types';

const EMOJI_PRESETS = ['🔥', '❤️', '👏', '😂', '🚀', '💡', '💯', '🙌'];

/**
 * VideoComments - World-Class Comments bottom sheet with real-time updates
 */
const VideoComments = memo(({
  isOpen = false,
  onClose,
  video,
}) => {
  const { isDark } = useTheme();
  const inputRef = useRef(null);
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [replyTo, setReplyTo] = useState(null);
  const [sortBy, setSortBy] = useState('best');
  const [loading, setLoading] = useState(false);

  // Load comments from real service
  useEffect(() => {
    if (!isOpen || !video?.id) return;

    const loadComments = async () => {
      setLoading(true);
      try {
        const { getCommentService } = await import('../../services/commentService.js');
        const res = await getCommentService().getCommentsByPost(video.id, {
          nested: true,
          limit: 50,
          cacheFirst: false,
        });
        const mapComment = (c) => ({
          id: c.id,
          user: {
            id: c.userId,
            name: c.userName || 'User',
            username: c.userUsername || 'user',
            avatar: c.userAvatar || null,
            isVerified: !!c.isVerified,
            isCreator: c.userId === video.userId || c.userId === video.creatorId,
          },
          text: c.content || c.text || '',
          likes: c.likes || 0,
          isLiked: false,
          createdAt: c.createdAt instanceof Date
            ? c.createdAt.toISOString()
            : new Date(c.createdAt).toISOString(),
          replies: Array.isArray(c.replies) ? c.replies.map(mapComment) : [],
        });
        setComments((res.comments || []).map(mapComment));
      } catch (err) {
        console.error('Failed to load comments:', err);
        toast.error('Failed to load comments');
      } finally {
        setLoading(false);
      }
    };

    loadComments();
  }, [isOpen, video?.id, video?.userId, video?.creatorId]);

  // Handle submit comment
  const handleSubmit = async () => {
    if (!newComment.trim()) return;

    const textToSend = newComment.trim();
    const optimistic = {
      id: `local_${Date.now()}`,
      user: { id: 'current', name: 'You', username: 'you', avatar: null, isVerified: false, isCreator: false },
      text: textToSend,
      likes: 0,
      isLiked: false,
      createdAt: new Date().toISOString(),
      replies: [],
      ...(replyTo && { replyTo: replyTo.id }),
    };

    try {
      const { getCommentService } = await import('../../services/commentService.js');
      const { getAuthInstance } = await import('../../firebase/firebase.js');
      const auth = await getAuthInstance();
      const uid = auth?.currentUser?.uid;
      if (!uid) throw new Error('You must be signed in to comment');

      const res = replyTo
        ? await getCommentService().replyToComment(
            replyTo.id,
            uid,
            textToSend,
            { userName: auth.currentUser.displayName, userUsername: auth.currentUser.username || auth.currentUser.displayName, userAvatar: auth.currentUser.photoURL }
          )
        : await getCommentService().createComment(
            video.id,
            uid,
            textToSend,
            { userName: auth.currentUser.displayName, userUsername: auth.currentUser.username || auth.currentUser.displayName, userAvatar: auth.currentUser.photoURL }
          );

      if (res?.offlineQueued) {
        optimistic._pending = true;
      } else if (res?.success === false) {
        throw new Error(res.error || 'Failed to post comment');
      }

      if (replyTo) {
        setComments((prev) =>
          prev.map((c) =>
            c.id === replyTo.id
              ? { ...c, replies: [...c.replies, optimistic] }
              : c
          )
        );
      } else {
        setComments((prev) => [optimistic, ...prev]);
      }

      setNewComment('');
      setReplyTo(null);
      toast.success(replyTo ? 'Reply sent!' : 'Comment posted!');
    } catch (err) {
      console.error('Failed to post comment:', err);
      toast.error(err.message || 'Failed to post comment');
    }
  };

  // Quick Emoji Click
  const handleEmojiClick = (emoji) => {
    setNewComment((prev) => prev + emoji);
    inputRef.current?.focus();
  };

  // Handle like comment
  const handleLike = async (commentId, isReply = false, parentId = null) => {
    const applyToggle = (prev) =>
      prev.map((c) => {
        if (isReply && parentId && c.id === parentId) {
          return {
            ...c,
            replies: c.replies.map((r) =>
              r.id === commentId
                ? { ...r, isLiked: !r.isLiked, likes: r.isLiked ? r.likes - 1 : r.likes + 1 }
                : r
            ),
          };
        }
        if (!isReply && c.id === commentId) {
          return { ...c, isLiked: !c.isLiked, likes: c.isLiked ? c.likes - 1 : c.likes + 1 };
        }
        return c;
      });

    setComments(applyToggle);

    try {
      const { getCommentService } = await import('../../services/commentService.js');
      const { getAuthInstance } = await import('../../firebase/firebase.js');
      const auth = await getAuthInstance();
      const uid = auth?.currentUser?.uid;
      if (!uid) return;
      const target = (isReply && parentId
        ? comments.find((c) => c.id === parentId)?.replies.find((r) => r.id === commentId)
        : comments.find((c) => c.id === commentId));
      const wasLiked = !target?.isLiked;
      if (wasLiked) {
        await getCommentService().likeComment(commentId, uid);
      } else {
        await getCommentService().removeLikeDislike(commentId, uid);
      }
    } catch (err) {
      setComments(applyToggle);
      console.error('Failed to like comment:', err);
    }
  };

  // Handle reply
  const handleReply = (comment) => {
    setReplyTo(comment);
    inputRef.current?.focus();
  };

  // Sort comments
  const sortedComments = [...comments].sort((a, b) => {
    switch (sortBy) {
      case 'newest':
        return new Date(b.createdAt) - new Date(a.createdAt);
      case 'oldest':
        return new Date(a.createdAt) - new Date(b.createdAt);
      case 'best':
      default:
        return b.likes - a.likes;
    }
  });

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex justify-end flex-col"
        onClick={onClose}
      >
        <motion.div
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={SPRING_ANIMATION.bottomSheet}
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-2xl mx-auto max-h-[85vh] rounded-t-3xl backdrop-blur-2xl bg-[#0d0f1d]/95 border-t border-white/10 shadow-2xl overflow-hidden flex flex-col"
        >
          {/* Top Drag Handle Indicator */}
          <div className="w-full flex items-center justify-center pt-3 pb-1 cursor-grab active:cursor-grabbing">
            <div className="w-12 h-1.5 rounded-full bg-white/20" />
          </div>

          {/* Header */}
          <div className="flex items-center justify-between px-5 py-3 border-b border-white/10">
            <div className="flex items-center gap-3">
              <h2 className="text-white font-extrabold text-base tracking-tight">
                Comments
                <span className="ml-2 text-xs font-semibold px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
                  {comments.length}
                </span>
              </h2>
              
              {/* Sort Selection */}
              <div className="flex items-center gap-1 bg-white/5 p-0.5 rounded-xl border border-white/10">
                {['best', 'newest'].map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setSortBy(mode)}
                    className={`px-2.5 py-0.5 rounded-lg text-xs font-semibold transition-all ${
                      sortBy === mode
                        ? 'bg-purple-600 text-white shadow-sm'
                        : 'text-white/60 hover:text-white'
                    }`}
                  >
                    {mode.charAt(0).toUpperCase() + mode.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 text-white/70 hover:text-white flex items-center justify-center transition-colors"
              aria-label="Close comments"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Comments List */}
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-12 gap-3">
                <div className="w-7 h-7 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
                <span className="text-xs text-white/50 font-medium">Loading conversations...</span>
              </div>
            ) : sortedComments.length === 0 ? (
              <div className="text-center py-12 flex flex-col items-center gap-2">
                <div className="w-12 h-12 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
                  <Sparkles className="w-6 h-6" />
                </div>
                <p className="text-white/80 font-bold text-sm">No comments yet</p>
                <p className="text-white/50 text-xs max-w-xs">Be the first to share your thoughts with the creator!</p>
              </div>
            ) : (
              sortedComments.map((comment) => (
                <CommentItem
                  key={comment.id}
                  comment={comment}
                  onLike={(isReply, parentId) => handleLike(comment.id, isReply, parentId)}
                  onReply={() => handleReply(comment)}
                />
              ))
            )}
          </div>

          {/* Reply Indicator Bar */}
          {replyTo && (
            <div className="px-5 py-2 bg-purple-950/40 border-t border-purple-500/20 flex items-center justify-between">
              <span className="text-purple-200 text-xs font-medium flex items-center gap-1.5 truncate">
                <Reply className="w-3.5 h-3.5 text-purple-400" />
                Replying to <span className="font-bold text-white">@{replyTo.user.username}</span>
              </span>
              <button
                onClick={() => setReplyTo(null)}
                className="text-purple-300 hover:text-white p-1 rounded-md"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Quick Reaction Emojis Ribbon */}
          <div className="px-5 py-2 flex items-center gap-2 overflow-x-auto no-scrollbar border-t border-white/5 bg-white/[0.02]">
            <span className="text-[11px] font-bold uppercase tracking-wider text-white/40 flex-shrink-0 flex items-center gap-1">
              <Smile className="w-3.5 h-3.5" /> React:
            </span>
            {EMOJI_PRESETS.map((emoji) => (
              <button
                key={emoji}
                onClick={() => handleEmojiClick(emoji)}
                className="px-2.5 py-1 rounded-full bg-white/5 hover:bg-white/15 text-sm transition-transform hover:scale-110 active:scale-95 flex-shrink-0"
              >
                {emoji}
              </button>
            ))}
          </div>

          {/* Input Bar */}
          <div className="p-4 border-t border-white/10 bg-[#090b14]/90">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-violet-600 to-fuchsia-600 flex items-center justify-center text-white font-bold text-xs shadow-md">
                ✦
              </div>
              <div className="flex-1 relative flex items-center">
                <input
                  ref={inputRef}
                  type="text"
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                  placeholder={replyTo ? `Reply to @${replyTo.user.username}...` : "Add a comment..."}
                  className="w-full bg-white/10 text-white placeholder-white/40 text-sm rounded-full pl-4 pr-10 py-2.5 focus:outline-none focus:ring-2 focus:ring-purple-500 border border-white/10 transition-all"
                  maxLength={500}
                />
                {newComment.length > 0 && (
                  <span className="absolute right-3 text-[10px] font-mono text-white/40">
                    {500 - newComment.length}
                  </span>
                )}
              </div>
              <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={handleSubmit}
                disabled={!newComment.trim()}
                className="w-10 h-10 rounded-full bg-gradient-to-r from-purple-600 via-indigo-600 to-pink-600 flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed text-white shadow-lg shadow-purple-500/20"
                aria-label="Send comment"
              >
                <Send className="w-4 h-4 translate-x-0.5" />
              </motion.button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
});

VideoComments.displayName = 'VideoComments';

/**
 * Single comment item component
 */
const CommentItem = memo(({ comment, onLike, onReply }) => {
  const [showReplies, setShowReplies] = useState(false);

  return (
    <div className="flex gap-3 group">
      {/* Avatar */}
      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-purple-500/80 to-pink-500/80 flex-shrink-0 flex items-center justify-center text-white font-bold text-xs ring-1 ring-white/20 shadow-md">
        {comment.user.avatar ? (
          <img src={comment.user.avatar} alt={comment.user.name} className="w-full h-full rounded-full object-cover" />
        ) : (
          comment.user.name?.[0]?.toUpperCase() || '?'
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-white font-bold text-xs tracking-tight">
            @{comment.user.username}
          </span>
          {comment.user.isCreator && (
            <span className="px-1.5 py-0.2 rounded-md bg-pink-500/20 text-pink-300 border border-pink-500/40 text-[9px] font-bold flex items-center gap-0.5">
              <Crown className="w-2.5 h-2.5" /> Creator
            </span>
          )}
          {comment.user.isVerified && (
            <BadgeCheck className="w-3.5 h-3.5 text-blue-400" />
          )}
          <span className="text-white/40 text-[11px] font-medium ml-auto">
            {formatTimeAgo(comment.createdAt)}
          </span>
        </div>

        <p className="text-white/90 text-sm mt-1 leading-relaxed break-words font-normal">
          {comment.text}
        </p>

        {/* Action Buttons */}
        <div className="flex items-center gap-4 mt-2">
          <button
            onClick={() => onLike(false)}
            className="flex items-center gap-1 text-white/50 hover:text-red-400 transition-colors"
          >
            <Heart
              className={`w-3.5 h-3.5 ${comment.isLiked ? 'fill-red-400 text-red-400 scale-110' : ''}`}
            />
            <span className="text-xs font-semibold">{comment.likes || 0}</span>
          </button>

          <button
            onClick={onReply}
            className="flex items-center gap-1 text-white/50 hover:text-white transition-colors text-xs font-semibold"
          >
            <Reply className="w-3.5 h-3.5" />
            <span>Reply</span>
          </button>
        </div>

        {/* Replies toggle */}
        {comment.replies?.length > 0 && (
          <button
            onClick={() => setShowReplies(!showReplies)}
            className="text-purple-400 hover:text-purple-300 text-xs font-bold mt-2.5 flex items-center gap-1.5"
          >
            <span className="w-4 h-[1px] bg-purple-400/50" />
            {showReplies ? 'Hide' : 'View'} {comment.replies.length} {comment.replies.length === 1 ? 'reply' : 'replies'}
          </button>
        )}

        {/* Threaded Replies */}
        <AnimatePresence>
          {showReplies && comment.replies?.length > 0 && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="mt-3 pl-3 border-l border-white/10 space-y-3"
            >
              {comment.replies.map((reply) => (
                <div key={reply.id} className="flex gap-2.5">
                  <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex-shrink-0 flex items-center justify-center text-white font-bold text-[10px]">
                    {reply.user.name?.[0]?.toUpperCase() || '?'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-white font-semibold text-xs">
                        @{reply.user.username}
                      </span>
                      {reply.user.isCreator && (
                        <span className="px-1 py-0.2 rounded bg-pink-500/20 text-pink-300 text-[8px] font-bold">
                          Creator
                        </span>
                      )}
                      <span className="text-white/40 text-[10px] ml-auto">
                        {formatTimeAgo(reply.createdAt)}
                      </span>
                    </div>
                    <p className="text-white/80 text-xs mt-0.5 leading-relaxed break-words">
                      {reply.text}
                    </p>
                    <button
                      onClick={() => onLike(true, comment.id)}
                      className="flex items-center gap-1 text-white/50 hover:text-red-400 transition-colors mt-1"
                    >
                      <Heart
                        className={`w-3 h-3 ${reply.isLiked ? 'fill-red-400 text-red-400' : ''}`}
                      />
                      <span className="text-[10px] font-semibold">{reply.likes || 0}</span>
                    </button>
                  </div>
                </div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
});

CommentItem.displayName = 'CommentItem';
CommentItem.propTypes = {
  comment: PropTypes.object.isRequired,
  onLike: PropTypes.func.isRequired,
  onReply: PropTypes.func.isRequired,
};

VideoComments.propTypes = {
  isOpen: PropTypes.bool,
  onClose: PropTypes.func.isRequired,
  video: PropTypes.object,
};

export default VideoComments;
