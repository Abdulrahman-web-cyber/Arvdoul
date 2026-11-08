/**
 * Error/denial state must be rendered (N128/N130).
 *
 * A screen that stores a failure in `error`/`loadError`/`denied` state and
 * never reads it silently degrades to its "empty" render. Two shipped cases:
 *
 *  - AdminDashboardScreen held "You do not have admin access." in `error` and
 *    rendered a full grid of zeros instead, which reads as real platform data.
 *  - PostAnalyticsScreen had no failure state at all, so a missing/inaccessible
 *    post rendered "0 views / 0 likes" as if it were measured.
 *
 * The check is deliberately narrow: for each `useState` whose name matches an
 * error-ish pattern, the value binding must be referenced somewhere other than
 * its own declaration. It does not require a particular markup, so it cannot
 * produce false positives on differently-styled error UIs.
 *
 * @jest-environment node
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const SRC = path.join(root, 'src');

function collect(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === '__tests__' || entry.name === 'node_modules') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) collect(full, out);
    else if (entry.name.endsWith('.jsx')) out.push(full);
  }
  return out;
}

const ERROR_STATE = /^(error|.*Error|.*Denied|denied)$/;

/**
 * Documented exemptions. Each entry names the exact binding and the reason it
 * is not surfaced yet. Keep this list empty unless the surface is frozen.
 */
const EXEMPT = new Set([
  // Auth/signup is frozen by product decision (do not touch). `recaptchaError`
  // records the last reCAPTCHA failure; the surrounding `errors.general` copy
  // already tells the user the security check failed, so this is a
  // non-user-facing detail. Remove when the signup flow is unfrozen.
  "src/screens/SignupStep2VerifyContact.jsx: 'recaptchaError'",
]);

describe('every error/denial state is rendered, not silently swallowed', () => {
  test('no screen stores a failure it never shows', () => {
    const offenders = [];
    for (const file of collect(SRC)) {
      const src = fs.readFileSync(file, 'utf8');
      const re = /const\s*\[\s*([A-Za-z_$][\w$]*)\s*,\s*(set[A-Za-z_$][\w$]*)\s*\]\s*=\s*useState/g;
      let m;
      while ((m = re.exec(src))) {
        const name = m[1];
        if (!ERROR_STATE.test(name)) continue;
        // Any reference to the binding after the declaration line means it is
        // at least read (rendered or branched on). A write-only state has none.
        const rest = src.slice(m.index + m[0].length);
        const used = new RegExp(`(?<![\\w$.])${name}(?![\\w$])`).test(rest);
        const key = `${path.relative(root, file)}: '${name}'`;
        if (!used && !EXEMPT.has(key)) offenders.push(key);
      }
    }
    expect(offenders).toEqual([]);
  });
});
