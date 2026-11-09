/**
 * src/__tests__/reportRoutingParity.test.js
 *
 * AGENTS.md: "Never add a second report collection without adding it to both
 * `functions/moderation.js` REPORT_TARGETS and `functions/admin.js`
 * REPORT_COLLECTIONS". Nothing enforced that. A report type that is writable
 * but missing from the admin routing table is a report no moderator can ever
 * see (the queue reads REPORT_COLLECTIONS), and one missing from the rules is
 * denied to its own reporter on read-back. This guard makes the three lists
 * (write routing, admin queue, firestore.rules) prove they agree.
 *
 * @jest-environment node
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

/** Pull the collection names out of a `key: 'collection'` style map literal. */
function collectionsFrom(block) {
  const names = new Set();
  for (const m of block.matchAll(/:\s*'([a-z_]+_reports)'/g)) names.add(m[1]);
  return names;
}

function mapBlock(src, marker) {
  const start = src.indexOf(marker);
  expect(start).toBeGreaterThan(-1);
  const open = src.indexOf('{', start);
  let depth = 0;
  for (let i = open; i < src.length; i += 1) {
    if (src[i] === '{') depth += 1;
    else if (src[i] === '}') {
      depth -= 1;
      if (depth === 0) return src.slice(open, i + 1);
    }
  }
  throw new Error(`unbalanced map for ${marker}`);
}

/** A `match /path/{id} { ... }` block in firestore.rules, brace-balanced. */
function rulesBlock(rules, path) {
  const decl = `match /${path}/{reportId}`;
  const start = rules.indexOf(decl);
  expect(start).toBeGreaterThan(-1);
  const open = rules.indexOf('{', start + decl.length);
  let depth = 0;
  for (let i = open; i < rules.length; i += 1) {
    if (rules[i] === '{') depth += 1;
    else if (rules[i] === '}') {
      depth -= 1;
      if (depth === 0) return rules.slice(open, i + 1);
    }
  }
  throw new Error(`unbalanced rules block for ${path}`);
}

// Report collections written by a dedicated callable rather than the unified
// reportContent path (`reportAd` in functions/monetization.js). They are still
// real report queues the admin console must read, so they appear in
// REPORT_COLLECTIONS but have no REPORT_TARGETS entry.
const SEPARATE_REPORT_CALLABLES = {
  ad_reports: { module: 'functions/monetization.js', exportName: 'exports.reportAd' },
};

describe('report routing parity', () => {
  const moderation = read('functions/moderation.js');
  const admin = read('functions/admin.js');
  const rules = read('firestore.rules');

  const targets = collectionsFrom(mapBlock(moderation, 'const REPORT_TARGETS'));
  const adminCollections = collectionsFrom(mapBlock(admin, 'const REPORT_COLLECTIONS'));

  test('the admin queue covers every unified-report write target', () => {
    const missing = [...targets].filter((c) => !adminCollections.has(c));
    expect(missing).toEqual([]);
  });

  test('no report collection is admin-only dead config', () => {
    // Every collection the queue reads must be either a real report target or
    // an explicitly documented separate-callable queue.
    const orphan = [...adminCollections].filter(
      (c) => !targets.has(c) && !(c in SEPARATE_REPORT_CALLABLES),
    );
    expect(orphan).toEqual([]);
  });

  test('each separate-callable report queue still has its writer', () => {
    for (const [collection, { module, exportName }] of Object.entries(SEPARATE_REPORT_CALLABLES)) {
      const src = read(module);
      expect(src).toContain(exportName);
      expect(src).toContain(`collection('${collection}')`);
    }
  });

  test('every report collection has an explicit firestore.rules match block', () => {
    for (const collection of new Set([...targets, ...adminCollections])) {
      expect(rules).toContain(`match /${collection}/{reportId}`);
    }
  });

  test('reports are writable by the reporter and resolvable only by an admin', () => {
    for (const collection of new Set([...targets, ...adminCollections])) {
      const block = rulesBlock(rules, collection);
      expect(block).toMatch(/allow create: if isSignedIn\(\) && request\.resource\.data\.reporterId == uid\(\)/);
      expect(block).toMatch(/allow (update|update, delete): if isAdmin\(\)/);
    }
  });
});
