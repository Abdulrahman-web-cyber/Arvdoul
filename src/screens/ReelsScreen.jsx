// src/screens/ReelsScreen.jsx - ARVDOUL REELS (PRODUCTION)
// Full-screen vertical video feed backed by the videos collection and
// videoService (real views, real likes, cursor pagination).
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Heart, MessageCircle, Share2, Volume2, VolumeX, Loader2, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '@context/ThemeContext';
import { getFirestoreInstance } from '../firebase/firebase';
import { collection, query, where, orderBy, limit, startAfter, getDocs, doc as fDoc, getDoc } from 'firebase/firestore';
import videoService from '../services/videoService';

const PAGE_SIZE = 10;

export default function ReelsScreen() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [muted, setMuted] = useState(true);
  const lastDocRef = useRef(null);
  const hasMoreRef = useRef(true);
  const loadingMoreRef = useRef(false);
  const videoRefs = useRef({});
  const viewedRef = useRef(new Set());

  const loadPage = useCallback(async (next = false) => {
    if (loadingMoreRef.current) return;
    loadingMoreRef.current = true;
    if (!next) setLoading(true);
    try {
      const firestore = await getFirestoreInstance();
      const videosRef = collection(firestore, 'videos');
      let q = query(
        videosRef,
        where('isDeleted', '==', false),
        where('visibility', '==', 'public'),
        orderBy('createdAt', 'desc'),
        limit(PAGE_SIZE)
      );
      if (next && lastDocRef.current) q = query(q, startAfter(lastDocRef.current));

      const snap = await getDocs(q);
      if (snap.empty && !next) { setVideos([]); hasMoreRef.current = false; }
      else {
        const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setVideos((prev) => (next ? [...prev, ...items] : items));
        lastDocRef.current = snap.docs[snap.docs.length - 1] || null;
        hasMoreRef.current = snap.docs.length === PAGE_SIZE;
      }
    } catch (err) {
      setError('Could not load reels.');
    } finally {
      loadingMoreRef.current = false;
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadPage(false); }, [loadPage]);

  // Record a real view when a reel becomes active.
  useEffect(() => {
    const video = videos[activeIndex];
    if (!video || !user?.uid || viewedRef.current.has(video.id)) return;
    viewedRef.current.add(video.id);
    videoService.recordVideoView(video.id, { duration: 3 }).catch(() => {});
    // Pause off-screen videos.
    Object.entries(videoRefs.current).forEach(([id, el]) => {
      if (el && id !== video.id) el.pause();
    });
  }, [activeIndex, videos, user?.uid]);

  const handleLike = async (video) => {
    if (!user?.uid) { toast.info('Sign in to like reels.'); return; }
    try {
      const res = await videoService.likeVideo(video.id);
      const liked = res?.data?.liked ?? res?.liked ?? !video.likedByMe;
      setVideos((prev) => prev.map((v) => {
        if (v.id !== video.id) return v;
        const delta = liked ? 1 : -1;
        return { ...v, likedByMe: liked, stats: { ...(v.stats || {}), likes: Math.max(0, (v.stats?.likes || 0) + delta) } };
      }));
    } catch (err) {
      toast.error(err?.message || 'Could not like reel.');
    }
  };

  const handleShare = async (video) => {
    const url = `${typeof window !== 'undefined' ? window.location.origin : ''}/videos?video=${video.id}`;
    try {
      if (navigator.share) await navigator.share({ title: video.title || 'Reel', url });
      else { await navigator.clipboard.writeText(url); toast.success('Link copied!'); }
    } catch (err) { /* canceled */ }
  };

  const handleScroll = (e) => {
    const el = e.currentTarget;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 80 && hasMoreRef.current) loadPage(true);
    const idx = Math.round(el.scrollTop / el.clientHeight);
    if (idx !== activeIndex) setActiveIndex(idx);
  };

  const colors = {
    card: isDark ? 'bg-gray-900/70 border-gray-800' : 'bg-white/90 border-gray-200',
    text: isDark ? 'text-white' : 'text-gray-900',
    secondary: isDark ? 'text-gray-400' : 'text-gray-600',
  };

  return (
    <div className={cnRoot(isDark, colors)}>
      {/* Header */}
      <div className={cnHeader(isDark, colors)}>
        <button onClick={() => navigate(-1)} aria-label="Back" className="p-2 rounded-full hover:bg-white/10 text-white">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-xl font-bold text-white">Reels</h1>
        <div className="w-9" />
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center"><Loader2 className="w-8 h-8 text-violet-500 animate-spin" /></div>
      ) : error ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-4 text-white">
          <p>{error}</p>
          <button onClick={() => loadPage(false)} className="px-5 py-2 rounded-xl bg-white/10">Retry</button>
        </div>
      ) : videos.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-white gap-2">
          <p className="text-lg font-semibold">No reels yet</p>
          <p className="text-sm opacity-70">Create a short video and it will appear here.</p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto snap-y snap-mandatory" onScroll={handleScroll}>
          {videos.map((video, idx) => (
            <div key={video.id} className="h-full snap-start relative flex items-center justify-center bg-black">
              <video
                ref={(el) => { videoRefs.current[video.id] = el; }}
                src={video.playbackUrl || video.mediaUrl || video.url}
                poster={video.thumbnails?.[0] || video.thumbnailUrl || null}
                loop
                muted={muted}
                autoPlay={idx === activeIndex}
                playsInline
                className="max-h-full w-full object-contain"
              />

              {/* Tap toggles playback */}
              <button
                onClick={() => {
                  const el = videoRefs.current[video.id];
                  if (el) { if (el.paused) el.play(); else el.pause(); }
                }}
                aria-label="Play/Pause"
                className="absolute inset-0"
              />

              {/* Mute toggle */}
              <button
                onClick={() => setMuted((m) => !m)}
                aria-label={muted ? 'Unmute' : 'Mute'}
                className="absolute top-4 right-4 p-2.5 rounded-full bg-black/50 text-white backdrop-blur"
              >
                {muted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
              </button>

              {/* Caption */}
              <div className="absolute bottom-6 left-4 right-20 text-white">
                <p className="font-semibold drop-shadow">{video.displayName || video.userName || 'Creator'}</p>
                {video.title && <p className="text-sm opacity-90 drop-shadow line-clamp-2">{video.title}</p>}
              </div>

              {/* Action rail */}
              <div className="absolute bottom-6 right-3 flex flex-col items-center gap-5">
                <button onClick={() => handleLike(video)} aria-label="Like" className="flex flex-col items-center gap-1 text-white">
                  <Heart className={`w-8 h-8 drop-shadow ${video.likedByMe ? 'fill-red-500 text-red-500' : ''}`} />
                  <span className="text-xs font-semibold">{video.stats?.likes || 0}</span>
                </button>
                <button onClick={() => handleShare(video)} aria-label="Share" className="flex flex-col items-center gap-1 text-white">
                  <Share2 className="w-8 h-8 drop-shadow" />
                  <span className="text-xs font-semibold">{video.stats?.shares || 0}</span>
                </button>
                <div className="flex flex-col items-center gap-1 text-white">
                  <MessageCircle className="w-8 h-8 drop-shadow" />
                  <span className="text-xs font-semibold">{video.stats?.comments || 0}</span>
                </div>
              </div>

              {/* Progress indicator */}
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/20">
                <motion.div
                  className="h-full bg-violet-500"
                  animate={{ width: idx === activeIndex ? '100%' : '0%' }}
                  transition={{ duration: 30, ease: 'linear' }}
                  key={`${video.id}-${idx === activeIndex}`}
                />
              </div>
            </div>
          ))}
          {hasMoreRef.current && (
            <div className="flex justify-center py-6"><Loader2 className="w-6 h-6 text-violet-500 animate-spin" /></div>
          )}
        </div>
      )}
    </div>
  );
}

function cnRoot(isDark, colors) {
  return `h-screen w-full flex flex-col overflow-hidden ${isDark ? 'bg-black' : 'bg-gray-950'}`;
}
function cnHeader(isDark, colors) {
  return `sticky top-0 z-30 flex items-center justify-between px-4 py-3 backdrop-blur-xl bg-black/70 border-b border-white/10`;
}
