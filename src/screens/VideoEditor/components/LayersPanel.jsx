// src/screens/VideoEditor/components/LayersPanel.jsx
import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Layers, Plus, GripVertical, Eye, EyeOff, MoreHorizontal,
  Video, Type, Image as ImageIcon, Star, Sliders, Music,
  Trash2, Copy, Lock, Unlock, ArrowUp, ArrowDown
} from 'lucide-react';

export default function LayersPanel({
  layers = [],
  selectedLayerId = null,
  onSelectLayer,
  onAddLayer,
  onToggleVisibility,
  onToggleLock,
  onDeleteLayer,
  onDuplicateLayer,
  onMoveLayer,
  opacity = 100,
  onOpacityChange
}) {
  const [activeMenuId, setActiveMenuId] = useState(null);

  const getLayerIcon = (type) => {
    switch (type) {
      case 'video':
        return <Video className="w-3.5 h-3.5 text-indigo-400" />;
      case 'text':
        return <Type className="w-3.5 h-3.5 text-emerald-400" />;
      case 'overlay':
        return <ImageIcon className="w-3.5 h-3.5 text-purple-400" />;
      case 'sticker':
        return <Star className="w-3.5 h-3.5 text-amber-400" />;
      case 'adjustment':
        return <Sliders className="w-3.5 h-3.5 text-cyan-400" />;
      case 'audio':
        return <Music className="w-3.5 h-3.5 text-rose-400" />;
      default:
        return <Layers className="w-3.5 h-3.5 text-gray-400" />;
    }
  };

  return (
    <div className="relative flex flex-col justify-between w-full h-full bg-gray-950/70 dark:bg-gray-950/80 light:bg-white/80 rounded-2xl sm:rounded-3xl p-3 sm:p-4 border border-white/10 dark:border-white/10 light:border-gray-200 backdrop-blur-md shadow-2xl overflow-hidden">
      {/* Panel Header */}
      <div className="flex items-center justify-between pb-3 border-b border-white/10 dark:border-white/10 light:border-gray-200">
        <div className="flex items-center gap-2">
          <Sliders className="w-4 h-4 text-purple-400" />
          <span className="text-xs sm:text-sm font-bold text-white dark:text-white light:text-gray-900 tracking-wide">
            Layers
          </span>
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/10 text-gray-300 font-mono">
            {layers.length}
          </span>
        </div>

        <button
          onClick={onAddLayer}
          title="Add New Layer"
          className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-all active:scale-95 shadow-sm"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      {/* Scrollable Layer Stack */}
      <div className="flex-1 overflow-y-auto space-y-1.5 py-2.5 pr-1 max-h-[38vh] scrollbar-thin scrollbar-thumb-white/10">
        <AnimatePresence>
          {layers.map((layer, index) => {
            const isSelected = selectedLayerId === layer.id;
            const isMenuOpen = activeMenuId === layer.id;

            return (
              <motion.div
                key={layer.id}
                layout
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                onClick={() => onSelectLayer?.(layer.id)}
                className={`group relative flex items-center justify-between p-2 rounded-xl transition-all duration-150 cursor-pointer border ${
                  isSelected
                    ? 'bg-gradient-to-r from-purple-900/60 to-indigo-900/40 border-purple-500/80 shadow-lg shadow-purple-500/20 ring-1 ring-purple-400/40'
                    : 'bg-white/5 hover:bg-white/10 border-white/5 text-gray-300'
                }`}
              >
                {/* Left: Drag Handle & Thumbnail / Type Icon */}
                <div className="flex items-center gap-2 min-w-0">
                  <div className="text-gray-500 group-hover:text-gray-300 cursor-grab active:cursor-grabbing">
                    <GripVertical className="w-3.5 h-3.5" />
                  </div>

                  {/* Thumbnail or Icon Box */}
                  <div className="w-8 h-8 rounded-lg overflow-hidden bg-black/50 border border-white/10 flex items-center justify-center shrink-0">
                    {layer.thumbnail ? (
                      <img
                        src={layer.thumbnail}
                        alt={layer.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      getLayerIcon(layer.type)
                    )}
                  </div>

                  {/* Name & Duration */}
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-white dark:text-white light:text-gray-900 truncate">
                      {layer.title || `Layer ${index + 1}`}
                    </div>
                    <div className="text-[10px] text-gray-400 font-mono">
                      {layer.durationText || '00:15'}
                    </div>
                  </div>
                </div>

                {/* Right: Visibility & Options Menu */}
                <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                  {/* Visibility Toggle */}
                  <button
                    onClick={() => onToggleVisibility?.(layer.id)}
                    title={layer.visible ? 'Hide Layer' : 'Show Layer'}
                    className={`p-1 rounded-md transition-colors ${
                      layer.visible !== false
                        ? 'text-gray-400 hover:text-white'
                        : 'text-gray-600 bg-white/5'
                    }`}
                  >
                    {layer.visible !== false ? (
                      <Eye className="w-3.5 h-3.5" />
                    ) : (
                      <EyeOff className="w-3.5 h-3.5 text-rose-400" />
                    )}
                  </button>

                  {/* Context Menu Button */}
                  <div className="relative">
                    <button
                      onClick={() => setActiveMenuId(isMenuOpen ? null : layer.id)}
                      className="p-1 rounded-md text-gray-400 hover:text-white transition-colors"
                    >
                      <MoreHorizontal className="w-3.5 h-3.5" />
                    </button>

                    {isMenuOpen && (
                      <div className="absolute right-0 top-full mt-1 w-36 rounded-xl bg-gray-900/95 dark:bg-gray-900/95 light:bg-white/95 backdrop-blur-xl border border-white/15 dark:border-white/15 light:border-gray-200 shadow-2xl p-1 z-50">
                        {index > 0 && (
                          <button
                            onClick={() => {
                              onMoveLayer?.(layer.id, -1);
                              setActiveMenuId(null);
                            }}
                            className="w-full flex items-center gap-2 px-2 py-1.5 text-xs text-gray-300 hover:bg-white/10 rounded-lg text-left"
                          >
                            <ArrowUp className="w-3 h-3 text-indigo-400" />
                            <span>Bring Forward</span>
                          </button>
                        )}
                        {index < layers.length - 1 && (
                          <button
                            onClick={() => {
                              onMoveLayer?.(layer.id, 1);
                              setActiveMenuId(null);
                            }}
                            className="w-full flex items-center gap-2 px-2 py-1.5 text-xs text-gray-300 hover:bg-white/10 rounded-lg text-left"
                          >
                            <ArrowDown className="w-3 h-3 text-indigo-400" />
                            <span>Send Backward</span>
                          </button>
                        )}
                        <button
                          onClick={() => {
                            onDuplicateLayer?.(layer.id);
                            setActiveMenuId(null);
                          }}
                          className="w-full flex items-center gap-2 px-2 py-1.5 text-xs text-gray-300 hover:bg-white/10 rounded-lg text-left"
                        >
                          <Copy className="w-3 h-3 text-cyan-400" />
                          <span>Duplicate</span>
                        </button>
                        <button
                          onClick={() => {
                            onToggleLock?.(layer.id);
                            setActiveMenuId(null);
                          }}
                          className="w-full flex items-center gap-2 px-2 py-1.5 text-xs text-gray-300 hover:bg-white/10 rounded-lg text-left"
                        >
                          {layer.locked ? (
                            <>
                              <Unlock className="w-3 h-3 text-amber-400" />
                              <span>Unlock</span>
                            </>
                          ) : (
                            <>
                              <Lock className="w-3 h-3 text-amber-400" />
                              <span>Lock</span>
                            </>
                          )}
                        </button>
                        <div className="border-t border-white/10 my-1" />
                        <button
                          onClick={() => {
                            onDeleteLayer?.(layer.id);
                            setActiveMenuId(null);
                          }}
                          className="w-full flex items-center gap-2 px-2 py-1.5 text-xs text-rose-400 hover:bg-rose-500/20 rounded-lg text-left"
                        >
                          <Trash2 className="w-3 h-3" />
                          <span>Delete</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* Bottom Opacity Slider */}
      <div className="pt-3 border-t border-white/10 dark:border-white/10 light:border-gray-200">
        <div className="flex items-center justify-between text-xs text-gray-300 dark:text-gray-300 light:text-gray-700 mb-1">
          <span className="font-semibold">Opacity</span>
          <span className="font-mono text-purple-400 font-bold">{Math.round(opacity)}%</span>
        </div>
        <input
          type="range"
          min="0"
          max="100"
          value={opacity}
          onChange={(e) => onOpacityChange?.(parseInt(e.target.value, 10))}
          className="w-full h-2 bg-white/20 rounded-lg appearance-none cursor-pointer accent-purple-500"
        />
      </div>
    </div>
  );
}

LayersPanel.propTypes = {
  layers: PropTypes.array,
  selectedLayerId: PropTypes.string,
  onSelectLayer: PropTypes.func,
  onAddLayer: PropTypes.func,
  onToggleVisibility: PropTypes.func,
  onToggleLock: PropTypes.func,
  onDeleteLayer: PropTypes.func,
  onDuplicateLayer: PropTypes.func,
  onMoveLayer: PropTypes.func,
  opacity: PropTypes.number,
  onOpacityChange: PropTypes.func,
};
