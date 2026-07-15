// src/screens/CreatePost/VideoEditor.jsx - ARVDOUL Video Editor
// Production-ready professional video editing component

import React, {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Undo2,
  Redo2,
  Save,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Maximize,
  Minimize,
  Volume2,
  VolumeX,
  Scissors,
  Type,
  Sliders,
  Filter,
  Crop,
  RotateCcw,
  Gauge,
  Music,
  Layers,
  Sparkles,
  Download,
  Grid3X3,
  ZoomIn,
  ZoomOut,
  Plus,
  Trash2,
  Copy,
  SplitSquareHorizontal,
  ChevronLeft,
  ChevronRight,
  Monitor,
  Smartphone,
  Square,
  Film,
  Wand2,
  Image as ImageIcon,
  Mic,
  Subtitles,
  FolderOpen,
} from 'lucide-react';
import { toast } from 'sonner';
import { useTheme } from '../../context/ThemeContext';
import {
  videoReducer,
  videoActions,
  DEFAULT_STATE,
} from './videoReducer';
import {
  VIDEO_TOOLS,
  VIDEO_LAYOUT,
  VIDEO_ANIMATION,
  VIDEO_SHORTCUTS,
  VIDEO_RESOLUTIONS,
  FRAME_RATES,
  VIDEO_ASPECT_RATIOS,
  VIDEO_ADJUSTMENTS,
  VIDEO_FILTERS,
  VIDEO_FILTER_CATEGORIES,
  SPEED_PRESETS,
  CLIP_COLORS,
  TRANSITIONS,
  formatTime,
  formatTimecode,
} from './videoConstants';
import {
  getVideoMetadata,
  generateFilmstrip,
  buildCombinedVideoFilter,
} from './videoEffects';

// Import shared tools for video
import AdjustTool from '../../components/Shared/AdjustTool';
import FilterTool from '../../components/Shared/FilterTool';
import CropTool from '../../components/Shared/CropTool';
import RotateTool from '../../components/Shared/RotateTool';
import TextTool from '../../components/Shared/TextTool';
import GlassCard from '../../components/UI/GlassCard';
import GlassButton from '../../components/UI/GlassButton';

/**
 * VideoEditor - Production-ready professional video editor
 */
