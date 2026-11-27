// src/routes/AppRoutes.jsx

import { lazy, Suspense, useState, useEffect } from "react";
import { Routes, Route, Navigate, Outlet, useParams, useLocation, useMatch } from "react-router-dom";
import AppStateGuard from "../app/AppStateGuard.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import SplashScreen from "../screens/SplashScreen.jsx";
import logger from "../utils/Logger.js";
import metricsService from "../services/metricsService.js";

import BrandBootCanvas from "../components/Shared/BrandBootCanvas.jsx";
import { useTheme } from "../context/ThemeContext.jsx";
import MainLayout from "../layouts/MainLayout.jsx";

const IntroScreen = lazyWithRetry(() => import("../screens/IntroScreen.jsx"), "IntroScreen");
const LoginScreen = lazyWithRetry(() => import("../screens/LoginScreen.jsx"), "LoginScreen");
const HomeScreen = lazyWithRetry(() => import("../screens/HomeScreen.jsx"), "HomeScreen");
const VideosScreen = lazyWithRetry(() => import("../screens/VideosScreen.jsx"), "VideosScreen");
const MessagingScreen = lazyWithRetry(() => import("../screens/MessagingScreen.jsx"), "MessagingScreen");
const NotificationsScreen = lazyWithRetry(() => import("../screens/NotificationsScreen.jsx"), "NotificationsScreen");
const ProfileScreen = lazyWithRetry(() => import("../screens/Profile/ProfileScreen.jsx"), "ProfileScreen");
const ProfilePublicScreen = lazyWithRetry(() => import("../screens/Profile/ProfilePublicScreen.jsx"), "ProfilePublicScreen");
const ProfileMyScreen = lazyWithRetry(() => import("../screens/Profile/ProfileMyScreen.jsx"), "ProfileMyScreen");
const EditProfile = lazyWithRetry(() => import("../screens/Profile/EditProfileScreen.jsx"), "EditProfile");
const CreatorDashboardScreen = lazyWithRetry(() => import("../screens/Profile/CreatorDashboardScreen.jsx"), "CreatorDashboardScreen");
const FollowersScreen = lazyWithRetry(() => import("../screens/Profile/FollowersScreen.jsx"), "FollowersScreen");
const FollowingScreen = lazyWithRetry(() => import("../screens/Profile/FollowingScreen.jsx"), "FollowingScreen");
const FriendsScreen = lazyWithRetry(() => import("../screens/Profile/FriendsScreen.jsx"), "FriendsScreen");
const ConnectionsScreen = lazyWithRetry(() => import("../screens/Profile/ConnectionsScreen.jsx"), "ConnectionsScreen");
const PassportScreen = lazyWithRetry(() => import("../screens/Citizenship/PassportScreen.jsx"), "PassportScreen");

function isDynamicImportError(err) {
  const msg = String(err?.message || err || '');
  return (
    err?.name === 'ChunkLoadError' ||
    msg.includes('Failed to fetch dynamically imported module') ||
    msg.includes('Importing a module script failed') ||
    msg.includes('error loading dynamically imported module') ||
    msg.includes('Loading chunk')
  );
}

function lazyWithRetry(loader, chunkKey) {
  return lazy(async () => {
    const delays = [150, 450, 1000];
    let lastErr;
    for (let attempt = 0; attempt <= delays.length; attempt++) {
      try {
        return await loader();
      } catch (err) {
        lastErr = err;
        if (!isDynamicImportError(err) || attempt === delays.length) break;
        await new Promise((resolve) => setTimeout(resolve, delays[attempt]));
      }
    }

    if (typeof window !== 'undefined' && isDynamicImportError(lastErr)) {
      try {
        const storageKey = `arvdoul_chunk_reload:${chunkKey || 'route'}`;
        const prev = Number(window.sessionStorage.getItem(storageKey) || '0');
        if (!prev || Date.now() - prev > 20000) {
          window.sessionStorage.setItem(storageKey, String(Date.now()));
          window.location.reload();
          return new Promise(() => {});
        }
      } catch {
        // sessionStorage may be restricted in hardened webviews
      }
    }
    throw lastErr;
  });
}

const SubscriptionScreen = lazyWithRetry(() => import("../screens/SubscriptionScreen.jsx"), "SubscriptionScreen");
const DataUsageScreen = lazyWithRetry(() => import("../screens/DataUsageScreen.jsx"), "DataUsageScreen");
const BlockedAccountsScreen = lazyWithRetry(() => import("../screens/BlockedAccountsScreen.jsx"), "BlockedAccountsScreen");
const ProjectDashboardScreen = lazyWithRetry(() => import("../screens/Collaboration/ProjectDashboardScreen.jsx"), "ProjectDashboardScreen");
const ProjectDetailScreen = lazyWithRetry(() => import("../screens/Collaboration/ProjectDetailScreen.jsx"), "ProjectDetailScreen");
const SignupStep1Personal = lazyWithRetry(() => import("../screens/SignupStep1Personal.jsx"), "SignupStep1Personal");
const SignupStep2VerifyContact = lazyWithRetry(() => import("../screens/SignupStep2VerifyContact.jsx"), "SignupStep2VerifyContact");
const OtpVerification = lazyWithRetry(() => import("../screens/OtpVerification.jsx"), "OtpVerification");
const VerifyEmailScreen = lazyWithRetry(() => import("../screens/VerifyEmailScreen.jsx"), "VerifyEmailScreen");
const ForgotPasswordScreen = lazyWithRetry(() => import("../screens/ForgotPassword.jsx"), "ForgotPasswordScreen");
const ResetPasswordScreen = lazyWithRetry(() => import("../screens/ResetPassword.jsx"), "ResetPasswordScreen");
const SetupProfile = lazyWithRetry(() => import("../screens/SetupProfile.jsx"), "SetupProfile");
const ChatScreen = lazyWithRetry(() => import("../screens/ChatScreen.jsx"), "ChatScreen");
const NewConversationScreen = lazyWithRetry(() => import("../screens/NewConversationScreen.jsx"), "NewConversationScreen");
const GroupInfoScreen = lazyWithRetry(() => import("../screens/GroupInfoScreen.jsx"), "GroupInfoScreen");
const JoinGroupScreen = lazyWithRetry(() => import("../screens/JoinGroupScreen.jsx"), "JoinGroupScreen");
const ConversationSettingsScreen = lazyWithRetry(() => import("../screens/ConversationSettingsScreen.jsx"), "ConversationSettingsScreen");
const CreatePost = lazyWithRetry(() => import("../screens/CreatePost.jsx"), "CreatePost");
const CoinsScreen = lazyWithRetry(() => import("../screens/CoinsScreen.jsx"), "CoinsScreen");
const CreateStory = lazyWithRetry(() => import("../screens/CreateStory.jsx"), "CreateStory");
const StoriesScreen = lazyWithRetry(() => import("../screens/StoriesScreen.jsx"), "StoriesScreen");
// Profile secondary screens
const HighlightsScreen = lazyWithRetry(() => import("../screens/Profile/HighlightsScreen.jsx"), "HighlightsScreen");
const AboutScreen = lazyWithRetry(() => import("../screens/Profile/AboutScreen.jsx"), "AboutScreen");
const ProfilePreviewScreen = lazyWithRetry(() => import("../screens/Profile/ProfilePreviewScreen.jsx"), "ProfilePreviewScreen");
const LevelRoadmapScreen = lazyWithRetry(() => import("../screens/Profile/LevelRoadmapScreen.jsx"), "LevelRoadmapScreen");
// Legacy / detail screens
const PostDetails = lazyWithRetry(() => import("../screens/PostDetails.jsx"), "PostDetails");
const SettingsScreen = lazyWithRetry(() => import("../screens/SettingsScreen.jsx"), "SettingsScreen");
const SearchScreen = lazyWithRetry(() => import("../screens/SearchScreen.jsx"), "SearchScreen");
const SavedScreen = lazyWithRetry(() => import("../screens/SavedScreen.jsx"), "SavedScreen");
const CollectionsScreen = lazyWithRetry(() => import("../screens/CollectionsScreen.jsx"), "CollectionsScreen");
const LiveScreen = lazyWithRetry(() => import("../screens/LiveScreen.jsx"), "LiveScreen");
// Video & Post Analytics
const VideoAnalyticsScreen = lazyWithRetry(() => import("../screens/VideoAnalyticsScreen.jsx"), "VideoAnalyticsScreen");
const PostAnalyticsScreen = lazyWithRetry(() => import("../screens/PostAnalyticsScreen.jsx"), "PostAnalyticsScreen");
const ReelsScreen = lazyWithRetry(() => import("../screens/ReelsScreen.jsx"), "ReelsScreen");
const VideoDetailScreen = lazyWithRetry(() => import("../screens/VideoDetailScreen.jsx"), "VideoDetailScreen");
const CallScreen = lazyWithRetry(() => import("../screens/CallScreen.jsx"), "CallScreen");
const GiftScreen = lazyWithRetry(() => import("../screens/GiftScreen.jsx"), "GiftScreen");

