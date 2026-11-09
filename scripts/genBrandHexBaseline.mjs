/**
 * Regenerates scripts/brandHexBaseline.json (the brand-hex ratchet baseline).
 *
 * Run this ONLY when a migration has *removed* raw brand hex; the ratchet may
 * only shrink, so the new total must be lower than the previous one.
 *
 *   node scripts/genBrandHexBaseline.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(root, 'src');
const BRAND_HEX = /#(?:8B1EF3|4431F7|055BFB|0088FF|C82BFF)\b/gi;

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === '__tests__' || entry.name === 'node_modules') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (/\.(jsx?|css)$/.test(entry.name)) out.push(full);
  }
  return out;
}

const counts = {};
for (const file of walk(SRC)) {
  const rel = path.relative(root, file).split(path.sep).join('/');
  if (rel.startsWith('src/design-system/')) continue;
  const n = (fs.readFileSync(file, 'utf8').match(BRAND_HEX) || []).length;
  if (n > 0) counts[rel] = n;
}
const sorted = Object.fromEntries(Object.entries(counts).sort((a, b) => a[0].localeCompare(b[0])));
fs.writeFileSync(
  path.join(root, 'scripts/brandHexBaseline.json'),
  JSON.stringify(sorted, null, 2) + '\n'
);
console.log(
  `brandHexBaseline: ${Object.keys(sorted).length} files, ${Object.values(sorted).reduce((a, b) => a + b, 0)} occurrences`
);
