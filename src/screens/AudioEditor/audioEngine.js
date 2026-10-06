// src/screens/AudioEditor/audioEngine.js
//
// Web Audio graph for the Arvdoul Audio Studio.
//   clip BufferSource -> clipGain -> trackPanner -> trackGain ┐
//                                                             ├-> eqChain -> masterGain -> analyser -> destination
//   metronome Oscillator -------------------------------------┘
// Everything the UI shows is derived from this graph: the transport advances a
// real AudioContext clock, the meters read a real analyser, the EQ curve drives
// real BiquadFilterNodes. Nothing here invents a level or a frequency.

const METER_INTERVAL_MS = 100;
// BS.1770 K-weighting is a high-shelf followed by a high-pass. These are the
// standard analogue-prototype values; implemented here as biquads rather than a
// lookup table so the measurement stays real for any sample rate.
const K_WEIGHT_SHELF_HZ = 1681.97;
const K_WEIGHT_SHELF_GAIN_DB = 3.999;
const K_WEIGHT_HIGHPASS_HZ = 38.13;
const K_WEIGHT_HIGHPASS_Q = 0.5;

class AudioStudioEngine {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.analyser = null;
    this.meterAnalyser = null;
    this.eqNodes = [];
    this.trackNodes = new Map();
    this.activeSources = [];
    this.metronomeTimer = null;
    this.meterTimer = null;
    this.spectrumBuffer = null;

