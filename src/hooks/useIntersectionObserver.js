import { useEffect, useState } from 'react';

/**
 * Custom hook for observing DOM elements intersection.
 * @param {React.RefObject} elementRef
 * @param {IntersectionObserverInit} options
 * @returns {IntersectionObserverEntry|null}
 */
export default function useIntersectionObserver(elementRef, options = {}) {
  const [entry, setEntry] = useState(null);

  useEffect(() => {
    const node = elementRef?.current;
    if (!node || typeof IntersectionObserver !== 'function') return;

    const observer = new IntersectionObserver(([singleEntry]) => {
      setEntry(singleEntry);
    }, options);

    observer.observe(node);

    return () => {
      observer.disconnect();
    };
  }, [elementRef, options.threshold, options.root, options.rootMargin]);

  return entry;
}
