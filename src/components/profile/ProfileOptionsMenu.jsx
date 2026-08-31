// src/components/profile/ProfileOptionsMenu.jsx - ARVDOUL PROFILE OPTIONS MENU (REAL)
// Share, copy link, block/unblock, report — backed by userService.
import React, { useState, useCallback } from 'react';
import { toast } from 'sonner';
import { useAuth } from '../../context/AuthContext';
import { cn } from '../../lib/utils';
import {
  Share2, Link2, Ban, ShieldAlert, Loader2, X, UserX, BadgeCheck
} from 'lucide-react';

const ProfileOptionsMenu = ({ profile, isOwner = false, onClose, theme = 'light' }) => {
  const { user } = useAuth();
  const [busy, setBusy] = useState(null);
  const [blocked, setBlocked] = useState(false);

  const userId = profile?.uid || profile?.id;
  const profileUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/profile/${userId}`
    : `https://arvdoul.app/profile/${userId}`;

  const isDark = theme === 'dark';
  const itemCls = cn(
    'w-full flex items-center gap-3 px-4 py-3 text-sm font-medium transition hover:opacity-90',
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

  const handleReport = useCallback(async () => {
    if (!user?.uid || busy) return;
    const reason = window.prompt('Why are you reporting this profile? (spam, harassment, impersonation…)');
    if (!reason) return;
    setBusy('report');
    try {
      const { getUserService } = await import('../../services/userService.js');
      await getUserService().reportUser(user.uid, userId, reason, 'profile');
      toast.success('Report submitted. Our team will review it.');
      onClose?.();
    } catch (err) {
      toast.error('Could not submit report.');
    } finally {
      setBusy(null);
    }
  }, [user?.uid, userId, busy, onClose]);

  return (
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
          <button className={itemCls} onClick={handleReport}>
            {busy === 'report' ? <Loader2 className="w-4 h-4 animate-spin text-amber-500" /> : <ShieldAlert className="w-4 h-4 text-amber-500" />}
            Report Profile
          </button>
        </>
      )}
    </div>
  );
};

export default ProfileOptionsMenu;
