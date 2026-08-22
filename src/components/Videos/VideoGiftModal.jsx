// src/components/Videos/VideoGiftModal.jsx - ARVDOUL VIRTUAL GIFT MODAL
// Send coin gifts to creators — REAL double-entry coin transfer via the
// monetization ledger (transferCoins CF with atomic fallback). The local
// store is only updated AFTER the server confirms the debit; no free gifts,
// no fabricated balances.

import React, { useState, memo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Sparkles, Zap, Award, Coins, Loader2 } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { useAppStore } from '../../store/appStore';
import { VIRTUAL_GIFTS } from '../../data/videoData';
import { toast } from 'sonner';
import PropTypes from 'prop-types';

const VideoGiftModal = memo(({
  isOpen = false,
  onClose,
  creator = {},
  onSendGift,
}) => {
  const { isDark } = useTheme();
  const { user } = useAuth();
  const { currentUser, updateCurrentUser } = useAppStore();
  const [selectedGift, setSelectedGift] = useState(VIRTUAL_GIFTS[0]);
  const [sending, setSending] = useState(false);
  const [sentAnimation, setSentAnimation] = useState(null);
  const [balance, setBalance] = useState(null);

  // REAL balance from the ledger whenever the modal opens.
  useEffect(() => {
    if (!isOpen || !user?.uid) return;
    let cancelled = false;
    (async () => {
      try {
        const { getMonetizationService } = await import('../../services/monetizationService.js');
        const b = await getMonetizationService().getBalance(user.uid);
        if (!cancelled) setBalance(typeof b === 'number' ? b : null);
      } catch {
        if (!cancelled) setBalance(null);
      }
    })();
    return () => { cancelled = true; };
  }, [isOpen, user?.uid]);

  const recipientId = creator?.id || creator?.uid || null;

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
      // REAL server-authoritative transfer (double-entry ledger).
      const { getMonetizationService } = await import('../../services/monetizationService.js');
      const res = await getMonetizationService().transferCoins(
        user.uid,
        recipientId,
        selectedGift.coins,
        'video_gift',
        { giftType: selectedGift.id, giftName: selectedGift.name }
      );
      if (!res?.success) {
        throw new Error(res?.message || 'Gift could not be sent');
      }

      // Refresh the REAL balance from the ledger.
      try {
        const b = await getMonetizationService().getBalance(user.uid);
        if (typeof b === 'number') {
          setBalance(b);
          if (updateCurrentUser && currentUser) {
            updateCurrentUser({ coins: b });
          }
        }
      } catch { /* best-effort */ }

      setSentAnimation(selectedGift);
      onSendGift?.(selectedGift);
      toast.success(`Sent ${selectedGift.name} to @${creator?.username || creator?.name || 'creator'}! ✨`);
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
          className="fixed inset-0 z-[90] flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm"
          onClick={sending ? undefined : onClose}
        >
          <motion.div
            initial={{ y: 60, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 60, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            className={`w-full max-w-md rounded-t-3xl sm:rounded-3xl p-6 ${
              isDark ? 'bg-gray-900 border border-gray-800' : 'bg-white'
            } shadow-2xl relative overflow-hidden`}
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-purple-400" />
                <h3 className="font-bold text-lg text-white">Send a Gift</h3>
              </div>
              <button onClick={onClose} disabled={sending} className="text-gray-400 hover:text-white p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Recipient */}
            <p className="text-sm text-gray-400 mb-4">
              To{' '}
              <span className="font-bold text-white">
                @{creator?.username || creator?.name || 'creator'}
              </span>
            </p>

            {/* Balance */}
            <div className="flex items-center justify-between bg-black/30 rounded-2xl px-4 py-3 mb-5">
              <span className="text-xs text-gray-400">Your balance</span>
              <span className="text-sm font-bold text-yellow-400 flex items-center gap-1">
                <Coins className="w-4 h-4" />
                {balance == null ? '—' : balance.toLocaleString()}
              </span>
            </div>

            {/* Gifts grid */}
            <div className="grid grid-cols-3 gap-3 mb-6">
              {VIRTUAL_GIFTS.map((gift) => (
                <motion.button
                  key={gift.id}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setSelectedGift(gift)}
                  className={`p-3 rounded-2xl border text-center transition-colors ${
                    selectedGift?.id === gift.id
                      ? 'border-purple-500 bg-purple-500/15'
                      : 'border-gray-700/60 bg-black/20 hover:border-purple-500/50'
                  }`}
                >
                  <div className="text-2xl mb-1">{gift.icon}</div>
                  <div className="text-[10px] font-semibold text-white truncate">{gift.name}</div>
                  <div className="text-[10px] font-bold text-yellow-400 flex items-center justify-center gap-0.5">
                    <Coins className="w-3 h-3" /> {gift.coins}
                  </div>
                </motion.button>
              ))}
            </div>

            {/* Send */}
            <button
              onClick={handleSend}
              disabled={sending || balance != null && balance < selectedGift.coins}
              className="w-full py-4 rounded-2xl font-bold bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-xl shadow-purple-500/25 hover:opacity-95 disabled:opacity-50 flex items-center justify-center gap-2"
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
                className="absolute inset-0 flex items-center justify-center bg-black/70 backdrop-blur-sm"
              >
                <div className="text-center">
                  <div className="text-6xl mb-2">{sentAnimation.icon}</div>
                  <p className="text-white font-bold">Gift sent! ✨</p>
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
  onSendGift: PropTypes.func,
};

export default VideoGiftModal;
