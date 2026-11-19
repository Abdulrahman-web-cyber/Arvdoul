// src/components/vibes/VibeRenderer.jsx
//
// Shared single-source Vibe renderer used identically by BOTH:
//   - Fullscreen VibeViewer (playback synced to real video/time/text length)
//   - Vibes Studio Preview (zero-upload, zero-publish 1:1 visual parity)

import { useEffect, useRef, useState, useCallback, memo } from 'react';
import { Loader2, Music, AlertCircle, RotateCcw } from 'lucide-react';
import { cn } from '../../lib/utils';
import { BRAND_GRADIENT } from '../../design-system/tokens.js';
import {
  getVibeFontCss,
  sanitizeTextOverlays,
  sanitizeDrawingPaths,
  VIBE_LIMITS,
} from '../../config/vibeContracts.js';
import { LazyImage } from '../Shared/LazyImage';

/**
 * Renders non-destructive freehand brush & eraser strokes onto a transparent
 * high-DPI overlay canvas so eraser paths cleanly punch out prior ink strokes
 * without erasing the underlying Vibe photo/video/gradient.
 */
export const VibeDrawingOverlay = memo(function VibeDrawingOverlay({ paths = [], className = '' }) {
  const canvasRef = useRef(null);
  const safePaths = sanitizeDrawingPaths(paths);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;

    const render = () => {
      const rect = canvas.getBoundingClientRect();
      const width = Math.max(1, Math.round(rect.width || 360));
      const height = Math.max(1, Math.round(rect.height || 640));
      const dpr = Math.min(2, window.devicePixelRatio || 1);

      if (canvas.width !== Math.round(width * dpr) || canvas.height !== Math.round(height * dpr)) {
        canvas.width = Math.round(width * dpr);
        canvas.height = Math.round(height * dpr);
      }

      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.save();
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);

      for (const stroke of safePaths) {
        if (!stroke.points || stroke.points.length === 0) continue;
        ctx.save();
        ctx.globalCompositeOperation = stroke.mode === 'eraser' ? 'destination-out' : 'source-over';
        ctx.strokeStyle = stroke.color || '#FFFFFF';
        ctx.fillStyle = stroke.color || '#FFFFFF';
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        const scaledSize = Math.max(2, (stroke.size / 360) * width);
        ctx.lineWidth = stroke.mode === 'eraser' ? scaledSize * 1.6 : scaledSize;

        if (stroke.points.length === 1) {
          const p0 = stroke.points[0];
          ctx.beginPath();
          ctx.arc(p0.x * width, p0.y * height, ctx.lineWidth / 2, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.beginPath();
          ctx.moveTo(stroke.points[0].x * width, stroke.points[0].y * height);
          for (let i = 1; i < stroke.points.length; i += 1) {
            const prev = stroke.points[i - 1];
            const curr = stroke.points[i];
            const midX = ((prev.x + curr.x) / 2) * width;
            const midY = ((prev.y + curr.y) / 2) * height;
            ctx.quadraticCurveTo(prev.x * width, prev.y * height, midX, midY);
          }
          const last = stroke.points[stroke.points.length - 1];
          ctx.lineTo(last.x * width, last.y * height);
          ctx.stroke();
        }
        ctx.restore();
      }
      ctx.restore();
    };

    render();
    let observer = null;
    if (typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(render);
      observer.observe(canvas);
    }
    return () => {
      observer?.disconnect();
    };
  }, [safePaths]);

  if (safePaths.length === 0) return null;

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className={cn('absolute inset-0 w-full h-full pointer-events-none z-10', className)}
    />
  );
});

const ASPECT_CLASS = {
  original: 'w-full h-full',
  '9:16': 'w-full h-full aspect-[9/16]',
  '4:5': 'w-full max-h-full aspect-[4/5]',
  '1:1': 'w-full max-h-full aspect-square',
};

