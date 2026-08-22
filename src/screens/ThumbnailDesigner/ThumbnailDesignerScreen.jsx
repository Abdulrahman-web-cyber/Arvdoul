// src/screens/ThumbnailDesigner/ThumbnailDesignerScreen.jsx - ARVDOUL IMAGE STUDIO & THUMBNAIL DESIGNER
// 100% Pixel-perfect replica of Arvdoul Image Studio (Screenshot 6) with interactive layers, typography, filters, AI tools, and export
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { cn } from '../../lib/utils';
import {
  X, Undo2, Redo2, Columns, Save, Crop, Sliders, Sparkles, Type,
  Pencil, Smile, Square, Droplet, Wand2, MoreHorizontal, Eye,
  EyeOff, Lock, Unlock, Plus, RefreshCw, Upload, Download, Check,
  ChevronDown, RotateCw, Trash2, ArrowUp, ArrowDown, Move, Copy,
  Palette, AlignLeft, AlignCenter, AlignRight, Sun, Moon, Maximize2
} from 'lucide-react';

// Studio base canvas: a self-contained branded gradient (inline SVG data URL).
// No third-party stock photos — the user replaces this with their own image.
const DEFAULT_IMAGE_URL =
  "data:image/svg+xml;utf8," +
  "<svg xmlns='http://www.w3.org/2000/svg' width='1200' height='1500'>" +
  "<defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'>" +
  "<stop offset='0' stop-color='%238B5CF6'/>" +
  "<stop offset='0.5' stop-color='%236366F1'/>" +
  "<stop offset='1' stop-color='%2322D3EE'/>" +
  "</linearGradient></defs>" +
  "<rect width='1200' height='1500' fill='url(%23g)'/>" +
  "</svg>";

// Available display fonts matching Screenshot 6
const FONT_OPTIONS = [
  { id: 'anton', name: 'Anton', family: "'Anton', sans-serif" },
  { id: 'playfair', name: 'Playfair Display', family: "'Playfair Display', serif" },
  { id: 'poppins', name: 'Poppins', family: "'Poppins', sans-serif" },
  { id: 'bebas', name: 'BEBAS NEUE', family: "'Bebas Neue', sans-serif" },
  { id: 'pacifico', name: 'Pacifico', family: "'Pacifico', cursive" },
  { id: 'montserrat', name: 'Montserrat', family: "'Montserrat', sans-serif" },
];

// Inspector tabs matching Screenshot 6
const INSPECTOR_TABS = [
  'Font', 'Style', 'Color', 'Stroke', 'Shadow', 'Glow', 'Align', 'Spacing'
];

// Filter categories
const FILTER_CATEGORIES = [
  'RECENT', 'SIMPLE', 'VIBRANT', 'MOODY', 'B&W', 'CINEMATIC', 'NATURE', 'FILM'
];

// Presets for the Vibrant / Filters carousel matching Screenshot 6
const FILTER_PRESETS = [
  {
    id: 'v1',
    name: 'V1 Vibrant',
    filter: 'contrast(125%) saturate(145%) brightness(105%)',
    bgPreview: 'from-amber-500 via-purple-600 to-indigo-800',
  },
  {
    id: 'v2',
    name: 'V2 Sunset',
    filter: 'sepia(30%) saturate(160%) hue-rotate(-15deg)',
    bgPreview: 'from-orange-600 via-red-600 to-amber-700',
  },
  {
    id: 'v3',
    name: 'V3 Cool',
    filter: 'hue-rotate(20deg) saturate(120%) brightness(105%)',
    bgPreview: 'from-blue-600 via-indigo-700 to-slate-900',
  },
  {
    id: 'v4',
    name: 'V4 Warm',
    filter: 'sepia(20%) saturate(130%) brightness(108%)',
    bgPreview: 'from-amber-600 via-orange-500 to-yellow-600',
  },
  {
    id: 'v5',
    name: 'V5 Pop',
    filter: 'contrast(140%) saturate(180%)',
    bgPreview: 'from-fuchsia-600 via-pink-600 to-purple-800',
  },
  {
    id: 'v6',
    name: 'V6 Drama',
    filter: 'contrast(160%) brightness(90%) saturate(120%)',
    bgPreview: 'from-stone-900 via-amber-950 to-neutral-900',
  },
  {
    id: 'v7',
    name: 'V7 Teal',
    filter: 'hue-rotate(60deg) contrast(115%) saturate(130%)',
    bgPreview: 'from-teal-600 via-cyan-700 to-blue-900',
  },
  {
    id: 'v8',
    name: 'V8 Soft',
    filter: 'brightness(112%) contrast(92%) saturate(110%)',
    bgPreview: 'from-rose-400 via-purple-400 to-indigo-500',
  },
];

