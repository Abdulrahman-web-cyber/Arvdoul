// src/screens/CreatePost/CreateVideo.jsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDropzone } from 'react-dropzone';
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, useSortable, horizontalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { toast } from 'sonner';
import { v4 as uuidv4 } from 'uuid';
import * as Icons from 'lucide-react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import LinkExtension from '@tiptap/extension-link';
import CharacterCount from '@tiptap/extension-character-count';
import LoadingSpinner from '../../components/Shared/LoadingSpinner';
import { LazyImage } from '../../components/Shared/LazyImage';
import { useAuth } from '../../context/AuthContext';
import { getAuthService } from '../../services/authService';
import { BRAND_GRADIENT, brandRgba, tokens } from '../../design-system/tokens.js';
import { useCreatePostState, useCreatePostServices } from './CreatePostContext.jsx';
import {
  MEDIA_LIMITS,
  MAX_FILE_SIZE_BYTES,
  SURFACE_GLASS_CLASS,
} from './createPostConstants.js';
import {
  generateVideoThumbnailBlob,
  uploadSingleMediaAsset,
  deleteUploadedStorageAsset,
  extractStoragePathFromUrl,
} from './postMediaPipeline.js';

const MAX_VIDEOS = MEDIA_LIMITS.maxVideos;
const MAX_CAPTION_LENGTH = 2200;

function readVideoDuration(file) {
  return new Promise((resolve) => {
    const objectUrl = URL.createObjectURL(file);
    const video = document.createElement('video');
    video.preload = 'metadata';
    const done = (dur) => {
      URL.revokeObjectURL(objectUrl);
      resolve(Number.isFinite(dur) ? dur : 0);
    };
    video.onloadedmetadata = () => done(video.duration || 0);
    video.onerror = () => done(0);
    video.src = objectUrl;
  });
}

// ── Sortable Thumbnail Item ──────────────────────────────────────────────────
const SortableThumbnail = React.memo(
  ({ media, index, isSelected, onSelect, onRemove, onEdit, isDark }) => {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
      id: media.id,
    });

    const style = {
      transform: CSS.Transform.toString(transform),
      transition,
      zIndex: isDragging ? 50 : undefined,
    };

    const isUploading = typeof media.progress === 'number' && media.progress > 0 && media.progress < 100 && !media.error;
    const isError = !!media.error;

    return (
      <div
        ref={setNodeRef}
        style={style}
        className={`relative flex-shrink-0 w-24 h-20 rounded-2xl overflow-hidden transition-all group border ${
          isSelected
            ? 'border-arvdoul-purple ring-2 ring-arvdoul-purple'
            : isDark
            ? 'border-white/15 hover:border-white/30'
            : 'border-slate-200 hover:border-slate-300'
        } ${isDark ? 'bg-[#03071B]' : 'bg-slate-900'}`}
      >
        <button
          type="button"
          onClick={() => onSelect(media.id)}
          aria-pressed={isSelected}
          aria-label={`Select video ${index + 1}${media.name ? `: ${media.name}` : ''}`}
          className="w-full h-full block focus-visible:ring-2 focus-visible:ring-arvdoul-purple focus:outline-none"
        >
          {media.thumbnailUrl || media.thumbnail ? (
            <LazyImage
              src={media.thumbnailUrl || media.thumbnail}
              alt={media.name || `Video ${index + 1}`}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-slate-400">
              <Icons.Video className="w-7 h-7" />
            </div>
          )}
        </button>

        {isUploading && (
          <div className="absolute inset-0 bg-black/65 flex flex-col items-center justify-center pointer-events-none">
            <svg className="w-9 h-9 -rotate-90" aria-hidden="true">
              <circle
                cx="18"
                cy="18"
                r="14"
                fill="none"
                stroke="rgba(255,255,255,0.28)"
                strokeWidth="3"
              />
              <circle
                cx="18"
                cy="18"
                r="14"
                fill="none"
                stroke={tokens.color.brand.violet}
                strokeWidth="3"
                strokeLinecap="round"
                style={{
                  strokeDasharray: 88,
                  strokeDashoffset: 88 - (88 * media.progress) / 100,
                  transition: 'stroke-dashoffset 0.25s ease',
                }}
              />
            </svg>
            <span className="text-white text-[10px] font-semibold mt-0.5 tabular-nums">
              {Math.round(media.progress)}%
            </span>
          </div>
        )}

        {isError && (
          <div className="absolute inset-0 bg-rose-950/80 flex items-center justify-center pointer-events-none">
            <Icons.AlertCircle className="w-6 h-6 text-white" />
          </div>
        )}

        <span className="absolute top-1.5 left-1.5 bg-black/75 text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center border border-white/15 tabular-nums pointer-events-none">
          {index + 1}
        </span>

        {media.duration > 0 && (
          <span className="absolute bottom-1.5 left-1.5 bg-black/75 text-white text-[10px] px-1.5 py-0.5 rounded-md tabular-nums pointer-events-none">
            {Math.floor(media.duration / 60)}:{String(Math.floor(media.duration % 60)).padStart(2, '0')}
          </span>
        )}

        <div className="absolute top-1 right-1 flex gap-1">
          <button
            type="button"
            onClick={() => onEdit(media)}
            className="w-7 h-7 bg-black/70 hover:bg-arvdoul-purple rounded-full text-white flex items-center justify-center transition-colors focus-visible:ring-2 focus-visible:ring-arvdoul-purple"
            aria-label="Edit video"
          >
            <Icons.Edit3 className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onRemove(media.id)}
            className="w-7 h-7 bg-black/70 hover:bg-rose-600 rounded-full text-white flex items-center justify-center transition-colors focus-visible:ring-2 focus-visible:ring-arvdoul-purple"
            aria-label="Remove video"
          >
            <Icons.X className="w-3.5 h-3.5" />
          </button>
        </div>

        <button
          type="button"
          {...attributes}
          {...listeners}
          aria-label={`Reorder video ${index + 1}`}
          className="absolute bottom-1 right-1 w-6 h-6 bg-black/55 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity cursor-grab active:cursor-grabbing"
        >
          <Icons.GripVertical className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }
);

