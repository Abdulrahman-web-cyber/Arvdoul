// src/services/socialGraphService.js
//
// Canonical social-graph spine. Every system that needs "who is this to me"
// (profile, feed, stories, messaging permissions, notifications, analytics
// cohorts) resolves it here, so the graph is read one way.
//
// Scale contract (billion-user target):
//   * Single relationship  -> 6 bounded reads (follows x2 by id, blocks x2,
//     mute, restrict by actor-scoped `in`; empty result = no edge).
//   * Batch relationship   -> follow reads are `documentId() in` chunks (the
//     `follows` collection is world-readable); the safety edges
//     (blocks/mutes/restricts) are read with actor-equality + other-party `in`,
//     the shape their rules can prove (no N+1, no unbounded graph scan).
//   * List edges           -> bounded, index-backed, cursor-paged.
//   * List hydration       -> batched `users` reads chunked to 30 (never one
//     profile fetch per follower).
// Nothing in this module performs an unbounded `getDocs`.

import { logger } from '../utils/Logger.js';
import { getSafeAvatarUrl } from '../utils/avatarUtils.js';
import { resolveCapabilities } from './profileCapabilityEngine.js';
import { projectProfileForViewer, pickDisplayName, pickHandle, resolveCount } from './profileReadModel.js';
import { unknownNumber } from '../lib/unknownNumber';

/** Relationship edge kinds returned per target. */
export const EDGE_FLAGS = Object.freeze({
  FOLLOWING: 'isFollowing',
  FOLLOWER: 'isFollower',
  MUTUAL: 'isMutualFriend',
  BLOCKING: 'isBlocking',
  BLOCKED_BY: 'isBlockedBy',
  MUTED: 'isMuted',
  RESTRICTED: 'isRestricted',
});

/** Collections backing each safety/relationship edge. */
const EDGE_COLLECTIONS = Object.freeze({
  follow: 'follows',
  block: 'blocks',
  mute: 'mutes',
  restrict: 'restricts',
});

/**
 * Actor-scoped read specs for the safety edges. Firestore rules are not
 * filters: a list query is authorised against the rule condition, and
 * `blocks`/`mutes`/`restricts` authorise on `resource.data.<actorField> ==
 * uid()`. A `documentId() in [...]` query cannot prove that condition, so the
 * read is denied and the whole batch silently degrades to "no relation" —
 * losing block/mute masking on every follower list. Constraining the actor
 * field with `==` (and the other party with `in`) is provable, so the read is
 * allowed. `follows` is world-readable, so its id-only read stays valid.
 */
const EDGE_ACTOR_SPECS = Object.freeze({
  follow: {
    out: { collection: 'follows', actorField: 'followerId', otherField: 'followingId' },
    in: { collection: 'follows', actorField: 'followingId', otherField: 'followerId' },
  },
  block: {
    out: { collection: 'blocks', actorField: 'blockerId', otherField: 'blockedId' },
    in: { collection: 'blocks', actorField: 'blockedId', otherField: 'blockerId' },
  },
  mute: { out: { collection: 'mutes', actorField: 'muterId', otherField: 'mutedId' } },
  restrict: { out: { collection: 'restricts', actorField: 'restricterId', otherField: 'restrictedId' } },
});

// Firestore caps an `in` filter at 30 values; every batch read chunks to this.
const IN_CHUNK = 30;
const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 100;
const EDGE_CACHE_TTL_MS = 60 * 1000;
const LIST_CACHE_TTL_MS = 30 * 1000;
const MAX_HYDRATE_IDS = 100;
// Mutual-friend resolution pages the following list and keeps follow-backs;
// cap the scan so a user who follows thousands but is followed by few does not
// turn one call into an unbounded walk.
const MUTUAL_SCAN_PAGES = 5;

const LIST_SPECS = Object.freeze({
  followers: { collection: 'follows', field: 'followingId', order: 'followerId', pick: 'followerId' },
  following: { collection: 'follows', field: 'followerId', order: 'followingId', pick: 'followingId' },
  friends: { collection: 'follows', field: 'followerId', order: 'followingId', pick: 'followingId' },
  blocked: { collection: 'blocks', field: 'blockerId', order: 'blockedId', pick: 'blockedId' },
  // The reverse direction of a block: users who block `userId`. Read with an
  // actor-equality + single-order query (`blockedId == userId`), the shape the
  // blocks rule proves (`resource.data.blockedId == uid()`). A viewer who is
  // blocked by someone must not see their content in search/explore.
  blocked_by: { collection: 'blocks', field: 'blockedId', order: 'blockerId', pick: 'blockerId' },
  muted: { collection: 'mutes', field: 'muterId', order: 'mutedId', pick: 'mutedId' },
  restricted: { collection: 'restricts', field: 'restricterId', order: 'restrictedId', pick: 'restrictedId' },
});

