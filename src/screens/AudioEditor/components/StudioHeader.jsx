// src/screens/AudioEditor/components/StudioHeader.jsx
import React, { useState } from 'react';
import {
  X, Undo2, Redo2, Columns, Download, ChevronDown, Check,
  Share2, Music, Save, Sparkles, Send
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { cn } from '../../../lib/utils';
import ArvdoulLogo from '../../../components/Shared/ArvdoulLogo';

export default function StudioHeader({
  projectName = 'Sunset Beat Mix 01',
  setProjectName,
  onUndo,
  onRedo,
  canUndo = true,
  canRedo = false,
  isSaved = true,
  onExport,
  isDark = true,
}) {
  const navigate = useNavigate();
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const handleExportOption = (format) => {
    setShowExportMenu(false);
    setIsExporting(true);
    toast.loading(`Mastering & exporting ${format}...`, { id: 'audio_export' });

    setTimeout(() => {
      setIsExporting(false);
      toast.success(`${projectName}.${format.toLowerCase()} exported successfully!`, { id: 'audio_export' });

      if (format === 'Post') {
        navigate('/create-post', {
          state: {
            postType: 'audio',
            audioTitle: projectName,
          },
        });
      }
    }, 1200);
  };

  return (
    <header className={cn(
      "sticky top-0 z-30 px-4 py-3 border-b flex items-center justify-between backdrop-blur-xl transition-colors",
      isDark ? "bg-[#03071B]/90 border-white/10 text-white" : "bg-white/90 border-gray-200 text-gray-900 shadow-sm"
    )}>
      {/* Left: Close, Logo & Project Name */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          className={cn(
            "w-9 h-9 rounded-xl flex items-center justify-center border transition cursor-pointer",
            isDark ? "bg-white/5 border-white/10 hover:bg-white/10 text-gray-300" : "bg-gray-100 border-gray-200 hover:bg-gray-200 text-gray-700"
          )}
          title="Exit Studio"
        >
          <X className="w-4 h-4" />
        </button>

        <ArvdoulLogo size={28} showWordmark={false} />

        <div className="flex items-center gap-2">
          <div className="flex flex-col">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-semibold text-purple-400">ARVDOUL</span>
              <span className="text-xs font-bold opacity-60">Audio Studio</span>
            </div>
            <div className="flex items-center gap-1 cursor-pointer">
              <span className="text-sm font-bold truncate max-w-[180px] sm:max-w-xs">{projectName}</span>
              <ChevronDown className="w-3.5 h-3.5 opacity-60" />
            </div>
          </div>
        </div>
      </div>

      {/* Center: Undo, Redo, Split View */}
      <div className="hidden sm:flex items-center gap-1">
        <button
          onClick={onUndo}
          disabled={!canUndo}
          className="p-2 rounded-xl text-gray-400 hover:text-white hover:bg-white/5 disabled:opacity-30 cursor-pointer"
          title="Undo (Ctrl+Z)"
        >
          <Undo2 className="w-4 h-4" />
        </button>
        <button
          onClick={onRedo}
          disabled={!canRedo}
          className="p-2 rounded-xl text-gray-400 hover:text-white hover:bg-white/5 disabled:opacity-30 cursor-pointer"
          title="Redo (Ctrl+Y)"
        >
          <Redo2 className="w-4 h-4" />
        </button>
        <div className="w-px h-5 bg-white/10 mx-1" />
        <button
          className="p-2 rounded-xl text-gray-400 hover:text-white hover:bg-white/5 cursor-pointer"
          title="Split View"
        >
          <Columns className="w-4 h-4" />
        </button>
      </div>

      {/* Right: Saved badge & Export Button */}
      <div className="flex items-center gap-2.5 relative">
        <div className="hidden md:flex items-center gap-1 text-[11px] font-medium text-emerald-400 px-2 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20">
          <Check className="w-3 h-3" />
          <span>Saved</span>
        </div>

        <div className="relative">
          <button
            onClick={() => setShowExportMenu(!showExportMenu)}
            disabled={isExporting}
            className="px-4 py-2 rounded-xl font-bold text-xs text-white shadow-lg flex items-center gap-1.5 hover:scale-105 active:scale-95 transition-all cursor-pointer"
            style={{ background: 'linear-gradient(135deg, #8B1EF3 0%, #4431F7 50%, #055BFB 100%)' }}
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export</span>
            <ChevronDown className="w-3 h-3 ml-0.5 opacity-80" />
          </button>

          {/* Export Dropdown Menu */}
          {showExportMenu && (
            <div className={cn(
              "absolute right-0 mt-2 w-48 rounded-xl border p-1.5 shadow-2xl z-50 backdrop-blur-2xl animate-in fade-in zoom-in-95",
              isDark ? "bg-[#060B24]/95 border-white/10 text-white" : "bg-white border-gray-200 text-gray-900"
            )}>
              <button
                onClick={() => handleExportOption('WAV')}
                className="w-full text-left px-3 py-2 rounded-lg text-xs font-semibold hover:bg-purple-600/20 flex items-center justify-between cursor-pointer"
              >
                <span>Master WAV (24-bit)</span>
                <span className="text-[10px] text-gray-400">HQ</span>
              </button>
              <button
                onClick={() => handleExportOption('MP3')}
                className="w-full text-left px-3 py-2 rounded-lg text-xs font-semibold hover:bg-purple-600/20 flex items-center justify-between cursor-pointer"
              >
                <span>Compressed MP3 (320kbps)</span>
                <span className="text-[10px] text-gray-400">Web</span>
              </button>
              <div className="my-1 border-t border-inherit opacity-40" />
              <button
                onClick={() => handleExportOption('Post')}
                className="w-full text-left px-3 py-2 rounded-lg text-xs font-bold text-purple-400 hover:bg-purple-600/20 flex items-center gap-2 cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Send to Create Post</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
