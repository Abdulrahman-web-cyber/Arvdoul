// src/screens/CreatePost/editorReducer.js - ARVDOUL Image Editor State Management
// Immutable state management with history support

import { produce } from 'immer';
import { ADJUSTMENTS, HISTORY, LAYER_TYPES, generateId } from './editorConstants';

// ==================== DEFAULT STATE ====================

export const DEFAULT_ADJUSTMENTS = ADJUSTMENTS.reduce((acc, adj) => {
  acc[adj.key] = adj.default;
  return acc;
}, {});

export const DEFAULT_STATE = {
  // Tool state
  activeTool: 'select',
  activeSubTool: null,
  
  // Canvas state
  canvas: {
    width: 0,
    height: 0,
    zoom: 1,
    panX: 0,
    panY: 0,
    rotation: 0,
    flipH: false,
    flipV: false,
  },
  
  // Image state
  image: {
    src: null,
    file: null,
    originalWidth: 0,
    originalHeight: 0,
    width: 0,
    height: 0,
    loaded: false,
  },
  
  // Adjustments
  adjustments: { ...DEFAULT_ADJUSTMENTS },
  
  // Filter
  filter: 'none',
  filterIntensity: 100,
  
  // Crop state
  crop: {
    x: 0,
    y: 0,
    width: 0,
    height: 0,
  },
  cropAspect: undefined,
  cropZoom: 1,
  
  // Rotation state
  rotation: 0,
  flipH: false,
  flipV: false,
  
  // Text layers
  textLayers: [],
  selectedTextId: null,
  
  // Layers
  layers: [],
  selectedLayerId: null,
  layerVisibility: {},
  layerLocked: {},
  
  // Selection
  selection: {
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    rotation: 0,
  },
  isSelected: false,
  
  // View options
  showGrid: false,
  showSnapLines: false,
  snapEnabled: true,
  
  // UI state
  leftPanelOpen: true,
  rightPanelOpen: true,
  activeTab: 'tools', // tools | layers | ai
  bottomSheetOpen: false,
  bottomSheetTool: null,
  
  // History
  history: [],
  historyIndex: -1,
  isProcessing: false,
  
  // Editor mode
  mode: 'edit', // edit | crop | text
};

// ==================== ACTION TYPES ====================

export const ACTIONS = {
  // Tool actions
  SET_TOOL: 'SET_TOOL',
  SET_SUB_TOOL: 'SET_SUB_TOOL',
  SET_MODE: 'SET_MODE',
  
  // Canvas actions
  SET_CANVAS_SIZE: 'SET_CANVAS_SIZE',
  SET_ZOOM: 'SET_ZOOM',
  SET_PAN: 'SET_PAN',
  SET_CANVAS_ROTATION: 'SET_CANVAS_ROTATION',
  
  // Image actions
  SET_IMAGE: 'SET_IMAGE',
  SET_IMAGE_LOADED: 'SET_IMAGE_LOADED',
  
  // Adjustment actions
  SET_ADJUSTMENT: 'SET_ADJUSTMENT',
  SET_ADJUSTMENTS: 'SET_ADJUSTMENTS',
  RESET_ADJUSTMENTS: 'RESET_ADJUSTMENTS',
  
  // Filter actions
  SET_FILTER: 'SET_FILTER',
  SET_FILTER_INTENSITY: 'SET_FILTER_INTENSITY',
  
  // Crop actions
  SET_CROP: 'SET_CROP',
  SET_CROP_ASPECT: 'SET_CROP_ASPECT',
  SET_CROP_ZOOM: 'SET_CROP_ZOOM',
  APPLY_CROP: 'APPLY_CROP',
  RESET_CROP: 'RESET_CROP',
  
  // Rotation actions
  ROTATE_LEFT: 'ROTATE_LEFT',
  ROTATE_RIGHT: 'ROTATE_RIGHT',
  FLIP_H: 'FLIP_H',
  FLIP_V: 'FLIP_V',
  SET_FREE_ROTATION: 'SET_FREE_ROTATION',
  
  // Text layer actions
  ADD_TEXT: 'ADD_TEXT',
  UPDATE_TEXT: 'UPDATE_TEXT',
  DELETE_TEXT: 'DELETE_TEXT',
  SELECT_TEXT: 'SELECT_TEXT',
  DESELECT_TEXT: 'DESELECT_TEXT',
  
  // Layer actions
  ADD_LAYER: 'ADD_LAYER',
  UPDATE_LAYER: 'UPDATE_LAYER',
  DELETE_LAYER: 'DELETE_LAYER',
  SELECT_LAYER: 'SELECT_LAYER',
  REORDER_LAYERS: 'REORDER_LAYERS',
  TOGGLE_LAYER_VISIBILITY: 'TOGGLE_LAYER_VISIBILITY',
  TOGGLE_LAYER_LOCK: 'TOGGLE_LAYER_LOCK',
  GROUP_LAYERS: 'GROUP_LAYERS',
  UNGROUP_LAYERS: 'UNGROUP_LAYERS',
  
  // Selection actions
  SET_SELECTION: 'SET_SELECTION',
  CLEAR_SELECTION: 'CLEAR_SELECTION',
  UPDATE_SELECTION: 'UPDATE_SELECTION',
  
  // View actions
  TOGGLE_GRID: 'TOGGLE_GRID',
  TOGGLE_SNAP: 'TOGGLE_SNAP',
  TOGGLE_SNAP_LINES: 'TOGGLE_SNAP_LINES',
  
  // UI actions
  TOGGLE_LEFT_PANEL: 'TOGGLE_LEFT_PANEL',
  TOGGLE_RIGHT_PANEL: 'TOGGLE_RIGHT_PANEL',
  SET_ACTIVE_TAB: 'SET_ACTIVE_TAB',
  SET_BOTTOM_SHEET: 'SET_BOTTOM_SHEET',
  
  // History actions
  PUSH_HISTORY: 'PUSH_HISTORY',
  UNDO: 'UNDO',
  REDO: 'REDO',
  CLEAR_HISTORY: 'CLEAR_HISTORY',
  
  // Processing actions
  SET_PROCESSING: 'SET_PROCESSING',
  
  // State actions
  LOAD_STATE: 'LOAD_STATE',
  RESET_STATE: 'RESET_STATE',
};

