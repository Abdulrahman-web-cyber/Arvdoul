// src/services/videoEditorService.js – ARVDOUL VIDEO EDITOR SERVICE V1
// 🎬 Professional Video Editor with Timeline, Trim, Split, Transitions, Filters
// ✅ Timeline Management • Clip Operations • Text Overlays • Stickers
// ✅ Filters & Effects • Audio Tracks • Captions • Export Presets

import { getStorageInstance } from '../firebase/firebase.js';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { v4 as uuidv4 } from 'uuid';

// ==================== CONFIGURATION ====================
export const VIDEO_EDITOR_CONFIG = {
  TIMELINE: {
    DEFAULT_ZOOM: 1,
    MIN_ZOOM: 0.1,
    MAX_ZOOM: 10,
    SNAP_THRESHOLD: 10,
    MIN_CLIP_DURATION: 0.5,
    MAX_CLIPS: 100,
    MAX_TRACKS: 10,
  },
  TRANSITIONS: {
    TYPES: [
      'none',
      'fade',
      'slide_left',
      'slide_right',
      'slide_up',
      'slide_down',
      'zoom_in',
      'zoom_out',
      'wipe_left',
      'wipe_right',
      'dissolve',
      'blur',
      'crossfade',
      'flash',
    ],
    DEFAULT_DURATION: 0.5,
    MIN_DURATION: 0.1,
    MAX_DURATION: 2,
  },
  FILTERS: {
    NONE: 'none',
    BUILT_IN: [
      { id: 'vintage', name: 'Vintage', css: 'sepia(0.4) contrast(1.1) brightness(0.9)' },
      { id: 'bw', name: 'B&W', css: 'grayscale(1) contrast(1.1)' },
      { id: 'warm', name: 'Warm', css: 'sepia(0.3) saturate(1.3) brightness(1.05)' },
      { id: 'cool', name: 'Cool', css: 'saturate(0.9) hue-rotate(15deg) brightness(1.05)' },
      { id: 'cinematic', name: 'Cinematic', css: 'contrast(1.2) saturate(0.9) brightness(0.95) sepia(0.2)' },
      { id: 'vivid', name: 'Vivid', css: 'saturate(1.5) contrast(1.2)' },
      { id: 'muted', name: 'Muted', css: 'saturate(0.7) contrast(0.9)' },
      { id: 'dramatic', name: 'Dramatic', css: 'contrast(1.4) brightness(0.9) saturate(1.2)' },
      { id: 'fade', name: 'Fade', css: 'contrast(0.9) brightness(1.1) saturate(0.8)' },
      { id: 'noir', name: 'Noir', css: 'grayscale(1) contrast(1.5) brightness(0.9)' },
      { id: 'blur', name: 'Blur', css: 'blur(1px)' },
      { id: 'sharpen', name: 'Sharpen', css: '' },
    ],
  },
  TEXT: {
    FONTS: [
      'Arial',
      'Helvetica',
      'Times New Roman',
      'Georgia',
      'Verdana',
      'Impact',
      'Comic Sans MS',
      'Trebuchet MS',
      'Courier New',
    ],
    SIZES: [12, 14, 16, 18, 20, 24, 28, 32, 40, 48, 56, 64, 72],
    COLORS: [
      '#FFFFFF', '#000000', '#FF0000', '#00FF00', '#0000FF',
      '#FFFF00', '#FF00FF', '#00FFFF', '#FFA500', '#800080',
      '#FFC0CB', '#A52A2A', '#808080', '#000080', '#008000',
    ],
    STYLES: ['normal', 'bold', 'italic', 'bold_italic'],
    POSITIONS: ['top', 'center', 'bottom', 'top_left', 'top_right', 'bottom_left', 'bottom_right'],
    MAX_OVERLAYS: 20,
  },
  STICKERS: {
    CATEGORIES: [
      { id: 'emoji', name: 'Emoji', icons: ['😀', '😎', '🔥', '❤️', '👍', '🎉', '💯', '✨', '🚀', '💪'] },
      { id: 'shapes', name: 'Shapes', icons: ['⬜', '⬛', '🔴', '🔵', '🟢', '🟡', '⭐', '💎', '🎯', '🏆'] },
      { id: 'effects', name: 'Effects', icons: ['💫', '✨', '🌟', '💥', '🎊', '🎈', '🎁', '🎀', '🌈', '⚡'] },
      { id: 'arrows', name: 'Arrows', icons: ['➡️', '⬅️', '⬆️', '⬇️', '↗️', '↘️', '↙️', '↖️', '🔄', '➕'] },
    ],
    MAX_STICKERS: 50,
  },
  AUDIO: {
    MAX_TRACKS: 10,
    MAX_VOLUME: 2,
    MIN_VOLUME: 0,
    FADE_DURATION: 0.5,
  },
  CAPTIONS: {
    MAX_LENGTH: 500,
    LANGUAGES: ['en', 'es', 'fr', 'de', 'it', 'pt', 'zh', 'ja', 'ko'],
    STYLES: ['default', 'modern', 'classic', 'subtitle', 'highlight'],
    POSITIONS: ['bottom', 'top', 'middle'],
  },
  EXPORT: {
    PRESETS: [
      { id: '4k', name: '4K (2160p)', width: 3840, height: 2160, bitrate: 45000, fps: 30 },
      { id: '1080p', name: 'Full HD (1080p)', width: 1920, height: 1080, bitrate: 8000, fps: 30 },
      { id: '720p', name: 'HD (720p)', width: 1280, height: 720, bitrate: 5000, fps: 30 },
      { id: '480p', name: 'SD (480p)', width: 854, height: 480, bitrate: 2500, fps: 30 },
      { id: 'reel', name: 'Reel (9:16)', width: 1080, height: 1920, bitrate: 6000, fps: 30 },
      { id: 'story', name: 'Story (9:16)', width: 1080, height: 1920, bitrate: 6000, fps: 30 },
      { id: 'square', name: 'Square (1:1)', width: 1080, height: 1080, bitrate: 5000, fps: 30 },
      { id: 'portrait', name: 'Portrait (4:5)', width: 1080, height: 1350, bitrate: 5000, fps: 30 },
    ],
    FORMAT: 'mp4',
    CODEC: 'h264',
    AUDIO_CODEC: 'aac',
    AUDIO_BITRATE: 192,
    MAX_DURATION: 3600,
  },
  COLORS: {
    PRIMARY: '#6366f1',
    SECONDARY: '#8b5cf6',
    ACCENT: '#ec4899',
    TIMELINE_BG: '#1a1a2e',
    TRACK_BG: '#16213e',
    CLIP_COLORS: ['#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#f97316', '#eab308', '#22c55e', '#14b8a6', '#06b6d4', '#3b82f6'],
  },
};

