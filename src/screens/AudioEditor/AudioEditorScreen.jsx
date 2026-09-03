// src/screens/AudioEditor/AudioEditorScreen.jsx - ARVDOUL AUDIO STUDIO V5 (FLAGSHIP)
// 🎵 Professional Multitrack Digital Audio Workstation matching Image 1
// Features: Multitrack Mixing Console, Parametric EQ, Live Spectrum, Transport Bar, Effects Chain

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { toast } from 'sonner';
import { useTheme } from '../../context/ThemeContext';
import { cn } from '../../lib/utils';
import StudioHeader from './components/StudioHeader';
import MultiTrackConsole, { INITIAL_STUDIO_TRACKS } from './components/MultiTrackConsole';
import TransportBar from './components/TransportBar';
import EqualizerModule from './components/EqualizerModule';
import ClipInspectorModule from './components/ClipInspectorModule';
import BottomStudioNav from './components/BottomStudioNav';
import { audioStudioEngine } from './audioEngine';

export default function AudioEditorScreen() {
  const { theme } = useTheme();
  const isDark = theme !== 'light';
  const location = useLocation();

  const [projectName, setProjectName] = useState(location.state?.title || 'Master Audio Session');
  const [tracks, setTracks] = useState(() => {
    if (location.state?.audioUrl) {
      return [
        {
          id: 'user_master_track',
          name: location.state.title || 'Main Vocal / Stem',
          color: '#8B1EF3',
          volume: 0,
          pan: 0,
          muted: false,
          solo: false,
          locked: false,
          clips: [
            { id: 'usr_c1', start: 0, duration: 60, name: location.state.title || 'Recorded Master', fadeStart: 0.5, fadeEnd: 1 },
          ],
        },
        ...INITIAL_STUDIO_TRACKS.slice(1),
      ];
    }
    return INITIAL_STUDIO_TRACKS;
  });
  const [currentTime, setCurrentTime] = useState(0);
  const [totalDuration, setTotalDuration] = useState(120);
  const [isPlaying, setIsPlaying] = useState(false);
  const [tempo, setTempo] = useState(128);
  const [selectedClip, setSelectedClip] = useState(null);

  // History state for Undo / Redo
  const [history, setHistory] = useState([INITIAL_STUDIO_TRACKS]);
  const [historyIndex, setHistoryIndex] = useState(0);

  const handleTracksChange = (newTracksOrFn) => {
    setTracks((prev) => {
      const next = typeof newTracksOrFn === 'function' ? newTracksOrFn(prev) : newTracksOrFn;
      setHistory((h) => [...h.slice(0, historyIndex + 1), next]);
      setHistoryIndex((idx) => idx + 1);
      return next;
    });
  };

  const handleUndo = () => {
    if (historyIndex > 0) {
      setHistoryIndex(historyIndex - 1);
      setTracks(history[historyIndex - 1]);
    }
  };

  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      setHistoryIndex(historyIndex + 1);
      setTracks(history[historyIndex + 1]);
    }
  };

  // Playback timer & Web Audio sync
  useEffect(() => {
    if (!isPlaying) {
      audioStudioEngine.stop();
      return;
    }

    // Map active tracks to pass to engine
    const activeMap = {};
    tracks.forEach((t) => {
      activeMap[t.id] = { muted: t.muted, volume: t.volume };
    });

    audioStudioEngine.start(currentTime, activeMap);

    const interval = setInterval(() => {
      setCurrentTime((prev) => {
        if (prev >= totalDuration) {
          setIsPlaying(false);
          audioStudioEngine.stop();
          return 0;
        }
        return prev + 0.05;
      });
    }, 50);

    return () => {
      clearInterval(interval);
      audioStudioEngine.stop();
    };
  }, [isPlaying, totalDuration, tracks]);

  const handlePlayPause = () => {
    setIsPlaying(!isPlaying);
  };

  const handleStop = () => {
    setIsPlaying(false);
    setCurrentTime(0);
    audioStudioEngine.stop();
  };

  return (
    <div className={cn(
      "min-h-screen w-full select-none transition-colors duration-300 pb-28",
      isDark ? "bg-[#03071B] text-white" : "bg-[#F6F8FC] text-gray-900"
    )}>
      {/* 1. Header */}
      <StudioHeader
        projectName={projectName}
        setProjectName={setProjectName}
        onUndo={handleUndo}
        onRedo={handleRedo}
        canUndo={historyIndex > 0}
        canRedo={historyIndex < history.length - 1}
        isDark={isDark}
      />

      <div className="max-w-7xl mx-auto px-4 py-4 space-y-4">
        {/* 2. Transport Controls Bar */}
        <TransportBar
          currentTime={currentTime}
          totalDuration={totalDuration}
          isPlaying={isPlaying}
          onPlayPause={handlePlayPause}
          onStop={handleStop}
          onSeek={(time) => setCurrentTime(time)}
          tempo={tempo}
          setTempo={setTempo}
          isDark={isDark}
        />

        {/* 3. Multi-Track Timeline & Console */}
        <MultiTrackConsole
          tracks={tracks}
          setTracks={handleTracksChange}
          currentTime={currentTime}
          setCurrentTime={setCurrentTime}
          totalDuration={totalDuration}
          isPlaying={isPlaying}
          isDark={isDark}
          selectedClipId={selectedClip?.id}
          onSelectClip={(clip) => setSelectedClip(clip)}
        />

        {/* 4. Lower Workspace: Parametric Equalizer Module */}
        <EqualizerModule isDark={isDark} isPlaying={isPlaying} />

        {/* 5. Lower Workspace: Clip Inspector & Effects Chain & Spectrum Analyzer */}
        <ClipInspectorModule
          selectedClip={selectedClip}
          isDark={isDark}
          isPlaying={isPlaying}
        />
      </div>

      {/* 6. Floating Bottom Dock */}
      <BottomStudioNav
        isDark={isDark}
        onOpenMedia={() => toast.info('Media library opened')}
        onOpenPlugins={() => toast.info('Studio audio plugins ready')}
        onRecord={() => toast.info('Microphone active. Recording Armed.')}
        onOpenSettings={() => toast.info('Audio preferences: 48kHz, 24-bit, buffer 256')}
      />
    </div>
  );
}
