import PropTypes from "prop-types";
import React, { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Home, PlayCircle, MessageCircle, UserPlus, Bell } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { FaCoins } from "react-icons/fa";
import { useTheme } from "@context/ThemeContext";
import { useSound } from "../../hooks/useSound";
import { useAnalytics } from "../../hooks/useAnalytics";
import { cn } from "../../lib/utils";
import { useAppStore } from "../../store/appStore";

export default function BottomNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const { theme } = useTheme();
  const { playSound } = useSound();
  const { track } = useAnalytics();
  const { unreadCounts = {}, currentUser } = useAppStore();

  const [activeTab, setActiveTab] = useState(location.pathname);
  const [showNav, setShowNav] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);

  const tabs = [
    { to: "/home", label: "Home", icon: Home, notification: false },
    { to: "/videos", label: "Videos", icon: PlayCircle, notification: false },
    { to: "/messages", label: "Messages", icon: MessageCircle, notification: true },
    { to: "/requests", label: "Requests", icon: UserPlus, notification: true },
    {
      to: "/coins",
      label: "Coins",
      icon: FaCoins,
      notification: false,
      custom: (
        <div className="relative flex flex-col items-center justify-center">
          <FaCoins className="w-6 h-6 text-yellow-400" />
          <span className="text-[8px] mt-0.5 font-bold text-yellow-400">
            {currentUser?.coins || 0}
          </span>
        </div>
      ),
    },
    { to: "/notifications", label: "Alerts", icon: Bell, notification: true },
    {
      to: "/profile",
      label: "Profile",
      notification: false,
      custom: (
        <div className="relative">
          <img
            src={currentUser?.photoURL || "/assets/default-profile.png"}
            alt="Profile"
            className="w-6 h-6 rounded-full border-2 border-primary"
          />
          {currentUser?.isOnline && (
            <span className="absolute bottom-0 right-0 w-2 h-2 bg-green-500 rounded-full border border-white animate-pulse" />
          )}
        </div>
      ),
    },
  ];

  \/\/ -------------------- Scroll Hide/Show --------------------
  useEffect(() => {
    const handleScroll = () => {
      const currentY = window.scrollY;
      if (currentY < 50 || currentY < lastScrollY) setShowNav(true);
      else if (currentY > lastScrollY + 10) setShowNav(false);
      setLastScrollY(currentY);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [lastScrollY]);

  \/\/ -------------------- Analytics --------------------
  useEffect(() => {
    track("BottomNav_Interaction", { tab: activeTab });
  }, [activeTab, track]);

  const handleNavigation = (to) => {
    if (location.pathname === to) window.scrollTo({ top: 0, behavior: "smooth" });
    else {
      playSound("nav_click");
      setActiveTab(to);
      navigate(to);
    }
  };

  return (
    <AnimatePresence>
      {showNav && (
        <motion.nav
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ type: "spring", damping: 20, stiffness: 300 }}
          className={cn(
            "fixed bottom-0 z-50 w-full border-t px-1 shadow-xl backdrop-blur-lg supports-backdrop-blur:bg-opacity-90",
            theme === "dark"
              ? "bg-gray-900/95 text-white border-gray-800"
              : "bg-white/95 text-gray-900 border-gray-200",
          )}
        >
          <div className="grid grid-cols-7 md:grid-cols-7 items-center relative">
            {tabs.map(({ to, label, icon: Icon, notification, custom }) => {
              const isActive = activeTab === to;
              const unreadCount = unreadCounts[to.replace("/", "")] || 0;

              return (
                <motion.button
                  key={to}
                  onClick={() => handleNavigation(to)}
                  whileTap={{ scale: 0.95 }}
                  className="flex flex-col items-center justify-center py-2 relative focus:outline-none"
                  aria-label={label}
                  type="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === "Enter" && handleNavigation(to)}
                >
                  <div className="relative">
                    {custom || (
                      <Icon
                        className={cn(
                          "w-6 h-6 transition-all duration-300",
                          isActive ? "text-primary fill-primary/20" : "text-muted-foreground"
                        )}
                      />
                    )}

                    {notification && unreadCount > 0 && (
                      <motion.span
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className={cn(
                          "absolute -top-1 -right-1 flex items-center justify-center rounded-full text-xs font-bold",
                          theme === "dark"
                            ? "bg-red-500 text-white"
                            : "bg-red-600 text-white",
                          unreadCount > 99
                            ? "w-6 h-6 text-[9px]"
                            : unreadCount > 9
                            ? "w-5 h-5 text-[10px]"
                            : "w-4 h-4",
                        )}
                      >
                        {unreadCount > 99 ? "99+" : unreadCount > 9 ? "9+" : unreadCount}
                      </motion.span>
                    )}
                  </div>

                  <span
                    className={cn(
                      "text-[10px] mt-0.5 transition-all duration-300",
                      isActive ? "text-primary font-semibold" : "text-muted-foreground"
                    )}
                  >
                    {label}
                  </span>

                  {isActive && (
                    <motion.div
                      layoutId="bottomNavActiveIndicator"
                      className="absolute top-0 left-0 right-0 h-1 bg-primary rounded-t-full"
                      transition={{ type: "spring", stiffness: 300, damping: 30 }}
                    />
                  )}
                </motion.button>
              );
            })}
          </div>
        </motion.nav>
      )}
    </AnimatePresence>
  );
}

BottomNav.propTypes = {};