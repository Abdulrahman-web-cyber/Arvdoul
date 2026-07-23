// src/screens/Menu/MenuScreen.jsx – ARVDOUL ULTIMATE MENU SCREEN V2
// 🎯 Advanced Floating Card Navigation Hub • Ultra Pro Max Professional Design
// ✅ WCAG 2.1 AA Compliant • Glass Morphism • Smooth Animations • Rich Icons

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FaHome, FaSearch, FaUser, FaCog, FaBell, FaWallet, FaChartLine, 
  FaUsers, FaVideo, FaMusic, FaImage, FaCalendar, FaComments,
  FaCrown, FaShieldAlt, FaPaintBrush, FaQuestionCircle, FaInfo,
  FaSignOutAlt, FaChevronRight, FaStar, FaHeart, FaBookmark,
  FaPlay, FaTrophy, FaRocket, FaPaintRoller, FaMicrophone,
  FaLayerGroup, FaPuzzlePiece, FaGift, FaCoins, FaGem, FaDiamond, 
  FaFire, FaBolt, FaGlobe, FaClock, FaHistory,
  FaPlayCircle, FaMicrophoneAlt, FaPlusCircle, FaArrowUp, FaArrowDown,
  FaTwitter, FaInstagram, FaDiscord, FaYoutube, FaTiktok,
  FaFacebook, FaGithub, FaLinkedin, FaReddit, FaSnapchat, FaSpotify,
  FaTimes
} from 'react-icons/fa';
import { useTheme } from '../../context/ThemeContext.jsx';
import { useAuth } from '../../context/AuthContext.jsx';

// ==================== ANIMATION VARIANTS ====================
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.05, delayChildren: 0.1 }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 20, scale: 0.95 },
  visible: { 
    opacity: 1, 
    y: 0, 
    scale: 1,
    transition: { type: 'spring', stiffness: 300, damping: 25 }
  }
};

const cardHoverVariants = {
  rest: { scale: 1, y: 0 },
  hover: { 
    scale: 1.02, 
    y: -4,
    transition: { type: 'spring', stiffness: 400, damping: 30 }
  },
  tap: { scale: 0.98 }
};

// ==================== GLASS CARD COMPONENT ====================
const GlassCard = ({ children, className = '', onClick, delay = 0 }) => (
  <motion.div
    variants={cardHoverVariants}
    initial="hidden"
    animate="visible"
    whileHover="hover"
    whileTap="tap"
    onClick={onClick}
    style={{ animationDelay: `${delay}ms` }}
    className={`
      relative overflow-hidden
      bg-white/10 dark:bg-gray-800/40
      backdrop-blur-xl backdrop-saturate-150
      border border-white/20 dark:border-gray-700/50
      rounded-2xl
      shadow-lg shadow-black/10
      cursor-pointer
      transition-all duration-300
      hover:shadow-xl hover:shadow-black/20
      hover:border-white/30 dark:hover:border-gray-600/50
      ${className}
    `}
  >
    <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none" />
    {children}
  </motion.div>
);

