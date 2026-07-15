// src/screens/CreatePost/videoConstants.js - ARVDOUL Video Studio Design Tokens & Constants
// World-class video editing constants following ARVDOUL Design DNA

import { ARVDOUL_GRADIENT } from './editorConstants';

// ==================== VIDEO EDITOR DNA ====================
export const VIDEO_ARVDOUL_GRADIENT = ARVDOUL_GRADIENT;
export const VIDEO_ARVDOUL_SHADOW = '0 12px 40px rgba(135,47,226,.35), 0 4px 12px rgba(0,0,0,0.2)';
export const VIDEO_ARVDOUL_GLOW = '0 0 40px rgba(147,51,234,0.3)';

// ==================== VIDEO DESIGN TOKENS ====================
export const VIDEO_TOKENS = {
  // Border Radius
  radius: {
    btn: 24,
    card: 30,
    modal: 36,
    sheet: 34,
    toolbar: 26,
    clip: 12,
    track: 8,
    slider: 9999,
    timeline: 20,
    preview: 24,
  },
  // Spacing Scale
  spacing: [4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80],
  // Glass Effect
  glass: {
    blur: 32,
    bg: 'rgba(255,255,255,.08)',
    border: 'rgba(255,255,255,.12)',
    bgDark: 'rgba(12,20,38,0.72)',
    borderDark: 'rgba(255,255,255,.06)',
  },
  // Shadows
  shadows: {
    ambient: '0 20px 60px rgba(0,0,0,0.3)',
    primary: '0 12px 40px rgba(135,47,226,.35)',
    timeline: '0 -4px 20px rgba(0,0,0,0.3)',
    panel: '0 8px 32px rgba(0,0,0,0.25)',
    clip: '0 2px 8px rgba(0,0,0,0.3)',
    handle: '0 1px 4px rgba(0,0,0,0.4)',
    glow: '0 0 20px rgba(147,51,234,0.25)',
  },
};

// ==================== VIDEO THEME TOKENS ====================
export const VIDEO_THEME_TOKENS = {
  light: {
    bg: '#F0F2F6',
    panel: 'rgba(255,255,255,0.85)',
    panelBorder: 'rgba(255,255,255,0.4)',
    text: '#0B0F14',
    textSecondary: '#4A5268',
    textMuted: '#8892A8',
    timeline: '#E8ECF2',
    track: '#D8DCE2',
    clip: '#FFFFFF',
    clipSelected: '#F0E8FF',
    playhead: '#B416DB',
    waveform: 'rgba(180,22,219,0.6)',
    grid: 'rgba(0,0,0,0.05)',
    overlay: 'rgba(0,0,0,0.85)',
    canvas: '#0A0E1A',
  },
  dark: {
    bg: '#05070C',
    panel: 'rgba(12,20,38,0.85)',
    panelBorder: 'rgba(255,255,255,0.06)',
    text: '#FFFFFF',
    textSecondary: '#8899BB',
    textMuted: '#4A5A7A',
    timeline: '#0C1426',
    track: '#14203A',
    clip: '#1A2440',
    clipSelected: '#2A3460',
    playhead: '#B416DB',
    waveform: 'rgba(180,22,219,0.7)',
    grid: 'rgba(255,255,255,0.03)',
    overlay: 'rgba(0,0,0,0.9)',
    canvas: '#0A0E1A',
  },
  amoled: {
    bg: '#000000',
    panel: 'rgba(0,0,0,0.9)',
    panelBorder: 'rgba(255,255,255,0.04)',
    text: '#FFFFFF',
    textSecondary: '#888899',
    textMuted: '#444455',
    timeline: '#0A0A0A',
    track: '#111111',
    clip: '#1A1A1A',
    clipSelected: '#2A2A3A',
    playhead: '#B416DB',
    waveform: 'rgba(180,22,219,0.8)',
    grid: 'rgba(255,255,255,0.02)',
    overlay: 'rgba(0,0,0,0.95)',
    canvas: '#000000',
  },
  highContrast: {
    bg: '#000000',
    panel: 'rgba(0,0,0,0.95)',
    panelBorder: '#FFFFFF',
    text: '#FFFFFF',
    textSecondary: '#CCCCCC',
    textMuted: '#AAAAAA',
    timeline: '#000000',
    track: '#1A1A1A',
    clip: '#2A2A2A',
    clipSelected: '#4A4A4A',
    playhead: '#FFFFFF',
    waveform: '#FFFFFF',
    grid: 'rgba(255,255,255,0.1)',
    overlay: 'rgba(0,0,0,0.9)',
    canvas: '#000000',
  },
};

