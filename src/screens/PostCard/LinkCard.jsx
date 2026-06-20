// src/screens/PostCard/LinkCard.jsx
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LinkIcon, ExternalLink, Shield, AlertTriangle, CheckCircle,
  Eye, BarChart3, Heart, Play, Music, ShoppingBag, Newspaper,
  BookOpen, Clock, Coins, Send, Save, Share2, X, TrendingUp, Sparkles
} from 'lucide-react';
import { toast } from 'sonner';

// ------------------------------------------------------------------
// 1. IndexedDB cache (simple, with LRU eviction)
// ------------------------------------------------------------------
let dbPromise = null;
if (typeof window !== 'undefined' && window.indexedDB) {
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open('ArvdoulLinkCache', 1);
    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('links')) {
        const store = db.createObjectStore('links', { keyPath: 'url' });
        store.createIndex('timestamp', 'timestamp');
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours
const MAX_CACHE_ITEMS = 200;

const getCachedMetadata = async (url) => {
  if (!dbPromise) {
    const cached = localStorage.getItem(`link_${url}`);
    if (cached) {
      const { data, timestamp } = JSON.parse(cached);
      if (Date.now() - timestamp < CACHE_TTL) return data;
      localStorage.removeItem(`link_${url}`);
    }
    return null;
  }
  const db = await dbPromise;
  const tx = db.transaction('links', 'readonly');
  const store = tx.objectStore('links');
  const result = await store.get(url);
  if (result && Date.now() - result.timestamp < CACHE_TTL) return result.data;
  if (result) {
    const deleteTx = db.transaction('links', 'readwrite');
    deleteTx.objectStore('links').delete(url);
  }
  return null;
};

const setCachedMetadata = async (url, data) => {
  if (!dbPromise) {
    localStorage.setItem(`link_${url}`, JSON.stringify({ data, timestamp: Date.now() }));
    return;
  }
  const db = await dbPromise;
  const tx = db.transaction('links', 'readwrite');
  const store = tx.objectStore('links');
  // Evict old entries if needed
  const count = await store.count();
  if (count >= MAX_CACHE_ITEMS) {
    const index = store.index('timestamp');
    const oldest = await index.openCursor();
    if (oldest) await oldest.delete();
  }
  await store.put({ url, data, timestamp: Date.now() });
};

// ------------------------------------------------------------------
// 2. Helpers
// ------------------------------------------------------------------
const getHostname = (url) => {
  try { return new URL(url).hostname; } catch { return ''; }
};

const readingTime = (text) => {
  if (!text) return null;
  const words = text.trim().split(/\s+/).length;
  const minutes = Math.ceil(words / 200);
  return `${minutes} min read`;
};

// ------------------------------------------------------------------
// 3. Video ID extraction (supports youtube, youtu.be, vimeo, tiktok)
// ------------------------------------------------------------------
const getVideoId = (url) => {
  try {
    const u = new URL(url);
    if (u.hostname.includes('youtube.com') || u.hostname.includes('youtu.be')) {
      if (u.searchParams.has('v')) return u.searchParams.get('v');
      if (u.pathname.startsWith('/shorts/')) return u.pathname.split('/')[2];
      if (u.hostname === 'youtu.be') return u.pathname.slice(1);
    }
    if (u.hostname.includes('vimeo.com')) return u.pathname.slice(1);
    if (u.hostname.includes('tiktok.com')) return u.pathname.split('/')[2];
  } catch {}
  return null;
};

const getEmbedUrl = (url) => {
  const videoId = getVideoId(url);
  if (!videoId) return null;
  if (url.includes('youtube') || url.includes('youtu.be')) return `https://www.youtube.com/embed/${videoId}?autoplay=1`;
  if (url.includes('vimeo')) return `https://player.vimeo.com/video/${videoId}?autoplay=1`;
  return null;
};

// ------------------------------------------------------------------
// 4. MAIN COMPONENT
// ------------------------------------------------------------------
const LinkCard = React.memo(({
  link,                     // { url, title?, description?, image?, engagement?: { views, clicks, saves, shares, tips } }
  tokens,
  onFetchMetadata,          // async (url) => { title, description, image, publisher, publishDate, author, type, aiSummary, aiConfidence, domainScore, trending }
  onClassifyLink,           // async (url) => { type: 'news'|'video'|'music'|'product'|'article'|'link' }
  onGetSafetyScore,         // async (url) => { score:0-100, warnings?:string[] }
  onTip,                    // async (url, amount, idempotencyKey) => void
  onAnalytics,              // (event, data) => void
  onSave,                   // async (url) => void
  onShare,                  // async (url) => void
  currentUser,
  postId,
}) => {
  if (!link?.url) return null;

  // ----- State -----
  const [metadata, setMetadata] = useState(null);
  const [linkType, setLinkType] = useState('link');
  const [safety, setSafety] = useState({ score: 100, warnings: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [aiSummary, setAiSummary] = useState(null);
  const [aiConfidence, setAiConfidence] = useState(0);
  const [showSummary, setShowSummary] = useState(false);
  const [showCoinMenu, setShowCoinMenu] = useState(false);
  const [showVideoPreview, setShowVideoPreview] = useState(false);
  const [tipping, setTipping] = useState(false);
  const [engagement, setEngagement] = useState(link.engagement || { views: 0, clicks: 0, saves: 0, shares: 0, tips: 0 });

  const hostname = getHostname(link.url);
  const videoEmbedUrl = getEmbedUrl(link.url);
  const isVideo = linkType === 'video';
  const isMusic = linkType === 'music';
  const isProduct = linkType === 'product';
  const isArticle = linkType === 'article' || linkType === 'news';

  // ----- Load all intelligence (cached) -----
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        // 1. Check cache
        let cached = await getCachedMetadata(link.url);
        if (cached) {
          setMetadata(cached.metadata);
          setLinkType(cached.type || 'link');
          setSafety(cached.safety || { score: 100, warnings: [] });
          if (cached.aiSummary) { setAiSummary(cached.aiSummary); setAiConfidence(cached.aiConfidence || 0); }
          setLoading(false);
          return;
        }
        // 2. Fetch fresh data in parallel
        const metaPromise = onFetchMetadata ? onFetchMetadata(link.url) : Promise.resolve(null);
        const typePromise = onClassifyLink ? onClassifyLink(link.url) : Promise.resolve('link');
        const safetyPromise = onGetSafetyScore ? onGetSafetyScore(link.url) : Promise.resolve({ score: 100, warnings: [] });

        const [meta, detectedType, safetyData] = await Promise.all([metaPromise, typePromise, safetyPromise]);
        const finalType = detectedType || (meta?.type) || 'link';
        const finalMeta = {
          title: meta?.title || link.title || hostname,
          description: meta?.description || link.description || '',
          image: meta?.image || link.image || '',
          publisher: meta?.publisher || hostname,
          publishDate: meta?.publishDate || null,
          author: meta?.author || null,
          aiSummary: meta?.aiSummary || null,
          aiConfidence: meta?.aiConfidence || 0,
          domainScore: meta?.domainScore || safetyData.score,
          trending: meta?.trending || false,
        };
        setMetadata(finalMeta);
        setLinkType(finalType);
        setSafety({ score: safetyData.score, warnings: safetyData.warnings || [] });
        if (finalMeta.aiSummary) {
          setAiSummary(finalMeta.aiSummary);
          setAiConfidence(finalMeta.aiConfidence);
        }
        // Cache
        await setCachedMetadata(link.url, {
          metadata: finalMeta,
          type: finalType,
          safety: { score: safetyData.score, warnings: safetyData.warnings },
          aiSummary: finalMeta.aiSummary,
          aiConfidence: finalMeta.aiConfidence,
        });
      } catch (err) {
        console.error(err);
        setError('Could not load preview');
        setMetadata({ title: hostname, description: '', image: '', publisher: hostname });
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [link.url, onFetchMetadata, onClassifyLink, onGetSafetyScore, hostname]);

  // ----- Analytics on view (once) -----
  const viewedRef = useRef(false);
  useEffect(() => {
    if (!loading && !error && !viewedRef.current) {
      viewedRef.current = true;
      onAnalytics?.('link_impression', { postId, url: link.url, type: linkType });
      setEngagement(prev => ({ ...prev, views: prev.views + 1 }));
    }
  }, [loading, error, onAnalytics, postId, link.url, linkType]);

  // ----- Handlers -----
  const handleClick = () => {
    onAnalytics?.('link_click', { postId, url: link.url });
    setEngagement(prev => ({ ...prev, clicks: prev.clicks + 1 }));
    window.open(link.url, '_blank', 'noopener,noreferrer');
  };

  const handleSave = async () => {
    if (onSave) await onSave(link.url);
    else toast.success('Saved to bookmarks');
    onAnalytics?.('link_save', { postId, url: link.url });
    setEngagement(prev => ({ ...prev, saves: prev.saves + 1 }));
  };

  const handleShare = async () => {
    if (onShare) await onShare(link.url);
    else if (navigator.share) navigator.share({ url: link.url }).catch(() => toast.info('Share cancelled'));
    else navigator.clipboard.writeText(link.url).then(() => toast.success('Link copied'));
    onAnalytics?.('link_share', { postId, url: link.url });
    setEngagement(prev => ({ ...prev, shares: prev.shares + 1 }));
  };

  const handleTip = async (amount) => {
    if (!currentUser) return toast.error('Sign in');
    setTipping(true);
    const idempotencyKey = `${currentUser.uid}_${postId}_${link.url}_${Date.now()}`;
    try {
      if (onTip) await onTip(link.url, amount, idempotencyKey);
      else toast.success(`Sent ${amount} coins`);
      onAnalytics?.('link_tip', { postId, url: link.url, amount });
      setEngagement(prev => ({ ...prev, tips: prev.tips + 1 }));
    } catch (err) {
      toast.error('Tip failed');
    } finally {
      setTipping(false);
      setShowCoinMenu(false);
    }
  };

  // ----- Domain reputation badge -----
  const ReputationBadge = () => {
    const score = safety.score;
    if (score >= 80) return <CheckCircle className="w-4 h-4 text-green-400" title="Trusted domain" />;
    if (score >= 50) return <Shield className="w-4 h-4 text-yellow-400" title="Unverified" />;
    return <AlertTriangle className="w-4 h-4 text-red-400" title="Potentially unsafe" />;
  };

  // ----- Safety warning -----
  const safetyWarning = safety.warnings?.length ? safety.warnings[0] : null;

  // ----- Reading time (if article) -----
  const readTime = isArticle && metadata?.description ? readingTime(metadata.description) : null;

  // ----- Trending badge -----
  const isTrending = metadata?.trending || engagement.views > 1000;

  // ----- Loading skeleton -----
  if (loading) {
    return (
      <div className="px-4 py-3 mx-4 my-2 rounded-xl animate-pulse" style={{ backgroundColor: tokens.actionBarBg }}>
        <div className="flex gap-3">
          <div className="w-16 h-16 rounded-lg bg-gray-300 dark:bg-gray-700" />
          <div className="flex-1 space-y-2">
            <div className="h-3 bg-gray-300 dark:bg-gray-700 rounded w-3/4" />
            <div className="h-3 bg-gray-300 dark:bg-gray-700 rounded w-1/2" />
          </div>
        </div>
      </div>
    );
  }

  // ----- Error fallback -----
  if (error || !metadata) {
    return (
      <div className="px-4 py-3 mx-4 my-2 rounded-xl border" style={{ backgroundColor: tokens.cardBgAlt, borderColor: tokens.border }}>
        <div className="flex items-center gap-2 text-sm text-red-400">
          <AlertTriangle className="w-4 h-4" />
          <span>Preview unavailable</span>
        </div>
        <a href={link.url} target="_blank" rel="noopener noreferrer" className="text-xs truncate block mt-1" style={{ color: tokens.textSecondary }}>{link.url}</a>
      </div>
    );
  }

  // Neon gradient
  const neonGradient = `linear-gradient(135deg, ${tokens.audioNeonPrimary || '#9333ea'}, ${tokens.audioNeonSecondary || '#c026d3'}, #ec4899)`;
  const buttonGlow = `0 0 8px rgba(236, 72, 153, 0.5)`;

  return (
    <motion.div
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 5 }}
      className="relative mx-4 my-2 rounded-xl border overflow-hidden backdrop-blur-sm transition-all hover:shadow-lg"
      style={{
        backgroundColor: tokens.cardBg,
        borderColor: tokens.border,
        boxShadow: `${tokens.shadowAmbient}, ${tokens.shadowDirectional}`,
      }}
    >
      {/* Banner image (if available, not for video) */}
      {metadata.image && !isVideo && (
        <div className="relative w-full h-40 overflow-hidden">
          <img src={metadata.image} alt="" className="w-full h-full object-cover transition-transform duration-500 hover:scale-105" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
        </div>
      )}

      {/* Video inline preview (YouTube/Vimeo) */}
      {isVideo && !showVideoPreview && videoEmbedUrl && (
        <div className="relative w-full h-40 bg-black/50 flex items-center justify-center cursor-pointer" onClick={() => setShowVideoPreview(true)}>
          {metadata.image && <img src={metadata.image} alt="" className="absolute inset-0 w-full h-full object-cover opacity-50" />}
          <div className="relative z-10 flex flex-col items-center">
            <div className="p-3 rounded-full bg-black/60 backdrop-blur-md">
              <Play className="w-8 h-8 text-white" />
            </div>
            <span className="text-white text-xs mt-2">Watch preview</span>
          </div>
        </div>
      )}
      {isVideo && showVideoPreview && videoEmbedUrl && (
        <div className="relative w-full h-40 bg-black">
          <iframe
            src={videoEmbedUrl}
            className="w-full h-full"
            frameBorder="0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
          <button onClick={() => setShowVideoPreview(false)} className="absolute top-2 right-2 p-1 rounded-full bg-black/50 text-white"><X className="w-4 h-4" /></button>
        </div>
      )}

      <div className="p-3">
        {/* Header: favicon + hostname + reputation + type + trending + engagement */}
        <div className="flex items-center gap-2 text-xs mb-2 flex-wrap" style={{ color: tokens.textSecondary }}>
          <img src={`https://www.google.com/s2/favicons?domain=${hostname}&sz=16`} alt="" className="w-4 h-4" />
          <span>{hostname}</span>
          <ReputationBadge />
          {safetyWarning && <span className="text-red-400 text-[10px]">{safetyWarning}</span>}
          {metadata.publishDate && <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {new Date(metadata.publishDate).toLocaleDateString()}</span>}
          {readTime && <span className="flex items-center gap-1"><BookOpen className="w-3 h-3" /> {readTime}</span>}
          {isTrending && <span className="flex items-center gap-1 text-yellow-400"><TrendingUp className="w-3 h-3" /> Trending</span>}
          {engagement.views > 0 && <span className="flex items-center gap-1"><Eye className="w-3 h-3" /> {engagement.views}</span>}
        </div>

        {/* Title */}
        <h4 className="font-semibold text-sm mb-1 line-clamp-2" style={{ color: tokens.text }}>
          {metadata.title}
        </h4>

        {/* Description */}
        {metadata.description && (
          <p className="text-xs line-clamp-2 mb-2" style={{ color: tokens.textSecondary }}>
            {metadata.description}
          </p>
        )}

        {/* AI Summary (only if confidence > 0.6) */}
        {aiSummary && aiConfidence > 0.6 && (
          <div className="mb-2">
            <button
              onClick={() => setShowSummary(!showSummary)}
              className="text-xs flex items-center gap-1 text-purple-400 hover:underline"
            >
              <Sparkles className="w-3 h-3" /> AI summary {showSummary ? '▲' : '▼'}
            </button>
            <AnimatePresence>
              {showSummary && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="mt-1 p-2 rounded-lg bg-black/20 text-xs" style={{ color: tokens.textSecondary }}>
                  {aiSummary}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* Action bar */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t" style={{ borderColor: tokens.border }}>
          <button
            onClick={handleClick}
            className="flex items-center gap-1 text-xs text-purple-400 hover:text-purple-300 transition"
          >
            <ExternalLink className="w-3 h-3" /> Open
          </button>
          <div className="flex gap-2">
            <button onClick={handleSave} className="p-1.5 rounded-full hover:bg-white/10 transition" aria-label="Save">
              <Save className="w-4 h-4" style={{ color: tokens.textSecondary }} />
            </button>
            <button onClick={handleShare} className="p-1.5 rounded-full hover:bg-white/10 transition" aria-label="Share">
              <Share2 className="w-4 h-4" style={{ color: tokens.textSecondary }} />
            </button>
            <div className="relative">
              <button
                onClick={() => setShowCoinMenu(!showCoinMenu)}
                disabled={tipping}
                className="p-1.5 rounded-full hover:bg-white/10 transition flex items-center gap-1"
                aria-label="Tip creator"
              >
                <Coins className="w-4 h-4 text-yellow-400" />
                {tipping && <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />}
              </button>
              <AnimatePresence>
                {showCoinMenu && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    className="absolute bottom-full right-0 mb-2 p-2 rounded-xl shadow-lg z-20 flex gap-2"
                    style={{ backgroundColor: tokens.overlayPanel, border: `1px solid ${tokens.overlayPanelBorder}` }}
                  >
                    {[5, 20, 50, 100].map(amt => (
                      <button key={amt} onClick={() => handleTip(amt)} className="px-2 py-1 rounded-full text-xs font-medium" style={{ background: neonGradient, boxShadow: buttonGlow }}>
                        {amt} 🪙
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
});

// Wrap with error boundary
class LinkCardErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { hasError: false }; }
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(error) { console.error('LinkCard crashed:', error); }
  render() {
    if (this.state.hasError) {
      return <div className="rounded-xl bg-red-500/10 p-3 text-center text-red-400 text-sm">Link preview failed</div>;
    }
    return this.props.children;
  }
}

const LinkCardWithBoundary = (props) => (
  <LinkCardErrorBoundary>
    <LinkCard {...props} />
  </LinkCardErrorBoundary>
);

export default LinkCardWithBoundary;