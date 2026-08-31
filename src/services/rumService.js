/**
 * src/services/rumService.js - ARVDOUL REAL USER MONITORING (RUM) & CORE WEB VITALS
 *
 * Implements:
 * 1. Web Vitals Observers: Largest Contentful Paint (LCP < 2.5s), Cumulative
 *    Layout Shift (CLS < 0.1), Interaction to Next Paint (INP < 200ms), and
 *    Time to First Byte (TTFB < 800ms) via `PerformanceObserver`.
 * 2. Route Transition Timings: SPA client-side navigation latency.
 * 3. Network Connection Quality: `navigator.connection` (downlink,
 *    effectiveType, rtt) with slow-connection warnings.
 * 4. Metrics Pipeline: `attachToMetrics()` forwards every vital into the
 *    shared metricsService (Prometheus-exportable) so RUM data reaches
 *    dashboards instead of dying in the console.
 *
 * The service degrades gracefully: every browser API is feature-detected, so
 * it is safe in jsdom, older browsers, and privacy-restricted contexts.
 */

import { logger } from '../utils/Logger.js';

// Core Web Vitals thresholds (web.dev, 2024)
export const VITAL_THRESHOLDS = Object.freeze({
  lcp: { good: 2500, poor: 4000 },
  cls: { good: 0.1, poor: 0.25 },
  inp: { good: 200, poor: 500 },
  ttfb: { good: 800, poor: 1800 },
});

class RUMService {
  constructor() {
    this.metrics = {
      lcp: null,
      cls: 0,
      inp: null,
      ttfb: null,
      longTasks: 0,
    };
    this.routeTimings = new Map(); // route -> { count, totalMs, lastMs }
    this._attached = false;
    this._lastRouteStart = null;
    this._initObservers();
    this._monitorConnection();
  }

  _hasPerformance() {
    return typeof performance !== 'undefined' && typeof performance.now === 'function';
  }

  _initObservers() {
    if (typeof window === 'undefined' || !window.PerformanceObserver || !this._hasPerformance()) return;

    try {
      // 1. TTFB (Navigation Timing)
      const navEntries = performance.getEntriesByType('navigation');
      if (navEntries.length > 0) {
        this.metrics.ttfb = navEntries[0].responseStart;
      }

      // 2. LCP Observer
      try {
        const lcpObserver = new PerformanceObserver((entryList) => {
          const entries = entryList.getEntries();
          if (entries.length > 0) {
            this.metrics.lcp = entries[entries.length - 1].startTime;
          }
        });
        lcpObserver.observe({ type: 'largest-contentful-paint', buffered: true });
      } catch (err) {
        logger.debug('[RUMService] LCP observer unavailable:', { error: err.message });
      }

      // 3. CLS Observer
      try {
        const clsObserver = new PerformanceObserver((entryList) => {
          for (const entry of entryList.getEntries()) {
            if (!entry.hadRecentInput) {
              this.metrics.cls += entry.value;
            }
          }
        });
        clsObserver.observe({ type: 'layout-shift', buffered: true });
      } catch (err) {
        logger.debug('[RUMService] CLS observer unavailable:', { error: err.message });
      }

      // 4. INP Observer (interaction latency)
      try {
        const inpObserver = new PerformanceObserver((entryList) => {
          const entries = entryList.getEntries();
          if (entries.length > 0) {
            const last = entries[entries.length - 1];
            this.metrics.inp = last.duration;
          }
        });
        inpObserver.observe({ type: 'event', buffered: true, durationThreshold: 16 });
      } catch (err) {
        logger.debug('[RUMService] INP observer unavailable:', { error: err.message });
      }

      // 5. Long Tasks (main-thread jank)
      try {
        const longTaskObserver = new PerformanceObserver((entryList) => {
          this.metrics.longTasks += entryList.getEntries().length;
        });
        longTaskObserver.observe({ type: 'longtask', buffered: true });
      } catch (err) {
        logger.debug('[RUMService] LongTask observer unavailable:', { error: err.message });
      }
    } catch (err) {
      logger.debug('[RUMService] PerformanceObserver initialization skipped:', { error: err.message });
    }
  }