// ── Filmstrip ────────────────────────────────────────────────────────────────
const Filmstrip = React.memo(({ items, selectedId, onSelect, onRemove, onEdit, onReorder, onAddVideo, isDark }) => {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  const handleDragEnd = useCallback(
    (event) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;
      const oldIdx = items.findIndex((m) => m.id === active.id);
      const newIdx = items.findIndex((m) => m.id === over.id);
      if (oldIdx !== -1 && newIdx !== -1) onReorder(oldIdx, newIdx);
    },
    [items, onReorder]
  );

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={items.map((m) => m.id)} strategy={horizontalListSortingStrategy}>
        <div className="flex gap-2.5 overflow-x-auto pb-1.5 scrollbar-thin">
          {items.map((media, idx) => (
            <SortableThumbnail
              key={media.id}
              media={media}
              index={idx}
              isSelected={media.id === selectedId}
              onSelect={onSelect}
              onRemove={onRemove}
              onEdit={onEdit}
              isDark={isDark}
            />
          ))}
          {items.length < MAX_VIDEOS && (
            <button
              type="button"
              onClick={onAddVideo}
              className={`flex-shrink-0 w-24 h-20 rounded-2xl border-2 border-dashed flex flex-col items-center justify-center gap-1 transition-colors focus-visible:ring-2 focus-visible:ring-arvdoul-purple ${
                isDark
                  ? 'border-white/20 hover:border-arvdoul-purple bg-white/[0.03] text-slate-300'
                  : 'border-slate-300 hover:border-arvdoul-purple bg-slate-50 text-slate-600'
              }`}
              aria-label="Add video"
            >
              <Icons.Plus className="w-5 h-5 text-arvdoul-purple" />
              <span className="text-[11px] font-medium">Add</span>
            </button>
          )}
        </div>
      </SortableContext>
    </DndContext>
  );
});

