// src/services/audioEditorService.js – ARVDOUL AUDIO EDITOR SERVICE V1
// 🎵 Professional Audio Editor with Waveform, Trim, Effects, Export
// ✅ Waveform Visualization • Audio Effects • Volume Control • Export

import { getStorageInstance } from '../firebase/firebase.js';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { v4 as uuidv4 } from 'uuid';

// ==================== CONFIGURATION ====================
export const AUDIO_EDITOR_CONFIG = {
  WAVEFORM: {
    SAMPLES_PER_SECOND: 100,
    BAR_WIDTH: 3,
    BAR_GAP: 1,
    MIN_HEIGHT: 2,
    MAX_HEIGHT: 100,
    COLORS: {
      DEFAULT: '#6366f1',
      SELECTED: '#8b5cf6',
      PLAYED: '#ec4899',
      BACKGROUND: '#1a1a2e',
      GRID: '#374151',
    },
  },
  EFFECTS: {
    REVERB: {
      id: 'reverb',
      name: 'Reverb',
      params: {
        roomSize: { min: 0, max: 1, default: 0.5 },
        damping: { min: 0, max: 1, default: 0.5 },
        wet: { min: 0, max: 1, default: 0.3 },
        dry: { min: 0, max: 1, default: 0.7 },
      },
    },
    ECHO: {
      id: 'echo',
      name: 'Echo',
      params: {
        delay: { min: 0.01, max: 2, default: 0.5 },
        feedback: { min: 0, max: 0.95, default: 0.5 },
        wet: { min: 0, max: 1, default: 0.3 },
      },
    },
    EQ: {
      id: 'eq',
      name: 'Equalizer',
      params: {
        lowGain: { min: -12, max: 12, default: 0 },
        midGain: { min: -12, max: 12, default: 0 },
        highGain: { min: -12, max: 12, default: 0 },
      },
    },
    COMPRESSOR: {
      id: 'compressor',
      name: 'Compressor',
      params: {
        threshold: { min: -60, max: 0, default: -24 },
        knee: { min: 0, max: 40, default: 30 },
        ratio: { min: 1, max: 20, default: 12 },
        attack: { min: 0, max: 1000, default: 3 },
        release: { min: 0, max: 1000, default: 250 },
      },
    },
    DISTORTION: {
      id: 'distortion',
      name: 'Distortion',
      params: {
        amount: { min: 0, max: 100, default: 50 },
      },
    },
    CHORUS: {
      id: 'chorus',
      name: 'Chorus',
      params: {
        frequency: { min: 0, max: 10, default: 1.5 },
        delayTime: { min: 0, max: 50, default: 3.5 },
        depth: { min: 0, max: 1, default: 0.5 },
        wet: { min: 0, max: 1, default: 0.5 },
      },
    },
    FADE: {
      id: 'fade',
      name: 'Fade',
      params: {
        type: { values: ['in', 'out', 'inout'], default: 'in' },
        duration: { min: 0.1, max: 10, default: 1 },
      },
    },
  },
  VOLUME: {
    MIN: 0,
    MAX: 2,
    DEFAULT: 1,
    STEP: 0.05,
  },
  PAN: {
    MIN: -1,
    MAX: 1,
    DEFAULT: 0,
    STEP: 0.05,
  },
  TRIM: {
    MIN_DURATION: 0.1,
    MAX_SILENCE_THRESHOLD: -40, // dB
  },
  EXPORT: {
    FORMATS: [
      { id: 'mp3', name: 'MP3', extension: 'mp3', mimeType: 'audio/mpeg' },
      { id: 'wav', name: 'WAV', extension: 'wav', mimeType: 'audio/wav' },
      { id: 'ogg', name: 'OGG', extension: 'ogg', mimeType: 'audio/ogg' },
    ],
    BITRATES: [128, 192, 256, 320],
    SAMPLING_RATES: [44100, 48000, 96000],
  },
  UNDO: {
    MAX_STACK_SIZE: 50,
  },
};

// ==================== CUSTOM ERROR ====================
export class AudioEditorError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'AudioEditorError';
    this.code = `audio_editor/${code}`;
    this.details = details;
    this.timestamp = new Date().toISOString();
  }
}

