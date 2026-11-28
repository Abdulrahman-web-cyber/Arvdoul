// src/screens/CreateStory.jsx
//
// Arvdoul Vibes Studio (Part 1 Core Experience):
//   - Create Image, Video, Text (and Audio) Vibes
//   - Lazy permission-aware camera (idle / requesting / granted / denied / unavailable)
//   - Strict client validation via vibeContracts.js
//   - Image editing (aspect crop, rotate, brightness, contrast, fit/fill)
//   - Video editing (trim start/end <= 60s, mute toggle, cover frame picker)
//   - Multi-element draggable/styled Text Overlays + non-destructive Brush/Eraser drawing
//   - Shared-renderer inline Preview (<VibePreviewModal /> -> <VibeRenderer />)
//   - 6-tier Audience + Close Circle & Selected Users picker (<VibeAudienceModal />)
//   - IndexedDB Drafts & crash recovery (vibeDraftService) + honest Upload Lifecycle overlay

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { evaluateContentSafety } from '../utils/contentSafety.js';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { cn } from '../lib/utils';
import {
  X, Zap, RefreshCw, Sliders, Type, Smile, Music, BarChart2, HelpCircle,
  AtSign, MapPin, Link2, Timer, ChevronRight, Sparkles, Send, Check,
  Video, Square, Image as ImageIcon, Mic, Camera, Eye, Scissors,
  Brush, Shield, Save, FolderOpen, Trash2, AlignLeft, AlignCenter, AlignRight, Calendar
} from 'lucide-react';
import { getStoryService } from '../services/storyService';
import GIFPicker from '../components/Shared/GIFPicker';
import { useFeatureFlag } from '../hooks/useFeatureFlag.js';
import { LazyImage } from '../components/Shared/LazyImage';
import { BRAND_GRADIENT } from '../design-system/tokens.js';
import {
  VIBE_AUDIENCES,
  VIBE_TEXT_BACKGROUNDS,
  VIBE_FONT_OPTIONS,
  VIBE_LIMITS,
  VIBE_UPLOAD_STATES,
  getAudienceMeta,
  getVibeFontCss,
  inferVibeMediaKindAndMime,
  validateVibeEvent,
  validateVibeMedia,
  validateVibeText,
  validateAudienceSelection,
  sanitizeTextOverlays,
  sanitizeDrawingPaths,
  createVibeIdempotencyKey,
} from '../config/vibeContracts.js';
import vibeDraftService from '../services/vibeDraftService.js';
import { VibeDrawingStage, VibeDrawingToolbar } from '../components/vibes/studio/VibeDrawingCanvas.jsx';
import VibeMediaEditorPanel, { bakeEditedImageFile } from '../components/vibes/studio/VibeMediaEditorPanel.jsx';
import { VibeDraggableOverlaysStage, VibeTextOverlayPanel } from '../components/vibes/studio/VibeTextOverlayEditor.jsx';
import VibeAudienceModal from '../components/vibes/studio/VibeAudienceModal.jsx';
import { VibePreviewModal, VibePublishOverlay } from '../components/vibes/studio/VibePreviewAndPublishModals.jsx';

