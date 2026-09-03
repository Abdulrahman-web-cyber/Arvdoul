// src/screens/AudioEditor/components/MultiTrackConsole.jsx
import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Mic, Volume2, VolumeX, Lock, Unlock, Plus, Music, Radio,
  Sliders, ZoomIn, ZoomOut, Maximize2, MoreHorizontal, Sparkles,
  Guitar, Disc, Headphones, Eye
} from 'lucide-react';
import { cn } from '../../../lib/utils';

export const INITIAL_STUDIO_TRACKS = [
  {
    id: 'vocals',
    name: 'Vocals',
    icon: Mic,
    color: '#8B1EF3',
    volume: -3.2,
    pan: 0,
    muted: false,
    solo: false,
    locked: false,
    clips: [
      { id: 'c1', start: 15, duration: 45, name: 'Lead Verse 1', fadeStart: 2, fadeEnd: 3 },
      { id: 'c2', start: 70, duration: 35, name: 'Lead Chorus', fadeStart: 1, fadeEnd: 2 },
    ],
  },
  {
    id: 'backing_vocals',
    name: 'Backing Vocals',
    icon: Headphones,
    color: '#00C4FF',
    volume: -6.1,
    pan: -15,
    muted: false,
    solo: false,
    locked: false,
    clips: [
      { id: 'c3', start: 25, duration: 35, name: 'Harmony High', fadeStart: 2, fadeEnd: 2 },
      { id: 'c4', start: 70, duration: 35, name: 'Chorus Octaves', fadeStart: 2, fadeEnd: 3 },
    ],
  },
  {
    id: 'guitar',
    name: 'Guitar',
    icon: Music,
    color: '#10B981',
    volume: -8.3,
    pan: 20,
    muted: false,
    solo: false,
    locked: false,
    clips: [
      { id: 'c5', start: 0, duration: 60, name: 'Acoustic Riff', fadeStart: 0, fadeEnd: 2 },
      { id: 'c6', start: 65, duration: 55, name: 'Electric Strum', fadeStart: 1, fadeEnd: 2 },
    ],
  },
  {
    id: 'bass',
    name: 'Bass',
    icon: Radio,
    color: '#F59E0B',
    volume: -5.4,
    pan: 0,
    muted: false,
    solo: false,
    locked: false,
    clips: [
      { id: 'c7', start: 10, duration: 110, name: 'Sub & Slap Bass', fadeStart: 1, fadeEnd: 1 },
    ],
  },
  {
    id: 'drums',
    name: 'Drums',
    icon: Disc,
    color: '#EF4444',
    volume: -4.7,
    pan: 0,
    muted: false,
    solo: false,
    locked: false,
    clips: [
      { id: 'c8', start: 0, duration: 120, name: 'Drum Kit & 808', fadeStart: 0, fadeEnd: 0 },
    ],
  },
  {
    id: 'piano',
    name: 'Piano',
    icon: Music,
    color: '#EC4899',
    volume: -7.0,
    pan: -10,
    muted: false,
    solo: false,
    locked: false,
    clips: [
      { id: 'c9', start: 15, duration: 75, name: 'Grand Chords', fadeStart: 1, fadeEnd: 2 },
    ],
  },
  {
    id: 'fx',
    name: 'FX / Ambience',
    icon: Sparkles,
    color: '#6366F1',
    volume: -12.0,
    pan: 0,
    muted: false,
    solo: false,
    locked: false,
    clips: [
      { id: 'c10', start: 0, duration: 30, name: 'Vinyl Dust & Rain', fadeStart: 3, fadeEnd: 3 },
      { id: 'c11', start: 60, duration: 40, name: 'Sweep & Uplifter', fadeStart: 2, fadeEnd: 2 },
    ],
  },
];

