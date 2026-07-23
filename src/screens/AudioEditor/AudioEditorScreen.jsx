// src/screens/AudioEditor/AudioEditorScreen.jsx – ARVDOUL AUDIO EDITOR SCREEN V1
// 🎵 Professional Audio Editor with Waveform, Effects, Export
// ✅ WCAG 2.1 AA Compliant • Keyboard Navigation • Screen Reader Support

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  FaPlay, FaPause, FaUndo, FaRedo, FaUpload, FaDownload, FaVolumeUp, FaVolumeMute,
  FaCompressAlt, FaExpandAlt, FaCut, FaTrash, FaPlus, FaTimes, FaChevronLeft,
  FaMusic, FaSlidersH, FaWaveSquare, FaMarker
} from 'react-icons/fa';
import { AUDIO_EDITOR_CONFIG } from '../../services/audioEditorService.js';
import audioEditorService from '../../services/audioEditorService.js';

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

// ==================== WAVEFORM COMPONENT ====================
const Waveform = ({ waveformData, duration, currentTime, trimStart, trimEnd, onSeek, zoom }) => {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !waveformData || waveformData.length === 0) return;

    const ctx = canvas.getContext('2d');
    const { width, height } = canvas;
    
    ctx.clearRect(0, 0, width, height);
    
    const barWidth = AUDIO_EDITOR_CONFIG.WAVEFORM.BAR_WIDTH * zoom;
    const barGap = AUDIO_EDITOR_CONFIG.WAVEFORM.BAR_GAP;
    const totalBarWidth = barWidth + barGap;
    const centerY = height / 2;
    
    // Draw background grid
    ctx.strokeStyle = AUDIO_EDITOR_CONFIG.WAVEFORM.COLORS.GRID;
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(0, centerY);
    ctx.lineTo(width, centerY);
    ctx.stroke();

    // Draw waveform bars
    waveformData.forEach((point, index) => {
      const x = index * totalBarWidth;
      const barHeight = Math.max(
        AUDIO_EDITOR_CONFIG.WAVEFORM.MIN_HEIGHT,
        Math.abs(point.max - point.min) * (height / 2) * 0.9
      );
      
      const time = index / AUDIO_EDITOR_CONFIG.WAVEFORM.SAMPLES_PER_SECOND;
      
      // Color based on selection state
      if (time >= trimStart && time <= trimEnd) {
        ctx.fillStyle = time <= currentTime 
          ? AUDIO_EDITOR_CONFIG.WAVEFORM.COLORS.PLAYED 
          : AUDIO_EDITOR_CONFIG.WAVEFORM.COLORS.DEFAULT;
      } else {
        ctx.fillStyle = '#4b5563'; // muted color for trimmed areas
      }
      
      // Draw bar (centered)
      ctx.fillRect(x, centerY - barHeight / 2, barWidth, barHeight);
    });

    // Draw trim handles
    const trimStartX = (trimStart / duration) * width;
    const trimEndX = (trimEnd / duration) * width;
    
    ctx.fillStyle = 'rgba(139, 92, 246, 0.3)';
    ctx.fillRect(trimStartX, 0, trimEndX - trimStartX, height);
    
    ctx.strokeStyle = '#8b5cf6';
    ctx.lineWidth = 2;
    
    // Start handle
    ctx.beginPath();
    ctx.moveTo(trimStartX, 0);
    ctx.lineTo(trimStartX, height);
    ctx.stroke();
    
    // End handle
    ctx.beginPath();
    ctx.moveTo(trimEndX, 0);
    ctx.lineTo(trimEndX, height);
    ctx.stroke();

    // Draw playhead
    const playheadX = (currentTime / duration) * width;
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(playheadX, 0);
    ctx.lineTo(playheadX, height);
    ctx.stroke();

  }, [waveformData, currentTime, trimStart, trimEnd, duration, zoom]);

  const handleClick = (e) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = x / rect.width;
    const time = percentage * duration;
    onSeek(Math.max(0, Math.min(time, duration)));
  };

  return (
    <div 
      ref={containerRef}
      className="relative bg-gray-900 rounded-lg overflow-hidden cursor-pointer"
      onClick={handleClick}
      role="slider"
      aria-label="Audio waveform"
      aria-valuemin={0}
      aria-valuemax={duration}
      aria-valuenow={currentTime}
      tabIndex={0}
    >
      <canvas
        ref={canvasRef}
        width={containerRef.current?.clientWidth || 800}
        height={120}
        className="w-full h-32"
      />
    </div>
  );
};

