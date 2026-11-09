// src/services/walletService.js
//
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

      // `lockedCoins` is the server's authoritative hold (functions/monetization.js
      // requestWithdrawal increments it in the same transaction that writes the
      // request). Availability MUST be derived from it, not by summing request
      // rows: the previous query only counted ['pending','processing'] and so
      // ignored `pending_review`, letting the wallet advertise more spendable
      // coins than the server would actually allow. The query is now display-only.
      const lockedCoins = Number(userData.lockedCoins || 0);

      // Fetch pending withdrawals for the itemised breakdown only.
      let pendingWithdrawals = 0;
      try {
        const wCol = collection(db, 'withdrawal_requests');
        const wQ = query(
          wCol,
          where('userId', '==', userId),
          where('status', 'in', ['pending', 'pending_review', 'processing']),
          limit(100)
        );
        const wSnap = await getDocs(wQ);
        wSnap.forEach((d) => {
          pendingWithdrawals += Number(d.data().amount || 0);
        });
      } catch (e) {
        // The pending-withdrawal total feeds the available balance, so a failed
        // read must be visible rather than silently showing the full balance.
        logger.warn('Pending withdrawals read failed; available balance may be overstated', { userId, error: e?.message });
      }

      return {
        userId,
        coins,
        availableCoins: Math.max(0, coins - lockedCoins),
        pendingCoins: pendingWithdrawals,
        heldCoins: lockedCoins,
        totalEarned,
        totalSpent,
        monetizationEligible: Boolean(userData.monetizationEligible || userData.isCreator),
        // Raw identity fields the withdrawal gate needs. The level gate itself
        // is evaluated with the canonical `getCreatorCapabilities`, never a
        // local `level >= N` comparison.
        // Null (not 1) when the profile has no level, so the screen's honest
        // "your level is not yet available" branch is reachable instead of a
        // fabricated "you are Level 1".
        level: Number(userData.level) || null,
        isVerified: Boolean(userData.isVerified || userData.verified),
        isCreator: Boolean(userData.isCreator),
        creatorTier: userData.creatorTier || userData.creatorStatus || null,
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
