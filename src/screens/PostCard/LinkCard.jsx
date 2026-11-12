// src/screens/PostCard/LinkCard.jsx

import React, { useState } from "react";
import { motion } from 'framer-motion';
import { ExternalLink, Play, Share2, X } from "lucide-react";
import { toast } from 'sonner';

const getHostname = (url) => {
  try { return new URL(url).hostname; } catch { return ''; }
};

// Video ID extraction (supports youtube, youtu.be, vimeo, tiktok)
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
  } catch {
    /* an unparseable href is not a video embed */
  }
  return null;
};

const getEmbedUrl = (url) => {
  const videoId = getVideoId(url);
  if (!videoId) return null;
  if (url.includes('youtube') || url.includes('youtu.be')) return `https://www.youtube.com/embed/${videoId}?autoplay=1`;
  if (url.includes('vimeo')) return `https://player.vimeo.com/video/${videoId}?autoplay=1`;
  return null;
};

// MAIN COMPONENT
const LinkCard = React.memo(({
  link,                     // { url, title?, description?, image? }
  tokens,
  onAnalytics,              // (event, data) => void
  postId,
}) => {
  const [showVideoPreview, setShowVideoPreview] = useState(false);

  if (!link?.url) return null;

  const hostname = getHostname(link.url);
  const embedUrl = getEmbedUrl(link.url);
  const isVideo = Boolean(embedUrl);

  // The card has no link-metadata backend (no `onFetchMetadata` / `onClassifyLink`
  // / `onGetSafetyScore` prop is ever passed by the render site), so it renders
  // only the publisher-supplied Open Graph fields stored on the link document —
  // the title falls back to the bare hostname, and it never invents a
  // description, image, safety verdict or view count it cannot back.
  const title = link.title || hostname;
  const description = link.description || '';
  const image = link.image || '';

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
      {image && !isVideo && (
        <div className="relative w-full h-40 overflow-hidden">
          <img src={image} alt="" className="w-full h-full object-cover transition-transform duration-500 hover:scale-105" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
        </div>
      )}

      {/* Video inline preview (YouTube/Vimeo) */}
      {isVideo && !showVideoPreview && (
        <button type="button" aria-label="Watch video preview" className="relative w-full h-40 bg-black/50 flex items-center justify-center cursor-pointer" onClick={() => setShowVideoPreview(true)}>
          {image && <img src={image} alt="" className="absolute inset-0 w-full h-full object-cover opacity-50" />}
          <div className="relative z-10 flex flex-col items-center">
            <div className="p-3 rounded-full bg-black/60 backdrop-blur-md">
              <Play className="w-8 h-8 text-white" aria-hidden="true" />
            </div>
            <span className="text-white text-xs mt-2">Watch preview</span>
          </div>
        </button>
      )}
      {isVideo && showVideoPreview && (
        <div className="relative w-full h-40 bg-black">
          <iframe
            src={embedUrl}
            title="Video preview"
            className="w-full h-full"
            frameBorder="0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
          <button onClick={() => setShowVideoPreview(false)} className="absolute top-2 right-2 p-1 rounded-full bg-black/50 text-white" aria-label="Close video preview"><X className="w-4 h-4" /></button>
        </div>
      )}

      <div className="p-3">
        {/* Header: favicon + hostname */}
        <div className="flex items-center gap-2 text-xs mb-2 flex-wrap" style={{ color: tokens.textSecondary }}>
          <img src={`https://www.google.com/s2/favicons?domain=${hostname}&sz=16`} alt="" className="w-4 h-4" />
          <span>{hostname}</span>
        </div>

        {/* Title */}
        <h4 className="font-semibold text-sm mb-1 line-clamp-2" style={{ color: tokens.text }}>
          {title}
        </h4>

        {/* Description */}
        {description && (
          <p className="text-xs line-clamp-2 mb-2" style={{ color: tokens.textSecondary }}>
            {description}
          </p>
        )}

        {/* Action bar */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t" style={{ borderColor: tokens.border }}>
          <button
            onClick={() => {
              onAnalytics?.('link_click', { postId, url: link.url });
              window.open(link.url, '_blank', 'noopener,noreferrer');
            }}
            className="flex items-center gap-1 text-xs text-purple-400 hover:text-purple-300 transition"
          >
            <ExternalLink className="w-3 h-3" /> Open
          </button>
          <button
            onClick={async () => {
              try {
                if (navigator.share) await navigator.share({ url: link.url });
                else { await navigator.clipboard.writeText(link.url); toast.success('Link copied'); }
                onAnalytics?.('link_share', { postId, url: link.url });
              } catch {
                toast.info('Share cancelled');
              }
            }}
            className="p-1.5 rounded-full hover:bg-white/10 transition"
            aria-label="Share"
          >
            <Share2 className="w-4 h-4" style={{ color: tokens.textSecondary }} />
          </button>
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
