// src/screens/PostCard/AudioCard.jsx
import React, { useState, useEffect, useRef, useCallback, useMemo, useSyncExternalStore } from 'react';
import { motion } from 'framer-motion';
import { Play, Pause, Volume2, VolumeX, Music, RotateCcw, RotateCw, Loader2 } from 'lucide-react';
import { create } from 'zustand';
import { openDB } from 'idb';

// ------------------------------------------------------------------
// 1. ZUSTAND STORE – Single source of truth for playback state
// ------------------------------------------------------------------
const useAudioStore = create((set, get) => ({
  // Global manager instance (set after init)
  manager: null,
  setManager: (mgr) => set({ manager: mgr }),
  // Reactive state (subscribed by components)
  currentCardId: null,
  currentTime: 0,
  duration: 0,
  isPlaying: false,
  updateState: (cardId, time, dur, playing) => set({
    currentCardId: cardId,
    currentTime: time,
    duration: dur,
    isPlaying: playing,
  }),
  resetState: () => set({
    currentCardId: null,
    currentTime: 0,
    duration: 0,
    isPlaying: false,
  }),
}));

// ------------------------------------------------------------------
// 2. GLOBAL AUDIO MANAGER (Singleton)
//    - Safe source creation (never disconnect)
//    - Reactive store updates
//    - Watchdog, focus recovery, media session
// ------------------------------------------------------------------
class GlobalAudioManager {
  constructor() {
    if (GlobalAudioManager.instance) return GlobalAudioManager.instance;
    this.audioContext = null;
    this.currentCardId = null;
    this.currentElement = null;
    this.currentAnalyser = null;
    this.currentGain = null;
    this.isInitialized = false;
    this.sourceMap = new WeakMap(); // audio element -> source (never disconnected)
    this.watchdogInterval = null;
    this.recoveryHandler = null;
    this.userPaused = false;
    this.store = useAudioStore;
    this._timeUpdateRAF = null;
    this._pendingTime = 0;
    GlobalAudioManager.instance = this;
  }

  async init() {
    if (this.isInitialized) return;
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    this.audioContext = new AudioContextClass();
    this.isInitialized = true;
    this.store.getState().setManager(this);

    // Focus recovery
    this.recoveryHandler = () => {
      if (!this.audioContext) return;
      if (this.audioContext.state === 'suspended') {
        this.audioContext.resume().catch(() => {});
      }
      if (this.currentElement && !this.currentElement.paused && !this.userPaused) {
        this.currentElement.play().catch(() => {});
      }
    };
    document.addEventListener('visibilitychange', this.recoveryHandler);
    window.addEventListener('focus', this.recoveryHandler);

    // Watchdog for stuck audio
    let lastUserInteraction = Date.now();
    this.watchdogInterval = setInterval(() => {
      const el = this.currentElement;
      if (el && !el.paused && !el.ended && this.audioContext?.state === 'running') {
        if (el.currentTime === 0 && Date.now() - lastUserInteraction > 3000) {
          console.warn('Arvdoul audio watchdog: stuck, forcing recovery');
          el.play().catch(() => {});
        }
      }
    }, 2000);

    // Media session handlers (set once)
    if (navigator.mediaSession) {
      navigator.mediaSession.setActionHandler('play', () => {
        if (this.currentElement) this.currentElement.play();
      });
      navigator.mediaSession.setActionHandler('pause', () => {
        if (this.currentElement) this.currentElement.pause();
      });
      navigator.mediaSession.setActionHandler('seekbackward', (details) => {
        if (this.currentElement) {
          this.currentElement.currentTime = Math.max(0, this.currentElement.currentTime - (details.seekOffset || 10));
        }
      });
      navigator.mediaSession.setActionHandler('seekforward', (details) => {
        if (this.currentElement) {
          this.currentElement.currentTime = Math.min(this.currentElement.duration, this.currentElement.currentTime + (details.seekOffset || 10));
        }
      });
    }
  }

