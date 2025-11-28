import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTheme } from "@context/ThemeContext";
import { motion, AnimatePresence } from "framer-motion";
import LoadingSpinner from "@components/Shared/LoadingSpinner";

export default function SplashScreen() {
  const navigate = useNavigate();
  const { theme, systemTheme } = useTheme();
  const resolvedTheme = theme === "system" ? systemTheme : theme;

  const [visible, setVisible] = useState(true);

  const logoSrc =
    resolvedTheme === "dark" ? "/logo/logo-dark.png" : "/logo/logo-light.png";

  useEffect(() => {
    // Show splash for exactly 2.5 seconds
    const timer = setTimeout(() => {
      setVisible(false); // trigger exit animation
      setTimeout(() => navigate("/intro"), 600); // navigate after fade out
    }, 2500);

    return () => clearTimeout(timer);
  }, [navigate]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="splash"
          className="fixed inset-0 flex flex-col items-center justify-center bg-white dark:bg-gray-950 transition-colors duration-500 z-50"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.6 }}
        >
          {/* Logo */}
          <motion.div
            initial={{ opacity: 0, scale: 0.7 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{
              duration: 0.9,
              type: "spring",
              stiffness: 280,
              damping: 22,
            }}
            className="w-40 h-40 rounded-full overflow-hidden mb-6 shadow-xl"
          >
            <img
              src={logoSrc}
              alt="Arvdoul Logo"
              className="w-full h-full object-contain select-none"
              draggable="false"
            />
          </motion.div>

          {/* Title */}
          <motion.h1
            initial={{ opacity: 0, y: 25 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.7 }}
            className="text-3xl font-bold mb-6 text-gray-800 dark:text-gray-100 tracking-wide drop-shadow-sm"
          >
            Arvdoul
          </motion.h1>

          {/* Spinner */}
          <motion.div
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{
              delay: 0.7,
              duration: 0.6,
              repeat: Infinity,
              repeatType: "reverse",
            }}
          >
            <LoadingSpinner
              size={55}
              color={resolvedTheme === "dark" ? "#818cf8" : "#6366f1"}
            />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
