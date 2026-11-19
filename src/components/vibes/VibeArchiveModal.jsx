// src/components/vibes/VibeArchiveModal.jsx
//
// Dual-theme Archive & Memories modal for viewing and deleting archived Vibes
// past their 24-hour active feed window, and opening Highlights management.

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Calendar, X, Trash2, Loader2, Eye, Sparkles } from 'lucide-react';
import { cn } from '../../lib/utils';
import { BRAND_GRADIENT } from '../../design-system/tokens.js';
import { LazyImage } from '../Shared/LazyImage';
import { isVibeExpired } from '../../config/vibeContracts.js';

function formatArchiveDate(raw) {
  if (!raw) return '';
  const ms = typeof raw?.toDate === 'function' ? raw.toDate().getTime() : new Date(raw).getTime();
  if (!Number.isFinite(ms)) return '';
  return new Date(ms).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export default function VibeArchiveModal({
  open,
  isDark,
  archive,
  onClose,
  onRetry,
  onDeleteArchived,
  onPreviewArchived,
  onManageHighlights,
}) {
  const [confirmId, setConfirmId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  const handleConfirmDelete = async (id) => {
    if (!onDeleteArchived || deletingId) return;
    setDeletingId(id);
    try {
      await onDeleteArchived(id);
      setConfirmId(null);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.94, y: 16 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.94, y: 16 }}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Vibe memories archive"
            className={cn(
              'w-full max-w-lg rounded-3xl p-6 border shadow-2xl',
              isDark ? 'bg-[#0A102D] border-white/10 text-white' : 'bg-white border-slate-200 text-slate-900'
            )}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2.5">
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center text-white"
                  style={{ background: BRAND_GRADIENT }}
                >
                  <Calendar className="w-4 h-4" aria-hidden="true" />
                </div>
                <div>
                  <h3 className="text-lg font-bold tracking-tight">Vibe Memories &amp; Archive</h3>
                  <p className={cn('text-xs', isDark ? 'text-slate-400' : 'text-slate-600')}>
                    Saved Vibes preserved past their 24-hour feed window.
                  </p>
                </div>
              </div>
              <button
                type="button"
                aria-label="Close Vibe archive"
                onClick={onClose}
                className={cn(
                  'w-11 h-11 rounded-full flex items-center justify-center cursor-pointer',
                  isDark ? 'hover:bg-white/10 text-slate-300' : 'hover:bg-slate-100 text-slate-700'
                )}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {archive.loading ? (
              <div className="grid grid-cols-3 gap-2.5 my-4">
                {[0, 1, 2, 3, 4, 5].map((i) => (
                  <div
                    key={i}
                    className={cn(
                      'aspect-[3/4] rounded-2xl animate-pulse',
                      isDark ? 'bg-white/5' : 'bg-slate-100'
                    )}
                  />
                ))}
              </div>
            ) : archive.error ? (
              <div className="my-4 text-center py-8">
                <p className={cn('text-xs mb-3', isDark ? 'text-rose-300' : 'text-rose-600')}>{archive.error}</p>
                <button
                  type="button"
                  onClick={onRetry}
                  className={cn(
                    'min-h-[40px] text-xs font-bold px-4 py-2 rounded-full cursor-pointer',
                    isDark ? 'bg-white/10 hover:bg-white/20 text-white' : 'bg-slate-100 hover:bg-slate-200 text-slate-900'
                  )}
                >
                  Retry
                </button>
              </div>
            ) : archive.items.length === 0 ? (
              <div className="my-4 text-center py-8 px-4">
                <div className={cn(
                  'w-12 h-12 rounded-2xl mx-auto flex items-center justify-center mb-3',
                  isDark ? 'bg-white/5 text-slate-300' : 'bg-slate-100 text-slate-600'
                )}>
                  <Sparkles className="w-5 h-5" aria-hidden="true" />
                </div>
                <p className={cn('text-sm font-semibold', isDark ? 'text-white' : 'text-slate-900')}>
                  No archived Vibes yet
                </p>
                <p className={cn('text-xs mt-1', isDark ? 'text-slate-400' : 'text-slate-500')}>
                  When auto-archive is enabled in Privacy Settings, published Vibes are saved here automatically.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-2.5 my-4 max-h-72 overflow-y-auto pr-1">
                {archive.items.map((st) => {
                  const id = st.storyId || st.id;
                  const url = st.media?.url || st.mediaUrl || '';
                  const expired = isVibeExpired(st);
                  const dateLabel = formatArchiveDate(st.createdAt || st.archivedAt);
                  const isConfirming = confirmId === id;

                  return (
                    <div
                      key={id}
                      className={cn(
                        'relative aspect-[3/4] rounded-2xl overflow-hidden border group',
                        isDark ? 'border-white/10 bg-white/5' : 'border-slate-200 bg-slate-100'
                      )}
                    >
                      {st.type === 'text' || !url ? (
                        <div
                          className="w-full h-full flex items-center justify-center p-2 text-center text-[11px] font-bold text-white"
                          style={{ background: st.backgroundColor || BRAND_GRADIENT }}
                        >
                          <span className="line-clamp-4">{st.content || 'Text Vibe'}</span>
                        </div>
                      ) : st.type === 'video' ? (
                        <video
                          src={url}
                          poster={st.mediaEdits?.coverUrl || undefined}
                          muted
                          playsInline
                          preload="metadata"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <LazyImage
                          src={url}
                          alt={st.content || 'Archived Vibe'}
                          loading="lazy"
                          className="w-full h-full object-cover"
                        />
                      )}

                      <div className="absolute inset-x-0 top-0 p-1.5 flex items-center justify-between bg-gradient-to-b from-black/75 to-transparent">
                        <span className="text-[10px] font-semibold text-white/90 truncate">
                          {dateLabel || (expired ? 'Expired' : 'Active')}
                        </span>
                        {onPreviewArchived && (
                          <button
                            type="button"
                            onClick={() => onPreviewArchived(st)}
                            aria-label="Open archived Vibe"
                            className="w-7 h-7 rounded-full bg-black/55 hover:bg-black/80 text-white flex items-center justify-center cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5" aria-hidden="true" />
                          </button>
                        )}
                      </div>

                      {onDeleteArchived && (
                        <div className="absolute inset-x-0 bottom-0 p-1.5 bg-gradient-to-t from-black/85 to-transparent flex items-center justify-end">
                          {isConfirming ? (
                            <div className="flex items-center gap-1 w-full">
                              <button
                                type="button"
                                onClick={() => setConfirmId(null)}
                                className="flex-1 py-1 rounded-lg bg-white/20 text-white text-[10px] font-bold cursor-pointer"
                              >
                                Keep
                              </button>
                              <button
                                type="button"
                                disabled={deletingId === id}
                                onClick={() => handleConfirmDelete(id)}
                                className="flex-1 py-1 rounded-lg bg-rose-600 text-white text-[10px] font-bold cursor-pointer disabled:opacity-60"
                              >
                                {deletingId === id ? '…' : 'Delete'}
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setConfirmId(id)}
                              aria-label="Delete archived Vibe"
                              className="w-7 h-7 rounded-full bg-black/55 hover:bg-rose-600 text-white flex items-center justify-center transition-colors cursor-pointer"
                            >
                              {deletingId === id ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                              )}
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            <button
              type="button"
              onClick={onManageHighlights}
              className="w-full min-h-[44px] py-3 rounded-2xl text-white font-bold text-sm shadow-lg active:scale-[0.98] transition-transform cursor-pointer"
              style={{ background: BRAND_GRADIENT }}
            >
              Manage Profile Highlights
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
