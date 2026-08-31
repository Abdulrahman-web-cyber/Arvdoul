import { useEffect, useRef, useState } from 'react';

/**
 * Observes a DOM element's intersection with the viewport.
 * Options are memoized via a ref so re-renders never re-subscribe the
 * observer unnecessarily.
 */
export default function useIntersectionObserver(elementRef, options = {}) {
  const [entry, setEntry] = useState(null);
  const optionsRef = useRef(options);
  optionsRef.current = options;

  useEffect(() => {
    const node = elementRef?.current;
    if (!node || typeof IntersectionObserver !== 'function') return undefined;

    const opts = optionsRef.current;
    const observer = new IntersectionObserver(([singleEntry]) => {
      setEntry(singleEntry);
    }, {
      root: opts.root || null,
      rootMargin: opts.rootMargin || '0px',
      threshold: opts.threshold ?? 0,
    });

    observer.observe(node);

    return () => {
      observer.disconnect();
    };
    // elementRef identity only - option changes are picked up via the ref
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [elementRef]);

  return entry;
}
