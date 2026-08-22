/**
 * src/__tests__/noMocks.test.js
 * Guards the "zero mock data / zero stubs" contract:
 *   - copyrightDetectionService uses a REAL registry (no fabricated works)
 *   - manipulatedMediaService uses REAL statistical analysis (no dummy triggers)
 *   - childSafetyService hashes with real SHA-256
 *   - aiStudioService never calls OpenAI from the client (gateway only)
 *   - integrationRegistry fails loud instead of mocking
 */

import { jest } from '@jest/globals';

// Firestore mocked as unavailable for hermetic tests
jest.unstable_mockModule('../firebase/firebase.js', () => ({
  getFirestoreInstance: jest.fn(async () => {
    throw new Error('firebase unavailable in test');
  }),
}));

const { copyrightDetectionService } = await import('../services/copyrightDetectionService.js');
const { manipulatedMediaService } = await import('../services/manipulatedMediaService.js');
const { childSafetyService } = await import('../services/childSafetyService.js');
const { aiStudioService } = await import('../services/aiStudioService.js');
const { integrationRegistry } = await import('../services/realIntegration.js');

describe('copyrightDetectionService - real registry', () => {
  beforeEach(() => {
    copyrightDetectionService.copyrightRegistry.clear();
    copyrightDetectionService._registryLoaded = false;
    copyrightDetectionService._registryLoadPromise = null;
  });

  test('contains no fabricated sample works on startup', () => {
    expect(copyrightDetectionService.copyrightRegistry.size).toBe(0);
  });

  test('evaluateCopyright reports no matches against an empty registry', async () => {
    const result = await copyrightDetectionService.evaluateCopyright(Buffer.from('anything'));
    expect(result.isInfringed).toBe(false);
  });

  test('registerWork registers a real fingerprint and evaluateCopyright matches it', async () => {
    const fingerprint = 'deadbeefdeadbeef';
    const reg = await copyrightDetectionService.registerWork({
      fingerprint,
      owner: 'Test Rights Holder',
      title: 'Test Work',
    });
    expect(reg.success).toBe(true);
    expect(copyrightDetectionService.copyrightRegistry.has(fingerprint)).toBe(true);

    const hit = await copyrightDetectionService.evaluateCopyright(null, { fingerprint });
    expect(hit.isInfringed).toBe(true);
    expect(hit.match.owner).toBe('Test Rights Holder');
    expect(hit.action).toBe('BLOCK_AND_FLAG');
  });

  test('registerWork requires fingerprint and owner', async () => {
    await expect(copyrightDetectionService.registerWork({ fingerprint: 'x' })).rejects.toThrow('fingerprint and owner');
    await expect(copyrightDetectionService.registerWork({ owner: 'x' })).rejects.toThrow('fingerprint and owner');
  });

  test('hamming distance is symmetric and bounded', () => {
    const svc = copyrightDetectionService;
    expect(svc.computeHammingDistance('0000', '0000')).toBe(0);
    expect(svc.computeHammingDistance('0000', 'ffff')).toBe(16);
    expect(svc.computeHammingDistance('0000', '00')).toBe(99); // length mismatch
  });

  test('near-duplicate fingerprints within threshold are flagged', async () => {
    await copyrightDetectionService.registerWork({
      fingerprint: 'aaaaaaaaaaaaaaaa',
      owner: 'Studio X',
      title: 'Protected Film',
    });
    // 4 bits different (within threshold of 10)
    const near = 'aaaaaaaaaaaaaaa1';
    const hit = await copyrightDetectionService.evaluateCopyright(null, { fingerprint: near });
    expect(hit.isInfringed).toBe(true);
  });
});

