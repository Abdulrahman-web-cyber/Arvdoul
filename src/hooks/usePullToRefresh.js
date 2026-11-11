import { useEffect, useRef, useState } from 'react';

/**
 * Native touch pull-to-refresh for a scroll container.
 *
 * Touch handlers are attached with `addEventListener({ passive: false })` rather
 * than React props: React registers touch listeners passively, so
 * `preventDefault()` inside an `onTouchMove` handler is ignored and the browser's
 * own overscroll takes over.
 *
 * The pull only arms while the scroller is already at the top (`scrollTop <= 0`),
 * so it never fights normal scrolling. On release past `threshold` it awaits
 * `onRefresh()` and resets.
 *
 * @param {Object} opts
 * @param {HTMLElement|null} opts.element - the scrollable element
 * @param {() => (void|Promise<void>)} opts.onRefresh
 * @param {boolean} [opts.enabled=true]
 * @param {number} [opts.threshold=70] - pull distance (px) that arms a refresh
 * @param {number} [opts.maxPull=110] - maximum visual travel (px)
 * @param {number} [opts.resistance=0.5] - drag → visual damping factor
 */
export function usePullToRefresh({
  element,
  onRefresh,
  enabled = true,
  threshold = 70,
  maxPull = 110,
  resistance = 0.5,
} = {}) {
  const [pull, setPull] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const pullRef = useRef(0);
  const refreshingRef = useRef(false);
  const startYRef = useRef(null);
  const pullingRef = useRef(false);
  const onRefreshRef = useRef(onRefresh);

  useEffect(() => {
    onRefreshRef.current = onRefresh;
  }, [onRefresh]);

  useEffect(() => {
    if (!element || !enabled) return undefined;

    const reset = () => {
      startYRef.current = null;
      pullingRef.current = false;
    };

    const onTouchStart = (event) => {
      if (refreshingRef.current) return;
      if (element.scrollTop > 0) {
        reset();
        return;
      }
      startYRef.current = event.touches[0].clientY;
      pullingRef.current = false;
    };

    const onTouchMove = (event) => {
      if (startYRef.current == null || refreshingRef.current) return;
      if (element.scrollTop > 0) {
        reset();
        if (pullRef.current !== 0) {
          pullRef.current = 0;
          setPull(0);
        }
        return;
      }
      const delta = event.touches[0].clientY - startYRef.current;
      if (delta <= 0) {
        if (pullingRef.current) {
          pullingRef.current = false;
          pullRef.current = 0;
          setPull(0);
        }
        return;
      }
      pullingRef.current = true;
      const damped = Math.min(maxPull, delta * resistance);
      pullRef.current = damped;
      setPull(damped);
      // Suppress the browser's native overscroll only while we are driving it.
      if (damped > 8 && event.cancelable) event.preventDefault();
    };

    const finish = async () => {
      if (!pullingRef.current) {
        reset();
        if (pullRef.current !== 0) {
          pullRef.current = 0;
          setPull(0);
        }
        return;
      }
      const armed = pullRef.current >= threshold;
      reset();
      if (!armed) {
        pullRef.current = 0;
        setPull(0);
        return;
      }
      refreshingRef.current = true;
      setIsRefreshing(true);
      pullRef.current = threshold;
      setPull(threshold);
      try {
        await onRefreshRef.current?.();
      } finally {
        refreshingRef.current = false;
        setIsRefreshing(false);
        pullRef.current = 0;
        setPull(0);
      }
    };

    element.addEventListener('touchstart', onTouchStart, { passive: true });
    element.addEventListener('touchmove', onTouchMove, { passive: false });
    element.addEventListener('touchend', finish);
    element.addEventListener('touchcancel', finish);

    return () => {
      element.removeEventListener('touchstart', onTouchStart);
      element.removeEventListener('touchmove', onTouchMove);
      element.removeEventListener('touchend', finish);
      element.removeEventListener('touchcancel', finish);
    };
  }, [element, enabled, threshold, maxPull, resistance]);

  return { pull, isRefreshing, threshold, progress: Math.min(1, pull / threshold) };
}

export default usePullToRefresh;
