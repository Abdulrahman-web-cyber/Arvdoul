/**
 * src/services/revenueSplitsService.js - ARVDOUL CREATOR REVENUE SPLITS & SYNDICATE ENGINE v1.0
 * 
 * Production-grade revenue distribution & collaborative splits:
 * • Basis points precision (10,000 bps = 100.00%) for multi-creator collaborations
 * • Zero-remainder exact routing: mathematical guarantee that sum(payouts) + fee === gross
 * • Syndicate treasury allocations for shared creator collectives
 * • Immutable event ledger and distribution receipts
 */

import { logger } from '../utils/Logger.js';

export const SPLIT_ROLES = {
  PRIMARY_CREATOR: 'PRIMARY_CREATOR',
  CO_CREATOR: 'CO_CREATOR',
  EDITOR: 'EDITOR',
  GUEST: 'GUEST',
  SYNDICATE_TREASURY: 'SYNDICATE_TREASURY',
};

export class RevenueSplitsService {
  constructor(defaultPlatformFeeBps = 250) {
    this.platformFeeBps = defaultPlatformFeeBps; // 2.5%
    this.contracts = new Map(); // splitContractId -> contract
    this.distributionHistory = [];
  }

  /**
   * Registers a multi-creator revenue split contract.
   */
  createSplitContract({
    creatorId,
    title,
    recipients = [], // Array of { recipientId, basisPoints, role }
    contentId = null,
  }) {
    if (!creatorId || !title) throw new Error('creatorId and title are required');
    if (!Array.isArray(recipients) || recipients.length === 0) {
      throw new Error('At least one recipient is required in split contract');
    }

    // Verify basis points sum exactly to 10,000 (100%)
    const totalBps = recipients.reduce((acc, r) => acc + (r.basisPoints || 0), 0);
    if (totalBps !== 10000) {
      throw new Error(`Total basis points (${totalBps}) must equal exactly 10,000 (100%)`);
    }

    const contractId = `split_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const contract = {
      id: contractId,
      creatorId,
      title,
      contentId,
      recipients: recipients.map(r => ({
        recipientId: r.recipientId,
        basisPoints: r.basisPoints,
        role: r.role || SPLIT_ROLES.CO_CREATOR,
      })),
      createdAt: Date.now(),
      totalDistributedGross: 0,
      totalDistributedNet: 0,
    };

    this.contracts.set(contractId, contract);
    logger.info(`[RevenueSplits] Contract ${contractId} registered: "${title}" with ${recipients.length} recipients`);
    return contract;
  }

  /**
   * Processes incoming revenue through the split contract.
   * Enforces zero-remainder mathematical balance conservation.
   */
  distributeRevenue({ splitContractId, grossAmount, source = 'TIP', payerId = null }) {
    const contract = this.contracts.get(splitContractId);
    if (!contract) throw new Error(`Split contract ${splitContractId} not found`);
    if (!grossAmount || grossAmount <= 0) throw new Error('grossAmount must be greater than 0');

    // Platform fee calculation
    const platformFee = Math.floor((grossAmount * this.platformFeeBps) / 10000);
    const netPool = grossAmount - platformFee;

    // Distribute net amount according to bps
    let allocatedTotal = 0;
    const payouts = contract.recipients.map((recipient, index) => {
      let amount = Math.floor((netPool * recipient.basisPoints) / 10000);
      allocatedTotal += amount;
      return {
        recipientId: recipient.recipientId,
        role: recipient.role,
        basisPoints: recipient.basisPoints,
        amount,
      };
    });

    // Zero-remainder guarantee: assign any fractional rounding residue to the first recipient (primary)
    const residue = netPool - allocatedTotal;
    if (residue > 0) {
      payouts[0].amount += residue;
      allocatedTotal += residue;
    }

    // Invariant check: gross === platformFee + netPool
    if (allocatedTotal + platformFee !== grossAmount) {
      throw new Error(`Accounting invariant violation: ${allocatedTotal} + ${platformFee} !== ${grossAmount}`);
    }

    contract.totalDistributedGross += grossAmount;
    contract.totalDistributedNet += allocatedTotal;

    const receipt = {
      receiptId: `rcpt_split_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      splitContractId,
      grossAmount,
      platformFee,
      netPool: allocatedTotal,
      source,
      payerId,
      timestamp: Date.now(),
      payouts,
    };

    this.distributionHistory.push(receipt);
    logger.info(`[RevenueSplits] Distributed ${grossAmount} gross across ${payouts.length} recipients. Receipt: ${receipt.receiptId}`);
    return receipt;
  }

  /**
   * Retrieves summary analytics for a split contract.
   */
  getContractSummary(splitContractId) {
    const contract = this.contracts.get(splitContractId);
    if (!contract) throw new Error('Contract not found');

    const contractReceipts = this.distributionHistory.filter(h => h.splitContractId === splitContractId);
    const recipientTotals = {};
    for (const r of contract.recipients) {
      recipientTotals[r.recipientId] = 0;
    }

    for (const receipt of contractReceipts) {
      for (const p of receipt.payouts) {
        recipientTotals[p.recipientId] = (recipientTotals[p.recipientId] || 0) + p.amount;
      }
    }

    return {
      contractId: contract.id,
      title: contract.title,
      creatorId: contract.creatorId,
      recipients: contract.recipients,
      totalDistributedGross: contract.totalDistributedGross,
      totalDistributedNet: contract.totalDistributedNet,
      totalTransactions: contractReceipts.length,
      recipientTotals,
    };
  }
}

export const revenueSplitsService = new RevenueSplitsService();
export default revenueSplitsService;
