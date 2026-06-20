// src/screens/PostCard/ImageCard.jsx
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { motion, AnimatePresence, useMotionValue, useMotionValueEvent } from 'framer-motion';
import {
  ChevronLeft, ChevronRight, X, ZoomIn, ZoomOut,
  Download, Share2, Image, AlertCircle, Heart, Save, Flag
} from 'lucide-react';
import { toast } from 'sonner';

// ------------------------------------------------------------------
// SSR-safe helpers
// ------------------------------------------------------------------
const hasWindow = typeof window !== 'undefined';

const requestIdle = hasWindow
  ? window.requestIdleCallback || ((cb) => setTimeout(() => cb({ didTimeout: false, timeRemaining: () => 0 }), 1))
  : (cb) => setTimeout(cb, 1);
const cancelIdle = hasWindow
  ? window.cancelIdleCallback || clearTimeout
  : clearTimeout;

// ------------------------------------------------------------------
// LRU URL cache (true LRU with Map)
// ------------------------------------------------------------------
const urlCache = new Map();
let cacheMaxSize = 50;
if (hasWindow && navigator.deviceMemory) {
  cacheMaxSize = Math.min(200, Math.max(20, navigator.deviceMemory * 12));
}
const addToUrlCache = (url) => {
  if (urlCache.has(url)) urlCache.delete(url);
  if (urlCache.size >= cacheMaxSize) {
    const oldest = urlCache.keys().next().value;
    urlCache.delete(oldest);
  }
  urlCache.set(url, Date.now());
};
const isUrlCached = (url) => urlCache.has(url);

// ------------------------------------------------------------------
// LocalStorage LRU with timestamp (safe)
// ------------------------------------------------------------------
const STORAGE_KEY_PREFIX = 'arvdoul_img_idx_';
const MAX_STORED_INDICES = 100;
const saveIndex = (postId, index) => {
  if (!hasWindow) return;
  const key = `${STORAGE_KEY_PREFIX}${postId}`;
  const data = { index, timestamp: Date.now() };
  localStorage.setItem(key, JSON.stringify(data));

  // Evict oldest by timestamp
  try {
    const allKeys = Object.keys(localStorage).filter(k => k.startsWith(STORAGE_KEY_PREFIX));
    if (allKeys.length > MAX_STORED_INDICES) {
      const entries = allKeys.map(k => {
        const raw = localStorage.getItem(k);
        try {
          const parsed = JSON.parse(raw);
          return { key: k, timestamp: parsed.timestamp };
        } catch {
          return { key: k, timestamp: 0 };
        }
      });
      entries.sort((a, b) => a.timestamp - b.timestamp);
      const toRemove = entries.slice(0, allKeys.length - MAX_STORED_INDICES);
      toRemove.forEach(e => localStorage.removeItem(e.key));
    }
  } catch (e) { /* ignore */ }
};
const loadIndex = (postId) => {
  if (!hasWindow) return 0;
  const raw = localStorage.getItem(`${STORAGE_KEY_PREFIX}${postId}`);
  if (!raw) return 0;
  try {
    const { index } = JSON.parse(raw);
    return typeof index === 'number' ? index : 0;
  } catch {
    return 0;
  }
};

// ------------------------------------------------------------------
// Moderation cache with size limit
// ------------------------------------------------------------------
const moderationCache = new Map();
const MODERATION_CACHE_MAX = 500;
const MODERATION_TTL = 5 * 60 * 1000;
const getModeration = (url) => {
  const entry = moderationCache.get(url);
  if (entry && Date.now() - entry.timestamp < MODERATION_TTL) return entry.isSafe;
  return null;
};
const setModeration = (url, isSafe) => {
  if (moderationCache.size >= MODERATION_CACHE_MAX) {
    let oldest = null;
    for (const [key, val] of moderationCache.entries()) {
      if (!oldest || val.timestamp < oldest.timestamp) oldest = { key, timestamp: val.timestamp };
    }
    if (oldest) moderationCache.delete(oldest.key);
  }
  moderationCache.set(url, { isSafe, timestamp: Date.now() });
};

// ------------------------------------------------------------------
// Helpers
// ------------------------------------------------------------------
const isLowEndDevice = () => {
  if (!hasWindow) return false;
  const memory = navigator.deviceMemory || 4;
  const cores = navigator.hardwareConcurrency || 4;
  return memory <= 2 || cores <= 2;
};
const haptic = (pattern = 10) => {
  if (hasWindow && navigator.vibrate) navigator.vibrate(pattern);
};
const getNetworkQuality = () => {
  if (!hasWindow) return '4g';
  const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  if (!conn) return '4g';
  return conn.effectiveType || '4g';
};

