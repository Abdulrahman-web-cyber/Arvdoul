import { useState, useEffect, useCallback } from 'react';
import {
  getDeviceCapabilities,
  isLiteModeEnabled,
  setLiteModePreference,
  getAdaptiveTuning,
} from '../utils/deviceCapabilities';

/**
 * useDeviceCapabilities - Reactive hook for hardware, network and low-end Android awareness.
 */
export function useDeviceCapabilities() {
  const [capabilities, setCapabilities] = useState(() => getDeviceCapabilities());
  const [tuning, setTuning] = useState(() => getAdaptiveTuning());
  const [isLiteMode, setIsLiteMode] = useState(() => isLiteModeEnabled());

  const refresh = useCallback(() => {
    setCapabilities(getDeviceCapabilities());
    setTuning(getAdaptiveTuning());
    setIsLiteMode(isLiteModeEnabled());
  }, []);

  useEffect(() => {
    // Listen for network changes
    const nav = typeof navigator !== 'undefined' ? navigator : {};
    const conn = nav.connection || nav.mozConnection || nav.webkitConnection;

    if (conn && typeof conn.addEventListener === 'function') {
      conn.addEventListener('change', refresh);
    }

    // Listen for manual Lite Mode toggle changes
    window.addEventListener('arvdoul-litemode-change', refresh);

    // Listen for reduced motion preference changes
    let motionQuery = null;
    const handleMotionChange = () => refresh();
    if (typeof window.matchMedia === 'function') {
      motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
      if (motionQuery.addEventListener) {
        motionQuery.addEventListener('change', handleMotionChange);
      }
    }

    return () => {
      if (conn && typeof conn.removeEventListener === 'function') {
        conn.removeEventListener('change', refresh);
      }
      window.removeEventListener('arvdoul-litemode-change', refresh);
      if (motionQuery && motionQuery.removeEventListener) {
        motionQuery.removeEventListener('change', handleMotionChange);
      }
    };
  }, [refresh]);

  const toggleLiteMode = useCallback((forcedState) => {
    const nextState = typeof forcedState === 'boolean' ? forcedState : !isLiteModeEnabled();
    setLiteModePreference(nextState);
    refresh();
  }, [refresh]);

  return {
    capabilities,
    tuning,
    isLiteMode,
    isLowEndDevice: capabilities.isLowEndDevice,
    toggleLiteMode,
    refresh,
  };
}

export default useDeviceCapabilities;