// ==================== CUSTOM ERROR ====================
export class VideoEditorError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'VideoEditorError';
    this.code = `video_editor/${code}`;
    this.details = details;
    this.timestamp = new Date().toISOString();
  }
}

// ==================== VIDEO EDITOR SERVICE ====================
class VideoEditorService {
  constructor() {
    this.storage = null;
    this.initialized = false;
    this.initPromise = null;
    this.currentProject = null;
    this.listeners = new Map();
  }

  async initialize() {
    if (this.initialized) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = (async () => {
      try {
        this.storage = getStorageInstance();
        this.initialized = true;
        console.log('[VideoEditorService] Initialized successfully');
      } catch (error) {
        console.error('[VideoEditorService] Initialization failed:', error);
        throw error;
      }
    })();

    return this.initPromise;
  }

  async ensureInitialized() {
    if (!this.initialized) await this.initialize();
  }

  // ==================== PROJECT MANAGEMENT ====================
  createProject(metadata = {}) {
    const projectId = uuidv4();
    const project = {
      id: projectId,
      name: metadata.name || 'Untitled Project',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      duration: 0,
      resolution: { width: 1920, height: 1080 },
      fps: 30,
      tracks: [
        {
          id: uuidv4(),
          type: 'video',
          name: 'Video',
          clips: [],
          muted: false,
          locked: false,
          visible: true,
        },
        {
          id: uuidv4(),
          type: 'audio',
          name: 'Audio',
          clips: [],
          muted: false,
          locked: false,
          visible: true,
        },
        {
          id: uuidv4(),
          type: 'text',
          name: 'Text',
          overlays: [],
          muted: false,
          locked: false,
          visible: true,
        },
        {
          id: uuidv4(),
          type: 'sticker',
          name: 'Stickers',
          items: [],
          muted: false,
          locked: false,
          visible: true,
        },
      ],
      filters: [],
      transitions: [],
      captions: [],
      exportSettings: VIDEO_EDITOR_CONFIG.EXPORT.PRESETS[1], // 1080p default
      undoStack: [],
      redoStack: [],
    };
    this.currentProject = project;
    return project;
  }

  loadProject(projectData) {
    if (!projectData || !projectData.id) {
      throw new VideoEditorError('invalid_project', 'Invalid project data');
    }
    this.currentProject = { ...projectData, undoStack: [], redoStack: [] };
    return this.currentProject;
  }

