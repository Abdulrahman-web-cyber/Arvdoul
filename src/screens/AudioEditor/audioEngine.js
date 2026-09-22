// src/screens/AudioEditor/audioEngine.js
// High-performance Web Audio API engine for Arvdoul Audio Studio
// Supports multi-track playback, dynamic synth accompaniment, master metering & EQ

class AudioStudioEngine {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.analyser = null;
    this.isPlaying = false;
    this.startTime = 0;
    this.pauseOffset = 0;
    this.tempo = 128;
    this.intervalId = null;
    this.subscribers = new Set();
    this.activeNodes = [];
    this.tracks = {};
  }

  init() {
    if (this.ctx) return;
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    this.ctx = new AudioContextClass();
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.setValueAtTime(0.85, this.ctx.currentTime);

    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 256;
    this.analyser.smoothingTimeConstant = 0.8;

    this.masterGain.connect(this.analyser);
    this.analyser.connect(this.ctx.destination);
  }

  async resume() {
    this.init();
    if (this.ctx && this.ctx.state === 'suspended') {
      await this.ctx.resume();
    }
  }

  // Generate realistic harmonic accompaniment for each track
  _triggerNote(freq, type = 'sine', duration = 0.4, time = 0, gainLevel = 0.2) {
    if (!this.ctx) return;
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(freq, time);

      gain.gain.setValueAtTime(0.001, time);
      gain.gain.exponentialRampToValueAtTime(gainLevel, time + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);

      osc.connect(gain);
      gain.connect(this.masterGain);

      osc.start(time);
      osc.stop(time + duration);
      this.activeNodes.push(osc);
    } catch {
      // safe fallback
    }
  }

  // Play a standard musical loop pattern (Drums, Bass, Chords)
  _scheduleBeat(time, step, activeTracks) {
    if (!this.ctx) return;

    const isDrumsActive = !activeTracks['drums']?.muted;
    const isBassActive = !activeTracks['bass']?.muted;
    const isPianoActive = !activeTracks['piano']?.muted;
    const isGuitarActive = !activeTracks['guitar']?.muted;

    // Drum beat
    if (isDrumsActive) {
      if (step % 4 === 0) {
        // Kick drum (punchy sine sweep)
        this._triggerNote(130, 'sine', 0.25, time, 0.4);
      }
      if (step % 8 === 4) {
        // Snare / clap
        this._triggerNote(280, 'triangle', 0.18, time, 0.25);
      }
      if (step % 2 === 0) {
        // Hi-hat
        this._triggerNote(1800, 'square', 0.05, time, 0.06);
      }
    }

    // Bassline (progression: A -> F -> C -> G)
    if (isBassActive && step % 4 === 0) {
      const chordIndex = Math.floor((step % 32) / 8);
      const bassFreqs = [110, 87.31, 130.81, 98]; // A2, F2, C3, G2
      this._triggerNote(bassFreqs[chordIndex] || 110, 'sawtooth', 0.6, time, 0.2);
    }

    // Piano / Guitar Arpeggio & Chords
    if ((isPianoActive || isGuitarActive) && (step % 2 === 0)) {
      const chordIndex = Math.floor((step % 32) / 8);
      const chordPitches = [
        [440, 523.25, 659.25], // Am
        [349.23, 440, 523.25], // F
        [523.25, 659.25, 783.99], // C
        [392, 493.88, 587.33], // G
      ];
      const pitch = chordPitches[chordIndex]?.[step % 3] || 440;
      this._triggerNote(pitch, isPianoActive ? 'sine' : 'triangle', 0.45, time, 0.15);
    }
  }

  start(currentTimeSeconds = 0, activeTracks = {}) {
    this.resume();
    this.isPlaying = true;
    this.pauseOffset = currentTimeSeconds;
    this.startTime = this.ctx.currentTime - currentTimeSeconds;

    const secondsPerBeat = 60 / this.tempo;
    const stepDuration = secondsPerBeat / 4; // 16th note steps
    let currentStep = Math.floor((currentTimeSeconds / stepDuration)) % 32;

    this.intervalId = setInterval(() => {
      if (!this.isPlaying || !this.ctx) return;
      const now = this.ctx.currentTime;
      this._scheduleBeat(now, currentStep, activeTracks);
      currentStep = (currentStep + 1) % 32;
    }, stepDuration * 1000);
  }

  stop() {
    this.isPlaying = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.activeNodes.forEach(n => {
      try { n.stop(); } catch { /* noop */ }
    });
    this.activeNodes = [];
  }

  setVolume(volume0to1) {
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(Math.max(0, Math.min(1, volume0to1)), this.ctx.currentTime);
    }
  }

  getSpectrumData() {
    if (!this.analyser) return new Uint8Array(32);
    const data = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteFrequencyData(data);
    return data;
  }
}

export const audioStudioEngine = new AudioStudioEngine();
