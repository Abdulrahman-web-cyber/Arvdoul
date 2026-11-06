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
});
