/**
 * Guard: a derived RATE must not be written as a hard `0` when its denominator
 * is zero — that renders as a measured "0%" instead of "unknown". The story
 * stats aggregator (`functions/stories.js#aggregateStoryStats`) wrote
 * `stats.completionRate = totalViews > 0 ? completions / totalViews : 0`, and
 * `storyService` surfaces the field through `unknownNumber`, so a story with no
 * views showed a real 0% completion rate.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const src = fs.readFileSync(path.join(root, 'functions/stories.js'), 'utf8');

describe('story completion-rate is unknown, not fabricated 0', () => {
  test('the aggregator writes null when there are no views', () => {
    expect(src).toMatch(/'stats\.completionRate':\s*totalViews > 0 \? completions \/ totalViews : null/);
    expect(src).not.toMatch(/'stats\.completionRate':\s*totalViews > 0 \? completions \/ totalViews : 0/);
  });
});
