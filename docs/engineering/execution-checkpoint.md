# Execution checkpoint

_Last updated: this session. Branch `harden/fabrication-and-integrity-sweep` (PR #42)._

## Current state

- Baseline: full Jest suite green (121 suites, 1464 passed, 5 skipped); `npm run
  build` green; `npm run lint` exit 0 (0 errors, warnings only).

## Completed this session

| # | Item | Evidence |
| --- | --- | --- |
| N182 | CI blocker (Jest 30 `require(esm)` on Node 22) | `profileFeedGridLikeCount.test.jsx` green on Node 22 + 24 |
| T1.1 | No-fabrication sweep (money/counts unknown, never 0) | `src/lib/unknownNumber.js`; `noFabricatedData` +N183 |
| T1.2 | Cloud Functions contract coverage | `deployIntegrity` asserts every `FUNCTIONS` key is deployed (129/129) |
| T1.3 | Firestore query-index parity | `firestoreQueryIndexMap.test.js`; removed dead `reels(createdAt)` index; `docs/engineering/firestore-query-index-map.md` |
| T1.4 | Accessibility gate | `a11yInteractiveGuard.test.js`; 17 interactive divs -> real controls/sliders |
| #16 | Node parity + CI promotion | `engines.node >=22`, `.nvmrc`, `.node-version`; lint + test jobs now hard-failing; test matrix Node 22 & 24 |

New guards are registered in the hard-failing `guards` CI job.

## Next exact tasks (dependency order)

1. **#12 Design-system consolidation** - migrate raw brand hex in UI to tokens;
   extend `designTokenDriftGuard`.
2. **#13 Shared state primitives** - adopt `EmptyState`/`ErrorState`.
3. **#11 i18n rollout** - extract strings per screen group.
4. **#17/#14/#15** - contract ratchet, offline pending, observability sink.

## Commands to resume

```
git status
NODE_OPTIONS=--experimental-vm-modules npm run test -- --watchAll=false
npm run build
npm run lint
```
