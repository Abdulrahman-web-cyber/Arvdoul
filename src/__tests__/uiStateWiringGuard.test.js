/**
 * UI state-wiring guard.
 *
 * A `useState` pair whose setter is never invoked (and never handed to a child)
 * is a control that cannot change: the value renders once and is frozen forever.
 * The app shipped a cluster of these — the Thumbnail Designer's split-screen
 * "compare" slider could not be dragged, the Video Editor's speed panel moved a
 * slider wired to a *different* state variable than the playhead, the Create
 * Story poll options rendered as static text, the Create Video caption never
 * showed its focus ring, and New Conversation's group photo was uploadable only
 * in code.
 *
 * The scan is deliberately conservative (zero false positives on the real tree):
 * it only reports a pair when the setter identifier appears nowhere else in the
 * file — not called, not passed as a prop, not listed as an effect dependency.
 *
 * @jest-environment node
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const SRC = path.join(root, 'src');

function collect(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === '__tests__' || entry.name === 'node_modules') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...collect(full));
    else if (/\.(jsx|js)$/.test(entry.name)) out.push(full);
  }
  return out;
}

function occurrences(source, name) {
  return (source.match(new RegExp(`(?<![\\w$])${name}(?![\\w$])`, 'g')) || []).length;
}

describe('ui-state wiring guard: every useState setter is reachable', () => {
  test('no useState pair declares a setter that is never used', () => {
    const violations = [];
    for (const file of collect(SRC)) {
      const source = fs.readFileSync(file, 'utf8');
      const re = /const\s*\[\s*([A-Za-z_$][\w$]*)\s*,\s*([A-Za-z_$][\w$]*)\s*\]\s*=\s*useState/g;
      let match;
      while ((match = re.exec(source))) {
        const [declaration, value, setter] = match;
        const rest = source.slice(0, match.index) + source.slice(match.index + declaration.length);
        // The declaration itself is excluded, so any remaining occurrence is a use.
        if (occurrences(rest, setter) === 0) {
          const valueUsed = occurrences(rest, value) > 0;
          violations.push(
            `${path.relative(root, file)}: setter "${setter}" is never used` +
              (valueUsed
                ? ` while "${value}" is rendered — the UI state is frozen`
                : ` (pair is dead)`),
          );
        }
      }
    }
    expect(violations).toEqual([]);
  });

  // The inverse defect: a setter that IS called (so the previous test passes)
  // but whose value is never rendered — "write-only state". It looks wired up
  // and does nothing: a spinner that never shows, a denial flag that never
  // gates the UI, a progress value no one reads. There are no exemptions: the
  // signup screen's recaptcha error is rendered by `InvisibleRecaptcha` itself,
  // so the parent keeps no write-only duplicate.
  test('no useState value is written but never rendered', () => {
    const violations = [];
    for (const file of collect(SRC)) {
      const rel = path.relative(root, file);
      const source = fs.readFileSync(file, 'utf8');
      const re = /const\s*\[\s*([A-Za-z_$][\w$]*)\s*,\s*([A-Za-z_$][\w$]*)\s*\]\s*=\s*useState/g;
      let match;
      while ((match = re.exec(source))) {
        const [declaration, value, setter] = match;
        const rest = source.slice(0, match.index) + source.slice(match.index + declaration.length);
        // Only the value-read side matters here; the setter-reachable side is
        // covered by the test above.
        if (occurrences(rest, setter) > 0 && occurrences(rest, value) === 0) {
          violations.push(
            `${rel}: "${value}" is set via "${setter}" but never read — the state is write-only`,
          );
        }
      }
    }
    expect(violations).toEqual([]);
  });

  // A derived value (`useMemo`/`useCallback`) or a `useRef` that is declared
  // but never referenced is dead computation the linter does not flag:
  // `LoginScreen` computed `isFormValid` but gated its buttons on a different
  // pair (`canSubmitEmail`/`canSubmitPhone`), and `AudioCard` declared an
  // `animationId` ref while its animation loop used a local `rafId`. Spread
  // usage (`{...props}`) counts as a reference.
  test('no useMemo/useCallback/useRef value is declared and never referenced', () => {
    const violations = [];
    for (const file of collect(SRC)) {
      const rel = path.relative(root, file);
      const source = fs.readFileSync(file, 'utf8');
      const re = /^[ \t]*const\s+([A-Za-z_$][\w$]*)\s*=\s*(?:React\.)?(?:useCallback|useMemo|useRef)\(/gm;
      let match;
      while ((match = re.exec(source))) {
        const [declaration, name] = match;
        const rest = source.slice(0, match.index) + source.slice(match.index + declaration.length);
        if (occurrences(rest, name) === 0) {
          violations.push(`${rel}: "${name}" is declared but never used`);
        }
      }
    }
    expect(violations).toEqual([]);
  });
});
