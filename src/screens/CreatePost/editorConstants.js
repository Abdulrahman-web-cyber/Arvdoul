// src/screens/CreatePost/editorConstants.js - ARVDOUL Image Editor Design Tokens & Constants
// World-class design system following ARVDOUL Design DNA

// ==================== ARVDOUL DNA GRADIENT ====================
export const ARVDOUL_GRADIENT = 'linear-gradient(135deg, #B416DB 0%, #872FE2 35%, #4B6BFF 70%, #0EA3E6 100%)';
export const ARVDOUL_SHADOW = '0 12px 40px rgba(135,47,226,.35)';
export const ARVDOUL_GLOW = '0 0 30px rgba(147,51,234,0.25)';

// ==================== DESIGN TOKENS ====================
export const TOKENS = {
  // Border Radius
  radius: {
    btn: 24,
    card: 30,
    canvas: 28,
    modal: 36,
    input: 22,
    sheet: 34,
    toolbar: 26,
    layer: 18,
    avatar: 9999,
    filter: 16,
    slider: 9999,
  },
  // Spacing Scale
  spacing: [4, 8, 12, 16, 20, 24, 32, 40, 48, 64],
  // Glass Effect
  glass: {
    blur: 32,
    bg: 'rgba(255,255,255,.08)',
    border: 'rgba(255,255,255,.12)',
  },
  // Shadows
  shadows: {
    ambient: '0 20px 60px rgba(0,0,0,0.3)',
    primary: '0 12px 40px rgba(135,47,226,.35)',
    elevation1: '0 2px 8px rgba(0,0,0,0.08)',
    elevation2: '0 4px 16px rgba(0,0,0,0.12)',
    elevation3: '0 8px 32px rgba(0,0,0,0.16)',
    elevation4: '0 16px 48px rgba(0,0,0,0.20)',
    elevation5: '0 24px 64px rgba(0,0,0,0.25)',
  },
};

// ==================== THEME TOKENS ====================
export const THEME_TOKENS = {
  light: {
    bg: '#F0F2F6',
    card: '#FFFFFF',
    cardBorder: '#E8ECF2',
    text: '#0B0F14',
    textSecondary: '#4A5268',
    textMuted: '#8892A8',
    shadow: '0 8px 40px rgba(0,0,0,0.06), 0 2px 8px rgba(0,0,0,0.03)',
    hover: '#F0F2F6',
    glass: 'rgba(255,255,255,0.72)',
    glassBorder: 'rgba(255,255,255,0.3)',
    elevation: '0 12px 48px rgba(0,0,0,0.08), 0 2px 12px rgba(0,0,0,0.02)',
    overlay: 'rgba(0,0,0,0.7)',
    canvas: '#FAFAFA',
    grid: 'rgba(0,0,0,0.05)',
  },
  dark: {
    bg: '#05070C',
    card: '#0C1426',
    cardBorder: '#1A2440',
    text: '#FFFFFF',
    textSecondary: '#8899BB',
    textMuted: '#4A5A7A',
    shadow: '0 8px 40px rgba(0,0,0,0.5), 0 2px 8px rgba(0,0,0,0.2)',
    hover: '#14203A',
    glass: 'rgba(12,20,38,0.72)',
    glassBorder: 'rgba(255,255,255,0.06)',
    elevation: '0 12px 48px rgba(0,0,0,0.6), 0 2px 12px rgba(0,0,0,0.3)',
    overlay: 'rgba(0,0,0,0.85)',
    canvas: '#0A0E1A',
    grid: 'rgba(255,255,255,0.03)',
  },
  amoled: {
    bg: '#000000',
    card: '#0A0A0A',
    cardBorder: '#1A1A1A',
    text: '#FFFFFF',
    textSecondary: '#888899',
    textMuted: '#444455',
    shadow: '0 8px 40px rgba(0,0,0,0.8)',
    hover: '#111111',
    glass: 'rgba(0,0,0,0.8)',
    glassBorder: 'rgba(255,255,255,0.04)',
    elevation: '0 12px 48px rgba(0,0,0,0.9)',
    overlay: 'rgba(0,0,0,0.95)',
    canvas: '#050505',
    grid: 'rgba(255,255,255,0.02)',
  },
  highContrast: {
    bg: '#000000',
    card: '#000000',
    cardBorder: '#FFFFFF',
    text: '#FFFFFF',
    textSecondary: '#CCCCCC',
    textMuted: '#AAAAAA',
    shadow: 'none',
    hover: '#222222',
    glass: 'rgba(0,0,0,0.95)',
    glassBorder: '#FFFFFF',
    elevation: 'none',
    overlay: 'rgba(0,0,0,0.9)',
    canvas: '#000000',
    grid: 'rgba(255,255,255,0.1)',
  },
};

