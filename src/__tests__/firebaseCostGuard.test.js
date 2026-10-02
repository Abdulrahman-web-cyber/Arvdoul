/**
 * Firebase cost guard (REPOSITORY_RECONSTRUCTION_V1 §83).
 *
 * Firestore billing is an architectural property, not a runtime surprise. This
 * guard freezes the current number of unbounded collection reads (`getDocs`
 * without a `limit`) and realtime listeners (`onSnapshot`) per file. A future
 * change that adds a new unbounded read, a new listener, or increases a
 * frozen count fails here instead of silently shipping a larger bill.
 *
 * The counts are measured by `scripts/firebaseCostAnalyzer.cjs`, which resolves
 * a query bound through a single local variable hop and ignores single-document
 * reads. The baseline is intentionally allowed to shrink — reduce it whenever a
 * query is bounded or a listener removed.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import costAnalyzer from '../../scripts/firebaseCostAnalyzer.cjs';

const { analyze } = costAnalyzer;
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const baseline = JSON.parse(
  fs.readFileSync(path.join(root, 'scripts', 'firebaseCostBaseline.json'), 'utf8'),
);

const current = analyze(root);

const compare = (kind, currentMap, baselineMap) => {
  const offenders = [];
  for (const [file, count] of Object.entries(currentMap)) {
    const allowed = baselineMap[file] ?? 0;
    if (count > allowed) offenders.push(`${file}: ${count} ${kind} (baseline ${allowed})`);
  }
  return offenders;
};

describe('Firebase cost guard (§83)', () => {
  test('no new unbounded Firestore collection reads', () => {
    const offenders = compare('unbounded reads', current.unboundedReads, baseline.unboundedReads);
    expect(offenders).toEqual([]);
  });

  test('no new realtime listeners', () => {
    const offenders = compare('listeners', current.listeners, baseline.listeners);
    expect(offenders).toEqual([]);
  });

  test('the guard is actually measuring the app (baseline not empty)', () => {
    const totalReads = Object.values(baseline.unboundedReads).reduce((a, b) => a + b, 0);
    const totalListeners = Object.values(baseline.listeners).reduce((a, b) => a + b, 0);
    expect(totalReads).toBeGreaterThan(0);
    expect(totalListeners).toBeGreaterThan(0);
  });

  // Dependency count is the cheapest proxy for "large dependency additions":
  // a new runtime package is almost always the vector for bundle growth. The
  // baseline may only be lowered; raising it is a deliberate decision.
  test('no unplanned runtime dependency additions', () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
    const runtime = Object.keys(pkg.dependencies || {});
    expect(runtime.length).toBeLessThanOrEqual(baseline.runtimeDependencies);
  });
});
