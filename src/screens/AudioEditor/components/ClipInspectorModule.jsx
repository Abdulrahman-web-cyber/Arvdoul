// src/screens/AudioEditor/components/ClipInspectorModule.jsx
//
// Inspector for the selected clip. Shows the clip's real timing (from its start
// and duration) and its real peak level (measured from the decoded buffer).
// With no clip selected it shows an explicit empty state rather than invented
// timings and levels.

import React, { useEffect, useRef, useState } from 'react';
import { RotateCcw, Activity, Radio } from 'lucide-react';
import { cn } from '../../../lib/utils';
import { audioStudioEngine } from '../audioEngine';

function formatClock(seconds) {
  if (!Number.isFinite(seconds)) return '—';
  const safe = Math.max(0, seconds);
  const m = Math.floor(safe / 60);
  const s = Math.floor(safe % 60);
  const ms = Math.floor((safe % 1) * 1000);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(ms).padStart(3, '0')}`;
}

/** Peak dBFS of a decoded AudioBuffer. */
function peakDbOf(buffer) {
  if (!buffer || typeof buffer.getChannelData !== 'function') return null;
  const data = buffer.getChannelData(0);
  let peak = 0;
  for (let i = 0; i < data.length; i += 1) {
    const abs = Math.abs(data[i]);
    if (abs > peak) peak = abs;
  }
  return peak > 0 ? 20 * Math.log10(peak) : -Infinity;
}

export default function ClipInspectorModule({
  selectedClip,
  isDark = true,
  isPlaying = false,
  onUpdateClip,
}) {
  const [isReversed, setIsReversed] = useState(false);
  const [clipVolume, setClipVolume] = useState(0);
  const [clipPan, setClipPan] = useState(0);
  const [visualizerMode, setVisualizerMode] = useState('Spectrum');
  const [peakDb, setPeakDb] = useState(null);

  const canvasRef = useRef(null);

  // A new selection resets the inspector to that clip's own values.
  useEffect(() => {
    if (!selectedClip) return;
    setClipVolume(selectedClip.volume ?? 0);
    setClipPan(selectedClip.pan ?? 0);
    setIsReversed(Boolean(selectedClip.reversed));
    setPeakDb(peakDbOf(selectedClip.buffer));
  }, [selectedClip?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Live spectrum / spectrogram from the engine's analyser.
  useEffect(() => {
    let animationId;
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const ctx = canvas.getContext('2d');
    const history = [];

    const render = () => {
      const width = canvas.width;
      const height = canvas.height;
      const freqData = audioStudioEngine.getSpectrumData();
      const barCount = 28;
      const barWidth = width / barCount - 2;

      if (visualizerMode === 'Spectrogram') {
        history.unshift(Uint8Array.from(freqData.subarray(0, barCount * 2)));
        if (history.length > height) history.pop();
        ctx.clearRect(0, 0, width, height);
        history.forEach((row, y) => {
          for (let i = 0; i < barCount; i += 1) {
            const value = row[i * 2] || 0;
            ctx.fillStyle = `hsl(${260 - (value / 255) * 200}, 90%, ${10 + (value / 255) * 45}%)`;
            ctx.fillRect(i * (barWidth + 2), y, barWidth + 1, 1);
          }
        });
      } else {
        ctx.clearRect(0, 0, width, height);
        for (let i = 0; i < barCount; i += 1) {
          const value = isPlaying ? (freqData[i * 2] || 0) : 0;
          const barHeight = (value / 255) * (height - 10);
          const grad = ctx.createLinearGradient(0, height, 0, 0);
          grad.addColorStop(0, '#055BFB');
          grad.addColorStop(0.6, '#8B1EF3');
          grad.addColorStop(1, '#C82BFF');
          ctx.fillStyle = grad;
          ctx.fillRect(i * (barWidth + 2), height - barHeight, barWidth, barHeight);
        }
      }
      animationId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animationId);
  }, [isPlaying, visualizerMode]);

  const commitVolume = (value) => {
    setClipVolume(value);
    onUpdateClip?.({ volume: value });
  };

  const commitPan = (value) => {
    setClipPan(value);
    onUpdateClip?.({ pan: value });
  };

  const toggleReverse = () => {
    const next = !isReversed;
    setIsReversed(next);
    onUpdateClip?.({ reversed: next });
  };

  const start = selectedClip?.start ?? null;
  const end = selectedClip ? selectedClip.start + selectedClip.duration : null;

  return (
    <div className={cn(
      "rounded-2xl border p-4 transition-colors",
      isDark ? "bg-[#03071B]/90 border-white/10" : "bg-white border-gray-200 shadow-sm"
    )}>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="space-y-3">
          <div className="flex items-center justify-between border-b pb-2 border-inherit">
            <span className="text-xs font-bold uppercase tracking-wider text-gray-400">
              {selectedClip ? 'Selected Clip' : 'No Clip Selected'}
            </span>
            <button
              onClick={toggleReverse}
              disabled={!selectedClip}
              className={cn(
                "flex items-center gap-1 text-[11px] px-2 py-0.5 rounded border transition cursor-pointer disabled:opacity-40",
                isReversed
                  ? "bg-purple-500/20 text-purple-400 border-purple-500/40"
                  : isDark ? "border-white/10 text-gray-400" : "border-gray-200 text-gray-600"
              )}
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reverse</span>
            </button>
          </div>

          <div className="grid grid-cols-3 gap-2 text-center text-xs">
            <div className={cn("p-2 rounded-lg border", isDark ? "bg-white/5 border-white/5" : "bg-gray-50 border-gray-200")}>
              <span className="text-[10px] text-gray-400 block">Start</span>
              <span className="font-mono font-bold">{start === null ? '—' : formatClock(start)}</span>
            </div>
            <div className={cn("p-2 rounded-lg border", isDark ? "bg-white/5 border-white/5" : "bg-gray-50 border-gray-200")}>
              <span className="text-[10px] text-gray-400 block">End</span>
              <span className="font-mono font-bold">{end === null ? '—' : formatClock(end)}</span>
            </div>
            <div className={cn("p-2 rounded-lg border", isDark ? "bg-white/5 border-white/5" : "bg-gray-50 border-gray-200")}>
              <span className="text-[10px] text-gray-400 block">Length</span>
              <span className="font-mono font-bold text-purple-400">
                {selectedClip ? formatClock(selectedClip.duration) : '—'}
              </span>
            </div>
          </div>

          <div className="space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-gray-400">Clip peak</span>
              <span className="font-mono font-bold">
                {peakDb === null ? '—' : `${peakDb.toFixed(1)} dBFS`}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-gray-400">Volume</span>
              <span className="font-mono font-bold">{clipVolume} dB</span>
            </div>
            <input
              type="range"
              min="-24"
              max="6"
              step="0.1"
              value={clipVolume}
              disabled={!selectedClip}
              onChange={(e) => commitVolume(Number(e.target.value))}
              className="w-full accent-purple-500 h-1.5 bg-gray-700 rounded-lg cursor-pointer disabled:opacity-40"
            />

            <div className="flex items-center justify-between">
              <span className="text-gray-400">Pan</span>
              <span className="font-mono font-bold">
                {clipPan === 0 ? 'Center' : clipPan > 0 ? `R ${clipPan}` : `L ${Math.abs(clipPan)}`}
              </span>
            </div>
            <input
              type="range"
              min="-50"
              max="50"
              step="1"
              value={clipPan}
              disabled={!selectedClip}
              onChange={(e) => commitPan(Number(e.target.value))}
              className="w-full accent-indigo-500 h-1.5 bg-gray-700 rounded-lg cursor-pointer disabled:opacity-40"
            />
          </div>
        </div>

        <div className="space-y-2 border-x px-3 border-inherit">
          <div className="flex items-center justify-between pb-1">
            <span className="text-xs font-bold uppercase tracking-wider text-gray-400">Signal</span>
            <Radio className="w-3.5 h-3.5 text-purple-400" />
          </div>
          <div className="space-y-2 text-xs text-gray-400">
            <div className="flex items-center gap-2">
              <Activity className="w-3.5 h-3.5 text-purple-400" />
              <span>Live master signal, measured at the analyser.</span>
            </div>
            <p className="text-[11px] leading-relaxed">
              Effects are applied from the EQ module. Per-clip dynamics are not
              processed yet, so none are listed here.
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between pb-1">
            <span className="text-xs font-bold uppercase tracking-wider text-gray-400">Spectrum Analyzer</span>
            <div className="flex items-center gap-1 text-[10px]">
              {['Spectrum', 'Spectrogram'].map((m) => (
                <button
                  key={m}
                  onClick={() => setVisualizerMode(m)}
                  className={cn(
                    "px-2 py-0.5 rounded cursor-pointer",
                    visualizerMode === m
                      ? "bg-purple-600 text-white"
                      : isDark ? "text-gray-400 hover:text-white" : "text-gray-600 hover:text-gray-900"
                  )}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          <div className={cn(
            "w-full h-32 rounded-xl overflow-hidden border relative flex items-end p-2",
            isDark ? "bg-[#0B1130] border-white/10" : "bg-slate-900 border-gray-300"
          )}>
            <canvas ref={canvasRef} width={280} height={120} className="w-full h-full" />
            <div className="absolute top-1.5 right-2 text-[9px] font-mono text-purple-400">
              20Hz — 20kHz
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
