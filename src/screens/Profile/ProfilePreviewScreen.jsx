/**
 * src/screens/Profile/ProfilePreviewScreen.jsx - ARVDOUL Profile Preview Screen
 * 
 * Deep preview mode for the user's profile before or after editing.
 * Supports toggling between Owner Perspective and Visitor Perspective.
 * Displays hero identity, metric strip, highlights, and tabbed feed content.
 * 
 * @component
 */

import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { useProfileStore } from '../../store/profileStore';
import { useAppStore } from '../../store/appStore';
import { cn } from '../../lib/utils';
import { ArrowLeft, Edit3, Eye, ShieldCheck, User } from 'lucide-react';
import ProfileHeroSection from '../../components/profile/ProfileHeroSection';
import ProfileMetricsGrid from '../../components/profile/ProfileMetricsGrid';
import ProfileHighlightsSection from '../../components/profile/ProfileHighlightsSection';
import ProfileTabsBar from '../../components/profile/ProfileTabsBar';
import ProfileFeedGrid from '../../components/profile/ProfileFeedGrid';
import ProfileSkeleton from '../../components/profile/ProfileSkeleton';
import { getSafeAvatarUrl } from '../../utils/avatarUtils';
import { getStoredUid, getStoredUser } from '../../utils/security';
import { resolveCapabilities } from '../../services/profileCapabilityEngine';

/**
 * ProfilePreviewScreen Component
 */
