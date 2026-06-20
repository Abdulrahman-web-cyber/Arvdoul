import React, { useCallback, useEffect, useRef, useState } from "react";
import { useCreatePostState, useCreatePostServices } from "../CreatePost";
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import * as Icons from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";

const SortableImage = ({ id, media, index, onRemove, onEdit }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : undefined,
  };
  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      className="relative group aspect-square rounded-xl overflow-hidden bg-gray-200 dark:bg-gray-700"
    >
      <img src={media.preview} className="w-full h-full object-cover" alt="" />
      {media.progress > 0 && media.progress < 100 && (
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-gray-300 dark:bg-gray-600">
          <div className="h-full bg-purple-500" style={{ width: `${media.progress}%` }} />
        </div>
      )}
      {media.error && (
        <div className="absolute inset-0 bg-red-900/60 flex items-center justify-center text-white text-xs">
          Error
        </div>
      )}
      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
        <button
          onClick={(e) => { e.stopPropagation(); onEdit(media); }}
          className="p-1.5 bg-white/80 rounded-full"
        >
          <Icons.Edit3 className="w-4 h-4 text-gray-800" />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onRemove(index); }}
          className="p-1.5 bg-red-500/80 rounded-full"
        >
          <Icons.Trash2 className="w-4 h-4 text-white" />
        </button>
      </div>
      <button
        {...listeners}
        className="absolute top-1 right-1 p-1 bg-black/40 rounded-full opacity-0 group-hover:opacity-100"
      >
        <Icons.GripVertical className="w-3 h-3 text-white" />
      </button>
    </div>
  );
};

export default function CreateImage() {
  const { state, dispatch } = useCreatePostState();
  const { uploadMedia, saveDraft } = useCreatePostServices();
  const fileInputRef = useRef(null);
  const [editingImage, setEditingImage] = useState(null); // place for image editor modal

  const handleFiles = useCallback(
    (files) => {
      const newFiles = [];
      for (const file of files) {
        if (!file.type.startsWith("image/")) continue;
        const preview = URL.createObjectURL(file);
        newFiles.push({
          id: crypto.randomUUID?.() || Date.now().toString() + Math.random(),
          file,
          preview,
          type: "image",
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

  const handleDragEnd = useCallback(
    (event) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;
      const old = state.mediaItems.findIndex((m) => m.id === active.id);
      const newIdx = state.mediaItems.findIndex((m) => m.id === over.id);
      if (old !== -1 && newIdx !== -1) dispatch({ type: "REORDER_MEDIA", payload: { from: old, to: newIdx } });
    },
    [state.mediaItems, dispatch]
  );

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  // Set content ready when at least one image is present
  useEffect(() => {
    dispatch({ type: "SET_CONTENT_READY", payload: state.mediaItems.length > 0 });
  }, [state.mediaItems.length, dispatch]);

  // Cleanup object URLs on unmount
  useEffect(() => {
    return () => {
      state.mediaItems.forEach((m) => m.preview && URL.revokeObjectURL(m.preview));
    };
  }, []);

  return (
    <div className="space-y-4 h-full">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400">Photo Post</h3>
        <button
          onClick={saveDraft}
          className="px-3 py-1 text-sm bg-gray-200 dark:bg-gray-700 rounded-full hover:bg-gray-300 dark:hover:bg-gray-600 transition"
        >
          💾 Save Draft
        </button>
      </div>

      {/* Upload button */}
      <button
        onClick={() => fileInputRef.current?.click()}
        className="w-full py-8 border-2 border-dashed border-purple-400/50 rounded-2xl hover:border-purple-500 flex flex-col items-center justify-center gap-2 text-gray-500 dark:text-gray-400 transition"
      >
        <Icons.Plus className="w-10 h-10" />
        <span className="text-sm">Add Images (or drop here)</span>
      </button>
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          handleFiles(Array.from(e.target.files));
          e.target.value = "";
        }}
      />

      {/* Image grid with drag‑and‑drop */}
      {state.mediaItems.length > 0 && (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={state.mediaItems.map((m) => m.id)} strategy={verticalListSortingStrategy}>
            <div className="grid grid-cols-3 gap-2 max-h-[50vh] overflow-y-auto">
              {state.mediaItems.map((media, idx) => (
                <SortableImage
                  key={media.id}
                  id={media.id}
                  media={media}
                  index={idx}
                  onRemove={removeMedia}
                  onEdit={() => setEditingImage(media)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {/* Caption input */}
      <textarea
        value={state.content}
        onChange={(e) => dispatch({ type: "SET_CONTENT", payload: e.target.value })}
        placeholder="Write a caption..."
        className="w-full min-h-[80px] p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white resize-none focus:ring-2 focus:ring-purple-500"
      />

      {/* Image editor modal placeholder – can be expanded with a full canvas editor */}
      {editingImage && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center" onClick={() => setEditingImage(null)}>
          <div
            className="bg-white dark:bg-gray-800 rounded-2xl p-6 max-w-2xl w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold mb-4">Edit Image</h3>
            <img src={editingImage.preview} className="w-full rounded-xl mb-4" alt="" />
            <div className="flex gap-2 flex-wrap">
              <button className="px-3 py-1 bg-purple-500 text-white rounded-full text-sm">Crop</button>
              <button className="px-3 py-1 bg-purple-500 text-white rounded-full text-sm">Filter</button>
              <button className="px-3 py-1 bg-purple-500 text-white rounded-full text-sm">Adjust</button>
              <button className="px-3 py-1 bg-red-500 text-white rounded-full text-sm">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}