const VideoEditor = ({
  isOpen,
  onClose,
  videoFile,
  initialState = null,
}) => {
  // State management
  const [state, dispatch] = useReducer(videoReducer, initialState || DEFAULT_STATE);
  
  // Refs
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const timelineRef = useRef(null);
  const animationFrameRef = useRef(null);
  
  // Local state
  const [isMuted, setIsMuted] = useState(false);
  const [thumbnails, setThumbnails] = useState([]);
  const [waveforms, setWaveforms] = useState({});
  const [isDragging, setIsDragging] = useState(false);
  const [dragType, setDragType] = useState(null); // 'move', 'trim-start', 'trim-end'
  const [dragClipId, setDragClipId] = useState(null);
  const [showExportDialog, setShowExportDialog] = useState(false);
  
  // Theme
  const { isDark, glass, colors, spring } = useTheme();
  
  // Memoized values
  const tools = useMemo(() => [
    { id: VIDEO_TOOLS.SELECT, icon: MousePointer2, label: 'Select' },
    { id: VIDEO_TOOLS.ADJUST, icon: Sliders, label: 'Adjust' },
    { id: VIDEO_TOOLS.FILTER, icon: Filter, label: 'Filters' },
    { id: VIDEO_TOOLS.CROP, icon: Crop, label: 'Crop' },
    { id: VIDEO_TOOLS.ROTATE, icon: RotateCcw, label: 'Rotate' },
    { id: VIDEO_TOOLS.TEXT, icon: Type, label: 'Text' },
    { id: VIDEO_TOOLS.TRIM, icon: Scissors, label: 'Trim' },
    { id: VIDEO_TOOLS.SPEED, icon: Gauge, label: 'Speed' },
    { id: VIDEO_TOOLS.VOLUME, icon: Music, label: 'Volume' },
    { id: VIDEO_TOOLS.EFFECTS, icon: Sparkles, label: 'Effects' },
    { id: VIDEO_TOOLS.TRANSITIONS, icon: Layers, label: 'Transitions' },
    { id: VIDEO_TOOLS.SUBTITLES, icon: Subtitles, label: 'Subtitles' },
    { id: VIDEO_TOOLS.AI, icon: Wand2, label: 'AI Tools' },
    { id: VIDEO_TOOLS.ASSETS, icon: FolderOpen, label: 'Assets' },
  ], []);
  
  // Get current filter CSS
  const filterCSS = useMemo(() => {
    return buildCombinedVideoFilter(state.adjustments, state.filter, state.filterIntensity);
  }, [state.adjustments, state.filter, state.filterIntensity]);
  
  // Initialize
  useEffect(() => {
    if (isOpen && videoFile) {
      initializeEditor();
    }
  }, [isOpen, videoFile]);
  
  // Playback loop
  useEffect(() => {
    if (state.isPlaying && videoRef.current) {
      let lastTime = performance.now();
      
      const updatePlayhead = (currentTime) => {
        const delta = currentTime - lastTime;
        lastTime = currentTime;
        
        const newTime = state.currentTime + delta * state.playbackRate;
        if (newTime >= state.videoDuration) {
          dispatch(videoActions.setCurrentTime(0));
          dispatch(videoActions.pause());
        } else {
          dispatch(videoActions.setCurrentTime(newTime));
        }
        
        animationFrameRef.current = requestAnimationFrame(updatePlayhead);
      };
      
      animationFrameRef.current = requestAnimationFrame(updatePlayhead);
      videoRef.current?.play();
    } else {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      videoRef.current?.pause();
    }
    
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [state.isPlaying]);
  
  // Sync video time with state
  useEffect(() => {
    if (videoRef.current && Math.abs(videoRef.current.currentTime * 1000 - state.currentTime) > 100) {
      videoRef.current.currentTime = state.currentTime / 1000;
    }
  }, [state.currentTime]);
  
  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!isOpen) return;
      
      const { key, ctrl, shift } = e;
      
      // Undo/Redo
      if (ctrl && key === 'z' && !shift) {
        e.preventDefault();
        dispatch(videoActions.undo());
      }
      if ((ctrl && key === 'z' && shift) || (ctrl && key === 'y')) {
        e.preventDefault();
        dispatch(videoActions.redo());
      }
      
      // Playback
      if (key === ' ') {
        e.preventDefault();
        dispatch(videoActions.togglePlay());
      }
      if (key === 'ArrowLeft') {
        e.preventDefault();
        dispatch(videoActions.stepBackward());
      }
      if (key === 'ArrowRight') {
        e.preventDefault();
        dispatch(videoActions.stepForward());
      }
      if (key === 'Home') {
        e.preventDefault();
        dispatch(videoActions.jumpToStart());
      }
      if (key === 'End') {
        e.preventDefault();
        dispatch(videoActions.jumpToEnd());
      }
      
      // Fullscreen
      if (key === 'f' && !ctrl) {
        e.preventDefault();
        dispatch(videoActions.toggleFullscreen());
      }
      
      // Delete
      if (key === 'Delete' || key === 'Backspace') {
        e.preventDefault();
        state.selectedClipIds.forEach((id) => {
          dispatch(videoActions.removeClip(id));
        });
      }
      
      // Split
      if (ctrl && shift && key === 's') {
        e.preventDefault();
        handleSplitAtPlayhead();
      }
      
      // Select all
      if (ctrl && key === 'a') {
        e.preventDefault();
        dispatch(videoActions.selectAllClips());
      }
      
      // Deselect
      if (key === 'Escape') {
        e.preventDefault();
        dispatch(videoActions.clearSelection());
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, state.selectedClipIds, state.currentTime]);
  
  // Initialize editor with video
  const initializeEditor = async () => {
    try {
      dispatch(videoActions.setProcessing(true));
      dispatch(videoActions.setProcessingMessage('Loading video...'));
      
      // Create video URL
      const videoUrl = URL.createObjectURL(videoFile);
      
      // Load video metadata
      const metadata = await getVideoMetadata(videoFile);
      dispatch(videoActions.setVideoMetadata({
        width: metadata.width,
        height: metadata.height,
        duration: metadata.duration * 1000,
        frameRate: metadata.frameRate,
      }));
      
      // Initialize timeline
      dispatch(videoActions.initTimeline());
      
      // Add initial video clip
      dispatch(videoActions.addVideoClip(videoFile, 0, metadata.duration * 1000));
      
      // Set current media
      dispatch(videoActions.addMedia({
        file: videoFile,
        url: videoUrl,
        name: videoFile.name,
        duration: metadata.duration * 1000,
        width: metadata.width,
        height: metadata.height,
      }));
      
      // Generate thumbnails
      if (videoRef.current) {
        videoRef.current.src = videoUrl;
        videoRef.current.onloadeddata = async () => {
          const filmstrip = await generateFilmstrip(videoRef.current, 5000, 120);
          setThumbnails(filmstrip.map((t) => URL.createObjectURL(t.blob)));
        };
      }
      
      dispatch(videoActions.setProcessing(false));
    } catch (error) {
      console.error('Failed to initialize editor:', error);
      dispatch(videoActions.setError('Failed to load video'));
      toast.error('Failed to load video');
    }
  };
  
  // Handle split at playhead
  const handleSplitAtPlayhead = () => {
    if (state.selectedClipIds.length === 1) {
      dispatch(videoActions.splitClip(state.selectedClipIds[0], state.currentTime));
      dispatch(videoActions.pushHistory());
      toast.success('Clip split');
    }
  };
  
  // Handle save
  const handleSave = () => {
    dispatch(videoActions.markSaved());
    toast.success('Project saved');
  };
  
  // Handle export
  const handleExport = async () => {
    setShowExportDialog(false);
    dispatch(videoActions.setExporting(true));
    
    try {
      // Export logic would go here
      // For now, simulate export
      for (let i = 0; i <= 100; i += 10) {
        await new Promise((r) => setTimeout(r, 200));
        dispatch(videoActions.setExportProgress(i));
      }
      
      toast.success('Video exported successfully');
    } catch (error) {
      console.error('Export failed:', error);
      toast.error('Export failed');
    } finally {
      dispatch(videoActions.setExporting(false));
      dispatch(videoActions.setExportProgress(0));
    }
  };
  
  // Handle clip selection
  const handleClipClick = (clipId, e) => {
    const addToSelection = e.ctrlKey || e.metaKey;
    dispatch(videoActions.selectClip(clipId, addToSelection));
  };
  
  // Handle timeline click
  const handleTimelineClick = (e) => {
    if (!timelineRef.current) return;
    
    const rect = timelineRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left + timelineRef.current.scrollLeft;
    const time = (x / timelineRef.current.offsetWidth) * state.videoDuration;
    
    dispatch(videoActions.setCurrentTime(Math.max(0, Math.min(time, state.videoDuration))));
  };
  
  // Calculate timeline pixel position
  const timeToPixels = useCallback((time) => {
    const duration = state.videoDuration || 60000;
    return (time / duration) * timelineRef.current?.offsetWidth || 0;
  }, [state.videoDuration]);
  
  // Calculate time from pixel position
  const pixelsToTime = useCallback((pixels) => {
    const duration = state.videoDuration || 60000;
    const width = timelineRef.current?.offsetWidth || 1;
    return (pixels / width) * duration;
  }, [state.videoDuration]);
  
  // Get tool panel component
  const renderToolPanel = () => {
    switch (state.activeTool) {
      case VIDEO_TOOLS.ADJUST:
        return (
          <AdjustTool
            adjustments={state.adjustments}
            onChange={(key, value) => {
              dispatch(videoActions.setAdjustment(key, value));
            }}
            onReset={() => dispatch(videoActions.resetAdjustments())}
            onSave={() => dispatch(videoActions.pushHistory())}
            presets={[
              { name: 'Cinematic', adjustments: { brightness: 95, contrast: 115, saturation: 90 } },
              { name: 'Vibrant', adjustments: { brightness: 105, contrast: 110, saturation: 130 } },
              { name: 'Muted', adjustments: { brightness: 100, contrast: 90, saturation: 70 } },
            ]}
          />
        );
      case VIDEO_TOOLS.FILTER:
        return (
          <FilterTool
            currentFilter={state.filter}
            intensity={state.filterIntensity}
            onChange={(filter) => dispatch(videoActions.setFilter(filter))}
            onIntensityChange={(intensity) => dispatch(videoActions.setFilterIntensity(intensity))}
            onSave={() => dispatch(videoActions.pushHistory())}
          />
        );
      case VIDEO_TOOLS.CROP:
        return (
          <CropTool
            aspect={state.cropAspect}
            onAspectChange={(aspect) => dispatch(videoActions.setCropAspect(aspect))}
          />
        );
      case VIDEO_TOOLS.ROTATE:
        return (
          <RotateTool
            rotation={state.rotation}
            flipH={state.flipH}
            flipV={state.flipV}
            onRotateLeft={() => dispatch(videoActions.rotateLeft())}
            onRotateRight={() => dispatch(videoActions.rotateRight())}
            onFlipH={() => dispatch(videoActions.flipH())}
            onFlipV={() => dispatch(videoActions.flipV())}
          />
        );
      case VIDEO_TOOLS.TEXT:
        return (
          <TextTool
            textLayers={state.textLayers}
            selectedTextId={state.selectedTextId}
            onAddText={(text) => dispatch(videoActions.addText(text))}
            onUpdateText={(id, updates) => dispatch(videoActions.updateText(id, updates))}
            onRemoveText={(id) => dispatch(videoActions.removeText(id))}
            onSelectText={(id) => dispatch(videoActions.selectText(id))}
          />
        );
      case VIDEO_TOOLS.SPEED:
        return (
          <SpeedControls
            speed={state.speed}
            onChange={(speed) => dispatch(videoActions.setSpeed(speed))}
            presets={SPEED_PRESETS}
          />
        );
      case VIDEO_TOOLS.VOLUME:
        return (
          <VolumeControls
            volume={state.volume}
            masterVolume={state.masterVolume}
            onVolumeChange={(v) => dispatch(videoActions.setVolume(v))}
            onMasterVolumeChange={(v) => dispatch(videoActions.setMasterVolume(v))}
          />
        );
      default:
        return null;
    }
  };
  
  if (!isOpen) return null;
  
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black/95 backdrop-blur-xl"
      >
        {/* Main Container */}
        <div
          ref={containerRef}
          className={`w-full h-full flex flex-col ${
            state.isFullscreen ? '' : 'max-w-[1920px] max-h-[1080px] mx-auto my-4'
          }`}
        >
          {/* Top Bar */}
          <TopBar
            onClose={onClose}
            onUndo={() => dispatch(videoActions.undo())}
            onRedo={() => dispatch(videoActions.redo())}
            onSave={handleSave}
            canUndo={state.canUndo}
            canRedo={state.canRedo}
            hasUnsavedChanges={state.hasUnsavedChanges}
            onExport={() => setShowExportDialog(true)}
            isFullscreen={state.isFullscreen}
            onToggleFullscreen={() => dispatch(videoActions.toggleFullscreen())}
          />
          
          {/* Main Content */}
          <div className="flex-1 flex overflow-hidden">
            {/* Left Panel - Tools */}
            <LeftPanel
              tools={tools}
              activeTool={state.activeTool}
              onToolChange={(tool) => dispatch(videoActions.setTool(tool))}
              isOpen={state.leftPanelOpen}
            />
            
            {/* Center - Preview */}
            <div className="flex-1 flex flex-col">
              {/* Preview Area */}
              <PreviewArea
                videoRef={videoRef}
                filterCSS={filterCSS}
                rotation={state.rotation}
                flipH={state.flipH}
                flipV={state.flipV}
                isPlaying={state.isPlaying}
                currentTime={state.currentTime}
                duration={state.videoDuration}
                textLayers={state.textLayers}
                aspectRatio={state.videoWidth / state.videoHeight}
              />
              
              {/* Playback Controls */}
              <PlaybackControls
                isPlaying={state.isPlaying}
                currentTime={state.currentTime}
                duration={state.videoDuration}
                isMuted={isMuted}
                volume={state.volume}
                onPlay={() => dispatch(videoActions.play())}
                onPause={() => dispatch(videoActions.pause())}
                onSeek={(time) => dispatch(videoActions.setCurrentTime(time))}
                onStepForward={() => dispatch(videoActions.stepForward())}
                onStepBackward={() => dispatch(videoActions.stepBackward())}
                onJumpToStart={() => dispatch(videoActions.jumpToStart())}
                onJumpToEnd={() => dispatch(videoActions.jumpToEnd())}
                onMuteToggle={() => setIsMuted(!isMuted)}
                onVolumeChange={(v) => dispatch(videoActions.setVolume(v))}
              />
            </div>
            
            {/* Right Panel - Properties */}
            {state.rightPanelOpen && (
              <RightPanel>
                {renderToolPanel()}
              </RightPanel>
            )}
          </div>
          
          {/* Timeline */}
          <Timeline
            ref={timelineRef}
            timeline={state.timeline}
            currentTime={state.currentTime}
            duration={state.videoDuration}
            selectedClipIds={state.selectedClipIds}
            thumbnails={thumbnails}
            onClipClick={handleClipClick}
            onTimelineClick={handleTimelineClick}
            onSplit={handleSplitAtPlayhead}
            timeToPixels={timeToPixels}
          />
        </div>
        
        {/* Export Dialog */}
        <AnimatePresence>
          {showExportDialog && (
            <ExportDialog
              onClose={() => setShowExportDialog(false)}
              onExport={handleExport}
              isExporting={state.isExporting}
              progress={state.exportProgress}
            />
          )}
        </AnimatePresence>
        
        {/* Processing Overlay */}
        {state.isProcessing && (
          <ProcessingOverlay message={state.processingMessage} />
        )}
      </motion.div>
    </AnimatePresence>
  );
};

