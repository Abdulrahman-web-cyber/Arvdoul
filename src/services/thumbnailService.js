// src/services/thumbnailService.js – ARVDOUL THUMBNAIL DESIGNER SERVICE V1
// 🖼️ Professional Thumbnail Designer with Auto-generation, Editor, Export
// ✅ Canvas-based Editing • Text Overlays • Filters • Export Presets

import { getStorageInstance } from '../firebase/firebase.js';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { v4 as uuidv4 } from 'uuid';

// ==================== CONFIGURATION ====================
export const THUMBNAIL_CONFIG = {
  PRESETS: [
    { id: 'youtube', name: 'YouTube', width: 1280, height: 720, aspectRatio: '16:9' },
    { id: 'youtube-shorts', name: 'YouTube Shorts', width: 1080, height: 1920, aspectRatio: '9:16' },
    { id: 'instagram', name: 'Instagram Post', width: 1080, height: 1080, aspectRatio: '1:1' },
    { id: 'instagram-story', name: 'Instagram Story', width: 1080, height: 1920, aspectRatio: '9:16' },
    { id: 'twitter', name: 'Twitter Card', width: 1200, height: 675, aspectRatio: '16:9' },
    { id: 'facebook', name: 'Facebook Post', width: 1200, height: 630, aspectRatio: '16:9' },
    { id: 'linkedin', name: 'LinkedIn Post', width: 1200, height: 627, aspectRatio: '16:9' },
    { id: 'tiktok', name: 'TikTok', width: 1080, height: 1920, aspectRatio: '9:16' },
  ],
  FONTS: [
    'Arial', 'Helvetica', 'Times New Roman', 'Georgia', 'Verdana',
    'Impact', 'Comic Sans MS', 'Trebuchet MS', 'Courier New', 'Bebas Neue',
    'Montserrat', 'Roboto', 'Open Sans', 'Lato', 'Poppins',
  ],
  COLORS: [
    '#FFFFFF', '#000000', '#FF0000', '#00FF00', '#0000FF', '#FFFF00',
    '#FF00FF', '#00FFFF', '#FFA500', '#800080', '#FFC0CB', '#A52A2A',
    '#808080', '#000080', '#008000', '#FFD700', '#FF4500', '#DC143C',
  ],
  BACKGROUNDS: [
    { id: 'solid', name: 'Solid Color', types: ['#1a1a2e', '#16213e', '#0f3460', '#e94560', '#533483'] },
    { id: 'gradient', name: 'Gradient', types: ['linear-gradient(135deg, #667eea 0%, #764ba2 100%)', 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)', 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)'] },
    { id: 'pattern', name: 'Patterns', types: ['dots', 'stripes', 'grid', 'waves'] },
  ],
  TEXT_STYLES: {
    HEADLINE: { fontSize: 48, weight: 'bold', shadow: true, outline: true },
    SUBHEADLINE: { fontSize: 32, weight: 'bold', shadow: true, outline: false },
    BODY: { fontSize: 24, weight: 'normal', shadow: false, outline: false },
    CAPTION: { fontSize: 18, weight: 'normal', shadow: false, outline: false },
  },
  FILTERS: [
    { id: 'none', name: 'None', css: '' },
    { id: 'brightness', name: 'Bright', css: 'brightness(1.2)' },
    { id: 'contrast', name: 'High Contrast', css: 'contrast(1.3)' },
    { id: 'saturate', name: 'Vivid', css: 'saturate(1.5)' },
    { id: 'grayscale', name: 'B&W', css: 'grayscale(1)' },
    { id: 'sepia', name: 'Vintage', css: 'sepia(0.5)' },
    { id: 'blur', name: 'Blur', css: 'blur(2px)' },
  ],
  STICKERS: [
    { id: 'fire', icon: '🔥', name: 'Fire' },
    { id: 'star', icon: '⭐', name: 'Star' },
    { id: 'heart', icon: '❤️', name: 'Heart' },
    { id: 'thumbsup', icon: '👍', name: 'Thumbs Up' },
    { id: '100', icon: '💯', name: '100' },
    { id: 'sparkles', icon: '✨', name: 'Sparkles' },
    { id: 'rocket', icon: '🚀', name: 'Rocket' },
    { id: 'trophy', icon: '🏆', name: 'Trophy' },
    { id: 'lightning', icon: '⚡', name: 'Lightning' },
    { id: 'crown', icon: '👑', name: 'Crown' },
  ],
  EXPORT_FORMATS: [
    { id: 'png', name: 'PNG', extension: 'png', mimeType: 'image/png' },
    { id: 'jpg', name: 'JPEG', extension: 'jpg', mimeType: 'image/jpeg' },
    { id: 'webp', name: 'WebP', extension: 'webp', mimeType: 'image/webp' },
  ],
  QUALITY: [0.5, 0.75, 0.9, 1.0],
};