  getCurrentProject() {
    return this.currentProject;
  }

  saveProject() {
    if (!this.currentProject) {
      throw new VideoEditorError('no_project', 'No project loaded');
    }
    const updatedProject = {
      ...this.currentProject,
      updatedAt: new Date().toISOString(),
    };
    this.currentProject = updatedProject;
    localStorage.setItem(`video_editor_project_${updatedProject.id}`, JSON.stringify(updatedProject));
    return updatedProject;
  }

  loadProjectFromStorage(projectId) {
    const data = localStorage.getItem(`video_editor_project_${projectId}`);
    if (!data) {
      throw new VideoEditorError('project_not_found', 'Project not found');
    }
    return this.loadProject(JSON.parse(data));
  }

  // ==================== CLIP MANAGEMENT ====================
  addClip(trackId, clipData) {
    if (!this.currentProject) {
      throw new VideoEditorError('no_project', 'No project loaded');
    }

    const track = this.currentProject.tracks.find(t => t.id === trackId);
    if (!track) {
      throw new VideoEditorError('track_not_found', 'Track not found');
    }

    const clip = {
      id: uuidv4(),
      sourceUrl: clipData.sourceUrl,
      sourceType: clipData.sourceType || 'video', // video, image
      startTime: clipData.startTime || 0,
      endTime: clipData.endTime || clipData.duration || 10,
      duration: clipData.duration || 10,
      trimStart: clipData.trimStart || 0,
      trimEnd: clipData.trimEnd || clipData.duration || 10,
      volume: clipData.volume !== undefined ? clipData.volume : 1,
      speed: clipData.speed || 1,
      filter: clipData.filter || 'none',
      position: { x: 0, y: 0 },
      scale: { x: 1, y: 1 },
      rotation: 0,
      opacity: 1,
    };

    track.clips.push(clip);
    this._recalculateDuration();
    this._pushUndo();

    return clip;
  }

  updateClip(trackId, clipId, updates) {
    if (!this.currentProject) {
      throw new VideoEditorError('no_project', 'No project loaded');
    }

    const track = this.currentProject.tracks.find(t => t.id === trackId);
    if (!track) {
      throw new VideoEditorError('track_not_found', 'Track not found');
    }

    const clipIndex = track.clips.findIndex(c => c.id === clipId);
    if (clipIndex === -1) {
      throw new VideoEditorError('clip_not_found', 'Clip not found');
    }

    track.clips[clipIndex] = { ...track.clips[clipIndex], ...updates };
    this._recalculateDuration();
    this._pushUndo();

    return track.clips[clipIndex];
  }

  deleteClip(trackId, clipId) {
    if (!this.currentProject) {
      throw new VideoEditorError('no_project', 'No project loaded');
    }

    const track = this.currentProject.tracks.find(t => t.id === trackId);
    if (!track) {
      throw new VideoEditorError('track_not_found', 'Track not found');
    }

    const clipIndex = track.clips.findIndex(c => c.id === clipId);
    if (clipIndex === -1) {
      throw new VideoEditorError('clip_not_found', 'Clip not found');
    }

    track.clips.splice(clipIndex, 1);
    this._recalculateDuration();
    this._pushUndo();

    return true;
  }

  splitClip(trackId, clipId, splitTime) {
    if (!this.currentProject) {
      throw new VideoEditorError('no_project', 'No project loaded');
    }

    const track = this.currentProject.tracks.find(t => t.id === trackId);
    if (!track) {
      throw new VideoEditorError('track_not_found', 'Track not found');
    }

    const clipIndex = track.clips.findIndex(c => c.id === clipId);
    if (clipIndex === -1) {
      throw new VideoEditorError('clip_not_found', 'Clip not found');
    }

    const clip = track.clips[clipIndex];
    const relativeTime = splitTime - clip.startTime;

    if (relativeTime <= 0 || relativeTime >= clip.duration) {
      throw new VideoEditorError('invalid_split', 'Split time must be within clip duration');
    }

    // Create second clip
    const secondClip = {
      ...clip,
      id: uuidv4(),
      startTime: splitTime,
      trimStart: clip.trimStart + relativeTime,
    };

    // Modify first clip
    clip.endTime = splitTime;
    clip.duration = relativeTime;
    clip.trimEnd = clip.trimStart + relativeTime;

    track.clips.splice(clipIndex + 1, 0, secondClip);
    this._pushUndo();

    return { firstClip: clip, secondClip };
  }

