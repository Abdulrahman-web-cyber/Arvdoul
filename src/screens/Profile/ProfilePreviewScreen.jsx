/**
 * src/screens/Profile/ProfilePreviewScreen.jsx - ARVDOUL Profile Preview Screen
 * 
 * Preview profile before saving changes.
 * 
 * @component
 */

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../../context/ThemeContext';
import { cn } from '../../lib/utils';
import { ArrowLeft, Save, Eye } from 'lucide-react';
import { ProfileHeader, ProfileSkeleton } from '../../components/profile';

/**
 * ProfilePreviewScreen Component
 * @param {Object} props
 */
export default function ProfilePreviewScreen({
  profile,
  loading = false,
  onSave,
  onBack,
}) {
  const navigate = useNavigate();
  const { theme } = useTheme();
  
  const handleSave = () => {
    if (onSave) {
      onSave();
    } else {
      navigate('/profile');
    }
  };
  
  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      navigate(-1);
    }
  };
  
  if (loading) {
    return (
      <div className={cn(
        'min-h-screen pb-20',
        theme === 'dark' ? 'bg-gray-900' : 'bg-gray-50'
      )}>
        <ProfileSkeleton theme={theme} />
      </div>
    );
  }
  
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
        <div className="flex items-center justify-between px-4 py-3">
          <button
            onClick={handleBack}
            className={cn(
              'p-2 rounded-xl',
              'hover:bg-gray-100 dark:hover:bg-gray-800',
              'transition-colors'
            )}
          >
            <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          </button>
          
          <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
            <Eye className="w-4 h-4" />
            Preview
          </div>
          
          <button
            onClick={handleSave}
            className={cn(
              'px-4 py-2 rounded-xl font-medium text-sm',
              'bg-gradient-to-r from-purple-500 to-blue-500',
              'text-white hover:opacity-90 transition-opacity',
              'flex items-center gap-2'
            )}
          >
            <Save className="w-4 h-4" />
            Save
          </button>
        </div>
      </div>
      
      {/* Preview Content */}
      <div className="max-w-2xl mx-auto px-4 pt-4">
        <ProfileHeader
          profile={profile}
          isOwner={true}
          theme={theme}
        />
      </div>
    </div>
  );
}
