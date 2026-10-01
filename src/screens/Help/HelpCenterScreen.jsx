// src/screens/Help/HelpCenterScreen.jsx - ARVDOUL HELP CENTER & SUPPORT
// Real, working support entry point (route: /help). Users search a FAQ, read
// community guidelines, and file a support ticket that is persisted to
// `support_tickets` (owner-readable per firestore.rules) and triaged by
// supportAutomationService. Admins answer from /admin/tickets.

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import {
  ArrowLeft, HelpCircle, Search, ChevronDown, Send, LifeBuoy,
  Loader2, MessageCircle, BookOpen, Shield, Coins,
} from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { getFirestoreInstance } from '../../firebase/firebase';
import {
  collection, query, where, orderBy, limit, getDocs, addDoc, serverTimestamp,
} from 'firebase/firestore';
import { supportAutomationService } from '../../services/supportAutomationService.js';

// FAQ content mirrors the automation knowledge base so an auto-resolved
// answer is exactly what the user can read here.
const FAQ_SECTIONS = [
  {
    title: 'Coins & Wallet',
    icon: Coins,
    items: [
      {
        q: 'Where are my coins?',
        a: 'Coin balances refresh automatically after network confirmation. If your balance does not update within 2 minutes, open Wallet > Refresh Balance, then contact billing support if it is still missing.',
      },
      {
        q: 'How do I earn coins?',
        a: 'You earn coins from engagement rewards (posts, likes, level-ups), by watching rewarded ads, and by receiving gifts from other citizens.',
      },
      {
        q: 'How do withdrawals work?',
        a: 'Withdrawals unlock from level 10 and are reviewed before payout. Track the status of a request from the Creator Payout screen.',
      },
    ],
  },
  {
    title: 'Account & Security',
    icon: Shield,
    items: [
      {
        q: 'How do I reset my password?',
        a: 'Visit the Login screen and choose "Forgot Password", or sign in with your registered passkey. A reset link is sent to your verified email.',
      },
      {
        q: 'How do I turn on two-factor authentication?',
        a: 'Open Settings > Security and enable 2FA. Keep your recovery codes somewhere safe — they are the only way back in if you lose your device.',
      },
      {
        q: 'Someone reported my account. What happens now?',
        a: 'Reports are reviewed by the moderation team. If action is taken you will receive an in-app notice with the reason and the appeal window.',
      },
    ],
  },
  {
    title: 'Creator & Verification',
    icon: LifeBuoy,
    items: [
      {
        q: 'How do I get verified?',
        a: 'Creator verification requires a verified phone and email, at least 1,000 followers, and no community strikes in the last 90 days. Apply from Settings > Creator Verification.',
      },
      {
        q: 'How do I send a gift to a creator?',
        a: 'Open the creator’s post or reel and tap the gift button, or visit their profile and choose Send Gift. Gifts are transferred instantly from your coin balance.',
      },
      {
        q: 'Why was my post removed?',
        a: 'Posts are removed when they break the community guidelines. You will see the reason in your notifications and can appeal from the moderation notice.',
      },
    ],
  },
];

