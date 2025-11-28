// src/components/Home/Stories.jsx
import PropTypes from 'prop-types';
import { useEffect, useState, useRef, useCallback } from "react";
import { Plus, X, Volume2, VolumeX } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useTheme } from "../../context/ThemeContext";
import { useAuth } from "@context/AuthContext";
import { collection, query, orderBy, onSnapshot, doc, updateDoc, arrayUnion } from "firebase/firestore";
import { db } from "../../firebase/firebase.js";
import defaultAvatar from "../../assets/default-profile.png";

// ---------------- Constants ----------------
const IMAGE_DURATION = 4000; // 4s per image
const VIDEO_CHECK_INTERVAL = 200;
const SWIPE_THRESHOLD = 50;

export default function Stories() {
  const [stories, setStories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeStory, setActiveStory] = useState(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [muted, setMuted] = useState(true);
  const { currentUser } = useAuth();
  const { theme } = useTheme();

  const timerRef = useRef(null);
  const videoRef = useRef(null);
  const touchStart = useRef({ x: 0, y: 0 });
  const touchEnd = useRef({ x: 0, y: 0 });

  // ---------------- Real-time stories listener ----------------
  useEffect(() => {
    const q = query(collection(db, "stories"), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(q, snapshot => {
      const storiesList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setStories(storiesList);
      setLoading(false);
    }, err => {
      console.error("Error fetching stories:", err);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // ---------------- Track viewed ----------------
  const markStoryAsViewed = async (storyId) => {
    if (!currentUser) return;
    try {
      const storyRef = doc(db, "stories", storyId);
      await updateDoc(storyRef, { views: arrayUnion(currentUser.uid) });
    } catch (err) {
      console.error("Failed to mark story as viewed:", err);
    }
  };

  // ---------------- Auto-advance ----------------
  useEffect(() => {
    if (!activeStory) return;
    const currentMedia = activeStory.media[activeIndex];
    if (!currentMedia) return;

    markStoryAsViewed(activeStory.id);

    if (currentMedia.type === "video" && videoRef.current) {
      const vid = videoRef.current;
      vid.currentTime = 0;
      vid.muted = muted;
      vid.play().catch(() => {});
      timerRef.current = setInterval(() => {
        if (vid.ended) nextMedia();
      }, VIDEO_CHECK_INTERVAL);
    } else {
      timerRef.current = setTimeout(nextMedia, IMAGE_DURATION);
    }

    return () => {
      clearTimeout(timerRef.current);
      clearInterval(timerRef.current);
      if (videoRef.current) videoRef.current.pause();
    };
  }, [activeIndex, activeStory, muted]);

  // ---------------- Navigation ----------------
  const openStory = (story) => { setActiveStory(story); setActiveIndex(0); setMuted(true); };
  const closeStory = () => { setActiveStory(null); setActiveIndex(0); setMuted(true); };
  const nextMedia = useCallback(() => { 
    if (!activeStory) return;
    if (activeIndex < activeStory.media.length - 1) setActiveIndex(prev => prev + 1);
    else closeStory();
  }, [activeIndex, activeStory]);

  const prevMedia = useCallback(() => { 
    if (!activeStory) return;
    if (activeIndex > 0) setActiveIndex(prev => prev - 1);
    else closeStory();
  }, [activeIndex, activeStory]);

  // ---------------- Swipe handlers ----------------
  const onTouchStart = (e) => {
    touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  };
  const onTouchMove = (e) => {
    touchEnd.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  };
  const onTouchEnd = () => {
    const dx = touchStart.current.x - touchEnd.current.x;
    const dy = touchStart.current.y - touchEnd.current.y;

    // Horizontal swipe -> next/prev media
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > SWIPE_THRESHOLD) {
      dx > 0 ? nextMedia() : prevMedia();
    }

    // Vertical swipe
    if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > SWIPE_THRESHOLD) {
      dy > 0 ? closeStory() : handleAddStory();
    }
  };

  // ---------------- Add Story Modal ----------------
  const handleAddStory = () => {
    // TODO: integrate Add Story modal
    console.log("Trigger Add Story Modal");
  };

  // ---------------- Progress bars ----------------
  const renderProgressBars = () => {
    if (!activeStory) return null;
    return (
      <div className="absolute top-2 left-2 right-2 flex gap-1 z-50">
        {activeStory.media.map((media, i) => (
          <div key={i} className="h-1 bg-white/50 rounded flex-1 overflow-hidden">
            <motion.div
              className="h-1 bg-white"
              initial={{ width: i === activeIndex ? 0 : i < activeIndex ? "100%" : 0 }}
              animate={{ width: i === activeIndex ? "100%" : i < activeIndex ? "100%" : 0 }}
              transition={{ duration: media.type === "video" ? 5 : IMAGE_DURATION / 1000, ease: "linear" }}
            />
          </div>
        ))}
      </div>
    );
  };

  // ---------------- Render ----------------
  return (
    <>
      <div className="flex gap-3 overflow-x-auto p-3 scrollbar-hide snap-x">
        {/* --- Add Your Story --- */}
        <motion.div whileTap={{ scale: 0.95 }} className="relative w-20 shrink-0 snap-start cursor-pointer text-center" onClick={handleAddStory} aria-label="Add Your Story">
          <div className="relative">
            <img src={currentUser?.photoURL || defaultAvatar} alt="Your Story" className="w-16 h-16 rounded-full border-2 border-primary-500 object-cover"/>
            <div className="absolute bottom-0 right-0 bg-primary-500 text-white rounded-full p-1"><Plus size={14} /></div>
          </div>
          <p className="text-xs mt-1 text-center truncate">Your Story</p>
        </motion.div>

        {/* --- Other Stories --- */}
        {loading
          ? Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="w-20 shrink-0 snap-start p-2">
              <div className="w-16 h-16 rounded-full bg-gray-300 animate-pulse mx-auto"></div>
              <div className="h-2 mt-1 bg-gray-300 rounded animate-pulse"></div>
            </div>
          ))
          : stories.map(story => {
              const viewed = story.views?.includes(currentUser?.uid);
              return (
                <motion.div key={story.id} whileTap={{ scale: 0.95 }} className="w-20 shrink-0 snap-start cursor-pointer text-center" onClick={() => openStory(story)} aria-label={`View story from ${story.username || "User"}`}>
                  <img src={story.userAvatar || defaultAvatar} alt={story.username || "User"} className={`w-16 h-16 rounded-full border-2 ${viewed ? theme === "dark" ? "border-gray-600" : "border-gray-400" : "border-primary-500"} object-cover`} />
                  <p className="text-xs mt-1 truncate">{story.username || "User"}</p>
                </motion.div>
              );
            })}
      </div>

      {/* --- Fullscreen Story Viewer --- */}
      <AnimatePresence>
        {activeStory && (
          <motion.div
            key="story-modal"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black flex flex-col justify-center items-center"
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
          >
            <button onClick={closeStory} className="absolute top-4 right-4 text-white p-2 rounded-full hover:bg-white/20" aria-label="Close Story"><X size={24}/></button>
            {renderProgressBars()}
            <div className="max-h-[90%] max-w-[95%] flex items-center justify-center relative">
              {activeStory.media[activeIndex].type === "video"
                ? <>
                    <video
                      ref={videoRef}
                      src={activeStory.media[activeIndex].url}
                      className="max-h-full max-w-full object-contain rounded-lg"
                      muted={muted}
                      autoPlay
                      playsInline
                    />
                    <button
                      onClick={() => setMuted(prev => !prev)}
                      className="absolute bottom-3 right-3 p-2 rounded-full bg-black/50 text-white"
                      aria-label={muted ? "Unmute Video" : "Mute Video"}
                    >
                      {muted ? <VolumeX size={18}/> : <Volume2 size={18}/>}
                    </button>
                  </>
                : <img src={activeStory.media[activeIndex].url} alt={`Story ${activeIndex + 1}`} className="max-h-full max-w-full object-contain rounded-lg" />
              }
            </div>
            <div className="absolute inset-0 flex justify-between items-center px-4">
              <div className="flex-1 h-full cursor-pointer" onClick={prevMedia} />
              <div className="flex-1 h-full cursor-pointer" onClick={nextMedia} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

// ---------------- PropTypes ----------------
Stories.propTypes = {
  stories: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string.isRequired,
      userAvatar: PropTypes.string,
      username: PropTypes.string,
      views: PropTypes.arrayOf(PropTypes.string),
      media: PropTypes.arrayOf(
        PropTypes.shape({
          url: PropTypes.string.isRequired,
          type: PropTypes.string.isRequired, // "image" | "video"
        })
      ),
      createdAt: PropTypes.any,
    })
  ),
};