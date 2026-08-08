// src/services/marketplaceService.js
// 🛍️ ARVDOUL CREATOR MARKETPLACE & COMMERCE SERVICE
// Digital assets, presets, sound packs, creator merchandise, and Arvdoul Coin payments

import { svcLogger } from './ServiceKit.js';

const log = svcLogger('marketplaceService');

const SAMPLE_PRODUCTS = [
  {
    id: 'prod-cyber-lut',
    title: 'Cyberpunk Tokyo Master LUT Pack (15 LUTs)',
    category: 'Digital Assets',
    creator: {
      name: 'Kai Takahashi',
      username: '@kai_visuals',
      avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150',
      badge: 'Top Seller'
    },
    priceCoins: 1200,
    priceUsd: 14.99,
    rating: 4.9,
    reviewsCount: 384,
    salesCount: 2410,
    image: 'https://images.unsplash.com/photo-1514565131-fce0801e5785?w=500',
    description: '15 cinematic color grading LUTs designed for Sony, Canon, RED and iPhone log footage. Instant .cube download.',
    includes: ['15 .cube files', 'PDF Installation Guide', 'Before/After samples', 'Lifetime updates'],
    isDigital: true
  },
  {
    id: 'prod-synth-kit',
    title: 'Analog Future Sound Kit Vol. 2 (300+ WAVs)',
    category: 'Audio & Sounds',
    creator: {
      name: 'Luna Nova',
      username: '@luna_music',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
      badge: 'Trending'
    },
    priceCoins: 1800,
    priceUsd: 19.99,
    rating: 5.0,
    reviewsCount: 512,
    salesCount: 3890,
    image: 'https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?w=500',
    description: 'Royalty-free analog drum shots, punchy 808s, synth textures, and vocal chops used in over 1M viral reels.',
    includes: ['320 24-bit WAV samples', 'MIDI chord progressions', 'Ableton & FL Studio projects', '100% Royalty Free'],
    isDigital: true
  },
  {
    id: 'prod-hoodie-arv',
    title: 'Arvdoul Creator Heavyweight Oversized Hoodie',
    category: 'Merch & Apparel',
    creator: {
      name: 'Arvdoul Official Store',
      username: '@arvdoul_brand',
      avatar: '/logo/logo-dark.png',
      badge: 'Official'
    },
    priceCoins: 4500,
    priceUsd: 59.00,
    rating: 4.8,
    reviewsCount: 142,
    salesCount: 840,
    image: 'https://images.unsplash.com/photo-1556905055-8f358a7a47b2?w=500',
    description: '450 GSM luxury french terry cotton hoodie with embroidered neon Arvdoul crest and custom matte metal aglets.',
    includes: ['Heavyweight 450 GSM Cotton', 'Custom collector sticker pack', 'Free Worldwide Express Shipping'],
    isDigital: false,
    sizes: ['S', 'M', 'L', 'XL', '2XL']
  },
  {
    id: 'prod-vip-pass',
    title: 'VIP Masterclass & 1-on-1 Portfolio Review',
    category: 'Mentorship & VIP',
    creator: {
      name: 'Sarah Chen',
      username: '@sarahchen_ai',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
      badge: 'VIP'
    },
    priceCoins: 8000,
    priceUsd: 99.00,
    rating: 5.0,
    reviewsCount: 89,
    salesCount: 140,
    image: 'https://images.unsplash.com/photo-1531482615713-2afd69097998?w=500',
    description: 'Direct 45-minute video call review of your content channel, monetization funnel, and custom viral roadmap.',
    includes: ['45m Zoom / Call', 'Full channel audit PDF', 'Private Telegram access for 30 days'],
    isDigital: true
  }
];

class MarketplaceService {
  constructor() {
    this.products = [...SAMPLE_PRODUCTS];
    this.cart = [];
    this.orders = [];
  }

  async getProducts(category = 'All') {
    log.info('Fetching marketplace products', { category });
    await new Promise(r => setTimeout(r, 200));
    if (category === 'All') return this.products;
    return this.products.filter(p => p.category.toLowerCase().includes(category.toLowerCase()));
  }

  async getProductById(id) {
    const prod = this.products.find(p => p.id === id);
    return prod || this.products[0];
  }

  async purchaseProductWithCoins(productId, userCoins, onDeductCoins) {
    log.info('Purchasing product with coins', { productId });
    const product = await this.getProductById(productId);
    
    if (userCoins < product.priceCoins) {
      throw new Error(`Insufficient Arvdoul Coins. You need ${product.priceCoins} coins, but have ${userCoins}.`);
    }

    if (onDeductCoins) {
      onDeductCoins(product.priceCoins);
    }

    const order = {
      orderId: `ARV-ORD-${Date.now().toString().slice(-6)}`,
      product,
      purchasedAt: new Date().toISOString(),
      amountPaidCoins: product.priceCoins,
      downloadUrl: product.isDigital ? 'https://arvdoul.cloud/downloads/pack-instant.zip' : null,
      status: 'Completed'
    };

    this.orders.unshift(order);
    return order;
  }

  async listNewProduct(productData, creator) {
    const newProd = {
      id: `prod-${Date.now()}`,
      title: productData.title,
      category: productData.category || 'Digital Assets',
      creator: {
        name: creator?.displayName || 'Arvdoul Creator',
        username: creator?.username || '@creator',
        avatar: creator?.photoURL || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
        badge: 'Verified'
      },
      priceCoins: Number(productData.priceCoins) || 1000,
      priceUsd: Number(productData.priceUsd) || 12.99,
      rating: 5.0,
      reviewsCount: 1,
      salesCount: 0,
      image: productData.image || 'https://images.unsplash.com/photo-1514565131-fce0801e5785?w=500',
      description: productData.description || 'Exclusive creator asset.',
      includes: productData.includes ? productData.includes.split('\n') : ['Instant digital download'],
      isDigital: productData.isDigital !== false
    };

    this.products.unshift(newProd);
    return newProd;
  }
}

export const marketplaceService = new MarketplaceService();
export default marketplaceService;
