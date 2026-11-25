// src/components/Videos/VideoComments.jsx

import { useState, useEffect, useRef, useMemo, useCallback, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Heart, Reply, Send, BadgeCheck, Smile, Crown, Sparkles, Trash2, Pencil, Flag, Check, Loader2 } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { formatTimeAgo, SPRING_ANIMATION } from '../../utils/videoUtils';
import { getSafeAvatarUrl } from '../../utils/avatarUtils';
import { pickDisplayName, deriveHandle } from '../../services/profileReadModel.js';
import { BRAND_GRADIENT } from '../../design-system/tokens.js';
import { toast } from 'sonner';
import PropTypes from 'prop-types';
import { LazyImage } from '../../components/Shared/LazyImage';

const EMOJI_PRESETS = ['🔥', '❤️', '👏', '😂', '🚀', '💡', '💯', '🙌'];
const REPORT_REASONS = [
  { id: 'spam', label: 'Spam' },
  { id: 'harassment', label: 'Harassment' },
  { id: 'inappropriate', label: 'Inappropriate' },
];

/**
 * VideoComments - Canonical Spark & legacy video comments drawer
 */
const VideoComments = memo(({
  isOpen = false,
  onClose,
  video,
  onCommentAdded,
  onCommentDeleted,
}) => {
  const { isDark } = useTheme();
  const { user, userProfile } = useAuth();
  const inputRef = useRef(null);
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [replyTo, setReplyTo] = useState(null);
  const [expandedReplyParentId, setExpandedReplyParentId] = useState(null);
  const [loadingRepliesMap, setLoadingRepliesMap] = useState({});
  const [replyCursorMap, setReplyCursorMap] = useState({});
  const [sortBy, setSortBy] = useState('best');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [currentUid, setCurrentUid] = useState(null);
  const [blockedUserIds, setBlockedUserIds] = useState(new Set());

  const canonicalTargetId = video?.canonicalPostId || video?.id;
  const targetType = video?._sourceCollection === 'videos' && !video?.canonicalPostId
    ? 'legacy_video'
    : 'post';
  const creatorOwnerId = video?.userId || video?.authorId || video?.creatorId || video?.creator?.id || null;

  const currentUserAvatar = useMemo(() => {
    const uid = currentUid || user?.uid;
    if (!uid) return null;
    const rawPhoto = userProfile?.photoURL || user?.photoURL;
    const rawName = userProfile?.displayName || user?.displayName || userProfile?.username;
    return getSafeAvatarUrl(rawPhoto, rawName, uid);
  }, [currentUid, user?.uid, user?.photoURL, user?.displayName, userProfile?.photoURL, userProfile?.displayName, userProfile?.username]);

  const currentUserInitial = useMemo(() => {
    const name = pickDisplayName([userProfile?.displayName, user?.displayName, userProfile?.username], { fallback: null });
    return name ? name[0].toUpperCase() : '✦';
  }, [userProfile?.displayName, user?.displayName, userProfile?.username]);

  const replyToLabel = useMemo(
    () => (replyTo ? (replyTo.user.username ? `@${replyTo.user.username}` : replyTo.user.name) : ''),
    [replyTo]
  );

  const mapComment = useCallback((c, viewerUid) => {
    const mappedReplies = Array.isArray(c.replies) ? c.replies.map((r) => mapComment(r, viewerUid)) : [];
    const totalReplies = typeof c.repliesCount === 'number'
      ? c.repliesCount
      : (typeof c.replies === 'number' ? c.replies : mappedReplies.length);

    return {
      id: c.id,
      user: {
        id: c.userId,
        name: pickDisplayName([c.userName], { fallback: null }) || `user ${String(c.userId || '').slice(0, 6)}`,
        username: deriveHandle(c.userUsername),
        avatar: c.userAvatar || null,
        isVerified: !!c.isVerified,
        isCreator: Boolean(creatorOwnerId && c.userId === creatorOwnerId),
      },
      text: c.content || c.text || '',
      likes: typeof c.likes === 'number' ? c.likes : null,
      isLiked: Array.isArray(c.likesBy) && !!viewerUid && c.likesBy.includes(viewerUid),
      isEdited: Boolean(c.isEdited),
      repliesCount: Math.max(totalReplies, mappedReplies.length),
      createdAt: c.createdAt instanceof Date
        ? c.createdAt.toISOString()
        : new Date(c.createdAt || Date.now()).toISOString(),
      replies: mappedReplies,
    };
  }, [creatorOwnerId]);

  useEffect(() => {
    setComments([]);
    setReplyTo(null);
    setNewComment('');
    setExpandedReplyParentId(null);
    setLoadingRepliesMap({});
    setReplyCursorMap({});
  }, [canonicalTargetId]);

  useEffect(() => {
    if (!isOpen) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const { getAuthInstance } = await import('../../firebase/firebase.js');
        const auth = await getAuthInstance();
        const uid = auth?.currentUser?.uid || null;
        if (!cancelled) setCurrentUid(uid);
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
    if (!isOpen || !canonicalTargetId) return undefined;
    let cancelled = false;

    const loadComments = async () => {
      setLoading(true);
      try {
        const { getAuthInstance } = await import('../../firebase/firebase.js');
        const auth = await getAuthInstance();
        const viewerUid = auth?.currentUser?.uid || null;
        if (!cancelled) setCurrentUid(viewerUid);
        const { getCommentService } = await import('../../services/commentService.js');
        const res = await getCommentService().getCommentsByPost(canonicalTargetId, {
          nested: true,
          limit: 50,
          cacheFirst: false,
          viewerId: viewerUid,
        });
        if (cancelled) return;
        setComments((res.comments || []).map((c) => mapComment(c, viewerUid)));
      } catch (err) {
        if (!cancelled) {
          console.error('Failed to load comments:', err);
          toast.error('Failed to load comments');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadComments();
    return () => { cancelled = true; };
  }, [isOpen, canonicalTargetId, mapComment]);

  const handleLoadReplies = useCallback(async (parentCommentId, { reset = false } = {}) => {
    if (!parentCommentId || String(parentCommentId).startsWith('local_')) return;
    setLoadingRepliesMap((prev) => ({ ...prev, [parentCommentId]: true }));
    try {
      const { getAuthInstance } = await import('../../firebase/firebase.js');
      const auth = await getAuthInstance();
      const viewerUid = auth?.currentUser?.uid || null;
      const { getCommentService } = await import('../../services/commentService.js');
      const cursor = reset ? null : replyCursorMap[parentCommentId];
      const res = await getCommentService().getReplies(parentCommentId, {
        viewerId: viewerUid,
        limit: 20,
        ...(cursor ? { startAfter: cursor } : {}),
      });
      if (res?.success) {
        const fetched = (res.replies || []).map((r) => mapComment(r, viewerUid));
        setComments((prev) =>
          prev.map((c) => {
            if (c.id !== parentCommentId) return c;
            const existing = reset ? [] : (c.replies || []);
            const seen = new Set(existing.map((item) => item.id));
            const merged = [...existing, ...fetched.filter((item) => !seen.has(item.id))];
            const serverTotal = typeof res.total === 'number' ? res.total : merged.length;
            return {
              ...c,
              replies: merged,
              repliesCount: Math.max(serverTotal, merged.length),
            };
          })
        );
        setReplyCursorMap((prev) => ({
          ...prev,
          [parentCommentId]: res.hasMore ? res.nextCursor : null,
        }));
      }
    } catch (err) {
      toast.error(err?.message || 'Could not load replies');
    } finally {
      setLoadingRepliesMap((prev) => ({ ...prev, [parentCommentId]: false }));
    }
  }, [mapComment, replyCursorMap]);

  const handleSubmit = async () => {
    if (!newComment.trim() || !canonicalTargetId || submitting) return;

    const textToSend = newComment.trim();
    const targetReply = replyTo;
    setSubmitting(true);

    try {
      const { getCommentService } = await import('../../services/commentService.js');
      const { getAuthInstance } = await import('../../firebase/firebase.js');
      const auth = await getAuthInstance();
      const uid = auth?.currentUser?.uid;
      if (!uid) throw new Error('You must be signed in to comment');

      const authorName = pickDisplayName([userProfile?.displayName, auth.currentUser.displayName, userProfile?.username], { fallback: null })
        || `user ${String(uid).slice(0, 6)}`;
      const authorHandle = deriveHandle(userProfile?.username || auth.currentUser.username || auth.currentUser.email);
      const authorAvatar = userProfile?.photoURL || auth.currentUser.photoURL || null;

      const res = targetReply
        ? await getCommentService().replyToComment(
            targetReply.id,
            uid,
            textToSend,
            {
              userName: authorName,
              userUsername: authorHandle || authorName,
              userAvatar: authorAvatar,
              targetType,
            }
          )
        : await getCommentService().createComment(
            canonicalTargetId,
            uid,
            textToSend,
            {
              userName: authorName,
              userUsername: authorHandle || authorName,
              userAvatar: authorAvatar,
              targetType,
            }
          );

      if (res?.success === false && !res?.offlineQueued) {
        throw new Error(res.error || 'Failed to post comment');
      }

      const persistedId = res?.commentId || res?.comment?.id || `local_${Date.now()}`;
      const postedItem = {
        id: persistedId,
        user: {
          id: uid,
          name: authorName,
          username: authorHandle,
          avatar: authorAvatar,
          isVerified: Boolean(userProfile?.isVerified),
          isCreator: Boolean(creatorOwnerId && uid === creatorOwnerId),
        },
        text: textToSend,
        likes: 0,
        isLiked: false,
        isEdited: false,
        repliesCount: 0,
        createdAt: new Date().toISOString(),
        replies: [],
        _pending: Boolean(res?.offlineQueued),
        ...(targetReply && { replyTo: targetReply.id }),
      };

      if (targetReply) {
        setComments((prev) =>
          prev.map((c) => {
            if (c.id !== targetReply.id) return c;
            const nextReplies = [...(c.replies || []), postedItem];
            return {
              ...c,
              replies: nextReplies,
              repliesCount: Math.max((c.repliesCount ?? 0) + 1, nextReplies.length),
            };
          })
        );
        setExpandedReplyParentId(targetReply.id);
      } else {
        setComments((prev) => [postedItem, ...prev]);
      }

      setNewComment('');
      setReplyTo(null);
      onCommentAdded?.(canonicalTargetId);
      toast.success(targetReply ? 'Reply sent!' : 'Comment posted!');
    } catch (err) {
      console.error('Failed to post comment:', err);
      toast.error(err.message || 'Failed to post comment');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEmojiClick = (emoji) => {
    setNewComment((prev) => prev + emoji);
    inputRef.current?.focus();
  };

  const handleLike = async (commentId, isReply = false, parentId = null) => {
    if (!commentId) return;
    if (String(commentId).startsWith('local_')) {
      toast.info('This comment is still syncing');
      return;
    }

    const currentTarget = isReply && parentId
      ? comments.find((c) => c.id === parentId)?.replies?.find((r) => r.id === commentId)
      : comments.find((c) => c.id === commentId);

    if (!currentTarget) return;
    const wasLiked = Boolean(currentTarget.isLiked);

    const applyToggle = (prev, nextLiked) =>
      prev.map((c) => {
        if (isReply && parentId && c.id === parentId) {
          return {
            ...c,
            replies: (c.replies || []).map((r) =>
              r.id === commentId
                ? { ...r, isLiked: nextLiked, likes: Math.max(0, (r.likes ?? 0) + (nextLiked ? 1 : -1)) }
                : r
            ),
          };
        }
        if (!isReply && c.id === commentId) {
          return { ...c, isLiked: nextLiked, likes: Math.max(0, (c.likes ?? 0) + (nextLiked ? 1 : -1)) };
        }
        return c;
      });

    setComments((prev) => applyToggle(prev, !wasLiked));

    try {
      const { getCommentService } = await import('../../services/commentService.js');
      const { getAuthInstance } = await import('../../firebase/firebase.js');
      const auth = await getAuthInstance();
      const uid = auth?.currentUser?.uid;
      if (!uid) {
        setComments((prev) => applyToggle(prev, wasLiked));
        toast.error('Sign in to like comments');
        return;
      }
      if (!wasLiked) {
        await getCommentService().likeComment(commentId, uid);
      } else {
        await getCommentService().removeLikeDislike(commentId, uid);
      }
    } catch (err) {
      setComments((prev) => applyToggle(prev, wasLiked));
      console.error('Failed to like comment:', err);
      toast.error('Could not update reaction');
    }
  };

  const handleEdit = async (commentId, nextText, isReply = false, parentId = null) => {
    const trimmed = nextText?.trim();
    if (!commentId || !trimmed) return false;
    if (String(commentId).startsWith('local_')) {
      toast.info('This comment is still syncing');
      return false;
    }

    const prevItem = isReply && parentId
      ? comments.find((c) => c.id === parentId)?.replies?.find((r) => r.id === commentId)
      : comments.find((c) => c.id === commentId);
    if (!prevItem || prevItem.text === trimmed) return true;

    const patchText = (textVal, editedFlag) => {
      setComments((prev) =>
        prev.map((c) => {
          if (isReply && parentId && c.id === parentId) {
            return {
              ...c,
              replies: (c.replies || []).map((r) =>
                r.id === commentId ? { ...r, text: textVal, isEdited: editedFlag } : r
              ),
            };
          }
          if (!isReply && c.id === commentId) {
            return { ...c, text: textVal, isEdited: editedFlag };
          }
          return c;
        })
      );
    };

    patchText(trimmed, true);

    try {
      const { getAuthInstance } = await import('../../firebase/firebase.js');
      const auth = await getAuthInstance();
      const uid = auth?.currentUser?.uid;
      if (!uid) throw new Error('Sign in to edit comments');
      const { getCommentService } = await import('../../services/commentService.js');
      await getCommentService().updateComment(commentId, uid, { content: trimmed });
      toast.success('Comment updated');
      return true;
    } catch (err) {
      patchText(prevItem.text, prevItem.isEdited);
      toast.error(err?.message || 'Could not update comment');
      return false;
    }
  };

  const handleReportComment = async (commentId, reason) => {
    if (!commentId || !reason) return false;
    if (String(commentId).startsWith('local_')) {
      toast.info('This comment is still syncing');
      return false;
    }
    try {
      const { getAuthInstance } = await import('../../firebase/firebase.js');
      const auth = await getAuthInstance();
      const uid = auth?.currentUser?.uid;
      if (!uid) {
        toast.error('Sign in to report comments');
        return false;
      }
      const { getCommentService } = await import('../../services/commentService.js');
      await getCommentService().reportComment(commentId, uid, reason);
      toast.success('Report submitted. Thank you for helping keep Arvdoul safe.');
      return true;
    } catch (err) {
      toast.error(err?.message || 'Could not submit report');
      return false;
    }
  };

  const handleDelete = async (commentId, isReply = false, parentId = null) => {
    if (!commentId) return;
    try {
      const { getAuthInstance } = await import('../../firebase/firebase.js');
      const auth = await getAuthInstance();
      const uid = auth?.currentUser?.uid;
      if (!uid) return;
      if (!String(commentId).startsWith('local_')) {
        const { getCommentService } = await import('../../services/commentService.js');
        await getCommentService().deleteComment(commentId, uid);
      }
      setComments((prev) => {
        if (isReply && parentId) {
          return prev.map((c) => {
            if (c.id !== parentId) return c;
            const nextReplies = (c.replies || []).filter((r) => r.id !== commentId);
            return {
              ...c,
              replies: nextReplies,
              repliesCount: Math.max(0, Math.min(c.repliesCount ?? nextReplies.length, (c.repliesCount ?? 1) - 1)),
            };
          });
        }
        return prev.filter((c) => c.id !== commentId);
      });
      onCommentDeleted?.(canonicalTargetId);
      toast.success('Comment deleted');
    } catch (err) {
      toast.error(err?.message || 'Could not delete comment');
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
        className="fixed inset-0 z-[120] bg-black/60 backdrop-blur-sm flex justify-end flex-col"
        onClick={onClose}
      >
        <motion.div
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={SPRING_ANIMATION.bottomSheet}
          onClick={(e) => e.stopPropagation()}
          className={`w-full max-w-2xl mx-auto max-h-[85vh] rounded-t-3xl backdrop-blur-2xl border-t shadow-2xl overflow-hidden flex flex-col ${
            isDark ? 'bg-[#03071B]/95 border-white/12 text-white' : 'bg-[#F6F8FC]/95 border-slate-200 text-slate-900'
          }`}
        >
          {/* Drag Handle */}
          <div className="w-full flex items-center justify-center pt-3 pb-1">
            <div className={`w-12 h-1.5 rounded-full ${isDark ? 'bg-white/20' : 'bg-slate-300'}`} />
          </div>

          {/* Header */}
          <div className={`flex items-center justify-between px-5 py-3 border-b ${isDark ? 'border-white/10' : 'border-slate-200'}`}>
            <div className="flex items-center gap-3">
              <h2 className={`${isDark ? 'text-white' : 'text-slate-900'} font-extrabold text-base tracking-tight`}>
                Comments
                <span className={`ml-2 text-xs font-semibold px-2 py-0.5 rounded-full ${
                  isDark ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30' : 'bg-purple-100 text-purple-700'
                }`}>
                  {visibleComments.length}
                </span>
              </h2>

              <div className={`flex items-center gap-1 p-0.5 rounded-xl border ${
                isDark ? 'bg-white/5 border-white/10' : 'bg-white border-slate-200'
              }`}>
                {['best', 'newest'].map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setSortBy(mode)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                      sortBy === mode
                        ? 'text-white shadow-sm'
                        : isDark ? 'text-white/60 hover:text-white' : 'text-slate-600 hover:text-slate-900'
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
                isDark ? 'bg-white/5 hover:bg-white/10 text-white/70 hover:text-white' : 'bg-slate-200/70 hover:bg-slate-200 text-slate-700'
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
                <span className={`text-xs font-medium ${isDark ? 'text-white/50' : 'text-slate-500'}`}>Loading conversations...</span>
              </div>
            ) : sortedComments.length === 0 ? (
              <div className="text-center py-12 flex flex-col items-center gap-2">
                <div className="w-12 h-12 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
                  <Sparkles className="w-6 h-6" />
                </div>
                <p className={`${isDark ? 'text-white/85' : 'text-slate-900'} font-bold text-sm`}>No comments yet</p>
                <p className={`${isDark ? 'text-white/50' : 'text-slate-500'} text-xs max-w-xs`}>
                  Be the first to share your thoughts with the creator!
                </p>
              </div>
            ) : (
              sortedComments.map((comment) => (
                <CommentItem
                  key={comment.id}
                  comment={comment}
                  isDark={isDark}
                  currentUid={currentUid}
                  forceExpandReplies={expandedReplyParentId === comment.id}
                  loadingReplies={Boolean(loadingRepliesMap[comment.id])}
                  hasMoreReplies={Boolean(replyCursorMap[comment.id]) || ((comment.repliesCount || 0) > (comment.replies?.length || 0))}
                  blockedUserIds={blockedUserIds}
                  onLike={handleLike}
                  onReply={() => handleReply(comment)}
                  onEdit={handleEdit}
                  onReport={handleReportComment}
                  onDelete={handleDelete}
                  onLoadReplies={handleLoadReplies}
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
                Replying to <span className={`font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>{replyToLabel}</span>
              </span>
              <button
                type="button"
                onClick={() => setReplyTo(null)}
                aria-label="Cancel reply"
                className="text-purple-400 hover:text-purple-300 p-1 rounded-md"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Quick Reaction Emojis Ribbon */}
          <div className={`px-5 py-2 flex items-center gap-2 overflow-x-auto no-scrollbar border-t ${
            isDark ? 'border-white/5 bg-white/[0.02]' : 'border-slate-200/70 bg-white/60'
          }`}>
            <span className={`text-[11px] font-bold uppercase tracking-wider flex-shrink-0 flex items-center gap-1 ${
              isDark ? 'text-white/40' : 'text-slate-500'
            }`}>
              <Smile className="w-3.5 h-3.5" /> React:
            </span>
            {EMOJI_PRESETS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => handleEmojiClick(emoji)}
                className={`px-2.5 py-1 rounded-full text-sm transition-transform hover:scale-110 active:scale-95 flex-shrink-0 ${
                  isDark ? 'bg-white/5 hover:bg-white/15' : 'bg-white hover:bg-slate-100 border border-slate-200'
                }`}
              >
                {emoji}
              </button>
            ))}
          </div>

          {/* Input Bar */}
          <div className={`p-4 pb-[max(1rem,env(safe-area-inset-bottom))] border-t ${isDark ? 'border-white/10 bg-[#03071B]/95' : 'border-slate-200 bg-white'}`}>
            <div className="flex items-center gap-3">
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-xs shadow-md shrink-0 overflow-hidden"
                style={{ background: BRAND_GRADIENT }}
              >
                {currentUserAvatar ? (
                  <LazyImage src={currentUserAvatar} alt="Your avatar" className="w-full h-full object-cover" />
                ) : (
                  currentUserInitial
                )}
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
                      : 'bg-slate-100 text-slate-900 placeholder-slate-500 border-slate-200'
                  }`}
                  maxLength={500}
                />
                {newComment.length > 0 && (
                  <span className={`absolute right-3 text-[10px] font-mono ${isDark ? 'text-white/40' : 'text-slate-400'}`}>
                    {500 - newComment.length}
                  </span>
                )}
              </div>
              <motion.button
                type="button"
                whileTap={{ scale: 0.9 }}
                onClick={handleSubmit}
                disabled={!newComment.trim() || submitting}
                className="w-10 h-10 rounded-full flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed text-white shadow-lg shrink-0"
                style={{ background: BRAND_GRADIENT }}
                aria-label="Send comment"
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4 translate-x-0.5" />}
              </motion.button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
});

VideoComments.displayName = 'VideoComments';

const CommentItem = memo(({
  comment,
  isDark,
  currentUid,
  forceExpandReplies = false,
  loadingReplies = false,
  hasMoreReplies = false,
  blockedUserIds,
  onLike,
  onReply,
  onEdit,
  onReport,
  onDelete,
  onLoadReplies,
}) => {
  const [showReplies, setShowReplies] = useState(forceExpandReplies);
  const [editingId, setEditingId] = useState(null);
  const [editDraft, setEditDraft] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);
  const [reportingId, setReportingId] = useState(null);

  useEffect(() => {
    if (forceExpandReplies) setShowReplies(true);
  }, [forceExpandReplies]);

  const replies = (comment.replies || []).filter((r) => !blockedUserIds?.has(r.user?.id));
  const replyCount = Math.max(replies.length, comment.repliesCount || 0);
  const isCommentOwner = Boolean(currentUid && comment.user?.id === currentUid);

  const startEdit = (item) => {
    setEditingId(item.id);
    setEditDraft(item.text || '');
    setReportingId(null);
  };

  const submitEdit = async (targetId, isReply = false) => {
    if (!editDraft.trim() || savingEdit) return;
    setSavingEdit(true);
    const ok = await onEdit(targetId, editDraft, isReply, isReply ? comment.id : null);
    setSavingEdit(false);
    if (ok) {
      setEditingId(null);
      setEditDraft('');
    }
  };

  const toggleReplies = async () => {
    const next = !showReplies;
    setShowReplies(next);
    if (next && replies.length === 0 && replyCount > 0) {
      await onLoadReplies?.(comment.id, { reset: true });
    }
  };

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
          <span className={`${isDark ? 'text-white' : 'text-slate-900'} font-bold text-xs tracking-tight`}>
            {comment.user.username ? `@${comment.user.username}` : comment.user.name}
          </span>
          {comment.user.isCreator && (
            <span className={`px-1.5 py-0.5 rounded-md border text-[9px] font-bold flex items-center gap-0.5 ${
              isDark ? 'bg-purple-500/20 text-purple-300 border-purple-500/40' : 'bg-purple-100 text-purple-700 border-purple-200'
            }`}>
              <Crown className="w-2.5 h-2.5" /> Creator
            </span>
          )}
          {comment.user.isVerified && (
            <BadgeCheck className="w-3.5 h-3.5 text-blue-400" />
          )}
          {comment.isEdited && (
            <span className={`text-[10px] font-medium ${isDark ? 'text-white/40' : 'text-slate-400'}`}>
              (edited)
            </span>
          )}
          <span className={`${isDark ? 'text-white/40' : 'text-slate-400'} text-[11px] font-medium ml-auto`}>
            {formatTimeAgo(comment.createdAt)}
          </span>
        </div>

        {editingId === comment.id ? (
          <div className="mt-1.5 flex items-center gap-2">
            <input
              type="text"
              value={editDraft}
              onChange={(e) => setEditDraft(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submitEdit(comment.id, false)}
              maxLength={500}
              aria-label="Edit comment"
              className={`flex-1 text-xs rounded-xl px-3 py-1.5 border focus:outline-none focus:ring-2 focus:ring-arvdoul-purple ${
                isDark ? 'bg-white/10 border-white/15 text-white' : 'bg-white border-slate-300 text-slate-900'
              }`}
            />
            <button
              type="button"
              disabled={savingEdit || !editDraft.trim()}
              onClick={() => submitEdit(comment.id, false)}
              aria-label="Save edited comment"
              className="p-1.5 rounded-lg text-white disabled:opacity-50"
              style={{ background: BRAND_GRADIENT }}
            >
              <Check className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setEditingId(null)}
              aria-label="Cancel edit"
              className={`p-1.5 rounded-lg ${isDark ? 'bg-white/10 text-white/70' : 'bg-slate-200 text-slate-600'}`}
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <p className={`${isDark ? 'text-white/90' : 'text-slate-800'} text-sm mt-1 leading-relaxed break-words font-normal`}>
            {comment.text}
          </p>
        )}

        <div className="flex items-center gap-4 mt-2">
          <button
            type="button"
            onClick={() => onLike(comment.id, false, null)}
            className={`flex items-center gap-1 transition-colors ${isDark ? 'text-white/50 hover:text-red-400' : 'text-slate-500 hover:text-red-500'}`}
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
              isDark ? 'text-white/50 hover:text-white' : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            <Reply className="w-3.5 h-3.5" />
            <span>Reply</span>
          </button>

          {isCommentOwner ? (
            <div className="flex items-center gap-3 ml-auto">
              <button
                type="button"
                onClick={() => startEdit(comment)}
                aria-label="Edit comment"
                className={`flex items-center gap-1 transition-colors text-xs font-semibold ${
                  isDark ? 'text-white/40 hover:text-white' : 'text-slate-400 hover:text-slate-800'
                }`}
              >
                <Pencil className="w-3 h-3" />
                <span>Edit</span>
              </button>
              <button
                type="button"
                onClick={() => onDelete(comment.id, false, null)}
                aria-label="Delete comment"
                className={`flex items-center gap-1 transition-colors text-xs font-semibold ${
                  isDark ? 'text-white/40 hover:text-red-400' : 'text-slate-400 hover:text-red-600'
                }`}
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete</span>
              </button>
            </div>
          ) : currentUid ? (
            <button
              type="button"
              onClick={() => setReportingId((prev) => (prev === comment.id ? null : comment.id))}
              aria-label="Report comment"
              className={`flex items-center gap-1 transition-colors text-xs font-semibold ml-auto ${
                isDark ? 'text-white/40 hover:text-amber-300' : 'text-slate-400 hover:text-amber-600'
              }`}
            >
              <Flag className="w-3 h-3" />
              <span>Report</span>
            </button>
          ) : null}
        </div>

        {reportingId === comment.id && (
          <div className={`mt-2 p-2 rounded-xl border flex flex-wrap items-center gap-1.5 ${
            isDark ? 'bg-white/5 border-white/10' : 'bg-white border-slate-200'
          }`}>
            <span className={`text-[11px] font-semibold mr-1 ${isDark ? 'text-white/60' : 'text-slate-600'}`}>Reason:</span>
            {REPORT_REASONS.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={async () => {
                  await onReport(comment.id, r.id);
                  setReportingId(null);
                }}
                className={`px-2 py-0.5 rounded-lg text-[11px] font-semibold transition-colors ${
                  isDark ? 'bg-white/10 hover:bg-amber-500/20 text-white' : 'bg-slate-100 hover:bg-amber-50 text-slate-800'
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
        )}

        {replyCount > 0 && (
          <button
            type="button"
            onClick={toggleReplies}
            className={`text-xs font-bold mt-2.5 flex items-center gap-1.5 ${
              isDark ? 'text-purple-400 hover:text-purple-300' : 'text-purple-600 hover:text-purple-700'
            }`}
          >
            <span className="w-4 h-[1px] bg-purple-400/50" />
            {showReplies ? 'Hide' : 'View'} {replyCount} {replyCount === 1 ? 'reply' : 'replies'}
          </button>
        )}

        <AnimatePresence>
          {showReplies && (replies.length > 0 || loadingReplies) && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className={`mt-3 pl-3 border-l space-y-3 ${isDark ? 'border-white/10' : 'border-slate-200'}`}
            >
              {replies.map((reply) => {
                const isReplyOwner = Boolean(currentUid && reply.user?.id === currentUid);
                return (
                  <div key={reply.id} className="flex gap-2.5">
                    <div
                      className="w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center text-white font-bold text-[10px] overflow-hidden"
                      style={{ background: BRAND_GRADIENT }}
                    >
                      {reply.user.avatar ? (
                        <LazyImage src={reply.user.avatar} alt={reply.user.name} className="w-full h-full rounded-full object-cover" />
                      ) : (
                        reply.user.name?.[0]?.toUpperCase() || '?'
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className={`${isDark ? 'text-white' : 'text-slate-900'} font-semibold text-xs`}>
                          {reply.user.username ? `@${reply.user.username}` : reply.user.name}
                        </span>
                        {reply.user.isCreator && (
                          <span className={`px-1 py-0.5 rounded text-[8px] font-bold ${
                            isDark ? 'bg-purple-500/20 text-purple-300' : 'bg-purple-100 text-purple-700'
                          }`}>
                            Creator
                          </span>
                        )}
                        {reply.isEdited && (
                          <span className={`text-[9px] ${isDark ? 'text-white/40' : 'text-slate-400'}`}>(edited)</span>
                        )}
                        <span className={`${isDark ? 'text-white/40' : 'text-slate-400'} text-[10px] ml-auto`}>
                          {formatTimeAgo(reply.createdAt)}
                        </span>
                      </div>

                      {editingId === reply.id ? (
                        <div className="mt-1 flex items-center gap-1.5">
                          <input
                            type="text"
                            value={editDraft}
                            onChange={(e) => setEditDraft(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && submitEdit(reply.id, true)}
                            maxLength={500}
                            aria-label="Edit reply"
                            className={`flex-1 text-xs rounded-lg px-2.5 py-1 border focus:outline-none focus:ring-2 focus:ring-arvdoul-purple ${
                              isDark ? 'bg-white/10 border-white/15 text-white' : 'bg-white border-slate-300 text-slate-900'
                            }`}
                          />
                          <button
                            type="button"
                            disabled={savingEdit || !editDraft.trim()}
                            onClick={() => submitEdit(reply.id, true)}
                            aria-label="Save edited reply"
                            className="p-1 rounded-md text-white disabled:opacity-50"
                            style={{ background: BRAND_GRADIENT }}
                          >
                            <Check className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingId(null)}
                            aria-label="Cancel reply edit"
                            className={`p-1 rounded-md ${isDark ? 'bg-white/10 text-white/70' : 'bg-slate-200 text-slate-600'}`}
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ) : (
                        <p className={`${isDark ? 'text-white/80' : 'text-slate-700'} text-xs mt-0.5 leading-relaxed break-words`}>
                          {reply.text}
                        </p>
                      )}

                      <div className="flex items-center gap-3 mt-1">
                        <button
                          type="button"
                          onClick={() => onLike(reply.id, true, comment.id)}
                          className={`flex items-center gap-1 transition-colors ${
                            isDark ? 'text-white/50 hover:text-red-400' : 'text-slate-500 hover:text-red-500'
                          }`}
                        >
                          <Heart
                            className={`w-3 h-3 ${reply.isLiked ? 'fill-red-400 text-red-400' : ''}`}
                          />
                          <span className="text-[10px] font-semibold">{reply.likes ?? '—'}</span>
                        </button>
                        {isReplyOwner ? (
                          <>
                            <button
                              type="button"
                              onClick={() => startEdit(reply)}
                              aria-label="Edit reply"
                              className={`text-[10px] font-semibold transition-colors ${
                                isDark ? 'text-white/40 hover:text-white' : 'text-slate-400 hover:text-slate-800'
                              }`}
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => onDelete(reply.id, true, comment.id)}
                              aria-label="Delete reply"
                              className={`text-[10px] font-semibold transition-colors ${
                                isDark ? 'text-white/40 hover:text-red-400' : 'text-slate-400 hover:text-red-600'
                              }`}
                            >
                              Delete
                            </button>
                          </>
                        ) : currentUid ? (
                          <button
                            type="button"
                            onClick={() => setReportingId((prev) => (prev === reply.id ? null : reply.id))}
                            aria-label="Report reply"
                            className={`text-[10px] font-semibold transition-colors ${
                              isDark ? 'text-white/40 hover:text-amber-300' : 'text-slate-400 hover:text-amber-600'
                            }`}
                          >
                            Report
                          </button>
                        ) : null}
                      </div>

                      {reportingId === reply.id && (
                        <div className={`mt-1.5 p-1.5 rounded-lg border flex flex-wrap items-center gap-1 ${
                          isDark ? 'bg-white/5 border-white/10' : 'bg-white border-slate-200'
                        }`}>
                          {REPORT_REASONS.map((r) => (
                            <button
                              key={r.id}
                              type="button"
                              onClick={async () => {
                                await onReport(reply.id, r.id);
                                setReportingId(null);
                              }}
                              className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                                isDark ? 'bg-white/10 hover:bg-amber-500/20 text-white' : 'bg-slate-100 hover:bg-amber-50 text-slate-800'
                              }`}
                            >
                              {r.label}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}

              {loadingReplies && (
                <div className="flex items-center gap-2 py-1 text-xs text-purple-400">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Loading replies...</span>
                </div>
              )}

              {!loadingReplies && hasMoreReplies && (
                <button
                  type="button"
                  onClick={() => onLoadReplies?.(comment.id, { reset: replies.length === 0 })}
                  className={`text-[11px] font-semibold ${
                    isDark ? 'text-purple-400 hover:text-purple-300' : 'text-purple-600 hover:text-purple-700'
                  }`}
                >
                  Load more replies
                </button>
              )}
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
  currentUid: PropTypes.string,
  forceExpandReplies: PropTypes.bool,
  loadingReplies: PropTypes.bool,
  hasMoreReplies: PropTypes.bool,
  blockedUserIds: PropTypes.instanceOf(Set),
  onLike: PropTypes.func.isRequired,
  onReply: PropTypes.func.isRequired,
  onEdit: PropTypes.func.isRequired,
  onReport: PropTypes.func.isRequired,
  onDelete: PropTypes.func.isRequired,
  onLoadReplies: PropTypes.func,
};

VideoComments.propTypes = {
  isOpen: PropTypes.bool,
  onClose: PropTypes.func.isRequired,
  video: PropTypes.object,
  onCommentAdded: PropTypes.func,
  onCommentDeleted: PropTypes.func,
};

export default VideoComments;
