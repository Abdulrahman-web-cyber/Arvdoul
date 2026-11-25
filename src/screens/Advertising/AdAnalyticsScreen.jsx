// src/screens/Advertising/AdAnalyticsScreen.jsx
import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import * as Icons from 'lucide-react';
import { toast } from 'sonner';
import advertisingService from '../../services/advertisingService.js';
import { BRAND_GRADIENT } from '../../design-system/tokens.js';
import { INPUT_CLASS, SURFACE_GLASS_CLASS } from '../CreatePost/createPostConstants.js';
import LoadingSpinner from '../../components/Shared/LoadingSpinner.jsx';

const fmtMoney = (cents = 0, currency = 'USD') =>
  `${currency} ${(Number(cents || 0) / 100).toFixed(2)}`;

export default function AdAnalyticsScreen() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [campaigns, setCampaigns] = useState([]);
  const [selectedId, setSelectedId] = useState(searchParams.get('campaignId') || '');
  const [analytics, setAnalytics] = useState(null);
  const [loadingList, setLoadingList] = useState(true);
  const [loadingMetrics, setLoadingMetrics] = useState(false);

  useEffect(() => {
    let active = true;
    advertisingService
      .listAdCampaigns(50)
      .then((res) => {
        if (!active) return;
        const list = Array.isArray(res?.campaigns) ? res.campaigns : [];
        setCampaigns(list);
        if (!selectedId && list.length > 0) {
          setSelectedId(list[0].id);
        }
      })
      .catch((err) => {
        toast.error(err?.message || 'Failed to load campaigns.');
      })
      .finally(() => {
        if (active) setLoadingList(false);
      });
    return () => {
      active = false;
    };
  }, [selectedId]);

  const loadAnalytics = useCallback(async (id) => {
    if (!id) return;
    setLoadingMetrics(true);
    try {
      const res = await advertisingService.getAdCampaignAnalytics(id);
      setAnalytics(res || null);
    } catch (err) {
      toast.error(err?.message || 'Unable to load campaign analytics.');
      setAnalytics(null);
    } finally {
      setLoadingMetrics(false);
    }
  }, []);

  useEffect(() => {
    if (selectedId) {
      loadAnalytics(selectedId);
    }
  }, [selectedId, loadAnalytics]);

  const handleSelectChange = (val) => {
    setSelectedId(val);
    setSearchParams(val ? { campaignId: val } : {});
  };

  const handleRecordTestConversion = async () => {
    if (!selectedId) return;
    try {
      await advertisingService.trackAdConversion({
        campaignId: selectedId,
        eventType: 'conversion',
        valueCents: 0,
      });
      toast.success('Attribution event recorded.');
      await loadAnalytics(selectedId);
    } catch (err) {
      toast.error(err?.message || 'Failed to record conversion.');
    }
  };

  const summary = analytics?.summary || {};
  const daily = Array.isArray(analytics?.daily) ? analytics.daily : [];
  const currency = analytics?.campaign?.currency || 'USD';

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
                Paid Campaign Analytics
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Server-authoritative paid impressions, reach, CTR, CPM, CPC, and conversions
              </p>
            </div>
          </div>

          {selectedId && (
            <button
              type="button"
              onClick={handleRecordTestConversion}
              className="min-h-[40px] px-4 py-2 rounded-xl text-white text-xs font-semibold"
              style={{ background: BRAND_GRADIENT }}
            >
              Verify Conversion Pixel
            </button>
          )}
        </div>

        <div className={`${SURFACE_GLASS_CLASS} p-4`}>
          <label htmlFor="analytics-campaign-select" className="block text-xs font-medium mb-1.5">
            Select Campaign
          </label>
          {loadingList ? (
            <p className="text-xs text-slate-400">Loading campaigns...</p>
          ) : campaigns.length === 0 ? (
            <p className="text-xs text-slate-500 dark:text-slate-400">
              No campaigns available. Create a campaign first.
            </p>
          ) : (
            <select
              id="analytics-campaign-select"
              value={selectedId}
              onChange={(e) => handleSelectChange(e.target.value)}
              className={INPUT_CLASS}
            >
              {campaigns.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title} ({c.status})
                </option>
              ))}
            </select>
          )}
        </div>

        {loadingMetrics ? (
          <div className={`${SURFACE_GLASS_CLASS} p-12 flex justify-center`}>
            <LoadingSpinner size="md" />
          </div>
        ) : analytics ? (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 tabular-nums">
              {[
                { label: 'Paid Impressions', value: Number(summary.impressions || 0).toLocaleString() },
                { label: 'Unique Paid Reach', value: Number(summary.reach || 0).toLocaleString() },
                { label: 'Clicks', value: Number(summary.clicks || 0).toLocaleString() },
                { label: 'CTR', value: `${Number(summary.ctr || 0).toFixed(2)}%` },
                { label: 'Total Spend', value: fmtMoney(summary.spendCents, currency) },
                { label: 'CPM', value: fmtMoney(summary.cpmCents, currency) },
                { label: 'CPC', value: fmtMoney(summary.cpcCents, currency) },
                { label: 'Conversions', value: Number(summary.conversions || 0).toLocaleString() },
              ].map((stat) => (
                <div key={stat.label} className={`${SURFACE_GLASS_CLASS} p-4`}>
                  <span className="text-xs text-slate-500 dark:text-slate-400 block">
                    {stat.label}
                  </span>
                  <span className="text-lg font-bold mt-1 block">{stat.value}</span>
                </div>
              ))}
            </div>

            <div className={`${SURFACE_GLASS_CLASS} p-5 space-y-3`}>
              <h2 className="text-sm font-semibold">Daily Delivery Breakdown</h2>
              {daily.length === 0 ? (
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  No daily paid delivery events recorded yet for this campaign.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="border-b border-slate-200 dark:border-white/10 text-slate-500 dark:text-slate-400">
                      <tr>
                        <th className="py-2 pr-4 font-medium">Date</th>
                        <th className="py-2 pr-4 font-medium text-right">Impressions</th>
                        <th className="py-2 pr-4 font-medium text-right">Clicks</th>
                        <th className="py-2 pr-4 font-medium text-right">Conversions</th>
                        <th className="py-2 font-medium text-right">Spend</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200/60 dark:divide-white/5 tabular-nums">
                      {daily.map((row) => (
                        <tr key={row.id || row.dateKey}>
                          <td className="py-2.5 pr-4 font-medium">{row.dateKey}</td>
                          <td className="py-2.5 pr-4 text-right">{Number(row.impressions || 0).toLocaleString()}</td>
                          <td className="py-2.5 pr-4 text-right">{Number(row.clicks || 0).toLocaleString()}</td>
                          <td className="py-2.5 pr-4 text-right">{Number(row.conversions || 0).toLocaleString()}</td>
                          <td className="py-2.5 text-right font-semibold">{fmtMoney(row.spendCents, currency)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
