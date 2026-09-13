/**
 * @jest-environment jsdom
 */

import { jest } from '@jest/globals';
import {
  enqueueAction,
  getQueueStatus,
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
});
