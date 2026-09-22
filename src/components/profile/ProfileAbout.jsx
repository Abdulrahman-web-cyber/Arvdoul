/**
 * src/components/profile/ProfileAbout.jsx - ARVDOUL Profile About Component
 * 
 * Displays profile about/bio information.
 * 
 * @component
 */

import React, { memo } from 'react';
import { cn } from '../../lib/utils';
import { sanitizeProfileUrl } from '../../config/profileContracts.js';
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
  profile,
  user,
  theme = 'light',
  isOwner,
  isCurrentUser,
  onEdit,
}) => {
  const resolvedProfile = profile || user || {};
  const resolvedIsOwner = Boolean(isOwner ?? isCurrentUser);

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
    links = [],
  } = resolvedProfile;

  const resolvedLinks = Array.isArray(links) && links.length > 0
    ? links
    : Object.entries(socialLinks).map(([platform, url]) => ({
        id: platform,
        title: platform,
        url,
        platform,
        isPrimary: false,
      }));

  const infoItems = [
    { icon: MapPin, label: 'Location', value: location },
    { icon: LinkIcon, label: 'Website', value: website, href: website },
    { icon: Calendar, label: 'Birthday', value: birthday },
    { icon: User, label: 'Gender', value: gender },
    { icon: Globe, label: 'Language', value: resolvedProfile.language || 'English' },
  ].filter(item => item.value);

  const careerItems = [
    { icon: Briefcase, label: 'Profession', value: profession },
    { icon: GraduationCap, label: 'Education', value: education },
  ].filter(item => item.value);

  return (
    <div aria-label="Profile component" role="region" className={cn(
      'p-4 rounded-2xl',
      'bg-white dark:bg-gray-900',
      'border border-gray-200 dark:border-gray-800',
      'space-y-4'
    )}>
      {/* Header */}
      <div className="bg-gradient-to-r from-violet-900/30 to-fuchsia-900/30 backdrop-blur-md rounded-xl border border-white/10 p-4 shadow-lg flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
          About
        </h3>
        {resolvedIsOwner && (
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
                {item.href && sanitizeProfileUrl(item.href) ? (
                  <a
                    href={sanitizeProfileUrl(item.href)}
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

      {/* Links */}
      {resolvedLinks.length > 0 && (
        <div className="pt-3 border-t border-gray-100 dark:border-gray-800">
          <p className="text-sm font-semibold text-gray-900 dark:text-white mb-2.5 flex items-center gap-1.5">
            <LinkIcon className="w-4 h-4 text-purple-400" />
            Links & Socials
          </p>
          <div className="flex flex-wrap gap-2">
            {resolvedLinks.map((link, idx) => {
              const safeUrl = sanitizeProfileUrl(link.url);
              if (!safeUrl) return null;
              return (
                <a
                  key={link.id || idx}
                  href={safeUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cn(
                    'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all shadow-sm',
                    link.isPrimary
                      ? 'bg-purple-600 text-white hover:bg-purple-700 shadow-purple-500/20'
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                  )}
                >
                  <span>{link.title || link.platform || 'Link'}</span>
                  {link.isPrimary && (
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
                  )}
                </a>
              );
            })}
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
          {resolvedIsOwner ? 'Add information about yourself' : 'No information available'}
        </p>
      )}
    </div>
  );
};

export default memo(ProfileAbout);
