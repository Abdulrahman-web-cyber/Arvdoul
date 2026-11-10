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

  /** Drop every cached edge/list that involves the user (call on follow/block/etc.). */
  invalidate(userId) {
    if (!userId) return;
    for (const key of [...this.edgeCache.keys()]) {
      if (key.includes(userId)) this.edgeCache.delete(key);
    }
    for (const key of [...this.listCache.keys()]) {
      if (key.includes(userId)) this.listCache.delete(key);
    }
  }

  clearCache() {
    this.edgeCache.clear();
    this.listCache.clear();
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
  async _actorScopedIds(viewerId, otherIds, { collection: collectionName, actorField, otherField }) {
    const { collection, query, where, getDocs, limit: fLimit } = await import('firebase/firestore');
    const found = new Set();
    const unique = [...new Set(otherIds)].filter(Boolean);
    for (const chunk of this._chunk(unique, IN_CHUNK)) {
      if (chunk.length === 0) continue;
      const snap = await getDocs(
        query(
          collection(this.firestore, collectionName),
          where(actorField, '==', viewerId),
          where(otherField, 'in', chunk),
          fLimit(chunk.length)
        )
      );
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

    try {
      await this._ensureInitialized();
      const [followOut, followIn, blockOut, blockIn, muteOut, restrictOut] = await Promise.all([
        this._existingIds(EDGE_COLLECTIONS.follow, [`${viewerId}_${targetId}`]),
        this._existingIds(EDGE_COLLECTIONS.follow, [`${targetId}_${viewerId}`]),
        this._actorScopedIds(viewerId, [targetId], EDGE_ACTOR_SPECS.block.out),
        this._actorScopedIds(viewerId, [targetId], EDGE_ACTOR_SPECS.block.in),
        this._actorScopedIds(viewerId, [targetId], EDGE_ACTOR_SPECS.mute.out),
        this._actorScopedIds(viewerId, [targetId], EDGE_ACTOR_SPECS.restrict.out),
      ]);
      const isFollowing = followOut.has(`${viewerId}_${targetId}`);
      const isFollower = followIn.has(`${targetId}_${viewerId}`);
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
        requestStatus: null,
      };
      this._writeCache(this.edgeCache, cacheKey, edge);
      return edge;
    } catch (err) {
      logger.warn('[SocialGraph] relationship read failed', { viewerId, targetId, error: err?.message });
      return emptyEdge(targetId);
    }
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

    try {
      await this._ensureInitialized();

      // `follows` is world-readable, so the id-only `in` read is allowed.
      const [followOut, followIn] = include.includes('follow')
        ? await Promise.all([
            this._existingIds(EDGE_COLLECTIONS.follow, others.map((t) => `${viewerId}_${t}`)),
            this._existingIds(EDGE_COLLECTIONS.follow, others.map((t) => `${t}_${viewerId}`)),
          ])
        : [new Set(), new Set()];

      // Safety edges: actor-equality + other-party `in` (rules-provable).
      const blockOut = include.includes('block') ? await this._actorScopedIds(viewerId, others, EDGE_ACTOR_SPECS.block.out) : new Set();
      const blockIn = include.includes('block') ? await this._actorScopedIds(viewerId, others, EDGE_ACTOR_SPECS.block.in) : new Set();
      const muteOut = include.includes('mute') ? await this._actorScopedIds(viewerId, others, EDGE_ACTOR_SPECS.mute.out) : new Set();
      const restrictOut = include.includes('restrict') ? await this._actorScopedIds(viewerId, others, EDGE_ACTOR_SPECS.restrict.out) : new Set();

      for (const t of others) {
        const isFollowing = followOut.has(`${viewerId}_${t}`);
        const isFollower = followIn.has(`${t}_${viewerId}`);
        const isBlocking = blockOut.has(`${viewerId}_${t}`);
        const isBlockedBy = blockIn.has(`${viewerId}_${t}`);
        result.set(t, {
          uid: t,
          isFollowing,
          isFollower,
          isMutualFriend: isFollowing && isFollower,
          isBlocking,
          isBlockedBy,
          isBlocked: isBlocking || isBlockedBy,
          isMuted: muteOut.has(`${viewerId}_${t}`),
          isRestricted: restrictOut.has(`${viewerId}_${t}`),
          requestStatus: null,
        });
      }
    } catch (err) {
      logger.warn('[SocialGraph] batch edge read failed', { viewerId, count: others.length, error: err?.message });
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
    const displayName = pickDisplayName([raw.displayName, raw.name], { fallback: 'Creator' });
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
  async hydrateProfiles(userIds, { viewerId = null, edges = null } = {}) {
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

    const edgeMap = edges || (viewerId ? await this.getEdgeSet(viewerId, ids) : new Map());
    return ids
      .map((id) => byId.get(id))
      .filter(Boolean)
      .map((raw) => this.projectProfile(raw, viewerId, edgeMap.get(raw.id)));
  }

  /** List a relationship kind with hydrated, viewer-projected profiles. */
  async listConnections(userId, kind, { viewerId = null, limit = DEFAULT_PAGE_SIZE, cursor = null } = {}) {
    const { ids, hasMore, nextCursor } = await this.listEdges(userId, kind, { limit, cursor });
    // A blocked/blocked-by/muted user must not appear in the viewer's own
    // follower/following list — a masked row still leaks the account.
    const hidden = viewerId ? await this.getHiddenAuthorIds(viewerId) : null;
    const visibleIds = hidden ? ids.filter((id) => id !== viewerId && !hidden.has(id)) : ids;
    const connections = await this.hydrateProfiles(visibleIds, { viewerId });
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
      const edgeMap = await this.getEdgeSet(userId, page.ids, { include: ['follow'] });
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
    try {
      const { callFunction, FUNCTIONS } = await import('./callableService.js');
      const data = await callFunction(FUNCTIONS.GET_MUTUAL_FRIENDS, { userId: viewerId, otherUserId: targetId });
      return data?.mutualFriends || [];
    } catch (err) {
      logger.debug('[SocialGraph] mutual fallback', { error: err?.message });
    }
    const [a, b] = await Promise.all([
      this.listEdges(viewerId, 'following', { limit: 50 }),
      this.listEdges(targetId, 'following', { limit: 50 }),
    ]);
    const bSet = new Set(b.ids);
    const mutualIds = a.ids.filter((id) => bSet.has(id)).slice(0, limit);
    return this.hydrateProfiles(mutualIds, { viewerId });
  }

  /**
   * Ids whose content/suggestions the viewer must never see: users the viewer
   * blocked, users who blocked the viewer (reverse block — otherwise a blocker
   * leaks back into the viewer's surfaces), and users the viewer muted. Read
   * through the spine's bounded, rules-provable edge lists. Fails open (empty
   * set) only when the graph read errors.
   */
  async getHiddenAuthorIds(userId) {
    if (!userId) return new Set();
    try {
      const [blocked, blockedBy, muted] = await Promise.all([
        this.listEdges(userId, 'blocked', { limit: 500 }),
        this.listEdges(userId, 'blocked_by', { limit: 500 }),
        this.listEdges(userId, 'muted', { limit: 500 }),
      ]);
      return new Set([...(blocked.ids || []), ...(blockedBy.ids || []), ...(muted.ids || [])]);
    } catch (err) {
      logger.warn('[SocialGraph] hidden-author read failed; not filtering', { error: err?.message });
      return new Set();
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
    const pages = await Promise.all(sample.map((fid) => this.listEdges(fid, 'following', { limit: 30 })));
    for (const page of pages) {
      for (const candId of page.ids) {
        if (isHidden(candId) || mySet.has(candId)) continue;
        candidateCounts.set(candId, (candidateCounts.get(candId) || 0) + 1);
      }
    }
    const top = [...candidateCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit).map((e) => e[0]);
    return this.hydrateProfiles(top, { viewerId: userId });
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
      friendCount: resolveCount(data.friendCount),
      edge,
    };
  }
}

export const socialGraphService = new SocialGraphService();

export function getSocialGraphService() {
  return socialGraphService;
}

export default socialGraphService;
