// src/__tests__/subscriptionLifecycleGuard.test.js
//
// Regression guard: a realtime subscription that is torn down *before* its async
// setup finishes must not create a listener afterwards, and must remove its own
// entry from the service's listener registry on teardown.
//
// `messagesService.subscribeToTyping` / `subscribeToConversation` both did
// `ensureInitialized().then(...)` with no cancellation: a StrictMode double-mount
// (or fast navigation) ran the disposer first, then the async setup registered an
// RTDB/Firestore listener that nothing could ever unsubscribe — a leak that
// outlives the component. The typing teardown also read its registry key without
// deleting it.
//
// (The Realtime-Database `status/` presence path and its `subscribeToUserPresence`
// were removed entirely — no code wrote that path, so the chat header could never
// show real presence; the header now reads the scope-gated `user_presence/{uid}`
// via `socialGraphService.getPresenceMap`. See finding N458.)
//
// These are the real service code paths; only the Firebase SDK surface (rt.onValue,
// fs.onSnapshot) is faked, because the emulator is not available here.

import { jest } from '@jest/globals';
import { getMessagingService } from '../services/messagesService.js';

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('Realtime subscription lifecycle', () => {
  let svc;

  beforeEach(() => {
    svc = getMessagingService();
    // The singleton persists across tests; pin the pieces each test relies on.
    svc.rtdbListeners = new Map();
    svc.firestoreListeners = new Map();
    svc.typingTimers = new Map();
    svc.rt = { ref: jest.fn(() => ({})), onValue: jest.fn(() => jest.fn()) };
    svc.fs = {
      collection: jest.fn(() => ({})),
      query: jest.fn(() => ({})),
      where: jest.fn(() => ({})),
      orderBy: jest.fn(() => ({})),
      limit: jest.fn(() => ({})),
      doc: jest.fn(() => ({})),
      onSnapshot: jest.fn(() => jest.fn()),
    };
  });

  test('typing listener is not created when torn down before init resolves', async () => {
    let resolveInit;
    svc.ensureInitialized = () => new Promise((resolve) => { resolveInit = resolve; });

    const off = svc.subscribeToTyping('c9', 'u1', () => {});
    off();
    resolveInit();
    await flush();

    expect(svc.rt.onValue).not.toHaveBeenCalled();
    expect(svc.rtdbListeners.size).toBe(0);
  });

  test('typing teardown unsubscribes and drops its registry entry', async () => {
    svc.ensureInitialized = async () => {};

    const off = svc.subscribeToTyping('c2', 'u2', () => {});
    await flush();

    expect(svc.rt.onValue).toHaveBeenCalledTimes(1);
    expect(svc.rtdbListeners.has('typing_c2')).toBe(true);

    off();

    expect(svc.rtdbListeners.has('typing_c2')).toBe(false);
  });

  test('a second typing subscriber keeps its listener when the first unsubscribes', async () => {
    svc.ensureInitialized = async () => {};

    const offA = svc.subscribeToTyping('c3', 'u3', () => {});
    await flush();
    const first = svc.rtdbListeners.get('typing_c3');
    const offB = svc.subscribeToTyping('c3', 'u3', () => {});
    await flush();
    const second = svc.rtdbListeners.get('typing_c3');

    offA(); // must not clobber B's listener

    expect(second).not.toBe(first);
    expect(svc.rtdbListeners.get('typing_c3')).toBe(second);
    offB();
    expect(svc.rtdbListeners.has('typing_c3')).toBe(false);
  });

  test('conversation subscription registers no listeners when torn down before setup resolves', async () => {
    svc.ensureInitialized = async () => {};
    svc.getConversation = async () => ({
      success: true,
      conversation: { id: 'c1', type: 'direct', participants: ['u1', 'u2'], participantCount: 2 },
    });
    svc.subscribeToTyping = jest.fn(() => jest.fn());

    const off = svc.subscribeToConversation('c1', 'u1', () => {});
    off(); // unmount before getConversation resolves
    await flush();

    expect(svc.subscribeToTyping).not.toHaveBeenCalled();
    expect(svc.fs.onSnapshot).not.toHaveBeenCalled();
  });

  test('subscribeToConversation releases its listeners on a normal teardown', async () => {
    svc.ensureInitialized = async () => {};
    svc.getConversation = async () => ({
      success: true,
      conversation: { id: 'c4', type: 'direct', participants: ['u1', 'u2'], participantCount: 2 },
    });
    const typingOff = jest.fn();
    svc.subscribeToTyping = jest.fn(() => typingOff);

    const off = svc.subscribeToConversation('c4', 'u1', () => {});
    await flush();

    expect(svc.fs.onSnapshot).toHaveBeenCalled();
    off();
    expect(typingOff).toHaveBeenCalled();
  });
});