// ==================== VIDEO TOOL TYPES ====================
export const VIDEO_TOOLS = {
  SELECT: 'select',
  ADJUST: 'adjust',
  FILTER: 'filter',
  CROP: 'crop',
  ROTATE: 'rotate',
  TEXT: 'text',
  TRIM: 'trim',
  SPEED: 'speed',
  VOLUME: 'volume',
  EFFECTS: 'effects',
  TRANSITIONS: 'transitions',
  SUBTITLES: 'subtitles',
  AI: 'ai',
  AUDIO: 'audio',
  ASSETS: 'assets',
};

// ==================== TRACK TYPES ====================
export const TRACK_TYPES = {
  VIDEO: 'video',
  AUDIO: 'audio',
  OVERLAY: 'overlay',
  SUBTITLE: 'subtitle',
  EFFECT: 'effect',
};

// ==================== CLIP COLOR LABELS ====================
export const CLIP_COLORS = [
  { id: 'red', label: 'Red', color: '#EF4444', bg: 'rgba(239,68,68,0.2)' },
  { id: 'orange', label: 'Orange', color: '#F97316', bg: 'rgba(249,115,22,0.2)' },
  { id: 'yellow', label: 'Yellow', color: '#EAB308', bg: 'rgba(234,179,8,0.2)' },
  { id: 'green', label: 'Green', color: '#22C55E', bg: 'rgba(34,197,94,0.2)' },
  { id: 'cyan', label: 'Cyan', color: '#06B6D4', bg: 'rgba(6,182,212,0.2)' },
  { id: 'blue', label: 'Blue', color: '#3B82F6', bg: 'rgba(59,130,246,0.2)' },
  { id: 'purple', label: 'Purple', color: '#8B5CF6', bg: 'rgba(139,92,246,0.2)' },
  { id: 'pink', label: 'Pink', color: '#EC4899', bg: 'rgba(236,72,153,0.2)' },
];

// ==================== VIDEO RESOLUTIONS ====================
export const VIDEO_RESOLUTIONS = [
  { id: '4k', label: '4K UHD', width: 3840, height: 2160, icon: 'monitor' },
  { id: '1080', label: '1080p HD', width: 1920, height: 1080, icon: 'monitor' },
  { id: '720', label: '720p HD', width: 1280, height: 720, icon: 'tablet' },
  { id: '480', label: '480p SD', width: 854, height: 480, icon: 'smartphone' },
  { id: '360', label: '360p', width: 640, height: 360, icon: 'smartphone' },
  { id: 'vertical-1080', label: '1080p Vertical', width: 1080, height: 1920, icon: 'smartphone' },
  { id: 'vertical-720', label: '720p Vertical', width: 720, height: 1280, icon: 'smartphone' },
  { id: 'square-1080', label: '1080p Square', width: 1080, height: 1080, icon: 'square' },
];

// ==================== FRAME RATES ====================
export const FRAME_RATES = [
  { id: '24', label: '24 fps (Film)', value: 24 },
  { id: '25', label: '25 fps (PAL)', value: 25 },
  { id: '30', label: '30 fps (NTSC)', value: 30 },
  { id: '50', label: '50 fps (PAL)', value: 50 },
  { id: '60', label: '60 fps (Smooth)', value: 60 },
  { id: '120', label: '120 fps (Slow-mo)', value: 120 },
];

// ==================== ASPECT RATIOS ====================
export const VIDEO_ASPECT_RATIOS = [
  { id: '16:9', label: '16:9 (Widescreen)', value: 16 / 9, icon: 'monitor' },
  { id: '4:3', label: '4:3 (Standard)', value: 4 / 3, icon: 'monitor' },
  { id: '1:1', label: '1:1 (Square)', value: 1, icon: 'square' },
  { id: '9:16', label: '9:16 (Vertical)', value: 9 / 16, icon: 'smartphone' },
  { id: '21:9', label: '21:9 (Cinematic)', value: 21 / 9, icon: 'film' },
  { id: '4:5', label: '4:5 (Portrait)', value: 4 / 5, icon: 'smartphone' },
];

