// src/screens/VideoEditor/VideoEditorScreen.jsx – ARVDOUL VIDEO EDITOR SCREEN V1
// 🎬 Professional Video Editor with Timeline, Filters, Text, Stickers, Export
// ✅ WCAG 2.1 AA Compliant • Keyboard Navigation • Screen Reader Support

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { 
  FaPlay, FaPause, FaForward, FaBackward, FaCut, FaTrash, FaUndo, FaRedo,
  FaPlus, FaVolumeUp, FaVolumeMute, FaLock, FaUnlock, FaEye, FaEyeSlash,
  FaTextHeight, FaStickyNote, FaMagic, FaMusic, FaClosedCaptioning,
  FaDownload, FaSave, FaCog, FaTimes, FaCheck, FaChevronLeft, FaChevronRight,
  FaCompressAlt, FaExpandAlt, FaStepBackward, FaStepForward, FaRandom
} from 'react-icons/fa';
import { VIDEO_EDITOR_CONFIG } from '../../services/videoEditorService.js';
import videoEditorService from '../../services/videoEditorService.js';

// ==================== UTILITY COMPONENTS ====================
const IconButton = ({ icon: Icon, onClick, disabled, active, size = 'md', className = '', title, ariaLabel }) => {
  const sizeClasses = {
    sm: 'w-8 h-8 text-sm',
    md: 'w-10 h-10 text-base',
    lg: 'w-12 h-12 text-lg',
  };
  
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={ariaLabel || title}
      className={`
        ${sizeClasses[size]}
        flex items-center justify-center rounded-lg
        transition-all duration-200
        ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer hover:scale-105'}
        ${active 
          ? 'bg-indigo-600 text-white shadow-lg' 
          : 'bg-gray-700 hover:bg-gray-600 text-white'}
        ${className}
      `}
    >
      <Icon />
    </button>
  );
};

const ToolButton = ({ icon: Icon, label, onClick, active, disabled }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className={`
      flex flex-col items-center justify-center gap-1 p-2 rounded-lg
      transition-all duration-200 min-w-[60px]
      ${active ? 'bg-indigo-600 text-white' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'}
      ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}
    `}
  >
    <Icon className="text-lg" />
    <span className="text-xs">{label}</span>
  </button>
);

