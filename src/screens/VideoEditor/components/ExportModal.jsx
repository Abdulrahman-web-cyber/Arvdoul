// src/screens/VideoEditor/components/ExportModal.jsx
//
// client-side renderer: seeks every clip frame-by-frame onto an
// offscreen canvas, records the canvas stream with MediaRecorder, and
// produces a genuine .webm file the user can download or post. Progress is
// real (rendered frames / total frames). No fabricated URLs, no fake
// percentages, no demo videos.

import { useState, useEffect, useRef } from "react";
import PropTypes from 'prop-types';
import { motion } from "framer-motion";
import {
  X, Download, Share2, CheckCircle2, Film,
  AlertTriangle, HardDrive
} from 'lucide-react';
import { useTheme } from "../../../context/ThemeContext";
import { RESOLUTION_PRESETS, FILTERS_LIST } from '../constants';
import { useNavigate } from 'react-router-dom';
import { brandRgba } from '../../../design-system/tokens.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export default function ExportModal({
  isOpen,
  onClose,
  projectName = 'ARVDOUL Video Project',
  duration = 0,
  currentResolution,
  tracks = [],
  filterId = 'none',
  adjustments = null,
  activeEffect = 'none',
  stabilizeMode = 'off',
  isMuted = false,
  volume = 1,
}) {
  const { isDark } = useTheme();
  const navigate = useNavigate();
  const [selectedRes, setSelectedRes] = useState(currentResolution || RESOLUTION_PRESETS[0]);
  const [format, setFormat] = useState('webm'); // webm only — MediaRecorder native
  const [frameRate, setFrameRate] = useState(30); // 30 | 24 (60 is unreliable on web)
  const [quality, setQuality] = useState('high'); // ultra | high | medium
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [exportComplete, setExportComplete] = useState(false);
  const [exportedUrl, setExportedUrl] = useState(null);
  const [exportedBlob, setExportedBlob] = useState(null);
  const [exportError, setExportError] = useState(null);
  const cancelRef = useRef(false);
  const handedOffUrlRef = useRef(null);
  const ownedUrlsRef = useRef([]);

  useEffect(() => {
    if (currentResolution) setSelectedRes(currentResolution);
  }, [currentResolution]);

  useEffect(() => {
    if (!isOpen) {
      cancelRef.current = true;
      setExportError(null);
    } else {
      cancelRef.current = false;
    }
  }, [isOpen]);

  useEffect(() => {
    return () => {
      cancelRef.current = true;
      ownedUrlsRef.current.forEach((url) => {
        if (url && url !== handedOffUrlRef.current) {
          URL.revokeObjectURL(url);
        }
      });
      ownedUrlsRef.current = [];
    };
  }, []);

  const allClips = (tracks || []).flatMap((t) =>
    (t.clips || []).map((c) => ({
      ...c,
      trackId: t.id,
      trackVisible: t.visible !== false,
      trackMuted: Boolean(t.muted || t.visible === false),
    }))
  );
  const visibleClips = allClips.filter((c) => c.visible !== false && c.trackVisible);
  const videoClips = visibleClips.filter((c) => c.type === 'video' && c.url);
  const audioClips = visibleClips.filter((c) => c.type === 'audio' && c.url);
  const textClips = visibleClips.filter((c) => c.type === 'text');
  const stickerClips = visibleClips.filter((c) => c.type === 'sticker');
  const overlayClips = visibleClips.filter((c) => c.type === 'overlay');

  const computedTotal = Math.max(
    0,
    ...visibleClips.map((c) => (c.startTime || 0) + (c.duration || 0))
  );
  const total = computedTotal > 0 ? computedTotal : Number(duration) || 0;

  const activeFilterCss = FILTERS_LIST.find((f) => f.id === filterId)?.css || '';
  const adjCss = adjustments
    ? `brightness(${adjustments.brightness ?? 100}%) contrast(${adjustments.contrast ?? 100}%) saturate(${adjustments.saturate ?? 100}%) blur(${adjustments.blur ?? 0}px) hue-rotate(${adjustments.hueRotate ?? 0}deg) sepia(${adjustments.sepia ?? 0}%)`
    : '';
  const combinedFilterCss = `${activeFilterCss} ${adjCss}`.trim() || 'none';
  const globalOpacity = (adjustments?.opacity ?? 100) / 100;
  const stabilizeScale =
    stabilizeMode === 'action' ? 1.12
      : stabilizeMode === 'cinematic' ? 1.08
        : stabilizeMode === 'standard' ? 1.04
          : 1;

  const drawFrame = (ctx, W, H, t) => {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);

    // Active video clip with filter/adjustments/stabilize overscan
    const clip = videoClips.find((c) => t >= c.startTime && t <= c.startTime + (c.duration || 0));
    if (clip && clip._videoEl) {
      const v = clip._videoEl;
      if (v.readyState >= 2 && v.videoWidth > 0) {
        ctx.save();
        ctx.filter = combinedFilterCss;
        ctx.globalAlpha = globalOpacity;
        const scale = Math.max(W / v.videoWidth, H / v.videoHeight) * stabilizeScale;
        const dw = v.videoWidth * scale;
        const dh = v.videoHeight * scale;
        if (activeEffect === 'mirror') {
          ctx.translate(W, 0);
          ctx.scale(-1, 1);
        }
        ctx.drawImage(v, (W - dw) / 2, (H - dh) / 2, dw, dh);
        ctx.restore();
      }
    }

    // Active visual effects
    if (activeEffect === 'vhs') {
      ctx.save();
      ctx.fillStyle = 'rgba(0,0,0,0.22)';
      for (let y = 0; y < H; y += 6) {
        ctx.fillRect(0, y, W, 2);
      }
      ctx.restore();
    } else if (activeEffect === 'vignette') {
      ctx.save();
      const grad = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.25, W / 2, H / 2, Math.max(W, H) * 0.72);
      grad.addColorStop(0, 'rgba(0,0,0,0)');
      grad.addColorStop(1, 'rgba(0,0,0,0.82)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
    } else if (activeEffect === 'light_leak') {
      ctx.save();
      const grad = ctx.createLinearGradient(0, H, W, 0);
      grad.addColorStop(0, 'rgba(245,158,11,0.34)');
      grad.addColorStop(0.45, 'rgba(244,63,94,0.18)');
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.globalCompositeOperation = 'screen';
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
    } else if (activeEffect === 'glow') {
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      ctx.fillStyle = brandRgba(0.14);
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
    }

    // Overlay gradients
    overlayClips
      .filter((c) => t >= c.startTime && t <= c.startTime + (c.duration || 0))
      .forEach((c) => {
        ctx.save();
        const g = ctx.createLinearGradient(0, 0, W, H);
        const stops = c.gradientColors || ['rgba(168,85,247,0.4)', 'rgba(59,130,246,0.3)'];
        g.addColorStop(0, stops[0] || 'rgba(168,85,247,0.4)');
        g.addColorStop(1, stops[1] || 'rgba(59,130,246,0.3)');
        const rawOpacity = Number(c.opacity ?? 0.85);
        ctx.globalAlpha = rawOpacity > 1 ? rawOpacity / 100 : rawOpacity;
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, H);
        ctx.restore();
      });

    // Text overlays (real normalized coordinates & typography)
    textClips
      .filter((c) => t >= c.startTime && t <= c.startTime + (c.duration || 0))
      .forEach((c) => {
        ctx.save();
        const posX = ((c.position?.x ?? c.x ?? 50) / 100) * W;
        const posY = ((c.position?.y ?? c.y ?? 50) / 100) * H;
        const fontSize = Math.max(18, Math.round(((c.fontSize || 28) / 720) * H));
        const fontFamily = c.fontFamily || 'Plus Jakarta Sans, sans-serif';
        ctx.font = `700 ${fontSize}px ${fontFamily}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        const lines = String(c.text || c.title || 'Text').split('\n');
        const lineHeight = fontSize * 1.25;
        const maxWidth = Math.max(...lines.map((l) => ctx.measureText(l).width), 40);
        const boxW = maxWidth + fontSize * 1.1;
        const boxH = lines.length * lineHeight + fontSize * 0.45;

        if (c.bgColor && c.bgColor !== 'transparent') {
          ctx.fillStyle = c.bgColor;
          ctx.beginPath();
          if (typeof ctx.roundRect === 'function') {
            ctx.roundRect(posX - boxW / 2, posY - boxH / 2, boxW, boxH, 12);
          } else {
            ctx.rect(posX - boxW / 2, posY - boxH / 2, boxW, boxH);
          }
          ctx.fill();
        }

        ctx.shadowColor = 'rgba(0,0,0,0.85)';
        ctx.shadowBlur = 10;
        ctx.fillStyle = c.color || '#FFFFFF';
        const startY = posY - ((lines.length - 1) * lineHeight) / 2;
        lines.forEach((line, i) => {
          ctx.fillText(line, posX, startY + i * lineHeight);
        });
        ctx.restore();
      });

    // Sticker overlays (normalized coordinates & scale)
    stickerClips
      .filter((c) => t >= c.startTime && t <= c.startTime + (c.duration || 0))
      .forEach((c) => {
        ctx.save();
        const posX = ((c.position?.x ?? c.x ?? 50) / 100) * W;
        const posY = ((c.position?.y ?? c.y ?? 50) / 100) * H;
        const scale = Number(c.scale ?? 1);
        const sizePx = Math.round(Math.max(24, ((c.size || 48) / 720) * H * scale * 1.5));
        ctx.font = `${sizePx}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(c.emoji || c.sticker || c.text || '✨', posX, posY);
        ctx.restore();
      });
  };

  const handleStartExport = async () => {
    if (isExporting) return;
    cancelRef.current = false;
    setExportError(null);
    setExportComplete(false);
    if (exportedUrl && exportedUrl !== handedOffUrlRef.current) {
      URL.revokeObjectURL(exportedUrl);
    }
    setExportedUrl(null);
    setExportedBlob(null);

    if (total <= 0 || videoClips.length === 0) {
      setExportError('Nothing to render — add visible video clips to the timeline first.');
      return;
    }
    if (typeof MediaRecorder === 'undefined' || !HTMLCanvasElement.prototype.captureStream) {
      setExportError('This browser does not support canvas recording (MediaRecorder/captureStream). Use Chrome, Edge or Firefox.');
      return;
    }

    setIsExporting(true);
    setExportProgress(0);

    const W = selectedRes.width;
    const H = selectedRes.height;
    const fps = frameRate;
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');

    const clipEls = {};
    for (const c of videoClips) {
      const v = document.createElement('video');
      v.muted = true;
      v.playsInline = true;
      v.crossOrigin = 'anonymous';
      v.preload = 'auto';
      v.src = c.url;
      clipEls[c.id] = v;
      c._videoEl = v;
    }

    let audioCtx = null;
    let audioDest = null;
    const audioEntries = [];
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx && !isMuted) {
        audioCtx = new AudioCtx();
        audioDest = audioCtx.createMediaStreamDestination();
        const audibleClips = [...videoClips, ...audioClips].filter((c) => !c.trackMuted && !c.muted);
        for (const c of audibleClips) {
          const a = document.createElement('audio');
          a.src = c.url;
          a.crossOrigin = 'anonymous';
          a.preload = 'auto';
          const srcNode = audioCtx.createMediaElementSource(a);
          const gainNode = audioCtx.createGain();
          gainNode.gain.value = 0;
          srcNode.connect(gainNode);
          gainNode.connect(audioDest);
          audioEntries.push({ clip: c, el: a, gain: gainNode });
        }
      }
    } catch {
      audioCtx = null;
    }

    let stream;
    try {
      stream = canvas.captureStream(fps);
      if (audioDest) {
        audioDest.stream.getAudioTracks().forEach((tr) => stream.addTrack(tr));
      }
    } catch (err) {
      setIsExporting(false);
      setExportError('Could not start the recording stream: ' + err.message);
      return;
    }

    const mime = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
      ? 'video/webm;codecs=vp9'
      : 'video/webm';
    const bitrate = quality === 'ultra' ? 45_000_000 : quality === 'high' ? 24_000_000 : 12_000_000;
    let recorder;
    try {
      recorder = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: bitrate });
    } catch {
      recorder = new MediaRecorder(stream, { videoBitsPerSecond: bitrate });
    }

    const chunks = [];
    recorder.ondataavailable = (e) => { if (e.data && e.data.size > 0) chunks.push(e.data); };
    const recorded = new Promise((resolve) => {
      recorder.onstop = () => resolve(new Blob(chunks, { type: mime }));
    });
    recorder.start(200);

    try {
      await Promise.race([
        Promise.all(Object.values(clipEls).slice(0, 1).map((v) =>
          new Promise((res, rej) => {
            if (v.readyState >= 2) return res();
            v.addEventListener('loadedmetadata', res, { once: true });
            v.addEventListener('error', rej, { once: true });
          })
        )),
        sleep(8000),
      ]);
    } catch { /* fallback if clip fails metadata */ }

    const totalFrames = Math.max(1, Math.round(total * fps));
    const step = 1 / fps;
    if (audioCtx) await audioCtx.resume().catch(() => {});

    for (let frame = 0; frame < totalFrames; frame++) {
      if (cancelRef.current) break;
      const t = frame * step;

      // Keep active clip audio synced & gated per timeline window
      for (const entry of audioEntries) {
        const c = entry.clip;
        const speed = Number(c.speed) > 0 ? Number(c.speed) : 1;
        const active = t >= c.startTime && t <= c.startTime + (c.duration || 0);
        if (active) {
          const clipGain = Math.max(0, Math.min(1, volume * ((c.volume ?? 100) / 100)));
          entry.gain.gain.setValueAtTime(clipGain, audioCtx.currentTime);
          const targetAudioTime = Math.max(0, (t - (c.startTime || 0)) * speed + (c.trimStart || 0));
          if (Math.abs(entry.el.currentTime - targetAudioTime) > 0.25) {
            try { entry.el.currentTime = targetAudioTime; } catch { /* noop */ }
          }
          if (entry.el.paused) entry.el.play().catch(() => {});
        } else {
          entry.gain.gain.setValueAtTime(0, audioCtx.currentTime);
          if (!entry.el.paused) entry.el.pause();
        }
      }

      const active = videoClips.find((c) => t >= c.startTime && t <= c.startTime + (c.duration || 0));
      if (active) {
        const v = clipEls[active.id];
        const speed = Number(active.speed) > 0 ? Number(active.speed) : 1;
        if (v) {
          const target = Math.max(
            0,
            Math.min(
              Math.max(0, (v.duration || 0) - 0.05),
              (t - active.startTime) * speed + (active.trimStart || 0)
            )
          );
          try {
            if (Math.abs(v.currentTime - target) > 0.03) {
              v.currentTime = target;
              await new Promise((res) => {
                const onSeek = () => { v.removeEventListener('seeked', onSeek); res(); };
                v.addEventListener('seeked', onSeek);
                setTimeout(res, 400);
              });
            }
          } catch { /* frame skipped */ }
        }
      }

      drawFrame(ctx, W, H, t);
      setExportProgress(Math.min(100, Math.round((frame / totalFrames) * 100)));
      await sleep(0);
    }

    if (recorder.state !== 'inactive') {
      recorder.stop();
    }
    const blob = await recorded;
    Object.values(clipEls).forEach((v) => {
      try { v.removeAttribute('src'); v.load(); } catch { /* noop */ }
    });
    audioEntries.forEach(({ el }) => {
      try { el.pause(); el.removeAttribute('src'); el.load(); } catch { /* noop */ }
    });
    if (audioCtx) audioCtx.close().catch(() => {});

    if (cancelRef.current || blob.size === 0) {
      setIsExporting(false);
      setExportError(cancelRef.current ? 'Export cancelled.' : 'Recording produced an empty file.');
      return;
    }

    const url = URL.createObjectURL(blob);
    ownedUrlsRef.current.push(url);
    setExportedUrl(url);
    setExportedBlob(blob);
    setExportProgress(100);
    setIsExporting(false);
    setExportComplete(true);
  };

  const handleDownload = () => {
    if (!exportedUrl) return;
    const a = document.createElement('a');
    a.href = exportedUrl;
    a.download = `${(projectName || 'arvdoul_project').toLowerCase().replace(/[^a-z0-9]+/g, '_')}_rendered.webm`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const handleShareToFeed = () => {
    if (!exportedBlob) return;
    handedOffUrlRef.current = exportedUrl;
    const file = new File([exportedBlob], `${(projectName || 'arvdoul_project').toLowerCase().replace(/[^a-z0-9]+/g, '_')}.webm`, { type: 'video/webm' });
    onClose();
    navigate('/create-post', {
      state: {
        mediaType: 'video',
        videoFile: file,
        videoUrl: exportedUrl,
        title: projectName,
        duration: total,
        subType: 'spark',
      },
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl">
      <motion.div
        initial={{ opacity: 0, scale: 0.94, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.94, y: 15 }}
        className={`w-full max-w-xl rounded-3xl border shadow-2xl p-6 relative overflow-hidden ${
          isDark
            ? 'bg-gray-950/95 border-white/15 text-white'
            : 'bg-white border-gray-200 text-gray-900'
        }`}
      >
        {/* Glowing background ambient lights */}
        <div className="absolute -top-24 -left-24 w-60 h-60 bg-purple-600/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-60 h-60 bg-blue-600/20 rounded-full blur-3xl pointer-events-none" />

        {/* Modal Header */}
        <div className={`flex items-center justify-between pb-4 border-b relative z-10 ${isDark ? 'border-white/10' : 'border-gray-200'}`}>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-purple-600 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-purple-600/40">
              <Film className="w-5 h-5" />
            </div>
            <div>
              <h2 className={`text-base sm:text-lg font-bold tracking-wide ${isDark ? 'text-white' : 'text-gray-900'}`}>
                Export & Render Video
              </h2>
              <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                {projectName} • {Math.round(total)}s runtime • {videoClips.length} clip(s)
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            aria-label="Close"
            className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
              isDark ? 'bg-white/10 hover:bg-white/20 text-gray-300 hover:text-white' : 'bg-gray-100 hover:bg-gray-200 text-gray-600 hover:text-gray-900'
            }`}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body Content */}
        <div className="py-5 space-y-4 relative z-10">
          {!isExporting && !exportComplete ? (
            <>
              {/* Resolution Options */}
              <div>
                <label className={`text-xs font-semibold uppercase tracking-wider block mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                  Target Resolution & Aspect Ratio
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {RESOLUTION_PRESETS.map((res) => {
                    const isSelected = selectedRes.id === res.id;
                    return (
                      <button
                        key={res.id}
                        onClick={() => setSelectedRes(res)}
                        className={`p-2.5 rounded-2xl text-left transition-all border ${
                          isSelected
                            ? isDark
                              ? 'bg-purple-600/30 border-purple-500 text-white ring-1 ring-purple-400/50 shadow-md shadow-purple-500/20'
                              : 'bg-purple-50 border-purple-500 text-purple-950 ring-1 ring-purple-400/40 shadow-sm'
                            : isDark
                              ? 'bg-white/5 hover:bg-white/10 border-white/10 text-gray-300'
                              : 'bg-gray-50 hover:bg-gray-100 border-gray-200 text-gray-700'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold">{res.label}</span>
                          <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${isDark ? 'bg-black/40 text-purple-300' : 'bg-purple-100 text-purple-700'}`}>
                            {res.aspect}
                          </span>
                        </div>
                        <div className={`text-[10px] mt-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{res.width}x{res.height}</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Format & FPS */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={`text-xs font-semibold uppercase tracking-wider block mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                    Format
                  </label>
                  <div className={`flex items-center gap-1.5 p-1 rounded-xl border ${isDark ? 'bg-black/40 border-white/10' : 'bg-gray-100 border-gray-200'}`}>
                    {['webm', 'mp4', 'gif'].map((f) => (
                      <button
                        key={f}
                        onClick={() => setFormat(f)}
                        disabled={f !== 'webm'}
                        className={`flex-1 py-1.5 rounded-lg text-xs font-semibold uppercase transition-all ${
                          format === f
                            ? 'bg-purple-600 text-white shadow'
                            : isDark ? 'text-gray-400 hover:text-white' : 'text-gray-600 hover:text-gray-900'
                        } ${f !== 'webm' ? 'opacity-40 cursor-not-allowed' : ''}`}
                      >
                        {f}
                      </button>
                    ))}
                  </div>
                  <p className={`text-[10px] mt-1 ${isDark ? 'text-gray-500' : 'text-gray-600'}`}>
                    Client renderer outputs WebM. MP4/GIF need the server ffmpeg pipeline.
                  </p>
                </div>

                <div>
                  <label className={`text-xs font-semibold uppercase tracking-wider block mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                    Frame Rate (FPS)
                  </label>
                  <div className={`flex items-center gap-1.5 p-1 rounded-xl border ${isDark ? 'bg-black/40 border-white/10' : 'bg-gray-100 border-gray-200'}`}>
                    {[30, 24, 60].map((fps) => (
                      <button
                        key={fps}
                        onClick={() => setFrameRate(fps)}
                        disabled={fps === 60}
                        className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                          frameRate === fps
                            ? 'bg-purple-600 text-white shadow'
                            : isDark ? 'text-gray-400 hover:text-white' : 'text-gray-600 hover:text-gray-900'
                        } ${fps === 60 ? 'opacity-40 cursor-not-allowed' : ''}`}
                      >
                        {fps} fps
                      </button>
                    ))}
                  </div>
                  <p className={`text-[10px] mt-1 ${isDark ? 'text-gray-500' : 'text-gray-600'}`}>60 fps is unreliable in browsers — 30/24 recommended.</p>
                </div>
              </div>

              {/* Quality Preset */}
              <div>
                <label className={`text-xs font-semibold uppercase tracking-wider block mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                  Encoding Quality
                </label>
                <div className="flex items-center gap-2">
                  {[
                    { id: 'ultra', label: 'Maximum', bitrate: '45 Mbps' },
                    { id: 'high', label: 'High', bitrate: '24 Mbps' },
                    { id: 'medium', label: 'Balanced', bitrate: '12 Mbps' },
                  ].map((q) => (
                    <button
                      key={q.id}
                      onClick={() => setQuality(q.id)}
                      className={`flex-1 p-2 rounded-xl text-left border text-xs transition-all ${
                        quality === q.id
                          ? isDark
                            ? 'bg-indigo-600/30 border-indigo-500 text-white'
                            : 'bg-indigo-50 border-indigo-500 text-indigo-950'
                          : isDark
                            ? 'bg-white/5 border-white/5 text-gray-400 hover:text-white'
                            : 'bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      <div className="font-semibold">{q.label}</div>
                      <div className={`text-[10px] ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>{q.bitrate}</div>
                    </button>
                  ))}
                </div>
              </div>

              {exportError && (
                <div className="flex items-start gap-2 p-3 rounded-xl border border-amber-500/40 bg-amber-500/10 text-amber-500 text-xs">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{exportError}</span>
                </div>
              )}
            </>
          ) : isExporting ? (
            /* Progress Bar State — REAL frame-render progress */
            <div className="py-8 flex flex-col items-center justify-center space-y-4">
              <div className="relative w-24 h-24 flex items-center justify-center">
                <div className={`w-24 h-24 rounded-full border-4 border-t-purple-500 animate-spin ${isDark ? 'border-white/10' : 'border-gray-200'}`} />
                <span className={`absolute text-lg font-mono font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  {exportProgress}%
                </span>
              </div>
              <div className="text-center">
                <div className={`text-sm font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  Rendering {totalFramesDisplay(total, frameRate)} frames…
                </div>
                <p className={`text-xs mt-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                  Drawing every frame to canvas and recording with MediaRecorder — this takes roughly the runtime of the video.
                </p>
              </div>

              <div className={`w-full h-2 rounded-full overflow-hidden ${isDark ? 'bg-white/10' : 'bg-gray-200'}`}>
                <div
                  className="h-full bg-gradient-to-r from-purple-500 to-indigo-500 transition-all duration-200"
                  style={{ width: `${exportProgress}%` }}
                />
              </div>
              <button
                onClick={() => { cancelRef.current = true; }}
                className={`text-xs underline ${isDark ? 'text-gray-400 hover:text-white' : 'text-gray-600 hover:text-gray-900'}`}
              >
                Cancel render
              </button>
            </div>
          ) : (
            /* Export Completed State — real file */
            <div className="py-6 flex flex-col items-center justify-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-500 border border-emerald-500/40 flex items-center justify-center shadow-lg shadow-emerald-500/30">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <div className="text-center">
                <h3 className={`text-lg font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>Export Ready!</h3>
                <p className={`text-xs mt-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                  {exportedBlob ? `${(exportedBlob.size / 1024 / 1024).toFixed(1)} MB WebM — rendered from your actual clips.` : 'Rendered from your actual clips.'}
                </p>
              </div>

              <div className="w-full grid grid-cols-2 gap-3 pt-2">
                <button
                  onClick={handleDownload}
                  className={`flex items-center justify-center gap-2 py-3 px-4 rounded-2xl font-semibold text-xs transition-colors ${
                    isDark ? 'bg-white/10 hover:bg-white/20 text-white' : 'bg-gray-100 hover:bg-gray-200 text-gray-900'
                  }`}
                >
                  <Download className="w-4 h-4" />
                  <span>Download File</span>
                </button>

                <button
                  onClick={handleShareToFeed}
                  className="flex items-center justify-center gap-2 py-3 px-4 rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-semibold text-xs shadow-lg shadow-purple-600/30 transition-all"
                >
                  <Share2 className="w-4 h-4" />
                  <span>Post to Feed</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        {!isExporting && !exportComplete && (
          <div className={`pt-4 border-t flex items-center justify-between relative z-10 ${isDark ? 'border-white/10' : 'border-gray-200'}`}>
            <button
              onClick={onClose}
              className={`px-4 py-2 rounded-xl text-xs font-semibold ${isDark ? 'text-gray-400 hover:text-white' : 'text-gray-600 hover:text-gray-900'}`}
            >
              Cancel
            </button>

            <button
              onClick={handleStartExport}
              className="flex items-center gap-2 px-6 py-2.5 rounded-full bg-arvdoul-gradient hover:opacity-95 text-white text-xs font-bold shadow-lg shadow-purple-600/30 active:scale-95 transition-all"
            >
              <HardDrive className="w-4 h-4" />
              <span>Start Render</span>
            </button>
          </div>
        )}
      </motion.div>
    </div>
  );
}

function totalFramesDisplay(total, fps) {
  return Math.max(1, Math.round(total * fps)).toLocaleString();
}

ExportModal.propTypes = {
  isOpen: PropTypes.bool,
  onClose: PropTypes.func.isRequired,
  projectName: PropTypes.string,
  duration: PropTypes.number,
  currentResolution: PropTypes.object,
  tracks: PropTypes.array,
  filterId: PropTypes.string,
  adjustments: PropTypes.object,
  activeEffect: PropTypes.string,
  stabilizeMode: PropTypes.string,
  isMuted: PropTypes.bool,
  volume: PropTypes.number,
};
