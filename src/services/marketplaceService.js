// src/services/marketplaceService.js
//
// Digital assets, presets, sound packs, creator merchandise, and real Firestore transactions.

import { svcLogger } from './ServiceKit.js';
import { getFirestoreInstance } from '../firebase/firebase.js';
import localforage from 'localforage';

const log = svcLogger('marketplaceService');

class MarketplaceService {
  constructor() {
    this.cart = [];
    this.orders = [];
    this._initOrdersStore();
  }

  /**
   * Generates a cryptographically strong random token hex string (CWE-330).
   * @private
   */
  _generateSecureHex(bytes = 4) {
    const arr = new Uint8Array(bytes);
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
      crypto.getRandomValues(arr);
    }
    return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('');
  }

  async _initOrdersStore() {
    try {
      const saved = await localforage.getItem('arvdoul_marketplace_orders');
      if (Array.isArray(saved)) {
        this.orders = saved;
      }
    } catch (e) {
      log.warn('Local order history read failed', { error: e?.message });
    }
  }

  async _saveOrders() {
    try {
      await localforage.setItem('arvdoul_marketplace_orders', this.orders);
    } catch (e) {
      log.warn('Local order history write failed', { error: e?.message });
    }
  }

  /**
   * Creators whose marketplace listings must not surface for the viewer:
   * blocked, blocked-by and muted. Delegates to the graph spine (bounded,
   * fails open).
   */
  async _getHiddenAuthors(viewerId) {
    if (!viewerId) return new Set();
    try {
      const { getSocialGraphService } = await import('./socialGraphService.js');
      return await getSocialGraphService().getHiddenAuthorIds(viewerId);
    } catch (err) {
      log.warn('Marketplace hidden-author read failed; not filtering', { error: err?.message });
      return new Set();
    }
  }

  async getProducts(category = 'All', viewerId = null) {
    log.info('Fetching marketplace products from Firestore', { category });
    try {
      const firestore = await getFirestoreInstance();
      const { collection, getDocs, query, where, orderBy, limit } = await import('firebase/firestore');

      const hiddenAuthors = await this._getHiddenAuthors(viewerId);
      const colRef = collection(firestore, 'marketplace_items');
      let q = query(colRef, orderBy('createdAt', 'desc'), limit(50));

      if (category && category !== 'All') {
        q = query(colRef, where('category', '==', category), limit(50));
      }

      const snap = await getDocs(q);
      const items = [];
      snap.forEach(docSnap => {
        const data = docSnap.data();
        if (hiddenAuthors.has(data.creatorId)) return;
        items.push({ id: docSnap.id, ...data });
      });

      return items;
    } catch (err) {
      log.error('Error fetching marketplace products', err);
      return [];
    }
  }

  async getProductById(id) {
    try {
      const firestore = await getFirestoreInstance();
      const { doc, getDoc } = await import('firebase/firestore');
      const snap = await getDoc(doc(firestore, 'marketplace_items', id));
      if (snap.exists()) {
        return { id: snap.id, ...snap.data() };
      }
    } catch (err) {
      log.error('Error fetching product by id', err);
    }
    return null;
  }

  async purchaseProductWithCoins(productId, buyerUser) {
    log.info('Purchasing product with coins', { productId });
    const product = await this.getProductById(productId);
    if (!product) {
      throw new Error('Product not found.');
    }

    if (product.stock <= 0) {
      throw new Error('This item is currently out of stock.');
    }

    if (!buyerUser?.uid) {
      throw new Error('Sign in to purchase items.');
    }

    // server-authoritative purchase: the purchaseMarketplaceItem Cloud
    // Function atomically debits the coins (double-entry ledger), decrements
    // stock and creates the order. Client-side writes to marketplace_items
    // are denied by rules (buyer != creator), so there is no client fallback
    // for this money path — it fails loudly until the function is deployed.
    // The result is NOT fabricated: if the function did not return an order
    // there is no order, and the caller must not be shown a plausible-looking
    // receipt for a purchase that never happened.
    try {
      const { callFunction, FUNCTIONS } = await import('./callableService.js');
      const result = (await callFunction(FUNCTIONS.PURCHASE_MARKETPLACE_ITEM, { productId })) || {};
      if (!result.success || !result.order) {
        throw new Error('Purchase did not complete: the server returned no order.');
      }
      const order = result.order;
      this.orders.unshift(order);
      await this._saveOrders();
      return order;
    } catch (err) {
      const msg = err?.message || String(err);
      throw new Error(
        msg.includes('purchaseMarketplaceItem') || msg.includes('INTERNAL') || msg.includes('UNAVAILABLE')
          ? 'Purchase requires the purchaseMarketplaceItem Cloud Function to be deployed.'
          : msg
      );
    }
  }

  async listNewProduct(productData, creator) {
    // Honest listing: real creator identity only (no fabricated names,
    // handles, avatars or "Verified" badges), zero ratings until real
    // reviews exist, stock explicitly set by the seller.
    if (!creator?.uid) {
      throw new Error('Sign in to list a product');
    }
    const newProd = {
      title: productData.title,
      category: productData.category || 'Digital Assets',
      // Top-level creatorId is REQUIRED by firestore.rules
      // (match /marketplace_items/{itemId} create: creatorId == uid()).
      creatorId: creator.uid,
      creator: {
        id: creator?.uid || null,
        name: creator?.displayName || '',
        username: creator?.username ? `@${creator.username}` : null,
        avatar: creator?.photoURL || null,
        badge: null
      },
      priceCoins: Math.max(0, Number(productData.priceCoins) || 0),
      priceUsd: productData.priceUsd != null ? Number(productData.priceUsd) : null,
      rating: 0,
      reviewsCount: 0,
      salesCount: 0,
      image: productData.image || null,
      description: productData.description || '',
      includes: productData.includes ? productData.includes.split('\n') : [],
      isDigital: productData.isDigital !== false,
      // Explicit seller stock (default 1 = they are listing one item).
      stock: Math.max(0, Number(productData.stock) || 1),
      createdAt: new Date().toISOString()
    };

    const firestore = await getFirestoreInstance();
    const { collection, addDoc } = await import('firebase/firestore');
    const docRef = await addDoc(collection(firestore, 'marketplace_items'), newProd);

    return { id: docRef.id, ...newProd };
  }
}

export const marketplaceService = new MarketplaceService();
export default marketplaceService;

