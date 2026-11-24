/**
 * Manage story highlights.
 * 
 * @component
 */

import { useState, useEffect, useCallback } from "react";
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { cn } from '../../lib/utils';
import { Plus, MoreHorizontal, Trash2, Edit2, Loader2, Sparkles, X, Check } from "lucide-react";
import { toast } from 'sonner';
import { useAppStore } from '../../store/appStore';
import { useProfileStore } from '../../store/profileStore';
import ErrorState from '../../design-system/ErrorState.jsx';
import { unknownNumber } from '../../lib/unknownNumber.js';
import { BRAND_GRADIENT } from '../../design-system/tokens.js';
import { LazyImage } from '../../components/Shared/LazyImage';

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
  const [loadError, setLoadError] = useState(null);
  const [reloadNonce, setReloadNonce] = useState(0);
  const [selectedHighlight, setSelectedHighlight] = useState(null);
  const [showCreate, setShowCreate] = useState(() => searchParams.get('create') === 'true');
  const [highlightName, setHighlightName] = useState('');
  const [selectedEmoji, setSelectedEmoji] = useState('✨');
  const [creating, setCreating] = useState(false);
  const [editingHighlight, setEditingHighlight] = useState(null);
  const [editTitle, setEditTitle] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);
  const [userStories, setUserStories] = useState([]);
  const [selectedStoryIds, setSelectedStoryIds] = useState([]);
  const [loadingStories, setLoadingStories] = useState(false);

  // Load user stories when create modal opens
  useEffect(() => {
    if (!showCreate || !currentUserId) return;
    let isMounted = true;
    const fetchUserStories = async () => {
      setLoadingStories(true);
      try {
        const { getStoryService } = await import('../../services/storyService.js');
        const svc = getStoryService();
        const [activeRes, archiveRes] = await Promise.allSettled([
          svc.getUserStories(currentUserId),
          svc.getArchivedStories(currentUserId),
        ]);
        const activeList = activeRes.status === 'fulfilled' ? (activeRes.value || []) : [];
        const archiveList = archiveRes.status === 'fulfilled' ? (archiveRes.value?.stories || archiveRes.value || []) : [];
        const combined = [...activeList, ...archiveList];
        const unique = [];
        const seen = new Set();
        for (const item of combined) {
          if (item && item.id && !seen.has(item.id)) {
            seen.add(item.id);
            unique.push(item);
          }
        }
        if (isMounted) setUserStories(unique);
      } catch (e) {
        console.warn('Failed to load stories for highlight creation:', e);
      } finally {
        if (isMounted) setLoadingStories(false);
      }
    };
    fetchUserStories();
    return () => { isMounted = false; };
  }, [showCreate, currentUserId]);
  
  // Load highlights
  useEffect(() => {
    const loadHighlights = async () => {
      if (!currentUserId) {
        setLoading(false);
        return;
      }
      setLoading(true);
      setLoadError(null);
      try {
        const storyService = (await import('../../services/storyService.js')).getStoryService();
        const userHighlights = await storyService.getHighlights(currentUserId);
        const list = Array.isArray(userHighlights) ? userHighlights : (userHighlights?.highlights || []);
        setHighlights(list);
      } catch (error) {
        // A failed read must not render as "No highlights yet".
        setLoadError(error?.message || 'Could not load highlights.');
      } finally {
        setLoading(false);
      }
    };
    
    loadHighlights();
  }, [currentUserId, reloadNonce]);
  
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
      useProfileStore.getState().loadHighlights(currentUserId);
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
      useProfileStore.getState().loadHighlights(currentUserId);
      toast.success(`Highlight "${highlight.title || highlight.name || 'Story'}" removed`);
    } catch (error) {
      toast.error('Failed to delete highlight');
    }
  }, [currentUserId]);
  
  useEffect(() => {
    if (!showCreate && !editingHighlight) return;
    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (editingHighlight && !savingEdit) {
          setEditingHighlight(null);
          setEditTitle('');
        } else if (showCreate && !creating) {
          setShowCreate(false);
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [showCreate, creating, editingHighlight, savingEdit]);

  return (
    <div className={cn(
      'min-h-screen pb-20',
      theme === 'dark' ? 'bg-[#03071B] text-white' : 'bg-[#F6F8FC] text-slate-900'
    )}>
      {/* Content */}
      <div className="max-w-2xl mx-auto px-4 py-4 space-y-4">
        <div className="flex items-center justify-between pb-2 gap-3">
          <div>
            <h2 className="text-lg font-extrabold tracking-tight text-slate-900 dark:text-white">Story Highlights</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">Curate your best memories on your profile</p>
          </div>
          <button
            type="button"
            onClick={handleCreateHighlight}
            className="min-h-[44px] px-4 py-2 rounded-2xl font-bold text-xs text-white hover:opacity-95 shadow-md transition-opacity flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
            style={{ background: BRAND_GRADIENT }}
          >
            <Plus className="w-4 h-4" />
            <span>New Highlight</span>
          </button>
        </div>
        {loading ? (
          <div className="flex items-center justify-center py-20" role="status" aria-label="Loading highlights">
            <Loader2 className="w-8 h-8 text-purple-500 animate-spin" />
          </div>
        ) : loadError ? (
          <ErrorState
            title="Could not load highlights"
            message={loadError}
            onRetry={() => setReloadNonce((n) => n + 1)}
          />
        ) : highlights.length === 0 ? (
          <div className={cn(
            'text-center py-16 px-6 rounded-3xl border',
            theme === 'dark' ? 'bg-[#0B1234]/42 backdrop-blur-xl border-white/[0.08]' : 'bg-white border-slate-200/90 shadow-sm'
          )}>
            <div className={cn(
              'w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center',
              theme === 'dark' ? 'bg-white/[0.06] text-slate-300' : 'bg-slate-100 text-slate-500'
            )}>
              <Plus className="w-7 h-7" />
            </div>
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">
              No highlights yet
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-5">
              Pin favorite stories here so visitors can explore them anytime.
            </p>
            <button
              type="button"
              onClick={handleCreateHighlight}
              className="min-h-[44px] px-5 py-2.5 rounded-xl text-xs font-bold text-white hover:opacity-95 transition-opacity cursor-pointer whitespace-nowrap shrink-0 shadow-md"
              style={{ background: BRAND_GRADIENT }}
            >
              Create Your First Highlight
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-4">
            {highlights.map((highlight) => (
              <div
                key={highlight.id}
                className="relative group cursor-pointer"
              >
                <button
                  type="button"
                  onClick={() => navigate(`/highlight/${highlight.id}`)}
                  className="w-full cursor-pointer text-center"
                >
                  <div className={cn(
                    'aspect-square rounded-2xl overflow-hidden',
                    'bg-arvdoul-gradient p-0.5'
                  )}>
                    <div className={cn(
                      'w-full h-full rounded-xl overflow-hidden',
                      'bg-white dark:bg-[#0B1234]'
                    )}>
                      {(() => {
                        const coverSrc = highlight.coverUrl || highlight.cover || highlight.thumbnailUrl || highlight.mediaURL;
                        return coverSrc ? (
                          <LazyImage
                            src={coverSrc}
                            alt={highlight.title || 'Highlight cover'}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-4xl">
                            {highlight.emoji || '📚'}
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                  <p className="text-sm text-slate-900 dark:text-white text-center mt-2 truncate font-medium">
                    {highlight.title}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 text-center tabular-nums">
                    {unknownNumber(highlight.storyCount) ?? '—'} stories
                  </p>
                </button>
                
                {/* Actions */}
                <div className={cn(
                  'absolute top-2 right-2',
                  'opacity-100 sm:opacity-0 sm:group-hover:opacity-100 focus-within:opacity-100',
                  'transition-opacity'
                )}>
                  <button
                    type="button"
                    aria-label="Highlight options"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedHighlight(selectedHighlight?.id === highlight.id ? null : highlight);
                    }}
                    className={cn(
                      'p-1.5 rounded-full cursor-pointer',
                      'bg-black/60 hover:bg-black/80',
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
                    'bg-white/95 dark:bg-[#0B1234]/78 backdrop-blur-xl',
                    'shadow-lg border border-slate-200 dark:border-white/10'
                  )}>
                    <button
                      type="button"
                      onClick={() => handleEditHighlight(highlight)}
                      className={cn(
                        'w-full px-3 py-2 text-left text-sm cursor-pointer',
                        'hover:bg-slate-100 dark:hover:bg-white/10',
                        'flex items-center gap-2'
                      )}
                    >
                      <Edit2 className="w-4 h-4" />
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteHighlight(highlight)}
                      className={cn(
                        'w-full px-3 py-2 text-left text-sm text-red-500 cursor-pointer',
                        'hover:bg-slate-100 dark:hover:bg-white/10',
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
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md"
          onClick={() => !creating && setShowCreate(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="New Highlight"
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm p-6 rounded-3xl border border-slate-200 dark:border-white/[0.09] bg-white dark:bg-[#0B1234]/72 dark:backdrop-blur-2xl shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-200"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-purple-500/10 text-purple-500 flex items-center justify-center">
                  <Sparkles className="w-4 h-4" />
                </div>
                <h3 className="font-bold text-base text-slate-900 dark:text-white">New Highlight</h3>
              </div>
              <button
                type="button"
                aria-label="Close"
                onClick={() => setShowCreate(false)}
                className="p-1 rounded-full text-slate-400 hover:text-slate-700 dark:hover:text-white cursor-pointer"
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
              <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5 block">
                Highlight Name
              </label>
              <input
                aria-label="Highlight Name"
                type="text"
                value={highlightName}
                onChange={(e) => setHighlightName(e.target.value)}
                placeholder="e.g. Travel, Moments, Projects"
                maxLength={30}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/[0.05] text-sm text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-arvdoul-purple"
                autoFocus
              />
            </div>

            {/* Select Stories */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 block">
                  Select Stories ({selectedStoryIds.length})
                </label>
                {selectedStoryIds.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setSelectedStoryIds([])}
                    className="text-[11px] text-purple-500 hover:underline cursor-pointer"
                  >
                    Clear selection
                  </button>
                )}
              </div>

              {loadingStories ? (
                <div className="flex items-center justify-center py-6 text-slate-400">
                  <Loader2 className="w-5 h-5 animate-spin" />
                </div>
              ) : userStories.length === 0 ? (
                <div className="text-center py-3 px-3 rounded-xl bg-slate-50 dark:bg-white/[0.03] border border-slate-100 dark:border-white/[0.06] text-xs text-slate-500 dark:text-slate-400">
                  No published or archived stories yet. You can still create this highlight now and add stories anytime.
                </div>
              ) : (
                <div className="grid grid-cols-4 gap-2 max-h-40 overflow-y-auto pr-1">
                  {userStories.map((s) => {
                    const isSelected = selectedStoryIds.includes(s.id);
                    const mediaUrl = s.media?.url || s.mediaUrl;
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => {
                          setSelectedStoryIds((prev) =>
                            isSelected ? prev.filter((id) => id !== s.id) : [...prev, s.id]
                          );
                        }}
                        className={cn(
                          'relative aspect-square rounded-xl overflow-hidden border-2 transition-all cursor-pointer',
                          isSelected
                            ? 'border-purple-600 ring-2 ring-purple-400 scale-95'
                            : 'border-transparent hover:opacity-80'
                        )}
                      >
                        {mediaUrl ? (
                          <LazyImage
                            src={mediaUrl}
                            alt={s.content || 'Story preview'}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div
                            className="w-full h-full flex items-center justify-center text-[10px] p-1 text-center font-medium"
                            style={{
                              backgroundColor: s.backgroundColor || '#6366f1',
                              color: s.textColor || '#ffffff',
                            }}
                          >
                            <span className="line-clamp-2">{s.content || 'Story'}</span>
                          </div>
                        )}
                        {isSelected && (
                          <div className="absolute inset-0 bg-purple-600/40 flex items-center justify-center">
                            <div className="w-5 h-5 rounded-full bg-purple-600 text-white flex items-center justify-center">
                              <Check className="w-3.5 h-3.5 stroke-[3]" />
                            </div>
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowCreate(false);
                  setSelectedStoryIds([]);
                }}
                className="flex-1 min-h-[44px] py-2.5 rounded-xl bg-slate-100 dark:bg-white/[0.08] text-slate-700 dark:text-slate-200 text-sm font-semibold hover:bg-slate-200 dark:hover:bg-white/[0.12] transition cursor-pointer whitespace-nowrap"
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
                    const firstSelected = userStories.find(s => selectedStoryIds.includes(s.id));
                    const coverUrl = firstSelected?.media?.url || firstSelected?.mediaUrl || null;
                    await getStoryService().createHighlight(
                      currentUserId,
                      highlightName.trim().slice(0, 30),
                      selectedStoryIds,
                      {
                        emoji: selectedEmoji,
                        coverUrl,
                      }
                    );
                    toast.success('Highlight created successfully!');
                    setShowCreate(false); 
                    setHighlightName('');
                    setSelectedStoryIds([]);
                    // reload highlights
                    const { getStoryService: s2 } = await import('../../services/storyService.js');
                    const res = await s2().getHighlights(currentUserId);
                    const updated = Array.isArray(res) ? res : (res?.highlights || []);
                    setHighlights(updated);
                    useProfileStore.getState().loadHighlights(currentUserId);
                  } catch (err) {
                    toast.error(err?.message || 'Could not create highlight.');
                  } finally {
                    setCreating(false);
                  }
                }}
                disabled={creating}
                className="flex-1 min-h-[44px] py-2.5 rounded-xl text-white text-sm font-semibold hover:opacity-95 transition disabled:opacity-50 cursor-pointer whitespace-nowrap"
                style={{ background: BRAND_GRADIENT }}
              >
                {creating ? 'Creating…' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit highlight modal */}
      {editingHighlight && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={() => !savingEdit && setEditingHighlight(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Edit Highlight Title"
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm p-5 rounded-3xl border border-slate-200 dark:border-white/[0.09] bg-white dark:bg-[#0B1234]/72 dark:backdrop-blur-2xl shadow-2xl space-y-4"
          >
            <h3 className="font-bold text-base text-slate-900 dark:text-white">Edit Highlight Title</h3>
            <input
              aria-label="Edit Highlight Title"
              type="text"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              placeholder="Highlight title..."
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/[0.05] text-sm text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-arvdoul-purple"
              autoFocus
            />
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => { setEditingHighlight(null); setEditTitle(''); }}
                className="flex-1 min-h-[44px] py-2.5 rounded-xl text-sm font-semibold bg-slate-100 dark:bg-white/[0.08] text-slate-700 dark:text-slate-300 cursor-pointer whitespace-nowrap"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveEditHighlight}
                disabled={savingEdit}
                className="flex-1 min-h-[44px] py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-50 cursor-pointer whitespace-nowrap hover:opacity-95 transition-opacity"
                style={{ background: BRAND_GRADIENT }}
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
