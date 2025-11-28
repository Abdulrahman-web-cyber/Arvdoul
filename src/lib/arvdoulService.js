// src/lib/arvdoulService.js
// Centralized Firestore data access + ranking + cold-start helpers.
// Tune weights in SCORE_WEIGHTS to shape your feed quality.

import {
  collection,
  query,
  orderBy,
  limit,
  startAfter,
  onSnapshot,
  getDocs,
  getDoc,
  doc,
  where,
} from "firebase/firestore";
import { db } from "../firebase/firebase";

// -----------------------------
// Tunables
// -----------------------------
const PAGE_SIZE = 10;
const FOLLOWING_LIMIT = 500; // guardrail for massive networks
const EXPLORE_MIX_RATIO = 0.35; // % of explore items to blend into friends feed
const AUTHOR_COOLDOWN = 2; // avoid showing >1 post by same author within this window size
const MIN_ENG_FOR_EXPLORE = 2; // simple quality gate for explore

// Ranking weights — tweak to your product goals
const SCORE_WEIGHTS = {
  recencyHalfLifeMin: 360,    // half-life in minutes (~6h); bigger = slower decay
  like: 1.0,
  comment: 2.0,
  share: 3.0,
  dwell: 2.5,                 // per second avg dwell (capped)
  isFollowedAuthorBoost: 8.0, // big lift for people you follow
  isMutualBoost: 3.0,
  topicMatch: 2.0,            // if post tags intersect user interests
  penaltyNSFW: -8.0,
  penaltyLowQuality: -3.0,
};

// -----------------------------
// Utilities
// -----------------------------
const minutesSince = (ts) => {
  if (!ts) return 1e6; // very old
  const ms = ts?.toMillis ? ts.toMillis() : ts.seconds ? ts.seconds * 1000 : +ts;
  return Math.max(1, (Date.now() - ms) / 60000);
};

export async function getFollowingIds(uid) {
  if (!uid) return [];
  const uref = doc(db, "users", uid);
  const snap = await getDoc(uref);
  const data = snap.exists() ? snap.data() : {};
  const following = Array.isArray(data.following) ? data.following.slice(0, FOLLOWING_LIMIT) : [];
  return following;
}

