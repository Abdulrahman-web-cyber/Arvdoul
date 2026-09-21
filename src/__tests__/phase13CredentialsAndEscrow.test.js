// src/__tests__/phase13CredentialsAndEscrow.test.js

import { describe, it, expect, beforeEach } from '@jest/globals';
import {
  VerifiableCredentialsService,
  CREDENTIAL_TYPES,
} from '../services/verifiableCredentialsService.js';
import {
  DigitalEscrowService,
  ESCROW_STATUS,
} from '../services/digitalEscrowService.js';

describe('Phase 13: Verifiable Credentials & Digital Escrow', () => {
  describe('1. Verifiable Credentials & Attestations (Feature 44)', () => {
    let credService;

    beforeEach(() => {
      credService = new VerifiableCredentialsService();
    });

    it('issues and verifies authentic tamper-evident credentials', () => {
      const cred = credService.issueCredential({
        issuerId: 'arvdoul:authority',
        subjectId: 'creator_456',
        type: CREDENTIAL_TYPES.VERIFIED_CREATOR,
        claims: {
          creatorTier: 'Platinum',
          followersCount: 150000,
          category: 'Digital Art',
        },
      });

      expect(cred.id).toBeDefined();
      expect(cred.proof.signatureValue).toMatch(/^SIG_ARVDOUL_/);

      const verification = credService.verifyCredential(cred);
      expect(verification.isValid).toBe(true);
      expect(verification.subjectId).toBe('arvdoul:user:creator_456');
    });

    it('detects tampering when payload properties are modified', () => {
      const cred = credService.issueCredential({
        subjectId: 'creator_456',
        type: CREDENTIAL_TYPES.REPUTATION_TIER,
        claims: { reputationScore: 750 },
      });

      // Attacker attempts to forge reputation score
      cred.credentialSubject.reputationScore = 9999;

      const verification = credService.verifyCredential(cred);
      expect(verification.isValid).toBe(false);
      expect(verification.reason).toBe('SIGNATURE_MISMATCH_OR_TAMPERED');
    });

    it('manages credential revocation and expiration', () => {
      const cred = credService.issueCredential({
        subjectId: 'creator_bad',
        type: CREDENTIAL_TYPES.COMMUNITY_LEADER,
        claims: { isCommunityLead: true },
        expiresInDays: 30,
      });

      // Revoke credential
      credService.revokeCredential(cred.id, 'COMMUNITY_GUIDELINE_BREACH');

      const verification = credService.verifyCredential(cred);
      expect(verification.isValid).toBe(false);
      expect(verification.reason).toBe('REVOKED');
    });

    it('generates zero-knowledge selective disclosure presentations', () => {
      const cred = credService.issueCredential({
        subjectId: 'creator_priv',
        type: CREDENTIAL_TYPES.BRAND_PARTNERSHIP,
        claims: {
          brandName: 'Acme Corp',
          dealValueUSD: 50000,
          isExclusive: true,
          badgeName: 'Brand Ambassador',
        },
      });

      // User only wishes to disclose badgeName and isExclusive, keeping dealValueUSD private
      const presentation = credService.createSelectiveDisclosurePresentation(cred, [
        'badgeName',
        'isExclusive',
      ]);

      expect(presentation.verifiedAuthentic).toBe(true);
      expect(presentation.disclosedClaims.badgeName).toBe('Brand Ambassador');
      expect(presentation.disclosedClaims.isExclusive).toBe(true);
      expect(presentation.disclosedClaims.dealValueUSD).toBeUndefined();
    });
  });

  describe('2. Digital Escrow & Milestone Contracts (Feature 45)', () => {
    let escrowService;

    beforeEach(() => {
      escrowService = new DigitalEscrowService(250); // 2.5% fee
    });

    it('creates and executes full milestone lifecycle with balance conservation', () => {
      const contract = escrowService.createContract({
        buyerId: 'brand_buyer',
        sellerId: 'creator_seller',
        title: 'Sponsored Video Campaign',
        totalAmount: 1000,
        milestones: [
          { title: 'Script Approval', amount: 400 },
          { title: 'Final Video Delivery', amount: 600 },
        ],
      });

      expect(contract.status).toBe(ESCROW_STATUS.CREATED);
      expect(contract.milestones.length).toBe(2);

      // 1. Fund
      escrowService.fundContract(contract.id, 'brand_buyer', 1000);
      expect(contract.status).toBe(ESCROW_STATUS.FUNDED);

      // 2. Start work & deliver
      escrowService.startWork(contract.id, 'creator_seller');
      escrowService.submitDeliverable(contract.id, 'creator_seller', { scriptUrl: 'https://cdn/script.pdf' });

      // 3. Release Milestone 1 (400 coins - 2.5% fee = 390 seller, 10 fee)
      escrowService.releaseMilestone(contract.id, 'brand_buyer', 'm_1');
      expect(contract.releasedAmount).toBe(390);
      expect(contract.feeCollected).toBe(10);
      expect(contract.status).toBe(ESCROW_STATUS.DELIVERED);

      // 4. Release Milestone 2 (600 coins - 2.5% fee = 585 seller, 15 fee)
      escrowService.releaseMilestone(contract.id, 'brand_buyer', 'm_2');
      expect(contract.releasedAmount).toBe(390 + 585); // 975
      expect(contract.feeCollected).toBe(10 + 15); // 25
      expect(contract.status).toBe(ESCROW_STATUS.RELEASED);

      // Balance conservation: Released + Fee = Total Funded
      expect(contract.releasedAmount + contract.feeCollected).toBe(1000);
    });

    it('rejects invalid milestone sums and self-dealing', () => {
      // Self-dealing
      expect(() => {
        escrowService.createContract({
          buyerId: 'user_same',
          sellerId: 'user_same',
          totalAmount: 500,
        });
      }).toThrow('buyerId and sellerId cannot be the same account');

      // Milestone mismatch
      expect(() => {
        escrowService.createContract({
          buyerId: 'buyer',
          sellerId: 'seller',
          totalAmount: 500,
          milestones: [
            { amount: 200 },
            { amount: 200 }, // sum 400 != 500
          ],
        });
      }).toThrow('Milestone sum (400) must equal totalAmount (500)');
    });

    it('handles dispute raising and arbiter split resolution', () => {
      const contract = escrowService.createContract({
        buyerId: 'buyer_dispute',
        sellerId: 'seller_dispute',
        title: 'Custom 3D Model',
        totalAmount: 1000,
      });

      escrowService.fundContract(contract.id, 'buyer_dispute', 1000);
      escrowService.startWork(contract.id, 'seller_dispute');
      escrowService.submitDeliverable(contract.id, 'seller_dispute', { modelUrl: 'https://cdn/incomplete.obj' });

      // Raise dispute
      escrowService.raiseDispute(contract.id, 'buyer_dispute', 'Work does not match specifications');
      expect(contract.status).toBe(ESCROW_STATUS.DISPUTED);

      // Arbiter splits 500 refund to buyer, 500 to seller
      // Seller portion: 500 - 2.5% fee (12) = 488 seller, 12 fee
      escrowService.resolveDispute(contract.id, 'arbiter_support', {
        buyerRefundAmount: 500,
        sellerReleaseAmount: 500,
      });

      expect(contract.refundedAmount).toBe(500);
      expect(contract.releasedAmount).toBe(488);
      expect(contract.feeCollected).toBe(12);
      expect(contract.refundedAmount + contract.releasedAmount + contract.feeCollected).toBe(1000);
    });
  });
});
