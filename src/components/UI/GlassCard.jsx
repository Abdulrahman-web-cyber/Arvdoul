// src/components/UI/GlassCard.jsx

import { memo, useMemo } from "react";
import { motion } from 'framer-motion';
import { useTheme } from '../../context/ThemeContext';
import { brandRgba } from '../../design-system/tokens.js';

/**
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
        ? 'shadow-2xl'
        : 'shadow-[0_20px_60px_rgba(0,0,0,0.08)] hover:shadow-[0_28px_80px_rgba(0,0,0,0.12)]';
    }
    return colors.shadow.card;
  }, [glow, colors.shadow.card, isDark]);

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
      onKeyDown={onClick && !disabled ? (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick(e);
        }
      } : undefined}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick && !disabled ? 0 : undefined}
      aria-disabled={disabled}
      style={glow && isDark ? { boxShadow: `0 25px 80px ${brandRgba(0.16)}` } : undefined}
      {...props}
    >
      {children}
    </motion.div>
  );
});

GlassCard.displayName = 'GlassCard';

export default GlassCard;
