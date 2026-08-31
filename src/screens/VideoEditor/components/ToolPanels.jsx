// src/screens/VideoEditor/components/ToolPanels.jsx
import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { motion } from 'framer-motion';
import {
  Palette, Sliders, Type, Music, Smile, Layers, Sparkles,
  Wand2, Plus, Check, Play, Pause, RefreshCw, Volume2, Mic,
  Download, Image as ImageIcon, Zap, Scissors, Bot
} from 'lucide-react';
import {
  FILTERS_LIST, TRANSITIONS_LIST, EFFECTS_LIST, FONT_LIST,
  STICKER_CATEGORIES, STOCK_AUDIO, STOCK_VIDEOS
} from '../constants';

export default function ToolPanels({
  activeTool,
  filterId = 'none',
  onSelectFilter,
  adjustments = {
    brightness: 100,
    contrast: 100,
    saturate: 100,
    blur: 0,
    sepia: 0,
    hueRotate: 0,
    opacity: 100
  },
  onUpdateAdjustment,
  onResetAdjustments,
  transitionId = 'none',
  onSelectTransition,
  activeEffect = 'none',
  onSelectEffect,
  onAddTextClip,
  onAddStickerClip,
  onAddAudioClip,
  onAddStockVideo,
  onApplyAITool,
  isProcessingAI = false,
  aiStatusMessage = '',
}) {
  // Local state for text adder
  const [newText, setNewText] = useState('New Title');
  const [selectedFont, setSelectedFont] = useState('Plus Jakarta Sans');
  const [textColor, setTextColor] = useState('#ffffff');
  const [textBgColor, setTextBgColor] = useState('rgba(16,185,129,0.25)');
  const [textFontSize, setTextFontSize] = useState(32);

  // Sticker subcategory
  const [stickerCategory, setStickerCategory] = useState('emojis');

  // Audio preview playback
  const [previewingAudioId, setPreviewingAudioId] = useState(null);
  const [audioEl, setAudioEl] = useState(null);

  const togglePreviewAudio = (audio) => {
    if (previewingAudioId === audio.id) {
      audioEl?.pause();
      setPreviewingAudioId(null);
    } else {
      audioEl?.pause();
      const newAudio = new Audio(audio.url);
      newAudio.play().catch(() => {});
      newAudio.onended = () => setPreviewingAudioId(null);
      setAudioEl(newAudio);
      setPreviewingAudioId(audio.id);
    }
  };

  // Render sub-panel depending on active ribbon tool
  switch (activeTool) {
    case 'filters':
      return (
        <div className="w-full bg-gray-950/70 dark:bg-gray-950/80 light:bg-white/80 rounded-2xl sm:rounded-3xl p-3 sm:p-4 border border-white/10 dark:border-white/10 light:border-gray-200 backdrop-blur-md shadow-2xl">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Palette className="w-4 h-4 text-purple-400" />
              <span className="text-xs sm:text-sm font-bold text-white dark:text-white light:text-gray-900">
                Cinematic Color Presets & LUTs
              </span>
            </div>
            <button
              onClick={() => onSelectFilter?.('none')}
              className="text-[11px] text-gray-400 hover:text-white px-2 py-0.5 rounded-lg bg-white/5"
            >
              Reset Filter
            </button>
          </div>

          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-12 gap-2 max-h-36 overflow-y-auto pr-1">
            {FILTERS_LIST.map((filter) => {
              const isSelected = filterId === filter.id;
              return (
                <button
                  key={filter.id}
                  onClick={() => onSelectFilter?.(filter.id)}
                  className={`group flex flex-col items-center p-1.5 rounded-xl transition-all ${
                    isSelected
                      ? 'bg-purple-600/30 border border-purple-500 ring-2 ring-purple-400/50 scale-105'
                      : 'bg-white/5 hover:bg-white/10 border border-white/5'
                  }`}
                >
                  <div className={`w-full h-10 rounded-lg ${filter.thumbnail} shadow-inner flex items-center justify-center relative overflow-hidden`}>
                    {isSelected && (
                      <div className="w-5 h-5 rounded-full bg-black/60 flex items-center justify-center text-purple-400">
                        <Check className="w-3.5 h-3.5" />
                      </div>
                    )}
                  </div>
                  <span className="text-[11px] font-medium text-gray-200 truncate mt-1 w-full text-center">
                    {filter.name}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      );

    case 'adjust':
      return (
        <div className="w-full bg-gray-950/70 dark:bg-gray-950/80 light:bg-white/80 rounded-2xl sm:rounded-3xl p-3 sm:p-4 border border-white/10 dark:border-white/10 light:border-gray-200 backdrop-blur-md shadow-2xl">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Sliders className="w-4 h-4 text-cyan-400" />
              <span className="text-xs sm:text-sm font-bold text-white dark:text-white light:text-gray-900">
                Precision Color Adjustments
              </span>
            </div>
            <button
              onClick={onResetAdjustments}
              className="flex items-center gap-1 text-[11px] text-gray-400 hover:text-white px-2 py-0.5 rounded-lg bg-white/5"
            >
              <RefreshCw className="w-3 h-3" />
              <span>Reset All</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {[
              { id: 'brightness', label: 'Brightness', min: 20, max: 200, unit: '%' },
              { id: 'contrast', label: 'Contrast', min: 20, max: 200, unit: '%' },
              { id: 'saturate', label: 'Saturation', min: 0, max: 250, unit: '%' },
              { id: 'blur', label: 'Blur Softness', min: 0, max: 20, unit: 'px' },
              { id: 'sepia', label: 'Sepia Warmth', min: 0, max: 100, unit: '%' },
              { id: 'hueRotate', label: 'Hue Rotate', min: 0, max: 360, unit: '°' },
            ].map((param) => (
              <div key={param.id} className="bg-black/30 p-2 rounded-xl border border-white/5">
                <div className="flex items-center justify-between text-xs text-gray-300 mb-1">
                  <span className="font-semibold">{param.label}</span>
                  <span className="font-mono text-purple-400 font-bold">
                    {adjustments[param.id] ?? 100}{param.unit}
                  </span>
                </div>
                <input
                  type="range"
                  min={param.min}
                  max={param.max}
                  value={adjustments[param.id] ?? 100}
                  onChange={(e) => onUpdateAdjustment?.(param.id, parseFloat(e.target.value))}
                  className="w-full h-1.5 bg-white/20 rounded-lg appearance-none cursor-pointer accent-purple-500"
                />
              </div>
            ))}
          </div>
        </div>
      );

    case 'transition':
      return (
        <div className="w-full bg-gray-950/70 dark:bg-gray-950/80 light:bg-white/80 rounded-2xl sm:rounded-3xl p-3 sm:p-4 border border-white/10 dark:border-white/10 light:border-gray-200 backdrop-blur-md shadow-2xl">
          <div className="flex items-center gap-2 mb-2">
            <Layers className="w-4 h-4 text-purple-400" />
            <span className="text-xs sm:text-sm font-bold text-white">Clip Transitions</span>
          </div>

          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-12 gap-2">
            {TRANSITIONS_LIST.map((t) => {
              const isSelected = transitionId === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => onSelectTransition?.(t.id)}
                  className={`flex flex-col items-center justify-center p-2 rounded-xl text-xs transition-all ${
                    isSelected
                      ? 'bg-purple-600/30 border border-purple-500 text-purple-300 ring-1 ring-purple-400'
                      : 'bg-white/5 hover:bg-white/10 text-gray-300 border border-white/5'
                  }`}
                >
                  <Sparkles className="w-4 h-4 mb-1 text-purple-400" />
                  <span className="text-[11px] truncate">{t.name}</span>
                </button>
              );
            })}
          </div>
        </div>
      );

    case 'text':
      return (
        <div className="w-full bg-gray-950/70 dark:bg-gray-950/80 light:bg-white/80 rounded-2xl sm:rounded-3xl p-3 sm:p-4 border border-white/10 dark:border-white/10 light:border-gray-200 backdrop-blur-md shadow-2xl">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Type className="w-4 h-4 text-emerald-400" />
              <span className="text-xs sm:text-sm font-bold text-white">Typography & Titles</span>
            </div>
            <button
              onClick={() => {
                if (newText.trim()) {
                  onAddTextClip?.({
                    text: newText,
                    fontFamily: selectedFont,
                    color: textColor,
                    bgColor: textBgColor,
                    fontSize: textFontSize,
                  });
                }
              }}
              className="flex items-center gap-1.5 px-3 py-1 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-xl text-xs font-semibold shadow-md active:scale-95 transition-all"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add to Timeline</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="md:col-span-2">
              <input
                type="text"
                value={newText}
                onChange={(e) => setNewText(e.target.value)}
                placeholder="Enter caption or title..."
                className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/15 text-white text-xs outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <select
                value={selectedFont}
                onChange={(e) => setSelectedFont(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/15 text-white text-xs outline-none"
              >
                {FONT_LIST.map((f) => (
                  <option key={f.id} value={f.id} className="bg-gray-900 text-white">
                    {f.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1">
                <span className="text-[10px] text-gray-400">Color</span>
                <input
                  type="color"
                  value={textColor}
                  onChange={(e) => setTextColor(e.target.value)}
                  className="w-7 h-7 rounded-lg border-0 cursor-pointer bg-transparent"
                />
              </div>
              <div className="flex-1 flex items-center gap-1">
                <span className="text-[10px] text-gray-400">Size</span>
                <input
                  type="range"
                  min="16"
                  max="64"
                  value={textFontSize}
                  onChange={(e) => setTextFontSize(parseInt(e.target.value, 10))}
                  className="w-full h-1 bg-white/20 rounded accent-emerald-500"
                />
              </div>
            </div>
          </div>
        </div>
      );

    case 'stickers':
      return (
        <div className="w-full bg-gray-950/70 dark:bg-gray-950/80 light:bg-white/80 rounded-2xl sm:rounded-3xl p-3 sm:p-4 border border-white/10 dark:border-white/10 light:border-gray-200 backdrop-blur-md shadow-2xl">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Smile className="w-4 h-4 text-amber-400" />
              <span className="text-xs sm:text-sm font-bold text-white">Stickers & Graphics</span>
            </div>

            {/* Category tabs */}
            <div className="flex items-center gap-1 bg-black/40 p-0.5 rounded-xl border border-white/10">
              {STICKER_CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setStickerCategory(cat.id)}
                  className={`px-2.5 py-0.5 rounded-lg text-xs font-semibold transition-all ${
                    stickerCategory === cat.id
                      ? 'bg-purple-600 text-white'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  {cat.name}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2 overflow-x-auto py-1">
            {STICKER_CATEGORIES.find((c) => c.id === stickerCategory)?.items.map((item, idx) => (
              <button
                key={idx}
                onClick={() => onAddStickerClip?.(item)}
                className="w-12 h-12 rounded-2xl bg-white/5 hover:bg-purple-600/20 border border-white/10 hover:border-purple-500 flex items-center justify-center text-2xl transition-all active:scale-95 shrink-0"
              >
                {item}
              </button>
            ))}
          </div>
        </div>
      );

    case 'audio':
      return (
        <div className="w-full bg-gray-950/70 dark:bg-gray-950/80 light:bg-white/80 rounded-2xl sm:rounded-3xl p-3 sm:p-4 border border-white/10 dark:border-white/10 light:border-gray-200 backdrop-blur-md shadow-2xl">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Music className="w-4 h-4 text-emerald-400" />
              <span className="text-xs sm:text-sm font-bold text-white">Royalty-Free Music Library</span>
            </div>
          </div>

          {STOCK_AUDIO.length === 0 && (
            <div className="flex flex-col items-center justify-center text-center py-6">
              <Music className="w-8 h-8 text-gray-500 mb-2" />
              <p className="text-xs font-semibold text-white mb-1">No royalty-free tracks yet</p>
              <p className="text-[11px] text-gray-400">
                The licensed music catalog will appear here once a provider is connected. Record a voiceover or add your own audio instead.
              </p>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2">
            {STOCK_AUDIO.map((audio) => {
              const isPlaying = previewingAudioId === audio.id;
              return (
                <div
                  key={audio.id}
                  className="flex items-center justify-between p-2.5 rounded-xl bg-black/40 border border-white/10 hover:border-white/20 transition-colors"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <button
                      onClick={() => togglePreviewAudio(audio)}
                      className="w-8 h-8 rounded-full bg-emerald-600/30 text-emerald-400 hover:bg-emerald-600 hover:text-white flex items-center justify-center transition-all shrink-0"
                    >
                      {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 ml-0.5" />}
                    </button>
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-white truncate">{audio.title}</div>
                      <div className="text-[10px] text-gray-400">{audio.genre} • {audio.duration}</div>
                    </div>
                  </div>

                  <button
                    onClick={() => onAddAudioClip?.(audio)}
                    className="p-1.5 rounded-lg bg-white/10 hover:bg-emerald-600 text-white transition-colors ml-2"
                    title="Add track to timeline"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      );

    case 'effects':
      return (
        <div className="w-full bg-gray-950/70 dark:bg-gray-950/80 light:bg-white/80 rounded-2xl sm:rounded-3xl p-3 sm:p-4 border border-white/10 dark:border-white/10 light:border-gray-200 backdrop-blur-md shadow-2xl">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-purple-400" />
              <span className="text-xs sm:text-sm font-bold text-white">Visual FX & Shaders</span>
            </div>
            <button
              onClick={() => onSelectEffect?.('none')}
              className="text-[11px] text-gray-400 hover:text-white px-2 py-0.5 rounded-lg bg-white/5"
            >
              Clear Effects
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
            {EFFECTS_LIST.map((fx) => {
              const isSelected = activeEffect === fx.id;
              return (
                <button
                  key={fx.id}
                  onClick={() => onSelectEffect?.(fx.id)}
                  className={`flex flex-col p-2 rounded-xl text-left transition-all ${
                    isSelected
                      ? 'bg-purple-600/30 border border-purple-500 ring-1 ring-purple-400'
                      : 'bg-white/5 hover:bg-white/10 border border-white/5'
                  }`}
                >
                  <span className="text-xs font-semibold text-white">{fx.name}</span>
                  <span className="text-[10px] text-gray-400 truncate mt-0.5">{fx.desc}</span>
                </button>
              );
            })}
          </div>
        </div>
      );

    case 'ai':
      return (
        <div className="w-full bg-gray-950/70 dark:bg-gray-950/80 light:bg-white/80 rounded-2xl sm:rounded-3xl p-3 sm:p-4 border border-white/10 dark:border-white/10 light:border-gray-200 backdrop-blur-md shadow-2xl">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Wand2 className="w-4 h-4 text-purple-400" />
              <span className="text-xs sm:text-sm font-bold text-white">AI Studio Copilot</span>
            </div>
            {isProcessingAI && (
              <span className="text-xs text-purple-400 flex items-center gap-1.5 animate-pulse">
                <Bot className="w-3.5 h-3.5" />
                <span>{aiStatusMessage || 'Generating with AI...'}</span>
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2">
            {[
              { id: 'captions', title: 'Auto Subtitles & Captions', desc: 'Generate synchronized speech-to-text', icon: Type },
              { id: 'smart_cut', title: 'Smart Silence Trimmer', desc: 'Remove pauses and dead air automatically', icon: Scissors },
              { id: 'enhance', title: 'Studio Audio Enhancer', desc: 'Noise reduction & vocal warmth boost', icon: Zap },
              { id: 'bg_remove', title: 'Magic Background Remover', desc: 'AI rotoscoping cutout without green screen', icon: Wand2 },
            ].map((tool) => {
              const Icon = tool.icon;
              return (
                <button
                  key={tool.id}
                  onClick={() => onApplyAITool?.(tool.id)}
                  disabled={isProcessingAI}
                  className="flex items-start gap-2.5 p-3 rounded-2xl bg-gradient-to-br from-white/5 to-white/[0.02] hover:from-purple-600/20 hover:to-indigo-600/10 border border-white/10 hover:border-purple-500/50 text-left transition-all group"
                >
                  <div className="w-8 h-8 rounded-xl bg-purple-600/20 text-purple-400 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                    <Icon className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-white">{tool.title}</div>
                    <div className="text-[10px] text-gray-400 leading-tight mt-0.5">{tool.desc}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      );

    default:
      return null;
  }
}

ToolPanels.propTypes = {
  activeTool: PropTypes.string,
  filterId: PropTypes.string,
  onSelectFilter: PropTypes.func,
  adjustments: PropTypes.object,
  onUpdateAdjustment: PropTypes.func,
  onResetAdjustments: PropTypes.func,
  transitionId: PropTypes.string,
  onSelectTransition: PropTypes.func,
  activeEffect: PropTypes.string,
  onSelectEffect: PropTypes.func,
  onAddTextClip: PropTypes.func,
  onAddStickerClip: PropTypes.func,
  onAddAudioClip: PropTypes.func,
  onAddStockVideo: PropTypes.func,
  onApplyAITool: PropTypes.func,
  isProcessingAI: PropTypes.bool,
  aiStatusMessage: PropTypes.string,
};
