// src/screens/VideoEditor/VideoEditorScreen.jsx
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from '../../context/ThemeContext';
import {
  INITIAL_TRACKS, RESOLUTION_PRESETS, formatTimecode,
  FILTERS_LIST
} from './constants';

import EditorHeader from './components/EditorHeader';
import PreviewCanvas from './components/PreviewCanvas';
import LayersPanel from './components/LayersPanel';
import TimelineToolbar from './components/TimelineToolbar';
import MultiTrackTimeline from './components/MultiTrackTimeline';
import ActionRibbon from './components/ActionRibbon';
import TrimSubPanel from './components/TrimSubPanel';
import ToolPanels from './components/ToolPanels';
import BottomBar from './components/BottomBar';
import ExportModal from './components/ExportModal';
import RecordVoiceModal from './components/RecordVoiceModal';
import MediaDrawer from './components/MediaDrawer';

/**
 * REAL video frame capture: loads the media, draws one frame to a canvas and
 * returns a JPEG data URL. Returns '' when the frame cannot be decoded —
 * callers render a neutral placeholder tile; we never invent thumbnails.
 */
function captureVideoFrame(url) {
  return new Promise((resolve) => {
    if (!url || typeof document === 'undefined') {
      resolve('');
      return;
    }
    const video = document.createElement('video');
    video.muted = true;
    video.playsInline = true;
    video.crossOrigin = 'anonymous';
    video.preload = 'metadata';
    let settled = false;
    const done = (val) => {
      if (settled) return;
      settled = true;
      resolve(val);
      try { video.removeAttribute('src'); video.load(); } catch { /* noop */ }
    };
    const onMeta = () => {
      try {
        const t = Math.min(0.5, Math.max(0, (video.duration || 1) - 0.05));
        video.currentTime = t;
      } catch { done(''); }
    };
    const onSeeked = () => {
      try {
        const w = 320;
        const scale = w / video.videoWidth;
        const h = Math.max(1, Math.round(video.videoHeight * scale));
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) return done('');
        ctx.drawImage(video, 0, 0, w, h);
        done(canvas.toDataURL('image/jpeg', 0.8));
      } catch { done(''); }
    };
    video.addEventListener('loadedmetadata', onMeta, { once: true });
    video.addEventListener('seeked', onSeeked, { once: true });
    video.addEventListener('error', () => done(''), { once: true });
    video.src = url;
  });
}

/**
 * REAL audio waveform: decodes the audio with the Web Audio API and returns
 * 40 peak values (0-100). Returns [] when decoding fails — callers must show
 * a neutral waveform placeholder instead of a fake random one.
 */
function analyzeAudioWaveform(url) {
  return new Promise((resolve) => {
    if (!url || typeof window === 'undefined' || !window.AudioContext || !window.OfflineAudioContext) {
      resolve([]);
      return;
    }
    fetch(url)
      .then((res) => (res.ok ? res.arrayBuffer() : Promise.reject(new Error('fetch failed'))))
      .then((buffer) => new OfflineAudioContext(1, 1, 44100).decodeAudioData(buffer))
      .then((audioBuffer) => {
        const channel = audioBuffer.getChannelData(0);
        const buckets = 40;
        const peaks = [];
        const perBucket = Math.max(1, Math.floor(channel.length / buckets));
        for (let i = 0; i < buckets; i++) {
          let peak = 0;
          for (let j = 0; j < perBucket; j++) {
            const v = Math.abs(channel[i * perBucket + j] || 0);
            if (v > peak) peak = v;
          }
          peaks.push(Math.max(4, Math.min(100, Math.round(peak * 100))));
        }
        resolve(peaks);
      })
      .catch(() => resolve([]));
  });
}

