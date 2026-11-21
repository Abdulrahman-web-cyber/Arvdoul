// src/components/profile/ProfileOptionsMenu.jsx
//
// Refined iOS-grade Grouped Action Sheet for Arvdoul Profiles.
// Features mobile top drag indicator, inset hairline-divided sections,
// crisp 18px monochrome/accent icons, zero decorative pill clutter,
// Lite Mode backdrop gating, and accessible keyboard focus controls.

import { useState, useCallback, useEffect } from "react";
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '../../context/AuthContext';
import { cn } from '../../lib/utils';
import {
  Share2, Link2, ShieldAlert, Loader2, X, UserX, BadgeCheck, Flag, VolumeX, Volume2, ShieldMinus,
  Eye, QrCode, Crown, Settings, Award, MapPin, MessageCircle, Phone, Gift, UserPlus, UserCheck,
  Coins, BarChart2, ChevronRight,
} from 'lucide-react';
import { toast as sonnerToast } from 'sonner';
import { shareProfile, getProfileUrl, copyToClipboard } from '../../utils/shareUtils.js';
import { BRAND_GRADIENT } from '../../design-system/tokens.js';
import { useFeatureFlag } from '../../hooks/useFeatureFlag.js';
import { getAdaptiveTuning } from '../../utils/deviceCapabilities.js';

const REPORT_PRESETS = [
  'Harassment or bullying',
  'Spam or scam',
  'Impersonation',
  'Inappropriate content',
];

const ActionRow = ({
  icon: Icon,
  label,
  subtitle = null,
  onClick,
  disabled = false,
  busy = false,
  tone = 'default',
  isDark = false,
  trailing = true,
}) => {
  const toneIcon =
    tone === 'danger'
      ? 'text-rose-500 dark:text-rose-400'
      : tone === 'success'
        ? 'text-emerald-600 dark:text-emerald-400'
        : tone === 'amber'
          ? 'text-amber-600 dark:text-amber-400'
          : isDark
            ? 'text-slate-300'
            : 'text-slate-600';

  const toneText =
    tone === 'danger'
      ? 'text-rose-600 dark:text-rose-400'
      : isDark
        ? 'text-slate-100'
        : 'text-slate-900';

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-busy={busy || undefined}
      className={cn(
        'w-full min-h-[48px] px-4 py-3 flex items-center justify-between gap-3 text-left transition-colors cursor-pointer',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-arvdoul-purple',
        isDark
          ? 'hover:bg-white/[0.06] active:bg-white/[0.10]'
          : 'hover:bg-slate-50 active:bg-slate-100/80'
      )}
    >
      <span className="flex items-center gap-3 min-w-0">
        {busy ? (
          <Loader2 className={cn('w-[18px] h-[18px] shrink-0 animate-spin', toneIcon)} aria-hidden="true" />
        ) : (
          <Icon className={cn('w-[18px] h-[18px] shrink-0', toneIcon)} aria-hidden="true" />
        )}
        <span className="min-w-0">
          <span className={cn('block text-[14px] font-medium leading-tight truncate', toneText)}>
            {label}
          </span>
          {subtitle && (
            <span className={cn('block text-[11.5px] leading-snug truncate mt-0.5', isDark ? 'text-slate-400' : 'text-slate-500')}>
              {subtitle}
            </span>
          )}
        </span>
      </span>

      {trailing && (
        <ChevronRight
          className={cn('w-4 h-4 shrink-0', isDark ? 'text-slate-500' : 'text-slate-400')}
          aria-hidden="true"
        />
      )}
    </button>
  );
};

