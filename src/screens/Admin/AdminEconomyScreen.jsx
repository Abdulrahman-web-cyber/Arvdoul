// src/screens/Admin/AdminEconomyScreen.jsx

import { useState, useEffect, useCallback } from "react";
import { usePrompt } from '../../components/Shared/ConfirmProvider.jsx';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import {
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
import { useAuth } from '../../context/AuthContext';
import { callFunction, FUNCTIONS, fetchAdminStatus } from '../../services/callableService.js';
import { COINS_PER_DOLLAR, getRankTitle } from '../../services/levelSystemService.js';
import { formatCoinsAsUsd } from '../../shared/levelConfig.cjs';
import { unknownNumber } from '../../lib/unknownNumber.js';
import PermissionDenied from '../../design-system/PermissionDenied.jsx';
import AdminNavHeader from '../../components/Admin/AdminNavHeader.jsx';

const asUsd = (value) => {
  const n = unknownNumber(value);
  return n === null ? '—' : formatCoinsAsUsd(n);
};
const asCoins = (value) => {
  const n = unknownNumber(value);
  return n === null ? '—' : n.toLocaleString();
};

const AdminEconomyScreen = () => {
  const prompt = usePrompt();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [denied, setDenied] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [searchQuery, setSearchQuery] = useState('');
  const [payoutFilter, setPayoutFilter] = useState('pending');

  const [metrics, setMetrics] = useState({
    circulatingCoins: null,
    treasuryReserveUsd: null,
    pendingPayoutCoins: null,
    pendingPayoutCount: null,
    completedPayoutCoins: null,
    monthlyVolumeCoins: null,
  });

  const [payouts, setPayouts] = useState([]);
  const [payoutsError, setPayoutsError] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [transactionsError, setTransactionsError] = useState(null);

  const loadData = useCallback(async () => {
    setRefreshing(true);
    try {
      if (!user?.uid || !(await fetchAdminStatus())) {
        setDenied(true);
        setLoading(false);
        setRefreshing(false);
        return;
      }

      const { getAdminService } = await import('../../services/adminService.js');
      const admin = getAdminService();

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

      try {
        const rows = await admin.listWithdrawalRequests(100);
        setPayouts(rows);
        setPayoutsError(null);
      } catch (err) {
        setPayoutsError(err?.message || 'Could not load the payout queue.');
        setPayouts([]);
      }

      try {
        const rows = await admin.listCoinTransactions(100);
        setTransactions(rows);
        setTransactionsError(null);
      } catch (err) {
        setTransactionsError(err?.message || 'Could not load the ledger.');
        setTransactions([]);
      }
    } catch {
      toast.error('Could not sync live economy data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.uid]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleApprovePayout = async (payoutId) => {
    try {
      const payout = payouts.find((p) => p.id === payoutId);
      if (!payout) return;

      const result = await callFunction(FUNCTIONS.ADMIN_DECIDE_WITHDRAWAL, {
        withdrawalId: payoutId,
        action: 'approve',
      });
      if (!result?.success) throw new Error(result?.error || 'Settlement failed');

      setPayouts((prev) =>
        prev.map((p) => (p.id === payoutId ? { ...p, status: 'completed', stripePayoutId: result.payoutId } : p))
      );
      const usd = unknownNumber(result.usdAmount);
      toast.success(usd === null ? 'Payout approved and sent.' : `Payout of $${usd.toFixed(2)} sent.`);
      loadData();
    } catch (err) {
      toast.error(err?.message || 'Failed to approve payout request');
    }
  };

  const handleRejectPayout = async (payoutId) => {
    const reason = await prompt({
      title: 'Rejection reason',
      description: 'This reason is sent to the creator.',
      placeholder: 'Reason',
      confirmText: 'Reject',
    });
    if (!reason) return;

    try {
      const result = await callFunction(FUNCTIONS.ADMIN_DECIDE_WITHDRAWAL, {
        withdrawalId: payoutId,
        action: 'reject',
        reason,
      });
      if (!result?.success) throw new Error(result?.error || 'Settlement failed');

      setPayouts((prev) =>
        prev.map((p) => (p.id === payoutId ? { ...p, status: 'rejected', rejectionReason: reason } : p))
      );
      toast.info(`Payout request rejected: ${reason}`);
      loadData();
    } catch (err) {
      toast.error(err?.message || 'Failed to reject payout');
    }
  };

  const isAwaitingReview = (status) => status === 'pending' || status === 'pending_review';
  const filteredPayouts = payouts.filter((p) => {
    if (payoutFilter === 'all') return true;
    return isAwaitingReview(p.status) ? payoutFilter === 'pending' : p.status === payoutFilter;
  });

  const filteredTransactions = transactions.filter((t) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      String(t.id).toLowerCase().includes(q) ||
      String(t.userId || '').toLowerCase().includes(q) ||
      String(t.type || '').toLowerCase().includes(q) ||
      String(t.reason || '').toLowerCase().includes(q)
    );
  });

  if (denied) {
    return <PermissionDenied onGoHome={() => navigate('/')} />;
  }

  return (
    <div id="admin-economy-screen" className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      <AdminNavHeader
        title="Economy Oversight"
        subtitle="Tokenomics, coin liquidity, reserves, and creator payout ledger"
        actions={
          <button
            id="refresh-economy-btn"
            type="button"
            onClick={loadData}
            disabled={refreshing}
            className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition disabled:opacity-50 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            <span>Sync Data</span>
          </button>
        }
      />

      {/* Economy sub-tabs */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex gap-6">
          <button
            id="tab-overview"
            type="button"
            onClick={() => setActiveTab('overview')}
            className={`py-3 text-xs font-semibold border-b-2 transition cursor-pointer ${
              activeTab === 'overview'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            Treasury &amp; Reserves
          </button>
          <button
            id="tab-payouts"
            type="button"
            onClick={() => setActiveTab('payouts')}
            className={`py-3 text-xs font-semibold border-b-2 flex items-center gap-2 transition cursor-pointer ${
              activeTab === 'payouts'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <span>Payout Queue</span>
            {payouts.filter((p) => isAwaitingReview(p.status)).length > 0 && (
              <span className="text-amber-600 dark:text-amber-400 font-mono tabular-nums">
                ({payouts.filter((p) => isAwaitingReview(p.status)).length})
              </span>
            )}
          </button>
          <button
            id="tab-transactions"
            type="button"
            onClick={() => setActiveTab('transactions')}
            className={`py-3 text-xs font-semibold border-b-2 transition cursor-pointer ${
              activeTab === 'transactions'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            Ledger &amp; Transactions
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {activeTab === 'overview' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div id="card-circulating-coins" className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Circulating Coins</span>
                  <Coins className="w-4 h-4 text-amber-500" />
                </div>
                <div className="text-2xl font-bold tabular-nums">
                  {metrics.circulatingCoins === null ? '—' : metrics.circulatingCoins.toLocaleString()}
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Sum of every citizen&apos;s coin balance
                </p>
              </div>

              <div id="card-treasury-balance" className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Reserve Liability (USD)</span>
                  <DollarSign className="w-4 h-4 text-emerald-500" />
                </div>
                <div className="text-2xl font-bold tabular-nums">
                  {metrics.treasuryReserveUsd === null ? '—' : `$${metrics.treasuryReserveUsd.toLocaleString(undefined, { maximumFractionDigits: 2 })}`}
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 tabular-nums">
                  Coin liability at {COINS_PER_DOLLAR} coins / $1
                </p>
              </div>

              <div id="card-pending-payouts" className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Awaiting Payouts</span>
                  <Clock className="w-4 h-4 text-blue-500" />
                </div>
                <div className="text-2xl font-bold tabular-nums">
                  {metrics.pendingPayoutCount === null ? '—' : metrics.pendingPayoutCount}
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 tabular-nums">
                  {metrics.pendingPayoutCoins === null
                    ? 'Locked coin value unavailable'
                    : `${metrics.pendingPayoutCoins.toLocaleString()} coins locked`}
                </p>
              </div>

              <div id="card-monthly-volume" className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-slate-500 dark:text-slate-400">30-Day Ledger Volume</span>
                  <TrendingUp className="w-4 h-4 text-blue-500" />
                </div>
                <div className="text-2xl font-bold tabular-nums">
                  {metrics.monthlyVolumeCoins === null ? '—' : metrics.monthlyVolumeCoins.toLocaleString()}
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Coins moved in the last 30 days
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div id="tokenomics-health-panel" className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800">
                <h3 className="text-base font-semibold mb-4 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-blue-500" />
                  Ledger Integrity
                </h3>
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  <div className="flex items-center justify-between py-3">
                    <div>
                      <p className="font-medium text-sm">Coin Liability (Circulating)</p>
                      <p className="text-xs text-slate-500">Owed to citizens from coin balances</p>
                    </div>
                    <span className="text-xs font-mono font-semibold tabular-nums">
                      {metrics.circulatingCoins === null ? 'Unavailable' : `${metrics.circulatingCoins.toLocaleString()} coins`}
                    </span>
                  </div>

                  <div className="flex items-center justify-between py-3">
                    <div>
                      <p className="font-medium text-sm">Locked In Payouts</p>
                      <p className="text-xs text-slate-500">Coins reserved against open requests</p>
                    </div>
                    <span className="text-xs font-mono font-semibold text-amber-600 dark:text-amber-400 tabular-nums">
                      {metrics.pendingPayoutCoins === null ? 'Unavailable' : `${metrics.pendingPayoutCoins.toLocaleString()} coins`}
                    </span>
                  </div>

                  <div className="flex items-center justify-between py-3">
                    <div>
                      <p className="font-medium text-sm">30-Day Ledger Movement</p>
                      <p className="text-xs text-slate-500">Sum of coin_transactions in the window</p>
                    </div>
                    <span className="text-xs font-mono font-semibold text-blue-600 dark:text-blue-400 tabular-nums">
                      {metrics.monthlyVolumeCoins === null ? 'Unavailable' : `${metrics.monthlyVolumeCoins.toLocaleString()} coins`}
                    </span>
                  </div>
                </div>
              </div>

              <div id="liquidity-operations-panel" className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800">
                <h3 className="text-base font-semibold mb-2 flex items-center gap-2">
                  <Wallet className="w-4 h-4 text-amber-500" />
                  Treasury Actions
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-5 leading-relaxed">
                  Financial mutations are server-side only. Review the immutable trail of every coin and payout event.
                </p>
                <div className="space-y-2.5">
                  <button
                    type="button"
                    onClick={() => navigate('/admin/audit-logs')}
                    className="w-full flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700/80 text-sm font-medium rounded-lg transition cursor-pointer"
                  >
                    <span>Open the Audit Trail</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={loadData}
                    className="w-full flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700/80 text-sm font-medium rounded-lg transition cursor-pointer"
                  >
                    <span>Refresh Ledger Aggregates</span>
                    <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'payouts' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-base font-semibold">Creator Payout Requests</h2>
                <p className="text-xs text-slate-500">Review and disburse funds to verified creators</p>
              </div>

              <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-1 rounded-lg">
                {['pending', 'completed', 'all'].map((status) => (
                  <button
                    key={status}
                    type="button"
                    onClick={() => setPayoutFilter(status)}
                    className={`px-3 py-1 rounded-md text-xs font-semibold capitalize transition cursor-pointer ${
                      payoutFilter === status
                        ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                        : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
                    }`}
                  >
                    {status}
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 dark:bg-slate-900/60 text-xs uppercase font-semibold text-slate-500 border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="px-5 py-3.5">Creator</th>
                      <th className="px-5 py-3.5">Citizenship &amp; Level</th>
                      <th className="px-5 py-3.5">Amount</th>
                      <th className="px-5 py-3.5">Payment Channel</th>
                      <th className="px-5 py-3.5">Risk Evaluation</th>
                      <th className="px-5 py-3.5">Status</th>
                      <th className="px-5 py-3.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {filteredPayouts.length === 0 && (
                      <tr>
                        <td colSpan={7} className="px-5 py-12 text-center text-sm text-slate-500">
                          {loading
                            ? 'Loading payout queue…'
                            : payoutsError
                              ? `Could not load the payout queue: ${payoutsError}`
                              : 'No payout requests match this filter.'}
                        </td>
                      </tr>
                    )}
                    {filteredPayouts.map((payout) => (
                      <tr key={payout.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition">
                        <td className="px-5 py-3.5">
                          <div className="font-mono text-xs font-semibold">{payout.userId}</div>
                          <div className="text-xs text-slate-500 font-mono">{payout.id}</div>
                        </td>
                        <td className="px-5 py-3.5 text-xs">
                          <span className="font-semibold">{Number.isFinite(payout.level) ? getRankTitle(payout.level) : '—'}</span>
                          <span aria-hidden="true" className="mx-1 text-slate-400">·</span>
                          <span className="text-slate-500 tabular-nums">Lvl {payout.level ?? '—'}</span>
                        </td>
                        <td className="px-5 py-3.5 tabular-nums">
                          <div className="font-semibold">{asUsd(payout.amount)}</div>
                          <div className="text-xs text-amber-600">{asCoins(payout.amount)} coins</div>
                        </td>
                        <td className="px-5 py-3.5 text-xs">
                          <div className="font-medium">{payout.paymentMethod || '—'}</div>
                          <div className="text-slate-500">
                            {payout.paymentDetails?.stripeAccountId
                              ? `Stripe ${payout.paymentDetails.stripeAccountId}`
                              : payout.paymentDetails?.accountMask || 'details on file'}
                          </div>
                        </td>
                        <td className="px-5 py-3.5 text-xs text-slate-600 dark:text-slate-400">
                          <span className="inline-flex items-center gap-1">
                            <ShieldCheck className="w-3.5 h-3.5" />
                            {payout.processingError ? 'Payment error' : 'Server-settled'}
                          </span>
                        </td>
                        <td className="px-5 py-3.5">
                          <span
                            className={`text-xs font-semibold capitalize ${
                              payout.status === 'completed'
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : payout.status === 'rejected'
                                  ? 'text-red-600 dark:text-red-400'
                                  : 'text-amber-600 dark:text-amber-400'
                            }`}
                          >
                            {payout.status}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          {isAwaitingReview(payout.status) ? (
                            <div className="flex items-center justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => handleApprovePayout(payout.id)}
                                className="px-3 py-1 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition cursor-pointer"
                              >
                                Approve
                              </button>
                              <button
                                type="button"
                                onClick={() => handleRejectPayout(payout.id)}
                                className="px-3 py-1 text-xs font-semibold bg-slate-100 hover:bg-red-100 text-slate-700 hover:text-red-700 dark:bg-slate-800 dark:hover:bg-red-950/50 dark:text-slate-300 rounded-lg transition cursor-pointer"
                              >
                                Reject
                              </button>
                            </div>
                          ) : (
                            <span className="text-xs text-slate-400">Processed</span>
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

        {activeTab === 'transactions' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-base font-semibold">Financial Event Ledger</h2>
                <p className="text-xs text-slate-500">Immutable double-entry transaction record</p>
              </div>

              <div className="relative w-full sm:w-72">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  aria-label="Search ledger transactions"
                  type="text"
                  placeholder="Search tx ID, user, or type..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-arvdoul-purple"
                />
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredTransactions.length === 0 && (
                  <div className="p-12 text-center text-sm text-slate-500">
                    {loading
                      ? 'Loading ledger…'
                      : transactionsError
                        ? `Could not load the ledger: ${transactionsError}`
                        : 'No ledger entries match this search.'}
                  </div>
                )}
                {filteredTransactions.map((tx) => (
                  <div key={tx.id} className="p-4 sm:p-5 flex items-center justify-between gap-4 hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition">
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div
                        className={`p-2 rounded-lg shrink-0 ${
                          tx.type === 'credit' || tx.type === 'coin_purchase'
                            ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400'
                            : tx.type === 'debit' || tx.type === 'payout'
                              ? 'bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400'
                              : 'bg-amber-50 text-amber-600 dark:bg-amber-950/50 dark:text-amber-400'
                        }`}
                      >
                        {tx.type === 'debit' || tx.type === 'payout' ? (
                          <ArrowUpRight className="w-4 h-4" />
                        ) : tx.type === 'credit' || tx.type === 'coin_purchase' ? (
                          <ArrowDownLeft className="w-4 h-4" />
                        ) : (
                          <Coins className="w-4 h-4" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-sm capitalize">{String(tx.type || 'entry').replace('_', ' ')}</span>
                          <span className="text-xs text-slate-400 font-mono">#{tx.id}</span>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                          Account <span className="font-mono font-medium text-slate-700 dark:text-slate-300">{tx.userId}</span>
                          {tx.reason ? ` · ${String(tx.reason).replace('_', ' ')}` : ''}
                        </p>
                      </div>
                    </div>

                    <div className="text-right shrink-0 tabular-nums">
                      <div className="font-semibold text-sm">{asCoins(tx.amount)} Coins</div>
                      <div className="text-xs text-slate-500">{asUsd(tx.amount)} USD</div>
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
