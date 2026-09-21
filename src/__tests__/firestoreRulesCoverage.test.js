// Guards that every nested subcollection the client actually writes to has a
// matching Firestore rule. Firestore security rules do NOT cascade: a grant on
// `parent/{id}` does not cover `parent/{id}/child/{childId}`. A missing nested
// match silently falls through to the deny-all catch-all at runtime, which is
// how push-token registration (push_tokens/{uid}/devices/{deviceId}) and Vibe
// sticker voting (stories/{id}/polls/{pollId}) were broken.
//
// This test statically extracts two-segment collection paths built with
// `collection(...)`/`doc(...)` from src, then checks the rules file declares a
// match for that path either explicitly or via a generic `{subcollection}`
// catch-all inside the parent block.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === '__tests__' || entry.name === 'node_modules') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (/\.jsx?$/.test(entry.name)) out.push(full);
  }
  return out;
}

// `collection(ref, 'a', 'b')` / `doc(ref, 'a', 'b')` -> path pairs "a/b".
function extractNestedPaths(source) {
  const out = new Set();
  const re = /(?:collection|doc)\(\s*[^,]+,\s*'([A-Za-z_][\w]*)'\s*,\s*[^,)]+,\s*'([A-Za-z_][\w]*)'/g;
  let m;
  while ((m = re.exec(source))) out.add(`${m[1]}/${m[2]}`);
  return out;
}

// Parse `match /a/{x} {` blocks using indentation, the file's uniform style.
// The path pattern must include the `{var}` segments, not stop at the brace.
function declaredPaths(rules) {
  const stack = [];
  const declared = [];
  for (const line of rules.split('\n')) {
    const m = line.match(/^(\s*)match\s+(\/(?:[^\s{]|\{[^}]+\})+)\s*\{/);
    if (!m) continue;
    const indent = m[1].length;
    while (stack.length && stack[stack.length - 1].indent >= indent) stack.pop();
    stack.push({ indent, seg: m[2] });
    declared.push(stack.map(s => s.seg).join(''));
  }
  return declared;
}

describe('Firestore nested rule coverage', () => {
  const rules = fs.readFileSync(path.join(ROOT, 'firestore.rules'), 'utf8');
  const declared = declaredPaths(rules);

  // Turn each declared rule into a regex over normalized segments, where a
  // `{var}` wildcard matches exactly one path segment. Paths are recorded
  // from the rule root (`/databases/{database}/documents`), whose three
  // leading segments are dropped. e.g.
  //   /users/{userId}/{subcollection}/{docId}  ->  ^/users/[^/]+/[^/]+/[^/]+$
  const ruleRegexes = declared.map(p => {
    const parts = p.split('/').filter(Boolean);
    const root = parts.indexOf('documents') + 1;
    const segs = parts
      .slice(root)
      .map(s => (s.startsWith('{') ? '[^/]+' : s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    return new RegExp('^/' + segs.join('/') + '$');
  });

  // A client `parent/child` path (e.g. users/mutes) is covered when a declared
  // rule matches `parent/<any>/child/<any>`. Probing with a concrete path lets
  // the generic `match /{subcollection}/{docId}` catch-all match too.
  const isCovered = (parent, child) => {
    const probe = `/${parent}/_p/${child}/_c`;
    return ruleRegexes.some(re => re.test(probe));
  };

  test('every client nested subcollection has a matching rule', () => {
    const missing = [];
    for (const file of walk(path.join(ROOT, 'src'))) {
      for (const nested of extractNestedPaths(fs.readFileSync(file, 'utf8'))) {
        const [parent, child] = nested.split('/');
        if (isCovered(parent, child)) continue;
        missing.push(`${path.relative(ROOT, file)} -> ${nested}`);
      }
    }
    expect([...new Set(missing)].sort()).toEqual([]);
  });

  test('rules are brace balanced', () => {
    const stripped = rules.replace(/\/\/[^\n]*/g, '').replace(/'[^']*'/g, '""');
    let depth = 0;
    for (const ch of stripped) {
      if (ch === '{') depth += 1;
      else if (ch === '}') depth -= 1;
    }
    expect(depth).toBe(0);
  });

  test('a deny-all catch-all is the last rule', () => {
    const denyAll = rules.lastIndexOf('match /{document=**}');
    expect(denyAll).toBeGreaterThan(-1);
    expect(rules.slice(denyAll)).toContain('allow read, write: if false');
    // Nothing after the catch-all that could re-open access.
    const after = rules.slice(denyAll);
    expect(after.match(/match \//g)?.length).toBe(1);
  });
});
