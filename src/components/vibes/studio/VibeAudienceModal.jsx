// src/components/vibes/studio/VibeAudienceModal.jsx
//
// Audience & Close Circle picker modal supporting all 6 Part 1 audiences:
//   - public
//   - followers
//   - connections (mutual follow)
//   - close_circle (with inline Close Circle member CRUD)
//   - selected (with live user search picker)
//   - private (Only Me)

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Globe, Users, UserCheck, Star, UserPlus, Lock, Search, X, Check, Loader2, Trash2
} from 'lucide-react';
import { cn } from '../../../lib/utils';
import { BRAND_GRADIENT } from '../../../design-system/tokens.js';
import { VIBE_AUDIENCES, VIBE_AUDIENCE_OPTIONS } from '../../../config/vibeContracts.js';
import { getStoryService } from '../../../services/storyService';
import { getSafeAvatarUrl } from '../../../utils/avatarUtils';
import { LazyImage } from '../../Shared/LazyImage';

const AUDIENCE_ICONS = {
  [VIBE_AUDIENCES.PUBLIC]: Globe,
  [VIBE_AUDIENCES.FOLLOWERS]: Users,
  [VIBE_AUDIENCES.CONNECTIONS]: UserCheck,
  [VIBE_AUDIENCES.CLOSE_CIRCLE]: Star,
  [VIBE_AUDIENCES.SELECTED]: UserPlus,
  [VIBE_AUDIENCES.PRIVATE]: Lock,
};

