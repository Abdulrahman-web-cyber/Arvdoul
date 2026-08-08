import { useRef } from "react";

export default function useDoubleTap(callback = () => {}, delay = 300) {
  const lastTapRef = useRef(0);

  const handleTap = () => {
    const now = Date.now();
    const timeSinceLastTap = now - lastTapRef.current;

    if (timeSinceLastTap < delay) {
      callback();
    }

    lastTapRef.current = now;
  };

  return {
    onClick: handleTap,
    onTouchEnd: handleTap,
  };
}
