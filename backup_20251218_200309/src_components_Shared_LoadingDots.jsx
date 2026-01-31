import React, { useEffect } from "react";
import PropTypes from "prop-types";
import { motion, useAnimation } from "framer-motion";
import { useTheme } from "@context/ThemeContext";
import { useInView } from "react-intersection-observer";

const LoadingDots = React.memo(
  ({
    size = "md",
    color = "primary",
    speed = "normal",
    dotCount = 5,
    spread = "normal",
    animationType = "bounce",
    label = "Loading...",
    className = "",
    ariaLive = "polite",
    customColors = null,
    dotShape = "round",
    trailEffect = false,
    trailLength = 3,
    opacityRange = [0.4, 1],
    scaleRange = [0.8, 1.2],
    direction = "horizontal",
    align = "center",
  }) => {
    const { theme } = useTheme();
    const controls = useAnimation();
    const [ref, inView] = useInView({ threshold: 0.1 });

    useEffect(() => {
      if (inView) controls.start("animate");
      else controls.start("initial");
    }, [controls, inView]);

    const sizeConfig = {
      xs: { dotSize: 6, spacing: 8, labelSize: "text-xs" },
      sm: { dotSize: 8, spacing: 10, labelSize: "text-sm" },
      md: { dotSize: 10, spacing: 12, labelSize: "text-base" },
      lg: { dotSize: 12, spacing: 14, labelSize: "text-lg" },
      xl: { dotSize: 14, spacing: 16, labelSize: "text-xl" },
    };

    const spreadConfig = { tight: 0.8, normal: 1, wide: 1.5, extraWide: 2 };

    const colorSchemes = {
      primary: { light: "#6366f1", dark: "#818cf8" },
      secondary: { light: "#8b5cf6", dark: "#a78bfa" },
      success: { light: "#10b981", dark: "#34d399" },
      warning: { light: "#f59e0b", dark: "#fbbf24" },
      danger: { light: "#ef4444", dark: "#f87171" },
      light: { light: "#e5e7eb", dark: "#f3f4f6" },
      dark: { light: "#374151", dark: "#4b5563" },
      custom: customColors || { light: "#6366f1", dark: "#818cf8" },
    };

    const speedConfig = { slow: 1.5, normal: 1, fast: 0.6, ultra: 0.3 };

    const animationVariants = {
      bounce: {
        initial: { y: 0, opacity: opacityRange[0], scale: scaleRange[0] },
        animate: (i) => ({
          y: [0, -sizeConfig[size].dotSize * 0.8, 0],
          opacity: [opacityRange[0], opacityRange[1], opacityRange[0]],
          scale: [scaleRange[0], scaleRange[1], scaleRange[0]],
          transition: {
            duration: speedConfig[speed],
            repeat: Infinity,
            delay: i * (speedConfig[speed] * 0.2),
          },
        }),
      },
      pulse: {
        initial: { opacity: opacityRange[0], scale: scaleRange[0] },
        animate: (i) => ({
          opacity: [opacityRange[0], opacityRange[1], opacityRange[0]],
          scale: [scaleRange[0], scaleRange[1], scaleRange[0]],
          transition: {
            duration: speedConfig[speed],
            repeat: Infinity,
            delay: i * (speedConfig[speed] * 0.2),
          },
        }),
      },
      fade: {
        initial: { opacity: opacityRange[0] },
        animate: (i) => ({
          opacity: [opacityRange[0], opacityRange[1], opacityRange[0]],
          transition: {
            duration: speedConfig[speed],
            repeat: Infinity,
            delay: i * (speedConfig[speed] * 0.2),
          },
        }),
      },
      wave: {
        initial: { y: 0 },
        animate: (i) => ({
          y: [
            0,
            -sizeConfig[size].dotSize * 0.5,
            0,
            sizeConfig[size].dotSize * 0.3,
            0,
          ],
          opacity: [
            opacityRange[0],
            opacityRange[1],
            opacityRange[0],
            opacityRange[1] / 2,
            opacityRange[0],
          ],
          transition: {
            duration: speedConfig[speed] * 1.5,
            repeat: Infinity,
            delay: i * (speedConfig[speed] * 0.15),
          },
        }),
      },
    };

    const shapeClasses = {
      round: "rounded-full",
      square: "rounded-sm",
      diamond: "rotate-45 rounded-sm",
      triangle: "clip-triangle",
    };

    const directionClasses = { horizontal: "flex-row", vertical: "flex-col" };
    const alignClasses = {
      center: "justify-center",
      start: "justify-start",
      end: "justify-end",
      between: "justify-between",
      around: "justify-around",
      evenly: "justify-evenly",
    };

    const currentColor =
      theme === "dark"
        ? colorSchemes[color]?.dark || colorSchemes.primary.dark
        : colorSchemes[color]?.light || colorSchemes.primary.light;

    const getTrailOpacity = (index) => {
      if (!trailEffect) return 1;
      const step = (opacityRange[1] - opacityRange[0]) / Math.max(trailLength, 1);
      return Math.max(opacityRange[0], opacityRange[1] - index * step);
    };

    return (
      <motion.div
        ref={ref}
        className={`flex ${directionClasses[direction]} ${alignClasses[align]} items-center ${className}`}
        initial="initial"
        animate={controls}
        role="status"
        aria-live={ariaLive}
        aria-busy="true"
        aria-label={label}
      >
        <div
          className={`flex ${directionClasses[direction]} items-center`}
          style={{ gap: sizeConfig[size].spacing * spreadConfig[spread] }}
        >
          {Array.from({ length: dotCount }).map((_, index) => (
            <motion.div
              key={index}
              className={shapeClasses[dotShape]}
              style={{
                width: sizeConfig[size].dotSize,
                height: sizeConfig[size].dotSize,
                backgroundColor:
                  dotShape === "triangle" ? "transparent" : currentColor,
                clipPath:
                  dotShape === "triangle"
                    ? "polygon(50% 0%, 0% 100%, 100% 100%)"
                    : undefined,
                opacity: getTrailOpacity(index),
              }}
              custom={index}
              variants={animationVariants[animationType]}
            />
          ))}
        </div>

        {label && (
          <motion.span
            className={`mt-3 ${sizeConfig[size].labelSize} text-gray-500 dark:text-gray-400`}
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            {label}
          </motion.span>
        )}
      </motion.div>
    );
  },
);

