/**
 * Guard: a persisted `__name__` sweep cursor must wrap when the sweep reaches
 * the end of the collection. A cursor that is only ever advanced pins to the
 * highest document id, and every document created afterwards — whose random
 * id sorts below the cursor — is skipped forever.
 *
 * `functions/video.js#processBatchWithCursor` (five aggregation jobs) and
 * `functions/stories.js#aggregateStoryStats` both advanced the cursor without
 * ever clearing it, so new videos/stories kept a stale `stats.*` /
 * `rankingScore` and `detectStuckVideos` never saw them.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

describe('sweep cursors wrap at end-of-collection', () => {
  test('video.js processBatchWithCursor clears the cursor when the sweep ends', () => {
    const src = read('functions/video.js');
    const fn = src.slice(src.indexOf('async function processBatchWithCursor'));
    expect(fn).toMatch(/lastId:\s*wrapped\s*\?\s*null\s*:\s*lastProcessedId/);
    expect(fn).toMatch(/const wrapped = snapshot\.size < limit/);
  });

  test('stories.js aggregateStoryStats clears the cursor when the sweep ends', () => {
    const src = read('functions/stories.js');
    const fn = src.slice(src.indexOf('exports.aggregateStoryStats'));
    expect(fn).toMatch(/lastStoryId:\s*wrapped\s*\?\s*null\s*:\s*lastStoryId/);
    expect(fn).toMatch(/if \(!hasMore\) wrapped = true/);
  });
});
