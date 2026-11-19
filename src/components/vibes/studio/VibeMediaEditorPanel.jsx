// src/components/vibes/studio/VibeMediaEditorPanel.jsx
//
// Part 1 Studio Editing Controls:
//   - Image editing: Aspect Crop (original, 9:16, 4:5, 1:1), Rotate 90°,
//     Brightness, Contrast, Fit vs Fill mode, Reset, + non-destructive Canvas export helper
//   - Video editing: Duration cap <= 60s, Trim Start/End controls, Mute audio toggle,
//     Cover frame selector

import { RotateCw, Maximize2, Minimize2, VolumeX, Volume2, RotateCcw, X, Scissors } from 'lucide-react';
import { cn } from '../../../lib/utils';
import { BRAND_GRADIENT } from '../../../design-system/tokens.js';
import { VIBE_LIMITS } from '../../../config/vibeContracts.js';

const ASPECT_OPTIONS = [
  { id: 'original', label: 'Original' },
  { id: '9:16', label: '9:16' },
  { id: '4:5', label: '4:5' },
  { id: '1:1', label: '1:1' },
];

const ASPECT_RATIO_NUMBERS = {
  '9:16': 9 / 16,
  '4:5': 4 / 5,
  '1:1': 1,
};

/**
 * Bakes rotation, aspect crop, brightness, and contrast into a clean File
 * right before publish so feed thumbnails & archives match Studio output.
 */
export async function bakeEditedImageFile(sourceFile, sourceUrl, edits = {}) {
  if (!sourceFile || !sourceUrl) return sourceFile;
  const rotation = Number(edits.rotation || 0) % 360;
  const brightness = Number(edits.brightness ?? 100);
  const contrast = Number(edits.contrast ?? 100);
  const aspectRatio = edits.aspectRatio || 'original';

  const hasPixelEdits =
    rotation !== 0 || brightness !== 100 || contrast !== 100 || aspectRatio !== 'original';
  if (!hasPixelEdits) return sourceFile;

  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const rad = (rotation * Math.PI) / 180;
        const rot90 = Math.abs(rotation) === 90 || Math.abs(rotation) === 270;
        const rotatedW = rot90 ? img.naturalHeight : img.naturalWidth;
        const rotatedH = rot90 ? img.naturalWidth : img.naturalHeight;

        let cropW = rotatedW;
        let cropH = rotatedH;
        const targetRatio = ASPECT_RATIO_NUMBERS[aspectRatio];
        if (targetRatio && rotatedW > 0 && rotatedH > 0) {
          const currentRatio = rotatedW / rotatedH;
          if (currentRatio > targetRatio) {
            cropW = Math.round(rotatedH * targetRatio);
          } else if (currentRatio < targetRatio) {
            cropH = Math.round(rotatedW / targetRatio);
          }
        }

        const scaleDown = Math.min(1, 1440 / Math.max(cropW, cropH, 1));
        const outW = Math.max(1, Math.round(cropW * scaleDown));
        const outH = Math.max(1, Math.round(cropH * scaleDown));

        const canvas = document.createElement('canvas');
        canvas.width = outW;
        canvas.height = outH;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(sourceFile);
          return;
        }

        ctx.filter = `brightness(${brightness}%) contrast(${contrast}%)`;
        ctx.translate(outW / 2, outH / 2);
        ctx.rotate(rad);
        ctx.drawImage(
          img,
          -(img.naturalWidth * scaleDown) / 2,
          -(img.naturalHeight * scaleDown) / 2,
          img.naturalWidth * scaleDown,
          img.naturalHeight * scaleDown
        );

        canvas.toBlob(
          (blob) => {
            if (!blob) {
              resolve(sourceFile);
              return;
            }
            resolve(new File([blob], sourceFile.name || `vibe-${Date.now()}.jpg`, { type: 'image/jpeg' }));
          },
          'image/jpeg',
          0.92
        );
      } catch {
        resolve(sourceFile);
      }
    };
    img.onerror = () => resolve(sourceFile);
    img.src = sourceUrl;
  });
}

