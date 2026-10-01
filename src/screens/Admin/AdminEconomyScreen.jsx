// src/screens/Admin/AdminEconomyScreen.jsx - ARVDOUL ECONOMY OVERSIGHT & LEDGER
// ✅ Platform coin liquidity, revenue, and treasury oversight
// ✅ Payout review, approval, and rejection workflow with audit logging
// ✅ Real-time transaction ledger explorer

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import {
  ArrowLeft,
  Coins,
  DollarSign,
  TrendingUp,
  Search,
  RefreshCw,
  Clock,
  ShieldCheck,
  ChevronRight,
  Wallet,
  ArrowUpRight,
  ArrowDownLeft,
} from 'lucide-react';
import { callFunction, FUNCTIONS } from '../../services/callableService.js';
import { COINS_PER_DOLLAR, getRankTitle } from '../../services/levelSystemService.js';

const AdminEconomyScreen = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'payouts' | 'transactions'
  const [searchQuery, setSearchQuery] = useState('');
  const [payoutFilter, setPayoutFilter] = useState('pending'); // 'all' | 'pending' | 'completed' | 'rejected'

  // Metric states — populated from the admin-only getEconomySummary callable.
  // null means "unknown" and renders as such; never a placeholder number.
  const [metrics, setMetrics] = useState({
    circulatingCoins: null,
    treasuryReserveUsd: null,
    pendingPayoutCoins: null,
    pendingPayoutCount: null,
    completedPayoutCoins: null,
    monthlyVolumeCoins: null,
  });

  // Payout queue — live withdrawal_requests only.
  const [payouts, setPayouts] = useState([]);

  // Recent transaction ledger — live coin_transactions only.
  const [transactions, setTransactions] = useState([]);

  // Load live data: the admin summary comes from the server (aggregates over
  // users/coin_transactions that the client cannot compute), the queues come
  // from the collections the admin rules allow.
  const loadData = useCallback(async () => {
    setRefreshing(true);
    try {
      const { collection, getDocs, query, limit, orderBy } = await import('firebase/firestore');
      const { getFirestoreInstance } = await import('../../firebase/firebase.js');
      const firestore = await getFirestoreInstance();

      const summary = await callFunction(FUNCTIONS.GET_ECONOMY_SUMMARY);
      if (summary?.success) {
        setMetrics({
          circulatingCoins: summary.circulatingCoins,
          treasuryReserveUsd: summary.treasuryReserveUsd,
          pendingPayoutCoins: summary.pendingPayoutCoins,
          pendingPayoutCount: summary.pendingPayoutCount,
          completedPayoutCoins: summary.completedPayoutCoins,
          monthlyVolumeCoins: summary.monthlyVolumeCoins,
        });
      }

      // The withdrawal_requests rules let an admin read every request.
      try {
        const snap = await getDocs(
          query(collection(firestore, 'withdrawal_requests'), orderBy('createdAt', 'desc'), limit(100))
        );
        setPayouts(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch {
        setPayouts([]);
      }

      // A user's own entries are readable; the admin branch of the rules widens
      // this to the platform ledger.
      try {
        const txSnap = await getDocs(
          query(collection(firestore, 'coin_transactions'), orderBy('createdAt', 'desc'), limit(100))
        );
        setTransactions(txSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch {
        setTransactions([]);
      }
    } catch {
      toast.error('Could not sync live economy data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Payout approval runs through the server: only the server can call Stripe
  // and debit locked coins. The client never writes a payout status.
  const handleApprovePayout = async payoutId => {
    try {
      const payout = payouts.find(p => p.id === payoutId);
      if (!payout) return;

      const result = await callFunction(FUNCTIONS.ADMIN_DECIDE_WITHDRAWAL, {
        withdrawalId: payoutId,
        action: 'approve',
      });
      if (!result?.success) throw new Error(result?.error || 'Settlement failed');

      setPayouts(prev => prev.map(p => (
        p.id === payoutId ? { ...p, status: 'completed', stripePayoutId: result.payoutId } : p
      )));
      toast.success(`Payout of $${Number(result.usdAmount || 0).toFixed(2)} sent.`);
      loadData();
    } catch (err) {
      toast.error(err?.message || 'Failed to approve payout request');
    }
  };

  // Payout rejection also runs server-side so the locked coins are released.
  const handleRejectPayout = async payoutId => {
    const reason = window.prompt('Enter rejection reason for creator notification:');
    if (!reason) return;

    try {
      const result = await callFunction(FUNCTIONS.ADMIN_DECIDE_WITHDRAWAL, {
        withdrawalId: payoutId,
        action: 'reject',
        reason,
      });
      if (!result?.success) throw new Error(result?.error || 'Settlement failed');

      setPayouts(prev => prev.map(p => (
        p.id === payoutId ? { ...p, status: 'rejected', rejectionReason: reason } : p
      )));
      toast.info(`Payout request rejected: ${reason}`);
      loadData();
    } catch (err) {
      toast.error(err?.message || 'Failed to reject payout');
    }
  };

  // Both 'pending' and 'pending_review' are awaiting an admin decision.
  const isAwaitingReview = status => status === 'pending' || status === 'pending_review';
  const filteredPayouts = payouts.filter(p => {
    if (payoutFilter === 'all') return true;
    return isAwaitingReview(p.status) ? payoutFilter === 'pending' : p.status === payoutFilter;
  });

  const filteredTransactions = transactions.filter(t => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      String(t.id).toLowerCase().includes(q) ||
      String(t.userId || '').toLowerCase().includes(q) ||
      String(t.type || '').toLowerCase().includes(q) ||
      String(t.reason || '').toLowerCase().includes(q)
    );
  });

  return (
    <div id="admin-economy-screen" className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100">
      {/* Top Navigation */}
      <div id="economy-top-bar" className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              id="back-to-admin-dashboard"
              onClick={() => navigate('/admin')}
              className="p-2 rounded-xl text-gray-500 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 transition"
              aria-label="Back to Admin Dashboard"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Economy Oversight</h1>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300">
                  Treasury Active
                </span>
              </div>
              <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                Tokenomics, coin liquidity, fees, and creator payout ledger
              </p>
            </div>
          </div>
          <button
            id="refresh-economy-btn"
            onClick={loadData}
            disabled={refreshing}
            className="flex items-center gap-2 px-3.5 py-2 text-sm font-medium bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-xl transition disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Sync Data</span>
          </button>
        </div>

        {/* Tab Selection */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex gap-6 border-t border-gray-100 dark:border-gray-700/50">
          <button
            id="tab-overview"
            onClick={() => setActiveTab('overview')}
            className={`py-3 text-sm font-medium border-b-2 transition ${
              activeTab === 'overview'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-gray-500 hover:text-gray-900 dark:hover:text-gray-300'
            }`}
          >
            Treasury & Reserves
          </button>
          <button
            id="tab-payouts"
            onClick={() => setActiveTab('payouts')}
            className={`py-3 text-sm font-medium border-b-2 flex items-center gap-2 transition ${
              activeTab === 'payouts'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-gray-500 hover:text-gray-900 dark:hover:text-gray-300'
            }`}
          >
            <span>Payout Queue</span>
            {payouts.filter(p => isAwaitingReview(p.status)).length > 0 && (
              <span className="px-2 py-0.5 text-xs rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 font-bold">
                {payouts.filter(p => isAwaitingReview(p.status)).length}
              </span>
            )}
          </button>
          <button
            id="tab-transactions"
            onClick={() => setActiveTab('transactions')}
            className={`py-3 text-sm font-medium border-b-2 transition ${
              activeTab === 'transactions'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-gray-500 hover:text-gray-900 dark:hover:text-gray-300'
            }`}
          >
            Ledger & Transactions
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {/* TAB 1: OVERVIEW & TREASURY */}
        {activeTab === 'overview' && (
          <div className="space-y-8">
            {/* KPI Cards — every value comes from getEconomySummary; null is
                shown as an explicit dash rather than a placeholder figure. */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              <div id="card-circulating-coins" className="bg-white dark:bg-gray-800 p-6 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Circulating Coins</span>
                  <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400">
                    <Coins className="w-5 h-5" />
                  </div>
                </div>
                <div className="text-3xl font-extrabold tracking-tight">
                  {metrics.circulatingCoins === null ? '—' : metrics.circulatingCoins.toLocaleString()}
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                  Sum of every citizen's coin balance
                </p>
              </div>

              <div id="card-treasury-balance" className="bg-white dark:bg-gray-800 p-6 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Reserve Liability (USD)</span>
                  <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400">
                    <DollarSign className="w-5 h-5" />
                  </div>
                </div>
                <div className="text-3xl font-extrabold tracking-tight">
                  {metrics.treasuryReserveUsd === null ? '—' : `$${metrics.treasuryReserveUsd.toLocaleString(undefined, { maximumFractionDigits: 2 })}`}
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                  Coin liability at {COINS_PER_DOLLAR} coins / $1
                </p>
              </div>

              <div id="card-pending-payouts" className="bg-white dark:bg-gray-800 p-6 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Awaiting Payouts</span>
                  <div className="p-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400">
                    <Clock className="w-5 h-5" />
                  </div>
                </div>
                <div className="text-3xl font-extrabold tracking-tight">
                  {metrics.pendingPayoutCount === null ? '—' : metrics.pendingPayoutCount}
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                  {metrics.pendingPayoutCoins === null
                    ? 'Locked coin value unavailable'
                    : `${metrics.pendingPayoutCoins.toLocaleString()} coins locked`}
                </p>
              </div>

              <div id="card-monthly-volume" className="bg-white dark:bg-gray-800 p-6 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-gray-500 dark:text-gray-400">30-Day Ledger Volume</span>
                  <div className="p-2.5 rounded-xl bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
                    <TrendingUp className="w-5 h-5" />
                  </div>
                </div>
                <div className="text-3xl font-extrabold tracking-tight">
                  {metrics.monthlyVolumeCoins === null ? '—' : metrics.monthlyVolumeCoins.toLocaleString()}
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                  Coins moved in the last 30 days
                </p>
              </div>
            </div>

            {/* Treasury oversight — real counters, and the only mutating
                action is a link into the audit trail. No simulated actions. */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div id="tokenomics-health-panel" className="bg-white dark:bg-gray-800 p-6 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm">
                <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-indigo-500" />
                  Ledger Integrity
                </h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3.5 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
                    <div>
                      <p className="font-semibold text-sm">Coin Liability (Circulating)</p>
                      <p className="text-xs text-gray-500">Owed to citizens from coin balances</p>
                    </div>
                    <span className="px-3 py-1 rounded-full text-xs font-bold bg-gray-200 text-gray-800 dark:bg-gray-600 dark:text-gray-100">
                      {metrics.circulatingCoins === null ? 'Unavailable' : `${metrics.circulatingCoins.toLocaleString()} coins`}
                    </span>
                  </div>

                  <div className="flex items-center justify-between p-3.5 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
                    <div>
                      <p className="font-semibold text-sm">Locked In Payouts</p>
                      <p className="text-xs text-gray-500">Coins reserved against open requests</p>
                    </div>
                    <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300">
                      {metrics.pendingPayoutCoins === null ? 'Unavailable' : `${metrics.pendingPayoutCoins.toLocaleString()} coins`}
                    </span>
                  </div>

                  <div className="flex items-center justify-between p-3.5 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
                    <div>
                      <p className="font-semibold text-sm">30-Day Ledger Movement</p>
                      <p className="text-xs text-gray-500">Sum of coin_transactions in the window</p>
                    </div>
                    <span className="px-3 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300">
                      {metrics.monthlyVolumeCoins === null ? 'Unavailable' : `${metrics.monthlyVolumeCoins.toLocaleString()} coins`}
                    </span>
                  </div>
                </div>
              </div>

              <div id="liquidity-operations-panel" className="bg-white dark:bg-gray-800 p-6 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm">
                <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                  <Wallet className="w-5 h-5 text-amber-500" />
                  Treasury Actions
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
                  Financial mutations are server-side only. Review the immutable trail of every
                  coin and payout event.
                </p>
                <div className="space-y-3">
                  <button
                    onClick={() => navigate('/admin/audit-logs')}
                    className="w-full flex items-center justify-between p-3.5 bg-indigo-50 dark:bg-indigo-900/20 hover:bg-indigo-100 dark:hover:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 font-medium rounded-xl transition"
                  >
                    <span>Open the Audit Trail</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => navigate('/admin/economy')}
                    className="w-full flex items-center justify-between p-3.5 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 font-medium rounded-xl transition"
                  >
                    <span>Refresh Ledger Aggregates</span>
                    <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: PAYOUT QUEUE */}
        {activeTab === 'payouts' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold">Creator Payout Requests</h2>
                <p className="text-xs text-gray-500">Review and disburse funds to verified creators</p>
              </div>

              {/* Filter Pills */}
              <div className="flex items-center gap-2 bg-gray-100 dark:bg-gray-800 p-1 rounded-xl">
                {['pending', 'completed', 'all'].map(status => (
                  <button
                    key={status}
                    onClick={() => setPayoutFilter(status)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition ${
                      payoutFilter === status
                        ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                        : 'text-gray-500 hover:text-gray-900 dark:hover:text-gray-200'
                    }`}
                  >
                    {status}
                  </button>
                ))}
              </div>
            </div>

            {/* Payouts Table */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-gray-50 dark:bg-gray-700/50 text-xs uppercase font-semibold text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                    <tr>
                      <th className="px-6 py-4">Creator</th>
                      <th className="px-6 py-4">Citizenship & Level</th>
                      <th className="px-6 py-4">Amount</th>
                      <th className="px-6 py-4">Payment Channel</th>
                      <th className="px-6 py-4">Risk Evaluation</th>
                      <th className="px-6 py-4">Status</th>
                      <th className="px-6 py-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {filteredPayouts.length === 0 && (
                      <tr>
                        <td colSpan={7} className="px-6 py-12 text-center text-sm text-gray-500 dark:text-gray-400">
                          {loading ? 'Loading payout queue…' : 'No payout requests match this filter.'}
                        </td>
                      </tr>
                    )}
                    {filteredPayouts.map(payout => (
                      <tr key={payout.id} className="hover:bg-gray-50/70 dark:hover:bg-gray-750 transition">
                        <td className="px-6 py-4">
                          <div className="font-semibold text-gray-900 dark:text-white font-mono text-xs">{payout.userId}</div>
                          <div className="text-xs text-gray-500 font-mono">{payout.id}</div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-300 mr-2">
                            {getRankTitle(payout.level || 0)}
                          </span>
                          <span className="text-xs text-gray-500">Lvl {payout.level ?? '—'}</span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="font-bold text-gray-900 dark:text-white">
                            ${(Number(payout.amount || 0) / COINS_PER_DOLLAR).toFixed(2)}
                          </div>
                          <div className="text-xs text-amber-600 font-medium">{Number(payout.amount || 0).toLocaleString()} coins</div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="font-medium text-xs text-gray-900 dark:text-white">{payout.paymentMethod || '—'}</div>
                          <div className="text-xs text-gray-500">
                            {payout.paymentDetails?.stripeAccountId
                              ? `Stripe ${payout.paymentDetails.stripeAccountId}`
                              : payout.paymentDetails?.accountMask || 'details on file'}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-gray-600 dark:text-gray-400">
                            <ShieldCheck className="w-3.5 h-3.5" />
                            {payout.processingError ? 'Payment error' : 'Server-settled'}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={`inline-flex px-2.5 py-1 rounded-full text-xs font-bold capitalize ${
                              payout.status === 'completed'
                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300'
                                : payout.status === 'rejected'
                                ? 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300'
                                : 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300'
                            }`}
                          >
                            {payout.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          {isAwaitingReview(payout.status) ? (
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => handleApprovePayout(payout.id)}
                                className="px-3 py-1 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition shadow-sm"
                              >
                                Approve
                              </button>
                              <button
                                onClick={() => handleRejectPayout(payout.id)}
                                className="px-3 py-1 text-xs font-semibold bg-gray-100 hover:bg-red-100 text-gray-700 hover:text-red-700 dark:bg-gray-700 dark:hover:bg-red-900/40 dark:text-gray-300 dark:hover:text-red-300 rounded-lg transition"
                              >
                                Reject
                              </button>
                            </div>
                          ) : (
                            <span className="text-xs text-gray-400">Processed</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: TRANSACTIONS & LEDGER */}
        {activeTab === 'transactions' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold">Financial Event Ledger</h2>
                <p className="text-xs text-gray-500">Immutable double-entry transaction record</p>
              </div>

              {/* Search Bar */}
              <div className="relative w-full sm:w-72">
                <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search tx ID, user, or type..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 text-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            {/* Transactions List */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm">
              <div className="divide-y divide-gray-100 dark:divide-gray-700">
                {filteredTransactions.length === 0 && (
                  <div className="p-12 text-center text-sm text-gray-500 dark:text-gray-400">
                    {loading ? 'Loading ledger…' : 'No ledger entries match this search.'}
                  </div>
                )}
                {filteredTransactions.map(tx => (
                  <div key={tx.id} className="p-4 sm:p-5 flex items-center justify-between gap-4 hover:bg-gray-50/50 dark:hover:bg-gray-750 transition">
                    <div className="flex items-center gap-3.5">
                      <div
                        className={`p-2.5 rounded-xl ${
                          tx.type === 'credit' || tx.type === 'coin_purchase'
                            ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400'
                            : tx.type === 'debit' || tx.type === 'payout'
                            ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400'
                            : 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400'
                        }`}
                      >
                        {tx.type === 'debit' || tx.type === 'payout' ? (
                          <ArrowUpRight className="w-5 h-5" />
                        ) : tx.type === 'credit' || tx.type === 'coin_purchase' ? (
                          <ArrowDownLeft className="w-5 h-5" />
                        ) : (
                          <Coins className="w-5 h-5" />
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm capitalize">{String(tx.type || 'entry').replace('_', ' ')}</span>
                          <span className="text-xs text-gray-400 font-mono">#{tx.id}</span>
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                          Account <span className="font-mono font-medium text-gray-700 dark:text-gray-300">{tx.userId}</span>
                          {tx.reason ? ` • ${String(tx.reason).replace('_', ' ')}` : ''}
                        </p>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="font-bold text-sm text-gray-900 dark:text-white">
                        {Number(tx.amount || 0).toLocaleString()} Coins
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        ${(Number(tx.amount || 0) / COINS_PER_DOLLAR).toFixed(2)} USD
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminEconomyScreen;
