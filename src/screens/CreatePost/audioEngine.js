// src/screens/CreatePost/audioEngine.js - ARVDOUL Audio Engine
// Web Audio API based audio processing for video editing

import { AUDIO_SETTINGS, clamp } from './videoConstants';

// ==================== AUDIO CONTEXT ====================

let audioContext = null;

/**
 * Get or create audio context
 */
export function getAudioContext() {
  if (!audioContext) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
  }
  return audioContext;
}

/**
 * Resume audio context if suspended
 */
export async function resumeAudioContext() {
  const ctx = getAudioContext();
  if (ctx.state === 'suspended') {
    await ctx.resume();
  }
  return ctx;
}

/**
 * Close audio context
 */
export function closeAudioContext() {
  if (audioContext) {
    audioContext.close();
    audioContext = null;
  }
}

// ==================== AUDIO NODE FACTORY ====================

/**
 * Create gain node for volume control
 */
export function createGainNode(ctx, initialValue = 1) {
  const gainNode = ctx.createGain();
  gainNode.gain.value = initialValue;
  return gainNode;
}

/**
 * Create panner node for stereo positioning
 */
export function createPannerNode(ctx, panValue = 0) {
  const pannerNode = ctx.createStereoPanner();
  pannerNode.pan.value = clamp(panValue, -1, 1);
  return pannerNode;
}

/**
 * Create EQ node using biquad filters
 */
export function createEQNode(ctx, settings = {}) {
  const {
    lowGain = 0,
    midGain = 0,
    highGain = 0,
    lowFreq = 320,
    midFreq = 1000,
    highFreq = 3200,
  } = settings;

  const eq = ctx.createGain();

  // Low shelf
  const lowShelf = ctx.createBiquadFilter();
  lowShelf.type = 'lowshelf';
  lowShelf.frequency.value = lowFreq;
  lowShelf.gain.value = clamp(lowGain, -12, 12);

  // Mid peak
  const midPeak = ctx.createBiquadFilter();
  midPeak.type = 'peaking';
  midPeak.frequency.value = midFreq;
  midPeak.Q.value = 1;
  midPeak.gain.value = clamp(midGain, -12, 12);

  // High shelf
  const highShelf = ctx.createBiquadFilter();
  highShelf.type = 'highshelf';
  highShelf.frequency.value = highFreq;
  highShelf.gain.value = clamp(highGain, -12, 12);

  // Connect chain
  lowShelf.connect(midPeak);
  midPeak.connect(highShelf);
  highShelf.connect(eq);

  // Expose input/output
  eq.input = lowShelf;
  eq.output = highShelf;

  // Store bands for updates
  eq.bands = { lowShelf, midPeak, highShelf };

  return eq;
}

/**
 * Create compressor node
 */
export function createCompressorNode(ctx, settings = {}) {
  const {
    threshold = -24,
    knee = 30,
    ratio = 12,
    attack = 0.003,
    release = 0.25,
  } = settings;

  const compressor = ctx.createDynamicsCompressor();
  compressor.threshold.value = threshold;
  compressor.knee.value = knee;
  compressor.ratio.value = ratio;
  compressor.attack.value = attack;
  compressor.release.value = release;

  return compressor;
}

/**
 * Create reverb using convolver
 */