// ==================== VIDEO ADJUSTMENTS ====================
export const VIDEO_ADJUSTMENTS = [
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
  { key: 'sharpness', label: 'Sharpness', min: 0, max: 100, default: 0 },
  { key: 'vignette', label: 'Vignette', min: 0, max: 100, default: 0 },
  { key: 'grain', label: 'Grain', min: 0, max: 100, default: 0 },
  { key: 'blur', label: 'Blur', min: 0, max: 50, default: 0 },
];

// ==================== VIDEO FILTERS ====================
export const VIDEO_FILTERS = [
  { name: 'Original', value: 'none', category: 'basic' },
  { name: 'Grayscale', value: 'grayscale(100%)', category: 'basic' },
  { name: 'Sepia', value: 'sepia(80%)', category: 'basic' },
  { name: 'Invert', value: 'invert(100%)', category: 'basic' },
  { name: 'Bright', value: 'brightness(1.4)', category: 'basic' },
  { name: 'Cool', value: 'hue-rotate(30deg) saturate(1.2)', category: 'basic' },
  { name: 'Warm', value: 'hue-rotate(-20deg) saturate(1.3)', category: 'basic' },
  { name: 'Vintage', value: 'sepia(50%) contrast(1.1) brightness(0.9) saturate(0.9)', category: 'creative' },
  { name: 'Noir', value: 'grayscale(100%) contrast(1.4) brightness(0.9)', category: 'creative' },
  { name: 'Drama', value: 'contrast(1.5) saturate(1.3) brightness(0.9)', category: 'creative' },
  { name: 'Fade', value: 'contrast(0.9) brightness(1.1) saturate(0.8)', category: 'creative' },
  { name: 'Vibrant', value: 'saturate(1.8) contrast(1.1)', category: 'creative' },
  { name: 'Cinematic', value: 'contrast(1.25) saturate(1.1) brightness(0.9) hue-rotate(5deg)', category: 'creative' },
  { name: 'Film', value: 'contrast(1.15) saturate(1.1) sepia(20%) brightness(0.95)', category: 'creative' },
  { name: 'Cold', value: 'saturate(0.9) brightness(1.05) hue-rotate(40deg)', category: 'creative' },
  { name: 'Golden', value: 'sepia(40%) saturate(1.4) brightness(1.05)', category: 'creative' },
  { name: 'Retro', value: 'contrast(1.2) saturate(0.7) brightness(1.1) hue-rotate(-10deg)', category: 'creative' },
  { name: 'Cyberpunk', value: 'hue-rotate(180deg) saturate(1.5) contrast(1.3)', category: 'creative' },
  { name: 'Dream', value: 'brightness(1.2) contrast(0.9) saturate(1.3) hue-rotate(-10deg)', category: 'creative' },
  { name: 'Noir B&W', value: 'grayscale(100%) contrast(1.5) brightness(0.95)', category: 'creative' },
];

export const VIDEO_FILTER_CATEGORIES = ['basic', 'creative'];

// ==================== TRANSITIONS ====================
export const TRANSITIONS_TYPES = {
  CUT: 'cut',
  DISSOLVE: 'dissolve',
  FADE: 'fade',
  WIPE: 'wipe',
  SLIDE: 'slide',
  ZOOM: 'zoom',
  BLUR: 'blur',
};

