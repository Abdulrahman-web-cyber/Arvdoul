/**
 * src/screens/CollectionsScreen.jsx - ARVDOUL Ultimate Collections & Folders Manager
 * 
 * Production-ready collections management with custom folders, cover art,
 * privacy controls, batch organization, and live item counts.
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, FolderOpen, Plus, Trash2, Folder, Lock, Globe,
  MoreVertical, Edit2, Share2, Grid, Sparkles, Image as ImageIcon,
  Check, X, FolderPlus
} from 'lucide-react';
import { toast } from 'sonner';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { cn } from '../lib/utils';

export default function CollectionsScreen() {
  const navigate = useNavigate();
  const { theme } = useTheme();
  const isDark = theme !== 'light';
  const { user } = useAuth();

  const [collections, setCollections] = useState([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newIsPrivate, setNewIsPrivate] = useState(false);

  // Load REAL collections from collectionsService (Firestore-backed)
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!user?.uid) return;
      try {
        const { default: collectionsService } = await import('../services/collectionsService.js');
        const res = await collectionsService.getCollections(user?.uid, { cacheFirst: false });
        if (cancelled) return;
        const mapped = (res.collections || []).map((c) => ({
          id: c.id,
          title: c.name || c.title || 'Untitled',
          description: c.description || '',
          itemCount: c.itemCount || 0,
          isPrivate: Boolean(c.isPrivate),
          cover: c.coverUrl || '/assets/default-profile.png',
          lastUpdated: c.updatedAt
            ? new Date(c.updatedAt.toDate ? c.updatedAt.toDate() : c.updatedAt).toLocaleDateString()
            : 'Recently',
        }));
        setCollections(mapped);
      } catch (err) {
        console.error('Failed to load collections:', err);
        if (!cancelled) setCollections([]);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [user?.uid]);

  // Create Collection (REAL: persists via collectionsService)
  const handleCreateCollection = async (e) => {
    e.preventDefault();
    if (!newTitle.trim()) {
      toast.error('Please enter a collection title');
      return;
    }
    try {
      const { default: collectionsService } = await import('../services/collectionsService.js');
      const res = await collectionsService.createCollection(user?.uid, {
        name: newTitle.trim(),
        description: newDesc.trim() || 'Custom curated collection',
        isPrivate: newIsPrivate,
      });
      if (!res.success) throw new Error(res.error || 'Failed to create');
      toast.success(`Created collection "${newTitle}"! 📁`);
      setNewTitle('');
      setNewDesc('');
      setNewIsPrivate(false);
      setShowCreateModal(false);
      // Reload from the server so the list reflects the real state
      const reload = await collectionsService.getCollections(user?.uid, { cacheFirst: false });
      if (reload.success) {
        setCollections((reload.collections || []).map((c) => ({
          id: c.id,
          title: c.name || c.title || 'Untitled',
          description: c.description || '',
          itemCount: c.itemCount || 0,
          isPrivate: Boolean(c.isPrivate),
          cover: c.coverUrl || '/assets/default-profile.png',
          lastUpdated: c.updatedAt
            ? new Date(c.updatedAt.toDate ? c.updatedAt.toDate() : c.updatedAt).toLocaleDateString()
            : 'Recently',
        })));
      }
    } catch (err) {
      console.error(err);
      toast.error(err.message || 'Failed to create collection');
    }
  };

  // Delete Collection (REAL)
  const handleDeleteCollection = async (id, title) => {
    if (!window.confirm(`Delete folder "${title}"?`)) return;
    try {
      const { default: collectionsService } = await import('../services/collectionsService.js');
      await collectionsService.deleteCollection(user?.uid, id);
      setCollections((prev) => prev.filter((c) => c.id !== id));
      toast.success(`Deleted folder "${title}"`);
    } catch (err) {
      console.error(err);
      toast.error(err.message || 'Failed to delete collection');
    }
  };

  return (
    <div className={cn(
      "min-h-screen pb-24 transition-colors duration-200",
      isDark ? "bg-[#0B0F17] text-white" : "bg-gray-50 text-gray-900"
    )}>
      {/* Header */}
      <header className={cn(
        "sticky top-0 z-40 backdrop-blur-xl border-b transition-colors",
        isDark ? "bg-[#0B0F17]/85 border-white/10" : "bg-white/85 border-gray-200"
      )}>
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate(-1)}
              className={cn(
                "p-2 rounded-full transition-all",
                isDark ? "hover:bg-white/10 text-gray-300" : "hover:bg-gray-100 text-gray-700"
              )}
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2">
              <FolderOpen className="w-5 h-5 text-purple-400" />
              <h1 className="font-bold text-lg">My Collections</h1>
            </div>
          </div>

          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl font-bold text-xs bg-gradient-to-r from-purple-600 to-indigo-600 text-white hover:opacity-95 shadow-md shadow-purple-500/20"
          >
            <Plus className="w-4 h-4" />
            <span>New Folder</span>
          </button>
        </div>
      </header>

      {/* Main Grid */}
      <main className="max-w-5xl mx-auto px-4 pt-6">
        <p className="text-xs text-gray-400 mb-6">
          Organize your saved posts, sparks, and creative audio presets into private or public folders.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {/* Create New Folder Card */}
          <button
            onClick={() => setShowCreateModal(true)}
            className={cn(
              "group aspect-[4/3] rounded-3xl border-2 border-dashed flex flex-col items-center justify-center p-6 text-center transition-all cursor-pointer",
              isDark ? "border-white/15 bg-white/[0.02] hover:border-purple-500/50 hover:bg-purple-500/5" : "border-gray-300 bg-white hover:border-purple-500 hover:bg-purple-50"
            )}
          >
            <div className="w-12 h-12 rounded-2xl bg-purple-500/20 flex items-center justify-center text-purple-400 mb-3 group-hover:scale-110 transition-transform">
              <FolderPlus className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-sm">Create New Folder</h3>
            <p className="text-xs text-gray-400 mt-1">Group assets by theme</p>
          </button>

          {/* Collection Cards */}
          {collections.map((c) => (
            <div
              key={c.id}
              onClick={() => navigate('/saved')}
              className={cn(
                "group relative aspect-[4/3] rounded-3xl overflow-hidden cursor-pointer border transition-all duration-300 shadow-lg flex flex-col justify-end p-5",
                isDark ? "bg-gray-900 border-white/10" : "bg-white border-gray-200"
              )}
            >
              {/* Cover Background */}
              <img
                src={c.cover}
                alt={c.title}
                className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-black/10" />

              {/* Badges Top Bar */}
              <div className="absolute top-3.5 left-3.5 right-3.5 flex items-center justify-between z-10">
                <span className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-black/60 backdrop-blur-md text-[11px] font-bold text-white border border-white/10">
                  {c.isPrivate ? <Lock className="w-3 h-3 text-amber-400" /> : <Globe className="w-3 h-3 text-blue-400" />}
                  <span>{c.isPrivate ? 'Private' : 'Public'}</span>
                </span>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteCollection(c.id, c.title);
                  }}
                  className="p-1.5 rounded-full bg-black/60 backdrop-blur-md text-gray-300 hover:text-rose-400 transition-colors"
                  title="Delete Folder"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Content Bottom */}
              <div className="relative z-10 text-white space-y-1">
                <div className="flex items-center gap-2">
                  <Folder className="w-4 h-4 text-purple-400" />
                  <h3 className="font-bold text-base leading-tight truncate">{c.title}</h3>
                </div>
                <p className="text-xs text-gray-300 line-clamp-1">{c.description}</p>
                <div className="flex items-center justify-between text-[11px] text-gray-400 pt-1 font-semibold">
                  <span>{c.itemCount} items</span>
                  <span>Updated {c.lastUpdated}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </main>

      {/* Create Modal */}
      <AnimatePresence>
        {showCreateModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className={cn(
                "w-full max-w-md p-6 rounded-3xl border shadow-2xl space-y-4",
                isDark ? "bg-[#111622] border-white/15 text-white" : "bg-white border-gray-200 text-gray-900"
              )}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 font-bold text-lg">
                  <FolderPlus className="w-5 h-5 text-purple-400" />
                  <span>Create Collection Folder</span>
                </div>
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="p-1.5 rounded-full hover:bg-white/10"
                >
                  <X className="w-5 h-5 text-gray-400" />
                </button>
              </div>

              <form onSubmit={handleCreateCollection} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-1.5">
                    Folder Name
                  </label>
                  <input
                    type="text"
                    required
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    placeholder="e.g. 3D Spatial Shaders, Audio Loops"
                    className={cn(
                      "w-full px-4 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-purple-500",
                      isDark ? "bg-white/5 border-white/10 text-white" : "bg-white border-gray-300 text-gray-900"
                    )}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-1.5">
                    Description (Optional)
                  </label>
                  <input
                    type="text"
                    value={newDesc}
                    onChange={(e) => setNewDesc(e.target.value)}
                    placeholder="Short summary of folder contents..."
                    className={cn(
                      "w-full px-4 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-purple-500",
                      isDark ? "bg-white/5 border-white/10 text-white" : "bg-white border-gray-300 text-gray-900"
                    )}
                  />
                </div>

                <div className="flex items-center justify-between p-3 rounded-2xl bg-white/5 border border-white/10">
                  <div className="flex items-center gap-2.5">
                    <Lock className="w-4 h-4 text-amber-400" />
                    <div>
                      <p className="text-xs font-bold">Private Collection</p>
                      <p className="text-[11px] text-gray-400">Only you can view this folder</p>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={newIsPrivate}
                    onChange={(e) => setNewIsPrivate(e.target.checked)}
                    className="w-4 h-4 accent-purple-500 rounded cursor-pointer"
                  />
                </div>

                <div className="flex items-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className={cn(
                      "flex-1 py-2.5 rounded-xl font-bold text-xs transition-all",
                      isDark ? "bg-white/10 text-gray-300 hover:bg-white/20" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    )}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-2.5 rounded-xl font-bold text-xs bg-gradient-to-r from-purple-600 to-indigo-600 text-white hover:opacity-95 shadow-md shadow-purple-500/20"
                  >
                    Create Folder
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
