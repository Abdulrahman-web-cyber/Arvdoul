// src/services/pollService.js
// 📊 ARVDOUL POLLS & PREDICTION MARKETS SERVICE
// Real-time community voting, predictive coin markets, and creator opinion analytics

import { svcLogger } from './ServiceKit.js';

const log = svcLogger('pollService');

const SAMPLE_POLLS = [
  {
    id: 'poll-ai-creator',
    question: '🤖 Will AI video generation fully replace standard camera B-roll by late 2027?',
    category: 'Tech & Trends',
    creator: {
      name: 'Tech Horizon',
      username: '@tech_horizon',
      avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150'
    },
    totalVotes: 14820,
    hasVoted: null,
    endsIn: '2 days left',
    options: [
      { id: 'opt1', text: 'Yes, 100% for short-form & ads', votes: 8892, percentage: 60 },
      { id: 'opt2', text: 'No, human cinematography stays king', votes: 4150, percentage: 28 },
      { id: 'opt3', text: 'Hybrid 50/50 workflow', votes: 1778, percentage: 12 }
    ],
    isPredictionMarket: true,
    poolCoins: 85000,
    topPredictedOption: 'opt1'
  },
  {
    id: 'poll-best-camera',
    question: '📸 What is your go-to creator camera setup in 2026?',
    category: 'Gear & Studio',
    creator: {
      name: 'Elena Rostova',
      username: '@elena_design',
      avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150'
    },
    totalVotes: 9450,
    hasVoted: null,
    endsIn: '5 hours left',
    options: [
      { id: 'optA', text: 'Sony FX3 / A7S III (Cinema Line)', votes: 4725, percentage: 50 },
      { id: 'optB', text: 'iPhone 16 Pro Max ProRes Log', votes: 3307, percentage: 35 },
      { id: 'optC', text: 'Fujifilm X-T5 (Film Simulation)', votes: 1418, percentage: 15 }
    ],
    isPredictionMarket: false,
    poolCoins: 0
  },
  {
    id: 'poll-crypto-monetization',
    question: '💎 Should creators receive 100% of revenue with zero platform cut?',
    category: 'Creator Economy',
    creator: {
      name: 'Jordan Sparks',
      username: '@sparks_crypto',
      avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150'
    },
    totalVotes: 23100,
    hasVoted: null,
    endsIn: '18 hours left',
    options: [
      { id: 'optX', text: 'Yes! Arvdoul 0% Fee model is the future', votes: 20790, percentage: 90 },
      { id: 'optY', text: 'Small 2-5% platform fee is fair', votes: 2310, percentage: 10 }
    ],
    isPredictionMarket: true,
    poolCoins: 142000,
    topPredictedOption: 'optX'
  }
];

class PollService {
  constructor() {
    this.polls = [...SAMPLE_POLLS];
  }

  async getPolls(category = 'All') {
    log.info('Fetching polls & prediction markets', { category });
    await new Promise(r => setTimeout(r, 200));
    if (category === 'All') return this.polls;
    return this.polls.filter(p => p.category.toLowerCase().includes(category.toLowerCase()));
  }

  async votePoll(pollId, optionId, userCoins = 0, wagerCoins = 0) {
    log.info('Voting on poll', { pollId, optionId, wagerCoins });
    const poll = this.polls.find(p => p.id === pollId);
    if (!poll) throw new Error('Poll not found');

    if (poll.hasVoted) {
      throw new Error('You have already voted on this poll.');
    }

    const selectedOption = poll.options.find(o => o.id === optionId);
    if (!selectedOption) throw new Error('Option not found');

    selectedOption.votes += 1;
    poll.totalVotes += 1;
    poll.hasVoted = optionId;

    if (wagerCoins > 0 && poll.isPredictionMarket) {
      poll.poolCoins += Number(wagerCoins);
    }

    // Recalculate percentages
    poll.options.forEach(opt => {
      opt.percentage = Math.round((opt.votes / poll.totalVotes) * 100);
    });

    return poll;
  }

  async createPoll({ question, category = 'General', options = [], isPredictionMarket = false, creator }) {
    log.info('Creating poll', { question });
    const newPoll = {
      id: `poll-${Date.now()}`,
      question,
      category,
      creator: {
        name: creator?.displayName || 'Arvdoul Creator',
        username: creator?.username || '@creator',
        avatar: creator?.photoURL || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'
      },
      totalVotes: 1,
      hasVoted: null,
      endsIn: '7 days left',
      options: options.map((optText, idx) => ({
        id: `opt-${idx}`,
        text: optText,
        votes: idx === 0 ? 1 : 0,
        percentage: idx === 0 ? 100 : 0
      })),
      isPredictionMarket,
      poolCoins: isPredictionMarket ? 5000 : 0
    };

    this.polls.unshift(newPoll);
    return newPoll;
  }
}

export const pollService = new PollService();
export default pollService;
