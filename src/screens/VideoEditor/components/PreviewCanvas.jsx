// src/screens/VideoEditor/components/PreviewCanvas.jsx

import { useRef, useEffect, useState, useMemo } from "react";
import PropTypes from 'prop-types';
import { Play, Pause, SkipBack, SkipForward, Repeat, Volume2, VolumeX, Maximize, Minimize, Eye, Grid3x3, Lock } from "lucide-react";
import { useTheme } from "../../../context/ThemeContext";
import { formatTimecode, FILTERS_LIST } from '../constants';

const getOverlayPos = (item, fallbackX = 50, fallbackY = 50) => ({
  x: item?.position?.x ?? item?.x ?? fallbackX,
  y: item?.position?.y ?? item?.y ?? fallbackY,
});

function AudioClipPlayer({ clip, currentTime, isPlaying, isFreezeFrame, volume, isMuted }) {
  const audioRef = useRef(null);

  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    const speed = Number(clip.speed) > 0 ? Number(clip.speed) : 1;
    a.playbackRate = speed;
    const targetTime = Math.max(0, (currentTime - (clip.startTime || 0)) * speed + (clip.trimStart || 0));
    if (Math.abs(a.currentTime - targetTime) > 0.35) {
      a.currentTime = targetTime;
    }
    const clipVol = (clip.volume ?? 100) / 100;
    a.muted = Boolean(isMuted || clip.muted);
    a.volume = a.muted ? 0 : Math.max(0, Math.min(1, volume * clipVol));
    if (isPlaying && !isFreezeFrame) {
      if (a.paused) a.play().catch(() => {});
    } else if (!a.paused) {
      a.pause();
    }
  }, [clip, currentTime, isPlaying, isFreezeFrame, volume, isMuted]);

  useEffect(() => {
    const a = audioRef.current;
    return () => {
      if (a) a.pause();
    };
  }, []);

  return <audio ref={audioRef} src={clip.url} preload="auto" className="hidden" />;
}

AudioClipPlayer.propTypes = {
  clip: PropTypes.object.isRequired,
  currentTime: PropTypes.number.isRequired,
  isPlaying: PropTypes.bool.isRequired,
  isFreezeFrame: PropTypes.bool.isRequired,
  volume: PropTypes.number.isRequired,
  isMuted: PropTypes.bool.isRequired,
};

