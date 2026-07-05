import React from "react";

export default function ImageEditor({
  image,
  onSave,
  onCancel,
}) {
  return (
    <div className="flex flex-col items-center justify-center w-full h-full bg-black text-white p-6">
      <h2 className="text-xl font-bold mb-4">
        ARVDOUL Image Editor
      </h2>

      <p className="text-center opacity-80 mb-6">
        Image editor placeholder.
      </p>

      {image && (
        <img
          src={image}
          alt="Preview"
          className="max-w-full max-h-[60vh] rounded-lg mb-6"
        />
      )}

      <div className="flex gap-3">
        <button
          onClick={onCancel}
          className="px-4 py-2 rounded bg-gray-700"
        >
          Cancel
        </button>

        <button
          onClick={() => onSave?.(image)}
          className="px-4 py-2 rounded bg-blue-600"
        >
          Save
        </button>
      </div>
    </div>
  );
}