// ==================== TOOL TYPES ====================
export const TOOLS = {
  SELECT: 'select',
  ADJUST: 'adjust',
  FILTER: 'filter',
  CROP: 'crop',
  ROTATE: 'rotate',
  TEXT: 'text',
  DRAW: 'draw',
  GIF: 'gif',
  AI: 'ai',
};

// ==================== ADJUSTMENT SETTINGS ====================
export const ADJUSTMENTS = [
  { key: 'brightness', label: 'Brightness', min: 0, max: 200, default: 100 },
  { key: 'contrast', label: 'Contrast', min: 0, max: 200, default: 100 },
  { key: 'saturation', label: 'Saturation', min: 0, max: 200, default: 100 },
  { key: 'exposure', label: 'Exposure', min: -100, max: 100, default: 0 },
  { key: 'temperature', label: 'Temperature', min: -100, max: 100, default: 0 },
  { key: 'tint', label: 'Tint', min: -100, max: 100, default: 0 },
  { key: 'highlights', label: 'Highlights', min: -100, max: 100, default: 0 },
  { key: 'shadows', label: 'Shadows', min: -100, max: 100, default: 0 },
  { key: 'whites', label: 'Whites', min: -100, max: 100, default: 0 },
  { key: 'blacks', label: 'Blacks', min: -100, max: 100, default: 0 },
  { key: 'clarity', label: 'Clarity', min: -100, max: 100, default: 0 },
  { key: 'sharpness', label: 'Sharpness', min: 0, max: 100, default: 0 },
  { key: 'dehaze', label: 'Dehaze', min: -100, max: 100, default: 0 },
  { key: 'fade', label: 'Fade', min: 0, max: 100, default: 0 },
  { key: 'grain', label: 'Grain', min: 0, max: 100, default: 0 },
  { key: 'vignette', label: 'Vignette', min: 0, max: 100, default: 0 },
  { key: 'gamma', label: 'Gamma', min: 50, max: 150, default: 100 },
];

// ==================== FILTER PRESETS ====================
export const FILTERS = [
  { name: 'Original', value: 'none', category: 'basic' },
  { name: 'Grayscale', value: 'grayscale(100%)', category: 'basic' },
  { name: 'Sepia', value: 'sepia(80%)', category: 'basic' },
  { name: 'Blur', value: 'blur(4px)', category: 'basic' },
  { name: 'Bright', value: 'brightness(1.5)', category: 'basic' },
  { name: 'Cool', value: 'hue-rotate(90deg)', category: 'basic' },
  { name: 'Warm', value: 'hue-rotate(-30deg)', category: 'basic' },
  { name: 'Vintage', value: 'sepia(60%) contrast(1.1) brightness(0.9)', category: 'creative' },
  { name: 'Noir', value: 'grayscale(100%) contrast(1.3)', category: 'creative' },
  { name: 'Drama', value: 'contrast(1.5) saturate(1.5)', category: 'creative' },
  { name: 'Soft', value: 'blur(1px) brightness(1.1) contrast(0.9)', category: 'creative' },
  { name: 'Lomo', value: 'saturate(1.5) contrast(1.2) brightness(0.9)', category: 'creative' },
  { name: 'Recent', value: 'none', category: 'other' },
  { name: 'Simple', value: 'brightness(1.05) contrast(1.05)', category: 'other' },
  { name: 'Vibrant', value: 'saturate(1.8) contrast(1.1)', category: 'other' },
  { name: 'Moody', value: 'contrast(1.2) saturate(0.8) brightness(0.9)', category: 'other' },
  { name: 'B&W', value: 'grayscale(100%) contrast(1.2)', category: 'other' },
  { name: 'Film', value: 'contrast(1.15) saturate(1.1) sepia(20%)', category: 'other' },
  { name: 'Nature', value: 'saturate(1.3) brightness(1.05) hue-rotate(-10deg)', category: 'other' },
  { name: 'Cinematic', value: 'contrast(1.25) saturate(1.2) brightness(0.9) hue-rotate(5deg)', category: 'other' },
];

