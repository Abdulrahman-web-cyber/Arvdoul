// src/screens/Profile/ConnectionsScreen.jsx
//
// Unified Connections Screen for Arvdoul Digital Nation.
// Unifies Followers, Following, Mutual Friends, and Owner Discover tabs with real backend telemetry,
// cursor pagination, and privacy capability governance.

import { useState, useEffect, useCallback, useMemo } from "react";
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { useLayoutChrome } from '../../context/LayoutChromeContext.jsx';
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
  Check,
  Clock,
} from "lucide-react";
import FollowButton from '../../components/profile/FollowButton';
import { useProfileStore } from '../../store/profileStore';
import { useAppStore } from '../../store/appStore';
import { getSafeAvatarUrl } from '../../utils/avatarUtils';
import { pickHandle, deriveHandle, resolveActorName } from '../../services/profileReadModel.js';
import { getStoredUid } from '../../utils/security';
import { resolveCapabilities } from '../../services/profileCapabilityEngine';
import { getRankTitle, LEVEL_GATES } from "../../shared/levelConfig.cjs";
import { toast } from 'sonner';
import { LazyImage } from '../../components/Shared/LazyImage';
import { ListRowsSkeleton } from '../../components/UI/SkeletonLoaders';
import { getUserService } from '../../services/userService.js';

const PAGE_SIZE = 30;

