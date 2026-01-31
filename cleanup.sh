#!/bin/bash

echo "🧹 Cleaning up duplicate declarations and fixing imports..."

# Fix AppStateGuard.jsx
echo "Fixing AppStateGuard.jsx..."
cat > src/app/AppStateGuard.jsx << 'FILE'
// src/app/AppStateGuard.jsx - ULTIMATE FIXED VERSION
import React, { useEffect, useMemo, useState, useCallback } from "react";
import { Navigate, Outlet, useLocation, useNavigate } from "react-router-dom";
import PropTypes from "prop-types";
import { useAuth } from "../context/AuthContext.jsx";
import FullScreenLoader from "../components/System/FullScreenLoader.jsx";
import FatalError from "../components/System/FatalError.jsx";

// Fixed imports - using compat layer
import { 
  getFirebaseFirestore as getDbInstance,
  getCurrentUser,
  doc,
  getDoc
} from "../firebase/firebase.js";

const MAINTENANCE_MODE = import.meta.env.VITE_MAINTENANCE_MODE === 'true';

const validateProfile = (profile) => {
  if (!profile) return { complete: false, missing: ['profile'] };
  
  const missing = [];
  
  if (!profile.displayName?.trim()) missing.push('displayName');
  if (!profile.username?.trim()) missing.push('username');
  
  const hasAvatarOrBio = !!(profile.photoURL || profile.bio);
  if (!hasAvatarOrBio) missing.push('avatarOrBio');
  
  return {
    complete: missing.length === 0,
    missing,
    hasAvatar: !!profile.photoURL,
    hasBio: !!profile.bio
  };
};

