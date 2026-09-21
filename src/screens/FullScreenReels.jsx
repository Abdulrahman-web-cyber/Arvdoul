// src/screens/FullScreenReels.jsx
// Ultra Pro Max Production Ready Reels Viewer

import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
  memo,
} from "react";

import { motion, AnimatePresence } from "framer-motion";

import {
  X,
  ChevronUp,
  ChevronDown,
  Volume2,
  VolumeX,
} from "lucide-react";

import PostCard from "./PostCard.jsx";
import { ErrorBoundary } from "../components/ErrorBoundary";
import { triggerHaptic } from "../utils/haptics";

const cn = (...classes) => classes.filter(Boolean).join(" ");

const ReelControls = memo(
  ({
    currentIndex,
    total,
    onNext,
    onPrev,
    muted,
    toggleMute,
    onClose,
  }) => {
    return (
      <>
        <button
          onClick={onClose}
          className="fixed top-5 right-5 z-50 p-3 rounded-full bg-black/50 backdrop-blur-md text-white"
          aria-label="Close reels"
        >
          <X className="w-6 h-6" />
        </button>

        <div className="fixed right-4 top-1/2 -translate-y-1/2 z-50 flex flex-col gap-3">
          <button
            onClick={onPrev}
            disabled={currentIndex === 0}
            className="p-3 rounded-full bg-black/50 backdrop-blur-md text-white disabled:opacity-30"
            aria-label="Previous reel"
          >
            <ChevronUp className="w-6 h-6" />
          </button>

          <button
            onClick={toggleMute}
            className="p-3 rounded-full bg-black/50 backdrop-blur-md text-white"
            aria-label={muted ? "Unmute reels" : "Mute reels"}
          >
            {muted ? (
              <VolumeX className="w-6 h-6" />
            ) : (
              <Volume2 className="w-6 h-6" />
            )}
          </button>

          <button
            onClick={onNext}
            disabled={currentIndex >= total - 1}
            className="p-3 rounded-full bg-black/50 backdrop-blur-md text-white disabled:opacity-30"
            aria-label="Next reel"
          >
            <ChevronDown className="w-6 h-6" />
          </button>
        </div>
      </>
    );
  }
);

const FullScreenReels = ({
  feed = [],
  currentUser,
  initialIndex = 0,
  onClose,
  navigate,
}) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [muted, setMuted] = useState(false);

  const containerRef = useRef(null);
  const touchStartY = useRef(0);

  const reelsFeed = feed.filter(
    (post) =>
      !post?.isAd &&
      (
        post?.type === "video" ||
        post?.type === "image" ||
        post?.media?.length > 0
      )
  );

  const currentPost = reelsFeed[currentIndex];

  const goNext = useCallback(() => {
    setCurrentIndex((prev) => {
      if (prev >= reelsFeed.length - 1) return prev;

      triggerHaptic("light");

      return prev + 1;
    });
  }, [reelsFeed.length]);

  const goPrev = useCallback(() => {
    setCurrentIndex((prev) => {
      if (prev <= 0) return prev;

      triggerHaptic("light");

      return prev - 1;
    });
  }, []);

  const toggleMute = useCallback(() => {
    triggerHaptic("selection");
    setMuted((prev) => !prev);
  }, []);

  useEffect(() => {
    const handler = (e) => {
      if (e.key === "ArrowDown") goNext();
      if (e.key === "ArrowUp") goPrev();
      if (e.key === "Escape") onClose?.();
    };

    window.addEventListener("keydown", handler);

    return () => {
      window.removeEventListener("keydown", handler);
    };
  }, [goNext, goPrev, onClose]);

  const handleTouchStart = (e) => {
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e) => {
    const endY = e.changedTouches[0].clientY;
    const diff = touchStartY.current - endY;

    if (Math.abs(diff) < 50) return;

    if (diff > 0) {
      goNext();
    } else {
      goPrev();
    }
  };

  if (!currentPost) return null;

  return (
    <AnimatePresence>
      <motion.div
        ref={containerRef}
        className="fixed inset-0 z-[9999] bg-black overflow-hidden"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/60 pointer-events-none" />

        <ReelControls
          currentIndex={currentIndex}
          total={reelsFeed.length}
          onNext={goNext}
          onPrev={goPrev}
          muted={muted}
          toggleMute={toggleMute}
          onClose={onClose}
        />

        <motion.div
          key={currentPost.id}
          initial={{ opacity: 0, y: 80 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -80 }}
          transition={{
            duration: 0.35,
            ease: "easeOut",
          }}
          className="w-full h-full flex items-center justify-center px-2 sm:px-4 py-6"
        >
          <div className="w-full max-w-xl h-full overflow-y-auto scrollbar-hide">
            <ErrorBoundary
              fallback={
                <div className="text-white text-center py-10">
                  Failed to load reel
                </div>
              }
            >
              <PostCard
                post={currentPost}
                currentUser={currentUser}
                navigate={navigate}
                onComment={() => {}}
                onShowOptions={() => {}}
                globalVideoMuted={muted}
                ariaLabel={`Reel by ${currentPost.authorName}`}
              />
            </ErrorBoundary>
          </div>
        </motion.div>

        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-2">
          {reelsFeed.map((_, index) => (
            <div
              key={index}
              className={cn(
                "h-2 rounded-full transition-all duration-300",
                index === currentIndex
                  ? "w-8 bg-white"
                  : "w-2 bg-white/40"
              )}
            />
          ))}
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export default memo(FullScreenReels);
