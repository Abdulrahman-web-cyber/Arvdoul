import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

/**
 * Transforms source CommonJS (.cjs) modules into ES modules with named and default exports.
 * Essential for shared configuration files consumed by both Vite client and Node Cloud Functions.
 */
function cjsToEsmPlugin() {
  return {
    name: 'arvdoul-cjs-to-esm',
    apply: 'serve',
    transform(code, id) {
      if (id.includes('.cjs')) {
        const exportMatch = code.match(/module\.exports\s*=\s*\{([\s\S]*?)\};?/);
        if (exportMatch) {
          const exportBody = exportMatch[1];
          const exportKeys = exportBody
            .split(',')
            .map((k) => k.trim())
            .filter((k) => k && !k.startsWith('//') && !k.startsWith('/*'))
            .map((k) => k.split(':')[0].trim())
            .filter((k) => /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(k));

          const transformed = code.replace(
            exportMatch[0],
            `const __cjs_exports = {${exportBody}};\n` +
            `export { ${exportKeys.join(', ')} };\n` +
            `export default __cjs_exports;\n`
          );
          return {
            code: transformed,
            map: null,
          };
        }
      }
      return null;
    },
  };
}

/**
 * Dev-only Prometheus scrape endpoint.
 *
 * Serves the metricsService Prometheus text exposition at GET /metrics so a
 * local Prometheus (see ops/prometheus/prometheus.yml) can scrape the SPA's
 * client-side telemetry (RUM vitals, API latency histograms, error counters)
 * during development and dogfooding.
 *
 * In production, client metrics should be pushed to a pushgateway/OTLP
 * collector instead (see docs/OBSERVABILITY.md) — this plugin is dev-only.
 */
function metricsEndpointPlugin() {
  return {
    name: 'arvdoul-metrics-endpoint',
    configureServer(server) {
      server.middlewares.use('/metrics', async (_req, res) => {
        res.setHeader('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
        res.setHeader('Cache-Control', 'no-store');
        try {
          const { metricsService } = await import('./src/services/metricsService.js');
          // Liveness pulse so a scrape always yields telemetry, even before
          // the first app event is recorded.
          metricsService.incrementCounter('dev_scrape_total', 1);
          metricsService.setGauge('dev_server_uptime_seconds', Math.round(process.uptime()));
          res.end(metricsService.getPrometheusMetrics() + '\n');
        } catch (err) {
          res.statusCode = 500;
          res.end(`# metrics unavailable: ${err.message}\n`);
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [
    cjsToEsmPlugin(),
    react(),
    process.env.NODE_ENV === 'production' ? stripConsolePlugin() : null,
    metricsEndpointPlugin(),
  ].filter(Boolean),
  server: {
    host: '0.0.0.0',
    port: 3000,
    allowedHosts: true,
    open: false,
    hmr: false,
    ws: false
  },
  preview: {
    host: '0.0.0.0',
    port: 3000,
    allowedHosts: true
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          if (id.includes('firebase') || id.includes('@firebase')) return 'firebase-vendor';
          if (id.includes('framer-motion') || id.includes('lucide-react')) return 'ui-vendor';
          if (id.includes('emoji-picker-react')) return 'emoji-vendor';
          if (id.includes('@tiptap') || id.includes('prosemirror')) return 'editor-vendor';
          if (id.includes('konva') || id.includes('react-konva')) return 'canvas-vendor';
          if (id.includes('algoliasearch') || id.includes('marked') || id.includes('dompurify')) return 'content-vendor';
          if (id.includes('i18next')) return 'i18n-vendor';
          if (id.includes('react-router') || id.includes('/react/') || id.includes('/react-dom/')) return 'react-vendor';
          return 'vendor';
        }
      }
    }
  },
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react-dom/client',
      'react-router-dom',
      'react-helmet-async',
      'framer-motion',
      'lucide-react',
      'clsx',
      'tailwind-merge',
      'zustand',
      'immer',
      'sonner',
      'date-fns',
      'prop-types',
      'use-debounce',
      'uuid',
      'quick-lru',
      'firebase/app',
      'firebase/auth',
      'firebase/database',
      'firebase/firestore',
      'firebase/functions',
      'firebase/messaging',
      'firebase/remote-config',
      'firebase/storage',
      'firebase/app-check',
      '@stripe/react-stripe-js',
      '@stripe/stripe-js',
      '@stripe/stripe-js/pure',
      'hls.js',
      'tippy.js',
      '@popperjs/core',
      '@tiptap/core',
      '@tiptap/react',
      '@tiptap/starter-kit',
      '@tiptap/extension-character-count',
      '@tiptap/extension-link',
      '@tiptap/extension-mention',
      '@tiptap/extension-placeholder',
      '@tiptap/extension-underline',
      '@tiptap/suggestion',
      'prosemirror-state',
      '@tanstack/react-query',
      '@dnd-kit/core',
      '@dnd-kit/sortable',
      '@dnd-kit/utilities',
      'algoliasearch/lite',
      'browser-image-compression',
      'crypto-js',
      'dompurify',
      'emoji-picker-react',
      'focus-trap-react',
      'i18next',
      'i18next-browser-languagedetector',
      'react-i18next',
      'idb',
      'jsqr',
      'konva',
      'react-konva',
      'localforage',
      'lodash-es',
      'marked',
      'react-datepicker',
      'react-dropzone',
      'react-easy-crop',
      'react-icons/fa',
      'react-icons/fa6',
      'react-icons/md',
      'react-intersection-observer',
      'react-loading-skeleton',
      'react-markdown',
      'react-modal',
      'react-select',
      'react-swipeable',
      'react-virtuoso',
      'search-insights'
    ]
  },
  resolve: {
    dedupe: ['react', 'react-dom', 'react-router-dom', 'react-router'],
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
