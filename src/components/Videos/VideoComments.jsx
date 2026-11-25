// src/components/Videos/VideoComments.jsx

import { useState, useEffect, useRef, useMemo, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Heart, Reply, Send, BadgeCheck, Smile, Crown, Sparkles } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { formatTimeAgo, SPRING_ANIMATION } from '../../utils/videoUtils';
import { pickDisplayName, deriveHandle } from '../../services/profileReadModel.js';
import { BRAND_GRADIENT } from '../../design-system/tokens.js';
import { toast } from 'sonner';
import PropTypes from 'prop-types';
import { LazyImage } from '../../components/Shared/LazyImage';

const EMOJI_PRESETS = ['🔥', '❤️', '👏', '😂', '🚀', '💡', '💯', '🙌'];

/**
 * VideoComments - Canonical Spark & legacy video comments drawer
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
  const [blockedUserIds, setBlockedUserIds] = useState(new Set());

  const canonicalTargetId = video?.canonicalPostId || video?.id;
  const targetType = video?._sourceCollection === 'videos' && !video?.canonicalPostId
    ? 'legacy_video'
    : 'post';

  const replyToLabel = useMemo(
    () => (replyTo ? (replyTo.user.username ? `@${replyTo.user.username}` : replyTo.user.name) : ''),
    [replyTo]
  );

  useEffect(() => {
    if (!isOpen) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const { getAuthInstance } = await import('../../firebase/firebase.js');
        const auth = await getAuthInstance();
        const uid = auth?.currentUser?.uid;
        if (!uid) return;
        const { default: userService } = await import('../../services/userService.js');
        const res = await userService.getBlockedUserIds(uid);
        if (!cancelled) setBlockedUserIds(new Set(res?.ids || []));
      } catch (err) {
        console.warn('[VideoComments] blocked-users load failed', err);
      }
    })();
    return () => { cancelled = true; };
  }, [isOpen]);

  const visibleComments = useMemo(
    () => comments.filter((c) => !blockedUserIds.has(c.user?.id)),
    [comments, blockedUserIds]
  );

  useEffect(() => {
    if (!isOpen || !canonicalTargetId) return;

    const loadComments = async () => {
      setLoading(true);
      try {
        const { getAuthInstance } = await import('../../firebase/firebase.js');
        const auth = await getAuthInstance();
        const viewerUid = auth?.currentUser?.uid || null;
        const { getCommentService } = await import('../../services/commentService.js');
        const res = await getCommentService().getCommentsByPost(canonicalTargetId, {
          nested: true,
          limit: 50,
          cacheFirst: false,
          viewerId: viewerUid,
        });
        const mapComment = (c) => ({
          id: c.id,
          user: {
            id: c.userId,
            name: pickDisplayName([c.userName], { fallback: null }) || `user ${String(c.userId || '').slice(0, 6)}`,
            username: deriveHandle(c.userUsername),
            avatar: c.userAvatar || null,
            isVerified: !!c.isVerified,
            isCreator: c.userId === video?.userId || c.userId === video?.authorId || c.userId === video?.creatorId,
          },
          text: c.content || c.text || '',
          likes: typeof c.likes === 'number' ? c.likes : null,
          isLiked: Array.isArray(c.likesBy) && !!viewerUid && c.likesBy.includes(viewerUid),
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
  }, [isOpen, canonicalTargetId, video?.userId, video?.authorId, video?.creatorId]);

  const handleSubmit = async () => {
    if (!newComment.trim() || !canonicalTargetId) return;

    const textToSend = newComment.trim();
    const optimistic = {
      id: `local_${Date.now()}`,
      user: { id: 'current', name: 'You', username: null, avatar: null, isVerified: false, isCreator: false },
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
            {
              userName: auth.currentUser.displayName,
              userUsername: auth.currentUser.username || auth.currentUser.displayName,
              userAvatar: auth.currentUser.photoURL,
              targetType,
            }
          )
        : await getCommentService().createComment(
            canonicalTargetId,
            uid,
            textToSend,
            {
              userName: auth.currentUser.displayName,
              userUsername: auth.currentUser.username || auth.currentUser.displayName,
              userAvatar: auth.currentUser.photoURL,
              targetType,
            }
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

  const handleEmojiClick = (emoji) => {
    setNewComment((prev) => prev + emoji);
    inputRef.current?.focus();
  };

  const handleLike = async (commentId, isReply = false, parentId = null) => {
    const applyToggle = (prev) =>
      prev.map((c) => {
        if (isReply && parentId && c.id === parentId) {
          return {
            ...c,
            replies: c.replies.map((r) =>
              r.id === commentId
                ? { ...r, isLiked: !r.isLiked, likes: (r.likes ?? 0) + (r.isLiked ? -1 : 1) }
                : r
            ),
          };
        }
        if (!isReply && c.id === commentId) {
          return { ...c, isLiked: !c.isLiked, likes: (c.likes ?? 0) + (c.isLiked ? -1 : 1) };
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
      const target = isReply && parentId
        ? comments.find((c) => c.id === parentId)?.replies.find((r) => r.id === commentId)
        : comments.find((c) => c.id === commentId);
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

  const handleReply = (comment) => {
    setReplyTo(comment);
    inputRef.current?.focus();
  };

  const sortedComments = [...visibleComments].sort((a, b) => {
    switch (sortBy) {
      case 'newest':
        return new Date(b.createdAt) - new Date(a.createdAt);
      case 'best':
      default:
        return (b.likes ?? 0) - (a.likes ?? 0);
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
          className={`w-full max-w-2xl mx-auto max-h-[85vh] rounded-t-3xl backdrop-blur-2xl border-t shadow-2xl overflow-hidden flex flex-col ${
            isDark ? 'bg-[#080F2E]/95 border-white/12' : 'bg-white/95 border-gray-200'
          }`}
        >
          {/* Drag Handle */}
          <div className="w-full flex items-center justify-center pt-3 pb-1">
            <div className={`w-12 h-1.5 rounded-full ${isDark ? 'bg-white/20' : 'bg-gray-300'}`} />
          </div>

          {/* Header */}
          <div className={`flex items-center justify-between px-5 py-3 border-b ${isDark ? 'border-white/10' : 'border-gray-200'}`}>
            <div className="flex items-center gap-3">
              <h2 className={`${isDark ? 'text-white' : 'text-gray-900'} font-extrabold text-base tracking-tight`}>
                Comments
                <span className={`ml-2 text-xs font-semibold px-2 py-0.5 rounded-full ${
                  isDark ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30' : 'bg-purple-100 text-purple-700'
                }`}>
                  {visibleComments.length}
                </span>
              </h2>

              <div className={`flex items-center gap-1 p-0.5 rounded-xl border ${
                isDark ? 'bg-white/5 border-white/10' : 'bg-gray-100 border-gray-200'
              }`}>
                {['best', 'newest'].map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setSortBy(mode)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                      sortBy === mode
                        ? 'text-white shadow-sm'
                        : isDark ? 'text-white/60 hover:text-white' : 'text-gray-600 hover:text-gray-900'
                    }`}
                    style={sortBy === mode ? { background: BRAND_GRADIENT } : undefined}
                  >
                    {mode.charAt(0).toUpperCase() + mode.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
                isDark ? 'bg-white/5 hover:bg-white/10 text-white/70 hover:text-white' : 'bg-gray-100 hover:bg-gray-200 text-gray-600'
              }`}
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
                <span className={`text-xs font-medium ${isDark ? 'text-white/50' : 'text-gray-500'}`}>Loading conversations...</span>
              </div>
            ) : sortedComments.length === 0 ? (
              <div className="text-center py-12 flex flex-col items-center gap-2">
                <div className="w-12 h-12 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
                  <Sparkles className="w-6 h-6" />
                </div>
                <p className={`${isDark ? 'text-white/85' : 'text-gray-900'} font-bold text-sm`}>No comments yet</p>
                <p className={`${isDark ? 'text-white/50' : 'text-gray-500'} text-xs max-w-xs`}>
                  Be the first to share your thoughts with the creator!
                </p>
              </div>
            ) : (
              sortedComments.map((comment) => (
                <CommentItem
                  key={comment.id}
                  comment={comment}
                  isDark={isDark}
                  blockedUserIds={blockedUserIds}
                  onLike={(isReply, parentId) => handleLike(comment.id, isReply, parentId)}
                  onReply={() => handleReply(comment)}
                />
              ))
            )}
          </div>

          {/* Reply Indicator Bar */}
          {replyTo && (
            <div className={`px-5 py-2 border-t flex items-center justify-between ${
              isDark ? 'bg-purple-950/40 border-purple-500/20' : 'bg-purple-50 border-purple-200'
            }`}>
              <span className={`${isDark ? 'text-purple-200' : 'text-purple-800'} text-xs font-medium flex items-center gap-1.5 truncate`}>
                <Reply className="w-3.5 h-3.5 text-purple-400" />
                Replying to <span className={`font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{replyToLabel}</span>
              </span>
              <button
                type="button"
                onClick={() => setReplyTo(null)}
                className="text-purple-400 hover:text-purple-300 p-1 rounded-md"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Quick Reaction Emojis Ribbon */}
          <div className={`px-5 py-2 flex items-center gap-2 overflow-x-auto no-scrollbar border-t ${
            isDark ? 'border-white/5 bg-white/[0.02]' : 'border-gray-100 bg-gray-50/70'
          }`}>
            <span className={`text-[11px] font-bold uppercase tracking-wider flex-shrink-0 flex items-center gap-1 ${
              isDark ? 'text-white/40' : 'text-gray-400'
            }`}>
              <Smile className="w-3.5 h-3.5" /> React:
            </span>
            {EMOJI_PRESETS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => handleEmojiClick(emoji)}
                className={`px-2.5 py-1 rounded-full text-sm transition-transform hover:scale-110 active:scale-95 flex-shrink-0 ${
                  isDark ? 'bg-white/5 hover:bg-white/15' : 'bg-white hover:bg-gray-100 border border-gray-200'
                }`}
              >
                {emoji}
              </button>
            ))}
          </div>

          {/* Input Bar */}
          <div className={`p-4 border-t ${isDark ? 'border-white/10 bg-[#03071B]/95' : 'border-gray-200 bg-white'}`}>
            <div className="flex items-center gap-3">
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-xs shadow-md shrink-0"
                style={{ background: BRAND_GRADIENT }}
              >
                ✦
              </div>
              <div className="flex-1 relative flex items-center">
                <input
                  aria-label="Add a comment"
                  ref={inputRef}
                  type="text"
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                  placeholder={replyTo ? `Reply to ${replyToLabel}...` : 'Add a comment...'}
                  className={`w-full text-sm rounded-full pl-4 pr-12 py-2.5 focus:outline-none focus:ring-2 focus:ring-arvdoul-purple border transition-all ${
                    isDark
                      ? 'bg-white/10 text-white placeholder-white/40 border-white/10'
                      : 'bg-gray-100 text-gray-900 placeholder-gray-500 border-gray-200'
                  }`}
                  maxLength={500}
                />
                {newComment.length > 0 && (
                  <span className={`absolute right-3 text-[10px] font-mono ${isDark ? 'text-white/40' : 'text-gray-400'}`}>
                    {500 - newComment.length}
                  </span>
                )}
              </div>
              <motion.button
                type="button"
                whileTap={{ scale: 0.9 }}
                onClick={handleSubmit}
                disabled={!newComment.trim()}
                className="w-10 h-10 rounded-full flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed text-white shadow-lg shrink-0"
                style={{ background: BRAND_GRADIENT }}
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

const CommentItem = memo(({ comment, isDark, blockedUserIds, onLike, onReply }) => {
  const [showReplies, setShowReplies] = useState(false);
  const replies = (comment.replies || []).filter((r) => !blockedUserIds?.has(r.user?.id));
  const replyCount = replies.length;

  return (
    <div className="flex gap-3 group">
      <div
        className="w-9 h-9 rounded-full flex-shrink-0 flex items-center justify-center text-white font-bold text-xs ring-1 ring-white/20 shadow-md overflow-hidden"
        style={{ background: BRAND_GRADIENT }}
      >
        {comment.user.avatar ? (
          <LazyImage src={comment.user.avatar} alt={comment.user.name} className="w-full h-full rounded-full object-cover" />
        ) : (
          comment.user.name?.[0]?.toUpperCase() || '?'
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className={`${isDark ? 'text-white' : 'text-gray-900'} font-bold text-xs tracking-tight`}>
            {comment.user.username ? `@${comment.user.username}` : comment.user.name}
          </span>
          {comment.user.isCreator && (
            <span className="px-1.5 py-0.5 rounded-md bg-purple-500/20 text-purple-300 border border-purple-500/40 text-[9px] font-bold flex items-center gap-0.5">
              <Crown className="w-2.5 h-2.5" /> Creator
            </span>
          )}
          {comment.user.isVerified && (
            <BadgeCheck className="w-3.5 h-3.5 text-blue-400" />
          )}
          <span className={`${isDark ? 'text-white/40' : 'text-gray-400'} text-[11px] font-medium ml-auto`}>
            {formatTimeAgo(comment.createdAt)}
          </span>
        </div>

        <p className={`${isDark ? 'text-white/90' : 'text-gray-800'} text-sm mt-1 leading-relaxed break-words font-normal`}>
          {comment.text}
        </p>

        <div className="flex items-center gap-4 mt-2">
          <button
            type="button"
            onClick={() => onLike(false)}
            className={`flex items-center gap-1 transition-colors ${isDark ? 'text-white/50 hover:text-red-400' : 'text-gray-500 hover:text-red-500'}`}
          >
            <Heart
              className={`w-3.5 h-3.5 ${comment.isLiked ? 'fill-red-400 text-red-400 scale-110' : ''}`}
            />
            <span className="text-xs font-semibold">{comment.likes ?? '—'}</span>
          </button>

          <button
            type="button"
            onClick={onReply}
            className={`flex items-center gap-1 transition-colors text-xs font-semibold ${
              isDark ? 'text-white/50 hover:text-white' : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            <Reply className="w-3.5 h-3.5" />
            <span>Reply</span>
          </button>
        </div>

        {replyCount > 0 && (
          <button
            type="button"
            onClick={() => setShowReplies(!showReplies)}
            className="text-purple-400 hover:text-purple-300 text-xs font-bold mt-2.5 flex items-center gap-1.5"
          >
            <span className="w-4 h-[1px] bg-purple-400/50" />
            {showReplies ? 'Hide' : 'View'} {replyCount} {replyCount === 1 ? 'reply' : 'replies'}
          </button>
        )}

        <AnimatePresence>
          {showReplies && replyCount > 0 && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className={`mt-3 pl-3 border-l space-y-3 ${isDark ? 'border-white/10' : 'border-gray-200'}`}
            >
              {replies.map((reply) => (
                <div key={reply.id} className="flex gap-2.5">
                  <div
                    className="w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center text-white font-bold text-[10px]"
                    style={{ background: BRAND_GRADIENT }}
                  >
                    {reply.user.name?.[0]?.toUpperCase() || '?'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className={`${isDark ? 'text-white' : 'text-gray-900'} font-semibold text-xs`}>
                        {reply.user.username ? `@${reply.user.username}` : reply.user.name}
                      </span>
                      {reply.user.isCreator && (
                        <span className="px-1 py-0.5 rounded bg-purple-500/20 text-purple-300 text-[8px] font-bold">
                          Creator
                        </span>
                      )}
                      <span className={`${isDark ? 'text-white/40' : 'text-gray-400'} text-[10px] ml-auto`}>
                        {formatTimeAgo(reply.createdAt)}
                      </span>
                    </div>
                    <p className={`${isDark ? 'text-white/80' : 'text-gray-700'} text-xs mt-0.5 leading-relaxed break-words`}>
                      {reply.text}
                    </p>
                    <button
                      type="button"
                      onClick={() => onLike(true, comment.id)}
                      className={`flex items-center gap-1 transition-colors mt-1 ${
                        isDark ? 'text-white/50 hover:text-red-400' : 'text-gray-500 hover:text-red-500'
                      }`}
                    >
                      <Heart
                        className={`w-3 h-3 ${reply.isLiked ? 'fill-red-400 text-red-400' : ''}`}
                      />
                      <span className="text-[10px] font-semibold">{reply.likes ?? '—'}</span>
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
  isDark: PropTypes.bool,
  blockedUserIds: PropTypes.instanceOf(Set),
  onLike: PropTypes.func.isRequired,
  onReply: PropTypes.func.isRequired,
};

VideoComments.propTypes = {
  isOpen: PropTypes.bool,
  onClose: PropTypes.func.isRequired,
  video: PropTypes.object,
};

export default VideoComments;
