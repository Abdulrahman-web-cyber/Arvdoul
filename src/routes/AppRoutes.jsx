// src/routes/AppRoutes.jsx - ULTIMATE PRODUCTION VERSION FIXED V2
// 🏆 PERFECT ROUTING • COMPLETE MESSAGING • PRODUCTION READY
import React, { lazy, Suspense, useState, useEffect } from "react";
import { Routes, Route, Navigate, Outlet } from "react-router-dom";
import AppStateGuard from "../app/AppStateGuard.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import MainLayout from "../layouts/MainLayout.jsx";
import LoadingSpinner from "../components/Shared/LoadingSpinner.jsx";

// ==================== LAZY LOAD COMPONENTS ====================
const SplashScreen = lazy(() => import("../screens/SplashScreen.jsx"));
const IntroScreen = lazy(() => import("../screens/IntroScreen.jsx"));
const SubscriptionScreen = lazy(() => import("../screens/SubscriptionScreen.jsx"));
const BadgeScreen = lazy(() => import("../screens/BadgeScreen.jsx"));
const DataUsageScreen = lazy(() => import("../screens/DataUsageScreen.jsx"));
const ProjectDashboardScreen = lazy(() => import("../screens/Collaboration/ProjectDashboardScreen.jsx"));
const ProjectDetailScreen = lazy(() => import("../screens/Collaboration/ProjectDetailScreen.jsx"));
const LoginScreen = lazy(() => import("../screens/LoginScreen.jsx"));
const SignupStep1Personal = lazy(() => import("../screens/SignupStep1Personal.jsx"));
const SignupStep2VerifyContact = lazy(() => import("../screens/SignupStep2VerifyContact.jsx"));
const OtpVerification = lazy(() => import("../screens/OtpVerification.jsx"));
const VerifyEmailScreen = lazy(() => import("../screens/VerifyEmailScreen.jsx"));
const ForgotPasswordScreen = lazy(() => import("../screens/ForgotPassword.jsx"));
const ResetPasswordScreen = lazy(() => import("../screens/ResetPassword.jsx"));
const SetupProfile = lazy(() => import("../screens/SetupProfile.jsx"));
const HomeScreen = lazy(() => import("../screens/HomeScreen.jsx"));
const VideosScreen = lazy(() => import("../screens/VideosScreen.jsx"));
const MessagingScreen = lazy(() => import("../screens/MessagingScreen.jsx"));
const ChatScreen = lazy(() => import("../screens/ChatScreen.jsx"));
const NewConversationScreen = lazy(() => import("../screens/NewConversationScreen.jsx"));
const GroupInfoScreen = lazy(() => import("../screens/GroupInfoScreen.jsx"));
const ConversationSettingsScreen = lazy(() => import("../screens/ConversationSettingsScreen.jsx"));
const CreatePost = lazy(() => import("../screens/CreatePost.jsx"));
const NetworkScreen = lazy(() => import("../screens/NetworkScreen.jsx"));
const CoinsScreen = lazy(() => import("../screens/CoinsScreen.jsx"));
const NotificationsScreen = lazy(() => import("../screens/NotificationsScreen.jsx"));
const CreateStory = lazy(() => import("../screens/CreateStory.jsx"));
const StoriesScreen = lazy(() => import("../screens/StoriesScreen.jsx"));
// Profile screens - using new Profile directory
const ProfileScreen = lazy(() => import("../screens/Profile/ProfileScreen.jsx"));
const ProfilePublicScreen = lazy(() => import("../screens/Profile/ProfilePublicScreen.jsx"));
const ProfileMyScreen = lazy(() => import("../screens/Profile/ProfileMyScreen.jsx"));
const EditProfile = lazy(() => import("../screens/Profile/EditProfileScreen.jsx"));
const CreatorDashboardScreen = lazy(() => import("../screens/Profile/CreatorDashboardScreen.jsx"));
const FollowersScreen = lazy(() => import("../screens/Profile/FollowersScreen.jsx"));
const FollowingScreen = lazy(() => import("../screens/Profile/FollowingScreen.jsx"));
const FriendsScreen = lazy(() => import("../screens/Profile/FriendsScreen.jsx"));
const HighlightsScreen = lazy(() => import("../screens/Profile/HighlightsScreen.jsx"));
const AboutScreen = lazy(() => import("../screens/Profile/AboutScreen.jsx"));
const ProfileSettingsScreen = lazy(() => import("../screens/Profile/ProfileSettingsScreen.jsx"));
// Legacy screens
const PostDetails = lazy(() => import("../screens/PostDetails.jsx"));
const SettingsScreen = lazy(() => import("../screens/SettingsScreen.jsx"));
const SearchScreen = lazy(() => import("../screens/SearchScreen.jsx"));
const SavedScreen = lazy(() => import("../screens/SavedScreen.jsx"));
const CollectionsScreen = lazy(() => import("../screens/CollectionsScreen.jsx"));
const LiveScreen = lazy(() => import("../screens/LiveScreen.jsx"));
// Video Analytics Screen
const VideoAnalyticsScreen = lazy(() => import("../screens/VideoAnalyticsScreen.jsx"));
const ReelsScreen = lazy(() => import("../screens/ReelsScreen.jsx"));
const VideoDetailScreen = lazy(() => import("../screens/VideoDetailScreen.jsx"));
const CallScreen = lazy(() => import("../screens/CallScreen.jsx"));
const GiftScreen = lazy(() => import("../screens/GiftScreen.jsx"));

