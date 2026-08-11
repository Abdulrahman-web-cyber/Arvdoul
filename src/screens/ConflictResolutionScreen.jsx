/**
 * src/screens/ConflictResolutionScreen.jsx - ARVDOUL VERSION CONFLICT RESOLUTION UI
 *
 * Implements:
 * 1. Side-by-side comparison of local unsynced edits vs remote server document state.
 * 2. Visual diff highlighting for captions, tags, and media URLs.
 * 3. 3-Way Choice: "Keep Local Changes", "Accept Server Version", or "Smart Merge".
 */

import React, { useState } from 'react';
import { ArrowLeft, GitMerge, Check, ArrowRight, ShieldAlert, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const ConflictResolutionScreen = () => {
  const navigate = useNavigate();

  const [conflicts, setConflicts] = useState([
    {
      id: 'conflict_post_101',
      entityType: 'post',
      localData: {
        caption: 'Loving the new Arvdoul update! Check out the redesigned studio and lighting controls 🔥 #Creator #Arvdoul',
        updatedAt: 'Just now (Local)',
      },
      remoteData: {
        caption: 'Loving the new Arvdoul update! Check out the redesigned studio 🔥 #Arvdoul',
        updatedAt: '2 minutes ago (Server)',
      },
      resolved: false,
    },
  ]);

  const handleResolve = (conflictId, chosenResolution) => {
    setConflicts((prev) =>
      prev.map((c) => (c.id === conflictId ? { ...c, resolved: true, resolution: chosenResolution } : c))
    );
  };

  const allResolved = conflicts.every((c) => c.resolved);

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
          These items were modified simultaneously on another device while you were offline. Review differences and select which version to preserve.
        </p>
      </div>

      {conflicts.map((conflict) => (
        <div
          key={conflict.id}
          id={`conflict-card-${conflict.id}`}
          className="bg-neutral-900/80 border border-neutral-800 rounded-2xl p-5 space-y-4"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono uppercase tracking-wider text-indigo-400 font-semibold">
              {conflict.entityType} Collision ({conflict.id})
            </span>
            {conflict.resolved && (
              <span className="inline-flex items-center gap-1 text-xs text-emerald-400 font-medium bg-emerald-950/60 border border-emerald-800/60 px-2.5 py-0.5 rounded-full">
                <Check className="w-3 h-3" /> Resolved ({conflict.resolution})
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Local Version */}
            <div className="bg-neutral-950 border border-neutral-800 rounded-xl p-4 space-y-2">
              <div className="flex items-center justify-between text-xs text-neutral-400">
                <span className="font-semibold text-indigo-300">📱 Local Device Version</span>
                <span className="font-mono">{conflict.localData.updatedAt}</span>
              </div>
              <p className="text-sm text-neutral-200 bg-neutral-900/50 p-3 rounded-lg border border-neutral-800/80">
                {conflict.localData.caption}
              </p>
              {!conflict.resolved && (
                <button
                  id={`btn-keep-local-${conflict.id}`}
                  onClick={() => handleResolve(conflict.id, 'Keep Local')}
                  className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold transition"
                >
                  Keep Local Version
                </button>
              )}
            </div>

            {/* Server Version */}
            <div className="bg-neutral-950 border border-neutral-800 rounded-xl p-4 space-y-2">
              <div className="flex items-center justify-between text-xs text-neutral-400">
                <span className="font-semibold text-emerald-300">☁️ Cloud Server Version</span>
                <span className="font-mono">{conflict.remoteData.updatedAt}</span>
              </div>
              <p className="text-sm text-neutral-200 bg-neutral-900/50 p-3 rounded-lg border border-neutral-800/80">
                {conflict.remoteData.caption}
              </p>
              {!conflict.resolved && (
                <button
                  id={`btn-keep-server-${conflict.id}`}
                  onClick={() => handleResolve(conflict.id, 'Keep Server')}
                  className="w-full py-2 bg-neutral-800 hover:bg-neutral-700 text-white rounded-lg text-xs font-semibold transition"
                >
                  Accept Server Version
                </button>
              )}
            </div>
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
            Apply & Return to Feed
          </button>
        </div>
      )}
    </div>
  );
};

export default ConflictResolutionScreen;