const ActionGroup = ({ title, children, isDark }) => (
  <div className="space-y-1.5">
    {title && (
      <p className={cn(
        'px-1.5 text-[11px] font-semibold uppercase tracking-[0.07em]',
        isDark ? 'text-slate-400' : 'text-slate-500'
      )}>
        {title}
      </p>
    )}
    <div
      className={cn(
        'rounded-2xl border overflow-hidden divide-y',
        isDark
          ? 'bg-white/[0.04] border-white/[0.08] divide-white/[0.07]'
          : 'bg-white border-slate-200/80 divide-slate-100 shadow-[0_1px_2px_rgba(15,23,42,0.03)]'
      )}
    >
      {children}
    </div>
  </div>
);

const ProfileOptionsMenu = ({
  profile,
  isOwner = false,
  onClose,
  theme = 'light',
  capabilities,
  onRelationshipChange,
  friendshipStatus = 'none',
  friendRequestLoading = false,
  onFriendRequestToggle,
  onCancelFriendRequest,
  onOpenTipModal,
  onOpenLocationSetup,
}) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const callsEnabled = useFeatureFlag('messaging.calls');
  const [busy, setBusy] = useState(null);
  const [blocked, setBlocked] = useState(Boolean(capabilities?.isBlocking || profile?.isBlocked || profile?.isBlockedByViewer));
  const [muted, setMuted] = useState(Boolean(capabilities?.isMuted || profile?.isMuted));
  const [restricted, setRestricted] = useState(Boolean(capabilities?.isRestricted || profile?.isRestricted));
  const [showReportDialog, setShowReportDialog] = useState(false);
  const [reportReason, setReportReason] = useState('');

  const isLiteMode = getAdaptiveTuning().isLiteMode;
  const userId = profile?.uid || profile?.id;

  useEffect(() => {
    let active = true;
    if (user?.uid && userId && !isOwner) {
      import('../../services/userService.js').then(({ getUserService }) => {
        const svc = getUserService();
        Promise.all([
          svc.isBlocked(user.uid, userId).catch(() => null),
          svc.isMuted(user.uid, userId).catch(() => null),
          svc.isRestricted(user.uid, userId).catch(() => null),
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

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (showReportDialog) {
          setShowReportDialog(false);
        } else {
          onClose?.();
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [showReportDialog, onClose]);

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
        onRelationshipChange?.({ type: 'block', value: false });
        toast.success('User unblocked.');
      } else {
        await svc.blockUser(user.uid, userId);
        setBlocked(true);
        onRelationshipChange?.({ type: 'block', value: true });
        toast.success('User blocked.');
      }
      onClose?.();
    } catch {
      toast.error('Action failed.');
    } finally {
      setBusy(null);
    }
  }, [user?.uid, userId, blocked, busy, onClose, onRelationshipChange]);

  const handleMute = useCallback(async () => {
    if (!user?.uid || busy) return;
    setBusy('mute');
    try {
      const { getUserService } = await import('../../services/userService.js');
      const svc = getUserService();
      if (muted) {
        await svc.unmuteUser(user.uid, userId);
        setMuted(false);
        onRelationshipChange?.({ type: 'mute', value: false });
        toast.success('User unmuted.');
      } else {
        await svc.muteUser(user.uid, userId);
        setMuted(true);
        onRelationshipChange?.({ type: 'mute', value: true });
        toast.success('User muted.');
      }
      onClose?.();
    } catch {
      toast.error('Action failed.');
    } finally {
      setBusy(null);
    }
  }, [user?.uid, userId, muted, busy, onClose, onRelationshipChange]);

  const handleRestrict = useCallback(async () => {
    if (!user?.uid || busy) return;
    setBusy('restrict');
    try {
      const { getUserService } = await import('../../services/userService.js');
      const svc = getUserService();
      if (restricted) {
        await svc.unrestrictUser(user.uid, userId);
        setRestricted(false);
        onRelationshipChange?.({ type: 'restrict', value: false });
        toast.success('Restriction removed.');
      } else {
        await svc.restrictUser(user.uid, userId);
        setRestricted(true);
        onRelationshipChange?.({ type: 'restrict', value: true });
        toast.success('User restricted.');
      }
      onClose?.();
    } catch {
      toast.error('Action failed.');
    } finally {
      setBusy(null);
    }
  }, [user?.uid, userId, restricted, busy, onClose, onRelationshipChange]);

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

  const friendLabel = friendshipStatus === 'friends'
    ? 'Friends'
    : friendshipStatus === 'received'
      ? 'Accept Friend Request'
      : friendshipStatus === 'pending'
        ? (onCancelFriendRequest ? 'Cancel Friend Request' : 'Friend Request Sent')
        : 'Add Friend';

  return (
    <div
      className={cn(
        'fixed inset-0 z-[9999] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/65 animate-in fade-in duration-150',
        !isLiteMode && 'backdrop-blur-md'
      )}
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Profile options"
        className={cn(
          'w-full max-w-[400px] max-sm:rounded-b-none max-sm:rounded-t-[28px] sm:rounded-[26px] overflow-hidden border relative z-[10000]',
          isDark
            ? 'bg-[#080F2E]/95 border-white/[0.12] text-white shadow-[0_24px_64px_rgba(0,0,0,0.85)]'
            : 'bg-[#F8FAFD] border-slate-200/90 text-slate-900 shadow-[0_20px_50px_rgba(15,23,42,0.22)]'
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top optical hairline */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-[2px]"
          style={{ background: BRAND_GRADIENT }}
        />

        {/* Mobile sheet drag handle */}
        <div className="sm:hidden flex justify-center pt-2.5 pb-1">
          <span
            aria-hidden="true"
            className={cn('w-9 h-1 rounded-full', isDark ? 'bg-white/25' : 'bg-slate-300')}
          />
        </div>

        {/* Sheet Header */}
        <div className={cn(
          'flex items-center justify-between px-5 py-3.5 border-b',
          isDark ? 'border-white/[0.08]' : 'border-slate-200/70 bg-white/80'
        )}>
          <div className="min-w-0">
            <h2 className="text-[15px] font-bold tracking-tight leading-tight">
              Profile Options
            </h2>
            {profile?.username && (
              <p className={cn('text-xs font-medium truncate mt-0.5', isDark ? 'text-slate-400' : 'text-slate-500')}>
                @{profile.username}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close menu"
            className={cn(
              'min-w-[44px] min-h-[44px] -mr-2 flex items-center justify-center rounded-full transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-arvdoul-purple',
              isDark ? 'hover:bg-white/10 text-slate-400 hover:text-white' : 'hover:bg-slate-100 text-slate-500 hover:text-slate-900'
            )}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Grouped Action Sections */}
        <div className="p-4 space-y-4 max-h-[75vh] overflow-y-auto overscroll-contain">
          {/* Group 1: Identity & Sharing */}
          <ActionGroup title="Identity & Sharing" isDark={isDark}>
            <ActionRow
              icon={Share2}
              label="Share Profile"
              onClick={handleShare}
              isDark={isDark}
            />
            <ActionRow
              icon={Link2}
              label="Copy Profile Link"
              onClick={handleCopy}
              isDark={isDark}
              trailing={false}
            />
            {isOwner && (
              <>
                <ActionRow
                  icon={QrCode}
                  label="Identity QR Code"
                  onClick={() => {
                    onClose?.();
                    window.dispatchEvent(new CustomEvent('arvdoul:open_qr_code'));
                  }}
                  isDark={isDark}
                />
                <ActionRow
                  icon={Crown}
                  label="Digital Passport"
                  onClick={() => {
                    onClose?.();
                    navigate('/passport');
                  }}
                  isDark={isDark}
                />
                <ActionRow
                  icon={Award}
                  label="Civic Titles & Provenance"
                  onClick={() => {
                    onClose?.();
                    navigate('/titles');
                  }}
                  isDark={isDark}
                />
                <ActionRow
                  icon={MapPin}
                  label="Civic Location"
                  onClick={() => {
                    onClose?.();
                    if (onOpenLocationSetup) onOpenLocationSetup();
                    else window.dispatchEvent(new CustomEvent('arvdoul:open_location_setup'));
                  }}
                  isDark={isDark}
                />
              </>
            )}
            {!isOwner && (
              <ActionRow
                icon={Crown}
                label="Inspect Passport"
                onClick={() => {
                  onClose?.();
                  navigate(`/passport/${userId}`);
                }}
                isDark={isDark}
              />
            )}
          </ActionGroup>

          {/* Group 2 (Owner): Perspectives & Studio */}
          {isOwner && (
            <ActionGroup title="Perspectives & Studio" isDark={isDark}>
              <ActionRow
                icon={Eye}
                label="View Profile As..."
                subtitle="Preview how visitors, followers, or connections see you"
                onClick={() => {
                  onClose?.();
                  window.dispatchEvent(new CustomEvent('arvdoul:open_perspective_modal'));
                }}
                isDark={isDark}
              />
              <ActionRow
                icon={BarChart2}
                label="Profile Insights & Views"
                onClick={() => {
                  onClose?.();
                  navigate('/profile/analytics');
                }}
                isDark={isDark}
              />
              <ActionRow
                icon={Coins}
                label="Coins Treasury"
                tone="amber"
                onClick={() => {
                  onClose?.();
                  navigate('/coins');
                }}
                isDark={isDark}
              />
              <ActionRow
                icon={Settings}
                label="Account Settings"
                onClick={() => {
                  onClose?.();
                  navigate('/settings');
                }}
                isDark={isDark}
              />
            </ActionGroup>
          )}

          {/* Group 2 (Visitor): Connect & Patronage */}
          {!isOwner && (onFriendRequestToggle || callsEnabled || onOpenTipModal || userId) && (
            <ActionGroup title="Connect & Patronage" isDark={isDark}>
              {onFriendRequestToggle && (
                <ActionRow
                  icon={friendshipStatus === 'friends' ? UserCheck : UserPlus}
                  label={friendLabel}
                  busy={friendRequestLoading}
                  disabled={friendRequestLoading || friendshipStatus === 'friends'}
                  tone={friendshipStatus === 'friends' ? 'success' : 'default'}
                  onClick={() => {
                    const action = friendshipStatus === 'pending' && onCancelFriendRequest
                      ? onCancelFriendRequest
                      : onFriendRequestToggle;
                    onClose?.();
                    action?.();
                  }}
                  isDark={isDark}
                />
              )}
              {callsEnabled && (
                <ActionRow
                  icon={Phone}
                  label="Audio Call"
                  busy={busy === 'call'}
                  disabled={busy === 'call'}
                  onClick={async () => {
                    if (!userId || busy) return;
                    setBusy('call');
                    try {
                      const { getMessagingService } = await import('../../services/messagesService.js');
                      const { conversation } = await getMessagingService().createConversation([userId]);
                      onClose?.();
                      navigate(`/call/${conversation.id}?type=audio`);
                    } catch {
                      sonnerToast.error('Could not start audio call.');
                    } finally {
                      setBusy(null);
                    }
                  }}
                  isDark={isDark}
                />
              )}
              {onOpenTipModal && (
                <ActionRow
                  icon={Gift}
                  label="Send Coins / Gift"
                  tone="amber"
                  onClick={() => {
                    onClose?.();
                    onOpenTipModal();
                  }}
                  isDark={isDark}
                />
              )}
              <ActionRow
                icon={MessageCircle}
                label="Send via Direct Message"
                onClick={() => {
                  onClose?.();
                  navigate(`/messages/new?shareProfile=${userId}`);
                }}
                isDark={isDark}
              />
            </ActionGroup>
          )}

          {/* Group 3 (Visitor): Safety & Moderation */}
          {!isOwner && (
            <ActionGroup title="Safety & Moderation" isDark={isDark}>
              <ActionRow
                icon={muted ? Volume2 : VolumeX}
                label={muted ? 'Unmute Profile' : 'Mute Profile'}
                busy={busy === 'mute'}
                tone={muted ? 'success' : 'default'}
                onClick={handleMute}
                isDark={isDark}
                trailing={false}
              />
              <ActionRow
                icon={restricted ? BadgeCheck : ShieldMinus}
                label={restricted ? 'Unrestrict Profile' : 'Restrict Profile'}
                busy={busy === 'restrict'}
                tone={restricted ? 'success' : 'default'}
                onClick={handleRestrict}
                isDark={isDark}
                trailing={false}
              />
              <ActionRow
                icon={blocked ? BadgeCheck : UserX}
                label={blocked ? 'Unblock User' : 'Block User'}
                busy={busy === 'block'}
                tone={blocked ? 'success' : 'danger'}
                onClick={handleBlock}
                isDark={isDark}
                trailing={false}
              />
              <ActionRow
                icon={ShieldAlert}
                label="Report Profile"
                tone="danger"
                onClick={() => setShowReportDialog(true)}
                isDark={isDark}
              />
            </ActionGroup>
          )}
        </div>
      </div>

      {/* Report Profile Sub-Modal */}
      {showReportDialog && (
        <div
          className={cn(
            'fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/70',
            !isLiteMode && 'backdrop-blur-md'
          )}
          onClick={(e) => { e.stopPropagation(); setShowReportDialog(false); }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Report Profile"
            className={cn(
              'w-full max-w-sm rounded-[26px] p-6 shadow-2xl border relative',
              isDark ? 'bg-[#080F2E] border-white/12 text-white' : 'bg-white border-slate-200 text-slate-900'
            )}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Flag className="w-5 h-5 text-amber-500" />
                <h3 className="font-bold text-base">Report Profile</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowReportDialog(false)}
                className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-arvdoul-purple"
                aria-label="Close report dialog"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
              Why are you reporting @{profile?.username || profile?.displayName || 'this user'}?
            </p>
            <div className="flex flex-wrap gap-1.5 mb-3">
              {REPORT_PRESETS.map((preset) => {
                const selected = reportReason === preset;
                return (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setReportReason(preset)}
                    className={cn(
                      'px-2.5 py-1.5 min-h-[36px] rounded-xl text-[11px] font-semibold border transition cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-arvdoul-purple',
                      selected
                        ? 'border-amber-500 bg-amber-500/15 text-amber-500'
                        : isDark
                          ? 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'
                          : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                    )}
                  >
                    {preset}
                  </button>
                );
              })}
            </div>
            <form onSubmit={handleSubmitReport} className="space-y-3">
              <textarea
                aria-label="Report reason"
                value={reportReason}
                onChange={(e) => setReportReason(e.target.value)}
                placeholder="Spam, harassment, inappropriate content, impersonation..."
                rows={3}
                maxLength={300}
                className={cn(
                  'w-full p-3 text-sm rounded-2xl border resize-none focus:outline-none focus-visible:ring-2 focus-visible:ring-arvdoul-purple',
                  isDark ? 'bg-black/20 border-white/10 text-white placeholder-slate-500' : 'bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400'
                )}
              />
              <div className="flex items-center gap-2 justify-end pt-1">
                <button
                  type="button"
                  onClick={() => setShowReportDialog(false)}
                  className={cn(
                    'px-4 py-2 min-h-[44px] rounded-2xl text-xs font-semibold cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-arvdoul-purple',
                    isDark ? 'bg-white/10 text-slate-300 hover:bg-white/15' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  )}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={busy === 'report' || !reportReason.trim()}
                  className="px-4 py-2 min-h-[44px] rounded-2xl text-xs font-bold bg-amber-500 hover:bg-amber-600 text-black flex items-center gap-1.5 disabled:opacity-50 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-arvdoul-purple"
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