LoadingDots.propTypes = {
  size: PropTypes.oneOf(["xs", "sm", "md", "lg", "xl"]),
  color: PropTypes.oneOf([
    "primary",
    "secondary",
    "success",
    "warning",
    "danger",
    "light",
    "dark",
    "custom",
  ]),
  speed: PropTypes.oneOf(["slow", "normal", "fast", "ultra"]),
  dotCount: PropTypes.number,
  spread: PropTypes.oneOf(["tight", "normal", "wide", "extraWide"]),
  animationType: PropTypes.oneOf(["bounce", "pulse", "fade", "wave"]),
  label: PropTypes.string,
  className: PropTypes.string,
  ariaLive: PropTypes.oneOf(["polite", "assertive", "off"]),
  customColors: PropTypes.shape({
    light: PropTypes.string,
    dark: PropTypes.string,
  }),
  dotShape: PropTypes.oneOf(["round", "square", "diamond", "triangle"]),
  trailEffect: PropTypes.bool,
  trailLength: PropTypes.number,
  opacityRange: PropTypes.arrayOf(PropTypes.number),
  scaleRange: PropTypes.arrayOf(PropTypes.number),
  direction: PropTypes.oneOf(["horizontal", "vertical"]),
  align: PropTypes.oneOf([
    "center",
    "start",
    "end",
    "between",
    "around",
    "evenly",
  ]),
};

LoadingDots.defaultProps = {
  dotCount: 5,
  spread: "normal",
  animationType: "bounce",
  trailEffect: false,
  trailLength: 3,
  opacityRange: [0.4, 1],
  scaleRange: [0.8, 1.2],
  direction: "horizontal",
  align: "center",
};

export default LoadingDots;