// Community Screens
const CommunityDirectoryScreen = lazyWithRetry(() => import("../screens/Community/CommunityDirectoryScreen.jsx"), "CommunityDirectoryScreen");
const CreateCommunityScreen = lazyWithRetry(() => import("../screens/Community/CreateCommunityScreen.jsx"), "CreateCommunityScreen");
const CommunityDetailScreen = lazyWithRetry(() => import("../screens/Community/CommunityDetailScreen.jsx"), "CommunityDetailScreen");
const CommunitySettingsScreen = lazyWithRetry(() => import("../screens/Community/CommunitySettingsScreen.jsx"), "CommunitySettingsScreen");

// Event Screens
const EventDiscoveryScreen = lazyWithRetry(() => import("../screens/Event/EventDiscoveryScreen.jsx"), "EventDiscoveryScreen");
const CreateEventScreen = lazyWithRetry(() => import("../screens/Event/CreateEventScreen.jsx"), "CreateEventScreen");
const EventDetailScreen = lazyWithRetry(() => import("../screens/Event/EventDetailScreen.jsx"), "EventDetailScreen");

// Admin Screens
const AdminDashboardScreen = lazyWithRetry(() => import("../screens/Admin/AdminDashboardScreen.jsx"), "AdminDashboardScreen");
const AdminUserManagementScreen = lazyWithRetry(() => import("../screens/Admin/AdminUserManagementScreen.jsx"), "AdminUserManagementScreen");
const AdminContentManagementScreen = lazyWithRetry(() => import("../screens/Admin/AdminContentManagementScreen.jsx"), "AdminContentManagementScreen");
const AdminModerationQueueScreen = lazyWithRetry(() => import("../screens/Admin/AdminModerationQueueScreen.jsx"), "AdminModerationQueueScreen");
const AdminEconomyScreen = lazyWithRetry(() => import("../screens/Admin/AdminEconomyScreen.jsx"), "AdminEconomyScreen");
const AdminVerificationScreen = lazyWithRetry(() => import("../screens/Admin/AdminVerificationScreen.jsx"), "AdminVerificationScreen");
const AdminFeatureFlagsScreen = lazyWithRetry(() => import("../screens/Admin/AdminFeatureFlagsScreen.jsx"), "AdminFeatureFlagsScreen");
const AdminSystemHealthScreen = lazyWithRetry(() => import("../screens/Admin/AdminSystemHealthScreen.jsx"), "AdminSystemHealthScreen");
const AdminAuditLogsScreen = lazyWithRetry(() => import("../screens/Admin/AdminAuditLogsScreen.jsx"), "AdminAuditLogsScreen");
const AdminSupportTicketsScreen = lazyWithRetry(() => import("../screens/Admin/AdminSupportTicketsScreen.jsx"), "AdminSupportTicketsScreen");
const AdminCommunityManagementScreen = lazyWithRetry(() => import("../screens/Admin/AdminCommunityManagementScreen.jsx"), "AdminCommunityManagementScreen");
const AdminAccessScreen = lazyWithRetry(() => import("../screens/Admin/AdminAccessScreen.jsx"), "AdminAccessScreen");

// Creative Studio & Rankings
const VideoEditorScreen = lazyWithRetry(() => import("../screens/VideoEditor/VideoEditorScreen.jsx"), "VideoEditorScreen");
const AudioEditorScreen = lazyWithRetry(() => import("../screens/AudioEditor/AudioEditorScreen.jsx"), "AudioEditorScreen");
const ThumbnailDesignerScreen = lazyWithRetry(() => import("../screens/ThumbnailDesigner/ThumbnailDesignerScreen.jsx"), "ThumbnailDesignerScreen");
const RankingsScreen = lazyWithRetry(() => import("../screens/Rankings/RankingsScreen.jsx"), "RankingsScreen");
const ReputationScreen = lazyWithRetry(() => import("../screens/Rankings/ReputationScreen.jsx"), "ReputationScreen");

// Progression, Achievements, Titles, Creator Onboarding, Wallet
const ProgressScreen = lazyWithRetry(() => import("../screens/Progression/ProgressScreen.jsx"), "ProgressScreen");
const PerksRewardsScreen = lazyWithRetry(() => import("../screens/Progression/PerksRewardsScreen.jsx"), "PerksRewardsScreen");
const AchievementsScreen = lazyWithRetry(() => import("../screens/Achievements/AchievementsScreen.jsx"), "AchievementsScreen");
const TitlesScreen = lazyWithRetry(() => import("../screens/Titles/TitlesScreen.jsx"), "TitlesScreen");
const CreatorOnboardingScreen = lazyWithRetry(() => import("../screens/Creator/CreatorOnboardingScreen.jsx"), "CreatorOnboardingScreen");
const WalletScreen = lazyWithRetry(() => import("../screens/Economy/WalletScreen.jsx"), "WalletScreen");

