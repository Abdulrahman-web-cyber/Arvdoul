import React from "react";
import { RotateCw } from "lucide-react";

export default function RotateTool({ onRotateLeft, onRotateRight }) {
  return (
    <div className="flex gap-4 justify-center">
      <button
        onClick={onRotateLeft}
        className="px-4 py-2 rounded-full bg-white/10 text-white text-sm hover:bg-white/20"
        aria-label="Rotate left"
      >
        <RotateCw className="w-5 h-5 transform -rotate-90" />
      </button>
      <button
        onClick={onRotateRight}
        className="px-4 py-2 rounded-full bg-white/10 text-white text-sm hover:bg-white/20"
        aria-label="Rotate right"
      >
        <RotateCw className="w-5 h-5" />
      </button>
    </div>
  );
}