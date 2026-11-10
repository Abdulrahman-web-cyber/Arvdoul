/**
 * src/__tests__/notificationBlockFiltering.test.js
 *
 * Moderation enforcement in notifications (AGENTS.md §7.17). N231 stopped the
 * *write* path (`sendNotification` refuses to deliver across a block), but a
 * notification delivered BEFORE the block (or a mute) still rendered in the
 * recipient's Alerts inbox and pushed rows through the realtime subscription.
 *
 * This suite pins the read-path fix:
 *   - `_getHiddenSenders` resolves the graph spine's shared hidden-author set
 *     (blocked + blocked-by + muted) and caches it briefly.
 *   - `_filterHiddenSenders` drops notifications authored by a hidden sender
 *     while always keeping system notifications (no `senderId`).
 *
 * @jest-environment node
 */

import { jest } from '@jest/globals';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const getHiddenAuthorIds = jest.fn();
jest.unstable_mockModule('../services/socialGraphService.js', () => ({
  getSocialGraphService: () => ({ getHiddenAuthorIds }),
  socialGraphService: { getHiddenAuthorIds },
}));

const { getNotificationsService } = await import('../services/notificationsService.js');

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const source = fs.readFileSync(path.join(root, 'src/services/notificationsService.js'), 'utf8');

beforeEach(() => getHiddenAuthorIds.mockReset());

describe('notificationsService block/mute filtering', () => {
  test('_getHiddenSenders reads the spine and caches the result', async () => {
    getHiddenAuthorIds.mockResolvedValue(new Set(['blocked-1', 'muted-2']));
    const svc = getNotificationsService();
    svc.hiddenSendersCache.clear();

    const ids = await svc._getHiddenSenders('viewer-1');
    expect([...ids].sort()).toEqual(['blocked-1', 'muted-2']);
    expect(getHiddenAuthorIds).toHaveBeenCalledWith('viewer-1');

    // Second call is served from cache — the spine is not read again.
    getHiddenAuthorIds.mockClear();
    await svc._getHiddenSenders('viewer-1');
    expect(getHiddenAuthorIds).not.toHaveBeenCalled();
  });

  test('_getHiddenSenders returns an empty set for an anonymous viewer', async () => {
    const svc = getNotificationsService();
    expect((await svc._getHiddenSenders(null)).size).toBe(0);
    expect(getHiddenAuthorIds).not.toHaveBeenCalled();
  });

  test('_getHiddenSenders fails open (empty set) when the graph read throws', async () => {
    getHiddenAuthorIds.mockRejectedValue(new Error('offline'));
    const svc = getNotificationsService();
    svc.hiddenSendersCache.clear();
    expect((await svc._getHiddenSenders('viewer-err')).size).toBe(0);
  });

  test('_filterHiddenSenders drops hidden senders but keeps system notifications', () => {
    const svc = getNotificationsService();
    const rows = [
      { id: 'n1', senderId: 'blocked-1' },
      { id: 'n2', senderId: 'friend-1' },
      { id: 'n3' }, // system notification, no sender
    ];
    const out = svc._filterHiddenSenders(rows, new Set(['blocked-1']));
    expect(out.map((r) => r.id)).toEqual(['n2', 'n3']);
    // No hidden set → identity (no needless copy that would break the
    // change-batch semantics callers rely on).
    expect(svc._filterHiddenSenders(rows, new Set())).toBe(rows);
  });

  test('both read paths apply the hidden-sender filter', () => {
    // getUserNotifications (callable path) must filter before caching.
    expect(source).toContain('this._filterHiddenSenders(data.notifications || [], hidden)');
    // The realtime subscription must filter the change batch before emitting.
    expect(source).toMatch(/added: this\._filterHiddenSenders\(added, hidden\)/);
    expect(source).toMatch(/modified: this\._filterHiddenSenders\(modified, hidden\)/);
  });
});
