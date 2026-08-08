// src/services/spacesService.js
// 🎙️ ARVDOUL LIVE AUDIO SPACES & VOICE LOUNGES SERVICE
// Enterprise multi-user audio rooms with speaker stages, reactions, and coin tipping

import { svcLogger } from './ServiceKit.js';

const log = svcLogger('spacesService');

const SAMPLE_SPACES = [
  {
    id: 'space-tech-trends',
    title: '🚀 Future of AI & Creator Monetization in 2026',
    category: 'Tech & AI',
    isLive: true,
    startedAt: Date.now() - 1000 * 60 * 25,
    host: {
      id: 'usr-sarah',
      name: 'Sarah Chen',
      username: '@sarahchen_ai',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
      isVerified: true
    },
    speakers: [
      { id: 'usr-alex', name: 'Alex Rivera', username: '@arivera', avatar: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=150', isSpeaking: true, isMuted: false },
      { id: 'usr-elena', name: 'Elena Rostova', username: '@elena_design', avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150', isSpeaking: false, isMuted: true }
    ],
    audienceCount: 342,
    listeners: [
      { id: 'l1', name: 'David K', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150' },
      { id: 'l2', name: 'Maya P', avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150' },
      { id: 'l3', name: 'Sam W', avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150' },
      { id: 'l4', name: 'Zoe L', avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150' }
    ],
    raisedHands: [
      { id: 'l1', name: 'David K', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150' }
    ],
    tipsTotalCoins: 12500,
    isRecording: true
  },
  {
    id: 'space-music-lounge',
    title: '🎵 Midnight Lofi & Beatmaking Jam Session',
    category: 'Music & Audio',
    isLive: true,
    startedAt: Date.now() - 1000 * 60 * 45,
    host: {
      id: 'usr-marcus',
      name: 'Marcus Vance',
      username: '@marcus_beats',
      avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150',
      isVerified: true
    },
    speakers: [
      { id: 'usr-chloe', name: 'Chloe Kim', username: '@chloe_vox', avatar: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=150', isSpeaking: true, isMuted: false }
    ],
    audienceCount: 819,
    listeners: [
      { id: 'l5', name: 'Liam T', avatar: 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=150' },
      { id: 'l6', name: 'Amara N', avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150' }
    ],
    raisedHands: [],
    tipsTotalCoins: 28400,
    isRecording: false
  },
  {
    id: 'space-crypto-alpha',
    title: '💎 Web3, NFTs & Creator Royalty Protocols',
    category: 'Crypto & Web3',
    isLive: true,
    startedAt: Date.now() - 1000 * 60 * 12,
    host: {
      id: 'usr-jordan',
      name: 'Jordan Sparks',
      username: '@sparks_crypto',
      avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150',
      isVerified: true
    },
    speakers: [],
    audienceCount: 154,
    listeners: [],
    raisedHands: [],
    tipsTotalCoins: 4200,
    isRecording: true
  }
];

class SpacesService {
  constructor() {
    this.spaces = [...SAMPLE_SPACES];
    this.activeRoomId = null;
    this.listeners = new Set();
  }

  async getActiveSpaces(category = 'All') {
    log.info('Fetching active spaces', { category });
    await new Promise(r => setTimeout(r, 250));
    if (category === 'All') return this.spaces;
    return this.spaces.filter(s => s.category.toLowerCase().includes(category.toLowerCase()));
  }

  async getSpaceById(spaceId) {
    const space = this.spaces.find(s => s.id === spaceId);
    return space || this.spaces[0];
  }

  async createSpace({ title, category = 'General', isRecording = true, hostUser }) {
    log.info('Creating new live space', { title, category });
    const newSpace = {
      id: `space-${Date.now()}`,
      title,
      category,
      isLive: true,
      startedAt: Date.now(),
      host: {
        id: hostUser?.uid || 'usr-me',
        name: hostUser?.displayName || 'Arvdoul Creator',
        username: hostUser?.username || '@creator',
        avatar: hostUser?.photoURL || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
        isVerified: true
      },
      speakers: [],
      audienceCount: 1,
      listeners: [],
      raisedHands: [],
      tipsTotalCoins: 0,
      isRecording
    };
    this.spaces.unshift(newSpace);
    return newSpace;
  }

  async sendTip(spaceId, amount, speakerId) {
    log.info('Tipping in space', { spaceId, amount, speakerId });
    const space = this.spaces.find(s => s.id === spaceId);
    if (space) {
      space.tipsTotalCoins = (space.tipsTotalCoins || 0) + Number(amount);
    }
    return { success: true, newTotal: space ? space.tipsTotalCoins : amount };
  }
}

export const spacesService = new SpacesService();
export default spacesService;
