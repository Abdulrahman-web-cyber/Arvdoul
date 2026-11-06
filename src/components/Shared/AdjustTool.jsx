/**
 * AdjustTool.jsx - Image adjustment panel
 * @description Sliders over the ImageEditor document's adjustment model.
 *
 * The contract is `adjustments` + `setAdjustment(key, value)`. Values are the
 * editor's deltas: brightness/contrast/saturation/temperature/hue are signed
 * offsets around 0, blur 0-20, vignette 0-100. The caller (ImageEditor) applies
 * them in `renderProcessed`, so this component must not assume a 0-200 or
 * 100-centered scale — doing so made every slider a no-op in the old version.
 *
 * @module Shared/AdjustTool
 */

import React, { useState, useCallback, useMemo, memo } from "react";
import { useTheme } from '../../context/ThemeContext';
import PropTypes from "prop-types";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sun,
  Contrast,
  Droplets,
  Thermometer,
  Palette,
  Sparkles,
  Moon,
  Focus,
  RotateCcw,
  ChevronDown,
  ChevronUp,
  Aperture,
} from "lucide-react";

/**
 * Adjustment presets for quick fixes
 */
const PRESETS = [
  { name: 'Original', values: { brightness: 0, contrast: 0, saturation: 0, temperature: 0, hue: 0, blur: 0, vignette: 0 } },
  { name: 'Portrait', values: { brightness: 6, contrast: 8, saturation: -8, temperature: -6, hue: 0, blur: 0, vignette: 0 } },
  { name: 'Landscape', values: { brightness: 6, contrast: 12, saturation: 18, temperature: 10, hue: 0, blur: 0, vignette: 0 } },
  { name: 'Dramatic', values: { brightness: -8, contrast: 26, saturation: 8, temperature: 0, hue: 0, blur: 0, vignette: 20 } },
  { name: 'Muted', values: { brightness: 4, contrast: -10, saturation: -35, temperature: 0, hue: 0, blur: 0, vignette: 0 } },
  { name: 'Vibrant', values: { brightness: 5, contrast: 16, saturation: 35, temperature: 5, hue: 0, blur: 0, vignette: 0 } },
];

/**
 * Main AdjustTool component
 */
