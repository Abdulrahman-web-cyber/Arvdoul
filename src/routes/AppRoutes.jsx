// src/routes/AppRoutes.jsx - ULTIMATE PRODUCTION VERSION FIXED V2
// 🏆 PERFECT ROUTING • COMPLETE MESSAGING • PRODUCTION READY
import React, { lazy, Suspense } from "react";
import { Routes, Route, Navigate, Outlet } from "react-router-dom";
import AppStateGuard from "../app/AppStateGuard.jsx";
import MainLayout from "../layouts/MainLayout.jsx";

// ==================== LAZY LOAD COMPONENTS ====================
const SplashScreen = lazy(() => import("../screens/SplashScreen.jsx"));
const IntroScreen = lazy(() => import("../screens/IntroScreen.jsx"));
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
const SettingsScreen = lazy(() => import("../screens/SettingsScreen.jsx"));
const SearchScreen = lazy(() => import("../screens/SearchScreen.jsx"));
const SavedScreen = lazy(() => import("../screens/SavedScreen.jsx"));
const CollectionsScreen = lazy(() => import("../screens/CollectionsScreen.jsx"));
const LiveScreen = lazy(() => import("../screens/LiveScreen.jsx"));
// Video Analytics Screen
const VideoAnalyticsScreen = lazy(() => import("../screens/VideoAnalyticsScreen.jsx"));

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

// ==================== LOADING COMPONENT ====================
const RouteFallback = () => (
  <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-white dark:from-gray-900 dark:to-gray-950">
    <div className="text-center">
      <div className="w-16 h-16 border-4 border-blue-200 dark:border-blue-900 border-t-blue-600 dark:border-t-blue-500 rounded-full animate-spin mx-auto mb-4" />
      <p className="text-gray-600 dark:text-gray-400">Loading screen...</p>
    </div>
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
          <Suspense fallback={<RouteFallback />}>
            <HomeScreen />
          </Suspense>
        </ProtectedRoute>
      } />
      
      <Route path="/videos" element={
        <ProtectedRoute>
          <Suspense fallback={<RouteFallback />}>
            <VideosScreen />
          </Suspense>
        </ProtectedRoute>
      } />
      
      {/* ========== MESSAGING ROUTES (Ultimate Professional) ========== */}
      {/* Option 1: Nested Routes for Better UX */}
      <Route path="/messages" element={
        <MessagingLayout>
          <Suspense fallback={<RouteFallback />}>
            <Outlet />
          </Suspense>
        </MessagingLayout>
      }>
        {/* Default view - conversation list */}
        <Route index element={
          <Suspense fallback={<RouteFallback />}>
            <MessagingScreen />
          </Suspense>
        } />
        
        {/* New conversation */}
        <Route path="new" element={
          <Suspense fallback={<RouteFallback />}>
            <NewConversationScreen />
          </Suspense>
        } />
        
        {/* Individual chat */}
        <Route path=":conversationId" element={
          <Suspense fallback={<RouteFallback />}>
            <ChatScreen />
          </Suspense>
        } />
        
        {/* Group info */}
        <Route path=":conversationId/info" element={
          <Suspense fallback={<RouteFallback />}>
            <GroupInfoScreen />
          </Suspense>
        } />
        
        {/* Conversation settings */}
        <Route path=":conversationId/settings" element={
          <Suspense fallback={<RouteFallback />}>
            <ConversationSettingsScreen />
          </Suspense>
        } />
      </Route>
      
      {/* Option 2: Separate Routes (Simple & Direct) */}
      {/* Uncomment if you prefer separate routes instead of nested */}
      {/*
      <Route path="/messages" element={
        <ProtectedRoute>
          <Suspense fallback={<RouteFallback />}>
            <MessagingScreen />
          </Suspense>
        </ProtectedRoute>
      } />
      
      <Route path="/messages/:conversationId" element={
        <ProtectedRoute>
          <Suspense fallback={<RouteFallback />}>
            <ChatScreen />
          </Suspense>
        </ProtectedRoute>
      } />
      */}
      
      {/* ========== SOCIAL & CONTENT ROUTES ========== */}
      <Route path="/create-post" element={
        <ProtectedRoute>
          <Suspense fallback={<RouteFallback />}>
            <CreatePost />
          </Suspense>
        </ProtectedRoute>
      } />
      
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
      
      {/* ========== PROFILE ROUTES ========== */}
      {/* Main profile screen - with userId param for viewing other profiles */}
      <Route path="/profile" element={
        <ProtectedRoute>
          <Suspense fallback={<RouteFallback />}>
            <ProfileMyScreen />
          </Suspense>
        </ProtectedRoute>
      } />
      
      {/* My profile (owner view) */}
      <Route path="/profile/me" element={
        <ProtectedRoute>
          <Suspense fallback={<RouteFallback />}>
            <ProfileMyScreen />
          </Suspense>
        </ProtectedRoute>
      } />
      
      {/* Public profile view (for other users) */}
      <Route path="/profile/public/:userId" element={
        <ProtectedRoute>
          <Suspense fallback={<RouteFallback />}>
            <ProfilePublicScreen />
          </Suspense>
        </ProtectedRoute>
      } />
      
      {/* Profile with specific user ID */}
      <Route path="/profile/:userId" element={
        <ProtectedRoute>
          <Suspense fallback={<RouteFallback />}>
            <ProfileScreen />
          </Suspense>
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
      <Route path="/admin" element={
        <ProtectedRoute>
          <Suspense fallback={<RouteFallback />}>
            <AdminDashboardScreen />
          </Suspense>
        </ProtectedRoute>
      } />

      <Route path="/admin/users" element={
        <ProtectedRoute>
          <Suspense fallback={<RouteFallback />}>
            <AdminUserManagementScreen />
          </Suspense>
        </ProtectedRoute>
      } />

      <Route path="/admin/content" element={
        <ProtectedRoute>
          <Suspense fallback={<RouteFallback />}>
            <AdminContentManagementScreen />
          </Suspense>
        </ProtectedRoute>
      } />

      <Route path="/admin/moderation" element={
        <ProtectedRoute>
          <Suspense fallback={<RouteFallback />}>
            <AdminModerationQueueScreen />
          </Suspense>
        </ProtectedRoute>
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

      {/* Thumbnail Designer Route */}
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

      <Route path="/reputation/:userId" element={
        <ProtectedRoute>
          <Suspense fallback={<RouteFallback />}>
            <ReputationScreen />
          </Suspense>
        </ProtectedRoute>
      } />
      
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
      <Route path="/inbox" element={<Navigate to="/messages" replace />} />
      <Route path="/dm" element={<Navigate to="/messages" replace />} />
      
      {/* ========== ERROR & CATCH-ALL ========== */}
      {/* 404 Page (Future Implementation) */}
      {/*
      <Route path="/404" element={
        <ProtectedRoute>
          <Suspense fallback={<RouteFallback />}>
            <NotFoundScreen />
          </Suspense>
        </ProtectedRoute>
      } />
      */}
      
      {/* Catch-all redirect - Use home for authenticated, intro for unauthenticated */}
      <Route path="*" element={<Navigate to="/home" replace />} />
    </Routes>
  );
}