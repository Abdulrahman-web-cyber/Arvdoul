// src/screens/VideoEditor/components/TimelineToolbar.jsx
import React from 'react';
import PropTypes from 'prop-types';
import {
  ArrowLeft, Undo2, Redo2, Trash2, Scissors, Crop, Copy,
  Magnet, ZoomIn, ZoomOut, Settings
} from 'lucide-react';

export default function TimelineToolbar({
  onBack,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  hasSelection,
  onDelete,
  onSplit,
  onCrop,
  onDuplicate,
  isMagnetOn = true,
  onToggleMagnet,
  zoomLevel = 1,
  onZoomChange,
  onOpenSettings,
}) {
  return (
    <div className="flex items-center justify-between px-3 py-2 bg-gray-950/70 dark:bg-gray-950/80 light:bg-white/80 rounded-2xl border border-white/10 dark:border-white/10 light:border-gray-200 backdrop-blur-md">
      {/* Left Editing Tools */}
      <div className="flex items-center gap-1 sm:gap-2">
        <button
          onClick={onBack}
          title="Back"
          className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>

        <button
          onClick={onUndo}
          disabled={!canUndo}
          title="Undo (Ctrl+Z)"
          className={`p-1.5 rounded-lg transition-colors ${
            canUndo ? 'text-gray-300 hover:text-white hover:bg-white/10' : 'text-gray-600 cursor-not-allowed opacity-50'
          }`}
        >
          <Undo2 className="w-4 h-4" />
        </button>

        <button
          onClick={onRedo}
          disabled={!canRedo}
          title="Redo (Ctrl+Y)"
          className={`p-1.5 rounded-lg transition-colors ${
            canRedo ? 'text-gray-300 hover:text-white hover:bg-white/10' : 'text-gray-600 cursor-not-allowed opacity-50'
          }`}
        >
          <Redo2 className="w-4 h-4" />
        </button>

        <div className="w-[1px] h-4 bg-white/15 mx-1" />

        {/* Delete Selection */}
        <button
          onClick={onDelete}
          disabled={!hasSelection}
          title="Delete selected clip (Delete/Backspace)"
          className={`p-1.5 rounded-lg transition-colors ${
            hasSelection ? 'text-rose-400 hover:bg-rose-500/20' : 'text-gray-600 cursor-not-allowed opacity-50'
          }`}
        >
          <Trash2 className="w-4 h-4" />
        </button>

        {/* Split Clip at Playhead */}
        <button
          id="editor-split-btn"
          onClick={onSplit}
          title="Split clip at playhead (S)"
          className="p-1.5 rounded-lg text-indigo-300 hover:text-white hover:bg-indigo-600/30 transition-colors active:scale-95"
        >
          <Scissors className="w-4 h-4" />
        </button>

        {/* Crop / Aspect */}
        <button
          onClick={onCrop}
          title="Crop & Framing"
          className="p-1.5 rounded-lg text-gray-300 hover:text-white hover:bg-white/10 transition-colors active:scale-95"
        >
          <Crop className="w-4 h-4" />
        </button>

        {/* Duplicate Clip */}
        <button
          onClick={onDuplicate}
          disabled={!hasSelection}
          title="Duplicate selected clip"
          className={`p-1.5 rounded-lg transition-colors ${
            hasSelection ? 'text-cyan-300 hover:bg-cyan-500/20' : 'text-gray-600 cursor-not-allowed opacity-50'
          }`}
        >
          <Copy className="w-4 h-4" />
        </button>
      </div>

      {/* Right Tools: Magnet, Zoom Controls, Settings */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Magnet / Snap */}
        <button
          onClick={onToggleMagnet}
          title={isMagnetOn ? 'Snapping Enabled (M)' : 'Snapping Disabled'}
          className={`p-1.5 rounded-lg transition-colors ${
            isMagnetOn
              ? 'text-purple-400 bg-purple-500/20 ring-1 ring-purple-500/30'
              : 'text-gray-400 hover:text-white hover:bg-white/10'
          }`}
        >
          <Magnet className="w-4 h-4" />
        </button>

        {/* Zoom Out */}
        <button
          onClick={() => onZoomChange?.(Math.max(0.5, zoomLevel - 0.25))}
          title="Zoom Out Timeline"
          className="p-1 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
        >
          <ZoomOut className="w-3.5 h-3.5" />
        </button>

        {/* Zoom Slider */}
        <input
          type="range"
          min="0.5"
          max="3"
          step="0.1"
          value={zoomLevel}
          onChange={(e) => onZoomChange?.(parseFloat(e.target.value))}
          className="w-16 sm:w-28 h-1.5 bg-white/20 rounded-lg appearance-none cursor-pointer accent-purple-500"
        />

        {/* Zoom In */}
        <button
          onClick={() => onZoomChange?.(Math.min(3, zoomLevel + 0.25))}
          title="Zoom In Timeline"
          className="p-1 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
        >
          <ZoomIn className="w-3.5 h-3.5" />
        </button>

        {/* Settings */}
        <button
          onClick={onOpenSettings}
          title="Project & Timeline Settings"
          className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
        >
          <Settings className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

TimelineToolbar.propTypes = {
  onBack: PropTypes.func,
  canUndo: PropTypes.bool,
  canRedo: PropTypes.bool,
  onUndo: PropTypes.func,
  onRedo: PropTypes.func,
  hasSelection: PropTypes.bool,
  onDelete: PropTypes.func,
  onSplit: PropTypes.func,
  onCrop: PropTypes.func,
  onDuplicate: PropTypes.func,
  isMagnetOn: PropTypes.bool,
  onToggleMagnet: PropTypes.func,
  zoomLevel: PropTypes.number,
  onZoomChange: PropTypes.func,
  onOpenSettings: PropTypes.func,
};
