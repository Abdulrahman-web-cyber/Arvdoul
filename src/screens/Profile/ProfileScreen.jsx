/**
 * Central controller that dynamically renders ProfileMyScreen for the profile owner
 * or ProfilePublicScreen for visitors and creators.
 * 
 * Deeply wired to useProfileStore so route parameters, user handles, and active
 * profile state synchronize authoritatively.
 * 
 * @component
 */

import { useEffect } from "react";
import { useParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useAppStore } from '../../store/appStore';
import { useProfileStore } from '../../store/profileStore';
import { getStoredUid } from '../../utils/security';
import ProfileMyScreen from './ProfileMyScreen';
import ProfilePublicScreen from './ProfilePublicScreen';

export default function ProfileScreen() {
  const { userId } = useParams();
  const { user: authContextUser } = useAuth();
  const authStoreUser = useAppStore(state => state.currentUser);
  const authUser = authStoreUser || authContextUser;
  const currentUserId = authUser?.uid || authContextUser?.uid || getStoredUid();

  // Wire Profile Store
  const storeProfile = useProfileStore((state) => state.profile);
  const loadProfile = useProfileStore((state) => state.loadProfile);

  const rawUserId = userId ? String(userId).replace(/^@/, '').trim() : null;
  const lowerUserId = rawUserId ? rawUserId.toLowerCase() : null;
  const rawEmail = typeof authUser?.email === 'string' ? authUser.email : '';
  const rawUsername = typeof authUser?.username === 'string' ? authUser.username : '';
  const currentUsername = (rawUsername || rawEmail.split('@')[0] || '').toLowerCase().trim();

  // Evaluate if current viewer is owner of this profile route
  const isOwner = !rawUserId || 
    rawUserId === currentUserId || 
    (lowerUserId && currentUserId && lowerUserId === currentUserId.toLowerCase()) || 
    lowerUserId === 'me' || 
    (currentUsername && lowerUserId === currentUsername) ||
    (storeProfile && (storeProfile.id === currentUserId || storeProfile.uid === currentUserId) && 
      (lowerUserId === storeProfile.username?.toLowerCase() || rawUserId === storeProfile.id));

  // Ensure target profile is loaded into useProfileStore if viewing a distinct user
  useEffect(() => {
    const targetUid = isOwner ? currentUserId : (rawUserId || currentUserId);
    if (!targetUid) return;

    // Trigger loadProfile if profile in store doesn't match target route
    const currentStoreId = storeProfile?.id || storeProfile?.uid;
    const currentStoreUsername = storeProfile?.username?.toLowerCase();

    const isAlreadyLoaded = isOwner
      ? (currentStoreId === currentUserId)
      : (currentStoreId === rawUserId || currentStoreUsername === lowerUserId);

    if (!isAlreadyLoaded) {
      loadProfile(targetUid, currentUserId);
    }
  }, [rawUserId, lowerUserId, currentUserId, isOwner, loadProfile, storeProfile?.id, storeProfile?.uid, storeProfile?.username]);

  if (isOwner) {
    return <ProfileMyScreen />;
  }

  return <ProfilePublicScreen />;
}

