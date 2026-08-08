// src/screens/VideoEditor/components/ActionRibbon.jsx
import React from 'react';
import PropTypes from 'prop-types';
import {
  Scissors, SplitSquareVertical, Layers, Palette, Sliders, Music,
  Type, Smile, PenTool, Sparkles, Gauge, Shield, Wand2, Grid
} from 'lucide-react';

export const ACTION_TOOLS = [
  { id: 'trim', label: 'Trim', icon: Scissors },
  { id: 'split', label: 'Split', icon: SplitSquareVertical },
  { id: 'transition', label: 'Transition', icon: Layers },
  { id: 'filters', label: 'Filters', icon: Palette },
  { id: 'adjust', label: 'Adjust', icon: Sliders },
  { id: 'audio', label: 'Audio', icon: Music },
  { id: 'text', label: 'Text', icon: Type },
  { id: 'stickers', label: 'Stickers', icon: Smile },
  { id: 'draw', label: 'Draw', icon: PenTool },
  { id: 'effects', label: 'Effects', icon: Sparkles },
  { id: 'speed', label: 'Speed', icon: Gauge },
  { id: 'stabilize', label: 'Stabilize', icon: Shield },
  { id: 'ai', label: 'AI Tools', icon: Wand2 },
  { id: 'more', label: 'More', icon: Grid },
];

export default function ActionRibbon({
  activeTool = 'trim',
  onSelectTool,
}) {
  return (
    <div className="w-full overflow-x-auto py-1 scrollbar-none">
      <div className="flex items-center gap-1.5 sm:gap-2 min-w-max px-1">
        {ACTION_TOOLS.map((tool) => {
          const Icon = tool.icon;
          const isActive = activeTool === tool.id;

          return (
            <button
              key={tool.id}
              onClick={() => onSelectTool?.(tool.id)}
              className={`flex flex-col items-center justify-center min-w-[62px] sm:min-w-[70px] py-2 px-2.5 rounded-2xl transition-all duration-200 active:scale-95 select-none ${
                isActive
                  ? 'bg-gradient-to-b from-purple-600/90 to-indigo-700/90 text-white font-bold shadow-lg shadow-purple-600/30 border border-purple-400/60 ring-1 ring-purple-300/40'
                  : 'bg-white/5 hover:bg-white/10 dark:bg-white/5 dark:hover:bg-white/10 light:bg-gray-100 light:hover:bg-gray-200 text-gray-300 dark:text-gray-300 light:text-gray-700 hover:text-white border border-white/5'
              }`}
            >
              <Icon className={`w-4 h-4 sm:w-5 sm:h-5 mb-1 ${isActive ? 'text-white' : 'text-gray-300 group-hover:text-white'}`} />
              <span className="text-[11px] sm:text-xs tracking-tight">{tool.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

ActionRibbon.propTypes = {
  activeTool: PropTypes.string,
  onSelectTool: PropTypes.func,
};
