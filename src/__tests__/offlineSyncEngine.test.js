/**
 * @jest-environment jsdom
 */

import { jest } from '@jest/globals';
import {
  enqueueAction,
  getQueueStatus,
  offlineQueue,
  purgeQueueForOwner,
  registerSyncHandler,
  syncQueue,
  subscribeSyncStatus,
} from '../offline/syncEngine';

describe('Phase 7 & 8: Deep Offline Synchronization Engine', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('reports current queue status including online status', async () => {
    const status = await getQueueStatus();
    expect(status).toHaveProperty('isOnline');
    expect(status).toHaveProperty('isSyncing');
    expect(status).toHaveProperty('pendingCount');
  });

  test('registers and triggers custom mutation handlers on syncQueue', async () => {
    const mockHandler = jest.fn().mockResolvedValue({ success: true });
    registerSyncHandler('test.action', mockHandler);

    await enqueueAction({
      type: 'test.action',
      payload: { itemId: '123' },
    });

    await syncQueue();

    // The handler should have been invoked with payload
    expect(mockHandler).toHaveBeenCalledWith(
      expect.objectContaining({ itemId: '123' })
    );
  });

  test('drops mutations that exceed the conflict window (> 7 days old)', async () => {
    const mockHandler = jest.fn().mockResolvedValue({ success: true });
    registerSyncHandler('stale.action', mockHandler);

    const EIGHT_DAYS_AGO = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString();

    await enqueueAction({
      type: 'stale.action',
      payload: { clientTimestamp: EIGHT_DAYS_AGO, data: 'stale' },
    });

    await syncQueue();

    // Expired item dropped, handler not executed
    expect(mockHandler).not.toHaveBeenCalled();
  });

  test('subscribeSyncStatus receives status updates', async () => {
    let received = null;
    const unsubscribe = subscribeSyncStatus((status) => {
      received = status;
    });

    await new Promise((r) => setTimeout(r, 50));
    expect(received).toBeDefined();
    unsubscribe();
  });

  test('binds an unowned enqueue to the live session account (N014)', async () => {
    const sessionHandler = jest.fn().mockResolvedValue({ success: true });
    registerSyncHandler('session.action', sessionHandler);

    window._arvdoul_auth = { currentUser: { uid: 'session-user' } };
    try {
      await offlineQueue.enqueue({
        type: 'session.action',
        payload: { note: 'implicit owner' },
      });

      // A different account must not drain it.
      await syncQueue({ ownerUid: 'other-user' });
      expect(sessionHandler).not.toHaveBeenCalled();

      await syncQueue({ ownerUid: 'session-user' });
      expect(sessionHandler).toHaveBeenCalledWith(
        expect.objectContaining({ note: 'implicit owner' })
      );
    } finally {
      window._arvdoul_auth = undefined;
    }
  });

  test('purges only the departing account\'s queued ops (N014)', async () => {
    const handler = jest.fn().mockResolvedValue({ success: true });
    registerSyncHandler('purge.action', handler);

    await offlineQueue.enqueue({ type: 'purge.action', payload: { n: 1 }, ownerUid: 'departing' });
    await offlineQueue.enqueue({ type: 'purge.action', payload: { n: 2 }, ownerUid: 'staying' });

    const removed = await purgeQueueForOwner('departing');
    expect(removed).toBeGreaterThanOrEqual(1);

    await syncQueue({ ownerUid: 'staying' });
    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith(expect.objectContaining({ n: 2 }));
  });

  test('never replays another account\'s queued ops (N014 account partitioning)', async () => {
    const ownerA = jest.fn().mockResolvedValue({ success: true });
    registerSyncHandler('partition.action', ownerA);

    // Enqueue directly so no auto-drain fires for account A.
    await offlineQueue.enqueue({
      type: 'partition.action',
      payload: { note: 'belongs to A' },
      ownerUid: 'account-A',
    });

    // Draining as account B must skip A's op entirely.
    await syncQueue({ ownerUid: 'account-B' });
    expect(ownerA).not.toHaveBeenCalled();

    // Draining as account A executes it.
    await syncQueue({ ownerUid: 'account-A' });
    expect(ownerA).toHaveBeenCalledWith(
      expect.objectContaining({ note: 'belongs to A' })
    );
  });
});
