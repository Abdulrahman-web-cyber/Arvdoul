import PropTypes from 'prop-types';
import { useEffect, useState, useRef } from "react";
import { motion } from "framer-motion";
import { db } from "../../firebase/firebase.js";
import {
  collection,
  query,
  where,
  orderBy,
  getDocs,
  doc,
  updateDoc,
} from "firebase/firestore";

const STORY_LIFETIME = 24 * 60 * 60 * 1000; // 24 hours

export default function StoryViewer({ userId, onClose }) {
  const [stories, setStories] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [duration, setDuration] = useState(4000);
  const timerRef = useRef(null);
  const videoRef = useRef(null);
  const containerRef = useRef(null);
  const startXRef = useRef(0);
  const isPausedRef = useRef(false);

  // Fetch stories
  useEffect(() => {
    const fetchStories = async () => {
      const storiesRef = collection(db, "stories");
      const q = query(
        storiesRef,
        where("userId", "==", userId),
        orderBy("createdAt", "asc"),
      );
      const snapshot = await getDocs(q);
      const filtered = snapshot.docs
        .map((doc) => ({ id: doc.id, ...doc.data() }))
        .filter((story) => {
          const createdAt = story.createdAt?.toDate?.();
          return createdAt && Date.now() - createdAt.getTime() < STORY_LIFETIME;
        });
      setStories(filtered);
    };
    fetchStories();
  }, [userId]);

  // Mark story as seen
  useEffect(() => {
    if (!stories.length) return;
    const currentStory = stories[currentIndex];
    if (!currentStory) return;

    const markAsSeen = async () => {
      if (!currentStory.seen) {
        try {
          const storyDoc = doc(db, "stories", currentStory.id);
          await updateDoc(storyDoc, { seen: true });
          setStories((prev) => {
            const updated = [...prev];
            updated[currentIndex].seen = true;
            return updated;
          });
        } catch (err) {
          console.error("Failed to mark story as seen:", err);
        }
      }
    };
    markAsSeen();
  }, [currentIndex, stories]);

  // Auto-advance timer
  useEffect(() => {
    if (!stories.length || isPausedRef.current) return;
    const currentStory = stories[currentIndex];
    if (!currentStory) return;

    clearTimeout(timerRef.current);

    const nextStory = () => {
      if (currentIndex < stories.length - 1)
        setCurrentIndex((prev) => prev + 1);
      else onClose();
    };

    if (currentStory.mediaType === "video") {
      const videoEl = videoRef.current;
      if (videoEl) {
        videoEl.currentTime = 0;
        videoEl.play();
        const onLoaded = () => {
          const videoDuration = (videoEl.duration || 4) * 1000;
          setDuration(videoDuration);
          timerRef.current = setTimeout(nextStory, videoDuration);
        };
        videoEl.addEventListener("loadedmetadata", onLoaded, { once: true });
      }
    } else {
      setDuration(4000);
      timerRef.current = setTimeout(nextStory, 4000);
    }

    return () => clearTimeout(timerRef.current);
  }, [currentIndex, stories, onClose]);

  // Swipe handlers
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleTouchStart = (e) => {
      startXRef.current = e.touches[0].clientX;
      pauseStory();
    };

    const handleTouchMove = (e) => {
      const diffX = e.touches[0].clientX - startXRef.current;
      // Optional: visual swipe feedback here
    };

    const handleTouchEnd = (e) => {
      const diffX = e.changedTouches[0].clientX - startXRef.current;
      if (diffX > 50)
        handlePrev(); // swipe right
      else if (diffX < -50) handleNext(); // swipe left
      resumeStory();
    };

    container.addEventListener("touchstart", handleTouchStart);
    container.addEventListener("touchmove", handleTouchMove);
    container.addEventListener("touchend", handleTouchEnd);

    return () => {
      container.removeEventListener("touchstart", handleTouchStart);
      container.removeEventListener("touchmove", handleTouchMove);
      container.removeEventListener("touchend", handleTouchEnd);
    };
  }, [currentIndex, stories]);

  const currentStory = stories[currentIndex];

  const pauseStory = () => {
    if (!currentStory) return;
    clearTimeout(timerRef.current);
    if (currentStory.mediaType === "video" && videoRef.current)
      videoRef.current.pause();
    isPausedRef.current = true;
  };

  const resumeStory = () => {
    if (!currentStory) return;
    isPausedRef.current = false;
    if (currentStory.mediaType === "video" && videoRef.current)
      videoRef.current.play();
    timerRef.current = setTimeout(
      () => {
        if (currentIndex < stories.length - 1)
          setCurrentIndex((prev) => prev + 1);
        else onClose();
      },
      currentStory.mediaType === "video" && videoRef.current
        ? videoRef.current.duration * 1000
        : 4000,
    );
  };

  const handleNext = () => {
    if (!currentStory) return;
    clearTimeout(timerRef.current);
    if (currentIndex < stories.length - 1) setCurrentIndex((prev) => prev + 1);
    else onClose();
  };

  const handlePrev = () => {
    if (!currentStory) return;
    clearTimeout(timerRef.current);
    if (currentIndex > 0) setCurrentIndex((prev) => prev - 1);
  };

  if (!stories.length) return null;

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-50 bg-black/95 flex flex-col items-center justify-center"
    >
      {/* Progress Bars */}
      <div className="flex w-full px-4 pt-4 gap-1">
        {stories.map((_, idx) => (
          <div
            key={idx}
            className="flex-1 h-1 bg-white/30 rounded-full overflow-hidden"
          >
            <motion.div
              className="h-full bg-white rounded-full"
              initial={{ width: idx < currentIndex ? "100%" : "0%" }}
              animate={{
                width:
                  idx === currentIndex
                    ? "100%"
                    : idx < currentIndex
                      ? "100%"
                      : "0%",
              }}
              transition={{
                duration: idx === currentIndex ? duration / 1000 : 0,
                ease: "linear",
              }}
            />
          </div>
        ))}
      </div>

      {/* Story Content */}
      <div className="flex-1 w-full flex items-center justify-center relative px-4">
        {currentStory.mediaType === "video" ? (
          <video
            ref={videoRef}
            src={currentStory.mediaUrl}
            className="max-h-full max-w-full object-contain rounded-xl"
            muted
            playsInline
          />
        ) : (
          <img
            src={currentStory.mediaUrl}
            alt={currentStory.username || "Story"}
            className="max-h-full max-w-full object-contain rounded-xl"
          />
        )}

        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-white text-lg bg-black/50 p-1 px-3 rounded-md"
        >
          ✕
        </button>

        {/* Navigation Areas */}
        <div
          onClick={handlePrev}
          onMouseDown={pauseStory}
          onMouseUp={resumeStory}
          className="absolute left-0 top-0 bottom-0 w-1/3 cursor-pointer z-20"
        />
        <div
          onClick={handleNext}
          onMouseDown={pauseStory}
          onMouseUp={resumeStory}
          className="absolute right-0 top-0 bottom-0 w-1/3 cursor-pointer z-20"
        />

        {/* Username */}
        <div className="absolute top-6 left-4 text-white font-semibold">
          {currentStory.username || "User"}
        </div>
      </div>
    </div>
  );
}

STORY_LIFETIME.propTypes = {};
