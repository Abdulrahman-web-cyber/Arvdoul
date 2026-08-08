// src/screens/VideoEditor/components/TrimSubPanel.jsx
import React from 'react';
import PropTypes from 'prop-types';
import { motion } from 'framer-motion';
import {
  Scissors, Slice, SplitSquareVertical, Trash2,
  Plus, Minus, ChevronDown, Check, Sparkles
} from 'lucide-react';
import { formatTimecode } from '../constants';

export default function TrimSubPanel({
  selectedClip,
  activeSubAction = 'trim', // 'trim' | 'cut' | 'split' | 'delete'
  onSelectSubAction,
  startTime = 2.4,
  endTime = 28.5,
  duration = 26.1,
  onStartTimeChange,
  onEndTimeChange,
  speed = 1.0,
  onSpeedChange,
  isReverse = false,
  onToggleReverse,
  isFreezeFrame = false,
  onToggleFreezeFrame,
  isRippleEdit = true,
  onToggleRippleEdit,
  snapMode = 'Frame',
  onSelectSnapMode,
}) {
  const [showSnapMenu, setShowSnapMenu] = React.useState(false);

  return (
    <div className="w-full bg-gray-950/70 dark:bg-gray-950/80 light:bg-white/80 rounded-2xl sm:rounded-3xl p-3 sm:p-4 border border-white/10 dark:border-white/10 light:border-gray-200 backdrop-blur-md shadow-2xl">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 sm:gap-4 items-center">
        {/* Left Sub-Action Buttons: Trim, Cut, Split, Delete */}
        <div className="lg:col-span-2 flex lg:flex-col gap-1.5 justify-between lg:justify-start">
          <button
            onClick={() => onSelectSubAction?.('trim')}
            className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
              activeSubAction === 'trim'
                ? 'bg-purple-600/30 text-purple-300 border border-purple-500/50 shadow-md shadow-purple-600/20'
                : 'text-gray-300 hover:bg-white/10'
            }`}
          >
            <Scissors className="w-4 h-4 text-purple-400" />
            <span>Trim</span>
          </button>

          <button
            onClick={() => onSelectSubAction?.('cut')}
            className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
              activeSubAction === 'cut'
                ? 'bg-purple-600/30 text-purple-300 border border-purple-500/50'
                : 'text-gray-300 hover:bg-white/10'
            }`}
          >
            <Slice className="w-4 h-4 text-indigo-400" />
            <span>Cut</span>
          </button>

          <button
            onClick={() => onSelectSubAction?.('split')}
            className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
              activeSubAction === 'split'
                ? 'bg-purple-600/30 text-purple-300 border border-purple-500/50'
                : 'text-gray-300 hover:bg-white/10'
            }`}
          >
            <SplitSquareVertical className="w-4 h-4 text-cyan-400" />
            <span>Split</span>
          </button>

          <button
            onClick={() => onSelectSubAction?.('delete')}
            className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
              activeSubAction === 'delete'
                ? 'bg-rose-500/30 text-rose-300 border border-rose-500/50'
                : 'text-gray-300 hover:bg-white/10'
            }`}
          >
            <Trash2 className="w-4 h-4 text-rose-400" />
            <span>Delete</span>
          </button>
        </div>

        {/* Center: Filmstrip Trimmer & Start/End Timecode Pickers */}
        <div className="lg:col-span-7 flex flex-col space-y-3">
          {/* Top Numeric Time Steppers (Start, End, Duration) */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            {/* Start Stepper */}
            <div className="flex items-center gap-1.5 text-xs text-gray-300">
              <span className="font-medium text-gray-400">Start</span>
              <div className="flex items-center bg-black/50 border border-white/10 rounded-lg overflow-hidden">
                <button
                  onClick={() => onStartTimeChange?.(Math.max(0, startTime - 0.1))}
                  className="px-1.5 py-1 text-gray-400 hover:text-white hover:bg-white/10"
                >
                  <Minus className="w-3 h-3" />
                </button>
                <span className="px-2 py-1 font-mono text-[11px] text-white">
                  {formatTimecode(startTime)}
                </span>
                <button
                  onClick={() => onStartTimeChange?.(Math.min(endTime - 0.5, startTime + 0.1))}
                  className="px-1.5 py-1 text-gray-400 hover:text-white hover:bg-white/10"
                >
                  <Plus className="w-3 h-3" />
                </button>
              </div>
            </div>

            {/* End Stepper */}
            <div className="flex items-center gap-1.5 text-xs text-gray-300">
              <span className="font-medium text-gray-400">End</span>
              <div className="flex items-center bg-black/50 border border-white/10 rounded-lg overflow-hidden">
                <button
                  onClick={() => onEndTimeChange?.(Math.max(startTime + 0.5, endTime - 0.1))}
                  className="px-1.5 py-1 text-gray-400 hover:text-white hover:bg-white/10"
                >
                  <Minus className="w-3 h-3" />
                </button>
                <span className="px-2 py-1 font-mono text-[11px] text-white">
                  {formatTimecode(endTime)}
                </span>
                <button
                  onClick={() => onEndTimeChange?.(endTime + 0.1)}
                  className="px-1.5 py-1 text-gray-400 hover:text-white hover:bg-white/10"
                >
                  <Plus className="w-3 h-3" />
                </button>
              </div>
            </div>

            {/* Total Trimmed Duration Display */}
            <div className="flex items-center gap-1.5 text-xs text-gray-300">
              <span className="font-medium text-gray-400">Duration</span>
              <span className="px-2 py-1 bg-black/50 border border-purple-500/30 rounded-lg font-mono text-[11px] text-purple-300 font-bold">
                {formatTimecode(Math.max(0, endTime - startTime))}
              </span>
            </div>
          </div>

          {/* Interactive Graphic Filmstrip Frame with Handles */}
          <div className="relative h-14 sm:h-16 rounded-2xl bg-black border border-purple-500/80 overflow-hidden shadow-lg flex items-center p-1">
            {/* Filmstrip Repeating Video Frames Thumbnail Canvas */}
            <div className="absolute inset-1 flex overflow-hidden rounded-xl opacity-80">
              {Array.from({ length: 8 }).map((_, i) => (
                <img
                  key={i}
                  src={selectedClip?.thumbnail || 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=300&q=80'}
                  alt="frame"
                  className="h-full flex-1 object-cover border-r border-black/40"
                />
              ))}
            </div>

            {/* Left Trim Bracket Handle */}
            <div className="absolute left-1 top-1 bottom-1 w-4 bg-purple-600 rounded-l-lg flex items-center justify-center cursor-ew-resize z-20 shadow-md border-r border-white/30">
              <div className="w-1 h-5 bg-white/90 rounded-full" />
            </div>

            {/* Right Trim Bracket Handle */}
            <div className="absolute right-1 top-1 bottom-1 w-4 bg-purple-600 rounded-r-lg flex items-center justify-center cursor-ew-resize z-20 shadow-md border-l border-white/30">
              <div className="w-1 h-5 bg-white/90 rounded-full" />
            </div>
          </div>

          {/* Bottom Quick Controls: Ripple Edit & Snap */}
          <div className="flex items-center justify-between text-xs pt-1">
            <label className="flex items-center gap-2 cursor-pointer select-none text-gray-300 hover:text-white">
              <input
                type="checkbox"
                checked={isRippleEdit}
                onChange={onToggleRippleEdit}
                className="w-4 h-4 rounded text-purple-600 focus:ring-purple-500 bg-black/50 border-white/20"
              />
              <span className="font-semibold">Ripple Edit</span>
            </label>

            {/* Snap Mode Selector */}
            <div className="relative">
              <div className="flex items-center gap-1.5 text-gray-400">
                <span>Snap</span>
                <button
                  onClick={() => setShowSnapMenu(!showSnapMenu)}
                  className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-black/50 border border-white/10 text-white font-medium hover:border-white/20"
                >
                  <span>{snapMode}</span>
                  <ChevronDown className="w-3 h-3 text-gray-400" />
                </button>
              </div>

              {showSnapMenu && (
                <div className="absolute right-0 bottom-full mb-1 w-28 rounded-xl bg-gray-900 border border-white/15 shadow-xl p-1 z-30">
                  {['Frame', 'Second', 'Clip Edge', 'Marker', 'Off'].map((mode) => (
                    <button
                      key={mode}
                      onClick={() => {
                        onSelectSnapMode?.(mode);
                        setShowSnapMenu(false);
                      }}
                      className="w-full text-left px-2 py-1 rounded-lg text-xs text-gray-200 hover:bg-white/10 flex items-center justify-between"
                    >
                      <span>{mode}</span>
                      {snapMode === mode && <Check className="w-3 h-3 text-purple-400" />}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Controls: Speed Slider, Reverse Toggle, Freeze Frame */}
        <div className="lg:col-span-3 flex flex-col space-y-2.5 bg-black/30 p-2.5 rounded-2xl border border-white/5">
          {/* Speed Slider */}
          <div>
            <div className="flex items-center justify-between text-xs text-gray-300 mb-1">
              <span className="font-semibold">Speed</span>
              <span className="font-mono text-purple-400 font-bold">{speed.toFixed(2)}x</span>
            </div>
            <input
              type="range"
              min="0.25"
              max="4.0"
              step="0.05"
              value={speed}
              onChange={(e) => onSpeedChange?.(parseFloat(e.target.value))}
              className="w-full h-1.5 bg-white/20 rounded-lg appearance-none cursor-pointer accent-purple-500"
            />
          </div>

          {/* Reverse Switch */}
          <div className="flex items-center justify-between text-xs text-gray-300">
            <span>Reverse</span>
            <button
              onClick={onToggleReverse}
              className={`w-10 h-5 rounded-full transition-colors relative ${
                isReverse ? 'bg-purple-600' : 'bg-white/20'
              }`}
            >
              <div
                className={`w-4 h-4 rounded-full bg-white transition-transform ${
                  isReverse ? 'translate-x-5' : 'translate-x-0.5'
                }`}
              />
            </button>
          </div>

          {/* Freeze Frame Switch */}
          <div className="flex items-center justify-between text-xs text-gray-300">
            <span>Freeze Frame</span>
            <button
              onClick={onToggleFreezeFrame}
              className={`w-10 h-5 rounded-full transition-colors relative ${
                isFreezeFrame ? 'bg-purple-600' : 'bg-white/20'
              }`}
            >
              <div
                className={`w-4 h-4 rounded-full bg-white transition-transform ${
                  isFreezeFrame ? 'translate-x-5' : 'translate-x-0.5'
                }`}
              />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

TrimSubPanel.propTypes = {
  selectedClip: PropTypes.object,
  activeSubAction: PropTypes.string,
  onSelectSubAction: PropTypes.func,
  startTime: PropTypes.number,
  endTime: PropTypes.number,
  duration: PropTypes.number,
  onStartTimeChange: PropTypes.func,
  onEndTimeChange: PropTypes.func,
  speed: PropTypes.number,
  onSpeedChange: PropTypes.func,
  isReverse: PropTypes.bool,
  onToggleReverse: PropTypes.func,
  isFreezeFrame: PropTypes.bool,
  onToggleFreezeFrame: PropTypes.func,
  isRippleEdit: PropTypes.bool,
  onToggleRippleEdit: PropTypes.func,
  snapMode: PropTypes.string,
  onSelectSnapMode: PropTypes.func,
};
