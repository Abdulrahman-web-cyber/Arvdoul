import React, { useCallback, useEffect, useRef, useState } from "react";
import { useCreatePostState, useCreatePostServices } from "../CreatePost";
import * as Icons from "lucide-react";
import { toast } from "sonner";

export default function CreateVideo() {
  const { state, dispatch } = useCreatePostState();
  const { uploadMedia, saveDraft } = useCreatePostServices();
  const fileInputRef = useRef(null);
  const [trim, setTrim] = useState({ start: 0, end: 100 });
  const [showTrim, setShowTrim] = useState(false);

  const handleFiles = useCallback(
    (files) => {
      const newFiles = [];
      for (const file of files) {
        if (!file.type.startsWith("video/")) continue;
        const preview = URL.createObjectURL(file);
        newFiles.push({
          id: crypto.randomUUID?.() || Date.now().toString() + Math.random(),
          file,
          preview,
          type: "video",
          name: file.name,
          size: file.size,
          progress: 0,
          error: null,
        });
      }
      if (newFiles.length) dispatch({ type: "ADD_MEDIA_ITEMS", payload: newFiles });
    },
    [dispatch]
  );

  const removeMedia = useCallback(
    (index) => {
      const media = state.mediaItems[index];
      if (media?.preview) URL.revokeObjectURL(media.preview);
      dispatch({ type: "REMOVE_MEDIA_ITEM", payload: index });
    },
    [state.mediaItems, dispatch]
  );

  // Content ready when at least one video is present
  useEffect(() => {
    dispatch({ type: "SET_CONTENT_READY", payload: state.mediaItems.length > 0 });
  }, [state.mediaItems.length, dispatch]);

  // Cleanup
  useEffect(() => {
    return () => {
      state.mediaItems.forEach((m) => m.preview && URL.revokeObjectURL(m.preview));
    };
  }, []);

  return (
    <div className="space-y-4 h-full">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400">Video Post</h3>
        <button
          onClick={saveDraft}
          className="px-3 py-1 text-sm bg-gray-200 dark:bg-gray-700 rounded-full hover:bg-gray-300 dark:hover:bg-gray-600 transition"
        >
          💾 Save Draft
        </button>
      </div>

      <button
        onClick={() => fileInputRef.current?.click()}
        className="w-full py-8 border-2 border-dashed border-purple-400/50 rounded-2xl hover:border-purple-500 flex flex-col items-center justify-center gap-2 text-gray-500 dark:text-gray-400 transition"
      >
        <Icons.Plus className="w-10 h-10" />
        <span className="text-sm">Add Video (or drop here)</span>
      </button>
      <input
        ref={fileInputRef}
        type="file"
        accept="video/*"
        className="hidden"
        onChange={(e) => {
          handleFiles(Array.from(e.target.files));
          e.target.value = "";
        }}
      />

      {state.mediaItems.length > 0 && (
        <div className="space-y-3">
          {state.mediaItems.map((media, idx) => (
            <div key={media.id} className="relative rounded-xl overflow-hidden bg-gray-200 dark:bg-gray-700">
              <video src={media.preview} controls className="w-full" />
              <div className="absolute top-2 right-2 flex gap-2">
                <button
                  onClick={() => setShowTrim(!showTrim)}
                  className="p-1 bg-black/50 rounded-full text-white text-xs"
                >
                  ✂️
                </button>
                <button
                  onClick={() => removeMedia(idx)}
                  className="p-1 bg-red-500/80 rounded-full"
                >
                  <Icons.Trash2 className="w-4 h-4 text-white" />
                </button>
              </div>
              {showTrim && (
                <div className="absolute bottom-0 left-0 right-0 bg-black/70 p-2 flex items-center gap-2">
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={trim.start}
                    onChange={(e) => setTrim({ ...trim, start: parseInt(e.target.value) })}
                    className="flex-1"
                  />
                  <span className="text-white text-xs">{trim.start}%</span>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={trim.end}
                    onChange={(e) => setTrim({ ...trim, end: parseInt(e.target.value) })}
                    className="flex-1"
                  />
                  <span className="text-white text-xs">{trim.end}%</span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <textarea
        value={state.content}
        onChange={(e) => dispatch({ type: "SET_CONTENT", payload: e.target.value })}
        placeholder="Describe your video..."
        className="w-full min-h-[80px] p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white resize-none focus:ring-2 focus:ring-purple-500"
      />
    </div>
  );
}