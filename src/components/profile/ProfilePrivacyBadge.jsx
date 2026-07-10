/**
 * src/components/profile/ProfilePrivacyBadge.jsx - ARVDOUL Profile Privacy Badge Component
 * 
 * Displays privacy status indicators.
 * 
 * @component
 */

import React, { memo } from 'react';
import { cn } from '../../lib/utils';
import { Lock, Eye, Users, Globe, Shield, ShieldCheck } from 'lucide-react';

/**
 * Privacy level configurations
 */
const PRIVACY_CONFIG = {
  private: {
    icon: Lock,
    label: 'Private',
    color: 'text-gray-600 bg-gray-100 border-gray-300',
    description: 'Only approved followers can see your content',
  },
  followers: {
    icon: Users,
    label: 'Followers Only',
    color: 'text-blue-600 bg-blue-100 border-blue-300',
    description: 'Only your followers can see your content',
  },
  public: {
    icon: Globe,
    label: 'Public',
    color: 'text-green-600 bg-green-100 border-green-300',
    description: 'Anyone can see your content',
  },
};

/**
 * ProfilePrivacyBadge Component
 * @param {Object} props
 */
const ProfilePrivacyBadge = ({
  privacy = 'public',
  showDescription = false,
  theme = 'light',
}) => {
  const config = PRIVACY_CONFIG[privacy] || PRIVACY_CONFIG.public;
  const Icon = config.icon;

  return (
    <div className="inline-flex flex-col">
      <div
        className={cn(
          'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium',
          'border',
          config.color
        )}
      >
        <Icon className="w-3.5 h-3.5" />
        <span>{config.label}</span>
      </div>
      
      {showDescription && (
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 ml-0.5">
          {config.description}
        </p>
      )}
    </div>
  );
};

export default memo(ProfilePrivacyBadge);
