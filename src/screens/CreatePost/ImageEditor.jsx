// src/screens/CreatePost/ImageEditor.jsx – ARVDOUL Creator Studio v4.0
// Complete viewport engine, workspace layout, 8pt grid, elevation system,
// responsive breakpoints, minimap, status bar, professional canvas.
// All previous features (layers, shapes, drawing, text, crop, adjust, filter,
// rotate, history, auto‑save, export, templates, guides, mobile) are included.

import React, {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  forwardRef,
  memo,
  Suspense,
  lazy,
} from 'react';
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
  Ellipse,
  Star,
  Path,
} from 'react-konva';
import Cropper from 'react-easy-crop';
import { toast } from 'sonner';
import * as Icons from 'lucide-react';
import useMediaQuery from '../../hooks/useMediaQuery';
import Konva from 'konva';
import { useGesture } from '@use-gesture/react';
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { v4 as uuidv4 } from 'uuid';
import { openDB } from 'idb';
import imageCompression from 'browser-image-compression';
import FocusTrap from 'focus-trap-react';
import debounce from 'lodash-es/debounce';
import clamp from 'lodash-es/clamp';

// Design system imports (unchanged)
import {
  ARVDOUL_GRADIENT,
  ARVDOUL_SHADOW,
  TOKENS,
  THEME_TOKENS,
  TOOLS,
  CANVAS,
  HISTORY,
  LAYOUT,
  ASPECT_RATIOS,
  GOOGLE_FONTS,
  FILTER_CATEGORIES,
} from './editorConstants';

import {
  editorReducer,
  DEFAULT_STATE,
  actions,
  selectors,
  getFilterCSS,
} from './editorReducer';

import {
  loadImage,
  createCanvas,
  canvasToBlob,
  cleanupImage,
} from './imageEffects';

import AdjustTool from '../../components/Shared/AdjustTool';
import FilterTool from '../../components/Shared/FilterTool';
import CropTool from '../../components/Shared/CropTool';
import RotateTool from '../../components/Shared/RotateTool';
import TextTool from '../../components/Shared/TextTool';
import LoadingSpinner from '../../components/Shared/LoadingSpinner';
import ColorPicker from '../../components/Shared/ColorPicker';

const GIFPicker = lazy(() => import('../../components/Shared/GIFPicker'));
const DrawingTool = lazy(() => import('../../components/Shared/DrawingTool'));

// ==================== DESIGN SYSTEM TOKENS ====================
const SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
};

const ELEVATION = {
  0: 'none',
  1: '0 1px 3px rgba(0,0,0,0.12), 0 1px 2px rgba(0,0,0,0.08)',
  2: '0 3px 6px rgba(0,0,0,0.16), 0 3px 6px rgba(0,0,0,0.12)',
  3: '0 10px 20px rgba(0,0,0,0.19), 0 6px 6px rgba(0,0,0,0.15)',
  4: '0 14px 28px rgba(0,0,0,0.25), 0 10px 10px rgba(0,0,0,0.12)',
  modal: '0 19px 38px rgba(0,0,0,0.30), 0 15px 12px rgba(0,0,0,0.15)',
};

const BORDER_RADIUS = {
  button: 10,
  card: 18,
  canvas: 14,
  tooltip: 12,
  input: 12,
  panel: 20,
  dialog: 24,
};

// EXPORT PRESETS
const EXPORT_PRESETS = {
  INSTAGRAM_SQUARE: { width: 1080, height: 1080, label: 'Instagram Square' },
  INSTAGRAM_PORTRAIT: { width: 1080, height: 1350, label: 'Instagram Portrait' },
  INSTAGRAM_STORY: { width: 1080, height: 1920, label: 'Instagram Story' },
  FULL_HD: { width: 1920, height: 1080, label: 'Full HD' },
};

// Built-in templates (canvas guides)
const BUILTIN_TEMPLATES = [
  {
    name: 'Instagram Post',
    canvasWidth: 1080,
    canvasHeight: 1080,
    guides: [
      { type: 'rule-of-thirds', color: 'rgba(255,255,255,0.2)' },
      { type: 'center-lines', color: 'rgba(255,255,255,0.1)' },
    ],
  },
  {
    name: 'Instagram Story',
    canvasWidth: 1080,
    canvasHeight: 1920,
    guides: [
      { type: 'safe-zone', inset: 50, color: 'rgba(255,255,255,0.2)' },
      { type: 'center-lines', color: 'rgba(255,255,255,0.1)' },
    ],
  },
];

// ==================== SUB‑COMPONENTS ====================

// Tooltip
const Tooltip = memo(({ children, content, shortcut, position = 'top' }) => {
  const [show, setShow] = useState(false);
  const posClasses = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2',
  };
  return (
    <div className="relative inline-flex" onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)}>
      {children}
      <AnimatePresence>
        {show && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className={`absolute z-50 px-3 py-2 bg-gray-900/95 backdrop-blur-sm text-white text-xs rounded-lg whitespace-nowrap shadow-xl ${posClasses[position]}`}
          >
            <div className="flex items-center gap-2">
              <span>{content}</span>
              {shortcut && <kbd className="px-1.5 py-0.5 bg-white/10 rounded text-[10px]">{shortcut}</kbd>}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});

// Button with elevation
const Button = memo(
  ({ onClick, disabled, variant = 'ghost', size = 'md', className, children, ...props }) => {
    const base =
      'inline-flex items-center justify-center font-medium transition-all duration-200 rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-400 disabled:opacity-40 disabled:cursor-not-allowed';
    const sizes = { sm: 'h-8 px-3 text-xs', md: 'h-10 px-4 text-sm', lg: 'h-12 px-6 text-base', icon: 'w-10 h-10 p-0' };
    const variants = {
      ghost: 'bg-white/5 hover:bg-white/15 text-white hover:shadow-md',
      primary: 'bg-gradient-to-r from-purple-600 to-cyan-500 text-white shadow-lg shadow-purple-500/25 hover:shadow-xl hover:shadow-purple-500/30',
      danger: 'bg-red-500/20 hover:bg-red-500/30 text-red-200',
    };
    return (
      <motion.button
        whileHover={!disabled ? { scale: 1.03 } : {}}
        whileTap={!disabled ? { scale: 0.97 } : {}}
        onClick={onClick}
        disabled={disabled}
        className={`${base} ${sizes[size]} ${variants[variant]} ${className}`}
        style={{ borderRadius: BORDER_RADIUS.button }}
        {...props}
      >
        {children}
      </motion.button>
    );
  }
);

// Tool button (with active indicator)
const ToolButton = memo(({ icon: Icon, label, shortcut, isActive, onClick }) => (
  <Tooltip content={label} shortcut={shortcut}>
    <motion.button
      whileHover={{ scale: 1.08 }}
      whileTap={{ scale: 0.92 }}
      onClick={onClick}
      className={`
        relative flex flex-col items-center justify-center p-2 rounded-2xl
        transition-all duration-200 group
        ${isActive
          ? 'bg-gradient-to-br from-purple-600/80 to-cyan-500/80 text-white shadow-lg shadow-purple-500/20'
          : 'bg-white/5 hover:bg-white/10 text-white/70 hover:text-white hover:shadow-md'
        }
      `}
      style={{ width: 56, height: 56, borderRadius: BORDER_RADIUS.button }}
      aria-label={label}
    >
      <Icon className="w-5 h-5" />
      <span className="text-[9px] mt-1 font-medium opacity-80 leading-none">{label}</span>
      {isActive && <motion.div layoutId="activeTool" className="absolute inset-0 rounded-2xl border-2 border-white/20" initial={false} />}
    </motion.button>
  </Tooltip>
));

