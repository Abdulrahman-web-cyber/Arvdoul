/**
 * src/hooks/useScreenView.js
 * ARVDOUL SCREEN VIEW ANALYTICS
 *
 * Fires on every route change:
 *   - metricsService: `screen_view_total` counter + `screen_view_${name}` gauge
 *   - rumService: start/end route timing (per the RUM pipeline)
 *   - performance.mark/measure for LCP-adjacent telemetry
 *
 * Wired once in MainLayout so every routed screen is covered without each
 * screen adding its own tracking code (guide Part XII: never add analytics
 * code directly in screens).
 */

import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';

/** Maps a route path to a stable, metric-safe screen name. */
export function screenNameFromPath(pathname) {
  const segments = pathname.split('/').filter(Boolean);
  if (segments.length === 0) return 'home';
  // Keep the first two segments: /profile/{uid} -> profile, /community/{id}/posts -> community_posts
  return segments.slice(0, 2).join('_').replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase();
}

/**
 * Returns a ref-stable tracking callback for the current route.
 * Usage: call `track()` inside a useEffect or after route data loads.
 */
export function useScreenView() {
  const location = useLocation();
  const lastTracked = useRef('');

  useEffect(() => {
    const name = screenNameFromPath(location.pathname);
    if (lastTracked.current === name) return; // same screen, don't double-fire
    lastTracked.current = name;

    let cancelled = false;
    let timings = {};

    // Performance marks (best-effort)
    try {
      if (typeof performance !== 'undefined' && performance.mark) {
        performance.mark(`screen_view_${name}_start`);
      }
    } catch { /* noop */ }

    Promise.all([
      import('../services/metricsService.js'),
      import('../services/rumService.js'),
    ])
      .then(([metricsMod, rumMod]) => {
        if (cancelled) return;
        const { metricsService } = metricsMod;
        const { rumService } = rumMod;

        metricsService.incrementCounter('screen_view_total', 1);
        metricsService.incrementCounter(`screen_view_${name}`, 1);

        // Route timing (RUM) - end the previous route's timing, start this one
        try {
          rumService.endRouteTiming(screenNameFromPath(location.pathname));
          rumService.startRouteTiming(name);
          timings = { name };
        } catch { /* noop */ }

        try {
          if (typeof performance !== 'undefined' && performance.mark) {
            performance.mark(`screen_view_${name}_end`);
            performance.measure(`screen_view_${name}`, `screen_view_${name}_start`, `screen_view_${name}_end`);
          }
        } catch { /* noop */ }
      })
      .catch(() => { /* analytics must never break navigation */ });

    return () => {
      cancelled = true;
      // Close the RUM timing when leaving the screen
      try {
        Promise.all([import('../services/rumService.js')]).then(([rumMod]) => {
          rumMod.rumService.endRouteTiming(name);
        });
      } catch { /* noop */ }
    };
  }, [location.pathname]);

  return null;
}

export default useScreenView;
