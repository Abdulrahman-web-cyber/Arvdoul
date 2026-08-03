// src/screens/CollectionsScreen.jsx - ARVDOUL COLLECTIONS (REAL)
// User-curated collections backed by collectionsService (CRUD + items).
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '@context/ThemeContext';
import { cn } from '../lib/utils';
import { ArrowLeft, Plus, FolderOpen, Trash2, Loader2, Bookmark } from 'lucide-react';

export default function CollectionsScreen() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const [collections, setCollections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [creating, setCreating] = useState(false);

  const colors = {
    bg: isDark ? 'bg-gradient-to-br from-[#060816] via-[#0b1220] to-[#02040a]' : 'bg-gradient-to-br from-[#f0f4fa] via-white to-[#eef2f8]',
    card: isDark ? 'bg-gray-900/70 border-gray-800' : 'bg-white/90 border-gray-200',
    text: isDark ? 'text-white' : 'text-gray-900',
    secondary: isDark ? 'text-gray-400' : 'text-gray-600',
  };

  const load = useCallback(async () => {
    if (!user?.uid) return;
    setLoading(true);
    try {
      const { getCollectionsService } = await import('../services/collectionsService.js');
      const res = await getCollectionsService().getCollections(user.uid, { limit: 50 });
      setCollections(res.collections || []);
    } catch (err) {
      toast.error('Could not load collections.');
    } finally {
      setLoading(false);
    }
  }, [user?.uid]);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async () => {
    if (!user?.uid || creating) return;
    if (!name.trim()) { toast.error('Give your collection a name.'); return; }
    setCreating(true);
    try {
      const { getCollectionsService } = await import('../services/collectionsService.js');
      const res = await getCollectionsService().createCollection(user.uid, { name });
      if (res.success) {
        toast.success('Collection created!');
        setShowCreate(false);
        setName('');
        await load();
      }
    } catch (err) {
      toast.error(err?.message || 'Could not create collection.');
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (collectionId) => {
    if (!user?.uid) return;
    if (!window.confirm('Delete this collection and all its items?')) return;
    try {
      const { getCollectionsService } = await import('../services/collectionsService.js');
      await getCollectionsService().deleteCollection(user.uid, collectionId);
      toast.success('Collection deleted.');
      await load();
    } catch (err) {
      toast.error('Could not delete collection.');
    }
  };

  return (
    <div className={cn("min-h-screen pb-16", colors.bg)}>
      <div className={cn("sticky top-0 z-50 border-b backdrop-blur-xl", colors.card, "border")}>
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center gap-3">
          <button onClick={() => navigate(-1)} aria-label="Go back" className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className={cn("text-xl font-bold", colors.text)}>Collections</h1>
          <button
            onClick={() => setShowCreate(true)}
            className="ml-auto p-2 rounded-full bg-violet-500/15 text-violet-500 hover:bg-violet-500/25"
            aria-label="Create collection"
          >
            <Plus className="w-5 h-5" />
          </button>
        </div>
      </div>

      <main className="max-w-3xl mx-auto px-4 py-6">
        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="w-7 h-7 text-violet-500 animate-spin" /></div>
        ) : collections.length === 0 ? (
          <div className="text-center py-16">
            <FolderOpen className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className={cn("font-semibold", colors.text)}>No collections yet</p>
            <p className={cn("text-sm mt-1 mb-6", colors.secondary)}>Group your saved posts into collections.</p>
            <button
              onClick={() => setShowCreate(true)}
              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-violet-500 to-cyan-500 text-white font-semibold"
            >
              Create Collection
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {collections.map((c, i) => (
              <motion.div
                key={c.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i * 0.05, 0.3) }}
                className={cn("rounded-2xl p-5", colors.card, "border", "cursor-pointer hover:shadow-lg transition")}
                onClick={() => navigate(`/saved`)}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-violet-500/20 to-cyan-500/20 flex items-center justify-center">
                    <FolderOpen className="w-5 h-5 text-violet-500" />
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDelete(c.id); }}
                    aria-label="Delete collection"
                    className="p-1.5 rounded-full text-gray-400 hover:text-red-500 hover:bg-red-500/10"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                <h3 className={cn("font-bold", colors.text)}>{c.name}</h3>
                {c.description && <p className={cn("text-sm mt-1 line-clamp-2", colors.secondary)}>{c.description}</p>}
                <p className={cn("text-xs mt-3 flex items-center gap-1", colors.secondary)}>
                  <Bookmark className="w-3.5 h-3.5" /> {c.itemCount || 0} items
                </p>
              </motion.div>
            ))}
          </div>
        )}
      </main>

      {/* Create modal */}
      <AnimatePresence>
        {showCreate && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setShowCreate(false)}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }}
              className={cn("w-full max-w-sm rounded-2xl p-6", colors.card, "border")}
              onClick={(e) => e.stopPropagation()}
            >
              <h2 className={cn("text-lg font-bold mb-4", colors.text)}>New Collection</h2>
              <input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                placeholder="Collection name"
                className={cn("w-full px-4 py-3 rounded-xl border outline-none focus:ring-2 focus:ring-violet-500 mb-4", isDark ? "bg-gray-800 border-gray-700 text-white" : "bg-gray-100 border-gray-200 text-gray-900")}
              />
              <div className="flex gap-3">
                <button onClick={() => setShowCreate(false)} className="flex-1 py-2.5 rounded-xl bg-gray-200 dark:bg-gray-800 font-semibold text-gray-700 dark:text-gray-200">
                  Cancel
                </button>
                <button
                  onClick={handleCreate}
                  disabled={creating}
                  className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-violet-500 to-cyan-500 text-white font-semibold disabled:opacity-60"
                >
                  {creating ? 'Creating…' : 'Create'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
