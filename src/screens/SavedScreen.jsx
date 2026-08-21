/**
 * src/screens/SavedScreen.jsx - ARVDOUL Ultimate Saved & Bookmarks Screen
 * 
 * Production-ready saved items manager with collection folders, filters,
 * multi-select batch actions, search, and rich media previews.
 */

import React, { useState, useEffect, useMemo, useCallback} from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, Bookmark, Trash2, FolderPlus, Search, Filter,
  Grid, List, Share2, Play, Heart, MessageCircle, MoreVertical,
  Plus, CheckSquare, Square, Folder, ExternalLink, Sparkles,
  Download, Eye, Film, Image as ImageIcon, Music, Tag
} from 'lucide-react';
import { toast } from 'sonner';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { cn } from '../lib/utils';

const COLLECTIONS = [
  'All',
  'Design Systems',
  'LUTs & VFX',
  'Inspiration',
  'Audio Library'
];

export default function SavedScreen() {
  const navigate = useNavigate();
  const { theme } = useTheme();
  const { user } = useAuth();
  const isDark = theme !== 'light';

  const [items, setItems] = useState([]);
  const [savedLoading, setSavedLoading] = useState(true);
  // Load REAL saved posts from firestoreService
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!user?.uid) { setSavedLoading(false); return; }
      try {
        const { getFirestoreService } = await import('../services/firestoreService.js');
        const res = await getFirestoreService().getSavedPosts(user.uid, { limit: 30 });
        if (cancelled) return;
        const mapped = (res.posts || []).map((p, i) => ({
          id: p.id || `saved-${i}`,
          title: p.caption || p.content?.slice(0, 60) || 'Saved post',
          author: {
            name: p.authorName || 'Creator',
            username: p.authorHandle || p.authorUsername || 'creator',
            avatar: p.authorPhoto || '/assets/default-profile.png',
          },
          type: p.type || 'post',
          thumbnail: (p.media && p.media[0]?.url) || p.mediaUrl || '/assets/default-profile.png',
          savedAt: p.savedAt || 'Recently',
          likes: p.likeCount || 0,
          collection: p.collection || 'Saved',
          tags: p.hashtags || [],
        }));
        setItems(mapped);
      } catch (err) {
        console.error('Failed to load saved posts:', err);
        if (!cancelled) setItems([]);
      } finally {
        if (!cancelled) setSavedLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [user?.uid]);

  const [activeCollection, setActiveCollection] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState('grid'); // 'grid' | 'list'
  const [selectedIds, setSelectedIds] = useState([]);
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [activeTypeFilter, setActiveTypeFilter] = useState('all'); // 'all' | 'video' | 'image' | 'audio' | 'preset'

  // Filtered items
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      // Collection filter
      if (activeCollection !== 'All' && item.collection !== activeCollection) {
        return false;
      }
      // Type filter
      if (activeTypeFilter !== 'all' && item.type !== activeTypeFilter) {
        return false;
      }
      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = item.title.toLowerCase().includes(q);
        const matchesAuthor = item.author.name.toLowerCase().includes(q);
        const matchesTag = item.tags?.some(t => t.toLowerCase().includes(q));
        if (!matchesTitle && !matchesAuthor && !matchesTag) return false;
      }
      return true;
    });
  }, [items, activeCollection, activeTypeFilter, searchQuery]);

  // Remove single item
  const handleRemoveItem = (id, title) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
    toast.success(`Removed "${title}" from saved`);
  };

  // Toggle selection
  const handleToggleSelect = (id) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  // Delete all selected
  const handleDeleteSelected = () => {
    if (selectedIds.length === 0) return;
    setItems((prev) => prev.filter((i) => !selectedIds.includes(i.id)));
    toast.success(`Removed ${selectedIds.length} items from saved`);
    setSelectedIds([]);
    setIsSelectMode(false);
  };

  // Share item
  const handleShare = (item) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(`${window.location.origin}/post/${item.id}`);
      toast.success('Link copied to clipboard! 📋');
    }
  };

  return (
    <div className={cn(
      "min-h-screen pb-24 transition-colors duration-200",
      isDark ? "bg-[#0B0F17] text-white" : "bg-gray-50 text-gray-900"
    )}>
      {/* Top Header */}
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
              <Bookmark className="w-5 h-5 text-purple-400 fill-purple-400/20" />
              <h1 className="font-bold text-lg">Saved & Bookmarks</h1>
              <span className="px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-400 text-xs font-bold">
                {items.length}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate('/collections')}
              className={cn(
                "hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-semibold text-xs border transition-all",
                isDark ? "bg-white/5 border-white/10 hover:bg-white/10 text-gray-300" : "bg-white border-gray-200 hover:bg-gray-100 text-gray-700"
              )}
            >
              <Folder className="w-3.5 h-3.5 text-purple-400" />
              <span>Folders</span>
            </button>

            <button
              onClick={() => {
                setIsSelectMode(!isSelectMode);
                setSelectedIds([]);
              }}
              className={cn(
                "px-3 py-1.5 rounded-xl font-semibold text-xs border transition-all",
                isSelectMode
                  ? "bg-purple-600 border-purple-500 text-white"
                  : isDark ? "bg-white/5 border-white/10 text-gray-300" : "bg-white border-gray-200 text-gray-700"
              )}
            >
              {isSelectMode ? 'Cancel' : 'Select'}
            </button>

            <div className="flex items-center rounded-xl p-0.5 border border-white/10 bg-white/5">
              <button
                onClick={() => setViewMode('grid')}
                className={cn(
                  "p-1.5 rounded-lg transition-all",
                  viewMode === 'grid' ? "bg-purple-600 text-white" : "text-gray-400"
                )}
                title="Grid View"
              >
                <Grid className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={cn(
                  "p-1.5 rounded-lg transition-all",
                  viewMode === 'list' ? "bg-purple-600 text-white" : "text-gray-400"
                )}
                title="List View"
              >
                <List className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-5xl mx-auto px-4 pt-4">
        {/* Search & Type Filters */}
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search saved titles, tags, creators..."
              className={cn(
                "w-full pl-10 pr-4 py-2.5 rounded-2xl border text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/40",
                isDark ? "bg-white/5 border-white/10 text-white placeholder-gray-500" : "bg-white border-gray-200 text-gray-900 placeholder-gray-400"
              )}
            />
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            {[
              { id: 'all', label: 'All Media' },
              { id: 'video', label: 'Videos', icon: Film },
              { id: 'image', label: 'Images', icon: ImageIcon },
              { id: 'audio', label: 'Audio', icon: Music },
              { id: 'preset', label: 'Presets', icon: Sparkles },
            ].map((tf) => (
              <button
                key={tf.id}
                onClick={() => setActiveTypeFilter(tf.id)}
                className={cn(
                  "px-3 py-2 rounded-xl text-xs font-bold shrink-0 transition-all border",
                  activeTypeFilter === tf.id
                    ? "bg-purple-600 border-purple-500 text-white shadow-md shadow-purple-500/20"
                    : isDark ? "bg-white/5 border-white/10 text-gray-400 hover:text-white" : "bg-white border-gray-200 text-gray-600 hover:text-black"
                )}
              >
                {tf.label}
              </button>
            ))}
          </div>
        </div>

        {/* Collection Folders Bar */}
        <div className="flex items-center gap-2 overflow-x-auto pb-3 mb-4 scrollbar-none">
          {COLLECTIONS.map((c) => (
            <button
              key={c}
              onClick={() => setActiveCollection(c)}
              className={cn(
                "px-4 py-1.5 rounded-full text-xs font-bold shrink-0 transition-all border",
                activeCollection === c
                  ? "bg-white text-black border-white shadow-md"
                  : isDark ? "bg-white/5 border-white/10 text-gray-300 hover:bg-white/10" : "bg-gray-200/70 border-gray-300 text-gray-700 hover:bg-gray-200"
              )}
            >
              {c}
            </button>
          ))}
          <button
            onClick={() => navigate('/collections')}
            className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold text-purple-400 border border-purple-500/30 bg-purple-500/10 hover:bg-purple-500/20 shrink-0 transition-all"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Folder</span>
          </button>
        </div>

        {/* Batch Selection Action Bar */}
        {isSelectMode && selectedIds.length > 0 && (
          <div className="mb-4 p-3 rounded-2xl bg-purple-600 text-white flex items-center justify-between shadow-xl">
            <span className="text-xs font-bold ml-2">
              {selectedIds.length} item{selectedIds.length > 1 ? 's' : ''} selected
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={handleDeleteSelected}
                className="px-3.5 py-1.5 rounded-xl bg-white/20 hover:bg-white/30 text-xs font-bold flex items-center gap-1.5 transition-all"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete</span>
              </button>
            </div>
          </div>
        )}

        {/* Items Display */}
        {filteredItems.length === 0 ? (
          <div className="text-center py-16 space-y-3">
            <div className="w-16 h-16 mx-auto rounded-3xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
              <Bookmark className="w-8 h-8" />
            </div>
            <h3 className="text-base font-bold">No saved items in this category</h3>
            <p className="text-xs text-gray-400 max-w-sm mx-auto">
              Tap the bookmark icon on any post, video, or spark across ARVDOUL to store it here.
            </p>
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {filteredItems.map((item) => {
              const isSelected = selectedIds.includes(item.id);
              return (
                <div
                  key={item.id}
                  onClick={() => {
                    if (isSelectMode) {
                      handleToggleSelect(item.id);
                    } else {
                      navigate(`/post/${item.id}`);
                    }
                  }}
                  className={cn(
                    "group relative aspect-square rounded-2xl overflow-hidden cursor-pointer border transition-all duration-200 shadow-md",
                    isSelected ? "ring-4 ring-purple-500 border-purple-500" : isDark ? "bg-gray-900 border-white/10" : "bg-white border-gray-200"
                  )}
                >
                  <img
                    src={item.thumbnail}
                    alt={item.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />

                  {/* Type Badge */}
                  <div className="absolute top-2.5 left-2.5 p-1 rounded-lg bg-black/60 backdrop-blur-md text-white text-[10px] font-bold flex items-center gap-1">
                    {item.type === 'video' && <Play className="w-3 h-3 fill-white" />}
                    {item.type === 'audio' && <Music className="w-3 h-3" />}
                    {item.type === 'preset' && <Sparkles className="w-3 h-3 text-amber-400" />}
                    {item.duration && <span>{item.duration}</span>}
                  </div>

                  {/* Select Checkbox */}
                  {isSelectMode && (
                    <div className="absolute top-2.5 right-2.5 z-10">
                      {isSelected ? (
                        <CheckSquare className="w-5 h-5 text-purple-400 fill-purple-400" />
                      ) : (
                        <Square className="w-5 h-5 text-white/80" />
                      )}
                    </div>
                  )}

                  {/* Hover Overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-3 text-white">
                    <p className="text-xs font-bold line-clamp-1">{item.title}</p>
                    <div className="flex items-center justify-between text-[11px] text-gray-300 mt-1">
                      <span>@{item.author.username}</span>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleShare(item);
                          }}
                          className="hover:text-purple-300"
                        >
                          <Share2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRemoveItem(item.id, item.title);
                          }}
                          className="hover:text-rose-400"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="space-y-2.5">
            {filteredItems.map((item) => {
              const isSelected = selectedIds.includes(item.id);
              return (
                <div
                  key={item.id}
                  onClick={() => {
                    if (isSelectMode) {
                      handleToggleSelect(item.id);
                    } else {
                      navigate(`/post/${item.id}`);
                    }
                  }}
                  className={cn(
                    "flex items-center gap-3 p-3 rounded-2xl border cursor-pointer transition-all",
                    isSelected ? "ring-2 ring-purple-500 bg-purple-500/10" : isDark ? "bg-white/5 border-white/10 hover:bg-white/10" : "bg-white border-gray-200 hover:bg-gray-50"
                  )}
                >
                  {isSelectMode && (
                    <div className="shrink-0">
                      {isSelected ? (
                        <CheckSquare className="w-5 h-5 text-purple-400 fill-purple-400" />
                      ) : (
                        <Square className="w-5 h-5 text-gray-400" />
                      )}
                    </div>
                  )}

                  <div className="w-16 h-16 rounded-xl overflow-hidden bg-gray-900 shrink-0 relative">
                    <img
                      src={item.thumbnail}
                      alt={item.title}
                      className="w-full h-full object-cover"
                    />
                    {item.type === 'video' && (
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                        <Play className="w-4 h-4 fill-white text-white" />
                      </div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-sm truncate">{item.title}</h3>
                    <div className="flex items-center gap-2 text-xs text-gray-400 mt-0.5">
                      <span>@{item.author.username}</span>
                      <span>•</span>
                      <span>{item.savedAt}</span>
                      <span>•</span>
                      <span className="text-purple-400 font-semibold">{item.collection}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleShare(item);
                      }}
                      className={cn(
                        "p-2 rounded-xl transition-all",
                        isDark ? "hover:bg-white/10 text-gray-400" : "hover:bg-gray-100 text-gray-600"
                      )}
                    >
                      <Share2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemoveItem(item.id, item.title);
                      }}
                      className={cn(
                        "p-2 rounded-xl text-rose-400 transition-all",
                        isDark ? "hover:bg-white/10" : "hover:bg-gray-100"
                      )}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