    this.isPlaying = false;
    this.startedAtContextTime = 0;
    this.startedAtPosition = 0;
    this.pausePosition = 0;
    this.tempo = 128;
    this.loop = false;
    this.loopEnd = 0;
    this.metronomeEnabled = false;
    this.scheduledUntil = 0;
    this.meter = { peakDb: -Infinity, momentaryLufs: null };
  }

  init() {
    if (this.ctx) return;
    const AudioContextClass = typeof window !== 'undefined'
      ? (window.AudioContext || window.webkitAudioContext)
      : null;
    if (!AudioContextClass) return;

    this.ctx = new AudioContextClass();

    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = 0.85;

    // Spectrum for the visualiser.
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 1024;
    this.analyser.smoothingTimeConstant = 0.8;

    // Separate analyser reserved for loudness/peak so visual smoothing never
    // distorts the measurement.
    this.meterAnalyser = this.ctx.createAnalyser();
    this.meterAnalyser.fftSize = 2048;
    this.meterAnalyser.smoothingTimeConstant = 0;

    this.masterGain.connect(this.analyser);
    this.masterGain.connect(this.meterAnalyser);
    this.analyser.connect(this.ctx.destination);
  }

  async resume() {
    this.init();
    if (this.ctx && this.ctx.state === 'suspended') {
      await this.ctx.resume();
    }
  }

  get isReady() {
    return Boolean(this.ctx);
  }

  /** Position derived from the AudioContext clock, not a JavaScript counter. */
  getPosition() {
    if (!this.isPlaying || !this.ctx) return this.pausePosition;
    const elapsed = this.ctx.currentTime - this.startedAtContextTime;
    return this.startedAtPosition + elapsed;
  }

  // EQ chain

  /**
   * Rebuilds the master EQ chain from a band list.
   * @param {Array<{type:string,freq:number,gain:number,q:number}>} bands
   * @param {boolean} enabled
   */
  applyEq(bands, enabled) {
    this.init();
    if (!this.ctx) return;

    this.eqNodes.forEach((node) => {
      try { node.disconnect(); } catch { /* already detached */ }
    });
    this.eqNodes = [];

    const usable = enabled ? (bands || []) : [];
    const chain = [];

    usable.forEach((band) => {
      const node = this.ctx.createBiquadFilter();
      if (band.type === 'HPF') {
        node.type = 'highpass';
        node.frequency.value = band.freq;
        node.Q.value = band.q || 0.707;
      } else if (band.type === 'LPF') {
        node.type = 'lowpass';
        node.frequency.value = band.freq;
        node.Q.value = band.q || 0.707;
      } else {
        node.type = 'peaking';
        node.frequency.value = band.freq;
        node.gain.value = band.gain;
        node.Q.value = band.q || 1;
      }
      chain.push(node);
      this.eqNodes.push(node);
    });

    try { this.masterGain.disconnect(this.analyser); } catch { /* not connected */ }

    if (chain.length === 0) {
      this.masterGain.connect(this.analyser);
      return;
    }

    this.masterGain.connect(chain[0]);
    for (let i = 0; i < chain.length - 1; i += 1) chain[i].connect(chain[i + 1]);
    chain[chain.length - 1].connect(this.analyser);
  }

  // Transport

  /**
   * Starts playback.
   * @param {Object} state
   * @param {number} state.position        seconds to start from
   * @param {Array}  state.tracks          [{ id, muted, solo, volume(dB), pan(-50..50), clips }]
   * @param {number} [state.duration]      project length, for looping
   * @param {boolean} [state.loop]
   * @param {number} [state.tempo]         BPM, drives the metronome
   * @param {boolean} [state.metronome]
   */
  start(state = {}) {
    this.resume();
    if (!this.ctx) return;

    const {
      position = 0,
      tracks = [],
      duration = 0,
      loop = false,
      tempo = this.tempo,
      metronome = false,
    } = state;

    this.tempo = tempo;
    this.loop = loop;
    this.loopEnd = duration;
    this.metronomeEnabled = metronome;

    this.stopSources();
    this.isPlaying = true;
    this.startedAtPosition = position;
    this.startedAtContextTime = this.ctx.currentTime;
    this.pausePosition = position;

    this._scheduleTracks(tracks, position);
    if (metronome) this._startMetronome(position);
    this._startMeter();
  }

  _scheduleTracks(tracks, position) {
    const anySolo = tracks.some((t) => t.solo);
    const now = this.ctx.currentTime;

    tracks.forEach((track) => {
      const audible = !track.muted && (!anySolo || track.solo);

      const gain = this.ctx.createGain();
      gain.gain.value = audible ? Math.pow(10, (track.volume ?? 0) / 20) : 0;

      const panner = this.ctx.createStereoPanner();
      panner.pan.value = Math.max(-1, Math.min(1, (track.pan ?? 0) / 50));

      gain.connect(panner);
      panner.connect(this.masterGain);

      this.trackNodes.set(track.id, { gain, panner });

      (track.clips || []).forEach((clip) => {
        if (!clip.buffer) return; // nothing decoded yet — the UI says so
        const clipEnd = clip.start + clip.duration;
        if (clipEnd <= position) return; // already behind the playhead

        const source = this.ctx.createBufferSource();
        source.buffer = clip.buffer;
        source.connect(gain);

        const offsetInClip = Math.max(0, position - clip.start);
        const when = now + Math.max(0, clip.start - position);
        const playDuration = clip.duration - offsetInClip;

        source.start(when, offsetInClip, playDuration);
        this.activeSources.push(source);
      });
    });
  }

  _startMetronome(position) {
    if (!this.ctx) return;
    const secondsPerBeat = 60 / Math.max(30, this.tempo);
    const nextBeatIndex = Math.ceil(position / secondsPerBeat);
    this.scheduledUntil = nextBeatIndex * secondsPerBeat;

    const tick = () => {
      if (!this.isPlaying || !this.ctx) return;
      const beatTime = this.startedAtContextTime + (this.scheduledUntil - this.startedAtPosition);
      const isDownbeat = Math.round(this.scheduledUntil / secondsPerBeat) % 4 === 0;
      this._click(beatTime, isDownbeat);
      this.scheduledUntil += secondsPerBeat;
    };

    tick();
    this.metronomeTimer = setInterval(tick, Math.max(50, secondsPerBeat * 1000));
  }

  _click(time, accent) {
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.frequency.value = accent ? 1600 : 1000;
      gain.gain.setValueAtTime(0.0001, time);
      gain.gain.exponentialRampToValueAtTime(accent ? 0.35 : 0.2, time + 0.002);
      gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.05);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(time);
      osc.stop(time + 0.06);
      this.activeSources.push(osc);
    } catch {
      /* click is best-effort */
    }
  }

  /** True once the playhead has run past the project length. */
  hasReachedEnd() {
    return this.loopEnd > 0 && this.getPosition() >= this.loopEnd;
  }

  stop() {
    this.pausePosition = this.getPosition();
    this.isPlaying = false;
    this.stopSources();
    if (this.metronomeTimer) {
      clearInterval(this.metronomeTimer);
      this.metronomeTimer = null;
    }
    this._stopMeter();
  }

  stopSources() {
    this.activeSources.forEach((node) => {
      try { node.stop(); } catch { /* already stopped */ }
      try { node.disconnect(); } catch { /* already detached */ }
    });
    this.activeSources = [];
    this.trackNodes.forEach(({ gain, panner }) => {
      try { gain.disconnect(); } catch { /* already detached */ }
      try { panner.disconnect(); } catch { /* already detached */ }
    });
    this.trackNodes.clear();
  }

  setVolume(volume0to1) {
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(Math.max(0, Math.min(1, volume0to1)), this.ctx.currentTime);
    }
  }

  // Metering — measured from the live signal, never synthesised

  _startMeter() {
    if (this.meterTimer || !this.meterAnalyser) return;
    const buffer = new Float32Array(this.meterAnalyser.fftSize);

    // K-weighting for the loudness reading: shelf then high-pass.
    const shelf = this.ctx.createBiquadFilter();
    shelf.type = 'highshelf';
    shelf.frequency.value = K_WEIGHT_SHELF_HZ;
    shelf.gain.value = K_WEIGHT_SHELF_GAIN_DB;
    const highpass = this.ctx.createBiquadFilter();
    highpass.type = 'highpass';
    highpass.frequency.value = K_WEIGHT_HIGHPASS_HZ;
    highpass.Q.value = K_WEIGHT_HIGHPASS_Q;
    try {
      this.masterGain.disconnect(this.meterAnalyser);
      this.masterGain.connect(shelf);
      shelf.connect(highpass);
      highpass.connect(this.meterAnalyser);
    } catch {
      /* metering is best-effort */
    }
    this._kWeight = { shelf, highpass };

    this.meterTimer = setInterval(() => {
      if (!this.meterAnalyser) return;
      this.meterAnalyser.getFloatTimeDomainData(buffer);
      let sumSquares = 0;
      let peak = 0;
      for (let i = 0; i < buffer.length; i += 1) {
        const v = buffer[i];
        sumSquares += v * v;
        const abs = Math.abs(v);
        if (abs > peak) peak = abs;
      }
      const rms = Math.sqrt(sumSquares / buffer.length);
      this.meter = {
        peakDb: peak > 0 ? 20 * Math.log10(peak) : -Infinity,
        momentaryLufs: rms > 0 ? -0.691 + 10 * Math.log10(rms * rms) : null,
      };
    }, METER_INTERVAL_MS);
  }

  _stopMeter() {
    if (this.meterTimer) {
      clearInterval(this.meterTimer);
      this.meterTimer = null;
    }
    if (this._kWeight) {
      try { this.masterGain.disconnect(this._kWeight.shelf); } catch { /* noop */ }
      try { this._kWeight.shelf.disconnect(); } catch { /* noop */ }
      try { this._kWeight.highpass.disconnect(); } catch { /* noop */ }
      this._kWeight = null;
    }
    if (this.masterGain) {
      try { this.masterGain.connect(this.meterAnalyser); } catch { /* noop */ }
    }
    this.meter = { peakDb: -Infinity, momentaryLufs: null };
  }

  /** @returns {{peakDb:number, momentaryLufs:number|null}} */
  getMeter() {
    return this.meter;
  }

  getSpectrumData() {
    if (!this.analyser) return new Uint8Array(32);
    const bins = this.analyser.frequencyBinCount;
    if (!this.spectrumBuffer || this.spectrumBuffer.length !== bins) {
      this.spectrumBuffer = new Uint8Array(bins);
    }
    this.analyser.getByteFrequencyData(this.spectrumBuffer);
    return this.spectrumBuffer;
  }

  /** Resolves the analyser's frequency-bin index for a musical frequency. */
  frequencyToBin(freq) {
    if (!this.ctx || !this.analyser) return 0;
    const nyquist = this.ctx.sampleRate / 2;
    return Math.round((freq / nyquist) * this.analyser.frequencyBinCount);
  }
}

export const audioStudioEngine = new AudioStudioEngine();
export default audioStudioEngine;
