// src/components/Videos/VideoTopBar.jsx

import { memo } from "react";
import { motion } from 'framer-motion';
import { Search, Camera, Sparkles, LayoutGrid, Smartphone, Flame } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { BRAND_GRADIENT } from '../../design-system/tokens.js';
import ArvdoulLogo, { ArvdoulEmblem } from '../Shared/ArvdoulLogo';
import PropTypes from 'prop-types';

const VideoTopBar = memo(({
  activeTab = 'for_you',
  onTabChange,
  onOpenSearch,
  onCreateVideo,
  viewMode = 'feed',
  onToggleViewMode,
  onOpenReels,
}) => {
  const navigate = useNavigate();

  return (
    <header
      id="arvdoul-video-top-bar"
      className="absolute top-0 left-0 right-0 z-30 pt-3 sm:pt-4 pb-2 px-3 sm:px-5 flex items-center justify-between gap-2 pointer-events-auto select-none"
    >
      {/* Left: Official ARVDOUL Brand Logo (emblem on compact screens to avoid crowding) */}
      <div className="flex items-center shrink-0">
        <div className="sm:hidden">
          <button
            type="button"
            onClick={() => navigate('/home')}
            aria-label="Arvdoul Home"
            className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-arvdoul-purple"
          >
            <ArvdoulEmblem size={30} />
          </button>
        </div>
        <div className="hidden sm:block">
          <ArvdoulLogo
            variant="full"
            theme="white"
            size="sm"
            clickable={true}
            onClick={() => navigate('/home')}
          />
        </div>
      </div>

      {/* Center: Tabs (Following | Sparks | For You) */}
      <nav aria-label="Video feed channels" className="flex items-center gap-3 sm:gap-6 min-w-0">
        <button
          type="button"
          onClick={() => onTabChange?.('following')}
          aria-pressed={activeTab === 'following'}
          className={`relative min-h-[44px] px-1 text-xs sm:text-sm font-extrabold tracking-wide whitespace-nowrap shrink-0 transition-all ${
            activeTab === 'following'
              ? 'text-white scale-105 drop-shadow-md'
              : 'text-white/65 hover:text-white/90'
          }`}
        >
          Following
          {activeTab === 'following' && (
            <motion.div
              layoutId="videoTabIndicator"
              className="absolute bottom-1 left-1 right-1 h-1 rounded-full shadow-md shadow-purple-500/60"
              style={{ background: BRAND_GRADIENT }}
              transition={{ type: 'spring', stiffness: 450, damping: 32 }}
            />
          )}
        </button>

        <button
          type="button"
          onClick={() => onTabChange?.('sparks')}
          aria-pressed={activeTab === 'sparks'}
          className={`relative min-h-[44px] px-1 text-xs sm:text-sm font-extrabold tracking-wide whitespace-nowrap shrink-0 transition-all flex items-center gap-1 ${
            activeTab === 'sparks'
              ? 'text-yellow-300 scale-105 drop-shadow-[0_0_8px_rgba(253,224,71,0.6)]'
              : 'text-white/75 hover:text-yellow-200'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5 fill-current text-yellow-400" aria-hidden="true" />
          <span>Sparks</span>
          {activeTab === 'sparks' && (
            <motion.div
              layoutId="videoTabIndicator"
              className="absolute bottom-1 left-0 right-0 h-1 rounded-full bg-gradient-to-r from-amber-400 via-rose-500 to-yellow-400 shadow-md shadow-yellow-500/80"
              transition={{ type: 'spring', stiffness: 450, damping: 32 }}
            />
          )}
        </button>

        <button
          type="button"
          onClick={() => onTabChange?.('for_you')}
          aria-pressed={activeTab === 'for_you'}
          className={`relative min-h-[44px] px-1 text-xs sm:text-sm font-extrabold tracking-wide whitespace-nowrap shrink-0 transition-all ${
            activeTab === 'for_you'
              ? 'text-white scale-105 drop-shadow-md'
              : 'text-white/65 hover:text-white/90'
          }`}
        >
          For You
          {activeTab === 'for_you' && (
            <motion.div
              layoutId="videoTabIndicator"
              className="absolute bottom-1 left-1 right-1 h-1 rounded-full shadow-md shadow-purple-500/60"
              style={{ background: BRAND_GRADIENT }}
              transition={{ type: 'spring', stiffness: 450, damping: 32 }}
            />
          )}
        </button>
      </nav>

      {/* Right: View Switch, Reels, Search & Camera Shortcuts */}
      <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
        {onToggleViewMode && (
          <motion.button
            type="button"
            whileTap={{ scale: 0.9 }}
            whileHover={{ scale: 1.05 }}
            onClick={onToggleViewMode}
            className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-black/45 backdrop-blur-xl border border-white/20 flex items-center justify-center text-white/90 hover:text-white hover:bg-white/15 transition-all shadow-lg"
            title={viewMode === 'feed' ? 'Explore Grid View' : 'Sparks Feed'}
            aria-label={viewMode === 'feed' ? 'Switch to Grid view' : 'Switch to Sparks feed'}
          >
            {viewMode === 'feed' ? (
              <LayoutGrid className="w-4 h-4" />
            ) : (
              <Smartphone className="w-4 h-4" />
            )}
          </motion.button>
        )}

        {onOpenReels && (
          <motion.button
            type="button"
            whileTap={{ scale: 0.9 }}
            whileHover={{ scale: 1.05 }}
            onClick={onOpenReels}
            className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-black/45 backdrop-blur-xl border border-white/20 flex items-center justify-center text-pink-300 hover:text-pink-200 hover:bg-white/15 transition-all shadow-lg"
            title="Open Fullscreen Reels"
            aria-label="Open Fullscreen Reels"
          >
            <Flame className="w-4 h-4" />
          </motion.button>
        )}

        <motion.button
          type="button"
          whileTap={{ scale: 0.9 }}
          whileHover={{ scale: 1.05 }}
          onClick={onOpenSearch || (() => navigate('/search'))}
          className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-black/45 backdrop-blur-xl border border-white/20 flex items-center justify-center text-white/90 hover:text-white hover:bg-white/15 transition-all shadow-lg"
          title="Search Videos"
          aria-label="Search Videos"
        >
          <Search className="w-4 h-4" />
        </motion.button>

        <motion.button
          type="button"
          whileTap={{ scale: 0.9 }}
          whileHover={{ scale: 1.05 }}
          onClick={onCreateVideo || (() => navigate('/create-post'))}
          className="relative w-10 h-10 sm:w-11 sm:h-11 rounded-full border border-white/30 flex items-center justify-center text-white shadow-xl shadow-purple-500/30 transition-transform"
          style={{ background: BRAND_GRADIENT }}
          title="Create Video"
          aria-label="Create Video"
        >
          <Camera className="w-4 h-4" />
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
  viewMode: PropTypes.string,
  onToggleViewMode: PropTypes.func,
  onOpenReels: PropTypes.func,
};

export default VideoTopBar;
