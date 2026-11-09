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
| #12 | Design-system consolidation (brand hex) | `brandHexRatchetGuard.test.js` + `scripts/brandHexBaseline.json` (ratchet may only shrink); LoadingSpinner/Collage migrated to `tokens.color.brand.*` (362 -> 349) |
| #13 | Shared state primitives | `design-system/PermissionDenied.jsx` replaces 3 hand-rolled admin denial cards; `sharedStatePrimitivesGuard.test.js` |
| N183 | No-fabrication sweep round 2 | `noFabricatedData` +N184 assertions; 7 count coercions -> `unknownNumber` (—) |
| N184 | Denied-block duplication + count sweep | `sharedStatePrimitivesGuard.test.js`; see N183 |

New guards registered in the hard-failing `guards` CI job: `firestoreQueryIndexMap`,
`a11yInteractiveGuard`, `brandHexRatchetGuard`, `sharedStatePrimitivesGuard`.

## Next exact tasks (dependency order)

1. **#12 Design-system consolidation** (continued) - migrate the remaining ~44 files
   of raw brand hex to `tokens`/`BRAND_GRADIENT`; lower `scripts/brandHexBaseline.json`
   in the same change (the ratchet may only shrink).
2. **#11 i18n rollout** - extract strings per screen group (only 3 screens use
   `useTranslation` today).
3. **#9 Story/Vibe lifecycle** - expiry sweep + client read filter + tests.
4. **#10 Video/Sparks** - moderation wiring on the playback path.
5. **#14/#15/#17** - offline pending surfacing, observability sink, contract ratchet.

## Commands to resume

```
git status
NODE_OPTIONS=--experimental-vm-modules npm run test -- --watchAll=false
npm run build
npm run lint
```
