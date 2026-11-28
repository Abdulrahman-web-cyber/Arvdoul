// src/screens/VideoEditor/components/MultiTrackTimeline.jsx

import { useRef, useState, useEffect, useCallback } from "react";
import PropTypes from 'prop-types';
import { Eye, EyeOff, Lock, Unlock, Plus, Video, Type, Image as ImageIcon, Music, Mic, Star } from "lucide-react";
import { formatMinutesSeconds } from '../constants';
import { LazyImage } from '../../../components/Shared/LazyImage';
import { useTheme } from '../../../context/ThemeContext';

export default function MultiTrackTimeline({
  tracks = [],
  clips = {},
  currentTime = 0,
  duration = 105.6,
  onSeek,
  selectedClipId = null,
  onSelectClip,
  onUpdateClip,
  onAddTrack,
  onToggleTrackVisibility,
  onToggleTrackLock,
  zoomLevel = 1,
  isMagnetOn = true,
}) {
  const { isDark } = useTheme();
  const rulerRef = useRef(null);
  const containerRef = useRef(null);
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [draggingClip, setDraggingClip] = useState(null); // { id, initialX, initialStartTime, trackId }
  const [trimmingHandle, setTrimmingHandle] = useState(null); // { id, side: 'left'|'right', initialX, initialStartTime, initialDuration, initialTrimStart }

  // Pixels per second calculation based on zoomLevel
  const pxPerSec = 22 * zoomLevel;
  const timelineWidth = Math.max(800, duration * pxPerSec);

  // Generate ruler markers every 5 seconds
  const markersCount = Math.ceil(duration / 5) + 4;
  const markers = Array.from({ length: markersCount }, (_, i) => i * 5);

  const lockedTrackIds = new Set((tracks || []).filter((t) => t.locked).map((t) => t.id));

  const updateTimeFromPointer = useCallback((e) => {
    if (!rulerRef.current) return;
    const rect = rulerRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const newTime = Math.max(0, Math.min(duration, clickX / pxPerSec));
    onSeek?.(newTime);
  }, [duration, pxPerSec, onSeek]);

  // Scrubbing on Ruler / Timeline pointer down
  const handleRulerPointerDown = (e) => {
    if (!rulerRef.current) return;
    e.preventDefault();
    setIsScrubbing(true);
    updateTimeFromPointer(e);
  };

  useEffect(() => {
    const handlePointerMove = (e) => {
      if (isScrubbing) {
        updateTimeFromPointer(e);
      } else if (draggingClip) {
        const deltaX = e.clientX - draggingClip.initialX;
        let deltaSec = deltaX / pxPerSec;
        if (isMagnetOn) {
          deltaSec = Math.round(deltaSec * 2) / 2; // snap to 0.5s
        }
        const newStartTime = Math.max(0, Number((draggingClip.initialStartTime + deltaSec).toFixed(2)));
        onUpdateClip?.(draggingClip.trackId, draggingClip.id, { startTime: newStartTime });
      } else if (trimmingHandle) {
        const deltaX = e.clientX - trimmingHandle.initialX;
        let deltaSec = deltaX / pxPerSec;
        if (isMagnetOn) deltaSec = Math.round(deltaSec * 2) / 2;

        const clip = clips[trimmingHandle.id];
        if (!clip) return;

        if (trimmingHandle.side === 'left') {
          const minDelta = Math.max(
            -trimmingHandle.initialStartTime,
            -(trimmingHandle.initialTrimStart || 0)
          );
          const maxDelta = trimmingHandle.initialDuration - 0.5;
          const clampedDelta = Math.max(minDelta, Math.min(maxDelta, deltaSec));
          const newStart = Math.max(0, Number((trimmingHandle.initialStartTime + clampedDelta).toFixed(2)));
          const newDuration = Math.max(0.5, Number((trimmingHandle.initialDuration - clampedDelta).toFixed(2)));
          const newTrimStart = Math.max(0, Number(((trimmingHandle.initialTrimStart || 0) + clampedDelta).toFixed(2)));
          onUpdateClip?.(clip.trackId, clip.id, {
            startTime: newStart,
            duration: newDuration,
            trimStart: newTrimStart,
          });
        } else {
          const newDuration = Math.max(0.5, Number((trimmingHandle.initialDuration + deltaSec).toFixed(2)));
          onUpdateClip?.(clip.trackId, clip.id, {
            duration: newDuration,
            trimEnd: Number(((trimmingHandle.initialTrimStart || 0) + newDuration).toFixed(2)),
          });
        }
      }
    };

    const handlePointerUp = () => {
      if (isScrubbing) setIsScrubbing(false);
      if (draggingClip) setDraggingClip(null);
      if (trimmingHandle) setTrimmingHandle(null);
    };

    if (isScrubbing || draggingClip || trimmingHandle) {
      window.addEventListener('pointermove', handlePointerMove);
      window.addEventListener('pointerup', handlePointerUp);
      window.addEventListener('pointercancel', handlePointerUp);
    }
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);
    };
  }, [isScrubbing, draggingClip, trimmingHandle, updateTimeFromPointer, pxPerSec, isMagnetOn, clips, onUpdateClip]);

  const getTrackIcon = (iconName, type) => {
    switch (type) {
      case 'video':
        return <Video className="w-3.5 h-3.5 text-indigo-400" />;
      case 'overlay':
        return <ImageIcon className="w-3.5 h-3.5 text-purple-400" />;
      case 'text':
        return <Type className="w-3.5 h-3.5 text-emerald-400" />;
      case 'sticker':
        return <Star className="w-3.5 h-3.5 text-amber-400" />;
      case 'audio':
        return iconName === 'Mic' ? <Mic className="w-3.5 h-3.5 text-blue-400" /> : <Music className="w-3.5 h-3.5 text-emerald-400" />;
      default:
        return <Video className="w-3.5 h-3.5 text-gray-400" />;
    }
  };

  return (
    <div
      className={`relative flex w-full rounded-2xl border overflow-hidden shadow-2xl backdrop-blur-md select-none ${
        isDark ? 'bg-gray-950/90 border-white/10' : 'bg-white/95 border-gray-200'
      }`}
    >
      {/* Left Track Headers Column */}
      <div
        className={`w-28 sm:w-36 shrink-0 border-r z-20 flex flex-col ${
          isDark ? 'bg-gray-950/95 border-white/10' : 'bg-slate-100/95 border-gray-200'
        }`}
      >
        {/* Header Spacer matching Ruler height */}
        <div
          className={`h-8 border-b flex items-center px-3 text-[10px] uppercase font-bold tracking-wider text-gray-400 ${
            isDark ? 'border-white/10' : 'border-gray-200'
          }`}
        >
          Tracks
        </div>

        {/* Track Label Rows */}
        <div className="flex-1 flex flex-col space-y-2 py-2">
          {tracks.map((track) => (
            <div
              key={track.id}
              className={`h-10 px-2.5 flex items-center justify-between text-xs rounded-lg mx-1.5 border ${
                isDark
                  ? 'text-gray-300 bg-white/5 border-white/5'
                  : 'text-gray-700 bg-white border-gray-200 shadow-2xs'
              }`}
            >
              <div className="flex items-center gap-1.5 min-w-0">
                {getTrackIcon(track.icon, track.type)}
                <span className="font-semibold truncate text-[11px] sm:text-xs">
                  {track.name}
                </span>
              </div>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => onToggleTrackVisibility?.(track.id)}
                  aria-label={track.visible !== false ? `Hide ${track.name}` : `Show ${track.name}`}
                  className={`p-0.5 ${isDark ? 'text-gray-400 hover:text-white' : 'text-gray-500 hover:text-gray-900'}`}
                  title={track.visible !== false ? 'Mute/Hide track' : 'Show track'}
                >
                  {track.visible !== false ? (
                    <Eye className="w-3 h-3" />
                  ) : (
                    <EyeOff className="w-3 h-3 text-rose-400" />
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => onToggleTrackLock?.(track.id)}
                  aria-label={track.locked ? `Unlock ${track.name}` : `Lock ${track.name}`}
                  className={`p-0.5 ${isDark ? 'text-gray-400 hover:text-white' : 'text-gray-500 hover:text-gray-900'}`}
                  title={track.locked ? 'Unlock track' : 'Lock track'}
                >
                  {track.locked ? (
                    <Lock className="w-3 h-3 text-amber-400" />
                  ) : (
                    <Unlock className="w-3 h-3 text-gray-500" />
                  )}
                </button>
              </div>
            </div>
          ))}

          {/* Add Track Button */}
          <button
            type="button"
            onClick={onAddTrack}
            className="h-8 mx-1.5 mt-1 flex items-center justify-center gap-1.5 text-[11px] font-semibold text-purple-400 hover:text-purple-300 bg-purple-500/10 hover:bg-purple-500/20 rounded-lg border border-dashed border-purple-500/30 transition-colors"
          >
            <Plus className="w-3 h-3" />
            <span>Add Track</span>
          </button>
        </div>
      </div>

      {/* Right Scrollable Timeline Canvas & Playhead */}
      <div
        ref={containerRef}
        className="flex-1 overflow-x-auto overflow-y-hidden relative scrollbar-thin scrollbar-thumb-white/10"
      >
        <div style={{ width: `${timelineWidth}px` }} className="relative min-h-[220px]">
          {/* Top Time Ruler */}
          <div
            ref={rulerRef}
            onPointerDown={handleRulerPointerDown}
            className={`h-8 border-b relative cursor-pointer flex items-end touch-none ${
              isDark ? 'border-white/10 bg-black/40' : 'border-gray-200 bg-slate-100/90'
            }`}
          >
            {markers.map((sec) => (
              <div
                key={sec}
                className="absolute bottom-0 flex flex-col items-center select-none pointer-events-none"
                style={{ left: `${sec * pxPerSec}px` }}
              >
                <span className={`text-[9px] font-mono font-medium mb-1 -translate-x-1/2 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                  {formatMinutesSeconds(sec)}
                </span>
                <div className={`w-[1px] h-2 ${isDark ? 'bg-white/20' : 'bg-gray-300'}`} />
              </div>
            ))}
          </div>

          {/* Vertical Track Strip Rows */}
          <div className="flex flex-col space-y-2 py-2 relative">
            {tracks.map((track) => {
              // Filter clips belonging to this track
              const trackClips = Object.values(clips).filter((c) => c.trackId === track.id);

              return (
                <div
                  key={track.id}
                  className={`h-10 relative border-b flex items-center ${
                    isDark ? 'bg-white/[0.02] border-white/5' : 'bg-gray-100/60 border-gray-200/70'
                  }`}
                >
                  {trackClips.map((clip) => {
                    const isSelected = selectedClipId === clip.id;
                    const isLocked = Boolean(clip.locked || lockedTrackIds.has(clip.trackId));
                    const leftPos = (clip.startTime || 0) * pxPerSec;
                    const widthVal = Math.max(30, (clip.duration || 1) * pxPerSec);

                    // Styling by Clip Type
                    let clipBgClass = 'bg-indigo-900/70 border-indigo-500/70 text-white';
                    let waveformColor = '#818cf8';

                    if (clip.type === 'overlay') {
                      clipBgClass = 'bg-gradient-to-r from-purple-800/80 to-indigo-800/80 border-purple-400/80 text-white';
                    } else if (clip.type === 'text') {
                      clipBgClass = 'bg-gradient-to-r from-emerald-900/80 to-teal-900/80 border-emerald-400/80 text-emerald-100';
                    } else if (clip.type === 'sticker') {
                      clipBgClass = 'bg-gradient-to-r from-amber-700/80 to-pink-700/80 border-amber-400/80 text-white';
                    } else if (clip.type === 'audio') {
                      if (clip.color === '#3b82f6') {
                        clipBgClass = 'bg-blue-950/85 border-blue-500/80 text-blue-100';
                        waveformColor = '#60a5fa';
                      } else {
                        clipBgClass = 'bg-emerald-950/85 border-emerald-500/80 text-emerald-100';
                        waveformColor = '#34d399';
                      }
                    }

                    return (
                      <div
                        key={clip.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectClip?.(clip.id);
                        }}
                        onPointerDown={(e) => {
                          if (e.target.dataset.handle || isLocked) return;
                          e.preventDefault();
                          onSelectClip?.(clip.id);
                          setDraggingClip({
                            id: clip.id,
                            initialX: e.clientX,
                            initialStartTime: clip.startTime || 0,
                            trackId: clip.trackId,
                          });
                        }}
                        className={`absolute top-1 bottom-1 rounded-xl border shadow-md flex items-center overflow-hidden transition-shadow group touch-none ${clipBgClass} ${
                          isLocked ? 'cursor-not-allowed opacity-75' : 'cursor-grab active:cursor-grabbing'
                        } ${
                          isSelected
                            ? 'ring-2 ring-purple-400 shadow-lg shadow-purple-500/30 border-purple-400 z-10'
                            : 'hover:border-white/40'
                        }`}
                        style={{
                          left: `${leftPos}px`,
                          width: `${widthVal}px`,
                        }}
                      >
                        {/* Left Trim Handle */}
                        <div
                          data-handle="left"
                          onPointerDown={(e) => {
                            if (isLocked) return;
                            e.stopPropagation();
                            e.preventDefault();
                            setTrimmingHandle({
                              id: clip.id,
                              side: 'left',
                              initialX: e.clientX,
                              initialStartTime: clip.startTime || 0,
                              initialDuration: clip.duration || 1,
                              initialTrimStart: clip.trimStart || 0,
                            });
                          }}
                          className={`absolute left-0 top-0 bottom-0 w-2.5 hover:w-3 bg-white/20 hover:bg-purple-400/80 transition-all z-20 touch-none ${
                            isLocked ? 'cursor-not-allowed' : 'cursor-ew-resize'
                          }`}
                        />

                        {/* Thumbnail Strip for Video Clips */}
                        {clip.type === 'video' && clip.thumbnail && (
                          <div className="absolute inset-0 opacity-40 flex overflow-hidden pointer-events-none">
                            {Array.from({ length: 6 }).map((_, idx) => (
                              <LazyImage
                                key={idx}
                                src={clip.thumbnail}
                                alt="frame"
                                className="h-full w-12 object-cover shrink-0 border-r border-black/30"
                              />
                            ))}
                          </div>
                        )}

                        {/* Audio clip waveform */}
                        {clip.type === 'audio' && (
                          <div className="absolute inset-0 flex items-center justify-between px-2 opacity-50 pointer-events-none">
                            {Array.from({ length: Math.min(80, Math.floor(widthVal / 4)) }).map((_, idx) => {
                              const real = Array.isArray(clip.waveform) && clip.waveform.length > 0
                                ? clip.waveform[Math.floor((idx / Math.min(80, Math.floor(widthVal / 4))) * clip.waveform.length)]
                                : null;
                              const h = real != null ? real : 35;
                              return (
                                <div
                                  key={idx}
                                  className="w-[2px] rounded-full mx-[1px]"
                                  style={{
                                    height: `${Math.min(90, Math.max(15, h))}%`,
                                    backgroundColor: waveformColor
                                  }}
                                />
                              );
                            })}
                          </div>
                        )}

                        {/* Clip Label & FX Badge */}
                        <div className="relative z-10 px-3 flex items-center justify-between w-full truncate">
                          <span className="text-[11px] font-semibold tracking-wide truncate drop-shadow flex items-center gap-1">
                            {isLocked && <Lock className="w-2.5 h-2.5 text-amber-300 shrink-0" />}
                            <span className="truncate">{clip.title || clip.text || clip.emoji || 'Clip'}</span>
                          </span>
                          {clip.fxBadge && (
                            <span className="text-[9px] font-mono font-bold px-1 py-0.5 rounded bg-black/50 border border-white/20 text-purple-300 ml-1">
                              {clip.fxBadge}
                            </span>
                          )}
                        </div>

                        {/* Right Trim Handle */}
                        <div
                          data-handle="right"
                          onPointerDown={(e) => {
                            if (isLocked) return;
                            e.stopPropagation();
                            e.preventDefault();
                            setTrimmingHandle({
                              id: clip.id,
                              side: 'right',
                              initialX: e.clientX,
                              initialStartTime: clip.startTime || 0,
                              initialDuration: clip.duration || 1,
                              initialTrimStart: clip.trimStart || 0,
                            });
                          }}
                          className={`absolute right-0 top-0 bottom-0 w-2.5 hover:w-3 bg-white/20 hover:bg-purple-400/80 transition-all z-20 touch-none ${
                            isLocked ? 'cursor-not-allowed' : 'cursor-ew-resize'
                          }`}
                        />
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>

          {/* Vertical Playhead Needle Indicator */}
          <div
            className="absolute top-0 bottom-0 pointer-events-none z-30 flex flex-col items-center -translate-x-1/2"
            style={{ left: `${currentTime * pxPerSec}px` }}
          >
            {/* Top Playhead Tag / Time indicator */}
            <div className="px-2 py-0.5 rounded-full bg-gradient-to-r from-purple-600 to-indigo-600 border border-purple-300 text-white text-[10px] font-mono font-bold shadow-lg shadow-purple-600/50">
              {formatMinutesSeconds(currentTime)}
            </div>
            {/* Vertical Glowing Purple Laser Line */}
            <div className="w-[2px] flex-1 bg-purple-400 shadow-[0_0_12px_rgba(168,85,247,0.9)]" />
          </div>
        </div>
      </div>
    </div>
  );
}

MultiTrackTimeline.propTypes = {
  tracks: PropTypes.array,
  clips: PropTypes.object,
  currentTime: PropTypes.number,
  duration: PropTypes.number,
  onSeek: PropTypes.func,
  selectedClipId: PropTypes.string,
  onSelectClip: PropTypes.func,
  onUpdateClip: PropTypes.func,
  onAddTrack: PropTypes.func,
  onToggleTrackVisibility: PropTypes.func,
  onToggleTrackLock: PropTypes.func,
  zoomLevel: PropTypes.number,
  isMagnetOn: PropTypes.bool,
};
