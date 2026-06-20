import React, { useEffect, Suspense, lazy } from "react";
import { useCreatePostState, useCreatePostServices } from "../CreatePost";
const DateTimePicker = lazy(() => import("react-datepicker"));
import "react-datepicker/dist/react-datepicker.css";

export default function CreateEvent() {
  const { state, dispatch } = useCreatePostState();
  const { saveDraft } = useCreatePostServices();
  const event = state.typeData.event;

  // Content ready when title and date are set
  useEffect(() => {
    const ready = state.content.trim() && event.date && new Date(event.date) > new Date();
    dispatch({ type: "SET_CONTENT_READY", payload: ready });
  }, [state.content, event.date, dispatch]);

  return (
    <div className="space-y-4 h-full">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400">Event</h3>
        <button
          onClick={saveDraft}
          className="px-3 py-1 text-sm bg-gray-200 dark:bg-gray-700 rounded-full hover:bg-gray-300 dark:hover:bg-gray-600 transition"
        >
          💾 Save Draft
        </button>
      </div>

      <input
        type="text"
        value={state.content}
        onChange={(e) => dispatch({ type: "SET_CONTENT", payload: e.target.value })}
        placeholder="Event name"
        className="w-full p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500"
        autoFocus
      />

      <Suspense fallback={<div className="h-10 animate-pulse bg-gray-200 dark:bg-gray-700 rounded" />}>
        <DateTimePicker
          selected={event.date ? new Date(event.date) : null}
          onChange={(date) => dispatch({ type: "SET_EVENT_DATE", payload: date ? date.toISOString() : null })}
          showTimeSelect
          dateFormat="Pp"
          placeholderText="Event date & time"
          className="w-full p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500"
        />
      </Suspense>

      <input
        type="text"
        value={event.location}
        onChange={(e) => dispatch({ type: "SET_EVENT_LOCATION", payload: e.target.value })}
        placeholder="Location (optional)"
        className="w-full p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500"
      />
    </div>
  );
}