  // Get or create source for an audio element (never disconnect)
  _getOrCreateSource(audioElement) {
    if (this.sourceMap.has(audioElement)) return this.sourceMap.get(audioElement);
    const source = this.audioContext.createMediaElementSource(audioElement);
    this.sourceMap.set(audioElement, source);
    return source;
  }

  // Create full pipeline for a card (only if not already active)
  async ensurePipeline(cardId, audioElement, volume) {
    await this.init();
    if (this.currentCardId === cardId && this.currentElement === audioElement) return;
    // Stop previous card
    if (this.currentElement) {
      this.currentElement.pause();
      this.currentElement.currentTime = 0;
    }
    // Create pipeline
    const source = this._getOrCreateSource(audioElement);
    const analyser = this.audioContext.createAnalyser();
    analyser.fftSize = 256;
    const gain = this.audioContext.createGain();
    gain.gain.value = volume;
    source.connect(analyser);
    analyser.connect(gain);
    gain.connect(this.audioContext.destination);
    this.currentAnalyser = analyser;
    this.currentGain = gain;
    this.currentElement = audioElement;
    this.currentCardId = cardId;
    this.userPaused = false;
    this._updateStore();
  }

  async play(cardId, audioElement, volume, speed) {
    await this.ensurePipeline(cardId, audioElement, volume);
    if (this.audioContext.state === 'suspended') await this.audioContext.resume();
    audioElement.playbackRate = speed;
    await audioElement.play();
    this.userPaused = false;
    this._updateMediaSession(audioElement);
    this._startTimeUpdatePolling();
    this._updateStore();
  }

  pause(cardId, audioElement, isUserAction = true) {
    if (this.currentCardId === cardId && this.currentElement === audioElement && !audioElement.paused) {
      if (isUserAction) this.userPaused = true;
      audioElement.pause();
      this._updateStore();
    }
  }

  resetOnEnd() {
    if (this.currentElement) {
      this.currentElement.pause();
      this.currentElement.currentTime = 0;
    }
    this.currentElement = null;
    this.currentCardId = null;
    this.currentAnalyser = null;
    this.currentGain = null;
    this.userPaused = false;
    this._stopTimeUpdatePolling();
    this.store.getState().resetState();
  }

  // Throttled time update to store (max 1 per second for React)
  _startTimeUpdatePolling() {
    if (this._timeUpdateRAF) return;
    const update = () => {
      if (this.currentElement && !this.currentElement.paused) {
        const time = this.currentElement.currentTime;
        if (Math.abs(time - this._pendingTime) > 0.05) {
          this._pendingTime = time;
          this.store.getState().updateState(
            this.currentCardId,
            time,
            this.currentElement.duration || 0,
            true
          );
        }
      }
      this._timeUpdateRAF = requestAnimationFrame(update);
    };
    this._timeUpdateRAF = requestAnimationFrame(update);
  }
  _stopTimeUpdatePolling() {
    if (this._timeUpdateRAF) {
      cancelAnimationFrame(this._timeUpdateRAF);
      this._timeUpdateRAF = null;
    }
  }

  _updateStore() {
    const el = this.currentElement;
    this.store.getState().updateState(
      this.currentCardId,
      el ? el.currentTime : 0,
      el ? el.duration || 0 : 0,
      el ? !el.paused : false
    );
  }

  _updateMediaSession(audioElement) {
    if (!navigator.mediaSession) return;
    navigator.mediaSession.metadata = new MediaMetadata({
      title: audioElement.src.split('/').pop() || 'Audio',
      artist: 'Arvdoul Creator',
      album: 'Audio Post',
    });
  }

  getAnalyser() { return this.currentAnalyser; }
  getCurrentCardId() { return this.currentCardId; }