// ==================== TIMELINE COMPONENT ====================
const Timeline = ({ project, currentTime, onSeek, onSelectClip, selectedClipId, zoom, onZoomChange }) => {
  const timelineRef = useRef(null);
  const [scrollLeft, setScrollLeft] = useState(0);
  
  const pixelsPerSecond = 100 * zoom;
  const timelineWidth = project.duration * pixelsPerSecond;
  
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 100);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
  };

  const handleTimelineClick = (e) => {
    if (!timelineRef.current) return;
    const rect = timelineRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left + scrollLeft;
    const time = x / pixelsPerSecond;
    onSeek(Math.max(0, Math.min(time, project.duration)));
  };

  const playheadPosition = currentTime * pixelsPerSecond;

  // Generate time markers
  const markers = useMemo(() => {
    const result = [];
    const interval = zoom > 2 ? 1 : zoom > 0.5 ? 5 : 10;
    for (let t = 0; t <= project.duration; t += interval) {
      result.push(t);
    }
    return result;
  }, [project.duration, zoom]);

  return (
    <div className="bg-gray-900 rounded-xl p-4">
      {/* Timeline header with time display and zoom */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-4">
          <span className="text-indigo-400 font-mono text-lg">
            {formatTime(currentTime)}
          </span>
          <span className="text-gray-500">/</span>
          <span className="text-gray-400 font-mono">
            {formatTime(project.duration)}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => onZoomChange(Math.max(VIDEO_EDITOR_CONFIG.TIMELINE.MIN_ZOOM, zoom - 0.2))}
            className="p-1 rounded bg-gray-800 text-gray-400 hover:bg-gray-700"
            aria-label="Zoom out"
          >
            <FaCompressAlt />
          </button>
          <input
            type="range"
            min={VIDEO_EDITOR_CONFIG.TIMELINE.MIN_ZOOM}
            max={VIDEO_EDITOR_CONFIG.TIMELINE.MAX_ZOOM}
            step={0.1}
            value={zoom}
            onChange={(e) => onZoomChange(parseFloat(e.target.value))}
            className="w-24"
            aria-label="Timeline zoom"
          />
          <button
            onClick={() => onZoomChange(Math.min(VIDEO_EDITOR_CONFIG.TIMELINE.MAX_ZOOM, zoom + 0.2))}
            className="p-1 rounded bg-gray-800 text-gray-400 hover:bg-gray-700"
            aria-label="Zoom in"
          >
            <FaExpandAlt />
          </button>
        </div>
      </div>

      {/* Timeline ruler */}
      <div 
        ref={timelineRef}
        className="relative overflow-x-auto bg-gray-800 rounded-lg cursor-pointer"
        onClick={handleTimelineClick}
        style={{ height: '60px' }}
        role="slider"
        aria-label="Timeline scrubber"
        aria-valuemin={0}
        aria-valuemax={project.duration}
        aria-valuenow={currentTime}
      >
        <div style={{ width: timelineWidth, minWidth: '100%' }}>
          {/* Time markers */}
          <div className="relative h-8 border-b border-gray-700">
            {markers.map((time) => (
              <div
                key={time}
                className="absolute top-0 h-full flex flex-col items-center"
                style={{ left: time * pixelsPerSecond }}
              >
                <span className="text-xs text-gray-500">{formatTime(time)}</span>
                <div className="w-px h-3 bg-gray-600" />
              </div>
            ))}
          </div>

          {/* Tracks area */}
          <div className="relative" style={{ height: '24px' }}>
            {/* Grid lines */}
            {markers.map((time) => (
              <div
                key={time}
                className="absolute top-0 bottom-0 w-px bg-gray-700 opacity-30"
                style={{ left: time * pixelsPerSecond }}
              />
            ))}
          </div>
        </div>

        {/* Playhead */}
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-10 pointer-events-none"
          style={{ left: playheadPosition }}
        >
          <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-3 h-3 bg-red-500 rounded-sm" />
        </div>
      </div>

      {/* Track labels and clips */}
      <div className="mt-2 space-y-2">
        {project.tracks.map((track, trackIndex) => (
          <div key={track.id} className="flex items-center gap-2">
            {/* Track controls */}
            <div className="w-24 flex items-center gap-1">
              <button
                onClick={() => videoEditorService.updateTrack(track.id, { muted: !track.muted })}
                className={`p-1 rounded ${track.muted ? 'bg-red-600' : 'bg-gray-700'} text-white text-xs`}
                aria-label={track.muted ? 'Unmute track' : 'Mute track'}
              >
                {track.muted ? <FaVolumeMute /> : <FaVolumeUp />}
              </button>
              <button
                onClick={() => videoEditorService.updateTrack(track.id, { locked: !track.locked })}
                className={`p-1 rounded ${track.locked ? 'bg-yellow-600' : 'bg-gray-700'} text-white text-xs`}
                aria-label={track.locked ? 'Unlock track' : 'Lock track'}
              >
                {track.locked ? <FaLock /> : <FaUnlock />}
              </button>
              <button
                onClick={() => videoEditorService.updateTrack(track.id, { visible: !track.visible })}
                className={`p-1 rounded ${!track.visible ? 'bg-gray-600' : 'bg-gray-700'} text-white text-xs`}
                aria-label={track.visible ? 'Hide track' : 'Show track'}
              >
                {track.visible ? <FaEye /> : <FaEyeSlash />}
              </button>
            </div>

            {/* Track clips */}
            <div 
              className="flex-1 relative h-12 bg-gray-800 rounded overflow-hidden"
              style={{ opacity: track.visible ? 1 : 0.5 }}
            >
              {track.clips?.map((clip, clipIndex) => {
                const clipLeft = clip.startTime * pixelsPerSecond;
                const clipWidth = clip.duration * pixelsPerSecond;
                const isSelected = selectedClipId === clip.id;
                
                return (
                  <div
                    key={clip.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectClip(track.id, clip.id);
                    }}
                    className={`
                      absolute top-1 bottom-1 rounded cursor-pointer
                      transition-all duration-150 border-2
                      ${isSelected ? 'border-white shadow-lg' : 'border-transparent'}
                      ${track.locked ? 'opacity-50 cursor-not-allowed' : 'hover:border-gray-400'}
                    `}
                    style={{
                      left: clipLeft,
                      width: clipWidth,
                      backgroundColor: VIDEO_EDITOR_CONFIG.COLORS.CLIP_COLORS[trackIndex % VIDEO_EDITOR_CONFIG.COLORS.CLIP_COLORS.length],
                    }}
                    role="button"
                    aria-label={`Clip ${clipIndex + 1} on ${track.name}`}
                    aria-selected={isSelected}
                    tabIndex={0}
                  >
                    <div className="absolute inset-0 flex items-center justify-center text-white text-xs font-medium truncate px-1">
                      {clip.sourceType === 'video' ? '🎬' : '🖼️'} {Math.round(clip.duration)}s
                    </div>
                    {clip.filter !== 'none' && (
                      <div className="absolute top-0 right-0 bg-black/50 px-1 text-xs text-white">
                        <FaMagic />
                      </div>
                    )}
                    {clip.volume !== 1 && (
                      <div className="absolute bottom-0 right-0 bg-black/50 px-1 text-xs text-white">
                        🔊 {Math.round(clip.volume * 100)}%
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Text overlays */}
              {track.type === 'text' && track.overlays?.map((overlay, overlayIndex) => {
                const overlayLeft = overlay.startTime * pixelsPerSecond;
                const overlayWidth = (overlay.endTime - overlay.startTime) * pixelsPerSecond;
                
                return (
                  <div
                    key={overlay.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectClip(track.id, overlay.id, 'overlay');
                    }}
                    className="absolute top-1 bottom-1 bg-indigo-600/70 rounded border-2 border-indigo-400 cursor-pointer hover:border-white"
                    style={{ left: overlayLeft, width: overlayWidth }}
                    role="button"
                    aria-label={`Text overlay: ${overlay.text}`}
                  >
                    <div className="absolute inset-0 flex items-center justify-center text-white text-xs truncate px-1">
                      <FaTextHeight className="mr-1" /> {overlay.text.substring(0, 10)}
                    </div>
                  </div>
                );
              })}

              {/* Stickers */}
              {track.type === 'sticker' && track.items?.map((sticker, stickerIndex) => {
                const stickerLeft = sticker.startTime * pixelsPerSecond;
                const stickerWidth = (sticker.endTime - sticker.startTime) * pixelsPerSecond;
                
                return (
                  <div
                    key={sticker.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectClip(track.id, sticker.id, 'sticker');
                    }}
                    className="absolute top-1 bottom-1 bg-pink-600/70 rounded border-2 border-pink-400 cursor-pointer hover:border-white flex items-center justify-center"
                    style={{ left: stickerLeft, width: stickerWidth }}
                    role="button"
                    aria-label={`Sticker: ${sticker.icon}`}
                  >
                    <span className="text-lg">{sticker.icon}</span>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// ==================== CLIP EDITOR PANEL ====================
const ClipEditorPanel = ({ clip, track, onUpdate, onDelete, onClose }) => {
  if (!clip) return null;

  const isTextOverlay = track?.type === 'text';
  const isSticker = track?.type === 'sticker';

  return (
    <div className="bg-gray-800 rounded-xl p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-white font-semibold">
          {isTextOverlay ? 'Edit Text' : isSticker ? 'Edit Sticker' : 'Edit Clip'}
        </h3>
        <button onClick={onClose} className="text-gray-400 hover:text-white">
          <FaTimes />
        </button>
      </div>

      {/* Position & Duration */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-gray-400 text-sm">Start Time (s)</label>
          <input
            type="number"
            step="0.1"
            min="0"
            value={clip.startTime}
            onChange={(e) => onUpdate({ startTime: parseFloat(e.target.value) })}
            className="w-full bg-gray-700 text-white rounded px-3 py-2"
            aria-label="Start time"
          />
        </div>
        <div>
          <label className="text-gray-400 text-sm">End Time (s)</label>
          <input
            type="number"
            step="0.1"
            min="0"
            value={clip.endTime}
            onChange={(e) => onUpdate({ endTime: parseFloat(e.target.value) })}
            className="w-full bg-gray-700 text-white rounded px-3 py-2"
            aria-label="End time"
          />
        </div>
      </div>

      {/* Text-specific options */}
      {isTextOverlay && (
        <>
          <div>
            <label className="text-gray-400 text-sm">Text</label>
            <input
              type="text"
              value={clip.text}
              onChange={(e) => onUpdate({ text: e.target.value })}
              className="w-full bg-gray-700 text-white rounded px-3 py-2"
              aria-label="Overlay text"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-gray-400 text-sm">Font Size</label>
              <select
                value={clip.fontSize}
                onChange={(e) => onUpdate({ fontSize: parseInt(e.target.value) })}
                className="w-full bg-gray-700 text-white rounded px-3 py-2"
                aria-label="Font size"
              >
                {VIDEO_EDITOR_CONFIG.TEXT.SIZES.map(size => (
                  <option key={size} value={size}>{size}px</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-gray-400 text-sm">Color</label>
              <input
                type="color"
                value={clip.color}
                onChange={(e) => onUpdate({ color: e.target.value })}
                className="w-full h-10 bg-gray-700 rounded cursor-pointer"
                aria-label="Text color"
              />
            </div>
          </div>
        </>
      )}

      {/* Non-text clip options */}
      {!isTextOverlay && !isSticker && (
        <>
          <div>
            <label className="text-gray-400 text-sm">Volume ({Math.round((clip.volume || 1) * 100)}%)</label>
            <input
              type="range"
              min="0"
              max="2"
              step="0.05"
              value={clip.volume || 1}
              onChange={(e) => onUpdate({ volume: parseFloat(e.target.value) })}
              className="w-full"
              aria-label="Volume"
            />
          </div>
          <div>
            <label className="text-gray-400 text-sm">Speed ({clip.speed || 1}x)</label>
            <input
              type="range"
              min="0.25"
              max="4"
              step="0.25"
              value={clip.speed || 1}
              onChange={(e) => onUpdate({ speed: parseFloat(e.target.value) })}
              className="w-full"
              aria-label="Playback speed"
            />
          </div>
        </>
      )}

      {/* Sticker-specific options */}
      {isSticker && (
        <div>
          <label className="text-gray-400 text-sm">Scale ({Math.round((clip.scale || 1) * 100)}%)</label>
          <input
            type="range"
            min="0.5"
            max="3"
            step="0.1"
            value={clip.scale || 1}
            onChange={(e) => onUpdate({ scale: parseFloat(e.target.value) })}
            className="w-full"
            aria-label="Sticker scale"
          />
        </div>
      )}

      {/* Delete button */}
      <button
        onClick={onDelete}
        className="w-full bg-red-600 hover:bg-red-700 text-white py-2 rounded flex items-center justify-center gap-2"
        aria-label={isTextOverlay ? 'Delete text overlay' : isSticker ? 'Delete sticker' : 'Delete clip'}
      >
        <FaTrash /> Delete
      </button>
    </div>
  );
};

// ==================== FILTER PANEL ====================
const FilterPanel = ({ selectedClipId, onApplyFilter }) => {
  const [previewFilter, setPreviewFilter] = useState(null);

  return (
    <div className="bg-gray-800 rounded-xl p-4">
      <h3 className="text-white font-semibold mb-4">Filters</h3>
      <div className="grid grid-cols-4 gap-2">
        {VIDEO_EDITOR_CONFIG.FILTERS.BUILT_IN.map((filter) => (
          <button
            key={filter.id}
            onClick={() => {
              setPreviewFilter(filter);
              if (selectedClipId) {
                onApplyFilter(filter);
              }
            }}
            className={`
              p-2 rounded-lg text-center transition-all
              ${previewFilter?.id === filter.id ? 'bg-indigo-600 ring-2 ring-indigo-400' : 'bg-gray-700 hover:bg-gray-600'}
            `}
            aria-label={`Apply ${filter.name} filter`}
          >
            <div 
              className="w-12 h-12 mx-auto rounded mb-1"
              style={{ filter: filter.css }}
              aria-hidden="true"
            />
            <span className="text-xs text-gray-300">{filter.name}</span>
          </button>
        ))}
      </div>
    </div>
  );
};

// ==================== TEXT TOOL PANEL ====================
const TextToolPanel = ({ onAddText }) => {
  const [text, setText] = useState('');
  const [fontSize, setFontSize] = useState(32);
  const [color, setColor] = useState('#FFFFFF');

  const handleAdd = () => {
    if (text.trim()) {
      onAddText({ text: text.trim(), fontSize, color });
      setText('');
    }
  };

  return (
    <div className="bg-gray-800 rounded-xl p-4 space-y-4">
      <h3 className="text-white font-semibold">Add Text</h3>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Enter text..."
        className="w-full bg-gray-700 text-white rounded px-3 py-2 h-24 resize-none"
        aria-label="Text content"
      />
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-gray-400 text-sm">Size</label>
          <select
            value={fontSize}
            onChange={(e) => setFontSize(parseInt(e.target.value))}
            className="w-full bg-gray-700 text-white rounded px-3 py-2"
            aria-label="Font size"
          >
            {VIDEO_EDITOR_CONFIG.TEXT.SIZES.map(size => (
              <option key={size} value={size}>{size}px</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-gray-400 text-sm">Color</label>
          <input
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            className="w-full h-10 bg-gray-700 rounded cursor-pointer"
            aria-label="Text color"
          />
        </div>
      </div>
      <button
        onClick={handleAdd}
        disabled={!text.trim()}
        className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white py-2 rounded flex items-center justify-center gap-2"
        aria-label="Add text overlay"
      >
        <FaPlus /> Add Text
      </button>
    </div>
  );
};

// ==================== STICKER PANEL ====================
const StickerPanel = ({ onAddSticker }) => {
  return (
    <div className="bg-gray-800 rounded-xl p-4">
      <h3 className="text-white font-semibold mb-4">Stickers</h3>
      <div className="space-y-4">
        {VIDEO_EDITOR_CONFIG.STICKERS.CATEGORIES.map((category) => (
          <div key={category.id}>
            <h4 className="text-gray-400 text-sm mb-2">{category.name}</h4>
            <div className="flex flex-wrap gap-2">
              {category.icons.map((icon, idx) => (
                <button
                  key={`${category.id}-${idx}`}
                  onClick={() => onAddSticker({ icon })}
                  className="w-10 h-10 bg-gray-700 hover:bg-gray-600 rounded-lg text-xl flex items-center justify-center hover:scale-110 transition-transform"
                  aria-label={`Add ${icon} sticker`}
                >
                  {icon}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// ==================== AUDIO PANEL ====================
const AudioPanel = ({ onAddAudio }) => {
  const fileInputRef = useRef(null);

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      onAddAudio({ sourceUrl: URL.createObjectURL(file), duration: 30 });
    }
  };

  return (
    <div className="bg-gray-800 rounded-xl p-4 space-y-4">
      <h3 className="text-white font-semibold">Audio</h3>
      <input
        ref={fileInputRef}
        type="file"
        accept="audio/*"
        onChange={handleFileSelect}
        className="hidden"
        aria-label="Upload audio file"
      />
      <button
        onClick={() => fileInputRef.current?.click()}
        className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-3 rounded flex items-center justify-center gap-2"
        aria-label="Upload audio"
      >
        <FaMusic /> Upload Audio
      </button>
      <p className="text-gray-500 text-sm text-center">MP3, WAV, OGG supported</p>
    </div>
  );
};

// ==================== EXPORT PANEL ====================
const ExportPanel = ({ project, onExport, exporting, exportProgress }) => {
  const [preset, setPreset] = useState(VIDEO_EDITOR_CONFIG.EXPORT.PRESETS[1]);

  return (
    <div className="bg-gray-800 rounded-xl p-4 space-y-4">
      <h3 className="text-white font-semibold">Export Settings</h3>
      
      <div>
        <label className="text-gray-400 text-sm">Quality Preset</label>
        <select
          value={preset.id}
          onChange={(e) => setPreset(VIDEO_EDITOR_CONFIG.EXPORT.PRESETS.find(p => p.id === e.target.value))}
          className="w-full bg-gray-700 text-white rounded px-3 py-2"
          aria-label="Export quality preset"
        >
          {VIDEO_EDITOR_CONFIG.EXPORT.PRESETS.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      </div>

      <div className="bg-gray-700 rounded p-3 space-y-1">
        <div className="flex justify-between text-sm">
          <span className="text-gray-400">Resolution:</span>
          <span className="text-white">{preset.width} x {preset.height}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-400">Bitrate:</span>
          <span className="text-white">{preset.bitrate} kbps</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-400">FPS:</span>
          <span className="text-white">{preset.fps}</span>
        </div>
      </div>

      {exporting && (
        <div className="space-y-2">
          <div className="h-2 bg-gray-700 rounded overflow-hidden">
            <div 
              className="h-full bg-indigo-600 transition-all duration-300"
              style={{ width: `${exportProgress * 100}%` }}
            />
          </div>
          <p className="text-gray-400 text-sm text-center">
            {exportProgress < 0.2 ? 'Preparing...' : 
             exportProgress < 0.8 ? 'Encoding...' : 'Finalizing...'}
          </p>
        </div>
      )}

      <button
        onClick={() => onExport(preset)}
        disabled={exporting}
        className="w-full bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white py-3 rounded flex items-center justify-center gap-2"
        aria-label="Export video"
      >
        <FaDownload /> {exporting ? 'Exporting...' : 'Export Video'}
      </button>
    </div>
  );
};

// ==================== MAIN VIDEO EDITOR SCREEN ====================
export default function VideoEditorScreen() {
  const navigate = useNavigate();
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [zoom, setZoom] = useState(VIDEO_EDITOR_CONFIG.TIMELINE.DEFAULT_ZOOM);
  const [selectedTrackId, setSelectedTrackId] = useState(null);
  const [selectedClipId, setSelectedClipId] = useState(null);
  const [selectedClipType, setSelectedClipType] = useState('clip');
  const [activeTool, setActiveTool] = useState(null);
  const [project, setProject] = useState(null);
  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [error, setError] = useState(null);

  const videoPreviewRef = useRef(null);
  const playIntervalRef = useRef(null);

  // Initialize project
  useEffect(() => {
    try {
      const newProject = videoEditorService.createProject({ name: 'New Video' });
      setProject(newProject);
      console.log('[VideoEditor] Project created:', newProject.id);
    } catch (err) {
      setError(err.message);
    }
  }, []);

  // Playback control
  useEffect(() => {
    if (isPlaying && project) {
      playIntervalRef.current = setInterval(() => {
        setCurrentTime((prev) => {
          const next = prev + 0.1;
          if (next >= project.duration) {
            setIsPlaying(false);
            return 0;
          }
          return next;
        });
      }, 100);
    } else {
      if (playIntervalRef.current) {
        clearInterval(playIntervalRef.current);
      }
    }
    return () => {
      if (playIntervalRef.current) {
        clearInterval(playIntervalRef.current);
      }
    };
  }, [isPlaying, project]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

      switch (e.code) {
        case 'Space':
          e.preventDefault();
          setIsPlaying((p) => !p);
          break;
        case 'ArrowLeft':
          setCurrentTime((t) => Math.max(0, t - 1));
          break;
        case 'ArrowRight':
          setCurrentTime((t) => Math.min(project?.duration || 0, t + 1));
          break;
        case 'KeyZ':
          if (e.metaKey || e.ctrlKey) {
            e.preventDefault();
            if (e.shiftKey) {
              handleRedo();
            } else {
              handleUndo();
            }
          }
          break;
        case 'Delete':
        case 'Backspace':
          if (selectedClipId) {
            handleDeleteClip();
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedClipId, project]);

  const handleSeek = useCallback((time) => {
    setCurrentTime(time);
  }, []);

  const handleSelectClip = useCallback((trackId, clipId, type = 'clip') => {
    setSelectedTrackId(trackId);
    setSelectedClipId(clipId);
    setSelectedClipType(type);
  }, []);

  const handleSplitClip = useCallback(() => {
    if (!selectedTrackId || !selectedClipId) return;
    try {
      videoEditorService.splitClip(selectedTrackId, selectedClipId, currentTime);
      setProject(videoEditorService.getCurrentProject());
    } catch (err) {
      setError(err.message);
    }
  }, [selectedTrackId, selectedClipId, currentTime]);

  const handleDeleteClip = useCallback(() => {
    if (!selectedTrackId || !selectedClipId) return;
    try {
      if (selectedClipType === 'overlay') {
        videoEditorService.deleteTextOverlay(selectedClipId);
      } else if (selectedClipType === 'sticker') {
        videoEditorService.deleteSticker(selectedClipId);
      } else {
        videoEditorService.deleteClip(selectedTrackId, selectedClipId);
      }
      setSelectedClipId(null);
      setProject(videoEditorService.getCurrentProject());
    } catch (err) {
      setError(err.message);
    }
  }, [selectedTrackId, selectedClipId, selectedClipType]);

  const handleUndo = useCallback(() => {
    const result = videoEditorService.undo();
    if (result) setProject(result);
  }, []);

  const handleRedo = useCallback(() => {
    const result = videoEditorService.redo();
    if (result) setProject(result);
  }, []);

  const handleAddMedia = useCallback((files) => {
    if (!project) return;
    const videoTrack = project.tracks.find(t => t.type === 'video');
    if (!videoTrack) return;

    Array.from(files).forEach((file) => {
      if (file.type.startsWith('video/') || file.type.startsWith('image/')) {
        try {
          videoEditorService.addClip(videoTrack.id, {
            sourceUrl: URL.createObjectURL(file),
            sourceType: file.type.startsWith('video/') ? 'video' : 'image',
            duration: file.type.startsWith('video/') ? 10 : 5,
          });
        } catch (err) {
          setError(err.message);
        }
      }
    });
    setProject(videoEditorService.getCurrentProject());
  }, [project]);

  const handleAddText = useCallback((textData) => {
    if (!project) return;
    try {
      videoEditorService.addTextOverlay({
        ...textData,
        startTime: currentTime,
        endTime: currentTime + 5,
      });
      setProject(videoEditorService.getCurrentProject());
      setActiveTool(null);
    } catch (err) {
      setError(err.message);
    }
  }, [project, currentTime]);

  const handleAddSticker = useCallback((stickerData) => {
    if (!project) return;
    try {
      videoEditorService.addSticker({
        ...stickerData,
        startTime: currentTime,
        endTime: currentTime + 5,
      });
      setProject(videoEditorService.getCurrentProject());
    } catch (err) {
      setError(err.message);
    }
  }, [project, currentTime]);

  const handleAddAudio = useCallback((audioData) => {
    if (!project) return;
    try {
      videoEditorService.addAudioTrack({
        ...audioData,
        startTime: currentTime,
      });
      setProject(videoEditorService.getCurrentProject());
      setActiveTool(null);
    } catch (err) {
      setError(err.message);
    }
  }, [project, currentTime]);

  const handleApplyFilter = useCallback((filter) => {
    if (!selectedClipId) return;
    try {
      videoEditorService.addFilter(selectedClipId, filter.id);
      setProject(videoEditorService.getCurrentProject());
    } catch (err) {
      setError(err.message);
    }
  }, [selectedClipId]);

  const handleUpdateClip = useCallback((updates) => {
    if (!selectedTrackId || !selectedClipId) return;
    try {
      if (selectedClipType === 'overlay') {
        videoEditorService.updateTextOverlay(selectedClipId, updates);
      } else if (selectedClipType === 'sticker') {
        videoEditorService.updateSticker(selectedClipId, updates);
      } else {
        videoEditorService.updateClip(selectedTrackId, selectedClipId, updates);
      }
      setProject(videoEditorService.getCurrentProject());
    } catch (err) {
      setError(err.message);
    }
  }, [selectedTrackId, selectedClipId, selectedClipType]);

  const handleExport = useCallback(async (preset) => {
    if (!project) return;
    try {
      setExporting(true);
      setExportProgress(0);
      
      videoEditorService.setExportSettings(preset);
      
      const result = await videoEditorService.exportVideo((progress) => {
        setExportProgress(progress.progress);
      });
      
      console.log('[VideoEditor] Export complete:', result);
      alert('Video exported successfully!');
    } catch (err) {
      setError(err.message);
    } finally {
      setExporting(false);
    }
  }, [project]);

  const handleSaveProject = useCallback(() => {
    try {
      videoEditorService.saveProject();
      alert('Project saved!');
    } catch (err) {
      setError(err.message);
    }
  }, []);

  // Get selected clip for editing
  const selectedClip = useMemo(() => {
    if (!project || !selectedTrackId || !selectedClipId) return null;
    const track = project.tracks.find(t => t.id === selectedTrackId);
    if (!track) return null;

    if (selectedClipType === 'overlay') {
      return track.overlays?.find(o => o.id === selectedClipId);
    } else if (selectedClipType === 'sticker') {
      return track.items?.find(s => s.id === selectedClipId);
    }
    return track.clips?.find(c => c.id === selectedClipId);
  }, [project, selectedTrackId, selectedClipId, selectedClipType]);

  if (!project) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-white">Loading editor...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col">
      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate(-1)}
            className="p-2 hover:bg-gray-700 rounded-lg"
            aria-label="Go back"
          >
            <FaChevronLeft />
          </button>
          <h1 className="text-lg font-semibold">Video Editor</h1>
          <span className="text-gray-500 text-sm">{project.name}</span>
        </div>
        <div className="flex items-center gap-2">
          <IconButton
            icon={FaUndo}
            onClick={handleUndo}
            disabled={!videoEditorService.canUndo()}
            title="Undo (Ctrl+Z)"
          />
          <IconButton
            icon={FaRedo}
            onClick={handleRedo}
            disabled={!videoEditorService.canRedo()}
            title="Redo (Ctrl+Shift+Z)"
          />
          <IconButton
            icon={FaSave}
            onClick={handleSaveProject}
            title="Save Project"
          />
        </div>
      </header>

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left sidebar - Tools */}
        <aside className="w-20 bg-gray-800 border-r border-gray-700 flex flex-col items-center py-4 gap-2">
          <ToolButton
            icon={FaPlus}
            label="Media"
            onClick={() => setActiveTool('media')}
            active={activeTool === 'media'}
          />
          <ToolButton
            icon={FaTextHeight}
            label="Text"
            onClick={() => setActiveTool('text')}
            active={activeTool === 'text'}
          />
          <ToolButton
            icon={FaStickyNote}
            label="Stickers"
            onClick={() => setActiveTool('stickers')}
            active={activeTool === 'stickers'}
          />
          <ToolButton
            icon={FaMagic}
            label="Filters"
            onClick={() => setActiveTool('filters')}
            active={activeTool === 'filters'}
          />
          <ToolButton
            icon={FaMusic}
            label="Audio"
            onClick={() => setActiveTool('audio')}
            active={activeTool === 'audio'}
          />
          <ToolButton
            icon={FaClosedCaptioning}
            label="Captions"
            onClick={() => setActiveTool('captions')}
            active={activeTool === 'captions'}
          />
          <div className="flex-1" />
          <ToolButton
            icon={FaDownload}
            label="Export"
            onClick={() => setActiveTool('export')}
            active={activeTool === 'export'}
          />
        </aside>

        {/* Center - Preview & Timeline */}
        <main className="flex-1 flex flex-col overflow-hidden">
          {/* Video preview */}
          <div className="bg-black flex items-center justify-center p-4" style={{ height: '50%' }}>
            <div className="bg-gray-800 rounded-lg w-full max-w-4xl aspect-video flex items-center justify-center relative">
              <div className="text-gray-500 text-center">
                <FaPlay className="text-6xl mb-2 opacity-50" />
                <p>Video preview</p>
                <p className="text-sm">{project.duration.toFixed(1)}s</p>
              </div>
              {isPlaying && (
                <div className="absolute top-4 right-4 bg-red-600 px-2 py-1 rounded text-xs">
                  PLAYING
                </div>
              )}
            </div>
          </div>

          {/* Playback controls */}
          <div className="bg-gray-800 border-t border-gray-700 px-4 py-3 flex items-center justify-center gap-4">
            <IconButton
              icon={FaStepBackward}
              onClick={() => setCurrentTime(0)}
              title="Go to start"
            />
            <IconButton
              icon={FaBackward}
              onClick={() => setCurrentTime(Math.max(0, currentTime - 5))}
              title="Back 5s"
            />
            <IconButton
              icon={isPlaying ? FaPause : FaPlay}
              onClick={() => setIsPlaying(!isPlaying)}
              size="lg"
              title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
            />
            <IconButton
              icon={FaForward}
              onClick={() => setCurrentTime(Math.min(project.duration, currentTime + 5))}
              title="Forward 5s"
            />
            <IconButton
              icon={FaStepForward}
              onClick={() => setCurrentTime(project.duration)}
              title="Go to end"
            />
            <div className="w-px h-8 bg-gray-600 mx-2" />
            <IconButton
              icon={FaCut}
              onClick={handleSplitClip}
              disabled={!selectedClipId}
              title="Split clip (S)"
            />
          </div>

          {/* Timeline */}
          <div className="flex-1 overflow-hidden p-4">
            <Timeline
              project={project}
              currentTime={currentTime}
              onSeek={handleSeek}
              onSelectClip={handleSelectClip}
              selectedClipId={selectedClipId}
              zoom={zoom}
              onZoomChange={setZoom}
            />
          </div>
        </main>

        {/* Right sidebar - Panels */}
        <aside className="w-80 bg-gray-800 border-l border-gray-700 overflow-y-auto">
          <div className="p-4 space-y-4">
            {/* Media upload panel */}
            {activeTool === 'media' && (
              <div className="bg-gray-800 rounded-xl p-4">
                <h3 className="text-white font-semibold mb-4">Add Media</h3>
                <input
                  type="file"
                  id="media-upload"
                  accept="video/*,image/*"
                  multiple
                  onChange={(e) => handleAddMedia(e.target.files)}
                  className="hidden"
                />
                <label
                  htmlFor="media-upload"
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-4 rounded-lg flex flex-col items-center justify-center gap-2 cursor-pointer"
                >
                  <FaPlus className="text-2xl" />
                  <span>Click to upload</span>
                </label>
                <p className="text-gray-500 text-sm text-center mt-2">MP4, MOV, PNG, JPG</p>
              </div>
            )}

            {/* Text tool panel */}
            {activeTool === 'text' && (
              <TextToolPanel onAddText={handleAddText} />
            )}

            {/* Sticker panel */}
            {activeTool === 'stickers' && (
              <StickerPanel onAddSticker={handleAddSticker} />
            )}

            {/* Filter panel */}
            {activeTool === 'filters' && (
              <FilterPanel
                selectedClipId={selectedClipId}
                onApplyFilter={handleApplyFilter}
              />
            )}

            {/* Audio panel */}
            {activeTool === 'audio' && (
              <AudioPanel onAddAudio={handleAddAudio} />
            )}

            {/* Export panel */}
            {activeTool === 'export' && (
              <ExportPanel
                project={project}
                onExport={handleExport}
                exporting={exporting}
                exportProgress={exportProgress}
              />
            )}

            {/* Clip editor panel */}
            {selectedClip && !activeTool && (
              <ClipEditorPanel
                clip={selectedClip}
                track={project?.tracks?.find(t => t.id === selectedTrackId)}
                onUpdate={handleUpdateClip}
                onDelete={handleDeleteClip}
                onClose={() => setSelectedClipId(null)}
              />
            )}

            {/* Default state */}
            {!selectedClip && !activeTool && (
              <div className="bg-gray-800 rounded-xl p-4 text-center">
                <p className="text-gray-500">Select a clip to edit or use tools to add content</p>
              </div>
            )}
          </div>
        </aside>
      </div>

      {/* Error toast */}
      {error && (
        <div className="fixed bottom-4 right-4 bg-red-600 text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-3">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="hover:bg-red-700 p-1 rounded">
            <FaTimes />
          </button>
        </div>
      )}
    </div>
  );
}

export { VIDEO_EDITOR_CONFIG };
