\/\/ src/components/Home/BottomMenu.jsx
import PropTypes from 'prop-types';
import { motion, AnimatePresence } from "framer-motion";
import { Bookmark, Flag, Share2, Link, Ban, X } from "lucide-react";
import { useTheme } from "@context/ThemeContext";
import { useCallback } from "react";

export default function PostLongPressMenu({ isOpen, onClose, onAction }) {
  const { theme } = useTheme();

  \/\/ ---------------- Handle Menu Item Action ----------------
  const handleAction = useCallback(
    (actionType) => {
      if (onAction) onAction(actionType);
      onClose();
    },
    [onAction, onClose],
  );

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-50 flex items-end justify-center p-4"
          style={{
            backgroundColor:
              theme === "dark" ? "rgba(0,0,0,0.7)" : "rgba(0,0,0,0.4)",
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          aria-modal="true"
          role="dialog"
        >
          <motion.div
            className={`w-full max-w-md rounded-t-2xl p-4 ${
              theme === "dark"
                ? "bg-gray-900 text-white"
                : "bg-white text-gray-900"
            } shadow-lg`}
            initial={{ y: 200, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 200, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* --- Header --- */}
            <div className="flex justify-between items-center mb-4">
              <p
                className={`text-sm font-semibold ${
                  theme === "dark" ? "text-gray-400" : "text-gray-500"
                }`}
              >
                Post Actions
              </p>
              <button
                onClick={onClose}
                aria-label="Close menu"
                className="p-1 rounded-full transition hover:bg-gray-200 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-blue-500"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* --- Menu Items --- */}
            <ul className="space-y-2">
              <MenuItem
                icon={<Bookmark />}
                label="Save Post"
                onClick={() => handleAction("save")}
                theme={theme}
              />
              <MenuItem
                icon={<Share2 />}
                label="Share"
                onClick={() => handleAction("share")}
                theme={theme}
              />
              <MenuItem
                icon={<Link />}
                label="Copy Link"
                onClick={() => handleAction("copy")}
                theme={theme}
              />
              <MenuItem
                icon={<Ban />}
                label="Not Interested"
                onClick={() => handleAction("not_interested")}
                theme={theme}
              />
              <MenuItem
                icon={<Flag />}
                label="Report"
                onClick={() => handleAction("report")}
                theme={theme}
              />
            </ul>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

\/\/ ---------------- Menu Item Component ----------------
function MenuItem({ icon, label, onClick, theme }) {
  return (
    <li
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && onClick()}
      className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors duration-200 select-none
        ${
          theme === "dark"
            ? "hover:bg-gray-800 focus:bg-gray-800"
            : "hover:bg-gray-100 focus:bg-gray-100"
        }`}
    >
      {icon}
      <span className="text-sm font-medium">{label}</span>
    </li>
  );
}

\/\/ ---------------- PropTypes ----------------
PostLongPressMenu.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onAction: PropTypes.func,
};

MenuItem.propTypes = {
  icon: PropTypes.node.isRequired,
  label: PropTypes.string.isRequired,
  onClick: PropTypes.func.isRequired,
  theme: PropTypes.string.isRequired,
};