export const FILTER_CATEGORIES = ['basic', 'creative', 'other'];

// ==================== ASPECT RATIOS ====================
export const ASPECT_RATIOS = [
  { label: 'Free', value: undefined, icon: 'maximize' },
  { label: '1:1', value: 1 / 1, icon: 'square' },
  { label: '4:5', value: 4 / 5, icon: 'portrait' },
  { label: '16:9', value: 16 / 9, icon: 'landscape' },
  { label: '9:16', value: 9 / 16, icon: 'phone' },
  { label: '3:2', value: 3 / 2, icon: 'photo' },
  { label: '2:3', value: 2 / 3, icon: 'portrait-alt' },
];

// ==================== CANVAS SETTINGS ====================
export const CANVAS = {
  MIN_ZOOM: 0.1,
  MAX_ZOOM: 10,
  DEFAULT_ZOOM: 1,
  ZOOM_STEP: 0.1,
  GRID_SIZE: 20,
  HANDLE_SIZE: 10,
  ROTATION_HANDLE_OFFSET: 30,
  SAFE_AREA: { width: 4000, height: 4000 },
};

// ==================== HISTORY SETTINGS ====================
export const HISTORY = {
  MAX_SNAPSHOTS: 100,
  AUTO_SAVE_INTERVAL: 10000, // 10 seconds
  DEBOUNCE_DELAY: 100, // ms for slider debounce
};

// ==================== LAYER TYPES ====================
export const LAYER_TYPES = {
  IMAGE: 'image',
  TEXT: 'text',
  SHAPE: 'shape',
  STICKER: 'sticker',
  GRADIENT: 'gradient',
  DRAWING: 'drawing',
  FRAME: 'frame',
  MASK: 'mask',
};

// ==================== BLEND MODES ====================
export const BLEND_MODES = [
  'normal',
  'multiply',
  'screen',
  'overlay',
  'darken',
  'lighten',
  'color-dodge',
  'color-burn',
  'hard-light',
  'soft-light',
  'difference',
  'exclusion',
  'hue',
  'saturation',
  'color',
  'luminosity',
];

// ==================== AI TOOLS ====================
export const AI_TOOLS = [
  { id: 'remove-bg', title: 'Remove Background', description: 'Remove the background from your image', icon: 'scissors', credits: 1 },
  { id: 'magic-eraser', title: 'Magic Eraser', description: 'Remove unwanted objects', icon: 'eraser', credits: 2 },
  { id: 'expand', title: 'Expand Image', description: 'Extend the edges of your image', icon: 'expand', credits: 3 },
  { id: 'relight', title: 'Relight', description: 'Adjust lighting direction', icon: 'sun', credits: 2 },
  { id: 'replace', title: 'Replace Object', description: 'Swap objects in your image', icon: 'repeat', credits: 2 },
  { id: 'upscale', title: 'Upscale', description: 'Increase image resolution', icon: 'maximize-2', credits: 3 },
  { id: 'enhance', title: 'Enhance', description: 'Auto-enhance your image', icon: 'sparkles', credits: 1 },
  { id: 'recolor', title: 'Recolor', description: 'Change colors in your image', icon: 'palette', credits: 2 },
  { id: 'portrait', title: 'Portrait Mode', description: 'Add portrait lighting effect', icon: 'user', credits: 1 },
];

// ==================== FONT FAMILIES ====================
export const GOOGLE_FONTS = [
  'Poppins',
  'Inter',
  'Roboto',
  'Open Sans',
  'Lato',
  'Montserrat',
  'Oswald',
  'Raleway',
  'Nunito',
  'Playfair Display',
  'Merriweather',
  'Source Sans Pro',
  'Ubuntu',
  'Rubik',
  'Work Sans',
  'Quicksand',
  'Comfortaa',
  'Pacifico',
  'Dancing Script',
  'Abril Fatface',
];

