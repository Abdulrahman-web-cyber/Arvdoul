import React from "react";
import { useTheme } from "@context/ThemeContext";
import { Plus, Menu, Search } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";

const logoDark = "/logo/logo-dark.png";
const logoLight = "/logo/logo-light.png";

export default function TopAppBar() {
  const { theme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();

  const logo = theme === "dark" ? logoDark : logoLight;

  const [showTop, setShowTop] = React.useState(true);
  const [lastScrollY, setLastScrollY] = React.useState(0);

  React.useEffect(() => {
    const handleScroll = () => {
      const currentY = window.scrollY;
      if (currentY < 50 || currentY < lastScrollY) setShowTop(true);
      else if (currentY > lastScrollY + 10) setShowTop(false);
      setLastScrollY(currentY);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [lastScrollY]);

  return (
    <AnimatePresence>
      {showTop && (
        <motion.header
          initial={{ y: -100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -100, opacity: 0 }}
          transition={{ type: "spring", damping: 20, stiffness: 300 }}
          className="fixed top-0 z-30 w-full bg-white dark:bg-gray-900 shadow-sm border-b border-gray-200 dark:border-gray-800"
        >
          <div className="flex items-center justify-between px-4 py-2">
            <div className="flex items-center gap-2">
              {location.pathname !== "/intro" && (
                <img src={logo} alt="Arvdoul logo" className="w-7 h-7" />
              )}
              <span className="font-bold text-lg tracking-tight text-gray-800 dark:text-white">
                Arvdoul
              </span>
            </div>

            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate("/search")}
                className="text-gray-700 dark:text-gray-200 hover:text-primary transition-colors"
                aria-label="Search"
              >
                <Search size={22} />
              </button>

              <button
                onClick={() => navigate("/add-post")}
                className="text-gray-700 dark:text-gray-200 hover:text-primary transition-colors"
                aria-label="Add Post"
              >
                <Plus size={24} />
              </button>

              <button
                onClick={() => navigate("/menu")}
                className="text-gray-700 dark:text-gray-200 hover:text-primary transition-colors"
                aria-label="Menu"
              >
                <Menu size={22} />
              </button>
            </div>
          </div>
        </motion.header>
      )}
    </AnimatePresence>
  );
}

\/\/ Remove invalid propTypes assignment
TopAppBar.propTypes = {};