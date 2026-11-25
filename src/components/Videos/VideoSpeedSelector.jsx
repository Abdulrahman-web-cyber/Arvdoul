// src/components/Videos/VideoSpeedSelector.jsx

import { memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
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
  const { isDark } = useTheme();

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 10 }}
          transition={SPRING_ANIMATION.button}
          className={`absolute right-14 bottom-12 lg:bottom-16 backdrop-blur-2xl border rounded-2xl p-2 flex flex-col gap-1 min-w-[120px] z-50 shadow-2xl ${
            isDark
              ? 'bg-[#080F2E]/95 border-white/15'
              : 'bg-white/95 border-slate-200 shadow-[0_18px_40px_rgba(15,23,42,0.16)]'
          }`}
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
                  active
                    ? 'text-white'
                    : isDark
                      ? 'text-white/80 hover:bg-white/10'
                      : 'text-slate-700 hover:bg-slate-100'
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
