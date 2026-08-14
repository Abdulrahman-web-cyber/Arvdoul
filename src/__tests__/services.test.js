// Service layer unit tests
// These tests verify core service logic without Firebase dependencies

import { IdempotencyStore } from '../utils/IdempotencyKey';
import { safeSearchService } from '../services/safeSearchService.js';
import { scamDetectionService } from '../services/scamDetectionService.js';
import { searchAbuseService } from '../services/searchAbuseService.js';
import { searchIndexingService } from '../services/searchIndexingService.js';

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

  describe('SafeSearchService Upgrades (v8.0)', () => {
    test('correctly set/get safe search modes', () => {
      safeSearchService.setMode('strict');
      expect(safeSearchService.getMode()).toBe('strict');

      safeSearchService.setMode('off');
      expect(safeSearchService.getMode()).toBe('off');

      safeSearchService.setMode('moderate');
      expect(safeSearchService.getMode()).toBe('moderate');
    });

    test('redacts toxic phrases in queries under moderate/strict mode', () => {
      safeSearchService.setMode('strict');
      const sanitized = safeSearchService.sanitizeSearchQuery('Find user who said you are a retard');
      expect(sanitized).toContain('[redacted]');
    });

    test('filters NSFW items correctly under moderate mode', () => {
      safeSearchService.setMode('moderate');
      const items = [
        { title: 'Normal Post', isNsfw: false },
        { title: 'Adult Content', isNsfw: true }
      ];
      const filtered = safeSearchService.filterResults(items);
      expect(filtered.length).toBe(1);
      expect(filtered[0].title).toBe('Normal Post');
    });

    test('filters sensitive/nsfw/violence correctly under strict mode', () => {
      safeSearchService.setMode('strict');
      const items = [
        { title: 'Clean', isNsfw: false, isViolence: false, isSensitive: false },
        { title: 'Violence Post', isViolence: true },
        { title: 'Sensitive Post', isSensitive: true },
        { title: 'Racy Post', isRacy: true }
      ];
      const filtered = safeSearchService.filterResults(items);
      expect(filtered.length).toBe(1);
      expect(filtered[0].title).toBe('Clean');
    });
  });

  describe('ScamDetectionService Upgrades (v8.0)', () => {
    test('detects classic double-your-crypto scam', () => {
      const text = 'Send 1 BTC to this wallet and get 2 BTC back instantly guaranteed!';
      const res = scamDetectionService.evaluateScam(text);
      expect(res.isScam).toBe(true);
      expect(res.score).toBeGreaterThanOrEqual(60);
      expect(res.reasons.length).toBeGreaterThan(0);
    });

    test('detects seed phrase credential request threats', () => {
      const text = 'Official support here. Please send me your seed phrase and private key for verification.';
      const res = scamDetectionService.evaluateScam(text);
      expect(res.isScam).toBe(true);
      expect(res.score).toBeGreaterThanOrEqual(80);
    });

    test('ignores normal chat texts without scam markers', () => {
      const text = 'Hey buddy, let meet for lunch at our favorite pizza place around 1pm today.';
      const res = scamDetectionService.evaluateScam(text);
      expect(res.isScam).toBe(false);
      expect(res.score).toBe(0);
    });
  });

  describe('SearchAbuseService Upgrades (v8.0)', () => {
    test('enforces query length restriction limits', () => {
      const longQuery = 'a'.repeat(200);
      const res = searchAbuseService.validateSearchRequest('user123', longQuery);
      expect(res.allowed).toBe(false);
      expect(res.requiresCaptcha).toBe(true);
    });

    test('blocks sliding window search rate spikes', () => {
      searchAbuseService.resetAbuseCounters('user_temp');
      for (let i = 0; i < 30; i++) {
        const check = searchAbuseService.validateSearchRequest('user_temp', `Query ${i}`);
        expect(check.allowed).toBe(true);
      }
      const overLimit = searchAbuseService.validateSearchRequest('user_temp', 'One more search');
      expect(overLimit.allowed).toBe(false);
    });

    test('detects dictionary sequential letter sweeps and triggers captcha', () => {
      searchAbuseService.resetAbuseCounters('sweep_user');
      // alphabetical sequence sweeps
      searchAbuseService.validateSearchRequest('sweep_user', 'aaa');
      searchAbuseService.validateSearchRequest('sweep_user', 'aab');
      searchAbuseService.validateSearchRequest('sweep_user', 'aac');
      const sweepCheck = searchAbuseService.validateSearchRequest('sweep_user', 'aad');
      expect(sweepCheck.allowed).toBe(false);
      expect(sweepCheck.requiresCaptcha).toBe(true);
    });
  });

  describe('SearchIndexingService Upgrades (v8.0)', () => {
    test('generates edge n-grams for prefix matching', () => {
      const ngrams = searchIndexingService.generateNGrams('arvdoul');
      expect(ngrams).toContain('ar');
      expect(ngrams).toContain('arv');
      expect(ngrams).toContain('arvd');
    });

    test('filters out common stop words during tokenization', () => {
      const tokens = searchIndexingService.generateNGrams('this is the new post about arvdoul');
      expect(tokens).toContain('po');
      expect(tokens).toContain('pos');
      expect(tokens).not.toContain('th'); // 'this', 'the' are stopwords
    });

    test('calculates multi-field weighted popularity scores correctly', () => {
      const userDoc = searchIndexingService.buildSearchableDocument('user', {
        id: 'u123',
        followersCount: 100,
        likesCount: 50
      });
      // 100 * 1.0 + 50 * 0.2 = 110
      expect(userDoc.popularityScore).toBe(110);

      const postDoc = searchIndexingService.buildSearchableDocument('post', {
        id: 'p123',
        likesCount: 100,
        viewCount: 200
      });
      // 100 * 0.8 + 200 * 0.2 = 120
      expect(postDoc.popularityScore).toBe(120);
    });
  });
});