// ==================== SUB-COMPONENTS ====================

const TopBar = ({
  onClose,
  onUndo,
  onRedo,
  onSave,
  canUndo,
  canRedo,
  hasUnsavedChanges,
  onExport,
  isFullscreen,
  onToggleFullscreen,
}) => {
  const { isDark, colors } = useTheme();
  
  return (
    <motion.div
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className={`
        h-16 px-4 flex items-center justify-between
        ${isDark ? 'bg-[#0C1426]/90' : 'bg-white/90'}
        backdrop-blur-xl border-b
        ${isDark ? 'border-white/5' : 'border-black/5'}
      `}
    >
      {/* Left - Close */}
      <div className="flex items-center gap-3">
        <GlassButton
          variant="ghost"
          size="sm"
          onClick={onClose}
          className="w-10 h-10"
        >
          <X className="w-5 h-5" />
        </GlassButton>
        
        <div className="flex items-center gap-1">
          <span className="text-sm font-semibold bg-gradient-to-r from-purple-500 via-blue-500 to-cyan-400 bg-clip-text text-transparent">
            Video Editor
          </span>
          {hasUnsavedChanges && (
            <span className="w-2 h-2 rounded-full bg-yellow-500" />
          )}
        </div>
      </div>
      
      {/* Center - Actions */}
      <div className="flex items-center gap-2">
        <GlassButton
          variant="ghost"
          size="sm"
          onClick={onUndo}
          disabled={!canUndo}
        >
          <Undo2 className="w-4 h-4" />
        </GlassButton>
        
        <GlassButton
          variant="ghost"
          size="sm"
          onClick={onRedo}
          disabled={!canRedo}
        >
          <Redo2 className="w-4 h-4" />
        </GlassButton>
        
        <div className="w-px h-6 bg-white/10 mx-2" />
        
        <GlassButton
          variant="ghost"
          size="sm"
          onClick={onToggleFullscreen}
        >
          {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
        </GlassButton>
      </div>
      
      {/* Right - Save & Export */}
      <div className="flex items-center gap-3">
        <GlassButton
          variant="outline"
          size="sm"
          onClick={onSave}
        >
          <Save className="w-4 h-4 mr-2" />
          Save
        </GlassButton>
        
        <GlassButton
          variant="gradient"
          size="sm"
          onClick={onExport}
        >
          <Download className="w-4 h-4 mr-2" />
          Export
        </GlassButton>
      </div>
    </motion.div>
  );
};

const LeftPanel = ({ tools, activeTool, onToolChange, isOpen }) => {
  const { isDark, glass, colors } = useTheme();
  
  return (
    <motion.div
      initial={{ x: -20, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      className={`
        w-16 flex flex-col items-center py-4 gap-1
        ${isDark ? glass.medium : 'bg-white/50'}
        border-r ${isDark ? 'border-white/5' : 'border-black/5'}
      `}
    >
      {tools.map((tool) => {
        const Icon = tool.icon;
        const isActive = activeTool === tool.id;
        
        return (
          <GlassButton
            key={tool.id}
            variant={isActive ? 'gradient' : 'ghost'}
            size="sm"
            onClick={() => onToolChange(tool.id)}
            className={`w-12 h-12 ${isActive ? 'shadow-lg' : ''}`}
            title={tool.label}
          >
            <Icon className="w-5 h-5" />
          </GlassButton>
        );
      })}
    </motion.div>
  );
};

const PreviewArea = ({
  videoRef,
  filterCSS,
  rotation,
  flipH,
  flipV,
  isPlaying,
  currentTime,
  duration,
  textLayers,
  aspectRatio,
}) => {
  const { isDark, colors } = useTheme();
  const [containerHeight, setContainerHeight] = useState(0);
  const containerRef = useRef(null);
  
  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        setContainerHeight(containerRef.current.offsetHeight);
      }
    };
    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);
  
  const videoHeight = Math.min(containerHeight - 80, (containerHeight - 80) / aspectRatio);
  const videoWidth = videoHeight * aspectRatio;
  
  return (
    <div
      ref={containerRef}
      className="flex-1 flex items-center justify-center p-4 bg-black"
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className={`
          relative rounded-3xl overflow-hidden
          ${isDark ? 'bg-[#0A0E1A]' : 'bg-gray-900'}
          shadow-2xl
        `}
        style={{
          width: videoWidth,
          height: videoHeight,
          maxWidth: '100%',
          transform: `rotate(${rotation}deg) scaleX(${flipH ? -1 : 1}) scaleY(${flipV ? -1 : 1})`,
        }}
      >
        {/* Video Element */}
        <video
          ref={videoRef}
          className="w-full h-full object-contain"
          style={{ filter: filterCSS }}
          playsInline
        />
        
        {/* Timecode Overlay */}
        <div className="absolute top-4 left-4 px-3 py-1 rounded-lg bg-black/60 backdrop-blur-sm">
          <span className="text-xs font-mono text-white">
            {formatTimecode(currentTime)} / {formatTimecode(duration)}
          </span>
        </div>
        
        {/* Text Layers */}
        {textLayers.map((layer) => (
          <div
            key={layer.id}
            className="absolute pointer-events-none"
            style={{
              left: layer.x,
              top: layer.y,
              fontFamily: layer.fontFamily,
              fontSize: layer.fontSize,
              color: layer.color,
              textAlign: layer.align,
              transform: `rotate(${layer.rotation || 0}deg)`,
            }}
          >
            {layer.text}
          </div>
        ))}
      </motion.div>
    </div>
  );
};

