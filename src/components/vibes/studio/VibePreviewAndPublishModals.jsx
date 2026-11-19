// src/components/vibes/studio/VibePreviewAndPublishModals.jsx
//
// 1. VibePreviewModal: Zero-upload, zero-publish inline Studio Preview rendered
//    verbatim through the shared <VibeRenderer interactiveMode="preview" />.
// 2. VibePublishOverlay: Honest upload lifecycle HUD with progress %,
//    Cancel Upload (cleaning orphan Storage media), Retry, and Save Draft.

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Volume2, VolumeX, Send, Loader2, CheckCircle2, AlertCircle, RotateCcw, Shield } from 'lucide-react';
import { cn } from '../../../lib/utils';
import { BRAND_GRADIENT } from '../../../design-system/tokens.js';
import { VIBE_UPLOAD_STATES, getAudienceMeta } from '../../../config/vibeContracts.js';
import VibeRenderer from '../VibeRenderer.jsx';

export function VibePreviewModal({
  open,
  previewVibe,
  audience,
  selectedCount = 0,
  onClose,
  onPublish,
}) {
  const [muted, setMuted] = useState(false);
  const audienceMeta = getAudienceMeta(audience);

  return (
    <AnimatePresence>
      {open && previewVibe && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-0 sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Vibe preview"
        >
          <div className="relative w-full h-full sm:max-w-[420px] sm:h-[90vh] sm:rounded-3xl overflow-hidden bg-[#060918] border border-white/15 shadow-2xl flex flex-col">
            {/* Top Preview Chrome */}
            <div className="absolute top-0 inset-x-0 z-30 p-4 flex items-center justify-between bg-gradient-to-b from-black/80 to-transparent">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-1 rounded-full bg-white/15 backdrop-blur-md text-[11px] font-bold text-white border border-white/20">
                  Preview
                </span>
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-black/55 text-[11px] font-semibold text-white/90">
                  <Shield className="w-3 h-3" aria-hidden="true" />
                  <span>
                    {audienceMeta.label}
                    {audience === 'selected' && selectedCount > 0 ? ` (${selectedCount})` : ''}
                  </span>
                </span>
              </div>

              <div className="flex items-center gap-1.5">
                {previewVibe.type === 'video' && (
                  <button
                    type="button"
                    onClick={() => setMuted((m) => !m)}
                    aria-label={muted ? 'Unmute preview' : 'Mute preview'}
                    className="w-10 h-10 rounded-full bg-black/55 backdrop-blur-md flex items-center justify-center text-white cursor-pointer"
                  >
                    {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                  </button>
                )}
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Close Vibe preview"
                  className="w-10 h-10 rounded-full bg-black/55 backdrop-blur-md flex items-center justify-center text-white cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Shared VibeRenderer in preview mode */}
            <div className="flex-1 min-h-0">
              <VibeRenderer
                vibe={previewVibe}
                interactiveMode="preview"
                isPaused={false}
                isMuted={muted}
              />
            </div>

            {/* Bottom Actions */}
            <div className="absolute bottom-0 inset-x-0 z-30 p-4 bg-gradient-to-t from-black via-black/80 to-transparent flex items-center gap-2.5">
              <button
                type="button"
                onClick={onClose}
                className="min-h-[44px] px-4 py-2.5 rounded-2xl bg-white/15 hover:bg-white/25 text-white text-xs font-bold cursor-pointer"
              >
                Back to Edit
              </button>
              <button
                type="button"
                onClick={onPublish}
                className="flex-1 min-h-[44px] px-4 py-2.5 rounded-2xl text-white text-sm font-bold inline-flex items-center justify-center gap-2 shadow-xl cursor-pointer"
                style={{ background: BRAND_GRADIENT }}
              >
                <Send className="w-4 h-4" aria-hidden="true" />
                <span>Publish Vibe</span>
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

const STATE_COPY = {
  [VIBE_UPLOAD_STATES.PREPARING]: 'Preparing your Vibe…',
  [VIBE_UPLOAD_STATES.UPLOADING]: 'Uploading media…',
  [VIBE_UPLOAD_STATES.PROCESSING]: 'Processing media…',
  [VIBE_UPLOAD_STATES.PUBLISHING]: 'Publishing to feed…',
  [VIBE_UPLOAD_STATES.PUBLISHED]: 'Vibe published!',
  [VIBE_UPLOAD_STATES.FAILED]: 'Publish failed',
  [VIBE_UPLOAD_STATES.CANCELLED]: 'Upload cancelled',
};

export function VibePublishOverlay({
  state,
  progress = 0,
  error = null,
  isDark = true,
  onCancel,
  onRetry,
  onSaveDraft,
  onDismiss,
}) {
  const isVisible = state && state !== VIBE_UPLOAD_STATES.IDLE;
  const isInFlight =
    state === VIBE_UPLOAD_STATES.PREPARING ||
    state === VIBE_UPLOAD_STATES.UPLOADING ||
    state === VIBE_UPLOAD_STATES.PROCESSING ||
    state === VIBE_UPLOAD_STATES.PUBLISHING;
  const isFailed = state === VIBE_UPLOAD_STATES.FAILED;
  const isCancelled = state === VIBE_UPLOAD_STATES.CANCELLED;

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Vibe upload progress"
        >
          <motion.div
            initial={{ scale: 0.94, y: 12 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.94, y: 12 }}
            className={cn(
              'w-full max-w-sm rounded-3xl p-6 border shadow-2xl space-y-4 text-center',
              isDark ? 'bg-[#0A102D] border-white/10 text-white' : 'bg-white border-slate-200 text-slate-900'
            )}
          >
            <div className="w-12 h-12 rounded-2xl mx-auto flex items-center justify-center bg-white/10">
              {isFailed || isCancelled ? (
                <AlertCircle className="w-6 h-6 text-rose-400" aria-hidden="true" />
              ) : state === VIBE_UPLOAD_STATES.PUBLISHED ? (
                <CheckCircle2 className="w-6 h-6 text-emerald-400" aria-hidden="true" />
              ) : (
                <Loader2 className="w-6 h-6 text-indigo-400 animate-spin" aria-hidden="true" />
              )}
            </div>

            <div>
              <h3 className="text-base font-bold">{STATE_COPY[state] || 'Publishing…'}</h3>
              {error && (
                <p className={cn('text-xs mt-1.5', isDark ? 'text-rose-300' : 'text-rose-600')}>
                  {error}
                </p>
              )}
            </div>

            {isInFlight && (
              <div className="space-y-1.5">
                <div className={cn('h-2 rounded-full overflow-hidden', isDark ? 'bg-white/10' : 'bg-slate-200')}>
                  <div
                    className="h-full transition-all duration-200"
                    style={{
                      width: `${Math.max(8, Math.min(100, progress))}%`,
                      background: BRAND_GRADIENT,
                    }}
                  />
                </div>
                <p className={cn('text-xs font-mono', isDark ? 'text-slate-400' : 'text-slate-600')}>
                  {Math.round(progress)}%
                </p>
              </div>
            )}

            <div className="flex flex-col gap-2 pt-1">
              {isInFlight && (
                <button
                  type="button"
                  onClick={onCancel}
                  className={cn(
                    'w-full min-h-[44px] py-2.5 rounded-2xl text-xs font-bold cursor-pointer',
                    isDark ? 'bg-white/10 hover:bg-white/20 text-white' : 'bg-slate-100 hover:bg-slate-200 text-slate-900'
                  )}
                >
                  Cancel Upload
                </button>
              )}

              {(isFailed || isCancelled) && (
                <>
                  <button
                    type="button"
                    onClick={onRetry}
                    className="w-full min-h-[44px] py-2.5 rounded-2xl text-white text-xs font-bold inline-flex items-center justify-center gap-1.5 cursor-pointer"
                    style={{ background: BRAND_GRADIENT }}
                  >
                    <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Retry Publish</span>
                  </button>
                  <button
                    type="button"
                    onClick={onSaveDraft}
                    className={cn(
                      'w-full min-h-[44px] py-2.5 rounded-2xl text-xs font-bold cursor-pointer',
                      isDark ? 'bg-white/10 hover:bg-white/20 text-white' : 'bg-slate-100 hover:bg-slate-200 text-slate-900'
                    )}
                  >
                    Save Draft Locally
                  </button>
                  <button
                    type="button"
                    onClick={onDismiss}
                    className="text-xs font-semibold opacity-70 hover:opacity-100 py-1 cursor-pointer"
                  >
                    Back to Studio
                  </button>
                </>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
