/**
 * src/components/profile/ProfileAchievements.jsx - ARVDOUL Profile Achievements Component
 */

import React, { memo } from 'react';
import { cn } from '../../lib/utils';
import { Award } from 'lucide-react';

const ProfileAchievements = memo(({
  achievements = [],
  theme = 'light',
}) => {
  if (!achievements || achievements.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {achievements.map((achievement) => (
        <span
          key={achievement.id}
          className={cn(
            'inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium',
            'bg-gradient-to-r from-yellow-500 to-orange-500 text-white'
          )}
          title={achievement.description}
        >
          <Award className="w-3 h-3" />
          {achievement.name}
        </span>
      ))}
    </div>
  );
});

ProfileAchievements.displayName = 'ProfileAchievements';
export default ProfileAchievements;
