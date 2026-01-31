// src/screens/SplashScreen.jsx - EMERGENCY WORKING VERSION
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";

export default function SplashScreen() {
  const navigate = useNavigate();
  const [visible, setVisible] = useState(true);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState("Starting Arvdoul...");

  useEffect(() => {
    console.log("🚀 SplashScreen mounted");
    
    // Simple progress animation
    const interval = setInterval(() => {
      setProgress(prev => {
        const newProgress = prev + 2;
        
        // Update status based on progress
        if (newProgress < 30) setStatus("Initializing...");
        else if (newProgress < 60) setStatus("Loading modules...");
        else if (newProgress < 90) setStatus("Almost ready...");
        else setStatus("Welcome!");
        
        if (newProgress >= 100) {
          clearInterval(interval);
          setTimeout(() => {
            setVisible(false);
            setTimeout(() => {
              navigate("/intro", { replace: true });
            }, 300);
          }, 500);
          return 100;
        }
        return newProgress;
      });
    }, 40);

    return () => clearInterval(interval);
  }, [navigate]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-gradient-to-br from-gray-900 to-black"
        >
          {/* Animated background */}
          <div className="absolute inset-0 overflow-hidden">
            {[...Array(20)].map((_, i) => (
              <motion.div
                key={i}
                className="absolute rounded-full bg-blue-500/10"
                style={{
                  width: `${Math.random() * 100 + 50}px`,
                  height: `${Math.random() * 100 + 50}px`,
                  left: `${Math.random() * 100}%`,
                  top: `${Math.random() * 100}%`,
                }}
                animate={{
                  scale: [1, 1.5, 1],
                  opacity: [0.1, 0.3, 0.1],
                }}
                transition={{
                  duration: Math.random() * 3 + 2,
                  repeat: Infinity,
                  delay: i * 0.1,
                }}
              />
            ))}
          </div>

          {/* Main content */}
          <div className="relative z-10 text-center px-6">
            {/* Logo */}
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 200 }}
              className="mb-8"
            >
              <div className="w-28 h-28 mx-auto rounded-full bg-gradient-to-r from-blue-600 to-purple-600 p-1.5">
                <div className="w-full h-full rounded-full bg-gray-900 flex items-center justify-center">
                  <div className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400">
                    A
                  </div>
                </div>
              </div>
            </motion.div>

            {/* App Name */}
            <motion.h1
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="text-5xl font-bold mb-4 text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400"
            >
              Arvdoul
            </motion.h1>

            {/* Status */}
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="text-lg text-gray-300 mb-6"
            >
              {status}
            </motion.p>

            {/* Spinner */}
            <div className="mb-8 flex justify-center">
              <div className="w-12 h-12 rounded-full border-4 border-blue-500/30 border-t-blue-500 animate-spin" />
            </div>

            {/* Progress Bar */}
            <div className="w-64 mx-auto mb-2">
              <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-gradient-to-r from-blue-500 to-purple-500"
                  initial={{ width: "0%" }}
                  animate={{ width: `${progress}%` }}
                  transition={{ type: "tween" }}
                />
              </div>
              <div className="text-sm text-gray-400 mt-2">{progress}%</div>
            </div>

            {/* Tagline */}
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="text-gray-500 text-sm mt-8"
            >
              Crafted for Visionaries • Engineered for Communities
            </motion.p>

            {/* Footer */}
            <div className="absolute bottom-6 left-0 right-0 text-center text-xs text-gray-600">
              © {new Date().getFullYear()} Arvdoul • v1.0
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
