import React, { useCallback, useEffect, useRef, useState } from "react";
import { useCreatePostState, useCreatePostServices } from "../CreatePost";
import * as Icons from "lucide-react";

export default function CreateAudio() {
  const { state, dispatch } = useCreatePostState();
  const { saveDraft } = useCreatePostServices();
  const fileInputRef = useRef(null);
  const [audioFile, setAudioFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Sync local state to global
    dispatch({ type: "SET_AUDIO_FILE", payload: audioFile });
    dispatch({ type: "SET_CONTENT_READY", payload: !!audioFile });
  }, [audioFile, dispatch]);

  const handleFile = useCallback((file) => {
    if (!file.type.startsWith("audio/")) return;
    const preview = URL.createObjectURL(file);
    setAudioFile(file);
    setPreviewUrl(preview);
    setProgress(0);
    setError(null);
  }, []);

  const removeAudio = useCallback(() => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setAudioFile(null);
    setPreviewUrl(null);
    setProgress(0);
    setError(null);
  }, [previewUrl]);

  return (
    <div className="space-y-4 h-full">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400">Audio Post</h3>
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
        <Icons.Music className="w-10 h-10" />
        <span className="text-sm">Choose Audio</span>
      </button>
      <input
        ref={fileInputRef}
        type="file"
        accept="audio/*"
        className="hidden"
        onChange={(e) => {
          if (e.target.files[0]) handleFile(e.target.files[0]);
          e.target.value = "";
        }}
      />

      {audioFile && (
        <div className="p-4 bg-gray-100 dark:bg-gray-800 rounded-xl">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm truncate">{audioFile.name}</span>
            <button onClick={removeAudio} className="text-red-500"><Icons.X className="w-4 h-4" /></button>
          </div>
          <audio controls src={previewUrl} className="w-full mb-2" />
          {progress > 0 && (
            <div className="w-full h-2 bg-gray-200 dark:bg-gray-600 rounded-full">
              <div className="h-full bg-purple-500 rounded-full" style={{ width: `${progress}%` }} />
            </div>
          )}
        </div>
      )}

      <textarea
        value={state.content}
        onChange={(e) => dispatch({ type: "SET_CONTENT", payload: e.target.value })}
        placeholder="Write a caption..."
        className="w-full min-h-[80px] p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white resize-none focus:ring-2 focus:ring-purple-500"
      />
    </div>
  );
}