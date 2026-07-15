// src/screens/CreatePost/ImageEditor.jsx - ARVDOUL Ultimate Image Editor
// Production-grade image editor with world-class design

import React, {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  forwardRef,
  useImperativeHandle,
  memo,
  Suspense,
} from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Stage,
  Layer,
  Image as KonvaImage,
  Text as KonvaText,
  Transformer,
  Rect,
  Line,
  Group,
  Circle,
} from 'react-konva';
import Cropper from 'react-easy-crop';
import { toast } from 'sonner';
import * as Icons from 'lucide-react';
import useMediaQuery from '../../hooks/useMediaQuery';

// Design system imports
import {
  ARVDOUL_GRADIENT,
  ARVDOUL_SHADOW,
  ARVDOUL_GLOW,
  TOKENS,
  THEME_TOKENS,
  TOOLS,
  ADJUSTMENTS,
  FILTERS,
  ASPECT_RATIOS,
  AI_TOOLS,
  GOOGLE_FONTS,
  SHORTCUTS,
  CANVAS,
  HISTORY,
  LAYOUT,
  ANIMATION,
  FILTER_CATEGORIES,
} from './editorConstants';

// Reducer imports
import {
  editorReducer,
  DEFAULT_STATE,
  ACTIONS,
  actions,
  selectors,
  getFilterCSS,
  getTransformCSS,
} from './editorReducer';

// Utilities imports
import {
  loadImage,
  createCanvas,
  drawImageWithAdjustments,
  canvasToBlob,
  downloadCanvas,
  generateThumbnail,
  debounce,
  cleanupImage,
} from './imageEffects';

// Existing component imports
import AdjustTool from '../../components/Shared/AdjustTool';
import FilterTool from '../../components/Shared/FilterTool';
import CropTool from '../../components/Shared/CropTool';
import RotateTool from '../../components/Shared/RotateTool';
import TextTool from '../../components/Shared/TextTool';
import DrawingTool from '../../components/Shared/DrawingTool';
import GIFPicker from '../../components/Shared/GIFPicker';
import LoadingSpinner from '../../components/Shared/LoadingSpinner';

// ==================== CONSTANTS ====================

const DNA_GRADIENT = ARVDOUL_GRADIENT;
const DNA_SHADOW = ARVDOUL_SHADOW;

// ==================== MAIN COMPONENT ====================

