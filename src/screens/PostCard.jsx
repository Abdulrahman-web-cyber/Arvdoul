// src/screens/PostCard.jsx
//
// Perfect rounded edges, compact height, larger avatar, bubble counts, all bugs fixed.

import React, { useState, useEffect, useRef, useCallback, useMemo, useReducer } from 'react';
import { readLocalLikes, setLocalLike } from '../utils/localContentCache.js';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { useTheme } from '../context/ThemeContext';
import firestoreService from '../services/firestoreService';
import { trackAnalyticsEvent } from '../services/analyticsService';
import commentService from '../services/commentService';
import * as userService from '../services/userService';
import * as monetizationService from '../services/monetizationService';
import notificationService from '../services/notificationsService';
import { triggerHaptic } from '../utils/haptics';
import { formatDistanceToNow } from 'date-fns';
import { Heart, MessageCircle, Share2, Bookmark, MoreHorizontal, Gift, MapPin, Globe, CheckCircle, Zap, Crown, TrendingUp, Sparkles, BarChart3, Coins, Send, AlertTriangle, Shield, Download, RefreshCw, Quote, PlusCircle, Copy, X, Users, ShoppingBag, ExternalLink } from "lucide-react";
import { FaHeart, FaWhatsapp, FaTelegram, FaTwitter, FaFacebook, FaInstagram } from 'react-icons/fa6';

// Sub‑cards
import TextCard from './PostCard/TextCard';
import ImageCard from './PostCard/ImageCard';
import VideoCard from './PostCard/VideoCard';
import AudioCard from './PostCard/AudioCard';
import PollCard from './PostCard/PollCard';
import QuestionCard from './PostCard/QuestionCard';
import EventCard from './PostCard/EventCard';
import LinkCard from './PostCard/LinkCard';
import { VIRTUAL_GIFTS } from '../data/videoData';

const cn = (...classes) => classes.filter(Boolean).join(' ');

// 1. DESIGN TOKENS – Perfectly rounded, compact, neon purple
const getDesignTokens = (theme) => {
  const isDark = theme === 'dark';
  return {
    primary: isDark ? '#8B5CF6' : '#3B82F6',
    secondary: isDark ? '#A78BFA' : '#60A5FA',
    accent: '#FF2D55',
    gold: '#D4AF37',
    surface: isDark ? '#121217' : '#FFFFFF',
    border: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.06)',
    text: isDark ? '#FFFFFF' : '#0F172A',
    textMuted: isDark ? '#9CA3AF' : '#475569',
    textSecondary: isDark ? '#6B7280' : '#64748B',
    cardBg: isDark ? '#121217' : '#FFFFFF',
    cardBgAlt: isDark ? '#1A1A24' : '#F8FAFC',
    overlayBg: isDark ? 'rgba(0,0,0,0.7)' : 'rgba(0,0,0,0.4)',
    overlayPanel: isDark ? '#1f1f2b' : '#FFFFFF',
    overlayPanelBorder: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
    actionBarBg: 'linear-gradient(135deg, #9333ea, #c026d3, #06b6d4)',
    shadowDirectional: isDark
      ? '0 20px 35px -12px rgba(0,0,0,0.6), 0 2px 8px rgba(0,0,0,0.2)'
      : '0 20px 35px -12px rgba(0,0,0,0.15), 0 2px 8px rgba(0,0,0,0.05)',
    neonPurple: 'linear-gradient(135deg, #9333ea, #c026d3, #06b6d4)',
    actionBarGlow: '0 0 12px rgba(236, 72, 153, 0.4), 0 0 20px rgba(147, 51, 234, 0.3)',
  };
};

// 3. OFFLINE QUEUE — the canonical `syncEngine`/`OfflineQueue` singleton owns
// persistence and replay. PostCard previously opened its OWN IndexedDB under the
// canonical queue's database name at version 5 (the canonical queue opens it at
// version 1). In a real browser the second open fails with a VersionError, so
// every queued like/reaction/save silently vanished and the canonical queue
// could never be opened at all. Route everything through the canonical engine.

async function addToOfflineQueue(action, data) {
  const { enqueueAction } = await import('../offline/syncEngine.js');
  const typeByAction = {
    like: 'post.like',
    unlike: 'post.unlike',
    save: 'post.save',
    unsave: 'post.unsave',
    reaction: 'post.reaction',
    removeReaction: 'post.removeReaction',
  };
  const type = typeByAction[action];
  if (!type) return;
  await enqueueAction({
    type,
    payload: { postId: data.postId, userId: data.userId, reaction: data.reaction },
    priority: 'high',
    ownerUid: data.userId || null,
  });
}

// 4. ERROR BOUNDARY (dev/prod friendly)
class PostErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { hasError: false, error: null }; }
  static getDerivedStateFromError(error) { return { hasError: true, error }; }
  componentDidCatch(error, errorInfo) {
    if (process.env.NODE_ENV === 'development') {
      console.error('PostCard crashed:', error, errorInfo);
    } else {
      console.warn('PostCard error:', error.message);
    }
  }
  handleRetry = () => { this.setState({ hasError: false, error: null }); this.props.onRetry?.(); };
  render() {
    if (this.state.hasError) {
      return (
        <div className="rounded-3xl p-6 text-center bg-red-500/10 my-2">
          <AlertTriangle className="w-10 h-10 text-red-500 mx-auto mb-3" />
          <p className="text-red-600 dark:text-red-400 font-medium">
            {process.env.NODE_ENV === 'development'
              ? this.state.error?.message || 'Could not load post'
              : 'Something went wrong. Please try again.'}
          </p>
          <button onClick={this.handleRetry} className="mt-3 px-4 py-1.5 rounded-full bg-red-500 text-white text-sm shadow-md">Try again</button>
        </div>
      );
    }
    return this.props.children;
  }
}

