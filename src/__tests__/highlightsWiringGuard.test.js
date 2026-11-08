/**
 * Dead highlights carousel guard.
 *
 * `NotificationsScreen` rendered a "Highlights" carousel from
 * `notifications.filter((n) => n.highlight)`, but nothing in the service layer
 * ever sets a `highlight` field on a notification — the array was always empty,
 * so the whole section (and its `/profile/highlights` link) was dead UI. The
 * real highlights live in the `highlights` collection and are owned by
 * `HighlightsScreen` via `storyService.getHighlights`.
 *
 * @jest-environment node
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

describe('notifications has no dead highlights carousel', () => {
  const screen = read('src/screens/NotificationsScreen.jsx');

  test('the screen never filters notifications on a phantom `highlight` field', () => {
    expect(screen).not.toMatch(/notifications\.filter\(\(n\) => n\.highlight\)/);
    expect(screen).not.toMatch(/\bn\.highlight\b/);
    expect(screen).not.toMatch(/\bh\.highlight\./);
  });

  test('the highlights section markup is gone', () => {
    expect(screen).not.toMatch(/Highlights Section/);
    expect(screen).not.toMatch(/h\.type === 'story_reply'/);
  });
});

describe('highlights remain wired to the real service and screen', () => {
  test('HighlightsScreen loads through storyService.getHighlights', () => {
    const src = read('src/screens/Profile/HighlightsScreen.jsx');
    expect(src).toMatch(/storyService\.getHighlights\(/);
  });

  test('the highlights collection has a dedicated service read', () => {
    const src = read('src/services/storyService.js');
    expect(src).toMatch(/async getHighlights\(/);
    expect(src).toMatch(/collection\(this\.firestore, 'highlights'\)/);
  });
});

describe('highlight deep links reach the viewer', () => {
  const stories = read('src/screens/StoriesScreen.jsx');

  test('StoriesScreen consumes the /highlight/:highlightId route param', () => {
    expect(stories).toMatch(/useParams\(\)/);
    expect(stories).toMatch(/routeHighlightId/);
    expect(stories).toMatch(/getHighlightStories\(/);
  });

  test('StoriesScreen also consumes the legacy ?highlight= query param', () => {
    expect(stories).toMatch(/searchParams\.get\('highlight'\)/);
  });

  test('the resolved highlight group is prepended into the viewer list', () => {
    expect(stories).toMatch(/highlightGroup \? \[highlightGroup, \.\.\.stories\] : stories/);
  });
});

describe('community compose route reaches the community callable', () => {
  const createPost = read('src/screens/CreatePost.jsx');
  const communityDetail = read('src/screens/Community/CommunityDetailScreen.jsx');

  test('CommunityDetailScreen links to /create-post with the community id', () => {
    expect(communityDetail).toMatch(/navigate\(`\/create-post\?community=\$\{communityId\}`\)/);
  });

  test('CreatePost reads the community query param', () => {
    expect(createPost).toMatch(/searchParams\.get\('community'\)/);
  });

  test('a community post publishes through createCommunityPost, not a bare addDoc', () => {
    expect(createPost).toMatch(/createCommunityPost\(communityId, userNow\.uid, finalPostData\)/);
  });

  test('the publish path returns to the community, not /home', () => {
    expect(createPost).toMatch(/navigate\(communityId \? `\/community\/\$\{communityId\}` : "\/home"\)/);
  });
});

describe('optimistic community posts stay out of the public feed', () => {
  test('HomeScreen filters visibility === community from the local cache', () => {
    expect(read('src/screens/HomeScreen.jsx')).toMatch(/p\.visibility !== 'community'/);
  });

  test('feedService filters visibility === community from the local cache', () => {
    expect(read('src/services/feedService.js')).toMatch(/lp\.visibility !== 'community'/);
  });
});
