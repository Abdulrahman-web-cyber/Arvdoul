/**
 * src/components/profile/ProfileAbout.jsx - ARVDOUL Profile About Component
 * 
 * Displays profile about/bio information.
 * 
 * @component
 */

import React, { memo } from 'react';
import { cn } from '../../lib/utils';
import { 
  MapPin, 
  Link as LinkIcon, 
  Calendar, 
  User,
  Globe,
  Briefcase,
  GraduationCap,
  Heart,
  Star
} from 'lucide-react';

/**
 * ProfileAbout Component
 * @param {Object} props
 */
const ProfileAbout = ({
  profile = {},
  theme = 'light',
  isOwner = false,
  onEdit,
}) => {
  const {
    bio,
    location,
    website,
    birthday,
    gender,
    pronouns,
    profession,
    education,
    interests = [],
    socialLinks = {},
  } = profile;

  const infoItems = [
    { icon: MapPin, label: 'Location', value: location },
    { icon: LinkIcon, label: 'Website', value: website, href: website },
    { icon: Calendar, label: 'Birthday', value: birthday },
    { icon: User, label: 'Gender', value: gender },
    { icon: Globe, label: 'Language', value: profile.language || 'English' },
  ].filter(item => item.value);

  const careerItems = [
    { icon: Briefcase, label: 'Profession', value: profession },
    { icon: GraduationCap, label: 'Education', value: education },
  ].filter(item => item.value);

  return (
    <div className={cn(
      'p-4 rounded-2xl',
      'bg-white dark:bg-gray-900',
      'border border-gray-200 dark:border-gray-800',
      'space-y-4'
    )}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
          About
        </h3>
        {isOwner && (
          <button
            onClick={onEdit}
            className={cn(
              'text-sm text-purple-600 dark:text-purple-400',
              'hover:underline'
            )}
          >
            Edit
          </button>
        )}
      </div>

      {/* Bio */}
      {bio && (
        <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
          {bio}
        </p>
      )}

      {/* Info Items */}
      {infoItems.length > 0 && (
        <div className="space-y-2">
          {infoItems.map((item, index) => {
            const Icon = item.icon;
            return (
              <div
                key={index}
                className="flex items-center gap-3 text-sm"
              >
                <Icon className="w-4 h-4 text-gray-400 flex-shrink-0" />
                <span className="text-gray-600 dark:text-gray-400">{item.label}:</span>
                {item.href ? (
                  <a
                    href={item.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-purple-600 dark:text-purple-400 hover:underline truncate"
                  >
                    {item.value}
                  </a>
                ) : (
                  <span className="text-gray-900 dark:text-white capitalize">
                    {item.value}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Pronouns */}
      {pronouns && (
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600 dark:text-gray-400">Pronouns:</span>
          <span className={cn(
            'px-2 py-0.5 rounded text-sm font-medium',
            'bg-purple-100 dark:bg-purple-900/30',
            'text-purple-700 dark:text-purple-300'
          )}>
            {pronouns}
          </span>
        </div>
      )}

      {/* Career */}
      {careerItems.length > 0 && (
        <div className="pt-3 border-t border-gray-100 dark:border-gray-800 space-y-2">
          {careerItems.map((item, index) => {
            const Icon = item.icon;
            return (
              <div
                key={index}
                className="flex items-center gap-3 text-sm"
              >
                <Icon className="w-4 h-4 text-gray-400 flex-shrink-0" />
                <span className="text-gray-600 dark:text-gray-400">{item.label}:</span>
                <span className="text-gray-900 dark:text-white">{item.value}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* Social Links */}
      {Object.keys(socialLinks).length > 0 && (
        <div className="pt-3 border-t border-gray-100 dark:border-gray-800">
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Social Links</p>
          <div className="flex flex-wrap gap-2">
            {Object.entries(socialLinks).map(([platform, url]) => (
              <a
                key={platform}
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(
                  'px-3 py-1.5 rounded-full text-sm font-medium',
                  'bg-gray-100 dark:bg-gray-800',
                  'hover:bg-gray-200 dark:hover:bg-gray-700',
                  'transition-colors'
                )}
              >
                {platform}
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Interests */}
      {interests.length > 0 && (
        <div className="pt-3 border-t border-gray-100 dark:border-gray-800">
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-2 flex items-center gap-1">
            <Star className="w-4 h-4" />
            Interests
          </p>
          <div className="flex flex-wrap gap-2">
            {interests.map((interest, index) => (
              <span
                key={index}
                className={cn(
                  'px-2.5 py-1 rounded-full text-sm',
                  'bg-gradient-to-r from-purple-100 to-blue-100',
                  'dark:from-purple-900/30 dark:to-blue-900/30',
                  'text-purple-700 dark:text-purple-300',
                  'border border-purple-200 dark:border-purple-800'
                )}
              >
                {interest}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {!bio && infoItems.length === 0 && careerItems.length === 0 && interests.length === 0 && (
        <p className="text-gray-500 dark:text-gray-400 text-sm text-center py-4">
          {isOwner ? 'Add information about yourself' : 'No information available'}
        </p>
      )}
    </div>
  );
};

export default memo(ProfileAbout);
