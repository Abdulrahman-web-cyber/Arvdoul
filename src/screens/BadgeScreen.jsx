// src/screens/BadgeScreen.jsx - ARVDOUL BADGES & ACHIEVEMENTS
// Per Constitution v5.0 - Grid of badges with earned/locked states
import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useTheme } from '@context/ThemeContext';
import { useAuth } from '@context/AuthContext';
import { cn } from '../lib/utils';
import rankingService from '../services/rankingService';
import { Trophy, Star, Zap, Heart, MessageCircle, Users, Video, Crown, Shield, Flame, Lock, Loader2 } from 'lucide-react';

// Badge catalog is canonical (src/config/badgeCatalog.js); this screen only
// maps icon keys to lucide components for rendering.
import { BADGE_CATEGORIES as BADGE_CATALOG } from '../config/badgeCatalog';

const BADGE_ICONS = {
  heart: Heart,
  message: MessageCircle,
  users: Users,
  star: Star,
  video: Video,
  crown: Crown,
  zap: Zap,
  shield: Shield,
  trophy: Trophy,
  flame: Flame,
};

const BADGE_CATEGORIES = Object.fromEntries(
  Object.entries(BADGE_CATALOG).map(([key, category]) => [
    key,
    {
      ...category,
      icon: BADGE_ICONS[category.icon] || Trophy,
      badges: category.badges.map((badge) => ({
        ...badge,
        icon: BADGE_ICONS[badge.icon] || Trophy,
      })),
    },
  ]),
);

