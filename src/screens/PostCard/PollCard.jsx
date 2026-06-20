// src/screens/PostCard/PollCard.jsx
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { Sparkles, Coins, CheckCircle, AlertCircle, Clock } from 'lucide-react';

const cn = (...classes) => classes.filter(Boolean).join(' ');

// ------------------------------------------------------------------
// Helper: format time left (live updates)
// ------------------------------------------------------------------
function formatTimeLeft(closeDate) {
  if (!closeDate) return null;
  try {
    const diff = new Date(closeDate) - new Date();
    if (diff <= 0) return 'Closed';
    const days = Math.floor(diff / 86400000);
    const hours = Math.floor((diff % 86400000) / 3600000);
    const minutes = Math.floor((diff % 3600000) / 60000);
    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  } catch {
    return null;
  }
}

// ------------------------------------------------------------------
// Normalise poll options (supports strings or object array)
// ------------------------------------------------------------------
function normaliseOptions(rawOptions) {
  if (!rawOptions || !Array.isArray(rawOptions)) return [];
  return rawOptions.map((opt, idx) => {
    if (typeof opt === 'string') {
      return { id: `opt_${idx}`, text: opt, votes: 0 };
    }
    return {
      id: opt.id ?? `opt_${idx}`,
      text: opt.text ?? 'Option',
      votes: typeof opt.votes === 'number' ? opt.votes : 0,
    };
  });
}

// ------------------------------------------------------------------
// Normalise user vote (always returns array)
// ------------------------------------------------------------------
function normaliseUserVote(vote) {
  if (!vote) return null;
  if (Array.isArray(vote)) return vote;
  return [vote];
}

// ------------------------------------------------------------------
// Calculate percentages and identify leaders (safe)
// ------------------------------------------------------------------
function computeResults(options, totalVotes) {
  if (!options.length) return { results: [], leaderIds: [] };
  const safeTotal = totalVotes > 0 && isFinite(totalVotes) ? totalVotes : 0;
  const withPct = options.map(opt => ({
    ...opt,
    percentage: safeTotal > 0 ? Math.round((opt.votes / safeTotal) * 100) : 0,
  }));
  const maxVotes = Math.max(...withPct.map(o => o.votes), 0);
  const leaderIds = maxVotes > 0 ? withPct.filter(o => o.votes === maxVotes).map(o => o.id) : [];
  return { results: withPct, leaderIds };
}

