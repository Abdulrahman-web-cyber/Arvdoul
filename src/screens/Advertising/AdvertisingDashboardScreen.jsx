// src/screens/Advertising/AdvertisingDashboardScreen.jsx
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import * as Icons from 'lucide-react';
import { toast } from 'sonner';
import advertisingService from '../../services/advertisingService.js';
import { fetchAdminStatus } from '../../services/callableService.js';
import { BRAND_GRADIENT } from '../../design-system/tokens.js';
import { AD_OBJECTIVES, INPUT_CLASS, SURFACE_GLASS_CLASS } from '../CreatePost/createPostConstants.js';
import LoadingSpinner from '../../components/Shared/LoadingSpinner.jsx';

const formatCurrency = (cents = 0, currency = 'USD') => {
  const val = (Number(cents || 0) / 100).toFixed(2);
  return `${currency} ${val}`;
};

export default function AdvertisingDashboardScreen() {
  const navigate = useNavigate();
  const [account, setAccount] = useState(null);
  const [campaigns, setCampaigns] = useState([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [busyId, setBusyId] = useState(null);
  const [editing, setEditing] = useState(null);
  const [editTitle, setEditTitle] = useState('');
  const [editBudgetUsd, setEditBudgetUsd] = useState('10');
  const [editObjective, setEditObjective] = useState('reach');
  const [savingEdit, setSavingEdit] = useState(false);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [accRes, campRes, adminFlag] = await Promise.all([
        advertisingService.getOrCreateAdAccount('USD'),
        advertisingService.listAdCampaigns(50),
        fetchAdminStatus().catch((err) => {
          console.warn('[AdvertisingDashboard] Admin check skipped:', err?.message);
          return false;
        }),
      ]);
      setAccount(accRes?.account || null);
      setCampaigns(Array.isArray(campRes?.campaigns) ? campRes.campaigns : []);
      setIsAdmin(Boolean(adminFlag));
    } catch (err) {
      setError(err?.message || 'Unable to load Advertising Center.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const filteredCampaigns = useMemo(() => {
    if (statusFilter === 'all') return campaigns;
    return campaigns.filter((c) => c.status === statusFilter);
  }, [campaigns, statusFilter]);

  const activeCount = useMemo(
    () => campaigns.filter((c) => c.status === 'active').length,
    [campaigns]
  );

  const handleToggleStatus = async (camp) => {
    const nextStatus = camp.status === 'active' ? 'paused' : 'active';
    setBusyId(camp.id);
    try {
      await advertisingService.setAdCampaignStatus(camp.id, nextStatus);
      toast.success(`Campaign ${nextStatus === 'active' ? 'activated' : 'paused'}.`);
      await loadDashboard();
    } catch (err) {
      toast.error(err?.message || 'Failed to update campaign status.');
    } finally {
      setBusyId(null);
    }
  };

  const handleSubmitReview = async (camp) => {
    setBusyId(camp.id);
    try {
      await advertisingService.submitAdCampaignForReview(camp.id, camp.complianceNotes || '');
      toast.success('Campaign submitted for ad policy review.');
      await loadDashboard();
    } catch (err) {
      toast.error(err?.message || 'Failed to submit campaign for review.');
    } finally {
      setBusyId(null);
    }
  };

  const openEditModal = (camp) => {
    setEditing(camp);
    setEditTitle(camp.title || '');
    setEditBudgetUsd(String(Math.max(1, Math.round((camp.budgetCents || 1000) / 100))));
    setEditObjective(camp.objective || 'reach');
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!editing) return;
    setSavingEdit(true);
    try {
      const budgetCents = Math.max(100, Math.round(Number(editBudgetUsd || 1) * 100));
      await advertisingService.updateAdCampaign(editing.id, {
        title: editTitle.trim() || editing.title,
        budgetCents,
        objective: editObjective,
      });
      toast.success('Campaign updated.');
      setEditing(null);
      await loadDashboard();
    } catch (err) {
      toast.error(err?.message || 'Failed to save campaign updates.');
    } finally {
      setSavingEdit(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F6F8FC] dark:bg-[#03071B] text-slate-900 dark:text-white px-4 sm:px-6 lg:px-8 py-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Arvdoul Business · Separate Ad Spend Ledger
            </p>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight mt-0.5">
              Advertising Center
            </h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => navigate('/ads/billing')}
              className="min-h-[42px] px-4 py-2 rounded-xl border border-slate-200 dark:border-white/15 bg-white/80 dark:bg-white/[0.04] text-xs font-semibold hover:border-arvdoul-purple/50 transition-colors whitespace-nowrap"
            >
              Billing &amp; Funds
            </button>
            <button
              type="button"
              onClick={() => navigate('/ads/analytics')}
              className="min-h-[42px] px-4 py-2 rounded-xl border border-slate-200 dark:border-white/15 bg-white/80 dark:bg-white/[0.04] text-xs font-semibold hover:border-arvdoul-purple/50 transition-colors whitespace-nowrap"
            >
              Ad Analytics
            </button>
            {isAdmin && (
              <button
                type="button"
                onClick={() => navigate('/ads/review')}
                className="min-h-[42px] px-4 py-2 rounded-xl border border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300 text-xs font-semibold hover:bg-amber-500/15 transition-colors whitespace-nowrap"
              >
                Moderation Queue
              </button>
            )}
            <button
              type="button"
              onClick={() => navigate('/ads/create')}
              className="min-h-[42px] px-4 py-2 rounded-xl text-white text-xs font-semibold shadow-md hover:opacity-95 transition-opacity flex items-center gap-1.5 whitespace-nowrap"
              style={{ background: BRAND_GRADIENT }}
            >
              <Icons.Plus className="w-4 h-4" aria-hidden="true" />
              <span>Create Campaign</span>
            </button>
          </div>
        </div>

        {/* 3-Ledger Architecture Separation Strip */}
        <div className={`${SURFACE_GLASS_CLASS} p-4 grid grid-cols-1 md:grid-cols-3 gap-3 text-xs`}>
          <button
            type="button"
            onClick={() => navigate('/wallet')}
            className="text-left p-3 rounded-xl border border-slate-200/80 dark:border-white/10 hover:border-arvdoul-purple/40 transition-colors"
          >
            <span className="text-slate-500 dark:text-slate-400 block">1. Virtual Coins Wallet</span>
            <span className="font-semibold text-slate-900 dark:text-white mt-0.5 block">
              Gifts, Tips &amp; Digital Perks →
            </span>
          </button>
          <button
            type="button"
            onClick={() => navigate('/creator-payout')}
            className="text-left p-3 rounded-xl border border-slate-200/80 dark:border-white/10 hover:border-arvdoul-purple/40 transition-colors"
          >
            <span className="text-slate-500 dark:text-slate-400 block">2. Creator Earnings Ledger</span>
            <span className="font-semibold text-slate-900 dark:text-white mt-0.5 block">
              Payouts, Sponsorships &amp; Affiliates →
            </span>
          </button>
          <div className="p-3 rounded-xl border border-arvdoul-purple/40 bg-arvdoul-purple/8">
            <span className="text-arvdoul-purple font-semibold block">3. Advertiser Ad Spend (Active)</span>
            <span className="text-slate-700 dark:text-slate-200 mt-0.5 block">
              Dedicated campaign billing, CPM/CPC &amp; disputes
            </span>
          </div>
        </div>

        {/* Account KPI Strip */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 tabular-nums">
          <div className={`${SURFACE_GLASS_CLASS} p-4`}>
            <span className="text-xs text-slate-500 dark:text-slate-400 block">Ad Account Balance</span>
            <span className="text-xl font-bold mt-1 block">
              {loading ? '—' : formatCurrency(account?.balanceCents, account?.currency || 'USD')}
            </span>
          </div>
          <div className={`${SURFACE_GLASS_CLASS} p-4`}>
            <span className="text-xs text-slate-500 dark:text-slate-400 block">Lifetime Ad Spend</span>
            <span className="text-xl font-bold mt-1 block">
              {loading ? '—' : formatCurrency(account?.lifetimeSpendCents, account?.currency || 'USD')}
            </span>
          </div>
          <div className={`${SURFACE_GLASS_CLASS} p-4`}>
            <span className="text-xs text-slate-500 dark:text-slate-400 block">Active Campaigns</span>
            <span className="text-xl font-bold mt-1 block">{loading ? '—' : activeCount}</span>
          </div>
          <div className={`${SURFACE_GLASS_CLASS} p-4`}>
            <span className="text-xs text-slate-500 dark:text-slate-400 block">Total Campaigns</span>
            <span className="text-xl font-bold mt-1 block">{loading ? '—' : campaigns.length}</span>
          </div>
        </div>

        {/* Campaign Filters */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-200/70 dark:bg-white/[0.06] overflow-x-auto">
            {['all', 'active', 'pending_review', 'draft', 'paused', 'rejected'].map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize whitespace-nowrap transition-colors ${
                  statusFilter === st
                    ? 'bg-white dark:bg-[#080F2E] text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {st.replace('_', ' ')}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={loadDashboard}
            className="min-h-[38px] px-3 py-1.5 rounded-xl border border-slate-200 dark:border-white/15 text-xs font-semibold flex items-center gap-1.5"
          >
            <Icons.RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Refresh</span>
          </button>
        </div>

        {/* Campaign List */}
        {loading ? (
          <div className={`${SURFACE_GLASS_CLASS} p-12 flex flex-col items-center justify-center gap-3`}>
            <LoadingSpinner size="md" />
            <p className="text-xs text-slate-500 dark:text-slate-400">Loading campaigns...</p>
          </div>
        ) : error ? (
          <div className={`${SURFACE_GLASS_CLASS} p-6 text-center space-y-3`}>
            <p className="text-sm text-rose-500 font-medium">{error}</p>
            <button
              type="button"
              onClick={loadDashboard}
              className="min-h-[40px] px-4 py-2 rounded-xl text-white text-xs font-semibold"
              style={{ background: BRAND_GRADIENT }}
            >
              Retry
            </button>
          </div>
        ) : filteredCampaigns.length === 0 ? (
          <div className={`${SURFACE_GLASS_CLASS} p-10 text-center space-y-3`}>
            <Icons.Megaphone className="w-8 h-8 mx-auto text-slate-400" aria-hidden="true" />
            <h2 className="text-base font-semibold">No campaigns yet</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
              Create an independent ad campaign or promote an existing post without duplicating your organic engagement.
            </p>
            <button
              type="button"
              onClick={() => navigate('/ads/create')}
              className="min-h-[42px] px-5 py-2 rounded-xl text-white text-xs font-semibold inline-flex items-center gap-1.5"
              style={{ background: BRAND_GRADIENT }}
            >
              <Icons.Plus className="w-4 h-4" aria-hidden="true" />
              <span>Launch First Campaign</span>
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredCampaigns.map((camp) => {
              const metrics = camp.metrics || {};
              const isBusy = busyId === camp.id;
              return (
                <div key={camp.id} className={`${SURFACE_GLASS_CLASS} p-4 sm:p-5 space-y-3`}>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className="text-base font-semibold text-slate-900 dark:text-white truncate">
                        {camp.title}
                      </h2>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        <span className="capitalize font-medium text-slate-700 dark:text-slate-200">
                          {camp.status?.replace('_', ' ')}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span className="capitalize">{camp.promotionKind?.replace('_', ' ')}</span>
                        <span aria-hidden="true">·</span>
                        <span className="capitalize">{camp.objective?.replace('_', ' ')}</span>
                        {camp.sourcePostId && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span>Preserves Post {camp.sourcePostId.slice(0, 8)}</span>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      {(camp.status === 'draft' || camp.status === 'rejected') && (
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => handleSubmitReview(camp)}
                          className="min-h-[38px] px-3 py-1.5 rounded-xl text-white text-xs font-semibold disabled:opacity-50 whitespace-nowrap"
                          style={{ background: BRAND_GRADIENT }}
                        >
                          Submit Review
                        </button>
                      )}
                      {(camp.status === 'active' || camp.status === 'paused') && (
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => handleToggleStatus(camp)}
                          className="min-h-[38px] px-3 py-1.5 rounded-xl border border-slate-200 dark:border-white/15 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-white/10 disabled:opacity-50 whitespace-nowrap"
                        >
                          {camp.status === 'active' ? 'Pause' : 'Resume'}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => openEditModal(camp)}
                        className="min-h-[38px] px-3 py-1.5 rounded-xl border border-slate-200 dark:border-white/15 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-white/10 whitespace-nowrap"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => navigate(`/ads/analytics?campaignId=${encodeURIComponent(camp.id)}`)}
                        className="min-h-[38px] px-3 py-1.5 rounded-xl border border-arvdoul-purple/40 text-arvdoul-purple text-xs font-semibold hover:bg-arvdoul-purple/10 whitespace-nowrap"
                      >
                        Analytics
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 pt-2 border-t border-slate-200/70 dark:border-white/10 text-xs tabular-nums">
                    <div>
                      <span className="text-slate-500 dark:text-slate-400 block">Budget</span>
                      <span className="font-semibold">
                        {formatCurrency(camp.budgetCents, camp.currency)} ({camp.budgetType})
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 dark:text-slate-400 block">Spent</span>
                      <span className="font-semibold">
                        {formatCurrency(camp.spentCents, camp.currency)}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 dark:text-slate-400 block">Impressions</span>
                      <span className="font-semibold">{Number(metrics.impressions || 0).toLocaleString()}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 dark:text-slate-400 block">Clicks</span>
                      <span className="font-semibold">{Number(metrics.clicks || 0).toLocaleString()}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 dark:text-slate-400 block">Conversions</span>
                      <span className="font-semibold">{Number(metrics.conversions || 0).toLocaleString()}</span>
                    </div>
                  </div>

                  {camp.reviewNotes && (
                    <p className="text-xs text-amber-600 dark:text-amber-300">
                      Reviewer note: {camp.reviewNotes}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Edit Campaign Modal */}
      {editing && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={() => setEditing(null)}
        >
          <form
            onSubmit={handleSaveEdit}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-2xl p-5 border bg-white dark:bg-[#080F2E] border-slate-200 dark:border-white/15 space-y-4 shadow-2xl"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold">Edit Campaign</h3>
              <button
                type="button"
                aria-label="Close edit campaign modal"
                onClick={() => setEditing(null)}
                className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-white/10"
              >
                <Icons.X className="w-4 h-4" />
              </button>
            </div>
            <div>
              <label htmlFor="edit-camp-title" className="block text-xs font-medium mb-1">
                Campaign Title
              </label>
              <input
                id="edit-camp-title"
                type="text"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                className={INPUT_CLASS}
                required
              />
            </div>
            <div>
              <label htmlFor="edit-camp-budget" className="block text-xs font-medium mb-1">
                Budget ({editing.currency || 'USD'})
              </label>
              <input
                id="edit-camp-budget"
                type="number"
                min="1"
                step="1"
                value={editBudgetUsd}
                onChange={(e) => setEditBudgetUsd(e.target.value)}
                className={`${INPUT_CLASS} tabular-nums`}
                required
              />
            </div>
            <div>
              <label htmlFor="edit-camp-objective" className="block text-xs font-medium mb-1">
                Objective
              </label>
              <select
                id="edit-camp-objective"
                value={editObjective}
                onChange={(e) => setEditObjective(e.target.value)}
                className={INPUT_CLASS}
              >
                {AD_OBJECTIVES.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="min-h-[40px] px-4 py-2 rounded-xl border border-slate-200 dark:border-white/15 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={savingEdit}
                className="min-h-[40px] px-5 py-2 rounded-xl text-white text-xs font-semibold disabled:opacity-50"
                style={{ background: BRAND_GRADIENT }}
              >
                {savingEdit ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
