/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
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
      animation: {
        'pulse-slow': 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
    },
  },
  plugins: [],
}