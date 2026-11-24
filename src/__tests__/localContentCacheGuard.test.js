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
      'src/screens/CreatePost/postPublishPipeline.js',
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

describe('a failed publish is queued cleanly and never leaves an unconfirmed ghost', () => {
  const src = read('src/screens/CreatePost/postPublishPipeline.js');

  test('no local cache entry is written when createPost returns no id', () => {
    const throwIdx = src.indexOf('if (!result?.postId)');
    const cacheIdx = src.indexOf('localStorage.setItem(LOCAL_POSTS_KEY');
    expect(throwIdx).toBeGreaterThan(-1);
    expect(cacheIdx).toBeGreaterThan(throwIdx);
    expect(src).toMatch(/if \(!result\?\.postId\)[\s\S]*?throw new Error/);
  });

  test('offline or transient network failure enqueues via onEnqueueOffline without caching unconfirmed posts', () => {
    expect(src).toMatch(/await onEnqueueOffline\?\.\(\{\s*\.\.\.current,\s*clientPostId\s*\}\)/);
    expect(src).toMatch(/isNetworkIssue && onEnqueueOffline[\s\S]*?await onEnqueueOffline\(\{\s*\.\.\.current,\s*clientPostId\s*\}\)/);
  });
});