export default function PreviewCanvas({
  currentTime = 0,
  duration = 105.6,
  isPlaying = false,
  onTogglePlay,
  onSeek,
  onStepFrame,
  isLooping = false,
  onToggleLoop,
  volume = 1,
  onVolumeChange,
  isMuted = false,
  onToggleMute,
  tracks = [],
  clips = {},
  selectedClipId = null,
  onSelectClip,
  onUpdateClip,
  aspectRatio = '16:9',
  filterId = 'none',
  adjustments = {
    brightness: 100,
    contrast: 100,
    saturate: 100,
    blur: 0,
    sepia: 0,
    hueRotate: 0,
    opacity: 100
  },
  activeEffect = 'none',
  mainVideoUrl = null,
  resolutionLabel = null,
  stabilizeMode = 'off',
  isFreezeFrame = false,
}) {
  const { isDark } = useTheme();
  const containerRef = useRef(null);
  const viewportRef = useRef(null);
  const videoRef = useRef(null);
  const dragCleanupRef = useRef(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showGrid, setShowGrid] = useState(true);
  const [dragPreview, setDragPreview] = useState(null);

  const hiddenTrackIds = useMemo(
    () => new Set((tracks || []).filter((t) => t.visible === false).map((t) => t.id)),
    [tracks]
  );
  const mutedTrackIds = useMemo(
    () => new Set((tracks || []).filter((t) => t.muted || t.visible === false).map((t) => t.id)),
    [tracks]
  );
  const lockedTrackIds = useMemo(
    () => new Set((tracks || []).filter((t) => t.locked).map((t) => t.id)),
    [tracks]
  );

  const isClipActive = (c) =>
    c &&
    c.visible !== false &&
    !hiddenTrackIds.has(c.trackId) &&
    currentTime >= c.startTime &&
    currentTime <= (c.startTime + (c.duration || 0));

  const activeVideoClip = Object.values(clips).find(
    (c) => (c.type === 'video' || (!c.type && c.trackId === 'track-video')) && isClipActive(c)
  );

  const activeOverlayClip = Object.values(clips).find(
    (c) => c.type === 'overlay' && isClipActive(c)
  );

  const activeTextClips = Object.values(clips).filter(
    (c) => (c.type === 'text' || (!c.type && c.trackId === 'track-text')) && isClipActive(c)
  );

  const activeStickers = Object.values(clips).filter(
    (c) => (c.type === 'sticker' || (!c.type && c.trackId === 'track-stickers')) && isClipActive(c)
  );

  const activeAudioClips = Object.values(clips).filter(
    (c) => (c.type === 'audio' || c.trackId === 'track-audio') && c.url && isClipActive(c)
  );

  // Sync main video playback with clip-relative timecode & speed
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const speed = Number(activeVideoClip?.speed) > 0 ? Number(activeVideoClip.speed) : 1;
    v.playbackRate = speed;
    const clipLocalTime = activeVideoClip
      ? Math.max(0, (currentTime - (activeVideoClip.startTime || 0)) * speed + (activeVideoClip.trimStart || 0))
      : currentTime;
    if (Math.abs(v.currentTime - clipLocalTime) > 0.35) {
      v.currentTime = clipLocalTime;
    }
    if (isPlaying && activeVideoClip && !isFreezeFrame) {
      if (v.paused) v.play().catch(() => {});
    } else if (!v.paused) {
      v.pause();
    }
  }, [currentTime, isPlaying, activeVideoClip, isFreezeFrame]);

  // Sync volume/mute respecting track & clip mute state
  const isTrackAudioMuted = activeVideoClip
    ? Boolean(mutedTrackIds.has(activeVideoClip.trackId) || activeVideoClip.muted)
    : false;

  useEffect(() => {
    if (videoRef.current) {
      const clipVol = (activeVideoClip?.volume ?? 100) / 100;
      const effectivelyMuted = isMuted || isTrackAudioMuted;
      videoRef.current.volume = effectivelyMuted ? 0 : Math.max(0, Math.min(1, volume * clipVol));
      videoRef.current.muted = effectivelyMuted;
    }
  }, [volume, isMuted, isTrackAudioMuted, activeVideoClip?.volume]);

  // Cleanup active pointer drag listeners on unmount
  useEffect(() => () => dragCleanupRef.current?.(), []);

  // Sync fullscreen state when exited via Esc
  useEffect(() => {
    const onFsChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  // Compute CSS Filter String
  const activeFilter = FILTERS_LIST.find((f) => f.id === filterId);
  const baseFilterCss = activeFilter?.css || '';
  const effectFilterCss =
    activeEffect === 'rgb_split'
      ? 'drop-shadow(3px 0 0 rgba(255,0,100,0.45)) drop-shadow(-3px 0 0 rgba(0,220,255,0.45))'
      : activeEffect === 'pixelate'
        ? 'contrast(1.15) saturate(1.1)'
        : '';
  const adjCss = `brightness(${adjustments.brightness}%) contrast(${adjustments.contrast}%) saturate(${adjustments.saturate}%) blur(${adjustments.blur}px) hue-rotate(${adjustments.hueRotate}deg) sepia(${adjustments.sepia}%)`;
  const combinedFilter = `${baseFilterCss} ${adjCss} ${effectFilterCss}`.trim();

  const stabilizeScale =
    stabilizeMode === 'action' ? 1.12
      : stabilizeMode === 'cinematic' ? 1.08
        : stabilizeMode === 'standard' ? 1.04
          : 1;

  // Fullscreen toggle handler
  const handleToggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen?.().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen?.().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  // Keyboard shortcuts for frame stepping (Space is handled by VideoEditorScreen)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;
      if (e.code === 'ArrowLeft') {
        e.preventDefault();
        onStepFrame?.(-1);
      } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        onStepFrame?.(1);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onStepFrame]);

  // Smooth touch & pointer normalized overlay drag without transform drift
  const handleOverlayPointerDown = (e, clip, fallbackX, fallbackY) => {
    e.stopPropagation();
    onSelectClip?.(clip.id);
    const isLocked = lockedTrackIds.has(clip.trackId) || Boolean(clip.locked);
    if (isLocked || !viewportRef.current) return;

    dragCleanupRef.current?.();
    const startClientX = e.clientX;
    const startClientY = e.clientY;
    const origin = getOverlayPos(clip, fallbackX, fallbackY);
    const rect = viewportRef.current.getBoundingClientRect();
    if (!rect.width || !rect.height) return;

    let latestX = origin.x;
    let latestY = origin.y;
    let moved = false;

    const onPointerMove = (moveEvent) => {
      const dxPct = ((moveEvent.clientX - startClientX) / rect.width) * 100;
      const dyPct = ((moveEvent.clientY - startClientY) / rect.height) * 100;
      if (Math.abs(dxPct) > 0.3 || Math.abs(dyPct) > 0.3) moved = true;
      latestX = Math.max(5, Math.min(95, Number((origin.x + dxPct).toFixed(2))));
      latestY = Math.max(5, Math.min(95, Number((origin.y + dyPct).toFixed(2))));
      setDragPreview({ id: clip.id, x: latestX, y: latestY });
    };

    const cleanup = () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerCancel);
      dragCleanupRef.current = null;
    };

    const onPointerUp = () => {
      cleanup();
      setDragPreview(null);
      if (moved) {
        onUpdateClip?.(clip.trackId, clip.id, {
          x: latestX,
          y: latestY,
          position: { x: latestX, y: latestY },
        });
      }
    };

    const onPointerCancel = () => {
      cleanup();
      setDragPreview(null);
    };

    dragCleanupRef.current = cleanup;
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerCancel);
  };

  // Aspect ratio styling
  const aspectClass = {
    '16:9': 'aspect-[16/9] max-w-full max-h-[50vh]',
    '9:16': 'aspect-[9/16] max-h-[50vh] mx-auto',
    '1:1': 'aspect-square max-h-[50vh] mx-auto',
    '4:5': 'aspect-[4/5] max-h-[50vh] mx-auto',
    '21:9': 'aspect-[21/9] max-w-full max-h-[50vh]',
  }[aspectRatio] || 'aspect-[16/9] max-w-full max-h-[50vh]';

  return (
    <div
      ref={containerRef}
      className={`relative flex flex-col items-center justify-between w-full h-full rounded-2xl sm:rounded-3xl p-2 sm:p-4 border overflow-hidden shadow-2xl backdrop-blur-md ${
        isDark
          ? 'bg-black/80 border-white/10'
          : 'bg-slate-200/80 border-slate-300'
      }`}
    >
      {/* Active Audio Track Players */}
      {activeAudioClips.map((audioClip) => (
        <AudioClipPlayer
          key={audioClip.id}
          clip={audioClip}
          currentTime={currentTime}
          isPlaying={isPlaying}
          isFreezeFrame={isFreezeFrame}
          volume={volume}
          isMuted={isMuted || mutedTrackIds.has(audioClip.trackId)}
        />
      ))}

      {/* Main Viewport Screen */}
      <div
        ref={viewportRef}
        className={`relative w-full ${aspectClass} rounded-xl sm:rounded-2xl overflow-hidden bg-black flex items-center justify-center shadow-inner group select-none`}
      >
        {/* Background Visual Video / Image Canvas */}
        <div
          className="relative w-full h-full flex items-center justify-center overflow-hidden transition-all duration-150"
          style={{
            filter: combinedFilter,
            opacity: (adjustments.opacity ?? 100) / 100
          }}
        >
          {/* Active Video Element or Default Composition Stream */}
          <video
            ref={videoRef}
            src={activeVideoClip?.url || mainVideoUrl || ''}
            className="w-full h-full object-cover pointer-events-none transition-transform duration-200"
            style={{
              transform: `${activeEffect === 'mirror' ? 'scaleX(-1) ' : ''}scale(${stabilizeScale})`,
              imageRendering: activeEffect === 'pixelate' ? 'pixelated' : 'auto',
            }}
            playsInline
            muted={isMuted || isTrackAudioMuted}
            loop={isLooping}
            onEnded={() => {
              if (isLooping) {
                onSeek?.(0);
              } else {
                onTogglePlay?.();
              }
            }}
          />

          {/* Active Overlay Layer */}
          {activeOverlayClip && (
            <div
              className="absolute inset-0 pointer-events-none mix-blend-screen transition-opacity duration-200"
              style={{
                background: activeOverlayClip.gradient || 'linear-gradient(135deg, rgba(168,85,247,0.35), rgba(59,130,246,0.25))',
                opacity: activeOverlayClip.opacity ?? 0.85
              }}
            />
          )}

          {/* Effect Layers (VHS, Film Grain, Light Leak, Vignette, Neon Glow) */}
          {activeEffect === 'vhs' && (
            <div className="absolute inset-0 pointer-events-none bg-[repeating-linear-gradient(0deg,rgba(0,0,0,0.2),rgba(0,0,0,0.2)_1px,transparent_1px,transparent_3px)] opacity-70 mix-blend-overlay" />
          )}
          {activeEffect === 'grain' && (
            <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(rgba(255,255,255,0.16)_1px,transparent_0)] [background-size:3px_3px] opacity-40 mix-blend-overlay" />
          )}
          {activeEffect === 'light_leak' && (
            <div className="absolute inset-0 pointer-events-none bg-gradient-to-tr from-amber-500/35 via-rose-500/20 to-transparent mix-blend-screen" />
          )}
          {activeEffect === 'vignette' && (
            <div className="absolute inset-0 pointer-events-none shadow-[inset_0_0_100px_rgba(0,0,0,0.85)]" />
          )}
          {activeEffect === 'glow' && (
            <div className="absolute inset-0 pointer-events-none bg-purple-500/15 mix-blend-screen animate-pulse" />
          )}

          {/* Dynamic Interactive Text Overlays */}
          {activeTextClips.map((textClip) => {
            const isSelected = selectedClipId === textClip.id;
            const isLocked = lockedTrackIds.has(textClip.trackId) || Boolean(textClip.locked);
            const pos = dragPreview?.id === textClip.id ? dragPreview : getOverlayPos(textClip, 50, 50);
            return (
              <div
                key={textClip.id}
                onPointerDown={(e) => handleOverlayPointerDown(e, textClip, 50, 50)}
                className={`absolute touch-none select-none px-4 py-2 rounded-xl transition-shadow duration-150 ${
                  isLocked ? 'cursor-not-allowed' : 'cursor-move'
                } ${
                  isSelected
                    ? 'ring-2 ring-purple-400 ring-offset-2 ring-offset-black shadow-lg shadow-purple-500/40 bg-purple-900/60 backdrop-blur-md'
                    : 'hover:ring-1 hover:ring-white/40'
                }`}
                style={{
                  top: `${pos.y}%`,
                  left: `${pos.x}%`,
                  transform: 'translate(-50%, -50%)',
                  fontFamily: textClip.fontFamily || 'Plus Jakarta Sans',
                  fontSize: `${textClip.fontSize || 28}px`,
                  color: textClip.color || '#ffffff',
                  backgroundColor: textClip.bgColor || 'rgba(0,0,0,0.4)',
                  borderColor: textClip.borderColor || 'transparent',
                  borderWidth: textClip.borderColor ? '1px' : '0px',
                }}
              >
                <div className="font-bold tracking-wide drop-shadow-md whitespace-nowrap flex items-center gap-1.5">
                  <span>{textClip.text || textClip.title || 'Text Overlay'}</span>
                  {isLocked && <Lock className="w-3 h-3 text-amber-300 shrink-0" />}
                </div>
              </div>
            );
          })}

          {/* Dynamic Interactive Stickers */}
          {activeStickers.map((sticker) => {
            const isSelected = selectedClipId === sticker.id;
            const isLocked = lockedTrackIds.has(sticker.trackId) || Boolean(sticker.locked);
            const pos = dragPreview?.id === sticker.id ? dragPreview : getOverlayPos(sticker, 50, 50);
            const scale = sticker.scale ?? 1;
            return (
              <div
                key={sticker.id}
                onPointerDown={(e) => handleOverlayPointerDown(e, sticker, 50, 50)}
                className={`absolute touch-none select-none p-2 rounded-2xl ${
                  isLocked ? 'cursor-not-allowed' : 'cursor-move'
                } ${isSelected ? 'ring-2 ring-cyan-400 shadow-lg' : ''}`}
                style={{
                  top: `${pos.y}%`,
                  left: `${pos.x}%`,
                  transform: `translate(-50%, -50%) scale(${scale})`,
                  fontSize: `${sticker.size || 48}px`,
                }}
              >
                <span>{sticker.emoji || sticker.title || '🔥'}</span>
              </div>
            );
          })}
        </div>

        {/* Top-Left Status Badges */}
        <div className="absolute top-3 left-3 flex items-center gap-1.5 z-20 pointer-events-none">
          <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-black/60 backdrop-blur-md border border-white/20 text-white text-[11px] font-semibold tracking-wide shadow-md">
            <Eye className="w-3.5 h-3.5 text-cyan-400" />
            <span>{isFreezeFrame ? 'Freeze' : stabilizeMode !== 'off' ? `Stab: ${stabilizeMode}` : 'Original'}</span>
          </div>
          {resolutionLabel && (
            <div className="px-2 py-0.5 rounded-full bg-indigo-600/80 backdrop-blur-md border border-indigo-400/40 text-white text-[10px] font-extrabold tracking-wider shadow-md">
              {resolutionLabel}
            </div>
          )}
        </div>

        {/* Rule-of-Thirds Grid Lines (Subtle Framing) */}
        {showGrid && (
          <div className="absolute inset-0 pointer-events-none z-10 opacity-30">
            <div className="absolute top-1/3 left-0 right-0 h-[1px] border-b border-dashed border-white/40" />
            <div className="absolute top-2/3 left-0 right-0 h-[1px] border-b border-dashed border-white/40" />
            <div className="absolute left-1/3 top-0 bottom-0 w-[1px] border-r border-dashed border-white/40" />
            <div className="absolute left-2/3 top-0 bottom-0 w-[1px] border-r border-dashed border-white/40" />
          </div>
        )}

        {/* Corner Crop Brackets */}
        <div className="absolute inset-2 sm:inset-3 pointer-events-none z-10">
          <div className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-indigo-400/80 rounded-tl-lg shadow-[0_0_10px_rgba(99,102,241,0.5)]" />
          <div className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-indigo-400/80 rounded-tr-lg shadow-[0_0_10px_rgba(99,102,241,0.5)]" />
          <div className="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 border-indigo-400/80 rounded-bl-lg shadow-[0_0_10px_rgba(99,102,241,0.5)]" />
          <div className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-indigo-400/80 rounded-br-lg shadow-[0_0_10px_rgba(99,102,241,0.5)]" />
        </div>
      </div>

      {/* Bottom Controls Bar Below Preview */}
      <div className={`w-full flex items-center justify-between gap-2 sm:gap-4 mt-3 px-2 py-1.5 rounded-xl border ${
        isDark
          ? 'bg-gray-950/70 border-white/10'
          : 'bg-white/90 border-gray-200'
      }`}>
        {/* Timecode Indicator */}
        <div className={`flex items-center gap-1 text-xs sm:text-sm font-mono font-semibold tracking-wider ${
          isDark ? 'text-gray-200' : 'text-gray-800'
        }`}>
          <span className="text-purple-500 font-bold">{formatTimecode(currentTime)}</span>
          <span className="text-gray-500">/</span>
          <span className={isDark ? 'text-gray-400' : 'text-gray-600'}>{formatTimecode(duration)}</span>
        </div>

        {/* Center Transport Controls */}
        <div className="flex items-center gap-2 sm:gap-3">
          <button
            onClick={() => onStepFrame?.(-1)}
            title="Previous Frame (Left Arrow)"
            className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center transition-colors active:scale-95 ${
              isDark ? 'text-gray-300 hover:text-white hover:bg-white/10' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
            }`}
          >
            <SkipBack className="w-3.5 h-3.5 sm:w-4 sm:h-4 fill-current" />
          </button>

          <button
            id="editor-play-pause-btn"
            onClick={onTogglePlay}
            title="Play / Pause (Space)"
            className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-gradient-to-tr from-purple-600 to-indigo-500 hover:from-purple-500 hover:to-indigo-400 text-white flex items-center justify-center shadow-lg shadow-purple-600/30 transition-all duration-150 active:scale-95"
          >
            {isPlaying ? (
              <Pause className="w-4 h-4 sm:w-5 sm:h-5 fill-current" />
            ) : (
              <Play className="w-4 h-4 sm:w-5 sm:h-5 fill-current ml-0.5" />
            )}
          </button>

          <button
            onClick={() => onStepFrame?.(1)}
            title="Next Frame (Right Arrow)"
            className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center transition-colors active:scale-95 ${
              isDark ? 'text-gray-300 hover:text-white hover:bg-white/10' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
            }`}
          >
            <SkipForward className="w-3.5 h-3.5 sm:w-4 sm:h-4 fill-current" />
          </button>

          <button
            onClick={onToggleLoop}
            title={isLooping ? 'Looping enabled' : 'Enable loop'}
            className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center transition-colors active:scale-95 ${
              isLooping
                ? 'text-purple-500 bg-purple-500/15'
                : isDark ? 'text-gray-400 hover:text-white hover:bg-white/10' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'
            }`}
          >
            <Repeat className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </button>
        </div>

        {/* Right Volume & Fullscreen Controls */}
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="flex items-center gap-1.5 group">
            <button
              onClick={onToggleMute}
              className={`transition-colors ${isDark ? 'text-gray-300 hover:text-white' : 'text-gray-600 hover:text-gray-900'}`}
              title={isMuted ? 'Unmute' : 'Mute'}
            >
              {isMuted || volume === 0 ? (
                <VolumeX className="w-4 h-4 text-rose-400" />
              ) : (
                <Volume2 className="w-4 h-4" />
              )}
            </button>
            <input
              aria-label="Preview volume"
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={isMuted ? 0 : volume}
              onChange={(e) => onVolumeChange?.(parseFloat(e.target.value))}
              className={`w-14 sm:w-20 h-1.5 rounded-lg appearance-none cursor-pointer accent-purple-500 ${
                isDark ? 'bg-white/20' : 'bg-gray-300'
              }`}
            />
          </div>

          <button
            onClick={() => setShowGrid((g) => !g)}
            title={showGrid ? 'Hide framing grid' : 'Show framing grid'}
            aria-pressed={showGrid}
            className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center transition-colors active:scale-95 ${
              showGrid
                ? 'text-cyan-500 bg-cyan-500/10'
                : isDark ? 'text-gray-400 hover:text-white hover:bg-white/10' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'
            }`}
          >
            <Grid3x3 className="w-4 h-4" />
          </button>

          <button
            onClick={handleToggleFullscreen}
            title="Toggle Fullscreen"
            className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center transition-colors active:scale-95 ${
              isDark ? 'text-gray-400 hover:text-white hover:bg-white/10' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'
            }`}
          >
            {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </div>
  );
}

PreviewCanvas.propTypes = {
  currentTime: PropTypes.number,
  duration: PropTypes.number,
  isPlaying: PropTypes.bool,
  onTogglePlay: PropTypes.func,
  onSeek: PropTypes.func,
  onStepFrame: PropTypes.func,
  isLooping: PropTypes.bool,
  onToggleLoop: PropTypes.func,
  volume: PropTypes.number,
  onVolumeChange: PropTypes.func,
  isMuted: PropTypes.bool,
  onToggleMute: PropTypes.func,
  tracks: PropTypes.array,
  clips: PropTypes.object,
  selectedClipId: PropTypes.string,
  onSelectClip: PropTypes.func,
  onUpdateClip: PropTypes.func,
  aspectRatio: PropTypes.string,
  filterId: PropTypes.string,
  adjustments: PropTypes.object,
  activeEffect: PropTypes.string,
  mainVideoUrl: PropTypes.string,
  resolutionLabel: PropTypes.string,
  stabilizeMode: PropTypes.string,
  isFreezeFrame: PropTypes.bool,
};
