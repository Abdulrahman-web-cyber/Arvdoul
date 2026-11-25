// src/screens/CreatePost/sections/ComposerAnalyticsSection.jsx
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import * as Icons from 'lucide-react';
import { useAuth } from '../../../context/AuthContext.jsx';
import { SURFACE_GLASS_CLASS } from '../createPostConstants.js';
import { InsightsPanel } from '../ComposerPanels.jsx';
import { getUserAnalytics } from '../../../services/analyticsService.js';

export default function ComposerAnalyticsSection() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [baseline, setBaseline] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;
    if (!user?.uid) return undefined;
    setLoading(true);
    getUserAnalytics(user.uid, '30d')
      .then((res) => {
        if (active) setBaseline(res || null);
      })
      .catch((err) => {
        console.warn('[ComposerAnalyticsSection] Baseline analytics load skipped:', err?.message);
        if (active) setBaseline(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [user?.uid]);

  const reach30d =
    typeof baseline?.totalReach === 'number'
      ? baseline.totalReach.toLocaleString()
      : typeof baseline?.profileViews === 'number'
      ? baseline.profileViews.toLocaleString()
      : '—';
  const posts30d =
    typeof baseline?.postsCount === 'number'
      ? baseline.postsCount.toLocaleString()
      : typeof baseline?.totalPosts === 'number'
      ? baseline.totalPosts.toLocaleString()
      : '—';
  const engagementRate =
    typeof baseline?.engagementRate === 'number'
      ? `${baseline.engagementRate.toFixed(1)}%`
      : '—';

  return (
    <section
      id="composer-section-analytics"
      aria-labelledby="heading-analytics"
      className={`${SURFACE_GLASS_CLASS} p-4 sm:p-5 space-y-4`}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="w-8 h-8 rounded-xl bg-arvdoul-purple/12 text-arvdoul-purple flex items-center justify-center font-bold text-xs tabular-nums">
            08
          </span>
          <div>
            <h3 id="heading-analytics" className="text-sm font-semibold text-slate-900 dark:text-white">
              Analytics &amp; Performance Preview
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Your 30-day creator baseline paired with post heuristic forecast
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => navigate('/profile/analytics')}
          className="min-h-[38px] px-3 py-1.5 rounded-xl border border-slate-200 dark:border-white/15 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:border-arvdoul-purple/60 transition-colors flex items-center gap-1.5 whitespace-nowrap"
        >
          <Icons.BarChart3 className="w-3.5 h-3.5" aria-hidden="true" />
          <span>Creator Analytics</span>
        </button>
      </div>

      <div className="grid grid-cols-3 gap-2.5 text-xs tabular-nums">
        <div className="p-3 rounded-xl bg-slate-100/80 dark:bg-white/[0.04] border border-slate-200/70 dark:border-white/8">
          <span className="text-slate-500 dark:text-slate-400 block text-[11px]">30d Reach</span>
          <span className="font-semibold text-sm text-slate-900 dark:text-white">
            {loading ? '...' : reach30d}
          </span>
        </div>
        <div className="p-3 rounded-xl bg-slate-100/80 dark:bg-white/[0.04] border border-slate-200/70 dark:border-white/8">
          <span className="text-slate-500 dark:text-slate-400 block text-[11px]">Posts (30d)</span>
          <span className="font-semibold text-sm text-slate-900 dark:text-white">
            {loading ? '...' : posts30d}
          </span>
        </div>
        <div className="p-3 rounded-xl bg-slate-100/80 dark:bg-white/[0.04] border border-slate-200/70 dark:border-white/8">
          <span className="text-slate-500 dark:text-slate-400 block text-[11px]">Engagement</span>
          <span className="font-semibold text-sm text-slate-900 dark:text-white">
            {loading ? '...' : engagementRate}
          </span>
        </div>
      </div>

      <InsightsPanel defaultOpen={false} />
    </section>
  );
}
