/**
 * Viewer like/save state must be read from the viewer's own documents, never
 * from a per-viewer flag on the shared post/video document.
 *
 * A `posts/{id}` or `videos/{id}` document carries only aggregate counters; no
 * writer ever sets `isLiked`/`likedByMe`/`hasLiked`/`isSaved`/`savedBy` on it.
 * Every surface that seeded its heart/bookmark from those fields therefore read
 * the negative for a viewer who had already liked/saved the item:
 *
 * - `ProfileFeedGrid` seeded `likedPosts`/`likeBaseline` from `post.isLiked` and
 *   double-counted the viewer's own like on a re-like.
 * - `videoService`/`ReelsScreen` seeded `isLiked`/`isSaved` from `video.isLiked`
 *   and rendered an unliked heart for a video the viewer had liked (the next tap
 *   then toggled it back off server-side).
 *
 * The real state lives in `posts/{id}/likes|saves|reactions/{uid}`,
 * `users/{uid}/liked_posts|saved_videos`, and `videos/{id}/likes/{uid}`. This
 * guard pins those reads and fails if a surface reverts to the dead fields.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

describe('viewer like/save state is hydrated from the viewer\'s own docs', () => {
  test('ProfileFeedGrid resolves the like set via getLikedPostIds, not post flags', () => {
    const grid = read('src/components/profile/ProfileFeedGrid.jsx');
    expect(grid).not.toMatch(/post\.isLiked|\.likedByMe|\.hasLiked/);
    expect(grid).toMatch(/getLikedPostIds/);
  });

  test('firestoreService.getLikedPostIds reads users/{uid}/liked_posts by id', () => {
    const svc = read('src/services/firestoreService.js');
    expect(svc).toMatch(/async getLikedPostIds\(/);
    expect(svc).toMatch(/'users', userId, 'liked_posts'/);
    expect(svc).toMatch(/getLikedPostIds: \(uid, ids\)/);
  });

  test('videoService hydrates viewer state instead of reading video.isLiked', () => {
    const svc = read('src/services/videoService.js');
    expect(svc).not.toMatch(/isLiked:\s*item\.isLiked/);
    expect(svc).not.toMatch(/isSaved:\s*item\.isSaved/);
    expect(svc).toMatch(/_hydrateViewerVideoState/);
    expect(svc).toMatch(/'videos', videoId, 'likes', userId/);
    expect(svc).toMatch(/'users', userId, 'saved_videos'/);
  });

  test('PostCard/PostOptionsDrawer read the viewer\'s own post subcollection docs', () => {
    const svc = read('src/services/firestoreService.js');
    expect(svc).toMatch(/'posts', postId, subcollection, userId/);
    expect(read('src/screens/PostCard.jsx')).toMatch(/getPostViewerState/);
    expect(read('src/screens/PostOptionsDrawer.jsx')).toMatch(/getPostViewerState/);
  });
});
