// src/lib/arvdoulService.js
// Arvdoul-level Firestore helpers. Uses lazy firestore getter getFirestoreDB().

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

import { getFirestoreDB } from "../firebase/firebase.js"; // lazy getter

const PAGE_SIZE = 10;
const FOLLOWING_LIMIT = 500;
const EXPLORE_MIX_RATIO = 0.35;
const AUTHOR_COOLDOWN = 2;
const MIN_ENG_FOR_EXPLORE = 2;

const SCORE_WEIGHTS = {
  recencyHalfLifeMin: 360,
  like: 1.0,
  comment: 2.0,
  share: 3.0,
  dwell: 2.5,
  isFollowedAuthorBoost: 8.0,
  isMutualBoost: 3.0,
  topicMatch: 2.0,
  penaltyNSFW: -8.0,
  penaltyLowQuality: -3.0,
};

const minutesSince = (ts) => {
  if (!ts) return 1e6;
  const ms = ts?.toMillis ? ts.toMillis() : ts.seconds ? ts.seconds * 1000 : +ts;
  return Math.max(1, (Date.now() - ms) / 60000);
};

export async function getFollowingIds(uid) {
  if (!uid) return [];
  const db = getFirestoreDB();
  const uref = doc(db, "users", uid);
  const snap = await getDoc(uref);
  const data = snap.exists() ? snap.data() : {};
  const following = Array.isArray(data.following) ? data.following.slice(0, FOLLOWING_LIMIT) : [];
  return following;
}

export async function subscribeStories(onData, onError) {
  try {
    const db = getFirestoreDB();
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
  const db = getFirestoreDB();
  const tRef = collection(db, "trending");
  const qy = query(tRef, orderBy("score", "desc"), limit(limitN));
  const snap = await getDocs(qy);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function loadAds(limitN = 20) {
  const db = getFirestoreDB();
  const aRef = collection(db, "ads");
  const qy = query(aRef, where("active", "==", true), orderBy("priority", "desc"), limit(limitN));
  const snap = await getDocs(qy);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function getPostsPage({ followingIds = [], cursor = null, pageSize = PAGE_SIZE }) {
  const db = getFirestoreDB();
  const postsRef = collection(db, "posts");
  let qy;
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

export async function getExplorePage({ cursor = null, pageSize = PAGE_SIZE, excludeAuthorIds = [] }) {
  const db = getFirestoreDB();
  const postsRef = collection(db, "posts");
  const qy = query(postsRef, orderBy("createdAt", "desc"), ...(cursor ? [startAfter(cursor)] : []), limit(pageSize * 2));
  const snap = await getDocs(qy);
  let items = snap.docs.map((d) => ({ id: d.id, __cursor: d, ...d.data() }));
  items = items.filter((p) => !excludeAuthorIds.includes(p.userId));
  items = items.filter((p) => (p.likeCount || 0) + (p.commentCount || 0) + (p.shareCount || 0) >= MIN_ENG_FOR_EXPLORE);
  return {
    docs: items.slice(0, pageSize),
    lastDoc: snap.docs[snap.docs.length - 1] || null,
  };
}

export async function getUserInterests(uid) {
  if (!uid) return [];
  const db = getFirestoreDB();
  const uref = doc(db, "users", uid);
  const snap = await getDoc(uref);
  const data = snap.exists() ? snap.data() : {};
  return Array.isArray(data.interests) ? data.interests.map((x) => String(x).toLowerCase()) : [];
}

function topicOverlapScore(tags = [], interests = []) {
  if (!tags?.length || !interests?.length) return 0;
  const tagset = new Set(tags.map((t) => String(t).toLowerCase()));
  let hits = 0;
  interests.forEach((i) => { if (tagset.has(i)) hits += 1; });
  return hits > 0 ? 1 : 0;
}

export function scorePost(p, { userId, followingSet = new Set(), mutualSet = new Set(), interests = [] }) {
  const w = SCORE_WEIGHTS;
  const mins = minutesSince(p.createdAt);
  const decay = Math.pow(0.5, mins / w.recencyHalfLifeMin);

  const likes = p.likeCount || p.likes?.length || 0;
  const comments = p.commentCount || 0;
  const shares = p.shareCount || 0;
  const dwell = Math.min(10, p.dwellAvgSec || 0);

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

export function rankAndBlend({ friendDocs = [], exploreDocs = [], followingIds = [] }) {
  const followingSet = new Set(followingIds);
  const mutualSet = new Set();
  const interests = [];

  const computeScore = (p) => scorePost(p, { followingSet, mutualSet, interests });

  friendDocs.forEach((p) => (p.__score = computeScore(p)));
  exploreDocs.forEach((p) => (p.__score = computeScore(p)));

  friendDocs.sort((a, b) => b.__score - a.__score);
  exploreDocs.sort((a, b) => b.__score - a.__score);

  const out = [];
  const recentAuthors = [];

  const pushWithCooldown = (post) => {
    const a = post.userId || post.authorId;
    const lastIdx = recentAuthors.lastIndexOf(a);
    if (lastIdx !== -1 && recentAuthors.length - 1 - lastIdx < AUTHOR_COOLDOWN) {
      return false;
    }
    out.push(post);
    recentAuthors.push(a);
    if (recentAuthors.length > 50) recentAuthors.shift();
    return true;
  };

  const total = friendDocs.length + exploreDocs.length;
  const targetExplore = Math.floor(total * EXPLORE_MIX_RATIO);

  let iF = 0, iE = 0, eCount = 0;
  while (iF < friendDocs.length || iE < exploreDocs.length) {
    if (iF < friendDocs.length && (eCount >= targetExplore || friendDocs[iF].__score >= (exploreDocs[iE]?.__score || -Infinity))) {
      if (pushWithCooldown(friendDocs[iF])) { }
      iF++;
    } else if (iE < exploreDocs.length) {
      if (pushWithCooldown(exploreDocs[iE])) { eCount++; }
      iE++;
    } else break;
  }

  return out;
}

export async function getColdStart({ pageSize = PAGE_SIZE }) {
  const { docs } = await getExplorePage({ pageSize: pageSize * 2, excludeAuthorIds: [] });
  const suggestions = await getSuggestedUsers(30);
  return { posts: docs.slice(0, pageSize), suggestions };
}

export async function getSuggestedUsers(limitN = 20) {
  const db = getFirestoreDB();
  const uRef = collection(db, "users");
  const qy = query(uRef, orderBy("followerCount", "desc"), limit(limitN));
  const snap = await getDocs(qy);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}