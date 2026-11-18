// src/screens/CreateStory.jsx

import { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { cn } from '../lib/utils';
import {
  X, Zap, RefreshCw, Sliders, Type, Smile, Music, BarChart2, HelpCircle,
  AtSign, MapPin, Link2, Timer, ChevronRight, Sparkles, Send, Check,
  Loader2, Globe, Users, Lock, Video, Square, Image as ImageIcon, Mic
} from "lucide-react";
import { getStoryService } from '../services/storyService';
import GIFPicker from '../components/Shared/GIFPicker';
import { useFeatureFlag } from '../hooks/useFeatureFlag.js';
import { LazyImage } from '../components/Shared/LazyImage';
import { BRAND_GRADIENT } from '../design-system/tokens.js';

const CREATIVE_TOOLS = [
  { id: 'text', label: 'Text', icon: Type },
  { id: 'stickers', label: 'Stickers', icon: Smile },
  { id: 'music', label: 'Music', icon: Music },
  { id: 'gif', label: 'GIF', icon: Sparkles },
  { id: 'poll', label: 'Poll', icon: BarChart2 },
  { id: 'question', label: 'Q&A', icon: HelpCircle },
  { id: 'mention', label: 'Mention', icon: AtSign },
  { id: 'location', label: 'Location', icon: MapPin },
  { id: 'link', label: 'Link', icon: Link2 },
  { id: 'timer', label: 'Countdown', icon: Timer },
];

const CAPTURE_MODES = ['STORY', 'TEXT', 'PHOTO', 'VIDEO', 'AUDIO'];

const STORY_GRADIENTS = [
  { id: 'd1', gradient: 'linear-gradient(135deg, #FF512F, #F09819)', label: 'Sunset' },
  { id: 'd2', gradient: 'linear-gradient(135deg, #0F2027, #2C5364)', label: 'City lights' },
  { id: 'd3', gradient: 'linear-gradient(135deg, #134E5E, #71B280)', label: 'Forest' },
  { id: 'd4', gradient: 'linear-gradient(135deg, #41295a, #2F0743)', label: 'Midnight' },
  { id: 'd5', gradient: 'linear-gradient(135deg, #0B0C10, #45A29E)', label: 'Deep sea' },
];

function probeMediaDuration(url, kind) {
  return new Promise((resolve) => {
    try {
      const el = document.createElement(kind === 'audio' ? 'audio' : 'video');
      el.preload = 'metadata';
      const cleanup = () => {
        el.onloadedmetadata = null;
        el.onerror = null;
      };
      el.onloadedmetadata = () => {
        const dur = Number(el.duration);
        cleanup();
        resolve(Number.isFinite(dur) && dur > 0 ? Math.min(60, Math.max(1, Math.round(dur))) : (kind === 'video' ? 15 : 10));
      };
      el.onerror = () => {
        cleanup();
        resolve(kind === 'video' ? 15 : 10);
      };
      el.src = url;
    } catch {
      resolve(kind === 'video' ? 15 : 10);
    }
  });
}

export default function CreateStory() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { theme } = useTheme();
  const isDark = theme !== 'light';

  // Camera & Mode state
  const [activeMode, setActiveMode] = useState('STORY');
  const [zoomLevel, setZoomLevel] = useState('1x');
  const [flashMode, setFlashMode] = useState('auto');
  const [facingMode, setFacingMode] = useState('user');
  const [cameraActive, setCameraActive] = useState(false);
  const [torchSupported, setTorchSupported] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);

  // Creative Tool Overlays
  const [activeTool, setActiveTool] = useState(null);
  const [toolsExpanded, setToolsExpanded] = useState(true);
  const [storyText, setStoryText] = useState('');
  const [backgroundGradient, setBackgroundGradient] = useState(STORY_GRADIENTS[3].gradient);
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOption1, setPollOption1] = useState('Yes');
  const [pollOption2, setPollOption2] = useState('No');
  const [questionPrompt, setQuestionPrompt] = useState('');
  const [selectedMusic, setSelectedMusic] = useState(null);
  const musicLibraryEnabled = useFeatureFlag('stories.music_library');
  const [musicTracks, setMusicTracks] = useState([]);
  const [musicLoading, setMusicLoading] = useState(false);
  const [musicError, setMusicError] = useState(null);
  const [mediaFile, setMediaFile] = useState(null);
  const [mediaType, setMediaType] = useState('image');
  const [mediaDuration, setMediaDuration] = useState(5);
  const [capturedPreview, setCapturedPreview] = useState(null);
  const [selectedGif, setSelectedGif] = useState(null);
  const [linkUrl, setLinkUrl] = useState('');
  const [storyLocation, setStoryLocation] = useState('');
  const [mentionHandle, setMentionHandle] = useState('');
  const [storyTimer, setStoryTimer] = useState(0);
  const [publishing, setPublishing] = useState(false);
  const [audience, setAudience] = useState('public');

  const videoRef = useRef(null);
  const fileInputRef = useRef(null);
  const timerRef = useRef(null);
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const recordedSecondsRef = useRef(0);
  const previewUrlRef = useRef(null);
  const holdActiveRef = useRef(false);

  const setPreviewSafely = useCallback((url) => {
    if (previewUrlRef.current && previewUrlRef.current.startsWith('blob:')) {
      URL.revokeObjectURL(previewUrlRef.current);
    }
    previewUrlRef.current = url;
    setCapturedPreview(url);
  }, []);

  const clearPreview = useCallback(() => {
    setPreviewSafely(null);
    setMediaFile(null);
    setMediaType('image');
    setMediaDuration(5);
  }, [setPreviewSafely]);

  const loadMusicTracks = useCallback(async () => {
    setMusicLoading(true);
    setMusicError(null);
    try {
      const { default: soundService } = await import('../services/soundService.js');
      const tracks = await soundService.getTrendingSounds('All', user?.uid);
      setMusicTracks(Array.isArray(tracks) ? tracks : []);
    } catch (err) {
      setMusicError(err?.message || 'Could not load the music catalog.');
      setMusicTracks([]);
    } finally {
      setMusicLoading(false);
    }
  }, [user?.uid]);

  const initCamera = useCallback(async () => {
    if (activeMode === 'TEXT' || activeMode === 'AUDIO') {
      setCameraActive(false);
      return;
    }
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        let stream;
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode, width: { ideal: 1080 }, height: { ideal: 1920 } },
            audio: activeMode === 'VIDEO',
          });
        } catch {
          stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode, width: { ideal: 1080 }, height: { ideal: 1920 } },
            audio: false,
          });
        }
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch((err) => console.warn('[CreateVibe] preview play:', err?.message));
          setCameraActive(true);
          const track = stream.getVideoTracks?.()[0];
          const caps = track?.getCapabilities?.();
          setTorchSupported(Boolean(caps?.torch));
        }
      }
    } catch (err) {
      console.warn('Camera access unavailable:', err?.message);
      setCameraActive(false);
    }
  }, [facingMode, activeMode]);

  useEffect(() => {
    initCamera();
    const videoEl = videoRef.current;
    return () => {
      if (videoEl && videoEl.srcObject) {
        const stream = videoEl.srcObject;
        stream.getTracks().forEach((track) => track.stop());
      }
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [initCamera]);

  useEffect(() => {
    return () => {
      if (previewUrlRef.current && previewUrlRef.current.startsWith('blob:')) {
        URL.revokeObjectURL(previewUrlRef.current);
      }
    };
  }, []);

  const handleFlipCamera = () => {
    setFacingMode((prev) => (prev === 'user' ? 'environment' : 'user'));
  };

  const handleToggleFlash = async () => {
    const next = flashMode === 'auto' ? 'on' : flashMode === 'on' ? 'off' : 'auto';
    setFlashMode(next);
    const track = videoRef.current?.srcObject?.getVideoTracks?.()[0];
    if (!track || !torchSupported) {
      toast.info(`Flash: ${next.toUpperCase()}`);
      return;
    }
    try {
      await track.applyConstraints({ advanced: [{ torch: next === 'on' }] });
    } catch {
      toast.error('This camera does not support flash control.');
    }
  };

  const startVideoRecording = useCallback(() => {
    if (capturedPreview || isRecording) return;
    const stream = videoRef.current?.srcObject;
    if (!stream || typeof MediaRecorder === 'undefined') {
      toast.error('Camera is not active. Enable camera access or choose a video from Gallery.');
      return;
    }
    try {
      const mime = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
        ? 'video/webm;codecs=vp9'
        : MediaRecorder.isTypeSupported('video/webm')
          ? 'video/webm'
          : '';
      const recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      recorderRef.current = recorder;
      chunksRef.current = [];
      recordedSecondsRef.current = 0;

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        const finalType = mime || 'video/webm';
        const blob = new Blob(chunksRef.current, { type: finalType });
        const secs = Math.max(1, Math.min(60, recordedSecondsRef.current || 1));
        if (blob.size > 0) {
          const file = new File([blob], `vibe-${Date.now()}.webm`, { type: finalType });
          const url = URL.createObjectURL(file);
          setMediaFile(file);
          setMediaType('video');
          setMediaDuration(secs);
          setPreviewSafely(url);
          toast.success(`Video recorded (${secs}s)`);
        } else {
          toast.error('Recording produced no data. Try again.');
        }
      };

      recorder.start(250);
      setIsRecording(true);
      setRecordSeconds(0);
      timerRef.current = setInterval(() => {
        setRecordSeconds((sec) => {
          const next = sec + 1;
          recordedSecondsRef.current = next;
          if (next >= 30) {
            if (recorderRef.current && recorderRef.current.state !== 'inactive') {
              recorderRef.current.stop();
            }
            setIsRecording(false);
            clearInterval(timerRef.current);
            return 30;
          }
          return next;
        });
      }, 1000);
    } catch (err) {
      console.error('Recording failed:', err);
      toast.error('Could not start recording on this device.');
    }
  }, [capturedPreview, isRecording, setPreviewSafely]);

  const stopVideoRecording = useCallback(() => {
    if (!isRecording) return;
    setIsRecording(false);
    if (timerRef.current) clearInterval(timerRef.current);
    try {
      if (recorderRef.current && recorderRef.current.state !== 'inactive') {
        recorderRef.current.stop();
      }
    } catch (err) {
      console.error('Stop recording failed:', err);
    }
  }, [isRecording]);

  const handleCapturePhoto = useCallback(() => {
    if (!cameraActive || !videoRef.current) {
      toast.error('Camera is not active. Enable camera access or pick media from Gallery.');
      return;
    }
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth || 1080;
    canvas.height = videoRef.current.videoHeight || 1920;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          toast.error('Could not capture photo.');
          return;
        }
        const file = new File([blob], `vibe-${Date.now()}.jpg`, { type: 'image/jpeg' });
        const url = URL.createObjectURL(file);
        setMediaFile(file);
        setMediaType('image');
        setMediaDuration(5);
        setPreviewSafely(url);
        toast.success('Photo captured');
      },
      'image/jpeg',
      0.92
    );
  }, [cameraActive, setPreviewSafely]);

  const handleShutterClick = () => {
    if (holdActiveRef.current) {
      holdActiveRef.current = false;
      return;
    }
    if (capturedPreview) {
      clearPreview();
      return;
    }
    if (activeMode === 'VIDEO') {
      if (isRecording) stopVideoRecording();
      else startVideoRecording();
      return;
    }
    handleCapturePhoto();
  };

  const handleShutterHoldStart = () => {
    if (activeMode === 'VIDEO' || activeMode === 'TEXT' || activeMode === 'AUDIO' || capturedPreview) return;
    holdActiveRef.current = false;
    timerRef.current = setTimeout(() => {
      holdActiveRef.current = true;
      startVideoRecording();
    }, 280);
  };

  const handleShutterHoldEnd = () => {
    if (!isRecording && timerRef.current && !holdActiveRef.current) {
      clearTimeout(timerRef.current);
      return;
    }
    if (isRecording && activeMode !== 'VIDEO') {
      stopVideoRecording();
    }
  };

  const handleFilePicked = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const isVid = file.type.startsWith('video/');
    const isAud = file.type.startsWith('audio/');
    const kind = isVid ? 'video' : isAud ? 'audio' : 'image';
    const url = URL.createObjectURL(file);
    setMediaFile(file);
    setMediaType(kind);
    setPreviewSafely(url);
    if (kind === 'video' || kind === 'audio') {
      const dur = await probeMediaDuration(url, kind);
      setMediaDuration(dur);
      if (kind === 'audio') setActiveMode('AUDIO');
    } else {
      setMediaDuration(5);
    }
  };

  const buildStickers = () => {
    const stickers = [];
    if (selectedGif) {
      stickers.push({ type: 'gif', data: { url: selectedGif.url, title: selectedGif.title }, position: { x: 0.5, y: 0.5 } });
    }
    if (storyTimer > 0) {
      stickers.push({
        type: 'countdown',
        data: { seconds: storyTimer, endsAt: Date.now() + storyTimer * 1000 },
        position: { x: 0.5, y: 0.35 },
      });
    }
    if (questionPrompt.trim()) {
      stickers.push({ type: 'question', data: { prompt: questionPrompt.trim() }, position: { x: 0.5, y: 0.48 } });
    }
    if (mentionHandle.trim()) {
      stickers.push({
        type: 'mention',
        data: { handle: mentionHandle.trim().replace(/^@/, '') },
        position: { x: 0.5, y: 0.62 },
      });
    }
    if (storyLocation.trim()) {
      stickers.push({ type: 'location', data: { name: storyLocation.trim() }, position: { x: 0.5, y: 0.24 } });
    }
    if (linkUrl.trim()) {
      stickers.push({ type: 'link', data: { url: linkUrl.trim() }, position: { x: 0.5, y: 0.78 } });
    }
    return stickers.length ? stickers : null;
  };

  const isTextMode = activeMode === 'TEXT';
  const canPublish = isTextMode ? storyText.trim().length > 0 : Boolean(mediaFile);

  const handlePublishStory = async () => {
    if (!user?.uid || publishing) {
      if (!user?.uid) toast.error('Please sign in to publish a Vibe.');
      return;
    }

    if (!canPublish) {
      toast.error(isTextMode ? 'Write a message for your Text Vibe.' : 'Capture or select a photo, video, or audio clip.');
      return;
    }

    setPublishing(true);
    try {
      const storyService = getStoryService();
      const targetType = isTextMode ? 'text' : mediaType;
      const cleanPoll = pollQuestion.trim() && pollOption1.trim() && pollOption2.trim()
        ? { question: pollQuestion.trim(), options: [pollOption1.trim(), pollOption2.trim()] }
        : null;

      const storyPayload = {
        type: targetType,
        content: storyText.trim(),
        mediaFile: isTextMode ? null : mediaFile,
        duration: isTextMode ? 6 : mediaDuration,
        backgroundColor: backgroundGradient || '#0c0f24',
        textColor: '#FFFFFF',
        poll: cleanPoll,
        music: selectedMusic || null,
        linkUrl: linkUrl.trim() || null,
        location: storyLocation.trim() || null,
        taggedUsers: mentionHandle.trim() ? [mentionHandle.trim().replace(/^@/, '')] : [],
        stickers: buildStickers(),
        visibility: audience,
      };

      const res = await storyService.createStory(storyPayload);
      if (res?.success) {
        toast.success('Vibe published!');
        navigate('/stories');
      } else if (res?.queued) {
        toast.info('Offline — saved as draft. Will publish when you are back online.');
        navigate('/stories');
      } else {
        toast.error(res?.error || 'Failed to publish Vibe');
      }
    } catch (err) {
      toast.error(err?.message || 'Vibe publication failed');
    } finally {
      setPublishing(false);
    }
  };

  const liveVideoZoomStyle = {
    transform: zoomLevel === '0.5' ? 'scale(0.88)' : zoomLevel === '2' ? 'scale(1.25)' : 'scale(1)',
    transition: 'transform 200ms ease-out',
  };

  return (
    <div className={cn(
      "min-h-screen select-none relative overflow-x-hidden",
      isDark ? "bg-[#060814] text-white" : "bg-slate-950 text-white"
    )}>
      <div className="max-w-7xl mx-auto min-h-screen flex flex-col lg:flex-row items-center justify-between p-4 lg:p-8 gap-6 lg:gap-8 relative z-10">

        {/* Left Column: Branding & Creative Tools (Desktop) */}
        <div className="hidden lg:flex flex-col justify-between h-[780px] w-72 py-2">
          <div>
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-2xl flex items-center justify-center font-black text-xl text-white shadow-lg"
                style={{ background: BRAND_GRADIENT }}
              >
                A
              </div>
              <div>
                <h1 className="text-xl font-black font-display tracking-tight">
                  Vibes Studio
                </h1>
                <p className="text-xs font-semibold text-white/60">
                  Capture, design &amp; publish
                </p>
              </div>
            </div>

            {toolsExpanded && (
              <div className="mt-8">
                <span className="text-[11px] font-bold uppercase tracking-widest text-white/50 block mb-3">
                  Creative Tools
                </span>
                <div className="bg-white/[0.04] border border-white/10 rounded-3xl p-2.5 space-y-1 backdrop-blur-xl shadow-2xl">
                  {CREATIVE_TOOLS.filter((tool) => tool.id !== 'music' || musicLibraryEnabled).map((tool) => {
                    const Icon = tool.icon;
                    const isSelected = activeTool === tool.id;
                    return (
                      <button
                        type="button"
                        key={tool.id}
                        onClick={() => {
                          setActiveTool(isSelected ? null : tool.id);
                          if (tool.id === 'music' && !isSelected && musicTracks.length === 0) loadMusicTracks();
                        }}
                        className={cn(
                          "w-full min-h-[40px] flex items-center gap-3 px-3.5 py-2 rounded-2xl text-xs font-semibold transition-all duration-150 cursor-pointer",
                          isSelected
                            ? "text-white shadow-md"
                            : "text-white/80 hover:bg-white/10 hover:text-white"
                        )}
                        style={isSelected ? { background: BRAND_GRADIENT } : undefined}
                      >
                        <Icon className="w-4 h-4 shrink-0" aria-hidden="true" />
                        <span>{tool.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => navigate('/stories')}
            className="w-full min-h-[44px] rounded-2xl border border-white/15 bg-white/5 hover:bg-white/10 text-xs font-semibold text-white/80 flex items-center justify-center gap-2 transition-colors cursor-pointer"
          >
            <span>Browse Vibes Feed</span>
            <ChevronRight className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        {/* Center: Clean Studio Canvas (No fake phone bezel) */}
        <div className="relative w-full max-w-[420px] h-[calc(100vh-2rem)] max-h-[820px] min-h-[580px] rounded-3xl bg-black border border-white/15 shadow-2xl overflow-hidden flex flex-col justify-between">

          {/* Media / Canvas Stage */}
          <div className="absolute inset-0 z-0 bg-[#0c0f24]" style={isTextMode || mediaType === 'audio' ? { background: backgroundGradient } : undefined}>
            {capturedPreview ? (
              mediaType === 'video' ? (
                <video
                  src={capturedPreview}
                  controls
                  autoPlay
                  loop
                  playsInline
                  className="w-full h-full object-cover"
                />
              ) : mediaType === 'audio' ? (
                <div className="w-full h-full flex flex-col items-center justify-center px-6 gap-5 text-center">
                  <div className="w-20 h-20 rounded-3xl bg-white/15 border border-white/25 backdrop-blur-xl flex items-center justify-center">
                    <Music className="w-9 h-9 text-white" aria-hidden="true" />
                  </div>
                  <p className="text-sm font-bold text-white truncate max-w-full">
                    {mediaFile?.name || 'Audio Vibe'}
                  </p>
                  <audio src={capturedPreview} controls className="w-full max-w-xs" />
                </div>
              ) : (
                <LazyImage
                  src={capturedPreview}
                  alt="Vibe capture preview"
                  className="w-full h-full object-cover"
                />
              )
            ) : isTextMode ? (
              <div className="w-full h-full flex flex-col items-center justify-center px-8 text-center">
                <textarea
                  aria-label="Text Vibe content"
                  value={storyText}
                  onChange={(e) => setStoryText(e.target.value)}
                  placeholder="Write your Vibe..."
                  rows={4}
                  maxLength={280}
                  className="w-full bg-transparent text-center text-2xl sm:text-3xl font-extrabold text-white placeholder:text-white/50 outline-none resize-none leading-snug"
                />
                <span className="text-[11px] font-medium text-white/60 mt-2">
                  {storyText.length} / 280
                </span>
              </div>
            ) : cameraActive ? (
              <video
                ref={videoRef}
                playsInline
                muted
                style={liveVideoZoomStyle}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center px-6 text-center bg-[#0c0f24] gap-3">
                <div className="w-14 h-14 rounded-2xl bg-white/10 border border-white/15 flex items-center justify-center">
                  <ImageIcon className="w-7 h-7 text-white/70" aria-hidden="true" />
                </div>
                <p className="text-white/70 text-sm font-medium max-w-xs">
                  Camera unavailable in this browser. Pick a photo, video, or audio clip from Gallery, or switch to TEXT mode.
                </p>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="min-h-[44px] px-4 py-2 rounded-xl text-xs font-bold text-white cursor-pointer"
                  style={{ background: BRAND_GRADIENT }}
                >
                  Choose Media
                </button>
              </div>
            )}

            <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-transparent to-black/80 pointer-events-none" />

            {/* Overlay Text Caption when in Media mode */}
            {!isTextMode && storyText && (
              <div className="absolute inset-0 flex items-center justify-center p-8 z-10 pointer-events-none">
                <p className="text-2xl sm:text-3xl font-extrabold text-white text-center font-display drop-shadow-[0_4px_16px_rgba(0,0,0,0.9)]">
                  {storyText}
                </p>
              </div>
            )}

            {/* Sticker Preview Chips on Canvas */}
            <div className="absolute top-20 left-4 right-4 z-10 flex flex-wrap gap-2 pointer-events-none">
              {selectedMusic && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-black/60 backdrop-blur-md border border-white/20 text-xs font-semibold text-white">
                  <Music className="w-3.5 h-3.5" aria-hidden="true" />
                  <span className="truncate max-w-[160px]">{selectedMusic.title}</span>
                </span>
              )}
              {storyLocation.trim() && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-black/60 backdrop-blur-md border border-white/20 text-xs font-semibold text-white">
                  <MapPin className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>{storyLocation.trim()}</span>
                </span>
              )}
              {mentionHandle.trim() && (
                <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-black/60 backdrop-blur-md border border-white/20 text-xs font-semibold text-white">
                  <span>@{mentionHandle.trim().replace(/^@/, '')}</span>
                </span>
              )}
            </div>

            {/* Active Poll Tool */}
            {activeTool === 'poll' && (
              <div className="absolute top-1/4 inset-x-5 z-20 p-4 rounded-2xl bg-black/80 backdrop-blur-xl border border-white/20 text-white shadow-2xl space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-white/70">Poll Sticker</span>
                  <button
                    type="button"
                    onClick={() => setActiveTool(null)}
                    aria-label="Close poll editor"
                    className="w-8 h-8 rounded-lg hover:bg-white/10 flex items-center justify-center"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <input
                  aria-label="Poll question"
                  type="text"
                  value={pollQuestion}
                  onChange={(e) => setPollQuestion(e.target.value)}
                  placeholder="Ask a question..."
                  className="w-full text-sm font-bold bg-transparent border-b border-white/20 pb-2 outline-none text-center"
                />
                <input
                  type="text"
                  value={pollOption1}
                  onChange={(e) => setPollOption1(e.target.value)}
                  placeholder="Option 1"
                  aria-label="Poll option 1"
                  className="w-full p-2.5 rounded-xl bg-white/10 text-xs font-semibold text-center border border-white/10 outline-none focus:border-white/40"
                />
                <input
                  type="text"
                  value={pollOption2}
                  onChange={(e) => setPollOption2(e.target.value)}
                  placeholder="Option 2"
                  aria-label="Poll option 2"
                  className="w-full p-2.5 rounded-xl bg-white/10 text-xs font-semibold text-center border border-white/10 outline-none focus:border-white/40"
                />
              </div>
            )}

            {/* Active Music Picker */}
            {activeTool === 'music' && (
              <div className="absolute bottom-28 inset-x-4 z-20 p-3 rounded-2xl bg-black/85 backdrop-blur-xl border border-white/20 text-white shadow-2xl">
                <div className="flex items-center justify-between mb-2 px-1">
                  <span className="text-xs font-bold uppercase tracking-wider text-white/80">Soundtrack</span>
                  <div className="flex items-center gap-2">
                    {selectedMusic && (
                      <button type="button" onClick={() => setSelectedMusic(null)} className="text-xs text-white/70 hover:text-white">
                        Clear
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setActiveTool(null)}
                      aria-label="Close music picker"
                      className="w-7 h-7 rounded-lg hover:bg-white/10 flex items-center justify-center"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                {musicLoading ? (
                  <p className="text-xs text-white/60 px-1 py-2">Loading tracks…</p>
                ) : musicError ? (
                  <p className="text-xs text-red-400 px-1 py-2">{musicError}</p>
                ) : musicTracks.length === 0 ? (
                  <p className="text-xs text-white/60 px-1 py-2">No tracks available yet.</p>
                ) : (
                  <div className="max-h-40 overflow-y-auto space-y-1">
                    {musicTracks.slice(0, 20).map((track) => (
                      <button
                        type="button"
                        key={track.id}
                        onClick={() => { setSelectedMusic(track); setActiveTool(null); }}
                        className={cn(
                          "w-full min-h-[40px] flex items-center gap-2 px-2.5 py-2 rounded-xl text-left text-xs transition-colors",
                          selectedMusic?.id === track.id
                            ? "text-white font-semibold"
                            : "text-white/80 hover:bg-white/10"
                        )}
                        style={selectedMusic?.id === track.id ? { background: BRAND_GRADIENT } : undefined}
                      >
                        <Music className="w-3.5 h-3.5 flex-shrink-0" aria-hidden="true" />
                        <span className="truncate">
                          {track.title || 'Untitled'}
                          {track.artist ? ` — ${track.artist}` : ''}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Text tool */}
            {activeTool === 'text' && !isTextMode && (
              <div className="absolute top-1/4 inset-x-5 z-20 p-4 rounded-2xl bg-black/80 backdrop-blur-xl border border-white/20 text-white shadow-2xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-white/70">Caption Overlay</span>
                  <button
                    type="button"
                    onClick={() => setActiveTool(null)}
                    aria-label="Close text tool"
                    className="w-8 h-8 rounded-lg hover:bg-white/10 flex items-center justify-center"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <input
                  aria-label="Overlay text"
                  type="text"
                  value={storyText}
                  onChange={(e) => setStoryText(e.target.value)}
                  placeholder="Type caption overlay..."
                  className="w-full text-sm font-bold bg-transparent border-b border-white/20 pb-2 outline-none text-center"
                />
              </div>
            )}

            {/* GIF / Stickers */}
            {(activeTool === 'gif' || activeTool === 'stickers') && (
              <div className="absolute bottom-28 inset-x-4 z-20">
                <GIFPicker
                  onSelect={(url, gif) => { setSelectedGif({ url, title: gif?.title || 'GIF' }); setActiveTool(null); }}
                  onClose={() => setActiveTool(null)}
                />
              </div>
            )}

            {/* Link sticker */}
            {activeTool === 'link' && (
              <div className="absolute top-1/4 inset-x-5 z-20 p-4 rounded-2xl bg-black/80 backdrop-blur-xl border border-white/20 text-white shadow-2xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-white/70">Link Sticker</span>
                  <button
                    type="button"
                    onClick={() => setActiveTool(null)}
                    aria-label="Close link editor"
                    className="w-8 h-8 rounded-lg hover:bg-white/10 flex items-center justify-center"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <input
                  aria-label="Link URL"
                  type="url"
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                  placeholder="https://…"
                  className="w-full text-sm bg-transparent border-b border-white/20 pb-2 outline-none"
                />
              </div>
            )}

            {/* Location sticker */}
            {activeTool === 'location' && (
              <div className="absolute top-1/4 inset-x-5 z-20 p-4 rounded-2xl bg-black/80 backdrop-blur-xl border border-white/20 text-white shadow-2xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-white/70">Location Sticker</span>
                  <button
                    type="button"
                    onClick={() => setActiveTool(null)}
                    aria-label="Close location editor"
                    className="w-8 h-8 rounded-lg hover:bg-white/10 flex items-center justify-center"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <input
                  aria-label="Add a location"
                  type="text"
                  value={storyLocation}
                  onChange={(e) => setStoryLocation(e.target.value)}
                  placeholder="City, venue, or landmark"
                  className="w-full text-sm bg-transparent border-b border-white/20 pb-2 outline-none text-center"
                />
              </div>
            )}

            {/* Mention sticker */}
            {activeTool === 'mention' && (
              <div className="absolute top-1/4 inset-x-5 z-20 p-4 rounded-2xl bg-black/80 backdrop-blur-xl border border-white/20 text-white shadow-2xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-white/70">Mention Creator</span>
                  <button
                    type="button"
                    onClick={() => setActiveTool(null)}
                    aria-label="Close mention editor"
                    className="w-8 h-8 rounded-lg hover:bg-white/10 flex items-center justify-center"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <input
                  aria-label="Mention username"
                  type="text"
                  value={mentionHandle}
                  onChange={(e) => setMentionHandle(e.target.value)}
                  placeholder="@username"
                  className="w-full text-sm bg-transparent border-b border-white/20 pb-2 outline-none text-center"
                />
              </div>
            )}

            {/* Q&A Question sticker (dedicated state, isolated from poll) */}
            {activeTool === 'question' && (
              <div className="absolute top-1/4 inset-x-5 z-20 p-4 rounded-2xl bg-black/80 backdrop-blur-xl border border-white/20 text-white shadow-2xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-white/70">Q&amp;A Sticker</span>
                  <button
                    type="button"
                    onClick={() => setActiveTool(null)}
                    aria-label="Close Q&A editor"
                    className="w-8 h-8 rounded-lg hover:bg-white/10 flex items-center justify-center"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <input
                  aria-label="Ask me a question"
                  type="text"
                  value={questionPrompt}
                  onChange={(e) => setQuestionPrompt(e.target.value)}
                  placeholder="Ask me anything…"
                  className="w-full text-sm font-bold bg-transparent border-b border-white/20 pb-2 outline-none text-center"
                />
              </div>
            )}

            {/* Countdown Timer sticker */}
            {activeTool === 'timer' && (
              <div className="absolute top-1/4 inset-x-5 z-20 p-4 rounded-2xl bg-black/80 backdrop-blur-xl border border-white/20 text-white shadow-2xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-white/70">Countdown Sticker</span>
                  <button
                    type="button"
                    onClick={() => setActiveTool(null)}
                    aria-label="Close countdown editor"
                    className="w-8 h-8 rounded-lg hover:bg-white/10 flex items-center justify-center"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="flex items-center justify-center gap-2">
                  <Timer className="w-4 h-4 text-white/70" aria-hidden="true" />
                  <input
                    aria-label="Countdown duration in seconds"
                    type="number"
                    min="0"
                    max="86400"
                    value={storyTimer}
                    onChange={(e) => setStoryTimer(Math.max(0, Math.min(86400, Number(e.target.value) || 0)))}
                    className="w-24 text-sm bg-transparent border-b border-white/20 pb-2 outline-none text-center"
                  />
                  <span className="text-xs text-white/70">seconds</span>
                </div>
              </div>
            )}

            {/* Selected GIF preview */}
            {selectedGif && (
              <div className="absolute top-20 right-4 z-10 w-24 rounded-2xl overflow-hidden border border-white/40 bg-black/60">
                <LazyImage src={selectedGif.url} alt={selectedGif.title} className="w-full h-auto" />
                <button
                  type="button"
                  onClick={() => setSelectedGif(null)}
                  className="w-full py-1 bg-black/75 text-white text-[10px] font-bold"
                >
                  Remove
                </button>
              </div>
            )}

            {/* Recording Timer Pill */}
            {isRecording && (
              <div className="absolute top-16 left-4 z-20 flex items-center gap-2 px-3 py-1.5 rounded-xl bg-rose-600 text-white text-xs font-bold shadow-lg">
                <span className="w-2.5 h-2.5 rounded-full bg-white" />
                <span className="tabular-nums">00:{recordSeconds.toString().padStart(2, '0')}</span>
              </div>
            )}
          </div>

          {/* Top Studio Bar */}
          <div className="relative z-20 pt-4 px-4 flex items-center justify-between">
            <button
              type="button"
              onClick={() => navigate(-1)}
              aria-label="Close Vibes studio"
              className="w-11 h-11 rounded-full bg-black/50 backdrop-blur-md border border-white/15 flex items-center justify-center hover:bg-black/70 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5 text-white" />
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleToggleFlash}
                aria-label={`Flash mode: ${flashMode}`}
                className="w-11 h-11 rounded-full bg-black/50 backdrop-blur-md border border-white/15 flex items-center justify-center hover:bg-black/70 transition-colors cursor-pointer"
              >
                <Zap className={cn("w-4 h-4", flashMode === 'on' ? "text-amber-400" : "text-white")} />
              </button>

              <button
                type="button"
                onClick={handleFlipCamera}
                aria-label="Switch camera"
                className="w-11 h-11 rounded-full bg-black/50 backdrop-blur-md border border-white/15 flex items-center justify-center hover:bg-black/70 transition-colors cursor-pointer"
              >
                <RefreshCw className="w-4 h-4 text-white" />
              </button>

              <button
                type="button"
                onClick={() => setToolsExpanded((prev) => !prev)}
                aria-label="Toggle studio tools"
                aria-expanded={toolsExpanded}
                className="w-11 h-11 rounded-full bg-black/50 backdrop-blur-md border border-white/15 flex items-center justify-center hover:bg-black/70 transition-colors cursor-pointer lg:hidden"
              >
                <Sliders className="w-4 h-4 text-white" />
              </button>
            </div>
          </div>

          {/* Mobile Creative Tools Strip */}
          {toolsExpanded && (
            <div className="relative z-20 px-4 lg:hidden">
              <div className="bg-black/55 border border-white/15 rounded-2xl p-2 backdrop-blur-xl">
                <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                  {CREATIVE_TOOLS.filter((tool) => tool.id !== 'music' || musicLibraryEnabled).map((tool) => {
                    const Icon = tool.icon;
                    const isSelected = activeTool === tool.id;
                    return (
                      <button
                        type="button"
                        key={tool.id}
                        onClick={() => {
                          setActiveTool(isSelected ? null : tool.id);
                          if (tool.id === 'music' && !isSelected && musicTracks.length === 0) loadMusicTracks();
                        }}
                        className={cn(
                          "min-h-[40px] flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap shrink-0 transition-colors",
                          isSelected ? "text-white" : "text-white/80 hover:bg-white/10"
                        )}
                        style={isSelected ? { background: BRAND_GRADIENT } : undefined}
                      >
                        <Icon className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>{tool.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Bottom Controls */}
          <div className="relative z-20 pb-5 px-4 space-y-3">
            {/* Background swatches in Text / Audio modes */}
            {(isTextMode || mediaType === 'audio') && (
              <div className="flex items-center justify-center gap-2">
                {STORY_GRADIENTS.map((g) => (
                  <button
                    type="button"
                    key={g.id}
                    aria-label={`Select ${g.label} background`}
                    onClick={() => setBackgroundGradient(g.gradient)}
                    className={cn(
                      "w-8 h-8 rounded-full border-2 transition-transform cursor-pointer",
                      backgroundGradient === g.gradient ? "border-white scale-110" : "border-white/30"
                    )}
                    style={{ background: g.gradient }}
                  />
                ))}
              </div>
            )}

            {/* Zoom Selector for Live Camera */}
            {!capturedPreview && !isTextMode && activeMode !== 'AUDIO' && (
              <div className="flex items-center justify-center gap-2">
                {['0.5', '1x', '2'].map((z) => (
                  <button
                    type="button"
                    key={z}
                    onClick={() => setZoomLevel(z)}
                    className={cn(
                      "min-w-[36px] min-h-[36px] rounded-full text-[11px] font-bold transition-all flex items-center justify-center backdrop-blur-md cursor-pointer",
                      zoomLevel === z
                        ? "bg-white text-black scale-105 shadow-lg"
                        : "bg-black/50 text-white/80 hover:bg-black/70 border border-white/15"
                    )}
                  >
                    {z}
                  </button>
                ))}
              </div>
            )}

            {/* Shutter / Gallery Row */}
            <div className="flex items-center justify-between px-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                aria-label="Open media gallery"
                className="flex flex-col items-center gap-1 cursor-pointer"
              >
                <div className="w-11 h-11 rounded-2xl border border-white/25 bg-black/50 backdrop-blur-md flex items-center justify-center hover:border-white/50 transition-colors">
                  <ImageIcon className="w-5 h-5 text-white" aria-hidden="true" />
                </div>
                <span className="text-[10px] font-semibold text-white/80">Gallery</span>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,video/*,audio/*"
                onChange={handleFilePicked}
                className="hidden"
              />

              {!isTextMode && (
                <button
                  type="button"
                  onClick={handleShutterClick}
                  onMouseDown={handleShutterHoldStart}
                  onMouseUp={handleShutterHoldEnd}
                  onTouchStart={handleShutterHoldStart}
                  onTouchEnd={handleShutterHoldEnd}
                  aria-label={
                    capturedPreview
                      ? 'Discard capture and retake'
                      : isRecording
                        ? 'Stop video recording'
                        : activeMode === 'VIDEO'
                          ? 'Start video recording'
                          : 'Capture Vibe'
                  }
                  className="relative w-18 h-18 rounded-full p-1.5 shadow-xl active:scale-95 transition-transform cursor-pointer"
                  style={{ background: isRecording ? '#E11D48' : BRAND_GRADIENT }}
                >
                  <div className="w-full h-full rounded-full bg-white flex items-center justify-center">
                    {capturedPreview ? (
                      <Check className="w-7 h-7 text-slate-900" aria-hidden="true" />
                    ) : isRecording ? (
                      <Square className="w-6 h-6 text-rose-600 fill-rose-600" aria-hidden="true" />
                    ) : activeMode === 'VIDEO' ? (
                      <Video className="w-6 h-6 text-rose-600" aria-hidden="true" />
                    ) : activeMode === 'AUDIO' ? (
                      <Mic className="w-6 h-6 text-slate-900" aria-hidden="true" />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-slate-100 border border-slate-300" />
                    )}
                  </div>
                </button>
              )}

              <button
                type="button"
                onClick={handleFlipCamera}
                aria-label="Flip camera orientation"
                className="flex flex-col items-center gap-1 cursor-pointer"
              >
                <div className="w-11 h-11 rounded-2xl bg-black/50 backdrop-blur-md border border-white/15 flex items-center justify-center hover:bg-black/70 transition-colors">
                  <RefreshCw className="w-5 h-5 text-white" aria-hidden="true" />
                </div>
                <span className="text-[10px] font-semibold text-white/80">Flip</span>
              </button>
            </div>

            {/* Capture Mode Selector */}
            <div className="flex items-center justify-center gap-2 overflow-x-auto no-scrollbar pt-1">
              {CAPTURE_MODES.map((mode) => {
                const isActive = activeMode === mode;
                return (
                  <button
                    type="button"
                    key={mode}
                    onClick={() => {
                      setActiveMode(mode);
                      if (mode === 'AUDIO' && !mediaFile) {
                        fileInputRef.current?.click();
                      }
                    }}
                    className={cn(
                      "px-3 py-1.5 rounded-xl text-[11px] font-bold tracking-wider uppercase transition-all whitespace-nowrap cursor-pointer",
                      isActive ? "text-white shadow-md" : "text-white/60 hover:text-white"
                    )}
                    style={isActive ? { background: BRAND_GRADIENT } : undefined}
                  >
                    {mode}
                  </button>
                );
              })}
            </div>

            {/* Audience + Publish CTA */}
            {canPublish && (
              <div className="pt-2 space-y-2.5">
                <div role="radiogroup" aria-label="Vibe audience" className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'public', label: 'Everyone', icon: Globe },
                    { id: 'followers', label: 'Followers', icon: Users },
                    { id: 'private', label: 'Only me', icon: Lock },
                  ].map((opt) => {
                    const Icon = opt.icon;
                    const isActive = audience === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        role="radio"
                        aria-checked={isActive}
                        onClick={() => setAudience(opt.id)}
                        className={cn(
                          'min-h-[38px] flex items-center justify-center gap-1.5 rounded-xl py-1.5 text-xs font-bold border transition cursor-pointer',
                          isActive
                            ? 'bg-white/20 border-white/50 text-white'
                            : 'bg-white/5 border-white/10 text-white/60 hover:bg-white/10'
                        )}
                      >
                        <Icon className="w-3.5 h-3.5" aria-hidden="true" />
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
                <button
                  type="button"
                  onClick={handlePublishStory}
                  disabled={publishing}
                  className="w-full min-h-[46px] py-3 rounded-2xl text-white font-bold text-sm shadow-xl flex items-center justify-center gap-2 active:scale-[0.98] transition-transform disabled:opacity-50 cursor-pointer"
                  style={{ background: BRAND_GRADIENT }}
                >
                  {publishing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  {publishing ? 'Publishing Vibe…' : 'Publish Vibe'}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Desktop Guide & Gradient Presets */}
        <div className="hidden lg:flex flex-col justify-between h-[780px] w-80 py-2">
          <div className="space-y-6">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-widest text-white/50 block mb-3">
                Modes
              </span>
              <div className="space-y-1.5">
                {CAPTURE_MODES.map((mode) => {
                  const active = activeMode === mode;
                  return (
                    <button
                      type="button"
                      key={mode}
                      onClick={() => setActiveMode(mode)}
                      className={cn(
                        "w-full min-h-[40px] text-left px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-between cursor-pointer border",
                        active
                          ? "bg-white/15 text-white border-white/30"
                          : "text-white/60 border-transparent hover:bg-white/5 hover:text-white"
                      )}
                    >
                      <span>{mode}</span>
                      {active && <span className="w-2 h-2 rounded-full bg-white" />}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-white/[0.04] border border-white/10 space-y-2 text-xs text-white/75">
              <span className="text-[11px] font-bold uppercase tracking-wider text-white/60 block">
                Studio Guide
              </span>
              <p>Tap shutter for photo, or hold in Story mode for video.</p>
              <p>Switch to TEXT mode for typography cards with custom gradients.</p>
              <p>Add interactive Poll, Q&amp;A, Countdown, Mention, or Link stickers before publishing.</p>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-white/[0.04] border border-white/10 space-y-3">
            <span className="text-xs font-bold text-white/80 block">Canvas Gradients</span>
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
              {STORY_GRADIENTS.map((d) => (
                <button
                  type="button"
                  key={d.id}
                  onClick={() => {
                    setBackgroundGradient(d.gradient);
                    if (activeMode !== 'TEXT' && !mediaFile) setActiveMode('TEXT');
                    toast.success(`${d.label} gradient applied`);
                  }}
                  aria-label={`Apply ${d.label} gradient`}
                  className={cn(
                    "w-11 h-14 rounded-xl border-2 transition-all flex-shrink-0 cursor-pointer",
                    backgroundGradient === d.gradient ? "border-white scale-105" : "border-white/20 hover:border-white/50"
                  )}
                  style={{ background: d.gradient }}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