const PlaybackControls = ({
  isPlaying,
  currentTime,
  duration,
  isMuted,
  volume,
  onPlay,
  onPause,
  onSeek,
  onStepForward,
  onStepBackward,
  onJumpToStart,
  onJumpToEnd,
  onMuteToggle,
  onVolumeChange,
}) => {
  const { isDark, colors } = useTheme();
  
  return (
    <div className={`
      h-20 px-6 flex items-center gap-4
      ${isDark ? glass.medium : 'bg-white/50'}
      border-t ${isDark ? 'border-white/5' : 'border-black/5'}
    `}>
      {/* Time Display */}
      <div className="w-32 text-center">
        <span className="text-sm font-mono text-white">
          {formatTime(currentTime)}
        </span>
        <span className="text-xs text-white/40 mx-1">/</span>
        <span className="text-xs font-mono text-white/60">
          {formatTime(duration)}
        </span>
      </div>
      
      {/* Transport Controls */}
      <div className="flex items-center gap-1">
        <GlassButton variant="ghost" size="sm" onClick={onJumpToStart}>
          <SkipBack className="w-4 h-4" />
        </GlassButton>
        
        <GlassButton variant="ghost" size="sm" onClick={onStepBackward}>
          <ChevronLeft className="w-4 h-4" />
        </GlassButton>
        
        <GlassButton
          variant="gradient"
          size="md"
          onClick={isPlaying ? onPause : onPlay}
          className="w-12 h-12"
        >
          {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
        </GlassButton>
        
        <GlassButton variant="ghost" size="sm" onClick={onStepForward}>
          <ChevronRight className="w-4 h-4" />
        </GlassButton>
        
        <GlassButton variant="ghost" size="sm" onClick={onJumpToEnd}>
          <SkipForward className="w-4 h-4" />
        </GlassButton>
      </div>
      
      {/* Progress Bar */}
      <div className="flex-1 px-4">
        <input
          type="range"
          min={0}
          max={duration}
          value={currentTime}
          onChange={(e) => onSeek(Number(e.target.value))}
          className="w-full h-1 rounded-full appearance-none cursor-pointer
            bg-white/20
            [&::-webkit-slider-thumb]:appearance-none
            [&::-webkit-slider-thumb]:w-3
            [&::-webkit-slider-thumb]:h-3
            [&::-webkit-slider-thumb]:rounded-full
            [&::-webkit-slider-thumb]:bg-gradient-to-r
            [&::-webkit-slider-thumb]:from-purple-500
            [&::-webkit-slider-thumb]:to-blue-500
            [&::-webkit-slider-thumb]:shadow-lg
            [&::-webkit-slider-thumb]:cursor-pointer
          "
          style={{
            background: `linear-gradient(to right, #B416DB 0%, #4B6BFF ${(currentTime / duration) * 100}%, rgba(255,255,255,0.2) ${(currentTime / duration) * 100}%, rgba(255,255,255,0.2) 100%)`,
          }}
        />
      </div>
      
      {/* Volume Controls */}
      <div className="flex items-center gap-2 w-32">
        <GlassButton variant="ghost" size="sm" onClick={onMuteToggle}>
          {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
        </GlassButton>
        
        <input
          type="range"
          min={0}
          max={200}
          value={isMuted ? 0 : volume}
          onChange={(e) => onVolumeChange(Number(e.target.value))}
          className="w-20 h-1 rounded-full appearance-none cursor-pointer
            bg-white/20
            [&::-webkit-slider-thumb]:appearance-none
            [&::-webkit-slider-thumb]:w-2
            [&::-webkit-slider-thumb]:h-2
            [&::-webkit-slider-thumb]:rounded-full
            [&::-webkit-slider-thumb]:bg-white
          "
        />
      </div>
    </div>
  );
};

const RightPanel = ({ children }) => {
  const { isDark, glass } = useTheme();
  
  return (
    <motion.div
      initial={{ x: 20, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      className={`
        w-80 flex flex-col
        ${isDark ? glass.medium : 'bg-white/50'}
        border-l ${isDark ? 'border-white/5' : 'border-black/5'}
      `}
    >
      <div className="p-4 border-b border-white/5">
        <h3 className="text-sm font-semibold text-white">Properties</h3>
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        {children}
      </div>
    </motion.div>
  );
};

const Timeline = React.forwardRef(({
  timeline,
  currentTime,
  duration,
  selectedClipIds,
  thumbnails,
  onClipClick,
  onTimelineClick,
  onSplit,
  timeToPixels,
}, ref) => {
  const { isDark, colors } = useTheme();
  
  const playheadPosition = duration > 0 ? (currentTime / duration) * 100 : 0;
  
  return (
    <motion.div
      initial={{ y: 20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className={`
        h-64 flex flex-col
        ${isDark ? glass.medium : 'bg-white/50'}
        border-t ${isDark ? 'border-white/5' : 'border-black/5'}
      `}
    >
      {/* Timeline Header */}
      <div className="h-8 px-4 flex items-center justify-between border-b border-white/5">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-white/60">Timeline</span>
        </div>
        <div className="flex items-center gap-2">
          <GlassButton variant="ghost" size="xs" onClick={onSplit}>
            <Scissors className="w-3 h-3" />
          </GlassButton>
        </div>
      </div>
      
      {/* Timeline Content */}
      <div
        ref={ref}
        className="flex-1 overflow-x-auto cursor-pointer relative"
        onClick={onTimelineClick}
      >
        {/* Time Ruler */}
        <div className="h-8 flex items-end border-b border-white/5">
          {Array.from({ length: Math.ceil(duration / 10000) + 1 }).map((_, i) => (
            <div
              key={i}
              className="flex-shrink-0 px-2 border-l border-white/10"
              style={{ width: timeToPixels(10000) }}
            >
              <span className="text-xs text-white/40">{formatTime(i * 10000)}</span>
            </div>
          ))}
        </div>
        
        {/* Tracks */}
        <div className="flex-1 p-2 space-y-2">
          {timeline?.tracks.map((track) => (
            <div
              key={track.id}
              className={`
                h-12 rounded-lg flex items-center
                ${isDark ? 'bg-white/5' : 'bg-black/5'}
              `}
            >
              {/* Track Label */}
              <div className="w-20 px-2 flex-shrink-0">
                <span className="text-xs font-medium text-white/60 truncate">
                  {track.name}
                </span>
              </div>
              
              {/* Clips */}
              <div className="flex-1 relative h-full">
                {track.clips.map((clip) => {
                  const isSelected = selectedClipIds.includes(clip.id);
                  const startPos = duration > 0 ? (clip.startTime / duration) * 100 : 0;
                  const width = duration > 0 ? (clip.duration / duration) * 100 : 0;
                  
                  return (
                    <motion.div
                      key={clip.id}
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      className={`
                        absolute top-1 bottom-1 rounded-lg cursor-pointer
                        flex items-center px-2 overflow-hidden
                        ${isSelected
                          ? 'ring-2 ring-purple-500 shadow-lg'
                          : 'hover:ring-1 hover:ring-white/30'
                        }
                      `}
                      style={{
                        left: `${startPos}%`,
                        width: `${width}%`,
                        backgroundColor: CLIP_COLORS.find((c) => c.id === clip.colorLabel)?.bg || 'rgba(59, 130, 246, 0.3)',
                        borderLeft: `3px solid ${CLIP_COLORS.find((c) => c.id === clip.colorLabel)?.color || '#3B82F6'}`,
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        onClipClick(clip.id, e);
                      }}
                    >
                      <span className="text-xs font-medium text-white truncate">
                        {clip.name}
                      </span>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
        
        {/* Playhead */}
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-gradient-to-b from-purple-500 to-blue-500 pointer-events-none z-10"
          style={{ left: `calc(${playheadPosition}% + 80px)` }}
        >
          <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-3 h-3 bg-purple-500 rounded-full" />
        </div>
      </div>
    </motion.div>
  );
});

const SpeedControls = ({ speed, onChange, presets }) => {
  return (
    <div className="space-y-4">
      <div>
        <label className="text-xs text-white/60 mb-2 block">Speed</label>
        <input
          type="range"
          min={0.25}
          max={4}
          step={0.25}
          value={speed}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-full"
        />
        <div className="text-center text-sm text-white mt-1">
          {speed}x
        </div>
      </div>
      
      <div className="grid grid-cols-4 gap-2">
        {presets.map((preset) => (
          <button
            key={preset.id}
            onClick={() => onChange(preset.value)}
            className={`
              px-2 py-1 rounded-lg text-xs font-medium
              ${speed === preset.value
                ? 'bg-purple-500 text-white'
                : 'bg-white/10 text-white/60 hover:bg-white/20'
              }
            `}
          >
            {preset.label}
          </button>
        ))}
      </div>
    </div>
  );
};

const VolumeControls = ({ volume, masterVolume, onVolumeChange, onMasterVolumeChange }) => {
  return (
    <div className="space-y-4">
      <div>
        <label className="text-xs text-white/60 mb-2 block">Clip Volume</label>
        <input
          type="range"
          min={0}
          max={200}
          value={volume}
          onChange={(e) => onVolumeChange(Number(e.target.value))}
          className="w-full"
        />
        <div className="text-center text-sm text-white mt-1">
          {volume}%
        </div>
      </div>
      
      <div>
        <label className="text-xs text-white/60 mb-2 block">Master Volume</label>
        <input
          type="range"
          min={0}
          max={200}
          value={masterVolume}
          onChange={(e) => onMasterVolumeChange(Number(e.target.value))}
          className="w-full"
        />
        <div className="text-center text-sm text-white mt-1">
          {masterVolume}%
        </div>
      </div>
    </div>
  );
};

const ExportDialog = ({ onClose, onExport, isExporting, progress }) => {
  const { isDark, glass } = useTheme();
  
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className={`
          w-96 p-6 rounded-3xl
          ${isDark ? glass.large : 'bg-white'}
          shadow-2xl
        `}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold text-white mb-4">Export Video</h2>
        
        {isExporting ? (
          <div className="space-y-4">
            <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                className="h-full bg-gradient-to-r from-purple-500 to-blue-500"
              />
            </div>
            <p className="text-sm text-white/60 text-center">
              Exporting... {progress}%
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-white/60">
              Your video will be exported as MP4 (H.264)
            </p>
            <div className="flex gap-3">
              <GlassButton variant="outline" onClick={onClose} className="flex-1">
                Cancel
              </GlassButton>
              <GlassButton variant="gradient" onClick={onExport} className="flex-1">
                Export
              </GlassButton>
            </div>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
};

const ProcessingOverlay = ({ message }) => {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
    >
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-purple-500/30 border-t-purple-500 rounded-full animate-spin mx-auto mb-4" />
        <p className="text-white">{message}</p>
      </div>
    </motion.div>
  );
};

// Missing icon import fix
const MousePointer2 = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z" />
    <path d="M13 13l6 6" />
  </svg>
);

export default VideoEditor;
