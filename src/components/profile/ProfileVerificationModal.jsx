/**
 * Production-grade Verification Modal for Arvdoul Profile Screens.
 * 
 * Supports two distinct modes:
 * 1. Verified Account Info: When the user is already verified, displays authentication seal,
 *    civic credential standing, verified badge, and official trust guarantees.
 * 2. Verification Application: When unverified, explains the verification standards,
 *    evaluates requirement checklist (CREATOR_VERIFICATION_REQUIREMENTS), checks for pending
 *    application, and allows the creator to submit an application to creator_verifications.
 * 
 * @component
 */

import React, { memo, useState, useEffect, useCallback } from 'react';
import { 
  X, 
  BadgeCheck, 
  ShieldCheck, 
  CheckCircle2, 
  Clock, 
  ExternalLink, 
  Sparkles, 
  AlertCircle,
  Send,
  Loader2,
  Lock,
  UserCheck
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '../../lib/utils';
import { getUserService } from '../../services/userService';
import { CREATOR_VERIFICATION_REQUIREMENTS } from '../../config/profileContracts.js';
import { LEVEL_GATES } from '../../shared/levelConfig.cjs';

const CATEGORIES = [
  'Content Creator / Artist',
  'Musician / Audio Producer',
  'Developer / Technologist',
  'Civic / Community Leader',
  'Journalist / Public Figure',
  'Entrepreneur / Business',
  'Other Notable Entity'
];

export const ProfileVerificationModal = memo(({
  isOpen,
  onClose,
  isVerified = false,
  profile = {},
  isOwner = false,
  theme = 'light',
  onVerificationSubmitted
}) => {
  const isDark = theme === 'dark';
  const userId = profile?.id || profile?.uid;

  const [category, setCategory] = useState(CATEGORIES[0]);
  const [statement, setStatement] = useState('');
  const [portfolioLink, setPortfolioLink] = useState(profile?.website || '');
  const [pendingApplication, setPendingApplication] = useState(null);
  const [loadingApp, setLoadingApp] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Load existing application if unverified and isOwner
  useEffect(() => {
    if (!isOpen || isVerified || !isOwner || !userId) return;
    let active = true;
    const fetchStatus = async () => {
      setLoadingApp(true);
      try {
        const userService = getUserService();
        const app = await userService.getVerificationApplication(userId);
        if (active) setPendingApplication(app);
      } catch (err) {
        console.warn('Failed to load application status:', err);
      } finally {
        if (active) setLoadingApp(false);
      }
    };
    fetchStatus();
    return () => { active = false; };
  }, [isOpen, isVerified, isOwner, userId]);

  if (!isOpen) return null;

  const userLevel = typeof profile?.level === 'number' ? profile.level : null;
  const requiredLevel = LEVEL_GATES?.verifiedPriority ?? 15;
  const isLevelEligible = userLevel !== null && userLevel >= requiredLevel;

  const handleSubmit = async (e) => {
    e?.preventDefault();
    if (submitting) return;

    if (!statement.trim() || statement.trim().length < 20) {
      toast.error('Please provide a brief statement (at least 20 characters) explaining your creator identity or public work.');
      return;
    }

    setSubmitting(true);
    const toastId = toast.loading('Submitting verification application...');

    try {
      const userService = getUserService();
      const res = await userService.submitVerificationApplication(userId, {
        applicantName: profile.displayName || 'Creator',
        username: profile.username || '',
        category,
        reason: statement.trim(),
        portfolioLink: portfolioLink.trim(),
        followerCount: profile.followerCount || 0,
        level: typeof profile.level === 'number' ? profile.level : 0,
      });

      if (res.success) {
        toast.success('🎉 Application submitted successfully! Our verification council will review it.', { id: toastId });
        setPendingApplication({
          status: 'pending',
          category,
          reason: statement.trim(),
          submittedAt: new Date()
        });
        onVerificationSubmitted?.();
      } else {
        toast.error(res.error || 'Failed to submit application', { id: toastId });
      }
    } catch (err) {
      toast.error(err?.message || 'Failed to submit application', { id: toastId });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className={cn(
          "relative w-full max-w-lg rounded-2xl sm:rounded-3xl border shadow-2xl overflow-hidden flex flex-col max-h-[90vh]",
          isDark 
            ? "bg-[#0b1021] border-white/10 text-white" 
            : "bg-white border-slate-200 text-slate-900"
        )}
      >
        {/* Header */}
        <div className={cn(
          "px-6 py-4 border-b flex items-center justify-between shrink-0",
          isDark ? "border-white/10 bg-white/[0.02]" : "border-slate-100 bg-slate-50/50"
        )}>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-purple-500/10 text-purple-500 flex items-center justify-center">
              <BadgeCheck className="w-5 h-5 fill-purple-600 text-white" />
            </div>
            <div>
              <h2 className="text-base font-bold leading-tight">
                {isVerified ? 'Verified Account' : 'Creator Verification'}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {isVerified ? 'Authentic Identity & Trust Seal' : 'Arvdoul Trust & Authenticity Seal'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-black/5 dark:hover:bg-white/10 text-slate-400 hover:text-slate-700 dark:hover:text-white transition cursor-pointer"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-5 text-sm">
          {isVerified ? (
            /* Mode 1: Already Verified */
            <div className="space-y-4 text-center py-4">
              <div className="relative mx-auto w-20 h-20 rounded-full p-[3px] bg-gradient-to-tr from-[#8B1EF3] to-[#00F0FF] shadow-[0_0_25px_rgba(139,30,243,0.35)] flex items-center justify-center">
                <div className="w-full h-full rounded-full bg-[#0b1021] flex items-center justify-center">
                  <BadgeCheck className="w-10 h-10 fill-[#8B1EF3] text-white" />
                </div>
                <div className="absolute -top-1 -right-1 text-cyan-400">
                  <Sparkles className="w-6 h-6 fill-cyan-400" />
                </div>
              </div>

              <div>
                <h3 className="text-lg font-black text-slate-900 dark:text-white">
                  {profile.displayName || 'Verified Member'}
                </h3>
                <p className="text-xs font-semibold text-purple-600 dark:text-purple-400">
                  @{profile.username || 'user'} • Authentic Verified Identity
                </p>
              </div>

              <div className={cn(
                "p-4 rounded-2xl border text-left space-y-2.5",
                isDark ? "bg-white/[0.03] border-white/10" : "bg-purple-50/50 border-purple-100"
              )}>
                <div className="flex items-center gap-2 text-xs font-bold text-slate-800 dark:text-slate-200">
                  <ShieldCheck className="w-4 h-4 text-emerald-500" />
                  <span>Civic Credential Verified</span>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                  This badge confirms that Arvdoul has established the authentic identity of this public entity or creator. It signifies active adherence to civic guidelines, platform reputation, and verified provenance.
                </p>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="w-full py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs transition cursor-pointer"
              >
                Close
              </button>
            </div>
          ) : (
            /* Mode 2: Unverified Application */
            <>
              {loadingApp ? (
                <div className="py-12 flex flex-col items-center justify-center gap-2 text-slate-400">
                  <Loader2 className="w-6 h-6 animate-spin text-purple-500" />
                  <span className="text-xs">Checking application status...</span>
                </div>
              ) : pendingApplication?.status === 'pending' ? (
                /* Already Pending Application */
                <div className="space-y-4 text-center py-4">
                  <div className="w-16 h-16 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center mx-auto">
                    <Clock className="w-8 h-8 animate-pulse" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900 dark:text-white">
                      Application Under Review
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
                      Your verification request has been received and is currently being reviewed by the Arvdoul council.
                    </p>
                  </div>

                  <div className={cn(
                    "p-3.5 rounded-xl border text-left text-xs space-y-1.5",
                    isDark ? "bg-white/[0.03] border-white/10" : "bg-slate-50 border-slate-200"
                  )}>
                    <div className="text-[11px] text-slate-400 font-semibold">Submitted Category</div>
                    <div className="font-bold">{pendingApplication.category || 'Creator'}</div>
                    {pendingApplication.reason && (
                      <>
                        <div className="text-[11px] text-slate-400 font-semibold pt-1">Statement</div>
                        <div className="text-slate-600 dark:text-slate-300 line-clamp-3">{pendingApplication.reason}</div>
                      </>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={onClose}
                    className="w-full py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs transition cursor-pointer"
                  >
                    Got It
                  </button>
                </div>
              ) : !isLevelEligible ? (
                /* Level Requirement Not Met */
                <div className="space-y-4 text-center py-4">
                  <div className="w-16 h-16 rounded-2xl bg-purple-500/10 text-purple-500 flex items-center justify-center mx-auto">
                    <Lock className="w-8 h-8 text-purple-500" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900 dark:text-white">
                      Level {requiredLevel} Required
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
                      Arvdoul creator verification unlocks once your account reaches Level {requiredLevel} standing.
                    </p>
                  </div>

                  <div className={cn(
                    "p-4 rounded-2xl border text-left space-y-3",
                    isDark ? "bg-white/[0.03] border-white/10" : "bg-purple-50/50 border-purple-100"
                  )}>
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-slate-700 dark:text-slate-300">Your Standing:</span>
                      <span className="font-black text-purple-600 dark:text-purple-400">
                        {userLevel !== null ? `Level ${userLevel}` : 'Unranked'}
                      </span>
                    </div>

                    <div className="space-y-1">
                      <div className="w-full bg-slate-200 dark:bg-white/10 h-2 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-gradient-to-r from-purple-600 to-cyan-500 rounded-full transition-all duration-500"
                          style={{ width: `${Math.min(100, Math.max(5, ((userLevel || 0) / requiredLevel) * 100))}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-[10px] text-slate-400 font-medium">
                        <span>Level {userLevel || 0}</span>
                        <span>Level {requiredLevel} Target</span>
                      </div>
                    </div>

                    <div className="text-[11px] text-slate-500 dark:text-slate-400 space-y-1 pt-1 border-t border-slate-100 dark:border-white/5">
                      <div className="font-bold text-slate-700 dark:text-slate-300">How to level up:</div>
                      <p>Share posts (+10 XP), receive likes and comments, stream (+1 XP/min), and build community trust.</p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={onClose}
                    className="w-full py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs transition cursor-pointer"
                  >
                    Got It
                  </button>
                </div>
              ) : (
                /* New Application Form */
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className={cn(
                    "p-3.5 rounded-xl border text-xs space-y-2",
                    isDark ? "bg-white/[0.03] border-white/10" : "bg-slate-50 border-slate-200"
                  )}>
                    <div className="font-bold flex items-center gap-1.5 text-slate-800 dark:text-slate-200">
                      <Sparkles className="w-3.5 h-3.5 text-purple-500" />
                      <span>Verification Standards</span>
                    </div>
                    <ul className="space-y-1 text-slate-500 dark:text-slate-400 text-[11px] list-disc pl-4">
                      <li>Authentic, notable individual or creator with consistent activity.</li>
                      <li>Profile adheres to Arvdoul community guidelines with zero active strikes.</li>
                      <li>Valid contact verification and public portfolio or reference.</li>
                    </ul>
                  </div>

                  {/* Category Picker */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      Creator Category
                    </label>
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      className={cn(
                        "w-full px-3 py-2 rounded-xl text-xs border outline-none transition cursor-pointer",
                        isDark 
                          ? "bg-slate-900 border-white/10 text-white focus:border-purple-500" 
                          : "bg-white border-slate-200 text-slate-900 focus:border-purple-600"
                      )}
                    >
                      {CATEGORIES.map((c) => (
                        <option key={c} value={c} className={isDark ? "bg-slate-900" : "bg-white"}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Public Link / Portfolio */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      Portfolio or Notable Work Link
                    </label>
                    <input
                      type="url"
                      value={portfolioLink}
                      onChange={(e) => setPortfolioLink(e.target.value)}
                      placeholder="https://yourportfolio.com or social link"
                      className={cn(
                        "w-full px-3 py-2 rounded-xl text-xs border outline-none transition",
                        isDark 
                          ? "bg-slate-900 border-white/10 text-white focus:border-purple-500" 
                          : "bg-white border-slate-200 text-slate-900 focus:border-purple-600"
                      )}
                    />
                  </div>

                  {/* Identity Statement */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                        Identity &amp; Relevance Statement
                      </label>
                      <span className="text-[10px] text-slate-400">
                        {statement.length}/500
                      </span>
                    </div>
                    <textarea
                      rows={3}
                      value={statement}
                      onChange={(e) => setStatement(e.target.value.slice(0, 500))}
                      placeholder="Describe your public creative work, brand, or contribution to the community..."
                      className={cn(
                        "w-full px-3 py-2 rounded-xl text-xs border outline-none transition resize-none",
                        isDark 
                          ? "bg-slate-900 border-white/10 text-white focus:border-purple-500" 
                          : "bg-white border-slate-200 text-slate-900 focus:border-purple-600"
                      )}
                    />
                  </div>

                  <div className="pt-2 flex items-center gap-3">
                    <button
                      type="button"
                      onClick={onClose}
                      disabled={submitting}
                      className={cn(
                        "flex-1 py-2.5 rounded-xl text-xs font-bold border transition cursor-pointer",
                        isDark 
                          ? "border-white/10 hover:bg-white/5 text-slate-300" 
                          : "border-slate-200 hover:bg-slate-50 text-slate-700"
                      )}
                    >
                      Cancel
                    </button>

                    <button
                      type="submit"
                      disabled={submitting || !statement.trim()}
                      className="flex-1 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                    >
                      {submitting ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Submitting...</span>
                        </>
                      ) : (
                        <>
                          <Send className="w-4 h-4" />
                          <span>Submit Request</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
});

ProfileVerificationModal.displayName = 'ProfileVerificationModal';
export default ProfileVerificationModal;
