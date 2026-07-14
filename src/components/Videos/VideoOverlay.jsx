// src/components/Videos/VideoOverlay.jsx - ARVDOUL VIDEO OVERLAY
// Floating glass overlay with playback controls

import React, { memo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  PictureInPicture2,
  Repeat,
  SkipBack,
  SkipForward,
} from 'lucide-react';
import { useVideoStore } from '../../store/videoStore';
import { ARVDOUL_GRADIENT, SPRING_ANIMATION, formatDuration } from '../../utils/videoUtils';
import PropTypes from 'prop-types';

/**
 * VideoOverlay - Glass overlay with playback controls
 * Appears on tap, auto-hides after 3 seconds
 */
const VideoOverlay = memo(({
  isVisible = true,
  video,
  currentTime = 0,
  duration = 0,
  progress = 0,
  buffered = 0,
  isPlaying = false,
  onTogglePlay,
  onSeek,
  onToggleFullscreen,
  onTogglePip,
  onToggleMute,
  onToggleLoop,
}) => {
  const { isDark } = useTheme();
  const { volume, isMuted, isLooping, isFullscreen, isPip, toggleMute, toggleLoop } = useVideoStore();
  const [showVolumeSlider, setShowVolumeSlider] = useState(false);

  const handleProgressClick = (e) => {
    if (!duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const percentage = Math.max(0, Math.min(1, clickX / rect.width));
    onSeek?.(percentage * duration);
  };

  const handleVolumeClick = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const newVolume = Math.max(0, Math.min(1, clickX / rect.width));
    // Volume is handled by store
  };

  if (!isVisible) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="absolute inset-0 pointer-events-none"
      >
        {/* Top Gradient */}
        <div className="absolute top-0 left-0 right-0 h-24 bg-gradient-to-b from-black/50 to-transparent pointer-events-auto" />

        {/* Bottom Gradient */}
        <div className="absolute bottom-0 left-0 right-0 h-48 bg-gradient-to-t from-black/50 to-transparent pointer-events-auto" />

        {/* Progress Bar */}
        <div
          className="absolute bottom-20 left-4 right-4 h-1 bg-white/30 rounded-full cursor-pointer pointer-events-auto"
          onClick={handleProgressClick}
        >
          {/* Buffered */}
          <div
            className="absolute h-full bg-white/50 rounded-full"
            style={{ width: `${buffered}%` }}
          />
          {/* Progress */}
          <div
            className="absolute h-full rounded-full"
            style={{
              width: `${progress}%`,
              background: ARVDOUL_GRADIENT,
            }}
          />
          {/* Thumb */}
          <div
            className="absolute h-3 w-3 bg-white rounded-full shadow-lg -top-1"
            style={{ left: `calc(${progress}% - 6px)` }}
          />
        </div>

        {/* Time Display */}
        <div className="absolute bottom-24 left-4 flex items-center gap-2 pointer-events-none">
          <span className="text-white/80 text-xs font-medium">
            {formatDuration(currentTime)}
          </span>
          <span className="text-white/50 text-xs">/</span>
          <span className="text-white/80 text-xs font-medium">
            {formatDuration(duration)}
          </span>
        </div>

        {/* Bottom Controls */}
        <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between pointer-events-auto">
          {/* Left Controls */}
          <div className="flex items-center gap-2">
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={onTogglePlay}
              className="p-2 rounded-full bg-white/10 backdrop-blur-md border border-white/10"
            >
              {isPlaying ? (
                <Pause className="w-5 h-5 text-white" />
              ) : (
                <Play className="w-5 h-5 text-white fill-white" />
              )}
            </motion.button>

            <div className="relative">
              <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={() => setShowVolumeSlider(!showVolumeSlider)}
                onMouseEnter={() => setShowVolumeSlider(true)}
                className="p-2 rounded-full bg-white/10 backdrop-blur-md border border-white/10"
              >
                {isMuted ? (
                  <VolumeX className="w-5 h-5 text-white" />
                ) : (
                  <Volume2 className="w-5 h-5 text-white" />
                )}
              </motion.button>

              <AnimatePresence>
                {showVolumeSlider && (
                  <motion.div
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    className="absolute bottom-full left-0 mb-2 p-3 rounded-xl bg-black/80 backdrop-blur-xl border border-white/10"
                    onMouseLeave={() => setShowVolumeSlider(false)}
                  >
                    <div
                      className="w-24 h-1 bg-white/30 rounded-full cursor-pointer"
                      onClick={handleVolumeClick}
                    >
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${isMuted ? 0 : volume * 100}%`,
                          background: ARVDOUL_GRADIENT,
                        }}
                      />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Right Controls */}
          <div className="flex items-center gap-2">
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={onToggleLoop}
              className={`p-2 rounded-full backdrop-blur-md border ${
                isLooping
                  ? 'bg-purple-500/30 border-purple-500/50'
                  : 'bg-white/10 border-white/10'
              }`}
            >
              <Repeat className={`w-5 h-5 ${isLooping ? 'text-purple-400' : 'text-white'}`} />
            </motion.button>

            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={onTogglePip}
              className="p-2 rounded-full bg-white/10 backdrop-blur-md border border-white/10"
            >
              <PictureInPicture2 className="w-5 h-5 text-white" />
            </motion.button>

            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={onToggleFullscreen}
              className="p-2 rounded-full bg-white/10 backdrop-blur-md border border-white/10"
            >
              <Maximize className="w-5 h-5 text-white" />
            </motion.button>
          </div>
        </div>

        {/* Skip Controls */}
        <div className="absolute top-1/2 -translate-y-1/2 left-4 right-4 flex justify-between pointer-events-none">
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={() => onSeek?.(Math.max(0, currentTime - 10))}
            className="p-3 rounded-full bg-white/10 backdrop-blur-md border border-white/10 pointer-events-auto opacity-0"
          >
            <SkipBack className="w-6 h-6 text-white" />
          </motion.button>

          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={() => onSeek?.(Math.min(duration, currentTime + 10))}
            className="p-3 rounded-full bg-white/10 backdrop-blur-md border border-white/10 pointer-events-auto opacity-0"
          >
            <SkipForward className="w-6 h-6 text-white" />
          </motion.button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
});

VideoOverlay.displayName = 'VideoOverlay';

VideoOverlay.propTypes = {
  isVisible: PropTypes.bool,
  video: PropTypes.object,
  currentTime: PropTypes.number,
  duration: PropTypes.number,
  progress: PropTypes.number,
  buffered: PropTypes.number,
  isPlaying: PropTypes.bool,
  onTogglePlay: PropTypes.func,
  onSeek: PropTypes.func,
  onToggleFullscreen: PropTypes.func,
  onTogglePip: PropTypes.func,
  onToggleMute: PropTypes.func,
  onToggleLoop: PropTypes.func,
};

export default VideoOverlay;
