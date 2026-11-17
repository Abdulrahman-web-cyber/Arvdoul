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

import { useState, useCallback, useMemo, memo } from "react";
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
    <div className={`w-full space-y-4 ${isDark ? 'text-white' : 'text-slate-900'}`}>
      {/* Presets Section */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className={`text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-white/60' : 'text-slate-500'}`}>
            Presets
          </span>
          <Sparkles className={`w-4 h-4 ${isDark ? 'text-white/40' : 'text-slate-400'}`} />
        </div>
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((preset) => (
            <motion.button
              key={preset.name}
              type="button"
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => handlePresetClick(preset)}
              className={`px-3 py-1.5 text-xs font-medium rounded-xl transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-arvdoul-purple ${
                activePreset === preset.name
                  ? 'bg-arvdoul-gradient text-white shadow-md'
                  : isDark
                    ? 'bg-white/10 text-white/80 hover:bg-white/20'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
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
        modified={[brightness, contrast].filter((v) => Number(v) !== 0).length}
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
        modified={[saturation, temperature, hue].filter((v) => Number(v) !== 0).length}
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
        modified={[blur, vignette].filter((v) => Number(v) !== 0).length}
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
      <div className={`flex items-center justify-between pt-2 border-t ${isDark ? 'border-white/10' : 'border-slate-200'}`}>
        <span className={`text-xs ${isDark ? 'text-white/60' : 'text-slate-500'}`}>
          {modifiedCount > 0 ? `${modifiedCount} adjustments modified` : 'No changes'}
        </span>
        <motion.button
          type="button"
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          onClick={() => {
            resetAdjustments();
            setActivePreset(null);
          }}
          className={`px-4 py-2 text-xs font-medium rounded-xl transition-colors flex items-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-arvdoul-purple ${
            isDark
              ? 'bg-white/10 hover:bg-white/20 text-white/90'
              : 'bg-slate-100 hover:bg-slate-200 text-slate-800'
          }`}
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
  pushUndo: PropTypes.func,
};

/**
 * Accessible range slider for an individual image adjustment parameter.
 */
const AdjustmentSlider = memo(({
  icon: Icon,
  label,
  value,
  min,
  max,
  defaultValue = 0,
  onChange,
  onPointerUp,
  showDegrees = false,
}) => {
  const { isDark } = useTheme();
  const numericValue = Number(value) || 0;
  const isModified = numericValue !== defaultValue;
  const formattedValue = `${numericValue > 0 && min < 0 ? '+' : ''}${numericValue}${showDegrees ? '°' : ''}`;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-2">
          <Icon className={`w-3.5 h-3.5 ${isModified ? 'text-arvdoul-purple' : isDark ? 'text-white/60' : 'text-slate-500'}`} />
          <span className={`font-medium ${isDark ? 'text-white/90' : 'text-slate-800'}`}>{label}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className={`font-mono text-xs tabular-nums ${isModified ? 'text-arvdoul-purple font-semibold' : isDark ? 'text-white/60' : 'text-slate-500'}`}>
            {formattedValue}
          </span>
          {isModified && (
            <button
              type="button"
              onClick={() => {
                onChange(defaultValue);
                onPointerUp?.();
              }}
              aria-label={`Reset ${label}`}
              className={`p-0.5 rounded transition-colors ${isDark ? 'text-white/50 hover:text-white' : 'text-slate-400 hover:text-slate-700'}`}
            >
              <RotateCcw className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>
      <input
        type="range"
        aria-label={label}
        min={min}
        max={max}
        value={numericValue}
        onChange={(e) => onChange(Number(e.target.value))}
        onPointerUp={onPointerUp}
        onKeyUp={onPointerUp}
        className="w-full h-1.5 rounded-full appearance-none cursor-pointer accent-arvdoul-purple bg-slate-200 dark:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-arvdoul-purple"
      />
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
  defaultValue: PropTypes.number,
  onChange: PropTypes.func.isRequired,
  onPointerUp: PropTypes.func,
  showDegrees: PropTypes.bool,
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
    <div className={`rounded-2xl border overflow-hidden ${isDark ? 'bg-white/5 border-white/10' : 'bg-slate-50 border-slate-200'}`}>
      <button
        type="button"
        onClick={onToggle}
        className={`w-full flex items-center justify-between p-3 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-arvdoul-purple ${
          isDark ? 'hover:bg-white/5' : 'hover:bg-slate-100/80'
        }`}
        aria-expanded={expanded}
      >
        <div className="flex items-center gap-2">
          <Icon className={`w-4 h-4 ${isDark ? 'text-white/60' : 'text-slate-500'}`} />
          <span className={`text-sm font-medium ${isDark ? 'text-white' : 'text-slate-900'}`}>{title}</span>
          <span className={`text-xs ${isDark ? 'text-white/50' : 'text-slate-500'}`}>({count})</span>
          {modified > 0 && (
            <span className="px-1.5 py-0.5 text-[10px] font-semibold rounded-full bg-arvdoul-purple/20 text-arvdoul-purple dark:text-purple-200 tabular-nums">
              {modified}
            </span>
          )}
        </div>
        {expanded ? (
          <ChevronUp className={`w-4 h-4 ${isDark ? 'text-white/50' : 'text-slate-400'}`} />
        ) : (
          <ChevronDown className={`w-4 h-4 ${isDark ? 'text-white/50' : 'text-slate-400'}`} />
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