// ------------------------------------------------------------------
// Analytics batching (per component)
// ------------------------------------------------------------------
const useAnalyticsBatcher = (onAnalytics) => {
  const queue = useRef([]);
  const timer = useRef(null);
  const flush = useCallback(() => {
    if (!onAnalytics || queue.current.length === 0) return;
    onAnalytics('batch', { events: queue.current });
    queue.current = [];
  }, [onAnalytics]);
  const push = useCallback((event, data) => {
    if (!onAnalytics) return;
    queue.current.push({ event, data, timestamp: Date.now() });
    if (queue.current.length >= 30) flush();
    else if (!timer.current) {
      timer.current = setTimeout(() => {
        flush();
        timer.current = null;
      }, 5000);
    }
  }, [flush, onAnalytics]);
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
    flush();
  }, [flush]);
  return push;
};

// ------------------------------------------------------------------
// Retry with exponential backoff (correct increment)
// ------------------------------------------------------------------
const useRetry = () => {
  const retryMap = useRef(new Map());
  const timers = useRef({});

  const getAttempts = useCallback((url) => retryMap.current.get(url) || 0, []);
  const shouldRetry = useCallback((url) => getAttempts(url) < 3, [getAttempts]);
  const incrementAttempt = useCallback((url) => {
    const prev = retryMap.current.get(url) || 0;
    retryMap.current.set(url, prev + 1);
  }, []);
  const resetRetry = useCallback((url) => retryMap.current.delete(url), []);
  const scheduleRetry = useCallback((url, callback, delay) => {
    if (timers.current[url]) clearTimeout(timers.current[url]);
    timers.current[url] = setTimeout(() => {
      callback();
      delete timers.current[url];
    }, delay);
  }, []);

  useEffect(() => () => {
    Object.values(timers.current).forEach(clearTimeout);
    retryMap.current.clear();
  }, []);

  return { getAttempts, shouldRetry, incrementAttempt, resetRetry, scheduleRetry };
};

// ------------------------------------------------------------------
// Memoized image slide (renders only when needed)
// ------------------------------------------------------------------
const ImageSlide = React.memo(({
  image,
  index,
  isCurrent,
  loaded,
  error,
  loadStage,
  networkQuality,
  onLoad,
  onError,
  onClick,
  layoutId,
  srcSetGenerator,
}) => {
  const getOptimalUrl = () => {
    if (error) return null;
    const stage = loadStage;
    if (stage < 2 && networkQuality === 'slow-2g') {
      return image.lowResUrl || (image.url.includes('?') ? `${image.url}&w=200` : `${image.url}?w=200`);
    }
    if (stage === 0) return image.lowResUrl || (image.url.includes('?') ? `${image.url}&w=20` : `${image.url}?w=20`);
    if (stage === 1) return image.lowResUrl || (image.url.includes('?') ? `${image.url}&w=400` : `${image.url}?w=400`);
    return image.url;
  };
  const currentUrl = getOptimalUrl();
  const hasError = error;

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') onClick();
  };

  return (
    <div className="relative w-full h-full">
      {!loaded && !hasError && (
        <div className="absolute inset-0 bg-black/10 animate-pulse rounded-xl" style={{ aspectRatio: '16/9' }} />
      )}
      {!hasError && currentUrl && (
        <motion.img
          src={currentUrl}
          srcSet={srcSetGenerator ? srcSetGenerator(currentUrl, window.innerWidth) : undefined}
          alt={image.alt || 'Post image'}
          className="w-full h-auto max-h-[500px] object-cover cursor-pointer"
          onClick={onClick}
          onKeyDown={handleKeyDown}
          tabIndex={0}
          role="button"
          aria-label={`Image ${index + 1}`}
          loading="lazy"
          onLoad={() => onLoad(index, 2)}
          onError={() => onError(index)}
          style={{ opacity: loaded ? 1 : 0 }}
          layoutId={isCurrent ? layoutId : undefined}
        />
      )}
      {hasError && (
        <div className="w-full h-64 bg-black/20 rounded-2xl flex flex-col items-center justify-center gap-2">
          <AlertCircle className="w-8 h-8 text-red-400" />
          <span className="text-xs text-white/60">Failed to load</span>
          <button
            onClick={() => onError(index, true)}
            className="px-3 py-1 text-xs bg-white/20 rounded-full hover:bg-white/30"
          >
            Retry
          </button>
        </div>
      )}
    </div>
  );
});

// ------------------------------------------------------------------
// Gallery dot with accessibility
// ------------------------------------------------------------------
const Dot = ({ active, index, onClick }) => (
  <button
    onClick={() => onClick(index)}
    className={`w-2 h-2 rounded-full transition-all focus:outline-none focus:ring-1 focus:ring-purple-400 ${
      active ? 'bg-white scale-110' : 'bg-white/50 hover:bg-white/80'
    }`}
    aria-label={`Go to image ${index + 1}`}
  />
);

