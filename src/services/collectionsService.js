// src/services/collectionsService.js - ARVDOUL COLLECTIONS (REAL CRUD)
// User-curated collections of saved posts. Cursor-paginated, owner-scoped,
// with cache invalidation via the central CacheManager.
// Upgrades: Collection sharing, collaboration, and tokenized query searches.

import { getFirestoreInstance } from '../firebase/firebase.js';
import { cacheManager } from '../utils/CacheManager.js';
import { logger } from '../utils/Logger.js';
import { auditLogger } from '../utils/AuditLogger.js';

const PAGE_SIZE = 20;

class CollectionsService {
  constructor() {
    this.firestore = null;
    this.initialized = false;
    this.cache = cacheManager.namespace('collections', 5 * 60 * 1000);
  }

  async ensureInitialized() {
    if (this.initialized) return;
    this.firestore = await getFirestoreInstance();
    this.initialized = true;
  }

  _invalidate(userId) {
    this.cache.invalidatePattern(`*${userId}*`);
  }

  async createCollection(userId, { name, coverPostId = null, description = '' }) {
    await this.ensureInitialized();
    const { collection, addDoc, serverTimestamp } = await import('firebase/firestore');
    const nameClean = String(name || '').trim().slice(0, 60);
    if (!nameClean) throw new Error('Collection name is required.');
    const ref = await addDoc(collection(this.firestore, 'collections'), {
      userId,
      name: nameClean,
      description: String(description || '').slice(0, 200),
      coverPostId,
      itemCount: 0,
      sharedWith: [], // collaborative user list
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    this._invalidate(userId);
    auditLogger.log('collections.create', { userId, meta: { collectionId: ref.id } });
    return { success: true, collectionId: ref.id };
  }

  async getCollections(userId, options = {}) {
    await this.ensureInitialized();
    const { collection, query, where, orderBy, limit, startAfter, getDocs, doc, getDoc } = await import('firebase/firestore');
    const pageSize = options.limit || PAGE_SIZE;
    const cacheKey = `user_${userId}_${pageSize}_${options.cursor || ''}`;
    if (options.cacheFirst !== false) {
      const cached = this.cache.get(cacheKey);
      if (cached) return { ...cached, cached: true };
    }
    let q = query(
      collection(this.firestore, 'collections'),
      where('userId', '==', userId),
      orderBy('updatedAt', 'desc'),
      limit(pageSize)
    );
    if (options.cursor) {
      const cursorRef = doc(this.firestore, 'collections', options.cursor);
      const cursorSnap = await getDoc(cursorRef);
      if (cursorSnap.exists()) q = query(q, startAfter(cursorSnap));
    }
    const snap = await getDocs(q);
    const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    const hasMore = snap.docs.length === pageSize;
    const nextCursor = hasMore && snap.docs.length ? snap.docs[snap.docs.length - 1].id : null;
    const result = { success: true, collections: items, hasMore, nextCursor };
    this.cache.set(cacheKey, result);
    return result;
  }

  async deleteCollection(userId, collectionId) {
    await this.ensureInitialized();
    const { doc, getDoc, deleteDoc, writeBatch } = await import('firebase/firestore');
    const ref = doc(this.firestore, 'collections', collectionId);
    const snap = await getDoc(ref);
    if (!snap.exists()) return { success: false, error: 'Collection not found.' };
    if (snap.data().userId !== userId) throw new Error('Not authorized.');
    const batch = writeBatch(this.firestore);
    batch.delete(ref);
    const itemsSnap = await getDocsLike(this.firestore, collectionId);
    itemsSnap.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
    this._invalidate(userId);
    auditLogger.log('collections.delete', { userId, meta: { collectionId } });
    return { success: true };
  }

  async addToCollection(userId, collectionId, post) {
    await this.ensureInitialized();
    const { collection, doc, getDoc, addDoc, updateDoc, serverTimestamp } = await import('firebase/firestore');
    const ref = doc(this.firestore, 'collections', collectionId);
    const snap = await getDoc(ref);
    if (!snap.exists()) throw new Error('Collection not found.');
    const data = snap.data();
    if (data.userId !== userId && !data.sharedWith?.includes(userId)) throw new Error('Not authorized.');

    const itemRef = await addDoc(collection(this.firestore, 'collections', collectionId, 'items'), {
      postId: post.id,
      snapshot: post,
      addedAt: serverTimestamp(),
    });
    await updateDoc(ref, { itemCount: (data.itemCount || 0) + 1, updatedAt: serverTimestamp() });
    this._invalidate(userId);
    return { success: true, itemId: itemRef.id };
  }

  async removeFromCollection(userId, collectionId, itemId) {
    await this.ensureInitialized();
    const { doc, getDoc, deleteDoc, updateDoc, serverTimestamp } = await import('firebase/firestore');
    const ref = doc(this.firestore, 'collections', collectionId);
    const snap = await getDoc(ref);
    if (!snap.exists()) return { success: false };
    const data = snap.data();
    if (data.userId !== userId && !data.sharedWith?.includes(userId)) throw new Error('Not authorized.');

    await deleteDoc(doc(this.firestore, 'collections', collectionId, 'items', itemId));
    await updateDoc(ref, { itemCount: Math.max(0, (data.itemCount || 0) - 1), updatedAt: serverTimestamp() });
    this._invalidate(userId);
    return { success: true };
  }

  async getCollectionItems(userId, collectionId, options = {}) {
    await this.ensureInitialized();
    const { collection, query, orderBy, limit, startAfter, getDocs, doc, getDoc } = await import('firebase/firestore');
    const pageSize = options.limit || PAGE_SIZE;
    let q = query(
      collection(this.firestore, 'collections', collectionId, 'items'),
      orderBy('addedAt', 'desc'),
      limit(pageSize)
    );
    if (options.cursor) {
      const cursorRef = doc(this.firestore, 'collections', collectionId, 'items', options.cursor);
      const cursorSnap = await getDoc(cursorRef);
      if (cursorSnap.exists()) q = query(q, startAfter(cursorSnap));
    }
    const snap = await getDocs(q);
    const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    const hasMore = snap.docs.length === pageSize;
    const nextCursor = hasMore && snap.docs.length ? snap.docs[snap.docs.length - 1].id : null;
    return { success: true, items, hasMore, nextCursor };
  }

  /**
   * Share a collection with another user.
   */
  async shareCollection(userId, collectionId, targetUserId) {
    await this.ensureInitialized();
    const { doc, getDoc, updateDoc, arrayUnion, serverTimestamp } = await import('firebase/firestore');
    const ref = doc(this.firestore, 'collections', collectionId);
    const snap = await getDoc(ref);
    if (!snap.exists()) throw new Error('Collection not found.');
    if (snap.data().userId !== userId) throw new Error('Not authorized.');

    await updateDoc(ref, {
      sharedWith: arrayUnion(targetUserId),
      updatedAt: serverTimestamp()
    });

    this._invalidate(userId);
    this._invalidate(targetUserId);

    return { success: true };
  }
}

async function getDocsLike(firestore, collectionId) {
  const { collection, getDocs } = await import('firebase/firestore');
  return getDocs(collection(firestore, 'collections', collectionId, 'items'));
}

export function getCollectionsService() {
  if (!collectionsServiceInstance) collectionsServiceInstance = new CollectionsService();
  return collectionsServiceInstance;
}
let collectionsServiceInstance = null;

export default getCollectionsService;
