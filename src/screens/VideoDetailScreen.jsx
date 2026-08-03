// src/screens/VideoDetailScreen.jsx - ARVDOUL VIDEO DETAIL (PRODUCTION)
// Loads a single video by id (or url param), plays it, shows creator info,
// engagement rail (like/comment/share), and a comments sheet.
// Route: /video/:videoId  (wired from SearchScreen + deep links).
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { useTheme } from '@context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { getFirestoreInstance } from '../firebase/firebase';
import { doc, getDoc } from 'firebase/firestore';
import videoService from '../services/videoService';
import VideoCreatorInfo from '../components/Videos/VideoCreatorInfo';
import VideoActionRail from '../components/Videos/VideoActionRail';
import VideoComments from '../components/Videos/VideoComments';
import { cn } from '../lib/utils';
import { ArrowLeft, Volume2, VolumeX, Loader2, Play, Pause } from 'lucide-react';

export default function VideoDetailScreen() {
  const { videoId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const [video, setVideo] = useState(null);
  const [creator, setCreator] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const [muted, setMuted] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const viewedRef = useRef(false);

  // ---------- Load video + creator ----------
  useEffect(() => {
    const urlParam = searchParams.get('url');
    (async () => {
      setLoading(true);
      try {
        let data = null;
        if (videoId) {
          const firestore = await getFirestoreInstance();
          const snap = await getDoc(doc(firestore, 'videos', videoId));
          if (snap.exists()) data = { id: snap.id, ...snap.data() };
        }
        if (!data && urlParam) {
          data = { id: videoId || 'external', url: urlParam, title: 'Video', userId: null };
        }
        if (!data) throw new Error('Video not found');
        setVideo(data);
        setLikeCount(data.stats?.likes || 0);
        setLiked(data.likedBy?.includes(user?.uid) || false);

        // Fetch creator profile if we have a userId
        if (data.userId) {
          try {
            const { getUserService } = await import('../services/userService.js');
            const profile = await getUserService().getUserProfile(data.userId);
            if (profile) {
              setCreator({
                id: profile.id || data.userId,
                name: profile.displayName || profile.username,
                username: profile.username,
                avatar: profile.photoURL,
                isVerified: profile.isVerified,
                bio: profile.bio,
              });
            }
          } catch (e) { /* creator optional */ }
        }

        // Record a real view once
        if (!viewedRef.current && user?.uid) {
          viewedRef.current = true;
          videoService.recordVideoView(data.id, { duration: 3 }).catch(() => {});
        }
      } catch (err) {
        setError(err?.message || 'Could not load this video.');
      } finally {
        setLoading(false);
      }
    })();
  }, [videoId, searchParams, user?.uid]);

  // ---------- Like ----------
  const handleLike = async () => {
    if (!user?.uid) { toast.info('Sign in to like videos.'); return; }
    try {
      const res = await videoService.likeVideo(video.id);
      const nowLiked = res?.data?.liked ?? !liked;
      setLiked(nowLiked);
      setLikeCount((c) => Math.max(0, c + (nowLiked ? 1 : -1)));
    } catch (err) {
      toast.error(err?.message || 'Could not like video.');
    }
  };

  const handleShare = async () => {
    const url = `${typeof window !== 'undefined' ? window.location.origin : ''}/video/${video.id}`;
    try {
      if (navigator.share) await navigator.share({ title: video.title || 'Video', url });
      else { await navigator.clipboard.writeText(url); toast.success('Link copied!'); }
    } catch (err) { /* canceled */ }
  };

  const togglePlay = () => {
    const el = videoRef.current;
    if (!el) return;
    if (el.paused) { el.play(); setIsPlaying(true); } else { el.pause(); setIsPlaying(false); }
  };

  const videoRef = useRef(null);

  const colors = {
    bg: isDark ? 'bg-gradient-to-br from-[#060816] via-[#0b1220] to-[#02040a]' : 'bg-gradient-to-br from-[#f0f4fa] via-white to-[#eef2f8]',
    card: isDark ? 'bg-gray-900/70 border-gray-800' : 'bg-white/90 border-gray-200',
    text: isDark ? 'text-white' : 'text-gray-900',
    secondary: isDark ? 'text-gray-400' : 'text-gray-600',
  };

  return (
    <div className={cn('min-h-screen pb-16', colors.bg)}>
      {/* Header */}
      <div className={cn('sticky top-0 z-30 border-b backdrop-blur-xl', colors.card, 'border')}>
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-3">
          <button onClick={() => navigate(-1)} aria-label="Back" className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className={cn('font-bold truncate', colors.text)}>{video?.title || 'Video'}</h1>
        </div>
      </div>

      <main className="max-w-4xl mx-auto px-4 py-5">
        {loading ? (
          <div className="flex justify-center py-24"><Loader2 className="w-8 h-8 text-violet-500 animate-spin" /></div>
        ) : error ? (
          <div className="text-center py-24">
            <p className={cn('font-semibold mb-4', colors.text)}>{error}</p>
            <button onClick={() => navigate('/videos')} className="px-5 py-2 rounded-xl bg-violet-500 text-white font-semibold">Browse Videos</button>
          </div>
        ) : (
          <div className="space-y-5">
            {/* Player */}
            <div className={cn('relative rounded-2xl overflow-hidden border aspect-video bg-black', colors.card)}>
              <video
                ref={videoRef}
                src={video.playbackUrl || video.url || video.mediaUrl}
                poster={video.thumbnails?.[0] || video.thumbnailUrl || null}
                autoPlay
                loop
                muted={muted}
                playsInline
                className="w-full h-full object-contain"
              />
              {/* Tap to play/pause */}
              <button onClick={togglePlay} aria-label={isPlaying ? 'Pause' : 'Play'} className="absolute inset-0">
                {!isPlaying && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-16 h-16 rounded-full bg-black/50 backdrop-blur flex items-center justify-center">
                      <Play className="w-8 h-8 text-white ml-1" />
                    </div>
                  </div>
                )}
              </button>
              {/* Mute */}
              <button
                onClick={() => setMuted((m) => !m)}
                aria-label={muted ? 'Unmute' : 'Mute'}
                className="absolute top-3 right-3 p-2 rounded-full bg-black/50 backdrop-blur text-white"
              >
                {muted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
              </button>
            </div>

            {/* Creator */}
            {creator && (
              <VideoCreatorInfo
                creator={creator}
                onProfileClick={() => navigate(`/profile/${creator.id}`)}
                theme={theme}
              />
            )}

            {/* Title + stats + analytics (owner) */}
            <div className={cn('rounded-2xl p-4 border', colors.card)}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className={cn('font-bold text-lg', colors.text)}>{video.title || 'Untitled'}</h2>
                  <p className={cn('text-sm mt-1', colors.secondary)}>
                    {(video.stats?.views || 0).toLocaleString()} views · {video.category || 'video'}
                  </p>
                </div>
                {user?.uid && video.userId === user.uid && (
                  <button
                    onClick={() => navigate('/video-analytics')}
                    className={cn(
                      'shrink-0 px-3 py-2 rounded-xl text-xs font-semibold transition',
                      'bg-gradient-to-r from-violet-500 to-cyan-500 text-white hover:opacity-90'
                    )}
                  >
                    Analytics
                  </button>
                )}
              </div>
            </div>

            {/* Engagement rail */}
            <div className={cn('rounded-2xl p-4 border flex items-center justify-around', colors.card)}>
              <VideoActionRail
                video={video}
                onLike={handleLike}
                onComment={() => setShowComments(true)}
                onShare={handleShare}
                theme={theme}
              />
            </div>

            {/* Comments sheet */}
            <VideoComments
              isOpen={showComments}
              onClose={() => setShowComments(false)}
              video={video}
              theme={theme}
            />
          </div>
        )}
      </main>
    </div>
  );
}