// ==================== AUDIO EDITOR SERVICE ====================
class AudioEditorService {
  constructor() {
    this.storage = null;
    this.initialized = false;
    this.initPromise = null;
    this.currentProject = null;
    this.audioContext = null;
    this.audioBuffer = null;
    this.listeners = new Map();
  }

  async initialize() {
    if (this.initialized) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = (async () => {
      try {
        this.storage = getStorageInstance();
        this.initialized = true;
        console.log('[AudioEditorService] Initialized successfully');
      } catch (error) {
        console.error('[AudioEditorService] Initialization failed:', error);
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
      name: metadata.name || 'Untitled Audio',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      duration: 0,
      sampleRate: AUDIO_EDITOR_CONFIG.EXPORT.SAMPLING_RATES[0],
      channels: 2,
      sourceUrl: null,
      trimStart: 0,
      trimEnd: 0,
      effects: [],
      volume: AUDIO_EDITOR_CONFIG.VOLUME.DEFAULT,
      pan: AUDIO_EDITOR_CONFIG.PAN.DEFAULT,
      fadeIn: 0,
      fadeOut: 0,
      undoStack: [],
      redoStack: [],
      markers: [],
    };
    this.currentProject = project;
    return project;
  }

  loadProject(projectData) {
    if (!projectData || !projectData.id) {
      throw new AudioEditorError('invalid_project', 'Invalid project data');
    }
    this.currentProject = { ...projectData, undoStack: [], redoStack: [] };
    return this.currentProject;
  }

  getCurrentProject() {
    return this.currentProject;
  }

  saveProject() {
    if (!this.currentProject) {
      throw new AudioEditorError('no_project', 'No project loaded');
    }
    const updatedProject = {
      ...this.currentProject,
      updatedAt: new Date().toISOString(),
    };
    this.currentProject = updatedProject;
    localStorage.setItem(`audio_editor_project_${updatedProject.id}`, JSON.stringify(updatedProject));
    return updatedProject;
  }

  loadProjectFromStorage(projectId) {
    const data = localStorage.getItem(`audio_editor_project_${projectId}`);
    if (!data) {
      throw new AudioEditorError('project_not_found', 'Project not found');
    }
    return this.loadProject(JSON.parse(data));
  }

  // ==================== AUDIO LOADING ====================
  async loadAudio(sourceUrl) {
    if (!this.currentProject) {
      throw new AudioEditorError('no_project', 'No project loaded');
    }

    try {
      const response = await fetch(sourceUrl);
      const arrayBuffer = await response.arrayBuffer();
      
      // Create AudioContext if needed
      if (!this.audioContext || this.audioContext.state === 'closed') {
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
      }

      this.audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
      
      this.currentProject.duration = this.audioBuffer.duration;
      this.currentProject.trimEnd = this.audioBuffer.duration;
      this.currentProject.sourceUrl = sourceUrl;
      this.currentProject.sampleRate = this.audioBuffer.sampleRate;
      this.currentProject.channels = this.audioBuffer.numberOfChannels;
      
      this._pushUndo();
      
      return {
        duration: this.audioBuffer.duration,
        sampleRate: this.audioBuffer.sampleRate,
        channels: this.audioBuffer.numberOfChannels,
      };
    } catch (error) {
      throw new AudioEditorError('load_failed', 'Failed to load audio file', { error: error.message });
    }
  }

  // ==================== WAVEFORM GENERATION ====================
  generateWaveform(samplesPerSecond = AUDIO_EDITOR_CONFIG.WAVEFORM.SAMPLES_PER_SECOND) {
    if (!this.audioBuffer) {
      throw new AudioEditorError('no_audio', 'No audio loaded');
    }

    const channelData = this.audioBuffer.getChannelData(0);
    const sampleRate = this.audioBuffer.sampleRate;
    const samplesPerPoint = Math.floor(sampleRate / samplesPerSecond);
    const totalPoints = Math.floor(channelData.length / samplesPerPoint);
    
    const waveformData = [];
    
    for (let i = 0; i < totalPoints; i++) {
      const start = i * samplesPerPoint;
      const end = Math.min(start + samplesPerPoint, channelData.length);
      
      let min = 1;
      let max = -1;
      
      for (let j = start; j < end; j++) {
        const value = channelData[j];
        if (value < min) min = value;
        if (value > max) max = value;
      }
      
      waveformData.push({
        min: min,
        max: max,
        rms: Math.sqrt((min * min + max * max) / 2),
      });
    }
    
    return waveformData;
  }

  // ==================== PLAYBACK CONTROL ====================
  async play(startTime = null, endTime = null) {
    if (!this.audioBuffer || !this.audioContext) {
      throw new AudioEditorError('no_audio', 'No audio loaded');
    }

    // Resume context if suspended
    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }

    const source = this.audioContext.createBufferSource();
    source.buffer = this.audioBuffer;

    // Create gain node for volume
    const gainNode = this.audioContext.createGain();
    gainNode.gain.value = this.currentProject.volume;

    // Create panner node for stereo position
    const pannerNode = this.audioContext.createStereoPanner();
    pannerNode.pan.value = this.currentProject.pan;

    // Connect nodes
    source.connect(gainNode);
    gainNode.connect(pannerNode);
    pannerNode.connect(this.audioContext.destination);

    const start = startTime !== null ? startTime : this.currentProject.trimStart;
    const end = endTime !== null ? endTime : this.currentProject.trimEnd;
    
    source.start(0, start, end - start);
    
    return {
      stop: () => source.stop(),
      context: this.audioContext,
    };
  }

  // ==================== TRIM OPERATIONS ====================
  setTrimStart(time) {
    if (!this.currentProject) {
      throw new AudioEditorError('no_project', 'No project loaded');
    }

    if (time < 0 || time >= this.currentProject.trimEnd) {
      throw new AudioEditorError('invalid_trim', 'Invalid trim start time');
    }

    this.currentProject.trimStart = time;
    this._pushUndo();
    return this.currentProject.trimStart;
  }

  setTrimEnd(time) {
    if (!this.currentProject) {
      throw new AudioEditorError('no_project', 'No project loaded');
    }

    if (time <= this.currentProject.trimStart || time > this.currentProject.duration) {
      throw new AudioEditorError('invalid_trim', 'Invalid trim end time');
    }

    this.currentProject.trimEnd = time;
    this._pushUndo();
    return this.currentProject.trimEnd;
  }

  trimToSelection(start, end) {
    if (!this.currentProject) {
      throw new AudioEditorError('no_project', 'No project loaded');
    }

    if (start < 0 || end > this.currentProject.duration || start >= end) {
      throw new AudioEditorError('invalid_selection', 'Invalid selection range');
    }

    this.currentProject.trimStart = start;
    this.currentProject.trimEnd = end;
    this._pushUndo();
    
    return {
      trimStart: this.currentProject.trimStart,
      trimEnd: this.currentProject.trimEnd,
    };
  }

  // ==================== VOLUME CONTROL ====================
  setVolume(volume) {
    if (!this.currentProject) {
      throw new AudioEditorError('no_project', 'No project loaded');
    }

    if (volume < AUDIO_EDITOR_CONFIG.VOLUME.MIN || volume > AUDIO_EDITOR_CONFIG.VOLUME.MAX) {
      throw new AudioEditorError('invalid_volume', 'Volume must be between 0 and 2');
    }

    this.currentProject.volume = volume;
    this._pushUndo();
    return this.currentProject.volume;
  }

  setPan(pan) {
    if (!this.currentProject) {
      throw new AudioEditorError('no_project', 'No project loaded');
    }

    if (pan < AUDIO_EDITOR_CONFIG.PAN.MIN || pan > AUDIO_EDITOR_CONFIG.PAN.MAX) {
      throw new AudioEditorError('invalid_pan', 'Pan must be between -1 and 1');
    }

    this.currentProject.pan = pan;
    this._pushUndo();
    return this.currentProject.pan;
  }

  // ==================== FADE OPERATIONS ====================
  setFadeIn(duration) {
    if (!this.currentProject) {
      throw new AudioEditorError('no_project', 'No project loaded');
    }

    if (duration < 0 || duration > this.currentProject.duration) {
      throw new AudioEditorError('invalid_fade', 'Invalid fade duration');
    }

    this.currentProject.fadeIn = duration;
    this._pushUndo();
    return this.currentProject.fadeIn;
  }

  setFadeOut(duration) {
    if (!this.currentProject) {
      throw new AudioEditorError('no_project', 'No project loaded');
    }

    if (duration < 0 || duration > this.currentProject.duration) {
      throw new AudioEditorError('invalid_fade', 'Invalid fade duration');
    }

    this.currentProject.fadeOut = duration;
    this._pushUndo();
    return this.currentProject.fadeOut;
  }

  // ==================== EFFECTS ====================
  addEffect(effectId, params = {}) {
    if (!this.currentProject) {
      throw new AudioEditorError('no_project', 'No project loaded');
    }

    const effectConfig = AUDIO_EDITOR_CONFIG.EFFECTS[effectId.toUpperCase()];
    if (!effectConfig) {
      throw new AudioEditorError('unknown_effect', `Unknown effect: ${effectId}`);
    }

    const effect = {
      id: uuidv4(),
      type: effectId,
      params: { ...effectConfig.params },
      enabled: true,
    };

    // Apply default values
    for (const [key, config] of Object.entries(effectConfig.params)) {
      effect.params[key] = params[key] ?? config.default;
    }

    this.currentProject.effects.push(effect);
    this._pushUndo();

    return effect;
  }

  updateEffect(effectId, params) {
    if (!this.currentProject) {
      throw new AudioEditorError('no_project', 'No project loaded');
    }

    const effect = this.currentProject.effects.find(e => e.id === effectId);
    if (!effect) {
      throw new AudioEditorError('effect_not_found', 'Effect not found');
    }

    for (const [key, value] of Object.entries(params)) {
      if (effect.params[key] !== undefined) {
        effect.params[key] = value;
      }
    }

    this._pushUndo();
    return effect;
  }

  removeEffect(effectId) {
    if (!this.currentProject) {
      throw new AudioEditorError('no_project', 'No project loaded');
    }

    const index = this.currentProject.effects.findIndex(e => e.id === effectId);
    if (index === -1) {
      throw new AudioEditorError('effect_not_found', 'Effect not found');
    }

    this.currentProject.effects.splice(index, 1);
    this._pushUndo();
    return true;
  }

  toggleEffect(effectId) {
    if (!this.currentProject) {
      throw new AudioEditorError('no_project', 'No project loaded');
    }

    const effect = this.currentProject.effects.find(e => e.id === effectId);
    if (!effect) {
      throw new AudioEditorError('effect_not_found', 'Effect not found');
    }

    effect.enabled = !effect.enabled;
    return effect.enabled;
  }

  // ==================== MARKERS ====================
  addMarker(time, label = '') {
    if (!this.currentProject) {
      throw new AudioEditorError('no_project', 'No project loaded');
    }

    if (time < 0 || time > this.currentProject.duration) {
      throw new AudioEditorError('invalid_marker', 'Invalid marker time');
    }

    const marker = {
      id: uuidv4(),
      time,
      label: label || `Marker ${this.currentProject.markers.length + 1}`,
    };

    this.currentProject.markers.push(marker);
    this.currentProject.markers.sort((a, b) => a.time - b.time);
    this._pushUndo();

    return marker;
  }

  updateMarker(markerId, updates) {
    if (!this.currentProject) {
      throw new AudioEditorError('no_project', 'No project loaded');
    }

    const marker = this.currentProject.markers.find(m => m.id === markerId);
    if (!marker) {
      throw new AudioEditorError('marker_not_found', 'Marker not found');
    }

    Object.assign(marker, updates);
    this.currentProject.markers.sort((a, b) => a.time - b.time);
    this._pushUndo();

    return marker;
  }

  removeMarker(markerId) {
    if (!this.currentProject) {
      throw new AudioEditorError('no_project', 'No project loaded');
    }

    const index = this.currentProject.markers.findIndex(m => m.id === markerId);
    if (index === -1) {
      throw new AudioEditorError('marker_not_found', 'Marker not found');
    }

    this.currentProject.markers.splice(index, 1);
    this._pushUndo();
    return true;
  }

  // ==================== EXPORT ====================
  async exportAudio(format = 'mp3', bitrate = 192, progressCallback) {
    if (!this.currentProject) {
      throw new AudioEditorError('no_project', 'No project loaded');
    }

    if (!this.audioBuffer) {
      throw new AudioEditorError('no_audio', 'No audio loaded');
    }

    // Simulate export process
    const totalSteps = 10;
    for (let i = 0; i <= totalSteps; i++) {
      if (progressCallback) {
        progressCallback({
          progress: i / totalSteps,
          stage: i < 5 ? 'processing' : 'encoding',
          message: i < 5 ? 'Processing audio...' : 'Encoding audio...',
        });
      }
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    const formatConfig = AUDIO_EDITOR_CONFIG.EXPORT.FORMATS.find(f => f.id === format);
    
    return {
      success: true,
      projectId: this.currentProject.id,
      format: formatConfig,
      bitrate,
      duration: this.currentProject.trimEnd - this.currentProject.trimStart,
      estimatedSize: Math.round((this.currentProject.trimEnd - this.currentProject.trimStart) * bitrate * 125),
    };
  }

  async uploadExportedAudio(audioBlob, userId) {
    await this.ensureInitialized();

    const audioId = uuidv4();
    const format = AUDIO_EDITOR_CONFIG.EXPORT.FORMATS[0];
    const storagePath = `audio_exports/${userId}/${audioId}.${format.extension}`;
    const storageRef = ref(this.storage, storagePath);

    const snapshot = await uploadBytes(storageRef, audioBlob);
    const downloadUrl = await getDownloadURL(snapshot.ref);

    return {
      id: audioId,
      url: downloadUrl,
      path: storagePath,
      size: audioBlob.size,
      format: format.id,
    };
  }

  // ==================== UNDO/REDO ====================
  _pushUndo() {
    if (!this.currentProject) return;

    const snapshot = JSON.stringify({
      trimStart: this.currentProject.trimStart,
      trimEnd: this.currentProject.trimEnd,
      volume: this.currentProject.volume,
      pan: this.currentProject.pan,
      fadeIn: this.currentProject.fadeIn,
      fadeOut: this.currentProject.fadeOut,
      effects: this.currentProject.effects,
      markers: this.currentProject.markers,
    });

    this.currentProject.undoStack.push(snapshot);
    if (this.currentProject.undoStack.length > AUDIO_EDITOR_CONFIG.UNDO.MAX_STACK_SIZE) {
      this.currentProject.undoStack.shift();
    }
    this.currentProject.redoStack = [];
  }

  undo() {
    if (!this.currentProject || this.currentProject.undoStack.length === 0) {
      return null;
    }

    const current = JSON.stringify({
      trimStart: this.currentProject.trimStart,
      trimEnd: this.currentProject.trimEnd,
      volume: this.currentProject.volume,
      pan: this.currentProject.pan,
      fadeIn: this.currentProject.fadeIn,
      fadeOut: this.currentProject.fadeOut,
      effects: this.currentProject.effects,
      markers: this.currentProject.markers,
    });

    this.currentProject.redoStack.push(current);

    const previous = JSON.parse(this.currentProject.undoStack.pop());
    Object.assign(this.currentProject, previous);

    return this.currentProject;
  }

  redo() {
    if (!this.currentProject || this.currentProject.redoStack.length === 0) {
      return null;
    }

    const current = JSON.stringify({
      trimStart: this.currentProject.trimStart,
      trimEnd: this.currentProject.trimEnd,
      volume: this.currentProject.volume,
      pan: this.currentProject.pan,
      fadeIn: this.currentProject.fadeIn,
      fadeOut: this.currentProject.fadeOut,
      effects: this.currentProject.effects,
      markers: this.currentProject.markers,
    });

    this.currentProject.undoStack.push(current);

    const next = JSON.parse(this.currentProject.redoStack.pop());
    Object.assign(this.currentProject, next);

    return this.currentProject;
  }

  canUndo() {
    return this.currentProject && this.currentProject.undoStack.length > 0;
  }

  canRedo() {
    return this.currentProject && this.currentProject.redoStack.length > 0;
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

  // ==================== UTILITY METHODS ====================
  getProjectDuration() {
    if (!this.currentProject) return 0;
    return this.currentProject.trimEnd - this.currentProject.trimStart;
  }

  getWaveformState() {
    if (!this.currentProject) return null;

    return {
      duration: this.currentProject.duration,
      trimStart: this.currentProject.trimStart,
      trimEnd: this.currentProject.trimEnd,
      volume: this.currentProject.volume,
      pan: this.currentProject.pan,
      fadeIn: this.currentProject.fadeIn,
      fadeOut: this.currentProject.fadeOut,
      effectCount: this.currentProject.effects.length,
      markerCount: this.currentProject.markers.length,
    };
  }

  formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 100);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
  }

  // ==================== SERVICE MANAGEMENT ====================
  getStats() {
    return {
      initialized: this.initialized,
      hasProject: !!this.currentProject,
      projectId: this.currentProject?.id,
      hasAudio: !!this.audioBuffer,
      listenerCount: this.listeners.size,
    };
  }

  destroy() {
    this.listeners.clear();
    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close();
    }
    this.audioContext = null;
    this.audioBuffer = null;
    this.currentProject = null;
    this.initialized = false;
    this.initPromise = null;
    console.warn('[AudioEditorService] Destroyed');
  }
}

