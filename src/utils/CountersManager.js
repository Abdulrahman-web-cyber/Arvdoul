/**
 * src/utils/CountersManager.js - ARVDOUL Sharded Counters Manager
 *
 * Replaces direct `increment()` on hot documents (likes, follows, views,
 * saves, gifts) with sharded counters. Each logical counter is spread over
 * N shard documents; writes hit a random shard (spreading write contention),
 * reads sum all shards and cache the result for a short TTL.
 *
 * Backward compatibility:
 * - If no shards exist for a counter, reads fall back to the legacy value
 *   on the source document (e.g. `post.stats.likes`), so existing data and
 *   callers keep working during migration.
 * - `incrementInTransaction()` lets callers keep their existing Firestore
 *   transaction while routing the counter write to a shard.
 *
 * New collection: `counter_shards` (migration plan in REFACTOR_PROGRESS.md).
 *
 * Zero new npm dependencies.
 */

import cacheManager from './CacheManager.js';
import { Logger } from './Logger.js';

const COUNTER_SHARDS_COLLECTION = 'counter_shards';
const SUM_CACHE_TTL_MS = 15 * 1000; // 15s cache for summed counters

function hashString(str) {
  let h = 5381;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) + h + str.charCodeAt(i)) >>> 0;
  }
  return h.toString(36);
}

class CountersManager {
  /**
   * @param {Object} opts
   * @param {number} [opts.shards=10]
   * @param {string} [opts.collection='counter_shards']
   */
  constructor({ shards = 10, collection = COUNTER_SHARDS_COLLECTION } = {}) {
    this.shards = shards;
    this.collection = collection;
    this.logger = new Logger({ name: 'counters' });
    this._firestore = null;
    this._methods = null;
  }

  async _ensure() {
    if (this._methods) return { firestore: this._firestore, m: this._methods };
    const [{ getFirestoreInstance }, firestoreModule] = await Promise.all([
      import('../firebase/firebase.js'),
      import('firebase/firestore'),
    ]);
    this._firestore = await getFirestoreInstance();
    this._methods = firestoreModule;
    return { firestore: this._firestore, m: this._methods };
  }

  _shardKey(docPath, field, shardIndex) {
    return `${hashString(docPath)}__${field}__${shardIndex}`;
  }

  _shardRef(firestore, docPath, field, shardIndex) {
    const { doc } = this._methods;
    return doc(firestore, this.collection, this._shardKey(docPath, field, shardIndex));
  }

  /**
   * Increment a sharded counter.
   * @param {Object} opts
   * @param {string} opts.docPath - full path of logical doc, e.g. 'posts/abc123'
   * @param {string} opts.field - counter field, e.g. 'likes'
   * @param {number} [opts.amount=1]
   * @returns {Promise<void>}
   */
  async increment({ docPath, field, amount = 1 }) {
    const { firestore, m } = await this._ensure();
    const shardIndex = Math.floor(Math.random() * this.shards);
    const ref = this._shardRef(firestore, docPath, field, shardIndex);
    await m.setDoc(ref, { value: m.increment(amount) }, { merge: true });
    cacheManager.delete('counters', `${docPath}:${field}`);
  }

  /**
   * Increment a sharded counter inside an existing Firestore transaction.
   * Use inside the transaction callback: `counters.incrementInTransaction(transaction, {...})`.
   * @param {Object} transaction - Firestore Transaction
   * @param {Object} opts - same as increment()
   */
  async incrementInTransaction(transaction, { docPath, field, amount = 1 }) {
    const { firestore, m } = await this._ensure();
    const shardIndex = Math.floor(Math.random() * this.shards);
    const ref = this._shardRef(firestore, docPath, field, shardIndex);
    transaction.set(ref, { value: m.increment(amount) }, { merge: true });
    cacheManager.delete('counters', `${docPath}:${field}`);
  }

  /**
   * Read the current counter value.
   * @param {Object} opts
   * @param {string} opts.docPath
   * @param {string} opts.field
   * @param {number} [opts.fallback] legacy value used when no shards exist
   * @returns {Promise<number>}
   */
  async get({ docPath, field, fallback = 0 }) {
    const cached = cacheManager.get('counters', `${docPath}:${field}`);
    if (cached !== null && cached !== undefined) return cached;

    const { firestore, m } = await this._ensure();
    const refs = [];
    for (let i = 0; i < this.shards; i++) refs.push(this._shardRef(firestore, docPath, field, i));

    // Read all shards in parallel (10 reads, cached for SUM_CACHE_TTL_MS).
    let total = 0;
    let found = 0;
    const reads = await Promise.all(refs.map((r) => m.getDoc(r)));
    reads.forEach((d) => {
      if (d.exists()) { total += (d.data().value || 0); found++; }
    });

    if (found === 0 && fallback) total = fallback;
    cacheManager.set('counters', `${docPath}:${field}`, total, SUM_CACHE_TTL_MS);
    return total;
  }

  /**
   * Overlay shard-backed counter values onto a fetched document object.
   * Mutates counters only when shards exist (else keeps legacy value).
   * @param {Object} opts
   * @param {Object} opts.data - fetched document data (may contain .stats)
   * @param {string} opts.docPath
   * @param {string[]} opts.fields - counter fields
   * @param {string} [opts.scope='stats'] - 'stats' writes data.stats[field],
   *   'top' writes data[field] (e.g. user.followerCount)
   * @returns {Promise<Object>} same data object
   */
  async apply({ data, docPath, fields, scope = 'stats' }) {
    if (!data || !Array.isArray(fields)) return data;
    if (scope === 'stats') data.stats = data.stats || {};
    for (const field of fields) {
      const legacy = (scope === 'stats' ? data.stats[field] : data[field]) || 0;
      const value = await this.get({ docPath, field, fallback: legacy });
      if (scope === 'stats') data.stats[field] = value;
      else data[field] = value;
    }
    return data;
  }

  /** Drop the cached sum (call after writes if you need immediate reads). */
  invalidate({ docPath, field }) {
    cacheManager.delete('counters', `${docPath}:${field}`);
  }
}

export { CountersManager };
export const countersManager = new CountersManager();
export default countersManager;
