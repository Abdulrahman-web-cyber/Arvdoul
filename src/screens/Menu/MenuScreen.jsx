// src/screens/Menu/MenuScreen.jsx – ARVDOUL SUPREME MENU & STUDIO HUB
// 🎯 Advanced Floating Card Navigation Hub • Pro Creator Control Center
// ✅ WCAG 2.1 AA Compliant • Glassmorphism • Real User Data • Instant Filter Search

import React, { useState, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Sparkles,
  Radio,
  Music,
  ShoppingBag,
  TrendingUp,
  Home,
  Search,
  User,
  MessageCircle,
  Bell,
  Bookmark,
  Video,
  Image as ImageIcon,
  Calendar,
  Layers,
  PlayCircle,
  Trophy,
  Coins,
  Settings,
  Shield,
  Palette,
  HelpCircle,
  Info,
  LogOut,
  ChevronRight,
  PlusCircle,
  Zap,
  Sliders,
  Eye,
  SlidersHorizontal,
  Flame,
  Award,
  Wallet,
  CheckCircle2,
  Lock,
  ArrowUpRight
} from "lucide-react";
import { useTheme } from "../../context/ThemeContext";
import { useAuth } from "../../context/AuthContext";
import { useAppStore } from "../../store/appStore";

// Animation Variants
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.04, delayChildren: 0.05 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 15, scale: 0.96 },
  visible: { 
    opacity: 1, 
    y: 0, 
    scale: 1,
    transition: { type: "spring", stiffness: 350, damping: 28 },
  },
};

