// src/utils/deviceCapabilities.js

const LITE_MODE_STORAGE_KEY = 'arvdoul_lite_mode_preference';

/**
 * Reads browser hardware and network heuristics.
 */
export function getDeviceCapabilities() {
  if (typeof window === 'undefined') {
    return {
      cores: 4,
      memoryGb: 4,
      saveData: false,
      effectiveType: '4g',
      prefersReducedMotion: false,
      isLowEndDevice: false,
      networkQuality: 'good',
    };
  }

  const nav = navigator || {};
  const conn = nav.connection || nav.mozConnection || nav.webkitConnection || {};

  const cores = nav.hardwareConcurrency || 4;
  const memoryGb = nav.deviceMemory || 4;
  const saveData = conn.saveData === true;
  const effectiveType = conn.effectiveType || '4g';
  const prefersReducedMotion =
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Determine if device is low-end hardware
  const isLowMemory = memoryGb <= 2.5;
  const isLowCpu = cores <= 4;
  const isSlowNetwork = effectiveType === 'slow-2g' || effectiveType === '2g' || effectiveType === '3g';

  // Overall Low-End classification
  const isLowEndDevice = isLowMemory || (isLowCpu && isSlowNetwork) || saveData;

  let networkQuality = 'good';
  if (effectiveType === 'slow-2g' || effectiveType === '2g') {
    networkQuality = 'poor';
  } else if (effectiveType === '3g') {
    networkQuality = 'moderate';
  }

  return {
    cores,
    memoryGb,
    saveData,
    effectiveType,
    prefersReducedMotion,
    isLowEndDevice,
    networkQuality,
  };
}

/**
 * Check if the user has manually forced "Lite Mode" or if automatic low-end is active.
 */
export function isLiteModeEnabled() {
  try {
    const stored = localStorage.getItem(LITE_MODE_STORAGE_KEY);
    if (stored !== null) {
      return stored === 'true';
    }
  } catch {
    // Ignore localStorage errors
  }

  const caps = getDeviceCapabilities();
  return caps.isLowEndDevice;
}

/**
 * Sets user preference for Lite Mode.
 * @param {boolean|null} enabled - true to force lite, false to force standard, null to use auto.
 */
export function setLiteModePreference(enabled) {
  try {
    if (enabled === null) {
      localStorage.removeItem(LITE_MODE_STORAGE_KEY);
    } else {
      localStorage.setItem(LITE_MODE_STORAGE_KEY, String(enabled));
    }
    window.dispatchEvent(new Event('arvdoul-litemode-change'));
  } catch {
    // Ignore
  }
}

/**
 * Returns performance-tailored tuning parameters for feeds, media and rendering.
 */
export function getAdaptiveTuning() {
  const isLite = isLiteModeEnabled();
  const caps = getDeviceCapabilities();

  return {
    isLiteMode: isLite,
    feedPageSize: isLite ? 10 : 25,
    maxCachedVideos: isLite ? 2 : 6,
    maxCachedImages: isLite ? 30 : 150,
    autoplayVideo: !isLite && !caps.saveData && caps.networkQuality === 'good',
    enableBackdropBlur: !isLite,
    enableComplexMotion: !isLite && !caps.prefersReducedMotion,
    imageQuality: isLite ? 50 : 80,
    thumbnailMaxWidth: isLite ? 480 : 1080,
    virtualizationOverscan: isLite ? 2 : 5,
  };
}

export default {
  getDeviceCapabilities,
  isLiteModeEnabled,
  setLiteModePreference,
  getAdaptiveTuning,
};
