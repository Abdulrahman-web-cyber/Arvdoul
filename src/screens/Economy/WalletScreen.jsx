// src/screens/Economy/WalletScreen.jsx — ARVDOUL CITIZEN WALLET & ECONOMIC LEDGER (Part 2)
// Double-entry, ledger-backed, multi-state transactions.

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import walletService from '../../services/walletService';
import monetizationService from '../../services/monetizationService';
import PaymentModal from '../../components/Shared/PaymentModal';
import CoinStackIcon from '../../components/Shared/CoinStackIcon';
import {
  ArrowLeft,
  Coins,
  ArrowUpRight,
  ArrowDownLeft,
  Clock,
  CheckCircle,
  AlertCircle,
  Plus,
  CreditCard,
  Building,
  RefreshCw,
} from 'lucide-react';
import { toast } from 'sonner';

const COIN_PACKAGES = [
  { id: 'coins_100',  coins: 100,  price: '$0.99',  bonus: 0 },
  { id: 'coins_500',  coins: 500,  price: '$4.99',  bonus: 50, popular: true },
  { id: 'coins_1200', coins: 1200, price: '$9.99',  bonus: 200 },
  { id: 'coins_2500', coins: 2500, price: '$19.99', bonus: 500 },
];

export default function WalletScreen() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { theme } = useTheme();

  const isDark = theme === 'dark' || theme === 'midnight';

  const [loading, setLoading] = useState(true);
  const [wallet, setWallet] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [activeTab, setActiveTab] = useState('all'); // all | in | out
  const [paymentPkg, setPaymentPkg] = useState(null);
  const [withdrawing, setWithdrawing] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState('');

  const loadWallet = useCallback(async () => {
    if (!user?.uid) return;
    try {
      const [wData, txData] = await Promise.all([
        walletService.getWalletOverview(user.uid),
        walletService.getTransactions(user.uid, 50),
      ]);
      setWallet(wData);
      setTransactions(txData);
    } catch (err) {
      toast.error('Failed to load wallet data');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadWallet();
  }, [loadWallet]);

  const handleWithdrawal = async (e) => {
    e.preventDefault();
    const amount = Number(withdrawAmount);
    if (!amount || amount < 5000) {
      toast.error('Minimum withdrawal amount is 5,000 coins ($50.00 USD).');
      return;
    }
    if (amount > (wallet?.availableCoins || 0)) {
      toast.error('Insufficient available coin balance.');
      return;
    }

    setWithdrawing(true);
    try {
      await walletService.requestPayout(user.uid, amount, {
        payoutMethod: 'stripe_connected',
      });
      toast.success('Withdrawal request submitted for compliance audit.');
      setWithdrawAmount('');
      await loadWallet();
    } catch (err) {
      toast.error(err?.message || 'Withdrawal failed');
    } finally {
      setWithdrawing(false);
    }
  };

  const filteredTxs = transactions.filter((tx) => {
    if (activeTab === 'in') return (tx.amount || 0) > 0;
    if (activeTab === 'out') return (tx.amount || 0) < 0;
    return true;
  });

  return (
    <div className={`min-h-screen pb-24 ${isDark ? 'bg-black text-gray-100' : 'bg-gray-50 text-gray-900'}`}>
      {/* Header */}
      <header className={`sticky top-0 z-30 border-b backdrop-blur-md px-4 py-3 flex items-center justify-between ${
        isDark ? 'bg-black/80 border-gray-800' : 'bg-white/80 border-gray-200'
      }`}>
        <div className="flex items-center space-x-3">
          <button
            onClick={() => navigate(-1)}
            aria-label="Go back"
            className={`p-2 rounded-lg transition-colors ${
              isDark ? 'hover:bg-gray-800 text-gray-300' : 'hover:bg-gray-100 text-gray-700'
            }`}
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-lg font-bold tracking-tight">Citizen Wallet</h1>
            <p className="text-xs text-gray-500">Economic Ledger & Sovereign Balance</p>
          </div>
        </div>

        <button
          onClick={loadWallet}
          aria-label="Refresh wallet"
          className={`p-2 rounded-lg transition-colors ${
            isDark ? 'hover:bg-gray-800 text-gray-400' : 'hover:bg-gray-100 text-gray-600'
          }`}
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        {/* Sovereign Balance Card */}
        <section
          aria-labelledby="balance-heading"
          className={`p-6 sm:p-8 rounded-3xl border transition-all ${
            isDark
              ? 'bg-gradient-to-br from-gray-900 via-gray-950 to-indigo-950/30 border-gray-800 shadow-xl'
              : 'bg-gradient-to-br from-white via-indigo-50/30 to-white border-gray-200 shadow-sm'
          }`}
        >
          <div className="flex items-start justify-between">
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-indigo-400">
                Available Reserve
              </span>
              <div className="flex items-baseline space-x-2 mt-1">
                <Coins className="w-6 h-6 text-amber-400 self-center" />
                <h2 id="balance-heading" className="text-4xl font-extrabold tracking-tight">
                  {(wallet?.availableCoins || user?.coins || 0).toLocaleString()}
                </h2>
                <span className="text-sm font-semibold text-gray-500">Coins</span>
              </div>
            </div>

            <button
              onClick={() => setPaymentPkg(COIN_PACKAGES[1])}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold flex items-center space-x-1.5 transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Acquire Coins</span>
            </button>
          </div>

          {/* Sub-balances breakdown */}
          <div className="mt-8 pt-6 border-t border-gray-800/40 grid grid-cols-3 gap-2 text-xs">
            <div>
              <span className="text-gray-500 block">Pending / Held</span>
              <span className="font-semibold text-amber-400 mt-0.5 block">
                {(wallet?.pendingCoins || 0).toLocaleString()} Coins
              </span>
            </div>
            <div>
              <span className="text-gray-500 block">Lifetime Earned</span>
              <span className="font-semibold text-emerald-400 mt-0.5 block">
                {(wallet?.totalEarned || 0).toLocaleString()} Coins
              </span>
            </div>
            <div>
              <span className="text-gray-500 block">Lifetime Spent</span>
              <span className="font-semibold text-gray-400 mt-0.5 block">
                {(wallet?.totalSpent || 0).toLocaleString()} Coins
              </span>
            </div>
          </div>
        </section>

        {/* Quick Packages */}
        <section aria-labelledby="packages-heading" className="space-y-3">
          <h3 id="packages-heading" className="text-sm font-semibold uppercase tracking-wider text-gray-500">
            Coin Packages
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {COIN_PACKAGES.map((pkg) => (
              <button
                key={pkg.id}
                onClick={() => setPaymentPkg(pkg)}
                className={`p-4 rounded-2xl border text-left flex flex-col justify-between transition-all ${
                  isDark ? 'bg-gray-900/60 border-gray-800 hover:border-indigo-600' : 'bg-white border-gray-200 hover:border-indigo-400'
                }`}
              >
                <div>
                  <span className="text-lg font-bold">{pkg.coins}</span>
                  <span className="text-xs text-gray-500 block">+{pkg.bonus} bonus</span>
                </div>
                <div className="mt-4 pt-2 border-t border-gray-800/40 flex items-center justify-between">
                  <span className="text-xs font-semibold text-indigo-400">{pkg.price}</span>
                  <span className="text-[11px] text-gray-500">USD</span>
                </div>
              </button>
            ))}
          </div>
        </section>

        {/* Creator Payouts Card */}
        {wallet?.monetizationEligible && (
          <section aria-labelledby="payout-heading" className={`p-6 rounded-2xl border ${isDark ? 'bg-gray-900/40 border-gray-800' : 'bg-white border-gray-200'}`}>
            <h3 id="payout-heading" className="text-base font-bold flex items-center space-x-2">
              <Building className="w-4 h-4 text-emerald-400" />
              <span>Creator Payouts</span>
            </h3>
            <p className="text-xs text-gray-400 mt-1">
              Convert earned creator revenue into fiat currency via Stripe Connect. Minimum threshold: 5,000 coins ($50 USD).
            </p>

            <form onSubmit={handleWithdrawal} className="mt-4 flex items-center space-x-2">
              <input
                type="number"
                min="5000"
                step="100"
                placeholder="Coins to withdraw (min 5,000)"
                value={withdrawAmount}
                onChange={(e) => setWithdrawAmount(e.target.value)}
                className={`p-2.5 rounded-xl border text-xs flex-1 outline-none ${
                  isDark ? 'bg-black border-gray-800 text-white' : 'bg-gray-50 border-gray-200 text-gray-900'
                }`}
              />
              <button
                type="submit"
                disabled={withdrawing}
                className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition-colors disabled:opacity-50"
              >
                {withdrawing ? 'Submitting...' : 'Request Payout'}
              </button>
            </form>
          </section>
        )}

        {/* Ledger Transaction History */}
        <section aria-labelledby="ledger-heading" className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 id="ledger-heading" className="text-sm font-semibold uppercase tracking-wider text-gray-500">
              Audit Ledger ({filteredTxs.length})
            </h3>
            <div className={`flex rounded-lg p-0.5 border ${isDark ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200'}`}>
              {['all', 'in', 'out'].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`text-[11px] uppercase tracking-wider px-2.5 py-1 rounded-md transition-colors ${
                    activeTab === tab
                      ? isDark
                        ? 'bg-gray-800 text-white font-semibold'
                        : 'bg-gray-100 text-gray-900 font-semibold'
                      : 'text-gray-500 hover:text-gray-300'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>

          <div className={`rounded-2xl border divide-y ${isDark ? 'bg-gray-900/40 border-gray-800 divide-gray-800' : 'bg-white border-gray-200 divide-gray-100'}`}>
            {filteredTxs.map((tx) => (
              <div key={tx.id} className="p-4 flex items-center justify-between text-xs">
                <div className="flex items-center space-x-3">
                  <div className={`p-2 rounded-xl ${
                    (tx.amount || 0) >= 0 ? 'bg-emerald-950/40 text-emerald-400' : 'bg-red-950/40 text-red-400'
                  }`}>
                    {(tx.amount || 0) >= 0 ? (
                      <ArrowDownLeft className="w-4 h-4" />
                    ) : (
                      <ArrowUpRight className="w-4 h-4" />
                    )}
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-200">{tx.description || tx.type || 'Transaction'}</h4>
                    <p className="text-[11px] text-gray-500">{new Date(tx.createdAt).toLocaleDateString()}</p>
                  </div>
                </div>

                <div className="text-right">
                  <span className={`font-mono font-bold block ${
                    (tx.amount || 0) >= 0 ? 'text-emerald-400' : 'text-gray-300'
                  }`}>
                    {(tx.amount || 0) >= 0 ? `+${tx.amount}` : tx.amount} Coins
                  </span>
                  <span className="text-[10px] uppercase font-mono text-gray-500">{tx.status}</span>
                </div>
              </div>
            ))}

            {filteredTxs.length === 0 && (
              <div className="p-8 text-center text-xs text-gray-500">
                No ledger transactions recorded yet.
              </div>
            )}
          </div>
        </section>
      </main>

      {/* Payment Modal */}
      {paymentPkg && (
        <PaymentModal
          pkg={paymentPkg}
          onSuccess={() => {
            setPaymentPkg(null);
            toast.success('Coins credited to reserve successfully!');
            loadWallet();
          }}
          onCancel={() => setPaymentPkg(null)}
        />
      )}
    </div>
  );
}
