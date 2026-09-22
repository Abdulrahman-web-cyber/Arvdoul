/**
 * src/__tests__/validationService.test.js
 * Real assertions for the strict input validation layer.
 */

import { validationService } from '../services/validationService.js';

describe('validationService', () => {
  describe('validatePost', () => {
    test('accepts a valid post', () => {
      const result = validationService.validatePost({
        caption: 'Hello world',
        mediaUrls: ['https://cdn.arvdoul.com/x.jpg'],
      });
      expect(result.valid).toBe(true);
    });

    test('rejects posts without content', () => {
      const result = validationService.validatePost({});
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    test('rejects overlong posts', () => {
      const result = validationService.validatePost({ caption: 'x'.repeat(10000) });
      expect(result.valid).toBe(false);
    });

    test('rejects posts with too many tags', () => {
      const result = validationService.validatePost({
        caption: 'ok',
        tags: Array.from({ length: 31 }, (_, i) => `tag${i}`),
      });
      expect(result.valid).toBe(false);
    });
  });

  describe('validateComment', () => {
    test('accepts a normal comment', () => {
      expect(validationService.validateComment('nice post!').valid).toBe(true);
    });

    test('rejects empty comments', () => {
      const res = validationService.validateComment('');
      expect(res.valid).toBe(false);
      expect(res.errors.length).toBeGreaterThan(0);
    });

    test('rejects overlong comments', () => {
      expect(validationService.validateComment('y'.repeat(5000)).valid).toBe(false);
    });
  });

  describe('validateUsername', () => {
    test('accepts valid usernames', () => {
      expect(validationService.validateUsername('arvdoul_creator').valid).toBe(true);
      expect(validationService.validateUsername('Alex123').valid).toBe(true);
    });

    test('rejects invalid usernames', () => {
      expect(validationService.validateUsername('').valid).toBe(false);
      expect(validationService.validateUsername('a').valid).toBe(false); // too short
      expect(validationService.validateUsername('has space').valid).toBe(false);
      expect(validationService.validateUsername('bad<script>').valid).toBe(false);
      expect(validationService.validateUsername('x'.repeat(40)).valid).toBe(false); // too long
    });
  });

  describe('validateCoinAmount', () => {
    test('accepts positive integer amounts', () => {
      expect(validationService.validateCoinAmount(10).valid).toBe(true);
      expect(validationService.validateCoinAmount(1).valid).toBe(true);
    });

    test('rejects zero, negative, fractional, and non-numeric amounts', () => {
      expect(validationService.validateCoinAmount(0).valid).toBe(false);
      expect(validationService.validateCoinAmount(-5).valid).toBe(false);
      expect(validationService.validateCoinAmount(5.5).valid).toBe(false);
      expect(validationService.validateCoinAmount('5').valid).toBe(false);
      expect(validationService.validateCoinAmount('abc').valid).toBe(false);
      expect(validationService.validateCoinAmount(NaN).valid).toBe(false);
    });

    test('rejects amounts over the single-transaction cap', () => {
      expect(validationService.validateCoinAmount(1000001).valid).toBe(false);
    });
  });
});
