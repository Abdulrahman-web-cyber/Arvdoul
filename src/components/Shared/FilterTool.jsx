import React from "react";

const FILTERS = [
  { name: "Original", value: "none" },
  { name: "Grayscale", value: "grayscale(100%)" },
  { name: "Sepia", value: "sepia(80%)" },
  { name: "Blur", value: "blur(4px)" },
  { name: "Bright", value: "brightness(1.5)" },
  { name: "Cool", value: "hue-rotate(90deg)" },
  { name: "Warm", value: "hue-rotate(-30deg)" },
  { name: "Vintage", value: "sepia(60%) contrast(1.1) brightness(0.9)" },
  { name: "Noir", value: "grayscale(100%) contrast(1.3)" },
  { name: "Drama", value: "contrast(1.5) saturate(1.5)" },
  { name: "Soft", value: "blur(1px) brightness(1.1) contrast(0.9)" },
  { name: "Lomo", value: "saturate(1.5) contrast(1.2) brightness(0.9)" },
];

export default function FilterTool({
  filter,
  setFilter,
  filterIntensity,
  setFilterIntensity,
  pushUndo,
}) {
  return (
    <div className="flex flex-col gap-3 w-full max-w-md">
      <div className="flex gap-3 overflow-x-auto no-scrollbar w-full px-2 snap-x">
        {FILTERS.map(f => (
          <button
            key={f.name}
            type="button"
            onClick={() => {
              pushUndo();
              setFilter(f.value);
            }}
            className={`snap-center flex-shrink-0 px-5 py-2 text-sm rounded-full ${
              filter === f.value
                ? "bg-fuchsia-600 text-white shadow-lg"
                : "bg-white/10 text-gray-300 hover:bg-white/20"
            }`}
          >
            {f.name}
          </button>
        ))}
      </div>
      {filter !== "none" && (
        <div className="flex items-center gap-2 px-2">
          <span className="text-xs text-gray-400">Intensity</span>
          <input
            type="range"
            min={0}
            max={100}
            value={filterIntensity}
            onChange={(e) => setFilterIntensity(Number(e.target.value))}
            onPointerUp={() => pushUndo()}
            className="flex-1 accent-fuchsia-500"
          />
          <span className="text-xs text-gray-400 w-10 text-right">{filterIntensity}%</span>
        </div>
      )}
    </div>
  );
}