export function createReverbNode(ctx, duration = 2, decay = 2) {
  const convolver = ctx.createConvolver();
  const sampleRate = ctx.sampleRate;
  const length = sampleRate * duration;
  const impulse = ctx.createBuffer(2, length, sampleRate);

  for (let channel = 0; channel < 2; channel++) {
    const channelData = impulse.getChannelData(channel);
    for (let i = 0; i < length; i++) {
      channelData[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
    }
  }

  convolver.buffer = impulse;
  return convolver;
}

/**
 * Create delay/echo node
 */
export function createDelayNode(ctx, delayTime = 0.3, feedback = 0.4) {
  const delay = ctx.createDelay(5);
  delay.delayTime.value = clamp(delayTime, 0, 5);

  const feedbackGain = ctx.createGain();
  feedbackGain.gain.value = clamp(feedback, 0, 1);

  // Connect feedback loop
  delay.connect(feedbackGain);
  feedbackGain.connect(delay);

  // Expose input/output
  delay.feedback = feedbackGain;

  return delay;
}

/**
 * Create limiter node
 */
export function createLimiterNode(ctx, threshold = -3, release = 0.1) {
  const limiter = ctx.createDynamicsCompressor();
  limiter.threshold.value = threshold;
  limiter.knee.value = 0;
  limiter.ratio.value = 20;
  limiter.attack.value = 0.001;
  limiter.release.value = release;

  return limiter;
}

// ==================== AUDIO BUFFER ====================

/**
 * Load audio file to AudioBuffer
 */
export async function loadAudioFile(file) {
  const ctx = getAudioContext();
  const arrayBuffer = await file.arrayBuffer();
  const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
  return audioBuffer;
}

/**
 * Load audio from URL
 */
export async function loadAudioFromURL(url) {
  const ctx = getAudioContext();
  const response = await fetch(url);
  const arrayBuffer = await response.arrayBuffer();
  const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
  return audioBuffer;
}

/**
 * Load audio from video element
 */
export async function loadAudioFromVideo(videoElement) {
  const ctx = getAudioContext();
  
  // Use MediaElementAudioSourceNode
  const source = ctx.createMediaElementSource(videoElement);
  
  return {
    source,
    duration: videoElement.duration,
    sampleRate: ctx.sampleRate,
  };
}

// ==================== WAVEFORM GENERATION ====================

/**
 * Generate waveform data from AudioBuffer
 */
export function generateWaveformData(audioBuffer, samples = 1000) {
  const channelData = audioBuffer.getChannelData(0);
  const blockSize = Math.floor(channelData.length / samples);
  const waveform = [];

  for (let i = 0; i < samples; i++) {
    const blockStart = blockSize * i;
    let sum = 0;

    for (let j = 0; j < blockSize; j++) {
      sum += Math.abs(channelData[blockStart + j]);
    }

    waveform.push(sum / blockSize);
  }

  // Normalize to 0-1
  const max = Math.max(...waveform, 0.001);
  return waveform.map((v) => v / max);
}

/**
 * Generate waveform for canvas rendering
 */
export function generateWaveformCanvas(waveformData, width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  const barWidth = width / waveformData.length;
  const centerY = height / 2;

  ctx.fillStyle = 'rgba(180, 22, 219, 0.7)';

  for (let i = 0; i < waveformData.length; i++) {
    const barHeight = waveformData[i] * height * 0.8;
    const x = i * barWidth;
    const y = centerY - barHeight / 2;

    ctx.fillRect(x, y, Math.max(barWidth - 1, 1), barHeight);
  }

  return canvas;
}

/**
 * Get RMS level from AudioBuffer portion
 */
export function getAudioLevel(audioBuffer, startTime, endTime) {
  const channelData = audioBuffer.getChannelData(0);
  const sampleRate = audioBuffer.sampleRate;
  const startSample = Math.floor(startTime * sampleRate);
  const endSample = Math.floor(endTime * sampleRate);

  let sum = 0;
  let count = 0;

  for (let i = startSample; i < endSample && i < channelData.length; i++) {
    sum += channelData[i] * channelData[i];
    count++;
  }

  const rms = Math.sqrt(sum / count);
  const db = 20 * Math.log10(rms || 0.001);
  const normalized = clamp((db + 60) / 60, 0, 1);

  return { rms, db, normalized };
}

// ==================== AUDIO PLAYBACK ====================

/**
 * Create audio source for playback
 */
export function createAudioSource(audioBuffer) {
  const ctx = getAudioContext();
  const source = ctx.createBufferSource();
  source.buffer = audioBuffer;
  return source;
}

/**
 * Play audio with fade in
 */
export function playWithFadeIn(source, gainNode, duration = 0) {
  const ctx = getAudioContext();
  
  if (duration > 0) {
    gainNode.gain.setValueAtTime(0, ctx.currentTime);
    gainNode.gain.linearRampToValueAtTime(1, ctx.currentTime + duration);
  }
  
  source.connect(gainNode);
  source.start();
  
  return source;
}

/**
 * Stop audio with fade out
 */
export function stopWithFadeOut(source, gainNode, duration = 0.5) {
  const ctx = getAudioContext();
  
  if (duration > 0) {
    const currentGain = gainNode.gain.value;
    gainNode.gain.setValueAtTime(currentGain, ctx.currentTime);
    gainNode.gain.linearRampToValueAtTime(0, ctx.currentTime + duration);
    
    setTimeout(() => {
      try {
        source.stop();
      } catch (e) {
        // Already stopped
      }
    }, duration * 1000);
  } else {
    source.stop();
  }
}

// ==================== AUDIO MIXER ====================

/**
 * Create audio mixer for timeline
 */
export function createAudioMixer(clipConfigs = []) {
  const ctx = getAudioContext();
  
  // Master output
  const masterGain = createGainNode(ctx, 1);
  const masterLimiter = createLimiterNode(ctx);
  
  masterGain.connect(masterLimiter);
  masterLimiter.connect(ctx.destination);

  // Track channels
  const channels = clipConfigs.map((config) => {
    const channel = {
      id: config.id,
      gain: createGainNode(ctx, config.volume / 100),
      panner: createPannerNode(ctx, config.pan / 100),
      eq: createEQNode(ctx),
      muted: false,
      solo: false,
    };

    // Connect chain: gain -> panner -> eq -> master
    channel.gain.connect(channel.panner);
    channel.panner.connect(channel.eq);
    channel.eq.connect(masterGain);

    return channel;
  });

  return {
    ctx,
    masterGain,
    masterLimiter,
    channels,
    masterVolume: 100,
  };
}

/**
 * Set channel volume
 */
export function setChannelVolume(mixer, channelId, volume) {
  const channel = mixer.channels.find((c) => c.id === channelId);
  if (channel) {
    channel.gain.gain.value = clamp(volume / 100, 0, 2);
  }
}

/**
 * Set channel pan
 */
export function setChannelPan(mixer, channelId, pan) {
  const channel = mixer.channels.find((c) => c.id === channelId);
  if (channel) {
    channel.panner.pan.value = clamp(pan / 100, -1, 1);
  }
}

/**
 * Set master volume
 */
export function setMasterVolume(mixer, volume) {
  mixer.masterGain.gain.value = clamp(volume / 100, 0, 2);
  mixer.masterVolume = volume;
}

/**
 * Mute channel
 */
export function muteChannel(mixer, channelId) {
  const channel = mixer.channels.find((c) => c.id === channelId);
  if (channel) {
    channel.muted = true;
    channel.gain.gain.value = 0;
  }
}

/**
 * Unmute channel
 */
export function unmuteChannel(mixer, channelId) {
  const channel = mixer.channels.find((c) => c.id === channelId);
  if (channel) {
    channel.muted = false;
    // Restore previous volume if stored
  }
}

/**
 * Solo channel
 */
export function soloChannel(mixer, channelId) {
  mixer.channels.forEach((channel) => {
    channel.solo = channel.id === channelId;
  });
}

/**
 * Unsolo all channels
 */
export function unsoloAllChannels(mixer) {
  mixer.channels.forEach((channel) => {
    channel.solo = false;
  });
}

/**
 * Update channel EQ
 */
export function setChannelEQ(mixer, channelId, eqSettings) {
  const channel = mixer.channels.find((c) => c.id === channelId);
  if (channel && channel.eq.bands) {
    if (eqSettings.lowGain !== undefined) {
      channel.eq.bands.lowShelf.gain.value = clamp(eqSettings.lowGain, -12, 12);
    }
    if (eqSettings.midGain !== undefined) {
      channel.eq.bands.midPeak.gain.value = clamp(eqSettings.midGain, -12, 12);
    }
    if (eqSettings.highGain !== undefined) {
      channel.eq.bands.highShelf.gain.value = clamp(eqSettings.highGain, -12, 12);
    }
  }
}

// ==================== AUDIO DuckING ====================

/**
 * Create ducking controller
 */
export function createDucker(targetGain, sourceAnalyser, threshold = -20, amount = 50) {
  const ctx = getAudioContext();
  
  // Create analyser for level detection
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 256;
  
  sourceAnalyser.connect(analyser);
  
  // Create gain for ducking
  const ducker = ctx.createGain();
  ducker.gain.value = 1;
  
  // Connect to target
  ducker.connect(targetGain);
  
  // Store state
  ducker._analyser = analyser;
  ducker._threshold = threshold;
  ducker._amount = amount / 100;
  ducker._isDucking = false;
  
  return ducker;
}

/**
 * Update ducking state (call in animation loop)
 */
export function updateDucker(ducker) {
  if (!ducker._analyser) return;
  
  const dataArray = new Uint8Array(ducker._analyser.frequencyBinCount);
  ducker._analyser.getByteFrequencyData(dataArray);
  
  // Calculate average level
  let sum = 0;
  for (let i = 0; i < dataArray.length; i++) {
    sum += dataArray[i];
  }
  const average = sum / dataArray.length;
  const db = 20 * Math.log10(average / 255);
  
  // Determine if should duck
  const shouldDuck = db > ducker._threshold;
  
  if (shouldDuck && !ducker._isDucking) {
    // Start ducking
    const ctx = getAudioContext();
    ducker.gain.linearRampToValueAtTime(1 - ducker._amount, ctx.currentTime + 0.1);
    ducker._isDucking = true;
  } else if (!shouldDuck && ducker._isDucking) {
    // Stop ducking
    const ctx = getAudioContext();
    ducker.gain.linearRampToValueAtTime(1, ctx.currentTime + 0.3);
    ducker._isDucking = false;
  }
}

// ==================== AUDIO EFFECTS ====================

/**
 * Apply fade in to audio buffer
 */
export function applyFadeIn(audioBuffer, fadeDuration) {
  const ctx = getAudioContext();
  const duration = audioBuffer.duration;
  const fadeSamples = Math.floor(fadeDuration * audioBuffer.sampleRate);
  
  // Create new buffer with fade
  const newBuffer = ctx.createBuffer(
    audioBuffer.numberOfChannels,
    audioBuffer.length,
    audioBuffer.sampleRate
  );
  
  for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
    const oldData = audioBuffer.getChannelData(channel);
    const newData = newBuffer.getChannelData(channel);
    
    for (let i = 0; i < audioBuffer.length; i++) {
      const fadeFactor = Math.min(1, i / fadeSamples);
      newData[i] = oldData[i] * fadeFactor;
    }
  }
  
  return newBuffer;
}

