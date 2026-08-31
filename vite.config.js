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
    react(),
    process.env.NODE_ENV === 'production' ? stripConsolePlugin() : null,
    metricsEndpointPlugin(),
  ].filter(Boolean),
  server: {
    host: '0.0.0.0',
    port: 3000,
    allowedHosts: true,
    open: false
  },
  preview: {
    host: '0.0.0.0',
    port: 3000,
    allowedHosts: true
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    chunkSizeWarningLimit: 1000
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
      'firebase/app',
      'firebase/auth',
      'firebase/firestore',
      'firebase/storage',
      'firebase/functions'
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
