// src/screens/SplashScreen.jsx
import React, { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useTheme } from "@context/ThemeContext";
import { motion, AnimatePresence } from "framer-motion";
import LoadingSpinner from "@components/Shared/LoadingSpinner";

export default function SplashScreen() {
  const navigate = useNavigate();
  const { theme, systemTheme } = useTheme();
  const resolvedTheme = theme === "system" ? systemTheme : theme;

  const [visible, setVisible] = useState(true);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [appStatus, setAppStatus] = useState("Initializing...");
  const progressRef = useRef(null);

  const logoSrc = resolvedTheme === "dark" 
    ? "/logo/logo-dark.png" 
    : "/logo/logo-light.png";

  // Enhanced loading simulation with realistic steps
  useEffect(() => {
    const steps = [
      { progress: 20, status: "Loading core services..." },
      { progress: 45, status: "Initializing authentication..." },
      { progress: 70, status: "Preparing your experience..." },
      { progress: 85, status: "Almost ready..." },
      { progress: 100, status: "Welcome!" }
    ];

    let currentStep = 0;
    
    const progressInterval = setInterval(() => {
      if (currentStep < steps.length) {
        setLoadingProgress(steps[currentStep].progress);
        setAppStatus(steps[currentStep].status);
        currentStep++;
      } else {
        clearInterval(progressInterval);
      }
    }, 500);

    // Enhanced exit sequence
    const exitTimer = setTimeout(() => {
      setVisible(false);
      setTimeout(() => navigate("/intro", { replace: true }), 800);
    }, 3500);

    return () => {
      clearInterval(progressInterval);
      clearTimeout(exitTimer);
    };
  }, [navigate]);

  // Progressive background gradient based on loading
  const backgroundGradient = `radial-gradient(circle at 50% 50%, 
    ${resolvedTheme === "dark" 
      ? `rgba(15, 23, 42, ${0.8 + loadingProgress * 0.002}) 0%, 
         rgba(2, 6, 23, ${0.9 + loadingProgress * 0.001}) 100%`
      : `rgba(248, 250, 252, ${0.8 + loadingProgress * 0.002}) 0%, 
         rgba(226, 232, 240, ${0.9 + loadingProgress * 0.001}) 100%`
    })`;

  // Floating particles for enhanced visual appeal
  const FloatingParticles = () => (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {[...Array(15)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute rounded-full"
          style={{
            width: Math.random() * 6 + 2,
            height: Math.random() * 6 + 2,
            top: `${Math.random() * 100}%`,
            left: `${Math.random() * 100}%`,
            background: resolvedTheme === "dark" 
              ? "rgba(99, 102, 241, 0.4)" 
              : "rgba(79, 70, 229, 0.3)",
          }}
          animate={{
            y: [0, -30, 0],
            opacity: [0.3, 0.8, 0.3],
            scale: [1, 1.2, 1],
          }}
          transition={{
            duration: Math.random() * 4 + 3,
            repeat: Infinity,
            ease: "easeInOut",
            delay: Math.random() * 2,
          }}
        />
      ))}
    </div>
  );

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="splash"
          className="fixed inset-0 flex flex-col items-center justify-center z-50 overflow-hidden"
          style={{ background: backgroundGradient }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ 
            opacity: 0,
            transition: { duration: 0.8, ease: "easeInOut" }
          }}
        >
          <FloatingParticles />
          
          {/* Main Content Container */}
          <motion.div
            className="flex flex-col items-center justify-center text-center"
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ 
              duration: 0.6, 
              type: "spring", 
              stiffness: 200, 
              damping: 20 
            }}
          >
            {/* Enhanced Logo Animation */}
            <motion.div
              initial={{ 
                opacity: 0, 
                scale: 0.8,
                rotateY: -180 
              }}
              animate={{ 
                opacity: 1, 
                scale: 1,
                rotateY: 0 
              }}
              transition={{ 
                duration: 1.2,
                type: "spring",
                stiffness: 160,
                damping: 15
              }}
              className="relative mb-8"
            >
              {/* Glow effect */}
              <motion.div
                className="absolute inset-0 rounded-full blur-xl opacity-50"
                style={{
                  background: resolvedTheme === "dark"
                    ? "linear-gradient(45deg, #6366f1, #8b5cf6)"
                    : "linear-gradient(45deg, #4f46e5, #7c3aed)",
                }}
                animate={{
                  scale: [1, 1.1, 1],
                  opacity: [0.3, 0.6, 0.3],
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
              />
              
              <div className="relative w-32 h-32 rounded-2xl overflow-hidden shadow-2xl ring-2 ring-white/10 bg-white dark:bg-gray-900">
                <img
                  src={logoSrc}
                  alt="Arvdoul Logo"
                  className="w-full h-full object-contain p-4 select-none"
                  draggable="false"
                  onError={(e) => {
                    e.target.src = "/logo/logo-default.png";
                  }}
                />
              </div>
            </motion.div>

            {/* Enhanced Title */}
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.8 }}
              className="text-4xl font-bold mb-2 text-gray-800 dark:text-gray-100 tracking-tight drop-shadow-sm"
            >
              Arvdoul
            </motion.h1>

            {/* Status Text */}
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5, duration: 0.6 }}
              className="text-sm text-gray-600 dark:text-gray-400 mb-6 min-h-[20px] font-medium"
            >
              {appStatus}
            </motion.p>

            {/* Enhanced Progress Bar */}
            <motion.div
              initial={{ opacity: 0, width: 0 }}
              animate={{ opacity: 1, width: "200px" }}
              transition={{ delay: 0.7, duration: 0.5 }}
              className="w-48 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden mb-8"
            >
              <motion.div
                className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-purple-600"
                initial={{ width: "0%" }}
                animate={{ width: `${loadingProgress}%` }}
                transition={{ 
                  duration: 0.3,
                  ease: "easeOut"
                }}
              />
            </motion.div>

            {/* Enhanced Loading Spinner */}
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ 
                delay: 0.9, 
                duration: 0.6,
                repeat: Infinity,
                repeatType: "reverse",
                repeatDelay: 0.5
              }}
            >
              <LoadingSpinner
                size={48}
                color={resolvedTheme === "dark" ? "#818cf8" : "#6366f1"}
                thickness={2.5}
              />
            </motion.div>

            {/* Subtle Branding */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.2, duration: 0.6 }}
              className="mt-8 text-xs text-gray-500 dark:text-gray-500 font-medium tracking-wide"
            >
              Crafted for Creators • Built for Communities
            </motion.div>
          </motion.div>

          {/* Background Pattern */}
          <div className="absolute inset-0 opacity-10 pointer-events-none">
            <div className="absolute top-1/4 left-1/4 w-2 h-2 rounded-full bg-indigo-500"></div>
            <div className="absolute top-3/4 right-1/4 w-1 h-1 rounded-full bg-purple-500"></div>
            <div className="absolute bottom-1/3 left-1/3 w-1.5 h-1.5 rounded-full bg-pink-500"></div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}