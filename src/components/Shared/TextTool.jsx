/**
 * TextTool.jsx - Professional Typography Engine Component
 * @description Provides comprehensive text editing with fonts, effects, and styles
 * @module Shared/TextTool
 * @requires React, framer-motion, lucide-react, prop-types
 */

import { useState, useCallback, useMemo, memo } from "react";
import { useTheme } from '../../context/ThemeContext';
import { tokens } from '../../design-system/tokens.js';
import PropTypes from "prop-types";
import { motion, AnimatePresence } from "framer-motion";
import { Type, Trash2, AlignLeft, AlignCenter, AlignRight, AlignJustify, Bold, Italic, Underline, Strikethrough, Search, ChevronDown, ChevronUp, RotateCw, Sparkles, Plus } from "lucide-react";

/**
 * Popular Google Fonts for quick access
 */
const POPULAR_FONTS = [
  'Poppins',
  'Inter',
  'Roboto',
  'Open Sans',
  'Lato',
  'Montserrat',
  'Oswald',
  'Raleway',
  'Nunito',
  'Playfair Display',
  'Merriweather',
  'Source Sans Pro',
  'Ubuntu',
  'Rubik',
  'Work Sans',
  'Quicksand',
  'Comfortaa',
  'Pacifico',
  'Dancing Script',
  'Abril Fatface',
  'Bebas Neue',
  'Archivo Black',
  'Space Grotesk',
  'Syne',
  'Outfit',
  'Manrope',
  'Plus Jakarta Sans',
  'Sora',
  'Cabin',
  'Figtree',
  'Geist',
];

/**
 * Color palette
 */
const COLOR_PRESETS = [
  '#FFFFFF', '#000000', '#FF0000', '#00FF00', '#0000FF',
  '#FFFF00', '#FF00FF', '#00FFFF', '#FF8800', '#88FF00',
  '#8800FF', '#00FF88', '#FF0088', tokens.color.brand.cyan, '#808080',
  tokens.color.brand.violet, tokens.color.brand.indigo, tokens.color.brand.blue, tokens.color.brand.cyan, '#FF6B6B',
];

/**
 * IconButton component
 */
const IconButton = memo(({
  icon: Icon,
  isActive,
  onClick,
  label,
  disabled = false,
  size = 'md',
}) => {
  const { isDark } = useTheme();
  const sizeClasses = {
    sm: 'w-7 h-7',
    md: 'w-8 h-8',
    lg: 'w-10 h-10',
  };

  return (
    <motion.button
      type="button"
      whileHover={{ scale: 1.1 }}
      whileTap={{ scale: 0.9 }}
      onClick={onClick}
      disabled={disabled}
      className={`
        ${sizeClasses[size]} rounded-lg flex items-center justify-center transition-all duration-200
        ${isActive
          ? 'bg-arvdoul-gradient text-white shadow-lg'
          : isDark
            ? 'bg-white/10 text-white/75 hover:bg-white/20 hover:text-white'
            : 'bg-slate-100 text-slate-700 border border-slate-200 hover:bg-slate-200 hover:text-slate-900'
        }
        ${disabled ? 'opacity-30 cursor-not-allowed' : ''}
      `}
      aria-label={label}
      aria-pressed={isActive}
    >
      <Icon className={size === 'sm' ? 'w-3.5 h-3.5' : size === 'lg' ? 'w-5 h-5' : 'w-4 h-4'} />
    </motion.button>
  );
});

IconButton.displayName = 'IconButton';

IconButton.propTypes = {
  icon: PropTypes.elementType.isRequired,
  isActive: PropTypes.bool,
  onClick: PropTypes.func.isRequired,
  label: PropTypes.string.isRequired,
  disabled: PropTypes.bool,
  size: PropTypes.oneOf(['sm', 'md', 'lg']),
};

/**
 * Collapsible section component
 */
