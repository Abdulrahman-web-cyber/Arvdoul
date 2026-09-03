// src/screens/AudioEditor/components/ClipInspectorModule.jsx
import React, { useState, useEffect, useRef } from 'react';
import { RotateCcw, Volume2, Plus, Sparkles, Sliders, Activity, Disc } from 'lucide-react';
import { cn } from '../../../lib/utils';
import { audioStudioEngine } from '../audioEngine';

export default function ClipInspectorModule({
  selectedClip,
  isDark = true,
  isPlaying = false,
  onUpdateClip,
}) {
  const [activeTab, setActiveTab] = useState('Clip');
  const [isReversed, setIsReversed] = useState(false);
  const [clipVolume, setClipVolume] = useState(-3.2);
  const [clipPan, setClipPan] = useState(0);
  const [clipPitch, setClipPitch] = useState(0);
  const [effects, setEffects] = useState([
    { id: 'eq', name: '1. Equalizer', active: true },
    { id: 'comp', name: '2. Compressor', active: true },
    { id: 'deess', name: '3. De-Esser', active: true },
    { id: 'limit', name: '4. Limiter', active: true },
  ]);
  const [visualizerMode, setVisualizerMode] = useState('Spectrum');

  const canvasRef = useRef(null);

  // Live Spectrum Analyzer Animation
  useEffect(() => {
    let animationId;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const render = () => {
      const width = canvas.width;
      const height = canvas.height;
      ctx.clearRect(0, 0, width, height);

      const freqData = audioStudioEngine.getSpectrumData();
      const barCount = 28;
      const barWidth = width / barCount - 2;

      for (let i = 0; i < barCount; i++) {
        let value = isPlaying ? (freqData[i * 2] || Math.random() * 90 + 30) : 10;
        const barHeight = (value / 255) * (height - 10);
        const x = i * (barWidth + 2);
        const y = height - barHeight;

        const grad = ctx.createLinearGradient(0, height, 0, 0);
        grad.addColorStop(0, '#055BFB');
        grad.addColorStop(0.6, '#8B1EF3');
        grad.addColorStop(1, '#C82BFF');

        ctx.fillStyle = grad;
        ctx.fillRect(x, y, barWidth, barHeight);
      }

      animationId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animationId);
  }, [isPlaying]);

  return (
    <div className={cn(
      "rounded-2xl border p-4 transition-colors",
      isDark ? "bg-[#03071B]/90 border-white/10" : "bg-white border-gray-200 shadow-sm"
    )}>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Left: Clip Info & Rotary / Sliders */}
        <div className="space-y-3">
          <div className="flex items-center justify-between border-b pb-2 border-inherit">
            <div className="flex items-center gap-2">
              {['Clip', 'Region', 'Project'].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={cn(
                    "text-xs font-bold px-2 py-0.5 rounded cursor-pointer",
                    activeTab === tab
                      ? "bg-purple-600 text-white"
                      : isDark ? "text-gray-400 hover:text-white" : "text-gray-600 hover:text-gray-900"
                  )}
                >
                  {tab}
                </button>
              ))}
            </div>
            <button
              onClick={() => setIsReversed(!isReversed)}
              className={cn(
                "flex items-center gap-1 text-[11px] px-2 py-0.5 rounded border transition cursor-pointer",
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
              <span className="font-mono font-bold">00:00:30.5</span>
            </div>
            <div className={cn("p-2 rounded-lg border", isDark ? "bg-white/5 border-white/5" : "bg-gray-50 border-gray-200")}>
              <span className="text-[10px] text-gray-400 block">End</span>
              <span className="font-mono font-bold">00:01:02.9</span>
            </div>
            <div className={cn("p-2 rounded-lg border", isDark ? "bg-white/5 border-white/5" : "bg-gray-50 border-gray-200")}>
              <span className="text-[10px] text-gray-400 block">Length</span>
              <span className="font-mono font-bold text-purple-400">00:32.4</span>
            </div>
          </div>

          {/* Sliders: Volume, Pan, Pitch */}
          <div className="space-y-2 text-xs">
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
              onChange={(e) => setClipVolume(Number(e.target.value))}
              className="w-full accent-purple-500 h-1.5 bg-gray-700 rounded-lg cursor-pointer"
            />

            <div className="flex items-center justify-between">
              <span className="text-gray-400">Pan</span>
              <span className="font-mono font-bold">{clipPan === 0 ? 'Center' : clipPan > 0 ? `R ${clipPan}` : `L ${Math.abs(clipPan)}`}</span>
            </div>
            <input
              type="range"
              min="-50"
              max="50"
              value={clipPan}
              onChange={(e) => setClipPan(Number(e.target.value))}
              className="w-full accent-indigo-500 h-1.5 bg-gray-700 rounded-lg cursor-pointer"
            />
          </div>
        </div>

        {/* Center: Effects Chain */}
        <div className="space-y-2 border-x px-3 border-inherit">
          <div className="flex items-center justify-between pb-1">
            <span className="text-xs font-bold uppercase tracking-wider text-gray-400">Effects Chain</span>
            <button className="flex items-center gap-1 text-[11px] text-purple-400 hover:text-purple-300 font-semibold cursor-pointer">
              <Plus className="w-3 h-3" /> Add Effect
            </button>
          </div>

          <div className="space-y-1.5">
            {effects.map((eff) => (
              <div
                key={eff.id}
                className={cn(
                  "flex items-center justify-between p-2 rounded-xl border text-xs transition",
                  eff.active
                    ? isDark ? "bg-white/5 border-purple-500/30 text-white" : "bg-purple-50/50 border-purple-200 text-gray-900"
                    : isDark ? "bg-white/2 border-white/5 text-gray-500" : "bg-gray-50 border-gray-200 text-gray-400"
                )}
              >
                <div className="flex items-center gap-2">
                  <Activity className="w-3.5 h-3.5 text-purple-400" />
                  <span className="font-semibold">{eff.name}</span>
                </div>
                <button
                  onClick={() =>
                    setEffects((prev) =>
                      prev.map((e) => (e.id === eff.id ? { ...e, active: !e.active } : e))
                    )
                  }
                  className={cn(
                    "w-6 h-3.5 rounded-full relative transition-colors cursor-pointer",
                    eff.active ? "bg-purple-600" : "bg-gray-600"
                  )}
                >
                  <span
                    className={cn(
                      "block w-2.5 h-2.5 rounded-full bg-white transition-transform absolute top-0.5",
                      eff.active ? "right-0.5" : "left-0.5"
                    )}
                  />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Right: Live Spectrum Analyzer */}
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
