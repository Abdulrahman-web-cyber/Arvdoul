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

import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useAppStore } from '../../store/appStore';
import ProfileMyScreen from './ProfileMyScreen';
import ProfilePublicScreen from './ProfilePublicScreen';

export default function ProfileScreen() {
  const { userId } = useParams();
  const { user: authContextUser } = useAuth();
  const authStoreUser = useAppStore(state => state.currentUser);
  const authUser = authStoreUser || authContextUser;
  const currentUserId = authUser?.uid || authContextUser?.uid || (typeof window !== 'undefined' ? (localStorage.getItem('arvdoul_uid') || localStorage.getItem('uid') || JSON.parse(localStorage.getItem('user') || '{}')?.uid) : null);

  const cleanUserId = userId ? String(userId).replace(/^@/, '').toLowerCase().trim() : null;
  const currentUsername = (authUser?.username || authUser?.email?.split('@')[0] || '').toLowerCase().trim();

  const isOwner = !cleanUserId || 
    cleanUserId === currentUserId || 
    cleanUserId === 'me' || 
    (currentUsername && cleanUserId === currentUsername);

  if (isOwner) {
    return <ProfileMyScreen />;
  }

  return <ProfilePublicScreen />;
}