/**
 * Apply fade out to audio buffer
 */
export function applyFadeOut(audioBuffer, fadeDuration) {
  const ctx = getAudioContext();
  const duration = audioBuffer.duration;
  const fadeSamples = Math.floor(fadeDuration * audioBuffer.sampleRate);
  
  // Create new buffer with fade
  const newBuffer = ctx.createBuffer(
    audioBuffer.numberOfChannels,
    audioBuffer.length,
    audioBuffer.sampleRate
  );
  
  for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
    const oldData = audioBuffer.getChannelData(channel);
    const newData = newBuffer.getChannelData(channel);
    
    for (let i = 0; i < audioBuffer.length; i++) {
      const fadeStart = audioBuffer.length - fadeSamples;
      const fadeFactor = i >= fadeStart ? 1 - (i - fadeStart) / fadeSamples : 1;
      newData[i] = oldData[i] * fadeFactor;
    }
  }
  
  return newBuffer;
}

/**
 * Reverse audio buffer
 */
export function reverseAudioBuffer(audioBuffer) {
  const ctx = getAudioContext();
  const newBuffer = ctx.createBuffer(
    audioBuffer.numberOfChannels,
    audioBuffer.length,
    audioBuffer.sampleRate
  );
  
  for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
    const oldData = audioBuffer.getChannelData(channel);
    const newData = newBuffer.getChannelData(channel);
    
    for (let i = 0; i < audioBuffer.length; i++) {
      newData[i] = oldData[audioBuffer.length - 1 - i];
    }
  }
  
  return newBuffer;
}

