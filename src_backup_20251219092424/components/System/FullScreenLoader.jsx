// src/components/System/FullScreenLoader.jsx
import React from "react";
import PropTypes from "prop-types";

export default function FullScreenLoader({ message = "Loading…", compact = false }) {
  return (
    <div className="h-screen w-screen flex items-center justify-center bg-white dark:bg-zinc-900">
      <div
        className={`flex flex-col items-center gap-3 px-6 text-center ${
          compact ? "py-6" : "py-12"
        }`}
        role="status"
        aria-live="polite"
      >
        <div className="animate-pulse rounded-full w-20 h-20 bg-gray-100 dark:bg-zinc-700 flex items-center justify-center">
          {/* logo / loader slot — simple glyph */}
          <svg className="w-8 h-8 text-gray-400 dark:text-zinc-300" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.5" />
          </svg>
        </div>

        <div>
          <div className="text-lg font-semibold text-gray-800 dark:text-gray-100">{message}</div>
          <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">Initializing secure connection…</div>
        </div>
      </div>
    </div>
  );
}

FullScreenLoader.propTypes = {
  message: PropTypes.string,
  compact: PropTypes.bool
};