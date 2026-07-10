/**
 * src/components/profile/ProfileSocialStatus.jsx - ARVDOUL Profile Social Status Component
 * 
 * Displays social connection status.
 * 
 * @component
 */

import React, { memo, useCallback } from 'react';
import { cn } from '../../lib/utils';
import { 
  UserCheck, 
  UserPlus, 
  UserX,
  Clock,
  Shield,
  ShieldOff
} from 'lucide-react';

/**
 * ProfileSocialStatus Component
 * @param {Object} props
 */
const ProfileSocialStatus = ({
  status = 'none', // 'none' | 'following' | 'follows_you' | 'mutual' | 'blocked' | 'pending'
  theme = 'light',
  onAction,
}) => {
  const getStatusConfig = useCallback(() => {
    switch (status) {
      case 'following':
        return {
          icon: UserCheck,
          label: 'Following',
          color: 'text-green-600',
          bg: 'bg-green-100 dark:bg-green-900/20',
        };
      case 'follows_you':
        return {
          icon: Clock,
          label: 'Follows You',
          color: 'text-blue-600',
          bg: 'bg-blue-100 dark:bg-blue-900/20',
        };
      case 'mutual':
        return {
          icon: UserCheck,
          label: 'Mutual Follow',
          color: 'text-purple-600',
          bg: 'bg-purple-100 dark:bg-purple-900/20',
        };
      case 'blocked':
        return {
          icon: ShieldOff,
          label: 'Blocked',
          color: 'text-red-600',
          bg: 'bg-red-100 dark:bg-red-900/20',
        };
      case 'pending':
        return {
          icon: Clock,
          label: 'Pending',
          color: 'text-yellow-600',
          bg: 'bg-yellow-100 dark:bg-yellow-900/20',
        };
      default:
        return {
          icon: UserPlus,
          label: 'Not Following',
          color: 'text-gray-600',
          bg: 'bg-gray-100 dark:bg-gray-800',
        };
    }
  }, [status]);

  const config = getStatusConfig();
  const Icon = config.icon;

  return (
    <div
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium',
        config.bg,
        config.color
      )}
    >
      <Icon className="w-3.5 h-3.5" />
      <span>{config.label}</span>
    </div>
  );
};

export default memo(ProfileSocialStatus);