  trimClip(trackId, clipId, newTrimStart, newTrimEnd) {
    if (!this.currentProject) {
      throw new VideoEditorError('no_project', 'No project loaded');
    }

    const track = this.currentProject.tracks.find(t => t.id === trackId);
    if (!track) {
      throw new VideoEditorError('track_not_found', 'Track not found');
    }

    const clip = track.clips.find(c => c.id === clipId);
    if (!clip) {
      throw new VideoEditorError('clip_not_found', 'Clip not found');
    }

    const newDuration = newTrimEnd - newTrimStart;
    if (newDuration < VIDEO_EDITOR_CONFIG.TIMELINE.MIN_CLIP_DURATION) {
      throw new VideoEditorError('clip_too_short', 'Clip duration too short');
    }

    clip.trimStart = newTrimStart;
    clip.trimEnd = newTrimEnd;
    clip.duration = newDuration;
    clip.endTime = clip.startTime + newDuration;

    this._recalculateDuration();
    this._pushUndo();

    return clip;
  }

  // ==================== TRACK MANAGEMENT ====================
  addTrack(type = 'video', name = null) {
    if (!this.currentProject) {
      throw new VideoEditorError('no_project', 'No project loaded');
    }

    if (this.currentProject.tracks.length >= VIDEO_EDITOR_CONFIG.TIMELINE.MAX_TRACKS) {
      throw new VideoEditorError('max_tracks', 'Maximum number of tracks reached');
    }

    const track = {
      id: uuidv4(),
      type,
      name: name || `${type.charAt(0).toUpperCase() + type.slice(1)} ${this.currentProject.tracks.length + 1}`,
      clips: [],
      overlays: type === 'text' ? [] : undefined,
      items: type === 'sticker' ? [] : undefined,
      muted: false,
      locked: false,
      visible: true,
    };

    this.currentProject.tracks.push(track);
    return track;
  }

  deleteTrack(trackId) {
    if (!this.currentProject) {
      throw new VideoEditorError('no_project', 'No project loaded');
    }

    const trackIndex = this.currentProject.tracks.findIndex(t => t.id === trackId);
    if (trackIndex === -1) {
      throw new VideoEditorError('track_not_found', 'Track not found');
    }

    if (this.currentProject.tracks.length <= 1) {
      throw new VideoEditorError('min_tracks', 'Cannot delete last track');
    }

    this.currentProject.tracks.splice(trackIndex, 1);
    this._pushUndo();

    return true;
  }

  updateTrack(trackId, updates) {
    if (!this.currentProject) {
      throw new VideoEditorError('no_project', 'No project loaded');
    }

    const track = this.currentProject.tracks.find(t => t.id === trackId);
    if (!track) {
      throw new VideoEditorError('track_not_found', 'Track not found');
    }

    Object.assign(track, updates);
    return track;
  }

  // ==================== TEXT OVERLAYS ====================
  addTextOverlay(textData) {
    if (!this.currentProject) {
      throw new VideoEditorError('no_project', 'No project loaded');
    }

    const textTrack = this.currentProject.tracks.find(t => t.type === 'text');
    if (!textTrack) {
      throw new VideoEditorError('track_not_found', 'Text track not found');
    }

    if (textTrack.overlays.length >= VIDEO_EDITOR_CONFIG.TEXT.MAX_OVERLAYS) {
      throw new VideoEditorError('max_overlays', 'Maximum number of text overlays reached');
    }

    const overlay = {
      id: uuidv4(),
      text: textData.text || 'New Text',
      startTime: textData.startTime || 0,
      endTime: textData.endTime || this.currentProject.duration || 10,
      font: textData.font || 'Arial',
      fontSize: textData.fontSize || 32,
      color: textData.color || '#FFFFFF',
      backgroundColor: textData.backgroundColor || 'transparent',
      strokeColor: textData.strokeColor || '#000000',
      strokeWidth: textData.strokeWidth || 0,
      style: textData.style || 'normal',
      position: textData.position || { x: 50, y: 50 }, // percentage
      alignment: textData.alignment || 'center',
      animation: textData.animation || 'none',
      shadow: textData.shadow || { enabled: false, color: '#000000', blur: 4, offsetX: 2, offsetY: 2 },
    };

    textTrack.overlays.push(overlay);
    this._pushUndo();

    return overlay;
  }

  updateTextOverlay(overlayId, updates) {
    if (!this.currentProject) {
      throw new VideoEditorError('no_project', 'No project loaded');
    }

    const textTrack = this.currentProject.tracks.find(t => t.type === 'text');
    if (!textTrack) {
      throw new VideoEditorError('track_not_found', 'Text track not found');
    }

    const overlay = textTrack.overlays.find(o => o.id === overlayId);
    if (!overlay) {
      throw new VideoEditorError('overlay_not_found', 'Text overlay not found');
    }

    Object.assign(overlay, updates);
    this._pushUndo();

    return overlay;
  }

