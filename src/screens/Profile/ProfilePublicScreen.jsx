/**
 * src/screens/Profile/ProfilePublicScreen.jsx - ARVDOUL Public Profile Screen
 * 
 * Production-grade public profile viewing screen for other creators & users.
 * Rebuilt to perfectly match the uploaded design specifications across Light and Dark themes.
 * Fully integrated with real system data, server-authoritative level & progression,
 * optimistic follow/unfollow, direct messaging, coin tipping modal, mutual friends,
 * social connections, featured creations, and responsive layout.
 * 
 * @component
 */

import React, { useState, useEffect, useCallback, useMemo, Suspense, lazy } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Lock, UserPlus, UserX, ShieldAlert } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { cn } from '../../lib/utils';
import { getSafeAvatarUrl } from '../../utils/avatarUtils';
import { shareProfile } from '../../utils/shareUtils';
import { getStoredUid } from '../../utils/security';
import { LEVEL_GATES } from '../../services/levelSystemService';
import { resolveCapabilities } from '../../services/profileCapabilityEngine';
import { TopAppLoadingBanner } from '../../components/Navigation/RouteProgressBar';
import { ErrorBoundary } from '../../components/ErrorBoundary';

// Modular Profile Components
import ProfileHeroSection from '../../components/profile/ProfileHeroSection';
import ProfileMutualFriends from '../../components/profile/ProfileMutualFriends';
import ProfileMetricsGrid from '../../components/profile/ProfileMetricsGrid';
import ProfileHighlightsSection from '../../components/profile/ProfileHighlightsSection';
import ProfileFeaturedSection from '../../components/profile/ProfileFeaturedSection';
import ProfileTabsBar from '../../components/profile/ProfileTabsBar';
import ProfilePinnedPosts from '../../components/profile/ProfilePinnedPosts';
import ProfileFeedGrid from '../../components/profile/ProfileFeedGrid';
import ProfileTipModal from '../../components/profile/ProfileTipModal';
import ProfileQRCodeModal from '../../components/profile/ProfileQRCodeModal';
import ProfileQRScannerModal from '../../components/profile/ProfileQRScannerModal';
import ProfileSkeleton from '../../components/profile/ProfileSkeleton';

// Modals
const ProfileOptionsMenu = lazy(() => import('../../components/profile/ProfileOptionsMenu'));