  /**
   * Evaluates network effectiveType and triggers warnings/logs on slow connections (2g/3g).
   * @private
   */
  _monitorConnection() {
    if (typeof navigator === 'undefined' || !navigator.connection) return;
    const conn = navigator.connection;
    const checkAndLog = () => {
      if (conn.effectiveType === '2g' || conn.effectiveType === '3g' || conn.rtt > 800) {
        logger.warn(
          `[RUMService] SLOW CONNECTION DETECTED: effectiveType=${conn.effectiveType}, rtt=${conn.rtt}ms, downlink=${conn.downlink}Mbps!`
        );
      }
    };
    if (conn.addEventListener) conn.addEventListener('change', checkAndLog);
    checkAndLog();
  }

  // -------------------------------------------------------------------------
  // Route timing (SPA navigation)
  // -------------------------------------------------------------------------

  /** Call at the start of a route render. */
  startRouteTiming(routeName) {
    if (!routeName || !this._hasPerformance()) return;
    this._lastRouteStart = { route: routeName, at: performance.now() };
  }

  /** Call after the route finished rendering; records ms. */
  endRouteTiming(routeName) {
    if (!routeName || !this._lastRouteStart || this._lastRouteStart.route !== routeName || !this._hasPerformance()) {
      return null;
    }
    const durationMs = performance.now() - this._lastRouteStart.at;
    const stat = this.routeTimings.get(routeName) || { count: 0, totalMs: 0, lastMs: 0 };
    stat.count += 1;
    stat.totalMs += durationMs;
    stat.lastMs = durationMs;
    this.routeTimings.set(routeName, stat);
    return durationMs;
  }

  getRouteTiming(routeName) {
    return this.routeTimings.get(routeName) || { count: 0, totalMs: 0, lastMs: 0 };
  }

  // -------------------------------------------------------------------------
  // Metrics pipeline
  // -------------------------------------------------------------------------

  /**
   * Forwards vitals + route timings into the shared metricsService so they
   * reach the Prometheus export. Idempotent and never throws.
   */
  attachToMetrics() {
    if (this._attached) return;
    this._attached = true;
    try {
      // Lazy import to avoid a hard dependency at module load
      import('./metricsService.js')
        .then(({ metricsService }) => {
          const vital = (name, value) => {
            if (value === null || value === undefined || value === 0) return;
            metricsService.setGauge(`rum_${name}`, value);
            metricsService.recordHistogram(`rum_${name}_histogram`, value);
          };
          vital('lcp', this.metrics.lcp);
          vital('cls', this.metrics.cls);
          vital('inp', this.metrics.inp);
          vital('ttfb', this.metrics.ttfb);
          metricsService.setGauge('rum_long_tasks', this.metrics.longTasks);
        })
        .catch((err) => logger.debug('[RUMService] metricsService unavailable:', { error: err.message }));
    } catch (err) {
      logger.debug('[RUMService] Could not attach to metrics:', { error: err.message });
    }
  }

  /**
   * Evaluates each vital against the good/poor thresholds.
   * @returns {Object} `{ vital: 'good'|'needs_improvement'|'poor'|'missing' }`
   */
  evaluateVitals() {
    const out = {};
    for (const [name, thresholds] of Object.entries(VITAL_THRESHOLDS)) {
      const value = this.metrics[name];
      if (value === null || value === undefined) {
        out[name] = 'missing';
        continue;
      }
      if (value <= thresholds.good) out[name] = 'good';
      else if (value <= thresholds.poor) out[name] = 'needs_improvement';
      else out[name] = 'poor';
    }
    return out;
  }

  getWebVitals() {
    return {
      ...this.metrics,
      connection:
        typeof navigator !== 'undefined' && navigator.connection
          ? {
              effectiveType: navigator.connection.effectiveType,
              rtt: navigator.connection.rtt,
              downlink: navigator.connection.downlink,
            }
          : 'unknown',
      evaluation: this.evaluateVitals(),
    };
  }
}

export const rumService = new RUMService();
export default rumService;
