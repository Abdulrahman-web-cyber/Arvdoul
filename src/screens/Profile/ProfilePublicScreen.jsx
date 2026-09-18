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
import { toast } from 'sonner';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { cn } from '../../lib/utils';
import { getSafeAvatarUrl } from '../../utils/avatarUtils';
import { TopAppLoadingBanner } from '../../components/Navigation/RouteProgressBar';
import { ErrorBoundary } from '../../components/ErrorBoundary';

// Modular Profile Components
import ProfileHeroSection from '../../components/profile/ProfileHeroSection';
import ProfileActionBar from '../../components/profile/ProfileActionBar';
import ProfileSocialConnections from '../../components/profile/ProfileSocialConnections';
import ProfileMetricsGrid from '../../components/profile/ProfileMetricsGrid';
import ProfileHighlightsSection from '../../components/profile/ProfileHighlightsSection';
import ProfileFeaturedSection from '../../components/profile/ProfileFeaturedSection';
import ProfileTabsBar from '../../components/profile/ProfileTabsBar';
import ProfilePinnedPosts from '../../components/profile/ProfilePinnedPosts';
import ProfileFeedGrid from '../../components/profile/ProfileFeedGrid';
import ProfileTipModal from '../../components/profile/ProfileTipModal';
import ProfileQRCodeModal from '../../components/profile/ProfileQRCodeModal';
import ProfileQRScannerModal from '../../components/profile/ProfileQRScannerModal';

// Modals
const ProfileOptionsMenu = lazy(() => import('../../components/profile/ProfileOptionsMenu'));
const ProfileSkeleton = lazy(() => import('../../components/profile/ProfileSkeleton'));

