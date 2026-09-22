/**
 * src/utils/shardedCounter.js - ARVDOUL Distributed Sharded Counter Engine
 * 
 * Solves Firestore's ~1 write/sec single-document limitation by distributing
 * high-velocity writes across N discrete shard documents.
 * Crucial for viral feeds, likes, views, followers, and creator tip counters.
 */

/**
 * Calculates a pseudo-random shard ID from 0 to numShards - 1
 * @param {number} numShards
 * @returns {string}
 */
export function getShardId(numShards = 10) {
  const safeShards = Math.max(1, Math.min(100, Math.floor(numShards)));
  const index = Math.floor(Math.random() * safeShards);
  return `shard_${index}`;
}

/**
 * In-memory distributed counter simulation / client helper
 */
export class DistributedShardedCounter {
  constructor(numShards = 10) {
    this.numShards = Math.max(1, Math.min(100, numShards));
    this.shards = new Map();
    for (let i = 0; i < this.numShards; i++) {
      this.shards.set(`shard_${i}`, 0);
    }
  }

  /**
   * Atomically increments a randomly picked shard with jitter
   * @param {number} delta
   * @returns {{ shardId: string, shardValue: number, total: number }}
   */
  increment(delta = 1) {
    const shardId = getShardId(this.numShards);
    const current = this.shards.get(shardId) || 0;
    const nextVal = current + delta;
    this.shards.set(shardId, nextVal);

    return {
      shardId,
      shardValue: nextVal,
      total: this.getTotal()
    };
  }

  /**
   * Sums all distributed shards to compute total value
   * @returns {number}
   */
  getTotal() {
    let total = 0;
    for (const val of this.shards.values()) {
      total += val;
    }
    return total;
  }

  /**
   * Resets all shards to 0
   */
  reset() {
    for (let i = 0; i < this.numShards; i++) {
      this.shards.set(`shard_${i}`, 0);
    }
  }

  /**
   * Dumps current shard distribution for load inspection
   */
  getDistribution() {
    const dist = {};
    for (const [k, v] of this.shards.entries()) {
      dist[k] = v;
    }
    return dist;
  }
}

/**
 * Generates Firestore-compatible subcollection reference path for sharded counters
 * @param {string} parentCollection
 * @param {string} parentDocId
 * @param {string} counterName
 * @param {number} numShards
 * @returns {{ path: string, shardId: string }}
 */
export function getFirestoreShardRef(parentCollection, parentDocId, counterName, numShards = 10) {
  const shardId = getShardId(numShards);
  return {
    path: `${parentCollection}/${parentDocId}/sharded_counters/${counterName}/shards/${shardId}`,
    shardId
  };
}

export default {
  getShardId,
  DistributedShardedCounter,
  getFirestoreShardRef
};
