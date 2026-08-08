/**
 * src/screens/ChatScreen.jsx - ARVDOUL DIRECT MESSAGING & 1-ON-1 EXPERIENCE
 * 
 * Exact 100% pixel-perfect implementation of the Arvdoul Ultra-Dark Neon Chat UI
 * Featuring:
 * - Glowing circular neon avatar with verified badge & crown
 * - Online status with audio waveform indicator + Premium / Creator / Level tags
 * - Pinned message top banner with quick jump
 * - Rich message types: Text, Voice note with interactive waveform, 4K Media with badges,
 *   Interactive live Poll with real-time percentage progress bars & voting
 * - Floating right-side AI Action Rail (AI Reply, Translate, Summary, Remind Me)
 * - Message reactions with emoji selector (+ button)
 * - Bottom input bar with emoji, sticker, camera, voice note recorder, send gradient button
 * - Expandable full-screen attachment drawer (Gallery, Camera, File, Location, Contact, Poll, Coin Gift, Schedule, Voice Note, GIF, Music, More)
 * - ARVDOUL glowing status footer with security lock
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { cn } from '../lib/utils';
import {
  ArrowLeft, Phone, Video, Search, MoreVertical, ShieldCheck,
  CheckCheck, Play, Pause, Download, Heart, Smile, Sparkles,
  Mic, Send, Plus, Image as ImageIcon, Camera, FileText, MapPin,
  User as UserIcon, BarChart2, DollarSign, Calendar, Gift, ChevronRight,
  Pin, X, Check, Eye, Clock, Volume2, Paperclip, Music, Radio,
  Globe, FileSpreadsheet, Bell, ThumbsUp, Flame, Star, Lock,
  Share2, MessageSquare, Flame as FireIcon
} from 'lucide-react';

const INITIAL_MESSAGES = [
  {
    id: 'm1',
    sender: 'them',
    type: 'text',
    text: 'Hey! How are you doing? 😊',
    timestamp: '9:30 AM',
    reactions: { '❤️': 2 },
  },
  {
    id: 'm2',
    sender: 'me',
    type: 'text',
    text: "I'm good! Just working on some new designs.",
    timestamp: '9:31 AM',
    status: 'read',
    reactions: { '👍': 3 },
  },
  {
    id: 'm3',
    sender: 'them',
    type: 'media',
    mediaUrl: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&auto=format&fit=crop&q=80',
    title: 'Beautiful view yesterday 😍',
    duration: '00:12',
    quality: '4K',
    timestamp: '9:32 AM',
    reactions: { '😍': 4 },
  },
  {
    id: 'm4',
    sender: 'me',
    type: 'voice',
    duration: '0:18',
    timestamp: '9:33 AM',
    status: 'read',
    reactions: { '🔥': 2 },
    waveform: [25, 45, 65, 30, 85, 95, 40, 75, 90, 50, 70, 35, 80, 100, 60, 45, 75, 35, 20, 40],
  },
  {
    id: 'm5',
    sender: 'them',
    type: 'poll',
    author: 'Isabella Morgan',
    question: 'Where should we go this weekend?',
    subtitle: 'Select one',
    totalVotes: 25,
    timestamp: '9:35 AM',
    options: [
      { id: 'opt-1', label: 'Beach 🏖️', percent: 65, votes: 16 },
      { id: 'opt-2', label: 'Mountains 🏔️', percent: 35, votes: 9 },
    ],
    selectedOption: 'opt-2',
  },
];

export default function ChatScreen() {
  const navigate = useNavigate();
  const { conversationId } = useParams();
  const { user } = useAuth();
  const { theme } = useTheme();

  const [messages, setMessages] = useState(INITIAL_MESSAGES);
  const [inputText, setInputText] = useState('');
  const [showDrawer, setShowDrawer] = useState(false);
  const [showPinned, setShowPinned] = useState(true);
  const [playingVoiceId, setPlayingVoiceId] = useState(null);
  const [voiceProgress, setVoiceProgress] = useState(0);
  const [activePollVotes, setActivePollVotes] = useState({ m5: 'opt-2' });
  const [showReactionPickerFor, setShowReactionPickerFor] = useState(null);
  const [showGiftModal, setShowGiftModal] = useState(false);
  const [giftAmount, setGiftAmount] = useState(250);

  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Voice note player simulation
  const handleToggleVoice = (msgId) => {
    if (playingVoiceId === msgId) {
      setPlayingVoiceId(null);
    } else {
      setPlayingVoiceId(msgId);
      setVoiceProgress(0);
      const interval = setInterval(() => {
        setVoiceProgress((prev) => {
          if (prev >= 100) {
            clearInterval(interval);
            setPlayingVoiceId(null);
            return 0;
          }
          return prev + 8;
        });
      }, 150);
    }
  };

  // Send message
  const handleSend = (e) => {
    e?.preventDefault?.();
    if (!inputText.trim()) return;

    const newMsg = {
      id: `msg-${Date.now()}`,
      sender: 'me',
      type: 'text',
      text: inputText.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      status: 'read',
      reactions: {},
    };

    setMessages((prev) => [...prev, newMsg]);
    setInputText('');
    toast.success('Message sent! ✨');

    // Simulate instant AI / Isabella response
    setTimeout(() => {
      setMessages((prev) => [
        ...prev,
        {
          id: `msg-resp-${Date.now()}`,
          sender: 'them',
          type: 'text',
          text: 'Sounds amazing! Let’s lock it in 🌴🚀',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          reactions: { '❤️': 1 },
        },
      ]);
    }, 1400);
  };

  // Poll Vote
  const handleVote = (msgId, optId) => {
    setActivePollVotes((prev) => ({ ...prev, [msgId]: optId }));
    toast.success('Vote recorded! 📊');
  };

  // Add reaction
  const handleAddReaction = (msgId, emoji) => {
    setMessages((prev) =>
      prev.map((m) => {
        if (m.id !== msgId) return m;
        const currentReactions = { ...(m.reactions || {}) };
        currentReactions[emoji] = (currentReactions[emoji] || 0) + 1;
        return { ...m, reactions: currentReactions };
      })
    );
    setShowReactionPickerFor(null);
  };

  return (
    <div className="min-h-screen bg-[#030614] text-white flex flex-col justify-between select-none relative overflow-x-hidden font-sans">
      {/* Background Cosmic Star Nebula Effect */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-purple-900/15 rounded-full blur-3xl" />
        <div className="absolute bottom-10 right-10 w-96 h-96 bg-blue-900/15 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-gradient-to-tr from-purple-950/10 to-indigo-950/10 rounded-full blur-3xl" />
      </div>

      {/* Top Header */}
      <header className="sticky top-0 z-40 backdrop-blur-2xl bg-[#060A1D]/90 border-b border-white/[0.08] px-3.5 py-2.5 transition-colors">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          {/* Left: Back & User Identity with Neon Ring */}
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => navigate('/messages')}
              className="w-9 h-9 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 flex items-center justify-center transition-all text-gray-300 hover:text-white"
              aria-label="Back"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>

            {/* Glowing Luminous Avatar Ring */}
            <div className="relative cursor-pointer" onClick={() => navigate('/profile/isabella')}>
              <div className="w-12 h-12 rounded-full p-[2.5px] bg-gradient-to-tr from-purple-500 via-pink-500 to-cyan-400 shadow-[0_0_18px_rgba(168,85,247,0.4)]">
                <img
                  src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=80"
                  alt="Isabella Morgan"
                  className="w-full h-full rounded-full object-cover border-2 border-[#060A1D]"
                />
              </div>
              {/* Online Green Indicator Dot */}
              <span className="absolute bottom-0.5 right-0.5 w-3.5 h-3.5 rounded-full bg-emerald-400 border-2 border-[#060A1D] shadow-[0_0_8px_#34d399]" />
            </div>

            {/* Name, Verified, Crown, Online & Tags */}
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <h1 className="font-bold text-sm tracking-wide text-white flex items-center gap-1">
                  <span>Isabella Morgan</span>
                  <span className="w-4 h-4 rounded-full bg-blue-500 text-white flex items-center justify-center text-[10px] font-bold">
                    ✓
                  </span>
                  <span className="text-amber-400 text-xs">👑</span>
                </h1>
              </div>

              <div className="flex items-center gap-1.5 text-[11px] text-gray-300 mt-0.5">
                <span className="text-emerald-400 font-semibold flex items-center gap-1">
                  Online now
                  <span className="text-cyan-400 tracking-widest text-[10px] animate-pulse">•||•</span>
                </span>
                <div className="flex items-center gap-1">
                  <span className="px-1.5 py-0.2 rounded-md bg-purple-500/20 text-purple-300 text-[10px] font-bold border border-purple-500/30">
                    👑 Premium
                  </span>
                  <span className="px-1.5 py-0.2 rounded-md bg-blue-500/20 text-blue-300 text-[10px] font-bold border border-blue-500/30">
                    ⭐ Creator
                  </span>
                  <span className="px-1.5 py-0.2 rounded-md bg-white/5 text-gray-300 text-[10px] font-semibold">
                    Lvl. 48
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Right Action Icons: Phone, Video, Search, More */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => toast.success('Connecting secure HD voice call... 📞')}
              className="w-8 h-8 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 flex items-center justify-center text-gray-300 hover:text-white transition-all"
              title="Voice Call"
            >
              <Phone className="w-4 h-4" />
            </button>
            <button
              onClick={() => toast.success('Connecting 4K spatial video call... 📹')}
              className="w-8 h-8 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 flex items-center justify-center text-gray-300 hover:text-white transition-all"
              title="Video Call"
            >
              <Video className="w-4 h-4" />
            </button>
            <button
              onClick={() => toast.info('Search conversation history')}
              className="w-8 h-8 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 flex items-center justify-center text-gray-300 hover:text-white transition-all"
              title="Search"
            >
              <Search className="w-4 h-4" />
            </button>
            <button
              onClick={() => navigate('/settings')}
              className="relative w-8 h-8 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 flex items-center justify-center text-gray-300 hover:text-white transition-all"
              title="More options"
            >
              <MoreVertical className="w-4 h-4" />
              <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-purple-400" />
            </button>
          </div>
        </div>
      </header>

      {/* Pinned Message Banner */}
      <AnimatePresence>
        {showPinned && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="sticky top-[58px] z-30 bg-[#0c102c]/90 backdrop-blur-xl border-b border-purple-500/20 px-4 py-2"
          >
            <div className="max-w-3xl mx-auto flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 text-purple-300 font-semibold truncate">
                <Pin className="w-3.5 h-3.5 text-purple-400 rotate-45 shrink-0" />
                <span className="text-purple-400 font-bold">Pinned:</span>
                <span className="text-gray-200 truncate">Our next trip is confirmed! ✈️🌴</span>
              </div>
              <div className="flex items-center gap-3 shrink-0 ml-2">
                <button
                  onClick={() => toast.info('Viewing pinned trip details')}
                  className="text-purple-400 font-bold hover:underline"
                >
                  View
                </button>
                <button
                  onClick={() => setShowPinned(false)}
                  className="text-gray-400 hover:text-white"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Messages Thread */}
      <main className="relative z-10 flex-1 max-w-3xl w-full mx-auto px-3.5 py-4 space-y-4">
        {/* Date Pill */}
        <div className="flex justify-center my-2">
          <span className="px-3.5 py-1 rounded-full bg-[#0d1330] border border-white/10 text-[11px] font-semibold text-gray-400 shadow-md">
            • Today, May 28 •
          </span>
        </div>

        {/* Message Items */}
        {messages.map((msg) => {
          const isMe = msg.sender === 'me';

          return (
            <div
              key={msg.id}
              className={cn(
                "flex flex-col relative group transition-all",
                isMe ? "items-end" : "items-start"
              )}
            >
              <div className="flex items-end gap-2 max-w-[85%] sm:max-w-[75%]">
                {/* Incoming Avatar */}
                {!isMe && (
                  <div className="relative shrink-0 mb-1">
                    <img
                      src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80"
                      alt="Isabella"
                      className="w-8 h-8 rounded-full object-cover border border-purple-500/40"
                    />
                    <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-400 border border-[#030614]" />
                  </div>
                )}

                {/* Bubble Container */}
                <div className="relative">
                  {/* TEXT MESSAGE */}
                  {msg.type === 'text' && (
                    <div
                      className={cn(
                        "px-4 py-2.5 rounded-2xl text-sm leading-relaxed border transition-all shadow-lg",
                        isMe
                          ? "bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white border-blue-400/30 rounded-br-sm shadow-[0_4px_20px_rgba(37,99,235,0.25)]"
                          : "bg-[#0f1535]/90 text-gray-100 border-white/10 rounded-bl-sm backdrop-blur-md"
                      )}
                    >
                      <p>{msg.text}</p>
                      <div className={cn(
                        "flex items-center gap-1 text-[10px] mt-1 font-medium",
                        isMe ? "justify-end text-blue-200" : "justify-start text-gray-400"
                      )}>
                        <span>{msg.timestamp}</span>
                        {isMe && <CheckCheck className="w-3.5 h-3.5 text-cyan-300" />}
                      </div>
                    </div>
                  )}

                  {/* 4K MEDIA MESSAGE */}
                  {msg.type === 'media' && (
                    <div className="rounded-2xl overflow-hidden border border-white/10 bg-[#0f1535] shadow-2xl max-w-sm">
                      <div className="relative aspect-video group cursor-pointer" onClick={() => toast.info('Playing 4K clip')}>
                        <img
                          src={msg.mediaUrl}
                          alt="media"
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                          <div className="w-12 h-12 rounded-full bg-black/60 backdrop-blur-md border border-white/20 flex items-center justify-center text-white group-hover:scale-110 transition-transform">
                            <Play className="w-5 h-5 fill-white ml-0.5" />
                          </div>
                        </div>
                        <span className="absolute bottom-2.5 left-2.5 px-2 py-0.5 rounded-md bg-black/70 backdrop-blur-md text-[10px] font-bold text-white">
                          {msg.duration}
                        </span>
                        <span className="absolute bottom-2.5 right-2.5 px-2 py-0.5 rounded-md bg-purple-600/80 backdrop-blur-md text-[10px] font-bold text-white border border-purple-400/30">
                          {msg.quality}
                        </span>
                      </div>
                      <div className="p-3">
                        <p className="text-xs font-semibold text-white">{msg.title}</p>
                        <span className="text-[10px] text-gray-400 mt-1 block">{msg.timestamp}</span>
                      </div>
                    </div>
                  )}

                  {/* VOICE NOTE MESSAGE */}
                  {msg.type === 'voice' && (
                    <div className="p-3 rounded-2xl bg-gradient-to-r from-purple-900/70 via-indigo-900/60 to-blue-900/70 border border-purple-500/40 backdrop-blur-xl shadow-xl flex items-center gap-3 min-w-[240px] sm:min-w-[280px]">
                      <button
                        onClick={() => handleToggleVoice(msg.id)}
                        className="w-10 h-10 rounded-full bg-gradient-to-r from-purple-500 to-blue-500 flex items-center justify-center text-white shadow-lg shrink-0 hover:scale-105 transition-transform"
                      >
                        {playingVoiceId === msg.id ? (
                          <Pause className="w-4 h-4 fill-white" />
                        ) : (
                          <Play className="w-4 h-4 fill-white ml-0.5" />
                        )}
                      </button>

                      {/* Interactive Audio Waveform Bars */}
                      <div className="flex-1 flex items-center gap-1 h-8">
                        {msg.waveform.map((height, idx) => {
                          const isPlayed = playingVoiceId === msg.id && (idx / msg.waveform.length) * 100 <= voiceProgress;
                          return (
                            <div
                              key={idx}
                              style={{ height: `${height}%` }}
                              className={cn(
                                "flex-1 rounded-full transition-all duration-150",
                                isPlayed
                                  ? "bg-cyan-400 shadow-[0_0_6px_#22d3ee]"
                                  : "bg-white/30 hover:bg-white/60"
                              )}
                            />
                          );
                        })}
                      </div>

                      {/* Duration, Timestamp & Avatar */}
                      <div className="flex flex-col items-end text-right shrink-0">
                        <span className="text-xs font-bold text-white">{msg.duration}</span>
                        <div className="flex items-center gap-1 text-[10px] text-blue-200 mt-0.5">
                          <span>{msg.timestamp}</span>
                          <CheckCheck className="w-3 h-3 text-cyan-300" />
                        </div>
                      </div>

                      {/* User Avatar with Mic overlay */}
                      <div className="relative shrink-0">
                        <img
                          src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100"
                          alt="Me"
                          className="w-8 h-8 rounded-full object-cover border border-cyan-400"
                        />
                        <span className="absolute -bottom-1 -right-1 p-0.5 rounded-full bg-blue-600 text-white text-[8px]">
                          🎙️
                        </span>
                      </div>
                    </div>
                  )}

                  {/* INTERACTIVE POLL MESSAGE */}
                  {msg.type === 'poll' && (
                    <div className="p-4 rounded-2xl bg-[#0c1230]/90 border border-purple-500/30 backdrop-blur-xl shadow-2xl w-full sm:min-w-[320px]">
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <p className="text-xs font-bold text-purple-400">{msg.author}</p>
                          <h3 className="text-sm font-bold text-white">{msg.question}</h3>
                          <p className="text-[10px] text-gray-400">{msg.subtitle}</p>
                        </div>
                        <button className="text-gray-400 hover:text-white p-1">
                          <MoreVertical className="w-4 h-4" />
                        </button>
                      </div>

                      {/* Poll Options */}
                      <div className="space-y-2.5 my-3">
                        {msg.options.map((opt) => {
                          const isVoted = activePollVotes[msg.id] === opt.id;
                          return (
                            <div
                              key={opt.id}
                              onClick={() => handleVote(msg.id, opt.id)}
                              className={cn(
                                "relative p-3 rounded-xl border cursor-pointer transition-all overflow-hidden flex items-center justify-between",
                                isVoted
                                  ? "bg-purple-900/30 border-purple-500 text-white"
                                  : "bg-white/5 border-white/10 hover:bg-white/10 text-gray-200"
                              )}
                            >
                              {/* Background Percentage Progress Fill */}
                              <div
                                style={{ width: `${opt.percent}%` }}
                                className={cn(
                                  "absolute inset-y-0 left-0 transition-all duration-500 opacity-25",
                                  isVoted ? "bg-gradient-to-r from-purple-500 to-blue-500" : "bg-blue-600"
                                )}
                              />

                              <div className="relative z-10 flex items-center gap-2.5 font-semibold text-xs">
                                <div className={cn(
                                  "w-4 h-4 rounded-full border flex items-center justify-center",
                                  isVoted ? "border-purple-400 bg-purple-500" : "border-gray-400"
                                )}>
                                  {isVoted && <Check className="w-3 h-3 text-white" />}
                                </div>
                                <span>{opt.label}</span>
                              </div>

                              <span className="relative z-10 text-xs font-bold text-gray-300">
                                {opt.percent}%
                              </span>
                            </div>
                          );
                        })}
                      </div>

                      <div className="flex items-center justify-between text-[10px] text-gray-400 border-t border-white/5 pt-2">
                        <span>{msg.totalVotes} votes</span>
                        <span>{msg.timestamp}</span>
                      </div>
                    </div>
                  )}

                  {/* Reaction Badges Container */}
                  <div className={cn(
                    "flex items-center gap-1 mt-1.5",
                    isMe ? "justify-end" : "justify-start"
                  )}>
                    {Object.entries(msg.reactions || {}).map(([emoji, count]) => (
                      <button
                        key={emoji}
                        onClick={() => handleAddReaction(msg.id, emoji)}
                        className="px-2 py-0.5 rounded-full bg-[#12193b] border border-white/10 text-xs flex items-center gap-1 hover:scale-105 transition-transform shadow-md"
                      >
                        <span>{emoji}</span>
                        <span className="text-[10px] font-bold text-gray-300">{count}</span>
                      </button>
                    ))}

                    <button
                      onClick={() => setShowReactionPickerFor(showReactionPickerFor === msg.id ? null : msg.id)}
                      className="w-5 h-5 rounded-full bg-white/5 hover:bg-white/15 border border-white/10 text-gray-400 hover:text-white flex items-center justify-center text-xs transition-colors"
                      title="Add reaction"
                    >
                      +
                    </button>
                  </div>

                  {/* Popover Reaction Picker */}
                  {showReactionPickerFor === msg.id && (
                    <div className="absolute -top-9 z-20 flex items-center gap-1.5 p-1 rounded-full bg-[#0d1433] border border-purple-500/40 shadow-2xl backdrop-blur-xl">
                      {['❤️', '👍', '🔥', '😍', '👏', '🎉'].map((e) => (
                        <button
                          key={e}
                          onClick={() => handleAddReaction(msg.id, e)}
                          className="w-7 h-7 rounded-full hover:bg-white/10 flex items-center justify-center text-sm transition-transform hover:scale-125"
                        >
                          {e}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {/* Laser Unread Messages Divider */}
        <div className="relative flex items-center justify-center my-6">
          <div className="absolute inset-x-0 h-[1px] bg-gradient-to-r from-transparent via-purple-500 to-transparent shadow-[0_0_10px_#a855f7]" />
          <span className="relative z-10 px-4 py-0.5 rounded-full bg-[#090e29] border border-purple-500/40 text-[10px] font-extrabold uppercase tracking-wider text-purple-300 shadow-lg">
            • • • Unread Messages • • •
          </span>
        </div>

        <div ref={messagesEndRef} />
      </main>

      {/* Floating Right-Side AI Action Rail */}
      <aside className="fixed right-3 bottom-28 z-30 flex flex-col gap-2 pointer-events-auto">
        <button
          onClick={() => {
            setInputText('Sure, count me in for the trip! 🌴✈️');
            toast.success('AI reply drafted! ✨');
          }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-purple-600/90 to-pink-600/90 border border-purple-400/40 text-xs font-bold text-white shadow-xl hover:scale-105 transition-all"
        >
          <Sparkles className="w-3.5 h-3.5 text-amber-300" />
          <span>AI Reply</span>
          <span className="px-1 py-0.2 rounded bg-amber-400 text-black text-[9px] font-black uppercase">
            New
          </span>
        </button>

        <button
          onClick={() => toast.info('Auto-translating conversation...')}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#0e1438]/90 border border-white/10 text-xs font-semibold text-gray-200 hover:text-white shadow-lg hover:bg-white/10 transition-all"
        >
          <Globe className="w-3.5 h-3.5 text-blue-400" />
          <span>Translate</span>
        </button>

        <button
          onClick={() => toast.info('Generating thread summary...')}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#0e1438]/90 border border-white/10 text-xs font-semibold text-gray-200 hover:text-white shadow-lg hover:bg-white/10 transition-all"
        >
          <FileText className="w-3.5 h-3.5 text-emerald-400" />
          <span>Summary</span>
        </button>

        <button
          onClick={() => toast.success('Reminder set for trip confirmation! 🔔')}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#0e1438]/90 border border-white/10 text-xs font-semibold text-gray-200 hover:text-white shadow-lg hover:bg-white/10 transition-all"
        >
          <Bell className="w-3.5 h-3.5 text-amber-400" />
          <span>Remind Me</span>
        </button>
      </aside>

      {/* Bottom Input Section */}
      <footer className="sticky bottom-0 z-40 bg-[#060A1D]/95 backdrop-blur-2xl border-t border-white/[0.08] px-3.5 py-3">
        <div className="max-w-3xl mx-auto space-y-2">
          {/* Main Input Form */}
          <form onSubmit={handleSend} className="flex items-center gap-2">
            {/* Plus Drawer Toggle Button */}
            <button
              type="button"
              onClick={() => setShowDrawer(!showDrawer)}
              className={cn(
                "w-10 h-10 rounded-full border flex items-center justify-center transition-all shrink-0 shadow-lg",
                showDrawer
                  ? "bg-purple-600 border-purple-400 text-white rotate-45"
                  : "bg-white/5 border-white/10 hover:bg-white/10 text-gray-300"
              )}
              title="Add attachments"
            >
              <Plus className="w-5 h-5 transition-transform" />
            </button>

            {/* Input Bar with Embedded Tools */}
            <div className="flex-1 flex items-center bg-[#0d1330] border border-white/10 focus-within:border-purple-500/50 rounded-2xl px-3 py-1.5 shadow-inner">
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="Type a message..."
                className="flex-1 bg-transparent text-sm text-white placeholder-gray-500 focus:outline-none"
              />

              <div className="flex items-center gap-1.5 text-gray-400 shrink-0">
                <button
                  type="button"
                  onClick={() => setInputText((prev) => prev + ' 😊')}
                  className="p-1 hover:text-white transition-colors"
                >
                  <Smile className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => toast.info('Sticker drawer')}
                  className="p-1 hover:text-white transition-colors text-xs font-bold"
                >
                  👾
                </button>
                <button
                  type="button"
                  onClick={() => toast.info('Opening camera...')}
                  className="p-1 hover:text-white transition-colors"
                >
                  <Camera className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => toast.info('Recording voice note... 🎙️')}
                  className="p-1 hover:text-white transition-colors"
                >
                  <Mic className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Glowing Magenta / Blue Gradient Send Button */}
            <button
              type="submit"
              disabled={!inputText.trim()}
              className={cn(
                "w-10 h-10 rounded-full flex items-center justify-center transition-all shrink-0 shadow-lg",
                inputText.trim()
                  ? "bg-gradient-to-r from-purple-500 via-indigo-500 to-blue-500 text-white shadow-[0_0_15px_rgba(168,85,247,0.5)] hover:scale-105 cursor-pointer"
                  : "bg-white/10 text-gray-500 cursor-not-allowed"
              )}
            >
              <Send className="w-4 h-4 ml-0.5" />
            </button>
          </form>

          {/* Expandable Neon Features Drawer (2 Rows) */}
          <AnimatePresence>
            {showDrawer && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="pt-3 pb-2 overflow-hidden"
              >
                <div className="grid grid-cols-6 gap-2 text-center text-[10px] font-semibold text-gray-300">
                  {/* Row 1 */}
                  <button
                    onClick={() => { setShowDrawer(false); toast.info('Upload image or video'); }}
                    className="flex flex-col items-center gap-1.5 p-2 rounded-2xl bg-white/5 hover:bg-purple-600/20 border border-white/10 hover:border-purple-500/40 transition-all group"
                  >
                    <div className="w-8 h-8 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                      <ImageIcon className="w-4 h-4" />
                    </div>
                    <span>Gallery</span>
                  </button>

                  <button
                    onClick={() => { setShowDrawer(false); toast.info('Capture instant photo'); }}
                    className="flex flex-col items-center gap-1.5 p-2 rounded-2xl bg-white/5 hover:bg-cyan-600/20 border border-white/10 hover:border-cyan-500/40 transition-all group"
                  >
                    <div className="w-8 h-8 rounded-xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                      <Camera className="w-4 h-4" />
                    </div>
                    <span>Camera</span>
                  </button>

                  <button
                    onClick={() => { setShowDrawer(false); toast.info('Attach PDF or Document'); }}
                    className="flex flex-col items-center gap-1.5 p-2 rounded-2xl bg-white/5 hover:bg-blue-600/20 border border-white/10 hover:border-blue-500/40 transition-all group"
                  >
                    <div className="w-8 h-8 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                      <FileText className="w-4 h-4" />
                    </div>
                    <span>File</span>
                  </button>

                  <button
                    onClick={() => { setShowDrawer(false); toast.info('Share live GPS location'); }}
                    className="flex flex-col items-center gap-1.5 p-2 rounded-2xl bg-white/5 hover:bg-pink-600/20 border border-white/10 hover:border-pink-500/40 transition-all group"
                  >
                    <div className="w-8 h-8 rounded-xl bg-pink-500/20 text-pink-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                      <MapPin className="w-4 h-4" />
                    </div>
                    <span>Location</span>
                  </button>

                  <button
                    onClick={() => { setShowDrawer(false); toast.info('Share contact card'); }}
                    className="flex flex-col items-center gap-1.5 p-2 rounded-2xl bg-white/5 hover:bg-cyan-600/20 border border-white/10 hover:border-cyan-500/40 transition-all group"
                  >
                    <div className="w-8 h-8 rounded-xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                      <UserIcon className="w-4 h-4" />
                    </div>
                    <span>Contact</span>
                  </button>

                  <button
                    onClick={() => {
                      setShowDrawer(false);
                      toast.success('Poll creator opened 📊');
                    }}
                    className="flex flex-col items-center gap-1.5 p-2 rounded-2xl bg-white/5 hover:bg-purple-600/20 border border-white/10 hover:border-purple-500/40 transition-all group"
                  >
                    <div className="w-8 h-8 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                      <BarChart2 className="w-4 h-4" />
                    </div>
                    <span>Poll</span>
                  </button>

                  {/* Row 2 */}
                  <button
                    onClick={() => {
                      setShowDrawer(false);
                      setShowGiftModal(true);
                    }}
                    className="flex flex-col items-center gap-1.5 p-2 rounded-2xl bg-white/5 hover:bg-amber-600/20 border border-white/10 hover:border-amber-500/40 transition-all group"
                  >
                    <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                      <Star className="w-4 h-4" />
                    </div>
                    <span>Coin Gift</span>
                  </button>

                  <button
                    onClick={() => { setShowDrawer(false); toast.info('Schedule send'); }}
                    className="flex flex-col items-center gap-1.5 p-2 rounded-2xl bg-white/5 hover:bg-pink-600/20 border border-white/10 hover:border-pink-500/40 transition-all group"
                  >
                    <div className="w-8 h-8 rounded-xl bg-pink-500/20 text-pink-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                      <Calendar className="w-4 h-4" />
                    </div>
                    <span>Schedule</span>
                  </button>

                  <button
                    onClick={() => { setShowDrawer(false); toast.info('HD Spatial Voice Recorder'); }}
                    className="flex flex-col items-center gap-1.5 p-2 rounded-2xl bg-white/5 hover:bg-purple-600/20 border border-white/10 hover:border-purple-500/40 transition-all group"
                  >
                    <div className="w-8 h-8 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                      <Volume2 className="w-4 h-4" />
                    </div>
                    <span>Voice Note</span>
                  </button>

                  <button
                    onClick={() => { setShowDrawer(false); toast.info('Giphy integration'); }}
                    className="flex flex-col items-center gap-1.5 p-2 rounded-2xl bg-white/5 hover:bg-indigo-600/20 border border-white/10 hover:border-indigo-500/40 transition-all group"
                  >
                    <div className="w-8 h-8 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center font-bold text-xs group-hover:scale-110 transition-transform">
                      GIF
                    </div>
                    <span>GIF</span>
                  </button>

                  <button
                    onClick={() => { setShowDrawer(false); toast.info('Share soundtrack or audio loop'); }}
                    className="flex flex-col items-center gap-1.5 p-2 rounded-2xl bg-white/5 hover:bg-purple-600/20 border border-white/10 hover:border-purple-500/40 transition-all group"
                  >
                    <div className="w-8 h-8 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                      <Music className="w-4 h-4" />
                    </div>
                    <span>Music</span>
                  </button>

                  <button
                    onClick={() => { setShowDrawer(false); toast.info('More extensions'); }}
                    className="flex flex-col items-center gap-1.5 p-2 rounded-2xl bg-white/5 hover:bg-cyan-600/20 border border-white/10 hover:border-cyan-500/40 transition-all group"
                  >
                    <div className="w-8 h-8 rounded-xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                      <Plus className="w-4 h-4" />
                    </div>
                    <span>More</span>
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ARVDOUL Luminous Footer Brand Pill */}
          <div className="flex items-center justify-between text-[10px] text-gray-500 pt-1">
            <span className="flex items-center gap-1 text-purple-400/80 font-bold">
              <Sparkles className="w-3 h-3" /> E2EE
            </span>
            <span className="font-extrabold tracking-widest text-purple-300/60 uppercase">
              ARVDOUL
            </span>
            <span className="flex items-center gap-1 text-gray-400">
              <Lock className="w-3 h-3 text-emerald-400" /> Protected
            </span>
          </div>
        </div>
      </footer>

      {/* Gift Modal */}
      <AnimatePresence>
        {showGiftModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-sm rounded-3xl bg-[#0c1230] border border-purple-500/30 p-6 space-y-4 shadow-2xl text-center"
            >
              <div className="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-tr from-amber-500 to-purple-600 flex items-center justify-center text-white shadow-xl">
                <Gift className="w-7 h-7" />
              </div>
              <h3 className="font-bold text-lg text-white">Send Creator Gift</h3>
              <p className="text-xs text-gray-400">
                Reward Isabella Morgan directly with Arvdoul Coins to support her content!
              </p>

              <div className="grid grid-cols-3 gap-2 my-2">
                {[100, 250, 500, 1000, 2500, 5000].map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => setGiftAmount(amt)}
                    className={cn(
                      "py-2 rounded-xl text-xs font-bold border transition-all",
                      giftAmount === amt
                        ? "bg-purple-600 border-purple-400 text-white shadow-lg"
                        : "bg-white/5 border-white/10 text-gray-300 hover:bg-white/10"
                    )}
                  >
                    🪙 {amt}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowGiftModal(false)}
                  className="flex-1 py-2.5 rounded-xl bg-white/10 text-xs font-bold text-gray-300 hover:bg-white/20"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowGiftModal(false);
                    const giftMsg = {
                      id: `msg-gift-${Date.now()}`,
                      sender: 'me',
                      type: 'text',
                      text: `🎁 Sent ${giftAmount} Creator Coins to Isabella!`,
                      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                      status: 'read',
                      reactions: { '❤️': 1, '🔥': 2 },
                    };
                    setMessages((prev) => [...prev, giftMsg]);
                    toast.success(`Sent ${giftAmount} Coins! 🎁`);
                  }}
                  className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-purple-600 text-xs font-bold text-white shadow-lg"
                >
                  Send 🪙 {giftAmount}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
