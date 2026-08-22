/**
 * src/screens/ConflictResolutionScreen.jsx - ARVDOUL SYNC CONFLICT RESOLUTION UI
 *
 * Honest implementation: shows REAL unsynced local changes from the offline
 * queue (operations that have not been applied to the server yet). No
 * fabricated example conflicts — when there is nothing pending, the screen
 * says exactly that.
 *
 * Actions:
 *  - Keep Local (Retry) — leaves the operation queued; the app's online drain
 *    retries it automatically when connectivity returns.
 *  - Discard Local Change — removes the queued operation (the server copy,
 *    if any, wins).
 */

import React, { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, GitMerge, Check, ShieldAlert, RefreshCw, Trash2, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { offlineQueue } from '../utils/OfflineQueue.js';
import { toast } from 'sonner';

/** Human summary of an operation payload — real fields only. */
function summarizePayload(op) {
  const p = op.payload || {};
  const caption = p.caption || p.text || p.content || p.message || '';
  const title = p.title || p.name || p.packageId || '';
  if (caption) return String(caption);
  if (title) return String(title);
  const keys = Object.keys(p);
  if (keys.length === 0) return '(no details)';
  return keys.slice(0, 3).map((k) => `${k}: ${String(p[k]).slice(0, 40)}`).join(' • ');
}

export const ConflictResolutionScreen = () => {
  const navigate = useNavigate();

  const [conflicts, setConflicts] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadConflicts = useCallback(async () => {
    try {
      const pending = await offlineQueue.getPending();
      setConflicts(
        pending.map((op) => ({
          id: String(op.id),
          opId: op.id,
          entityType: op.type,
          localData: {
            summary: summarizePayload(op),
            updatedAt: op.createdAt ? new Date(op.createdAt).toLocaleString() : '',
            attempts: op.attempts || 0,
          },
          resolved: false,
        }))
      );
    } catch (err) {
      console.warn('Failed to load pending operations:', err);
      setConflicts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadConflicts();
  }, [loadConflicts]);

  const handleResolve = async (conflictId, chosenResolution) => {
    const conflict = conflicts.find((c) => c.id === conflictId);
    if (!conflict) return;

    if (chosenResolution === 'Discard') {
      try {
        await offlineQueue.remove(conflict.opId);
        toast.success('Local change discarded');
      } catch (err) {
        toast.error('Failed to discard the queued change');
        return;
      }
    } else {
      toast.info('Kept locally — will sync automatically when back online');
    }

    setConflicts((prev) =>
      prev.map((c) =>
        c.id === conflictId
          ? { ...c, resolved: true, resolution: chosenResolution === 'Discard' ? 'Discarded local change' : 'Kept local change' }
          : c
      )
    );
  };

  const allResolved = conflicts.length > 0 && conflicts.every((c) => c.resolved);

  return (
    <div id="conflict-resolution-screen" className="min-h-screen bg-black text-white p-4 md:p-8 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-neutral-800 pb-4">
        <button
          id="btn-back-from-conflict"
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-sm text-neutral-400 hover:text-white transition"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back</span>
        </button>
        <div className="flex items-center gap-2 text-indigo-400 font-semibold text-sm">
          <GitMerge className="w-4 h-4" />
          <span>Sync Conflict Manager</span>
        </div>
      </div>

      <div>
        <h1 className="text-2xl font-bold tracking-tight">Resolve Version Collisions</h1>
        <p className="text-sm text-neutral-400 mt-1">
          Changes made while offline that have not reached the server yet. Review each one and decide whether to keep it or discard it.
        </p>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-7 h-7 animate-spin text-indigo-400" />
        </div>
      )}

      {!loading && conflicts.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-14 h-14 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center mb-4">
            <Check className="w-6 h-6 text-emerald-400" />
          </div>
          <p className="font-semibold text-white mb-1">No sync conflicts detected</p>
          <p className="text-sm text-neutral-400 max-w-sm">
            All local changes are in sync with the server. This screen only shows real unsynced operations from your device.
          </p>
        </div>
      )}

      {conflicts.map((conflict) => (
        <div
          key={conflict.id}
          id={`conflict-card-${conflict.id}`}
          className="bg-neutral-900/80 border border-neutral-800 rounded-2xl p-5 space-y-4"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono uppercase tracking-wider text-indigo-400 font-semibold">
              {conflict.entityType} — queued {conflict.localData.updatedAt}
            </span>
            {conflict.resolved && (
              <span className="inline-flex items-center gap-1 text-xs text-emerald-400 font-medium bg-emerald-950/60 border border-emerald-800/60 px-2.5 py-0.5 rounded-full">
                <Check className="w-3 h-3" /> Resolved ({conflict.resolution})
              </span>
            )}
          </div>

          <div className="bg-neutral-950 border border-neutral-800 rounded-xl p-4 space-y-2">
            <div className="flex items-center justify-between text-xs text-neutral-400">
              <span className="font-semibold text-indigo-300">📱 Local unsynced change</span>
              <span className="font-mono">{conflict.localData.attempts} attempt(s)</span>
            </div>
            <p className="text-sm text-neutral-200 bg-neutral-900/50 p-3 rounded-lg border border-neutral-800/80 break-words">
              {conflict.localData.summary}
            </p>
            {!conflict.resolved && (
              <div className="flex flex-col sm:flex-row gap-2 pt-1">
                <button
                  id={`btn-keep-local-${conflict.id}`}
                  onClick={() => handleResolve(conflict.id, 'Keep')}
                  className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold transition flex items-center justify-center gap-1.5"
                >
                  <RefreshCw className="w-3.5 h-3.5" /> Keep &amp; Retry Sync
                </button>
                <button
                  id={`btn-discard-${conflict.id}`}
                  onClick={() => handleResolve(conflict.id, 'Discard')}
                  className="flex-1 py-2 bg-neutral-800 hover:bg-red-600/80 text-white rounded-lg text-xs font-semibold transition flex items-center justify-center gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Discard Local Change
                </button>
              </div>
            )}
          </div>

          <div className="flex items-start gap-2 text-[11px] text-neutral-500 bg-neutral-950/60 border border-neutral-800/60 rounded-xl p-3">
            <ShieldAlert className="w-3.5 h-3.5 shrink-0 mt-0.5 text-amber-400" />
            <span>
              The server has no record of this change yet. Keeping it queues it for the next automatic sync; discarding removes it from this device only.
            </span>
          </div>
        </div>
      ))}

      {allResolved && (
        <div className="pt-4 flex justify-end">
          <button
            id="btn-complete-conflict-resolution"
            onClick={() => navigate('/app/feed')}
            className="px-6 py-2.5 bg-gradient-to-r from-indigo-600 to-emerald-500 hover:opacity-90 text-white font-medium rounded-xl text-sm transition shadow-lg"
          >
            Done &amp; Return to Feed
          </button>
        </div>
      )}
    </div>
  );
};

export default ConflictResolutionScreen;
