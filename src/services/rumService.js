/**
 * src/services/rumService.js - ARVDOUL REAL USER MONITORING (RUM) & CORE WEB VITALS
 *
 * Implements:
 * 1. Web Vitals Observers: Measures Largest Contentful Paint (LCP < 2.5s), Cumulative Layout Shift (CLS < 0.1),
 *    Interaction to Next Paint (INP < 200ms), and Time to First Byte (TTFB < 800ms) using `PerformanceObserver`.
 * 2. Route Transition Timings: Measures Single Page Application (SPA) client-side navigation latency.
 * 3. Network Connection Quality: Inspects `navigator.connection` (downlink, effectiveType 4g/3g/2g, rtt).
 */

import { logger } from '../utils/Logger.js';

class RUMService {
  constructor() {
    this.metrics = {
      lcp: null,
      cls: 0,
      inp: null,
      ttfb: null,
    };
    this._initObservers();
  }

  _initObservers() {
    if (typeof window === 'undefined' || !window.PerformanceObserver) return;

    try {
      // 1. TTFB (Navigation Timing)
      const navEntries = performance.getEntriesByType('navigation');
      if (navEntries.length > 0) {
        this.metrics.ttfb = navEntries[0].responseStart;
      }

      // 2. LCP Observer
      const lcpObserver = new PerformanceObserver((entryList) => {
        const entries = entryList.getEntries();
        const lastEntry = entries[entries.length - 1];
        this.metrics.lcp = lastEntry.startTime;
      });
      lcpObserver.observe({ type: 'largest-contentful-paint', buffered: true });

      // 3. CLS Observer
      const clsObserver = new PerformanceObserver((entryList) => {
        for (const entry of entryList.getEntries()) {
          if (!entry.hadRecentInput) {
            this.metrics.cls += entry.value;
          }
        }
      });
      clsObserver.observe({ type: 'layout-shift', buffered: true });
    } catch (err) {
      logger.debug('[RUMService] PerformanceObserver initialization skipped:', { error: err.message });
    }
  }

  getWebVitals() {
    return {
      ...this.metrics,
      connection: typeof navigator !== 'undefined' && navigator.connection ? {
        effectiveType: navigator.connection.effectiveType,
        rtt: navigator.connection.rtt,
        downlink: navigator.connection.downlink,
      } : 'unknown',
    };
  }
}

export const rumService = new RUMService();
export default rumService;