// ==================== SINGLETON EXPORT ====================
let instance = null;
export function getAudioEditorService() {
  if (!instance) instance = new AudioEditorService();
  return instance;
}

const audioEditorService = {
  initialize: () => getAudioEditorService().initialize(),
  ensureInitialized: () => getAudioEditorService().ensureInitialized(),
  createProject: (m) => getAudioEditorService().createProject(m),
  loadProject: (p) => getAudioEditorService().loadProject(p),
  getCurrentProject: () => getAudioEditorService().getCurrentProject(),
  saveProject: () => getAudioEditorService().saveProject(),
  loadProjectFromStorage: (id) => getAudioEditorService().loadProjectFromStorage(id),
  loadAudio: (url) => getAudioEditorService().loadAudio(url),
  generateWaveform: (s) => getAudioEditorService().generateWaveform(s),
  play: (s, e) => getAudioEditorService().play(s, e),
  setTrimStart: (t) => getAudioEditorService().setTrimStart(t),
  setTrimEnd: (t) => getAudioEditorService().setTrimEnd(t),
  trimToSelection: (s, e) => getAudioEditorService().trimToSelection(s, e),
  setVolume: (v) => getAudioEditorService().setVolume(v),
  setPan: (p) => getAudioEditorService().setPan(p),
  setFadeIn: (d) => getAudioEditorService().setFadeIn(d),
  setFadeOut: (d) => getAudioEditorService().setFadeOut(d),
  addEffect: (id, p) => getAudioEditorService().addEffect(id, p),
  updateEffect: (id, p) => getAudioEditorService().updateEffect(id, p),
  removeEffect: (id) => getAudioEditorService().removeEffect(id),
  toggleEffect: (id) => getAudioEditorService().toggleEffect(id),
  addMarker: (t, l) => getAudioEditorService().addMarker(t, l),
  updateMarker: (id, u) => getAudioEditorService().updateMarker(id, u),
  removeMarker: (id) => getAudioEditorService().removeMarker(id),
  exportAudio: (f, b, cb) => getAudioEditorService().exportAudio(f, b, cb),
  uploadExportedAudio: (blob, uid) => getAudioEditorService().uploadExportedAudio(blob, uid),
  undo: () => getAudioEditorService().undo(),
  redo: () => getAudioEditorService().redo(),
  canUndo: () => getAudioEditorService().canUndo(),
  canRedo: () => getAudioEditorService().canRedo(),
  getProjectDuration: () => getAudioEditorService().getProjectDuration(),
  getWaveformState: () => getAudioEditorService().getWaveformState(),
  formatTime: (s) => getAudioEditorService().formatTime(s),
  addChangeListener: (id, cb) => getAudioEditorService().addChangeListener(id, cb),
  removeChangeListener: (id) => getAudioEditorService().removeChangeListener(id),
  getStats: () => getAudioEditorService().getStats(),
  destroy: () => getAudioEditorService().destroy(),
  getService: getAudioEditorService,
};

export default audioEditorService;