const CREATIVE_TOOLS = [
  { id: 'adjust', label: 'Crop & Edit', icon: Scissors },
  { id: 'overlays', label: 'Text Layer', icon: Type },
  { id: 'freehand', label: 'Brush', icon: Brush },
  { id: 'text', label: 'Caption', icon: Type },
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

const CAPTURE_MODES = ['STORY', 'TEXT', 'PHOTO', 'VIDEO', 'AUDIO', 'EVENT'];

const DEFAULT_MEDIA_EDITS = {
  aspectRatio: 'original',
  rotation: 0,
  brightness: 100,
  contrast: 100,
  fitMode: 'contain',
  trimStart: 0,
  trimEnd: null,
  muted: false,
  coverUrl: null,
};

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
        resolve(Number.isFinite(dur) && dur > 0 ? dur : (kind === 'video' ? 15 : 10));
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

  // Mode & Camera Permission State (lazy initialization — no surprise prompt on load)
  const [activeMode, setActiveMode] = useState('STORY');
  const [zoomLevel, setZoomLevel] = useState('1x');
  const [flashMode, setFlashMode] = useState('auto');
  const [facingMode, setFacingMode] = useState('user');
  const [cameraPermission, setCameraPermission] = useState('idle'); // idle | requesting | granted | denied | unavailable
  const [torchSupported, setTorchSupported] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);

  // Content & Studio Editing State
  const [activeTool, setActiveTool] = useState(null);
  const [toolsExpanded, setToolsExpanded] = useState(true);
  const [storyText, setStoryText] = useState('');
  const [backgroundGradient, setBackgroundGradient] = useState(VIBE_TEXT_BACKGROUNDS[0].background);
  const [textColor, setTextColor] = useState(VIBE_TEXT_BACKGROUNDS[0].textColor);
  const [textFont, setTextFont] = useState('display');
  const [textAlign, setTextAlign] = useState('center');

  // Repositionable Overlays + Non-destructive Drawing State
  const [textOverlays, setTextOverlays] = useState([]);
  const [selectedOverlayId, setSelectedOverlayId] = useState(null);
  const [drawingPaths, setDrawingPaths] = useState([]);
  const [undoStack, setUndoStack] = useState([]);
  const [redoStack, setRedoStack] = useState([]);
  const [brushColor, setBrushColor] = useState('#FFFFFF');
  const [brushSize, setBrushSize] = useState(8);
  const [brushMode, setBrushMode] = useState('draw');

  // Media File & Editor State
  const [mediaFile, setMediaFile] = useState(null);
  const [mediaType, setMediaType] = useState('image');
  const [mediaDuration, setMediaDuration] = useState(5);
  const [nativeDuration, setNativeDuration] = useState(15);
  const [capturedPreview, setCapturedPreview] = useState(null);
  const [mediaEdits, setMediaEdits] = useState(DEFAULT_MEDIA_EDITS);

  // Stickers & Extras
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOption1, setPollOption1] = useState('Yes');
  const [pollOption2, setPollOption2] = useState('No');
  const [questionPrompt, setQuestionPrompt] = useState('');
  const [selectedMusic, setSelectedMusic] = useState(null);
  const musicLibraryEnabled = useFeatureFlag('stories.music_library');
  const [musicTracks, setMusicTracks] = useState([]);
  const [musicLoading, setMusicLoading] = useState(false);
  const [musicError, setMusicError] = useState(null);
  const [selectedGif, setSelectedGif] = useState(null);
  const [linkUrl, setLinkUrl] = useState('');
  const [storyLocation, setStoryLocation] = useState('');
  const [mentionHandle, setMentionHandle] = useState('');
  const [storyTimer, setStoryTimer] = useState(0);

  // Event Vibe State
  const [eventTitle, setEventTitle] = useState('');
  const [eventStartsAt, setEventStartsAt] = useState('');
  const [eventLocation, setEventLocation] = useState('');
  const [eventCtaText, setEventCtaText] = useState('RSVP / Details');
  const [eventCtaUrl, setEventCtaUrl] = useState('');
  const [eventDescription, setEventDescription] = useState('');

  // Audio Mic Recording State
  const [audioPermission, setAudioPermission] = useState('idle'); // idle | requesting | granted | denied | unavailable

  // Audience & Preview & Publish State
  const [audience, setAudience] = useState('public');
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [audienceModalOpen, setAudienceModalOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [uploadState, setUploadState] = useState(VIBE_UPLOAD_STATES.IDLE);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState(null);

  // Drafts State
  const [activeDraftId, setActiveDraftId] = useState(null);
  const [idempotencyKey, setIdempotencyKey] = useState(() => createVibeIdempotencyKey('user'));
  const [savedDrafts, setSavedDrafts] = useState([]);
  const [draftsDrawerOpen, setDraftsDrawerOpen] = useState(false);

  const videoRef = useRef(null);
  const previewVideoRef = useRef(null);
  const fileInputRef = useRef(null);
  const timerRef = useRef(null);
  const holdTimeoutRef = useRef(null);
  const recorderRef = useRef(null);
  const audioStreamRef = useRef(null);
  const chunksRef = useRef([]);
  const recordedSecondsRef = useRef(0);
  const previewUrlRef = useRef(null);
  const holdActiveRef = useRef(false);
  const activeUploadHandleRef = useRef(null);
  const abortControllerRef = useRef(null);

  const cameraActive = cameraPermission === 'granted';

  const setPreviewSafely = useCallback((url) => {
    if (previewUrlRef.current && previewUrlRef.current.startsWith('blob:')) {
      URL.revokeObjectURL(previewUrlRef.current);
    }
    previewUrlRef.current = url;
    setCapturedPreview(url);
  }, []);

  const stopAudioStream = useCallback(() => {
    if (audioStreamRef.current) {
      audioStreamRef.current.getTracks().forEach((track) => track.stop());
      audioStreamRef.current = null;
    }
  }, []);

  const stopCameraStream = useCallback(() => {
    const videoEl = videoRef.current;
    if (videoEl && videoEl.srcObject) {
      videoEl.srcObject.getTracks().forEach((track) => track.stop());
      videoEl.srcObject = null;
    }
    setTorchSupported(false);
  }, []);

  const clearPreview = useCallback(() => {
    setPreviewSafely(null);
    setMediaFile(null);
    setMediaType('image');
    setMediaDuration(5);
    setNativeDuration(15);
    setMediaEdits(DEFAULT_MEDIA_EDITS);
  }, [setPreviewSafely]);

  const loadDraftsList = useCallback(async () => {
    if (!user?.uid) return;
    try {
      const list = await vibeDraftService.listDrafts(user.uid);
      setSavedDrafts(list);
    } catch (err) {
      console.warn('[CreateStory] failed to load saved drafts:', err?.message || err);
      toast.error('Could not load saved drafts from this device.');
      setSavedDrafts([]);
    }
  }, [user?.uid]);

  useEffect(() => {
    loadDraftsList();
  }, [loadDraftsList]);

  useEffect(() => {
    if (user?.uid && !activeDraftId) {
      setIdempotencyKey(createVibeIdempotencyKey(user.uid));
    }
  }, [user?.uid, activeDraftId]);

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

  const requestCameraAccess = useCallback(async (overrideFacing = facingMode, overrideMode = activeMode) => {
    if (overrideMode === 'TEXT' || overrideMode === 'AUDIO' || overrideMode === 'EVENT') {
      stopCameraStream();
      setCameraPermission('idle');
      return;
    }
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setCameraPermission('unavailable');
      return;
    }
    setCameraPermission('requesting');
    stopCameraStream();
    const needsAudioTrack = overrideMode === 'VIDEO' || overrideMode === 'STORY';
    try {
      let stream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: overrideFacing, width: { ideal: 1080 }, height: { ideal: 1920 } },
          audio: needsAudioTrack,
        });
      } catch {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: overrideFacing, width: { ideal: 1080 }, height: { ideal: 1920 } },
          audio: false,
        });
      }
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
      const track = stream.getVideoTracks?.()[0];
      const caps = track?.getCapabilities?.();
      setTorchSupported(Boolean(caps?.torch));
      setCameraPermission('granted');
    } catch (err) {
      const name = err?.name || '';
      if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
        setCameraPermission('denied');
      } else {
        setCameraPermission('unavailable');
      }
    }
  }, [activeMode, facingMode, stopCameraStream]);

  // Cleanup camera, mic & blob URLs on unmount
  useEffect(() => {
    return () => {
      stopCameraStream();
      stopAudioStream();
      if (timerRef.current) clearInterval(timerRef.current);
      if (holdTimeoutRef.current) clearTimeout(holdTimeoutRef.current);
      if (previewUrlRef.current && previewUrlRef.current.startsWith('blob:')) {
        URL.revokeObjectURL(previewUrlRef.current);
      }
    };
  }, [stopCameraStream, stopAudioStream]);

  const handleFlipCamera = () => {
    const next = facingMode === 'user' ? 'environment' : 'user';
    setFacingMode(next);
    if (cameraPermission === 'granted') {
      requestCameraAccess(next);
    }
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
      toast.error('Enable camera access first or pick a video from Gallery.');
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
      recorder.onerror = () => {
        if (timerRef.current) clearInterval(timerRef.current);
        setIsRecording(false);
        toast.error('Video recording encountered an error.');
      };
      recorder.onstop = () => {
        if (timerRef.current) clearInterval(timerRef.current);
        const finalType = mime || 'video/webm';
        const blob = new Blob(chunksRef.current, { type: finalType });
        const secs = Math.max(1, Math.min(VIBE_LIMITS.VIDEO_MAX_DURATION_SEC, recordedSecondsRef.current || 1));
        if (blob.size > 0) {
          const file = new File([blob], `vibe-${Date.now()}.webm`, { type: finalType });
          const url = URL.createObjectURL(file);
          setMediaFile(file);
          setMediaType('video');
          setMediaDuration(secs);
          setNativeDuration(secs);
          setMediaEdits({ ...DEFAULT_MEDIA_EDITS, trimStart: 0, trimEnd: secs });
          setPreviewSafely(url);
          toast.success(`Video recorded (${secs}s)`);
        } else {
          toast.error('Recording produced no data. Try again.');
        }
      };

      recorder.start(250);
      setIsRecording(true);
      setRecordSeconds(0);
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = setInterval(() => {
        setRecordSeconds((sec) => {
          const next = sec + 1;
          recordedSecondsRef.current = next;
          if (next >= VIBE_LIMITS.VIDEO_MAX_DURATION_SEC) {
            if (recorderRef.current && recorderRef.current.state !== 'inactive') {
              recorderRef.current.stop();
            }
            setIsRecording(false);
            clearInterval(timerRef.current);
            return VIBE_LIMITS.VIDEO_MAX_DURATION_SEC;
          }
          return next;
        });
      }, 1000);
    } catch {
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
    } catch {
      toast.error('Could not stop recording cleanly.');
    }
  }, [isRecording]);

  const stopAudioRecording = useCallback(() => {
    if (!isRecording) return;
    setIsRecording(false);
    if (timerRef.current) clearInterval(timerRef.current);
    try {
      if (recorderRef.current && recorderRef.current.state !== 'inactive') {
        recorderRef.current.stop();
      } else {
        stopAudioStream();
      }
    } catch {
      stopAudioStream();
      toast.error('Could not stop audio recording cleanly.');
    }
  }, [isRecording, stopAudioStream]);

  const startAudioRecording = useCallback(async () => {
    if (capturedPreview || isRecording) return;
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setAudioPermission('unavailable');
      toast.error('Microphone recording is unavailable on this browser. Upload an audio clip instead.');
      return;
    }

    setAudioPermission('requesting');
    stopAudioStream();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioStreamRef.current = stream;
      setAudioPermission('granted');

      const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus', 'audio/ogg'];
      const mime = candidates.find((c) => MediaRecorder.isTypeSupported?.(c)) || '';
      const recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      recorderRef.current = recorder;
      chunksRef.current = [];
      recordedSecondsRef.current = 0;

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onerror = () => {
        if (timerRef.current) clearInterval(timerRef.current);
        stopAudioStream();
        setIsRecording(false);
        toast.error('Audio recording encountered an error.');
      };
      recorder.onstop = () => {
        if (timerRef.current) clearInterval(timerRef.current);
        stopAudioStream();
        const baseMime = (mime || recorder.mimeType || 'audio/webm').split(';')[0].trim();
        const ext = baseMime.includes('mp4') ? 'm4a' : baseMime.includes('ogg') ? 'ogg' : 'webm';
        const blob = new Blob(chunksRef.current, { type: baseMime });
        const secs = Math.max(1, Math.min(VIBE_LIMITS.AUDIO_MAX_DURATION_SEC, recordedSecondsRef.current || 1));
        if (blob.size > 0) {
          const file = new File([blob], `vibe-audio-${Date.now()}.${ext}`, { type: baseMime });
          const url = URL.createObjectURL(file);
          setMediaFile(file);
          setMediaType('audio');
          setNativeDuration(secs);
          setMediaDuration(secs);
          setMediaEdits(DEFAULT_MEDIA_EDITS);
          setPreviewSafely(url);
          toast.success(`Audio recorded (${secs}s)`);
        } else {
          toast.error('Audio recording produced no data. Try again.');
        }
      };

      recorder.start(250);
      setIsRecording(true);
      setRecordSeconds(0);
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = setInterval(() => {
        setRecordSeconds((sec) => {
          const next = sec + 1;
          recordedSecondsRef.current = next;
          if (next >= VIBE_LIMITS.AUDIO_MAX_DURATION_SEC) {
            if (recorderRef.current && recorderRef.current.state !== 'inactive') {
              recorderRef.current.stop();
            }
            setIsRecording(false);
            clearInterval(timerRef.current);
            return VIBE_LIMITS.AUDIO_MAX_DURATION_SEC;
          }
          return next;
        });
      }, 1000);
    } catch (err) {
      stopAudioStream();
      const name = err?.name || '';
      if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
        setAudioPermission('denied');
        toast.error('Microphone permission denied. Allow mic access or upload an audio file.');
      } else {
        setAudioPermission('unavailable');
        toast.error('Could not access microphone. Try uploading an audio file.');
      }
    }
  }, [capturedPreview, isRecording, setPreviewSafely, stopAudioStream]);

  const handleCapturePhoto = useCallback(() => {
    if (!cameraActive || !videoRef.current) {
      requestCameraAccess();
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
        setMediaEdits(DEFAULT_MEDIA_EDITS);
        setPreviewSafely(url);
        toast.success('Photo captured');
      },
      'image/jpeg',
      0.92
    );
  }, [cameraActive, requestCameraAccess, setPreviewSafely]);

  const handleSelectCaptureMode = useCallback((mode) => {
    if (isRecording) {
      if (activeMode === 'AUDIO') stopAudioRecording();
      else stopVideoRecording();
    }
    setActiveMode(mode);
    if (mode === 'TEXT' || mode === 'AUDIO' || mode === 'EVENT') {
      stopCameraStream();
      setCameraPermission('idle');
    } else if ((mode === 'VIDEO' || mode === 'STORY') && cameraActive) {
      const hasAudio = Boolean(videoRef.current?.srcObject?.getAudioTracks?.().length);
      if (!hasAudio) {
        requestCameraAccess(facingMode, mode);
      }
    }
  }, [activeMode, cameraActive, facingMode, isRecording, requestCameraAccess, stopAudioRecording, stopCameraStream, stopVideoRecording]);

  const handleShutterClick = () => {
    if (holdActiveRef.current) {
      holdActiveRef.current = false;
      return;
    }
    if (activeMode === 'EVENT') {
      if (capturedPreview) {
        clearPreview();
      } else {
        fileInputRef.current?.click();
      }
      return;
    }
    if (activeMode === 'AUDIO') {
      if (capturedPreview) {
        clearPreview();
      } else if (isRecording) {
        stopAudioRecording();
      } else {
        startAudioRecording();
      }
      return;
    }
    if (capturedPreview) {
      clearPreview();
      return;
    }
    if (!cameraActive) {
      requestCameraAccess();
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
    if (activeMode !== 'STORY' || capturedPreview || !cameraActive) return;
    if (holdTimeoutRef.current) clearTimeout(holdTimeoutRef.current);
    holdActiveRef.current = false;
    holdTimeoutRef.current = setTimeout(() => {
      holdTimeoutRef.current = null;
      holdActiveRef.current = true;
      startVideoRecording();
    }, 280);
  };

  const handleShutterHoldEnd = () => {
    if (holdTimeoutRef.current) {
      clearTimeout(holdTimeoutRef.current);
      holdTimeoutRef.current = null;
      return;
    }
    if (isRecording && activeMode === 'STORY') {
      stopVideoRecording();
    }
  };

  const handleFilePicked = async (e) => {
    const rawFile = e.target.files?.[0];
    if (!rawFile) return;
    e.target.value = '';

    const inferred = inferVibeMediaKindAndMime(rawFile, activeMode === 'AUDIO' ? 'audio' : null);
    const file = (!rawFile.type && inferred.mime)
      ? new File([rawFile], rawFile.name, { type: inferred.mime, lastModified: rawFile.lastModified || Date.now() })
      : rawFile;

    const preCheck = validateVibeMedia(file, {
      expectedKind: activeMode === 'AUDIO' ? 'audio' : activeMode === 'EVENT' ? 'image' : null,
    });
    if (!preCheck.valid) {
      toast.error(preCheck.error);
      return;
    }

    const url = URL.createObjectURL(file);
    if (activeMode === 'EVENT') {
      if (preCheck.kind !== 'image') {
        URL.revokeObjectURL(url);
        toast.error('Select an image as your Event Vibe cover.');
        return;
      }
      setMediaFile(file);
      setMediaType('image');
      setMediaDuration(VIBE_LIMITS.EVENT_DEFAULT_DURATION_SEC);
      setMediaEdits(DEFAULT_MEDIA_EDITS);
      setPreviewSafely(url);
      toast.success('Event cover image attached');
      return;
    }

    if (preCheck.kind === 'audio') {
      const dur = await probeMediaDuration(url, 'audio');
      const clampedAudioDur = Math.min(VIBE_LIMITS.AUDIO_MAX_DURATION_SEC, Math.max(1, Math.round(dur)));
      setMediaFile(file);
      setMediaType('audio');
      setNativeDuration(dur);
      setMediaDuration(clampedAudioDur);
      setActiveMode('AUDIO');
      setMediaEdits(DEFAULT_MEDIA_EDITS);
      setPreviewSafely(url);
      return;
    }

    if (preCheck.kind === 'video') {
      const rawDur = await probeMediaDuration(url, 'video');
      const clampedDur = Math.min(VIBE_LIMITS.VIDEO_MAX_DURATION_SEC, Math.max(1, Math.round(rawDur)));
      setMediaFile(file);
      setMediaType('video');
      setNativeDuration(rawDur);
      setMediaDuration(clampedDur);
      setMediaEdits({ ...DEFAULT_MEDIA_EDITS, trimStart: 0, trimEnd: clampedDur });
      setPreviewSafely(url);
      if (rawDur > VIBE_LIMITS.VIDEO_MAX_DURATION_SEC) {
        toast.info(`Video trimmed to first ${VIBE_LIMITS.VIDEO_MAX_DURATION_SEC}s. Adjust inside Crop & Edit.`);
        setActiveTool('adjust');
      }
    } else {
      setMediaFile(file);
      setMediaType('image');
      setMediaDuration(5);
      setMediaEdits(DEFAULT_MEDIA_EDITS);
      setPreviewSafely(url);
    }
  };

  const handleCaptureVideoCover = () => {
    const vid = previewVideoRef.current;
    if (!vid || !vid.videoWidth || !vid.videoHeight) {
      toast.error('Wait for the video frame to load first.');
      return;
    }
    const canvas = document.createElement('canvas');
    canvas.width = Math.min(360, vid.videoWidth);
    canvas.height = Math.round((vid.videoHeight / vid.videoWidth) * canvas.width);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(vid, 0, 0, canvas.width, canvas.height);
    const coverDataUrl = canvas.toDataURL('image/jpeg', 0.72);
    setMediaEdits((prev) => ({ ...prev, coverUrl: coverDataUrl }));
    toast.success('Cover frame saved');
  };

  // Non-destructive drawing stack handlers
  const handleDrawingChange = useCallback((nextPaths) => {
    setUndoStack((prev) => [...prev.slice(-19), drawingPaths]);
    setRedoStack([]);
    setDrawingPaths(nextPaths);
  }, [drawingPaths]);

  const handleUndoDrawing = () => {
    if (undoStack.length === 0) return;
    const previous = undoStack[undoStack.length - 1];
    setUndoStack((prev) => prev.slice(0, -1));
    setRedoStack((prev) => [...prev, drawingPaths]);
    setDrawingPaths(previous);
  };

  const handleRedoDrawing = () => {
    if (redoStack.length === 0) return;
    const next = redoStack[redoStack.length - 1];
    setRedoStack((prev) => prev.slice(0, -1));
    setUndoStack((prev) => [...prev, drawingPaths]);
    setDrawingPaths(next);
  };

  const handleClearDrawing = () => {
    if (drawingPaths.length === 0) return;
    handleDrawingChange([]);
  };

  // Multi-element text overlay handlers
  const handleAddOverlay = (text) => {
    const id = `ov_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const next = [
      ...textOverlays.slice(0, VIBE_LIMITS.MAX_TEXT_OVERLAYS - 1),
      {
        id,
        text,
        x: 0.5,
        y: 0.35 + (textOverlays.length % 3) * 0.12,
        color: '#FFFFFF',
        bgStyle: 'pill',
        font: 'display',
        align: 'center',
        scale: 1,
        rotation: 0,
      },
    ];
    setTextOverlays(next);
    setSelectedOverlayId(id);
  };

  const handleUpdateOverlay = (id, patch) => {
    setTextOverlays((prev) => prev.map((ov) => (ov.id === id ? { ...ov, ...patch } : ov)));
  };

  const handleMoveOverlay = useCallback((id, x, y) => {
    setTextOverlays((prev) => prev.map((ov) => (ov.id === id ? { ...ov, x, y } : ov)));
  }, []);

  const handleDeleteOverlay = (id) => {
    setTextOverlays((prev) => prev.filter((ov) => ov.id !== id));
    if (selectedOverlayId === id) setSelectedOverlayId(null);
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
  const isEventMode = activeMode === 'EVENT';
  const isAudioMode = activeMode === 'AUDIO';
  const canPublish = isTextMode
    ? storyText.trim().length > 0
    : isEventMode
      ? eventTitle.trim().length > 0
      : Boolean(mediaFile);

  const normalizedEventDraft = useMemo(() => ({
    title: eventTitle.trim(),
    startsAt: eventStartsAt.trim() || null,
    location: eventLocation.trim() || null,
    ctaText: eventCtaText.trim() || 'RSVP / Details',
    ctaUrl: eventCtaUrl.trim() || null,
    description: eventDescription.trim() || null,
  }), [eventTitle, eventStartsAt, eventLocation, eventCtaText, eventCtaUrl, eventDescription]);

  const previewVibeObject = useMemo(() => ({
    id: 'studio_preview',
    type: isTextMode ? 'text' : isEventMode ? 'event' : mediaType,
    url: isTextMode ? '' : (capturedPreview || ''),
    caption: isEventMode ? eventTitle.trim() : storyText.trim(),
    content: isEventMode ? eventTitle.trim() : storyText.trim(),
    duration: isTextMode ? 6 : isEventMode ? VIBE_LIMITS.EVENT_DEFAULT_DURATION_SEC : mediaDuration,
    backgroundColor: backgroundGradient,
    textColor,
    textStyle: {
      font: textFont,
      align: textAlign,
      background: backgroundGradient,
      textColor,
    },
    mediaEdits,
    textOverlays: sanitizeTextOverlays(textOverlays),
    drawingPaths: sanitizeDrawingPaths(drawingPaths),
    music: selectedMusic,
    eventData: isEventMode ? normalizedEventDraft : null,
    ctaText: isEventMode ? normalizedEventDraft.ctaText : '',
    ctaUrl: isEventMode ? normalizedEventDraft.ctaUrl : '',
  }), [
    isTextMode,
    isEventMode,
    eventTitle,
    normalizedEventDraft,
    mediaType,
    capturedPreview,
    storyText,
    mediaDuration,
    backgroundGradient,
    textColor,
    textFont,
    textAlign,
    mediaEdits,
    textOverlays,
    drawingPaths,
    selectedMusic,
  ]);

  // Save draft to IndexedDB (never stores large Blobs in Firestore)
  const handleSaveDraft = async ({ silent = false } = {}) => {
    if (!user?.uid) {
      if (!silent) toast.error('Sign in to save drafts.');
      return null;
    }
    if (!canPublish && textOverlays.length === 0 && drawingPaths.length === 0) {
      if (!silent) toast.error('Add media, event details, or text before saving a draft.');
      return null;
    }
    try {
      const targetDraftType = isTextMode ? 'text' : isEventMode ? 'event' : mediaType;
      const saved = await vibeDraftService.saveDraft(user.uid, {
        id: activeDraftId || undefined,
        idempotencyKey,
        type: targetDraftType,
        content: isEventMode ? eventTitle : storyText,
        mediaBlob: isTextMode ? null : mediaFile,
        mediaName: mediaFile?.name || null,
        mediaType: mediaFile?.type || null,
        duration: isTextMode ? 6 : isEventMode ? VIBE_LIMITS.EVENT_DEFAULT_DURATION_SEC : mediaDuration,
        nativeDuration,
        backgroundColor: backgroundGradient,
        textColor,
        textStyle: { font: textFont, align: textAlign, background: backgroundGradient, textColor },
        mediaEdits,
        textOverlays,
        drawingPaths,
        visibility: audience,
        selectedUsers,
        location: isEventMode ? eventLocation : storyLocation,
        linkUrl: isEventMode ? eventCtaUrl : linkUrl,
        ctaText: isEventMode ? normalizedEventDraft.ctaText : '',
        ctaUrl: isEventMode ? (normalizedEventDraft.ctaUrl || '') : '',
        eventData: isEventMode ? normalizedEventDraft : null,
        music: selectedMusic || null,
        pollQuestion,
        pollOption1,
        pollOption2,
        questionPrompt,
        mentionHandle,
        selectedGif: selectedGif || null,
        storyTimer: Number(storyTimer) || 0,
      });
      setActiveDraftId(saved.id);
      setIdempotencyKey(saved.idempotencyKey);
      await loadDraftsList();
      if (!silent) toast.success('Draft saved on this device');
      return saved;
    } catch (err) {
      if (!silent) toast.error(err?.message || 'Could not save draft locally.');
      return null;
    }
  };

  const handleResumeDraft = async (draft) => {
    if (!draft) return;
    setActiveDraftId(draft.id);
    setIdempotencyKey(draft.idempotencyKey || createVibeIdempotencyKey(user?.uid));
    setStoryText(draft.content || '');
    setBackgroundGradient(draft.backgroundColor || VIBE_TEXT_BACKGROUNDS[0].background);
    setTextColor(draft.textColor || '#FFFFFF');
    setTextFont(draft.textStyle?.font || 'display');
    setTextAlign(draft.textStyle?.align || 'center');
    setMediaEdits(draft.mediaEdits || DEFAULT_MEDIA_EDITS);
    setTextOverlays(Array.isArray(draft.textOverlays) ? draft.textOverlays : []);
    setDrawingPaths(Array.isArray(draft.drawingPaths) ? draft.drawingPaths : []);
    setAudience(draft.visibility || 'public');
    setSelectedUsers(Array.isArray(draft.selectedUsers) ? draft.selectedUsers : []);
    setStoryLocation(draft.location || '');
    setLinkUrl(draft.linkUrl || '');
    setSelectedMusic(draft.music || null);
    setPollQuestion(draft.pollQuestion || '');
    setPollOption1(draft.pollOption1 || '');
    setPollOption2(draft.pollOption2 || '');
    setQuestionPrompt(draft.questionPrompt || '');
    setMentionHandle(draft.mentionHandle || '');
    setSelectedGif(draft.selectedGif || null);
    setStoryTimer(Number(draft.storyTimer) || 0);

    if (draft.type === 'event') {
      const ev = draft.eventData || {};
      setEventTitle(ev.title || draft.content || '');
      setEventStartsAt(ev.startsAt || '');
      setEventLocation(ev.location || draft.location || '');
      setEventCtaText(ev.ctaText || draft.ctaText || 'RSVP / Details');
      setEventCtaUrl(ev.ctaUrl || draft.ctaUrl || draft.linkUrl || '');
      setEventDescription(ev.description || '');
      if (draft.mediaBlob) {
        const restoredCover = draft.mediaBlob instanceof File
          ? draft.mediaBlob
          : new File([draft.mediaBlob], draft.mediaName || `event-cover-${Date.now()}.jpg`, { type: draft.mediaType || 'image/jpeg' });
        const url = URL.createObjectURL(restoredCover);
        setMediaFile(restoredCover);
        setMediaType('image');
        setPreviewSafely(url);
      } else {
        clearPreview();
      }
      setActiveMode('EVENT');
    } else if (draft.type === 'text' || !draft.mediaBlob) {
      clearPreview();
      setActiveMode('TEXT');
    } else {
      const restoredFile = draft.mediaBlob instanceof File
        ? draft.mediaBlob
        : new File([draft.mediaBlob], draft.mediaName || `draft-${Date.now()}`, { type: draft.mediaType || 'image/jpeg' });
      const url = URL.createObjectURL(restoredFile);
      setMediaFile(restoredFile);
      setMediaType(draft.type || 'image');
      setMediaDuration(draft.duration || 5);
      setNativeDuration(draft.nativeDuration || draft.duration || 15);
      setActiveMode(draft.type === 'video' ? 'VIDEO' : draft.type === 'audio' ? 'AUDIO' : 'STORY');
      setPreviewSafely(url);
    }
    setDraftsDrawerOpen(false);
    toast.success('Draft restored');
  };

  const handleDeleteDraft = async (draftId) => {
    if (!user?.uid) return;
    await vibeDraftService.deleteDraft(user.uid, draftId);
    if (activeDraftId === draftId) setActiveDraftId(null);
    await loadDraftsList();
    toast.success('Draft deleted');
  };

  const handlePublishStory = async () => {
    if (!user?.uid || uploadState === VIBE_UPLOAD_STATES.UPLOADING || uploadState === VIBE_UPLOAD_STATES.PUBLISHING) {
      if (!user?.uid) toast.error('Please sign in to publish a Vibe.');
      return;
    }

    let validatedEvent = null;
    if (isTextMode) {
      const textValidation = validateVibeText(storyText);
      if (!textValidation.valid) {
        toast.error(textValidation.error);
        return;
      }
    } else if (isEventMode) {
      const eventValidation = validateVibeEvent({
        title: eventTitle,
        startsAt: eventStartsAt,
        location: eventLocation,
        ctaText: eventCtaText,
        ctaUrl: eventCtaUrl,
        description: eventDescription,
      });
      if (!eventValidation.valid) {
        toast.error(eventValidation.error);
        return;
      }
      validatedEvent = eventValidation.eventData;
      if (mediaFile) {
        const coverValidation = validateVibeMedia(mediaFile, { expectedKind: 'image' });
        if (!coverValidation.valid) {
          toast.error(coverValidation.error);
          return;
        }
      }
    } else {
      if (!mediaFile) {
        toast.error('Capture or select a photo, video, or audio clip.');
        return;
      }
      const mediaValidation = validateVibeMedia(mediaFile, {
        durationSec: mediaDuration,
        expectedKind: mediaType === 'audio' ? 'audio' : null,
      });
      if (!mediaValidation.valid) {
        toast.error(mediaValidation.error);
        return;
      }
    }

    const selectedUserIds = selectedUsers.map((u) => u.id);
    const audienceCheck = validateAudienceSelection(audience, selectedUserIds);
    if (!audienceCheck.valid) {
      toast.error(audienceCheck.error);
      setAudienceModalOpen(true);
      return;
    }

    const vibeSafety = evaluateContentSafety({
      text: isEventMode ? `${eventTitle}\n${eventDescription}` : storyText,
      extraFields: [
        ...(Array.isArray(textOverlays) ? textOverlays.map((ov) => ov?.text || '') : []),
        pollQuestion,
        pollOption1,
        pollOption2,
        questionPrompt,
        storyLocation,
        linkUrl,
        mentionHandle,
        eventLocation,
        eventCtaText,
        eventCtaUrl,
        mediaFile?.name || '',
      ],
    });
    if (!vibeSafety.allowed) {
      toast.error(vibeSafety.reason);
      return;
    }

    setPreviewOpen(false);
    setUploadError(null);
    setUploadProgress(6);
    setUploadState(VIBE_UPLOAD_STATES.PREPARING);

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    try {
      const storyService = getStoryService();
      const targetType = isTextMode ? 'text' : isEventMode ? 'event' : mediaType;
      const cleanPoll = pollQuestion.trim() && pollOption1.trim() && pollOption2.trim()
        ? { question: pollQuestion.trim(), options: [pollOption1.trim(), pollOption2.trim()] }
        : null;

      let uploadFile = isTextMode ? null : mediaFile;
      let normalizedEdits = { ...mediaEdits };
      if ((targetType === 'image' || (targetType === 'event' && uploadFile)) && capturedPreview) {
        uploadFile = await bakeEditedImageFile(uploadFile, capturedPreview, mediaEdits);
        normalizedEdits = {
          ...mediaEdits,
          rotation: 0,
          brightness: 100,
          contrast: 100,
          aspectRatio: 'original',
        };
      }

      const clippedDuration = targetType === 'video'
        ? Math.max(1, Math.min(VIBE_LIMITS.VIDEO_MAX_DURATION_SEC, Math.round((mediaEdits.trimEnd ?? mediaDuration) - (mediaEdits.trimStart ?? 0))))
        : isTextMode
          ? 6
          : isEventMode
            ? VIBE_LIMITS.EVENT_DEFAULT_DURATION_SEC
            : mediaDuration;

      const storyPayload = {
        type: targetType,
        content: isEventMode ? (validatedEvent?.title || '') : storyText.trim(),
        mediaFile: uploadFile,
        duration: clippedDuration,
        backgroundColor: backgroundGradient || '#0c0f24',
        textColor,
        textStyle: { font: textFont, align: textAlign, background: backgroundGradient, textColor },
        mediaEdits: normalizedEdits,
        textOverlays: sanitizeTextOverlays(textOverlays),
        drawingPaths: sanitizeDrawingPaths(drawingPaths),
        poll: cleanPoll,
        music: selectedMusic || null,
        linkUrl: (isEventMode ? validatedEvent?.ctaUrl : linkUrl.trim()) || null,
        location: (isEventMode ? (validatedEvent?.location || storyLocation.trim()) : storyLocation.trim()) || null,
        taggedUsers: mentionHandle.trim() ? [mentionHandle.trim().replace(/^@/, '')] : [],
        stickers: buildStickers(),
        visibility: audience,
        selectedUserIds: audienceCheck.selectedUserIds,
        idempotencyKey,
        ...(isEventMode && validatedEvent
          ? {
              eventData: validatedEvent,
              ctaText: validatedEvent.ctaText,
              ctaUrl: validatedEvent.ctaUrl,
            }
          : {}),
      };

      const publishOptions = {
        idempotencyKey,
        abortSignal: abortController.signal,
        onUploadHandle: (handle) => {
          activeUploadHandleRef.current = handle;
        },
        onProgress: (pct) => {
          if (typeof pct === 'number') setUploadProgress(pct);
        },
        onStateChange: (nextState, extra = {}) => {
          if (typeof nextState === 'string') {
            setUploadState(nextState);
            if (typeof extra?.progress === 'number') setUploadProgress(extra.progress);
          } else if (nextState && typeof nextState === 'object') {
            if (nextState.state) setUploadState(nextState.state);
            if (typeof nextState.progress === 'number') setUploadProgress(nextState.progress);
          }
        },
      };

      const res = await storyService.createStory(storyPayload, publishOptions);
      if (res?.success) {
        if (activeDraftId) {
          await vibeDraftService.deleteDraft(user.uid, activeDraftId).catch(() => {});
        }
        toast.success('Vibe published!');
        setUploadState(VIBE_UPLOAD_STATES.IDLE);
        navigate('/stories');
      } else if (res?.queued) {
        toast.info('Offline — saved as draft. Will publish when you are back online.');
        setUploadState(VIBE_UPLOAD_STATES.IDLE);
        navigate('/stories');
      } else {
        setUploadState(VIBE_UPLOAD_STATES.FAILED);
        setUploadError(res?.error || 'Failed to publish Vibe');
      }
    } catch (err) {
      if (err?.code === 'storage/canceled' || err?.name === 'AbortError') {
        setUploadState(VIBE_UPLOAD_STATES.CANCELLED);
        setUploadError('Upload cancelled before publishing.');
      } else {
        setUploadState(VIBE_UPLOAD_STATES.FAILED);
        setUploadError(err?.message || 'Vibe publication failed');
      }
    } finally {
      activeUploadHandleRef.current = null;
      abortControllerRef.current = null;
    }
  };

  const handleCancelUpload = async () => {
    abortControllerRef.current?.abort();
    await getStoryService().cancelUpload(activeUploadHandleRef.current);
    setUploadState(VIBE_UPLOAD_STATES.CANCELLED);
    setUploadError('Upload cancelled before publishing.');
  };

  const liveVideoZoomStyle = {
    transform: zoomLevel === '0.5' ? 'scale(0.88)' : zoomLevel === '2' ? 'scale(1.25)' : 'scale(1)',
    transition: 'transform 200ms ease-out',
  };

  const isBrushActive = activeTool === 'freehand';
  const isEditingOverlays = activeTool === 'overlays' || textOverlays.length > 0;
  const audienceMeta = getAudienceMeta(audience);

  return (
    <div className={cn(
      'min-h-screen select-none relative overflow-x-hidden transition-colors duration-300',
      isDark ? 'bg-[#03071B] text-white' : 'bg-[#F6F8FC] text-slate-900'
    )}>
      <div className="max-w-7xl mx-auto min-h-screen flex flex-col lg:flex-row items-center justify-between p-3 sm:p-4 lg:p-8 gap-5 lg:gap-8 relative z-10">

        {/* Left Column: Studio Header & Creative Tools (Desktop) */}
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
                <p className={cn('text-xs font-semibold', isDark ? 'text-white/60' : 'text-slate-600')}>
                  Capture, edit &amp; publish
                </p>
              </div>
            </div>

            {savedDrafts.length > 0 && (
              <button
                type="button"
                onClick={() => setDraftsDrawerOpen(true)}
                className={cn(
                  'mt-4 w-full min-h-[40px] px-3.5 py-2 rounded-2xl border flex items-center justify-between text-xs font-bold cursor-pointer',
                  isDark ? 'bg-white/5 border-white/15 text-white hover:bg-white/10' : 'bg-white border-slate-200 text-slate-800 hover:bg-slate-50 shadow-sm'
                )}
              >
                <span className="inline-flex items-center gap-2">
                  <FolderOpen className="w-4 h-4 text-indigo-400" aria-hidden="true" />
                  <span>Saved Drafts ({savedDrafts.length})</span>
                </span>
                <ChevronRight className="w-4 h-4 opacity-60" aria-hidden="true" />
              </button>
            )}

            {toolsExpanded && (
              <div className="mt-6">
                <span className={cn('text-[11px] font-bold uppercase tracking-widest block mb-2.5', isDark ? 'text-white/50' : 'text-slate-500')}>
                  Studio Tools
                </span>
                <div className={cn(
                  'border rounded-3xl p-2 space-y-1 backdrop-blur-xl shadow-xl max-h-[460px] overflow-y-auto',
                  isDark ? 'bg-white/[0.04] border-white/10' : 'bg-white border-slate-200'
                )}>
                  {CREATIVE_TOOLS.filter((tool) => tool.id !== 'music' || musicLibraryEnabled).map((tool) => {
                    const Icon = tool.icon;
                    const isSelected = activeTool === tool.id;
                    const disabledAdjust = tool.id === 'adjust' && (!capturedPreview || isTextMode || mediaType === 'audio');
                    return (
                      <button
                        type="button"
                        key={tool.id}
                        disabled={disabledAdjust}
                        onClick={() => {
                          setActiveTool(isSelected ? null : tool.id);
                          if (tool.id === 'music' && !isSelected && musicTracks.length === 0) loadMusicTracks();
                        }}
                        className={cn(
                          'w-full min-h-[40px] flex items-center gap-3 px-3.5 py-2 rounded-2xl text-xs font-semibold transition-all duration-150 cursor-pointer disabled:opacity-35',
                          isSelected
                            ? 'text-white shadow-md'
                            : isDark
                              ? 'text-white/80 hover:bg-white/10 hover:text-white'
                              : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
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
            className={cn(
              'w-full min-h-[44px] rounded-2xl border text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer',
              isDark
                ? 'border-white/15 bg-white/5 hover:bg-white/10 text-white/80'
                : 'border-slate-300 bg-white hover:bg-slate-100 text-slate-800 shadow-sm'
            )}
          >
            <span>Browse Vibes Feed</span>
            <ChevronRight className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        {/* Center: Studio Canvas */}
        <div className="relative w-full max-w-[430px] h-[calc(100vh-1.5rem)] max-h-[840px] min-h-[580px] rounded-3xl bg-[#060918] border border-white/15 shadow-2xl overflow-hidden flex flex-col justify-between text-white">

          {/* Media / Canvas Stage */}
          <div
            className="absolute inset-0 z-0 bg-[#0c0f24]"
            style={isTextMode || isEventMode || mediaType === 'audio' ? { background: backgroundGradient } : undefined}
          >
            {isEventMode ? (
              <div className="relative w-full h-full flex flex-col justify-center px-5 py-20 overflow-y-auto">
                {capturedPreview && (
                  <>
                    <LazyImage
                      src={capturedPreview}
                      alt="Event cover"
                      className="absolute inset-0 w-full h-full object-cover opacity-50 pointer-events-none"
                    />
                    <div className="absolute inset-0 bg-gradient-to-b from-black/65 via-black/50 to-black/80 pointer-events-none" />
                  </>
                )}
                <div className="relative z-10 w-full rounded-3xl bg-black/55 backdrop-blur-2xl border border-white/20 p-4 space-y-2.5 shadow-2xl">
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-white/85">
                      <Calendar className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>Event Vibe</span>
                    </span>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="px-2.5 py-1 rounded-lg bg-white/15 hover:bg-white/25 text-[11px] font-semibold text-white cursor-pointer"
                      >
                        {capturedPreview ? 'Change Cover' : 'Add Cover'}
                      </button>
                      {capturedPreview && (
                        <button
                          type="button"
                          onClick={clearPreview}
                          className="px-2 py-1 rounded-lg bg-rose-500/30 hover:bg-rose-500/45 text-[11px] font-semibold text-white cursor-pointer"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  </div>
                  <input
                    aria-label="Event title"
                    type="text"
                    maxLength={120}
                    value={eventTitle}
                    onChange={(e) => setEventTitle(e.target.value)}
                    placeholder="Event title (required)"
                    className="w-full px-3 py-2 rounded-xl bg-white/10 border border-white/20 text-sm font-bold text-white placeholder:text-white/55 outline-none focus:border-white/50"
                  />
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <input
                      aria-label="Event date and time"
                      type="text"
                      maxLength={64}
                      value={eventStartsAt}
                      onChange={(e) => setEventStartsAt(e.target.value)}
                      placeholder="Date & time (e.g. Fri 8 PM)"
                      className="w-full px-3 py-2 rounded-xl bg-white/10 border border-white/15 text-xs text-white placeholder:text-white/55 outline-none focus:border-white/40"
                    />
                    <input
                      aria-label="Event location"
                      type="text"
                      maxLength={140}
                      value={eventLocation}
                      onChange={(e) => setEventLocation(e.target.value)}
                      placeholder="Venue or City"
                      className="w-full px-3 py-2 rounded-xl bg-white/10 border border-white/15 text-xs text-white placeholder:text-white/55 outline-none focus:border-white/40"
                    />
                  </div>
                  <textarea
                    aria-label="Event details"
                    rows={2}
                    maxLength={300}
                    value={eventDescription}
                    onChange={(e) => setEventDescription(e.target.value)}
                    placeholder="What should attendees expect?"
                    className="w-full px-3 py-2 rounded-xl bg-white/10 border border-white/15 text-xs text-white placeholder:text-white/55 outline-none focus:border-white/40 resize-none"
                  />
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <input
                      aria-label="Event button label"
                      type="text"
                      maxLength={40}
                      value={eventCtaText}
                      onChange={(e) => setEventCtaText(e.target.value)}
                      placeholder="Button label (e.g. RSVP)"
                      className="w-full px-3 py-2 rounded-xl bg-white/10 border border-white/15 text-xs text-white placeholder:text-white/55 outline-none focus:border-white/40"
                    />
                    <input
                      aria-label="Event link URL"
                      type="url"
                      maxLength={500}
                      value={eventCtaUrl}
                      onChange={(e) => setEventCtaUrl(e.target.value)}
                      placeholder="https://… (optional)"
                      className="w-full px-3 py-2 rounded-xl bg-white/10 border border-white/15 text-xs text-white placeholder:text-white/55 outline-none focus:border-white/40"
                    />
                  </div>
                </div>
              </div>
            ) : capturedPreview ? (
              mediaType === 'video' ? (
                <video
                  ref={previewVideoRef}
                  src={capturedPreview}
                  controls
                  autoPlay
                  loop
                  muted={Boolean(mediaEdits.muted)}
                  playsInline
                  onLoadedMetadata={(e) => {
                    const vid = e.currentTarget;
                    const tStart = Math.max(0, Number(mediaEdits.trimStart || 0));
                    if (tStart > 0 && vid.currentTime < tStart) {
                      try { vid.currentTime = tStart; } catch { /* noop */ }
                    }
                  }}
                  onTimeUpdate={(e) => {
                    const vid = e.currentTarget;
                    const tStart = Math.max(0, Number(mediaEdits.trimStart || 0));
                    const tEnd = Number(mediaEdits.trimEnd || 0);
                    if (tEnd > tStart && vid.currentTime >= tEnd) {
                      vid.currentTime = tStart;
                    }
                  }}
                  className={cn('w-full h-full', mediaEdits.fitMode === 'cover' ? 'object-cover' : 'object-contain')}
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
                <div className="w-full h-full flex items-center justify-center overflow-hidden">
                  <LazyImage
                    src={capturedPreview}
                    alt="Vibe capture preview"
                    style={{
                      filter: `brightness(${mediaEdits.brightness ?? 100}%) contrast(${mediaEdits.contrast ?? 100}%)`,
                      transform: mediaEdits.rotation ? `rotate(${mediaEdits.rotation}deg)` : undefined,
                    }}
                    className={cn(
                      mediaEdits.aspectRatio === '9:16'
                        ? 'aspect-[9/16] w-full'
                        : mediaEdits.aspectRatio === '4:5'
                          ? 'aspect-[4/5] w-full'
                          : mediaEdits.aspectRatio === '1:1'
                            ? 'aspect-square w-full'
                            : 'w-full h-full',
                      mediaEdits.fitMode === 'cover' ? 'object-cover' : 'object-contain'
                    )}
                  />
                </div>
              )
            ) : isTextMode ? (
              <div className="w-full h-full flex flex-col items-center justify-center px-8">
                <textarea
                  aria-label="Text Vibe content"
                  value={storyText}
                  onChange={(e) => setStoryText(e.target.value)}
                  placeholder="Write your Vibe..."
                  rows={5}
                  maxLength={VIBE_LIMITS.TEXT_MAX_LENGTH}
                  style={{
                    color: textColor,
                    fontFamily: getVibeFontCss(textFont),
                    textAlign,
                  }}
                  className="w-full bg-transparent text-2xl sm:text-3xl font-extrabold placeholder:text-white/50 outline-none resize-none leading-snug"
                />
                <span className="text-[11px] font-medium text-white/70 mt-2">
                  {storyText.length} / {VIBE_LIMITS.TEXT_MAX_LENGTH}
                </span>
              </div>
            ) : isAudioMode ? (
              <div className="w-full h-full flex flex-col items-center justify-center px-6 text-center bg-[#0c0f24] gap-3.5">
                <div className={cn(
                  'w-16 h-16 rounded-2xl bg-white/10 border border-white/15 flex items-center justify-center',
                  isRecording && 'ring-2 ring-rose-500 bg-rose-500/20 animate-pulse'
                )}>
                  <Mic className="w-7 h-7 text-white" aria-hidden="true" />
                </div>
                <div className="space-y-1 max-w-xs">
                  <p className="text-white font-bold text-sm">
                    {isRecording
                      ? `Recording Audio (${recordSeconds}s / ${VIBE_LIMITS.AUDIO_MAX_DURATION_SEC}s)`
                      : audioPermission === 'denied'
                        ? 'Microphone permission blocked'
                        : audioPermission === 'unavailable'
                          ? 'Microphone unavailable on this browser'
                          : 'Record or Upload Audio'}
                  </p>
                  <p className="text-white/65 text-xs leading-relaxed">
                    {audioPermission === 'denied'
                      ? 'Allow microphone access in browser settings, or upload an MP3, M4A, WAV, or OGG clip.'
                      : 'Capture a voice note up to 60 seconds or choose an audio file from your device.'}
                  </p>
                </div>
                <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={isRecording ? stopAudioRecording : startAudioRecording}
                    disabled={audioPermission === 'requesting'}
                    className="min-h-[44px] px-4 py-2 rounded-xl text-xs font-bold text-white inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    style={{ background: isRecording ? '#E11D48' : BRAND_GRADIENT }}
                  >
                    <Mic className="w-4 h-4" aria-hidden="true" />
                    <span>{isRecording ? 'Stop Recording' : audioPermission === 'requesting' ? 'Requesting…' : 'Record Audio'}</span>
                  </button>
                  {!isRecording && (
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="min-h-[44px] px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 text-xs font-bold text-white cursor-pointer"
                    >
                      Upload Audio
                    </button>
                  )}
                </div>
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
              <div className="w-full h-full flex flex-col items-center justify-center px-6 text-center bg-[#0c0f24] gap-3.5">
                <div className="w-14 h-14 rounded-2xl bg-white/10 border border-white/15 flex items-center justify-center">
                  <ImageIcon className="w-7 h-7 text-white/75" aria-hidden="true" />
                </div>
                <div className="space-y-1 max-w-xs">
                  <p className="text-white font-bold text-sm">
                    {cameraPermission === 'denied'
                      ? 'Camera permission blocked'
                      : cameraPermission === 'unavailable'
                        ? 'Camera unavailable on this browser'
                        : 'Create a Vibe'}
                  </p>
                  <p className="text-white/65 text-xs leading-relaxed">
                    {cameraPermission === 'denied'
                      ? 'Allow camera access in browser settings, or pick a photo/video from Gallery.'
                      : 'Choose media from your device, enable your camera, or compose a Text Vibe.'}
                  </p>
                </div>
                <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="min-h-[44px] px-4 py-2 rounded-xl text-xs font-bold text-white cursor-pointer"
                    style={{ background: BRAND_GRADIENT }}
                  >
                    Choose Media
                  </button>
                  <button
                    type="button"
                    onClick={() => requestCameraAccess()}
                    disabled={cameraPermission === 'requesting'}
                    className="min-h-[44px] px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 text-xs font-bold text-white inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <Camera className="w-4 h-4" aria-hidden="true" />
                    <span>{cameraPermission === 'requesting' ? 'Requesting…' : 'Enable Camera'}</span>
                  </button>
                </div>
              </div>
            )}

            <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-transparent to-black/80 pointer-events-none" />

            {/* Interactive Non-Destructive Drawing Stage */}
            <VibeDrawingStage
              active={isBrushActive}
              paths={drawingPaths}
              brushColor={brushColor}
              brushSize={brushSize}
              brushMode={brushMode}
              onPathsChange={handleDrawingChange}
            />

            {/* Draggable Repositionable Multi-Text Overlays */}
            <VibeDraggableOverlaysStage
              overlays={textOverlays}
              selectedId={selectedOverlayId}
              editable={isEditingOverlays && !isBrushActive}
              onSelect={(id) => {
                setSelectedOverlayId(id);
                setActiveTool('overlays');
              }}
              onMoveOverlay={handleMoveOverlay}
            />

            {/* Overlay Text Caption when in Media mode */}
            {!isTextMode && !isEventMode && storyText && (
              <div className="absolute inset-x-6 bottom-44 flex items-center justify-center z-10 pointer-events-none">
                <p className="text-lg font-extrabold text-white text-center px-3 py-1.5 rounded-xl bg-black/55 backdrop-blur-md drop-shadow">
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
              {pollQuestion.trim() && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-black/60 backdrop-blur-md border border-white/20 text-xs font-semibold text-white">
                  <BarChart2 className="w-3.5 h-3.5" aria-hidden="true" />
                  <span className="truncate max-w-[160px]">{pollQuestion.trim()}</span>
                </span>
              )}
              {questionPrompt.trim() && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-black/60 backdrop-blur-md border border-white/20 text-xs font-semibold text-white">
                  <HelpCircle className="w-3.5 h-3.5" aria-hidden="true" />
                  <span className="truncate max-w-[160px]">{questionPrompt.trim()}</span>
                </span>
              )}
              {storyTimer > 0 && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-black/60 backdrop-blur-md border border-white/20 text-xs font-semibold text-white">
                  <Timer className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>{storyTimer}s</span>
                </span>
              )}
              {linkUrl.trim() && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-black/60 backdrop-blur-md border border-white/20 text-xs font-semibold text-white">
                  <Link2 className="w-3.5 h-3.5" aria-hidden="true" />
                  <span className="truncate max-w-[150px]">{linkUrl.trim()}</span>
                </span>
              )}
            </div>

            {/* Active Tool Popovers */}
            {activeTool === 'adjust' && capturedPreview && !isTextMode && mediaType !== 'audio' && (
              <div className="absolute top-20 inset-x-4 z-30">
                <VibeMediaEditorPanel
                  mediaType={mediaType}
                  mediaEdits={mediaEdits}
                  nativeDuration={nativeDuration}
                  onChangeEdits={(patch) => setMediaEdits((prev) => ({ ...prev, ...patch }))}
                  onResetEdits={() => setMediaEdits(DEFAULT_MEDIA_EDITS)}
                  onCaptureVideoCover={mediaType === 'video' ? handleCaptureVideoCover : null}
                  onClose={() => setActiveTool(null)}
                />
              </div>
            )}

            {activeTool === 'overlays' && (
              <div className="absolute top-20 inset-x-4 z-30">
                <VibeTextOverlayPanel
                  overlays={textOverlays}
                  selectedId={selectedOverlayId}
                  onSelect={setSelectedOverlayId}
                  onAdd={handleAddOverlay}
                  onUpdate={handleUpdateOverlay}
                  onDelete={handleDeleteOverlay}
                  onClose={() => setActiveTool(null)}
                />
              </div>
            )}

            {activeTool === 'freehand' && (
              <div className="absolute top-20 inset-x-4 z-30">
                <VibeDrawingToolbar
                  brushColor={brushColor}
                  onBrushColorChange={setBrushColor}
                  brushSize={brushSize}
                  onBrushSizeChange={setBrushSize}
                  brushMode={brushMode}
                  onBrushModeChange={setBrushMode}
                  canUndo={undoStack.length > 0}
                  canRedo={redoStack.length > 0}
                  hasPaths={drawingPaths.length > 0}
                  onUndo={handleUndoDrawing}
                  onRedo={handleRedoDrawing}
                  onClear={handleClearDrawing}
                  onDone={() => setActiveTool(null)}
                />
              </div>
            )}

            {activeTool === 'poll' && (
              <div className="absolute top-20 inset-x-5 z-30 p-4 rounded-2xl bg-black/85 backdrop-blur-xl border border-white/20 text-white shadow-2xl space-y-2.5">
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

            {activeTool === 'music' && (
              <div className="absolute bottom-28 inset-x-4 z-30 p-3 rounded-2xl bg-black/85 backdrop-blur-xl border border-white/20 text-white shadow-2xl">
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
                          'w-full min-h-[40px] flex items-center gap-2 px-2.5 py-2 rounded-xl text-left text-xs transition-colors',
                          selectedMusic?.id === track.id
                            ? 'text-white font-semibold'
                            : 'text-white/80 hover:bg-white/10'
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

            {activeTool === 'text' && !isTextMode && !isEventMode && (
              <div className="absolute top-20 inset-x-5 z-30 p-4 rounded-2xl bg-black/85 backdrop-blur-xl border border-white/20 text-white shadow-2xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-white/70">Caption</span>
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
                  aria-label="Caption text"
                  type="text"
                  value={storyText}
                  onChange={(e) => setStoryText(e.target.value)}
                  placeholder="Add a caption..."
                  className="w-full text-sm font-bold bg-transparent border-b border-white/20 pb-2 outline-none text-center"
                />
              </div>
            )}

            {(activeTool === 'gif' || activeTool === 'stickers') && (
              <div className="absolute bottom-28 inset-x-4 z-30">
                <GIFPicker
                  onSelect={(url, gif) => { setSelectedGif({ url, title: gif?.title || 'GIF' }); setActiveTool(null); }}
                  onClose={() => setActiveTool(null)}
                />
              </div>
            )}

            {activeTool === 'link' && (
              <div className="absolute top-20 inset-x-5 z-30 p-4 rounded-2xl bg-black/85 backdrop-blur-xl border border-white/20 text-white shadow-2xl space-y-2">
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

            {activeTool === 'location' && (
              <div className="absolute top-20 inset-x-5 z-30 p-4 rounded-2xl bg-black/85 backdrop-blur-xl border border-white/20 text-white shadow-2xl space-y-2">
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

            {activeTool === 'mention' && (
              <div className="absolute top-20 inset-x-5 z-30 p-4 rounded-2xl bg-black/85 backdrop-blur-xl border border-white/20 text-white shadow-2xl space-y-2">
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

            {activeTool === 'question' && (
              <div className="absolute top-20 inset-x-5 z-30 p-4 rounded-2xl bg-black/85 backdrop-blur-xl border border-white/20 text-white shadow-2xl space-y-2">
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

            {activeTool === 'timer' && (
              <div className="absolute top-20 inset-x-5 z-30 p-4 rounded-2xl bg-black/85 backdrop-blur-xl border border-white/20 text-white shadow-2xl space-y-2">
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

            {isRecording && (
              <div className="absolute top-16 left-4 z-20 flex items-center gap-2 px-3 py-1.5 rounded-xl bg-rose-600 text-white text-xs font-bold shadow-lg">
                <span className="w-2.5 h-2.5 rounded-full bg-white" />
                <span className="tabular-nums">00:{recordSeconds.toString().padStart(2, '0')}</span>
              </div>
            )}
          </div>

          {/* Top Studio Bar */}
          <div className="relative z-20 pt-3.5 px-3.5 flex items-center justify-between">
            <button
              type="button"
              onClick={() => navigate(-1)}
              aria-label="Close Vibes studio"
              className="w-11 h-11 rounded-full bg-black/55 backdrop-blur-md border border-white/15 flex items-center justify-center hover:bg-black/75 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5 text-white" />
            </button>

            <div className="flex items-center gap-1.5">
              {(canPublish || textOverlays.length > 0 || drawingPaths.length > 0) && (
                <button
                  type="button"
                  onClick={() => handleSaveDraft()}
                  aria-label="Save draft locally"
                  className="w-11 h-11 rounded-full bg-black/55 backdrop-blur-md border border-white/15 flex items-center justify-center hover:bg-black/75 transition-colors cursor-pointer"
                >
                  <Save className="w-4 h-4 text-white" />
                </button>
              )}

              {savedDrafts.length > 0 && (
                <button
                  type="button"
                  onClick={() => setDraftsDrawerOpen(true)}
                  aria-label="Open saved drafts"
                  className="lg:hidden h-11 px-3 rounded-full bg-black/55 backdrop-blur-md border border-white/15 flex items-center justify-center gap-1 text-xs font-bold text-white cursor-pointer"
                >
                  <FolderOpen className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>{savedDrafts.length}</span>
                </button>
              )}

              <button
                type="button"
                onClick={handleToggleFlash}
                aria-label={`Flash mode: ${flashMode}`}
                className="w-11 h-11 rounded-full bg-black/55 backdrop-blur-md border border-white/15 flex items-center justify-center hover:bg-black/75 transition-colors cursor-pointer"
              >
                <Zap className={cn('w-4 h-4', flashMode === 'on' ? 'text-amber-400' : 'text-white')} />
              </button>

              <button
                type="button"
                onClick={handleFlipCamera}
                aria-label="Switch camera"
                className="w-11 h-11 rounded-full bg-black/55 backdrop-blur-md border border-white/15 flex items-center justify-center hover:bg-black/75 transition-colors cursor-pointer"
              >
                <RefreshCw className="w-4 h-4 text-white" />
              </button>

              <button
                type="button"
                onClick={() => setToolsExpanded((prev) => !prev)}
                aria-label="Toggle studio tools"
                aria-expanded={toolsExpanded}
                className="w-11 h-11 rounded-full bg-black/55 backdrop-blur-md border border-white/15 flex items-center justify-center hover:bg-black/75 transition-colors cursor-pointer lg:hidden"
              >
                <Sliders className="w-4 h-4 text-white" />
              </button>
            </div>
          </div>

          {/* Mobile Creative Tools Strip */}
          {toolsExpanded && (
            <div className="relative z-20 px-3 lg:hidden">
              <div className="bg-black/60 border border-white/15 rounded-2xl p-1.5 backdrop-blur-xl">
                <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
                  {CREATIVE_TOOLS.filter((tool) => tool.id !== 'music' || musicLibraryEnabled).map((tool) => {
                    const Icon = tool.icon;
                    const isSelected = activeTool === tool.id;
                    const disabledAdjust = tool.id === 'adjust' && (!capturedPreview || isTextMode || mediaType === 'audio');
                    return (
                      <button
                        type="button"
                        key={tool.id}
                        disabled={disabledAdjust}
                        onClick={() => {
                          setActiveTool(isSelected ? null : tool.id);
                          if (tool.id === 'music' && !isSelected && musicTracks.length === 0) loadMusicTracks();
                        }}
                        className={cn(
                          'min-h-[38px] flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[11px] font-semibold whitespace-nowrap shrink-0 transition-colors disabled:opacity-35',
                          isSelected ? 'text-white' : 'text-white/80 hover:bg-white/10'
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
          <div className="relative z-20 pb-4 px-3.5 space-y-2.5">
            {/* Rich Text / Audio / Event Theme Controls */}
            {(isTextMode || isEventMode || mediaType === 'audio') && (
              <div className="space-y-2 bg-black/45 backdrop-blur-md p-2.5 rounded-2xl border border-white/10">
                <div className="flex items-center justify-center gap-2">
                  {VIBE_TEXT_BACKGROUNDS.map((g) => (
                    <button
                      type="button"
                      key={g.id}
                      aria-label={`Select ${g.label} background`}
                      onClick={() => {
                        setBackgroundGradient(g.background);
                        setTextColor(g.textColor);
                      }}
                      className={cn(
                        'w-7 h-7 rounded-full border-2 transition-transform cursor-pointer',
                        backgroundGradient === g.background ? 'border-white scale-110' : 'border-white/30'
                      )}
                      style={{ background: g.background }}
                    />
                  ))}
                </div>
                {isTextMode && (
                  <div className="flex items-center justify-between gap-2 pt-1">
                    <div className="flex items-center gap-1">
                      {VIBE_FONT_OPTIONS.map((f) => (
                        <button
                          type="button"
                          key={f.id}
                          onClick={() => setTextFont(f.id)}
                          className={cn(
                            'px-2 py-1 rounded-lg text-[10px] font-bold border cursor-pointer',
                            textFont === f.id ? 'border-white bg-white/20 text-white' : 'border-white/15 text-white/70'
                          )}
                        >
                          {f.label}
                        </button>
                      ))}
                    </div>
                    <div className="flex items-center gap-1">
                      {[
                        { id: 'left', icon: AlignLeft },
                        { id: 'center', icon: AlignCenter },
                        { id: 'right', icon: AlignRight },
                      ].map((al) => {
                        const Icon = al.icon;
                        return (
                          <button
                            type="button"
                            key={al.id}
                            aria-label={`Align text ${al.id}`}
                            onClick={() => setTextAlign(al.id)}
                            className={cn(
                              'w-7 h-7 rounded-lg flex items-center justify-center border cursor-pointer',
                              textAlign === al.id ? 'border-white bg-white/20 text-white' : 'border-white/15 text-white/70'
                            )}
                          >
                            <Icon className="w-3.5 h-3.5" />
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Zoom Selector for Live Camera */}
            {cameraActive && !capturedPreview && !isTextMode && !isAudioMode && !isEventMode && (
              <div className="flex items-center justify-center gap-2">
                {['0.5', '1x', '2'].map((z) => (
                  <button
                    type="button"
                    key={z}
                    onClick={() => setZoomLevel(z)}
                    className={cn(
                      'min-w-[36px] min-h-[36px] rounded-full text-[11px] font-bold transition-all flex items-center justify-center backdrop-blur-md cursor-pointer',
                      zoomLevel === z
                        ? 'bg-white text-black scale-105 shadow-lg'
                        : 'bg-black/50 text-white/80 hover:bg-black/70 border border-white/15'
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
                <div className="w-11 h-11 rounded-2xl border border-white/25 bg-black/55 backdrop-blur-md flex items-center justify-center hover:border-white/50 transition-colors">
                  <ImageIcon className="w-5 h-5 text-white" aria-hidden="true" />
                </div>
                <span className="text-[10px] font-semibold text-white/80">{isEventMode ? 'Cover' : 'Gallery'}</span>
              </button>
              <input
                ref={fileInputRef}
                aria-label="Choose vibe media file"
                type="file"
                accept={isEventMode ? 'image/*' : 'image/*,video/*,audio/*,.mp3,.m4a,.aac,.wav,.ogg,.webm,.flac'}
                onChange={handleFilePicked}
                className="hidden"
              />

              {!isTextMode && !isEventMode && (
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
                      : isAudioMode
                        ? isRecording
                          ? 'Stop audio recording'
                          : 'Start audio recording'
                        : !cameraActive
                          ? 'Enable camera'
                          : isRecording
                            ? 'Stop video recording'
                            : activeMode === 'VIDEO'
                              ? 'Start video recording'
                              : 'Capture Vibe'
                  }
                  className="relative w-16 h-16 rounded-full p-1.5 shadow-xl active:scale-95 transition-transform cursor-pointer"
                  style={{ background: isRecording ? '#E11D48' : BRAND_GRADIENT }}
                >
                  <div className="w-full h-full rounded-full bg-white flex items-center justify-center">
                    {capturedPreview ? (
                      <Check className="w-6 h-6 text-slate-900" aria-hidden="true" />
                    ) : isAudioMode ? (
                      isRecording ? (
                        <Square className="w-5 h-5 text-rose-600 fill-rose-600" aria-hidden="true" />
                      ) : (
                        <Mic className="w-6 h-6 text-rose-600" aria-hidden="true" />
                      )
                    ) : !cameraActive ? (
                      <Camera className="w-6 h-6 text-slate-900" aria-hidden="true" />
                    ) : isRecording ? (
                      <Square className="w-5 h-5 text-rose-600 fill-rose-600" aria-hidden="true" />
                    ) : activeMode === 'VIDEO' ? (
                      <Video className="w-6 h-6 text-rose-600" aria-hidden="true" />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-slate-100 border border-slate-300" />
                    )}
                  </div>
                </button>
              )}

              <button
                type="button"
                onClick={() => setAudienceModalOpen(true)}
                aria-label="Choose Vibe audience"
                className="flex flex-col items-center gap-1 cursor-pointer"
              >
                <div className="w-11 h-11 rounded-2xl bg-black/55 backdrop-blur-md border border-white/25 flex items-center justify-center hover:border-white/50 transition-colors">
                  <Shield className="w-5 h-5 text-white" aria-hidden="true" />
                </div>
                <span className="text-[10px] font-semibold text-white/85 truncate max-w-[68px]">
                  {audienceMeta.shortLabel}
                </span>
              </button>
            </div>

            {/* Capture Mode Selector */}
            <div className="flex items-center justify-center gap-1.5 overflow-x-auto no-scrollbar pt-0.5">
              {CAPTURE_MODES.map((mode) => {
                const isActive = activeMode === mode;
                return (
                  <button
                    type="button"
                    key={mode}
                    onClick={() => handleSelectCaptureMode(mode)}
                    className={cn(
                      'px-3 py-1.5 rounded-xl text-[11px] font-bold tracking-wider uppercase transition-all whitespace-nowrap cursor-pointer',
                      isActive ? 'text-white shadow-md' : 'text-white/60 hover:text-white'
                    )}
                    style={isActive ? { background: BRAND_GRADIENT } : undefined}
                  >
                    {mode}
                  </button>
                );
              })}
            </div>

            {/* Preview + Publish Bar */}
            {canPublish && (
              <div className="pt-1 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPreviewOpen(true)}
                  aria-label="Preview Vibe"
                  className="min-h-[46px] px-4 rounded-2xl bg-white/15 hover:bg-white/25 border border-white/20 text-white font-bold text-xs inline-flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Eye className="w-4 h-4" aria-hidden="true" />
                  <span>Preview</span>
                </button>
                <button
                  type="button"
                  onClick={handlePublishStory}
                  className="flex-1 min-h-[46px] py-3 rounded-2xl text-white font-bold text-sm shadow-xl flex items-center justify-center gap-2 active:scale-[0.98] transition-transform cursor-pointer"
                  style={{ background: BRAND_GRADIENT }}
                >
                  <Send className="w-4 h-4" aria-hidden="true" />
                  <span>Publish Vibe</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Desktop Guide, Audience Summary & Presets */}
        <div className="hidden lg:flex flex-col justify-between h-[780px] w-80 py-2">
          <div className="space-y-5">
            <div>
              <span className={cn('text-[11px] font-bold uppercase tracking-widest block mb-2.5', isDark ? 'text-white/50' : 'text-slate-500')}>
                Modes
              </span>
              <div className="space-y-1.5">
                {CAPTURE_MODES.map((mode) => {
                  const active = activeMode === mode;
                  return (
                    <button
                      type="button"
                      key={mode}
                      onClick={() => handleSelectCaptureMode(mode)}
                      className={cn(
                        'w-full min-h-[40px] text-left px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-between cursor-pointer border',
                        active
                          ? isDark
                            ? 'bg-white/15 text-white border-white/30'
                            : 'bg-slate-900 text-white border-slate-900'
                          : isDark
                            ? 'text-white/60 border-transparent hover:bg-white/5 hover:text-white'
                            : 'text-slate-700 border-slate-200 bg-white hover:bg-slate-50'
                      )}
                    >
                      <span>{mode}</span>
                      {active && <span className="w-2 h-2 rounded-full bg-white" />}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Audience Selector Card */}
            <div className={cn(
              'p-4 rounded-2xl border space-y-2.5',
              isDark ? 'bg-white/[0.04] border-white/10' : 'bg-white border-slate-200 shadow-sm'
            )}>
              <div className="flex items-center justify-between">
                <span className={cn('text-[11px] font-bold uppercase tracking-wider', isDark ? 'text-white/60' : 'text-slate-500')}>
                  Audience Privacy
                </span>
                <button
                  type="button"
                  onClick={() => setAudienceModalOpen(true)}
                  className="text-xs font-bold text-indigo-400 hover:underline cursor-pointer"
                >
                  Change
                </button>
              </div>
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-indigo-400 shrink-0" aria-hidden="true" />
                <span className="text-sm font-bold">{audienceMeta.label}</span>
              </div>
              <p className={cn('text-xs leading-relaxed', isDark ? 'text-white/65' : 'text-slate-600')}>
                {audienceMeta.description}
                {audience === VIBE_AUDIENCES.SELECTED && ` (${selectedUsers.length} selected)`}
              </p>
            </div>
          </div>

          <div className={cn(
            'p-4 rounded-2xl border space-y-3',
            isDark ? 'bg-white/[0.04] border-white/10' : 'bg-white border-slate-200 shadow-sm'
          )}>
            <span className={cn('text-xs font-bold block', isDark ? 'text-white/80' : 'text-slate-800')}>
              Text Card Themes
            </span>
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
              {VIBE_TEXT_BACKGROUNDS.map((d) => (
                <button
                  type="button"
                  key={d.id}
                  onClick={() => {
                    setBackgroundGradient(d.background);
                    setTextColor(d.textColor);
                    if (activeMode !== 'TEXT' && !mediaFile) setActiveMode('TEXT');
                  }}
                  aria-label={`Apply ${d.label} gradient`}
                  className={cn(
                    'w-10 h-12 rounded-xl border-2 transition-all flex-shrink-0 cursor-pointer',
                    backgroundGradient === d.background ? 'border-white scale-105 ring-2 ring-indigo-500' : 'border-white/25 hover:border-white/60'
                  )}
                  style={{ background: d.background }}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Audience & Close Circle Picker Modal */}
      <VibeAudienceModal
        open={audienceModalOpen}
        isDark={isDark}
        userId={user?.uid}
        audience={audience}
        selectedUsers={selectedUsers}
        onSelectAudience={setAudience}
        onChangeSelectedUsers={setSelectedUsers}
        onClose={() => setAudienceModalOpen(false)}
      />

      {/* Inline Preview Modal using shared VibeRenderer */}
      <VibePreviewModal
        open={previewOpen}
        previewVibe={previewVibeObject}
        audience={audience}
        selectedCount={selectedUsers.length}
        onClose={() => setPreviewOpen(false)}
        onPublish={handlePublishStory}
      />

      {/* Upload Lifecycle / Progress / Cancel / Retry Overlay */}
      <VibePublishOverlay
        state={uploadState}
        progress={uploadProgress}
        error={uploadError}
        isDark={isDark}
        onCancel={handleCancelUpload}
        onRetry={handlePublishStory}
        onSaveDraft={async () => {
          await handleSaveDraft();
          setUploadState(VIBE_UPLOAD_STATES.IDLE);
        }}
        onDismiss={() => setUploadState(VIBE_UPLOAD_STATES.IDLE)}
      />

      {/* Saved Drafts Drawer Modal */}
      {draftsDrawerOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4"
          onClick={() => setDraftsDrawerOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label="Saved Vibe drafts"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className={cn(
              'w-full max-w-md rounded-3xl p-5 border shadow-2xl space-y-3',
              isDark ? 'bg-[#0A102D] border-white/10 text-white' : 'bg-white border-slate-200 text-slate-900'
            )}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold">Saved Vibe Drafts</h3>
              <button
                type="button"
                onClick={() => setDraftsDrawerOpen(false)}
                aria-label="Close drafts"
                className="w-9 h-9 rounded-full hover:bg-white/10 flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {savedDrafts.map((d) => (
                <div
                  key={d.id}
                  className={cn(
                    'flex items-center justify-between gap-2 p-3 rounded-2xl border',
                    isDark ? 'bg-white/5 border-white/10' : 'bg-slate-50 border-slate-200'
                  )}
                >
                  <button
                    type="button"
                    onClick={() => handleResumeDraft(d)}
                    className="flex-1 text-left min-w-0 cursor-pointer"
                  >
                    <p className="text-xs font-bold capitalize">
                      {d.type} Vibe • {getAudienceMeta(d.visibility).shortLabel}
                    </p>
                    <p className={cn('text-[11px] truncate', isDark ? 'text-slate-400' : 'text-slate-600')}>
                      {d.content || d.mediaName || 'Saved local draft'}
                    </p>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteDraft(d.id)}
                    aria-label="Delete draft"
                    className="w-9 h-9 rounded-xl hover:bg-rose-600/20 text-rose-400 flex items-center justify-center cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
