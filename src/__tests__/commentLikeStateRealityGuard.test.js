/**
 * A comment's viewer-like state lives in the comment document's `likesBy`
 * array (`commentService.likeComment` writes `arrayUnion(uid)` and a
 * `comments/{id}/likes/{uid}` doc), never on a per-viewer flag a card invents.
 *
 * `VideoComments` hardcoded `isLiked: false` in its `mapComment`, so a viewer
 * who had already liked a comment saw an unliked heart, and tapping it called
 * `likeComment` again — which throws "You have already liked this comment" and
 * left the optimistic toggle reverted, i.e. the like silently no-op'd. This
 * guard fails if a comment surface reverts to the hardcoded flag.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

describe('comment like state is read from the comment doc, never hardcoded', () => {
  test('VideoComments seeds isLiked from the comment likesBy array', () => {
    const src = read('src/components/Videos/VideoComments.jsx');
    expect(src).toMatch(/isLiked:\s*Array\.isArray\(c\.likesBy\)/);
    // The loaded-comment mapping must not hardcode the viewer as un-liked
    // (the optimistic local comment may still start false before the server
    // confirms; the mapComment path is the one that must read likesBy).
    const mapBlock = src.slice(src.indexOf('const mapComment'), src.indexOf('setComments((res.comments'));
    expect(mapBlock).not.toMatch(/isLiked:\s*false/);
  });

  test('commentService.likeComment persists likesBy + the per-user like doc', () => {
    const svc = read('src/services/commentService.js');
    expect(svc).toMatch(/likesBy:\s*this\.firestoreMethods\.arrayUnion\(userId\)/);
    expect(svc).toMatch(/'comments', commentId, 'likes', userId/);
  });

  test('CommentsDrawer reads the viewer like state from likesBy, not a post field', () => {
    const src = read('src/screens/CommentsDrawer.jsx');
    expect(src).toMatch(/likesBy/);
  });
});
