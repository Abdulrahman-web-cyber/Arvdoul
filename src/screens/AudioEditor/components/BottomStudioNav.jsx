// src/screens/AudioEditor/components/BottomStudioNav.jsx
import React from 'react';
import { FolderOpen, Grid, Plus, Mic, Settings } from 'lucide-react';
import { cn } from '../../../lib/utils';

export default function BottomStudioNav({
  isDark = true,
  onOpenMedia,
  onOpenPlugins,
  onRecord,
  onOpenSettings,
}) {
  return (
    <div className="fixed bottom-3 left-1/2 -translate-x-1/2 z-40">
      <div className={cn(
        "flex items-center gap-6 px-6 py-2.5 rounded-full border backdrop-blur-2xl shadow-2xl transition-colors",
        isDark ? "bg-[#03071B]/90 border-white/10 text-gray-300" : "bg-white/90 border-gray-200 text-gray-700"
      )}>
        {/* Media */}
        <button
          onClick={onOpenMedia}
          className="flex flex-col items-center gap-1 text-[10px] font-semibold hover:text-purple-400 transition cursor-pointer"
        >
          <FolderOpen className="w-4 h-4" />
          <span>Media</span>
        </button>

        {/* Plugins */}
        <button
          onClick={onOpenPlugins}
          className="flex flex-col items-center gap-1 text-[10px] font-semibold hover:text-purple-400 transition cursor-pointer"
        >
          <Grid className="w-4 h-4" />
          <span>Plugins</span>
        </button>

        {/* Elevated Center (+) Record / Add Button */}
        <button
          onClick={onRecord}
          className="w-12 h-12 -mt-5 rounded-full flex items-center justify-center text-white shadow-[0_0_20px_rgba(139,30,243,0.6)] hover:scale-110 active:scale-95 transition-all cursor-pointer"
          style={{ background: 'linear-gradient(135deg, #8B1EF3 0%, #4431F7 50%, #055BFB 100%)' }}
          title="Record / Add Track"
        >
          <Plus className="w-6 h-6 stroke-[2.5]" />
        </button>

        {/* Record Mic */}
        <button
          onClick={onRecord}
          className="flex flex-col items-center gap-1 text-[10px] font-semibold hover:text-rose-400 transition cursor-pointer"
        >
          <Mic className="w-4 h-4" />
          <span>Record</span>
        </button>

        {/* Settings */}
        <button
          onClick={onOpenSettings}
          className="flex flex-col items-center gap-1 text-[10px] font-semibold hover:text-purple-400 transition cursor-pointer"
        >
          <Settings className="w-4 h-4" />
          <span>Settings</span>
        </button>
      </div>
    </div>
  );
}