// ==================== CUSTOM ERROR ====================
export class ThumbnailError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'ThumbnailError';
    this.code = `thumbnail/${code}`;
    this.details = details;
    this.timestamp = new Date().toISOString();
  }
}

// ==================== THUMBNAIL SERVICE ====================
class ThumbnailService {
  constructor() {
    this.storage = null;
    this.initialized = false;
    this.initPromise = null;
    this.currentThumbnail = null;
    this.listeners = new Map();
  }

  async initialize() {
    if (this.initialized) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = (async () => {
      try {
        this.storage = getStorageInstance();
        this.initialized = true;
        console.log('[ThumbnailService] Initialized successfully');
      } catch (error) {
        console.error('[ThumbnailService] Initialization failed:', error);
        throw error;
      }
    })();

    return this.initPromise;
  }

  async ensureInitialized() {
    if (!this.initialized) await this.initialize();
  }

  // ==================== PROJECT MANAGEMENT ====================
  createThumbnail(metadata = {}) {
    const thumbnailId = uuidv4();
    const preset = metadata.preset || THUMBNAIL_CONFIG.PRESETS[0];
    
    const thumbnail = {
      id: thumbnailId,
      name: metadata.name || 'Untitled Thumbnail',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      width: preset.width,
      height: preset.height,
      aspectRatio: preset.aspectRatio,
      preset: preset.id,
      background: {
        type: 'solid',
        color: '#1a1a2e',
        gradient: null,
        pattern: null,
        imageUrl: null,
      },
      elements: [],
      filter: 'none',
      undoStack: [],
      redoStack: [],
    };
    
    this.currentThumbnail = thumbnail;
    return thumbnail;
  }

  loadThumbnail(thumbnailData) {
    if (!thumbnailData || !thumbnailData.id) {
      throw new ThumbnailError('invalid_thumbnail', 'Invalid thumbnail data');
    }
    this.currentThumbnail = { ...thumbnailData, undoStack: [], redoStack: [] };
    return this.currentThumbnail;
  }

  getCurrentThumbnail() {
    return this.currentThumbnail;
  }

  setPreset(presetId) {
    if (!this.currentThumbnail) {
      throw new ThumbnailError('no_thumbnail', 'No thumbnail loaded');
    }

    const preset = THUMBNAIL_CONFIG.PRESETS.find(p => p.id === presetId);
    if (!preset) {
      throw new ThumbnailError('unknown_preset', `Unknown preset: ${presetId}`);
    }

    this.currentThumbnail.width = preset.width;
    this.currentThumbnail.height = preset.height;
    this.currentThumbnail.aspectRatio = preset.aspectRatio;
    this.currentThumbnail.preset = presetId;
    this._pushUndo();

    return this.currentThumbnail;
  }

  // ==================== BACKGROUND MANAGEMENT ====================
  setBackground(backgroundData) {
    if (!this.currentThumbnail) {
      throw new ThumbnailError('no_thumbnail', 'No thumbnail loaded');
    }

    this.currentThumbnail.background = {
      ...this.currentThumbnail.background,
      ...backgroundData,
    };
    this._pushUndo();

    return this.currentThumbnail.background;
  }

  setBackgroundImage(imageUrl) {
    return this.setBackground({
      type: 'image',
      imageUrl,
      color: null,
      gradient: null,
    });
  }

  setBackgroundColor(color) {
    return this.setBackground({
      type: 'solid',
      color,
      imageUrl: null,
      gradient: null,
    });
  }

