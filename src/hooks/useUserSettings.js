import { useEffect, useState } from 'react';
import { settingsService, mergeSettings } from '../services/settingsService.js';
import { setSoundFxEnabled } from './useSound.js';

/**
 * Load the signed-in user's persisted settings and apply the document-level
 * effects for the whole session.
 *
 * `appearance.reduceMotion` was only applied while the Settings screen was
 * mounted, so a persisted "reduce motion" preference was lost on navigation.
 * This hook is mounted once per session (inside AuthProvider) so the preference
 * survives every route. It reads once at sign-in rather than opening a realtime
 * listener — reduce-motion does not need cross-device push, and a new listener
 * is a billing change the cost guard rejects.
 */
export function useUserSettings(uid) {
  const [settings, setSettings] = useState(() => mergeSettings(null));

  useEffect(() => {
    if (!uid) {
      setSettings(mergeSettings(null));
      return;
    }
    let mounted = true;
    settingsService.getSettings(uid)
      .then((loaded) => { if (mounted) setSettings(loaded); })
      .catch((err) => console.warn('[Settings] load failed; showing defaults', err?.message));
    return () => { mounted = false; };
  }, [uid]);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.documentElement.classList.toggle(
      'arvdoul-reduce-motion',
      Boolean(settings?.appearance?.reduceMotion)
    );
  }, [settings?.appearance?.reduceMotion]);

  useEffect(() => {
    setSoundFxEnabled(settings?.notifications?.soundFx !== false);
  }, [settings?.notifications?.soundFx]);

  return settings;
}

export default useUserSettings;
