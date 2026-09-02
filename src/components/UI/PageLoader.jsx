// src/components/UI/PageLoader.jsx - World-class page transition loader
import React, { memo } from 'react';
import { motion } from 'framer-motion';

export const PageLoader = memo(({ label = "Loading Arvdoul...", fullScreen = false }) => {
  return (
    <div 
      className={`relative w-full flex flex-col items-center justify-center select-none ${
        fullScreen ? 'fixed inset-0 z-50 bg-[#060810]/95 backdrop-blur-xl' : 'min-h-[50vh] py-16'
      }`}
      role="status"
      aria-label={label}
    >
      {/* Top-edge ambient glowing progress line */}
      <div className="fixed top-0 left-0 right-0 h-[2.5px] z-[100] overflow-hidden bg-transparent pointer-events-none">
        <div className="h-full w-full bg-gradient-to-r from-transparent via-violet-500 to-fuchsia-500 animate-pulse" />
        <div 
          className="absolute top-0 bottom-0 w-1/3 bg-gradient-to-r from-violet-400 via-fuchsia-400 to-cyan-400 shadow-[0_0_12px_rgba(168,85,247,0.8)]"
          style={{
            animation: 'shimmerSlide 1.2s cubic-bezier(0.4, 0, 0.2, 1) infinite'
          }}
        />
      </div>

      {/* Center refined brand badge & soft ambient glow */}
      <motion.div
        initial={{ opacity: 0, scale: 0.92 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.25, ease: "easeOut" }}
        className="flex flex-col items-center gap-4 text-center px-4"
      >
        <div className="relative">
          {/* Subtle ambient pulse ring */}
          <div className="absolute -inset-2 rounded-2xl bg-gradient-to-tr from-violet-600/30 to-fuchsia-600/30 blur-lg animate-pulse" />
          
          <div className="relative w-14 h-14 rounded-2xl bg-gradient-to-tr from-violet-600 via-indigo-600 to-fuchsia-600 p-[1.5px] shadow-2xl shadow-violet-500/20">
            <div className="w-full h-full rounded-[14px] bg-[#0c0d19] flex items-center justify-center overflow-hidden">
              <span className="text-xl font-black tracking-tighter bg-gradient-to-r from-violet-200 via-fuchsia-100 to-white bg-clip-text text-transparent">
                A
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-ping" />
          <span className="text-xs font-semibold tracking-wider uppercase text-gray-400 dark:text-gray-400">
            {label}
          </span>
        </div>
      </motion.div>

      <style>{`
        @keyframes shimmerSlide {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(350%); }
        }
      `}</style>
    </div>
  );
});

PageLoader.displayName = 'PageLoader';
export default PageLoader;
