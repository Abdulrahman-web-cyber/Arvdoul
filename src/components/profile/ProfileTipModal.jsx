/**
 * src/components/profile/ProfileTipModal.jsx - ARVDOUL Creator Tipping Modal
 * 
 * Elegant modal allowing users to send coin tips to creators directly from their profile.
 * Supports quick preset amounts, custom coin input, personal notes, and real-time coin ledger balance updates.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Coins, Heart, Send, X, AlertCircle, CheckCircle2, Loader2, Sparkles } from 'lucide-react';
import { cn } from '../../lib/utils';
import { getMonetizationService } from '../../services/monetizationService.js';
import { toast } from 'sonner';

const PRESET_AMOUNTS = [10, 50, 100, 250, 500, 1000];

export default function ProfileTipModal({
  isOpen,
  onClose,
  recipient,
  currentUser,
  onTipSuccess,
}) {
  const [amount, setAmount] = useState(50);
  const [customAmount, setCustomAmount] = useState('');
  const [note, setNote] = useState('');
  const [userBalance, setUserBalance] = useState(0);
  const [loadingBalance, setLoadingBalance] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const recipientId = recipient?.id || recipient?.uid;
  const currentUserId = currentUser?.uid || currentUser?.id;

  // Fetch current user's balance
  useEffect(() => {
    if (!isOpen || !currentUserId) return;

    let isMounted = true;
    setLoadingBalance(true);
    setSuccess(false);

    getMonetizationService().getBalance(currentUserId)
      .then((res) => {
        if (isMounted) {
          setUserBalance(res?.coins || 0);
        }
      })
      .catch(() => {
        if (isMounted) setUserBalance(0);
      })
      .finally(() => {
        if (isMounted) setLoadingBalance(false);
      });

    return () => { isMounted = false; };
  }, [isOpen, currentUserId]);

  const effectiveAmount = customAmount ? parseInt(customAmount, 10) || 0 : amount;
  const hasInsufficientBalance = userBalance < effectiveAmount;

  const handleSelectPreset = (val) => {
    setAmount(val);
    setCustomAmount('');
  };

  const handleCustomChange = (e) => {
    const val = e.target.value.replace(/\D/g, '');
    setCustomAmount(val);
  };

  const handleSendTip = async () => {
    if (!currentUserId) {
      toast.error('Please sign in to send a tip');
      return;
    }
    if (currentUserId === recipientId) {
      toast.error('You cannot tip yourself');
      return;
    }
    if (effectiveAmount <= 0) {
      toast.error('Please select or enter a valid tip amount');
      return;
    }
    if (hasInsufficientBalance) {
      toast.error('Insufficient coin balance to send this tip');
      return;
    }

    setSubmitting(true);
    try {
      const monetization = getMonetizationService();
      const idempotencyKey = `tip_${currentUserId}_${recipientId}_${Date.now()}`;
      
      await monetization.transferCoins(
        currentUserId,
        recipientId,
        effectiveAmount,
        'creator_tip',
        {
          note: note.trim() || undefined,
          recipientName: recipient.displayName || recipient.username || 'Creator',
          senderName: currentUser.displayName || currentUser.username || 'Supporter',
        },
        idempotencyKey
      );

      setSuccess(true);
      setUserBalance((prev) => Math.max(0, prev - effectiveAmount));
      toast.success(`Sent ${effectiveAmount} coins to ${recipient.displayName || 'creator'}! 🎉`);
      
      if (onTipSuccess) {
        onTipSuccess(effectiveAmount);
      }

      setTimeout(() => {
        onClose();
        setSuccess(false);
        setNote('');
        setCustomAmount('');
      }, 1500);
    } catch (err) {
      toast.error(err.message || 'Failed to send tip. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          transition={{ duration: 0.2 }}
          className="relative w-full max-w-md overflow-hidden rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-2xl p-6"
        >
          {/* Close button */}
          <button
            onClick={onClose}
            disabled={submitting}
            className="absolute top-4 right-4 p-1.5 rounded-full text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Header */}
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-purple-500/30 flex-shrink-0 bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
              {recipient?.photoURL ? (
                <img
                  src={recipient.photoURL}
                  alt={recipient.displayName || 'Recipient'}
                  className="w-full h-full object-cover"
                />
              ) : (
                <Heart className="w-6 h-6 text-purple-600 dark:text-purple-400" />
              )}
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
                Tip {recipient?.displayName || recipient?.username || 'Creator'}
                <Sparkles className="w-4 h-4 text-amber-500" />
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Support creative production & earn citizenship goodwill
              </p>
            </div>
          </div>

          {success ? (
            <div className="py-10 text-center flex flex-col items-center justify-center">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-3"
              >
                <CheckCircle2 className="w-10 h-10" />
              </motion.div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-1">
                Tip Sent Successfully!
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                You sent <strong className="text-amber-500">{effectiveAmount} coins</strong> to {recipient?.displayName || 'creator'}.
              </p>
            </div>
          ) : (
            <div className="space-y-5">
              {/* Preset Amounts */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">
                  Select Amount (Coins)
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {PRESET_AMOUNTS.map((amt) => {
                    const isSelected = !customAmount && amount === amt;
                    return (
                      <button
                        key={amt}
                        type="button"
                        onClick={() => handleSelectPreset(amt)}
                        className={cn(
                          'flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl font-semibold text-sm transition-all border',
                          isSelected
                            ? 'bg-purple-600 text-white border-purple-600 shadow-md shadow-purple-500/20'
                            : 'bg-gray-50 dark:bg-gray-800/60 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:border-purple-400'
                        )}
                      >
                        <Coins className="w-4 h-4 text-amber-400" />
                        <span>{amt}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Custom Amount */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">
                  Or Custom Coin Amount
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-amber-400">
                    <Coins className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="Enter amount..."
                    value={customAmount}
                    onChange={handleCustomChange}
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/60 text-gray-900 dark:text-white placeholder-gray-400 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>
              </div>

              {/* Message / Note */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">
                  Optional Note (Public or Creator-Only)
                </label>
                <input
                  type="text"
                  maxLength={120}
                  placeholder="Keep up the inspiring work! 🚀"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/60 text-gray-900 dark:text-white placeholder-gray-400 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              {/* Balance & Warning */}
              <div className="flex items-center justify-between text-xs py-2 px-3 rounded-lg bg-gray-100 dark:bg-gray-800/50">
                <span className="text-gray-500 dark:text-gray-400">Your Coin Balance:</span>
                <span className="font-semibold text-gray-900 dark:text-white flex items-center gap-1">
                  <Coins className="w-3.5 h-3.5 text-amber-400" />
                  {loadingBalance ? '...' : userBalance.toLocaleString()} coins
                </span>
              </div>

              {hasInsufficientBalance && (
                <div className="flex items-center gap-2 p-2.5 rounded-lg bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 text-xs">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>You need {effectiveAmount - userBalance} more coins to send this tip.</span>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={submitting}
                  className="flex-1 py-2.5 px-4 rounded-xl border border-gray-200 dark:border-gray-700 font-medium text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSendTip}
                  disabled={submitting || hasInsufficientBalance || effectiveAmount <= 0}
                  className={cn(
                    'flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl font-bold text-sm text-white transition-all shadow-md',
                    submitting || hasInsufficientBalance || effectiveAmount <= 0
                      ? 'bg-purple-400 dark:bg-purple-700 cursor-not-allowed opacity-60'
                      : 'bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 shadow-purple-500/20'
                  )}
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Sending...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      <span>Send {effectiveAmount} Coins</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
