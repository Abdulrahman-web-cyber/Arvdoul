/**
 * src/services/liveInteractiveGamificationService.js - ARVDOUL LIVE STREAM GAMIFICATION & INTERACTION v1.0
 * 
 * Production-grade live broadcast engagement:
 * • Sub-second audience live micro-polls with percentage distribution computation
 * • Collaborative stream goals (e.g. tip milestones, like counters) with unlocked reward states
 * • Upvotable Audience Q&A queue with host pins and answer status tracking
 */

import { logger } from '../utils/Logger.js';

export class LiveInteractiveGamificationService {
  constructor() {
    this.sessionPolls = new Map(); // sessionId -> Map(pollId -> poll)
    this.sessionGoals = new Map(); // sessionId -> Map(goalId -> goal)
    this.sessionQA = new Map();    // sessionId -> Map(questionId -> question)
  }

  // ==================== LIVE MICRO-POLLS ====================

  /**
   * Launches a live micro-poll in an active livestream or audio space.
   */
  createLivePoll({
    sessionId,
    creatorId,
    question,
    options = [], // ['Option A', 'Option B']
    durationSec = 60,
  }) {
    if (!sessionId || !question) throw new Error('sessionId and question are required');
    if (!Array.isArray(options) || options.length < 2) {
      throw new Error('At least 2 options are required for a live poll');
    }

    const pollId = `lpoll_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const now = Date.now();

    const poll = {
      id: pollId,
      sessionId,
      creatorId,
      question,
      options: options.map((text, idx) => ({
        id: `opt_${idx}`,
        text,
        votes: 0,
      })),
      totalVotes: 0,
      voters: new Map(), // userId -> optionId
      createdAt: now,
      expiresAt: now + durationSec * 1000,
      isActive: true,
    };

    if (!this.sessionPolls.has(sessionId)) {
      this.sessionPolls.set(sessionId, new Map());
    }
    this.sessionPolls.get(sessionId).set(pollId, poll);

    logger.info(`[LiveGamification] Live poll ${pollId} launched in session ${sessionId}: "${question}"`);
    return this._formatPoll(poll);
  }

  /**
   * Casts a vote in a live micro-poll.
   */
  voteInLivePoll(sessionId, pollId, userId, optionId) {
    const poll = this._getPoll(sessionId, pollId);
    if (!poll.isActive || Date.now() > poll.expiresAt) {
      poll.isActive = false;
      throw new Error('Poll has ended');
    }

    const option = poll.options.find(o => o.id === optionId);
    if (!option) throw new Error('Option not found');

    // Deduct previous vote if changing option
    if (poll.voters.has(userId)) {
      const prevOptionId = poll.voters.get(userId);
      const prevOption = poll.options.find(o => o.id === prevOptionId);
      if (prevOption) prevOption.votes--;
      poll.totalVotes--;
    }

    option.votes++;
    poll.totalVotes++;
    poll.voters.set(userId, optionId);

    return this._formatPoll(poll);
  }

  // ==================== STREAM GOALS & MILESTONES ====================

  /**
   * Registers a collective stream goal (e.g. 500 coins for acoustic encore).
   */
  createStreamGoal({
    sessionId,
    title,
    targetAmount,
    metricType = 'COINS', // 'COINS', 'LIKES', 'FOLLOWERS'
  }) {
    if (!sessionId || !title || !targetAmount) {
      throw new Error('sessionId, title, and targetAmount are required');
    }

    const goalId = `goal_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const goal = {
      id: goalId,
      sessionId,
      title,
      targetAmount,
      currentAmount: 0,
      metricType,
      isUnlocked: false,
      progressPercent: 0,
    };

    if (!this.sessionGoals.has(sessionId)) {
      this.sessionGoals.set(sessionId, new Map());
    }
    this.sessionGoals.get(sessionId).set(goalId, goal);

    logger.info(`[LiveGamification] Stream goal ${goalId} established: "${title}" target ${targetAmount}`);
    return goal;
  }

