import { useEffect, useState } from 'react';
import { WifiOff, Wifi, RefreshCw, Clock, CheckCircle2 } from 'lucide-react';
import { subscribeSyncStatus, syncQueue } from '../offline/syncEngine.js';

const formatTime = (ts) => {
  if (!ts) return 'Never';
  try { return new Date(ts).toLocaleTimeString(); } catch { return 'Unknown'; }
};

export default function OfflineStatusScreen() {
  const [status, setStatus] = useState({ isOnline: true, isSyncing: false, pendingCount: 0, lastSyncTime: null });

  useEffect(() => subscribeSyncStatus(setStatus), []);

  const { isOnline, isSyncing, pendingCount, lastSyncTime } = status;
  const Icon = isOnline ? Wifi : WifiOff;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-violet-950 to-fuchsia-950 text-white flex flex-col items-center justify-center px-4" aria-label="Connection and sync status" role="main">
      <Icon className={`w-16 h-16 mb-4 ${isOnline ? 'text-emerald-400' : 'text-violet-400 animate-pulse'}`} aria-hidden="true" />
      <h2 className="text-2xl font-bold mb-2">{isOnline ? "You're online" : "You're offline"}</h2>
      <p className="text-white/60 mb-6 text-center">
        {isOnline
          ? 'Pending changes sync automatically.'
          : 'Queued changes will sync when your connection returns.'}
      </p>

      <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-5 w-full max-w-md shadow-2xl" aria-live="polite">
        <div className="flex items-center gap-3 mb-3">
          {pendingCount > 0 ? (
            <RefreshCw className={`w-4 h-4 text-violet-400 ${isSyncing ? 'animate-spin' : ''}`} aria-hidden="true" />
          ) : (
            <CheckCircle2 className="w-4 h-4 text-emerald-400" aria-hidden="true" />
          )}
          <span className="font-medium">
            {pendingCount > 0
              ? `${pendingCount} pending ${pendingCount === 1 ? 'change' : 'changes'}`
              : 'All changes synced'}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <Clock className="w-4 h-4 text-violet-400" aria-hidden="true" />
          <span className="text-sm text-white/50">
            {isSyncing ? 'Syncing…' : `Last synced: ${formatTime(lastSyncTime)}`}
          </span>
        </div>

        {isOnline && pendingCount > 0 && !isSyncing && (
          <button
            type="button"
            onClick={() => syncQueue().catch(() => {})}
            className="mt-4 w-full rounded-xl bg-white/10 hover:bg-white/20 transition px-4 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-violet-400"
          >
            Sync now
          </button>
        )}
      </div>
    </div>
  );
}