// Community Screens
const CommunityDirectoryScreen = lazy(() => import("../screens/Community/CommunityDirectoryScreen.jsx"));
const CreateCommunityScreen = lazy(() => import("../screens/Community/CreateCommunityScreen.jsx"));
const CommunityDetailScreen = lazy(() => import("../screens/Community/CommunityDetailScreen.jsx"));
const CommunitySettingsScreen = lazy(() => import("../screens/Community/CommunitySettingsScreen.jsx"));

// Event Screens
const EventDiscoveryScreen = lazy(() => import("../screens/Event/EventDiscoveryScreen.jsx"));
const CreateEventScreen = lazy(() => import("../screens/Event/CreateEventScreen.jsx"));
const EventDetailScreen = lazy(() => import("../screens/Event/EventDetailScreen.jsx"));

// Admin Screens
const AdminDashboardScreen = lazy(() => import("../screens/Admin/AdminDashboardScreen.jsx"));
const AdminUserManagementScreen = lazy(() => import("../screens/Admin/AdminUserManagementScreen.jsx"));
const AdminContentManagementScreen = lazy(() => import("../screens/Admin/AdminContentManagementScreen.jsx"));
const AdminModerationQueueScreen = lazy(() => import("../screens/Admin/AdminModerationQueueScreen.jsx"));

// Video Editor Screen
const VideoEditorScreen = lazy(() => import("../screens/VideoEditor/VideoEditorScreen.jsx"));

// Audio Editor Screen
const AudioEditorScreen = lazy(() => import("../screens/AudioEditor/AudioEditorScreen.jsx"));

// Thumbnail Designer Screen
const ThumbnailDesignerScreen = lazy(() => import("../screens/ThumbnailDesigner/ThumbnailDesignerScreen.jsx"));

// Rankings Screen
const RankingsScreen = lazy(() => import("../screens/Rankings/RankingsScreen.jsx"));
const ReputationScreen = lazy(() => import("../screens/Rankings/ReputationScreen.jsx"));

// Collaboration Screen
const CollaborationScreen = lazy(() => import("../screens/Collaboration/CollaborationScreen.jsx"));

// Menu Screen
const MenuScreen = lazy(() => import("../screens/Menu/MenuScreen.jsx"));
const OfflineStatusScreen = lazy(() => import("../screens/OfflineStatusScreen.jsx"));
const ConflictResolutionScreen = lazy(() => import("../screens/ConflictResolutionScreen.jsx"));
const CreatorPayoutScreen = lazy(() => import("../screens/CreatorPayoutScreen.jsx"));