export default function HelpCenterScreen() {
  const navigate = useNavigate();
  const { isDark } = useTheme();
  const { user } = useAuth();

  const [search, setSearch] = useState('');
  const [openIndex, setOpenIndex] = useState(null);
  const [tickets, setTickets] = useState([]);
  const [ticketsLoading, setTicketsLoading] = useState(false);
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadTickets = useCallback(async () => {
    if (!user?.uid) return;
    setTicketsLoading(true);
    try {
      const firestore = await getFirestoreInstance();
      const q = query(
        collection(firestore, 'support_tickets'),
        where('userId', '==', user.uid),
        orderBy('createdAt', 'desc'),
        limit(10)
      );
      const snap = await getDocs(q);
      setTickets(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch {
      // Index/offline failures should not block filing a new ticket.
      setTickets([]);
    } finally {
      setTicketsLoading(false);
    }
  }, [user?.uid]);

  useEffect(() => { loadTickets(); }, [loadTickets]);

  const q = search.trim().toLowerCase();
  const filteredSections = q
    ? FAQ_SECTIONS.map((section) => ({
        ...section,
        items: section.items.filter(
          (item) => item.q.toLowerCase().includes(q) || item.a.toLowerCase().includes(q)
        ),
      })).filter((section) => section.items.length > 0)
    : FAQ_SECTIONS;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!user?.uid) {
      toast.error('Sign in to contact support');
      return;
    }
    const trimmedSubject = subject.trim();
    const trimmedMessage = message.trim();
    if (trimmedSubject.length < 3) {
      toast.error('Please add a short subject');
      return;
    }
    if (trimmedMessage.length < 10) {
      toast.error('Please describe the issue in a little more detail');
      return;
    }
    if (submitting) return;
    setSubmitting(true);
    try {
      const triage = supportAutomationService.triageSupportTicket(`${trimmedSubject} ${trimmedMessage}`);
      const firestore = await getFirestoreInstance();
      const createdAt = new Date().toISOString();
      const ref = await addDoc(collection(firestore, 'support_tickets'), {
        userId: user.uid,
        subject: trimmedSubject,
        category: triage.category,
        status: 'open',
        messages: [{ sender: 'user', text: trimmedMessage, timestamp: createdAt }],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setTickets((prev) => [
        { id: ref.id, subject: trimmedSubject, category: triage.category, status: 'open',
          messages: [{ sender: 'user', text: trimmedMessage, timestamp: createdAt }] },
        ...prev,
      ]);
      setSubject('');
      setMessage('');
      if (triage.autoResolved) {
        toast.success('Thanks! A matching answer is in the FAQ above — a specialist can still follow up.');
      } else {
        toast.success('Ticket filed. Our Trust & Support team will reply in-app.');
      }
    } catch (err) {
      toast.error(err?.message || 'Could not file the ticket. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const card = isDark ? 'bg-gray-900/70 border-gray-800' : 'bg-white/90 border-gray-200';
  const text = isDark ? 'text-white' : 'text-gray-900';
  const muted = isDark ? 'text-gray-400' : 'text-gray-600';

  return (
    <div className={`min-h-screen pb-20 ${isDark ? 'bg-[#060816]' : 'bg-gradient-to-b from-slate-50 to-white'}`}>
      <header className={`sticky top-0 z-30 border-b backdrop-blur-xl ${card}`}>
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <button onClick={() => navigate(-1)} aria-label="Back" className={`p-2 rounded-full ${isDark ? 'hover:bg-gray-800' : 'hover:bg-gray-100'}`}>
            <ArrowLeft className={`w-5 h-5 ${text}`} />
          </button>
          <h1 className={`font-bold text-lg ${text}`}>Help Center &amp; Support</h1>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        <div className={`rounded-2xl border p-4 flex items-center gap-3 ${card}`}>
          <Search className={`w-5 h-5 ${muted}`} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search help articles…"
            aria-label="Search help articles"
            className={`flex-1 bg-transparent outline-none text-sm ${text} placeholder:text-gray-500`}
          />
        </div>

        {filteredSections.length === 0 ? (
          <p className={`text-sm ${muted}`}>No FAQ matches “{search}”. You can still file a ticket below.</p>
        ) : (
          filteredSections.map((section) => (
            <section key={section.title} className={`rounded-2xl border overflow-hidden ${card}`}>
              <div className={`px-4 py-3 flex items-center gap-2 border-b ${isDark ? 'border-gray-800' : 'border-gray-100'}`}>
                <section.icon className="w-4 h-4 text-violet-500" />
                <h2 className={`font-semibold text-sm ${text}`}>{section.title}</h2>
              </div>
              {section.items.map((item) => {
                const key = `${section.title}:${item.q}`;
                const isOpen = openIndex === key;
                return (
                  <div key={key} className={`border-b last:border-b-0 ${isDark ? 'border-gray-800' : 'border-gray-100'}`}>
                    <button
                      onClick={() => setOpenIndex(isOpen ? null : key)}
                      aria-expanded={isOpen}
                      className="w-full px-4 py-3 flex items-center justify-between gap-3 text-left"
                    >
                      <span className={`text-sm font-medium ${text}`}>{item.q}</span>
                      <ChevronDown className={`w-4 h-4 shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''} ${muted}`} />
                    </button>
                    <AnimatePresence initial={false}>
                      {isOpen && (
                        <motion.p
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className={`px-4 pb-3 text-sm leading-relaxed overflow-hidden ${muted}`}
                        >
                          {item.a}
                        </motion.p>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
            </section>
          ))
        )}

        <Link to="/community" className="flex items-center gap-2 text-sm text-violet-500 hover:underline">
          <BookOpen className="w-4 h-4" /> Read the community guidelines
        </Link>

        <section className={`rounded-2xl border p-5 ${card}`}>
          <div className="flex items-center gap-2 mb-4">
            <MessageCircle className="w-4 h-4 text-violet-500" />
            <h2 className={`font-semibold ${text}`}>Contact support</h2>
          </div>
          <form onSubmit={handleSubmit} className="space-y-3">
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Subject"
              aria-label="Ticket subject"
              maxLength={120}
              className={`w-full rounded-xl border px-3 py-2.5 text-sm outline-none focus:border-violet-500 ${isDark ? 'bg-black/30 border-gray-700' : 'bg-white border-gray-300'} ${text}`}
            />
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Describe the issue — what happened, and what you expected."
              aria-label="Ticket message"
              rows={4}
              maxLength={4000}
              className={`w-full rounded-xl border px-3 py-2.5 text-sm outline-none focus:border-violet-500 resize-none ${isDark ? 'bg-black/30 border-gray-700' : 'bg-white border-gray-300'} ${text}`}
            />
            <button
              type="submit"
              disabled={submitting || !user?.uid}
              className="w-full rounded-xl py-3 text-sm font-bold bg-gradient-to-r from-violet-600 to-fuchsia-500 text-white hover:opacity-95 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {submitting ? <><Loader2 className="w-4 h-4 animate-spin" /> Filing…</> : <><Send className="w-4 h-4" /> File ticket</>}
            </button>
            {!user?.uid && (
              <p className={`text-xs ${muted}`}>
                <Link to="/login" className="text-violet-500 hover:underline">Sign in</Link> to file a ticket.
              </p>
            )}
          </form>
        </section>

        <section className={`rounded-2xl border p-5 ${card}`}>
          <div className="flex items-center gap-2 mb-4">
            <HelpCircle className="w-4 h-4 text-violet-500" />
            <h2 className={`font-semibold ${text}`}>Your tickets</h2>
          </div>
          {ticketsLoading ? (
            <p className={`text-sm ${muted} flex items-center gap-2`}><Loader2 className="w-4 h-4 animate-spin" /> Loading…</p>
          ) : tickets.length === 0 ? (
            <p className={`text-sm ${muted}`}>You have not filed any tickets yet.</p>
          ) : (
            <ul className="space-y-3">
              {tickets.map((ticket) => (
                <li key={ticket.id} className={`rounded-xl border p-3 ${isDark ? 'border-gray-800 bg-black/20' : 'border-gray-200 bg-gray-50'}`}>
                  <div className="flex items-center justify-between gap-2">
                    <span className={`text-sm font-medium ${text}`}>{ticket.subject}</span>
                    <span className={`text-[11px] font-bold uppercase tracking-wide ${
                      ticket.status === 'resolved' ? 'text-emerald-500'
                        : ticket.status === 'in_progress' ? 'text-amber-500' : 'text-violet-500'
                    }`}>
                      {String(ticket.status || 'open').replace('_', ' ')}
                    </span>
                  </div>
                  {ticket.messages?.[0]?.text && (
                    <p className={`text-xs mt-1 line-clamp-2 ${muted}`}>{ticket.messages[0].text}</p>
                  )}
                  {ticket.messages?.some((m) => m.sender === 'agent') && (
                    <p className="text-xs mt-2 text-emerald-500">Support replied — see the latest message above.</p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}
