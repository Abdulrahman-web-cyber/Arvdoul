/**
 * src/services/fieldEncryptionService.js - ARVDOUL FIELD-LEVEL ENCRYPTION ENGINE
 *
 * Implements:
 * 1. Client-Side Envelope Encryption (AES-GCM 256-bit): Encrypts sensitive PII fields (phone, legal tax ID, SSN, bank details)
 *    before writing to Firestore documents.
 * 2. Key Derivation & HKDF / PBKDF2: Securely derives symmetric keys with unique initialization vectors (IV) per record.
 * 3. Zero-Knowledge Decryption: Only authorized user sessions holding the master decryption context can read plaintext PII.
 */

import { logger } from '../utils/Logger.js';

class FieldEncryptionService {
  constructor() {
    this.ALGORITHM = 'AES-GCM';
    this.KEY_LENGTH = 256;
  }

  /**
   * Derives a cryptographic CryptoKey from a secret passphrase/seed using PBKDF2.
   */
  async _deriveKey(secretSeed, salt) {
    const encoder = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secretSeed),
      { name: 'PBKDF2' },
      false,
      ['deriveKey']
    );

    return await crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt,
        iterations: 100000,
        hash: 'SHA-256',
      },
      keyMaterial,
      { name: this.ALGORITHM, length: this.KEY_LENGTH },
      false,
      ['encrypt', 'decrypt']
    );
  }

  /**
   * Encrypts a plaintext string into a base64 ciphertext payload with IV and Salt.
   */
  async encryptField(plaintext, userSecretSeed) {
    if (!plaintext) return null;

    try {
      const salt = crypto.getRandomValues(new Uint8Array(16));
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const key = await this._deriveKey(userSecretSeed, salt);

      const encoder = new TextEncoder();
      const ciphertextBuffer = await crypto.subtle.encrypt(
        { name: this.ALGORITHM, iv },
        key,
        encoder.encode(plaintext)
      );

      const payload = {
        ciphertext: btoa(String.fromCharCode(...new Uint8Array(ciphertextBuffer))),
        iv: btoa(String.fromCharCode(...iv)),
        salt: btoa(String.fromCharCode(...salt)),
        v: 1, // encryption schema version
      };

      return JSON.stringify(payload);
    } catch (err) {
      logger.error('[FieldEncryption] Encryption failed:', { error: err.message });
      throw err;
    }
  }

  /**
   * Decrypts an encrypted field JSON payload back into plaintext.
   */
  async decryptField(encryptedJSON, userSecretSeed) {
    if (!encryptedJSON) return null;

    try {
      const payload = JSON.parse(encryptedJSON);
      const salt = new Uint8Array(atob(payload.salt).split('').map((c) => c.charCodeAt(0)));
      const iv = new Uint8Array(atob(payload.iv).split('').map((c) => c.charCodeAt(0)));
      const ciphertext = new Uint8Array(atob(payload.ciphertext).split('').map((c) => c.charCodeAt(0)));

      const key = await this._deriveKey(userSecretSeed, salt);
      const decryptedBuffer = await crypto.subtle.decrypt(
        { name: this.ALGORITHM, iv },
        key,
        ciphertext
      );

      const decoder = new TextDecoder();
      return decoder.decode(decryptedBuffer);
    } catch (err) {
      logger.error('[FieldEncryption] Decryption failed:', { error: err.message });
      return null;
    }
  }
}

export const fieldEncryptionService = new FieldEncryptionService();
export default fieldEncryptionService;
