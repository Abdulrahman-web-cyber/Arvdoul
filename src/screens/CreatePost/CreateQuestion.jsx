import React, { useEffect } from "react";
import { useCreatePostState, useCreatePostServices } from "../CreatePost";

export default function CreateQuestion() {
  const { state, dispatch } = useCreatePostState();
  const { saveDraft } = useCreatePostServices();

  useEffect(() => {
    dispatch({ type: "SET_CONTENT_READY", payload: state.content.trim().length > 0 });
  }, [state.content, dispatch]);

  return (
    <div className="space-y-4 h-full">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400">Question</h3>
        <button
          onClick={saveDraft}
          className="px-3 py-1 text-sm bg-gray-200 dark:bg-gray-700 rounded-full hover:bg-gray-300 dark:hover:bg-gray-600 transition"
        >
          💾 Save Draft
        </button>
      </div>

      <textarea
        value={state.content}
        onChange={(e) => dispatch({ type: "SET_CONTENT", payload: e.target.value })}
        placeholder="Ask a question to your followers..."
        className="w-full h-40 p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white resize-none focus:ring-2 focus:ring-purple-500"
        autoFocus
      />
    </div>
  );
}