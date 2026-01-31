import React, { useEffect } from "react";
import PropTypes from "prop-types";
import { motion, useAnimation } from "framer-motion";
import { useTheme } from "@context/ThemeContext";
import { useInView } from "react-intersection-observer";

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
      primary: { light: "#6366f1", dark: "#818cf8" },
      secondary: { light: "#8b5cf6", dark: "#a78bfa" },
      success: { light: "#10b981", dark: "#34d399" },
      warning: { light: "#f59e0b", dark: "#fbbf24" },
      danger: { light: "#ef4444", dark: "#f87171" },
      light: { light: "#e5e7eb", dark: "#f3f4f6" },
      dark: { light: "#374151", dark: "#4b5563" },
    };

    const spinnerColor =
      colorSchemes[color]?.[theme] || color || "#6366f1";

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

LoadingSpinner.defaultProps = {
  size: 60,
  color: "primary",
  dotCount: 16,
  speed: "normal",
  trailEffect: false,
  ariaLabel: "Loading...",
};

export default LoadingSpinner;