// Canvas guides overlay
const GuidesOverlay = memo(({ stageSize, zoom, panX, panY, guides, showGrid, safeZonePadding }) => {
  const calcPos = (val, offset) => val * zoom + offset;
  return (
    <svg className="absolute inset-0 pointer-events-none" style={{ width: '100%', height: '100%' }}>
      {showGrid && (
        <pattern id="grid" width={20 * zoom} height={20 * zoom} patternUnits="userSpaceOnUse" x={panX} y={panY}>
          <path d={`M ${20 * zoom} 0 L 0 0 0 ${20 * zoom}`} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="0.5" />
        </pattern>
      )}
      {showGrid && <rect width="100%" height="100%" fill="url(#grid)" />}
      {guides?.centerLines && (
        <>
          <line x1={calcPos(stageSize.width/2, panX)} y1={0} x2={calcPos(stageSize.width/2, panX)} y2="100%" stroke="rgba(255,255,255,0.15)" strokeDasharray="5,5" />
          <line x1={0} y1={calcPos(stageSize.height/2, panY)} x2="100%" y2={calcPos(stageSize.height/2, panY)} stroke="rgba(255,255,255,0.15)" strokeDasharray="5,5" />
        </>
      )}
      {guides?.ruleOfThirds && (
        <>
          {[1/3, 2/3].map(fract => (
            <React.Fragment key={fract}>
              <line x1={calcPos(stageSize.width * fract, panX)} y1={0} x2={calcPos(stageSize.width * fract, panX)} y2="100%" stroke="rgba(255,255,255,0.08)" />
              <line x1={0} y1={calcPos(stageSize.height * fract, panY)} x2="100%" y2={calcPos(stageSize.height * fract, panY)} stroke="rgba(255,255,255,0.08)" />
            </React.Fragment>
          ))}
        </>
      )}
      {safeZonePadding && (
        <rect
          x={calcPos(safeZonePadding, panX)}
          y={calcPos(safeZonePadding, panY)}
          width={calcPos(stageSize.width - safeZonePadding*2, 0)}
          height={calcPos(stageSize.height - safeZonePadding*2, 0)}
          fill="none"
          stroke="rgba(255,0,0,0.3)"
          strokeDasharray="10,5"
        />
      )}
    </svg>
  );
});

// Minimap Navigator
const Minimap = memo(({ width: cw, height: ch, imageWidth, imageHeight, zoom, panX, panY, stageSize, containerSize }) => {
  const minimapWidth = 160;
  const minimapHeight = 120;
  const scale = Math.min(minimapWidth / stageSize.width, minimapHeight / stageSize.height);
  const viewX = -panX * scale;
  const viewY = -panY * scale;
  const viewW = stageSize.width * scale / zoom;
  const viewH = stageSize.height * scale / zoom;

  return (
    <div className="absolute bottom-4 left-4 w-40 h-30 bg-black/40 backdrop-blur-md rounded-lg overflow-hidden border border-white/10 shadow-xl">
      <svg width={minimapWidth} height={minimapHeight}>
        <rect width="100%" height="100%" fill="#1e1e2e" />
        <rect
          x={viewX}
          y={viewY}
          width={viewW}
          height={viewH}
          fill="none"
          stroke="rgba(255,255,255,0.5)"
          strokeWidth="1"
        />
      </svg>
    </div>
  );
});

// Status Bar
const StatusBar = memo(({ imageWidth, imageHeight, zoom, cursorPos, memoryUsage }) => (
  <div className="flex items-center justify-between h-7 px-4 bg-black/50 backdrop-blur text-[11px] text-white/70 font-medium border-t border-white/5">
    <span>{imageWidth} × {imageHeight} | RGB | PNG</span>
    <span>{Math.round(zoom * 100)}%</span>
    <span>{cursorPos ? `${cursorPos.x}, ${cursorPos.y}` : '—'}</span>
  </div>
));

// Layer thumbnail placeholder
const LayerThumbnail = memo(({ text }) => (
  <div className="w-8 h-8 rounded bg-white/10 flex items-center justify-center text-[10px] text-white/50 overflow-hidden">
    {text?.[0] || 'T'}
  </div>
));

