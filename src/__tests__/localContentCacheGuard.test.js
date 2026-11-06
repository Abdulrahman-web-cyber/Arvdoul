/**
 * Device-local content cache guard.
 *
 * `CreatePost` publishes optimistically by writing the post to
 * `localStorage['arvdoul_local_posts']` and dispatching
 * `arvdoul:new_post_published`; `HomeScreen`, `feedService` and `profileStore`
 * merge that list back into the feed on load. CommentsDrawer does the same with
 * `arvdoul_local_comments_<postId>`.
 *
 * Those keys are not uid-scoped, so unless they are purged on sign-out and
 * account switch the next account on a shared device inherits the previous
 * account's posts. This guard pins the single purge point and keeps the key
 * registry in sync with every reader/writer.
 *
 * @jest-environment node
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

describe('device-local content cache is registered and purged', () => {
  test('the registry owns the post, comment and like keys every surface uses', () => {
    const registry = read('src/utils/localContentCache.js');
    expect(registry).toMatch(/LOCAL_POSTS_KEY = 'arvdoul_local_posts'/);
    expect(registry).toMatch(/LOCAL_COMMENTS_PREFIX = 'arvdoul_local_comments_'/);
    expect(registry).toMatch(/LOCAL_LIKES_KEY = 'arvdoul_user_likes'/);

    // Every reader/writer must reference the registry keys, not a fresh literal
    // that could drift from the purge list.
    const consumers = [
      'src/screens/CreatePost.jsx',
      'src/services/feedService.js',
      'src/store/profileStore.js',
      'src/screens/HomeScreen.jsx',
      'src/services/commentService.js',
      'src/services/firestoreService.js',
      'src/screens/PostCard.jsx',
    ];
    for (const rel of consumers) {
      const src = read(rel);
      expect(src).toMatch(/localContentCache\.js/);
    }
  });

  test('the device-local like cache is registered and purged, never a bare literal', () => {
    const registry = read('src/utils/localContentCache.js');
    expect(registry).toMatch(/removeItem\(LOCAL_LIKES_KEY\)/);
    for (const rel of ['src/services/firestoreService.js', 'src/screens/PostCard.jsx']) {
      expect(read(rel)).not.toMatch(/'arvdoul_user_likes'/);
    }
  });

  test('commentService reads the prefixed key through the registry', () => {
    const src = read('src/services/commentService.js');
    expect(src).toMatch(/LOCAL_COMMENTS_PREFIX/);
    expect(src).not.toMatch(/`arvdoul_local_comments_\$\{postId\}`/);
  });

  test('the auth session reset purges the device-local content', () => {
    const src = read('src/context/AuthContext.jsx');
    expect(src).toMatch(/import \{ purgeDeviceLocalContent \}/);
    // Sign-out / token-expiry path goes through clearSessionStores.
    expect(src).toMatch(/clearSessionStores[\s\S]*purgeDeviceLocalContent\(\)/);
    // Account-switch path purges before hydrating the new account.
    expect(src).toMatch(/purgeDeviceLocalContent\(\)[\s\S]*purgeQueueForOwner/);
  });
});

describe('a failed background publish is queued, not left as a ghost', () => {
  const src = read('src/screens/CreatePost.jsx');

  test('the optimistic entry is dropped when createPost returns no id', () => {
    // A resolved-but-unpersisted write used to leave the optimistic (blob-URL)
    // entry in localStorage forever, so the post showed broken and duplicated.
    expect(src).toMatch(/if \(!result\?\.postId\)[\s\S]*?throw new Error/);
  });

  test('the background failure path enqueues into the real offline queue', () => {
    expect(src).toMatch(/catch \(bgErr\)[\s\S]*addToOfflineQueue\(current\)/);
    // and removes the optimistic entry it can no longer honour
    expect(src).toMatch(/catch \(bgErr\)[\s\S]*filter\(p => p\.id !== instantPostId\)/);
  });
});
