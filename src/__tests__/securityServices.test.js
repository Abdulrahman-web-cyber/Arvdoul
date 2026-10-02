/**
 * src/__tests__/securityServices.test.js
 * Real assertions for the security service layer that has genuine client
 * responsibilities: proof-of-work challenges, security headers, CSP and input
 * sanitization. The enforcement points that are NOT real client controls
 * (WAF, CSRF, DDoS, session anomaly detection) were removed — see the
 * architecture guard at the bottom of this file.
 */

import { challengeService } from '../services/challengeService.js';
import { secureHeadersService } from '../services/SecureHeadersService.js';
import { cspService } from '../services/CSPService.js';
import { sanitizationService } from '../services/sanitizationService.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

describe('ChallengeService (Proof-of-Work)', () => {
  test('generates a puzzle with a target prefix matching difficulty', () => {
    const puzzle = challengeService.generatePoWPuzzle(2);
    expect(puzzle.seed).toBeTruthy();
    expect(puzzle.difficulty).toBe(2);
    expect(puzzle.targetPrefix).toBe('00');
  });

  test('solves and verifies a puzzle end-to-end', async () => {
    const puzzle = challengeService.generatePoWPuzzle(2);
    const solution = await challengeService.solvePoWPuzzle(puzzle);
    expect(solution).toHaveProperty('nonce');
    expect(solution.hashHex.startsWith('00')).toBe(true);
    await expect(challengeService.verifyPoWSolution(puzzle, solution)).resolves.toBe(true);
  });

  test('rejects wrong seeds and missing solutions', async () => {
    const puzzle = challengeService.generatePoWPuzzle(2);
    const solution = await challengeService.solvePoWPuzzle(puzzle);
    await expect(
      challengeService.verifyPoWSolution({ ...puzzle, seed: 'different' }, solution)
    ).resolves.toBe(false);
    await expect(challengeService.verifyPoWSolution(puzzle, null)).resolves.toBe(false);
    await expect(challengeService.verifyPoWSolution(null, solution)).resolves.toBe(false);
  });
});

describe('SecureHeadersService', () => {
  test('emits all production security headers', () => {
    const headers = secureHeadersService.getSecurityHeaders();
    expect(headers).toHaveProperty('Strict-Transport-Security');
    expect(headers).toHaveProperty('X-Content-Type-Options');
    expect(headers).toHaveProperty('Referrer-Policy');
    expect(headers).toHaveProperty('Permissions-Policy');
    expect(headers['X-Content-Type-Options']).toBe('nosniff');
  });
});

describe('CSPService', () => {
  test('generates a CSP header containing the nonce and strict defaults', () => {
    const header = cspService.generateCSPHeader('abc123');
    expect(header).toContain("default-src 'self'");
    expect(header).toContain("script-src 'self' 'nonce-abc123'");
    expect(header).toContain("object-src 'none'");
  });

  test('handles violation reports without throwing', () => {
    expect(() => cspService.handleCSPViolation({ 'csp-report': { 'blocked-uri': 'https://evil.example/x.js' } })).not.toThrow();
    expect(() => cspService.handleCSPViolation(null)).not.toThrow();
  });
});

describe('SanitizationService', () => {
  test('strips script tags from HTML', () => {
    const clean = sanitizationService.sanitizeHTML('<p>Hello</p><script>alert(1)</script>');
    expect(clean).not.toContain('<script');
    expect(clean).toContain('Hello');
  });

  test('escapes HTML entities', () => {
    const escaped = sanitizationService.escapeHTML('<b>&"\'</b>');
    expect(escaped).not.toContain('<b>');
  });

  test('rejects unsafe URLs and allows safe ones', () => {
    expect(sanitizationService.sanitizeURL('javascript:alert(1)')).toBe('');
    expect(sanitizationService.sanitizeURL('data:text/html,<script>1</script>')).toBe('');
    expect(sanitizationService.sanitizeURL('https://arvdoul.com/path?q=1')).toBe('https://arvdoul.com/path?q=1');
    expect(sanitizationService.sanitizeURL('mailto:hello@arvdoul.com')).toBe('mailto:hello@arvdoul.com');
  });
});

describe('no client-side security theatre', () => {
  // A browser cannot be a WAF, a CSRF authority, a DDoS scrubbing layer or an
  // impossible-travel engine. These services were inert (imported only by their
  // own tests) but advertised controls that do not exist:
  //   - WAFService        regex-matching on the client, which an attacker who
  //                       controls the client simply skips.
  //   - CSRFService       Firebase Auth uses bearer ID tokens, not ambient
  //                       cookies, so there is nothing to CSRF.
  //   - DDoSProtection    client-side token bucket is a UX throttle, not a
  //                       network-layer control.
  //   - sessionSecurity   server-only signals (IP, geo, real sessions).
  // Real replacements already exist: firestore.rules (authorization),
  // functions/rateLimit.js (per-user sharded server limits) and Firebase App
  // Check (bot/abuse). This guard stops the theatre from being reintroduced.
  const banned = [
    'WAFService',
    'CSRFService',
    'DDoSProtectionService',
    'sessionSecurityService',
  ];

  test('false-security client services are gone', () => {
    for (const name of banned) {
      expect(fs.existsSync(path.join(root, 'src', 'services', `${name}.js`))).toBe(false);
    }
  });

  test('no source file references them', () => {
    const selfPath = fileURLToPath(import.meta.url);
    const offenders = [];
    const walk = (dir) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (entry.name === 'node_modules') continue;
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (/\.(js|jsx)$/.test(entry.name)) {
          // This guard names them intentionally; skip its own source.
          if (full === selfPath) continue;
          const src = fs.readFileSync(full, 'utf8');
          for (const name of banned) {
            if (src.includes(name)) offenders.push(`${path.relative(root, full)}: ${name}`);
          }
        }
      }
    };
    walk(path.join(root, 'src'));
    expect(offenders).toEqual([]);
  });
});

