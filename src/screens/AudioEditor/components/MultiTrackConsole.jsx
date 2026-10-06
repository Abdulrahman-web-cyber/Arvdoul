// src/screens/AudioEditor/components/MultiTrackConsole.jsx
//
// Timeline and mixer. The project starts with no tracks: a track appears when
// the user adds one or when a real source is loaded. Clips are drawn from their
// own sample peaks, and a clip with no decoded audio says so instead of drawing
// an invented waveform.

import React, { useState, useRef, useEffect } from 'react';
import {
  Mic, Lock, Unlock, Plus, Music, Radio,
  ZoomIn, ZoomOut, Maximize2, Sparkles,
  Guitar, Disc, Headphones
} from 'lucide-react';
import { cn } from '../../../lib/utils';

const TRACK_COLORS = ['#00C4FF', '#10B981', '#F59E0B', '#EF4444', '#EC4899', '#6366F1'];

export const TRACK_ICON_OPTIONS = [Music, Mic, Guitar, Disc, Headphones, Radio, Sparkles];

/** Down-samples decoded channel data into per-pixel min/max peaks for drawing. */
export function computePeaks(buffer, buckets = 48) {
  if (!buffer || typeof buffer.getChannelData !== 'function') return null;
  const data = buffer.getChannelData(0);
  if (!data.length) return null;
  const size = Math.max(1, Math.floor(data.length / buckets));
  const peaks = [];
  for (let b = 0; b < buckets; b += 1) {
    let min = 1;
    let max = -1;
    const start = b * size;
    const end = Math.min(start + size, data.length);
    for (let i = start; i < end; i += 1) {
      const v = data[i];
      if (v < min) min = v;
      if (v > max) max = v;
    }
    peaks.push({ min, max });
  }
  return peaks;
}

