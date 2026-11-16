/**
 * src/__tests__/vibesCreatorIdentityWiring.test.js
 *
 * The Vibes (stories) surfaces rendered fabricated creator identity (N455) and
 * dead category controls / badges (N456), plus a fabricated multi-item dot
 * count (N457):
 *   - Story docs carry no `authorName`/`authorPhoto` (the writer never sets
 *     them), so `storiesArr[0]?.authorName || g.userId` rendered the raw uid as
 *     the display name and the stock placeholder as the avatar, and
 *     `verified`/`category` were asserted for every creator. The screen now
 *     hydrates the real creator profiles via `socialGraphService.hydrateProfiles`.
 *   - The `close_friends` and `live` category tabs (and their LIVE / close-friend
 *     badges) had no backing model — `isCloseFriend`/`isLive` were hardcoded
 *     false — so the tabs matched nothing. They were removed from both the Vibes
 *     grid and the in-feed story strip.
 *   - The multi-story dots asserted `itemsCount || 3` (a fabricated 3 for a
 *     single-item group).
 *
 * @jest-environment node
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const screen = fs.readFileSync(path.join(root, 'src/screens/StoriesScreen.jsx'), 'utf8');
const inFeed = fs.readFileSync(path.join(root, 'src/components/feed/InFeedStoriesModule.jsx'), 'utf8');

describe('vibes grid creator identity is real', () => {
  test('the grid hydrates creator profiles instead of reading authorName', () => {
    expect(screen).toMatch(/hydrateProfiles\(creatorIds/);
    expect(screen).toMatch(/getEdgeSet\(/);
    expect(screen).toMatch(/resolveActorName\(\[profile\?\.displayName/);
  });

  test('the creator avatar goes through getSafeAvatarUrl (never a stock literal)', () => {
    expect(screen).toMatch(/getSafeAvatarUrl\(profile\?\.photoURL, name, g\.userId\)/);
  });

  test('the verified flag comes from the real profile, not a hardcoded false', () => {
    expect(screen).toMatch(/verified: Boolean\(profile\?\.isVerified\)/);
  });

  test('the category reflects the real relationship, not an asserted "Following"', () => {
    expect(screen).toMatch(/category: edge\?\.isMutualFriend \? 'Friends' : edge\?\.isFollowing \? 'Following' : 'Discover'/);
    expect(screen).not.toMatch(/category: 'Following',\n\s+isCloseFriend/);
  });
});

describe('vibes dead controls removed', () => {
  test('no close_friends / live category tabs', () => {
    expect(screen).not.toMatch(/id: 'close_friends'/);
    expect(screen).not.toMatch(/id: 'live'/);
  });

  test('no LIVE or close-friend badges', () => {
    expect(screen).not.toMatch(/user\.isCloseFriend/);
    expect(screen).not.toMatch(/user\.isLive/);
    expect(screen).not.toMatch(/<span>LIVE<\/span>/);
  });

  test('the media badge reflects the real story type (no live/star badgeType)', () => {
    expect(screen).toMatch(/badgeType === 'audio'/);
    expect(screen).not.toMatch(/badgeType === 'live'/);
    expect(screen).not.toMatch(/badgeType === 'star'/);
  });

  test('the progress dots only render for a genuine multi-item group', () => {
    expect(screen).toMatch(/story\.itemsCount > 1/);
    expect(screen).not.toMatch(/itemsCount \|\| 3/);
  });
});

describe('in-feed story strip drops the same dead controls', () => {
  test('no isLive field or LIVE badge', () => {
    expect(inFeed).not.toMatch(/isLive/);
    expect(inFeed).not.toMatch(/>\s*LIVE\s*</);
  });

  test('the strip hydrates creators in one batched read, not an N+1', () => {
    expect(inFeed).toMatch(/hydrateProfiles\(creatorIds/);
    expect(inFeed).not.toMatch(/getUserService\(\)\.getUserProfile/);
  });

  test('no dead username/preview/title props on the strip creator', () => {
    expect(inFeed).not.toMatch(/username: name\.toLowerCase/);
    expect(inFeed).not.toMatch(/preview: first\./);
    expect(inFeed).not.toMatch(/title: first\./);
  });
});
