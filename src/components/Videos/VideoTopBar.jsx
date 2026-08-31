// src/components/Videos/VideoTopBar.jsx - ARVDOUL FLOATING TOP BAR
import React, { memo } from 'react';
import { motion } from 'framer-motion';
import { Search, Camera, Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../../context/ThemeContext';
import PropTypes from 'prop-types';

const VideoTopBar = memo(({
  activeTab = 'for_you',
  onTabChange,
  onOpenSearch,
  onCreateVideo,
}) => {
  const navigate = useNavigate();
  const { theme, isDark } = useTheme();

  return (
    <header 
      id="arvdoul-video-top-bar"
      className="absolute top-0 left-0 right-0 z-30 pt-4 pb-2 px-4 flex items-center justify-between pointer-events-auto select-none"
    >
      {/* Left: Brand Logo */}
      <div 
        onClick={() => navigate('/home')}
        className="flex items-center gap-2 cursor-pointer group"
      >
        <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-purple-600 via-pink-500 to-cyan-400 flex items-center justify-center shadow-lg shadow-purple-500/30 ring-1 ring-white/20 transition-transform group-hover:scale-105">
          <span className="text-white font-black text-sm tracking-tighter">A</span>
        </div>
        <span className="font-black text-base tracking-widest text-white drop-shadow-md hidden sm:inline-block">
          ARVDOUL
        </span>
      </div>

      {/* Center: Tabs (Following | For You) */}
      <div className="flex items-center gap-6">
        <button
          onClick={() => onTabChange?.('following')}
          aria-pressed={activeTab === 'following'}
          className={`relative py-1 text-sm font-bold tracking-wide transition-all ${
            activeTab === 'following'
              ? 'text-white scale-105'
              : 'text-white/60 hover:text-white/80'
          }`}
        >
          Following
          {activeTab === 'following' && (
            <motion.div
              layoutId="videoTabIndicator"
              className="absolute -bottom-1 left-2 right-2 h-0.5 rounded-full bg-gradient-to-r from-purple-400 to-pink-500 shadow-md shadow-purple-500/50"
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            />
          )}
        </button>

        <button
          onClick={() => onTabChange?.('for_you')}
          aria-pressed={activeTab === 'for_you'}
          className={`relative py-1 text-sm font-bold tracking-wide transition-all ${
            activeTab === 'for_you'
              ? 'text-white scale-105'
              : 'text-white/60 hover:text-white/80'
          }`}
        >
          For You
          {activeTab === 'for_you' && (
            <motion.div
              layoutId="videoTabIndicator"
              className="absolute -bottom-1 left-2 right-2 h-0.5 rounded-full bg-gradient-to-r from-purple-400 to-pink-500 shadow-md shadow-purple-500/50"
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            />
          )}
        </button>
      </div>

      {/* Right: Search & Create Shortcuts */}
      <div className="flex items-center gap-2.5">
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={onOpenSearch || (() => navigate('/search'))}
          className="w-9 h-9 rounded-full bg-black/40 backdrop-blur-xl border border-white/15 flex items-center justify-center text-white/90 hover:text-white hover:bg-white/10 transition-all shadow-md"
          title="Search Videos"
          aria-label="Search Videos"
        >
          <Search className="w-4 h-4" />
        </motion.button>

        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={onCreateVideo || (() => navigate('/create-post'))}
          className="relative w-9 h-9 rounded-full bg-gradient-to-tr from-purple-600 to-pink-600 border border-white/20 flex items-center justify-center text-white shadow-lg shadow-purple-500/25 transition-transform hover:scale-105"
          title="Create Video"
          aria-label="Create Video"
        >
          <Camera className="w-4 h-4" />
          <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-cyan-400 text-black flex items-center justify-center text-[9px] font-black border border-black">
            +
          </span>
        </motion.button>
      </div>
    </header>
  );
});

VideoTopBar.displayName = 'VideoTopBar';
VideoTopBar.propTypes = {
  activeTab: PropTypes.string,
  onTabChange: PropTypes.func,
  onOpenSearch: PropTypes.func,
  onCreateVideo: PropTypes.func,
};

export default VideoTopBar;
