import PropTypes from 'prop-types';
import { useState, useEffect } from "react";
import { Moon, Sun, Monitor } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useTheme } from "@context/ThemeContext";
import { cn } from "../../lib/utils";

export default function ThemeToggle({ variant = "default" }) {
  const { theme, toggleTheme, systemTheme } = useTheme(); // <-- fixed systemTheme name
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) {
    return (
      <div
        className={cn(
          variant === "icon" ? "w-10 h-10" : "px-3 py-2",
          "rounded-xl border border-transparent",
        )}
      />
    );
  }

  // Determine actual applied theme (resolves 'system' to systemTheme)
  const currentTheme = theme === "system" ? systemTheme : theme;

  // Optional: function to get next theme (not currently used)
  const getNextTheme = (current) => {
    const cycle = ["light", "dark", "system"];
    const currentIndex = cycle.indexOf(current);
    return cycle[(currentIndex + 1) % cycle.length];
  };

  // Show icon based on actual applied theme
  const icon = {
    light: <Sun className="w-5 h-5" />,
    dark: <Moon className="w-5 h-5" />,
    system: <Monitor className="w-5 h-5" />,
  }[currentTheme];

  // Show label based on user-selected theme
  const label = {
    light: "Light",
    dark: "Dark",
    system: "System",
  }[theme];

  const handleClick = () => {
    toggleTheme();
  };

  return (
    <motion.button
      onClick={handleClick}
      className={cn(
        "flex items-center justify-center gap-2 rounded-xl transition-all",
        "focus:outline-none focus:ring-2 focus:ring-primary/50 focus:ring-offset-2 dark:focus:ring-offset-gray-900",
        variant === "icon" ? "w-10 h-10" : "px-3 py-2",
        variant === "icon"
          ? "hover:bg-gray-100 dark:hover:bg-white/10"
          : "border hover:bg-gray-100 dark:hover:bg-white/10",
        variant === "icon" ? "" : "border-gray-300 dark:border-gray-700",
        "text-gray-700 dark:text-gray-300",
      )}
      aria-label={`Toggle theme, current: ${label}`}
      type="button"
    >
      <AnimatePresence mode="wait">
        <motion.div
          key={theme}
          initial={{ opacity: 0, rotate: -45 }}
          animate={{ opacity: 1, rotate: 0 }}
          exit={{ opacity: 0, rotate: 45 }}
          transition={{ duration: 0.2 }}
        >
          {icon}
        </motion.div>
      </AnimatePresence>

      {variant !== "icon" && (
        <motion.span
          initial={{ opacity: 0, x: 10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 }}
        >
          {label}
        </motion.span>
      )}
    </motion.button>
  );
}
