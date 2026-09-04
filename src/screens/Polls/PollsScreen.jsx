// src/screens/Polls/PollsScreen.jsx
// 📊 ARVDOUL POLLS & PREDICTION MARKETS
// Real-time community voting, coin prediction wagers, percentage animations, and creator opinion analytics

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  BarChart3, 
  Coins, 
  Check, 
  TrendingUp, 
  Plus, 
  X, 
  Vote, 
  Flame, 
  Clock, 
  Sparkles, 
  Users, 
  Award 
} from 'lucide-react';
import { toast } from 'sonner';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { useAppStore } from '../../store/appStore';
import pollService from '../../services/pollService';
import LoadingSpinner from '../../components/Shared/LoadingSpinner';

const CATEGORIES = ['All', 'Tech & Trends', 'Gear & Studio', 'Creator Economy'];

/** Honest countdown label derived from the poll's real endsAt timestamp.
 *  Returns '' when the poll has no endsAt (data unavailable) — never invents
 *  a duration. */
function formatEndsIn(endsAt) {
  if (!endsAt) return '';
  const end = new Date(endsAt).getTime();
  if (Number.isNaN(end)) return '';
  const diffMs = end - Date.now();
  if (diffMs <= 0) return 'Ended';
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 60) return `${diffMins}m left`;
  const diffHrs = Math.floor(diffMins / 60);
  if (diffHrs < 24) return `${diffHrs}h left`;
  return `${Math.floor(diffHrs / 24)}d left`;
}

