// src/screens/Admin/AdminVerificationScreen.jsx

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import EmptyState from '../../components/UI/EmptyState';
import { toast } from 'sonner';
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  Clock,
  ShieldCheck,
  Search,
  Filter,
  UserCheck,
  Award,
  AlertTriangle,
  ExternalLink,
  Phone,
  Mail,
  Users,
  Sparkles,
  FileText,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { auditLogger } from '../../utils/AuditLogger.js';

const AdminVerificationScreen = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('pending'); // 'all' | 'pending' | 'approved' | 'rejected'
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedApplicant, setSelectedApplicant] = useState(null);

  // Applications are loaded from Firestore; no local seed data is ever shown.
  const [applicants, setApplicants] = useState([]);

  // Load applications from Firestore if available
  useEffect(() => {
    const loadApplications = async () => {
      try {
        const { collection, getDocs, query, limit, orderBy } = await import('firebase/firestore');
        const { getFirestoreInstance } = await import('../../firebase/firebase.js');
        const firestore = await getFirestoreInstance();

        try {
          const snap = await getDocs(
            query(collection(firestore, 'creator_verifications'), orderBy('submittedAt', 'desc'), limit(50))
          );
          setApplicants(
            snap.empty
              ? []
              : snap.docs.map(doc => ({ id: doc.id, ...doc.data() }))
          );
        } catch (e) {
          toast.error('Could not load creator verification applications.');
          setApplicants([]);
        }
      } catch (err) {
        toast.error('Could not load creator verification applications.');
      } finally {
        setLoading(false);
      }
    };
    loadApplications();
  }, []);

  // Approve verification
  const handleApprove = async applicant => {
    try {
      setApplicants(prev =>
        prev.map(a => (a.id === applicant.id ? { ...a, status: 'approved', approvedAt: new Date().toISOString() } : a))
      );

      // Audit log entry
      await auditLogger.log(user?.uid || 'admin', 'CREATOR_VERIFICATION_APPROVED', {
        applicantId: applicant.id,
        applicantUserId: applicant.userId,
        actorEmail: user?.email,
        timestamp: Date.now(),
      });

      // The server grants the badge so `isVerified`/`isCreator` stay
      // server-authoritative and the decision is audited atomically.
      const { getFunctions, httpsCallable } = await import('firebase/functions');
      const decide = httpsCallable(getFunctions(), 'applyVerificationDecision');
      await decide({ applicationId: applicant.id, decision: 'approved' });

      toast.success(`Creator badge granted to ${applicant.displayName} (@${applicant.handle})`);
      setSelectedApplicant(null);
    } catch (err) {
      toast.error('Failed to approve application');
    }
  };

  // Reject verification
  const handleReject = async applicant => {
    const reason = window.prompt('Specify reason for verification decline:');
    if (!reason) return;

    try {
      setApplicants(prev =>
        prev.map(a =>
          a.id === applicant.id ? { ...a, status: 'rejected', rejectionReason: reason, rejectedAt: new Date().toISOString() } : a
        )
      );

      await auditLogger.log(user?.uid || 'admin', 'CREATOR_VERIFICATION_REJECTED', {
        applicantId: applicant.id,
        applicantUserId: applicant.userId,
        reason,
        actorEmail: user?.email,
      });

      const { getFunctions, httpsCallable } = await import('firebase/functions');
      const decide = httpsCallable(getFunctions(), 'applyVerificationDecision');
      await decide({ applicationId: applicant.id, decision: 'rejected', reason });

      toast.info(`Application for @${applicant.handle} rejected: ${reason}`);
      setSelectedApplicant(null);
    } catch (err) {
      toast.error('Failed to reject application');
    }
  };

  const filteredApplicants = applicants.filter(a => {
    if (filter !== 'all' && a.status !== filter) return false;
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      a.displayName.toLowerCase().includes(q) ||
      a.handle.toLowerCase().includes(q) ||
      a.category.toLowerCase().includes(q)
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
            Showing {filteredApplicants.length} applicants
          </div>
        </div>

        {/* Applicants Grid */}
        {!loading && filteredApplicants.length === 0 && (
          <EmptyState
            icon={ShieldCheck}
            title={applicants.length === 0 ? 'No verification applications' : 'No matching applications'}
            description={
              applicants.length === 0
                ? 'Applications will appear here as creators submit them.'
                : 'No applications match the current filter or search.'
            }
            className="py-16"
          />
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredApplicants.map(applicant => {
            const meetsFollowers = applicant.followerCount >= 1000;
            const meetsStrikes = applicant.strikesCount === 0;
            const meetsVerification = applicant.phoneVerified && applicant.emailVerified;
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
                        <h3 className="font-bold text-base text-gray-900 dark:text-white">{applicant.displayName}</h3>
                        {applicant.status === 'approved' && (
                          <CheckCircle2 className="w-4 h-4 text-blue-500 fill-blue-500 text-white" />
                        )}
                      </div>
                      <p className="text-xs text-gray-500">{applicant.handle}</p>
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

                  {/* Bio & Category */}
                  <div className="mb-4">
                    <span className="inline-block px-2 py-0.5 rounded text-xs font-semibold bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 mb-2">
                      {applicant.category}
                    </span>
                    <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-2">{applicant.bio}</p>
                  </div>

                  {/* Standing Checklist */}
                  <div className="space-y-2 p-3 bg-gray-50 dark:bg-gray-750 rounded-xl mb-4 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-500">Citizenship:</span>
                      <span className="font-bold text-violet-600 dark:text-violet-400">
                        {applicant.citizenshipTier} (Lvl {applicant.level})
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-gray-500">Followers:</span>
                      <span className={`font-semibold ${meetsFollowers ? 'text-emerald-600' : 'text-red-500'}`}>
                        {applicant.followerCount.toLocaleString()} {meetsFollowers ? '✓' : '(Min 1,000)'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-gray-500">Policy Strikes:</span>
                      <span className={`font-semibold ${meetsStrikes ? 'text-emerald-600' : 'text-red-600 font-bold'}`}>
                        {applicant.strikesCount} strikes {meetsStrikes ? '✓' : '⚠️ Strike Active'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-gray-500">Identity Security:</span>
                      <div className="flex items-center gap-1.5">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${applicant.emailVerified ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                          Email {applicant.emailVerified ? '✓' : '✗'}
                        </span>
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${applicant.phoneVerified ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                          SMS {applicant.phoneVerified ? '✓' : '✗'}
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