// 5. SHARE SHEET (tap outside / ESC, download only if hasMedia)
const CardShareSheet = React.memo(({ url, content, onClose, tokens, postId, postData, isCreator, hasMedia, navigate, currentUser }) => {
  const sheetRef = useRef(null);
  const overlayRef = useRef(null);

  useEffect(() => {
    const handleKeyDown = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleKeyDown);
    sheetRef.current?.focus();
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleOverlayClick = (e) => {
    if (e.target === overlayRef.current) onClose();
  };

  const copyLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success('Link copied!');
      onClose();
    } catch { toast.error('Copy failed'); }
  }, [url, onClose]);

  const shareNative = useCallback(() => {
    if (navigator.share) navigator.share({ title: content, url }).catch(() => copyLink());
    else copyLink();
    onClose();
  }, [content, url, copyLink, onClose]);

  const repost = useCallback(async () => {
    if (!postId) return;
    if (!currentUser?.uid) {
      toast.error('Sign in to repost');
      return;
    }
    try {
      const res = await firestoreService.repostPost(postId, currentUser.uid);
      if (res?.alreadyReposted) {
        toast.info('You already reposted this');
      } else {
        toast.success('Reposted to your profile! 🔁');
      }
    } catch (err) {
      toast.error(err?.message || 'Failed to repost');
    }
    onClose();
  }, [postId, currentUser?.uid, onClose]);

  const quotePost = useCallback(() => {
    if (!postId || !navigate) return;
    const snippet = (postData?.content || postData?.title || '').slice(0, 180);
    const params = new URLSearchParams();
    if (snippet) params.set('quote', snippet);
    navigate(`/create-post?${params.toString()}`);
    onClose();
  }, [postId, postData, navigate, onClose]);

  const sendToFriends = useCallback(() => {
    if (!postId || !navigate) return;
    navigate(`/messages/new?sharePost=${encodeURIComponent(postId)}`);
    onClose();
  }, [postId, navigate, onClose]);

  const downloadMedia = useCallback(async () => {
    if (!postData?.media?.length) {
      toast.info('No media to download');
      onClose();
      return;
    }
    triggerHaptic('light');
    for (const media of postData.media) {
      try {
        const response = await fetch(media.url);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const blob = await response.blob();
        const blobUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = `arvdoul_media_${Date.now()}.${media.type === 'video' ? 'mp4' : 'jpg'}`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
      } catch (err) {
        console.error(err);
        toast.error('Download failed');
      }
    }
    toast.success('Download started');
    onClose();
  }, [postData, onClose]);

  // Add the real post image as a story through storyService.
  const addToStory = useCallback(async () => {
    const imageUrl = postData?.media?.find((m) => m.type === 'image')?.url;
    if (!currentUser?.uid) {
      toast.error('Sign in to add to your story');
      onClose();
      return;
    }
    if (!imageUrl) {
      toast.error('This post has no image to add to a story');
      onClose();
      return;
    }
    try {
      const response = await fetch(imageUrl);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const blob = await response.blob();
      const file = new File([blob], `story_${postId}.jpg`, { type: blob.type || 'image/jpeg' });
      const { getStoryService } = await import('../services/storyService.js');
      const res = await getStoryService().createStory({
        type: 'image',
        content: (postData?.content || '').slice(0, 100),
        mediaFile: file,
        backgroundColor: '#000000',
        textColor: '#FFFFFF',
        visibility: 'public',
      });
      if (res?.success) {
        toast.success('Added to your story! ✨');
        if (navigate) navigate('/stories');
      } else if (res?.queued) {
        toast.info('Offline — story queued and will publish when you reconnect.');
      } else {
        toast.error(res?.error || 'Could not add to story');
      }
    } catch (err) {
      toast.error(err?.message || 'Could not add to story');
    }
    onClose();
  }, [postData, postId, currentUser, navigate, onClose]);

  // Promote this post with real coins through the boostPost ledger callable.
  // The server owns the daily rate and balance check; the client never guesses
  // the price or writes boost state itself.
  const promotePost = useCallback(async () => {
    if (!currentUser?.uid || !postId) {
      toast.error('Sign in to promote this post');
      onClose();
      return;
    }
    try {
      const [{ boostPost }, { default: postService }] = await Promise.all([
        import('../services/monetizationService.js'),
        import('../services/postService.js'),
      ]);
      const post = await postService.getPost(postId);
      if (post?.boostData?.isBoosted) {
        toast.info('This post is already promoted');
        onClose();
        return;
      }
      const days = 7;
      await boostPost(currentUser.uid, postId, days);
      toast.success(`Post promoted for ${days} days! 🚀`);
    } catch (err) {
      const msg = err?.message || 'Promotion failed';
      if (/insufficient/i.test(msg)) {
        toast.error('Not enough coins to promote this post.');
        if (navigate) navigate('/coins');
      } else {
        toast.error(msg);
      }
    }
    onClose();
  }, [currentUser, postId, navigate, onClose]);

  return (
    <motion.div
      ref={overlayRef}
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}
      className="fixed inset-0 z-[1000] flex items-center justify-center" style={{ backgroundColor: tokens.overlayBg }}
      onClick={handleOverlayClick}
    >
      <motion.div
        ref={sheetRef}
        initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }}
        className="rounded-2xl shadow-2xl border max-w-[360px] w-full mx-4 p-5 max-h-[80vh] overflow-y-auto"
        style={{ backgroundColor: tokens.overlayPanel, borderColor: tokens.overlayPanelBorder }}
        onClick={(e) => e.stopPropagation()}
        tabIndex={-1} role="dialog" aria-modal="true" aria-label="Share options"
      >
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-semibold text-sm" style={{ color: tokens.text }}>Share</h3>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-black/10 dark:hover:bg-white/10 transition" aria-label="Close"><X className="w-4 h-4" /></button>
        </div>
        <div className="grid grid-cols-4 gap-3 mb-4" role="listbox">
          <button onClick={shareNative} className="flex flex-col items-center gap-1 p-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 transition"><Share2 className="w-6 h-6 text-blue-500" /><span className="text-xs">Share</span></button>
          <button onClick={copyLink} className="flex flex-col items-center gap-1 p-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 transition"><Copy className="w-6 h-6" /><span className="text-xs">Copy</span></button>
          <button onClick={() => { window.open(`https://wa.me/?text=${encodeURIComponent(content + ' ' + url)}`, '_blank', 'noopener,noreferrer'); onClose(); }} className="flex flex-col items-center gap-1 p-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 transition"><FaWhatsapp className="w-6 h-6 text-green-500" /><span className="text-xs">WA</span></button>
          <button onClick={() => { window.open(`https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(content)}`, '_blank', 'noopener,noreferrer'); onClose(); }} className="flex flex-col items-center gap-1 p-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 transition"><FaTelegram className="w-6 h-6 text-blue-500" /><span className="text-xs">TG</span></button>
          <button onClick={() => { window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(content)}&url=${encodeURIComponent(url)}`, '_blank', 'noopener,noreferrer'); onClose(); }} className="flex flex-col items-center gap-1 p-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 transition"><FaTwitter className="w-6 h-6 text-sky-500" /><span className="text-xs">X</span></button>
          <button onClick={() => { window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`, '_blank', 'noopener,noreferrer'); onClose(); }} className="flex flex-col items-center gap-1 p-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 transition"><FaFacebook className="w-6 h-6 text-blue-600" /><span className="text-xs">FB</span></button>
          <button onClick={() => { navigator.clipboard.writeText(url); toast.success('Link copied – share in Instagram DM'); onClose(); }} className="flex flex-col items-center gap-1 p-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 transition"><FaInstagram className="w-6 h-6 text-pink-500" /><span className="text-xs">IG</span></button>
          <button onClick={repost} className="flex flex-col items-center gap-1 p-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 transition"><RefreshCw className="w-6 h-6 text-green-500" /><span className="text-xs">Repost</span></button>
        </div>
        <div className="border-t pt-3 space-y-2" style={{ borderColor: tokens.overlayPanelBorder }}>
          <button onClick={quotePost} className="w-full text-left px-3 py-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition flex items-center gap-2"><Quote className="w-5 h-5" /><span className="text-sm">Quote Post</span></button>
          <button onClick={sendToFriends} className="w-full text-left px-3 py-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition flex items-center gap-2"><Send className="w-5 h-5" /><span className="text-sm">Send to Friends</span></button>
          {hasMedia && (
            <button onClick={downloadMedia} className="w-full text-left px-3 py-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition flex items-center gap-2"><Download className="w-5 h-5" /><span className="text-sm">Download Media</span></button>
          )}
          <button onClick={addToStory} className="w-full text-left px-3 py-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition flex items-center gap-2"><PlusCircle className="w-5 h-5" /><span className="text-sm">Add to Story</span></button>
          {isCreator && (
            <button onClick={promotePost} className="w-full text-left px-3 py-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition flex items-center gap-2"><TrendingUp className="w-5 h-5" style={{ color: tokens.gold }} /><span className="text-sm" style={{ color: tokens.gold }}>Promote Post</span></button>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
});

// 6. REACTIONS PICKER (tap outside / ESC)
const REACTIONS = [
  { emoji: '👍', label: 'Like' }, { emoji: '❤️', label: 'Love' }, { emoji: '😂', label: 'Haha' },
  { emoji: '😮', label: 'Wow' }, { emoji: '😢', label: 'Sad' }, { emoji: '😡', label: 'Angry' },
  { emoji: '🔥', label: 'Fire' }, { emoji: '🎉', label: 'Celebrate' }
];