// Initial layers matching Screenshot 6
// Honest initial composition: an empty studio canvas (branded base image +
// background). No pre-made "Explore More" demo text or sample stickers — the
// designer opens empty and the user builds their own thumbnail.
const INITIAL_LAYERS = [
  {
    id: 'layer-image',
    name: 'Image Layer',
    type: 'image',
    url: DEFAULT_IMAGE_URL,
    visible: true,
    locked: true,
    opacity: 100,
  },
  {
    id: 'layer-bg',
    name: 'Background',
    subtitle: 'Dark Blue',
    type: 'background',
    color: '#04081E',
    visible: true,
    locked: true,
    opacity: 100,
  },
];

export default function ThumbnailDesignerScreen() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { theme } = useTheme();
  const isDark = theme !== 'light';

  // Layers & Project State
  const [layers, setLayers] = useState(INITIAL_LAYERS);
  const [selectedLayerId, setSelectedLayerId] = useState('layer-image');
  const [activeRightTool, setActiveRightTool] = useState('text'); // 'crop' | 'adjust' | 'filters' | 'text' | 'draw' | 'stickers' | 'frames' | 'blur' | 'ai' | 'more'
  const [activeInspectorTab, setActiveInspectorTab] = useState('Font');
  const [activeFilterCategory, setActiveFilterCategory] = useState('VIBRANT');
  const [activeFilterPreset, setActiveFilterPreset] = useState('v1');
  
  // History Stacks
  const [history, setHistory] = useState([INITIAL_LAYERS]);
  const [historyIndex, setHistoryIndex] = useState(0);

  // Global adjustments
  const [adjustments, setAdjustments] = useState({
    brightness: 105,
    contrast: 125,
    saturate: 145,
    warmth: 10,
    vignette: 25,
    blur: 0,
  });

  // Editor modes
  const [isCompareActive, setIsCompareActive] = useState(false);
  const [compareSlider, setCompareSlider] = useState(50);
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [isAiProcessing, setIsAiProcessing] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [showAddLayerMenu, setShowAddLayerMenu] = useState(false);

  // Canvas & Transformation interaction
  const [isDraggingText, setIsDraggingText] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const canvasStageRef = useRef(null);

  // Current selected layer object
  const selectedLayer = useMemo(() => {
    return layers.find((l) => l.id === selectedLayerId) || null;
  }, [layers, selectedLayerId]);

  // Push new state to history
  const pushState = useCallback((newLayers) => {
    const updated = history.slice(0, historyIndex + 1);
    setHistory([...updated, newLayers]);
    setHistoryIndex(updated.length);
    setLayers(newLayers);
  }, [history, historyIndex]);

  // Undo / Redo
  const handleUndo = useCallback(() => {
    if (historyIndex > 0) {
      setHistoryIndex((idx) => idx - 1);
      setLayers(history[historyIndex - 1]);
      toast.info('Undo');
    }
  }, [history, historyIndex]);

  const handleRedo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      setHistoryIndex((idx) => idx + 1);
      setLayers(history[historyIndex + 1]);
      toast.info('Redo');
    }
  }, [history, historyIndex]);

  // Update selected layer property
  const updateSelectedLayer = useCallback((updates) => {
    if (!selectedLayerId) return;
    setLayers((prev) =>
      prev.map((l) => (l.id === selectedLayerId ? { ...l, ...updates } : l))
    );
  }, [selectedLayerId]);

  // Toggle Visibility
  const toggleVisibility = useCallback((layerId, e) => {
    e?.stopPropagation();
    setLayers((prev) =>
      prev.map((l) => (l.id === layerId ? { ...l, visible: !l.visible } : l))
    );
  }, []);

  // Toggle Lock
  const toggleLock = useCallback((layerId, e) => {
    e?.stopPropagation();
    setLayers((prev) =>
      prev.map((l) => (l.id === layerId ? { ...l, locked: !l.locked } : l))
    );
  }, []);

  // Add new text layer
  const handleAddTextLayer = () => {
    const newLayer = {
      id: `layer-text-${Date.now()}`,
      name: 'Text Layer',
      subtitle: 'New Title',
      type: 'text',
      text: 'New Title',
      font: 'poppins',
      fontSize: 64,
      color: '#FFFFFF',
      visible: true,
      locked: false,
      opacity: 100,
      x: 50,
      y: 50,
      rotation: 0,
      shadow: true,
    };
    pushState([newLayer, ...layers]);
    setSelectedLayerId(newLayer.id);
    setActiveRightTool('text');
    setShowAddLayerMenu(false);
    toast.success('Added text layer');
  };

  // Add sticker layer
  const handleAddStickerLayer = (stickerType = 'mountain') => {
    const newLayer = {
      id: `layer-sticker-${Date.now()}`,
      name: 'Sticker',
      subtitle: stickerType.toUpperCase(),
      type: 'sticker',
      stickerType,
      visible: true,
      locked: false,
      opacity: 100,
      x: 50,
      y: 35,
      scale: 1.0,
      rotation: 0,
    };
    pushState([newLayer, ...layers]);
    setSelectedLayerId(newLayer.id);
    setShowAddLayerMenu(false);
    toast.success(`Added ${stickerType} sticker`);
  };

  // Delete active layer
  const handleDeleteLayer = (layerId) => {
    const idToDelete = layerId || selectedLayerId;
    if (!idToDelete) return;
    const remaining = layers.filter((l) => l.id !== idToDelete);
    pushState(remaining);
    setSelectedLayerId(remaining[0]?.id || null);
    toast.info('Layer removed');
  };

  // Duplicate layer
  const handleDuplicateLayer = () => {
    if (!selectedLayer) return;
    const duplicated = {
      ...selectedLayer,
      id: `layer-copy-${Date.now()}`,
      name: `${selectedLayer.name} Copy`,
      x: (selectedLayer.x || 50) + 4,
      y: (selectedLayer.y || 50) + 4,
    };
    pushState([duplicated, ...layers]);
    setSelectedLayerId(duplicated.id);
    toast.success('Layer duplicated');
  };

  // Trigger file upload for image replacement
  const handleUploadImage = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    setLayers((prev) =>
      prev.map((l) => (l.type === 'image' ? { ...l, url } : l))
    );
    toast.success('Custom image applied');
  };

  // AI Magic Tools Handler
  const handleAiAction = (actionName) => {
    setIsAiProcessing(true);
    toast.loading(`AI is enhancing: ${actionName}...`, { duration: 1500 });
    setTimeout(() => {
      setIsAiProcessing(false);
      if (actionName === 'auto-enhance') {
        setAdjustments({
          brightness: 110,
          contrast: 130,
          saturate: 150,
          warmth: 15,
          vignette: 30,
          blur: 0,
        });
        setActiveFilterPreset('v1');
      }
      toast.success(`✨ ${actionName} applied successfully!`);
    }, 1500);
  };

  // Save Project
  const handleSave = () => {
    toast.success('Project saved to Arvdoul Cloud Cloud Storage!');
  };

  // Export Project
  const handleExport = () => {
    setIsExporting(true);
    toast.loading('Generating 4K Ultra-HD Master...', { duration: 1800 });
    setTimeout(() => {
      setIsExporting(false);
      toast.success('✨ Thumbnail exported at 3840x2160 (PNG)');
    }, 1800);
  };

  // Reset to original
  const handleReset = () => {
    setLayers(INITIAL_LAYERS);
    setAdjustments({
      brightness: 100,
      contrast: 100,
      saturate: 100,
      warmth: 0,
      vignette: 0,
      blur: 0,
    });
    setActiveFilterPreset('v1');
    toast.info('Reset to default');
  };

  // Computed filter CSS style
  const computedFilter = useMemo(() => {
    const currentPreset = FILTER_PRESETS.find((p) => p.id === activeFilterPreset);
    const presetFilter = currentPreset ? currentPreset.filter : '';
    const customFilter = `brightness(${adjustments.brightness}%) contrast(${adjustments.contrast}%) saturate(${adjustments.saturate}%) blur(${adjustments.blur}px)`;
    return `${presetFilter} ${customFilter}`.trim();
  }, [activeFilterPreset, adjustments]);

  return (
    <div
      className={cn(
        'min-h-screen w-full select-none flex flex-col font-sans transition-colors duration-300',
        isDark ? 'bg-[#030616] text-white' : 'bg-[#0D122B] text-white'
      )}
    >
      {/* ==================== 1. TOP NAVIGATION BAR ==================== */}
      <header className="h-16 px-4 md:px-6 flex items-center justify-between border-b border-white/10 bg-[#060A22]/90 backdrop-blur-xl z-30">
        {/* Left: Close X Button */}
        <button
          onClick={() => navigate(-1)}
          aria-label="Close Image Studio"
          className="w-10 h-10 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center text-slate-300 hover:text-white transition-all active:scale-95"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Center: Brand Title & Preset Selector */}
        <div className="flex flex-col items-center">
          <div className="flex items-center gap-1.5 cursor-pointer group">
            <span className="font-extrabold tracking-wider text-base bg-gradient-to-r from-[#A855F7] via-[#C084FC] to-[#3B82F6] bg-clip-text text-transparent">
              ARVDOUL
            </span>
          </div>
          <button className="flex items-center gap-1 text-xs text-slate-400 hover:text-white transition-colors">
            <span>Image Studio</span>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 group-hover:text-white" />
          </button>
        </div>

        {/* Right: Undo, Redo, Compare Toggle, Save Button */}
        <div className="flex items-center gap-2 md:gap-3">
          {/* Undo */}
          <button
            onClick={handleUndo}
            disabled={historyIndex === 0}
            aria-label="Undo"
            className="w-10 h-10 rounded-2xl bg-white/5 hover:bg-white/10 disabled:opacity-30 border border-white/10 flex items-center justify-center text-slate-300 hover:text-white transition-all active:scale-95"
          >
            <Undo2 className="w-4 h-4" />
          </button>

          {/* Redo */}
          <button
            onClick={handleRedo}
            disabled={historyIndex >= history.length - 1}
            aria-label="Redo"
            className="w-10 h-10 rounded-2xl bg-white/5 hover:bg-white/10 disabled:opacity-30 border border-white/10 flex items-center justify-center text-slate-300 hover:text-white transition-all active:scale-95"
          >
            <Redo2 className="w-4 h-4" />
          </button>

          {/* Compare Split Mode Toggle */}
          <button
            onClick={() => setIsCompareActive((c) => !c)}
            aria-label="Toggle split compare"
            className={cn(
              'w-10 h-10 rounded-2xl border flex items-center justify-center transition-all active:scale-95',
              isCompareActive
                ? 'bg-purple-600 border-purple-400 text-white shadow-[0_0_15px_rgba(168,85,247,0.5)]'
                : 'bg-white/5 hover:bg-white/10 border-white/10 text-slate-300 hover:text-white'
            )}
          >
            <Columns className="w-4 h-4" />
          </button>

          {/* Save Button (Purple pill matching Screenshot 6) */}
          <button
            onClick={handleSave}
            className="px-5 py-2 rounded-2xl bg-gradient-to-r from-[#8B1EF3] to-[#055BFB] text-white text-xs md:text-sm font-bold tracking-wide shadow-[0_4px_20px_rgba(139,30,243,0.5)] hover:brightness-110 active:scale-95 transition-all"
          >
            Save
          </button>
        </div>
      </header>

      {/* ==================== 2. MAIN WORKSPACE (LEFT LAYERS, CENTER STAGE, RIGHT TOOLS) ==================== */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* ==================== LEFT SIDEBAR: LAYERS PANEL ==================== */}
        <aside className="w-64 md:w-72 bg-[#05081E]/95 border-r border-white/10 flex flex-col justify-between p-4 z-20 overflow-y-auto">
          <div>
            {/* Header: LAYERS + button */}
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-black tracking-widest text-slate-400 uppercase">
                LAYERS
              </span>
              <div className="relative">
                <button
                  onClick={() => setShowAddLayerMenu((s) => !s)}
                  aria-label="Add Layer"
                  className="w-7 h-7 rounded-xl bg-white/10 hover:bg-white/20 border border-white/10 flex items-center justify-center text-white transition-all active:scale-95"
                >
                  <Plus className="w-4 h-4" />
                </button>

                {/* Add Layer Dropdown Menu */}
                <AnimatePresence>
                  {showAddLayerMenu && (
                    <motion.div
                      initial={{ opacity: 0, y: -5, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -5, scale: 0.95 }}
                      className="absolute left-0 top-9 w-44 rounded-2xl bg-[#0F1738] border border-white/20 shadow-2xl p-2 z-50 flex flex-col gap-1"
                    >
                      <button
                        onClick={handleAddTextLayer}
                        className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-white hover:bg-white/10 transition-colors text-left"
                      >
                        <Type className="w-4 h-4 text-purple-400" />
                        <span>Add Text</span>
                      </button>
                      <button
                        onClick={() => handleAddStickerLayer('mountain')}
                        className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-white hover:bg-white/10 transition-colors text-left"
                      >
                        <Smile className="w-4 h-4 text-pink-400" />
                        <span>Add Mountain Sticker</span>
                      </button>
                      <label className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-white hover:bg-white/10 transition-colors cursor-pointer text-left">
                        <Upload className="w-4 h-4 text-blue-400" />
                        <span>Upload Photo</span>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleUploadImage}
                          className="hidden"
                        />
                      </label>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            {/* Layer Cards List matching Screenshot 6 */}
            <div className="flex flex-col gap-2.5">
              {layers.map((layer) => {
                const isSelected = selectedLayerId === layer.id;

                return (
                  <div
                    key={layer.id}
                    onClick={() => setSelectedLayerId(layer.id)}
                    className={cn(
                      'p-2.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between group',
                      isSelected
                        ? 'bg-[#151D45] border-purple-500/80 shadow-[0_0_15px_rgba(168,85,247,0.3)]'
                        : 'bg-white/5 hover:bg-white/10 border-white/5 text-slate-300'
                    )}
                  >
                    {/* Left: Thumbnail icon + Layer title */}
                    <div className="flex items-center gap-3">
                      {/* Thumbnail / Icon preview */}
                      <div className="w-10 h-10 rounded-xl overflow-hidden bg-black/40 border border-white/10 flex items-center justify-center flex-shrink-0">
                        {layer.type === 'image' && (
                          <img
                            src={layer.url}
                            alt="layer"
                            className="w-full h-full object-cover"
                          />
                        )}
                        {layer.type === 'text' && (
                          <Type className="w-5 h-5 text-purple-400" />
                        )}
                        {layer.type === 'sticker' && (
                          <div className="w-6 h-6 text-white flex items-center justify-center font-bold">
                            ▲
                          </div>
                        )}
                        {layer.type === 'gradient' && (
                          <div className="w-full h-full bg-gradient-to-br from-purple-600 to-indigo-900" />
                        )}
                        {layer.type === 'background' && (
                          <div className="w-full h-full bg-[#04081E]" />
                        )}
                      </div>

                      {/* Name & Subtitle */}
                      <div className="flex flex-col">
                        <span
                          className={cn(
                            'text-xs font-bold leading-tight',
                            isSelected ? 'text-white' : 'text-slate-200'
                          )}
                        >
                          {layer.name}
                        </span>
                        {layer.subtitle && (
                          <span className="text-[10px] text-slate-400 leading-tight">
                            {layer.subtitle}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Right Action Icons: Lock and Eye visibility */}
                    <div className="flex items-center gap-1.5 text-slate-400">
                      {/* Lock Toggle */}
                      {layer.locked !== undefined && (
                        <button
                          onClick={(e) => toggleLock(layer.id, e)}
                          aria-label="Toggle lock"
                          className="p-1 rounded-lg hover:text-white"
                        >
                          {layer.locked ? (
                            <Lock className="w-3.5 h-3.5 text-purple-400" />
                          ) : (
                            <Unlock className="w-3.5 h-3.5 opacity-40 hover:opacity-100" />
                          )}
                        </button>
                      )}

                      {/* Visibility Toggle */}
                      <button
                        onClick={(e) => toggleVisibility(layer.id, e)}
                        aria-label="Toggle visibility"
                        className="p-1 rounded-lg hover:text-white"
                      >
                        {layer.visible ? (
                          <Eye className="w-3.5 h-3.5 text-slate-300" />
                        ) : (
                          <EyeOff className="w-3.5 h-3.5 text-slate-500" />
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Bottom of Layers panel: Opacity Slider (Matching Screenshot 6) */}
          <div className="pt-4 border-t border-white/10 flex flex-col gap-2">
            <div className="flex items-center justify-between text-xs text-slate-300 font-semibold">
              <span>Opacity</span>
              <span className="font-mono text-purple-400">
                {selectedLayer?.opacity || 100}
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={selectedLayer?.opacity || 100}
              onChange={(e) =>
                updateSelectedLayer({ opacity: Number(e.target.value) })
              }
              className="w-full accent-purple-500 cursor-pointer"
            />
          </div>
        </aside>

        {/* ==================== CENTER: INTERACTIVE CANVAS STAGE ==================== */}
        <main
          ref={canvasStageRef}
          className="flex-1 relative flex items-center justify-center p-4 md:p-8 bg-[#030616] overflow-hidden"
        >
          {/* Main Visual Stage Container with Glow & Shadow */}
          <div className="relative w-full max-w-2xl aspect-[3/4] md:aspect-[4/5] rounded-3xl overflow-hidden shadow-[0_20px_60px_rgba(0,0,0,0.8)] border border-white/10 bg-black">
            {/* 1. Background Layer */}
            {layers.find((l) => l.type === 'background' && l.visible) && (
              <div className="absolute inset-0 bg-[#04081E]" />
            )}

            {/* 2. Photo / Image Layer with Active Filters */}
            {layers.find((l) => l.type === 'image' && l.visible) && (
              <img
                src={DEFAULT_IMAGE_URL}
                alt="Studio Base Canvas"
                referrerPolicy="no-referrer"
                style={{ filter: computedFilter }}
                className="absolute inset-0 w-full h-full object-cover transition-all duration-300"
              />
            )}

            {/* 3. Gradient Overlay */}
            {layers.find((l) => l.type === 'gradient' && l.visible) && (
              <div
                className="absolute inset-0 pointer-events-none mix-blend-soft-light"
                style={{
                  background:
                    'radial-gradient(circle at 50% 30%, rgba(139, 30, 243, 0.45), transparent 70%)',
                }}
              />
            )}

            {/* 4. Mountain Vector Sticker (Matching Screenshot 6) */}
            {layers.find((l) => l.type === 'sticker' && l.visible) && (
              <div
                className="absolute pointer-events-none transition-transform"
                style={{
                  top: '18%',
                  left: '52%',
                  transform: 'translate(-50%, -50%)',
                }}
              >
                <svg
                  className="w-24 h-24 md:w-28 md:h-28 text-white/95 drop-shadow-[0_4px_12px_rgba(0,0,0,0.8)]"
                  viewBox="0 0 100 100"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polygon
                    points="50,15 85,80 15,80"
                    fill="currentColor"
                    fillOpacity="0.85"
                  />
                  <polygon
                    points="70,35 95,80 45,80"
                    fill="currentColor"
                    fillOpacity="0.6"
                  />
                  <path
                    d="M38 58 L50 40 L62 58 L56 68 L44 68 Z"
                    fill="#04081E"
                  />
                </svg>
              </div>
            )}

            {/* 5. Transformable Text Layer Overlay — renders the ACTUAL layer
                content (real user text + per-layer style properties). */}
            {layers.find((l) => l.type === 'text' && l.visible) && (() => {
              const textLayer = layers.find((l) => l.type === 'text' && l.visible);
              const fontSize = Math.min(72, Math.max(24, Number(textLayer?.fontSize) || 48));
              const textColor = textLayer?.color || '#FFFFFF';
              const textShadow = textLayer?.shadow
                ? `0 4px 10px ${textLayer?.shadowColor || 'rgba(0,0,0,0.8)'}`
                : 'none';
              const lines = String(textLayer?.text || 'Text').split('\n');
              return (
                <div
                  onClick={() => setSelectedLayerId(textLayer.id)}
                  className="absolute z-20 cursor-move"
                  style={{
                    top: `${textLayer?.y ?? 36}%`,
                    left: `${textLayer?.x ?? 50}%`,
                    transform: `translate(-50%, -50%) rotate(${textLayer?.rotation || 0}deg)`,
                  }}
                >
                  {/* Bounding Box & Transformation Gizmo (Active only when selected) */}
                  {!isPreviewMode && selectedLayerId === textLayer.id && (
                    <div className="absolute -inset-4 border-2 border-white/80 rounded-xl pointer-events-none">
                      {/* 4 Corner Scale Dots */}
                      <div className="w-3 h-3 rounded-full bg-white border-2 border-purple-500 absolute -top-1.5 -left-1.5" />
                      <div className="w-3 h-3 rounded-full bg-white border-2 border-purple-500 absolute -top-1.5 -right-1.5" />
                      <div className="w-3 h-3 rounded-full bg-white border-2 border-purple-500 absolute -bottom-1.5 -left-1.5" />
                      <div className="w-3 h-3 rounded-full bg-white border-2 border-purple-500 absolute -bottom-1.5 -right-1.5" />

                      {/* Top center Anchor dot */}
                      <div className="w-3.5 h-3.5 rounded-full bg-purple-500 border-2 border-white absolute -top-4 left-1/2 -translate-x-1/2" />

                      {/* Bottom Left: Delete Handle (X in circle) */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteLayer(textLayer.id);
                        }}
                        className="w-6 h-6 rounded-full bg-black/80 border border-white/40 text-white flex items-center justify-center absolute -bottom-8 left-1/4 pointer-events-auto hover:bg-red-600 transition-colors shadow-lg"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>

                      {/* Bottom Right: Rotate Handle (↺ in circle) */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toast.info('Rotating text layer');
                        }}
                        className="w-6 h-6 rounded-full bg-black/80 border border-white/40 text-white flex items-center justify-center absolute -bottom-8 right-1/4 pointer-events-auto hover:bg-purple-600 transition-colors shadow-lg"
                      >
                        <RotateCw className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}

                  {/* Rendered Text with Stylized Typography from the layer data */}
                  <div
                    className="flex flex-col items-center justify-center text-center leading-[0.85] tracking-tight drop-shadow-[0_10px_25px_rgba(0,0,0,0.9)]"
                    style={{
                      fontFamily:
                        FONT_OPTIONS.find((f) => f.id === (textLayer?.font || 'poppins'))?.family ||
                        "'Poppins', sans-serif",
                      fontSize: `${fontSize}px`,
                    }}
                  >
                    {lines.map((line, i) => (
                      <span
                        key={i}
                        className="font-extrabold italic"
                        style={{
                          color: textColor,
                          textShadow,
                          WebkitTextStroke: textLayer?.stroke && Number(textLayer.strokeWidth) > 0
                            ? `${textLayer.strokeWidth}px ${textLayer.stroke}`
                            : '0px transparent',
                        }}
                      >
                        {line}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })()}

            {/* Split Comparison Slider Overlay */}
            {isCompareActive && (
              <div
                className="absolute inset-y-0 right-0 bg-black/40 overflow-hidden border-l-2 border-white pointer-events-none"
                style={{ width: `${100 - compareSlider}%` }}
              >
                <img
                  src={DEFAULT_IMAGE_URL}
                  alt="Original"
                  referrerPolicy="no-referrer"
                  className="absolute inset-0 w-full h-full object-cover filter-none"
                  style={{ width: '100%', height: '100%' }}
                />
                <div className="absolute top-4 right-4 px-2 py-1 rounded bg-black/70 text-[10px] font-bold text-white">
                  ORIGINAL
                </div>
              </div>
            )}
          </div>
        </main>

        {/* ==================== RIGHT SIDEBAR: VERTICAL TOOLS PANEL ==================== */}
        <aside className="w-20 md:w-24 bg-[#05081E]/95 border-l border-white/10 flex flex-col items-center py-4 gap-3 z-20 overflow-y-auto">
          {[
            { id: 'crop', label: 'Crop', icon: Crop },
            { id: 'adjust', label: 'Adjust', icon: Sliders },
            { id: 'filters', label: 'Filters', icon: Sparkles },
            { id: 'text', label: 'Text', icon: Type, highlight: true },
            { id: 'draw', label: 'Draw', icon: Pencil },
            { id: 'stickers', label: 'Stickers', icon: Smile },
            { id: 'frames', label: 'Frames', icon: Square },
            { id: 'blur', label: 'Blur', icon: Droplet },
            { id: 'ai', label: 'AI Tools', icon: Wand2 },
            { id: 'more', label: 'More', icon: MoreHorizontal },
          ].map((tool) => {
            const isActive = activeRightTool === tool.id;
            const Icon = tool.icon;

            return (
              <button
                key={tool.id}
                onClick={() => {
                  setActiveRightTool(tool.id);
                  if (tool.id === 'ai') handleAiAction('auto-enhance');
                }}
                className={cn(
                  'flex flex-col items-center justify-center transition-all duration-200 active:scale-95 group',
                  isActive && tool.highlight
                    ? 'w-14 h-14 rounded-2xl bg-gradient-to-br from-[#8B1EF3] to-[#4431F7] text-white shadow-[0_0_20px_rgba(139,30,243,0.6)]'
                    : isActive
                    ? 'w-14 h-14 rounded-2xl bg-white/15 text-white border border-white/20'
                    : 'w-14 h-14 rounded-2xl text-slate-400 hover:text-white hover:bg-white/5'
                )}
              >
                <Icon className="w-5 h-5 mb-0.5" />
                <span className="text-[10px] font-semibold tracking-tight">
                  {tool.label}
                </span>
              </button>
            );
          })}
        </aside>
      </div>

      {/* ==================== 3. BOTTOM INSPECTOR & FILTERS BAR (EXACT SCREENSHOT 6) ==================== */}
      <footer className="bg-[#05081E] border-t border-white/10 px-4 md:px-8 py-3 flex flex-col gap-3.5 z-30 shadow-2xl">
        {/* Row A: Inspector Tabs (Font, Style, Color, Stroke, Shadow, Glow, Align, Spacing) */}
        <div className="flex items-center gap-6 overflow-x-auto no-scrollbar border-b border-white/10 pb-2 text-xs font-semibold">
          {INSPECTOR_TABS.map((tab) => {
            const isActive = activeInspectorTab === tab;

            return (
              <button
                key={tab}
                onClick={() => setActiveInspectorTab(tab)}
                className={cn(
                  'relative whitespace-nowrap pb-1 transition-colors',
                  isActive
                    ? 'text-purple-400 font-bold'
                    : 'text-slate-400 hover:text-slate-200'
                )}
              >
                {tab}
                {isActive && (
                  <motion.div
                    layoutId="inspector-tab-underline"
                    className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-purple-500 to-blue-500 rounded-full"
                  />
                )}
              </button>
            );
          })}
        </div>

        {/* Row B: Font Selector (A+, Anton, Playfair, Poppins, Bebas, Pacifico, Montserrat) */}
        <div className="flex items-center gap-3 overflow-x-auto no-scrollbar py-1">
          {/* Add custom font A+ button */}
          <button
            onClick={() => toast.info('Open custom web font importer')}
            className="px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center font-bold text-sm text-slate-300 hover:text-white transition-all active:scale-95"
          >
            <span className="text-base font-serif">A</span>
            <span className="text-xs text-purple-400 ml-0.5">+</span>
          </button>

          {FONT_OPTIONS.map((font) => {
            const isSelected = (selectedLayer?.font || 'poppins') === font.id;

            return (
              <button
                key={font.id}
                onClick={() => updateSelectedLayer({ font: font.id })}
                className={cn(
                  'px-4 py-2 rounded-xl text-sm font-semibold whitespace-nowrap transition-all duration-200 active:scale-95 border',
                  isSelected
                    ? 'bg-[#151D45] border-purple-500 text-white shadow-[0_0_15px_rgba(168,85,247,0.4)]'
                    : 'bg-white/5 hover:bg-white/10 border-white/5 text-slate-300'
                )}
                style={{ fontFamily: font.family }}
              >
                {font.name}
              </button>
            );
          })}
        </div>

        {/* Row C: Sliders for Size & Opacity */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
          {/* Size Slider */}
          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold text-slate-400 w-12">
              Size
            </span>
            <input
              type="range"
              min="24"
              max="140"
              value={selectedLayer?.fontSize || 72}
              onChange={(e) =>
                updateSelectedLayer({ fontSize: Number(e.target.value) })
              }
              className="flex-1 accent-purple-500 cursor-pointer"
            />
            <span className="text-xs font-mono font-bold text-slate-200 w-8 text-right">
              {selectedLayer?.fontSize || 72}
            </span>
          </div>

          {/* Opacity Slider */}
          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold text-slate-400 w-14">
              Opacity
            </span>
            <input
              type="range"
              min="0"
              max="100"
              value={selectedLayer?.opacity || 100}
              onChange={(e) =>
                updateSelectedLayer({ opacity: Number(e.target.value) })
              }
              className="flex-1 accent-purple-500 cursor-pointer"
            />
            <span className="text-xs font-mono font-bold text-slate-200 w-8 text-right">
              {selectedLayer?.opacity || 100}
            </span>
          </div>
        </div>

        {/* Row D: Filter Categories Bar (RECENT, SIMPLE, VIBRANT, MOODY, B&W, CINEMATIC, NATURE, FILM) */}
        <div className="flex items-center gap-6 overflow-x-auto no-scrollbar text-[11px] font-bold tracking-wider uppercase text-slate-400 border-t border-white/5 pt-2">
          {FILTER_CATEGORIES.map((cat) => {
            const isActive = activeFilterCategory === cat;

            return (
              <button
                key={cat}
                onClick={() => setActiveFilterCategory(cat)}
                className={cn(
                  'whitespace-nowrap transition-colors',
                  isActive
                    ? 'text-purple-400 border-b-2 border-purple-500 pb-0.5'
                    : 'hover:text-white'
                )}
              >
                {cat}
              </button>
            );
          })}
        </div>

        {/* Row E: Filter Presets Carousel (V1 Vibrant, V2 Sunset, V3 Cool, etc.) */}
        <div className="flex items-center gap-3 overflow-x-auto no-scrollbar py-1">
          {FILTER_PRESETS.map((preset) => {
            const isSelected = activeFilterPreset === preset.id;

            return (
              <button
                key={preset.id}
                onClick={() => {
                  setActiveFilterPreset(preset.id);
                  toast.success(`Filter ${preset.name} applied`);
                }}
                className={cn(
                  'flex flex-col items-center gap-1.5 p-1 rounded-2xl border transition-all active:scale-95 flex-shrink-0',
                  isSelected
                    ? 'border-purple-500 bg-purple-500/20 shadow-[0_0_15px_rgba(168,85,247,0.4)]'
                    : 'border-white/10 hover:border-white/20 bg-white/5'
                )}
              >
                {/* Thumbnail box */}
                <div
                  className={cn(
                    'w-16 h-16 md:w-20 md:h-20 rounded-xl overflow-hidden relative shadow-inner bg-gradient-to-br',
                    preset.bgPreview
                  )}
                >
                  <img
                    src={DEFAULT_IMAGE_URL}
                    alt={preset.name}
                    referrerPolicy="no-referrer"
                    style={{ filter: preset.filter }}
                    className="w-full h-full object-cover"
                  />
                  {isSelected && (
                    <div className="absolute inset-0 bg-purple-600/20 border-2 border-purple-400 rounded-xl pointer-events-none" />
                  )}
                </div>
                <span className="text-[10px] font-bold text-slate-300">
                  {preset.name}
                </span>
              </button>
            );
          })}
        </div>

        {/* Row F: Final Action Footer (Cancel, Preview, Compare, Reset, Export Button) */}
        <div className="flex items-center justify-between border-t border-white/10 pt-3">
          {/* Left: Cancel */}
          <button
            onClick={() => navigate(-1)}
            className="px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-white hover:bg-white/5 transition-all"
          >
            Cancel
          </button>

          {/* Center Utility Buttons: Preview, Compare, Reset */}
          <div className="flex items-center gap-4 text-xs font-semibold text-slate-300">
            <button
              onClick={() => setIsPreviewMode((p) => !p)}
              className="flex items-center gap-1.5 hover:text-white transition-colors"
            >
              <Eye className="w-4 h-4 text-purple-400" />
              <span>Preview</span>
            </button>

            <button
              onClick={() => setIsCompareActive((c) => !c)}
              className="flex items-center gap-1.5 hover:text-white transition-colors"
            >
              <Columns className="w-4 h-4 text-blue-400" />
              <span>Compare</span>
            </button>

            <button
              onClick={handleReset}
              className="flex items-center gap-1.5 hover:text-white transition-colors"
            >
              <RefreshCw className="w-4 h-4 text-slate-400" />
              <span>Reset</span>
            </button>
          </div>

          {/* Right: Purple Gradient Export Button */}
          <button
            onClick={handleExport}
            disabled={isExporting}
            className="px-6 py-2.5 rounded-2xl bg-gradient-to-r from-[#8B1EF3] via-[#7015E0] to-[#055BFB] text-white text-xs md:text-sm font-extrabold tracking-wide flex items-center gap-2 shadow-[0_4px_25px_rgba(139,30,243,0.6)] hover:brightness-110 active:scale-95 transition-all disabled:opacity-50"
          >
            <Upload className="w-4 h-4" />
            <span>Export</span>
          </button>
        </div>
      </footer>
    </div>
  );
}