// Edge kinds that are a viewer's own safety-management lists, not a social
// surface: a block/mute/restrict must stay visible in the list that manages it.
const SAFETY_EDGE_KINDS = new Set(['blocked', 'blocked_by', 'muted', 'restricted']);

function emptyEdge(uid = null, isOwner = false) {
  return {
    uid,
    isOwner,
    isFollowing: false,
    isFollower: false,
    isMutualFriend: false,
    isBlocking: false,
    isBlockedBy: false,
    isBlocked: false,
    isMuted: false,
    isRestricted: false,
    requestStatus: null,
  };
}

class SocialGraphService {
  constructor() {
    this.firestore = null;
    this.initialized = false;
    this.edgeCache = new Map();
    this.listCache = new Map();
    this.presenceCache = new Map();
    this.inflight = new Map();
  }

  async initialize() {
    if (this.initialized) return this.firestore;
    const firebase = await import('../firebase/firebase.js');
    this.firestore = await firebase.getFirestoreInstance();
    this.initialized = true;
    return this.firestore;
  }

  async _ensureInitialized() {
    if (!this.initialized || !this.firestore) await this.initialize();
    return this.firestore;
  }

  _chunk(items, size) {
    const out = [];
    for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
    return out;
  }

  _readCache(store, key, ttl) {
    const entry = store.get(key);
    if (entry && Date.now() - entry.timestamp < ttl) return entry.data;
    if (entry) store.delete(key);
    return null;
  }

  _writeCache(store, key, data) {
    store.set(key, { data, timestamp: Date.now() });
  }

  /** Drop every cached edge/list/presence entry that involves the user (call on follow/block/etc.). */
  invalidate(userId) {
    if (!userId) return;
    for (const key of [...this.edgeCache.keys()]) {
      if (key.includes(userId)) this.edgeCache.delete(key);
    }
    for (const key of [...this.listCache.keys()]) {
      if (key.includes(userId)) this.listCache.delete(key);
    }
    for (const key of [...this.presenceCache.keys()]) {
      if (key === userId || key.includes(userId)) this.presenceCache.delete(key);
    }
  }

  clearCache() {
    this.edgeCache.clear();
    this.listCache.clear();
    this.presenceCache.clear();
  }

  /** Existing document ids for a list of candidate doc ids, batched in chunks of 30. */
  async _existingIds(collectionName, ids) {
    const { collection, query, where, getDocs, documentId, limit: fLimit } = await import('firebase/firestore');
    const found = new Set();
    const unique = [...new Set(ids)];
    for (const chunk of this._chunk(unique, IN_CHUNK)) {
      if (chunk.length === 0) continue;
      const snap = await getDocs(
        query(
          collection(this.firestore, collectionName),
          where(documentId(), 'in', chunk),
          fLimit(chunk.length)
        )
      );
      snap.forEach((d) => found.add(d.id));
    }
    return found;
  }

  /**
   * Read the edges where `viewerId` is the actor and the other party is one of
   * `otherIds`. `blocks`/`mutes`/`restricts` rules authorise on
   * `resource.data.<actorField> == uid()`, which a `documentId() in [...]`
   * query cannot prove — so we constrain the actor field with `==` and the
   * other party with `in`. Chunked to 30 for the `in` cap. Returns the set of
   * `${actorId}_${otherId}` keys.
   */
  async _actorScopedIds(viewerId, otherIds, { collection: collectionName, actorField, otherField, equals = null }) {
    const { collection, query, where, getDocs, limit: fLimit } = await import('firebase/firestore');
    const found = new Set();
    const unique = [...new Set(otherIds)].filter(Boolean);
    for (const chunk of this._chunk(unique, IN_CHUNK)) {
      if (chunk.length === 0) continue;
      const constraints = [
        collection(this.firestore, collectionName),
        where(actorField, '==', viewerId),
        where(otherField, 'in', chunk),
      ];
      for (const [field, value] of Object.entries(equals || {})) {
        constraints.push(where(field, '==', value));
      }
      // Keep the cap inline in the `query(...)` argument list: the Firebase cost
      // analyzer reads the call site textually, so a hoisted limit reads as an
      // unbounded collection read.
      let timerId;
      const snap = await Promise.race([
        getDocs(query(...constraints, fLimit(chunk.length))),
        new Promise((_, reject) => {
          timerId = setTimeout(() => reject(new Error(`SocialGraph query timeout (${collectionName})`)), 4500);
        }),
      ]).finally(() => {
        if (timerId) clearTimeout(timerId);
      });
      snap.forEach((d) => {
        const data = d.data() || {};
        const other = data[otherField];
        if (other) found.add(`${viewerId}_${other}`);
      });
    }
    return found;
  }

