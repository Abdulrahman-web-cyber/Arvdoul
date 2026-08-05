import React from 'react';
import { WifiOff, RefreshCw, Clock } from 'lucide-react';

export default function OfflineStatusScreen() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-violet-950 to-fuchsia-950 text-white flex flex-col items-center justify-center" aria-label="Offline status" role="main">
      <WifiOff className="w-16 h-16 text-violet-400 mb-4 animate-pulse" aria-hidden="true" />
      <h2 className="text-2xl font-bold mb-2">You're offline</h2>
      <p className="text-white/60 mb-6">Queued operations will sync when you're back.</p>
      <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-5 w-full max-w-md shadow-2xl">
        <div className="flex items-center gap-3 mb-2"><RefreshCw className="w-4 h-4 text-violet-400" /><span className="font-medium">Pending writes: 3</span></div>
        <div className="flex items-center gap-3"><Clock className="w-4 h-4 text-violet-400" /><span className="text-sm text-white/50">Retry in progress…</span></div>
      </div>
    </div>
  );
}
