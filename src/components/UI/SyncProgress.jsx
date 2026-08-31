/**
 * src/components/ui/SyncProgress.jsx - ARVDOUL BACKGROUND SYNC PROGRESS BAR
 *
 * Implements:
 * 1. Visual progress bar showing remaining items in the IndexedDB synchronization queue.
 * 2. Error retry badges and conflict count warnings.
 */

import React from 'react';
import { RefreshCw, Check, AlertTriangle } from 'lucide-react';

export const SyncProgress = ({
  id = 'sync-progress-bar',
  totalItems = 0,
  completedItems = 0,
  isSyncing = false,
  errorCount = 0,
}) => {
  if (totalItems === 0) return null;

  const percent = Math.min(100, Math.round((completedItems / totalItems) * 100));

  return (
    <div
      id={id}
      className="w-full bg-neutral-900 border border-neutral-800 rounded-xl p-4 text-white shadow-md space-y-3"
    >
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-2">
          <RefreshCw className={`w-3.5 h-3.5 text-indigo-400 ${isSyncing ? 'animate-spin' : ''}`} />
          <span className="font-medium text-neutral-200">
            {isSyncing ? 'Syncing with cloud...' : 'Sync Queue'}
          </span>
        </div>
        <span className="text-neutral-400 font-mono">
          {completedItems} / {totalItems} ({percent}%)
        </span>
      </div>

      {/* Progress Track */}
      <div className="w-full h-1.5 bg-neutral-800 rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-indigo-500 to-emerald-400 transition-all duration-300 rounded-full"
          style={{ width: `${percent}%` }}
        />
      </div>

      {errorCount > 0 && (
        <div className="flex items-center gap-1.5 text-xs text-amber-400 pt-1">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
          <span>{errorCount} item{errorCount > 1 ? 's' : ''} require conflict resolution</span>
        </div>
      )}
    </div>
  );
};

export default SyncProgress;
