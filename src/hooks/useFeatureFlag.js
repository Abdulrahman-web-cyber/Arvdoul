// src/hooks/useFeatureFlag.js
//
// React binding for the feature-flag service so a component re-renders when a
// flag flips (an admin kill switch or a Remote Config fetch), rather than
// reading a stale value once at mount.

import { useEffect, useState } from 'react';
import { featureFlagService } from '../services/featureFlagService.js';

/**
 * @param {string} name - a registered flag name
 * @returns {boolean} the flag's effective value, re-rendered on change
 */
export function useFeatureFlag(name) {
  const [enabled, setEnabled] = useState(() => featureFlagService.isEnabled(name));

  useEffect(() => {
    setEnabled(featureFlagService.isEnabled(name));
    return featureFlagService.subscribe(() => setEnabled(featureFlagService.isEnabled(name)));
  }, [name]);

  return enabled;
}

export default useFeatureFlag;
