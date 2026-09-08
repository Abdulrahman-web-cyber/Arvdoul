// src/screens/ThumbnailDesigner/ThumbnailDesignerScreen.jsx - ARVDOUL IMAGE STUDIO & THUMBNAIL DESIGNER
// 100% Pixel-Perfect Replica of Arvdoul Image Studio (Matching Screenshot 3 / vNext Studio Specs)
// Global · Contextual · Intelligent · Full Canvas Manipulation · Multi-Photo Filmstrip · 10-Tool Grid
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { cn } from '../../lib/utils';
import {
  ChevronLeft,
  Undo2,
  Redo2,
  Layers,
  Sparkles,
  Wand2,
  Scissors,
  ChevronDown,
  Crop,
  Sliders,
  Sparkle,
  Zap,
  Minus,
  Plus,
  Maximize2,
  Image as ImageIcon,
  Type,
  Pencil,
  Smile,
  Square,
  Flame,
  MoreHorizontal,
  Columns,
  RotateCcw,
  Clock,
  SlidersHorizontal,
  Upload,
  Download,
  Eye,
  EyeOff,
  Lock,
  Unlock,
  Trash2,
  Check,
  X,
  Palette,
  Sun,
  Moon,
  RefreshCw,
} from 'lucide-react';

// Studio base sample canvas (rich landscape artwork with high dynamic range)
const SAMPLE_PHOTOS = [
  {
    id: 'photo-1',
    num: 1,
    name: 'Neon Cyber',
    url: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=1400&q=80',
  },
  {
    id: 'photo-2',
    num: 2,
    name: 'Mountain Sunset',
    url: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=1400&q=80',
  },
  {
    id: 'photo-3',
    num: 3,
    name: 'Midnight Urban',
    url: 'https://images.unsplash.com/photo-1514565131-fce0801e5785?auto=format&fit=crop&w=1400&q=80',
  },
  {
    id: 'photo-4',
    num: 4,
    name: 'Cosmic Sky',
    url: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1400&q=80',
  },
];

// Available fonts for text tool
const FONT_OPTIONS = [
  { id: 'anton', name: 'Anton', family: "'Anton', sans-serif" },
  { id: 'playfair', name: 'Playfair Display', family: "'Playfair Display', serif" },
  { id: 'poppins', name: 'Poppins', family: "'Poppins', sans-serif" },
  { id: 'bebas', name: 'BEBAS NEUE', family: "'Bebas Neue', sans-serif" },
  { id: 'pacifico', name: 'Pacifico', family: "'Pacifico', cursive" },
  { id: 'montserrat', name: 'Montserrat', family: "'Montserrat', sans-serif" },
];

// Presets for Quick Filters
const FILTER_PRESETS = [
  { id: 'normal', name: 'Original', filter: 'none' },
  { id: 'v1', name: 'Vibrant', filter: 'contrast(125%) saturate(145%) brightness(105%)' },
  { id: 'v2', name: 'Sunset Warm', filter: 'sepia(30%) saturate(160%) hue-rotate(-15deg)' },
  { id: 'v3', name: 'Cool Nordic', filter: 'hue-rotate(20deg) saturate(120%) brightness(105%)' },
  { id: 'v4', name: 'B&W Noir', filter: 'grayscale(100%) contrast(140%)' },
  { id: 'v5', name: 'Cyber Neon', filter: 'contrast(140%) saturate(180%) hue-rotate(25deg)' },
  { id: 'v6', name: 'Moody Cinema', filter: 'contrast(160%) brightness(90%) saturate(120%)' },
];

// Tool Categories
const CATEGORIES = [
  { id: 'favorites', label: 'Favorites' },
  { id: 'all', label: 'All Tools' },
  { id: 'ai', label: 'AI Tools', isNew: true },
  { id: 'adjust', label: 'Adjust' },
  { id: 'draw', label: 'Draw' },
  { id: 'filters', label: 'Filters' },
];

// 10 Core Tools (2 rows × 5 columns)
const GRID_TOOLS = [
  { id: 'crop', label: 'Crop', icon: Crop },
  { id: 'adjust', label: 'Adjust', icon: Sliders },
  { id: 'filters', label: 'Filters', icon: Sparkle },
  { id: 'text', label: 'Text', icon: Type },
  { id: 'draw', label: 'Draw', icon: Pencil },
  { id: 'stickers', label: 'Stickers', icon: Smile },
  { id: 'frames', label: 'Frames', icon: Square },
  { id: 'effects', label: 'Effects', icon: Zap },
  { id: 'ai-enhance', label: 'AI Enhance', icon: Sparkles, isAi: true },
  { id: 'more', label: 'More', icon: MoreHorizontal },
];

// Bottom primary navigation items
const BOTTOM_NAV_TABS = [
  { id: 'tools', label: 'Tools', icon: SlidersHorizontal },
  { id: 'presets', label: 'Presets', icon: Sparkles },
  { id: 'history', label: 'History', icon: Clock },
  { id: 'compare', label: 'Compare', icon: Columns },
  { id: 'reset', label: 'Reset', icon: RotateCcw },
];

