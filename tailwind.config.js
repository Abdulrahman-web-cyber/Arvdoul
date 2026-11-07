/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      // Tailwind's default opacity scale skips 8 and 12, so `bg-white/8` and
      // `border-white/12` silently generated NO rule — the glass surfaces in the
      // search components, `videoUtils` glass classes and the ThemeProvider glass
      // presets rendered fully transparent. Declare the steps the UI uses.
      opacity: {
        8: '0.08',
        12: '0.12',
      },
      colors: {
        'arvdoul-bg': '#03071B',
        'arvdoul-surface': 'rgba(3, 7, 27, 0.85)',
        'arvdoul-purple': '#8B1EF3',
        'arvdoul-indigo': '#4431F7',
        'arvdoul-blue': '#055BFB',
        'arvdoul-glow-magenta': '#C82BFF',
        'arvdoul-glow-cyan': '#0088FF',
        'arvdoul-glass': 'rgba(255, 255, 255, 0.05)',
        'arvdoul-border': 'rgba(255, 255, 255, 0.08)',
        'arvdoul-text-primary': '#FFFFFF',
        'arvdoul-text-secondary': '#94A3B8',
      },
      backgroundImage: {
        'arvdoul-gradient': 'linear-gradient(135deg, #8B1EF3 0%, #4431F7 50%, #055BFB 100%)',
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
      },
      boxShadow: {
        'arvdoul-glass': '0 8px 32px rgba(8, 0, 50, 0.45), inset 0 1px 0 rgba(255, 255, 255, 0.05)',
        'arvdoul-button': '0 4px 15px rgba(5, 91, 251, 0.4)',
        // Brand violet glow used by FABs and the create/reels CTAs. Was referenced
        // as `shadow-arvdoul-glow` in 10 places but never declared, so no glow rendered.
        'arvdoul-glow': '0 0 20px rgba(139, 30, 243, 0.45)',
      },
      borderRadius: {
        'arvdoul-sm': '8px',
        'arvdoul-md': '16px',
        'arvdoul-lg': '24px',
        'arvdoul-xl': '32px',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        display: ['Clash Display', 'Inter', 'system-ui', 'sans-serif'],
      },
      keyframes: {
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        'fade-in-out': {
          '0%, 100%': { opacity: '0' },
          '50%': { opacity: '1' },
        },
        'slide-up': {
          from: { opacity: '0', transform: 'translateY(16px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'pulse-slow': 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'fade-in': 'fade-in 0.3s ease-out',
        'fade-in-out': 'fade-in-out 2s ease-in-out infinite',
        'slide-up': 'slide-up 0.3s ease-out',
        'spin-slow': 'spin 3s linear infinite',
      },
    },
  },
  plugins: [],
}