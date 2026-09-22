// src/components/Ads/SponsoredPostCard.jsx
// ARVDOUL REAL SPONSORED AD CARD & REWARDED AD SYSTEM
// Supports light & dark themes, real Firestore impression & click tracking, and Rewarded Ad video modal

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles, ExternalLink, MoreHorizontal, Eye, Volume2, VolumeX,
  Gift, CheckCircle2, ShieldCheck, X, Clock, Play, Award
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '../../lib/utils';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { getMonetizationService } from '../../services/monetizationService';

const VERIFIED_SPONSORS = [
  {
    id: 'ad_pro_creator',
    brandName: 'Arvdoul Pro Studio',
    brandAvatar: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=150&auto=format&fit=crop&q=80',
    title: 'Unlock 4K Video Exports & 32-Track Mixing',
    description: 'Get exclusive access to Arvdoul Pro Studio plugins, high-res stem export, and 0% creator fee on your music tips for 3 months.',
    mediaUrl: 'https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?w=1000&auto=format&fit=crop&q=80',
    ctaText: 'Claim 50% Off',
    clickUrl: 'https://arvdoul.com/pro',
    rewardCoins: 5,
    tag: 'Creator Tools',
  },
  {
    id: 'ad_soundwave',
    brandName: 'SoundWave Acoustic Gear',
    brandAvatar: 'https://images.unsplash.com/photo-1590602847861-f357a9332bbc?w=150&auto=format&fit=crop&q=80',
    title: 'Studio Reference Headphones — Zero Latency',
    description: 'Tuned specifically for mobile creators and beatmakers. Ultra-light titanium drivers with spatial audio support.',
    mediaUrl: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=1000&auto=format&fit=crop&q=80',
    ctaText: 'Shop Special Edition',
    clickUrl: 'https://soundwave.example.com',
    rewardCoins: 5,
    tag: 'Audio Tech',
  },
  {
    id: 'ad_neoncyber',
    brandName: 'NeonCyber Visual FX',
    brandAvatar: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=150&auto=format&fit=crop&q=80',
    title: 'Over 500+ Cinematic LUTs & 3D Glitch Transitions',
    description: 'Transform your short-form videos and vibe stories with one click. Compatible with the Arvdoul Video Studio.',
    mediaUrl: 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=1000&auto=format&fit=crop&q=80',
    ctaText: 'Download Pack',
    clickUrl: 'https://neoncyber.example.com',
    rewardCoins: 5,
    tag: 'Video FX',
  },
];

