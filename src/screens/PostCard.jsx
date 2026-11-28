// src/screens/PostCard.jsx
//
// Perfect rounded edges, compact height, larger avatar, bubble counts, all bugs fixed.

import React, { useState, useEffect, useRef, useCallback, useMemo, useReducer } from 'react';
import { readLocalLikes, setLocalLike } from '../utils/localContentCache.js';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { useTheme } from '../context/ThemeContext';
import { tokens, BRAND_GRADIENT, brandRgba } from '../design-system/tokens.js';
import firestoreService from '../services/firestoreService';
import { trackAnalyticsEvent } from '../services/analyticsService';
import commentService from '../services/commentService';
import * as userService from '../services/userService';
import * as monetizationService from '../services/monetizationService';
import advertisingService from '../services/advertisingService';
import creatorEarningsService from '../services/creatorEarningsService';
import { triggerHaptic } from '../utils/haptics';
import { formatDistanceToNow } from 'date-fns';
import { resolveActorName } from '../services/profileReadModel.js';
import { Heart, MessageCircle, Share2, Bookmark, MoreHorizontal, Gift, MapPin, Globe, CheckCircle, Zap, Crown, TrendingUp, BarChart3, Coins, Send, AlertTriangle, Download, RefreshCw, Quote, PlusCircle, Copy, X, Users, ShoppingBag, ExternalLink, Handshake, Tag, Eye, ShieldAlert, FileText, Sparkles } from "lucide-react";
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
// One count formatter for the whole app (unknown -> '—'); a local copy drifted.
import { formatCount } from '../lib/searchUtils';
import { LazyImage } from '../components/Shared/LazyImage';

const cn = (...classes) => classes.filter(Boolean).join(' ');

// 1. DESIGN TOKENS – Arvdoul liquid-glass surfaces
const getDesignTokens = (theme) => {
  const isDark = theme === 'dark';
  return {
    primary: isDark ? tokens.color.brand.violet : tokens.color.brand.blue,
    secondary: isDark ? tokens.color.brand.indigo : tokens.color.brand.cyan,
    accent: '#FF2D55',
    gold: '#D4AF37',
    surface: isDark ? tokens.color.bg.darkElevated : tokens.color.bg.lightElevated,
    border: isDark ? tokens.color.surface.borderDark : 'rgba(15,23,42,0.08)',
    text: isDark ? tokens.color.text.primaryDark : '#0F172A',
    textMuted: isDark ? '#9CA3AF' : '#475569',
    textSecondary: isDark ? 'rgba(255,255,255,0.62)' : '#64748B',
    cardBg: isDark ? 'rgba(8, 15, 46, 0.88)' : 'rgba(255, 255, 255, 0.92)',
    cardBgAlt: isDark ? 'rgba(255, 255, 255, 0.04)' : tokens.color.bg.light,
    overlayBg: isDark ? tokens.color.surface.overlay : 'rgba(15, 23, 42, 0.45)',
    overlayPanel: isDark ? tokens.color.bg.darkElevated : tokens.color.bg.lightElevated,
    overlayPanelBorder: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(15,23,42,0.1)',
    actionBarBg: BRAND_GRADIENT,
    shadowDirectional: isDark
      ? '0 20px 40px -14px rgba(2,4,18,0.75), 0 2px 10px rgba(2,4,18,0.35)'
      : '0 18px 35px -12px rgba(15,23,42,0.12), 0 2px 8px rgba(15,23,42,0.05)',
    neonPurple: BRAND_GRADIENT,
    followGlow: tokens.shadow.glow,
    actionBarGlow: tokens.shadow.glowStrong,
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
          <button type="button" onClick={this.handleRetry} className="mt-3 px-4 py-1.5 rounded-full bg-red-500 text-white text-sm shadow-md">Try again</button>
        </div>
      );
    }
    return this.props.children;
  }
}

