/**
 * A follow against a private account is a *pending request*, not a follow:
 * `userService.followUser` files `follow_requests/{from}_{to}` with status
 * `pending` and creates NO `follows` edge or counter move, returning
 * `{ requested: true, requestStatus: 'pending' }`.
 *
 * Surfaces that only read the follow edge therefore rendered a plain "Follow"
 * for a target the viewer had already requested; a second tap filed a
 * duplicate request and the "Following" state was never reachable. These
 * guards pin the three edges of the fix:
 *
 *  1. The graph spine resolves the pending state (`getRelationship` /
 *     `getEdgeSet` → `requestStatus`), reading only when the follow edge is
 *     requested.
 *  2. `userService.getFollowStates` surfaces it.
 *  3. Every follow control branches on it (Requested, not Follow) and offers
 *     cancel (`cancelFollowRequest`).
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

describe('pending follow request is a distinct, real state', () => {
  test('the graph spine reads follow_requests only when the follow edge is wanted', () => {
    const src = read('src/services/socialGraphService.js');
    // The pending read is gated on the follow edge and uses the rules-provable
    // actor-equality + other-party `in` shape with an explicit status filter.
    expect(src).toMatch(/include\.includes\('follow'\)[\s\S]{0,400}follow_requests/);
    expect(src).toMatch(/collection:\s*'follow_requests'/);
    expect(src).toMatch(/actorField:\s*'fromUserId'/);
    expect(src).toMatch(/otherField:\s*'toUserId'/);
    expect(src).toMatch(/equals:\s*\{\s*status:\s*'pending'\s*\}/);
  });

  test('getRelationship resolves requestStatus (so the capability engine sees PENDING)', () => {
    const src = read('src/services/socialGraphService.js');
    const relBlock = src.slice(src.indexOf('async getRelationship'), src.indexOf('async getEdgeSet'));
    expect(relBlock).toMatch(/requestStatus:\s*pendingOut\.has/);
  });

  test('userService.getFollowStates surfaces requestStatus', () => {
    const src = read('src/services/userService.js');
    expect(src).toMatch(/requestStatus:\s*edge\.requestStatus/);
  });

  test('every follow control renders a Requested state; the owner can cancel the request', () => {
    // The carousel is presentational — it renders the Requested label; the
    // follow logic (and cancel) lives in the screen that owns it.
    for (const file of [
      'src/screens/ReelsScreen.jsx',
      'src/screens/SearchScreen.jsx',
      'src/components/Videos/VideoCard.jsx',
      'src/components/search/CreatorCarousel.jsx',
      'src/screens/PostOptionsDrawer.jsx',
      'src/components/profile/ProfileHeroSection.jsx',
      'src/screens/Profile/ProfilePublicScreen.jsx',
    ]) {
      const src = read(file);
      expect(src).toContain('requestStatus');
      expect(src).toContain("'pending'");
    }
    for (const file of [
      'src/screens/ReelsScreen.jsx',
      'src/screens/SearchScreen.jsx',
      'src/components/Videos/VideoCard.jsx',
      'src/screens/PostOptionsDrawer.jsx',
      'src/screens/Profile/ProfilePublicScreen.jsx',
    ]) {
      expect(read(file)).toContain('cancelFollowRequest');
    }
  });

  test('ConnectionsScreen hydrates the real per-row follow state, not an undefined field', () => {
    // `hydrateProfiles`/`projectProfileForViewer` mask privacy but never attach
    // the viewer→row follow edge, so `citizen.isFollowing` was always undefined
    // and every row rendered "Follow".
    const src = read('src/screens/Profile/ConnectionsScreen.jsx');
    expect(src).toMatch(/getFollowStates\(currentUserId, allIds\)/);
    expect(src).toMatch(/requestStatus:\s*s\?\.requestStatus/);
    // The friends tab is a mutual-follow list, not a raw follower scan that
    // filtered on the never-set `isFollowing` field.
    expect(src).toMatch(/userService\.getFriends\(targetUserId/);
    expect(src).not.toMatch(/r\.followers \|\| \[\]\)\.filter\(\(f\) => f\.isFollowing\)/);
  });

  test('NotificationsScreen reconciles the pending request and never fabricates a follow', () => {
    // `followUser` against a private account files a pending request (no edge),
    // but the follower row optimistically added the user to `following` and
    // toasted "Following" — a follow that never happened — and the Follow Back
    // button decided follow/unfollow from `following.some(...)` (the viewer's own
    // list), not the real per-pair edge.
    const src = read('src/screens/NotificationsScreen.jsx');
    expect(src).toMatch(/getFollowStates\(user\.uid, stateIds\)/);
    expect(src).toMatch(/result\?\.requested \|\| result\?\.requestStatus === 'pending'/);
    expect(src).toMatch(/handleCancelFollowRequest/);
    expect(src).toMatch(/cancelFollowRequest\(user\.uid, targetId\)/);
    expect(src).not.toMatch(/const isAlreadyFollowing = following\.some/);
  });

  test('the owner visitor preview carries requestStatus and disables handler-less controls', () => {
    const preview = read('src/screens/Profile/ProfilePreviewScreen.jsx');
    expect(preview).toMatch(/requestStatus:\s*storeFollowStatus\?\.requestStatus/);
    const hero = read('src/components/profile/ProfileHeroSection.jsx');
    // Preview passes no onFollowToggle/onOpenTipModal/onOpenOptions/onOpenMessages,
    // so those controls must render disabled rather than silently do nothing.
    expect(hero).toMatch(/disabled=\{followLoading \|\| !onFollowToggle\}/);
    expect(hero).toMatch(/disabled=\{!onOpenTipModal\}/);
    expect(hero).toMatch(/disabled=\{!onOpenOptions\}/);
    expect(hero).toMatch(/disabled=\{!onOpenMessages\}/);
  });
});
