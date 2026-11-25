/**
 * Scheduled posts must actually publish (N377), and the composer must not
 * offer scheduling controls that no backend honours.
 *
 * `firestoreService.createPost` has always written `status: 'scheduled'` +
 * `scheduledTime` for a future post, but nothing ever flipped that status — so a
 * "scheduled" post stayed invisible forever. `functions/scheduledPosts.js`
 * (`publishScheduledPosts`) is now the single writer that publishes a due post,
 * backed by the `(status, scheduledTime)` composite index.
 *
 * The composer also offered a "Recurrence" control (daily/weekly/monthly) that
 * persisted a `recurrence` field no writer, reader or rule consumed, and a
 * "Co‑Authors" panel plus comment/gift toggles whose values were never read.
 * Those are removed; this guard keeps them from growing back without a real
 * model.
 *
 * @jest-environment node
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

const indexSrc = read('functions/index.js');
const publisherSrc = read('functions/scheduledPosts.js');
const createPost = [
  read('src/screens/CreatePost.jsx'),
  read('src/screens/CreatePost/postPublishPipeline.js'),
  read('src/screens/CreatePost/createPostReducer.js'),
].join('\n');
const firestoreService = read('src/services/firestoreService.js');
const indexes = JSON.parse(read('firestore.indexes.json'));

describe('scheduled posts actually publish', () => {
  test('a scheduled-post publisher module exists and is merged into index.js', () => {
    expect(indexSrc).toMatch(/merge\(require\('\.\/scheduledPosts\.js'\)\)/);
    expect(publisherSrc).toMatch(/exports\.publishScheduledPosts\s*=\s*functions\.pubsub/);
  });

  test('the publisher flips a due scheduled post to published', () => {
    expect(publisherSrc).toMatch(/\.where\('status',\s*'==',\s*'scheduled'\)/);
    expect(publisherSrc).toMatch(/\.where\('scheduledTime',\s*'<=',\s*now\)/);
    expect(publisherSrc).toMatch(/status:\s*'published'/);
    // Bounded scan.
    expect(publisherSrc).toMatch(/\.limit\(/);
  });

  test('the composer writes a real scheduled status via the create path', () => {
    expect(firestoreService).toMatch(/isScheduled\s*\?\s*'scheduled'/);
    expect(firestoreService).toMatch(/scheduledTime:/);
  });

  test('the (status, scheduledTime) composite index exists', () => {
    const found = indexes.indexes.some(
      (i) => i.collectionGroup === 'posts' &&
        i.fields.some((f) => f.fieldPath === 'status') &&
        i.fields.some((f) => f.fieldPath === 'scheduledTime')
    );
    expect(found).toBe(true);
  });

  test('a scheduled post is not injected into the live feed optimistically', () => {
    // The composer must gate the device-local "just published" cache and the
    // published event on `!isScheduled`.
    expect(createPost).toMatch(/const isScheduled = Boolean\(/);
    expect(createPost).toMatch(/if \(!isScheduled[\s\S]*?\)\s*\{/);
  });
});

describe('composer has no dead scheduling/collaboration controls', () => {
  test('no fabricated recurrence model in the composer', () => {
    expect(createPost).not.toMatch(/SET_RECURRENCE/);
    expect(createPost).not.toMatch(/state\.recurrence/);
    expect(createPost).not.toMatch(/\brecurrence:\s*current\.recurrence/);
  });

  test('no dead co-author panel', () => {
    expect(createPost).not.toContain('CoAuthorPanel');
    expect(createPost).not.toMatch(/state\.coAuthors/);
    expect(createPost).not.toMatch(/collaborationInvites/);
  });

  test('no dead composer settings toggles', () => {
    expect(createPost).not.toMatch(/state\.settings/);
    expect(createPost).not.toContain('UPDATE_SETTINGS');
  });

  test('no dead tagging/topic/feeling/expiry controls', () => {
    // TaggingPanel (brands/products have no data source), topics, feeling,
    // activity, customList and the expiresAt selector were collected but never
    // persisted by createPost or read anywhere.
    for (const token of [
      'TaggingPanel',
      'state.taggedBrands',
      'state.taggedProducts',
      'state.topics',
      'state.feeling',
      'state.activity',
      'state.customList',
      'state.expiresAt',
    ]) {
      expect(createPost).not.toContain(token);
    }
  });

  test('every composer reducer case is dispatched from somewhere', () => {
    // A `case "X":` with no `dispatch({ type: "X" })` anywhere in the composer
    // tree is an unreachable reducer branch — the same dead-control class as the
    // removed panels (SET_AUDIO_FILE / SET_VIDEO_FILE / SET_IS_DRAFT_LOADED were
    // exactly this; CLEAR_ERROR was wired up instead of deleted).
    const dir = path.join(root, 'src/screens');
    const files = fs.readdirSync(dir).filter((f) => f.startsWith('CreatePost') && /\.(jsx|js)$/.test(f));
    const subDir = path.join(dir, 'CreatePost');
    const all = [...files.map((f) => path.join(dir, f))];
    const collectRecursive = (folder) => {
      if (!fs.existsSync(folder)) return;
      for (const entry of fs.readdirSync(folder, { withFileTypes: true })) {
        const full = path.join(folder, entry.name);
        if (entry.isDirectory()) collectRecursive(full);
        else if (/\.(jsx|js)$/.test(entry.name)) all.push(full);
      }
    };
    collectRecursive(subDir);
    const source = all.map((f) => fs.readFileSync(f, 'utf8')).join('\n');
    const cases = new Set([...source.matchAll(/case\s+['"]([A-Z0-9_]+)['"]/g)].map((m) => m[1]));
    const dispatched = new Set([
      ...[...source.matchAll(/type:\s*['"]([A-Z0-9_]+)['"]/g)].map((m) => m[1]),
      ...[...source.matchAll(/type:\s*`([A-Z0-9_]+)\$\{/g)].map((m) => m[1]),
    ]);
    const unreachable = [...cases].filter((c) => !dispatched.has(c));
    expect(unreachable).toEqual([]);
  });
});