export const TRANSITIONS = [
  // Basic
  { id: 'none', name: 'None', type: TRANSITION_TYPES.CUT, duration: 0, icon: 'scissors' },
  { id: 'dissolve', name: 'Dissolve', type: TRANSITION_TYPES.DISSOLVE, duration: 500, icon: 'droplets' },
  { id: 'fade', name: 'Fade', type: TRANSITION_TYPES.FADE, duration: 500, icon: 'sunset' },
  { id: 'black-fade', name: 'Black Fade', type: TRANSITION_TYPES.FADE, duration: 500, icon: 'moon' },
  { id: 'white-fade', name: 'White Fade', type: TRANSITION_TYPES.FADE, duration: 500, icon: 'sun' },
  // Wipes
  { id: 'wipe-left', name: 'Wipe Left', type: TRANSITION_TYPES.WIPE, duration: 400, icon: 'arrow-left' },
  { id: 'wipe-right', name: 'Wipe Right', type: TRANSITION_TYPES.WIPE, duration: 400, icon: 'arrow-right' },
  { id: 'wipe-up', name: 'Wipe Up', type: TRANSITION_TYPES.WIPE, duration: 400, icon: 'arrow-up' },
  { id: 'wipe-down', name: 'Wipe Down', type: TRANSITION_TYPES.WIPE, duration: 400, icon: 'arrow-down' },
  { id: 'wipe-circle', name: 'Circle Wipe', type: TRANSITION_TYPES.WIPE, duration: 500, icon: 'circle' },
  { id: 'wipe-star', name: 'Star Wipe', type: TRANSITION_TYPES.WIPE, duration: 500, icon: 'star' },
  // Slides
  { id: 'slide-left', name: 'Slide Left', type: TRANSITION_TYPES.SLIDE, duration: 400, icon: 'chevron-left' },
  { id: 'slide-right', name: 'Slide Right', type: TRANSITION_TYPES.SLIDE, duration: 400, icon: 'chevron-right' },
  { id: 'slide-up', name: 'Slide Up', type: TRANSITION_TYPES.SLIDE, duration: 400, icon: 'chevron-up' },
  { id: 'slide-down', name: 'Slide Down', type: TRANSITION_TYPES.SLIDE, duration: 400, icon: 'chevron-down' },
  // Zooms
  { id: 'zoom-in', name: 'Zoom In', type: TRANSITION_TYPES.ZOOM, duration: 400, icon: 'zoom-in' },
  { id: 'zoom-out', name: 'Zoom Out', type: TRANSITION_TYPES.ZOOM, duration: 400, icon: 'zoom-out' },
  { id: 'cross-zoom', name: 'Cross Zoom', type: TRANSITION_TYPES.ZOOM, duration: 500, icon: 'maximize-2' },
  // Effects
  { id: 'blur', name: 'Blur', type: TRANSITION_TYPES.BLUR, duration: 500, icon: 'blur' },
  { id: 'pixelate', name: 'Pixelate', type: TRANSITION_TYPES.BLUR, duration: 500, icon: 'grid' },
  { id: 'glitch', name: 'Glitch', type: TRANSITION_TYPES.BLUR, duration: 400, icon: 'zap' },
  { id: 'flash', name: 'Flash', type: TRANSITION_TYPES.FADE, duration: 200, icon: 'lightning' },
];

// ==================== EFFECTS PRESETS ====================
export const EFFECTS = [
  { id: 'glow', name: 'Glow', icon: 'sun', params: { intensity: 50 } },
  { id: 'blur', name: 'Blur', icon: 'droplet', params: { amount: 10 } },
  { id: 'sharpen', name: 'Sharpen', icon: 'focus', params: { amount: 50 } },
  { id: 'vignette', name: 'Vignette', icon: 'circle', params: { intensity: 50, radius: 50 } },
  { id: 'grain', name: 'Film Grain', icon: 'grid-3x3', params: { amount: 20 } },
  { id: 'noise', name: 'Noise', icon: 'wind', params: { amount: 20 } },
  { id: 'scratch', name: 'Scratches', icon: 'minus', params: { amount: 10 } },
  { id: 'dust', name: 'Dust', icon: 'sparkles', params: { amount: 10 } },
  { id: 'vhs', name: 'VHS', icon: 'tv', params: { tracking: 5, noise: 20 } },
  { id: 'glitch', name: 'Glitch', icon: 'zap', params: { amount: 50 } },
  { id: 'chromatic', name: 'Chromatic', icon: 'prism', params: { offset: 5 } },
  { id: 'kaleidoscope', name: 'Kaleidoscope', icon: 'hexagon', params: { segments: 6 } },
];

// ==================== SPEED PRESETS ====================
export const SPEED_PRESETS = [
  { id: '0.25x', label: '0.25x', value: 0.25 },
  { id: '0.5x', label: '0.5x', value: 0.5 },
  { id: '0.75x', label: '0.75x', value: 0.75 },
  { id: '1x', label: '1x', value: 1 },
  { id: '1.25x', label: '1.25x', value: 1.25 },
  { id: '1.5x', label: '1.5x', value: 1.5 },
  { id: '2x', label: '2x', value: 2 },
  { id: '4x', label: '4x', value: 4 },
];