  destroy() {
    if (this.watchdogInterval) clearInterval(this.watchdogInterval);
    if (this.recoveryHandler) {
      document.removeEventListener('visibilitychange', this.recoveryHandler);
      window.removeEventListener('focus', this.recoveryHandler);
    }
    if (this.audioContext) this.audioContext.close();
    this.resetOnEnd();
  }
}

const globalAudioManager = new GlobalAudioManager();

// ------------------------------------------------------------------
// 3. REACT HOOK TO SUBSCRIBE TO AUDIO STATE (useSyncExternalStore)
// ------------------------------------------------------------------
const audioStore = useAudioStore;
function useAudioState() {
  const state = useSyncExternalStore(
    (callback) => {
      // Subscribe to Zustand store changes
      const unsub = audioStore.subscribe(callback);
      // Also listen to audio element events (play/pause/timeupdate) via manager's polling
      return unsub;
    },
    () => audioStore.getState(),
    () => audioStore.getState()
  );
  return state;
}

// ------------------------------------------------------------------
// 4. AUDIO CACHE (IndexedDB)
// ------------------------------------------------------------------
class AudioCache {
  constructor() { this.dbPromise = null; this.init(); }
  async init() {
    if (typeof window === 'undefined') return;
    this.dbPromise = openDB('ArvdoulAudioCache', 1, {
      upgrade(db) { if (!db.objectStoreNames.contains('audio')) db.createObjectStore('audio', { keyPath: 'url' }); },
    });
  }
  async get(url) {
    if (!this.dbPromise) return null;
    const db = await this.dbPromise;
    const record = await db.get('audio', url);
    return record?.blob || null;
  }
  async set(url, blob) {
    if (!this.dbPromise) return;
    const db = await this.dbPromise;
    await db.put('audio', { url, blob, timestamp: Date.now() });
  }
}
const audioCache = new AudioCache();

// ------------------------------------------------------------------
// 5. HELPERS
// ------------------------------------------------------------------
const haptic = (pattern = 10) => {
  if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(pattern);
};

const safeLocalStorage = {
  get: (key, fallback) => {
    if (typeof window === 'undefined') return fallback;
    try { const v = localStorage.getItem(key); return v !== null ? JSON.parse(v) : fallback; } catch { return fallback; }
  },
  set: (key, value) => {
    if (typeof window === 'undefined') return;
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) {}
  },
};

// Exact neon gradient (matches play button)
const getNeonWaveGradient = (ctx, width, height, tokens) => {
  const primary = tokens.audioNeonPrimary || '#9333ea';
  const secondary = tokens.audioNeonSecondary || '#c026d3';
  const accent = tokens.audioNeonAccent || '#00c2ff';
  const gradient = ctx.createLinearGradient(0, 0, width, 0);
  gradient.addColorStop(0, primary);
  gradient.addColorStop(0.4, secondary);
  gradient.addColorStop(0.8, '#ec4899');
  gradient.addColorStop(1, accent);
  return gradient;
};