export const VibeRenderer = memo(function VibeRenderer({
  vibe,
  interactiveMode = 'viewer',
  isPaused = false,
  isMuted = false,
  videoRef: externalVideoRef = null,
  onVideoProgress = null,
  onVideoBuffering = null,
  onVideoEnded = null,
  onVideoReady = null,
  onVideoError = null,
  onMediaLoaded = null,
  onMediaError = null,
  onCloseUnavailable = null,
  hideChrome = false,
  className = '',
  children = null,
}) {
  const internalVideoRef = useRef(null);
  const resolvedVideoRef = externalVideoRef || internalVideoRef;
  const rafRef = useRef(null);
  const endedFiredRef = useRef(false);

  const [mediaLoadError, setMediaLoadError] = useState(false);
  const [mediaLoading, setMediaLoading] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const [retryNonce, setRetryNonce] = useState(0);

  const mediaUrl = vibe?.url || vibe?.mediaUrl || vibe?.media?.url || '';
  const type = String(vibe?.type || vibe?.mediaType || 'image').toLowerCase();
  const edits = vibe?.mediaEdits || {};
  const rotation = Number(edits.rotation) || 0;
  const brightness = Number(edits.brightness ?? 100);
  const contrast = Number(edits.contrast ?? 100);
  const fitMode = edits.fitMode === 'cover' ? 'cover' : 'contain';
  const cropAspect = edits.aspectRatio || 'original';
  const trimStart = Math.max(0, Number(edits.trimStart ?? vibe?.trimStart ?? 0) || 0);
  const rawTrimEnd = Number(edits.trimEnd ?? vibe?.trimEnd ?? 0) || 0;
  const effectiveMuted = Boolean(isMuted || edits.muted);
  const textOverlays = sanitizeTextOverlays(vibe?.textOverlays || []);
  const drawingPaths = sanitizeDrawingPaths(vibe?.drawingPaths || []);

  // Reset per-slide load states whenever active media URL changes
  useEffect(() => {
    setMediaLoadError(false);
    setIsBuffering(false);
    endedFiredRef.current = false;
    setMediaLoading(Boolean((type === 'image' || type === 'video') && mediaUrl));
  }, [vibe?.id, mediaUrl, type, retryNonce]);

  const handleVideoFrameSync = useCallback(() => {
    const vid = resolvedVideoRef.current;
    if (!vid) return;
    const nativeDur = Number.isFinite(vid.duration) && vid.duration > 0 ? vid.duration : (Number(vibe?.duration) || 15);
    const maxWindowEnd = Math.min(nativeDur, trimStart + VIBE_LIMITS.VIDEO_MAX_DURATION_SEC);
    const trimEnd = rawTrimEnd > trimStart ? Math.min(rawTrimEnd, maxWindowEnd) : maxWindowEnd;
    const span = Math.max(0.5, trimEnd - trimStart);
    const current = Math.max(trimStart, Number(vid.currentTime) || trimStart);
    const pct = Math.min(100, Math.max(0, ((current - trimStart) / span) * 100));

    onVideoProgress?.({
      currentTime: current,
      duration: span,
      progressPercent: pct,
    });

    if (!endedFiredRef.current && current >= trimEnd - 0.06) {
      endedFiredRef.current = true;
      vid.pause();
      if (interactiveMode === 'preview') {
        vid.currentTime = trimStart;
        endedFiredRef.current = false;
        if (!isPaused) vid.play().catch(() => {});
      } else {
        onVideoEnded?.();
        return;
      }
    }

    if (!isPaused && !vid.paused && !vid.ended) {
      rafRef.current = requestAnimationFrame(handleVideoFrameSync);
    }
  }, [resolvedVideoRef, vibe?.duration, trimStart, rawTrimEnd, onVideoProgress, interactiveMode, isPaused, onVideoEnded]);

  // Video play/pause/mute & trimStart enforcement
  useEffect(() => {
    const vid = resolvedVideoRef.current;
    if (!vid || type !== 'video' || !mediaUrl) return undefined;

    vid.muted = effectiveMuted;

    if (isPaused) {
      vid.pause();
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      return undefined;
    }

    if (vid.currentTime < trimStart) {
      try {
        vid.currentTime = trimStart;
      } catch {
        // Ignore seek before metadata ready; onLoadedMetadata handles it.
      }
    }

    vid.play().catch(() => {
      // Autoplay blocked by browser policy; user can tap speaker or play control.
    });
    rafRef.current = requestAnimationFrame(handleVideoFrameSync);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [resolvedVideoRef, type, mediaUrl, isPaused, effectiveMuted, trimStart, handleVideoFrameSync, retryNonce]);

  const filterCss = `brightness(${brightness}%) contrast(${contrast}%)`;
  const mediaTransformCss = rotation ? `rotate(${rotation}deg)` : undefined;
  const textFontCss = getVibeFontCss(vibe?.textStyle?.font || vibe?.font || 'display');
  const textAlign = vibe?.textStyle?.align || 'center';
  const textBg = vibe?.textStyle?.background || vibe?.backgroundColor || BRAND_GRADIENT;
  const textColor = vibe?.textStyle?.textColor || vibe?.textColor || '#FFFFFF';

  const hasValidMedia = type === 'text'
    ? Boolean(String(vibe?.caption ?? vibe?.content ?? '').trim())
    : type === 'audio'
      ? Boolean(mediaUrl)
      : Boolean(mediaUrl);

  if (!hasValidMedia || mediaLoadError) {
    return (
      <div
        className={cn(
          'relative w-full h-full flex flex-col items-center justify-center px-6 text-center bg-[#060918] text-white',
          className
        )}
        role="status"
      >
        <div className="w-14 h-14 rounded-2xl bg-white/10 border border-white/15 flex items-center justify-center mb-3">
          <AlertCircle className="w-7 h-7 text-white/80" aria-hidden="true" />
        </div>
        <p className="text-white font-semibold mb-1">Vibe unavailable</p>
        <p className="text-white/65 text-sm max-w-xs">
          {mediaLoadError
            ? 'This media could not be loaded right now.'
            : 'This Vibe has expired or is no longer available.'}
        </p>
        <div className="mt-4 flex items-center gap-2.5">
          {mediaLoadError && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setMediaLoadError(false);
                setRetryNonce((n) => n + 1);
              }}
              className="min-h-[44px] px-5 py-2 rounded-full bg-white text-slate-950 text-sm font-bold inline-flex items-center gap-1.5 cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" aria-hidden="true" />
              <span>Retry</span>
            </button>
          )}
          {onCloseUnavailable && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onCloseUnavailable();
              }}
              className="min-h-[44px] px-5 py-2 rounded-full bg-white/10 hover:bg-white/20 text-white text-sm font-semibold cursor-pointer"
            >
              Close
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'relative w-full h-full flex items-center justify-center overflow-hidden bg-[#060918]',
        className
      )}
      style={type === 'text' || type === 'audio' ? { background: textBg } : undefined}
    >
      {/* Text Vibe Canvas */}
      {type === 'text' && (
        <div className="w-full h-full flex items-center justify-center px-8 py-24">
          <p
            className={cn(
              'text-2xl sm:text-3xl font-extrabold leading-snug break-words max-w-md drop-shadow-md',
              textAlign === 'left' ? 'text-left' : textAlign === 'right' ? 'text-right' : 'text-center'
            )}
            style={{
              color: textColor,
              fontFamily: textFontCss,
            }}
          >
            {vibe?.caption ?? vibe?.content ?? ''}
          </p>
        </div>
      )}

      {/* Audio Vibe Canvas */}
      {type === 'audio' && (
        <div className="flex flex-col items-center justify-center px-8 text-center gap-4">
          <div className="w-24 h-24 rounded-3xl bg-white/15 border border-white/25 backdrop-blur-xl flex items-center justify-center shadow-xl">
            <Music className="w-10 h-10 text-white" aria-hidden="true" />
          </div>
          {(vibe?.caption || vibe?.content) && (
            <p className="text-lg font-bold text-white max-w-xs">
              {vibe?.caption || vibe?.content}
            </p>
          )}
          <span className="text-xs font-medium text-white/80">
            {effectiveMuted ? 'Muted — tap speaker to listen' : isPaused ? 'Paused' : 'Playing Audio Vibe'}
          </span>
        </div>
      )}

      {/* Image Vibe Canvas (with ambient backdrop in contain mode) */}
      {type === 'image' && (
        <>
          {fitMode === 'contain' && (
            <LazyImage
              src={mediaUrl}
              alt=""
              loading="eager"
              fallback={null}
              aria-hidden="true"
              referrerPolicy="no-referrer"
              className="absolute inset-0 w-full h-full object-cover scale-110 blur-2xl opacity-35 pointer-events-none select-none"
            />
          )}
          <div className={cn('relative flex items-center justify-center overflow-hidden', ASPECT_CLASS[cropAspect] || ASPECT_CLASS.original)}>
            <LazyImage
              key={`${mediaUrl}_${retryNonce}`}
              src={mediaUrl}
              alt={vibe?.caption || vibe?.content || 'Vibe photo'}
              loading="eager"
              fallback={null}
              referrerPolicy="no-referrer"
              onLoad={() => {
                setMediaLoading(false);
                onMediaLoaded?.();
              }}
              onError={() => {
                setMediaLoading(false);
                setMediaLoadError(true);
                onMediaError?.();
              }}
              style={{
                filter: filterCss,
                transform: mediaTransformCss,
              }}
              className={cn(
                'max-h-full max-w-full transition-opacity duration-200',
                fitMode === 'cover' ? 'w-full h-full object-cover' : 'w-full h-full object-contain',
                mediaLoading ? 'opacity-0' : 'opacity-100'
              )}
            />
          </div>
        </>
      )}

      {/* Video Vibe Canvas */}
      {type === 'video' && (
        <>
          {fitMode === 'contain' && edits.coverUrl && (
            <LazyImage
              src={edits.coverUrl}
              alt=""
              loading="eager"
              fallback={null}
              aria-hidden="true"
              className="absolute inset-0 w-full h-full object-cover scale-110 blur-2xl opacity-30 pointer-events-none select-none"
            />
          )}
          <video
            key={`${mediaUrl}_${retryNonce}`}
            ref={resolvedVideoRef}
            src={mediaUrl}
            poster={edits.coverUrl || undefined}
            playsInline
            muted={effectiveMuted}
            preload="metadata"
            onLoadedMetadata={(e) => {
              const vid = e.currentTarget;
              setMediaLoading(false);
              if (trimStart > 0 && vid.currentTime < trimStart) {
                try {
                  vid.currentTime = trimStart;
                } catch {
                  // Ignore early seek limitation
                }
              }
              const dur = Number.isFinite(vid.duration) && vid.duration > 0 ? vid.duration : (Number(vibe?.duration) || 15);
              onVideoReady?.({ duration: dur });
              onMediaLoaded?.();
            }}
            onWaiting={() => {
              setIsBuffering(true);
              onVideoBuffering?.(true);
            }}
            onPlaying={() => {
              setMediaLoading(false);
              setIsBuffering(false);
              onVideoBuffering?.(false);
              if (rafRef.current) cancelAnimationFrame(rafRef.current);
              rafRef.current = requestAnimationFrame(handleVideoFrameSync);
            }}
            onCanPlay={() => {
              setMediaLoading(false);
              setIsBuffering(false);
              onVideoBuffering?.(false);
            }}
            onEnded={() => {
              if (!endedFiredRef.current) {
                endedFiredRef.current = true;
                if (interactiveMode === 'preview') {
                  const vid = resolvedVideoRef.current;
                  if (vid) {
                    vid.currentTime = trimStart;
                    endedFiredRef.current = false;
                    if (!isPaused) vid.play().catch(() => {});
                  }
                } else {
                  onVideoEnded?.();
                }
              }
            }}
            onError={() => {
              setMediaLoading(false);
              setIsBuffering(false);
              setMediaLoadError(true);
              onVideoBuffering?.(false);
              onVideoError?.();
              onMediaError?.();
            }}
            style={{ filter: filterCss, transform: mediaTransformCss }}
            className={cn(
              'max-h-full max-w-full w-full h-full',
              fitMode === 'cover' ? 'object-cover' : 'object-contain'
            )}
          />
        </>
      )}

      {/* Loading / Buffering indicator */}
      {(mediaLoading || isBuffering) && (
        <div
          className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none"
          aria-live="polite"
        >
          <div className="w-11 h-11 rounded-full bg-black/55 backdrop-blur-md border border-white/20 flex items-center justify-center">
            <Loader2 className="w-5 h-5 text-white animate-spin" aria-label="Loading Vibe media" />
          </div>
        </div>
      )}

      {/* Non-destructive Freehand Drawing Layer */}
      <VibeDrawingOverlay paths={drawingPaths} />

      {/* Repositionable Text Overlays */}
      {textOverlays.length > 0 && (
        <div className="absolute inset-0 z-20 pointer-events-none overflow-hidden">
          {textOverlays.map((overlay) => {
            const bgClass =
              overlay.bgStyle === 'solid'
                ? 'bg-slate-950/90 px-3.5 py-2 rounded-2xl shadow-lg border border-white/15'
                : overlay.bgStyle === 'pill'
                  ? 'bg-black/60 backdrop-blur-md px-3.5 py-1.5 rounded-full border border-white/20 shadow-md'
                  : 'drop-shadow-[0_2px_10px_rgba(0,0,0,0.85)] px-2';

            return (
              <div
                key={overlay.id}
                style={{
                  left: `${overlay.x * 100}%`,
                  top: `${overlay.y * 100}%`,
                  transform: `translate(-50%, -50%) rotate(${overlay.rotation || 0}deg) scale(${overlay.scale || 1})`,
                  color: overlay.color || '#FFFFFF',
                  fontFamily: getVibeFontCss(overlay.font),
                  textAlign: overlay.align || 'center',
                }}
                className={cn(
                  'absolute max-w-[82%] font-bold text-lg sm:text-xl leading-snug break-words select-none',
                  bgClass
                )}
              >
                {overlay.text}
              </div>
            );
          })}
        </div>
      )}

      {/* Optional Viewer Caption if there are no custom positioned overlays */}
      {type !== 'text' && (vibe?.caption || vibe?.content) && (
        <div
          className={cn(
            'absolute bottom-24 left-4 right-4 z-20 transition-opacity duration-150 pointer-events-none',
            hideChrome ? 'opacity-0' : 'opacity-100'
          )}
        >
          <div className="bg-black/60 backdrop-blur-md px-3.5 py-2 rounded-xl border border-white/10 text-white text-xs sm:text-sm max-w-full break-words">
            {vibe?.caption || vibe?.content}
          </div>
        </div>
      )}

      {children}
    </div>
  );
});

export default VibeRenderer;