  /**
   * Resolve the relationship between `viewerId` and a single `targetId`.
   * Bounded: one actor-scoped list query per edge family (follow out/in,
   * block out/in, mute, restrict), each a single-value `in`. Point reads of the
   * safety edges are avoided on purpose: a missing edge makes a `resource.data`
   * rule evaluate to a permission error, so a point read cannot answer "are we
   * blocked?" (N033).
   */
  async getRelationship(viewerId, targetId) {
    if (!viewerId || !targetId) return emptyEdge(targetId);
    if (viewerId === targetId) return { ...emptyEdge(targetId, true), canMessage: true, canViewPrivate: true };

    const cacheKey = `edge_${viewerId}_${targetId}`;
    const cached = this._readCache(this.edgeCache, cacheKey, EDGE_CACHE_TTL_MS);
    if (cached) return cached;

    const existingInflight = this.inflight.get(cacheKey);
    if (existingInflight) return existingInflight;

    const req = (async () => {
      try {
        await this._ensureInitialized();
        const fetchAllEdges = () => Promise.all([
          this._actorScopedIds(viewerId, [targetId], EDGE_ACTOR_SPECS.follow.out),
          this._actorScopedIds(viewerId, [targetId], EDGE_ACTOR_SPECS.follow.in),
          this._actorScopedIds(viewerId, [targetId], EDGE_ACTOR_SPECS.block.out),
          this._actorScopedIds(viewerId, [targetId], EDGE_ACTOR_SPECS.block.in),
          this._actorScopedIds(viewerId, [targetId], EDGE_ACTOR_SPECS.mute.out),
          this._actorScopedIds(viewerId, [targetId], EDGE_ACTOR_SPECS.restrict.out),
          // A follow against a private target files `follow_requests/{from}_{to}`
          // with `status: 'pending'` and no follow edge; the capability engine
          // needs that state to render Requested rather than an open Follow.
          this._actorScopedIds(viewerId, [targetId], {
            collection: 'follow_requests',
            actorField: 'fromUserId',
            otherField: 'toUserId',
            equals: { status: 'pending' },
          }),
        ]);
        let results;
        try {
          results = await fetchAllEdges();
        } catch (firstErr) {
          const msg = String(firstErr?.message || '').toLowerCase();
          const code = String(firstErr?.code || '').toLowerCase();
          const isTransient = msg.includes('timeout') || code === 'unavailable' || code === 'deadline-exceeded';
          if (!isTransient) throw firstErr;
          await new Promise((r) => setTimeout(r, 300));
          results = await fetchAllEdges();
        }
        const [followOut, followIn, blockOut, blockIn, muteOut, restrictOut, pendingOut] = results;
        const isFollowing = followOut.has(`${viewerId}_${targetId}`);
        const isFollower = followIn.has(`${viewerId}_${targetId}`);
        const isBlocking = blockOut.has(`${viewerId}_${targetId}`);
        const isBlockedBy = blockIn.has(`${viewerId}_${targetId}`);
        const edge = {
          uid: targetId,
          isFollowing,
          isFollower,
          isMutualFriend: isFollowing && isFollower,
          isBlocking,
          isBlockedBy,
          isBlocked: isBlocking || isBlockedBy,
          isMuted: muteOut.has(`${viewerId}_${targetId}`),
          isRestricted: restrictOut.has(`${viewerId}_${targetId}`),
          requestStatus: pendingOut.has(`${viewerId}_${targetId}`) ? 'pending' : null,
        };
        this._writeCache(this.edgeCache, cacheKey, edge);
        return edge;
      } catch (err) {
        // Relationship state includes blocks/mutes/restricts. Returning an empty
        // edge on a failed read would turn a permission/network failure into an
        // authorization bypass. Let callers fail closed instead.
        logger.warn('[SocialGraph] relationship read failed', { viewerId, targetId, error: err?.message });
        throw err;
      } finally {
        this.inflight.delete(cacheKey);
      }
    })();

    this.inflight.set(cacheKey, req);
    return req;
  }

