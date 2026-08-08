// src/screens/VideoEditor/components/MultiTrackTimeline.jsx
import React, { useRef, useState, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';
import { motion } from 'framer-motion';
import {
  Eye, EyeOff, Lock, Unlock, Plus, Video, Type, Image as ImageIcon,
  Music, Mic, Volume2, Sparkles, Scissors, Trash2
} from 'lucide-react';
import { formatMinutesSeconds } from '../constants';

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
  const rulerRef = useRef(null);
  const containerRef = useRef(null);
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [draggingClip, setDraggingClip] = useState(null); // { id, initialX, initialStartTime, trackId }
  const [trimmingHandle, setTrimmingHandle] = useState(null); // { id, side: 'left'|'right', initialX, initialVal }

  // Pixels per second calculation based on zoomLevel
  const pxPerSec = 22 * zoomLevel;
  const timelineWidth = Math.max(800, duration * pxPerSec);

  // Generate ruler markers every 5 seconds
  const markersCount = Math.ceil(duration / 5) + 4;
  const markers = Array.from({ length: markersCount }, (_, i) => i * 5);

  // Scrubbing on Ruler / Timeline click or drag
  const handleRulerMouseDown = (e) => {
    if (!rulerRef.current) return;
    setIsScrubbing(true);
    updateTimeFromPointer(e);
  };

  const updateTimeFromPointer = useCallback((e) => {
    if (!rulerRef.current) return;
    const rect = rulerRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const newTime = Math.max(0, Math.min(duration, clickX / pxPerSec));
    onSeek?.(newTime);
  }, [duration, pxPerSec, onSeek]);

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (isScrubbing) {
        updateTimeFromPointer(e);
      } else if (draggingClip) {
        const deltaX = e.clientX - draggingClip.initialX;
        let deltaSec = deltaX / pxPerSec;
        if (isMagnetOn) {
          deltaSec = Math.round(deltaSec * 2) / 2; // snap to 0.5s
        }
        const newStartTime = Math.max(0, draggingClip.initialStartTime + deltaSec);
        onUpdateClip?.(draggingClip.trackId, draggingClip.id, { startTime: newStartTime });
      } else if (trimmingHandle) {
        const deltaX = e.clientX - trimmingHandle.initialX;
        let deltaSec = deltaX / pxPerSec;
        if (isMagnetOn) deltaSec = Math.round(deltaSec * 2) / 2;

        const clip = clips[trimmingHandle.id];
        if (!clip) return;

        if (trimmingHandle.side === 'left') {
          const newStart = Math.max(0, trimmingHandle.initialStartTime + deltaSec);
          const newDuration = Math.max(0.5, trimmingHandle.initialDuration - deltaSec);
          if (newDuration >= 0.5) {
            onUpdateClip?.(clip.trackId, clip.id, {
              startTime: newStart,
              duration: newDuration,
              trimStart: (clip.trimStart || 0) + deltaSec
            });
          }
        } else {
          const newDuration = Math.max(0.5, trimmingHandle.initialDuration + deltaSec);
          onUpdateClip?.(clip.trackId, clip.id, {
            duration: newDuration,
            trimEnd: (clip.trimStart || 0) + newDuration
          });
        }
      }
    };

    const handleMouseUp = () => {
      if (isScrubbing) setIsScrubbing(false);
      if (draggingClip) setDraggingClip(null);
      if (trimmingHandle) setTrimmingHandle(null);
    };

    if (isScrubbing || draggingClip || trimmingHandle) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
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
      case 'audio':
        return iconName === 'Mic' ? <Mic className="w-3.5 h-3.5 text-blue-400" /> : <Music className="w-3.5 h-3.5 text-emerald-400" />;
      default:
        return <Video className="w-3.5 h-3.5 text-gray-400" />;
    }
  };

  return (
    <div className="relative flex w-full bg-gray-950/80 dark:bg-gray-950/90 light:bg-slate-900/5 rounded-2xl border border-white/10 dark:border-white/10 light:border-gray-200 overflow-hidden shadow-2xl backdrop-blur-md select-none">
      {/* Left Track Headers Column */}
      <div className="w-28 sm:w-36 shrink-0 bg-gray-950/90 dark:bg-gray-950/95 light:bg-gray-100/90 border-r border-white/10 dark:border-white/10 light:border-gray-200 z-20 flex flex-col">
        {/* Header Spacer matching Ruler height */}
        <div className="h-8 border-b border-white/10 dark:border-white/10 light:border-gray-200 flex items-center px-3 text-[10px] uppercase font-bold tracking-wider text-gray-400">
          Tracks
        </div>

        {/* Track Label Rows */}
        <div className="flex-1 flex flex-col space-y-2 py-2">
          {tracks.map((track) => (
            <div
              key={track.id}
              className="h-10 px-2.5 flex items-center justify-between text-xs text-gray-300 dark:text-gray-300 light:text-gray-700 bg-white/5 dark:bg-white/5 light:bg-white rounded-lg mx-1.5 border border-white/5 dark:border-white/5 light:border-gray-200"
            >
              <div className="flex items-center gap-1.5 min-w-0">
                {getTrackIcon(track.icon, track.type)}
                <span className="font-semibold truncate text-[11px] sm:text-xs">
                  {track.name}
                </span>
              </div>

              <div className="flex items-center gap-1">
                <button
                  onClick={() => onToggleTrackVisibility?.(track.id)}
                  className="text-gray-400 hover:text-white p-0.5"
                  title={track.visible ? 'Mute/Hide track' : 'Show track'}
                >
                  {track.visible !== false ? (
                    <Eye className="w-3 h-3 text-gray-400" />
                  ) : (
                    <EyeOff className="w-3 h-3 text-rose-400" />
                  )}
                </button>
                <button
                  onClick={() => onToggleTrackLock?.(track.id)}
                  className="text-gray-400 hover:text-white p-0.5"
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
            onMouseDown={handleRulerMouseDown}
            className="h-8 border-b border-white/10 dark:border-white/10 light:border-gray-200 relative bg-black/40 cursor-pointer flex items-end"
          >
            {markers.map((sec) => (
              <div
                key={sec}
                className="absolute bottom-0 flex flex-col items-center select-none pointer-events-none"
                style={{ left: `${sec * pxPerSec}px` }}
              >
                <span className="text-[9px] font-mono font-medium text-gray-400 mb-1 -translate-x-1/2">
                  {formatMinutesSeconds(sec)}
                </span>
                <div className="w-[1px] h-2 bg-white/20" />
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
                  className="h-10 relative bg-white/[0.02] border-b border-white/5 flex items-center"
                >
                  {trackClips.map((clip) => {
                    const isSelected = selectedClipId === clip.id;
                    const leftPos = (clip.startTime || 0) * pxPerSec;
                    const widthVal = Math.max(30, (clip.duration || 1) * pxPerSec);

                    // Styling by Clip Type
                    let clipBgClass = 'bg-indigo-900/60 border-indigo-500/60 text-white';
                    let waveformColor = '#818cf8';

                    if (clip.type === 'overlay') {
                      clipBgClass = 'bg-gradient-to-r from-purple-800/80 to-indigo-800/80 border-purple-400/80 text-white';
                    } else if (clip.type === 'text') {
                      clipBgClass = 'bg-gradient-to-r from-emerald-900/80 to-teal-900/80 border-emerald-400/80 text-emerald-200';
                    } else if (clip.type === 'audio') {
                      if (clip.color === '#3b82f6') {
                        clipBgClass = 'bg-blue-950/80 border-blue-500/80 text-blue-200';
                        waveformColor = '#60a5fa';
                      } else {
                        clipBgClass = 'bg-emerald-950/80 border-emerald-500/80 text-emerald-200';
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
                        onMouseDown={(e) => {
                          if (e.target.dataset.handle) return;
                          setDraggingClip({
                            id: clip.id,
                            initialX: e.clientX,
                            initialStartTime: clip.startTime || 0,
                            trackId: clip.trackId
                          });
                        }}
                        className={`absolute top-1 bottom-1 rounded-xl border shadow-md flex items-center overflow-hidden cursor-grab active:cursor-grabbing transition-shadow group ${clipBgClass} ${
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
                          onMouseDown={(e) => {
                            e.stopPropagation();
                            setTrimmingHandle({
                              id: clip.id,
                              side: 'left',
                              initialX: e.clientX,
                              initialStartTime: clip.startTime || 0,
                              initialDuration: clip.duration || 1
                            });
                          }}
                          className="absolute left-0 top-0 bottom-0 w-2 hover:w-3 bg-white/20 hover:bg-purple-400/80 cursor-ew-resize transition-all z-20"
                        />

                        {/* Thumbnail Strip for Video Clips */}
                        {clip.type === 'video' && clip.thumbnail && (
                          <div className="absolute inset-0 opacity-40 flex overflow-hidden pointer-events-none">
                            {Array.from({ length: 6 }).map((_, idx) => (
                              <img
                                key={idx}
                                src={clip.thumbnail}
                                alt="frame"
                                className="h-full w-12 object-cover shrink-0 border-r border-black/30"
                              />
                            ))}
                          </div>
                        )}

                        {/* Simulated Realistic Waveform for Audio */}
                        {clip.type === 'audio' && (
                          <div className="absolute inset-0 flex items-center justify-between px-2 opacity-50 pointer-events-none">
                            {Array.from({ length: Math.min(80, Math.floor(widthVal / 4)) }).map((_, idx) => {
                              const h = 20 + Math.sin(idx * 0.4) * 35 + (idx % 3) * 15;
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
                          <span className="text-[11px] font-semibold tracking-wide truncate drop-shadow">
                            {clip.title || clip.text || 'Clip'}
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
                          onMouseDown={(e) => {
                            e.stopPropagation();
                            setTrimmingHandle({
                              id: clip.id,
                              side: 'right',
                              initialX: e.clientX,
                              initialDuration: clip.duration || 1
                            });
                          }}
                          className="absolute right-0 top-0 bottom-0 w-2 hover:w-3 bg-white/20 hover:bg-purple-400/80 cursor-ew-resize transition-all z-20"
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
