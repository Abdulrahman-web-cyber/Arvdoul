\/\/ src/lib/recsService.js
import { httpsCallable } from "firebase/functions";
import { getFunctions } from "firebase/functions";
import { db } from "../firebase/firebase";
import { collection, query, orderBy, getDocs, limit } from "firebase/firestore";

/**
 * getRecommendations: try server-side first (callable function "getRecommendations"),
 * fallback to client-side heuristic (recency + engagement).
 *
 * Returns array of post objects (with id, media, caption, etc.)
 */
export async function getRecommendations({ userId = null, count = 50 } = {}) {
  try {
    \/\/ Try server callable
    const functions = getFunctions();
    const fn = httpsCallable(functions, "getRecommendations");
    const res = await fn({ userId, count });
    if (res && res.data) return res.data;
  } catch (e) {
    console.warn("server recs failed", e);
  }

  \/\/ fallback: fetch recent posts and rank locally
  const q = query(collection(db, "posts"), orderBy("createdAt", "desc"), limit(count));
  const snap = await getDocs(q);
  const list = snap.docs.map((d) => ({ id: d.id, ...d.data() })).filter((p) => Array.isArray(p?.media));
  \/\/ simple score: recency + (likes * 0.4) + (views * 0.2)
  const now = Date.now();
  const scored = list.map((p) => {
    const age = p.createdAt?.toDate ? (now - p.createdAt.toDate().getTime()) / 1000 : 0;
    const recencyScore = Math.max(0, 1 - age / (60 * 60 * 24)); \/\/ within a day ~1
    const likes = p.likesCount || p.likes?.length || 0;
    const views = p.viewCount || 0;
    const score = recencyScore * 0.7 + Math.min(1, likes / 100) * 0.2 + Math.min(1, views / 500) * 0.1;
    return { ...p, _score: score };
  });
  scored.sort((a, b) => b._score - a._score);
  return scored;
}

/** report view to server-side analytics */
export async function reportView(postId, meta = {}) {
  try {
    const functions = getFunctions();
    const fn = httpsCallable(functions, "reportView");
    return await fn({ postId, meta });
  } catch (e) {
    \/\/ best effort: ignore
    return null;
  }
}

/** report interactions to recsys */
export async function reportInteraction(postId, payload = {}) {
  try {
    const functions = getFunctions();
    const fn = httpsCallable(functions, "reportInteraction");
    return await fn({ postId, payload });
  } catch (e) {
    return null;
  }
}

/** report ad impression */
export async function reportAdImpression(adId, meta = {}) {
  try {
    const functions = getFunctions();
    const fn = httpsCallable(functions, "reportAdImpression");
    return await fn({ adId, meta });
  } catch (e) {
    return null;
  }
}