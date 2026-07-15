import React, { memo, useRef } from "react";

const PRESET_COLORS = [                        "#FFFFFF",
  "#000000",
  "#EF4444",
  "#F97316",                                   "#EAB308",
  "#22C55E",
  "#06B6D4",
  "#3B82F6",
  "#8B5CF6",
  "#EC4899",
];

const ColorPicker = memo(function ColorPicker({
  color = "#FFFFFF",
  onChange,
  disabled = false,
  className = "",
}) {
  const inputRef = useRef(null);

  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={disabled}
          onClick={() => inputRef.current?.click()}
          className="w-10 h-10 rounded-xl border border-white/20 shadow-lg"
          style={{ backgroundColor: color }}
          aria-label="Choose color"
        />

        <input
          ref={inputRef}
          type="color"
          value={color}
          disabled={disabled}
          onChange={(e) => onChange?.(e.target.value)}
          className="hidden"
        />

        <input
          type="text"
          value={color}
          disabled={disabled}
          onChange={(e) => onChange?.(e.target.value)}
          className="flex-1 rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-white text-sm outline-none"
        />
      </div>

      <div className="grid grid-cols-5 gap-2">
        {PRESET_COLORS.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => onChange?.(c)}
            className={`w-8 h-8 rounded-lg border transition ${
              color === c
                ? "border-white scale-110"
                : "border-white/10 hover:border-white/40"
            }`}
            style={{ backgroundColor: c }}
            aria-label={c}
          />
        ))}
      </div>
    </div>
  );
});

export default ColorPicker;
