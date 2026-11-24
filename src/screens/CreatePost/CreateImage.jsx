// src/screens/CreatePost/CreateImage.jsx
import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
  useMemo,
  lazy,
  Suspense,
} from 'react';
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, useSortable, horizontalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import * as Icons from 'lucide-react';
import LoadingSpinner from '../../components/Shared/LoadingSpinner';
import { TopAppLoadingBanner } from '../../components/Navigation/RouteProgressBar.jsx';
import { LazyImage } from '../../components/Shared/LazyImage';
import { useAuth } from '../../context/AuthContext';
import { getAuthService } from '../../services/authService';
import { getStorageService } from '../../services/storageService';
import { BRAND_GRADIENT, brandRgba, tokens } from '../../design-system/tokens.js';
import { useCreatePostState, useCreatePostServices } from './CreatePostContext.jsx';
import { MEDIA_LIMITS, SURFACE_GLASS_CLASS } from './createPostConstants.js';
import {
  enqueueMediaUpload,
  listMediaUploadsForOwner,
  removeMediaUpload,
} from './createPostStorage.js';
import {
  deleteUploadedStorageAsset,
  extractStoragePathFromUrl,
} from './postMediaPipeline.js';

const ImageEditor = lazy(() => import('./ImageEditor'));
const Collage = lazy(() => import('../../components/Shared/Collage'));

const MAX_IMAGES = MEDIA_LIMITS.maxImages;
const MAX_IMAGE_SIZE_BYTES = MEDIA_LIMITS.maxImageSizeMB * 1024 * 1024;
const MAX_CAPTION_LENGTH = 2200;
const UPLOAD_CONCURRENCY = 3;
const MAX_RETRIES = 3;
const UPLOAD_TIMEOUT_MS = 30000;

const UPLOAD_STATES = {
  IDLE: 'idle',
  PREPARING: 'preparing',
  QUEUED: 'queued',
  UPLOADING: 'uploading',
  RETRYING: 'retrying',
  VERIFYING: 'verifying',
  COMPLETE: 'complete',
  ERROR: 'error',
  CANCELLED: 'cancelled',
  EDITED: 'edited',
};

function generateUUID() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  const arr = new Uint8Array(16);
  crypto.getRandomValues(arr);
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = arr[Math.floor(Math.random() * 16)] % 16;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

function isMediaUploading(state) {
  return [
    UPLOAD_STATES.UPLOADING,
    UPLOAD_STATES.QUEUED,
    UPLOAD_STATES.PREPARING,
    UPLOAD_STATES.RETRYING,
    UPLOAD_STATES.VERIFYING,
  ].includes(state);
}

function isMediaReady(m) {
  if ([UPLOAD_STATES.COMPLETE, UPLOAD_STATES.EDITED].includes(m.state)) return true;
  return typeof m.url === 'string' && m.url.startsWith('http') && !m.error;
}

// ─── UPLOAD MANAGER ──────────────────────────────────────────────────────────
class UploadManager {
  constructor(options = {}) {
    this.concurrency = options.concurrency || UPLOAD_CONCURRENCY;
    this.maxRetries = options.maxRetries || MAX_RETRIES;
    this.storage = options.storage || getStorageService();
    this.resolveUid = options.resolveUid || null;
    this.onStateChange = options.onStateChange || null;
    this.onComplete = options.onComplete || null;
    this.onError = options.onError || null;

    this.queue = [];
    this.active = new Map();
    this.completed = new Set();
    this.failed = new Set();
    this.cancelled = new Set();
    this.isProcessing = false;
    this._abortControllers = new Map();
    this._processingSet = new Set();
    this._retryTimers = new Map();
    this._destroyed = false;
  }

  enqueue(items) {
    if (this._destroyed) return;
    const newItems = items.filter(
      (item) =>
        item.file &&
        !isMediaReady(item) &&
        ![UPLOAD_STATES.CANCELLED, UPLOAD_STATES.UPLOADING].includes(item.state) &&
        !this._processingSet.has(item.id)
    );
    if (newItems.length === 0) return;
    const existingIds = new Set(this.queue.map((i) => i.id));
    const unique = newItems.filter((item) => !existingIds.has(item.id));
    this.queue.push(...unique);
    unique.forEach((item) => this._processingSet.add(item.id));
    this._process();
  }

  async _process() {
    if (this._destroyed || this.isProcessing) return;
    this.isProcessing = true;

    while (!this._destroyed && this.queue.length > 0 && this.active.size < this.concurrency) {
      const item = this.queue.shift();
      if (!item) continue;
      if (this.completed.has(item.id) || this.failed.has(item.id) || this.cancelled.has(item.id)) {
        this._processingSet.delete(item.id);
        continue;
      }
      if (this.active.has(item.id)) continue;

      this.active.set(item.id, { item, _lastProgress: 0 });
      this._uploadItem(item);
    }

    this.isProcessing = false;
  }

  async _uploadItem(item) {
    const controller = new AbortController();
    this._abortControllers.set(item.id, controller);

    let uploadTimeout = null;
    let fallbackTimeout = null;
    let timedOut = false;

    try {
      const authService = getAuthService();
      const auth = await authService.initialize().catch(() => null);
      const currentUid =
        auth?.currentUser?.uid ||
        authService?.getCurrentUser?.()?.uid ||
        authService?.auth?.currentUser?.uid ||
        this.resolveUid?.();

      if (!currentUid) {
        throw new Error('Please sign in to upload images');
      }

      if (controller.signal.aborted || this._destroyed) {
        throw new DOMException('Upload cancelled', 'AbortError');
      }

      this._updateState(item.id, UPLOAD_STATES.PREPARING, 0);
      this._updateState(item.id, UPLOAD_STATES.UPLOADING, 2);

      fallbackTimeout = setTimeout(() => {
        if (!controller.signal.aborted && !this._destroyed) {
          this._updateState(item.id, UPLOAD_STATES.UPLOADING, -1);
        }
      }, 900);

      const safeName = String(item.file.name || 'image.jpg').replace(/[^\w.-]/g, '_');
      const path = `posts/${currentUid}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}_${safeName}`;

      const timeoutPromise = new Promise((_, reject) => {
        uploadTimeout = setTimeout(() => {
          timedOut = true;
          controller.abort();
          reject(new Error('Upload timed out after 30 seconds'));
        }, UPLOAD_TIMEOUT_MS);
      });

      const storagePromise = this.storage.uploadFileWithProgress(item.file, path, {
        onProgress: (progressData) => {
          if (controller.signal.aborted || this._destroyed) return;
          const pct = Math.round(progressData?.progress ?? progressData?.percent ?? 0);
          const mapped = Math.min(95, pct);
          clearTimeout(fallbackTimeout);
          const current = this.active.get(item.id)?._lastProgress ?? 0;
          if (mapped > current || mapped === 100) {
            this._updateState(item.id, UPLOAD_STATES.UPLOADING, mapped);
          }
        },
        signal: controller.signal,
        userId: currentUid,
        maxSize: MAX_IMAGE_SIZE_BYTES,
        metadata: { source: 'CreateImage' },
      });

      const result = await Promise.race([storagePromise, timeoutPromise]);

      if (controller.signal.aborted || this._destroyed) {
        throw new DOMException('Upload cancelled', 'AbortError');
      }

      this._updateState(item.id, UPLOAD_STATES.VERIFYING, 96);
      this._updateState(item.id, UPLOAD_STATES.COMPLETE, 100);
      this.completed.add(item.id);
      this.active.delete(item.id);
      this._abortControllers.delete(item.id);
      this._processingSet.delete(item.id);

      this.onComplete?.(item.id, {
        url: result.downloadURL,
        storagePath: result.path || path,
      });
    } catch (error) {
      if ((error?.name === 'AbortError' || controller.signal.aborted) && !timedOut) {
        this._updateState(item.id, UPLOAD_STATES.CANCELLED, 0);
        this.cancelled.add(item.id);
        this.active.delete(item.id);
        this._abortControllers.delete(item.id);
        this._processingSet.delete(item.id);
        return;
      }

      const errorMap = {
        'storage/unauthorized': "You don't have permission to upload. Please sign in again.",
        'storage/quota-exceeded': 'Storage quota exceeded. Please free up space.',
        'storage/unauthenticated': 'Please sign in to upload.',
        'storage/canceled': 'Upload was cancelled.',
        'storage/retry-limit-exceeded': 'Upload failed after multiple attempts.',
        'storage/unknown': 'An unknown error occurred. Please try again.',
        'Upload timed out after 30 seconds': 'Upload timed out. Please check your connection.',
      };
      const userMessage = errorMap[error?.code] || errorMap[error?.message] || error?.message || 'Upload failed';

      const retryCount = (item.retryCount || 0) + 1;
      if (retryCount <= this.maxRetries && !this._destroyed && error?.message !== 'Please sign in to upload images') {
        this._updateState(item.id, UPLOAD_STATES.RETRYING, 0);
        const delay = Math.min(1000 * Math.pow(2, retryCount), 16000);
        const retryTimer = setTimeout(() => {
          this._retryTimers.delete(item.id);
          if (this._destroyed || this.cancelled.has(item.id)) return;
          this.active.delete(item.id);
          this._abortControllers.delete(item.id);
          item.retryCount = retryCount;
          this.queue.unshift(item);
          this._process();
        }, delay);
        this._retryTimers.set(item.id, retryTimer);
      } else {
        this._updateState(item.id, UPLOAD_STATES.ERROR, 0);
        this.failed.add(item.id);
        this.active.delete(item.id);
        this._abortControllers.delete(item.id);
        this._processingSet.delete(item.id);
        this.onError?.(item.id, new Error(userMessage));
        toast.error(userMessage);
      }
    } finally {
      clearTimeout(uploadTimeout);
      clearTimeout(fallbackTimeout);
      this._process();
    }
  }

