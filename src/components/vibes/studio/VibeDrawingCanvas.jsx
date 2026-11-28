// src/components/vibes/studio/VibeDrawingCanvas.jsx
//
// Interactive non-destructive pointer drawing layer & toolbar for Vibes Studio.
// Stores normalized [0..1] strokes with undo/redo stack (up to 20 snapshots)
// and replays through the shared <VibeDrawingOverlay /> used in Viewer/Preview.

import { useState, useRef, useCallback } from 'react';
import { Undo2, Redo2, Eraser, Pencil, Trash2, Check } from 'lucide-react';
import { cn } from '../../../lib/utils';
import { BRAND_GRADIENT } from '../../../design-system/tokens.js';
import { VIBE_COLOR_PALETTE, VIBE_LIMITS } from '../../../config/vibeContracts.js';
import { VibeDrawingOverlay } from '../VibeRenderer.jsx';

const BRUSH_SIZES = [
  { id: 'sm', size: 4, label: 'Fine' },
  { id: 'md', size: 8, label: 'Medium' },
  { id: 'lg', size: 15, label: 'Bold' },
];

export function VibeDrawingStage({
  active = false,
  paths = [],
  brushColor = '#FFFFFF',
  brushSize = 8,
  brushMode = 'draw',
  onPathsChange,
}) {
  const stageRef = useRef(null);
  const drawingRef = useRef(false);
  const draftStrokeRef = useRef(null);
  const [draftStroke, setDraftStroke] = useState(null);

  const getNormalizedPoint = useCallback((clientX, clientY) => {
    const rect = stageRef.current?.getBoundingClientRect();
    if (!rect || rect.width <= 0 || rect.height <= 0) return { x: 0.5, y: 0.5 };
    return {
      x: Math.min(1, Math.max(0, (clientX - rect.left) / rect.width)),
      y: Math.min(1, Math.max(0, (clientY - rect.top) / rect.height)),
    };
  }, []);

  const handlePointerDown = (e) => {
    if (!active) return;
    e.stopPropagation();
    e.currentTarget.setPointerCapture?.(e.pointerId);
    drawingRef.current = true;
    const pt = getNormalizedPoint(e.clientX, e.clientY);
    const next = {
      id: `stroke_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      color: brushColor,
      size: brushSize,
      mode: brushMode,
      points: [pt],
    };
    draftStrokeRef.current = next;
    setDraftStroke(next);
  };

  const handlePointerMove = (e) => {
    if (!active || !drawingRef.current) return;
    e.stopPropagation();
    const prev = draftStrokeRef.current;
    if (!prev || prev.points.length >= VIBE_LIMITS.MAX_DRAWING_POINTS_PER_PATH) return;
    const pt = getNormalizedPoint(e.clientX, e.clientY);
    const last = prev.points[prev.points.length - 1];
    const dist = Math.hypot(pt.x - last.x, pt.y - last.y);
    if (dist < 0.003) return;
    const next = { ...prev, points: [...prev.points, pt] };
    draftStrokeRef.current = next;
    setDraftStroke(next);
  };

  const finishStroke = (e) => {
    if (!active || !drawingRef.current) return;
    e.stopPropagation();
    drawingRef.current = false;
    const finished = draftStrokeRef.current;
    draftStrokeRef.current = null;
    setDraftStroke(null);
    if (finished && finished.points.length > 0) {
      onPathsChange?.([...paths.slice(-(VIBE_LIMITS.MAX_DRAWING_PATHS - 1)), finished]);
    }
  };

  const renderedPaths = draftStroke ? [...paths, draftStroke] : paths;

  return (
    <div
      ref={stageRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={finishStroke}
      onPointerCancel={finishStroke}
      style={{ touchAction: active ? 'none' : 'auto' }}
      className={cn(
        'absolute inset-0 z-20',
        active ? 'pointer-events-auto cursor-crosshair' : 'pointer-events-none'
      )}
    >
      <VibeDrawingOverlay paths={renderedPaths} />
    </div>
  );
}

export function VibeDrawingToolbar({
  brushColor,
  onBrushColorChange,
  brushSize,
  onBrushSizeChange,
  brushMode,
  onBrushModeChange,
  canUndo,
  canRedo,
  hasPaths,
  onUndo,
  onRedo,
  onClear,
  onDone,
}) {
  return (
    <div className="p-3.5 rounded-2xl bg-black/85 backdrop-blur-xl border border-white/20 text-white shadow-2xl space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => onBrushModeChange('draw')}
            aria-label="Freehand brush"
            aria-pressed={brushMode === 'draw'}
            className={cn(
              'min-h-[36px] px-3 py-1.5 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer',
              brushMode === 'draw' ? 'text-white' : 'bg-white/10 text-white/75 hover:bg-white/15'
            )}
            style={brushMode === 'draw' ? { background: BRAND_GRADIENT } : undefined}
          >
            <Pencil className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Brush</span>
          </button>

          <button
            type="button"
            onClick={() => onBrushModeChange('eraser')}
            aria-label="Eraser brush"
            aria-pressed={brushMode === 'eraser'}
            className={cn(
              'min-h-[36px] px-3 py-1.5 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer',
              brushMode === 'eraser' ? 'text-white' : 'bg-white/10 text-white/75 hover:bg-white/15'
            )}
            style={brushMode === 'eraser' ? { background: BRAND_GRADIENT } : undefined}
          >
            <Eraser className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Eraser</span>
          </button>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onUndo}
            disabled={!canUndo}
            aria-label="Undo stroke"
            className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 disabled:opacity-35 flex items-center justify-center cursor-pointer"
          >
            <Undo2 className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={onRedo}
            disabled={!canRedo}
            aria-label="Redo stroke"
            className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 disabled:opacity-35 flex items-center justify-center cursor-pointer"
          >
            <Redo2 className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={onClear}
            disabled={!hasPaths}
            aria-label="Clear drawing"
            className="w-9 h-9 rounded-xl bg-white/10 hover:bg-rose-600/80 disabled:opacity-35 flex items-center justify-center cursor-pointer"
          >
            <Trash2 className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={onDone}
            aria-label="Finish drawing"
            className="min-h-[36px] px-3 py-1.5 rounded-xl bg-white text-slate-950 text-xs font-bold inline-flex items-center gap-1 cursor-pointer"
          >
            <Check className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Done</span>
          </button>
        </div>
      </div>

      {/* Size selector */}
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-semibold text-white/70">Size</span>
        <div className="flex items-center gap-1.5">
          {BRUSH_SIZES.map((b) => (
            <button
              type="button"
              key={b.id}
              onClick={() => onBrushSizeChange(b.size)}
              className={cn(
                'px-3 py-1 rounded-lg text-[11px] font-bold border cursor-pointer',
                brushSize === b.size
                  ? 'border-white bg-white/20 text-white'
                  : 'border-white/15 bg-white/5 text-white/70 hover:bg-white/10'
              )}
            >
              {b.label}
            </button>
          ))}
        </div>
      </div>

      {/* Color Swatches (visible when Brush active) */}
      {brushMode === 'draw' && (
        <div className="flex items-center justify-between gap-1.5 pt-1">
          {VIBE_COLOR_PALETTE.map((hex) => (
            <button
              type="button"
              key={hex}
              aria-label={`Select color ${hex}`}
              onClick={() => onBrushColorChange(hex)}
              className={cn(
                'w-7 h-7 rounded-full border-2 transition-transform cursor-pointer',
                brushColor === hex ? 'border-white scale-115' : 'border-white/30'
              )}
              style={{ backgroundColor: hex }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
