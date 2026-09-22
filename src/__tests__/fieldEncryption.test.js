/**
 * src/__tests__/fieldEncryption.test.js
 * Real cryptographic round-trip tests for fieldEncryptionService
 * (AES-256-GCM + PBKDF2, zero-knowledge field encryption).
 */

import { fieldEncryptionService } from '../services/fieldEncryptionService.js';

describe('fieldEncryptionService', () => {
  test('encrypts and decrypts a field with the same seed', async () => {
    const secret = 'correct horse battery staple';
    const ciphertext = await fieldEncryptionService.encryptField('top secret note', secret);
    expect(ciphertext).toBeTruthy();

    const payload = JSON.parse(ciphertext);
    expect(payload.v).toBe(1);
    expect(payload.iv).toBeTruthy();
    expect(payload.salt).toBeTruthy();
    expect(payload.ciphertext).toBeTruthy();
    // ciphertext must not leak the plaintext
    expect(ciphertext).not.toContain('top secret');

    const plaintext = await fieldEncryptionService.decryptField(ciphertext, secret);
    expect(plaintext).toBe('top secret note');
  });

  test('produces unique ciphertexts for identical plaintext (random IV/salt)', async () => {
    const a = await fieldEncryptionService.encryptField('same value', 'seed-1');
    const b = await fieldEncryptionService.encryptField('same value', 'seed-1');
    expect(a).not.toBe(b);
  });

  test('fails to decrypt with a different seed', async () => {
    const ciphertext = await fieldEncryptionService.encryptField('classified', 'correct-seed');
    const plaintext = await fieldEncryptionService.decryptField(ciphertext, 'wrong-seed');
    expect(plaintext).toBeNull();
  });

  test('returns null for empty input', async () => {
    expect(await fieldEncryptionService.encryptField('', 'seed')).toBeNull();
    expect(await fieldEncryptionService.encryptField(null, 'seed')).toBeNull();
    expect(await fieldEncryptionService.decryptField('', 'seed')).toBeNull();
    expect(await fieldEncryptionService.decryptField(null, 'seed')).toBeNull();
  });

  test('decrypts unicode and emoji content', async () => {
    const original = 'héllo wörld 🚀 中文 العربية';
    const ciphertext = await fieldEncryptionService.encryptField(original, 'unicode-seed');
    const plaintext = await fieldEncryptionService.decryptField(ciphertext, 'unicode-seed');
    expect(plaintext).toBe(original);
  });

  test('generates a formatted recovery seed with high entropy', () => {
    const seed = fieldEncryptionService.generateRecoverySeed();
    expect(seed).toMatch(/^[0-9a-f]{2}(-[0-9a-f]{2}){15}$/);
    const seed2 = fieldEncryptionService.generateRecoverySeed();
    expect(seed2).not.toBe(seed);
  });

  test('handles long fields (10KB) without corruption', async () => {
    const longText = 'A'.repeat(10 * 1024);
    const ciphertext = await fieldEncryptionService.encryptField(longText, 'long-seed');
    const plaintext = await fieldEncryptionService.decryptField(ciphertext, 'long-seed');
    expect(plaintext).toBe(longText);
  });
});