export default function MultiTrackConsole({
  tracks = [],
  setTracks,
  currentTime,
  setCurrentTime,
  totalDuration = 0,
  isPlaying,
  isDark = true,
  onSelectClip,
  selectedClipId,
}) {
  const [zoom, setZoom] = useState(1.0);
  const [snapMode, setSnapMode] = useState('Bar');
  const timelineRef = useRef(null);
  const isDraggingPlayheadRef = useRef(false);

  const duration = totalDuration > 0 ? totalDuration : 60;
  const rulerTicks = [];
  for (let t = 0; t <= duration; t += Math.max(5, duration / 8)) rulerTicks.push(Math.round(t));

  const formatSeconds = (sec) => {
    const safe = Number.isFinite(sec) ? Math.max(0, sec) : 0;
    const m = Math.floor(safe / 60);
    const s = Math.floor(safe % 60);
    const ms = Math.floor((safe % 1) * 1000);
    return `${m}:${s < 10 ? '0' : ''}${s}.${ms < 100 ? (ms < 10 ? '00' : '0') : ''}${ms}`;
  };

  const handleSeek = (clientX) => {
    const el = timelineRef.current;
    if (!el || totalDuration <= 0) return;
    const rect = el.getBoundingClientRect();
    const x = Math.max(0, Math.min(rect.width, clientX - rect.left));
    setCurrentTime((x / rect.width) * totalDuration);
  };

  const handleTimelineMouseDown = (e) => {
    isDraggingPlayheadRef.current = true;
    handleSeek(e.clientX);
  };

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isDraggingPlayheadRef.current) return;
      handleSeek(e.clientX);
    };
    const handleMouseUp = () => { isDraggingPlayheadRef.current = false; };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totalDuration]);

  const toggleField = (trackId, field) => {
    setTracks((prev) => prev.map((t) => (t.id === trackId ? { ...t, [field]: !t[field] } : t)));
  };

  const updateTrackVolume = (trackId, vol) => {
    setTracks((prev) => prev.map((t) => (t.id === trackId ? { ...t, volume: Number(vol) } : t)));
  };

  const updateTrackPan = (trackId, pan) => {
    setTracks((prev) => prev.map((t) => (t.id === trackId ? { ...t, pan: Number(pan) } : t)));
  };

  const addTrack = () => {
    setTracks((prev) => [
      ...prev,
      {
        id: `track_${Date.now()}`,
        name: `Track ${prev.length + 1}`,
        color: TRACK_COLORS[prev.length % TRACK_COLORS.length],
        volume: 0,
        pan: 0,
        muted: false,
        solo: false,
        locked: false,
        clips: [],
      },
    ]);
  };

  const removeTrack = (trackId) => {
    setTracks((prev) => prev.filter((t) => t.id !== trackId));
  };

  return (
    <div className={cn(
      "rounded-2xl border overflow-hidden transition-colors",
      isDark ? "bg-[#03071B]/95 border-white/10" : "bg-white border-gray-200 shadow-sm"
    )}>
      <div className={cn(
        "flex items-center justify-between px-4 py-2.5 border-b text-xs",
        isDark ? "bg-white/5 border-white/10" : "bg-gray-50 border-gray-200"
      )}>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 font-medium">
            <span className="text-gray-400">Snap:</span>
            <select
              value={snapMode}
              onChange={(e) => setSnapMode(e.target.value)}
              className={cn(
                "rounded px-2 py-1 border text-xs font-semibold outline-none",
                isDark ? "bg-[#0B1130] border-white/10 text-white" : "bg-white border-gray-300 text-gray-900"
              )}
            >
              <option value="Bar">Bar</option>
              <option value="Beat">Beat</option>
              <option value="1/16">1/16</option>
              <option value="1/32">1/32</option>
              <option value="Off">Snap Off</option>
            </select>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setZoom((z) => Math.max(0.5, z - 0.2))}
            className="p-1.5 rounded hover:bg-purple-500/20 text-gray-400 hover:text-white cursor-pointer"
            title="Zoom Out"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <span className="font-mono text-xs text-purple-400 font-bold">{Math.round(zoom * 100)}%</span>
          <button
            onClick={() => setZoom((z) => Math.min(2.5, z + 0.2))}
            className="p-1.5 rounded hover:bg-purple-500/20 text-gray-400 hover:text-white cursor-pointer"
            title="Zoom In"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            onClick={() => setZoom(1.0)}
            className="p-1.5 rounded hover:bg-purple-500/20 text-gray-400 hover:text-white cursor-pointer"
            title="Fit to Window"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="flex w-full overflow-hidden">
        <div className={cn(
          "w-56 sm:w-64 flex-shrink-0 border-r border-inherit",
          isDark ? "bg-[#060B24]" : "bg-gray-50/70"
        )}>
          <div className="flex items-center justify-between px-3 py-2 border-b border-inherit h-8">
            <span className="text-xs font-bold uppercase tracking-wider text-gray-400">Tracks</span>
            <button
              onClick={addTrack}
              className="w-5 h-5 rounded-full flex items-center justify-center bg-purple-600 hover:bg-purple-500 text-white cursor-pointer"
              title="Add New Track"
            >
              <Plus className="w-3 h-3" />
            </button>
          </div>

          {tracks.length === 0 && (
            <div className="p-4 text-xs text-gray-500">
              No tracks yet. Add a track, or open a recording from Create Post.
            </div>
          )}

          <div className="divide-y divide-inherit">
            {tracks.map((t) => {
              const Icon = t.icon || Music;
              return (
                <div key={t.id} className="p-2.5 min-h-20 flex flex-col justify-between select-none">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: t.color }} />
                      <Icon className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                      <span className="text-xs font-bold truncate text-gray-200 dark:text-white">{t.name}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => toggleField(t.id, 'muted')}
                        className={cn(
                          "w-4 h-4 rounded text-[9px] font-bold flex items-center justify-center cursor-pointer transition",
                          t.muted ? "bg-rose-500 text-white" : "bg-gray-700/40 text-gray-400 hover:text-white"
                        )}
                        title="Mute Track"
                      >
                        M
                      </button>
                      <button
                        onClick={() => toggleField(t.id, 'solo')}
                        className={cn(
                          "w-4 h-4 rounded text-[9px] font-bold flex items-center justify-center cursor-pointer transition",
                          t.solo ? "bg-amber-500 text-white" : "bg-gray-700/40 text-gray-400 hover:text-white"
                        )}
                        title="Solo Track"
                      >
                        S
                      </button>
                      <button
                        onClick={() => toggleField(t.id, 'locked')}
                        className="text-gray-400 hover:text-white cursor-pointer"
                        title="Lock Track"
                      >
                        {t.locked ? <Lock className="w-3 h-3 text-amber-400" /> : <Unlock className="w-3 h-3 opacity-40" />}
                      </button>
                      <button
                        onClick={() => removeTrack(t.id)}
                        className="text-gray-500 hover:text-rose-400 cursor-pointer text-xs font-bold"
                        title="Remove Track"
                      >
                        ×
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 mt-1">
                    <input
                      type="range"
                      min="-24"
                      max="6"
                      step="0.5"
                      value={t.volume}
                      onChange={(e) => updateTrackVolume(t.id, e.target.value)}
                      className="w-full h-1 accent-purple-500 bg-gray-700 rounded-lg cursor-pointer"
                      aria-label={`${t.name} volume`}
                    />
                    <span className="text-[10px] font-mono text-gray-400 w-12 text-right">
                      {t.volume > 0 ? `+${t.volume}` : t.volume} dB
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-[9px] text-gray-500 w-6">Pan</span>
                    <input
                      type="range"
                      min="-50"
                      max="50"
                      step="1"
                      value={t.pan}
                      onChange={(e) => updateTrackPan(t.id, e.target.value)}
                      className="w-full h-1 accent-indigo-500 bg-gray-700 rounded-lg cursor-pointer"
                      aria-label={`${t.name} pan`}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex-1 overflow-x-auto relative" ref={timelineRef} onMouseDown={handleTimelineMouseDown}>
          <div className={cn(
            "h-8 border-b border-inherit flex items-end relative select-none cursor-pointer",
            isDark ? "bg-[#060B24]" : "bg-gray-100/70"
          )}>
            {rulerTicks.map((tick) => (
              <div
                key={tick}
                className="absolute bottom-0 border-l border-white/20 pl-1 pb-1"
                style={{ left: `${(tick / duration) * 100}%` }}
              >
                <span className="text-[10px] font-mono text-gray-400">{formatSeconds(tick)}</span>
              </div>
            ))}

            {totalDuration > 0 && (
              <div
                className="absolute top-0 bottom-0 z-30 pointer-events-none"
                style={{ left: `${(currentTime / duration) * 100}%` }}
              >
                <div className="px-1.5 py-0.5 rounded-full bg-gradient-to-r from-[#8B1EF3] to-[#055BFB] text-white text-[9px] font-mono font-bold -translate-x-1/2 shadow-lg">
                  {formatSeconds(currentTime)}
                </div>
              </div>
            )}
          </div>

          <div className="divide-y divide-inherit relative min-w-[600px]">
            {totalDuration > 0 && (
              <div
                className="absolute top-0 bottom-0 w-0.5 bg-gradient-to-b from-[#C82BFF] to-[#055BFB] z-20 pointer-events-none shadow-[0_0_8px_#C82BFF]"
                style={{ left: `${(currentTime / duration) * 100}%` }}
              />
            )}

            {tracks.length === 0 && (
              <div className="h-32 flex items-center justify-center text-xs text-gray-500">
                Timeline is empty — there is no audio in this session yet.
              </div>
            )}

            {tracks.map((t) => (
              <div
                key={t.id}
                className={cn(
                  "h-20 relative flex items-center overflow-hidden transition-colors",
                  isDark ? "bg-[#020514]/60 hover:bg-[#060B24]/40" : "bg-gray-50/30 hover:bg-gray-100/40"
                )}
              >
                <div className="absolute inset-0 grid grid-cols-8 pointer-events-none opacity-10">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <div key={i} className="border-r border-white" />
                  ))}
                </div>

                {t.clips.length === 0 && (
                  <span className="pl-3 text-[10px] text-gray-600">Empty track</span>
                )}

                {t.clips.map((clip) => {
                  const left = `${(clip.start / duration) * 100}%`;
                  const width = `${(clip.duration / duration) * 100}%`;
                  const isSelected = selectedClipId === clip.id;
                  const peaks = clip.peaks;

                  return (
                    <div
                      key={clip.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectClip?.(clip);
                      }}
                      className={cn(
                        "absolute h-16 rounded-xl border p-1.5 flex flex-col justify-between shadow-md cursor-pointer transition-all overflow-hidden group",
                        isSelected ? "ring-2 ring-white scale-[1.01]" : "hover:brightness-110"
                      )}
                      style={{ left, width, backgroundColor: `${t.color}26`, borderColor: t.color }}
                    >
                      <div className="flex items-center justify-between text-[10px] font-bold text-white z-10">
                        <span className="truncate drop-shadow">{clip.name}</span>
                        <span className="text-[9px] font-mono opacity-75">{clip.duration.toFixed(1)}s</span>
                      </div>

                      {peaks ? (
                        <div className="w-full h-8 flex items-center gap-px opacity-80">
                          {peaks.map((p, idx) => {
                            const height = Math.max(2, Math.abs(p.max - p.min) * 28);
                            return (
                              <div
                                key={idx}
                                className="flex-1 rounded-full"
                                style={{ height: `${height}px`, backgroundColor: t.color }}
                              />
                            );
                          })}
                        </div>
                      ) : (
                        <span className="text-[9px] text-gray-300/70 z-10">
                          Waveform unavailable
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
