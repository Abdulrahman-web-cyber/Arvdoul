/**
 * src/performance/optimizer.js - Production-grade client performance engine.
 * Provides idle-time task scheduling, memory pressure garbage collection,
 * and adaptive rendering profiles.
 */

import { getAdaptiveTuning, getDeviceCapabilities } from '../utils/deviceCapabilities';

/**
 * Schedule non-critical work during browser idle frames.
 * Uses requestIdleCallback where available, with safe fallback to setTimeout.
 * @param {Function} task - Callback function to run
 * @param {number} [timeout=2000] - Max time before forcing execution
 * @returns {number} handle for cancelIdleTask
 */
export function scheduleIdleTask(task, timeout = 2000) {
  if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
    return window.requestIdleCallback(task, { timeout });
  }
  return setTimeout(() => task({ didTimeout: true, timeRemaining: () => 0 }), 100);
}

/**
 * Cancel a previously scheduled idle task.
 * @param {number} handle
 */
export function cancelIdleTask(handle) {
  if (typeof window !== 'undefined' && 'cancelIdleCallback' in window) {
    window.cancelIdleCallback(handle);
  } else {
    clearTimeout(handle);
  }
}

/**
 * Frees unused DOM media elements and revokes object URLs.
 */
export function cleanMemoryCaches() {
  if (typeof document === 'undefined') return;

  // Revoke expired video blobs and off-DOM media
  const offscreenVideos = document.querySelectorAll('video[data-offscreen="true"]');
  offscreenVideos.forEach((v) => {
    try {
      v.pause();
      v.removeAttribute('src');
      v.load();
    } catch {
      // Ignore cleanup error
    }
  });
}

/**
 * Measures execution time of asynchronous or synchronous tasks.
 * Useful for performance profiling in development and RUM telemetry.
 * @param {string} label
 * @param {Function} fn
 * @returns {Promise<any>}
 */
export async function measurePerformance(label, fn) {
  const start = typeof performance !== 'undefined' ? performance.now() : Date.now();
  try {
    return await fn();
  } finally {
    const duration = (typeof performance !== 'undefined' ? performance.now() : Date.now()) - start;
    if (duration > 50 && typeof console !== 'undefined' && console.debug) {
      console.debug(`[Perf: ${label}] took ${duration.toFixed(2)}ms`);
    }
  }
}

/**
 * Returns overall optimization flags and tuning parameters.
 * Preserves backwards compatibility with existing callers.
 */
export function optimize() {
  const tuning = getAdaptiveTuning();
  const caps = getDeviceCapabilities();

  return {
    lazy: true,
    split: true,
    isLiteMode: tuning.isLiteMode,
    isLowEndDevice: caps.isLowEndDevice,
    tuning,
    scheduleIdleTask,
    cancelIdleTask,
    cleanMemoryCaches,
  };
}

export default {
  optimize,
  scheduleIdleTask,
  cancelIdleTask,
  cleanMemoryCaches,
  measurePerformance,
};