  _updateState(id, state, progress) {
    if (this._destroyed) return;
    this.onStateChange?.(id, { state, progress });
    const entry = this.active.get(id);
    if (entry) {
      entry._lastProgress = progress;
    }
  }

  reset(id) {
    this.failed.delete(id);
    this.cancelled.delete(id);
    this.completed.delete(id);
    this._processingSet.delete(id);
    this.active.delete(id);
    const retryTimer = this._retryTimers.get(id);
    if (retryTimer) {
      clearTimeout(retryTimer);
      this._retryTimers.delete(id);
    }
    const idx = this.queue.findIndex((i) => i.id === id);
    if (idx !== -1) this.queue.splice(idx, 1);
    const controller = this._abortControllers.get(id);
    if (controller) {
      controller.abort();
      this._abortControllers.delete(id);
    }
  }

  cancel(id) {
    this.cancelled.add(id);
    const retryTimer = this._retryTimers.get(id);
    if (retryTimer) {
      clearTimeout(retryTimer);
      this._retryTimers.delete(id);
    }
    const controller = this._abortControllers.get(id);
    if (controller) {
      controller.abort();
      this._abortControllers.delete(id);
    }
    this.active.delete(id);
    const idx = this.queue.findIndex((i) => i.id === id);
    if (idx !== -1) this.queue.splice(idx, 1);
    this._processingSet.delete(id);
    this._updateState(id, UPLOAD_STATES.CANCELLED, 0);
  }

  cancelAll() {
    for (const timer of this._retryTimers.values()) {
      clearTimeout(timer);
    }
    this._retryTimers.clear();
    for (const controller of this._abortControllers.values()) {
      controller.abort();
    }
    this._abortControllers.clear();
    this.active.clear();
    this.queue = [];
    this.isProcessing = false;
    this._processingSet.clear();
  }

  destroy() {
    this._destroyed = true;
    this.cancelAll();
  }
}

function useUploadManager(options = {}) {
  const callbacksRef = useRef(options);
  callbacksRef.current = options;

  const managerRef = useRef(null);
  if (!managerRef.current) {
    managerRef.current = new UploadManager({
      storage: options.storage,
      resolveUid: () => callbacksRef.current.resolveUid?.(),
      onStateChange: (id, data) => callbacksRef.current.onStateChange?.(id, data),
      onComplete: (id, data) => callbacksRef.current.onComplete?.(id, data),
      onError: (id, error) => callbacksRef.current.onError?.(id, error),
    });
  }

  useEffect(() => {
    return () => {
      managerRef.current?.destroy();
    };
  }, []);

  return { uploadManager: managerRef.current };
}

