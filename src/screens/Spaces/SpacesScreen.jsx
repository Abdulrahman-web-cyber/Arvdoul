// src/screens/Spaces/SpacesScreen.jsx
//
// Real-time audio stages, speaker hand raising, voice activity metering,
// WebSocket multi-peer reactions/presence, and super coin tipping.

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Radio, Mic, MicOff, Hand, Users, Coins, Plus, X, Crown, CheckCircle, Headphones } from 'lucide-react';
import { toast } from 'sonner';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { useAppStore } from '../../store/appStore';
import spacesService from '../../services/spacesService';
import { createRealtimeRoomClient } from '../../services/realtimeRoomClient';
import { useEscapeClose } from '../../hooks/useEscapeClose';
import { unknownNumber } from '../../lib/unknownNumber';
import { LazyImage } from '../../components/Shared/LazyImage';
import { cn } from '../../lib/utils';

const CATEGORIES = ['All', 'Tech & AI', 'Music & Audio', 'Crypto & Web3', 'Chill Lounge', 'Creator Talk'];
const EMOJI_REACTIONS = ['🔥', '💎', '🚀', '❤️', '👏', '💯', '👑'];

export default function SpacesScreen() {
  const { theme } = useTheme();
  const { user } = useAuth();
  const { currentUser, setAppState } = useAppStore();
  const isDark = theme === 'dark';

  const [spaces, setSpaces] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [activeSpace, setActiveSpace] = useState(null);
  const [loading, setLoading] = useState(true);

  // In-room state
  const [isHandRaised, setIsHandRaised] = useState(false);
  const [isMicLive, setIsMicLive] = useState(false);
  const [micBusy, setMicBusy] = useState(false);
  const [activeSpeakers, setActiveSpeakers] = useState({});
  const remoteAudioRef = useRef(null);
  const remoteStreamRef = useRef(null);
  const roomClientRef = useRef(null);
  const vadTimerRef = useRef(null);
  const audioCtxRef = useRef(null);
  const [reactions, setReactions] = useState([]);
  const [tipModalSpeaker, setTipModalSpeaker] = useState(null);
  const [tipAmount, setTipAmount] = useState(100);

  // Create Space modal
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  useEscapeClose(isCreateModalOpen, () => setIsCreateModalOpen(false));
  const [newSpaceTitle, setNewSpaceTitle] = useState('');
  const [newSpaceCategory, setNewSpaceCategory] = useState('Tech & AI');
  const [isRecordingEnabled, setIsRecordingEnabled] = useState(true);

  useEffect(() => {
    loadSpaces();
  }, [selectedCategory, user?.uid]);

  const loadSpaces = async () => {
    setLoading(true);
    try {
      const data = await spacesService.getActiveSpaces(selectedCategory, user?.uid);
      setSpaces(data);
      if (!activeSpace && data.length > 0) {
        setActiveSpace(data[0]);
      }
    } catch {
      toast.error('Failed to load spaces');
    } finally {
      setLoading(false);
    }
  };

  // Connect WebSocket signaling room for live reactions, voice activity, and remote P2P audio
  useEffect(() => {
    if (!activeSpace?.id || !user?.uid) return undefined;
    const client = createRealtimeRoomClient();
    roomClientRef.current = client;

    const unsub = client.subscribe((ev) => {
      if (ev.type === 'space-reaction' && ev.emoji) {
        const reactionItem = {
          id: `${Date.now()}_${Math.random()}`,
          emoji: ev.emoji,
          x: typeof ev.x === 'number' ? ev.x : 50,
        };
        setReactions((prev) => [...prev.slice(-8), reactionItem]);
        setTimeout(() => {
          setReactions((prev) => prev.filter((r) => r.id !== reactionItem.id));
        }, 2500);
      } else if (ev.type === 'speaking' && ev.userId) {
        setActiveSpeakers((prev) => ({ ...prev, [ev.userId]: Boolean(ev.active) }));
      } else if (ev.type === 'remote-stream' && ev.stream) {
        remoteStreamRef.current = ev.stream;
        if (remoteAudioRef.current) {
          remoteAudioRef.current.srcObject = ev.stream;
          remoteAudioRef.current.play?.().catch(() => {});
        }
      }
    });

    client.joinRoom(`space:${activeSpace.id}`, {
      userId: user.uid,
      displayName: user.displayName || user.username || 'Listener',
      role: activeSpace.host?.id === user.uid ? 'speaker' : 'listener',
    });

    return () => {
      unsub();
      client.leaveRoom();
      roomClientRef.current = null;
    };
  }, [activeSpace?.id, activeSpace?.host?.id, user?.uid, user?.displayName, user?.username]);

  const stopVad = () => {
    if (vadTimerRef.current) {
      clearInterval(vadTimerRef.current);
      vadTimerRef.current = null;
    }
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }
  };

  // Stop the microphone and leave the room on unmount
  useEffect(() => {
    return () => {
      stopVad();
      spacesService.stopAudio();
      if (roomClientRef.current) roomClientRef.current.leaveRoom();
    };
  }, []);

  const handleJoinSpace = async (space) => {
    const previous = activeSpace;
    if (previous?.id && previous.id !== space.id && user?.uid) {
      spacesService.leaveSpace(previous.id, user.uid).catch((e) => {
        console.warn('[Spaces] leave previous space failed', e?.message);
      });
    }
    setActiveSpace(space);
    setIsHandRaised(false);
    if (!user?.uid) {
      toast.info('Sign in to join the conversation.');
      return;
    }
    const res = await spacesService.joinSpace(space.id, user);
    if (res?.success) {
      toast.success(`Joined "${space.title}"`);
      loadSpaces();
    } else {
      toast.error(res?.error || 'Could not join this space.');
    }
  };

  const handleToggleHand = async () => {
    if (!activeSpace?.id || !user?.uid) {
      toast.error('Join a space to raise your hand.');
      return;
    }
    const raising = !isHandRaised;
    setIsHandRaised(raising);
    const result = await spacesService.toggleRaisedHand(activeSpace.id, user, raising);
    if (!result?.success) {
      setIsHandRaised(!raising);
      toast.error(result?.error || 'Could not update your hand state.');
      return;
    }
    toast.info(raising ? 'Hand raised' : 'Hand lowered');
  };

  const handleToggleMic = async () => {
    if (!activeSpace?.id || !user?.uid) {
      toast.error('Join a space to speak.');
      return;
    }
    if (isMicLive) {
      stopVad();
      spacesService.stopAudio();
      roomClientRef.current?.setLocalStream(null, 'listener');
      roomClientRef.current?.broadcast('speaking', { userId: user.uid, active: false });
      setActiveSpeakers((prev) => ({ ...prev, [user.uid]: false }));
      setIsMicLive(false);
      return;
    }
    setMicBusy(true);
    try {
      const isHost = activeSpace.host?.id === user.uid;
      const stream = await spacesService.startAudio(activeSpace.id, user, {
        isHost,
        onRemoteTrack: (remote) => {
          remoteStreamRef.current = remote;
          if (remoteAudioRef.current) {
            remoteAudioRef.current.srcObject = remote;
            remoteAudioRef.current.play?.().catch(() => {});
          }
        },
      });
      if (remoteAudioRef.current) remoteAudioRef.current.srcObject = stream;

      roomClientRef.current?.setLocalStream(stream, 'speaker');

      // Real Web Audio AnalyserNode voice-activity metering
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx && stream) {
        const ctx = new AudioCtx();
        audioCtxRef.current = ctx;
        const srcNode = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        srcNode.connect(analyser);
        const samples = new Float32Array(analyser.fftSize);
        let lastActive = false;
        vadTimerRef.current = setInterval(() => {
          analyser.getFloatTimeDomainData(samples);
          let sum = 0;
          for (let i = 0; i < samples.length; i += 1) sum += samples[i] * samples[i];
          const rms = Math.sqrt(sum / samples.length);
          const speakingNow = rms > 0.025;
          if (speakingNow !== lastActive) {
            lastActive = speakingNow;
            setActiveSpeakers((prev) => ({ ...prev, [user.uid]: speakingNow }));
            roomClientRef.current?.broadcast('speaking', { userId: user.uid, active: speakingNow });
          }
        }, 180);
      }

      setIsMicLive(true);
      toast.success(isHost ? 'You are live on stage' : 'Microphone connected');
    } catch (err) {
      toast.error(err?.message || 'Could not start your microphone.');
    } finally {
      setMicBusy(false);
    }
  };

  const handleSendReaction = (emoji) => {
    const x = Math.round(((Date.now() % 80) + 10));
    const newReaction = {
      id: Date.now() + Math.random(),
      emoji,
      x,
    };
    setReactions((prev) => [...prev.slice(-8), newReaction]);
    setTimeout(() => {
      setReactions((prev) => prev.filter((r) => r.id !== newReaction.id));
    }, 2500);
    roomClientRef.current?.broadcast('space-reaction', { emoji, x });
  };

  const handleSendTip = async () => {
    if (!tipModalSpeaker || !activeSpace) return;
    if (!user?.uid) {
      toast.error('Sign in to send a tip');
      return;
    }

    try {
      const result = await spacesService.sendTip(activeSpace.id, tipAmount, tipModalSpeaker.id, user.uid);
      if (!result?.success) {
        toast.error(result?.error || 'Tip could not be sent');
        return;
      }
      try {
        const { getMonetizationService } = await import('../../services/monetizationService.js');
        const bal = await getMonetizationService().getBalance(user.uid);
        if (currentUser && typeof bal === 'number') {
          setAppState({ currentUser: { ...currentUser, coins: bal } });
        }
      } catch (e) {
        console.warn('Space tip balance refresh failed', e?.message);
      }
      toast.success(`Sent ${tipAmount} Coins to ${tipModalSpeaker.name}`);
      setTipModalSpeaker(null);
      handleSendReaction('💎');
    } catch {
      toast.error('Failed to send coins');
    }
  };

  const handleCreateSpace = async (e) => {
    e.preventDefault();
    if (!newSpaceTitle.trim()) return;

    try {
      const created = await spacesService.createSpace({
        title: newSpaceTitle,
        category: newSpaceCategory,
        isRecording: isRecordingEnabled,
        hostUser: user,
      });
      setSpaces([created, ...spaces]);
      setActiveSpace(created);
      setIsCreateModalOpen(false);
      setNewSpaceTitle('');
      toast.success('Your live space is active');
    } catch (err) {
      toast.error(err?.message || 'Failed to start space');
    }
  };

  const handleEndSpace = async () => {
    if (!activeSpace?.id || !user?.uid) return;
    const res = await spacesService.endSpace(activeSpace.id, user.uid);
    if (!res?.success) {
      toast.error(res?.error || 'Could not end this space.');
      return;
    }
    toast.success('Space ended.');
    setActiveSpace(null);
    loadSpaces();
  };

  return (
    <div className="min-h-screen pb-32 pt-2 max-w-6xl mx-auto px-3 sm:px-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div>
          <span className="text-xs font-semibold text-rose-500 uppercase tracking-wider block mb-1">
            Live Voice Lounges
          </span>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-2 font-display">
            Arvdoul Audio Spaces <Headphones className="w-6 h-6 text-arvdoul-purple" />
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-xs sm:text-sm mt-1">
            Drop into live conversations, speak on stage with real WebRTC audio, and tip creators in real time.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsCreateModalOpen(true)}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-arvdoul-gradient text-white font-semibold text-sm hover:opacity-95 transition-opacity whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Plus className="w-4 h-4" /> Start a Live Space
        </button>
      </div>

      {/* Category Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-3 mb-6 scrollbar-none">
        {CATEGORIES.map((cat) => (
          <button
            type="button"
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={cn(
              'px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer shrink-0',
              selectedCategory === cat
                ? 'bg-arvdoul-purple text-white'
                : isDark
                ? 'bg-[#080F2E] text-slate-400 border border-white/10 hover:text-white'
                : 'bg-white text-slate-700 border border-slate-200 hover:text-slate-900'
            )}
          >
            {cat}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* ACTIVE IN-ROOM STAGE */}
        <div className="lg:col-span-8">
          {activeSpace ? (
            <div
              className={cn(
                'relative overflow-hidden rounded-2xl border p-6 sm:p-8',
                isDark ? 'bg-[#080F2E] border-white/10 text-white' : 'bg-white border-slate-200 text-slate-900'
              )}
            >
              {/* Floating Emojis */}
              <div className="absolute inset-0 pointer-events-none overflow-hidden">
                {reactions.map((r) => (
                  <motion.div
                    key={r.id}
                    initial={{ opacity: 1, y: 300, scale: 0.5, x: `${r.x}%` }}
                    animate={{ opacity: 0, y: -50, scale: 1.8 }}
                    transition={{ duration: 2.2, ease: 'easeOut' }}
                    className="absolute text-4xl"
                  >
                    {r.emoji}
                  </motion.div>
                ))}
              </div>

              {/* Room Top Bar */}
              <div className="flex items-start justify-between gap-4 pb-5 border-b border-slate-200 dark:border-white/10">
                <div>
                  <div className="flex items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">
                    <span className="text-rose-500 font-semibold flex items-center gap-1">
                      <Radio className="w-3.5 h-3.5" /> LIVE
                    </span>
                    <span aria-hidden="true">·</span>
                    <span className="text-arvdoul-purple font-semibold">{activeSpace.category}</span>
                    {activeSpace.isRecording && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span>Recording</span>
                      </>
                    )}
                  </div>
                  <h2 className="text-xl sm:text-2xl font-bold leading-snug">{activeSpace.title}</h2>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <div className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-500 text-xs font-semibold tabular-nums">
                    <Coins className="w-4 h-4" /> {unknownNumber(activeSpace.tipsTotalCoins) ?? '—'} Tips
                  </div>
                  {activeSpace.host?.id === user?.uid && (
                    <button
                      type="button"
                      onClick={handleEndSpace}
                      className="px-3 py-1.5 rounded-xl bg-rose-500/15 text-rose-500 text-xs font-semibold hover:bg-rose-500/25 cursor-pointer"
                    >
                      End Space
                    </button>
                  )}
                </div>
              </div>

              {/* STAGE: Host & Speakers Grid */}
              <div className="py-6">
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 block mb-4">
                  Speakers on Stage
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  {/* Host */}
                  <div className="flex flex-col items-center text-center p-4 rounded-xl bg-arvdoul-purple/10 border border-arvdoul-purple/30 relative">
                    <div className="relative mb-2">
                      <div
                        className={cn(
                          'w-16 h-16 rounded-full p-0.5 overflow-hidden transition-all',
                          activeSpeakers[activeSpace.host?.id] ? 'ring-4 ring-emerald-500' : 'ring-2 ring-arvdoul-purple'
                        )}
                      >
                        <LazyImage src={activeSpace.host.avatar} alt="" className="w-full h-full object-cover" />
                      </div>
                      <Crown className="w-5 h-5 text-amber-400 absolute -top-2 -right-1" />
                    </div>
                    <span className="text-xs font-semibold truncate max-w-full flex items-center gap-1">
                      {activeSpace.host.name} <CheckCircle className="w-3.5 h-3.5 text-arvdoul-blue" />
                    </span>
                    <span className="text-[11px] text-arvdoul-purple font-medium mt-0.5">Host</span>
                    <button
                      type="button"
                      onClick={() => setTipModalSpeaker(activeSpace.host)}
                      className="mt-2 px-2.5 py-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 rounded-lg text-[11px] font-semibold flex items-center gap-1 cursor-pointer"
                    >
                      <Coins className="w-3 h-3" /> Tip Coins
                    </button>
                  </div>

                  {/* Other Speakers */}
                  {activeSpace.speakers.map((sp) => (
                    <div
                      key={sp.id}
                      className={cn(
                        'flex flex-col items-center text-center p-4 rounded-xl border relative',
                        isDark ? 'bg-[#03071B] border-white/10' : 'bg-slate-50 border-slate-200'
                      )}
                    >
                      <div className="relative mb-2">
                        <div
                          className={cn(
                            'w-16 h-16 rounded-full p-0.5 overflow-hidden',
                            (sp.isSpeaking || activeSpeakers[sp.id]) ? 'ring-4 ring-emerald-500' : 'ring-2 ring-slate-600'
                          )}
                        >
                          <LazyImage src={sp.avatar} alt="" className="w-full h-full object-cover" />
                        </div>
                        {sp.isMuted ? (
                          <MicOff className="w-4 h-4 text-rose-400 bg-slate-900 rounded-full p-0.5 absolute -bottom-1 -right-1" />
                        ) : (
                          <Mic className="w-4 h-4 text-emerald-400 bg-slate-900 rounded-full p-0.5 absolute -bottom-1 -right-1" />
                        )}
                      </div>
                      <span className="text-xs font-semibold truncate max-w-full">{sp.name}</span>
                      <span className="text-[11px] text-slate-400 font-medium mt-0.5">Speaker</span>
                      <button
                        type="button"
                        onClick={() => setTipModalSpeaker(sp)}
                        className="mt-2 px-2.5 py-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 rounded-lg text-[11px] font-semibold flex items-center gap-1 cursor-pointer"
                      >
                        <Coins className="w-3 h-3" /> Tip Coins
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* AUDIENCE LISTENERS */}
              <div className="pt-4 border-t border-slate-200 dark:border-white/10">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1.5 tabular-nums">
                    <Users className="w-4 h-4 text-arvdoul-purple" /> Listeners in Room ({activeSpace.audienceCount})
                  </span>
                </div>
                <div className="flex items-center gap-3 overflow-x-auto pb-2 scrollbar-none">
                  {activeSpace.listeners.map((l) => (
                    <div key={l.id} className="flex flex-col items-center shrink-0">
                      <div className="w-10 h-10 rounded-full overflow-hidden border border-slate-300 dark:border-white/15">
                        <LazyImage src={l.avatar} alt="" className="w-full h-full object-cover" />
                      </div>
                      <span className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 max-w-[60px] truncate">{l.name}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* BOTTOM CONTROLS & REACTIONS */}
              <div className="mt-6 pt-5 border-t border-slate-200 dark:border-white/10 flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleToggleMic}
                    disabled={micBusy}
                    className={cn(
                      'flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-xs transition-colors disabled:opacity-60 cursor-pointer',
                      isMicLive
                        ? 'bg-emerald-600 text-white'
                        : isDark
                        ? 'bg-white/10 text-slate-200 hover:bg-white/15'
                        : 'bg-slate-100 text-slate-800 hover:bg-slate-200'
                    )}
                  >
                    {isMicLive ? <><Mic className="w-4 h-4" /> Live Mic</> : <><MicOff className="w-4 h-4 text-rose-500" /> Join Mic</>}
                  </button>

                  <button
                    type="button"
                    onClick={handleToggleHand}
                    className={cn(
                      'flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-xs transition-colors cursor-pointer',
                      isHandRaised
                        ? 'bg-amber-500 text-black'
                        : isDark
                        ? 'bg-white/10 text-slate-200 hover:bg-white/15'
                        : 'bg-slate-100 text-slate-800 hover:bg-slate-200'
                    )}
                  >
                    <Hand className="w-4 h-4" /> {isHandRaised ? 'Hand Raised' : 'Raise Hand'}
                  </button>
                </div>

                <div
                  className={cn(
                    'flex items-center gap-1 p-1 rounded-xl border',
                    isDark ? 'bg-[#03071B] border-white/10' : 'bg-slate-50 border-slate-200'
                  )}
                >
                  {EMOJI_REACTIONS.map((emoji) => (
                    <button
                      type="button"
                      key={emoji}
                      aria-label={`React with ${emoji}`}
                      onClick={() => handleSendReaction(emoji)}
                      className="w-8 h-8 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 flex items-center justify-center text-base hover:scale-110 transition-transform cursor-pointer"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>
              <audio ref={remoteAudioRef} autoPlay playsInline className="hidden" />
            </div>
          ) : (
            <div className="p-12 text-center text-slate-500 border border-dashed border-slate-300 dark:border-white/15 rounded-2xl">
              <Headphones className="w-12 h-12 text-arvdoul-purple/40 mx-auto mb-3" />
              <p className="text-sm font-semibold">Select a live space from the directory to tune in.</p>
            </div>
          )}
        </div>

        {/* ALL ACTIVE SPACES LIST */}
        <div className="lg:col-span-4 space-y-3">
          <h3 className="font-semibold text-base flex items-center gap-2">
            <Radio className="w-4 h-4 text-arvdoul-purple" /> Live Lounges ({spaces.length})
          </h3>

          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className={cn(
                    'p-4 rounded-xl border space-y-2 animate-pulse',
                    isDark ? 'bg-[#080F2E] border-white/10' : 'bg-white border-slate-200'
                  )}
                >
                  <div className="w-40 h-4 rounded-lg bg-slate-200 dark:bg-white/10" />
                  <div className="w-24 h-3 rounded-lg bg-slate-200 dark:bg-white/5" />
                </div>
              ))}
            </div>
          ) : spaces.length === 0 ? (
            <div className={cn('p-6 rounded-xl border text-center text-xs text-slate-500', isDark ? 'border-white/10 bg-[#080F2E]' : 'border-slate-200 bg-white')}>
              No active lounges in {selectedCategory}. Start one above!
            </div>
          ) : (
            spaces.map((sp) => {
              const isCurrent = activeSpace?.id === sp.id;
              return (
                <button
                  type="button"
                  key={sp.id}
                  onClick={() => handleJoinSpace(sp)}
                  className={cn(
                    'w-full text-left p-4 rounded-xl border cursor-pointer transition-colors',
                    isCurrent
                      ? 'bg-arvdoul-purple/15 border-arvdoul-purple'
                      : isDark
                      ? 'bg-[#080F2E] border-white/10 hover:border-white/20'
                      : 'bg-white border-slate-200 hover:border-slate-300'
                  )}
                >
                  <div className="flex items-center justify-between mb-1.5 text-xs">
                    <span className="font-semibold text-arvdoul-purple">{sp.category}</span>
                    <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1 tabular-nums">
                      <Users className="w-3 h-3" /> {sp.audienceCount}
                    </span>
                  </div>
                  <h4 className="text-sm font-bold line-clamp-2 mb-3">{sp.title}</h4>
                  <div className="flex items-center gap-2">
                    <LazyImage src={sp.host.avatar} alt="" className="w-6 h-6 rounded-full object-cover" />
                    <span className="text-xs text-slate-500 dark:text-slate-300 font-medium truncate">
                      {sp.host.name} · Host
                    </span>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* TIP COINS MODAL */}
      <AnimatePresence>
        {tipModalSpeaker && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              className={cn(
                'w-full max-w-sm p-6 rounded-2xl border space-y-5',
                isDark ? 'bg-[#080F2E] border-white/10 text-white' : 'bg-white border-slate-200 text-slate-900'
              )}
            >
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold flex items-center gap-2">
                  <Coins className="w-5 h-5 text-amber-500" /> Tip {tipModalSpeaker.name}
                </h3>
                <button type="button" aria-label="Close tip modal" onClick={() => setTipModalSpeaker(null)} className="text-slate-400 hover:text-white cursor-pointer">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="grid grid-cols-3 gap-2">
                {[50, 100, 250, 500, 1000, 2500].map((amt) => (
                  <button
                    type="button"
                    key={amt}
                    onClick={() => setTipAmount(amt)}
                    className={cn(
                      'py-2.5 rounded-xl text-xs font-semibold border tabular-nums cursor-pointer',
                      tipAmount === amt
                        ? 'border-amber-400 bg-amber-400/20 text-amber-400'
                        : isDark
                        ? 'border-white/10 bg-[#03071B] text-slate-300'
                        : 'border-slate-200 bg-slate-50 text-slate-800'
                    )}
                  >
                    {amt} coins
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={handleSendTip}
                className="w-full py-3 rounded-xl font-semibold bg-amber-500 hover:bg-amber-400 text-black flex items-center justify-center gap-2 cursor-pointer"
              >
                Send {tipAmount} Coins
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* CREATE SPACE MODAL */}
      <AnimatePresence>
        {isCreateModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              className={cn(
                'w-full max-w-md p-6 rounded-2xl border space-y-4',
                isDark ? 'bg-[#080F2E] border-white/10 text-white' : 'bg-white border-slate-200 text-slate-900'
              )}
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-white/10">
                <h3 className="text-base font-bold flex items-center gap-2">
                  <Radio className="w-5 h-5 text-arvdoul-purple" /> Start Live Voice Lounge
                </h3>
                <button type="button" aria-label="Close create space modal" onClick={() => setIsCreateModalOpen(false)} className="text-slate-400 hover:text-white cursor-pointer">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleCreateSpace} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-2">
                    Space Title / Topic
                  </label>
                  <input
                    aria-label="Space Title / Topic"
                    type="text"
                    required
                    placeholder="e.g. Product Building & Creator Q&A"
                    value={newSpaceTitle}
                    onChange={(e) => setNewSpaceTitle(e.target.value)}
                    className={cn(
                      'w-full p-3 rounded-xl text-sm border focus:ring-2 focus:ring-arvdoul-purple outline-none',
                      isDark ? 'bg-[#03071B] border-white/10 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                    )}
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-2">
                    Category
                  </label>
                  <select
                    aria-label="Category"
                    value={newSpaceCategory}
                    onChange={(e) => setNewSpaceCategory(e.target.value)}
                    className={cn(
                      'w-full p-3 rounded-xl text-xs border',
                      isDark ? 'bg-[#03071B] border-white/10 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                    )}
                  >
                    {CATEGORIES.filter((c) => c !== 'All').map((cat) => (
                      <option key={cat}>{cat}</option>
                    ))}
                  </select>
                </div>

                <div className={cn('flex items-center justify-between p-3 rounded-xl border', isDark ? 'bg-[#03071B] border-white/10' : 'bg-slate-50 border-slate-200')}>
                  <div>
                    <span className="text-xs font-semibold block">Auto-Record Space</span>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">Save replay for followers after space ends</span>
                  </div>
                  <input
                    aria-label="Auto-Record Space"
                    type="checkbox"
                    checked={isRecordingEnabled}
                    onChange={(e) => setIsRecordingEnabled(e.target.checked)}
                    className="w-4 h-4 accent-arvdoul-purple"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-3 rounded-xl font-semibold bg-arvdoul-gradient text-white hover:opacity-95 cursor-pointer"
                >
                  Go Live with Voice Space
                </button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
