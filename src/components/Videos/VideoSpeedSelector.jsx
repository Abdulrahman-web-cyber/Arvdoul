// src/components/Videos/VideoSpeedSelector.jsx - VIDEO SPEED SELECTOR
import React, { memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check } from 'lucide-react';
import { SPRING_ANIMATION, SPEED_OPTIONS } from '../../utils/videoUtils';
import PropTypes from 'prop-types';

/**
 * VideoSpeedSelector - Floating glass sheet for speed selection
 */
const VideoSpeedSelector = memo(({
  isOpen = false,
  currentSpeed = 1,
  onSelect,
  onClose,
}) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 10 }}
          transition={SPRING_ANIMATION.button}
          className="absolute right-20 bottom-32 backdrop-blur-2xl bg-black/70 border border-white/10 rounded-2xl p-2 flex flex-col gap-1 min-w-[100px] z-50"
        >
          {SPEED_OPTIONS.map((option) => (
            <motion.button
              key={option.value}
              whileTap={{ scale: 0.95 }}
              onClick={() => {
                onSelect?.(option.value);
                onClose?.();
              }}
              className={`px-4 py-2.5 rounded-xl text-sm text-left flex items-center justify-between transition-colors ${
                currentSpeed === option.value
                  ? 'bg-gradient-to-r from-purple-500/30 to-pink-500/30 text-white'
                  : 'text-white/80 hover:bg-white/10'
              }`}
            >
              <span>{option.label}</span>
              {currentSpeed === option.value && (
                <Check className="w-4 h-4 text-purple-400" />
              )}
            </motion.button>
          ))}
        </motion.div>
      )}
    </AnimatePresence>
  );
});

VideoSpeedSelector.displayName = 'VideoSpeedSelector';
VideoSpeedSelector.propTypes = {
  isOpen: PropTypes.bool,
  currentSpeed: PropTypes.number,
  onSelect: PropTypes.func,
  onClose: PropTypes.func,
};

export default VideoSpeedSelector;