/**
 * Normalize audio buffer
 */
export function normalizeAudioBuffer(audioBuffer, targetLevel = 0.95) {
  const ctx = getAudioContext();
  
  // Find peak
  let peak = 0;
  for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
    const data = audioBuffer.getChannelData(channel);
    for (let i = 0; i < data.length; i++) {
      const abs = Math.abs(data[i]);
      if (abs > peak) peak = abs;
    }
  }
  
  // Calculate gain
  const gain = peak > 0 ? targetLevel / peak : 1;
  
  // Apply gain
  const newBuffer = ctx.createBuffer(
    audioBuffer.numberOfChannels,
    audioBuffer.length,
    audioBuffer.sampleRate
  );
  
  for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
    const oldData = audioBuffer.getChannelData(channel);
    const newData = newBuffer.getChannelData(channel);
    
    for (let i = 0; i < audioBuffer.length; i++) {
      newData[i] = oldData[i] * gain;
    }
  }
  
  return newBuffer;
}

/**
 * Trim audio buffer
 */
export function trimAudioBuffer(audioBuffer, startTime, endTime) {
  const ctx = getAudioContext();
  const sampleRate = audioBuffer.sampleRate;
  const startSample = Math.floor(startTime * sampleRate);
  const endSample = Math.floor(endTime * sampleRate);
  const length = endSample - startSample;
  
  const newBuffer = ctx.createBuffer(
    audioBuffer.numberOfChannels,
    length,
    sampleRate
  );
  
  for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
    const oldData = audioBuffer.getChannelData(channel);
    const newData = newBuffer.getChannelData(channel);
    
    for (let i = 0; i < length; i++) {
      newData[i] = oldData[startSample + i];
    }
  }
  
  return newBuffer;
}

