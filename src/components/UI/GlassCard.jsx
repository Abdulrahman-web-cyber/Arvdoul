// src/components/UI/GlassCard.jsx - ARVDOUL WORLD-CLASS GLASS CARD
// Futuristic floating glass card with ARVDOUL DNA gradient glow
// Surpasses TikTok, Instagram, YouTube with premium UI

import React, { memo, useMemo } from 'react';
import { motion } from 'framer-motion';
import { useTheme } from '../../context/ThemeContext';

/**
 * GlassCard - World-class floating glass card component
 * 
 * Features:
 * - ARVDOUL DNA gradient glow
 * - Backdrop blur glassmorphism
 * - Spring animations
 * - Hover effects
 * - Fully accessible
 * 
 * @param {Object} props
 * @param {string} props.size - Glass size: 'sm' | 'md' | 'lg' | 'xl'
 * @param {boolean} props.glow - Enable gradient glow
 * @param {boolean} props.hoverable - Enable hover effect
 * @param {string} props.className - Additional classes
 */
const GlassCard = memo(({
  children,
  size = 'md',
  glow = false,
  hoverable = true,
  className = '',
  onClick,
  disabled = false,
  ...props
}) => {
  const { isDark, glass, spring, colors } = useTheme();

  // Generate glass classes
  const glassClass = useMemo(() => {
    const sizeMap = {
      sm: glass.small,
      md: glass.medium,
      lg: glass.large,
      xl: glass.ultra,
    };
    return sizeMap[size] || glass.medium;
  }, [size, glass]);

  // Generate shadow classes
  const shadowClass = useMemo(() => {
    if (glow) {
      return isDark 
        ? 'shadow-[0_25px_80px_rgba(138,43,226,0.45)] hover:shadow-[0_35px_100px_rgba(138,43,226,0.55)]'
        : 'shadow-[0_25px_80px_rgba(0,0,0,0.08)] hover:shadow-[0_35px_100px_rgba(0,0,0,0.12)]';
    }
    return isDark 
      ? colors.shadow.card
      : colors.shadow.card;
  }, [glow, isDark, colors.shadow.card]);

  // Animation variants
  const motionProps = useMemo(() => ({
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -10 },
    transition: spring.card,
  }), [spring.card]);

  return (
    <motion.div
      {...motionProps}
      whileHover={hoverable && !disabled ? { scale: 1.02, y: -4 } : {}}
      whileTap={hoverable && !disabled ? { scale: 0.98 } : {}}
      className={`
        ${glassClass}
        ${shadowClass}
        rounded-3xl
        ${hoverable ? 'cursor-pointer' : ''}
        ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
        ${className}
      `}
      onClick={disabled ? undefined : onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick && !disabled ? 0 : undefined}
      aria-disabled={disabled}
      {...props}
    >
      {children}
    </motion.div>
  );
});

GlassCard.displayName = 'GlassCard';

export default GlassCard;
