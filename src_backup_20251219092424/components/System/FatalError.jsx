// src/components/System/FatalError.jsx
import React from "react";
import PropTypes from "prop-types";

export default function FatalError({ title = "Error", error = null, details = null }) {
  const handleReload = () => {
    // attempt a hard reload
    window.location.reload();
  };

  const handleCopy = async () => {
    const payload = {
      message: error?.message || String(error),
      stack: error?.stack || "",
      details: details || null,
      userAgent: navigator.userAgent,
      ts: new Date().toISOString()
    };
    try {
      await navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
      alert("Error details copied to clipboard — paste into your bug report.");
    } catch {
      // fallback
      prompt("Copy this error information", JSON.stringify(payload, null, 2));
    }
  };

  return (
    <div className="h-screen w-screen flex items-center justify-center bg-white dark:bg-zinc-900 p-6">
      <div className="max-w-2xl w-full bg-white dark:bg-zinc-800 rounded-2xl shadow-lg p-6">
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">{title}</h1>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
          Sorry — something went wrong while loading Arvdoul. You can try reloading, or copy the error details and
          send them to support.
        </p>

        <div className="mt-4 border rounded-md bg-gray-50 dark:bg-zinc-900 p-3 text-xs text-gray-700 dark:text-gray-300 max-h-48 overflow-auto">
          <pre className="whitespace-pre-wrap break-words">{error ? (error.message || String(error)) : "Unknown error"}</pre>
        </div>

        <div className="mt-5 flex gap-3">
          <button
            onClick={handleReload}
            className="inline-flex items-center px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700"
            aria-label="Reload application"
          >
            Reload app
          </button>

          <button
            onClick={handleCopy}
            className="inline-flex items-center px-4 py-2 rounded-lg border border-gray-200 dark:border-zinc-700 text-sm text-gray-700 dark:text-gray-200"
            aria-label="Copy error details"
          >
            Copy error details
          </button>
        </div>

        <div className="mt-4 text-xs text-gray-500 dark:text-zinc-400">
          If this persists, report to <strong>support@arvdoul.app</strong> with the copied error details.
        </div>
      </div>
    </div>
  );
}

FatalError.propTypes = {
  title: PropTypes.string,
  error: PropTypes.any,
  details: PropTypes.any
};