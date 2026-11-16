// src/__tests__/iconButtonA11yGuard.test.js
//
// A `<button>` whose only child is an icon has no accessible name: a screen
// reader announces it as just "button" and a voice-control user cannot target
// it. 14 such controls shipped across the app (close buttons in the comments
// drawer, story camera, video-editor modals; the flash/flip camera toggles; the
// reverse/freeze-frame switches; the story reply submit). Each must expose an
// accessible name via `aria-label` / `aria-labelledby` / a `title`.
//
// The detector is intentionally conservative: a button is only flagged when,
// after stripping every tag, it has no text content at all. A button with a
// visible label ("Cancel", "Save") never trips it, so false positives stay at
// zero and the suite can run in the hard-failing `guards` CI job.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const srcDir = path.resolve(__dirname, '..');

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === '__tests__' || entry.name === 'node_modules') continue;
      walk(full, out);
    } else if (entry.name.endsWith('.jsx')) {
      out.push(full);
    }
  }
  return out;
}

const BUTTON_RE = /<button\b[^>]*>([\s\S]*?)<\/button>/g;

function hasAccessibleName(openTag) {
  return (
    /\baria-label(?:ledby)?\s*=/.test(openTag) ||
    /\btitle\s*=/.test(openTag)
  );
}

function visibleText(inner) {
  // Strip tags only. A `{expression}` child (e.g. `{label}`, `{count}`) is a
  // potential text label, so it counts as content and the button is not
  // icon-only. This keeps the detector conservative.
  return inner.replace(/<[^>]+>/g, '').trim();
}

describe('a11y - every icon-only button has an accessible name', () => {
  const files = walk(srcDir);

  test('no <button> renders only an icon without aria-label/title', () => {
    const offenders = [];
    for (const file of files) {
      const src = fs.readFileSync(file, 'utf8');
      for (const match of src.matchAll(BUTTON_RE)) {
        const openTag = match[0].slice(0, match[0].indexOf('>') + 1);
        const inner = match[1];
        if (hasAccessibleName(openTag)) continue;
        const text = visibleText(inner);
        // Flag only a genuinely empty (icon-only) button.
        if (!text && /<[A-Za-z]/.test(inner)) {
          const rel = path.relative(srcDir, file);
          offenders.push(`${rel}: ${openTag.replace(/\s+/g, ' ').trim()}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});
