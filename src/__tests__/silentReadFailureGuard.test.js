/**
 * Silent read-failure guard.
 *
 * The recurring "silent failure" bug class at the UI layer: a data read fails,
 * the catch handler does nothing but reset the local list to `[]` (and maybe
 * log), and the screen then renders its *empty* state — "No conversations yet",
 * "No Sparks Yet", "No transactions yet". The user is told the platform has no
 * data when in fact the fetch failed, and there is no retry.
 *
 * `errorStateRenderedGuard` already proves that a stored error is *read*; this
 * guard proves that a swallowed read failure is at least *observable*: a catch
 * that empties a list must do one of
 *   - surface a failure state (`setXError` / `setXFailed` / `setXDenied`),
 *   - notify the user (`toast`),
 *   - rethrow, or
 *   - log (console / Logger / crash reporting).
 *
 * A best-effort read may legitimately fall back to empty, but the failure must
 * leave a trace. Screens that render an empty state on a *failed* read and keep
 * no trace are the defect this guard pins.
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
    else if (/\.(jsx|js)$/.test(entry.name)) out.push(full);
  }
  return out;
}

// A catch body that empties a list — `setFoo([])`.
const EMPTIES_LIST = /\bset[A-Za-z_$][\w$]*\s*\(\s*\[\s*\]\s*\)/;

// Any observable outcome. Kept broad so a legitimate best-effort catch that
// logs is never flagged.
const OBSERVABLE =
  /console\.|\bLogger\b|logger\.|toast|set[A-Za-z_$]*([Ee]rror|[Ff]ail|[Dd]enied)|throw\b|reportError|captureException|metricsService/;

// Extract every `catch (x) { ... }` body with its starting line.
function catchBodies(source) {
  const out = [];
  const re = /\bcatch\s*(?:\([^)]*\))?\s*\{/g;
  let m;
  while ((m = re.exec(source))) {
    const start = m.index + m[0].length;
    let depth = 1;
    let i = start;
    while (i < source.length && depth > 0) {
      if (source[i] === '{') depth += 1;
      else if (source[i] === '}') depth -= 1;
      i += 1;
    }
    out.push({ line: source.slice(0, m.index).split('\n').length, body: source.slice(start, i - 1) });
  }
  return out;
}

describe('silent read-failure guard: emptying a list on error must be observable', () => {
  test('no screen/component empties a list on a failed read with no trace', () => {
    const violations = [];
    for (const dir of ['screens', 'components']) {
      const abs = path.join(SRC, dir);
      if (!fs.existsSync(abs)) continue;
      for (const file of collect(abs)) {
        const source = fs.readFileSync(file, 'utf8');
        for (const { line, body } of catchBodies(source)) {
          if (!EMPTIES_LIST.test(body)) continue;
          if (OBSERVABLE.test(body)) continue;
          violations.push(
            `${path.relative(root, file)}:${line}: a failed read resets a list to [] with no log/error/toast — the empty state will lie`
          );
        }
      }
    }
    expect(violations).toEqual([]);
  });

  test('the previously-silent read sites now surface their failure', () => {
    // Regression pins for the exact screens this guard was introduced to fix.
    const pins = [
      ['src/screens/MessagingScreen.jsx', 'setConversationsError'],
      ['src/screens/StoriesScreen.jsx', 'setStoriesError'],
      ['src/screens/ReelsScreen.jsx', 'setFeedError'],
      ['src/screens/CoinsScreen.jsx', 'setTransactionsError'],
      ['src/screens/NewConversationScreen.jsx', 'setFriendsError'],
      ['src/screens/VideoAnalyticsScreen.jsx', 'setLoadError'],
      ['src/screens/Profile/HighlightsScreen.jsx', 'setLoadError'],
      ['src/screens/Help/HelpCenterScreen.jsx', 'setTicketsError'],
      ['src/screens/Admin/AdminEconomyScreen.jsx', 'setPayoutsError'],
    ];
    for (const [rel, marker] of pins) {
      const src = fs.readFileSync(path.join(root, rel), 'utf8');
      expect(src).toContain(marker);
    }
  });
});
