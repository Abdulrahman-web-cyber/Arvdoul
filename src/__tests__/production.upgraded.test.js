// src/__tests__/production.upgraded.test.js
// FAANG-grade Unit and Integration tests for upgraded Arvdoul system services

import { jest } from '@jest/globals';
import 'fake-indexeddb/auto';

// Polyfills for TextEncoder, TextDecoder, and crypto.subtle in Node Jest ESM env
if (typeof globalThis.TextEncoder === 'undefined' || typeof globalThis.TextDecoder === 'undefined') {
  const util = await import('node:util');
  globalThis.TextEncoder = util.TextEncoder;
  globalThis.TextDecoder = util.TextDecoder;
}

if (typeof globalThis.crypto === 'undefined' || !globalThis.crypto.subtle) {
  const { webcrypto } = await import('node:crypto');
  Object.defineProperty(globalThis, 'crypto', {
    value: webcrypto,
    configurable: true,
    writable: true
  });
}

// Polyfill window sessionStorage if undefined (e.g. in bare node environment)
if (typeof globalThis.sessionStorage === 'undefined') {
  const mockStorage = {};
  globalThis.sessionStorage = {
    setItem: (key, val) => { mockStorage[key] = String(val); },
    getItem: (key) => mockStorage[key] || null,
    removeItem: (key) => { delete mockStorage[key]; },
    clear: () => { Object.keys(mockStorage).forEach(k => delete mockStorage[k]); }
  };
}

// Polyfill window IDBRequest and related globals (fully simulated for idb dependency)
if (typeof globalThis.IDBRequest === 'undefined') {
  globalThis.IDBRequest = class IDBRequest {};
  globalThis.IDBDatabase = class IDBDatabase {};
  globalThis.IDBTransaction = class IDBTransaction {};
  globalThis.IDBIndex = class IDBIndex {};
  globalThis.IDBObjectStore = class IDBObjectStore {};
  globalThis.IDBCursor = class IDBCursor {};
}

import { getMessagingService } from '../services/messagesService.js';
import { activeActiveService } from '../services/activeActiveService.js';
import { samlService } from '../services/samlService.js';
import { apiSecurityGatewayService } from '../services/apiSecurityGatewayService.js';
import { childSafetyService } from '../services/childSafetyService.js';
import { metricsService } from '../services/metricsService.js';
import { alertingService } from '../services/alertingService.js';
import { billingService } from '../services/billingService.js';
import { disasterRecoveryService } from '../services/disasterRecoveryService.js';
import { misinformationService } from '../services/misinformationService.js';
import { costMonitoringService } from '../services/costMonitoringService.js';