// ARVDOUL ADVANCED SUITE SCREENS
const AIStudioScreen = lazy(() => import("../screens/AIStudio/AIStudioScreen.jsx"));
const SpacesScreen = lazy(() => import("../screens/Spaces/SpacesScreen.jsx"));
const SoundsScreen = lazy(() => import("../screens/Sounds/SoundsScreen.jsx"));
const MarketplaceScreen = lazy(() => import("../screens/Marketplace/MarketplaceScreen.jsx"));
const PollsScreen = lazy(() => import("../screens/Polls/PollsScreen.jsx"));
const NotFoundScreen = lazy(() => import("../screens/NotFoundScreen.jsx"));

import PageLoader from "../components/UI/PageLoader.jsx";
import {
  SectionErrorBoundary,
  FeedErrorBoundary,
  ProfileErrorBoundary,
  ChatErrorBoundary,
  CreatorErrorBoundary,
  PostErrorBoundary,
} from "../components/ErrorBoundary/SectionErrorBoundary.jsx";
// Lightweight clean route loading fallback (screens handle their own inner skeletons)
const RouteLoadingFallback = () => (
  <div className="min-h-[60vh] w-full flex items-center justify-center p-8">
    <LoadingSpinner size="lg" color="purple" />
  </div>
);

// ==================== ROUTE WRAPPERS ====================
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

// ==================== MESSAGING LAYOUT WRAPPER ====================
// Special layout for messaging that handles both list and chat views
const MessagingLayout = ({ children }) => {
  return (
    <AppStateGuard>
      <MainLayout>{children}</MainLayout>
    </AppStateGuard>
  );
};

// ==================== ADMIN ROUTE (server-verified gate) ====================
// Any signed-in user reaching /admin is checked against the `admins`
// collection (mirrors the server-side isAdmin() used by Cloud Functions).
const AdminRoute = ({ children }) => {
  const { user } = useAuth();
  const [allowed, setAllowed] = useState(null);

  useEffect(() => {
    let mounted = true;
    const check = async () => {
      if (!user?.uid) { if (mounted) setAllowed(false); return; }
      try {
        const { doc, getDoc } = await import('firebase/firestore');
        const { getFirestoreInstance } = await import('../firebase/firebase.js');
        const firestore = await getFirestoreInstance();
        const snap = await getDoc(doc(firestore, 'admins', user.uid));
        if (mounted) setAllowed(snap.exists());
      } catch (err) {
        if (mounted) setAllowed(false);
      }
    };
    check();
    return () => { mounted = false; };
  }, [user?.uid]);

  if (allowed === null) {
    return <div className="min-h-screen flex items-center justify-center"><div className="w-10 h-10 border-4 border-violet-500 border-t-transparent rounded-full animate-spin" /></div>;
  }
  if (!allowed) return <Navigate to="/home" replace />;
  return <AppStateGuard><MainLayout>{children}</MainLayout></AppStateGuard>;
};

