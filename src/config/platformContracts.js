// src/config/platformContracts.js - ARVDOUL PLATFORM ARCHITECTURE & EVENT CONTRACTS
// Authoritative definitions for service contracts, idempotency keys, and conflict resolution strategies.

export const CONFLICT_RESOLUTION_STRATEGIES = {
  LWW: 'LAST_WRITE_WINS',
  APPEND_ONLY: 'APPEND_ONLY',
  SERVER_AUTHORITATIVE: 'SERVER_AUTHORITATIVE',
  MERGE_SETS: 'MERGE_SETS',
  CLIENT_WINS: 'CLIENT_WINS'
};

export const DOMAIN_CONFLICT_MATRIX = {
  'users': {
    profile: CONFLICT_RESOLUTION_STRATEGIES.LWW,
    coins: CONFLICT_RESOLUTION_STRATEGIES.SERVER_AUTHORITATIVE,
    badges: CONFLICT_RESOLUTION_STRATEGIES.SERVER_AUTHORITATIVE
  },
  'posts': {
    content: CONFLICT_RESOLUTION_STRATEGIES.LWW,
    likes: CONFLICT_RESOLUTION_STRATEGIES.MERGE_SETS,
    comments: CONFLICT_RESOLUTION_STRATEGIES.APPEND_ONLY
  },
  'conversations': {
    messages: CONFLICT_RESOLUTION_STRATEGIES.APPEND_ONLY,
    readReceipts: CONFLICT_RESOLUTION_STRATEGIES.LWW
  },
  'marketplace': {
    orders: CONFLICT_RESOLUTION_STRATEGIES.SERVER_AUTHORITATIVE,
    items: CONFLICT_RESOLUTION_STRATEGIES.LWW
  },
  'polls': {
    votes: CONFLICT_RESOLUTION_STRATEGIES.SERVER_AUTHORITATIVE,
    predictions: CONFLICT_RESOLUTION_STRATEGIES.SERVER_AUTHORITATIVE
  }
};

export const PLATFORM_EVENT_TYPES = {
  POST_CREATED: 'post.created',
  POST_LIKED: 'post.liked',
  POST_SHARED: 'post.shared',
  MESSAGE_SENT: 'message.sent',
  TIP_SENT: 'coin.tip_sent',
  SPACE_STARTED: 'space.started',
  SPACE_JOINED: 'space.joined',
  ITEM_PURCHASED: 'marketplace.item_purchased',
  POLL_VOTED: 'poll.voted'
};

export class PlatformEventManager {
  static listeners = new Map();

  static subscribe(eventType, callback) {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, new Set());
    }
    this.listeners.get(eventType).add(callback);
    return () => {
      this.listeners.get(eventType)?.delete(callback);
    };
  }

  static emit(eventType, payload) {
    const callbacks = this.listeners.get(eventType);
    if (callbacks) {
      callbacks.forEach(cb => {
        try {
          cb(payload);
        } catch (e) {
          console.error(`Error in event listener for ${eventType}:`, e);
        }
      });
    }
  }
}

export default {
  CONFLICT_RESOLUTION_STRATEGIES,
  DOMAIN_CONFLICT_MATRIX,
  PLATFORM_EVENT_TYPES,
  PlatformEventManager
};