// ─── HERO PREVIEW ────────────────────────────────────────────────────────────
const HeroPreview = React.memo(({ items, selectedId, onSelect, onExpand, onDelete, onEdit, isDark }) => {
  const total = items.length;
  const currentIndex = Math.max(0, items.findIndex((i) => i.id === selectedId));
  const item = items[currentIndex] || items[0] || null;

  const src = item?.preview || item?.url || '';
  const state = item?.state || UPLOAD_STATES.IDLE;
  const progress = item?.progress || 0;
  const isUploading = isMediaUploading(state);
  const isComplete = isMediaReady(item || {});
  const isError = state === UPLOAD_STATES.ERROR;

  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0, posX: 0, posY: 0 });
  const touchStart = useRef({ x: 0, y: 0, dist: 0 });

  useEffect(() => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  }, [selectedId]);

  const handleWheel = useCallback((e) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      setScale((s) => Math.min(4, Math.max(0.8, s * delta)));
    }
  }, []);

  const handleMouseDown = useCallback(
    (e) => {
      if (scale <= 1) return;
      setIsDragging(true);
      dragStart.current = { x: e.clientX, y: e.clientY, posX: position.x, posY: position.y };
      e.preventDefault();
    },
    [scale, position]
  );

  const handleMouseMove = useCallback(
    (e) => {
      if (!isDragging) return;
      const dx = e.clientX - dragStart.current.x;
      const dy = e.clientY - dragStart.current.y;
      setPosition({ x: dragStart.current.posX + dx, y: dragStart.current.posY + dy });
    },
    [isDragging]
  );

  const handleMouseUp = useCallback(() => setIsDragging(false), []);

  const handleTouchStart = useCallback((e) => {
    if (e.touches.length === 1) {
      const t = e.touches[0];
      touchStart.current = { x: t.clientX, y: t.clientY, dist: 0 };
    } else if (e.touches.length === 2) {
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      touchStart.current.dist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
    }
  }, []);

  const handleTouchMove = useCallback(
    (e) => {
      if (e.touches.length === 1) {
        const t = e.touches[0];
        const dx = t.clientX - touchStart.current.x;
        const dy = t.clientY - touchStart.current.y;
        if (Math.abs(dx) > 5 || Math.abs(dy) > 5) setIsDragging(true);

        if (scale > 1) {
          setPosition((p) => ({ x: p.x + dx, y: p.y + dy }));
        } else if (Math.abs(dx) > 50 && Math.abs(dy) < 80) {
          const dir = dx > 0 ? -1 : 1;
          const nextIdx = currentIndex + dir;
          if (nextIdx >= 0 && nextIdx < total) {
            onSelect(items[nextIdx].id);
            touchStart.current.x = t.clientX;
            touchStart.current.y = t.clientY;
          }
        }
        touchStart.current.x = t.clientX;
        touchStart.current.y = t.clientY;
      } else if (e.touches.length === 2) {
        const t1 = e.touches[0];
        const t2 = e.touches[1];
        const dist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
        if (touchStart.current.dist > 0) {
          const delta = dist / touchStart.current.dist;
          setScale((s) => Math.min(4, Math.max(0.8, s * delta)));
        }
        touchStart.current.dist = dist;
      }
    },
    [currentIndex, items, onSelect, scale, total]
  );

  const handleTouchEnd = useCallback(() => {
    if (scale === 1) setPosition({ x: 0, y: 0 });
    setIsDragging(false);
  }, [scale]);

  const handleDoubleClick = useCallback(() => {
    setScale((s) => (s > 1 ? 1 : 2.5));
    setPosition({ x: 0, y: 0 });
  }, []);

  useEffect(() => {
    if (!isDragging) return;
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, handleMouseMove, handleMouseUp]);

  if (!item) return null;

  return (
    <div
      className={`relative w-full aspect-square sm:aspect-[4/5] rounded-2xl overflow-hidden touch-none select-none max-h-[75vh] border ${
        isDark ? 'bg-[#03071B] border-white/10' : 'bg-slate-100 border-slate-200/80'
      }`}
    >
      <div
        className="absolute inset-0"
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onDoubleClick={handleDoubleClick}
      >
        {src ? (
          <div
            className="w-full h-full flex items-center justify-center"
            style={{
              transform: `scale(${scale}) translate(${position.x / scale}px, ${position.y / scale}px)`,
              transition: isDragging ? 'none' : 'transform 0.12s ease-out',
            }}
          >
            <LazyImage
              src={src}
              alt={item.alt || item.name || 'Selected image preview'}
              className="w-full h-full object-cover"
              draggable={false}
            />
          </div>
        ) : (
          <div className="flex items-center justify-center h-full text-slate-400 flex-col gap-2">
            <Icons.Image className="w-12 h-12 opacity-40" />
            <span className="text-sm">No image preview</span>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-black/15 pointer-events-none" />
      </div>

      {/* Top status bar */}
      <div className="absolute top-3 left-3 right-3 flex items-center justify-between gap-2 z-10 pointer-events-none">
        <div className="bg-black/60 backdrop-blur-md text-white text-xs px-3 py-1.5 rounded-xl flex items-center gap-1.5 border border-white/15 tabular-nums">
          <Icons.Image className="w-3.5 h-3.5" />
          <span className="font-semibold">{currentIndex + 1}</span>
          <span className="opacity-50">/</span>
          <span className="opacity-85">{total}</span>
        </div>

        <div className="flex items-center gap-1.5">
          {isUploading && (
            <div className="bg-amber-500/90 text-white text-xs px-2.5 py-1 rounded-xl flex items-center gap-1.5 backdrop-blur-sm border border-white/20 tabular-nums">
              <LoadingSpinner size="xs" color="white" />
              <span>{progress >= 0 ? `${Math.round(progress)}%` : 'Uploading'}</span>
            </div>
          )}
          {isComplete && !isUploading && (
            <div className="bg-emerald-600/90 text-white text-xs px-2.5 py-1 rounded-xl flex items-center gap-1 backdrop-blur-sm border border-white/20">
              <Icons.CheckCircle2 className="w-3.5 h-3.5" />
              <span>Ready</span>
            </div>
          )}
          {isError && (
            <div className="bg-rose-600/90 text-white text-xs px-2.5 py-1 rounded-xl flex items-center gap-1 backdrop-blur-sm border border-white/20">
              <Icons.AlertCircle className="w-3.5 h-3.5" />
              <span>Failed</span>
            </div>
          )}
          {item.edited && isComplete && (
            <div className="bg-black/65 text-white text-xs px-2.5 py-1 rounded-xl flex items-center gap-1 backdrop-blur-sm border border-white/20">
              <Icons.Sliders className="w-3 h-3" />
              <span>Edited</span>
            </div>
          )}
        </div>
      </div>

      {/* Previous / Next slide controls */}
      {total > 1 && (
        <>
          <button
            type="button"
            onClick={() => {
              const idx = currentIndex - 1;
              if (idx >= 0) onSelect(items[idx].id);
            }}
            disabled={currentIndex === 0}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center absolute left-3 top-1/2 -translate-y-1/2 bg-black/60 hover:bg-black/80 text-white rounded-full transition-opacity disabled:opacity-30 backdrop-blur-md border border-white/15 z-20 focus-visible:ring-2 focus-visible:ring-arvdoul-purple"
            aria-label="Previous image"
          >
            <Icons.ChevronLeft className="w-5 h-5" />
          </button>
          <button
            type="button"
            onClick={() => {
              const idx = currentIndex + 1;
              if (idx < total) onSelect(items[idx].id);
            }}
            disabled={currentIndex >= total - 1}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center absolute right-3 top-1/2 -translate-y-1/2 bg-black/60 hover:bg-black/80 text-white rounded-full transition-opacity disabled:opacity-30 backdrop-blur-md border border-white/15 z-20 focus-visible:ring-2 focus-visible:ring-arvdoul-purple"
            aria-label="Next image"
          >
            <Icons.ChevronRight className="w-5 h-5" />
          </button>
        </>
      )}

      {/* Floating action bar */}
      <div className="absolute bottom-14 left-1/2 -translate-x-1/2 flex items-center gap-1.5 bg-black/60 backdrop-blur-md rounded-2xl p-1.5 border border-white/15 z-20">
        <button
          type="button"
          onClick={() => onEdit?.(item)}
          className="min-h-[40px] px-3 text-white hover:bg-white/15 rounded-xl transition-colors flex items-center gap-1.5 text-xs font-medium focus-visible:ring-2 focus-visible:ring-arvdoul-purple"
          aria-label="Edit selected image"
        >
          <Icons.Edit3 className="w-4 h-4" />
          <span>Edit</span>
        </button>
        <button
          type="button"
          onClick={onExpand}
          className="min-h-[40px] min-w-[40px] flex items-center justify-center text-white hover:bg-white/15 rounded-xl transition-colors focus-visible:ring-2 focus-visible:ring-arvdoul-purple"
          aria-label="Open fullscreen preview"
        >
          <Icons.Maximize2 className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={onDelete}
          className="min-h-[40px] min-w-[40px] flex items-center justify-center text-rose-300 hover:text-rose-200 hover:bg-rose-500/20 rounded-xl transition-colors focus-visible:ring-2 focus-visible:ring-arvdoul-purple"
          aria-label="Remove selected image"
        >
          <Icons.Trash2 className="w-4 h-4" />
        </button>
      </div>

      {/* Pagination indicator bar */}
      {total > 1 && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-black/50 backdrop-blur-md rounded-full px-2 py-1 flex items-center gap-1 border border-white/15 z-20">
          {items.map((i, idx) => {
            const isActive = i.id === selectedId;
            return (
              <button
                key={i.id}
                type="button"
                onClick={() => onSelect(i.id)}
                className="min-w-[24px] min-h-[24px] flex items-center justify-center rounded-full focus-visible:ring-2 focus-visible:ring-arvdoul-purple"
                aria-label={`Select image ${idx + 1} of ${total}`}
                aria-pressed={isActive}
              >
                <span
                  className={`block rounded-full transition-all ${
                    isActive ? 'w-4 h-1.5 bg-white' : 'w-1.5 h-1.5 bg-white/45 hover:bg-white/75'
                  }`}
                />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
});

// ─── FILMSTRIP THUMBNAIL ─────────────────────────────────────────────────────
const Thumbnail = React.memo(
  ({ item, index, isSelected, onSelect, onRemove, onCancel, onRetry, isDark }) => {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
      id: item.id,
    });
    const style = {
      transform: CSS.Transform.toString(transform),
      transition,
      zIndex: isDragging ? 50 : undefined,
    };

    const src = item.preview || item.url || '';
    const state = item.state || UPLOAD_STATES.IDLE;
    const progress = item.progress || 0;
    const isUploading = isMediaUploading(state);
    const isError = state === UPLOAD_STATES.ERROR;
    const isCancelled = state === UPLOAD_STATES.CANCELLED;

    return (
      <div
        ref={setNodeRef}
        style={style}
        className={`relative flex-shrink-0 w-20 h-20 rounded-2xl overflow-hidden border transition-all group ${
          isSelected
            ? 'border-arvdoul-purple ring-2 ring-arvdoul-purple'
            : isDark
            ? 'border-white/15 hover:border-white/30'
            : 'border-slate-200 hover:border-slate-300'
        } ${isDark ? 'bg-[#03071B]' : 'bg-slate-100'}`}
      >
        <button
          type="button"
          onClick={onSelect}
          aria-pressed={isSelected}
          aria-label={`Select photo ${index + 1}${item.name ? `: ${item.name}` : ''}`}
          className="w-full h-full block focus-visible:ring-2 focus-visible:ring-arvdoul-purple focus:outline-none"
        >
          <LazyImage
            src={src || '/assets/placeholder.png'}
            alt={item.alt || item.name || `Photo ${index + 1}`}
            className="w-full h-full object-cover"
            draggable={false}
          />
        </button>

        {isUploading && (
          <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center pointer-events-none">
            <div className="relative w-8 h-8">
              <svg className="w-8 h-8 -rotate-90" aria-hidden="true">
                <circle
                  cx="16"
                  cy="16"
                  r="13"
                  fill="none"
                  stroke="rgba(255,255,255,0.3)"
                  strokeWidth="2.5"
                />
                <circle
                  cx="16"
                  cy="16"
                  r="13"
                  fill="none"
                  stroke={tokens.color.brand.violet}
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  style={{
                    strokeDasharray: 82,
                    strokeDashoffset: 82 - (82 * Math.max(0, progress)) / 100,
                    transition: 'stroke-dashoffset 0.25s ease',
                  }}
                />
              </svg>
              <LoadingSpinner size="xs" color="white" className="absolute inset-0 m-auto" />
            </div>
          </div>
        )}

        {isError && (
          <div className="absolute inset-0 bg-rose-950/80 flex flex-col items-center justify-center gap-0.5 p-1">
            <Icons.AlertCircle className="w-4 h-4 text-white" />
            <button
              type="button"
              onClick={onRetry}
              className="text-[10px] font-semibold text-white underline focus-visible:ring-2 focus-visible:ring-arvdoul-purple"
              aria-label={`Retry uploading ${item.name || 'image'}`}
            >
              Retry
            </button>
          </div>
        )}

        {isCancelled && (
          <div className="absolute inset-0 bg-slate-900/75 flex items-center justify-center pointer-events-none">
            <Icons.X className="w-5 h-5 text-white/70" />
          </div>
        )}

        <span className="absolute top-1.5 left-1.5 bg-black/75 text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center border border-white/15 tabular-nums pointer-events-none">
          {index + 1}
        </span>

        <button
          type="button"
          onClick={onRemove}
          className="absolute top-1 right-1 bg-black/75 hover:bg-rose-600 text-white w-7 h-7 rounded-full flex items-center justify-center transition-colors border border-white/15 focus-visible:ring-2 focus-visible:ring-arvdoul-purple"
          aria-label={`Remove photo ${index + 1}`}
        >
          <Icons.X className="w-3.5 h-3.5" />
        </button>

        {isUploading && (
          <button
            type="button"
            onClick={onCancel}
            className="absolute bottom-1 left-1/2 -translate-x-1/2 bg-black/80 hover:bg-rose-600 text-white text-[10px] font-medium px-2 py-0.5 rounded-full focus-visible:ring-2 focus-visible:ring-arvdoul-purple"
            aria-label={`Cancel upload for photo ${index + 1}`}
          >
            Cancel
          </button>
        )}

        <button
          type="button"
          {...attributes}
          {...listeners}
          aria-label={`Reorder photo ${index + 1}`}
          className="absolute bottom-1 right-1 w-6 h-6 rounded-full bg-black/65 text-white/85 flex items-center justify-center opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity cursor-grab active:cursor-grabbing"
        >
          <Icons.GripVertical className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }
);

// ─── FILMSTRIP ───────────────────────────────────────────────────────────────
const Filmstrip = React.memo(
  ({ items, selectedId, onSelect, onRemove, onCancel, onRetry, onReorder, onAddImage, isDark }) => {
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
          <div className="flex gap-2.5 overflow-x-auto pb-1.5 pt-0.5 scrollbar-thin">
            {items.map((item, idx) => (
              <Thumbnail
                key={item.id}
                item={item}
                index={idx}
                isSelected={item.id === selectedId}
                onSelect={() => onSelect(item.id)}
                onRemove={() => onRemove(item.id)}
                onCancel={() => onCancel?.(item.id)}
                onRetry={() => onRetry?.(item.id)}
                isDark={isDark}
              />
            ))}
            {items.length < MAX_IMAGES && (
              <button
                type="button"
                onClick={onAddImage}
                className={`flex-shrink-0 w-20 h-20 rounded-2xl border-2 border-dashed flex flex-col items-center justify-center gap-1 transition-colors focus-visible:ring-2 focus-visible:ring-arvdoul-purple ${
                  isDark
                    ? 'border-white/20 hover:border-arvdoul-purple bg-white/[0.03] text-slate-300'
                    : 'border-slate-300 hover:border-arvdoul-purple bg-slate-50 text-slate-600'
                }`}
                aria-label="Add more photos"
              >
                <Icons.Plus className="w-5 h-5 text-arvdoul-purple" />
                <span className="text-[11px] font-medium">Add</span>
              </button>
            )}
          </div>
        </SortableContext>
      </DndContext>
    );
  }
);

// ─── UPLOAD STATUS READOUT ───────────────────────────────────────────────────
const UploadStatusReadout = React.memo(({ items }) => {
  const total = items.length;
  if (total === 0) return <span>Ready</span>;

  const complete = items.filter((i) => isMediaReady(i)).length;
  const uploading = items.filter((i) => isMediaUploading(i.state)).length;
  const errors = items.filter((i) => i.state === UPLOAD_STATES.ERROR).length;

  if (uploading > 0) {
    return (
      <span className="text-amber-500 font-medium tabular-nums">
        Uploading {uploading} of {total}
      </span>
    );
  }
  if (errors > 0) {
    return (
      <span className="text-rose-500 font-medium tabular-nums">
        {errors} failed
      </span>
    );
  }
  if (complete === total) {
    return (
      <span className="text-emerald-500 font-medium tabular-nums">
        {total} ready
      </span>
    );
  }
  return (
    <span className="tabular-nums">
      {complete} / {total} uploaded
    </span>
  );
});

// ─── EMPTY STATE ─────────────────────────────────────────────────────────────
const EmptyState = React.memo(({ onUpload }) => (
  <div className="flex flex-col items-center justify-center py-14 px-4 gap-5 text-center">
    <div
      className="w-20 h-20 rounded-3xl flex items-center justify-center border border-white/15"
      style={{ background: brandRgba(0.12) }}
    >
      <Icons.Camera className="w-9 h-9 text-arvdoul-purple" />
    </div>
    <div className="space-y-1">
      <h3 className="text-lg font-bold text-slate-900 dark:text-white">Add your photos</h3>
      <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs">
        Select up to {MAX_IMAGES} high-resolution photos. Edit, crop, or combine them in a collage.
      </p>
    </div>
    <button
      type="button"
      onClick={onUpload}
      className="min-h-[44px] px-7 py-2.5 rounded-2xl text-white font-semibold text-sm flex items-center gap-2 shadow-lg hover:opacity-95 active:scale-[0.99] transition-all focus-visible:ring-2 focus-visible:ring-arvdoul-purple"
      style={{ background: BRAND_GRADIENT }}
    >
      <Icons.Upload className="w-4 h-4" />
      <span>Browse Images</span>
    </button>
    <p className="text-[11px] text-slate-500 dark:text-slate-400">
      JPEG, PNG, WebP · Up to {MEDIA_LIMITS.maxImageSizeMB}MB per file · Max {MAX_IMAGES}
    </p>
  </div>
));

// ─── CAPTION COMPOSER ────────────────────────────────────────────────────────
const CaptionComposer = React.memo(({ value, onChange, maxLength, isDark }) => {
  const textareaRef = useRef(null);

  const insertToken = useCallback(
    (token) => {
      const el = textareaRef.current;
      const current = value || '';
      const start = el?.selectionStart ?? current.length;
      const end = el?.selectionEnd ?? current.length;
      const next = `${current.slice(0, start)}${token}${current.slice(end)}`;
      if (next.length > maxLength) return;
      onChange({ target: { value: next } });
      requestAnimationFrame(() => {
        if (!el) return;
        el.focus();
        const caret = start + token.length;
        el.setSelectionRange(caret, caret);
      });
    },
    [value, maxLength, onChange]
  );

  return (
    <div
      className={`rounded-2xl border p-3.5 focus-within:ring-2 focus-within:ring-arvdoul-purple transition-shadow ${
        isDark ? 'bg-[#03071B]/60 border-white/10' : 'bg-white/80 border-slate-200/80'
      }`}
    >
      <textarea
        ref={textareaRef}
        aria-label="Photo caption"
        value={value}
        onChange={onChange}
        placeholder="Write a caption, add #hashtags or @mentions..."
        maxLength={maxLength}
        rows={3}
        className="w-full bg-transparent border-0 resize-none text-sm outline-none text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500"
      />
      <div className="flex items-center justify-between pt-2 border-t border-slate-200/60 dark:border-white/10 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => insertToken('#')}
            className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg hover:text-arvdoul-purple hover:bg-slate-100 dark:hover:bg-white/10 transition-colors focus-visible:ring-2 focus-visible:ring-arvdoul-purple"
            aria-label="Insert hashtag"
          >
            <Icons.Hash className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => insertToken('@')}
            className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg hover:text-arvdoul-purple hover:bg-slate-100 dark:hover:bg-white/10 transition-colors focus-visible:ring-2 focus-visible:ring-arvdoul-purple"
            aria-label="Mention user"
          >
            <Icons.AtSign className="w-4 h-4" />
          </button>
        </div>
        <span>
          {value.length} / {maxLength}
        </span>
      </div>
    </div>
  );
});

// ─── FULLSCREEN VIEWER ───────────────────────────────────────────────────────
const FullscreenViewer = React.memo(({ items, selectedId, onSelect, onClose, onDelete, onEdit }) => {
  const total = items.length;
  const currentIndex = Math.max(0, items.findIndex((i) => i.id === selectedId));
  const item = items[currentIndex] || items[0] || null;
  const src = item?.preview || item?.url || '';

  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0, posX: 0, posY: 0 });
  const touchStart = useRef({ x: 0, y: 0, dist: 0 });

  useEffect(() => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  }, [selectedId]);

  const handleWheel = useCallback((e) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      setScale((s) => Math.min(4, Math.max(0.8, s * delta)));
    }
  }, []);

  const handleMouseDown = useCallback(
    (e) => {
      if (scale <= 1) return;
      setIsDragging(true);
      dragStart.current = { x: e.clientX, y: e.clientY, posX: position.x, posY: position.y };
      e.preventDefault();
    },
    [scale, position]
  );

  const handleMouseMove = useCallback(
    (e) => {
      if (!isDragging) return;
      const dx = e.clientX - dragStart.current.x;
      const dy = e.clientY - dragStart.current.y;
      setPosition({ x: dragStart.current.posX + dx, y: dragStart.current.posY + dy });
    },
    [isDragging]
  );

  const handleMouseUp = useCallback(() => setIsDragging(false), []);

  const handleTouchStart = useCallback((e) => {
    if (e.touches.length === 1) {
      const t = e.touches[0];
      touchStart.current = { x: t.clientX, y: t.clientY, dist: 0 };
    } else if (e.touches.length === 2) {
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      touchStart.current.dist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
    }
  }, []);

  const handleTouchMove = useCallback(
    (e) => {
      if (e.touches.length === 2) {
        const t1 = e.touches[0];
        const t2 = e.touches[1];
        const dist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
        if (touchStart.current.dist > 0) {
          const delta = dist / touchStart.current.dist;
          setScale((s) => Math.min(4, Math.max(0.8, s * delta)));
        }
        touchStart.current.dist = dist;
      } else if (e.touches.length === 1 && scale > 1) {
        const t = e.touches[0];
        const dx = t.clientX - touchStart.current.x;
        const dy = t.clientY - touchStart.current.y;
        setPosition((p) => ({ x: p.x + dx, y: p.y + dy }));
        touchStart.current.x = t.clientX;
        touchStart.current.y = t.clientY;
      }
    },
    [scale]
  );

  useEffect(() => {
    if (!isDragging) return;
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, handleMouseMove, handleMouseUp]);

  if (!item) return null;

  return (
    <motion.div
      role="dialog"
      aria-modal="true"
      aria-label="Fullscreen photo preview"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[999] bg-black flex flex-col"
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
    >
      <div className="flex items-center justify-between p-4 bg-gradient-to-b from-black/70 to-transparent z-10">
        <button
          type="button"
          onClick={onClose}
          className="min-h-[44px] min-w-[44px] flex items-center justify-center bg-white/10 hover:bg-white/20 text-white rounded-full transition-colors backdrop-blur-md focus-visible:ring-2 focus-visible:ring-arvdoul-purple"
          aria-label="Close fullscreen preview"
        >
          <Icons.X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2">
          <span className="text-white/80 text-xs font-medium tabular-nums mr-1">
            {currentIndex + 1} / {total}
          </span>
          <button
            type="button"
            onClick={() => onEdit?.(item)}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center bg-white/10 hover:bg-white/20 text-white rounded-full transition-colors backdrop-blur-md focus-visible:ring-2 focus-visible:ring-arvdoul-purple"
            aria-label="Edit image"
          >
            <Icons.Edit3 className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => {
              onDelete();
              onClose();
            }}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center bg-rose-600/40 hover:bg-rose-600/70 text-white rounded-full transition-colors backdrop-blur-md focus-visible:ring-2 focus-visible:ring-arvdoul-purple"
            aria-label="Delete image"
          >
            <Icons.Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div
        className="flex-1 flex items-center justify-center overflow-hidden touch-none px-4"
        onDoubleClick={() => {
          setScale((s) => (s > 1 ? 1 : 2.2));
          setPosition({ x: 0, y: 0 });
        }}
      >
        <LazyImage
          src={src}
          alt={item.alt || item.name || 'Fullscreen image preview'}
          className="max-w-full max-h-[80vh] object-contain"
          style={{
            transform: `scale(${scale}) translate(${position.x / scale}px, ${position.y / scale}px)`,
            transition: isDragging ? 'none' : 'transform 0.12s ease-out',
          }}
          draggable={false}
        />
      </div>

      {total > 1 && (
        <div className="flex items-center justify-center gap-6 p-5 bg-gradient-to-t from-black/70 to-transparent z-10">
          <button
            type="button"
            onClick={() => {
              const idx = currentIndex - 1;
              if (idx >= 0) onSelect(items[idx].id);
            }}
            disabled={currentIndex === 0}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center bg-white/10 hover:bg-white/20 text-white rounded-full transition-colors backdrop-blur-md disabled:opacity-30 focus-visible:ring-2 focus-visible:ring-arvdoul-purple"
            aria-label="Previous image"
          >
            <Icons.ChevronLeft className="w-5 h-5" />
          </button>
          <button
            type="button"
            onClick={() => {
              const idx = currentIndex + 1;
              if (idx < total) onSelect(items[idx].id);
            }}
            disabled={currentIndex >= total - 1}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center bg-white/10 hover:bg-white/20 text-white rounded-full transition-colors backdrop-blur-md disabled:opacity-30 focus-visible:ring-2 focus-visible:ring-arvdoul-purple"
            aria-label="Next image"
          >
            <Icons.ChevronRight className="w-5 h-5" />
          </button>
        </div>
      )}
    </motion.div>
  );
});

