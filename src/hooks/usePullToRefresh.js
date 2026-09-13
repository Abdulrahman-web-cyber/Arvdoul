import { useState, useRef, useCallback, useEffect } from 'react';
import { triggerHaptic } from '../utils/haptics';

const PULL_THRESHOLD = 70;
const RESISTANCE = 0.45;

/**
 * usePullToRefresh - Handles mobile touch pull-to-refresh gestures.
 * @param {Function} onRefresh - Async callback executed when user releases past threshold
 * @param {Object} [options]
 * @param {number} [options.threshold=70]
 * @param {boolean} [options.disabled=false]
 */
export function usePullToRefresh(onRefresh, { threshold = PULL_THRESHOLD, disabled = false } = {}) {
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [canRelease, setCanRelease] = useState(false);

  const startY = useRef(0);
  const isPulling = useRef(false);
  const containerRef = useRef(null);

  const handleTouchStart = useCallback(
    (e) => {
      if (disabled || isRefreshing) return;
      const container = containerRef.current;
      // Only start pull if container is scrolled to the absolute top
      const scrollTop = container ? container.scrollTop : window.scrollY;
      if (scrollTop <= 0) {
        startY.current = e.touches[0].clientY;
        isPulling.current = true;
      }
    },
    [disabled, isRefreshing]
  );

  const handleTouchMove = useCallback(
    (e) => {
      if (!isPulling.current || disabled || isRefreshing) return;
      const currentY = e.touches[0].clientY;
      const rawDistance = currentY - startY.current;

      if (rawDistance > 0) {
        // Apply resistance curve
        const distance = Math.min(rawDistance * RESISTANCE, threshold * 1.5);
        setPullDistance(distance);

        if (distance >= threshold && !canRelease) {
          setCanRelease(true);
          triggerHaptic('selection');
        } else if (distance < threshold && canRelease) {
          setCanRelease(false);
        }
      }
    },
    [disabled, isRefreshing, threshold, canRelease]
  );

  const handleTouchEnd = useCallback(async () => {
    if (!isPulling.current) return;
    isPulling.current = false;

    if (canRelease && !isRefreshing) {
      setIsRefreshing(true);
      setPullDistance(threshold);
      triggerHaptic('medium');

      try {
        if (typeof onRefresh === 'function') {
          await onRefresh();
        }
      } catch (err) {
        console.warn('Pull-to-refresh action failed:', err);
      } finally {
        setIsRefreshing(false);
        setCanRelease(false);
        setPullDistance(0);
      }
    } else {
      setPullDistance(0);
      setCanRelease(false);
    }
  }, [canRelease, isRefreshing, onRefresh, threshold]);

  useEffect(() => {
    const el = containerRef.current || (typeof window !== 'undefined' ? window : null);
    if (!el) return;

    el.addEventListener('touchstart', handleTouchStart, { passive: true });
    el.addEventListener('touchmove', handleTouchMove, { passive: true });
    el.addEventListener('touchend', handleTouchEnd);
    el.addEventListener('touchcancel', handleTouchEnd);

    return () => {
      el.removeEventListener('touchstart', handleTouchStart);
      el.removeEventListener('touchmove', handleTouchMove);
      el.removeEventListener('touchend', handleTouchEnd);
      el.removeEventListener('touchcancel', handleTouchEnd);
    };
  }, [handleTouchStart, handleTouchMove, handleTouchEnd]);

  return {
    containerRef,
    pullDistance,
    isRefreshing,
    canRelease,
  };
}

export default usePullToRefresh;
