// Service layer unit tests
// These tests verify core service logic without Firebase dependencies

import { IdempotencyStore } from '../utils/IdempotencyKey';

describe('Service Layer Tests', () => {
  
  describe('IdempotencyStore', () => {
    test('generates unique keys for different operations', () => {
      const store = new IdempotencyStore({ defaultTtlMs: 1000 });
      
      const key1 = store.generate('like', ['user1', 'post1']);
      const key2 = store.generate('like', ['user1', 'post2']);
      
      // Keys should be unique due to randomId
      expect(key1).not.toBe(key2);
    });

    test('key format includes operation and parts', () => {
      const store = new IdempotencyStore();
      const key = store.generate('follow', ['user1', 'user2']);
      
      expect(key).toContain('follow');
      expect(key).toContain('user1');
      expect(key).toContain('user2');
    });

    test('checkAndRecord returns true for new keys', () => {
      const store = new IdempotencyStore({ defaultTtlMs: 1000 });
      const key = store.generate('test', ['entity1']);
      
      const result = store.checkAndRecord(key);
      expect(result).toBe(true);
    });

    test('checkAndRecord returns false for duplicates within TTL', () => {
      const store = new IdempotencyStore({ defaultTtlMs: 1000 });
      const key = store.generate('test', ['entity1']);
      
      store.checkAndRecord(key);
      const result = store.checkAndRecord(key);
      
      expect(result).toBe(false);
    });

    test('release removes the key', () => {
      const store = new IdempotencyStore({ defaultTtlMs: 1000 });
      const key = store.generate('test', ['entity1']);
      
      store.checkAndRecord(key);
      store.release(key);
      
      const isDup = store.isDuplicate(key);
      expect(isDup).toBe(false);
    });

    test('isDuplicate detects duplicate keys', () => {
      const store = new IdempotencyStore({ defaultTtlMs: 1000 });
      const key = store.generate('test', ['entity1']);
      
      store.checkAndRecord(key);
      expect(store.isDuplicate(key)).toBe(true);
      
      store.release(key);
      expect(store.isDuplicate(key)).toBe(false);
    });
  });

  describe('Cursor Pagination', () => {
    // Test cursor-based pagination logic
    const createCursor = (timestamp, docId) => {
      return Buffer.from(JSON.stringify({ timestamp, docId })).toString('base64');
    };

    const parseCursor = (cursor) => {
      try {
        return JSON.parse(Buffer.from(cursor, 'base64').toString('utf8'));
      } catch {
        return null;
      }
    };

    test('creates valid cursor', () => {
      const cursor = createCursor(1699900000000, 'doc123');
      expect(typeof cursor).toBe('string');
      expect(cursor.length).toBeGreaterThan(0);
    });

    test('parses cursor correctly', () => {
      const original = { timestamp: 1699900000000, docId: 'doc123' };
      const cursor = createCursor(original.timestamp, original.docId);
      const parsed = parseCursor(cursor);
      
      expect(parsed).toEqual(original);
    });

    test('returns null for invalid cursor', () => {
      const parsed = parseCursor('invalid-cursor-string');
      expect(parsed).toBeNull();
    });
  });

  describe('Rate Limiting', () => {
    // Simple in-memory rate limiter for client-side demo
    class SimpleRateLimiter {
      constructor(maxRequests, windowMs) {
        this.maxRequests = maxRequests;
        this.windowMs = windowMs;
        this.requests = new Map();
      }

      isAllowed(key) {
        const now = Date.now();
        const windowStart = now - this.windowMs;
        
        if (!this.requests.has(key)) {
          this.requests.set(key, []);
        }
        
        const timestamps = this.requests.get(key);
        const recentRequests = timestamps.filter(ts => ts > windowStart);
        
        if (recentRequests.length >= this.maxRequests) {
          return false;
        }
        
        recentRequests.push(now);
        this.requests.set(key, recentRequests);
        return true;
      }
    }

    test('allows requests within limit', () => {
      const limiter = new SimpleRateLimiter(5, 60000);
      
      for (let i = 0; i < 5; i++) {
        expect(limiter.isAllowed('user1')).toBe(true);
      }
    });

    test('blocks requests over limit', () => {
      const limiter = new SimpleRateLimiter(3, 60000);
      
      limiter.isAllowed('user1');
      limiter.isAllowed('user1');
      limiter.isAllowed('user1');
      
      expect(limiter.isAllowed('user1')).toBe(false);
    });

    test('different keys have separate limits', () => {
      const limiter = new SimpleRateLimiter(2, 60000);
      
      limiter.isAllowed('user1');
      limiter.isAllowed('user1');
      expect(limiter.isAllowed('user1')).toBe(false);
      
      // user2 should still be allowed
      expect(limiter.isAllowed('user2')).toBe(true);
    });
  });

  describe('Sharded Counter Logic', () => {
    // Test sharded counter calculation
    const getShardIndex = (entityId, numShards = 10) => {
      const hash = entityId.split('').reduce((acc, char) => {
        return ((acc << 5) - acc) + char.charCodeAt(0);
      }, 0);
      return Math.abs(hash) % numShards;
    };

    test('distributes entities across shards', () => {
      const shardCounts = new Array(10).fill(0);
      const entityIds = Array.from({ length: 100 }, (_, i) => `entity${i}`);
      
      entityIds.forEach(id => {
        const shard = getShardIndex(id);
        shardCounts[shard]++;
      });
      
      // Check distribution is reasonably balanced (no empty shards)
      shardCounts.forEach((count, idx) => {
        expect(count).toBeGreaterThan(0);
      });
    });

    test('same entity always maps to same shard', () => {
      const shard1 = getShardIndex('consistent-entity');
      const shard2 = getShardIndex('consistent-entity');
      
      expect(shard1).toBe(shard2);
    });
  });

  describe('Input Validation Helpers', () => {
    const validateUsername = (username) => {
      if (!username) return { valid: false, error: 'Username required' };
      if (username.length < 3) return { valid: false, error: 'Minimum 3 characters' };
      if (username.length > 30) return { valid: false, error: 'Maximum 30 characters' };
      if (!/^[a-zA-Z0-9_]+$/.test(username)) return { valid: false, error: 'Only letters, numbers, underscores' };
      return { valid: true };
    };

    const validateEmail = (email) => {
      if (!email) return { valid: false, error: 'Email required' };
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) return { valid: false, error: 'Invalid email format' };
      return { valid: true };
    };

    test('validates valid usernames', () => {
      expect(validateUsername('john_doe').valid).toBe(true);
      expect(validateUsername('User123').valid).toBe(true);
    });

    test('rejects invalid usernames', () => {
      expect(validateUsername('').valid).toBe(false);
      expect(validateUsername('ab').valid).toBe(false);
      expect(validateUsername('a'.repeat(31)).valid).toBe(false);
      expect(validateUsername('user@name').valid).toBe(false);
    });

    test('validates valid emails', () => {
      expect(validateEmail('test@example.com').valid).toBe(true);
      expect(validateEmail('user.name@domain.co.uk').valid).toBe(true);
    });

    test('rejects invalid emails', () => {
      expect(validateEmail('').valid).toBe(false);
      expect(validateEmail('not-an-email').valid).toBe(false);
      expect(validateEmail('@domain.com').valid).toBe(false);
    });
  });

  describe('E2E Encryption Helpers', () => {
    // Test the encryption key derivation pattern (not actual crypto)
    const deriveKey = (password, salt) => {
      // Simplified mock - real implementation uses PBKDF2
      const combined = password + salt;
      let hash = 0;
      for (let i = 0; i < combined.length; i++) {
        const char = combined.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
      }
      return Math.abs(hash).toString(16).padStart(16, '0');
    };

    test('derives consistent keys from same inputs', () => {
      const key1 = deriveKey('mypassword', 'salt123');
      const key2 = deriveKey('mypassword', 'salt123');
      
      expect(key1).toBe(key2);
    });

    test('different salts produce different keys', () => {
      const key1 = deriveKey('mypassword', 'salt123');
      const key2 = deriveKey('mypassword', 'salt456');
      
      expect(key1).not.toBe(key2);
    });

    test('different passwords produce different keys', () => {
      const key1 = deriveKey('password1', 'salt123');
      const key2 = deriveKey('password2', 'salt123');
      
      expect(key1).not.toBe(key2);
    });
  });

  describe('Offline Queue Logic', () => {
    const createOfflineQueue = () => {
      const queue = [];
      return {
        enqueue: (item) => queue.push(item),
        dequeue: () => queue.shift(),
        peek: () => queue[0],
        size: () => queue.length,
        isEmpty: () => queue.length === 0,
        clear: () => queue.length = 0
      };
    };

    test('enqueue adds items', () => {
      const queue = createOfflineQueue();
      queue.enqueue({ id: 1, data: 'test' });
      
      expect(queue.size()).toBe(1);
      expect(queue.peek().id).toBe(1);
    });

    test('dequeue removes items in FIFO order', () => {
      const queue = createOfflineQueue();
      queue.enqueue({ id: 1 });
      queue.enqueue({ id: 2 });
      queue.enqueue({ id: 3 });
      
      expect(queue.dequeue().id).toBe(1);
      expect(queue.dequeue().id).toBe(2);
      expect(queue.size()).toBe(1);
    });

    test('isEmpty returns true for empty queue', () => {
      const queue = createOfflineQueue();
      expect(queue.isEmpty()).toBe(true);
      
      queue.enqueue({ id: 1 });
      expect(queue.isEmpty()).toBe(false);
    });

    test('clear removes all items', () => {
      const queue = createOfflineQueue();
      queue.enqueue({ id: 1 });
      queue.enqueue({ id: 2 });
      queue.clear();
      
      expect(queue.isEmpty()).toBe(true);
      expect(queue.size()).toBe(0);
    });
  });

  describe('AIStudioService Upgrades (v8.0)', () => {
    let aiService;

    beforeAll(async () => {
      const mod = await import('../services/aiStudioService.js');
      aiService = mod.aiStudioService || mod.default;
    });

    test('correctly identifies toxic phrases in content moderation', () => {
      const toxicText = 'You are an absolute idiot and a complete retard!';
      const res = aiService.moderateOutput(toxicText);
      expect(res.flagged).toBe(true);
      expect(res.reason).toContain('contains blocked phrase');
    });

    test('passes clean texts through content moderation', () => {
      const cleanText = 'The beautiful night sky is glowing over the futuristic neon city of Arvdoul.';
      const res = aiService.moderateOutput(cleanText);
      expect(res.flagged).toBe(false);
    });

    test('generates highly structured video script with multi-scene cues', async () => {
      const script = await aiService.generateScript({ topic: 'artificial intelligence', style: 'tech', duration: 30 });
      expect(script.title).toContain('Master artificial intelligence');
      expect(script.targetDuration).toBe('30s');
      expect(script.scenes).toBeDefined();
      expect(script.scenes.length).toBeGreaterThan(0);
    });

    test('correctly calculates remaining daily AI budget and enforces limits', async () => {
      // Artificially inflate spend by adding a massive log entry
      aiService.usageLogs.push({
        timestamp: Date.now(),
        promptTokens: 10000,
        completionTokens: 20000,
        totalTokens: 30000,
        estimatedCost: 6.50 // Exceeds the $5 limit
      });

      const spend = aiService.getDailySpendUSD();
      expect(spend).toBeGreaterThan(5.00);

      // Call should immediately abort and trigger local fallback without fetch
      const result = await aiService._callOpenAI('Write some text');
      expect(result).toBeNull();

      // Clear test logs
      aiService.usageLogs = [];
    });
  });
});
