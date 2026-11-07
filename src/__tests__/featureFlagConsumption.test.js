// src/__tests__/featureFlagConsumption.test.js
//
// A declared feature flag that no product surface reads is a false feature
// claim: the admin console can flip it, the audit trail records the decision,
// and nothing changes. This guard fails when a registered flag has no consumer
// in either the client or the Cloud Functions source, so a flag can only be
// added alongside the code it actually gates.

import fs from 'fs';
import path from 'path';
import { DEFAULT_FLAGS } from '../shared/featureFlagRegistry.cjs';

const root = process.cwd();

// Files that declare the registry or expose the generic read API are not
// consumers of a specific flag.
const EXCLUDED = [
  path.join('src', 'shared', 'featureFlagRegistry.cjs'),
  path.join('functions', 'featureFlagRegistry.cjs'),
  path.join('src', 'services', 'featureFlagService.js'),
  path.join('functions', 'featureFlags.js'),
];

function collectSourceFiles(dir, acc = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === '__tests__') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) collectSourceFiles(full, acc);
    else if (/\.(js|jsx|cjs|mjs)$/.test(entry.name)) acc.push(full);
  }
  return acc;
}

const sourceFiles = [
  ...collectSourceFiles(path.join(root, 'src')),
  ...collectSourceFiles(path.join(root, 'functions')),
].filter((f) => !EXCLUDED.some((ex) => f.endsWith(ex)));

// Each flag is consumed through one of: the client `isEnabled`/`useFeatureFlag`
// read, the server `isFlagEnabled` read, or a `<FeatureGate flag="...">` prop.
function isConsumed(flag) {
  const escaped = flag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const patterns = [
    new RegExp(`isEnabled\\(\\s*['"\`]${escaped}['"\`]`),
    new RegExp(`isFlagEnabled\\(\\s*['"\`]${escaped}['"\`]`),
    new RegExp(`useFeatureFlag\\(\\s*['"\`]${escaped}['"\`]`),
    new RegExp(`flag=\\{?['"\`]${escaped}['"\`]`),
  ];
  return sourceFiles.some((file) => {
    const src = fs.readFileSync(file, 'utf8');
    return patterns.some((re) => re.test(src));
  });
}

describe('feature flag consumption', () => {
  test('every declared flag is read by real code', () => {
    const orphans = Object.keys(DEFAULT_FLAGS).filter((flag) => !isConsumed(flag));
    expect(orphans).toEqual([]);
  });
});