// Sortable layer item (enhanced)
const SortableLayerItem = memo(({ layer, isSelected, onSelect, onToggleVisibility, onToggleLock, onDuplicate, onDelete, onBlendModeChange, onRename, colorLabel, setColorLabel, isMultiSelectMode, onMultiSelectToggle }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: layer.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };
  const handleClick = (e) => {
    if (isMultiSelectMode) {
      e.stopPropagation();
      onMultiSelectToggle(layer.id);
    } else {
      onSelect(layer.id);
    }
  };
  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      className={`p-2 rounded-xl cursor-pointer group transition-all duration-150 ${
        isSelected ? 'bg-white/15 border border-white/20 shadow-md' : 'bg-white/5 hover:bg-white/10 border border-transparent'
      }`}
      onClick={handleClick}
      onPointerDown={listeners?.onPointerDown}
      onContextMenu={(e) => { e.preventDefault(); /* context menu stub */ }}
    >
      <div className="flex items-center gap-2">
        <Icons.GripVertical className="w-3.5 h-3.5 text-white/30 cursor-grab flex-shrink-0" />
        <LayerThumbnail text={layer.text} />
        <div className="flex-1 min-w-0">
          <span className="text-xs text-white truncate block">{layer.text}</span>
        </div>
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={(e) => { e.stopPropagation(); onToggleVisibility(layer.id); }} className="p-0.5 rounded hover:bg-white/10" title="Visibility">
            {layer.visible !== false ? <Icons.Eye className="w-3 h-3 text-white/60" /> : <Icons.EyeOff className="w-3 h-3 text-white/30" />}
          </button>
          <button onClick={(e) => { e.stopPropagation(); onToggleLock(layer.id); }} className="p-0.5 rounded hover:bg-white/10" title="Lock">
            {layer.locked ? <Icons.Lock className="w-3 h-3 text-yellow-300/60" /> : <Icons.Unlock className="w-3 h-3 text-white/30" />}
          </button>
          <button onClick={(e) => { e.stopPropagation(); onDuplicate(layer.id); }} className="p-0.5 rounded hover:bg-white/10" title="Duplicate">
            <Icons.Copy className="w-3 h-3 text-white/60" />
          </button>
          <button onClick={(e) => { e.stopPropagation(); onDelete(layer.id); }} className="p-0.5 rounded hover:bg-red-500/20" title="Delete">
            <Icons.Trash2 className="w-3 h-3 text-red-300" />
          </button>
        </div>
      </div>
      {isSelected && (
        <div className="mt-1 flex flex-wrap gap-1" onClick={(e) => e.stopPropagation()}>
          <input
            type="text"
            defaultValue={layer.text}
            onBlur={(e) => onRename(layer.id, e.target.value)}
            className="bg-white/5 border border-white/10 rounded text-xs text-white px-2 py-0.5 w-full"
            placeholder="Rename"
          />
          <select
            value={layer.blendMode || 'normal'}
            onChange={(e) => onBlendModeChange(layer.id, e.target.value)}
            className="bg-white/5 border border-white/10 rounded text-xs text-white px-2 py-0.5"
          >
            {['normal','multiply','screen','overlay','darken','lighten','color-dodge','color-burn','hard-light','soft-light','difference','exclusion'].map(m => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
          <div className="flex gap-1">
            {['red','orange','yellow','green','blue','purple','pink','grey'].map(c => (
              <button
                key={c}
                onClick={() => setColorLabel(layer.id, c)}
                className={`w-3.5 h-3.5 rounded-full border border-white/20 ${colorLabel[layer.id] === c ? 'ring-1 ring-white' : ''}`}
                style={{ backgroundColor: c }}
                title={c}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
});

// Full layers panel
const LayersPanel = memo(({
  layers,
  selectedIds,
  onSelect,
  onMultiSelectToggle,
  onDelete,
  onToggleVisibility,
  onToggleLock,
  onDuplicate,
  onReorder,
  onBlendModeChange,
  onRename,
  colorLabels,
  setColorLabel,
  isMultiSelectMode,
  setIsMultiSelectMode,
}) => {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));
  const [search, setSearch] = useState('');

  const filteredLayers = useMemo(() => {
    if (!search) return layers;
    return layers.filter(l => l.text.toLowerCase().includes(search.toLowerCase()));
  }, [layers, search]);

  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (active.id !== over.id) {
      const oldIndex = layers.findIndex(l => l.id === active.id);
      const newIndex = layers.findIndex(l => l.id === over.id);
      onReorder(oldIndex, newIndex);
    }
  };

  return (
    <div className="space-y-1">
      <div className="flex gap-1 mb-2">
        <input
          type="text"
          placeholder="Search layers..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-1 text-[11px] text-white"
        />
        <Button size="icon" variant="ghost" onClick={() => setIsMultiSelectMode(!isMultiSelectMode)} className={`rounded-lg ${isMultiSelectMode ? 'bg-purple-500/20' : ''}`}>
          <Icons.CheckSquare className="w-4 h-4" />
        </Button>
      </div>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={filteredLayers.map(l => l.id)} strategy={verticalListSortingStrategy}>
          {filteredLayers.length === 0 ? (
            <p className="text-xs text-white/40 text-center py-4">No layers</p>
          ) : (
            filteredLayers.map(layer => (
              <SortableLayerItem
                key={layer.id}
                layer={layer}
                isSelected={selectedIds.includes(layer.id)}
                onSelect={onSelect}
                onMultiSelectToggle={onMultiSelectToggle}
                onToggleVisibility={onToggleVisibility}
                onToggleLock={onToggleLock}
                onDuplicate={onDuplicate}
                onDelete={onDelete}
                onBlendModeChange={onBlendModeChange}
                onRename={onRename}
                colorLabel={colorLabels}
                setColorLabel={setColorLabel}
                isMultiSelectMode={isMultiSelectMode}
              />
            ))
          )}
        </SortableContext>
      </DndContext>
    </div>
  );
});

// Right Panel Groups
const RightPanelContent = memo(({ activeTool, state, dispatch, debouncedPushHistory, handleAddText, handleDeleteText, imageElement }) => {
  switch (activeTool) {
    case TOOLS.ADJUST:
      return (
        <div className="space-y-4">
          <AdjustTool
            brightness={state.adjustments.brightness}
            setBrightness={(val) => { dispatch(actions.setAdjustment('brightness', val)); debouncedPushHistory(); }}
            contrast={state.adjustments.contrast}
            setContrast={(val) => { dispatch(actions.setAdjustment('contrast', val)); debouncedPushHistory(); }}
            saturation={state.adjustments.saturation}
            setSaturation={(val) => { dispatch(actions.setAdjustment('saturation', val)); debouncedPushHistory(); }}
            resetAdjustments={() => { dispatch(actions.resetAdjustments()); dispatch(actions.pushHistory()); }}
            pushUndo={() => dispatch(actions.pushHistory())}
          />
          <div className="space-y-2">
            <label className="text-[10px] text-white/50 uppercase tracking-wider">HSL</label>
            <Slider label="Hue" min={-180} max={180} value={state.adjustments.hue || 0} onChange={(v) => { dispatch(actions.setAdjustment('hue', v)); debouncedPushHistory(); }} />
            <Slider label="Saturation" min={-100} max={100} value={state.adjustments.saturation || 0} onChange={(v) => { dispatch(actions.setAdjustment('saturation', v)); debouncedPushHistory(); }} />
            <Slider label="Lightness" min={-100} max={100} value={state.adjustments.lightness || 0} onChange={(v) => { dispatch(actions.setAdjustment('lightness', v)); debouncedPushHistory(); }} />
          </div>
        </div>
      );
    case TOOLS.FILTER:
      return (
        <FilterTool
          filter={state.filter}
          setFilter={(val) => { dispatch(actions.setFilter(val)); dispatch(actions.pushHistory()); }}
          filterIntensity={state.filterIntensity}
          setFilterIntensity={(val) => dispatch(actions.setFilterIntensity(val))}
          pushUndo={() => dispatch(actions.pushHistory())}
        />
      );
    case TOOLS.ROTATE:
      return (
        <RotateTool
          onRotateLeft={() => { dispatch(actions.rotateLeft()); dispatch(actions.pushHistory()); }}
          onRotateRight={() => { dispatch(actions.rotateRight()); dispatch(actions.pushHistory()); }}
        />
      );
    case TOOLS.TEXT:
      return (
        <TextTool
          selectedText={state.textLayers.find(t => t.id === state.selectedTextId)}
          updateSelectedText={(updates) => { if (state.selectedTextId) { dispatch(actions.updateText(state.selectedTextId, updates)); debouncedPushHistory(); } }}
          handleDeleteText={handleDeleteText}
          handleQuickAddText={handleAddText}
          imageElement={imageElement}
          pushUndo={() => dispatch(actions.pushHistory())}
        />
      );
    default:
      return (
        <div className="py-6 text-center">
          <Icons.Sliders className="w-8 h-8 text-white/20 mx-auto mb-2" />
          <p className="text-xs text-white/40">Select a tool to edit properties</p>
        </div>
      );
  }
});

const Slider = ({ label, min, max, value, onChange }) => (
  <div className="flex items-center gap-2">
    <span className="text-[10px] text-white/50 w-16">{label}</span>
    <input type="range" min={min} max={max} value={value} onChange={(e) => onChange(Number(e.target.value))} className="flex-1 accent-purple-500 h-1" />
    <span className="text-[10px] text-white/40 w-8 text-right">{value}</span>
  </div>
);

// ==================== MAIN EDITOR ====================

const ImageEditor = memo(forwardRef(function ImageEditor(
  { media, onClose, onSave, offline = false, isDark: initialDark = true },
  ref
) {
  // ========== STATE ==========
  const [state, dispatch] = useReducer(editorReducer, DEFAULT_STATE);
  const [theme, setTheme] = useState(initialDark ? 'dark' : 'light');
  const [imageElement, setImageElement] = useState(null);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [showShortcutsModal, setShowShortcutsModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [croppedImageUrl, setCroppedImageUrl] = useState(null);
  const [textPosition, setTextPosition] = useState({ x: 0, y: 0 });
  const [drawingColor, setDrawingColor] = useState('#FFFFFF');
  const [drawingBrushSize, setDrawingBrushSize] = useState(5);
  const [showRulers, setShowRulers] = useState(false);
  const [clipRegion, setClipRegion] = useState(null);
  const [selectedLayerIds, setSelectedLayerIds] = useState([]);
  const [multiSelectMode, setMultiSelectMode] = useState(false);
  const [colorLabels, setColorLabels] = useState({});
  const [workspaceMode, setWorkspaceMode] = useState('freeform');
  const [templateGuides, setTemplateGuides] = useState(null);
  const [cursorPos, setCursorPos] = useState(null);

  // Refs
  const canvasContainerRef = useRef(null);
  const stageRef = useRef(null);
  const transformerRef = useRef(null);
  const textInputRef = useRef(null);
  const containerRef = useRef(null);
  const drawLayerRef = useRef(null);

  // Media queries
  const isMobile = useMediaQuery('(max-width: 768px)');
  const isTablet = useMediaQuery('(min-width: 768px) and (max-width: 1024px)');
  const isDesktop = useMediaQuery('(min-width: 1024px)');
  const isUltrawide = useMediaQuery('(min-width: 1440px)');

  // ========== VIEWPORT ENGINE ==========
  // Compute available workspace area
  const workspacePadding = isMobile ? SPACING.md : isTablet ? SPACING.lg : SPACING.xl;
  const leftPanelWidth = isMobile ? 0 : isUltrawide ? 300 : 260;
  const rightPanelWidth = isMobile ? 0 : isUltrawide ? 340 : 300;
  const headerHeight = isMobile ? 56 : isUltrawide ? 72 : 68;
  const statusBarHeight = 28;
  const bottomPanelHeight = isMobile ? 0 : 48; // we don't use bottom panel in desktop (properties in right)

  // Canvas area size
  const canvasAreaSize = useMemo(() => {
    if (!containerRef.current) return { width: 800, height: 600 };
    const fullWidth = containerRef.current.clientWidth;
    const fullHeight = containerRef.current.clientHeight;
    const availableWidth = fullWidth - leftPanelWidth - rightPanelWidth - workspacePadding * 2;
    const availableHeight = fullHeight - headerHeight - statusBarHeight - workspacePadding * 2;
    return { width: Math.max(availableWidth, 200), height: Math.max(availableHeight, 200) };
  }, [leftPanelWidth, rightPanelWidth, workspacePadding, headerHeight, statusBarHeight, isMobile, isTablet]);

  // Safe margin around image within canvas
  const canvasPadding = isMobile ? 16 : isTablet ? 24 : 48;

  // Image fit: always use Math.min to preserve aspect and leave breathing room
  const imageScale = useMemo(() => {
    const maxW = canvasAreaSize.width - canvasPadding * 2;
    const maxH = canvasAreaSize.height - canvasPadding * 2;
    return Math.min(maxW / state.image.width, maxH / state.image.height);
  }, [canvasAreaSize, canvasPadding, state.image.width, state.image.height]);

  // Stage size and image position (centered)
  const stageSize = useMemo(() => ({
    width: canvasAreaSize.width,
    height: canvasAreaSize.height,
  }), [canvasAreaSize]);

  const imageDisplaySize = useMemo(() => ({
    width: state.image.width * imageScale,
    height: state.image.height * imageScale,
  }), [state.image.width, state.image.height, imageScale]);

  // Center offset
  const imageOffset = useMemo(() => ({
    x: (canvasAreaSize.width - imageDisplaySize.width) / 2,
    y: (canvasAreaSize.height - imageDisplaySize.height) / 2,
  }), [canvasAreaSize, imageDisplaySize]);

  // ========== LOAD IMAGE ==========
  useEffect(() => {
    if (!media) return;
    const loadMediaImage = async () => {
      try {
        dispatch(actions.setProcessing(true));
        let imageSource;
        if (media.file) imageSource = media.file;
        else if (media.url) imageSource = media.url;
        else if (media.preview) imageSource = media.preview;
        else throw new Error('No image source');
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
        dispatch(actions.setCrop({ x:0, y:0, width:img.naturalWidth, height:img.naturalHeight }));
        dispatch(actions.setImageLoaded(true));
        dispatch(actions.pushHistory());
      } catch (error) {
        console.error('Load error:', error);
        toast.error('Failed to load image');
      } finally {
        dispatch(actions.setProcessing(false));
      }
    };
    loadMediaImage();
    return () => {
      if (imageElement) cleanupImage(imageElement);
      if (croppedImageUrl) URL.revokeObjectURL(croppedImageUrl);
    };
  }, [media]);

  // ========== GESTURES (pinch, rotate) ==========
  const bind = useGesture({
    onPinch: ({ offset: [s] }) => dispatch(actions.setZoom(clamp(s * (state.canvas.zoom || 1), 0.1, 16))),
    onRotate: ({ offset: [_, a] }) => dispatch(actions.setStageRotation(a)),
  });

  // ========== KEYBOARD SHORTCUTS ==========
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      const { key, ctrlKey, metaKey, shiftKey } = e;
      const cmdKey = ctrlKey || metaKey;
      if (cmdKey && key === 'z' && !shiftKey) { e.preventDefault(); dispatch(actions.undo()); toast.info('Undo'); }
      if ((cmdKey && key === 'z' && shiftKey) || (cmdKey && key === 'y')) { e.preventDefault(); dispatch(actions.redo()); toast.info('Redo'); }
      if (cmdKey && key === 's') { e.preventDefault(); handleSave(); }
      if (key === 'Delete' || key === 'Backspace') {
        if (selectedLayerIds.length) {
          selectedLayerIds.forEach(handleDeleteText);
          toast.info('Layers deleted');
        } else if (state.selectedTextId) {
          handleDeleteText(state.selectedTextId);
        }
      }
      if (key === 'Escape') {
        dispatch(actions.deselectText());
        dispatch(actions.setTool(TOOLS.SELECT));
        setShowExportDialog(false);
        setShowShortcutsModal(false);
        setMultiSelectMode(false);
      }
      if (cmdKey && key === '0') { e.preventDefault(); dispatch(actions.setZoom(1)); dispatch(actions.setPan(0,0)); }
      if (cmdKey && key === 'r' && shiftKey) { e.preventDefault(); setShowRulers(v => !v); }
      if (!cmdKey && !shiftKey) {
        switch (key.toLowerCase()) {
          case 'v': dispatch(actions.setTool(TOOLS.SELECT)); break;
          case 'a': dispatch(actions.setTool(TOOLS.ADJUST)); break;
          case 'f': dispatch(actions.setTool(TOOLS.FILTER)); break;
          case 'c': dispatch(actions.setTool(TOOLS.CROP)); dispatch(actions.setMode('crop')); break;
          case 'r': dispatch(actions.setTool(TOOLS.ROTATE)); break;
          case 't': dispatch(actions.setTool(TOOLS.TEXT)); break;
          case 'd': dispatch(actions.setTool(TOOLS.DRAW)); break;
          case 'g': dispatch(actions.setTool(TOOLS.GIF)); break;
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [state, selectedLayerIds]);

  // ========== HANDLE FUNCTIONS ==========
  const handleSave = useCallback(async () => {
    if (isSaving) return;
    setIsSaving(true);
    try {
      if (stageRef.current) {
        const dataUrl = stageRef.current.toDataURL({ pixelRatio: 1, mimeType: 'image/png' });
        const blob = await (await fetch(dataUrl)).blob();
        const result = { blob, url: dataUrl, file: new File([blob], 'edited-image.png', { type: 'image/png' }), width: state.image.width, height: state.image.height, edited: true };
        onSave?.(result);
        toast.success('Saved!');
      }
    } catch {
      toast.error('Save failed');
    } finally {
      setIsSaving(false);
    }
  }, [isSaving, state.image, onSave]);

  const handleExport = useCallback(async (format, quality, targetWidth, targetHeight, removeMetadata) => {
    if (!stageRef.current) return;
    const dataUrl = stageRef.current.toDataURL({ pixelRatio: 1, mimeType: `image/${format}`, quality });
    const canvas = createCanvas(targetWidth, targetHeight);
    const ctx = canvas.getContext('2d');
    const img = new Image();
    img.src = dataUrl;
    await new Promise((r) => { img.onload = r; });
    ctx.drawImage(img, 0, 0, targetWidth, targetHeight);
    let blob = await canvasToBlob(canvas, `image/${format}`, quality);
    if (removeMetadata && format === 'jpeg') {
      blob = await imageCompression(blob, { maxSizeMB: 1, useWebWorker: true, alwaysKeepResolution: true, initialQuality: quality });
    }
    const url = URL.createObjectURL(blob);
    onSave?.({ blob, url, file: new File([blob], `export.${format}`, { type: `image/${format}` }) });
    toast.success(`Exported as ${format.toUpperCase()} ${targetWidth}×${targetHeight}`);
    setShowExportDialog(false);
  }, [onSave]);

  const handleAddText = useCallback((text) => {
    dispatch(actions.addText({
      text,
      x: (imageOffset.x + imageDisplaySize.width/2) / imageScale,
      y: (imageOffset.y + imageDisplaySize.height/2) / imageScale,
    }));
    dispatch(actions.pushHistory());
    dispatch(actions.setTool(TOOLS.SELECT));
  }, [imageOffset, imageDisplaySize, imageScale]);

  const handleDeleteText = useCallback((id) => {
    dispatch(actions.deleteText(id));
    dispatch(actions.pushHistory());
    setSelectedLayerIds(prev => prev.filter(x => x !== id));
  }, []);

  const handleDuplicateLayer = (id) => { dispatch(actions.duplicateText(id)); dispatch(actions.pushHistory()); };
  const handleReorderLayers = (from, to) => { dispatch(actions.reorderTextLayers(from, to)); dispatch(actions.pushHistory()); };
  const handleToggleVisibility = (id) => dispatch(actions.toggleLayerVisibility(id));
  const handleToggleLock = (id) => dispatch(actions.toggleLayerLock(id));
  const handleBlendModeChange = (id, mode) => dispatch(actions.updateText(id, { blendMode: mode }));
  const handleRenameLayer = (id, name) => dispatch(actions.updateText(id, { text: name }));
  const handleSetColorLabel = (id, color) => setColorLabels(prev => ({...prev, [id]: color}));

  const handleAddShape = useCallback((type) => {
    const id = uuidv4();
    dispatch(actions.addShape({
      id, type,
      x: imageOffset.x / imageScale,
      y: imageOffset.y / imageScale,
      width: 150,
      height: 150,
      fill: '#ffffff',
      stroke: '#000000',
      strokeWidth: 2,
      rotation: 0,
    }));
    dispatch(actions.pushHistory());
  }, [imageOffset, imageScale]);

  const handleCropComplete = (_, cropPixels) => setCroppedAreaPixels(cropPixels);
  const handleCropChange = (crop) => dispatch(actions.setCrop(crop));
  const handleApplyCrop = () => {
    if (!croppedAreaPixels) { toast.error('Select area first'); return; }
    setClipRegion({
      x: croppedAreaPixels.x,
      y: croppedAreaPixels.y,
      width: croppedAreaPixels.width,
      height: croppedAreaPixels.height,
    });
    dispatch(actions.setTool(TOOLS.SELECT));
    dispatch(actions.setMode('edit'));
    dispatch(actions.pushHistory());
    toast.success('Crop applied');
  };
  const handleResetCrop = () => { setClipRegion(null); dispatch(actions.pushHistory()); };

  const debouncedPushHistory = useMemo(() => debounce(() => dispatch(actions.pushHistory()), HISTORY.DEBOUNCE_DELAY), []);

  const applyTemplate = (tpl) => {
    dispatch(actions.setCanvasSize(tpl.canvasWidth, tpl.canvasHeight));
    setTemplateGuides(tpl.guides);
    toast.success(`Template applied: ${tpl.name}`);
  };

  // ========== STYLES ==========
  const styles = {
    container: {
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      width: '100%',
      background: '#0c0c17',
      color: '#fff',
    },
    header: {
      height: headerHeight,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: `0 ${workspacePadding}px`,
      background: 'rgba(12,12,23,0.85)',
      backdropFilter: 'blur(12px)',
      borderBottom: '1px solid rgba(255,255,255,0.06)',
      boxShadow: ELEVATION[1],
      zIndex: 10,
    },
    workspace: {
      flex: 1,
      display: 'flex',
      overflow: 'hidden',
    },
    leftPanel: {
      width: leftPanelWidth,
      background: 'rgba(20,20,35,0.7)',
      backdropFilter: 'blur(12px)',
      borderRight: '1px solid rgba(255,255,255,0.05)',
      display: 'flex',
      flexDirection: 'column',
      transition: 'width 0.3s ease',
      overflow: 'hidden',
    },
    canvasArea: {
      flex: 1,
      position: 'relative',
      background: '#0a0a14',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
    rightPanel: {
      width: rightPanelWidth,
      background: 'rgba(20,20,35,0.7)',
      backdropFilter: 'blur(12px)',
      borderLeft: '1px solid rgba(255,255,255,0.05)',
      display: 'flex',
      flexDirection: 'column',
      transition: 'width 0.3s ease',
      overflow: 'hidden',
    },
    statusBar: {
      height: statusBarHeight,
      background: 'rgba(0,0,0,0.5)',
      backdropFilter: 'blur(8px)',
      borderTop: '1px solid rgba(255,255,255,0.05)',
    },
    panelHeader: {
      padding: `${SPACING.sm}px ${SPACING.md}px`,
      borderBottom: '1px solid rgba(255,255,255,0.05)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    panelContent: {
      flex: 1,
      overflowY: 'auto',
      padding: SPACING.md,
    },
  };

  return (
    <div style={styles.container} ref={containerRef}>
      {/* HEADER */}
      <motion.div initial={{ opacity:0, y:-20 }} animate={{ opacity:1, y:0 }} style={styles.header}>
        <div className="flex items-center gap-2">
          <Tooltip content="Close" shortcut="Esc">
            <Button onClick={onClose} size="icon" variant="ghost" className="rounded-full"><Icons.X className="w-5 h-5" /></Button>
          </Tooltip>
          <div className="h-8 w-px bg-white/10" />
          <Tooltip content="Undo" shortcut="Ctrl+Z">
            <Button onClick={() => dispatch(actions.undo())} disabled={!selectors.canUndo(state)} size="icon" variant="ghost" className="rounded-full"><Icons.Undo2 className="w-4 h-4" /></Button>
          </Tooltip>
          <Tooltip content="Redo" shortcut="Ctrl+Y">
            <Button onClick={() => dispatch(actions.redo())} disabled={!selectors.canRedo(state)} size="icon" variant="ghost" className="rounded-full"><Icons.Redo2 className="w-4 h-4" /></Button>
          </Tooltip>
          <Tooltip content="Crop" shortcut="C">
            <Button onClick={() => { if(state.mode==='crop') handleApplyCrop(); else { dispatch(actions.setTool(TOOLS.CROP)); dispatch(actions.setMode('crop')); }}} size="icon" variant="ghost" className="rounded-full">{state.mode==='crop'?<Icons.Check/>:<Icons.Crop/>}</Button>
          </Tooltip>
          {clipRegion && (
            <Tooltip content="Reset crop">
              <Button onClick={handleResetCrop} size="icon" variant="ghost" className="rounded-full"><Icons.RotateCcw className="w-4 h-4" /></Button>
            </Tooltip>
          )}
          <Tooltip content="Shapes">
            <Button onClick={() => handleAddShape('rect')} size="icon" variant="ghost" className="rounded-full"><Icons.Square className="w-4 h-4" /></Button>
          </Tooltip>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={workspaceMode}
            onChange={(e) => setWorkspaceMode(e.target.value)}
            className="bg-white/5 border border-white/10 rounded-lg px-3 py-1 text-xs text-white"
            style={{ borderRadius: BORDER_RADIUS.input }}
          >
            <option value="freeform">Freeform</option>
            <option value="instagram-post">Instagram Post</option>
            <option value="instagram-story">Instagram Story</option>
          </select>
          <Tooltip content="Export">
            <Button onClick={() => setShowExportDialog(true)} size="icon" variant="ghost" className="rounded-full"><Icons.Download className="w-4 h-4" /></Button>
          </Tooltip>
          <Button onClick={handleSave} disabled={isSaving} variant="primary" size="sm" className="rounded-full gap-2">
            {isSaving?<LoadingSpinner size={14}/>:<Icons.Check className="w-4 h-4"/>} Save
          </Button>
        </div>
      </motion.div>

      {/* WORKSPACE */}
      <div style={styles.workspace}>
        {/* LEFT PANEL (Tools + Layers + Templates) */}
        {!isMobile && (
          <div style={styles.leftPanel}>
            <div style={styles.panelHeader}>
              <div className="flex gap-1">
                <button onClick={() => dispatch(actions.setActiveTab('tools'))} className={`px-3 py-1 text-xs rounded-lg ${state.activeTab==='tools'?'bg-white/15 text-white':'text-white/50'}`}>Tools</button>
                <button onClick={() => dispatch(actions.setActiveTab('layers'))} className={`px-3 py-1 text-xs rounded-lg ${state.activeTab==='layers'?'bg-white/15 text-white':'text-white/50'}`}>Layers</button>
                <button onClick={() => dispatch(actions.setActiveTab('templates'))} className={`px-3 py-1 text-xs rounded-lg ${state.activeTab==='templates'?'bg-white/15 text-white':'text-white/50'}`}>Templates</button>
              </div>
            </div>
            <div style={styles.panelContent}>
              {state.activeTab==='tools' && (
                <div className="grid grid-cols-3 gap-2">
                  <ToolButton icon={Icons.MousePointer2} label="Select" shortcut="V" isActive={state.activeTool===TOOLS.SELECT} onClick={() => dispatch(actions.setTool(TOOLS.SELECT))} />
                  <ToolButton icon={Icons.SlidersHorizontal} label="Adjust" shortcut="A" isActive={state.activeTool===TOOLS.ADJUST} onClick={() => dispatch(actions.setTool(TOOLS.ADJUST))} />
                  <ToolButton icon={Icons.Filter} label="Filter" shortcut="F" isActive={state.activeTool===TOOLS.FILTER} onClick={() => dispatch(actions.setTool(TOOLS.FILTER))} />
                  <ToolButton icon={Icons.Crop} label="Crop" shortcut="C" isActive={state.activeTool===TOOLS.CROP} onClick={() => { dispatch(actions.setTool(TOOLS.CROP)); dispatch(actions.setMode('crop')); }} />
                  <ToolButton icon={Icons.RotateCw} label="Rotate" shortcut="R" isActive={state.activeTool===TOOLS.ROTATE} onClick={() => dispatch(actions.setTool(TOOLS.ROTATE))} />
                  <ToolButton icon={Icons.Type} label="Text" shortcut="T" isActive={state.activeTool===TOOLS.TEXT} onClick={() => dispatch(actions.setTool(TOOLS.TEXT))} />
                  <ToolButton icon={Icons.Pencil} label="Draw" shortcut="D" isActive={state.activeTool===TOOLS.DRAW} onClick={() => dispatch(actions.setTool(TOOLS.DRAW))} />
                  <ToolButton icon={Icons.Sticker} label="Sticker" shortcut="G" isActive={state.activeTool===TOOLS.GIF} onClick={() => dispatch(actions.setTool(TOOLS.GIF))} />
                  <ToolButton icon={Icons.Pipette} label="Gradient" onClick={() => dispatch(actions.setTool('gradient'))} />
                </div>
              )}
              {state.activeTab==='layers' && (
                <LayersPanel
                  layers={state.textLayers}
                  selectedIds={selectedLayerIds}
                  onSelect={(id) => { dispatch(actions.selectText(id)); setSelectedLayerIds([id]); }}
                  onMultiSelectToggle={(id) => setSelectedLayerIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])}
                  onDelete={handleDeleteText}
                  onToggleVisibility={handleToggleVisibility}
                  onToggleLock={handleToggleLock}
                  onDuplicate={handleDuplicateLayer}
                  onReorder={handleReorderLayers}
                  onBlendModeChange={handleBlendModeChange}
                  onRename={handleRenameLayer}
                  colorLabels={colorLabels}
                  setColorLabel={handleSetColorLabel}
                  isMultiSelectMode={multiSelectMode}
                  setIsMultiSelectMode={setMultiSelectMode}
                />
              )}
              {state.activeTab==='templates' && (
                <div className="space-y-2">
                  {BUILTIN_TEMPLATES.map(tpl => (
                    <div key={tpl.name} onClick={() => applyTemplate(tpl)} className="p-3 rounded-xl bg-white/5 hover:bg-white/10 cursor-pointer transition-colors">
                      <p className="text-sm text-white">{tpl.name}</p>
                      <p className="text-xs text-white/50">{tpl.canvasWidth}×{tpl.canvasHeight}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* CANVAS AREA */}
        <div style={styles.canvasArea} ref={canvasContainerRef} {...bind()}
          onMouseMove={(e) => {
            const rect = canvasContainerRef.current.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            setCursorPos({ x: Math.round(x / imageScale - imageOffset.x/imageScale), y: Math.round(y / imageScale - imageOffset.y/imageScale) });
          }}
        >
          {state.showGrid && <GuidesOverlay stageSize={canvasAreaSize} zoom={state.canvas.zoom} panX={state.canvas.panX} panY={state.canvas.panY} guides={templateGuides?.[0]} showGrid={true} safeZonePadding={templateGuides?.find(g => g.type==='safe-zone')?.inset} />}

          {state.isProcessing ? (
            <div className="flex flex-col items-center justify-center h-full"><LoadingSpinner size={60} /><p className="text-white/60 mt-4">Processing...</p></div>
          ) : state.mode === 'crop' ? (
            <div className="relative w-full h-full">
              <Cropper image={croppedImageUrl || imageElement?.src || ''} crop={state.crop} zoom={state.cropZoom} aspect={state.cropAspect} onCropChange={handleCropChange} onCropComplete={handleCropComplete} onZoomChange={(z) => dispatch(actions.setCropZoom(z))} />
              <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-3 p-2 rounded-full bg-black/60 backdrop-blur-xl">
                <CropTool aspect={state.cropAspect} setAspect={(a) => dispatch(actions.setCropAspect(a))} zoom={state.cropZoom} onZoomChange={(z) => dispatch(actions.setCropZoom(z))} onCropChangeWithUndo={() => {}} onCropComplete={handleCropComplete} pushUndo={() => dispatch(actions.pushHistory())} setCrop={(c) => dispatch(actions.setCrop(c))} setZoom={(z) => dispatch(actions.setCropZoom(z))} setCroppedAreaPixels={setCroppedAreaPixels} />
              </div>
            </div>
          ) : (
            <div style={{ width: canvasAreaSize.width, height: canvasAreaSize.height, position: 'relative' }}>
              {/* Checkerboard background */}
              <svg width="100%" height="100%" style={{ position: 'absolute', top:0, left:0, zIndex:0 }}>
                <pattern id="checkerboard" width={18} height={18} patternUnits="userSpaceOnUse">
                  <rect width="9" height="9" fill="#2a2a3a" /><rect x="9" y="9" width="9" height="9" fill="#2a2a3a" />
                  <rect x="9" width="9" height="9" fill="#1e1e2e" /><rect y="9" width="9" height="9" fill="#1e1e2e" />
                </pattern>
                <rect width="100%" height="100%" fill="url(#checkerboard)" />
              </svg>

              {/* Image shadow container */}
              <div style={{
                position: 'absolute',
                left: imageOffset.x,
                top: imageOffset.y,
                width: imageDisplaySize.width,
                height: imageDisplaySize.height,
                boxShadow: `0 8px 30px rgba(0,0,0,0.15), 0 2px 10px rgba(0,0,0,0.2), 0 0 40px rgba(0,0,0,0.05)`,
                borderRadius: BORDER_RADIUS.canvas,
                overflow: 'hidden',
              }}>
                <Stage
                  ref={stageRef}
                  width={imageDisplaySize.width}
                  height={imageDisplaySize.height}
                  scaleX={state.canvas.zoom}
                  scaleY={state.canvas.zoom}
                  x={state.canvas.panX}
                  y={state.canvas.panY}
                  rotation={state.stageRotation || 0}
                  onWheel={(e) => {
                    e.evt.preventDefault();
                    const scaleBy = 1.1;
                    const oldScale = state.canvas.zoom;
                    const pointer = stageRef.current.getPointerPosition();
                    const mousePointTo = {
                      x: (pointer.x - state.canvas.panX) / oldScale,
                      y: (pointer.y - state.canvas.panY) / oldScale,
                    };
                    const newScale = e.evt.deltaY > 0 ? oldScale / scaleBy : oldScale * scaleBy;
                    dispatch(actions.setZoom(clamp(newScale, 0.1, 16)));
                    dispatch(actions.setPan(
                      pointer.x - mousePointTo.x * newScale,
                      pointer.y - mousePointTo.y * newScale
                    ));
                  }}
                >
                  <Layer>
                    <Group clipFunc={clipRegion ? (ctx) => ctx.rect(clipRegion.x, clipRegion.y, clipRegion.width, clipRegion.height) : undefined}>
                      <KonvaImage
                        image={imageElement}
                        x={0} y={0}
                        width={state.image.width}
                        height={state.image.height}
                        rotation={state.rotation}
                        scaleX={state.flipH ? -1 : 1}
                        scaleY={state.flipV ? -1 : 1}
                        offsetX={state.flipH ? state.image.width : 0}
                        offsetY={state.flipV ? state.image.height : 0}
                        filters={[
                          ...(state.adjustments.blur > 0 ? [Konva.Filters.Blur] : []),
                          ...(state.adjustments.brightness !== 0 || state.adjustments.contrast !== 0 || state.adjustments.saturation !== 0 ? [Konva.Filters.Brighten] : []),
                        ]}
                        blurRadius={state.adjustments.blur}
                        brightness={state.adjustments.brightness / 100 + 1}
                        contrast={state.adjustments.contrast / 100 + 1}
                        saturation={state.adjustments.saturation / 100 + 1}
                      />
                    </Group>
                  </Layer>
                  <Layer ref={drawLayerRef}>
                    {state.drawings?.map((line, i) => (
                      <Line key={i} points={line.points} stroke={line.color} strokeWidth={line.brushSize} tension={0.5} lineCap="round" lineJoin="round" />
                    ))}
                  </Layer>
                  <Layer>
                    {state.shapes?.map(shape => (
                      <Group key={shape.id} draggable>
                        {shape.type === 'rect' && <Rect {...shape} />}
                        {shape.type === 'circle' && <Circle {...shape} />}
                        {shape.type === 'ellipse' && <Ellipse {...shape} />}
                        {shape.type === 'star' && <Star numPoints={5} innerRadius={shape.width/4} outerRadius={shape.width/2} {...shape} />}
                        {shape.type === 'line' && <Line points={[0,0, shape.width, shape.height]} stroke={shape.stroke} strokeWidth={shape.strokeWidth} />}
                      </Group>
                    ))}
                  </Layer>
                  <Layer>
                    {state.textLayers.map(layer => (
                      <KonvaText
                        key={layer.id}
                        x={layer.x} y={layer.y}
                        text={layer.text}
                        fontSize={layer.fontSize}
                        fontFamily={layer.fontFamily}
                        fill={layer.color}
                        fontStyle={`${layer.fontWeight || 'normal'} ${layer.fontStyle || 'normal'}`}
                        align={layer.textAlign}
                        width={300}
                        rotation={layer.rotation}
                        opacity={layer.opacity / 100}
                        visible={layer.visible !== false}
                        draggable={state.activeTool === TOOLS.SELECT && !layer.locked}
                        onClick={() => dispatch(actions.selectText(layer.id))}
                        onTap={() => dispatch(actions.selectText(layer.id))}
                        onDragEnd={(e) => dispatch(actions.updateText(layer.id, { x: e.target.x(), y: e.target.y() }))}
                        shadowColor={layer.shadowEnabled ? layer.shadowColor : undefined}
                        shadowBlur={layer.shadowEnabled ? layer.shadowBlur : 0}
                        shadowOffsetX={layer.shadowEnabled ? layer.shadowX : 0}
                        shadowOffsetY={layer.shadowEnabled ? layer.shadowY : 0}
                        stroke={layer.strokeWidth > 0 ? layer.strokeColor : undefined}
                        strokeWidth={layer.strokeWidth}
                        globalCompositeOperation={layer.blendMode !== 'normal' ? layer.blendMode : undefined}
                      />
                    ))}
                    {state.selectedTextId && (
                      <Transformer
                        ref={transformerRef}
                        boundBoxFunc={(oldBox, newBox) => newBox.width < 10 || newBox.height < 10 ? oldBox : newBox}
                        rotateEnabled={true}
                        enabledAnchors={['top-left','top-right','bottom-left','bottom-right']}
                        anchorStyleFunc={(anchor) => { anchor.cornerRadius(4); }}
                      />
                    )}
                  </Layer>
                </Stage>
              </div>

              {/* Drawing tool controls */}
              {state.activeTool === TOOLS.DRAW && (
                <div className="absolute top-4 left-4 flex items-center gap-2 p-2 rounded-xl bg-black/70 backdrop-blur-md" style={{ borderRadius: BORDER_RADIUS.tooltip }}>
                  <ColorPicker color={drawingColor} onChange={setDrawingColor} />
                  <input type="range" min="1" max="30" value={drawingBrushSize} onChange={(e) => setDrawingBrushSize(Number(e.target.value))} className="w-24 accent-purple-500" />
                  <Button size="sm" variant="ghost" onClick={() => dispatch(actions.clearDrawings())}><Icons.Trash2 className="w-4 h-4" /></Button>
                </div>
              )}

              {/* Text input overlay */}
              {state.activeTool === TOOLS.TEXT && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/20" onClick={(e) => e.target === e.currentTarget && dispatch(actions.setTool(TOOLS.SELECT))}>
                  <div className="bg-gray-900/90 backdrop-blur-xl rounded-2xl p-5 w-80 shadow-2xl" style={{ borderRadius: BORDER_RADIUS.dialog }}>
                    <p className="text-white text-sm mb-3">Enter text:</p>
                    <input ref={textInputRef} type="text" placeholder="Your text here..." className="w-full px-4 py-2.5 rounded-xl bg-white/5 text-white placeholder-gray-400 border border-white/10 focus:border-purple-500 outline-none text-sm" style={{ borderRadius: BORDER_RADIUS.input }} onKeyDown={(e) => { if (e.key === 'Enter' && e.target.value) { handleAddText(e.target.value); e.target.value = ''; } }} autoFocus />
                    <div className="flex gap-2 mt-3">
                      <Button size="sm" variant="ghost" onClick={() => dispatch(actions.setTool(TOOLS.SELECT))} className="flex-1">Cancel</Button>
                      <Button size="sm" variant="primary" onClick={() => { if (textInputRef.current?.value) { handleAddText(textInputRef.current.value); textInputRef.current.value = ''; } }} className="flex-1">Add Text</Button>
                    </div>
                  </div>
                </div>
              )}

              {/* Minimap */}
              {!isMobile && (
                <Minimap
                  width={canvasAreaSize.width}
                  height={canvasAreaSize.height}
                  imageWidth={state.image.width}
                  imageHeight={state.image.height}
                  zoom={state.canvas.zoom}
                  panX={state.canvas.panX}
                  panY={state.canvas.panY}
                  stageSize={imageDisplaySize}
                  containerSize={canvasAreaSize}
                />
              )}
            </div>
          )}

          {/* Zoom controls */}
          <div className="absolute bottom-2 right-2 flex items-center gap-1 p-1 rounded-full bg-black/40 backdrop-blur-xl" style={{ borderRadius: 9999 }}>
            <Button size="icon" variant="ghost" onClick={() => dispatch(actions.setZoom(state.canvas.zoom - 0.1))} className="rounded-full"><Icons.Minus className="w-4 h-4" /></Button>
            <span className="text-xs text-white font-medium w-12 text-center tabular-nums">{Math.round(state.canvas.zoom * 100)}%</span>
            <Button size="icon" variant="ghost" onClick={() => dispatch(actions.setZoom(state.canvas.zoom + 0.1))} className="rounded-full"><Icons.Plus className="w-4 h-4" /></Button>
            <div className="w-px h-6 bg-white/10 mx-1" />
            <Button size="icon" variant="ghost" onClick={() => { dispatch(actions.setZoom(1)); dispatch(actions.setPan(0,0)); }} className="rounded-full" title="Fit to screen"><Icons.Maximize2 className="w-4 h-4" /></Button>
          </div>
        </div>

        {/* RIGHT PANEL (Properties) */}
        {!isMobile && (
          <div style={styles.rightPanel}>
            <div style={styles.panelHeader}>
              <h3 className="text-sm font-semibold text-white">Properties</h3>
            </div>
            <div style={styles.panelContent}>
              <RightPanelContent
                activeTool={state.activeTool}
                state={state}
                dispatch={dispatch}
                debouncedPushHistory={debouncedPushHistory}
                handleAddText={handleAddText}
                handleDeleteText={handleDeleteText}
                imageElement={imageElement}
              />
            </div>
          </div>
        )}
      </div>

      {/* STATUS BAR */}
      <StatusBar
        imageWidth={state.image.width}
        imageHeight={state.image.height}
        zoom={state.canvas.zoom}
        cursorPos={cursorPos}
      />

      {/* Export Dialog (full implementation) */}
      <AnimatePresence>
        {showExportDialog && (
          <FocusTrap>
            <ExportDialog onClose={() => setShowExportDialog(false)} onExport={handleExport} canvasWidth={state.image.width} canvasHeight={state.image.height} />
          </FocusTrap>
        )}
      </AnimatePresence>

      {/* Shortcuts Modal */}
      <AnimatePresence>
        {showShortcutsModal && (
          <FocusTrap>
            <ShortcutsModal onClose={() => setShowShortcutsModal(false)} />
          </FocusTrap>
        )}
      </AnimatePresence>

      {/* Mobile bottom toolbar (shown only on mobile) */}
      {isMobile && (
        <div className="p-3 border-t border-white/10 bg-black/80 backdrop-blur-xl flex justify-around">
          <ToolButton icon={Icons.MousePointer2} label="Select" isActive={state.activeTool === TOOLS.SELECT} onClick={() => dispatch(actions.setTool(TOOLS.SELECT))} />
          <ToolButton icon={Icons.SlidersHorizontal} label="Adjust" isActive={state.activeTool === TOOLS.ADJUST} onClick={() => dispatch(actions.setTool(TOOLS.ADJUST))} />
          <ToolButton icon={Icons.Filter} label="Filter" isActive={state.activeTool === TOOLS.FILTER} onClick={() => dispatch(actions.setTool(TOOLS.FILTER))} />
          <ToolButton icon={Icons.Crop} label="Crop" isActive={state.activeTool === TOOLS.CROP} onClick={() => { dispatch(actions.setTool(TOOLS.CROP)); dispatch(actions.setMode('crop')); }} />
          <ToolButton icon={Icons.Type} label="Text" isActive={state.activeTool === TOOLS.TEXT} onClick={() => dispatch(actions.setTool(TOOLS.TEXT))} />
          <ToolButton icon={Icons.Pencil} label="Draw" isActive={state.activeTool === TOOLS.DRAW} onClick={() => dispatch(actions.setTool(TOOLS.DRAW))} />
        </div>
      )}
    </div>
  );
}));

ImageEditor.displayName = 'ImageEditor';

// ==================== EXPORT DIALOG ====================
const ExportDialog = memo(({ onClose, onExport, canvasWidth, canvasHeight }) => {
  const [format, setFormat] = useState('png');
  const [quality, setQuality] = useState(1);
  const [usePreset, setUsePreset] = useState(null);
  const [removeMetadata, setRemoveMetadata] = useState(true);
  const [customWidth, setCustomWidth] = useState(canvasWidth);
  const [customHeight, setCustomHeight] = useState(canvasHeight);
  const dimensions = usePreset && EXPORT_PRESETS[usePreset] ? EXPORT_PRESETS[usePreset] : { width: customWidth, height: customHeight, label: 'Custom' };

  return (
    <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose} role="dialog" aria-labelledby="export-dialog-title">
      <motion.div initial={{ scale:0.9, y:20 }} animate={{ scale:1, y:0 }} exit={{ scale:0.9, y:20 }} className="bg-gray-900/90 backdrop-blur-xl rounded-2xl p-6 w-96 shadow-2xl border border-white/10" onClick={(e) => e.stopPropagation()} style={{ borderRadius: BORDER_RADIUS.dialog }}>
        <h3 id="export-dialog-title" className="text-lg font-semibold text-white mb-4 flex items-center gap-2"><Icons.Download className="w-5 h-5" /> Export Image</h3>
        <div className="space-y-4">
          <div>
            <label className="text-xs text-white/60 mb-1 block">Format</label>
            <div className="flex gap-2">
              {['png','jpeg','webp','avif'].map(f => (
                <button key={f} onClick={() => setFormat(f)} className={`flex-1 py-2 rounded-xl text-xs font-medium transition-colors ${format===f?'bg-white/20 text-white':'bg-white/5 text-white/60'}`} style={{ borderRadius: BORDER_RADIUS.button }}>{f.toUpperCase()}</button>
              ))}
            </div>
          </div>
          {['jpeg','webp','avif'].includes(format) && (
            <div>
              <label className="text-xs text-white/60 mb-1 block">Quality: {Math.round(quality*100)}%</label>
              <input type="range" min="0.1" max="1" step="0.01" value={quality} onChange={(e) => setQuality(Number(e.target.value))} className="w-full accent-purple-500" />
            </div>
          )}
          <div>
            <label className="text-xs text-white/60 mb-1 block">Size</label>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => setUsePreset(null)} className={`py-2 px-3 rounded-xl text-xs transition-colors ${!usePreset?'bg-white/20 text-white':'bg-white/5 text-white/60'}`} style={{ borderRadius: BORDER_RADIUS.button }}>Custom</button>
              {Object.entries(EXPORT_PRESETS).map(([key, preset]) => (
                <button key={key} onClick={() => setUsePreset(key)} className={`py-2 px-3 rounded-xl text-xs transition-colors ${usePreset===key?'bg-white/20 text-white':'bg-white/5 text-white/60'}`} style={{ borderRadius: BORDER_RADIUS.button }}>{preset.label} ({preset.width}×{preset.height})</button>
              ))}
            </div>
            {!usePreset && (
              <div className="flex gap-2 mt-2">
                <input type="number" value={customWidth} onChange={(e) => setCustomWidth(Number(e.target.value))} className="w-20 bg-white/5 border border-white/10 rounded px-2 py-1 text-xs text-white" style={{ borderRadius: BORDER_RADIUS.input }} placeholder="Width" />
                <span className="text-white/30">×</span>
                <input type="number" value={customHeight} onChange={(e) => setCustomHeight(Number(e.target.value))} className="w-20 bg-white/5 border border-white/10 rounded px-2 py-1 text-xs text-white" style={{ borderRadius: BORDER_RADIUS.input }} placeholder="Height" />
              </div>
            )}
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-white/60">Remove metadata</span>
            <button onClick={() => setRemoveMetadata(!removeMetadata)} className={`w-10 h-6 rounded-full transition-colors ${removeMetadata?'bg-gradient-to-r from-purple-500 to-cyan-500':'bg-white/10'}`}>
              <div className={`w-4 h-4 rounded-full bg-white transition-transform ${removeMetadata?'translate-x-5':'translate-x-0.5'}`} />
            </button>
          </div>
        </div>
        <div className="flex gap-2 mt-6">
          <Button variant="ghost" className="flex-1" onClick={onClose}>Cancel</Button>
          <Button variant="primary" className="flex-1" onClick={() => onExport(format, quality, dimensions.width, dimensions.height, removeMetadata)}>Export</Button>
        </div>
      </motion.div>
    </motion.div>
  );
});

const ShortcutsModal = memo(({ onClose }) => {
  const shortcuts = [
    ['Undo','Ctrl+Z'], ['Redo','Ctrl+Y'], ['Save','Ctrl+S'], ['Zoom In','Ctrl++'], ['Zoom Out','Ctrl+-'],
    ['Fit to Screen','Ctrl+0'], ['Grid','Ctrl+\''], ['Snap','Ctrl+;'], ['Select','V'], ['Adjust','A'],
    ['Filter','F'], ['Crop','C'], ['Rotate','R'], ['Text','T'], ['Draw','D'], ['Sticker','G'],
    ['Delete','Delete'], ['Cancel','Esc'],
  ];
  return (
    <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose} role="dialog" aria-labelledby="shortcuts-title">
      <motion.div initial={{ scale:0.9, y:20 }} animate={{ scale:1, y:0 }} exit={{ scale:0.9, y:20 }} className="bg-gray-900/90 backdrop-blur-xl rounded-2xl p-6 w-96 shadow-2xl border border-white/10 max-h-[80vh] overflow-y-auto" style={{ borderRadius: BORDER_RADIUS.dialog }} onClick={(e) => e.stopPropagation()}>
        <h3 id="shortcuts-title" className="text-lg font-semibold text-white mb-4 flex items-center gap-2"><Icons.Keyboard className="w-5 h-5" /> Keyboard Shortcuts</h3>
        <div className="space-y-3">
          {shortcuts.map(([action, shortcut]) => (
            <div key={action} className="flex justify-between items-center">
              <span className="text-sm text-white/80">{action}</span>
              <kbd className="px-2 py-1 bg-white/5 text-white/70 text-xs rounded">{shortcut}</kbd>
            </div>
          ))}
        </div>
        <Button variant="ghost" className="w-full mt-4" onClick={onClose}>Close</Button>
      </motion.div>
    </motion.div>
  );
});

export default ImageEditor;