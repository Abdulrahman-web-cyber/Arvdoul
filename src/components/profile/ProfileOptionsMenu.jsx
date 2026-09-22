// src/components/profile/ProfileOptionsMenu.jsx - ARVDOUL PROFILE OPTIONS MENU (REAL)
// Share, copy link, block/unblock, report — backed by userService.
import React, { useState, useCallback, useEffect } from 'react';
import { toast } from 'sonner';
import { useAuth } from '../../context/AuthContext';
import { cn } from '../../lib/utils';
import {
  Share2, Link2, Ban, ShieldAlert, Loader2, X, UserX, BadgeCheck, Flag
} from 'lucide-react';

const ProfileOptionsMenu = ({ profile, isOwner = false, onClose, theme = 'light' }) => {
  const { user } = useAuth();
  const [busy, setBusy] = useState(null);
  const [blocked, setBlocked] = useState(Boolean(profile?.isBlocked || profile?.isBlockedByViewer));
  const [showReportDialog, setShowReportDialog] = useState(false);
  const [reportReason, setReportReason] = useState('');

  const userId = profile?.uid || profile?.id;

  useEffect(() => {
    let active = true;
    if (user?.uid && userId && !isOwner) {
      import('../../services/userService.js').then(({ getUserService }) => {
        getUserService().isBlocked(user.uid, userId).then((res) => {
          if (active && res?.blocked !== undefined) {
            setBlocked(Boolean(res.blocked));
          }
        }).catch(() => {});
      });
    }
    return () => { active = false; };
  }, [user?.uid, userId, isOwner]);
  const profileUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/profile/${userId}`
    : `https://arvdoul.app/profile/${userId}`;

  const isDark = theme === 'dark';
  const itemCls = cn(
    'w-full flex items-center gap-3 px-4 py-3 text-sm font-medium transition hover:opacity-90 text-left',
    isDark ? 'text-gray-200' : 'text-gray-700'
  );

  const handleShare = useCallback(async () => {
    try {
      if (navigator.share) {
        await navigator.share({ title: `${profile?.displayName || 'Profile'} on Arvdoul`, url: profileUrl });
      } else {
        await navigator.clipboard.writeText(profileUrl);
        toast.success('Profile link copied!');
      }
      onClose?.();
    } catch (err) { /* user canceled */ }
  }, [profileUrl, profile, onClose]);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(profileUrl);
      toast.success('Profile link copied!');
      onClose?.();
    } catch (err) { toast.error('Could not copy link.'); }
  }, [profileUrl, onClose]);

  const handleBlock = useCallback(async () => {
    if (!user?.uid || busy) return;
    setBusy('block');
    try {
      const { getUserService } = await import('../../services/userService.js');
      const svc = getUserService();
      if (blocked) {
        await svc.unblockUser(user.uid, userId);
        setBlocked(false);
        toast.success('User unblocked.');
      } else {
        await svc.blockUser(user.uid, userId);
        setBlocked(true);
        toast.success('User blocked.');
      }
      onClose?.();
    } catch (err) {
      toast.error('Action failed.');
    } finally {
      setBusy(null);
    }
  }, [user?.uid, userId, blocked, busy, onClose]);

  const handleSubmitReport = useCallback(async (e) => {
    e?.preventDefault();
    if (!user?.uid || busy) return;
    const reason = reportReason.trim();
    if (!reason) {
      toast.error('Please enter a reason for reporting');
      return;
    }
    setBusy('report');
    try {
      const { getUserService } = await import('../../services/userService.js');
      await getUserService().reportUser(user.uid, userId, reason, 'profile');
      toast.success('Report submitted. Our team will review it.');
      setShowReportDialog(false);
      setReportReason('');
      onClose?.();
    } catch (err) {
      toast.error('Could not submit report.');
    } finally {
      setBusy(null);
    }
  }, [user?.uid, userId, reportReason, busy, onClose]);

  return (
    <>
      <div
        className={cn(
          "absolute right-0 top-12 z-50 w-56 rounded-2xl overflow-hidden shadow-2xl border backdrop-blur-xl",
          isDark ? "bg-gray-900/95 border-gray-700" : "bg-white/95 border-gray-200"
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={cn("flex items-center justify-between px-4 py-2.5 border-b", isDark ? "border-gray-700" : "border-gray-100")}>
          <span className={cn("text-xs font-semibold uppercase tracking-wide", isDark ? "text-gray-400" : "text-gray-500")}>Options</span>
          <button onClick={onClose} aria-label="Close menu" className={cn("p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800", isDark ? "text-gray-300" : "text-gray-500")}>
            <X className="w-4 h-4" />
          </button>
        </div>

        <button className={itemCls} onClick={handleShare}>
          <Share2 className="w-4 h-4 text-violet-500" /> Share Profile
        </button>
        <button className={itemCls} onClick={handleCopy}>
          <Link2 className="w-4 h-4 text-cyan-500" /> Copy Link
        </button>

        {!isOwner && (
          <>
            <div className={cn("mx-4 my-1 h-px", isDark ? "bg-gray-700" : "bg-gray-100")} />
            <button className={itemCls} onClick={handleBlock}>
              {busy === 'block' ? <Loader2 className="w-4 h-4 animate-spin text-red-500" /> : blocked
                ? <BadgeCheck className="w-4 h-4 text-green-500" /> : <UserX className="w-4 h-4 text-red-500" />}
              {blocked ? 'Unblock User' : 'Block User'}
            </button>
            <button className={itemCls} onClick={() => setShowReportDialog(true)}>
              <ShieldAlert className="w-4 h-4 text-amber-500" />
              Report Profile
            </button>
          </>
        )}
      </div>

      {showReportDialog && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={(e) => { e.stopPropagation(); setShowReportDialog(false); }}
        >
          <div
            className={cn(
              "w-full max-w-sm rounded-2xl p-5 shadow-2xl border relative",
              isDark ? "bg-gray-900 border-gray-800 text-white" : "bg-white border-gray-200 text-gray-900"
            )}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Flag className="w-5 h-5 text-amber-500" />
                <h3 className="font-bold text-base">Report Profile</h3>
              </div>
              <button
                onClick={() => setShowReportDialog(false)}
                className="p-1 rounded-full text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                aria-label="Close report dialog"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
              Why are you reporting @{profile?.username || profile?.displayName || 'this user'}?
            </p>

            <form onSubmit={handleSubmitReport} className="space-y-3">
              <textarea
                value={reportReason}
                onChange={(e) => setReportReason(e.target.value)}
                placeholder="Spam, harassment, inappropriate content, impersonation..."
                rows={3}
                maxLength={300}
                className={cn(
                  "w-full p-3 text-sm rounded-xl border resize-none focus:outline-none focus:ring-2 focus:ring-amber-500",
                  isDark ? "bg-gray-800 border-gray-700 text-white placeholder-gray-500" : "bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400"
                )}
              />

              <div className="flex items-center gap-2 justify-end pt-1">
                <button
                  type="button"
                  onClick={() => setShowReportDialog(false)}
                  className={cn(
                    "px-4 py-2 rounded-xl text-xs font-semibold",
                    isDark ? "bg-gray-800 text-gray-300 hover:bg-gray-700" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  )}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={busy === 'report' || !reportReason.trim()}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-amber-500 hover:bg-amber-600 text-black flex items-center gap-1.5 disabled:opacity-50"
                >
                  {busy === 'report' && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Submit Report
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};

export default ProfileOptionsMenu;