  /**
   * Batch-resolve the relationship between `viewerId` and many targets.
   * Bounded: follow reads are id-set based (chunked to 30); the safety edges
   * (block/mute/restrict) are read with the actor-equality + other-party-`in`
   * shape the rules can prove, so a denied list query can never silently drop
   * block/mute masking.
   */
  async getEdgeSet(viewerId, targetIds, options = {}) {
    const include = options.include || ['follow', 'block', 'mute', 'restrict'];
    const targets = [...new Set((targetIds || []).filter(Boolean))];
    const result = new Map();
    for (const t of targets) result.set(t, emptyEdge(t, t === viewerId));
    if (!viewerId) return result;

    const others = targets.filter((t) => t !== viewerId);
    if (others.length === 0) return result;

    // Reuse complete edgeCache hits first so repeat visits / ConnectionsScreen follow-state
    // lookups avoid duplicate Firestore reads for already-resolved targets.
    const uncachedOthers = [];
    for (const t of others) {
      const cached = this._readCache(this.edgeCache, `edge_${viewerId}_${t}`, EDGE_CACHE_TTL_MS);
      if (cached) {
        result.set(t, cached);
      } else {
        uncachedOthers.push(t);
      }
    }
    if (uncachedOthers.length === 0) return result;

    const currentAuthUid = this.auth?.currentUser?.uid || null;
    // Only query `follow_requests` for the signed-in viewer, because Firestore rules
    // scope `follow_requests` reads to `fromUserId == request.auth.uid`.
    const allowRequestRead = options.includeRequests !== false && (!currentAuthUid || currentAuthUid === viewerId);
    const needFollow = include.includes('follow');
    const pendingRequestSpec = needFollow && allowRequestRead
      ? {
          collection: 'follow_requests',
          actorField: 'fromUserId',
          otherField: 'toUserId',
          equals: { status: 'pending' },
        }
      : null;
    const needBlock = include.includes('block');
    const needMute = include.includes('mute');
    const needRestrict = include.includes('restrict');
    const isFullEdge = needFollow && needBlock && needMute && needRestrict;

    try {
      await this._ensureInitialized();

      const [followOut, followIn, blockOut, blockIn, muteOut, restrictOut, pendingOut] = await Promise.all([
        needFollow ? this._actorScopedIds(viewerId, uncachedOthers, EDGE_ACTOR_SPECS.follow.out) : Promise.resolve(new Set()),
        needFollow ? this._actorScopedIds(viewerId, uncachedOthers, EDGE_ACTOR_SPECS.follow.in) : Promise.resolve(new Set()),
        needBlock ? this._actorScopedIds(viewerId, uncachedOthers, EDGE_ACTOR_SPECS.block.out) : Promise.resolve(new Set()),
        needBlock ? this._actorScopedIds(viewerId, uncachedOthers, EDGE_ACTOR_SPECS.block.in) : Promise.resolve(new Set()),
        needMute ? this._actorScopedIds(viewerId, uncachedOthers, EDGE_ACTOR_SPECS.mute.out) : Promise.resolve(new Set()),
        needRestrict ? this._actorScopedIds(viewerId, uncachedOthers, EDGE_ACTOR_SPECS.restrict.out) : Promise.resolve(new Set()),
        pendingRequestSpec
          ? this._actorScopedIds(viewerId, uncachedOthers, pendingRequestSpec)
          : Promise.resolve(new Set()),
      ]);

      for (const t of uncachedOthers) {
        const isFollowing = followOut.has(`${viewerId}_${t}`);
        const isFollower = followIn.has(`${viewerId}_${t}`);
        const isBlocking = blockOut.has(`${viewerId}_${t}`);
        const isBlockedBy = blockIn.has(`${viewerId}_${t}`);
        const edge = {
          uid: t,
          isFollowing,
          isFollower,
          isMutualFriend: isFollowing && isFollower,
          isBlocking,
          isBlockedBy,
          isBlocked: isBlocking || isBlockedBy,
          isMuted: muteOut.has(`${viewerId}_${t}`),
          isRestricted: restrictOut.has(`${viewerId}_${t}`),
          requestStatus: pendingOut.has(`${viewerId}_${t}`) ? 'pending' : null,
        };
        result.set(t, edge);
        // Only write complete relationship snapshots to edgeCache so a partial
        // `{ include: ['follow'] }` lookup never caches false block/mute flags.
        if (isFullEdge) {
          this._writeCache(this.edgeCache, `edge_${viewerId}_${t}`, edge);
        }
      }
    } catch (err) {
      // A partial/empty map would silently erase block and mute state for the
      // entire batch. Never return a successful-looking graph on read failure.
      logger.warn('[SocialGraph] batch edge read failed', { viewerId, count: uncachedOthers.length, error: err?.message });
      throw err;
    }
    return result;
  }

  /** Canonical friendship: both follow edges exist. */
  async areFriends(a, b) {
    if (!a || !b || a === b) return false;
    const edge = await this.getRelationship(a, b);
    return Boolean(edge.isFollowing && edge.isFollower);
  }

