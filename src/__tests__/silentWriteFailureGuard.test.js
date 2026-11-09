/**
 * Silent write-failure guard.
 *
 * The recurring "silent failure" bug class: a data-layer write (Firestore
 * `setDoc`/`updateDoc`/`addDoc`/`deleteDoc`/`runTransaction`/`writeBatch`) is
 * wrapped in a `try { ... } catch (e) {}` that swallows the error with no log
 * and no rethrow. The write then appears to succeed to every caller while
 * nothing was persisted and the failure left no trace — the hardest class of
 * bug to diagnose in production.
 *
 * A best-effort write MAY be allowed to fail (e.g. a denormalised counter, an
 * analytics breadcrumb), but it must be *observable*. Every write-path catch
 * must do at least one of:
 *   - log through the shared Logger / a service child logger / console, or
 *   - report through crash reporting, or
 *   - rethrow / return an explicit failure result.
 *
 * Scope is the data layers (`src/services`, `src/utils`, `src/store`) where
 * such a swallow hides a persistence failure. Screen-level catches are excluded
 * because an empty catch there is usually UI cleanup (`clearTimeout`,
 * `URL.revokeObjectURL`) rather than a persistence claim.
 *
 * @jest-environment node
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const SRC = path.join(root, 'src');
const DATA_LAYER_DIRS = ['services', 'utils', 'store', 'offline', 'firebase'];

// A persistence mutation. Deliberately narrow to Firestore write primitives so
// in-memory bookkeeping (`map.set`, `arr.push`) is not mistaken for a write.
const WRITE = /\b(setDoc|updateDoc|addDoc|deleteDoc|runTransaction|writeBatch|setDoc\(|\.commit\()/;

// Any observable outcome: a log call, crash report, rethrow, or explicit
// failure return. Kept broad so a legitimate best-effort catch is never flagged.
const OBSERVABLE =
  /\b(logger|log|console|svcLogger|crashReportingService|metricsService|reportError|captureException|addBreadcrumb)\b|throw\b|enhanceError|return\s+\{[^}]*\b(error|success:\s*false)\b|return\s+false/;

function collect(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === '__tests__' || entry.name === 'node_modules') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) collect(full, out);
    else if (/\.(jsx|js)$/.test(entry.name)) out.push(full);
  }
  return out;
}

// Extract every `try { ... } catch (x) { ... }` pair with its two bodies.
function tryCatchPairs(source) {
  const pairs = [];
  const tryRe = /\btry\s*\{/g;
  let m;
  while ((m = tryRe.exec(source))) {
    const tryStart = m.index + m[0].length;
    let depth = 1;
    let i = tryStart;
    while (i < source.length && depth > 0) {
      if (source[i] === '{') depth += 1;
      else if (source[i] === '}') depth -= 1;
      i += 1;
    }
    const tryBody = source.slice(tryStart, i - 1);
    const rest = source.slice(i);
    const cm = rest.match(/^\s*catch\s*(?:\([^)]*\))?\s*\{/);
    if (!cm) continue;
    const catchStart = cm[0].length;
    let d = 1;
    let k = catchStart;
    while (k < rest.length && d > 0) {
      if (rest[k] === '{') d += 1;
      else if (rest[k] === '}') d -= 1;
      k += 1;
    }
    pairs.push({
      line: source.slice(0, m.index).split('\n').length,
      tryBody,
      catchBody: rest.slice(catchStart, k - 1),
    });
  }
  return pairs;
}

function stripComments(body) {
  return body.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '').trim();
}

describe('silent write-failure guard: a swallowed write must be observable', () => {
  test('no data-layer catch swallows a Firestore write with no log/rethrow', () => {
    const violations = [];
    for (const dir of DATA_LAYER_DIRS) {
      const abs = path.join(SRC, dir);
      if (!fs.existsSync(abs)) continue;
      for (const file of collect(abs)) {
        const source = fs.readFileSync(file, 'utf8');
        for (const { line, tryBody, catchBody } of tryCatchPairs(source)) {
          if (!WRITE.test(tryBody)) continue;
          const isEmpty = stripComments(catchBody) === '';
          if (isEmpty || !OBSERVABLE.test(catchBody)) {
            violations.push(
              `${path.relative(root, file)}:${line}: write-path catch is ${isEmpty ? 'empty' : 'non-observable'} — log or rethrow the failure`
            );
          }
        }
      }
    }
    expect(violations).toEqual([]);
  });

  test('the previously-silent write sites now log their failure', () => {
    // Regression pins for the exact sites this guard was introduced to fix, so a
    // future refactor cannot quietly re-empty them.
    const pins = [
      ['src/services/feedService.js', 'Interest-vector persist failed'],
      ['src/services/feedService.js', 'Feed session-state persist failed'],
      ['src/services/firestoreService.js', 'updateUserPostCount failed'],
      ['src/services/messagesService.js', '_recordRateLimit transaction failed'],
      ['src/services/userService.js', 'updateLastActive failed'],
      ['src/services/monetizationService.js', 'monetization_outbox backup write failed'],
    ];
    for (const [rel, marker] of pins) {
      const src = fs.readFileSync(path.join(root, rel), 'utf8');
      expect(src).toContain(marker);
    }
  });
});
