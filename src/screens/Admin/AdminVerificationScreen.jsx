// src/screens/Admin/AdminVerificationScreen.jsx

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import {
  ArrowLeft,
  CheckCircle2,
  ShieldCheck,
  Search,
  UserCheck,
  AlertTriangle,
  ExternalLink,
} from 'lucide-react';
import { callFunction, FUNCTIONS } from '../../services/callableService.js';
import { CREATOR_VERIFICATION_REQUIREMENTS } from '../../config/profileContracts.js';
import { getRankTitle } from '../../services/levelSystemService.js';

const AdminVerificationScreen = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('pending'); // 'all' | 'pending' | 'approved' | 'rejected'
  const [searchQuery, setSearchQuery] = useState('');

  // Real verification queue — populated only from Firestore.
  const [applicants, setApplicants] = useState([]);

  // Load the real verification queue. creator_verifications is readable by
  // admins; an empty collection is an honest empty state, not a seeded list.
  useEffect(() => {
    const loadApplications = async () => {
      setLoading(true);
      try {
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
  }, []);

  // Decisions go through applyVerificationDecision: the callable writes the
  // application, flips the user's badge, and audits — all server-side.
  const decide = async (applicant, decision, reason) => {
    try {
      await callFunction(FUNCTIONS.APPLY_VERIFICATION_DECISION, {
        applicationId: applicant.id,
        decision,
        reason: reason || '',
      });
      setApplicants(prev =>
        prev.map(a => (a.id === applicant.id ? { ...a, status: decision } : a))
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

  const handleApprove = applicant => decide(applicant, 'approved');

  const handleReject = applicant => {
    const reason = window.prompt('Specify reason for verification decline:');
    if (!reason) return;
    decide(applicant, 'rejected', reason);
  };

  const filteredApplicants = applicants.filter(a => {
    if (filter !== 'all' && a.status !== filter) return false;
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      String(a.displayName || '').toLowerCase().includes(q) ||
      String(a.handle || '').toLowerCase().includes(q) ||
      String(a.category || '').toLowerCase().includes(q)
    );
  });

  return (
    <div id="admin-verification-screen" className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100">
      {/* Top Bar */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              id="back-btn-verification"
              onClick={() => navigate('/admin')}
              className="p-2 rounded-xl text-gray-500 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 transition"
              aria-label="Back to Admin"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Creator Verification</h1>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300 flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  Badge Gateway
                </span>
              </div>
              <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                Review credentials, citizenship standing, and grant verified creator privileges
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 bg-gray-100 dark:bg-gray-750 p-1 rounded-xl">
            {['pending', 'approved', 'rejected', 'all'].map(status => (
              <button
                key={status}
                onClick={() => setFilter(status)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition ${
                  filter === status
                    ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                    : 'text-gray-500 hover:text-gray-900 dark:hover:text-gray-200'
                }`}
              >
                {status}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {/* Search Bar */}
        <div className="mb-6 flex items-center justify-between gap-4">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search creator name or handle..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 text-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500"
            />
          </div>
          <div className="text-xs text-gray-500 font-medium">
            {loading ? 'Loading applicants…' : `Showing ${filteredApplicants.length} applicants`}
          </div>
        </div>

        {/* Applicants Grid */}
        {!loading && filteredApplicants.length === 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-12 text-center text-sm text-gray-500 dark:text-gray-400">
            {applicants.length === 0
              ? 'No verification applications have been submitted yet.'
              : 'No applications match this filter.'}
          </div>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredApplicants.map(applicant => {
            const followerCount = Number(applicant.followerCount ?? applicant.followersCount ?? 0);
            const strikesCount = Number(applicant.strikesCount ?? 0);
            const emailVerified = Boolean(applicant.emailVerified);
            const phoneVerified = Boolean(applicant.phoneVerified);
            const meetsFollowers = followerCount >= CREATOR_VERIFICATION_REQUIREMENTS.MIN_FOLLOWERS;
            const meetsStrikes = strikesCount <= CREATOR_VERIFICATION_REQUIREMENTS.MAX_STRIKES;
            const meetsVerification =
              (!CREATOR_VERIFICATION_REQUIREMENTS.REQUIRE_EMAIL_VERIFIED || emailVerified) &&
              (!CREATOR_VERIFICATION_REQUIREMENTS.REQUIRE_PHONE_VERIFIED || phoneVerified);
            const isFullyEligible = meetsFollowers && meetsStrikes && meetsVerification;

            return (
              <div
                key={applicant.id}
                className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 flex flex-col justify-between shadow-sm hover:shadow-md transition"
              >
                <div>
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <h3 className="font-bold text-base text-gray-900 dark:text-white">{applicant.displayName || applicant.userId}</h3>
                        {applicant.status === 'approved' && (
                          <CheckCircle2 className="w-4 h-4 text-blue-500 fill-blue-500 text-white" />
                        )}
                      </div>
                      <p className="text-xs text-gray-500">{applicant.handle || applicant.userId}</p>
                    </div>
                    <span
                      className={`px-2.5 py-1 rounded-full text-xs font-bold capitalize ${
                        applicant.status === 'approved'
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300'
                          : applicant.status === 'rejected'
                          ? 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300'
                          : 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300'
                      }`}
                    >
                      {applicant.status}
                    </span>
                  </div>

                  {/* Eligibility verdict from the shared requirements contract */}
                  <div className={`mb-4 px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 ${
                    isFullyEligible
                      ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                      : 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
                  }`}>
                    {isFullyEligible ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
                    {isFullyEligible ? 'Meets every badge requirement' : 'Does not meet all badge requirements'}
                  </div>

                  {/* Bio & Category */}
                  <div className="mb-4">
                    <span className="inline-block px-2 py-0.5 rounded text-xs font-semibold bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 mb-2">
                      {applicant.category || 'Uncategorised'}
                    </span>
                    <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-2">{applicant.bio || 'No bio provided.'}</p>
                  </div>

                  {/* Standing Checklist */}
                  <div className="space-y-2 p-3 bg-gray-50 dark:bg-gray-750 rounded-xl mb-4 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-500">Citizenship:</span>
                      <span className="font-bold text-violet-600 dark:text-violet-400">
                        {applicant.citizenshipTier || getRankTitle(applicant.level || 0)} (Lvl {applicant.level ?? '—'})
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-gray-500">Followers:</span>
                      <span className={`font-semibold ${meetsFollowers ? 'text-emerald-600' : 'text-red-500'}`}>
                        {followerCount.toLocaleString()} {meetsFollowers ? '✓' : `(Min ${CREATOR_VERIFICATION_REQUIREMENTS.MIN_FOLLOWERS.toLocaleString()})`}
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-gray-500">Policy Strikes:</span>
                      <span className={`font-semibold ${meetsStrikes ? 'text-emerald-600' : 'text-red-600 font-bold'}`}>
                        {strikesCount} strikes {meetsStrikes ? '✓' : '⚠️ Strike Active'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-gray-500">Identity Security:</span>
                      <div className="flex items-center gap-1.5">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${emailVerified ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                          Email {emailVerified ? '✓' : '✗'}
                        </span>
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${phoneVerified ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
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
                      className="inline-flex items-center gap-1 text-xs text-indigo-600 dark:text-indigo-400 hover:underline mb-4"
                    >
                      <span>View Portfolio / External Works</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>

                {/* Actions */}
                {applicant.status === 'pending' ? (
                  <div className="flex items-center gap-2 pt-2 border-t border-gray-100 dark:border-gray-700">
                    <button
                      id={`approve-${applicant.id}`}
                      onClick={() => handleApprove(applicant)}
                      className="flex-1 py-2 text-xs font-semibold bg-violet-600 hover:bg-violet-700 text-white rounded-xl transition flex items-center justify-center gap-1.5 shadow-sm"
                    >
                      <UserCheck className="w-4 h-4" />
                      Grant Badge
                    </button>
                    <button
                      id={`reject-${applicant.id}`}
                      onClick={() => handleReject(applicant)}
                      className="px-3 py-2 text-xs font-semibold bg-gray-100 hover:bg-red-50 text-gray-700 hover:text-red-700 dark:bg-gray-700 dark:hover:bg-red-900/40 dark:text-gray-300 dark:hover:text-red-300 rounded-xl transition"
                    >
                      Decline
                    </button>
                  </div>
                ) : (
                  <div className="pt-3 border-t border-gray-100 dark:border-gray-700 text-xs text-gray-400 text-center">
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
