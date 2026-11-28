// src/screens/VideoEditor/components/TimelineToolbar.jsx

import PropTypes from 'prop-types';
import {
  Undo2, Redo2, Trash2, Scissors, Copy,
  Magnet, ZoomIn, ZoomOut
} from 'lucide-react';
import { useTheme } from '../../../context/ThemeContext';

export default function TimelineToolbar({
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  hasSelection,
  onDelete,
  onSplit,
  onDuplicate,
  isMagnetOn = true,
  onToggleMagnet,
  zoomLevel = 1,
  onZoomChange,
}) {
  const { isDark } = useTheme();
  const neutralBtn = isDark
    ? 'text-gray-300 hover:text-white hover:bg-white/10'
    : 'text-gray-700 hover:text-gray-900 hover:bg-gray-100';
  const disabledBtn = isDark
    ? 'text-gray-600 cursor-not-allowed opacity-50'
    : 'text-gray-400 cursor-not-allowed opacity-50';

  return (
    <div
      className={`flex items-center justify-between px-3 py-2 rounded-2xl border backdrop-blur-md ${
        isDark ? 'bg-gray-950/80 border-white/10' : 'bg-white/90 border-gray-200'
      }`}
    >
      {/* Left Editing Tools */}
      <div className="flex items-center gap-1 sm:gap-2">
        <button
          type="button"
          onClick={onUndo}
          disabled={!canUndo}
          aria-label="Undo edit"
          title="Undo (Ctrl+Z)"
          className={`p-1.5 rounded-lg transition-colors ${canUndo ? neutralBtn : disabledBtn}`}
        >
          <Undo2 className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={onRedo}
          disabled={!canRedo}
          aria-label="Redo edit"
          title="Redo (Ctrl+Shift+Z)"
          className={`p-1.5 rounded-lg transition-colors ${canRedo ? neutralBtn : disabledBtn}`}
        >
          <Redo2 className="w-4 h-4" />
        </button>

        <div className={`w-[1px] h-4 mx-1 ${isDark ? 'bg-white/15' : 'bg-gray-200'}`} />

        {/* Delete Selection */}
        <button
          type="button"
          onClick={onDelete}
          disabled={!hasSelection}
          aria-label="Delete selected clip"
          title="Delete selected clip (Delete/Backspace)"
          className={`p-1.5 rounded-lg transition-colors ${
            hasSelection
              ? 'text-rose-500 hover:bg-rose-500/20'
              : disabledBtn
          }`}
        >
          <Trash2 className="w-4 h-4" />
        </button>

        {/* Split Clip at Playhead */}
        <button
          id="editor-split-btn"
          type="button"
          onClick={onSplit}
          disabled={!hasSelection}
          aria-label="Split clip at playhead"
          title="Split clip at playhead (S)"
          className={`p-1.5 rounded-lg transition-colors active:scale-95 ${
            hasSelection
              ? isDark
                ? 'text-indigo-300 hover:text-white hover:bg-indigo-600/30'
                : 'text-indigo-600 hover:text-indigo-800 hover:bg-indigo-100'
              : disabledBtn
          }`}
        >
          <Scissors className="w-4 h-4" />
        </button>

        {/* Duplicate Clip */}
        <button
          type="button"
          onClick={onDuplicate}
          disabled={!hasSelection}
          aria-label="Duplicate selected clip"
          title="Duplicate selected clip"
          className={`p-1.5 rounded-lg transition-colors ${
            hasSelection
              ? isDark
                ? 'text-cyan-300 hover:bg-cyan-500/20'
                : 'text-cyan-700 hover:bg-cyan-100'
              : disabledBtn
          }`}
        >
          <Copy className="w-4 h-4" />
        </button>
      </div>

      {/* Right Tools: Magnet, Zoom Controls */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Magnet / Snap */}
        <button
          type="button"
          onClick={onToggleMagnet}
          aria-label={isMagnetOn ? 'Disable snapping' : 'Enable snapping'}
          title={isMagnetOn ? 'Snapping Enabled (M)' : 'Snapping Disabled'}
          className={`p-1.5 rounded-lg transition-colors ${
            isMagnetOn
              ? 'text-purple-500 bg-purple-500/20 ring-1 ring-purple-500/30'
              : neutralBtn
          }`}
        >
          <Magnet className="w-4 h-4" />
        </button>

        {/* Zoom Out */}
        <button
          type="button"
          onClick={() => onZoomChange?.(Math.max(0.5, Number((zoomLevel - 0.25).toFixed(2))))}
          aria-label="Zoom out timeline"
          title="Zoom Out Timeline"
          className={`p-1 rounded-lg transition-colors ${neutralBtn}`}
        >
          <ZoomOut className="w-3.5 h-3.5" />
        </button>

        {/* Zoom Slider */}
        <input
          aria-label="Timeline zoom"
          type="range"
          min="0.5"
          max="3"
          step="0.1"
          value={zoomLevel}
          onChange={(e) => onZoomChange?.(parseFloat(e.target.value))}
          className={`w-16 sm:w-28 h-1.5 rounded-lg appearance-none cursor-pointer accent-purple-500 ${
            isDark ? 'bg-white/20' : 'bg-gray-200'
          }`}
        />

        {/* Zoom In */}
        <button
          type="button"
          onClick={() => onZoomChange?.(Math.min(3, Number((zoomLevel + 0.25).toFixed(2))))}
          aria-label="Zoom in timeline"
          title="Zoom In Timeline"
          className={`p-1 rounded-lg transition-colors ${neutralBtn}`}
        >
          <ZoomIn className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

TimelineToolbar.propTypes = {
  canUndo: PropTypes.bool,
  canRedo: PropTypes.bool,
  onUndo: PropTypes.func,
  onRedo: PropTypes.func,
  hasSelection: PropTypes.bool,
  onDelete: PropTypes.func,
  onSplit: PropTypes.func,
  onDuplicate: PropTypes.func,
  isMagnetOn: PropTypes.bool,
  onToggleMagnet: PropTypes.func,
  zoomLevel: PropTypes.number,
  onZoomChange: PropTypes.func,
};
