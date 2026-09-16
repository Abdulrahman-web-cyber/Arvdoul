/**
 * src/components/profile/ProfileActionBar.jsx - ARVDOUL Profile Action Bar
 * 
 * Recreates the exact Action Bar from the design samples in both Light and Dark themes.
 * Handles owner actions (Edit, Share, QR Code, Coins, Insights, Settings) and 
 * visitor actions (Follow, Message, Call, Gift/Tip, More).
 * 
 * @component
 */

import React, { memo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Edit3, 
  Share2, 
  QrCode, 
  Coins, 
  TrendingUp, 
  Settings, 
  UserPlus, 
  UserCheck, 
  MessageCircle, 
  Phone, 
  Gift, 
  MoreHorizontal,
  Loader2
} from 'lucide-react';
import { cn } from '../../lib/utils';

const ProfileActionBar = memo(({
  isOwner = false,
  theme = 'light',
  profile,
  coinsBalance = 0,
  isFollowing = false,
  followLoading = false,
  onFollowToggle,
  onOpenQrCode,
  onOpenTipModal,
  onOpenOptionsMenu,
  onSharePress,
  onInsightsPress,
  onCallPress,
}) => {
  const navigate = useNavigate();
  const isDark = theme === 'dark';
  const buttonGradient = 'linear-gradient(135deg, #9333ea 0%, #6366f1 50%, #06b6d4 100%)';

  const coinsValue = Number(profile?.coins ?? profile?.coinBalance ?? coinsBalance ?? 0);

  if (isOwner) {
    return (
      <div className="w-full">
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2.5">
          {/* 1. Edit Profile */}
          <button
            onClick={() => navigate('/profile/edit')}
            className={cn(
              "flex items-center justify-center gap-2 py-2.5 px-3 rounded-2xl font-bold text-xs border transition-all hover:scale-[1.02] active:scale-[0.98]",
              isDark
                ? "bg-white/5 border-white/10 text-white hover:bg-white/10 shadow-sm"
                : "bg-white border-slate-200 text-slate-800 hover:bg-slate-50 shadow-sm"
            )}
            title="Edit Profile"
          >
            <Edit3 className="w-4 h-4 text-purple-500" />
            <span>Edit Profile</span>
          </button>

          {/* 2. Share Profile */}
          <button
            onClick={onSharePress}
            className={cn(
              "flex items-center justify-center gap-2 py-2.5 px-3 rounded-2xl font-bold text-xs border transition-all hover:scale-[1.02] active:scale-[0.98]",
              isDark
                ? "bg-white/5 border-white/10 text-white hover:bg-white/10 shadow-sm"
                : "bg-white border-slate-200 text-slate-800 hover:bg-slate-50 shadow-sm"
            )}
            title="Share Profile"
          >
            <Share2 className="w-4 h-4 text-blue-500" />
            <span>Share</span>
          </button>

          {/* 3. QR Code */}
          <button
            onClick={onOpenQrCode}
            className={cn(
              "flex items-center justify-center gap-2 py-2.5 px-3 rounded-2xl font-bold text-xs border transition-all hover:scale-[1.02] active:scale-[0.98]",
              isDark
                ? "bg-white/5 border-white/10 text-white hover:bg-white/10 shadow-sm"
                : "bg-white border-slate-200 text-slate-800 hover:bg-slate-50 shadow-sm"
            )}
            title="Profile QR Code"
          >
            <QrCode className="w-4 h-4 text-indigo-500" />
            <span>QR Code</span>
          </button>

          {/* 4. Coins Wallet */}
          <button
            onClick={() => navigate('/coins')}
            className={cn(
              "flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-2xl font-bold text-xs border transition-all hover:scale-[1.02] active:scale-[0.98]",
              isDark
                ? "bg-amber-500/10 border-amber-500/20 text-amber-300 hover:bg-amber-500/20"
                : "bg-amber-50 border-amber-200 text-amber-800 hover:bg-amber-100 shadow-sm"
            )}
            title="Coins Wallet"
          >
            <Coins className="w-4 h-4 text-amber-500" />
            <span>{coinsValue.toLocaleString()} Coins</span>
          </button>

          {/* 5. Insights */}
          <button
            onClick={onInsightsPress || (() => navigate('/profile/analytics'))}
            className={cn(
              "flex items-center justify-center gap-2 py-2.5 px-3 rounded-2xl font-bold text-xs border transition-all hover:scale-[1.02] active:scale-[0.98]",
              isDark
                ? "bg-white/5 border-white/10 text-white hover:bg-white/10 shadow-sm"
                : "bg-white border-slate-200 text-slate-800 hover:bg-slate-50 shadow-sm"
            )}
            title="Creator Insights"
          >
            <TrendingUp className="w-4 h-4 text-emerald-500" />
            <span>Insights</span>
          </button>

          {/* 6. Settings */}
          <button
            onClick={() => navigate('/settings')}
            className={cn(
              "flex items-center justify-center gap-2 py-2.5 px-3 rounded-2xl font-bold text-xs border transition-all hover:scale-[1.02] active:scale-[0.98]",
              isDark
                ? "bg-white/5 border-white/10 text-white hover:bg-white/10 shadow-sm"
                : "bg-white border-slate-200 text-slate-800 hover:bg-slate-50 shadow-sm"
            )}
            title="Settings"
          >
            <Settings className="w-4 h-4 text-slate-400" />
            <span>Settings</span>
          </button>
        </div>
      </div>
    );
  }

  // Public / Visitor View Actions
  return (
    <div className="w-full">
      <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap">
        {/* 1. Follow / Following Button (Prominent Gradient) */}
        <button
          onClick={onFollowToggle}
          disabled={followLoading}
          className={cn(
            "flex-1 sm:flex-initial sm:min-w-[150px] flex items-center justify-center gap-2 py-2.5 px-5 rounded-2xl font-bold text-xs transition-all hover:scale-[1.02] active:scale-[0.98] shadow-md",
            isFollowing
              ? (isDark 
                  ? "bg-white/10 border border-white/15 text-white hover:bg-white/15" 
                  : "bg-slate-100 border border-slate-200 text-slate-800 hover:bg-slate-200")
              : "text-white shadow-purple-500/25"
          )}
          style={!isFollowing ? { background: buttonGradient } : undefined}
          title={isFollowing ? 'Unfollow' : 'Follow'}
        >
          {followLoading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : isFollowing ? (
            <>
              <UserCheck className="w-4 h-4 text-emerald-500" />
              <span>Following</span>
            </>
          ) : (
            <>
              <UserPlus className="w-4 h-4" />
              <span>Follow</span>
            </>
          )}
        </button>

        {/* 2. Message */}
        <button
          onClick={() => navigate(`/messages/new?to=${profile?.id || profile?.uid}`)}
          className={cn(
            "flex items-center justify-center gap-2 py-2.5 px-4 rounded-2xl font-bold text-xs border transition-all hover:scale-[1.02] active:scale-[0.98]",
            isDark
              ? "bg-white/5 border-white/10 text-white hover:bg-white/10 shadow-sm"
              : "bg-white border-slate-200 text-slate-800 hover:bg-slate-50 shadow-sm"
          )}
          title="Send Direct Message"
        >
          <MessageCircle className="w-4 h-4 text-purple-500" />
          <span>Message</span>
        </button>

        {/* 3. Call */}
        <button
          onClick={onCallPress}
          className={cn(
            "flex items-center justify-center gap-2 py-2.5 px-4 rounded-2xl font-bold text-xs border transition-all hover:scale-[1.02] active:scale-[0.98]",
            isDark
              ? "bg-white/5 border-white/10 text-white hover:bg-white/10 shadow-sm"
              : "bg-white border-slate-200 text-slate-800 hover:bg-slate-50 shadow-sm"
          )}
          title="Audio/Video Call"
        >
          <Phone className="w-4 h-4 text-blue-500" />
          <span>Call</span>
        </button>

        {/* 4. Gift / Tip */}
        <button
          onClick={onOpenTipModal}
          className={cn(
            "flex items-center justify-center gap-2 py-2.5 px-4 rounded-2xl font-bold text-xs border transition-all hover:scale-[1.02] active:scale-[0.98]",
            isDark
              ? "bg-amber-500/10 border-amber-500/25 text-amber-300 hover:bg-amber-500/20"
              : "bg-amber-50 border-amber-200 text-amber-800 hover:bg-amber-100 shadow-sm"
          )}
          title="Gift Coins to Creator"
        >
          <Gift className="w-4 h-4 text-amber-500" />
          <span>Gift</span>
        </button>

        {/* 5. More Options */}
        <button
          onClick={onOpenOptionsMenu}
          className={cn(
            "p-2.5 rounded-2xl border transition-all flex items-center justify-center hover:scale-[1.02] active:scale-[0.98]",
            isDark
              ? "bg-white/5 border-white/10 text-gray-300 hover:bg-white/10 hover:text-white"
              : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50 shadow-sm"
          )}
          title="More Options"
          aria-label="More Options"
        >
          <MoreHorizontal className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
});

ProfileActionBar.displayName = 'ProfileActionBar';

export default ProfileActionBar;