  /**
   * Bounded, index-backed, cursor-paged edge id list.
   * @param {string} userId
   * @param {'followers'|'following'|'blocked'|'muted'|'restricted'} kind
   */
  async listEdges(userId, kind, { limit = DEFAULT_PAGE_SIZE, cursor = null } = {}) {
    const spec = LIST_SPECS[kind];
    if (!spec) throw new Error(`Unknown edge kind: ${kind}`);
    if (!userId) return { ids: [], hasMore: false, nextCursor: null };

    const size = Math.min(Math.max(1, Number(limit) || DEFAULT_PAGE_SIZE), MAX_PAGE_SIZE);
    const cacheKey = `list_${kind}_${userId}_${size}_${cursor?.id || ''}`;
    const cached = this._readCache(this.listCache, cacheKey, LIST_CACHE_TTL_MS);
    if (cached) return cached;

    await this._ensureInitialized();
    const { collection, query, where, orderBy, limit: fLimit, startAfter, getDocs } = await import('firebase/firestore');
    const snap = await getDocs(query(
      collection(this.firestore, spec.collection),
      where(spec.field, '==', userId),
      orderBy(spec.order),
      fLimit(size),
      ...(cursor ? [startAfter(cursor)] : [])
    ));
    const ids = snap.docs.map((d) => d.data()[spec.pick]).filter(Boolean);
    const hasMore = snap.docs.length === size;
    const result = {
      ids,
      hasMore,
      nextCursor: hasMore ? snap.docs[snap.docs.length - 1] : null,
      count: ids.length,
    };
    this._writeCache(this.listCache, cacheKey, result);
    return result;
  }

  _normalizeProfile(raw) {
    if (!raw) return null;
    const displayName = pickDisplayName([raw.displayName, raw.name], { fallback: null })
      || `user ${String(raw.id || raw.uid || '').slice(0, 6)}`;
    const username = pickHandle([raw.username, raw.handle]) || '';
    const lastActive = raw.lastActive?.toDate ? raw.lastActive.toDate() : (raw.lastActive ? new Date(raw.lastActive) : null);
    const isRecent = Boolean(lastActive && Date.now() - lastActive.getTime() < 5 * 60 * 1000);
    const isOnline = Boolean(raw.isOnline && isRecent);
    return {
      ...raw,
      id: raw.id || raw.uid,
      uid: raw.uid || raw.id,
      displayName,
      username,
      photoURL: getSafeAvatarUrl(raw.photoURL, displayName, raw.uid || raw.id || ''),
      followerCount: resolveCount(raw.followerCount, raw.followersCount),
      followingCount: resolveCount(raw.followingCount),
      postCount: resolveCount(raw.postCount, raw.postsCount),
      presence: {
        isOnline,
        status: isOnline ? 'online' : 'offline',
        lastActive: lastActive ? lastActive.toISOString() : null,
      },
    };
  }

  /**
   * Project one raw `users/{uid}` document for a viewer, applying the capability
   * decision exactly once. Shared by hydration and any single-profile surface.
   */
  projectProfile(raw, viewerId = null, edge = null) {
    if (!raw) return null;
    const uid = raw.uid || raw.id;
    const isOwner = Boolean(viewerId && viewerId === uid);
    const normalized = this._normalizeProfile(raw);
    const capabilities = resolveCapabilities({
      viewer: viewerId ? { uid: viewerId } : null,
      target: normalized,
      relationship: { isOwner, ...(edge || {}) },
    });
    return projectProfileForViewer(normalized, capabilities, { isOwner });
  }

  /**
   * Batched profile hydration. One `documentId() in` read per 30 ids — never one
   * profile fetch per follower.
   */
  async hydrateProfiles(userIds, { viewerId = null, edges = null, withPresence = false } = {}) {
    const ids = [...new Set((userIds || []).filter(Boolean))].slice(0, MAX_HYDRATE_IDS);
    if (ids.length === 0) return [];
    await this._ensureInitialized();
    const { collection, query, where, getDocs, documentId, limit: fLimit } = await import('firebase/firestore');

    const byId = new Map();
    for (const chunk of this._chunk(ids, IN_CHUNK)) {
      const snap = await getDocs(
        query(
          collection(this.firestore, 'users'),
          where(documentId(), 'in', chunk),
          fLimit(chunk.length)
        )
      );
      snap.forEach((d) => byId.set(d.id, { id: d.id, uid: d.id, ...d.data() }));
    }

    // Presence lives in its own scope-gated doc (`user_presence/{uid}`), which
    // the rules authorize per viewer. A batch `documentId() in` read cannot
    // prove a per-document `get()` condition, so presence is hydrated with
    // bounded per-doc reads and only for callers that render it (opt-in).
    if (withPresence) {
      const presence = await this._fetchPresenceMap(ids);
      for (const [id, p] of presence) {
        const raw = byId.get(id);
        if (raw) { raw.isOnline = p.isOnline; raw.lastActive = p.lastActive; }
      }
    }

    const edgeMap = edges || (viewerId ? await this.getEdgeSet(viewerId, ids) : new Map());
    return ids
      .map((id) => byId.get(id))
      .filter(Boolean)
      .map((raw) => this.projectProfile(raw, viewerId, edgeMap.get(raw.id)));
  }

