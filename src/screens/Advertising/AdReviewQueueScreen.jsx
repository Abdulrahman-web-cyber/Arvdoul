// src/screens/Advertising/AdReviewQueueScreen.jsx
import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import * as Icons from 'lucide-react';
import { toast } from 'sonner';
import advertisingService from '../../services/advertisingService.js';
import { INPUT_CLASS, SURFACE_GLASS_CLASS } from '../CreatePost/createPostConstants.js';
import LoadingSpinner from '../../components/Shared/LoadingSpinner.jsx';

export default function AdReviewQueueScreen() {
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState('pending_review');
  const [reviews, setReviews] = useState([]);
  const [disputes, setDisputes] = useState([]);
  const [notesById, setNotesById] = useState({});
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);

  const loadQueue = useCallback(async () => {
    setLoading(true);
    try {
      const res = await advertisingService.listAdModerationQueue(statusFilter);
      setReviews(Array.isArray(res?.reviews) ? res.reviews : []);
      setDisputes(Array.isArray(res?.disputes) ? res.disputes : []);
    } catch (err) {
      toast.error(err?.message || 'Failed to load ad moderation queue.');
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    loadQueue();
  }, [loadQueue]);

  const handleReviewDecision = async (review, decision) => {
    setBusyId(review.id);
    try {
      await advertisingService.reviewAdCampaign({
        campaignId: review.campaignId,
        reviewId: review.id,
        decision,
        notes: notesById[review.id] || '',
      });
      toast.success(`Campaign ${decision}.`);
      await loadQueue();
    } catch (err) {
      toast.error(err?.message || 'Failed to submit moderation decision.');
    } finally {
      setBusyId(null);
    }
  };

  const handleResolveDispute = async (dispute, decision) => {
    setBusyId(dispute.id);
    try {
      await advertisingService.adminResolveAdDispute({
        disputeId: dispute.id,
        decision,
        resolutionNotes: notesById[dispute.id] || '',
      });
      toast.success(`Dispute ${decision}.`);
      await loadQueue();
    } catch (err) {
      toast.error(err?.message || 'Failed to resolve ad billing dispute.');
    } finally {
      setBusyId(null);
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
              className="min-h-[42px] min-w-[42px] rounded-xl border border-slate-200 dark:border-white/15 flex items-center justify-center"
            >
              <Icons.ArrowLeft className="w-4 h-4" />
            </button>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight">
                Ad Policy &amp; Dispute Review Queue
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Admin moderation for ad campaigns and billing refund requests (audited to moderation_logs)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-200/70 dark:bg-white/[0.06]">
            {['pending_review', 'approved', 'rejected'].map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize ${
                  statusFilter === st
                    ? 'bg-white dark:bg-[#080F2E] text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                {st.replace('_', ' ')}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className={`${SURFACE_GLASS_CLASS} p-12 flex justify-center`}>
            <LoadingSpinner size="md" />
          </div>
        ) : (
          <div className="space-y-6">
            <section className="space-y-3">
              <h2 className="text-sm font-semibold">Campaign Reviews ({reviews.length})</h2>
              {reviews.length === 0 ? (
                <div className={`${SURFACE_GLASS_CLASS} p-6 text-xs text-slate-500 dark:text-slate-400`}>
                  No campaigns in this queue.
                </div>
              ) : (
                reviews.map((rev) => (
                  <div key={rev.id} className={`${SURFACE_GLASS_CLASS} p-4 space-y-3`}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold">
                          {rev.campaign?.title || `Campaign ${rev.campaignId}`}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          Advertiser: {rev.advertiserId}
                          {rev.sourcePostId ? ` · Source Post: ${rev.sourcePostId}` : ''}
                        </p>
                      </div>
                      <span className="text-xs font-semibold capitalize text-amber-600 dark:text-amber-300">
                        {rev.status?.replace('_', ' ')}
                      </span>
                    </div>
                    {rev.notes && (
                      <p className="text-xs text-slate-600 dark:text-slate-300">
                        Submitter note: {rev.notes}
                      </p>
                    )}
                    {rev.status === 'pending_review' && (
                      <div className="flex flex-col sm:flex-row gap-2">
                        <input
                          aria-label={`Reviewer notes for ${rev.campaignId}`}
                          type="text"
                          value={notesById[rev.id] || ''}
                          onChange={(e) =>
                            setNotesById((prev) => ({ ...prev, [rev.id]: e.target.value }))
                          }
                          placeholder="Optional policy review note..."
                          className={INPUT_CLASS}
                        />
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            disabled={busyId === rev.id}
                            onClick={() => handleReviewDecision(rev, 'approved')}
                            className="min-h-[40px] px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-semibold disabled:opacity-50"
                          >
                            Approve
                          </button>
                          <button
                            type="button"
                            disabled={busyId === rev.id}
                            onClick={() => handleReviewDecision(rev, 'rejected')}
                            className="min-h-[40px] px-4 py-2 rounded-xl bg-rose-600 text-white text-xs font-semibold disabled:opacity-50"
                          >
                            Reject
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))
              )}
            </section>

            <section className="space-y-3">
              <h2 className="text-sm font-semibold">Open Billing Disputes ({disputes.length})</h2>
              {disputes.length === 0 ? (
                <div className={`${SURFACE_GLASS_CLASS} p-6 text-xs text-slate-500 dark:text-slate-400`}>
                  No open advertiser billing disputes.
                </div>
              ) : (
                disputes.map((d) => (
                  <div key={d.id} className={`${SURFACE_GLASS_CLASS} p-4 space-y-3`}>
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold">{d.reason}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          Advertiser: {d.advertiserId}
                          {d.campaignId ? ` · Campaign: ${d.campaignId}` : ''}
                        </p>
                      </div>
                      <span className="text-sm font-bold tabular-nums">
                        USD {(Number(d.requestedAmountCents || 0) / 100).toFixed(2)}
                      </span>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <input
                        aria-label={`Dispute resolution notes for ${d.id}`}
                        type="text"
                        value={notesById[d.id] || ''}
                        onChange={(e) =>
                          setNotesById((prev) => ({ ...prev, [d.id]: e.target.value }))
                        }
                        placeholder="Resolution notes..."
                        className={INPUT_CLASS}
                      />
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          disabled={busyId === d.id}
                          onClick={() => handleResolveDispute(d, 'approved')}
                          className="min-h-[40px] px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-semibold disabled:opacity-50"
                        >
                          Approve Refund
                        </button>
                        <button
                          type="button"
                          disabled={busyId === d.id}
                          onClick={() => handleResolveDispute(d, 'rejected')}
                          className="min-h-[40px] px-4 py-2 rounded-xl bg-rose-600 text-white text-xs font-semibold disabled:opacity-50"
                        >
                          Reject
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
