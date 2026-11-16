// src/screens/AudioEditor/AudioEditorScreen.jsx
//
// Multitrack editor backed by the Web Audio graph in ./audioEngine.
// Supports local audio import, live microphone recording via MediaRecorder,
// parametric EQ, pan/gain mixing, and offline WAV mixdown export / Post handoff.

import { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Upload, Mic, Square, X } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { cn } from '../../lib/utils';
import { tokens } from '../../design-system/tokens.js';
import StudioHeader from './components/StudioHeader';
import MultiTrackConsole from './components/MultiTrackConsole';
import TransportBar from './components/TransportBar';
import EqualizerModule from './components/EqualizerModule';
import ClipInspectorModule from './components/ClipInspectorModule';
import BottomStudioNav from './components/BottomStudioNav';
import { audioStudioEngine } from './audioEngine';
import { getPresetBands, DEFAULT_EQ_PRESET } from './audioPresets';
import audioEditorService from '../../services/audioEditorService.js';

const createEmptyTrack = (index) => ({
  id: `track_${Date.now()}_${index}`,
  name: `Track ${index + 1}`,
  color: '#00C4FF',
  volume: 0,
  pan: 0,
  muted: false,
  solo: false,
  locked: false,
  clips: [],
});

function computeWaveformPeaks(audioBuffer, samples = 240) {
  if (!audioBuffer) return [];
  const data = audioBuffer.getChannelData(0);
  const blockSize = Math.max(1, Math.floor(data.length / samples));
  const peaks = [];
  for (let i = 0; i < samples; i += 1) {
    let maxVal = 0;
    const start = i * blockSize;
    const end = Math.min(data.length, start + blockSize);
    for (let j = start; j < end; j += 1) {
      const abs = Math.abs(data[j]);
      if (abs > maxVal) maxVal = abs;
    }
    peaks.push(Number(maxVal.toFixed(4)));
  }
  return peaks;
}

