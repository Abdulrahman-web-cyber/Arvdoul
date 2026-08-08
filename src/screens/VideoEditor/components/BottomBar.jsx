// src/screens/VideoEditor/components/BottomBar.jsx
import React, { useRef } from 'react';
import PropTypes from 'prop-types';
import {
  Image as ImageIcon, Music, Plus, Video, Mic, ChevronUp
} from 'lucide-react';

export default function BottomBar({
  onOpenMedia,
  onOpenMusic,
  onAddMediaClick,
  onOpenRecord,
  onOpenVoiceover,
}) {
  const fileInputRef = useRef(null);

  const handleFileChange = (e) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      onAddMediaClick?.(files[0]);
    }
  };

  return (
    <div className="relative z-30 flex items-center justify-between px-4 sm:px-12 py-2 bg-gray-950/80 dark:bg-gray-950/90 light:bg-white/90 backdrop-blur-xl border-t border-white/10 dark:border-white/10 light:border-gray-200">
      {/* Hidden File Upload Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="video/*,image/*,audio/*"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Left 1: Media with Chevron Up */}
      <button
        onClick={onOpenMedia}
        className="flex flex-col items-center justify-center text-gray-300 dark:text-gray-300 light:text-gray-700 hover:text-white dark:hover:text-white light:hover:text-gray-900 transition-colors group"
      >
        <div className="flex items-center gap-0.5">
          <ImageIcon className="w-5 h-5 text-gray-300 group-hover:text-purple-400 transition-colors" />
          <ChevronUp className="w-3.5 h-3.5 text-gray-400 -mt-1 group-hover:text-purple-400 transition-colors" />
        </div>
        <span className="text-[11px] font-medium mt-0.5">Media</span>
      </button>

      {/* Left 2: Music */}
      <button
        onClick={onOpenMusic}
        className="flex flex-col items-center justify-center text-gray-300 dark:text-gray-300 light:text-gray-700 hover:text-white dark:hover:text-white light:hover:text-gray-900 transition-colors group"
      >
        <Music className="w-5 h-5 text-gray-300 group-hover:text-emerald-400 transition-colors" />
        <span className="text-[11px] font-medium mt-0.5">Music</span>
      </button>

      {/* Center: Big Shiny Purple Add Button */}
      <div className="relative -top-4">
        <button
          id="editor-big-add-btn"
          onClick={() => fileInputRef.current?.click()}
          title="Import Video, Audio or Photo"
          className="relative group w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-gradient-to-tr from-purple-600 via-indigo-600 to-blue-500 hover:from-purple-500 hover:via-indigo-500 hover:to-blue-400 text-white flex items-center justify-center shadow-2xl shadow-purple-600/60 ring-4 ring-gray-950 dark:ring-gray-950 light:ring-white transition-all duration-200 active:scale-95 cursor-pointer"
        >
          <Plus className="w-7 h-7 sm:w-8 sm:h-8 stroke-[2.5] text-white transition-transform group-hover:rotate-90 duration-300" />
          <span className="absolute -inset-1 rounded-full bg-purple-500 opacity-40 blur-md group-hover:opacity-75 transition-opacity pointer-events-none" />
        </button>
      </div>

      {/* Right 1: Record */}
      <button
        onClick={onOpenRecord}
        className="flex flex-col items-center justify-center text-gray-300 dark:text-gray-300 light:text-gray-700 hover:text-white dark:hover:text-white light:hover:text-gray-900 transition-colors group"
      >
        <Video className="w-5 h-5 text-gray-300 group-hover:text-rose-400 transition-colors" />
        <span className="text-[11px] font-medium mt-0.5">Record</span>
      </button>

      {/* Right 2: Voiceover */}
      <button
        onClick={onOpenVoiceover}
        className="flex flex-col items-center justify-center text-gray-300 dark:text-gray-300 light:text-gray-700 hover:text-white dark:hover:text-white light:hover:text-gray-900 transition-colors group"
      >
        <Mic className="w-5 h-5 text-gray-300 group-hover:text-blue-400 transition-colors" />
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
