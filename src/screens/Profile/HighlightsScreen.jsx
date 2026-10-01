/**
 * src/screens/Profile/HighlightsScreen.jsx - ARVDOUL Highlights Screen
 * 
 * Manage story highlights.
 * 
 * @component
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { cn } from '../../lib/utils';
import { ArrowLeft, Plus, MoreHorizontal, Trash2, Edit2, Loader2, Sparkles, X } from 'lucide-react';
import { toast } from 'sonner';
import { useAppStore } from '../../store/appStore';

const EMOJI_OPTIONS = ['✨', '🔥', '💖', '🎵', '✈️', '📸', '⚡', '🏆', '🌴', '🎨', '🚀', '🌟'];

/**
 * HighlightsScreen Component
 */
export default function HighlightsScreen() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { theme } = useTheme();
  const { user: authUser } = useAuth();
  const storeUser = useAppStore(state => state.currentUser);
  const currentUser = authUser || storeUser;
  const currentUserId = currentUser?.uid || authUser?.uid || localStorage.getItem('arvdoul_uid') || localStorage.getItem('uid');
  
  const [highlights, setHighlights] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedHighlight, setSelectedHighlight] = useState(null);
  const [showCreate, setShowCreate] = useState(() => searchParams.get('create') === 'true');
  const [highlightName, setHighlightName] = useState('');
  const [selectedEmoji, setSelectedEmoji] = useState('✨');
  const [creating, setCreating] = useState(false);
  const [editingHighlight, setEditingHighlight] = useState(null);
  const [editTitle, setEditTitle] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);
  
  // Load highlights
  useEffect(() => {
    const loadHighlights = async () => {
      if (!currentUserId) {
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const storyService = (await import('../../services/storyService.js')).getStoryService();
        const userHighlights = await storyService.getHighlights(currentUserId);
        const list = Array.isArray(userHighlights) ? userHighlights : (userHighlights?.highlights || []);
        setHighlights(list);
      } catch (error) {
        console.error('Failed to load highlights:', error);
      } finally {
        setLoading(false);
      }
    };
    
    loadHighlights();
  }, [currentUserId]);
  
  const handleCreateHighlight = useCallback(() => {
    setShowCreate(true);
  }, []);
  
  const handleEditHighlight = useCallback((highlight) => {
    setSelectedHighlight(null);
    setEditingHighlight(highlight);
    setEditTitle(highlight.title || highlight.name || '');
  }, []);

  const handleSaveEditHighlight = useCallback(async () => {
    if (!editingHighlight || !editTitle.trim()) {
      toast.error('Highlight name cannot be empty');
      return;
    }
    setSavingEdit(true);
    try {
      const storyService = (await import('../../services/storyService.js')).getStoryService();
      await storyService.updateHighlight(currentUserId, editingHighlight.id, {
        title: editTitle.trim(),
        name: editTitle.trim(),
      });
      setHighlights(prev => prev.map(h => h.id === editingHighlight.id ? { ...h, title: editTitle.trim(), name: editTitle.trim() } : h));
      toast.success('Highlight updated successfully!');
      setEditingHighlight(null);
      setEditTitle('');
    } catch (err) {
      console.error('Failed to update highlight:', err);
      toast.error(err?.message || 'Failed to update highlight');
    } finally {
      setSavingEdit(false);
    }
  }, [currentUserId, editingHighlight, editTitle]);
  
  const handleDeleteHighlight = useCallback(async (highlight) => {
    setSelectedHighlight(null);
    try {
      const storyService = (await import('../../services/storyService.js')).getStoryService();
      if (storyService.deleteHighlight) {
        await storyService.deleteHighlight(currentUserId, highlight.id);
      }
      setHighlights(prev => prev.filter(h => h.id !== highlight.id));
      toast.success(`Highlight "${highlight.title || highlight.name || 'Story'}" removed`);
    } catch (error) {
      toast.error('Failed to delete highlight');
    }
  }, [currentUserId]);
  
  return (
    <div className={cn(
      'min-h-screen pb-20',
      theme === 'dark' ? 'bg-gray-900' : 'bg-gray-50'
    )}>
      {/* Header */}
      <div className={cn(
        'sticky top-0 z-20',
        'bg-white/80 dark:bg-gray-900/70 backdrop-blur-xl',
        'border-b border-gray-200 dark:border-gray-800'
      )}>
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate(-1)}
              className={cn(
                'p-2 rounded-xl',
                'hover:bg-gray-100 dark:hover:bg-gray-800',
                'transition-colors'
              )}
            >
              <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            </button>
            <h1 className="text-lg font-semibold text-gray-900 dark:text-white">
              Highlights
            </h1>
          </div>
          
          <button
            onClick={handleCreateHighlight}
            className={cn(
              'px-4 py-2 rounded-xl font-medium text-sm',
              'bg-gradient-to-r from-purple-500 to-blue-500',
              'text-white hover:opacity-90 transition-opacity',
              'flex items-center gap-2'
            )}
          >
            <Plus className="w-4 h-4" />
            New
          </button>
        </div>
      </div>
      
      {/* Content */}
      <div className="max-w-2xl mx-auto px-4 py-4">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 text-purple-500 animate-spin" />
          </div>
        ) : highlights.length === 0 ? (
          <div className="text-center py-20">
            <div className={cn(
              'w-20 h-20 rounded-full mx-auto mb-4',
              'bg-gray-100 dark:bg-gray-800',
              'flex items-center justify-center'
            )}>
              <Plus className="w-8 h-8 text-gray-400" />
            </div>
            <p className="text-gray-500 dark:text-gray-400 mb-4">
              No highlights yet
            </p>
            <button
              onClick={handleCreateHighlight}
              className={cn(
                'px-4 py-2 rounded-xl font-medium',
                'bg-purple-500 text-white',
                'hover:bg-purple-600 transition-colors'
              )}
            >
              Create Your First Highlight
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-4">
            {highlights.map((highlight) => (
              <div
                key={highlight.id}
                className={cn(
                  'relative group cursor-pointer'
                )}
              >
                <button
                  onClick={() => navigate(`/highlight/${highlight.id}`)}
                  className="w-full"
                >
                  <div className={cn(
                    'aspect-square rounded-2xl overflow-hidden',
                    'bg-gradient-to-br from-purple-500 to-blue-500 p-0.5'
                  )}>
                    <div className={cn(
                      'w-full h-full rounded-xl overflow-hidden',
                      'bg-white dark:bg-gray-900'
                    )}>
                      {highlight.coverUrl ? (
                        <img
                          src={highlight.coverUrl}
                          alt={highlight.title}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-4xl">
                          {highlight.emoji || '📚'}
                        </div>
                      )}
                    </div>
                  </div>
                  <p className="text-sm text-gray-900 dark:text-white text-center mt-2 truncate">
                    {highlight.title}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
                    {highlight.storyCount || 0} stories
                  </p>
                </button>
                
                {/* Actions */}
                <div className={cn(
                  'absolute top-2 right-2',
                  'opacity-0 group-hover:opacity-100',
                  'transition-opacity'
                )}>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedHighlight(highlight);
                    }}
                    className={cn(
                      'p-1.5 rounded-full',
                      'bg-black/50 hover:bg-black/70',
                      'text-white transition-colors'
                    )}
                  >
                    <MoreHorizontal className="w-4 h-4" />
                  </button>
                </div>
                
                {/* Dropdown */}
                {selectedHighlight?.id === highlight.id && (
                  <div className={cn(
                    'absolute top-10 right-2 z-10',
                    'w-36 py-1 rounded-xl',
                    'bg-white/80 dark:bg-gray-800/70 backdrop-blur-xl',
                    'shadow-lg border border-gray-200 dark:border-gray-700'
                  )}>
                    <button
                      onClick={() => handleEditHighlight(highlight)}
                      className={cn(
                        'w-full px-3 py-2 text-left text-sm',
                        'hover:bg-gray-100 dark:hover:bg-gray-700',
                        'flex items-center gap-2'
                      )}
                    >
                      <Edit2 className="w-4 h-4" />
                      Edit
                    </button>
                    <button
                      onClick={() => handleDeleteHighlight(highlight)}
                      className={cn(
                        'w-full px-3 py-2 text-left text-sm text-red-500',
                        'hover:bg-gray-100 dark:hover:bg-gray-700',
                        'flex items-center gap-2'
                      )}
                    >
                      <Trash2 className="w-4 h-4" />
                      Delete
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
      {/* Create highlight modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md">
          <div className="w-full max-w-sm p-6 rounded-3xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-purple-500/10 text-purple-500 flex items-center justify-center">
                  <Sparkles className="w-4 h-4" />
                </div>
                <h3 className="font-bold text-base text-gray-900 dark:text-white">New Highlight</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                className="p-1 rounded-full text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Emoji / Icon Selector */}
            <div>
              <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1.5 block">
                Choose Cover Icon
              </label>
              <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
                {EMOJI_OPTIONS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => setSelectedEmoji(emoji)}
                    className={cn(
                      "w-9 h-9 rounded-xl flex items-center justify-center text-lg transition-transform shrink-0",
                      selectedEmoji === emoji
                        ? "bg-purple-600 text-white scale-110 shadow-md ring-2 ring-purple-400"
                        : "bg-gray-100 dark:bg-gray-800 hover:scale-105"
                    )}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1.5 block">
                Highlight Name
              </label>
              <input
                type="text"
                value={highlightName}
                onChange={(e) => setHighlightName(e.target.value)}
                placeholder="e.g. Travel, Moments, Projects"
                maxLength={30}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-purple-500"
                autoFocus
              />
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                className="flex-1 py-2.5 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 text-sm font-semibold hover:bg-gray-200 dark:hover:bg-gray-700 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  if (!highlightName.trim()) { toast.error('Give your highlight a name.'); return; }
                  setCreating(true);
                  try {
                    const { getStoryService } = await import('../../services/storyService.js');
                    await getStoryService().createHighlight(currentUserId, highlightName.trim().slice(0, 30), [], {
                      emoji: selectedEmoji,
                    });
                    toast.success('Highlight created! Add stories to it from your profile.');
                    setShowCreate(false); 
                    setHighlightName('');
                    // reload highlights
                    const { getStoryService: s2 } = await import('../../services/storyService.js');
                    const res = await s2().getHighlights(currentUserId);
                    const updated = Array.isArray(res) ? res : (res?.highlights || []);
                    setHighlights(updated);
                  } catch (err) {
                    toast.error(err?.message || 'Could not create highlight.');
                  } finally {
                    setCreating(false);
                  }
                }}
                disabled={creating}
                className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white text-sm font-semibold hover:opacity-90 transition disabled:opacity-50"
              >
                {creating ? 'Creating…' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit highlight modal */}
      {editingHighlight && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-sm p-5 rounded-3xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-2xl space-y-4">
            <h3 className="font-bold text-base text-gray-900 dark:text-white">Edit Highlight Title</h3>
            <input
              type="text"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              placeholder="Highlight title..."
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-purple-500"
              autoFocus
            />
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => { setEditingHighlight(null); setEditTitle(''); }}
                className="flex-1 py-2 rounded-xl text-sm font-semibold bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveEditHighlight}
                disabled={savingEdit}
                className="flex-1 py-2 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-purple-600 to-indigo-600 disabled:opacity-50"
              >
                {savingEdit ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
