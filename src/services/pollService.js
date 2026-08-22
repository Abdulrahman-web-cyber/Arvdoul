// src/services/pollService.js
// 📊 ARVDOUL POLLS & PREDICTION MARKETS SERVICE
// Real-time community voting, predictive coin markets, and creator opinion analytics in Firestore.

import { svcLogger } from './ServiceKit.js';
import { getFirestoreInstance } from '../firebase/firebase.js';
import localforage from 'localforage';

const log = svcLogger('pollService');

class PollService {
  constructor() {
    this.votedHistory = new Map(); // pollId -> optionId
    this._initVotes();
  }

  _generateSecureHex(bytes = 4) {
    const arr = new Uint8Array(bytes);
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
      crypto.getRandomValues(arr);
    }
    return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('');
  }

  async _initVotes() {
    try {
      const saved = await localforage.getItem('arvdoul_polls_voted_history');
      if (saved && typeof saved === 'object') {
        Object.entries(saved).forEach(([key, val]) => {
          this.votedHistory.set(key, val);
        });
      }
    } catch (_) {}
  }

  async _saveVotes() {
    try {
      const obj = {};
      this.votedHistory.forEach((val, key) => {
        obj[key] = val;
      });
      await localforage.setItem('arvdoul_polls_voted_history', obj);
    } catch (_) {}
  }

  async getPolls(category = 'All') {
    log.info('Fetching polls from Firestore', { category });
    try {
      const firestore = await getFirestoreInstance();
      const { collection, getDocs, query, where, orderBy, limit } = await import('firebase/firestore');

      const colRef = collection(firestore, 'polls');
      let q = query(colRef, orderBy('createdAt', 'desc'), limit(40));

      if (category && category !== 'All') {
        q = query(colRef, where('category', '==', category), limit(40));
      }

      const snap = await getDocs(q);
      const items = [];
      snap.forEach(docSnap => {
        const data = docSnap.data();
        const hasVoted = this.votedHistory.get(docSnap.id) || null;
        items.push({ id: docSnap.id, ...data, hasVoted });
      });

      return items;
    } catch (err) {
      log.error('Error fetching polls from Firestore', err);
      return [];
    }
  }

  async votePoll(pollId, optionId, userCoins = 0, wagerCoins = 0, user = null) {
    if (!user?.uid) {
      throw new Error('Sign in to vote');
    }
    log.info('Voting on poll (server-authoritative)', { pollId, optionId, wagerCoins });

    // Server-authoritative vote: functions/polls.js votePoll atomically
    // increments counters, records the deterministic poll_votes doc
    // (${uid}_${pollId} — enforced by rules) and debits wagers through the
    // double-entry ledger. Direct client writes to the poll doc are denied
    // by firestore.rules (creator/admin only), so there is no client
    // fallback for the money path.
    try {
      const { getFunctions, httpsCallable } = await import('firebase/functions');
      const { getApp } = await import('firebase/app');
      const functions = getFunctions(getApp());
      const fn = httpsCallable(functions, 'votePoll');
      const res = await fn({ pollId, optionId, wagerCoins: Number(wagerCoins) || 0 });
      const poll = res.data?.poll || {};
      this.votedHistory.set(pollId, optionId);
      await this._saveVotes();
      return poll;
    } catch (err) {
      const msg = err?.message || String(err);
      if (msg.includes('votePoll') || msg.includes('INTERNAL') || msg.includes('UNAVAILABLE') || msg.includes('NOT_FOUND')) {
        throw new Error(`Voting requires the votePoll Cloud Function to be deployed. (${msg})`);
      }
      throw new Error(msg);
    }
  }

  async createPoll({ question, category = 'General', options = [], isPredictionMarket = false, creator }) {
    log.info('Creating poll in Firestore', { question });
    const firestore = await getFirestoreInstance();
    const { collection, addDoc } = await import('firebase/firestore');

    // Honest creator identity: real user fields only. Never fabricate an
    // id/name/avatar — anonymous fallbacks are explicit, not invented people.
    if (!creator?.uid) {
      throw new Error('Sign in to create a poll');
    }
    const now = new Date();
    const POLL_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
    const newPoll = {
      question,
      category,
      // Top-level creatorId is REQUIRED by firestore.rules
      // (match /polls/{pollId} create: creatorId == uid()).
      creatorId: creator.uid,
      creator: {
        id: creator?.uid || null,
        name: creator?.displayName || '',
        username: creator?.username ? `@${creator.username}` : null,
        avatar: creator?.photoURL || null
      },
      totalVotes: 0,
      // Real end timestamp (computed, not a hardcoded label). The UI derives
      // the human label from this value.
      endsAt: new Date(now.getTime() + POLL_DURATION_MS).toISOString(),
      options: options.map((optText, idx) => ({
        id: `opt-${idx}`,
        text: optText,
        votes: 0,
        percentage: 0
      })),
      isPredictionMarket,
      // Prediction pools start at 0 — every coin is a real wager. No free
      // starting pool.
      poolCoins: 0,
      createdAt: now.toISOString()
    };

    const docRef = await addDoc(collection(firestore, 'polls'), newPoll);
    return { id: docRef.id, ...newPoll, hasVoted: null };
  }
}

export const pollService = new PollService();
export default pollService;