export default function BadgeScreen() {
  const navigate = useNavigate();
  const { theme } = useTheme();
  const { user } = useAuth();
  const isDark = theme === 'dark';
  const [selectedCategory, setSelectedCategory] = useState('engagement');
  const [userBadges, setUserBadges] = useState({});
  const [loading, setLoading] = useState(true);

  // Load user's badges from service
  useEffect(() => {
    const loadBadges = async () => {
      if (!user?.uid) {
        setLoading(false);
        return;
      }
      
      try {
        const badges = await rankingService.getUserBadges(user.uid);
        setUserBadges(badges || {});
      } catch (err) {
        console.error('Failed to load badges:', err);
      } finally {
        setLoading(false);
      }
    };
    
    loadBadges();
  }, [user?.uid]);

  const earnedCount = useMemo(() => {
    return Object.values(BADGE_CATEGORIES).reduce((acc, cat) => {
      return acc + cat.badges.filter(b => userBadges[b.id]?.earned).length;
    }, [userBadges]);
  }, [userBadges]);

  const totalBadges = useMemo(() => {
    return Object.values(BADGE_CATEGORIES).reduce((acc, cat) => {
      return acc + cat.badges.length;
    }, 0);
  }, []);

  const getProgressWidth = (badge) => {
    const badgeData = userBadges[badge.id];
    if (!badgeData?.progress || !badgeData?.target) return '0%';
    return `${Math.min((badgeData.progress / badgeData.target) * 100, 100)}%`;
  };

  const isBadgeEarned = (badgeId) => {
    return userBadges[badgeId]?.earned || false;
  };

  // null progress = the metric cannot be verified from available data —
  // show "—" instead of a fabricated 0.
  const getBadgeProgress = (badgeId) => {
    const p = userBadges[badgeId]?.progress;
    return p == null ? null : p;
  };

  const getBadgeTarget = (badgeId) => {
    return userBadges[badgeId]?.target || 0;
  };

  const backgroundStyle = useMemo(() => ({
    background: isDark
      ? 'radial-gradient(circle at 50% 0%, rgba(139, 30, 243, 0.1) 0%, transparent 50%), #03071B'
      : 'radial-gradient(circle at 50% 0%, rgba(139, 30, 243, 0.05) 0%, transparent 50%), #F6F8FC',
  }), [isDark]);

  return (
    <div className="min-h-screen pb-20" style={backgroundStyle}>
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="p-4"
      >
        <div className="flex items-center gap-4 mb-4">
          <button
            onClick={() => navigate(-1)}
            className={cn(
              "p-2 rounded-full",
              isDark ? "hover:bg-white/10" : "hover:bg-black/5"
            )}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className={cn(
            "text-2xl font-display font-bold",
            isDark ? "text-white" : "text-gray-900"
          )}>
            Badges
          </h1>
        </div>

        {/* Stats Card */}
        <div className={cn(
          "rounded-arvdoul-xl p-4 mb-4",
          "bg-arvdoul-surface backdrop-blur-md border border-arvdoul-border"
        )}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-arvdoul-gradient flex items-center justify-center">
                <Trophy className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-arvdoul-text-secondary text-sm">Badges Earned</p>
                <p className="text-2xl font-bold text-white">
                  {earnedCount} <span className="text-lg text-arvdoul-text-secondary">/ {totalBadges}</span>
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-arvdoul-text-secondary text-sm">Progress</p>
              <p className="text-xl font-bold text-arvdoul-purple">
                {Math.round((earnedCount / totalBadges) * 100)}%
              </p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Category Tabs */}
      <div className="px-4 mb-4">
        <div className={cn(
          "flex gap-2 p-1 rounded-arvdoul-lg",
          isDark ? "bg-white/5" : "bg-gray-100"
        )}>
          {Object.entries(BADGE_CATEGORIES).map(([key, category]) => {
            const Icon = category.icon;
            return (
              <motion.button
                key={key}
                whileTap={{ scale: 0.95 }}
                onClick={() => setSelectedCategory(key)}
                className={cn(
                  "flex-1 py-2 px-3 rounded-arvdoul-md flex items-center justify-center gap-2 text-sm font-medium transition-all",
                  selectedCategory === key
                    ? "bg-arvdoul-gradient text-white shadow-arvdoul-button"
                    : isDark 
                      ? "text-arvdoul-text-secondary hover:text-white" 
                      : "text-gray-600 hover:text-gray-900"
                )}
              >
                <Icon className="w-4 h-4" />
                {category.title}
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* Badges Grid */}
      <div className="px-4">
        {/* Loading State */}
        {loading && (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-arvdoul-purple" />
          </div>
        )}

        {/* Badges Grid */}
        {!loading && (
        <div className="grid grid-cols-2 gap-3">
          {BADGE_CATEGORIES[selectedCategory].badges.map((badge, index) => {
            const Icon = badge.icon;
            const isLocked = !isBadgeEarned(badge.id);
            const progress = getBadgeProgress(badge.id);
            const target = getBadgeTarget(badge.id);
            
            return (
              <motion.div
                key={badge.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className={cn(
                  "relative rounded-arvdoul-xl p-4",
                  "backdrop-blur-md border",
                  isLocked
                    ? "border-arvdoul-border bg-arvdoul-surface/30"
                    : "border-arvdoul-purple/30 bg-arvdoul-surface/70"
                )}
              >
                {/* Badge Icon */}
                <div className={cn(
                  "w-12 h-12 rounded-full flex items-center justify-center mb-3",
                  isLocked 
                    ? "bg-gray-500/20" 
                    : "bg-arvdoul-gradient shadow-arvdoul-button"
                )}>
                  {isLocked ? (
                    <Lock className="w-5 h-5 text-gray-500" />
                  ) : (
                    <Icon className="w-6 h-6 text-white" />
                  )}
                </div>

                {/* Badge Info */}
                <h3 className={cn(
                  "font-semibold mb-1",
                  isDark ? "text-white" : "text-gray-900"
                )}>
                  {badge.name}
                </h3>
                <p className={cn(
                  "text-xs",
                  isDark ? "text-arvdoul-text-secondary" : "text-gray-500"
                )}>
                  {badge.description}
                </p>

                {/* Progress Bar (for in-progress badges with real metrics) */}
                {progress != null && progress >= 0 && target > 0 && !isBadgeEarned(badge.id) && (
                  <div className="mt-3">
                    <div className={cn(
                      "h-1.5 rounded-full overflow-hidden",
                      isDark ? "bg-white/10" : "bg-gray-200"
                    )}>
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: getProgressWidth(badge) }}
                        transition={{ duration: 0.8, ease: "easeOut" }}
                        className="h-full bg-arvdoul-gradient"
                      />
                    </div>
                    <p className="text-xs text-arvdoul-text-secondary mt-1">
                      {progress} / {target}
                    </p>
                  </div>
                )}

                {/* Unknown metric — honest "—" instead of a fabricated 0 */}
                {progress == null && !isBadgeEarned(badge.id) && (
                  <p className="text-[11px] text-arvdoul-text-secondary/70 mt-3">Progress not available yet</p>
                )}

                {/* Earned Check */}
                {isBadgeEarned(badge.id) && (
                  <div className="absolute top-2 right-2">
                    <div className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center">
                      <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    </div>
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
        )}
      </div>
    </div>
  );
}
