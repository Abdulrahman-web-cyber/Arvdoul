/**
 * src/__tests__/phase15GovernanceAndRevenueSplits.test.js
 * Verification test suite for Phase 15:
 * - Decentralized Community Governance, Liquid Democracy & Quadratic Voting
 * - Collaborative Creator Revenue Splits & Syndicate Accounting
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import {
  CommunityGovernanceService,
  PROPOSAL_STATUS,
  PROPOSAL_CATEGORIES,
} from '../services/communityGovernanceService.js';
import {
  RevenueSplitsService,
  SPLIT_ROLES,
} from '../services/revenueSplitsService.js';

describe('Phase 15: Community Governance & Collaborative Revenue Splits', () => {
  describe('1. Community Governance & Quadratic Voting (Feature 48)', () => {
    let govService;

    beforeEach(() => {
      govService = new CommunityGovernanceService();
    });

    it('manages liquid democracy delegation and effective voting power', () => {
      // User A and B delegate to Expert C
      govService.delegateVote('user_a', 'expert_c');
      govService.delegateVote('user_b', 'expert_c');

      // Expert C starts with base power 1 + 2 delegated = 3
      const powerC = govService.getEffectiveVotingPower('expert_c', 1);
      expect(powerC).toBe(3);

      // User A revokes delegation
      govService.revokeDelegation('user_a');
      const powerAfterRevocation = govService.getEffectiveVotingPower('expert_c', 1);
      expect(powerAfterRevocation).toBe(2);
    });

    it('applies quadratic voting weight (weight = sqrt(credits)) to votes', () => {
      const proposal = govService.createProposal({
        creatorId: 'lead_mod',
        title: 'Adopt Weekly Creator Spotlight Grant',
        category: PROPOSAL_CATEGORIES.TREASURY_GRANT,
        quorumThreshold: 5,
      });

      // 1 credit = 1 weight
      const v1 = govService.castVote({
        proposalId: proposal.id,
        voterId: 'voter_1',
        choice: 'for',
        creditsSpent: 1,
      });
      expect(v1.quadraticWeight).toBe(1);

      // 9 credits = 3 weight
      const v2 = govService.castVote({
        proposalId: proposal.id,
        voterId: 'voter_2',
        choice: 'for',
        creditsSpent: 9,
      });
      expect(v2.quadraticWeight).toBe(3);

      // 16 credits = 4 weight
      const v3 = govService.castVote({
        proposalId: proposal.id,
        voterId: 'voter_3',
        choice: 'against',
        creditsSpent: 16,
      });
      expect(v3.quadraticWeight).toBe(4);

      expect(v3.currentTally.for).toBe(4); // 1 + 3
      expect(v3.currentTally.against).toBe(4); // 4
    });

    it('enforces quorum and passing majority criteria', () => {
      const proposal = govService.createProposal({
        creatorId: 'mod_1',
        title: 'Update Community Guidelines',
        quorumThreshold: 10,
        passingMajorityRatio: 0.6,
      });

      // Quorum not met: total weight 4 < 10
      govService.castVote({
        proposalId: proposal.id,
        voterId: 'v1',
        choice: 'for',
        creditsSpent: 16, // weight = 4
      });

      const outcome = govService.evaluateProposalOutcome(proposal.id);
      expect(outcome.status).toBe(PROPOSAL_STATUS.REJECTED);
    });

    it('governs proposal timelock queueing and execution', () => {
      const proposal = govService.createProposal({
        creatorId: 'admin_1',
        title: 'Allocate Community Pool',
        quorumThreshold: 2,
        timelockDelayHours: 0, // Instant for testing
      });

      govService.castVote({
        proposalId: proposal.id,
        voterId: 'voter_large',
        choice: 'for',
        creditsSpent: 25, // weight = 5 >= quorum 2
      });

      const passed = govService.evaluateProposalOutcome(proposal.id);
      expect(passed.status).toBe(PROPOSAL_STATUS.PASSED);

      const queued = govService.queueExecution(proposal.id);
      expect(queued.status).toBe(PROPOSAL_STATUS.QUEUED);

      const executed = govService.executeProposal(proposal.id);
      expect(executed.status).toBe(PROPOSAL_STATUS.EXECUTED);
      expect(executed.executedAt).toBeDefined();
    });
  });

  describe('2. Collaborative Revenue Splits & Syndicate Accounting (Feature 49)', () => {
    let splitService;

    beforeEach(() => {
      splitService = new RevenueSplitsService(250); // 2.5% platform fee
    });

    it('creates split contract and validates 10,000 basis points sum', () => {
      // Invalid: 60% + 30% = 90% (9,000 bps)
      expect(() => {
        splitService.createSplitContract({
          creatorId: 'creator_host',
          title: 'Podcast Episode Split',
          recipients: [
            { recipientId: 'host', basisPoints: 6000 },
            { recipientId: 'guest', basisPoints: 3000 },
          ],
        });
      }).toThrow('must equal exactly 10,000');

      // Valid: 50% Host, 30% Guest, 20% Editor (10,000 bps)
      const contract = splitService.createSplitContract({
        creatorId: 'creator_host',
        title: 'Podcast Episode 42',
        recipients: [
          { recipientId: 'host', basisPoints: 5000, role: SPLIT_ROLES.PRIMARY_CREATOR },
          { recipientId: 'guest', basisPoints: 3000, role: SPLIT_ROLES.GUEST },
          { recipientId: 'editor', basisPoints: 2000, role: SPLIT_ROLES.EDITOR },
        ],
      });

      expect(contract.id).toBeDefined();
      expect(contract.recipients.length).toBe(3);
    });

    it('distributes revenue with zero-remainder exact accounting guarantee', () => {
      const contract = splitService.createSplitContract({
        creatorId: 'creator_host',
        title: 'Collaborative Reel Series',
        recipients: [
          { recipientId: 'lead_artist', basisPoints: 5000 },
          { recipientId: 'animator', basisPoints: 3000 },
          { recipientId: 'sound_designer', basisPoints: 2000 },
        ],
      });

      // Distribute 1,000 coins
      // Fee = 25 (2.5%)
      // Net pool = 975
      // Artist = 487 (50% = 487.5 -> 487 + 1 residue = 488)
      // Animator = 292 (30% of 975 = 292.5 -> 292)
      // Sound = 195 (20% of 975 = 195)
      // Total payouts = 488 + 292 + 195 = 975
      // Net pool + Fee = 975 + 25 = 1000
      const distribution = splitService.distributeRevenue({
        splitContractId: contract.id,
        grossAmount: 1000,
        source: 'CREATOR_TIP',
        payerId: 'fan_123',
      });

      expect(distribution.grossAmount).toBe(1000);
      expect(distribution.platformFee).toBe(25);
      expect(distribution.netPool).toBe(975);

      const totalPaid = distribution.payouts.reduce((acc, p) => acc + p.amount, 0);
      expect(totalPaid).toBe(975);
      expect(totalPaid + distribution.platformFee).toBe(1000); // Perfect conservation!

      // Aggregate summary
      const summary = splitService.getContractSummary(contract.id);
      expect(summary.totalDistributedGross).toBe(1000);
      expect(summary.recipientTotals.lead_artist).toBe(488);
      expect(summary.recipientTotals.animator).toBe(292);
      expect(summary.recipientTotals.sound_designer).toBe(195);
    });
  });
});