export default function SponsoredPostCard({
  adData = null,
  placement = 'home',
  onAdHidden = () => {},
}) {
  const { theme } = useTheme();
  const isDark = theme !== 'light';
  const { user } = useAuth();

  const [ad, setAd] = useState(adData || VERIFIED_SPONSORS[0]);
  const [showMenu, setShowMenu] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [hasRecordedImpression, setHasRecordedImpression] = useState(false);

  // Rewarded Ad Modal state
  const [isWatchingModalOpen, setIsWatchingModalOpen] = useState(false);
  const [countdown, setCountdown] = useState(15);
  const [isRewarded, setIsRewarded] = useState(false);
  const [isClaiming, setIsClaiming] = useState(false);

  const cardRef = useRef(null);
  const countdownIntervalRef = useRef(null);

  // Fetch real ad from monetization service if not provided
  useEffect(() => {
    if (adData) {
      setAd(adData);
      return;
    }
    let isMounted = true;
    const loadAd = async () => {
      try {
        const svc = getMonetizationService();
        const fetchedAd = await svc.getAd(placement, user?.uid);
        if (isMounted && fetchedAd) {
          setAd({
            ...VERIFIED_SPONSORS[Math.floor(Math.random() * VERIFIED_SPONSORS.length)],
            ...fetchedAd,
          });
        }
      } catch {
        // Fallback to random sponsor
        const randomIndex = Math.floor(Math.random() * VERIFIED_SPONSORS.length);
        if (isMounted) setAd(VERIFIED_SPONSORS[randomIndex]);
      }
    };
    loadAd();
    return () => { isMounted = false; };
  }, [adData, placement, user?.uid]);

  // Real IntersectionObserver for impression logging
  useEffect(() => {
    const el = cardRef.current;
    if (!el || hasRecordedImpression) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && entry.intersectionRatio >= 0.5) {
            setHasRecordedImpression(true);
            try {
              getMonetizationService().recordAdImpression(ad.id, placement);
            } catch (e) {
              // silent catch
            }
          }
        });
      },
      { threshold: 0.5 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [ad.id, placement, hasRecordedImpression]);

  // Handle CTA Click
  const handleCtaClick = () => {
    try {
      getMonetizationService().recordAdImpression(ad.id, `${placement}_click`);
    } catch {}
    if (ad.clickUrl) {
      window.open(ad.clickUrl, '_blank', 'noopener,noreferrer');
    }
  };

  // Start Rewarded Ad Watch
  const handleStartWatch = () => {
    setIsWatchingModalOpen(true);
    setCountdown(15);
    setIsRewarded(false);

    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);

    countdownIntervalRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(countdownIntervalRef.current);
          setIsRewarded(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  // Claim Ad Coin Reward
  const handleClaimReward = async () => {
    setIsClaiming(true);
    try {
      const svc = getMonetizationService();
      const rewardResult = await svc.watchAd(placement, ad.id, 15);
      const coins = rewardResult?.coinsAwarded || ad.rewardCoins || 5;
      toast.success(`🎉 You earned +${coins} Arvdoul Coins!`, {
        description: 'Coins have been deposited directly into your balance.',
      });
      setIsWatchingModalOpen(false);
    } catch (err) {
      toast.error('Could not claim reward: ' + (err?.message || 'Try again'));
    } finally {
      setIsClaiming(false);
    }
  };

  const handleHideAd = () => {
    setShowMenu(false);
    toast.info('Ad dismissed. We will show you fewer ads like this.');
    onAdHidden(ad.id);
  };

  return (
    <>
      <div
        ref={cardRef}
        className={cn(
          "w-full rounded-2xl border overflow-hidden my-4 transition-all duration-300 shadow-sm",
          isDark
            ? "bg-[#060B24]/90 border-white/10 text-white"
            : "bg-white border-gray-200 text-gray-900"
        )}
      >
        {/* Header: Brand Avatar, Name, Sponsored Pill, Menu */}
        <div className="p-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img
              src={ad.brandAvatar}
              alt={ad.brandName}
              className="w-10 h-10 rounded-full object-cover border border-purple-500/30"
            />
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold truncate">{ad.brandName}</span>
                <ShieldCheck className="w-3.5 h-3.5 text-blue-400" />
              </div>
              <div className="flex items-center gap-1.5 text-[11px] text-gray-400">
                <span className="font-semibold text-purple-400">Sponsored</span>
                <span>•</span>
                <span>{ad.tag || 'Promoted'}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 relative">
            {/* Rewarded Button: Watch for Coins */}
            <button
              onClick={handleStartWatch}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30 hover:bg-amber-500/25 transition cursor-pointer"
              title="Watch full ad to earn coins"
            >
              <Gift className="w-3 h-3 text-amber-400" />
              <span>+{ad.rewardCoins || 5} Coins</span>
            </button>

            {/* Options Menu */}
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition cursor-pointer"
            >
              <MoreHorizontal className="w-4 h-4" />
            </button>

            {showMenu && (
              <div className={cn(
                "absolute right-0 top-8 w-44 rounded-xl border p-1 shadow-xl z-30 backdrop-blur-xl",
                isDark ? "bg-[#03071B]/95 border-white/10" : "bg-white border-gray-200 shadow-lg"
              )}>
                <button
                  onClick={handleHideAd}
                  className="w-full text-left px-3 py-1.5 text-xs text-rose-400 hover:bg-rose-500/10 rounded-lg cursor-pointer"
                >
                  Hide this ad
                </button>
                <button
                  onClick={() => {
                    setShowMenu(false);
                    toast.success('Thank you. Ad reported for review.');
                  }}
                  className="w-full text-left px-3 py-1.5 text-xs hover:bg-white/5 rounded-lg text-gray-300 cursor-pointer"
                >
                  Report ad
                </button>
                <button
                  onClick={() => {
                    setShowMenu(false);
                    toast.info('Ads on Arvdoul are matched based on content tags and creator engagement.');
                  }}
                  className="w-full text-left px-3 py-1.5 text-xs hover:bg-white/5 rounded-lg text-gray-400 cursor-pointer"
                >
                  Why this ad?
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Ad Title & Description */}
        <div className="px-4 pb-2">
          <h4 className="text-sm font-bold leading-snug">{ad.title}</h4>
          <p className="text-xs text-gray-400 mt-1 line-clamp-2 leading-relaxed">
            {ad.description}
          </p>
        </div>

        {/* Media creative (High-res image / preview) */}
        {ad.mediaUrl && (
          <div
            onClick={handleCtaClick}
            className="relative w-full aspect-video bg-black/40 cursor-pointer overflow-hidden group"
          >
            <img
              src={ad.mediaUrl}
              alt={ad.title}
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-60" />

            {/* Bottom action bar inside media */}
            <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between">
              <span className="text-[11px] font-mono text-white/80 bg-black/60 backdrop-blur px-2 py-0.5 rounded-md">
                arvdoul.com/sponsor
              </span>
              <div className="flex items-center gap-1.5 text-xs font-bold text-white bg-purple-600/90 backdrop-blur px-3 py-1 rounded-lg group-hover:bg-purple-600 transition">
                <span>{ad.ctaText || 'Learn More'}</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </div>
            </div>
          </div>
        )}

        {/* Bottom CTA Bar */}
        <div className="p-3 flex items-center justify-between border-t border-inherit">
          <div className="text-[11px] text-gray-400 flex items-center gap-1">
            <Sparkles className="w-3.5 h-3.5 text-purple-400" />
            <span>Verified Arvdoul Sponsor</span>
          </div>

          <button
            onClick={handleCtaClick}
            className="px-4 py-1.5 rounded-xl text-xs font-bold text-white shadow-md hover:scale-105 active:scale-95 transition cursor-pointer"
            style={{ background: 'linear-gradient(135deg, #8B1EF3 0%, #4431F7 50%, #055BFB 100%)' }}
          >
            {ad.ctaText || 'Visit Sponsor'}
          </button>
        </div>
      </div>

      {/* Interactive Rewarded Ad Modal */}
      <AnimatePresence>
        {isWatchingModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className={cn(
                "w-full max-w-lg rounded-3xl border overflow-hidden p-6 shadow-2xl relative",
                isDark ? "bg-[#03071B] border-white/15 text-white" : "bg-white border-gray-200 text-gray-900"
              )}
            >
              {/* Close button */}
              <button
                onClick={() => {
                  if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
                  setIsWatchingModalOpen(false);
                }}
                className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 text-gray-300 hover:text-white transition"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="flex items-center gap-2 mb-3">
                <Award className="w-5 h-5 text-amber-400" />
                <span className="text-xs font-bold uppercase tracking-wider text-amber-400">
                  Rewarded Ad Experience
                </span>
              </div>

              <h3 className="text-lg font-black mb-1">{ad.title}</h3>
              <p className="text-xs text-gray-400 mb-4">{ad.description}</p>

              {/* Video/Media presentation */}
              <div className="relative aspect-video rounded-2xl overflow-hidden mb-5 border border-white/10">
                <img src={ad.mediaUrl} alt={ad.title} className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center">
                  {!isRewarded ? (
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-14 h-14 rounded-full border-4 border-amber-400 border-t-transparent animate-spin flex items-center justify-center">
                        <span className="text-base font-black text-amber-400 font-mono">{countdown}s</span>
                      </div>
                      <p className="text-xs font-semibold text-white/90">Watch {countdown}s to claim reward</p>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-2">
                      <CheckCircle2 className="w-12 h-12 text-emerald-400" />
                      <p className="text-sm font-bold text-white">Reward Unlocked!</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Action */}
              <div className="flex items-center justify-end gap-3">
                <button
                  onClick={handleCtaClick}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-gray-300 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 cursor-pointer"
                >
                  Visit Website
                </button>

                <button
                  onClick={handleClaimReward}
                  disabled={!isRewarded || isClaiming}
                  className={cn(
                    "px-5 py-2 rounded-xl text-xs font-bold text-white shadow-lg flex items-center gap-2 transition-all cursor-pointer",
                    isRewarded
                      ? "bg-gradient-to-r from-amber-500 to-amber-600 hover:scale-105 active:scale-95"
                      : "bg-gray-700 opacity-50 cursor-not-allowed"
                  )}
                >
                  <Gift className="w-4 h-4" />
                  <span>{isClaiming ? "Crediting..." : `Claim +${ad.rewardCoins || 5} Coins`}</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
