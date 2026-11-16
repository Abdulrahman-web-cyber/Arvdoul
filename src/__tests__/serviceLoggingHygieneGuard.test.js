/**
 * Service logging hygiene (N502).
 *
 * The service layer logs through `src/utils/Logger.js` (levels, redaction,
 * environment gating). A raw `console.*` call bypasses that policy and can leak
 * a payload the Logger would redact, so no `src/services/**` module may use one.
 * Screens/components are exempt (they are not the service layer and some log
 * purely for local development).
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const servicesDir = path.join(root, 'src/services');

function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (/\.(js|jsx)$/.test(entry.name)) out.push(full);
  }
  return out;
}

describe('N502 — services log through utils/Logger, never raw console', () => {
  test('no src/services module calls console.*', () => {
    const offenders = [];
    for (const file of walk(servicesDir)) {
      const src = fs.readFileSync(file, 'utf8');
      const matches = src.match(/\bconsole\.(log|error|warn|debug|info)\s*\(/g);
      if (matches) {
        offenders.push(`${path.relative(root, file)}: ${matches.join(', ')}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});
