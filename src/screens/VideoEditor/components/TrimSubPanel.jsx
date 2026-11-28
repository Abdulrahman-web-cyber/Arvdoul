// src/screens/VideoEditor/components/TrimSubPanel.jsx

import React from 'react';
import PropTypes from 'prop-types';
import { Scissors, Slice, SplitSquareVertical, Trash2, Plus, Minus, ChevronDown, Check } from "lucide-react";
import { formatTimecode } from '../constants';
import { LazyImage } from '../../../components/Shared/LazyImage';
import { useTheme } from '../../../context/ThemeContext';

export default function TrimSubPanel({
  selectedClip,
  activeSubAction = 'trim', // 'trim' | 'cut' | 'split' | 'delete'
  onSelectSubAction,
  startTime = 0,
  endTime = 0,
  duration = 0,
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
  const { isDark } = useTheme();
  const [showSnapMenu, setShowSnapMenu] = React.useState(false);
  const stripRef = React.useRef(null);
  const hasClip = Boolean(selectedClip);
  const isLocked = Boolean(selectedClip?.locked);

  const startHandleDrag = (side) => (e) => {
    if (!hasClip || isLocked || !stripRef.current) return;
    e.preventDefault();
    const startX = e.clientX;
    const origStart = startTime;
    const origEnd = endTime;
    const width = Math.max(120, stripRef.current.getBoundingClientRect().width);
    const clipSpan = Math.max(1, origEnd - origStart, duration || 1);

    const onMove = (ev) => {
      const deltaSec = ((ev.clientX - startX) / width) * clipSpan;
      if (side === 'left') {
        const nextStart = Math.max(0, Math.min(origEnd - 0.5, Number((origStart + deltaSec).toFixed(2))));
        onStartTimeChange?.(nextStart);
      } else {
        const nextEnd = Math.max(origStart + 0.5, Number((origEnd + deltaSec).toFixed(2)));
        onEndTimeChange?.(nextEnd);
      }
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
  };

  const panelClass = isDark
    ? 'bg-gray-950/80 border-white/10 text-gray-200'
    : 'bg-white/95 border-gray-200 text-gray-800';
  const subBtnInactive = isDark
    ? 'text-gray-300 hover:bg-white/10'
    : 'text-gray-700 hover:bg-gray-100';
  const stepperBoxClass = isDark
    ? 'bg-black/50 border-white/10 text-white'
    : 'bg-gray-100 border-gray-200 text-gray-900';
  const stepperBtnClass = isDark
    ? 'text-gray-400 hover:text-white hover:bg-white/10'
    : 'text-gray-500 hover:text-gray-900 hover:bg-gray-200';

  return (
    <div className={`w-full rounded-2xl sm:rounded-3xl p-3 sm:p-4 border backdrop-blur-md shadow-2xl ${panelClass}`}>
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 sm:gap-4 items-center">
        {/* Left Sub-Action Buttons: Trim, Cut, Split, Delete */}
        <div className="lg:col-span-2 flex lg:flex-col gap-1.5 justify-between lg:justify-start">
          <button
            type="button"
            onClick={() => onSelectSubAction?.('trim')}
            className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
              activeSubAction === 'trim'
                ? 'bg-purple-600/25 text-purple-400 border border-purple-500/50 shadow-md shadow-purple-600/20'
                : subBtnInactive
            }`}
          >
            <Scissors className="w-4 h-4 text-purple-400" />
            <span>Trim</span>
          </button>

          <button
            type="button"
            onClick={() => onSelectSubAction?.('cut')}
            className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
              activeSubAction === 'cut'
                ? 'bg-purple-600/25 text-purple-400 border border-purple-500/50'
                : subBtnInactive
            }`}
          >
            <Slice className="w-4 h-4 text-indigo-400" />
            <span>Cut</span>
          </button>

          <button
            type="button"
            onClick={() => onSelectSubAction?.('split')}
            className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
              activeSubAction === 'split'
                ? 'bg-purple-600/25 text-purple-400 border border-purple-500/50'
                : subBtnInactive
            }`}
          >
            <SplitSquareVertical className="w-4 h-4 text-cyan-400" />
            <span>Split</span>
          </button>

          <button
            type="button"
            onClick={() => onSelectSubAction?.('delete')}
            className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
              activeSubAction === 'delete'
                ? 'bg-rose-500/25 text-rose-400 border border-rose-500/50'
                : subBtnInactive
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
            <div className="flex items-center gap-1.5 text-xs">
              <span className="font-medium text-gray-400">Start</span>
              <div className={`flex items-center border rounded-lg overflow-hidden ${stepperBoxClass}`}>
                <button
                  type="button"
                  disabled={!hasClip || isLocked}
                  aria-label="Decrease start time"
                  onClick={() => onStartTimeChange?.(Math.max(0, Number((startTime - 0.1).toFixed(2))))}
                  className={`px-1.5 py-1 disabled:opacity-40 ${stepperBtnClass}`}
                >
                  <Minus className="w-3 h-3" />
                </button>
                <span className="px-2 py-1 font-mono text-[11px]">
                  {formatTimecode(startTime)}
                </span>
                <button
                  type="button"
                  disabled={!hasClip || isLocked}
                  aria-label="Increase start time"
                  onClick={() => onStartTimeChange?.(Math.min(endTime - 0.5, Number((startTime + 0.1).toFixed(2))))}
                  className={`px-1.5 py-1 disabled:opacity-40 ${stepperBtnClass}`}
                >
                  <Plus className="w-3 h-3" />
                </button>
              </div>
            </div>

            {/* End Stepper */}
            <div className="flex items-center gap-1.5 text-xs">
              <span className="font-medium text-gray-400">End</span>
              <div className={`flex items-center border rounded-lg overflow-hidden ${stepperBoxClass}`}>
                <button
                  type="button"
                  disabled={!hasClip || isLocked}
                  aria-label="Decrease end time"
                  onClick={() => onEndTimeChange?.(Math.max(startTime + 0.5, Number((endTime - 0.1).toFixed(2))))}
                  className={`px-1.5 py-1 disabled:opacity-40 ${stepperBtnClass}`}
                >
                  <Minus className="w-3 h-3" />
                </button>
                <span className="px-2 py-1 font-mono text-[11px]">
                  {formatTimecode(endTime)}
                </span>
                <button
                  type="button"
                  disabled={!hasClip || isLocked}
                  aria-label="Increase end time"
                  onClick={() => onEndTimeChange?.(Number((endTime + 0.1).toFixed(2)))}
                  className={`px-1.5 py-1 disabled:opacity-40 ${stepperBtnClass}`}
                >
                  <Plus className="w-3 h-3" />
                </button>
              </div>
            </div>

            {/* Total Trimmed Duration Display */}
            <div className="flex items-center gap-1.5 text-xs">
              <span className="font-medium text-gray-400">Duration</span>
              <span className={`px-2 py-1 border border-purple-500/30 rounded-lg font-mono text-[11px] text-purple-400 font-bold ${isDark ? 'bg-black/50' : 'bg-purple-50'}`}>
                {formatTimecode(Math.max(0, endTime - startTime))}
              </span>
            </div>
          </div>

          {/* Interactive Graphic Filmstrip Frame with Handles */}
          <div ref={stripRef} className="relative h-14 sm:h-16 rounded-2xl bg-black border border-purple-500/80 overflow-hidden shadow-lg flex items-center p-1">
            {!hasClip && (
              <div className="absolute inset-0 flex items-center justify-center text-xs text-gray-400 z-10 pointer-events-none">
                Select a clip on the timeline to trim
              </div>
            )}
            {/* Filmstrip Repeating Video Frames Thumbnail Canvas */}
            <div className="absolute inset-1 flex overflow-hidden rounded-xl opacity-80">
              {Array.from({ length: 8 }).map((_, i) => (
                selectedClip?.thumbnail ? (
                  <LazyImage
                    key={i}
                    src={selectedClip.thumbnail}
                    alt="frame"
                    className="h-full flex-1 object-cover border-r border-black/40"
                  />
                ) : (
                  <div
                    key={i}
                    className="h-full flex-1 bg-gradient-to-br from-purple-900/60 to-gray-900/80 border-r border-black/40"
                  />
                )
              ))}
            </div>

            {/* Left Trim Bracket Handle */}
            <div
              role="slider"
              tabIndex={hasClip && !isLocked ? 0 : -1}
              aria-label="Trim clip start"
              aria-valuenow={startTime}
              onPointerDown={startHandleDrag('left')}
              className={`absolute left-1 top-1 bottom-1 w-4 bg-purple-600 rounded-l-lg flex items-center justify-center z-20 shadow-md border-r border-white/30 touch-none ${hasClip && !isLocked ? 'cursor-ew-resize' : 'opacity-40 cursor-not-allowed'}`}
            >
              <div className="w-1 h-5 bg-white/90 rounded-full" />
            </div>

            {/* Right Trim Bracket Handle */}
            <div
              role="slider"
              tabIndex={hasClip && !isLocked ? 0 : -1}
              aria-label="Trim clip end"
              aria-valuenow={endTime}
              onPointerDown={startHandleDrag('right')}
              className={`absolute right-1 top-1 bottom-1 w-4 bg-purple-600 rounded-r-lg flex items-center justify-center z-20 shadow-md border-l border-white/30 touch-none ${hasClip && !isLocked ? 'cursor-ew-resize' : 'opacity-40 cursor-not-allowed'}`}
            >
              <div className="w-1 h-5 bg-white/90 rounded-full" />
            </div>
          </div>

          {/* Bottom Quick Controls: Ripple Edit & Snap */}
          <div className="flex items-center justify-between text-xs pt-1">
            <label className={`flex items-center gap-2 cursor-pointer select-none ${isDark ? 'text-gray-300 hover:text-white' : 'text-gray-700 hover:text-gray-900'}`}>
              <input
                type="checkbox"
                checked={isRippleEdit}
                onChange={onToggleRippleEdit}
                className="w-4 h-4 rounded text-purple-600 focus:ring-arvdoul-purple bg-black/50 border-white/20"
              />
              <span className="font-semibold">Ripple Edit</span>
            </label>

            {/* Snap Mode Selector */}
            <div className="relative">
              <div className="flex items-center gap-1.5 text-gray-400">
                <span>Snap</span>
                <button
                  type="button"
                  onClick={() => setShowSnapMenu(!showSnapMenu)}
                  className={`flex items-center gap-1 px-2 py-0.5 rounded-lg border font-medium ${stepperBoxClass}`}
                >
                  <span>{snapMode}</span>
                  <ChevronDown className="w-3 h-3 text-gray-400" />
                </button>
              </div>

              {showSnapMenu && (
                <div className={`absolute right-0 bottom-full mb-1 w-28 rounded-xl border shadow-xl p-1 z-30 ${isDark ? 'bg-gray-900 border-white/15' : 'bg-white border-gray-200'}`}>
                  {['Frame', 'Second', 'Clip Edge', 'Marker', 'Off'].map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => {
                        onSelectSnapMode?.(mode);
                        setShowSnapMenu(false);
                      }}
                      className={`w-full text-left px-2 py-1 rounded-lg text-xs flex items-center justify-between ${isDark ? 'text-gray-200 hover:bg-white/10' : 'text-gray-800 hover:bg-gray-100'}`}
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
        <div className={`lg:col-span-3 flex flex-col space-y-2.5 p-2.5 rounded-2xl border ${isDark ? 'bg-black/30 border-white/5 text-gray-300' : 'bg-gray-100/80 border-gray-200 text-gray-700'}`}>
          {/* Speed Slider */}
          <div>
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="font-semibold">Speed</span>
              <span className="font-mono text-purple-400 font-bold">{speed.toFixed(2)}x</span>
            </div>
            <input
              aria-label="Speed"
              type="range"
              min="0.25"
              max="4.0"
              step="0.05"
              value={speed}
              onChange={(e) => onSpeedChange?.(parseFloat(e.target.value))}
              className={`w-full h-1.5 rounded-lg appearance-none cursor-pointer accent-purple-500 ${isDark ? 'bg-white/20' : 'bg-gray-300'}`}
            />
          </div>

          {/* Reverse Switch */}
          <div className="flex items-center justify-between text-xs">
            <span>Reverse</span>
            <button
              type="button"
              onClick={onToggleReverse}
              role="switch"
              aria-checked={isReverse}
              aria-label="Reverse clip"
              className={`w-10 h-5 rounded-full transition-colors relative ${
                isReverse ? 'bg-purple-600' : isDark ? 'bg-white/20' : 'bg-gray-300'
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
          <div className="flex items-center justify-between text-xs">
            <span>Freeze Frame</span>
            <button
              type="button"
              onClick={onToggleFreezeFrame}
              role="switch"
              aria-checked={isFreezeFrame}
              aria-label="Freeze frame"
              className={`w-10 h-5 rounded-full transition-colors relative ${
                isFreezeFrame ? 'bg-purple-600' : isDark ? 'bg-white/20' : 'bg-gray-300'
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