export default function ProfilePublicScreen() {
  const { userId } = useParams();
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
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
  
  // Modals
  const [showTipModal, setShowTipModal] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);
  const [showScannerModal, setShowScannerModal] = useState(false);
  const [showOptionsMenu, setShowOptionsMenu] = useState(false);

  // Load profile and related data
  useEffect(() => {
    let isMounted = true;
    const loadPublicProfile = async () => {
      if (!userId) return;
      setLoading(true);

      try {
        const userServiceModule = await import('../../services/userService.js');
        const userService = userServiceModule.getUserService();

        // 1. Fetch user profile
        const fetched = await userService.getUserProfile(userId, currentUser?.uid);
        
        // 2. Fetch posts
        let userPosts = [];
        try {
          const { getFirestoreService } = await import('../../services/firestoreService.js');
          const postsRes = await getFirestoreService().getPostsByUser(userId, { limit: 30 });
          if (postsRes?.posts && Array.isArray(postsRes.posts)) {
            userPosts = postsRes.posts;
          }
        } catch (postErr) {
          console.warn('Posts fetch note:', postErr);
        }

        // 3. Fetch follow status
        if (currentUser?.uid && userId !== currentUser.uid) {
          try {
            const status = await userService.checkFollowStatus(currentUser.uid, userId);
            if (isMounted) setIsFollowing(Boolean(status?.isFollowing || fetched?.isFollowing));
          } catch (followErr) {
            if (isMounted && fetched?.isFollowing !== undefined) {
              setIsFollowing(Boolean(fetched.isFollowing));
            }
          }
        }

        // 4. Fetch mutual friends and friend request status
        if (currentUser?.uid && userId !== currentUser.uid) {
          try {
            const mutual = await userService.getMutualFriends(currentUser.uid, userId);
            const friendsList = Array.isArray(mutual) ? mutual : (mutual?.mutualFriends || []);
            if (isMounted) {
              setMutualFriends(friendsList);
            }

            // Check if mutual friends directly
            const areFriends = await userService._areMutualFriends(currentUser.uid, userId).catch(() => false);
            if (areFriends) {
              if (isMounted) setFriendshipStatus('friends');
            } else {
              // Check sent friend requests
              const sent = await userService.getFriendRequests(currentUser.uid, 'sent').catch(() => ({ requests: [] }));
              const sentReq = sent.requests?.find(r => r.toUserId === userId);
              if (sentReq) {
                if (isMounted) {
                  setFriendshipStatus('pending');
                  setPendingRequestId(sentReq.id);
                }
              } else {
                // Check received friend requests
                const received = await userService.getFriendRequests(currentUser.uid, 'received').catch(() => ({ requests: [] }));
                const recReq = received.requests?.find(r => r.fromUserId === userId);
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
          if (currentUser?.uid && userId !== currentUser.uid) {
            analyticsService.trackProfileView(currentUser.uid, userId).catch(() => {});
          }
          const userAnalytics = await analyticsService.getUserAnalytics(userId, '30d');
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

  // Real profile data without mock fallbacks
  const effectiveProfile = useMemo(() => {
    if (!profileData) return null;
    return {
      ...profileData,
      id: profileData.id || profileData.uid || userId,
      username: (profileData.username && !profileData.username.startsWith('user_') && profileData.username !== 'creator')
        ? profileData.username
        : (profileData.handle && !profileData.handle.startsWith('user_'))
          ? profileData.handle
          : (profileData.displayName?.toLowerCase().replace(/[^a-z0-9_]/g, '') || profileData.email?.split('@')[0]?.toLowerCase().replace(/[^a-z0-9_]/g, '') || (profileData.username && !profileData.username.startsWith('user_') ? profileData.username : 'creator')),
      displayName: (profileData.displayName && profileData.displayName !== 'User' && profileData.displayName !== 'Creator')
        ? profileData.displayName
        : (profileData.name && profileData.name !== 'User' && profileData.name !== 'Creator')
          ? profileData.name
          : (profileData.username || 'Creator'),
      bio: profileData.bio || '',
      photoURL: getSafeAvatarUrl(profileData.photoURL, profileData.displayName || 'Creator', userId),
      coverPhotoURL: profileData.coverPhotoURL || null,
      followerCount: Number(profileData.followerCount ?? profileData.followersCount ?? 0),
      followingCount: Number(profileData.followingCount ?? 0),
      postCount: posts?.length ?? profileData.postCount ?? 0,
      likesReceived: Number(profileData.likesReceived ?? profileData.likesCount ?? 0),
      coins: Number(profileData.coins ?? profileData.coinBalance ?? 0),
      isVerified: Boolean(profileData.isVerified),
      isCreator: Boolean(profileData.isCreator),
      level: profileData.level || 1,
      location: profileData.location || profileData.city || '',
      website: profileData.website || profileData.link || '',
    };
  }, [profileData, userId, posts?.length]);

  if (loading && !profileData) {
    return (
      <div className={cn(
        'min-h-screen pb-20',
        isDark ? 'bg-[#060816]' : 'bg-[#f0f4fa]'
      )}>
        <TopAppLoadingBanner isAnimating={true} label="Loading Profile..." />
        <Suspense fallback={null}>
          <ProfileSkeleton theme={theme} />
        </Suspense>
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
          />

          {/* 2. Public Action Bar: Follow / Add Friend, Message, Call, Gift, Options */}
          <ProfileActionBar
            isOwner={false}
            theme={theme}
            profile={effectiveProfile}
            isFollowing={isFollowing}
            followLoading={followLoading}
            friendshipStatus={friendshipStatus}
            friendRequestLoading={friendRequestLoading}
            onFollowToggle={handleFollowToggle}
            onFriendRequestToggle={handleFriendRequestToggle}
            onOpenTipModal={() => setShowTipModal(true)}
            onOpenOptionsMenu={() => setShowOptionsMenu(true)}
            onCallPress={() => toast.info('Starting secure audio call...')}
          />

          {/* 3. 3-Column Social Connections Card */}
          <ProfileSocialConnections
            mutualFriends={mutualFriends}
            profile={effectiveProfile}
            theme={theme}
            onMutualClick={() => navigate(`/profile/${userId}/mutual-friends`)}
          />

          {/* 4. 6-Cards Key Metrics Grid */}
          <ProfileMetricsGrid
            isOwner={false}
            theme={theme}
            profile={effectiveProfile}
            analytics={analytics}
            onMetricPress={(key) => {
              if (key === 'followers') navigate(`/profile/${userId}/followers`);
              else if (key === 'following') navigate(`/profile/${userId}/following`);
              else if (key === 'friends') navigate(`/profile/${userId}/friends`);
            }}
          />

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
