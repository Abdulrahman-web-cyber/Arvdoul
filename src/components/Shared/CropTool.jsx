/**
 * CropTool.jsx - Professional Crop Tool Component
 * @description Provides image cropping with aspect ratios, zoom, and rotation
 * @module Shared/CropTool
 * @requires React, framer-motion, lucide-react, prop-types
 */

import React, { useState, useCallback, memo } from "react";
import PropTypes from "prop-types";
import { motion } from "framer-motion";
import {
  ZoomOut,
  ZoomIn,
  RotateCw,
  RotateCcw,
  FlipHorizontal,
  FlipVertical,
  Maximize,
  Grid3X3,
  RefreshCw,
} from "lucide-react";

// ARVDOUL Design System
const DNA_GRADIENT = 'linear-gradient(135deg, #B416DB 0%, #872FE2 35%, #4B6BFF 70%, #0EA3E6 100%)';
const DNA_SHADOW = '0 0 20px rgba(147,51,234,0.4)';

/**
 * Aspect ratio presets
 */
const ASPECT_RATIOS = [
  { id: 'free', label: 'Free', value: undefined, icon: Maximize },
  { id: 'square', label: '1:1', value: 1 / 1, icon: Grid3X3 },
  { id: 'portrait', label: '4:5', value: 4 / 5, icon: Grid3X3 },
  { id: 'landscape', label: '16:9', value: 16 / 9, icon: Grid3X3 },
  { id: 'story', label: '9:16', value: 9 / 16, icon: Grid3X3 },
  { id: 'photo', label: '3:2', value: 3 / 2, icon: Grid3X3 },
];

/**
 * Aspect ratio button component
 */
const AspectButton = memo(({
  ratio,
  isActive,
  onClick,
}) => {
  const Icon = ratio.icon || Maximize;
  
  return (
    <motion.button
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      onClick={onClick}
      className={`
        relative flex flex-col items-center justify-center p-3 rounded-xl transition-all duration-200
        ${isActive
          ? 'bg-gradient-to-br from-purple-600 to-cyan-500 text-white shadow-lg'
          : 'bg-white/10 text-white/70 hover:bg-white/20'
        }
      `}
      aria-label={`Set aspect ratio to ${ratio.label}`}
      aria-pressed={isActive}
    >
      <Icon className="w-5 h-5 mb-1" />
      <span className="text-[10px] font-medium">{ratio.label}</span>
      {isActive && (
        <motion.div
          layoutId="activeAspect"
          className="absolute inset-0 rounded-xl border-2 border-white/30"
          initial={false}
        />
      )}
    </motion.button>
  );
});

AspectButton.displayName = 'AspectButton';

AspectButton.propTypes = {
  ratio: PropTypes.object.isRequired,
  isActive: PropTypes.bool.isRequired,
  onClick: PropTypes.func.isRequired,
};

/**
 * Main CropTool component
 */
