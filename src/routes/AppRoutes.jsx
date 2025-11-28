import React, { Suspense, lazy } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "@context/AuthContext";
import SplashScreen from "@screens/SplashScreen";

// Lazy-load screens for performance
const IntroScreen = lazy(() => import("@screens/IntroScreen"));
const LoginScreen = lazy(() => import("@screens/LoginScreen"));
const SignupStep1Personal = lazy(() => import("@screens/SignupStep1Personal"));
const SignupStep2VerifyContact = lazy(() => import("@screens/SignupStep2VerifyContact"));
const OtpVerification = lazy(() => import("@screens/OtpVerification"));
const SetPassword = lazy(() => import("@screens/SetPassword"));
const SetupProfile = lazy(() => import("@screens/SetupProfile"));
// Future private screens
// const HomeScreen = lazy(() => import("@screens/HomeScreen"));

/**
 * PrivateRoute wrapper for protected routes
 */
function PrivateRoute({ children }) {
  const { user, isInitialized } = useAuth();

  if (!isInitialized) return <SplashScreen />; // wait for auth initialization
  if (!user) return <Navigate to="/login" replace />; // redirect if not logged in
  if (!user.displayName) return <Navigate to="/setup-profile" replace />; // force profile setup

  return children;
}

/**
 * Fallback UI for lazy-loaded components
 */
const Loader = () => (
  <div className="w-full h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
    <SplashScreen />
  </div>
);

export default function AppRoutes() {
  const { isInitialized } = useAuth();

  if (!isInitialized) return <SplashScreen />; // initial auth check

  return (
    <Suspense fallback={<Loader />}>
      <Routes>
        {/* Public Routes */}
        <Route path="/" element={<Navigate to="/intro" />} />
        <Route path="/intro" element={<IntroScreen />} />
        <Route path="/login" element={<LoginScreen />} />
        <Route path="/signup/step1" element={<SignupStep1Personal />} />
        <Route path="/signup/step2" element={<SignupStep2VerifyContact />} />
        <Route path="/otp-verification" element={<OtpVerification />} />
        <Route path="/set-password" element={<SetPassword />} />
        <Route path="/setup-profile" element={<SetupProfile />} />

        {/* Example protected route */}
        {/* <Route path="/home" element={<PrivateRoute><HomeScreen /></PrivateRoute>} /> */}

        {/* Catch-all redirect */}
        <Route path="*" element={<Navigate to="/intro" />} />
      </Routes>
    </Suspense>
  );
}