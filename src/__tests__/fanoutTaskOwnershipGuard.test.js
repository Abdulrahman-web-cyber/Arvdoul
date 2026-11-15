/**
 * Guard: the `fanout_tasks/{taskId}` collection has TWO `onCreate` triggers —
 * `feed.js#fanoutPostOnCreate` (post fan-out, carries `postId`) and
 * `stories.js#processFanoutTask` (story fan-out, carries `storyId`). Both fire
 * for every created document, and each claims the task by flipping its status to
 * `processing`; the loser then finds a non-`pending` doc and (before N495) marked
 * it `failed` with "Missing required fields", cancelling the winner's fan-out.
 *
 * Each trigger (and each retrier) must therefore claim only the task type it
 * owns, so the two producers cannot cancel each other.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

function exportBody(src, name) {
  const start = src.indexOf(`exports.${name} `);
  expect(start).toBeGreaterThan(-1);
  const braceStart = src.indexOf('{', src.indexOf('=>', start));
  expect(braceStart).toBeGreaterThan(-1);
  let depth = 0;
  let i = braceStart;
  for (; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') {
      depth--;
      if (depth === 0) break;
    }
  }
  return src.slice(braceStart, i + 1);
}

describe('fanout_tasks trigger ownership', () => {
  test('both onCreate triggers exist and each guards on its own task type', () => {
    const feedTrigger = exportBody(read('functions/feed.js'), 'fanoutPostOnCreate');
    const storyTrigger = exportBody(read('functions/stories.js'), 'processFanoutTask');

    // feed owns post tasks; stories owns story tasks.
    expect(feedTrigger).toMatch(/taskData\.postId/);
    expect(storyTrigger).toMatch(/taskData\.storyId/);
  });

  test('each retrier skips tasks it does not own', () => {
    const feedRetrier = exportBody(read('functions/feed.js'), 'cleanupAndRetryFanoutTasks');
    const storyRetrier = exportBody(read('functions/stories.js'), 'retryFailedFanoutTasks');

    // feed's retrier already bails when postId/authorId/snapshot are missing.
    expect(feedRetrier).toMatch(/postId/);
    // stories' retrier must not touch post tasks.
    expect(storyRetrier).toMatch(/data\.storyId/);
  });
});
