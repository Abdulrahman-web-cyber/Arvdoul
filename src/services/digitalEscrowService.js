/**
 * src/services/digitalEscrowService.js - ARVDOUL DIGITAL GOODS ESCROW & MILESTONE CONTRACTS v1.0
 * 
 * Production-grade creator sponsorship & commissioned work escrow:
 * • Milestone-based escrow contracts (sponsorships, collaborations, digital assets)
 * • Finite state machine (CREATED ➔ FUNDED ➔ IN_PROGRESS ➔ DELIVERED ➔ RELEASED / DISPUTED / REFUNDED)
 * • Multi-party dispute arbitration & proportional split refunds
 * • Balance conservation invariants (Funded === Released + Refunded + PlatformFee)
 */

import { logger } from '../utils/Logger.js';

export const ESCROW_STATUS = {
  CREATED: 'CREATED',
  FUNDED: 'FUNDED',
  IN_PROGRESS: 'IN_PROGRESS',
  DELIVERED: 'DELIVERED',
  RELEASED: 'RELEASED',
  DISPUTED: 'DISPUTED',
  REFUNDED: 'REFUNDED',
};

export const DEFAULT_PLATFORM_FEE_BPS = 250; // 2.5%

export class DigitalEscrowService {
  constructor(platformFeeBps = DEFAULT_PLATFORM_FEE_BPS) {
    this.platformFeeBps = platformFeeBps;
    this.contracts = new Map(); // contractId -> contractState
  }

