/**
 * Settings wiring guards.
 *
 * The Settings screen persisted these toggles to `users/{uid}.settings`, but
 * nothing read them: sound effects played regardless, reduce-motion only applied
 * while the screen was mounted, and push/email opt-outs never reached the
 * server. These tests pin the wires that make each toggle real.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

describe('settings wiring', () => {
  test('soundFx toggle is honoured by the sound hook', () => {
    const src = read('src/hooks/useSound.js');
    expect(src).toContain('setSoundFxEnabled');
    expect(src).toMatch(/if \(!soundFxEnabled\) return/);
  });

  test('reduce-motion and soundFx are applied session-wide, not only on the settings screen', () => {
    const hook = read('src/hooks/useUserSettings.js');
    expect(hook).toContain('arvdoul-reduce-motion');
    expect(hook).toContain('setSoundFxEnabled');
    // Mounted once inside AuthProvider.
    const auth = read('src/context/AuthContext.jsx');
    expect(auth).toContain('useUserSettings');
    expect(auth).toMatch(/useUserSettings\(user\?\.uid\)/);
  });

  test('the settings screen mirrors push/email opt-outs to the server document', () => {
    const src = read('src/screens/SettingsScreen.jsx');
    expect(src).toContain('handleNotificationChannel');
    expect(src).toContain('updateUserNotificationPreferences');
    expect(src).toMatch(/handleNotificationChannel\('notifications\.push'/);
    expect(src).toMatch(/handleNotificationChannel\('notifications\.email'/);
  });

  test('the server honours the push/inApp channel opt-outs', () => {
    const src = read('functions/notifications.js');
    expect(src).toContain('pushEnabled');
    expect(src).toContain('inAppEnabled');
    expect(src).toMatch(/if \(pushEnabled\)/);
    expect(src).toMatch(/if \(inAppEnabled\)/);
  });

  test('autoPlayVideos gates the feed autoplay, not just persists', () => {
    expect(read('src/components/Videos/VideoFeed.jsx')).toMatch(/autoPlay=\{autoPlayEnabled && index === currentIndex\}/);
    expect(read('src/screens/ReelsScreen.jsx')).toMatch(/autoPlay=\{autoPlayEnabled\}/);
    expect(read('src/services/settingsService.js')).toContain('getCachedSettings');
  });

  test('profile privacy is owned by the profile, not duplicated into settings', () => {
    // AGENTS.md: profile privacy lives on users/{uid}.isPrivate + profile.privacy.*
    expect(read('src/services/settingsService.js')).not.toContain('profilePrivate');
    const screen = read('src/screens/SettingsScreen.jsx');
    expect(screen).not.toMatch(/updateSetting\('privacy\.profilePrivate'/);
    expect(screen).toMatch(/updateUserProfile\(uid, \{ isPrivate: val \}\)/);
  });

  test('settings expose no toggle the app cannot honour', () => {
    // spatialAudio had no spatial-audio graph and streamQuality no HLS ladder;
    // both were persisted and read by nothing. Removed rather than shipped as
    // theatre (a control that silently does nothing is a lie).
    const src = read('src/services/settingsService.js');
    expect(src).not.toContain('spatialAudio');
    expect(src).not.toContain('streamQuality');
    // `privacy.showActiveStatus` was written by a toggle that only ever called
    // handleUpdateProfilePrivacyScope('presence', …) — the setting key itself had
    // no reader; presence visibility is owned by `profile.privacy.presence`
    // (resolveCapabilities). The toggle duplicated the "Live Online Presence"
    // scope selector below it, so both the key and the toggle were removed.
    expect(src).not.toContain('showActiveStatus');
    const screen = read('src/screens/SettingsScreen.jsx');
    expect(screen).not.toContain('spatialAudio');
    expect(screen).not.toContain('streamQuality');
    expect(screen).not.toMatch(/updateSetting\('privacy\.showActiveStatus'/);
    expect(screen).not.toMatch(/settings\.privacy\.showActiveStatus/);
  });
});