// ==================== REDUCER ====================

export function editorReducer(state, action) {
  return produce(state, (draft) => {
    switch (action.type) {
      // ========== Tool Actions ==========
      case ACTIONS.SET_TOOL:
        draft.activeTool = action.payload;
        draft.activeSubTool = null;
        break;
        
      case ACTIONS.SET_SUB_TOOL:
        draft.activeSubTool = action.payload;
        break;
        
      case ACTIONS.SET_MODE:
        draft.mode = action.payload;
        break;
        
      // ========== Canvas Actions ==========
      case ACTIONS.SET_CANVAS_SIZE:
        draft.canvas.width = action.payload.width;
        draft.canvas.height = action.payload.height;
        break;
        
      case ACTIONS.SET_ZOOM:
        draft.canvas.zoom = Math.max(0.1, Math.min(10, action.payload));
        break;
        
      case ACTIONS.SET_PAN:
        draft.canvas.panX = action.payload.x ?? draft.canvas.panX;
        draft.canvas.panY = action.payload.y ?? draft.canvas.panY;
        break;
        
      case ACTIONS.SET_CANVAS_ROTATION:
        draft.canvas.rotation = action.payload;
        break;
        
      // ========== Image Actions ==========
      case ACTIONS.SET_IMAGE:
        draft.image = { ...draft.image, ...action.payload };
        break;
        
      case ACTIONS.SET_IMAGE_LOADED:
        draft.image.loaded = action.payload;
        break;
        
      // ========== Adjustment Actions ==========
      case ACTIONS.SET_ADJUSTMENT:
        draft.adjustments[action.payload.key] = action.payload.value;
        break;
        
      case ACTIONS.SET_ADJUSTMENTS:
        draft.adjustments = { ...draft.adjustments, ...action.payload };
        break;
        
      case ACTIONS.RESET_ADJUSTMENTS:
        draft.adjustments = { ...DEFAULT_ADJUSTMENTS };
        break;
        
      // ========== Filter Actions ==========
      case ACTIONS.SET_FILTER:
        draft.filter = action.payload;
        break;
        
      case ACTIONS.SET_FILTER_INTENSITY:
        draft.filterIntensity = action.payload;
        break;
        
      // ========== Crop Actions ==========
      case ACTIONS.SET_CROP:
        draft.crop = { ...draft.crop, ...action.payload };
        break;
        
      case ACTIONS.SET_CROP_ASPECT:
        draft.cropAspect = action.payload;
        break;
        
      case ACTIONS.SET_CROP_ZOOM:
        draft.cropZoom = action.payload;
        break;
        
      case ACTIONS.APPLY_CROP:
        draft.image.width = action.payload.width;
        draft.image.height = action.payload.height;
        draft.canvas.width = action.payload.width;
        draft.canvas.height = action.payload.height;
        draft.crop = { x: 0, y: 0, width: action.payload.width, height: action.payload.height };
        draft.cropZoom = 1;
        draft.mode = 'edit';
        draft.activeTool = 'select';
        break;
        
      case ACTIONS.RESET_CROP:
        draft.crop = { x: 0, y: 0, width: draft.image.originalWidth, height: draft.image.originalHeight };
        draft.cropAspect = undefined;
        draft.cropZoom = 1;
        break;
        
      // ========== Rotation Actions ==========
      case ACTIONS.ROTATE_LEFT:
        draft.rotation = (draft.rotation - 90 + 360) % 360;
        break;
        
      case ACTIONS.ROTATE_RIGHT:
        draft.rotation = (draft.rotation + 90) % 360;
        break;
        
      case ACTIONS.FLIP_H:
        draft.flipH = !draft.flipH;
        break;
        
      case ACTIONS.FLIP_V:
        draft.flipV = !draft.flipV;
        break;
        
      case ACTIONS.SET_FREE_ROTATION:
        draft.rotation = action.payload;
        break;
        
      // ========== Text Layer Actions ==========
      case ACTIONS.ADD_TEXT:
        const newText = {
          id: generateId(),
          type: LAYER_TYPES.TEXT,
          text: action.payload.text || 'Text',
          x: action.payload.x ?? draft.canvas.width / 2,
          y: action.payload.y ?? draft.canvas.height / 2,
          fontSize: 48,
          fontFamily: 'Poppins',
          color: '#FFFFFF',
          fontWeight: 'normal',
          fontStyle: 'normal',
          textDecoration: 'none',
          textAlign: 'center',
          opacity: 100,
          rotation: 0,
          strokeWidth: 0,
          strokeColor: '#000000',
          shadowEnabled: false,
          shadowX: 2,
          shadowY: 2,
          shadowBlur: 4,
          shadowColor: 'rgba(0,0,0,0.5)',
          letterSpacing: 0,
          lineHeight: 1.2,
          ...action.payload,
        };
        draft.textLayers.push(newText);
        draft.selectedTextId = newText.id;
        break;
        
      case ACTIONS.UPDATE_TEXT:
        const textIndex = draft.textLayers.findIndex(t => t.id === action.payload.id);
        if (textIndex !== -1) {
          draft.textLayers[textIndex] = {
            ...draft.textLayers[textIndex],
            ...action.payload.updates,
          };
        }
        break;
        
      case ACTIONS.DELETE_TEXT:
        draft.textLayers = draft.textLayers.filter(t => t.id !== action.payload);
        if (draft.selectedTextId === action.payload) {
          draft.selectedTextId = null;
        }
        break;
        
      case ACTIONS.SELECT_TEXT:
        draft.selectedTextId = action.payload;
        break;
        
      case ACTIONS.DESELECT_TEXT:
        draft.selectedTextId = null;
        break;
        
      // ========== Layer Actions ==========
      case ACTIONS.ADD_LAYER:
        const newLayer = {
          id: generateId(),
          type: action.payload.type || LAYER_TYPES.IMAGE,
          visible: true,
          locked: false,
          opacity: 100,
          blendMode: 'normal',
          ...action.payload,
        };
        draft.layers.push(newLayer);
        draft.selectedLayerId = newLayer.id;
        break;
        
      case ACTIONS.UPDATE_LAYER:
        const layerIndex = draft.layers.findIndex(l => l.id === action.payload.id);
        if (layerIndex !== -1) {
          draft.layers[layerIndex] = {
            ...draft.layers[layerIndex],
            ...action.payload.updates,
          };
        }
        break;
        
      case ACTIONS.DELETE_LAYER:
        draft.layers = draft.layers.filter(l => l.id !== action.payload);
        if (draft.selectedLayerId === action.payload) {
          draft.selectedLayerId = null;
        }
        break;
        
      case ACTIONS.SELECT_LAYER:
        draft.selectedLayerId = action.payload;
        break;
        
      case ACTIONS.REORDER_LAYERS:
        draft.layers = action.payload;
        break;
        
      case ACTIONS.TOGGLE_LAYER_VISIBILITY:
        draft.layerVisibility[action.payload] = !draft.layerVisibility[action.payload];
        break;
        
      case ACTIONS.TOGGLE_LAYER_LOCK:
        draft.layerLocked[action.payload] = !draft.layerLocked[action.payload];
        break;
        
      case ACTIONS.GROUP_LAYERS:
        // Group selected layers
        const groupId = generateId();
        const selectedLayers = draft.layers.filter(l => 
          action.payload.includes(l.id)
        );
        const group = {
          id: groupId,
          type: 'group',
          children: selectedLayers.map(l => l.id),
          visible: true,
          locked: false,
        };
        draft.layers = draft.layers.filter(l => !action.payload.includes(l.id));
        draft.layers.push(group);
        break;
        
      case ACTIONS.UNGROUP_LAYERS:
        // Ungroup a layer group
        const groupLayer = draft.layers.find(l => l.id === action.payload && l.type === 'group');
        if (groupLayer) {
          const childLayers = groupLayer.children.map(childId => {
            const child = draft.layers.find(l => l.id === childId);
            return child || draft.textLayers.find(t => t.id === childId);
          }).filter(Boolean);
          const groupIndex = draft.layers.indexOf(groupLayer);
          draft.layers.splice(groupIndex, 1, ...childLayers);
        }
        break;
        
      // ========== Selection Actions ==========
      case ACTIONS.SET_SELECTION:
        draft.selection = { ...action.payload };
        draft.isSelected = true;
        break;
        
      case ACTIONS.CLEAR_SELECTION:
        draft.selection = { x: 0, y: 0, width: 0, height: 0, rotation: 0 };
        draft.isSelected = false;
        break;
        
      case ACTIONS.UPDATE_SELECTION:
        draft.selection = { ...draft.selection, ...action.payload };
        break;
        
      // ========== View Actions ==========
      case ACTIONS.TOGGLE_GRID:
        draft.showGrid = !draft.showGrid;
        break;
        
      case ACTIONS.TOGGLE_SNAP:
        draft.snapEnabled = !draft.snapEnabled;
        break;
        
      case ACTIONS.TOGGLE_SNAP_LINES:
        draft.showSnapLines = !draft.showSnapLines;
        break;
        
      // ========== UI Actions ==========
      case ACTIONS.TOGGLE_LEFT_PANEL:
        draft.leftPanelOpen = !draft.leftPanelOpen;
        break;
        
      case ACTIONS.TOGGLE_RIGHT_PANEL:
        draft.rightPanelOpen = !draft.rightPanelOpen;
        break;
        
      case ACTIONS.SET_ACTIVE_TAB:
        draft.activeTab = action.payload;
        break;
        
      case ACTIONS.SET_BOTTOM_SHEET:
        draft.bottomSheetOpen = action.payload.open;
        draft.bottomSheetTool = action.payload.tool;
        break;
        
      // ========== History Actions ==========
      case ACTIONS.PUSH_HISTORY:
        // Remove any future history if we're not at the end
        const newHistory = draft.history.slice(0, draft.historyIndex + 1);
        
        // Create snapshot
        const snapshot = {
          adjustments: { ...draft.adjustments },
          filter: draft.filter,
          filterIntensity: draft.filterIntensity,
          rotation: draft.rotation,
          flipH: draft.flipH,
          flipV: draft.flipV,
          textLayers: draft.textLayers.map(t => ({ ...t })),
          layers: draft.layers.map(l => ({ ...l })),
          crop: { ...draft.crop },
        };
        
        newHistory.push(snapshot);
        
        // Limit history size
        if (newHistory.length > HISTORY.MAX_SNAPSHOTS) {
          newHistory.shift();
        }
        
        draft.history = newHistory;
        draft.historyIndex = newHistory.length - 1;
        break;
        
      case ACTIONS.UNDO:
        if (draft.historyIndex > 0) {
          draft.historyIndex -= 1;
          const prevState = draft.history[draft.historyIndex];
          Object.assign(draft.adjustments, prevState.adjustments);
          draft.filter = prevState.filter;
          draft.filterIntensity = prevState.filterIntensity;
          draft.rotation = prevState.rotation;
          draft.flipH = prevState.flipH;
          draft.flipV = prevState.flipV;
          draft.textLayers = prevState.textLayers.map(t => ({ ...t }));
          draft.layers = prevState.layers.map(l => ({ ...l }));
          Object.assign(draft.crop, prevState.crop);
        }
        break;
        
      case ACTIONS.REDO:
        if (draft.historyIndex < draft.history.length - 1) {
          draft.historyIndex += 1;
          const nextState = draft.history[draft.historyIndex];
          Object.assign(draft.adjustments, nextState.adjustments);
          draft.filter = nextState.filter;
          draft.filterIntensity = nextState.filterIntensity;
          draft.rotation = nextState.rotation;
          draft.flipH = nextState.flipH;
          draft.flipV = nextState.flipV;
          draft.textLayers = nextState.textLayers.map(t => ({ ...t }));
          draft.layers = nextState.layers.map(l => ({ ...l }));
          Object.assign(draft.crop, nextState.crop);
        }
        break;
        
      case ACTIONS.CLEAR_HISTORY:
        draft.history = [];
        draft.historyIndex = -1;
        break;
        
      // ========== Processing Actions ==========
      case ACTIONS.SET_PROCESSING:
        draft.isProcessing = action.payload;
        break;
        
      // ========== State Actions ==========
      case ACTIONS.LOAD_STATE:
        return { ...DEFAULT_STATE, ...action.payload };
        
      case ACTIONS.RESET_STATE:
        return { ...DEFAULT_STATE };
        
      default:
        break;
    }
  });
}

