import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// Strips console.* statements from production bundles (keeps dev logs).
function stripConsolePlugin() {
  return {
    name: 'strip-console',
    transform(code, id) {
      if (id.includes('node_modules')) return null;
      // Only strip simple calls (no nested parens) — safe against mangling.
      return code.replace(/\bconsole\.(log|debug|info)\([^()\n]*\)\s*;/g, '');
    },
  };
}

export default defineConfig({
  plugins: [react(), process.env.NODE_ENV === 'production' ? stripConsolePlugin() : null].filter(Boolean),
  server: {
    host: true,
    port: 5173,
    open: false
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    chunkSizeWarningLimit: 1000
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@components': path.resolve(__dirname, './src/components'),
      '@screens': path.resolve(__dirname, './src/screens'),
      '@context': path.resolve(__dirname, './src/context'),
      '@lib': path.resolve(__dirname, './src/lib'),
      '@hooks': path.resolve(__dirname, './src/hooks'),
      '@data': path.resolve(__dirname, './src/data'),
      '@assets': path.resolve(__dirname, './src/assets'),
      '@app-firebase': path.resolve(__dirname, './src/firebase'),
      '@styles': path.resolve(__dirname, './src/styles')
    }
  }
});
