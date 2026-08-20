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
    log.info('Voting on poll in Firestore', { pollId, optionId, wagerCoins });
    const firestore = await getFirestoreInstance();
    const { doc, getDoc, updateDoc, increment, collection, addDoc } = await import('firebase/firestore');

    const pollRef = doc(firestore, 'polls', pollId);
    const snap = await getDoc(pollRef);
    if (!snap.exists()) {
      throw new Error('Poll not found');
    }

    const pollData = snap.data();
    const options = pollData.options || [];
    const targetOpt = options.find(o => o.id === optionId);
    if (!targetOpt) {
      throw new Error('Option not found');
    }

    targetOpt.votes = (targetOpt.votes || 0) + 1;
    const newTotalVotes = (pollData.totalVotes || 0) + 1;
    options.forEach(opt => {
      opt.percentage = Math.round(((opt.votes || 0) / newTotalVotes) * 100);
    });

    const updatePayload = {
      options,
      totalVotes: newTotalVotes
    };

    if (wagerCoins > 0 && pollData.isPredictionMarket) {
      updatePayload.poolCoins = increment(Number(wagerCoins));
    }

    await updateDoc(pollRef, updatePayload);

    this.votedHistory.set(pollId, optionId);
    await this._saveVotes();

    if (user?.uid) {
      try {
        await addDoc(collection(firestore, 'poll_votes'), {
          pollId,
          optionId,
          userId: user.uid,
          wagerCoins: Number(wagerCoins) || 0,
          votedAt: new Date().toISOString()
        });
      } catch (_) {}
    }

    return { id: pollId, ...pollData, ...updatePayload, hasVoted: optionId };
  }

  async createPoll({ question, category = 'General', options = [], isPredictionMarket = false, creator }) {
    log.info('Creating poll in Firestore', { question });
    const firestore = await getFirestoreInstance();
    const { collection, addDoc } = await import('firebase/firestore');

    const newPoll = {
      question,
      category,
      creator: {
        id: creator?.uid || 'usr-creator',
        name: creator?.displayName || 'Arvdoul Creator',
        username: creator?.username ? `@${creator.username}` : '@creator',
        avatar: creator?.photoURL || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'
      },
      totalVotes: 0,
      endsIn: '7 days left',
      options: options.map((optText, idx) => ({
        id: `opt-${idx}`,
        text: optText,
        votes: 0,
        percentage: 0
      })),
      isPredictionMarket,
      poolCoins: isPredictionMarket ? 5000 : 0,
      createdAt: new Date().toISOString()
    };

    const docRef = await addDoc(collection(firestore, 'polls'), newPoll);
    return { id: docRef.id, ...newPoll, hasVoted: null };
  }
}

export const pollService = new PollService();
export default pollService;

