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
 * TopAppLoadingBanner - Unobtrusive, sleek banner at the top of the App
 * Appears ONLY while loading without covering entire screens or blocking user interactions.
 */
export const TopAppLoadingBanner = ({ isAnimating = true, label = null }) => {
  const [progress, setProgress] = useState(25);

  useEffect(() => {
    if (!isAnimating) return;
    const timer1 = setTimeout(() => setProgress(55), 150);
    const timer2 = setTimeout(() => setProgress(80), 400);
    const timer3 = setTimeout(() => setProgress(92), 900);
    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
    };
  }, [isAnimating]);

  if (!isAnimating) return null;

  return (
    <div 
      className="fixed top-0 left-0 right-0 z-[99999] pointer-events-none flex flex-col items-center select-none"
      role="status"
      aria-label={label || "Loading"}
    >
      {/* 3px Ultra-crisp animated glowing progress bar */}
      <div className="w-full h-[3px] bg-black/5 dark:bg-white/5 overflow-hidden">
        <motion.div
          initial={{ width: '0%', opacity: 0 }}
          animate={{ width: `${progress}%`, opacity: 1 }}
          exit={{ width: '100%', opacity: 0 }}
          transition={{ ease: [0.16, 1, 0.3, 1], duration: 0.35 }}
          className="h-full bg-gradient-to-r from-violet-600 via-fuchsia-500 to-cyan-400 shadow-[0_0_12px_rgba(168,85,247,0.7)]"
        />
      </div>

      {/* Floating subtle indicator pill - compact and unobtrusive */}
      {label && (
        <div className="mt-2 px-3 py-1 rounded-full bg-black/80 dark:bg-[#0c1426]/90 text-white text-[11px] font-medium shadow-lg backdrop-blur-md flex items-center gap-2 border border-white/10">
          <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse" />
          <span>{label}</span>
        </div>
      )}
    </div>
  );
};

/**
 * RouteSkeletonShell - Ambient placeholder that displays ONLY the top progress banner,
 * strictly never covering the entire screen or rendering fake card/video skeletons.
 */
export const RouteSkeletonShell = ({ variant = 'default' }) => {
  return <TopAppLoadingBanner isAnimating={true} />;
};

export default RouteProgressBar;
