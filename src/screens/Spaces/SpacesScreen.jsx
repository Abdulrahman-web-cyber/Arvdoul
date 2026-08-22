// src/screens/Spaces/SpacesScreen.jsx
// 🎙️ ARVDOUL LIVE AUDIO SPACES & VOICE LOUNGES
// Real-time audio stages, speaker hand raising, super coin tipping, and interactive reactions

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Radio, 
  Mic, 
  MicOff, 
  Hand, 
  Users, 
  Flame, 
  Sparkles, 
  Coins, 
  Heart, 
  Plus, 
  X, 
  Volume2, 
  Share2,
  Crown,
  CheckCircle,
  MessageCircle,
  Headphones
} from 'lucide-react';
import { toast } from 'sonner';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { useAppStore } from '../../store/appStore';
import spacesService from '../../services/spacesService';
import LoadingSpinner from '../../components/Shared/LoadingSpinner';
import { useEscapeClose } from '../../hooks/useEscapeClose';

const CATEGORIES = ['All', 'Tech & AI', 'Music & Audio', 'Crypto & Web3', 'Chill Lounge', 'Creator Talk'];
const EMOJI_REACTIONS = ['🔥', '💎', '🚀', '❤️', '👏', '💯', '👑'];

export default function SpacesScreen() {
  const navigate = useNavigate();
  const { theme } = useTheme();
  const { user } = useAuth();
  const { currentUser, setAppState } = useAppStore();
  const isDark = theme === 'dark';

  const [spaces, setSpaces] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [activeSpace, setActiveSpace] = useState(null);
  const [loading, setLoading] = useState(true);

  // In-room state
  const [isMuted, setIsMuted] = useState(true);
  const [isHandRaised, setIsHandRaised] = useState(false);
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
  }, [selectedCategory]);

  const loadSpaces = async () => {
    setLoading(true);
    try {
      const data = await spacesService.getActiveSpaces(selectedCategory);
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

  const handleJoinSpace = (space) => {
    setActiveSpace(space);
    setIsMuted(true);
    setIsHandRaised(false);
    toast.success(`Joined "${space.title}" 🎧`);
  };

  const handleToggleHand = () => {
    setIsHandRaised(!isHandRaised);
    if (!isHandRaised) {
      toast.info('Raised hand to speak! ✋ The host was notified.');
    } else {
      toast.info('Lowered hand.');
    }
  };

  const handleSendReaction = (emoji) => {
    const newReaction = {
      id: Date.now() + Math.random(),
      emoji,
      x: Math.random() * 80 + 10
    };
    setReactions((prev) => [...prev.slice(-8), newReaction]);
    setTimeout(() => {
      setReactions((prev) => prev.filter((r) => r.id !== newReaction.id));
    }, 2500);
  };

  const handleSendTip = async () => {
    if (!tipModalSpeaker || !activeSpace) return;
    if (!user?.uid) {
      toast.error('Sign in to send a tip');
      return;
    }

    try {
      // REAL server-side debit+credit; the service rejects insufficient coins.
      const result = await spacesService.sendTip(activeSpace.id, tipAmount, tipModalSpeaker.id, user.uid);
      if (!result?.success) {
        toast.error(result?.error || 'Tip could not be sent');
        return;
      }
      // Refresh the user's REAL balance from the ledger.
      try {
        const { getMonetizationService } = await import('../../services/monetizationService.js');
        const bal = await getMonetizationService().getBalance(user.uid);
        if (currentUser && typeof bal === 'number') {
          setAppState({ currentUser: { ...currentUser, coins: bal } });
        }
      } catch { /* best-effort */ }
      toast.success(`Sent ${tipAmount} Coins to ${tipModalSpeaker.name}! 🪙✨`);
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
        hostUser: user
      });
      setSpaces([created, ...spaces]);
      setActiveSpace(created);
      setIsCreateModalOpen(false);
      setNewSpaceTitle('');
      toast.success('Your live space is now broadcasted! 🎙️');
    } catch {
      toast.error('Failed to start space');
    }
  };

  return (
    <div className="min-h-screen pb-32 pt-2 max-w-6xl mx-auto px-3 sm:px-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="flex h-3 w-3 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500" />
            </span>
            <span className="text-xs font-bold text-red-400 uppercase tracking-wider">Live Voice Lounges</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight flex items-center gap-2">
            Arvdoul Audio Spaces <Headphones className="w-6 h-6 text-purple-400" />
          </h1>
          <p className="text-gray-400 text-xs sm:text-sm mt-1">
            Drop into live conversations, speak on stage, network with top creators, and earn coin tips in real time.
          </p>
        </div>

        <button
          onClick={() => setIsCreateModalOpen(true)}
          className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-gradient-to-r from-purple-600 via-pink-600 to-red-500 text-white font-bold text-sm shadow-xl shadow-purple-500/25 hover:scale-105 transition-all"
        >
          <Plus className="w-4 h-4" /> Start a Live Space
        </button>
      </div>

      {/* Category Pills */}
      <div className="flex items-center gap-2 overflow-x-auto pb-3 mb-6 scrollbar-none">
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={`px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
              selectedCategory === cat
                ? 'bg-purple-600 text-white shadow-md shadow-purple-500/30'
                : isDark ? 'bg-gray-800/80 text-gray-400 hover:text-white' : 'bg-white text-gray-700 shadow-sm'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* ==================== ACTIVE IN-ROOM STAGE ==================== */}
        <div className="lg:col-span-8">
          {activeSpace ? (
            <div className={`relative overflow-hidden rounded-3xl border ${isDark ? 'bg-gradient-to-b from-gray-900/90 via-gray-900/95 to-purple-950/40 border-purple-500/30' : 'bg-white border-gray-200'} shadow-2xl p-6 sm:p-8`}>
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
              <div className="flex items-start justify-between gap-4 pb-6 border-b border-gray-800">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="px-2.5 py-0.5 rounded-full bg-red-500/20 text-red-400 text-xs font-extrabold flex items-center gap-1">
                      <Radio className="w-3.5 h-3.5 animate-pulse" /> LIVE NOW
                    </span>
                    <span className="text-xs text-purple-400 font-semibold">{activeSpace.category}</span>
                    {activeSpace.isRecording && (
                      <span className="text-xs text-gray-400 bg-gray-800 px-2 py-0.5 rounded-md">🔴 Rec</span>
                    )}
                  </div>
                  <h2 className="text-xl sm:text-2xl font-bold text-white leading-snug">{activeSpace.title}</h2>
                </div>

                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5 px-3 py-1.5 bg-yellow-500/10 border border-yellow-500/30 rounded-xl text-yellow-400 text-xs font-bold">
                    <Coins className="w-4 h-4" /> {activeSpace.tipsTotalCoins.toLocaleString()} Tips
                  </div>
                </div>
              </div>

              {/* STAGE: Host & Speakers Grid */}
              <div className="py-8">
                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-4">Speakers on Stage</span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  {/* Host */}
                  <div className="flex flex-col items-center text-center p-4 rounded-2xl bg-purple-500/10 border border-purple-500/30 relative">
                    <div className="relative mb-2">
                      <div className="w-16 h-16 rounded-full ring-4 ring-purple-500 p-0.5 overflow-hidden shadow-lg shadow-purple-500/40">
                        <img src={activeSpace.host.avatar} alt="" className="w-full h-full object-cover" />
                      </div>
                      <Crown className="w-5 h-5 text-yellow-400 absolute -top-2 -right-1 drop-shadow" />
                    </div>
                    <span className="text-xs font-bold text-white truncate max-w-full flex items-center gap-1">
                      {activeSpace.host.name} <CheckCircle className="w-3.5 h-3.5 text-blue-400" />
                    </span>
                    <span className="text-[10px] text-purple-400 font-medium uppercase mt-0.5">Host</span>
                    <button
                      onClick={() => setTipModalSpeaker(activeSpace.host)}
                      className="mt-2 px-2.5 py-1 bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-300 rounded-lg text-[10px] font-bold flex items-center gap-1"
                    >
                      <Coins className="w-3 h-3" /> Tip Coins
                    </button>
                  </div>

                  {/* Other Speakers */}
                  {activeSpace.speakers.map((sp) => (
                    <div key={sp.id} className="flex flex-col items-center text-center p-4 rounded-2xl bg-gray-800/50 border border-gray-700/60 relative">
                      <div className="relative mb-2">
                        <div className={`w-16 h-16 rounded-full p-0.5 overflow-hidden ${sp.isSpeaking ? 'ring-4 ring-green-500 animate-pulse' : 'ring-2 ring-gray-600'}`}>
                          <img src={sp.avatar} alt="" className="w-full h-full object-cover" />
                        </div>
                        {sp.isMuted ? (
                          <MicOff className="w-4 h-4 text-red-400 bg-gray-900 rounded-full p-0.5 absolute -bottom-1 -right-1" />
                        ) : (
                          <Mic className="w-4 h-4 text-green-400 bg-gray-900 rounded-full p-0.5 absolute -bottom-1 -right-1" />
                        )}
                      </div>
                      <span className="text-xs font-bold text-white truncate max-w-full">{sp.name}</span>
                      <span className="text-[10px] text-gray-400 font-medium mt-0.5">Speaker</span>
                      <button
                        onClick={() => setTipModalSpeaker(sp)}
                        className="mt-2 px-2.5 py-1 bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-300 rounded-lg text-[10px] font-bold flex items-center gap-1"
                      >
                        <Coins className="w-3 h-3" /> Tip Coins
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* AUDIENCE LISTENERS */}
              <div className="pt-4 border-t border-gray-800">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Users className="w-4 h-4 text-purple-400" /> Listeners in Room ({activeSpace.audienceCount})
                  </span>
                </div>
                <div className="flex items-center gap-3 overflow-x-auto pb-2 scrollbar-none">
                  {activeSpace.listeners.map((l) => (
                    <div key={l.id} className="flex flex-col items-center shrink-0">
                      <div className="w-10 h-10 rounded-full overflow-hidden border border-gray-700">
                        <img src={l.avatar} alt="" className="w-full h-full object-cover" />
                      </div>
                      <span className="text-[10px] text-gray-400 mt-1 max-w-[60px] truncate">{l.name}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* BOTTOM CONTROLS & REACTIONS */}
              <div className="mt-8 pt-6 border-t border-gray-800 flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setIsMuted(!isMuted)}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs shadow-md transition-all ${
                      isMuted ? 'bg-gray-800 text-gray-300 hover:bg-gray-700' : 'bg-green-600 text-white animate-pulse'
                    }`}
                  >
                    {isMuted ? <><MicOff className="w-4 h-4 text-red-400" /> Muted</> : <><Mic className="w-4 h-4" /> Live Mic</>}
                  </button>

                  <button
                    onClick={handleToggleHand}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs transition-all ${
                      isHandRaised ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/30' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                    }`}
                  >
                    <Hand className="w-4 h-4" /> {isHandRaised ? 'Hand Raised ✋' : 'Raise Hand'}
                  </button>
                </div>

                {/* Emojis Reactions bar */}
                <div className="flex items-center gap-1.5 p-1 bg-gray-800/80 rounded-2xl border border-gray-700">
                  {EMOJI_REACTIONS.map((emoji) => (
                    <button
                      key={emoji}
                      onClick={() => handleSendReaction(emoji)}
                      className="w-8 h-8 rounded-xl hover:bg-gray-700 flex items-center justify-center text-base hover:scale-125 transition-transform"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="p-12 text-center text-gray-500 border border-dashed border-gray-800 rounded-3xl">
              <Headphones className="w-12 h-12 text-purple-400/40 mx-auto mb-3" />
              <p className="text-sm font-semibold">Select a live space from the list to tune in.</p>
            </div>
          )}
        </div>

        {/* ==================== ALL ACTIVE SPACES LIST ==================== */}
        <div className="lg:col-span-4 space-y-4">
          <h3 className="font-bold text-base text-white flex items-center gap-2">
            <Radio className="w-4 h-4 text-purple-400" /> Discover Live Lounges ({spaces.length})
          </h3>

          {loading ? (
            <div className="p-8 flex justify-center"><LoadingSpinner size="md" /></div>
          ) : (
            spaces.map((sp) => {
              const isCurrent = activeSpace?.id === sp.id;
              return (
                <div
                  key={sp.id}
                  onClick={() => handleJoinSpace(sp)}
                  className={`p-4 rounded-2xl border cursor-pointer transition-all duration-200 ${
                    isCurrent
                      ? 'bg-purple-900/40 border-purple-500 shadow-lg shadow-purple-500/20'
                      : isDark ? 'bg-gray-900/60 border-gray-800 hover:border-gray-700' : 'bg-white border-gray-200'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-bold text-purple-400">{sp.category}</span>
                    <span className="text-[10px] text-gray-400 flex items-center gap-1">
                      <Users className="w-3 h-3" /> {sp.audienceCount} listening
                    </span>
                  </div>
                  <h4 className="text-sm font-bold text-white line-clamp-2 mb-3">{sp.title}</h4>
                  <div className="flex items-center gap-2">
                    <img src={sp.host.avatar} alt="" className="w-6 h-6 rounded-full object-cover" />
                    <span className="text-xs text-gray-300 font-medium truncate">{sp.host.name} (Host)</span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* ==================== TIP COINS MODAL ==================== */}
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
              className={`w-full max-w-sm p-6 rounded-3xl border ${isDark ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200'} shadow-2xl space-y-5`}
            >
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Coins className="w-5 h-5 text-yellow-400" /> Tip {tipModalSpeaker.name}
                </h3>
                <button onClick={() => setTipModalSpeaker(null)} className="text-gray-400 hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="grid grid-cols-3 gap-2">
                {[50, 100, 250, 500, 1000, 2500].map((amt) => (
                  <button
                    key={amt}
                    onClick={() => setTipAmount(amt)}
                    className={`py-3 rounded-xl text-xs font-bold border transition-all ${
                      tipAmount === amt
                        ? 'border-yellow-400 bg-yellow-400/20 text-yellow-300'
                        : isDark ? 'border-gray-800 bg-gray-800/40 text-gray-300' : 'border-gray-200'
                    }`}
                  >
                    🪙 {amt}
                  </button>
                ))}
              </div>

              <button
                onClick={handleSendTip}
                className="w-full py-3.5 rounded-xl font-bold bg-gradient-to-r from-yellow-500 to-amber-600 text-black shadow-lg shadow-yellow-500/20 flex items-center justify-center gap-2 hover:opacity-95"
              >
                Send {tipAmount} Coins Now
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ==================== CREATE SPACE MODAL ==================== */}
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
              className={`w-full max-w-md p-6 rounded-3xl border ${isDark ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200'} shadow-2xl space-y-4`}
            >
              <div className="flex items-center justify-between pb-3 border-b border-gray-800">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Radio className="w-5 h-5 text-purple-400" /> Start Live Voice Lounge
                </h3>
                <button onClick={() => setIsCreateModalOpen(false)} className="text-gray-400 hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleCreateSpace} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Space Title / Topic</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Late Night Coding & Chill Beats 🎧"
                    value={newSpaceTitle}
                    onChange={(e) => setNewSpaceTitle(e.target.value)}
                    className={`w-full p-3.5 rounded-xl text-sm border focus:ring-2 focus:ring-purple-500 outline-none ${
                      isDark ? 'bg-gray-800 border-gray-700 text-white' : 'bg-gray-50 border-gray-300'
                    }`}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Category</label>
                  <select
                    value={newSpaceCategory}
                    onChange={(e) => setNewSpaceCategory(e.target.value)}
                    className={`w-full p-3.5 rounded-xl text-xs border ${isDark ? 'bg-gray-800 border-gray-700 text-white' : 'bg-gray-50'}`}
                  >
                    {CATEGORIES.filter((c) => c !== 'All').map((cat) => (
                      <option key={cat}>{cat}</option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center justify-between p-3 rounded-xl bg-gray-800/40 border border-gray-700/60">
                  <div>
                    <span className="text-xs font-bold text-white block">Auto-Record Space</span>
                    <span className="text-[10px] text-gray-400">Save replay for followers after space ends</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={isRecordingEnabled}
                    onChange={(e) => setIsRecordingEnabled(e.target.checked)}
                    className="w-4 h-4 accent-purple-500"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-4 rounded-2xl font-bold bg-gradient-to-r from-purple-600 via-pink-600 to-red-500 text-white shadow-xl shadow-purple-500/25 hover:opacity-95"
                >
                  🚀 Go Live with Voice Space
                </button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
