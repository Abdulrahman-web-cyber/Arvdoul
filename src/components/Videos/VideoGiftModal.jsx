// src/components/Videos/VideoGiftModal.jsx - ARVDOUL VIRTUAL GIFT MODAL
// Send coin gifts to creators in real-time with celebration animations

import React, { useState, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Sparkles, Zap, Award, Coins } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
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
  const { currentUser, updateCurrentUser } = useAppStore();
  const [selectedGift, setSelectedGift] = useState(VIRTUAL_GIFTS[0]);
  const [sending, setSending] = useState(false);
  const [sentAnimation, setSentAnimation] = useState(null);

  const userCoins = currentUser?.coins ?? 1250;

  const handleSend = async () => {
    if (!selectedGift) return;

    if (userCoins < selectedGift.coins) {
      toast.error(`Not enough coins! You need ${selectedGift.coins} coins.`);
      return;
    }

    setSending(true);
    setSentAnimation(selectedGift);

    try {
      // Deduct coins locally and in store
      if (updateCurrentUser && currentUser) {
        updateCurrentUser({
          coins: Math.max(0, userCoins - selectedGift.coins),
        });
      }

      onSendGift?.(selectedGift);
      toast.success(`Sent ${selectedGift.name} to @${creator?.username || 'creator'}! ✨`);

      setTimeout(() => {
        setSentAnimation(null);
        setSending(false);
        onClose();
      }, 1200);
    } catch (err) {
      toast.error('Failed to send gift');
      setSending(false);
      setSentAnimation(null);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ y: 100, opacity: 0, scale: 0.95 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: 100, opacity: 0, scale: 0.95 }}
          transition={{ type: 'spring', damping: 28, stiffness: 350 }}
          onClick={(e) => e.stopPropagation()}
          className={`w-full max-w-md rounded-t-3xl sm:rounded-3xl border shadow-2xl p-6 relative overflow-hidden ${
            isDark
              ? 'bg-[#0b1020]/95 border-white/10 text-white'
              : 'bg-white/95 border-gray-200 text-gray-900'
          }`}
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-amber-400 to-yellow-500 flex items-center justify-center text-white shadow-md">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-bold text-base leading-tight">Send a Gift</h3>
                <p className="text-xs opacity-60">Support @{creator?.username || 'creator'}</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* Coin Balance */}
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-400 font-bold text-xs">
                <Coins className="w-3.5 h-3.5 text-yellow-400" />
                <span>{userCoins.toLocaleString()}</span>
              </div>

              <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={onClose}
                className="p-1.5 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
              >
                <X className="w-4 h-4" />
              </motion.button>
            </div>
          </div>

          {/* Gift Grid */}
          <div className="grid grid-cols-3 gap-3 my-4">
            {VIRTUAL_GIFTS.map((gift) => {
              const isSelected = selectedGift?.id === gift.id;
              const canAfford = userCoins >= gift.coins;

              return (
                <motion.button
                  key={gift.id}
                  whileTap={{ scale: 0.95 }}
                  whileHover={{ scale: 1.03 }}
                  onClick={() => setSelectedGift(gift)}
                  className={`p-3 rounded-2xl flex flex-col items-center gap-1.5 border transition-all relative ${
                    isSelected
                      ? 'bg-gradient-to-b from-purple-500/20 to-pink-500/20 border-purple-500 shadow-lg shadow-purple-500/20'
                      : isDark
                      ? 'bg-white/5 border-white/10 hover:bg-white/10'
                      : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
                  } ${!canAfford ? 'opacity-50' : ''}`}
                >
                  <span className="text-3xl filter drop-shadow-md">{gift.icon}</span>
                  <span className="text-xs font-semibold text-center leading-tight truncate w-full">
                    {gift.name}
                  </span>
                  <div className="flex items-center gap-1 text-[11px] font-bold text-amber-400">
                    <Coins className="w-3 h-3 text-yellow-400" />
                    <span>{gift.coins}</span>
                  </div>

                  {isSelected && (
                    <motion.div
                      layoutId="selectedGiftPill"
                      className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 ring-2 ring-white"
                    />
                  )}
                </motion.button>
              );
            })}
          </div>

          {/* Send Button */}
          <motion.button
            whileTap={{ scale: 0.98 }}
            whileHover={{ scale: 1.02 }}
            onClick={handleSend}
            disabled={sending || !selectedGift || userCoins < (selectedGift?.coins || 0)}
            className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-purple-600 via-pink-600 to-amber-500 text-white font-bold text-sm shadow-xl shadow-purple-500/30 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {sending ? (
              <span>Sending {selectedGift?.name}... ✨</span>
            ) : (
              <>
                <span>Send {selectedGift?.name}</span>
                <span className="opacity-80">({selectedGift?.coins} Coins)</span>
              </>
            )}
          </motion.button>

          {/* Celebration Animation Burst */}
          <AnimatePresence>
            {sentAnimation && (
              <motion.div
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: [0, 1.4, 1], opacity: [0, 1, 0] }}
                exit={{ opacity: 0 }}
                transition={{ duration: 1.2, ease: 'easeOut' }}
                className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none bg-black/40 z-20"
              >
                <span className="text-7xl filter drop-shadow-2xl">{sentAnimation.icon}</span>
                <p className="text-white font-black text-xl mt-2 tracking-wide drop-shadow-lg">
                  +{sentAnimation.coins} Coins Sent!
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </motion.div>
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
