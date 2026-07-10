/**
 * src/screens/Profile/AboutScreen.jsx - ARVDOUL About Screen
 * 
 * Displays detailed profile information.
 * 
 * @component
 */

import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTheme } from '../../context/ThemeContext';
import { cn } from '../../lib/utils';
import { ArrowLeft } from 'lucide-react';
import ProfileAbout from '../../components/profile/About';
import { useProfileStore } from '../../store/profileStore';

/**
 * AboutScreen Component
 */
export default function AboutScreen() {
  const navigate = useNavigate();
  const { userId } = useParams();
  const { theme } = useTheme();
  const { profile, isOwner, loadProfile } = useProfileStore();
  
  const handleEdit = () => {
    navigate('/profile/edit');
  };
  
  return (
    <div className={cn(
      'min-h-screen pb-20',
      theme === 'dark' ? 'bg-gray-900' : 'bg-gray-50'
    )}>
      {/* Header */}
      <div className={cn(
        'sticky top-0 z-20',
        'bg-white dark:bg-gray-900',
        'border-b border-gray-200 dark:border-gray-800'
      )}>
        <div className="flex items-center gap-3 px-4 py-3">
          <button
            onClick={() => navigate(-1)}
            className={cn(
              'p-2 rounded-xl',
              'hover:bg-gray-100 dark:hover:bg-gray-800',
              'transition-colors'
            )}
          >
            <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          </button>
          <h1 className="text-lg font-semibold text-gray-900 dark:text-white">
            About
          </h1>
        </div>
      </div>
      
      {/* Content */}
      <div className="max-w-2xl mx-auto px-4 py-4">
        <ProfileAbout
          profile={profile || {}}
          isOwner={isOwner}
          onEdit={handleEdit}
          theme={theme}
        />
      </div>
    </div>
  );
}