  setBackgroundGradient(gradient) {
    return this.setBackground({
      type: 'gradient',
      gradient,
      color: null,
      imageUrl: null,
    });
  }

  // ==================== ELEMENT MANAGEMENT ====================
  addTextElement(textData) {
    if (!this.currentThumbnail) {
      throw new ThumbnailError('no_thumbnail', 'No thumbnail loaded');
    }

    const element = {
      id: uuidv4(),
      type: 'text',
      x: textData.x ?? 50, // percentage
      y: textData.y ?? 50,
      width: textData.width ?? 80,
      height: textData.height ?? 20,
      rotation: textData.rotation ?? 0,
      opacity: textData.opacity ?? 1,
      text: textData.text || 'Text',
      font: textData.font || 'Arial',
      fontSize: textData.fontSize || 48,
      fontWeight: textData.fontWeight || 'bold',
      color: textData.color || '#FFFFFF',
      strokeColor: textData.strokeColor || '#000000',
      strokeWidth: textData.strokeWidth || 2,
      textAlign: textData.textAlign || 'center',
      shadow: textData.shadow ?? true,
      shadowColor: textData.shadowColor || 'rgba(0,0,0,0.5)',
      shadowBlur: textData.shadowBlur || 4,
      shadowOffsetX: textData.shadowOffsetX || 2,
      shadowOffsetY: textData.shadowOffsetY || 2,
    };

    this.currentThumbnail.elements.push(element);
    this._pushUndo();

    return element;
  }

  updateElement(elementId, updates) {
    if (!this.currentThumbnail) {
      throw new ThumbnailError('no_thumbnail', 'No thumbnail loaded');
    }

    const element = this.currentThumbnail.elements.find(e => e.id === elementId);
    if (!element) {
      throw new ThumbnailError('element_not_found', 'Element not found');
    }

    Object.assign(element, updates);
    this._pushUndo();

    return element;
  }

  deleteElement(elementId) {
    if (!this.currentThumbnail) {
      throw new ThumbnailError('no_thumbnail', 'No thumbnail loaded');
    }

    const index = this.currentThumbnail.elements.findIndex(e => e.id === elementId);
    if (index === -1) {
      throw new ThumbnailError('element_not_found', 'Element not found');
    }

    this.currentThumbnail.elements.splice(index, 1);
    this._pushUndo();

    return true;
  }

  duplicateElement(elementId) {
    if (!this.currentThumbnail) {
      throw new ThumbnailError('no_thumbnail', 'No thumbnail loaded');
    }

    const element = this.currentThumbnail.elements.find(e => e.id === elementId);
    if (!element) {
      throw new ThumbnailError('element_not_found', 'Element not found');
    }

    const duplicate = {
      ...JSON.parse(JSON.stringify(element)),
      id: uuidv4(),
      x: element.x + 5,
      y: element.y + 5,
    };

    this.currentThumbnail.elements.push(duplicate);
    this._pushUndo();

    return duplicate;
  }

  // ==================== STICKER MANAGEMENT ====================
  addSticker(stickerData) {
    if (!this.currentThumbnail) {
      throw new ThumbnailError('no_thumbnail', 'No thumbnail loaded');
    }

    const element = {
      id: uuidv4(),
      type: 'sticker',
      x: stickerData.x ?? 50,
      y: stickerData.y ?? 50,
      width: stickerData.width ?? 10,
      height: stickerData.height ?? 10,
      rotation: stickerData.rotation ?? 0,
      opacity: stickerData.opacity ?? 1,
      icon: stickerData.icon || '⭐',
      emoji: stickerData.emoji || stickerData.icon,
      scale: stickerData.scale || 1,
    };

    this.currentThumbnail.elements.push(element);
    this._pushUndo();

    return element;
  }

  // ==================== IMAGE MANAGEMENT ====================
  addImage(imageData) {
    if (!this.currentThumbnail) {
      throw new ThumbnailError('no_thumbnail', 'No thumbnail loaded');
    }

    const element = {
      id: uuidv4(),
      type: 'image',
      x: imageData.x ?? 10,
      y: imageData.y ?? 10,
      width: imageData.width ?? 30,
      height: imageData.height ?? 30,
      rotation: imageData.rotation ?? 0,
      opacity: imageData.opacity ?? 1,
      src: imageData.src,
      fit: imageData.fit || 'cover',
    };

    this.currentThumbnail.elements.push(element);
    this._pushUndo();

    return element;
  }

