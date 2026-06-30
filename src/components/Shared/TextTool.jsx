import React, { useState, useCallback } from "react";
import { Type, Trash2, AlignLeft, AlignCenter, AlignRight } from "lucide-react";

export default function TextTool({
  selectedText,
  updateSelectedText,
  handleDeleteText,
  handleQuickAddText,
  imageElement,
  pushUndo,
}) {
  const [quickText, setQuickText] = useState("");

  const onQuickAdd = useCallback(() => {
    if (handleQuickAddText) {
      handleQuickAddText(quickText);
      setQuickText("");
    }
  }, [quickText, handleQuickAddText]);

  return (
    <div className="w-full max-w-xl space-y-3">
      <div className="flex items-center gap-2">
        <input
          type="text"
          placeholder="Type text..."
          value={quickText}
          onChange={(e) => setQuickText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") onQuickAdd();
          }}
          className="flex-1 px-4 py-2.5 rounded-xl bg-white/10 text-white placeholder-gray-400 border border-white/10 focus:border-fuchsia-500 outline-none text-sm"
          aria-label="Quick text"
        />
        <button
          onClick={onQuickAdd}
          className="px-4 py-2.5 rounded-xl bg-fuchsia-600 text-white text-sm font-bold active:scale-95"
        >
          Add
        </button>
      </div>
      <p className="text-xs text-gray-400 text-center">or tap on the image to add text</p>

      {selectedText && (
        <div className="bg-white/5 rounded-xl p-3 space-y-2">
          <input
            type="text"
            value={selectedText.text}
            onChange={(e) => updateSelectedText({ text: e.target.value })}
            className="w-full px-3 py-1.5 rounded-lg bg-white/10 text-white outline-none border border-white/10 focus:border-fuchsia-500 text-sm"
            aria-label="Edit text content"
          />
          <div className="flex items-center gap-2 flex-wrap">
            <input
              type="color"
              value={selectedText.color}
              onChange={(e) => updateSelectedText({ color: e.target.value })}
              className="w-8 h-8 rounded border border-white/20 bg-transparent"
              aria-label="Text color"
            />
            <span className="text-xs text-gray-400">Color</span>
            <div className="flex items-center gap-1 ml-2">
              <Type className="w-4 h-4 text-gray-400" />
              <input
                type="range"
                min={12}
                max={200}
                step={1}
                value={selectedText.fontSize || 24}
                onChange={(e) =>
                  updateSelectedText({ fontSize: Number(e.target.value) })
                }
                onPointerUp={() => pushUndo()}
                className="w-20 accent-fuchsia-500"
                aria-label="Text size"
              />
              <span className="text-xs text-gray-400">
                {selectedText.fontSize || 24}px
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400">Font</span>
            <select
              value={selectedText.fontFamily || "sans-serif"}
              onChange={(e) => updateSelectedText({ fontFamily: e.target.value })}
              className="bg-white/10 text-white border border-white/10 rounded-xl px-3 py-1.5 outline-none text-xs"
            >
              <option value="sans-serif">Sans‑Serif</option>
              <option value="serif">Serif</option>
              <option value="monospace">Monospace</option>
              <option value="cursive">Cursive</option>
              <option value="fantasy">Fantasy</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400">Align</span>
            <button
              onClick={() => updateSelectedText({ textAlign: "left" })}
              className={`p-1 rounded ${
                selectedText.textAlign === "left" ? "bg-fuchsia-600" : "bg-white/10"
              }`}
              aria-label="Align left"
            >
              <AlignLeft className="w-4 h-4 text-white" />
            </button>
            <button
              onClick={() => updateSelectedText({ textAlign: "center" })}
              className={`p-1 rounded ${
                selectedText.textAlign === "center" ? "bg-fuchsia-600" : "bg-white/10"
              }`}
              aria-label="Align center"
            >
              <AlignCenter className="w-4 h-4 text-white" />
            </button>
            <button
              onClick={() => updateSelectedText({ textAlign: "right" })}
              className={`p-1 rounded ${
                selectedText.textAlign === "right" ? "bg-fuchsia-600" : "bg-white/10"
              }`}
              aria-label="Align right"
            >
              <AlignRight className="w-4 h-4 text-white" />
            </button>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400">Rotate</span>
            <input
              type="range"
              min={-180}
              max={180}
              value={Math.round((selectedText.rotation || 0) * 180 / Math.PI)}
              onChange={(e) =>
                updateSelectedText({
                  rotation: (Number(e.target.value) * Math.PI) / 180,
                })
              }
              onPointerUp={() => pushUndo()}
              className="flex-1 accent-fuchsia-500"
              aria-label="Rotation"
            />
            <span className="text-xs text-gray-400 w-10 text-right">
              {Math.round((selectedText.rotation || 0) * 180 / Math.PI)}°
            </span>
          </div>

          <button
            onClick={() => handleDeleteText(selectedText.id)}
            className="flex items-center gap-2 px-4 py-1.5 bg-red-500/20 text-red-400 rounded-full text-xs hover:bg-red-500/40"
          >
            <Trash2 className="w-3.5 h-3.5" /> Delete
          </button>
        </div>
      )}
    </div>
  );
}