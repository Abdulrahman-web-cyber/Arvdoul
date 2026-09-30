// src/services/walletService.js — ARVDOUL WALLET & ECONOMIC LEDGER (Part 2)
// Double-entry, ledger-backed, multi-state transactions.

import { TRANSACTION_STATES } from './levelSystemService.js';
import { getFirestoreInstance } from '../firebase/firebase.js';
import { collection, query, where, orderBy, limit, getDocs, doc, getDoc } from 'firebase/firestore';
import { logger } from '../utils/Logger.js';
import monetizationService from './monetizationService.js';

class WalletService {
  /**
   * Returns current wallet balances and economic projections.
   */
  async getWalletOverview(userId) {
    if (!userId) return null;

    try {
      const db = await getFirestoreInstance();
      const userSnap = await getDoc(doc(db, 'users', userId));
      const userData = userSnap.exists() ? userSnap.data() : {};

      const coins = Number(userData.coins || userData.coinBalance || 0);
      const totalEarned = Number(userData.totalEarned || userData.lifetimeCoinsEarned || 0);
      const totalSpent = Number(userData.totalSpent || 0);

      // Fetch pending withdrawals to compute held balance
      let pendingWithdrawals = 0;
      try {
        const wCol = collection(db, 'withdrawal_requests');
        const wQ = query(wCol, where('userId', '==', userId), where('status', 'in', ['pending', 'processing']));
        const wSnap = await getDocs(wQ);
        wSnap.forEach((d) => {
          pendingWithdrawals += Number(d.data().amount || 0);
        });
      } catch (e) {
        // withdrawal query may fail if index missing or unauthed
      }

      return {
        userId,
        coins,
        availableCoins: Math.max(0, coins - pendingWithdrawals),
        pendingCoins: pendingWithdrawals,
        heldCoins: 0,
        totalEarned,
        totalSpent,
        monetizationEligible: Boolean(userData.monetizationEligible || userData.isCreator),
        currency: 'COINS',
      };
    } catch (err) {
      logger.error('[WalletService] getWalletOverview failed:', { userId, error: err.message });
      throw err;
    }
  }

  /**
   * Fetch recent ledger transactions for the user.
   */
  async getTransactions(userId, maxResults = 25) {
    if (!userId) return [];

    try {
      const db = await getFirestoreInstance();
      const txCol = collection(db, 'coin_transactions');
      const q = query(
        txCol,
        where('userId', '==', userId),
        orderBy('createdAt', 'desc'),
        limit(maxResults)
      );

      const snap = await getDocs(q);
      return snap.docs.map((d) => {
        const item = d.data();
        return {
          id: d.id,
          ...item,
          status: item.status || TRANSACTION_STATES.COMPLETED,
          createdAt: item.createdAt?.toDate?.() || new Date(),
        };
      });
    } catch (err) {
      logger.warn('[WalletService] getTransactions fallback:', { userId, error: err.message });
      return [];
    }
  }

  /**
   * Submit withdrawal request via monetization engine.
   */
  async requestPayout(userId, amountCoins, details = {}) {
    return monetizationService.requestWithdrawal(userId, amountCoins, details);
  }
}

export const walletService = new WalletService();
export default walletService;