  deleteTextOverlay(overlayId) {
    if (!this.currentProject) {
      throw new VideoEditorError('no_project', 'No project loaded');
    }

    const textTrack = this.currentProject.tracks.find(t => t.type === 'text');
    if (!textTrack) {
      throw new VideoEditorError('track_not_found', 'Text track not found');
    }

    const index = textTrack.overlays.findIndex(o => o.id === overlayId);
    if (index === -1) {
      throw new VideoEditorError('overlay_not_found', 'Text overlay not found');
    }

    textTrack.overlays.splice(index, 1);
    this._pushUndo();

    return true;
  }

  // ==================== STICKERS ====================
  addSticker(stickerData) {
    if (!this.currentProject) {
      throw new VideoEditorError('no_project', 'No project loaded');
    }

    const stickerTrack = this.currentProject.tracks.find(t => t.type === 'sticker');
    if (!stickerTrack) {
      throw new VideoEditorError('track_not_found', 'Sticker track not found');
    }

    if (stickerTrack.items.length >= VIDEO_EDITOR_CONFIG.STICKERS.MAX_STICKERS) {
      throw new VideoEditorError('max_stickers', 'Maximum number of stickers reached');
    }

    const sticker = {
      id: uuidv4(),
      icon: stickerData.icon || '⭐',
      startTime: stickerData.startTime || 0,
      endTime: stickerData.endTime || this.currentProject.duration || 10,
      position: stickerData.position || { x: 50, y: 50 },
      scale: stickerData.scale || 1,
      rotation: stickerData.rotation || 0,
      opacity: stickerData.opacity || 1,
      animation: stickerData.animation || 'none',
    };

    stickerTrack.items.push(sticker);
    this._pushUndo();

    return sticker;
  }

  updateSticker(stickerId, updates) {
    if (!this.currentProject) {
      throw new VideoEditorError('no_project', 'No project loaded');
    }

    const stickerTrack = this.currentProject.tracks.find(t => t.type === 'sticker');
    if (!stickerTrack) {
      throw new VideoEditorError('track_not_found', 'Sticker track not found');
    }

    const sticker = stickerTrack.items.find(s => s.id === stickerId);
    if (!sticker) {
      throw new VideoEditorError('sticker_not_found', 'Sticker not found');
    }

    Object.assign(sticker, updates);
    this._pushUndo();

    return sticker;
  }

  deleteSticker(stickerId) {
    if (!this.currentProject) {
      throw new VideoEditorError('no_project', 'No project loaded');
    }

    const stickerTrack = this.currentProject.tracks.find(t => t.type === 'sticker');
    if (!stickerTrack) {
      throw new VideoEditorError('track_not_found', 'Sticker track not found');
    }

    const index = stickerTrack.items.findIndex(s => s.id === stickerId);
    if (index === -1) {
      throw new VideoEditorError('sticker_not_found', 'Sticker not found');
    }

    stickerTrack.items.splice(index, 1);
    this._pushUndo();

    return true;
  }

  // ==================== TRANSITIONS ====================
  addTransition(transitionData) {
    if (!this.currentProject) {
      throw new VideoEditorError('no_project', 'No project loaded');
    }

    const transition = {
      id: uuidv4(),
      type: transitionData.type || 'fade',
      duration: transitionData.duration || VIDEO_EDITOR_CONFIG.TRANSITIONS.DEFAULT_DURATION,
      position: transitionData.position || {}, // { afterClipId } or { beforeClipId }
    };

    this.currentProject.transitions.push(transition);
    this._pushUndo();

    return transition;
  }

  updateTransition(transitionId, updates) {
    if (!this.currentProject) {
      throw new VideoEditorError('no_project', 'No project loaded');
    }

    const transition = this.currentProject.transitions.find(t => t.id === transitionId);
    if (!transition) {
      throw new VideoEditorError('transition_not_found', 'Transition not found');
    }

    Object.assign(transition, updates);
    this._pushUndo();

    return transition;
  }

  deleteTransition(transitionId) {
    if (!this.currentProject) {
      throw new VideoEditorError('no_project', 'No project loaded');
    }

    const index = this.currentProject.transitions.findIndex(t => t.id === transitionId);
    if (index === -1) {
      throw new VideoEditorError('transition_not_found', 'Transition not found');
    }

    this.currentProject.transitions.splice(index, 1);
    this._pushUndo();

    return true;
  }

