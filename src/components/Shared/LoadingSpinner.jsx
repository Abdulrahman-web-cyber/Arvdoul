import React, { useEffect } from "react";
import PropTypes from "prop-types";
import { motion, useAnimation } from "framer-motion";
import { useTheme } from "@context/ThemeContext";
import { useInView } from "react-intersection-observer";
import { tokens } from "../../design-system/tokens.js";

const LoadingSpinner = React.memo(
  ({
    size = 60,
    color = "primary",
    dotCount = 16,
    speed = "normal",
    trailEffect = false,
    ariaLabel = "Loading...",
  }) => {
    const { theme } = useTheme();
    const controls = useAnimation();
    const [ref, inView] = useInView({ threshold: 0.1 });

    useEffect(() => {
      if (inView) controls.start("animate");
      else controls.start("initial");
    }, [controls, inView]);

    const colorSchemes = {
      primary: { light: tokens.color.brand.violet, dark: tokens.color.brand.violet },
      secondary: { light: tokens.color.brand.indigo, dark: tokens.color.brand.indigo },
      blue: { light: tokens.color.brand.blue, dark: tokens.color.brand.blue },
      success: { light: "#059669", dark: "#10B981" },
      warning: { light: "#D97706", dark: "#F59E0B" },
      danger: { light: "#DC2626", dark: "#EF4444" },
      light: { light: "rgba(0,0,0,0.2)", dark: "rgba(255,255,255,0.7)" },
      dark: { light: "#111827", dark: "#FFFFFF" },
    };

    const spinnerColor =
      colorSchemes[color]?.[theme] || color || tokens.color.brand.violet;

    const radius = size / 2;
    const dotSize = size * 0.12;
    const dots = Array.from({ length: dotCount });

    const speedConfig = { slow: 1.2, normal: 0.8, fast: 0.5, ultra: 0.3 };
    const duration = speedConfig[speed] || 0.8;

    const getTrailOpacity = (index) => {
      if (!trailEffect) return 1;
      const step = 1 / dotCount;
      return Math.max(0.2, 1 - index * step);
    };

    return (
      <div
        ref={ref}
        className="relative inline-block"
        style={{ width: size, height: size }}
        aria-label={ariaLabel}
        role="status"
      >
        {dots.map((_, i) => {
          const angle = (360 / dotCount) * i;
          const x = radius * Math.cos((angle * Math.PI) / 180);
          const y = radius * Math.sin((angle * Math.PI) / 180);

          return (
            <motion.div
              key={i}
              className="absolute rounded-full"
              style={{
                width: dotSize,
                height: dotSize,
                backgroundColor: spinnerColor,
                top: radius + y - dotSize / 2,
                left: radius + x - dotSize / 2,
                opacity: getTrailOpacity(i),
              }}
              initial={{ scale: 0.5, opacity: 0.3 }}
              animate={{ scale: [0.5, 1, 0.5], opacity: [0.3, 1, 0.3] }}
              transition={{
                repeat: Infinity,
                duration,
                delay: (i * duration) / dotCount,
                ease: "easeInOut",
              }}
            />
          );
        })}
      </div>
    );
  }
);

LoadingSpinner.propTypes = {
  size: PropTypes.number,
  color: PropTypes.string,
  dotCount: PropTypes.number,
  speed: PropTypes.oneOf(["slow", "normal", "fast", "ultra"]),
  trailEffect: PropTypes.bool,
  ariaLabel: PropTypes.string,
};

export default LoadingSpinner;