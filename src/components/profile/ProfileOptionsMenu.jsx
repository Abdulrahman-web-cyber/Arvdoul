// src/components/profile/ProfileOptionsMenu.jsx
//
// Production-grade Arvdoul Options Modal Sheet.
// Full screen backdrop with responsive centered dialog,
// Arvdoul design tokens, and comprehensive citizen action controls.

import React, { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '../../context/AuthContext';
import { cn } from '../../lib/utils';
import {
  Share2, Link2, ShieldAlert, Loader2, X, UserX, BadgeCheck, Flag, VolumeX, Volume2, ShieldMinus,
  Eye, QrCode, Crown, Settings, Award, MapPin
} from 'lucide-react';
import { shareProfile, getProfileUrl, copyToClipboard } from '../../utils/shareUtils.js';

const ProfileOptionsMenu = ({ profile, isOwner = false, onClose, theme = 'light', capabilities }) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [busy, setBusy] = useState(null);
  const [blocked, setBlocked] = useState(Boolean(capabilities?.isBlocking || profile?.isBlocked || profile?.isBlockedByViewer));
  const [muted, setMuted] = useState(Boolean(capabilities?.isMuted || profile?.isMuted));
  const [restricted, setRestricted] = useState(Boolean(capabilities?.isRestricted || profile?.isRestricted));
  const [showReportDialog, setShowReportDialog] = useState(false);
  const [reportReason, setReportReason] = useState('');

  const userId = profile?.uid || profile?.id;

  useEffect(() => {
    let active = true;
    if (user?.uid && userId && !isOwner) {
      import('../../services/userService.js').then(({ getUserService }) => {
        const svc = getUserService();
        Promise.all([
          svc.isBlocked(user.uid, userId).catch(() => null),
          svc.isMuted(user.uid, userId).catch(() => null),
          svc.isRestricted(user.uid, userId).catch(() => null)
        ]).then(([bRes, mRes, rRes]) => {
          if (!active) return;
          if (bRes?.blocked !== undefined) setBlocked(Boolean(bRes.blocked));
          if (mRes?.muted !== undefined) setMuted(Boolean(mRes.muted));
          if (rRes?.restricted !== undefined) setRestricted(Boolean(rRes.restricted));
        });
      });
    }
    return () => { active = false; };
  }, [user?.uid, userId, isOwner]);

  const profileUrl = getProfileUrl(profile || { uid: userId });
  const isDark = theme === 'dark';

  const itemCls = cn(
    'w-full flex items-center justify-between px-4 py-3 rounded-2xl text-sm font-semibold transition-all cursor-pointer active:scale-[0.99]',
    isDark
      ? 'text-white hover:bg-white/[0.07] border border-transparent hover:border-white/10'
      : 'text-slate-800 hover:bg-slate-100 border border-transparent hover:border-slate-200 shadow-sm hover:shadow'
  );

  const handleShare = useCallback(async () => {
    try {
      const res = await shareProfile(profile || { uid: userId });
      if (res?.copied) {
        toast.success('Profile link copied to clipboard!');
      }
      onClose?.();
    } catch {
      // user canceled
    }
  }, [profile, userId, onClose]);

  const handleCopy = useCallback(async () => {
    try {
      const copied = await copyToClipboard(profileUrl);
      if (copied) {
        toast.success('Profile link copied to clipboard!');
      } else {
        toast.error('Could not copy link.');
      }
      onClose?.();
    } catch {
      toast.error('Could not copy link.');
    }
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
    } catch {
      toast.error('Action failed.');
    } finally {
      setBusy(null);
    }
  }, [user?.uid, userId, blocked, busy, onClose]);

  const handleMute = useCallback(async () => {
    if (!user?.uid || busy) return;
    setBusy('mute');
    try {
      const { getUserService } = await import('../../services/userService.js');
      const svc = getUserService();
      if (muted) {
        await svc.unmuteUser(user.uid, userId);
        setMuted(false);
        toast.success('User unmuted.');
      } else {
        await svc.muteUser(user.uid, userId);
        setMuted(true);
        toast.success('User muted.');
      }
      onClose?.();
    } catch {
      toast.error('Action failed.');
    } finally {
      setBusy(null);
    }
  }, [user?.uid, userId, muted, busy, onClose]);

  const handleRestrict = useCallback(async () => {
    if (!user?.uid || busy) return;
    setBusy('restrict');
    try {
      const { getUserService } = await import('../../services/userService.js');
      const svc = getUserService();
      if (restricted) {
        await svc.unrestrictUser(user.uid, userId);
        setRestricted(false);
        toast.success('Restriction removed.');
      } else {
        await svc.restrictUser(user.uid, userId);
        setRestricted(true);
        toast.success('User restricted.');
      }
      onClose?.();
    } catch {
      toast.error('Action failed.');
    } finally {
      setBusy(null);
    }
  }, [user?.uid, userId, restricted, busy, onClose]);

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
    } catch {
      toast.error('Could not submit report.');
    } finally {
      setBusy(null);
    }
  }, [user?.uid, userId, reportReason, busy, onClose]);

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/70 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className={cn(
          "w-full max-w-sm max-sm:rounded-b-none max-sm:rounded-t-[30px] sm:rounded-[28px] overflow-hidden shadow-2xl border transition-all relative z-[10000]",
          isDark
            ? "bg-[#070D27] border-white/[0.15] text-white shadow-[0_24px_64px_rgba(0,0,0,0.9)]"
            : "bg-white border-slate-200 text-slate-900 shadow-[0_20px_50px_rgba(15,23,42,0.22)]"
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Optical Hairline Highlight */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-[2px]"
          style={{
            background: "linear-gradient(90deg, #C82BFF 0%, #8B1EF3 34%, #4431F7 66%, #0088FF 100%)",
          }}
        />

        {/* Dialog Header */}
        <div className={cn(
          "flex items-center justify-between px-5 py-4 border-b",
          isDark ? "border-white/[0.08]" : "border-slate-100"
        )}>
          <div className="flex items-center gap-2">
            <span className="text-sm font-black tracking-tight">Profile Options</span>
            {profile?.username && (
              <span className="text-xs font-mono text-[#8B1EF3] dark:text-[#B978FF]">
                @{profile.username}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            aria-label="Close menu"
            className={cn(
              "p-1.5 rounded-full transition-colors cursor-pointer",
              isDark ? "hover:bg-white/10 text-slate-400 hover:text-white" : "hover:bg-slate-100 text-slate-500 hover:text-slate-900"
            )}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Action List */}
        <div className="p-3 space-y-1 max-h-[75vh] overflow-y-auto">
          <button className={itemCls} onClick={handleShare}>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center">
                <Share2 className="w-4 h-4" />
              </div>
              <span>Share Profile</span>
            </div>
          </button>

          <button className={itemCls} onClick={handleCopy}>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-cyan-500/10 text-cyan-400 flex items-center justify-center">
                <Link2 className="w-4 h-4" />
              </div>
              <span>Copy Profile Link</span>
            </div>
          </button>

          {isOwner && (
            <>
              <div className={cn("my-2 h-px", isDark ? "bg-white/[0.08]" : "bg-slate-100")} />

              <button
                className={itemCls}
                onClick={() => {
                  onClose?.();
                  window.dispatchEvent(new CustomEvent('arvdoul:open_perspective_modal'));
                }}
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center">
                    <Eye className="w-4 h-4" />
                  </div>
                  <span>View Profile As...</span>
                </div>
                <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider bg-amber-500/10 px-2 py-0.5 rounded-md">
                  Preview
                </span>
              </button>

              <button
                className={itemCls}
                onClick={() => {
                  onClose?.();
                  window.dispatchEvent(new CustomEvent('arvdoul:open_qr_code'));
                }}
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center">
                    <QrCode className="w-4 h-4" />
                  </div>
                  <span>Identity QR Code</span>
                </div>
              </button>

              <button
                className={itemCls}
                onClick={() => {
                  onClose?.();
                  navigate('/passport');
                }}
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center">
                    <Crown className="w-4 h-4" />
                  </div>
                  <span>Digital Passport</span>
                </div>
              </button>

              <button
                className={itemCls}
                onClick={() => {
                  onClose?.();
                  navigate('/titles');
                }}
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-rose-500/10 text-rose-400 flex items-center justify-center">
                    <Award className="w-4 h-4" />
                  </div>
                  <span>Civic Titles & Provenance</span>
                </div>
              </button>

              <button
                className={itemCls}
                onClick={() => {
                  onClose?.();
                  window.dispatchEvent(new CustomEvent('arvdoul:open_location_setup'));
                }}
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
                    <MapPin className="w-4 h-4" />
                  </div>
                  <span>Civic Location</span>
                </div>
              </button>

              <button
                className={itemCls}
                onClick={() => {
                  onClose?.();
                  navigate('/settings');
                }}
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-slate-500/10 text-slate-400 flex items-center justify-center">
                    <Settings className="w-4 h-4" />
                  </div>
                  <span>Account Settings</span>
                </div>
              </button>
            </>
          )}

          {!isOwner && (
            <>
              <div className={cn("my-2 h-px", isDark ? "bg-white/[0.08]" : "bg-slate-100")} />

              <button
                className={itemCls}
                onClick={() => {
                  onClose?.();
                  navigate(`/passport/${userId}`);
                }}
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center">
                    <Crown className="w-4 h-4" />
                  </div>
                  <span>Inspect Passport</span>
                </div>
              </button>

              <button className={itemCls} onClick={handleMute}>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center">
                    {busy === 'mute' ? <Loader2 className="w-4 h-4 animate-spin" /> : muted ? <Volume2 className="w-4 h-4 text-emerald-400" /> : <VolumeX className="w-4 h-4" />}
                  </div>
                  <span>{muted ? 'Unmute Profile' : 'Mute Profile'}</span>
                </div>
              </button>

              <button className={itemCls} onClick={handleRestrict}>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center">
                    {busy === 'restrict' ? <Loader2 className="w-4 h-4 animate-spin" /> : restricted ? <BadgeCheck className="w-4 h-4 text-emerald-400" /> : <ShieldMinus className="w-4 h-4" />}
                  </div>
                  <span>{restricted ? 'Unrestrict Profile' : 'Restrict Profile'}</span>
                </div>
              </button>

              <button className={itemCls} onClick={handleBlock}>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-rose-500/10 text-rose-400 flex items-center justify-center">
                    {busy === 'block' ? <Loader2 className="w-4 h-4 animate-spin" /> : blocked ? <BadgeCheck className="w-4 h-4 text-emerald-400" /> : <UserX className="w-4 h-4" />}
                  </div>
                  <span>{blocked ? 'Unblock User' : 'Block User'}</span>
                </div>
              </button>

              <button
                className={cn(itemCls, "text-rose-400 hover:text-rose-300")}
                onClick={() => setShowReportDialog(true)}
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-rose-500/10 text-rose-400 flex items-center justify-center">
                    <ShieldAlert className="w-4 h-4" />
                  </div>
                  <span>Report Profile</span>
                </div>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Report Profile Sub-Modal */}
      {showReportDialog && (
        <div
          className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md"
          onClick={(e) => { e.stopPropagation(); setShowReportDialog(false); }}
        >
          <div
            className={cn(
              "w-full max-w-sm rounded-[28px] p-6 shadow-2xl border relative",
              isDark ? "bg-[#070D27] border-white/10 text-white" : "bg-white border-slate-200 text-slate-900"
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
                className="p-1 rounded-full text-slate-400 hover:text-white"
                aria-label="Close report dialog"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
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
                  "w-full p-3 text-sm rounded-2xl border resize-none focus:outline-none focus:ring-2 focus:ring-amber-500",
                  isDark ? "bg-black/20 border-white/10 text-white placeholder-slate-500" : "bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400"
                )}
              />
              <div className="flex items-center gap-2 justify-end pt-1">
                <button
                  type="button"
                  onClick={() => setShowReportDialog(false)}
                  className={cn(
                    "px-4 py-2 rounded-2xl text-xs font-semibold cursor-pointer",
                    isDark ? "bg-white/10 text-slate-300 hover:bg-white/15" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                  )}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={busy === 'report' || !reportReason.trim()}
                  className="px-4 py-2 rounded-2xl text-xs font-bold bg-amber-500 hover:bg-amber-600 text-black flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                >
                  {busy === 'report' && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Submit Report
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProfileOptionsMenu;
