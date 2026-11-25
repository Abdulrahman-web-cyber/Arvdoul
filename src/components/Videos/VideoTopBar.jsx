// src/components/Videos/VideoTopBar.jsx

import { memo } from 'react';
import { motion } from 'framer-motion';
import { Search, Camera, Sparkles, LayoutGrid, Smartphone, Flame } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { BRAND_GRADIENT, brandRgba } from '../../design-system/tokens.js';
import ArvdoulLogo, { ArvdoulEmblem } from '../Shared/ArvdoulLogo';
import PropTypes from 'prop-types';

const CHANNELS = [
  { id: 'following', label: 'Following' },
  { id: 'friends', label: 'Friends' },
  { id: 'sparks', label: 'Sparks', featured: true },
  { id: 'for_you', label: 'For You' },
];

const VideoTopBar = memo(({
  activeTab = 'sparks',
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
      className="absolute top-0 left-0 right-0 z-30 pt-3 sm:pt-4 pb-2 px-3 sm:px-5 flex items-center justify-between gap-2 pointer-events-auto select-none bg-gradient-to-b from-black/70 via-black/30 to-transparent"
    >
      {/* Left: Official ARVDOUL Brand Logo */}
      <div className="flex items-center shrink-0">
        <div className="sm:hidden">
          <button
            type="button"
            onClick={() => navigate('/home')}
            aria-label="Arvdoul Home"
            className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-arvdoul-purple"
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

      {/* Center: Channel Tabs (Following | Friends | Sparks | For You) */}
      <nav
        aria-label="Sparks feed channels"
        className="flex items-center gap-1 sm:gap-2 px-1.5 py-0.5 rounded-full bg-black/40 backdrop-blur-2xl border border-white/15 shadow-lg overflow-x-auto no-scrollbar min-w-0"
      >
        {CHANNELS.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onTabChange?.(tab.id)}
              aria-pressed={isActive}
              className={`relative min-h-[40px] px-2.5 sm:px-3.5 text-xs sm:text-sm font-extrabold tracking-wide whitespace-nowrap shrink-0 transition-all flex items-center gap-1 rounded-full ${
                isActive
                  ? 'text-white'
                  : 'text-white/65 hover:text-white/95'
              }`}
            >
              {tab.featured && (
                <Sparkles
                  className={`w-3.5 h-3.5 ${isActive ? 'text-amber-300 fill-amber-300' : 'text-amber-300/80'}`}
                  aria-hidden="true"
                />
              )}
              <span>{tab.label}</span>
              {isActive && (
                <motion.div
                  layoutId="videoTabIndicator"
                  className="absolute bottom-1 left-2.5 right-2.5 h-0.5 rounded-full"
                  style={{
                    background: BRAND_GRADIENT,
                    boxShadow: `0 0 10px ${brandRgba(0.75)}`,
                  }}
                  transition={{ type: 'spring', stiffness: 450, damping: 32 }}
                />
              )}
            </button>
          );
        })}
      </nav>

      {/* Right: View Switch, Reels, Search & Camera Shortcuts */}
      <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
        {onToggleViewMode && (
          <motion.button
            type="button"
            whileTap={{ scale: 0.9 }}
            whileHover={{ scale: 1.05 }}
            onClick={onToggleViewMode}
            className="w-11 h-11 rounded-full bg-black/45 backdrop-blur-xl border border-white/20 flex items-center justify-center text-white/90 hover:text-white hover:bg-white/15 transition-all shadow-lg"
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
            className="w-11 h-11 rounded-full bg-black/45 backdrop-blur-xl border border-white/20 flex items-center justify-center text-amber-300 hover:text-amber-200 hover:bg-white/15 transition-all shadow-lg"
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
          className="w-11 h-11 rounded-full bg-black/45 backdrop-blur-xl border border-white/20 flex items-center justify-center text-white/90 hover:text-white hover:bg-white/15 transition-all shadow-lg"
          title="Search Sparks"
          aria-label="Search Sparks"
        >
          <Search className="w-4 h-4" />
        </motion.button>

        <motion.button
          type="button"
          whileTap={{ scale: 0.9 }}
          whileHover={{ scale: 1.05 }}
          onClick={onCreateVideo || (() => navigate('/create-post?type=video'))}
          className="relative w-11 h-11 rounded-full border border-white/30 flex items-center justify-center text-white shadow-xl transition-transform"
          style={{
            background: BRAND_GRADIENT,
            boxShadow: `0 6px 20px ${brandRgba(0.4)}`,
          }}
          title="Create Spark"
          aria-label="Create Spark"
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
