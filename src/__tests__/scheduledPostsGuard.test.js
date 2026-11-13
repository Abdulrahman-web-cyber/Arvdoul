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
const createPost = read('src/screens/CreatePost.jsx');
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
    expect(createPost).toMatch(/if \(!isScheduled\) \{/);
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
});
