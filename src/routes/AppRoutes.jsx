// src/routes/AppRoutes.jsx - ULTIMATE PRODUCTION VERSION - COMPLETE & FIXED
import React, { lazy, Suspense } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
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
const CreatePost = lazy(() => import("../screens/CreatePost.jsx"));
const NetworkScreen = lazy(() => import("../screens/NetworkScreen.jsx"));
const CoinsScreen = lazy(() => import("../screens/CoinsScreen.jsx"));
const NotificationsScreen = lazy(() => import("../screens/NotificationsScreen.jsx"));
const CreateStory = lazy(() => import("../screens/CreateStory.jsx"));
const ProfileScreen = lazy(() => import("../screens/ProfileScreen.jsx"));
const EditProfile = lazy(() => import("../screens/EditProfile.jsx"));
const SettingsScreen = lazy(() => import("../screens/SettingsScreen.jsx"));
const SearchScreen = lazy(() => import("../screens/SearchScreen.jsx"));
const SavedScreen = lazy(() => import("../screens/SavedScreen.jsx"));
const CollectionsScreen = lazy(() => import("../screens/CollectionsScreen.jsx"));
const LiveScreen = lazy(() => import("../screens/LiveScreen.jsx"));

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

// ==================== MAIN APP ROUTES ====================
export default function AppRoutes() {
  return (
    <Routes>
      {/* Public Routes (No Layout) */}
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
      
      {/* Protected Routes (With Layout) */}
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
      
      <Route path="/messages" element={
        <ProtectedRoute>
          <Suspense fallback={<RouteFallback />}>
            <MessagingScreen />
          </Suspense>
        </ProtectedRoute>
      } />
      
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
      
      <Route path="/profile" element={
        <ProtectedRoute>
          <Suspense fallback={<RouteFallback />}>
            <ProfileScreen />
          </Suspense>
        </ProtectedRoute>
      } />
      
      <Route path="/profile/edit" element={
        <ProtectedRoute>
          <Suspense fallback={<RouteFallback />}>
            <EditProfile />
          </Suspense>
        </ProtectedRoute>
      } />
      
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
      
      <Route path="/setup-profile" element={
        <PublicRoute>
          <Suspense fallback={<RouteFallback />}>
            <SetupProfile />
          </Suspense>
        </PublicRoute>
      } />
      
      {/* Redirects */}
      <Route path="/signup" element={<Navigate to="/signup/step1" replace />} />
      
      {/* Catch-all redirect */}
      <Route path="*" element={<Navigate to="/home" replace />} />
    </Routes>
  );
}

// Note: You need to import Route from react-router-dom at the top