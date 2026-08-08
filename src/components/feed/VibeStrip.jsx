// src/components/feed/VibeStrip.jsx
import React, { useState, useEffect, useCallback, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn } from '../../lib/utils';
import { VibeRing } from '../ui/VibeRing';
import storyService from '../../services/storyService';
import StoryViewer from '../Stories/StoryViewer';

export const VibeStrip = memo(({ currentUser, className = '' }) => {
  const navigate = useNavigate();
  const [vibes, setVibes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedVibeIndex, setSelectedVibeIndex] = useState(null);

  useEffect(() => {
    let isMounted = true;

    const fetchVibes = async () => {
      if (!currentUser?.uid) {
        setLoading(false);
        return;
      }
      try {
        const feedData = await storyService.getStoriesFeed?.(currentUser.uid);
        if (isMounted) {
          const list = Array.isArray(feedData?.stories || feedData) ? (feedData.stories || feedData) : [];
          setVibes(list);
          setLoading(false);
        }
      } catch (err) {
        console.warn('Vibes fetch fallback:', err);
        if (isMounted) setLoading(false);
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

  const handleOpenVibe = useCallback((index) => {
    setSelectedVibeIndex(index);
  }, []);

  const handleCloseViewer = useCallback(() => {
    setSelectedVibeIndex(null);
  }, []);

  return (
    <>
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
          [1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex flex-col items-center gap-1 shrink-0 animate-pulse">
              <div className="w-16 h-16 rounded-full bg-white/10" />
              <div className="w-10 h-2 rounded bg-white/10 mt-1" />
            </div>
          ))}

        {/* Feed Vibes */}
        {!loading &&
          vibes.map((vibe, idx) => {
            const hasUnseen = !vibe.viewed && !vibe.views?.includes(currentUser?.uid);
            return (
              <div
                key={vibe.id || idx}
                className="flex flex-col items-center gap-1 shrink-0 cursor-pointer"
              >
                <VibeRing
                  src={vibe.userPhotoURL || vibe.userAvatar || vibe.authorPhoto}
                  name={vibe.displayName || vibe.username || vibe.authorName}
                  size="md"
                  hasUnseen={hasUnseen}
                  isLive={vibe.isLive || false}
                  onClick={() => handleOpenVibe(idx)}
                />
                <span className="text-[11px] font-medium text-arvdoul-text-primary truncate max-w-[68px] text-center">
                  {vibe.displayName || vibe.username || vibe.authorName || 'Creator'}
                </span>
              </div>
            );
          })}
      </div>

      {/* Story / Vibe Viewer Modal */}
      {selectedVibeIndex !== null && vibes[selectedVibeIndex] && (
        <StoryViewer
          stories={vibes}
          initialIndex={selectedVibeIndex}
          onClose={handleCloseViewer}
          currentUser={currentUser}
        />
      )}
    </>
  );
});

VibeStrip.displayName = 'VibeStrip';

export default VibeStrip;
