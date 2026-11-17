// src/services/audioEditorService.js

import { getStorageInstance } from '../firebase/firebase.js';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { v4 as uuidv4 } from 'uuid';
import { svcLogger } from './ServiceKit.js';

const log = svcLogger('audioEditorService');

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
    MAX_SILENCE_THRESHOLD: -40,
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

export class AudioEditorError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'AudioEditorError';
    this.code = `audio_editor/${code}`;
    this.details = details;
    this.timestamp = new Date().toISOString();
  }
}

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
        this.storage = await getStorageInstance();
        this.initialized = true;
        log.info('AudioEditorService successfully initialized');
      } catch (error) {
        log.error('Initialization failed:', error);
        throw error;
      }
    })();

    return this.initPromise;
  }

  async ensureInitialized() {
    if (!this.initialized) await this.initialize();
  }

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
      sourceTrackId: metadata.sourceTrackId || null,
      sourceArtist: metadata.sourceArtist || null,
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
    this._baseline = null;
    return project;
  }

  loadProject(projectData) {
    if (!projectData || !projectData.id) {
      throw new AudioEditorError('invalid_project', 'Invalid project data');
    }
    this.currentProject = { ...projectData, undoStack: [], redoStack: [] };
    this._baseline = null;
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

  async loadAudio(sourceUrl) {
    if (!this.currentProject) {
      throw new AudioEditorError('no_project', 'No project loaded');
    }

    try {
      const response = await fetch(sourceUrl);
      const arrayBuffer = await response.arrayBuffer();
      
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

  async play(startTime = null, endTime = null) {
    if (!this.audioBuffer || !this.audioContext) {
      throw new AudioEditorError('no_audio', 'No audio loaded');
    }

    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }

    const source = this.audioContext.createBufferSource();
    source.buffer = this.audioBuffer;

    const gainNode = this.audioContext.createGain();
    gainNode.gain.value = this.currentProject.volume;

    const pannerNode = this.audioContext.createStereoPanner();
    pannerNode.pan.value = this.currentProject.pan;

    // Apply native BiquadFilters / dynamics Compressors from Web Audio API based on project effects
    const readParam = (val, fallback) => (
      val && typeof val === 'object' && 'default' in val ? val.default : (val ?? fallback)
    );
    let lastNode = source;
    this.currentProject.effects.forEach((eff) => {
      if (!eff.enabled) return;
      if (eff.type === 'eq') {
        const filter = this.audioContext.createBiquadFilter();
        filter.type = 'peaking';
        filter.frequency.value = 1000; // mid band
        filter.gain.value = readParam(eff.params?.midGain, 0);
        lastNode.connect(filter);
        lastNode = filter;
      } else if (eff.type === 'compressor') {
        const comp = this.audioContext.createDynamicsCompressor();
        comp.threshold.value = readParam(eff.params?.threshold, -24);
        comp.knee.value = readParam(eff.params?.knee, 30);
        comp.ratio.value = readParam(eff.params?.ratio, 12);
        lastNode.connect(comp);
        lastNode = comp;
      }
    });

    lastNode.connect(gainNode);
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

  _encodeWav(audioBuffer) {
    const numChannels = Math.min(2, audioBuffer.numberOfChannels || 1);
    const sampleRate = audioBuffer.sampleRate || 44100;
    const length = audioBuffer.length;
    const bytesPerSample = 2;
    const dataSize = length * numChannels * bytesPerSample;
    const buffer = new ArrayBuffer(44 + dataSize);
    const view = new DataView(buffer);

    const writeStr = (offset, str) => {
      for (let i = 0; i < str.length; i += 1) {
        view.setUint8(offset + i, str.charCodeAt(i));
      }
    };

    writeStr(0, 'RIFF');
    view.setUint32(4, 36 + dataSize, true);
    writeStr(8, 'WAVE');
    writeStr(12, 'fmt ');
    view.setUint32(16, 16, true); // PCM chunk size
    view.setUint16(20, 1, true); // PCM format
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * numChannels * bytesPerSample, true);
    view.setUint16(32, numChannels * bytesPerSample, true);
    view.setUint16(34, 16, true); // bits per sample
    writeStr(36, 'data');
    view.setUint32(40, dataSize, true);

    const channels = [];
    for (let ch = 0; ch < numChannels; ch += 1) {
      channels.push(audioBuffer.getChannelData(ch));
    }

    let offset = 44;
    for (let i = 0; i < length; i += 1) {
      for (let ch = 0; ch < numChannels; ch += 1) {
        const sample = Math.max(-1, Math.min(1, channels[ch][i] || 0));
        view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
        offset += 2;
      }
    }

    return new Blob([buffer], { type: 'audio/wav' });
  }

  /**
   * Real browser-side offline audio export using OfflineAudioContext + PCM WAV
   * rendering (or MediaRecorder capture when non-WAV compressed output is available).
   */
  async exportAudio(format = 'wav', bitrate = 192, progressCallback) {
    if (!this.currentProject) {
      throw new AudioEditorError('no_project', 'No project loaded');
    }

    if (!this.audioBuffer) {
      throw new AudioEditorError('no_audio', 'No audio loaded');
    }

    const trimStart = Math.max(0, this.currentProject.trimStart || 0);
    const trimEnd = Math.min(
      this.audioBuffer.duration,
      this.currentProject.trimEnd > trimStart ? this.currentProject.trimEnd : this.audioBuffer.duration
    );
    const exportDuration = Math.max(AUDIO_EDITOR_CONFIG.TRIM.MIN_DURATION, trimEnd - trimStart);

    if (progressCallback) {
      progressCallback({
        progress: 0.1,
        stage: 'processing',
        message: 'Rendering trimmed audio and effects...',
      });
    }

    const readParam = (val, fallback) => (
      val && typeof val === 'object' && 'default' in val ? val.default : (val ?? fallback)
    );

    const sampleRate = this.audioBuffer.sampleRate || 44100;
    const channels = Math.min(2, this.audioBuffer.numberOfChannels || 2);
    const OfflineCtx = typeof window !== 'undefined' && (window.OfflineAudioContext || window.webkitOfflineAudioContext);

    if (OfflineCtx && (format === 'wav' || typeof MediaRecorder === 'undefined')) {
      const frameCount = Math.max(1, Math.ceil(exportDuration * sampleRate));
      const offline = new OfflineCtx(channels, frameCount, sampleRate);
      const source = offline.createBufferSource();
      source.buffer = this.audioBuffer;

      let lastNode = source;
      (this.currentProject.effects || []).forEach((eff) => {
        if (!eff.enabled) return;
        if (eff.type === 'eq' && offline.createBiquadFilter) {
          const filter = offline.createBiquadFilter();
          filter.type = 'peaking';
          filter.frequency.value = 1000;
          filter.gain.value = readParam(eff.params?.midGain, 0);
          lastNode.connect(filter);
          lastNode = filter;
        } else if (eff.type === 'compressor' && offline.createDynamicsCompressor) {
          const comp = offline.createDynamicsCompressor();
          comp.threshold.value = readParam(eff.params?.threshold, -24);
          comp.knee.value = readParam(eff.params?.knee, 30);
          comp.ratio.value = readParam(eff.params?.ratio, 12);
          lastNode.connect(comp);
          lastNode = comp;
        }
      });

      const gainNode = offline.createGain();
      const baseVol = this.currentProject.volume ?? 1;
      gainNode.gain.setValueAtTime(baseVol, 0);
      if (this.currentProject.fadeIn > 0) {
        const fadeInEnd = Math.min(exportDuration, this.currentProject.fadeIn);
        gainNode.gain.setValueAtTime(0, 0);
        gainNode.gain.linearRampToValueAtTime(baseVol, fadeInEnd);
      }
      if (this.currentProject.fadeOut > 0) {
        const fadeOutStart = Math.max(0, exportDuration - this.currentProject.fadeOut);
        gainNode.gain.setValueAtTime(baseVol, fadeOutStart);
        gainNode.gain.linearRampToValueAtTime(0, exportDuration);
      }
      lastNode.connect(gainNode);

      if (offline.createStereoPanner) {
        const panner = offline.createStereoPanner();
        panner.pan.value = this.currentProject.pan ?? 0;
        gainNode.connect(panner);
        panner.connect(offline.destination);
      } else {
        gainNode.connect(offline.destination);
      }

      if (progressCallback) {
        progressCallback({
          progress: 0.4,
          stage: 'recording',
          message: 'Rendering offline audio mix...',
        });
      }

      source.start(0, trimStart, exportDuration);
      const renderedBuffer = await offline.startRendering();

      if (progressCallback) {
        progressCallback({
          progress: 0.9,
          stage: 'encoding',
          message: 'Encoding WAV output...',
        });
      }

      const outputBlob = this._encodeWav(renderedBuffer);
      return {
        success: true,
        projectId: this.currentProject.id,
        format: 'wav',
        extension: 'wav',
        mimeType: 'audio/wav',
        bitrate,
        duration: exportDuration,
        blob: outputBlob,
        size: outputBlob.size,
      };
    }

    if (typeof MediaRecorder === 'undefined') {
      throw new AudioEditorError('export_unsupported', 'Audio export is not supported in this environment.');
    }

    // Fallback compressed MediaRecorder capture
    const captureContext = new (window.AudioContext || window.webkitAudioContext)();
    const dest = captureContext.createMediaStreamDestination();
    const source = captureContext.createBufferSource();
    source.buffer = this.audioBuffer;
    const gainNode = captureContext.createGain();
    gainNode.gain.value = this.currentProject.volume ?? 1;
    source.connect(gainNode);
    gainNode.connect(dest);

    const mimeType = MediaRecorder.isTypeSupported?.('audio/ogg;codecs=opus') && format === 'ogg'
      ? 'audio/ogg;codecs=opus'
      : 'audio/webm';
    const mediaRecorder = new MediaRecorder(dest.stream, { mimeType });
    const chunks = [];
    mediaRecorder.ondataavailable = (evt) => {
      if (evt.data.size > 0) chunks.push(evt.data);
    };

    if (progressCallback) {
      progressCallback({
        progress: 0.4,
        stage: 'recording',
        message: 'Capturing AudioBuffer into output stream...',
      });
    }

    const stopped = new Promise((resolve) => {
      mediaRecorder.onstop = resolve;
    });
    mediaRecorder.start();
    source.start(0, trimStart, exportDuration);

    await new Promise((resolve) => {
      source.onended = () => {
        if (mediaRecorder.state !== 'inactive') mediaRecorder.stop();
        resolve();
      };
    });
    await stopped;
    captureContext.close?.().catch(() => {});

    if (progressCallback) {
      progressCallback({
        progress: 0.9,
        stage: 'encoding',
        message: 'Encoding captured audio data...',
      });
    }

    const cleanMime = mimeType.split(';')[0];
    const outputBlob = new Blob(chunks, { type: cleanMime });
    const ext = cleanMime === 'audio/ogg' ? 'ogg' : 'webm';

    return {
      success: true,
      projectId: this.currentProject.id,
      format: ext,
      extension: ext,
      mimeType: cleanMime,
      bitrate,
      duration: exportDuration,
      blob: outputBlob,
      size: outputBlob.size,
    };
  }

  async uploadExportedAudio(audioBlob, userId, options = {}) {
    await this.ensureInitialized();

    const audioId = uuidv4();
    const mime = options.mimeType || audioBlob?.type || 'audio/wav';
    const extension = options.extension
      || (mime.includes('wav') ? 'wav' : mime.includes('ogg') ? 'ogg' : mime.includes('webm') ? 'webm' : 'mp3');
    const storagePath = `audio_exports/${userId}/${audioId}.${extension}`;
    const storageRef = ref(this.storage, storagePath);

    const snapshot = await uploadBytes(storageRef, audioBlob, { contentType: mime });
    const downloadUrl = await getDownloadURL(snapshot.ref);

    return {
      id: audioId,
      url: downloadUrl,
      path: storagePath,
      size: audioBlob.size,
      format: extension,
      mimeType: mime,
    };
  }

  _pushUndo() {
    if (!this.currentProject) return;

    // Push the state as it was BEFORE this mutation. The previous implementation
    // snapshotted the post-mutation state, so the first undo was a no-op.
    if (this._baseline != null) {
      this.currentProject.undoStack.push(this._baseline);
      if (this.currentProject.undoStack.length > AUDIO_EDITOR_CONFIG.UNDO.MAX_STACK_SIZE) {
        this.currentProject.undoStack.shift();
      }
    }
    this._baseline = this._snapshotState();
    this.currentProject.redoStack = [];
  }

  _snapshotState() {
    return JSON.stringify({
      trimStart: this.currentProject.trimStart,
      trimEnd: this.currentProject.trimEnd,
      volume: this.currentProject.volume,
      pan: this.currentProject.pan,
      fadeIn: this.currentProject.fadeIn,
      fadeOut: this.currentProject.fadeOut,
      effects: this.currentProject.effects,
      markers: this.currentProject.markers,
    });
  }

  undo() {
    if (!this.currentProject || this.currentProject.undoStack.length === 0) {
      return null;
    }

    this.currentProject.redoStack.push(this._snapshotState());

    const previous = JSON.parse(this.currentProject.undoStack.pop());
    Object.assign(this.currentProject, previous);
    this._baseline = this._snapshotState();

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
    this._baseline = this._snapshotState();

    return this.currentProject;
  }

  canUndo() {
    return this.currentProject && this.currentProject.undoStack.length > 0;
  }

  canRedo() {
    return this.currentProject && this.currentProject.redoStack.length > 0;
  }

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
    log.warn('AudioEditorService destroyed successfully');
  }
}

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