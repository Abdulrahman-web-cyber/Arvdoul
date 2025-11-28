import plugin from "tailwindcss/plugin";
import forms from "@tailwindcss/forms";
import typography from "@tailwindcss/typography";
import aspectRatio from "@tailwindcss/aspect-ratio";
import colors from "tailwindcss/colors";

export default {
  darkMode: "class", // dual mode: light/dark theme toggle
  content: ["./src/**/*.{js,jsx,ts,tsx}", "./public/index.html"],
  theme: {
    extend: {
      colors: {
        primary: {
          50: "#EFF6FF",
          100: "#DBEAFE",
          200: "#BFDBFE",
          300: "#93C5FD",
          400: "#60A5FA",
          500: "#3B82F6",
          600: "#2563EB",
          700: "#1D4ED8",
          800: "#1E40AF",
          900: "#1E3A8A",
          light: "#3B82F6",
          dark: "#1D4ED8",
        },
        secondary: {
          50: "#FEF3C7",
          100: "#FDE68A",
          200: "#FCD34D",
          300: "#FBBF24",
          400: "#F59E0B",
          500: "#D97706",
          600: "#B45309",
          700: "#92400E",
          800: "#78350F",
          900: "#451A03",
        },
        gray: colors.neutral,
        success: colors.green,
        warning: colors.yellow,
        danger: colors.red,
      },
      spacing: {
        "1/7": "14.2857143%",
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
        serif: ["ui-serif", "Georgia", "serif"],
        mono: ["ui-monospace", "SFMono-Regular", "monospace"],
      },
      borderRadius: {
        xl: "1rem",
        "2xl": "1.5rem",
      },
      boxShadow: {
        card: "0 4px 12px rgba(0,0,0,0.08)",
        dropdown: "0 8px 24px rgba(0,0,0,0.12)",
      },
      transitionTimingFunction: {
        "in-out-quad": "cubic-bezier(0.455, 0.03, 0.515, 0.955)",
      },
      maxWidth: {
        "screen-sm": "640px",
      },
    },
  },
  plugins: [
    // custom safe-area utilities
    plugin(function ({ addUtilities }) {
      addUtilities({
        ".safe-top": { paddingTop: "env(safe-area-inset-top)" },
        ".safe-bottom": { paddingBottom: "env(safe-area-inset-bottom)" },
        ".safe-left": { paddingLeft: "env(safe-area-inset-left)" },
        ".safe-right": { paddingRight: "env(safe-area-inset-right)" },
      });
    }),
    forms,
    typography,
    aspectRatio,
  ],
};
