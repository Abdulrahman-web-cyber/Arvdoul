/**
 * Guards that every static asset referenced from src/ (or index.html) actually
 * ships in public/. A missing file renders as a broken image with no build or
 * runtime error, so nothing else catches it.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '../..');

const ASSET_REF = /['"`]\/((?:assets|logo|icons|sounds|images)\/[A-Za-z0-9_.-]+\.(?:png|jpe?g|svg|webp|gif|mp3|ico))['"`]/g;

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (/\.(js|jsx)$/.test(entry.name)) out.push(full);
  }
  return out;
}

describe('static assets resolve', () => {
  test('every referenced public asset exists on disk', () => {
    const files = walk(path.join(root, 'src'));
    const missing = new Set();

    for (const file of files) {
      const text = fs.readFileSync(file, 'utf8');
      for (const match of text.matchAll(ASSET_REF)) {
        const rel = match[1];
        if (!fs.existsSync(path.join(root, 'public', rel))) missing.add(rel);
      }
    }

    // index.html references are checked too (favicon, manifest icons).
    const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
    for (const match of html.matchAll(ASSET_REF)) {
      const rel = match[1];
      if (!fs.existsSync(path.join(root, 'public', rel))) missing.add(rel);
    }

    expect([...missing].sort()).toEqual([]);
  });
});