const AdjustTool = memo(({
  adjustments = {},
  setAdjustment,
  resetAdjustments,
  pushUndo,
}) => {
    const { isDark } = useTheme();
  const [expandedSections, setExpandedSections] = useState({
    light: true,
    color: true,
    effects: false,
  });
  const [activePreset, setActivePreset] = useState(null);

  const {
    brightness = 0,
    contrast = 0,
    saturation = 0,
    temperature = 0,
    hue = 0,
    blur = 0,
    vignette = 0,
  } = adjustments;

  const toggleSection = useCallback((section) => {
    setExpandedSections((prev) => ({ ...prev, [section]: !prev[section] }));
  }, []);

  const handlePresetClick = useCallback((preset) => {
    if (preset.name === 'Original') {
      resetAdjustments();
      setActivePreset(null);
    } else {
      Object.entries(preset.values).forEach(([key, value]) => setAdjustment(key, value));
      setActivePreset(preset.name);
    }
  }, [setAdjustment, resetAdjustments]);

  const handleAdjustmentChange = useCallback((key, value) => {
    setAdjustment(key, value);
    setActivePreset(null);
  }, [setAdjustment]);

  const modifiedCount = useMemo(
    () => Object.values(adjustments).filter((v) => Number(v) !== 0).length,
    [adjustments]
  );

  return (
    <div className="w-full space-y-4 text-white">
      {/* Presets Section */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className={`text-xs font-semibold ${isDark ? 'text-white/60' : 'text-gray-500'} uppercase tracking-wider`}>
            Presets
          </span>
          <Sparkles className="w-4 h-4 text-white/40" />
        </div>
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((preset) => (
            <motion.button
              key={preset.name}
              type="button"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => handlePresetClick(preset)}
              className={`px-3 py-1.5 text-xs font-medium rounded-xl transition-all duration-200 ${
                activePreset === preset.name
                  ? 'bg-gradient-to-r from-purple-600 to-cyan-500 text-white shadow-lg'
                  : 'bg-white/10 text-white/80 hover:bg-white/20'
              }`}
            >
              {preset.name}
            </motion.button>
          ))}
        </div>
      </div>

      {/* Light */}
      <Section
        title="Light"
        icon={Sun}
        expanded={expandedSections.light}
        onToggle={() => toggleSection('light')}
        count={2}
      >
        <AdjustmentSlider
          icon={Sun}
          label="Brightness"
          value={brightness}
          min={-100}
          max={100}
          defaultValue={0}
          onChange={(v) => handleAdjustmentChange('brightness', v)}
          onPointerUp={pushUndo}
        />
        <AdjustmentSlider
          icon={Contrast}
          label="Contrast"
          value={contrast}
          min={-100}
          max={100}
          defaultValue={0}
          onChange={(v) => handleAdjustmentChange('contrast', v)}
          onPointerUp={pushUndo}
        />
      </Section>

      {/* Color */}
      <Section
        title="Color"
        icon={Palette}
        expanded={expandedSections.color}
        onToggle={() => toggleSection('color')}
        count={3}
      >
        <AdjustmentSlider
          icon={Droplets}
          label="Saturation"
          value={saturation}
          min={-100}
          max={100}
          defaultValue={0}
          onChange={(v) => handleAdjustmentChange('saturation', v)}
          onPointerUp={pushUndo}
        />
        <AdjustmentSlider
          icon={Thermometer}
          label="Temperature"
          value={temperature}
          min={-100}
          max={100}
          defaultValue={0}
          onChange={(v) => handleAdjustmentChange('temperature', v)}
          onPointerUp={pushUndo}
        />
        <AdjustmentSlider
          icon={Aperture}
          label="Hue"
          value={hue}
          min={-180}
          max={180}
          defaultValue={0}
          onChange={(v) => handleAdjustmentChange('hue', v)}
          onPointerUp={pushUndo}
          showDegrees
        />
      </Section>

      {/* Effects */}
      <Section
        title="Effects"
        icon={Moon}
        expanded={expandedSections.effects}
        onToggle={() => toggleSection('effects')}
        count={2}
      >
        <AdjustmentSlider
          icon={Focus}
          label="Blur"
          value={blur}
          min={0}
          max={20}
          defaultValue={0}
          onChange={(v) => handleAdjustmentChange('blur', v)}
          onPointerUp={pushUndo}
        />
        <AdjustmentSlider
          icon={Moon}
          label="Vignette"
          value={vignette}
          min={0}
          max={100}
          defaultValue={0}
          onChange={(v) => handleAdjustmentChange('vignette', v)}
          onPointerUp={pushUndo}
        />
      </Section>

      {/* Reset Button */}
      <div className={`flex items-center justify-between pt-2 border-t ${isDark ? 'border-white/10' : 'border-gray-200'}`}>
        <span className="text-xs text-white/50">
          {modifiedCount > 0 ? `${modifiedCount} adjustments modified` : 'No changes'}
        </span>
        <motion.button
          type="button"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => {
            resetAdjustments();
            setActivePreset(null);
          }}
          className={`px-4 py-2 text-xs font-medium rounded-xl ${isDark ? 'bg-white/10' : 'bg-black/5'} hover:bg-white/20 text-white/80 transition-colors flex items-center gap-2`}
        >
          <RotateCcw className="w-3.5 h-3.5" />
          Reset All
        </motion.button>
      </div>
    </div>
  );
});

AdjustTool.displayName = 'AdjustTool';

AdjustTool.propTypes = {
  /** Adjustment deltas, e.g. { brightness, contrast, saturation, temperature, hue, blur, vignette } */
  adjustments: PropTypes.objectOf(PropTypes.number),
  /** Update a single adjustment by key */
  setAdjustment: PropTypes.func.isRequired,
  /** Reset all adjustments to their defaults */
  resetAdjustments: PropTypes.func.isRequired,
  /** Push current state to the history stack */
};

/**
 * Collapsible section component
 */
const Section = memo(({
  title,
  icon: Icon,
  expanded,
  onToggle,
  count,
  modified,
  children,
}) => {
    const { isDark } = useTheme();
  return (
    <div className={`rounded-2xl ${isDark ? 'bg-white/5' : 'bg-black/[0.03]'} border ${isDark ? 'border-white/10' : 'border-gray-200'} overflow-hidden`}>
      <button
        onClick={onToggle}
        className={`w-full flex items-center justify-between p-3 hover:${isDark ? 'bg-white/5' : 'bg-black/[0.03]'} transition-colors`}
        aria-expanded={expanded}
      >
        <div className="flex items-center gap-2">
          <Icon className={`w-4 h-4 text-white/60`} />
          <span className="text-sm font-medium text-white">{title}</span>
          <span className="text-xs text-white/40">({count})</span>
          {modified > 0 && (
            <span className="px-1.5 py-0.5 text-[10px] font-semibold rounded-full bg-purple-500/30 text-purple-300">
              {modified}
            </span>
          )}
        </div>
        {expanded ? (
          <ChevronUp className="w-4 h-4 text-white/40" />
        ) : (
          <ChevronDown className="w-4 h-4 text-white/40" />
        )}
      </button>
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="p-3 pt-0 space-y-4">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});

Section.displayName = 'Section';

Section.propTypes = {
  title: PropTypes.string.isRequired,
  icon: PropTypes.elementType.isRequired,
  expanded: PropTypes.bool.isRequired,
  onToggle: PropTypes.func.isRequired,
  count: PropTypes.number,
  modified: PropTypes.number,
  children: PropTypes.node,
};

export default AdjustTool;