// 5. SHARE SHEET (tap outside / ESC, download only if hasMedia)
const CardShareSheet = React.memo(({ url, content, onClose, onShared, tokens, postId, postData, isCreator, hasMedia, navigate, currentUser, allowRepost = true, allowDownload = true }) => {
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

  const recordShare = useCallback((channel = 'share') => {
    onShared?.(channel);
    if (postId && currentUser?.uid) {
      firestoreService.sharePost?.(postId, currentUser.uid).catch((e) => {
        console.warn('[PostCard] share persistence skipped:', e?.message);
      });
    }
  }, [postId, currentUser?.uid, onShared]);

  const copyLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(url);
      recordShare('copy');
      toast.success('Link copied!');
      onClose();
    } catch { toast.error('Copy failed'); }
  }, [url, recordShare, onClose]);

  const shareNative = useCallback(async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: content, url });
        recordShare('native');
        onClose();
        return;
      } catch (err) {
        if (err?.name === 'AbortError') {
          onClose();
          return;
        }
        await copyLink();
        return;
      }
    }
    await copyLink();
  }, [content, url, recordShare, copyLink, onClose]);

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
        recordShare('repost');
        toast.success('Reposted to your profile!');
      }
    } catch (err) {
      toast.error(err?.message || 'Failed to repost');
    }
    onClose();
  }, [postId, currentUser?.uid, recordShare, onClose]);

  const quotePost = useCallback(() => {
    if (!postId || !navigate) return;
    recordShare('quote');
    const snippet = (postData?.content || postData?.title || '').slice(0, 180);
    const params = new URLSearchParams();
    if (snippet) params.set('quote', snippet);
    navigate(`/create-post?${params.toString()}`);
    onClose();
  }, [postId, postData, navigate, recordShare, onClose]);

  const sendToFriends = useCallback(() => {
    if (!postId || !navigate) return;
    recordShare('direct');
    navigate(`/messages/new?sharePost=${encodeURIComponent(postId)}`);
    onClose();
  }, [postId, navigate, recordShare, onClose]);

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
      // Mirror the server's rule: only a *still-active* boost blocks a new one,
      // so an expired promotion stays re-purchasable.
      const expiresAt = post?.boostData?.boostExpiresAt;
      const boostActive = post?.boostData?.isBoosted === true &&
        (typeof expiresAt !== 'number' || expiresAt > Date.now());
      if (boostActive) {
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
        className="rounded-3xl shadow-2xl border backdrop-blur-2xl max-w-[360px] w-full mx-4 p-5 max-h-[80vh] overflow-y-auto"
        style={{ backgroundColor: tokens.overlayPanel, borderColor: tokens.overlayPanelBorder }}
        onClick={(e) => e.stopPropagation()}
        tabIndex={-1} role="dialog" aria-modal="true" aria-label="Share options"
      >
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-semibold text-sm" style={{ color: tokens.text }}>Share</h3>
          <button type="button" onClick={onClose} className="p-1 rounded-full hover:bg-black/10 dark:hover:bg-white/10 transition" aria-label="Close"><X className="w-4 h-4" /></button>
        </div>
        <div className="grid grid-cols-4 gap-3 mb-4" role="listbox">
          <button type="button" onClick={shareNative} className="flex flex-col items-center gap-1 p-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 transition"><Share2 className="w-6 h-6 text-blue-500" /><span className="text-xs">Share</span></button>
          <button type="button" onClick={copyLink} className="flex flex-col items-center gap-1 p-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 transition"><Copy className="w-6 h-6" /><span className="text-xs">Copy</span></button>
          <a href={`https://wa.me/?text=${encodeURIComponent(content + ' ' + url)}`} target="_blank" rel="noopener noreferrer" onClick={() => { recordShare('whatsapp'); onClose(); }} className="flex flex-col items-center gap-1 p-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 transition"><FaWhatsapp className="w-6 h-6 text-green-500" /><span className="text-xs">WA</span></a>
          <a href={`https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(content)}`} target="_blank" rel="noopener noreferrer" onClick={() => { recordShare('telegram'); onClose(); }} className="flex flex-col items-center gap-1 p-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 transition"><FaTelegram className="w-6 h-6 text-blue-500" /><span className="text-xs">TG</span></a>
          <a href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(content)}&url=${encodeURIComponent(url)}`} target="_blank" rel="noopener noreferrer" onClick={() => { recordShare('x'); onClose(); }} className="flex flex-col items-center gap-1 p-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 transition"><FaTwitter className="w-6 h-6 text-sky-500" /><span className="text-xs">X</span></a>
          <a href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`} target="_blank" rel="noopener noreferrer" onClick={() => { recordShare('facebook'); onClose(); }} className="flex flex-col items-center gap-1 p-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 transition"><FaFacebook className="w-6 h-6 text-blue-600" /><span className="text-xs">FB</span></a>
          <button type="button" onClick={async () => { try { await navigator.clipboard.writeText(url); recordShare('instagram'); toast.success('Link copied – share in Instagram DM'); } catch { toast.error('Copy failed'); } onClose(); }} className="flex flex-col items-center gap-1 p-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 transition"><FaInstagram className="w-6 h-6 text-pink-500" /><span className="text-xs">IG</span></button>
          {allowRepost && (
            <button type="button" onClick={repost} className="flex flex-col items-center gap-1 p-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 transition"><RefreshCw className="w-6 h-6 text-green-500" /><span className="text-xs">Repost</span></button>
          )}
        </div>
        <div className="border-t pt-3 space-y-2" style={{ borderColor: tokens.overlayPanelBorder }}>
          {allowRepost && (
            <button type="button" onClick={quotePost} className="w-full text-left px-3 py-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition flex items-center gap-2"><Quote className="w-5 h-5" /><span className="text-sm">Quote Post</span></button>
          )}
          <button type="button" onClick={sendToFriends} className="w-full text-left px-3 py-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition flex items-center gap-2"><Send className="w-5 h-5" /><span className="text-sm">Send to Friends</span></button>
          {hasMedia && allowDownload && (
            <button type="button" onClick={downloadMedia} className="w-full text-left px-3 py-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition flex items-center gap-2"><Download className="w-5 h-5" /><span className="text-sm">Download Media</span></button>
          )}
          <button type="button" onClick={addToStory} className="w-full text-left px-3 py-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition flex items-center gap-2"><PlusCircle className="w-5 h-5" /><span className="text-sm">Add to Story</span></button>
          {isCreator && (
            <button type="button" onClick={promotePost} className="w-full text-left px-3 py-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition flex items-center gap-2"><TrendingUp className="w-5 h-5" style={{ color: tokens.gold }} /><span className="text-sm" style={{ color: tokens.gold }}>Promote Post</span></button>
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
            type="button"
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
const InlineComments = React.memo(({ postId, totalComments, onViewAll, isVisible, tokens, currentUser }) => {
  const [preview, setPreview] = useState([]);
  const [blockedUserIds, setBlockedUserIds] = useState(new Set());
  const abortRef = useRef(null);
  useEffect(() => {
    let cancelled = false;
    const uid = currentUser?.uid;
    if (!uid) { setBlockedUserIds(new Set()); return; }
    userService.getBlockedUserIds(uid)
      .then((res) => {
        if (cancelled) return;
        const list = res instanceof Set ? res : (Array.isArray(res) ? res : (res?.ids || []));
        setBlockedUserIds(list instanceof Set ? list : new Set(list));
      })
      .catch(() => { if (!cancelled) setBlockedUserIds(new Set()); });
    return () => { cancelled = true; };
  }, [currentUser?.uid]);
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
  // A block is mutual: never preview a commenter the viewer blocked or who blocked them.
  const visiblePreview = useMemo(
    () => preview.filter((c) => !blockedUserIds.has(c.userId || c.user?.id)),
    [preview, blockedUserIds]
  );
  if (!visiblePreview.length) return null;
  return (
    <div className="px-4 pb-2">
      <button type="button" onClick={onViewAll} className="text-xs hover:underline mb-1 tabular-nums" style={{ color: tokens.textSecondary }}>
        {typeof totalComments === 'number' ? `View all ${totalComments} comments` : 'View all comments'}
      </button>
      {visiblePreview.map(comment => (
        <div key={comment.id} className="flex gap-2 py-1">
          <LazyImage src={comment.userAvatar || '/assets/default-profile.png'} className="w-6 h-6 rounded-full" alt="" />
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
      // An unknown like total stays unknown — never shifted from a fabricated 0.
      return { ...state, liked: action.payload, reaction: action.payload ? '👍' : null, likeCount: state.likeCount == null ? null : Math.max(0, state.likeCount + (action.payload ? 1 : -1)) };
    case 'SET_REACTION': {
      const newLiked = !!action.payload;
      const delta = newLiked && !state.liked ? 1 : (!newLiked && state.liked ? -1 : 0);
      return { ...state, reaction: action.payload, liked: newLiked, likeCount: state.likeCount == null ? null : Math.max(0, state.likeCount + delta) };
    }
    case 'HYDRATE_VIEWER_STATE': {
      const liked = Boolean(action.payload?.liked);
      const reaction = action.payload?.reaction ?? (liked ? (state.reaction || '👍') : null);
      return {
        ...state,
        liked,
        reaction,
        saved: Boolean(action.payload?.saved),
      };
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

function PostCardContent({ post, currentUser, onOpenComments, onOpenOptions, navigate, onRetry, isVisible = true, authorStanding = null }) {
  const { theme } = useTheme();
  const tokens = useMemo(() => getDesignTokens(theme), [theme]);
  const prefersReducedMotion = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Post-surface interaction telemetry sink. The sub-cards emit
  // `onAnalytics(event, data)`; without a real handler every emit was a no-op.
  // `trackAnalyticsEvent` is a stable module-level function so the memoised
  // sub-cards are not re-rendered by a fresh prop identity.
  const handleAnalytics = trackAnalyticsEvent;

  // Sponsored / ad detection. The feed inserts ad cards shaped
  // `{ type: 'ad', isAd: true, ... }` (feedService `_getAdOptimized`), and a
  // post-embedded sponsor is flagged by `isSponsored`/`adCampaignId`. A card
  // that is not identified as sponsored must never render a sponsored label
  // (FTC-style ad disclosure depends on it), so cover all three signals.
  const isAd = post.type === 'ad' || post.isAd === true;
  const activeCampaignId = post.campaignId || post.adCampaignId || null;
  const commercialDisclosure = post.commercialDisclosure || null;
  const disclosureType = commercialDisclosure?.type || commercialDisclosure?.disclosureType || 'none';
  const brandPartnerName = post.partnership?.brandPartnerName || commercialDisclosure?.brandPartnerName || '';
  const hasCommercialDisclosure = Boolean(disclosureType && disclosureType !== 'none');
  const commercialUrl = commercialDisclosure?.affiliateUrl || commercialDisclosure?.ctaUrl || '';
  const commercialCtaLabel = commercialDisclosure?.ctaLabel || 'Learn More';
  const isSponsored = post.isSponsored === true || post.adCampaignId !== undefined || isAd || hasCommercialDisclosure;
  const [adDetails, setAdDetails] = useState(null);
  useEffect(() => {
    if (isSponsored && post.adCampaignId && !post.campaignId && monetizationService.getAd) {
      monetizationService.getAd('feed', currentUser?.uid, { adId: post.adCampaignId })
        .then(ad => setAdDetails(ad))
        .catch((e) => {
          console.warn('Sponsored post ad detail read failed', e?.message);
        });
    }
  }, [isSponsored, post.adCampaignId, post.campaignId, currentUser?.uid]);

  const adImpressionRecordedRef = useRef(false);
  useEffect(() => {
    if (!isVisible || !isAd || !activeCampaignId || !currentUser?.uid || adImpressionRecordedRef.current) return;
    adImpressionRecordedRef.current = true;
    advertisingService.recordAdDeliveryEvent({
      campaignId: activeCampaignId,
      eventType: 'impression',
      placement: 'home',
    }).catch((e) => {
      console.warn('Ad impression delivery recording failed', e?.message);
    });
  }, [isVisible, isAd, activeCampaignId, currentUser?.uid]);

  // Memoized post data
  // Author standing (verified / creator / premium) lives on the author's
  // `users/{uid}` profile, never on the post document. The card previously read
  // an author-level field and a post-level verified flag that no writer ever
  // set, so these were permanently false. The feed (HomeScreen) resolves the
  // standing and passes it down; a caller without it renders no badge rather
  // than inventing one.
  const isVerified = Boolean(authorStanding?.isVerified);
  const isCreator = Boolean(authorStanding?.isCreator);
  const isPremium = Boolean(authorStanding?.isPremium);
  const hasMedia = !!(post.media && post.media.length > 0);

  const isInitiallyLiked = useMemo(() => {
    const uid = currentUser?.uid;
    if (uid && readLocalLikes(uid)[post.id]) return true;
    return false;
  }, [post.id, currentUser?.uid]);

  // Engagement state with reducer. `liked`/`saved`/`reaction` are per-viewer and
  // are NOT fields on the post document (no writer sets `post.isLiked`,
  // `post.likedBy`, `post.savedBy` or `post.userReaction`); they are hydrated
  // from the viewer's own subcollection docs below. Seeding from those absent
  // post fields always produced the negative.
  const [engagement, dispatch] = useReducer(engagementReducer, {
    liked: isInitiallyLiked,
    reaction: null,
    saved: false,
    followState: 'none',
    likeCount: post.stats?.likes ?? null,
    commentCount: post.stats?.comments ?? null,
    shareCount: post.stats?.shares ?? null,
    giftCount: post.stats?.gifts ?? null,
  });
  const engagementRef = useRef(engagement);
  useEffect(() => { engagementRef.current = engagement; }, [engagement]);

  // Hydrate the real follow state so the button reflects an existing edge or an
  // outstanding private-account request instead of always rendering "Follow"
  // (a user who already followed the author saw a follow button, and a second
  // tap looked like a silent no-op).
  useEffect(() => {
    const uid = currentUser?.uid;
    if (!uid || !post.authorId || uid === post.authorId) return undefined;
    let cancelled = false;
    userService.getFollowStatus(uid, post.authorId)
      .then((res) => {
        if (cancelled) return;
        if (res?.isFollowing) dispatch({ type: 'SET_FOLLOW_STATE', payload: 'following' });
        else if (res?.requestStatus === 'pending') dispatch({ type: 'SET_FOLLOW_STATE', payload: 'requested' });
      })
      .catch(() => { /* ignore transient follow lookup failure */ });
    return () => { cancelled = true; };
  }, [currentUser?.uid, post.authorId]);

  useEffect(() => {
    dispatch({
      type: 'UPDATE_STATS',
      payload: {
        likes: post.stats?.likes,
        comments: post.stats?.comments,
        shares: post.stats?.shares,
        gifts: post.stats?.gifts,
      },
    });
  }, [post.stats?.likes, post.stats?.comments, post.stats?.shares, post.stats?.gifts]);

  // Hydrate the viewer's real like/save/reaction state from their own
  // subcollection docs without double-counting the server's like total.
  useEffect(() => {
    const uid = currentUser?.uid;
    if (!uid || !post.id) return undefined;
    let cancelled = false;
    firestoreService.getPostViewerState?.(post.id, uid)
      .then((state) => {
        if (cancelled || !state) return;
        dispatch({
          type: 'HYDRATE_VIEWER_STATE',
          payload: {
            liked: Boolean(state.liked || readLocalLikes(uid)[post.id]),
            saved: Boolean(state.saved),
            reaction: state.reaction ?? null,
          },
        });
      })
      .catch(() => { /* ignore transient viewer-state hydration failure */ });
    return () => { cancelled = true; };
  }, [currentUser?.uid, post.id]);

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
  const canComment =
    post.enableComments !== false &&
    post.commentsEnabled !== false &&
    post.allowComments !== false &&
    post.engagementControls?.enableComments !== false &&
    post.engagementControls?.commentMode !== 'off';
  const canReact = post.engagementControls?.enableReactions !== false;
  const canSave = post.engagementControls?.enableSaves !== false;
  const canShare = post.engagementControls?.enableShares !== false && post.allowSharing !== false;
  const canRepost = canShare && post.distributionSettings?.allowReposts !== false;
  const canDownload =
    isAuthor || (post.distributionSettings?.allowDownloads !== false && post.allowDownload !== false);
  const canGift =
    isCreator &&
    !isAuthor &&
    post.enableGifts !== false &&
    post.engagementControls?.enableGifts !== false &&
    post.creatorPrograms?.enableGiftsForPost !== false;

  const safetyMeta = post.safetyAccessibility || null;
  const isSensitivePost = Boolean(safetyMeta?.isSensitiveMedia);
  const [sensitiveRevealed, setSensitiveRevealed] = useState(false);
  const [showTranscript, setShowTranscript] = useState(false);

  // Real coin balance (ledger) whenever the gift picker opens.
  useEffect(() => {
    if (!ui.showGiftPicker || !currentUser?.uid) return;
    let cancelled = false;
    (async () => {
      try {
        const bal = await monetizationService.getBalance(currentUser.uid);
        if (!cancelled) setUi(prev => ({ ...prev, giftBalance: typeof bal === 'number' ? bal : null }));
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

  // The viewer's own vote(s) on a post-embedded poll. Supports both single and
  // multi-choice polls cleanly.
  const [userPollVotes, setUserPollVotes] = useState([]);
  useEffect(() => {
    if (post.type !== 'poll' || !post.id || !currentUser?.uid) {
      setUserPollVotes([]);
      return undefined;
    }
    let cancelled = false;
    firestoreService
      .getUserPollVote?.(post.id, currentUser.uid, {
        allowMultiple: post.poll?.allowMultiple === true,
        optionCount: Array.isArray(post.poll?.options) ? post.poll.options.length : 10,
      })
      .then((res) => {
        if (cancelled) return;
        if (Array.isArray(res?.optionIds) && res.optionIds.length > 0) {
          setUserPollVotes(res.optionIds);
        } else if (res?.optionId) {
          setUserPollVotes([res.optionId]);
        } else if (res?.optionIndex != null) {
          setUserPollVotes([`opt_${res.optionIndex}`]);
        } else {
          setUserPollVotes([]);
        }
      })
      .catch(() => {
        if (!cancelled) setUserPollVotes([]);
      });
    return () => {
      cancelled = true;
    };
  }, [post.type, post.id, post.poll?.allowMultiple, post.poll?.options?.length, currentUser?.uid]);

  const pollWithVote = useMemo(
    () =>
      post.poll
        ? {
            ...post.poll,
            userVote:
              userPollVotes.length === 0
                ? null
                : post.poll?.allowMultiple
                  ? userPollVotes
                  : userPollVotes[0],
          }
        : null,
    [post.poll, userPollVotes]
  );

  // Event RSVP hydration & live registration toggle when post.event.id is linked
  const [eventUserStatus, setEventUserStatus] = useState(null);
  const [eventStatsOverride, setEventStatsOverride] = useState(null);
  useEffect(() => {
    const linkedId = post.event?.id;
    const uid = currentUser?.uid;
    if (post.type !== 'event' || !linkedId || !isActiveForSubs) return undefined;
    let cancelled = false;
    import('../services/eventService.js')
      .then(({ getEventService }) => getEventService().getEvent(linkedId))
      .then((ev) => {
        if (cancelled || !ev) return;
        const regStatus = uid ? ev.attendees?.[uid]?.status : null;
        if (regStatus === 'registered' || regStatus === 'waitlist') setEventUserStatus('going');
        else setEventUserStatus(null);
        if (ev.stats) setEventStatsOverride(ev.stats);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [post.type, post.event?.id, currentUser?.uid, isActiveForSubs]);

  const handleEventRSVP = useCallback(
    async (newStatus) => {
      const uid = currentUser?.uid;
      const linkedId = post.event?.id;
      if (!uid || !linkedId) {
        if (navigate && linkedId) navigate(`/event/${linkedId}`);
        return;
      }
      const { getEventService } = await import('../services/eventService.js');
      const eventSvc = getEventService();
      if (newStatus === null) {
        await eventSvc.cancelRegistration(linkedId, uid);
        setEventUserStatus(null);
        setEventStatsOverride((prev) =>
          prev
            ? { ...prev, attendeeCount: Math.max(0, (prev.attendeeCount || 1) - 1) }
            : prev
        );
      } else {
        await eventSvc.registerForEvent(linkedId, uid, 'general');
        setEventUserStatus(newStatus);
        setEventStatsOverride((prev) =>
          prev ? { ...prev, attendeeCount: (prev.attendeeCount || 0) + 1 } : prev
        );
      }
    },
    [currentUser?.uid, post.event?.id, navigate]
  );

  // Q&A state & live refresh after mutations
  const [liveQuestion, setLiveQuestion] = useState(post.question || null);
  useEffect(() => {
    setLiveQuestion(post.question || null);
  }, [post.question]);

  const refreshQuestionFromServer = useCallback(async () => {
    if (!post.id) return;
    try {
      const fresh = await firestoreService.getPost?.(post.id, { cacheFirst: false });
      if (fresh?.question) setLiveQuestion(fresh.question);
    } catch {
      /* noop */
    }
  }, [post.id]);

  // The viewer's own up/down votes on this question's answers.
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
    const q = liveQuestion || post.question;
    if (!q || typeof q !== 'object') return q;
    const answers = Array.isArray(q.answers)
      ? q.answers.map((a) => ({ ...a, userVote: answerVotes[a.id] ?? null }))
      : q.answers;
    return { ...q, answers };
  }, [liveQuestion, post.question, answerVotes]);

  const handleAddAnswer = useCallback(async (answerText, idempotencyKey) => {
    if (!currentUser?.uid) throw new Error('Sign in to answer');
    await firestoreService.addAnswer?.(post.id, answerText, idempotencyKey);
    await refreshQuestionFromServer();
  }, [currentUser, post.id, refreshQuestionFromServer]);

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
    await refreshQuestionFromServer();
  }, [post.id, refreshQuestionFromServer]);

  const handleDeleteAnswer = useCallback(async (answerId) => {
    await firestoreService.deleteAnswer?.(post.id, answerId);
    await refreshQuestionFromServer();
  }, [post.id, refreshQuestionFromServer]);

  const handleMarkBest = useCallback(async (answerId) => {
    await firestoreService.acceptAnswer?.(post.id, answerId);
    await refreshQuestionFromServer();
  }, [post.id, refreshQuestionFromServer]);

  // Reporting a post (or one of its answers) goes through the canonical
  // reportContent path — rate-limited and de-duplicated server-side.
  const handleReportPost = useCallback(async (reason = 'Inappropriate content', details = '') => {
    if (!currentUser?.uid) { toast.error('Sign in to report'); return; }
    try {
      const { callFunction, FUNCTIONS } = await import('../services/callableService.js');
      await callFunction(FUNCTIONS.REPORT_POST, { targetId: post.id, reason, details });
      toast.success('Report submitted');
    } catch (err) {
      toast.error(err.message || 'Report failed');
    }
  }, [currentUser, post.id]);

  const handleReportAnswer = useCallback(
    () => handleReportPost('Inappropriate answer', 'Reported from a Q&A answer'),
    [handleReportPost]);

  const handleReportImage = useCallback(
    () => handleReportPost('Inappropriate image', 'Reported from a post image'),
    [handleReportPost]);

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
    if (!canReact) return;
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
      } catch (err) {
        // A thrown write (network/offline) rolls the optimistic state back.
        rollbackTo(snapshot);
        setLocalLike(userId, post.id, snapshot.liked);
        toast.error('Could not update like');
      }
    }, 250);
  }, [canReact, currentUser, post.id, takeSnapshot, rollbackTo]);

  const handleReaction = useCallback((reaction) => {
    if (!canReact) return;
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
    const votedOptionId = `opt_${index}`;
    const res = await firestoreService.voteOnPoll?.(postId, userId, index, isMultiple);
    if (res?.alreadyVoted) {
      setUserPollVotes((prev) =>
        isMultiple ? Array.from(new Set([...prev, votedOptionId])) : [votedOptionId]
      );
      toast.info('You already voted on this poll');
      return;
    }
    setUserPollVotes((prev) =>
      isMultiple ? Array.from(new Set([...prev, votedOptionId])) : [votedOptionId]
    );
    // Vote rewards are not credited: there is no escrow to fund them (see
    // functions/polls.js), so the card promises no coins.
    void idempotencyKey;
  }, [currentUser, post.poll]);

  const handleSave = useCallback(async () => {
    if (!canSave) return;
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
  }, [canSave, currentUser, post.id, takeSnapshot, rollbackTo]);

  const handleFollow = useCallback(async () => {
    if (!currentUser) return toast.error('Sign in');
    const snapshot = takeSnapshot();
    const isFollowing = snapshot.followState === 'following';
    dispatch({ type: 'SET_FOLLOW_STATE', payload: isFollowing ? 'none' : 'following' });
    triggerHaptic('medium');
    try {
      if (isFollowing) {
        await userService.unfollowUser(currentUser.uid, post.authorId);
      } else {
        const res = await userService.followUser(currentUser.uid, post.authorId);
        // A follow against a private account is a pending request, not an edge:
        // show "Requested" so a tap does not look like it silently failed.
        if (res?.requested || res?.requestStatus === 'pending') {
          dispatch({ type: 'SET_FOLLOW_STATE', payload: 'requested' });
        }
      }
    } catch (err) {
      rollbackTo(snapshot);
      toast.error('Action failed');
      if (process.env.NODE_ENV === 'development') console.error(err);
    }
  }, [currentUser, post.authorId, takeSnapshot, rollbackTo]);

  const handleShare = useCallback(() => {
    if (!canShare) {
      toast.info('Sharing is disabled for this post');
      return;
    }
    if (!currentUser) return toast.error('Sign in');
    setUi(prev => ({ ...prev, showShareSheet: true }));
  }, [canShare, currentUser]);

  const handleOpenSparks = useCallback(() => {
    if (navigate) navigate(`/sparks/${post.canonicalPostId || post.id}`);
  }, [navigate, post.canonicalPostId, post.id]);

  const handleSendGift = useCallback(async (giftType = 'rose') => {
    if (!canGift) return;
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
        dispatch({ type: 'UPDATE_STATS', payload: { gifts: (engagementRef.current.giftCount ?? 0) + 1 } });
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
  }, [canGift, currentUser, post.id, ui.giftLoading]);

  // Double‑tap detection (with lock)
  const handleContainerClick = useCallback((e) => {
    if (!canReact) return;
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
  }, [canReact, handleLikeClick]);

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
    // A post without a parseable createdAt has no posting time; return null so
    // the header omits it rather than claiming it was posted "just now".
    const date = post.createdAt?.toDate?.() || (post.createdAt ? new Date(post.createdAt) : null);
    if (!date || Number.isNaN(date.getTime())) return null;
    try { return formatDistanceToNow(date, { addSuffix: true }); } catch { return null; }
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
  const ctaText = adDetails?.cta || post.cta || post.ctaText || 'Learn More';
  const ctaLink = adDetails?.link || post.link || post.ctaLink;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 12 }}
      transition={{ type: "spring", damping: 26, stiffness: 280 }}
      whileHover={{ scale: 1.004, transition: { duration: 0.2 } }}
      className="relative overflow-hidden my-2 rounded-3xl border shadow-lg backdrop-blur-xl"
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
        <button type="button" onClick={() => navigate(`/profile/${post.authorId}`)} className="relative flex-shrink-0" aria-label={`Visit ${post.authorName}'s profile`}>
          <div className={`absolute -inset-0.5 rounded-full ${isPremium ? 'bg-gradient-to-r from-amber-400 to-yellow-600' : isCreator ? 'bg-arvdoul-gradient' : 'bg-transparent'}`} />
          <LazyImage src={userService.getAvatarUrl(post.authorId, post.authorName, post.authorPhoto)} alt={post.authorName} className="relative w-10 h-10 rounded-full object-cover border-2" style={{ borderColor: tokens.border }} />
          {isPremium && <Crown className="absolute -top-1 -right-1 w-3 h-3 text-yellow-400" />}
          {isVerified && <CheckCircle className="absolute -bottom-0.5 -right-0.5 w-3 h-3 text-cyan-400" />}
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1 flex-wrap">
            <span className="font-semibold text-sm" style={{ color: tokens.text }}>{post.authorName}</span>
            {isVerified && <CheckCircle className="w-3 h-3 text-cyan-400" />}
            {isCreator && <Zap className="w-3 h-3 text-amber-400" />}
            {isSponsored && (
              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-slate-200/80 dark:bg-white/10 text-slate-700 dark:text-gray-300">Sponsored</span>
            )}
          </div>
          <div className="flex items-center gap-1.5 text-xs mt-0.5" style={{ color: tokens.textSecondary }}>
            {post.authorUsername && <span>@{post.authorUsername}</span>}
            {post.authorUsername && postedDateTime && <span>·</span>}
            {postedDateTime && <span>{postedDateTime}</span>}
            {post.visibility === 'public' && <Globe className="w-3 h-3" />}
            {post.visibility === 'followers' && <Users className="w-3 h-3" />}
          </div>
          {post.location && (
            <div className="flex items-center gap-1 text-xs mt-0.5" style={{ color: tokens.accent }}>
              <MapPin className="w-3 h-3" />
              <span>{typeof post.location === 'string' ? post.location : (post.location.name || post.location.label || '')}</span>
            </div>
          )}
          {Array.isArray(post.identityMeta?.collaborators) && post.identityMeta.collaborators.length > 0 && (
            <div className="flex items-center gap-1 text-[11px] mt-0.5" style={{ color: tokens.textSecondary }}>
              <Users className="w-3 h-3" />
              <span>
                with{' '}
                {post.identityMeta.collaborators
                  .slice(0, 3)
                  .map((c) => (typeof c === 'string' ? c : c.displayName || c.username || 'Collaborator'))
                  .join(', ')}
              </span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          {!isAuthor && currentUser && (
            <motion.button
              type="button"
              onClick={handleFollow}
              whileTap={{ scale: 0.96 }}
              className="px-2 py-0.5 rounded-full text-xs font-semibold shadow-md transition-all"
              style={{
                background: engagement.followState === 'none' ? tokens.neonPurple : (theme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'),
                boxShadow: engagement.followState === 'none' ? tokens.followGlow : 'none',
                color: engagement.followState === 'none' ? '#fff' : (theme === 'dark' ? '#fff' : '#0F172A'),
              }}
              aria-label={engagement.followState === 'following' ? `Unfollow ${post.authorName}` : engagement.followState === 'requested' ? `Follow request pending for ${post.authorName}` : `Follow ${post.authorName}`}
            >
              {engagement.followState === 'following' ? 'Following' : engagement.followState === 'requested' ? 'Requested' : 'Follow'}
            </motion.button>
          )}
          <button type="button" onClick={() => onOpenOptions?.(post)} className="p-1 rounded-full hover:bg-black/5 dark:hover:bg-white/5 transition" aria-label="Post options">
            <MoreHorizontal className="w-4 h-4" style={{ color: tokens.textSecondary }} />
          </button>
        </div>
      </div>

      {/* SAFETY & CONTENT WARNING BANNER */}
      {(safetyMeta?.contentWarning || (safetyMeta?.ageRating && safetyMeta.ageRating !== 'all')) && (
        <div className="mx-3 mb-2 px-3 py-1.5 rounded-xl bg-rose-500/10 border border-rose-500/25 flex flex-wrap items-center justify-between gap-2 text-xs text-rose-600 dark:text-rose-300">
          <div className="flex items-center gap-1.5 font-medium">
            <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
            <span>{safetyMeta.contentWarning || 'Sensitive / age-restricted content'}</span>
          </div>
          {safetyMeta?.ageRating && safetyMeta.ageRating !== 'all' && (
            <span className="px-2 py-0.5 rounded-md bg-rose-500/15 font-bold uppercase text-[10px]">
              {safetyMeta.ageRating}
            </span>
          )}
        </div>
      )}

      {/* COMMERCIAL DISCLOSURE & PARTNER TAG */}
      {hasCommercialDisclosure && (
        <div className="mx-3 mb-2 px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/25 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-300 font-semibold">
            <Handshake className="w-3.5 h-3.5 shrink-0" />
            <span>
              {disclosureType === 'paid_partnership' && brandPartnerName
                ? `Paid partnership with ${brandPartnerName}`
                : disclosureType === 'paid_partnership'
                  ? 'Paid partnership'
                  : disclosureType === 'sponsored_ad' || disclosureType === 'sponsored'
                    ? 'Sponsored content'
                    : disclosureType === 'own_promotion'
                      ? 'Own brand / self-promotion'
                      : disclosureType === 'gifted'
                        ? 'Gifted product'
                        : disclosureType === 'affiliate'
                          ? 'Affiliate disclosure'
                          : 'Promotional content'}
            </span>
          </div>
          {commercialDisclosure?.promoCode && (
            <span className="px-2 py-0.5 rounded-md bg-amber-500/15 font-mono text-[11px] font-bold text-amber-600 dark:text-amber-300">
              Code: {commercialDisclosure.promoCode}
            </span>
          )}
        </div>
      )}

      {/* FEATURED PRODUCT / AFFILIATE TAG */}
      {(commercialDisclosure?.productTag || commercialUrl) && (
        <div className="mx-3 mb-2 px-3 py-2 rounded-xl bg-slate-100 dark:bg-white/[0.04] border border-slate-200 dark:border-white/10 flex items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2 min-w-0">
            <Tag className="w-3.5 h-3.5 text-purple-500 shrink-0" />
            <span className="font-medium truncate" style={{ color: tokens.text }}>
              {commercialDisclosure?.productTag || commercialDisclosure?.affiliateLabel || 'Featured partner link'}
            </span>
          </div>
          {commercialUrl && (
            <a
              href={commercialUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => {
                e.stopPropagation();
                if (commercialDisclosure?.affiliateLinkId && currentUser?.uid) {
                  creatorEarningsService.trackAffiliateConversion(commercialDisclosure.affiliateLinkId, 'click')
                    .catch((err) => console.warn('Affiliate click tracking failed', err?.message));
                }
              }}
              className="text-xs font-semibold text-purple-600 dark:text-purple-400 hover:underline flex items-center gap-1 shrink-0"
            >
              <span>{commercialCtaLabel}</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </div>
      )}

      {/* SPONSORED CTA BANNER */}
      {isSponsored && (adDetails || (isAd && ctaLink)) && (
        <div className="mx-3 mb-2 p-2.5 rounded-xl bg-gradient-to-r from-purple-500/20 to-pink-500/20 border border-purple-500/30 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <ShoppingBag className="w-4 h-4 text-arvdoul-purple dark:text-purple-400 shrink-0" />
            <span className="text-xs font-medium text-slate-800 dark:text-white/90 truncate">{adDetails?.title || post.title || 'Sponsored'}</span>
          </div>
          {ctaLink && (
            <a
              href={ctaLink}
              target={ctaLink.startsWith('/') ? undefined : '_blank'}
              rel={ctaLink.startsWith('/') ? undefined : 'noopener noreferrer'}
              onClick={(e) => {
                e.stopPropagation();
                if (activeCampaignId && currentUser?.uid) {
                  advertisingService.recordAdDeliveryEvent({
                    campaignId: activeCampaignId,
                    eventType: 'click',
                    placement: 'home',
                  }).catch((err) => console.warn('Ad click tracking failed', err?.message));
                  advertisingService.trackAdConversion({
                    campaignId: activeCampaignId,
                    eventType: 'click',
                  }).catch((err) => console.warn('Ad conversion tracking failed', err?.message));
                }
                if (ctaLink.startsWith('/') && navigate) {
                  e.preventDefault();
                  navigate(ctaLink);
                }
              }}
              className="text-xs font-medium text-white bg-purple-600 px-3 py-1 rounded-full hover:bg-purple-700 transition shrink-0"
            >
              {ctaText} <ExternalLink className="w-3 h-3 inline ml-1" />
            </a>
          )}
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
            <LazyImage src={userService.getAvatarUrl(post.originalAuthorId, post.originalAuthorName, null)} alt={post.originalAuthorName || ''} className="w-6 h-6 rounded-full object-cover" />
            <span className="text-xs font-semibold" style={{ color: tokens.text }}>{post.originalAuthorName || resolveActorName([], post.originalAuthorId)}</span>
          </div>
          {post.originalContent && (
            <p className="text-sm whitespace-pre-line break-words" style={{ color: tokens.text }}>{post.originalContent}</p>
          )}
          {post.originalMedia?.length > 0 && (
            <LazyImage src={post.originalMedia[0]?.url || post.originalMedia[0]?.thumbnail} alt="" className="mt-2 rounded-xl w-full max-h-60 object-cover" loading="lazy" />
          )}
          {post.originalPostId && (
            <button type="button" onClick={() => navigate(`/post/${post.originalPostId}`)} className="mt-2 text-xs font-medium" style={{ color: tokens.primary }}>
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
      <div className="relative">
        <div className={cn(isSensitivePost && !sensitiveRevealed && (isImage || isVideo) && 'blur-xl pointer-events-none select-none')}>
          {isImage && (
            <ImageCard
              images={post.media}
              onLike={handleLikeClick}
              onSave={handleSave}
              onReport={handleReportImage}
              onShare={handleShare}
              postId={post.id}
              onAnalytics={handleAnalytics}
              disableReactions={!canReact}
              disableSave={!canSave}
              disableShare={!canShare}
              disableDownload={!canDownload}
            />
          )}
          {isVideo && (
            <VideoCard
              src={post.media?.[0]?.url || post.videoUrl || post.video?.url}
              poster={post.media?.[0]?.thumbnailUrl || post.media?.[0]?.thumbnail || post.thumbnailUrl || post.video?.thumbnail}
              muxPlaybackId={post.muxPlaybackId || post.media?.[0]?.muxPlaybackId || null}
              playbackPolicy={post.playbackPolicy || post.media?.[0]?.playbackPolicy || null}
              canonicalPostId={post.canonicalPostId || post.id}
              onOpenSparks={navigate ? handleOpenSparks : undefined}
              isVisible={isVisible}
              onDoubleTap={canReact ? handleLikeClick : undefined}
              postId={post.id}
              currentUser={currentUser}
              onAnalytics={handleAnalytics}
            />
          )}
        </div>
        {isSensitivePost && !sensitiveRevealed && (isImage || isVideo) && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-black/55 backdrop-blur-sm p-4 text-center rounded-2xl mx-3">
            <ShieldAlert className="w-7 h-7 text-amber-300 mb-2" />
            <p className="text-xs font-semibold text-white mb-2">
              {safetyMeta?.contentWarning || 'Sensitive content'}
            </p>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setSensitiveRevealed(true);
              }}
              className="px-3.5 py-1.5 rounded-full bg-white/20 hover:bg-white/30 text-white text-xs font-semibold flex items-center gap-1.5 transition"
            >
              <Eye className="w-3.5 h-3.5" />
              Show content
            </button>
          </div>
        )}
      </div>
      {isAudio && (
        <AudioCard
          audio={{
            ...(post.audio || {}),
            ...(post.media?.[0] || {}),
            url: post.media?.[0]?.url || post.audio?.url,
            name: post.audio?.title || post.media?.[0]?.title || post.media?.[0]?.name || 'Untitled Audio',
            coverUrl: post.media?.[0]?.coverUrl || post.audio?.coverUrl || post.thumbnailUrl || null,
          }}
          isVisible={isVisible}
          tokens={tokens}
          postId={post.id}
          authorName={post.authorName}
        />
      )}
      {isPoll && <PollCard poll={pollWithVote} postId={post.id} currentUser={currentUser} tokens={tokens} onVote={handlePollVote} onAnalytics={handleAnalytics} />}
      {isQuestion && <QuestionCard question={questionWithVotes} postId={post.id} currentUser={currentUser} tokens={tokens} isAuthor={isAuthor} answers={questionWithVotes?.answers || []} userReputation={typeof currentUser?.reputation === 'number' ? currentUser.reputation : null} onSubmitAnswer={handleAddAnswer} onVote={handleAnswerVote} onMarkBest={handleMarkBest} onEditAnswer={handleEditAnswer} onDeleteAnswer={handleDeleteAnswer} onReport={handleReportAnswer} />}
      {isEvent && (
        <EventCard
          event={eventStatsOverride ? { ...post.event, stats: eventStatsOverride } : post.event}
          currentUser={currentUser}
          tokens={tokens}
          userStatus={eventUserStatus}
          onRSVP={post.event?.id && post.event?.rsvpEnabled !== false ? handleEventRSVP : undefined}
          hostName={post.authorName}
          hostUsername={post.authorUsername}
          hostVerified={isVerified}
          onOpenEvent={() => navigate(`/event/${post.event?.id || post.id}`)}
        />
      )}
      {isLink && <LinkCard link={post.link} tokens={tokens} postId={post.id} onAnalytics={handleAnalytics} />}

      {/* ACCESSIBILITY CAPTIONS / TRANSCRIPT */}
      {(safetyMeta?.captionsText || safetyMeta?.transcriptText) && (
        <div className="mx-3 mt-1.5">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setShowTranscript((prev) => !prev);
            }}
            className="flex items-center gap-1.5 text-[11px] font-medium hover:underline"
            style={{ color: tokens.textSecondary }}
          >
            <FileText className="w-3 h-3" />
            <span>{showTranscript ? 'Hide captions & transcript' : 'Show captions & transcript'}</span>
          </button>
          {showTranscript && (
            <div
              className="mt-1 p-2.5 rounded-xl border text-xs space-y-1.5"
              style={{ backgroundColor: tokens.cardBgAlt, borderColor: tokens.border, color: tokens.text }}
            >
              {safetyMeta.captionsText && <p>{safetyMeta.captionsText}</p>}
              {safetyMeta.transcriptText && (
                <p className="text-[11px]" style={{ color: tokens.textSecondary }}>{safetyMeta.transcriptText}</p>
              )}
            </div>
          )}
        </div>
      )}

      {/* INLINE COMMENT PREVIEW */}
      {canComment && (
        <InlineComments postId={post.id} totalComments={engagement.commentCount} onViewAll={() => onOpenComments?.(post)} isVisible={isActiveForSubs} tokens={tokens} currentUser={currentUser} />
      )}

      {/* ENGAGEMENT STATS (simplified – only analytics toggle for creators) */}
      <div className="px-3 py-1 flex justify-end items-center text-sm">
        {isAuthor && (
          <button type="button" onClick={() => setUi(prev => ({ ...prev, showAnalytics: !prev.showAnalytics }))} className="flex items-center gap-1 hover:underline text-xs" style={{ color: tokens.textSecondary }} aria-label="View post analytics">
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
            <div className="bg-slate-100 dark:bg-black/20 rounded-xl p-2 space-y-1 text-xs" style={{ color: tokens.textSecondary }}>
              {analyticsLoading ? (
                <div className="py-1 text-center">Loading analytics…</div>
              ) : postAnalytics ? (
                <>
                  {[['Views', postAnalytics.totalViews], ['Likes', postAnalytics.totalLikes], ['Comments', postAnalytics.totalComments], ['Shares', postAnalytics.totalShares]].map(([label, value]) => (
                    <div key={label} className="flex justify-between"><span>{label}</span><span className="tabular-nums font-medium">{typeof value === 'number' ? value.toLocaleString() : '—'}</span></div>
                  ))}
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
          {canReact && (
            <div className="relative flex items-center">
              <button
                type="button"
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
                {engagement.reaction ? <span className="text-base">{engagement.reaction}</span> : <Heart className={cn('w-4 h-4', engagement.liked && 'fill-red-500')} style={{ color: engagement.liked ? '#ef4444' : 'white' }} />}
                <span className="text-xs text-white/90">Like</span>
                {engagement.likeCount > 0 && (
                  <span className="absolute -top-2 -right-2 min-w-[18px] h-4 px-1 text-[10px] font-bold text-white bg-red-500 rounded-full flex items-center justify-center shadow-sm tabular-nums">
                    {formatCount(engagement.likeCount)}
                  </span>
                )}
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  if (likeButtonRef.current) {
                    const rect = likeButtonRef.current.getBoundingClientRect();
                    setReactionsTargetRect(rect);
                  }
                  setUi(prev => ({ ...prev, showReactionsPicker: !prev.showReactionsPicker }));
                }}
                className="ml-1 p-0.5 rounded-full hover:bg-white/10 text-white/75 hover:text-white transition text-xs"
                title="Reactions"
                aria-label="Reactions"
              >
                <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
            </div>
          )}

          {/* Comment button with bubble */}
          {canComment && (
            <button
              type="button"
              onClick={() => onOpenComments?.(post)}
              className="flex items-center gap-1.5 text-sm text-white hover:text-white/80 transition relative"
              aria-label="Comment"
            >
              <MessageCircle className="w-4 h-4" />
              <span className="text-xs text-white/90">Comment</span>
              {engagement.commentCount > 0 && (
                <span className="absolute -top-2 -right-2 min-w-[18px] h-4 px-1 text-[10px] font-bold text-white bg-blue-500 rounded-full flex items-center justify-center shadow-sm tabular-nums">
                  {formatCount(engagement.commentCount)}
                </span>
              )}
            </button>
          )}

          {/* Share button with bubble */}
          {canShare && (
            <button
              type="button"
              onClick={handleShare}
              className="flex items-center gap-1.5 text-sm text-white hover:text-white/80 transition relative"
              aria-label="Share"
            >
              <Share2 className="w-4 h-4" />
              <span className="text-xs text-white/90">Share</span>
              {engagement.shareCount > 0 && (
                <span className="absolute -top-2 -right-2 min-w-[18px] h-4 px-1 text-[10px] font-bold text-white bg-green-500 rounded-full flex items-center justify-center shadow-sm tabular-nums">
                  {formatCount(engagement.shareCount)}
                </span>
              )}
            </button>
          )}

          {/* Save button */}
          {canSave && (
            <button
              type="button"
              onClick={handleSave}
              className={cn("flex items-center gap-1.5 text-sm transition", engagement.saved ? 'text-yellow-400' : 'text-white hover:text-white/80')}
              aria-label={engagement.saved ? 'Unsave' : 'Save'}
              aria-pressed={engagement.saved}
            >
              <Bookmark className={cn('w-4 h-4', engagement.saved && 'fill-current')} />
              <span className="text-xs">Save</span>
            </button>
          )}

          {/* Gift button (creator only, unless disabled on post) */}
          {canGift && (
            <button
              type="button"
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
        {ui.showReactionsPicker && canReact && <CardReactionsPicker onSelect={handleReactionSelect} onClose={closeReactionsPicker} tokens={tokens} targetRect={reactionsTargetRect} />}
        {ui.showShareSheet && canShare && (
          <CardShareSheet
            url={`${typeof window !== 'undefined' ? window.location.origin : ''}${isVideo ? `/sparks/${post.canonicalPostId || post.id}` : `/post/${post.id}`}`}
            content={post.content?.substring(0, 100) || 'Check out this post'}
            onClose={() => setUi(prev => ({ ...prev, showShareSheet: false }))}
            onShared={() => {
              dispatch({
                type: 'UPDATE_STATS',
                payload: { shares: engagementRef.current.shareCount == null ? 1 : engagementRef.current.shareCount + 1 },
              });
            }}
            tokens={tokens}
            postId={post.id}
            postData={post}
            isCreator={isCreator}
            hasMedia={hasMedia}
            navigate={navigate}
            currentUser={currentUser}
            allowRepost={canRepost}
            allowDownload={canDownload}
          />
        )}
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
const CardGiftPicker = ({ onSelect, onClose, sending, balance, tokens: cardTokens }) => {
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
        className="w-full max-w-sm rounded-t-3xl sm:rounded-3xl p-5 border backdrop-blur-2xl shadow-2xl"
        style={{ backgroundColor: cardTokens.overlayPanel, borderColor: cardTokens.overlayPanelBorder }}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold" style={{ color: cardTokens.text }}>Send a Gift</h3>
          <button type="button" onClick={onClose} disabled={sending} className="p-1" style={{ color: cardTokens.textSecondary }} aria-label="Close">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="flex items-center justify-between mb-4 text-sm">
          <span style={{ color: cardTokens.textSecondary }}>Your balance</span>
          <span className="font-bold text-amber-500 flex items-center gap-1 tabular-nums">
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
                borderColor: selected.type === gift.type ? tokens.color.brand.violet : cardTokens.border,
                backgroundColor: selected.type === gift.type ? brandRgba(0.15) : 'transparent',
              }}
            >
              <div className="text-2xl mb-1">{gift.emoji}</div>
              <div className="text-xs font-semibold truncate" style={{ color: cardTokens.text }}>{gift.name}</div>
              <div className="text-xs font-bold text-amber-500 tabular-nums inline-flex items-center justify-center gap-1">
                <span>{gift.coins}</span>
                <Coins className="w-3 h-3" aria-hidden="true" />
              </div>
            </button>
          ))}
        </div>
        <button
          type="button"
          disabled={sending || !canAfford}
          onClick={() => onSelect(selected.type)}
          className="w-full py-3 rounded-2xl font-bold bg-arvdoul-gradient text-white hover:opacity-95 disabled:opacity-50"
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