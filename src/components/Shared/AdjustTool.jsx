/**
 * AdjustTool.jsx - Professional Image Adjustment Component
 * @description Provides comprehensive image adjustments including exposure, temperature, tint, and more
 * @module Shared/AdjustTool
 * @requires React, framer-motion, lucide-react, prop-types
 */

import React, { useState, useCallback, useMemo, memo } from "react";
import PropTypes from "prop-types";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sun,
  Contrast,
  Droplets,
  Thermometer,
  Palette,
  Sunrise,
  Moon,
  Sparkles,
  Focus,
  Haze,
  Layers,
  CircleDot,
  Grid3x3,
  RotateCcw,
  ChevronDown,
  ChevronUp,
  Wand2,
} from "lucide-react";

// ARVDOUL Design System
const DNA_GRADIENT = 'linear-gradient(135deg, #B416DB 0%, #872FE2 35%, #4B6BFF 70%, #0EA3E6 100%)';
const DNA_SHADOW = '0 0 20px rgba(147,51,234,0.4)';

/**
 * Adjustment presets for quick fixes
 */
const PRESETS = [
  { name: 'Original', values: { brightness: 100, contrast: 100, saturation: 100, exposure: 0, temperature: 0, tint: 0 } },
  { name: 'Portrait', values: { brightness: 105, contrast: 110, saturation: 90, exposure: 0, temperature: -5, tint: 5 } },
  { name: 'Landscape', values: { brightness: 105, contrast: 115, saturation: 120, exposure: 5, temperature: 10, tint: 0 } },
  { name: 'Dramatic', values: { brightness: 90, contrast: 130, saturation: 110, exposure: -5, temperature: 0, tint: 0 } },
  { name: 'Muted', values: { brightness: 105, contrast: 90, saturation: 60, exposure: 0, temperature: 0, tint: 0 } },
  { name: 'Vibrant', values: { brightness: 105, contrast: 120, saturation: 140, exposure: 5, temperature: 5, tint: 0 } },
];

/**
 * Individual slider component with ARVDOUL styling
 */
const AdjustmentSlider = memo(({
  icon: Icon,
  label,
  value,
  min,
  max,
  defaultValue,
  onChange,
  onPointerUp,
  step = 1,
  showPercentage = false,
  showDegrees = false,
}) => {
  const percentage = useMemo(() => {
    return Math.round(((value - min) / (max - min)) * 100);
  }, [value, min, max]);

  const isModified = value !== defaultValue;
  
  const displayValue = useMemo(() => {
    if (showPercentage) return `${percentage}%`;
    if (showDegrees) return `${value > 0 ? '+' : ''}${value}°`;
    return value;
  }, [value, showPercentage, showDegrees, percentage]);

  const handleReset = useCallback(() => {
    onChange(defaultValue);
    onPointerUp?.();
  }, [onChange, defaultValue, onPointerUp]);

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className={`w-4 h-4 ${isModified ? 'text-purple-400' : 'text-white/50'}`} />
          <span className={`text-xs font-medium ${isModified ? 'text-white' : 'text-white/70'}`}>
            {label}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-white/50 tabular-nums">{displayValue}</span>
          {isModified && (
            <button
              onClick={handleReset}
              className="p-0.5 rounded hover:bg-white/10 transition-colors"
              aria-label={`Reset ${label}`}
            >
              <RotateCcw className="w-3 h-3 text-purple-400" />
            </button>
          )}
        </div>
      </div>
      <div className="relative h-8 flex items-center">
        <div className="absolute inset-x-0 h-1.5 rounded-full bg-white/10 overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-75"
            style={{
              width: `${percentage}%`,
              background: DNA_GRADIENT,
              boxShadow: isModified ? DNA_SHADOW : 'none',
            }}
          />
        </div>
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          onPointerUp={onPointerUp}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          aria-label={`${label}: ${value}`}
        />
        {/* Custom thumb */}
        <div
          className="absolute w-4 h-4 rounded-full bg-white shadow-lg pointer-events-none transition-all duration-75"
          style={{
            left: `calc(${percentage}% - 8px)`,
            boxShadow: isModified ? DNA_SHADOW : '0 2px 4px rgba(0,0,0,0.3)',
          }}
        />
      </div>
    </div>
  );
});

AdjustmentSlider.displayName = 'AdjustmentSlider';

AdjustmentSlider.propTypes = {
  icon: PropTypes.elementType.isRequired,
  label: PropTypes.string.isRequired,
  value: PropTypes.number.isRequired,
  min: PropTypes.number.isRequired,
  max: PropTypes.number.isRequired,
  defaultValue: PropTypes.number.isRequired,
  onChange: PropTypes.func.isRequired,
  onPointerUp: PropTypes.func,
  step: PropTypes.number,
  showPercentage: PropTypes.bool,
  showDegrees: PropTypes.bool,
};

