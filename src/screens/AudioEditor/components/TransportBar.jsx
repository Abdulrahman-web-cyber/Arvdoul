// src/screens/AudioEditor/components/TransportBar.jsx
import React, { useState, useEffect } from 'react';
import {
  Play, Pause, Square, SkipBack, SkipForward, Repeat,
  Clock, Activity, Volume2, Sparkles
} from 'lucide-react';
import { cn } from '../../../lib/utils';

export default function TransportBar({
  currentTime,
  totalDuration = 120,
  isPlaying,
  onPlayPause,
  onStop,
  onSeek,
  tempo = 128,
  setTempo,
  isDark = true,
}) {
  const [isLooping, setIsLooping] = useState(true);
  const [isMetronome, setIsMetronome] = useState(false);
  const [lufs, setLufs] = useState(-6.2);

  // Animate mini spectrum and LUFS during playback
  useEffect(() => {
    if (!isPlaying) return;
    const interval = setInterval(() => {
      setLufs(-6.2 + (Math.random() * 1.6 - 0.8));
    }, 120);
    return () => clearInterval(interval);
  }, [isPlaying]);

  const formatLEDTime = (sec) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    const ms = Math.floor((sec % 1) * 1000);
    return `${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}.${ms < 100 ? (ms < 10 ? '00' : '0') : ''}${ms}`;
  };

  return (
    <div className={cn(
      "rounded-2xl border p-3 flex flex-wrap items-center justify-between gap-4 transition-colors",
      isDark ? "bg-[#060B24] border-white/10" : "bg-white border-gray-200 shadow-sm"
    )}>
      {/* Left: Digital LED Time Display */}
      <div className={cn(
        "px-4 py-2 rounded-xl border flex items-center gap-2 font-mono select-none",
        isDark ? "bg-[#03071B] border-white/10" : "bg-slate-950 border-gray-300 text-white"
      )}>
        <span className="text-emerald-400 text-lg font-black tracking-widest drop-shadow-[0_0_8px_rgba(52,211,153,0.6)]">
          {formatLEDTime(currentTime)}
        </span>
        <span className="text-gray-500 text-xs">/</span>
        <span className="text-gray-400 text-xs font-semibold">
          {formatLEDTime(totalDuration)}
        </span>
      </div>

      {/* Center: Playback Transport Buttons */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Step Back */}
        <button
          onClick={() => onSeek?.(0)}
          className="p-2 rounded-xl text-gray-400 hover:text-white hover:bg-white/5 transition cursor-pointer"
          title="Return to Zero"
        >
          <SkipBack className="w-4 h-4" />
        </button>

        {/* Play / Pause Circular Gradient Button */}
        <button
          onClick={onPlayPause}
          className="w-12 h-12 rounded-full flex items-center justify-center text-white shadow-[0_0_25px_rgba(139,30,243,0.5)] hover:scale-105 active:scale-95 transition-all cursor-pointer"
          style={{ background: 'linear-gradient(135deg, #8B1EF3 0%, #4431F7 50%, #055BFB 100%)' }}
          title={isPlaying ? "Pause" : "Play"}
        >
          {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current ml-0.5" />}
        </button>

        {/* Stop Button */}
        <button
          onClick={onStop}
          className="p-2 rounded-xl text-gray-400 hover:text-white hover:bg-white/5 transition cursor-pointer"
          title="Stop"
        >
          <Square className="w-4 h-4" />
        </button>

        {/* Loop Toggle */}
        <button
          onClick={() => setIsLooping(!isLooping)}
          className={cn(
            "p-2 rounded-xl transition cursor-pointer",
            isLooping
              ? "bg-purple-500/20 text-purple-400 border border-purple-500/30"
              : "text-gray-400 hover:text-white hover:bg-white/5"
          )}
          title="Toggle Loop"
        >
          <Repeat className="w-4 h-4" />
        </button>

        {/* Metronome Toggle */}
        <button
          onClick={() => setIsMetronome(!isMetronome)}
          className={cn(
            "p-2 rounded-xl transition cursor-pointer",
            isMetronome
              ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
              : "text-gray-400 hover:text-white hover:bg-white/5"
          )}
          title="Toggle Metronome"
        >
          <Clock className="w-4 h-4" />
        </button>
      </div>

      {/* Right: Tempo, Time Sig, Spectrum, LUFS */}
      <div className="flex items-center gap-3 sm:gap-4 select-none">
        {/* BPM & Signature */}
        <div className="flex items-center gap-2 text-xs font-mono">
          <div className={cn(
            "px-2.5 py-1.5 rounded-lg border flex items-center gap-1",
            isDark ? "bg-white/5 border-white/10" : "bg-gray-100 border-gray-200"
          )}>
            <span className="text-gray-400 font-sans font-medium">BPM:</span>
            <span className="font-bold text-purple-400">{tempo.toFixed(2)}</span>
          </div>

          <div className={cn(
            "px-2.5 py-1.5 rounded-lg border",
            isDark ? "bg-white/5 border-white/10 text-gray-300" : "bg-gray-100 border-gray-200 text-gray-700"
          )}>
            <span className="font-bold">4/4 TIME</span>
          </div>
        </div>

        {/* Mini Spectrum Bounce Bars */}
        <div className="flex items-end gap-0.5 h-6 px-2 py-1 rounded bg-black/40 border border-white/10">
          {Array.from({ length: 8 }).map((_, i) => {
            const h = isPlaying ? Math.max(3, (Math.sin(i * 1.2 + Date.now() / 200) * 0.5 + 0.5) * 18) : 4;
            return (
              <div
                key={i}
                className="w-1 rounded-full bg-gradient-to-t from-[#055BFB] to-[#C82BFF] transition-all duration-75"
                style={{ height: `${h}px` }}
              />
            );
          })}
        </div>

        {/* Master LUFS Meter */}
        <div className={cn(
          "px-2.5 py-1.5 rounded-lg border text-xs font-mono font-bold flex items-center gap-1.5",
          isDark ? "bg-white/5 border-white/10 text-emerald-400" : "bg-gray-100 border-gray-200 text-emerald-600"
        )}>
          <span className="text-[10px] text-gray-400 font-sans">LUFS:</span>
          <span>{lufs.toFixed(1)}</span>
        </div>
      </div>
    </div>
  );
}