  /**
   * Per-document presence for a bounded id list. A denied (scope) or failed
   * read is omitted, so the projection renders the target offline — never a
   * fabricated "online". Honest online = flag set AND activity within 5 min.
   */
  async _fetchPresenceMap(ids) {
    const map = new Map();
    if (!ids.length) return map;
    const missingIds = [];
    for (const id of ids) {
      const cached = this._readCache(this.presenceCache, id, LIST_CACHE_TTL_MS);
      if (cached) {
        if (cached.present) map.set(id, cached.value);
      } else {
        missingIds.push(id);
      }
    }
    if (!missingIds.length) return map;

    const { doc, getDoc } = await import('firebase/firestore');
    await Promise.all(missingIds.map(async (id) => {
      const inflightKey = `presence_${id}`;
      let req = this.inflight.get(inflightKey);
      if (!req) {
        req = (async () => {
          try {
            const snap = await getDoc(doc(this.firestore, 'user_presence', id));
            if (!snap.exists()) {
              this._writeCache(this.presenceCache, id, { present: false });
              return null;
            }
            const d = snap.data();
            const la = d.lastActive?.toDate ? d.lastActive.toDate() : (d.lastActive ? new Date(d.lastActive) : null);
            const recent = Boolean(la && Date.now() - la.getTime() < 5 * 60 * 1000);
            const value = { isOnline: Boolean(d.isOnline && recent), lastActive: la };
            this._writeCache(this.presenceCache, id, { present: true, value });
            return value;
          } catch (e) {
            logger.debug('[SocialGraph] presence read skipped', { id, error: e?.message });
            return null;
          } finally {
            this.inflight.delete(inflightKey);
          }
        })();
        this.inflight.set(inflightKey, req);
      }
      const value = await req;
      if (value) map.set(id, value);
    }));
    return map;
  }

  /**
   * Public presence map for a bounded id list: `Map<uid, { isOnline, lastActive }>`.
   * This is the only sanctioned way for a surface (the inbox) to render an
   * online dot, so presence is read from the one scope-gated `user_presence`
   * doc the rules authorize — never re-derived from a different collection
   * (the messaging RTDB `status/` path is dead; N452).
   */
  async getPresenceMap(userIds) {
    const ids = [...new Set((userIds || []).filter(Boolean))].slice(0, MAX_HYDRATE_IDS);
    if (!ids.length) return new Map();
    await this._ensureInitialized();
    return this._fetchPresenceMap(ids);
  }

  /** List a relationship kind with hydrated, viewer-projected profiles. */
  async listConnections(userId, kind, { viewerId = null, limit = DEFAULT_PAGE_SIZE, cursor = null } = {}) {
    const { ids, hasMore, nextCursor } = await this.listEdges(userId, kind, { limit, cursor });
    // A blocked/blocked-by/muted user must not appear in the viewer's own
    // follower/following/friends list — masking hides the bio but the row still
    // leaks the account. The safety-management lists (`blocked`/`muted`/
    // `restricted`) are the exception: hiding a blocked user there would make
    // the block impossible to review or lift.
    const isSafetyList = SAFETY_EDGE_KINDS.has(kind);
    const hidden = viewerId && !isSafetyList ? await this.getHiddenAuthorIds(viewerId) : null;
    const visibleIds = hidden ? ids.filter((id) => id !== viewerId && !hidden.has(id)) : ids;
    // The connections screen renders an online dot, so hydrate presence too.
    const connections = await this.hydrateProfiles(visibleIds, { viewerId, withPresence: true });
    return { success: true, connections, hasMore, nextCursor, count: connections.length };
  }

  /**
   * Mutual connections (a "friend" = a mutual follow). Pages the following
   * edges, keeps the ids that follow back, then hydrates them. Bounded by
   * MUTUAL_SCAN_PAGES so cost cannot grow with an asymmetric graph.
   */
  async listMutualConnections(userId, { viewerId = null, limit = DEFAULT_PAGE_SIZE, cursor = null } = {}) {
    if (!userId) return { success: true, connections: [], hasMore: false, nextCursor: null, count: 0 };
    const size = Math.min(Math.max(1, Number(limit) || DEFAULT_PAGE_SIZE), MAX_PAGE_SIZE);
    const mutualIds = [];
    let pageCursor = cursor;
    let hasMore = false;
    let pages = 0;
    while (mutualIds.length < size && pages < MUTUAL_SCAN_PAGES) {
      const page = await this.listEdges(userId, 'following', { limit: size, cursor: pageCursor });
      if (page.ids.length === 0) { hasMore = false; break; }
      const edgeMap = await this.getEdgeSet(userId, page.ids, {
        include: ['follow'],
        includeRequests: false,
      });
      for (const id of page.ids) {
        if (mutualIds.length >= size) break;
        if (edgeMap.get(id)?.isMutualFriend) mutualIds.push(id);
      }
      hasMore = page.hasMore;
      pageCursor = page.nextCursor;
      pages++;
      if (!page.hasMore) break;
    }
    const hidden = viewerId ? await this.getHiddenAuthorIds(viewerId) : null;
    const visibleIds = hidden ? mutualIds.filter((id) => id !== viewerId && !hidden.has(id)) : mutualIds;
    const connections = await this.hydrateProfiles(visibleIds, { viewerId: viewerId || userId });
    return { success: true, connections, hasMore, nextCursor: pageCursor, count: connections.length };
  }

