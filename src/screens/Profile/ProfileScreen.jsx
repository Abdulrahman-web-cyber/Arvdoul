/**
 * src/screens/Profile/ProfileScreen.jsx - ARVDOUL Master Profile Screen Controller
 * 
 * Central controller that dynamically renders ProfileMyScreen for the profile owner
 * or ProfilePublicScreen for visitors and creators.
 * 
 * Also supports owner "View As Public" preview mode seamlessly.
 * 
 * @component
 */

import React from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useAppStore } from '../../store/appStore';
import { getStoredUid } from '../../utils/security';
import ProfileMyScreen from './ProfileMyScreen';
import ProfilePublicScreen from './ProfilePublicScreen';

export default function ProfileScreen() {
  const { userId } = useParams();
  const { user: authContextUser } = useAuth();
  const authStoreUser = useAppStore(state => state.currentUser);
  const authUser = authStoreUser || authContextUser;
  const currentUserId = authUser?.uid || authContextUser?.uid || getStoredUid();

  const cleanUserId = userId ? String(userId).replace(/^@/, '').toLowerCase().trim() : null;
  const rawEmail = typeof authUser?.email === 'string' ? authUser.email : '';
  const rawUsername = typeof authUser?.username === 'string' ? authUser.username : '';
  const currentUsername = (rawUsername || rawEmail.split('@')[0] || '').toLowerCase().trim();

  const isOwner = !cleanUserId || 
    cleanUserId === currentUserId || 
    cleanUserId === 'me' || 
    (currentUsername && cleanUserId === currentUsername);

  if (isOwner) {
    return <ProfileMyScreen />;
  }

  return <ProfilePublicScreen />;
}
