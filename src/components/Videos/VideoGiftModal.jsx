// src/components/Videos/VideoGiftModal.jsx
//
// Send coin gifts to creators — double-entry coin transfer via the monetization ledger

import { useState, memo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Sparkles, Zap, Coins, Loader2 } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { useAppStore } from '../../store/appStore';
import { VIRTUAL_GIFTS } from '../../data/videoData';
import { BRAND_GRADIENT } from '../../design-system/tokens.js';
import { toast } from 'sonner';
import PropTypes from 'prop-types';

const VideoGiftModal = memo(({
  isOpen = false,
  onClose,
  creator = {},
  video = null,
  onGiftSent,
}) => {
  const { isDark } = useTheme();
  const { user } = useAuth();
  const { currentUser, updateUserProfile } = useAppStore();
  const [selectedGift, setSelectedGift] = useState(VIRTUAL_GIFTS[0]);
  const [sending, setSending] = useState(false);
  const [sentAnimation, setSentAnimation] = useState(null);
  const [balance, setBalance] = useState(null);
  const [balanceError, setBalanceError] = useState(false);

  useEffect(() => {
    if (!isOpen || !user?.uid) return;
    let cancelled = false;
    (async () => {
      try {
        const { getMonetizationService } = await import('../../services/monetizationService.js');
        const b = await getMonetizationService().getBalance(user.uid);
        if (!cancelled) {
          setBalance(typeof b === 'number' ? b : null);
          setBalanceError(false);
        }
      } catch (err) {
        console.warn('VideoGiftModal: failed to load balance', err);
        if (!cancelled) {
          setBalance(null);
          setBalanceError(true);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [isOpen, user?.uid]);

  const recipientId = creator?.id || creator?.uid || video?.authorId || video?.userId || null;

  const handleSend = async () => {
    if (!selectedGift || sending) return;
    if (!user?.uid) {
      toast.error('Sign in to send gifts');
      return;
    }
    if (!recipientId) {
      toast.error('Gift recipient unknown');
      return;
    }
    if (recipientId === user.uid) {
      toast.error('You cannot gift yourself');
      return;
    }
    if (balance != null && balance < selectedGift.coins) {
      toast.error(`Not enough coins! You need ${selectedGift.coins} coins, you have ${balance}.`);
      return;
    }

    setSending(true);
    try {
      const { getMonetizationService } = await import('../../services/monetizationService.js');
      const res = await getMonetizationService().transferCoins(
        user.uid,
        recipientId,
        selectedGift.coins,
        'video_gift',
        {
          giftType: selectedGift.type,
          giftName: selectedGift.name,
          videoId: video?.id || null,
          postId: video?.canonicalPostId || video?.id || null,
        }
      );
      if (!res?.success) {
        throw new Error(res?.message || 'Gift could not be sent');
      }

      try {
        const b = await getMonetizationService().getBalance(user.uid);
        if (typeof b === 'number') {
          setBalance(b);
          if (updateUserProfile && currentUser) {
            updateUserProfile({ coins: b });
          }
        }
      } catch { /* best-effort balance refresh */ }

      setSentAnimation(selectedGift);
      onGiftSent?.(selectedGift);
      toast.success(`Sent ${selectedGift.name} to @${creator?.username || creator?.name || 'creator'}!`);
      setTimeout(() => {
        setSentAnimation(null);
        setSending(false);
        onClose();
      }, 1200);
    } catch (err) {
      toast.error(err?.message || 'Failed to send gift');
      setSending(false);
      setSentAnimation(null);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[90] flex items-end sm:items-center justify-center bg-black/75 backdrop-blur-sm"
          onClick={sending ? undefined : onClose}
        >
          <motion.div
            initial={{ y: 60, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 60, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            className={`w-full max-w-md rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl relative overflow-hidden border ${
              isDark ? 'bg-[#080F2E]/95 border-white/12' : 'bg-white border-gray-200'
            }`}
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-purple-400" />
                <h3 className={`font-bold text-lg ${isDark ? 'text-white' : 'text-gray-900'}`}>Send a Gift</h3>
              </div>
              <button
                type="button"
                onClick={onClose}
                disabled={sending}
                aria-label="Close"
                className={`min-w-[40px] min-h-[40px] flex items-center justify-center rounded-full ${
                  isDark ? 'text-gray-400 hover:text-white hover:bg-white/10' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'
                }`}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Recipient */}
            <p className={`text-sm mb-4 ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
              To{' '}
              <span className={`font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                @{creator?.username || creator?.name || 'creator'}
              </span>
            </p>

            {/* Balance */}
            <div className={`flex items-center justify-between rounded-2xl px-4 py-3 mb-5 ${
              isDark ? 'bg-black/35 border border-white/10' : 'bg-gray-100 border border-gray-200'
            }`}>
              <span className={`text-xs font-medium ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>Your balance</span>
              <span className={`text-sm font-bold flex items-center gap-1 ${balanceError ? 'text-red-400' : 'text-amber-500'}`}>
                <Coins className="w-4 h-4" />
                {balanceError ? 'Unavailable' : balance == null ? '—' : balance.toLocaleString()}
              </span>
            </div>

            {/* Gifts grid */}
            <div className="grid grid-cols-3 gap-3 mb-6">
              {VIRTUAL_GIFTS.map((gift) => {
                const isSelected = selectedGift?.type === gift.type;
                return (
                  <motion.button
                    key={gift.type}
                    type="button"
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setSelectedGift(gift)}
                    className={`p-3 rounded-2xl border text-center transition-colors ${
                      isSelected
                        ? 'border-purple-500 bg-purple-500/15'
                        : isDark
                          ? 'border-white/10 bg-white/5 hover:border-purple-500/50'
                          : 'border-gray-200 bg-gray-50 hover:border-purple-400'
                    }`}
                  >
                    <div className="text-2xl mb-1">{gift.emoji}</div>
                    <div className={`text-[11px] font-semibold truncate ${isDark ? 'text-white' : 'text-gray-900'}`}>{gift.name}</div>
                    <div className="text-[11px] font-bold text-amber-500 flex items-center justify-center gap-0.5 mt-0.5">
                      <Coins className="w-3 h-3" /> {gift.coins}
                    </div>
                  </motion.button>
                );
              })}
            </div>

            {/* Send */}
            <button
              type="button"
              onClick={handleSend}
              disabled={sending || (balance != null && balance < selectedGift.coins)}
              className="w-full py-4 min-h-[48px] rounded-2xl font-bold text-white shadow-xl hover:opacity-95 disabled:opacity-50 flex items-center justify-center gap-2"
              style={{ background: BRAND_GRADIENT }}
            >
              {sending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Sending...
                </>
              ) : (
                <>
                  <Zap className="w-4 h-4" /> Send {selectedGift.name}
                </>
              )}
            </button>

            {/* Sent animation */}
            {sentAnimation && (
              <motion.div
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1.2, opacity: 1 }}
                className="absolute inset-0 flex items-center justify-center bg-black/75 backdrop-blur-sm"
              >
                <div className="text-center">
                  <div className="text-6xl mb-2">{sentAnimation.emoji}</div>
                  <p className="text-white font-bold">Gift sent!</p>
                </div>
              </motion.div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
});

VideoGiftModal.displayName = 'VideoGiftModal';

VideoGiftModal.propTypes = {
  isOpen: PropTypes.bool,
  onClose: PropTypes.func.isRequired,
  creator: PropTypes.object,
  video: PropTypes.object,
  onGiftSent: PropTypes.func,
};

export default VideoGiftModal;
