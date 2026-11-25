// src/components/Videos/VideoSpeedSelector.jsx

import { memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check } from 'lucide-react';
import { SPRING_ANIMATION, SPEED_OPTIONS } from '../../utils/videoUtils';
import { BRAND_GRADIENT } from '../../design-system/tokens.js';
import PropTypes from 'prop-types';

/**
 * VideoSpeedSelector - Floating glass sheet for playback speed selection
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
          className="absolute right-20 bottom-32 backdrop-blur-2xl bg-[#080F2E]/90 border border-white/15 rounded-2xl p-2 flex flex-col gap-1 min-w-[116px] z-50 shadow-2xl"
        >
          {SPEED_OPTIONS.map((option) => {
            const active = currentSpeed === option.value;
            return (
              <motion.button
                key={option.value}
                type="button"
                whileTap={{ scale: 0.95 }}
                onClick={() => {
                  onSelect?.(option.value);
                  onClose?.();
                }}
                className={`px-3.5 py-2 rounded-xl text-xs font-semibold text-left flex items-center justify-between gap-2 transition-colors ${
                  active ? 'text-white' : 'text-white/80 hover:bg-white/10'
                }`}
                style={active ? { background: BRAND_GRADIENT } : undefined}
              >
                <span>{option.label}</span>
                {active && <Check className="w-3.5 h-3.5 text-white shrink-0" />}
              </motion.button>
            );
          })}
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