export default function ConnectionsScreen({ initialTab: propInitialTab }) {
  const { userId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { theme } = useTheme();
  const { hasTopAppBar } = useLayoutChrome();
  const isDark = theme === 'dark';

  const { user: authUser, userProfile } = useAuth();
  const storeUser = useAppStore((state) => state.currentUser);
  const currentUser = authUser || storeUser || userProfile;
  const currentUserId = currentUser?.uid || authUser?.uid || getStoredUid();

  const targetUserId = userId || currentUserId;
  const isOwner = Boolean(currentUserId && targetUserId === currentUserId);

  const [targetProfile, setTargetProfile] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshNonce, setRefreshNonce] = useState(0);

  // Lists & cursor pagination state
  const [followers, setFollowers] = useState([]);
  const [following, setFollowing] = useState([]);
  const [friends, setFriends] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [sentFriendIds, setSentFriendIds] = useState(() => new Set());
  const [friendBusyIds, setFriendBusyIds] = useState(() => new Set());

  const [cursors, setCursors] = useState({ followers: null, following: null, friends: null });
  const [hasMore, setHasMore] = useState({ followers: false, following: false, friends: false });
  const [loadingMoreTab, setLoadingMoreTab] = useState(null);

  const [loading, setLoading] = useState(true);
  const [permissionDenied, setPermissionDenied] = useState(false);
  // Capability map resolved once from the engine. Each tab has its own scope
  // (`followersList` / `followingList` / `friendsList`), so a viewer denied one
  // list must not reach another through a shared screen-level gate.
  const [capabilities, setCapabilities] = useState(null);

  const rawLvl = targetProfile?.level ?? (isOwner ? (userProfile?.level ?? currentUser?.level) : null);
  const effectiveLevel = rawLvl != null && Number.isFinite(Number(rawLvl)) ? Number(rawLvl) : null;
  const isCreatorOrAdvanced = Boolean(
    targetProfile?.isCreator ||
    (isOwner && userProfile?.isCreator) ||
    (effectiveLevel != null && effectiveLevel >= LEVEL_GATES.publicFollowers)
  );

  const derivedInitialTab = useMemo(() => {
    if (propInitialTab) return propInitialTab;
    const pathname = location.pathname.toLowerCase();
    if (pathname.includes('/following')) return 'following';
    if (pathname.includes('/followers')) return 'followers';
    if (pathname.includes('/friends')) return 'friends';
    if (pathname.includes('/discover')) return 'discover';
    return isCreatorOrAdvanced ? 'followers' : 'friends';
  }, [propInitialTab, location.pathname, isCreatorOrAdvanced]);

  const [activeTab, setActiveTab] = useState(propInitialTab || derivedInitialTab);

  useEffect(() => {
    if (propInitialTab) {
      setActiveTab(propInitialTab);
    }
  }, [propInitialTab]);

  const { follow, unfollow, cancelFollowRequest, followLoading } = useProfileStore();

  const hydrateFollowStates = useCallback(async (userService, lists) => {
    const allIds = [...new Set(
      lists.flat().map((u) => u?.id || u?.uid).filter((id) => id && id !== currentUserId)
    )];
    let followStates = new Map();
    if (currentUserId && allIds.length) {
      try {
        followStates = await userService.getFollowStates(currentUserId, allIds);
      } catch (e) {
        console.warn('Follow-state hydration failed:', e?.message);
      }
    }
    return (list) => list.map((u) => {
      const id = u?.id || u?.uid;
      const s = followStates instanceof Map ? followStates.get(id) : followStates?.[id];
      return {
        ...u,
        isFollowing: Boolean(s?.isFollowing),
        requestStatus: s?.requestStatus ?? null,
      };
    });
  }, [currentUserId]);

  // Load target profile, capabilities, and authorized lists
  useEffect(() => {
    let isMounted = true;
    const loadData = async () => {
      if (!targetUserId) {
        setLoading(false);
        return;
      }
      setLoading(true);
      setPermissionDenied(false);

      try {
        const userService = getUserService();

        const [profile, rel] = await Promise.all([
          userService.getUserProfile(targetUserId, currentUserId).catch(() => null),
          currentUserId && currentUserId !== targetUserId
            ? userService.getRelationshipState(currentUserId, targetUserId).catch(() => null)
            : Promise.resolve({ isOwner: Boolean(currentUserId && targetUserId === currentUserId) }),
        ]);

        if (isMounted) {
          setTargetProfile(profile);
        }

        const caps = resolveCapabilities({
          viewer: currentUser,
          target: profile,
          relationship: rel || {},
        });
        const canViewFollowers = isOwner || Boolean(caps.canViewFollowers);
        const canViewFollowing = isOwner || Boolean(caps.canViewFollowing);
        const canViewFriends = isOwner || Boolean(caps.canViewFriends);

        if (isMounted) {
          setCapabilities({ ...caps, canViewFollowers, canViewFollowing, canViewFriends });
        }

        // Fetch only the graphs the viewer is allowed to see.
        const followersPromise = canViewFollowers
          ? userService.getFollowers(targetUserId, { viewerId: currentUserId, limit: PAGE_SIZE })
          : Promise.resolve({ followers: [] });
        const followingPromise = canViewFollowing
          ? userService.getFollowing(targetUserId, { viewerId: currentUserId, limit: PAGE_SIZE })
          : Promise.resolve({ following: [] });
        const friendsPromise = canViewFriends
          ? userService.getFriends(targetUserId, { viewerId: currentUserId, limit: PAGE_SIZE })
          : Promise.resolve({ friends: [] });

        const discoverPromise = isOwner && currentUserId && typeof userService.getFriendRecommendations === 'function'
          ? userService.getFriendRecommendations(currentUserId, 20).catch(() => ({ recommendations: [] }))
          : Promise.resolve({ recommendations: [] });
        const sentRequestsPromise = isOwner && currentUserId && typeof userService.getFriendRequests === 'function'
          ? userService.getFriendRequests(currentUserId, 'sent').catch(() => ({ requests: [] }))
          : Promise.resolve({ requests: [] });

        const [followersRes, followingRes, friendsRes, discoverRes, sentReqRes] = await Promise.allSettled([
          followersPromise,
          followingPromise,
          friendsPromise,
          discoverPromise,
          sentRequestsPromise,
        ]);

        if (isMounted) {
          const followersVal = followersRes.status === 'fulfilled' ? followersRes.value : null;
          const followingVal = followingRes.status === 'fulfilled' ? followingRes.value : null;
          const friendsVal = friendsRes.status === 'fulfilled' ? friendsRes.value : null;

          const followersList = followersVal?.followers || [];
          const followingList = followingVal?.following || followingVal?.friends || [];
          const friendsList = friendsVal?.mutualFriends || friendsVal?.friends || [];
          const suggestionsList = discoverRes.status === 'fulfilled'
            ? (discoverRes.value?.recommendations || discoverRes.value?.suggestions || [])
            : [];
          const sentReqs = sentReqRes.status === 'fulfilled'
            ? (Array.isArray(sentReqRes.value) ? sentReqRes.value : sentReqRes.value?.requests || [])
            : [];

          setCursors({
            followers: followersVal?.nextCursor || null,
            following: followingVal?.nextCursor || null,
            friends: friendsVal?.nextCursor || null,
          });
          setHasMore({
            followers: Boolean(followersVal?.hasMore && followersVal?.nextCursor),
            following: Boolean(followingVal?.hasMore && followingVal?.nextCursor),
            friends: Boolean(friendsVal?.hasMore && friendsVal?.nextCursor),
          });

          setSentFriendIds(new Set(sentReqs.map((r) => r.toUserId).filter(Boolean)));

          const allIds = [...new Set([
            ...followersList, ...followingList, ...friendsList, ...suggestionsList,
          ].map((u) => u?.id || u?.uid).filter((id) => id && id !== currentUserId))];

          let followStates = new Map();
          if (currentUserId && allIds.length) {
            try {
              followStates = await userService.getFollowStates(currentUserId, allIds);
            } catch (e) {
              console.warn('Follow-state hydration failed:', e?.message);
            }
          }
          const withState = (list) => list.map((u) => {
            const id = u?.id || u?.uid;
            const s = followStates instanceof Map ? followStates.get(id) : followStates?.[id];
            return {
              ...u,
              isFollowing: Boolean(s?.isFollowing),
              requestStatus: s?.requestStatus ?? null,
            };
          });

          setFollowers(withState(followersList));
          setFollowing(withState(followingList));
          setFriends(withState(friendsList));
          setSuggestions(withState(suggestionsList));

          if (!isOwner && !canViewFollowers && !canViewFollowing && !canViewFriends) {
            setPermissionDenied(true);
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
  }, [targetUserId, currentUserId, isOwner, currentUser, refreshNonce]);

  // Cursor-based Load More for active list tab
  const handleLoadMore = useCallback(async () => {
    if (loadingMoreTab || activeTab === 'discover') return;
    const cursor = cursors[activeTab];
    if (!cursor || !hasMore[activeTab] || !targetUserId) return;

    setLoadingMoreTab(activeTab);
    try {
      const userService = getUserService();

      let res = null;
      let rawNext = [];
      if (activeTab === 'followers') {
        res = await userService.getFollowers(targetUserId, { viewerId: currentUserId, limit: PAGE_SIZE, startAfter: cursor });
        rawNext = res?.followers || [];
      } else if (activeTab === 'following') {
        res = await userService.getFollowing(targetUserId, { viewerId: currentUserId, limit: PAGE_SIZE, startAfter: cursor });
        rawNext = res?.following || res?.friends || [];
      } else if (activeTab === 'friends') {
        res = await userService.getFriends(targetUserId, { viewerId: currentUserId, limit: PAGE_SIZE, startAfter: cursor });
        rawNext = res?.mutualFriends || res?.friends || [];
      }

      const withState = await hydrateFollowStates(userService, [rawNext]);
      const hydrated = withState(rawNext);

      const mergeUnique = (prev) => {
        const seen = new Set(prev.map((u) => u?.id || u?.uid));
        return [...prev, ...hydrated.filter((u) => !seen.has(u?.id || u?.uid))];
      };

      if (activeTab === 'followers') setFollowers(mergeUnique);
      else if (activeTab === 'following') setFollowing(mergeUnique);
      else if (activeTab === 'friends') setFriends(mergeUnique);

      setCursors((prev) => ({ ...prev, [activeTab]: res?.nextCursor || null }));
      setHasMore((prev) => ({ ...prev, [activeTab]: Boolean(res?.hasMore && res?.nextCursor) }));
    } catch (err) {
      toast.error(err?.message || 'Could not load more connections');
    } finally {
      setLoadingMoreTab(null);
    }
  }, [loadingMoreTab, activeTab, cursors, hasMore, targetUserId, currentUserId, hydrateFollowStates]);

  // Handle follow toggle with optimistic update & full state rollback across all lists
  const handleFollowToggle = useCallback(async (targetId, currentFollowState) => {
    if (!currentUserId) return;
    const nextState = !currentFollowState;

    const existingRow = [...followers, ...following, ...friends, ...suggestions].find(
      (u) => (u.id || u.uid) === targetId
    );
    const prevSnapshot = {
      isFollowing: existingRow?.isFollowing ?? currentFollowState,
      requestStatus: existingRow?.requestStatus ?? null,
    };

    const updater = (list) =>
      list.map((u) => (u.id === targetId || u.uid === targetId ? { ...u, isFollowing: nextState } : u));
    setFollowers(updater);
    setFollowing(updater);
    setFriends(updater);
    setSuggestions(updater);

    try {
      if (nextState) {
        const result = await follow(currentUserId, targetId);
        if (result?.requested || result?.requestStatus === 'pending') {
          const markRequested = (list) =>
            list.map((u) => (u.id === targetId || u.uid === targetId
              ? { ...u, isFollowing: false, requestStatus: 'pending' }
              : u));
          setFollowers(markRequested);
          setFollowing(markRequested);
          setFriends(markRequested);
          setSuggestions(markRequested);
        }
      } else {
        await unfollow(currentUserId, targetId);
      }
    } catch {
      const rollbacker = (list) =>
        list.map((u) => (u.id === targetId || u.uid === targetId
          ? { ...u, isFollowing: prevSnapshot.isFollowing, requestStatus: prevSnapshot.requestStatus }
          : u));
      setFollowers(rollbacker);
      setFollowing(rollbacker);
      setFriends(rollbacker);
      setSuggestions(rollbacker);
    }
  }, [currentUserId, follow, unfollow, followers, following, friends, suggestions]);

  // Withdraw a pending follow request (private target).
  const handleCancelRequest = useCallback(async (targetId) => {
    if (!currentUserId) return;
    const clearRequested = (list) =>
      list.map((u) => (u.id === targetId || u.uid === targetId
        ? { ...u, requestStatus: null }
        : u));
    try {
      await cancelFollowRequest(currentUserId, targetId);
      setFollowers(clearRequested);
      setFollowing(clearRequested);
      setFriends(clearRequested);
      setSuggestions(clearRequested);
    } catch {
      toast.error('Could not withdraw the follow request');
    }
  }, [currentUserId, cancelFollowRequest]);

  // Send or cancel friend request from owner Discover tab
  const handleFriendRequestToggle = useCallback(async (targetId) => {
    if (!currentUserId || !targetId || friendBusyIds.has(targetId)) return;
    const isSent = sentFriendIds.has(targetId);

    setFriendBusyIds((prev) => new Set(prev).add(targetId));
    try {
      const svc = getUserService();
      if (isSent) {
        await svc.cancelFriendRequest(currentUserId, targetId);
        setSentFriendIds((prev) => {
          const next = new Set(prev);
          next.delete(targetId);
          return next;
        });
        toast.info('Friend request withdrawn');
      } else {
        const res = await svc.sendFriendRequest(currentUserId, targetId);
        if (res?.alreadyFriends) {
          toast.info('You are already mutual friends');
        } else {
          setSentFriendIds((prev) => new Set(prev).add(targetId));
          toast.success('Friend request sent');
        }
      }
    } catch (err) {
      toast.error(err?.message || 'Could not update friend request');
    } finally {
      setFriendBusyIds((prev) => {
        const next = new Set(prev);
        next.delete(targetId);
        return next;
      });
    }
  }, [currentUserId, friendBusyIds, sentFriendIds]);

  const followersUnlocked = Boolean(isCreatorOrAdvanced);

  const tabVisible = useMemo(() => ({
    followers: followersUnlocked && (isOwner || Boolean(capabilities?.canViewFollowers)),
    following: followersUnlocked && (isOwner || Boolean(capabilities?.canViewFollowing)),
    friends: isOwner || Boolean(capabilities?.canViewFriends),
    discover: isOwner,
  }), [followersUnlocked, isOwner, capabilities]);

  useEffect(() => {
    if (!tabVisible[activeTab]) {
      const fallback = ['followers', 'following', 'friends', 'discover'].find((k) => tabVisible[k]);
      if (fallback) setActiveTab(fallback);
    }
  }, [tabVisible, activeTab]);

  const currentItems = useMemo(() => {
    let rawList = [];
    if (activeTab === 'followers' && tabVisible.followers) rawList = followers;
    else if (activeTab === 'following' && tabVisible.following) rawList = following;
    else if (activeTab === 'friends' && tabVisible.friends) rawList = friends;
    else if (activeTab === 'discover' && tabVisible.discover) rawList = suggestions;

    if (!searchQuery.trim()) return rawList;
    const q = searchQuery.toLowerCase().trim();
    return rawList.filter((item) => {
      const name = (item.displayName || '').toLowerCase();
      const user = (item.username || '').toLowerCase();
      const bio = (item.bio || '').toLowerCase();
      return name.includes(q) || user.includes(q) || bio.includes(q);
    });
  }, [activeTab, tabVisible, followers, following, friends, suggestions, searchQuery]);

  const tabs = useMemo(() => [
    tabVisible.followers && { id: 'followers', label: 'Followers', count: followers.length, icon: Users },
    tabVisible.following && { id: 'following', label: 'Following', count: following.length, icon: UserCheck },
    tabVisible.friends && {
      id: 'friends',
      label: isOwner ? 'Friends' : 'Mutual',
      count: friends.length,
      icon: ShieldCheck,
    },
    tabVisible.discover && { id: 'discover', label: 'Discover', count: suggestions.length, icon: UserPlus },
  ].filter(Boolean), [tabVisible, followers.length, following.length, friends.length, suggestions.length, isOwner]);

  const targetDisplayName = targetProfile
    ? resolveActorName([targetProfile.displayName, targetProfile.username], targetUserId)
    : null;

  const activeTabLabel = useMemo(() => {
    if (activeTab === 'followers') return 'Followers';
    if (activeTab === 'following') return 'Following';
    if (activeTab === 'discover') return 'Discover';
    return isOwner ? 'Friends' : 'Mutual Friends';
  }, [activeTab, isOwner]);

  // Coordinate title, subtitle, search, and refresh with TopAppBar (without avatar)
  useEffect(() => {
    window.dispatchEvent(new CustomEvent('arvdoul:network_header_state', {
      detail: {
        title: isOwner ? 'Citizen Network' : (targetDisplayName || 'Citizen Network'),
        subtitle: loading
          ? `${activeTabLabel} · Syncing…`
          : `${activeTabLabel} · ${currentItems.length}`,
      },
    }));
  }, [isOwner, targetDisplayName, activeTabLabel, currentItems.length, loading]);

  useEffect(() => {
    const onSearchQuery = (e) => {
      setSearchQuery(typeof e?.detail === 'string' ? e.detail : '');
    };
    const onRefresh = () => {
      setRefreshNonce((n) => n + 1);
    };
    window.addEventListener('arvdoul:network_search_query', onSearchQuery);
    window.addEventListener('arvdoul:network_refresh', onRefresh);
    return () => {
      window.removeEventListener('arvdoul:network_search_query', onSearchQuery);
      window.removeEventListener('arvdoul:network_refresh', onRefresh);
      window.dispatchEvent(new CustomEvent('arvdoul:network_header_state', { detail: null }));
    };
  }, []);

  return (
    <div className={cn(
      "min-h-screen pb-24 transition-colors duration-200",
      isDark
        ? "bg-[#03071B] text-white selection:bg-purple-500/30"
        : "bg-[#F6F8FC] text-slate-900 selection:bg-purple-500/20"
    )}>
      <div className="max-w-3xl mx-auto px-4 pt-2 sm:pt-4 space-y-4">
        {/* Segmented iOS Tab Switcher */}
        <div
          role="tablist"
          aria-label="Connection lists"
          className={cn(
            "p-1 rounded-2xl border flex items-center gap-1 overflow-x-auto no-scrollbar",
            isDark ? "bg-[#080F2E]/85 border-white/[0.08]" : "bg-slate-200/60 border-slate-200/80"
          )}
        >
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => {
                  setActiveTab(tab.id);
                  setSearchQuery('');
                }}
                className={cn(
                  "relative flex-1 min-w-[92px] min-h-[44px] px-3 py-2 rounded-xl text-xs sm:text-sm font-semibold flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0 transition-all cursor-pointer",
                  active
                    ? isDark
                      ? "bg-[#111C4A] text-white shadow-sm border border-white/[0.1]"
                      : "bg-white text-slate-950 shadow-sm border border-slate-200/60"
                    : isDark
                      ? "text-slate-400 hover:text-slate-200"
                      : "text-slate-600 hover:text-slate-900"
                )}
              >
                <Icon
                  className={cn(
                    "w-4 h-4 shrink-0",
                    active && (tab.id === 'friends' ? "text-amber-500" : "text-arvdoul-purple")
                  )}
                  aria-hidden="true"
                />
                <span>{tab.label}</span>
                <span className={cn(
                  "px-1.5 py-0.5 rounded-md text-[11px] font-bold tabular-nums",
                  active
                    ? isDark ? "bg-white/10 text-slate-200" : "bg-slate-100 text-slate-700"
                    : isDark ? "text-slate-500" : "text-slate-500"
                )}>
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Quiet Tier / Access Context Strip */}
        <div className={cn(
          "px-4 py-3 rounded-2xl border flex items-center justify-between gap-3 text-xs",
          isDark
            ? "bg-[#080F2E]/75 border-white/[0.08] text-slate-300"
            : "bg-white border-slate-200/80 text-slate-700 shadow-[0_1px_6px_rgba(15,23,42,0.03)]"
        )}>
          <div className="min-w-0">
            <span className={cn("font-semibold", isDark ? "text-white" : "text-slate-900")}>
              {targetDisplayName ? `${targetDisplayName} · ` : ''}
              {effectiveLevel != null ? `Level ${effectiveLevel}` : 'Connection Graph'}
            </span>
            <span className={cn("ml-1.5", isDark ? "text-slate-400" : "text-slate-500")}>
              {isCreatorOrAdvanced
                ? 'Public broadcast reach, Followers, and Mutual Friends are active.'
                : `Residents start with Mutual Friends; Level ${LEVEL_GATES.publicFollowers}+ unlocks Public Followers.`}
            </span>
          </div>

          {!isCreatorOrAdvanced && (
            <button
              type="button"
              onClick={() => navigate('/perks')}
              className={cn(
                "min-h-[40px] px-2.5 text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer hover:underline",
                isDark ? "text-purple-400" : "text-purple-700"
              )}
            >
              View Perks
            </button>
          )}
        </div>

        {/* Search Input (shown inline only when TopAppBar is absent; otherwise TopAppBar owns search) */}
        {!hasTopAppBar ? (
          <div className={cn(
            "flex items-center gap-2.5 px-3.5 min-h-[44px] rounded-2xl border transition-colors",
            isDark
              ? "bg-[#080F2E]/90 border-white/[0.08] focus-within:border-purple-500/50"
              : "bg-white border-slate-200 focus-within:border-purple-400"
          )}>
            <Search className="w-4 h-4 text-slate-400 shrink-0" aria-hidden="true" />
            <input
              aria-label="Search connections"
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={`Search ${
                activeTab === 'followers'
                  ? 'followers'
                  : activeTab === 'following'
                    ? 'following'
                    : activeTab === 'discover'
                      ? 'suggested people'
                      : 'mutual friends'
              } by name or handle...`}
              className="flex-1 bg-transparent text-xs sm:text-sm placeholder-slate-400 focus:outline-none py-2.5"
            />
            {searchQuery && (
              <button
                type="button"
                aria-label="Clear search"
                onClick={() => setSearchQuery('')}
                className="min-w-[36px] min-h-[36px] rounded-lg flex items-center justify-center hover:bg-slate-200 dark:hover:bg-white/10 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        ) : searchQuery.trim() ? (
          <div className={cn(
            "px-3.5 py-2 rounded-xl border flex items-center justify-between gap-2 text-xs",
            isDark ? "bg-[#080F2E]/80 border-white/[0.08] text-slate-300" : "bg-white border-slate-200 text-slate-700"
          )}>
            <div className="flex items-center gap-2 min-w-0">
              <Search className="w-3.5 h-3.5 text-arvdoul-purple shrink-0" aria-hidden="true" />
              <span className="truncate">
                Showing matches for <span className="font-semibold">&ldquo;{searchQuery.trim()}&rdquo;</span>
              </span>
            </div>
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              aria-label="Clear connection filter"
              className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-white/10 text-slate-400 hover:text-slate-900 dark:hover:text-white cursor-pointer shrink-0"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : null}

        {/* Loading State */}
        {loading ? (
          <ListRowsSkeleton count={6} />
        ) : permissionDenied ? (
          /* Privacy Protected State */
          <div className={cn(
            "rounded-3xl p-8 sm:p-12 text-center border space-y-4 my-6",
            isDark ? "bg-[#080F2E]/90 border-white/[0.08]" : "bg-white border-slate-200"
          )}>
            <div className={cn(
              "w-14 h-14 mx-auto rounded-2xl flex items-center justify-center border",
              isDark ? "bg-purple-500/10 text-purple-400 border-purple-500/20" : "bg-purple-50 text-purple-700 border-purple-200"
            )}>
              <Lock className="w-7 h-7" />
            </div>
            <div className="space-y-1">
              <h2 className="text-base sm:text-lg font-bold">Connections Protected</h2>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                This account keeps its connection lists private.
              </p>
            </div>
            <div className="pt-2">
              <button
                type="button"
                onClick={() => navigate(-1)}
                className={cn(
                  "min-h-[44px] px-5 py-2.5 rounded-xl font-semibold text-xs whitespace-nowrap shrink-0 transition-opacity hover:opacity-90 cursor-pointer",
                  isDark ? "bg-white/10 text-white" : "bg-slate-200 text-slate-900"
                )}
              >
                Return to Profile
              </button>
            </div>
          </div>
        ) : currentItems.length === 0 ? (
          /* Empty State */
          <div className={cn(
            "py-16 text-center rounded-3xl border space-y-2.5 px-6",
            isDark ? "bg-[#080F2E]/60 border-white/[0.08]" : "bg-white border-slate-200"
          )}>
            <div className={cn(
              "w-12 h-12 mx-auto rounded-2xl flex items-center justify-center",
              isDark ? "bg-white/5 text-slate-400" : "bg-slate-100 text-slate-500"
            )}>
              <Users className="w-6 h-6" />
            </div>
            <h3 className={cn("text-sm font-bold", isDark ? "text-slate-200" : "text-slate-800")}>
              {searchQuery ? 'No matching accounts' : `No ${activeTab === 'discover' ? 'suggestions' : activeTab} yet`}
            </h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              {searchQuery
                ? `No account in this list matched "${searchQuery}".`
                : activeTab === 'followers'
                  ? 'People who follow this profile will appear here.'
                  : activeTab === 'following'
                    ? 'Accounts followed by this profile will appear here.'
                    : activeTab === 'discover'
                      ? 'Suggested people and creators will appear here as your network grows.'
                      : 'Mutual friends who follow each other will appear here.'}
            </p>
          </div>
        ) : (
          /* Connection List */
          <div className="space-y-2.5">
            {currentItems.map((rowUser) => {
              const rowId = rowUser.id || rowUser.uid;
              const rowName = resolveActorName([rowUser.displayName, rowUser.name], rowId);
              const rowHandle = pickHandle([rowUser.username]) || deriveHandle(rowName);
              const safeAvatar = getSafeAvatarUrl(rowUser.photoURL, rowName, rowId);
              const rank = rowUser.level ? getRankTitle(rowUser.level) : null;
              const isSelf = Boolean(currentUserId && rowId === currentUserId);
              const isFriendRequested = sentFriendIds.has(rowId);
              const isFriendBusy = friendBusyIds.has(rowId);

              const rowLevel = rowUser.level != null && Number.isFinite(Number(rowUser.level)) ? Number(rowUser.level) : null;
              const rowFollowersUnlocked = Boolean(
                rowUser.isCreator || (rowLevel !== null && rowLevel >= LEVEL_GATES.publicFollowers)
              );

              return (
                <div
                  key={rowId}
                  className={cn(
                    "p-3.5 sm:p-4 rounded-2xl border transition-colors flex items-center justify-between gap-3",
                    isDark
                      ? "bg-[#080F2E]/90 hover:bg-[#080F2E] border-white/[0.08] hover:border-white/15"
                      : "bg-white hover:bg-slate-50/80 border-slate-200/80 hover:border-slate-300"
                  )}
                >
                  {/* Left: Avatar + Identity */}
                  <button
                    type="button"
                    onClick={() => navigate(`/profile/${rowId}`)}
                    className="flex items-center gap-3 min-w-0 flex-1 cursor-pointer text-left focus:outline-none focus:ring-2 focus:ring-arvdoul-purple rounded-xl"
                  >
                    <div className={cn(
                      "w-12 h-12 rounded-xl overflow-hidden border shrink-0",
                      isDark ? "border-white/10 bg-slate-800" : "border-slate-200 bg-slate-100"
                    )}>
                      <LazyImage
                        src={safeAvatar}
                        alt={rowName}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          e.target.src = getSafeAvatarUrl(null, rowName, rowId);
                        }}
                      />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className={cn(
                          "text-sm font-semibold truncate",
                          isDark ? "text-white" : "text-slate-900"
                        )}>
                          {rowName}
                        </span>
                        {rowUser.isVerified && (
                          <Check className="w-3.5 h-3.5 text-blue-500 shrink-0" aria-label="Verified" />
                        )}
                      </div>

                      <div className={cn(
                        "flex items-center gap-1.5 text-xs truncate",
                        isDark ? "text-slate-400" : "text-slate-500"
                      )}>
                        {rowHandle && <span className="truncate">@{rowHandle}</span>}
                        {rank && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className={cn(
                              "font-medium truncate",
                              isDark ? "text-amber-400" : "text-amber-700"
                            )}>
                              {rank}
                            </span>
                          </>
                        )}
                        {rowUser.isCreator && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className={cn(
                              "font-medium shrink-0",
                              isDark ? "text-purple-400" : "text-purple-700"
                            )}>
                              Creator
                            </span>
                          </>
                        )}
                      </div>

                      {rowUser.bio && (
                        <p className={cn(
                          "text-xs line-clamp-1 mt-0.5",
                          isDark ? "text-slate-300" : "text-slate-600"
                        )}>
                          {rowUser.bio}
                        </p>
                      )}
                    </div>
                  </button>

                  {/* Right Actions */}
                  <div className="flex items-center gap-2 shrink-0">
                    {!isSelf && (activeTab === 'discover' || !rowFollowersUnlocked) && activeTab !== 'friends' && (
                      <button
                        type="button"
                        onClick={() => handleFriendRequestToggle(rowId)}
                        disabled={isFriendBusy}
                        className={cn(
                          "min-h-[44px] sm:min-h-[40px] px-3 rounded-xl border text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors cursor-pointer disabled:opacity-60",
                          isFriendRequested
                            ? isDark
                              ? "bg-white/[0.06] border-white/15 text-slate-200 hover:bg-white/10"
                              : "bg-slate-100 border-slate-300 text-slate-700 hover:bg-slate-200"
                            : isDark
                              ? "bg-purple-500/15 border-purple-400/30 text-purple-200 hover:bg-purple-500/25"
                              : "bg-purple-50 border-purple-200 text-purple-700 hover:bg-purple-100"
                        )}
                      >
                        {isFriendBusy ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : isFriendRequested ? (
                          <>
                            <Clock className="w-3.5 h-3.5" aria-hidden="true" />
                            <span>Friend Sent</span>
                          </>
                        ) : (
                          <>
                            <UserPlus className="w-3.5 h-3.5" aria-hidden="true" />
                            <span>Add Friend</span>
                          </>
                        )}
                      </button>
                    )}

                    {!isSelf && (
                      <button
                        type="button"
                        onClick={() => navigate(`/messages/new?to=${rowId}`)}
                        className={cn(
                          "min-w-[44px] min-h-[44px] sm:min-w-[40px] sm:min-h-[40px] rounded-xl border flex items-center justify-center transition-colors cursor-pointer shrink-0",
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

                    {!isSelf && rowFollowersUnlocked && (
                      <FollowButton
                        isFollowing={rowUser.isFollowing}
                        requested={rowUser.requestStatus === 'pending'}
                        loading={followLoading}
                        onFollow={() => handleFollowToggle(rowId, false)}
                        onUnfollow={() => handleFollowToggle(rowId, true)}
                        onCancelRequest={() => handleCancelRequest(rowId)}
                        theme={theme}
                        size="sm"
                      />
                    )}
                  </div>
                </div>
              );
            })}

            {/* Cursor Pagination Load More */}
            {activeTab !== 'discover' && hasMore[activeTab] && !searchQuery.trim() && (
              <div className="pt-2 flex justify-center">
                <button
                  type="button"
                  onClick={handleLoadMore}
                  disabled={loadingMoreTab === activeTab}
                  className={cn(
                    "min-h-[44px] px-5 py-2.5 rounded-xl border text-xs font-semibold flex items-center gap-2 whitespace-nowrap shrink-0 transition-colors cursor-pointer disabled:opacity-60",
                    isDark
                      ? "bg-[#080F2E]/90 border-white/[0.08] text-slate-200 hover:bg-white/10"
                      : "bg-white border-slate-200 text-slate-800 hover:bg-slate-50"
                  )}
                >
                  {loadingMoreTab === activeTab && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>{loadingMoreTab === activeTab ? 'Loading more…' : 'Load more'}</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