// ------------------------------------------------------------------
// MAIN COMPONENT
// ------------------------------------------------------------------
const PollCard = React.memo(({
  poll,
  postId,
  currentUser,
  tokens,
  onVote,             // async (postId, optionId, idempotencyKey) => void
  onAnalytics,
  onReward,
  isPollClosed = false,
}) => {
  // ----- All hooks MUST be called before any conditional return -----
  const t = tokens || {};
  const normalisedOptions = useMemo(() => normaliseOptions(poll?.options), [poll?.options]);

  // Live countdown state
  const [now, setNow] = useState(Date.now());
  const [optimisticOptions, setOptimisticOptions] = useState(() =>
    normalisedOptions.map(opt => ({ ...opt }))
  );
  const [optimisticTotal, setOptimisticTotal] = useState(poll?.totalVotes ?? 0);
  const [optimisticUserVote, setOptimisticUserVote] = useState(normaliseUserVote(poll?.userVote));
  const [isVoting, setIsVoting] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  const pendingVoteRef = useRef(false);
  const voteVersionRef = useRef(0);
  const syncLockRef = useRef(false);
  const isMulti = poll?.allowMultiple === true;

  // Live countdown interval
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(interval);
  }, []);

  // Sync with backend updates (prevent overwrite during vote)
  useEffect(() => {
    if (!poll) return;
    if (syncLockRef.current) return;
    if (!isVoting && !pendingVoteRef.current) {
      setOptimisticOptions(normalisedOptions.map(opt => ({ ...opt })));
      setOptimisticTotal(poll.totalVotes ?? 0);
      setOptimisticUserVote(normaliseUserVote(poll.userVote));
      setErrorMsg(null);
    }
  }, [poll, normalisedOptions, isVoting]);

  // ----- Early returns after all hooks -----
  if (!poll) {
    return (
      <div className="px-4 py-3 rounded-2xl border border-red-500/30 bg-red-500/10 text-red-400 text-sm">
        ⚠️ Poll data unavailable
      </div>
    );
  }
  if (normalisedOptions.length === 0) {
    return (
      <div className="px-4 py-3 rounded-2xl border border-yellow-500/30 bg-yellow-500/10 text-yellow-400 text-sm">
        ⚠️ No options available
      </div>
    );
  }

  const { results, leaderIds } = useMemo(
    () => computeResults(optimisticOptions, optimisticTotal),
    [optimisticOptions, optimisticTotal]
  );

  // Find the option with the lowest votes for progress bar coloring
  const minVotes = results.length ? Math.min(...results.map(o => o.votes)) : 0;
  const lowVotesId = results.find(o => o.votes === minVotes)?.id;

  const timeLeft = useMemo(() => formatTimeLeft(poll.closesAt), [poll.closesAt, now]);
  const isClosed = isPollClosed || (poll.closesAt && new Date(poll.closesAt) <= new Date());
  const canVote = !isClosed && currentUser && !isVoting && !pendingVoteRef.current;
  const rewardAmount = poll.rewardCoins ?? 0;

  // ----- Voting handler (optimistic + rollback + versioning) -----
  const handleVote = useCallback(async (optionId) => {
    if (!currentUser) {
      toast.error('Sign in to vote');
      return;
    }
    if (!onVote) {
      toast.error('Voting not configured');
      return;
    }
    if (!canVote) {
      toast.error('Poll closed or already voted');
      return;
    }
    if (!isMulti && optimisticUserVote !== null && optimisticUserVote.length > 0) {
      toast.error('Already voted');
      return;
    }
    if (isVoting || pendingVoteRef.current) return;

    syncLockRef.current = true;
    pendingVoteRef.current = true;
    setIsVoting(true);
    setErrorMsg(null);

    const version = ++voteVersionRef.current;
    const idempotencyKey = `${currentUser.uid}_${postId}_${optionId}_${Date.now()}_${Math.random().toString(36).slice(2)}`;

    const prevOptions = optimisticOptions.map(opt => ({ ...opt }));
    const prevTotal = optimisticTotal;
    const prevUserVote = optimisticUserVote ? [...optimisticUserVote] : null;

    // Optimistic update
    let newOptions = [...optimisticOptions];
    let newTotal = optimisticTotal;
    let newUserVote = optimisticUserVote ? [...optimisticUserVote] : [];

    if (isMulti) {
      if (!newUserVote.includes(optionId)) {
        const idx = newOptions.findIndex(opt => opt.id === optionId);
        if (idx !== -1) {
          newOptions[idx] = { ...newOptions[idx], votes: newOptions[idx].votes + 1 };
          newTotal++;
          newUserVote.push(optionId);
        }
      }
    } else {
      // Single vote: remove old vote first
      if (newUserVote.length > 0) {
        const oldId = newUserVote[0];
        const oldIdx = newOptions.findIndex(opt => opt.id === oldId);
        if (oldIdx !== -1) {
          newOptions[oldIdx] = { ...newOptions[oldIdx], votes: Math.max(0, newOptions[oldIdx].votes - 1) };
          newTotal = Math.max(0, newTotal - 1);
        }
        newUserVote = [];
      }
      const newIdx = newOptions.findIndex(opt => opt.id === optionId);
      if (newIdx !== -1) {
        newOptions[newIdx] = { ...newOptions[newIdx], votes: newOptions[newIdx].votes + 1 };
        newTotal++;
        newUserVote = [optionId];
      }
    }

    setOptimisticOptions(newOptions);
    setOptimisticTotal(newTotal);
    setOptimisticUserVote(newUserVote);
    onAnalytics?.('poll_vote_optimistic', { postId, optionId, isMulti });

    try {
      await onVote(postId, optionId, idempotencyKey);
      if (version !== voteVersionRef.current) return; // stale response
      onAnalytics?.('poll_vote_success', { postId, optionId });
      if (rewardAmount > 0) {
        if (onReward) onReward(rewardAmount);
        toast.success(`+${rewardAmount} coins!`);
      } else {
        toast.success('Vote recorded');
      }
    } catch (err) {
      if (version !== voteVersionRef.current) return;
      setOptimisticOptions(prevOptions);
      setOptimisticTotal(prevTotal);
      setOptimisticUserVote(prevUserVote);
      const errorMessage = err.message || 'Vote failed, please try again';
      setErrorMsg(errorMessage);
      toast.error(errorMessage);
      onAnalytics?.('poll_vote_error', { postId, optionId, error: errorMessage });
    } finally {
      syncLockRef.current = false;
      pendingVoteRef.current = false;
      setIsVoting(false);
    }
  }, [currentUser, onVote, canVote, isMulti, optimisticOptions, optimisticTotal, optimisticUserVote,
      postId, onAnalytics, rewardAmount, onReward, isVoting]);

  // ----- Arvdoul purple glass styling (exactly like EventCard, reduced glow) -----
  const neonGradient = `linear-gradient(135deg, ${t.audioNeonPrimary || '#9333ea'}, ${t.audioNeonSecondary || '#c026d3'}, #ec4899)`;
  const buttonGlow = `0 0 4px rgba(236, 72, 153, 0.3)`; // reduced from 8px to 4px, lower opacity
  const cardShadow = t.shadowDirectional || '0 8px 20px -6px rgba(0,0,0,0.3), 0 4px 12px rgba(0,0,0,0.1)';
  const hoverShadow = '0 12px 28px -8px rgba(0,0,0,0.4), 0 4px 16px rgba(0,0,0,0.2)';
  const selectedGlow = '0 0 0 2px rgba(168,85,247,0.4), 0 0 12px rgba(168,85,247,0.2)';

  const hasVotes = optimisticTotal > 0;

  return (
    <div
      className="px-4 py-3 space-y-3 rounded-2xl border backdrop-blur-sm"
      style={{
        backgroundColor: t.cardBgAlt || 'rgba(0,0,0,0.3)',
        borderColor: t.border || 'rgba(255,255,255,0.1)',
        boxShadow: `${t.shadowAmbient || '0 1px 2px rgba(0,0,0,0.2)'}, ${cardShadow}`,
      }}
    >
      {/* Header */}
      <div className="flex justify-between items-start gap-2">
        <p className="font-semibold text-base" style={{ color: t.text || '#fff' }}>
          {poll.question}
        </p>
        {rewardAmount > 0 && canVote && (
          <span className="flex items-center gap-1 text-xs bg-yellow-500/20 text-yellow-400 px-2 py-1 rounded-full backdrop-blur-sm">
            <Coins className="w-3 h-3" /> +{rewardAmount}
          </span>
        )}
      </div>

      {/* Time left */}
      {timeLeft && (
        <div className="flex items-center gap-1 text-xs" style={{ color: t.textSecondary || '#aaa' }}>
          <Clock className="w-3 h-3" />
          <span>{timeLeft}</span>
          {isClosed && <span className="ml-2 text-red-400">(Closed)</span>}
        </div>
      )}

      {/* Options – each button uses neon gradient and reduced glow */}
      <div className="space-y-3">
        {results.map((opt) => {
          const isLeader = leaderIds.includes(opt.id);
          const isSelected = optimisticUserVote ? optimisticUserVote.includes(opt.id) : false;
          const percentage = hasVotes ? opt.percentage : 0;
          const isLocked = isVoting || pendingVoteRef.current;

          // Determine progress bar color (green for highest, red for lowest, orange otherwise)
          let progressColor = '#f59e0b'; // orange default
          if (hasVotes) {
            if (isLeader) progressColor = '#22c55e';      // green for leader
            else if (opt.id === lowVotesId) progressColor = '#ef4444'; // red for lowest
            else progressColor = '#f59e0b';
          }

          return (
            <motion.button
              key={opt.id}
              onClick={isLocked ? undefined : () => handleVote(opt.id)}
              disabled={!canVote || (isSelected && !isMulti)}
              className={cn(
                "w-full rounded-xl p-3 text-left transition-all relative overflow-hidden",
                !canVote && "opacity-70 cursor-not-allowed",
                isSelected && !isMulti && "ring-2 ring-pink-500 shadow-xl"
              )}
              style={{
                background: neonGradient,
                boxShadow: isSelected ? selectedGlow : buttonGlow,
                color: '#fff',
              }}
              whileTap={canVote ? { scale: 0.98, boxShadow: hoverShadow } : {}}
              whileHover={canVote ? { scale: 1.01, boxShadow: hoverShadow } : {}}
              aria-pressed={isSelected}
              aria-label={`Vote for ${opt.text}`}
            >
              <div className="flex justify-between items-center relative z-10">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold tracking-wide">{opt.text}</span>
                  {isLeader && <Sparkles className="w-4 h-4 text-yellow-300" />}
                </div>
                <div className="flex items-center gap-2 text-sm">
                  {hasVotes && <span className="font-bold" style={{ color: '#f0abfc' }}>{percentage}%</span>}
                  <span style={{ color: '#e9d5ff' }}>{(opt.votes ?? 0).toLocaleString()} votes</span>
                </div>
              </div>
              {hasVotes && (
                <div className="absolute inset-0 rounded-xl overflow-hidden pointer-events-none">
                  <motion.div
                    initial={false}
                    animate={{ width: `${percentage}%` }}
                    transition={{ type: 'spring', stiffness: 80, damping: 20 }}
                    className="h-full rounded-xl"
                    style={{ background: progressColor, opacity: 0.5 }}
                  />
                </div>
              )}
            </motion.button>
          );
        })}
      </div>

      {/* Footer */}
      <div className="flex flex-wrap justify-between items-center gap-2 pt-1">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium" style={{ color: t.textSecondary || '#aaa' }}>
            {optimisticTotal.toLocaleString()} total votes
          </span>
          {isMulti && optimisticUserVote && optimisticUserVote.length > 0 && (
            <span className="text-xs text-purple-300 flex items-center gap-1">
              <CheckCircle className="w-3 h-3" /> You voted
            </span>
          )}
        </div>
        {errorMsg && (
          <span className="text-xs text-red-400 flex items-center gap-1">
            <AlertCircle className="w-3 h-3" /> {errorMsg}
          </span>
        )}
      </div>

      {/* Dismiss error */}
      {errorMsg && (
        <button
          onClick={() => setErrorMsg(null)}
          className="text-xs text-purple-400 hover:underline"
        >
          Dismiss
        </button>
      )}
    </div>
  );
});

PollCard.displayName = 'PollCard';
export default PollCard;