// ==================== AUDIO SETTINGS ====================
export const AUDIO_SETTINGS = {
  masterVolume: { min: 0, max: 200, default: 100 },
  clipVolume: { min: 0, max: 200, default: 100 },
  fadeIn: { min: 0, max: 5000, default: 0, step: 100 },
  fadeOut: { min: 0, max: 5000, default: 0, step: 100 },
  pan: { min: -100, max: 100, default: 0 },
  ducking: { threshold: -20, amount: 50 },
};

// ==================== KEYFRAME INTERPOLATION ====================
export const INTERPOLATION_TYPES = {
  LINEAR: 'linear',
  EASE_IN: 'easeIn',
  EASE_OUT: 'easeOut',
  EASE_IN_OUT: 'easeInOut',
  HOLD: 'hold',
  BEZIER: 'bezier',
};

export const INTERPOLATION_LABELS = {
  [INTERPOLATION_TYPES.LINEAR]: 'Linear',
  [INTERPOLATION_TYPES.EASE_IN]: 'Ease In',
  [INTERPOLATION_TYPES.EASE_OUT]: 'Ease Out',
  [INTERPOLATION_TYPES.EASE_IN_OUT]: 'Ease In Out',
  [INTERPOLATION_TYPES.HOLD]: 'Hold',
  [INTERPOLATION_TYPES.BEZIER]: 'Bezier',
};

// ==================== KEYFRAMEABLE PROPERTIES ====================
export const KEYFRAME_PROPERTIES = [
  { key: 'positionX', label: 'Position X', unit: 'px' },
  { key: 'positionY', label: 'Position Y', unit: 'px' },
  { key: 'scaleX', label: 'Scale X', unit: '%', default: 100 },
  { key: 'scaleY', label: 'Scale Y', unit: '%', default: 100 },
  { key: 'rotation', label: 'Rotation', unit: 'deg' },
  { key: 'opacity', label: 'Opacity', unit: '%', default: 100 },
  { key: 'volume', label: 'Volume', unit: '%', default: 100 },
  { key: 'blur', label: 'Blur', unit: 'px' },
  { key: 'brightness', label: 'Brightness', unit: '%', default: 100 },
  { key: 'contrast', label: 'Contrast', unit: '%', default: 100 },
];

// ==================== TIMELINE SETTINGS ====================
export const TIMELINE_SETTINGS = {
  MIN_ZOOM: 0.1,
  MAX_ZOOM: 10,
  DEFAULT_ZOOM: 1,
  ZOOM_STEP: 0.1,
  SNAP_THRESHOLD: 10,
  HANDLE_SIZE: 12,
  TRACK_HEIGHT: 60,
  MINIMAP_HEIGHT: 40,
  TIME_RULER_HEIGHT: 32,
  CLIP_MIN_WIDTH: 20,
  PLAYHEAD_WIDTH: 2,
  WAVEFORM_RESOLUTION: 2,
  THUMBNAIL_INTERVAL: 5000, // ms
};

// ==================== EXPORT PRESETS ====================
export const EXPORT_FORMATS = [
  { id: 'mp4-h264', label: 'MP4 (H.264)', mime: 'video/mp4', codec: 'avc1.42E01E' },
  { id: 'webm-vp9', label: 'WebM (VP9)', mime: 'video/webm', codec: 'vp09.00.10.08' },
];

export const EXPORT_QUALITY = [
  { id: 'high', label: 'High Quality', bitrate: 8000000, label: '8 Mbps' },
  { id: 'medium', label: 'Medium Quality', bitrate: 4000000, label: '4 Mbps' },
  { id: 'low', label: 'Low Quality', bitrate: 2000000, label: '2 Mbps' },
  { id: 'web', label: 'Web Optimized', bitrate: 1500000, label: '1.5 Mbps' },
];