export default function ProfilePublicScreen() {
  const { userId } = useParams();
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  const currentUserId = currentUser?.uid || getStoredUid();
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const [profileData, setProfileData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [analytics, setAnalytics] = useState(null);
  const [posts, setPosts] = useState([]);
  const [mutualFriends, setMutualFriends] = useState([]);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [friendshipStatus, setFriendshipStatus] = useState('none'); // 'none' | 'pending' | 'received' | 'friends'
  const [pendingRequestId, setPendingRequestId] = useState(null);
  const [friendRequestLoading, setFriendRequestLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('posts');
  const [relationship, setRelationship] = useState(null);
  
  // Modals
  const [showTipModal, setShowTipModal] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);
  const [showScannerModal, setShowScannerModal] = useState(false);
  const [showOptionsMenu, setShowOptionsMenu] = useState(false);

  // Load profile and related data
  useEffect(() => {
    let isMounted = true;
    const cleanUserId = userId ? String(userId).replace(/^@/, '').trim() : '';

    const loadPublicProfile = async () => {
      if (!cleanUserId) return;
      setLoading(true);

      const safetyTimer = setTimeout(() => {
        if (isMounted) setLoading(false);
      }, 6000);

      try {
        const userServiceModule = await import('../../services/userService.js');
        const userService = userServiceModule.getUserService();

        // 1. Fetch user profile
        const fetched = await userService.getUserProfile(cleanUserId, currentUserId);
        const targetUid = fetched?.id || fetched?.uid || cleanUserId;
        
        // 2. Fetch posts
        let userPosts = [];
        try {
          const { getFirestoreService } = await import('../../services/firestoreService.js');
          const postsRes = await getFirestoreService().getPostsByUser(targetUid, { limit: 30 });
          if (postsRes?.posts && Array.isArray(postsRes.posts)) {
            userPosts = postsRes.posts;
          }
        } catch (postErr) {
          console.warn('Posts fetch note:', postErr);
        }

        // 3. Fetch relationship & follow status
        if (currentUser?.uid && targetUid !== currentUser.uid) {
          try {
            const rel = await userService.getRelationshipState(currentUser.uid, targetUid);
            if (isMounted) {
              setRelationship(rel);
              setIsFollowing(Boolean(rel?.isFollowing || fetched?.isFollowing));
            }
          } catch (followErr) {
            if (isMounted && fetched?.isFollowing !== undefined) {
              setIsFollowing(Boolean(fetched.isFollowing));
            }
          }
        }

        // 4. Fetch mutual friends and friend request status
        if (currentUser?.uid && targetUid !== currentUser.uid) {
          try {
            const mutual = await userService.getMutualFriends(currentUser.uid, targetUid);
            const friendsList = Array.isArray(mutual) ? mutual : (mutual?.mutualFriends || []);
            if (isMounted) {
              setMutualFriends(friendsList);
            }

            // Check if mutual friends directly using canonical areFriends
            const areFriends = await userService.areFriends(currentUser.uid, targetUid).catch(() => false);
            if (areFriends) {
              if (isMounted) setFriendshipStatus('friends');
            } else {
              // Check sent friend requests
              const sent = await userService.getFriendRequests(currentUser.uid, 'sent').catch(() => ({ requests: [] }));
              const sentReq = sent.requests?.find(r => r.toUserId === targetUid);
              if (sentReq) {
                if (isMounted) {
                  setFriendshipStatus('pending');
                  setPendingRequestId(sentReq.id);
                }
              } else {
                // Check received friend requests
                const received = await userService.getFriendRequests(currentUser.uid, 'received').catch(() => ({ requests: [] }));
                const recReq = received.requests?.find(r => r.fromUserId === targetUid);
                if (recReq) {
                  if (isMounted) {
                    setFriendshipStatus('received');
                    setPendingRequestId(recReq.id);
                  }
                } else {
                  if (isMounted) setFriendshipStatus('none');
                }
              }
            }
          } catch (mutualErr) {
            console.warn('Mutual friends and request note:', mutualErr);
          }
        }

        // 5. Track profile view in analytics & fetch analytics
        try {
          const analyticsService = (await import('../../services/analyticsService.js')).default;
          if (currentUser?.uid && targetUid !== currentUser.uid) {
            analyticsService.trackProfileView(currentUser.uid, targetUid).catch(() => {});
          }
          const userAnalytics = await analyticsService.getUserAnalytics(targetUid, '30d');
          if (isMounted && userAnalytics) {
            setAnalytics(userAnalytics);
          }
        } catch (analyticsErr) {
          console.warn('Analytics note:', analyticsErr);
        }

        if (isMounted && fetched) {
          setProfileData(fetched);
          setPosts(userPosts.length > 0 ? userPosts : (fetched.posts || []));
        }
      } catch (err) {
        console.warn('Public profile fetch error:', err);
      } finally {
        clearTimeout(safetyTimer);
        if (isMounted) setLoading(false);
      }
    };

    loadPublicProfile();
    return () => { isMounted = false; };
  }, [userId, currentUser?.uid]);

  // Optimistic Follow / Unfollow
  const handleFollowToggle = useCallback(async () => {
    if (!currentUser?.uid) {
      toast.error('Please sign in to follow this creator');
      navigate('/login');
      return;
    }

    const nextState = !isFollowing;
    setIsFollowing(nextState);
    setFollowLoading(true);

    try {
      const userServiceModule = await import('../../services/userService.js');
      const userService = userServiceModule.getUserService();

      if (nextState) {
        await userService.followUser(currentUser.uid, userId);
        toast.success(`Following @${profileData?.username || 'creator'}`);
        setProfileData(prev => prev ? ({
          ...prev,
          followerCount: (Number(prev.followerCount || prev.followersCount) || 0) + 1
        }) : prev);
      } else {
        await userService.unfollowUser(currentUser.uid, userId);
        toast.info(`Unfollowed @${profileData?.username || 'creator'}`);
        setProfileData(prev => prev ? ({
          ...prev,
          followerCount: Math.max(0, (Number(prev.followerCount || prev.followersCount) || 1) - 1)
        }) : prev);
      }
    } catch (e) {
      // Revert on failure
      setIsFollowing(!nextState);
      toast.error('Could not update follow status');
    } finally {
      setFollowLoading(false);
    }
  }, [currentUser?.uid, isFollowing, userId, profileData?.username, profileData?.followerCount, profileData?.followersCount, navigate]);

  // Handle Friend Request Toggle (For Newcomer level 1-2 profiles)
  const handleFriendRequestToggle = useCallback(async () => {
    if (!currentUser?.uid) {
      toast.error('Please sign in to send a friend request');
      navigate('/login');
      return;
    }

    if (friendshipStatus === 'friends') {
      toast.info(`You and @${profileData?.username || 'user'} are already friends!`);
      return;
    }

    if (friendshipStatus === 'pending') {
      toast.info('Friend request already sent. Waiting for acceptance.');
      return;
    }

    setFriendRequestLoading(true);
    try {
      const userServiceModule = await import('../../services/userService.js');
      const userService = userServiceModule.getUserService();

      if (friendshipStatus === 'received' && pendingRequestId) {
        await userService.acceptFriendRequest(pendingRequestId, currentUser.uid);
        setFriendshipStatus('friends');
        toast.success(`You and @${profileData?.username || 'user'} are now friends!`);
      } else if (friendshipStatus === 'none') {
        const res = await userService.sendFriendRequest(currentUser.uid, userId);
        setFriendshipStatus('pending');
        if (res?.requestId) setPendingRequestId(res.requestId);
        toast.success(`Friend request sent to @${profileData?.username || 'user'}`);
      }
    } catch (e) {
      console.error('Friend request error:', e);
      toast.error(e?.message || 'Could not process friend request');
    } finally {
      setFriendRequestLoading(false);
    }
  }, [currentUser?.uid, friendshipStatus, pendingRequestId, profileData?.username, userId, navigate]);

  // Clean public username resolution
  const cleanPublicUsername = useMemo(() => {
    try {
      const u = profileData?.username;
      if (typeof u === 'string' && u.trim() && !u.startsWith('user_') && u !== 'creator') return u.trim();
      const h = profileData?.handle;
      if (typeof h === 'string' && h.trim() && !h.startsWith('user_')) return h.trim();
      const d = typeof profileData?.displayName === 'string' ? profileData.displayName : '';
      if (d) {
        const fromD = d.toLowerCase().replace(/[^a-z0-9_]/g, '');
        if (fromD && fromD !== 'user') return fromD;
      }
      const e = typeof profileData?.email === 'string' ? profileData.email : '';
      if (e) {
        const fromE = e.split('@')[0]?.toLowerCase().replace(/[^a-z0-9_]/g, '');
        if (fromE && fromE !== 'user') return fromE;
      }
      return 'creator';
    } catch {
      return 'creator';
    }
  }, [profileData?.username, profileData?.handle, profileData?.displayName, profileData?.email]);

  // Real profile data without mock fallbacks
  const effectiveProfile = useMemo(() => {
    if (!profileData) return null;
    const safeDisplayName = typeof profileData.displayName === 'string' && profileData.displayName.trim() && profileData.displayName !== 'User' && profileData.displayName !== 'Creator'
      ? profileData.displayName.trim()
      : typeof profileData.name === 'string' && profileData.name.trim() && profileData.name !== 'User' && profileData.name !== 'Creator'
        ? profileData.name.trim()
        : 'Creator';

    const safeLevel = Number(profileData.level) || 1;

    return {
      ...profileData,
      id: profileData.id || profileData.uid || userId,
      uid: profileData.uid || profileData.id || userId,
      username: cleanPublicUsername,
      displayName: safeDisplayName,
      bio: typeof profileData.bio === 'string' ? profileData.bio : '',
      photoURL: getSafeAvatarUrl(profileData.photoURL, safeDisplayName, userId),
      followerCount: Number(profileData.followerCount ?? profileData.followersCount ?? 0),
      followingCount: Number(profileData.followingCount ?? 0),
      postCount: Number(posts?.length ?? profileData.postCount ?? 0),
      likesReceived: Number(profileData.likesReceived ?? profileData.likesCount ?? 0),
      coins: Number(profileData.coins ?? profileData.coinBalance ?? 0),
      isVerified: Boolean(profileData.isVerified || profileData.verified),
      isCreator: Boolean(profileData.isCreator || safeLevel >= LEVEL_GATES.creatorProfile),
      isPrivate: Boolean(profileData.isPrivate),
      isRestricted: Boolean(profileData.isRestricted),
      canViewActivity: profileData.canViewActivity !== false,
      canViewAchievements: profileData.canViewAchievements !== false,
      canViewTitles: profileData.canViewTitles !== false,
      canViewFollowersList: profileData.canViewFollowersList !== false,
      canViewFollowingList: profileData.canViewFollowingList !== false,
      links: Array.isArray(profileData.links) ? profileData.links : [],
      pronouns: typeof profileData.pronouns === 'string' ? profileData.pronouns : '',
      profession: typeof profileData.profession === 'string' ? profileData.profession : '',
      education: typeof profileData.education === 'string' ? profileData.education : '',
      presence: profileData.presence || { isOnline: false, status: 'offline', lastActive: null },
      level: safeLevel,
      location: typeof profileData.location === 'string' ? profileData.location : (typeof profileData.city === 'string' ? profileData.city : ''),
      website: typeof profileData.website === 'string' ? profileData.website : (typeof profileData.link === 'string' ? profileData.link : ''),
    };
  }, [profileData, userId, posts?.length, cleanPublicUsername]);

  const capabilities = useMemo(() => {
    return resolveCapabilities({
      viewer: currentUser,
      target: effectiveProfile,
      relationship: relationship || {
        isFollowing,
        friendshipStatus
      }
    });
  }, [currentUser, effectiveProfile, relationship, isFollowing, friendshipStatus]);

  const handleUnblock = useCallback(async () => {
    const targetUid = effectiveProfile?.id || effectiveProfile?.uid || userId;
    if (!currentUser?.uid || !targetUid) return;
    try {
      const userServiceModule = await import('../../services/userService.js');
      const svc = userServiceModule.getUserService();
      await svc.unblockUser(currentUser.uid, targetUid);
      toast.success('User unblocked');
      const updatedRel = await svc.getRelationshipState(currentUser.uid, targetUid);
      setRelationship(updatedRel);
    } catch {
      toast.error('Could not unblock user');
    }
  }, [currentUser?.uid, effectiveProfile?.id, effectiveProfile?.uid, userId]);

  // Handle profile sharing
  const handleShare = useCallback(async () => {
    try {
      const target = effectiveProfile || { id: userId, uid: userId, username: profileData?.username };
      const result = await shareProfile(target);
      if (result.copied) {
        toast.success('Profile link copied to clipboard!');
      }
    } catch {
      toast.error('Could not share profile');
    }
  }, [effectiveProfile, userId, profileData?.username]);

  if (loading && !profileData) {
    return (
      <div className={cn(
        'min-h-screen pb-20',
        isDark ? 'bg-[#060816]' : 'bg-[#f0f4fa]'
      )}>
        <TopAppLoadingBanner isAnimating={true} label="Loading Profile..." />
        <ProfileSkeleton theme={theme} />
      </div>
    );
  }

  if (capabilities?.isBlocking) {
    return (
      <div className={cn(
        "min-h-screen flex items-center justify-center p-4",
        isDark ? "bg-[#060816] text-white" : "bg-[#f0f4fa] text-slate-900"
      )}>
        <div className={cn(
          "max-w-md w-full p-8 rounded-3xl border text-center space-y-4 shadow-xl",
          isDark ? "bg-[#0d1424] border-white/10" : "bg-white border-slate-200"
        )}>
          <div className="w-16 h-16 mx-auto rounded-full bg-red-500/10 text-red-500 flex items-center justify-center">
            <UserX className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-black">You have blocked this profile</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            You cannot view content or interact with @{effectiveProfile?.username || 'this user'} while they are blocked.
          </p>
          <div className="pt-2 flex justify-center gap-3">
            <button
              onClick={() => navigate(-1)}
              className="px-5 py-2.5 rounded-full font-semibold text-sm bg-slate-200 dark:bg-white/10 hover:opacity-90 transition-opacity"
            >
              Go Back
            </button>
            <button
              onClick={handleUnblock}
              className="px-5 py-2.5 rounded-full font-semibold text-sm text-white bg-red-600 hover:bg-red-700 shadow-md transition-opacity"
            >
              Unblock Profile
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (capabilities?.isBlockedBy || (!loading && capabilities?.canViewProfile === false)) {
    return (
      <div className={cn(
        "min-h-screen flex items-center justify-center p-4",
        isDark ? "bg-[#060816] text-white" : "bg-[#f0f4fa] text-slate-900"
      )}>
        <div className={cn(
          "max-w-md w-full p-8 rounded-3xl border text-center space-y-4 shadow-xl",
          isDark ? "bg-[#0d1424] border-white/10" : "bg-white border-slate-200"
        )}>
          <div className="w-16 h-16 mx-auto rounded-full bg-slate-500/10 text-slate-500 flex items-center justify-center">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-black">Profile Unavailable</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            This account is currently unavailable or restricted.
          </p>
          <div className="pt-2 flex justify-center">
            <button
              onClick={() => navigate('/')}
              className="px-5 py-2.5 rounded-full font-semibold text-sm bg-slate-200 dark:bg-white/10 hover:opacity-90 transition-opacity"
            >
              Back to Home
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!loading && !effectiveProfile) {
    return (
      <div className={cn(
        "min-h-screen flex items-center justify-center p-4",
        isDark ? "bg-[#060816] text-white" : "bg-[#f0f4fa] text-slate-900"
      )}>
        <div className={cn(
          "max-w-md w-full p-8 rounded-3xl border text-center space-y-4 shadow-xl",
          isDark ? "bg-[#0d1424] border-white/10" : "bg-white border-slate-200"
        )}>
          <div className="w-16 h-16 mx-auto rounded-full bg-purple-500/10 text-purple-500 flex items-center justify-center text-2xl font-bold">
            ?
          </div>
          <h2 className="text-xl font-black">Creator Profile Not Found</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            This account may have been renamed, removed, or is not yet available on Arvdoul.
          </p>
          <div className="pt-2 flex justify-center gap-3">
            <button
              onClick={() => navigate(-1)}
              className="px-5 py-2.5 rounded-full font-semibold text-sm bg-slate-200 dark:bg-white/10 hover:opacity-90 transition-opacity"
            >
              Go Back
            </button>
            <button
              onClick={() => navigate('/')}
              className="px-5 py-2.5 rounded-full font-semibold text-sm text-white bg-gradient-to-r from-purple-600 to-indigo-600 hover:opacity-90 shadow-md transition-opacity"
            >
              Discover Creators
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div className={cn(
        "min-h-screen pb-24 transition-colors duration-200",
        isDark
          ? "bg-[#060816] text-white selection:bg-purple-500/30"
          : "bg-[#f0f4fa] text-slate-900 selection:bg-purple-500/20"
      )}>
        {/* Outer responsive frame matching design images */}
        <div className="max-w-6xl mx-auto px-3 sm:px-6 py-3 sm:py-5 space-y-4 sm:space-y-5">
          
          {/* 1. Hero Section with Top Back/Action Sub-bar */}
          <ProfileHeroSection
            profile={effectiveProfile}
            isOwner={false}
            level={effectiveProfile.level || 1}
            theme={theme}
            onBack={() => navigate(-1)}
            onOpenQrCode={() => setShowQrModal(true)}
            onOpenQrScanner={() => setShowScannerModal(true)}
            onOpenNotifications={() => navigate('/notifications')}
            onOpenMessages={() => navigate(`/messages/new?to=${effectiveProfile.id || effectiveProfile.uid}`)}
            onOpenOptions={() => setShowOptionsMenu(true)}
            onAvatarClick={() => setShowQrModal(true)}
            onShare={handleShare}
            onFollowToggle={handleFollowToggle}
            isFollowing={isFollowing}
            followLoading={followLoading}
            friendshipStatus={friendshipStatus}
            friendRequestLoading={friendRequestLoading}
            onFriendRequestToggle={handleFriendRequestToggle}
            onOpenTipModal={() => setShowTipModal(true)}
          />

          {/* 2. Key Metrics Strip */}
          <ProfileMetricsGrid
            isOwner={false}
            theme={theme}
            profile={effectiveProfile}
            analytics={analytics}
            capabilities={capabilities}
            onMetricPress={(key) => {
              if (key === 'followers') navigate(`/profile/${userId}/followers`);
              else if (key === 'following') navigate(`/profile/${userId}/following`);
              else if (key === 'friends') navigate(`/profile/${userId}/friends`);
            }}
          />

          {/* 2b. Mutual Friends Line */}
          {mutualFriends && mutualFriends.length > 0 && (
            <ProfileMutualFriends
              mutualFriends={mutualFriends}
              theme={theme}
              onFriendPress={(friend) => navigate(`/profile/${friend.id || friend.uid || friend.username}`)}
            />
          )}

          {!capabilities.canViewContent ? (
            /* Restricted / Private Account Access Gate */
            <div className={cn(
              "rounded-3xl p-8 sm:p-12 text-center border shadow-sm space-y-4 my-6",
              isDark ? "bg-[#0d1424]/80 border-white/10" : "bg-white border-slate-200"
            )}>
              <div className="w-16 h-16 mx-auto rounded-full bg-purple-500/10 text-purple-500 flex items-center justify-center">
                <Lock className="w-8 h-8" />
              </div>
              <div className="space-y-1">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">This Account is Private</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 max-w-md mx-auto">
                  Follow @{effectiveProfile.username} to view their media gallery, highlights, and activity feed.
                </p>
              </div>
              <div className="pt-2 flex justify-center">
                <button
                  onClick={handleFollowToggle}
                  className="px-6 py-2.5 rounded-full font-semibold text-sm text-white bg-gradient-to-r from-purple-600 to-indigo-600 hover:opacity-90 shadow-md transition-opacity flex items-center gap-2"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>{isFollowing ? 'Requested' : 'Follow to View'}</span>
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* 5. Highlights / Vibes Carousel */}
              <ProfileHighlightsSection
                highlights={effectiveProfile?.highlights || []}
                userId={userId}
                isOwner={false}
                theme={theme}
              />

              {/* 6. Featured by Creator Section */}
              <ProfileFeaturedSection
                profile={effectiveProfile}
                posts={posts}
                theme={theme}
                onPostClick={(post) => navigate(`/post/${post.id}`)}
              />

              {/* 7. Multi-Tab Navigation Bar */}
              <div className="sticky top-2 z-30 pt-1">
                <ProfileTabsBar
                  activeTab={activeTab}
                  onTabChange={setActiveTab}
                  isOwner={false}
                  theme={theme}
                  counts={{
                    posts: posts?.length || 0,
                  }}
                />
              </div>

              {/* 8. Pinned Posts Section */}
              <ProfilePinnedPosts
                posts={posts}
                theme={theme}
                onPostClick={(post) => navigate(`/post/${post.id}`)}
              />

              {/* 9. Media Feed Grid */}
              <ProfileFeedGrid
                posts={posts}
                activeTab={activeTab}
                loading={loading}
                theme={theme}
                profile={effectiveProfile}
                onPostClick={(post) => navigate(`/post/${post.id}`)}
              />
            </>
          )}

        </div>

        {/* Tip / Gift Modal */}
        {showTipModal && (
          <ProfileTipModal
            isOpen={showTipModal}
            onClose={() => setShowTipModal(false)}
            recipient={effectiveProfile}
            currentUser={currentUser}
            onTipSuccess={(amount) => {
              toast.success(`Successfully gifted ${amount} coins to ${effectiveProfile.displayName}!`);
              setShowTipModal(false);
            }}
          />
        )}

        {/* QR Code Modal */}
        <ProfileQRCodeModal
          isOpen={showQrModal}
          onClose={() => setShowQrModal(false)}
          profile={effectiveProfile}
          theme={theme}
        />

        {/* QR Scanner Modal */}
        {showScannerModal && (
          <ProfileQRScannerModal
            isOpen={showScannerModal}
            onClose={() => setShowScannerModal(false)}
            theme={theme}
          />
        )}

        {/* Options Menu */}
        {showOptionsMenu && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="relative w-full max-w-sm rounded-3xl overflow-hidden shadow-2xl">
              <Suspense fallback={null}>
                <ProfileOptionsMenu
                  profile={effectiveProfile}
                  isOwner={false}
                  theme={theme}
                  capabilities={capabilities}
                  onClose={() => setShowOptionsMenu(false)}
                />
              </Suspense>
            </div>
          </div>
        )}
      </div>
    </ErrorBoundary>
  );
}
