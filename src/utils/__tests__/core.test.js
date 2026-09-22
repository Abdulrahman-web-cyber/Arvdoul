/**
 * ARVDOUL shared-utility unit tests.
 * Covers CacheManager, RateLimiter, IdempotencyStore, ErrorHandler, Logger.
 */
import { CacheManager } from '../CacheManager.js';
import { RateLimiter } from '../RateLimiter.js';
import { IdempotencyStore } from '../IdempotencyKey.js';
import { ErrorHandler, ERROR_RANGES } from '../ErrorHandler.js';
import { Logger } from '../Logger.js';

describe('CacheManager', () => {
  test('set/get round-trips with namespace', () => {
    const cm = new CacheManager({ maxSize: 10, defaultTtlMs: 60000 });
    cm.set('ns', 'k', { v: 1 });
    expect(cm.get('ns', 'k')).toEqual({ v: 1 });
    expect(cm.get('other', 'k')).toBeNull();
  });

  test('expires entries after TTL', () => {
    const cm = new CacheManager({ maxSize: 10, defaultTtlMs: 10 });
    cm.set('ns', 'k', 1);
    expect(cm.get('ns', 'k')).toBe(1);
    return new Promise((r) => setTimeout(() => {
      expect(cm.get('ns', 'k')).toBeNull();
      r();
    }, 30));
  });

  test('pattern invalidation supports wildcards', () => {
    const cm = new CacheManager();
    cm.set('analytics', 'user_abc_7d', 1);
    cm.set('analytics', 'user_abc_30d', 2);
    cm.set('analytics', 'user_xyz_7d', 3);
    cm.invalidatePattern('analytics:user_abc_*');
    expect(cm.get('analytics', 'user_abc_7d')).toBeNull();
    expect(cm.get('analytics', 'user_abc_30d')).toBeNull();
    expect(cm.get('analytics', 'user_xyz_7d')).toBe(3);
  });

  test('invalidateUser clears cross-namespace entries', () => {
    const cm = new CacheManager();
    cm.set('feed', 'user_abc', 1);
    cm.set('profile', 'user_abc', 2);
    cm.set('feed', 'user_xyz', 3);
    cm.invalidateUser('abc');
    expect(cm.get('feed', 'user_abc')).toBeNull();
    expect(cm.get('profile', 'user_abc')).toBeNull();
    expect(cm.get('feed', 'user_xyz')).toBe(3);
  });
});

describe('RateLimiter', () => {
  test('allows up to max then blocks', () => {
    const rl = new RateLimiter({ persist: false });
    const key = 'test:user1';
    for (let i = 0; i < 3; i++) {
      const r = rl.checkAndHit(key, { max: 3, windowMs: 60000 });
      expect(r.allowed).toBe(true);
    }
    const blocked = rl.checkAndHit(key, { max: 3, windowMs: 60000 });
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterMs).toBeGreaterThan(0);
  });

  test('reset clears the window', () => {
    const rl = new RateLimiter({ persist: false });
    rl.checkAndHit('k', { max: 1, windowMs: 60000 });
    rl.reset('k');
    expect(rl.checkAndHit('k', { max: 1, windowMs: 60000 }).allowed).toBe(true);
  });
});

describe('IdempotencyStore', () => {
  test('duplicate within TTL is rejected, released key re-accepted', () => {
    const store = new IdempotencyStore({ defaultTtlMs: 1000 });
    expect(store.checkAndRecord('op:1')).toBe(true);
    expect(store.checkAndRecord('op:1')).toBe(false);
    store.release('op:1');
    expect(store.checkAndRecord('op:1')).toBe(true);
  });
});

describe('ErrorHandler', () => {
  test('maps firebase codes to taxonomy codes', () => {
    const eh = new ErrorHandler();
    const err = new Error('nope');
    err.code = 'permission-denied';
    const enhanced = eh.enhance(err, { defaultMessage: 'Denied' });
    expect(enhanced.errorCode).toBe(3001);
    expect(enhanced.publicMessage).toBe('You do not have permission to perform this action.');
    expect(enhanced.correlationId).not.toBeNull();
  });

  test('unknown errors map to internal (6000)', () => {
    const eh = new ErrorHandler();
    const err = new Error('boom');
    const enhanced = eh.enhance(err, { defaultMessage: 'Ops' });
    expect(enhanced.errorCode).toBe(6000);
    expect(enhanced.publicMessage).toBe('Ops');
  });

  test('ERROR_RANGES defined', () => {
    expect(ERROR_RANGES.AUTH.start).toBe(2000);
    expect(ERROR_RANGES.RATE_LIMIT.start).toBe(5000);
  });
});

describe('Logger', () => {
  test('redacts secrets in metadata', () => {
    const logs = [];
    const orig = console.info;
    console.info = (str) => logs.push(str);
    const logger = new Logger({ name: 'test', level: 'debug', enabled: true });
    logger.info('login', { password: 'hunter2', apiKey: 'AIza123', email: 'a@b.c' });
    console.info = orig;
    expect(logs.length).toBe(1);
    const entry = JSON.parse(logs[0]);
    expect(entry.password).toBe('[REDACTED]');
    expect(entry.apiKey).toBe('[REDACTED]');
    expect(entry.email).toBe('a@b.c'); // PII flagged, not redacted (privacy-aware)
  });
});
