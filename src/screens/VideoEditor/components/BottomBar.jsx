// src/screens/VideoEditor/components/BottomBar.jsx

import { useRef } from "react";
import PropTypes from 'prop-types';
import {
  Image as ImageIcon, Music, Plus, Video, Mic, ChevronUp
} from 'lucide-react';
import { useTheme } from '../../../context/ThemeContext';

export default function BottomBar({
  onOpenMedia,
  onOpenMusic,
  onAddMediaClick,
  onOpenRecord,
  onOpenVoiceover,
}) {
  const fileInputRef = useRef(null);
  const { isDark } = useTheme();

  const handleFileChange = (e) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      onAddMediaClick?.(files[0]);
      e.target.value = '';
    }
  };

  const navBtnClass = isDark
    ? 'text-gray-300 hover:text-white'
    : 'text-gray-700 hover:text-gray-900';
  const navIconClass = isDark ? 'text-gray-300' : 'text-gray-600';

  return (
    <div
      className={`relative z-30 flex items-center justify-between px-4 sm:px-12 py-2 backdrop-blur-xl border-t ${
        isDark ? 'bg-gray-950/90 border-white/10' : 'bg-white/95 border-gray-200'
      }`}
    >
      {/* Hidden File Upload Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="video/*,image/*,audio/*"
        aria-label="Import video, audio, or photo"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Left 1: Media with Chevron Up */}
      <button
        type="button"
        onClick={onOpenMedia}
        className={`flex flex-col items-center justify-center transition-colors group ${navBtnClass}`}
      >
        <div className="flex items-center gap-0.5">
          <ImageIcon className={`w-5 h-5 group-hover:text-purple-400 transition-colors ${navIconClass}`} />
          <ChevronUp className="w-3.5 h-3.5 text-gray-400 -mt-1 group-hover:text-purple-400 transition-colors" />
        </div>
        <span className="text-[11px] font-medium mt-0.5">Media</span>
      </button>

      {/* Left 2: Music */}
      <button
        type="button"
        onClick={onOpenMusic}
        className={`flex flex-col items-center justify-center transition-colors group ${navBtnClass}`}
      >
        <Music className={`w-5 h-5 group-hover:text-emerald-400 transition-colors ${navIconClass}`} />
        <span className="text-[11px] font-medium mt-0.5">Music</span>
      </button>

      {/* Center: Big Shiny Purple Add Button */}
      <div className="relative -top-4">
        <button
          id="editor-big-add-btn"
          type="button"
          onClick={() => fileInputRef.current?.click()}
          aria-label="Import Video, Audio or Photo"
          title="Import Video, Audio or Photo"
          className={`relative group w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-arvdoul-gradient hover:opacity-95 text-white flex items-center justify-center shadow-2xl shadow-purple-600/60 ring-4 transition-all duration-200 active:scale-95 cursor-pointer ${
            isDark ? 'ring-gray-950' : 'ring-white'
          }`}
        >
          <Plus className="w-7 h-7 sm:w-8 sm:h-8 stroke-[2.5] text-white transition-transform group-hover:rotate-90 duration-300" />
          <span className="absolute -inset-1 rounded-full bg-purple-500 opacity-40 blur-md group-hover:opacity-75 transition-opacity pointer-events-none" />
        </button>
      </div>

      {/* Right 1: Record */}
      <button
        type="button"
        onClick={onOpenRecord}
        className={`flex flex-col items-center justify-center transition-colors group ${navBtnClass}`}
      >
        <Video className={`w-5 h-5 group-hover:text-rose-400 transition-colors ${navIconClass}`} />
        <span className="text-[11px] font-medium mt-0.5">Record</span>
      </button>

      {/* Right 2: Voiceover */}
      <button
        type="button"
        onClick={onOpenVoiceover}
        className={`flex flex-col items-center justify-center transition-colors group ${navBtnClass}`}
      >
        <Mic className={`w-5 h-5 group-hover:text-blue-400 transition-colors ${navIconClass}`} />
        <span className="text-[11px] font-medium mt-0.5">Voiceover</span>
      </button>
    </div>
  );
}

BottomBar.propTypes = {
  onOpenMedia: PropTypes.func,
  onOpenMusic: PropTypes.func,
  onAddMediaClick: PropTypes.func,
  onOpenRecord: PropTypes.func,
  onOpenVoiceover: PropTypes.func,
};
