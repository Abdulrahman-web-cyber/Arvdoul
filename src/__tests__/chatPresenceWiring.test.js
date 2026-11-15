// src/__tests__/chatPresenceWiring.test.js
//
// N458 — the 1:1 chat header's presence must come from the one real,
// scope-gated source (`user_presence/{uid}` via
// `socialGraphService.getPresenceMap`), never from the Realtime-Database
// `status/` path. That RTDB path had no writer anywhere (`setUserOnline` had
// zero callers), so the header could never render a real "Online / Last seen"
// — it was a dead control, and the store's `presence`/`setPresence` slice had
// no reader either. These assertions fail on the pre-fix code so the dead path
// cannot silently return.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

describe('chat presence is read from user_presence, not the dead RTDB path (N458)', () => {
  const svc = read('src/services/messagesService.js');
  const screen = read('src/screens/ChatScreen.jsx');
  const store = read('src/store/messagingStore.js');

  test('messagesService no longer defines the writer-less RTDB presence API', () => {
    expect(svc).not.toContain('subscribeToUserPresence');
    expect(svc).not.toContain('async setUserOnline');
    expect(svc).not.toMatch(/PRESENCE:\s*'status'/);
  });

  test('the RTDB presence path constant is gone (typing stays)', () => {
    expect(svc).not.toMatch(/LAST_SEEN:\s*'lastSeen'/);
    expect(svc).toContain("TYPING: 'typing'");
  });

  test('ChatScreen reads the counterpart from getPresenceMap', () => {
    expect(screen).toContain('getPresenceMap');
    expect(screen).toContain('socialGraphService');
  });

  test('ChatScreen does not consume a fabricated presence_update event', () => {
    expect(screen).not.toContain('presence_update');
  });

  test('the messagingStore carries no dead presence slice', () => {
    expect(store).not.toMatch(/\bpresence:\s*\{\}/);
    expect(store).not.toContain('setPresence');
    expect(store).not.toContain('presenceSubscription');
  });
});
