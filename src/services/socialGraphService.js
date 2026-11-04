// src/services/socialGraphService.js
//
// Canonical social-graph spine. Every system that needs "who is this to me"
// (profile, feed, stories, messaging permissions, notifications, analytics
// cohorts) resolves it here, so the graph is read one way.
//
// Scale contract (billion-user target):
//   * Single relationship  -> 6 point reads (follows x2, blocks x2, mutes, restricts).
//   * Batch relationship   -> `documentId() in` queries chunked to 30 (no N+1,
//     no unbounded scan of the viewer's whole graph).
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
   * Resolve the relationship between `viewerId` and a single `targetId`.
   * Bounded: exactly 6 point reads (matches the pre-existing cost, now single-source).
   */
  async getRelationship(viewerId, targetId) {
    if (!viewerId || !targetId) return emptyEdge(targetId);
    if (viewerId === targetId) return { ...emptyEdge(targetId, true), canMessage: true, canViewPrivate: true };

    const cacheKey = `edge_${viewerId}_${targetId}`;
    const cached = this._readCache(this.edgeCache, cacheKey, EDGE_CACHE_TTL_MS);
    if (cached) return cached;

    try {
      await this._ensureInitialized();
      const { doc, getDoc } = await import('firebase/firestore');
      const [fOut, fIn, bOut, bIn, mOut, rOut] = await Promise.all([
        getDoc(doc(this.firestore, EDGE_COLLECTIONS.follow, `${viewerId}_${targetId}`)),
        getDoc(doc(this.firestore, EDGE_COLLECTIONS.follow, `${targetId}_${viewerId}`)),
        getDoc(doc(this.firestore, EDGE_COLLECTIONS.block, `${viewerId}_${targetId}`)),
        getDoc(doc(this.firestore, EDGE_COLLECTIONS.block, `${targetId}_${viewerId}`)),
        getDoc(doc(this.firestore, EDGE_COLLECTIONS.mute, `${viewerId}_${targetId}`)),
        getDoc(doc(this.firestore, EDGE_COLLECTIONS.restrict, `${viewerId}_${targetId}`)),
      ]);
      const isFollowing = Boolean(fOut?.exists?.());
      const isFollower = Boolean(fIn?.exists?.());
      const isBlocking = Boolean(bOut?.exists?.());
      const isBlockedBy = Boolean(bIn?.exists?.());
      const edge = {
        uid: targetId,
        isFollowing,
        isFollower,
        isMutualFriend: isFollowing && isFollower,
        isBlocking,
        isBlockedBy,
        isBlocked: isBlocking || isBlockedBy,
        isMuted: Boolean(mOut?.exists?.()),
        isRestricted: Boolean(rOut?.exists?.()),
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
   * Bounded: 8 id-sets (follow/block/mute/restrict x in/out) chunked to 30.
   * Replaces the previous "load the viewer's entire graph" scans.
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
      const outIds = others.map((t) => `${viewerId}_${t}`);
      const inIds = others.map((t) => `${t}_${viewerId}`);

      const [followOut, followIn] = include.includes('follow')
        ? await Promise.all([
            this._existingIds(EDGE_COLLECTIONS.follow, outIds),
            this._existingIds(EDGE_COLLECTIONS.follow, inIds),
          ])
        : [new Set(), new Set()];
      const [blockOut, blockIn] = include.includes('block')
        ? await Promise.all([
            this._existingIds(EDGE_COLLECTIONS.block, outIds),
            this._existingIds(EDGE_COLLECTIONS.block, inIds),
          ])
        : [new Set(), new Set()];
      const muteOut = include.includes('mute')
        ? await this._existingIds(EDGE_COLLECTIONS.mute, outIds)
        : new Set();
      const restrictOut = include.includes('restrict')
        ? await this._existingIds(EDGE_COLLECTIONS.restrict, outIds)
        : new Set();

      for (const t of others) {
        const isFollowing = followOut.has(`${viewerId}_${t}`);
        const isFollower = followIn.has(`${t}_${viewerId}`);
        const isBlocking = blockOut.has(`${viewerId}_${t}`);
        const isBlockedBy = blockIn.has(`${t}_${viewerId}`);
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
    const connections = await this.hydrateProfiles(ids, { viewerId });
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
    const connections = await this.hydrateProfiles(mutualIds, { viewerId: viewerId || userId });
    return { success: true, connections, hasMore, nextCursor: pageCursor, count: connections.length };
  }

  /** Mutual connections, server-authoritative when the callable is available. */
  async getMutualConnections(viewerId, targetId, { limit = 20 } = {}) {
    if (!viewerId || !targetId || viewerId === targetId) return [];
    try {
      const { getFunctions, httpsCallable } = await import('firebase/functions');
      const fn = httpsCallable(getFunctions(), 'getMutualFriends');
      const res = await fn({ userId: viewerId, otherUserId: targetId });
      return res.data?.mutualFriends || [];
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

  /** Friend suggestions, server-authoritative when the callable is available. */
  async getSuggestions(userId, { limit = 20 } = {}) {
    if (!userId) return [];
    try {
      const { getFunctions, httpsCallable } = await import('firebase/functions');
      const fn = httpsCallable(getFunctions(), 'generateFriendRecommendations');
      const res = await fn({ userId, limit });
      const recs = res.data?.recommendations || [];
      if (recs.length > 0) {
        const ids = recs.map((r) => r.userId || r.id || r.uid).filter(Boolean);
        return ids.length ? await this.hydrateProfiles(ids, { viewerId: userId }) : recs;
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
        if (candId === userId || mySet.has(candId)) continue;
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