  /** Mutual connections, server-authoritative when the callable is available. */
  async getMutualConnections(viewerId, targetId, { limit = 20 } = {}) {
    if (!viewerId || !targetId || viewerId === targetId) return [];
    // A blocked/blocked-by/muted user must never appear in the viewer's mutual
    // list — the callable and the local fallback both returned the raw set, so
    // a blocked party leaked back through the "mutual friends" surface.
    const hidden = await this.getHiddenAuthorIds(viewerId);
    const isVisible = (p) => {
      const id = p?.uid || p?.id;
      return id && id !== viewerId && !hidden.has(id);
    };
    try {
      const { callFunction, FUNCTIONS } = await import('./callableService.js');
      const data = await callFunction(FUNCTIONS.GET_MUTUAL_FRIENDS, { userId: viewerId, otherUserId: targetId });
      const mutual = data?.mutualFriends || [];
      // Empty successful results are authoritative; do not issue a duplicate
      // client-side query after the callable has completed.
      return mutual.filter(isVisible);
    } catch (err) {
      // An authorization denial must never fall through to a local read.
      if (err?.code === 'functions/permission-denied' || err?.code === 'permission-denied') throw err;
      logger.debug('[SocialGraph] mutual fallback', { error: err?.message });
    }
    const [a, b] = await Promise.all([
      this.listEdges(viewerId, 'following', { limit: 50 }),
      this.listEdges(targetId, 'following', { limit: 50 }),
    ]);
    const bSet = new Set(b.ids);
    const mutualIds = a.ids.filter((id) => bSet.has(id) && id !== viewerId && !hidden.has(id)).slice(0, limit);
    return this.hydrateProfiles(mutualIds, { viewerId });
  }

  /**
   * Ids whose content/suggestions the viewer must never see: users the viewer
   * blocked, users who blocked the viewer (reverse block — otherwise a blocker
   * leaks back into the viewer's surfaces), and users the viewer muted. Read
   * through the spine's bounded, rules-provable edge lists. A failed safety
   * read rejects so callers can withhold the surface rather than leak rows.
   */
  async getHiddenAuthorIds(userId) {
    if (!userId) return new Set();
    const cacheKey = `hidden_${userId}`;
    const cached = this._readCache(this.listCache, cacheKey, LIST_CACHE_TTL_MS);
    if (cached) return new Set(cached);

    const existingInflight = this.inflight.get(cacheKey);
    if (existingInflight) return existingInflight;

    const req = (async () => {
      try {
        const [blocked, blockedBy, muted] = await Promise.all([
          this._collectEdgesBounded(userId, 'blocked', 5000),
          this._collectEdgesBounded(userId, 'blocked_by', 5000),
          this._collectEdgesBounded(userId, 'muted', 5000),
        ]);
        if (!blocked.complete || !blockedBy.complete || !muted.complete) {
          throw new Error('Safety relationship list exceeded the bounded scan limit; results withheld');
        }
        const hiddenSet = new Set([...blocked.ids, ...blockedBy.ids, ...muted.ids]);
        this._writeCache(this.listCache, cacheKey, [...hiddenSet]);
        return hiddenSet;
      } catch (err) {
        logger.warn('[SocialGraph] hidden-author read failed; withholding results', { error: err?.message });
        throw err;
      } finally {
        this.inflight.delete(cacheKey);
      }
    })();

    this.inflight.set(cacheKey, req);
    return req;
  }

  /**
   * Collect a cursor-paged relationship list up to a hard cap. A full final
   * page is followed by a one-row probe so exact-cap and truncated lists differ.
   */
  async _collectEdgesBounded(userId, kind, maxEdges) {
    const cap = Math.max(1, Math.min(Number(maxEdges) || 1, 5000));
    const ids = [];
    let cursor = null;
    while (true) {
      const remaining = cap - ids.length;
      const page = await this.listEdges(userId, kind, {
        limit: remaining > 0 ? Math.min(MAX_PAGE_SIZE, remaining) : 1,
        cursor,
      });
      if (remaining <= 0) return { ids, complete: page.ids.length === 0 };
      ids.push(...page.ids);
      if (!page.hasMore) return { ids, complete: true };
      if (!page.nextCursor) return { ids, complete: false };
      cursor = page.nextCursor;
    }
  }

