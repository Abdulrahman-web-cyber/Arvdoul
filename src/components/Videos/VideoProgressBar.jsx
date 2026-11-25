// src/components/Videos/VideoProgressBar.jsx

import { memo } from 'react';
import { motion } from 'framer-motion';
import { BRAND_GRADIENT } from '../../design-system/tokens.js';
import PropTypes from 'prop-types';

/**
 * VideoProgressBar - Progress bar with ARVDOUL gradient and optional chapter markers
 */
const VideoProgressBar = memo(({
  progress = 0,
  buffered = 0,
  duration = 0,
  chapters = [],
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
      role="slider"
      aria-label="Video progress"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(progress)}
      tabIndex={0}
      className={`relative h-1.5 hover:h-2.5 transition-all bg-white/25 rounded-full cursor-pointer group ${className}`}
      onClick={handleClick}
    >
      {/* Buffered */}
      <div
        className="absolute inset-y-0 left-0 bg-white/40 rounded-full"
        style={{ width: `${buffered}%` }}
      />
      {/* Progress */}
      <motion.div
        className="absolute inset-y-0 left-0 rounded-full"
        style={{
          width: `${progress}%`,
          background: BRAND_GRADIENT,
        }}
      />
      {/* Chapter Tick Markers */}
      {duration > 0 && Array.isArray(chapters) && chapters.map((ch, idx) => {
        const timeSec = Number(ch?.time ?? ch?.startTime ?? 0);
        if (!Number.isFinite(timeSec) || timeSec <= 0 || timeSec >= duration) return null;
        const pct = (timeSec / duration) * 100;
        return (
          <div
            key={`${timeSec}-${idx}`}
            title={ch?.title || `Chapter ${idx + 1}`}
            className="absolute top-0 bottom-0 w-0.5 bg-white/90 z-10 pointer-events-none"
            style={{ left: `${pct}%` }}
          />
        );
      })}
      {/* Thumb */}
      <div
        className="absolute h-3.5 w-3.5 bg-white rounded-full shadow-lg top-1/2 -translate-y-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity ring-2 ring-purple-500"
        style={{ left: `${progress}%` }}
      />
    </div>
  );
});

VideoProgressBar.displayName = 'VideoProgressBar';
VideoProgressBar.propTypes = {
  progress: PropTypes.number,
  buffered: PropTypes.number,
  duration: PropTypes.number,
  chapters: PropTypes.arrayOf(PropTypes.object),
  onSeek: PropTypes.func,
  className: PropTypes.string,
};

export default VideoProgressBar;
