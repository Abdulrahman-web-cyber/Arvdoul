/**
 * src/__tests__/securityServices.test.js
 * Real assertions for the security service layer: WAF, CSRF, DDoS, PoW
 * challenges, security headers, CSP, session anomaly detection and
 * sanitization. These are the enforcement points of the platform's
 * OWASP / anti-abuse posture and must never regress.
 */

import { wafService } from '../services/WAFService.js';
import { csrfService } from '../services/CSRFService.js';
import { ddosProtectionService } from '../services/DDoSProtectionService.js';
import { challengeService } from '../services/challengeService.js';
import { secureHeadersService } from '../services/SecureHeadersService.js';
import { cspService } from '../services/CSPService.js';
import { sessionSecurityService } from '../services/sessionSecurityService.js';
import { sanitizationService } from '../services/sanitizationService.js';

describe('WAFService', () => {
  test('allows benign payloads', () => {
    expect(wafService.inspectPayload('hello world')).toEqual({ safe: true });
    expect(wafService.inspectPayload('The quick brown fox jumps over the lazy dog')).toEqual({ safe: true });
    expect(wafService.inspectPayload(null)).toEqual({ safe: true });
    expect(wafService.inspectPayload(undefined)).toEqual({ safe: true });
    expect(wafService.inspectPayload('')).toEqual({ safe: true });
  });

  test('detects SQL injection', () => {
    const res = wafService.inspectPayload("SELECT * FROM users WHERE id = 1 OR '1'='1'");
    expect(res.safe).toBe(false);
    expect(res.threat).toBe('SQLi');
  });

  test('detects XSS payloads', () => {
    expect(wafService.inspectPayload('<script>alert(1)</script>').threat).toBe('XSS');
    expect(wafService.inspectPayload('javascript:alert(1)').threat).toBe('XSS');
    expect(wafService.inspectPayload('"><img src=x onerror=alert(1)>').threat).toBe('XSS');
  });

  test('detects path traversal', () => {
    const res = wafService.inspectPayload('../../etc/passwd');
    expect(res.safe).toBe(false);
    expect(res.threat).toBe('PathTraversal');
  });

  test('detects command injection', () => {
    expect(wafService.inspectPayload('cat /etc/passwd; rm -rf /').threat).toBe('RCE/CommandInjection');
    expect(wafService.inspectPayload('$(whoami)').threat).toBe('RCE/CommandInjection');
  });

  test('detects XXE payloads', () => {
    const res = wafService.inspectPayload('<!DOCTYPE foo [<!ENTITY xxe SYSTEM "file:///etc/passwd">]>');
    expect(res.safe).toBe(false);
    expect(res.threat).toBe('XXE');
  });

  test('recursively inspects nested object values', () => {
    const res = wafService.inspectPayload({ user: { bio: 'hello' }, comment: { text: '<script>alert(1)</script>' } });
    expect(res.safe).toBe(false);
    expect(res.threat).toBe('XSS');
  });

  test('recursively inspects arrays of strings', () => {
    const res = wafService.inspectPayload({ tags: ['a', 'b', "'; DROP TABLE users; --"] });
    expect(res.safe).toBe(false);
  });
});

describe('CSRFService', () => {
  beforeEach(() => {
    // Reset singleton state between tests
    csrfService._token = null;
    csrfService._tokenExpiry = 0;
  });

  test('generates a token and verifies it in constant time', () => {
    const token = csrfService.getToken();
    expect(token).toBeTruthy();
    expect(token.length).toBeGreaterThanOrEqual(32);
    expect(csrfService.verifyToken(token)).toBe(true);
  });

  test('rejects invalid, mismatched, and empty tokens', () => {
    const token = csrfService.getToken();
    expect(csrfService.verifyToken(token + 'x')).toBe(false);
    expect(csrfService.verifyToken(token.slice(1))).toBe(false);
    expect(csrfService.verifyToken('')).toBe(false);
    expect(csrfService.verifyToken(null)).toBe(false);
    expect(csrfService.verifyToken(undefined)).toBe(false);
  });

  test('rotates token after expiry', () => {
    const token = csrfService.getToken();
    csrfService._tokenExpiry = Date.now() - 1;
    const rotated = csrfService.getToken();
    expect(rotated).not.toBe(token);
    expect(csrfService.verifyToken(rotated)).toBe(true);
  });
});

