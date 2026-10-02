/**
 * src/__tests__/securityServices.test.js
 * Real assertions for the one security utility that has a genuine client
 * responsibility (input sanitization). The enforcement points that are NOT
 * real client controls were removed — see the architecture guard below.
 */

import { sanitizationService } from '../services/sanitizationService.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

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
  //   - CSPService        a runtime CSP builder that was never applied; the
  //                       enforced policy is the index.html meta tag.
  //   - SecureHeaders     returns a header map that is never sent; the real
  //                       headers are configured in firebase.json.
  //   - challengeService  client-side proof-of-work; the real bot control is
  //                       Firebase App Check.
  //   - botProtection     client-side mouse/keystroke entropy scoring, which an
  //                       attacker's automation controls end to end.
  //   - userIntegrity     client-computed trust/strike/sybil decisions that
  //                       carry no server enforcement.
  //   - apiSecurityGateway a client generated and client stored API key that the
  //                       same client validates; it can never be the authority
  //                       over its own key. Server-side key issuance is required.
  //   - searchAbuse       client rate limiting and "CAPTCHA" on search; an
  //                       attacker skips the client. Server rate limiting owns this.
  // Real replacements already exist: firestore.rules (authorization),
  // functions/rateLimit.js (per-user sharded server limits) and Firebase App
  // Check (bot/abuse). This guard stops the theatre from being reintroduced.
  const banned = [
    'WAFService',
    'CSRFService',
    'DDoSProtectionService',
    'sessionSecurityService',
    'CSPService',
    'SecureHeadersService',
    'challengeService',
    'botProtectionService',
    'userIntegrityService',
    'apiSecurityGatewayService',
    'searchAbuseService',
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