  // ==================== CAPTIONS ====================
  addCaption(captionData) {
    if (!this.currentProject) {
      throw new VideoEditorError('no_project', 'No project loaded');
    }

    const caption = {
      id: uuidv4(),
      text: captionData.text || '',
      startTime: captionData.startTime || 0,
      endTime: captionData.endTime || 5,
      language: captionData.language || 'en',
      style: captionData.style || 'default',
      position: captionData.position || 'bottom',
      font: captionData.font || 'Arial',
      fontSize: captionData.fontSize || 24,
      color: captionData.color || '#FFFFFF',
      backgroundColor: captionData.backgroundColor || 'rgba(0,0,0,0.7)',
    };

    this.currentProject.captions.push(caption);
    this._pushUndo();

    return caption;
  }

  updateCaption(captionId, updates) {
    if (!this.currentProject) {
      throw new VideoEditorError('no_project', 'No project loaded');
    }

    const caption = this.currentProject.captions.find(c => c.id === captionId);
    if (!caption) {
      throw new VideoEditorError('caption_not_found', 'Caption not found');
    }

    Object.assign(caption, updates);
    this._pushUndo();

    return caption;
  }

  deleteCaption(captionId) {
    if (!this.currentProject) {
      throw new VideoEditorError('no_project', 'No project loaded');
    }

    const index = this.currentProject.captions.findIndex(c => c.id === captionId);
    if (index === -1) {
      throw new VideoEditorError('caption_not_found', 'Caption not found');
    }

    this.currentProject.captions.splice(index, 1);
    this._pushUndo();

    return true;
  }

  generateCaptionsFromAudio(language = 'en') {
    // Placeholder for AI-powered caption generation
    // In production, this would use a speech-to-text API
    console.log('[VideoEditorService] Generating captions for language:', language);
    return [];
  }

  // ==================== FILTERS ====================
  addFilter(clipId, filterId) {
    if (!this.currentProject) {
      throw new VideoEditorError('no_project', 'No project loaded');
    }

    for (const track of this.currentProject.tracks) {
      const clip = track.clips.find(c => c.id === clipId);
      if (clip) {
        clip.filter = filterId;
        this._pushUndo();
        return clip;
      }
    }

    throw new VideoEditorError('clip_not_found', 'Clip not found');
  }

  getFilterCSS(filterId) {
    const filter = VIDEO_EDITOR_CONFIG.FILTERS.BUILT_IN.find(f => f.id === filterId);
    return filter ? filter.css : '';
  }

  // ==================== AUDIO MANAGEMENT ====================
  addAudioTrack(clipData) {
    if (!this.currentProject) {
      throw new VideoEditorError('no_project', 'No project loaded');
    }

    const audioTrack = this.currentProject.tracks.find(t => t.type === 'audio');
    if (!audioTrack) {
      throw new VideoEditorError('track_not_found', 'Audio track not found');
    }

    const clip = {
      id: uuidv4(),
      sourceUrl: clipData.sourceUrl,
      sourceType: 'audio',
      startTime: clipData.startTime || 0,
      endTime: clipData.endTime || clipData.duration || 30,
      duration: clipData.duration || 30,
      trimStart: clipData.trimStart || 0,
      trimEnd: clipData.trimEnd || clipData.duration || 30,
      volume: clipData.volume !== undefined ? clipData.volume : 1,
      fadeIn: clipData.fadeIn || 0,
      fadeOut: clipData.fadeOut || 0,
    };

    audioTrack.clips.push(clip);
    this._pushUndo();

    return clip;
  }

  adjustVolume(trackId, clipId, volume) {
    if (!this.currentProject) {
      throw new VideoEditorError('no_project', 'No project loaded');
    }

    if (volume < VIDEO_EDITOR_CONFIG.AUDIO.MIN_VOLUME || volume > VIDEO_EDITOR_CONFIG.AUDIO.MAX_VOLUME) {
      throw new VideoEditorError('invalid_volume', 'Volume must be between 0 and 2');
    }

    const track = this.currentProject.tracks.find(t => t.id === trackId);
    if (!track) {
      throw new VideoEditorError('track_not_found', 'Track not found');
    }

    const clip = track.clips.find(c => c.id === clipId);
    if (!clip) {
      throw new VideoEditorError('clip_not_found', 'Clip not found');
    }

    clip.volume = volume;
    this._pushUndo();

    return clip;
  }

  setFade(trackId, clipId, fadeIn, fadeOut) {
    if (!this.currentProject) {
      throw new VideoEditorError('no_project', 'No project loaded');
    }

    const track = this.currentProject.tracks.find(t => t.id === trackId);
    if (!track) {
      throw new VideoEditorError('track_not_found', 'Track not found');
    }

    const clip = track.clips.find(c => c.id === clipId);
    if (!clip) {
      throw new VideoEditorError('clip_not_found', 'Clip not found');
    }

    clip.fadeIn = fadeIn || 0;
    clip.fadeOut = fadeOut || 0;
    this._pushUndo();

    return clip;
  }

