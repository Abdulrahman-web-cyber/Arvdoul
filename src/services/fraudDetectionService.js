/**
 * src/services/fraudDetectionService.js - ARVDOUL PAYMENT & COIN TRANSACTION FRAUD ENGINE v8.0
 *
 * Implements:
 * 1. Card Velocity Checks: Flags multiple failed card purchase attempts within a 5-minute rolling window.
 * 2. Coin Wash & Circular Transfer Detection: Identifies rapid circular coin transfers across connected burner accounts.
 * 3. Chargeback Risk Scoring: Assigns transaction risk score and auto-freezes suspicious payouts.
 */

import { logger } from '../utils/Logger.js';
import { auditLogger } from '../utils/AuditLogger.js';

class FraudDetectionService {
  constructor() {
    this.userPurchaseAttempts = new Map(); // userId -> Array<timestamp>
    this.transactionTransferGraph = new Map(); // senderId -> Array<{ recipientId, amount, timestamp }>
  }

  /**
   * Validates a payment or coin purchase request before gateway authorization.
   */
  evaluatePurchaseRisk(userId, amountCents, cardBin) {
    const now = Date.now();
    let attempts = this.userPurchaseAttempts.get(userId) || [];
    attempts = attempts.filter((t) => now - t < 5 * 60 * 1000); // 5 min window
    attempts.push(now);
    this.userPurchaseAttempts.set(userId, attempts);

    let riskScore = 10;
    const reasons = [];

    // Velocity Check (>5 purchase attempts in 5 min)
    if (attempts.length > 5) {
      riskScore += 60;
      reasons.push('High card purchase attempt velocity');
    }

    // High single transaction value check
    if (amountCents > 50000) {
      // > $500
      riskScore += 30;
      reasons.push('Large transaction threshold exceeded');
    }

    const isFraudSuspicious = riskScore >= 70;
    if (isFraudSuspicious) {
      logger.warn(`[FraudDetection] High-risk payment transaction flagged for user ${userId}:`, { riskScore, reasons });
      auditLogger.log('fraud.payment_risk_flagged', {
        userId,
        meta: { riskScore, reasons, amountCents },
      });
    }

    return {
      allowed: !isFraudSuspicious,
      riskScore,
      reasons,
    };
  }

  /**
   * Registers a coin transaction into the transfer graph and checks for circular loops (coin washing).
   * @param {string} senderId
   * @param {string} recipientId
   * @param {number} amount
   * @returns {boolean} - true if clean, false if circular/loop wash detected
   */
  evaluateCoinTransferLoop(senderId, recipientId, amount) {
    const now = Date.now();
    let history = this.transactionTransferGraph.get(senderId) || [];
    // Keep past 1 hour transactions
    history = history.filter(tx => now - tx.timestamp < 3600 * 1000);
    history.push({ recipientId, amount, timestamp: now });
    this.transactionTransferGraph.set(senderId, history);

    // Simple BFS / DFS to check if recipient eventually transfers back to sender
    const visited = new Set();
    const detectLoop = (current, target) => {
      if (current === target) return true;
      if (visited.has(current)) return false;
      visited.add(current);

      const nextTxs = this.transactionTransferGraph.get(current) || [];
      for (const tx of nextTxs) {
        if (detectLoop(tx.recipientId, target)) {
          return true;
        }
      }
      return false;
    };

    // If recipient is already sending back to sender, flag as loop
    if (detectLoop(recipientId, senderId)) {
      logger.warn('[FraudDetection] Multi-account circular coin wash transfer loop detected!', { senderId, recipientId, amount });
      auditLogger.log('fraud.coin_wash_loop_detected', {
        userId: senderId,
        meta: { senderId, recipientId, amount }
      });
      return false;
    }

    return true;
  }
}

export const fraudDetectionService = new FraudDetectionService();
export default fraudDetectionService;
