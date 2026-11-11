/**
 * Cloud Functions inventory guard (contract ratchet).
 *
 * The client talks to the backend through exactly one surface:
 * `src/services/callableService.js` (`FUNCTIONS` map + `callFunction`). This
 * guard freezes three drift risks measured by
 * `scripts/functionsInventoryAnalyzer.cjs`:
 *
 *   - a dead `FUNCTIONS` key (a contract entry nothing reads) must not exist;
 *   - a new ad-hoc `httpsCallable(..., 'name')` literal that bypasses the map
 *     must not appear;
 *   - the set of server `onCall` exports no client references may only shrink
 *     (frozen in `scripts/functionsInventoryBaseline.json`).
 *
 * The baseline may only shrink — reconnect the callable or delete the dead
 * export and lower the list in the same change. Do not raise it.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import inventoryAnalyzer from '../../scripts/functionsInventoryAnalyzer.cjs';

const { analyze } = inventoryAnalyzer;
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const baseline = JSON.parse(
  fs.readFileSync(path.join(root, 'scripts', 'functionsInventoryBaseline.json'), 'utf8'),
);
const current = analyze(root);

describe('Cloud Functions inventory guard', () => {
  test('the client FUNCTIONS map has no dead key', () => {
    // A key nobody reads is a false contract claim; wire it or drop it.
    expect(current.deadFunctionKeys).toEqual([]);
  });

  test('no callable bypasses the FUNCTIONS map via an ad-hoc literal', () => {
    // AGENTS.md: callables go through callableService.js, never an inline
    // httpsCallable(getFunctions(), 'name').
    expect(current.adhocCallableLiterals).toEqual([]);
  });

  test('no NEW unreferenced callable (baseline may only shrink)', () => {
    const allowed = new Set(baseline.unreferencedCallables);
    const offenders = current.unreferencedCallables.filter((n) => !allowed.has(n));
    expect(offenders).toEqual([]);
  });

  test('the baseline does not over-claim (shrink it when a callable is wired/removed)', () => {
    // If a baseline entry is no longer unreferenced, the list is stale — the
    // baseline must be lowered in the same change that wired/removed it.
    const currentSet = new Set(current.unreferencedCallables);
    const stale = baseline.unreferencedCallables.filter((n) => !currentSet.has(n));
    expect(stale).toEqual([]);
  });
});
