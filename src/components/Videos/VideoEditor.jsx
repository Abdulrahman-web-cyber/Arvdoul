// src/components/Videos/VideoEditor.jsx - ARVDOUL VIDEO EDITOR
// Video editing capabilities with trim, filters, text, music

import React, { useState, useRef, useCallback, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Scissors,
  Sparkles,
  Type,
  Music,
  Mic,
  Gauge,
  Image,
  Calendar,
  Check,
  RotateCcw,
  Play,
  Pause,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { SPRING_ANIMATION, formatDuration } from '../../utils/videoUtils';
import { toast } from 'sonner';
import PropTypes from 'prop-types';

/**
 * VideoEditor - Video editing interface with trim, filters, text, music
 */
const VideoEditor = memo(({
  videoFile,
  onSave,
  onCancel,
  maxDuration = 90,
}) => {
  const { theme, isDark } = useTheme();
  const videoRef = useRef(null);
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
  const [coverFrame, setCoverFrame] = useState(null);
  const [scheduleDate, setScheduleDate] = useState(null);

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

  // Handle video time update
  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
    }
  };

  // Handle loaded metadata
  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
      setTrimEnd(Math.min(videoRef.current.duration, maxDuration));
    }
  };

  // Toggle play/pause
  const togglePlay = () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
    } else {
      videoRef.current.play();
    }
    setIsPlaying(!isPlaying);
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
    setTextOverlays([...textOverlays, newText]);
  };

  // Remove text overlay
  const removeTextOverlay = (id) => {
    setTextOverlays(textOverlays.filter((t) => t.id !== id));
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
    toast.success('Video saved!');
  };

  // Get current filter CSS
  const currentFilter = filters.find((f) => f.id === filter)?.css || '';

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black flex flex-col"
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-white/10">
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={onCancel}
          className="p-2 rounded-full bg-white/10"
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
      <div className="flex-1 relative flex items-center justify-center bg-black">
        {videoFile ? (
          <video
            ref={videoRef}
            src={URL.createObjectURL(videoFile)}
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
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={togglePlay}
          className="absolute inset-0 flex items-center justify-center pointer-events-none"
        >
          <div className="w-20 h-20 rounded-full bg-black/50 backdrop-blur-md flex items-center justify-center">
            {isPlaying ? (
              <Pause className="w-10 h-10 text-white fill-white" />
            ) : (
              <Play className="w-10 h-10 text-white fill-white ml-1" />
            )}
          </div>
        </motion.button>

        {/* Text Overlays Preview */}
        {textOverlays.map((overlay) => (
          <div
            key={overlay.id}
            className="absolute cursor-move"
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
                type="range"
                min={0}
                max={duration || maxDuration}
                value={trimStart}
                onChange={(e) => setTrimStart(Math.min(parseFloat(e.target.value), trimEnd - 1))}
                className="absolute inset-0 w-full opacity-0 cursor-pointer"
              />
              <input
                type="range"
                min={0}
                max={duration || maxDuration}
                value={trimEnd}
                onChange={(e) => setTrimEnd(Math.max(parseFloat(e.target.value), trimStart + 1))}
                className="absolute inset-0 w-full opacity-0 cursor-pointer"
              />
              {/* Trim Handles */}
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
                  type="text"
                  value={overlay.text}
                  onChange={(e) => setTextOverlays(textOverlays.map((t) => t.id === overlay.id ? { ...t, text: e.target.value } : t))}
                  className="flex-1 bg-transparent text-white border-b border-white/20 focus:outline-none"
                />
                <input
                  type="color"
                  value={overlay.color}
                  onChange={(e) => setTextOverlays(textOverlays.map((t) => t.id === overlay.id ? { ...t, color: e.target.value } : t))}
                  className="w-8 h-8 rounded cursor-pointer"
                />
                <button
                  onClick={() => removeTextOverlay(overlay.id)}
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
          {[1, 2, 3].map((i) => (
            <motion.button
              key={i}
              whileTap={{ scale: 0.95 }}
              onClick={() => setSelectedTrack(i)}
              className={`w-full p-4 rounded-xl flex items-center gap-4 transition-colors ${
                selectedTrack === i
                  ? 'bg-purple-500/20 border-2 border-purple-500'
                  : 'bg-white/5 border-2 border-transparent'
              }`}
            >
              <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                <Music className="w-6 h-6 text-white" />
              </div>
              <div className="flex-1 text-left">
                <p className="text-white font-medium">Track {i}</p>
                <p className="text-white/50 text-sm">Artist Name</p>
              </div>
              {selectedTrack === i && <Check className="w-5 h-5 text-purple-400" />}
            </motion.button>
          ))}
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
          <p className="text-white/60 text-sm mb-3">Select a frame as your video cover</p>
          <div className="grid grid-cols-4 gap-2">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
              <motion.button
                key={i}
                whileTap={{ scale: 0.95 }}
                onClick={() => setCoverFrame(i)}
                className={`aspect-video rounded-lg bg-white/10 border-2 overflow-hidden ${
                  coverFrame === i ? 'border-purple-500' : 'border-transparent'
                }`}
              >
                <div className="w-full h-full flex items-center justify-center text-white/30 text-xs">
                  {i}s
                </div>
              </motion.button>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'schedule' && (
        <div className="px-4 pb-4 space-y-4">
          <p className="text-white/60 text-sm">Choose when to publish your video</p>
          <input
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
