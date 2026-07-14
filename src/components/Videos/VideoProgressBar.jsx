// src/components/Videos/VideoProgressBar.jsx - VIDEO PROGRESS BAR
import React, { memo } from 'react';
import { motion } from 'framer-motion';
import { ARVDOUL_GRADIENT } from '../../utils/videoUtils';
import PropTypes from 'prop-types';

/**
 * VideoProgressBar - Progress bar with ARVDOUL gradient
 */
const VideoProgressBar = memo(({
  progress = 0,
  buffered = 0,
  onSeek,
  className = '',
}) => {
  const handleClick = (e) => {
    if (!onSeek) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const percentage = Math.max(0, Math.min(1, clickX / rect.width));
    onSeek(percentage * 100);
  };

  return (
    <div
      className={`relative h-1 bg-white/30 rounded-full cursor-pointer group ${className}`}
      onClick={handleClick}
    >
      {/* Buffered */}
      <div
        className="absolute h-full bg-white/50 rounded-full"
        style={{ width: `${buffered}%` }}
      />
      {/* Progress */}
      <motion.div
        className="absolute h-full rounded-full"
        style={{
          width: `${progress}%`,
          background: ARVDOUL_GRADIENT,
        }}
      />
      {/* Thumb */}
      <div
        className="absolute h-3 w-3 bg-white rounded-full shadow-lg -top-1 opacity-0 group-hover:opacity-100 transition-opacity"
        style={{ left: `calc(${progress}% - 6px)` }}
      />
    </div>
  );
});

VideoProgressBar.displayName = 'VideoProgressBar';
VideoProgressBar.propTypes = {
  progress: PropTypes.number,
  buffered: PropTypes.number,
  onSeek: PropTypes.func,
  className: PropTypes.string,
};

export default VideoProgressBar;
