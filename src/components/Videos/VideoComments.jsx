// src/components/Videos/VideoComments.jsx - ARVDOUL VIDEO COMMENTS
// Glass bottom sheet with real-time comments

import React, { useState, useEffect, useRef, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Heart,
  Reply,
  MoreHorizontal,
  Send,
  BadgeCheck,
} from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { formatTimeAgo, SPRING_ANIMATION } from '../../utils/videoUtils';
import { toast } from 'sonner';
import PropTypes from 'prop-types';

/**
 * VideoComments - Comments bottom sheet with real-time updates
 * Supports threaded replies, reactions, and creator badges
 */
const VideoComments = memo(({
  isOpen = false,
  onClose,
  video,
}) => {
  const { theme } = useTheme();
  const inputRef = useRef(null);
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [replyTo, setReplyTo] = useState(null);
  const [sortBy, setSortBy] = useState('best');
  const [loading, setLoading] = useState(false);

  // Load comments
  useEffect(() => {
    if (!isOpen || !video?.id) return;

    const loadComments = async () => {
      setLoading(true);
      try {
        // Mock comments for demo
        const mockComments = [
          {
            id: '1',
            user: { id: 'u1', name: 'Sarah Miller', username: 'sarah', avatar: null, isVerified: true },
            text: 'This is amazing! 🔥',
            likes: 124,
            isLiked: false,
            createdAt: new Date(Date.now() - 3600000).toISOString(),
            replies: [
              {
                id: 'r1',
                user: { id: 'u2', name: 'Alex Chen', username: 'alex', avatar: null, isVerified: false },
                text: 'Totally agree!',
                likes: 12,
                isLiked: false,
                createdAt: new Date(Date.now() - 1800000).toISOString(),
              },
            ],
          },
          {
            id: '2',
            user: { id: 'u3', name: 'Jordan Lee', username: 'jordan', avatar: null, isVerified: false },
            text: 'Can you do a tutorial on this?',
            likes: 89,
            isLiked: true,
            createdAt: new Date(Date.now() - 7200000).toISOString(),
            replies: [],
          },
          {
            id: '3',
            user: { id: 'u4', name: 'Taylor Swift', username: 'taylor', avatar: null, isVerified: true },
            text: 'The quality is incredible!',
            likes: 256,
            isLiked: false,
            createdAt: new Date(Date.now() - 14400000).toISOString(),
            replies: [],
          },
        ];
        setComments(mockComments);
      } catch (err) {
        console.error('Failed to load comments:', err);
        toast.error('Failed to load comments');
      } finally {
        setLoading(false);
      }
    };

    loadComments();
  }, [isOpen, video?.id]);

  // Handle submit comment
  const handleSubmit = async () => {
    if (!newComment.trim()) return;

    const comment = {
      id: `c_${Date.now()}`,
      user: { id: 'current', name: 'You', username: 'you', avatar: null, isVerified: false },
      text: newComment.trim(),
      likes: 0,
      isLiked: false,
      createdAt: new Date().toISOString(),
      replies: [],
      ...(replyTo && { replyTo: replyTo.id }),
    };

    if (replyTo) {
      setComments((prev) =>
        prev.map((c) =>
          c.id === replyTo.id
            ? { ...c, replies: [...c.replies, comment] }
            : c
        )
      );
    } else {
      setComments((prev) => [comment, ...prev]);
    }

    setNewComment('');
    setReplyTo(null);
    toast.success(replyTo ? 'Reply sent!' : 'Comment posted!');
  };

  // Handle like comment
  const handleLike = (commentId, isReply = false, parentId = null) => {
    if (isReply && parentId) {
      setComments((prev) =>
        prev.map((c) =>
          c.id === parentId
            ? {
                ...c,
                replies: c.replies.map((r) =>
                  r.id === commentId
                    ? {
                        ...r,
                        isLiked: !r.isLiked,
                        likes: r.isLiked ? r.likes - 1 : r.likes + 1,
                      }
                    : r
                ),
              }
            : c
        )
      );
    } else {
      setComments((prev) =>
        prev.map((c) =>
          c.id === commentId
            ? {
                ...c,
                isLiked: !c.isLiked,
                likes: c.isLiked ? c.likes - 1 : c.likes + 1,
              }
            : c
        )
      );
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
        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={SPRING_ANIMATION.bottomSheet}
          onClick={(e) => e.stopPropagation()}
          className="absolute bottom-0 left-0 right-0 max-h-[85vh] rounded-t-3xl backdrop-blur-2xl bg-gray-900/95 border-t border-white/10 overflow-hidden flex flex-col"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-white/10">
            <div className="flex items-center gap-4">
              <h2 className="text-white font-bold text-lg">
                {comments.length} Comments
              </h2>
              {/* Sort Dropdown */}
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="bg-white/10 text-white/80 text-sm px-3 py-1 rounded-full border border-white/10 focus:outline-none"
              >
                <option value="best">Best</option>
                <option value="newest">Newest</option>
                <option value="oldest">Oldest</option>
              </select>
            </div>
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={onClose}
              className="p-2 rounded-full bg-white/10"
            >
              <X className="w-5 h-5 text-white" />
            </motion.button>
          </div>

          {/* Comments List */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : sortedComments.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-white/60">No comments yet. Be the first!</p>
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

          {/* Reply Indicator */}
          {replyTo && (
            <div className="px-4 py-2 bg-white/5 flex items-center justify-between">
              <span className="text-white/60 text-sm">
                Replying to @{replyTo.user.username}
              </span>
              <button
                onClick={() => setReplyTo(null)}
                className="text-white/80 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Input */}
          <div className="p-4 border-t border-white/10">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-bold text-sm">
                Y
              </div>
              <input
                ref={inputRef}
                type="text"
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                placeholder="Add a comment..."
                className="flex-1 bg-white/10 text-white placeholder-white/50 rounded-full px-4 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
              <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={handleSubmit}
                disabled={!newComment.trim()}
                className="p-2 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 disabled:opacity-50"
              >
                <Send className="w-5 h-5 text-white" />
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
 * Single comment item
 */
const CommentItem = memo(({ comment, onLike, onReply }) => {
  const [showReplies, setShowReplies] = useState(false);
  const [showReplyInput, setShowReplyInput] = useState(false);

  return (
    <div className="flex gap-3">
      {/* Avatar */}
      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex-shrink-0 flex items-center justify-center text-white font-bold text-sm">
        {comment.user.name?.[0]?.toUpperCase() || '?'}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-white font-semibold text-sm">
            @{comment.user.username}
          </span>
          {comment.user.isVerified && (
            <BadgeCheck className="w-4 h-4 text-blue-400" />
          )}
          <span className="text-white/50 text-xs">
            {formatTimeAgo(comment.createdAt)}
          </span>
        </div>

        <p className="text-white/90 text-sm mt-1">{comment.text}</p>

        {/* Actions */}
        <div className="flex items-center gap-4 mt-2">
          <button
            onClick={() => onLike(false)}
            className="flex items-center gap-1 text-white/60 hover:text-red-400 transition-colors"
          >
            <Heart
              className={`w-4 h-4 ${comment.isLiked ? 'fill-red-400 text-red-400' : ''}`}
            />
            <span className="text-xs">{comment.likes}</span>
          </button>

          <button
            onClick={onReply}
            className="flex items-center gap-1 text-white/60 hover:text-white transition-colors"
          >
            <Reply className="w-4 h-4" />
            <span className="text-xs">Reply</span>
          </button>

          <button className="text-white/60 hover:text-white transition-colors">
            <MoreHorizontal className="w-4 h-4" />
          </button>
        </div>

        {/* Replies Toggle */}
        {comment.replies?.length > 0 && (
          <button
            onClick={() => setShowReplies(!showReplies)}
            className="text-purple-400 text-sm mt-2 hover:underline"
          >
            {showReplies ? 'Hide' : 'Show'} {comment.replies.length} replies
          </button>
        )}

        {/* Replies */}
        <AnimatePresence>
          {showReplies && comment.replies?.length > 0 && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="mt-3 pl-4 border-l-2 border-white/10 space-y-3"
            >
              {comment.replies.map((reply) => (
                <div key={reply.id} className="flex gap-3">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex-shrink-0 flex items-center justify-center text-white font-bold text-xs">
                    {reply.user.name?.[0]?.toUpperCase() || '?'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-white font-medium text-xs">
                        @{reply.user.username}
                      </span>
                      <span className="text-white/50 text-xs">
                        {formatTimeAgo(reply.createdAt)}
                      </span>
                    </div>
                    <p className="text-white/80 text-sm mt-0.5">{reply.text}</p>
                    <button
                      onClick={() => onLike(true, comment.id)}
                      className="flex items-center gap-1 text-white/60 hover:text-red-400 transition-colors mt-1"
                    >
                      <Heart
                        className={`w-3 h-3 ${reply.isLiked ? 'fill-red-400 text-red-400' : ''}`}
                      />
                      <span className="text-xs">{reply.likes}</span>
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