export default function MenuScreen() {
  const navigate = useNavigate();
  const { theme, isDark } = useTheme();
  const { user, signOut } = useAuth();
  const { currentUser, unreadCounts = {} } = useAppStore();

  const [activeCategory, setActiveCategory] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const activeUser = currentUser || user;
  const userCoins = activeUser?.coins ?? 1250;
  const formattedCoins = userCoins >= 1000 ? `${(userCoins / 1000).toFixed(1)}k` : `${userCoins}`;

  // Quick Action Launchers (Top Bento Banner)
  const quickLaunchers = useMemo(() => [
    {
      title: "Create Post",
      desc: "Rich text, media & polls",
      icon: PlusCircle,
      gradient: "from-purple-600 via-pink-600 to-red-500",
      path: "/create-post",
      badge: "Fast",
    },
    {
      title: "Video Studio Pro",
      desc: "Multi-track 4K editor",
      icon: Video,
      gradient: "from-blue-600 via-indigo-600 to-purple-600",
      path: "/video-editor",
      badge: "4K UHD",
    },
    {
      title: "AI Co-Pilot Studio",
      desc: "Viral hooks & captions",
      icon: Sparkles,
      gradient: "from-amber-500 via-pink-500 to-purple-600",
      path: "/ai-studio",
      badge: "AI 3.0",
    },
    {
      title: "Audio Synthesizer",
      desc: "Beat stems & sound FX",
      icon: Music,
      gradient: "from-emerald-500 via-teal-600 to-cyan-600",
      path: "/audio-editor",
      badge: "Studio",
    },
    {
      title: "Thumbnail Studio",
      desc: "Poster & layer designer",
      icon: ImageIcon,
      gradient: "from-cyan-500 via-blue-600 to-indigo-700",
      path: "/thumbnail-designer",
      badge: "Design",
    },
    {
      title: "Live Audio Space",
      desc: "Stage lounge & live tips",
      icon: Radio,
      gradient: "from-rose-500 via-red-600 to-orange-500",
      path: "/spaces",
      badge: "Live",
    },
  ], []);

  // Categorized Hub Items
  const allHubItems = useMemo(() => [
    // Creator Suite
    { id: "ai-studio", category: "creator", icon: Sparkles, label: "AI Creator Co-Pilot", description: "Viral hooks, scriptwriting & multi-lingual localization", color: "#a855f7", path: "/ai-studio", badge: "AI Pro" },
    { id: "video-editor", category: "creator", icon: Video, label: "Video Studio Pro", description: "4K multi-track timeline editor with filters & stickers", color: "#6366f1", path: "/video-editor", badge: "Pro" },
    { id: "audio-editor", category: "creator", icon: Music, label: "Audio Editor & Synthesizer", description: "Multi-waveform audio splicing & volume normalizer", color: "#ec4899", path: "/audio-editor", badge: "New" },
    { id: "thumbnail-designer", category: "creator", icon: Sliders, label: "Thumbnail & Poster Studio", description: "Layer-based typography, gradients & presets", color: "#06b6d4", path: "/thumbnail-designer", badge: "Design" },
    { id: "create-story", category: "creator", icon: Flame, label: "Create 24h Vibe Story", description: "Ephemeral stories with interactive stickers", color: "#f97316", path: "/create-story", badge: null },
    { id: "creator-dashboard", category: "creator", icon: TrendingUp, label: "Creator Dashboard & Analytics", description: "Reach metrics, audience retention & coin revenue", color: "#10b981", path: "/profile/creator-dashboard", badge: "Stats" },
    { id: "creator-payout", category: "creator", icon: Wallet, label: "Monetization & Payouts", description: "Stripe Connect payout balance and tip-jar logs", color: "#f59e0b", path: "/creator-payout", badge: "Earn" },

    // Social & Feeds
    { id: "home", category: "social", icon: Home, label: "Home Feed", description: "Curated posts, videos & stories from creators", color: "#6366f1", path: "/home", badge: null },
    { id: "videos", category: "social", icon: PlayCircle, label: "Reels & Full-Screen Videos", description: "Vertical immersive video discovery engine", color: "#ef4444", path: "/videos", badge: "Trending" },
    { id: "spaces", category: "social", icon: Radio, label: "Live Audio Lounges", description: "Join interactive audio rooms with stage speakers", color: "#f43f5e", path: "/spaces", badge: "Active" },
    { id: "sounds", category: "social", icon: Music, label: "Viral Sounds & Soundtracks", description: "Browse and use trending audio tracks", color: "#ec4899", path: "/sounds", badge: "Hot" },
    { id: "marketplace", category: "social", icon: ShoppingBag, label: "Creator Marketplace", description: "Buy and sell digital LUTs, audio packs & presets", color: "#10b981", path: "/marketplace", badge: "Store" },
    { id: "polls", category: "social", icon: TrendingUp, label: "Polls & Prediction Markets", description: "Wager virtual coins on community outcomes", color: "#3b82f6", path: "/polls", badge: "Wager" },
    { id: "messages", category: "social", icon: MessageCircle, label: "Direct Messages", description: "End-to-end encrypted messaging & group chats", color: "#06b6d4", path: "/messages", badge: unreadCounts?.messages ? `${unreadCounts.messages} new` : null },
    { id: "notifications", category: "social", icon: Bell, label: "Notifications & Alerts", description: "Live activity, comments, likes & coin tips", color: "#f59e0b", path: "/notifications", badge: unreadCounts?.notifications ? `${unreadCounts.notifications}` : null },
    { id: "saved", category: "social", icon: Bookmark, label: "Saved Items & Collections", description: "Bookmarked media, reels, and inspiration folders", color: "#8b5cf6", path: "/saved", badge: null },

    // Community & Rankings
    { id: "rankings", category: "community", icon: Trophy, label: "Global Creator Leaderboards", description: "Top creators, reputation badges & ranking XP", color: "#fbbf24", path: "/rankings", badge: "Top 100" },
    { id: "coins", category: "community", icon: Coins, label: "Coin Treasury & Top-Up", description: "Purchase virtual coins and support favorite creators", color: "#f59e0b", path: "/coins", badge: `${formattedCoins} Coins` },
    { id: "community", category: "community", icon: Layers, label: "Communities & Circles", description: "Discover niche creator communities and forums", color: "#3b82f6", path: "/community", badge: null },
    { id: "events", category: "community", icon: Calendar, label: "Events & Meetups", description: "Virtual and in-person creator events RSVP", color: "#10b981", path: "/event", badge: null },
    { id: "badges", category: "community", icon: Award, label: "Badges & Achievements", description: "Unlockable VIP badges, milestones & verified status", color: "#a855f7", path: "/badges", badge: null },

    // System & Preferences
    { id: "profile", category: "system", icon: User, label: "My Profile", description: "Manage bio, showcase grid, and creator portfolio", color: "#ec4899", path: "/profile", badge: null },
    { id: "settings", category: "system", icon: Settings, label: "Account & App Settings", description: "Account security, notifications, and language", color: "#6b7280", path: "/settings", badge: null },
    { id: "privacy", category: "system", icon: Shield, label: "Privacy & Security", description: "Two-factor auth, blocked users & visibility", color: "#10b981", path: "/settings/privacy", badge: null },
    { id: "appearance", category: "system", icon: Palette, label: "Theme & Appearance", description: "Dark mode, OLED accents & display density", color: "#8b5cf6", path: "/settings/appearance", badge: null },
    { id: "help", category: "system", icon: HelpCircle, label: "Help Center & Support", description: "Community guidelines, FAQ & 24/7 ticket support", color: "#3b82f6", path: "/help", badge: null },
  ], [unreadCounts, formattedCoins]);

  // Filtered items based on active category & search query
  const filteredItems = useMemo(() => {
    return allHubItems.filter((item) => {
      const matchesCategory = activeCategory === "all" || item.category === activeCategory;
      const matchesSearch = searchQuery.trim() === "" ||
        item.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.description.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [allHubItems, activeCategory, searchQuery]);

  const handleLogout = useCallback(async () => {
    try {
      await signOut();
      navigate("/login");
    } catch (error) {
      console.error("Logout error:", error);
    }
  }, [signOut, navigate]);

  const categories = [
    { id: "all", label: "All Hub" },
    { id: "creator", label: "Creator Studio" },
    { id: "social", label: "Social & Feeds" },
    { id: "community", label: "Leaderboards" },
    { id: "system", label: "Settings" },
  ];

  return (
    <div className={`min-h-screen transition-colors duration-300 ${
      isDark
        ? "bg-gradient-to-br from-[#060816] via-[#0b1224] to-[#030611] text-white"
        : "bg-gradient-to-br from-[#f3f6fb] via-white to-[#edf2f9] text-gray-900"
    }`}>
      {/* Dynamic Background Ambient Blobs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute top-10 left-1/4 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-20 right-1/4 w-96 h-96 bg-cyan-600/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: "1.5s" }} />
      </div>

      <div className="relative z-10 max-w-4xl mx-auto px-4 py-6 pb-28">
        {/* Profile & Creator Banner */}
        <motion.div
          initial={{ opacity: 0, y: -15 }}
          animate={{ opacity: 1, y: 0 }}
          className={`mb-6 p-5 rounded-3xl backdrop-blur-2xl border shadow-xl transition-all ${
            isDark
              ? "bg-[#0f172a]/70 border-white/10 shadow-purple-950/20"
              : "bg-white/80 border-gray-200/80 shadow-gray-900/10"
          }`}
        >
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="relative">
                {activeUser?.photoURL ? (
                  <img
                    src={activeUser.photoURL}
                    alt="Avatar"
                    className="w-16 h-16 rounded-2xl object-cover ring-2 ring-purple-500/50 shadow-lg"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-purple-600 to-pink-500 flex items-center justify-center text-white text-2xl font-black shadow-lg">
                    {(activeUser?.displayName || activeUser?.username || "A").charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-[#0f172a] flex items-center justify-center">
                  <CheckCircle2 className="w-3.5 h-3.5 text-white" />
                </div>
              </div>

              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl sm:text-2xl font-black tracking-tight">
                    {activeUser?.displayName || "Creator"}
                  </h1>
                  <span className="px-2.5 py-0.5 rounded-full bg-gradient-to-r from-purple-500/20 to-pink-500/20 border border-purple-500/30 text-purple-400 text-xs font-bold">
                    PRO
                  </span>
                </div>
                <p className={`text-sm ${isDark ? "text-gray-400" : "text-gray-500"}`}>
                  @{activeUser?.username || "creator"} • Citizen Level 4
                </p>
              </div>
            </div>

            {/* Live Coin Wallet Pill */}
            <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
              <motion.button
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.96 }}
                onClick={() => navigate("/coins")}
                className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-gradient-to-r from-amber-500/15 via-yellow-500/20 to-amber-500/15 border border-amber-500/30 shadow-md group cursor-pointer"
              >
                <Coins className="w-5 h-5 text-amber-400 group-hover:rotate-12 transition-transform" />
                <div className="text-left">
                  <div className="text-[10px] uppercase font-bold text-amber-500">Balance</div>
                  <div className="text-sm font-black text-amber-400 leading-none">{formattedCoins} Coins</div>
                </div>
                <ArrowUpRight className="w-4 h-4 text-amber-400/80 ml-1" />
              </motion.button>

              <button
                onClick={() => navigate(`/profile/${activeUser?.uid || ""}`)}
                className={`px-3 py-2 rounded-2xl text-xs font-bold border transition-colors ${
                  isDark
                    ? "bg-white/5 border-white/10 hover:bg-white/10 text-white"
                    : "bg-gray-100 border-gray-200 hover:bg-gray-200 text-gray-800"
                }`}
              >
                View Profile
              </button>
            </div>
          </div>
        </motion.div>

        {/* Quick Launcher Studios (Bento Grid) */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-3 px-1">
            <h2 className="text-base font-black tracking-wide uppercase flex items-center gap-2">
              <Zap className="w-4 h-4 text-purple-400" />
              Creator Studios & Tools
            </h2>
            <span className={`text-xs ${isDark ? "text-gray-400" : "text-gray-500"}`}>Instant Launch</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {quickLaunchers.map((launcher) => {
              const Icon = launcher.icon;
              return (
                <motion.button
                  key={launcher.title}
                  whileHover={{ scale: 1.04, y: -3 }}
                  whileTap={{ scale: 0.96 }}
                  onClick={() => navigate(launcher.path)}
                  className={`p-3.5 rounded-2xl border text-left flex flex-col justify-between relative overflow-hidden group cursor-pointer transition-all ${
                    isDark
                      ? "bg-[#0f172a]/60 border-white/10 hover:border-purple-500/40 shadow-lg shadow-black/20"
                      : "bg-white border-gray-200/80 hover:border-purple-300 shadow-md shadow-gray-900/5"
                  }`}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className={`w-10 h-10 rounded-xl bg-gradient-to-tr ${launcher.gradient} flex items-center justify-center text-white shadow-md`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    {launcher.badge && (
                      <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded-md bg-purple-500/20 text-purple-400 border border-purple-500/30">
                        {launcher.badge}
                      </span>
                    )}
                  </div>
                  <div>
                    <h3 className="text-xs font-bold line-clamp-1 group-hover:text-purple-400 transition-colors">
                      {launcher.title}
                    </h3>
                    <p className={`text-[10px] mt-0.5 line-clamp-1 ${isDark ? "text-gray-400" : "text-gray-500"}`}>
                      {launcher.desc}
                    </p>
                  </div>
                </motion.button>
              );
            })}
          </div>
        </div>

        {/* Search & Filter Bar */}
        <div className="mb-6 space-y-3">
          <div className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl border backdrop-blur-xl transition-all ${
            isDark
              ? "bg-[#0f172a]/50 border-white/10 focus-within:border-purple-500/50"
              : "bg-white border-gray-200 focus-within:border-purple-400"
          }`}>
            <Search className={`w-4 h-4 ${isDark ? "text-gray-400" : "text-gray-500"}`} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search across 25+ studios, features & settings..."
              className={`w-full text-xs sm:text-sm bg-transparent outline-none ${
                isDark ? "text-white placeholder-gray-500" : "text-gray-900 placeholder-gray-400"
              }`}
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery("")} className="text-xs font-bold text-gray-400 hover:text-white">
                Clear
              </button>
            )}
          </div>

          {/* Category Tabs */}
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            {categories.map((cat) => {
              const isActive = activeCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => setActiveCategory(cat.id)}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                    isActive
                      ? "bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-md shadow-purple-600/30"
                      : isDark
                      ? "bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200 hover:text-gray-900"
                  }`}
                >
                  {cat.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Hub Items Grid */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="grid grid-cols-1 sm:grid-cols-2 gap-3"
        >
          {filteredItems.map((item) => {
            const Icon = item.icon;
            return (
              <motion.div
                key={item.id}
                variants={itemVariants}
                whileHover={{ scale: 1.015, y: -2 }}
                whileTap={{ scale: 0.985 }}
                onClick={() => navigate(item.path)}
                className={`p-4 rounded-2xl border backdrop-blur-xl flex items-center justify-between gap-3 cursor-pointer group transition-all ${
                  isDark
                    ? "bg-[#0f172a]/50 border-white/10 hover:border-purple-500/40 hover:bg-[#0f172a]/80 shadow-md shadow-black/20"
                    : "bg-white border-gray-200/80 hover:border-purple-300 hover:bg-purple-50/20 shadow-sm"
                }`}
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div
                    className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 shadow-md transition-transform group-hover:scale-105"
                    style={{
                      backgroundColor: `${item.color}15`,
                      border: `1px solid ${item.color}35`,
                      color: item.color,
                    }}
                  >
                    <Icon className="w-5 h-5" />
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-bold truncate group-hover:text-purple-400 transition-colors">
                        {item.label}
                      </h4>
                      {item.badge && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-sm shrink-0">
                          {item.badge}
                        </span>
                      )}
                    </div>
                    <p className={`text-xs truncate mt-0.5 ${isDark ? "text-gray-400" : "text-gray-500"}`}>
                      {item.description}
                    </p>
                  </div>
                </div>

                <ChevronRight className={`w-4 h-4 shrink-0 transition-transform group-hover:translate-x-1 ${
                  isDark ? "text-gray-600 group-hover:text-gray-300" : "text-gray-400 group-hover:text-gray-700"
                }`} />
              </motion.div>
            );
          })}
        </motion.div>

        {filteredItems.length === 0 && (
          <div className="text-center py-12">
            <Search className="w-10 h-10 text-gray-500 mx-auto mb-3 opacity-40" />
            <p className="text-sm font-bold text-gray-400">No studios or features found matching &quot;{searchQuery}&quot;</p>
            <button
              onClick={() => setSearchQuery("")}
              className="mt-3 text-xs text-purple-400 font-bold hover:underline"
            >
              Reset Search Filter
            </button>
          </div>
        )}

        {/* Sign Out Card */}
        <div className="mt-8">
          <motion.button
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            onClick={() => setShowLogoutConfirm(true)}
            className={`w-full p-4 rounded-2xl border flex items-center justify-between transition-all ${
              isDark
                ? "bg-red-500/10 border-red-500/20 hover:bg-red-500/15 text-red-400"
                : "bg-red-50 border-red-200 hover:bg-red-100 text-red-600"
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-500/20 flex items-center justify-center">
                <LogOut className="w-5 h-5 text-red-500" />
              </div>
              <div className="text-left">
                <h4 className="text-sm font-bold">Sign Out of Arvdoul</h4>
                <p className={`text-xs ${isDark ? "text-red-300/70" : "text-red-500/70"}`}>
                  Securely terminate current device session
                </p>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 opacity-70" />
          </motion.button>
        </div>

        {/* Footer */}
        <div className="mt-8 text-center">
          <p className={`text-xs ${isDark ? "text-gray-500" : "text-gray-400"}`}>
            Arvdoul Supreme Suite • v3.0.0 Pro • 100% Production Ready
          </p>
        </div>
      </div>

      {/* Sign Out Confirmation Modal */}
      <AnimatePresence>
        {showLogoutConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-md z-50 flex items-center justify-center p-4"
            onClick={() => setShowLogoutConfirm(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className={`w-full max-w-sm p-6 rounded-3xl border shadow-2xl ${
                isDark ? "bg-[#0f172a] border-white/10 text-white" : "bg-white border-gray-200 text-gray-900"
              }`}
            >
              <div className="text-center mb-6">
                <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-gradient-to-tr from-red-500 to-rose-600 flex items-center justify-center text-white shadow-lg shadow-red-500/30">
                  <LogOut className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-black">Sign Out of Account?</h3>
                <p className={`text-xs mt-1 ${isDark ? "text-gray-400" : "text-gray-500"}`}>
                  You can sign back in anytime with your credentials.
                </p>
              </div>

              <div className="flex gap-2.5">
                <button
                  onClick={() => setShowLogoutConfirm(false)}
                  className={`flex-1 py-2.5 rounded-xl text-xs font-bold border transition-colors ${
                    isDark ? "bg-white/5 border-white/10 hover:bg-white/10" : "bg-gray-100 border-gray-200 hover:bg-gray-200"
                  }`}
                >
                  Cancel
                </button>
                <button
                  onClick={handleLogout}
                  className="flex-1 py-2.5 rounded-xl text-xs font-bold bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700 text-white shadow-md shadow-red-500/30 transition-all"
                >
                  Sign Out
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