// ==================== VIDEO AI TOOLS ====================
export const VIDEO_AI_TOOLS = [
  { id: 'auto-cut', title: 'Auto Cut', description: 'Automatically detect and cut scenes', icon: 'scissors', credits: 2 },
  { id: 'silence-remove', title: 'Remove Silence', description: 'Remove silent parts from video', icon: 'volume-x', credits: 1 },
  { id: 'highlight', title: 'Highlight Reel', description: 'Generate highlight clips', icon: 'star', credits: 3 },
  { id: 'shorts', title: 'Shorts Generator', description: 'Create short-form content', icon: 'smartphone', credits: 2 },
  { id: 'subtitles-auto', title: 'Auto Subtitles', description: 'Generate subtitles with AI', icon: 'type', credits: 2 },
  { id: 'upscale', title: 'Upscale', description: 'Increase video resolution', icon: 'maximize', credits: 4 },
  { id: 'stabilize', title: 'Stabilize', description: 'Reduce camera shake', icon: 'activity', credits: 2 },
  { id: 'color-grade', title: 'AI Color Grade', description: 'Professional color grading', icon: 'palette', credits: 3 },
  { id: 'enhance', title: 'Enhance', description: 'Improve video quality', icon: 'sparkles', credits: 2 },
  { id: 'crop-smart', title: 'Smart Crop', description: 'AI-powered auto-cropping', icon: 'crop', credits: 2 },
];

// ==================== SUBTITLE PRESETS ====================
export const SUBTITLE_PRESETS = [
  { id: 'default', name: 'Default', fontFamily: 'Poppins', fontSize: 24, color: '#FFFFFF', bgColor: 'rgba(0,0,0,0.7)', position: 'bottom' },
  { id: 'modern', name: 'Modern', fontFamily: 'Inter', fontSize: 20, color: '#FFFFFF', bgColor: 'transparent', position: 'bottom' },
  { id: 'minimal', name: 'Minimal', fontFamily: 'Roboto', fontSize: 18, color: '#FFFFFF', bgColor: 'transparent', position: 'center' },
  { id: 'bold', name: 'Bold', fontFamily: 'Oswald', fontSize: 28, color: '#000000', bgColor: '#FFFFFF', position: 'bottom' },
  { id: 'neon', name: 'Neon', fontFamily: 'Orbitron', fontSize: 22, color: '#00FFFF', bgColor: 'transparent', position: 'bottom' },
  { id: 'retro', name: 'Retro', fontFamily: 'Righteous', fontSize: 24, color: '#FFD700', bgColor: 'rgba(0,0,0,0.8)', position: 'bottom' },
];

// ==================== KEYBOARD SHORTCUTS ====================
export const VIDEO_SHORTCUTS = {
  UNDO: { key: 'z', ctrl: true },
  REDO: { key: 'z', ctrl: true, shift: true },
  REDO_ALT: { key: 'y', ctrl: true },
  SAVE: { key: 's', ctrl: true },
  DELETE: { key: 'Delete', ctrl: false },
  BACKSPACE: { key: 'Backspace', ctrl: false },
  DUPLICATE: { key: 'd', ctrl: true },
  SELECT_ALL: { key: 'a', ctrl: true },
  DESELECT: { key: 'Escape', ctrl: false },
  SPLIT: { key: 's', ctrl: true, shift: true },
  PLAY_PAUSE: { key: ' ', ctrl: false },
  STEP_FORWARD: { key: 'ArrowRight', ctrl: false },
  STEP_BACKWARD: { key: 'ArrowLeft', ctrl: false },
  JUMP_START: { key: 'Home', ctrl: false },
  JUMP_END: { key: 'End', ctrl: false },
  ZOOM_IN: { key: '=', ctrl: true },
  ZOOM_OUT: { key: '-', ctrl: true },
  FIT_TIMELINE: { key: '0', ctrl: true },
  TOGGLE_FULLSCREEN: { key: 'f', ctrl: false },
  MARK_IN: { key: 'i', ctrl: true },
  MARK_OUT: { key: 'o', ctrl: true },
  ADD_MARKER: { key: 'm', ctrl: true },
  RENDER: { key: 'r', ctrl: true },
  IMPORT: { key: 'i', ctrl: true },
};