// ==================== EFFECTS PANEL ====================
const EffectsPanel = ({ effects, onAddEffect, onUpdateEffect, onRemoveEffect, onToggleEffect }) => {
  const effectTypes = Object.entries(AUDIO_EDITOR_CONFIG.EFFECTS);

  return (
    <div className="bg-gray-800 rounded-xl p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-white font-semibold flex items-center gap-2">
          <FaSlidersH /> Effects
        </h3>
      </div>

      {/* Add effect buttons */}
      <div className="flex flex-wrap gap-2">
        {effectTypes.map(([id, config]) => (
          <button
            key={id}
            onClick={() => onAddEffect(id.toLowerCase())}
            className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm flex items-center gap-1"
            aria-label={`Add ${config.name} effect`}
          >
            <FaPlus className="text-xs" /> {config.name}
          </button>
        ))}
      </div>

      {/* Active effects */}
      {effects.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-gray-400 text-sm">Active Effects</h4>
          {effects.map((effect) => (
            <div key={effect.id} className="bg-gray-700 rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-white font-medium flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={effect.enabled}
                    onChange={() => onToggleEffect(effect.id)}
                    className="w-4 h-4"
                    aria-label={`Toggle ${effect.type} effect`}
                  />
                  {AUDIO_EDITOR_CONFIG.EFFECTS[effect.type.toUpperCase()]?.name || effect.type}
                </span>
                <button
                  onClick={() => onRemoveEffect(effect.id)}
                  className="text-red-400 hover:text-red-300"
                  aria-label="Remove effect"
                >
                  <FaTimes />
                </button>
              </div>
              
              {/* Effect parameters */}
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(effect.params).map(([param, value]) => {
                  const paramConfig = AUDIO_EDITOR_CONFIG.EFFECTS[effect.type.toUpperCase()]?.params[param];
                  if (!paramConfig) return null;
                  
                  return (
                    <div key={param} className="flex flex-col gap-1">
                      <label className="text-gray-400 text-xs capitalize">
                        {param.replace(/([A-Z])/g, ' $1').trim()}
                      </label>
                      <input
                        type="range"
                        min={paramConfig.min}
                        max={paramConfig.max}
                        step={(paramConfig.max - paramConfig.min) / 100}
                        value={value}
                        onChange={(e) => onUpdateEffect(effect.id, { [param]: parseFloat(e.target.value) })}
                        className="w-full"
                        disabled={!effect.enabled}
                        aria-label={`${param} value`}
                      />
                      <span className="text-gray-500 text-xs">{value.toFixed(2)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ==================== MARKERS PANEL ====================
const MarkersPanel = ({ markers, duration, onAddMarker, onRemoveMarker }) => {
  const [newMarkerTime, setNewMarkerTime] = useState(0);

  return (
    <div className="bg-gray-800 rounded-xl p-4 space-y-4">
      <h3 className="text-white font-semibold flex items-center gap-2">
        <FaMarker /> Markers
      </h3>

      {/* Add marker */}
      <div className="flex gap-2">
        <input
          type="number"
          min={0}
          max={duration}
          step={0.1}
          value={newMarkerTime}
          onChange={(e) => setNewMarkerTime(parseFloat(e.target.value) || 0)}
          className="flex-1 bg-gray-700 text-white rounded px-3 py-2"
          aria-label="Marker time"
        />
        <button
          onClick={() => {
            onAddMarker(newMarkerTime);
            setNewMarkerTime(0);
          }}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded"
          aria-label="Add marker"
        >
          <FaPlus />
        </button>
      </div>

      {/* Marker list */}
      {markers.length > 0 && (
        <div className="space-y-2">
          {markers.map((marker) => (
            <div key={marker.id} className="flex items-center justify-between bg-gray-700 rounded px-3 py-2">
              <div>
                <span className="text-indigo-400 font-mono text-sm">
                  {audioEditorService.formatTime(marker.time)}
                </span>
                <span className="text-gray-400 text-sm ml-2">{marker.label}</span>
              </div>
              <button
                onClick={() => onRemoveMarker(marker.id)}
                className="text-red-400 hover:text-red-300"
                aria-label={`Remove marker ${marker.label}`}
              >
                <FaTimes />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ==================== MAIN AUDIO EDITOR SCREEN ====================
export default function AudioEditorScreen() {
  const navigate = useNavigate();
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [project, setProject] = useState(null);
  const [waveformData, setWaveformData] = useState([]);
  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('effects');
  const [volume, setVolume] = useState(1);

  const audioRef = useRef(null);
  const playbackRef = useRef(null);

  // Initialize project
  useEffect(() => {
    try {
      const newProject = audioEditorService.createProject({ name: 'New Audio' });
      setProject(newProject);
      console.log('[AudioEditor] Project created:', newProject.id);
    } catch (err) {
      setError(err.message);
    }
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.target.tagName === 'INPUT') return;

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
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [project]);

  // Playback
  useEffect(() => {
    if (isPlaying && project?.sourceUrl) {
      if (!audioRef.current) {
        audioRef.current = new Audio(project.sourceUrl);
        audioRef.current.volume = volume;
      }
      
      audioRef.current.currentTime = currentTime;
      audioRef.current.play();

      playbackRef.current = setInterval(() => {
        setCurrentTime(audioRef.current.currentTime);
        
        if (audioRef.current.currentTime >= project.trimEnd) {
          audioRef.current.pause();
          audioRef.current.currentTime = project.trimStart;
          setIsPlaying(false);
        }
      }, 100);
    } else {
      if (audioRef.current) {
        audioRef.current.pause();
      }
      if (playbackRef.current) {
        clearInterval(playbackRef.current);
      }
    }

    return () => {
      if (playbackRef.current) {
        clearInterval(playbackRef.current);
      }
    };
  }, [isPlaying, project]);

  const handleSeek = useCallback((time) => {
    setCurrentTime(time);
    if (audioRef.current) {
      audioRef.current.currentTime = time;
    }
  }, []);

  const handleUndo = useCallback(() => {
    const result = audioEditorService.undo();
    if (result) setProject(result);
  }, []);

  const handleRedo = useCallback(() => {
    const result = audioEditorService.redo();
    if (result) setProject(result);
  }, []);

  const handleLoadAudio = useCallback(async (file) => {
    try {
      const url = URL.createObjectURL(file);
      const audioInfo = await audioEditorService.loadAudio(url);
      
      setProject(audioEditorService.getCurrentProject());
      
      // Generate waveform
      const waveform = audioEditorService.generateWaveform();
      setWaveformData(waveform);
      
      console.log('[AudioEditor] Audio loaded:', audioInfo);
    } catch (err) {
      setError(err.message);
    }
  }, []);

  const handleAddEffect = useCallback((effectId) => {
    try {
      audioEditorService.addEffect(effectId);
      setProject(audioEditorService.getCurrentProject());
    } catch (err) {
      setError(err.message);
    }
  }, []);

  const handleUpdateEffect = useCallback((effectId, params) => {
    try {
      audioEditorService.updateEffect(effectId, params);
      setProject(audioEditorService.getCurrentProject());
    } catch (err) {
      setError(err.message);
    }
  }, []);

  const handleRemoveEffect = useCallback((effectId) => {
    try {
      audioEditorService.removeEffect(effectId);
      setProject(audioEditorService.getCurrentProject());
    } catch (err) {
      setError(err.message);
    }
  }, []);

  const handleToggleEffect = useCallback((effectId) => {
    try {
      audioEditorService.toggleEffect(effectId);
      setProject(audioEditorService.getCurrentProject());
    } catch (err) {
      setError(err.message);
    }
  }, []);

  const handleAddMarker = useCallback((time) => {
    try {
      audioEditorService.addMarker(time);
      setProject(audioEditorService.getCurrentProject());
    } catch (err) {
      setError(err.message);
    }
  }, []);

  const handleRemoveMarker = useCallback((markerId) => {
    try {
      audioEditorService.removeMarker(markerId);
      setProject(audioEditorService.getCurrentProject());
    } catch (err) {
      setError(err.message);
    }
  }, []);

  const handleVolumeChange = useCallback((newVolume) => {
    setVolume(newVolume);
    if (audioRef.current) {
      audioRef.current.volume = newVolume;
    }
  }, []);

  const handleTrimChange = useCallback((type, value) => {
    try {
      if (type === 'start') {
        audioEditorService.setTrimStart(value);
      } else {
        audioEditorService.setTrimEnd(value);
      }
      setProject(audioEditorService.getCurrentProject());
    } catch (err) {
      setError(err.message);
    }
  }, []);

  const handleExport = useCallback(async () => {
    try {
      setExporting(true);
      setExportProgress(0);
      
      const result = await audioEditorService.exportAudio('mp3', 192, (progress) => {
        setExportProgress(progress.progress);
      });
      
      console.log('[AudioEditor] Export complete:', result);
      alert('Audio exported successfully!');
    } catch (err) {
      setError(err.message);
    } finally {
      setExporting(false);
    }
  }, []);

  const handleSaveProject = useCallback(() => {
    try {
      audioEditorService.saveProject();
      alert('Project saved!');
    } catch (err) {
      setError(err.message);
    }
  }, []);

  const formatTime = (seconds) => {
    return audioEditorService.formatTime(seconds);
  };

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
          <h1 className="text-lg font-semibold">Audio Editor</h1>
          <span className="text-gray-500 text-sm">{project.name}</span>
        </div>
        <div className="flex items-center gap-2">
          <IconButton
            icon={FaUndo}
            onClick={handleUndo}
            disabled={!audioEditorService.canUndo()}
            title="Undo (Ctrl+Z)"
          />
          <IconButton
            icon={FaRedo}
            onClick={handleRedo}
            disabled={!audioEditorService.canRedo()}
            title="Redo (Ctrl+Shift+Z)"
          />
          <IconButton
            icon={FaDownload}
            onClick={handleSaveProject}
            title="Save Project"
          />
        </div>
      </header>

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Center - Waveform & Controls */}
        <main className="flex-1 flex flex-col overflow-hidden p-4">
          {/* Upload area or waveform */}
          <div className="flex-1 flex flex-col gap-4">
            {!project.sourceUrl ? (
              <div className="flex-1 flex items-center justify-center bg-gray-800 rounded-xl border-2 border-dashed border-gray-600">
                <label className="cursor-pointer text-center p-8">
                  <FaUpload className="text-5xl text-indigo-500 mx-auto mb-4" />
                  <p className="text-lg text-white mb-2">Drop audio file here or click to upload</p>
                  <p className="text-gray-500 text-sm">MP3, WAV, OGG supported</p>
                  <input
                    type="file"
                    accept="audio/*"
                    onChange={(e) => e.target.files?.[0] && handleLoadAudio(e.target.files[0])}
                    className="hidden"
                    aria-label="Upload audio file"
                  />
                </label>
              </div>
            ) : (
              <>
                {/* Waveform */}
                <div className="bg-gray-800 rounded-xl p-4">
                  <Waveform
                    waveformData={waveformData}
                    duration={project.duration}
                    currentTime={currentTime}
                    trimStart={project.trimStart}
                    trimEnd={project.trimEnd}
                    onSeek={handleSeek}
                    zoom={zoom}
                  />
                </div>

                {/* Time display */}
                <div className="flex items-center justify-center gap-4 text-lg">
                  <span className="text-indigo-400 font-mono">{formatTime(currentTime)}</span>
                  <span className="text-gray-500">/</span>
                  <span className="text-gray-400 font-mono">{formatTime(project.duration)}</span>
                </div>

                {/* Playback controls */}
                <div className="flex items-center justify-center gap-4">
                  <IconButton
                    icon={FaPlay}
                    onClick={() => setIsPlaying(!isPlaying)}
                    size="lg"
                    active={isPlaying}
                    title={isPlaying ? 'Pause' : 'Play'}
                  />
                </div>

                {/* Zoom controls */}
                <div className="flex items-center justify-center gap-4">
                  <button
                    onClick={() => setZoom((z) => Math.max(0.5, z - 0.2))}
                    className="p-2 bg-gray-700 hover:bg-gray-600 rounded-lg"
                    aria-label="Zoom out"
                  >
                    <FaCompressAlt />
                  </button>
                  <input
                    type="range"
                    min={0.5}
                    max={4}
                    step={0.1}
                    value={zoom}
                    onChange={(e) => setZoom(parseFloat(e.target.value))}
                    className="w-32"
                    aria-label="Zoom level"
                  />
                  <button
                    onClick={() => setZoom((z) => Math.min(4, z + 0.2))}
                    className="p-2 bg-gray-700 hover:bg-gray-600 rounded-lg"
                    aria-label="Zoom in"
                  >
                    <FaExpandAlt />
                  </button>
                </div>

                {/* Trim controls */}
                <div className="bg-gray-800 rounded-xl p-4">
                  <h3 className="text-white font-semibold mb-4">Trim</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-gray-400 text-sm">Start (s)</label>
                      <input
                        type="number"
                        min={0}
                        max={project.trimEnd}
                        step={0.1}
                        value={project.trimStart}
                        onChange={(e) => handleTrimChange('start', parseFloat(e.target.value))}
                        className="w-full bg-gray-700 text-white rounded px-3 py-2"
                        aria-label="Trim start"
                      />
                    </div>
                    <div>
                      <label className="text-gray-400 text-sm">End (s)</label>
                      <input
                        type="number"
                        min={project.trimStart}
                        max={project.duration}
                        step={0.1}
                        value={project.trimEnd}
                        onChange={(e) => handleTrimChange('end', parseFloat(e.target.value))}
                        className="w-full bg-gray-700 text-white rounded px-3 py-2"
                        aria-label="Trim end"
                      />
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </main>

        {/* Right sidebar - Effects & Markers */}
        <aside className="w-80 bg-gray-800 border-l border-gray-700 overflow-y-auto">
          <div className="p-4 space-y-4">
            {/* Tabs */}
            <div className="flex border-b border-gray-700">
              <button
                onClick={() => setActiveTab('effects')}
                className={`flex-1 py-2 text-center ${activeTab === 'effects' ? 'text-indigo-400 border-b-2 border-indigo-400' : 'text-gray-500'}`}
              >
                Effects
              </button>
              <button
                onClick={() => setActiveTab('markers')}
                className={`flex-1 py-2 text-center ${activeTab === 'markers' ? 'text-indigo-400 border-b-2 border-indigo-400' : 'text-gray-500'}`}
              >
                Markers
              </button>
            </div>

            {/* Effects panel */}
            {activeTab === 'effects' && (
              <EffectsPanel
                effects={project.effects}
                onAddEffect={handleAddEffect}
                onUpdateEffect={handleUpdateEffect}
                onRemoveEffect={handleRemoveEffect}
                onToggleEffect={handleToggleEffect}
              />
            )}

            {/* Markers panel */}
            {activeTab === 'markers' && (
              <MarkersPanel
                markers={project.markers}
                duration={project.duration}
                onAddMarker={handleAddMarker}
                onRemoveMarker={handleRemoveMarker}
              />
            )}

            {/* Export panel */}
            <div className="bg-gray-800 rounded-xl p-4 space-y-4">
              <h3 className="text-white font-semibold flex items-center gap-2">
                <FaDownload /> Export
              </h3>
              
              {/* Volume control */}
              <div>
                <label className="text-gray-400 text-sm flex items-center gap-2">
                  <FaVolumeUp /> Volume ({Math.round(volume * 100)}%)
                </label>
                <input
                  type="range"
                  min={0}
                  max={2}
                  step={0.05}
                  value={volume}
                  onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                  className="w-full"
                  aria-label="Volume"
                />
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
                    {exportProgress < 0.5 ? 'Processing...' : 'Encoding...'}
                  </p>
                </div>
              )}

              <button
                onClick={handleExport}
                disabled={!project.sourceUrl || exporting}
                className="w-full bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white py-3 rounded flex items-center justify-center gap-2"
                aria-label="Export audio"
              >
                <FaDownload /> {exporting ? 'Exporting...' : 'Export Audio'}
              </button>
            </div>
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

export { AUDIO_EDITOR_CONFIG };
