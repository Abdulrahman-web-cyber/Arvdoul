// src/screens/Marketplace/MarketplaceScreen.jsx
// 🛍️ ARVDOUL CREATOR MARKETPLACE & STORE
// Digital presets, sample packs, creator merchandise, 1-click coin checkout, and digital delivery

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ShoppingBag, 
  Coins, 
  Star, 
  Download, 
  Check, 
  Plus, 
  X, 
  Sparkles, 
  Tag, 
  ShieldCheck, 
  ArrowRight, 
  ExternalLink,
  Crown
} from 'lucide-react';
import { toast } from 'sonner';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { useAppStore } from '../../store/appStore';
import marketplaceService from '../../services/marketplaceService';
import LoadingSpinner from '../../components/Shared/LoadingSpinner';

const CATEGORIES = ['All', 'Digital Assets', 'Audio & Sounds', 'Merch & Apparel', 'Mentorship & VIP'];

export default function MarketplaceScreen() {
  const navigate = useNavigate();
  const { theme } = useTheme();
  const { user } = useAuth();
  const { currentUser, setAppState } = useAppStore();
  const isDark = theme === 'dark';

  const [products, setProducts] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [loading, setLoading] = useState(true);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [purchasedOrder, setPurchasedOrder] = useState(null);

  // List product modal
  const [isListModalOpen, setIsListModalOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newCategory, setNewCategory] = useState('Digital Assets');
  const [newPriceCoins, setNewPriceCoins] = useState(1200);
  const [newDescription, setNewDescription] = useState('');

  useEffect(() => {
    loadProducts();
  }, [selectedCategory]);

  const loadProducts = async () => {
    setLoading(true);
    try {
      const data = await marketplaceService.getProducts(selectedCategory);
      setProducts(data);
    } catch {
      toast.error('Failed to load marketplace');
    } finally {
      setLoading(false);
    }
  };

  const handleBuyWithCoins = async (product) => {
    try {
      // Real server-side debit (spendCoins CF) — the service checks the real
      // balance and deducts coins on the ledger. No client-supplied balance,
      // no fabricated defaults.
      const order = await marketplaceService.purchaseProductWithCoins(product.id, user);
      setPurchasedOrder(order);
      // Refresh the user's real coin balance after the ledger debit.
      try {
        const { getMonetizationService } = await import('../../services/monetizationService.js');
        const bal = await getMonetizationService().getBalance(user?.uid);
        if (currentUser && typeof bal === 'number') {
          setAppState({ currentUser: { ...currentUser, coins: bal } });
        }
      } catch { /* balance refresh is best-effort */ }
      toast.success(`Purchased "${product.title}" with ${product.priceCoins} Coins! 🎁`);
    } catch (err) {
      toast.error(err.message || 'Purchase failed');
    }
  };

  const handleListProduct = async (e) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    try {
      const created = await marketplaceService.listNewProduct(
        {
          title: newTitle,
          category: newCategory,
          priceCoins: newPriceCoins,
          description: newDescription
        },
        user
      );
      setProducts([created, ...products]);
      setIsListModalOpen(false);
      setNewTitle('');
      setNewDescription('');
      toast.success('Your product is now listed on Arvdoul Marketplace! 🛍️');
    } catch {
      toast.error('Failed to list product');
    }
  };

  return (
    <div className="min-h-screen pb-32 pt-2 max-w-6xl mx-auto px-3 sm:px-6">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-3xl p-6 sm:p-8 bg-gradient-to-r from-emerald-900/80 via-teal-900/80 to-purple-900/80 border border-emerald-500/30 shadow-2xl backdrop-blur-xl mb-8">
        <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Sparkles className="w-4 h-4 text-emerald-400" />
              <span className="text-xs font-bold text-emerald-300 uppercase tracking-wider">Arvdoul Creator Commerce</span>
            </div>
            <h1 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight flex items-center gap-3">
              Creator Marketplace <ShoppingBag className="w-7 h-7 text-emerald-400" />
            </h1>
            <p className="text-gray-300 text-xs sm:text-sm mt-1 max-w-xl">
              Buy & sell digital LUTs, preset packs, sample libraries, creator merchandise, and 1-on-1 VIP mentorship with 0% platform fees.
            </p>
          </div>

          <button
            onClick={() => setIsListModalOpen(true)}
            className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-bold text-sm shadow-xl shadow-emerald-500/25 hover:scale-105 transition-all whitespace-nowrap"
          >
            <Plus className="w-4 h-4" /> Sell a Product
          </button>
        </div>
      </div>

      {/* Categories Filter */}
      <div className="flex items-center gap-2 overflow-x-auto pb-3 mb-6 scrollbar-none">
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={`px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
              selectedCategory === cat
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-500/30'
                : isDark ? 'bg-gray-800/80 text-gray-400 hover:text-white' : 'bg-white text-gray-700 shadow-sm'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Products Grid */}
      {loading ? (
        <div className="p-16 flex justify-center"><LoadingSpinner size="lg" /></div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {products.map((prod) => (
            <div
              key={prod.id}
              className={`rounded-3xl border overflow-hidden flex flex-col justify-between transition-all duration-300 hover:-translate-y-1.5 hover:shadow-2xl ${
                isDark ? 'bg-gray-900/80 border-gray-800 hover:border-emerald-500/50' : 'bg-white border-gray-200'
              }`}
            >
              <div>
                <div className="relative h-48 overflow-hidden group cursor-pointer" onClick={() => setSelectedProduct(prod)}>
                  {prod.image ? (
                    <img src={prod.image} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-purple-900/60 to-blue-900/60 flex items-center justify-center">
                      <ShoppingBag className="w-10 h-10 text-white/40" />
                    </div>
                  )}
                  <div className="absolute top-3 left-3 px-2.5 py-1 bg-black/70 backdrop-blur-md rounded-full text-[10px] font-bold text-white uppercase">
                    {prod.category}
                  </div>
                  {prod.creator?.badge && (
                    <div className="absolute top-3 right-3 px-2.5 py-1 bg-emerald-500/90 rounded-full text-[10px] font-extrabold text-white">
                      {prod.creator.badge}
                    </div>
                  )}
                </div>

                <div className="p-5 space-y-3">
                  <div className="flex items-center gap-2">
                    {prod.creator?.avatar ? (
                      <img src={prod.creator.avatar} alt="" className="w-5 h-5 rounded-full object-cover" />
                    ) : (
                      <div className="w-5 h-5 rounded-full bg-purple-600/50 flex items-center justify-center text-[10px] font-bold text-white shrink-0">
                        {(prod.creator?.name || '?').charAt(0).toUpperCase()}
                      </div>
                    )}
                    <span className="text-xs text-gray-400 font-medium truncate">{prod.creator?.name || 'Seller'}</span>
                  </div>

                  <h3
                    onClick={() => setSelectedProduct(prod)}
                    className="font-bold text-sm text-white line-clamp-2 cursor-pointer hover:text-emerald-400 transition-colors"
                  >
                    {prod.title}
                  </h3>

                  <div className="flex items-center justify-between pt-1">
                    <div className="flex items-center gap-1 text-yellow-400 text-xs font-bold">
                      <Star className="w-3.5 h-3.5 fill-yellow-400" /> {prod.rating} ({prod.reviewsCount})
                    </div>
                    <span className="text-[11px] text-gray-400">{prod.salesCount} sold</span>
                  </div>
                </div>
              </div>

              {/* Bottom Price & Buy */}
              <div className="p-5 pt-0 border-t border-gray-800/60 mt-3 flex items-center justify-between gap-2">
                <div>
                  <span className="text-xs text-gray-400 block">Price</span>
                  <div className="flex items-center gap-1 font-extrabold text-sm text-yellow-400">
                    <Coins className="w-4 h-4" /> {prod.priceCoins.toLocaleString()}
                  </div>
                </div>

                <button
                  onClick={() => handleBuyWithCoins(prod)}
                  className="px-4 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white rounded-xl text-xs font-bold shadow-lg shadow-emerald-500/20 flex items-center gap-1"
                >
                  Buy with Coins
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ==================== PRODUCT DETAILS MODAL ==================== */}
      <AnimatePresence>
        {selectedProduct && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md"
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              className={`w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 sm:p-8 rounded-3xl border ${
                isDark ? 'bg-gray-900 border-gray-800' : 'bg-white'
              } shadow-2xl space-y-6`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  {selectedProduct.creator?.avatar ? (
                    <img src={selectedProduct.creator.avatar} alt="" className="w-10 h-10 rounded-full object-cover" />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-purple-600/50 flex items-center justify-center font-bold text-white shrink-0">
                      {(selectedProduct.creator?.name || '?').charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div>
                    <h3 className="font-bold text-xs text-emerald-400 uppercase">{selectedProduct.category}</h3>
                    <span className="text-sm font-semibold text-white">{selectedProduct.creator?.name || 'Seller'}</span>
                  </div>
                </div>
                <button onClick={() => setSelectedProduct(null)} className="text-gray-400 hover:text-white p-1">
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="relative h-64 rounded-2xl overflow-hidden">
                {selectedProduct.image ? (
                  <img src={selectedProduct.image} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-purple-900/60 to-blue-900/60 flex items-center justify-center">
                    <ShoppingBag className="w-12 h-12 text-white/40" />
                  </div>
                )}
              </div>

              <div>
                <h2 className="text-xl sm:text-2xl font-bold text-white mb-2">{selectedProduct.title}</h2>
                <p className="text-sm text-gray-300 leading-relaxed font-sans">{selectedProduct.description}</p>
              </div>

              {selectedProduct.includes && (
                <div className="p-4 rounded-2xl bg-gray-800/50 border border-gray-700/60 space-y-2">
                  <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider block">What's Included:</span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {selectedProduct.includes.map((inc, idx) => (
                      <div key={idx} className="flex items-center gap-2 text-xs text-gray-200">
                        <Check className="w-4 h-4 text-emerald-400 shrink-0" /> {inc}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between pt-4 border-t border-gray-800">
                <div className="flex items-center gap-2">
                  <Coins className="w-6 h-6 text-yellow-400" />
                  <span className="text-2xl font-extrabold text-yellow-400">{selectedProduct.priceCoins.toLocaleString()} Coins</span>
                  <span className="text-xs text-gray-400">(${selectedProduct.priceUsd})</span>
                </div>

                <button
                  onClick={() => {
                    handleBuyWithCoins(selectedProduct);
                    setSelectedProduct(null);
                  }}
                  className="px-6 py-3 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-2xl text-sm font-bold shadow-xl shadow-emerald-500/30 hover:scale-105 transition-transform flex items-center gap-2"
                >
                  Confirm & Buy Now
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ==================== PURCHASE SUCCESS RECEIPT MODAL ==================== */}
      <AnimatePresence>
        {purchasedOrder && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md"
          >
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              className={`w-full max-w-md p-6 sm:p-8 rounded-3xl border border-emerald-500/40 ${
                isDark ? 'bg-gray-900' : 'bg-white'
              } shadow-2xl text-center space-y-5`}
            >
              <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto ring-4 ring-emerald-500/40">
                <Check className="w-8 h-8" />
              </div>

              <div>
                <span className="text-xs font-bold text-emerald-400 uppercase tracking-widest block mb-1">Order Confirmed</span>
                <h3 className="text-xl font-extrabold text-white">{purchasedOrder.product.title}</h3>
                <p className="text-xs text-gray-400 mt-1">Receipt ID: {purchasedOrder.orderId}</p>
              </div>

              <div className="p-4 rounded-2xl bg-gray-800/60 border border-gray-700 text-left space-y-1.5 text-xs text-gray-300">
                <div className="flex justify-between">
                  <span>Paid With:</span>
                  <span className="font-bold text-yellow-400">{purchasedOrder.amountPaidCoins} Arvdoul Coins</span>
                </div>
                <div className="flex justify-between">
                  <span>Status:</span>
                  <span className="font-bold text-emerald-400">{purchasedOrder.status}</span>
                </div>
              </div>

              {purchasedOrder.downloadUrl ? (
                <a
                  href={purchasedOrder.downloadUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="w-full py-4 rounded-2xl font-bold bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-xl shadow-emerald-500/30 flex items-center justify-center gap-2 hover:opacity-95"
                >
                  <Download className="w-5 h-5" /> Download Digital Asset Pack (.zip)
                </a>
              ) : (
                <div className="p-3 bg-purple-500/20 rounded-xl text-xs font-medium text-purple-300">
                  Purchase complete — the seller provides delivery/access for this item. No fake tracking link is shown.
                </div>
              )}

              <button
                onClick={() => setPurchasedOrder(null)}
                className="w-full py-3 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-xl text-xs font-semibold"
              >
                Close Receipt
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ==================== LIST PRODUCT MODAL ==================== */}
      <AnimatePresence>
        {isListModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              className={`w-full max-w-md p-6 rounded-3xl border ${isDark ? 'bg-gray-900 border-gray-800' : 'bg-white'} shadow-2xl space-y-4`}
            >
              <div className="flex items-center justify-between pb-3 border-b border-gray-800">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <ShoppingBag className="w-5 h-5 text-emerald-400" /> List Product on Marketplace
                </h3>
                <button onClick={() => setIsListModalOpen(false)} className="text-gray-400 hover:text-white">
                  ✕
                </button>
              </div>

              <form onSubmit={handleListProduct} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Product Title</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Master LUTs & Sound Kit 2026"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    className={`w-full p-3.5 rounded-xl text-sm border focus:ring-2 focus:ring-emerald-500 outline-none ${
                      isDark ? 'bg-gray-800 border-gray-700 text-white' : 'bg-gray-50'
                    }`}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Category</label>
                    <select
                      value={newCategory}
                      onChange={(e) => setNewCategory(e.target.value)}
                      className={`w-full p-3 rounded-xl text-xs border ${isDark ? 'bg-gray-800 border-gray-700 text-white' : 'bg-gray-50'}`}
                    >
                      {CATEGORIES.filter((c) => c !== 'All').map((cat) => (
                        <option key={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Price (Coins)</label>
                    <input
                      type="number"
                      required
                      value={newPriceCoins}
                      onChange={(e) => setNewPriceCoins(e.target.value)}
                      className={`w-full p-3 rounded-xl text-xs border ${isDark ? 'bg-gray-800 border-gray-700 text-white' : 'bg-gray-50'}`}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Description</label>
                  <textarea
                    rows={3}
                    placeholder="Describe what the buyer gets..."
                    value={newDescription}
                    onChange={(e) => setNewDescription(e.target.value)}
                    className={`w-full p-3.5 rounded-xl text-sm border focus:ring-2 focus:ring-emerald-500 outline-none ${
                      isDark ? 'bg-gray-800 border-gray-700 text-white' : 'bg-gray-50'
                    }`}
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-4 rounded-2xl font-bold bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-xl shadow-emerald-500/25 hover:opacity-95"
                >
                  🚀 Publish to Marketplace
                </button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
