/**
 * src/__tests__/settingsService.test.js
 * Real assertions for the settings service:
 *  - defaults merge (partial docs, nulls, unknown groups)
 *  - dotted-path get/set immutability
 *  - updateSetting persists via Firestore merge + optimistic cache
 *  - rollback on persist failure
 *  - clearApplicationCache preserves auth keys and clears the rest
 */

import { jest } from '@jest/globals';
import {
  DEFAULT_SETTINGS,
  mergeSettings,
  getSettingAt,
  setSettingAt,
  settingsService,
} from '../services/settingsService.js';

describe('settings merge (pure)', () => {
  test('returns full defaults for null/empty input', () => {
    expect(mergeSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(mergeSettings(undefined)).toEqual(DEFAULT_SETTINGS);
    expect(mergeSettings('junk')).toEqual(DEFAULT_SETTINGS);
  });

  test('merges partial docs over defaults without losing groups', () => {
    const merged = mergeSettings({ privacy: { profilePrivate: true } });
    expect(merged.privacy.profilePrivate).toBe(true);
    expect(merged.privacy.allowDMs).toBe('everyone');
    expect(merged.notifications.push).toBe(true);
    expect(merged.playback.streamQuality).toBe('auto');
  });

  test('ignores unknown groups', () => {
    const merged = mergeSettings({ hackerGroup: { evil: true }, privacy: { allowDMs: 'friends' } });
    expect(merged.hackerGroup).toBeUndefined();
    expect(merged.privacy.allowDMs).toBe('friends');
  });

  test('returns a deep copy (mutating result never corrupts defaults)', () => {
    const merged = mergeSettings(null);
    merged.notifications.push = false;
    expect(DEFAULT_SETTINGS.notifications.push).toBe(true);
  });
});

describe('dotted path helpers (pure)', () => {
  test('getSettingAt reads nested paths', () => {
    expect(getSettingAt(DEFAULT_SETTINGS, 'privacy.allowDMs')).toBe('everyone');
    expect(getSettingAt(DEFAULT_SETTINGS, 'notifications.push')).toBe(true);
    expect(getSettingAt(DEFAULT_SETTINGS, 'missing.path')).toBeUndefined();
  });

  test('setSettingAt writes immutably', () => {
    const next = setSettingAt(DEFAULT_SETTINGS, 'privacy.allowDMs', 'friends');
    expect(next.privacy.allowDMs).toBe('friends');
    expect(DEFAULT_SETTINGS.privacy.allowDMs).toBe('everyone');
    expect(next.notifications).toEqual(DEFAULT_SETTINGS.notifications);
  });
});

describe('updateSetting (mocked Firestore)', () => {
  let storedDoc; // { settings: {...} } | null
  let failWrites = false;

  beforeEach(() => {
    storedDoc = null;
    failWrites = false;
    settingsService._cache.clear();

    const fakeStore = {
      doc: () => ({ path: 'users/uid1' }),
      getDoc: async () => ({ exists: () => storedDoc !== null, data: () => storedDoc }),
      setDoc: async (ref, data) => {
        if (failWrites) throw new Error('permission denied');
        storedDoc = { ...(storedDoc || {}), ...data };
      },
    };
    jest.unstable_mockModule('../firebase/firebase.js', () => ({
      getFirestoreInstance: jest.fn(async () => ({ fake: true })),
    }));
    jest.unstable_mockModule('firebase/firestore', () => fakeStore);
  });

  test('updateSetting persists and updates the local cache', async () => {
    const fresh = await import('../services/settingsService.js');
    const res = await fresh.settingsService.updateSetting('uid1', 'privacy.allowDMs', 'friends');
    expect(res.success).toBe(true);
    expect(res.settings.privacy.allowDMs).toBe('friends');
    expect(storedDoc.settings.privacy.allowDMs).toBe('friends');

    // Second read comes from cache and reflects the change
    const cached = await fresh.settingsService.getSettings('uid1');
    expect(cached.privacy.allowDMs).toBe('friends');
  });

  test('rejects updates without a user', async () => {
    const fresh = await import('../services/settingsService.js');
    await expect(
      fresh.settingsService.updateSetting(null, 'privacy.allowDMs', 'friends')
    ).rejects.toThrow('SETTINGS_NO_USER');
  });

  test('rolls back the optimistic update when persistence fails', async () => {
    const fresh = await import('../services/settingsService.js');
    // First update succeeds
    await fresh.settingsService.updateSetting('uid1', 'notifications.push', false);
    // Break persistence via the flag (closure is read at call time)
    failWrites = true;
    await expect(
      fresh.settingsService.updateSetting('uid1', 'playback.streamQuality', '1080p')
    ).rejects.toThrow('SETTINGS_SAVE_FAILED');
    // Cache must still hold the previous value (no lying UI)
    const after = await fresh.settingsService.getSettings('uid1');
    expect(after.playback.streamQuality).toBe('auto');
    expect(after.notifications.push).toBe(false);
  });
});

describe('clearApplicationCache', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('auth_token', 'tok');
    localStorage.setItem('user_session', 'sess');
    localStorage.setItem('arvdoul_locale', 'es');
    localStorage.setItem('arvdoul_flag_override_feed.ads', 'false');
    localStorage.setItem('random_key', '1');
    settingsService._cache.set('u9', { settings: DEFAULT_SETTINGS, at: Date.now() });
  });

  test('preserves auth/session/locale keys and clears everything else', async () => {
    const res = await settingsService.clearApplicationCache();
    expect(res.success).toBe(true);
    expect(localStorage.getItem('auth_token')).toBe('tok');
    expect(localStorage.getItem('user_session')).toBe('sess');
    expect(localStorage.getItem('arvdoul_locale')).toBe('es');
    expect(localStorage.getItem('random_key')).toBeNull();
    expect(localStorage.getItem('arvdoul_flag_override_feed.ads')).toBeNull();
    expect(res.cleared.length).toBeGreaterThan(0);
  });
});
