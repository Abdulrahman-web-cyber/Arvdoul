// src/components/Shared/CropTool.jsx
import React from "react";
import { ZoomOut, ZoomIn } from "lucide-react";

const ASPECT_RATIOS = [
  { label: "Free", value: undefined },
  { label: "1:1", value: 1 / 1 },
  { label: "4:5", value: 4 / 5 },
  { label: "16:9", value: 16 / 9 },
];

export default function CropTool({
  aspect,
  setAspect,
  zoom,
  onZoomChange,
  onCropChangeWithUndo,
  onCropComplete,
  pushUndo,
  setCrop,
  setZoom,
  setCroppedAreaPixels,
}) {
  return (
    <div className="w-full max-w-md space-y-4">
      <div className="flex gap-2 justify-center flex-wrap">
        {ASPECT_RATIOS.map(r => (
          <button
            key={r.label}
            type="button"
            onClick={() => {
              pushUndo();
              setAspect(r.value);
            }}
            className={`px-4 py-1.5 text-xs font-medium rounded-full ${
              aspect === r.value
                ? "bg-fuchsia-600 text-white"
                : "bg-white/10 text-gray-300 hover:bg-white/20"
            }`}
          >
            {r.label}
          </button>
        ))}
        <span className="text-xs text-gray-400 self-center ml-2">
          {aspect
            ? ASPECT_RATIOS.find(r => r.value === aspect)?.label
            : "Free"}
        </span>
      </div>
      <div className="flex items-center gap-3 text-white">
        <ZoomOut className="w-4 h-4 text-gray-400" />
        <input
          type="range"
          min={1}
          max={3}
          step={0.1}
          value={zoom}
          onChange={(e) => onZoomChange(Number(e.target.value))}
          onPointerUp={() => pushUndo()}
          className="flex-1 accent-fuchsia-500"
          aria-label="Zoom"
        />
        <ZoomIn className="w-4 h-4 text-gray-400" />
      </div>
      <button
        type="button"
        onClick={() => {
          pushUndo();
          setCrop({ x: 0, y: 0 });
          setZoom(1);
          setAspect(undefined);
          setCroppedAreaPixels(null);
        }}
        className="px-4 py-1.5 text-xs rounded-full bg-white/10 hover:bg-white/20 text-gray-300"
      >
        Reset Crop
      </button>
    </div>
  );
}