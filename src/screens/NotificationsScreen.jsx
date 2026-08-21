// src/screens/NotificationsScreen.jsx - ARVDOUL ULTIMATE NOTIFICATIONS SCREEN
// Pixel-perfect replica of Arvdoul Luxury Design System with real-time Firestore synchronization
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { cn } from '../lib/utils';
import {
  Bell, Search, SlidersHorizontal, CheckCircle2, Settings,
  Sparkles, Check, X, Heart, MessageCircle, Gift, Users,
  AtSign, Eye, Radio, ChevronRight, ChevronDown, Clock,
  ArrowRight, ShieldCheck, DollarSign, Flame, Award,
  Home, MessageSquare, Compass, User, RefreshCw
} from 'lucide-react';
import notificationsService from '../services/notificationsService';
import { getMonetizationService } from '../services/monetizationService';
import EmptyState from '../design-system/EmptyState.jsx';
import Button from '../design-system/Button.jsx';
import { Dialog } from '../components/ui/Dialog.jsx';

// Fallback high-fidelity sample notifications matching the exact Arvdoul design
const FILTERS = [
  { id: 'All', label: 'All' },
  { id: 'Messages', label: 'Messages', badge: 8, icon: MessageCircle },
  { id: 'Friends', label: 'Friends', icon: Users },
  { id: 'Mentions', label: 'Mentions', icon: AtSign },
  { id: 'Stories', label: 'Stories', icon: Sparkles },
  { id: 'Coins', label: 'Coins', icon: DollarSign },
  { id: 'Live', label: 'Live', icon: Radio },
  { id: 'System', label: 'System', icon: Settings },
];