  // ==================== FILTER MANAGEMENT ====================
  setFilter(filterId) {
    if (!this.currentThumbnail) {
      throw new ThumbnailError('no_thumbnail', 'No thumbnail loaded');
    }

    const filter = THUMBNAIL_CONFIG.FILTERS.find(f => f.id === filterId);
    if (!filter) {
      throw new ThumbnailError('unknown_filter', `Unknown filter: ${filterId}`);
    }

    this.currentThumbnail.filter = filterId;
    this._pushUndo();

    return this.currentThumbnail.filter;
  }

  // ==================== AUTO-GENERATION ====================
  generateThumbnailsFromVideo(videoUrl, frameCount = 5) {
    // Placeholder for auto-generation from video frames
    // In production, this would use video frame extraction
    console.log('[ThumbnailService] Generating thumbnails from video:', videoUrl);
    
    const thumbnails = [];
    for (let i = 0; i < frameCount; i++) {
      thumbnails.push({
        id: uuidv4(),
        timestamp: i * (10 / frameCount),
        url: null, // Would be actual frame URL
        selected: false,
      });
    }
    
    return thumbnails;
  }

  // ==================== EXPORT ====================
  async exportThumbnail(format = 'png', quality = 0.9, canvasElement) {
    if (!this.currentThumbnail) {
      throw new ThumbnailError('no_thumbnail', 'No thumbnail loaded');
    }

    if (!canvasElement) {
      throw new ThumbnailError('no_canvas', 'No canvas element provided');
    }

    const formatConfig = THUMBNAIL_CONFIG.EXPORT_FORMATS.find(f => f.id === format);
    
    return new Promise((resolve) => {
      const mimeType = formatConfig.mimeType;
      const dataUrl = canvasElement.toDataURL(mimeType, quality);
      
      resolve({
        success: true,
        id: this.currentThumbnail.id,
        format: formatConfig,
        dataUrl,
        width: this.currentThumbnail.width,
        height: this.currentThumbnail.height,
        estimatedSize: Math.round(dataUrl.length * 0.75),
      });
    });
  }

  async uploadThumbnail(canvasElement, userId, format = 'png') {
    await this.ensureInitialized();

    const formatConfig = THUMBNAIL_CONFIG.EXPORT_FORMATS.find(f => f.id === format);
    const thumbnailId = this.currentThumbnail?.id || uuidv4();
    
    // Convert canvas to blob
    const blob = await new Promise((resolve) => {
      canvasElement.toBlob(resolve, formatConfig.mimeType);
    });

    const storagePath = `thumbnails/${userId}/${thumbnailId}.${formatConfig.extension}`;
    const storageRef = ref(this.storage, storagePath);

    const snapshot = await uploadBytes(storageRef, blob);
    const downloadUrl = await getDownloadURL(snapshot.ref);

    return {
      id: thumbnailId,
      url: downloadUrl,
      path: storagePath,
      size: blob.size,
      format: formatConfig.id,
      width: this.currentThumbnail?.width,
      height: this.currentThumbnail?.height,
    };
  }

  // ==================== UNDO/REDO ====================
  _pushUndo() {
    if (!this.currentThumbnail) return;

    const snapshot = JSON.stringify({
      background: this.currentThumbnail.background,
      elements: this.currentThumbnail.elements,
      filter: this.currentThumbnail.filter,
    });

    this.currentThumbnail.undoStack.push(snapshot);
    if (this.currentThumbnail.undoStack.length > 50) {
      this.currentThumbnail.undoStack.shift();
    }
    this.currentThumbnail.redoStack = [];
  }

  undo() {
    if (!this.currentThumbnail || this.currentThumbnail.undoStack.length === 0) {
      return null;
    }

    const current = JSON.stringify({
      background: this.currentThumbnail.background,
      elements: this.currentThumbnail.elements,
      filter: this.currentThumbnail.filter,
    });

    this.currentThumbnail.redoStack.push(current);

    const previous = JSON.parse(this.currentThumbnail.undoStack.pop());
    Object.assign(this.currentThumbnail, previous);

    return this.currentThumbnail;
  }

