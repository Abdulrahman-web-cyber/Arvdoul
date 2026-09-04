// src/components/Navigation/RouteProgressBar.jsx
// World-class, ultra-fine top progress bar for background route transitions & data fetching
// Inspired by Linear, Vercel, YouTube, and GitHub

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * RouteProgressBar - Mounts an unobtrusive glowing gradient line at the top of the screen
 * during route lazy-loading or background tasks.
 */
export const RouteProgressBar = ({ isAnimating = true }) => {
  const [progress, setProgress] = useState(25);

  useEffect(() => {
    if (!isAnimating) return;

    // Simulate natural browser progress acceleration
    const timer1 = setTimeout(() => setProgress(55), 150);
    const timer2 = setTimeout(() => setProgress(80), 400);
    const timer3 = setTimeout(() => setProgress(92), 900);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
    };
  }, [isAnimating]);

  return (
    <div className="fixed top-0 left-0 right-0 z-[99999] pointer-events-none h-[2.5px] overflow-hidden">
      <motion.div
        initial={{ width: '0%', opacity: 0 }}
        animate={{ width: `${progress}%`, opacity: 1 }}
        exit={{ width: '100%', opacity: 0 }}
        transition={{ ease: [0.16, 1, 0.3, 1], duration: 0.35 }}
        className="h-full bg-gradient-to-r from-violet-600 via-fuchsia-500 to-cyan-400 shadow-[0_0_12px_rgba(168,85,247,0.7)]"
      />
    </div>
  );
};

/**
 * RouteSkeletonShell - Ambient skeleton displayed inside Suspense fallback
 * without disturbing page geometry or flashing jarring centered spinners.
 */
export const RouteSkeletonShell = ({ variant = 'default' }) => {
  return (
    <div className="w-full min-h-[70vh] flex flex-col pointer-events-none select-none animate-pulse">
      <RouteProgressBar isAnimating={true} />
      
      {variant === 'feed' || variant === 'default' ? (
        <div className="max-w-2xl mx-auto w-full px-4 py-6 space-y-6">
          {/* Top header skeleton bar */}
          <div className="flex items-center justify-between">
            <div className="w-32 h-6 rounded-xl bg-gray-200 dark:bg-white/10" />
            <div className="flex gap-2">
              <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-white/10" />
              <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-white/10" />
            </div>
          </div>

          {/* Card skeleton 1 */}
          <div className="p-5 rounded-3xl bg-white/60 dark:bg-white/[0.03] border border-black/5 dark:border-white/5 space-y-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-white/10" />
              <div className="space-y-1.5 flex-1">
                <div className="w-28 h-3.5 rounded-lg bg-gray-200 dark:bg-white/10" />
                <div className="w-16 h-2.5 rounded-lg bg-gray-200 dark:bg-white/5" />
              </div>
            </div>
            <div className="h-40 rounded-2xl bg-gray-200/70 dark:bg-white/[0.05]" />
            <div className="flex justify-between pt-2">
              <div className="w-20 h-4 rounded-lg bg-gray-200 dark:bg-white/10" />
              <div className="w-16 h-4 rounded-lg bg-gray-200 dark:bg-white/10" />
            </div>
          </div>

          {/* Card skeleton 2 */}
          <div className="p-5 rounded-3xl bg-white/60 dark:bg-white/[0.03] border border-black/5 dark:border-white/5 space-y-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-white/10" />
              <div className="space-y-1.5 flex-1">
                <div className="w-36 h-3.5 rounded-lg bg-gray-200 dark:bg-white/10" />
                <div className="w-20 h-2.5 rounded-lg bg-gray-200 dark:bg-white/5" />
              </div>
            </div>
            <div className="h-28 rounded-2xl bg-gray-200/70 dark:bg-white/[0.05]" />
          </div>
        </div>
      ) : variant === 'video' ? (
        <div className="h-screen w-full bg-black flex flex-col justify-between p-6">
          <div className="flex justify-between items-center pt-2">
            <div className="w-24 h-6 rounded-full bg-white/10" />
            <div className="w-16 h-6 rounded-full bg-white/10" />
            <div className="w-8 h-8 rounded-full bg-white/10" />
          </div>
          <div className="flex items-end justify-between pb-16">
            <div className="space-y-3 max-w-[65%]">
              <div className="w-12 h-12 rounded-full bg-white/10" />
              <div className="w-36 h-4 rounded-lg bg-white/10" />
              <div className="w-48 h-3 rounded-lg bg-white/5" />
            </div>
            <div className="flex flex-col gap-4">
              <div className="w-10 h-10 rounded-full bg-white/10" />
              <div className="w-10 h-10 rounded-full bg-white/10" />
              <div className="w-10 h-10 rounded-full bg-white/10" />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default RouteProgressBar;
