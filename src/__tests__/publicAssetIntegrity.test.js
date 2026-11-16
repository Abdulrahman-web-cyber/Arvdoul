/**
 * @jest-environment node
 *
 * Static-asset integrity for `public/`.
 *
 * Deployment/browser failure modes this pins:
 *  - a file whose real format does not match its extension (`icon.png` and
 *    `default-profile.png` were JPEGs served as `image/png`; the manifest
 *    shortcut icons, the `apple-touch-icon` and the service-worker notification
 *    icons all used them);
 *  - two sibling entries that differ only by case (`public/logo/` vs
 *    `public/Logo/`) — they collapse into one directory on macOS/Windows, so one
 *    copy becomes unreachable and imports resolve unpredictably;
 *  - a URL-unsafe filename (a space in `Logo transparent.svg`) referenced from
 *    code, which breaks once a CDN or a stricter host encodes it;
 *  - a manifest icon whose declared `sizes` does not match the real pixel size,
 *    or whose file is missing;
 *  - a service-worker precache URL that no longer resolves (a 404 in the
 *    install step).
 *
 * Pure Node — it parses PNG IHDR / JPEG SOF headers directly, so it needs no
 * image dependency.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const PUBLIC = path.join(root, 'public');

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

/** Detect an image's real format from its magic bytes. */
function detectFormat(buf) {
  if (buf.length >= 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'png';
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpeg';
  if (buf.length >= 6 && buf.subarray(0, 6).toString('ascii').startsWith('GIF8')) return 'gif';
  if (buf.length >= 12 && buf.subarray(0, 4).toString('ascii') === 'RIFF' && buf.subarray(8, 12).toString('ascii') === 'WEBP') return 'webp';
  return null;
}

function pngSize(buf) {
  if (buf.length < 24) return null;
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

function jpegSize(buf) {
  let i = 2;
  while (i + 9 < buf.length) {
    if (buf[i] !== 0xff) { i += 1; continue; }
    const marker = buf[i + 1];
    if (marker >= 0xc0 && marker <= 0xc3) {
      return { height: buf.readUInt16BE(i + 5), width: buf.readUInt16BE(i + 7) };
    }
    if (marker === 0xd8 || marker === 0xd9) { i += 2; continue; }
    const len = buf.readUInt16BE(i + 2);
    i += 2 + len;
  }
  return null;
}

const IMAGE_EXT = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp']);
const EXPECTED = { png: ['png'], jpg: ['jpeg'], jpeg: ['jpeg'], gif: ['gif'], webp: ['webp'] };

const allFiles = walk(PUBLIC);

describe('public/ asset integrity', () => {
  test('every image file matches its extension', () => {
    const offenders = [];
    for (const file of allFiles) {
      const ext = file.toLowerCase().split('.').pop();
      if (!IMAGE_EXT.has(ext)) continue;
      const fmt = detectFormat(fs.readFileSync(file));
      if (fmt && !EXPECTED[ext].includes(fmt)) {
        offenders.push(`${path.relative(root, file)} is ${fmt} but named .${ext}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  test('no sibling entries differ only by case', () => {
    const byDir = new Map();
    for (const file of allFiles) {
      const dir = path.dirname(file);
      const list = byDir.get(dir) || [];
      list.push(path.basename(file));
      byDir.set(dir, list);
    }
    const collisions = [];
    for (const [dir, names] of byDir) {
      const lower = new Map();
      for (const name of names) {
        const key = name.toLowerCase();
        if (lower.has(key)) collisions.push(`${path.relative(root, dir)}: ${lower.get(key)} vs ${name}`);
        else lower.set(key, name);
      }
    }
    expect(collisions).toEqual([]);
  });

  test('no URL-unsafe (whitespace) filename under public/', () => {
    const offenders = allFiles
      .map((f) => path.relative(root, f))
      .filter((rel) => /\s/.test(path.basename(rel)));
    expect(offenders).toEqual([]);
  });

  test('every manifest icon exists and its declared size matches', () => {
    const manifest = JSON.parse(fs.readFileSync(path.join(PUBLIC, 'manifest.json'), 'utf8'));
    const offenders = [];
    for (const icon of manifest.icons || []) {
      const file = path.join(PUBLIC, icon.src.replace(/^\//, ''));
      if (!fs.existsSync(file)) { offenders.push(`missing ${icon.src}`); continue; }
      const buf = fs.readFileSync(file);
      const fmt = detectFormat(buf);
      const dims = fmt === 'png' ? pngSize(buf) : fmt === 'jpeg' ? jpegSize(buf) : null;
      const declared = icon.sizes;
      if (dims && declared && declared !== 'any') {
        const actual = `${dims.width}x${dims.height}`;
        if (actual !== declared) offenders.push(`${icon.src} declared ${declared} but is ${actual}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  test('every service-worker precache URL resolves to a real file', () => {
    const sw = fs.readFileSync(path.join(PUBLIC, 'sw.js'), 'utf8');
    const match = /const PRECACHE_URLS = \[([^\]]*)\]/.exec(sw);
    expect(match).not.toBeNull();
    const urls = match[1].match(/'([^']+)'/g).map((s) => s.slice(1, -1));
    const offenders = [];
    for (const url of urls) {
      // `/` and `/index.html` are the SPA shell: `index.html` lives at the repo
      // root and Vite emits it into `dist/` at build time, so it is not a
      // `public/` file. Everything else must exist under `public/`.
      if (url === '/' || url === '/index.html') continue;
      const file = path.join(PUBLIC, url.replace(/^\//, ''));
      if (!fs.existsSync(file)) offenders.push(url);
    }
    expect(offenders).toEqual([]);
  });
});
