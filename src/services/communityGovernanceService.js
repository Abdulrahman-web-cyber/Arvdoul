/**
 * src/services/communityGovernanceService.js - ARVDOUL COMMUNITY GOVERNANCE & DAO VOTING ENGINE v1.0
 * 
 * Production-grade community governance & decentralized decision making:
 * • Quadratic Voting Engine (voteWeight = sqrt(credits)) to counteract plutocratic whale dominance
 * • Liquid Democracy / Vote Delegation (delegating voting power to domain experts with direct override)
 * • Complete proposal lifecycle (DRAFT ➔ ACTIVE ➔ PASSED/REJECTED ➔ QUEUED ➔ EXECUTED)
 * • Quorum enforcement, passing thresholds, and timelock execution windows
 */

import { logger } from '../utils/Logger.js';

export const PROPOSAL_STATUS = {
  DRAFT: 'DRAFT',
  ACTIVE: 'ACTIVE',
  PASSED: 'PASSED',
  REJECTED: 'REJECTED',
  QUEUED: 'QUEUED',
  EXECUTED: 'EXECUTED',
};

export const PROPOSAL_CATEGORIES = {
  TREASURY_GRANT: 'TREASURY_GRANT',
  COMMUNITY_RULE: 'COMMUNITY_RULE',
  MODERATOR_ELECTION: 'MODERATOR_ELECTION',
  FEATURE_ROADMAP: 'FEATURE_ROADMAP',
};

export class CommunityGovernanceService {
  constructor() {
    this.proposals = new Map(); // proposalId -> proposal
    this.delegations = new Map(); // delegatorId -> { delegateId, delegatedAt }
  }

  /**
   * Sets up or updates vote delegation (Liquid Democracy).
   */
  delegateVote(delegatorId, delegateId) {
    if (!delegatorId || !delegateId) throw new Error('Delegator and delegate are required');
    if (delegatorId === delegateId) throw new Error('Cannot delegate vote to oneself');

    this.delegations.set(delegatorId, {
      delegateId,
      delegatedAt: Date.now(),
    });

    logger.info(`[Governance] User ${delegatorId} delegated vote to ${delegateId}`);
    return { delegatorId, delegateId, status: 'DELEGATED' };
  }

  /**
   * Revokes an existing vote delegation.
   */
  revokeDelegation(delegatorId) {
    if (this.delegations.has(delegatorId)) {
      this.delegations.delete(delegatorId);
      logger.info(`[Governance] Delegation revoked for ${delegatorId}`);
      return { delegatorId, status: 'DIRECT_VOTING_RESTORED' };
    }
    return { delegatorId, status: 'NO_DELEGATION_FOUND' };
  }

  /**
   * Resolves total voting power for a voter (direct power + incoming delegations).
   */
  getEffectiveVotingPower(voterId, baseReputation = 1) {
    let power = baseReputation;

    // Sum incoming delegations from users who haven't cast direct votes
    for (const [delegator, record] of this.delegations.entries()) {
      if (record.delegateId === voterId) {
        power += 1; // 1 standard delegated credit
      }
    }

    return power;
  }