  redo() {
    if (!this.currentThumbnail || this.currentThumbnail.redoStack.length === 0) {
      return null;
    }

    const current = JSON.stringify({
      background: this.currentThumbnail.background,
      elements: this.currentThumbnail.elements,
      filter: this.currentThumbnail.filter,
    });

    this.currentThumbnail.undoStack.push(current);

    const next = JSON.parse(this.currentThumbnail.redoStack.pop());
    Object.assign(this.currentThumbnail, next);

    return this.currentThumbnail;
  }

  canUndo() {
    return this.currentThumbnail && this.currentThumbnail.undoStack.length > 0;
  }

  canRedo() {
    return this.currentThumbnail && this.currentThumbnail.redoStack.length > 0;
  }

  // ==================== EVENT LISTENERS ====================
  addChangeListener(id, callback) {
    this.listeners.set(id, callback);
  }

  removeChangeListener(id) {
    this.listeners.delete(id);
  }

  _notifyChange(type, data) {
    for (const callback of this.listeners.values()) {
      callback(type, data);
    }
  }

  // ==================== SERVICE MANAGEMENT ====================
  getStats() {
    return {
      initialized: this.initialized,
      hasThumbnail: !!this.currentThumbnail,
      thumbnailId: this.currentThumbnail?.id,
      elementCount: this.currentThumbnail?.elements.length || 0,
      listenerCount: this.listeners.size,
    };
  }

  destroy() {
    this.listeners.clear();
    this.currentThumbnail = null;
    this.initialized = false;
    this.initPromise = null;
    console.warn('[ThumbnailService] Destroyed');
  }
}

// ==================== SINGLETON EXPORT ====================
let instance = null;
export function getThumbnailService() {
  if (!instance) instance = new ThumbnailService();
  return instance;
}

const thumbnailService = {
  initialize: () => getThumbnailService().initialize(),
  ensureInitialized: () => getThumbnailService().ensureInitialized(),
  createThumbnail: (m) => getThumbnailService().createThumbnail(m),
  loadThumbnail: (d) => getThumbnailService().loadThumbnail(d),
  getCurrentThumbnail: () => getThumbnailService().getCurrentThumbnail(),
  setPreset: (id) => getThumbnailService().setPreset(id),
  setBackground: (d) => getThumbnailService().setBackground(d),
  setBackgroundImage: (url) => getThumbnailService().setBackgroundImage(url),
  setBackgroundColor: (c) => getThumbnailService().setBackgroundColor(c),
  setBackgroundGradient: (g) => getThumbnailService().setBackgroundGradient(g),
  addTextElement: (d) => getThumbnailService().addTextElement(d),
  updateElement: (id, u) => getThumbnailService().updateElement(id, u),
  deleteElement: (id) => getThumbnailService().deleteElement(id),
  duplicateElement: (id) => getThumbnailService().duplicateElement(id),
  addSticker: (d) => getThumbnailService().addSticker(d),
  addImage: (d) => getThumbnailService().addImage(d),
  setFilter: (id) => getThumbnailService().setFilter(id),
  generateThumbnailsFromVideo: (url, c) => getThumbnailService().generateThumbnailsFromVideo(url, c),
  exportThumbnail: (f, q, c) => getThumbnailService().exportThumbnail(f, q, c),
  uploadThumbnail: (c, uid, f) => getThumbnailService().uploadThumbnail(c, uid, f),
  undo: () => getThumbnailService().undo(),
  redo: () => getThumbnailService().redo(),
  canUndo: () => getThumbnailService().canUndo(),
  canRedo: () => getThumbnailService().canRedo(),
  addChangeListener: (id, cb) => getThumbnailService().addChangeListener(id, cb),
  removeChangeListener: (id) => getThumbnailService().removeChangeListener(id),
  getStats: () => getThumbnailService().getStats(),
  destroy: () => getThumbnailService().destroy(),
  getService: getThumbnailService,
};

export default thumbnailService;
