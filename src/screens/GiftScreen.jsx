// src/screens/GiftScreen.jsx
//
// Sends coins to a user via the server-verified transferCoins Cloud Function
// (double-entry ledger + idempotency). Route: /gift/:userId

import { useState, useEffect } from "react";
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { useTheme } from '@context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { cn } from '../lib/utils';
import { pickDisplayName } from '../services/profileReadModel.js';
import { BRAND_GRADIENT } from '../design-system/tokens.js';
import { ArrowLeft, Coins, Loader2, Send } from 'lucide-react';

import { VIRTUAL_GIFTS as GIFTS } from '../data/videoData';
import { LazyImage } from '../components/Shared/LazyImage';

export default function GiftScreen() {
  const { userId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const [recipient, setRecipient] = useState(null);
  const [balance, setBalance] = useState(null);
  const [selected, setSelected] = useState(GIFTS[0]);
  const [sending, setSending] = useState(false);

  const colors = {
    bg: isDark ? 'bg-[#03071B] text-slate-100' : 'bg-[#F6F8FC] text-slate-900',
    card: isDark
      ? 'bg-white/[0.03] backdrop-blur-2xl border-white/[0.08]'
      : 'bg-white/95 backdrop-blur-xl border-slate-200/90 shadow-sm',
    text: isDark ? 'text-white' : 'text-slate-900',
    secondary: isDark ? 'text-slate-400' : 'text-slate-600',
  };

  useEffect(() => {
    (async () => {
      try {
        const { getUserService } = await import('../services/userService.js');
        const profile = await getUserService().getUserProfile(userId);
        if (profile) {
          setRecipient({
            id: userId,
            name: profile.displayName || profile.username,
            avatar: profile.photoURL,
          });
        }
        if (user?.uid) {
          const { getMonetizationService } = await import('../services/monetizationService.js');
          const bal = await getMonetizationService().getBalance(user.uid);
          setBalance(typeof bal === 'number' ? bal : null);
        }
      } catch (err) {
        toast.error('Could not load recipient.');
      }
    })();
  }, [userId, user?.uid]);

  const handleSend = async () => {
    if (!user?.uid || sending) return;
    if (!recipient) { toast.error('Recipient not found.'); return; }
    if (balance === null || balance < selected.coins) {
      toast.error('Not enough coins. Buy coins or watch ads to earn more.');
      navigate('/coins');
      return;
    }
    setSending(true);
    try {
      const { getMonetizationService } = await import('../services/monetizationService.js');
      const res = await getMonetizationService().transferCoins(
        user.uid, userId, selected.coins, 'gift',
        { giftType: selected.id, giftName: selected.name }
      );
      if (res?.success) {
        toast.success(`${selected.emoji} ${selected.name} sent to ${recipient.name}!`);
        setBalance((b) => Math.max(0, (b ?? 0) - selected.coins));
      } else {
        toast.error(res?.message || 'Gift could not be sent.');
      }
    } catch (err) {
      toast.error(err?.message || 'Gift could not be sent.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className={cn('min-h-screen pb-16 transition-colors', colors.bg)}>
      <div className={cn(
        'sticky top-0 z-30 border-b backdrop-blur-2xl',
        isDark ? 'bg-[#03071B]/90 border-white/[0.08]' : 'bg-[#F6F8FC]/90 border-slate-200/80'
      )}>
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate(-1)}
            aria-label="Back"
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-2xl hover:bg-slate-200/60 dark:hover:bg-white/[0.08] transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className={cn('font-bold text-base', colors.text)}>Send Gift</h1>
          <div className={cn('ml-auto flex items-center gap-1.5 text-sm font-semibold tabular-nums px-3 py-1.5 rounded-xl border', colors.card, colors.text)}>
            <Coins className="w-4 h-4 text-amber-500" aria-hidden="true" />
            <span>{balance ?? '…'}</span>
          </div>
        </div>
      </div>

      <main className="max-w-lg mx-auto px-4 py-6">
        {/* Recipient */}
        <div className={cn('rounded-3xl p-5 border flex items-center gap-4 mb-6', colors.card)}>
          {recipient?.avatar ? (
            <LazyImage src={recipient.avatar} alt={recipient?.name} className="w-14 h-14 rounded-full object-cover border border-white/10" />
          ) : (
            <div
              style={{ background: BRAND_GRADIENT }}
              className="w-14 h-14 rounded-full flex items-center justify-center text-white font-bold text-xl shadow-md shrink-0"
            >
              {(pickDisplayName([recipient?.name], { fallback: '?' })).charAt(0).toUpperCase()}
            </div>
          )}
          <div className="min-w-0">
            <p className={cn('font-semibold truncate', colors.text)}>{pickDisplayName([recipient?.name], { fallback: '—' })}</p>
            <p className={cn('text-sm', colors.secondary)}>Sending a gift of coins</p>
          </div>
        </div>

        {/* Gift picker */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          {GIFTS.map((g) => (
            <motion.button
              key={g.id}
              type="button"
              whileTap={{ scale: 0.95 }}
              onClick={() => setSelected(g)}
              className={cn(
                'min-h-[104px] rounded-2xl p-4 border transition-all cursor-pointer flex flex-col items-center justify-center',
                selected.id === g.id
                  ? 'border-indigo-500 bg-indigo-500/15 shadow-lg'
                  : colors.card
              )}
            >
              <div className="text-3xl mb-1">{g.emoji}</div>
              <p className={cn('text-sm font-semibold', colors.text)}>{g.name}</p>
              <p className="text-xs text-amber-500 font-semibold tabular-nums">{g.coins} coins</p>
            </motion.button>
          ))}
        </div>

        {/* Send */}
        <button
          type="button"
          onClick={handleSend}
          disabled={sending || !recipient}
          style={{ background: BRAND_GRADIENT }}
          className="min-h-[48px] w-full py-3.5 rounded-2xl font-bold text-white shadow-lg flex items-center justify-center gap-2 transition hover:brightness-110 disabled:opacity-50 cursor-pointer"
        >
          {sending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
          <span>{sending ? 'Sending…' : `Send ${selected.emoji} (${selected.coins} coins)`}</span>
        </button>
      </main>
    </div>
  );
}
