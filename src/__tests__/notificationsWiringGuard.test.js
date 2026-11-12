/**
 * Notifications screen wiring guard.
 *
 * The Firestore notifications subscription (`notificationsService
 * .subscribeToUserNotifications`) emits a change *batch*:
 *
 *     { type: 'update', added: [...], modified: [...], subscriptionId }
 *
 * The screen, however, only accepted a bare array
 * (`if (Array.isArray(payload) && payload.length > 0)`), so the branch never
 * ran: every real notification was silently dropped and the Alerts tab stayed
 * empty. On top of that:
 *
 *  - the screen's icon / gift-modal / Live-navigation logic was keyed on legacy
 *    type aliases (`post_like`, `coin_gift`, `live_stream`) while the service
 *    emits canonical ids (`like`, `gift_received`, `live_started`), so those
 *    branches were dead even once the payload arrived;
 *  - `handleMarkRead` flipped only local state and never called
 *    `markNotificationAsRead`, so the server unread counter (and the nav badge)
 *    never cleared.
 *
 * @jest-environment node
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

describe('NotificationsScreen consumes the real subscription payload', () => {
  const screen = read('src/screens/NotificationsScreen.jsx');

  test('the change batch ({ added, modified }) is read, not only a bare array', () => {
    expect(screen).toMatch(/payload\?\.added/);
    expect(screen).toMatch(/payload\?\.modified/);
    // The old bug: an array-only guard that discarded the real payload.
    expect(screen).not.toMatch(/if \(Array\.isArray\(firestoreNotifs\)/);
  });

  test('canonical service type ids are normalised to the aliases the UI renders', () => {
    expect(screen).toMatch(/normalizeNotificationType/);
    expect(screen).toMatch(/gift_received:\s*'coin_gift'/);
    expect(screen).toMatch(/live_started:\s*'live_stream'/);
    expect(screen).toMatch(/like:\s*'post_like'/);
    // The mapped type must be what the icon/gift logic compares against.
    expect(screen).toMatch(/const type = normalizeNotificationType\(fn\.type\)/);
  });

  test('marking a single notification read is persisted, not just local', () => {
    const start = screen.indexOf('const handleMarkRead');
    const body = screen.slice(start, screen.indexOf('\n  };', start));
    expect(body).toMatch(/notificationsService\.markNotificationAsRead\(/);
  });

  test('the System filter tab can actually match a notification (N256)', () => {
    // Every other tab had a `type`-based fallback in the filter, but System
    // keyed on `category === 'System'` alone and no notification was ever
    // categorised as System — the tab matched nothing.
    expect(screen).toMatch(/SYSTEM_NOTIFICATION_TYPES/);
    expect(screen).toMatch(/SYSTEM_NOTIFICATION_TYPES\.has\(type\) \? 'System'/);
    // Platform-generated types (senderId 'system') must be in the set.
    expect(screen).toMatch(/'system_alert'/);
    expect(screen).toMatch(/'security_alert'/);
  });
});

describe('push-token lifecycle is complete', () => {
  const auth = read('src/context/AuthContext.jsx');

  test('sign-out deregisters the device push token (removePushToken)', () => {
    // removePushToken is the only writer that deletes push_tokens/{uid}/devices
    // /{deviceId}; without a sign-out call the device kept receiving the
    // account's notifications after logout. It must be invoked before signOut().
    const start = auth.indexOf('const signOut = useCallback');
    const body = auth.slice(start, auth.indexOf('}, [authService, navigate', start));
    expect(body).toContain('removePushToken');
    expect(body.indexOf('removePushToken')).toBeLessThan(body.indexOf('authService.signOut()'));
  });
});
