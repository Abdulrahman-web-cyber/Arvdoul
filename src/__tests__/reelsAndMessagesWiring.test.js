/**
 * Reels + Messages wiring guards (N105, N107, N108, N109, N110).
 *
 * These lock in the fixes for the reels/chat audit. Each assertion fails on the
 * pre-fix code, so a regression cannot silently return:
 *
 *   N107  getMessages returned newest-first, but every surface renders in array
 *         order -> the newest message showed at the TOP and "load earlier"
 *         appended at the BOTTOM.
 *   N105  the optimistic bubble used `p.localId` (undefined) and was never
 *         reconciled, so a sent message rendered twice.
 *   N108  the reels Messages badge was a hardcoded "8".
 *   N109  the reels header showed a "Following" mutual-friends pill it never
 *         resolved (fabricated relationship).
 *   N110  the reels feed stopped at 10 videos: the screen never paginated and
 *         getVideoFeed ignored the `cursor` callers passed.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

describe('messages ordering is chronological (N107)', () => {
  const svc = read('src/services/messagesService.js');

  test('a new message is never sharded via a serverTimestamp() sentinel', () => {
    // _buildMessage sets createdAt to serverTimestamp(), which has no .toDate();
    // calling it on the send path threw a TypeError on every message.
    expect(svc).not.toMatch(/_getMessageSubcollectionPath\([^)]*\.createdAt\.toDate\(\)/);
    expect(svc).not.toMatch(/message\.createdAt\.toDate\(\)/);
  });

  test('getMessages normalises to oldest-first before returning', () => {
    expect(svc).toContain('_messageTime(');
    expect(svc).toMatch(/liveMessages\.sort\(\(a, b\) => this\._messageTime\(a\) - this\._messageTime\(b\)\)/);
  });

  test('TTL is enforced in-memory without hiding field-less messages (N106)', () => {
    expect(svc).not.toMatch(/where\('ttlExpiresAt', '>'/);
    expect(svc).toMatch(/const ttl = this\._toMillis\(m\.ttlExpiresAt\)/);
    expect(svc).toMatch(/ttl === null \|\| ttl > nowMs/);
  });
});

describe('chat reconciles the optimistic message (N105)', () => {
  const chat = read('src/screens/ChatScreen.jsx');

  test('pending entries are built from the map key, never the undefined p.localId', () => {
    expect(chat).not.toContain('id: p.localId');
    expect(chat).toContain('pendingRef.current.entries()');
  });

  test('pending messages already returned by the server are dropped', () => {
    expect(chat).toContain('serverIds');
    expect(chat).toMatch(/filter\(\(\[localId\]\) => !serverIds\.has\(localId\)\)/);
  });

  test('a successful send reconciles the bubble instead of only awaiting', () => {
    expect(chat).toContain('reconcileSentMessage');
    expect(chat).toMatch(/const res = await getMessagingService\(\)\.sendMessage/);
  });
});

describe('reels nav badge is live and no fabricated relationship (N108, N109)', () => {
  const reels = read('src/screens/ReelsScreen.jsx');

  test('the reels screen does not duplicate the app bottom nav', () => {
    // The screen rendered its own inline <nav> while MainLayout still mounted
    // the canonical BottomNav on /reels — two bottom bars stacked, and the
    // inline one hardcoded /friends and /create-story. Navigation (and its live
    // unread badge) belongs to BottomNav alone.
    expect(reels).not.toMatch(/<nav\b/);
  });

  test('the canonical BottomNav owns the live unread badge', () => {
    const nav = read('src/components/Shared/BottomNav.jsx');
    expect(nav).toContain('useNavBadges');
    expect(nav).toMatch(/unreadCounts/);
  });

  test('no hardcoded unread count literal', () => {
    expect(reels).not.toMatch(/>\s*8\s*</);
  });

  test('no fake mutual-friends / "Following" pill', () => {
    expect(reels).not.toContain('Real mutual-friend indicator');
    expect(reels).not.toContain('ChevronRight');
  });
});

describe('reels feed paginates (N110)', () => {
  test('ReelsScreen requests the next page with the opaque cursor', () => {
    const reels = read('src/screens/ReelsScreen.jsx');
    expect(reels).toContain('loadMoreReels');
    expect(reels).toMatch(/cursor: cursorRef\.current/);
  });

  test('getVideoFeed resolves the cursor id to a document snapshot', () => {
    const svc = read('src/services/videoService.js');
    expect(svc).toMatch(/if \(!lastDocSnapshot && cursor\)/);
  });
});