/**
 * Main AdjustTool component
 */
const AdjustTool = memo(({
  adjustments = {},
  setAdjustment,
  resetAdjustments,
  pushUndo,
  presets = PRESETS,
}) => {
  const [expandedSections, setExpandedSections] = useState({
    basic: true,
    color: true,
    effects: false,
    details: false,
  });
  const [activePreset, setActivePreset] = useState(null);

  // Destructure all adjustment values with defaults
  const {
    brightness = 100,
    contrast = 100,
    saturation = 100,
    exposure = 0,
    temperature = 0,
    tint = 0,
    highlights = 0,
    shadows = 0,
    whites = 0,
    blacks = 0,
    clarity = 0,
    sharpness = 0,
    dehaze = 0,
    fade = 0,
    grain = 0,
    vignette = 0,
    gamma = 100,
  } = adjustments;

  const toggleSection = useCallback((section) => {
    setExpandedSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  }, []);

  const handlePresetClick = useCallback((preset) => {
    if (preset.name === 'Original') {
      resetAdjustments();
      setActivePreset(null);
    } else {
      Object.entries(preset.values).forEach(([key, value]) => {
        setAdjustment(key, value);
      });
      setActivePreset(preset.name);
    }
    pushUndo?.();
  }, [setAdjustment, resetAdjustments, pushUndo]);

  const handleAdjustmentChange = useCallback((key, value) => {
    setAdjustment(key, value);
    setActivePreset(null);
  }, [setAdjustment]);

  // Count modified adjustments
  const modifiedCount = useMemo(() => {
    return Object.entries(adjustments).filter(([key, value]) => {
      const defaultValue = PRESETS[0].values[key];
      return value !== (defaultValue ?? 100);
    }).length;
  }, [adjustments]);

  return (
    <div className="w-full space-y-4 text-white">
      {/* Presets Section */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-white/60 uppercase tracking-wider">
            Presets
          </span>
          <Wand2 className="w-4 h-4 text-white/40" />
        </div>
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((preset) => (
            <motion.button
              key={preset.name}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => handlePresetClick(preset)}
              className={`
                px-3 py-1.5 text-xs font-medium rounded-xl transition-all duration-200
                ${activePreset === preset.name
                  ? 'bg-gradient-to-r from-purple-600 to-cyan-500 text-white shadow-lg'
                  : 'bg-white/10 text-white/80 hover:bg-white/20'
                }
              `}
            >
              {preset.name}
            </motion.button>
          ))}
        </div>
      </div>

      {/* Basic Adjustments */}
      <Section
        title="Light"
        icon={Sun}
        expanded={expandedSections.basic}
        onToggle={() => toggleSection('basic')}
        count={3}
        modified={[
          brightness !== 100,
          contrast !== 100,
          saturation !== 100,
        ].filter(Boolean).length}
      >
        <div className="space-y-4">
          <AdjustmentSlider
            icon={Sun}
            label="Brightness"
            value={brightness}
            min={0}
            max={200}
            defaultValue={100}
            onChange={(v) => handleAdjustmentChange('brightness', v)}
            onPointerUp={pushUndo}
          />
          <AdjustmentSlider
            icon={Contrast}
            label="Contrast"
            value={contrast}
            min={0}
            max={200}
            defaultValue={100}
            onChange={(v) => handleAdjustmentChange('contrast', v)}
            onPointerUp={pushUndo}
          />
          <AdjustmentSlider
            icon={Sparkles}
            label="Exposure"
            value={exposure}
            min={-100}
            max={100}
            defaultValue={0}
            onChange={(v) => handleAdjustmentChange('exposure', v)}
            onPointerUp={pushUndo}
            showDegrees
          />
        </div>
      </Section>

      {/* Color Adjustments */}
      <Section
        title="Color"
        icon={Palette}
        expanded={expandedSections.color}
        onToggle={() => toggleSection('color')}
        count={3}
        modified={[
          saturation !== 100,
          temperature !== 0,
          tint !== 0,
        ].filter(Boolean).length}
      >
        <div className="space-y-4">
          <AdjustmentSlider
            icon={Droplets}
            label="Saturation"
            value={saturation}
            min={0}
            max={200}
            defaultValue={100}
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
            showDegrees
          />
          <AdjustmentSlider
            icon={Palette}
            label="Tint"
            value={tint}
            min={-100}
            max={100}
            defaultValue={0}
            onChange={(v) => handleAdjustmentChange('tint', v)}
            onPointerUp={pushUndo}
            showDegrees
          />
        </div>
      </Section>

      {/* Tone Adjustments */}
      <Section
        title="Tone"
        icon={Moon}
        expanded={expandedSections.effects}
        onToggle={() => toggleSection('effects')}
        count={4}
        modified={[
          highlights !== 0,
          shadows !== 0,
          whites !== 0,
          blacks !== 0,
        ].filter(Boolean).length}
      >
        <div className="space-y-4">
          <AdjustmentSlider
            icon={Sunrise}
            label="Highlights"
            value={highlights}
            min={-100}
            max={100}
            defaultValue={0}
            onChange={(v) => handleAdjustmentChange('highlights', v)}
            onPointerUp={pushUndo}
            showDegrees
          />
          <AdjustmentSlider
            icon={Moon}
            label="Shadows"
            value={shadows}
            min={-100}
            max={100}
            defaultValue={0}
            onChange={(v) => handleAdjustmentChange('shadows', v)}
            onPointerUp={pushUndo}
            showDegrees
          />
          <AdjustmentSlider
            icon={Sun}
            label="Whites"
            value={whites}
            min={-100}
            max={100}
            defaultValue={0}
            onChange={(v) => handleAdjustmentChange('whites', v)}
            onPointerUp={pushUndo}
            showDegrees
          />
          <AdjustmentSlider
            icon={CircleDot}
            label="Blacks"
            value={blacks}
            min={-100}
            max={100}
            defaultValue={0}
            onChange={(v) => handleAdjustmentChange('blacks', v)}
            onPointerUp={pushUndo}
            showDegrees
          />
        </div>
      </Section>

      {/* Detail Adjustments */}
      <Section
        title="Detail"
        icon={Focus}
        expanded={expandedSections.details}
        onToggle={() => toggleSection('details')}
        count={6}
        modified={[
          clarity !== 0,
          sharpness !== 0,
          dehaze !== 0,
          fade !== 0,
          grain !== 0,
          vignette !== 0,
        ].filter(Boolean).length}
      >
        <div className="space-y-4">
          <AdjustmentSlider
            icon={Focus}
            label="Clarity"
            value={clarity}
            min={-100}
            max={100}
            defaultValue={0}
            onChange={(v) => handleAdjustmentChange('clarity', v)}
            onPointerUp={pushUndo}
            showDegrees
          />
          <AdjustmentSlider
            icon={Layers}
            label="Sharpness"
            value={sharpness}
            min={0}
            max={100}
            defaultValue={0}
            onChange={(v) => handleAdjustmentChange('sharpness', v)}
            onPointerUp={pushUndo}
          />
          <AdjustmentSlider
            icon={Haze}
            label="Dehaze"
            value={dehaze}
            min={-100}
            max={100}
            defaultValue={0}
            onChange={(v) => handleAdjustmentChange('dehaze', v)}
            onPointerUp={pushUndo}
            showDegrees
          />
          <AdjustmentSlider
            icon={Layers}
            label="Fade"
            value={fade}
            min={0}
            max={100}
            defaultValue={0}
            onChange={(v) => handleAdjustmentChange('fade', v)}
            onPointerUp={pushUndo}
          />
          <AdjustmentSlider
            icon={Grid3x3}
            label="Grain"
            value={grain}
            min={0}
            max={100}
            defaultValue={0}
            onChange={(v) => handleAdjustmentChange('grain', v)}
            onPointerUp={pushUndo}
          />
          <AdjustmentSlider
            icon={CircleDot}
            label="Vignette"
            value={vignette}
            min={0}
            max={100}
            defaultValue={0}
            onChange={(v) => handleAdjustmentChange('vignette', v)}
            onPointerUp={pushUndo}
          />
        </div>
      </Section>

      {/* Reset Button */}
      <div className="flex items-center justify-between pt-2 border-t border-white/10">
        <span className="text-xs text-white/50">
          {modifiedCount > 0 ? `${modifiedCount} adjustments modified` : 'No changes'}
        </span>
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => {
            resetAdjustments();
            setActivePreset(null);
            pushUndo?.();
          }}
          className="px-4 py-2 text-xs font-medium rounded-xl bg-white/10 hover:bg-white/20 text-white/80 transition-colors flex items-center gap-2"
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
  /** Object containing all adjustment values */
  adjustments: PropTypes.objectOf(PropTypes.number),
  /** Function to update a single adjustment value */
  setAdjustment: PropTypes.func.isRequired,
  /** Function to reset all adjustments to default */
  resetAdjustments: PropTypes.func.isRequired,
  /** Function to push current state to history stack */
  pushUndo: PropTypes.func,
  /** Array of preset configurations */
  presets: PropTypes.arrayOf(
    PropTypes.shape({
      name: PropTypes.string.isRequired,
      values: PropTypes.objectOf(PropTypes.number).isRequired,
    })
  ),
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
  return (
    <div className="rounded-2xl bg-white/5 border border-white/10 overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-3 hover:bg-white/5 transition-colors"
        aria-expanded={expanded}
      >
        <div className="flex items-center gap-2">
          <Icon className="w-4 h-4 text-white/60" />
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