// ── Empty State ──────────────────────────────────────────────────────────────
const EmptyState = React.memo(({ onUpload }) => (
  <div className="flex flex-col items-center justify-center py-14 px-4 gap-5 text-center">
    <div
      className="w-20 h-20 rounded-3xl flex items-center justify-center border border-white/15"
      style={{ background: brandRgba(0.12) }}
    >
      <Icons.Video className="w-9 h-9 text-arvdoul-purple" />
    </div>
    <div className="space-y-1">
      <h3 className="text-lg font-bold text-slate-900 dark:text-white">Add your video</h3>
      <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs">
        Drag and drop a clip here or browse from your device.
      </p>
    </div>
    <button
      type="button"
      onClick={onUpload}
      className="min-h-[44px] px-7 py-2.5 rounded-2xl text-white font-semibold text-sm flex items-center gap-2 shadow-lg hover:opacity-95 active:scale-[0.99] transition-all focus-visible:ring-2 focus-visible:ring-arvdoul-purple"
      style={{ background: BRAND_GRADIENT }}
    >
      <Icons.Upload className="w-4 h-4" />
      <span>Browse Video</span>
    </button>
    <p className="text-[11px] text-slate-500 dark:text-slate-400">
      MP4, MOV, WebM · Up to {MEDIA_LIMITS.maxFileSizeMB}MB · Max {MAX_VIDEOS} video
    </p>
  </div>
));

// ── Caption Composer (TipTap) ────────────────────────────────────────────────
const CaptionComposer = React.memo(({ value, onChange, maxLength, isDark }) => {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: false }),
      Placeholder.configure({
        placeholder: "What's happening in this video? Write a caption...",
        emptyEditorClass: 'is-editor-empty',
      }),
      LinkExtension.configure({
        openOnClick: true,
        HTMLAttributes: {
          class: 'text-arvdoul-purple underline hover:opacity-80',
          rel: 'noopener noreferrer',
          target: '_blank',
        },
      }),
      CharacterCount.configure({ limit: maxLength }),
    ],
    content: value || '',
    onUpdate: ({ editor: ed }) => {
      onChange(ed.getJSON(), ed.getText());
    },
    editorProps: {
      attributes: {
        class: `prose dark:prose-invert max-w-none focus:outline-none min-h-[72px] text-sm ${
          isDark ? 'text-white' : 'text-slate-900'
        }`,
        'aria-label': 'Video caption',
      },
    },
  });

  useEffect(() => {
    if (!editor) return;
    if (typeof value === 'object' && value !== null) {
      if (JSON.stringify(editor.getJSON()) !== JSON.stringify(value)) {
        editor.commands.setContent(value, false);
      }
    } else if (typeof value === 'string' && value !== editor.getText()) {
      editor.commands.setContent(value, false);
    }
  }, [editor, value]);

  const charCount = editor?.storage.characterCount.characters?.() ?? 0;

  return (
    <div
      className={`rounded-2xl border p-3.5 focus-within:ring-2 focus-within:ring-arvdoul-purple transition-shadow ${
        isDark ? 'bg-[#03071B]/60 border-white/10' : 'bg-white/80 border-slate-200/80'
      }`}
    >
      <EditorContent editor={editor} />
      <div className="flex items-center justify-between pt-2 mt-1.5 border-t border-slate-200/60 dark:border-white/10 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
        <span>
          {charCount} / {maxLength}
        </span>
        <span>{Math.round((charCount / maxLength) * 100)}%</span>
      </div>
    </div>
  );
});