// Menu, Offline, Ads
const MenuScreen = lazyWithRetry(() => import("../screens/Menu/MenuScreen.jsx"), "MenuScreen");
const OfflineStatusScreen = lazyWithRetry(() => import("../screens/OfflineStatusScreen.jsx"), "OfflineStatusScreen");
const ConflictResolutionScreen = lazyWithRetry(() => import("../screens/ConflictResolutionScreen.jsx"), "ConflictResolutionScreen");
const CreatorPayoutScreen = lazyWithRetry(() => import("../screens/CreatorPayoutScreen.jsx"), "CreatorPayoutScreen");
const AdvertisingDashboardScreen = lazyWithRetry(() => import("../screens/Advertising/AdvertisingDashboardScreen.jsx"), "AdvertisingDashboardScreen");
const CampaignBuilderScreen = lazyWithRetry(() => import("../screens/Advertising/CampaignBuilderScreen.jsx"), "CampaignBuilderScreen");
const AdBillingScreen = lazyWithRetry(() => import("../screens/Advertising/AdBillingScreen.jsx"), "AdBillingScreen");
const AdAnalyticsScreen = lazyWithRetry(() => import("../screens/Advertising/AdAnalyticsScreen.jsx"), "AdAnalyticsScreen");
const AdReviewQueueScreen = lazyWithRetry(() => import("../screens/Advertising/AdReviewQueueScreen.jsx"), "AdReviewQueueScreen");

// ARVDOUL ADVANCED SUITE SCREENS
const AIStudioScreen = lazyWithRetry(() => import("../screens/AIStudio/AIStudioScreen.jsx"), "AIStudioScreen");
const SpacesScreen = lazyWithRetry(() => import("../screens/Spaces/SpacesScreen.jsx"), "SpacesScreen");
const SoundsScreen = lazyWithRetry(() => import("../screens/Sounds/SoundsScreen.jsx"), "SoundsScreen");
const MarketplaceScreen = lazyWithRetry(() => import("../screens/Marketplace/MarketplaceScreen.jsx"), "MarketplaceScreen");
const PollsScreen = lazyWithRetry(() => import("../screens/Polls/PollsScreen.jsx"), "PollsScreen");
const NotFoundScreen = lazyWithRetry(() => import("../screens/NotFoundScreen.jsx"), "NotFoundScreen");
const HelpCenterScreen = lazyWithRetry(() => import("../screens/Help/HelpCenterScreen.jsx"), "HelpCenterScreen");

import {
  SectionErrorBoundary,
  FeedErrorBoundary,
  ProfileErrorBoundary,
  ChatErrorBoundary,
  CreatorErrorBoundary,
  PostErrorBoundary,
} from "../components/ErrorBoundary/SectionErrorBoundary.jsx";
import { RouteProgressBar } from "../components/Navigation/RouteProgressBar.jsx";
import FeatureGate from "../components/Shared/FeatureGate.jsx";

// In-app route fallback inside MainLayout (no duplicate splash wordmark).
// Delays skeleton box reveal by 180ms so prefetched/fast route chunks swap
// instantaneously with only the subtle top progress bar and zero skeleton flash.
const RouteLoadingFallback = () => {
  const [showSkeleton, setShowSkeleton] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setShowSkeleton(true), 180);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div
      className="relative w-full min-h-[65dvh] px-4 py-6 max-w-2xl mx-auto"
      aria-busy="true"
      aria-label="Loading page"
    >
      <RouteProgressBar isAnimating={true} />
      {showSkeleton && (
        <div className="animate-pulse transition-opacity duration-150">
          <div className="h-28 rounded-2xl bg-black/[0.04] dark:bg-white/[0.04] mb-4" />
          <div className="h-44 rounded-2xl bg-black/[0.04] dark:bg-white/[0.04] mb-4" />
          <div className="h-36 rounded-2xl bg-black/[0.04] dark:bg-white/[0.04]" />
        </div>
      )}
    </div>
  );
};
const RouteFallback = RouteLoadingFallback;

// Layoutless routes (Intro, Login, Signup, Join Group) need the full themed
// Arvdoul lockup while lazy chunks resolve so users never see an unstyled flash.
const PublicRouteFallback = () => {
  const { isDark } = useTheme();
  return (
    <BrandBootCanvas isDark={isDark} label="Loading screen">
      <RouteProgressBar isAnimating={true} />
    </BrandBootCanvas>
  );
};

const RedirectChatToMessages = () => {
  const { conversationId } = useParams();
  return <Navigate to={conversationId ? `/messages/${conversationId}` : "/messages"} replace />;
};

const PublicRoute = ({ children }) => {
  return <AppStateGuard>{children}</AppStateGuard>;
};

const ProtectedRoute = ({ children }) => {
  return (
    <AppStateGuard>
      <MainLayout>{children}</MainLayout>
    </AppStateGuard>
  );
};

// Special layout for messaging that handles split-pane desktop workspace and mobile full-screen subroutes
const MessagingLayout = ({ children }) => {
  const location = useLocation();
  const match = useMatch("/messages/:conversationId/*");
  const [isDesktop, setIsDesktop] = useState(() =>
    typeof window !== "undefined" && typeof window.matchMedia === "function"
      ? window.matchMedia("(min-width: 1024px)").matches
      : false
  );

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return undefined;
    const mql = window.matchMedia("(min-width: 1024px)");
    const onChange = (e) => setIsDesktop(e.matches);
    setIsDesktop(mql.matches);
    if (mql.addEventListener) {
      mql.addEventListener("change", onChange);
      return () => mql.removeEventListener("change", onChange);
    }
    mql.addListener(onChange);
    return () => mql.removeListener(onChange);
  }, []);

  const isIndexRoute = location.pathname === "/messages" || location.pathname === "/messages/";
  const activeConversationId =
    match?.params?.conversationId && match.params.conversationId !== "new"
      ? match.params.conversationId
      : null;

  return (
    <AppStateGuard>
      <Suspense fallback={<AppShellFallback />}>
        <MainLayout>
          {isDesktop && !isIndexRoute ? (
            <div className="flex flex-1 min-h-0 w-full h-full overflow-hidden">
              <aside
                aria-label="Conversations sidebar"
                className="w-[360px] xl:w-[392px] shrink-0 h-full min-h-0 flex flex-col border-r border-slate-200/80 dark:border-white/[0.08]"
              >
                <Suspense fallback={<RouteLoadingFallback />}>
                  <MessagingScreen sidebarMode activeConversationId={activeConversationId} />
                </Suspense>
              </aside>
              <div className="flex-1 min-w-0 h-full min-h-0 flex flex-col overflow-hidden">
                {children}
              </div>
            </div>
          ) : (
            children
          )}
        </MainLayout>
      </Suspense>
    </AppStateGuard>
  );
};

// Any signed-in user reaching /admin has their own grant checked by the
// getAdminStatus callable. The client deliberately has no read access to the
// admins collection, so the roster cannot be enumerated.
const AdminRoute = ({ children }) => {
  const { user } = useAuth();
  const [allowed, setAllowed] = useState(null);

  useEffect(() => {
    let mounted = true;
    const check = async () => {
      if (!user?.uid) { if (mounted) setAllowed(false); return; }
      try {
        const { fetchAdminStatus } = await import('../services/callableService.js');
        const isAdmin = await fetchAdminStatus();
        if (mounted) setAllowed(isAdmin);
      } catch (err) {
        if (mounted) setAllowed(false);
      }
    };
    check();
    return () => { mounted = false; };
  }, [user?.uid]);

  if (allowed === null) {
    return <div className="min-h-[100dvh] w-full bg-[#F6F8FC] dark:bg-[#03071B] flex items-center justify-center"><div className="w-10 h-10 border-4 border-violet-500 border-t-transparent rounded-full animate-spin" /></div>;
  }
  if (!allowed) return <Navigate to="/home" replace />;
  return (
    <AppStateGuard>
      <Suspense fallback={<AppShellFallback />}>
        <MainLayout>{children}</MainLayout>
      </Suspense>
    </AppStateGuard>
  );
};

