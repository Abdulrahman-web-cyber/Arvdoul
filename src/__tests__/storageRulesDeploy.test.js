/**
 * Storage rules deploy + delete-semantics guard.
 *
 * Two failures this pins:
 *  1. `firebase.json` had no `storage` section, so `storage.rules` was never
 *     deployed by `firebase deploy` — the ruleset that exists in the repo was
 *     not the ruleset live in the project, and no emulator could exercise it.
 *  2. Every media `match` used a single `allow write:` carrying
 *     `request.resource.size < N`. A delete carries no `request.resource`, so
 *     the expression throws and the delete is denied: owner deletes (avatar
 *     replacement, post/story media cleanup, temp expiry) could never succeed.
 *
 * @jest-environment node
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

describe('storage.rules is deployed', () => {
  test('firebase.json points storage at storage.rules', () => {
    const config = JSON.parse(read('firebase.json'));
    expect(config.storage).toBeDefined();
    expect(config.storage.rules).toBe('storage.rules');
    expect(fs.existsSync(path.join(root, config.storage.rules))).toBe(true);
  });

  test('a storage emulator is configured so rules can be exercised', () => {
    const config = JSON.parse(read('firebase.json'));
    expect(config.emulators?.storage?.port).toBeGreaterThan(0);
  });
});

describe('storage.rules delete semantics', () => {
  const rules = read('storage.rules');

  test('no allow delete reads request.resource (which is null on delete)', () => {
    // A delete has no `request.resource`; referencing it makes the delete
    // expression throw and the operation is denied.
    const offenders = [];
    for (const m of rules.matchAll(/allow\s+delete\s*:\s*if\s+([\s\S]*?);/g)) {
      if (/request\.resource\./.test(m[1])) {
        offenders.push(m[1].replace(/\s+/g, ' ').trim().slice(0, 80));
      }
    }
    expect(offenders).toEqual([]);
  });

  test('media writes keep size and content-type constraints', () => {
    // Splitting delete out must not weaken the create/update gate.
    expect(rules).toMatch(/request\.resource\.size\s*<\s*10 \* 1024 \* 1024/);
    expect(rules).toMatch(/request\.resource\.contentType\.matches\('image\/\.\*'\)/);
    expect(rules).toMatch(/request\.resource\.contentType\.matches\('audio\/\.\*'\)/);
  });

  test('every media match declares an explicit owner/participant delete', () => {
    const matchBlocks = [...rules.matchAll(/match\s+\/([^{]+)\{([\s\S]*?)\n\s{4}\}/g)];
    expect(matchBlocks.length).toBeGreaterThan(0);
    const missing = [];
    for (const [, p, body] of matchBlocks) {
      if (p.includes('allPaths')) continue;
      if (!/allow\s+delete\s*:/.test(body)) missing.push(p.trim());
    }
    expect(missing).toEqual([]);
  });

  test('the default deny catch-all remains', () => {
    expect(rules).toMatch(/match\s+\/\{allPaths=\*\*\}/);
    expect(rules).toMatch(/allow read, write: if false/);
  });
});
