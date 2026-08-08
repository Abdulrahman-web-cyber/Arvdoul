/**
 * src/screens/MessagingScreen.jsx - ARVDOUL MASTER MESSAGES & INBOX HUB
 * 
 * 100% Pixel-perfect replica of the Arvdoul Messages Screenshots (Image 2 & Image 3)
 * Featuring:
 * - Brand Header with Logo / Online User Avatar, Search, AI Sparkles & New Message + Button
 * - Universal Search Bar with Filter Sliders
 * - Categorized Filter Pills (All, Unread, Groups, Personal, Channels, Archived)
 * - Pinned Carousel with Typing Indicators, Audio badges, and unread counters
 * - Rich Conversation List Items with Voice Waveforms, Media Thumbnails, PDF badges, Mute / Pin icons, and Unread counts
 * - Floating Glowing Cosmic Message FAB
 * - Integrated BottomNav & real message transitions
 */

import React, { useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { cn } from '../lib/utils';
import {
  Search, SlidersHorizontal, Plus, Sparkles, Pin, BellOff,
  CheckCircle2, Volume2, Mic, Image as ImageIcon, FileText,
  Users, User, Radio, Archive, MessageSquare, ChevronRight,
  MoreVertical, CheckCheck, Flame, Phone, Video
} from 'lucide-react';
import BottomNav from '../components/Shared/BottomNav';

// Pinned Conversations data matching the exact screenshot
const PINNED_ITEMS = [
  {
    id: 'isabella',
    name: 'Isabella Morgan',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
    verified: true,
    typing: true,
    unread: null,
    type: 'direct',
    badge: '👑',
  },
  {
    id: 'design-squad',
    name: 'Design Squad',
    avatar: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=150',
    isGroup: true,
    lastSender: 'Alex',
    subtitle: 'Nice!',
    unread: 12,
    type: 'group',
  },
  {
    id: 'david-lee',
    name: 'David Lee',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150',
    verified: true,
    isVoice: true,
    duration: '0:18',
    unread: null,
    type: 'direct',
  },
  {
    id: 'family',
    name: 'Family',
    avatar: 'https://images.unsplash.com/photo-1511895426328-dc8714191300?w=150',
    isGroup: true,
    lastSender: 'Mom',
    subtitle: 'Dinner at 7?',
    unread: 5,
    type: 'group',
  },
  {
    id: 'crypto-hunters',
    name: 'Crypto Hunters',
    avatar: 'https://images.unsplash.com/photo-1622979135225-d2ba269bc1df?w=150',
    isCrypto: true,
    lastSender: 'Alex',
    subtitle: 'BTC update!',
    unread: 23,
    type: 'group',
  },
];

// Master Conversation List matching the screenshots
const CONVERSATIONS_DATA = [
  {
    id: 'sophia',
    name: 'Sophia Martinez',
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150',
    verified: true,
    preview: 'Hey! Are we still on for tomorrow? 😊',
    time: '9:41 AM',
    unread: 3,
    muted: true,
    category: 'personal',
    activeDot: false,
  },
  {
    id: 'project-x',
    name: 'Project X',
    avatar: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=150',
    verified: true,
    isLogo: true,
    preview: 'John: Here is the latest update',
    hasAttachment: 'PDF',
    time: '9:32 AM',
    unread: 8,
    category: 'groups',
    activeDot: true,
  },
  {
    id: 'michael-brown',
    name: 'Michael Brown',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150',
    isVoiceMessage: true,
    voiceDuration: '0:28',
    time: '9:21 AM',
    unread: 2,
    category: 'personal',
    waveform: [20, 45, 65, 30, 85, 95, 40, 75, 90, 50, 70, 35, 80, 100, 60, 45, 75, 35, 20, 40, 30, 50, 20, 60],
  },
  {
    id: 'weekend-plans',
    name: 'Weekend Plans',
    avatar: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=150',
    isGroup: true,
    preview: "Emma: Can't wait! 🔥",
    time: 'Yesterday',
    unread: 12,
    muted: true,
    category: 'groups',
    activeDot: true,
  },
  {
    id: 'emma-wilson',
    name: 'Emma Wilson',
    avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150',
    hasPhoto: true,
    photoPreview: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=150',
    preview: 'Photo',
    time: 'Yesterday',
    unread: 1,
    category: 'personal',
  },
  {
    id: 'crypto-hunters-list',
    name: 'Crypto Hunters',
    avatar: 'https://images.unsplash.com/photo-1622979135225-d2ba269bc1df?w=150',
    verified: true,
    isCrypto: true,
    preview: 'Alex: Bitcoin just broke $70K! 🚀',
    time: 'Tue',
    unread: 23,
    category: 'channels',
    activeDot: true,
  },
  {
    id: 'daniel-carter',
    name: 'Daniel Carter',
    avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150',
    preview: 'Thanks for the help! 🙌',
    time: 'Tue',
    unread: 0,
    pinned: true,
    category: 'personal',
  },
  {
    id: 'travel-lovers',
    name: 'Travel Lovers',
    avatar: 'https://images.unsplash.com/photo-1506929562872-bb421503ef21?w=150',
    verified: true,
    isGroup: true,
    preview: 'Sophie: Bali next month? 🌴🌊',
    time: 'Mon',
    unread: 6,
    category: 'groups',
    activeDot: true,
  },
];

const FILTER_TABS = [
  { id: 'all', label: 'All', icon: '⊞' },
  { id: 'unread', label: 'Unread', dot: true },
  { id: 'groups', label: 'Groups', icon: Users },
  { id: 'personal', label: 'Personal', icon: User },
  { id: 'channels', label: 'Channels', icon: Radio },
  { id: 'archived', label: 'Archived', icon: Archive },
];

export default function MessagingScreen() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { theme } = useTheme();

  const [activeFilter, setActiveFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [conversations, setConversations] = useState(CONVERSATIONS_DATA);
  const [showSearchFilters, setShowSearchFilters] = useState(false);

  // Filter conversations
  const filteredConversations = useMemo(() => {
    return conversations.filter((item) => {
      // Search matching
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = item.name.toLowerCase().includes(q);
        const matchesPreview = item.preview?.toLowerCase().includes(q);
        if (!matchesName && !matchesPreview) return false;
      }

      // Filter tabs
      if (activeFilter === 'unread') return item.unread > 0;
      if (activeFilter === 'groups') return item.category === 'groups';
      if (activeFilter === 'personal') return item.category === 'personal';
      if (activeFilter === 'channels') return item.category === 'channels';
      if (activeFilter === 'archived') return item.category === 'archived';

      return true;
    });
  }, [conversations, searchQuery, activeFilter]);

  return (
    <div className="min-h-screen bg-[#030614] text-white flex flex-col justify-between select-none relative overflow-x-hidden font-sans pb-24">
      {/* Background Starry Atmosphere */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-0 right-1/4 w-96 h-96 bg-purple-900/15 rounded-full blur-3xl" />
        <div className="absolute bottom-20 left-10 w-96 h-96 bg-blue-900/15 rounded-full blur-3xl" />
      </div>

      {/* Main Screen Content */}
      <div className="relative z-10 max-w-3xl w-full mx-auto px-4 pt-3">
        {/* Top Header Bar */}
        <header className="flex items-center justify-between py-2">
          {/* Left: User Avatar with Luminous Gradient Ring + Brand Title */}
          <div className="flex items-center gap-3">
            <div
              className="relative cursor-pointer"
              onClick={() => navigate('/profile')}
            >
              <div className="w-12 h-12 rounded-full p-[2px] bg-gradient-to-tr from-purple-500 via-pink-500 to-cyan-400 shadow-[0_0_16px_rgba(168,85,247,0.35)]">
                <img
                  src={user?.photoURL || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150"}
                  alt="My Profile"
                  className="w-full h-full rounded-full object-cover border-2 border-[#030614]"
                />
              </div>
              <span className="absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full bg-emerald-400 border-2 border-[#030614]" />
            </div>

            <div>
              <div className="flex items-center gap-1.5">
                <h1 className="font-extrabold text-xl tracking-tight text-white font-display">
                  Messages
                </h1>
                <span className="w-2 h-2 rounded-full bg-purple-400 animate-pulse" />
              </div>
              <p className="text-[11px] text-gray-400 font-medium">
                Connect <span className="text-purple-400">•</span> Share <span className="text-blue-400">•</span> Grow
              </p>
            </div>
          </div>

          {/* Right Action Icons: Search, AI Sparkles, New Chat + */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                const searchEl = document.getElementById('message-search-input');
                searchEl?.focus();
              }}
              className="w-9 h-9 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 flex items-center justify-center text-gray-300 hover:text-white transition-all shadow-md"
              title="Search"
            >
              <Search className="w-4 h-4" />
            </button>

            <button
              onClick={() => {
                toast.success('ARVDOUL AI Intelligence Hub connected! ✨');
              }}
              className="w-9 h-9 rounded-full bg-gradient-to-tr from-purple-600/60 to-blue-600/60 border border-purple-400/30 hover:scale-105 flex items-center justify-center text-white transition-all shadow-[0_0_12px_rgba(168,85,247,0.3)]"
              title="AI Assistant"
            >
              <Sparkles className="w-4 h-4 text-amber-300" />
            </button>

            <button
              onClick={() => {
                navigate('/messages/isabella');
                toast.success('Started new encrypted conversation');
              }}
              className="w-9 h-9 rounded-full bg-gradient-to-tr from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 text-white flex items-center justify-center shadow-lg shadow-purple-500/25 transition-all hover:scale-105"
              title="New Message"
            >
              <Plus className="w-5 h-5" />
            </button>
          </div>
        </header>

        {/* Universal Search Bar with Filter Sliders */}
        <div className="my-3 relative">
          <div className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-2xl bg-[#090e29]/90 border border-white/10 focus-within:border-purple-500/50 shadow-inner">
            <Search className="w-4 h-4 text-gray-400 shrink-0" />
            <input
              id="message-search-input"
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search messages, people, groups..."
              className="flex-1 bg-transparent text-xs text-white placeholder-gray-500 focus:outline-none"
            />
            <button
              onClick={() => setShowSearchFilters(!showSearchFilters)}
              className={cn(
                "p-1 rounded-lg transition-colors",
                showSearchFilters ? "text-purple-400 bg-purple-500/20" : "text-gray-400 hover:text-white"
              )}
            >
              <SlidersHorizontal className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Categorized Filter Pills */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
          {FILTER_TABS.map((tab) => {
            const isActive = activeFilter === tab.id;
            const Icon = typeof tab.icon === 'function' ? tab.icon : null;

            return (
              <button
                key={tab.id}
                onClick={() => setActiveFilter(tab.id)}
                className={cn(
                  "px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 border",
                  isActive
                    ? "bg-gradient-to-r from-purple-600 to-indigo-600 text-white border-purple-400/40 shadow-[0_0_12px_rgba(168,85,247,0.4)]"
                    : "bg-[#090e29]/80 text-gray-300 border-white/10 hover:bg-white/10"
                )}
              >
                {tab.id === 'all' && <span className="text-sm">⊞</span>}
                {tab.dot && <span className="w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_6px_#22d3ee]" />}
                {Icon && <Icon className="w-3.5 h-3.5" />}
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Pinned Section */}
        <div className="mt-4 mb-2">
          <div className="flex items-center justify-between mb-2.5 px-1">
            <div className="flex items-center gap-1.5 text-xs font-bold text-purple-400 uppercase tracking-wider">
              <Pin className="w-3.5 h-3.5 rotate-45" />
              <span>Pinned</span>
            </div>
            <button
              onClick={() => toast.info('Managing pinned conversations')}
              className="text-xs font-semibold text-gray-400 hover:text-purple-400 flex items-center gap-0.5 transition-colors"
            >
              <span>View all</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Horizontal Pinned Stories/Conversations Carousel */}
          <div className="flex items-center gap-2.5 overflow-x-auto no-scrollbar pb-2">
            {PINNED_ITEMS.map((item) => (
              <div
                key={item.id}
                onClick={() => navigate(`/messages/${item.id}`)}
                className="w-24 shrink-0 p-2.5 rounded-2xl bg-[#090e29]/80 border border-white/10 hover:border-purple-500/40 transition-all flex flex-col items-center text-center cursor-pointer group shadow-lg relative"
              >
                {/* Avatar with Glow Ring and Pin Badge */}
                <div className="relative mb-2">
                  <div className="w-12 h-12 rounded-full p-[2px] bg-gradient-to-tr from-purple-500 via-pink-500 to-cyan-400 shadow-[0_0_12px_rgba(168,85,247,0.3)]">
                    <img
                      src={item.avatar}
                      alt={item.name}
                      className="w-full h-full rounded-full object-cover border-2 border-[#090e29]"
                    />
                  </div>

                  {/* Purple Pin Star Badge */}
                  <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-purple-600 text-white flex items-center justify-center text-[9px] shadow-md border border-[#090e29]">
                    ★
                  </span>
                </div>

                {/* Name */}
                <div className="flex items-center gap-1 max-w-full">
                  <p className="text-[11px] font-bold text-white truncate">
                    {item.name}
                  </p>
                  {item.verified && (
                    <CheckCircle2 className="w-2.5 h-2.5 text-blue-400 shrink-0" />
                  )}
                </div>

                {/* Subtitle / Status */}
                {item.typing ? (
                  <p className="text-[10px] text-purple-400 font-semibold mt-0.5 animate-pulse">
                    Typing...
                  </p>
                ) : item.isVoice ? (
                  <p className="text-[10px] text-gray-400 mt-0.5 flex items-center gap-0.5 truncate">
                    <Mic className="w-2.5 h-2.5 text-purple-400" />
                    <span>{item.duration}</span>
                  </p>
                ) : (
                  <p className="text-[10px] text-gray-400 mt-0.5 truncate w-full">
                    {item.lastSender ? `${item.lastSender}: ${item.subtitle}` : item.subtitle}
                  </p>
                )}

                {/* Unread badge pill if present */}
                {item.unread && (
                  <span className="absolute top-1.5 left-1.5 px-1.5 py-0.2 rounded-full bg-purple-600 text-white text-[9px] font-black shadow-md">
                    {item.unread}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Master Conversation List */}
        <div className="mt-3 space-y-2">
          {filteredConversations.map((item) => (
            <div
              key={item.id}
              onClick={() => navigate(`/messages/${item.id}`)}
              className="p-3 rounded-2xl bg-[#090e29]/75 border border-white/10 hover:border-purple-500/40 hover:bg-[#0d143a]/90 transition-all flex items-center justify-between cursor-pointer group shadow-md"
            >
              {/* Left: Avatar with optional active dot + Text content */}
              <div className="flex items-center gap-3 min-w-0 flex-1">
                {/* Active status blue dot on the side */}
                {item.activeDot && (
                  <span className="w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_6px_#3b82f6] shrink-0" />
                )}

                {/* Avatar with Glow Ring */}
                <div className="relative shrink-0">
                  <div className="w-12 h-12 rounded-full p-[1.5px] bg-gradient-to-tr from-purple-500/60 to-pink-500/60">
                    <img
                      src={item.avatar}
                      alt={item.name}
                      className="w-full h-full rounded-full object-cover border-2 border-[#090e29]"
                    />
                  </div>
                </div>

                {/* Message Details */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <h3 className="font-bold text-sm text-white truncate group-hover:text-purple-300 transition-colors">
                      {item.name}
                    </h3>
                    {item.verified && (
                      <CheckCircle2 className="w-3 h-3 text-blue-400 shrink-0" />
                    )}
                  </div>

                  {/* Message Preview or Audio Waveform */}
                  {item.isVoiceMessage ? (
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-gray-400 flex items-center gap-1">
                        <Mic className="w-3 h-3 text-purple-400" />
                        <span>Voice message • {item.voiceDuration}</span>
                      </span>
                      {/* Audio visualizer preview */}
                      <div className="hidden sm:flex items-center gap-0.5 h-3 w-20">
                        {item.waveform?.slice(0, 12).map((h, i) => (
                          <div
                            key={i}
                            style={{ height: `${h}%` }}
                            className="flex-1 bg-purple-500/60 rounded-full"
                          />
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 mt-0.5 text-xs text-gray-400 truncate">
                      <p className="truncate">{item.preview}</p>
                      {item.hasAttachment && (
                        <span className="px-1.5 py-0.2 rounded bg-purple-500/20 text-purple-300 text-[10px] font-bold border border-purple-500/30">
                          {item.hasAttachment}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Right: Time, Photo Preview, Mute Icon, Unread Badge, Pin */}
              <div className="flex flex-col items-end gap-1.5 shrink-0 ml-3">
                <span className="text-[11px] text-gray-400 font-medium">{item.time}</span>

                <div className="flex items-center gap-1.5">
                  {/* Photo thumbnail preview */}
                  {item.hasPhoto && (
                    <img
                      src={item.photoPreview}
                      alt="Thumbnail"
                      className="w-10 h-7 rounded-lg object-cover border border-white/10 shadow-sm"
                    />
                  )}

                  {/* Muted icon */}
                  {item.muted && (
                    <BellOff className="w-3.5 h-3.5 text-gray-500" />
                  )}

                  {/* Pin icon */}
                  {item.pinned && (
                    <Pin className="w-3.5 h-3.5 text-purple-400 rotate-45" />
                  )}

                  {/* Unread Counter Pill */}
                  {item.unread > 0 && (
                    <span className="px-2 py-0.5 rounded-full bg-purple-600 text-white text-[11px] font-black shadow-[0_0_10px_rgba(168,85,247,0.4)]">
                      {item.unread}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Floating Action Button (FAB) for New Conversation */}
      <button
        onClick={() => {
          navigate('/messages/isabella');
          toast.success('Direct messaging channel ready! 💬');
        }}
        className="fixed right-5 bottom-20 z-40 w-14 h-14 rounded-full bg-gradient-to-tr from-purple-600 via-indigo-600 to-blue-500 text-white flex items-center justify-center shadow-[0_0_25px_rgba(168,85,247,0.6)] hover:scale-110 transition-transform active:scale-95"
        title="Compose New Message"
      >
        <MessageSquare className="w-6 h-6 fill-white/20" />
      </button>

      {/* Bottom Navigation */}
      <BottomNav />
    </div>
  );
}