// ==================== ICON CARD COMPONENT ====================
const IconCard = ({ icon: Icon, label, description, color, onClick, badge, size = 'md' }) => {
  const sizeClasses = {
    sm: 'p-3',
    md: 'p-4',
    lg: 'p-6'
  };
  
  return (
    <GlassCard onClick={onClick} className={sizeClasses[size]}>
      <div className="flex items-center gap-4">
        <div 
          className="w-12 h-12 md:w-14 md:h-14 rounded-xl flex items-center justify-center"
          style={{ 
            background: `linear-gradient(135deg, ${color}20 0%, ${color}40 100%)`,
            boxShadow: `0 4px 15px ${color}30`
          }}
        >
          <Icon className="text-2xl text-white" style={{ color }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-white font-semibold text-sm md:text-base truncate">{label}</h3>
            {badge && (
              <span className="px-2 py-0.5 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full text-xs text-white font-medium animate-pulse">
                {badge}
              </span>
            )}
          </div>
          {description && (
            <p className="text-gray-400 text-xs md:text-sm truncate mt-0.5">{description}</p>
          )}
        </div>
        <FaChevronRight className="text-gray-500 text-sm" />
      </div>
    </GlassCard>
  );
};

// ==================== SECTION HEADER ====================
const SectionHeader = ({ icon: Icon, title, subtitle, gradient = 'from-purple-500 to-pink-500' }) => (
  <motion.div variants={itemVariants} className="mb-4">
    <div className="flex items-center gap-3 mb-1">
      <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${gradient} flex items-center justify-center shadow-lg`}>
        <Icon className="text-white text-sm" />
      </div>
      <h2 className="text-lg font-bold text-white">{title}</h2>
    </div>
    {subtitle && (
      <p className="text-gray-500 text-sm ml-11">{subtitle}</p>
    )}
  </motion.div>
);

// ==================== QUICK STATS WIDGET ====================
const QuickStatsWidget = ({ stats }) => (
  <motion.div variants={itemVariants} className="mb-6">
    <div className="grid grid-cols-4 gap-3">
      {stats.map((stat, index) => (
        <div 
          key={index}
          className="bg-gradient-to-br from-gray-800/60 to-gray-900/60 backdrop-blur-xl border border-gray-700/50 rounded-xl p-3 text-center"
        >
          <div className="text-xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
            {stat.value}
          </div>
          <div className="text-xs text-gray-500 mt-1">{stat.label}</div>
        </div>
      ))}
    </div>
  </motion.div>
);

// ==================== FEATURED CARD ====================
const FeaturedCard = ({ title, subtitle, icon: Icon, gradient, onClick }) => (
  <GlassCard onClick={onClick} className="p-5">
    <div className="flex items-center gap-4">
      <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${gradient} flex items-center justify-center shadow-xl`}>
        <Icon className="text-white text-2xl" />
      </div>
      <div className="flex-1">
        <h3 className="text-white font-bold text-lg">{title}</h3>
        <p className="text-gray-400 text-sm mt-1">{subtitle}</p>
      </div>
      <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center">
        <FaChevronRight className="text-white" />
      </div>
    </div>
  </GlassCard>
);

// ==================== SOCIAL BUTTONS ====================
const SocialButtons = () => (
  <motion.div variants={itemVariants} className="flex items-center justify-center gap-4 mt-6">
    {[
      { icon: FaTwitter, color: '#1DA1F2', label: 'Twitter' },
      { icon: FaInstagram, color: '#E4405F', label: 'Instagram' },
      { icon: FaDiscord, color: '#5865F2', label: 'Discord' },
      { icon: FaYoutube, color: '#FF0000', label: 'YouTube' },
      { icon: FaTiktok, color: '#000000', label: 'TikTok' },
    ].map((social, index) => (
      <motion.a
        key={index}
        href="#"
        whileHover={{ scale: 1.1, y: -2 }}
        whileTap={{ scale: 0.95 }}
        className="w-11 h-11 rounded-xl bg-white/5 backdrop-blur-lg border border-white/10 flex items-center justify-center hover:bg-white/10 transition-all"
        aria-label={social.label}
      >
        <social.icon className="text-lg" style={{ color: social.color }} />
      </motion.a>
    ))}
  </motion.div>
);

