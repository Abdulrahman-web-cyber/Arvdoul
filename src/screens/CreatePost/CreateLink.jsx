import React, { useEffect } from "react";
import { useCreatePostState, useCreatePostServices } from "../CreatePost";

export default function CreateLink() {
  const { state, dispatch } = useCreatePostState();
  const { saveDraft } = useCreatePostServices();
  const link = state.typeData.link;

  // Content ready when URL is non‑empty
  useEffect(() => {
    dispatch({ type: "SET_CONTENT_READY", payload: link.url.trim().length > 0 });
  }, [link.url, dispatch]);

  return (
    <div className="space-y-4 h-full">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400">Link</h3>
        <button
          onClick={saveDraft}
          className="px-3 py-1 text-sm bg-gray-200 dark:bg-gray-700 rounded-full hover:bg-gray-300 dark:hover:bg-gray-600 transition"
        >
          💾 Save Draft
        </button>
      </div>

      <input
        type="text"
        value={link.url}
        onChange={(e) => dispatch({ type: "SET_LINK_URL", payload: e.target.value })}
        placeholder="Paste URL..."
        className="w-full p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500"
        autoFocus
      />

      <input
        type="text"
        value={link.title}
        onChange={(e) => dispatch({ type: "SET_LINK_TITLE", payload: e.target.value })}
        placeholder="Title (optional)"
        className="w-full p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500"
      />

      {/* Later: preview scraper */}
    </div>
  );
}