// ==================== ANIMATION CONFIG ====================
export const VIDEO_ANIMATION = {
  spring: {
    card: { damping: 25, stiffness: 300, mass: 0.8 },
    button: { damping: 20, stiffness: 400, mass: 0.5 },
    timeline: { damping: 30, stiffness: 200, mass: 1 },
    clip: { damping: 15, stiffness: 400, mass: 0.3 },
  },
  duration: {
    fast: 150,
    normal: 250,
    slow: 400,
  },
  easing: [0.175, 0.885, 0.32, 1.275],
};

// ==================== LAYOUT METRICS ====================
export const VIDEO_LAYOUT = {
  topBar: { height: 64, padding: 16 },
  closeButton: { size: 24, hitArea: 44 },
  saveButton: { height: 44, width: 100, radius: 22 },
  toolButton: { hitArea: 44, icon: 22 },
  leftPanel: { width: 72, expandedWidth: 280, padding: 12 },
  rightPanel: { width: 320, padding: 16 },
  preview: { padding: 16, minHeight: 300 },
  timeline: { height: 280, minHeight: 200, maxHeight: 500 },
  modal: { maxWidth: '100vw', maxHeight: '100vh', padding: 0 },
};

// ==================== PERFORMANCE SETTINGS ====================
export const VIDEO_PERFORMANCE = {
  DEBOUNCE_SLIDERS: 50,
  THROTTLE_DRAG: 16,
  MAX_HISTORY: 100,
  AUTO_SAVE_INTERVAL: 10000,
  PREVIEW_FPS: 30,
  EXPORT_FPS: 30,
  THUMBNAIL_SIZE: 120,
  WAVEFORM_SAMPLES: 1000,
  MAX_UNDO_STACK: 100,
  ZOOM_SENSITIVITY: 0.1,
  PLAYBACK_AHEAD: 2, // seconds
};

// ==================== ERROR MESSAGES ====================
export const VIDEO_ERRORS = {
  VIDEO_LOAD: 'Failed to load video. Please try again.',
  VIDEO_DECODE: 'Failed to decode video. The file may be corrupted.',
  EXPORT_FAILED: 'Failed to export video. Please try again.',
  STORAGE_QUOTA: 'Storage quota exceeded. Please free up space.',
  OFFLINE_SAVE: 'Unable to save while offline.',
  RENDER_FAILED: 'Video rendering failed. Please try again.',
  AUDIO_DECODE: 'Failed to decode audio track.',
  UNKNOWN: 'An unexpected error occurred.',
};

// ==================== TIMELINE COLOR SCHEMES ====================
export const TRACK_COLORS = {
  video: { bg: '#3B82F6', text: '#FFFFFF' },
  audio: { bg: '#22C55E', text: '#FFFFFF' },
  overlay: { bg: '#8B5CF6', text: '#FFFFFF' },
  subtitle: { bg: '#F59E0B', text: '#000000' },
  effect: { bg: '#EC4899', text: '#FFFFFF' },
};

// ==================== UTILITY FUNCTIONS ====================

/**
 * Generate unique ID for video elements
 */
export function generateVideoId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `video_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Format time in milliseconds to MM:SS:FF format
 */
export function formatTimecode(ms, fps = 30) {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const frames = Math.floor((ms % 1000) / (1000 / fps));
  
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}:${String(frames).padStart(2, '0')}`;
}

/**
 * Format time in milliseconds to MM:SS format
 */
export function formatTime(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

/**
 * Parse time string to milliseconds
 */
export function parseTime(timeStr) {
  const parts = timeStr.split(':').map(Number);
  if (parts.length === 3) {
    const [minutes, seconds, frames] = parts;
    return (minutes * 60 + seconds) * 1000 + (frames * (1000 / 30));
  } else if (parts.length === 2) {
    const [minutes, seconds] = parts;
    return (minutes * 60 + seconds) * 1000;
  }
  return 0;
}

/**
 * Clamp value between min and max
 */
export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

/**
 * Linear interpolation
 */
export function lerp(start, end, t) {
  return start + (end - start) * t;
}

/**
 * Map value from one range to another
 */
export function mapRange(value, inMin, inMax, outMin, outMax) {
  return ((value - inMin) * (outMax - outMin)) / (inMax - inMin) + outMin;
}

/**
 * Get safe file name
 */
export function getSafeFileName(name) {
  return name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
}