export default function ProfilePreviewScreen({
  profile: propProfile,
  loading: propLoading = false,
  onSave,
  onBack,
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const { user: authUser } = useAuth();
  const storeUser = useAppStore((state) => state.currentUser);
  const storeProfile = useProfileStore((state) => state.profile);
  const storePosts = useProfileStore((state) => state.posts);
  const storeHighlights = useProfileStore((state) => state.highlights);
  const loadProfile = useProfileStore((state) => state.loadProfile);

  const [activeTab, setActiveTab] = useState('posts');
  const [viewPerspective, setViewPerspective] = useState('owner'); // 'owner' | 'visitor'

  const currentUserId = authUser?.uid || storeUser?.uid || getStoredUid();

  // Resolve active profile from props, location.state, store, or auth
  const rawProfile = propProfile || location.state?.profile || storeProfile || storeUser || authUser || getStoredUser();

  useEffect(() => {
    if (!rawProfile && currentUserId) {
      loadProfile(currentUserId, currentUserId);
    }
  }, [rawProfile, currentUserId, loadProfile]);

  const effectiveProfile = useMemo(() => {
    if (!rawProfile && !currentUserId) return null;
    const p = rawProfile || {};
    const safeDisplayName = p.displayName || p.name || 'Arvdoul Citizen';
    const safeUsername = p.username || authUser?.email?.split('@')[0] || 'citizen';
    return {
      ...p,
      id: p.id || p.uid || currentUserId,
      uid: p.uid || p.id || currentUserId,
      displayName: safeDisplayName,
      username: safeUsername,
      bio: p.bio || '',
      location: p.location || '',
      website: p.website || '',
      level: Number(p.level || p.creatorLevel || 1),
      photoURL: getSafeAvatarUrl(p.photoURL || authUser?.photoURL, safeDisplayName, currentUserId),
      followerCount: Number(p.followerCount ?? p.followersCount ?? 0),
      followingCount: Number(p.followingCount ?? 0),
      postCount: Number(p.postCount ?? storePosts?.length ?? 0),
      coins: Number(p.coins ?? p.coinBalance ?? 0),
      isVerified: Boolean(p.isVerified || p.verified),
      isPrivate: Boolean(p.isPrivate),
    };
  }, [rawProfile, currentUserId, authUser, storePosts?.length]);

  const isOwnerMode = viewPerspective === 'owner';

  const capabilities = useMemo(() => {
    return resolveCapabilities({
      viewer: authUser,
      target: effectiveProfile,
      relationship: {
        isOwner: isOwnerMode,
        isFollowing: !isOwnerMode,
        isFollower: true,
      },
      viewAs: isOwnerMode ? null : 'public',
    });
  }, [authUser, effectiveProfile, isOwnerMode]);

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      navigate(-1);
    }
  };

  const handleEdit = () => {
    navigate('/profile/edit');
  };

  if (propLoading || (!effectiveProfile && currentUserId)) {
    return (
      <div className={cn(
        'min-h-screen pb-20',
        isDark ? 'bg-[#060816]' : 'bg-[#f0f4fa]'
      )}>
        <ProfileSkeleton theme={theme} />
      </div>
    );
  }

  return (
    <div className={cn(
      'min-h-screen pb-24 transition-colors',
      isDark ? 'bg-[#060816] text-white' : 'bg-[#f0f4fa] text-slate-900'
    )}>
      {/* Top Bar with Perspective Selector */}
      <div className={cn(
        'sticky top-0 z-30 backdrop-blur-xl border-b transition-colors',
        isDark ? 'bg-[#060816]/90 border-slate-800' : 'bg-white/90 border-slate-200 shadow-sm'
      )}>
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              onClick={handleBack}
              className={cn(
                'p-2 rounded-xl border transition-colors',
                isDark ? 'bg-[#0d1424] border-slate-800 hover:bg-slate-800' : 'bg-slate-100 border-slate-200 hover:bg-slate-200'
              )}
              aria-label="Back"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-1.5 text-xs font-bold">
              <Eye className="w-4 h-4 text-purple-500" />
              <span>Profile Preview</span>
            </div>
          </div>

          {/* Perspective Toggle */}
          <div className="flex items-center gap-1 bg-slate-200/80 dark:bg-white/10 p-1 rounded-xl">
            <button
              onClick={() => setViewPerspective('owner')}
              className={cn(
                "px-3 py-1 text-xs font-bold rounded-lg transition-all",
                viewPerspective === 'owner'
                  ? "bg-purple-600 text-white shadow-sm"
                  : "text-slate-600 dark:text-slate-300 hover:bg-white/20"
              )}
            >
              Owner View
            </button>
            <button
              onClick={() => setViewPerspective('visitor')}
              className={cn(
                "px-3 py-1 text-xs font-bold rounded-lg transition-all",
                viewPerspective === 'visitor'
                  ? "bg-purple-600 text-white shadow-sm"
                  : "text-slate-600 dark:text-slate-300 hover:bg-white/20"
              )}
            >
              Visitor View
            </button>
          </div>

          <button
            onClick={handleEdit}
            className={cn(
              'px-3.5 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all shadow-sm',
              'bg-gradient-to-r from-purple-600 to-indigo-600 text-white hover:opacity-90'
            )}
          >
            <Edit3 className="w-3.5 h-3.5" />
            <span>Edit Profile</span>
          </button>
        </div>
      </div>

      {/* Main Preview Container */}
      <div className="max-w-5xl mx-auto px-3 sm:px-6 py-4 space-y-4">
        {/* Banner notification for Visitor Mode */}
        {viewPerspective === 'visitor' && (
          <div className="px-4 py-2.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-500 text-xs font-semibold flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 shrink-0" />
            <span>Simulating how your profile appears to the public and potential followers.</span>
          </div>
        )}

        {/* 1. Hero Identity Header */}
        <ProfileHeroSection
          profile={effectiveProfile}
          isOwner={isOwnerMode}
          level={effectiveProfile?.level || 1}
          theme={theme}
          onBack={handleBack}
          onEditProfile={handleEdit}
        />

        {/* 2. Key Metrics Grid */}
        <ProfileMetricsGrid
          isOwner={isOwnerMode}
          theme={theme}
          profile={effectiveProfile}
          capabilities={capabilities}
        />

        {/* 3. Story Highlights / Vibes Carousel */}
        <ProfileHighlightsSection
          highlights={storeHighlights}
          userId={currentUserId}
          isOwner={isOwnerMode}
          theme={theme}
        />

        {/* 4. Tabs Strip */}
        <ProfileTabsBar
          activeTab={activeTab}
          onTabChange={setActiveTab}
          isOwner={isOwnerMode}
          theme={theme}
          counts={{ posts: storePosts?.length || 0 }}
        />

        {/* 5. Feed & Tab Content */}
        <ProfileFeedGrid
          posts={storePosts || []}
          savedPosts={[]}
          activeTab={activeTab}
          loading={false}
          theme={theme}
          profile={effectiveProfile}
        />
      </div>
    </div>
  );
}
