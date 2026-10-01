// src/__tests__/sharedConfigSync.test.js

import { jest } from '@jest/globals';
import fs from 'fs';
import path from 'path';

const root = process.cwd();

/**
 * Firebase uploads only the `functions/` directory, so the client and the
 * function runtime cannot share a file in place. scripts/sync-shared-config.mjs
 * copies src/shared/*.cjs into functions/, and these tests are the guardrail
 * that the copy never silently drifts from the canonical source.
 */
const SHARED_MODULES = ['levelConfig.cjs', 'featureFlagRegistry.cjs'];

describe('shared config single source of truth', () => {
  test.each(SHARED_MODULES)('%s is byte-identical in src/shared and functions', (name) => {
    const canonical = fs.readFileSync(path.join(root, 'src', 'shared', name), 'utf8');
    const deployed = fs.readFileSync(path.join(root, 'functions', name), 'utf8');
    expect(deployed).toBe(canonical);
  });

  test('the client level service does not redefine the level curve', () => {
    const src = fs.readFileSync(path.join(root, 'src', 'services', 'levelSystemService.js'), 'utf8');
    // Curve/table declarations must live only in the shared module.
    expect(src).not.toContain('Array.from({ length: 100 }');
    expect(src).not.toContain('xpRequired = 50 * level');
    expect(src).toContain("from '../shared/levelConfig.cjs'");
  });

  test('the server level function imports the shared module, not a copy', () => {
    const src = fs.readFileSync(path.join(root, 'functions', 'levelSystem.js'), 'utf8');
    expect(src).not.toContain('Array.from({ length: 100 }');
    expect(src).toContain("require('./levelConfig.cjs')");
  });

  test('the client flag service does not redefine the flag registry', () => {
    const src = fs.readFileSync(path.join(root, 'src', 'services', 'featureFlagService.js'), 'utf8');
    expect(src).not.toContain("'feed.ml_ranking': {");
    expect(src).toContain("from '../shared/featureFlagRegistry.cjs'");
  });

  test('the server flag governance module imports the shared registry, not a copy', () => {
    const src = fs.readFileSync(path.join(root, 'functions', 'featureFlags.js'), 'utf8');
    expect(src).not.toContain("'feed.ml_ranking': {");
    expect(src).toContain("require('./featureFlagRegistry.cjs')");
  });

  test('sync script and predeploy hook exist so the copy cannot go stale', () => {
    expect(fs.existsSync(path.join(root, 'scripts', 'sync-shared-config.mjs'))).toBe(true);
    const fnsPkg = JSON.parse(fs.readFileSync(path.join(root, 'functions', 'package.json'), 'utf8'));
    expect(fnsPkg.scripts.predeploy).toContain('sync-shared-config');
    const rootPkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
    expect(rootPkg.scripts['sync:shared']).toContain('sync-shared-config');
  });
});