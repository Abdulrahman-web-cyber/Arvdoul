/**
 * firestore.rules is the single source of truth for the security ruleset.
 *
 * `src/services/messagesService.js` used to carry a full, divergent copy of the
 * ruleset in a comment block ("deploy these in Firebase Console"). A second copy
 * cannot be deployed, is not exercised by any test, and contradicts the real
 * rules (its `match /polls/{pollId}/votes/{userId}` block was even syntactically
 * invalid). A future reader could "fix" the wrong file. This guard fails if any
 * source file reintroduces an embedded ruleset.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === '__tests__') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (/\.(js|jsx|cjs|mjs)$/.test(entry.name)) out.push(full);
  }
  return out;
}

describe('firestore.rules is the only ruleset in the repository', () => {
  test('no source file embeds a rules_version template', () => {
    const offenders = [];
    for (const dir of ['src', 'functions']) {
      for (const full of walk(path.join(root, dir))) {
        const src = fs.readFileSync(full, 'utf8');
        if (/rules_version\s*=\s*['"]2['"]/.test(src) || /service cloud\.firestore\s*\{/.test(src)) {
          offenders.push(path.relative(root, full));
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  test('the deployed ruleset exists and declares cloud.firestore', () => {
    const rules = fs.readFileSync(path.join(root, 'firestore.rules'), 'utf8');
    expect(rules).toContain("rules_version = '2'");
    expect(rules).toContain('service cloud.firestore');
  });
});