export default function MultiTrackConsole({
  tracks,
  setTracks,
  currentTime,
  setCurrentTime,
  totalDuration = 120,
  isPlaying,
  isDark = true,
  onSelectClip,
  selectedClipId,
}) {
  const [zoom, setZoom] = useState(1.0);
  const [snapMode, setSnapMode] = useState('Bar');
  const [timelineMode, setTimelineMode] = useState('Waveform');
  const timelineRef = useRef(null);
  const isDraggingPlayheadRef = useRef(false);

  // Time ruler ticks (0 to 120s)
  const rulerTicks = [0, 15, 30, 45, 60, 75, 90, 105, 120];

  const formatSeconds = (sec) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    const ms = Math.floor((sec % 1) * 1000);
    return `${m}:${s < 10 ? '0' : ''}${s}.${ms < 100 ? (ms < 10 ? '00' : '0') : ''}${ms}`;
  };

  const handleSeek = (clientX) => {
    const el = timelineRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = Math.max(0, Math.min(rect.width, clientX - rect.left));
    const percent = x / rect.width;
    const newTime = percent * totalDuration;
    setCurrentTime(newTime);
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
    const handleMouseUp = () => {
      isDraggingPlayheadRef.current = false;
    };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [totalDuration]);

  // Track manipulation
  const toggleMute = (trackId) => {
    setTracks((prev) =>
      prev.map((t) => (t.id === trackId ? { ...t, muted: !t.muted } : t))
    );
  };

  const toggleSolo = (trackId) => {
    setTracks((prev) =>
      prev.map((t) => (t.id === trackId ? { ...t, solo: !t.solo } : t))
    );
  };

  const toggleLock = (trackId) => {
    setTracks((prev) =>
      prev.map((t) => (t.id === trackId ? { ...t, locked: !t.locked } : t))
    );
  };

  const updateTrackVolume = (trackId, vol) => {
    setTracks((prev) =>
      prev.map((t) => (t.id === trackId ? { ...t, volume: Number(vol) } : t))
    );
  };

  return (
    <div className={cn(
      "rounded-2xl border overflow-hidden transition-colors",
      isDark ? "bg-[#03071B]/95 border-white/10" : "bg-white border-gray-200 shadow-sm"
    )}>
      {/* Top Timeline Toolbar matching Image 1 */}
      <div className={cn(
        "flex items-center justify-between px-4 py-2.5 border-b text-xs",
        isDark ? "bg-white/5 border-white/10" : "bg-gray-50 border-gray-200"
      )}>
        <div className="flex items-center gap-3">
          {/* Snap Mode */}
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

          {/* Timeline Display Modes */}
          <div className="hidden sm:flex items-center gap-1 border-l pl-3 border-inherit">
            {['Waveform', 'Automation', 'MIDI', 'Regions'].map((m) => (
              <button
                key={m}
                onClick={() => setTimelineMode(m)}
                className={cn(
                  "px-2.5 py-1 rounded text-xs font-bold transition cursor-pointer",
                  timelineMode === m
                    ? "bg-purple-600 text-white shadow-sm"
                    : isDark ? "text-gray-400 hover:text-white" : "text-gray-600 hover:text-gray-900"
                )}
              >
                {m}
              </button>
            ))}
          </div>
        </div>

        {/* Zoom & Fit controls */}
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

      {/* Main Console: Left Track Controls, Right Timeline */}
      <div className="flex w-full overflow-hidden">
        {/* Left Track Strip (Fixed Width ~ 220px) */}
        <div className={cn(
          "w-56 sm:w-64 flex-shrink-0 border-r border-inherit",
          isDark ? "bg-[#060B24]" : "bg-gray-50/70"
        )}>
          {/* Header */}
          <div className="flex items-center justify-between px-3 py-2 border-b border-inherit h-8">
            <span className="text-xs font-bold uppercase tracking-wider text-gray-400">Tracks</span>
            <button
              onClick={() => {
                const newId = `track_${Date.now()}`;
                setTracks((prev) => [
                  ...prev,
                  {
                    id: newId,
                    name: `Track ${prev.length + 1}`,
                    icon: Music,
                    color: '#00C4FF',
                    volume: -6.0,
                    pan: 0,
                    muted: false,
                    solo: false,
                    locked: false,
                    clips: [],
                  },
                ]);
              }}
              className="w-5 h-5 rounded-full flex items-center justify-center bg-purple-600 hover:bg-purple-500 text-white cursor-pointer"
              title="Add New Track"
            >
              <Plus className="w-3 h-3" />
            </button>
          </div>

          {/* Track Headers */}
          <div className="divide-y divide-inherit">
            {tracks.map((t) => {
              const Icon = t.icon || Music;
              return (
                <div key={t.id} className="p-2.5 h-16 flex flex-col justify-between select-none">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: t.color }} />
                      <Icon className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                      <span className="text-xs font-bold truncate text-gray-200 dark:text-white">
                        {t.name}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      {/* Mute [M] */}
                      <button
                        onClick={() => toggleMute(t.id)}
                        className={cn(
                          "w-4 h-4 rounded text-[9px] font-bold flex items-center justify-center cursor-pointer transition",
                          t.muted ? "bg-rose-500 text-white" : "bg-gray-700/40 text-gray-400 hover:text-white"
                        )}
                        title="Mute Track"
                      >
                        M
                      </button>
                      {/* Solo [S] */}
                      <button
                        onClick={() => toggleSolo(t.id)}
                        className={cn(
                          "w-4 h-4 rounded text-[9px] font-bold flex items-center justify-center cursor-pointer transition",
                          t.solo ? "bg-amber-500 text-white" : "bg-gray-700/40 text-gray-400 hover:text-white"
                        )}
                        title="Solo Track"
                      >
                        S
                      </button>
                      {/* Lock */}
                      <button
                        onClick={() => toggleLock(t.id)}
                        className="text-gray-400 hover:text-white cursor-pointer"
                        title="Lock Track"
                      >
                        {t.locked ? <Lock className="w-3 h-3 text-amber-400" /> : <Unlock className="w-3 h-3 opacity-40" />}
                      </button>
                    </div>
                  </div>

                  {/* Volume Slider & dB text */}
                  <div className="flex items-center gap-2 mt-1">
                    <input
                      type="range"
                      min="-24"
                      max="6"
                      step="0.5"
                      value={t.volume}
                      onChange={(e) => updateTrackVolume(t.id, e.target.value)}
                      className="w-full h-1 accent-purple-500 bg-gray-700 rounded-lg cursor-pointer"
                    />
                    <span className="text-[10px] font-mono text-gray-400 w-12 text-right">
                      {t.volume > 0 ? `+${t.volume}` : t.volume} dB
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Timeline Grid with Ruler & Waves */}
        <div className="flex-1 overflow-x-auto relative" ref={timelineRef} onMouseDown={handleTimelineMouseDown}>
          {/* Top Time Ruler (h-8 matching track header) */}
          <div className={cn(
            "h-8 border-b border-inherit flex items-end relative select-none cursor-pointer",
            isDark ? "bg-[#060B24]" : "bg-gray-100/70"
          )}>
            {rulerTicks.map((tick) => {
              const leftPercent = (tick / totalDuration) * 100;
              return (
                <div
                  key={tick}
                  className="absolute bottom-0 border-l border-white/20 pl-1 pb-1"
                  style={{ left: `${leftPercent}%` }}
                >
                  <span className="text-[10px] font-mono text-gray-400">
                    {formatSeconds(tick)}
                  </span>
                </div>
              );
            })}

            {/* Draggable Playhead marker on ruler */}
            <div
              className="absolute top-0 bottom-0 z-30 pointer-events-none"
              style={{ left: `${(currentTime / totalDuration) * 100}%` }}
            >
              <div className="px-1.5 py-0.5 rounded-full bg-gradient-to-r from-[#8B1EF3] to-[#055BFB] text-white text-[9px] font-mono font-bold -translate-x-1/2 shadow-lg">
                {formatSeconds(currentTime)}
              </div>
            </div>
          </div>

          {/* Timeline Track Rows */}
          <div className="divide-y divide-inherit relative min-w-[600px]">
            {/* Playhead vertical line passing through all tracks */}
            <div
              className="absolute top-0 bottom-0 w-0.5 bg-gradient-to-b from-[#C82BFF] to-[#055BFB] z-20 pointer-events-none shadow-[0_0_8px_#C82BFF]"
              style={{ left: `${(currentTime / totalDuration) * 100}%` }}
            />

            {tracks.map((t) => (
              <div
                key={t.id}
                className={cn(
                  "h-16 relative flex items-center overflow-hidden transition-colors",
                  isDark ? "bg-[#020514]/60 hover:bg-[#060B24]/40" : "bg-gray-50/30 hover:bg-gray-100/40"
                )}
              >
                {/* Horizontal Grid guidelines */}
                <div className="absolute inset-0 grid grid-cols-8 pointer-events-none opacity-10">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <div key={i} className="border-r border-white" />
                  ))}
                </div>

                {/* Render Audio Clips */}
                {t.clips.map((clip) => {
                  const left = `${(clip.start / totalDuration) * 100}%`;
                  const width = `${(clip.duration / totalDuration) * 100}%`;
                  const isSelected = selectedClipId === clip.id;

                  return (
                    <div
                      key={clip.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectClip?.(clip);
                      }}
                      className={cn(
                        "absolute h-12 rounded-xl border p-1.5 flex flex-col justify-between shadow-md cursor-pointer transition-all overflow-hidden group",
                        isSelected ? "ring-2 ring-white scale-[1.01]" : "hover:brightness-110"
                      )}
                      style={{
                        left,
                        width,
                        backgroundColor: `${t.color}26`,
                        borderColor: t.color,
                      }}
                    >
                      <div className="flex items-center justify-between text-[10px] font-bold text-white z-10">
                        <span className="truncate drop-shadow">{clip.name}</span>
                        <span className="text-[9px] font-mono opacity-75">{clip.duration}s</span>
                      </div>

                      {/* Stylized high-res waveform pattern inside clip */}
                      <div className="w-full h-6 flex items-center gap-0.5 opacity-80">
                        {Array.from({ length: 48 }).map((_, idx) => {
                          const pseudoPeak = Math.sin(idx * 0.3) * 0.5 + Math.cos(idx * 0.7) * 0.5;
                          const height = Math.max(3, Math.abs(pseudoPeak) * 22);
                          return (
                            <div
                              key={idx}
                              className="flex-1 rounded-full"
                              style={{
                                height: `${height}px`,
                                backgroundColor: t.color,
                              }}
                            />
                          );
                        })}
                      </div>

                      {/* Fade Handles on Clip Edges */}
                      <div className="absolute left-0 top-0 bottom-0 w-2 bg-white/20 opacity-0 group-hover:opacity-100 cursor-ew-resize" />
                      <div className="absolute right-0 top-0 bottom-0 w-2 bg-white/20 opacity-0 group-hover:opacity-100 cursor-ew-resize" />
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