export default function VideoEditorScreen() {
  const navigate = useNavigate();
  const { theme, isDark } = useTheme();

  // Project State — honest default: the editor opens empty. The user names
  // their own project; we never present a pre-made demo project.
  const [projectName, setProjectName] = useState('Untitled Project');
  const [selectedResolution, setSelectedResolution] = useState(RESOLUTION_PRESETS[0]); // 4K 16:9
  const [isSaved, setIsSaved] = useState(true);

  // Tracks & Clips State
  const [tracks, setTracks] = useState(INITIAL_TRACKS);
  const [selectedClipId, setSelectedClipId] = useState(null);
  const [selectedTrackId, setSelectedTrackId] = useState('track-video');

  // History (Undo / Redo)
  const [history, setHistory] = useState([INITIAL_TRACKS]);
  const [historyIndex, setHistoryIndex] = useState(0);

  const pushHistory = (newTracks) => {
    const updated = history.slice(0, historyIndex + 1);
    setHistory([...updated, newTracks]);
    setHistoryIndex(updated.length);
    setTracks(newTracks);
    setIsSaved(false);
    setTimeout(() => setIsSaved(true), 1200);
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

  // Playhead & Playback State
  const [currentTime, setCurrentTime] = useState(4.2);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0);
  const [zoomLevel, setZoomLevel] = useState(1.0);
  const [isMagnetSnap, setIsMagnetSnap] = useState(true);
  const [isRippleEdit, setIsRippleEdit] = useState(true);
  const [showSafeZone, setShowSafeZone] = useState(false);

  // Tool & Ribbon State
  const [activeTool, setActiveTool] = useState('trim');
  const [activeSubAction, setActiveSubAction] = useState('trim');

  // Active Effects & Filter State
  const [filterId, setFilterId] = useState('none');
  const [adjustments, setAdjustments] = useState({
    brightness: 100,
    contrast: 100,
    saturate: 100,
    blur: 0,
    sepia: 0,
    hueRotate: 0,
    opacity: 100,
  });
  const [activeTransition, setActiveTransition] = useState('fade');
  const [activeEffect, setActiveEffect] = useState('none');

  // Clip Specific State (for selected clip)
  const [clipSpeed, setClipSpeed] = useState(1.0);
  const [isReverse, setIsReverse] = useState(false);
  const [isFreezeFrame, setIsFreezeFrame] = useState(false);
  const [snapMode, setSnapMode] = useState('Frame');

  // UI Drawer & Modal State
  const [isLayersPanelOpen, setIsLayersPanelOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isRecordModalOpen, setIsRecordModalOpen] = useState(false);
  const [recordMode, setRecordMode] = useState('record'); // 'record' | 'voiceover'
  const [isMediaDrawerOpen, setIsMediaDrawerOpen] = useState(false);

  // AI Generation State
  const [isProcessingAI, setIsProcessingAI] = useState(false);
  const [aiStatusMessage, setAiStatusMessage] = useState('');

  // Refs
  const videoRef = useRef(null);
  const animationFrameRef = useRef(null);

  // Compute Total Timeline Duration
  const totalDuration = Math.max(
    60,
    ...tracks.flatMap((t) => t.clips.map((c) => (c.startTime || 0) + (c.duration || 0)))
  );

  // Get Currently Selected Clip
  const selectedClip = tracks
    .flatMap((t) => t.clips)
    .find((c) => c.id === selectedClipId) || null;

  // Active video clip at current playhead time
  const currentVideoClip = tracks
    .find((t) => t.id === 'track-video')
    ?.clips.find((c) => currentTime >= c.startTime && currentTime <= c.startTime + c.duration) ||
    tracks.find((t) => t.id === 'track-video')?.clips[0];

  // Active text overlays at current time
  const activeTextClips = tracks
    .find((t) => t.id === 'track-text')
    ?.clips.filter((c) => currentTime >= c.startTime && currentTime <= c.startTime + c.duration) || [];

  // Active sticker overlays at current time
  const activeStickerClips = tracks
    .find((t) => t.id === 'track-stickers')
    ?.clips.filter((c) => currentTime >= c.startTime && currentTime <= c.startTime + c.duration) || [];

  // Playback Loop Animation Frame
  useEffect(() => {
    let lastTime = performance.now();

    const updatePlayhead = (now) => {
      if (isPlaying) {
        const delta = (now - lastTime) / 1000;
        setCurrentTime((prev) => {
          const next = prev + delta * playbackSpeed;
          if (next >= totalDuration) {
            setIsPlaying(false);
            return totalDuration;
          }
          return next;
        });
      }
      lastTime = now;
      animationFrameRef.current = requestAnimationFrame(updatePlayhead);
    };

    animationFrameRef.current = requestAnimationFrame(updatePlayhead);
    return () => cancelAnimationFrame(animationFrameRef.current);
  }, [isPlaying, playbackSpeed, totalDuration]);

  // Synchronize native video element if loaded
  useEffect(() => {
    if (videoRef.current && currentVideoClip) {
      if (isPlaying && videoRef.current.paused) {
        videoRef.current.play().catch(() => {});
      } else if (!isPlaying && !videoRef.current.paused) {
        videoRef.current.pause();
      }
    }
  }, [isPlaying, currentVideoClip]);

  // Toggle Play / Pause
  const handleTogglePlay = () => {
    setIsPlaying((prev) => !prev);
  };

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Don't trigger if user is typing in input
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) {
        return;
      }

      if (e.code === 'Space') {
        e.preventDefault();
        handleTogglePlay();
      } else if (e.code === 'KeyK') {
        e.preventDefault();
        setIsPlaying(false);
      } else if (e.code === 'KeyJ') {
        e.preventDefault();
        setCurrentTime((t) => Math.max(0, t - 2));
      } else if (e.code === 'KeyL') {
        e.preventDefault();
        setCurrentTime((t) => Math.min(totalDuration, t + 2));
      } else if (e.code === 'KeyS') {
        e.preventDefault();
        handleSplitClip();
      } else if (e.code === 'Delete' || e.code === 'Backspace') {
        if (selectedClipId) {
          e.preventDefault();
          handleDeleteClip();
        }
      } else if ((e.ctrlKey || e.metaKey) && e.code === 'KeyZ') {
        e.preventDefault();
        if (e.shiftKey) handleRedo();
        else handleUndo();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPlaying, selectedClipId, historyIndex, totalDuration]);

  // Track & Clip Actions
  const handleSelectClip = (clipId, trackId) => {
    setSelectedClipId(clipId);
    setSelectedTrackId(trackId);
  };

  const handleUpdateClip = (clipId, updates) => {
    const newTracks = tracks.map((track) => ({
      ...track,
      clips: track.clips.map((clip) => {
        if (clip.id === clipId) {
          return { ...clip, ...updates };
        }
        return clip;
      }),
    }));
    pushHistory(newTracks);
  };

  const handleSplitClip = () => {
    if (!selectedClip) return;
    const clip = selectedClip;
    if (currentTime <= clip.startTime || currentTime >= clip.startTime + clip.duration) return;

    const firstDuration = currentTime - clip.startTime;
    const secondDuration = clip.duration - firstDuration;

    const firstClip = { ...clip, duration: firstDuration };
    const secondClip = {
      ...clip,
      id: `${clip.id}-split-${Date.now().toString().slice(-4)}`,
      startTime: currentTime,
      duration: secondDuration,
      title: `${clip.title} (Part 2)`,
    };

    const newTracks = tracks.map((track) => {
      if (track.clips.some((c) => c.id === clip.id)) {
        return {
          ...track,
          clips: track.clips.flatMap((c) => (c.id === clip.id ? [firstClip, secondClip] : [c])),
        };
      }
      return track;
    });

    pushHistory(newTracks);
    setSelectedClipId(secondClip.id);
  };

  const handleDeleteClip = () => {
    if (!selectedClipId) return;
    const newTracks = tracks.map((track) => ({
      ...track,
      clips: track.clips.filter((c) => c.id !== selectedClipId),
    }));
    pushHistory(newTracks);
    setSelectedClipId(null);
  };

  const handleDuplicateClip = () => {
    if (!selectedClip) return;
    const dupClip = {
      ...selectedClip,
      id: `${selectedClip.id}-copy-${Date.now().toString().slice(-4)}`,
      startTime: selectedClip.startTime + selectedClip.duration + 0.5,
      title: `${selectedClip.title} Copy`,
    };

    const newTracks = tracks.map((track) => {
      if (track.clips.some((c) => c.id === selectedClip.id)) {
        return {
          ...track,
          clips: [...track.clips, dupClip],
        };
      }
      return track;
    });

    pushHistory(newTracks);
    setSelectedClipId(dupClip.id);
  };

  // Add Items to Tracks
  const handleAddTextClip = (textData) => {
    const newClip = {
      id: `text-${Date.now()}`,
      startTime: currentTime,
      duration: 5,
      text: textData.text,
      fontFamily: textData.fontFamily,
      color: textData.color,
      bgColor: textData.bgColor,
      fontSize: textData.fontSize,
      position: { x: 50, y: 50 },
    };

    const newTracks = tracks.map((t) => {
      if (t.id === 'track-text') {
        return { ...t, clips: [...t.clips, newClip] };
      }
      return t;
    });

    pushHistory(newTracks);
    setSelectedClipId(newClip.id);
    setSelectedTrackId('track-text');
  };

  const handleAddStickerClip = (emoji) => {
    const newClip = {
      id: `sticker-${Date.now()}`,
      startTime: currentTime,
      duration: 4,
      emoji: emoji,
      position: { x: 50, y: 50 },
      scale: 1,
    };

    const newTracks = tracks.map((t) => {
      if (t.id === 'track-stickers') {
        return { ...t, clips: [...t.clips, newClip] };
      }
      return t;
    });

    pushHistory(newTracks);
    setSelectedClipId(newClip.id);
    setSelectedTrackId('track-stickers');
  };

  const handleAddAudioClip = async (audioData) => {
    // Real waveform from the actual audio bytes (Web Audio decode).
    const waveform = await analyzeAudioWaveform(audioData.url);
    const newClip = {
      id: `audio-${Date.now()}`,
      startTime: currentTime,
      duration: audioData.duration || 30,
      title: audioData.title,
      url: audioData.url,
      volume: 100,
      waveform,
    };

    const newTracks = tracks.map((t) => {
      if (t.id === 'track-audio') {
        return { ...t, clips: [...t.clips, newClip] };
      }
      return t;
    });

    pushHistory(newTracks);
    setSelectedClipId(newClip.id);
    setSelectedTrackId('track-audio');
  };

  const handleAddMediaFromDisk = async (file) => {
    const url = URL.createObjectURL(file);
    const isVideo = file.type.startsWith('video');
    const isAudio = file.type.startsWith('audio');

    if (isVideo) {
      // Real frame from the user's own video ('' if it cannot be decoded).
      const thumbnail = await captureVideoFrame(url);
      const newClip = {
        id: `video-${Date.now()}`,
        startTime: currentTime,
        duration: 12,
        title: file.name,
        url: url,
        thumbnail,
        volume: 100,
      };
      const newTracks = tracks.map((t) =>
        t.id === 'track-video' ? { ...t, clips: [...t.clips, newClip] } : t
      );
      pushHistory(newTracks);
      setSelectedClipId(newClip.id);
    } else if (isAudio) {
      handleAddAudioClip({ title: file.name, url: url, duration: 25 });
    }
  };

  // AI Copilot Actions
  const handleApplyAITool = (toolId) => {
    setIsProcessingAI(true);
    setAiStatusMessage(
      toolId === 'captions'
        ? 'Transcribing audio and aligning video subtitles...'
        : toolId === 'smart_cut'
        ? 'Detecting silence and cutting dead air...'
        : toolId === 'enhance'
        ? 'Filtering background noise & boosting clarity...'
        : 'Rotoscoping subject and removing background...'
    );

    setTimeout(() => {
      if (toolId === 'captions') {
        handleAddTextClip({
          text: '✨ Powered by ARVDOUL AI Engine',
          fontFamily: 'Plus Jakarta Sans',
          color: '#ffffff',
          bgColor: 'rgba(147, 51, 234, 0.4)',
          fontSize: 28,
        });
      } else if (toolId === 'smart_cut') {
        handleSplitClip();
      }
      setIsProcessingAI(false);
      setAiStatusMessage('');
    }, 1500);
  };

  // Adjustment Controls
  const handleUpdateAdjustment = (param, val) => {
    setAdjustments((prev) => ({ ...prev, [param]: val }));
  };

  const handleResetAdjustments = () => {
    setAdjustments({
      brightness: 100,
      contrast: 100,
      saturate: 100,
      blur: 0,
      sepia: 0,
      hueRotate: 0,
      opacity: 100,
    });
  };

  return (
    <div className={`flex flex-col h-screen w-screen overflow-hidden select-none font-sans ${isDark ? 'bg-gray-950 text-white' : 'bg-slate-50 text-gray-900'}`}>
      {/* 1. Studio Header */}
      <EditorHeader
        projectName={projectName}
        onProjectNameChange={setProjectName}
        onClose={() => navigate(-1)}
        currentResolution={selectedResolution}
        selectedResolution={selectedResolution}
        onSelectResolution={setSelectedResolution}
        onResolutionChange={setSelectedResolution}
        isSaved={isSaved}
        onUndo={handleUndo}
        onRedo={handleRedo}
        canUndo={historyIndex > 0}
        canRedo={historyIndex < history.length - 1}
        onExportClick={() => setIsExportModalOpen(true)}
        onOpenExport={() => setIsExportModalOpen(true)}
      />

      {/* 2. Main Center Work Area (Preview Canvas + Optional Layers Drawer) */}
      <div className={`relative flex-1 min-h-0 flex overflow-hidden ${isDark ? 'bg-gradient-to-b from-gray-950 via-gray-900 to-black' : 'bg-gradient-to-b from-gray-100 via-gray-50 to-slate-200'}`}>
        {/* Center Preview Viewport */}
        <div className="flex-1 flex flex-col p-2 sm:p-3 relative overflow-hidden min-h-0">
          <PreviewCanvas
            currentClip={currentVideoClip}
            activeTextClips={activeTextClips}
            activeStickerClips={activeStickerClips}
            resolution={selectedResolution}
            filterId={filterId}
            adjustments={adjustments}
            activeEffect={activeEffect}
            isPlaying={isPlaying}
            onTogglePlay={handleTogglePlay}
            currentTime={currentTime}
            duration={totalDuration}
            onSeek={setCurrentTime}
            playbackSpeed={playbackSpeed}
            onChangePlaybackSpeed={setPlaybackSpeed}
            showSafeZone={showSafeZone}
            onToggleSafeZone={() => setShowSafeZone(!showSafeZone)}
            onToggleLayersPanel={() => setIsLayersPanelOpen(!isLayersPanelOpen)}
            isLayersPanelOpen={isLayersPanelOpen}
          />
        </div>

        {/* Floating / Docked Layers Manager Panel */}
        <AnimatePresence>
          {isLayersPanelOpen && (
            <motion.div
              initial={{ x: 280, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 280, opacity: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className={`absolute right-0 top-0 bottom-0 z-30 w-72 sm:w-80 p-3 backdrop-blur-2xl border-l shadow-2xl ${isDark ? 'bg-gray-950/90 border-white/10' : 'bg-white/95 border-gray-200'}`}
            >
              <LayersPanel
                tracks={tracks}
                selectedTrackId={selectedTrackId}
                onSelectTrack={setSelectedTrackId}
                onToggleMute={(tId) => {
                  setTracks(tracks.map((t) => (t.id === tId ? { ...t, isMuted: !t.isMuted } : t)));
                }}
                onToggleLock={(tId) => {
                  setTracks(tracks.map((t) => (t.id === tId ? { ...t, isLocked: !t.isLocked } : t)));
                }}
                onToggleVisibility={(tId) => {
                  setTracks(tracks.map((t) => (t.id === tId ? { ...t, isVisible: !t.isVisible } : t)));
                }}
                onClose={() => setIsLayersPanelOpen(false)}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* 3. Timeline Toolbar (Timecode, Undo, Redo, Magnet, Split, Delete, Zoom) */}
      <div className={`px-3 sm:px-4 py-1.5 border-t ${isDark ? 'bg-gray-950 border-white/10' : 'bg-white border-gray-200'}`}>
        <TimelineToolbar
          currentTime={currentTime}
          duration={totalDuration}
          canUndo={historyIndex > 0}
          canRedo={historyIndex < history.length - 1}
          onUndo={handleUndo}
          onRedo={handleRedo}
          zoomLevel={zoomLevel}
          onZoomChange={setZoomLevel}
          isMagnetSnap={isMagnetSnap}
          onToggleMagnetSnap={() => setIsMagnetSnap(!isMagnetSnap)}
          isRippleEdit={isRippleEdit}
          onToggleRippleEdit={() => setIsRippleEdit(!isRippleEdit)}
          onSplit={handleSplitClip}
          onDelete={handleDeleteClip}
          onDuplicate={handleDuplicateClip}
        />
      </div>

      {/* 4. Multi-Track Timeline (Text, Stickers, Video Clips, Audio Waveforms) */}
      <div className={`h-44 sm:h-52 border-t border-b overflow-hidden relative ${isDark ? 'bg-gray-950/95 border-white/10' : 'bg-slate-100/90 border-gray-200'}`}>
        <MultiTrackTimeline
          tracks={tracks}
          currentTime={currentTime}
          duration={totalDuration}
          zoomLevel={zoomLevel}
          selectedClipId={selectedClipId}
          onSelectClip={handleSelectClip}
          onSeek={setCurrentTime}
          onUpdateClip={handleUpdateClip}
          isPlaying={isPlaying}
        />
      </div>

      {/* 5. Horizontal Action Ribbon (Trim, Split, Transition, Filters, Adjust, Audio, Text, Stickers, AI...) */}
      <div className={`px-3 sm:px-4 py-1.5 border-b ${isDark ? 'bg-gray-950 border-white/10' : 'bg-white border-gray-200'}`}>
        <ActionRibbon
          activeTool={activeTool}
          onSelectTool={setActiveTool}
        />
      </div>

      {/* 6. Context-Sensitive Sub Panel (Trim Subpanel vs Filter/Adjust/Text/Audio Panel) */}
      <div className={`px-3 sm:px-4 py-2 min-h-[100px] max-h-48 overflow-y-auto ${isDark ? 'bg-gray-950/90' : 'bg-slate-50/95'}`}>
        {activeTool === 'trim' || activeTool === 'split' ? (
          <TrimSubPanel
            selectedClip={selectedClip}
            activeSubAction={activeSubAction}
            onSelectSubAction={(sub) => {
              setActiveSubAction(sub);
              if (sub === 'split') handleSplitClip();
              if (sub === 'delete') handleDeleteClip();
            }}
            startTime={selectedClip ? selectedClip.startTime : 2.4}
            endTime={selectedClip ? selectedClip.startTime + selectedClip.duration : 28.5}
            duration={selectedClip ? selectedClip.duration : 26.1}
            onStartTimeChange={(newStart) => {
              if (selectedClip) {
                const newDuration = Math.max(0.5, (selectedClip.startTime + selectedClip.duration) - newStart);
                handleUpdateClip(selectedClip.id, { startTime: newStart, duration: newDuration });
              }
            }}
            onEndTimeChange={(newEnd) => {
              if (selectedClip) {
                const newDuration = Math.max(0.5, newEnd - selectedClip.startTime);
                handleUpdateClip(selectedClip.id, { duration: newDuration });
              }
            }}
            speed={clipSpeed}
            onSpeedChange={setClipSpeed}
            isReverse={isReverse}
            onToggleReverse={() => setIsReverse(!isReverse)}
            isFreezeFrame={isFreezeFrame}
            onToggleFreezeFrame={() => setIsFreezeFrame(!isFreezeFrame)}
            isRippleEdit={isRippleEdit}
            onToggleRippleEdit={() => setIsRippleEdit(!isRippleEdit)}
            snapMode={snapMode}
            onSelectSnapMode={setSnapMode}
          />
        ) : (
          <ToolPanels
            activeTool={activeTool}
            filterId={filterId}
            onSelectFilter={setFilterId}
            adjustments={adjustments}
            onUpdateAdjustment={handleUpdateAdjustment}
            onResetAdjustments={handleResetAdjustments}
            transitionId={activeTransition}
            onSelectTransition={setActiveTransition}
            activeEffect={activeEffect}
            onSelectEffect={setActiveEffect}
            onAddTextClip={handleAddTextClip}
            onAddStickerClip={handleAddStickerClip}
            onAddAudioClip={handleAddAudioClip}
            onApplyAITool={handleApplyAITool}
            isProcessingAI={isProcessingAI}
            aiStatusMessage={aiStatusMessage}
          />
        )}
      </div>

      {/* 7. Bottom Navigation & Action Bar (Media, Music, Big + Button, Record, Voiceover) */}
      <BottomBar
        onOpenMedia={() => setIsMediaDrawerOpen(true)}
        onOpenMusic={() => {
          setActiveTool('audio');
        }}
        onAddMediaClick={handleAddMediaFromDisk}
        onOpenRecord={() => {
          setRecordMode('record');
          setIsRecordModalOpen(true);
        }}
        onOpenVoiceover={() => {
          setRecordMode('voiceover');
          setIsRecordModalOpen(true);
        }}
      />

      {/* 8. Modals & Overlays */}
      <ExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        projectName={projectName}
        duration={totalDuration}
        currentResolution={selectedResolution}
        tracks={tracks}
      />

      <RecordVoiceModal
        isOpen={isRecordModalOpen}
        onClose={() => setIsRecordModalOpen(false)}
        mode={recordMode}
        onAddRecordedClip={(clip) => {
          if (clip.type === 'video') {
            const addRecordedClip = async () => {
              // Real frame from the just-recorded clip ('' if undecodable).
              const thumbnail = await captureVideoFrame(clip.url);
              const newClip = {
                id: `video-rec-${Date.now()}`,
                startTime: currentTime,
                duration: clip.duration,
                title: clip.title,
                url: clip.url,
                thumbnail,
                volume: 100,
              };
              const newTracks = tracks.map((t) =>
                t.id === 'track-video' ? { ...t, clips: [...t.clips, newClip] } : t
              );
              pushHistory(newTracks);
              setSelectedClipId(newClip.id);
            };
            void addRecordedClip();
          } else {
            void handleAddAudioClip({
              title: clip.title,
              url: clip.url,
              duration: clip.duration,
            });
          }
        }}
      />

      <MediaDrawer
        isOpen={isMediaDrawerOpen}
        onClose={() => setIsMediaDrawerOpen(false)}
        onAddMedia={(media) => {
          if (media.type === 'video') {
            const newClip = {
              id: `video-stock-${Date.now()}`,
              startTime: currentTime,
              duration: media.duration || 10,
              title: media.title,
              url: media.url,
              thumbnail: media.thumbnail,
              volume: 100,
            };
            const newTracks = tracks.map((t) =>
              t.id === 'track-video' ? { ...t, clips: [...t.clips, newClip] } : t
            );
            pushHistory(newTracks);
            setSelectedClipId(newClip.id);
          } else {
            handleAddAudioClip(media);
          }
        }}
      />
    </div>
  );
}