const CropTool = memo(({
  aspect,
  setAspect,
  zoom,
  onZoomChange,
  onCropChangeWithUndo,
  onCropComplete,
  pushUndo,
  setCrop,
  setZoom,
  setCroppedAreaPixels,
  // Extended props
  onRotateLeft,
  onRotateRight,
  onFlipH,
  onFlipV,
  rotation = 0,
  flipH = false,
  flipV = false,
}) => {
  const [showAdvanced, setShowAdvanced] = useState(false);
  
  const handleAspectChange = useCallback((newAspect) => {
    pushUndo?.();
    setAspect(newAspect);
  }, [setAspect, pushUndo]);

  const handleReset = useCallback(() => {
    pushUndo?.();
    setCrop?.({ x: 0, y: 0 });
    setZoom?.(1);
    setAspect(undefined);
    setCroppedAreaPixels?.(null);
  }, [pushUndo, setCrop, setZoom, setAspect, setCroppedAreaPixels]);

  const handleZoomChange = useCallback((value) => {
    onZoomChange?.(value);
  }, [onZoomChange]);

  return (
    <div className="w-full space-y-4 text-white">
      {/* Aspect Ratio Selection */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-white/60 uppercase tracking-wider">
            Aspect Ratio
          </span>
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="text-xs text-purple-400 hover:text-purple-300 transition-colors"
          >
            {showAdvanced ? 'Simple' : 'Advanced'}
          </button>
        </div>
        
        {showAdvanced ? (
          <div className="grid grid-cols-3 gap-2">
            {ASPECT_RATIOS.map((ratio) => (
              <AspectButton
                key={ratio.id}
                ratio={ratio}
                isActive={aspect === ratio.value}
                onClick={() => handleAspectChange(ratio.value)}
              />
            ))}
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {ASPECT_RATIOS.slice(0, 4).map((ratio) => (
              <motion.button
                key={ratio.id}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => handleAspectChange(ratio.value)}
                className={`
                  px-4 py-2 text-xs font-medium rounded-xl transition-all duration-200
                  ${aspect === ratio.value
                    ? 'bg-gradient-to-r from-purple-600 to-cyan-500 text-white shadow-lg'
                    : 'bg-white/10 text-white/80 hover:bg-white/20'
                  }
                `}
                aria-label={`Set aspect ratio to ${ratio.label}`}
                aria-pressed={aspect === ratio.value}
              >
                {ratio.label}
              </motion.button>
            ))}
          </div>
        )}
        
        {/* Current aspect indicator */}
        <div className="flex items-center justify-center gap-2 py-2">
          <Grid3X3 className="w-4 h-4 text-white/40" />
          <span className="text-xs text-white/60">
            {aspect ? ASPECT_RATIOS.find(r => r.value === aspect)?.label : 'Free'}
          </span>
        </div>
      </div>

      {/* Zoom Control */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-white/60 uppercase tracking-wider">
            Zoom
          </span>
          <span className="text-xs text-white/50 tabular-nums">
            {Math.round(zoom * 100)}%
          </span>
        </div>
        
        <div className="flex items-center gap-3">
          <button
            onClick={() => handleZoomChange(Math.max(1, zoom - 0.1))}
            className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
            aria-label="Zoom out"
          >
            <ZoomOut className="w-4 h-4 text-white/70" />
          </button>
          
          <div className="relative flex-1 h-8 flex items-center">
            <div className="absolute inset-x-0 h-1.5 rounded-full bg-white/10 overflow-hidden">
              <motion.div
                className="h-full rounded-full"
                style={{
                  width: `${((zoom - 1) / 2) * 100}%`,
                  background: DNA_GRADIENT,
                  boxShadow: DNA_SHADOW,
                }}
                transition={{ duration: 0.1 }}
              />
            </div>
            <input
              type="range"
              min={1}
              max={3}
              step={0.01}
              value={zoom}
              onChange={(e) => handleZoomChange(Number(e.target.value))}
              onPointerUp={() => pushUndo?.()}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              aria-label="Zoom level"
            />
            <div
              className="absolute w-4 h-4 rounded-full bg-white shadow-lg pointer-events-none"
              style={{
                left: `calc(${((zoom - 1) / 2) * 100}% - 8px)`,
                boxShadow: DNA_SHADOW,
              }}
            />
          </div>
          
          <button
            onClick={() => handleZoomChange(Math.min(3, zoom + 0.1))}
            className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
            aria-label="Zoom in"
          >
            <ZoomIn className="w-4 h-4 text-white/70" />
          </button>
        </div>
      </div>

      {/* Rotation & Flip Controls */}
      {(onRotateLeft || onRotateRight || onFlipH || onFlipV) && (
        <div className="space-y-2">
          <span className="text-xs font-semibold text-white/60 uppercase tracking-wider">
            Adjust
          </span>
          
          <div className="flex items-center gap-2">
            {onRotateLeft && (
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.9 }}
                onClick={onRotateLeft}
                className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 transition-colors"
                aria-label="Rotate left 90 degrees"
              >
                <RotateCcw className="w-4 h-4 text-white/70" />
                <span className="text-xs text-white/70">-90°</span>
              </motion.button>
            )}
            
            {onRotateRight && (
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.9 }}
                onClick={onRotateRight}
                className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 transition-colors"
                aria-label="Rotate right 90 degrees"
              >
                <RotateCw className="w-4 h-4 text-white/70" />
                <span className="text-xs text-white/70">+90°</span>
              </motion.button>
            )}
          </div>
          
          <div className="flex items-center gap-2">
            {onFlipH && (
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.9 }}
                onClick={onFlipH}
                className={`
                  flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-xl transition-colors
                  ${flipH
                    ? 'bg-purple-500/30 text-white'
                    : 'bg-white/10 hover:bg-white/20 text-white/70'
                  }
                `}
                aria-label="Flip horizontal"
              >
                <FlipHorizontal className="w-4 h-4" />
                <span className="text-xs">Flip H</span>
              </motion.button>
            )}
            
            {onFlipV && (
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.9 }}
                onClick={onFlipV}
                className={`
                  flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-xl transition-colors
                  ${flipV
                    ? 'bg-purple-500/30 text-white'
                    : 'bg-white/10 hover:bg-white/20 text-white/70'
                  }
                `}
                aria-label="Flip vertical"
              >
                <FlipVertical className="w-4 h-4" />
                <span className="text-xs">Flip V</span>
              </motion.button>
            )}
          </div>
        </div>
      )}

      {/* Reset Button */}
      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={handleReset}
        className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-white/10 hover:bg-white/20 text-white/80 transition-colors"
      >
        <RefreshCw className="w-4 h-4" />
        <span className="text-sm font-medium">Reset Crop</span>
      </motion.button>
    </div>
  );
});

CropTool.displayName = 'CropTool';

CropTool.propTypes = {
  /** Current aspect ratio */
  aspect: PropTypes.number,
  /** Function to set aspect ratio */
  setAspect: PropTypes.func.isRequired,
  /** Current zoom level */
  zoom: PropTypes.number,
  /** Function to handle zoom change */
  onZoomChange: PropTypes.func,
  /** Function to handle crop change with undo */
  onCropChangeWithUndo: PropTypes.func,
  /** Function to handle crop complete */
  onCropComplete: PropTypes.func,
  /** Function to push undo state */
  pushUndo: PropTypes.func,
  /** Function to set crop area */
  setCrop: PropTypes.func,
  /** Function to set zoom level */
  setZoom: PropTypes.func,
  /** Function to set cropped pixels */
  setCroppedAreaPixels: PropTypes.func,
  /** Function to rotate left */
  onRotateLeft: PropTypes.func,
  /** Function to rotate right */
  onRotateRight: PropTypes.func,
  /** Function to flip horizontal */
  onFlipH: PropTypes.func,
  /** Function to flip vertical */
  onFlipV: PropTypes.func,
  /** Current rotation angle */
  rotation: PropTypes.number,
  /** Whether horizontally flipped */
  flipH: PropTypes.bool,
  /** Whether vertically flipped */
  flipV: PropTypes.bool,
};

export default CropTool;