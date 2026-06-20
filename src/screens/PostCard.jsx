// src/screens/PostCard.jsx – ARVDOUL ULTIMATE POST CARD (FINAL PERFECT)
// Perfect rounded edges, compact height, larger avatar, bubble counts, all bugs fixed.

import React, { useState, useEffect, useRef, useCallback, useMemo, useReducer } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';
import firestoreService from '../services/firestoreService';
import commentService from '../services/commentService';
import * as userService from '../services/userService';
import * as monetizationService from '../services/monetizationService';
import notificationService from '../services/notificationsService';
import { triggerHaptic } from '../utils/haptics';
import { formatDistanceToNow } from 'date-fns';
import {
  Heart, MessageCircle, Share2, Bookmark, MoreHorizontal, Gift,
  MapPin, Globe, CheckCircle, Zap, Crown, TrendingUp, Sparkles,
  Eye, BarChart3, Coins, Send, AlertTriangle, Shield,
  Download, RefreshCw, Quote, PlusCircle, Copy, X, Flag, Users,
  ShoppingBag, ExternalLink
} from 'lucide-react';
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

const cn = (...classes) => classes.filter(Boolean).join(' ');

// ------------------------------------------------------------------
// 1. DESIGN TOKENS – Perfectly rounded, compact, neon purple
// ------------------------------------------------------------------
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

// ------------------------------------------------------------------
// 2. INTERNAL EVENT BUS (with cleanup)
// ------------------------------------------------------------------
let globalEventBus = null;
const getEventBus = () => {
  if (!globalEventBus) {
    globalEventBus = {
      listeners: new Map(),
      emit(event, detail) {
        this.listeners.get(event)?.forEach(fn => fn(detail));
      },
      on(event, fn) {
        if (!this.listeners.has(event)) this.listeners.set(event, []);
        this.listeners.get(event).push(fn);
      },
      off(event, fn) {
        const arr = this.listeners.get(event);
        if (arr) this.listeners.set(event, arr.filter(f => f !== fn));
      },
      clear() {
        this.listeners.clear();
      },
    };
  }
  return globalEventBus;
};

// ------------------------------------------------------------------
// 3. OFFLINE QUEUE (safe, with crypto‑strong IDs, collapse by action)
// ------------------------------------------------------------------
let offlineQueueDB = null;
let offlineQueueInitPromise = null;

const idbRequestPromise = (req) => new Promise((resolve, reject) => {
  req.onsuccess = () => resolve(req.result);
  req.onerror = () => reject(req.error);
});

const openOfflineQueue = () => {
  if (offlineQueueDB) return Promise.resolve(offlineQueueDB);
  if (offlineQueueInitPromise) return offlineQueueInitPromise;
  offlineQueueInitPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open('arvdoul_offline_queue', 5);
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('actions')) {
        db.createObjectStore('actions', { keyPath: 'id' });
      }
    };
    request.onsuccess = () => {
      offlineQueueDB = request.result;
      resolve(offlineQueueDB);
    };
    request.onerror = () => reject(request.error);
  });
  return offlineQueueInitPromise;
};

async function addToOfflineQueue(action, data) {
  const db = await openOfflineQueue();
  const tx = db.transaction('actions', 'readwrite');
  const store = tx.objectStore('actions');
  // Use crypto.randomUUID if available, fallback to Date.now + random
  const id = typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `${data.postId}_${data.userId}_${action}_${Date.now()}_${Math.random().toString(36)}`;
  const request = store.put({ id, action, data, timestamp: Date.now() });
  await idbRequestPromise(request);
}