const CardReactionsPicker = React.memo(({ onSelect, onClose, tokens, targetRect }) => {
  const pickerRef = useRef(null);
  const clamp = (v, min, max) => Math.max(min, Math.min(v, max));
  const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 360;
  const viewportHeight = typeof window !== 'undefined' ? window.innerHeight : 640;
  let top = targetRect ? targetRect.top - 140 : viewportHeight / 2;
  let left = targetRect ? targetRect.left - 100 : viewportWidth / 2;
  top = clamp(top, 20, viewportHeight - 200);
  left = clamp(left, 20, viewportWidth - 280);
  const style = targetRect ? {
    position: 'fixed',
    top, left,
    zIndex: 1001,
    boxShadow: tokens.shadowDirectional,
    backgroundColor: tokens.overlayPanel,
    borderRadius: '16px',
    padding: '12px',
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: '8px',
    maxWidth: '280px',
    border: `1px solid ${tokens.overlayPanelBorder}`,
  } : { position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', zIndex: 1001, backgroundColor: tokens.overlayPanel, border: `1px solid ${tokens.overlayPanelBorder}`, borderRadius: '16px', padding: '16px', maxWidth: '280px' };

  useEffect(() => {
    const handleKeyDown = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const overlayRef = useRef(null);
  const handleOverlayClick = (e) => {
    if (e.target === overlayRef.current) onClose();
  };

  return (
    <motion.div
      ref={overlayRef}
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}
      className="fixed inset-0 z-[1000] flex items-center justify-center" style={{ backgroundColor: 'transparent' }}
      onClick={handleOverlayClick}
    >
      <motion.div
        ref={pickerRef}
        initial={{ scale: 0.8 }}
        animate={{ scale: 1 }}
        exit={{ scale: 0.8 }}
        transition={{ type: "spring", stiffness: 400, damping: 25 }}
        style={style}
        onClick={(e) => e.stopPropagation()}
        role="menu"
        aria-label="Reaction picker"
      >
        {REACTIONS.map((r) => (
          <button
            key={r.emoji}
            onClick={() => { onSelect(r); onClose(); }}
            className="flex flex-col items-center gap-1 p-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 transition text-2xl"
            aria-label={r.label}
            role="menuitem"
          >
            {r.emoji}
            <span className="text-xs" style={{ color: tokens.textSecondary }}>{r.label}</span>
          </button>
        ))}
      </motion.div>
    </motion.div>
  );
});

// 7. DOUBLE TAP HEART (reduced motion)
const DoubleTapHeart = React.memo(({ position, onFinish, prefersReducedMotion }) => {
  useEffect(() => {
    if (prefersReducedMotion) {
      onFinish?.();
      return;
    }
    const timer = setTimeout(() => onFinish?.(), 600);
    return () => clearTimeout(timer);
  }, [onFinish, prefersReducedMotion]);
  if (prefersReducedMotion) return null;
  return (
    <motion.div initial={{ scale: 0, opacity: 0 }} animate={{ scale: 2, opacity: [0, 1, 0] }} transition={{ duration: 0.6 }}
      className="absolute pointer-events-none z-50" style={{ left: position.x - 30, top: position.y - 30 }}>
      <FaHeart className="w-16 h-16 text-red-500 fill-current drop-shadow-2xl" />
    </motion.div>
  );
});

// 8. INLINE COMMENT PREVIEW (abort controller only, no mounted flag)
const InlineComments = React.memo(({ postId, totalComments, onViewAll, isVisible, tokens }) => {
  const [preview, setPreview] = useState([]);
  const abortRef = useRef(null);
  useEffect(() => {
    if (!isVisible || totalComments === 0) return;
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    commentService.getCommentsByTarget('post', postId, { limit: 2, parentId: null }, { signal: controller.signal })
      .then(res => { if (res.success) setPreview(res.comments); })
      .catch((e) => {
        console.warn('Comment preview read failed', e?.message);
      });
    return () => abortRef.current?.abort();
  }, [postId, isVisible, totalComments]);
  if (!preview.length) return null;
  return (
    <div className="px-4 pb-2">
      <button onClick={onViewAll} className="text-xs hover:underline mb-1" style={{ color: tokens.textSecondary }}>View all {totalComments} comments</button>
      {preview.map(comment => (
        <div key={comment.id} className="flex gap-2 py-1">
          <img src={comment.userAvatar || '/assets/default-profile.png'} className="w-6 h-6 rounded-full" alt="" />
          <div>
            <span className="text-xs font-semibold mr-1" style={{ color: tokens.text }}>{comment.userName}</span>
            <span className="text-xs" style={{ color: tokens.textSecondary }}>{comment.content}</span>
          </div>
        </div>
      ))}
    </div>
  );
});

// 9. MAIN POST CARD – perfect rounded edges, compact, bubble counts
// Engagement reducer (unified state management)
const engagementReducer = (state, action) => {
  switch (action.type) {
    case 'SET_LIKED':
      return { ...state, liked: action.payload, reaction: action.payload ? '👍' : null, likeCount: state.likeCount + (action.payload ? 1 : -1) };
    case 'SET_REACTION': {
      const newLiked = !!action.payload;
      return { ...state, reaction: action.payload, liked: newLiked, likeCount: state.likeCount + (newLiked && !state.liked ? 1 : (!newLiked && state.liked ? -1 : 0)) };
    }
    case 'SET_SAVED':
      return { ...state, saved: action.payload };
    case 'SET_FOLLOW_STATE':
      return { ...state, followState: action.payload };
    case 'UPDATE_STATS':
      return { ...state, likeCount: action.payload.likes ?? state.likeCount, commentCount: action.payload.comments ?? state.commentCount, shareCount: action.payload.shares ?? state.shareCount, giftCount: action.payload.gifts ?? state.giftCount };
    case 'RESET_TO_SNAPSHOT':
      return action.payload;
    default:
      return state;
  }
};

function PostCardContent({ post, currentUser, onOpenComments, onOpenOptions, navigate, onRetry, isVisible = true }) {
  const { theme } = useTheme();
  const tokens = useMemo(() => getDesignTokens(theme), [theme]);
  const prefersReducedMotion = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Post-surface interaction telemetry sink. The sub-cards emit
  // `onAnalytics(event, data)`; without a real handler every emit was a no-op.
  // `trackAnalyticsEvent` is a stable module-level function so the memoised
  // sub-cards are not re-rendered by a fresh prop identity.
  const handleAnalytics = trackAnalyticsEvent;

  // Sponsored / ad detection
  const isSponsored = post.isSponsored === true || post.adCampaignId !== undefined;
  const [adDetails, setAdDetails] = useState(null);
  useEffect(() => {
    if (isSponsored && post.adCampaignId && monetizationService.getAd) {
      monetizationService.getAd('feed', currentUser?.uid, { adId: post.adCampaignId })
        .then(ad => setAdDetails(ad))
        .catch((e) => {
          console.warn('Sponsored post ad detail read failed', e?.message);
        });
    }
  }, [isSponsored, post.adCampaignId, currentUser?.uid]);

  // Memoized post data
  const likedBySet = useMemo(() => new Set(post.likedBy || []), [post.likedBy]);
  const isCreator = (post.authorLevel || 0) >= 5;
  const isPremium = (post.authorLevel || 0) >= 8;
  const hasMedia = !!(post.media && post.media.length > 0);

  const isInitiallyLiked = useMemo(() => {
    if (post.isLiked || post.liked) return true;
    const uid = currentUser?.uid || (typeof window !== 'undefined' ? localStorage.getItem('arvdoul_uid') || localStorage.getItem('uid') : null);
    if (uid && likedBySet.has(uid)) return true;
    if (uid && readLocalLikes(uid)[post.id]) return true;
    return false;
  }, [post.id, post.isLiked, post.liked, likedBySet, currentUser?.uid]);

  // Engagement state with reducer
  const [engagement, dispatch] = useReducer(engagementReducer, {
    liked: isInitiallyLiked,
    reaction: post.userReaction || null,
    saved: post.savedBy?.includes(currentUser?.uid) || false,
    followState: 'none',
    likeCount: post.stats?.likes || 0,
    commentCount: post.stats?.comments || 0,
    shareCount: post.stats?.shares || 0,
    giftCount: post.stats?.gifts || 0,
  });
  const engagementRef = useRef(engagement);
  useEffect(() => { engagementRef.current = engagement; }, [engagement]);

  // Rollback snapshot helper
  const takeSnapshot = useCallback(() => ({ ...engagementRef.current }), []);
  const rollbackTo = useCallback((snapshot) => {
    dispatch({ type: 'RESET_TO_SNAPSHOT', payload: snapshot });
  }, []);

  const [ui, setUi] = useState({
    showAnalytics: false,
    showShareSheet: false,
    showReactionsPicker: false,
    showHeartBurst: false,
    tapPosition: { x: 0, y: 0 },
    giftLoading: false,
    showGiftPicker: false,
    giftBalance: null,
  });
  const [isActiveForSubs, setIsActiveForSubs] = useState(isVisible);

  // Refs for timers & subscriptions
  const lastTapRef = useRef(0);
  const longPressTimer = useRef(null);
  const heartTimerRef = useRef(null);
  const likeButtonRef = useRef(null);
  const [reactionsTargetRect, setReactionsTargetRect] = useState(null);
  const unsubStatsRef = useRef(null);
  const debounceLikeRef = useRef(null);
  const debounceReactionRef = useRef(null);
  const likeLockRef = useRef(false);
  const isAuthor = currentUser?.uid === post.authorId;

  // Follow status
  useEffect(() => {
    if (!isAuthor && currentUser?.uid) {
      userService.getFollowStatus(currentUser.uid, post.authorId).then(res => {
        if (res.isFollowing) dispatch({ type: 'SET_FOLLOW_STATE', payload: 'following' });
      }).catch(() => {});
    }
  }, [currentUser?.uid, post.authorId, isAuthor]);

  // Real coin balance (ledger) whenever the gift picker opens.
  useEffect(() => {
    if (!ui.showGiftPicker || !currentUser?.uid) return;
    let cancelled = false;
    (async () => {
      try {
        const bal = await monetizationService.getBalance(currentUser.uid);
        if (!cancelled) setUi(prev => ({ ...prev, giftBalance: typeof bal === 'number' ? bal : Number(bal?.coins ?? 0) }));
      } catch {
        if (!cancelled) setUi(prev => ({ ...prev, giftBalance: null }));
      }
    })();
    return () => { cancelled = true; };
  }, [ui.showGiftPicker, currentUser?.uid]);

  // Real‑time stats (only if visible)
  useEffect(() => {
    if (!post.id || !isActiveForSubs) return;
    const unsub = firestoreService.subscribeToPostStats?.(post.id, (stats) => {
      dispatch({ type: 'UPDATE_STATS', payload: stats });
    });
    unsubStatsRef.current = unsub;
    return () => {
      if (unsubStatsRef.current && typeof unsubStatsRef.current === 'function') {
        unsubStatsRef.current();
      }
    };
  }, [post.id, isActiveForSubs]);

  // Pause subscriptions when card not visible
  useEffect(() => { setIsActiveForSubs(isVisible); }, [isVisible]);

  // Record a real view impression once per mounted card, through the canonical
  // writer. `posts/{id}/view_aggregate` + `daily_stats` are only ever written
  // here; without this the author analytics panel's view count is always 0.
  // The author's own views are not counted.
  const viewRecordedRef = useRef(false);
  useEffect(() => {
    if (!isVisible || !post.id || viewRecordedRef.current) return;
    const uid = currentUser?.uid;
    if (!uid || uid === post.authorId) return;
    viewRecordedRef.current = true;
    firestoreService.recordPostView?.(post.id, uid).catch((e) => {
      console.warn('Post view not recorded', e?.message);
    });
  }, [isVisible, post.id, post.authorId, currentUser?.uid]);

  // Real post analytics for the author panel. The panel used to read
  // `post.analytics.{views,reach,watchTime,completionRate,earnings}`, a shape
  // nothing ever wrote, so every row rendered blank. Only the author may read
  // it, and only while the analytics panel is open.
  const [postAnalytics, setPostAnalytics] = useState(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  useEffect(() => {
    if (!ui.showAnalytics || !isAuthor || !post.id) return undefined;
    let cancelled = false;
    setAnalyticsLoading(true);
    firestoreService.getPostAnalytics?.(post.id)
      .then((res) => { if (!cancelled) setPostAnalytics(res?.success ? res.analytics : null); })
      .catch(() => { if (!cancelled) setPostAnalytics(null); })
      .finally(() => { if (!cancelled) setAnalyticsLoading(false); });
    return () => { cancelled = true; };
  }, [ui.showAnalytics, isAuthor, post.id]);

  // The viewer's own vote on a post-embedded poll. PollCard renders the
  // selection from `userVote`, but nothing ever supplied it, so a returning
  // voter always saw an unvoted poll (and could re-tap into a server
  // "already-exists" error).
  const [userPollVoteIndex, setUserPollVoteIndex] = useState(null);
  useEffect(() => {
    if (post.type !== 'poll' || !post.id || !currentUser?.uid) {
      setUserPollVoteIndex(null);
      return undefined;
    }
    let cancelled = false;
    firestoreService.getUserPollVote?.(post.id, currentUser.uid)
      .then((res) => { if (!cancelled) setUserPollVoteIndex(res?.optionIndex ?? null); })
      .catch(() => { if (!cancelled) setUserPollVoteIndex(null); });
    return () => { cancelled = true; };
  }, [post.type, post.id, currentUser?.uid]);

  const pollWithVote = useMemo(
    () => (post.poll ? { ...post.poll, userVote: userPollVoteIndex == null ? null : `opt_${userPollVoteIndex}` } : null),
    [post.poll, userPollVoteIndex],
  );

  // The viewer's own up/down votes on this question's answers. QuestionCard
  // renders the per-answer selection from `answer.userVote`, which nothing
  // supplied; without it a returning voter could re-vote (and the server would
  // toggle it off).
  const [answerVotes, setAnswerVotes] = useState({});
  useEffect(() => {
    if (post.type !== 'question' || !post.id || !currentUser?.uid) {
      setAnswerVotes({});
      return undefined;
    }
    let cancelled = false;
    firestoreService.getMyAnswerVotes?.(post.id, currentUser.uid)
      .then((res) => { if (!cancelled) setAnswerVotes(res?.votes || {}); })
      .catch(() => { if (!cancelled) setAnswerVotes({}); });
    return () => { cancelled = true; };
  }, [post.type, post.id, currentUser?.uid]);

  const questionWithVotes = useMemo(() => {
    const q = post.question;
    if (!q || typeof q !== 'object') return q;
    const answers = Array.isArray(q.answers)
      ? q.answers.map((a) => ({ ...a, userVote: answerVotes[a.id] ?? null }))
      : q.answers;
    return { ...q, answers };
  }, [post.question, answerVotes]);

  const handleAddAnswer = useCallback(async (answerText, idempotencyKey) => {
    if (!currentUser?.uid) throw new Error('Sign in to answer');
    await firestoreService.addAnswer?.(post.id, answerText, idempotencyKey);
  }, [currentUser, post.id]);

  const handleAnswerVote = useCallback(async (answerId, direction) => {
    if (!currentUser?.uid) throw new Error('Sign in to vote');
    const res = await firestoreService.voteAnswer?.(post.id, answerId, direction);
    setAnswerVotes((prev) => {
      const next = { ...prev };
      if (res?.vote) next[answerId] = res.vote;
      else delete next[answerId];
      return next;
    });
  }, [currentUser, post.id]);

  const handleEditAnswer = useCallback(async (answerId, answerText) => {
    await firestoreService.editAnswer?.(post.id, answerId, answerText);
  }, [post.id]);

  const handleDeleteAnswer = useCallback(async (answerId) => {
    await firestoreService.deleteAnswer?.(post.id, answerId);
  }, [post.id]);

  const handleMarkBest = useCallback(async (answerId) => {
    await firestoreService.acceptAnswer?.(post.id, answerId);
  }, [post.id]);

  // Reporting an answer reports its parent question post through the canonical
  // reportContent path (rate-limited + de-duplicated server-side); the flag
  // button was otherwise a dead control.
  const handleReportAnswer = useCallback(async () => {
    try {
      const { callFunction, FUNCTIONS } = await import('../services/callableService.js');
      await callFunction(FUNCTIONS.REPORT_POST, {
        targetId: post.id,
        reason: 'Inappropriate answer',
        details: 'Reported from a Q&A answer',
      });
      toast.success('Report submitted');
    } catch (err) {
      toast.error(err.message || 'Report failed');
    }
  }, [post.id]);

  // Cleanup timers
  useEffect(() => {
    return () => {
      if (heartTimerRef.current) clearTimeout(heartTimerRef.current);
      if (longPressTimer.current) clearTimeout(longPressTimer.current);
      if (debounceLikeRef.current) clearTimeout(debounceLikeRef.current);
      if (debounceReactionRef.current) clearTimeout(debounceReactionRef.current);
    };
  }, []);

  // Cleanup event bus on unmount (optional, but safe)
  useEffect(() => {
    return () => {
      // Not clearing global bus here – it's shared; individual listeners must be cleaned
    };
  }, []);

  // HANDLERS with snapshot rollback, separate debounces, lock
  const handleLikeClick = useCallback(() => {
    // Identity comes from the live session only; a localStorage uid can belong
    // to a previous account on a shared device.
    const userId = currentUser?.uid || null;
    if (!userId) {
      toast.error('Please sign in to like posts');
      return;
    }
    if (likeLockRef.current) return;
    likeLockRef.current = true;
    setTimeout(() => { likeLockRef.current = false; }, 300);

    const snapshot = takeSnapshot();
    const newLiked = !snapshot.liked;
    dispatch({ type: 'SET_LIKED', payload: newLiked });
    triggerHaptic('light');

    // Persist immediately in client storage (uid-scoped)
    setLocalLike(userId, post.id, newLiked);

    if (debounceLikeRef.current) clearTimeout(debounceLikeRef.current);
    debounceLikeRef.current = setTimeout(async () => {
      try {
        let res;
        if (navigator.onLine) {
          res = newLiked
            ? await firestoreService.likePost?.(post.id, userId)
            : await firestoreService.unlikePost?.(post.id, userId);
        } else {
          await addToOfflineQueue(newLiked ? 'like' : 'unlike', { postId: post.id, userId });
        }
        // A rate-limited / failed write returns success:false (no throw). Roll
        // the optimistic heart back so the UI never shows an unpersisted like.
        if (res && res.success === false && !res.localOnly) {
          rollbackTo(snapshot);
          setLocalLike(userId, post.id, snapshot.liked);
          toast.error('Could not update like');
          return;
        }
        if (newLiked && post.authorId && post.authorId !== userId) {
          notificationService.sendNotification?.({
            type: 'like', recipientId: post.authorId, senderId: userId, targetId: post.id
          }).catch(() => {});
        }
      } catch (err) {
        // A thrown write (network/offline) rolls the optimistic state back.
        rollbackTo(snapshot);
        setLocalLike(userId, post.id, snapshot.liked);
        toast.error('Could not update like');
      }
    }, 250);
  }, [currentUser, post.id, post.authorId, takeSnapshot, rollbackTo]);

  const handleReaction = useCallback((reaction) => {
    const effectiveUserId = currentUser?.uid || null;
    if (!effectiveUserId) {
      toast.error('Please sign in to react to posts');
      return;
    }
    const snapshot = takeSnapshot();
    const emoji = typeof reaction === 'string' ? reaction : reaction.emoji;
    const newReaction = snapshot.reaction === emoji ? null : emoji;
    dispatch({ type: 'SET_REACTION', payload: newReaction });
    triggerHaptic('light');

    if (typeof window !== 'undefined') {
      try {
        if (newReaction) {
          localStorage.setItem(`arvdoul_reaction_${post.id}`, newReaction);
        } else {
          localStorage.removeItem(`arvdoul_reaction_${post.id}`);
        }
      } catch (e) {
        console.warn('Reaction state persist failed', e?.message);
      }
    }

    if (debounceReactionRef.current) clearTimeout(debounceReactionRef.current);
    debounceReactionRef.current = setTimeout(async () => {
      try {
        if (navigator.onLine) {
          if (newReaction) {
            await firestoreService.addReaction?.(post.id, effectiveUserId, newReaction);
          } else {
            await firestoreService.removeReaction?.(post.id, effectiveUserId);
          }
        } else {
          if (newReaction) {
            await addToOfflineQueue('reaction', { postId: post.id, userId: effectiveUserId, reaction: newReaction });
          } else {
            await addToOfflineQueue('removeReaction', { postId: post.id, userId: effectiveUserId });
          }
        }
      } catch (err) {
        console.warn('Reaction background sync info:', err);
      }
    }, 250);
  }, [currentUser, post.id, takeSnapshot]);

  // Post-embedded poll vote. `PollCard` was rendered without `onVote`, so every
  // tap showed "Voting not configured" — the card was display-only. This routes
  // the tap to the real transactional writer (normalises string options, records
  // the per-(post,voter) dedupe doc) and reflects the viewer's vote back.
  const handlePollVote = useCallback(async (postId, optionId, idempotencyKey) => {
    const userId = currentUser?.uid || null;
    if (!userId) {
      toast.error('Sign in to vote');
      throw new Error('Sign in to vote');
    }
    const options = Array.isArray(post.poll?.options) ? post.poll.options : [];
    const index = options.findIndex((o, idx) => {
      const id = typeof o === 'string' ? `opt_${idx}` : (o?.id ?? `opt_${idx}`);
      return id === optionId;
    });
    if (index < 0) throw new Error('Option not found');

    const isMultiple = post.poll?.allowMultiple === true;
    const res = await firestoreService.voteOnPoll?.(postId, userId, index, isMultiple);
    if (res?.alreadyVoted) {
      setUserPollVoteIndex(index);
      toast.info('You already voted on this poll');
      return;
    }
    setUserPollVoteIndex(index);
    // The reward is credited server-side by `votePostPoll`; PollCard owns the
    // "+coins" toast so it fires only on the viewer's first vote (and only once).
    void idempotencyKey;
  }, [currentUser, post.poll]);

  const handleSave = useCallback(async () => {
    if (!currentUser) return toast.error('Sign in');
    const snapshot = takeSnapshot();
    const newSaved = !snapshot.saved;
    dispatch({ type: 'SET_SAVED', payload: newSaved });
    triggerHaptic('light');
    try {
      if (navigator.onLine) {
        if (newSaved) {
          await firestoreService.savePost?.(post.id, currentUser.uid);
        } else {
          await firestoreService.unsavePost?.(post.id, currentUser.uid);
        }
      } else {
        await addToOfflineQueue(newSaved ? 'save' : 'unsave', { postId: post.id, userId: currentUser.uid });
      }
      toast.success(newSaved ? 'Saved' : 'Removed');
    } catch (err) {
      rollbackTo(snapshot);
      toast.error('Failed');
      if (process.env.NODE_ENV === 'development') console.error(err);
    }
  }, [currentUser, post.id, takeSnapshot, rollbackTo]);

  const handleFollow = useCallback(async () => {
    if (!currentUser) return toast.error('Sign in');
    const snapshot = takeSnapshot();
    const newFollowState = snapshot.followState === 'following' ? 'none' : 'following';
    dispatch({ type: 'SET_FOLLOW_STATE', payload: newFollowState });
    triggerHaptic('medium');
    try {
      if (newFollowState === 'following') {
        await userService.followUser(currentUser.uid, post.authorId);
      } else {
        await userService.unfollowUser(currentUser.uid, post.authorId);
      }
    } catch (err) {
      rollbackTo(snapshot);
      toast.error('Action failed');
      if (process.env.NODE_ENV === 'development') console.error(err);
    }
  }, [currentUser, post.authorId, takeSnapshot, rollbackTo]);

  const handleShare = useCallback(() => {
    if (!currentUser) return toast.error('Sign in');
    setUi(prev => ({ ...prev, showShareSheet: true }));
  }, [currentUser]);

  const handleSendGift = useCallback(async (giftType = 'rose') => {
    if (!currentUser) return toast.error('Sign in');
    if (ui.giftLoading) return;
    setUi(prev => ({ ...prev, giftLoading: true }));
    triggerHaptic('medium');
    try {
      // Signature is (senderId, postId, giftType, idempotencyKey). The coin
      // value is resolved server-side from the gift catalog — passing it here
      // would land in the idempotency-key slot and silently no-op every
      // repeat gift. Omitting the key lets the service mint a fresh one.
      const res = await monetizationService.sendGift(currentUser.uid, post.id, giftType);
      if (res?.success) {
        dispatch({ type: 'UPDATE_STATS', payload: { gifts: engagementRef.current.giftCount + 1 } });
        toast.success(`Sent ${giftType}!`);
        setUi(prev => ({ ...prev, showGiftPicker: false }));
      } else {
        toast.error(res?.message || 'Gift could not be sent');
      }
    } catch (err) {
      toast.error(err?.message || 'Gift could not be sent');
      if (process.env.NODE_ENV === 'development') console.error(err);
    } finally {
      setUi(prev => ({ ...prev, giftLoading: false }));
    }
  }, [currentUser, post.id, ui.giftLoading]);

  // Double‑tap detection (with lock)
  const handleContainerClick = useCallback((e) => {
    const now = Date.now();
    if (now - lastTapRef.current < 300) {
      e.preventDefault();
      const rect = e.currentTarget.getBoundingClientRect();
      setUi(prev => ({ ...prev, tapPosition: { x: e.clientX - rect.left, y: e.clientY - rect.top }, showHeartBurst: true }));
      if (heartTimerRef.current) clearTimeout(heartTimerRef.current);
      heartTimerRef.current = setTimeout(() => setUi(prev => ({ ...prev, showHeartBurst: false })), 600);
      handleLikeClick();
    }
    lastTapRef.current = now;
  }, [handleLikeClick]);

  const startLongPress = useCallback(() => {
    if (likeButtonRef.current) {
      const rect = likeButtonRef.current.getBoundingClientRect();
      setReactionsTargetRect(rect);
    }
    longPressTimer.current = setTimeout(() => setUi(prev => ({ ...prev, showReactionsPicker: true })), 400);
  }, []);
  const cancelLongPress = useCallback(() => clearTimeout(longPressTimer.current), []);
  const closeReactionsPicker = useCallback(() => setUi(prev => ({ ...prev, showReactionsPicker: false })), []);
  const handleReactionSelect = useCallback((reaction) => {
    handleReaction(reaction);
    closeReactionsPicker();
    toast.success(`Reacted with ${reaction.label}`);
    triggerHaptic('light');
  }, [handleReaction, closeReactionsPicker]);

  const postedDateTime = useMemo(() => {
    try { return formatDistanceToNow(post.createdAt?.toDate?.() || new Date(post.createdAt), { addSuffix: true }); } catch { return 'just now'; }
  }, [post.createdAt]);

  // Determine post type
  const isTextOnly = post.type === 'text' && (!post.media || post.media.length === 0);
  const isImage = post.type === 'image' || (post.media?.length > 0 && post.type !== 'video' && post.type !== 'audio');
  const isVideo = post.type === 'video';
  const isAudio = post.type === 'audio';
  const isPoll = post.type === 'poll' && post.poll;
  const isQuestion = post.type === 'question' && post.question;
  const isEvent = post.type === 'event' && post.event;
  const isLink = post.type === 'link' && post.link;
  const isRepost = post.type === 'repost' && Boolean(post.originalPostId);

  if (!post.id) return null;

  const actionBarGradient = tokens.actionBarBg;
  const ctaText = adDetails?.cta || (post.ctaText || 'Learn More');
  const ctaLink = adDetails?.link || post.ctaLink;

  const formatCount = (num) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 12 }}
      transition={{ type: "spring", damping: 26, stiffness: 280 }}
      whileHover={{ scale: 1.004, transition: { duration: 0.2 } }}
      className="relative overflow-hidden my-2 rounded-3xl border shadow-lg"
      style={{
        backgroundColor: tokens.cardBg,
        borderColor: tokens.border,
        boxShadow: tokens.shadowDirectional,
        borderRadius: '1.5rem',
      }}
      onClick={handleContainerClick}
    >
      {/* HEADER – larger avatar (w-10 h-10), compact padding */}
      <div className="p-3 flex items-start gap-3">
        <button onClick={() => navigate(`/profile/${post.authorId}`)} className="relative flex-shrink-0" aria-label={`Visit ${post.authorName}'s profile`}>
          <div className={`absolute -inset-0.5 rounded-full ${isPremium ? 'bg-gradient-to-r from-amber-400 to-yellow-600' : isCreator ? 'bg-gradient-to-r from-purple-400 to-pink-600' : 'bg-transparent'}`} />
          <img src={userService.getAvatarUrl(post.authorId, post.authorName, post.authorPhoto)} alt={post.authorName} className="relative w-10 h-10 rounded-full object-cover border-2" style={{ borderColor: tokens.border }} />
          {isPremium && <Crown className="absolute -top-1 -right-1 w-3 h-3 text-yellow-400" />}
          {post.isVerified && <CheckCircle className="absolute -bottom-0.5 -right-0.5 w-3 h-3 text-cyan-400" />}
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1 flex-wrap">
            <span className="font-semibold text-sm" style={{ color: tokens.text }}>{post.authorName}</span>
            {post.isVerified && <CheckCircle className="w-3 h-3 text-cyan-400" />}
            {isCreator && <Zap className="w-3 h-3 text-amber-400" />}
            {post.momentum === 'trending' && <TrendingUp className="w-3 h-3 text-green-400" title="Trending" />}
            {post.momentum === 'exploding' && <Sparkles className="w-3 h-3 text-yellow-400" title="Exploding" />}
            {isSponsored && (
              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-gray-500/20 text-gray-300">Sponsored</span>
            )}
          </div>
          <div className="flex items-center gap-1.5 text-xs mt-0.5" style={{ color: tokens.textSecondary }}>
            <span>@{post.authorUsername}</span>
            <span>·</span>
            <span>{postedDateTime}</span>
            {post.visibility === 'public' && <Globe className="w-3 h-3" />}
            {post.visibility === 'followers' && <Users className="w-3 h-3" />}
          </div>
          {post.location && (
            <div className="flex items-center gap-1 text-xs mt-0.5" style={{ color: tokens.accent }}>
              <MapPin className="w-3 h-3" />
              <span>{post.location}</span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          {!isAuthor && currentUser && (
            <motion.button
              onClick={handleFollow}
              whileTap={{ scale: 0.96 }}
              className="px-2 py-0.5 rounded-full text-xs font-semibold text-white shadow-md transition-all"
              style={{
                background: engagement.followState === 'following' ? (theme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)') : tokens.neonPurple,
                boxShadow: engagement.followState === 'following' ? 'none' : `0 0 6px rgba(236,72,153,0.4), 0 0 8px rgba(147,51,234,0.2)`,
                color: engagement.followState === 'following' ? (theme === 'dark' ? '#fff' : '#333') : '#fff',
              }}
            >
              {engagement.followState === 'following' ? 'Following' : 'Follow'}
            </motion.button>
          )}
          <button onClick={() => onOpenOptions?.(post)} className="p-1 rounded-full hover:bg-black/5 dark:hover:bg-white/5 transition" aria-label="Post options">
            <MoreHorizontal className="w-4 h-4" style={{ color: tokens.textSecondary }} />
          </button>
        </div>
      </div>

      {/* SPONSORED CTA BANNER */}
      {isSponsored && adDetails && (
        <div className="mx-3 mb-2 p-2 rounded-xl bg-gradient-to-r from-purple-500/20 to-pink-500/20 border border-purple-500/30 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShoppingBag className="w-4 h-4 text-purple-400" />
            <span className="text-xs text-white/80">{adDetails.title || 'Sponsored'}</span>
          </div>
          {ctaLink && (
            <a
              href={ctaLink}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="text-xs font-medium text-white bg-purple-600 px-3 py-1 rounded-full hover:bg-purple-700 transition"
            >
              {ctaText} <ExternalLink className="w-3 h-3 inline ml-1" />
            </a>
          )}
        </div>
      )}

      {/* COMMUNITY NOTES */}
      {post.communityNotes?.length > 0 && (
        <div className="mx-3 mb-1 p-1.5 bg-blue-500/10 rounded-xl text-xs text-blue-600 dark:text-blue-300 flex items-start gap-2">
          <Shield className="w-3 h-3 flex-shrink-0 mt-0.5" />
          <span>{post.communityNotes[0].text}</span>
        </div>
      )}

      {/* REPOST CONTEXT */}
      {isRepost && (
        <div className="px-3 pt-1 flex items-center gap-1.5 text-xs" style={{ color: tokens.textSecondary }}>
          <RefreshCw className="w-3 h-3 text-green-500" />
          <span>
            {post.authorName} reposted
            {post.originalAuthorName ? ` ${post.originalAuthorName}'s post` : ' a post'}
          </span>
        </div>
      )}

      {/* CONTENT */}
      {isRepost && (
        <div className="mx-3 my-2 rounded-2xl border p-3" style={{ borderColor: tokens.border }}>
          <div className="flex items-center gap-2 mb-1">
            <img src={userService.getAvatarUrl(post.originalAuthorId, post.originalAuthorName, null)} alt={post.originalAuthorName || 'Original author'} className="w-6 h-6 rounded-full object-cover" />
            <span className="text-xs font-semibold" style={{ color: tokens.text }}>{post.originalAuthorName || 'Original author'}</span>
          </div>
          {post.originalContent && (
            <p className="text-sm whitespace-pre-line break-words" style={{ color: tokens.text }}>{post.originalContent}</p>
          )}
          {post.originalMedia?.length > 0 && (
            <img src={post.originalMedia[0]?.url || post.originalMedia[0]?.thumbnail} alt="" className="mt-2 rounded-xl w-full max-h-60 object-cover" loading="lazy" />
          )}
          {post.originalPostId && (
            <button onClick={() => navigate(`/post/${post.originalPostId}`)} className="mt-2 text-xs font-medium" style={{ color: tokens.primary }}>
              View original post
            </button>
          )}
        </div>
      )}
      {isTextOnly && <TextCard content={post.content} tokens={tokens} postId={post.id} onAnalytics={handleAnalytics} />}
      {!isRepost && !isTextOnly && post.content && (
        <p className="px-3 pb-1 text-sm leading-relaxed whitespace-pre-line break-words" style={{ color: tokens.text }}>{post.content}</p>
      )}
      {post.hashtags?.length > 0 && (
        <div className="px-3 pb-1 flex flex-wrap gap-1">
          {post.hashtags.map(tag => <span key={tag} className="text-xs" style={{ color: tokens.primary }}>#{tag}</span>)}
        </div>
      )}
      {isImage && <ImageCard images={post.media} onLike={handleLikeClick} postId={post.id} onAnalytics={handleAnalytics} />}
      {isVideo && <VideoCard src={post.media?.[0]?.url} isVisible={isVisible} onDoubleTap={handleLikeClick} postId={post.id} currentUser={currentUser} onAnalytics={handleAnalytics} />}
      {isAudio && <AudioCard audio={post.media?.[0]} isVisible={isVisible} tokens={tokens} postId={post.id} />}
      {isPoll && <PollCard poll={pollWithVote} postId={post.id} currentUser={currentUser} tokens={tokens} onVote={handlePollVote} onAnalytics={handleAnalytics} />}
      {isQuestion && <QuestionCard question={questionWithVotes} postId={post.id} currentUser={currentUser} tokens={tokens} isAuthor={isAuthor} answers={questionWithVotes?.answers || []} userReputation={typeof currentUser?.reputation === 'number' ? currentUser.reputation : null} onSubmitAnswer={handleAddAnswer} onVote={handleAnswerVote} onMarkBest={handleMarkBest} onEditAnswer={handleEditAnswer} onDeleteAnswer={handleDeleteAnswer} onReport={handleReportAnswer} />}
      {isEvent && <EventCard event={post.event} currentUser={currentUser} tokens={tokens} onOpenEvent={() => navigate(`/event/${post.event?.id || post.id}`)} />}
      {isLink && <LinkCard link={post.link} tokens={tokens} postId={post.id} onAnalytics={handleAnalytics} />}

      {/* INLINE COMMENT PREVIEW */}
      <InlineComments postId={post.id} totalComments={engagement.commentCount} onViewAll={() => onOpenComments?.(post)} isVisible={isActiveForSubs} tokens={tokens} />

      {/* ENGAGEMENT STATS (simplified – only analytics toggle for creators) */}
      <div className="px-3 py-1 flex justify-end items-center text-sm">
        {isAuthor && (
          <button onClick={() => setUi(prev => ({ ...prev, showAnalytics: !prev.showAnalytics }))} className="flex items-center gap-1 hover:underline text-xs" style={{ color: tokens.textSecondary }} aria-label="View post analytics">
            <BarChart3 className="w-3 h-3" /> Analytics
          </button>
        )}
      </div>

      {/* ANALYTICS PANEL — real counters only (views/likes/comments/shares).
          Reach, watch-time, completion-rate and earnings are not tracked for
          posts, so they are not shown rather than rendered as fabricated zeros. */}
      <AnimatePresence>
        {ui.showAnalytics && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="px-3 pb-2 overflow-hidden">
            <div className="bg-black/20 rounded-xl p-2 space-y-1 text-xs" style={{ color: tokens.textSecondary }}>
              {analyticsLoading ? (
                <div className="py-1 text-center">Loading analytics…</div>
              ) : postAnalytics ? (
                <>
                  <div className="flex justify-between"><span>Views</span><span>{(postAnalytics.totalViews || 0).toLocaleString()}</span></div>
                  <div className="flex justify-between"><span>Likes</span><span>{(postAnalytics.totalLikes || 0).toLocaleString()}</span></div>
                  <div className="flex justify-between"><span>Comments</span><span>{(postAnalytics.totalComments || 0).toLocaleString()}</span></div>
                  <div className="flex justify-between"><span>Shares</span><span>{(postAnalytics.totalShares || 0).toLocaleString()}</span></div>
                </>
              ) : (
                <div className="py-1 text-center">Analytics unavailable</div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ────────────────────────────────────────────────────────── */}
      {/* FLOATING ACTION BAR – neon gradient, rounded-full, with bubble counts */}
      {/* ────────────────────────────────────────────────────────── */}
      <div
        className="relative mx-3 mb-3 rounded-full"
        style={{
          background: actionBarGradient,
          boxShadow: `0 4px 12px rgba(0,0,0,0.2), ${tokens.actionBarGlow}`,
        }}
      >
        <div className="flex justify-between items-center px-4 py-1.5">
          {/* Like button with bubble */}
          <div className="relative flex items-center">
            <button
              ref={likeButtonRef}
              onClick={handleLikeClick}
              onMouseDown={startLongPress}
              onMouseUp={cancelLongPress}
              onMouseLeave={cancelLongPress}
              onTouchStart={startLongPress}
              onTouchEnd={cancelLongPress}
              className="flex items-center gap-1.5 text-sm transition relative"
              aria-label={engagement.liked ? 'Unlike' : 'Like'}
              aria-pressed={engagement.liked}
            >
              {engagement.reaction ? <span className="text-base">{engagement.reaction}</span> : <Heart className="w-4 h-4" style={{ color: engagement.liked ? '#ef4444' : 'white' }} />}
              <span className="text-xs text-white/90">Like</span>
              {engagement.likeCount > 0 && (
                <span className="absolute -top-2 -right-2 min-w-[18px] h-4 px-1 text-[10px] font-bold text-white bg-red-500 rounded-full flex items-center justify-center shadow-sm">
                  {formatCount(engagement.likeCount)}
                </span>
              )}
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (likeButtonRef.current) {
                  const rect = likeButtonRef.current.getBoundingClientRect();
                  setReactionsTargetRect(rect);
                }
                setUi(prev => ({ ...prev, showReactionsPicker: !prev.showReactionsPicker }));
              }}
              className="ml-1 p-0.5 rounded-full hover:bg-white/10 text-white/70 hover:text-white transition text-xs"
              title="Reactions"
              aria-label="Reactions"
            >
              ✨
            </button>
          </div>

          {/* Comment button with bubble */}
          <button
            onClick={() => onOpenComments?.(post)}
            className="flex items-center gap-1.5 text-sm text-white hover:text-white/80 transition relative"
            aria-label="Comment"
          >
            <MessageCircle className="w-4 h-4" />
            <span className="text-xs text-white/90">Comment</span>
            {engagement.commentCount > 0 && (
              <span className="absolute -top-2 -right-2 min-w-[18px] h-4 px-1 text-[10px] font-bold text-white bg-blue-500 rounded-full flex items-center justify-center shadow-sm">
                {formatCount(engagement.commentCount)}
              </span>
            )}
          </button>

          {/* Share button with bubble */}
          <button
            onClick={handleShare}
            className="flex items-center gap-1.5 text-sm text-white hover:text-white/80 transition relative"
            aria-label="Share"
          >
            <Share2 className="w-4 h-4" />
            <span className="text-xs text-white/90">Share</span>
            {engagement.shareCount > 0 && (
              <span className="absolute -top-2 -right-2 min-w-[18px] h-4 px-1 text-[10px] font-bold text-white bg-green-500 rounded-full flex items-center justify-center shadow-sm">
                {formatCount(engagement.shareCount)}
              </span>
            )}
          </button>

          {/* Save button */}
          <button
            onClick={handleSave}
            className={cn("flex items-center gap-1.5 text-sm transition", engagement.saved ? 'text-yellow-400' : 'text-white hover:text-white/80')}
            aria-label={engagement.saved ? 'Unsave' : 'Save'}
            aria-pressed={engagement.saved}
          >
            <Bookmark className="w-4 h-4" />
            <span className="text-xs">Save</span>
          </button>

          {/* Gift button (creator only) — opens the real gift picker */}
          {isCreator && !isAuthor && (
            <button
              onClick={() => setUi(prev => ({ ...prev, showGiftPicker: true }))}
              disabled={ui.giftLoading}
              className="flex items-center gap-1.5 text-sm text-pink-300 hover:text-pink-200 transition disabled:opacity-50"
              aria-label="Send gift"
            >
              <Gift className="w-4 h-4" />
              <span className="text-xs">Gift</span>
            </button>
          )}
        </div>
      </div>

      {/* OVERLAYS */}
      <AnimatePresence>
        {ui.showHeartBurst && <DoubleTapHeart position={ui.tapPosition} onFinish={() => setUi(prev => ({ ...prev, showHeartBurst: false }))} prefersReducedMotion={prefersReducedMotion} />}
        {ui.showReactionsPicker && <CardReactionsPicker onSelect={handleReactionSelect} onClose={closeReactionsPicker} tokens={tokens} targetRect={reactionsTargetRect} />}
        {ui.showShareSheet && <CardShareSheet url={`${typeof window !== 'undefined' ? window.location.origin : ''}/post/${post.id}`} content={post.content?.substring(0, 100) || 'Check out this post'} onClose={() => setUi(prev => ({ ...prev, showShareSheet: false }))} tokens={tokens} postId={post.id} postData={post} isCreator={isCreator} hasMedia={hasMedia} navigate={navigate} currentUser={currentUser} />}
        {ui.showGiftPicker && (
          <CardGiftPicker
            tokens={tokens}
            balance={ui.giftBalance}
            sending={ui.giftLoading}
            onClose={() => setUi(prev => ({ ...prev, showGiftPicker: false }))}
            onSelect={(giftType) => handleSendGift(giftType)}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// Gift picker — real coin amounts, server-validated via sendGift
const CardGiftPicker = ({ onSelect, onClose, sending, balance, tokens }) => {
  const [selected, setSelected] = useState(VIRTUAL_GIFTS[0]);
  const canAfford = balance == null || balance >= selected.coins;
  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={sending ? undefined : onClose}
    >
      <motion.div
        initial={{ y: 60, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 60, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-t-3xl sm:rounded-3xl p-5 border"
        style={{ backgroundColor: tokens.cardBg, borderColor: tokens.border }}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold" style={{ color: tokens.text }}>Send a Gift</h3>
          <button onClick={onClose} disabled={sending} className="p-1" style={{ color: tokens.textSecondary }} aria-label="Close">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="flex items-center justify-between mb-4 text-sm">
          <span style={{ color: tokens.textSecondary }}>Your balance</span>
          <span className="font-bold text-amber-500 flex items-center gap-1">
            <Coins className="w-4 h-4" /> {balance == null ? '—' : balance.toLocaleString()}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-3 mb-5">
          {VIRTUAL_GIFTS.map((gift) => (
            <button
              key={gift.type}
              type="button"
              onClick={() => setSelected(gift)}
              className="rounded-2xl p-3 border text-center transition-colors"
              style={{
                borderColor: selected.type === gift.type ? '#8B5CF6' : tokens.border,
                backgroundColor: selected.type === gift.type ? 'rgba(139,92,246,0.15)' : 'transparent',
              }}
            >
              <div className="text-2xl mb-1">{gift.emoji}</div>
              <div className="text-xs font-semibold truncate" style={{ color: tokens.text }}>{gift.name}</div>
              <div className="text-xs font-bold text-amber-500">{gift.coins} 🪙</div>
            </button>
          ))}
        </div>
        <button
          type="button"
          disabled={sending || !canAfford}
          onClick={() => onSelect(selected.type)}
          className="w-full py-3 rounded-2xl font-bold bg-gradient-to-r from-purple-500 to-pink-500 text-white hover:opacity-95 disabled:opacity-50"
        >
          {sending ? 'Sending…' : canAfford ? `Send ${selected.name}` : 'Not enough coins'}
        </button>
      </motion.div>
    </motion.div>
  );
};

export default function PostCard(props) {
  return (
    <PostErrorBoundary onRetry={props.onRetry}>
      <PostCardContent {...props} />
    </PostErrorBoundary>
  );
}