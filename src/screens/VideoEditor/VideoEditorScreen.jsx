// src/screens/VideoEditor/VideoEditorScreen.jsx - ARVDOUL VIDEO EDITOR (FUNCTIONAL)
// Real browser video editor: loads a real video (from Firestore or URL),
// plays it, lets you trim the start/end, and EXPORTS a real webm file via
// canvas.captureStream + MediaRecorder. No fake progress, no demo shell.
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { useTheme } from '@context/ThemeContext';
import { getFirestoreInstance } from '../../firebase/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { cn } from '../../lib/utils';
import {
  ArrowLeft, Play, Pause, Scissors, Download, Loader2, Film,
  Volume2, VolumeX, RotateCcw
} from 'lucide-react';

export default function VideoEditorScreen() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const [videoUrl, setVideoUrl] = useState(null);
  const [videoMeta, setVideoMeta] = useState(null); // { id, title }
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(0);

  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const exportStreamRef = useRef(null);

  // ---------- Load the video ----------
  useEffect(() => {
    const videoId = searchParams.get('video');
    (async () => {
      try {
        let url = searchParams.get('url') || searchParams.get('src');
        let meta = { id: videoId, title: 'Video' };

        if (videoId) {
          const firestore = await getFirestoreInstance();
          const snap = await getDoc(doc(firestore, 'videos', videoId));
          if (snap.exists()) {
            const data = snap.data();
            url = url || data.playbackUrl || data.mediaUrl || data.url || data.muxPlaybackId
              ? (data.playbackUrl || data.mediaUrl || data.url || `https://stream.mux.com/${data.muxPlaybackId}.m3u8`)
              : null;
            meta = { id: videoId, title: data.title || 'Video' };
          }
        }

        if (!url) throw new Error('No video provided. Pass ?video=<id> or ?url=<src>.');
        setVideoUrl(url);
        setVideoMeta(meta);
      } catch (err) {
        setError(err?.message || 'Could not load the video.');
      } finally {
        setLoading(false);
      }
    })();
  }, [searchParams]);

  // ---------- Video element wiring ----------
  const handleLoadedMetadata = () => {
    const d = videoRef.current?.duration || 0;
    setDuration(d);
    setTrimStart(0);
    setTrimEnd(d);
  };

  const handleTimeUpdate = () => {
    const t = videoRef.current?.currentTime || 0;
    setCurrentTime(t);
    // Pause at trim end
    if (trimEnd > 0 && t >= trimEnd && isPlaying) {
      videoRef.current.pause();
      setIsPlaying(false);
    }
  };

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    // Seek to trim start if before it
    if (v.currentTime < trimStart) v.currentTime = trimStart;
    if (isPlaying) { v.pause(); setIsPlaying(false); }
    else { v.play(); setIsPlaying(true); }
  };

  const seekTo = (t) => {
    const v = videoRef.current;
    if (!v) return;
    const clamped = Math.max(trimStart, Math.min(trimEnd, t));
    v.currentTime = clamped;
    setCurrentTime(clamped);
  };

  // ---------- REAL EXPORT: canvas capture → MediaRecorder → webm download ----------
  const handleExport = async () => {
    const v = videoRef.current;
    if (!v || exporting) return;
    if (trimEnd - trimStart < 0.5) { toast.error('Trim must be at least 0.5s.'); return; }

    setExporting(true);
    setExportProgress(0);
    try {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      const W = 1280, H = 720;
      canvas.width = W; canvas.height = H;

      const stream = canvas.captureStream(30);
      exportStreamRef.current = stream;
      const mime = MediaRecorder.isTypeSupported('video/webm;codecs=vp9') ? 'video/webm;codecs=vp9' : 'video/webm';
      const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 4_000_000 });
      const chunks = [];
      rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);

      const done = new Promise((resolve) => {
        rec.onstop = () => resolve(new Blob(chunks, { type: mime }));
      });

      rec.start(200);

      // Render frames from trimStart → trimEnd
      const wasPlaying = !v.paused;
      v.pause();
      const start = trimStart;
      const end = trimEnd;
      const total = end - start;
      const step = 1 / 30;
      let t = start;

      const renderFrame = async () => {
        v.currentTime = t;
        await new Promise((r) => { const onSeek = () => { v.removeEventListener('seeked', onSeek); r(); }; v.addEventListener('seeked', onSeek); setTimeout(r, 1500); });
        ctx.drawImage(v, 0, 0, W, H);
        const p = (t - start) / total;
        setExportProgress(Math.min(0.95, p));
        t += step;
        if (t < end) requestAnimationFrame(renderFrame);
        else {
          rec.stop();
          const blob = await done;
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `${videoMeta?.title?.replace(/\W+/g, '_') || 'arvdoul'}_trim.webm`;
          a.click();
          setTimeout(() => URL.revokeObjectURL(url), 5000);
          setExportProgress(1);
          toast.success('Video exported! (webm)');
          if (wasPlaying) v.play();
          setExporting(false);
        }
      };

      renderFrame();
    } catch (err) {
      toast.error(err?.message || 'Export failed.');
      setExporting(false);
    }
  };

  const resetTrim = () => { setTrimStart(0); setTrimEnd(duration); };

  const fmt = (s) => {
    const m = Math.floor(s / 60), sec = Math.floor(s % 60);
    return `${m}:${String(sec).padStart(2, '0')}`;
  };

  const colors = {
    card: isDark ? 'bg-gray-900/80 border-gray-800' : 'bg-white/90 border-gray-200',
    text: isDark ? 'text-white' : 'text-gray-900',
    secondary: isDark ? 'text-gray-400' : 'text-gray-600',
  };

  return (
    <div className={cn(
      'min-h-screen flex flex-col',
      isDark ? 'bg-gradient-to-br from-[#060816] via-[#0b1220] to-[#02040a]' : 'bg-gradient-to-br from-[#f0f4fa] via-white to-[#eef2f8]'
    )}>
      {/* Header */}
      <div className={cn('sticky top-0 z-30 border-b backdrop-blur-xl', colors.card, 'border')}>
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-3">
          <button onClick={() => navigate(-1)} aria-label="Back" className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <Film className="w-5 h-5 text-violet-500" />
            <h1 className={cn('font-bold', colors.text)}>Video Editor</h1>
          </div>
          <span className={cn('text-xs ml-auto', colors.secondary)}>{videoMeta?.title}</span>
        </div>
      </div>

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 py-6">
        {loading ? (
          <div className="flex justify-center py-24"><Loader2 className="w-8 h-8 text-violet-500 animate-spin" /></div>
        ) : error ? (
          <div className="text-center py-24">
            <p className={cn('font-semibold mb-4', colors.text)}>{error}</p>
            <button onClick={() => navigate('/videos')} className="px-5 py-2 rounded-xl bg-violet-500 text-white font-semibold">
              Browse Videos
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Preview */}
            <div className={cn('relative rounded-2xl overflow-hidden border aspect-video bg-black', colors.card)}>
              <video
                ref={videoRef}
                src={videoUrl}
                muted={muted}
                playsInline
                preload="auto"
                onLoadedMetadata={handleLoadedMetadata}
                onTimeUpdate={handleTimeUpdate}
                onEnded={() => setIsPlaying(false)}
                className="w-full h-full object-contain"
              />
              {/* Hidden export canvas */}
              <canvas ref={canvasRef} className="hidden" />

              {/* Center play overlay */}
              <button
                onClick={togglePlay}
                aria-label={isPlaying ? 'Pause' : 'Play'}
                className="absolute inset-0 flex items-center justify-center group"
              >
                <div className={cn(
                  'w-16 h-16 rounded-full flex items-center justify-center backdrop-blur-md border transition-transform group-hover:scale-110',
                  isDark ? 'bg-white/10 border-white/20' : 'bg-black/20 border-white/40'
                )}>
                  {isPlaying ? <Pause className="w-7 h-7 text-white" /> : <Play className="w-7 h-7 text-white ml-1" />}
                </div>
              </button>

              {/* Top-right mute */}
              <button
                onClick={() => setMuted((m) => !m)}
                aria-label={muted ? 'Unmute' : 'Mute'}
                className="absolute top-3 right-3 p-2 rounded-full bg-black/50 backdrop-blur text-white"
              >
                {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              </button>

              {/* Time badge */}
              <div className="absolute bottom-3 left-3 px-2.5 py-1 rounded-lg bg-black/60 backdrop-blur text-white text-xs font-semibold">
                {fmt(currentTime)} / {fmt(duration)}
              </div>
            </div>

            {/* Transport */}
            <div className={cn('rounded-2xl p-4 border', colors.card)}>
              <input
                type="range"
                min={0}
                max={duration || 1}
                step={0.01}
                value={currentTime}
                onChange={(e) => seekTo(+e.target.value)}
                className="w-full accent-violet-500"
                aria-label="Seek"
              />
              <div className="flex justify-between text-xs mt-1">
                <span className={cn('font-mono', colors.secondary)}>{fmt(currentTime)}</span>
                <span className={cn('font-mono', colors.secondary)}>{fmt(duration)}</span>
              </div>
            </div>

            {/* Trim */}
            <div className={cn('rounded-2xl p-5 border', colors.card)}>
              <div className="flex items-center justify-between mb-4">
                <h2 className={cn('font-semibold flex items-center gap-2', colors.text)}>
                  <Scissors className="w-4 h-4 text-violet-500" /> Trim
                </h2>
                <button onClick={resetTrim} className={cn('flex items-center gap-1 text-xs font-medium hover:opacity-80', colors.secondary)}>
                  <RotateCcw className="w-3.5 h-3.5" /> Reset
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className={cn('font-medium', colors.secondary)}>Start</span>
                    <span className={cn('font-mono font-semibold', colors.text)}>{fmt(trimStart)}</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={duration || 1}
                    step={0.1}
                    value={trimStart}
                    onChange={(e) => setTrimStart(Math.min(+e.target.value, trimEnd - 0.5))}
                    className="w-full accent-emerald-500"
                    aria-label="Trim start"
                  />
                </div>
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className={cn('font-medium', colors.secondary)}>End</span>
                    <span className={cn('font-mono font-semibold', colors.text)}>{fmt(trimEnd)}</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={duration || 1}
                    step={0.1}
                    value={trimEnd}
                    onChange={(e) => setTrimEnd(Math.max(+e.target.value, trimStart + 0.5))}
                    className="w-full accent-rose-500"
                    aria-label="Trim end"
                  />
                </div>
                <p className={cn('text-xs', colors.secondary)}>
                  Selected segment: <span className="font-mono font-semibold text-violet-500">{fmt(trimEnd - trimStart)}</span>
                </p>
              </div>
            </div>

            {/* Export */}
            <div className={cn('rounded-2xl p-5 border', colors.card)}>
              <button
                onClick={handleExport}
                disabled={exporting}
                className={cn(
                  'w-full py-3.5 rounded-xl font-bold flex items-center justify-center gap-2 transition disabled:opacity-50',
                  'bg-gradient-to-r from-violet-500 to-cyan-500 text-white'
                )}
              >
                {exporting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Download className="w-5 h-5" />}
                {exporting ? 'Exporting…' : 'Export Trimmed Video (webm)'}
              </button>
              {exporting && (
                <div className="mt-3">
                  <div className="h-2 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-violet-500 to-cyan-500 transition-all" style={{ width: `${exportProgress * 100}%` }} />
                  </div>
                  <p className={cn('text-xs mt-1 text-center font-mono', colors.secondary)}>{Math.round(exportProgress * 100)}%</p>
                </div>
              )}
              <p className={cn('text-xs mt-3 text-center', colors.secondary)}>
                Exports the trimmed segment as a real WebM file — processed entirely in your browser.
              </p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
