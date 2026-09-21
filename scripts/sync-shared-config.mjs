#!/usr/bin/env node
/**
 * scripts/sync-shared-config.mjs
 *
 * Firebase packages ONLY the `functions/` directory when deploying, so a
 * `require('../src/shared/...')` works locally and in emulators but breaks in
 * the deployed function. This script copies each canonical shared module from
 * src/shared/ into functions/ as a byte-identical CommonJS file.
 *
 * The canonical file is the only hand-edited source. `npm run sync:shared` runs
 * this, `functions/package.json` runs it as a `predeploy` hook, and
 * src/__tests__/sharedConfigSync.test.js fails CI if the copies ever drift.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const SHARED_MODULES = ['levelConfig.cjs'];

mkdirSync(join(repoRoot, 'functions'), { recursive: true });

for (const name of SHARED_MODULES) {
  const from = join(repoRoot, 'src', 'shared', name);
  const to = join(repoRoot, 'functions', name);
  const contents = readFileSync(from, 'utf8');
  writeFileSync(to, contents);
  console.log(`synced src/shared/${name} -> functions/${name}`);
}