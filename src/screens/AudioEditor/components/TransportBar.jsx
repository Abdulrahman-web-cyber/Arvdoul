// src/screens/AudioEditor/components/TransportBar.jsx
//
// Transport controls. Every readout is measured: the LUFS/peak meter polls the
// engine's analyser and the spectrum bars read real frequency bins.

import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, Square, SkipBack, Repeat, Clock } from 'lucide-react';
import { cn } from '../../../lib/utils';
import { audioStudioEngine } from '../audioEngine';

export default function TransportBar({
  currentTime,
  totalDuration = 0,
  isPlaying,
  canPlay = false,
  onPlayPause,
  onStop,
  onSeek,
  tempo = 128,
  setTempo,
  isLooping = false,
  setIsLooping,
  isMetronome = false,
  setIsMetronome,
  isDark = true,
}) {
  const [meter, setMeter] = useState({ peakDb: -Infinity, momentaryLufs: null });
  const [spectrum, setSpectrum] = useState([]);
  const rafRef = useRef(null);

  useEffect(() => {
    if (!isPlaying) {
      setMeter({ peakDb: -Infinity, momentaryLufs: null });
      return undefined;
    }
    const interval = setInterval(() => setMeter(audioStudioEngine.getMeter()), 100);

    const draw = () => {
      const data = audioStudioEngine.getSpectrumData();
      const bars = [];
      for (let i = 0; i < 8; i += 1) {
        // Log-spaced so the low end is not crushed into the first bar.
        const bin = Math.floor(Math.pow(data.length / 8, i / 8)) - 1;
        bars.push(data[Math.max(0, bin)] || 0);
      }
      setSpectrum(bars);
      rafRef.current = requestAnimationFrame(draw);
    };
    rafRef.current = requestAnimationFrame(draw);

    return () => {
      clearInterval(interval);
      cancelAnimationFrame(rafRef.current);
    };
  }, [isPlaying]);

  const formatLEDTime = (sec) => {
    const safe = Number.isFinite(sec) ? Math.max(0, sec) : 0;
    const m = Math.floor(safe / 60);
    const s = Math.floor(safe % 60);
    const ms = Math.floor((safe % 1) * 1000);
    return `${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}.${ms < 100 ? (ms < 10 ? '00' : '0') : ''}${ms}`;
  };

  const peakLabel = Number.isFinite(meter.peakDb) ? `${meter.peakDb.toFixed(1)}` : '—';
  const lufsLabel = meter.momentaryLufs === null ? '—' : meter.momentaryLufs.toFixed(1);

  return (
    <div className={cn(
      "rounded-2xl border p-3 flex flex-wrap items-center justify-between gap-4 transition-colors",
      isDark ? "bg-[#060B24] border-white/10" : "bg-white border-gray-200 shadow-sm"
    )}>
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

      <div className="flex items-center gap-2 sm:gap-3">
        <button
          onClick={() => onSeek?.(0)}
          className="p-2 rounded-xl text-gray-400 hover:text-white hover:bg-white/5 transition cursor-pointer"
          title="Return to Zero"
        >
          <SkipBack className="w-4 h-4" />
        </button>

        <button
          onClick={onPlayPause}
          disabled={!canPlay}
          className="w-12 h-12 rounded-full flex items-center justify-center text-white shadow-[0_0_25px_rgba(139,30,243,0.5)] hover:scale-105 active:scale-95 transition-all cursor-pointer disabled:opacity-40 disabled:hover:scale-100"
          style={{ background: 'linear-gradient(135deg, #8B1EF3 0%, #4431F7 50%, #055BFB 100%)' }}
          title={!canPlay ? 'Load audio to enable playback' : isPlaying ? 'Pause' : 'Play'}
        >
          {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current ml-0.5" />}
        </button>

        <button
          onClick={onStop}
          className="p-2 rounded-xl text-gray-400 hover:text-white hover:bg-white/5 transition cursor-pointer"
          title="Stop"
        >
          <Square className="w-4 h-4" />
        </button>

        <button
          onClick={() => setIsLooping?.(!isLooping)}
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

        <button
          onClick={() => setIsMetronome?.(!isMetronome)}
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

      <div className="flex items-center gap-3 sm:gap-4 select-none">
        <div className="flex items-center gap-2 text-xs font-mono">
          <div className={cn(
            "px-2.5 py-1.5 rounded-lg border flex items-center gap-1",
            isDark ? "bg-white/5 border-white/10" : "bg-gray-100 border-gray-200"
          )}>
            <span className="text-gray-400 font-sans font-medium">BPM:</span>
            <input
              type="number"
              min={30}
              max={300}
              value={tempo}
              onChange={(e) => setTempo?.(Math.max(30, Math.min(300, Number(e.target.value) || 120)))}
              className="w-14 bg-transparent font-bold text-purple-400 outline-none"
              aria-label="Tempo in beats per minute"
            />
          </div>

          <div className={cn(
            "px-2.5 py-1.5 rounded-lg border",
            isDark ? "bg-white/5 border-white/10 text-gray-300" : "bg-gray-100 border-gray-200 text-gray-700"
          )}>
            <span className="font-bold">4/4 TIME</span>
          </div>
        </div>

        <div className="flex items-end gap-0.5 h-6 px-2 py-1 rounded bg-black/40 border border-white/10">
          {(spectrum.length ? spectrum : new Array(8).fill(0)).map((value, i) => (
            <div
              key={i}
              className="w-1 rounded-full bg-gradient-to-t from-[#055BFB] to-[#C82BFF] transition-all duration-75"
              style={{ height: `${Math.max(2, (value / 255) * 18)}px` }}
            />
          ))}
        </div>

        <div className={cn(
          "px-2.5 py-1.5 rounded-lg border text-xs font-mono font-bold flex items-center gap-1.5",
          isDark ? "bg-white/5 border-white/10 text-emerald-400" : "bg-gray-100 border-gray-200 text-emerald-600"
        )}>
          <span className="text-[10px] text-gray-400 font-sans">LUFS:</span>
          <span>{lufsLabel}</span>
          <span className="text-[10px] text-gray-400 font-sans">Peak:</span>
          <span>{peakLabel}</span>
        </div>
      </div>
    </div>
  );
}
