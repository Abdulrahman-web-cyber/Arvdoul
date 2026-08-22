import { useRef, useCallback } from "react";

/**
 * Double-tap detection.
 *
 * IMPORTANT: only `onClick` is wired. React's onClick fires once per tap on
 * both mouse AND touch (after touchend), so wiring onTouchEnd as well caused
 * a SINGLE tap to fire the callback twice (once per handler) - i.e. a single
 * tap triggered the "double tap" action on mobile.
 *
 * Firing resets the timer to zero, so a rapid third tap begins a NEW pair
 * instead of re-firing the previous one.
 */
export default function useDoubleTap(callback = () => {}, delay = 300) {
  const lastTapRef = useRef(0);

  const handleClick = useCallback(() => {
    const now = Date.now();
    const timeSinceLastTap = now - lastTapRef.current;

    if (timeSinceLastTap < delay) {
      // Second tap within the window - fire once per pair
      callback();
      lastTapRef.current = 0; // reset: a third tap starts a new pair
    } else {
      lastTapRef.current = now;
    }
  }, [callback, delay]);

  return {
    onClick: handleClick,
  };
}