export default function PollsScreen() {
  const navigate = useNavigate();
  const { theme } = useTheme();
  const { user } = useAuth();
  const { currentUser, setAppState } = useAppStore();
  const isDark = theme === 'dark';

  const [polls, setPolls] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [loading, setLoading] = useState(true);
  const [wagerModalPoll, setWagerModalPoll] = useState(null);
  const [selectedOptionId, setSelectedOptionId] = useState(null);
  const [wagerCoins, setWagerCoins] = useState(250);

  // Create Poll modal
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newQuestion, setNewQuestion] = useState('');
  const [newCategory, setNewCategory] = useState('Tech & Trends');
  const [optionsList, setOptionsList] = useState(['', '']);
  const [isPrediction, setIsPrediction] = useState(false);

  useEffect(() => {
    loadPolls();
  }, [selectedCategory]);

  const loadPolls = async () => {
    setLoading(true);
    try {
      const data = await pollService.getPolls(selectedCategory);
      setPolls(data);
    } catch {
      toast.error('Failed to load polls');
    } finally {
      setLoading(false);
    }
  };

  const handleVoteDirect = async (poll, optionId) => {
    if (poll.hasVoted) return;

    if (poll.isPredictionMarket) {
      setWagerModalPoll(poll);
      setSelectedOptionId(optionId);
      return;
    }

    try {
      const updated = await pollService.votePoll(poll.id, optionId, 0, 0, user);
      setPolls(polls.map(p => p.id === poll.id ? { ...updated } : p));
      toast.success('Your vote has been recorded! 🗳️');
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleConfirmWager = async () => {
    if (!wagerModalPoll || !selectedOptionId) return;
    // REAL balance from the ledger — never a fabricated default.
    let currentCoins = null;
    try {
      const { getMonetizationService } = await import('../../services/monetizationService.js');
      const bal = await getMonetizationService().getBalance(user?.uid);
      currentCoins = typeof bal === 'number' ? bal : null;
    } catch { /* balance fetch failed — service still validates server-side */ }
    if (currentCoins != null && currentCoins < wagerCoins) {
      toast.error(`Insufficient coins. You have ${currentCoins} coins.`);
      return;
    }

    try {
      const updated = await pollService.votePoll(wagerModalPoll.id, selectedOptionId, currentCoins || 0, wagerCoins, user);
      if (currentUser) {
        setAppState({
          currentUser: {
            ...currentUser,
            coins: currentCoins - wagerCoins
          }
        });
      }
      setPolls(polls.map(p => p.id === wagerModalPoll.id ? { ...updated } : p));
      setWagerModalPoll(null);
      toast.success(`Wagered ${wagerCoins} Coins on prediction! 🪙🎯 If correct, payout will trigger upon close.`);
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleCreatePollSubmit = async (e) => {
    e.preventDefault();
    const cleanOptions = optionsList.filter(o => o.trim().length > 0);
    if (!newQuestion.trim() || cleanOptions.length < 2) {
      toast.error('Please enter a question and at least 2 options.');
      return;
    }

    try {
      const created = await pollService.createPoll({
        question: newQuestion,
        category: newCategory,
        options: cleanOptions,
        isPredictionMarket: isPrediction,
        creator: user
      });
      setPolls([created, ...polls]);
      setIsCreateOpen(false);
      setNewQuestion('');
      setOptionsList(['', '']);
      toast.success('Your interactive poll is now live! 📊');
    } catch {
      toast.error('Failed to create poll');
    }
  };

  return (
    <div className="min-h-screen pb-32 pt-2 max-w-5xl mx-auto px-3 sm:px-6">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-3xl p-6 sm:p-8 bg-gradient-to-r from-blue-900/80 via-indigo-900/80 to-purple-900/80 border border-blue-500/30 shadow-2xl backdrop-blur-xl mb-8">
        <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Sparkles className="w-4 h-4 text-blue-400" />
              <span className="text-xs font-bold text-blue-300 uppercase tracking-wider">Community Voice & Insights</span>
            </div>
            <h1 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight flex items-center gap-3">
              Polls & Prediction Markets <Vote className="w-7 h-7 text-blue-400" />
            </h1>
            <p className="text-gray-300 text-xs sm:text-sm mt-1 max-w-xl">
              Vote on trending topics, wager coins in prediction markets, and discover audience consensus across the creator economy.
            </p>
          </div>

          <button
            onClick={() => setIsCreateOpen(true)}
            className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold text-sm shadow-xl shadow-blue-500/25 hover:scale-105 transition-all whitespace-nowrap"
          >
            <Plus className="w-4 h-4" /> Create a Poll
          </button>
        </div>
      </div>

      {/* Category Pills */}
      <div className="flex items-center gap-2 overflow-x-auto pb-3 mb-6 scrollbar-none">
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={`px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
              selectedCategory === cat
                ? 'bg-blue-600 text-white shadow-md shadow-blue-500/30'
                : isDark ? 'bg-gray-800/80 text-gray-400 hover:text-white' : 'bg-white text-gray-700 shadow-sm'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Poll Cards List */}
      {loading ? (
        <div className="space-y-6">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className={`p-6 sm:p-7 rounded-3xl border animate-pulse ${
                isDark ? 'bg-gray-900/40 border-gray-800/60' : 'bg-white/60 border-gray-200/60'
              }`}
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-gray-300 dark:bg-white/10" />
                <div className="space-y-1.5 flex-1">
                  <div className="w-28 h-3.5 rounded-lg bg-gray-300 dark:bg-white/10" />
                  <div className="w-16 h-2.5 rounded-lg bg-gray-300 dark:bg-white/5" />
                </div>
              </div>
              <div className="w-3/4 h-5 rounded-lg bg-gray-300 dark:bg-white/10 mb-4" />
              <div className="space-y-2.5">
                <div className="h-11 rounded-2xl bg-gray-200 dark:bg-white/5" />
                <div className="h-11 rounded-2xl bg-gray-200 dark:bg-white/5" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-6">
          {polls.map((poll) => {
            const hasVoted = Boolean(poll.hasVoted);

            return (
              <div
                key={poll.id}
                className={`p-6 sm:p-7 rounded-3xl border transition-all duration-200 ${
                  isDark ? 'bg-gray-900/80 border-gray-800' : 'bg-white border-gray-200 shadow-md'
                }`}
              >
                {/* Poll Header */}
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div className="flex items-center gap-3">
                    {poll.creator?.avatar ? (
                      <img src={poll.creator.avatar} alt="" className="w-9 h-9 rounded-full object-cover" />
                    ) : (
                      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-purple-600/60 to-blue-600/60 flex items-center justify-center text-sm font-bold text-white shrink-0">
                        {(poll.creator?.name || '?').charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div>
                      <span className="text-xs font-bold text-white block">{poll.creator?.name || 'Anonymous'}</span>
                      <span className="text-[11px] text-gray-400">{poll.creator?.username ? `${poll.creator.username} • ` : ''}{poll.category}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {poll.isPredictionMarket && (
                      <span className="px-3 py-1 bg-yellow-500/20 text-yellow-300 rounded-full text-xs font-extrabold flex items-center gap-1 border border-yellow-500/30">
                        <Coins className="w-3.5 h-3.5" /> Pool: {poll.poolCoins.toLocaleString()} Coins
                      </span>
                    )}
                    <span className="text-xs text-gray-400 flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" /> {formatEndsIn(poll.endsAt)}
                    </span>
                  </div>
                </div>

                <h3 className="text-base sm:text-lg font-extrabold text-white mb-5">{poll.question}</h3>

                {/* Options Bars */}
                <div className="space-y-3">
                  {poll.options.map((opt) => {
                    const isSelected = poll.hasVoted === opt.id;

                    return (
                      <div
                        key={opt.id}
                        onClick={() => handleVoteDirect(poll, opt.id)}
                        className={`relative overflow-hidden p-4 rounded-2xl border cursor-pointer transition-all ${
                          isSelected
                            ? 'border-blue-500 bg-blue-500/10 shadow-lg'
                            : isDark ? 'border-gray-800 bg-gray-800/40 hover:border-gray-700' : 'border-gray-200 bg-gray-50'
                        }`}
                      >
                        {/* Fill Percentage Bar */}
                        {hasVoted && (
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${opt.percentage}%` }}
                            transition={{ duration: 0.6, ease: 'easeOut' }}
                            className={`absolute inset-y-0 left-0 ${
                              isSelected ? 'bg-blue-600/30' : 'bg-gray-700/30'
                            }`}
                          />
                        )}

                        <div className="relative z-10 flex items-center justify-between gap-3 text-xs sm:text-sm font-bold text-white">
                          <div className="flex items-center gap-2">
                            {isSelected && <Check className="w-4 h-4 text-blue-400" />}
                            <span>{opt.text}</span>
                          </div>

                          {hasVoted ? (
                            <span className="font-extrabold text-blue-400">{opt.percentage}% ({opt.votes.toLocaleString()})</span>
                          ) : (
                            <span className="text-gray-400 text-xs font-semibold">Tap to Vote →</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Footer metadata */}
                <div className="flex items-center justify-between pt-4 mt-4 border-t border-gray-800 text-xs text-gray-400">
                  <span className="flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-blue-400" /> {poll.totalVotes.toLocaleString()} Total Votes
                  </span>
                  {poll.isPredictionMarket && (
                    <span className="text-yellow-400 font-semibold flex items-center gap-1">
                      <Award className="w-3.5 h-3.5" /> Prediction Market Active
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ==================== PREDICTION WAGER MODAL ==================== */}
      <AnimatePresence>
        {wagerModalPoll && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md"
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              className={`w-full max-w-md p-6 sm:p-7 rounded-3xl border ${
                isDark ? 'bg-gray-900 border-gray-800' : 'bg-white'
              } shadow-2xl space-y-5`}
            >
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Coins className="w-5 h-5 text-yellow-400" /> Place Prediction Wager
                </h3>
                <button onClick={() => setWagerModalPoll(null)} className="text-gray-400 hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-4 rounded-2xl bg-blue-500/10 border border-blue-500/30">
                <span className="text-[11px] font-bold text-blue-400 uppercase tracking-wider block mb-1">Your Prediction</span>
                <p className="text-sm font-bold text-white">
                  {wagerModalPoll.options.find(o => o.id === selectedOptionId)?.text}
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Coins to Wager</label>
                <div className="grid grid-cols-4 gap-2">
                  {[100, 250, 500, 1000].map((amt) => (
                    <button
                      key={amt}
                      onClick={() => setWagerCoins(amt)}
                      className={`py-2.5 rounded-xl text-xs font-bold border transition-all ${
                        wagerCoins === amt
                          ? 'border-yellow-400 bg-yellow-400/20 text-yellow-300'
                          : isDark ? 'border-gray-800 bg-gray-800 text-gray-400' : 'border-gray-200'
                      }`}
                    >
                      🪙 {amt}
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={handleConfirmWager}
                className="w-full py-4 rounded-2xl font-bold bg-gradient-to-r from-yellow-500 to-amber-600 text-black shadow-xl shadow-yellow-500/20 flex items-center justify-center gap-2 hover:opacity-95"
              >
                Confirm Wager ({wagerCoins} Coins)
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ==================== CREATE POLL MODAL ==================== */}
      <AnimatePresence>
        {isCreateOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              className={`w-full max-w-md p-6 rounded-3xl border ${isDark ? 'bg-gray-900 border-gray-800' : 'bg-white'} shadow-2xl space-y-4`}
            >
              <div className="flex items-center justify-between pb-3 border-b border-gray-800">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Vote className="w-5 h-5 text-blue-400" /> Create Community Poll
                </h3>
                <button onClick={() => setIsCreateOpen(false)} className="text-gray-400 hover:text-white">
                  ✕
                </button>
              </div>

              <form onSubmit={handleCreatePollSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Poll Question</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Which camera sensor is best for 2026?"
                    value={newQuestion}
                    onChange={(e) => setNewQuestion(e.target.value)}
                    className={`w-full p-3.5 rounded-xl text-sm border focus:ring-2 focus:ring-blue-500 outline-none ${
                      isDark ? 'bg-gray-800 border-gray-700 text-white' : 'bg-gray-50'
                    }`}
                  />
                </div>

                <div className="space-y-2">
                  <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider">Options</label>
                  {optionsList.map((opt, idx) => (
                    <input
                      key={idx}
                      type="text"
                      placeholder={`Option ${idx + 1}`}
                      value={opt}
                      onChange={(e) => {
                        const copy = [...optionsList];
                        copy[idx] = e.target.value;
                        setOptionsList(copy);
                      }}
                      className={`w-full p-3 rounded-xl text-xs border ${
                        isDark ? 'bg-gray-800 border-gray-700 text-white' : 'bg-gray-50'
                      }`}
                    />
                  ))}
                  {optionsList.length < 4 && (
                    <button
                      type="button"
                      onClick={() => setOptionsList([...optionsList, ''])}
                      className="text-xs text-blue-400 font-semibold hover:underline flex items-center gap-1"
                    >
                      + Add Option
                    </button>
                  )}
                </div>

                <div className="flex items-center justify-between p-3 rounded-xl bg-gray-800/40 border border-gray-700/60">
                  <div>
                    <span className="text-xs font-bold text-white block">Enable Prediction Market</span>
                    <span className="text-[10px] text-gray-400">Allow users to wager coins on the outcome</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={isPrediction}
                    onChange={(e) => setIsPrediction(e.target.checked)}
                    className="w-4 h-4 accent-blue-500"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-4 rounded-2xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-xl shadow-blue-500/25 hover:opacity-95"
                >
                  🚀 Publish Poll
                </button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
