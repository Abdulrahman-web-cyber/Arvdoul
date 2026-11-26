#!/usr/bin/env node
/**
 * scripts/dev-server.mjs
 *
 * Cross-platform launcher for `npm run dev` (works on Linux, macOS, Windows,
 * and Termux/Android without requiring a `tsx` binary on PATH).
 *
 * - Verifies runtime packages (`express`, and `vite` in dev mode) are present.
 * - Uses Node's native TypeScript type stripping (`node server.ts` on
 *   Node >= 22.18 / 24+, or `--experimental-strip-types` on Node 22.6–22.17).
 * - Falls back to `tsx` only on older Node runtimes if installed.
 */
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const require = createRequire(path.join(rootDir, 'package.json'));
const isProd = process.env.NODE_ENV === 'production';

function hasModule(specifier) {
  try {
    require.resolve(specifier);
    return true;
  } catch {
    return false;
  }
}

const missing = [];
if (!hasModule('express')) missing.push('express');
if (!hasModule('ws')) missing.push('ws');
if (!hasModule('@google/genai')) missing.push('@google/genai');
if (!isProd && !hasModule('vite')) missing.push('vite');

if (missing.length > 0) {
  console.error(
    `\n[arvdoul] Missing required packages in node_modules: ${missing.join(', ')}.\n` +
      'Run "npm install --no-audit --no-fund --include=optional" first.\n' +
      'If installing on Termux/Android, make sure optional native bindings install cleanly (do NOT pass --ignore-scripts if Vite native bindings are skipped).\n',
  );
  process.exit(1);
}

if (!isProd) {
  try {
    await import('vite');
  } catch (err) {
    console.error(
      `\n[arvdoul] Vite failed to initialize (common on Termux/Android when native Rolldown bindings are missing): ${err?.message || err}\n` +
        'Run:\n' +
        '  rm -rf node_modules && npm install --no-audit --no-fund --include=optional\n' +
        'On Termux/Android arm64, ensure Node.js LTS is updated ("pkg upgrade nodejs-lts") and optional bindings (@rolldown/binding-android-arm64) are installed.\n',
    );
    process.exit(1);
  }
}

const [major, minor] = process.versions.node.split('.').map(Number);
let args;

if (process.features && process.features.typescript) {
  // Node >= 22.18 / >= 23.6 / >= 24 runs erasable TypeScript natively.
  args = ['server.ts'];
} else if (major > 22 || (major === 22 && minor >= 6)) {
  args = ['--experimental-strip-types', 'server.ts'];
} else {
  let tsxCli = null;
  try {
    tsxCli = require.resolve('tsx/cli');
  } catch {
    tsxCli = null;
  }
  if (!tsxCli) {
    console.error(
      `\n[arvdoul] Node.js ${process.versions.node} cannot run server.ts natively without tsx.\n` +
        'Upgrade to Node.js >= 22.6 (Termux: "pkg upgrade nodejs-lts") or install tsx.\n',
    );
    process.exit(1);
  }
  args = [tsxCli, 'server.ts'];
}

const child = spawn(process.execPath, args, {
  cwd: rootDir,
  env: process.env,
  stdio: 'inherit',
});

const forwardSignal = (signal) => {
  if (!child.killed) {
    child.kill(signal);
  }
};

process.on('SIGINT', () => forwardSignal('SIGINT'));
process.on('SIGTERM', () => forwardSignal('SIGTERM'));

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 0);
});