// ------------------------------------------------------------------
// Error boundary for this card
// ------------------------------------------------------------------
class ImageCardErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { hasError: false }; }
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(error) { console.error('ImageCard crashed:', error); }
  render() {
    if (this.state.hasError) {
      return <div className="rounded-2xl bg-red-500/10 p-4 text-center text-red-400 text-sm">Image failed to load</div>;
    }
    return this.props.children;
  }
}

// ------------------------------------------------------------------
// Gallery indicator (glass pill)
// ------------------------------------------------------------------
const GalleryIndicator = ({ current, total }) => (
  <div className="absolute top-3 right-3 z-20 bg-black/50 backdrop-blur-md rounded-full px-3 py-1 text-xs text-white font-medium shadow-lg">
    {current}/{total}
  </div>
);

// ------------------------------------------------------------------
// MAIN COMPONENT
// ------------------------------------------------------------------
const ImageCard = React.memo(({
  images,
  onDoubleTap,
  onLike,
  onLongPress,
  onSave,
  onReport,
  onShare,
  onDownload,
  onAnalytics,
  onModerationCheck,
  onPerformanceMetric,
  currentUser,      // kept for consistency, not used directly
  postId,
  srcSetGenerator,
  overlay,
}) => {
  if (!images || images.length === 0) return null;

  const total = images.length;
  const isSingle = total === 1;

  // ----- state -----
  const [currentIndex, setCurrentIndex] = useState(() => {
    const saved = loadIndex(postId);
    return Math.min(saved, total - 1);
  });
  const [modalOpen, setModalOpen] = useState(false);
  const [isDraggingGallery, setIsDraggingGallery] = useState(false);
  const lowPerf = useMemo(() => isLowEndDevice(), []);
  const [networkQuality, setNetworkQuality] = useState(() => getNetworkQuality());
  const pushAnalytics = useAnalyticsBatcher(onAnalytics);
  const { getAttempts, shouldRetry, incrementAttempt, resetRetry, scheduleRetry } = useRetry();

  // Reactive network quality
  useEffect(() => {
    if (!hasWindow) return;
    const conn = navigator.connection;
    if (!conn) return;
    const update = () => setNetworkQuality(conn.effectiveType || '4g');
    conn.addEventListener('change', update);
    return () => conn.removeEventListener('change', update);
  }, []);

  // Image state per index (refs + forced update only for changed slide)
  const loadedRef = useRef({});
  const errorRef = useRef({});
  const loadStageRef = useRef({});
  const [, forceUpdate] = useState(0);
  const updateImage = useCallback((idx, newProps) => {
    let changed = false;
    if (newProps.loaded !== undefined && loadedRef.current[idx] !== newProps.loaded) {
      loadedRef.current[idx] = newProps.loaded;
      changed = true;
    }
    if (newProps.error !== undefined && errorRef.current[idx] !== newProps.error) {
      errorRef.current[idx] = newProps.error;
      changed = true;
    }
    if (newProps.loadStage !== undefined && loadStageRef.current[idx] !== newProps.loadStage) {
      loadStageRef.current[idx] = newProps.loadStage;
      changed = true;
    }
    if (changed) forceUpdate(n => n + 1);
  }, []);

  const handleImageLoad = useCallback((idx, stage) => {
    updateImage(idx, { loaded: true, loadStage: stage });
    resetRetry(images[idx]?.url);
    pushAnalytics('image_load', { postId, imageIndex: idx });
  }, [updateImage, resetRetry, images, postId, pushAnalytics]);

  const handleImageError = useCallback((idx, retry = false) => {
    const url = images[idx]?.url;
    if (!retry && shouldRetry(url)) {
      incrementAttempt(url);
      const attempts = getAttempts(url);
      const delay = Math.min(10000, 1000 * Math.pow(2, attempts));
      scheduleRetry(url, () => {
        updateImage(idx, { error: false, loaded: false });
      }, delay);
    } else {
      updateImage(idx, { error: true });
      pushAnalytics('image_error', { postId, imageIndex: idx, url });
    }
  }, [images, shouldRetry, incrementAttempt, getAttempts, scheduleRetry, updateImage, postId, pushAnalytics]);

  // Preload queue (next 3 images)
  const preloadQueue = useRef([]);
  const idleId = useRef(null);
  const processQueue = useCallback(() => {
    if (preloadQueue.current.length === 0) return;
    const url = preloadQueue.current.shift();
    if (!isUrlCached(url)) {
      const img = new Image();
      img.onload = () => addToUrlCache(url);
      img.src = url;
    }
    if (preloadQueue.current.length) {
      idleId.current = requestIdle(processQueue, { timeout: 2000 });
    }
  }, []);
  const addToPreload = useCallback((url) => {
    if (!url || isUrlCached(url)) return;
    if (!preloadQueue.current.includes(url)) {
      preloadQueue.current.push(url);
      if (!idleId.current) idleId.current = requestIdle(processQueue, { timeout: 2000 });
    }
  }, [processQueue]);
  useEffect(() => {
    for (let i = 1; i <= 3; i++) {
      const url = images[currentIndex + i]?.url;
      if (url) addToPreload(url);
    }
    return () => { if (idleId.current) cancelIdle(idleId.current); };
  }, [currentIndex, images, addToPreload]);

  // IntersectionObserver (created once, tracks current index via ref)
  const containerRef = useRef(null);
  const observerRef = useRef(null);
  const viewedRef = useRef(false);
  const viewStartRef = useRef(0);
  const currentIndexRef = useRef(currentIndex);
  useEffect(() => { currentIndexRef.current = currentIndex; }, [currentIndex]);
  useEffect(() => {
    if (!containerRef.current) return;
    observerRef.current = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting && !viewedRef.current) {
          viewedRef.current = true;
          viewStartRef.current = performance.now();
          pushAnalytics('image_impression', { postId, imageIndex: currentIndexRef.current });
          onPerformanceMetric?.('image_render', performance.now() - viewStartRef.current);
        } else if (!entry.isIntersecting && viewedRef.current) {
          const duration = performance.now() - viewStartRef.current;
          pushAnalytics('image_view_duration', { postId, imageIndex: currentIndexRef.current, duration });
          viewedRef.current = false;
        }
      });
    }, { threshold: 0.5 });
    observerRef.current.observe(containerRef.current);
    return () => {
      if (observerRef.current) observerRef.current.disconnect();
    };
  }, [postId, pushAnalytics, onPerformanceMetric]);

  // Moderation (cached)
  useEffect(() => {
    const url = images[currentIndex]?.url;
    if (!url) return;
    const cached = getModeration(url);
    if (cached !== null) {
      if (!cached) toast.warning('Image may contain sensitive content');
      return;
    }
    if (onModerationCheck) {
      onModerationCheck(url).then(isSafe => {
        setModeration(url, isSafe);
        if (!isSafe) toast.warning('Image may contain sensitive content');
      }).catch(() => setModeration(url, true));
    }
  }, [currentIndex, images, onModerationCheck]);

  // Navigation
  const goPrev = useCallback(() => {
    if (currentIndex > 0) setCurrentIndex(i => i - 1);
    pushAnalytics('swipe', { direction: 'prev', postId });
    haptic(5);
  }, [currentIndex, pushAnalytics, postId]);
  const goNext = useCallback(() => {
    if (currentIndex < total - 1) setCurrentIndex(i => i + 1);
    pushAnalytics('swipe', { direction: 'next', postId });
    haptic(5);
  }, [currentIndex, total, pushAnalytics, postId]);

  // Persist index on unmount only
  useEffect(() => {
    return () => saveIndex(postId, currentIndex);
  }, [postId, currentIndex]);

  // ----- Modal zoom/pan (motion values) -----
  const scale = useMotionValue(1);
  const translateX = useMotionValue(0);
  const translateY = useMotionValue(0);
  const [isZoomed, setIsZoomed] = useState(false);
  const lastPinchDistance = useRef(0);
  const modalContainerRef = useRef(null);
  const modalImageRef = useRef(null);
  const dragStartY = useRef(0);
  const [pullToClose, setPullToClose] = useState(0);
  const [dynamicConstraints, setDynamicConstraints] = useState({ left: -500, right: 500, top: -500, bottom: 500 });

  const updateConstraints = useCallback(() => {
    const img = modalImageRef.current;
    if (!img) return;
    const { naturalWidth, naturalHeight } = img;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const currentScale = scale.get();
    const scaledWidth = naturalWidth * currentScale;
    const scaledHeight = naturalHeight * currentScale;
    const maxX = Math.max(0, (scaledWidth - viewportWidth) / 2);
    const maxY = Math.max(0, (scaledHeight - viewportHeight) / 2);
    setDynamicConstraints({ left: -maxX, right: maxX, top: -maxY, bottom: maxY });
  }, [scale]);
  useMotionValueEvent(scale, 'change', () => updateConstraints());
  useEffect(() => {
    if (!hasWindow) return;
    const handleResize = () => updateConstraints();
    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
    };
  }, [updateConstraints]);

  const openModal = useCallback(() => {
    setModalOpen(true);
    scale.set(1);
    translateX.set(0);
    translateY.set(0);
    setIsZoomed(false);
    pushAnalytics('modal_open', { postId, imageIndex: currentIndex });
    onPerformanceMetric?.('modal_open', performance.now());
  }, [scale, translateX, translateY, pushAnalytics, postId, currentIndex, onPerformanceMetric]);

  const closeModal = useCallback(() => {
    setModalOpen(false);
    scale.stop();
    translateX.stop();
    translateY.stop();
    scale.set(1);
    translateX.set(0);
    translateY.set(0);
    setIsZoomed(false);
    setPullToClose(0);
    pushAnalytics('modal_close', { postId });
  }, [scale, translateX, translateY, pushAnalytics, postId]);

  const zoomIn = () => {
    const newScale = Math.min(3, scale.get() + 0.3);
    scale.set(newScale);
    setIsZoomed(newScale > 1);
    pushAnalytics('zoom', { direction: 'in', postId });
  };
  const zoomOut = () => {
    const newScale = Math.max(1, scale.get() - 0.3);
    scale.set(newScale);
    if (newScale === 1) {
      translateX.set(0);
      translateY.set(0);
      setIsZoomed(false);
    }
    pushAnalytics('zoom', { direction: 'out', postId });
  };
  const resetZoom = () => {
    scale.set(1);
    translateX.set(0);
    translateY.set(0);
    setIsZoomed(false);
  };

  const handleDoubleTapModal = () => {
    if (scale.get() > 1) resetZoom();
    else zoomIn();
  };

  // Gesture state for modal
  const gestureState = useRef('idle');
  const handleTouchStart = (e) => {
    if (e.touches.length === 2) {
      gestureState.current = 'pinching';
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      lastPinchDistance.current = Math.hypot(dx, dy);
    } else if (e.touches.length === 1) {
      dragStartY.current = e.touches[0].clientY;
      if (!isZoomed) gestureState.current = 'dragdown';
      else gestureState.current = 'panning';
    }
  };
  const handleTouchMove = (e) => {
    if (gestureState.current === 'pinching' && e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const distance = Math.hypot(dx, dy);
      if (lastPinchDistance.current > 0) {
        let newScale = scale.get() * (distance / lastPinchDistance.current);
        newScale = Math.min(3, Math.max(1, newScale));
        scale.set(newScale);
      }
      lastPinchDistance.current = distance;
    } else if (gestureState.current === 'dragdown' && e.touches.length === 1 && !isZoomed) {
      const deltaY = e.touches[0].clientY - dragStartY.current;
      if (deltaY > 0) setPullToClose(Math.min(0.5, deltaY / 500));
    }
  };
  const handleTouchEnd = () => {
    if (gestureState.current === 'dragdown' && pullToClose > 0.3) closeModal();
    setPullToClose(0);
    lastPinchDistance.current = 0;
    const newZoomed = scale.get() > 1;
    if (newZoomed !== isZoomed) setIsZoomed(newZoomed);
    gestureState.current = 'idle';
  };

  // Modal swipe navigation
  const modalSwipeStart = useRef(0);
  const onModalSwipeStart = (e) => {
    if (!isZoomed && e.touches.length === 1) {
      modalSwipeStart.current = e.touches[0].clientX;
      gestureState.current = 'modal_swipe';
    }
  };
  const onModalSwipeMove = (e) => {
    if (gestureState.current === 'modal_swipe' && e.touches.length === 1 && !isZoomed) {
      const delta = e.touches[0].clientX - modalSwipeStart.current;
      if (Math.abs(delta) > 50) {
        if (delta > 0) goPrev();
        else goNext();
        gestureState.current = 'idle';
      }
    }
  };

  // Long press with gesture arbitration (prevents conflict with swipe)
  const longPressTimer = useRef(null);
  const isLongPressActive = useRef(false);
  const startLongPress = useCallback((index) => {
    if (gestureState.current !== 'idle') return;
    isLongPressActive.current = true;
    longPressTimer.current = setTimeout(() => {
      if (isLongPressActive.current) {
        if (onLongPress) onLongPress(index);
        else toast.info('Long press menu');
        pushAnalytics('long_press', { postId, imageIndex: index });
        haptic(15);
      }
      isLongPressActive.current = false;
    }, 500);
  }, [onLongPress, pushAnalytics, postId]);
  const cancelLongPress = useCallback(() => {
    isLongPressActive.current = false;
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
  }, []);

  // Keyboard navigation in modal
  useEffect(() => {
    if (!modalOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') closeModal();
      else if (e.key === 'ArrowLeft') goPrev();
      else if (e.key === 'ArrowRight') goNext();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [modalOpen, closeModal, goPrev, goNext]);

  // Focus trap
  useEffect(() => {
    if (modalOpen) {
      document.body.style.overflow = 'hidden';
      modalContainerRef.current?.focus();
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [modalOpen]);

  // Engagement handlers
  const handleLike = useCallback((idx) => {
    if (onLike) onLike(idx);
    else if (onDoubleTap) onDoubleTap();
    pushAnalytics('like', { postId, imageIndex: idx });
    haptic(10);
  }, [onLike, onDoubleTap, pushAnalytics, postId]);
  const handleSave = useCallback((url) => {
    if (onSave) onSave(url);
    else toast.success('Saved to bookmarks');
    pushAnalytics('save', { postId, imageUrl: url });
    haptic(5);
  }, [onSave, pushAnalytics, postId]);
  const handleReport = useCallback((url) => {
    if (onReport) onReport(url);
    else toast.info('Report submitted');
    pushAnalytics('report', { postId, imageUrl: url });
    haptic(10);
  }, [onReport, pushAnalytics, postId]);
  const handleShare = useCallback((url) => {
    if (onShare) onShare(url);
    else if (navigator.share) navigator.share({ url }).catch(() => toast.info('Share cancelled'));
    else toast.info('Share not supported');
    pushAnalytics('share', { postId, imageUrl: url });
    haptic(5);
  }, [onShare, pushAnalytics, postId]);

  // Download with fetch + blob for cross-origin (reliable)
  const handleDownload = useCallback(async (url) => {
    if (onDownload) {
      onDownload(url);
      pushAnalytics('download', { postId, imageUrl: url });
      haptic(5);
      return;
    }
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error('Network response was not ok');
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = `arvdoul_image_${Date.now()}.jpg`;
      a.click();
      URL.revokeObjectURL(blobUrl);
      toast.success('Download started');
    } catch (err) {
      // Fallback: open in new tab (may not download, but better than nothing)
      const a = document.createElement('a');
      a.href = url;
      a.target = '_blank';
      a.click();
      toast.info('Download may open in new tab');
    }
    pushAnalytics('download', { postId, imageUrl: url });
    haptic(5);
  }, [onDownload, pushAnalytics, postId]);

  // Reduced motion support
  const prefersReducedMotion = hasWindow && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const transitionSpring = prefersReducedMotion ? { duration: 0 } : { type: 'spring', stiffness: 300, damping: 30 };

  // True virtualization: only render current, prev, next (but we already do that inside map)
  // For gallery width, use a wrapper with width: 100% and translateX on a flex container with all slides (but only visible ones are rendered)
  // However, to avoid huge container width, we use a different approach: position absolute? But that breaks swipe. Instead, we rely on the fact that
  // only 3 slides are rendered, but the container width is still total * 100%. That's acceptable because the container is not actually rendering off-screen slides.
  // So we keep the original approach (width: total*100%) but ensure children are empty for non-visible slides.
  const containerWidth = `${total * 100}%`;
  const translateXValue = -currentIndex * (100 / total);
  const dragElasticGallery = lowPerf ? 0 : 0.2;

  // Single image layout
  if (isSingle) {
    const img = images[0];
    const hasError = errorRef.current[0];
    const loadedFlag = loadedRef.current[0];
    const stage = loadStageRef.current[0] || 0;
    let currentUrl;
    if (hasError) currentUrl = null;
    else if (stage < 2 && networkQuality === 'slow-2g') currentUrl = img.lowResUrl || (img.url.includes('?') ? `${img.url}&w=200` : `${img.url}?w=200`);
    else if (stage === 0) currentUrl = img.lowResUrl || (img.url.includes('?') ? `${img.url}&w=20` : `${img.url}?w=20`);
    else if (stage === 1) currentUrl = img.lowResUrl || (img.url.includes('?') ? `${img.url}&w=400` : `${img.url}?w=400`);
    else currentUrl = img.url;

    const handleKeyDown = (e) => {
      if (e.key === 'Enter') handleLike(0);
    };

    return (
      <div
        ref={containerRef}
        className="relative w-full"
        onDoubleClick={() => handleLike(0)}
        onTouchStart={() => startLongPress(0)}
        onTouchEnd={cancelLongPress}
        onMouseDown={() => startLongPress(0)}
        onMouseUp={cancelLongPress}
        onMouseLeave={cancelLongPress}
      >
        {!loadedFlag && !hasError && <div className="absolute inset-0 bg-black/10 animate-pulse rounded-xl" style={{ aspectRatio: '16/9' }} />}
        {!hasError && currentUrl && (
          <motion.img
            src={currentUrl}
            srcSet={srcSetGenerator ? srcSetGenerator(currentUrl, window.innerWidth) : undefined}
            alt={img.alt || 'Post image'}
            className="w-full h-auto max-h-[500px] object-cover cursor-pointer relative z-10 transition-opacity duration-500 will-change-transform"
            style={{ opacity: loadedFlag ? 1 : 0 }}
            onClick={openModal}
            onKeyDown={handleKeyDown}
            tabIndex={0}
            role="button"
            aria-label="Open image viewer"
            loading="lazy"
            onLoad={() => handleImageLoad(0, 2)}
            onError={() => handleImageError(0)}
            layoutId={`image-${postId}-0`}
          />
        )}
        {hasError && (
          <div className="w-full h-64 bg-black/20 rounded-2xl flex flex-col items-center justify-center gap-2">
            <AlertCircle className="w-8 h-8 text-red-400" />
            <span className="text-xs text-white/60">Failed to load</span>
            <button onClick={() => handleImageError(0, true)} className="px-3 py-1 text-xs bg-white/20 rounded-full hover:bg-white/30">Retry</button>
          </div>
        )}
        <div className="absolute top-2 left-2 bg-black/50 backdrop-blur-md rounded-full px-2 py-0.5 text-xs text-white flex items-center gap-1">
          <Image className="w-3 h-3" /> Photo
        </div>
        <div className="absolute bottom-3 right-3 flex gap-2">
          <button onClick={() => handleSave(img.url)} className="p-2 rounded-full bg-black/50 backdrop-blur-md text-white hover:bg-black/70 transition" aria-label="Save"><Save className="w-4 h-4" /></button>
          <button onClick={() => handleDownload(img.url)} className="p-2 rounded-full bg-black/50 backdrop-blur-md text-white hover:bg-black/70 transition" aria-label="Download"><Download className="w-4 h-4" /></button>
        </div>
        {overlay && <div className="absolute bottom-16 left-0 right-0 z-10">{overlay}</div>}
      </div>
    );
  }

  // Multi‑image gallery with true virtualisation (only render visible ±1 slides)
  return (
    <>
      <div
        ref={containerRef}
        className="relative w-full overflow-hidden rounded-xl"
        onDoubleClick={() => handleLike(currentIndex)}
        onTouchStart={() => startLongPress(currentIndex)}
        onTouchEnd={cancelLongPress}
        onMouseDown={() => startLongPress(currentIndex)}
        onMouseUp={cancelLongPress}
        onMouseLeave={cancelLongPress}
      >
        <div className="relative w-full overflow-hidden" style={{ contain: 'layout paint' }}>
          <motion.div
            className="flex will-change-transform"
            style={{ width: containerWidth }}
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={dragElasticGallery}
            onDragStart={() => { gestureState.current = 'swiping'; setIsDraggingGallery(true); }}
            onDragEnd={(e, info) => {
              gestureState.current = 'idle';
              setIsDraggingGallery(false);
              const offset = info.offset.x;
              const velocity = info.velocity.x;
              if (Math.abs(velocity) > 500 || Math.abs(offset) > 80) {
                if (velocity > 0) goPrev();
                else goNext();
              }
            }}
            animate={{ x: `${translateXValue}%` }}
            transition={isDraggingGallery ? { duration: 0 } : transitionSpring}
          >
            {images.map((img, idx) => {
              const visible = Math.abs(idx - currentIndex) <= 1;
              return (
                <div key={idx} className="flex-shrink-0" style={{ width: `${100 / total}%` }}>
                  {visible ? (
                    <ImageSlide
                      image={img}
                      index={idx}
                      isCurrent={idx === currentIndex}
                      loaded={loadedRef.current[idx]}
                      error={errorRef.current[idx]}
                      loadStage={loadStageRef.current[idx] || 0}
                      networkQuality={networkQuality}
                      onLoad={handleImageLoad}
                      onError={handleImageError}
                      onClick={openModal}
                      layoutId={`image-${postId}-${idx}`}
                      srcSetGenerator={srcSetGenerator}
                    />
                  ) : (
                    <div style={{ aspectRatio: '16/9' }} />
                  )}
                </div>
              );
            })}
          </motion.div>
        </div>

        {currentIndex > 0 && (
          <button
            onClick={goPrev}
            className="absolute left-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/50 backdrop-blur-md text-white hover:bg-black/70 transition"
            aria-label="Previous image"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
        )}
        {currentIndex < total - 1 && (
          <button
            onClick={goNext}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/50 backdrop-blur-md text-white hover:bg-black/70 transition"
            aria-label="Next image"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        )}

        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-2">
          {images.map((_, idx) => (
            <Dot key={idx} active={idx === currentIndex} index={idx} onClick={setCurrentIndex} />
          ))}
        </div>
        <GalleryIndicator current={currentIndex + 1} total={total} />
        {overlay && <div className="absolute bottom-16 left-0 right-0 z-10">{overlay}</div>}
      </div>

      {/* ----- MODAL ----- */}
      <AnimatePresence>
        {modalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[1000] flex items-center justify-center"
            style={{ backgroundColor: `rgba(0,0,0,${0.95 - pullToClose * 0.5})`, contain: 'paint' }}
            onClick={closeModal}
            ref={modalContainerRef}
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-label="Image viewer"
          >
            <div
              className="relative w-full h-full flex items-center justify-center"
              onClick={(e) => e.stopPropagation()}
              onTouchStart={(e) => { handleTouchStart(e); onModalSwipeStart(e); }}
              onTouchMove={(e) => { handleTouchMove(e); onModalSwipeMove(e); }}
              onTouchEnd={handleTouchEnd}
            >
              <motion.img
                ref={modalImageRef}
                src={images[currentIndex]?.url}
                srcSet={srcSetGenerator ? srcSetGenerator(images[currentIndex]?.url, window.innerWidth) : undefined}
                alt={images[currentIndex]?.alt || ''}
                layoutId={`image-${postId}-${currentIndex}`}
                drag={isZoomed}
                dragConstraints={dynamicConstraints}
                dragElastic={lowPerf ? 0 : 0.1}
                dragMomentum={!lowPerf}
                style={{
                  scale: scale,
                  x: translateX,
                  y: translateY,
                  maxWidth: '90%',
                  maxHeight: '90%',
                  objectFit: 'contain',
                  translateY: pullToClose * 200,
                  willChange: 'transform',
                }}
                whileTap={{ cursor: 'grabbing' }}
                className="cursor-grab"
                onDoubleClick={handleDoubleTapModal}
                onLoad={updateConstraints}
              />

              <button onClick={closeModal} className="absolute top-4 right-4 p-2 rounded-full bg-black/50 backdrop-blur-md text-white hover:bg-black/70 z-20" aria-label="Close viewer">
                <X className="w-5 h-5" />
              </button>
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-3 z-20">
                <button onClick={zoomOut} disabled={scale.get() <= 1} className="p-2 rounded-full bg-black/50 backdrop-blur-md text-white hover:bg-black/70 transition disabled:opacity-30" aria-label="Zoom out">
                  <ZoomOut className="w-5 h-5" />
                </button>
                <button onClick={resetZoom} className="px-3 py-1 rounded-full bg-black/50 backdrop-blur-md text-xs text-white">Reset</button>
                <button onClick={zoomIn} disabled={scale.get() >= 3} className="p-2 rounded-full bg-black/50 backdrop-blur-md text-white hover:bg-black/70 transition disabled:opacity-30" aria-label="Zoom in">
                  <ZoomIn className="w-5 h-5" />
                </button>
              </div>
              <div className="absolute bottom-4 right-4 flex gap-2 z-20">
                <button onClick={() => handleLike(currentIndex)} className="p-2 rounded-full bg-black/50 backdrop-blur-md text-white hover:bg-black/70" aria-label="Like"><Heart className="w-5 h-5" /></button>
                <button onClick={() => handleSave(images[currentIndex]?.url)} className="p-2 rounded-full bg-black/50 backdrop-blur-md text-white hover:bg-black/70" aria-label="Save"><Save className="w-5 h-5" /></button>
                <button onClick={() => handleReport(images[currentIndex]?.url)} className="p-2 rounded-full bg-black/50 backdrop-blur-md text-white hover:bg-black/70" aria-label="Report"><Flag className="w-5 h-5" /></button>
                <button onClick={() => handleShare(images[currentIndex]?.url)} className="p-2 rounded-full bg-black/50 backdrop-blur-md text-white hover:bg-black/70" aria-label="Share"><Share2 className="w-5 h-5" /></button>
                <button onClick={() => handleDownload(images[currentIndex]?.url)} className="p-2 rounded-full bg-black/50 backdrop-blur-md text-white hover:bg-black/70" aria-label="Download"><Download className="w-5 h-5" /></button>
              </div>
              <div className="absolute top-4 left-4 bg-black/50 backdrop-blur-md rounded-full px-3 py-1 text-white text-sm z-20">
                {currentIndex + 1} / {total}
              </div>
              <div className="sr-only" aria-live="polite">Image {currentIndex + 1} of {total}</div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
});

// Wrap with error boundary
const ImageCardWithBoundary = (props) => (
  <ImageCardErrorBoundary>
    <ImageCard {...props} />
  </ImageCardErrorBoundary>
);

export default ImageCardWithBoundary;