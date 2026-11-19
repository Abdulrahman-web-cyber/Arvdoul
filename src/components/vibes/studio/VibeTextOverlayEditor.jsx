// src/components/vibes/studio/VibeTextOverlayEditor.jsx
//
// Multi-element editable, styleable, drag-repositionable text overlays for
// Vibes Studio, bounded within safe stage margins via clampOverlayPosition.

import { useRef, useState } from 'react';
import { Plus, Trash2, AlignLeft, AlignCenter, AlignRight, X } from 'lucide-react';
import { cn } from '../../../lib/utils';
import { BRAND_GRADIENT } from '../../../design-system/tokens.js';
import {
  VIBE_FONT_OPTIONS,
  VIBE_COLOR_PALETTE,
  VIBE_LIMITS,
  clampOverlayPosition,
  getVibeFontCss,
} from '../../../config/vibeContracts.js';

export function VibeDraggableOverlaysStage({
  overlays = [],
  selectedId = null,
  editable = true,
  onSelect,
  onMoveOverlay,
}) {
  const stageRef = useRef(null);
  const draggingRef = useRef(null);

  const handlePointerDown = (e, overlay) => {
    if (!editable) return;
    e.stopPropagation();
    onSelect?.(overlay.id);
    const rect = stageRef.current?.getBoundingClientRect();
    if (!rect || rect.width <= 0 || rect.height <= 0) return;
    draggingRef.current = { id: overlay.id, rect };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };

  const handlePointerMove = (e) => {
    if (!draggingRef.current) return;
    e.stopPropagation();
    const { id, rect } = draggingRef.current;
    const rawX = (e.clientX - rect.left) / rect.width;
    const rawY = (e.clientY - rect.top) / rect.height;
    const clamped = clampOverlayPosition(rawX, rawY);
    onMoveOverlay?.(id, clamped.x, clamped.y);
  };

  const handlePointerUp = () => {
    draggingRef.current = null;
  };

  return (
    <div
      ref={stageRef}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      className="absolute inset-0 z-20 pointer-events-none overflow-hidden"
    >
      {overlays.map((overlay) => {
        const isSelected = selectedId === overlay.id;
        const bgClass =
          overlay.bgStyle === 'solid'
            ? 'bg-slate-950/90 px-3.5 py-2 rounded-2xl shadow-lg border border-white/15'
            : overlay.bgStyle === 'pill'
              ? 'bg-black/60 backdrop-blur-md px-3.5 py-1.5 rounded-full border border-white/20 shadow-md'
              : 'drop-shadow-[0_2px_10px_rgba(0,0,0,0.85)] px-2';

        return (
          <div
            key={overlay.id}
            role="button"
            tabIndex={editable ? 0 : -1}
            aria-label={`Text overlay: ${overlay.text || 'Empty'}. Use arrow keys to reposition.`}
            onPointerDown={(e) => handlePointerDown(e, overlay)}
            onKeyDown={(e) => {
              if (!editable) return;
              const step = 0.03;
              if (e.key === 'ArrowLeft') {
                e.preventDefault();
                const pos = clampOverlayPosition(overlay.x - step, overlay.y);
                onMoveOverlay?.(overlay.id, pos.x, pos.y);
              } else if (e.key === 'ArrowRight') {
                e.preventDefault();
                const pos = clampOverlayPosition(overlay.x + step, overlay.y);
                onMoveOverlay?.(overlay.id, pos.x, pos.y);
              } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                const pos = clampOverlayPosition(overlay.x, overlay.y - step);
                onMoveOverlay?.(overlay.id, pos.x, pos.y);
              } else if (e.key === 'ArrowDown') {
                e.preventDefault();
                const pos = clampOverlayPosition(overlay.x, overlay.y + step);
                onMoveOverlay?.(overlay.id, pos.x, pos.y);
              }
            }}
            style={{
              left: `${overlay.x * 100}%`,
              top: `${overlay.y * 100}%`,
              transform: `translate(-50%, -50%) rotate(${overlay.rotation || 0}deg) scale(${overlay.scale || 1})`,
              color: overlay.color || '#FFFFFF',
              fontFamily: getVibeFontCss(overlay.font),
              textAlign: overlay.align || 'center',
              touchAction: editable ? 'none' : 'auto',
            }}
            className={cn(
              'absolute max-w-[82%] font-bold text-lg sm:text-xl leading-snug break-words select-none cursor-move transition-shadow',
              editable ? 'pointer-events-auto' : 'pointer-events-none',
              bgClass,
              isSelected && 'ring-2 ring-white ring-offset-2 ring-offset-black/40'
            )}
          >
            {overlay.text || 'Tap to edit'}
          </div>
        );
      })}
    </div>
  );
}

