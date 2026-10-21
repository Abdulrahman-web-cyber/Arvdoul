// src/components/profile/ProfileViewAsBanner.jsx
//
// Persistent floating banner for View As perspective simulation.
// Adheres strictly to Zero-Pill discipline, heraldic dignity, and reactive state management.

import React, { memo } from 'react';
import { Eye, Users, UserCheck, ShieldCheck, X, Sparkles } from 'lucide-react';
import { cn } from '../../lib/utils';

const PERSPECTIVE_OPTIONS = [
  { id: 'public', label: 'Public Visitor', icon: Users },
  { id: 'follower', label: 'Follower', icon: UserCheck },
  { id: 'connection', label: 'Mutual Friend', icon: ShieldCheck },
];

export const ProfileViewAsBanner = memo(({
  viewAs = 'public',
  onViewAsChange,
  onExit,
  theme = 'dark',
}) => {
  if (viewAs === 'owner') return null;

  const currentOption = PERSPECTIVE_OPTIONS.find((p) => p.id === viewAs) || PERSPECTIVE_OPTIONS[0];

  return (
    <aside
      aria-label="Perspective preview indicator"
      className="fixed bottom-5 inset-x-3 sm:inset-x-6 z-50 max-w-2xl mx-auto animate-in slide-in-from-bottom-5 duration-200"
    >
      <div className={cn(
        "relative rounded-2xl p-3 sm:p-4 border backdrop-blur-2xl shadow-2xl transition-all",
        "bg-[#080d1a]/95 text-white border-amber-500/40 shadow-black/60",
        "flex flex-col sm:flex-row items-center justify-between gap-3"
      )}>
        {/* Glow accent hairline */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-amber-400/60 to-transparent"
        />

        {/* Perspective Status Indicator */}
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="relative shrink-0 w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-300 flex items-center justify-center">
            <Eye className="w-5 h-5 animate-pulse" />
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-amber-400 ring-2 ring-[#080d1a] animate-ping" />
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-amber-400 ring-2 ring-[#080d1a]" />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono uppercase tracking-widest font-black text-amber-400">
                View As Active
              </span>
              <span className="text-slate-500">·</span>
              <span className="text-xs font-bold text-white truncate">
                {currentOption.label}
              </span>
            </div>
            <p className="text-[11px] text-slate-400 leading-tight truncate">
              Previewing exact profile & privacy boundaries
            </p>
          </div>
        </div>

        {/* Perspective Switcher Buttons & Exit Action */}
        <div className="flex items-center justify-between sm:justify-end gap-2 w-full sm:w-auto shrink-0">
          {/* Quick Perspective Toggles */}
          <div className="flex items-center bg-white/[0.06] p-1 rounded-xl border border-white/10 gap-1">
            {PERSPECTIVE_OPTIONS.map((opt) => {
              const Icon = opt.icon;
              const isSelected = viewAs === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => onViewAsChange?.(opt.id)}
                  className={cn(
                    "flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer",
                    isSelected
                      ? "bg-amber-500 text-slate-950 shadow-sm"
                      : "text-slate-300 hover:text-white hover:bg-white/[0.05]"
                  )}
                  title={`Switch to ${opt.label}`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span className="hidden md:inline">{opt.label.split(' ')[0]}</span>
                </button>
              );
            })}
          </div>

          {/* Instant Exit Button */}
          <button
            type="button"
            onClick={onExit}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider bg-rose-600/90 hover:bg-rose-500 text-white shadow-md active:scale-95 transition-all cursor-pointer shrink-0"
            title="Exit View As and return to Owner View"
          >
            <X className="w-3.5 h-3.5" />
            <span>Exit</span>
          </button>
        </div>
      </div>
    </aside>
  );
});

ProfileViewAsBanner.displayName = 'ProfileViewAsBanner';
export default ProfileViewAsBanner;
