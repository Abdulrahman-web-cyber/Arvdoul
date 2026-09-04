// src/components/Videos/VideoTopBar.jsx - ARVDOUL FLOATING TOP BAR
import React, { memo } from 'react';
import { motion } from 'framer-motion';
import { Search, Camera, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../../context/ThemeContext';
import ArvdoulLogo from '../Shared/ArvdoulLogo';
import PropTypes from 'prop-types';

const VideoTopBar = memo(({
  activeTab = 'for_you',
  onTabChange,
  onOpenSearch,
  onCreateVideo,
}) => {
  const navigate = useNavigate();
  const { isDark } = useTheme();

  return (
    <header 
      id="arvdoul-video-top-bar"
      className="absolute top-0 left-0 right-0 z-30 pt-3 sm:pt-4 pb-2 px-3 sm:px-5 flex items-center justify-between pointer-events-auto select-none"
    >
      {/* Left: Official ARVDOUL Brand Logo */}
      <div className="flex items-center">
        <ArvdoulLogo
          variant="full"
          theme="white"
          size="sm"
          clickable={true}
          onClick={() => navigate('/home')}
        />
      </div>

      {/* Center: Tabs (Following | Sparks | For You) */}
      <div className="flex items-center gap-4 sm:gap-6">
        <button
          onClick={() => onTabChange?.('following')}
          aria-pressed={activeTab === 'following'}
          className={`relative py-1 text-xs sm:text-sm font-extrabold tracking-wide transition-all ${
            activeTab === 'following'
              ? 'text-white scale-105 drop-shadow-md'
              : 'text-white/60 hover:text-white/85'
          }`}
        >
          Following
          {activeTab === 'following' && (
            <motion.div
              layoutId="videoTabIndicator"
              className="absolute -bottom-1 left-1 right-1 h-1 rounded-full bg-gradient-to-r from-purple-500 via-pink-500 to-cyan-400 shadow-md shadow-purple-500/60"
              transition={{ type: 'spring', stiffness: 450, damping: 32 }}
            />
          )}
        </button>

        <button
          onClick={() => onTabChange?.('sparks')}
          aria-pressed={activeTab === 'sparks'}
          className={`relative py-1 text-xs sm:text-sm font-extrabold tracking-wide transition-all flex items-center gap-1.5 ${
            activeTab === 'sparks'
              ? 'text-yellow-300 scale-105 drop-shadow-[0_0_8px_rgba(253,224,71,0.6)]'
              : 'text-white/70 hover:text-yellow-200'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5 fill-current text-yellow-400" />
          <span>Sparks</span>
          {activeTab === 'sparks' && (
            <motion.div
              layoutId="videoTabIndicator"
              className="absolute -bottom-1 left-0 right-0 h-1 rounded-full bg-gradient-to-r from-amber-400 via-rose-500 to-yellow-400 shadow-md shadow-yellow-500/80"
              transition={{ type: 'spring', stiffness: 450, damping: 32 }}
            />
          )}
        </button>

        <button
          onClick={() => onTabChange?.('for_you')}
          aria-pressed={activeTab === 'for_you'}
          className={`relative py-1 text-xs sm:text-sm font-extrabold tracking-wide transition-all ${
            activeTab === 'for_you'
              ? 'text-white scale-105 drop-shadow-md'
              : 'text-white/60 hover:text-white/85'
          }`}
        >
          For You
          {activeTab === 'for_you' && (
            <motion.div
              layoutId="videoTabIndicator"
              className="absolute -bottom-1 left-1 right-1 h-1 rounded-full bg-gradient-to-r from-purple-500 via-pink-500 to-cyan-400 shadow-md shadow-purple-500/60"
              transition={{ type: 'spring', stiffness: 450, damping: 32 }}
            />
          )}
        </button>
      </div>

      {/* Right: Search & Camera Shortcuts */}
      <div className="flex items-center gap-2 sm:gap-3">
        <motion.button
          whileTap={{ scale: 0.9 }}
          whileHover={{ scale: 1.05 }}
          onClick={onOpenSearch || (() => navigate('/search'))}
          className="w-10 h-10 rounded-full bg-black/40 backdrop-blur-xl border border-white/20 flex items-center justify-center text-white/90 hover:text-white hover:bg-white/15 transition-all shadow-lg"
          title="Search Videos"
          aria-label="Search Videos"
        >
          <Search className="w-4.5 h-4.5" />
        </motion.button>

        <motion.button
          whileTap={{ scale: 0.9 }}
          whileHover={{ scale: 1.05 }}
          onClick={onCreateVideo || (() => navigate('/create-post'))}
          className="relative w-10 h-10 rounded-full bg-gradient-to-tr from-purple-600 via-pink-500 to-cyan-400 border border-white/30 flex items-center justify-center text-white shadow-xl shadow-purple-500/30 transition-transform"
          title="Create Video"
          aria-label="Create Video"
        >
          <Camera className="w-4.5 h-4.5" />
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-cyan-400 text-black flex items-center justify-center text-[10px] font-black border border-black shadow-sm">
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
