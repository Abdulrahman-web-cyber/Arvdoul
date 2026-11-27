import crypto from 'node:crypto';
import { evaluateContentSafety, isSafeFeedItem } from '../utils/contentSafety.js';
import { sha256 } from '../screens/CreatePost/createPostStorage.js';
import {
  markGoogleRedirectPending,
  hasGoogleRedirectPending,
  clearGoogleRedirectPending,
} from '../services/authService.js';

describe('contentSafety guard (zero-tolerance explicit sexual filtering)', () => {
  test('blocks explicit sexual, pornographic, solicitation, and underage exploitation text', () => {
    const blockedSamples = [
      'Free porn videos and xxx leaks at link',
      'Subscribe to my onlyfans leaks and nudes',
      'Incall outcall full service escort tonight',
      'Send nudes or sextape now',
      'Child porn / csam links',
      'Hardcore blowjob and anal sex clip',
    ];
    for (const sample of blockedSamples) {
      const res = evaluateContentSafety(sample);
      expect(res.allowed).toBe(false);
      expect(res.flagged).toBe(true);
      expect(typeof res.reason).toBe('string');
      expect(res.reason.length).toBeGreaterThan(10);
    }
  });

  test('does not false-positive on normal civic, geographic, or academic words', () => {
    const safeSamples = [
      'Welcome to our evening classical music class in Essex and Sussex.',
      'Please reset your password with our teaching assistant.',
      'In-depth financial analysis with cocktail reception and peacock photography.',
      'Charles Dickens seminar with the physical therapist under normal circumstances.',
      'Launching the Arvdoul Creator Studio v2!',
    ];
    for (const sample of safeSamples) {
      const res = evaluateContentSafety(sample);
      expect(res.allowed).toBe(true);
      expect(res.flagged).toBe(false);
      expect(res.reason).toBeNull();
    }
  });

  test('isSafeFeedItem filters flagged metadata and unsafe text while allowing clean posts', () => {
    expect(isSafeFeedItem({ id: 'p1', content: 'Building resilient distributed apps today.' })).toBe(true);
    expect(isSafeFeedItem({ id: 'p2', content: 'Nice sunset', isNsfw: true })).toBe(false);
    expect(isSafeFeedItem({ id: 'p3', content: 'Hello', moderation: { status: 'rejected' } })).toBe(false);
    expect(isSafeFeedItem({ id: 'p4', content: 'Clean', moderationFlags: ['sexually_explicit'] })).toBe(false);
    expect(isSafeFeedItem({ id: 'p5', content: 'Watch my new xvideos porn clip' })).toBe(false);
  });
});

describe('createPostStorage sha256 non-HTTPS pure-JS fallback', () => {
  test('matches Node/WebCrypto SHA-256 identically when globalThis.crypto.subtle is unavailable', async () => {
    const payload = new Uint8Array(Buffer.from('Arvdoul sovereign post attachment payload 2026! 🚀'));
    const expectedHex = crypto.createHash('sha256').update(payload).digest('hex');

    const originalCrypto = Object.getOwnPropertyDescriptor(globalThis, 'crypto');
    try {
      Object.defineProperty(globalThis, 'crypto', {
        configurable: true,
        value: {},
      });
      const fallbackHex = await sha256(payload);
      expect(fallbackHex).toBe(expectedHex);
    } finally {
      if (originalCrypto) {
        Object.defineProperty(globalThis, 'crypto', originalCrypto);
      }
    }
  });
});

describe('authService Google redirect pending TTL marker', () => {
  afterEach(() => {
    clearGoogleRedirectPending();
  });

  test('accepts fresh pending marker and expires stale or malformed markers', () => {
    markGoogleRedirectPending();
    expect(hasGoogleRedirectPending()).toBe(true);

    // Simulate a stale marker from > 2 minutes ago (e.g. crashed/abandoned login)
    sessionStorage.setItem(
      'arvdoul_google_redirect_pending',
      JSON.stringify({ at: Date.now() - 5 * 60 * 1000 })
    );
    expect(hasGoogleRedirectPending()).toBe(false);
    expect(sessionStorage.getItem('arvdoul_google_redirect_pending')).toBeNull();

    // Malformed / missing-timestamp marker should not wedge splash
    sessionStorage.setItem('arvdoul_google_redirect_pending', '{}');
    expect(hasGoogleRedirectPending()).toBe(false);
    expect(sessionStorage.getItem('arvdoul_google_redirect_pending')).toBeNull();
  });
});