const ImageEditor = memo(forwardRef(function ImageEditor(
  { media, onClose, onSave, offline = false, isDark: initialDark = true },
  ref
) {
  // ========== STATE ==========
  const [state, dispatch] = useReducer(editorReducer, DEFAULT_STATE);
  const [theme, setTheme] = useState(initialDark ? 'dark' : 'light');
  const [imageElement, setImageElement] = useState(null);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const [showAIPanel, setShowAIPanel] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [croppedImageUrl, setCroppedImageUrl] = useState(null);
  const [textPosition, setTextPosition] = useState({ x: 0, y: 0 });
  
  // Refs
  const canvasContainerRef = useRef(null);
  const stageRef = useRef(null);
  const transformerRef = useRef(null);
  const fileInputRef = useRef(null);
  const textInputRef = useRef(null);
  const containerRef = useRef(null);
  const abortControllerRef = useRef(null);
  
  // Media query hooks
  const isMobile = useMediaQuery('(max-width: 768px)');
  const isTablet = useMediaQuery('(min-width: 768px) and (max-width: 1024px)');
  const isDesktop = useMediaQuery('(min-width: 1024px)');
  const isLandscape = useMediaQuery('(orientation: landscape)');
  
  // Theme tokens
  const tokens = THEME_TOKENS[theme] || THEME_TOKENS.dark;
  
  // ========== LOAD IMAGE ==========
  useEffect(() => {
    if (!media) return;
    
    const loadMediaImage = async () => {
      try {
        dispatch(actions.setProcessing(true));
        
        let imageSource;
        if (media.file) {
          imageSource = media.file;
        } else if (media.url) {
          imageSource = media.url;
        } else if (media.preview) {
          imageSource = media.preview;
        } else {
          throw new Error('No image source available');
        }
        
        const img = await loadImage(imageSource);
        setImageElement(img);
        
        dispatch(actions.setImage({
          src: img.src,
          originalWidth: img.naturalWidth,
          originalHeight: img.naturalHeight,
          width: img.naturalWidth,
          height: img.naturalHeight,
          file: media.file,
        }));
        
        dispatch(actions.setCanvasSize(img.naturalWidth, img.naturalHeight));
        dispatch(actions.setCrop({
          x: 0,
          y: 0,
          width: img.naturalWidth,
          height: img.naturalHeight,
        }));
        
        dispatch(actions.setImageLoaded(true));
        dispatch(actions.pushHistory());
        
      } catch (error) {
        console.error('Failed to load image:', error);
        toast.error('Failed to load image. Please try again.');
      } finally {
        dispatch(actions.setProcessing(false));
      }
    };
    
    loadMediaImage();
    
    return () => {
      if (imageElement) {
        cleanupImage(imageElement);
      }
      if (croppedImageUrl) {
        URL.revokeObjectURL(croppedImageUrl);
      }
    };
  }, [media]);
  
  // ========== KEYBOARD SHORTCUTS ==========
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Skip if typing in input
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      
      const { key, ctrlKey, metaKey, shiftKey } = e;
      const cmdKey = ctrlKey || metaKey;
      
      // Undo: Ctrl+Z
      if (cmdKey && key === 'z' && !shiftKey) {
        e.preventDefault();
        dispatch(actions.undo());
        toast.info('Undo');
      }
      
      // Redo: Ctrl+Shift+Z or Ctrl+Y
      if ((cmdKey && key === 'z' && shiftKey) || (cmdKey && key === 'y')) {
        e.preventDefault();
        dispatch(actions.redo());
        toast.info('Redo');
      }
      
      // Save: Ctrl+S
      if (cmdKey && key === 's') {
        e.preventDefault();
        handleSave();
      }
      
      // Delete: Delete or Backspace
      if (key === 'Delete' || key === 'Backspace') {
        e.preventDefault();
        if (state.selectedTextId) {
          dispatch(actions.deleteText(state.selectedTextId));
          dispatch(actions.pushHistory());
        }
      }
      
      // Deselect: Escape
      if (key === 'Escape') {
        e.preventDefault();
        dispatch(actions.deselectText());
        dispatch(actions.clearSelection());
        dispatch(actions.setTool(TOOLS.SELECT));
        setShowAIPanel(false);
      }
      
      // Zoom In: Ctrl++
      if (cmdKey && (key === '=' || key === '+')) {
        e.preventDefault();
        dispatch(actions.setZoom(state.canvas.zoom + CANVAS.ZOOM_STEP));
      }
      
      // Zoom Out: Ctrl+-
      if (cmdKey && key === '-') {
        e.preventDefault();
        dispatch(actions.setZoom(state.canvas.zoom - CANVAS.ZOOM_STEP));
      }
      
      // Fit to Screen: Ctrl+0
      if (cmdKey && key === '0') {
        e.preventDefault();
        handleFitToScreen();
      }
      
      // Toggle Grid: Ctrl+'
      if (cmdKey && key === "'") {
        e.preventDefault();
        dispatch(actions.toggleGrid());
      }
      
      // Toggle Snap: Ctrl+;
      if (cmdKey && key === ';') {
        e.preventDefault();
        dispatch(actions.toggleSnap());
      }
      
      // Tool shortcuts
      if (!cmdKey && !shiftKey) {
        switch (key.toLowerCase()) {
          case 'v': dispatch(actions.setTool(TOOLS.SELECT)); break;
          case 'a': dispatch(actions.setTool(TOOLS.ADJUST)); break;
          case 'f': dispatch(actions.setTool(TOOLS.FILTER)); break;
          case 'c': dispatch(actions.setTool(TOOLS.CROP)); break;
          case 'r': dispatch(actions.setTool(TOOLS.ROTATE)); break;
          case 't': dispatch(actions.setTool(TOOLS.TEXT)); break;
          case 'd': dispatch(actions.setTool(TOOLS.DRAW)); break;
          case 'g': dispatch(actions.setTool(TOOLS.GIF)); break;
          case 'i': setShowAIPanel(!showAIPanel); break;
        }
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [state, showAIPanel]);
  
  // ========== CANVAS CALCULATIONS ==========
  const containerSize = useMemo(() => {
    if (!canvasContainerRef.current) return { width: 800, height: 600 };
    const rect = canvasContainerRef.current.getBoundingClientRect();
    return { width: rect.width, height: rect.height };
  }, [isMobile, isTablet, isDesktop]);
  
  const stageSize = useMemo(() => {
    const padding = 40;
    const availableWidth = containerSize.width - padding * 2;
    const availableHeight = containerSize.height - padding * 2;
    
    const imageAspect = state.image.width / state.image.height;
    const containerAspect = availableWidth / availableHeight;
    
    let width, height;
    if (imageAspect > containerAspect) {
      width = Math.min(availableWidth, state.image.width);
      height = width / imageAspect;
    } else {
      height = Math.min(availableHeight, state.image.height);
      width = height * imageAspect;
    }
    
    return {
      width: Math.max(100, width),
      height: Math.max(100, height),
      scale: Math.min(width / state.image.width, height / state.image.height),
    };
  }, [containerSize, state.image]);
  
  // ========== HANDLE FUNCTIONS ==========
  const handleSave = useCallback(async () => {
    if (isSaving) return;
    
    try {
      setIsSaving(true);
      
      // Create a canvas with the final image
      const canvas = createCanvas(state.image.width, state.image.height);
      const ctx = canvas.getContext('2d');
      
      // Draw the image with filters
      const img = new Image();
      img.crossOrigin = 'anonymous';
      
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
        img.src = croppedImageUrl || imageElement?.src || state.image.src;
      });
      
      // Apply transformations
      ctx.save();
      
      // Center and apply rotation/flip
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate((state.rotation * Math.PI) / 180);
      if (state.flipH) ctx.scale(-1, 1);
      if (state.flipV) ctx.scale(1, -1);
      ctx.translate(-canvas.width / 2, -canvas.height / 2);
      
      // Apply filter
      ctx.filter = getFilterCSS(state);
      
      // Draw image
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      ctx.restore();
      
      // Convert to blob
      const blob = await canvasToBlob(canvas, 'image/png', 0.95);
      
      // Create result object
      const result = {
        blob,
        url: URL.createObjectURL(blob),
        file: new File([blob], media?.name || 'edited-image.png', { type: 'image/png' }),
        width: canvas.width,
        height: canvas.height,
        edited: true,
      };
      
      // Cleanup
      URL.revokeObjectURL(result.url);
      
      onSave?.(result);
      toast.success('Image saved successfully!');
      
    } catch (error) {
      console.error('Save error:', error);
      toast.error('Failed to save image. Please try again.');
    } finally {
      setIsSaving(false);
    }
  }, [state, croppedImageUrl, imageElement, media, onSave, isSaving]);
  
  const handleFitToScreen = useCallback(() => {
    dispatch(actions.setZoom(1));
    dispatch(actions.setPan(0, 0));
  }, []);
  
  const handleZoomIn = useCallback(() => {
    dispatch(actions.setZoom(state.canvas.zoom + CANVAS.ZOOM_STEP));
  }, [state.canvas.zoom]);
  
  const handleZoomOut = useCallback(() => {
    dispatch(actions.setZoom(state.canvas.zoom - CANVAS.ZOOM_STEP));
  }, [state.canvas.zoom]);
  
  const handleResetAdjustments = useCallback(() => {
    dispatch(actions.resetAdjustments());
    dispatch(actions.pushHistory());
  }, []);
  
  const handleApplyCrop = useCallback(async () => {
    if (!croppedAreaPixels) {
      toast.error('Please select a crop area');
      return;
    }
    
    try {
      dispatch(actions.setProcessing(true));
      
      // Create cropped canvas
      const croppedCanvas = createCanvas(croppedAreaPixels.width, croppedAreaPixels.height);
      const ctx = croppedCanvas.getContext('2d');
      
      const img = new Image();
      img.crossOrigin = 'anonymous';
      
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
        img.src = imageElement?.src || state.image.src;
      });
      
      ctx.drawImage(
        img,
        croppedAreaPixels.x,
        croppedAreaPixels.y,
        croppedAreaPixels.width,
        croppedAreaPixels.height,
        0,
        0,
        croppedAreaPixels.width,
        croppedAreaPixels.height
      );
      
      const croppedUrl = croppedCanvas.toDataURL('image/png');
      setCroppedImageUrl(croppedUrl);
      
      dispatch(actions.applyCrop({
        width: croppedAreaPixels.width,
        height: croppedAreaPixels.height,
      }));
      
      dispatch(actions.pushHistory());
      dispatch(actions.setTool(TOOLS.SELECT));
      dispatch(actions.setMode('edit'));
      
      toast.success('Crop applied!');
      
    } catch (error) {
      console.error('Crop error:', error);
      toast.error('Failed to apply crop');
    } finally {
      dispatch(actions.setProcessing(false));
    }
  }, [croppedAreaPixels, imageElement, state.image.src]);
  
  const handleAddText = useCallback((text) => {
    const centerX = containerSize.width / 2;
    const centerY = containerSize.height / 2;
    
    dispatch(actions.addText({
      text,
      x: centerX / stageSize.scale,
      y: centerY / stageSize.scale,
    }));
    dispatch(actions.pushHistory());
    dispatch(actions.setTool(TOOLS.SELECT));
  }, [containerSize, stageSize.scale]);
  
  const handleUpdateText = useCallback((id, updates) => {
    dispatch(actions.updateText(id, updates));
  }, []);
  
  const handleDeleteText = useCallback((id) => {
    dispatch(actions.deleteText(id));
    dispatch(actions.pushHistory());
  }, []);
  
  const handleQuickAddText = useCallback((text) => {
    handleAddText(text);
  }, [handleAddText]);
  
  const handleCropComplete = useCallback((croppedArea, croppedAreaPixels) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);
  
  const handleCropChange = useCallback((crop) => {
    dispatch(actions.setCrop(crop));
  }, []);
  
  // Debounced push history for sliders
  const debouncedPushHistory = useMemo(
    () => debounce(() => dispatch(actions.pushHistory()), HISTORY.DEBOUNCE_DELAY),
    []
  );
  
  // ========== STYLES ==========
  const styles = useMemo(() => ({
    overlay: {
      position: 'fixed',
      inset: 0,
      zIndex: 1000,
      background: tokens.overlay,
      backdropFilter: 'blur(20px)',
    },
    container: {
      position: 'relative',
      width: '100%',
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      background: tokens.bg,
    },
    topBar: {
      height: LAYOUT.topBar.height,
      padding: `0 ${LAYOUT.topBar.padding}px`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      background: 'transparent',
      flexShrink: 0,
    },
    headerGlass: {
      width: '100%',
      padding: '12px 20px',
      borderRadius: TOKENS.radius.card,
      background: tokens.glass,
      border: `1px solid ${tokens.glassBorder}`,
      backdropFilter: `blur(${TOKENS.glass.blur}px)`,
      boxShadow: tokens.shadow,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    mainContent: {
      flex: 1,
      display: 'flex',
      overflow: 'hidden',
      padding: '16px',
      gap: '16px',
    },
    leftPanel: {
      width: isMobile ? '100%' : LAYOUT.leftPanel.width,
      borderRadius: TOKENS.radius.card,
      background: tokens.glass,
      border: `1px solid ${tokens.glassBorder}`,
      backdropFilter: `blur(${TOKENS.glass.blur}px)`,
      boxShadow: tokens.elevation,
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      transition: 'all 0.3s ease',
    },
    rightPanel: {
      width: isMobile ? '100%' : LAYOUT.rightPanel.width,
      borderRadius: TOKENS.radius.card,
      background: tokens.glass,
      border: `1px solid ${tokens.glassBorder}`,
      backdropFilter: `blur(${TOKENS.glass.blur}px)`,
      boxShadow: tokens.elevation,
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      transition: 'all 0.3s ease',
    },
    canvasContainer: {
      flex: 1,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: TOKENS.radius.canvas,
      background: tokens.canvas,
      boxShadow: `inset 0 0 60px ${tokens.grid}`,
      overflow: 'hidden',
      position: 'relative',
    },
    gridOverlay: {
      position: 'absolute',
      inset: 0,
      pointerEvents: 'none',
      backgroundImage: `
        linear-gradient(${tokens.grid} 1px, transparent 1px),
        linear-gradient(90deg, ${tokens.grid} 1px, transparent 1px)
      `,
      backgroundSize: `${CANVAS.GRID_SIZE}px ${CANVAS.GRID_SIZE}px`,
      opacity: state.showGrid ? 1 : 0,
    },
  }), [tokens, isMobile, state.showGrid]);
  
  // ========== TOOLBAR ==========
  const ToolButton = memo(({ tool, icon: Icon, label, shortcut, isActive, onClick }) => (
    <motion.button
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      onClick={onClick}
      className={`
        relative flex flex-col items-center justify-center p-3 rounded-2xl
        transition-all duration-200 group
        ${isActive 
          ? 'bg-gradient-to-br from-purple-600 to-cyan-500 text-white shadow-lg' 
          : 'bg-white/10 hover:bg-white/20 text-white/80'
        }
      `}
      style={{ width: 56, height: 56 }}
      title={`${label}${shortcut ? ` (${shortcut})` : ''}`}
      aria-label={label}
    >
      <Icon className="w-6 h-6" />
      <span className="text-[10px] mt-1 font-medium opacity-80">{label}</span>
      {isActive && (
        <motion.div
          layoutId="activeTool"
          className="absolute inset-0 rounded-2xl border-2 border-white/30"
          initial={false}
        />
      )}
    </motion.button>
  ));
  
  // ========== RENDER ==========
  return (
    <div style={styles.overlay}>
      <div style={styles.container} ref={containerRef}>
        {/* Top Bar */}
        <div style={styles.topBar}>
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            style={styles.headerGlass}
          >
            {/* Left: Close & Undo/Redo */}
            <div className="flex items-center gap-3">
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={onClose}
                className="flex items-center justify-center w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
                aria-label="Close editor"
              >
                <Icons.X className="w-5 h-5 text-white" />
              </motion.button>
              
              <div className="h-8 w-px bg-white/20" />
              
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => dispatch(actions.undo())}
                disabled={!selectors.canUndo(state)}
                className="flex items-center justify-center w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 transition-colors disabled:opacity-30"
                aria-label="Undo (Ctrl+Z)"
              >
                <Icons.Undo2 className="w-5 h-5 text-white" />
              </motion.button>
              
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => dispatch(actions.redo())}
                disabled={!selectors.canRedo(state)}
                className="flex items-center justify-center w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 transition-colors disabled:opacity-30"
                aria-label="Redo (Ctrl+Shift+Z)"
              >
                <Icons.Redo2 className="w-5 h-5 text-white" />
              </motion.button>
            </div>
            
            {/* Center: Title */}
            <div className="flex items-center gap-3">
              <Icons.Image className="w-5 h-5 text-white/80" />
              <h2 className="text-lg font-bold text-white tracking-tight">
                Image Editor
              </h2>
            </div>
            
            {/* Right: Save */}
            <div className="flex items-center gap-3">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleSave}
                disabled={isSaving}
                className="flex items-center gap-2 px-5 py-2.5 rounded-full text-white font-semibold text-sm"
                style={{
                  background: DNA_GRADIENT,
                  boxShadow: DNA_SHADOW,
                }}
                aria-label="Save (Ctrl+S)"
              >
                {isSaving ? (
                  <LoadingSpinner size={16} />
                ) : (
                  <Icons.Check className="w-4 h-4" />
                )}
                <span>Save</span>
              </motion.button>
            </div>
          </motion.div>
        </div>
        
        {/* Main Content */}
        <div style={styles.mainContent}>
          {/* Left Panel - Tools */}
          {!isMobile && (
            <AnimatePresence>
              {state.leftPanelOpen && (
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  style={styles.leftPanel}
                >
                  {/* Tool Tabs */}
                  <div className="p-3 border-b border-white/10">
                    <div className="flex gap-2">
                      <button
                        onClick={() => dispatch(actions.setActiveTab('tools'))}
                        className={`flex-1 py-2 px-3 rounded-xl text-xs font-medium transition-colors ${
                          state.activeTab === 'tools' 
                            ? 'bg-white/20 text-white' 
                            : 'text-white/60 hover:text-white'
                        }`}
                      >
                        Tools
                      </button>
                      <button
                        onClick={() => dispatch(actions.setActiveTab('layers'))}
                        className={`flex-1 py-2 px-3 rounded-xl text-xs font-medium transition-colors ${
                          state.activeTab === 'layers' 
                            ? 'bg-white/20 text-white' 
                            : 'text-white/60 hover:text-white'
                        }`}
                      >
                        Layers
                      </button>
                      <button
                        onClick={() => {
                          setShowAIPanel(!showAIPanel);
                          dispatch(actions.setActiveTab('ai'));
                        }}
                        className={`flex-1 py-2 px-3 rounded-xl text-xs font-medium transition-colors flex items-center justify-center gap-1 ${
                          showAIPanel 
                            ? 'bg-gradient-to-r from-purple-600 to-cyan-500 text-white' 
                            : 'text-white/60 hover:text-white'
                        }`}
                      >
                        <Icons.Sparkles className="w-3 h-3" />
                        AI
                      </button>
                    </div>
                  </div>
                  
                  {/* Tool Content */}
                  <div className="flex-1 overflow-y-auto p-4">
                    {state.activeTab === 'tools' && (
                      <div className="space-y-3">
                        {/* Basic Tools */}
                        <div className="space-y-2">
                          <p className="text-[10px] uppercase tracking-wider text-white/40 font-semibold">Basic</p>
                          <div className="grid grid-cols-2 gap-2">
                            <ToolButton
                              tool={TOOLS.SELECT}
                              icon={Icons.MousePointer2}
                              label="Select"
                              shortcut="V"
                              isActive={state.activeTool === TOOLS.SELECT}
                              onClick={() => dispatch(actions.setTool(TOOLS.SELECT))}
                            />
                            <ToolButton
                              tool={TOOLS.ADJUST}
                              icon={Icons.SlidersHorizontal}
                              label="Adjust"
                              shortcut="A"
                              isActive={state.activeTool === TOOLS.ADJUST}
                              onClick={() => dispatch(actions.setTool(TOOLS.ADJUST))}
                            />
                            <ToolButton
                              tool={TOOLS.FILTER}
                              icon={Icons.Filter}
                              label="Filter"
                              shortcut="F"
                              isActive={state.activeTool === TOOLS.FILTER}
                              onClick={() => dispatch(actions.setTool(TOOLS.FILTER))}
                            />
                            <ToolButton
                              tool={TOOLS.CROP}
                              icon={Icons.Crop}
                              label="Crop"
                              shortcut="C"
                              isActive={state.activeTool === TOOLS.CROP}
                              onClick={() => {
                                dispatch(actions.setTool(TOOLS.CROP));
                                dispatch(actions.setMode('crop'));
                              }}
                            />
                            <ToolButton
                              tool={TOOLS.ROTATE}
                              icon={Icons.RotateCw}
                              label="Rotate"
                              shortcut="R"
                              isActive={state.activeTool === TOOLS.ROTATE}
                              onClick={() => dispatch(actions.setTool(TOOLS.ROTATE))}
                            />
                            <ToolButton
                              tool={TOOLS.TEXT}
                              icon={Icons.Type}
                              label="Text"
                              shortcut="T"
                              isActive={state.activeTool === TOOLS.TEXT}
                              onClick={() => dispatch(actions.setTool(TOOLS.TEXT))}
                            />
                          </div>
                        </div>
                        
                        {/* Advanced Tools */}
                        <div className="space-y-2 pt-3 border-t border-white/10">
                          <p className="text-[10px] uppercase tracking-wider text-white/40 font-semibold">Advanced</p>
                          <div className="grid grid-cols-2 gap-2">
                            <ToolButton
                              tool={TOOLS.DRAW}
                              icon={Icons.Pencil}
                              label="Draw"
                              shortcut="D"
                              isActive={state.activeTool === TOOLS.DRAW}
                              onClick={() => dispatch(actions.setTool(TOOLS.DRAW))}
                            />
                            <ToolButton
                              tool={TOOLS.GIF}
                              icon={Icons.FileImage}
                              label="GIF"
                              shortcut="G"
                              isActive={state.activeTool === TOOLS.GIF}
                              onClick={() => dispatch(actions.setTool(TOOLS.GIF))}
                            />
                          </div>
                        </div>
                      </div>
                    )}
                    
                    {state.activeTab === 'layers' && (
                      <div className="space-y-3">
                        <p className="text-sm font-semibold text-white">Layers</p>
                        {state.textLayers.length === 0 && (
                          <p className="text-xs text-white/50 text-center py-4">
                            No layers yet. Add text to create layers.
                          </p>
                        )}
                        {state.textLayers.map((layer) => (
                          <motion.div
                            key={layer.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className={`
                              p-3 rounded-xl cursor-pointer transition-colors
                              ${state.selectedTextId === layer.id 
                                ? 'bg-white/20 border border-white/30' 
                                : 'bg-white/5 hover:bg-white/10 border border-transparent'
                              }
                            `}
                            onClick={() => dispatch(actions.selectText(layer.id))}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <Icons.Type className="w-4 h-4 text-white/60" />
                                <span className="text-sm text-white truncate max-w-[150px]">
                                  {layer.text}
                                </span>
                              </div>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  dispatch(actions.deleteText(layer.id));
                                }}
                                className="p-1 rounded hover:bg-white/20"
                              >
                                <Icons.Trash2 className="w-3 h-3 text-red-400" />
                              </button>
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    )}
                    
                    {showAIPanel && (
                      <div className="space-y-3">
                        <p className="text-sm font-semibold text-white">AI Tools</p>
                        <p className="text-xs text-white/50">Coming soon</p>
                        {AI_TOOLS.map((tool) => (
                          <motion.button
                            key={tool.id}
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            className="w-full p-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-left transition-colors"
                          >
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-600/30 to-cyan-500/30 flex items-center justify-center">
                                <Icons.Sparkles className="w-5 h-5 text-white/80" />
                              </div>
                              <div>
                                <p className="text-sm font-medium text-white">{tool.title}</p>
                                <p className="text-xs text-white/50">{tool.description}</p>
                              </div>
                            </div>
                          </motion.button>
                        ))}
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          )}
          
          {/* Center - Canvas */}
          <div style={styles.canvasContainer} ref={canvasContainerRef}>
            {state.showGrid && <div style={styles.gridOverlay} />}
            
            {state.isProcessing ? (
              <div className="flex items-center justify-center">
                <LoadingSpinner size={60} />
              </div>
            ) : state.mode === 'crop' ? (
              /* Crop Mode */
              <div className="relative w-full h-full">
                <Cropper
                  image={croppedImageUrl || imageElement?.src || ''}
                  crop={state.crop}
                  zoom={state.cropZoom}
                  aspect={state.cropAspect}
                  onCropChange={handleCropChange}
                  onCropComplete={handleCropComplete}
                  onZoomChange={(zoom) => dispatch(actions.setCropZoom(zoom))}
                  style={{
                    containerStyle: {
                      background: tokens.canvas,
                    },
                    cropAreaStyle: {
                      borderRadius: TOKENS.radius.card,
                    },
                  }}
                />
                
                {/* Crop Controls */}
                <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-3 p-2 rounded-full"
                  style={{
                    background: 'rgba(0,0,0,0.7)',
                    backdropFilter: 'blur(10px)',
                  }}
                >
                  <CropTool
                    aspect={state.cropAspect}
                    setAspect={(aspect) => dispatch(actions.setCropAspect(aspect))}
                    zoom={state.cropZoom}
                    onZoomChange={(zoom) => dispatch(actions.setCropZoom(zoom))}
                    onCropChangeWithUndo={() => {}}
                    onCropComplete={handleCropComplete}
                    pushUndo={() => dispatch(actions.pushHistory())}
                    setCrop={(crop) => dispatch(actions.setCrop(crop))}
                    setZoom={(zoom) => dispatch(actions.setCropZoom(zoom))}
                    setCroppedAreaPixels={setCroppedAreaPixels}
                  />
                </div>
              </div>
            ) : (
              /* Edit Mode - Canvas */
              <div
                className="relative"
                style={{
                  width: stageSize.width,
                  height: stageSize.height,
                }}
              >
                <Stage
                  ref={stageRef}
                  width={stageSize.width}
                  height={stageSize.height}
                  scaleX={state.canvas.zoom}
                  scaleY={state.canvas.zoom}
                  x={state.canvas.panX}
                  y={state.canvas.panY}
                  draggable={state.activeTool === TOOLS.SELECT}
                  onDragEnd={(e) => {
                    dispatch(actions.setPan(e.target.x(), e.target.y()));
                  }}
                >
                  {/* Background Layer */}
                  <Layer>
                    <Rect
                      x={-1000}
                      y={-1000}
                      width={3000}
                      height={3000}
                      fill="#1a1a2e"
                      opacity={0.5}
                    />
                  </Layer>
                  
                  {/* Image Layer */}
                  <Layer>
                    {imageElement && (
                      <KonvaImage
                        image={imageElement}
                        x={0}
                        y={0}
                        width={state.image.width}
                        height={state.image.height}
                        filters={[]}
                        style={{
                          filter: getFilterCSS(state),
                        }}
                        rotation={state.rotation}
                        scaleX={state.flipH ? -1 : 1}
                        scaleY={state.flipV ? -1 : 1}
                        offsetX={state.flipH ? state.image.width : 0}
                        offsetY={state.flipV ? state.image.height : 0}
                      />
                    )}
                  </Layer>
                  
                  {/* Text Layers */}
                  <Layer>
                    {state.textLayers.map((textLayer) => (
                      <KonvaText
                        key={textLayer.id}
                        x={textLayer.x}
                        y={textLayer.y}
                        text={textLayer.text}
                        fontSize={textLayer.fontSize}
                        fontFamily={textLayer.fontFamily}
                        fill={textLayer.color}
                        fontStyle={
                          `${textLayer.fontWeight || 'normal'} ${textLayer.fontStyle || 'normal'}`
                        }
                        align={textLayer.textAlign}
                        width={300}
                        rotation={textLayer.rotation}
                        opacity={textLayer.opacity / 100}
                        draggable={state.activeTool === TOOLS.SELECT && !state.layerLocked[textLayer.id]}
                        onClick={() => dispatch(actions.selectText(textLayer.id))}
                        onTap={() => dispatch(actions.selectText(textLayer.id))}
                        onDragEnd={(e) => {
                          dispatch(actions.updateText(textLayer.id, {
                            x: e.target.x(),
                            y: e.target.y(),
                          }));
                        }}
                        shadowColor={textLayer.shadowEnabled ? textLayer.shadowColor : undefined}
                        shadowBlur={textLayer.shadowEnabled ? textLayer.shadowBlur : 0}
                        shadowOffsetX={textLayer.shadowEnabled ? textLayer.shadowX : 0}
                        shadowOffsetY={textLayer.shadowEnabled ? textLayer.shadowY : 0}
                        stroke={textLayer.strokeWidth > 0 ? textLayer.strokeColor : undefined}
                        strokeWidth={textLayer.strokeWidth}
                      />
                    ))}
                    
                    {/* Transformer for selected text */}
                    {state.selectedTextId && (
                      <Transformer
                        ref={transformerRef}
                        boundBoxFunc={(oldBox, newBox) => {
                          if (newBox.width < 10 || newBox.height < 10) {
                            return oldBox;
                          }
                          return newBox;
                        }}
                      />
                    )}
                  </Layer>
                </Stage>
                
                {/* Text Input (for adding new text) */}
                {state.activeTool === TOOLS.TEXT && (
                  <div
                    className="absolute inset-0 flex items-center justify-center bg-black/30"
                    onClick={(e) => {
                      if (e.target === e.currentTarget) {
                        const rect = canvasContainerRef.current.getBoundingClientRect();
                        const x = (e.clientX - rect.left) / state.canvas.zoom;
                        const y = (e.clientY - rect.top) / state.canvas.zoom;
                        setTextPosition({ x, y });
                      }
                    }}
                  >
                    <div className="bg-black/80 backdrop-blur-xl rounded-2xl p-4 w-80">
                      <p className="text-white text-sm mb-3">Click on canvas to add text, or type below:</p>
                      <input
                        ref={textInputRef}
                        type="text"
                        placeholder="Enter text..."
                        className="w-full px-4 py-2.5 rounded-xl bg-white/10 text-white placeholder-gray-400 border border-white/20 focus:border-purple-500 outline-none text-sm"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && e.target.value) {
                            handleAddText(e.target.value);
                            e.target.value = '';
                          }
                        }}
                      />
                      <div className="flex gap-2 mt-3">
                        <button
                          onClick={() => dispatch(actions.setTool(TOOLS.SELECT))}
                          className="flex-1 py-2 rounded-xl bg-white/10 text-white/80 text-sm"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => {
                            if (textInputRef.current?.value) {
                              handleAddText(textInputRef.current.value);
                              textInputRef.current.value = '';
                            }
                          }}
                          className="flex-1 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-cyan-500 text-white text-sm font-semibold"
                        >
                          Add Text
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
            
            {/* Zoom Controls */}
            <div
              className="absolute bottom-6 right-6 flex items-center gap-2 p-1 rounded-full"
              style={{
                background: 'rgba(0,0,0,0.6)',
                backdropFilter: 'blur(10px)',
              }}
            >
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={handleZoomOut}
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/20 transition-colors"
              >
                <Icons.Minus className="w-4 h-4 text-white" />
              </motion.button>
              
              <span className="text-xs text-white font-medium w-12 text-center">
                {Math.round(state.canvas.zoom * 100)}%
              </span>
              
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={handleZoomIn}
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/20 transition-colors"
              >
                <Icons.Plus className="w-4 h-4 text-white" />
              </motion.button>
              
              <div className="w-px h-6 bg-white/20 mx-1" />
              
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={handleFitToScreen}
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/20 transition-colors"
                title="Fit to screen (Ctrl+0)"
              >
                <Icons.Maximize2 className="w-4 h-4 text-white" />
              </motion.button>
            </div>
          </div>
          
          {/* Right Panel - Properties */}
          {!isMobile && (
            <AnimatePresence>
              {state.rightPanelOpen && (
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  style={styles.rightPanel}
                >
                  <div className="p-4 border-b border-white/10">
                    <h3 className="text-sm font-semibold text-white">
                      {state.activeTool === TOOLS.ADJUST && 'Adjustments'}
                      {state.activeTool === TOOLS.FILTER && 'Filters'}
                      {state.activeTool === TOOLS.ROTATE && 'Rotation'}
                      {state.activeTool === TOOLS.TEXT && 'Text'}
                      {state.activeTool === TOOLS.SELECT && 'Properties'}
                    </h3>
                  </div>
                  
                  <div className="flex-1 overflow-y-auto p-4">
                    {/* Adjust Tool */}
                    {state.activeTool === TOOLS.ADJUST && (
                      <AdjustTool
                        brightness={state.adjustments.brightness}
                        setBrightness={(val) => {
                          dispatch(actions.setAdjustment('brightness', val));
                          debouncedPushHistory();
                        }}
                        contrast={state.adjustments.contrast}
                        setContrast={(val) => {
                          dispatch(actions.setAdjustment('contrast', val));
                          debouncedPushHistory();
                        }}
                        saturation={state.adjustments.saturation}
                        setSaturation={(val) => {
                          dispatch(actions.setAdjustment('saturation', val));
                          debouncedPushHistory();
                        }}
                        resetAdjustments={handleResetAdjustments}
                        pushUndo={() => dispatch(actions.pushHistory())}
                      />
                    )}
                    
                    {/* Filter Tool */}
                    {state.activeTool === TOOLS.FILTER && (
                      <FilterTool
                        filter={state.filter}
                        setFilter={(val) => {
                          dispatch(actions.setFilter(val));
                          dispatch(actions.pushHistory());
                        }}
                        filterIntensity={state.filterIntensity}
                        setFilterIntensity={(val) => dispatch(actions.setFilterIntensity(val))}
                        pushUndo={() => dispatch(actions.pushHistory())}
                      />
                    )}
                    
                    {/* Rotate Tool */}
                    {state.activeTool === TOOLS.ROTATE && (
                      <div className="space-y-4">
                        <RotateTool
                          onRotateLeft={() => {
                            dispatch(actions.rotateLeft());
                            dispatch(actions.pushHistory());
                          }}
                          onRotateRight={() => {
                            dispatch(actions.rotateRight());
                            dispatch(actions.pushHistory());
                          }}
                        />
                        
                        <div className="space-y-3">
                          <div className="flex items-center gap-3">
                            <Icons.FlipHorizontal className="w-4 h-4 text-white/60" />
                            <button
                              onClick={() => {
                                dispatch(actions.flipH());
                                dispatch(actions.pushHistory());
                              }}
                              className={`flex-1 py-2 rounded-xl text-sm font-medium transition-colors ${
                                state.flipH 
                                  ? 'bg-white/20 text-white' 
                                  : 'bg-white/10 text-white/60 hover:bg-white/15'
                              }`}
                            >
                              Flip Horizontal
                            </button>
                          </div>
                          
                          <div className="flex items-center gap-3">
                            <Icons.FlipVertical className="w-4 h-4 text-white/60" />
                            <button
                              onClick={() => {
                                dispatch(actions.flipV());
                                dispatch(actions.pushHistory());
                              }}
                              className={`flex-1 py-2 rounded-xl text-sm font-medium transition-colors ${
                                state.flipV 
                                  ? 'bg-white/20 text-white' 
                                  : 'bg-white/10 text-white/60 hover:bg-white/15'
                              }`}
                            >
                              Flip Vertical
                            </button>
                          </div>
                        </div>
                        
                        <div className="space-y-2 pt-3 border-t border-white/10">
                          <label className="text-xs text-white/60">Free Rotation</label>
                          <div className="flex items-center gap-3">
                            <input
                              type="range"
                              min={-180}
                              max={180}
                              value={state.rotation}
                              onChange={(e) => dispatch(actions.setFreeRotation(Number(e.target.value)))}
                              onPointerUp={() => dispatch(actions.pushHistory())}
                              className="flex-1 accent-purple-500"
                            />
                            <span className="text-xs text-white/60 w-12 text-right">{state.rotation}°</span>
                          </div>
                        </div>
                      </div>
                    )}
                    
                    {/* Text Tool */}
                    {state.activeTool === TOOLS.TEXT && (
                      <TextTool
                        selectedText={state.textLayers.find(t => t.id === state.selectedTextId)}
                        updateSelectedText={(updates) => {
                          if (state.selectedTextId) {
                            dispatch(actions.updateText(state.selectedTextId, updates));
                            debouncedPushHistory();
                          }
                        }}
                        handleDeleteText={handleDeleteText}
                        handleQuickAddText={handleQuickAddText}
                        imageElement={imageElement}
                        pushUndo={() => dispatch(actions.pushHistory())}
                      />
                    )}
                    
                    {/* Select Tool (Properties) */}
                    {state.activeTool === TOOLS.SELECT && !state.selectedTextId && (
                      <div className="space-y-4">
                        <p className="text-sm text-white/60 text-center py-8">
                          Select a layer or use tools to edit
                        </p>
                        
                        {/* View Options */}
                        <div className="space-y-2 pt-4 border-t border-white/10">
                          <p className="text-xs text-white/40 uppercase tracking-wider">View</p>
                          
                          <div className="flex items-center justify-between py-2">
                            <div className="flex items-center gap-2">
                              <Icons.Grid3X3 className="w-4 h-4 text-white/60" />
                              <span className="text-sm text-white/80">Grid</span>
                            </div>
                            <button
                              onClick={() => dispatch(actions.toggleGrid())}
                              className={`w-10 h-6 rounded-full transition-colors ${
                                state.showGrid 
                                  ? 'bg-gradient-to-r from-purple-600 to-cyan-500' 
                                  : 'bg-white/20'
                              }`}
                            >
                              <div className={`w-4 h-4 rounded-full bg-white transition-transform ${
                                state.showGrid ? 'translate-x-5' : 'translate-x-1'
                              }`} />
                            </button>
                          </div>
                          
                          <div className="flex items-center justify-between py-2">
                            <div className="flex items-center gap-2">
                              <Icons.Magnet className="w-4 h-4 text-white/60" />
                              <span className="text-sm text-white/80">Snap</span>
                            </div>
                            <button
                              onClick={() => dispatch(actions.toggleSnap())}
                              className={`w-10 h-6 rounded-full transition-colors ${
                                state.snapEnabled 
                                  ? 'bg-gradient-to-r from-purple-600 to-cyan-500' 
                                  : 'bg-white/20'
                              }`}
                            >
                              <div className={`w-4 h-4 rounded-full bg-white transition-transform ${
                                state.snapEnabled ? 'translate-x-5' : 'translate-x-1'
                              }`} />
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          )}
        </div>
        
        {/* Mobile Bottom Toolbar */}
        {isMobile && (
          <motion.div
            initial={{ y: 100 }}
            animate={{ y: 0 }}
            className="p-3 border-t border-white/10"
            style={{
              background: 'rgba(0,0,0,0.8)',
              backdropFilter: 'blur(20px)',
            }}
          >
            <div className="flex items-center justify-around">
              <button
                onClick={() => dispatch(actions.setTool(TOOLS.SELECT))}
                className={`p-3 rounded-xl transition-colors ${
                  state.activeTool === TOOLS.SELECT ? 'bg-white/20' : ''
                }`}
              >
                <Icons.MousePointer2 className="w-6 h-6 text-white" />
              </button>
              <button
                onClick={() => dispatch(actions.setTool(TOOLS.ADJUST))}
                className={`p-3 rounded-xl transition-colors ${
                  state.activeTool === TOOLS.ADJUST ? 'bg-white/20' : ''
                }`}
              >
                <Icons.SlidersHorizontal className="w-6 h-6 text-white" />
              </button>
              <button
                onClick={() => dispatch(actions.setTool(TOOLS.FILTER))}
                className={`p-3 rounded-xl transition-colors ${
                  state.activeTool === TOOLS.FILTER ? 'bg-white/20' : ''
                }`}
              >
                <Icons.Filter className="w-6 h-6 text-white" />
              </button>
              <button
                onClick={() => {
                  dispatch(actions.setTool(TOOLS.CROP));
                  dispatch(actions.setMode('crop'));
                }}
                className={`p-3 rounded-xl transition-colors ${
                  state.activeTool === TOOLS.CROP ? 'bg-white/20' : ''
                }`}
              >
                <Icons.Crop className="w-6 h-6 text-white" />
              </button>
              <button
                onClick={() => dispatch(actions.setTool(TOOLS.TEXT))}
                className={`p-3 rounded-xl transition-colors ${
                  state.activeTool === TOOLS.TEXT ? 'bg-white/20' : ''
                }`}
              >
                <Icons.Type className="w-6 h-6 text-white" />
              </button>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}));

ImageEditor.displayName = 'ImageEditor';

export default ImageEditor;