// ==================== KEYBOARD SHORTCUTS ====================
export const SHORTCUTS = {
  UNDO: { key: 'z', ctrl: true },
  REDO: { key: 'z', ctrl: true, shift: true },
  REDO_ALT: { key: 'y', ctrl: true },
  SAVE: { key: 's', ctrl: true },
  DELETE: { key: 'Delete', ctrl: false },
  BACKSPACE: { key: 'Backspace', ctrl: false },
  DUPLICATE: { key: 'd', ctrl: true },
  SELECT_ALL: { key: 'a', ctrl: true },
  DESELECT: { key: 'Escape', ctrl: false },
  ZOOM_IN: { key: '=', ctrl: true },
  ZOOM_OUT: { key: '-', ctrl: true },
  FIT_TO_SCREEN: { key: '0', ctrl: true },
  GROUP: { key: 'g', ctrl: true },
  UNGROUP: { key: 'g', ctrl: true, shift: true },
  TOGGLE_GRID: { key: "'", ctrl: true },
  TOGGLE_SNAP: { key: ';', ctrl: true },
  PAN: { key: 'Space', ctrl: false },
};

// ==================== ANIMATION CONFIG ====================
export const ANIMATION = {
  spring: {
    damping: 25,
    stiffness: 300,
    mass: 0.8,
  },
  button: {
    damping: 20,
    stiffness: 400,
    mass: 0.5,
  },
  bottomSheet: {
    damping: 30,
    stiffness: 200,
    mass: 1,
  },
  duration: {
    fast: 150,
    normal: 250,
    slow: 400,
  },
  easing: [0.175, 0.885, 0.32, 1.275],
};

// ==================== LAYOUT METRICS ====================
export const LAYOUT = {
  topBar: { height: 72, padding: 24 },
  closeButton: { size: 24, hitArea: 44 },
  saveButton: { height: 52, width: 128, radius: 24 },
  toolButton: { hitArea: 44, icon: 24 },
  leftPanel: { width: 280, padding: 16 },
  rightPanel: { width: 320, padding: 16 },
  canvas: { padding: 20 },
  modal: { maxWidth: 1360, padding: 24 },
};

// ==================== PERFORMANCE SETTINGS ====================
export const PERFORMANCE = {
  DEBOUNCE_SLIDERS: 100,
  THROTTLE_DRAG: 16,
  MAX_HISTORY: 100,
  AUTO_SAVE_INTERVAL: 10000,
  PREVIEW_QUALITY: 0.8,
  EXPORT_QUALITY: 0.95,
  THUMBNAIL_SIZE: 128,
  MAX_ZOOM_CACHE: 5,
};

// ==================== ERROR MESSAGES ====================
export const ERRORS = {
  IMAGE_LOAD: 'Failed to load image. Please try again.',
  IMAGE_DECODE: 'Failed to decode image. The file may be corrupted.',
  CANVAS_CONTEXT: 'Canvas rendering context unavailable.',
  EXPORT_FAILED: 'Failed to export image. Please try again.',
  STORAGE_QUOTA: 'Storage quota exceeded. Please free up space.',
  OFFLINE_SAVE: 'Unable to save while offline.',
  UNKNOWN: 'An unexpected error occurred.',
};

// ==================== OFFSCREEN CANVAS WORKER MESSAGES ====================
export const WORKER_MESSAGES = {
  APPLY_ADJUSTMENTS: 'APPLY_ADJUSTMENTS',
  APPLY_FILTER: 'APPLY_FILTER',
  APPLY_CROP: 'APPLY_CROP',
  ROTATE_IMAGE: 'ROTATE_IMAGE',
  FLIP_IMAGE: 'FLIP_IMAGE',
  COMPOSITE_LAYERS: 'COMPOSITE_LAYERS',
  EXPORT_IMAGE: 'EXPORT_IMAGE',
};

// ==================== UTILITY FUNCTIONS ====================

/**
 * Generate unique ID for layers and other elements
 */
export function generateId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxx-xxxx-xxxx-xxxx'.replace(/x/g, () => 
    Math.floor(Math.random() * 16).toString(16)
  );
}
