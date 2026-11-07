// src/__tests__/subscriptionLifecycleGuard.test.js
//
// Regression guard: a realtime subscription that is torn down *before* its async
// setup finishes must not create a listener afterwards, and must remove its own
// entry from the service's listener registry on teardown.
//
// `messagesService.subscribeToUserPresence` / `subscribeToConversation` both did
// `ensureInitialized().then(...)` with no cancellation: a StrictMode double-mount
// (or fast navigation) ran the disposer first, then the async setup registered an
// RTDB listener that nothing could ever unsubscribe — a leak that outlives the
// component. The presence teardown also read its registry key without deleting it.
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
      orderBy: jest.fn(() => ({})),
      limit: jest.fn(() => ({})),
      doc: jest.fn(() => ({})),
      onSnapshot: jest.fn(() => jest.fn()),
    };
  });

  test('presence listener is not created when torn down before init resolves', async () => {
    let resolveInit;
    svc.ensureInitialized = () => new Promise((resolve) => { resolveInit = resolve; });

    const off = svc.subscribeToUserPresence('u1', () => {});
    off(); // component unmounts before initialization finishes
    resolveInit();
    await flush();

    expect(svc.rt.onValue).not.toHaveBeenCalled();
    expect(svc.rtdbListeners.size).toBe(0);
  });

  test('presence teardown unsubscribes and drops its registry entry', async () => {
    svc.ensureInitialized = async () => {};

    const off = svc.subscribeToUserPresence('u2', () => {});
    await flush();

    expect(svc.rt.onValue).toHaveBeenCalledTimes(1);
    expect(svc.rtdbListeners.has('presence_u2')).toBe(true);

    off();

    expect(svc.rtdbListeners.has('presence_u2')).toBe(false);
  });

  test('a second presence subscriber keeps its listener when the first unsubscribes', async () => {
    svc.ensureInitialized = async () => {};

    const offA = svc.subscribeToUserPresence('u3', () => {});
    await flush();
    const first = svc.rtdbListeners.get('presence_u3');
    const offB = svc.subscribeToUserPresence('u3', () => {});
    await flush();
    const second = svc.rtdbListeners.get('presence_u3');

    offA(); // must not clobber B's listener

    expect(second).not.toBe(first);
    expect(svc.rtdbListeners.get('presence_u3')).toBe(second);
    offB();
    expect(svc.rtdbListeners.has('presence_u3')).toBe(false);
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

  test('conversation subscription registers no listeners when torn down before setup resolves', async () => {
    svc.ensureInitialized = async () => {};
    svc.getConversation = async () => ({
      success: true,
      conversation: { id: 'c1', type: 'direct', participants: ['u1', 'u2'], participantCount: 2 },
    });
    svc.subscribeToTyping = jest.fn(() => jest.fn());
    const presenceSpy = jest.spyOn(svc, 'subscribeToUserPresence');

    const off = svc.subscribeToConversation('c1', 'u1', () => {});
    off(); // unmount before getConversation resolves
    await flush();

    expect(presenceSpy).not.toHaveBeenCalled();
    expect(svc.fs.onSnapshot).not.toHaveBeenCalled();
  });
});
