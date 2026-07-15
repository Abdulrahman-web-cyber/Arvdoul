import React, { useCallback, useEffect, useRef, useState } from "react";
import { useCreatePostState, useCreatePostServices } from "../CreatePost";
import * as Icons from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import VideoEditor from "./VideoEditor";
import GlassButton from "../../components/UI/GlassButton";
import { useTheme } from "../../context/ThemeContext";

export default function CreateVideo() {
  const { state, dispatch } = useCreatePostState();
  const { uploadMedia, saveDraft } = useCreatePostServices();
  const fileInputRef = useRef(null);
  const [trim, setTrim] = useState({ start: 0, end: 100 });
  const [showTrim, setShowTrim] = useState(false);
  const [showVideoEditor, setShowVideoEditor] = useState(false);
  const [editingVideo, setEditingVideo] = useState(null);
  const { isDark, colors, glass } = useTheme();

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

  // Open video editor
  const openVideoEditor = (mediaItem) => {
    setEditingVideo(mediaItem);
    setShowVideoEditor(true);
  };

  // Handle editor close
  const handleEditorClose = () => {
    setShowVideoEditor(false);
    setEditingVideo(null);
  };

  return (
    <div className="space-y-4 h-full">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400">Video Post</h3>
        <div className="flex items-center gap-2">
          <GlassButton
            variant="ghost"
            size="sm"
            onClick={saveDraft}
          >
            <Icons.Save className="w-4 h-4 mr-1" />
            Save Draft
          </GlassButton>
        </div>
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
            <motion.div
              key={media.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="relative rounded-2xl overflow-hidden bg-gray-200 dark:bg-gray-700 group"
            >
              <video 
                src={media.preview} 
                controls 
                className="w-full aspect-video object-cover"
                style={{ maxHeight: '300px' }}
              />
              
              {/* Overlay Actions */}
              <div className="absolute top-2 right-2 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                {/* Edit Button */}
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => openVideoEditor(media)}
                  className="p-2 bg-gradient-to-r from-purple-500 to-blue-500 rounded-full shadow-lg"
                  title="Edit in Video Studio"
                >
                  <Icons.Scissors className="w-4 h-4 text-white" />
                </motion.button>
                
                {/* Trim Button */}
                <button
                  onClick={() => setShowTrim(!showTrim)}
                  className="p-2 bg-black/50 backdrop-blur-sm rounded-full text-white hover:bg-black/70 transition"
                >
                  <Icons.Trim className="w-4 h-4" />
                </button>
                
                {/* Delete Button */}
                <button
                  onClick={() => removeMedia(idx)}
                  className="p-2 bg-red-500/80 rounded-full hover:bg-red-500 transition"
                >
                  <Icons.Trash2 className="w-4 h-4 text-white" />
                </button>
              </div>

              {/* Video Info */}
              <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/80 to-transparent">
                <p className="text-xs text-white/80 truncate">{media.name}</p>
                <p className="text-xs text-white/60">
                  {(media.size / (1024 * 1024)).toFixed(2)} MB
                </p>
              </div>

              {/* Trim Controls */}
              <AnimatePresence>
                {showTrim && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="bg-black/90 backdrop-blur-xl overflow-hidden"
                  >
                    <div className="p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-white/60">Trim Video</span>
                        <button
                          onClick={() => setShowTrim(false)}
                          className="text-white/60 hover:text-white"
                        >
                          <Icons.X className="w-4 h-4" />
                        </button>
                      </div>
                      
                      <div className="space-y-2">
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-white/40 w-12">Start</span>
                          <input
                            type="range"
                            min="0"
                            max="100"
                            value={trim.start}
                            onChange={(e) => setTrim({ ...trim, start: parseInt(e.target.value) })}
                            className="flex-1 h-1 bg-white/20 rounded-full appearance-none cursor-pointer
                              [&::-webkit-slider-thumb]:appearance-none
                              [&::-webkit-slider-thumb]:w-3
                              [&::-webkit-slider-thumb]:h-3
                              [&::-webkit-slider-thumb]:rounded-full
                              [&::-webkit-slider-thumb]:bg-purple-500"
                          />
                          <span className="text-xs text-white w-10 text-right">{trim.start}%</span>
                        </div>
                        
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-white/40 w-12">End</span>
                          <input
                            type="range"
                            min="0"
                            max="100"
                            value={trim.end}
                            onChange={(e) => setTrim({ ...trim, end: parseInt(e.target.value) })}
                            className="flex-1 h-1 bg-white/20 rounded-full appearance-none cursor-pointer
                              [&::-webkit-slider-thumb]:appearance-none
                              [&::-webkit-slider-thumb]:w-3
                              [&::-webkit-slider-thumb]:h-3
                              [&::-webkit-slider-thumb]:rounded-full
                              [&::-webkit-slider-thumb]:bg-blue-500"
                          />
                          <span className="text-xs text-white w-10 text-right">{trim.end}%</span>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </div>
      )}

      {/* Open Video Editor Button */}
      {state.mediaItems.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <GlassButton
            variant="gradient"
            className="w-full"
            onClick={() => openVideoEditor(state.mediaItems[0])}
          >
            <Icons.Film className="w-5 h-5 mr-2" />
            Open Video Studio
          </GlassButton>
        </motion.div>
      )}

      <textarea
        value={state.content}
        onChange={(e) => dispatch({ type: "SET_CONTENT", payload: e.target.value })}
        placeholder="Describe your video..."
        className="w-full min-h-[80px] p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white resize-none focus:ring-2 focus:ring-purple-500"
      />

      {/* Video Editor Modal */}
      <AnimatePresence>
        {showVideoEditor && editingVideo && (
          <VideoEditor
            isOpen={showVideoEditor}
            onClose={handleEditorClose}
            videoFile={editingVideo.file}
          />
        )}
      </AnimatePresence>
    </div>
  );
}