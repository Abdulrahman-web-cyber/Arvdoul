// src/screens/GiftScreen.jsx - ARVDOUL SEND GIFT (REAL)
// Sends coins to a user via the server-verified transferCoins Cloud Function
// (double-entry ledger + idempotency). Route: /gift/:userId
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { useTheme } from '@context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { getFirestoreInstance } from '../firebase/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { cn } from '../lib/utils';
import { ArrowLeft, Coins, Loader2, Send } from 'lucide-react';

const GIFTS = [
  { id: 'rose', emoji: '🌹', name: 'Rose', coins: 5 },
  { id: 'heart', emoji: '💖', name: 'Heart', coins: 10 },
  { id: 'star', emoji: '⭐', name: 'Star', coins: 25 },
  { id: 'crown', emoji: '👑', name: 'Crown', coins: 50 },
  { id: 'diamond', emoji: '💎', name: 'Diamond', coins: 100 },
  { id: 'rocket', emoji: '🚀', name: 'Rocket', coins: 500 },
];

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
    bg: isDark ? 'bg-gradient-to-br from-[#060816] via-[#0b1220] to-[#02040a]' : 'bg-gradient-to-br from-[#f0f4fa] via-white to-[#eef2f8]',
    card: isDark ? 'bg-gray-900/70 border-gray-800' : 'bg-white/90 border-gray-200',
    text: isDark ? 'text-white' : 'text-gray-900',
    secondary: isDark ? 'text-gray-400' : 'text-gray-600',
  };

  useEffect(() => {
    (async () => {
      try {
        const firestore = await getFirestoreInstance();
        const snap = await getDoc(doc(firestore, 'users', userId));
        if (snap.exists()) {
          const d = snap.data();
          setRecipient({ id: userId, name: d.displayName || d.username, avatar: d.photoURL });
        }
        if (user?.uid) {
          const { getMonetizationService } = await import('../services/monetizationService.js');
          const bal = await getMonetizationService().getBalance(user.uid);
          setBalance(typeof bal === 'number' ? bal : Number(bal?.coins ?? 0));
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
    <div className={cn('min-h-screen pb-16', colors.bg)}>
      <div className={cn('sticky top-0 z-30 border-b backdrop-blur-xl', colors.card, 'border')}>
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center gap-3">
          <button onClick={() => navigate(-1)} aria-label="Back" className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className={cn('font-bold', colors.text)}>Send Gift</h1>
          <div className={cn('ml-auto flex items-center gap-1 text-sm font-semibold', colors.text)}>
            <Coins className="w-4 h-4 text-amber-500" /> {balance ?? '…'}
          </div>
        </div>
      </div>

      <main className="max-w-lg mx-auto px-4 py-6">
        {/* Recipient */}
        <div className={cn('rounded-2xl p-5 border flex items-center gap-4 mb-6', colors.card)}>
          {recipient?.avatar ? (
            <img src={recipient.avatar} alt={recipient?.name} className="w-14 h-14 rounded-full object-cover" />
          ) : (
            <div className="w-14 h-14 rounded-full bg-gradient-to-br from-violet-500 to-cyan-500 flex items-center justify-center text-white font-bold text-xl">
              {(recipient?.name || 'U').charAt(0).toUpperCase()}
            </div>
          )}
          <div>
            <p className={cn('font-semibold', colors.text)}>{recipient?.name || 'User'}</p>
            <p className={cn('text-sm', colors.secondary)}>Sending a gift of coins</p>
          </div>
        </div>

        {/* Gift picker */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          {GIFTS.map((g) => (
            <motion.button
              key={g.id}
              whileTap={{ scale: 0.95 }}
              onClick={() => setSelected(g)}
              className={cn(
                'rounded-2xl p-4 border transition-all',
                selected.id === g.id
                  ? 'border-violet-500 bg-violet-500/10 shadow-lg'
                  : colors.card
              )}
            >
              <div className="text-3xl mb-1">{g.emoji}</div>
              <p className={cn('text-sm font-semibold', colors.text)}>{g.name}</p>
              <p className="text-xs text-amber-500 font-semibold">{g.coins} 🪙</p>
            </motion.button>
          ))}
        </div>

        {/* Send */}
        <button
          onClick={handleSend}
          disabled={sending || !recipient}
          className={cn(
            'w-full py-3.5 rounded-xl font-bold flex items-center justify-center gap-2 transition disabled:opacity-50',
            'bg-gradient-to-r from-violet-500 to-cyan-500 text-white'
          )}
        >
          {sending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
          {sending ? 'Sending…' : `Send ${selected.emoji} (${selected.coins} coins)`}
        </button>
      </main>
    </div>
  );
}
