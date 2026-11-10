'use strict';

// Cloud Functions inventory analyzer (contract guards).
//
// Produces three facts about the functions <-> client boundary, all derived
// from source (no runtime boot):
//
//   1. deadFunctionKeys      — entries in the client `FUNCTIONS` map that no
//                              `src` file ever reads as `FUNCTIONS.<KEY>`. A key
//                              nobody uses is a false contract claim.
//   2. adhocCallableLiterals — `httpsCallable(..., 'name')` string literals in
//                              `src` whose name is not in the `FUNCTIONS` map.
//                              These bypass the single callable contract (the
//                              repo requires every callable to go through
//                              `callableService.js`).
//   3. unreferencedCallables — server `onCall` exports that no client file
//                              references. Some are legitimately unreachable from
//                              the client today (operator/migration tools,
//                              superseded duplicates); they are frozen in a
//                              baseline so no NEW dead callable can appear.
//
// The baseline may only shrink.

const fs = require('fs');
const path = require('path');

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '__tests__') continue;
      walk(full, out);
    } else if (/\.(js|jsx)$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

function parseFunctionsMap(src) {
  const map = {};
  for (const m of src.matchAll(/^\s*([A-Z_]+):\s*'([^']+)'/gm)) map[m[1]] = m[2];
  return map;
}

function analyze(root) {
  const srcDir = path.join(root, 'src');
  const functionsDir = path.join(root, 'functions');

  const callableService = fs.readFileSync(path.join(srcDir, 'services', 'callableService.js'), 'utf8');
  const map = parseFunctionsMap(callableService);
  const mapNames = new Set(Object.values(map));

  const usedKeys = new Set();
  const adhocCallableLiterals = new Set();

  for (const file of walk(srcDir)) {
    const src = fs.readFileSync(file, 'utf8');
    for (const m of src.matchAll(/FUNCTIONS\.([A-Z_]+)/g)) usedKeys.add(m[1]);
    for (const m of src.matchAll(/httpsCallable\([^,]+,\s*['"]([a-zA-Z0-9_]+)['"]/g)) {
      if (!mapNames.has(m[1])) adhocCallableLiterals.add(m[1]);
    }
  }

  const deadFunctionKeys = Object.keys(map)
    .filter((k) => !usedKeys.has(k))
    .sort();

  // Client-referenced callable names: FUNCTIONS map values + literal call sites.
  const clientNames = new Set(mapNames);
  for (const file of walk(srcDir)) {
    const src = fs.readFileSync(file, 'utf8');
    for (const m of src.matchAll(/httpsCallable\([^,]+,\s*['"]([a-zA-Z0-9_]+)['"]/g)) clientNames.add(m[1]);
    for (const m of src.matchAll(/callFunction\(\s*['"]([a-zA-Z0-9_]+)['"]/g)) clientNames.add(m[1]);
  }

  const unreferencedCallables = [];
  for (const file of fs.readdirSync(functionsDir)) {
    if (!file.endsWith('.js')) continue;
    const src = fs.readFileSync(path.join(functionsDir, file), 'utf8');
    for (const m of src.matchAll(/exports\.([A-Za-z0-9_]+)\s*=\s*(?:functions\.https\.)?onCall\(/g)) {
      if (!clientNames.has(m[1])) unreferencedCallables.push(m[1]);
    }
  }
  unreferencedCallables.sort();

  return {
    deadFunctionKeys,
    adhocCallableLiterals: [...adhocCallableLiterals].sort(),
    unreferencedCallables,
  };
}

module.exports = { analyze };
