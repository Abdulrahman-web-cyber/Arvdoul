/**
 * @jest-environment node
 *
 * N442 — story feed ranking read fields no writer populates.
 *
 * `personalizeFeed` (`functions/stories.js`) scored stories with
 * `stats.likes`/`stats.shares`, but no writer ever sets those: reactions live in
 * the per-emoji `stats.reactions` map (written by `aggregateStoryStats` from the
 * `reaction_shards`) and there is no share counter at all. Those two terms were a
 * constant 0, so ranking ignored reactions entirely.
 *
 * The guard pins the ranking expression to the fields the aggregator actually
 * writes (`stats.reactions`, `stats.comments`, `stats.replies`, `stats.shares`,
 * `stats.views`) and forbids the dead `stats.likes` read.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const storiesSrc = fs.readFileSync(path.join(root, 'functions/stories.js'), 'utf8');

const personalizeBlock = storiesSrc.slice(
  storiesSrc.indexOf('exports.personalizeFeed'),
  storiesSrc.indexOf('exports.onStoryReactionCreate'),
);

describe('story feed ranking reads real stat fields (N442)', () => {
  test('the aggregator writes the fields ranking reads', () => {
    for (const field of ['stats.reactions', 'stats.comments', 'stats.replies', 'stats.views']) {
      expect(storiesSrc).toContain(`'${field}'`);
    }
  });

  test('ranking sums the reactions map, not a never-written per-reaction likes', () => {
    expect(personalizeBlock).toMatch(/stats\.reactions/);
    // The dead read is the *display* field name; the reaction keys are dynamic.
    expect(personalizeBlock).not.toMatch(/stats\.likes/);
  });
});