  /** Friend suggestions, server-authoritative when the callable is available.
   *  Blocked/blocked-by/muted users are excluded from both paths. */
  async getSuggestions(userId, { limit = 20 } = {}) {
    if (!userId) return [];
    // A blocked, blocked-by or muted user must never be suggested — the
    // server callable and the friends-of-friends fallback both ran without a
    // safety filter, so a blocker could reappear in the viewer's list.
    const hidden = await this.getHiddenAuthorIds(userId);
    const isHidden = (id) => !id || id === userId || hidden.has(id);
    try {
      const { callFunction, FUNCTIONS } = await import('./callableService.js');
      const data = await callFunction(FUNCTIONS.GENERATE_FRIEND_RECOMMENDATIONS, { userId, limit });
      const recs = data?.recommendations || [];
      if (recs.length > 0) {
        const ids = recs.map((r) => r.userId || r.id || r.uid).filter((id) => !isHidden(id));
        return ids.length ? await this.hydrateProfiles(ids, { viewerId: userId }) : [];
      }
    } catch (err) {
      logger.debug('[SocialGraph] suggestions fallback', { error: err?.message });
    }
    // Bounded fallback: friends-of-friends sampled from a capped following list.
    const mine = await this.listEdges(userId, 'following', { limit: 50 });
    if (mine.ids.length === 0) return [];
    const mySet = new Set(mine.ids);
    const sample = mine.ids.slice(0, 10);
    const candidateCounts = new Map();
    const pages = await Promise.allSettled(sample.map((fid) => this.listEdges(fid, 'following', { limit: 30 })));
    for (const res of pages) {
      if (res.status !== 'fulfilled' || !Array.isArray(res.value?.ids)) continue;
      for (const candId of res.value.ids) {
        if (isHidden(candId) || mySet.has(candId)) continue;
        candidateCounts.set(candId, (candidateCounts.get(candId) || 0) + 1);
      }
    }
    const top = [...candidateCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit).map((e) => e[0]);
    return this.hydrateProfiles(top, { viewerId: userId });
  }

  /**
   * Bounded mutual-friend count (intersection of outgoing following and incoming
   * followers). Returns null on error so callers stay fail-closed.
   */
  async getFriendCount(userId, { maxEdges = 500 } = {}) {
    if (!userId) return null;
    const cap = Math.max(1, Math.min(Number(maxEdges) || 500, 5000));
    const cacheKey = `friendCount_${userId}_${cap}`;
    const cached = this._readCache(this.listCache, cacheKey, LIST_CACHE_TTL_MS);
    if (typeof cached === 'number') return cached;

    const existingInflight = this.inflight.get(cacheKey);
    if (existingInflight) return existingInflight;

    const req = (async () => {
      try {
        const [following, followers] = await Promise.all([
          this._collectEdgesBounded(userId, 'following', cap),
          this._collectEdgesBounded(userId, 'followers', cap),
        ]);
        // Never render a partial intersection as a total.
        if (!following.complete || !followers.complete) return null;
        const followerSet = new Set(followers.ids);
        let count = 0;
        for (const id of following.ids) {
          if (followerSet.has(id)) count += 1;
        }
        this._writeCache(this.listCache, cacheKey, count);
        return count;
      } catch (err) {
        logger.warn('[SocialGraph] getFriendCount failed', { userId, error: err?.message });
        return null;
      } finally {
        this.inflight.delete(cacheKey);
      }
    })();

    this.inflight.set(cacheKey, req);
    return req;
  }

  /** Graph summary for a profile header: counts plus the viewer's edge. */
  async getSummary(userId, viewerId = null) {
    if (!userId) return null;
    await this._ensureInitialized();
    const { doc, getDoc } = await import('firebase/firestore');
    const [profileSnap, edge] = await Promise.all([
      getDoc(doc(this.firestore, 'users', userId)),
      viewerId ? this.getRelationship(viewerId, userId) : Promise.resolve(emptyEdge(userId)),
    ]);
    const data = profileSnap.exists() ? profileSnap.data() : {};
    return {
      userId,
      followerCount: resolveCount(data.followerCount, data.followersCount),
      followingCount: resolveCount(data.followingCount),
      // `friendCount` has no writer anywhere (friendships are resolved live via
      // `areFriends`), so `resolveCount` (fallback 0) would fabricate a measured
      // "0 friends". `ProfileMetricsGrid` renders an absent value as '—'.
      friendCount: unknownNumber(data.friendCount),
      edge,
    };
  }
}

export const socialGraphService = new SocialGraphService();

export function getSocialGraphService() {
  return socialGraphService;
}

export default socialGraphService;