export default function NotificationsScreen() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { theme } = useTheme();
  const isDark = theme !== 'light';

  const [activeFilter, setActiveFilter] = useState('All');
  const [notifications, setNotifications] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  const [friendActions, setFriendActions] = useState({}); // { notifId: 'accepted' | 'declined' }
  const [expandedSections, setExpandedSections] = useState({
    Now: true,
    Today: true,
    Yesterday: true,
    Earlier: false
  });
  const [giftModal, setGiftModal] = useState(null);

  // Load real Firestore notifications if user is authenticated
  useEffect(() => {
    if (!user?.uid) return;
    let unsub;
    try {
      unsub = notificationsService.subscribeToUserNotifications(user.uid, (firestoreNotifs) => {
        if (Array.isArray(firestoreNotifs) && firestoreNotifs.length > 0) {
          // Merge real notifications with design system items
          setNotifications((prev) => {
            const formatted = firestoreNotifs.map((fn, idx) => ({
              id: fn.id || `fn-${idx}`,
              category: fn.type?.includes('message') ? 'Messages' : fn.type?.includes('friend') ? 'Friends' : fn.type?.includes('coin') ? 'Coins' : 'All',
              type: fn.type || 'system',
              timeGroup: 'Now',
              user: {
                name: fn.senderName || fn.title || 'Arvdoul User',
                username: fn.senderUsername || 'user',
                avatar: fn.senderAvatar || '/assets/default-profile.png',
                verified: true,
              },
              message: fn.body || fn.message || 'interacted with your content.',
              timestamp: 'Just now',
              unread: !fn.read,
            }));
            return formatted;
          });
        }
      });
    } catch (err) {
      console.warn('Notifications stream warning:', err);
    }
    return () => {
      if (typeof unsub === 'function') unsub();
    };
  }, [user?.uid]);

  // Handle Mark All Read
  const handleMarkAllRead = async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, unread: false })));
    toast.success('All notifications marked as read');
    if (user?.uid) {
      try {
        await notificationsService.markAllAsRead(user.uid);
      } catch (err) {
        console.warn(err);
      }
    }
  };

  // Handle Mark Single Item Read
  const handleMarkRead = (id) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, unread: false } : n))
    );
  };

  // Handle Friend Request Action
  const handleFriendRequest = async (notifId, action, targetUser) => {
    setFriendActions((prev) => ({ ...prev, [notifId]: action }));
    handleMarkRead(notifId);
    
    if (action === 'accepted') {
      toast.success(`You are now friends with ${targetUser.name}! 🎉`);
    } else {
      toast.info(`Declined friend request from ${targetUser.name}`);
    }
  };

  // Handle Thank Creator for Coins
  const handleThankCreator = async (notif) => {
    toast.success(`Sent a special Thank You note to ${notif.user.name}! 💜`);
    handleMarkRead(notif.id);
  };

  // Filtered Notifications
  const filteredNotifications = useMemo(() => {
    return notifications.filter((notif) => {
      // Category Filter
      if (activeFilter !== 'All') {
        if (activeFilter === 'Messages' && notif.category !== 'Messages' && notif.type !== 'story_reply') return false;
        if (activeFilter === 'Friends' && notif.category !== 'Friends' && notif.type !== 'friend_request') return false;
        if (activeFilter === 'Mentions' && notif.category !== 'Mentions' && notif.type !== 'mention') return false;
        if (activeFilter === 'Stories' && notif.category !== 'Stories' && !notif.type?.includes('story')) return false;
        if (activeFilter === 'Coins' && notif.category !== 'Coins' && !notif.type?.includes('coin')) return false;
        if (activeFilter === 'Live' && notif.category !== 'Live' && notif.type !== 'live_stream') return false;
        if (activeFilter === 'System' && notif.category !== 'System') return false;
      }
      // Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = notif.user?.name?.toLowerCase().includes(q);
        const matchesMsg = notif.message?.toLowerCase().includes(q);
        if (!matchesName && !matchesMsg) return false;
      }
      return true;
    });
  }, [notifications, activeFilter, searchQuery]);

  // Group by TimeGroup
  const groupedNotifications = useMemo(() => {
    const groups = { Now: [], Today: [], Yesterday: [], Earlier: [] };
    filteredNotifications.forEach((n) => {
      const g = n.timeGroup || 'Today';
      if (!groups[g]) groups[g] = [];
      groups[g].push(n);
    });
    return groups;
  }, [filteredNotifications]);

  // Highlights list
  const highlights = useMemo(() => {
    return notifications.filter((n) => n.highlight);
  }, [notifications]);

  const unreadCount = useMemo(() => {
    return notifications.filter((n) => n.unread).length;
  }, [notifications]);

  return (
    <div className={cn(
      "min-h-screen pb-24 select-none",
      isDark ? "bg-[#060814] text-white" : "bg-slate-50 text-slate-900"
    )}>
      {/* Top Header Bar */}
      <header className={cn(
        "sticky top-0 z-40 backdrop-blur-2xl px-5 pt-4 pb-3 border-b transition-colors",
        isDark ? "bg-[#060814]/85 border-white/5" : "bg-white/90 border-slate-200"
      )}>
        <div className="max-w-xl mx-auto flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-black font-display tracking-tight">
                Notifications
              </h1>
              {unreadCount > 0 && (
                <span className="w-2.5 h-2.5 rounded-full bg-violet-500 shadow-arvdoul-glow" />
              )}
            </div>
            <p className="text-xs text-arvdoul-text-secondary mt-0.5">
              Stay updated with what matters to you
            </p>
          </div>

          <div className="flex items-center gap-2">
            {/* Search Icon */}
            <button
              onClick={() => setShowSearch(!showSearch)}
              aria-label="Search notifications"
              className={cn(
                "w-10 h-10 rounded-full flex items-center justify-center transition-all",
                isDark ? "bg-white/5 hover:bg-white/10 text-white/80" : "bg-slate-100 hover:bg-slate-200 text-slate-700"
              )}
            >
              <Search className="w-4 h-4" />
            </button>

            {/* Filter Icon */}
            <button
              onClick={() => setShowFilterDropdown(!showFilterDropdown)}
              aria-label="Filter notifications"
              className={cn(
                "w-10 h-10 rounded-full flex items-center justify-center transition-all relative",
                showFilterDropdown ? "bg-arvdoul-purple text-white shadow-arvdoul-glow" : isDark ? "bg-white/5 hover:bg-white/10 text-white/80" : "bg-slate-100 text-slate-700"
              )}
            >
              <SlidersHorizontal className="w-4 h-4" />
              <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-violet-400" />
            </button>

            {/* Mark All Read */}
            <button
              onClick={handleMarkAllRead}
              title="Mark all as read"
              aria-label="Mark all as read"
              className={cn(
                "w-10 h-10 rounded-full flex items-center justify-center transition-all",
                isDark ? "bg-white/5 hover:bg-white/10 text-white/80" : "bg-slate-100 hover:bg-slate-200 text-slate-700"
              )}
            >
              <CheckCircle2 className="w-4 h-4" />
            </button>

            {/* Settings */}
            <button
              onClick={() => navigate('/settings')}
              aria-label="Notification settings"
              className={cn(
                "w-10 h-10 rounded-full flex items-center justify-center transition-all",
                isDark ? "bg-white/5 hover:bg-white/10 text-white/80" : "bg-slate-100 hover:bg-slate-200 text-slate-700"
              )}
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Collapsible Search Input */}
        <AnimatePresence>
          {showSearch && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="max-w-xl mx-auto pt-3 overflow-hidden"
            >
              <div className={cn(
                "flex items-center gap-2 px-3.5 py-2 rounded-xl border",
                isDark ? "bg-white/5 border-white/10" : "bg-slate-100 border-slate-200"
              )}>
                <Search className="w-4 h-4 text-arvdoul-text-secondary" />
                <input
                  type="text"
                  placeholder="Search in notifications..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="bg-transparent text-xs w-full outline-none"
                  autoFocus
                />
                {searchQuery && (
                  <button onClick={() => setSearchQuery('')}>
                    <X className="w-3.5 h-3.5 text-arvdoul-text-secondary" />
                  </button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Horizontal Category Filters */}
        <div className="max-w-xl mx-auto mt-3.5 flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
          {FILTERS.map((f) => {
            const isActive = activeFilter === f.id;
            return (
              <button
                key={f.id}
                onClick={() => setActiveFilter(f.id)}
                className={cn(
                  "px-4 py-2 rounded-full text-xs font-semibold whitespace-nowrap transition-all duration-200 flex items-center gap-1.5",
                  isActive
                    ? "bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-md shadow-violet-500/25 scale-[1.02]"
                    : isDark
                      ? "bg-white/5 text-white/70 hover:bg-white/10 hover:text-white border border-white/5"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-200"
                )}
              >
                {f.icon && <f.icon className="w-3.5 h-3.5" />}
                {f.label}
                {f.badge && (
                  <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-violet-400/20 text-violet-300">
                    {f.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-xl mx-auto px-4 pt-4 space-y-6">
        {/* Highlights Section */}
        {highlights.length > 0 && activeFilter === 'All' && !searchQuery && (
          <section className="space-y-3">
            <div className="flex items-center justify-between px-1">
              <h2 className="text-xs font-bold uppercase tracking-wider text-arvdoul-text-secondary flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-violet-400" />
                Highlights
              </h2>
              <button className="text-xs font-semibold text-violet-400 hover:text-violet-300 flex items-center gap-0.5">
                View all <ChevronRight className="w-3 h-3" />
              </button>
            </div>

            {/* Highlights Carousel */}
            <div className="grid grid-cols-4 gap-2.5 overflow-x-auto pb-1 no-scrollbar">
              {highlights.map((h) => (
                <div
                  key={`hl-${h.id}`}
                  onClick={() => {
                    if (h.type === 'coin_gift') setGiftModal(h);
                    else if (h.type === 'live_stream') navigate('/live');
                    else if (h.type === 'story_reply') navigate('/stories');
                    else navigate('/profile');
                  }}
                  className={cn(
                    "group relative overflow-hidden rounded-2xl p-3 cursor-pointer transition-all duration-300 border",
                    isDark
                      ? "bg-gradient-to-b from-white/[0.08] to-white/[0.02] border-white/10 hover:border-violet-500/50 hover:shadow-arvdoul-glow"
                      : "bg-white border-slate-200 hover:border-violet-400 shadow-sm"
                  )}
                >
                  {/* Glowing Top Accent */}
                  <div className="absolute top-0 inset-x-0 h-0.5 bg-gradient-to-r from-violet-500 via-indigo-500 to-pink-500 opacity-60 group-hover:opacity-100" />

                  {/* Avatar & Badge */}
                  <div className="relative w-11 h-11 mb-2.5">
                    <img
                      src={h.user.avatar}
                      alt={h.user.name}
                      referrerPolicy="no-referrer"
                      className="w-full h-full rounded-full object-cover ring-2 ring-violet-500/40"
                    />
                    {/* Badge Icon */}
                    {h.type === 'friend_request' && (
                      <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center ring-2 ring-[#060814]">
                        <Users className="w-2.5 h-2.5" />
                      </div>
                    )}
                    {h.type === 'coin_gift' && (
                      <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-amber-500 text-white flex items-center justify-center ring-2 ring-[#060814]">
                        <DollarSign className="w-2.5 h-2.5" />
                      </div>
                    )}
                    {h.type === 'story_reply' && (
                      <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-pink-500 text-white flex items-center justify-center ring-2 ring-[#060814]">
                        <MessageCircle className="w-2.5 h-2.5" />
                      </div>
                    )}
                    {h.type === 'live_stream' && (
                      <div className="absolute -bottom-1 -right-1 px-1 py-0.2 rounded-full bg-rose-600 text-white text-[8px] font-black uppercase ring-2 ring-[#060814] animate-pulse">
                        LIVE
                      </div>
                    )}
                  </div>

                  {/* Text Details */}
                  <p className="text-xs font-bold line-clamp-1 group-hover:text-violet-400 transition-colors">
                    {h.highlight.title}
                  </p>
                  <p className="text-[10px] text-arvdoul-text-secondary line-clamp-2 mt-0.5">
                    {h.highlight.subtitle}
                  </p>
                  <span className="text-[9px] text-arvdoul-text-secondary/70 mt-1 block">
                    {h.highlight.time}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Timeline Groupings: Now, Today, Yesterday */}
        {['Now', 'Today', 'Yesterday', 'Earlier'].map((groupKey) => {
          const items = groupedNotifications[groupKey] || [];
          if (items.length === 0) return null;
          const isExpanded = expandedSections[groupKey];

          return (
            <section key={groupKey} className="space-y-2">
              <button
                onClick={() => setExpandedSections(prev => ({ ...prev, [groupKey]: !prev[groupKey] }))}
                className="w-full flex items-center justify-between px-1 py-1 text-xs font-bold text-arvdoul-text-secondary uppercase tracking-wider group"
              >
                <span>{groupKey}</span>
                <ChevronDown className={cn("w-3.5 h-3.5 transition-transform duration-200", isExpanded ? "rotate-0" : "-rotate-90")} />
              </button>

              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="space-y-2"
                  >
                    {items.map((item) => (
                      <div
                        key={item.id}
                        onClick={() => handleMarkRead(item.id)}
                        className={cn(
                          "relative group overflow-hidden rounded-2xl p-3.5 transition-all duration-200 border flex items-center justify-between gap-3",
                          item.unread
                            ? isDark
                              ? "bg-white/[0.04] border-violet-500/20 hover:border-violet-500/40"
                              : "bg-white border-violet-200 shadow-sm"
                            : isDark
                              ? "bg-white/[0.015] border-white/5 hover:border-white/10"
                              : "bg-slate-50 border-slate-200"
                        )}
                      >
                        {/* Left: Avatar with type icon */}
                        <div className="relative flex-shrink-0">
                          <img
                            src={item.user.avatar}
                            alt={item.user.name}
                            referrerPolicy="no-referrer"
                            className="w-12 h-12 rounded-full object-cover ring-2 ring-violet-500/20"
                          />
                          {/* Type icon on bottom right of avatar */}
                          {item.type === 'friend_request' && (
                            <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center ring-2 ring-[#060814]">
                              <Users className="w-2.5 h-2.5" />
                            </div>
                          )}
                          {item.type === 'coin_gift' && (
                            <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-amber-500 text-white flex items-center justify-center ring-2 ring-[#060814]">
                              <DollarSign className="w-2.5 h-2.5" />
                            </div>
                          )}
                          {item.type === 'story_reply' && (
                            <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-pink-500 text-white flex items-center justify-center ring-2 ring-[#060814]">
                              <MessageCircle className="w-2.5 h-2.5" />
                            </div>
                          )}
                          {item.type === 'post_like' && (
                            <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-rose-500 text-white flex items-center justify-center ring-2 ring-[#060814]">
                              <Heart className="w-2.5 h-2.5 fill-current" />
                            </div>
                          )}
                          {item.type === 'mention' && (
                            <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-indigo-500 text-white flex items-center justify-center ring-2 ring-[#060814]">
                              <AtSign className="w-2.5 h-2.5" />
                            </div>
                          )}
                          {item.type === 'story_view' && (
                            <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-cyan-500 text-white flex items-center justify-center ring-2 ring-[#060814]">
                              <Eye className="w-2.5 h-2.5" />
                            </div>
                          )}
                        </div>

                        {/* Center: Details */}
                        <div className="flex-1 min-w-0 pr-2">
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-xs hover:text-violet-400 transition-colors truncate">
                              {item.user.name}
                            </span>
                            {item.user.verified && (
                              <CheckCircle2 className="w-3.5 h-3.5 text-blue-400 fill-blue-400/20 flex-shrink-0" />
                            )}
                          </div>

                          <p className="text-xs text-arvdoul-text-secondary mt-0.5">
                            {item.message}
                          </p>

                          <span className="text-[10px] text-arvdoul-text-secondary/70 mt-1 block">
                            {item.timestamp}
                          </span>
                        </div>

                        {/* Right: Actions or Media Thumbnails */}
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {/* Friend Request Accept / Decline buttons */}
                          {item.type === 'friend_request' && (
                            <div className="flex items-center gap-1.5">
                              {friendActions[item.id] === 'accepted' ? (
                                <span className="px-3 py-1.5 rounded-xl text-xs font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20">
                                  ✓ Friends
                                </span>
                              ) : friendActions[item.id] === 'declined' ? (
                                <span className="px-3 py-1.5 rounded-xl text-xs font-bold text-slate-400 bg-white/5">
                                  Declined
                                </span>
                              ) : (
                                <>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleFriendRequest(item.id, 'accepted', item.user);
                                    }}
                                    className="px-4 py-1.5 rounded-xl text-xs font-bold bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-md hover:from-violet-500 hover:to-indigo-500 active:scale-95 transition-all"
                                  >
                                    Accept
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleFriendRequest(item.id, 'declined', item.user);
                                    }}
                                    className={cn(
                                      "px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors",
                                      isDark ? "border-white/10 hover:bg-white/10 text-white/70" : "border-slate-300 hover:bg-slate-100 text-slate-600"
                                    )}
                                  >
                                    Decline
                                  </button>
                                </>
                              )}
                            </div>
                          )}

                          {/* Mention Comment Quote */}
                          {item.type === 'mention' && item.commentQuote && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate('/messages');
                              }}
                              className={cn(
                                "px-3 py-1.5 rounded-xl text-[11px] font-medium border flex items-center gap-1 max-w-[150px] truncate transition-colors",
                                isDark ? "bg-white/5 border-white/10 text-white/80 hover:bg-white/10" : "bg-slate-100 border-slate-200 text-slate-700"
                              )}
                            >
                              <span className="truncate">{item.commentQuote}</span>
                              <ChevronRight className="w-3 h-3 flex-shrink-0" />
                            </button>
                          )}

                          {/* Media Thumbnail (Like, Story reply, View, Coin Gift) */}
                          {item.thumbnail && (
                            <div
                              onClick={(e) => {
                                e.stopPropagation();
                                if (item.type === 'coin_gift') setGiftModal(item);
                                else if (item.type?.includes('story')) navigate('/stories');
                                else navigate('/reels');
                              }}
                              className="w-12 h-12 rounded-xl overflow-hidden ring-1 ring-white/10 cursor-pointer hover:ring-violet-500/50 transition-all flex-shrink-0 relative group/thumb"
                            >
                              <img
                                src={item.thumbnail}
                                alt="preview"
                                referrerPolicy="no-referrer"
                                className="w-full h-full object-cover group-hover/thumb:scale-110 transition-transform duration-300"
                              />
                              {item.type === 'coin_gift' && (
                                <div className="absolute inset-0 bg-violet-950/40 flex items-center justify-center">
                                  <Gift className="w-5 h-5 text-amber-300 animate-bounce" />
                                </div>
                              )}
                            </div>
                          )}

                          {/* Unread Purple Glow Indicator Dot */}
                          {item.unread && (
                            <span className="w-2.5 h-2.5 rounded-full bg-violet-500 shadow-arvdoul-glow flex-shrink-0" />
                          )}
                        </div>
                      </div>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </section>
          );
        })}

        {/* Empty State when filters yield no results */}
        {filteredNotifications.length === 0 && (
          <EmptyState
            title="No notifications found"
            description={`There are no notifications under the ${activeFilter} filter at this moment.`}
            icon={<Bell className="w-7 h-7" />}
            action={
              <Button
                variant="primary"
                size="sm"
                onClick={() => { setActiveFilter('All'); setSearchQuery(''); }}
              >
                Reset Filters
              </Button>
            }
          />
        )}
      </main>

      {/* Gift Detail Modal - accessible Dialog (focus trap, Escape, aria-modal) */}
      <Dialog
        isOpen={Boolean(giftModal)}
        onClose={() => setGiftModal(null)}
        title="Creator Coin Gift!"
        size="sm"
      >
        <div className="text-center">
          <div className="w-16 h-16 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center mx-auto mb-3 ring-4 ring-amber-500/30">
            <Gift className="w-8 h-8" aria-hidden="true" />
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            {giftModal?.user?.name || 'A creator'} gifted you {giftModal?.amount || 250} ARVDOUL Coins.
          </p>

          <div className="my-5 p-4 rounded-2xl bg-gradient-to-r from-amber-500/10 to-violet-500/10 border border-amber-500/20 flex items-center justify-center gap-3">
            <span className="text-3xl font-black text-amber-400 font-display">
              +{giftModal?.amount || 250}
            </span>
            <span className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Coins
            </span>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setGiftModal(null)}
              className="flex-1 py-2.5 rounded-xl text-xs font-bold border border-gray-300 dark:border-white/15 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/5 transition-colors min-h-[44px]"
            >
              Close
            </button>
            <button
              onClick={() => {
                handleThankCreator(giftModal);
                setGiftModal(null);
              }}
              className="flex-1 py-2.5 rounded-xl text-xs font-bold bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-lg min-h-[44px]"
            >
              Send Thank You 💜
            </button>
          </div>
        </div>
      </Dialog>

      {/* Bottom Navigation Bar */}
      <nav className={cn(
        "fixed bottom-0 inset-x-0 z-40 backdrop-blur-2xl border-t py-2 px-6 transition-colors",
        isDark ? "bg-[#060814]/90 border-white/10" : "bg-white/95 border-slate-200 shadow-lg"
      )}>
        <div className="max-w-md mx-auto flex items-center justify-between">
          <button
            onClick={() => navigate('/')}
            className="flex flex-col items-center gap-1 text-arvdoul-text-secondary hover:text-white transition-colors"
          >
            <Home className="w-5 h-5" />
            <span className="text-[10px] font-semibold">Home</span>
          </button>

          <button
            onClick={() => navigate('/messages')}
            className="relative flex flex-col items-center gap-1 text-arvdoul-text-secondary hover:text-white transition-colors"
          >
            <MessageSquare className="w-5 h-5" />
            <span className="absolute -top-1 right-1 w-4 h-4 rounded-full bg-violet-600 text-white text-[9px] font-black flex items-center justify-center ring-2 ring-[#060814]">
              8
            </span>
            <span className="text-[10px] font-semibold">Chats</span>
          </button>

          <button
            onClick={() => navigate('/stories')}
            className="flex flex-col items-center gap-1 text-arvdoul-text-secondary hover:text-white transition-colors"
          >
            <Compass className="w-5 h-5" />
            <span className="text-[10px] font-semibold">Stories</span>
          </button>

          <button
            onClick={() => navigate('/notifications')}
            className="relative flex flex-col items-center gap-1 text-violet-400 font-bold transition-colors"
          >
            <div className="p-1 rounded-full bg-violet-500/15">
              <Bell className="w-5 h-5 text-violet-400 fill-violet-400/20" />
            </div>
            <span className="absolute -top-1 right-2 w-4 h-4 rounded-full bg-violet-600 text-white text-[9px] font-black flex items-center justify-center ring-2 ring-[#060814] shadow-arvdoul-glow">
              12
            </span>
            <span className="text-[10px] font-bold">Notifications</span>
          </button>

          <button
            onClick={() => navigate('/profile')}
            className="flex flex-col items-center gap-1 text-arvdoul-text-secondary hover:text-white transition-colors"
          >
            <User className="w-5 h-5" />
            <span className="text-[10px] font-semibold">Profile</span>
          </button>
        </div>
      </nav>
    </div>
  );
}
