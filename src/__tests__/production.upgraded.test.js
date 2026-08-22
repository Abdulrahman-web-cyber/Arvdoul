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
import { incidentService } from '../services/incidentService.js';
import { aggregationCacheService } from '../services/AggregationCacheService.js';
import audioEditorService from '../services/audioEditorService.js';
import collaborationService from '../services/collaborationService.js';

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

    test('manualFailover overrides and persists the active region selection', () => {
      const result = activeActiveService.manualFailover('us-central1');
      expect(result.success).toBe(true);
      expect(result.activeRegion).toBe('us-central1');
      expect(localStorage.getItem('arvdoul_active_region')).toBe('us-central1');
    });

    test('fetches regional probes attaching custom bearer headers and ping timestamps', async () => {
      const fetchMock = jest.fn(() => Promise.resolve({ ok: true, status: 200 }));
      globalThis.fetch = fetchMock;

      await activeActiveService._fetchWithRetry('https://europe-west3-arvdoul.cloudfunctions.net/health', 1);

      expect(fetchMock).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': `Bearer ${activeActiveService.probeToken}`,
            'X-Arvdoul-Ping': expect.any(String)
          })
        })
      );
    });
  });

  describe('botProtectionService (Biometrics & Trajectory Analysis)', () => {
    let botService;

    beforeAll(async () => {
      const mod = await import('../services/botProtectionService.js');
      botService = mod.botProtectionService || mod.default;
    });

    test('flags simulated headless browser environments instantly', () => {
      // Mock navigator.webdriver
      const originalWebdriver = globalThis.navigator.webdriver;
      Object.defineProperty(globalThis.navigator, 'webdriver', { value: true, configurable: true });

      const score = botService.calculateHumanConfidence();
      expect(score).toBeLessThan(0.10);

      // Restore
      Object.defineProperty(globalThis.navigator, 'webdriver', { value: originalWebdriver, configurable: true });
    });

    test('detects keyboard flight-time scripting variance breaches', () => {
      botService.keyEvents = [
        { time: 1000, type: 'down', key: 'a' },
        { time: 1010, type: 'down', key: 'b' },
        { time: 1020, type: 'down', key: 'c' },
        { time: 1030, type: 'down', key: 'd' }
      ];

      const score = botService.calculateHumanConfidence();
      expect(score).toBeLessThan(0.30); // flagged as scripted typing
      botService.keyEvents = [];
    });
  });

  describe('copyrightDetectionService (Licensing & DMCA Notices)', () => {
    let copyrightService;

    beforeAll(async () => {
      const mod = await import('../services/copyrightDetectionService.js');
      copyrightService = mod.copyrightDetectionService || mod.default;
    });

    test('correctly calculates Hamming distances between pHash visual signatures', () => {
      const hashA = '1111000011110000111100001111000011110000111100001111000011110000';
      const hashB = '1111000011110000111100001111000011110000111100001111000011110001'; // 1 bit diff

      const dist = copyrightService.hammingDistance(hashA, hashB);
      expect(dist).toBe(1);
    });

    test('flags licensed media matches within the Hamming threshold distance', async () => {
      // Register a REAL work first - the registry is never seeded with fakes.
      await copyrightService.registerWork({
        fingerprint: '1111000011110000111100001111000011110000111100001111000011110000',
        owner: 'Test Studio Ltd.',
        title: 'Licensed Test Asset',
      });

      const licensedHashMatch = '1111000011110000111100001111000011110000111100001111000011110001'; // 1 bit diff
      const res = await copyrightService.checkCopyrightMatch(licensedHashMatch);

      expect(res.match).toBe(true);
      expect(res.owner).toBe('Test Studio Ltd.');
      expect(res.action).toBe('FLAG_FOR_ATTRIBUTION_OR_TAKEDOWN');

      // Unregistered fingerprints are NOT flagged (no false positives).
      const miss = await copyrightService.checkCopyrightMatch('0000000000000000');
      expect(miss.match).toBe(false);
    });

    test('processes and logs valid DMCA Takedown Notice claims', () => {
      const res = copyrightService.processDMCANotice('WarnerMedia IP Agent', 'licensed_neon_workspace', 'violator_john');
      expect(res.success).toBe(true);
      expect(res.claimId).toContain('dmca_');
      expect(res.status).toBe('TAKEDOWN_SUBMITTED_FOR_REVIEW');
    });
  });

  describe('SAMLService (SSO & JIT)', () => {
    test('generates service provider metadata XML descriptor', () => {
      const xml = samlService.getServiceProviderMetadataXML('enterprise_okta');
      expect(xml).toContain('EntityDescriptor');
      expect(xml).toContain('AssertionConsumerService');
      expect(xml).toContain('enterprise_okta');
    });

    test('fails CLOSED without a server verification endpoint', async () => {
      // No verifyUrl -> assertions are never trusted client-side.
      await expect(
        samlService.validateSAMLAssertion(btoa('SAMLAssertion: email="x@corp.com"'), 'tenant_okta_prod')
      ).rejects.toThrow('SAML_ASSERTION_VALIDATION_REQUIRES_SERVER');
    });

    test('validates assertions server-side and parses NameID attributes', async () => {
      const mockAssertionBase64 = btoa('<Assertion>email="test_jit@corp.com"</Assertion>');

      // Stub justInTimeProvisionUser to avoid Firebase initialization hanging
      jest.spyOn(samlService, 'justInTimeProvisionUser').mockImplementation(async (email, displayName, role) => {
        return { uid: 'sso_mock_123', email, displayName, role };
      });

      // The server verification endpoint is the source of truth.
      const originalFetch = globalThis.fetch;
      globalThis.fetch = jest.fn(async () => ({
        ok: true,
        json: async () => ({
          success: true,
          email: 'test_jit@corp.com',
          displayName: 'JIT SSO Corporate User',
          role: 'admin',
        }),
      }));

      try {
        const res = await samlService.validateSAMLAssertion(mockAssertionBase64, 'tenant_okta_prod', {
          verifyUrl: 'https://verify.example/saml',
        });
        expect(res.success).toBe(true);
        expect(res.email).toBe('test_jit@corp.com');
        expect(res.displayName).toBe('JIT SSO Corporate User');
        expect(res.role).toBe('admin');
        expect(res.serverVerified).toBe(true);
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    test('assertion validation rejects server-side verification failures', async () => {
      const expiredAssertion = btoa('<Assertion>ExpiredAssertionSignatureSpec</Assertion>');
      const originalFetch = globalThis.fetch;
      globalThis.fetch = jest.fn(async () => ({
        ok: true,
        json: async () => ({ success: false, error: 'SAML token lifetime expired' }),
      }));

      try {
        await expect(
          samlService.validateSAMLAssertion(expiredAssertion, 'tenant_okta_prod', {
            verifyUrl: 'https://verify.example/saml',
          })
        ).rejects.toThrow('SAML token lifetime expired');
      } finally {
        globalThis.fetch = originalFetch;
      }
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
    beforeEach(() => {
      alertingService.alertCooldowns.clear();
      alertingService.alertStatusStore.clear();
    });

    test('triggers alert and suppresses secondary triggers within cooldown', async () => {
      globalThis.fetch = jest.fn(() => Promise.resolve({ ok: true }));

      // First alert trigger (should run)
      const res1 = await alertingService.triggerAlert('disk_space_crit', 'p1_high', 'Low disk space', { used: '98%' });
      expect(res1.triggered).toBe(true);

      // Second alert trigger for same key within cooldown (should be suppressed)
      const res2 = await alertingService.triggerAlert('disk_space_crit', 'p1_high', 'Low disk space', { used: '98%' });
      expect(res2.triggered).toBe(false);
      expect(res2.suppressed).toBe(true);
    });

    test('escalates severity to P0 on successive threshold breaches', async () => {
      globalThis.fetch = jest.fn(() => Promise.resolve({ ok: true }));

      // Simulate 5 successive trigger attempts
      let finalRes;
      for (let i = 0; i < 5; i++) {
        // Disable cooldown check temporarily to test successive triggers
        alertingService.alertCooldowns.clear();
        finalRes = await alertingService.triggerAlert('rapid_errors', 'p1_high', 'High Error Rate');
      }

      expect(finalRes.triggered).toBe(true);
      expect(finalRes.alert.severity).toBe('p0_critical');
      expect(finalRes.alert.title).toContain('[ESCALATED]');
    });

    test('lifecycle allows acknowledging and resolving active alerts', async () => {
      globalThis.fetch = jest.fn(() => Promise.resolve({ ok: true }));

      await alertingService.triggerAlert('db_latency_high', 'p2_medium', 'DB Latency High');

      // Acknowledge alert
      const ackRes = alertingService.acknowledgeAlert('db_latency_high');
      expect(ackRes.success).toBe(true);
      expect(ackRes.alert.status).toBe('acknowledged');

      // Resolve alert should allow triggering again
      const resolveRes = alertingService.resolveAlert('db_latency_high');
      expect(resolveRes.success).toBe(true);
      expect(resolveRes.alert.status).toBe('resolved');

      const triggerAgain = await alertingService.triggerAlert('db_latency_high', 'p2_medium', 'DB Latency High');
      expect(triggerAgain.triggered).toBe(true);
    });

    test('computes valid HMAC SHA-256 signature for outgoing webhook payload verification', () => {
      const payload = 'test-ops-payload';
      const sig = alertingService._computeHMACSignedHeader(payload);
      expect(sig).toBeDefined();
      expect(sig.length).toBe(64); // 256 bits in hex format = 64 characters
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

  describe('IncidentService (Operational Incidents & Postmortems)', () => {
    test('declaring a critical P0 incident triggers operations escalation alerts', async () => {
      globalThis.fetch = jest.fn(() => Promise.resolve({ ok: true }));
      const triggerSpy = jest.spyOn(alertingService, 'triggerAlert');

      const result = await incidentService.declareIncident(
        'p0',
        'Database Outage',
        'Firestore primary index corrupted.',
        'commander_bob'
      );

      expect(result.success).toBe(true);
      expect(result.incidentId).toContain('inc_local_');
      expect(triggerSpy).toHaveBeenCalledWith(
        expect.stringContaining('incident_p0_'),
        'p0_critical',
        expect.stringContaining('CRITICAL OPERATIONAL INCIDENT DECLARED:'),
        expect.any(Object)
      );
    });

    test('generates compliant blameless postmortem templates', () => {
      const template = incidentService.generatePostmortemTemplate({
        title: 'Database Outage',
        severity: 'p0',
        commanderId: 'commander_bob',
        summary: 'Firestore corruption'
      });

      expect(template).toContain('# Incident Postmortem: Database Outage');
      expect(template).toContain('## 4. Root Cause (5 Whys)');
      expect(template).toContain('Preventative Action Items');
    });
  });

  describe('AggregationCacheService (Stampede & Single-Flight Coalescing)', () => {
    test('coalesces multiple simultaneous identical query executions', async () => {
      let callCount = 0;
      const mockCompute = jest.fn(async () => {
        callCount++;
        await new Promise(r => setTimeout(r, 10));
        return { totalCount: 150 };
      });

      // Spawn 3 simultaneous identical aggregation requests
      const promises = [
        aggregationCacheService.getOrCompute('posts', 'count', { status: 'published' }, mockCompute, 5000),
        aggregationCacheService.getOrCompute('posts', 'count', { status: 'published' }, mockCompute, 5000),
        aggregationCacheService.getOrCompute('posts', 'count', { status: 'published' }, mockCompute, 5000)
      ];

      const results = await Promise.all(promises);
      expect(results[0]).toEqual({ totalCount: 150 });
      expect(results[1]).toEqual({ totalCount: 150 });
      expect(results[2]).toEqual({ totalCount: 150 });
      // Verify the compute function was invoked ONLY once!
      expect(callCount).toBe(1);
    });

    test('invalidates the corresponding namespace pattern upon collections updates', async () => {
      const mockCompute = jest.fn(async () => ({ data: 'new' }));
      await aggregationCacheService.getOrCompute('users_stats', 'avg', { age: '20' }, mockCompute, 5000);

      await aggregationCacheService.invalidateCollection('users_stats');
      // Verify cache hit total changes after invalidation
      const mockCompute2 = jest.fn(async () => ({ data: 'refreshed' }));
      const result = await aggregationCacheService.getOrCompute('users_stats', 'avg', { age: '20' }, mockCompute2, 5000);
      expect(result).toEqual({ data: 'refreshed' });
    });
  });

  describe('AudioEditor & Collaboration Services', () => {
    test('audioEditorService creates and manages project waveforms, effects, and markers', () => {
      const proj = audioEditorService.createProject({ name: 'Studio Test Track' });
      expect(proj).toBeDefined();
      expect(proj.name).toBe('Studio Test Track');

      proj.duration = 60; // set duration for marker boundaries

      audioEditorService.addMarker(5.5);
      expect(audioEditorService.getCurrentProject().markers.length).toBe(1);

      audioEditorService.addEffect('reverb');
      expect(audioEditorService.getCurrentProject().effects.length).toBe(1);

      // Mock audioBuffer for waveform calculation (1 second of audio)
      const serviceInstance = audioEditorService.getService();
      const mockChannelData = new Float32Array(44100);
      for (let i = 0; i < mockChannelData.length; i++) mockChannelData[i] = Math.sin(i);

      serviceInstance.audioBuffer = {
        sampleRate: 44100,
        getChannelData: () => mockChannelData,
        length: 44100,
        numberOfChannels: 1
      };

      const waveform = audioEditorService.generateWaveform(10);
      expect(Array.isArray(waveform)).toBe(true);
      expect(waveform.length).toBeGreaterThan(0);
    });

    test('collaborationService returns an honest stats overview (no fabricated sample projects)', async () => {
      const stats = await collaborationService.getStats(null);
      expect(stats).toBeDefined();
      expect(Array.isArray(stats.projects)).toBe(true);
      // Honest empty state: without a user there are no projects, and the
      // service must NEVER invent sample projects (regression: v1 returned a
      // hardcoded 'proj-sample-1' demo project).
      expect(stats.projects).toEqual([]);
    });
  });
});
