// src/__tests__/phase18ChaosAndAuditLedger.test.js

import { describe, it, expect, beforeEach } from '@jest/globals';
import {
  ChaosDefenseService,
  CIRCUIT_STATE,
} from '../services/chaosDefenseService.js';
import {
  ImmutableAuditLedgerService,
  COMPLIANCE_FRAMEWORKS,
  AUDIT_ACTIONS,
} from '../services/immutableAuditLedgerService.js';

describe('Phase 18: Chaos Defense & Enterprise Immutable Audit Ledger', () => {
  describe('1. Chaos Defense & Red-Teaming Immunity (Feature 54)', () => {
    let chaosService;

    beforeEach(() => {
      chaosService = new ChaosDefenseService();
    });

    it('injects controlled synthetic latency when configured', async () => {
      chaosService.configureChaos({ isEnabled: true, latencyMs: 30 });

      const start = Date.now();
      const output = await chaosService.executeWithDefense(async () => 'success_payload');
      const elapsed = Date.now() - start;

      expect(output.handledByFallback).toBe(false);
      expect(output.result).toBe('success_payload');
      expect(elapsed).toBeGreaterThanOrEqual(25);
    });

    it('trips circuit breaker to OPEN state after threshold failures and engages fallback', async () => {
      chaosService.circuitBreaker.threshold = 2;

      const failingOp = async () => {
        throw new Error('DatabaseConnectionTimeout');
      };
      const fallback = () => 'cached_offline_data';

      // 1st failure
      const res1 = await chaosService.executeWithDefense(failingOp, fallback);
      expect(res1.handledByFallback).toBe(true);
      expect(res1.result).toBe('cached_offline_data');

      // 2nd failure -> trips circuit breaker
      await chaosService.executeWithDefense(failingOp, fallback);
      expect(chaosService.circuitBreaker.state).toBe(CIRCUIT_STATE.OPEN);

      // Subsequent call fails fast via circuit breaker fallback without invoking failingOp
      let operationInvoked = false;
      const res3 = await chaosService.executeWithDefense(async () => {
        operationInvoked = true;
      }, fallback);

      expect(operationInvoked).toBe(false);
      expect(res3.handledByFallback).toBe(true);
      expect(res3.result).toBe('cached_offline_data');
    });

    it('executes automated adversarial red-team fuzzing and assesses defense scores', () => {
      // Mock robust input sanitization validator that blocks scripts and sql tokens
      const robustSanitizer = (payload) => {
        if (payload.includes('<script>') || payload.includes("' OR 1=1") || payload.includes('__proto__') || payload.length > 10000) {
          return false; // blocked!
        }
        return true;
      };

      const assessment = chaosService.runRedTeamAssessment(robustSanitizer);
      expect(assessment.totalVectors).toBe(5);
      expect(assessment.blockedCount).toBeGreaterThanOrEqual(4);
      expect(assessment.defenseScore).toBeGreaterThanOrEqual(80);
      expect(assessment.isResilient).toBe(true);
    });
  });

  describe('2. Immutable Cryptographic Audit Ledger (Feature 55)', () => {
    let ledgerService;

    beforeEach(() => {
      ledgerService = new ImmutableAuditLedgerService();
    });

    it('initializes genesis block and appends cryptographically linked records', () => {
      expect(ledgerService.chain.length).toBe(1);
      expect(ledgerService.chain[0].sequence).toBe(0);
      expect(ledgerService.chain[0].actorId).toBe('SYSTEM_GENESIS');

      const b1 = ledgerService.appendAuditRecord({
        actorId: 'admin_security',
        action: AUDIT_ACTIONS.PRIVILEGE_ESCALATION,
        details: { targetUser: 'mod_1', newRole: 'SUPER_ADMIN' },
        complianceTags: [COMPLIANCE_FRAMEWORKS.SOC2_TYPE2, COMPLIANCE_FRAMEWORKS.ISO_27001],
      });

      expect(b1.sequence).toBe(1);
      expect(b1.prevHash).toBe(ledgerService.chain[0].hash);
      expect(b1.hash).toMatch(/^BLOCK_HASH_/);

      const b2 = ledgerService.appendAuditRecord({
        actorId: 'user_privacy',
        action: AUDIT_ACTIONS.DATA_EXPORT,
        details: { format: 'JSON_ARCHIVE' },
        complianceTags: [COMPLIANCE_FRAMEWORKS.GDPR],
      });

      expect(b2.sequence).toBe(2);
      expect(b2.prevHash).toBe(b1.hash);
      expect(ledgerService.chain.length).toBe(3);
    });

    it('verifies untampered chain integrity successfully', () => {
      ledgerService.appendAuditRecord({
        actorId: 'user_a',
        action: AUDIT_ACTIONS.USER_AUTH,
      });
      ledgerService.appendAuditRecord({
        actorId: 'user_b',
        action: AUDIT_ACTIONS.CONTRACT_SETTLEMENT,
      });

      const audit = ledgerService.verifyChainIntegrity();
      expect(audit.isValid).toBe(true);
      expect(audit.totalBlocks).toBe(3);
      expect(audit.status).toBe('VERIFIED_IMMUTABLE');
    });

    it('detects retroactive data tampering or broken hash links immediately', () => {
      ledgerService.appendAuditRecord({
        actorId: 'victim_user',
        action: AUDIT_ACTIONS.USER_AUTH,
      });
      ledgerService.appendAuditRecord({
        actorId: 'escrow_service',
        action: AUDIT_ACTIONS.CONTRACT_SETTLEMENT,
      });

      // Malicious attacker attempts to silently rewrite block #1 actorId
      ledgerService.chain[1].actorId = 'impersonated_user';

      const tamperedAudit = ledgerService.verifyChainIntegrity();
      expect(tamperedAudit.isValid).toBe(false);
      expect(tamperedAudit.violatedSequence).toBe(1);
      expect(tamperedAudit.reason).toBe('DATA_TAMPERED');
    });

    it('generates regulatory compliance reports filtered by standard', () => {
      ledgerService.appendAuditRecord({
        actorId: 'compliance_officer',
        action: AUDIT_ACTIONS.SECURITY_POLICY_UPDATE,
        complianceTags: [COMPLIANCE_FRAMEWORKS.SOC2_TYPE2],
      });
      ledgerService.appendAuditRecord({
        actorId: 'patient_portal',
        action: AUDIT_ACTIONS.DATA_EXPORT,
        complianceTags: [COMPLIANCE_FRAMEWORKS.HIPAA],
      });

      const soc2Report = ledgerService.generateComplianceReport(COMPLIANCE_FRAMEWORKS.SOC2_TYPE2);
      expect(soc2Report.framework).toBe(COMPLIANCE_FRAMEWORKS.SOC2_TYPE2);
      expect(soc2Report.chainIntegrity.isValid).toBe(true);
      expect(soc2Report.totalRecords).toBeGreaterThanOrEqual(2); // genesis + record

      const hipaaReport = ledgerService.generateComplianceReport(COMPLIANCE_FRAMEWORKS.HIPAA);
      expect(hipaaReport.framework).toBe(COMPLIANCE_FRAMEWORKS.HIPAA);
      expect(hipaaReport.totalRecords).toBe(1);
    });
  });
});
