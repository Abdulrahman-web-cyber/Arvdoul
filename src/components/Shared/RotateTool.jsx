/**
 * RotateTool.jsx - Professional Rotate Tool Component
 * @description Provides rotation and flip controls for images
 * @module Shared/RotateTool
 * @requires React, framer-motion, lucide-react, prop-types
 */

import React, { useCallback, memo } from "react";
import PropTypes from "prop-types";
import { motion } from "framer-motion";
import {
  RotateCw,
  RotateCcw,
  FlipHorizontal,
  FlipVertical,
} from "lucide-react";

// ARVDOUL Design System
const DNA_GRADIENT = 'linear-gradient(135deg, #B416DB 0%, #872FE2 35%, #4B6BFF 70%, #0EA3E6 100%)';

/**
 * Rotate button component
 */
const RotateButton = memo(({
  icon: Icon,
  label,
  onClick,
  isActive = false,
  badge,
}) => {
  return (
    <motion.button
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      onClick={onClick}
      className={`
        relative flex flex-col items-center justify-center p-4 rounded-2xl transition-all duration-200
        ${isActive
          ? 'bg-gradient-to-br from-purple-600 to-cyan-500 text-white shadow-lg'
          : 'bg-white/10 text-white/80 hover:bg-white/20'
        }
      `}
      aria-label={label}
    >
      <Icon className="w-6 h-6 mb-1" />
      <span className="text-xs font-medium">{label}</span>
      {badge && (
        <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
          {badge}
        </span>
      )}
    </motion.button>
  );
});

RotateButton.displayName = 'RotateButton';

RotateButton.propTypes = {
  icon: PropTypes.elementType.isRequired,
  label: PropTypes.string.isRequired,
  onClick: PropTypes.func.isRequired,
  isActive: PropTypes.bool,
  badge: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
};

/**
 * Main RotateTool component
 */
const RotateTool = memo(({
  onRotateLeft,
  onRotateRight,
  onFlipH,
  onFlipV,
  rotation = 0,
  flipH = false,
  flipV = false,
  // Extended props for free rotation
  onRotateFree,
  freeRotation = 0,
}) => {
  const handleRotateLeft = useCallback(() => {
    onRotateLeft?.();
  }, [onRotateLeft]);

  const handleRotateRight = useCallback(() => {
    onRotateRight?.();
  }, [onRotateRight]);

  const handleFlipH = useCallback(() => {
    onFlipH?.();
  }, [onFlipH]);

  const handleFlipV = useCallback(() => {
    onFlipV?.();
  }, [onFlipV]);

  // Calculate the normalized rotation for display
  const normalizedRotation = useCallback((rot) => {
    let normalized = rot % 360;
    if (normalized < 0) normalized += 360;
    return normalized;
  }, []);

  return (
    <div className="w-full space-y-4">
      {/* Quick Rotation */}
      <div className="space-y-2">
        <span className="text-xs font-semibold text-white/60 uppercase tracking-wider">
          Quick Rotate
        </span>
        <div className="flex items-center gap-3">
          {onRotateLeft && (
            <RotateButton
              icon={RotateCcw}
              label="-90°"
              onClick={handleRotateLeft}
            />
          )}
          
          {onRotateRight && (
            <RotateButton
              icon={RotateCw}
              label="+90°"
              onClick={handleRotateRight}
            />
          )}
        </div>
      </div>

      {/* Flip Controls */}
      {(onFlipH || onFlipV) && (
        <div className="space-y-2">
          <span className="text-xs font-semibold text-white/60 uppercase tracking-wider">
            Flip
          </span>
          <div className="flex items-center gap-3">
            {onFlipH && (
              <RotateButton
                icon={FlipHorizontal}
                label="Horizontal"
                onClick={handleFlipH}
                isActive={flipH}
              />
            )}
            
            {onFlipV && (
              <RotateButton
                icon={FlipVertical}
                label="Vertical"
                onClick={handleFlipV}
                isActive={flipV}
              />
            )}
          </div>
        </div>
      )}

      {/* Free Rotation Slider */}
      {onRotateFree && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-white/60 uppercase tracking-wider">
              Free Rotation
            </span>
            <span className="text-xs text-white/50 tabular-nums">
              {freeRotation}°
            </span>
          </div>
          
          <div className="flex items-center gap-3">
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => onRotateFree(freeRotation - 15)}
              className="w-10 h-10 flex items-center justify-center rounded-xl bg-white/10 hover:bg-white/20 transition-colors"
              aria-label="Rotate left 15 degrees"
            >
              <RotateCcw className="w-5 h-5 text-white/70" />
            </motion.button>
            
            <div className="relative flex-1 h-10 flex items-center">
              <div className="absolute inset-x-0 h-2 rounded-full bg-white/10 overflow-hidden">
                <motion.div
                  className="h-full rounded-full"
                  style={{
                    width: `${((freeRotation + 180) / 360) * 100}%`,
                    background: DNA_GRADIENT,
                  }}
                />
              </div>
              <input
                type="range"
                min={-180}
                max={180}
                value={freeRotation}
                onChange={(e) => onRotateFree(Number(e.target.value))}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                aria-label="Free rotation"
              />
              {/* Center marker */}
              <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-white/30 -translate-x-1/2" />
            </div>
            
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => onRotateFree(freeRotation + 15)}
              className="w-10 h-10 flex items-center justify-center rounded-xl bg-white/10 hover:bg-white/20 transition-colors"
              aria-label="Rotate right 15 degrees"
            >
              <RotateCw className="w-5 h-5 text-white/70" />
            </motion.button>
          </div>
          
          {/* Quick presets */}
          <div className="flex gap-2">
            {[-180, -90, 0, 90, 180].map((angle) => (
              <button
                key={angle}
                onClick={() => onRotateFree(angle)}
                className={`
                  flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors
                  ${freeRotation === angle
                    ? 'bg-purple-500/30 text-white'
                    : 'bg-white/5 text-white/60 hover:bg-white/10'
                  }
                `}
              >
                {angle}°
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Current rotation indicator */}
      {(rotation !== 0 || flipH || flipV) && (
        <div className="flex items-center justify-center gap-4 py-2 rounded-xl bg-white/5">
          <span className="text-xs text-white/50">Current:</span>
          {rotation !== 0 && (
            <span className="px-2 py-1 rounded-lg bg-white/10 text-xs text-white">
              {normalizedRotation(rotation)}°
            </span>
          )}
          {flipH && (
            <span className="px-2 py-1 rounded-lg bg-purple-500/20 text-xs text-purple-300">
              Flipped H
            </span>
          )}
          {flipV && (
            <span className="px-2 py-1 rounded-lg bg-purple-500/20 text-xs text-purple-300">
              Flipped V
            </span>
          )}
        </div>
      )}
    </div>
  );
});

RotateTool.displayName = 'RotateTool';

RotateTool.propTypes = {
  /** Function to rotate left 90 degrees */
  onRotateLeft: PropTypes.func,
  /** Function to rotate right 90 degrees */
  onRotateRight: PropTypes.func,
  /** Function to flip horizontally */
  onFlipH: PropTypes.func,
  /** Function to flip vertically */
  onFlipV: PropTypes.func,
  /** Current rotation angle in degrees */
  rotation: PropTypes.number,
  /** Whether horizontally flipped */
  flipH: PropTypes.bool,
  /** Whether vertically flipped */
  flipV: PropTypes.bool,
  /** Function for free rotation */
  onRotateFree: PropTypes.func,
  /** Free rotation value */
  freeRotation: PropTypes.number,
};

export default RotateTool;