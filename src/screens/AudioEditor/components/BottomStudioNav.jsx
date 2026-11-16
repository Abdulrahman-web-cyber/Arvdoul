// src/screens/AudioEditor/components/BottomStudioNav.jsx

import { FolderOpen, Grid, Plus, Mic, Settings } from 'lucide-react';
import { cn } from '../../../lib/utils';
import { BRAND_GRADIENT } from '../../../design-system/tokens.js';

export default function BottomStudioNav({
  isDark = true,
  isRecording = false,
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
          type="button"
          onClick={onOpenMedia}
          className="flex flex-col items-center gap-1 text-[10px] font-semibold hover:text-arvdoul-purple transition cursor-pointer"
        >
          <FolderOpen className="w-4 h-4" />
          <span>Media</span>
        </button>

        {/* Plugins */}
        <button
          type="button"
          onClick={onOpenPlugins}
          className="flex flex-col items-center gap-1 text-[10px] font-semibold hover:text-arvdoul-purple transition cursor-pointer"
        >
          <Grid className="w-4 h-4" />
          <span>Plugins</span>
        </button>

        {/* Elevated Center (+) Import / Add Track Button */}
        <button
          type="button"
          onClick={onOpenMedia}
          className="w-12 h-12 -mt-5 rounded-full flex items-center justify-center text-white shadow-lg hover:scale-105 active:scale-95 transition-all cursor-pointer"
          style={{ background: BRAND_GRADIENT }}
          aria-label="Import Audio Track"
          title="Import Audio Track"
        >
          <Plus className="w-6 h-6 stroke-[2.5]" />
        </button>

        {/* Record Mic */}
        <button
          type="button"
          onClick={onRecord}
          className={cn(
            "flex flex-col items-center gap-1 text-[10px] font-semibold transition cursor-pointer",
            isRecording ? "text-rose-500" : "hover:text-rose-400"
          )}
        >
          <Mic className="w-4 h-4" />
          <span>{isRecording ? 'Stop' : 'Record'}</span>
        </button>

        {/* Settings */}
        <button
          type="button"
          onClick={onOpenSettings}
          className="flex flex-col items-center gap-1 text-[10px] font-semibold hover:text-arvdoul-purple transition cursor-pointer"
        >
          <Settings className="w-4 h-4" />
          <span>Settings</span>
        </button>
      </div>
    </div>
  );
}
