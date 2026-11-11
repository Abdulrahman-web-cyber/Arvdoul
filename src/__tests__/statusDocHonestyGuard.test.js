/**
 * Status-document honesty guard.
 *
 * `ARVDOUL_STATUS.md` once claimed "59 of 59 features complete … 100%" while
 * citing 40 file paths that did not exist — the fabricated Phase 11–20
 * client-side services the repo deliberately removed. A status doc that marks a
 * feature complete because a file *used to exist* is the same defect class as
 * fabricated data (`noFabricatedData.test.js`), so this guard makes the claim
 * falsifiable:
 *
 *  1. Every file path the document presents as *existing* must resolve in the
 *     working tree. A small allowlist names the paths the document explicitly
 *     documents as **removed** — those are allowed to be absent.
 *  2. The old false completeness claim ("59 of 59" / "100% (59") must not return.
 *  3. The document must keep its evidence-based header.
 *
 * @jest-environment node
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const DOC = path.join(root, 'ARVDOUL_STATUS.md');

// Paths the document explicitly records as REMOVED / NOT IMPLEMENTED. These are
// expected to be absent; anything else the document names must exist.
const DOCUMENTED_REMOVED = new Set([
  // Phase 11–20 fabricated services
  'recommendationEngine.js',
  'spacesOrchestrator.js',
  'complianceGovernanceService.js',
  'multiRegionMeshService.js',
  'verifiableCredentialsService.js',
  'digitalEscrowService.js',
  'aiCoPilotDirectorService.js',
  'predictiveAnalyticsService.js',
  'communityGovernanceService.js',
  'revenueSplitsService.js',
  'liveInteractiveGamificationService.js',
  'watchPartyService.js',
  'contentProvenanceService.js',
  'activityPubMeshService.js',
  'chaosDefenseService.js',
  'immutableAuditLedgerService.js',
  'decentralizedStorageMeshService.js',
  'decentralizedBountyMarketService.js',
  'decentralizedTokenBondingCurveService.js',
  'decentralizedModerationJuryService.js',
  // Phase 7 / 9 / 10 files the document records as never existing
  'LowEndModeToggle.jsx',
  'observabilityService.js',
  'shardedCounter.js',
  'cacheControl.js',
  // Removed phase test files
  'phase9ObservabilityAndCICD.test.js',
  'phase10ScalabilityAndHardening.test.js',
  'phase11RecommendationAndSpaces.test.js',
  'phase12ComplianceAndResilienceMesh.test.js',
  'phase13CredentialsAndEscrow.test.js',
  'phase14AICoPilotAndPredictive.test.js',
  'phase15GovernanceAndRevenueSplits.test.js',
  'phase16LiveGamificationAndWatchParty.test.js',
  'phase17ProvenanceAndActivityPub.test.js',
  'phase18ChaosAndAuditLedger.test.js',
  'phase19P2PAndBountyMarket.test.js',
  'phase20BondingCurveAndStakedJury.test.js',
]);

function resolvePath(p) {
  const candidates = [
    p,
    `src/services/${p}`,
    `src/utils/${p}`,
    `src/screens/${p}`,
    `src/components/${p}`,
    `src/__tests__/${p}`,
    `public/${p}`,
    `.github/workflows/${p}`,
  ];
  if (candidates.some((c) => fs.existsSync(path.join(root, c)))) return true;
  // last resort: a same-basename file anywhere in the tree
  const base = path.basename(p);
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === 'node_modules' || entry.name === '.git') continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (walk(full)) return true;
      } else if (entry.name === base) {
        return true;
      }
    }
    return false;
  };
  return walk(root);
}

describe('ARVDOUL_STATUS.md honesty guard', () => {
  const doc = fs.readFileSync(DOC, 'utf8');

  test('keeps its evidence-based header', () => {
    expect(doc).toMatch(/FEATURE STATUS \(EVIDENCE-BASED\)/);
    expect(doc).toMatch(/Defects corrected in this rewrite/);
  });

  test('does not re-assert the false 59/59 100% completeness claim', () => {
    // The correction narrative may *quote* the old claim; what must never return
    // is the claim itself — the summary-table total row and the headline.
    expect(doc).not.toMatch(/\|\s*\*\*TOTAL\*\*\s*\|\s*\*\*59\*\*/);
    expect(doc).not.toMatch(/Overall Progress:\s*100%/);
    expect(doc).not.toMatch(/features complete, hardened, and verified across all 20 Phases/);
  });

  test('every path presented as existing resolves (removed ones allowlisted)', () => {
    const paths = new Set(
      [...doc.matchAll(/`([A-Za-z0-9_./-]+\.(?:js|jsx|json|md|css|html|yml|yaml|cjs|mjs))`/g)].map((m) => m[1])
    );
    const missing = [...paths].filter(
      (p) => !DOCUMENTED_REMOVED.has(path.basename(p)) && !resolvePath(p)
    );
    expect(missing).toEqual([]);
  });
});