// ==================== ACTION CREATORS ====================

export const actions = {
  setTool: (tool) => ({ type: ACTIONS.SET_TOOL, payload: tool }),
  setSubTool: (subTool) => ({ type: ACTIONS.SET_SUB_TOOL, payload: subTool }),
  setMode: (mode) => ({ type: ACTIONS.SET_MODE, payload: mode }),
  
  setCanvasSize: (width, height) => ({ 
    type: ACTIONS.SET_CANVAS_SIZE, 
    payload: { width, height } 
  }),
  setZoom: (zoom) => ({ type: ACTIONS.SET_ZOOM, payload: zoom }),
  setPan: (x, y) => ({ type: ACTIONS.SET_PAN, payload: { x, y } }),
  
  setImage: (imageData) => ({ type: ACTIONS.SET_IMAGE, payload: imageData }),
  setImageLoaded: (loaded) => ({ type: ACTIONS.SET_IMAGE_LOADED, payload: loaded }),
  
  setAdjustment: (key, value) => ({ 
    type: ACTIONS.SET_ADJUSTMENT, 
    payload: { key, value } 
  }),
  setAdjustments: (adjustments) => ({ 
    type: ACTIONS.SET_ADJUSTMENTS, 
    payload: adjustments 
  }),
  resetAdjustments: () => ({ type: ACTIONS.RESET_ADJUSTMENTS }),
  
  setFilter: (filter) => ({ type: ACTIONS.SET_FILTER, payload: filter }),
  setFilterIntensity: (intensity) => ({ 
    type: ACTIONS.SET_FILTER_INTENSITY, 
    payload: intensity 
  }),
  
  setCrop: (cropData) => ({ type: ACTIONS.SET_CROP, payload: cropData }),
  setCropAspect: (aspect) => ({ type: ACTIONS.SET_CROP_ASPECT, payload: aspect }),
  setCropZoom: (zoom) => ({ type: ACTIONS.SET_CROP_ZOOM, payload: zoom }),
  applyCrop: (cropData) => ({ type: ACTIONS.APPLY_CROP, payload: cropData }),
  resetCrop: () => ({ type: ACTIONS.RESET_CROP }),
  
  rotateLeft: () => ({ type: ACTIONS.ROTATE_LEFT }),
  rotateRight: () => ({ type: ACTIONS.ROTATE_RIGHT }),
  flipH: () => ({ type: ACTIONS.FLIP_H }),
  flipV: () => ({ type: ACTIONS.FLIP_V }),
  setFreeRotation: (rotation) => ({ 
    type: ACTIONS.SET_FREE_ROTATION, 
    payload: rotation 
  }),
  
  addText: (textData) => ({ type: ACTIONS.ADD_TEXT, payload: textData }),
  updateText: (id, updates) => ({ 
    type: ACTIONS.UPDATE_TEXT, 
    payload: { id, updates } 
  }),
  deleteText: (id) => ({ type: ACTIONS.DELETE_TEXT, payload: id }),
  selectText: (id) => ({ type: ACTIONS.SELECT_TEXT, payload: id }),
  deselectText: () => ({ type: ACTIONS.DESELECT_TEXT }),
  
  addLayer: (layerData) => ({ type: ACTIONS.ADD_LAYER, payload: layerData }),
  updateLayer: (id, updates) => ({ 
    type: ACTIONS.UPDATE_LAYER, 
    payload: { id, updates } 
  }),
  deleteLayer: (id) => ({ type: ACTIONS.DELETE_LAYER, payload: id }),
  selectLayer: (id) => ({ type: ACTIONS.SELECT_LAYER, payload: id }),
  reorderLayers: (layers) => ({ type: ACTIONS.REORDER_LAYERS, payload: layers }),
  
  toggleGrid: () => ({ type: ACTIONS.TOGGLE_GRID }),
  toggleSnap: () => ({ type: ACTIONS.TOGGLE_SNAP }),
  toggleSnapLines: () => ({ type: ACTIONS.TOGGLE_SNAP_LINES }),
  
  toggleLeftPanel: () => ({ type: ACTIONS.TOGGLE_LEFT_PANEL }),
  toggleRightPanel: () => ({ type: ACTIONS.TOGGLE_RIGHT_PANEL }),
  setActiveTab: (tab) => ({ type: ACTIONS.SET_ACTIVE_TAB, payload: tab }),
  setBottomSheet: (open, tool) => ({ 
    type: ACTIONS.SET_BOTTOM_SHEET, 
    payload: { open, tool } 
  }),
  
  pushHistory: () => ({ type: ACTIONS.PUSH_HISTORY }),
  undo: () => ({ type: ACTIONS.UNDO }),
  redo: () => ({ type: ACTIONS.REDO }),
  clearHistory: () => ({ type: ACTIONS.CLEAR_HISTORY }),
  
  setProcessing: (isProcessing) => ({ 
    type: ACTIONS.SET_PROCESSING, 
    payload: isProcessing 
  }),
  
  loadState: (state) => ({ type: ACTIONS.LOAD_STATE, payload: state }),
  resetState: () => ({ type: ACTIONS.RESET_STATE }),
};