  // ==================== EXPORT ====================
  setExportSettings(settings) {
    if (!this.currentProject) {
      throw new VideoEditorError('no_project', 'No project loaded');
    }

    this.currentProject.exportSettings = {
      ...this.currentProject.exportSettings,
      ...settings,
    };

    return this.currentProject.exportSettings;
  }

  async exportVideo(progressCallback) {
    if (!this.currentProject) {
      throw new VideoEditorError('no_project', 'No project loaded');
    }

    // Simulate export progress
    const totalSteps = 100;
    for (let i = 0; i <= totalSteps; i++) {
      if (progressCallback) {
        progressCallback({
          progress: i / totalSteps,
          stage: i < 20 ? 'preparing' : i < 80 ? 'encoding' : 'finalizing',
          message: i < 20 ? 'Preparing video...' : i < 80 ? 'Encoding video...' : 'Finalizing...',
        });
      }
      await new Promise(resolve => setTimeout(resolve, 50));
    }

    // Return export configuration
    return {
      success: true,
      projectId: this.currentProject.id,
      settings: this.currentProject.exportSettings,
      duration: this.currentProject.duration,
      format: VIDEO_EDITOR_CONFIG.EXPORT.FORMAT,
      estimatedSize: Math.round(this.currentProject.duration * this.currentProject.exportSettings.bitrate / 8),
    };
  }

  async uploadExportedVideo(videoBlob, userId) {
    await this.ensureInitialized();

    const videoId = uuidv4();
    const storagePath = `exports/${userId}/${videoId}.${VIDEO_EDITOR_CONFIG.EXPORT.FORMAT}`;
    const storageRef = ref(this.storage, storagePath);

    const snapshot = await uploadBytes(storageRef, videoBlob);
    const downloadUrl = await getDownloadURL(snapshot.ref);

    return {
      id: videoId,
      url: downloadUrl,
      path: storagePath,
      size: videoBlob.size,
      format: VIDEO_EDITOR_CONFIG.EXPORT.FORMAT,
    };
  }

  // ==================== UNDO/REDO ====================
  _pushUndo() {
    if (!this.currentProject) return;

    const snapshot = JSON.stringify(this.currentProject);
    this.currentProject.undoStack.push(snapshot);

    if (this.currentProject.undoStack.length > 50) {
      this.currentProject.undoStack.shift();
    }

    this.currentProject.redoStack = [];
  }

  undo() {
    if (!this.currentProject || this.currentProject.undoStack.length === 0) {
      return null;
    }

    const current = JSON.stringify(this.currentProject);
    this.currentProject.redoStack.push(current);

    const previous = this.currentProject.undoStack.pop();
    this.currentProject = JSON.parse(previous);

    return this.currentProject;
  }

  redo() {
    if (!this.currentProject || this.currentProject.redoStack.length === 0) {
      return null;
    }

    const current = JSON.stringify(this.currentProject);
    this.currentProject.undoStack.push(current);

    const next = this.currentProject.redoStack.pop();
    this.currentProject = JSON.parse(next);

    return this.currentProject;
  }

  canUndo() {
    return this.currentProject && this.currentProject.undoStack.length > 0;
  }

  canRedo() {
    return this.currentProject && this.currentProject.redoStack.length > 0;
  }

  // ==================== UTILITY METHODS ====================
  _recalculateDuration() {
    if (!this.currentProject) return 0;

    let maxDuration = 0;
    for (const track of this.currentProject.tracks) {
      for (const clip of track.clips || []) {
        if (clip.endTime > maxDuration) {
          maxDuration = clip.endTime;
        }
      }
      for (const overlay of track.overlays || []) {
        if (overlay.endTime > maxDuration) {
          maxDuration = overlay.endTime;
        }
      }
      for (const item of track.items || []) {
        if (item.endTime > maxDuration) {
          maxDuration = item.endTime;
        }
      }
    }

    this.currentProject.duration = maxDuration;
    return maxDuration;
  }

  getProjectDuration() {
    if (!this.currentProject) return 0;
    return this.currentProject.duration;
  }

