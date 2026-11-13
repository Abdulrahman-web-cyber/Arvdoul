/**
 * Post-prediction must not fabricate a coin/earnings figure.
 *
 * `functions/moderation.js` `predictPostPerformance` used to return
 * `Math.round(reach * 0.004 * (engagement / 4))` as `earnings`, and
 * `CreatePost` rendered it as "{n} coins". The `0.004` coefficient is not part
 * of the economy model (coins per USD is 200; there is no per-reach earning
 * rate), so it was an invented money number shown to the author as real.
 * The heuristic reach/engagement/viral score stays; the coin figure does not.
 *
 * @jest-environment node
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

describe('post performance prediction — no fabricated earnings', () => {
  test('the server does not emit an invented earnings figure', () => {
    const src = read('functions/moderation.js');
    const start = src.indexOf('exports.predictPostPerformance');
    const body = src.slice(start, start + 4000);
    expect(body).not.toMatch(/0\.004/);
    expect(body).not.toMatch(/earnings\s*[,:]/);
  });

  test('the composer does not render an earnings insight', () => {
    const src = read('src/screens/CreatePost.jsx');
    expect(src).not.toContain('state.insights.earnings');
    // The real, factor-explained signals remain.
    expect(src).toContain('state.insights.reach');
    expect(src).toContain('state.insights.viralScore');
  });
});
