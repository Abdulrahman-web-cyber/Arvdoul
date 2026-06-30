import React from "react";

const sliders = [
  ["Brightness", "brightness", 0, 200],
  ["Contrast", "contrast", 0, 200],
  ["Saturation", "saturation", 0, 200],
];

export default function AdjustTool({
  brightness,
  setBrightness,
  contrast,
  setContrast,
  saturation,
  setSaturation,
  resetAdjustments,
  pushUndo,
}) {
  const values = { brightness, contrast, saturation };
  const setters = { brightness: setBrightness, contrast: setContrast, saturation: setSaturation };

  return (
    <div className="w-full max-w-md space-y-3 text-white">
      {sliders.map(([label, key, min, max]) => (
        <div key={key} className="flex items-center gap-4">
          <span className="w-20 text-xs text-gray-300">{label}</span>
          <input
            type="range"
            min={min}
            max={max}
            value={values[key]}
            onChange={(e) => setters[key](Number(e.target.value))}
            onPointerUp={() => pushUndo()}
            className="flex-1 accent-fuchsia-500"
            aria-label={label}
          />
          <span className="w-10 text-xs text-gray-400 text-right">{values[key]}</span>
        </div>
      ))}
      <div className="flex justify-end pt-2">
        <button
          type="button"
          onClick={resetAdjustments}
          className="px-4 py-1.5 text-xs rounded-full bg-white/10 hover:bg-white/20 text-gray-300"
        >
          Reset All
        </button>
      </div>
    </div>
  );
}