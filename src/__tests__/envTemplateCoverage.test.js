/**
 * @jest-environment node
 *
 * `.env.example` must document exactly the client variables the app reads.
 *
 * Two failure modes this pins:
 *  - a variable the code reads but the template omits (`VITE_LOG_ENDPOINT`,
 *    `VITE_APP_VERSION` were undocumented) — a deployer cannot configure a real
 *    feature;
 *  - a variable the template advertises but no code reads (`VITE_ENCRYPTION_KEY`,
 *    `VITE_INITIAL_COIN_BALANCE`, `VITE_DEFAULT_PROFILE_PICTURE`,
 *    `VITE_MUSIC_API_KEY`, `VITE_SAML_VERIFY_URL`, `VITE_SYSTEM_METRICS_URL`) —
 *    an advertised control that does nothing. `VITE_ENCRYPTION_KEY` and
 *    `VITE_INITIAL_COIN_BALANCE` are especially dangerous: they read as a
 *    client-side key/balance authority, which the platform deliberately does not
 *    have (messaging has no key provisioning; the coin balance is
 *    server-authoritative on `users_private`).
 *
 * It also pins a single canonical name for the Stripe publishable key —
 * `monetizationService` read `VITE_STRIPE_PUBLIC_KEY` while `PaymentModal` and
 * the docs used `VITE_STRIPE_PUBLISHABLE_KEY`, so setting one left the other
 * half of the payment surface unconfigured.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const SRC = path.join(root, 'src');

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === '__tests__') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (/\.(js|jsx)$/.test(entry.name)) out.push(full);
  }
  return out;
}

function readUsedVars() {
  const used = new Set();
  const re = /import\.meta\.env\??\.(VITE_[A-Z0-9_]+)/g;
  for (const file of walk(SRC)) {
    const src = fs.readFileSync(file, 'utf8');
    for (const m of src.matchAll(re)) used.add(m[1]);
  }
  return used;
}

function readDeclaredVars() {
  const text = fs.readFileSync(path.join(root, '.env.example'), 'utf8');
  const declared = new Set();
  for (const line of text.split('\n')) {
    const m = /^(VITE_[A-Z0-9_]+)=/.exec(line.trim());
    if (m) declared.add(m[1]);
  }
  return declared;
}

describe('env template coverage', () => {
  const used = readUsedVars();
  const declared = readDeclaredVars();

  test('every VITE_ var the code reads is documented in .env.example', () => {
    const missing = [...used].filter((v) => !declared.has(v)).sort();
    expect(missing).toEqual([]);
  });

  test('every VITE_ var documented in .env.example is read by the code', () => {
    const dead = [...declared].filter((v) => !used.has(v)).sort();
    expect(dead).toEqual([]);
  });

  test('the Stripe publishable key has one canonical name', () => {
    // The wrong name must not reappear anywhere in src.
    const offenders = [];
    for (const file of walk(SRC)) {
      if (fs.readFileSync(file, 'utf8').includes('VITE_STRIPE_PUBLIC_KEY')) {
        offenders.push(path.relative(root, file));
      }
    }
    expect(offenders).toEqual([]);
    expect(used.has('VITE_STRIPE_PUBLISHABLE_KEY')).toBe(true);
  });

  test('every Vite env file (except .env.example) is git-ignored', () => {
    const gitignore = fs.readFileSync(path.join(root, '.gitignore'), 'utf8');
    const patterns = new Set(
      gitignore
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l && !l.startsWith('#'))
    );
    // `.env.local` is where a developer puts real secrets; a missing ignore rule
    // means the next `git add -A` commits them.
    for (const required of ['.env', '.env.local', '.env.*.local']) {
      expect(patterns.has(required)).toBe(true);
    }
    // The template itself must remain tracked.
    expect(patterns.has('.env.example')).toBe(false);
  });
});
