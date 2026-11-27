// src/screens/CreatePost/CreateAudio.jsx
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import * as Icons from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '../../lib/utils';
import { BRAND_GRADIENT } from '../../design-system/tokens.js';
import { LazyImage } from '../../components/Shared/LazyImage';
import LoadingSpinner from '../../components/Shared/LoadingSpinner';
import { useCreatePostState, useCreatePostServices } from './CreatePostContext.jsx';
import { MAX_FILE_SIZE_BYTES, SURFACE_GLASS_CLASS } from './createPostConstants.js';
import { mediaUrlToFile } from './postMediaPipeline.js';

const AUDIO_GENRES = [
  'Original',
  'Electronic',
  'Hip-Hop',
  'Acoustic',
  'Jazz & Soul',
  'Lo-Fi',
  'Podcast',
  'Ambient',
];

const MAX_CAPTION_LENGTH = 2200;

export default function CreateAudio() {
  const navigate = useNavigate();
  const location = useLocation();
  const { state, dispatch } = useCreatePostState();
  const { saveDraft, isDark, autoSaveStatus, lastSavedAt } = useCreatePostServices();

  const fileInputRef = useRef(null);
  const coverInputRef = useRef(null);

  const seed = state.typeData?.audio || {};
  const [audioFile, setAudioFile] = useState(seed.file || null);
  const [previewUrl, setPreviewUrl] = useState(seed.previewUrl || seed.url || null);
  const [coverUrl, setCoverUrl] = useState(seed.coverUrl || null);
  const [coverFile, setCoverFile] = useState(seed.coverFile || null);
  const [trackTitle, setTrackTitle] = useState(seed.title || '');
  const [artistName, setArtistName] = useState(seed.artist || '');
  const [selectedGenre, setSelectedGenre] = useState(seed.genre || 'Original');
  const [isRecording, setIsRecording] = useState(false);
  const [recordDuration, setRecordDuration] = useState(0);

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const activeStreamRef = useRef(null);
  const timerRef = useRef(null);
  const ownedPreviewUrlRef = useRef(null);
  const ownedCoverUrlRef = useRef(null);

  const persistedAudioUrl = state.typeData?.audio?.url || '';
  const hasAudio = Boolean(audioFile || previewUrl || persistedAudioUrl);

  // Sync audio state into parent reducer only when changed (prevents false isDirty/undo entries on mount)
  useEffect(() => {
    const curAudio = state.typeData?.audio || {};
    const nextUrl = audioFile ? '' : persistedAudioUrl;
    const audioChanged =
      (curAudio.file || null) !== (audioFile || null) ||
      (curAudio.url || '') !== nextUrl ||
      (curAudio.previewUrl || null) !== (previewUrl || null) ||
      (curAudio.coverUrl || null) !== (coverUrl || null) ||
      (curAudio.coverFile || null) !== (coverFile || null) ||
      (curAudio.title || '') !== trackTitle ||
      (curAudio.artist || '') !== artistName ||
      (curAudio.genre || 'Original') !== selectedGenre;

    if (audioChanged) {
      dispatch({
        type: 'SET_TYPE_DATA',
        payload: {
          audio: {
            file: audioFile,
            url: nextUrl,
            previewUrl,
            coverUrl,
            coverFile,
            title: trackTitle,
            artist: artistName,
            genre: selectedGenre,
          },
        },
      });
    }

    const expectedHasMedia = Boolean(audioFile || persistedAudioUrl);
    const curHasMedia = Array.isArray(state.mediaItems) && state.mediaItems.length > 0;
    if (audioChanged && (expectedHasMedia || curHasMedia)) {
      dispatch({
        type: 'SET_MEDIA_ITEMS',
        payload: audioFile
          ? [
              {
                id: 'audio-main',
                type: 'audio',
                file: audioFile,
                preview: previewUrl,
                url: '',
                name: trackTitle || audioFile.name || 'audio',
                alt: trackTitle || 'Audio track',
              },
            ]
          : persistedAudioUrl
          ? [
              {
                id: 'audio-main',
                type: 'audio',
                file: null,
                url: persistedAudioUrl,
                preview: previewUrl || persistedAudioUrl,
                name: trackTitle || 'audio',
                alt: trackTitle || 'Audio track',
              },
            ]
          : [],
      });
    }

    if (Boolean(state.isContentReady) !== expectedHasMedia) {
      dispatch({
        type: 'SET_CONTENT_READY',
        payload: expectedHasMedia,
      });
    }
  }, [
    audioFile,
    previewUrl,
    coverUrl,
    coverFile,
    trackTitle,
    artistName,
    selectedGenre,
    persistedAudioUrl,
    state.typeData?.audio,
    state.mediaItems,
    state.isContentReady,
    dispatch,
  ]);

  const handleFile = useCallback(
    (file) => {
      if (!file?.type?.startsWith('audio/')) {
        toast.error('Please select a valid audio file (MP3, WAV, AAC, WebM)');
        return;
      }
      if (file.size > MAX_FILE_SIZE_BYTES) {
        toast.error('Audio file must be under 100MB');
        return;
      }
      if (ownedPreviewUrlRef.current) {
        URL.revokeObjectURL(ownedPreviewUrlRef.current);
      }
      const nextPreview = URL.createObjectURL(file);
      ownedPreviewUrlRef.current = nextPreview;
      setAudioFile(file);
      setPreviewUrl(nextPreview);
      if (!trackTitle) {
        setTrackTitle(file.name.replace(/\.[^/.]+$/, ''));
      }
      toast.success('Audio loaded');
    },
    [trackTitle]
  );

  // Hand-offs from AudioEditor (audioFile, audioBlob, or audioDataUrl)
  const initialLoadedRef = useRef(false);
  useEffect(() => {
    if (initialLoadedRef.current) return;
    let cancelled = false;

    if (location.state?.audioFile) {
      initialLoadedRef.current = true;
      handleFile(location.state.audioFile);
    } else if (location.state?.audioBlob) {
      initialLoadedRef.current = true;
      const file = new File(
        [location.state.audioBlob],
        location.state.fileName || `audio-${Date.now()}.wav`,
        { type: location.state.audioBlob.type || 'audio/wav' }
      );
      handleFile(file);
    } else if (location.state?.audioDataUrl) {
      initialLoadedRef.current = true;
      mediaUrlToFile(
        location.state.audioDataUrl,
        location.state.fileName || `audio-${Date.now()}.wav`,
        'audio/wav'
      )
        .then((file) => {
          if (!cancelled) handleFile(file);
        })
        .catch((err) => {
          console.warn('[CreateAudio] Failed converting exported audio URL:', err?.message);
          if (!cancelled) toast.error('Could not load exported audio from Studio');
        });
    }

    return () => {
      cancelled = true;
    };
  }, [location.state, handleFile]);

  const handleCover = useCallback((file) => {
    if (!file?.type?.startsWith('image/')) {
      toast.error('Please select a valid image file for cover art');
      return;
    }
    if (ownedCoverUrlRef.current) {
      URL.revokeObjectURL(ownedCoverUrlRef.current);
    }
    const url = URL.createObjectURL(file);
    ownedCoverUrlRef.current = url;
    setCoverFile(file);
    setCoverUrl(url);
  }, []);

  const removeAudio = useCallback(() => {
    if (ownedPreviewUrlRef.current) {
      URL.revokeObjectURL(ownedPreviewUrlRef.current);
      ownedPreviewUrlRef.current = null;
    }
    if (ownedCoverUrlRef.current) {
      URL.revokeObjectURL(ownedCoverUrlRef.current);
      ownedCoverUrlRef.current = null;
    }
    setAudioFile(null);
    setPreviewUrl(null);
    setCoverFile(null);
    setCoverUrl(null);
    setTrackTitle('');
    setArtistName('');
    dispatch({
      type: 'SET_TYPE_DATA',
      payload: {
        audio: {
          file: null,
          url: '',
          previewUrl: null,
          coverUrl: null,
          coverFile: null,
          title: '',
          artist: '',
          genre: selectedGenre,
          sourceSoundId: null,
          duration: 0,
        },
      },
    });
    dispatch({ type: 'SET_MEDIA_ITEMS', payload: [] });
  }, [dispatch, selectedGenre]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      activeStreamRef.current = stream;
      mediaRecorderRef.current = new MediaRecorder(stream);
      audioChunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorderRef.current.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const recordedFile = new File([audioBlob], `Recording_${Date.now()}.webm`, {
          type: 'audio/webm',
        });
        handleFile(recordedFile);
        stream.getTracks().forEach((t) => t.stop());
        activeStreamRef.current = null;
      };

      mediaRecorderRef.current.start();
      setIsRecording(true);
      setRecordDuration(0);
      timerRef.current = setInterval(() => {
        setRecordDuration((d) => d + 1);
      }, 1000);
      toast.info('Recording started');
    } catch {
      toast.error('Microphone permission denied or unavailable');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      clearInterval(timerRef.current);
    }
  };

  // Cleanup active mic, timers, and owned object URLs on unmount
  useEffect(() => {
    return () => {
      clearInterval(timerRef.current);
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        try {
          mediaRecorderRef.current.stop();
        } catch (err) {
          console.warn('[CreateAudio] Recorder stop notice:', err?.message);
        }
      }
      if (activeStreamRef.current) {
        activeStreamRef.current.getTracks().forEach((t) => t.stop());
        activeStreamRef.current = null;
      }
      if (ownedPreviewUrlRef.current) {
        URL.revokeObjectURL(ownedPreviewUrlRef.current);
      }
      if (ownedCoverUrlRef.current) {
        URL.revokeObjectURL(ownedCoverUrlRef.current);
      }
    };
  }, []);

  const insertTag = useCallback(
    (tag) => {
      const current = state.content || '';
      const next = `${current}${current && !current.endsWith(' ') ? ' ' : ''}${tag} `;
      if (next.length <= MAX_CAPTION_LENGTH) {
        dispatch({ type: 'SET_CONTENT', payload: next });
      }
    },
    [state.content, dispatch]
  );

  return (
    <div className="max-w-3xl mx-auto w-full py-4 space-y-4">
      {/* Studio Subheader */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold tracking-tight text-slate-900 dark:text-white">
            Audio Studio
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Record voice notes, upload tracks, or master audio
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => navigate('/audio-editor')}
            className="min-h-[40px] px-3.5 py-1.5 rounded-xl border border-slate-200 dark:border-white/12 bg-white/80 dark:bg-[#080F2E]/80 text-xs font-semibold text-slate-800 dark:text-slate-100 hover:bg-white dark:hover:bg-white/10 transition-colors flex items-center gap-1.5 whitespace-nowrap focus-visible:ring-2 focus-visible:ring-arvdoul-purple"
          >
            <Icons.Sliders className="w-3.5 h-3.5 text-arvdoul-purple" />
            <span>Open Studio</span>
          </button>

          <button
            type="button"
            onClick={saveDraft}
            disabled={autoSaveStatus === 'saving'}
            className="min-h-[40px] px-3.5 py-1.5 rounded-xl text-xs font-semibold text-white transition-opacity hover:opacity-95 flex items-center gap-1.5 disabled:opacity-50 whitespace-nowrap focus-visible:ring-2 focus-visible:ring-arvdoul-purple"
            style={{ background: BRAND_GRADIENT }}
          >
            {autoSaveStatus === 'saving' ? (
              <LoadingSpinner size="xs" color="white" />
            ) : (
              <Icons.Save className="w-3.5 h-3.5" />
            )}
            <span>Save Draft</span>
          </button>
        </div>
      </div>

      {/* Main Audio Card */}
      <div className={`${SURFACE_GLASS_CLASS} p-4 sm:p-5 space-y-5`}>
        {!hasAudio ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className={cn(
                'p-6 rounded-2xl border-2 border-dashed flex flex-col items-center justify-center gap-3 text-center transition-colors focus-visible:ring-2 focus-visible:ring-arvdoul-purple',
                isDark
                  ? 'border-white/15 bg-white/[0.03] hover:border-arvdoul-purple'
                  : 'border-slate-300 bg-slate-50/70 hover:border-arvdoul-purple'
              )}
            >
              <div className="w-12 h-12 rounded-2xl bg-arvdoul-purple/15 text-arvdoul-purple flex items-center justify-center">
                <Icons.Upload className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-900 dark:text-white">Choose Audio File</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  MP3, WAV, AAC up to 100MB
                </p>
              </div>
            </button>

            <button
              type="button"
              aria-pressed={isRecording}
              aria-label={isRecording ? 'Stop live voice recording' : 'Record live voice'}
              onClick={isRecording ? stopRecording : startRecording}
              className={cn(
                'w-full p-6 rounded-2xl border-2 flex flex-col items-center justify-center gap-3 text-center transition-colors focus-visible:ring-2 focus-visible:ring-arvdoul-purple',
                isRecording
                  ? 'border-rose-500 bg-rose-500/10'
                  : isDark
                  ? 'border-white/15 bg-white/[0.03] hover:border-rose-500'
                  : 'border-slate-300 bg-slate-50/70 hover:border-rose-500'
              )}
            >
              <div
                className={cn(
                  'w-12 h-12 rounded-2xl flex items-center justify-center transition-transform',
                  isRecording ? 'bg-rose-500 text-white scale-105' : 'bg-rose-500/15 text-rose-500'
                )}
              >
                {isRecording ? <Icons.Square className="w-5 h-5" /> : <Icons.Mic className="w-6 h-6" />}
              </div>
              <div>
                <p className="text-sm font-bold text-slate-900 dark:text-white tabular-nums">
                  {isRecording ? `Recording (${recordDuration}s)` : 'Record Live Voice'}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {isRecording ? 'Tap to stop and attach' : 'Capture voice note or acoustic clip'}
                </p>
              </div>
            </button>
          </div>
        ) : (
          <div
            className={cn(
              'p-4 rounded-2xl border space-y-4',
              isDark ? 'bg-[#03071B]/60 border-white/10' : 'bg-white/80 border-slate-200/80'
            )}
          >
            <div className="flex items-start gap-3">
              <button
                type="button"
                onClick={() => coverInputRef.current?.click()}
                aria-label="Choose cover artwork"
                className={cn(
                  'w-20 h-20 rounded-xl overflow-hidden border flex flex-col items-center justify-center flex-shrink-0 group relative focus-visible:ring-2 focus-visible:ring-arvdoul-purple',
                  isDark ? 'bg-[#080F2E] border-white/15' : 'bg-slate-100 border-slate-200'
                )}
              >
                {coverUrl ? (
                  <LazyImage src={coverUrl} alt="Track cover art" className="w-full h-full object-cover" />
                ) : (
                  <div className="text-center p-1 text-slate-400">
                    <Icons.Image className="w-5 h-5 mx-auto mb-1 opacity-75 group-hover:text-arvdoul-purple" />
                    <span className="text-[11px] block font-medium">Cover</span>
                  </div>
                )}
                <div className="absolute inset-0 bg-black/45 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-[10px] font-semibold">
                  Change
                </div>
              </button>

              <div className="flex-1 min-w-0 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <input
                    aria-label="Track title"
                    type="text"
                    value={trackTitle}
                    onChange={(e) => setTrackTitle(e.target.value)}
                    placeholder="Track title..."
                    className="text-sm font-bold bg-transparent border-b border-transparent hover:border-arvdoul-purple focus:border-arvdoul-purple outline-none w-full text-slate-900 dark:text-white py-1"
                  />
                  <button
                    type="button"
                    onClick={removeAudio}
                    className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 transition-colors focus-visible:ring-2 focus-visible:ring-arvdoul-purple"
                    aria-label="Remove audio"
                  >
                    <Icons.Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <input
                  aria-label="Artist or creator name"
                  type="text"
                  value={artistName}
                  onChange={(e) => setArtistName(e.target.value)}
                  placeholder="Artist or creator name..."
                  className="text-xs bg-transparent border-b border-transparent hover:border-arvdoul-purple focus:border-arvdoul-purple outline-none w-full text-slate-600 dark:text-slate-300 py-1"
                />

                <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                  <span className="font-medium text-arvdoul-purple">{selectedGenre}</span>
                  {audioFile?.size && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span>{(audioFile.size / (1024 * 1024)).toFixed(2)} MB</span>
                    </>
                  )}
                </div>
              </div>
            </div>

            <audio controls src={previewUrl || persistedAudioUrl} className="w-full h-10 rounded-xl" />

            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              <span className="text-xs text-slate-500 dark:text-slate-400">
                Ready to publish or edit multitrack
              </span>
              <button
                type="button"
                onClick={() =>
                  navigate('/audio-editor', {
                    state: {
                      audioUrl: previewUrl || persistedAudioUrl,
                      title: trackTitle || audioFile?.name || 'Untitled Audio',
                      artist: artistName,
                    },
                  })
                }
                className="min-h-[40px] px-3.5 py-1.5 rounded-xl text-xs font-semibold text-white shadow-sm flex items-center gap-1.5 hover:opacity-95 transition-opacity focus-visible:ring-2 focus-visible:ring-arvdoul-purple"
                style={{ background: BRAND_GRADIENT }}
              >
                <Icons.Sliders className="w-3.5 h-3.5" />
                <span>Multi-Track Master Studio</span>
              </button>
            </div>
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="audio/*"
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.[0]) handleFile(e.target.files[0]);
            e.target.value = '';
          }}
        />
        <input
          ref={coverInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.[0]) handleCover(e.target.files[0]);
            e.target.value = '';
          }}
        />

        {/* Genre selector */}
        <div className="space-y-2">
          <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">
            Audio Category
          </p>
          <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide py-0.5">
            {AUDIO_GENRES.map((genre) => {
              const active = selectedGenre === genre;
              return (
                <button
                  key={genre}
                  type="button"
                  onClick={() => setSelectedGenre(genre)}
                  aria-pressed={active}
                  className={cn(
                    'min-h-[38px] px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors focus-visible:ring-2 focus-visible:ring-arvdoul-purple',
                    active
                      ? 'bg-arvdoul-purple text-white shadow-sm'
                      : isDark
                      ? 'bg-white/[0.05] border border-white/10 text-slate-300 hover:bg-white/10'
                      : 'bg-slate-100 border border-slate-200 text-slate-700 hover:bg-slate-200'
                  )}
                >
                  {genre}
                </button>
              );
            })}
          </div>
        </div>

        {/* Caption & Notes */}
        <div className="space-y-2">
          <label
            htmlFor="audio-caption-input"
            className="text-xs font-semibold text-slate-600 dark:text-slate-300 block"
          >
            Caption &amp; Notes
          </label>
          <div
            className={cn(
              'rounded-2xl border p-3.5 focus-within:ring-2 focus-within:ring-arvdoul-purple transition-shadow',
              isDark ? 'bg-[#03071B]/60 border-white/10' : 'bg-white/80 border-slate-200/80'
            )}
          >
            <textarea
              id="audio-caption-input"
              aria-label="Audio caption and notes"
              value={state.content || ''}
              maxLength={MAX_CAPTION_LENGTH}
              onChange={(e) => dispatch({ type: 'SET_CONTENT', payload: e.target.value })}
              placeholder="Share the story behind this track, recording gear, or collaborators..."
              className="w-full min-h-[92px] bg-transparent resize-none outline-none text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500"
            />
            <div className="flex items-center justify-between pt-2 border-t border-slate-200/60 dark:border-white/10 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => insertTag('#NewMusic')}
                  className="hover:text-arvdoul-purple font-medium focus-visible:ring-2 focus-visible:ring-arvdoul-purple rounded"
                >
                  #NewMusic
                </button>
                <button
                  type="button"
                  onClick={() => insertTag('#ArvdoulAudio')}
                  className="hover:text-arvdoul-purple font-medium focus-visible:ring-2 focus-visible:ring-arvdoul-purple rounded"
                >
                  #ArvdoulAudio
                </button>
              </div>
              <span>
                {(state.content || '').length} / {MAX_CAPTION_LENGTH}
              </span>
            </div>
          </div>
        </div>

        <div
          aria-live="polite"
          className="flex items-center justify-end gap-1.5 text-xs text-slate-500 dark:text-slate-400 tabular-nums"
        >
          {autoSaveStatus === 'saving' && (
            <>
              <LoadingSpinner size="xs" />
              <span>Saving draft...</span>
            </>
          )}
          {autoSaveStatus === 'saved' && lastSavedAt && (
            <>
              <Icons.CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
              <span>
                Saved {new Date(lastSavedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
