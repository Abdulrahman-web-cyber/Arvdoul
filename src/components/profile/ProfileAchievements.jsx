/**
 * src/components/profile/ProfileAchievements.jsx - ARVDOUL Profile Achievements Summary
 *
 * Institutional summary of a citizen's earned milestones. Every entry is a real
 * item returned by the canonical `achievementService.getUserAchievements`
 * (via `profileStore.achievements`). The count is the length of that
 * authoritative array - never an invented total, rarity, or completion figure.
 *
 * An entry without a real label is omitted rather than rendered as a blank chip.
 *
 * @component
 */

import React, { memo, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { cn } from '../../lib/utils';
import { Award, ArrowRight, Trophy } from 'lucide-react';

const MAX_VISIBLE = 8;

const ProfileAchievements = memo(({
  achievements = [],
  isOwner = false,
  showLink = true,
  theme = 'light',
}) => {
  const navigate = useNavigate();
  const isDark = theme === 'dark';

  // Achievements are catalog-backed (`title`) or user-doc-backed (`name`).
  // An entry with neither label is omitted rather than rendered as an empty chip.
  const labelled = useMemo(
    () => (Array.isArray(achievements) ? achievements : []).filter(
      (a) => typeof a?.title === 'string' || typeof a?.name === 'string',
    ),
    [achievements],
  );

  if (labelled.length === 0) return null;

  const visible = labelled.slice(0, MAX_VISIBLE);
  const overflow = labelled.length - visible.length;

  return (
    <section
      aria-label="Earned achievements"
      className={cn(
        'w-full rounded-2xl border p-5 shadow-sm transition-all',
        isDark
          ? 'bg-arvdoul-bg-elevated border-slate-800 text-white'
          : 'bg-white border-slate-200 text-slate-900',
      )}
    >
      <div className="flex items-center justify-between gap-3 mb-3">
        <h3 className="text-sm font-bold flex items-center gap-2">
          <Trophy className="w-4 h-4 text-amber-500" aria-hidden="true" />
          Achievements
          <span className="text-[11px] font-mono px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-300">
            {labelled.length}
          </span>
        </h3>
        {showLink && (
          <button
            type="button"
            onClick={() => navigate('/achievements')}
            className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
            aria-label={isOwner ? 'Open your achievements' : 'Open achievements'}
          >
            <span>All</span>
            <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
          </button>
        )}
      </div>

      <ul className="flex flex-wrap gap-2">
        {visible.map((achievement) => (
          <li
            key={achievement.id || achievement.title || achievement.name}
            className={cn(
              'inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium',
              'bg-arvdoul-gradient text-white',
            )}
            title={achievement.description || undefined}
          >
            <Award className="w-3 h-3" aria-hidden="true" />
            {achievement.title || achievement.name}
          </li>
        ))}
        {overflow > 0 && (
          <li className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-300">
            +{overflow} more
          </li>
        )}
      </ul>
    </section>
  );
});

ProfileAchievements.displayName = 'ProfileAchievements';
export default ProfileAchievements;