export default function AppStateGuard({ children }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { 
    authReady, 
    user, 
    loadingMessage, 
    error: authError,
    refreshUserProfile
  } = useAuth();

  const [profile, setProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState(null);
  const [profileFetched, setProfileFetched] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  const isAuthenticated = !!user;
  const isEmailVerified = !!(user && user.emailVerified);

  const fetchUserProfile = useCallback(async (uid) => {
    const db = getDbInstance();
    if (!uid || !db) {
      setProfileError(new Error('Invalid user or database not ready'));
      return;
    }

    setProfileLoading(true);
    setProfileError(null);

    try {
      console.log(\`📡 Fetching profile for user: \${uid}\`);
      const userDoc = await getDoc(doc('users', uid));
      
      if (userDoc.exists()) {
        const data = userDoc.data();
        setProfile(data);
        console.log('✅ Profile loaded:', data);
      } else {
        console.log('⚠️ No profile found');
        setProfile({ displayName: '', username: '', photoURL: null, bio: '' });
      }
      
      setProfileFetched(true);
      setRetryCount(0);
    } catch (error) {
      console.error('❌ Profile fetch failed:', error);
      
      if (retryCount < 3) {
        console.log(\`🔄 Retrying profile fetch (\${retryCount + 1}/3)...\`);
        setRetryCount(prev => prev + 1);
        setTimeout(() => fetchUserProfile(uid), 1000 * (retryCount + 1));
      } else {
        setProfileError(error);
        setProfile(null);
      }
    } finally {
      setProfileLoading(false);
    }
  }, [retryCount]);

  useEffect(() => {
    if (!isAuthenticated || !user?.uid || !authReady) {
      setProfile(null);
      setProfileFetched(false);
      setRetryCount(0);
      return;
    }

    if (!profileFetched) {
      fetchUserProfile(user.uid);
    }
  }, [isAuthenticated, user?.uid, authReady, profileFetched, fetchUserProfile]);

  const profileValidation = useMemo(() => {
    if (!profile) return { complete: false, missing: ['profile'] };
    return validateProfile(profile);
  }, [profile]);

  const isProfileComplete = profileValidation.complete;

  const ProtectedRoute = ({ redirectTo = "/intro" }) => {
    if (!isAuthenticated) {
      return <Navigate to={redirectTo} replace state={{ from: location }} />;
    }
    
    if (!isEmailVerified) {
      return <Navigate to="/verify-email" replace state={{ from: location }} />;
    }
    
    if (!isProfileComplete) {
      return <Navigate to="/setup-profile" replace state={{ 
        from: location, 
        missingFields: profileValidation.missing 
      }} />;
    }
    
    return <Outlet />;
  };

  const VerifiedRoute = ({ redirectTo = "/verify-email" }) => {
    if (!isAuthenticated) {
      return <Navigate to="/intro" replace state={{ from: location }} />;
    }
    
    if (!isEmailVerified) {
      return <Navigate to={redirectTo} replace state={{ from: location }} />;
    }
    
    return <Outlet />;
  };

  const OnboardingRoute = ({ redirectTo = "/home" }) => {
    if (!isAuthenticated) {
      return <Navigate to="/intro" replace state={{ from: location }} />;
    }
    
    if (isProfileComplete) {
      return <Navigate to={redirectTo} replace state={{ from: location }} />;
    }
    
    return <Outlet />;
  };

  if (authError) {
    return (
      <FatalError 
        title="Authentication Error" 
        error={authError}
        onRetry={() => window.location.reload()}
      />
    );
  }

  if (!authReady) {
    return (
      <FullScreenLoader 
        message={loadingMessage || "Initializing security systems..."} 
      />
    );
  }

  if (MAINTENANCE_MODE) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
        <div className="max-w-xl text-center p-8 rounded-2xl bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border border-gray-200 dark:border-gray-700">
          <div className="w-20 h-20 mx-auto mb-6 bg-gradient-to-r from-amber-100 to-orange-100 dark:from-amber-900/30 dark:to-orange-900/30 rounded-full flex items-center justify-center">
            <span className="text-3xl">🔧</span>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-3">
            Maintenance Mode
          </h2>
          <p className="text-gray-600 dark:text-gray-300 mb-6">
            We're performing scheduled maintenance to improve your experience.
            Please check back in a few minutes.
          </p>
          <div className="text-sm text-gray-500 dark:text-gray-400">
            Estimated completion: 30 minutes
          </div>
        </div>
      </div>
    );
  }

  if (isAuthenticated && profileLoading && !profileError) {
    return <FullScreenLoader message="Loading your profile..." />;
  }

  if (isAuthenticated && profileError) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
            <span className="text-2xl">⚠️</span>
          </div>
          <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
            Profile Load Failed
          </h3>
          <p className="text-gray-600 dark:text-gray-300 mb-6">
            We couldn't load your profile data. This might be a temporary issue.
          </p>
          <div className="space-y-3">
            <button
              onClick={() => fetchUserProfile(user.uid)}
              className="w-full py-3 px-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg font-medium hover:opacity-90 transition-opacity"
            >
              Try Again
            </button>
            <button
              onClick={() => navigate('/intro')}
              className="w-full py-3 px-4 bg-gray-200 dark:bg-gray-800 text-gray-800 dark:text-gray-200 rounded-lg font-medium hover:bg-gray-300 dark:hover:bg-gray-700 transition-colors"
            >
              Go Home
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      {import.meta.env.DEV && (
        <div className="fixed bottom-4 right-4 z-50">
          <div className="bg-black/80 text-white text-xs p-3 rounded-lg backdrop-blur-sm">
            <div>Auth: {isAuthenticated ? '✅' : '❌'}</div>
            <div>Email Verified: {isEmailVerified ? '✅' : '❌'}</div>
            <div>Profile Complete: {isProfileComplete ? '✅' : '❌'}</div>
            {profileValidation.missing.length > 0 && (
              <div>Missing: {profileValidation.missing.join(', ')}</div>
            )}
          </div>
        </div>
      )}

      {children ? children : <Outlet />}
    </>
  );
}

AppStateGuard.propTypes = {
  children: PropTypes.node
};
FILE

echo "✅ Fixed AppStateGuard.jsx"

# Clear node modules cache
echo "🧹 Clearing cache..."
rm -rf node_modules/.vite
rm -rf .eslintcache

echo "🎉 Cleanup complete! Run 'npm run dev' to test."