// ==================== MAIN APP ROUTES ====================
export default function AppRoutes() {
  return (
    <Routes>
      {/* ========== PUBLIC ROUTES (No Layout) ========== */}
      <Route path="/" element={
        <PublicRoute>
          <Suspense fallback={<RouteFallback />}>
            <SplashScreen />
          </Suspense>
        </PublicRoute>
      } />
      
      <Route path="/intro" element={
        <PublicRoute>
          <Suspense fallback={<RouteFallback />}>
            <IntroScreen />
          </Suspense>
        </PublicRoute>
      } />
      
      <Route path="/login" element={
        <PublicRoute>
          <Suspense fallback={<RouteFallback />}>
            <LoginScreen />
          </Suspense>
        </PublicRoute>
      } />
      
      <Route path="/signup/step1" element={
        <PublicRoute>
          <Suspense fallback={<RouteFallback />}>
            <SignupStep1Personal />
          </Suspense>
        </PublicRoute>
      } />
      
      <Route path="/signup/step2" element={
        <PublicRoute>
          <Suspense fallback={<RouteFallback />}>
            <SignupStep2VerifyContact />
          </Suspense>
        </PublicRoute>
      } />
      
      <Route path="/otp-verification" element={
        <PublicRoute>
          <Suspense fallback={<RouteFallback />}>
            <OtpVerification />
          </Suspense>
        </PublicRoute>
      } />
      
      <Route path="/verify-email" element={
        <PublicRoute>
          <Suspense fallback={<RouteFallback />}>
            <VerifyEmailScreen />
          </Suspense>
        </PublicRoute>
      } />
      
      <Route path="/forgot-password" element={
        <PublicRoute>
          <Suspense fallback={<RouteFallback />}>
            <ForgotPasswordScreen />
          </Suspense>
        </PublicRoute>
      } />
      
      <Route path="/reset-password" element={
        <PublicRoute>
          <Suspense fallback={<RouteFallback />}>
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
      
      <Route path="/network" element={
        <ProtectedRoute>
          <Suspense fallback={<RouteFallback />}>
            <NetworkScreen />
          </Suspense>
        </ProtectedRoute>
      } />
      
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
      <Route path="/profile/:userId/followers" element={
        <ProtectedRoute>
          <Suspense fallback={<RouteFallback />}>
            <FollowersScreen />
          </Suspense>
        </ProtectedRoute>
      } />
      
      {/* Following list */}
      <Route path="/profile/:userId/following" element={
        <ProtectedRoute>
          <Suspense fallback={<RouteFallback />}>
            <FollowingScreen />
          </Suspense>
        </ProtectedRoute>
      } />
      
      {/* Friends list */}
      <Route path="/profile/:userId/friends" element={
        <ProtectedRoute>
          <Suspense fallback={<RouteFallback />}>
            <FriendsScreen />
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
      
      {/* Profile settings */}
      <Route path="/profile/settings" element={
        <ProtectedRoute>
          <Suspense fallback={<RouteFallback />}>
            <ProfileSettingsScreen />
          </Suspense>
        </ProtectedRoute>
      } />
      
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

      {/* Video detail (deep links from search, notifications, shares) */}
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

      {/* Video Editor Route */}
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

      {/* Thumbnail Designer & Image Studio Routes */}
      <Route path="/thumbnail-designer" element={
        <ProtectedRoute>
          <Suspense fallback={<RouteFallback />}>
            <ThumbnailDesignerScreen />
          </Suspense>
        </ProtectedRoute>
      } />
      <Route path="/image-studio" element={
        <ProtectedRoute>
          <Suspense fallback={<RouteFallback />}>
            <ThumbnailDesignerScreen />
          </Suspense>
        </ProtectedRoute>
      } />
      <Route path="/image-editor" element={
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
            <BadgeScreen />
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
          <Suspense fallback={<RouteFallback />}>
            <AIStudioScreen />
          </Suspense>
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

      {/* 5. Community Polls & Prediction Markets */}
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
      <Route path="/signup" element={<Navigate to="/signup/step1" replace />} />
      <Route path="/message" element={<Navigate to="/messages" replace />} />
      <Route path="/chat" element={<Navigate to="/messages" replace />} />
      <Route path="/chat/:conversationId" element={<Navigate to="/messages/:conversationId" replace />} />
      <Route path="/inbox" element={<Navigate to="/messages" replace />} />
      <Route path="/dm" element={<Navigate to="/messages" replace />} />
      <Route path="/requests" element={<Navigate to="/messages" replace />} />
      <Route path="/sparks" element={<Navigate to="/reels" replace />} />
      {/* Legacy / dead-link targets now resolve to real destinations */}
      <Route path="/challenges" element={<Navigate to="/rankings" replace />} />
      <Route path="/change-password" element={<Navigate to="/settings" replace />} />
      <Route path="/create-highlight" element={<Navigate to="/profile/highlights" replace />} />
      <Route path="/explore" element={<Navigate to="/search" replace />} />
      <Route path="/discover" element={<Navigate to="/search" replace />} />
      <Route path="/trending" element={<Navigate to="/home" replace />} />
      <Route path="/email-verification" element={<Navigate to="/verify-email" replace />} />
      <Route path="/analytics" element={<Navigate to="/profile/analytics" replace />} />
      <Route path="/followers" element={<Navigate to="/network" replace />} />
      <Route path="/following" element={<Navigate to="/network" replace />} />
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
