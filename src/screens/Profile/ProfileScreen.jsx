// src/screens/Profile/ProfileScreen.jsx

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

  const isOwner = !userId || userId === currentUserId || userId === 'me';

  if (isOwner) {
    return <ProfileMyScreen />;
  }

  return <ProfilePublicScreen />;
}