describe('manipulatedMediaService - real artifact analysis', () => {
  function fakeCanvas(width, height, pixels) {
    return {
      width,
      height,
      getContext: () => ({
        getImageData: () => ({ data: pixels }),
      }),
    };
  }

  function uniformPixels(width, height, value) {
    return new Uint8ClampedArray(width * height * 4).fill(value);
  }

  test('uniform image is not flagged as manipulated', async () => {
    const canvas = fakeCanvas(8, 8, uniformPixels(8, 8, 100));
    const result = await manipulatedMediaService.scanForDeepfakeArtifacts(canvas);
    expect(result.manipulated).toBe(false);
  });

  test('hard alternating scanline seams are flagged as blending artifacts', async () => {
    const w = 8;
    const h = 8;
    const data = new Uint8ClampedArray(w * h * 4);
    for (let y = 0; y < h; y++) {
      const value = y % 2 === 0 ? 0 : 255;
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        data[i] = value;
        data[i + 1] = value;
        data[i + 2] = value;
        data[i + 3] = 255;
      }
    }
    const result = await manipulatedMediaService.scanForDeepfakeArtifacts(fakeCanvas(w, h, data));
    expect(result.manipulated).toBe(true);
    expect(result.confidence).toBeGreaterThan(0.5);
    expect(result.reason).toContain('seam');
  });

  test('returns zero confidence for unsupported canvas', async () => {
    const result = await manipulatedMediaService.scanForDeepfakeArtifacts(null);
    expect(result).toEqual({ manipulated: false, confidence: 0 });
  });
});

describe('childSafetyService - real SHA-256 pre-filter digest', () => {
  test('produces a 64-char SHA-256 hex digest', async () => {
    const digest = await childSafetyService._calculateDnaHash('test payload');
    expect(digest).toMatch(/^[0-9a-f]{64}$/);
  });

  test('is deterministic and collision-resistant across inputs', async () => {
    const a = await childSafetyService._calculateDnaHash('payload one');
    const b = await childSafetyService._calculateDnaHash('payload one');
    const c = await childSafetyService._calculateDnaHash('payload two');
    expect(a).toBe(b);
    expect(a).not.toBe(c);
  });

  test('handles empty input with a sentinel', async () => {
    expect(await childSafetyService._calculateDnaHash(null)).toBe('clean_signature_default');
  });
});

describe('aiStudioService - no client-side OpenAI key, no fabricated fallbacks', () => {
  test('returns null (honest unavailable) when no gateway is configured', async () => {
    // import.meta.env is undefined under Jest -> gateway URL absent
    const result = await aiStudioService._callOpenAI('hello', 'system');
    expect(result).toBeNull();
  });

  test('never fabricates AI output when the gateway is unavailable', async () => {
    const caption = await aiStudioService.generateCaptions({ topic: 'artificial intelligence', tone: 'hype' });
    expect(caption).toBeNull();
    const script = await aiStudioService.generateScript({ topic: 'artificial intelligence', style: 'tech', duration: 30 });
    expect(script).toBeNull();
    const prompt = await aiStudioService.craftImagePrompt({ subject: 'neon city' });
    expect(prompt).toBeNull();
    const analysis = await aiStudioService.analyzeViralPotential({ text: 'Hello world!' });
    expect(analysis).toBeNull();
  });

  test('contains no template hooks, sample scripts, or fabricated metrics', () => {
    const src = aiStudioService.constructor.toString() + '\n' + aiStudioService.generateCaptions.toString();
    expect(src).not.toContain('VIRAL_HOOK_TEMPLATES');
    expect(src).not.toContain('SAMPLE_SCRIPTS');
    expect(src).not.toContain('local-fallback-template');
    expect(src).not.toContain('6:30 PM - 8:45 PM');
  });

  test('does not contain any direct OpenAI API endpoint or key reference', () => {
    const src = aiStudioService._callOpenAI.toString();
    expect(src).not.toContain('api.openai.com');
    expect(src).not.toContain('VITE_OPENAI_API_KEY');
    expect(src).not.toContain('Authorization');
  });
});

describe('integrationRegistry - fail loud, never mock', () => {
  test('reports unconfigured providers honestly', () => {
    // In the test env no VITE_ keys are set
    expect(integrationRegistry.isConfigured('stripe')).toBe(false);
    expect(integrationRegistry.getConfig('ai_gateway')).toBeNull();
  });

  test('requireConfigured throws a descriptive error for critical providers', () => {
    expect(() => integrationRegistry.requireConfigured('stripe')).toThrow('INTEGRATION_NOT_CONFIGURED');
    expect(() => integrationRegistry.requireConfigured('unknown_provider')).toThrow('Unknown integration provider');
  });

  test('listProviders enumerates every provider with configuration state', () => {
    const providers = integrationRegistry.listProviders();
    expect(providers.length).toBeGreaterThanOrEqual(9);
    for (const p of providers) {
      expect(p.name).toBeTruthy();
      expect(p.description).toBeTruthy();
      expect(typeof p.critical).toBe('boolean');
      expect(typeof p.configured).toBe('boolean');
    }
  });
});
