/**
 * PostCard field-reality + ad-disclosure guard.
 *
 * Two classes of bug lived in `PostCard`:
 *
 * 1. **Dead field reads.** `post.momentum` ('trending'/'exploding') and
 *    `post.communityNotes` were rendered but no writer ever sets either on a
 *    `posts/{id}` document (the scheduler writes `trendingScore`/
 *    `personalizationScore`, and there is no community-notes collection), so the
 *    badges/block were permanently dead. They were removed.
 *
 * 2. **Undisclosed ads.** `feedService._getAdOptimized` inserts cards shaped
 *    `{ type: 'ad', isAd: true, cta, link, ... }` and `feed.ads` defaults to
 *    true, but `PostCard` only checked `post.isSponsored`/`post.adCampaignId`.
 *    Every feed ad therefore rendered with **no sponsored label and no CTA** —
 *    an ad a viewer cannot identify. The card now treats `type === 'ad'`/
 *    `isAd === true` as sponsored and reads the ad card's `cta`/`link`.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const rawPostCard = fs.readFileSync(path.join(root, 'src', 'screens', 'PostCard.jsx'), 'utf8');
// Strip comments so a prose mention of a dead field is not mistaken for a read.
const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
const postCard = stripComments(rawPostCard);

describe('PostCard renders only real fields and discloses ads', () => {
  test('no dead `post.momentum` or `post.communityNotes` reads', () => {
    expect(postCard).not.toMatch(/post\.momentum/);
    expect(postCard).not.toMatch(/post\.communityNotes/);
  });

  test('the feed ad card shape is treated as sponsored', () => {
    expect(postCard).toMatch(/post\.type === 'ad'/);
    expect(postCard).toMatch(/post\.isAd === true/);
  });

  test('ad CTA falls back to the feed ad card `cta`/`link`', () => {
    expect(postCard).toMatch(/post\.cta\b/);
    expect(postCard).toMatch(/post\.link\b/);
  });

  test('feedService still emits the ad card shape this guard assumes', () => {
    const feed = fs.readFileSync(path.join(root, 'src', 'services', 'feedService.js'), 'utf8');
    expect(feed).toMatch(/type:\s*'ad'/);
    expect(feed).toMatch(/isAd:\s*true/);
  });

  test('the follow control hydrates real state and shows a pending request', () => {
    // Hydrated from the canonical status read, not hardcoded to 'none'.
    expect(postCard).toMatch(/getFollowStatus\(/);
    expect(postCard).toMatch(/requestStatus === 'pending'/);
    expect(postCard).toMatch(/'requested'/);
  });

  test('viewer like/save/reaction state is hydrated, not read from the post doc', () => {
    // No writer ever sets these on a post document, so reading them was dead
    // (and always false). The card must read the viewer's own subcollection.
    expect(postCard).not.toMatch(/post\.userReaction/);
    expect(postCard).not.toMatch(/post\.savedBy/);
    expect(postCard).not.toMatch(/post\.likedBy\b/);
    expect(postCard).toMatch(/getPostViewerState/);
  });

  test('PostOptionsDrawer does not read the dead `post.savedBy` field', () => {
    const drawer = stripComments(fs.readFileSync(path.join(root, 'src', 'screens', 'PostOptionsDrawer.jsx'), 'utf8'));
    expect(drawer).not.toMatch(/\.savedBy\b/);
    expect(drawer).toMatch(/getPostViewerState/);
  });

  test('PostOptionsDrawer reconciles a pending follow request (not a fake follow)', () => {
    const drawer = stripComments(fs.readFileSync(path.join(root, 'src', 'screens', 'PostOptionsDrawer.jsx'), 'utf8'));
    // The status read returns `requestStatus: 'pending'` for a private target;
    // the row must offer to withdraw it, and a followUser `{requested:true}`
    // result must not be rendered as a completed follow.
    expect(drawer).toMatch(/requestStatus === 'pending'/);
    expect(drawer).toMatch(/cancelFollowRequest/);
    expect(drawer).toMatch(/res\?\.requested/);
    expect(drawer).toMatch(/Cancel request/);
  });

  test('firestoreService.getPostViewerState reads the viewer\'s own docs', () => {
    const svc = fs.readFileSync(path.join(root, 'src', 'services', 'firestoreService.js'), 'utf8');
    expect(svc).toMatch(/async getPostViewerState\(/);
    expect(svc).toMatch(/getPostViewerState: \(pid, uid\)/);
    expect(svc).toMatch(/'posts', postId, subcollection, userId/);
  });
});
