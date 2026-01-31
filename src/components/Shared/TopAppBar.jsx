import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
  memo
} from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useSound } from "../../hooks/useSound.js";
import { useAnalytics } from "../../hooks/useAnalytics.js";
import { useTheme } from "../../context/ThemeContext";
import { cn } from "../../lib/utils.js";
import { Search, Menu, X, ChevronLeft, Sparkles, Home, Bell } from "lucide-react";
import { useAppStore } from "../../store/appStore";

// Animation config matching BottomNav
const ANIMATION_CONFIG = {
  spring: { type: "spring", damping: 25, stiffness: 300, mass: 0.8 },
  panelSpring: { type: "spring", damping: 35, stiffness: 400, mass: 0.9 },
  fastSpring: { type: "spring", damping: 20, stiffness: 400 }
};

// Get theme colors matching BottomNav
const getThemeColors = (theme) => ({
  navBg: theme === "dark" 
    ? "bg-gradient-to-b from-gray-900/98 via-gray-900/98 to-gray-800/98" 
    : "bg-gradient-to-b from-white/98 via-white/98 to-gray-50/98",
  border: theme === "dark" ? "border-gray-800/50" : "border-gray-300/50",
  text: theme === "dark" ? "text-white" : "text-gray-900",
  subtext: theme === "dark" ? "text-gray-300" : "text-gray-600",
  plusGradient: theme === "dark" ? "from-purple-500 via-pink-600 to-purple-700" : "from-orange-500 via-red-500 to-orange-600",
  handleGradient: theme === "dark" ? "from-purple-500/80 to-pink-600/80" : "from-orange-500/80 to-red-500/80",
  panelBg: theme === "dark" 
    ? "bg-gradient-to-b from-gray-900 via-gray-900 to-gray-800" 
    : "bg-gradient-to-b from-white via-gray-50 to-gray-100",
  cardBg: theme === "dark" ? "bg-gray-800/40" : "bg-white/60",
  cardBorder: theme === "dark" ? "border-gray-700/50" : "border-gray-300/50",
});

// Navigation paths
const NAVIGATION_PATHS = {
  home: "/home",
  search: "/SearchScreen.jsx",
  menu: "/MenuScreen.jsx",
  profile: "/profile",
  settings: "/settings"
};