describe('DDoSProtectionService', () => {
  beforeEach(() => {
    ddosProtectionService.requestBuckets.clear();
    ddosProtectionService.banList.clear();
  });

  test('allows requests within capacity', () => {
    const first = ddosProtectionService.checkRateLimit('client-a');
    expect(first.allowed).toBe(true);
    expect(first.remaining).toBe(59);
  });

  test('throttles once the bucket is drained', () => {
    const clientKey = 'flooder';
    for (let i = 0; i < 60; i++) {
      expect(ddosProtectionService.checkRateLimit(clientKey).allowed).toBe(true);
    }
    const blocked = ddosProtectionService.checkRateLimit(clientKey);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
  });

  test('bans clients after 5 consecutive breaches', () => {
    const clientKey = 'bad-actor';
    // Drain the bucket entirely
    for (let i = 0; i < 60; i++) ddosProtectionService.checkRateLimit(clientKey);
    let last;
    for (let i = 0; i < 5; i++) last = ddosProtectionService.checkRateLimit(clientKey);
    expect(last.banned).toBe(true);
    expect(last.retryAfterSeconds).toBe(ddosProtectionService.BAN_DURATION_MS / 1000);

    // While banned, every request is refused
    const duringBan = ddosProtectionService.checkRateLimit(clientKey);
    expect(duringBan.allowed).toBe(false);
    expect(duringBan.banned).toBe(true);
  });

  test('isolates clients from each other', () => {
    const a = ddosProtectionService.checkRateLimit('client-x');
    expect(a.allowed).toBe(true);
    // Different client is unaffected by x's usage
    const b = ddosProtectionService.checkRateLimit('client-y');
    expect(b.allowed).toBe(true);
    expect(b.remaining).toBe(59);
  });
});

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

describe('SessionSecurityService', () => {
  test('flags impossible travel between distant geographies', () => {
    // Login in New York, then 5 minutes later in Tokyo
    const risk = sessionSecurityService.evaluateSessionRisk(
      { ip: '1.1.1.1', latitude: 35.6895, longitude: 139.6917, timestamp: Date.now() },
      { ip: '2.2.2.2', latitude: 40.7128, longitude: -74.0060, timestamp: Date.now() - 5 * 60 * 1000 }
    );
    expect(risk).toBeDefined();
    expect(risk.riskScore).toBeGreaterThanOrEqual(50);
    expect(risk.isAnomaly).toBe(true);
    expect(risk.requiresStepUpAuth).toBe(true);
    expect(risk.reasons.some((r) => /travel/i.test(r))).toBe(true);
  });

  test('accepts sessions from the same location', () => {
    const now = Date.now();
    const risk = sessionSecurityService.evaluateSessionRisk(
      { ip: '1.1.1.1', latitude: 40.7128, longitude: -74.0060, timestamp: now },
      { ip: '1.1.1.2', latitude: 40.7130, longitude: -74.0062, timestamp: now - 60 * 1000 }
    );
    expect(risk.riskScore).toBeLessThan(50);
    expect(risk.isAnomaly).toBe(false);
  });

  test('treats the first recorded session as low-risk', () => {
    const risk = sessionSecurityService.evaluateSessionRisk(
      { ip: '1.1.1.1', latitude: 0, longitude: 0, timestamp: Date.now() },
      null
    );
    expect(risk.isAnomaly).toBe(false);
    expect(risk.riskScore).toBeLessThan(50);
  });

  test('flags a new device fingerprint as risk', () => {
    const risk = sessionSecurityService.evaluateSessionRisk(
      { deviceId: 'device-b', latitude: 40.7128, longitude: -74.0060, timestamp: Date.now() },
      { deviceId: 'device-a', latitude: 40.7128, longitude: -74.0060, timestamp: Date.now() - 60 * 1000 }
    );
    expect(risk.riskScore).toBeGreaterThanOrEqual(30);
    expect(risk.reasons.some((r) => /device/i.test(r))).toBe(true);
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