  getTimelineState() {
    if (!this.currentProject) return null;

    return {
      duration: this.currentProject.duration,
      tracks: this.currentProject.tracks.map(track => ({
        id: track.id,
        type: track.type,
        name: track.name,
        clipCount: track.clips?.length || 0,
        overlayCount: track.overlays?.length || 0,
        itemCount: track.items?.length || 0,
        muted: track.muted,
        locked: track.locked,
        visible: track.visible,
      })),
      transitionCount: this.currentProject.transitions.length,
      captionCount: this.currentProject.captions.length,
    };
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
      hasProject: !!this.currentProject,
      projectId: this.currentProject?.id,
      listenerCount: this.listeners.size,
    };
  }

  destroy() {
    this.listeners.clear();
    this.currentProject = null;
    this.initialized = false;
    this.initPromise = null;
    console.warn('[VideoEditorService] Destroyed');
  }
}

// ==================== SINGLETON EXPORT ====================
let instance = null;
export function getVideoEditorService() {
  if (!instance) instance = new VideoEditorService();
  return instance;
}

const videoEditorService = {
  initialize: () => getVideoEditorService().initialize(),
  ensureInitialized: () => getVideoEditorService().ensureInitialized(),
  createProject: (m) => getVideoEditorService().createProject(m),
  loadProject: (p) => getVideoEditorService().loadProject(p),
  getCurrentProject: () => getVideoEditorService().getCurrentProject(),
  saveProject: () => getVideoEditorService().saveProject(),
  loadProjectFromStorage: (id) => getVideoEditorService().loadProjectFromStorage(id),
  addClip: (tid, cd) => getVideoEditorService().addClip(tid, cd),
  updateClip: (tid, cid, u) => getVideoEditorService().updateClip(tid, cid, u),
  deleteClip: (tid, cid) => getVideoEditorService().deleteClip(tid, cid),
  splitClip: (tid, cid, st) => getVideoEditorService().splitClip(tid, cid, st),
  trimClip: (tid, cid, ns, ne) => getVideoEditorService().trimClip(tid, cid, ns, ne),
  addTrack: (t, n) => getVideoEditorService().addTrack(t, n),
  deleteTrack: (id) => getVideoEditorService().deleteTrack(id),
  updateTrack: (id, u) => getVideoEditorService().updateTrack(id, u),
  addTextOverlay: (d) => getVideoEditorService().addTextOverlay(d),
  updateTextOverlay: (id, u) => getVideoEditorService().updateTextOverlay(id, u),
  deleteTextOverlay: (id) => getVideoEditorService().deleteTextOverlay(id),
  addSticker: (d) => getVideoEditorService().addSticker(d),
  updateSticker: (id, u) => getVideoEditorService().updateSticker(id, u),
  deleteSticker: (id) => getVideoEditorService().deleteSticker(id),
  addTransition: (d) => getVideoEditorService().addTransition(d),
  updateTransition: (id, u) => getVideoEditorService().updateTransition(id, u),
  deleteTransition: (id) => getVideoEditorService().deleteTransition(id),
  addCaption: (d) => getVideoEditorService().addCaption(d),
  updateCaption: (id, u) => getVideoEditorService().updateCaption(id, u),
  deleteCaption: (id) => getVideoEditorService().deleteCaption(id),
  generateCaptionsFromAudio: (l) => getVideoEditorService().generateCaptionsFromAudio(l),
  addFilter: (cid, fid) => getVideoEditorService().addFilter(cid, fid),
  getFilterCSS: (fid) => getVideoEditorService().getFilterCSS(fid),
  addAudioTrack: (cd) => getVideoEditorService().addAudioTrack(cd),
  adjustVolume: (tid, cid, v) => getVideoEditorService().adjustVolume(tid, cid, v),
  setFade: (tid, cid, fi, fo) => getVideoEditorService().setFade(tid, cid, fi, fo),
  setExportSettings: (s) => getVideoEditorService().setExportSettings(s),
  exportVideo: (cb) => getVideoEditorService().exportVideo(cb),
  uploadExportedVideo: (blob, uid) => getVideoEditorService().uploadExportedVideo(blob, uid),
  undo: () => getVideoEditorService().undo(),
  redo: () => getVideoEditorService().redo(),
  canUndo: () => getVideoEditorService().canUndo(),
  canRedo: () => getVideoEditorService().canRedo(),
  getProjectDuration: () => getVideoEditorService().getProjectDuration(),
  getTimelineState: () => getVideoEditorService().getTimelineState(),
  addChangeListener: (id, cb) => getVideoEditorService().addChangeListener(id, cb),
  removeChangeListener: (id) => getVideoEditorService().removeChangeListener(id),
  getStats: () => getVideoEditorService().getStats(),
  destroy: () => getVideoEditorService().destroy(),
  getService: getVideoEditorService,
};

export default videoEditorService;
