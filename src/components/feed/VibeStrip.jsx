// src/components/feed/VibeStrip.jsx
// HOME ENTRY POINT for Vibes (spec §33/34): a compact strip of creator rings.
// It is a GATEWAY, not the viewer — tapping opens the canonical dedicated
// Vibes experience (/stories) positioned at that creator's sequence.
// The Home feed stays a feed.

import React, { useState, useEffect, useCallback, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn } from '../../lib/utils';
import { VibeRing } from '../ui/VibeRing';
import storyService from '../../services/storyService';

export const VibeStrip = memo(({ currentUser, className = '' }) => {
  const navigate = useNavigate();
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let isMounted = true;

    const fetchVibes = async () => {
      if (!currentUser?.uid) {
        setLoading(false);
        return;
      }
      try {
        // REAL feed shape: { groups: [{ userId, stories: [...] }] }
        const feedData = await storyService.getStoriesFeed?.(currentUser.uid, { cacheFirst: true, limit: 30 });
        if (isMounted) {
          const rawGroups = Array.isArray(feedData?.groups) ? feedData.groups : [];
          const viable = rawGroups.filter((g) => Array.isArray(g.stories) && g.stories.length > 0);

          // Resolve real creator identity (story docs carry only userId).
          const { getUserService } = await import('../../services/userService.js');
          const mapped = await Promise.all(viable.map(async (g) => {
            const first = g.stories[0] || {};
            const any = g.stories.find((s) => s && !s.seen) || first;
            let name = 'Creator';
            let avatar = null;
            try {
              const profile = await getUserService().getUserProfile(g.userId);
              if (profile) {
                name = profile.displayName || profile.username || name;
                avatar = profile.photoURL || null;
              }
            } catch { /* identity optional — ring falls back */ }
            return {
              id: g.userId,
              userId: g.userId,
              name,
              avatar,
              hasUnseen: Boolean(any && !any.seen),
              isLive: Boolean(first.isLive),
              count: g.stories.length,
            };
          }));
          setGroups(mapped);
          setError(null);
          setLoading(false);
        }
      } catch (err) {
        console.warn('Vibes fetch fallback:', err);
        if (isMounted) {
          setError(err?.message || 'Could not load Vibes');
          setLoading(false);
        }
      }
    };

    fetchVibes();
    return () => {
      isMounted = false;
    };
  }, [currentUser?.uid]);

  const handleAddVibe = useCallback(() => {
    navigate('/create-story');
  }, [navigate]);

  // Open the CANONICAL viewer (dedicated Vibes screen) at this creator's
  // sequence (spec §33: tap ring -> dedicated experience).
  const handleOpenVibe = useCallback((userId) => {
    navigate('/stories', { state: { vibeUserId: userId } });
  }, [navigate]);

  const handleOpenAll = useCallback(() => {
    navigate('/stories');
  }, [navigate]);

  return (
    <div
      className={cn(
        'w-full overflow-x-auto scrollbar-hide py-3 px-4 flex items-center gap-3.5 select-none',
        className
      )}
    >
      {/* Your Vibe / Add Vibe */}
      <div className="flex flex-col items-center gap-1 shrink-0">
        <div className="relative">
          <VibeRing
            src={currentUser?.photoURL || currentUser?.avatar}
            name={currentUser?.displayName || 'You'}
            size="md"
            hasUnseen={false}
            isOwn={true}
            onClick={handleAddVibe}
          />
        </div>
        <span className="text-[11px] font-medium text-arvdoul-text-secondary truncate max-w-[64px]">
          Your Vibe
        </span>
      </div>

      {/* Loading Skeletons */}
      {loading &&
        [1, 2, 3, 4].map((i) => (
          <div key={i} className="flex flex-col items-center gap-1 shrink-0 animate-pulse" aria-hidden="true">
            <div className="w-16 h-16 rounded-full bg-white/10" />
            <div className="w-10 h-2 rounded bg-white/10 mt-1" />
          </div>
        ))}

      {/* Feed Vibes (creator rings — gateway to the dedicated viewer) */}
      {!loading && !error &&
        groups.map((vibe) => (
          <div
            key={vibe.id}
            className="flex flex-col items-center gap-1 shrink-0 cursor-pointer"
            role="button"
            tabIndex={0}
            aria-label={`View ${vibe.name}'s ${vibe.count} Vibes`}
            onClick={() => handleOpenVibe(vibe.userId)}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleOpenVibe(vibe.userId); }}
          >
            <VibeRing
              src={vibe.avatar}
              name={vibe.name}
              size="md"
              hasUnseen={vibe.hasUnseen}
              isLive={vibe.isLive || false}
            />
            <span className="text-[11px] font-medium text-arvdoul-text-primary truncate max-w-[68px] text-center">
              {vibe.name}
            </span>
          </div>
        ))}

      {/* Honest empty/error states (spec §62) — never fabricate Vibes */}
      {!loading && !error && groups.length === 0 && (
        <button
          onClick={handleOpenAll}
          className="flex items-center gap-2 px-3 py-2 rounded-full bg-white/5 border border-white/10 text-xs text-arvdoul-text-secondary hover:bg-white/10 transition-colors"
        >
          <Sparkles className="w-3.5 h-3.5 text-purple-400" />
          No Vibes right now
        </button>
      )}
      {error && (
        <span className="text-[11px] text-arvdoul-text-secondary/70 px-2">
          Vibes unavailable — retry later
        </span>
      )}

      {/* See all — dedicated experience */}
      {!loading && groups.length > 0 && (
        <button
          onClick={handleOpenAll}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-full text-[11px] font-semibold text-purple-400 hover:bg-purple-500/10 transition-colors shrink-0"
          aria-label="Open all Vibes"
        >
          See all
        </button>
      )}
    </div>
  );
});

VibeStrip.displayName = 'VibeStrip';

export default VibeStrip;