/**
 * Concatenate audio buffers
 */
export function concatenateAudioBuffers(buffers) {
  if (buffers.length === 0) return null;
  
  const ctx = getAudioContext();
  const sampleRate = buffers[0].sampleRate;
  const totalLength = buffers.reduce((sum, b) => sum + b.length, 0);
  const channels = buffers[0].numberOfChannels;
  
  const newBuffer = ctx.createBuffer(channels, totalLength, sampleRate);
  
  let offset = 0;
  for (const buffer of buffers) {
    for (let channel = 0; channel < channels; channel++) {
      const srcData = buffer.getChannelData(channel);
      const dstData = newBuffer.getChannelData(channel);
      
      for (let i = 0; i < buffer.length; i++) {
        dstData[offset + i] = srcData[i];
      }
    }
    offset += buffer.length;
  }
  
  return newBuffer;
}

// ==================== AUDIO RECORDING ====================

/**
 * Create audio recorder
 */
export function createAudioRecorder(constraints = {}) {
  const ctx = getAudioContext();
  
  const recorder = {
    mediaRecorder: null,
    chunks: [],
    stream: null,
    isRecording: false,
  };
  
  return recorder;
}

/**
 * Start recording
 */
export async function startRecording(recorder, constraints = { audio: true }) {
  try {
    recorder.stream = await navigator.mediaDevices.getUserMedia(constraints);
    
    const ctx = getAudioContext();
    const source = ctx.createMediaStreamSource(recorder.stream);
    
    // Create analyser for monitoring
    recorder.analyser = ctx.createAnalyser();
    recorder.analyser.fftSize = 256;
    source.connect(recorder.analyser);
    
    // Create MediaRecorder
    const mimeType = MediaRecorder.isTypeSupported('audio/webm')
      ? 'audio/webm'
      : 'audio/ogg';
    
    recorder.mediaRecorder = new MediaRecorder(recorder.stream, { mimeType });
    recorder.chunks = [];
    
    recorder.mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) {
        recorder.chunks.push(e.data);
      }
    };
    
    recorder.mediaRecorder.start(100); // Collect data every 100ms
    recorder.isRecording = true;
    
    return true;
  } catch (error) {
    console.error('Failed to start recording:', error);
    return false;
  }
}

/**
 * Stop recording
 */
export async function stopRecording(recorder) {
  return new Promise((resolve) => {
    if (!recorder.mediaRecorder || !recorder.isRecording) {
      resolve(null);
      return;
    }
    
    recorder.mediaRecorder.onstop = async () => {
      const blob = new Blob(recorder.chunks, { type: recorder.mediaRecorder.mimeType });
      
      // Stop all tracks
      if (recorder.stream) {
        recorder.stream.getTracks().forEach((track) => track.stop());
      }
      
      recorder.isRecording = false;
      
      // Convert to AudioBuffer
      try {
        const arrayBuffer = await blob.arrayBuffer();
        const ctx = getAudioContext();
        const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
        resolve({ blob, audioBuffer });
      } catch (error) {
        resolve(blob);
      }
    };
    
    recorder.mediaRecorder.stop();
  });
}

/**
 * Get recording level
 */
export function getRecordingLevel(recorder) {
  if (!recorder.analyser) return 0;
  
  const dataArray = new Uint8Array(recorder.analyser.frequencyBinCount);
  recorder.analyser.getByteFrequencyData(dataArray);
  
  let sum = 0;
  for (let i = 0; i < dataArray.length; i++) {
    sum += dataArray[i];
  }
  
  return sum / dataArray.length / 255;
}

// ==================== UTILITIES ====================

/**
 * Convert dB to linear
 */
export function dbToLinear(db) {
  return Math.pow(10, db / 20);
}

/**
 * Convert linear to dB
 */
export function linearToDb(linear) {
  return 20 * Math.log10(linear);
}

/**
 * Format time for display
 */
export function formatAudioTime(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 100);
  
  return `${mins}:${String(secs).padStart(2, '0')}.${String(ms).padStart(2, '0')}`;
}

/**
 * Format volume for display
 */
export function formatVolume(volume) {
  if (volume === 0) return 'Mute';
  if (volume < 50) return `${Math.round(volume * 2)}%`;
  if (volume === 100) return '100%';
  if (volume > 100) return `+${Math.round(volume - 100)}%`;
  return `${volume}%`;
}