// ------------------------------------------------------------------
// 6. MAIN COMPONENT
// ------------------------------------------------------------------
const AudioCard = React.memo(({
  audio,
  tokens,
  isVisible,
  isNearViewport,
  currentUser,
  postId,
}) => {
  const audioRef = useRef(null);
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const animationId = useRef(null);
  const resizeObserverRef = useRef(null);
  const abortControllerRef = useRef(null);
  const blobUrlRef = useRef(null);
  const cardIdRef = useRef(`audio_${postId || audio?.url || Date.now()}`);
  const gradientCacheRef = useRef(null);
  const waveformCacheRef = useRef(new Map()); // keyed by audio.id or url
  const analyserDataArray = useRef(null);
  const canvasDimRef = useRef({ width: 0, height: 0 });
  const lastDrawTimeRef = useRef(0);
  const isMountedRef = useRef(true);

  // Global audio state from store (reactive)
  const { currentCardId, currentTime, duration, isPlaying } = useAudioState();
  const isActuallyPlaying = isPlaying && currentCardId === cardIdRef.current;

  // Persisted settings
  const [volume, setVolume] = useState(() => safeLocalStorage.get('arvdoul_audio_volume', 0.8));
  const [speed, setSpeed] = useState(() => safeLocalStorage.get('arvdoul_audio_speed', 1));
  const [isLoading, setIsLoading] = useState(false);
  const [muted, setMuted] = useState(false);
  const [displayTime, setDisplayTime] = useState(0); // for UI label (throttled)
  const [isDraggingSeek, setIsDraggingSeek] = useState(false);

  // Waveform data (cached by audio id)
  const rawWaveform = useMemo(() => {
    if (audio?.waveformData && Array.isArray(audio.waveformData)) return audio.waveformData;
    return Array.from({ length: 64 }, (_, i) => 20 + Math.sin(i * 0.4) * 15 + Math.random() * 8);
  }, [audio?.waveformData]);
  const waveformKey = audio?.id || audio?.url;
  if (!waveformCacheRef.current.has(waveformKey)) {
    waveformCacheRef.current.set(waveformKey, rawWaveform.map(v => v / 100));
  }
  const waveformData = waveformCacheRef.current.get(waveformKey);

  const formatTime = (sec) => {
    if (!sec && sec !== 0) return '0:00';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  // Throttle display time (once per second)
  useEffect(() => {
    const interval = setInterval(() => {
      setDisplayTime(currentTime);
    }, 1000);
    return () => clearInterval(interval);
  }, [currentTime]);

  // Smart preload
  useEffect(() => {
    if (isNearViewport && audioRef.current && audioRef.current.src !== audio?.url) {
      audioRef.current.preload = 'metadata';
      audioRef.current.load();
    } else if (!isNearViewport && audioRef.current && !isVisible) {
      audioRef.current.preload = 'none';
      audioRef.current.load();
    }
  }, [isNearViewport, isVisible, audio?.url]);

  // Canvas resize observer (only when dimensions actually change)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const updateCanvasSize = () => {
      const rect = canvas.parentElement?.getBoundingClientRect();
      if (rect && (rect.width !== canvasDimRef.current.width || rect.height !== canvasDimRef.current.height)) {
        canvasDimRef.current = { width: rect.width, height: rect.height };
        // Resize canvas buffer
        const ctx = canvas.getContext('2d');
        const dpr = window.devicePixelRatio || 1;
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.scale(dpr, dpr);
        gradientCacheRef.current = null; // force gradient regeneration
      }
    };
    updateCanvasSize();
    resizeObserverRef.current = new ResizeObserver(updateCanvasSize);
    if (canvas.parentElement) resizeObserverRef.current.observe(canvas.parentElement);
    return () => {
      if (resizeObserverRef.current) resizeObserverRef.current.disconnect();
    };
  }, []);

  // Gradient cache invalidation
  useEffect(() => {
    gradientCacheRef.current = null;
  }, [tokens]);

  // Animation loop (independent of React, uses refs)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let rafId = null;
    analyserDataArray.current = new Uint8Array(256);

    const draw = () => {
      const { width, height } = canvasDimRef.current;
      if (width === 0) {
        rafId = requestAnimationFrame(draw);
        return;
      }
      const now = performance.now();
      if (isActuallyPlaying && now - lastDrawTimeRef.current < 33) {
        rafId = requestAnimationFrame(draw);
        return;
      }
      lastDrawTimeRef.current = now;

      // Prepare gradient (cached)
      if (!gradientCacheRef.current) {
        gradientCacheRef.current = getNeonWaveGradient(ctx, width, height, tokens);
      }
      const gradient = gradientCacheRef.current;
      const progressRatio = duration ? currentTime / duration : 0;
      const playedX = width * progressRatio;

      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = tokens.cardBgAlt || 'rgba(0,0,0,0.2)';
      ctx.fillRect(0, 0, width, height);

      const activeAnalyser = globalAudioManager.getAnalyser();
      const isActiveCard = globalAudioManager.getCurrentCardId() === cardIdRef.current;
      let bars = waveformData;
      let isLive = false;

      if (isActuallyPlaying && isActiveCard && activeAnalyser) {
        activeAnalyser.getByteFrequencyData(analyserDataArray.current);
        bars = Array.from(analyserDataArray.current.slice(0, 48));
        isLive = true;
      }

      const barCount = Math.min(bars.length, 48);
      const barWidth = Math.max(2, width / barCount - 1);
      for (let i = 0; i < barCount; i++) {
        let barHeight;
        if (isLive) {
          barHeight = (bars[i] / 255) * height * 0.7 + 3;
        } else {
          barHeight = (bars[i] || 0.3) * height * 0.7 + 3;
        }
        const x = i * (barWidth + 1);
        ctx.fillStyle = x < playedX ? gradient : `${tokens.audioNeonPrimary || '#9333ea'}80`;
        ctx.fillRect(x, height - barHeight, barWidth, barHeight);
      }

      if (isActuallyPlaying || isDraggingSeek) {
        rafId = requestAnimationFrame(draw);
      } else {
        rafId = null;
      }
    };
    draw();
    return () => {
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [isActuallyPlaying, duration, currentTime, tokens, waveformData, isDraggingSeek]);

  // Play/Pause with cache and proper load sequencing
  const togglePlay = useCallback(async () => {
    const audioEl = audioRef.current;
    if (!audioEl) return;
    if (isActuallyPlaying) {
      globalAudioManager.pause(cardIdRef.current, audioEl, true);
      haptic(10);
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }
    } else {
      setIsLoading(true);
      haptic(10);
      if (abortControllerRef.current) abortControllerRef.current.abort();
      abortControllerRef.current = new AbortController();
      const signal = abortControllerRef.current.signal;
      try {
        let blob = await audioCache.get(audio?.url);
        if (blob) {
          const url = URL.createObjectURL(blob);
          blobUrlRef.current = url;
          audioEl.src = url;
        } else {
          audioEl.src = audio?.url;
          // Background fetch for cache
          fetch(audio?.url, { signal }).then(res => res.blob()).then(b => {
            if (isMountedRef.current) audioCache.set(audio?.url, b);
          }).catch(() => {});
        }
        // Wait for metadata to be ready
        await new Promise((resolve, reject) => {
          const onLoaded = () => { audioEl.removeEventListener('loadedmetadata', onLoaded); resolve(); };
          const onError = () => { audioEl.removeEventListener('error', onError); reject(new Error('load failed')); };
          audioEl.addEventListener('loadedmetadata', onLoaded);
          audioEl.addEventListener('error', onError);
          if (audioEl.readyState >= 1) resolve();
        });
        if (signal.aborted) return;
        await globalAudioManager.play(cardIdRef.current, audioEl, volume, speed);
      } catch (err) {
        if (err.name !== 'AbortError') console.error('Playback failed', err);
        setIsLoading(false);
      }
    }
  }, [isActuallyPlaying, volume, speed, audio?.url]);

  // Skip with clamping and buffering guard
  const skip = useCallback((seconds) => {
    const audioEl = audioRef.current;
    if (!audioEl) return;
    if (audioEl.readyState < 1) return;
    let newTime = audioEl.currentTime + seconds;
    newTime = Math.max(0, Math.min(audioEl.duration || 0, newTime));
    audioEl.currentTime = newTime;
    haptic(5);
  }, []);

  // Seek via pointer with RAF
  const seekRAF = useRef(null);
  const handlePointerSeek = useCallback((e) => {
    if (!audioRef.current || !duration) return;
    if (seekRAF.current) cancelAnimationFrame(seekRAF.current);
    seekRAF.current = requestAnimationFrame(() => {
      const rect = e.currentTarget.getBoundingClientRect();
      let percent = (e.clientX - rect.left) / rect.width;
      percent = Math.min(1, Math.max(0, percent));
      audioRef.current.currentTime = percent * duration;
      seekRAF.current = null;
    });
  }, [duration]);

  const handleSeekStart = () => setIsDraggingSeek(true);
  const handleSeekEnd = () => setIsDraggingSeek(false);

  // Keyboard scrubbing on waveform
  const handleKeyDown = useCallback((e) => {
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      skip(-10);
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      skip(10);
    }
  }, [skip]);

  // Volume & mute
  const toggleMute = useCallback(() => {
    const nextMuted = !muted;
    setMuted(nextMuted);
    if (audioRef.current) audioRef.current.muted = nextMuted;
    haptic(5);
  }, [muted]);

  const changeVolume = useCallback((e) => {
    const val = parseFloat(e.target.value);
    setVolume(val);
    safeLocalStorage.set('arvdoul_audio_volume', val);
    if (audioRef.current) {
      audioRef.current.volume = val;
      if (val === 0) setMuted(true);
      else if (muted) setMuted(false);
    }
  }, [muted]);

  // Speed
  const cycleSpeed = useCallback(() => {
    const speeds = [0.5, 0.75, 1, 1.25, 1.5, 2];
    const idx = speeds.indexOf(speed);
    const next = speeds[(idx + 1) % speeds.length];
    setSpeed(next);
    safeLocalStorage.set('arvdoul_audio_speed', next);
    if (audioRef.current) audioRef.current.playbackRate = next;
    haptic(5);
  }, [speed]);

  // Global keyboard shortcuts
  useEffect(() => {
    const handleKey = (e) => {
      const activeEl = document.activeElement;
      const isInput = activeEl?.tagName === 'INPUT' || activeEl?.tagName === 'TEXTAREA' || activeEl?.isContentEditable;
      if (isInput) return;
      if (!containerRef.current?.contains(activeEl) && activeEl?.tagName !== 'BODY') return;
      if (e.code === 'Space') { e.preventDefault(); togglePlay(); }
      else if (e.code === 'ArrowLeft') { skip(-10); }
      else if (e.code === 'ArrowRight') { skip(10); }
      else if (e.code === 'KeyM') { toggleMute(); }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [togglePlay, skip, toggleMute]);

  // Auto-pause when not visible
  useEffect(() => {
    if (!isVisible && isActuallyPlaying) {
      globalAudioManager.pause(cardIdRef.current, audioRef.current, false);
    }
  }, [isVisible, isActuallyPlaying]);

  // Cleanup on unmount
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      const audioEl = audioRef.current;
      if (audioEl) {
        audioEl.pause();
        audioEl.src = '';
        audioEl.load();
      }
      if (abortControllerRef.current) abortControllerRef.current.abort();
      if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
      if (globalAudioManager.getCurrentCardId() === cardIdRef.current) {
        globalAudioManager.resetOnEnd();
      }
    };
  }, []);

  // Invalidate WebAudio source when audio URL changes (no need, source stays connected)
  // But we must update the store's duration
  const handleLoadedMetadata = useCallback(() => {
    if (audioRef.current) {
      const dur = audioRef.current.duration;
      const finiteDur = Number.isFinite(dur) ? dur : 0;
      // Update store duration (will be picked up by global manager via polling)
      useAudioStore.getState().updateState(
        useAudioStore.getState().currentCardId,
        useAudioStore.getState().currentTime,
        finiteDur,
        useAudioStore.getState().isPlaying
      );
      audioRef.current.volume = volume;
      audioRef.current.playbackRate = speed;
    }
  }, [volume, speed]);

  const handleEnded = useCallback(() => {
    globalAudioManager.resetOnEnd();
  }, []);

  const handleWaiting = useCallback(() => setIsLoading(true), []);
  const handleCanPlay = useCallback(() => setIsLoading(false), []);
  const handlePlaying = useCallback(() => setIsLoading(false), []);
  const handleError = useCallback(() => {
    setIsLoading(false);
    console.error('Audio error');
  }, []);

  const progress = duration ? (currentTime / duration) * 100 : 0;
  const neonButtonGradient = `linear-gradient(135deg, ${tokens.audioNeonPrimary || '#9333ea'}, ${tokens.audioNeonSecondary || '#c026d3'}, #ec4899)`;
  const buttonGlow = `0 0 20px rgba(236, 72, 153, 0.45), 0 0 40px rgba(147, 51, 234, 0.3)`;
  const volumeFillPercent = (volume / 1) * 100;
  const volumeGradient = `linear-gradient(90deg, ${tokens.audioNeonPrimary || '#9333ea'} ${volumeFillPercent}%, #444 ${volumeFillPercent}%)`;
  const equaliserBars = [4, 8, 12, 8, 6, 10, 14, 8];

  return (
    <motion.div
      ref={containerRef}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 10 }}
      className="relative overflow-hidden rounded-3xl border backdrop-blur-sm"
      style={{
        backgroundColor: tokens.cardBg,
        borderColor: tokens.border,
        boxShadow: `${tokens.shadowAmbient}, ${tokens.shadowDirectional}, 0 12px 40px -12px rgba(0,0,0,0.3)`,
      }}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      role="region"
      aria-label="Audio player"
    >
      <div className="p-4 flex flex-col gap-3">
        {/* Header */}
        <div className="flex items-center gap-4">
          <div className="relative flex-shrink-0">
            <div
              className="w-14 h-14 rounded-full flex items-center justify-center shadow-xl transition-all duration-500"
              style={{
                background: neonButtonGradient,
                boxShadow: isActuallyPlaying ? buttonGlow : '0 8px 20px rgba(0,0,0,0.2)',
              }}
            >
              {isActuallyPlaying ? (
                <div className="flex items-center justify-center gap-0.5">
                  {equaliserBars.map((height, idx) => (
                    <motion.div
                      key={idx}
                      animate={{ height: [height, height * 1.5, height] }}
                      transition={{ duration: 0.5, repeat: Infinity, delay: idx * 0.05 }}
                      className="w-1 bg-white rounded-full"
                      style={{ height }}
                    />
                  ))}
                </div>
              ) : (
                <Music className="w-7 h-7 text-white drop-shadow-md" />
              )}
            </div>
            {isActuallyPlaying && (
              <div className="absolute inset-0 rounded-full animate-ping opacity-40" style={{ background: neonButtonGradient, zIndex: -1 }} />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <span className="text-sm font-bold truncate block" style={{ color: tokens.text }}>
              {audio?.name || 'Untitled Audio'}
            </span>
            <span className="text-xs font-mono opacity-80" style={{ color: tokens.textSecondary }}>
              {formatTime(duration)}
            </span>
          </div>
        </div>

        {/* Waveform canvas with seek */}
        <div
          className="relative w-full h-14 cursor-pointer rounded-xl overflow-hidden"
          onPointerDown={handleSeekStart}
          onPointerUp={handleSeekEnd}
          onPointerMove={(e) => { if (e.buttons === 1) handlePointerSeek(e); }}
          onClick={handlePointerSeek}
          role="slider"
          aria-valuenow={currentTime}
          aria-valuemin={0}
          aria-valuemax={duration}
          aria-label="Audio seek bar"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'ArrowLeft') { e.preventDefault(); skip(-10); }
            else if (e.key === 'ArrowRight') { e.preventDefault(); skip(10); }
          }}
        >
          <canvas ref={canvasRef} className="w-full h-full rounded-xl pointer-events-none" />
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-white/90 shadow-lg pointer-events-none rounded-full"
            style={{ left: `${progress}%`, transform: 'translateX(-50%)' }}
          />
          <div className="sr-only" aria-live="polite" aria-atomic="true">
            {`Current time ${formatTime(currentTime)} of ${formatTime(duration)}`}
          </div>
        </div>

        {/* Controls */}
        <div className="flex flex-wrap items-center justify-center gap-3">
          <button
            onClick={() => skip(-10)}
            className="flex items-center gap-1 p-2 rounded-full hover:bg-white/10 dark:hover:bg-black/10 transition-all active:scale-95"
            aria-label="Rewind 10 seconds"
          >
            <RotateCcw className="w-4 h-4" style={{ color: tokens.text }} />
            <span className="text-xs font-medium">10s</span>
          </button>

          <button
            onClick={togglePlay}
            className="p-3 rounded-full shadow-lg transition-all active:scale-95 focus:outline-none focus:ring-4 focus:ring-pink-400/50 flex items-center justify-center min-w-[48px]"
            style={{ background: neonButtonGradient, boxShadow: buttonGlow }}
            aria-label={isActuallyPlaying ? 'Pause' : 'Play'}
            aria-pressed={isActuallyPlaying}
            disabled={isLoading}
          >
            {isLoading ? (
              <Loader2 className="w-5 h-5 text-white animate-spin" />
            ) : isActuallyPlaying ? (
              <Pause className="w-5 h-5 text-white" />
            ) : (
              <Play className="w-5 h-5 text-white" />
            )}
          </button>

          <button
            onClick={() => skip(10)}
            className="flex items-center gap-1 p-2 rounded-full hover:bg-white/10 dark:hover:bg-black/10 transition-all active:scale-95"
            aria-label="Forward 10 seconds"
          >
            <span className="text-xs font-medium">10s</span>
            <RotateCw className="w-4 h-4" style={{ color: tokens.text }} />
          </button>
        </div>

        {/* Volume, time, speed */}
        <div className="flex flex-wrap items-center justify-end gap-2 mt-1">
          <span className="text-xs font-mono" style={{ color: tokens.textSecondary }}>
            {formatTime(displayTime)}
          </span>
          <button onClick={toggleMute} className="p-1.5 rounded-full hover:bg-white/10 transition" aria-label={muted ? 'Unmute' : 'Mute'}>
            {muted ? <VolumeX className="w-4 h-4" style={{ color: tokens.text }} /> : <Volume2 className="w-4 h-4" style={{ color: tokens.text }} />}
          </button>
          <div className="relative w-24">
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={volume}
              onChange={changeVolume}
              className="w-full h-1 rounded-full appearance-none cursor-pointer"
              style={{ background: volumeGradient }}
              aria-label="Volume"
            />
            <style jsx>{`
              input[type="range"]::-webkit-slider-thumb {
                appearance: none;
                width: 12px;
                height: 12px;
                border-radius: 50%;
                background: white;
                box-shadow: 0 0 6px ${tokens.audioNeonPrimary || '#9333ea'};
                cursor: pointer;
              }
              input[type="range"]::-moz-range-thumb {
                width: 12px;
                height: 12px;
                border-radius: 50%;
                background: white;
                box-shadow: 0 0 6px ${tokens.audioNeonPrimary || '#9333ea'};
                cursor: pointer;
              }
            `}</style>
          </div>
          <button onClick={cycleSpeed} className="px-2 py-0.5 rounded-full text-xs font-medium bg-black/10 dark:bg-white/10 transition" style={{ color: tokens.text }}>
            {speed}x
          </button>
        </div>
      </div>

      <audio
        ref={audioRef}
        src={audio?.url}
        preload={isNearViewport ? 'metadata' : 'none'}
        onLoadedMetadata={handleLoadedMetadata}
        onPlay={() => setIsLoading(false)}
        onPause={() => {}}
        onEnded={handleEnded}
        onWaiting={handleWaiting}
        onCanPlay={handleCanPlay}
        onPlaying={handlePlaying}
        onError={handleError}
      />
    </motion.div>
  );
});

AudioCard.displayName = 'AudioCard';
export default AudioCard;