  /**
   * Contributes progress to a stream goal.
   */
  contributeToGoal(sessionId, goalId, amount) {
    const goalsMap = this.sessionGoals.get(sessionId);
    if (!goalsMap || !goalsMap.has(goalId)) throw new Error('Stream goal not found');

    const goal = goalsMap.get(goalId);
    goal.currentAmount += amount;
    goal.progressPercent = Math.min(100, Math.round((goal.currentAmount / goal.targetAmount) * 100));

    if (goal.currentAmount >= goal.targetAmount && !goal.isUnlocked) {
      goal.isUnlocked = true;
      goal.unlockedAt = Date.now();
      logger.info(`[LiveGamification] Stream goal ${goalId} UNLOCKED! (${goal.title})`);
    }

    return { ...goal };
  }

  // ==================== UPVOTABLE Q&A QUEUE ====================

  /**
   * Submits a question into the audience Q&A queue.
   */
  submitQuestion(sessionId, userId, questionText, authorName = 'Anonymous') {
    if (!sessionId || !questionText) throw new Error('sessionId and questionText are required');

    const questionId = `qa_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const question = {
      id: questionId,
      sessionId,
      userId,
      authorName,
      questionText: String(questionText).trim(),
      upvotes: 1, // Author upvotes by default
      upvoterIds: new Set([userId]),
      isPinned: false,
      isAnswered: false,
      createdAt: Date.now(),
    };

    if (!this.sessionQA.has(sessionId)) {
      this.sessionQA.set(sessionId, new Map());
    }
    this.sessionQA.get(sessionId).set(questionId, question);

    return this._formatQuestion(question);
  }

  /**
   * Upvotes a question in the Q&A queue.
   */
  upvoteQuestion(sessionId, questionId, userId) {
    const qaMap = this.sessionQA.get(sessionId);
    if (!qaMap || !qaMap.has(questionId)) throw new Error('Question not found');

    const q = qaMap.get(questionId);
    if (q.upvoterIds.has(userId)) {
      q.upvoterIds.delete(userId);
      q.upvotes = Math.max(0, q.upvotes - 1);
    } else {
      q.upvoterIds.add(userId);
      q.upvotes++;
    }

    return this._formatQuestion(q);
  }

  /**
   * Host pins or answers a question.
   */
  moderateQuestion(sessionId, questionId, { isPinned, isAnswered }) {
    const qaMap = this.sessionQA.get(sessionId);
    if (!qaMap || !qaMap.has(questionId)) throw new Error('Question not found');

    const q = qaMap.get(questionId);
    if (isPinned !== undefined) q.isPinned = Boolean(isPinned);
    if (isAnswered !== undefined) q.isAnswered = Boolean(isAnswered);

    return this._formatQuestion(q);
  }

  _getPoll(sessionId, pollId) {
    const pollsMap = this.sessionPolls.get(sessionId);
    if (!pollsMap || !pollsMap.has(pollId)) throw new Error('Poll not found');
    return pollsMap.get(pollId);
  }

  _formatPoll(poll) {
    const total = poll.totalVotes;
    return {
      id: poll.id,
      sessionId: poll.sessionId,
      creatorId: poll.creatorId,
      question: poll.question,
      totalVotes: total,
      isActive: poll.isActive,
      options: poll.options.map(opt => ({
        id: opt.id,
        text: opt.text,
        votes: opt.votes,
        percentage: total > 0 ? Number(((opt.votes / total) * 100).toFixed(1)) : 0,
      })),
    };
  }

  _formatQuestion(q) {
    return {
      id: q.id,
      sessionId: q.sessionId,
      userId: q.userId,
      authorName: q.authorName,
      questionText: q.questionText,
      upvotes: q.upvotes,
      isPinned: q.isPinned,
      isAnswered: q.isAnswered,
      createdAt: q.createdAt,
    };
  }
}

export const liveInteractiveGamificationService = new LiveInteractiveGamificationService();
export default liveInteractiveGamificationService;
