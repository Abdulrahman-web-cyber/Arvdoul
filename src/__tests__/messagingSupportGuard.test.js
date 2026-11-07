/**
 * src/__tests__/messagingSupportGuard.test.js
 *
 * The Firebase JS SDK's `getMessaging()` runs its browser-support check in a
 * FLOATING promise:
 *
 *   isWindowSupported().then((isSupported) => {
 *     if (!isSupported) throw ERROR_FACTORY.create('unsupported-browser');
 *   });
 *
 * On a browser without the required APIs (jsdom, older Safari/Firefox) that
 * throws an UNHANDLED rejection rather than a catchable error. It aborted
 * unrelated Jest suites at random (observed ~1 run in 3 on this machine) and
 * would surface as an unhandled promise rejection in the app. The fix is to
 * gate `getMessaging()` on `isSupported()` first, so it is never called when it
 * would throw.
 *
 * Also guards that FCM being unavailable does not break the rest of the
 * notifications service: `ensureInitialized` must treat messaging as a
 * best-effort capability, not a prerequisite.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

describe('messaging browser-support gate', () => {
  test('firebase.js checks isSupported() before calling the SDK getMessaging()', () => {
    const src = read('src/firebase/firebase.js');
    const start = src.indexOf('async getMessaging()');
    expect(start).toBeGreaterThan(-1);
    // Method body up to the next top-level `async ` method.
    const rest = src.slice(start);
    const endRel = rest.indexOf('\n  async getFunctions(');
    const body = endRel === -1 ? rest : rest.slice(0, endRel);

    const supportedAt = body.indexOf('isSupported()');
    // The SDK call is `messagingMod.getMessaging(` / `getMessaging(` — match the
    // property access, not the method's own declaration name.
    const sdkCallAt = body.search(/messagingMod\.getMessaging\(/);
    expect(supportedAt).toBeGreaterThan(-1);
    expect(sdkCallAt).toBeGreaterThan(-1);
    expect(supportedAt).toBeLessThan(sdkCallAt);
  });

  test('no other src file calls the SDK getMessaging() directly', () => {
    const offenders = [];
    const walk = (dir) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (entry.name === '__tests__' || entry.name === 'node_modules') continue;
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (/\.(js|jsx)$/.test(entry.name)) {
          const rel = path.relative(root, full);
          if (rel.endsWith('src/firebase/firebase.js')) continue;
          const src = fs.readFileSync(full, 'utf8');
          if (/(?:^|[^.\w])getMessaging\s*\(/.test(src)) offenders.push(rel);
        }
      }
    };
    walk(path.join(root, 'src'));
    expect(offenders).toEqual([]);
  });

  test('notificationsService treats FCM as best-effort, not a prerequisite', () => {
    const src = read('src/services/notificationsService.js');
    const callAt = src.indexOf('await getMessagingInstance()');
    expect(callAt).toBeGreaterThan(-1);
    // The call must sit inside a try block whose catch keeps init alive.
    const before = src.slice(Math.max(0, callAt - 400), callAt);
    expect(before).toMatch(/try\s*\{/);
    const after = src.slice(callAt, callAt + 400);
    expect(after).toMatch(/catch\s*\(/);
  });
});

describe('getMessagingInstance when FCM is unsupported', () => {
  test('rejects without ever calling the SDK getMessaging()', async () => {
    const { jest } = await import('@jest/globals');
    const sdkGetMessaging = jest.fn(() => {
      throw new Error('SDK getMessaging() must not be called when unsupported');
    });
    jest.unstable_mockModule('firebase/messaging', () => ({
      isSupported: jest.fn(async () => false),
      getMessaging: sdkGetMessaging,
      getToken: jest.fn(),
      onMessage: jest.fn(),
      deleteToken: jest.fn(),
    }));

    const { getMessagingInstance } = await import('../firebase/firebase.js');
    await expect(getMessagingInstance()).rejects.toThrow(/FCM|Messaging/);
    expect(sdkGetMessaging).not.toHaveBeenCalled();
  });
});
