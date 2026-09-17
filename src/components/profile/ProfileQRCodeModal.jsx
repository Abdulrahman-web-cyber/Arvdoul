/**
 * src/components/profile/ProfileQRCodeModal.jsx - ARVDOUL Profile QR Code Modal
 * 
 * Generates an actual, scannable unique high-resolution QR code for the user's
 * Arvdoul profile using `qrcode`. Supports instant PNG download, copy link,
 * and native device sharing.
 * 
 * @component
 */

import React, { memo, useState, useEffect } from 'react';
import QRCode from 'qrcode';
import { X, Copy, Check, Share2, Download, QrCode, Sparkles, Loader2 } from 'lucide-react';
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
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [qrLoading, setQrLoading] = useState(true);

  const isDark = theme === 'dark';
  const username = profile?.username || 'user';
  const displayName = profile?.displayName || profile?.name || 'Creator';
  const avatarUrl = getSafeAvatarUrl(profile?.photoURL, displayName, profile?.id || profile?.uid);

  const profileUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/profile/${profile?.id || profile?.uid || username}`
    : `https://arvdoul.app/profile/${username}`;

  // Generate unique scannable QR code
  useEffect(() => {
    let isMounted = true;
    if (!isOpen || !profileUrl) return;

    setQrLoading(true);
    QRCode.toDataURL(profileUrl, {
      width: 400,
      margin: 2,
      color: {
        dark: '#090d16',
        light: '#ffffff'
      },
      errorCorrectionLevel: 'H' // High redundancy allows overlaying profile accent without breaking scans
    })
      .then((url) => {
        if (isMounted) {
          setQrDataUrl(url);
          setQrLoading(false);
        }
      })
      .catch((err) => {
        console.error('QR generation error:', err);
        if (isMounted) setQrLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, profileUrl]);

  if (!isOpen) return null;

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

  const handleDownload = () => {
    if (!qrDataUrl) {
      toast.error('Generating QR code, please wait...');
      return;
    }
    const link = document.createElement('a');
    link.download = `${username}-arvdoul-qrcode.png`;
    link.href = qrDataUrl;
    link.click();
    toast.success('QR code saved to your device!');
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${displayName} on Arvdoul`,
          text: `Connect with ${displayName} on Arvdoul!`,
          url: profileUrl,
        });
      } catch (err) {
        // User cancelled or aborted share
      }
    } else {
      handleCopy();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-fade-in">
      <div className={cn(
        "relative w-full max-w-sm rounded-3xl p-6 border shadow-2xl transition-all",
        isDark 
          ? "bg-[#0c1222] border-white/10 text-white shadow-[0_16px_50px_rgba(0,0,0,0.6)]" 
          : "bg-white border-slate-200 text-slate-900 shadow-[0_16px_50px_rgba(0,0,0,0.12)]"
      )}>
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full hover:bg-slate-100 dark:hover:bg-white/10 transition-colors text-slate-400 hover:text-slate-600 dark:hover:text-white"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Title */}
        <div className="text-center mb-5">
          <div className="w-12 h-12 mx-auto mb-3 rounded-2xl bg-gradient-to-tr from-purple-600 via-indigo-600 to-cyan-500 flex items-center justify-center text-white shadow-lg shadow-purple-500/25">
            <QrCode className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-bold">Profile Share Card</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Scan with any smartphone camera to open profile
          </p>
        </div>

        {/* High-Resolution QR Card */}
        <div className="p-5 rounded-2xl bg-white text-slate-900 shadow-lg flex flex-col items-center justify-center border border-slate-200 mb-5 relative overflow-hidden group">
          {/* Subtle Top Gradient Accent */}
          <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-purple-600 via-pink-500 to-cyan-500" />

          {/* User Identity Header */}
          <div className="flex items-center gap-2.5 mb-3 pt-1">
            <div className="w-10 h-10 rounded-full overflow-hidden ring-2 ring-purple-500/30 shrink-0 bg-slate-100">
              <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
            </div>
            <div className="text-left">
              <div className="text-xs font-bold text-slate-900 flex items-center gap-1">
                <span>{displayName}</span>
                {profile?.isVerified && (
                  <Sparkles className="w-3 h-3 text-purple-600 fill-purple-600" />
                )}
              </div>
              <div className="text-[11px] font-medium text-slate-500">
                @{username}
              </div>
            </div>
          </div>

          {/* Actual Scannable QR Matrix */}
          <div className="relative w-48 h-48 rounded-xl p-1 bg-white flex items-center justify-center shadow-inner">
            {qrLoading ? (
              <div className="flex flex-col items-center justify-center gap-2 text-slate-400">
                <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
                <span className="text-[11px] font-medium">Generating QR...</span>
              </div>
            ) : qrDataUrl ? (
              <div className="relative w-full h-full flex items-center justify-center">
                <img
                  src={qrDataUrl}
                  alt={`QR Code for ${displayName}`}
                  className="w-full h-full object-contain rounded-lg"
                />
                {/* Embedded Center Logo Badge */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="w-10 h-10 rounded-full bg-white p-0.5 shadow-md flex items-center justify-center">
                    <div className="w-full h-full rounded-full overflow-hidden bg-gradient-to-tr from-purple-600 to-cyan-500 p-[1.5px]">
                      <img src={avatarUrl} alt="" className="w-full h-full object-cover rounded-full bg-slate-900" />
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-xs text-rose-500">Failed to render QR</div>
            )}
          </div>

          {/* Branding footer */}
          <div className="text-[10px] font-bold tracking-wider text-purple-600 uppercase mt-3">
            ARVDOUL • CONNECT & DISCOVER
          </div>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-3 gap-2">
          {/* Copy Link */}
          <button
            onClick={handleCopy}
            className={cn(
              "flex flex-col items-center justify-center gap-1.5 py-2.5 px-2 rounded-2xl font-bold text-xs border transition-all hover:scale-[1.02] active:scale-[0.98]",
              copied
                ? "bg-emerald-500 text-white border-emerald-500"
                : (isDark ? "bg-white/5 hover:bg-white/10 border-white/10 text-white" : "bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-800")
            )}
            title="Copy Profile URL"
          >
            {copied ? <Check className="w-4 h-4 text-white" /> : <Copy className="w-4 h-4 text-purple-400" />}
            <span className="text-[11px]">{copied ? 'Copied' : 'Copy'}</span>
          </button>

          {/* Download Image */}
          <button
            onClick={handleDownload}
            className={cn(
              "flex flex-col items-center justify-center gap-1.5 py-2.5 px-2 rounded-2xl font-bold text-xs border transition-all hover:scale-[1.02] active:scale-[0.98]",
              isDark ? "bg-white/5 hover:bg-white/10 border-white/10 text-white" : "bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-800"
            )}
            title="Save QR Code Image"
          >
            <Download className="w-4 h-4 text-blue-400" />
            <span className="text-[11px]">Save</span>
          </button>

          {/* Share */}
          <button
            onClick={handleShare}
            className="flex flex-col items-center justify-center gap-1.5 py-2.5 px-2 rounded-2xl font-bold text-xs bg-gradient-to-r from-purple-600 via-indigo-600 to-cyan-500 hover:opacity-95 text-white shadow-md shadow-purple-500/25 transition-all hover:scale-[1.02] active:scale-[0.98]"
            title="Share Profile"
          >
            <Share2 className="w-4 h-4" />
            <span className="text-[11px]">Share</span>
          </button>
        </div>
      </div>
    </div>
  );
});

ProfileQRCodeModal.displayName = 'ProfileQRCodeModal';

export default ProfileQRCodeModal;

