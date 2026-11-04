/**
 * src/__tests__/noMocks.test.js
 * Guards the "zero mock data / zero stubs" contract for the AI studio:
 *   - aiStudioService never calls OpenAI from the client (gateway only)
 *   - it returns honest `null` instead of fabricated output when unavailable
 *
 * The client-side moderation/copyright/integration services this file used to
 * cover were inert (imported only by their own tests); the enforced paths are
 * the Cloud Functions in `functions/moderation.js` and `functions/index.js`.
 */

import { jest } from '@jest/globals';

// Firestore mocked as unavailable for hermetic tests
jest.unstable_mockModule('../firebase/firebase.js', () => ({
  getFirestoreInstance: jest.fn(async () => {
    throw new Error('firebase unavailable in test');
  }),
}));

const { aiStudioService } = await import('../services/aiStudioService.js');

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
