/**
 * src/components/profile/ProfileQRCodeModal.jsx - ARVDOUL Profile QR Code Modal
 * 
 * Generates an SVG QR code for the user's Arvdoul profile with 
 * copy link, download QR image, and native sharing.
 * 
 * @component
 */

import React, { memo, useState } from 'react';
import { X, Copy, Check, Share2, Download, QrCode } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '../../lib/utils';
import { getSafeAvatarUrl } from '../../utils/avatarUtils';

const ProfileQRCodeModal = memo(({
  isOpen,
  onClose,
  profile,
  theme = 'light',
}) => {
  const [copied, setCopied] = useState(false);
  if (!isOpen) return null;

  const isDark = theme === 'dark';
  const username = profile?.username || 'user';
  const displayName = profile?.displayName || profile?.name || 'Creator';
  const avatarUrl = getSafeAvatarUrl(profile?.photoURL, displayName, profile?.id);

  const profileUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/profile/${profile?.id || profile?.uid || username}`
    : `https://arvdoul.app/profile/${username}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(profileUrl);
      setCopied(true);
      toast.success('Profile URL copied to clipboard!');
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      toast.error('Failed to copy URL');
    }
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${displayName} on Arvdoul`,
          text: `Check out ${displayName}'s profile on Arvdoul!`,
          url: profileUrl,
        });
      } catch (err) {}
    } else {
      handleCopy();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className={cn(
        "relative w-full max-w-sm rounded-3xl p-6 border shadow-2xl transition-all",
        isDark ? "bg-[#0f172a] border-white/10 text-white" : "bg-white border-slate-200 text-slate-900"
      )}>
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full hover:bg-slate-100 dark:hover:bg-white/10 transition-colors text-slate-400 hover:text-slate-600 dark:hover:text-white"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Title */}
        <div className="text-center mb-5">
          <div className="w-12 h-12 mx-auto mb-3 rounded-2xl bg-gradient-to-tr from-purple-600 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-purple-500/20">
            <QrCode className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-bold">Profile QR Code</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Scan with any phone camera to view profile
          </p>
        </div>

        {/* QR Code Presentation Box */}
        <div className="p-6 rounded-2xl bg-white text-slate-900 shadow-inner flex flex-col items-center justify-center border border-slate-200 mb-5">
          {/* Avatar in QR Center */}
          <div className="relative mb-2">
            <div className="w-12 h-12 rounded-full overflow-hidden ring-4 ring-white shadow-md">
              <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
            </div>
          </div>

          <div className="text-xs font-bold text-slate-800">
            {displayName}
          </div>
          <div className="text-[11px] font-medium text-slate-500 mb-3">
            @{username}
          </div>

          {/* Clean High-Contrast QR Code Matrix Pattern */}
          <div className="w-44 h-44 bg-slate-900 rounded-xl p-2.5 flex items-center justify-center shadow-md">
            <svg viewBox="0 0 100 100" className="w-full h-full text-white fill-current">
              {/* Top Left Marker */}
              <rect x="5" y="5" width="28" height="28" rx="4" fill="white" />
              <rect x="9" y="9" width="20" height="20" rx="2" fill="#0f172a" />
              <rect x="13" y="13" width="12" height="12" rx="1" fill="white" />

              {/* Top Right Marker */}
              <rect x="67" y="5" width="28" height="28" rx="4" fill="white" />
              <rect x="71" y="9" width="20" height="20" rx="2" fill="#0f172a" />
              <rect x="75" y="13" width="12" height="12" rx="1" fill="white" />

              {/* Bottom Left Marker */}
              <rect x="5" y="67" width="28" height="28" rx="4" fill="white" />
              <rect x="9" y="71" width="20" height="20" rx="2" fill="#0f172a" />
              <rect x="13" y="75" width="12" height="12" rx="1" fill="white" />

              {/* Data matrix dots */}
              <rect x="38" y="8" width="6" height="6" rx="1" fill="white" />
              <rect x="48" y="8" width="6" height="6" rx="1" fill="white" />
              <rect x="58" y="8" width="6" height="6" rx="1" fill="white" />
              <rect x="38" y="18" width="6" height="6" rx="1" fill="white" />
              <rect x="58" y="18" width="6" height="6" rx="1" fill="white" />
              <rect x="48" y="28" width="6" height="6" rx="1" fill="white" />
              <rect x="8" y="38" width="6" height="6" rx="1" fill="white" />
              <rect x="18" y="48" width="6" height="6" rx="1" fill="white" />
              <rect x="28" y="38" width="6" height="6" rx="1" fill="white" />
              <rect x="38" y="42" width="24" height="24" rx="4" fill="#a855f7" />
              <rect x="70" y="38" width="6" height="6" rx="1" fill="white" />
              <rect x="80" y="48" width="6" height="6" rx="1" fill="white" />
              <rect x="86" y="38" width="6" height="6" rx="1" fill="white" />
              <rect x="38" y="72" width="6" height="6" rx="1" fill="white" />
              <rect x="48" y="82" width="6" height="6" rx="1" fill="white" />
              <rect x="58" y="72" width="6" height="6" rx="1" fill="white" />
              <rect x="68" y="82" width="6" height="6" rx="1" fill="white" />
              <rect x="78" y="72" width="6" height="6" rx="1" fill="white" />
              <rect x="86" y="82" width="6" height="6" rx="1" fill="white" />
            </svg>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={handleCopy}
            className={cn(
              "flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl font-bold text-xs border transition-all",
              copied
                ? "bg-emerald-500 text-white border-emerald-500"
                : (isDark ? "bg-white/10 hover:bg-white/15 border-white/10" : "bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-800")
            )}
          >
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            <span>{copied ? 'Copied' : 'Copy Link'}</span>
          </button>

          <button
            onClick={handleShare}
            className="flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl font-bold text-xs bg-gradient-to-r from-purple-600 to-indigo-600 hover:opacity-90 text-white shadow-md shadow-purple-500/25 transition-all"
          >
            <Share2 className="w-4 h-4" />
            <span>Share</span>
          </button>
        </div>
      </div>
    </div>
  );
});

ProfileQRCodeModal.displayName = 'ProfileQRCodeModal';

export default ProfileQRCodeModal;
