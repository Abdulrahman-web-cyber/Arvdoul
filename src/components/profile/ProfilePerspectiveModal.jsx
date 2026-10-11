import React, { memo } from 'react';
import { Eye, ShieldCheck, UserCheck, Users, Lock, X, Check } from 'lucide-react';
import { cn } from '../../lib/utils';

const PERSPECTIVES = [
  {
    id: 'owner',
    title: 'Owner View',
    subtitle: 'Standard Master View',
    description: 'Full creator controls, private analytics, wallet balance, and editing tools.',
    icon: ShieldCheck,
    badgeColor: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
  },
  {
    id: 'public',
    title: 'Public Visitor',
    subtitle: 'World-Visible Perspective',
    description: 'How non-followers and public guests experience your profile and privacy boundaries.',
    icon: Users,
    badgeColor: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  },
  {
    id: 'follower',
    title: 'Follower Perspective',
    subtitle: 'Audience View',
    description: 'How your regular followers see your posts, presence status, and activity.',
    icon: UserCheck,
    badgeColor: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
  },
  {
    id: 'connection',
    title: 'Mutual Connection',
    subtitle: 'Close Friends & Peers',
    description: 'Experience granted to mutual friends with reciprocal social privileges.',
    icon: Eye,
    badgeColor: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
  },
];

export const ProfilePerspectiveModal = memo(({
  isOpen,
  onClose,
  currentPerspective = 'owner',
  onSelectPerspective,
  theme = 'dark',
}) => {
  if (!isOpen) return null;
  const isDark = theme === 'dark';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className={cn(
          "relative w-full max-w-md rounded-3xl overflow-hidden shadow-2xl border transition-all",
          isDark ? "bg-[#0d1424] border-white/10 text-white" : "bg-white border-slate-200 text-slate-900"
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className={cn(
          "px-6 py-5 border-b flex items-center justify-between",
          isDark ? "border-white/10 bg-white/[0.02]" : "border-slate-100 bg-slate-50/50"
        )}>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-purple-500/10 text-purple-500 flex items-center justify-center">
              <Eye className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold">View Profile As</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Preview how your identity appears to different audiences
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-slate-200 dark:hover:bg-white/10 text-slate-400 hover:text-slate-600 dark:hover:text-white transition cursor-pointer"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* List of perspectives */}
        <div className="p-4 sm:p-5 space-y-2.5">
          {PERSPECTIVES.map((item) => {
            const Icon = item.icon;
            const isSelected = currentPerspective === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  onSelectPerspective?.(item.id);
                  onClose();
                }}
                className={cn(
                  "w-full text-left p-3.5 rounded-2xl border transition-all flex items-start gap-3.5 group cursor-pointer",
                  isSelected
                    ? (isDark
                        ? "bg-purple-950/40 border-purple-500/50 shadow-md shadow-purple-950/40"
                        : "bg-purple-50 border-purple-300 shadow-sm")
                    : (isDark
                        ? "bg-white/[0.02] border-white/5 hover:bg-white/[0.05] hover:border-white/10"
                        : "bg-slate-50/60 border-slate-200/80 hover:bg-slate-100/80")
                )}
              >
                <div className={cn(
                  "p-2 rounded-xl shrink-0 mt-0.5 border transition-transform group-hover:scale-105",
                  item.badgeColor
                )}>
                  <Icon className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-slate-900 dark:text-white">
                      {item.title}
                    </span>
                    {isSelected && (
                      <span className="flex items-center gap-1 text-[11px] font-bold text-purple-600 dark:text-purple-400">
                        <Check className="w-3.5 h-3.5" />
                        Active
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">
                    {item.description}
                  </p>
                </div>
              </button>
            );
          })}
        </div>

        {/* Footer */}
        <div className={cn(
          "px-6 py-3.5 border-t text-center text-xs text-slate-500 dark:text-slate-400",
          isDark ? "border-white/10 bg-white/[0.01]" : "border-slate-100 bg-slate-50/30"
        )}>
          Simulations reflect real capability rules and privacy boundaries.
        </div>
      </div>
    </div>
  );
});

ProfilePerspectiveModal.displayName = 'ProfilePerspectiveModal';
export default ProfilePerspectiveModal;
