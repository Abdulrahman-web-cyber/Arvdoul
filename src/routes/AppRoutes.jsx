// src/routes/AppRoutes.jsx
import React, { Suspense, lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import RouteGuard from '../components/Shared/RouteGuard';
import ProtectedRoute from '../components/Shared/ProtectedRoute';

// Lazy load pages for better performance
const SplashScreen = lazy(() => import('../screens/SplashScreen'));
const IntroScreen = lazy(() => import('../screens/IntroScreen'));
const LoginScreen = lazy(() => import('../screens/LoginScreen'));
const ForgotPassword = lazy(() => import('../screens/ForgotPassword'));
const ResetPassword = lazy(() => import('../screens/ResetPassword'));
const ResetOtpVerification = lazy(() => import('../screens/ResetOtpVerification'));
const EmailPasswordReset = lazy(() => import('../screens/EmailPasswordReset'));

// Signup screens (using SignupContext - unchanged)
const SignupStep1Personal = lazy(() => import('../screens/SignupStep1Personal'));
const SignupStep2VerifyContact = lazy(() => import('../screens/SignupStep2VerifyContact'));
const OtpVerification = lazy(() => import('../screens/OtpVerification'));
const EmailVerification = lazy(() => import('../screens/EmailVerification'));
const SetPassword = lazy(() => import('../screens/SetPassword'));
const SetupProfile = lazy(() => import('../screens/SetupProfile'));

// Main app screens
const HomeScreen = lazy(() => import('../screens/HomeScreen'));
const MessagesScreen = lazy(() => import('../screens/MessagesScreen'));
const ReelsScreen = lazy(() => import('../screens/ReelsScreen'));
const VideosScreen = lazy(() => import('../screens/VideosScreen'));
const PostDetails = lazy(() => import('../screens/PostDetails'));

// Loading component
const LoadingFallback = () => (
  <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900">
    <div className="text-center">
      <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
      <p className="text-gray-600 dark:text-gray-400">Loading secure application...</p>
    </div>
  </div>
);

export default function AppRoutes() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <Routes>
        {/* Public routes with RouteGuard for security */}
        <Route path="/" element={
          <RouteGuard>
            <SplashScreen />
          </RouteGuard>
        } />
        
        <Route path="/intro" element={
          <RouteGuard>
            <IntroScreen />
          </RouteGuard>
        } />
        
        <Route path="/login" element={
          <RouteGuard>
            <LoginScreen />
          </RouteGuard>
        } />
        
        <Route path="/forgot-password" element={
          <RouteGuard>
            <ForgotPassword />
          </RouteGuard>
        } />
        
        <Route path="/reset-password" element={
          <RouteGuard>
            <ResetPassword />
          </RouteGuard>
        } />
        
        <Route path="/reset-otp-verification" element={
          <RouteGuard>
            <ResetOtpVerification />
          </RouteGuard>
        } />
        
        <Route path="/email-password-reset" element={
          <RouteGuard>
            <EmailPasswordReset />
          </RouteGuard>
        } />
        
        {/* Signup routes (using SignupContext - unchanged) */}
        <Route path="/signup/step1" element={
          <RouteGuard>
            <SignupStep1Personal />
          </RouteGuard>
        } />
        
        <Route path="/signup/step2" element={
          <RouteGuard>
            <SignupStep2VerifyContact />
          </RouteGuard>
        } />
        
        <Route path="/otp-verification" element={
          <RouteGuard>
            <OtpVerification />
          </RouteGuard>
        } />
        
        <Route path="/email-verification" element={
          <RouteGuard>
            <EmailVerification />
          </RouteGuard>
        } />
        
        <Route path="/set-password" element={
          <RouteGuard>
            <SetPassword />
          </RouteGuard>
        } />
        
        <Route path="/setup-profile" element={
          <RouteGuard>
            <SetupProfile />
          </RouteGuard>
        } />
        
        {/* Protected routes - require authentication */}
        <Route path="/home" element={
          <RouteGuard>
            <ProtectedRoute requireAuth={true}>
              <HomeScreen />
            </ProtectedRoute>
          </RouteGuard>
        } />
        
        <Route path="/messages" element={
          <RouteGuard>
            <ProtectedRoute requireAuth={true}>
              <MessagesScreen />
            </ProtectedRoute>
          </RouteGuard>
        } />
        
        <Route path="/reels" element={
          <RouteGuard>
            <ProtectedRoute requireAuth={true}>
              <ReelsScreen />
            </ProtectedRoute>
          </RouteGuard>
        } />
        
        <Route path="/videos" element={
          <RouteGuard>
            <ProtectedRoute requireAuth={true}>
              <VideosScreen />
            </ProtectedRoute>
          </RouteGuard>
        } />
        
        <Route path="/post/:id" element={
          <RouteGuard>
            <ProtectedRoute requireAuth={true}>
              <PostDetails />
            </ProtectedRoute>
          </RouteGuard>
        } />
        
        {/* Catch all route - redirect to home if authenticated, otherwise to login */}
        <Route path="*" element={
          <RouteGuard>
            {localStorage.getItem('auth_token') ? (
              <Navigate to="/home" replace />
            ) : (
              <Navigate to="/login" replace />
            )}
          </RouteGuard>
        } />
      </Routes>
    </Suspense>
  );
}