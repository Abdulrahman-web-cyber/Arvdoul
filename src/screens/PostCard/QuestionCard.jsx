// src/screens/PostCard/QuestionCard.jsx
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import {
  HelpCircle, Star, Award, ThumbsUp, ThumbsDown,
  Flag, Edit3, Trash2, Clock, Coins,
  Send, MessageCircle, X, Save, ChevronDown, ChevronUp,
  Lock, Sparkles, CheckCircle, Eye, EyeOff
} from 'lucide-react';

const cn = (...classes) => classes.filter(Boolean).join(' ');

// ------------------------------------------------------------------
// Helper: format relative time
// ------------------------------------------------------------------
function formatRelativeTime(date) {
  if (!date) return '';
  const now = new Date();
  const diff = now - new Date(date);
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

// ------------------------------------------------------------------
// Helper: get reputation level badge
// ------------------------------------------------------------------
function getReputationLevel(reputation) {
  if (reputation >= 5000) return { label: 'Legend', color: '#fbbf24' };
  if (reputation >= 1000) return { label: 'Master', color: '#a855f7' };
  if (reputation >= 500) return { label: 'Expert', color: '#22c55e' };
  if (reputation >= 100) return { label: 'Skilled', color: '#3b82f6' };
  return null;
}

// ------------------------------------------------------------------
// Vote delta calculator (prevents desync)
// ------------------------------------------------------------------
function getVoteDelta(previousVote, newVote) {
  if (previousVote === newVote) return 0;
  if (!previousVote && newVote === 'up') return 1;
  if (!previousVote && newVote === 'down') return -1;
  if (previousVote === 'up' && !newVote) return -1;
  if (previousVote === 'down' && !newVote) return 1;
  if (previousVote === 'up' && newVote === 'down') return -2;
  if (previousVote === 'down' && newVote === 'up') return 2;
  return 0;
}

// ------------------------------------------------------------------
// Expandable text component (resets expansion when text changes)
// ------------------------------------------------------------------
const ExpandableText = React.memo(({ text, maxLength = 200, tokens }) => {
  const [expanded, setExpanded] = useState(false);
  const safeText = text || '';

  // Reset expansion when text changes (important for answer edits)
  useEffect(() => {
    setExpanded(false);
  }, [safeText]);

  if (safeText.length <= maxLength) {
    return <span className="text-sm whitespace-pre-wrap break-words" style={{ color: tokens.textSecondary }}>{safeText}</span>;
  }
  const displayText = expanded ? safeText : safeText.slice(0, maxLength) + '…';
  return (
    <div>
      <span className="text-sm whitespace-pre-wrap break-words" style={{ color: tokens.textSecondary }}>{displayText}</span>
      <button
        onClick={() => setExpanded(!expanded)}
        className="text-xs text-purple-400 hover:underline ml-1 flex items-center gap-0.5"
      >
        {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        {expanded ? 'Show less' : 'Show more'}
      </button>
    </div>
  );
});

// ------------------------------------------------------------------
// Single answer component (memoized with full content comparison)
// ------------------------------------------------------------------
const AnswerItem = React.memo(({
  answer,
  isAuthor,
  currentUserId,
  isBest,
  onVote,
  onMarkBest,
  onEdit,
  onDelete,
  onReport,
  tokens,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(answer.answer || '');
  const [userVote, setUserVote] = useState(answer.userVote || null);
  const [optimisticUpvotes, setOptimisticUpvotes] = useState(answer.upvotes || 0);
  const isAnswerAuthor = answer.userId === currentUserId;
  const canMarkBest = isAuthor && !isBest && !answer.isBest;
  const voteLock = useRef(false);

  const handleVote = async (direction) => {
    if (voteLock.current) return;
    voteLock.current = true;
    const newVote = userVote === direction ? null : direction;
    const delta = getVoteDelta(userVote, newVote);
    setUserVote(newVote);
    setOptimisticUpvotes(prev => prev + delta);
    try {
      await onVote(answer.id, newVote);
    } catch (err) {
      setUserVote(userVote);
      setOptimisticUpvotes(answer.upvotes || 0);
      toast.error('Vote failed');
    } finally {
      voteLock.current = false;
    }
  };

  const handleEdit = async () => {
    if (!editContent.trim()) return;
    try {
      await onEdit(answer.id, editContent.trim());
      setIsEditing(false);
      toast.success('Answer updated');
    } catch (err) {
      toast.error('Edit failed');
    }
  };

  const handleDelete = async () => {
    if (window.confirm('Delete this answer permanently?')) {
      try {
        await onDelete(answer.id);
        toast.success('Answer deleted');
      } catch (err) {
        toast.error('Delete failed');
      }
    }
  };

  const reputationLevel = getReputationLevel(answer.userReputation || 0);
  const timeAgo = formatRelativeTime(answer.createdAt);
  const safeUserName = answer.userName || 'Anonymous';
  const safeUserPhoto = answer.userPhoto || '/assets/default-profile.png';

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      layout
      className={cn(
        "p-3 rounded-xl border transition-all",
        isBest && "bg-yellow-500/10 border-yellow-500/50 shadow-md"
      )}
      style={{
        backgroundColor: isBest ? 'rgba(234,179,8,0.1)' : tokens.actionBarBg,
        borderColor: isBest ? tokens.gold : tokens.border,
      }}
    >
      <div className="flex items-start gap-3">
        <img src={safeUserPhoto} className="w-9 h-9 rounded-full object-cover" alt="" />
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold" style={{ color: tokens.text }}>{safeUserName}</span>
            {reputationLevel && (
              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full" style={{ backgroundColor: `${reputationLevel.color}20`, color: reputationLevel.color }}>
                {reputationLevel.label}
              </span>
            )}
            {answer.isExpert && (
              <span className="text-[10px] bg-purple-500 text-white px-1.5 py-0.5 rounded-full">Expert</span>
            )}
            {isBest && (
              <span className="flex items-center gap-1 text-[10px] text-yellow-500">
                <Star className="w-3 h-3" /> Best Answer
              </span>
            )}
            <span className="text-[10px]" style={{ color: tokens.textSecondary }}>{timeAgo}</span>
          </div>
          {isEditing ? (
            <div className="mt-2 space-y-2">
              <textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                className="w-full p-2 rounded-lg border text-sm"
                style={{ backgroundColor: tokens.cardBg, borderColor: tokens.border, color: tokens.text }}
                rows={3}
                autoFocus
              />
              <div className="flex gap-2">
                <button onClick={handleEdit} className="flex items-center gap-1 text-xs px-3 py-1 rounded-full bg-green-500 text-white">
                  <Save className="w-3 h-3" /> Save
                </button>
                <button onClick={() => setIsEditing(false)} className="flex items-center gap-1 text-xs px-3 py-1 rounded-full bg-gray-500 text-white">
                  <X className="w-3 h-3" /> Cancel
                </button>
              </div>
            </div>
          ) : (
            <ExpandableText text={answer.answer} maxLength={180} tokens={tokens} />
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 mt-3 ml-12">
        <button
          onClick={() => handleVote('up')}
          className={cn("flex items-center gap-1 text-xs transition", userVote === 'up' ? 'text-green-500' : 'text-gray-400 hover:text-green-500')}
          aria-label="Upvote"
        >
          <ThumbsUp className="w-3.5 h-3.5" /> {optimisticUpvotes}
        </button>
        <button
          onClick={() => handleVote('down')}
          className={cn("flex items-center gap-1 text-xs transition", userVote === 'down' ? 'text-red-500' : 'text-gray-400 hover:text-red-500')}
          aria-label="Downvote"
        >
          <ThumbsDown className="w-3.5 h-3.5" />
        </button>
        {isAnswerAuthor && !isEditing && (
          <>
            <button onClick={() => setIsEditing(true)} className="text-gray-400 hover:text-yellow-500 transition" aria-label="Edit">
              <Edit3 className="w-3.5 h-3.5" />
            </button>
            <button onClick={handleDelete} className="text-gray-400 hover:text-red-500 transition" aria-label="Delete">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </>
        )}
        {canMarkBest && (
          <button onClick={() => onMarkBest(answer.id)} className="text-purple-400 hover:text-purple-300 transition flex items-center gap-1 text-xs">
            <Star className="w-3.5 h-3.5" /> Mark Best
          </button>
        )}
        <button onClick={() => onReport(answer.id)} className="ml-auto text-gray-400 hover:text-red-500 transition" aria-label="Report">
          <Flag className="w-3.5 h-3.5" />
        </button>
      </div>
    </motion.div>
  );
}, (prev, next) => {
  // Deep comparison to avoid unnecessary re‑renders
  return (
    prev.answer.id === next.answer.id &&
    prev.answer.answer === next.answer.answer &&
    prev.answer.upvotes === next.answer.upvotes &&
    prev.answer.isBest === next.answer.isBest &&
    prev.answer.userVote === next.answer.userVote &&
    prev.answer.userReputation === next.answer.userReputation &&
    prev.answer.createdAt === next.answer.createdAt &&
    prev.isAuthor === next.isAuthor &&
    prev.currentUserId === next.currentUserId &&
    prev.isBest === next.isBest
  );
});

// ------------------------------------------------------------------
// MAIN COMPONENT
// ------------------------------------------------------------------
const QuestionCard = React.memo(({
  question,
  postId,
  currentUser,
  tokens,
  answers,
  userReputation = 0,
  isAuthor,
  onSubmitAnswer,
  onVote,
  onMarkBest,
  onEditAnswer,
  onDeleteAnswer,
  onReport,
  isClosed = false,
}) => {
  // ---------- All hooks called unconditionally ----------
  const [answerText, setAnswerText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showAnswers, setShowAnswers] = useState(false);  // answers hidden by default
  const [showComposer, setShowComposer] = useState(true);
  const submitLock = useRef(false);

  // Compute actualClosed using useMemo
  const actualClosed = useMemo(
    () => isClosed || question?.closed === true,
    [isClosed, question?.closed]
  );

  // Stable ranking with clear rules: best answer first, then most upvotes, then newest
  const rankedAnswers = useMemo(() => {
    if (!answers) return [];
    return [...answers].sort((a, b) => {
      if (a.isBest && !b.isBest) return -1;
      if (!a.isBest && b.isBest) return 1;
      const upDiff = (b.upvotes || 0) - (a.upvotes || 0);
      if (upDiff !== 0) return upDiff;
      return new Date(b.createdAt) - new Date(a.createdAt);
    });
  }, [answers]);

  const submitAnswer = useCallback(async () => {
    if (!currentUser) {
      toast.error('Sign in to answer');
      return;
    }
    if (actualClosed) {
      toast.error('Question is closed');
      return;
    }
    if (!answerText.trim()) return;
    if (isSubmitting || submitLock.current) return;

    submitLock.current = true;
    setIsSubmitting(true);
    const idempotencyKey = `${currentUser.uid}_${postId}_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    try {
      await onSubmitAnswer(answerText.trim(), idempotencyKey);
      setAnswerText('');
      toast.success('Answer posted!');
    } catch (err) {
      toast.error(err.message || 'Failed to post answer');
    } finally {
      submitLock.current = false;
      setIsSubmitting(false);
    }
  }, [currentUser, answerText, postId, onSubmitAnswer, isSubmitting, actualClosed]);

  // Persist composer visibility per post
  useEffect(() => {
    const saved = localStorage.getItem(`arvdoul_composer_${postId}`);
    if (saved !== null) setShowComposer(saved === 'true');
  }, [postId]);

  useEffect(() => {
    localStorage.setItem(`arvdoul_composer_${postId}`, String(showComposer));
  }, [showComposer, postId]);

  const bountyAmount = question?.bounty ?? 0;

  // Neon purple styling (works in both light and dark themes)
  const neonGradient = `linear-gradient(135deg, ${tokens.audioNeonPrimary || '#9333ea'}, ${tokens.audioNeonSecondary || '#c026d3'}, #ec4899)`;
  const buttonGlow = `0 0 8px rgba(236, 72, 153, 0.4)`;
  const cardShadow = tokens.shadowDirectional || '0 8px 24px -6px rgba(0,0,0,0.4), 0 4px 12px rgba(0,0,0,0.1)';

  const reputationLevel = getReputationLevel(userReputation);

  // Guard after hooks
  if (!question) {
    return (
      <div className="px-4 py-3 rounded-2xl border border-red-500/30 bg-red-500/10 text-red-400 text-sm">
        ⚠️ Question data unavailable
      </div>
    );
  }

  // Empty state component (defined inside to access tokens)
  const EmptyState = () => (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="text-center py-8 px-4 rounded-2xl border border-dashed"
      style={{ borderColor: tokens.border, backgroundColor: tokens.actionBarBg }}
    >
      <MessageCircle className="w-12 h-12 mx-auto mb-3 opacity-40" style={{ color: tokens.textSecondary }} />
      <p className="text-sm font-medium" style={{ color: tokens.textSecondary }}>No answers yet</p>
      <p className="text-xs mt-1" style={{ color: tokens.textSecondary }}>Be the first to share your knowledge</p>
      {!actualClosed && currentUser && (
        <button
          onClick={() => setShowComposer(true)}
          className="mt-3 px-4 py-1.5 rounded-full text-xs font-medium text-white shadow-md"
          style={{ background: neonGradient, boxShadow: buttonGlow }}
        >
          Write an answer
        </button>
      )}
    </motion.div>
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="px-4 py-3 space-y-3 rounded-2xl border backdrop-blur-sm"
      style={{
        backgroundColor: tokens.cardBgAlt || 'rgba(0,0,0,0.3)',
        borderColor: tokens.border || 'rgba(255,255,255,0.1)',
        boxShadow: `${tokens.shadowAmbient || '0 1px 2px rgba(0,0,0,0.2)'}, ${cardShadow}`,
      }}
    >
      {/* Question header */}
      <div className="flex flex-wrap justify-between items-start gap-2">
        <div className="flex items-start gap-2">
          <HelpCircle className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: tokens.primary }} />
          <div>
            <h4 className="font-bold text-base" style={{ color: tokens.text }}>
              {question.text || 'Untitled Question'}
            </h4>
            <div className="flex flex-wrap items-center gap-2 mt-1">
              {bountyAmount > 0 && !actualClosed && (
                <span className="inline-flex items-center gap-1 text-xs bg-yellow-500/20 text-yellow-400 px-2 py-0.5 rounded-full">
                  <Coins className="w-3 h-3" /> {bountyAmount} bounty
                </span>
              )}
              {actualClosed ? (
                <span className="inline-flex items-center gap-1 text-xs bg-gray-500/20 text-gray-400 px-2 py-0.5 rounded-full">
                  <Lock className="w-3 h-3" /> Closed
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-xs bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full">
                  <CheckCircle className="w-3 h-3" /> Open
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* User reputation line */}
      {currentUser && (
        <div className="flex items-center gap-2 text-xs pb-1" style={{ color: tokens.textSecondary }}>
          <span>Your reputation:</span>
          <span className="font-bold" style={{ color: tokens.gold }}>{userReputation}</span>
          {reputationLevel && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ backgroundColor: `${reputationLevel.color}20`, color: reputationLevel.color }}>
              {reputationLevel.label}
            </span>
          )}
        </div>
      )}

      {/* Answer composer – collapsible, visible by default */}
      {!actualClosed && currentUser && (
        <div className="bg-black/20 rounded-2xl overflow-hidden transition-all">
          <button
            onClick={() => setShowComposer(!showComposer)}
            className="w-full flex justify-between items-center p-3 text-sm font-medium"
            style={{ color: tokens.text }}
          >
            <span className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-purple-400" />
              Write your answer
            </span>
            <ChevronDown className={cn("w-4 h-4 transition-transform", showComposer && "rotate-180")} />
          </button>
          <AnimatePresence>
            {showComposer && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="p-3 pt-0 space-y-2"
              >
                <textarea
                  value={answerText}
                  onChange={(e) => setAnswerText(e.target.value)}
                  placeholder="Share your expertise..."
                  className="w-full bg-black/30 rounded-xl border px-4 py-3 text-sm placeholder:text-gray-400 resize-none focus:outline-none focus:ring-1"
                  style={{ borderColor: tokens.border, color: tokens.text }}
                  rows={4}
                  aria-label="Write your answer"
                />
                <div className="flex justify-end">
                  <button
                    onClick={submitAnswer}
                    disabled={isSubmitting || !answerText.trim()}
                    className="flex items-center gap-2 px-6 py-2 rounded-full text-white font-medium shadow-md transition-all"
                    style={{ background: neonGradient, boxShadow: buttonGlow }}
                    aria-label="Post answer"
                  >
                    {isSubmitting ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Send className="w-4 h-4" />}
                    Post Answer
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Toggle answers visibility – answers hidden by default */}
      <div className="flex justify-between items-center">
        <span className="text-xs font-semibold" style={{ color: tokens.textSecondary }}>
          {rankedAnswers.length} Answer{rankedAnswers.length !== 1 ? 's' : ''}
        </span>
        <button
          onClick={() => setShowAnswers(!showAnswers)}
          className="flex items-center gap-1 text-xs text-purple-400 hover:text-purple-300 transition"
          aria-label={showAnswers ? 'Hide answers' : 'Show answers'}
        >
          {showAnswers ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
          {showAnswers ? 'Hide' : 'Show'}
        </button>
      </div>

      {/* Answers list (collapsible) – initially hidden */}
      <AnimatePresence initial={false}>
        {showAnswers && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            {rankedAnswers.length > 0 ? (
              <div className="space-y-3">
                {rankedAnswers.map((answer) => (
                  <AnswerItem
                    key={answer.id}
                    answer={answer}
                    isAuthor={isAuthor}
                    currentUserId={currentUser?.uid}
                    isBest={answer.isBest === true}
                    onVote={onVote}
                    onMarkBest={onMarkBest}
                    onEdit={onEditAnswer}
                    onDelete={onDeleteAnswer}
                    onReport={onReport}
                    tokens={tokens}
                  />
                ))}
              </div>
            ) : (
              <EmptyState />
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
});

QuestionCard.displayName = 'QuestionCard';
export default QuestionCard;