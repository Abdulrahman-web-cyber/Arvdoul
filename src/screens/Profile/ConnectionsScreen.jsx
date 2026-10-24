// src/screens/Profile/ConnectionsScreen.jsx
//
// Unified Connections Screen for Arvdoul Digital Nation.
// Unifies Followers, Following, and Mutual Friends tabs with real backend telemetry.
// Adheres strictly to Zero-Pill discipline, heraldic dignity, and privacy capability governance.

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { cn } from '../../lib/utils';
import {
  Search,
  Users,
  UserCheck,
  UserPlus,
  ShieldCheck,
  MessageCircle,
  Lock,
  Loader2,
  X,
  Sparkles,
  ExternalLink,
} from 'lucide-react';
import FollowButton from '../../components/profile/FollowButton';
import { useProfileStore } from '../../store/profileStore';
import { useAppStore } from '../../store/appStore';
import { getSafeAvatarUrl } from '../../utils/avatarUtils';
import { getStoredUid } from '../../utils/security';
import { resolveCapabilities } from '../../services/profileCapabilityEngine';
import { getRankTitle, getCitizenTier, LEVEL_GATES } from '../../shared/levelConfig.cjs';

export default function ConnectionsScreen({ initialTab: propInitialTab }) {
  const { userId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const { user: authUser, userProfile } = useAuth();
  const storeUser = useAppStore((state) => state.currentUser);
  const currentUser = authUser || storeUser || userProfile;
  const currentUserId = currentUser?.uid || authUser?.uid || getStoredUid();

  const targetUserId = userId || currentUserId;
  const isOwner = Boolean(currentUserId && targetUserId === currentUserId);

  // Basic level users start with community Friends; Level 3+ unlocks public Followers
  const effectiveLevel = Number(targetProfile?.level || userProfile?.level || currentUser?.level) || 1;
  const isCreatorOrAdvanced = Boolean(
    targetProfile?.isCreator || 
    userProfile?.isCreator || 
    effectiveLevel >= LEVEL_GATES.publicFollowers
  );

  // Derive initial active tab from props or route path
  const derivedInitialTab = useMemo(() => {
    if (propInitialTab) return propInitialTab;
    const pathname = location.pathname.toLowerCase();
    if (pathname.includes('/following')) return 'following';
    if (pathname.includes('/followers')) return 'followers';
    if (pathname.includes('/friends')) return 'friends';
    // When visiting without explicit subpath, basic level users default to friends
    return isCreatorOrAdvanced ? 'followers' : 'friends';
  }, [propInitialTab, location.pathname, isCreatorOrAdvanced]);

  const [activeTab, setActiveTab] = useState(derivedInitialTab);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Lists state
  const [followers, setFollowers] = useState([]);
  const [following, setFollowing] = useState([]);
  const [friends, setFriends] = useState([]);
  
  // Loading & privacy state
  const [loading, setLoading] = useState(true);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [targetProfile, setTargetProfile] = useState(null);

  const { follow, unfollow, followLoading } = useProfileStore();

  // Load target profile & check capabilities
  useEffect(() => {
    let isMounted = true;
    const loadData = async () => {
      if (!targetUserId) return;
      setLoading(true);
      setPermissionDenied(false);

      try {
        const userServiceModule = await import('../../services/userService.js');
        const userService = userServiceModule.getUserService();

        // 1. Fetch target profile & viewer relationship
        const [profile, rel] = await Promise.all([
          userService.getUserProfile(targetUserId, currentUserId).catch(() => null),
          currentUserId && currentUserId !== targetUserId
            ? userService.getRelationshipState(currentUserId, targetUserId).catch(() => null)
            : Promise.resolve({ isOwner: true }),
        ]);

        if (isMounted) {
          setTargetProfile(profile);
        }

        // 2. Resolve capability permissions
        const caps = resolveCapabilities({
          viewer: currentUser,
          target: profile,
          relationship: rel || {},
        });

        if (caps && caps.canViewFollowers === false && !isOwner) {
          if (isMounted) {
            setPermissionDenied(true);
            setLoading(false);
          }
          return;
        }

        // 3. Fetch all 3 connection graphs in parallel
        const [followersRes, followingRes, friendsRes] = await Promise.allSettled([
          userService.getFollowers(targetUserId),
          userService.getFollowing(targetUserId),
          currentUserId && currentUserId !== targetUserId
            ? userService.getMutualFriends(currentUserId, targetUserId)
            : userService.getFollowers(targetUserId).then((r) => ({
                mutualFriends: (r.followers || []).filter((f) => f.isFollowing),
              })),
        ]);

        if (isMounted) {
          if (followersRes.status === 'fulfilled') {
            setFollowers(followersRes.value?.followers || []);
          }
          if (followingRes.status === 'fulfilled') {
            setFollowing(followingRes.value?.following || []);
          }
          if (friendsRes.status === 'fulfilled') {
            setFriends(friendsRes.value?.mutualFriends || friendsRes.value?.friends || []);
          }
        }
      } catch (err) {
        console.error('Failed to load connection graph:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadData();
    return () => {
      isMounted = false;
    };
  }, [targetUserId, currentUserId, isOwner, currentUser]);

  // Handle follow toggle with optimistic update across all lists
  const handleFollowToggle = useCallback(async (targetId, currentFollowState) => {
    if (!currentUserId) return;
    const nextState = !currentFollowState;

    // Optimistically update lists
    const updater = (list) =>
      list.map((u) => (u.id === targetId || u.uid === targetId ? { ...u, isFollowing: nextState } : u));
    setFollowers(updater);
    setFollowing(updater);
    setFriends(updater);

    try {
      if (nextState) {
        await follow(currentUserId, targetId);
      } else {
        await unfollow(currentUserId, targetId);
      }
    } catch (err) {
      // Rollback on failure
      const rollbacker = (list) =>
        list.map((u) => (u.id === targetId || u.uid === targetId ? { ...u, isFollowing: currentFollowState } : u));
      setFollowers(rollbacker);
      setFollowing(rollbacker);
      setFriends(rollbacker);
    }
  }, [currentUserId, follow, unfollow]);

  // Filter current active list by search query
  const currentItems = useMemo(() => {
    let rawList = [];
    if (activeTab === 'followers') rawList = followers;
    else if (activeTab === 'following') rawList = following;
    else if (activeTab === 'friends') rawList = friends;

    if (!searchQuery.trim()) return rawList;
    const q = searchQuery.toLowerCase().trim();
    return rawList.filter((item) => {
      const name = (item.displayName || '').toLowerCase();
      const user = (item.username || '').toLowerCase();
      const bio = (item.bio || '').toLowerCase();
      return name.includes(q) || user.includes(q) || bio.includes(q);
    });
  }, [activeTab, followers, following, friends, searchQuery]);

  return (
    <div className={cn(
      "min-h-screen pb-24 transition-colors duration-200",
      isDark
        ? "bg-[#060816] text-white selection:bg-purple-500/30"
        : "bg-[#f0f4fa] text-slate-900 selection:bg-purple-500/20"
    )}>
      {/* Main Container - TopAppBar handles title and back navigation */}
      <div className="max-w-3xl mx-auto px-4 pt-3 sm:pt-4 space-y-4">
        {/* Unified 3-Tab Navigator: Followers | Following | Mutual Friends */}
        <div className={cn(
          "p-1 rounded-2xl border backdrop-blur-xl transition-all shadow-sm",
          isDark ? "bg-white/[0.04] border-white/10" : "bg-white border-slate-200"
        )}>
          <div className="grid grid-cols-3 gap-1">
            {/* Tab 1: Followers */}
            <button
              type="button"
              onClick={() => {
                setActiveTab('followers');
                setSearchQuery('');
              }}
              className={cn(
                "py-2.5 px-2 text-xs sm:text-sm font-bold flex items-center justify-center gap-2 rounded-xl transition-all cursor-pointer",
                activeTab === 'followers'
                  ? (isDark ? "bg-purple-600 text-white shadow" : "bg-purple-600 text-white shadow")
                  : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
              )}
            >
              <Users className="w-4 h-4 shrink-0" />
              <span>Followers</span>
              <span className={cn(
                "text-[10px] font-mono px-1.5 py-0.5 rounded-md",
                activeTab === 'followers'
                  ? "bg-white/20 text-white font-extrabold"
                  : (isDark ? "bg-white/5 text-slate-400" : "bg-slate-100 text-slate-600")
              )}>
                {followers.length}
              </span>
            </button>

            {/* Tab 2: Following */}
            <button
              type="button"
              onClick={() => {
                setActiveTab('following');
                setSearchQuery('');
              }}
              className={cn(
                "py-2.5 px-2 text-xs sm:text-sm font-bold flex items-center justify-center gap-2 rounded-xl transition-all cursor-pointer",
                activeTab === 'following'
                  ? (isDark ? "bg-purple-600 text-white shadow" : "bg-purple-600 text-white shadow")
                  : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
              )}
            >
              <UserCheck className="w-4 h-4 shrink-0" />
              <span>Following</span>
              <span className={cn(
                "text-[10px] font-mono px-1.5 py-0.5 rounded-md",
                activeTab === 'following'
                  ? "bg-white/20 text-white font-extrabold"
                  : (isDark ? "bg-white/5 text-slate-400" : "bg-slate-100 text-slate-600")
              )}>
                {following.length}
              </span>
            </button>

            {/* Tab 3: Friends */}
            <button
              type="button"
              onClick={() => {
                setActiveTab('friends');
                setSearchQuery('');
              }}
              className={cn(
                "py-2.5 px-2 text-xs sm:text-sm font-bold flex items-center justify-center gap-2 rounded-xl transition-all cursor-pointer",
                activeTab === 'friends'
                  ? (isDark ? "bg-amber-500 text-slate-950 font-black shadow" : "bg-amber-600 text-white shadow")
                  : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
              )}
            >
              <ShieldCheck className={cn("w-4 h-4 shrink-0", activeTab === 'friends' ? "text-slate-950" : "text-amber-400")} />
              <span>{isOwner ? 'Friends' : 'Mutual'}</span>
              <span className={cn(
                "text-[10px] font-mono px-1.5 py-0.5 rounded-md",
                activeTab === 'friends'
                  ? "bg-black/20 text-slate-950 font-extrabold"
                  : (isDark ? "bg-white/5 text-slate-400" : "bg-slate-100 text-slate-600")
              )}>
                {friends.length}
              </span>
            </button>
          </div>
        </div>

        {/* Citizen Social Progression Banner */}
        <div className={cn(
          "px-4 py-3 rounded-2xl border flex items-center justify-between gap-3 text-xs transition-all",
          isCreatorOrAdvanced
            ? isDark
              ? "bg-purple-950/20 border-purple-500/30 text-purple-200"
              : "bg-purple-50 border-purple-200 text-purple-900"
            : isDark
            ? "bg-amber-950/20 border-amber-500/30 text-amber-200"
            : "bg-amber-50 border-amber-200 text-amber-900"
        )}>
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 shrink-0 text-amber-400" />
            <span>
              {isCreatorOrAdvanced
                ? `Level ${effectiveLevel} Citizen Graph: Public broadcast reach, Followers, and Mutual Friends are active.`
                : `Level ${effectiveLevel} Resident: Basic level citizens build mutual Friends. At Level 3+, your profile unlocks Public Followers!`}
            </span>
          </div>

          {!isCreatorOrAdvanced && (
            <button
              onClick={() => navigate('/perks')}
              className="text-[11px] font-bold underline shrink-0 cursor-pointer hover:opacity-80"
            >
              View Perks
            </button>
          )}
        </div>

        {/* Search Bar with Instant Reset */}
        <div className={cn(
          "flex items-center gap-2.5 px-3.5 py-2.5 rounded-2xl border transition-all shadow-sm",
          isDark ? "bg-white/[0.04] border-white/10 focus-within:border-purple-500/50" : "bg-white border-slate-200 focus-within:border-purple-400"
        )}>
          <Search className="w-4 h-4 text-slate-400 shrink-0" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={`Search ${activeTab === 'followers' ? 'followers' : activeTab === 'following' ? 'following' : 'mutual friends'} by name or handle...`}
            className="flex-1 bg-transparent text-xs sm:text-sm placeholder-slate-400 focus:outline-none"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="p-1 rounded-lg hover:bg-slate-200 dark:hover:bg-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Loading State */}
        {loading ? (
          <div className="py-24 flex flex-col items-center justify-center gap-3">
            <Loader2 className="w-8 h-8 text-purple-500 animate-spin" />
            <p className="text-xs font-mono text-slate-500">Querying sovereign connection graph...</p>
          </div>
        ) : permissionDenied ? (
          /* Privacy Protected State */
          <div className={cn(
            "rounded-3xl p-8 sm:p-12 text-center border shadow-xl space-y-4 my-8 backdrop-blur-xl",
            isDark ? "bg-[#0d1424]/90 border-white/10" : "bg-white border-slate-200"
          )}>
            <div className="w-16 h-16 mx-auto rounded-2xl bg-purple-500/10 text-purple-500 flex items-center justify-center border border-purple-500/20">
              <Lock className="w-8 h-8" />
            </div>
            <div className="space-y-1">
              <h2 className="text-base sm:text-lg font-bold">Connections Protected</h2>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                This citizen has chosen to keep their connection list private in accordance with Arvdoul sovereign privacy laws.
              </p>
            </div>
            <div className="pt-2">
              <button
                type="button"
                onClick={() => navigate(-1)}
                className="px-6 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider bg-slate-200 dark:bg-white/10 hover:opacity-90 transition-opacity cursor-pointer"
              >
                Return to Profile
              </button>
            </div>
          </div>
        ) : currentItems.length === 0 ? (
          /* Empty State */
          <div className={cn(
            "py-20 text-center rounded-3xl border space-y-3 p-6",
            isDark ? "bg-white/[0.02] border-white/5" : "bg-white/50 border-slate-200"
          )}>
            <div className="w-12 h-12 mx-auto rounded-2xl bg-slate-500/10 flex items-center justify-center text-slate-400">
              <Users className="w-6 h-6 opacity-60" />
            </div>
            <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300">
              {searchQuery ? 'No matching citizens found' : `No ${activeTab} yet`}
            </h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              {searchQuery
                ? `No citizen in this list matched "${searchQuery}". Try a different spelling or keyword.`
                : activeTab === 'followers'
                ? 'When people follow this profile, they will appear here.'
                : activeTab === 'following'
                ? 'Citizens followed by this profile will appear here.'
                : 'Mutual friends who follow each other will appear here.'}
            </p>
          </div>
        ) : (
          /* Citizens Connection Card List */
          <div className="space-y-2.5">
            {currentItems.map((citizen) => {
              const citizenId = citizen.id || citizen.uid;
              const safeAvatar = getSafeAvatarUrl(citizen.photoURL, citizen.displayName, citizenId);
              const rank = citizen.level ? getRankTitle(citizen.level) : null;
              const isSelf = Boolean(currentUserId && citizenId === currentUserId);

              return (
                <div
                  key={citizenId}
                  className={cn(
                    "group p-3.5 sm:p-4 rounded-2xl border transition-all flex items-center justify-between gap-3 shadow-sm",
                    isDark
                      ? "bg-[#0d1424]/60 hover:bg-[#0d1424] border-white/10 hover:border-purple-500/30"
                      : "bg-white hover:bg-slate-50 border-slate-200/80 hover:border-purple-300"
                  )}
                >
                  {/* Left: Avatar + Identity */}
                  <div
                    onClick={() => navigate(`/profile/${citizenId}`)}
                    className="flex items-center gap-3 min-w-0 flex-1 cursor-pointer"
                  >
                    <div className="relative shrink-0">
                      <div className="w-12 h-12 rounded-xl overflow-hidden border border-white/20 dark:border-white/10 shadow-sm bg-slate-800">
                        <img
                          src={safeAvatar}
                          alt={citizen.displayName || 'Citizen'}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            e.target.src = getSafeAvatarUrl(null, citizen.displayName, citizenId);
                          }}
                        />
                      </div>
                      {/* Presence indicator */}
                      <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-500 ring-2 ring-[#060816]" />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate">
                          {citizen.displayName || 'Citizen'}
                        </span>
                        {citizen.isVerified && (
                          <span className="w-3.5 h-3.5 rounded-full bg-blue-500 text-white flex items-center justify-center text-[9px] font-black shrink-0">
                            ✓
                          </span>
                        )}
                        {citizen.isCreator && (
                          <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[9px] font-extrabold uppercase bg-purple-500/20 text-purple-400 border border-purple-500/30 shrink-0">
                            Creator
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 text-[11px] font-mono text-slate-500 dark:text-slate-400">
                        <span className="truncate">@{citizen.username || 'citizen'}</span>
                        {rank && (
                          <>
                            <span>·</span>
                            <span className="text-amber-500 dark:text-amber-400 font-bold uppercase truncate">
                              {rank}
                            </span>
                          </>
                        )}
                      </div>

                      {citizen.bio && (
                        <p className="text-[11px] text-slate-600 dark:text-slate-300 line-clamp-1 mt-0.5">
                          {citizen.bio}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Right Actions: Message + Follow Button */}
                  <div className="flex items-center gap-2 shrink-0">
                    {!isSelf && (
                      <button
                        type="button"
                        onClick={() => navigate(`/messages/new?to=${citizenId}`)}
                        className={cn(
                          "w-9 h-9 rounded-xl border flex items-center justify-center transition-colors cursor-pointer",
                          isDark
                            ? "bg-white/[0.05] hover:bg-white/10 border-white/10 text-slate-300 hover:text-white"
                            : "bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-700"
                        )}
                        title="Direct Message"
                        aria-label="Direct Message"
                      >
                        <MessageCircle className="w-4 h-4" />
                      </button>
                    )}

                    {!isSelf && (
                      <FollowButton
                        isFollowing={citizen.isFollowing}
                        loading={followLoading}
                        onFollow={() => handleFollowToggle(citizenId, false)}
                        onUnfollow={() => handleFollowToggle(citizenId, true)}
                        theme={theme}
                        size="sm"
                      />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