export default function AudioEditorScreen() {
  const { theme } = useTheme();
  const isDark = theme !== 'light';
  const location = useLocation();
  const navigate = useNavigate();

  const [projectName, setProjectName] = useState(location.state?.title || 'Untitled Audio Session');
  const [tracks, setTracks] = useState([]);
  const [currentTime, setCurrentTime] = useState(0);
  const [totalDuration, setTotalDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [tempo, setTempo] = useState(128);
  const [isLooping, setIsLooping] = useState(false);
  const [isMetronome, setIsMetronome] = useState(false);
  const [selectedClip, setSelectedClip] = useState(null);
  const [sourceLoaded, setSourceLoaded] = useState(false);
  const [sourceError, setSourceError] = useState(null);
  const [eqBands, setEqBands] = useState(() => getPresetBands(DEFAULT_EQ_PRESET));
  const [eqEnabled, setEqEnabled] = useState(true);
  const [exporting, setExporting] = useState(false);

  // Mic Recording & Project Settings Modal state
  const [isRecording, setIsRecording] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [sampleRate, setSampleRate] = useState(48000);
  const [masterVolume, setMasterVolume] = useState(0.85);
  const mediaRecorderRef = useRef(null);
  const recordedChunksRef = useRef([]);
  const audioInputRef = useRef(null);
  const eqSectionRef = useRef(null);

  const [history, setHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const rafRef = useRef(null);
  const positionRef = useRef(0);

  // Load the handed-over source once. No source means an empty, honest project.
  useEffect(() => {
    const audioUrl = location.state?.audioUrl;
    if (!audioUrl) {
      const empty = [createEmptyTrack(0)];
      setTracks(empty);
      setHistory([empty]);
      setHistoryIndex(0);
      return undefined;
    }

    let cancelled = false;
    (async () => {
      try {
        const project = audioEditorService.createProject({
          name: location.state?.title || 'Recorded Audio',
          sourceTrackId: location.state?.trackId,
          sourceArtist: location.state?.artist,
        });
        const info = await audioEditorService.loadAudio(audioUrl);
        const peaks = audioEditorService.generateWaveform();
        if (cancelled) return;

        const track = {
          id: 'source_track',
          name: location.state?.title || 'Source Audio',
          color: tokens.color.brand.violet,
          volume: 0,
          pan: 0,
          muted: false,
          solo: false,
          locked: false,
          clips: [
            {
              id: project.id,
              start: 0,
              duration: info.duration,
              name: location.state?.title || 'Source Audio',
              fadeStart: 0,
              fadeEnd: 0,
              buffer: audioEditorService.audioBuffer,
              peaks,
            },
          ],
        };
        setTracks([track]);
        setHistory([[track]]);
        setHistoryIndex(0);
        setTotalDuration(info.duration);
        setSourceLoaded(true);
        toast.success(`Loaded ${info.duration.toFixed(1)}s of audio.`);
      } catch (err) {
        if (cancelled) return;
        setSourceError(err?.message || 'Could not decode the audio source.');
        setTracks([createEmptyTrack(0)]);
        toast.error('Could not decode the audio source.');
      }
    })();

    return () => { cancelled = true; };
  }, [location.state?.audioUrl, location.state?.title, location.state?.trackId, location.state?.artist]);

  // Keep the engine's EQ graph and master gain in sync
  useEffect(() => {
    audioStudioEngine.applyEq(eqBands, eqEnabled);
  }, [eqBands, eqEnabled]);

  useEffect(() => {
    audioStudioEngine.setVolume(masterVolume);
  }, [masterVolume]);

  // Cleanup recorder if component unmounts
  useEffect(() => {
    return () => {
      try {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
          mediaRecorderRef.current.stop();
        }
      } catch {
        // ignore unmount cleanup
      }
    };
  }, []);

  // Transport: the engine owns the clock, this just mirrors it into React.
  useEffect(() => {
    if (!isPlaying) {
      cancelAnimationFrame(rafRef.current);
      return undefined;
    }

    audioStudioEngine.start({
      position: positionRef.current,
      tracks,
      duration: totalDuration,
      loop: isLooping,
      tempo,
      metronome: isMetronome,
    });

    const tick = () => {
      const position = audioStudioEngine.getPosition();
      positionRef.current = position;
      if (audioStudioEngine.hasReachedEnd()) {
        if (isLooping) {
          positionRef.current = 0;
          setCurrentTime(0);
          audioStudioEngine.stop();
          audioStudioEngine.start({
            position: 0, tracks, duration: totalDuration, loop: true, tempo, metronome: isMetronome,
          });
          rafRef.current = requestAnimationFrame(tick);
          return;
        }
        audioStudioEngine.stop();
        positionRef.current = totalDuration;
        setCurrentTime(totalDuration);
        setIsPlaying(false);
        return;
      }
      setCurrentTime(position);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(rafRef.current);
      audioStudioEngine.stop();
    };
  }, [isPlaying, tracks, totalDuration, isLooping, tempo, isMetronome]);

  const handleTracksChange = useCallback((updater) => {
    setTracks((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      const maxDur = next.reduce((acc, tr) => {
        const trackEnd = (tr.clips || []).reduce((m, c) => Math.max(m, (c.start || 0) + (c.duration || 0)), 0);
        return Math.max(acc, trackEnd);
      }, 0);
      setTotalDuration((prevDur) => Math.max(prevDur, maxDur));
      setHistory((h) => {
        const appended = [...h.slice(0, historyIndex + 1), next];
        setHistoryIndex(appended.length - 1);
        return appended;
      });
      return next;
    });
  }, [historyIndex]);

  const addDecodedBufferTrack = useCallback((decodedBuffer, label) => {
    const peaks = computeWaveformPeaks(decodedBuffer);
    const clipId = `clip_${Date.now()}`;
    const newClip = {
      id: clipId,
      start: 0,
      duration: decodedBuffer.duration,
      name: label,
      fadeStart: 0,
      fadeEnd: 0,
      buffer: decodedBuffer,
      peaks,
    };

    handleTracksChange((prev) => {
      const emptyTrack = prev.find((t) => !t.clips || t.clips.length === 0);
      if (emptyTrack) {
        return prev.map((t) =>
          t.id === emptyTrack.id
            ? { ...t, name: label.slice(0, 22), clips: [newClip] }
            : t
        );
      }
      return [
        ...prev,
        {
          id: `track_${Date.now()}`,
          name: label.slice(0, 22),
          color: tokens.color.brand.blue,
          volume: 0,
          pan: 0,
          muted: false,
          solo: false,
          locked: false,
          clips: [newClip],
        },
      ];
    });

    setSourceLoaded(true);
    setSourceError(null);
    setSelectedClip(newClip);
    toast.success(`Added "${label}" (${decodedBuffer.duration.toFixed(1)}s)`);
  }, [handleTracksChange]);

  const handleImportAudioFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      await audioStudioEngine.resume();
      const ctx = audioStudioEngine.ctx || new (window.AudioContext || window.webkitAudioContext)();
      const arrayBuf = await file.arrayBuffer();
      const decoded = await ctx.decodeAudioData(arrayBuf.slice(0));
      addDecodedBufferTrack(decoded, file.name.replace(/\.[^.]+$/, ''));
    } catch (err) {
      toast.error(err?.message || 'Could not decode uploaded audio file.');
    } finally {
      e.target.value = '';
    }
  };

  const handleToggleRecord = async () => {
    if (isRecording && mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      toast.error('Microphone recording is not supported in this browser.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      recordedChunksRef.current = [];
      const recorder = new MediaRecorder(stream);
      recorder.ondataavailable = (ev) => {
        if (ev.data && ev.data.size > 0) recordedChunksRef.current.push(ev.data);
      };
      recorder.onstop = async () => {
        stream.getTracks().forEach((tr) => tr.stop());
        const blob = new Blob(recordedChunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        if (blob.size === 0) return;
        try {
          await audioStudioEngine.resume();
          const ctx = audioStudioEngine.ctx || new (window.AudioContext || window.webkitAudioContext)();
          const decoded = await ctx.decodeAudioData(await blob.arrayBuffer());
          addDecodedBufferTrack(decoded, `Mic Take ${tracks.length + 1}`);
        } catch {
          toast.error('Failed to decode microphone recording.');
        }
      };
      mediaRecorderRef.current = recorder;
      recorder.start();
      setIsRecording(true);
      toast.info('Recording from microphone — tap Stop when finished.');
    } catch {
      toast.error('Microphone permission denied or unavailable.');
    }
  };

  const handleUndo = () => {
    if (historyIndex <= 0) return;
    const idx = historyIndex - 1;
    setHistoryIndex(idx);
    setTracks(history[idx]);
  };

  const handleRedo = () => {
    if (historyIndex >= history.length - 1) return;
    const idx = historyIndex + 1;
    setHistoryIndex(idx);
    setTracks(history[idx]);
  };

  const handleSeek = (time) => {
    const clamped = Math.max(0, Math.min(totalDuration, time));
    setCurrentTime(clamped);
    positionRef.current = clamped;
    if (isPlaying) {
      audioStudioEngine.stop();
      audioStudioEngine.start({
        position: clamped,
        tracks,
        duration: totalDuration,
        loop: isLooping,
        tempo,
        metronome: isMetronome,
      });
    }
  };

  const handlePlayPause = () => {
    if (!isPlaying) {
      positionRef.current = currentTime;
    }
    setIsPlaying((p) => !p);
  };

  const handleExport = async (format) => {
    const hasClips = tracks.some((t) => (t.clips || []).some((c) => Boolean(c.buffer)));
    if (!sourceLoaded && !hasClips) {
      toast.error('Import or record audio into the session before exporting.');
      return;
    }
    setExporting(true);
    try {
      const renderedBuffer = await audioStudioEngine.renderOfflineMix({
        tracks,
        duration: totalDuration,
        eqBands,
        eqEnabled,
        masterVolume,
        sampleRate,
      });
      const wavBlob = audioStudioEngine.encodeWavBlob(renderedBuffer);
      if (!wavBlob || wavBlob.size === 0) {
        throw new Error('empty_render');
      }

      if (format === 'Post') {
        const audioFile = new File([wavBlob], `${projectName}.wav`, { type: 'audio/wav' });
        navigate('/create-post', {
          state: {
            audioFile,
            title: projectName,
            prefillType: 'audio',
          },
        });
        toast.success('Mix rendered — opening Create Post composer.');
        return;
      }

      const url = URL.createObjectURL(wavBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${projectName}.wav`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success(`Exported mixdown (${(wavBlob.size / 1024).toFixed(0)} KB WAV)`);
    } catch {
      toast.error('Export failed — ensure at least one audible track clip is active.');
    } finally {
      setExporting(false);
    }
  };

  const updateSelectedClip = (patch) => {
    if (!selectedClip) return;
    handleTracksChange((prev) => prev.map((t) => ({
      ...t,
      clips: t.clips.map((c) => (c.id === selectedClip.id ? { ...c, ...patch } : c)),
    })));
    setSelectedClip((prev) => ({ ...prev, ...patch }));
  };

  return (
    <div
      className={cn(
        'min-h-screen w-full select-none transition-colors duration-300 pb-28',
        isDark ? 'bg-[#03071B] text-white' : 'bg-[#F6F8FC] text-gray-900'
      )}
    >
      <StudioHeader
        projectName={projectName}
        setProjectName={setProjectName}
        onUndo={handleUndo}
        onRedo={handleRedo}
        canUndo={historyIndex > 0}
        canRedo={historyIndex < history.length - 1}
        onExport={handleExport}
        isExporting={exporting}
        hasSource={sourceLoaded}
        isDark={isDark}
      />

      <input
        ref={audioInputRef}
        type="file"
        accept="audio/*"
        onChange={handleImportAudioFile}
        className="hidden"
      />

      <div className="max-w-7xl mx-auto px-4 py-4 space-y-4">
        {sourceError && (
          <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-400">
            {sourceError}
          </div>
        )}

        {!sourceLoaded && !sourceError && (
          <div
            className={cn(
              'rounded-xl border px-4 py-3 text-sm flex flex-wrap items-center justify-between gap-3',
              isDark ? 'border-white/10 bg-white/5 text-gray-300' : 'border-gray-200 bg-white text-gray-700'
            )}
          >
            <span>
              Session is ready. Import an audio file or record from your microphone to mix, EQ, and export a WAV master.
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => audioInputRef.current?.click()}
                className="px-3.5 py-1.5 rounded-lg bg-arvdoul-gradient text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5" /> Import Audio
              </button>
              <button
                type="button"
                onClick={handleToggleRecord}
                className={cn(
                  'px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 border cursor-pointer',
                  isRecording
                    ? 'bg-rose-600 border-rose-500 text-white'
                    : isDark
                    ? 'border-white/15 bg-white/5 text-white'
                    : 'border-slate-300 bg-slate-50 text-slate-900'
                )}
              >
                {isRecording ? <Square className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
                {isRecording ? 'Stop Recording' : 'Record Mic'}
              </button>
            </div>
          </div>
        )}

        <TransportBar
          currentTime={currentTime}
          totalDuration={totalDuration}
          isPlaying={isPlaying}
          canPlay={totalDuration > 0}
          onPlayPause={handlePlayPause}
          onStop={() => {
            setIsPlaying(false);
            setCurrentTime(0);
            positionRef.current = 0;
            audioStudioEngine.stop();
          }}
          onSeek={handleSeek}
          tempo={tempo}
          setTempo={setTempo}
          isLooping={isLooping}
          setIsLooping={setIsLooping}
          isMetronome={isMetronome}
          setIsMetronome={setIsMetronome}
          isDark={isDark}
        />

        <MultiTrackConsole
          tracks={tracks}
          setTracks={handleTracksChange}
          currentTime={currentTime}
          setCurrentTime={handleSeek}
          totalDuration={totalDuration}
          isDark={isDark}
          selectedClipId={selectedClip?.id}
          onSelectClip={(clip) => setSelectedClip(clip)}
        />

        <div id="audio-eq-section" ref={eqSectionRef}>
          <EqualizerModule
            isDark={isDark}
            isPlaying={isPlaying}
            bands={eqBands}
            setBands={setEqBands}
            eqEnabled={eqEnabled}
            setEqEnabled={setEqEnabled}
          />
        </div>

        <ClipInspectorModule
          selectedClip={selectedClip}
          isDark={isDark}
          isPlaying={isPlaying}
          onUpdateClip={updateSelectedClip}
        />
      </div>

      {/* Project Audio Settings Modal */}
      {showSettingsModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div
            className={cn(
              'w-full max-w-md rounded-2xl border p-5 space-y-4',
              isDark ? 'bg-[#080F2E] border-white/15 text-white' : 'bg-white border-slate-200 text-slate-900'
            )}
          >
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-white/10 pb-3">
              <h3 className="font-semibold text-base">Audio Engine Preferences</h3>
              <button
                type="button"
                aria-label="Close settings"
                onClick={() => setShowSettingsModal(false)}
                className="p-1.5 rounded-lg hover:bg-black/10 dark:hover:bg-white/10 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-2">
                  Export Sample Rate
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {[44100, 48000].map((rate) => (
                    <button
                      type="button"
                      key={rate}
                      onClick={() => setSampleRate(rate)}
                      className={cn(
                        'py-2 rounded-xl text-xs font-semibold border tabular-nums cursor-pointer',
                        sampleRate === rate
                          ? 'bg-arvdoul-gradient border-transparent text-white'
                          : isDark
                          ? 'border-white/15 bg-white/5 text-slate-300'
                          : 'border-slate-200 bg-slate-50 text-slate-700'
                      )}
                    >
                      {(rate / 1000).toFixed(1)} kHz
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs font-medium mb-1">
                  <span className="text-slate-500 dark:text-slate-400">Master Output Gain</span>
                  <span className="font-mono tabular-nums">{Math.round(masterVolume * 100)}%</span>
                </div>
                <input
                  aria-label="Master Output Gain"
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={masterVolume}
                  onChange={(e) => setMasterVolume(Number(e.target.value))}
                  className="w-full accent-arvdoul-purple cursor-pointer"
                />
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowSettingsModal(false)}
              className="w-full py-2.5 rounded-xl bg-arvdoul-gradient text-white text-sm font-semibold cursor-pointer"
            >
              Done
            </button>
          </div>
        </div>
      )}

      <BottomStudioNav
        isDark={isDark}
        isRecording={isRecording}
        onOpenMedia={() => audioInputRef.current?.click()}
        onOpenPlugins={() => {
          setEqEnabled(true);
          eqSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
          toast.info('Master 5-band parametric EQ active');
        }}
        onRecord={handleToggleRecord}
        onOpenSettings={() => setShowSettingsModal(true)}
      />
    </div>
  );
}