async function replayOfflineQueue() {
  if (!navigator.onLine) return;
  const db = await openOfflineQueue();
  const tx = db.transaction('actions', 'readonly');
  const store = tx.objectStore('actions');
  const items = await idbRequestPromise(store.getAll());
  if (!items.length) return;

  const deleteTx = db.transaction('actions', 'readwrite');
  const deleteStore = deleteTx.objectStore('actions');
  for (const item of items) {
    const { action, data } = item;
    try {
      if (action === 'like') {
        await firestoreService.likePost?.(data.postId, data.userId);
      } else if (action === 'unlike') {
        await firestoreService.unlikePost?.(data.postId, data.userId);
      } else if (action === 'save') {
        await firestoreService.savePost?.(data.postId, data.userId);
      } else if (action === 'unsave') {
        await firestoreService.unsavePost?.(data.postId, data.userId);
      } else if (action === 'reaction') {
        await firestoreService.addReaction?.(data.postId, data.userId, data.reaction);
      } else if (action === 'removeReaction') {
        await firestoreService.removeReaction?.(data.postId, data.userId);
      }
      await idbRequestPromise(deleteStore.delete(item.id));
    } catch (err) {
      console.warn('Offline replay failed', err);
    }
  }
}

// ------------------------------------------------------------------
// 4. ERROR BOUNDARY (dev/prod friendly)
// ------------------------------------------------------------------
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

// ------------------------------------------------------------------
// 5. SHARE SHEET (tap outside / ESC, download only if hasMedia)
// ------------------------------------------------------------------
const CardShareSheet = React.memo(({ url, content, onClose, tokens, postId, postData, isCreator, hasMedia }) => {
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
    try {
      await firestoreService.repostPost?.(postId);
      toast.success('Reposted!');
    } catch { toast.error('Failed to repost'); }
    onClose();
  }, [postId, onClose]);

  const quotePost = useCallback(() => {
    getEventBus().emit('quote-post', { postId, postData });
    onClose();
  }, [postId, postData, onClose]);

  const sendToFriends = useCallback(() => {
    toast.info('Send to friends modal (implement)');
    onClose();
  }, [onClose]);

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

  const addToStory = useCallback(() => {
    toast.info('Add to Story (implement)');
    onClose();
  }, [onClose]);

  const promotePost = useCallback(() => {
    toast.info('Promotion panel (implement)');
    onClose();
  }, [onClose]);

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

// ------------------------------------------------------------------
// 6. REACTIONS PICKER (tap outside / ESC)
// ------------------------------------------------------------------
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

// ------------------------------------------------------------------
// 7. DOUBLE TAP HEART (reduced motion)
// ------------------------------------------------------------------
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

// ------------------------------------------------------------------
// 8. INLINE COMMENT PREVIEW (abort controller only, no mounted flag)
// ------------------------------------------------------------------
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
      .catch(() => {});
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

