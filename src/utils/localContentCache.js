/**
 * Device-local content caches.
 *
 * `CreatePost` publishes optimistically: it writes the new post to
 * `localStorage['arvdoul_local_posts']` and dispatches
 * `arvdoul:new_post_published` before the Firestore write completes, and
 * `HomeScreen`/`feedService`/`profileStore` merge that list back into the feed
 * on load. CommentsDrawer does the same with `arvdoul_local_comments_<postId>`.
 *
 * These keys are NOT uid-scoped, so without an explicit purge on sign-out or
 * account switch the next account on a shared device sees the previous
 * account's posts. `purgeDeviceLocalContent` is the single place that removes
 * them; call it from the auth session reset (see `AuthContext.clearSessionStores`).
 */

export const LOCAL_POSTS_KEY = 'arvdoul_local_posts';
export const LOCAL_COMMENTS_PREFIX = 'arvdoul_local_comments_';
export const LOCAL_LIKES_KEY = 'arvdoul_user_likes';

/**
 * Reads the device-local like set for one account.
 *
 * The registry is keyed by uid (`{ [uid]: { [postId]: true } }`) so a like on a
 * shared device never bleeds into the next signed-in account. The legacy flat
 * shape (`{ [postId]: true }`) is still tolerated and folded under `userId` so
 * pre-existing devices keep their likes.
 */
export function readLocalLikes(userId) {
  if (typeof window === 'undefined' || !window.localStorage || !userId) return {};
  try {
    const parsed = JSON.parse(window.localStorage.getItem(LOCAL_LIKES_KEY) || '{}');
    if (!parsed || typeof parsed !== 'object') return {};
    const scoped = parsed[userId];
    if (scoped && typeof scoped === 'object') return scoped;
    // Legacy flat map: adopt it for this user on first read.
    const isLegacyFlat = Object.values(parsed).every((v) => v === true);
    return isLegacyFlat ? parsed : {};
  } catch {
    return {};
  }
}

/** Persists one account's like set, leaving other accounts' sets intact. */
export function writeLocalLikes(userId, likes) {
  if (typeof window === 'undefined' || !window.localStorage || !userId) return;
  try {
    const parsed = JSON.parse(window.localStorage.getItem(LOCAL_LIKES_KEY) || '{}');
    const all = parsed && typeof parsed === 'object' ? parsed : {};
    all[userId] = likes || {};
    window.localStorage.setItem(LOCAL_LIKES_KEY, JSON.stringify(all));
  } catch { /* device-local cache is best-effort */ }
}

/** Toggles a single post's like for one account. */
export function setLocalLike(userId, postId, liked) {
  if (!userId || !postId) return;
  const likes = { ...readLocalLikes(userId) };
  if (liked) likes[postId] = true;
  else delete likes[postId];
  writeLocalLikes(userId, likes);
}

/**
 * Removes every device-local content cache. Safe to call when storage is
 * unavailable (SSR / privacy mode) — it is a no-op there.
 */
export function purgeDeviceLocalContent() {
  if (typeof window === 'undefined' || !window.localStorage) return;
  const storage = window.localStorage;
  storage.removeItem(LOCAL_POSTS_KEY);
  storage.removeItem(LOCAL_LIKES_KEY);
  const commentKeys = [];
  for (let i = 0; i < storage.length; i += 1) {
    const key = storage.key(i);
    if (key && key.startsWith(LOCAL_COMMENTS_PREFIX)) commentKeys.push(key);
  }
  for (const key of commentKeys) storage.removeItem(key);
}

export default { purgeDeviceLocalContent, LOCAL_POSTS_KEY, LOCAL_COMMENTS_PREFIX, LOCAL_LIKES_KEY, readLocalLikes, writeLocalLikes, setLocalLike };
