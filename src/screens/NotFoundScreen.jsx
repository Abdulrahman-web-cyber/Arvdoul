import React from 'react';
import { ArrowLeft, Compass, Home, Search, Film, MessageSquare } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../context/ThemeContext';
import { ARVDOUL_GRADIENT } from '../context/ThemeProvider';

/**
 * ARVDOUL 404 SCREEN — Design-system backed, theme-adaptive, accessible & world-class.
 */
export default function NotFoundScreen() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { isDark } = useTheme();

  const title = t('notFound.title', 'Page not found');
  const description = t('notFound.description', "The screen or cosmic realm you're looking for doesn't exist or has moved.");
  const goHome = t('notFound.goHome', 'Back to Home');

  return (
    <main
      id="not-found-screen"
      role="main"
      aria-labelledby="not-found-title"
      className={`min-h-screen flex flex-col items-center justify-center px-6 text-center transition-colors duration-300 relative overflow-hidden ${
        isDark
          ? 'bg-[#030614] text-white'
          : 'bg-gradient-to-b from-slate-50 via-purple-50/30 to-white text-slate-900'
      }`}
    >
      {/* Ambient background glows */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-96 h-96 bg-purple-600/15 rounded-full blur-3xl" />
        <div className="absolute -bottom-32 left-1/3 w-96 h-96 bg-blue-600/15 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 max-w-lg mx-auto flex flex-col items-center">
        {/* Glow Badge */}
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-600 dark:text-purple-400 text-xs font-bold uppercase tracking-wider mb-6 shadow-sm">
          <Compass className="w-3.5 h-3.5" />
          <span>Cosmic Anomaly</span>
        </div>

        {/* 404 Display */}
        <h1
          id="not-found-title"
          className="text-8xl sm:text-9xl font-black tracking-tight mb-2 select-none"
          style={{
            backgroundImage: ARVDOUL_GRADIENT,
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}
        >
          404
        </h1>

        <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight mb-3">
          {title}
        </h2>
        
        <p className="text-sm sm:text-base text-slate-600 dark:text-gray-400 mb-8 max-w-md">
          {description}
        </p>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center justify-center gap-3 w-full max-w-sm mb-10">
          <Link
            to="/home"
            className="flex-1 min-w-[140px] px-6 py-3 rounded-2xl text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-purple-500/25 hover:opacity-95 hover:scale-[1.02] active:scale-[0.98] transition-all"
            style={{ background: ARVDOUL_GRADIENT }}
          >
            <Home className="w-4 h-4" />
            <span>{goHome}</span>
          </Link>

          <button
            type="button"
            onClick={() => navigate(-1)}
            className={`px-5 py-3 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 border transition-all hover:scale-[1.02] active:scale-[0.98] ${
              isDark
                ? 'bg-white/5 border-white/10 text-gray-200 hover:bg-white/10'
                : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50 shadow-sm'
            }`}
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Go Back</span>
          </button>
        </div>

        {/* Quick Links */}
        <div className="w-full pt-6 border-t border-slate-200/80 dark:border-white/10 flex items-center justify-center gap-6 text-xs font-semibold text-slate-500 dark:text-gray-400">
          <Link to="/search" className="flex items-center gap-1.5 hover:text-purple-600 dark:hover:text-purple-400 transition-colors">
            <Search className="w-3.5 h-3.5" />
            <span>Search</span>
          </Link>
          <Link to="/reels" className="flex items-center gap-1.5 hover:text-purple-600 dark:hover:text-purple-400 transition-colors">
            <Film className="w-3.5 h-3.5" />
            <span>Reels</span>
          </Link>
          <Link to="/messages" className="flex items-center gap-1.5 hover:text-purple-600 dark:hover:text-purple-400 transition-colors">
            <MessageSquare className="w-3.5 h-3.5" />
            <span>Messages</span>
          </Link>
        </div>
      </div>
    </main>
  );
}
