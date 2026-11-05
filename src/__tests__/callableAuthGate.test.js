/**
 * src/__tests__/callableAuthGate.test.js
 *
 * Every `https.onCall` export is a public HTTPS endpoint. Firebase does not
 * require an authenticated caller unless the function checks `context.auth`
 * itself, so a callable that forgets the check is an unauthenticated API.
 * `feedHealthCheck` shipped that way and leaked server-only `fanout_tasks`
 * queue health to anyone; `scrapeLink` was both unauthenticated and a
 * server-side fetch of a caller-supplied URL (an SSRF primitive).
 *
 * This guard walks every `functions/*.js` module, isolates each onCall body,
 * and fails if one has no auth check. It also pins the SSRF defences on
 * `scrapeLink` so the URL validation cannot be dropped silently.
 *
 * @jest-environment node
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const functionsDir = path.join(root, 'functions');

const AUTH_RE = /(context\.auth|context\?\.auth|validateAuth\s*\(|assertAdmin\s*\(|checkIsAdmin\s*\(|getUserIdFromContext\s*\(|assertAuth\s*\(|requireAuth\s*\()/;

// Two export shapes are in use: `exports.x = functions.https.onCall(...)` and
// the destructured `exports.x = onCall(...)` (video.js). Matching only the
// first form silently skipped 17 callables — the exact "guard has a blind
// spot" failure this suite exists to prevent, so both are matched.
const ONCALL_START_RE = /exports\.(\w+)\s*=\s*(?:functions\.https\.)?onCall\s*\(/g;

function callableBodies() {
  const out = [];
  for (const file of fs.readdirSync(functionsDir)) {
    if (!file.endsWith('.js')) continue;
    const src = fs.readFileSync(path.join(functionsDir, file), 'utf8');
    const starts = [...src.matchAll(ONCALL_START_RE)];
    starts.forEach((m, i) => {
      const from = m.index;
      const to = i + 1 < starts.length ? starts[i + 1].index : src.length;
      let body = src.slice(from, to);
      // `onCall(handler)` — a named handler defined elsewhere in the module
      // (e.g. moderation.js's reportContent -> handleReportContent). Resolve
      // it so the auth check inside the handler is what we inspect.
      const ref = body.match(/onCall\s*\(\s*([A-Za-z_$][\w$]*)\s*\)\s*;/);
      if (ref) {
        const def = src.search(new RegExp(`(?:async\\s+function\\s+${ref[1]}\\b|const\\s+${ref[1]}\\s*=)`));
        body = def === -1 ? body : src.slice(def);
      }
      out.push({ file, name: m[1], body });
    });
  }
  return out;
}

describe('every Cloud Function callable enforces authentication', () => {
  const callables = callableBodies();

  test('the scan sees the real callable surface', () => {
    expect(callables.length).toBeGreaterThan(50);
  });

  test('the scan covers destructured onCall exports (video.js)', () => {
    // Regression: the scan once matched only `functions.https.onCall(`, so the
    // 17 destructured callables in video.js were never inspected.
    const videoCallables = callables.filter((c) => c.file === 'video.js').map((c) => c.name);
    expect(videoCallables).toEqual(
      expect.arrayContaining(['likeVideo', 'createMuxUpload', 'moderateVideo', 'watermarkVideo'])
    );
  });

  test('no callable is reachable without an auth check', () => {
    const offenders = callables.filter((c) => !AUTH_RE.test(c.body)).map((c) => `${c.file}:${c.name}`);
    expect(offenders).toEqual([]);
  });
});

describe('scrapeLink SSRF defences (regression guards)', () => {
  const src = fs.readFileSync(path.join(functionsDir, 'index.js'), 'utf8');

  test('requires an authenticated caller and rate limits', () => {
    const start = src.indexOf('exports.scrapeLink');
    const body = src.slice(start, src.indexOf('// ==================== HELPER FUNCTIONS', start));
    expect(body).toMatch(/context\.auth/);
    expect(body).toMatch(/checkRateLimit\s*\(/);
  });

  test('blocks loopback, link-local (cloud metadata) and private ranges', () => {
    expect(src).toMatch(/isPrivateIp/);
    expect(src).toMatch(/169/); // 169.254.0.0/16 link-local / metadata
    expect(src).toMatch(/192/); // 192.168.0.0/16
    expect(src).toMatch(/dns\.promises\.lookup/); // resolve before fetching
  });

  test('re-validates each redirect hop instead of following blindly', () => {
    expect(src).toMatch(/redirect:\s*'manual'/);
    expect(src).toMatch(/assertPublicUrl/);
  });
});

describe('video pipeline endpoints are owner/admin gated and not fetched over HTTP', () => {
  const videoSrc = fs.readFileSync(path.join(functionsDir, 'video.js'), 'utf8');

  test('watermarkVideo and moderateVideo require the owner or an admin', () => {
    for (const name of ['watermarkVideo', 'moderateVideo']) {
      const start = videoSrc.indexOf(`exports.${name} = onCall`);
      const body = videoSrc.slice(start, videoSrc.indexOf('});', start));
      expect(body).toMatch(/getUserIdFromContext\s*\(/);
      expect(body).toMatch(/assertVideoOwnerOrAdmin\s*\(/);
    }
  });

  test('generateAudioFingerprint and updateViralScore are admin-only callables', () => {
    for (const name of ['generateAudioFingerprint', 'updateViralScore']) {
      const start = videoSrc.indexOf(`exports.${name} = onCall`);
      const body = videoSrc.slice(start, videoSrc.indexOf('});', start));
      expect(body).toMatch(/assertAdmin\s*\(/);
    }
  });

  test('the Mux webhook runs the pipeline internals in-process', () => {
    // The webhook used to Cloud-Tasks-POST to the callable endpoints with no
    // auth, which can never satisfy the callable protocol — the pipeline
    // silently no-opped. It must call the internals directly.
    expect(videoSrc).toMatch(/generateAudioFingerprintInternal\s*\(/);
    expect(videoSrc).toMatch(/updateViralScoreInternal\s*\(/);
    expect(videoSrc).not.toMatch(/enqueueTask\s*\(/);
  });

  test('the client no longer wires the two internal callables', () => {
    const clientSrc = fs.readFileSync(
      path.join(root, 'src', 'services', 'videoService.js'),
      'utf8'
    );
    expect(clientSrc).not.toContain("'generateAudioFingerprint'");
    expect(clientSrc).not.toContain("'updateViralScore'");
  });
});
