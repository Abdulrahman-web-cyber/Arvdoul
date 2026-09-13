import React from 'react';
import { Zap, Wifi, BatteryCharging } from 'lucide-react';
import { useDeviceCapabilities } from '../../hooks/useDeviceCapabilities';

export function LowEndModeToggle({ compact = false }) {
  const { capabilities, isLiteMode, toggleLiteMode } = useDeviceCapabilities();

  if (compact) {
    return (
      <button
        id="compact-lite-mode-btn"
        type="button"
        onClick={() => toggleLiteMode(!isLiteMode)}
        aria-label={`Toggle Lite Mode. Currently ${isLiteMode ? 'enabled' : 'disabled'}`}
        className={`px-2.5 py-1 rounded-full text-xs font-medium flex items-center gap-1.5 transition-colors border ${
          isLiteMode
            ? 'bg-amber-500/15 text-amber-400 border-amber-500/30 dark:bg-amber-400/20'
            : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700'
        }`}
      >
        <Zap className={`w-3.5 h-3.5 ${isLiteMode ? 'text-amber-400 fill-amber-400' : 'text-gray-400'}`} />
        <span>{isLiteMode ? 'Lite Mode' : 'Standard'}</span>
      </button>
    );
  }

  return (
    <div className="p-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${isLiteMode ? 'bg-amber-500/20 text-amber-400' : 'bg-gray-100 dark:bg-gray-800 text-gray-500'}`}>
            <Zap className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
              Data Saver & Lite Mode
            </h4>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Optimizes media bitrates, limits animation complexity, and saves mobile battery.
            </p>
          </div>
        </div>

        <button
          id="lite-mode-switch-btn"
          type="button"
          role="switch"
          aria-checked={isLiteMode}
          aria-label="Enable or disable data saver lite mode"
          onClick={() => toggleLiteMode(!isLiteMode)}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 ${
            isLiteMode ? 'bg-amber-500' : 'bg-gray-300 dark:bg-gray-700'
          }`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
              isLiteMode ? 'translate-x-6' : 'translate-x-1'
            }`}
          />
        </button>
      </div>

      <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-800/80 flex items-center justify-between text-xs text-gray-400">
        <span className="flex items-center gap-1.5">
          <Wifi className="w-3.5 h-3.5" />
          Network: {capabilities.effectiveType.toUpperCase()} ({capabilities.networkQuality})
        </span>
        <span className="flex items-center gap-1.5">
          <BatteryCharging className="w-3.5 h-3.5" />
          RAM: {capabilities.memoryGb} GB | Cores: {capabilities.cores}
        </span>
      </div>
    </div>
  );
}

export default LowEndModeToggle;
