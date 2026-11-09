/**
 * Rules/writer owner-field guard.
 *
 * The recurring bug class: a client writer stamps an owner field the Firestore
 * `create` rule does not authorise on, so the write is silently DENIED and the
 * feature no-ops. Confirmed instances:
 *   - `comment_reports` written with `userId` while the rule needs `reporterId`
 *   - `scheduled_messages` written with `senderId` while the rule needed `userId`
 *   - `monetization_outbox` written with `params.userId` (always null) while the
 *     rule needs `userId == uid()`
 *   - `story_replies` written with `fromUserId` while the rule needs `userId`
 *
 * This guard extracts, for every top-level collection, the uid()-equality
 * alternatives its `create` rule accepts (`request.resource.data.X == uid()`,
 * including through the `authoredBy('X')` helper), then requires that every
 * source file that actually writes to that collection mentions at least one of
 * those field names. It is deliberately conservative (a file-level mention is
 * enough) so it stays at zero false positives while still catching a writer
 * that stamps only a non-authorised field.
 *
 * @jest-environment node
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === '__tests__' || entry.name === 'node_modules') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (/\.jsx?$/.test(entry.name)) out.push(full);
  }
  return out;
}

const rules = fs.readFileSync(path.join(ROOT, 'firestore.rules'), 'utf8');

// Collect `authoredBy('X')` helper definitions so the guard resolves them to
// their underlying `request.resource.data.X == uid()` check.
const authoredByFields = new Set(
  [...rules.matchAll(/function\s+authoredBy\(\s*\w+\s*\)\s*\{[\s\S]*?\}/g)]
    .flatMap((m) => [...m[0].matchAll(/request\.resource\.data\.(\w+)\s*==\s*uid\(\)/g)])
    .map((m) => m[1])
);

// Top-level `match /<col>/{...}` blocks (4-space indent, the file's uniform style).
const topLevelBlocks = [];
{
  const lines = rules.split('\n');
  let current = null;
  for (const line of lines) {
    const open = line.match(/^ {4}match \/([A-Za-z_][\w]*)\/\{[^}]+\}\s*\{/);
    if (open) {
      current = { col: open[1], body: [] };
      topLevelBlocks.push(current);
      continue;
    }
    if (current) {
      // A new 4-space `match` or the closing brace at 4-space indent ends it.
      if (/^ {4}match \//.test(line)) { current = null; continue; }
      if (/^ {4}\}/.test(line)) { current = null; continue; }
      current.body.push(line);
    }
  }
}

// For each collection, the set of owner fields the create rule accepts.
const ownerFields = new Map();
for (const { col, body } of topLevelBlocks) {
  const createLines = body.filter((l) => /allow create/.test(l)).join('\n');
  if (!createLines) continue;
  const fields = new Set();
  for (const m of createLines.matchAll(/request\.resource\.data\.(\w+)(?:\.\w+)*\s*==\s*uid\(\)/g)) fields.add(m[1]);
  for (const m of createLines.matchAll(/authoredBy\(\s*'(\w+)'\s*\)/g)) {
    if (authoredByFields.has(m[1])) fields.add(m[1]);
    else fields.add(m[1]);
  }
  if (fields.size) ownerFields.set(col, fields);
}

// Extract the balanced `{ ... }` object literal starting at `open` (index of
// the opening brace). Returns just the payload, so a later function that reuses
// `userId` cannot bleed into the check.
function balancedObject(src, open) {
  let depth = 0;
  for (let i = open; i < src.length; i += 1) {
    const ch = src[i];
    if (ch === '{') depth += 1;
    else if (ch === '}') {
      depth -= 1;
      if (depth === 0) return src.slice(open, i + 1);
    }
  }
  return src.slice(open, open + 2000);
}

// Resolve a single local-variable payload hop: `const payload = { ... }` written
// as `addDoc(col, payload)`. Without this the guard misses every writer that
// builds the document object first (the shape most service writers use), which
// is exactly where an owner-field mismatch hides. Only a declaration that
// precedes the write is used, so a reused variable name resolves to the right
// literal.
function localObjectLiteral(src, name, beforeIndex) {
  const declRe = new RegExp(`(?:const|let|var)\\s+${name}\\s*=\\s*\\{`, 'g');
  let decl = null;
  let m;
  while ((m = declRe.exec(src))) {
    if (m.index < beforeIndex) decl = m;
    else break;
  }
  if (!decl) return null;
  const open = decl.index + decl[0].length - 1;
  return balancedObject(src, open);
}

// Writer call sites that target a literal top-level collection. The payload is
// either an inline object literal or a single local variable bound to one.
function writerSites(src) {
  const found = [];
  const resolve = (col, arg, argIndex) => {
    const a = arg.trim();
    const window = a.startsWith('{') ? balancedObject(src, argIndex) : localObjectLiteral(src, a, argIndex);
    if (window) found.push({ col, window });
  };
  const patterns = [
    // addDoc(collection(db, 'col'), <payload>) — allow a `this.fs.` facade prefix.
    /addDoc\(\s*(?:this\.fs\.)?collection\(\s*[^,()]+,\s*'([A-Za-z_][\w]*)'\s*\)\s*,\s*([\s\S]{1,40}?)\s*[,)]/g,
    // setDoc(doc(db, 'col', id), <payload>) / transaction.set(doc(...), <payload>)
    /(?:setDoc|transaction\.set)\(\s*(?:this\.fs\.)?doc\(\s*[^,()]+,\s*'([A-Za-z_][\w]*)'[^)]*\)\s*,\s*([\s\S]{1,40}?)\s*[,)]/g,
  ];
  for (const re of patterns) {
    let m;
    while ((m = re.exec(src))) {
      resolve(m[1], m[2], m.index + m[0].indexOf(m[2]));
    }
  }
  // Local alias: `const ref = collection(db, 'col');` then a write through the
  // alias (`addDoc(ref, { ... })`, `setDoc(doc(ref, id), { ... })`). Without
  // this hop the guard misses writers that bind the ref to a variable first.
  const aliasRe = /(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:this\.fs\.)?collection\(\s*[^,()]+,\s*'([A-Za-z_][\w]*)'/g;
  let a;
  while ((a = aliasRe.exec(src))) {
    const [, name, col] = a;
    const useRe = new RegExp(
      `(?:addDoc\\(\\s*${name}\\s*,\\s*([\\s\\S]{1,40}?)\\s*[,)]|(?:setDoc|transaction\\.set)\\(\\s*(?:this\\.fs\\.)?doc\\(\\s*${name}\\s*,[^)]*\\)\\s*,\\s*([\\s\\S]{1,40}?)\\s*[,)])`,
      'g',
    );
    let u;
    while ((u = useRe.exec(src))) {
      const arg = (u[1] || u[2] || '').trim();
      if (!arg) continue;
      resolve(col, arg, u.index + u[0].indexOf(arg));
    }
  }
  return found;
}

// A field is "stamped" when it appears as an object key (`field:`) or an object
// shorthand (`field,` / `field }`) inside the payload. A bare mention
// (`params.userId`) does not count, because that is exactly how the
// `monetization_outbox` bug hid (`userId: params.userId` was always null). The
// key/shorthand form is what the rule actually reads.
function stampsField(window, field) {
  return new RegExp(`(?:^|[{,\\n])\\s*${field}\\s*[,:}\\n]`).test(window);
}

describe('every client writer stamps the owner field its create rule authorises', () => {
  const srcFiles = walk(path.join(ROOT, 'src')).map((f) => ({
    rel: path.relative(ROOT, f),
    src: fs.readFileSync(f, 'utf8'),
  }));

  test('the guard found the collections it is meant to police', () => {
    // Sanity: the parse must not silently return an empty map.
    expect(ownerFields.size).toBeGreaterThan(20);
    expect(ownerFields.get('story_replies')).toContain('userId');
    expect(ownerFields.get('monetization_outbox')).toContain('userId');
    expect(ownerFields.get('comment_reports')).toContain('reporterId');
  });

  test('no writer targets a collection with only unauthorised owner fields', () => {
    const violations = [];
    for (const { rel, src } of srcFiles) {
      for (const { col, window } of writerSites(src)) {
        const fields = ownerFields.get(col);
        if (!fields) continue; // no uid()-gated create rule for this collection
        const stampsAny = [...fields].some((f) => stampsField(window, f));
        if (!stampsAny) {
          violations.push(`${rel} writes '${col}' but stamps none of [${[...fields].join(', ')}]`);
        }
      }
    }
    expect([...new Set(violations)].sort()).toEqual([]);
  });
});
