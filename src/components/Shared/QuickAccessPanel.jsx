import React, { useRef, useState, useCallback, useMemo, memo, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { 
  ChevronUp,
  ChevronDown,
  X,
  Camera,
  PenSquare,
  UserCircle,
  Settings,
  BookOpen,
  Grid3X3,
  Video,
  Bookmark,
  Users,
  Image as ImageIcon,
  User,
  Plus,
  Sparkles,
  Star,
  Moon,
  Sun,
  Zap,
  Globe,
  Heart,
  TrendingUp,
  Clock,
  Shield,
  Crown,
  Bell,
  MessageCircle,
  Home,
  PlayCircle,
  UserPlus,
  Award,
  Target,
  BarChart3,
  DollarSign,
  Gift,
  Trophy,
  Compass,
  Search,
  MoreVertical,
  LogOut,
  Eye,
  Palette,
  Calendar,
  Activity,
  CheckCircle,
  XCircle,
  Info,
  Link,
  Copy,
  Share2,
  Lock,
  RefreshCw,
  Wifi,
  Battery,
  Mail,
  Folder,
  CreditCard,
  ShoppingBag,
  Tag,
  Percent,
  TrendingDown,
  ChartBar,
  ChartLine,
  ChartPie,
  Wallet,
  Banknote,
  Landmark,
  Receipt,
  HandCoins,
  PiggyBank,
  CirclePercent,
  Medal,
  Target as TargetIcon,
  TrendingUp as TrendingUpIcon,
  CheckCheck,
  ArrowUpRight,
  Zap as ZapIcon,
  Flame,
  TrendingUp as TrendingUpIcon3,
  ShieldCheck,
  Verified,
  BadgeCheck,
  CircleDollarSign,
  Coins,
  Gem,
  Diamond,
  Sparkle,
  Target as TargetIcon3
} from "lucide-react";
import { motion, AnimatePresence, useMotionValue, useTransform } from "framer-motion";
import { useTheme } from "../../context/ThemeContext";
import { useSound } from "../../hooks/useSound";
import { useAnalytics } from "../../hooks/useAnalytics";
import { cn } from "../../lib/utils";
import { useAppStore } from "../../store/appStore";
import { 
  FaCoins, 
  FaFire, 
  FaCrown, 
  FaStar, 
  FaBolt, 
  FaPalette, 
  FaMoneyBillWave, 
  FaAd, 
  FaBullhorn, 
  FaChartLine,
  FaMedal,
  FaTrophy,
  FaAward,
  FaGem,
  FaUserCheck,
  FaUserPlus,
  FaUserFriends,
  FaVideo,
  FaPhotoVideo,
  FaCommentDollar,
  FaHandHoldingUsd,
  FaMoneyCheckAlt,
  FaPiggyBank,
  FaChartBar,
  FaChartArea,
  FaChartPie,
  FaRegStar,
  FaStarHalfAlt,
  FaCheckCircle,
  FaRegCheckCircle,
  FaMoon,
  FaSun
} from "react-icons/fa";
import { GiGoldBar, GiTreasureMap, GiCrownCoin } from "react-icons/gi";
import { MdAdsClick, MdOutlinePaid, MdAccountBalance, MdTrendingUp, MdShowChart } from "react-icons/md";
import { RiCopperCoinLine } from "react-icons/ri";
import { SiCashapp } from "react-icons/si";

// ==================== CONSTANTS & CONFIGURATION ====================
const ANIMATION_CONFIG = {
  panelSpring: { 
    type: "spring", 
    damping: 30, 
    stiffness: 380, 
    mass: 0.75 
  },
  staggerChildren: 0.03,
  delayChildren: 0.05
};

// Level system configuration
const LEVEL_CONFIG = {
  maxLevel: 50,
  baseXP: 100,
  growthFactor: 1.2,
  levelNames: {
    1: "Newcomer",
    5: "Active User",
    10: "Rising Star",
    15: "Content Creator",
    20: "Community Builder",
    25: "Influencer",
    30: "Trendsetter",
    35: "Social Pro",
    40: "Viral Star",
    45: "Platform Elite",
    50: "Arvdoul Legend"
  },
  levelRewards: {
    5: { coins: 100, badge: "Active", feature: "Basic Features" },
    10: { coins: 500, badge: "Rising Star", feature: "Analytics" },
    15: { coins: 1000, badge: "Creator", feature: "Advanced Tools" },
    20: { coins: 2500, badge: "Builder", feature: "Community Features" },
    25: { coins: 5000, badge: "Influencer", feature: "Monetization" },
    30: { coins: 10000, badge: "Trendsetter", feature: "Premium Tools" },
    35: { coins: 25000, badge: "Social Pro", feature: "Priority Support" },
    40: { coins: 50000, badge: "Viral Star", feature: "Customization" },
    45: { coins: 100000, badge: "Platform Elite", feature: "Early Access" },
    50: { coins: 250000, badge: "Arvdoul Legend", feature: "All Features" }
  }
};

// Calculate XP required for each level
const calculateXPForLevel = (level) => {
  return Math.floor(LEVEL_CONFIG.baseXP * Math.pow(LEVEL_CONFIG.growthFactor, level - 1));
};

// Color schemes
const getThemeColors = (theme) => ({
  panelBg: theme === "dark" 
    ? "bg-gradient-to-b from-gray-900 via-gray-900 to-black backdrop-blur-xl" 
    : "bg-gradient-to-b from-white via-gray-50 to-gray-100 backdrop-blur-xl",
  cardBg: theme === "dark" 
    ? "bg-gradient-to-br from-gray-800/80 via-gray-800/60 to-gray-900/80" 
    : "bg-gradient-to-br from-white/80 via-gray-50/60 to-gray-100/80",
  cardBorder: theme === "dark" 
    ? "border border-gray-700/20" 
    : "border border-gray-300/20",
  text: theme === "dark" 
    ? "text-white" 
    : "text-gray-900",
  subtext: theme === "dark" 
    ? "text-gray-300" 
    : "text-gray-600",
  accent: theme === "dark"
    ? "text-purple-400"
    : "text-purple-600",
  success: theme === "dark"
    ? "text-emerald-400"
    : "text-emerald-600",
  warning: theme === "dark"
    ? "text-amber-400"
    : "text-amber-600",
  error: theme === "dark"
    ? "text-rose-400"
    : "text-rose-600",
  info: theme === "dark"
    ? "text-blue-400"
    : "text-blue-600",
  premium: theme === "dark"
    ? "text-yellow-400"
    : "text-yellow-600"
});

// ==================== UTILITY COMPONENTS ====================
const Badge = memo(({ children, variant = "default", className, ...props }) => {
  const variants = {
    default: "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300",
    success: "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400",
    warning: "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400",
    error: "bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400",
    info: "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400",
    premium: "bg-gradient-to-r from-yellow-400/20 via-amber-400/20 to-orange-400/20 text-yellow-600 dark:text-yellow-400 border border-yellow-400/20",
    monetization: "bg-gradient-to-r from-emerald-400/20 via-teal-400/20 to-green-400/20 text-emerald-600 dark:text-emerald-400 border border-emerald-400/20",
    level: "bg-gradient-to-r from-purple-400/20 via-pink-400/20 to-blue-400/20 text-purple-600 dark:text-purple-400 border border-purple-400/20",
    creator: "bg-gradient-to-r from-pink-400/20 via-rose-400/20 to-red-400/20 text-pink-600 dark:text-pink-400 border border-pink-400/20"
  };

  return (
    <span
      className={cn(
        "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium",
        variants[variant],
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
});

const ProgressBar = memo(({ value, max = 100, label, showLabel = true, color = "blue", size = "md", showAnimation = true }) => {
  const percentage = Math.min(100, Math.max(0, (value / max) * 100));
  const sizes = {
    sm: "h-1.5",
    md: "h-2",
    lg: "h-3"
  };

  const colors = {
    blue: "bg-gradient-to-r from-blue-500 to-cyan-500",
    purple: "bg-gradient-to-r from-purple-500 to-pink-500",
    green: "bg-gradient-to-r from-emerald-500 to-teal-500",
    yellow: "bg-gradient-to-r from-yellow-500 to-orange-500",
    red: "bg-gradient-to-r from-rose-500 to-pink-500",
    emerald: "bg-gradient-to-r from-emerald-400 to-green-500",
    amber: "bg-gradient-to-r from-amber-400 to-yellow-500"
  };

  return (
    <div className="space-y-1.5">
      {showLabel && (
        <div className="flex justify-between text-xs">
          <span className="text-gray-600 dark:text-gray-400">{label}</span>
          <span className="font-medium">{value}/{max}</span>
        </div>
      )}
      <div className={cn("w-full bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden", sizes[size])}>
        {showAnimation ? (
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${percentage}%` }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className={cn("h-full rounded-full", colors[color])}
          />
        ) : (
          <div 
            className={cn("h-full rounded-full", colors[color])}
            style={{ width: `${percentage}%` }}
          />
        )}
      </div>
    </div>
  );
});

const LevelBadge = memo(({ level, size = "md", showLevel = true }) => {
  const getBadgeColor = () => {
    if (level >= 40) return "from-yellow-400 via-amber-500 to-orange-500";
    if (level >= 30) return "from-purple-400 via-pink-500 to-rose-500";
    if (level >= 20) return "from-blue-400 via-cyan-500 to-teal-500";
    if (level >= 10) return "from-green-400 via-emerald-500 to-teal-500";
    return "from-gray-400 via-gray-500 to-gray-600";
  };

  const sizes = {
    sm: "w-6 h-6 text-xs",
    md: "w-8 h-8 text-sm",
    lg: "w-12 h-12 text-base",
    xl: "w-16 h-16 text-lg"
  };

  return (
    <div className={cn(
      "rounded-full flex items-center justify-center font-bold text-white shadow-lg",
      sizes[size],
      "bg-gradient-to-br",
      getBadgeColor()
    )}>
      {showLevel ? level : <Crown className="w-1/2 h-1/2" />}
    </div>
  );
});

// ==================== MAIN COMPONENT ====================
const QuickAccessPanel = memo(({ isPanelOpen, closePanel, navigateToWithLoading }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { theme, toggleTheme } = useTheme();
  const { track } = useAnalytics();
  const { currentUser, userStats = {}, monetization = {} } = useAppStore();
  const { playSound } = useSound();

  // State management
  const [panelHeight, setPanelHeight] = useState("65vh");
  const [activeTab, setActiveTab] = useState("dashboard");
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isFullScreen, setIsFullScreen] = useState(false);

  // Refs
  const panelRef = useRef(null);
  const searchInputRef = useRef(null);
  const scrollContainerRef = useRef(null);

  // Theme colors
  const themeColors = useMemo(() => getThemeColors(theme), [theme]);

  // Panel drag functionality
  const y = useMotionValue(0);
  const opacity = useTransform(y, [0, 100], [1, 0]);

  // Navigation mapping
  const NAVIGATION_PATHS = useMemo(() => ({
    home: "/home",
    videos: "/videos",
    messages: "/messages",
    createPost: "/create-post",
    createStory: "/create-story",
    network: "/network",
    coins: "/coins",
    notifications: "/notifications",
    profile: "/profile",
    settings: "/settings",
    search: "/search",
    saved: "/saved",
    collections: "/collections",
    live: "/live",
    editProfile: "/edit-profile",
    monetization: "/monetization",
    earnings: "/earnings",
    ads: "/ads",
    sponsored: "/sponsored",
    levels: "/levels",
    achievements: "/achievements",
    analytics: "/analytics"
  }), []);

  // ==================== LEVEL SYSTEM CALCULATIONS ====================
  const levelSystem = useMemo(() => {
    const currentLevel = currentUser?.level || 1;
    const currentXP = currentUser?.experience || 0;
    const xpForCurrentLevel = calculateXPForLevel(currentLevel);
    const xpForNextLevel = calculateXPForLevel(currentLevel + 1);
    const xpNeededForNextLevel = Math.max(0, xpForNextLevel - currentXP);
    const progressPercentage = Math.min(100, (currentXP / xpForNextLevel) * 100);
    
    const nextLevelReward = LEVEL_CONFIG.levelRewards[currentLevel + 1] || null;
    const currentLevelName = LEVEL_CONFIG.levelNames[currentLevel] || "Newcomer";
    const nextLevelName = LEVEL_CONFIG.levelNames[currentLevel + 1] || "Next Level";
    
    return {
      currentLevel,
      currentXP,
      xpForCurrentLevel,
      xpForNextLevel,
      xpNeededForNextLevel,
      progressPercentage,
      nextLevelReward,
      currentLevelName,
      nextLevelName,
      isMaxLevel: currentLevel >= LEVEL_CONFIG.maxLevel
    };
  }, [currentUser?.level, currentUser?.experience]);

  // ==================== REAL USER STATISTICS ====================
  const userStatistics = useMemo(() => {
    const stats = currentUser || {};
    const monetizationStats = monetization || {};
    
    return {
      level: [
        { 
          label: "Level", 
          value: levelSystem.currentLevel, 
          icon: FaCrown,
          color: "purple", 
          change: levelSystem.currentLevelName,
          navigate: () => navigate(NAVIGATION_PATHS.levels)
        },
        { 
          label: "XP", 
          value: levelSystem.currentXP?.toLocaleString() || "0", 
          icon: FaStar,
          color: "yellow", 
          change: `${levelSystem.progressPercentage.toFixed(1)}%`,
          navigate: () => navigate(NAVIGATION_PATHS.levels)
        },
        { 
          label: "To Next", 
          value: levelSystem.xpNeededForNextLevel?.toLocaleString() || "0", 
          icon: TargetIcon,
          color: "blue", 
          change: `Lvl ${levelSystem.currentLevel + 1}`,
          navigate: () => navigate(NAVIGATION_PATHS.levels)
        },
        { 
          label: "Rank", 
          value: stats.rank ? `#${stats.rank}` : "N/A", 
          icon: Trophy,
          color: "emerald", 
          change: stats.percentile ? `Top ${stats.percentile}%` : "",
          navigate: () => navigate("/rankings")
        }
      ],
      content: [
        { 
          label: "Posts", 
          value: stats.postCount || 0, 
          icon: Grid3X3, 
          color: "blue", 
          change: stats.postsToday ? `+${stats.postsToday}` : "",
          navigate: () => navigate("/profile?tab=posts")
        },
        { 
          label: "Videos", 
          value: stats.videoCount || 0, 
          icon: Video, 
          color: "purple", 
          change: stats.videosToday ? `+${stats.videosToday}` : "",
          navigate: () => navigate(NAVIGATION_PATHS.videos)
        },
        { 
          label: "Saved", 
          value: stats.savedCount || 0, 
          icon: Bookmark, 
          color: "green", 
          change: stats.savedToday ? `+${stats.savedToday}` : "",
          navigate: () => navigate(NAVIGATION_PATHS.saved)
        },
        { 
          label: "Collections", 
          value: stats.collectionCount || 0, 
          icon: BookOpen, 
          color: "yellow", 
          change: stats.collectionsToday ? `+${stats.collectionsToday}` : "",
          navigate: () => navigate(NAVIGATION_PATHS.collections)
        }
      ],
      social: [
        { 
          label: "Followers", 
          value: stats.followerCount || 0, 
          icon: Users, 
          color: "purple", 
          change: stats.followersToday ? `+${stats.followersToday}` : "",
          navigate: () => navigate("/followers")
        },
        { 
          label: "Following", 
          value: stats.followingCount || 0, 
          icon: UserPlus, 
          color: "blue", 
          change: stats.followingToday ? `+${stats.followingToday}` : "",
          navigate: () => navigate("/following")
        },
        { 
          label: "Likes", 
          value: stats.likeCount ? (stats.likeCount > 1000 ? `${(stats.likeCount/1000).toFixed(1)}K` : stats.likeCount) : "0", 
          icon: Heart, 
          color: "red", 
          change: stats.likesToday ? `+${stats.likesToday}` : "",
          navigate: () => navigate("/analytics")
        },
        { 
          label: "Comments", 
          value: stats.commentCount || 0, 
          icon: MessageCircle, 
          color: "green", 
          change: stats.commentsToday ? `+${stats.commentsToday}` : "",
          navigate: () => navigate("/analytics")
        }
      ]
    };
  }, [currentUser, levelSystem, navigate, NAVIGATION_PATHS]);

  // ==================== MONETIZATION STATS ====================
  const monetizationStats = useMemo(() => {
    const stats = monetization || {};
    const userStats = currentUser || {};
    
    return [
      {
        label: "Coins",
        value: userStats.coins ? userStats.coins.toLocaleString() : "0",
        icon: FaCoins,
        color: "amber",
        change: stats.coinsEarnedToday ? `+${stats.coinsEarnedToday}` : "",
        navigate: () => navigate(NAVIGATION_PATHS.coins)
      },
      {
        label: "Earnings",
        value: `$${(stats.totalEarnings || 0).toFixed(2)}`,
        icon: DollarSign,
        color: "emerald",
        change: stats.todayEarnings ? `+$${stats.todayEarnings.toFixed(2)}` : "",
        navigate: () => navigate(NAVIGATION_PATHS.earnings)
      },
      {
        label: "Ad Revenue",
        value: `$${(stats.adRevenue || 0).toFixed(2)}`,
        icon: MdAdsClick,
        color: "blue",
        change: stats.adRevenueToday ? `+$${stats.adRevenueToday.toFixed(2)}` : "",
        navigate: () => navigate(NAVIGATION_PATHS.ads)
      },
      {
        label: "Sponsored",
        value: `$${(stats.sponsoredRevenue || 0).toFixed(2)}`,
        icon: FaBullhorn,
        color: "purple",
        change: stats.sponsoredToday ? `+$${stats.sponsoredToday.toFixed(2)}` : "",
        navigate: () => navigate(NAVIGATION_PATHS.sponsored)
      }
    ];
  }, [monetization, currentUser?.coins, navigate, NAVIGATION_PATHS]);

  // ==================== ACHIEVEMENTS ====================
  const achievements = useMemo(() => {
    const stats = currentUser || {};
    const monetizationStats = monetization || {};
    
    return [
      { 
        id: 1, 
        title: "First Post", 
        icon: PenSquare, 
        unlocked: (stats.postCount || 0) > 0, 
        date: "First post",
        points: 100,
        progress: (stats.postCount || 0) > 0 ? 100 : 0
      },
      { 
        id: 2, 
        title: "Profile Complete", 
        icon: CheckCircle, 
        unlocked: stats.isProfileComplete || false, 
        date: "Complete",
        points: 250,
        progress: stats.isProfileComplete ? 100 : 0
      },
      { 
        id: 3, 
        title: "Level 10", 
        icon: Trophy, 
        unlocked: levelSystem.currentLevel >= 10, 
        required: 10, 
        current: levelSystem.currentLevel, 
        points: 1000,
        progress: Math.min((levelSystem.currentLevel / 10) * 100, 100)
      },
      { 
        id: 4, 
        title: "First Earnings", 
        icon: DollarSign, 
        unlocked: (monetizationStats.totalEarnings || 0) > 0, 
        date: "Earnings",
        points: 500,
        progress: (monetizationStats.totalEarnings || 0) > 0 ? 100 : 0
      },
      { 
        id: 5, 
        title: "100 Followers", 
        icon: Users, 
        unlocked: (stats.followerCount || 0) >= 100, 
        required: 100, 
        current: stats.followerCount || 0, 
        points: 1000,
        progress: Math.min(((stats.followerCount || 0) / 100) * 100, 100)
      },
      { 
        id: 6, 
        title: "Creator", 
        icon: FaCrown, 
        unlocked: stats.isCreator || false, 
        date: "Creator",
        points: 2000,
        progress: stats.isCreator ? 100 : 0
      }
    ];
  }, [currentUser, monetization, levelSystem.currentLevel]);

  // ==================== QUICK ACTIONS ====================
  const quickActions = useMemo(() => {
    const isCreator = currentUser?.isCreator || false;
    const canMonetize = currentUser?.level >= 25 || isCreator;
    
    return {
      create: [
        { 
          label: "Create Post", 
          icon: PenSquare, 
          action: () => navigateToWithLoading(NAVIGATION_PATHS.createPost),
          color: "from-blue-500 to-cyan-500",
          description: "Share your thoughts",
          shortcut: "P",
          xpReward: 10
        },
        { 
          label: "Create Story", 
          icon: Camera, 
          action: () => navigateToWithLoading(NAVIGATION_PATHS.createStory),
          color: "from-purple-500 to-pink-600",
          description: "24-hour content",
          shortcut: "S",
          sparkling: true,
          xpReward: 15
        },
        ...(isCreator ? [{
          label: "Go Live", 
          icon: Video, 
          action: () => navigateToWithLoading(NAVIGATION_PATHS.live),
          color: "from-rose-500 to-red-600",
          description: "Live streaming",
          shortcut: "L",
          premium: true,
          xpReward: 50
        }] : []),
        { 
          label: "Create Poll", 
          icon: BarChart3, 
          action: () => {
            track("Create_Poll_Click");
            navigate("/create-post?type=poll");
          },
          color: "from-emerald-500 to-teal-500",
          description: "Ask your audience",
          shortcut: "O",
          xpReward: 20
        }
      ],
      monetization: [
        { 
          label: "Coins", 
          icon: FaCoins, 
          action: () => navigate(NAVIGATION_PATHS.coins),
          color: "from-amber-500 to-yellow-500",
          description: "Earn & spend",
          earnings: monetization.coinsEarnedToday || 0,
          disabled: !canMonetize,
          disabledText: "Unlock at Level 25"
        },
        { 
          label: "Earnings", 
          icon: DollarSign, 
          action: () => navigate(NAVIGATION_PATHS.earnings),
          color: "from-emerald-500 to-green-500",
          description: "View income",
          earnings: monetization.todayEarnings || 0,
          disabled: !canMonetize,
          disabledText: "Unlock at Level 25"
        },
        { 
          label: "Ads", 
          icon: MdAdsClick, 
          action: () => navigate(NAVIGATION_PATHS.ads),
          color: "from-blue-500 to-cyan-500",
          description: "Ad revenue",
          earnings: monetization.adRevenueToday || 0,
          disabled: !canMonetize,
          disabledText: "Unlock at Level 25"
        },
        { 
          label: "Sponsored", 
          icon: FaBullhorn, 
          action: () => navigate(NAVIGATION_PATHS.sponsored),
          color: "from-purple-500 to-pink-500",
          description: "Brand deals",
          earnings: monetization.sponsoredToday || 0,
          disabled: !canMonetize,
          disabledText: "Unlock at Level 25"
        }
      ],
      navigate: [
        { 
          label: "Home", 
          icon: Home, 
          action: () => navigate(NAVIGATION_PATHS.home),
          color: "from-gray-600 to-gray-700"
        },
        { 
          label: "Videos", 
          icon: PlayCircle, 
          action: () => navigate(NAVIGATION_PATHS.videos),
          color: "from-purple-600 to-indigo-600"
        },
        { 
          label: "Messages", 
          icon: MessageCircle, 
          action: () => navigate(NAVIGATION_PATHS.messages),
          color: "from-blue-600 to-cyan-600"
        },
        { 
          label: "Network", 
          icon: UserPlus, 
          action: () => navigate(NAVIGATION_PATHS.network),
          color: "from-green-600 to-emerald-600"
        }
      ]
    };
  }, [navigateToWithLoading, navigate, track, monetization, currentUser, NAVIGATION_PATHS]);

  // ==================== EFFECTS ====================
  useEffect(() => {
    if (isPanelOpen) {
      playSound("panel_open");
      track("QuickAccessPanel_Opened", {
        location: location.pathname,
        time: new Date().toISOString()
      });
      
      // Auto-focus search on open
      setTimeout(() => {
        if (searchInputRef.current) {
          searchInputRef.current.focus();
        }
      }, 300);
    }
  }, [isPanelOpen, playSound, track, location.pathname]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!isPanelOpen) return;
      
      // Close on Escape
      if (e.key === 'Escape') {
        closePanel();
      }
      
      // Quick shortcuts
      if (e.ctrlKey || e.metaKey) {
        switch(e.key.toLowerCase()) {
          case 'p':
            e.preventDefault();
            navigateToWithLoading(NAVIGATION_PATHS.createPost);
            break;
          case 's':
            e.preventDefault();
            navigateToWithLoading(NAVIGATION_PATHS.createStory);
            break;
          case 'h':
            e.preventDefault();
            navigate(NAVIGATION_PATHS.home);
            break;
          case 'c':
            e.preventDefault();
            navigate(NAVIGATION_PATHS.coins);
            break;
          case 'l':
            e.preventDefault();
            navigate(NAVIGATION_PATHS.levels);
            break;
        }
      }
      
      // Number shortcuts for tabs
      if (e.key >= '1' && e.key <= '4') {
        e.preventDefault();
        const tabs = ["dashboard", "actions", "monetization", "achievements"];
        setActiveTab(tabs[parseInt(e.key) - 1]);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPanelOpen, closePanel, navigateToWithLoading, navigate, NAVIGATION_PATHS]);

  // ==================== HANDLERS ====================
  const handlePanelDragEnd = useCallback((event, info) => {
    const velocity = info.velocity.y;
    const delta = info.offset.y;
    const threshold = window.innerHeight * 0.25;

    if (velocity > 500 || delta > threshold) {
      closePanel();
    } else if (velocity < -500 || delta < -threshold) {
      setIsFullScreen(true);
      setPanelHeight("85vh");
    } else {
      setIsFullScreen(false);
      setPanelHeight("65vh");
    }
  }, [closePanel]);

  const toggleFullScreen = useCallback(() => {
    setIsFullScreen(!isFullScreen);
    setPanelHeight(isFullScreen ? "65vh" : "85vh");
    playSound("toggle");
  }, [isFullScreen, playSound]);

  const handleSearch = useCallback((e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      track("QuickAccess_Search", { query: searchQuery });
      navigate(`/search?q=${encodeURIComponent(searchQuery)}`);
      closePanel();
    }
  }, [searchQuery, track, navigate, closePanel]);

  const handleQuickAction = useCallback((action) => {
    playSound("click_soft");
    action();
  }, [playSound]);

  const copyProfileLink = useCallback(() => {
    const username = currentUser?.username;
    if (username) {
      const link = `${window.location.origin}/profile/${username}`;
      navigator.clipboard.writeText(link).then(() => {
        track("Profile_Link_Copied");
        // Show success toast
        if (window.toast) {
          window.toast.success("Profile link copied!");
        }
      }).catch(err => {
        console.error("Failed to copy:", err);
      });
    }
  }, [currentUser?.username, track]);

  // ==================== RENDER FUNCTIONS ====================
  const renderUserProfile = () => {
    // Get profile picture - use professional avatar if none
    const profilePicture = currentUser?.photoURL || 
      (currentUser?.uid ? 
        `https://ui-avatars.com/api/?name=${encodeURIComponent(currentUser.displayName || 'User')}&background=3B82F6&color=fff&bold=true&size=200` : 
        "/assets/default-profile.png"
      );
    
    // Handle image error
    const handleImageError = (e) => {
      e.target.onerror = null;
      e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(currentUser?.displayName || 'User')}&background=3B82F6&color=fff&bold=true&size=200`;
    };

    return (
      <motion.div 
        className="relative"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <div className={cn(
          "p-4 sm:p-6 rounded-3xl",
          themeColors.cardBg,
          themeColors.cardBorder,
          "shadow-2xl"
        )}>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            {/* Profile Info */}
            <div className="flex items-start space-x-3 sm:space-x-4 flex-1 min-w-0">
              {/* Profile Avatar with Level Badge */}
              <div className="relative flex-shrink-0">
                {/* Level Badge */}
                <div className="absolute -top-2 -right-2 z-20">
                  <LevelBadge level={levelSystem.currentLevel} size="sm" />
                </div>
                
                {/* Profile Avatar */}
                <motion.div
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setShowProfileMenu(!showProfileMenu)}
                  className="relative cursor-pointer"
                >
                  <div className="relative w-16 h-16 sm:w-20 sm:h-20">
                    {/* Animated gradient border */}
                    <div className={cn(
                      "absolute inset-0 bg-gradient-to-br from-purple-500 via-pink-500 to-blue-500 rounded-full",
                      "animate-spin-slow opacity-70"
                    )} style={{ animationDuration: '8s' }} />
                    
                    {/* Profile image */}
                    <img
                      src={profilePicture}
                      alt={currentUser?.displayName || "Profile"}
                      className="w-14 h-14 sm:w-18 sm:h-18 rounded-full border-4 absolute top-1 left-1 sm:top-1.5 sm:left-1.5 object-cover z-10"
                      style={{
                        borderColor: theme === "dark" 
                          ? "rgba(255, 255, 255, 0.2)" 
                          : "rgba(255, 255, 255, 0.9)"
                      }}
                      onError={handleImageError}
                      loading="lazy"
                    />
                    
                    {/* Online status */}
                    {currentUser?.isOnline && (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="absolute bottom-1 right-1 sm:bottom-2 sm:right-2 w-3 h-3 sm:w-4 sm:h-4 bg-emerald-500 rounded-full border-2 border-white z-20 shadow-xl"
                      >
                        <div className="absolute inset-0 bg-emerald-400 rounded-full animate-ping opacity-60" />
                      </motion.div>
                    )}
                  </div>
                </motion.div>
              </div>

              {/* User Details */}
              <div className="flex-1 min-w-0">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-2 gap-1">
                  <div className="min-w-0">
                    {/* Display Name */}
                    <h3 
                      className={cn(
                        "text-lg sm:text-xl font-bold truncate",
                        themeColors.text
                      )}
                    >
                      {currentUser?.displayName || "User"}
                    </h3>
                    
                    {/* Unique Username with Verification Badge */}
                    <div className="flex items-center gap-2 mt-1">
                      <p 
                        className={cn(
                          "text-xs sm:text-sm truncate font-medium",
                          themeColors.subtext
                        )}
                      >
                        @{currentUser?.username || "username"}
                      </p>
                      
                      {/* Verified Badge */}
                      {currentUser?.isVerified && (
                        <BadgeCheck className="w-4 h-4 text-blue-500 dark:text-blue-400" />
                      )}
                    </div>
                  </div>
                  
                  {/* Copy Profile Link Button */}
                  <button
                    onClick={copyProfileLink}
                    className="p-1.5 sm:p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors flex-shrink-0 mt-2 sm:mt-0"
                    title="Copy profile link"
                    type="button"
                  >
                    <Link className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  </button>
                </div>
                
                {/* Level Progress */}
                <div className="mb-3">
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-gray-600 dark:text-gray-400">
                      Level {levelSystem.currentLevel} → {levelSystem.currentLevel + 1}
                    </span>
                    <span className="font-medium">
                      {levelSystem.currentXP?.toLocaleString()} / {levelSystem.xpForNextLevel?.toLocaleString()} XP
                    </span>
                  </div>
                  <ProgressBar 
                    value={levelSystem.currentXP} 
                    max={levelSystem.xpForNextLevel}
                    color="purple"
                    size="sm"
                    showLabel={false}
                  />
                  <div className="flex justify-between text-xs mt-1">
                    <span className="text-purple-600 dark:text-purple-400 font-medium">
                      {levelSystem.currentLevelName}
                    </span>
                    <span className="text-gray-500 dark:text-gray-400">
                      {levelSystem.progressPercentage.toFixed(1)}%
                    </span>
                  </div>
                </div>
                
                {/* User Badges */}
                <div className="flex flex-wrap gap-1.5 sm:gap-2">
                  <Badge variant="premium" className="text-xs">
                    <FaCoins className="w-3 h-3 mr-1" />
                    {currentUser?.coins?.toLocaleString() || 0}
                  </Badge>
                  
                  <Badge variant="level" className="text-xs">
                    <FaStar className="w-3 h-3 mr-1" />
                    Lvl {levelSystem.currentLevel}
                  </Badge>
                  
                  {currentUser?.isCreator && (
                    <Badge variant="creator" className="text-xs">
                      <Crown className="w-3 h-3 mr-1" />
                      Creator
                    </Badge>
                  )}
                </div>
                
                {/* Bio - Show in fullscreen */}
                {isFullScreen && currentUser?.bio && (
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className={cn(
                      "text-xs sm:text-sm mt-3 line-clamp-3",
                      themeColors.subtext
                    )}
                  >
                    {currentUser.bio}
                  </motion.p>
                )}
              </div>
            </div>
          </div>

          {/* Level Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 mt-4">
            {userStatistics.level.map((stat, index) => (
              <motion.button
                key={stat.label}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.2 + index * 0.1 }}
                onClick={stat.navigate}
                className={cn(
                  "text-center p-2 sm:p-3 rounded-xl",
                  "transition-all duration-200 hover:scale-105",
                  themeColors.cardBg,
                  themeColors.cardBorder
                )}
                type="button"
              >
                <div className={cn(
                  "text-lg sm:text-xl font-bold mb-1",
                  themeColors.text
                )}>
                  {stat.value}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                  {stat.label}
                </div>
                {stat.change && (
                  <div className={cn(
                    "text-xs mt-1 truncate",
                    "text-purple-500 dark:text-purple-400"
                  )}>
                    {stat.change}
                  </div>
                )}
              </motion.button>
            ))}
          </div>
        </div>

        {/* Profile Menu Dropdown */}
        <AnimatePresence>
          {showProfileMenu && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className={cn(
                "absolute right-0 top-full mt-2 w-48 sm:w-56 rounded-xl shadow-2xl z-50",
                theme === "dark" 
                  ? "bg-gray-800 border border-gray-700"
                  : "bg-white border border-gray-200"
              )}
            >
              {[
                { label: "View Profile", icon: User, action: () => navigate(NAVIGATION_PATHS.profile) },
                { label: "Edit Profile", icon: PenSquare, action: () => navigate(NAVIGATION_PATHS.editProfile) },
                { separator: true },
                { label: "Level Progress", icon: TrendingUp, action: () => navigate(NAVIGATION_PATHS.levels) },
                { label: "Achievements", icon: Trophy, action: () => navigate(NAVIGATION_PATHS.achievements) },
                { separator: true },
                { label: "Settings", icon: Settings, action: () => navigate(NAVIGATION_PATHS.settings) },
                { label: "Monetization", icon: DollarSign, action: () => navigate(NAVIGATION_PATHS.monetization) },
                { separator: true },
                { label: "Sign Out", icon: LogOut, action: () => track("Sign_Out_Click"), danger: true }
              ].map((item, index) => (
                item.separator ? (
                  <div key={`sep-${index}`} className="border-t border-gray-200 dark:border-gray-700 my-1" />
                ) : (
                  <motion.button
                    key={item.label}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                    onClick={() => {
                      item.action();
                      setShowProfileMenu(false);
                    }}
                    className={cn(
                      "w-full flex items-center gap-3 px-3 sm:px-4 py-2.5 sm:py-3 text-sm transition-colors",
                      item.danger 
                        ? "text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/20"
                        : theme === "dark"
                          ? "hover:bg-gray-700 text-gray-300"
                          : "hover:bg-gray-100 text-gray-700"
                    )}
                    type="button"
                  >
                    <item.icon className="w-4 h-4" />
                    {item.label}
                  </motion.button>
                )
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    );
  };

  const renderSearchBar = () => (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-4 sm:mb-6"
    >
      <form onSubmit={handleSearch} className="relative">
        <Search className="absolute left-3 sm:left-4 top-1/2 transform -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-gray-400" />
        <input
          ref={searchInputRef}
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search features, navigate..."
          className={cn(
            "w-full pl-10 sm:pl-12 pr-10 sm:pr-12 py-2.5 sm:py-3 rounded-2xl",
            "text-sm placeholder-gray-400",
            "bg-gray-100/50 dark:bg-gray-800/50",
            "border border-gray-300/50 dark:border-gray-700/50",
            "focus:outline-none focus:ring-2",
            theme === "dark" 
              ? "focus:ring-purple-500" 
              : "focus:ring-blue-500"
          )}
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => setSearchQuery("")}
            className="absolute right-3 sm:right-4 top-1/2 transform -translate-y-1/2"
          >
            <X className="w-4 h-4 sm:w-4 sm:h-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300" />
          </button>
        )}
      </form>
    </motion.div>
  );

  const renderDashboard = () => (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-4 sm:space-y-6"
    >
      {/* Content Stats */}
      <div>
        <div className="flex items-center justify-between mb-3 sm:mb-4">
          <h3 className={cn(
            "text-base sm:text-lg font-bold",
            themeColors.text
          )}>
            Content Statistics
          </h3>
          <Badge variant="info">Live</Badge>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:gap-4">
          {userStatistics.content.map((stat, index) => (
            <motion.button
              key={stat.label}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: index * 0.1 }}
              onClick={stat.navigate}
              className={cn(
                "p-3 sm:p-4 rounded-xl sm:rounded-2xl text-left",
                themeColors.cardBg,
                themeColors.cardBorder,
                "transition-all duration-200 hover:scale-105"
              )}
              type="button"
            >
              <div className="flex items-center justify-between mb-2">
                <div className={cn(
                  "p-1.5 sm:p-2 rounded-lg",
                  `bg-${stat.color}-100 dark:bg-${stat.color}-900/30`
                )}>
                  <stat.icon className={cn(
                    "w-4 h-4 sm:w-5 sm:h-5",
                    `text-${stat.color}-600 dark:text-${stat.color}-400`
                  )} />
                </div>
                {stat.change && (
                  <span className={cn(
                    "text-xs font-semibold",
                    "text-emerald-500"
                  )}>
                    {stat.change}
                  </span>
                )}
              </div>
              <div className={cn(
                "text-lg sm:text-xl font-bold mb-1 truncate",
                themeColors.text
              )}>
                {stat.value}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                {stat.label}
              </div>
            </motion.button>
          ))}
        </div>
      </div>

      {/* Social Stats */}
      <div>
        <h3 className={cn(
          "text-base sm:text-lg font-bold mb-3 sm:mb-4",
          themeColors.text
        )}>
          Social Engagement
        </h3>
        <div className="grid grid-cols-2 gap-2 sm:gap-4">
          {userStatistics.social.map((stat, index) => (
            <motion.button
              key={stat.label}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: index * 0.1 }}
              onClick={stat.navigate}
              className={cn(
                "p-3 sm:p-4 rounded-xl sm:rounded-2xl text-left",
                themeColors.cardBg,
                themeColors.cardBorder,
                "transition-all duration-200 hover:scale-105"
              )}
              type="button"
            >
              <div className="flex items-center justify-between mb-2">
                <div className={cn(
                  "p-1.5 sm:p-2 rounded-lg",
                  `bg-${stat.color}-100 dark:bg-${stat.color}-900/30`
                )}>
                  <stat.icon className={cn(
                    "w-4 h-4 sm:w-5 sm:h-5",
                    `text-${stat.color}-600 dark:text-${stat.color}-400`
                  )} />
                </div>
                {stat.change && (
                  <span className={cn(
                    "text-xs font-semibold",
                    "text-emerald-500"
                  )}>
                    {stat.change}
                  </span>
                )}
              </div>
              <div className={cn(
                "text-lg sm:text-xl font-bold mb-1 truncate",
                themeColors.text
              )}>
                {stat.value}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                {stat.label}
              </div>
            </motion.button>
          ))}
        </div>
      </div>
    </motion.div>
  );

  const renderMonetization = () => {
    const canMonetize = currentUser?.level >= 25 || currentUser?.isCreator;
    
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="space-y-4 sm:space-y-6"
      >
        {/* Monetization Stats */}
        <div>
          <div className="flex items-center justify-between mb-3 sm:mb-4">
            <h3 className={cn(
              "text-base sm:text-lg font-bold",
              themeColors.text
            )}>
              Monetization
            </h3>
            <Badge variant={canMonetize ? "monetization" : "warning"}>
              {canMonetize ? "Active" : "Unlock at Level 25"}
            </Badge>
          </div>
          
          {/* Unlock Message */}
          {!canMonetize && (
            <div className={cn(
              "p-4 rounded-2xl mb-4",
              "bg-gradient-to-br from-amber-500/10 via-orange-500/10 to-yellow-500/10",
              "border border-amber-500/20"
            )}>
              <div className="flex items-center gap-3">
                <Lock className="w-6 h-6 text-amber-500" />
                <div>
                  <h4 className="font-bold text-amber-600 dark:text-amber-400">
                    Monetization Locked
                  </h4>
                  <p className="text-sm text-amber-700/70 dark:text-amber-300/70 mt-1">
                    Reach Level 25 to unlock monetization features. You need {25 - (currentUser?.level || 1)} more levels.
                  </p>
                  <ProgressBar 
                    value={currentUser?.level || 1} 
                    max={25}
                    label="Progress to Level 25"
                    color="amber"
                    size="sm"
                    className="mt-3"
                  />
                </div>
              </div>
            </div>
          )}
          
          {/* Earnings Overview */}
          {canMonetize && (
            <>
              <div className={cn(
                "p-4 sm:p-6 rounded-2xl mb-4",
                "bg-gradient-to-br from-emerald-500/10 via-teal-500/10 to-green-500/10",
                "border border-emerald-500/20"
              )}>
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <div className="text-2xl sm:text-3xl font-bold text-emerald-600 dark:text-emerald-400">
                      ${(monetization.totalEarnings || 0).toFixed(2)}
                    </div>
                    <div className="text-sm text-emerald-700/70 dark:text-emerald-300/70">
                      Total Earnings
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg sm:text-xl font-bold text-emerald-500">
                      +${(monetization.todayEarnings || 0).toFixed(2)}
                    </div>
                    <div className="text-xs text-emerald-600/70 dark:text-emerald-400/70">
                      Today
                    </div>
                  </div>
                </div>
                
                <div className="grid grid-cols-3 gap-3">
                  <div className="text-center">
                    <div className="text-sm font-bold text-gray-700 dark:text-gray-300">
                      ${(monetization.thisMonth || 0).toFixed(2)}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      This Month
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-sm font-bold text-gray-700 dark:text-gray-300">
                      ${(monetization.lastMonth || 0).toFixed(2)}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      Last Month
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-sm font-bold text-gray-700 dark:text-gray-300">
                      {monetization.growth || 0}%
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      Growth
                    </div>
                  </div>
                </div>
              </div>

              {/* Monetization Stats Grid */}
              <div className="grid grid-cols-2 gap-2 sm:gap-4">
                {monetizationStats.map((stat, index) => (
                  <motion.button
                    key={stat.label}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: index * 0.1 }}
                    onClick={stat.navigate}
                    className={cn(
                      "p-3 sm:p-4 rounded-xl sm:rounded-2xl text-left",
                      themeColors.cardBg,
                      themeColors.cardBorder,
                      "transition-all duration-200 hover:scale-105"
                    )}
                    type="button"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className={cn(
                        "p-1.5 sm:p-2 rounded-lg",
                        `bg-${stat.color}-100 dark:bg-${stat.color}-900/30`
                      )}>
                        {stat.icon === FaCoins ? (
                          <FaCoins className={cn(
                            "w-4 h-4 sm:w-5 sm:h-5",
                            `text-${stat.color}-600 dark:text-${stat.color}-400`
                          )} />
                        ) : stat.icon === MdAdsClick ? (
                          <MdAdsClick className={cn(
                            "w-4 h-4 sm:w-5 sm:h-5",
                            `text-${stat.color}-600 dark:text-${stat.color}-400`
                          )} />
                        ) : stat.icon === FaBullhorn ? (
                          <FaBullhorn className={cn(
                            "w-4 h-4 sm:w-5 sm:h-5",
                            `text-${stat.color}-600 dark:text-${stat.color}-400`
                          )} />
                        ) : (
                          <stat.icon className={cn(
                            "w-4 h-4 sm:w-5 sm:h-5",
                            `text-${stat.color}-600 dark:text-${stat.color}-400`
                          )} />
                        )}
                      </div>
                      {stat.change && (
                        <span className={cn(
                          "text-xs font-semibold",
                          "text-emerald-500"
                        )}>
                          {stat.change}
                        </span>
                      )}
                    </div>
                    <div className={cn(
                      "text-lg sm:text-xl font-bold mb-1 truncate",
                      themeColors.text
                    )}>
                      {stat.value}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                      {stat.label}
                    </div>
                  </motion.button>
                ))}
              </div>
            </>
          )}
        </div>
      </motion.div>
    );
  };

  const renderAchievements = () => (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-4 sm:space-y-6"
    >
      <div className="flex items-center justify-between mb-3 sm:mb-4">
        <h3 className={cn(
          "text-base sm:text-lg font-bold",
          themeColors.text
        )}>
          Achievements
        </h3>
        <Badge variant="premium">
          {achievements.filter(a => a.unlocked).length}/{achievements.length}
        </Badge>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
        {achievements.map((achievement, index) => (
          <motion.div
            key={achievement.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className={cn(
              "p-3 sm:p-4 rounded-xl sm:rounded-2xl",
              achievement.unlocked 
                ? "bg-gradient-to-br from-emerald-500/10 via-teal-500/10 to-green-500/10 border border-emerald-500/20"
                : cn(themeColors.cardBg, themeColors.cardBorder)
            )}
          >
            <div className="flex items-start justify-between mb-3">
              <div className={cn(
                "p-2 rounded-lg",
                achievement.unlocked 
                  ? "bg-emerald-100 dark:bg-emerald-900/30"
                  : "bg-gray-100 dark:bg-gray-800"
              )}>
                {achievement.icon === FaCoins ? (
                  <FaCoins className={cn(
                    "w-4 h-4 sm:w-5 sm:h-5",
                    achievement.unlocked 
                      ? "text-emerald-600 dark:text-emerald-400" 
                      : "text-gray-400"
                  )} />
                ) : achievement.icon === FaCrown ? (
                  <FaCrown className={cn(
                    "w-4 h-4 sm:w-5 sm:h-5",
                    achievement.unlocked 
                      ? "text-emerald-600 dark:text-emerald-400" 
                      : "text-gray-400"
                  )} />
                ) : (
                  <achievement.icon className={cn(
                    "w-4 h-4 sm:w-5 sm:h-5",
                    achievement.unlocked 
                      ? "text-emerald-600 dark:text-emerald-400" 
                      : "text-gray-400"
                  )} />
                )}
              </div>
              {achievement.unlocked ? (
                <Badge variant="success" className="text-xs">
                  <CheckCircle className="w-3 h-3 mr-1" />
                  Unlocked
                </Badge>
              ) : (
                <Badge variant="default" className="text-xs">
                  {achievement.current}/{achievement.required || 1}
                </Badge>
              )}
            </div>
            
            <h4 className={cn(
              "font-semibold mb-2 text-sm sm:text-base",
              achievement.unlocked 
                ? "text-emerald-700 dark:text-emerald-300"
                : themeColors.text
            )}>
              {achievement.title}
            </h4>
            
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {achievement.date}
              </span>
              <span className="text-xs font-bold text-amber-600 dark:text-amber-400">
                +{achievement.points} pts
              </span>
            </div>
            
            {!achievement.unlocked && (
              <ProgressBar 
                value={achievement.progress} 
                color="purple"
                size="sm"
                showLabel={false}
                className="mt-3"
              />
            )}
          </motion.div>
        ))}
      </div>
    </motion.div>
  );

  const renderQuickActions = () => (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-4 sm:space-y-6"
    >
      {/* Create Actions */}
      <div>
        <h3 className={cn(
          "text-base sm:text-lg font-bold mb-3 sm:mb-4",
          themeColors.text
        )}>
          Create Content
        </h3>
        <div className="grid grid-cols-2 gap-3">
          {quickActions.create.map((action, index) => (
            <motion.button
              key={action.label}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: index * 0.1 }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => handleQuickAction(action.action)}
              className={cn(
                "relative p-3 sm:p-4 rounded-xl text-left",
                "shadow-lg hover:shadow-xl transition-all duration-200",
                `bg-gradient-to-br ${action.color}`
              )}
              type="button"
            >
              {/* Sparkling effect */}
              {action.sparkling && (
                <div className="absolute inset-0 overflow-hidden rounded-xl">
                  <div className="absolute top-1 left-1 w-1.5 h-1.5 bg-white/50 rounded-full animate-ping" />
                  <div className="absolute bottom-1 right-1 w-1 h-1 bg-white/40 rounded-full animate-ping animation-delay-300" />
                </div>
              )}
              
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-2">
                  <action.icon className="w-4 h-4 sm:w-5 sm:h-5 text-white/90" />
                  {action.shortcut && (
                    <span className="text-xs bg-white/20 text-white px-1.5 py-0.5 rounded">
                      {action.shortcut}
                    </span>
                  )}
                </div>
                <h4 className="font-bold text-white text-sm sm:text-base mb-1">{action.label}</h4>
                <p className="text-xs text-white/80">{action.description}</p>
                {action.xpReward && (
                  <div className="text-xs text-amber-300 mt-1">
                    +{action.xpReward} XP
                  </div>
                )}
              </div>
            </motion.button>
          ))}
        </div>
      </div>

      {/* Monetization Actions */}
      <div>
        <h3 className={cn(
          "text-base sm:text-lg font-bold mb-3 sm:mb-4",
          themeColors.text
        )}>
          Monetization
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {quickActions.monetization.map((action, index) => (
            <motion.button
              key={action.label}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: index * 0.1 }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => !action.disabled && handleQuickAction(action.action)}
              className={cn(
                "flex flex-col items-center justify-center p-3 rounded-xl",
                "transition-all duration-200 relative",
                action.disabled 
                  ? "opacity-60 cursor-not-allowed bg-gray-100 dark:bg-gray-800 border border-gray-300/20 dark:border-gray-700/20" 
                  : cn(themeColors.cardBg, themeColors.cardBorder, "hover:shadow-md")
              )}
              type="button"
              disabled={action.disabled}
            >
              {action.disabled && (
                <div className="absolute inset-0 bg-black/10 dark:bg-black/20 rounded-xl flex items-center justify-center z-10">
                  <Lock className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                </div>
              )}
              <div className={cn(
                "p-2 rounded-lg mb-2",
                `bg-gradient-to-br ${action.color}`
              )}>
                {action.icon === FaCoins ? (
                  <FaCoins className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                ) : action.icon === MdAdsClick ? (
                  <MdAdsClick className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                ) : action.icon === FaBullhorn ? (
                  <FaBullhorn className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                ) : (
                  <action.icon className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                )}
              </div>
              <span className="text-xs font-medium text-center">{action.label}</span>
              {action.earnings > 0 && (
                <span className="text-xs text-emerald-500 font-bold mt-1">
                  +${action.earnings.toFixed(2)}
                </span>
              )}
              {action.disabled && (
                <span className="text-xs text-amber-600 font-bold mt-1">
                  {action.disabledText}
                </span>
              )}
            </motion.button>
          ))}
        </div>
      </div>

      {/* Navigation Actions */}
      <div>
        <h3 className={cn(
          "text-base sm:text-lg font-bold mb-3 sm:mb-4",
          themeColors.text
        )}>
          Quick Navigation
        </h3>
        <div className="grid grid-cols-4 gap-2">
          {quickActions.navigate.map((action, index) => (
            <motion.button
              key={action.label}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: index * 0.1 }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => handleQuickAction(action.action)}
              className={cn(
                "flex flex-col items-center justify-center p-2 rounded-xl",
                "transition-all duration-200",
                themeColors.cardBg,
                themeColors.cardBorder,
                "hover:shadow-md"
              )}
              type="button"
            >
              <div className={cn(
                "p-1.5 rounded-lg mb-1.5",
                `bg-gradient-to-br ${action.color}`
              )}>
                <action.icon className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white" />
              </div>
              <span className="text-xs font-medium text-center">{action.label}</span>
            </motion.button>
          ))}
        </div>
      </div>
    </motion.div>
  );

  const renderThemeToggle = () => (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="mt-4 sm:mt-6"
    >
      <div className={cn(
        "p-4 rounded-2xl",
        themeColors.cardBg,
        themeColors.cardBorder
      )}>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className={cn(
              "p-2 rounded-lg",
              theme === "dark" 
                ? "bg-purple-100 dark:bg-purple-900/30" 
                : "bg-amber-100 dark:bg-amber-900/30"
            )}>
              {theme === "dark" ? (
                <Moon className="w-5 h-5 text-purple-600 dark:text-purple-400" />
              ) : (
                <Sun className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              )}
            </div>
            <div>
              <h4 className={cn("font-bold", themeColors.text)}>
                {theme === "dark" ? "Dark Mode" : "Light Mode"}
              </h4>
              <p className={cn("text-xs", themeColors.subtext)}>
                {theme === "dark" ? "Easy on the eyes" : "Bright and clear"}
              </p>
            </div>
          </div>
          <button
            onClick={toggleTheme}
            className={cn(
              "relative w-12 h-6 rounded-full transition-all duration-300",
              theme === "dark" 
                ? "bg-gradient-to-r from-purple-500 to-pink-500" 
                : "bg-gradient-to-r from-amber-500 to-orange-500"
            )}
            type="button"
            aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
          >
            <div className={cn(
              "absolute top-1 w-4 h-4 rounded-full bg-white transition-all duration-300",
              theme === "dark" ? "left-7" : "left-1"
            )} />
          </button>
        </div>
      </div>
    </motion.div>
  );

  const renderContent = () => {
    switch (activeTab) {
      case "dashboard":
        return (
          <>
            {renderDashboard()}
            {renderThemeToggle()}
          </>
        );
      case "actions":
        return (
          <>
            {renderQuickActions()}
            {renderThemeToggle()}
          </>
        );
      case "monetization":
        return (
          <>
            {renderMonetization()}
            {renderThemeToggle()}
          </>
        );
      case "achievements":
        return (
          <>
            {renderAchievements()}
            {renderThemeToggle()}
          </>
        );
      default:
        return (
          <>
            {renderDashboard()}
            {renderThemeToggle()}
          </>
        );
    }
  };

  return (
    <AnimatePresence>
      {isPanelOpen && (
        <>
          {/* Premium Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50"
            onClick={closePanel}
          >
            <div className="absolute inset-0 bg-black/80 backdrop-blur-xl" />
            <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 via-transparent to-blue-500/10" />
          </motion.div>

          {/* Ultra Premium Panel */}
          <motion.div
            ref={panelRef}
            style={{ 
              y,
              opacity,
              height: panelHeight,
              maxHeight: "100vh",
              touchAction: "none",
              maxWidth: "100vw"
            }}
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={ANIMATION_CONFIG.panelSpring}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={0.1}
            dragMomentum={false}
            onDragEnd={handlePanelDragEnd}
            className={cn(
              "fixed bottom-0 left-0 right-0 z-50 rounded-t-3xl overflow-hidden",
              themeColors.panelBg,
              "border-t shadow-4xl",
              theme === "dark" 
                ? "border-gray-800/50" 
                : "border-gray-300/50"
            )}
          >
            {/* Professional Drag Handle */}
            <div className="pt-3 sm:pt-4 pb-1 sm:pb-2 px-4 sm:px-6">
              <div className="flex justify-center items-center mb-1 sm:mb-2">
                <div className={cn(
                  "w-16 sm:w-20 h-1 sm:h-1.5 rounded-full",
                  "bg-gradient-to-r from-purple-500 via-pink-500 to-blue-500",
                  "shadow-lg"
                )} />
              </div>
              
              {/* Panel Header */}
              <div className="flex items-center justify-between mb-3 sm:mb-4">
                <div className="flex items-center space-x-2 sm:space-x-3">
                  <div className={cn(
                    "p-1.5 sm:p-2 rounded-lg sm:rounded-xl",
                    "bg-gradient-to-br from-purple-500 to-pink-500",
                    "shadow-md"
                  )}>
                    <Zap className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                  </div>
                  <div>
                    <h3 className={cn(
                      "text-lg sm:text-xl font-bold",
                      themeColors.text
                    )}>
                      Quick Access
                    </h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                      @{currentUser?.username || "user"} • Level {levelSystem.currentLevel}
                    </p>
                  </div>
                </div>
                
                {/* Control Buttons */}
                <div className="flex items-center space-x-1 sm:space-x-2">
                  <button
                    onClick={toggleFullScreen}
                    className={cn(
                      "p-1.5 sm:p-2 rounded-full transition-all duration-200 hover:scale-110",
                      theme === "dark"
                        ? "hover:bg-gray-800/80 text-gray-400 hover:text-white"
                        : "hover:bg-gray-200/80 text-gray-600 hover:text-gray-900"
                    )}
                    aria-label={isFullScreen ? "Minimize" : "Maximize"}
                    type="button"
                  >
                    {isFullScreen ? (
                      <ChevronDown className="w-4 h-4 sm:w-5 sm:h-5" />
                    ) : (
                      <ChevronUp className="w-4 h-4 sm:w-5 sm:h-5" />
                    )}
                  </button>
                  <button
                    onClick={closePanel}
                    className={cn(
                      "p-1.5 sm:p-2 rounded-full transition-all duration-200 hover:scale-110",
                      theme === "dark"
                        ? "hover:bg-gray-800/80 text-gray-400 hover:text-white"
                        : "hover:bg-gray-200/80 text-gray-600 hover:text-gray-900"
                    )}
                    aria-label="Close Panel"
                    type="button"
                  >
                    <X className="w-4 h-4 sm:w-5 sm:h-5" />
                  </button>
                </div>
              </div>
            </div>

            {/* Search Bar */}
            {renderSearchBar()}

            {/* Main Content Area */}
            <div 
              ref={scrollContainerRef}
              className="px-4 sm:px-6 pb-20 sm:pb-32 overflow-y-auto"
              style={{ 
                height: "calc(100% - 140px)",
                scrollBehavior: "smooth",
                WebkitOverflowScrolling: "touch"
              }}
            >
              {/* User Profile Section */}
              {renderUserProfile()}

              {/* Navigation Tabs */}
              <div className="mt-4 sm:mt-6 mb-4 sm:mb-6">
                <div className="flex overflow-x-auto pb-2 -mx-4 sm:mx-0 px-4 sm:px-0 sm:flex sm:space-x-1 sm:p-1 rounded-xl bg-gray-100/50 dark:bg-gray-800/50">
                  {[
                    { id: "dashboard", label: "Dashboard", icon: BarChart3 },
                    { id: "actions", label: "Actions", icon: Zap },
                    { id: "monetization", label: "Monetization", icon: DollarSign },
                    { id: "achievements", label: "Achievements", icon: Trophy }
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={cn(
                        "flex-shrink-0 py-2 px-3 sm:px-4 rounded-lg text-xs sm:text-sm font-medium transition-all duration-200",
                        "flex items-center justify-center space-x-1.5 sm:space-x-2 mx-0.5 sm:mx-0",
                        activeTab === tab.id
                          ? "bg-white dark:bg-gray-700 shadow-sm"
                          : "hover:bg-white/50 dark:hover:bg-gray-700/50"
                      )}
                      type="button"
                    >
                      <tab.icon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                      <span>{tab.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Tab Content */}
              <div className="mt-4 sm:mt-6">
                {renderContent()}
              </div>

              {/* Footer */}
              <div className="mt-6 sm:mt-8 pt-4 sm:pt-6 border-t border-gray-200 dark:border-gray-800">
                <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                  <div className="flex items-center space-x-2 sm:space-x-4">
                    <span className="hidden sm:inline">Arvdoul v1.0</span>
                    <span className="hidden sm:inline">•</span>
                    <span className="flex items-center">
                      <Wifi className="w-3 h-3 mr-1 text-emerald-500" />
                      <span className="hidden sm:inline">Connected</span>
                    </span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Battery className="w-3 h-3 text-emerald-500" />
                    <span>{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
});

QuickAccessPanel.displayName = 'QuickAccessPanel';

export default QuickAccessPanel;