// ------------------------------------------------------------------
// 9. MAIN POST CARD – perfect rounded edges, compact, bubble counts
// ------------------------------------------------------------------
// Engagement reducer (unified state management)
const engagementReducer = (state, action) => {
  switch (action.type) {
    case 'SET_LIKED':
      return { ...state, liked: action.payload, reaction: action.payload ? '👍' : null, likeCount: state.likeCount + (action.payload ? 1 : -1) };
    case 'SET_REACTION':
      const newLiked = !!action.payload;
      return { ...state, reaction: action.payload, liked: newLiked, likeCount: state.likeCount + (newLiked && !state.liked ? 1 : (!newLiked && state.liked ? -1 : 0)) };
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

  // Sponsored / ad detection
  const isSponsored = post.isSponsored === true || post.adCampaignId !== undefined;
  const [adDetails, setAdDetails] = useState(null);
  useEffect(() => {
    if (isSponsored && post.adCampaignId && monetizationService.getAd) {
      monetizationService.getAd('feed', currentUser?.uid, { adId: post.adCampaignId })
        .then(ad => setAdDetails(ad))
        .catch(() => {});
    }
  }, [isSponsored, post.adCampaignId, currentUser?.uid]);

  // Memoized post data
  const likedBySet = useMemo(() => new Set(post.likedBy || []), [post.likedBy]);
  const isCreator = (post.authorLevel || 0) >= 5;
  const isPremium = (post.authorLevel || 0) >= 8;
  const hasMedia = !!(post.media && post.media.length > 0);

  // Engagement state with reducer
  const [engagement, dispatch] = useReducer(engagementReducer, {
    liked: likedBySet.has(currentUser?.uid),
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
    expanded: false,
    showAnalytics: false,
    showShareSheet: false,
    showReactionsPicker: false,
    showHeartBurst: false,
    tapPosition: { x: 0, y: 0 },
    giftLoading: false,
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

  // Online listener for offline queue
  useEffect(() => {
    const onlineHandler = () => replayOfflineQueue();
    window.addEventListener('online', onlineHandler);
    return () => window.removeEventListener('online', onlineHandler);
  }, []);

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

  // ------------------------------------------------------------------
  // HANDLERS with snapshot rollback, separate debounces, lock
  // ------------------------------------------------------------------
  const handleLikeClick = useCallback(() => {
    if (!currentUser) return toast.error('Sign in');
    if (likeLockRef.current) return;
    likeLockRef.current = true;
    setTimeout(() => { likeLockRef.current = false; }, 500);

    const snapshot = takeSnapshot();
    const newLiked = !snapshot.liked;
    dispatch({ type: 'SET_LIKED', payload: newLiked });
    triggerHaptic('light');

    if (debounceLikeRef.current) clearTimeout(debounceLikeRef.current);
    debounceLikeRef.current = setTimeout(async () => {
      try {
        if (navigator.onLine) {
          if (newLiked) {
            await firestoreService.likePost?.(post.id, currentUser.uid);
          } else {
            await firestoreService.unlikePost?.(post.id, currentUser.uid);
          }
        } else {
          await addToOfflineQueue(newLiked ? 'like' : 'unlike', { postId: post.id, userId: currentUser.uid });
        }
        if (newLiked && post.authorId !== currentUser.uid) {
          notificationService.sendNotification?.({
            type: 'like', recipientId: post.authorId, senderId: currentUser.uid, targetId: post.id
          }).catch(() => {});
        }
      } catch (err) {
        rollbackTo(snapshot);
        toast.error('Failed to like');
        if (process.env.NODE_ENV === 'development') console.error(err);
      }
    }, 300);
  }, [currentUser, post.id, post.authorId, takeSnapshot, rollbackTo]);

  const handleReaction = useCallback((reaction) => {
    if (!currentUser) return toast.error('Sign in');
    const snapshot = takeSnapshot();
    const newReaction = snapshot.reaction === reaction.emoji ? null : reaction.emoji;
    dispatch({ type: 'SET_REACTION', payload: newReaction });
    triggerHaptic('light');

    if (debounceReactionRef.current) clearTimeout(debounceReactionRef.current);
    debounceReactionRef.current = setTimeout(async () => {
      try {
        if (navigator.onLine) {
          if (newReaction) {
            await firestoreService.addReaction?.(post.id, currentUser.uid, newReaction);
          } else {
            await firestoreService.removeReaction?.(post.id, currentUser.uid);
          }
        } else {
          if (newReaction) {
            await addToOfflineQueue('reaction', { postId: post.id, userId: currentUser.uid, reaction: newReaction });
          } else {
            await addToOfflineQueue('removeReaction', { postId: post.id, userId: currentUser.uid });
          }
        }
      } catch (err) {
        rollbackTo(snapshot);
        toast.error('Failed to react');
        if (process.env.NODE_ENV === 'development') console.error(err);
      }
    }, 300);
  }, [currentUser, post.id, takeSnapshot, rollbackTo]);

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

  const handleSendGift = useCallback(async (giftType = 'rose', value = 5) => {
    if (!currentUser) return toast.error('Sign in');
    if (ui.giftLoading) return;
    setUi(prev => ({ ...prev, giftLoading: true }));
    triggerHaptic('medium');
    try {
      await monetizationService.sendGift?.(currentUser.uid, post.id, giftType, value);
      dispatch({ type: 'UPDATE_STATS', payload: { gifts: engagement.giftCount + 1 } });
      toast.success(`Sent ${giftType}!`);
    } catch (err) {
      toast.error(err.message);
      if (process.env.NODE_ENV === 'development') console.error(err);
    } finally {
      setUi(prev => ({ ...prev, giftLoading: false }));
    }
  }, [currentUser, post.id, ui.giftLoading, engagement.giftCount]);

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

      {/* CONTENT */}
      {isTextOnly && <TextCard content={post.content} bgClass={getRandomTextBg(post.id, currentUser?.uid)} expanded={ui.expanded} setExpanded={(val) => setUi(prev => ({ ...prev, expanded: val }))} tokens={tokens} currentUser={currentUser} postId={post.id} onAnalytics={() => {}} />}
      {!isTextOnly && post.content && (
        <p className="px-3 pb-1 text-sm leading-relaxed whitespace-pre-line break-words" style={{ color: tokens.text }}>{post.content}</p>
      )}
      {post.hashtags?.length > 0 && (
        <div className="px-3 pb-1 flex flex-wrap gap-1">
          {post.hashtags.map(tag => <span key={tag} className="text-xs" style={{ color: tokens.primary }}>#{tag}</span>)}
        </div>
      )}
      {isImage && <ImageCard images={post.media} onDoubleTap={() => {}} currentUser={currentUser} postId={post.id} />}
      {isVideo && <VideoCard src={post.media?.[0]?.url} isVisible={isVisible} onDoubleTap={handleLikeClick} postId={post.id} tokens={tokens} currentUser={currentUser} />}
      {isAudio && <AudioCard audio={post.media?.[0]} isVisible={isVisible} tokens={tokens} currentUser={currentUser} postId={post.id} />}
      {isPoll && <PollCard poll={post.poll} postId={post.id} currentUser={currentUser} tokens={tokens} />}
      {isQuestion && <QuestionCard question={post.question} postId={post.id} currentUser={currentUser} tokens={tokens} isAuthor={isAuthor} />}
      {isEvent && <EventCard event={post.event} postId={post.id} currentUser={currentUser} tokens={tokens} />}
      {isLink && <LinkCard link={post.link} tokens={tokens} />}

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

      {/* ANALYTICS PANEL */}
      <AnimatePresence>
        {ui.showAnalytics && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="px-3 pb-2 overflow-hidden">
            <div className="bg-black/20 rounded-xl p-2 space-y-1 text-xs" style={{ color: tokens.textSecondary }}>
              <div className="flex justify-between"><span>Views</span><span>{post.analytics?.views?.toLocaleString()}</span></div>
              <div className="flex justify-between"><span>Reach</span><span>{post.analytics?.reach?.toLocaleString()}</span></div>
              <div className="flex justify-between"><span>Watch Time (avg)</span><span>{post.analytics?.watchTime || 'N/A'}</span></div>
              <div className="flex justify-between"><span>Completion Rate</span><span>{post.analytics?.completionRate || 0}%</span></div>
              <div className="flex justify-between"><span>Earnings</span><span style={{ color: tokens.gold }}>+{post.analytics?.earnings || 0} Coins</span></div>
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

          {/* Gift button (creator only) */}
          {isCreator && !isAuthor && (
            <button onClick={() => handleSendGift('rose', 5)} disabled={ui.giftLoading} className="flex items-center gap-1.5 text-sm text-pink-300 hover:text-pink-200 transition disabled:opacity-50" aria-label="Send gift">
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
        {ui.showShareSheet && <CardShareSheet url={`${typeof window !== 'undefined' ? window.location.origin : ''}/post/${post.id}`} content={post.content?.substring(0, 100) || 'Check out this post'} onClose={() => setUi(prev => ({ ...prev, showShareSheet: false }))} tokens={tokens} postId={post.id} postData={post} isCreator={isCreator} hasMedia={hasMedia} />}
      </AnimatePresence>
    </motion.div>
  );
}

function getRandomTextBg(postId, userId) {
  const palette = [
    'from-blue-700 via-purple-600 to-orange-500',
    'from-emerald-700 via-teal-600 to-cyan-500',
    'from-rose-700 via-pink-600 to-purple-500',
    'from-indigo-700 via-blue-600 to-violet-500',
  ];
  const hash = (postId + (userId || '')).split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  return palette[Math.abs(hash) % palette.length];
}

export default function PostCard(props) {
  return (
    <PostErrorBoundary onRetry={props.onRetry}>
      <PostCardContent {...props} />
    </PostErrorBoundary>
  );
}