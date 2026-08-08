// src/screens/VideoEditor/components/PreviewCanvas.jsx
import React, { useRef, useEffect, useState, useCallback } from 'react';
import PropTypes from 'prop-types';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Play, Pause, SkipBack, SkipForward, Repeat,
  Volume2, VolumeX, Maximize, Minimize, Eye, Sparkles,
  Move, RotateCw, Trash2
} from 'lucide-react';
import { formatTimecode, FILTERS_LIST } from '../constants';

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
  mainVideoUrl = null
}) {
  const containerRef = useRef(null);
  const videoRef = useRef(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showGrid, setShowGrid] = useState(true);
  const [isDraggingOverlay, setIsDraggingOverlay] = useState(false);

  // Sync main video playback with currentTime
  useEffect(() => {
    if (videoRef.current) {
      const v = videoRef.current;
      if (Math.abs(v.currentTime - currentTime) > 0.3) {
        v.currentTime = currentTime;
      }
      if (isPlaying && v.paused) {
        v.play().catch(() => {});
      } else if (!isPlaying && !v.paused) {
        v.pause();
      }
    }
  }, [currentTime, isPlaying]);

  // Sync volume/mute
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.volume = isMuted ? 0 : volume;
      videoRef.current.muted = isMuted;
    }
  }, [volume, isMuted]);

  // Compute CSS Filter String
  const activeFilter = FILTERS_LIST.find((f) => f.id === filterId);
  const baseFilterCss = activeFilter?.css || '';
  const adjCss = `brightness(${adjustments.brightness}%) contrast(${adjustments.contrast}%) saturate(${adjustments.saturate}%) blur(${adjustments.blur}px) hue-rotate(${adjustments.hueRotate}deg) sepia(${adjustments.sepia}%)`;
  const combinedFilter = `${baseFilterCss} ${adjCss}`.trim();

  // Fullscreen toggle handler
  const handleToggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen?.().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen?.().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  // Keyboard shortcut for Play/Pause (Space)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if (e.code === 'Space') {
        e.preventDefault();
        onTogglePlay?.();
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault();
        onStepFrame?.(-1);
      } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        onStepFrame?.(1);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onTogglePlay, onStepFrame]);

  // Find active visible clips at current time
  const activeVideoClip = Object.values(clips).find(
    (c) => c.type === 'video' && currentTime >= c.startTime && currentTime <= (c.startTime + c.duration)
  );

  const activeOverlayClip = Object.values(clips).find(
    (c) => c.type === 'overlay' && currentTime >= c.startTime && currentTime <= (c.startTime + c.duration)
  );

  const activeTextClips = Object.values(clips).filter(
    (c) => c.type === 'text' && currentTime >= c.startTime && currentTime <= (c.startTime + c.duration)
  );

  const activeStickers = Object.values(clips).filter(
    (c) => c.type === 'sticker' && currentTime >= c.startTime && currentTime <= (c.startTime + c.duration)
  );

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
      className="relative flex flex-col items-center justify-between w-full h-full bg-black/60 dark:bg-black/80 light:bg-slate-900/10 rounded-2xl sm:rounded-3xl p-2 sm:p-4 border border-white/10 dark:border-white/10 light:border-gray-200 overflow-hidden shadow-2xl backdrop-blur-md"
    >
      {/* Main Viewport Screen */}
      <div className={`relative w-full ${aspectClass} rounded-xl sm:rounded-2xl overflow-hidden bg-black flex items-center justify-center shadow-inner group select-none`}>
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
            src={activeVideoClip?.url || mainVideoUrl || 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4'}
            className="w-full h-full object-cover pointer-events-none"
            playsInline
            muted={isMuted}
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

          {/* Effect Layer (VHS, Film Grain, Vignette, Neon Glow) */}
          {activeEffect === 'vhs' && (
            <div className="absolute inset-0 pointer-events-none bg-[repeating-linear-gradient(0deg,rgba(0,0,0,0.15),rgba(0,0,0,0.15)_1px,transparent_1px,transparent_2px)] opacity-60 mix-blend-overlay" />
          )}
          {activeEffect === 'vignette' && (
            <div className="absolute inset-0 pointer-events-none shadow-[inset_0_0_100px_rgba(0,0,0,0.8)]" />
          )}
          {activeEffect === 'glow' && (
            <div className="absolute inset-0 pointer-events-none bg-purple-500/10 mix-blend-screen animate-pulse" />
          )}

          {/* Dynamic Interactive Text Overlays */}
          {activeTextClips.map((textClip) => {
            const isSelected = selectedClipId === textClip.id;
            return (
              <motion.div
                key={textClip.id}
                drag
                dragMomentum={false}
                onDragStart={() => setIsDraggingOverlay(true)}
                onDragEnd={(e, info) => {
                  setIsDraggingOverlay(false);
                  onUpdateClip?.(textClip.trackId, textClip.id, {
                    x: (textClip.x || 50) + (info.offset.x / 4),
                    y: (textClip.y || 50) + (info.offset.y / 4),
                  });
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectClip?.(textClip.id);
                }}
                className={`absolute cursor-move select-none px-4 py-2 rounded-xl transition-all duration-150 ${
                  isSelected
                    ? 'ring-2 ring-purple-400 ring-offset-2 ring-offset-black shadow-lg shadow-purple-500/40 bg-purple-900/60 backdrop-blur-md'
                    : 'hover:ring-1 hover:ring-white/40'
                }`}
                style={{
                  top: `${textClip.y || 50}%`,
                  left: `${textClip.x || 50}%`,
                  transform: 'translate(-50%, -50%)',
                  fontFamily: textClip.fontFamily || 'Plus Jakarta Sans',
                  fontSize: `${textClip.fontSize || 28}px`,
                  color: textClip.color || '#ffffff',
                  backgroundColor: textClip.bgColor || 'rgba(0,0,0,0.4)',
                  borderColor: textClip.borderColor || 'transparent',
                  borderWidth: textClip.borderColor ? '1px' : '0px',
                }}
              >
                <div className="font-bold tracking-wide drop-shadow-md whitespace-nowrap">
                  {textClip.text || textClip.title || 'Text Overlay'}
                </div>
              </motion.div>
            );
          })}

          {/* Dynamic Interactive Stickers */}
          {activeStickers.map((sticker) => {
            const isSelected = selectedClipId === sticker.id;
            return (
              <motion.div
                key={sticker.id}
                drag
                dragMomentum={false}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectClip?.(sticker.id);
                }}
                className={`absolute cursor-move select-none p-2 rounded-2xl ${
                  isSelected ? 'ring-2 ring-cyan-400 scale-110 shadow-lg' : ''
                }`}
                style={{
                  top: `${sticker.y || 40}%`,
                  left: `${sticker.x || 60}%`,
                  transform: 'translate(-50%, -50%)',
                  fontSize: `${sticker.size || 48}px`,
                }}
              >
                <span>{sticker.emoji || sticker.title || '🔥'}</span>
              </motion.div>
            );
          })}
        </div>

        {/* Framing Guides & Camera HUD Overlays */}
        {/* Top-Left Status Badges */}
        <div className="absolute top-3 left-3 flex items-center gap-1.5 z-20 pointer-events-none">
          <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-black/60 backdrop-blur-md border border-white/20 text-white text-[11px] font-semibold tracking-wide shadow-md">
            <Eye className="w-3.5 h-3.5 text-cyan-400" />
            <span>Original</span>
          </div>
          <div className="px-2 py-0.5 rounded-full bg-indigo-600/80 backdrop-blur-md border border-indigo-400/40 text-white text-[10px] font-extrabold tracking-wider shadow-md">
            4K
          </div>
        </div>

        {/* Rule-of-Thirds Grid Lines (Subtle Framing) */}
        {showGrid && (
          <div className="absolute inset-0 pointer-events-none z-10 opacity-30">
            {/* Horizontal lines */}
            <div className="absolute top-1/3 left-0 right-0 h-[1px] border-b border-dashed border-white/40" />
            <div className="absolute top-2/3 left-0 right-0 h-[1px] border-b border-dashed border-white/40" />
            {/* Vertical lines */}
            <div className="absolute left-1/3 top-0 bottom-0 w-[1px] border-r border-dashed border-white/40" />
            <div className="absolute left-2/3 top-0 bottom-0 w-[1px] border-r border-dashed border-white/40" />
          </div>
        )}

        {/* Glowing Neon Purple Corner Crop Brackets (Screen HUD Frame) */}
        <div className="absolute inset-2 sm:inset-3 pointer-events-none z-10">
          {/* Top-Left Bracket */}
          <div className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-indigo-400/80 rounded-tl-lg shadow-[0_0_10px_rgba(99,102,241,0.5)]" />
          {/* Top-Right Bracket */}
          <div className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-indigo-400/80 rounded-tr-lg shadow-[0_0_10px_rgba(99,102,241,0.5)]" />
          {/* Bottom-Left Bracket */}
          <div className="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 border-indigo-400/80 rounded-bl-lg shadow-[0_0_10px_rgba(99,102,241,0.5)]" />
          {/* Bottom-Right Bracket */}
          <div className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-indigo-400/80 rounded-br-lg shadow-[0_0_10px_rgba(99,102,241,0.5)]" />
        </div>
      </div>

      {/* Bottom Controls Bar Below Preview */}
      <div className="w-full flex items-center justify-between gap-2 sm:gap-4 mt-3 px-2 py-1.5 rounded-xl bg-gray-950/60 dark:bg-gray-950/70 light:bg-white/80 border border-white/10 dark:border-white/10 light:border-gray-200">
        {/* Timecode Indicator */}
        <div className="flex items-center gap-1 text-xs sm:text-sm font-mono font-semibold text-gray-200 dark:text-gray-200 light:text-gray-800 tracking-wider">
          <span className="text-purple-400 font-bold">{formatTimecode(currentTime)}</span>
          <span className="text-gray-500">/</span>
          <span className="text-gray-400">{formatTimecode(duration)}</span>
        </div>

        {/* Center Transport Controls (Prev Frame, Play/Pause, Next Frame, Loop) */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Step Back Frame */}
          <button
            onClick={() => onStepFrame?.(-1)}
            title="Previous Frame (Left Arrow)"
            className="w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-gray-300 hover:text-white hover:bg-white/10 transition-colors active:scale-95"
          >
            <SkipBack className="w-3.5 h-3.5 sm:w-4 sm:h-4 fill-current" />
          </button>

          {/* Big Play / Pause */}
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

          {/* Step Forward Frame */}
          <button
            onClick={() => onStepFrame?.(1)}
            title="Next Frame (Right Arrow)"
            className="w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-gray-300 hover:text-white hover:bg-white/10 transition-colors active:scale-95"
          >
            <SkipForward className="w-3.5 h-3.5 sm:w-4 sm:h-4 fill-current" />
          </button>

          {/* Loop Toggle */}
          <button
            onClick={onToggleLoop}
            title={isLooping ? 'Looping enabled' : 'Enable loop'}
            className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center transition-colors active:scale-95 ${
              isLooping ? 'text-purple-400 bg-purple-500/20' : 'text-gray-400 hover:text-white hover:bg-white/10'
            }`}
          >
            <Repeat className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </button>
        </div>

        {/* Right Volume & Fullscreen Controls */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Volume Control */}
          <div className="flex items-center gap-1.5 group">
            <button
              onClick={onToggleMute}
              className="text-gray-300 hover:text-white transition-colors"
              title={isMuted ? 'Unmute' : 'Mute'}
            >
              {isMuted || volume === 0 ? (
                <VolumeX className="w-4 h-4 text-rose-400" />
              ) : (
                <Volume2 className="w-4 h-4" />
              )}
            </button>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={isMuted ? 0 : volume}
              onChange={(e) => onVolumeChange?.(parseFloat(e.target.value))}
              className="w-14 sm:w-20 h-1.5 bg-white/20 rounded-lg appearance-none cursor-pointer accent-purple-500"
            />
          </div>

          {/* Fullscreen Button */}
          <button
            onClick={handleToggleFullscreen}
            title="Toggle Fullscreen"
            className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 transition-colors active:scale-95"
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
  mainVideoUrl: PropTypes.string
};