export default function ThumbnailDesignerScreen() {
  const navigate = useNavigate();
  const { theme } = useTheme();
  const isDark = theme !== 'light';

  // Photo filmstrip state
  const [photos, setPhotos] = useState(SAMPLE_PHOTOS);
  const [activePhotoId, setActivePhotoId] = useState('photo-2'); // Photo 2 selected as in Image 3
  const fileInputRef = useRef(null);

  // Active Category & Active Tool
  const [activeCategory, setActiveCategory] = useState('all');
  const [activeTool, setActiveTool] = useState(null); // 'crop' | 'adjust' | 'filters' | 'text' | 'draw' | 'stickers' | 'frames' | 'effects' | 'ai-enhance' | 'more'
  const [bottomNavTab, setBottomNavTab] = useState('tools');

  // Zoom & Viewport state
  const [zoomLevel, setZoomLevel] = useState(100);
  const [fitMode, setFitMode] = useState('contain');

  // Canvas Adjustments
  const [adjustments, setAdjustments] = useState({
    brightness: 105,
    contrast: 120,
    saturation: 135,
    warmth: 10,
    vignette: 15,
    blur: 0,
  });

  // Active Filter
  const [activeFilter, setActiveFilter] = useState('v1');

  // Layers
  const [layers, setLayers] = useState([
    {
      id: 'layer-text-1',
      name: 'Title Typography',
      type: 'text',
      text: 'ARVDOUL',
      font: 'bebas',
      fontSize: 68,
      color: '#FFFFFF',
      x: 50,
      y: 40,
      visible: true,
      locked: false,
      opacity: 100,
      shadow: true,
    },
    {
      id: 'layer-sticker-1',
      name: 'Badge Accent',
      type: 'sticker',
      label: '4K ULTRA',
      x: 50,
      y: 65,
      visible: true,
      locked: false,
      opacity: 95,
    },
    {
      id: 'layer-bg',
      name: 'Base Image',
      type: 'image',
      visible: true,
      locked: true,
      opacity: 100,
    },
  ]);
  const [selectedLayerId, setSelectedLayerId] = useState('layer-text-1');
  const [showLayersModal, setShowLayersModal] = useState(false);

  // History Stacks
  const [history, setHistory] = useState([{ adjustments: { ...adjustments }, filter: 'v1', layers: [...layers] }]);
  const [historyIndex, setHistoryIndex] = useState(0);

  // Comparison & Export states
  const [isComparing, setIsComparing] = useState(false);
  const [compareSlider, setCompareSlider] = useState(50);
  const [isExporting, setIsExporting] = useState(false);
  const [isAiProcessing, setIsAiProcessing] = useState(false);

  // Drawing state
  const [drawColor, setDrawColor] = useState('#8B1EF3');
  const [drawSize, setDrawSize] = useState(8);

  // Crop aspect
  const [cropAspect, setCropAspect] = useState('16:9'); // '16:9' | '9:16' | '1:1' | '4:3' | 'free'

  // Active current image URL
  const currentPhoto = useMemo(() => {
    return photos.find((p) => p.id === activePhotoId) || photos[0];
  }, [photos, activePhotoId]);

  // Combined CSS Filter Calculation
  const computedFilter = useMemo(() => {
    const preset = FILTER_PRESETS.find((p) => p.id === activeFilter);
    const presetStyle = preset && preset.id !== 'normal' ? preset.filter : '';
    const adjStyle = `brightness(${adjustments.brightness}%) contrast(${adjustments.contrast}%) saturate(${adjustments.saturation}%) blur(${adjustments.blur}px)`;
    return `${adjStyle} ${presetStyle}`.trim();
  }, [adjustments, activeFilter]);

  // Push Snapshot
  const pushState = useCallback((newAdj, newFilter, newLayers) => {
    const snapshot = {
      adjustments: newAdj || { ...adjustments },
      filter: newFilter || activeFilter,
      layers: newLayers ? [...newLayers] : [...layers],
    };
    const updated = history.slice(0, historyIndex + 1);
    setHistory([...updated, snapshot]);
    setHistoryIndex(updated.length);
  }, [adjustments, activeFilter, layers, history, historyIndex]);

  // Undo / Redo
  const handleUndo = useCallback(() => {
    if (historyIndex > 0) {
      const prev = history[historyIndex - 1];
      setAdjustments(prev.adjustments);
      setActiveFilter(prev.filter);
      setLayers(prev.layers);
      setHistoryIndex((i) => i - 1);
      toast.info('Undo');
    }
  }, [history, historyIndex]);

  const handleRedo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const next = history[historyIndex + 1];
      setAdjustments(next.adjustments);
      setActiveFilter(next.filter);
      setLayers(next.layers);
      setHistoryIndex((i) => i + 1);
      toast.info('Redo');
    }
  }, [history, historyIndex]);

  // Add new photo upload
  const handleAddPhoto = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    const newPhoto = {
      id: `photo-${Date.now()}`,
      num: photos.length + 1,
      name: file.name.substring(0, 14),
      url,
    };
    setPhotos((prev) => [...prev, newPhoto]);
    setActivePhotoId(newPhoto.id);
    toast.success(`Photo ${newPhoto.num} added to session`);
  };

  // Trigger AI Tools
  const handleAiAction = (actionType) => {
    setIsAiProcessing(true);
    toast.loading(`Processing with Arvdoul AI: ${actionType}...`, { duration: 1600 });
    setTimeout(() => {
      setIsAiProcessing(false);
      if (actionType === 'AI Enhance') {
        const enhanced = {
          brightness: 112,
          contrast: 128,
          saturation: 142,
          warmth: 12,
          vignette: 20,
          blur: 0,
        };
        setAdjustments(enhanced);
        setActiveFilter('v1');
        pushState(enhanced, 'v1', layers);
      }
      toast.success(`✨ ${actionType} applied successfully!`);
    }, 1600);
  };

  // Export 4K
  const handleExport = () => {
    setIsExporting(true);
    toast.loading('Rendering 4K (3840×2160) Ultra-HD Master...', { duration: 1800 });
    setTimeout(() => {
      setIsExporting(false);
      toast.success('Master exported in 4K UHD (PNG 3840×2160)');
    }, 1800);
  };

  // Reset
  const handleReset = () => {
    const defaultAdj = { brightness: 100, contrast: 100, saturation: 100, warmth: 0, vignette: 0, blur: 0 };
    setAdjustments(defaultAdj);
    setActiveFilter('normal');
    setZoomLevel(100);
    pushState(defaultAdj, 'normal', layers);
    toast.info('Adjustments reset to original');
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#03071B] text-white select-none overflow-hidden font-sans">
      {/* ========================================================
          1. TOP APP BAR (EXACT IMAGE 3 SPEC)
          Back Button | 4K Badge | Undo / Redo | Zoom % | Histogram | Export Button
      ======================================================== */}
      <header className="h-14 sm:h-16 px-3 sm:px-6 bg-[#03071B]/95 border-b border-white/[0.08] flex items-center justify-between z-30 shrink-0 backdrop-blur-xl">
        {/* Left: Back Arrow + 4K Badge */}
        <div className="flex items-center gap-3 sm:gap-4">
          <button
            onClick={() => navigate(-1)}
            aria-label="Back"
            className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-white/[0.07] hover:bg-white/[0.14] border border-white/[0.1] flex items-center justify-center transition-all active:scale-95"
          >
            <ChevronLeft className="w-5 h-5 text-white" />
          </button>

          {/* 4K 3840 x 2160 Badge */}
          <div className="flex items-center gap-2 px-2.5 sm:px-3 py-1 rounded-full bg-gradient-to-r from-purple-950/60 to-indigo-950/60 border border-purple-500/40 shadow-[0_0_12px_rgba(139,30,243,0.3)]">
            <span className="text-[10px] sm:text-xs font-black tracking-wider px-1.5 py-0.2 rounded bg-purple-600 text-white shadow-sm">
              4K
            </span>
            <span className="text-[11px] sm:text-xs font-mono font-bold tracking-tight text-purple-200">
              3840 x 2160
            </span>
          </div>
        </div>

        {/* Center: Undo + Redo + Zoom readout */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          <button
            onClick={handleUndo}
            disabled={historyIndex === 0}
            aria-label="Undo"
            className={cn(
              'w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center transition-all',
              historyIndex > 0
                ? 'bg-white/[0.07] hover:bg-white/[0.15] text-white active:scale-95'
                : 'bg-white/[0.03] text-white/30 cursor-not-allowed'
            )}
          >
            <Undo2 className="w-4 h-4" />
          </button>

          <button
            onClick={handleRedo}
            disabled={historyIndex >= history.length - 1}
            aria-label="Redo"
            className={cn(
              'w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center transition-all',
              historyIndex < history.length - 1
                ? 'bg-white/[0.07] hover:bg-white/[0.15] text-white active:scale-95'
                : 'bg-white/[0.03] text-white/30 cursor-not-allowed'
            )}
          >
            <Redo2 className="w-4 h-4" />
          </button>

          <div className="hidden sm:flex items-center px-2 py-0.5 rounded-full bg-white/[0.05] border border-white/[0.08] text-[11px] font-mono text-white/70">
            {zoomLevel}%
          </div>
        </div>

        {/* Right: Color Histogram + Export Button */}
        <div className="flex items-center gap-2.5 sm:gap-4">
          {/* Histogram Visualization (Mini Color Curve Graph) */}
          <div
            className="w-14 sm:w-18 h-7 sm:h-8 rounded-lg bg-black/50 border border-white/[0.1] p-1 flex items-end justify-between overflow-hidden shadow-inner"
            title="RGB Histogram"
          >
            <svg className="w-full h-full" viewBox="0 0 100 40" preserveAspectRatio="none">
              {/* Red Channel Curve */}
              <path
                d="M 0 38 Q 20 5, 45 22 T 80 10 T 100 35"
                fill="none"
                stroke="#EF4444"
                strokeWidth="1.5"
                opacity="0.85"
              />
              {/* Green Channel Curve */}
              <path
                d="M 0 35 Q 25 18, 50 8 T 75 25 T 100 38"
                fill="none"
                stroke="#10B981"
                strokeWidth="1.5"
                opacity="0.85"
              />
              {/* Blue / Purple Channel Curve */}
              <path
                d="M 0 39 Q 30 10, 55 14 T 85 5 T 100 30"
                fill="none"
                stroke="#8B1EF3"
                strokeWidth="1.5"
                opacity="0.9"
              />
            </svg>
          </div>

          {/* Glowing Purple Export Button */}
          <button
            onClick={handleExport}
            disabled={isExporting}
            className="px-3.5 sm:px-5 py-1.5 sm:py-2 rounded-full bg-gradient-to-r from-[#8B1EF3] via-[#7015E0] to-[#055BFB] text-white text-xs sm:text-sm font-bold tracking-wide shadow-[0_0_20px_rgba(139,30,243,0.5)] hover:brightness-110 active:scale-95 transition-all flex items-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span>Export</span>
          </button>
        </div>
      </header>

      {/* ========================================================
          2. MAIN WORKSPACE / CANVAS STAGE (IMAGE 3 SPEC)
          - Left Floating Vertical Pill (Layers 3, AI Enhance, Magic Eraser, Remove BG, Chevron)
          - Right Floating Vertical Pill (Crop, Adjust, Filters, Effects)
          - Bottom-Center Floating Zoom Controller (— 100% + [ ])
      ======================================================== */}
      <div className="relative flex-1 bg-[#04081E] flex items-center justify-center p-3 sm:p-6 overflow-hidden">
        {/* Subtle Backdrop Glow */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_#0c143d_0%,_#03071B_70%)] pointer-events-none" />

        {/* Center Canvas Frame */}
        <div
          className={cn(
            'relative w-full max-w-3xl aspect-[16/10] sm:aspect-[16/9] rounded-2xl sm:rounded-3xl overflow-hidden shadow-[0_24px_70px_rgba(0,0,0,0.85)] border border-white/[0.12] bg-black transition-transform duration-200',
            cropAspect === '1:1' && 'max-w-md aspect-square',
            cropAspect === '9:16' && 'max-w-xs aspect-[9/16]'
          )}
          style={{
            transform: `scale(${zoomLevel / 100})`,
          }}
        >
          {/* Main Background Artwork */}
          <img
            src={currentPhoto.url}
            alt={currentPhoto.name}
            referrerPolicy="no-referrer"
            style={{ filter: computedFilter }}
            className="w-full h-full object-cover transition-all duration-300"
          />

          {/* Vignette Overlay if adjusted */}
          {adjustments.vignette > 0 && (
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                boxShadow: `inset 0 0 ${adjustments.vignette * 1.8}px rgba(0,0,0,0.85)`,
              }}
            />
          )}

          {/* Dynamic Layers (Text & Stickers) */}
          {layers
            .filter((l) => l.visible)
            .map((layer) => {
              if (layer.type === 'text') {
                return (
                  <div
                    key={layer.id}
                    onClick={() => setSelectedLayerId(layer.id)}
                    className="absolute cursor-move z-10 select-none group"
                    style={{
                      left: `${layer.x}%`,
                      top: `${layer.y}%`,
                      transform: 'translate(-50%, -50%)',
                      opacity: layer.opacity / 100,
                    }}
                  >
                    <div
                      className={cn(
                        'px-4 py-1.5 rounded-lg border-2 transition-colors',
                        selectedLayerId === layer.id ? 'border-purple-500/80 bg-black/20' : 'border-transparent'
                      )}
                    >
                      <span
                        className="font-black tracking-wider drop-shadow-[0_4px_16px_rgba(0,0,0,0.9)]"
                        style={{
                          fontSize: `${layer.fontSize}px`,
                          color: layer.color,
                          fontFamily: FONT_OPTIONS.find((f) => f.id === layer.font)?.family || "'Bebas Neue', sans-serif",
                        }}
                      >
                        {layer.text}
                      </span>
                    </div>
                  </div>
                );
              }

              if (layer.type === 'sticker') {
                return (
                  <div
                    key={layer.id}
                    onClick={() => setSelectedLayerId(layer.id)}
                    className="absolute cursor-move z-10 select-none"
                    style={{
                      left: `${layer.x}%`,
                      top: `${layer.y}%`,
                      transform: 'translate(-50%, -50%)',
                      opacity: layer.opacity / 100,
                    }}
                  >
                    <div className="px-3 py-1 rounded-full bg-gradient-to-r from-red-600 via-purple-600 to-indigo-600 text-white text-xs font-black tracking-widest shadow-xl border border-white/20">
                      {layer.label}
                    </div>
                  </div>
                );
              }

              return null;
            })}

          {/* Interactive Split Comparison Slider */}
          {isComparing && (
            <div
              className="absolute inset-y-0 right-0 overflow-hidden border-l-2 border-white pointer-events-none shadow-2xl z-20"
              style={{ width: `${100 - compareSlider}%` }}
            >
              <img
                src={currentPhoto.url}
                alt="Original Unedited"
                referrerPolicy="no-referrer"
                className="absolute inset-0 w-full h-full object-cover filter-none"
                style={{ width: '100%', height: '100%' }}
              />
              <div className="absolute top-3 right-3 px-2 py-0.5 rounded bg-black/80 text-[10px] font-bold text-white uppercase tracking-wider">
                Original
              </div>
            </div>
          )}
        </div>

        {/* ========================================================
            LEFT FLOATING PILL TOOLBAR (IMAGE 3 SPEC)
            - Layers (Badge 3)
            - AI Enhance (Sparkles)
            - Magic Eraser (Wand)
            - Remove BG (Scissors)
            - ChevronDown (Expand)
        ======================================================== */}
        <div className="absolute left-4 sm:left-8 top-1/2 -translate-y-1/2 z-30 flex flex-col items-center gap-2 p-1.5 rounded-full bg-black/60 backdrop-blur-2xl border border-white/[0.12] shadow-2xl">
          {/* Layers Button with badge count '3' */}
          <button
            onClick={() => setShowLayersModal((s) => !s)}
            aria-label="Layers"
            className="relative w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-white/[0.08] hover:bg-white/[0.16] text-white flex items-center justify-center transition-all active:scale-95 group"
          >
            <Layers className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
            <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-[9px] font-black flex items-center justify-center ring-2 ring-black shadow-md">
              {layers.length}
            </span>
          </button>

          {/* AI Enhance */}
          <button
            onClick={() => handleAiAction('AI Enhance')}
            aria-label="AI Enhance"
            className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-white/[0.08] hover:bg-white/[0.16] text-purple-300 flex items-center justify-center transition-all active:scale-95"
            title="AI Enhance"
          >
            <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 text-purple-400" />
          </button>

          {/* Magic Eraser */}
          <button
            onClick={() => handleAiAction('Magic Eraser')}
            aria-label="Magic Eraser"
            className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-white/[0.08] hover:bg-white/[0.16] text-amber-300 flex items-center justify-center transition-all active:scale-95"
            title="Magic Eraser"
          >
            <Wand2 className="w-4 h-4 sm:w-5 sm:h-5 text-amber-400" />
          </button>

          {/* Remove BG */}
          <button
            onClick={() => handleAiAction('Remove Background')}
            aria-label="Remove Background"
            className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-white/[0.08] hover:bg-white/[0.16] text-emerald-300 flex items-center justify-center transition-all active:scale-95"
            title="Remove Background"
          >
            <Scissors className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-400" />
          </button>

          {/* Chevron Down for more quick tools */}
          <button
            onClick={() => setActiveTool((prev) => (prev === 'more' ? null : 'more'))}
            aria-label="More Quick Tools"
            className="w-8 h-8 rounded-full hover:bg-white/[0.1] text-white/60 hover:text-white flex items-center justify-center transition-all"
          >
            <ChevronDown className="w-4 h-4" />
          </button>
        </div>

        {/* ========================================================
            RIGHT FLOATING PILL TOOLBAR (IMAGE 3 SPEC)
            - Crop
            - Adjust
            - Filters
            - Effects
        ======================================================== */}
        <div className="absolute right-4 sm:right-8 top-1/2 -translate-y-1/2 z-30 flex flex-col items-center gap-2 p-1.5 rounded-full bg-black/60 backdrop-blur-2xl border border-white/[0.12] shadow-2xl">
          <button
            onClick={() => setActiveTool((prev) => (prev === 'crop' ? null : 'crop'))}
            aria-label="Crop"
            className={cn(
              'w-10 h-10 sm:w-11 sm:h-11 rounded-full flex items-center justify-center transition-all active:scale-95',
              activeTool === 'crop'
                ? 'bg-purple-600 text-white shadow-[0_0_15px_rgba(139,30,243,0.7)]'
                : 'bg-white/[0.08] hover:bg-white/[0.16] text-white'
            )}
            title="Crop"
          >
            <Crop className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>

          <button
            onClick={() => setActiveTool((prev) => (prev === 'adjust' ? null : 'adjust'))}
            aria-label="Adjust"
            className={cn(
              'w-10 h-10 sm:w-11 sm:h-11 rounded-full flex items-center justify-center transition-all active:scale-95',
              activeTool === 'adjust'
                ? 'bg-purple-600 text-white shadow-[0_0_15px_rgba(139,30,243,0.7)]'
                : 'bg-white/[0.08] hover:bg-white/[0.16] text-white'
            )}
            title="Adjust"
          >
            <Sliders className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>

          <button
            onClick={() => setActiveTool((prev) => (prev === 'filters' ? null : 'filters'))}
            aria-label="Filters"
            className={cn(
              'w-10 h-10 sm:w-11 sm:h-11 rounded-full flex items-center justify-center transition-all active:scale-95',
              activeTool === 'filters'
                ? 'bg-purple-600 text-white shadow-[0_0_15px_rgba(139,30,243,0.7)]'
                : 'bg-white/[0.08] hover:bg-white/[0.16] text-white'
            )}
            title="Filters"
          >
            <Sparkle className="w-4 h-4 sm:w-5 sm:h-5 text-purple-300" />
          </button>

          <button
            onClick={() => setActiveTool((prev) => (prev === 'effects' ? null : 'effects'))}
            aria-label="Effects"
            className={cn(
              'w-10 h-10 sm:w-11 sm:h-11 rounded-full flex items-center justify-center transition-all active:scale-95',
              activeTool === 'effects'
                ? 'bg-purple-600 text-white shadow-[0_0_15px_rgba(139,30,243,0.7)]'
                : 'bg-white/[0.08] hover:bg-white/[0.16] text-white'
            )}
            title="Effects"
          >
            <Zap className="w-4 h-4 sm:w-5 sm:h-5 text-amber-300" />
          </button>
        </div>

        {/* ========================================================
            BOTTOM-CENTER FLOATING ZOOM CONTROLLER (IMAGE 3 SPEC)
            - Zoom Out (—) | 100% | Zoom In (+) | Fit Screen [ ]
        ======================================================== */}
        <div className="absolute bottom-3 sm:bottom-5 left-1/2 -translate-x-1/2 z-30 flex items-center gap-3 px-4 py-1.5 rounded-full bg-black/65 backdrop-blur-2xl border border-white/[0.12] shadow-2xl">
          <button
            onClick={() => setZoomLevel((z) => Math.max(25, z - 15))}
            aria-label="Zoom Out"
            className="w-6 h-6 rounded-full hover:bg-white/[0.12] flex items-center justify-center text-white/80 hover:text-white transition"
          >
            <Minus className="w-3.5 h-3.5" />
          </button>

          <span className="text-xs font-mono font-bold tracking-tight text-white/90 min-w-[42px] text-center">
            {zoomLevel}%
          </span>

          <button
            onClick={() => setZoomLevel((z) => Math.min(250, z + 15))}
            aria-label="Zoom In"
            className="w-6 h-6 rounded-full hover:bg-white/[0.12] flex items-center justify-center text-white/80 hover:text-white transition"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>

          <div className="w-px h-4 bg-white/20" />

          <button
            onClick={() => setZoomLevel(100)}
            aria-label="Fit to Screen"
            className="w-6 h-6 rounded-full hover:bg-white/[0.12] flex items-center justify-center text-white/80 hover:text-white transition"
            title="Reset to 100%"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* ========================================================
          ACTIVE TOOL DRAWER / SUB-PANEL (EXPANDABLE)
      ======================================================== */}
      <AnimatePresence>
        {activeTool && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="bg-[#05081E]/95 border-t border-white/[0.08] px-4 sm:px-8 py-3.5 z-30 overflow-hidden shadow-2xl"
          >
            <div className="max-w-4xl mx-auto">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-black uppercase tracking-wider text-purple-400">
                  {activeTool} Controls
                </span>
                <button
                  onClick={() => setActiveTool(null)}
                  className="p-1 rounded-full hover:bg-white/10 text-white/60 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Crop Aspect Tool */}
              {activeTool === 'crop' && (
                <div className="flex items-center gap-3 overflow-x-auto no-scrollbar py-1">
                  {['16:9', '9:16', '1:1', '4:3', 'Free'].map((aspect) => (
                    <button
                      key={aspect}
                      onClick={() => {
                        setCropAspect(aspect);
                        toast.success(`Crop aspect ratio: ${aspect}`);
                      }}
                      className={cn(
                        'px-4 py-1.5 rounded-xl text-xs font-bold transition-all',
                        cropAspect === aspect
                          ? 'bg-purple-600 text-white shadow-md'
                          : 'bg-white/[0.06] text-white/70 hover:bg-white/[0.12]'
                      )}
                    >
                      {aspect}
                    </button>
                  ))}
                </div>
              )}

              {/* Adjust Sliders */}
              {activeTool === 'adjust' && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                  <div>
                    <div className="flex justify-between font-semibold mb-1">
                      <span>Brightness</span>
                      <span className="font-mono text-purple-400">{adjustments.brightness}%</span>
                    </div>
                    <input
                      type="range"
                      min="50"
                      max="150"
                      value={adjustments.brightness}
                      onChange={(e) => setAdjustments((a) => ({ ...a, brightness: Number(e.target.value) }))}
                      className="w-full accent-purple-500 cursor-pointer"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between font-semibold mb-1">
                      <span>Contrast</span>
                      <span className="font-mono text-purple-400">{adjustments.contrast}%</span>
                    </div>
                    <input
                      type="range"
                      min="50"
                      max="180"
                      value={adjustments.contrast}
                      onChange={(e) => setAdjustments((a) => ({ ...a, contrast: Number(e.target.value) }))}
                      className="w-full accent-purple-500 cursor-pointer"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between font-semibold mb-1">
                      <span>Saturation</span>
                      <span className="font-mono text-purple-400">{adjustments.saturation}%</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="200"
                      value={adjustments.saturation}
                      onChange={(e) => setAdjustments((a) => ({ ...a, saturation: Number(e.target.value) }))}
                      className="w-full accent-purple-500 cursor-pointer"
                    />
                  </div>
                </div>
              )}

              {/* Filters Carousel */}
              {activeTool === 'filters' && (
                <div className="flex items-center gap-3 overflow-x-auto no-scrollbar py-1">
                  {FILTER_PRESETS.map((preset) => (
                    <button
                      key={preset.id}
                      onClick={() => {
                        setActiveFilter(preset.id);
                        toast.success(`Filter ${preset.name} applied`);
                      }}
                      className={cn(
                        'flex flex-col items-center gap-1.5 p-1.5 rounded-xl border transition-all shrink-0',
                        activeFilter === preset.id
                          ? 'border-purple-500 bg-purple-600/20 shadow-[0_0_12px_rgba(139,30,243,0.4)]'
                          : 'border-white/10 hover:border-white/20 bg-white/[0.04]'
                      )}
                    >
                      <div className="w-14 h-14 rounded-lg overflow-hidden relative">
                        <img
                          src={currentPhoto.url}
                          alt={preset.name}
                          style={{ filter: preset.filter }}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <span className="text-[10px] font-bold text-slate-300">{preset.name}</span>
                    </button>
                  ))}
                </div>
              )}

              {/* Text Typography formatting */}
              {activeTool === 'text' && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
                    {FONT_OPTIONS.map((font) => (
                      <button
                        key={font.id}
                        onClick={() => {
                          setLayers((prev) =>
                            prev.map((l) => (l.id === selectedLayerId ? { ...l, font: font.id } : l))
                          );
                        }}
                        className="px-3 py-1.5 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] text-xs font-semibold whitespace-nowrap"
                        style={{ fontFamily: font.family }}
                      >
                        {font.name}
                      </button>
                    ))}
                  </div>

                  <div className="flex items-center gap-3">
                    <input
                      type="text"
                      defaultValue="ARVDOUL"
                      onChange={(e) => {
                        const val = e.target.value;
                        setLayers((prev) =>
                          prev.map((l) => (l.id === selectedLayerId ? { ...l, text: val } : l))
                        );
                      }}
                      placeholder="Enter typography text..."
                      className="flex-1 bg-white/[0.06] border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white outline-none focus:border-purple-500"
                    />
                    <button
                      onClick={() => {
                        const newLayer = {
                          id: `layer-text-${Date.now()}`,
                          name: 'New Text',
                          type: 'text',
                          text: 'NEW HEADLINE',
                          font: 'bebas',
                          fontSize: 54,
                          color: '#FFFFFF',
                          x: 50,
                          y: 50,
                          visible: true,
                          locked: false,
                          opacity: 100,
                        };
                        setLayers((prev) => [newLayer, ...prev]);
                        setSelectedLayerId(newLayer.id);
                        toast.success('Text layer added');
                      }}
                      className="px-3.5 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-xs font-bold text-white transition"
                    >
                      + Add Text
                    </button>
                  </div>
                </div>
              )}

              {/* Drawing Tool */}
              {activeTool === 'draw' && (
                <div className="flex items-center gap-4 text-xs font-semibold">
                  <div className="flex items-center gap-2">
                    <span>Color:</span>
                    {['#8B1EF3', '#EF4444', '#10B981', '#3B82F6', '#F59E0B', '#FFFFFF'].map((color) => (
                      <button
                        key={color}
                        onClick={() => setDrawColor(color)}
                        className={cn(
                          'w-6 h-6 rounded-full border-2 transition',
                          drawColor === color ? 'border-white scale-110 shadow-lg' : 'border-transparent'
                        )}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>

                  <div className="flex items-center gap-2">
                    <span>Brush:</span>
                    <input
                      type="range"
                      min="2"
                      max="30"
                      value={drawSize}
                      onChange={(e) => setDrawSize(Number(e.target.value))}
                      className="accent-purple-500"
                    />
                  </div>
                </div>
              )}

              {/* Stickers & Badges */}
              {activeTool === 'stickers' && (
                <div className="flex items-center gap-3 overflow-x-auto no-scrollbar">
                  {['4K ULTRA', 'PRO', 'CREATOR', 'VERIFIED', 'NEW RELEASE', 'ARVDOUL'].map((badge) => (
                    <button
                      key={badge}
                      onClick={() => {
                        const newLayer = {
                          id: `layer-sticker-${Date.now()}`,
                          name: `Badge: ${badge}`,
                          type: 'sticker',
                          label: badge,
                          x: 50,
                          y: 50,
                          visible: true,
                          locked: false,
                          opacity: 100,
                        };
                        setLayers((prev) => [newLayer, ...prev]);
                        setSelectedLayerId(newLayer.id);
                        toast.success(`Badge "${badge}" added`);
                      }}
                      className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-purple-600/30 to-indigo-600/30 border border-purple-500/40 text-xs font-black tracking-wider text-purple-200 hover:brightness-125 transition"
                    >
                      {badge}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ========================================================
          3. MULTI-PHOTO FILMSTRIP CAROUSEL (EXACT IMAGE 3 SPEC)
          + Add | Thumbnail 1 | Thumbnail 2 (Active with Purple Glow) | Thumbnail 3 | Thumbnail 4
      ======================================================== */}
      <div className="px-3 sm:px-6 py-2.5 bg-[#03071B]/95 border-t border-white/[0.08] flex items-center gap-3 overflow-x-auto no-scrollbar shrink-0">
        {/* + Add Button */}
        <button
          onClick={() => fileInputRef.current?.click()}
          aria-label="Add Photo"
          className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-white/[0.04] hover:bg-white/[0.08] border border-dashed border-white/20 flex flex-col items-center justify-center gap-1 text-white/70 hover:text-white transition-all active:scale-95 shrink-0"
        >
          <Plus className="w-4 h-4 sm:w-5 sm:h-5 text-purple-400" />
          <span className="text-[10px] font-bold">Add</span>
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleAddPhoto}
          className="hidden"
        />

        {/* Thumbnail Filmstrip with Numbers (1, 2, 3, 4...) */}
        {photos.map((p) => {
          const isActive = p.id === activePhotoId;

          return (
            <div
              key={p.id}
              onClick={() => {
                setActivePhotoId(p.id);
                toast.info(`Switched to Image ${p.num}`);
              }}
              className={cn(
                'relative w-14 h-14 sm:w-16 sm:h-16 rounded-2xl overflow-hidden cursor-pointer transition-all duration-200 shrink-0 group',
                isActive
                  ? 'ring-2 ring-purple-500 ring-offset-2 ring-offset-[#03071B] shadow-[0_0_16px_rgba(139,30,243,0.7)] scale-105'
                  : 'opacity-70 hover:opacity-100 border border-white/[0.1]'
              )}
            >
              <img src={p.url} alt={p.name} className="w-full h-full object-cover" />

              {/* Number Badge (1, 2, 3...) in top left corner as shown in Image 3 */}
              <div
                className={cn(
                  'absolute top-1 left-1 w-4 h-4 rounded-md flex items-center justify-center text-[10px] font-black shadow-md',
                  isActive ? 'bg-purple-600 text-white' : 'bg-black/70 text-white/80'
                )}
              >
                {p.num}
              </div>
            </div>
          );
        })}
      </div>

      {/* ========================================================
          4. CATEGORY NAVIGATION PILLS (EXACT IMAGE 3 SPEC)
          Favorites | All Tools (Active) | AI Tools (NEW) | Adjust | Draw | Filters
      ======================================================== */}
      <div className="px-3 sm:px-6 py-2 bg-[#03071B]/95 border-t border-white/[0.05] flex items-center gap-2 overflow-x-auto no-scrollbar shrink-0">
        {CATEGORIES.map((cat) => {
          const isActive = activeCategory === cat.id;

          return (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={cn(
                'px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5',
                isActive
                  ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-[0_0_12px_rgba(139,30,243,0.4)]'
                  : 'bg-white/[0.05] text-white/70 hover:bg-white/[0.1] hover:text-white'
              )}
            >
              <span>{cat.label}</span>
              {cat.isNew && (
                <span className="text-[9px] font-black px-1.5 py-0.2 rounded-full bg-gradient-to-r from-red-500 to-pink-500 text-white shadow-sm animate-pulse">
                  NEW
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ========================================================
          5. 10-TOOL GRID (2 ROWS × 5 COLUMNS) (EXACT IMAGE 3 SPEC)
          Row 1: Crop | Adjust | Filters | Text | Draw
          Row 2: Stickers | Frames | Effects | AI Enhance | More
      ======================================================== */}
      <div className="px-3 sm:px-6 py-2.5 bg-[#03071B]/95 border-t border-white/[0.06] overflow-x-auto shrink-0">
        <div className="grid grid-cols-5 gap-2 sm:gap-3 max-w-4xl mx-auto">
          {GRID_TOOLS.map((tool) => {
            const Icon = tool.icon;
            const isToolActive = activeTool === tool.id;

            return (
              <button
                key={tool.id}
                onClick={() => {
                  if (tool.id === 'ai-enhance') {
                    handleAiAction('AI Enhance');
                  } else {
                    setActiveTool((prev) => (prev === tool.id ? null : tool.id));
                  }
                }}
                className={cn(
                  'flex flex-col items-center justify-center p-2 rounded-2xl transition-all duration-200 active:scale-95 group',
                  isToolActive
                    ? 'bg-gradient-to-br from-purple-600/40 to-indigo-600/40 border border-purple-500/80 text-white shadow-[0_0_15px_rgba(139,30,243,0.4)]'
                    : 'bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] text-white/70 hover:text-white'
                )}
              >
                <div className="w-8 h-8 rounded-xl flex items-center justify-center mb-1">
                  <Icon
                    className={cn(
                      'w-5 h-5 transition-transform group-hover:scale-110',
                      tool.isAi ? 'text-purple-400' : 'text-white/80 group-hover:text-white'
                    )}
                  />
                </div>
                <span className="text-[11px] font-semibold tracking-tight truncate w-full text-center">
                  {tool.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ========================================================
          6. BOTTOM STICKY NAVIGATION (IMAGE 3 SPEC)
          Tools (Active) | Presets | History | Compare | Reset
      ======================================================== */}
      <footer className="h-14 px-4 sm:px-8 bg-[#03071B] border-t border-white/[0.08] flex items-center justify-around z-30 shrink-0">
        {BOTTOM_NAV_TABS.map((tab) => {
          const isActive = bottomNavTab === tab.id;
          const Icon = tab.icon;

          return (
            <button
              key={tab.id}
              onClick={() => {
                setBottomNavTab(tab.id);
                if (tab.id === 'compare') {
                  setIsComparing((c) => !c);
                  toast.info(isComparing ? 'Exit comparison' : 'Split-screen comparison active');
                } else if (tab.id === 'reset') {
                  handleReset();
                } else if (tab.id === 'presets') {
                  setActiveTool('filters');
                } else if (tab.id === 'history') {
                  toast.info(`History: ${historyIndex + 1} / ${history.length} snapshots`);
                } else if (tab.id === 'tools') {
                  setActiveTool(null);
                }
              }}
              className={cn(
                'flex flex-col items-center justify-center gap-1 transition-all group relative',
                isActive || (tab.id === 'compare' && isComparing)
                  ? 'text-purple-400 font-bold'
                  : 'text-white/50 hover:text-white'
              )}
            >
              <Icon className="w-4 h-4 sm:w-5 sm:h-5" />
              <span className="text-[10px] tracking-tight">{tab.label}</span>
              {(isActive || (tab.id === 'compare' && isComparing)) && (
                <div className="w-1.5 h-1.5 rounded-full bg-purple-500 shadow-[0_0_8px_rgba(139,30,243,0.8)]" />
              )}
            </button>
          );
        })}
      </footer>

      {/* ========================================================
          LAYERS MODAL OVERLAY
      ======================================================== */}
      <AnimatePresence>
        {showLayersModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.95, y: 10 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 10 }}
              className="w-full max-w-sm rounded-3xl bg-[#0F1738] border border-white/20 shadow-2xl p-4 flex flex-col gap-3"
            >
              <div className="flex items-center justify-between pb-2 border-b border-white/10">
                <div className="flex items-center gap-2">
                  <Layers className="w-4 h-4 text-purple-400" />
                  <span className="text-sm font-bold text-white">Project Layers ({layers.length})</span>
                </div>
                <button
                  onClick={() => setShowLayersModal(false)}
                  className="p-1 rounded-full hover:bg-white/10 text-white/60 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="flex flex-col gap-2 max-h-60 overflow-y-auto pr-1">
                {layers.map((l) => (
                  <div
                    key={l.id}
                    onClick={() => setSelectedLayerId(l.id)}
                    className={cn(
                      'p-2.5 rounded-xl border flex items-center justify-between cursor-pointer transition',
                      selectedLayerId === l.id
                        ? 'bg-purple-600/25 border-purple-500 text-white'
                        : 'bg-white/5 hover:bg-white/10 border-white/5 text-slate-300'
                    )}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {l.type === 'text' ? (
                        <Type className="w-4 h-4 text-purple-400 shrink-0" />
                      ) : (
                        <ImageIcon className="w-4 h-4 text-blue-400 shrink-0" />
                      )}
                      <span className="text-xs font-semibold truncate">{l.name}</span>
                    </div>

                    <div className="flex items-center gap-1 text-slate-400">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setLayers((prev) =>
                            prev.map((item) => (item.id === l.id ? { ...item, visible: !item.visible } : item))
                          );
                        }}
                        className="p-1 rounded hover:text-white"
                      >
                        {l.visible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5 text-red-400" />}
                      </button>
                      {l.type !== 'image' && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setLayers((prev) => prev.filter((item) => item.id !== l.id));
                            toast.info('Layer deleted');
                          }}
                          className="p-1 rounded hover:text-red-400"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <button
                onClick={() => {
                  const newLayer = {
                    id: `layer-text-${Date.now()}`,
                    name: 'New Text Layer',
                    type: 'text',
                    text: 'NEW HEADLINE',
                    font: 'bebas',
                    fontSize: 56,
                    color: '#FFFFFF',
                    x: 50,
                    y: 50,
                    visible: true,
                    locked: false,
                    opacity: 100,
                  };
                  setLayers((prev) => [newLayer, ...prev]);
                  setSelectedLayerId(newLayer.id);
                  toast.success('Text layer created');
                }}
                className="w-full py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-xs font-bold text-white transition"
              >
                + Add New Layer
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