function RedirectProfilePosts() {
  const { userId } = useParams();
  return <Navigate to={userId ? `/profile/${encodeURIComponent(userId)}` : '/profile'} replace />;
}

export default function AppRoutes() {
  return (
    <Routes>
      {/* ========== PUBLIC ROUTES (No Layout) ========== */}
      <Route path="/" element={
        <PublicRoute>
          <SplashScreen
            onMetrics={(m) => {
              if (typeof m.msToReady === "number") {
                metricsService.recordHistogram("splash_ms_to_ready", m.msToReady);
              }
              if (typeof m.msToHandoff === "number") {
                metricsService.recordHistogram("splash_ms_to_handoff", m.msToHandoff);
              }
            }}
            onRenderError={(error, info) =>
              logger.error("Splash render error", {
                error: error?.message,
                componentStack: info?.componentStack,
              })
            }
          />
        </PublicRoute>
      } />
      
      <Route path="/intro" element={
        <PublicRoute>
          <Suspense fallback={<PublicRouteFallback />}>
            <IntroScreen />
          </Suspense>
        </PublicRoute>
      } />
      
      <Route path="/login" element={
        <PublicRoute>
          <Suspense fallback={<PublicRouteFallback />}>
            <LoginScreen />
          </Suspense>
        </PublicRoute>
      } />
      
      <Route path="/signup" element={<Navigate to="/signup/step1" replace />} />

      <Route path="/signup/step1" element={
        <PublicRoute>
          <Suspense fallback={<PublicRouteFallback />}>
            <SignupStep1Personal />
          </Suspense>
        </PublicRoute>
      } />
      
      <Route path="/signup/step2" element={
        <PublicRoute>
          <Suspense fallback={<PublicRouteFallback />}>
            <SignupStep2VerifyContact />
          </Suspense>
        </PublicRoute>
      } />
      
      <Route path="/otp-verification" element={
        <PublicRoute>
          <Suspense fallback={<PublicRouteFallback />}>
            <OtpVerification />
          </Suspense>
        </PublicRoute>
      } />
      
      <Route path="/verify-email" element={
        <PublicRoute>
          <Suspense fallback={<PublicRouteFallback />}>
            <VerifyEmailScreen />
          </Suspense>
        </PublicRoute>
      } />
      
      <Route path="/forgot-password" element={
        <PublicRoute>
          <Suspense fallback={<PublicRouteFallback />}>
            <ForgotPasswordScreen />
          </Suspense>
        </PublicRoute>
      } />
      
      <Route path="/reset-password" element={
        <PublicRoute>
          <Suspense fallback={<PublicRouteFallback />}>
            <ResetPasswordScreen />
          </Suspense>
        </PublicRoute>
      } />
      
      {/* ========== PROTECTED ROUTES (With Layout) ========== */}
      
      {/* Core App Routes */}
      <Route path="/home" element={
        <ProtectedRoute>
          <FeedErrorBoundary>
            <Suspense fallback={<RouteLoadingFallback />}>
              <HomeScreen />
            </Suspense>
          </FeedErrorBoundary>
        </ProtectedRoute>
      } />
      
      <Route path="/videos" element={
        <ProtectedRoute>
          <SectionErrorBoundary sectionName="Videos">
            <Suspense fallback={<RouteLoadingFallback />}>
              <VideosScreen />
            </Suspense>
          </SectionErrorBoundary>
        </ProtectedRoute>
      } />
      
      {/* ========== MESSAGING ROUTES (Ultimate Professional) ========== */}
      {/* Option 1: Nested Routes for Better UX */}
      <Route path="/messages" element={
        <MessagingLayout>
          <ChatErrorBoundary>
            <Suspense fallback={<RouteLoadingFallback />}>
              <Outlet />
            </Suspense>
          </ChatErrorBoundary>
        </MessagingLayout>
      }>
        {/* Default view - conversation list */}
        <Route index element={
          <Suspense fallback={<RouteLoadingFallback />}>
            <MessagingScreen />
          </Suspense>
        } />
        
        {/* New conversation */}
        <Route path="new" element={
          <Suspense fallback={<RouteLoadingFallback />}>
            <NewConversationScreen />
          </Suspense>
        } />
        
        {/* Individual chat */}
        <Route path=":conversationId" element={
          <Suspense fallback={<RouteLoadingFallback />}>
            <ChatScreen />
          </Suspense>
        } />
        
        {/* Group info */}
        <Route path=":conversationId/info" element={
          <Suspense fallback={<RouteLoadingFallback />}>
            <GroupInfoScreen />
          </Suspense>
        } />
        
        {/* Conversation settings */}
        <Route path=":conversationId/settings" element={
          <Suspense fallback={<RouteLoadingFallback />}>
            <ConversationSettingsScreen />
          </Suspense>
        } />
      </Route>
      
      {/* Option 2: Separate Routes (Simple & Direct) */}
      {/* Uncomment if you prefer separate routes instead of nested */}
      {/*
      <Route path="/messages" element={
        <AdminRoute>
          <Suspense fallback={<RouteFallback />}>
            <MessagingScreen />
          </Suspense>
        </AdminRoute>
      } />
      
      <Route path="/messages/:conversationId" element={
        <AdminRoute>
          <Suspense fallback={<RouteFallback />}>
            <ChatScreen />
          </Suspense>
        </AdminRoute>
      } />
      */}
      
      {/* ========== SOCIAL & CONTENT ROUTES ========== */}
      <Route path="/post/:postId" element={
        <ProtectedRoute>
          <PostErrorBoundary>
            <Suspense fallback={<RouteLoadingFallback />}>
              <PostDetails />
            </Suspense>
          </PostErrorBoundary>
        </ProtectedRoute>
      } />

      <Route path="/create-post" element={
        <ProtectedRoute>
          <CreatorErrorBoundary>
            <Suspense fallback={<RouteLoadingFallback />}>
              <CreatePost />
            </Suspense>
          </CreatorErrorBoundary>
        </ProtectedRoute>
      } />
      <Route path="/create" element={<Navigate to="/create-post" replace />} />
      <Route path="/create_post" element={<Navigate to="/create-post" replace />} />
      
      <Route path="/network" element={<Navigate to="/connections" replace />} />
      <Route path="/posts" element={<Navigate to="/home" replace />} />
      <Route path="/profile/:userId/posts" element={<RedirectProfilePosts />} />
      
      <Route path="/coins" element={
        <ProtectedRoute>
          <Suspense fallback={<RouteFallback />}>
            <CoinsScreen />
          </Suspense>
        </ProtectedRoute>
      } />
      
      <Route path="/subscription" element={
        <ProtectedRoute>
          <Suspense fallback={<RouteFallback />}>
            <SubscriptionScreen />
          </Suspense>
        </ProtectedRoute>
      } />
      
      <Route path="/notifications" element={
        <ProtectedRoute>
          <Suspense fallback={<RouteFallback />}>
            <NotificationsScreen />
          </Suspense>
        </ProtectedRoute>
      } />
      
      <Route path="/create-story" element={
        <ProtectedRoute>
          <Suspense fallback={<RouteFallback />}>
            <CreateStory />
          </Suspense>
        </ProtectedRoute>
      } />

      <Route path="/stories" element={
        <ProtectedRoute>
          <Suspense fallback={<RouteFallback />}>
            <StoriesScreen />
          </Suspense>
        </ProtectedRoute>
      } />
      {/* Legacy highlight links resolve to the stories viewer. */}
      <Route path="/highlight/:highlightId" element={
        <ProtectedRoute>
          <Suspense fallback={<RouteFallback />}>
            <StoriesScreen />
          </Suspense>
        </ProtectedRoute>
      } />

      <Route path="/vibes" element={
        <ProtectedRoute>
          <Suspense fallback={<RouteFallback />}>
            <StoriesScreen />
          </Suspense>
        </ProtectedRoute>
      } />
      
      {/* ========== PROFILE ROUTES ========== */}
      {/* Main profile screen - with userId param for viewing other profiles */}
      <Route path="/profile" element={
        <ProtectedRoute>
          <ProfileErrorBoundary>
            <Suspense fallback={<RouteLoadingFallback />}>
              <ProfileMyScreen />
            </Suspense>
          </ProfileErrorBoundary>
        </ProtectedRoute>
      } />
      
      {/* My profile (owner view) */}
      <Route path="/profile/me" element={
        <ProtectedRoute>
          <ProfileErrorBoundary>
            <Suspense fallback={<RouteLoadingFallback />}>
              <ProfileMyScreen />
            </Suspense>
          </ProfileErrorBoundary>
        </ProtectedRoute>
      } />
      
      {/* Public profile view (for other users) */}
      <Route path="/profile/public/:userId" element={
        <ProtectedRoute>
          <ProfileErrorBoundary>
            <Suspense fallback={<RouteLoadingFallback />}>
              <ProfilePublicScreen />
            </Suspense>
          </ProfileErrorBoundary>
        </ProtectedRoute>
      } />
      
      {/* Profile with specific user ID */}
      <Route path="/profile/:userId" element={
        <ProtectedRoute>
          <ProfileErrorBoundary>
            <Suspense fallback={<RouteLoadingFallback />}>
              <ProfileScreen />
            </Suspense>
          </ProfileErrorBoundary>
        </ProtectedRoute>
      } />
      
      {/* Edit profile */}
      <Route path="/profile/edit" element={
        <ProtectedRoute>
          <Suspense fallback={<RouteFallback />}>
            <EditProfile />
          </Suspense>
        </ProtectedRoute>
      } />
      
      {/* Creator dashboard / analytics */}
      <Route path="/profile/analytics" element={
        <ProtectedRoute>
          <Suspense fallback={<RouteFallback />}>
            <CreatorDashboardScreen />
          </Suspense>
        </ProtectedRoute>
      } />
      
      {/* Highlights management */}
      <Route path="/profile/highlights" element={
        <ProtectedRoute>
          <Suspense fallback={<RouteFallback />}>
            <HighlightsScreen />
          </Suspense>
        </ProtectedRoute>
      } />
      
      {/* Followers list */}
      <Route path="/followers" element={
        <ProtectedRoute>
          <Suspense fallback={<RouteFallback />}>
            <FollowersScreen />
          </Suspense>
        </ProtectedRoute>
      } />
      <Route path="/profile/followers" element={
        <ProtectedRoute>
          <Suspense fallback={<RouteFallback />}>
            <FollowersScreen />
          </Suspense>
        </ProtectedRoute>
      } />
      <Route path="/profile/:userId/followers" element={
        <ProtectedRoute>
          <Suspense fallback={<RouteFallback />}>
            <FollowersScreen />
          </Suspense>
        </ProtectedRoute>
      } />
      
      {/* Following list */}
      <Route path="/following" element={
        <ProtectedRoute>
          <Suspense fallback={<RouteFallback />}>
            <FollowingScreen />
          </Suspense>
        </ProtectedRoute>
      } />
      <Route path="/profile/following" element={
        <ProtectedRoute>
          <Suspense fallback={<RouteFallback />}>
            <FollowingScreen />
          </Suspense>
        </ProtectedRoute>
      } />
      <Route path="/profile/:userId/following" element={
        <ProtectedRoute>
          <Suspense fallback={<RouteFallback />}>
            <FollowingScreen />
          </Suspense>
        </ProtectedRoute>
      } />
      
      {/* Friends list */}
      <Route path="/friends" element={
        <ProtectedRoute>
          <Suspense fallback={<RouteFallback />}>
            <FriendsScreen />
          </Suspense>
        </ProtectedRoute>
      } />
      <Route path="/profile/friends" element={
        <ProtectedRoute>
          <Suspense fallback={<RouteFallback />}>
            <FriendsScreen />
          </Suspense>
        </ProtectedRoute>
      } />
      <Route path="/profile/:userId/friends" element={
        <ProtectedRoute>
          <Suspense fallback={<RouteFallback />}>
            <FriendsScreen />
          </Suspense>
        </ProtectedRoute>
      } />
      
      {/* Unified Connections Screen */}
      <Route path="/connections" element={
        <ProtectedRoute>
          <Suspense fallback={<RouteFallback />}>
            <ConnectionsScreen />
          </Suspense>
        </ProtectedRoute>
      } />
      <Route path="/profile/connections" element={
        <ProtectedRoute>
          <Suspense fallback={<RouteFallback />}>
            <ConnectionsScreen />
          </Suspense>
        </ProtectedRoute>
      } />
      <Route path="/profile/:userId/connections" element={
        <ProtectedRoute>
          <Suspense fallback={<RouteFallback />}>
            <ConnectionsScreen />
          </Suspense>
        </ProtectedRoute>
      } />
      
      {/* About / profile info */}
      <Route path="/profile/about" element={
        <ProtectedRoute>
          <Suspense fallback={<RouteFallback />}>
            <AboutScreen />
          </Suspense>
        </ProtectedRoute>
      } />
      <Route path="/profile/:userId/about" element={
        <ProtectedRoute>
          <Suspense fallback={<RouteFallback />}>
            <AboutScreen />
          </Suspense>
        </ProtectedRoute>
      } />
      
      {/* Profile preview */}
      <Route path="/profile/preview" element={
        <ProtectedRoute>
          <Suspense fallback={<RouteFallback />}>
            <ProfilePreviewScreen />
          </Suspense>
        </ProtectedRoute>
      } />
      
      {/* Profile settings - canonical settings live at /settings */}
      <Route path="/profile/settings" element={<Navigate to="/settings" replace />} />
      
      {/* ========== SETTINGS & UTILITY ROUTES ========== */}
      <Route path="/settings" element={
        <ProtectedRoute>
          <Suspense fallback={<RouteFallback />}>
            <SettingsScreen />
          </Suspense>
        </ProtectedRoute>
      } />
      
      <Route path="/settings/data-usage" element={
        <ProtectedRoute>
          <Suspense fallback={<RouteFallback />}>
            <DataUsageScreen />
          </Suspense>
        </ProtectedRoute>
      } />

      <Route path="/settings/blocked" element={
        <ProtectedRoute>
          <Suspense fallback={<RouteFallback />}>
            <BlockedAccountsScreen />
          </Suspense>
        </ProtectedRoute>
      } />
      
      <Route path="/search" element={
        <ProtectedRoute>
          <Suspense fallback={<RouteFallback />}>
            <SearchScreen />
          </Suspense>
        </ProtectedRoute>
      } />
      
      <Route path="/saved" element={
        <ProtectedRoute>
          <Suspense fallback={<RouteFallback />}>
            <SavedScreen />
          </Suspense>
        </ProtectedRoute>
      } />
      
      <Route path="/collections" element={
        <ProtectedRoute>
          <Suspense fallback={<RouteFallback />}>
            <CollectionsScreen />
          </Suspense>
        </ProtectedRoute>
      } />
      
      <Route path="/live" element={
        <ProtectedRoute>
          <Suspense fallback={<RouteFallback />}>
            <LiveScreen />
          </Suspense>
        </ProtectedRoute>
      } />

      {/* Reels (full-screen vertical video) */}
      <Route path="/reels" element={
        <ProtectedRoute>
          <Suspense fallback={<RouteFallback />}>
            <ReelsScreen />
          </Suspense>
        </ProtectedRoute>
      } />

      {/* Group invite link landing (`/join-group?invite=<id>`). Public-ish: it
          renders a sign-in prompt when logged out and joins via the
          joinGroupViaInvite callable when signed in. */}
      <Route path="/join-group" element={
        <Suspense fallback={<PublicRouteFallback />}>
          <JoinGroupScreen />
        </Suspense>
      } />

      {/* Spark / Video detail (canonical /sparks/:videoId + legacy /video/:videoId) */}
      <Route path="/sparks/:videoId" element={
        <ProtectedRoute>
          <SectionErrorBoundary sectionName="SparkDetail">
            <Suspense fallback={<RouteFallback />}>
              <VideoDetailScreen />
            </Suspense>
          </SectionErrorBoundary>
        </ProtectedRoute>
      } />
      <Route path="/video/:videoId" element={
        <ProtectedRoute>
          <Suspense fallback={<RouteFallback />}>
            <VideoDetailScreen />
          </Suspense>
        </ProtectedRoute>
      } />

      {/* Call + Gift (from messaging) */}
      <Route path="/call/:conversationId" element={
        <ProtectedRoute>
          <Suspense fallback={<RouteFallback />}>
            <CallScreen />
          </Suspense>
        </ProtectedRoute>
      } />
      <Route path="/gift/:userId" element={
        <ProtectedRoute>
          <Suspense fallback={<RouteFallback />}>
            <GiftScreen />
          </Suspense>
        </ProtectedRoute>
      } />

      {/* Edit post (from PostOptionsDrawer) */}
      <Route path="/edit/:postId" element={
        <ProtectedRoute>
          <Suspense fallback={<RouteFallback />}>
            <CreatePost />
          </Suspense>
        </ProtectedRoute>
      } />

      {/* Video Analytics */}
      <Route path="/post/:postId/analytics" element={
        <ProtectedRoute>
          <Suspense fallback={<RouteFallback />}>
            <PostAnalyticsScreen />
          </Suspense>
        </ProtectedRoute>
      } />

      <Route path="/video-analytics" element={
        <ProtectedRoute>
          <Suspense fallback={<RouteFallback />}>
            <VideoAnalyticsScreen />
          </Suspense>
        </ProtectedRoute>
      } />

      {/* ========== COMMUNITY ROUTES ========== */}
      <Route path="/community" element={
        <ProtectedRoute>
          <Suspense fallback={<RouteFallback />}>
            <CommunityDirectoryScreen />
          </Suspense>
        </ProtectedRoute>
      } />

      <Route path="/community/create" element={
        <ProtectedRoute>
          <Suspense fallback={<RouteFallback />}>
            <CreateCommunityScreen />
          </Suspense>
        </ProtectedRoute>
      } />

      <Route path="/community/:communityId" element={
        <ProtectedRoute>
          <Suspense fallback={<RouteFallback />}>
            <CommunityDetailScreen />
          </Suspense>
        </ProtectedRoute>
      } />

      <Route path="/community/:communityId/settings" element={
        <ProtectedRoute>
          <Suspense fallback={<RouteFallback />}>
            <CommunitySettingsScreen />
          </Suspense>
        </ProtectedRoute>
      } />

      {/* ========== EVENT ROUTES ========== */}
      <Route path="/event" element={
        <ProtectedRoute>
          <Suspense fallback={<RouteFallback />}>
            <EventDiscoveryScreen />
          </Suspense>
        </ProtectedRoute>
      } />

      <Route path="/event/create" element={
        <ProtectedRoute>
          <Suspense fallback={<RouteFallback />}>
            <CreateEventScreen />
          </Suspense>
        </ProtectedRoute>
      } />

      <Route path="/event/:eventId" element={
        <ProtectedRoute>
          <Suspense fallback={<RouteFallback />}>
            <EventDetailScreen />
          </Suspense>
        </ProtectedRoute>
      } />

      <Route path="/event/:eventId/edit" element={
        <ProtectedRoute>
          <Suspense fallback={<RouteFallback />}>
            <CreateEventScreen />
          </Suspense>
        </ProtectedRoute>
      } />

      {/* ========== ADMIN ROUTES ========== */}
      {/* FIXED: Use AdminRoute instead of ProtectedRoute to enforce server-verified admin role */}
      <Route path="/admin" element={
        <AdminRoute>
          <Suspense fallback={<RouteFallback />}>
            <AdminDashboardScreen />
          </Suspense>
        </AdminRoute>
      } />

      <Route path="/admin/users" element={
        <AdminRoute>
          <Suspense fallback={<RouteFallback />}>
            <AdminUserManagementScreen />
          </Suspense>
        </AdminRoute>
      } />

      <Route path="/admin/content" element={
        <AdminRoute>
          <Suspense fallback={<RouteFallback />}>
            <AdminContentManagementScreen />
          </Suspense>
        </AdminRoute>
      } />

      <Route path="/admin/moderation" element={
        <AdminRoute>
          <Suspense fallback={<RouteFallback />}>
            <AdminModerationQueueScreen />
          </Suspense>
        </AdminRoute>
      } />

      <Route path="/admin/economy" element={
        <AdminRoute>
          <Suspense fallback={<RouteFallback />}>
            <AdminEconomyScreen />
          </Suspense>
        </AdminRoute>
      } />

      <Route path="/admin/verification" element={
        <AdminRoute>
          <Suspense fallback={<RouteFallback />}>
            <AdminVerificationScreen />
          </Suspense>
        </AdminRoute>
      } />

      <Route path="/admin/flags" element={
        <AdminRoute>
          <Suspense fallback={<RouteFallback />}>
            <AdminFeatureFlagsScreen />
          </Suspense>
        </AdminRoute>
      } />

      <Route path="/admin/health" element={
        <AdminRoute>
          <Suspense fallback={<RouteFallback />}>
            <AdminSystemHealthScreen />
          </Suspense>
        </AdminRoute>
      } />

      <Route path="/admin/audit-logs" element={
        <AdminRoute>
          <Suspense fallback={<RouteFallback />}>
            <AdminAuditLogsScreen />
          </Suspense>
        </AdminRoute>
      } />

      <Route path="/admin/tickets" element={
        <AdminRoute>
          <Suspense fallback={<RouteFallback />}>
            <AdminSupportTicketsScreen />
          </Suspense>
        </AdminRoute>
      } />

      <Route path="/admin/communities" element={
        <AdminRoute>
          <Suspense fallback={<RouteFallback />}>
            <AdminCommunityManagementScreen />
          </Suspense>
        </AdminRoute>
      } />

      {/* Admin access management. Deliberately authenticated-only (not
          AdminRoute) because this is where the platform owner claims the very
          first admin grant; the Cloud Function enforces who may actually do
          it. */}
      <Route path="/admin/access" element={
        <ProtectedRoute>
          <Suspense fallback={<RouteFallback />}>
            <AdminAccessScreen />
          </Suspense>
        </ProtectedRoute>
      } />

      {/* Video & Audio Editor Routes */}
      <Route path="/editor" element={<Navigate to="/video-editor" replace />} />
      <Route path="/video-editor" element={
        <ProtectedRoute>
          <Suspense fallback={<RouteFallback />}>
            <VideoEditorScreen />
          </Suspense>
        </ProtectedRoute>
      } />

      {/* Audio Editor Route */}
      <Route path="/audio-editor" element={
        <ProtectedRoute>
          <Suspense fallback={<RouteFallback />}>
            <AudioEditorScreen />
          </Suspense>
        </ProtectedRoute>
      } />

      {/* Thumbnail Designer route */}
      <Route path="/thumbnail-designer" element={
        <ProtectedRoute>
          <Suspense fallback={<RouteFallback />}>
            <ThumbnailDesignerScreen />
          </Suspense>
        </ProtectedRoute>
      } />

      {/* Rankings Routes */}
      <Route path="/rankings" element={
        <ProtectedRoute>
          <Suspense fallback={<RouteFallback />}>
            <RankingsScreen />
          </Suspense>
        </ProtectedRoute>
      } />

      <Route path="/badges" element={
        <ProtectedRoute>
          <Suspense fallback={<RouteFallback />}>
            <AchievementsScreen />
          </Suspense>
        </ProtectedRoute>
      } />

      {/* Part 2: Progression & Level Detail */}
      <Route path="/progress" element={
        <ProtectedRoute>
          <Suspense fallback={<RouteFallback />}>
            <ProgressScreen />
          </Suspense>
        </ProtectedRoute>
      } />
      <Route path="/profile/progress" element={<Navigate to="/progress" replace />} />

      {/* Level, Citizenship & Royal Family Roadmap */}
      <Route path="/levels" element={
        <ProtectedRoute>
          <Suspense fallback={<RouteFallback />}>
            <LevelRoadmapScreen />
          </Suspense>
        </ProtectedRoute>
      } />
      <Route path="/profile/levels" element={
        <ProtectedRoute>
          <Suspense fallback={<RouteFallback />}>
            <LevelRoadmapScreen />
          </Suspense>
        </ProtectedRoute>
      } />
      <Route path="/roadmap" element={<Navigate to="/levels" replace />} />

      {/* Part 2: Perks & Rewards Suite */}
      <Route path="/perks" element={
        <ProtectedRoute>
          <Suspense fallback={<RouteFallback />}>
            <PerksRewardsScreen />
          </Suspense>
        </ProtectedRoute>
      } />
      <Route path="/rewards" element={<Navigate to="/perks" replace />} />
      <Route path="/profile/perks" element={<Navigate to="/perks" replace />} />
      <Route path="/profile/rewards" element={<Navigate to="/perks" replace />} />

      {/* Part 2: Achievements Gallery */}
      <Route path="/achievements" element={
        <ProtectedRoute>
          <Suspense fallback={<RouteFallback />}>
            <AchievementsScreen />
          </Suspense>
        </ProtectedRoute>
      } />
      <Route path="/profile/achievements" element={<Navigate to="/achievements" replace />} />

      {/* Part 2: Titles & Civic Provenance */}
      <Route path="/titles" element={
        <ProtectedRoute>
          <Suspense fallback={<RouteFallback />}>
            <TitlesScreen />
          </Suspense>
        </ProtectedRoute>
      } />
      <Route path="/profile/titles" element={<Navigate to="/titles" replace />} />

      {/* Part 2: Arvdoul Digital Passport & Citizenship */}
      <Route path="/passport" element={
        <ProtectedRoute>
          <Suspense fallback={<RouteFallback />}>
            <PassportScreen />
          </Suspense>
        </ProtectedRoute>
      } />
      <Route path="/passport/:userId" element={
        <ProtectedRoute>
          <Suspense fallback={<RouteFallback />}>
            <PassportScreen />
          </Suspense>
        </ProtectedRoute>
      } />
      <Route path="/profile/passport" element={<Navigate to="/passport" replace />} />
      <Route path="/citizen" element={<Navigate to="/passport" replace />} />
      <Route path="/citizenship" element={<Navigate to="/passport" replace />} />
      <Route path="/citizen/:userId" element={
        <ProtectedRoute>
          <Suspense fallback={<RouteFallback />}>
            <PassportScreen />
          </Suspense>
        </ProtectedRoute>
      } />
      <Route path="/citizenship/:userId" element={
        <ProtectedRoute>
          <Suspense fallback={<RouteFallback />}>
            <PassportScreen />
          </Suspense>
        </ProtectedRoute>
      } />

      {/* Part 2: Creator Workspace & Onboarding */}
      <Route path="/creator/onboarding" element={
        <ProtectedRoute>
          <Suspense fallback={<RouteFallback />}>
            <CreatorOnboardingScreen />
          </Suspense>
        </ProtectedRoute>
      } />
      <Route path="/creator/dashboard" element={
        <ProtectedRoute>
          <Suspense fallback={<RouteFallback />}>
            <CreatorDashboardScreen />
          </Suspense>
        </ProtectedRoute>
      } />

      {/* Part 2: Sovereign Wallet & Economic Ledger */}
      <Route path="/wallet" element={
        <ProtectedRoute>
          <Suspense fallback={<RouteFallback />}>
            <WalletScreen />
          </Suspense>
        </ProtectedRoute>
      } />
      <Route path="/profile/wallet" element={<Navigate to="/wallet" replace />} />

      <Route path="/reputation" element={
        <ProtectedRoute>
          <Suspense fallback={<RouteFallback />}>
            <ReputationScreen />
          </Suspense>
        </ProtectedRoute>
      } />
      <Route path="/reputation/:userId" element={
        <ProtectedRoute>
          <Suspense fallback={<RouteFallback />}>
            <ReputationScreen />
          </Suspense>
        </ProtectedRoute>
      } />

      {/* Collaboration Routes */}
      <Route path="/collaboration" element={
        <ProtectedRoute>
          <Suspense fallback={<RouteFallback />}>
            <ProjectDashboardScreen />
          </Suspense>
        </ProtectedRoute>
      } />

      <Route path="/collaboration/:projectId" element={
        <ProtectedRoute>
          <Suspense fallback={<RouteFallback />}>
            <ProjectDetailScreen />
          </Suspense>
        </ProtectedRoute>
      } />

      {/* Advertising Center Routes */}
      <Route path="/ads" element={
        <ProtectedRoute>
          <Suspense fallback={<RouteFallback />}>
            <AdvertisingDashboardScreen />
          </Suspense>
        </ProtectedRoute>
      } />
      <Route path="/ads/campaigns" element={
        <ProtectedRoute>
          <Suspense fallback={<RouteFallback />}>
            <AdvertisingDashboardScreen />
          </Suspense>
        </ProtectedRoute>
      } />
      <Route path="/ads/create" element={
        <ProtectedRoute>
          <Suspense fallback={<RouteFallback />}>
            <CampaignBuilderScreen />
          </Suspense>
        </ProtectedRoute>
      } />
      <Route path="/ads/billing" element={
        <ProtectedRoute>
          <Suspense fallback={<RouteFallback />}>
            <AdBillingScreen />
          </Suspense>
        </ProtectedRoute>
      } />
      <Route path="/ads/analytics" element={
        <ProtectedRoute>
          <Suspense fallback={<RouteFallback />}>
            <AdAnalyticsScreen />
          </Suspense>
        </ProtectedRoute>
      } />
      <Route path="/ads/review" element={
        <AdminRoute>
          <Suspense fallback={<RouteFallback />}>
            <AdReviewQueueScreen />
          </Suspense>
        </AdminRoute>
      } />

      {/* Menu Route */}
      <Route path="/menu" element={
        <ProtectedRoute>
          <Suspense fallback={<RouteFallback />}>
            <MenuScreen />
          </Suspense>
        </ProtectedRoute>
      } />
      
      {/* Offline Status Screen */}
      <Route path="/offline" element={
        <Suspense fallback={<RouteFallback />}>
          <OfflineStatusScreen />
        </Suspense>
      } />

      {/* Sync Conflict Resolution */}
      <Route path="/conflicts" element={
        <ProtectedRoute>
          <Suspense fallback={<RouteFallback />}>
            <ConflictResolutionScreen />
          </Suspense>
        </ProtectedRoute>
      } />
      <Route path="/sync-conflicts" element={<Navigate to="/conflicts" replace />} />

      {/* Help Center & Support */}
      <Route path="/help" element={
        <Suspense fallback={<RouteFallback />}>
          <HelpCenterScreen />
        </Suspense>
      } />

      {/* Creator Payouts */}
      <Route path="/creator-payout" element={
        <ProtectedRoute>
          <Suspense fallback={<RouteFallback />}>
            <CreatorPayoutScreen />
          </Suspense>
        </ProtectedRoute>
      } />
      <Route path="/payouts" element={<Navigate to="/creator-payout" replace />} />

      {/* ========== ARVDOUL ADVANCED SUITE ROUTES ========== */}
      {/* 1. AI Creative Studio */}
      <Route path="/ai-studio" element={
        <ProtectedRoute>
          <FeatureGate flag="ai.studio">
            <Suspense fallback={<RouteFallback />}>
              <AIStudioScreen />
            </Suspense>
          </FeatureGate>
        </ProtectedRoute>
      } />
      <Route path="/ai" element={<Navigate to="/ai-studio" replace />} />

      {/* 2. Live Audio Spaces */}
      <Route path="/spaces" element={
        <ProtectedRoute>
          <Suspense fallback={<RouteFallback />}>
            <SpacesScreen />
          </Suspense>
        </ProtectedRoute>
      } />
      <Route path="/voice" element={<Navigate to="/spaces" replace />} />
      <Route path="/audio-spaces" element={<Navigate to="/spaces" replace />} />

      {/* 3. Sounds & Music Discovery */}
      <Route path="/sounds" element={
        <ProtectedRoute>
          <Suspense fallback={<RouteFallback />}>
            <SoundsScreen />
          </Suspense>
        </ProtectedRoute>
      } />
      <Route path="/music" element={<Navigate to="/sounds" replace />} />
      <Route path="/audio-library" element={<Navigate to="/sounds" replace />} />

      {/* 4. Creator Marketplace & Digital Goods */}
      <Route path="/marketplace" element={
        <ProtectedRoute>
          <Suspense fallback={<RouteFallback />}>
            <MarketplaceScreen />
          </Suspense>
        </ProtectedRoute>
      } />
      <Route path="/store" element={<Navigate to="/marketplace" replace />} />
      <Route path="/shop" element={<Navigate to="/marketplace" replace />} />

      {/* 5. Community Polls */}
      <Route path="/polls" element={
        <ProtectedRoute>
          <Suspense fallback={<RouteFallback />}>
            <PollsScreen />
          </Suspense>
        </ProtectedRoute>
      } />
      <Route path="/predictions" element={<Navigate to="/polls" replace />} />
      <Route path="/vote" element={<Navigate to="/polls" replace />} />

      {/* ========== ONBOARDING ROUTES ========== */}
      <Route path="/setup-profile" element={
        <PublicRoute>
          <Suspense fallback={<RouteFallback />}>
            <SetupProfile />
          </Suspense>
        </PublicRoute>
      } />
      
      {/* ========== REDIRECTS ========== */}
      <Route path="/onboarding" element={<Navigate to="/setup-profile" replace />} />
      <Route path="/signup" element={<Navigate to="/signup/step1" replace />} />
      <Route path="/message" element={<Navigate to="/messages" replace />} />
      <Route path="/chat" element={<Navigate to="/messages" replace />} />
      <Route path="/chat/:conversationId" element={<RedirectChatToMessages />} />
      <Route path="/inbox" element={<Navigate to="/messages" replace />} />
      <Route path="/dm" element={<Navigate to="/messages" replace />} />
      <Route path="/requests" element={<Navigate to="/messages" replace />} />
      <Route path="/sparks" element={
        <ProtectedRoute>
          <SectionErrorBoundary sectionName="Sparks">
            <Suspense fallback={<RouteLoadingFallback />}>
              <VideosScreen />
            </Suspense>
          </SectionErrorBoundary>
        </ProtectedRoute>
      } />
      {/* Legacy / dead-link targets now resolve to real destinations */}
      <Route path="/challenges" element={<Navigate to="/rankings" replace />} />
      <Route path="/change-password" element={<Navigate to="/settings" replace />} />
      <Route path="/create-highlight" element={<Navigate to="/profile/highlights" replace />} />
      <Route path="/explore" element={<Navigate to="/search" replace />} />
      <Route path="/discover" element={<Navigate to="/search" replace />} />
      <Route path="/trending" element={<Navigate to="/home" replace />} />
      <Route path="/email-verification" element={<Navigate to="/verify-email" replace />} />
      <Route path="/analytics" element={<Navigate to="/profile/analytics" replace />} />
      <Route path="/auth" element={<Navigate to="/login" replace />} />
      
      {/* ========== ERROR & CATCH-ALL ========== */}
      <Route path="/404" element={
        <ProtectedRoute>
          <Suspense fallback={<RouteFallback />}>
            <NotFoundScreen />
          </Suspense>
        </ProtectedRoute>
      } />
      
      {/* Catch-all redirect */}
      <Route path="*" element={
        <Suspense fallback={<RouteFallback />}>
          <NotFoundScreen />
        </Suspense>
      } />
    </Routes>
  );
}
