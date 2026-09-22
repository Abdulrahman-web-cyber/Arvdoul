// src/components/Shared/DrawingTool.jsx - ARVDOUL DRAWING TOOL (REAL)
// Premium freehand drawing controls: brush color presets, size, eraser,
// undo/clear. Controlled component — integrates with the ImageEditor canvas
// drawing engine (drawColor / drawBrushSize / tool mode).
import React, { useState } from 'react';
import { Brush, Eraser, Undo2, Trash2 } from 'lucide-react';
import { cn } from '../../lib/utils';

const COLOR_PRESETS = [
  '#FFFFFF', '#000000', '#FF3B30', '#FF9500', '#FFCC00',
  '#34C759', '#00C7BE', '#007AFF', '#AF52DE', '#FF2D55',
];

export default function DrawingTool({
  color = '#FFFFFF',
  brushSize = 8,
  onColorChange,
  onBrushSizeChange,
  onClear,
  onUndo,
  theme = 'dark',
  isDark,
}) {
  const dark = isDark ?? theme === 'dark';
  const [mode, setMode] = useState('draw'); // 'draw' | 'erase'
  const [size, setSize] = useState(brushSize);

  const applySize = (v) => {
    setSize(v);
    onBrushSizeChange?.(v);
  };

  return (
    <div className={cn(
      'flex flex-col gap-3 p-3 rounded-xl backdrop-blur-md border',
      dark ? 'bg-black/80 border-white/15' : 'bg-white/90 border-gray-200'
    )}>
      {/* Mode toggle */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => { setMode('draw'); onBrushSizeChange?.(size); }}
          className={cn(
            'flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition',
            mode === 'draw' ? 'bg-purple-500 text-white' : dark ? 'bg-white/10 text-gray-300' : 'bg-gray-100 text-gray-600'
          )}
        >
          <Brush className="w-3.5 h-3.5" /> Draw
        </button>
        <button
          onClick={() => { setMode('erase'); onBrushSizeChange?.(size * 2); }}
          className={cn(
            'flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition',
            mode === 'erase' ? 'bg-gray-500 text-white' : dark ? 'bg-white/10 text-gray-300' : 'bg-gray-100 text-gray-600'
          )}
        >
          <Eraser className="w-3.5 h-3.5" /> Erase
        </button>
      </div>

      {/* Color presets */}
      <div className="grid grid-cols-5 gap-2">
        {COLOR_PRESETS.map((c) => (
          <button
            key={c}
            onClick={() => onColorChange?.(c)}
            aria-label={`Brush color ${c}`}
            className={cn(
              'w-7 h-7 rounded-full transition-transform hover:scale-110',
              color === c && 'ring-2 ring-offset-1 ring-purple-500 ring-offset-black'
            )}
            style={{ backgroundColor: c }}
          />
        ))}
      </div>

      {/* Size slider */}
      <div className="flex items-center gap-2">
        <input
          type="range"
          min={1}
          max={40}
          value={size}
          onChange={(e) => applySize(+e.target.value)}
          className="flex-1 accent-purple-500"
          aria-label="Brush size"
        />
        <span className={cn('text-xs font-semibold w-9 text-right', dark ? 'text-gray-300' : 'text-gray-600')}>
          {size}px
        </span>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => onUndo?.()}
          className={cn('flex items-center gap-1 text-xs font-medium px-2 py-1.5 rounded-lg transition', dark ? 'hover:bg-white/10 text-gray-300' : 'hover:bg-gray-100 text-gray-600')}
        >
          <Undo2 className="w-3.5 h-3.5" /> Undo
        </button>
        <button
          onClick={() => onClear?.()}
          className={cn('flex items-center gap-1 text-xs font-medium px-2 py-1.5 rounded-lg transition', 'text-red-500 hover:bg-red-500/10')}
        >
          <Trash2 className="w-3.5 h-3.5" /> Clear
        </button>
      </div>
    </div>
  );
}
