// src/screens/Advertising/AdBillingScreen.jsx
import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import * as Icons from 'lucide-react';
import { toast } from 'sonner';
import advertisingService from '../../services/advertisingService.js';
import { BRAND_GRADIENT } from '../../design-system/tokens.js';
import { INPUT_CLASS, SURFACE_GLASS_CLASS } from '../CreatePost/createPostConstants.js';
import LoadingSpinner from '../../components/Shared/LoadingSpinner.jsx';

const formatMoney = (cents = 0, currency = 'USD') =>
  `${currency} ${(Number(cents || 0) / 100).toFixed(2)}`;

export default function AdBillingScreen() {
  const navigate = useNavigate();
  const [account, setAccount] = useState(null);
  const [entries, setEntries] = useState([]);
  const [disputes, setDisputes] = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [depositUsd, setDepositUsd] = useState('50');
  const [paymentRef, setPaymentRef] = useState('');
  const [funding, setFunding] = useState(false);

  const [disputeCampaignId, setDisputeCampaignId] = useState('');
  const [disputeUsd, setDisputeUsd] = useState('10');
  const [disputeReason, setDisputeReason] = useState('');
  const [filingDispute, setFilingDispute] = useState(false);

  const loadBilling = useCallback(async () => {
    setLoading(true);
    try {
      await advertisingService.getOrCreateAdAccount('USD');
      const [ledgerRes, campRes] = await Promise.all([
        advertisingService.getAdBillingLedger(50),
        advertisingService.listAdCampaigns(50),
      ]);
      setAccount(ledgerRes?.account || null);
      setEntries(Array.isArray(ledgerRes?.entries) ? ledgerRes.entries : []);
      setDisputes(Array.isArray(ledgerRes?.disputes) ? ledgerRes.disputes : []);
      setCampaigns(Array.isArray(campRes?.campaigns) ? campRes.campaigns : []);
    } catch (err) {
      toast.error(err?.message || 'Unable to load ad billing ledger.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadBilling();
  }, [loadBilling]);

  const handleDeposit = async (e) => {
    e.preventDefault();
    const amountCents = Math.round(Number(depositUsd || 0) * 100);
    if (!Number.isInteger(amountCents) || amountCents < 100) {
      toast.error('Minimum deposit is $1.00.');
      return;
    }
    setFunding(true);
    try {
      await advertisingService.fundAdAccount({
        amountCents,
        currency: account?.currency || 'USD',
        paymentReference: paymentRef.trim(),
      });
      toast.success(`Added ${formatMoney(amountCents, account?.currency || 'USD')} to Ad Account.`);
      setPaymentRef('');
      await loadBilling();
    } catch (err) {
      toast.error(err?.message || 'Ad account funding failed.');
    } finally {
      setFunding(false);
    }
  };

  const handleFileDispute = async (e) => {
    e.preventDefault();
    const requestedAmountCents = Math.round(Number(disputeUsd || 0) * 100);
    if (!disputeReason.trim() || requestedAmountCents < 100) {
      toast.error('Provide a reason and an amount of at least $1.00.');
      return;
    }
    setFilingDispute(true);
    try {
      await advertisingService.requestAdRefundOrDispute({
        campaignId: disputeCampaignId || null,
        reason: disputeReason.trim(),
        requestedAmountCents,
      });
      toast.success('Billing refund/dispute ticket submitted.');
      setDisputeReason('');
      await loadBilling();
    } catch (err) {
      toast.error(err?.message || 'Could not submit billing dispute.');
    } finally {
      setFilingDispute(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F6F8FC] dark:bg-[#03071B] text-slate-900 dark:text-white px-4 sm:px-6 lg:px-8 py-6">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              type="button"
              aria-label="Back to Advertising Center"
              onClick={() => navigate('/ads')}
              className="min-h-[42px] min-w-[42px] rounded-xl border border-slate-200 dark:border-white/15 flex items-center justify-center hover:bg-slate-100 dark:hover:bg-white/10"
            >
              <Icons.ArrowLeft className="w-4 h-4" />
            </button>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight">
                Advertiser Billing &amp; Disputes
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Dedicated ad spend ledger — isolated from Virtual Coins and Creator Earnings
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <button
              type="button"
              onClick={() => navigate('/wallet')}
              className="min-h-[38px] px-3 py-1.5 rounded-xl border border-slate-200 dark:border-white/15 font-semibold"
            >
              Coins Wallet
            </button>
            <button
              type="button"
              onClick={() => navigate('/creator-payout')}
              className="min-h-[38px] px-3 py-1.5 rounded-xl border border-slate-200 dark:border-white/15 font-semibold"
            >
              Creator Payouts
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Fund Ad Account */}
          <form onSubmit={handleDeposit} className={`${SURFACE_GLASS_CLASS} p-5 space-y-3`}>
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">Add Advertiser Funds</h2>
              <span className="text-sm font-bold tabular-nums text-arvdoul-purple">
                Balance: {loading ? '—' : formatMoney(account?.balanceCents, account?.currency || 'USD')}
              </span>
            </div>
            <div>
              <label htmlFor="ad-deposit-usd" className="block text-xs font-medium mb-1">
                Deposit Amount (USD)
              </label>
              <input
                id="ad-deposit-usd"
                type="number"
                min="1"
                step="1"
                value={depositUsd}
                onChange={(e) => setDepositUsd(e.target.value)}
                className={`${INPUT_CLASS} tabular-nums`}
                required
              />
            </div>
            <div>
              <label htmlFor="ad-payment-ref" className="block text-xs font-medium mb-1">
                Invoice / Reference Note (optional)
              </label>
              <input
                id="ad-payment-ref"
                type="text"
                value={paymentRef}
                onChange={(e) => setPaymentRef(e.target.value)}
                placeholder="e.g. Q3 Brand Media Budget"
                className={INPUT_CLASS}
              />
            </div>
            <button
              type="submit"
              disabled={funding}
              className="w-full min-h-[42px] px-4 py-2 rounded-xl text-white text-xs font-semibold disabled:opacity-50"
              style={{ background: BRAND_GRADIENT }}
            >
              {funding ? 'Processing...' : 'Deposit to Ad Account'}
            </button>
          </form>

          {/* Refund / Billing Dispute */}
          <form onSubmit={handleFileDispute} className={`${SURFACE_GLASS_CLASS} p-5 space-y-3`}>
            <h2 className="text-sm font-semibold">Request Refund or Billing Dispute</h2>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="dispute-campaign" className="block text-xs font-medium mb-1">
                  Campaign (optional)
                </label>
                <select
                  id="dispute-campaign"
                  value={disputeCampaignId}
                  onChange={(e) => setDisputeCampaignId(e.target.value)}
                  className={INPUT_CLASS}
                >
                  <option value="">General Account Billing</option>
                  {campaigns.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.title}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="dispute-amount" className="block text-xs font-medium mb-1">
                  Requested Amount (USD)
                </label>
                <input
                  id="dispute-amount"
                  type="number"
                  min="1"
                  step="1"
                  value={disputeUsd}
                  onChange={(e) => setDisputeUsd(e.target.value)}
                  className={`${INPUT_CLASS} tabular-nums`}
                  required
                />
              </div>
            </div>
            <div>
              <label htmlFor="dispute-reason" className="block text-xs font-medium mb-1">
                Reason
              </label>
              <input
                id="dispute-reason"
                type="text"
                value={disputeReason}
                onChange={(e) => setDisputeReason(e.target.value)}
                placeholder="Describe delivery discrepancy or billing issue"
                className={INPUT_CLASS}
                required
              />
            </div>
            <button
              type="submit"
              disabled={filingDispute}
              className="w-full min-h-[42px] px-4 py-2 rounded-xl border border-slate-300 dark:border-white/20 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-white/10 disabled:opacity-50"
            >
              {filingDispute ? 'Submitting...' : 'Submit Billing Dispute'}
            </button>
          </form>
        </div>

        {/* Ledger Table */}
        <div className={`${SURFACE_GLASS_CLASS} p-5 space-y-3`}>
          <h2 className="text-sm font-semibold">Billing Ledger</h2>
          {loading ? (
            <div className="py-8 flex justify-center">
              <LoadingSpinner size="sm" />
            </div>
          ) : entries.length === 0 ? (
            <p className="text-xs text-slate-500 dark:text-slate-400 py-4">
              No advertiser ledger transactions recorded yet.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="border-b border-slate-200 dark:border-white/10 text-slate-500 dark:text-slate-400">
                  <tr>
                    <th className="py-2 pr-4 font-medium">Type</th>
                    <th className="py-2 pr-4 font-medium">Reference / Event</th>
                    <th className="py-2 pr-4 font-medium text-right">Amount</th>
                    <th className="py-2 font-medium text-right">Balance After</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/60 dark:divide-white/5 tabular-nums">
                  {entries.map((row) => (
                    <tr key={row.id}>
                      <td className="py-2.5 pr-4 capitalize font-semibold">{row.type}</td>
                      <td className="py-2.5 pr-4 text-slate-500 dark:text-slate-400">
                        {row.paymentReference || row.eventType || row.campaignId || '—'}
                      </td>
                      <td className="py-2.5 pr-4 text-right font-medium">
                        {row.type === 'spend' ? '-' : '+'}
                        {formatMoney(row.amountCents, row.currency || 'USD')}
                      </td>
                      <td className="py-2.5 text-right font-semibold">
                        {formatMoney(row.balanceAfterCents, row.currency || 'USD')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Disputes */}
        {disputes.length > 0 && (
          <div className={`${SURFACE_GLASS_CLASS} p-5 space-y-3`}>
            <h2 className="text-sm font-semibold">Dispute History</h2>
            <div className="space-y-2">
              {disputes.map((d) => (
                <div
                  key={d.id}
                  className="p-3 rounded-xl bg-slate-100/80 dark:bg-white/[0.04] flex items-center justify-between gap-3 text-xs"
                >
                  <div className="min-w-0">
                    <p className="font-semibold truncate">{d.reason}</p>
                    <p className="text-slate-500 dark:text-slate-400">
                      Status: <span className="capitalize font-medium">{d.status}</span>
                      {d.resolutionNotes ? ` · ${d.resolutionNotes}` : ''}
                    </p>
                  </div>
                  <span className="font-bold tabular-nums shrink-0">
                    {formatMoney(d.requestedAmountCents, 'USD')}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