export function VibeTextOverlayPanel({
  overlays = [],
  selectedId,
  onSelect,
  onAdd,
  onUpdate,
  onDelete,
  onClose,
}) {
  const [draftInput, setDraftInput] = useState('');
  const activeOverlay = overlays.find((o) => o.id === selectedId) || overlays[0] || null;

  const handleAddSubmit = (e) => {
    e.preventDefault();
    const trimmed = draftInput.trim();
    if (!trimmed) return;
    onAdd?.(trimmed);
    setDraftInput('');
  };

  return (
    <div className="p-4 rounded-2xl bg-black/85 backdrop-blur-xl border border-white/20 text-white shadow-2xl space-y-3 max-h-[60vh] overflow-y-auto">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold uppercase tracking-wider text-white/80">
          Text Overlays ({overlays.length}/{VIBE_LIMITS.MAX_TEXT_OVERLAYS})
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close text overlay editor"
          className="w-8 h-8 rounded-lg hover:bg-white/10 flex items-center justify-center cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Add new overlay */}
      <form onSubmit={handleAddSubmit} className="flex items-center gap-2">
        <input
          type="text"
          aria-label="New text overlay"
          maxLength={VIBE_LIMITS.OVERLAY_TEXT_MAX_LENGTH}
          value={draftInput}
          onChange={(e) => setDraftInput(e.target.value)}
          placeholder="Add overlay text…"
          className="flex-1 bg-white/10 border border-white/20 rounded-xl px-3 py-2 text-xs text-white placeholder:text-white/50 focus:outline-none focus:border-white/50"
        />
        <button
          type="submit"
          disabled={!draftInput.trim() || overlays.length >= VIBE_LIMITS.MAX_TEXT_OVERLAYS}
          className="min-h-[36px] px-3 rounded-xl text-xs font-bold text-white inline-flex items-center gap-1 disabled:opacity-40 cursor-pointer"
          style={{ background: BRAND_GRADIENT }}
        >
          <Plus className="w-3.5 h-3.5" aria-hidden="true" />
          <span>Add</span>
        </button>
      </form>

      {/* Overlay pills */}
      {overlays.length > 0 && (
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
          {overlays.map((ov, i) => (
            <button
              type="button"
              key={ov.id}
              onClick={() => onSelect?.(ov.id)}
              className={cn(
                'px-2.5 py-1 rounded-lg text-[11px] font-semibold truncate max-w-[110px] border shrink-0 cursor-pointer',
                activeOverlay?.id === ov.id
                  ? 'border-white bg-white/20 text-white'
                  : 'border-white/15 bg-white/5 text-white/75'
              )}
            >
              {ov.text || `Text ${i + 1}`}
            </button>
          ))}
        </div>
      )}

      {/* Selected overlay controls */}
      {activeOverlay && (
        <div className="space-y-2.5 pt-1 border-t border-white/10">
          <div className="flex items-center gap-2">
            <input
              type="text"
              aria-label="Edit selected overlay text"
              maxLength={VIBE_LIMITS.OVERLAY_TEXT_MAX_LENGTH}
              value={activeOverlay.text}
              onChange={(e) => onUpdate?.(activeOverlay.id, { text: e.target.value })}
              className="flex-1 bg-white/10 border border-white/20 rounded-xl px-3 py-1.5 text-xs font-semibold text-white outline-none focus:border-white/50"
            />
            <button
              type="button"
              onClick={() => onDelete?.(activeOverlay.id)}
              aria-label="Delete selected overlay"
              className="w-9 h-9 rounded-xl bg-rose-600/30 hover:bg-rose-600 text-white flex items-center justify-center cursor-pointer"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>

          {/* Font family */}
          <div className="grid grid-cols-4 gap-1">
            {VIBE_FONT_OPTIONS.map((f) => (
              <button
                type="button"
                key={f.id}
                onClick={() => onUpdate?.(activeOverlay.id, { font: f.id })}
                className={cn(
                  'py-1.5 rounded-lg text-[11px] font-bold border cursor-pointer',
                  activeOverlay.font === f.id
                    ? 'border-white bg-white/20 text-white'
                    : 'border-white/15 bg-white/5 text-white/70'
                )}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Background style + alignment */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1">
              {['none', 'pill', 'solid'].map((bg) => (
                <button
                  type="button"
                  key={bg}
                  onClick={() => onUpdate?.(activeOverlay.id, { bgStyle: bg })}
                  className={cn(
                    'px-2.5 py-1 rounded-lg text-[11px] font-bold capitalize border cursor-pointer',
                    activeOverlay.bgStyle === bg
                      ? 'border-white bg-white/20 text-white'
                      : 'border-white/15 bg-white/5 text-white/70'
                  )}
                >
                  {bg}
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
                    onClick={() => onUpdate?.(activeOverlay.id, { align: al.id })}
                    className={cn(
                      'w-8 h-8 rounded-lg flex items-center justify-center border cursor-pointer',
                      activeOverlay.align === al.id
                        ? 'border-white bg-white/20 text-white'
                        : 'border-white/15 bg-white/5 text-white/70'
                    )}
                  >
                    <Icon className="w-3.5 h-3.5" />
                  </button>
                );
              })}
            </div>
          </div>

          {/* Color & Scale */}
          <div className="flex items-center justify-between gap-2">
            {VIBE_COLOR_PALETTE.map((hex) => (
              <button
                type="button"
                key={hex}
                aria-label={`Overlay color ${hex}`}
                onClick={() => onUpdate?.(activeOverlay.id, { color: hex })}
                className={cn(
                  'w-6 h-6 rounded-full border-2 cursor-pointer',
                  activeOverlay.color === hex ? 'border-white scale-115' : 'border-white/30'
                )}
                style={{ backgroundColor: hex }}
              />
            ))}
          </div>

          <label className="block space-y-1">
            <div className="flex items-center justify-between text-[11px] text-white/70">
              <span>Size</span>
              <span>{Math.round((activeOverlay.scale || 1) * 100)}%</span>
            </div>
            <input
              type="range"
              min="0.7"
              max="1.8"
              step="0.05"
              value={activeOverlay.scale || 1}
              onChange={(e) => onUpdate?.(activeOverlay.id, { scale: Number(e.target.value) })}
              className="w-full accent-indigo-500 cursor-pointer"
            />
          </label>
        </div>
      )}
    </div>
  );
}