  /**
   * Creates a new milestone-based escrow contract.
   */
  createContract({
    buyerId,
    sellerId,
    title,
    description = '',
    totalAmount,
    milestones = [],
    autoReleaseDays = 7,
  }) {
    if (!buyerId || !sellerId) throw new Error('buyerId and sellerId are required');
    if (!totalAmount || totalAmount <= 0) throw new Error('totalAmount must be greater than 0');
    if (buyerId === sellerId) throw new Error('buyerId and sellerId cannot be the same account');

    const contractId = `escrow_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    
    // Normalize milestones or create single 100% milestone
    const normalizedMilestones = milestones.length > 0 
      ? milestones.map((m, idx) => ({
          id: `m_${idx + 1}`,
          title: m.title || `Milestone ${idx + 1}`,
          amount: m.amount,
          status: 'PENDING',
        }))
      : [{
          id: 'm_1',
          title: 'Full Delivery',
          amount: totalAmount,
          status: 'PENDING',
        }];

    // Verify milestone sum
    const milestoneTotal = normalizedMilestones.reduce((acc, m) => acc + m.amount, 0);
    if (Math.abs(milestoneTotal - totalAmount) > 0.001) {
      throw new Error(`Milestone sum (${milestoneTotal}) must equal totalAmount (${totalAmount})`);
    }

    const contract = {
      id: contractId,
      buyerId,
      sellerId,
      title,
      description,
      totalAmount,
      fundedAmount: 0,
      releasedAmount: 0,
      refundedAmount: 0,
      feeCollected: 0,
      status: ESCROW_STATUS.CREATED,
      milestones: normalizedMilestones,
      autoReleaseDays,
      createdAt: Date.now(),
      deliverables: [],
      history: [
        { status: ESCROW_STATUS.CREATED, timestamp: Date.now(), actor: buyerId }
      ],
    };

    this.contracts.set(contractId, contract);
    logger.info(`[Escrow] Contract ${contractId} created: ${title} (${totalAmount} coins)`);
    return contract;
  }

  /**
   * Funds the escrow contract from buyer's coin balance.
   */
  fundContract(contractId, buyerId, amount) {
    const contract = this._getContract(contractId);
    if (contract.status !== ESCROW_STATUS.CREATED) {
      throw new Error(`Contract cannot be funded in state ${contract.status}`);
    }
    if (contract.buyerId !== buyerId) {
      throw new Error('Only the contract buyer can fund this escrow');
    }
    if (amount !== contract.totalAmount) {
      throw new Error(`Funding amount (${amount}) must exactly equal contract total (${contract.totalAmount})`);
    }

    contract.fundedAmount = amount;
    contract.status = ESCROW_STATUS.FUNDED;
    contract.history.push({ status: ESCROW_STATUS.FUNDED, timestamp: Date.now(), actor: buyerId });

    logger.info(`[Escrow] Contract ${contractId} fully funded with ${amount} coins`);
    return contract;
  }

  /**
   * Seller accepts and begins work.
   */
  startWork(contractId, sellerId) {
    const contract = this._getContract(contractId);
    if (contract.sellerId !== sellerId) throw new Error('Only the seller can start work');
    if (contract.status !== ESCROW_STATUS.FUNDED) {
      throw new Error(`Contract must be FUNDED to start work. Current: ${contract.status}`);
    }

    contract.status = ESCROW_STATUS.IN_PROGRESS;
    contract.history.push({ status: ESCROW_STATUS.IN_PROGRESS, timestamp: Date.now(), actor: sellerId });
    return contract;
  }

  /**
   * Seller submits deliverable for review.
   */
  submitDeliverable(contractId, sellerId, deliverableData) {
    const contract = this._getContract(contractId);
    if (contract.sellerId !== sellerId) throw new Error('Only seller can submit deliverables');
    if (![ESCROW_STATUS.IN_PROGRESS, ESCROW_STATUS.DELIVERED].includes(contract.status)) {
      throw new Error(`Cannot submit deliverable in status ${contract.status}`);
    }

    contract.deliverables.push({
      ...deliverableData,
      submittedAt: Date.now(),
    });
    contract.status = ESCROW_STATUS.DELIVERED;
    contract.history.push({ status: ESCROW_STATUS.DELIVERED, timestamp: Date.now(), actor: sellerId });

    logger.info(`[Escrow] Deliverable submitted for contract ${contractId}`);
    return contract;
  }

  /**
   * Buyer approves milestone or full contract and releases funds to seller.
   */
  releaseMilestone(contractId, buyerId, milestoneId) {
    const contract = this._getContract(contractId);
    if (contract.buyerId !== buyerId) throw new Error('Only buyer can release escrow funds');
    if (![ESCROW_STATUS.FUNDED, ESCROW_STATUS.IN_PROGRESS, ESCROW_STATUS.DELIVERED].includes(contract.status)) {
      throw new Error(`Cannot release funds in status ${contract.status}`);
    }

    const milestone = contract.milestones.find(m => m.id === milestoneId);
    if (!milestone) throw new Error(`Milestone ${milestoneId} not found`);
    if (milestone.status === 'RELEASED') throw new Error('Milestone already released');

    // Calculate platform fee
    const fee = Math.floor((milestone.amount * this.platformFeeBps) / 10000);
    const netSellerAmount = milestone.amount - fee;

    milestone.status = 'RELEASED';
    contract.releasedAmount += netSellerAmount;
    contract.feeCollected += fee;

    const allMilestonesReleased = contract.milestones.every(m => m.status === 'RELEASED');
    if (allMilestonesReleased) {
      contract.status = ESCROW_STATUS.RELEASED;
    }

    contract.history.push({
      status: contract.status,
      timestamp: Date.now(),
      actor: buyerId,
      milestoneId,
      netSellerAmount,
      fee,
    });

    logger.info(`[Escrow] Milestone ${milestoneId} released: ${netSellerAmount} to seller, ${fee} fee`);
    return contract;
  }

  /**
   * Initiates a dispute by either party.
   */
  raiseDispute(contractId, actorId, reason) {
    const contract = this._getContract(contractId);
    if (contract.buyerId !== actorId && contract.sellerId !== actorId) {
      throw new Error('Only buyer or seller can dispute contract');
    }
    if (contract.status === ESCROW_STATUS.RELEASED || contract.status === ESCROW_STATUS.REFUNDED) {
      throw new Error('Completed contracts cannot be disputed');
    }

    contract.status = ESCROW_STATUS.DISPUTED;
    contract.disputeReason = reason;
    contract.disputeInitiatedBy = actorId;
    contract.history.push({ status: ESCROW_STATUS.DISPUTED, timestamp: Date.now(), actor: actorId, reason });

    logger.warn(`[Escrow] Dispute raised on ${contractId} by ${actorId}: ${reason}`);
    return contract;
  }

  /**
   * Arbitrates dispute with split settlement. Enforces balance conservation.
   */
  resolveDispute(contractId, arbiterId, { buyerRefundAmount, sellerReleaseAmount }) {
    const contract = this._getContract(contractId);
    if (contract.status !== ESCROW_STATUS.DISPUTED) {
      throw new Error('Contract is not under active dispute');
    }

    const remainingHold = contract.fundedAmount - (contract.releasedAmount + contract.refundedAmount + contract.feeCollected);
    const proposedTotal = (buyerRefundAmount || 0) + (sellerReleaseAmount || 0);

    if (Math.abs(proposedTotal - remainingHold) > 0.001) {
      throw new Error(`Resolution sum (${proposedTotal}) must equal remaining held escrow (${remainingHold})`);
    }

    const sellerFee = Math.floor(((sellerReleaseAmount || 0) * this.platformFeeBps) / 10000);
    const netSeller = (sellerReleaseAmount || 0) - sellerFee;

    contract.refundedAmount += buyerRefundAmount || 0;
    contract.releasedAmount += netSeller;
    contract.feeCollected += sellerFee;
    contract.status = (buyerRefundAmount > 0 && sellerReleaseAmount === 0) 
      ? ESCROW_STATUS.REFUNDED 
      : ESCROW_STATUS.RELEASED;

    contract.history.push({
      status: 'RESOLVED',
      timestamp: Date.now(),
      arbiterId,
      buyerRefundAmount,
      sellerReleaseAmount: netSeller,
      sellerFee,
    });

    logger.info(`[Escrow] Dispute resolved for ${contractId}: Buyer refund=${buyerRefundAmount}, Seller=${netSeller}`);
    return contract;
  }

  _getContract(contractId) {
    const contract = this.contracts.get(contractId);
    if (!contract) throw new Error(`Escrow contract ${contractId} does not exist`);
    return contract;
  }
}

export const digitalEscrowService = new DigitalEscrowService();
export default digitalEscrowService;
