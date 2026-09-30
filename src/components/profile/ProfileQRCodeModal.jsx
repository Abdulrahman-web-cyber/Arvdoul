/**
 * src/components/profile/ProfileQRCodeModal.jsx - ARVDOUL Profile QR Code Modal
 * 
 * Generates an actual, scannable unique high-resolution QR code for the user's
 * Arvdoul profile using `qrcode`. Supports instant PNG download, copy link,
 * and native device sharing.
 * 
 * @component
 */

import React, { memo, useState, useEffect, useMemo } from 'react';
import { X, Copy, Check, Share2, Download, QrCode, Sparkles, Loader2, ScanLine, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '../../lib/utils';
import { getSafeAvatarUrl } from '../../utils/avatarUtils';
import { generateQrDataUrl } from '../../utils/qrCodeGenerator';
import { getProfileUrl, getGlobalIdentityCode, shareProfile } from '../../utils/shareUtils';
import ProfileQRScannerModal from './ProfileQRScannerModal';

const ProfileQRCodeModal = memo(({
  isOpen,
  onClose,
  profile,
  theme = 'light',
}) => {
  const [copied, setCopied] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [qrLoading, setQrLoading] = useState(true);
  const [showScanner, setShowScanner] = useState(false);

  const isDark = theme === 'dark';
  const username = profile?.username || 'user';
  const displayName = profile?.displayName || profile?.name || 'Creator';
  const avatarUrl = getSafeAvatarUrl(profile?.photoURL, displayName, profile?.id || profile?.uid);

  // Deterministic global identity code from canonical helper
  const globalUniqueCode = useMemo(() => {
    return getGlobalIdentityCode(profile) || `ARV-${String(profile?.id || profile?.uid || 'USER').toUpperCase()}`;
  }, [profile]);

  // Canonical globally-unique URL format via shareUtils
  const profileUrl = useMemo(() => {
    return getProfileUrl(profile);
  }, [profile]);

  // Generate unique scannable QR code
  useEffect(() => {
    let isMounted = true;
    if (!isOpen || !profileUrl) return;

    setQrLoading(true);
    generateQrDataUrl(profileUrl, {
      width: 440,
      margin: 2,
      color: {
        dark: '#070b14',
        light: '#ffffff'
      }
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
    try {
      const res = await shareProfile(profile, {
        title: `${displayName} on Arvdoul`,
        text: `Connect with ${displayName} on Arvdoul! (${globalUniqueCode})`,
      });
      if (res.copied) {
        setCopied(true);
        toast.success('Profile URL copied to clipboard!');
        setTimeout(() => setCopied(false), 2000);
      }
    } catch (err) {
      handleCopy();
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-fade-in">
        <div className={cn(
          "relative w-full max-w-sm rounded-3xl p-6 border shadow-2xl transition-all max-h-[95vh] overflow-y-auto",
          isDark 
            ? "bg-[#0c1222] border-white/10 text-white shadow-[0_16px_50px_rgba(0,0,0,0.6)]" 
            : "bg-white border-slate-200 text-slate-900 shadow-[0_16px_50px_rgba(0,0,0,0.12)]"
        )}>
          {/* Close Button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-full hover:bg-slate-100 dark:hover:bg-white/10 transition-colors text-slate-400 hover:text-slate-600 dark:hover:text-white z-10"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Modal Title */}
          <div className="text-center mb-4">
            <div className="w-12 h-12 mx-auto mb-2.5 rounded-2xl bg-gradient-to-tr from-purple-600 via-indigo-600 to-cyan-500 flex items-center justify-center text-white shadow-lg shadow-purple-500/25">
              <QrCode className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold">Universal Profile QR</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              100% unique global identity code
            </p>
          </div>

          {/* High-Resolution QR Card */}
          <div className="p-4 sm:p-5 rounded-2xl bg-white text-slate-900 shadow-lg flex flex-col items-center justify-center border border-slate-200 mb-4 relative overflow-hidden group">
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

            {/* Global Identity Stamp */}
            <div className="mt-2.5 px-2.5 py-1 rounded-full bg-slate-100 border border-slate-200 text-[10px] font-semibold text-slate-600 flex items-center gap-1.5">
              <ShieldCheck className="w-3 h-3 text-emerald-600" />
              <span className="font-mono tracking-wider">{globalUniqueCode}</span>
            </div>

            {/* Branding footer */}
            <div className="text-[9px] font-bold tracking-wider text-purple-600 uppercase mt-2">
              ARVDOUL • GLOBAL IDENTITY
            </div>
          </div>

          {/* Action Buttons: Copy, Download, Share */}
          <div className="grid grid-cols-3 gap-2">
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

            <button
              onClick={handleShare}
              className="flex flex-col items-center justify-center gap-1.5 py-2.5 px-2 rounded-2xl font-bold text-xs bg-gradient-to-r from-purple-600 via-indigo-600 to-cyan-500 hover:opacity-95 text-white shadow-md shadow-purple-500/25 transition-all hover:scale-[1.02] active:scale-[0.98]"
              title="Share Profile"
            >
              <Share2 className="w-4 h-4" />
              <span className="text-[11px]">Share</span>
            </button>
          </div>

          {/* Scanner Button for another user to scan */}
          <div className="mt-4 pt-3 border-t border-slate-200 dark:border-white/10">
            <button
              type="button"
              onClick={() => setShowScanner(true)}
              className="w-full py-3 px-4 rounded-2xl font-bold text-xs bg-gradient-to-r from-purple-600 via-indigo-600 to-cyan-500 hover:opacity-95 text-white shadow-lg shadow-purple-500/25 transition-all hover:scale-[1.01] active:scale-[0.99] flex items-center justify-center gap-2"
            >
              <ScanLine className="w-4 h-4" />
              <span>Scan Another User's QR Code</span>
            </button>
          </div>
        </div>
      </div>

      {/* QR Scanner Modal */}
      {showScanner && (
        <ProfileQRScannerModal
          isOpen={showScanner}
          onClose={() => setShowScanner(false)}
          theme={theme}
        />
      )}
    </>
  );
});

ProfileQRCodeModal.displayName = 'ProfileQRCodeModal';

export default ProfileQRCodeModal;