export default function VibeMediaEditorPanel({
  mediaType,
  mediaEdits,
  nativeDuration = 15,
  onChangeEdits,
  onResetEdits,
  onCaptureVideoCover,
  onClose,
}) {
  const edits = mediaEdits || {};
  const rotation = Number(edits.rotation || 0);
  const brightness = Number(edits.brightness ?? 100);
  const contrast = Number(edits.contrast ?? 100);
  const fitMode = edits.fitMode === 'cover' ? 'cover' : 'contain';
  const aspectRatio = edits.aspectRatio || 'original';

  const maxClipEnd = Math.max(1, Math.min(nativeDuration || 15, VIBE_LIMITS.VIDEO_MAX_DURATION_SEC));
  const trimStart = Math.max(0, Math.min(Number(edits.trimStart ?? 0), maxClipEnd - 1));
  const trimEnd = Math.max(trimStart + 1, Math.min(Number(edits.trimEnd ?? maxClipEnd), maxClipEnd));

  return (
    <div className="p-4 rounded-2xl bg-black/85 backdrop-blur-xl border border-white/20 text-white shadow-2xl space-y-3.5 max-h-[60vh] overflow-y-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Scissors className="w-4 h-4 text-white/80" aria-hidden="true" />
          <span className="text-xs font-bold uppercase tracking-wider text-white/80">
            {mediaType === 'video' ? 'Video Trim & Frame' : 'Adjust & Crop'}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={onResetEdits}
            aria-label="Reset edits"
            className="min-h-[32px] px-2.5 rounded-lg bg-white/10 hover:bg-white/20 text-[11px] font-semibold inline-flex items-center gap-1 cursor-pointer"
          >
            <RotateCcw className="w-3 h-3" aria-hidden="true" />
            <span>Reset</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close media editor"
            className="w-8 h-8 rounded-lg hover:bg-white/10 flex items-center justify-center cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Fit vs Fill toggle for both images and videos */}
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-white/80">Frame Mode</span>
        <div className="flex gap-1.5">
          <button
            type="button"
            onClick={() => onChangeEdits({ fitMode: 'contain' })}
            className={cn(
              'min-h-[34px] px-3 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 border cursor-pointer',
              fitMode === 'contain' ? 'border-white bg-white/20 text-white' : 'border-white/15 bg-white/5 text-white/70'
            )}
          >
            <Minimize2 className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Fit</span>
          </button>
          <button
            type="button"
            onClick={() => onChangeEdits({ fitMode: 'cover' })}
            className={cn(
              'min-h-[34px] px-3 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 border cursor-pointer',
              fitMode === 'cover' ? 'border-white bg-white/20 text-white' : 'border-white/15 bg-white/5 text-white/70'
            )}
          >
            <Maximize2 className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Fill</span>
          </button>
        </div>
      </div>

      {mediaType === 'image' && (
        <>
          {/* Aspect Ratio Crop */}
          <div className="space-y-1.5">
            <span className="text-xs font-semibold text-white/80 block">Aspect Ratio</span>
            <div className="grid grid-cols-4 gap-1.5">
              {ASPECT_OPTIONS.map((opt) => (
                <button
                  type="button"
                  key={opt.id}
                  onClick={() => onChangeEdits({ aspectRatio: opt.id })}
                  className={cn(
                    'min-h-[36px] rounded-xl text-xs font-bold border transition-colors cursor-pointer',
                    aspectRatio === opt.id
                      ? 'text-white border-white/50'
                      : 'bg-white/5 border-white/10 text-white/75 hover:bg-white/10'
                  )}
                  style={aspectRatio === opt.id ? { background: BRAND_GRADIENT } : undefined}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Rotate 90 */}
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-white/80">Orientation ({rotation}°)</span>
            <button
              type="button"
              onClick={() => onChangeEdits({ rotation: (rotation + 90) % 360 })}
              className="min-h-[36px] px-3.5 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
            >
              <RotateCw className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Rotate 90°</span>
            </button>
          </div>

          {/* Brightness */}
          <label className="block space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-white/80">Brightness</span>
              <span className="font-mono text-white/70">{brightness}%</span>
            </div>
            <input
              type="range"
              min="50"
              max="150"
              value={brightness}
              onChange={(e) => onChangeEdits({ brightness: Number(e.target.value) })}
              className="w-full accent-indigo-500 cursor-pointer"
            />
          </label>

          {/* Contrast */}
          <label className="block space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-white/80">Contrast</span>
              <span className="font-mono text-white/70">{contrast}%</span>
            </div>
            <input
              type="range"
              min="50"
              max="150"
              value={contrast}
              onChange={(e) => onChangeEdits({ contrast: Number(e.target.value) })}
              className="w-full accent-indigo-500 cursor-pointer"
            />
          </label>
        </>
      )}

      {mediaType === 'video' && (
        <>
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-white/80">Video Audio</span>
            <button
              type="button"
              onClick={() => onChangeEdits({ muted: !edits.muted })}
              className={cn(
                'min-h-[36px] px-3.5 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 border cursor-pointer',
                edits.muted ? 'bg-rose-600/30 border-rose-400/50 text-rose-200' : 'bg-white/10 border-white/15 text-white'
              )}
            >
              {edits.muted ? <VolumeX className="w-3.5 h-3.5" aria-hidden="true" /> : <Volume2 className="w-3.5 h-3.5" aria-hidden="true" />}
              <span>{edits.muted ? 'Muted' : 'Sound On'}</span>
            </button>
          </div>

          <label className="block space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-white/80">Trim Start</span>
              <span className="font-mono text-white/70">{trimStart.toFixed(1)}s</span>
            </div>
            <input
              type="range"
              min="0"
              max={Math.max(0, trimEnd - 1)}
              step="0.5"
              value={trimStart}
              onChange={(e) => {
                const nextStart = Number(e.target.value);
                const cappedEnd = Math.min(trimEnd, nextStart + VIBE_LIMITS.VIDEO_MAX_DURATION_SEC);
                onChangeEdits({ trimStart: nextStart, trimEnd: Math.max(nextStart + 1, cappedEnd) });
              }}
              className="w-full accent-indigo-500 cursor-pointer"
            />
          </label>

          <label className="block space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-white/80">Trim End (max {VIBE_LIMITS.VIDEO_MAX_DURATION_SEC}s)</span>
              <span className="font-mono text-white/70">{trimEnd.toFixed(1)}s</span>
            </div>
            <input
              type="range"
              min={trimStart + 1}
              max={Math.min(nativeDuration || maxClipEnd, trimStart + VIBE_LIMITS.VIDEO_MAX_DURATION_SEC)}
              step="0.5"
              value={trimEnd}
              onChange={(e) => onChangeEdits({ trimEnd: Number(e.target.value) })}
              className="w-full accent-indigo-500 cursor-pointer"
            />
          </label>

          <div className="flex items-center justify-between gap-2 pt-1">
            <span className="text-[11px] text-white/70">
              Clip duration: {(trimEnd - trimStart).toFixed(1)}s
            </span>
            {onCaptureVideoCover && (
              <button
                type="button"
                onClick={() => onCaptureVideoCover(trimStart)}
                className="min-h-[34px] px-3 rounded-xl bg-white/10 hover:bg-white/20 text-[11px] font-bold cursor-pointer"
              >
                Use Current Frame as Cover
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
