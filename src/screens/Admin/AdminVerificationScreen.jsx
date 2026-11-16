// src/screens/Admin/AdminVerificationScreen.jsx

import { useState, useEffect } from "react";
import { usePrompt } from '../../components/Shared/ConfirmProvider.jsx';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import {
  CheckCircle2,
  Search,
  UserCheck,
  AlertTriangle,
  ExternalLink,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { callFunction, FUNCTIONS, fetchAdminStatus } from '../../services/callableService.js';
import { CREATOR_VERIFICATION_REQUIREMENTS } from '../../config/profileContracts.js';
import { getRankTitle } from '../../services/levelSystemService.js';
import PermissionDenied from '../../design-system/PermissionDenied.jsx';
import AdminNavHeader from '../../components/Admin/AdminNavHeader.jsx';

const AdminVerificationScreen = () => {
  const prompt = usePrompt();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [denied, setDenied] = useState(false);
  const [filter, setFilter] = useState('pending');
  const [searchQuery, setSearchQuery] = useState('');
  const [applicants, setApplicants] = useState([]);

  useEffect(() => {
    const loadApplications = async () => {
      setLoading(true);
      try {
        if (!user?.uid || !(await fetchAdminStatus())) {
          setDenied(true);
          setLoading(false);
          return;
        }
        const { getAdminService } = await import('../../services/adminService.js');
        const rows = await getAdminService().listVerificationApplications(50);
        setApplicants(rows);
      } catch {
        toast.error('Could not load creator verification applications.');
        setApplicants([]);
      } finally {
        setLoading(false);
      }
    };
    loadApplications();
  }, [user?.uid]);

  const decide = async (applicant, decision, reason) => {
    try {
      await callFunction(FUNCTIONS.APPLY_VERIFICATION_DECISION, {
        applicationId: applicant.id,
        decision,
        reason: reason || '',
      });
      setApplicants((prev) =>
        prev.map((a) => (a.id === applicant.id ? { ...a, status: decision } : a))
      );
      toast.success(
        decision === 'approved'
          ? `Creator badge granted to ${applicant.displayName || applicant.handle || applicant.userId}.`
          : `Application ${applicant.id} declined.`
      );
    } catch {
      toast.error(`Could not record the ${decision} decision.`);
    }
  };

  const handleApprove = (applicant) => decide(applicant, 'approved');

  const handleReject = async (applicant) => {
    const reason = await prompt({
      title: 'Decline verification',
      description: 'Explain why this verification request is declined.',
      placeholder: 'Reason',
      confirmText: 'Decline',
    });
    if (!reason) return;
    decide(applicant, 'rejected', reason);
  };

  const filteredApplicants = applicants.filter((a) => {
    if (filter !== 'all' && a.status !== filter) return false;
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      String(a.displayName || '').toLowerCase().includes(q) ||
      String(a.handle || '').toLowerCase().includes(q) ||
      String(a.category || '').toLowerCase().includes(q)
    );
  });

  if (denied) {
    return <PermissionDenied onGoHome={() => navigate('/')} />;
  }

  return (
    <div id="admin-verification-screen" className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      <AdminNavHeader
        title="Creator Verification"
        subtitle="Review credentials, citizenship standing, and grant verified creator privileges"
        actions={
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
            {['pending', 'approved', 'rejected', 'all'].map((status) => (
              <button
                key={status}
                type="button"
                onClick={() => setFilter(status)}
                className={`px-3 py-1 rounded-md text-xs font-semibold capitalize whitespace-nowrap shrink-0 transition cursor-pointer ${
                  filter === status
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                {status}
              </button>
            ))}
          </div>
        }
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              aria-label="Search creator name or handle"
              type="text"
              placeholder="Search creator name or handle..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-arvdoul-purple"
            />
          </div>
          <div className="text-xs text-slate-500 font-medium tabular-nums">
            {loading ? 'Loading applicants…' : `Showing ${filteredApplicants.length} applicants`}
          </div>
        </div>

        {!loading && filteredApplicants.length === 0 && (
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-12 text-center text-sm text-slate-500 dark:text-slate-400">
            {applicants.length === 0
              ? 'No verification applications have been submitted yet.'
              : 'No applications match this filter.'}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredApplicants.map((applicant) => {
            const rawFollowers = applicant.followerCount ?? applicant.followersCount ?? null;
            const followerCount = rawFollowers == null ? null : Number(rawFollowers);
            const strikesCount = applicant.strikesCount == null ? null : Number(applicant.strikesCount);
            const emailVerified = Boolean(applicant.emailVerified);
            const phoneVerified = Boolean(applicant.phoneVerified);
            const meetsFollowers = followerCount !== null && followerCount >= CREATOR_VERIFICATION_REQUIREMENTS.MIN_FOLLOWERS;
            const meetsStrikes = strikesCount !== null && strikesCount <= CREATOR_VERIFICATION_REQUIREMENTS.MAX_STRIKES;
            const meetsVerification =
              (!CREATOR_VERIFICATION_REQUIREMENTS.REQUIRE_EMAIL_VERIFIED || emailVerified) &&
              (!CREATOR_VERIFICATION_REQUIREMENTS.REQUIRE_PHONE_VERIFIED || phoneVerified);
            const isFullyEligible = meetsFollowers && meetsStrikes && meetsVerification;

            return (
              <div
                key={applicant.id}
                className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 flex flex-col justify-between gap-4"
              >
                <div>
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <h3 className="font-semibold text-base truncate">{applicant.displayName || applicant.userId}</h3>
                        {applicant.status === 'approved' && (
                          <CheckCircle2 className="w-4 h-4 text-blue-500 shrink-0" />
                        )}
                      </div>
                      <p className="text-xs text-slate-500 truncate">
                        {applicant.handle || applicant.userId}
                        {' · '}
                        {applicant.category || 'Uncategorised'}
                      </p>
                    </div>
                    <span
                      className={`text-xs font-semibold capitalize shrink-0 ${
                        applicant.status === 'approved'
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : applicant.status === 'rejected'
                            ? 'text-red-600 dark:text-red-400'
                            : 'text-amber-600 dark:text-amber-400'
                      }`}
                    >
                      {applicant.status}
                    </span>
                  </div>

                  <div
                    className={`mb-3 px-3 py-2 rounded-lg text-xs font-medium flex items-center gap-1.5 ${
                      isFullyEligible
                        ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                        : 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300'
                    }`}
                  >
                    {isFullyEligible ? <CheckCircle2 className="w-3.5 h-3.5 shrink-0" /> : <AlertTriangle className="w-3.5 h-3.5 shrink-0" />}
                    <span>{isFullyEligible ? 'Meets every badge requirement' : 'Does not meet all badge requirements'}</span>
                  </div>

                  <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2 mb-4">
                    {applicant.bio || 'No bio provided.'}
                  </p>

                  <div className="space-y-2 py-3 border-y border-slate-100 dark:border-slate-800 text-xs tabular-nums">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Citizenship</span>
                      <span className="font-semibold text-blue-600 dark:text-blue-400">
                        {applicant.citizenshipTier || (Number.isFinite(applicant.level) ? getRankTitle(applicant.level) : '—')} (Lvl {applicant.level ?? '—'})
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Followers</span>
                      <span className={`font-semibold ${meetsFollowers ? 'text-emerald-600' : 'text-red-500'}`}>
                        {followerCount === null ? '—' : followerCount.toLocaleString()} {meetsFollowers ? '✓' : `(Min ${CREATOR_VERIFICATION_REQUIREMENTS.MIN_FOLLOWERS.toLocaleString()})`}
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Policy Strikes</span>
                      <span className={`font-semibold ${meetsStrikes ? 'text-emerald-600' : 'text-red-600'}`}>
                        {strikesCount === null ? '—' : `${strikesCount} strikes ${meetsStrikes ? '✓' : '· Active Strike'}`}
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Identity Security</span>
                      <div className="flex items-center gap-2 font-medium">
                        <span className={emailVerified ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}>
                          Email {emailVerified ? '✓' : '✗'}
                        </span>
                        <span aria-hidden="true" className="text-slate-400">·</span>
                        <span className={phoneVerified ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}>
                          SMS {phoneVerified ? '✓' : '✗'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {applicant.portfolioUrl && (
                    <a
                      href={applicant.portfolioUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:underline mt-3"
                    >
                      <span>View Portfolio</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>

                {applicant.status === 'pending' ? (
                  <div className="flex items-center gap-2 pt-2">
                    <button
                      id={`approve-${applicant.id}`}
                      type="button"
                      onClick={() => handleApprove(applicant)}
                      className="flex-1 py-2 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <UserCheck className="w-4 h-4" />
                      Grant Badge
                    </button>
                    <button
                      id={`reject-${applicant.id}`}
                      type="button"
                      onClick={() => handleReject(applicant)}
                      className="px-3 py-2 text-xs font-semibold bg-slate-100 hover:bg-red-50 text-slate-700 hover:text-red-700 dark:bg-slate-800 dark:hover:bg-red-950/40 dark:text-slate-300 rounded-lg transition cursor-pointer"
                    >
                      Decline
                    </button>
                  </div>
                ) : (
                  <div className="pt-2 text-xs text-slate-400 text-center capitalize">
                    Decision recorded: {applicant.status}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default AdminVerificationScreen;