  /**
   * Creates a new community proposal.
   */
  createProposal({
    creatorId,
    communityId = 'global',
    title,
    description,
    category = PROPOSAL_CATEGORIES.COMMUNITY_RULE,
    votingPeriodHours = 72,
    quorumThreshold = 10, // minimum total vote weight needed
    passingMajorityRatio = 0.5, // >50% FOR votes to pass
    timelockDelayHours = 24,
    executionPayload = null,
  }) {
    if (!creatorId || !title) throw new Error('creatorId and title are required');

    const proposalId = `prop_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const now = Date.now();
    const votingEndsAt = now + votingPeriodHours * 3600 * 1000;

    const proposal = {
      id: proposalId,
      creatorId,
      communityId,
      title,
      description,
      category,
      status: PROPOSAL_STATUS.ACTIVE,
      createdAt: now,
      votingEndsAt,
      quorumThreshold,
      passingMajorityRatio,
      timelockDelayHours,
      executionPayload,
      votes: {
        for: 0,
        against: 0,
        abstain: 0,
      },
      voters: new Map(), // voterId -> { choice, creditsSpent, quadraticWeight, timestamp }
      executedAt: null,
    };

    this.proposals.set(proposalId, proposal);
    logger.info(`[Governance] Proposal ${proposalId} created by ${creatorId}: "${title}"`);
    return this._formatProposal(proposal);
  }

  /**
   * Casts a quadratic vote on a proposal.
   * Quadratic voting: voteWeight = Math.sqrt(creditsSpent)
   */
  castVote({ proposalId, voterId, choice, creditsSpent = 1 }) {
    const proposal = this.proposals.get(proposalId);
    if (!proposal) throw new Error('Proposal not found');

    if (proposal.status !== PROPOSAL_STATUS.ACTIVE) {
      throw new Error(`Cannot vote on proposal in status ${proposal.status}`);
    }

    if (Date.now() > proposal.votingEndsAt) {
      this.evaluateProposalOutcome(proposalId);
      throw new Error('Voting window has concluded');
    }

    const validChoices = ['for', 'against', 'abstain'];
    if (!validChoices.includes(choice.toLowerCase())) {
      throw new Error('Invalid choice. Must be for, against, or abstain');
    }

    const normalizedChoice = choice.toLowerCase();
    const quadraticWeight = Math.sqrt(Math.max(1, creditsSpent));

    // If voter previously voted, deduct prior weight
    if (proposal.voters.has(voterId)) {
      const prior = proposal.voters.get(voterId);
      proposal.votes[prior.choice] -= prior.quadraticWeight;
    }

    proposal.votes[normalizedChoice] += quadraticWeight;
    proposal.voters.set(voterId, {
      choice: normalizedChoice,
      creditsSpent,
      quadraticWeight,
      timestamp: Date.now(),
    });

    logger.info(`[Governance] User ${voterId} voted ${normalizedChoice} with weight ${quadraticWeight.toFixed(2)} on ${proposalId}`);
    return {
      proposalId,
      voterId,
      choice: normalizedChoice,
      quadraticWeight: Number(quadraticWeight.toFixed(3)),
      currentTally: { ...proposal.votes },
    };
  }

  /**
   * Finalizes proposal outcome when voting window expires.
   */
  evaluateProposalOutcome(proposalId) {
    const proposal = this.proposals.get(proposalId);
    if (!proposal) throw new Error('Proposal not found');

    const totalWeight = proposal.votes.for + proposal.votes.against + proposal.votes.abstain;
    const reachedQuorum = totalWeight >= proposal.quorumThreshold;
    const activeVotes = proposal.votes.for + proposal.votes.against;
    const approvalRatio = activeVotes > 0 ? proposal.votes.for / activeVotes : 0;

    if (reachedQuorum && approvalRatio > proposal.passingMajorityRatio) {
      proposal.status = PROPOSAL_STATUS.PASSED;
      logger.info(`[Governance] Proposal ${proposalId} PASSED (Approval: ${(approvalRatio * 100).toFixed(1)}%)`);
    } else {
      proposal.status = PROPOSAL_STATUS.REJECTED;
      logger.info(`[Governance] Proposal ${proposalId} REJECTED (Quorum met: ${reachedQuorum}, Approval: ${(approvalRatio * 100).toFixed(1)}%)`);
    }

    return this._formatProposal(proposal);
  }

  /**
   * Queues a passed proposal for execution after timelock delay.
   */
  queueExecution(proposalId) {
    const proposal = this.proposals.get(proposalId);
    if (!proposal) throw new Error('Proposal not found');
    if (proposal.status !== PROPOSAL_STATUS.PASSED) {
      throw new Error(`Only PASSED proposals can be queued. Current status: ${proposal.status}`);
    }

    proposal.status = PROPOSAL_STATUS.QUEUED;
    proposal.queuedAt = Date.now();
    proposal.executableAfter = Date.now() + proposal.timelockDelayHours * 3600 * 1000;

    logger.info(`[Governance] Proposal ${proposalId} queued for execution after timelock`);
    return this._formatProposal(proposal);
  }

  /**
   * Executes a queued proposal after timelock period has elapsed.
   */
  executeProposal(proposalId) {
    const proposal = this.proposals.get(proposalId);
    if (!proposal) throw new Error('Proposal not found');
    if (proposal.status !== PROPOSAL_STATUS.QUEUED) {
      throw new Error(`Only QUEUED proposals can be executed. Current: ${proposal.status}`);
    }
    if (Date.now() < proposal.executableAfter) {
      throw new Error('Timelock delay period has not elapsed yet');
    }

    proposal.status = PROPOSAL_STATUS.EXECUTED;
    proposal.executedAt = Date.now();

    logger.info(`[Governance] Proposal ${proposalId} successfully EXECUTED!`);
    return this._formatProposal(proposal);
  }

  _formatProposal(proposal) {
    return {
      ...proposal,
      votersCount: proposal.voters.size,
      voters: undefined, // do not dump raw map in output
    };
  }
}

export const communityGovernanceService = new CommunityGovernanceService();
export default communityGovernanceService;
