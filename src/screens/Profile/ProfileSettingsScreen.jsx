/**
 * src/screens/Profile/ProfileSettingsScreen.jsx - ARVDOUL Profile Settings Screen
 * 
 * Profile and account settings.
 * 
 * @component
 */

import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../../context/ThemeContext';
import { cn } from '../../lib/utils';
import { 
  ArrowLeft, 
  Shield, 
  Bell, 
  Lock, 
  Eye, 
  Globe, 
  Trash2,
  LogOut,
  ChevronRight,
  Loader2
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../../context/AuthContext';

/**
 * ProfileSettingsScreen Component
 */
export default function ProfileSettingsScreen() {
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();
  const { signOut } = useAuth();
  
  const [loading, setLoading] = useState(false);
  const [settings, setSettings] = useState({
    privateAccount: false,
    showOnlineStatus: true,
    showReadReceipts: true,
    pushNotifications: true,
    emailNotifications: true,
  });
  
  const handleToggle = useCallback((key) => {
    setSettings(prev => ({ ...prev, [key]: !prev[key] }));
  }, []);
  
  const handleThemeChange = useCallback((newTheme) => {
    setTheme(newTheme);
  }, [setTheme]);
  
  const handleSignOut = useCallback(async () => {
    if (window.confirm('Are you sure you want to sign out?')) {
      setLoading(true);
      try {
        await signOut();
        navigate('/');
      } catch (error) {
        toast.error('Failed to sign out');
      } finally {
        setLoading(false);
      }
    }
  }, [signOut, navigate]);
  
  const handleDeleteAccount = useCallback(() => {
    toast.error('Please contact support to delete your account');
  }, []);
  
  // Settings sections
  const sections = [
    {
      title: 'Account',
      items: [
        { icon: Shield, label: 'Edit Profile', action: () => navigate('/profile/edit') },
        { icon: Lock, label: 'Change Password', action: () => navigate('/change-password') },
        { icon: Globe, label: 'Language', value: 'English' },
      ],
    },
    {
      title: 'Privacy',
      items: [
        { 
          icon: Eye, 
          label: 'Private Account', 
          toggle: 'privateAccount',
          description: 'Only approved followers can see your posts'
        },
        { 
          icon: Bell, 
          label: 'Show Online Status', 
          toggle: 'showOnlineStatus',
          description: 'Let others see when you\'re online'
        },
      ],
    },
    {
      title: 'Notifications',
      items: [
        { 
          icon: Bell, 
          label: 'Push Notifications', 
          toggle: 'pushNotifications'
        },
        { 
          icon: Bell, 
          label: 'Email Notifications', 
          toggle: 'emailNotifications'
        },
      ],
    },
    {
      title: 'Appearance',
      items: [
        { 
          icon: Globe, 
          label: 'Theme', 
          options: [
            { label: 'Light', value: 'light' },
            { label: 'Dark', value: 'dark' },
            { label: 'System', value: 'system' },
          ],
          currentValue: theme,
          onChange: handleThemeChange
        },
      ],
    },
    {
      title: 'Support',
      items: [
        { icon: Shield, label: 'Help Center', action: () => {} },
        { icon: Shield, label: 'Report a Problem', action: () => {} },
        { icon: Shield, label: 'Terms of Service', action: () => {} },
        { icon: Shield, label: 'Privacy Policy', action: () => {} },
      ],
    },
  ];
  
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
            Settings
          </h1>
        </div>
      </div>
      
      {/* Content */}
      <div className="max-w-2xl mx-auto px-4 py-4 space-y-6">
        {sections.map((section) => (
          <div key={section.title}>
            <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase mb-2 px-1">
              {section.title}
            </h2>
            <div className={cn(
              'rounded-xl overflow-hidden',
              'bg-white dark:bg-gray-900',
              'border border-gray-200 dark:border-gray-800'
            )}>
              {section.items.map((item, index) => {
                const Icon = item.icon;
                const hasToggle = item.toggle !== undefined;
                const isLast = index === section.items.length - 1;
                
                return (
                  <div
                    key={item.label}
                    className={cn(
                      'flex items-center gap-3 px-4 py-3',
                      !isLast && 'border-b border-gray-100 dark:border-gray-800'
                    )}
                  >
                    <Icon className="w-5 h-5 text-gray-400 flex-shrink-0" />
                    
                    <div className="flex-1">
                      <p className="text-gray-900 dark:text-white font-medium">
                        {item.label}
                      </p>
                      {item.description && (
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {item.description}
                        </p>
                      )}
                    </div>
                    
                    {hasToggle ? (
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={settings[item.toggle]}
                          onChange={() => handleToggle(item.toggle)}
                          className="sr-only peer"
                        />
                        <div className={cn(
                          'w-11 h-6 rounded-full peer',
                          'peer-checked:after:translate-x-full',
                          'after:content-[""] after:absolute after:top-0.5 after:left-[2px]',
                          'after:bg-white after:rounded-full after:h-5 after:w-5',
                          'after:transition-all',
                          settings[item.toggle]
                            ? 'bg-purple-500'
                            : 'bg-gray-300 dark:bg-gray-600'
                        )} />
                      </label>
                    ) : item.options ? (
                      <select
                        value={item.currentValue}
                        onChange={(e) => item.onChange(e.target.value)}
                        className={cn(
                          'px-2 py-1 rounded-lg text-sm',
                          'bg-gray-100 dark:bg-gray-800',
                          'text-gray-700 dark:text-gray-300',
                          'focus:outline-none focus:ring-2 focus:ring-purple-500'
                        )}
                      >
                        {item.options.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    ) : item.value ? (
                      <span className="text-gray-500 dark:text-gray-400 text-sm">
                        {item.value}
                      </span>
                    ) : (
                      <ChevronRight className="w-5 h-5 text-gray-400" />
                    )}
                    
                    {item.action && !hasToggle && !item.options && (
                      <button
                        onClick={item.action}
                        className="absolute inset-0 opacity-0 cursor-pointer"
                        aria-label={item.label}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
        
        {/* Danger Zone */}
        <div>
          <h2 className="text-sm font-semibold text-red-500 uppercase mb-2 px-1">
            Danger Zone
          </h2>
          <div className={cn(
            'rounded-xl overflow-hidden',
            'bg-white dark:bg-gray-900',
            'border border-red-200 dark:border-red-900'
          )}>
            <button
              onClick={handleSignOut}
              disabled={loading}
              className={cn(
                'w-full flex items-center gap-3 px-4 py-3',
                'text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20',
                'transition-colors'
              )}
            >
              <LogOut className="w-5 h-5" />
              <span className="font-medium">Sign Out</span>
              {loading && <Loader2 className="w-4 h-4 animate-spin ml-auto" />}
            </button>
            
            <div className={cn(
              'border-t border-red-200 dark:border-red-900'
            )}>
              <button
                onClick={handleDeleteAccount}
                className={cn(
                  'w-full flex items-center gap-3 px-4 py-3',
                  'text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20',
                  'transition-colors'
                )}
              >
                <Trash2 className="w-5 h-5" />
                <span className="font-medium">Delete Account</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