// ── MAIN COMPONENT ───────────────────────────────────────────────────────────
export default function CreateVideo() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { state, dispatch } = useCreatePostState();
  const { saveDraft, isDark, isOffline, services, autoSaveStatus, lastSavedAt } =
    useCreatePostServices();
  const fileInputRef = useRef(null);

  const mediaItems = useMemo(() => state?.mediaItems ?? [], [state?.mediaItems]);
  const [selectedId, setSelectedId] = useState(null);

  const createdBlobUrlsRef = useRef(new Set());
  const uploadControllersRef = useRef(new Map());
  const sessionUploadedPathsRef = useRef(new Set());
  const thumbInFlightRef = useRef(new Set());

  const resolveLiveUid = useCallback(() => {
    try {
      const authService = getAuthService();
      const live = authService?.getCurrentUser?.() || authService?.auth?.currentUser || null;
      return live?.uid || user?.uid || null;
    } catch {
      return user?.uid || null;
    }
  }, [user?.uid]);

  // Keep READY state aligned
  useEffect(() => {
    const ready = mediaItems.length > 0 || (state.content || '').trim().length > 0;
    dispatch({ type: 'SET_CONTENT_READY', payload: ready });
  }, [mediaItems.length, state.content, dispatch]);

  // Extract metadata thumbnail for newly added videos without duplicating blobs
  useEffect(() => {
    let cancelled = false;
    const generateThumbs = async () => {
      for (const media of mediaItems) {
        if (
          media.file &&
          !media.thumbnailUrl &&
          !media.thumbnail &&
          media.type === 'video' &&
          !thumbInFlightRef.current.has(media.id)
        ) {
          thumbInFlightRef.current.add(media.id);
          try {
            const [thumbBlob, duration] = await Promise.all([
              generateVideoThumbnailBlob(media.file),
              media.duration ? Promise.resolve(media.duration) : readVideoDuration(media.file),
            ]);
            if (cancelled) return;
            const thumbUrl = thumbBlob ? URL.createObjectURL(thumbBlob) : null;
            if (thumbUrl) createdBlobUrlsRef.current.add(thumbUrl);
            dispatch({
              type: 'UPDATE_MEDIA_ITEM',
              payload: {
                id: media.id,
                updates: {
                  thumbnailUrl: thumbUrl || media.thumbnailUrl || null,
                  duration: duration || media.duration || 0,
                },
              },
            });
          } catch (err) {
            console.warn('[CreateVideo] Thumbnail extraction failed:', err?.message);
          } finally {
            thumbInFlightRef.current.delete(media.id);
          }
        }
      }
    };
    generateThumbs();
    return () => {
      cancelled = true;
    };
  }, [mediaItems, dispatch]);

  // Keep selectedId synchronized
  useEffect(() => {
    if (mediaItems.length > 0 && (!selectedId || !mediaItems.some((m) => m.id === selectedId))) {
      setSelectedId(mediaItems[0].id);
    } else if (mediaItems.length === 0 && selectedId !== null) {
      setSelectedId(null);
    }
  }, [mediaItems, selectedId]);

  const handleFiles = useCallback(
    async (files) => {
      const remaining = MAX_VIDEOS - mediaItems.length;
      if (remaining <= 0) {
        toast.error(`Maximum ${MAX_VIDEOS} video per post`);
        return;
      }

      const uploaderUid = resolveLiveUid();
      if (!uploaderUid) {
        toast.error('You must be signed in to upload videos');
        return;
      }

      const newItems = [];
      const fileArray = Array.from(files || []).slice(0, remaining);

      for (const file of fileArray) {
        if (!file.type.startsWith('video/')) continue;
        if (file.size > MAX_FILE_SIZE_BYTES) {
          toast.error(`${file.name} exceeds ${MEDIA_LIMITS.maxFileSizeMB}MB`);
          continue;
        }
        const preview = URL.createObjectURL(file);
        createdBlobUrlsRef.current.add(preview);
        const duration = await readVideoDuration(file);
        newItems.push({
          id: uuidv4(),
          file,
          preview,
          thumbnailUrl: null,
          duration,
          type: 'video',
          name: file.name,
          size: file.size,
          progress: 0,
          error: null,
        });
      }

      if (newItems.length === 0) return;
      dispatch({ type: 'ADD_MEDIA_ITEMS', payload: newItems });
      if (!selectedId) setSelectedId(newItems[0].id);

      for (const item of newItems) {
        const controller = new AbortController();
        uploadControllersRef.current.set(item.id, controller);
        try {
          const res = await uploadSingleMediaAsset({
            file: item.file,
            folder: 'videos',
            uid: uploaderUid,
            signal: controller.signal,
            maxSize: MAX_FILE_SIZE_BYTES,
            storageService: services?.storage,
            onProgress: (percent) => {
              dispatch({
                type: 'UPDATE_MEDIA_PROGRESS',
                payload: { id: item.id, updates: { progress: percent } },
              });
            },
          });
          if (res.storagePath) {
            sessionUploadedPathsRef.current.add(res.storagePath);
          }
          dispatch({
            type: 'UPDATE_MEDIA_ITEM',
            payload: {
              id: item.id,
              updates: {
                url: res.downloadURL,
                storagePath: res.storagePath,
                progress: 100,
                error: null,
              },
            },
          });
        } catch (err) {
          if (err?.name === 'AbortError' || controller.signal.aborted) continue;
          toast.error(`Failed to upload ${item.name}`);
          dispatch({
            type: 'UPDATE_MEDIA_PROGRESS',
            payload: { id: item.id, updates: { error: err?.message || 'Upload failed' } },
          });
        } finally {
          uploadControllersRef.current.delete(item.id);
        }
      }
    },
    [mediaItems.length, resolveLiveUid, dispatch, selectedId, services?.storage]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: handleFiles,
    accept: { 'video/*': ['.mp4', '.mov', '.webm', '.avi', '.mkv'] },
    multiple: false,
    noClick: true,
    noKeyboard: true,
    maxFiles: MAX_VIDEOS,
    disabled: mediaItems.length >= MAX_VIDEOS,
  });

  const handleFileInputChange = useCallback(
    (e) => {
      handleFiles(e.target.files);
      e.target.value = '';
    },
    [handleFiles]
  );

  const removeMedia = useCallback(
    (id) => {
      const idx = mediaItems.findIndex((m) => m.id === id);
      if (idx === -1) return;
      const media = mediaItems[idx];

      const controller = uploadControllersRef.current.get(id);
      if (controller) {
        controller.abort();
        uploadControllersRef.current.delete(id);
      }

      if (media?.preview && media.preview.startsWith('blob:')) {
        URL.revokeObjectURL(media.preview);
        createdBlobUrlsRef.current.delete(media.preview);
      }
      if (media?.thumbnailUrl && media.thumbnailUrl.startsWith('blob:')) {
        URL.revokeObjectURL(media.thumbnailUrl);
        createdBlobUrlsRef.current.delete(media.thumbnailUrl);
      }

      const pathCandidate = media?.storagePath || extractStoragePathFromUrl(media?.url);
      if (pathCandidate && sessionUploadedPathsRef.current.has(pathCandidate)) {
        sessionUploadedPathsRef.current.delete(pathCandidate);
        deleteUploadedStorageAsset(services?.storage, pathCandidate);
      }

      dispatch({ type: 'REMOVE_MEDIA_ITEM', payload: idx });
      if (id === selectedId) {
        const remainingItems = mediaItems.filter((m) => m.id !== id);
        setSelectedId(remainingItems[Math.min(idx, remainingItems.length - 1)]?.id || null);
      }
    },
    [mediaItems, services?.storage, dispatch, selectedId]
  );

  const handleReorder = useCallback(
    (from, to) => dispatch({ type: 'REORDER_MEDIA', payload: { from, to } }),
    [dispatch]
  );

  const handleEdit = useCallback(
    (media) => {
      navigate('/video-editor', {
        state: {
          videoFile: media?.file,
          videoUrl: media?.preview || media?.url,
          title: media?.name || 'Video Clip',
        },
      });
    },
    [navigate]
  );

  const handleCaptionChange = useCallback(
    (json, text) => {
      dispatch({ type: 'SET_CONTENT_JSON', payload: json });
      dispatch({ type: 'SET_CONTENT', payload: text });
    },
    [dispatch]
  );

  // Abort active uploads and revoke owned blob URLs on unmount only
  useEffect(() => {
    const controllers = uploadControllersRef.current;
    const blobUrls = createdBlobUrlsRef.current;
    return () => {
      for (const c of controllers.values()) {
        c.abort();
      }
      controllers.clear();
      for (const url of blobUrls) {
        URL.revokeObjectURL(url);
      }
      blobUrls.clear();
    };
  }, []);

  // Keyboard delete shortcut guarded against typing in inputs/editor
  useEffect(() => {
    const handler = (e) => {
      const tag = e.target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || e.target?.isContentEditable) {
        return;
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedId && mediaItems.length > 0) {
        e.preventDefault();
        removeMedia(selectedId);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [selectedId, mediaItems.length, removeMedia]);

  const hasMedia = mediaItems.length > 0;
  const activeMedia = selectedId ? mediaItems.find((m) => m.id === selectedId) : mediaItems[0];

  return (
    <div className="max-w-3xl mx-auto w-full py-4 space-y-4">
      {/* Studio Subheader */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold tracking-tight text-slate-900 dark:text-white">
            Video Studio
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
            {hasMedia ? `${mediaItems.length} / ${MAX_VIDEOS} clip ready` : `Upload up to ${MEDIA_LIMITS.maxFileSizeMB}MB video`}
          </p>
        </div>

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

      {isOffline && (
        <div className="rounded-xl px-3.5 py-2.5 border border-amber-500/35 bg-amber-500/10 text-amber-700 dark:text-amber-300 text-xs flex items-center gap-2">
          <Icons.WifiOff className="w-4 h-4 shrink-0" />
          <span>You are offline. Video uploads require an active internet connection.</span>
        </div>
      )}

      {/* Drop Zone / Video Surface */}
      <div
        {...getRootProps()}
        className={`${SURFACE_GLASS_CLASS} p-4 sm:p-5 space-y-4 ${
          isDragActive ? 'ring-2 ring-arvdoul-purple' : ''
        }`}
      >
        <input aria-label="Drop video file" {...getInputProps()} />
        {!hasMedia ? (
          <EmptyState onUpload={() => fileInputRef.current?.click()} />
        ) : (
          <>
            <div className="relative w-full aspect-video rounded-2xl overflow-hidden bg-black border border-white/10">
              {activeMedia && (
                <video
                  src={activeMedia.preview || activeMedia.url}
                  controls
                  className="w-full h-full object-contain"
                  poster={activeMedia.thumbnailUrl || activeMedia.thumbnail || undefined}
                />
              )}
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => handleEdit(activeMedia)}
                className="min-h-[40px] px-3.5 py-1.5 text-xs font-semibold rounded-xl border border-slate-200 dark:border-white/12 bg-white/80 dark:bg-[#080F2E]/80 text-slate-800 dark:text-slate-100 hover:bg-white dark:hover:bg-white/10 transition-colors flex items-center gap-1.5 focus-visible:ring-2 focus-visible:ring-arvdoul-purple"
              >
                <Icons.Scissors className="w-3.5 h-3.5 text-arvdoul-purple" />
                <span>Open in Studio Editor</span>
              </button>
              <button
                type="button"
                onClick={() => navigate('/thumbnail-designer')}
                className="min-h-[40px] px-3.5 py-1.5 text-xs font-semibold rounded-xl border border-slate-200 dark:border-white/12 bg-white/80 dark:bg-[#080F2E]/80 text-slate-800 dark:text-slate-100 hover:bg-white dark:hover:bg-white/10 transition-colors flex items-center gap-1.5 focus-visible:ring-2 focus-visible:ring-arvdoul-purple"
              >
                <Icons.Palette className="w-3.5 h-3.5 text-arvdoul-blue" />
                <span>Design Thumbnail</span>
              </button>
            </div>

            <Filmstrip
              items={mediaItems}
              selectedId={selectedId}
              onSelect={setSelectedId}
              onRemove={removeMedia}
              onEdit={handleEdit}
              onReorder={handleReorder}
              onAddVideo={() => fileInputRef.current?.click()}
              isDark={isDark}
            />

            <CaptionComposer
              value={state.contentJSON || state.content || ''}
              onChange={handleCaptionChange}
              maxLength={MAX_CAPTION_LENGTH}
              isDark={isDark}
            />
          </>
        )}

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

      <input
        ref={fileInputRef}
        id="video-studio-file-input"
        type="file"
        accept="video/*"
        className="hidden"
        onChange={handleFileInputChange}
      />
    </div>
  );
}