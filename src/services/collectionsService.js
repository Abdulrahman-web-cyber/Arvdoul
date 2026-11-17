// src/services/collectionsService.js
//
// User-curated collections of saved posts. Cursor-paginated, owner-scoped,
// with cache invalidation via the central CacheManager.

import { getFirestoreInstance } from '../firebase/firebase.js';
import { cacheManager } from '../utils/CacheManager.js';
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

  async createCollection(userId, { name, description = '' }) {
    await this.ensureInitialized();
    const { collection, addDoc, serverTimestamp } = await import('firebase/firestore');
    const nameClean = String(name || '').trim().slice(0, 60);
    if (!nameClean) throw new Error('Collection name is required.');
    const ref = await addDoc(collection(this.firestore, 'collections'), {
      userId,
      name: nameClean,
      description: String(description || '').slice(0, 200),
      itemCount: 0,
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
    const { doc, getDoc, writeBatch, collection, query, limit, getDocs } = await import('firebase/firestore');
    const ref = doc(this.firestore, 'collections', collectionId);
    const snap = await getDoc(ref);
    if (!snap.exists()) return { success: false, error: 'Collection not found.' };
    if (snap.data().userId !== userId) throw new Error('Not authorized.');

    const itemsCol = collection(this.firestore, 'collections', collectionId, 'items');
    while (true) {
      const itemsSnap = await getDocs(query(itemsCol, limit(450)));
      if (itemsSnap.empty || itemsSnap.docs.length === 0) break;
      const itemsBatch = writeBatch(this.firestore);
      itemsSnap.docs.forEach((d) => itemsBatch.delete(d.ref));
      await itemsBatch.commit();
      if (itemsSnap.docs.length < 450) break;
    }

    const batch = writeBatch(this.firestore);
    batch.delete(ref);
    await batch.commit();
    this._invalidate(userId);
    auditLogger.log('collections.delete', { userId, meta: { collectionId } });
    return { success: true };
  }

  async addToCollection(userId, collectionId, post) {
    await this.ensureInitialized();
    const { collection, doc, runTransaction, increment, serverTimestamp } = await import('firebase/firestore');
    const ref = doc(this.firestore, 'collections', collectionId);
    const itemRef = doc(collection(this.firestore, 'collections', collectionId, 'items'));

    // `itemCount` is the size of the `items` subcollection, so the item write
    // and the counter bump must be one atomic unit. A read-modify-write
    // (`(data.itemCount || 0) + 1` from a stale `getDoc`) lost an update under
    // two concurrent adds, and a duplicate submit double-counted — the
    // transaction re-reads the counter and `increment` is atomic, so N
    // concurrent adds land on exactly N.
    await runTransaction(this.firestore, async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists()) throw new Error('Collection not found.');
      const data = snap.data();
      if (data.userId !== userId) throw new Error('Not authorized.');
      tx.set(itemRef, {
        postId: post.id,
        snapshot: post,
        addedAt: serverTimestamp(),
      });
      tx.update(ref, { itemCount: increment(1), updatedAt: serverTimestamp() });
    });
    this._invalidate(userId);
    return { success: true, itemId: itemRef.id };
  }

  async removeFromCollection(userId, collectionId, itemId) {
    await this.ensureInitialized();
    const { doc, runTransaction, increment, serverTimestamp } = await import('firebase/firestore');
    const ref = doc(this.firestore, 'collections', collectionId);
    const itemRef = doc(this.firestore, 'collections', collectionId, 'items', itemId);

    // Idempotent + atomic: only decrement when the item actually existed, so a
    // retry (or two concurrent removes of the same item) cannot drive the
    // counter negative. The previous `Math.max(0, …)` clamp hid that drift
    // instead of preventing it.
    const result = await runTransaction(this.firestore, async (tx) => {
      const [colSnap, itemSnap] = await Promise.all([tx.get(ref), tx.get(itemRef)]);
      if (!colSnap.exists()) return { success: false };
      const data = colSnap.data();
      if (data.userId !== userId) throw new Error('Not authorized.');
      if (!itemSnap.exists()) return { success: true, alreadyRemoved: true };
      tx.delete(itemRef);
      tx.update(ref, { itemCount: increment(-1), updatedAt: serverTimestamp() });
      return { success: true };
    });
    this._invalidate(userId);
    return result;
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
   * A `sharedWith` collaborative-list feature was never wired: nothing called
   * this method, the rules grant a collection read only to its `userId` owner
   * (so a "shared" user could never read it), and the UI rendered only the
   * owner's own collections. The method is removed rather than left as a
   * control that cannot work.
   */
}

async function getDocsLike(firestore, collectionId) {
  const { collection, getDocs, query, limit } = await import('firebase/firestore');
  // Bounded read: a collection page never materializes more than 200 items.
  return getDocs(query(collection(firestore, 'collections', collectionId, 'items'), limit(200)));
}

export function getCollectionsService() {
  if (!collectionsServiceInstance) collectionsServiceInstance = new CollectionsService();
  return collectionsServiceInstance;
}
let collectionsServiceInstance = null;

export default getCollectionsService;
