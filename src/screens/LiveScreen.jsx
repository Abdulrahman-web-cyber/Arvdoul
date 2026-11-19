// src/screens/LiveScreen.jsx
//
// Real live streaming backed by liveService + Express /ws WebRTC signaling:
// broadcaster camera/mic acquisition, P2P viewer video/audio playback,
// live sharded viewer counts, real-time comments, and coin gifts.

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '@context/ThemeContext';
import { getLiveService } from '../services/liveService';
import { createRealtimeRoomClient } from '../services/realtimeRoomClient';
import { useEscapeClose } from '../hooks/useEscapeClose';
import {
  Video,
  VideoOff,
  Mic,
  MicOff,
  Users,
  Gift,
  X,
  Send,
  PhoneOff,
  Camera,
  Eye,
  Wifi,
  Loader2,
  ArrowLeft,
  Radio,
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
  useEscapeClose(showStartModal, () => setShowStartModal(false));
  const [liveTitle, setLiveTitle] = useState('');
  const [visibility, setVisibility] = useState('public');
  const [starting, setStarting] = useState(false);
  const [myStream, setMyStream] = useState(null); // { id, startedAt }
  const myStreamRef = useRef(null);
  useEffect(() => { myStreamRef.current = myStream; }, [myStream]);
  const [duration, setDuration] = useState(0);
  const [viewerCount, setViewerCount] = useState(null);
  const durationRef = useRef(null);
  const viewerPollRef = useRef(null);

  // Broadcaster local WebRTC media state
  const [localMediaStream, setLocalMediaStream] = useState(null);
  const localMediaRef = useRef(null);
  const localVideoRef = useRef(null);
  const [isMicMuted, setIsMicMuted] = useState(false);
  const [isCamOff, setIsCamOff] = useState(false);

  // Watch state
  const [watching, setWatching] = useState(null); // stream object
  const [watchViewers, setWatchViewers] = useState(null);
  const [comments, setComments] = useState([]);
  const [commentText, setCommentText] = useState('');
  const [showGifts, setShowGifts] = useState(false);
  const [giftTypes, setGiftTypes] = useState([]);
  const [remoteVideoReady, setRemoteVideoReady] = useState(false);
  const remoteVideoRef = useRef(null);
  const watchPollRef = useRef(null);
  const commentPollRef = useRef(null);
  const joinedRef = useRef(false);
  const roomClientRef = useRef(null);

  const svc = () => getLiveService();

  const loadStreams = useCallback(async () => {
    try {
      const streams = await svc().getActiveLiveStreams({ limit: 30, viewerId: user?.uid });
      setActiveStreams(streams || []);
      setError(null);
    } catch (err) {
      setError(err?.message || 'Could not load live streams.');
    } finally {
      setLoading(false);
    }
  }, [user?.uid]);

  useEffect(() => { loadStreams(); }, [loadStreams]);
  useEffect(() => {
    const id = setInterval(() => {
      if (typeof document !== 'undefined' && document.hidden) return;
      loadStreams();
    }, 30000);
    return () => clearInterval(id);
  }, [loadStreams]);

  useEffect(() => {
    try {
      setGiftTypes(svc().getLiveConfig().GIFT_TYPES || []);
    } catch (e) {
      console.warn('LiveScreen: failed to load gift types', e);
      setGiftTypes([]);
    }
  }, []);

  // Attach local broadcast video feed to preview element when active
  useEffect(() => {
    if (localVideoRef.current && localMediaStream) {
      localVideoRef.current.srcObject = localMediaStream;
    }
  }, [localMediaStream, myStream]);

  const stopLocalMedia = useCallback(() => {
    if (localMediaRef.current) {
      localMediaRef.current.getTracks().forEach((t) => t.stop());
      localMediaRef.current = null;
    }
    setLocalMediaStream(null);
    if (roomClientRef.current) {
      roomClientRef.current.leaveRoom();
      roomClientRef.current = null;
    }
  }, []);

  const handleStartLive = async () => {
    if (!user?.uid) { toast.error('Sign in to go live.'); return; }
    if (!liveTitle.trim()) { toast.error('Give your stream a title.'); return; }
    setStarting(true);
    try {
      // Acquire camera + microphone before going live (falls back to audio-only if video unavailable)
      let capturedStream = null;
      if (navigator.mediaDevices?.getUserMedia) {
        try {
          capturedStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        } catch {
          try {
            capturedStream = await navigator.mediaDevices.getUserMedia({ audio: true });
            setIsCamOff(true);
          } catch {
            toast.warning('Camera/microphone denied — starting metadata-only stream.');
          }
        }
      }

      const result = await svc().startLiveStream(user.uid, {
        title: liveTitle.trim().slice(0, 120),
        visibility,
      });
      const streamId = result?.stream?.id || result?.streamId || result?.id;
      if (!streamId) {
        capturedStream?.getTracks().forEach((t) => t.stop());
        throw new Error('Stream could not be created.');
      }

      localMediaRef.current = capturedStream;
      setLocalMediaStream(capturedStream);
      setIsMicMuted(false);

      const client = createRealtimeRoomClient();
      roomClientRef.current = client;
      client.joinRoom(`live:${streamId}`, {
        userId: user.uid,
        displayName: user.displayName || user.username || 'Host',
        role: 'broadcaster',
        stream: capturedStream,
      });

      setMyStream({ id: streamId, startedAt: Date.now() });
      setShowStartModal(false);
      toast.success('You are now live');
      setDuration(0);
      durationRef.current = setInterval(() => setDuration((d) => d + 1), 1000);
      viewerPollRef.current = setInterval(async () => {
        if (typeof document !== 'undefined' && document.hidden) return;
        try {
          const stream = await svc().getLiveStream(streamId);
          setViewerCount(stream?.viewerCount ?? stream?.stats?.totalViewers ?? null);
        } catch (e) {
          console.warn('[Live] viewer poll failed; keeping last count', e?.message);
        }
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
    } catch {
      toast.error('Stream ended, but final stats could not be saved.');
    }
    if (durationRef.current) clearInterval(durationRef.current);
    if (viewerPollRef.current) clearInterval(viewerPollRef.current);
    stopLocalMedia();
    setMyStream(null);
    setViewerCount(0);
    setDuration(0);
    loadStreams();
  };

  const handleToggleMic = () => {
    if (!localMediaRef.current) return;
    const nextMuted = !isMicMuted;
    localMediaRef.current.getAudioTracks().forEach((t) => { t.enabled = !nextMuted; });
    setIsMicMuted(nextMuted);
  };

  const handleToggleCam = () => {
    if (!localMediaRef.current) return;
    const nextOff = !isCamOff;
    localMediaRef.current.getVideoTracks().forEach((t) => { t.enabled = !nextOff; });
    setIsCamOff(nextOff);
  };

  // Unmount while LIVE: stop the stream server-side and clear timers + tracks
  useEffect(() => {
    return () => {
      if (durationRef.current) clearInterval(durationRef.current);
      if (viewerPollRef.current) clearInterval(viewerPollRef.current);
      if (localMediaRef.current) {
        localMediaRef.current.getTracks().forEach((t) => t.stop());
      }
      if (roomClientRef.current) {
        roomClientRef.current.leaveRoom();
      }
      if (myStreamRef.current && user?.uid) {
        svc().endLiveStream(myStreamRef.current.id, user.uid).catch((e) => {
          console.warn('[Live] end-stream on unmount failed', e?.message);
        });
      }
    };
  }, [user?.uid]);

  const handleWatch = async (stream) => {
    if (!user?.uid) { toast.error('Sign in to watch.'); return; }
    setWatching(stream);
    setWatchViewers(stream?.viewerCount ?? stream?.stats?.totalViewers ?? null);
    setComments([]);
    setRemoteVideoReady(false);
    joinedRef.current = false;
  };

  useEffect(() => {
    if (!watching || !user?.uid) return undefined;
    if (!joinedRef.current) {
      joinedRef.current = true;
      svc().joinLiveStream(watching.id, user.uid).catch((e) => {
        console.warn('[Live] join-stream failed; viewer may not be counted', e?.message);
      });
    }

    // Subscribe to WebSocket room for P2P video/audio + instant live comments
    const watchClient = createRealtimeRoomClient();
    const unsubWs = watchClient.subscribe((ev) => {
      if (ev.type === 'remote-stream' && ev.stream) {
        setRemoteVideoReady(true);
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = ev.stream;
          remoteVideoRef.current.play?.().catch(() => {});
        }
      } else if (ev.type === 'live-comment' && ev.comment) {
        setComments((prev) => [...prev.slice(-49), ev.comment]);
      }
    });
    watchClient.joinRoom(`live:${watching.id}`, {
      userId: user.uid,
      displayName: user.displayName || user.username || 'Viewer',
      role: 'viewer',
    });

    const loadComments = async () => {
      try {
        const list = await svc().getLiveComments(watching.id, { limit: 50, viewerId: user.uid });
        setComments(Array.isArray(list) ? list : []);
      } catch (e) {
        console.warn('[Live] comment poll failed; keeping last list', e?.message);
      }
    };
    loadComments();
    commentPollRef.current = setInterval(() => {
      if (typeof document !== 'undefined' && document.hidden) return;
      loadComments();
    }, POLL_MS);
    watchPollRef.current = setInterval(async () => {
      if (typeof document !== 'undefined' && document.hidden) return;
      try {
        const fresh = await svc().getLiveStream(watching.id);
        if (fresh) {
          setWatching((w) => ({ ...w, ...fresh }));
          setWatchViewers(fresh.viewerCount ?? fresh.stats?.totalViewers ?? null);
        } else {
          setWatching(null);
          toast.info('Stream has ended.');
        }
      } catch (e) {
        console.warn('[Live] stream poll failed; keeping last state', e?.message);
      }
    }, POLL_MS);

    return () => {
      unsubWs();
      watchClient.leaveRoom();
      if (commentPollRef.current) clearInterval(commentPollRef.current);
      if (watchPollRef.current) clearInterval(watchPollRef.current);
      if (joinedRef.current) {
        svc().leaveLiveStream(watching.id, user.uid).catch((e) => {
          console.warn('[Live] leave-stream failed; viewer count may linger', e?.message);
        });
        joinedRef.current = false;
      }
    };
  }, [watching?.id, user?.uid, user?.displayName, user?.username]);

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

  const fmtDuration = (s) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return [h, m, sec].map((n) => String(n).padStart(2, '0')).join(':');
  };

  const streamerName = (stream) =>
    stream?.streamerName || stream?.userName || stream?.userProfile?.displayName || stream?.userId?.slice(0, 6) || '';

  return (
    <div className={isDark ? 'min-h-screen bg-[#03071B] text-white pb-20' : 'min-h-screen bg-[#F6F8FC] text-slate-900 pb-20'}>
      {/* Header */}
      <div className={isDark ? 'sticky top-0 z-30 backdrop-blur-xl bg-[#03071B]/90 border-b border-white/10' : 'sticky top-0 z-30 backdrop-blur-xl bg-white/90 border-b border-slate-200'}>
        <div className="max-w-5xl mx-auto px-4 py-3.5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => navigate(-1)} aria-label="Back" className="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10 cursor-pointer">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="text-xl font-bold flex items-center gap-2 font-display">
              <Radio className="w-5 h-5 text-rose-500" />
              Live Broadcasts
            </h1>
          </div>
          <div className="flex items-center gap-3">
            {myStream && (
              <span className="px-3 py-1 rounded-full bg-rose-500/15 text-rose-500 text-xs font-semibold flex items-center gap-1.5 tabular-nums">
                <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" /> LIVE · {fmtDuration(duration)}
              </span>
            )}
            <button
              type="button"
              onClick={() => setShowStartModal(true)}
              disabled={Boolean(myStream)}
              className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-sm font-semibold disabled:opacity-40 cursor-pointer whitespace-nowrap shrink-0"
            >
              {myStream ? 'Streaming' : 'Go Live'}
            </button>
          </div>
        </div>
      </div>

      {/* Broadcaster Live Studio Preview */}
      {myStream && (
        <div className="max-w-5xl mx-auto px-4 pt-4">
          <div className="rounded-2xl overflow-hidden border border-rose-500/30 bg-[#080F2E] text-white">
            <div className="aspect-video max-h-[360px] w-full bg-black relative flex items-center justify-center">
              {localMediaStream ? (
                <video
                  ref={localVideoRef}
                  autoPlay
                  muted
                  playsInline
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="text-center text-slate-400 text-sm">
                  <Camera className="w-8 h-8 mx-auto mb-2 opacity-60" />
                  Live broadcast session active (audio/video capture disabled)
                </div>
              )}
              <div className="absolute top-3 left-3 px-2.5 py-1 rounded-md bg-rose-600 text-white text-xs font-semibold tabular-nums">
                LIVE · {fmtDuration(duration)}
              </div>
              <div className="absolute top-3 right-3 px-2.5 py-1 rounded-md bg-black/70 text-white text-xs font-medium flex items-center gap-1.5 tabular-nums">
                <Eye className="w-3.5 h-3.5" /> {viewerCount ?? '—'} viewers
              </div>
            </div>
            <div className="p-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-semibold text-sm">{liveTitle}</p>
                <p className="text-xs text-slate-400">Broadcasting over WebRTC + Firestore roster</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  aria-label={isMicMuted ? 'Unmute microphone' : 'Mute microphone'}
                  onClick={handleToggleMic}
                  className="p-2.5 rounded-xl bg-white/10 hover:bg-white/15 cursor-pointer"
                >
                  {isMicMuted ? <MicOff className="w-4 h-4 text-rose-400" /> : <Mic className="w-4 h-4" />}
                </button>
                <button
                  type="button"
                  aria-label={isCamOff ? 'Turn camera on' : 'Turn camera off'}
                  onClick={handleToggleCam}
                  className="p-2.5 rounded-xl bg-white/10 hover:bg-white/15 cursor-pointer"
                >
                  {isCamOff ? <VideoOff className="w-4 h-4 text-rose-400" /> : <Video className="w-4 h-4" />}
                </button>
                <button
                  type="button"
                  onClick={handleStopLive}
                  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                >
                  <PhoneOff className="w-4 h-4" /> End Stream
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Watch modal */}
      <AnimatePresence>
        {watching && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black text-white flex flex-col"
          >
            <div className="flex items-center justify-between p-4 border-b border-white/10">
              <button type="button" onClick={() => setWatching(null)} aria-label="Close" className="p-2 rounded-full hover:bg-white/10 cursor-pointer">
                <X className="w-6 h-6" />
              </button>
              <div className="flex items-center gap-2 text-xs font-semibold tabular-nums">
                <span className="px-2.5 py-1 rounded-md bg-rose-600/20 text-rose-400 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" /> LIVE
                </span>
                <span className="px-2.5 py-1 rounded-md bg-white/10 flex items-center gap-1">
                  <Eye className="w-3.5 h-3.5" /> {watchViewers ?? '—'}
                </span>
              </div>
            </div>

            <div className="flex-1 flex items-center justify-center px-4 relative overflow-hidden">
              <video
                ref={remoteVideoRef}
                autoPlay
                playsInline
                className={remoteVideoReady ? 'w-full h-full object-contain' : 'hidden'}
              />
              {!remoteVideoReady && (
                <div className="text-center max-w-md">
                  <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-rose-500/20 flex items-center justify-center">
                    <Video className="w-9 h-9 text-rose-400" />
                  </div>
                  <h2 className="text-2xl font-bold mb-1">{streamerName(watching)}</h2>
                  <p className="text-slate-400 mb-2">{watching.title || 'Live stream'}</p>
                  <div className="flex items-center justify-center gap-4 text-sm text-slate-400 tabular-nums">
                    <span className="flex items-center gap-1"><Users className="w-4 h-4" /> {watchViewers ?? '—'} watching</span>
                    <span className="flex items-center gap-1"><Wifi className="w-4 h-4 text-emerald-500" /> Connected</span>
                  </div>
                </div>
              )}
            </div>

            {/* Chat */}
            <div className="h-64 flex flex-col border-t border-white/10 bg-[#03071B]">
              <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
                {comments.length === 0 && (
                  <p className="text-slate-500 text-sm text-center pt-6">No comments yet — say hello!</p>
                )}
                {comments.map((c, i) => (
                  <div key={c.id || i} className="text-sm">
                    <span className="font-semibold text-arvdoul-purple">{c.displayName || c.userName || c.userId?.slice(0, 6)}</span>
                    <span className="text-slate-200 ml-2">{c.content || c.comment}</span>
                  </div>
                ))}
              </div>
              <div className="p-3 flex items-center gap-2 border-t border-white/10">
                <button type="button" onClick={() => setShowGifts(!showGifts)} aria-label="Gifts" className="p-2.5 rounded-full bg-white/10 hover:bg-white/20 cursor-pointer">
                  <Gift className="w-5 h-5 text-amber-400" />
                </button>
                <input
                  aria-label="Live stream chat input"
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSendComment()}
                  placeholder="Say something…"
                  className="flex-1 px-4 py-2.5 rounded-full bg-white/10 outline-none text-sm text-white"
                />
                <button type="button" onClick={handleSendComment} aria-label="Send" className="p-2.5 rounded-full bg-arvdoul-gradient text-white cursor-pointer">
                  <Send className="w-5 h-5" />
                </button>
              </div>

              <AnimatePresence>
                {showGifts && (
                  <motion.div
                    initial={{ y: 60, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: 60, opacity: 0 }}
                    className="bg-[#080F2E] border-t border-white/10 p-4 grid grid-cols-4 gap-2"
                  >
                    {giftTypes.map((g) => (
                      <button
                        type="button"
                        key={g.id}
                        onClick={() => handleSendGift(g)}
                        className="flex flex-col items-center gap-1 p-2 rounded-xl bg-white/5 hover:bg-white/15 transition cursor-pointer"
                      >
                        <span className="text-2xl">{g.emoji}</span>
                        <span className="text-xs text-slate-300 tabular-nums">{g.coinValue} coins</span>
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
          <div className="flex justify-center py-16"><Loader2 className="w-7 h-7 text-rose-500 animate-spin" /></div>
        ) : error ? (
          <div className="text-center py-16">
            <p className="text-rose-500 mb-4">{error}</p>
            <button type="button" onClick={loadStreams} className="px-5 py-2 rounded-xl border border-slate-300 dark:border-white/15 cursor-pointer">Retry</button>
          </div>
        ) : activeStreams.length === 0 ? (
          <div className="text-center py-20 rounded-2xl border border-dashed border-slate-300 dark:border-white/10">
            <Radio className="w-12 h-12 text-slate-400 mx-auto mb-4" />
            <h2 className="text-lg font-bold mb-2">No live broadcasts right now</h2>
            <p className="text-slate-500 dark:text-slate-400 text-sm mb-6">Start a broadcast to stream video and interact live with your audience.</p>
            <button
              type="button"
              onClick={() => setShowStartModal(true)}
              className="px-6 py-2.5 rounded-xl bg-rose-600 text-white text-sm font-semibold cursor-pointer"
            >
              Go Live Now
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {activeStreams.map((stream) => (
              <motion.button
                type="button"
                key={stream.id}
                whileHover={{ y: -2 }}
                onClick={() => handleWatch(stream)}
                className={isDark
                  ? 'text-left rounded-2xl overflow-hidden border border-white/10 bg-[#080F2E] cursor-pointer'
                  : 'text-left rounded-2xl overflow-hidden border border-slate-200 bg-white cursor-pointer'}
              >
                <div className="aspect-video bg-slate-900 flex items-center justify-center relative text-white">
                  <Video className="w-10 h-10 text-slate-600" />
                  <span className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-rose-600 text-white text-xs font-semibold flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" /> LIVE
                  </span>
                  <span className="absolute bottom-2 right-2 px-2 py-0.5 rounded-md bg-black/65 text-xs flex items-center gap-1 tabular-nums">
                    <Eye className="w-3 h-3" /> {stream.viewerCount ?? '—'}
                  </span>
                </div>
                <div className="p-3.5">
                  <p className="font-semibold truncate text-sm">{stream.title || 'Untitled stream'}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">{streamerName(stream)}</p>
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
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setShowStartModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, y: 12 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 12 }}
              className="w-full max-w-md rounded-2xl border border-white/10 bg-[#080F2E] text-white p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                <Radio className="w-5 h-5 text-rose-500" /> Go Live
              </h2>
              <input
                aria-label="Stream title…"
                autoFocus
                value={liveTitle}
                onChange={(e) => setLiveTitle(e.target.value)}
                placeholder="Stream title…"
                maxLength={120}
                className="w-full px-4 py-3 rounded-xl bg-white/10 outline-none mb-3 text-sm"
              />
              <div className="flex gap-2 mb-5">
                {[
                  { id: 'public', label: 'Public' },
                  { id: 'followers', label: 'Followers' },
                  { id: 'private', label: 'Private' },
                ].map((v) => (
                  <button
                    type="button"
                    key={v.id}
                    onClick={() => setVisibility(v.id)}
                    className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition cursor-pointer ${
                      visibility === v.id ? 'bg-rose-600 text-white' : 'bg-white/10 text-slate-300'
                    }`}
                  >
                    {v.label}
                  </button>
                ))}
              </div>
              <div className="flex gap-3">
                <button type="button" onClick={() => setShowStartModal(false)} className="flex-1 py-2.5 rounded-xl bg-white/10 font-semibold text-sm cursor-pointer">
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleStartLive}
                  disabled={starting}
                  className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 font-semibold text-sm disabled:opacity-60 flex items-center justify-center gap-2 cursor-pointer"
                >
                  {starting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
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