// ==================== SELECTORS ====================

export const selectors = {
  canUndo: (state) => state.historyIndex > 0,
  canRedo: (state) => state.historyIndex < state.history.length - 1,
  selectedText: (state) => state.textLayers.find(t => t.id === state.selectedTextId),
  selectedLayer: (state) => state.layers.find(l => l.id === state.selectedLayerId),
  visibleLayers: (state) => state.layers.filter(l => l.visible !== false),
  hasAdjustments: (state) => {
    return Object.entries(state.adjustments).some(([key, value]) => {
      const defaultValue = DEFAULT_ADJUSTMENTS[key];
      return value !== defaultValue;
    });
  },
  hasFilter: (state) => state.filter !== 'none',
  effectiveZoom: (state) => state.canvas.zoom,
  isCropMode: (state) => state.mode === 'crop',
  isTextMode: (state) => state.mode === 'text' || state.activeTool === 'text',
};

// ==================== MEMOIZED HELPERS ====================

export function getFilterCSS(state) {
  const parts = [];
  const { adjustments, filter, filterIntensity } = state;
  
  // Build filter string from adjustments
  const { brightness, contrast, saturation, blur } = adjustments;
  
  if (brightness !== 100) parts.push(`brightness(${brightness}%)`);
  if (contrast !== 100) parts.push(`contrast(${contrast}%)`);
  if (saturation !== 100) parts.push(`saturate(${saturation}%)`);
  if (blur > 0) parts.push(`blur(${blur}px)`);
  
  // Apply preset filter with intensity
  if (filter !== 'none' && filterIntensity < 100) {
    const filterParts = filter.split('(');
    if (filterParts.length === 2) {
      const [filterName, filterValue] = filterParts;
      const baseValue = filterValue.replace(')', '');
      const adjustedValue = baseValue.replace(/[\d.]+/, (match) => {
        const num = parseFloat(match);
        return String(num * (filterIntensity / 100));
      });
      parts.push(`${filterName}(${adjustedValue})`);
    }
  } else if (filter !== 'none') {
    parts.push(filter);
  }
  
  return parts.length > 0 ? parts.join(' ') : 'none';
}

export function getTransformCSS(state) {
  const transforms = [];
  
  if (state.flipH) transforms.push('scaleX(-1)');
  if (state.flipV) transforms.push('scaleY(-1)');
  if (state.rotation !== 0) {
    transforms.push(`rotate(${state.rotation}deg)`);
  }
  
  return transforms.length > 0 ? transforms.join(' ') : 'none';
}

export default editorReducer;