describe('Upgraded Production Services Integration Tests', () => {
  let originalFetch;

  beforeAll(() => {
    originalFetch = globalThis.fetch;
  });

  beforeEach(() => {
    jest.restoreAllMocks();
    globalThis.sessionStorage.clear();
  });

  afterAll(() => {
    globalThis.fetch = originalFetch;
  });

  describe('SecureSessionKeyMap (E2EE Session-only Storage)', () => {
    test('XOR encrypts and decrypts key using safe in-memory ephemeral keys', () => {
      const messagingServiceInstance = getMessagingService();
      const mockUserId = 'user_test_e2ee';
      const rawPrivateKey = 'my-secret-x25519-private-key-data';

      // Store private key
      messagingServiceInstance.unlockedPrivateKeys.set(mockUserId, rawPrivateKey);

      // Verify it was stored encrypted (not raw plaintext)
      const encryptedHex = messagingServiceInstance.unlockedPrivateKeys.encryptedPrivateKeys.get(mockUserId);
      expect(encryptedHex).not.toBeNull();
      expect(encryptedHex).not.toContain('my-secret-x25519-private-key-data');

      // Decrypt and fetch
      const retrieved = messagingServiceInstance.unlockedPrivateKeys.get(mockUserId);
      expect(retrieved).toBe(rawPrivateKey);

      // Delete should clear memory
      messagingServiceInstance.unlockedPrivateKeys.delete(mockUserId);
      expect(messagingServiceInstance.unlockedPrivateKeys.get(mockUserId)).toBeNull();
    });
  });

  describe('ActiveActiveService (Health Probing & Failover)', () => {
    test('probeRegions calculates latency and handles offline graceful degradation', async () => {
      globalThis.fetch = jest.fn(() =>
        Promise.resolve({ ok: true, status: 200 })
      );

      const regions = await activeActiveService.probeRegions();
      expect(regions.length).toBeGreaterThan(0);
      expect(regions[0].isHealthy).toBe(true);
      expect(regions[0].healthScore).toBe(1.0);
      expect(regions[0].latencyMs).toBeGreaterThanOrEqual(0);
    });

    test('failover triggers when active region score falls below threshold', async () => {
      const targetRegion = activeActiveService.regions.find(r => r.id === activeActiveService.activeRegion);
      if (targetRegion) {
        targetRegion.isHealthy = false;
        targetRegion.healthScore = 0.80; // trigger breach
      }

      // Force evaluate
      activeActiveService._evaluateFailover();

      // Active region should have switched to a healthy one
      expect(activeActiveService.activeRegion).not.toBe(targetRegion?.id);
    });
  });

  describe('SAMLService (SSO & JIT)', () => {
    test('generates service provider metadata XML descriptor', () => {
      const xml = samlService.getServiceProviderMetadataXML('enterprise_okta');
      expect(xml).toContain('EntityDescriptor');
      expect(xml).toContain('AssertionConsumerService');
      expect(xml).toContain('enterprise_okta');
    });

    test('validates assertions and parses NameID attributes', async () => {
      const mockAssertionBase64 = btoa('SAMLAssertion: email="test_jit@corp.com" name="JIT SSO Corporate User" role="admin"');

      // Stub justInTimeProvisionUser to avoid Firebase initialization hanging
      jest.spyOn(samlService, 'justInTimeProvisionUser').mockImplementation(async (email, displayName, role) => {
        return { uid: 'sso_mock_123', email, displayName, role };
      });

      const res = await samlService.validateSAMLAssertion(mockAssertionBase64, 'tenant_okta_prod');
      expect(res.success).toBe(true);
      expect(res.email).toBe('test_jit@corp.com');
      expect(res.displayName).toBe('JIT SSO Corporate User');
      expect(res.role).toBe('admin');
    });

    test('assertion validation rejects expired assertion tokens', async () => {
      const expiredAssertion = btoa('SAMLAssertion: ExpiredAssertionSignatureSpec');
      await expect(samlService.validateSAMLAssertion(expiredAssertion, 'tenant_okta_prod'))
        .rejects.toThrow('Assertion validation failed: SAML token lifetime expired');
    });
  });

  describe('APISecurityGatewayService (Persistent Key Verification & Quotas)', () => {
    test('generates raw secrets and successfully verifies hashed key', async () => {
      const keyResult = await apiSecurityGatewayService.generateAPIKey('dev_user_123', 'My API Key', ['read:posts']);
      expect(keyResult.keyId).toBeDefined();
      expect(keyResult.rawKeySecret).toBeDefined();

      const isValid = await apiSecurityGatewayService.validateAPIKeySecret(
        keyResult.keyId,
        keyResult.rawKeySecret,
        'read:posts'
      );
      expect(isValid).toBe(true);
    });

    test('blocks verification when request exceeds key daily quotas', async () => {
      const keyResult = await apiSecurityGatewayService.generateAPIKey('dev_user_456', 'Overlimit Key', ['read:posts']);

      // Force limit breach
      const localKey = apiSecurityGatewayService._localKeysStore.get(keyResult.keyId);
      if (localKey) {
        localKey.requestCount = apiSecurityGatewayService.quotaLimit + 1;
      }

      const isValid = await apiSecurityGatewayService.validateAPIKeySecret(
        keyResult.keyId,
        keyResult.rawKeySecret,
        'read:posts'
      );
      expect(isValid).toBe(false);
    });
  });

  describe('ChildSafetyService (PhotoDNA & Azure AI Content Safety)', () => {
    test('blocks media signatures present in known CSAM photoDnaDirectory', async () => {
      const bannedHash = '31a788cb99120ff9c0d1e576572a11b9'; // CSAM signature
      const res = await childSafetyService.scanMediaBytes(null, { signature: bannedHash, userId: 'abuser_123' });

      expect(res.cleared).toBe(false);
      expect(res.action).toBe('INSTANT_LOCKDOWN_AND_LEGAL_REPORT');
      expect(res.legalEscalated).toBe(true);
    });

    test('passes clean media items without signature matches', async () => {
      const cleanHash = 'e10adc3949ba59abbe56e057f20f883e';
      const res = await childSafetyService.scanMediaBytes(null, { signature: cleanHash });

      expect(res.cleared).toBe(true);
    });
  });

  describe('MetricsService (Prometheus Scrape Output)', () => {
    test('formats recorded metrics into standard Prometheus scraper layout', () => {
      metricsService.incrementCounter('processed_requests_total', 15);
      metricsService.setGauge('server_cpu_utilization_ratio', 0.65);
      metricsService.recordHistogram('db_query_duration_ms', 12.5);

      const prometheusLines = metricsService.getPrometheusMetrics();

      expect(prometheusLines).toContain('# TYPE arvdoul_processed_requests_total counter');
      expect(prometheusLines).toContain('arvdoul_processed_requests_total 15');
      expect(prometheusLines).toContain('# TYPE arvdoul_server_cpu_utilization_ratio gauge');
      expect(prometheusLines).toContain('arvdoul_server_cpu_utilization_ratio 0.65');
      expect(prometheusLines).toContain('arvdoul_db_query_duration_ms_percentiles');
    });
  });

  describe('AlertingService (Operations & Webhooks)', () => {
    test('triggers alert and suppresses secondary triggers within cooldown', async () => {
      globalThis.fetch = jest.fn(() => Promise.resolve({ ok: true }));

      // First alert trigger (should run)
      const res1 = await alertingService.triggerAlert('disk_space_crit', 'p0_critical', 'Low disk space', { used: '98%' });
      expect(res1.triggered).toBe(true);

      // Second alert trigger for same key within cooldown (should be suppressed)
      const res2 = await alertingService.triggerAlert('disk_space_crit', 'p0_critical', 'Low disk space', { used: '98%' });
      expect(res2.triggered).toBe(false);
      expect(res2.suppressed).toBe(true);
    });
  });

  describe('BillingService (VAT & Invoice Generation)', () => {
    test('correctly calculates subtotal and tax amounts for line items', () => {
      const bundle = { coins: 1000, priceUSD: 8.99 };
      const profile = { displayName: 'John Doe', email: 'john@doe.com' };

      const invoice = billingService.generateInvoice('tx_strip_123', profile, bundle, 'card', 0.20);

      expect(invoice.invoiceNumber).toContain('INV-');
      expect(invoice.pricing.totalUSD).toBe(8.99);
      // subtotal + vat = 8.99, subtotal * 1.20 = 8.99 => subtotal = 7.49, vat = 1.50
      expect(invoice.pricing.subtotal).toBe(7.49);
      expect(invoice.pricing.vatAmount).toBe(1.50);
      expect(invoice.htmlInvoiceTemplate).toContain('ARVDOUL PLATFORM');
    });
  });

  describe('DisasterRecoveryService (Archiving & PITR Restoration)', () => {
    test('automated backup triggers export snapshots', async () => {
      const result = await disasterRecoveryService.triggerAutomatedBackup({});
      expect(result.success).toBe(true);
      expect(result.backupId).toContain('bkp_');
    });

    test('failover updates active routing region', async () => {
      const result = await disasterRecoveryService.triggerFailover();
      expect(result.failoverActive).toBe(true);
      expect(result.activeRegion).toBe('us-west2');
    });

    test('reverts database state back to specific snapshot ID', async () => {
      const result = await disasterRecoveryService.restoreFromSnapshot('bkp_948a192');
      expect(result.status).toBe('RESTORED_SUCCESSFUL');
      expect(result.revertedBackupId).toBe('bkp_948a192');
    });
  });

  describe('MisinformationService (Fact-checking & Badging)', () => {
    test('flags matches against disputed medical election patterns', async () => {
      const result = await misinformationService.evaluateMisinformation('Warning, microchips in vaccines verified!');
      expect(result.hasMisinfoLabel).toBe(true);
      expect(result.category).toBe('health_misinfo');
      expect(result.correction).toContain('World Health Organization');
    });

    test('ignores non-misleading text without pattern matches', async () => {
      const result = await misinformationService.evaluateMisinformation('Hello world, welcome to Arvdoul platform.');
      expect(result.hasMisinfoLabel).toBe(false);
    });
  });

  describe('CostMonitoringService (Quota Metering & Budgets)', () => {
    test('accurately accumulates firestore reads and egress costs', () => {
      costMonitoringService.recordFirestoreReads(200000); // 200k reads = $0.12
      costMonitoringService.recordStorageEgress(1024 * 1024 * 1024 * 10); // 10 GB egress = $1.20

      const summary = costMonitoringService.getCostSummary();
      expect(summary.firestoreReads).toBe(200000);
      expect(Number(summary.estimatedCostUSD)).toBeCloseTo(1.32, 2);
    });

    test('gracefully handles pricing fetch fallback when keys are omitted', async () => {
      // Should exit cleanly without throwing errors
      await costMonitoringService.fetchLivePricing();
      expect(costMonitoringService.PRICING.READ_PER_100K).toBeDefined();
    });
  });
});
