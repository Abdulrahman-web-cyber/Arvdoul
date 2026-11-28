// src/components/Videos/VideoEditor.jsx
//
// Video editing capabilities with trim, filters, text, music

import { useState, useRef, useEffect, memo } from "react";
import { motion } from "framer-motion";
import { X, Scissors, Sparkles, Type, Music, Gauge, Image, Calendar, Check, Play, Pause, Upload, Trash2 } from "lucide-react";
import { useTheme } from '../../context/ThemeContext';
import { formatDuration } from "../../utils/videoUtils";
import { toast } from 'sonner';
import PropTypes from 'prop-types';
import { LazyImage } from '../Shared/LazyImage';

/**
 * VideoEditor - Video editing interface with trim, filters, text, music
 */
const VideoEditor = memo(({
  videoFile,
  onSave,
  onCancel,
  maxDuration = 90,
}) => {
  const { isDark } = useTheme();
  const videoRef = useRef(null);
  const audioInputRef = useRef(null);
  const [videoUrl, setVideoUrl] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  // Editing states
  const [activeTab, setActiveTab] = useState('trim');
  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(maxDuration);
  const [filter, setFilter] = useState('none');
  const [textOverlays, setTextOverlays] = useState([]);
  const [selectedTrack, setSelectedTrack] = useState(null);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [coverFrames, setCoverFrames] = useState([]);
  const [coverFrame, setCoverFrame] = useState(null);
  const [scheduleDate, setScheduleDate] = useState(null);

  // Create and cleanly revoke object URL for videoFile
  useEffect(() => {
    if (!videoFile) {
      setVideoUrl(null);
      return;
    }
    const url = URL.createObjectURL(videoFile);
    setVideoUrl(url);
    return () => {
      URL.revokeObjectURL(url);
    };
  }, [videoFile]);

  // Revoke selected custom audio URL on change/unmount
  useEffect(() => {
    return () => {
      if (selectedTrack?.url) URL.revokeObjectURL(selectedTrack.url);
    };
  }, [selectedTrack?.url]);

  // Apply playback speed cleanly
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.playbackRate = playbackSpeed;
    }
  }, [playbackSpeed]);

  // Capture real cover frame thumbnails from videoUrl
  useEffect(() => {
    if (!videoUrl || typeof document === 'undefined') {
      setCoverFrames([]);
      return;
    }
    let cancelled = false;
    const probe = document.createElement('video');
    probe.muted = true;
    probe.playsInline = true;
    probe.preload = 'metadata';
    probe.src = videoUrl;

    const extract = async () => {
      try {
        await new Promise((res, rej) => {
          if (probe.readyState >= 1) return res();
          probe.addEventListener('loadedmetadata', res, { once: true });
          probe.addEventListener('error', rej, { once: true });
        });
        const totalDur = Number.isFinite(probe.duration) && probe.duration > 0 ? probe.duration : 0;
        if (!totalDur || cancelled) return;
        const count = 6;
        const frames = [];
        for (let i = 0; i < count; i++) {
          if (cancelled) break;
          const timeSec = Number((((i + 0.5) / count) * totalDur).toFixed(2));
          probe.currentTime = timeSec;
          await new Promise((res) => {
            const done = () => { probe.removeEventListener('seeked', done); res(); };
            probe.addEventListener('seeked', done);
            setTimeout(res, 500);
          });
          if (probe.videoWidth > 0 && probe.videoHeight > 0) {
            const w = 160;
            const h = Math.max(1, Math.round((probe.videoHeight / probe.videoWidth) * w));
            const canvas = document.createElement('canvas');
            canvas.width = w;
            canvas.height = h;
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.drawImage(probe, 0, 0, w, h);
              frames.push({ timeSec, dataUrl: canvas.toDataURL('image/jpeg', 0.72) });
            }
          }
        }
        if (!cancelled) setCoverFrames(frames);
      } catch (err) {
        console.warn('[VideoEditor] Failed to extract cover frames:', err?.message || err);
        if (!cancelled) setCoverFrames([]);
      } finally {
        try { probe.removeAttribute('src'); probe.load(); } catch { /* noop */ }
      }
    };

    void extract();
    return () => {
      cancelled = true;
      try { probe.removeAttribute('src'); probe.load(); } catch { /* noop */ }
    };
  }, [videoUrl]);

  // Filter options
  const filters = [
    { id: 'none', name: 'Original', css: '' },
    { id: 'vintage', name: 'Vintage', css: 'sepia(0.4) contrast(1.1) brightness(0.9)' },
    { id: 'bw', name: 'B&W', css: 'grayscale(1) contrast(1.1)' },
    { id: 'warm', name: 'Warm', css: 'sepia(0.3) saturate(1.3) brightness(1.05)' },
    { id: 'cool', name: 'Cool', css: 'saturate(0.9) hue-rotate(20deg) brightness(1.05)' },
    { id: 'cinematic', name: 'Cinematic', css: 'contrast(1.15) brightness(0.95) saturate(0.9) hue-rotate(-5deg)' },
  ];

  // Speed options
  const speedOptions = [
    { value: 0.25, label: '0.25x' },
    { value: 0.5, label: '0.5x' },
    { value: 1, label: '1x' },
    { value: 1.5, label: '1.5x' },
    { value: 2, label: '2x' },
  ];

  // Tabs
  const tabs = [
    { id: 'trim', icon: Scissors, label: 'Trim' },
    { id: 'filter', icon: Sparkles, label: 'Filter' },
    { id: 'text', icon: Type, label: 'Text' },
    { id: 'music', icon: Music, label: 'Music' },
    { id: 'speed', icon: Gauge, label: 'Speed' },
    { id: 'cover', icon: Image, label: 'Cover' },
    { id: 'schedule', icon: Calendar, label: 'Schedule' },
  ];

  // Handle video time update and enforce trim loop window
  const handleTimeUpdate = () => {
    const v = videoRef.current;
    if (!v) return;
    if (trimEnd > trimStart && v.currentTime >= trimEnd) {
      v.currentTime = trimStart;
      if (isPlaying) {
        v.pause();
        setIsPlaying(false);
      }
    }
    setCurrentTime(v.currentTime);
  };

  // Handle loaded metadata
  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      const dur = videoRef.current.duration || 0;
      setDuration(dur);
      setTrimEnd(Math.min(dur || maxDuration, maxDuration));
      videoRef.current.playbackRate = playbackSpeed;
    }
  };

  // Toggle play/pause
  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (isPlaying) {
      v.pause();
      setIsPlaying(false);
    } else {
      if (v.currentTime < trimStart || v.currentTime >= trimEnd) {
        v.currentTime = trimStart;
      }
      v.playbackRate = playbackSpeed;
      v.play().catch(() => {});
      setIsPlaying(true);
    }
  };

  // Add text overlay
  const addTextOverlay = () => {
    const newText = {
      id: Date.now(),
      text: 'Your text here',
      x: 50,
      y: 50,
      fontSize: 24,
      color: '#ffffff',
      fontFamily: 'Inter',
    };
    setTextOverlays((prev) => [...prev, newText]);
  };

  // Remove text overlay
  const removeTextOverlay = (id) => {
    setTextOverlays((prev) => prev.filter((t) => t.id !== id));
  };

  const handleSelectAudioFile = (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const url = URL.createObjectURL(file);
    setSelectedTrack({
      name: file.name,
      size: file.size,
      type: file.type,
      url,
      file,
    });
    toast.success(`Selected audio: ${file.name}`);
  };

  // Handle save
  const handleSave = () => {
    const editedVideo = {
      originalFile: videoFile,
      trimStart,
      trimEnd,
      filter,
      textOverlays,
      audioTrack: selectedTrack,
      playbackSpeed,
      coverFrame,
      scheduleDate,
    };
    onSave?.(editedVideo);
    toast.success('Video edits saved!');
  };

  // Get current filter CSS
  const currentFilter = filters.find((f) => f.id === filter)?.css || '';

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className={`fixed inset-0 z-50 flex flex-col ${isDark ? 'bg-black text-white' : 'bg-slate-950 text-white'}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-white/10">
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={onCancel}
          aria-label="Cancel editing"
          className="p-2 rounded-full bg-white/10 hover:bg-white/20"
        >
          <X className="w-6 h-6 text-white" />
        </motion.button>

        <h1 className="text-white font-bold text-lg">Edit Video</h1>

        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={handleSave}
          className="px-4 py-2 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 text-white font-semibold flex items-center gap-2"
        >
          <Check className="w-4 h-4" />
          Save
        </motion.button>
      </div>

      {/* Video Preview */}
      <div
        role="button"
        tabIndex={0}
        aria-label={isPlaying ? 'Pause video' : 'Play video'}
        onClick={togglePlay}
        onKeyDown={(e) => {
          if (e.key === ' ' || e.key === 'Enter') {
            e.preventDefault();
            togglePlay();
          }
        }}
        className="flex-1 relative flex items-center justify-center bg-black cursor-pointer"
      >
        {videoUrl ? (
          <video
            ref={videoRef}
            src={videoUrl}
            playsInline
            className="max-w-full max-h-full object-contain"
            style={{ filter: currentFilter }}
            onTimeUpdate={handleTimeUpdate}
            onLoadedMetadata={handleLoadedMetadata}
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
            onEnded={() => setIsPlaying(false)}
          />
        ) : (
          <div className="text-white/50">No video selected</div>
        )}

        {/* Play/Pause Overlay */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className={`w-16 h-16 rounded-full bg-black/50 backdrop-blur-md flex items-center justify-center transition-opacity ${isPlaying ? 'opacity-0 hover:opacity-100' : 'opacity-100'}`}>
            {isPlaying ? (
              <Pause className="w-8 h-8 text-white fill-white" />
            ) : (
              <Play className="w-8 h-8 text-white fill-white ml-1" />
            )}
          </div>
        </div>

        {/* Text Overlays Preview */}
        {textOverlays.map((overlay) => (
          <div
            key={overlay.id}
            className="absolute pointer-events-none font-bold drop-shadow"
            style={{
              left: `${overlay.x}%`,
              top: `${overlay.y}%`,
              transform: 'translate(-50%, -50%)',
              color: overlay.color,
              fontSize: `${overlay.fontSize}px`,
              fontFamily: overlay.fontFamily,
            }}
          >
            {overlay.text}
          </div>
        ))}
      </div>

      {/* Time Display */}
      <div className="px-4 py-2 flex items-center justify-between text-white/80 text-sm">
        <span>{formatDuration(currentTime)}</span>
        <span>/</span>
        <span>{formatDuration(duration || maxDuration)}</span>
      </div>

      {/* Trim Slider */}
      {activeTab === 'trim' && (
        <div className="px-4 pb-4">
          <div className="relative h-12 bg-white/10 rounded-full overflow-hidden">
            <div className="absolute inset-0 flex items-center">
              <div
                className="absolute h-full bg-purple-500/30"
                style={{ left: `${(trimStart / (duration || maxDuration)) * 100}%`, width: `${((trimEnd - trimStart) / (duration || maxDuration)) * 100}%` }}
              />
              <input
                aria-label="Trim start"
                type="range"
                min={0}
                max={duration || maxDuration}
                step={0.1}
                value={trimStart}
                onChange={(e) => setTrimStart(Math.min(parseFloat(e.target.value), trimEnd - 1))}
                className="absolute inset-0 w-full opacity-0 cursor-pointer"
              />
              <input
                aria-label="Trim end"
                type="range"
                min={0}
                max={duration || maxDuration}
                step={0.1}
                value={trimEnd}
                onChange={(e) => setTrimEnd(Math.max(parseFloat(e.target.value), trimStart + 1))}
                className="absolute inset-0 w-full opacity-0 cursor-pointer"
              />
              <div
                className="absolute top-0 bottom-0 w-1 bg-white cursor-ew-resize"
                style={{ left: `${(trimStart / (duration || maxDuration)) * 100}%` }}
              />
              <div
                className="absolute top-0 bottom-0 w-1 bg-white cursor-ew-resize"
                style={{ left: `${(trimEnd / (duration || maxDuration)) * 100}%` }}
              />
            </div>
          </div>
          <div className="flex justify-between mt-2 text-white/60 text-xs">
            <span>Start: {formatDuration(trimStart)}</span>
            <span>Duration: {formatDuration(trimEnd - trimStart)}</span>
            <span>End: {formatDuration(trimEnd)}</span>
          </div>
        </div>
      )}

      {/* Tab Content */}
      {activeTab === 'filter' && (
        <div className="px-4 pb-4 grid grid-cols-3 gap-3">
          {filters.map((f) => (
            <motion.button
              key={f.id}
              whileTap={{ scale: 0.95 }}
              onClick={() => setFilter(f.id)}
              className={`p-3 rounded-xl border-2 transition-colors ${
                filter === f.id
                  ? 'border-purple-500 bg-purple-500/20'
                  : 'border-white/10 bg-white/5'
              }`}
            >
              <div className="aspect-video rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 mb-2" style={{ filter: f.css }} />
              <span className="text-white text-xs">{f.name}</span>
            </motion.button>
          ))}
        </div>
      )}

      {activeTab === 'text' && (
        <div className="px-4 pb-4 space-y-4">
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={addTextOverlay}
            className="w-full p-4 rounded-xl border-2 border-dashed border-white/20 text-white/80 flex items-center justify-center gap-2"
          >
            <Type className="w-5 h-5" />
            Add Text
          </motion.button>
          <div className="space-y-2">
            {textOverlays.map((overlay) => (
              <div key={overlay.id} className="flex items-center gap-3 p-3 rounded-xl bg-white/5">
                <input
                  aria-label="Overlay text"
                  type="text"
                  value={overlay.text}
                  onChange={(e) => setTextOverlays(textOverlays.map((t) => t.id === overlay.id ? { ...t, text: e.target.value } : t))}
                  className="flex-1 bg-transparent text-white border-b border-white/20 focus:outline-none"
                />
                <input
                  aria-label="Text color"
                  type="color"
                  value={overlay.color}
                  onChange={(e) => setTextOverlays(textOverlays.map((t) => t.id === overlay.id ? { ...t, color: e.target.value } : t))}
                  className="w-8 h-8 rounded cursor-pointer"
                />
                <button
                  onClick={() => removeTextOverlay(overlay.id)}
                  aria-label="Remove text overlay"
                  className="text-red-400"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'music' && (
        <div className="px-4 pb-4 space-y-3">
          <input
            ref={audioInputRef}
            aria-label="Upload audio track"
            type="file"
            accept="audio/*"
            onChange={handleSelectAudioFile}
            className="hidden"
          />
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={() => audioInputRef.current?.click()}
            className="w-full p-4 rounded-xl border-2 border-dashed border-white/20 hover:border-purple-400 text-white/80 flex items-center justify-center gap-2"
          >
            <Upload className="w-5 h-5 text-purple-400" />
            <span>Import Audio Track From Device</span>
          </motion.button>

          {selectedTrack ? (
            <div className="p-3.5 rounded-xl bg-purple-500/15 border border-purple-500/40 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shrink-0">
                  <Music className="w-5 h-5 text-white" />
                </div>
                <div className="min-w-0">
                  <p className="text-white text-sm font-medium truncate">{selectedTrack.name}</p>
                  <p className="text-white/60 text-xs">{(selectedTrack.size / 1024 / 1024).toFixed(2)} MB</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedTrack(null)}
                aria-label="Remove audio track"
                className="p-2 rounded-lg text-rose-400 hover:bg-rose-500/10"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <p className="text-xs text-white/50 text-center">No external audio track attached.</p>
          )}
        </div>
      )}

      {activeTab === 'speed' && (
        <div className="px-4 pb-4 grid grid-cols-5 gap-2">
          {speedOptions.map((opt) => (
            <motion.button
              key={opt.value}
              whileTap={{ scale: 0.95 }}
              onClick={() => setPlaybackSpeed(opt.value)}
              className={`p-3 rounded-xl text-center transition-colors ${
                playbackSpeed === opt.value
                  ? 'bg-purple-500 text-white'
                  : 'bg-white/10 text-white/80'
              }`}
            >
              {opt.label}
            </motion.button>
          ))}
        </div>
      )}

      {activeTab === 'cover' && (
        <div className="px-4 pb-4">
          <p className="text-white/60 text-sm mb-3">Select a real video frame as your cover</p>
          {coverFrames.length > 0 ? (
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
              {coverFrames.map((frame) => (
                <motion.button
                  key={frame.timeSec}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setCoverFrame(frame)}
                  className={`relative aspect-video rounded-lg bg-white/10 border-2 overflow-hidden ${
                    coverFrame?.timeSec === frame.timeSec ? 'border-purple-500' : 'border-transparent'
                  }`}
                >
                  <LazyImage src={frame.dataUrl} alt={`Frame at ${frame.timeSec}s`} className="w-full h-full object-cover" />
                  <span className="absolute bottom-1 right-1 px-1 py-0.5 rounded bg-black/70 text-[10px] text-white font-mono">
                    {formatDuration(frame.timeSec)}
                  </span>
                </motion.button>
              ))}
            </div>
          ) : (
            <div className="p-4 rounded-xl bg-white/5 text-white/50 text-xs text-center">
              Load a video clip to extract cover thumbnails.
            </div>
          )}
        </div>
      )}

      {activeTab === 'schedule' && (
        <div className="px-4 pb-4 space-y-4">
          <p className="text-white/60 text-sm">Choose when to publish your video</p>
          <input
            aria-label="Choose when to publish your video"
            type="datetime-local"
            value={scheduleDate || ''}
            onChange={(e) => setScheduleDate(e.target.value)}
            className="w-full p-4 rounded-xl bg-white/10 text-white border border-white/10 focus:outline-none focus:border-purple-500"
          />
          {scheduleDate && (
            <p className="text-white/50 text-sm">
              Will be published on {new Date(scheduleDate).toLocaleString()}
            </p>
          )}
        </div>
      )}

      {/* Bottom Navigation */}
      <div className="flex border-t border-white/10 bg-black/90 backdrop-blur-xl">
        {tabs.map((tab) => (
          <motion.button
            key={tab.id}
            whileTap={{ scale: 0.95 }}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 flex flex-col items-center gap-1 py-3 transition-colors ${
              activeTab === tab.id ? 'text-purple-400' : 'text-white/50'
            }`}
          >
            <tab.icon className="w-5 h-5" />
            <span className="text-xs">{tab.label}</span>
          </motion.button>
        ))}
      </div>
    </motion.div>
  );
});

VideoEditor.displayName = 'VideoEditor';

VideoEditor.propTypes = {
  videoFile: PropTypes.object,
  onSave: PropTypes.func,
  onCancel: PropTypes.func,
  maxDuration: PropTypes.number,
};

export default VideoEditor;