export default function VibeAudienceModal({
  open,
  isDark,
  userId,
  audience,
  selectedUsers = [],
  onSelectAudience,
  onChangeSelectedUsers,
  onClose,
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState(null);

  const [closeCircleMembers, setCloseCircleMembers] = useState([]);
  const [circleLoading, setCircleLoading] = useState(false);
  const [circleError, setCircleError] = useState(null);
  const [managingCircle, setManagingCircle] = useState(false);

  const loadCloseCircle = useCallback(async () => {
    if (!userId) return;
    setCircleLoading(true);
    setCircleError(null);
    try {
      const res = await getStoryService().getCloseCircle(userId);
      const ids = Array.isArray(res) ? res : (res?.memberIds || []);
      if (ids.length === 0) {
        setCloseCircleMembers([]);
        return;
      }
      if (Array.isArray(res?.members) && res.members.length > 0) {
        setCloseCircleMembers(
          res.members.map((p) => {
            const id = p.id || p.uid;
            const name = p.displayName || p.name || 'Creator';
            return {
              id,
              name,
              username: p.username || '',
              avatar: getSafeAvatarUrl(p.photoURL, name, id),
            };
          })
        );
        return;
      }
      const { getSocialGraphService } = await import('../../../services/socialGraphService.js');
      const profiles = await getSocialGraphService()
        .hydrateProfiles(ids, { viewerId: userId })
        .catch(() => []);
      const byId = new Map(profiles.map((p) => [p.id, p]));
      setCloseCircleMembers(
        ids.map((id) => {
          const p = byId.get(id) || {};
          const name = p.displayName || p.name || 'Creator';
          return {
            id,
            name,
            username: p.username || '',
            avatar: getSafeAvatarUrl(p.photoURL, name, id),
          };
        })
      );
    } catch (err) {
      console.warn('[VibeAudienceModal] failed loading Close Circle:', err?.message || err);
      setCircleError(err?.message || 'Could not load Close Circle.');
      setCloseCircleMembers([]);
    } finally {
      setCircleLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (open && (audience === VIBE_AUDIENCES.CLOSE_CIRCLE || managingCircle)) {
      loadCloseCircle();
    }
  }, [open, audience, managingCircle, loadCloseCircle]);

  useEffect(() => {
    if (!open || !searchTerm.trim()) {
      setSearchResults([]);
      setSearchError(null);
      return undefined;
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      setSearching(true);
      setSearchError(null);
      try {
        const { getUserService } = await import('../../../services/userService.js');
        const res = await getUserService().searchUsers(searchTerm.trim(), 12);
        if (cancelled) return;
        const rows = (Array.isArray(res) ? res : (res?.users || []))
          .filter((u) => (u.uid || u.id) !== userId)
          .map((u) => {
            const id = u.uid || u.id;
            const name = u.displayName || u.name || 'User';
            return {
              id,
              name,
              username: u.username || '',
              avatar: getSafeAvatarUrl(u.photoURL, name, id),
            };
          });
        setSearchResults(rows);
      } catch (err) {
        console.warn('[VibeAudienceModal] user search failed:', err?.message || err);
        if (!cancelled) {
          setSearchError(err?.message || 'Could not search users right now.');
          setSearchResults([]);
        }
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 240);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [open, searchTerm, userId]);

  const toggleSelectedUser = (u) => {
    const exists = selectedUsers.some((item) => item.id === u.id);
    if (exists) {
      onChangeSelectedUsers(selectedUsers.filter((item) => item.id !== u.id));
    } else {
      onChangeSelectedUsers([...selectedUsers, u]);
    }
  };

  const handleAddToCloseCircle = async (u) => {
    if (!userId) return;
    await getStoryService().addToCloseCircle(userId, u.id);
    if (!closeCircleMembers.some((m) => m.id === u.id)) {
      setCloseCircleMembers((prev) => [...prev, u]);
    }
  };

  const handleRemoveFromCloseCircle = async (memberId) => {
    if (!userId) return;
    await getStoryService().removeFromCloseCircle(userId, memberId);
    setCloseCircleMembers((prev) => prev.filter((m) => m.id !== memberId));
  };

  const showUserPicker =
    audience === VIBE_AUDIENCES.SELECTED ||
    (audience === VIBE_AUDIENCES.CLOSE_CIRCLE && managingCircle);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ y: 24, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 24, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Choose Vibe audience"
            className={cn(
              'w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl p-5 border shadow-2xl max-h-[85vh] flex flex-col',
              isDark ? 'bg-[#0A102D] border-white/10 text-white' : 'bg-white border-slate-200 text-slate-900'
            )}
          >
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div>
                <h3 className="text-base font-bold">Who can view this Vibe?</h3>
                <p className={cn('text-xs', isDark ? 'text-slate-400' : 'text-slate-600')}>
                  Enforced server-side for feeds, profiles, and direct views.
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close audience picker"
                className={cn(
                  'w-10 h-10 rounded-full flex items-center justify-center cursor-pointer',
                  isDark ? 'hover:bg-white/10 text-slate-300' : 'hover:bg-slate-100 text-slate-700'
                )}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="overflow-y-auto py-3 space-y-2 pr-1">
              {VIBE_AUDIENCE_OPTIONS.map((opt) => {
                const Icon = AUDIENCE_ICONS[opt.id] || Globe;
                const active = audience === opt.id;
                return (
                  <button
                    type="button"
                    key={opt.id}
                    onClick={() => onSelectAudience(opt.id)}
                    className={cn(
                      'w-full flex items-center justify-between gap-3 p-3 rounded-2xl border text-left transition-all cursor-pointer',
                      active
                        ? isDark
                          ? 'bg-white/10 border-white/40 text-white'
                          : 'bg-indigo-50 border-indigo-400 text-slate-900'
                        : isDark
                          ? 'bg-white/[0.03] border-white/10 text-slate-200 hover:bg-white/[0.06]'
                          : 'bg-slate-50 border-slate-200 text-slate-800 hover:bg-slate-100'
                    )}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={cn(
                          'w-9 h-9 rounded-xl flex items-center justify-center shrink-0',
                          active ? 'text-white' : isDark ? 'bg-white/10 text-slate-300' : 'bg-white text-slate-700 border border-slate-200'
                        )}
                        style={active ? { background: BRAND_GRADIENT } : undefined}
                      >
                        <Icon className="w-4 h-4" aria-hidden="true" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-bold">{opt.label}</p>
                        <p className={cn('text-xs line-clamp-1', isDark ? 'text-slate-400' : 'text-slate-600')}>
                          {opt.description}
                        </p>
                      </div>
                    </div>
                    <div
                      className={cn(
                        'w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0',
                        active
                          ? 'border-indigo-500 bg-indigo-500 text-white'
                          : isDark ? 'border-white/30' : 'border-slate-300'
                      )}
                    >
                      {active && <Check className="w-3 h-3" aria-hidden="true" />}
                    </div>
                  </button>
                );
              })}

              {/* Close Circle Summary / Toggle Manager */}
              {audience === VIBE_AUDIENCES.CLOSE_CIRCLE && (
                <div className={cn(
                  'mt-3 p-3 rounded-2xl border space-y-2.5',
                  isDark ? 'bg-white/[0.04] border-white/10' : 'bg-slate-50 border-slate-200'
                )}>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold">
                      Close Circle ({circleLoading ? '…' : closeCircleMembers.length})
                    </span>
                    <button
                      type="button"
                      onClick={() => setManagingCircle((v) => !v)}
                      className="text-xs font-bold text-indigo-400 hover:underline cursor-pointer"
                    >
                      {managingCircle ? 'Done editing' : 'Edit members'}
                    </button>
                  </div>
                  {circleError && (
                    <div className="flex items-center justify-between gap-2 text-xs text-rose-400">
                      <span>{circleError}</span>
                      <button type="button" onClick={loadCloseCircle} className="underline font-bold cursor-pointer">
                        Retry
                      </button>
                    </div>
                  )}
                  {closeCircleMembers.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {closeCircleMembers.map((m) => (
                        <span
                          key={m.id}
                          className={cn(
                            'inline-flex items-center gap-1.5 pl-1.5 pr-2 py-1 rounded-full text-xs font-semibold',
                            isDark ? 'bg-white/10 text-white' : 'bg-white border border-slate-200 text-slate-800'
                          )}
                        >
                          <LazyImage src={m.avatar} alt="" className="w-4 h-4 rounded-full object-cover" />
                          <span>{m.name}</span>
                          {managingCircle && (
                            <button
                              type="button"
                              onClick={() => handleRemoveFromCloseCircle(m.id)}
                              aria-label={`Remove ${m.name} from Close Circle`}
                              className="text-rose-400 hover:text-rose-300 cursor-pointer"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          )}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Selected Users Chips */}
              {audience === VIBE_AUDIENCES.SELECTED && (
                <div className={cn(
                  'mt-3 p-3 rounded-2xl border space-y-2',
                  isDark ? 'bg-white/[0.04] border-white/10' : 'bg-slate-50 border-slate-200'
                )}>
                  <span className="text-xs font-bold block">
                    Selected Recipients ({selectedUsers.length})
                  </span>
                  {selectedUsers.length === 0 ? (
                    <p className={cn('text-xs', isDark ? 'text-amber-300' : 'text-amber-700')}>
                      Search and pick at least one person below.
                    </p>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {selectedUsers.map((u) => (
                        <button
                          type="button"
                          key={u.id}
                          onClick={() => toggleSelectedUser(u)}
                          className={cn(
                            'inline-flex items-center gap-1.5 pl-1.5 pr-2 py-1 rounded-full text-xs font-semibold cursor-pointer',
                            isDark ? 'bg-white/15 text-white' : 'bg-white border border-slate-300 text-slate-800'
                          )}
                        >
                          <LazyImage src={u.avatar} alt="" className="w-4 h-4 rounded-full object-cover" />
                          <span>{u.name}</span>
                          <X className="w-3 h-3 opacity-70" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* User Search Input & Results */}
              {showUserPicker && (
                <div className="pt-2 space-y-2">
                  <div className={cn(
                    'flex items-center gap-2 px-3 py-2 rounded-xl border',
                    isDark ? 'bg-white/5 border-white/15' : 'bg-white border-slate-300'
                  )}>
                    <Search className="w-4 h-4 text-slate-400" aria-hidden="true" />
                    <input
                      type="text"
                      aria-label="Search users to add"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder="Search by name or @username…"
                      className="w-full bg-transparent text-xs outline-none placeholder:text-slate-500"
                    />
                  </div>
                  {searchError && (
                    <p className="text-xs text-rose-400 px-1">{searchError}</p>
                  )}
                  {searching ? (
                    <div className="flex items-center justify-center py-3 text-xs opacity-70 gap-1.5">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" /> Searching…
                    </div>
                  ) : searchResults.length > 0 && (
                    <div className="space-y-1 max-h-40 overflow-y-auto">
                      {searchResults.map((u) => {
                        const isPicked = audience === VIBE_AUDIENCES.SELECTED
                          ? selectedUsers.some((s) => s.id === u.id)
                          : closeCircleMembers.some((m) => m.id === u.id);
                        return (
                          <button
                            type="button"
                            key={u.id}
                            onClick={() => {
                              if (audience === VIBE_AUDIENCES.SELECTED) toggleSelectedUser(u);
                              else if (isPicked) handleRemoveFromCloseCircle(u.id);
                              else handleAddToCloseCircle(u);
                            }}
                            className={cn(
                              'w-full flex items-center justify-between p-2 rounded-xl text-left text-xs transition-colors cursor-pointer',
                              isDark ? 'hover:bg-white/10' : 'hover:bg-slate-100'
                            )}
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <LazyImage src={u.avatar} alt={u.name} className="w-8 h-8 rounded-full object-cover" />
                              <div className="min-w-0">
                                <p className="font-bold truncate">{u.name}</p>
                                {u.username && <p className="text-[11px] opacity-65 truncate">@{u.username}</p>}
                              </div>
                            </div>
                            <span className={cn(
                              'px-2.5 py-1 rounded-lg font-bold text-[11px]',
                              isPicked
                                ? 'bg-indigo-500 text-white'
                                : isDark ? 'bg-white/10 text-white' : 'bg-slate-200 text-slate-800'
                            )}>
                              {isPicked ? 'Added' : 'Add'}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={onClose}
              className="mt-2 w-full min-h-[44px] py-3 rounded-2xl text-white font-bold text-sm shadow-lg cursor-pointer"
              style={{ background: BRAND_GRADIENT }}
            >
              Confirm Audience
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