// ─── MAIN COMPONENT ──────────────────────────────────────────────────────────
export default function CreateImage() {
  const { state, dispatch } = useCreatePostState();
  const { saveDraft, isDark, isOffline, dbRef, autoSaveStatus, lastSavedAt } =
    useCreatePostServices();
  const { user } = useAuth();
  const fileInputRef = useRef(null);
  const storage = useMemo(() => getStorageService(), []);

  const mediaItems = useMemo(() => state?.mediaItems ?? [], [state?.mediaItems]);
  const caption = state?.content ?? '';

  const [selectedId, setSelectedId] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [expandedPreview, setExpandedPreview] = useState(false);
  const [showCollage, setShowCollage] = useState(false);
  const [storageReady, setStorageReady] = useState(false);
  const [offlineQueueCount, setOfflineQueueCount] = useState(0);

  const objectUrlsRef = useRef([]);
  const offlineQueuedIdsRef = useRef(new Set());
  const sessionUploadedPathsRef = useRef(new Set());
  const mediaItemsRef = useRef(mediaItems);
  mediaItemsRef.current = mediaItems;

  const resolveLiveUid = useCallback(() => {
    try {
      const authService = getAuthService();
      const live =
        authService?.getCurrentUser?.() ||
        authService?.auth?.currentUser ||
        null;
      return live?.uid || user?.uid || null;
    } catch {
      return user?.uid || null;
    }
  }, [user?.uid]);

  const activeUid = resolveLiveUid();

  // Keep READY state synced when photos exist or caption has text
  useEffect(() => {
    const ready = mediaItems.length > 0 || caption.trim().length > 0;
    dispatch({ type: 'SET_CONTENT_READY', payload: ready });
  }, [mediaItems.length, caption, dispatch]);

  // ─── Upload Manager Callbacks ─────────────────────────────────────────────
  // Progress transitions dispatch UPDATE_MEDIA_PROGRESS so undo history & isDirty stay clean.
  const handleStateChange = useCallback(
    (id, data) => {
      dispatch({
        type: 'UPDATE_MEDIA_PROGRESS',
        payload: { id, updates: { state: data.state, progress: data.progress } },
      });
    },
    [dispatch]
  );

  const handleComplete = useCallback(
    (id, data) => {
      if (data?.storagePath) {
        sessionUploadedPathsRef.current.add(data.storagePath);
      }
      dispatch({
        type: 'UPDATE_MEDIA_ITEM',
        payload: {
          id,
          updates: {
            state: UPLOAD_STATES.COMPLETE,
            url: data.url,
            storagePath: data.storagePath || null,
            progress: 100,
            error: null,
          },
        },
      });
    },
    [dispatch]
  );

  const handleError = useCallback(
    (id, error) => {
      dispatch({
        type: 'UPDATE_MEDIA_PROGRESS',
        payload: { id, updates: { state: UPLOAD_STATES.ERROR, error: error.message } },
      });
    },
    [dispatch]
  );

  const { uploadManager } = useUploadManager({
    storage,
    resolveUid: resolveLiveUid,
    onStateChange: handleStateChange,
    onComplete: handleComplete,
    onError: handleError,
  });

  // Reset per-user offline markers cleanly when account switches
  useEffect(() => {
    offlineQueuedIdsRef.current.clear();
    setOfflineQueueCount(0);
    if (!activeUid) {
      uploadManager.cancelAll();
    }
  }, [activeUid, uploadManager]);

  // Initialize Storage service
  useEffect(() => {
    let cancelled = false;
    const initStorage = async () => {
      try {
        await storage.initialize();
        if (!cancelled) setStorageReady(true);
      } catch (err) {
        console.error('[CreateImage] Storage initialization failed:', err);
        if (!cancelled) toast.error('Failed to initialize media storage.');
      }
    };
    initStorage();
    return () => {
      cancelled = true;
    };
  }, [storage]);

  const updateOfflineQueueCount = useCallback(async () => {
    const uid = resolveLiveUid();
    if (!dbRef?.current || !uid) {
      setOfflineQueueCount(0);
      return;
    }
    try {
      const items = await listMediaUploadsForOwner(dbRef.current, uid);
      setOfflineQueueCount(items.length);
    } catch (err) {
      console.warn('[CreateImage] Offline media count check failed:', err?.message);
    }
  }, [dbRef, resolveLiveUid]);

  // Process queue (UID-scoped IDB when offline, Storage UploadManager when online)
  const processUploadQueue = useCallback(async () => {
    const uid = resolveLiveUid();
    if (!uid) return;

    if (isOffline) {
      if (!dbRef?.current) return;
      const itemsToQueue = mediaItems.filter(
        (m) =>
          m.file &&
          !isMediaReady(m) &&
          (m.state === UPLOAD_STATES.QUEUED || m.state === UPLOAD_STATES.ERROR) &&
          !offlineQueuedIdsRef.current.has(m.id)
      );
      for (const item of itemsToQueue) {
        offlineQueuedIdsRef.current.add(item.id);
        try {
          await enqueueMediaUpload(
            dbRef.current,
            {
              id: item.id,
              file: item.file,
              name: item.name,
              type: item.type || 'image',
              alt: item.alt || '',
            },
            uid
          );
        } catch (err) {
          offlineQueuedIdsRef.current.delete(item.id);
          console.error('[CreateImage] Offline media queue failed:', err);
          toast.error('Could not save image for offline upload');
        }
      }
      await updateOfflineQueueCount();
      return;
    }

    if (!storageReady) return;
    const pending = mediaItems.filter(
      (m) =>
        m.file &&
        !isMediaReady(m) &&
        (m.state === UPLOAD_STATES.QUEUED || m.state === UPLOAD_STATES.ERROR)
    );
    if (pending.length > 0) {
      uploadManager.enqueue(pending);
    }
  }, [
    mediaItems,
    isOffline,
    storageReady,
    dbRef,
    resolveLiveUid,
    uploadManager,
    updateOfflineQueueCount,
  ]);

  useEffect(() => {
    processUploadQueue();
  }, [processUploadQueue]);

  // Flush UID-scoped offline upload queue when returning online
  useEffect(() => {
    if (isOffline || !storageReady || !dbRef?.current || !activeUid) return;
    let cancelled = false;

    const flushOffline = async () => {
      try {
        const pending = await listMediaUploadsForOwner(dbRef.current, activeUid);
        if (cancelled || pending.length === 0) return;

        for (const item of pending) {
          if (cancelled) break;
          const exists = mediaItemsRef.current.find((m) => m.id === item.id);
          if (!exists) {
            const preview = URL.createObjectURL(item.file);
            objectUrlsRef.current.push(preview);
            dispatch({
              type: 'ADD_MEDIA_ITEMS',
              payload: [
                {
                  id: item.id,
                  file: item.file,
                  preview,
                  url: null,
                  state: UPLOAD_STATES.QUEUED,
                  progress: 0,
                  retryCount: 0,
                  error: null,
                  size: item.file.size,
                  name: item.name,
                  type: item.type || 'image',
                  alt: item.alt || '',
                  edited: false,
                },
              ],
            });
          } else if (!isMediaReady(exists)) {
            dispatch({
              type: 'UPDATE_MEDIA_PROGRESS',
              payload: { id: item.id, updates: { state: UPLOAD_STATES.QUEUED, error: null } },
            });
          }
          await removeMediaUpload(dbRef.current, item.id, activeUid);
          offlineQueuedIdsRef.current.delete(item.id);
        }

        if (!cancelled) {
          await updateOfflineQueueCount();
        }
      } catch (err) {
        console.warn('[CreateImage] Offline media flush warning:', err?.message);
      }
    };

    flushOffline();
    return () => {
      cancelled = true;
    };
  }, [isOffline, storageReady, dbRef, activeUid, dispatch, updateOfflineQueueCount]);

  // Keep selectedId synced
  useEffect(() => {
    if (mediaItems.length > 0 && (!selectedId || !mediaItems.some((m) => m.id === selectedId))) {
      setSelectedId(mediaItems[0].id);
    } else if (mediaItems.length === 0 && selectedId !== null) {
      setSelectedId(null);
    }
  }, [mediaItems, selectedId]);

  const handleFiles = useCallback(
    async (files) => {
      const remaining = MAX_IMAGES - mediaItems.length;
      if (remaining <= 0) {
        toast.error(`Maximum ${MAX_IMAGES} images allowed`);
        return;
      }

      if (!storageReady) {
        try {
          await storage.initialize();
          setStorageReady(true);
        } catch (err) {
          console.warn('[CreateImage] Storage init warning:', err?.message);
        }
      }

      const uid = resolveLiveUid();
      if (!uid) {
        toast.error('Please sign in to upload images');
        return;
      }

      const newItems = [];
      const fileArray = Array.from(files || []).slice(0, remaining);
      for (const file of fileArray) {
        if (!file.type.startsWith('image/')) continue;
        if (file.size > MAX_IMAGE_SIZE_BYTES) {
          toast.error(`${file.name} exceeds ${MEDIA_LIMITS.maxImageSizeMB}MB`);
          continue;
        }
        const preview = URL.createObjectURL(file);
        objectUrlsRef.current.push(preview);
        const item = {
          id: generateUUID(),
          file,
          preview,
          url: null,
          storagePath: null,
          state: UPLOAD_STATES.QUEUED,
          progress: 0,
          retryCount: 0,
          error: null,
          width: 0,
          height: 0,
          size: file.size,
          name: file.name,
          type: 'image',
          alt: '',
          edited: false,
        };
        try {
          const img = await new Promise((resolve, reject) => {
            const el = new Image();
            el.onload = () => resolve(el);
            el.onerror = reject;
            el.src = preview;
          });
          item.width = img.width;
          item.height = img.height;
        } catch (err) {
          console.warn('[CreateImage] Dimension probe failed:', err?.message);
        }
        newItems.push(item);
      }

      if (newItems.length === 0) return;
      dispatch({ type: 'ADD_MEDIA_ITEMS', payload: newItems });
      if (!selectedId) setSelectedId(newItems[0].id);
    },
    [mediaItems.length, storageReady, storage, resolveLiveUid, dispatch, selectedId]
  );

  const handleFileInputChange = useCallback(
    (e) => {
      handleFiles(e.target.files);
      e.target.value = '';
    },
    [handleFiles]
  );

  const removeMedia = useCallback(
    async (id) => {
      const idx = mediaItems.findIndex((m) => m.id === id);
      if (idx === -1) return;
      const media = mediaItems[idx];

      if (media?.preview && media.preview.startsWith('blob:')) {
        URL.revokeObjectURL(media.preview);
        objectUrlsRef.current = objectUrlsRef.current.filter((u) => u !== media.preview);
      }

      uploadManager.cancel(id);

      const uid = resolveLiveUid();
      if (dbRef?.current && uid) {
        await removeMediaUpload(dbRef.current, id, uid).catch((err) =>
          console.warn('[CreateImage] Queue cleanup failed:', err?.message)
        );
      }
      offlineQueuedIdsRef.current.delete(id);

      // Delete abandoned Storage asset ONLY if it was uploaded in this session
      const pathCandidate = media?.storagePath || extractStoragePathFromUrl(media?.url);
      if (pathCandidate && sessionUploadedPathsRef.current.has(pathCandidate)) {
        sessionUploadedPathsRef.current.delete(pathCandidate);
        deleteUploadedStorageAsset(storage, pathCandidate);
      }

      dispatch({ type: 'REMOVE_MEDIA_ITEM', payload: idx });
      if (id === selectedId) {
        const remainingItems = mediaItems.filter((m) => m.id !== id);
        setSelectedId(remainingItems[Math.min(idx, remainingItems.length - 1)]?.id || null);
      }
      updateOfflineQueueCount();
    },
    [mediaItems, uploadManager, resolveLiveUid, dbRef, storage, dispatch, selectedId, updateOfflineQueueCount]
  );

  const cancelUpload = useCallback(
    (id) => {
      uploadManager.cancel(id);
      dispatch({
        type: 'UPDATE_MEDIA_PROGRESS',
        payload: { id, updates: { state: UPLOAD_STATES.CANCELLED } },
      });
      toast.info('Upload cancelled');
    },
    [uploadManager, dispatch]
  );

  const retryUpload = useCallback(
    (id) => {
      const item = mediaItems.find((m) => m.id === id);
      if (!item) return;
      uploadManager.reset(id);
      dispatch({
        type: 'UPDATE_MEDIA_PROGRESS',
        payload: { id, updates: { state: UPLOAD_STATES.QUEUED, error: null, retryCount: 0 } },
      });
    },
    [mediaItems, uploadManager, dispatch]
  );

  const handleEdit = useCallback((item) => {
    setEditingId(item.id);
  }, []);

  const handleEditSave = useCallback(
    (updatedData) => {
      if (!editingId) return;
      const item = mediaItems.find((m) => m.id === editingId);
      if (!item) return;
      if (item.preview && item.preview.startsWith('blob:')) {
        URL.revokeObjectURL(item.preview);
        objectUrlsRef.current = objectUrlsRef.current.filter((u) => u !== item.preview);
      }

      // If previous file was uploaded during this session and replaced by an edited file, delete old asset
      if (updatedData.file) {
        const prevPath = item.storagePath || extractStoragePathFromUrl(item.url);
        if (prevPath && sessionUploadedPathsRef.current.has(prevPath)) {
          sessionUploadedPathsRef.current.delete(prevPath);
          deleteUploadedStorageAsset(storage, prevPath);
        }
      }

      const newPreview =
        updatedData.preview || (updatedData.file ? URL.createObjectURL(updatedData.file) : item.preview);
      if (newPreview && newPreview.startsWith('blob:')) {
        objectUrlsRef.current.push(newPreview);
      }

      uploadManager.reset(editingId);
      dispatch({
        type: 'UPDATE_MEDIA_ITEM',
        payload: {
          id: editingId,
          updates: {
            ...updatedData,
            preview: newPreview,
            url: updatedData.file ? null : item.url,
            storagePath: updatedData.file ? null : item.storagePath,
            edited: true,
            state: updatedData.file ? UPLOAD_STATES.QUEUED : UPLOAD_STATES.EDITED,
            progress: updatedData.file ? 0 : 100,
          },
        },
      });
      setEditingId(null);
    },
    [editingId, mediaItems, storage, uploadManager, dispatch]
  );

  const handleReorder = useCallback(
    (from, to) => {
      dispatch({ type: 'REORDER_MEDIA', payload: { from, to } });
    },
    [dispatch]
  );

  const handleCollageSave = useCallback(
    (collageResult) => {
      if (collageResult?.file) {
        handleFiles([collageResult.file]);
      }
      setShowCollage(false);
    },
    [handleFiles]
  );

  useEffect(() => {
    return () => {
      objectUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
      objectUrlsRef.current = [];
    };
  }, []);

  // Keyboard navigation while respecting text inputs
  useEffect(() => {
    const handler = (e) => {
      const tag = e.target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || e.target?.isContentEditable) {
        return;
      }
      if (e.key === 'ArrowLeft' && mediaItems.length > 0 && selectedId) {
        e.preventDefault();
        const idx = mediaItems.findIndex((m) => m.id === selectedId);
        if (idx > 0) setSelectedId(mediaItems[idx - 1].id);
      }
      if (e.key === 'ArrowRight' && mediaItems.length > 0 && selectedId) {
        e.preventDefault();
        const idx = mediaItems.findIndex((m) => m.id === selectedId);
        if (idx >= 0 && idx < mediaItems.length - 1) setSelectedId(mediaItems[idx + 1].id);
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && mediaItems.length > 0 && selectedId) {
        e.preventDefault();
        removeMedia(selectedId);
      }
      if (e.key === 'Escape' && expandedPreview) {
        e.preventDefault();
        setExpandedPreview(false);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [mediaItems, selectedId, removeMedia, expandedPreview]);

  const allUploadsComplete = useMemo(
    () => mediaItems.every((m) => isMediaReady(m) || !m.file),
    [mediaItems]
  );

  const hasMedia = mediaItems.length > 0;
  const editingMedia = editingId ? mediaItems.find((m) => m.id === editingId) : null;
  const handleAddImage = useCallback(() => fileInputRef.current?.click(), []);

  return (
    <div className="max-w-3xl mx-auto w-full py-4 space-y-4">
      {/* Studio Subheader & Utility Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold tracking-tight text-slate-900 dark:text-white">
            Photo Studio
          </h2>
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <span className="tabular-nums">
              {hasMedia ? `${mediaItems.length} / ${MAX_IMAGES} photos` : `Up to ${MAX_IMAGES} photos`}
            </span>
            {hasMedia && (
              <>
                <span aria-hidden="true">·</span>
                <UploadStatusReadout items={mediaItems} />
              </>
            )}
            {isOffline && offlineQueueCount > 0 && (
              <>
                <span aria-hidden="true">·</span>
                <span className="text-amber-500 font-medium tabular-nums">
                  {offlineQueueCount} queued offline
                </span>
              </>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setShowCollage(true)}
            className="min-h-[40px] px-3.5 py-1.5 rounded-xl border border-slate-200 dark:border-white/12 bg-white/80 dark:bg-[#080F2E]/80 text-xs font-semibold text-slate-800 dark:text-slate-100 hover:bg-white dark:hover:bg-white/10 transition-colors flex items-center gap-1.5 whitespace-nowrap focus-visible:ring-2 focus-visible:ring-arvdoul-purple"
          >
            <Icons.LayoutGrid className="w-3.5 h-3.5 text-arvdoul-purple" />
            <span>Collage</span>
          </button>

          <button
            type="button"
            onClick={saveDraft}
            disabled={autoSaveStatus === 'saving' || !allUploadsComplete}
            title={!allUploadsComplete ? 'Waiting for uploads to finish' : 'Save draft'}
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

      {isOffline && (
        <div className="rounded-xl px-3.5 py-2.5 border border-amber-500/35 bg-amber-500/10 text-amber-700 dark:text-amber-300 text-xs flex items-center gap-2">
          <Icons.WifiOff className="w-4 h-4 shrink-0" />
          <span>You are offline. Added photos are stored safely for upload when reconnected.</span>
        </div>
      )}

      {/* Main Studio Surface */}
      <div className={`${SURFACE_GLASS_CLASS} p-4 sm:p-5 space-y-4`}>
        {!hasMedia ? (
          <EmptyState onUpload={handleAddImage} />
        ) : (
          <>
            <HeroPreview
              items={mediaItems}
              selectedId={selectedId}
              onSelect={setSelectedId}
              onExpand={() => setExpandedPreview(true)}
              onDelete={() => selectedId && removeMedia(selectedId)}
              onEdit={handleEdit}
              isDark={isDark}
            />

            <Filmstrip
              items={mediaItems}
              selectedId={selectedId}
              onSelect={setSelectedId}
              onRemove={removeMedia}
              onCancel={cancelUpload}
              onRetry={retryUpload}
              onReorder={handleReorder}
              onAddImage={handleAddImage}
              isDark={isDark}
            />

            <CaptionComposer
              value={caption}
              onChange={(e) => {
                if (e.target.value.length <= MAX_CAPTION_LENGTH) {
                  dispatch({ type: 'SET_CONTENT', payload: e.target.value });
                }
              }}
              maxLength={MAX_CAPTION_LENGTH}
              isDark={isDark}
            />

            {mediaItems.some((m) => m.state === UPLOAD_STATES.ERROR) && (
              <div className="flex flex-wrap gap-2">
                {mediaItems
                  .filter((m) => m.state === UPLOAD_STATES.ERROR)
                  .map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => retryUpload(m.id)}
                      className="min-h-[40px] px-3 py-1.5 text-xs font-medium bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 rounded-xl border border-rose-500/25 transition-colors flex items-center gap-1.5 focus-visible:ring-2 focus-visible:ring-arvdoul-purple"
                    >
                      <Icons.RefreshCw className="w-3.5 h-3.5" />
                      <span>Retry {m.name}</span>
                    </button>
                  ))}
              </div>
            )}
          </>
        )}

        {/* Sync status */}
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
        id="image-studio-file-input"
        type="file"
        multiple
        accept="image/*"
        className="hidden"
        onChange={handleFileInputChange}
      />

      <AnimatePresence>
        {expandedPreview && hasMedia && (
          <FullscreenViewer
            items={mediaItems}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onClose={() => setExpandedPreview(false)}
            onDelete={() => {
              if (selectedId) removeMedia(selectedId);
              setExpandedPreview(false);
            }}
            onEdit={handleEdit}
          />
        )}
      </AnimatePresence>

      {editingMedia && (
        <Suspense fallback={<TopAppLoadingBanner label="Opening Image Studio..." />}>
          <ImageEditor
            key={editingMedia.id}
            media={editingMedia}
            onClose={() => setEditingId(null)}
            onSave={handleEditSave}
            offline={isOffline}
            isDark={isDark}
          />
        </Suspense>
      )}

      {showCollage && (
        <Suspense fallback={<TopAppLoadingBanner label="Opening Collage Maker..." />}>
          <Collage
            images={mediaItems}
            onSave={handleCollageSave}
            onClose={() => setShowCollage(false)}
            isDark={isDark}
          />
        </Suspense>
      )}
    </div>
  );
}