export async function subscribeStories(onData, onError) {
  try {
    const storiesRef = collection(db, "stories");
    const qy = query(storiesRef, orderBy("createdAt", "desc"), limit(50));
    const unsub = onSnapshot(
      qy,
      (snap) => onData(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
      (err) => onError?.(err)
    );
    return unsub;
  } catch (e) {
    onError?.(e);
    return () => {};
  }
}

export async function loadTrending(limitN = 12) {
  const tRef = collection(db, "trending");
  const qy = query(tRef, orderBy("score", "desc"), limit(limitN));
  const snap = await getDocs(qy);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function loadAds(limitN = 20) {
  const aRef = collection(db, "ads");
  const qy = query(aRef, where("active", "==", true), orderBy("priority", "desc"), limit(limitN));
  const snap = await getDocs(qy);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

// Pull a page of newest posts; optionally scoped to authors (following)
export async function getPostsPage({ followingIds = [], cursor = null, pageSize = PAGE_SIZE }) {
  const postsRef = collection(db, "posts");
  let qy;
  // If following is small, use a where-in batched strategy; otherwise revert to global recency
  if (followingIds?.length && followingIds.length <= 10) {
    qy = query(
      postsRef,
      where("userId", "in", followingIds),
      orderBy("createdAt", "desc"),
      ...(cursor ? [startAfter(cursor)] : []),
      limit(pageSize)
    );
  } else {
    qy = query(
      postsRef,
      orderBy("createdAt", "desc"),
      ...(cursor ? [startAfter(cursor)] : []),
      limit(pageSize)
    );
  }
  const snap = await getDocs(qy);
  return {
    docs: snap.docs.map((d) => ({ id: d.id, __cursor: d, ...d.data() })),
    lastDoc: snap.docs[snap.docs.length - 1] || null,
  };
}

// Explore page: non-followed authors, light quality filter
export async function getExplorePage({ cursor = null, pageSize = PAGE_SIZE, excludeAuthorIds = [] }) {
  const postsRef = collection(db, "posts");
  const qy = query(
    postsRef,
    orderBy("createdAt", "desc"),
    ...(cursor ? [startAfter(cursor)] : []),
    limit(pageSize * 2) // pull more then filter
  );
  const snap = await getDocs(qy);
  let items = snap.docs.map((d) => ({ id: d.id, __cursor: d, ...d.data() }));
  items = items.filter((p) => !excludeAuthorIds.includes(p.userId));
  items = items.filter((p) => (p.likeCount || 0) + (p.commentCount || 0) + (p.shareCount || 0) >= MIN_ENG_FOR_EXPLORE);
  return {
    docs: items.slice(0, pageSize),
    lastDoc: snap.docs[snap.docs.length - 1] || null,
  };
}

// Soft user interests from profile; fall back to empty
export async function getUserInterests(uid) {
  if (!uid) return [];
  const uref = doc(db, "users", uid);
  const snap = await getDoc(uref);
  const data = snap.exists() ? snap.data() : {};
  return Array.isArray(data.interests) ? data.interests.map((x) => String(x).toLowerCase()) : [];
}

// Simple topic overlap
function topicOverlapScore(tags = [], interests = []) {
  if (!tags?.length || !interests?.length) return 0;
  const tagset = new Set(tags.map((t) => String(t).toLowerCase()));
  let hits = 0;
  interests.forEach((i) => { if (tagset.has(i)) hits += 1; });
  return hits > 0 ? 1 : 0; // binary for simplicity; expand if you like
}

// Core scoring function
export function scorePost(p, { userId, followingSet, mutualSet, interests }) {
  const w = SCORE_WEIGHTS;
  const mins = minutesSince(p.createdAt);
  const decay = Math.pow(0.5, mins / w.recencyHalfLifeMin);

  const likes = p.likeCount || p.likes?.length || 0;
  const comments = p.commentCount || 0;
  const shares = p.shareCount || 0;
  const dwell = Math.min(10, p.dwellAvgSec || 0); // cap

  const followBoost = followingSet.has(p.userId) ? w.isFollowedAuthorBoost : 0;
  const mutualBoost = mutualSet?.has(p.userId) ? w.isMutualBoost : 0;
  const topics = Array.isArray(p.tags) ? p.tags : (Array.isArray(p.hashtags) ? p.hashtags : []);
  const topicBoost = topicOverlapScore(topics, interests) * w.topicMatch;

  const nsfw = p.nsfw ? w.penaltyNSFW : 0;
  const lowq = p.quality === "low" ? w.penaltyLowQuality : 0;

  const base =
    likes * w.like +
    comments * w.comment +
    shares * w.share +
    dwell * w.dwell +
    followBoost + mutualBoost + topicBoost +
    nsfw + lowq;

  return base * decay;
}

// Merge + rank + diversity pass + mix-in explore
export function rankAndBlend({ friendDocs, exploreDocs, followingIds = [] }) {
  const followingSet = new Set(followingIds);
  const mutualSet = new Set(); // if you keep "mutuals" on user doc, pass here
  const interests = [];        // inject caller’s interests

  // Caller may pass interests in a closure; we keep signature flexible
  const computeScore = (p, ctxExtras = {}) =>
    scorePost(p, { followingSet, mutualSet, interests, ...(ctxExtras || {}) });

  // Compute scores
  friendDocs.forEach((p) => (p.__score = computeScore(p)));
  exploreDocs.forEach((p) => (p.__score = computeScore(p)));

  // Sort both buckets
  friendDocs.sort((a, b) => b.__score - a.__score);
  exploreDocs.sort((a, b) => b.__score - a.__score);

  // Author diversity: don’t show same author twice inside the last N
  const out = [];
  const recentAuthors = [];

  const pushWithCooldown = (post) => {
    const a = post.userId || post.authorId;
    const lastIdx = recentAuthors.lastIndexOf(a);
    if (lastIdx !== -1 && recentAuthors.length - 1 - lastIdx < AUTHOR_COOLDOWN) {
      return false; // skip for now
    }
    out.push(post);
    recentAuthors.push(a);
    if (recentAuthors.length > 50) recentAuthors.shift();
    return true;
  };

  // Blend streams with explore ratio
  const total = friendDocs.length + exploreDocs.length;
  const targetExplore = Math.floor(total * EXPLORE_MIX_RATIO);

  let iF = 0, iE = 0, eCount = 0;
  while (iF < friendDocs.length || iE < exploreDocs.length) {
    // prefer friends until we’ve hit the explore target
    if (iF < friendDocs.length && (eCount >= targetExplore || friendDocs[iF].__score >= (exploreDocs[iE]?.__score || -Infinity))) {
      if (pushWithCooldown(friendDocs[iF])) { /* ok */ }
      iF++;
    } else if (iE < exploreDocs.length) {
      if (pushWithCooldown(exploreDocs[iE])) { eCount++; }
      iE++;
    } else {
      break;
    }
  }

  return out;
}

// Cold start: suggestions + explore
export async function getColdStart({ pageSize = PAGE_SIZE }) {
  const { docs } = await getExplorePage({ pageSize: pageSize * 2, excludeAuthorIds: [] });
  const suggestions = await getSuggestedUsers(30);
  return {
    posts: docs.slice(0, pageSize),
    suggestions,
  };
}

// Very simple suggestions: top creators by followerCount
export async function getSuggestedUsers(limitN = 20) {
  const uRef = collection(db, "users");
  const qy = query(uRef, orderBy("followerCount", "desc"), limit(limitN));
  const snap = await getDocs(qy);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}