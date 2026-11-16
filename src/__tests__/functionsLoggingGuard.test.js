/**
 * Cloud Functions log through the shared logger (N506).
 *
 * `console.*` in the Functions runtime emits an untyped `textPayload`, so the
 * severity lives only inside the message string and Cloud Logging cannot filter
 * or alert on it. Every module used to call `console.log/warn/error` directly,
 * or wrap it in a local `log()` helper that did
 * `console.log(JSON.stringify({ severity, ... }))` — the same untyped payload
 * with the severity buried in the text.
 *
 * All logging now goes through `functions/logger.js`, which calls
 * `functions.logger` (structured `jsonPayload` with a real `severity` field).
 * This guard fails if any Functions module reintroduces a raw `console.*` call.
 * `functions/logger.js` itself is the only module allowed to reference the
 * `functions.logger` transport.
 *
 * @jest-environment node
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const FUNCTIONS = path.join(root, 'functions');

function collect(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === '__tests__') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) collect(full, out);
    else if (entry.name.endsWith('.js')) out.push(full);
  }
  return out;
}

describe('N506 — Functions logging goes through the shared logger', () => {
  test('no Functions module calls console.* directly', () => {
    const offenders = [];
    for (const file of collect(FUNCTIONS)) {
      if (path.basename(file) === 'logger.js') continue;
      const src = fs.readFileSync(file, 'utf8');
      const matches = src.match(/\bconsole\.(log|warn|error|info|debug|trace)\s*\(/g);
      if (matches) offenders.push(`${path.relative(root, file)}: ${[...new Set(matches)].join(', ')}`);
    }
    expect(offenders).toEqual([]);
  });

  test('the shared logger maps severities onto functions.logger methods', () => {
    const s = fs.readFileSync(path.join(FUNCTIONS, 'logger.js'), 'utf8');
    expect(s).toContain("require('firebase-functions')");
    expect(s).toContain('logger[methodFor(severity)]');
    expect(s).toContain("case 'warn'");
    expect(s).toContain("case 'error'");
  });
});
