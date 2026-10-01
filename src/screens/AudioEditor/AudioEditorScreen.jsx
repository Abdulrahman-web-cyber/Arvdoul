// src/screens/AudioEditor/AudioEditorScreen.jsx - ARVDOUL AUDIO STUDIO
//
// Multitrack editor backed by the Web Audio graph in ./audioEngine.
// The transport, meters, EQ and export all operate on real audio: the project
// starts empty unless a recorded/uploaded source is handed over in route state,
// and nothing on screen shows a level or a clip that does not exist.

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { toast } from 'sonner';
import { useTheme } from '../../context/ThemeContext';
import { cn } from '../../lib/utils';
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

export default function AudioEditorScreen() {
  const { theme } = useTheme();
  const isDark = theme !== 'light';
  const location = useLocation();

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
        });
        const info = await audioEditorService.loadAudio(audioUrl);
        const peaks = audioEditorService.generateWaveform();
        if (cancelled) return;

        const track = {
          id: 'source_track',
          name: location.state?.title || 'Source Audio',
          color: '#8B1EF3',
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
  }, [location.state?.audioUrl, location.state?.title]);

  // Keep the engine's EQ graph in step with the band list.
  useEffect(() => {
    audioStudioEngine.applyEq(eqBands, eqEnabled);
  }, [eqBands, eqEnabled]);

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
      setHistory((h) => {
        const appended = [...h.slice(0, historyIndex + 1), next];
        setHistoryIndex(appended.length - 1);
        return appended;
      });
      return next;
    });
  }, [historyIndex]);

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
      // Restart from the new position without dropping the play state.
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
      // A seek while paused moves positionRef; make sure it is current.
      positionRef.current = currentTime;
    }
    setIsPlaying((p) => !p);
  };

  const handleExport = async (format) => {
    if (format === 'Post') {
      toast.info('Render the mix to a file first, then attach it in Create Post.');
      return;
    }
    if (!sourceLoaded) {
      toast.error('Load audio into the session before exporting.');
      return;
    }
    setExporting(true);
    try {
      const result = await audioEditorService.exportAudio(format, 192);
      if (!result?.blob || result.blob.size === 0) {
        throw new Error('empty_render');
      }
      const url = URL.createObjectURL(result.blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${projectName}.${format.toLowerCase() === 'mp3' ? 'webm' : 'wav'}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success(`Exported ${(result.blob.size / 1024).toFixed(0)} KB.`);
    } catch {
      toast.error('Export failed — no audio was rendered.');
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
    <div className={cn(
      "min-h-screen w-full select-none transition-colors duration-300 pb-28",
      isDark ? "bg-[#03071B] text-white" : "bg-[#F6F8FC] text-gray-900"
    )}>
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

      <div className="max-w-7xl mx-auto px-4 py-4 space-y-4">
        {sourceError && (
          <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-400">
            {sourceError}
          </div>
        )}

        {!sourceLoaded && !sourceError && (
          <div className={cn(
            "rounded-xl border px-4 py-3 text-sm",
            isDark ? "border-white/10 bg-white/5 text-gray-400" : "border-gray-200 bg-white text-gray-500"
          )}>
            This session is empty. Record or upload audio from Create Post and open it here to
            mix, EQ and export a real render.
          </div>
        )}

        <TransportBar
          currentTime={currentTime}
          totalDuration={totalDuration}
          isPlaying={isPlaying}
          canPlay={totalDuration > 0}
          onPlayPause={handlePlayPause}
          onStop={() => { setIsPlaying(false); setCurrentTime(0); positionRef.current = 0; audioStudioEngine.stop(); }}
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
          isPlaying={isPlaying}
          isDark={isDark}
          selectedClipId={selectedClip?.id}
          onSelectClip={(clip) => setSelectedClip(clip)}
        />

        <EqualizerModule
          isDark={isDark}
          isPlaying={isPlaying}
          bands={eqBands}
          setBands={setEqBands}
          eqEnabled={eqEnabled}
          setEqEnabled={setEqEnabled}
        />

        <ClipInspectorModule
          selectedClip={selectedClip}
          isDark={isDark}
          isPlaying={isPlaying}
          onUpdateClip={updateSelectedClip}
        />
      </div>

      <BottomStudioNav
        isDark={isDark}
        onOpenMedia={() => toast.info('Record or upload a file from Create Post to load it here.')}
        onOpenPlugins={() => toast.info('Master effects chain is available in the Effects panel.')}
        onRecord={() => toast.info('Use the recorder in Create Post, then open the result in the studio.')}
        onOpenSettings={() => toast.info('Audio preferences: 48kHz, 24-bit, buffer 256')}
      />
    </div>
  );
}
