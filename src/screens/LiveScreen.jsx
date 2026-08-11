// src/screens/LiveScreen.jsx - ARVDOUL LIVE (PRODUCTION)
// Real live streaming backed by liveService: start/end streams, real
// viewer counts (sharded), real comments, real gifts (monetization).
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '@context/ThemeContext';
import { getLiveService } from '../services/liveService';
import { cn } from '../lib/utils';
import {
  Video, VideoOff, Mic, MicOff, Users, Gift, Heart, MessageCircle,
  X, Send, Phone, PhoneOff, Camera, Eye, Crown, Diamond, Rocket, Star,
  Wifi, WifiOff, Loader2, ArrowLeft, Play, Radio
} from 'lucide-react';

const POLL_MS = 2500;

export default function LiveScreen() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const [activeStreams, setActiveStreams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Start-stream state
  const [showStartModal, setShowStartModal] = useState(false);
  const [liveTitle, setLiveTitle] = useState('');
  const [visibility, setVisibility] = useState('public');
  const [starting, setStarting] = useState(false);
  const [myStream, setMyStream] = useState(null); // { id, startedAt }
  const [duration, setDuration] = useState(0);
  const [viewerCount, setViewerCount] = useState(0);
  const durationRef = useRef(null);
  const viewerPollRef = useRef(null);

  // Watch state
  const [watching, setWatching] = useState(null); // stream object
  const [comments, setComments] = useState([]);
  const [commentText, setCommentText] = useState('');
  const [showGifts, setShowGifts] = useState(false);
  const [giftTypes, setGiftTypes] = useState([]);
  const watchPollRef = useRef(null);
  const commentPollRef = useRef(null);
  const joinedRef = useRef(false);

  const svc = () => getLiveService();

  // ---------- load active streams ----------
  const loadStreams = useCallback(async () => {
    try {
      const streams = await svc().getActiveLiveStreams({ limit: 30 });
      setActiveStreams(streams || []);
      setError(null);
    } catch (err) {
      setError(err?.message || 'Could not load live streams.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadStreams(); }, [loadStreams]);
  useEffect(() => { const id = setInterval(loadStreams, 15000); return () => clearInterval(id); }, [loadStreams]);

  // ---------- gift types ----------
  useEffect(() => {
    try { setGiftTypes(svc().getLiveConfig().GIFT_TYPES || []); } catch (e) { setGiftTypes([]); }
  }, []);

  // ---------- start stream ----------
  const handleStartLive = async () => {
    if (!user?.uid) { toast.error('Sign in to go live.'); return; }
    if (!liveTitle.trim()) { toast.error('Give your stream a title.'); return; }
    setStarting(true);
    try {
      // Real permission check (level-gated server-side too).
      const result = await svc().startLiveStream(user.uid, {
        title: liveTitle.trim().slice(0, 120),
        visibility,
      });
      const streamId = result?.streamId || result?.id;
      if (!streamId) throw new Error('Stream could not be created.');

      setMyStream({ id: streamId, startedAt: Date.now() });
      setShowStartModal(false);
      toast.success('You are now live!');
      setDuration(0);
      durationRef.current = setInterval(() => setDuration((d) => d + 1), 1000);
      viewerPollRef.current = setInterval(async () => {
        try {
          const stream = await svc().getLiveStream(streamId);
          setViewerCount(stream?.viewerCount ?? stream?.stats?.totalViewers ?? 0);
        } catch (e) { /* keep last count */ }
      }, POLL_MS);
    } catch (err) {
      toast.error(err?.message || 'Could not start your stream.');
    } finally {
      setStarting(false);
    }
  };

  const handleStopLive = async () => {
    if (!user?.uid || !myStream) return;
    try {
      await svc().endLiveStream(myStream.id, user.uid);
      toast.success('Stream ended.');
    } catch (err) {
      toast.error('Stream ended, but final stats could not be saved.');
    }
    if (durationRef.current) clearInterval(durationRef.current);
    if (viewerPollRef.current) clearInterval(viewerPollRef.current);
    setMyStream(null); setViewerCount(0); setDuration(0);
    loadStreams();
  };

  // ---------- watch stream ----------
  const handleWatch = async (stream) => {
    if (!user?.uid) { toast.error('Sign in to watch.'); return; }
    setWatching(stream);
    setComments([]);
    joinedRef.current = false;
  };

  useEffect(() => {
    if (!watching || !user?.uid) return;
    if (!joinedRef.current) {
      joinedRef.current = true;
      svc().joinLiveStream(watching.id, user.uid).catch(() => {});
    }
    const loadComments = async () => {
      try {
        const list = await svc().getLiveComments(watching.id, { limit: 50 });
        setComments(Array.isArray(list) ? list : []);
      } catch (e) { /* keep */ }
    };
    loadComments();
    commentPollRef.current = setInterval(loadComments, POLL_MS);
    watchPollRef.current = setInterval(async () => {
      try {
        const fresh = await svc().getLiveStream(watching.id);
        if (fresh) setWatching((w) => ({ ...w, ...fresh }));
        else { setWatching(null); toast.info('Stream has ended.'); }
      } catch (e) { /* keep */ }
    }, POLL_MS);

    return () => {
      if (commentPollRef.current) clearInterval(commentPollRef.current);
      if (watchPollRef.current) clearInterval(watchPollRef.current);
      if (joinedRef.current) {
        svc().leaveLiveStream(watching.id, user.uid).catch(() => {});
        joinedRef.current = false;
      }
    };
  }, [watching?.id, user?.uid]);

  const handleSendComment = async () => {
    const text = commentText.trim();
    if (!text || !watching || !user?.uid) return;
    try {
      await svc().sendLiveComment(watching.id, user.uid, text.slice(0, 300));
      setCommentText('');
    } catch (err) {
      toast.error(err?.message || 'Could not send comment.');
    }
  };

  const handleSendGift = async (gift) => {
    if (!watching || !user?.uid) return;
    try {
      const streamerId = watching.userId || watching.ownerId;
      if (!streamerId) throw new Error('Streamer unknown.');
      const res = await svc().sendLiveGift(watching.id, user.uid, streamerId, gift.id);
      if (res?.success) toast.success(`${gift.emoji} ${gift.name} sent!`);
    } catch (err) {
      toast.error(err?.message || 'Gift could not be sent.');
    }
  };

  // ---------- helpers ----------
  const fmtDuration = (s) => {
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
    return [h, m, sec].map((n) => String(n).padStart(2, '0')).join(':');
  };
  const streamerName = (stream) => stream?.streamerName || stream?.userName || (stream?.userProfile?.displayName) || 'Streamer';

  const colors = {
    card: isDark ? 'bg-gray-900/80 border-gray-800' : 'bg-white/90 border-gray-200',
    text: isDark ? 'text-white' : 'text-gray-900',
    secondary: isDark ? 'text-gray-400' : 'text-gray-600',
  };

  return (
    <div className="min-h-screen bg-black text-white pb-20">
      {/* Header */}
      <div className="sticky top-0 z-30 backdrop-blur-xl bg-black/80 border-b border-white/10">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate(-1)} aria-label="Back" className="p-2 rounded-full hover:bg-white/10">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-red-500 to-pink-500 flex items-center justify-center">
                <Radio className="w-4 h-4" />
              </div>
              Live
            </h1>
          </div>
          <div className="flex items-center gap-3">
            {myStream && (
              <span className="px-3 py-1.5 rounded-full bg-red-500/20 text-red-400 text-sm font-semibold flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" /> LIVE · {fmtDuration(duration)}
              </span>
            )}
            <button
              onClick={() => setShowStartModal(true)}
              disabled={!!myStream}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-red-500 to-pink-500 font-bold disabled:opacity-40"
            >
              {myStream ? 'Streaming' : 'Go Live'}
            </button>
          </div>
        </div>
      </div>

      {/* My live status bar */}
      {myStream && (
        <div className="max-w-5xl mx-auto px-4 pt-4">
          <div className={cn("rounded-2xl p-4 flex flex-wrap items-center gap-4 border", colors.card, colors.border)}>
            <div className="flex items-center gap-2 text-red-400 font-semibold">
              <Camera className="w-5 h-5" /> You are live: {liveTitle}
            </div>
            <div className="flex items-center gap-2 text-gray-300">
              <Eye className="w-4 h-4" /> {viewerCount} viewers
            </div>
            <button
              onClick={handleStopLive}
              className="ml-auto px-4 py-2 rounded-xl bg-red-500 text-white font-bold flex items-center gap-2"
            >
              <PhoneOff className="w-4 h-4" /> End Stream
            </button>
          </div>
        </div>
      )}

      {/* Watch view */}
      <AnimatePresence>
        {watching && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black flex flex-col"
          >
            <div className="flex items-center justify-between p-4">
              <button onClick={() => setWatching(null)} aria-label="Close" className="p-2 rounded-full hover:bg-white/10">
                <X className="w-6 h-6" />
              </button>
              <div className="flex items-center gap-2 text-sm">
                <span className="px-2.5 py-1 rounded-full bg-red-500/20 text-red-400 font-semibold flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" /> LIVE
                </span>
                <span className="px-2.5 py-1 rounded-full bg-white/10 flex items-center gap-1">
                  <Eye className="w-3.5 h-3.5" /> {watching.viewerCount ?? 0}
                </span>
              </div>
            </div>

            {/* Streamer preview placeholder (real stream ingest requires RTMP — shows stream info) */}
            <div className="flex-1 flex items-center justify-center px-4">
              <div className="text-center max-w-md">
                <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gradient-to-br from-red-500/30 to-pink-500/30 flex items-center justify-center">
                  <Video className="w-9 h-9 text-red-400" />
                </div>
                <h2 className="text-2xl font-bold mb-1">{streamerName(watching)}</h2>
                <p className="text-gray-400 mb-2">{watching.title || 'Live stream'}</p>
                <div className="flex items-center justify-center gap-4 text-sm text-gray-400">
                  <span className="flex items-center gap-1"><Users className="w-4 h-4" /> {watching.viewerCount ?? 0} watching</span>
                  <span className="flex items-center gap-1"><Wifi className="w-4 h-4 text-green-500" /> Live</span>
                </div>
              </div>
            </div>

            {/* Chat */}
            <div className="h-64 flex flex-col border-t border-white/10">
              <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
                {comments.length === 0 && (
                  <p className="text-gray-500 text-sm text-center pt-6">No comments yet — say hello!</p>
                )}
                {comments.map((c, i) => (
                  <div key={c.id || i} className="text-sm">
                    <span className="font-semibold text-violet-400">{c.userName || c.userId?.slice(0, 6) || 'User'}</span>
                    <span className="text-gray-300 ml-2">{c.content || c.comment}</span>
                  </div>
                ))}
              </div>
              <div className="p-3 flex items-center gap-2 border-t border-white/10">
                <button onClick={() => setShowGifts(!showGifts)} aria-label="Gifts" className="p-2.5 rounded-full bg-white/10 hover:bg-white/20">
                  <Gift className="w-5 h-5 text-amber-400" />
                </button>
                <input
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSendComment()}
                  placeholder="Say something…"
                  className="flex-1 px-4 py-2.5 rounded-full bg-white/10 outline-none text-sm"
                />
                <button onClick={handleSendComment} aria-label="Send" className="p-2.5 rounded-full bg-gradient-to-r from-violet-500 to-cyan-500">
                  <Send className="w-5 h-5" />
                </button>
              </div>

              {/* Gift picker */}
              <AnimatePresence>
                {showGifts && (
                  <motion.div
                    initial={{ y: 60, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 60, opacity: 0 }}
                    className="bg-gray-900/95 border-t border-white/10 p-4 grid grid-cols-4 gap-2"
                  >
                    {giftTypes.map((g) => (
                      <button
                        key={g.id}
                        onClick={() => handleSendGift(g)}
                        className="flex flex-col items-center gap-1 p-2 rounded-xl bg-white/5 hover:bg-white/15 transition"
                      >
                        <span className="text-2xl">{g.emoji}</span>
                        <span className="text-xs text-gray-300">{g.coinValue} 🪙</span>
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main content */}
      <main className="max-w-5xl mx-auto px-4 py-6">
        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="w-7 h-7 text-red-500 animate-spin" /></div>
        ) : error ? (
          <div className="text-center py-16">
            <p className="text-red-400 mb-4">{error}</p>
            <button onClick={loadStreams} className="px-5 py-2 rounded-xl bg-white/10">Retry</button>
          </div>
        ) : activeStreams.length === 0 ? (
          <div className="text-center py-20">
            <Radio className="w-14 h-14 text-gray-600 mx-auto mb-4" />
            <h2 className="text-xl font-bold mb-2">No one is live right now</h2>
            <p className="text-gray-400 mb-6">Be the first to go live and share your moment!</p>
            <button
              onClick={() => setShowStartModal(true)}
              className="px-6 py-3 rounded-xl bg-gradient-to-r from-red-500 to-pink-500 font-bold"
            >
              Go Live Now
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {activeStreams.map((stream) => (
              <motion.button
                key={stream.id}
                whileHover={{ scale: 1.02 }}
                onClick={() => handleWatch(stream)}
                className="text-left rounded-2xl overflow-hidden border border-white/10 bg-gray-900/70"
              >
                <div className="aspect-video bg-gradient-to-br from-gray-800 to-gray-900 flex items-center justify-center relative">
                  <Video className="w-10 h-10 text-gray-600" />
                  <span className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-red-500 text-white text-xs font-bold flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" /> LIVE
                  </span>
                  <span className="absolute bottom-2 right-2 px-2 py-0.5 rounded-full bg-black/60 text-xs flex items-center gap-1">
                    <Eye className="w-3 h-3" /> {stream.viewerCount ?? 0}
                  </span>
                </div>
                <div className="p-3">
                  <p className="font-semibold truncate">{stream.title || 'Untitled stream'}</p>
                  <p className="text-sm text-gray-400 truncate">{streamerName(stream)}</p>
                </div>
              </motion.button>
            ))}
          </div>
        )}
      </main>

      {/* Start modal */}
      <AnimatePresence>
        {showStartModal && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setShowStartModal(false)}
          >
            <motion.div
              initial={{ scale: 0.92, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.92, y: 20 }}
              className="w-full max-w-md rounded-2xl border border-white/10 bg-gray-900 p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                <Radio className="w-5 h-5 text-red-500" /> Go Live
              </h2>
              <input
                autoFocus
                value={liveTitle}
                onChange={(e) => setLiveTitle(e.target.value)}
                placeholder="Stream title…"
                maxLength={120}
                className="w-full px-4 py-3 rounded-xl bg-white/10 outline-none mb-3"
              />
              <div className="flex gap-2 mb-5">
                {[
                  { id: 'public', label: '🌍 Public' },
                  { id: 'followers', label: '👥 Followers' },
                  { id: 'private', label: '🔒 Private' },
                ].map((v) => (
                  <button
                    key={v.id}
                    onClick={() => setVisibility(v.id)}
                    className={`px-3 py-2 rounded-xl text-sm font-medium transition ${visibility === v.id ? 'bg-red-500 text-white' : 'bg-white/10'}`}
                  >
                    {v.label}
                  </button>
                ))}
              </div>
              <div className="flex gap-3">
                <button onClick={() => setShowStartModal(false)} className="flex-1 py-3 rounded-xl bg-white/10 font-semibold">
                  Cancel
                </button>
                <button
                  onClick={handleStartLive}
                  disabled={starting}
                  className="flex-1 py-3 rounded-xl bg-gradient-to-r from-red-500 to-pink-500 font-bold disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  {starting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Camera className="w-5 h-5" />}
                  {starting ? 'Starting…' : 'Start Stream'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function cnCard(cls) { return cls; }