const Section = memo(({
  title,
  icon: Icon,
  expanded,
  onToggle,
  children,
  badge,
}) => {
    const { isDark } = useTheme();
  return (
    <div className={`rounded-2xl ${isDark ? 'bg-white/5' : 'bg-black/[0.03]'} border ${isDark ? 'border-white/10' : 'border-gray-200'} overflow-hidden`}>
      <button
        type="button"
        onClick={onToggle}
        className={`w-full flex items-center justify-between p-3 transition-colors ${isDark ? 'hover:bg-white/5' : 'hover:bg-black/[0.04]'}`}
        aria-expanded={expanded}
      >
        <div className="flex items-center gap-2">
          {Icon && <Icon className={`w-4 h-4 ${isDark ? 'text-white/60' : 'text-slate-500'}`} />}
          <span className={`text-sm font-medium ${isDark ? 'text-white' : 'text-slate-900'}`}>{title}</span>
          {badge && (
            <span className={`px-1.5 py-0.5 text-[10px] font-semibold rounded-full ${isDark ? 'bg-purple-500/30 text-purple-300' : 'bg-purple-100 text-arvdoul-purple'}`}>
              {badge}
            </span>
          )}
        </div>
        {expanded ? (
          <ChevronUp className={`w-4 h-4 ${isDark ? 'text-white/40' : 'text-slate-400'}`} />
        ) : (
          <ChevronDown className={`w-4 h-4 ${isDark ? 'text-white/40' : 'text-slate-400'}`} />
        )}
      </button>
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="p-3 pt-0 space-y-3">
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
  icon: PropTypes.elementType,
  expanded: PropTypes.bool.isRequired,
  onToggle: PropTypes.func.isRequired,
  children: PropTypes.node,
  badge: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
};

/**
 * Font selector component
 */
const FontSelector = memo(({
  fontFamily,
  onChange,
}) => {
  const { isDark } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const filteredFonts = useMemo(() => {
    let fonts = POPULAR_FONTS;
    
    if (searchQuery) {
      fonts = fonts.filter(f => f.toLowerCase().includes(searchQuery.toLowerCase()));
    }
    
    return fonts;
  }, [searchQuery]);

  return (
    <div className="relative">
      {/* Selected font display */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full flex items-center justify-between p-3 rounded-xl ${isDark ? 'bg-white/10 border-white/10 hover:bg-white/15' : 'bg-slate-100 border-slate-200 hover:bg-slate-200/70'} border transition-colors`}
      >
        <span className={`text-sm truncate ${isDark ? 'text-white' : 'text-slate-900'}`} style={{ fontFamily }}>
          {fontFamily}
        </span>
        <ChevronDown className={`w-4 h-4 ${isDark ? 'text-white/60' : 'text-slate-500'}`} />
      </button>

      {/* Font dropdown */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className={`absolute top-full left-0 right-0 mt-2 z-50 rounded-2xl border shadow-2xl overflow-hidden ${isDark ? 'bg-gray-900 border-white/20' : 'bg-white border-slate-200'}`}
          >
            {/* Search */}
            <div className={`p-2 border-b ${isDark ? 'border-white/10' : 'border-gray-200'}`}>
              <div className="relative">
                <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${isDark ? 'text-white/40' : 'text-slate-400'}`} />
                <input aria-label="Search fonts..."
                  type="text"
                  placeholder="Search fonts..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className={`w-full pl-9 pr-3 py-2 rounded-lg text-sm outline-none ${isDark ? 'bg-white/10 text-white placeholder-white/40' : 'bg-slate-100 text-slate-900 placeholder-slate-400'}`}
                />
              </div>
            </div>

            {/* Font list */}
            <div className="max-h-64 overflow-y-auto">
              {filteredFonts.map((font) => (
                <button
                  type="button"
                  key={font}
                  onClick={() => {
                    onChange(font);
                    setIsOpen(false);
                    setSearchQuery('');
                  }}
                  className={`
                    w-full px-4 py-2.5 text-left transition-colors
                    ${fontFamily === font
                      ? isDark ? 'bg-purple-500/20 text-purple-300' : 'bg-purple-50 text-arvdoul-purple font-semibold'
                      : isDark ? 'text-white hover:bg-white/10' : 'text-slate-800 hover:bg-slate-100'
                    }
                  `}
                  style={{ fontFamily: font }}
                >
                  {font}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});

FontSelector.displayName = 'FontSelector';

FontSelector.propTypes = {
  fontFamily: PropTypes.string.isRequired,
  onChange: PropTypes.func.isRequired,
  fontSize: PropTypes.number,
  onSizeChange: PropTypes.func,
};

/**
 * Main TextTool component
 */
const TextTool = memo(({
  selectedText,
  updateSelectedText,
  handleDeleteText,
  handleQuickAddText,
}) => {
    const { isDark } = useTheme();
  const [quickText, setQuickText] = useState("");
  const [expandedSections, setExpandedSections] = useState({
    text: true,
    style: true,
    effects: false,
  });

  // Toggle section
  const toggleSection = useCallback((section) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section],
    }));
  }, []);

  // Quick add text
  const onQuickAdd = useCallback(() => {
    if (handleQuickAddText && quickText.trim()) {
      handleQuickAddText(quickText.trim());
      setQuickText("");
    }
  }, [quickText, handleQuickAddText]);

  const handleUpdate = useCallback((updates) => {
    updateSelectedText?.(updates);
  }, [updateSelectedText]);

  // Toggle style
  const toggleStyle = useCallback((style) => {
    if (!selectedText) return;
    
    const currentStyle = selectedText.fontStyle || '';
    const currentWeight = selectedText.fontWeight || 'normal';
    
    let newStyle = currentStyle;
    let newWeight = currentWeight;
    
    if (style === 'bold') {
      newWeight = currentWeight === 'bold' ? 'normal' : 'bold';
    } else if (style === 'italic') {
      newStyle = currentStyle.includes('italic') 
        ? currentStyle.replace('italic', '').trim()
        : `${currentStyle} italic`.trim();
    } else if (style === 'underline') {
      newStyle = currentStyle.includes('underline')
        ? currentStyle.replace('underline', '').trim()
        : `${currentStyle} underline`.trim();
    } else if (style === 'strikethrough') {
      newStyle = currentStyle.includes('line-through')
        ? currentStyle.replace('line-through', '').trim()
        : `${currentStyle} line-through`.trim();
    }
    
    updateSelectedText?.({ fontStyle: newStyle, fontWeight: newWeight });
  }, [selectedText, updateSelectedText]);

  // Check if style is active
  const isStyleActive = useCallback((style) => {
    if (!selectedText) return false;
    
    if (style === 'bold') return selectedText.fontWeight === 'bold';
    if (style === 'italic') return selectedText.fontStyle?.includes('italic');
    if (style === 'underline') return selectedText.fontStyle?.includes('underline');
    if (style === 'strikethrough') return selectedText.fontStyle?.includes('line-through');
    
    return false;
  }, [selectedText]);

  return (
    <div className={`w-full space-y-3 ${isDark ? 'text-white' : 'text-slate-900'}`}>
      {/* Quick Add Section */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <input
            type="text"
            placeholder="Type text..."
            value={quickText}
            onChange={(e) => setQuickText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") onQuickAdd();
            }}
            className={`flex-1 px-4 py-2.5 rounded-xl border focus:border-purple-500 outline-none text-sm transition-colors ${isDark ? 'bg-white/10 text-white placeholder-white/40 border-white/10' : 'bg-slate-100 text-slate-900 placeholder-slate-400 border-slate-200'}`}
            aria-label="Quick text input"
          />
          <motion.button
            type="button"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={onQuickAdd}
            disabled={!quickText.trim()}
            className="px-4 py-2.5 rounded-xl bg-arvdoul-gradient text-white text-sm font-bold flex items-center gap-2 disabled:opacity-50"
          >
            <Plus className="w-4 h-4" />
            Add
          </motion.button>
        </div>
        <p className={`text-xs text-center ${isDark ? 'text-white/40' : 'text-slate-500'}`}>or tap on the canvas to add text</p>
      </div>

      {/* Selected Text Editor */}
      {selectedText && (
        <>
          {/* Text Content */}
          <Section
            title="Text"
            icon={Type}
            expanded={expandedSections.text}
            onToggle={() => toggleSection('text')}
          >
            <input
              type="text"
              value={selectedText.text || ''}
              onChange={(e) => handleUpdate({ text: e.target.value })}
              className={`w-full px-4 py-3 rounded-xl border focus:border-purple-500 outline-none text-lg ${isDark ? 'bg-white/10 text-white border-white/10' : 'bg-slate-100 text-slate-900 border-slate-200'}`}
              aria-label="Edit text content"
              placeholder="Enter text..."
            />
          </Section>

          {/* Typography */}
          <Section
            title="Typography"
            icon={Type}
            expanded={expandedSections.style}
            onToggle={() => toggleSection('style')}
          >
            {/* Font Family */}
            <div className="space-y-2">
              <label className={`text-xs ${isDark ? 'text-white/60' : 'text-gray-500'} font-medium`}>Font Family</label>
              <FontSelector
                fontFamily={selectedText.fontFamily || 'Poppins'}
                onChange={(font) => handleUpdate({ fontFamily: font })}
              />
            </div>

            {/* Font Size */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className={`text-xs ${isDark ? 'text-white/60' : 'text-gray-500'} font-medium`}>Size</label>
                <span className={`text-xs tabular-nums ${isDark ? 'text-white/50' : 'text-slate-500'}`}>{selectedText.fontSize || 48}px</span>
              </div>
              <div className="flex items-center gap-2">
                <input aria-label="Size"
                  type="range"
                  min={8}
                  max={300}
                  value={selectedText.fontSize || 48}
                  onChange={(e) => handleUpdate({ fontSize: Number(e.target.value) })}
                  className="flex-1 accent-purple-500"
                />
              </div>
            </div>

            {/* Text Styles */}
            <div className="space-y-2">
              <label className={`text-xs ${isDark ? 'text-white/60' : 'text-gray-500'} font-medium`}>Style</label>
              <div className="flex items-center gap-2">
                <IconButton
                  icon={Bold}
                  isActive={isStyleActive('bold')}
                  onClick={() => toggleStyle('bold')}
                  label="Bold"
                />
                <IconButton
                  icon={Italic}
                  isActive={isStyleActive('italic')}
                  onClick={() => toggleStyle('italic')}
                  label="Italic"
                />
                <IconButton
                  icon={Underline}
                  isActive={isStyleActive('underline')}
                  onClick={() => toggleStyle('underline')}
                  label="Underline"
                />
                <IconButton
                  icon={Strikethrough}
                  isActive={isStyleActive('strikethrough')}
                  onClick={() => toggleStyle('strikethrough')}
                  label="Strikethrough"
                />
              </div>
            </div>

            {/* Alignment */}
            <div className="space-y-2">
              <label className={`text-xs ${isDark ? 'text-white/60' : 'text-gray-500'} font-medium`}>Alignment</label>
              <div className="flex items-center gap-2">
                <IconButton
                  icon={AlignLeft}
                  isActive={selectedText.textAlign === 'left'}
                  onClick={() => handleUpdate({ textAlign: 'left' }, true)}
                  label="Align left"
                />
                <IconButton
                  icon={AlignCenter}
                  isActive={selectedText.textAlign === 'center'}
                  onClick={() => handleUpdate({ textAlign: 'center' }, true)}
                  label="Align center"
                />
                <IconButton
                  icon={AlignRight}
                  isActive={selectedText.textAlign === 'right'}
                  onClick={() => handleUpdate({ textAlign: 'right' }, true)}
                  label="Align right"
                />
                <IconButton
                  icon={AlignJustify}
                  isActive={selectedText.textAlign === 'justify'}
                  onClick={() => handleUpdate({ textAlign: 'justify' }, true)}
                  label="Justify"
                />
              </div>
            </div>

            {/* Color */}
            <div className="space-y-2">
              <label className={`text-xs ${isDark ? 'text-white/60' : 'text-gray-500'} font-medium`}>Color</label>
              <div className="flex items-center gap-2 flex-wrap">
                <input aria-label="Color"
                  type="color"
                  value={selectedText.color || '#FFFFFF'}
                  onChange={(e) => handleUpdate({ color: e.target.value }, true)}
                  className="w-10 h-10 rounded-xl cursor-pointer"
                />
                {COLOR_PRESETS.slice(0, 8).map((color) => (
                  <button
                    type="button"
                    key={color}
                    onClick={() => handleUpdate({ color }, true)}
                    className={`
                      w-7 h-7 rounded-lg transition-transform hover:scale-110 border border-black/15 dark:border-white/15
                      ${selectedText.color === color ? `ring-2 ring-arvdoul-purple ring-offset-2 ${isDark ? 'ring-offset-gray-900' : 'ring-offset-white'}` : ''}
                    `}
                    style={{ backgroundColor: color }}
                    aria-label={`Set color to ${color}`}
                  />
                ))}
              </div>
            </div>

            {/* Opacity */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className={`text-xs ${isDark ? 'text-white/60' : 'text-gray-500'} font-medium`}>Opacity</label>
                <span className={`text-xs tabular-nums ${isDark ? 'text-white/50' : 'text-slate-500'}`}>{selectedText.opacity ?? 100}%</span>
              </div>
              <input aria-label="Opacity"
                type="range"
                min={0}
                max={100}
                value={selectedText.opacity ?? 100}
                onChange={(e) => handleUpdate({ opacity: Number(e.target.value) })}
                className="w-full accent-purple-500"
              />
            </div>

            {/* Letter Spacing */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className={`text-xs ${isDark ? 'text-white/60' : 'text-gray-500'} font-medium`}>Letter Spacing</label>
                <span className={`text-xs tabular-nums ${isDark ? 'text-white/50' : 'text-slate-500'}`}>{selectedText.letterSpacing ?? 0}px</span>
              </div>
              <input aria-label="Letter Spacing"
                type="range"
                min={-10}
                max={20}
                value={selectedText.letterSpacing ?? 0}
                onChange={(e) => handleUpdate({ letterSpacing: Number(e.target.value) })}
                className="w-full accent-purple-500"
              />
            </div>

            {/* Line Height */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className={`text-xs ${isDark ? 'text-white/60' : 'text-gray-500'} font-medium`}>Line Height</label>
                <span className={`text-xs tabular-nums ${isDark ? 'text-white/50' : 'text-slate-500'}`}>{(selectedText.lineHeight ?? 1.2).toFixed(1)}</span>
              </div>
              <input aria-label="Line Height"
                type="range"
                min={0.5}
                max={3}
                step={0.1}
                value={selectedText.lineHeight ?? 1.2}
                onChange={(e) => handleUpdate({ lineHeight: Number(e.target.value) })}
                className="w-full accent-purple-500"
              />
            </div>

            {/* Rotation */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className={`text-xs ${isDark ? 'text-white/60' : 'text-gray-500'} font-medium`}>Rotation</label>
                <span className={`text-xs tabular-nums ${isDark ? 'text-white/50' : 'text-slate-500'}`}>
                  {Math.round(((selectedText.rotation || 0) * 180 / Math.PI))}°
                </span>
              </div>
              <div className="flex items-center gap-2">
                <RotateCw className={`w-4 h-4 ${isDark ? 'text-white/40' : 'text-slate-400'}`} />
                <input aria-label="Rotation"
                  type="range"
                  min={-180}
                  max={180}
                  value={Math.round((selectedText.rotation || 0) * 180 / Math.PI)}
                  onChange={(e) =>
                    handleUpdate({ rotation: (Number(e.target.value) * Math.PI) / 180 })
                  }
                  className="flex-1 accent-purple-500"
                />
              </div>
            </div>
          </Section>

          {/* Text Effects */}
          <Section
            title="Effects"
            icon={Sparkles}
            expanded={expandedSections.effects}
            onToggle={() => toggleSection('effects')}
            badge={selectedText.textEffect && selectedText.textEffect !== 'none' ? '1' : null}
          >
            {/* Shadow */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className={`text-xs ${isDark ? 'text-white/60' : 'text-gray-500'} font-medium`}>Shadow</label>
                <button
                  type="button"
                  onClick={() => handleUpdate({ shadowEnabled: !selectedText.shadowEnabled }, true)}
                  className={`
                    px-3 py-1 rounded-lg text-xs font-medium transition-colors
                    ${selectedText.shadowEnabled
                      ? isDark ? 'bg-purple-500/30 text-purple-300' : 'bg-purple-100 text-arvdoul-purple'
                      : isDark ? 'bg-white/10 text-white/60' : 'bg-slate-200 text-slate-600'
                    }
                  `}
                >
                  {selectedText.shadowEnabled ? 'On' : 'Off'}
                </button>
              </div>
              {selectedText.shadowEnabled && (
                <>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className={`text-[10px] ${isDark ? 'text-white/40' : 'text-slate-500'}`}>X</label>
                      <input aria-label="Shadow X offset"
                        type="number"
                        value={selectedText.shadowX ?? 2}
                        onChange={(e) => handleUpdate({ shadowX: Number(e.target.value) })}
                        className={`w-full px-2 py-1 rounded text-xs ${isDark ? 'bg-white/10 text-white' : 'bg-slate-100 text-slate-900 border border-slate-200'}`}
                      />
                    </div>
                    <div>
                      <label className={`text-[10px] ${isDark ? 'text-white/40' : 'text-slate-500'}`}>Y</label>
                      <input aria-label="Shadow Y offset"
                        type="number"
                        value={selectedText.shadowY ?? 2}
                        onChange={(e) => handleUpdate({ shadowY: Number(e.target.value) })}
                        className={`w-full px-2 py-1 rounded text-xs ${isDark ? 'bg-white/10 text-white' : 'bg-slate-100 text-slate-900 border border-slate-200'}`}
                      />
                    </div>
                    <div>
                      <label className={`text-[10px] ${isDark ? 'text-white/40' : 'text-slate-500'}`}>Blur</label>
                      <input aria-label="Blur"
                        type="number"
                        value={selectedText.shadowBlur ?? 4}
                        onChange={(e) => handleUpdate({ shadowBlur: Number(e.target.value) })}
                        className={`w-full px-2 py-1 rounded text-xs ${isDark ? 'bg-white/10 text-white' : 'bg-slate-100 text-slate-900 border border-slate-200'}`}
                      />
                    </div>
                  </div>
                  <div>
                    <label className={`text-[10px] ${isDark ? 'text-white/40' : 'text-slate-500'}`}>Shadow Color</label>
                    <input aria-label="Shadow Color"
                      type="color"
                      value={selectedText.shadowColor?.replace(/rgba?\([^)]+\)/, '#000000') || '#000000'}
                      onChange={(e) => handleUpdate({ shadowColor: e.target.value }, true)}
                      className="w-full h-8 rounded cursor-pointer"
                    />
                  </div>
                </>
              )}
            </div>

            {/* Stroke */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className={`text-xs ${isDark ? 'text-white/60' : 'text-gray-500'} font-medium`}>Stroke</label>
                <button
                  type="button"
                  onClick={() => handleUpdate({ 
                    strokeWidth: selectedText.strokeWidth > 0 ? 0 : 2 
                  }, true)}
                  className={`
                    px-3 py-1 rounded-lg text-xs font-medium transition-colors
                    ${selectedText.strokeWidth > 0
                      ? isDark ? 'bg-purple-500/30 text-purple-300' : 'bg-purple-100 text-arvdoul-purple'
                      : isDark ? 'bg-white/10 text-white/60' : 'bg-slate-200 text-slate-600'
                    }
                  `}
                >
                  {selectedText.strokeWidth > 0 ? 'On' : 'Off'}
                </button>
              </div>
              {selectedText.strokeWidth > 0 && (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className={`text-[10px] ${isDark ? 'text-white/40' : 'text-slate-500'}`}>Width</label>
                    <input aria-label="Width"
                      type="number"
                      min={1}
                      max={20}
                      value={selectedText.strokeWidth ?? 2}
                      onChange={(e) => handleUpdate({ strokeWidth: Number(e.target.value) })}
                      className={`w-full px-2 py-1 rounded text-xs ${isDark ? 'bg-white/10 text-white' : 'bg-slate-100 text-slate-900 border border-slate-200'}`}
                    />
                  </div>
                  <div>
                    <label className={`text-[10px] ${isDark ? 'text-white/40' : 'text-slate-500'}`}>Color</label>
                    <input aria-label="Color"
                      type="color"
                      value={selectedText.strokeColor || '#000000'}
                      onChange={(e) => handleUpdate({ strokeColor: e.target.value }, true)}
                      className="w-full h-7 rounded cursor-pointer"
                    />
                  </div>
                </div>
              )}
            </div>
          </Section>

          {/* Delete Button */}
          <motion.button
            type="button"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => handleDeleteText?.(selectedText.id)}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-red-500/15 text-red-600 dark:text-red-400 hover:bg-red-500/25 transition-colors font-medium"
          >
            <Trash2 className="w-4 h-4" />
            Delete Text
          </motion.button>
        </>
      )}

      {/* No Selection State */}
      {!selectedText && (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <Type className={`w-12 h-12 mb-3 ${isDark ? 'text-white/20' : 'text-slate-300'}`} />
          <p className={`text-sm ${isDark ? 'text-white/50' : 'text-slate-600'}`}>No text selected</p>
          <p className={`text-xs mt-1 ${isDark ? 'text-white/30' : 'text-slate-400'}`}>Add text or select existing text to edit</p>
        </div>
      )}
    </div>
  );
});

TextTool.displayName = 'TextTool';

TextTool.propTypes = {
  /** Currently selected text layer */
  selectedText: PropTypes.object,
  /** Function to update selected text properties */
  updateSelectedText: PropTypes.func,
  /** Function to delete text layer */
  handleDeleteText: PropTypes.func,
  /** Function to add new text */
  handleQuickAddText: PropTypes.func,
};

export default TextTool;