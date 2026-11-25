// src/components/Videos/VideoQualitySelector.jsx

import { memo, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check } from 'lucide-react';
import { SPRING_ANIMATION, QUALITY_OPTIONS } from '../../utils/videoUtils';
import { BRAND_GRADIENT } from '../../design-system/tokens.js';
import PropTypes from 'prop-types';

/**
 * VideoQualitySelector - Floating glass sheet for live HLS or preset quality selection
 */
const VideoQualitySelector = memo(({
  isOpen = false,
  currentQuality = 'auto',
  levels = [],
  onSelect,
  onClose,
}) => {
  const options = useMemo(() => {
    if (Array.isArray(levels) && levels.length > 0) {
      const seen = new Set();
      const dynamic = [{ value: 'auto', label: 'Auto (Adaptive)', levelIndex: -1 }];
      const sorted = [...levels].sort((a, b) => (b.height || 0) - (a.height || 0));
      for (const lvl of sorted) {
        const val = lvl.label || `${lvl.height}p`;
        if (!val || seen.has(val)) continue;
        seen.add(val);
        dynamic.push({ value: val, label: val, levelIndex: lvl.index });
      }
      return dynamic;
    }
    return QUALITY_OPTIONS.map((o) => ({ ...o, levelIndex: o.value === 'auto' ? -1 : null }));
  }, [levels]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 10 }}
          transition={SPRING_ANIMATION.button}
          className="absolute right-20 bottom-32 backdrop-blur-2xl bg-[#080F2E]/90 border border-white/15 rounded-2xl p-2 flex flex-col gap-1 min-w-[156px] z-50 shadow-2xl"
        >
          {options.map((option) => {
            const active = currentQuality === option.value;
            return (
              <motion.button
                key={option.value}
                type="button"
                whileTap={{ scale: 0.95 }}
                onClick={() => {
                  onSelect?.(option.value, option.levelIndex);
                  onClose?.();
                }}
                className={`px-3.5 py-2 rounded-xl text-xs font-semibold text-left flex items-center justify-between gap-3 transition-colors ${
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

VideoQualitySelector.displayName = 'VideoQualitySelector';
VideoQualitySelector.propTypes = {
  isOpen: PropTypes.bool,
  currentQuality: PropTypes.string,
  levels: PropTypes.arrayOf(PropTypes.object),
  onSelect: PropTypes.func,
  onClose: PropTypes.func,
};

export default VideoQualitySelector;