// Perfect Circular Logo Component
const PerfectCircularLogo = memo(({ theme, onClick, isActive }) => {
  const [isHovered, setIsHovered] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const { playSound } = useSound();
  const { track } = useAnalytics();
  
  const handleClick = useCallback((e) => {
    e.preventDefault();
    playSound("nav_click");
    track("top_nav_logo_click", { theme, location: "top_bar" });
    onClick?.();
  }, [onClick, playSound, track, theme]);
  
  const logoUrl = theme === "dark" 
    ? "/logo/logo-dark.png" 
    : "/logo/logo-light.png";
  
  const fallbackLogo = (
    <div className={cn(
      "w-full h-full rounded-full flex items-center justify-center",
      "bg-gradient-to-br",
      theme === "dark" ? "from-purple-600 to-pink-600" : "from-orange-500 to-red-500"
    )}>
      <span className={cn(
        "text-lg font-bold",
        theme === "dark" ? "text-white" : "text-white"
      )}>
        A
      </span>
    </div>
  );
  
  return (
    <motion.button
      onClick={handleClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      whileTap={{ scale: 0.92 }}
      whileHover={{ scale: 1.08 }}
      transition={{
        scale: { type: "spring", stiffness: 400, damping: 15 },
        rotate: { duration: 0.2, ease: "easeInOut" }
      }}
      className={cn(
        "relative w-12 h-12 rounded-full",
        "focus:outline-none focus:ring-2 focus:ring-offset-2",
        isActive 
          ? theme === "dark" 
            ? "focus:ring-purple-500/50 focus:ring-offset-gray-900"
            : "focus:ring-orange-500/50 focus:ring-offset-white"
          : "focus:ring-transparent"
      )}
      aria-label="Arvdoul Home"
      aria-pressed={isActive}
    >
      {/* Outer glow ring on active/hover */}
      <div className={cn(
        "absolute -inset-1 rounded-full opacity-0 transition-opacity duration-300",
        isActive || isHovered ? "opacity-100" : "opacity-0",
        theme === "dark" 
          ? "bg-gradient-to-r from-purple-500/30 via-pink-500/30 to-purple-500/30" 
          : "bg-gradient-to-r from-orange-500/30 via-red-500/30 to-orange-500/30"
      )} />
      
      {/* Main container with perfect glassmorphism */}
      <div className={cn(
        "relative w-12 h-12 rounded-full",
        "flex items-center justify-center",
        "backdrop-blur-xl border-2",
        theme === "dark" 
          ? "bg-gray-900/80 border-gray-800/60" 
          : "bg-white/80 border-gray-300/60",
        "shadow-lg hover:shadow-xl transition-all duration-200",
        isActive && "ring-2 ring-offset-2",
        isActive 
          ? theme === "dark" 
            ? "ring-purple-500/40 ring-offset-gray-900" 
            : "ring-orange-500/40 ring-offset-white"
          : ""
      )}>
        {/* Inner glow effect */}
        <div className={cn(
          "absolute inset-1 rounded-full",
          "bg-gradient-to-br",
          theme === "dark" 
            ? "from-gray-800/50 via-gray-900/50 to-gray-800/50" 
            : "from-white/50 via-gray-50/50 to-white/50"
        )} />
        
        {/* Logo image with perfect circular fill */}
        <div className="relative w-10 h-10 rounded-full overflow-hidden">
          <motion.img
            src={logoUrl}
            alt="Arvdoul"
            className={cn(
              "w-full h-full object-cover",
              "transition-transform duration-200",
              isHovered && "scale-110"
            )}
            initial={{ opacity: 0 }}
            animate={{ opacity: isLoaded ? 1 : 0 }}
            transition={{ duration: 0.2 }}
            onLoad={() => setIsLoaded(true)}
            onError={(e) => {
              e.target.style.display = 'none';
              e.target.parentNode.appendChild(fallbackLogo);
            }}
          />
          {!isLoaded && fallbackLogo}
        </div>
        
        {/* Active indicator dot */}
        {isActive && (
          <motion.div
            layoutId="topNavLogoActive"
            className={cn(
              "absolute -bottom-1 left-1/2 transform -translate-x-1/2",
              "w-1.5 h-1.5 rounded-full",
              "bg-gradient-to-r",
              theme === "dark" 
                ? "from-purple-500 to-pink-500" 
                : "from-orange-500 to-red-500"
            )}
            transition={ANIMATION_CONFIG.fastSpring}
          />
        )}
      </div>
    </motion.button>
  );
});

PerfectCircularLogo.displayName = "PerfectCircularLogo";

// Perfect Circular Icon Component
const PerfectCircularIcon = memo(({ 
  icon: Icon, 
  onClick, 
  isActive = false,
  theme,
  label,
  variant = "default",
  showNotification = false,
  notificationCount = 0,
  isSearch = false
}) => {
  const [isPressed, setIsPressed] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const { playSound } = useSound();
  
  const handleClick = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    playSound("ui_click");
    onClick?.();
  }, [onClick, playSound]);
  
  return (
    <motion.button
      onClick={handleClick}
      onMouseDown={() => setIsPressed(true)}
      onMouseUp={() => setIsPressed(false)}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => {
        setIsHovered(false);
        setIsPressed(false);
      }}
      whileTap={{ scale: 0.92 }}
      whileHover={{ scale: 1.08 }}
      transition={ANIMATION_CONFIG.spring}
      className={cn(
        "relative w-12 h-12 rounded-full",
        "flex items-center justify-center",
        "backdrop-blur-xl border-2",
        "focus:outline-none focus:ring-2 focus:ring-offset-2",
        theme === "dark" 
          ? "bg-gray-900/80 border-gray-800/60 focus:ring-purple-500/50 focus:ring-offset-gray-900" 
          : "bg-white/80 border-gray-300/60 focus:ring-orange-500/50 focus:ring-offset-white",
        "shadow-lg hover:shadow-xl transition-all duration-200",
        isActive && "ring-2 ring-offset-2",
        isActive 
          ? theme === "dark" 
            ? "ring-purple-500/40 ring-offset-gray-900" 
            : "ring-orange-500/40 ring-offset-white"
          : ""
      )}
      aria-label={label}
      aria-pressed={isActive}
    >
      {/* Hover/Active glow */}
      {(isHovered || isActive) && (
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          className={cn(
            "absolute -inset-1 rounded-full blur-md -z-10",
            isSearch 
              ? theme === "dark" 
                ? "bg-gradient-to-r from-blue-500/20 to-cyan-500/20" 
                : "bg-gradient-to-r from-blue-400/20 to-cyan-400/20"
              : theme === "dark" 
                ? "bg-gradient-to-r from-purple-500/20 to-pink-500/20" 
                : "bg-gradient-to-r from-orange-500/20 to-red-500/20"
          )}
        />
      )}
      
      {/* Icon container */}
      <div className="relative flex items-center justify-center w-full h-full">
        <Icon className={cn(
          "w-5 h-5 transition-all duration-200",
          isActive 
            ? isSearch
              ? theme === "dark" 
                ? "text-blue-400" 
                : "text-blue-600"
              : theme === "dark" 
                ? "text-purple-400" 
                : "text-orange-500"
            : theme === "dark" 
              ? "text-gray-300" 
              : "text-gray-600",
          isHovered && "scale-110"
        )} />
        
        {/* Notification badge */}
        {showNotification && notificationCount > 0 && (
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className={cn(
              "absolute -top-1 -right-1 flex items-center justify-center rounded-full text-xs font-bold",
              "bg-gradient-to-br from-red-500 to-pink-600 text-white",
              "shadow-lg ring-2 ring-white/20",
              notificationCount > 99
                ? "w-6 h-6 text-[9px]"
                : notificationCount > 9
                ? "w-5 h-5 text-[10px]"
                : "w-4 h-4"
            )}
          >
            {notificationCount > 99 ? "99+" : notificationCount > 9 ? "9+" : notificationCount}
          </motion.span>
        )}
      </div>
      
      {/* Active indicator dot */}
      {isActive && (
        <motion.div
          layoutId={`topNavIconActive-${label}`}
          className={cn(
            "absolute -bottom-1 left-1/2 transform -translate-x-1/2",
            "w-1.5 h-1.5 rounded-full",
            isSearch
              ? theme === "dark" 
                ? "bg-gradient-to-r from-blue-400 to-cyan-400" 
                : "bg-gradient-to-r from-blue-500 to-cyan-500"
              : theme === "dark" 
                ? "bg-gradient-to-r from-purple-500 to-pink-500" 
                : "bg-gradient-to-r from-orange-500 to-red-500"
          )}
          transition={ANIMATION_CONFIG.fastSpring}
        />
      )}
    </motion.button>
  );
});

