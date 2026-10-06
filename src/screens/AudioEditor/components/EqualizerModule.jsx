// src/screens/AudioEditor/components/EqualizerModule.jsx
//
// Parametric EQ. Bands are controlled state, presets come from the shared
// preset table, and the curve is computed from the same band values that are
// applied to the live BiquadFilterNodes in the audio engine. The loudness meter
// reads the engine's measured output — it is never animated with random values.

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Power, ChevronDown } from 'lucide-react';
import { cn } from '../../../lib/utils';
import { audioStudioEngine } from '../audioEngine';
import { EQ_PRESET_NAMES, getPresetBands, EQ_RANGES } from '../audioPresets';

const { minFreq, maxFreq, minGain, maxGain } = EQ_RANGES;

export default function EqualizerModule({
  isDark = true,
  isPlaying = false,
  bands,
  setBands,
  eqEnabled,
  setEqEnabled,
}) {
  const [presetName, setPresetName] = useState('Flat');
  const [showPresets, setShowPresets] = useState(false);
  const [activeBandIndex, setActiveBandIndex] = useState(2);
  const [meter, setMeter] = useState({ peakDb: -Infinity, momentaryLufs: null });

  const canvasRef = useRef(null);
  const isDraggingRef = useRef(false);
  const dragBandIndexRef = useRef(null);

  useEffect(() => {
    if (!isPlaying) {
      setMeter({ peakDb: -Infinity, momentaryLufs: null });
      return undefined;
    }
    const interval = setInterval(() => setMeter(audioStudioEngine.getMeter()), 150);
    return () => clearInterval(interval);
  }, [isPlaying]);

  const freqToX = useCallback((freq, width) => {
    const minLog = Math.log10(minFreq);
    const maxLog = Math.log10(maxFreq);
    const logVal = Math.log10(Math.max(minFreq, Math.min(maxFreq, freq)));
    return ((logVal - minLog) / (maxLog - minLog)) * width;
  }, []);

  const gainToY = useCallback((gain, height) => {
    const normalized = (gain - minGain) / (maxGain - minGain);
    return height - normalized * height;
  }, []);

  const xToFreq = useCallback((x, width) => {
    const minLog = Math.log10(minFreq);
    const maxLog = Math.log10(maxFreq);
    const logVal = minLog + (x / width) * (maxLog - minLog);
    return Math.round(Math.pow(10, logVal));
  }, []);

  const yToGain = useCallback((y, height) => {
    const normalized = (height - y) / height;
    return Math.round((minGain + normalized * (maxGain - minGain)) * 10) / 10;
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;

    ctx.clearRect(0, 0, width, height);

    ctx.strokeStyle = isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.06)';
    ctx.lineWidth = 1;

    const freqMarkers = [50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000];
    ctx.fillStyle = isDark ? 'rgba(255, 255, 255, 0.3)' : 'rgba(0, 0, 0, 0.4)';
    ctx.font = '9px monospace';

    freqMarkers.forEach((f) => {
      const x = freqToX(f, width);
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
      ctx.fillText(f >= 1000 ? `${f / 1000}k` : `${f}`, x + 2, height - 6);
    });

    [12, 6, 0, -6, -12].forEach((g) => {
      const y = gainToY(g, height);
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
      ctx.fillText(`${g > 0 ? '+' : ''}${g} dB`, 6, y - 3);
    });

    if (!eqEnabled) return;

    // Gradient fill under the curve.
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, 'rgba(139, 30, 243, 0.25)');
    gradient.addColorStop(0.5, 'rgba(68, 49, 247, 0.12)');
    gradient.addColorStop(1, 'rgba(5, 91, 251, 0)');

    ctx.beginPath();
    ctx.moveTo(0, gainToY(0, height));
    for (let i = 0; i < width; i += 3) {
      const f = xToFreq(i, width);
      let totalGain = 0;
      bands.forEach((b) => {
        if (b.type === 'Bell') {
          const octDiff = Math.log2(f / b.freq);
          totalGain += b.gain * Math.exp(-Math.pow(octDiff * b.q, 2));
        } else if (b.type === 'HPF') {
          if (f < b.freq) totalGain += Math.max(-24, (f / b.freq - 1) * 18);
        } else if (b.type === 'LPF') {
          if (f > b.freq) totalGain += Math.max(-24, (1 - f / b.freq) * 18);
        }
      });
      const y = gainToY(totalGain, height);
      if (i === 0) ctx.moveTo(i, y);
      else ctx.lineTo(i, y);
    }
    ctx.strokeStyle = '#8B1EF3';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    bands.forEach((b, idx) => {
      const x = freqToX(b.freq, width);
      const y = gainToY(b.gain, height);
      const isSelected = idx === activeBandIndex;

      ctx.beginPath();
      ctx.arc(x, y, isSelected ? 12 : 9, 0, Math.PI * 2);
      ctx.fillStyle = b.color;
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#FFFFFF';
      ctx.stroke();

      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 9px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(b.id), x, y);
    });
  }, [bands, eqEnabled, activeBandIndex, isDark, freqToX, gainToY, xToFreq]);

  const handleCanvasMouseDown = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * canvas.width;
    const y = ((e.clientY - rect.top) / rect.height) * canvas.height;

    let nearestIdx = -1;
    let minDist = 24;
    bands.forEach((b, idx) => {
      const dist = Math.hypot(x - freqToX(b.freq, canvas.width), y - gainToY(b.gain, canvas.height));
      if (dist < minDist) {
        minDist = dist;
        nearestIdx = idx;
      }
    });

    if (nearestIdx !== -1) {
      isDraggingRef.current = true;
      dragBandIndexRef.current = nearestIdx;
      setActiveBandIndex(nearestIdx);
    }
  };

  const handleCanvasMouseMove = (e) => {
    if (!isDraggingRef.current || dragBandIndexRef.current === null) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = Math.max(0, Math.min(canvas.width, ((e.clientX - rect.left) / rect.width) * canvas.width));
    const y = Math.max(0, Math.min(canvas.height, ((e.clientY - rect.top) / rect.height) * canvas.height));

    const newFreq = xToFreq(x, canvas.width);
    const newGain = yToGain(y, canvas.height);

    setBands((prev) =>
      prev.map((b, i) => {
        if (i !== dragBandIndexRef.current) return b;
        return {
          ...b,
          freq: b.type === 'HPF' ? Math.min(300, newFreq) : b.type === 'LPF' ? Math.max(8000, newFreq) : newFreq,
          gain: b.type === 'HPF' || b.type === 'LPF' ? 0 : Math.max(-12, Math.min(12, newGain)),
        };
      })
    );
  };

  const handleCanvasMouseUp = () => {
    isDraggingRef.current = false;
    dragBandIndexRef.current = null;
  };

  const applyPreset = (name) => {
    setPresetName(name);
    setBands(getPresetBands(name));
    setShowPresets(false);
  };

  const lufsLabel = meter.momentaryLufs === null ? '—' : meter.momentaryLufs.toFixed(1);
  const peakLabel = Number.isFinite(meter.peakDb) ? meter.peakDb.toFixed(1) : '—';
  const meterPercent = meter.momentaryLufs === null
    ? 0
    : Math.min(100, Math.max(0, (meter.momentaryLufs + 30) * 4));

  return (
    <div className={cn(
      "rounded-2xl border p-4 transition-colors",
      isDark ? "bg-[#03071B]/90 border-white/10" : "bg-white border-gray-200 shadow-sm"
    )}>
      <div className="flex items-center justify-between gap-2 border-b pb-3 mb-4 overflow-x-auto scrollbar-hide border-inherit">
        <div className="text-xs font-bold uppercase tracking-wider text-gray-400">
          Parametric EQ · {bands.length} bands
        </div>

        <div className="flex items-center gap-2 relative">
          <button
            onClick={() => setShowPresets((s) => !s)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1 rounded-lg border text-xs font-medium cursor-pointer",
              isDark ? "bg-white/5 border-white/10 text-gray-300" : "bg-gray-50 border-gray-200 text-gray-700"
            )}
          >
            <span>Preset: {presetName}</span>
            <ChevronDown className="w-3.5 h-3.5 opacity-60" />
          </button>

          {showPresets && (
            <div className={cn(
              "absolute right-0 top-full mt-1 w-44 rounded-xl border p-1.5 shadow-2xl z-40",
              isDark ? "bg-[#060B24]/95 border-white/10 text-white" : "bg-white border-gray-200 text-gray-900"
            )}>
              {EQ_PRESET_NAMES.map((name) => (
                <button
                  key={name}
                  onClick={() => applyPreset(name)}
                  className="w-full text-left px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-purple-600/20 cursor-pointer"
                >
                  {name}
                </button>
              ))}
            </div>
          )}

          <button
            onClick={() => setEqEnabled(!eqEnabled)}
            className={cn(
              "w-7 h-7 rounded-lg flex items-center justify-center transition-all cursor-pointer",
              eqEnabled
                ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40"
                : "bg-gray-700/20 text-gray-500 border border-gray-600/30"
            )}
            title="Toggle EQ Power"
          >
            <Power className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <div className="lg:col-span-3 space-y-3">
          <div className={cn(
            "relative w-full h-44 rounded-xl overflow-hidden border",
            isDark ? "bg-[#0B1130] border-white/10" : "bg-slate-900 border-gray-300"
          )}>
            <canvas
              ref={canvasRef}
              width={720}
              height={176}
              onMouseDown={handleCanvasMouseDown}
              onMouseMove={handleCanvasMouseMove}
              onMouseUp={handleCanvasMouseUp}
              onMouseLeave={handleCanvasMouseUp}
              className="w-full h-full cursor-crosshair"
            />
          </div>

          <div className="grid grid-cols-5 gap-2">
            {bands.map((b, idx) => {
              const isSel = idx === activeBandIndex;
              return (
                <div
                  key={b.id}
                  onClick={() => setActiveBandIndex(idx)}
                  className={cn(
                    "p-2.5 rounded-xl border text-center cursor-pointer transition-all",
                    isSel
                      ? "ring-1 ring-[#8B1EF3] border-[#8B1EF3] bg-[#8B1EF3]/10"
                      : isDark
                      ? "bg-white/5 border-white/5 hover:border-white/20"
                      : "bg-gray-50 border-gray-200 hover:border-gray-300"
                  )}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded text-white" style={{ backgroundColor: b.color }}>
                      {b.id}
                    </span>
                    <span className="text-[10px] font-semibold text-gray-400">{b.type}</span>
                  </div>
                  <div className="text-xs font-bold truncate">
                    {b.freq >= 1000 ? `${(b.freq / 1000).toFixed(1)} kHz` : `${b.freq} Hz`}
                  </div>
                  <div className={cn(
                    "text-[11px] font-medium mt-0.5",
                    b.gain > 0 ? "text-emerald-400" : b.gain < 0 ? "text-amber-400" : "text-gray-400"
                  )}>
                    {b.gain > 0 ? `+${b.gain}` : b.gain} dB
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className={cn(
          "p-4 rounded-xl border flex flex-col justify-between",
          isDark ? "bg-white/5 border-white/10" : "bg-gray-50 border-gray-200"
        )}>
          <div>
            <div className="text-xs font-bold tracking-wider uppercase mb-1 text-gray-400">Master Loudness</div>
            <div className="flex items-center justify-between text-xs text-gray-400 mb-3">
              <span>True Peak: <strong className="text-white">{peakLabel} dB</strong></span>
            </div>

            <div className="flex items-end justify-center gap-4 h-32 py-2">
              {/* One meter: an AnalyserNode downmixes to mono, so showing two
                  identical L/R bars would imply a separation we do not measure. */}
              <div className="flex flex-col items-center gap-1">
                <div className="w-6 h-24 rounded-full bg-gray-700/40 overflow-hidden relative flex flex-col justify-end p-0.5">
                  <div
                    className="w-full rounded-full transition-all duration-100 bg-gradient-to-t from-emerald-500 via-amber-400 to-rose-500"
                    style={{ height: `${Math.max(2, meterPercent)}%` }}
                  />
                </div>
                <span className="text-[10px] font-mono text-gray-400">Master</span>
                <span className="text-[10px] font-mono font-bold text-white">{lufsLabel}</span>
              </div>
            </div>
          </div>

          <div className="pt-2 border-t border-white/10 text-center">
            <span className="text-[11px] font-semibold text-purple-400">Target: -14 LUFS (Online)</span>
          </div>
        </div>
      </div>
    </div>
  );
}