// ==================== MAIN MENU SCREEN ====================
export default function MenuScreen() {
  const navigate = useNavigate();
  const { theme } = useTheme();
  const { user, signOut } = useAuth();
  const [activeCategory, setActiveCategory] = useState('main');
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const userStats = useMemo(() => [
    { label: 'Followers', value: '12.5K' },
    { label: 'Following', value: '892' },
    { label: 'Posts', value: '156' },
    { label: 'Coins', value: '45.2K' },
  ], []);

  const mainNavItems = useMemo(() => [
    { icon: FaHome, label: 'Home Feed', description: 'Your personalized timeline', color: '#6366f1', path: '/home', badge: null },
    { icon: FaSearch, label: 'Search & Explore', description: 'Discover new content & people', color: '#8b5cf6', path: '/search', badge: null },
    { icon: FaUser, label: 'My Profile', description: 'View and edit your profile', color: '#ec4899', path: '/profile', badge: null },
    { icon: FaComments, label: 'Messages', description: 'Direct messages & group chats', color: '#06b6d4', path: '/messages', badge: '3 new' },
    { icon: FaBell, label: 'Notifications', description: 'Alerts and activity updates', color: '#f59e0b', path: '/notifications', badge: '12' },
    { icon: FaBookmark, label: 'Saved Items', description: 'Your saved posts & collections', color: '#10b981', path: '/saved', badge: null },
  ], []);

  const createItems = useMemo(() => [
    { icon: FaVideo, label: 'Create Video', description: 'Record or upload a video', color: '#ef4444', path: '/create/video', badge: null },
    { icon: FaImage, label: 'Create Post', description: 'Share text, images, or polls', color: '#22c55e', path: '/create/post', badge: null },
    { icon: FaMusic, label: 'Create Audio', description: 'Upload audio content', color: '#f97316', path: '/create/audio', badge: null },
    { icon: FaCalendar, label: 'Create Event', description: 'Host a live event', color: '#a855f7', path: '/event/create', badge: null },
    { icon: FaLayerGroup, label: 'Create Community', description: 'Build your own community', color: '#3b82f6', path: '/community/create', badge: 'New' },
    { icon: FaPlayCircle, label: 'Go Live', description: 'Start a live stream', color: '#ec4899', path: '/live', badge: null },
  ], []);

  const discoverItems = useMemo(() => [
    { icon: FaTrophy, label: 'Leaderboards', description: 'Top creators & trending', color: '#fbbf24', path: '/rankings', badge: null },
    { icon: FaCoins, label: 'Wallet & Coins', description: 'Manage your coins', color: '#f59e0b', path: '/coins', badge: null },
    { icon: FaRocket, label: 'Creator Studio', description: 'Analytics & tools', color: '#8b5cf6', path: '/profile/analytics', badge: null },
    { icon: FaUsers, label: 'Communities', description: 'Browse & join communities', color: '#06b6d4', path: '/community', badge: null },
    { icon: FaCalendar, label: 'Events', description: 'Upcoming & past events', color: '#10b981', path: '/event', badge: null },
    { icon: FaPlay, label: 'Reels & Videos', description: 'Watch viral content', color: '#ef4444', path: '/videos', badge: null },
  ], []);

  const settingsItems = useMemo(() => [
    { icon: FaCog, label: 'Settings', description: 'App preferences & account', color: '#6b7280', path: '/settings', badge: null },
    { icon: FaShieldAlt, label: 'Privacy & Security', description: 'Manage your privacy', color: '#10b981', path: '/settings/privacy', badge: null },
    { icon: FaBell, label: 'Notifications', description: 'Notification preferences', color: '#f59e0b', path: '/settings/notifications', badge: null },
    { icon: FaPaintBrush, label: 'Appearance', description: 'Theme, colors & display', color: '#8b5cf6', path: '/settings/appearance', badge: null },
    { icon: FaQuestionCircle, label: 'Help & Support', description: 'FAQs & contact support', color: '#3b82f6', path: '/help', badge: null },
    { icon: FaInfo, label: 'About Arvdoul', description: 'App info & legal', color: '#6b7280', path: '/about', badge: null },
  ], []);

  const handleLogout = async () => {
    try {
      await signOut();
      navigate('/login');
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  const getCategoryIcon = (cat) => {
    switch(cat) {
      case 'main': return FaHome;
      case 'create': return FaPlusCircle;
      case 'discover': return FaGlobe;
      case 'settings': return FaCog;
      default: return FaHome;
    }
  };

  const getCategoryTitle = (cat) => {
    switch(cat) {
      case 'main': return 'Menu';
      case 'create': return 'Create';
      case 'discover': return 'Discover';
      case 'settings': return 'Settings';
      default: return 'Menu';
    }
  };

  const getCategoryItems = (cat) => {
    switch(cat) {
      case 'main': return mainNavItems;
      case 'create': return createItems;
      case 'discover': return discoverItems;
      case 'settings': return settingsItems;
      default: return mainNavItems;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900/20 to-gray-900">
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-pink-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
        <div className="absolute top-1/2 left-1/2 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '2s' }} />
      </div>

      <div className="relative z-10 max-w-lg mx-auto px-4 py-6 pb-24">
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6"
        >
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-white via-purple-200 to-pink-200 bg-clip-text text-transparent">
                {getCategoryTitle(activeCategory)}
              </h1>
              <p className="text-gray-500 text-sm mt-1">Welcome back, {user?.displayName || 'Citizen'}</p>
            </div>
            <motion.div
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shadow-lg shadow-purple-500/30"
            >
              <span className="text-white font-bold text-lg">
                {(user?.displayName || 'A').charAt(0).toUpperCase()}
              </span>
            </motion.div>
          </div>

          <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide">
            {['main', 'create', 'discover', 'settings'].map((cat) => {
              const Icon = getCategoryIcon(cat);
              const isActive = activeCategory === cat;
              return (
                <motion.button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className={`
                    flex items-center gap-2 px-4 py-2 rounded-xl whitespace-nowrap transition-all
                    ${isActive 
                      ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg shadow-purple-500/30' 
                      : 'bg-white/5 text-gray-400 hover:bg-white/10'}
                  `}
                >
                  <Icon className="text-sm" />
                  <span className="text-sm font-medium capitalize">{cat}</span>
                </motion.button>
              );
            })}
          </div>
        </motion.div>

        {activeCategory === 'main' && (
          <QuickStatsWidget stats={userStats} />
        )}

        {activeCategory === 'discover' && (
          <motion.div variants={itemVariants} className="mb-6 space-y-3">
            <FeaturedCard
              title="Creator Challenge"
              subtitle="Join the #SummerVibes challenge and win 10K coins!"
              icon={FaTrophy}
              gradient="from-yellow-500 to-orange-500"
              onClick={() => navigate('/challenges')}
            />
            <FeaturedCard
              title="Go Live Today"
              subtitle="Start streaming and earn bonus coins"
              icon={FaRocket}
              gradient="from-purple-500 to-pink-500"
              onClick={() => navigate('/live')}
            />
          </motion.div>
        )}

        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="space-y-3"
        >
          {getCategoryItems(activeCategory).map((item, index) => (
            <motion.div key={item.label} variants={itemVariants}>
              <IconCard
                icon={item.icon}
                label={item.label}
                description={item.description}
                color={item.color}
                badge={item.badge}
                onClick={() => navigate(item.path)}
              />
            </motion.div>
          ))}
        </motion.div>

        {activeCategory === 'settings' && (
          <motion.div variants={itemVariants} className="mt-8">
            <GlassCard 
              onClick={() => setShowLogoutConfirm(true)}
              className="p-4 border-red-500/30 hover:border-red-500/50"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-red-500/20 to-red-600/40 flex items-center justify-center">
                  <FaSignOutAlt className="text-red-500 text-xl" />
                </div>
                <div className="flex-1">
                  <h3 className="text-red-400 font-semibold">Sign Out</h3>
                  <p className="text-gray-500 text-sm">Log out of your account</p>
                </div>
              </div>
            </GlassCard>
          </motion.div>
        )}

        <SocialButtons />

        <motion.div variants={itemVariants} className="mt-8 text-center">
          <p className="text-gray-600 text-xs">Arvdoul Nation v2.0.0</p>
          <p className="text-gray-700 text-xs mt-1">Built with ❤️ for creators</p>
        </motion.div>
      </div>

      <AnimatePresence>
        {showLogoutConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowLogoutConfirm(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-gray-800 rounded-3xl p-6 w-full max-w-sm shadow-2xl border border-gray-700"
            >
              <div className="text-center mb-6">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-red-500 to-orange-500 flex items-center justify-center">
                  <FaSignOutAlt className="text-white text-2xl" />
                </div>
                <h3 className="text-xl font-bold text-white mb-2">Sign Out?</h3>
                <p className="text-gray-400 text-sm">Are you sure you want to sign out of your account?</p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowLogoutConfirm(false)}
                  className="flex-1 px-4 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-xl font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleLogout}
                  className="flex-1 px-4 py-3 bg-gradient-to-r from-red-500 to-orange-500 hover:from-red-600 hover:to-orange-600 text-white rounded-xl font-medium transition-colors shadow-lg shadow-red-500/30"
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
