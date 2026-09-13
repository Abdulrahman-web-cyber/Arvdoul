/**
 * src/__tests__/phase12ComplianceAndResilienceMesh.test.js
 * Verification test suite for Phase 12:
 * - Global Compliance & Privacy Governance (GDPR / CCPA)
 * - Multi-Region Resilience & Circuit Breaker Mesh
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import {
  ComplianceGovernanceService,
  CONSENT_CATEGORIES,
} from '../services/complianceGovernanceService.js';
import {
  MultiRegionMeshService,
  CircuitBreaker,
  CIRCUIT_STATE,
  REGIONS,
} from '../services/multiRegionMeshService.js';

describe('Phase 12: Compliance Governance & Multi-Region Resilience', () => {
  describe('1. Global Compliance & Privacy Governance (Feature 42)', () => {
    let service;

    beforeEach(() => {
      service = new ComplianceGovernanceService();
    });

    it('enforces non-negotiable essential cookies while respecting opt-outs', () => {
      const consents = service.updateConsentPreferences('user_gdpr_1', {
        [CONSENT_CATEGORIES.ESSENTIAL]: false, // User tries to disable
        [CONSENT_CATEGORIES.ANALYTICS]: false,
        [CONSENT_CATEGORIES.ADVERTISING]: false,
        doNotSellOrShare: true,
      });

      // Essential cookies must strictly remain true
      expect(consents.essential).toBe(true);
      expect(consents.analytics).toBe(false);
      expect(consents.advertising).toBe(false);
      expect(consents.doNotSellOrShare).toBe(true);
    });

    it('generates GDPR Article 20 data portability archive', async () => {
      const mockUserData = {
        posts: [{ id: 'p1', content: 'My first post' }],
        comments: [{ id: 'c1', text: 'Nice!' }],
        transactions: [{ id: 'tx1', amount: 100 }],
      };

      const exportBundle = await service.exportUserData('user_gdpr_1', mockUserData);

      expect(exportBundle.meta.userId).toBe('user_gdpr_1');
      expect(exportBundle.posts.length).toBe(1);
      expect(exportBundle.comments.length).toBe(1);
      expect(exportBundle.ledgerTransactions.length).toBe(1);
      expect(exportBundle.consentHistory.essential).toBe(true);
    });

    it('executes Right to be Forgotten with cryptographic regulatory receipt', async () => {
      const receipt = await service.executeRightToBeForgotten('user_delete_1', {
        reason: 'USER_ACCOUNT_TERMINATION',
      });

      expect(receipt.status).toBe('CONFIRMED_PERMANENT_ERASURE');
      expect(receipt.scrubbedEntities).toContain('users_collection_record');
      expect(receipt.scrubbedEntities).toContain('auth_credentials_and_sessions');
      expect(receipt.receiptId).toMatch(/^rcpt_/);

      // Consent record should be purged
      const activeConsent = service.getConsentPreferences('user_delete_1');
      expect(activeConsent.updatedAt).toBeNull();
    });

    it('validates age and enforces COPPA / GDPR-K protective isolation', () => {
      const adultDate = new Date();
      adultDate.setFullYear(adultDate.getFullYear() - 25);
      const adultCheck = service.validateAgeAndJurisdiction(adultDate.toISOString(), 'EU');
      expect(adultCheck.isAllowed).toBe(true);
      expect(adultCheck.requiresParentalConsent).toBe(false);

      const minorDate = new Date();
      minorDate.setFullYear(minorDate.getFullYear() - 14); // 14 years old in EU (limit is 16)
      const minorCheck = service.validateAgeAndJurisdiction(minorDate.toISOString(), 'EU');
      expect(minorCheck.isAllowed).toBe(false);
      expect(minorCheck.requiresParentalConsent).toBe(true);
      expect(minorCheck.reason).toBe('UNDERAGE_RESTRICTION');
    });
  });

  describe('2. Multi-Region Mesh & Circuit Breakers (Feature 43)', () => {
    it('manages Circuit Breaker transitions across CLOSED, OPEN, and HALF_OPEN', async () => {
      const cb = new CircuitBreaker('firestore_writes', {
        failureThreshold: 2,
        resetTimeoutMs: 50,
        successThreshold: 1,
      });

      expect(cb.state).toBe(CIRCUIT_STATE.CLOSED);

      // Success
      await cb.execute(async () => 'ok');
      expect(cb.state).toBe(CIRCUIT_STATE.CLOSED);

      // Failure 1
      await expect(cb.execute(async () => { throw new Error('Timeout'); })).rejects.toThrow('Timeout');
      expect(cb.state).toBe(CIRCUIT_STATE.CLOSED);

      // Failure 2 (trips breaker)
      await expect(cb.execute(async () => { throw new Error('Timeout 2'); })).rejects.toThrow('Timeout 2');
      expect(cb.state).toBe(CIRCUIT_STATE.OPEN);

      // Next call fails fast without executing action
      const fallbackMock = jest.fn().mockReturnValue('fallback_val');
      const fallbackResult = await cb.execute(async () => 'never_called', fallbackMock);
      expect(fallbackResult).toBe('fallback_val');
      expect(fallbackMock).toHaveBeenCalled();

      // Wait for reset timeout
      await new Promise(r => setTimeout(r, 60));

      // Execution in HALF_OPEN succeeds and closes circuit
      const probeResult = await cb.execute(async () => 'recovered');
      expect(probeResult).toBe('recovered');
      expect(cb.state).toBe(CIRCUIT_STATE.CLOSED);
    });

    it('triggers automated failover when primary region experiences an outage', () => {
      const mesh = new MultiRegionMeshService();
      expect(mesh.activeRegion).toBe(REGIONS.US_PRIMARY.id);

      // Report primary outage
      const result = mesh.reportRegionHealth(REGIONS.US_PRIMARY.id, {
        isHealthy: false,
        latencyMs: 9999,
      });

      expect(result.failedOver).toBe(true);
      // Fails over to Europe or Asia standby
      expect(mesh.activeRegion).not.toBe(REGIONS.US_PRIMARY.id);
      expect([REGIONS.EU_STANDBY.id, REGIONS.ASIA_STANDBY.id]).toContain(mesh.activeRegion);
    });

    it('activates emergency read-only mode when all multi-region nodes degrade', () => {
      const mesh = new MultiRegionMeshService();

      // Degrade all regions
      mesh.reportRegionHealth(REGIONS.US_PRIMARY.id, { isHealthy: false });
      mesh.reportRegionHealth(REGIONS.EU_STANDBY.id, { isHealthy: false });
      const finalReport = mesh.reportRegionHealth(REGIONS.ASIA_STANDBY.id, { isHealthy: false });

      expect(mesh.readOnlyMode).toBe(true);
      expect(finalReport.readOnlyMode).toBe(true);
    });

    it('governs platform maintenance mode and broadcast messaging', () => {
      const mesh = new MultiRegionMeshService();
      const status = mesh.setMaintenanceMode(true, {
        readOnly: true,
        broadcastMessage: 'Scheduled system upgrade in progress',
      });

      expect(status.maintenanceMode).toBe(true);
      expect(status.readOnlyMode).toBe(true);
      expect(status.broadcastMessage).toBe('Scheduled system upgrade in progress');

      const snapshot = mesh.getMeshStatus();
      expect(snapshot.maintenanceMode).toBe(true);
    });
  });
});