PerfectCircularIcon.displayName = "PerfectCircularIcon";

// Main TopAppBar Component
const TopAppBar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { theme } = useTheme();
  const { track } = useAnalytics();
  const { unreadCounts = {} } = useAppStore();
  
  // States
  const [isVisible, setIsVisible] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);
  
  // Theme colors
  const themeColors = useMemo(() => getThemeColors(theme), [theme]);
  
  // Handle scroll visibility - matches BottomNav logic
  useEffect(() => {
    let ticking = false;
    let lastScroll = 0;
    
    const handleScroll = () => {
      if (!ticking) {
        requestAnimationFrame(() => {
          const currentY = window.scrollY;
          const isScrollingUp = currentY < lastScroll;
          const isAtTop = currentY < 50;
          
          if (isAtTop || isScrollingUp) {
            setIsVisible(true);
          } else if (currentY > lastScroll + 30) {
            setIsVisible(false);
          }
          
          lastScroll = currentY;
          ticking = false;
        });
        ticking = true;
      }
    };
    
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);
  
  // Navigation handlers - simple navigation to screens
  const handleLogoClick = useCallback(() => {
    track("top_nav_logo_click");
    if (location.pathname === NAVIGATION_PATHS.home || location.pathname === "/") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else {
      navigate(NAVIGATION_PATHS.home);
    }
  }, [navigate, location.pathname, track]);
  
  const handleSearchClick = useCallback(() => {
    track("top_nav_search_click");
    navigate(NAVIGATION_PATHS.search);
  }, [navigate, track]);
  
  const handleMenuClick = useCallback(() => {
    track("top_nav_menu_click");
    navigate(NAVIGATION_PATHS.menu);
  }, [navigate, track]);
  
  // Check active states
  const isHomeActive = location.pathname === "/" || location.pathname === NAVIGATION_PATHS.home;
  const isSearchActive = location.pathname === NAVIGATION_PATHS.search;
  const isMenuActive = location.pathname === NAVIGATION_PATHS.menu;
  
  // Get notification counts
  const notificationCount = unreadCounts.notifications || 0;
  
  return (
    <>
      {/* Main Navigation Bar - FLOATING with shadow like BottomNav */}
      <AnimatePresence>
        {isVisible && (
          <motion.nav
            initial={{ y: -100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -100, opacity: 0 }}
            transition={ANIMATION_CONFIG.spring}
            className={cn(
              "fixed top-0 left-0 right-0 z-40",
              "px-4 pt-safe-top pb-4"
            )}
          >
            {/* Main Container with Rounded Edges and Shadow - FLOATING */}
            <div className={cn(
              "rounded-3xl mx-auto max-w-2xl px-5 py-3",
              themeColors.navBg,
              "border",
              themeColors.border,
              "shadow-3xl"
            )}
            style={{
              boxShadow: theme === "dark" 
                ? "0 -25px 50px -12px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.05), 0 0 0 1px rgba(255, 255, 255, 0.05)"
                : "0 -25px 50px -12px rgba(0, 0, 0, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.8), 0 0 0 1px rgba(0, 0, 0, 0.05)"
            }}
            >
              <div className="flex items-center justify-between">
                {/* Left: Logo and App Name */}
                <div className="flex items-center gap-4">
                  <PerfectCircularLogo 
                    theme={theme} 
                    onClick={handleLogoClick} 
                    isActive={isHomeActive} 
                  />
                  
                  {/* App Name with gradient matching BottomNav */}
                  <div className="flex flex-col">
                    <motion.h1
                      className={cn(
                        "text-2xl font-bold bg-gradient-to-r bg-clip-text text-transparent",
                        theme === "dark"
                          ? "from-purple-400 via-pink-400 to-purple-400"
                          : "from-orange-500 via-red-500 to-orange-500",
                        "tracking-tight leading-none"
                      )}
                    >
                      Arvdoul
                    </motion.h1>
                    <motion.p
                      className={cn(
                        "text-xs mt-0.5",
                        themeColors.subtext
                      )}
                    >
                      Connect & Create
                    </motion.p>
                  </div>
                </div>
                
                {/* Right: Action Icons */}
                <div className="flex items-center gap-3">
                  <PerfectCircularIcon
                    icon={Search}
                    onClick={handleSearchClick}
                    isActive={isSearchActive}
                    theme={theme}
                    label="Search"
                    isSearch={true}
                    showNotification={false}
                  />
                  
                  <PerfectCircularIcon
                    icon={Menu}
                    onClick={handleMenuClick}
                    isActive={isMenuActive}
                    theme={theme}
                    label="Menu"
                    showNotification={notificationCount > 0}
                    notificationCount={notificationCount}
                  />
                </div>
              </div>
            </div>
          </motion.nav>
        )}
      </AnimatePresence>
      
      {/* Spacer for fixed position */}
      <div className="h-20" />
    </>
  );
};

export default memo(TopAppBar);