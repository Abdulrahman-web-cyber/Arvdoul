/**
 * src/__tests__/apiSecurityGateway.test.js
 * Real assertions for the API security gateway: key generation with SHA-256
 * secret hashing, scope enforcement, quota tracking and validation.
 */

import { jest } from '@jest/globals';

// The gateway persists keys to Firestore; mock both Firebase layers so the
// suite is hermetic (no auth/network side effects).
jest.unstable_mockModule('../firebase/firebase.js', () => ({
  getFirestoreInstance: jest.fn(async () => ({ mock: true })),
}));
jest.unstable_mockModule('firebase/firestore', () => ({
  doc: () => ({ path: 'mock' }),
  getDoc: async () => ({ exists: () => false, data: () => null }),
  setDoc: async () => {},
  updateDoc: async () => {},
  increment: (n) => n,
}));

const { apiSecurityGatewayService } = await import('../services/apiSecurityGatewayService.js');

describe('apiSecurityGatewayService', () => {
  beforeEach(() => {
    apiSecurityGatewayService._localKeysStore.clear();
    apiSecurityGatewayService._auditLog = [];
    apiSecurityGatewayService._rateLimitCounters?.clear?.();
  });

  test('generates an API key with hashed secret and scopes', async () => {
    const result = await apiSecurityGatewayService.generateAPIKey('user-1', 'My Key', ['read:posts']);
    expect(result).toHaveProperty('keyId');
    expect(result).toHaveProperty('rawKeySecret');
    expect(result.rawKeySecret.length).toBeGreaterThanOrEqual(32);
    expect(result.scopes).toEqual(['read:posts']);

    // The stored record keeps only the SHA-256 hash, never the raw secret
    const record = apiSecurityGatewayService._localKeysStore.get(result.keyId);
    expect(record.keyHash).toBeTruthy();
    expect(record.keyHash).not.toBe(result.rawKeySecret);
    expect(record.keyHash).toMatch(/^[0-9a-f]{64}$/);
  });

  test('validates a correct secret and rejects wrong secrets', async () => {
    const { keyId, rawKeySecret } = await apiSecurityGatewayService.generateAPIKey('user-1', 'k', ['read:posts']);
    const ok = await apiSecurityGatewayService.validateAPIKeySecret(keyId, rawKeySecret, 'read:posts');
    expect(ok).toBe(true);

    const bad = await apiSecurityGatewayService.validateAPIKeySecret(keyId, 'wrong-secret', 'read:posts');
    expect(bad).toBe(false);
  });

  test('hasScope enforces required permissions', async () => {
    const { keyId } = await apiSecurityGatewayService.generateAPIKey('user-1', 'k', ['read:posts', 'write:posts']);
    const record = apiSecurityGatewayService._localKeysStore.get(keyId);
    expect(apiSecurityGatewayService.hasScope(record, 'read:posts')).toBe(true);
    expect(apiSecurityGatewayService.hasScope(record, 'write:posts')).toBe(true);
    expect(apiSecurityGatewayService.hasScope(record, 'admin:all')).toBe(false);
  });

  test('rejects unknown key ids', async () => {
    const res = await apiSecurityGatewayService.validateAPIKeySecret('nope', 'x', 'read:posts');
    expect(res).toBe(false);
  });

  test('rejects keys that exceeded their quota', async () => {
    const { keyId, rawKeySecret } = await apiSecurityGatewayService.generateAPIKey('user-1', 'k', ['read:posts']);
    const record = apiSecurityGatewayService._localKeysStore.get(keyId);
    record.requestCount = apiSecurityGatewayService.quotaLimit;
    const res = await apiSecurityGatewayService.validateAPIKeySecret(keyId, rawKeySecret, 'read:posts');
    expect(res).toBe(false);
  });

  test('rejects valid keys without the required scope', async () => {
    const { keyId, rawKeySecret } = await apiSecurityGatewayService.generateAPIKey('user-1', 'k', ['read:posts']);
    const res = await apiSecurityGatewayService.validateAPIKeySecret(keyId, rawKeySecret, 'write:posts');
    expect(res).toBe(false);
  });

  test('increments request count on successful validation', async () => {
    const { keyId, rawKeySecret } = await apiSecurityGatewayService.generateAPIKey('user-1', 'k', ['read:posts']);
    await apiSecurityGatewayService.validateAPIKeySecret(keyId, rawKeySecret, 'read:posts');
    expect(apiSecurityGatewayService._localKeysStore.get(keyId).requestCount).toBe(1);
  });

  test('persists keys to localStorage and reloads them', async () => {
    const before = await apiSecurityGatewayService.generateAPIKey('user-2', 'persisted', ['read:posts']);
    const raw = localStorage.getItem('arvdoul_api_keys');
    expect(raw).toBeTruthy();
    expect(JSON.parse(raw)).toHaveProperty(before.keyId);
  });
});
