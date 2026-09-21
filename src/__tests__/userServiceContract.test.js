// src/__tests__/userServiceContract.test.js
//
// Regression guard: every method invoked on the userService singleton from
// client code must exist on the service. Two call sites previously called
// methods that were never defined (getUserFriends, deleteUserData), which
// failed silently at runtime.

import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

const root = path.resolve(process.cwd());
const srcDir = path.join(root, 'src');

function walk(dir, acc = []) {
  for (const entry of readdirSync(dir)) {
    const p = path.join(dir, entry);
    if (statSync(p).isDirectory()) {
      if (entry !== '__tests__' && entry !== 'node_modules') walk(p, acc);
    } else if (/\.(js|jsx)$/.test(entry)) {
      acc.push(p);
    }
  }
  return acc;
}

const serviceSrc = readFileSync(path.join(srcDir, 'services/userService.js'), 'utf8');

const definedMethods = new Set();
for (const m of serviceSrc.matchAll(/^\s{2}(?:async\s+)?([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/gm)) {
  definedMethods.add(m[1]);
}
for (const m of serviceSrc.matchAll(/^export\s+(?:const|function)\s+([a-zA-Z_][a-zA-Z0-9_]*)/gm)) {
  definedMethods.add(m[1]);
}

describe('userService contract', () => {
  test('exposes getUserByUsername and deleteAccount', () => {
    expect(definedMethods.has('getUserByUsername')).toBe(true);
    expect(definedMethods.has('deleteAccount')).toBe(true);
  });

  test('every direct userService.<method> call in src resolves to a definition', () => {
    const files = walk(srcDir);
    const missing = new Set();

    for (const file of files) {
      const content = readFileSync(file, 'utf8');
      // Only consider files that import the userService singleton.
      if (!/from\s+['"][^'"]*services\/userService(\.js)?['"]/.test(content)) continue;

      for (const call of content.matchAll(/userService\.([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/g)) {
        const method = call[1];
        if (method === 'js' || method === 'matchAll') continue;
        if (!definedMethods.has(method)) {
          missing.add(`${path.relative(root, file)} -> userService.${method}`);
        }
      }
    }

    expect([...missing]).toEqual([]);
  });
});