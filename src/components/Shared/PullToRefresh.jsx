import { motion } from 'framer-motion';
import { Loader2, ArrowDown, Check } from 'lucide-react';

/**
 * Visual indicator for `usePullToRefresh`.
 *
 * Rendered as an absolutely-positioned strip above the scroll content. It is
 * `aria-hidden` because the refresh is a pointer gesture; the same action is
 * exposed to assistive tech and desktop by a real button in the host screen.
 *
 * @param {Object} props
 * @param {number} props.pull - current pull distance in px
 * @param {number} props.threshold - distance that arms a refresh
 * @param {boolean} props.isRefreshing
 * @param {boolean} [props.enabled=true]
 */
export default function PullToRefresh({ pull = 0, threshold = 70, isRefreshing = false, enabled = true }) {
  if (!enabled) return null;

  const visible = pull > 0 || isRefreshing;
  const armed = pull >= threshold;
  const progress = Math.min(1, pull / threshold);

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-x-0 top-0 z-30 flex justify-center overflow-hidden"
      style={{ height: isRefreshing ? 56 : Math.max(0, Math.min(pull, 96)) }}
    >
      <motion.div
        initial={false}
        animate={{ opacity: visible ? 1 : 0, scale: isRefreshing ? 1 : 0.7 + 0.3 * progress }}
        transition={{ type: 'spring', stiffness: 320, damping: 26 }}
        className="mt-3 flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-white/10 text-white backdrop-blur-md shadow-arvdoul-glow"
      >
        {isRefreshing ? (
          <Loader2 className="h-4 w-4 animate-spin text-arvdoul-glow-cyan" />
        ) : armed ? (
          <Check className="h-4 w-4 text-arvdoul-glow-cyan" />
        ) : (
          <ArrowDown
            className="h-4 w-4 text-white/80 transition-transform"
            style={{ transform: `rotate(${Math.round(progress * 180)}deg)` }}
          />
        )}
      </motion.div>
    </div>
  );
}
