// src/utils/haptics.js
// Ultra Pro Max Production Ready Haptics Engine for Arvdoul

const canVibrate =
  typeof navigator !== "undefined" &&
  typeof navigator.vibrate === "function";

const patterns = {
  light: 10,
  medium: [20],
  heavy: [35],
  success: [15, 30, 15],
  error: [40, 20, 40],
  warning: [25, 15, 25],
  selection: [8],
  impact: [12, 18, 12],
};

export const triggerHaptic = (type = "light") => {
  try {
    if (!canVibrate) return false;

    const pattern = patterns[type] || patterns.light;

    navigator.vibrate(pattern);

    return true;
  } catch (error) {
    console.warn("Haptic feedback failed:", error);
    return false;
  }
};

export const stopHaptics = () => {
  try {
    if (!canVibrate) return;
    navigator.vibrate(0);
  } catch (error) {
    console.warn("Failed to stop haptics:", error);
  }
};

export default {
  triggerHaptic,
  stopHaptics,
};
