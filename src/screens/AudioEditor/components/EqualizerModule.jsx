// src/screens/AudioEditor/components/EqualizerModule.jsx
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Power, RotateCcw, RotateCw, Sliders, ChevronDown } from 'lucide-react';
import { cn } from '../../../lib/utils';

export default function EqualizerModule({ isDark = true, isPlaying = false }) {
  const [eqEnabled, setEqEnabled] = useState(true);
  const [selectedPreset, setSelectedPreset] = useState('Vocal Clarity');
  const [bands, setBands] = useState([
    { id: 1, type: 'HPF', freq: 80, gain: 0, q: 0.7, color: '#8B1EF3' },
    { id: 2, type: 'Bell', freq: 250, gain: -2.1, q: 1.2, color: '#00C4FF' },
    { id: 3, type: 'Bell', freq: 1200, gain: 3.4, q: 1.0, color: '#10B981' },
    { id: 4, type: 'Bell', freq: 4500, gain: -1.6, q: 1.4, color: '#F59E0B' },
    { id: 5, type: 'LPF', freq: 16000, gain: 0, q: 0.7, color: '#EF4444' },
  ]);
  const [activeBandIndex, setActiveBandIndex] = useState(2);
  const [activeTab, setActiveTab] = useState('EQ');

  const canvasRef = useRef(null);
  const isDraggingRef = useRef(false);
  const dragBandIndexRef = useRef(null);

  // Meter levels
  const [leftLUFS, setLeftLUFS] = useState(-14.2);
  const [rightLUFS, setRightLUFS] = useState(-13.8);

  useEffect(() => {
    if (!isPlaying) return;
    const interval = setInterval(() => {
      setLeftLUFS(-14.2 + (Math.random() * 4 - 2));
      setRightLUFS(-13.8 + (Math.random() * 4 - 2));
    }, 150);
    return () => clearInterval(interval);
  }, [isPlaying]);

  // Logarithmic mapping helpers
  const minFreq = 20;
  const maxFreq = 20000;
  const minGain = -15;
  const maxGain = 15;

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
    const g = minGain + normalized * (maxGain - minGain);
    return Math.round(g * 10) / 10;
  }, []);

  // Draw EQ Curve on Canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;

    ctx.clearRect(0, 0, width, height);

    // Grid lines
    ctx.strokeStyle = isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.06)';
    ctx.lineWidth = 1;

    // Freq grid markers
    const freqMarkers = [50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000];
    ctx.fillStyle = isDark ? 'rgba(255, 255, 255, 0.3)' : 'rgba(0, 0, 0, 0.4)';
    ctx.font = '9px monospace';

    freqMarkers.forEach((f) => {
      const x = freqToX(f, width);
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
      const label = f >= 1000 ? `${f / 1000}k` : `${f}`;
      ctx.fillText(label, x + 2, height - 6);
    });

    // dB grid markers
    const dBMarkers = [12, 6, 0, -6, -12];
    dBMarkers.forEach((g) => {
      const y = gainToY(g, height);
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
      ctx.fillText(`${g > 0 ? '+' : ''}${g} dB`, 6, y - 3);
    });

    if (!eqEnabled) return;

    // Draw Smooth EQ Spline
    ctx.beginPath();
    ctx.strokeStyle = '#8B1EF3';
    ctx.lineWidth = 2.5;

    const points = bands.map((b) => ({
      x: freqToX(b.freq, width),
      y: gainToY(b.gain, height),
    }));

    // Gradient fill under curve
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, 'rgba(139, 30, 243, 0.25)');
    gradient.addColorStop(0.5, 'rgba(68, 49, 247, 0.12)');
    gradient.addColorStop(1, 'rgba(5, 91, 251, 0)');

    ctx.beginPath();
    ctx.moveTo(0, gainToY(0, height));

    for (let i = 0; i < width; i += 3) {
      const f = xToFreq(i, width);
      // Calculate composite gain at frequency f
      let totalGain = 0;
      bands.forEach((b) => {
        if (b.type === 'Bell') {
          const octDiff = Math.log2(f / b.freq);
          const bell = Math.exp(-Math.pow(octDiff * b.q, 2));
          totalGain += b.gain * bell;
        } else if (b.type === 'HPF') {
          if (f < b.freq) {
            totalGain += Math.max(-24, (f / b.freq - 1) * 18);
          }
        } else if (b.type === 'LPF') {
          if (f > b.freq) {
            totalGain += Math.max(-24, (1 - f / b.freq) * 18);
          }
        }
      });
      const y = gainToY(totalGain, height);
      if (i === 0) ctx.moveTo(i, y);
      else ctx.lineTo(i, y);
    }

    ctx.stroke();

    // Draw draggable interactive band handles
    bands.forEach((b, idx) => {
      const x = freqToX(b.freq, width);
      const y = gainToY(b.gain, height);
      const isSelected = idx === activeBandIndex;

      // Glow circle
      ctx.beginPath();
      ctx.arc(x, y, isSelected ? 12 : 9, 0, Math.PI * 2);
      ctx.fillStyle = b.color;
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#FFFFFF';
      ctx.stroke();

      // Band number label
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 9px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(b.id), x, y);
    });
  }, [bands, eqEnabled, activeBandIndex, isDark, freqToX, gainToY, xToFreq]);

  // Handle Dragging Band on Canvas
  const handleCanvasMouseDown = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * canvas.width;
    const y = ((e.clientY - rect.top) / rect.height) * canvas.height;

    // Find nearest band
    let nearestIdx = -1;
    let minDist = 24;
    bands.forEach((b, idx) => {
      const bx = freqToX(b.freq, canvas.width);
      const by = gainToY(b.gain, canvas.height);
      const dist = Math.hypot(x - bx, y - by);
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

  const currentActiveBand = bands[activeBandIndex] || bands[0];

  return (
    <div className={cn(
      "rounded-2xl border p-4 transition-colors",
      isDark ? "bg-[#03071B]/90 border-white/10" : "bg-white border-gray-200 shadow-sm"
    )}>
      {/* Upper sub-tabs matching Image 1: Audio, EQ, Dynamics, Reverb, Delay, Modulation, Utility, AI Tools, More */}
      <div className="flex items-center justify-between gap-2 border-b pb-3 mb-4 overflow-x-auto scrollbar-hide border-inherit">
        <div className="flex items-center gap-1.5">
          {['Audio', 'EQ', 'Dynamics', 'Reverb', 'Delay', 'Modulation', 'Utility', 'AI Tools'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                "px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer",
                activeTab === tab
                  ? "bg-gradient-to-r from-[#8B1EF3] to-[#055BFB] text-white shadow-md"
                  : isDark
                  ? "text-gray-400 hover:text-white hover:bg-white/5"
                  : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
              )}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Preset & Power Switch */}
        <div className="flex items-center gap-2">
          <div className={cn(
            "flex items-center gap-1.5 px-3 py-1 rounded-lg border text-xs font-medium cursor-pointer",
            isDark ? "bg-white/5 border-white/10 text-gray-300" : "bg-gray-50 border-gray-200 text-gray-700"
          )}>
            <span>Preset: {selectedPreset}</span>
            <ChevronDown className="w-3.5 h-3.5 opacity-60" />
          </div>

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

      {/* Grid: Left EQ Canvas & Controls, Right Loudness Meter */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* EQ Curve Canvas & Draggable Nodes (3 cols) */}
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

          {/* 5 Draggable Band Parameter Cards */}
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

        {/* Right Loudness / LUFS & True Peak Meter (1 col) */}
        <div className={cn(
          "p-4 rounded-xl border flex flex-col justify-between",
          isDark ? "bg-white/5 border-white/10" : "bg-gray-50 border-gray-200"
        )}>
          <div>
            <div className="text-xs font-bold tracking-wider uppercase mb-1 text-gray-400">Master Loudness</div>
            <div className="flex items-center justify-between text-xs text-gray-400 mb-3">
              <span>True Peak: <strong className="text-white">-0.8 dB</strong></span>
              <span>LRA: <strong className="text-white">6.4 LU</strong></span>
            </div>

            {/* Stereo Dual Vertical Meter Bars */}
            <div className="flex items-end justify-center gap-4 h-32 py-2">
              {/* Left Channel */}
              <div className="flex flex-col items-center gap-1">
                <div className="w-4 h-24 rounded-full bg-gray-700/40 overflow-hidden relative flex flex-col justify-end p-0.5">
                  <div
                    className="w-full rounded-full transition-all duration-100 bg-gradient-to-t from-emerald-500 via-amber-400 to-rose-500"
                    style={{ height: `${Math.min(100, Math.max(10, (leftLUFS + 30) * 4))}%` }}
                  />
                </div>
                <span className="text-[10px] font-mono text-gray-400">L</span>
                <span className="text-[10px] font-mono font-bold text-white">{leftLUFS.toFixed(1)}</span>
              </div>

              {/* Right Channel */}
              <div className="flex flex-col items-center gap-1">
                <div className="w-4 h-24 rounded-full bg-gray-700/40 overflow-hidden relative flex flex-col justify-end p-0.5">
                  <div
                    className="w-full rounded-full transition-all duration-100 bg-gradient-to-t from-emerald-500 via-amber-400 to-rose-500"
                    style={{ height: `${Math.min(100, Math.max(10, (rightLUFS + 30) * 4))}%` }}
                  />
                </div>
                <span className="text-[10px] font-mono text-gray-400">R</span>
                <span className="text-[10px] font-mono font-bold text-white">{rightLUFS.toFixed(1)}</span>
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
