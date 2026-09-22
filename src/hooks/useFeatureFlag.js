/**
 * src/hooks/useFeatureFlag.js
 * React hook for feature flags with runtime reactivity:
 *
 *   const { enabled, value, source } = useFeatureFlag('feed.ml_ranking');
 *
 * Re-renders when the flag changes (Remote Config activation or admin
 * override). Fails closed for unregistered flags.
 */

import { useSyncExternalStore } from 'react';
import { featureFlagService } from '../services/featureFlagService.js';

function subscribe(callback) {
  return featureFlagService.onUpdate(callback);
}

function getSnapshot() {
  return featureFlagService.getSnapshot();
}

/**
 * @param {string} name registered flag name (see DEFAULT_FLAGS)
 * @returns {{ enabled: boolean, value: any, source: string, isRemote: boolean }}
 */
export function useFeatureFlag(name) {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const entry = snapshot[name];
  const enabled = entry ? featureFlagService.isEnabled(name) : false;
  return {
    enabled,
    value: entry ? entry.value : null,
    source: entry ? entry.source : 'default',
    isRemote: entry ? entry.source === 'remote' : false,
  };
}

export default useFeatureFlag;
